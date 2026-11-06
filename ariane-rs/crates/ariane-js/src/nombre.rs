//! `Number.prototype.toString()` en base 10, au bit près de V8 (ECMA-262, `Number::toString`).
//!
//! Repris de `ariane-decision` (CH-064-D, `js::nombre_chaine`), seule implémentation de l'espace (décision du chef,
//! CH-064) : les modules qui écrivent un nombre en texte passent par ici.
//! - Chiffres : les plus courts qui relisent le même double (`{:e}` de Rust) ;
//! - départage : quand la valeur exacte du double tombe au milieu de deux écritures les plus courtes, ECMA-262 garde le
//!   chiffre PAIR, Rust le chiffre supérieur (ÉTABLI par CH-064-D sur une relecture réelle : 1 860 313 443 422 875,25 rend
//!   « …875.2 » en V8, « …875.3 » en Rust) : corrigé ici ;
//! - mise en forme : entière jusqu'à 10^21, décimale, ou exponentielle (`e+`, `e-`) comme ECMA-262.
//!
//! Chemins rapides (mesure de CH-069 : 1,7 µs par nombre contre 0,19 µs en V8), sans changer un résultat :
//! - entier exact de valeur absolue < 2^53 : écriture entière directe ;
//! - le développement exact à 1 100 chiffres (départage) n'est calculé que si le double PEUT être un milieu exact
//!   (`milieu_possible`, arithmétique entière) ; sinon les chiffres les plus courts sont déjà ceux d'ECMA-262.
//!
//! Sonde : `tools/ch064-sonde-nombres.cjs` (Node et Chromium).

/// Chiffres décimaux et exposant d'un double fini strictement positif : valeur = 0,chiffres × 10^(e10 + 1).
fn chiffres_courts(x: f64) -> (Vec<u8>, i64) {
    let e = format!("{x:e}"); // « d.ddde±x », chiffres les plus courts
    let (mant, exp) = e.split_once('e').unwrap_or((&e, "0"));
    let chiffres = mant.bytes().filter(u8::is_ascii_digit).map(|c| c - b'0').collect();
    (chiffres, exp.parse().unwrap_or(0))
}

fn texte(v: &[u8]) -> String { v.iter().map(|c| char::from(c + b'0')).collect() }

/// Le double fini strictement positif `x` peut-il être EXACTEMENT le milieu de deux écritures de `k` chiffres ?
/// x = m·2^q, m impair. Un milieu a exactement k + 1 chiffres significatifs, le dernier 5.
/// - q < 0 : la valeur exacte est m·5^(−q) × 10^q ; ses chiffres significatifs sont ceux de m·5^(−q) (impair : sans zéro
///   final). Pour −q > 26, 5^(−q) seul a déjà plus de 18 chiffres (k ≤ 17) : jamais un milieu. Sinon, calcul exact en u128
///   (m < 2^53, 5^26 < 1,5·10^18 : produit < 2^114).
/// - q ≥ 1 (entier pair ≥ 2^53 ; q = 0 donne un entier < 2^53, traité par le chemin entier) : un milieu N·10^e (N de k + 1
///   chiffres, dernier 5) demande e ≥ 1. Jusqu'à q = 74, x tient en u128 : test exact (zéros finals ôtés, k + 1 chiffres,
///   dernier 5). Au-delà, x > 2^127 > 10^38 et N < 10^18 imposent e ≥ 20, donc 5^20 divise m (m impair) : sinon, jamais un
///   milieu ; si oui (rarissime), le calcul exact tranche.
fn milieu_possible(x: f64, k: usize) -> bool {
    let b = x.to_bits();
    let (e, f) = (i64::try_from((b >> 52) & 0x7ff).unwrap_or(0), b & ((1u64 << 52) - 1));
    let (mut m, mut q) = if e == 0 { (f, -1074) } else { (f | (1u64 << 52), e - 1075) };
    if m == 0 { return false; }
    let z = m.trailing_zeros();
    m >>= z;
    q += i64::from(z);
    if q >= 0 {
        if q > 74 { return m % 5u64.pow(20) == 0; }
        let mut v = u128::from(m) << q;
        while v % 10 == 0 { v /= 10; }
        return v % 10 == 5 && v.ilog10() as usize + 1 == k + 1;
    }
    if -q > 26 { return false; }
    let v = u128::from(m) * 5u128.pow(u32::try_from(-q).unwrap_or(0));
    v % 10 == 5 && v.ilog10() as usize + 1 == k + 1
}

/// Départage au pair : si le double est exactement au milieu de deux écritures les plus courtes qui le relisent toutes
/// deux, garder celle dont le dernier chiffre est pair.
fn departager_au_pair(x: f64, d: &mut Vec<u8>, e10: i64) {
    let k = d.len();
    let der = d[k - 1];
    if der.is_multiple_of(2) { return; } // déjà pair
    if !milieu_possible(x, k) { return; } // pas de milieu exact : les chiffres les plus courts sont ceux d'ECMA-262
    let relit = |v: &[u8]| -> bool {
        let s = texte(v);
        let t = if s.len() > 1 { format!("{}.{}e{}", &s[..1], &s[1..], e10) } else { format!("{s}e{e10}") };
        t.parse::<f64>().is_ok_and(|y| y.to_bits() == x.to_bits())
    };
    // développement décimal exact de x (au plus ~770 chiffres significatifs), au même exposant que les chiffres courts
    let exact = format!("{x:.1100e}");
    let Some((m, ex)) = exact.split_once('e') else { return };
    if ex.parse::<i64>().ok() != Some(e10) { return; }
    let mut xs: Vec<u8> = m.bytes().filter(u8::is_ascii_digit).map(|c| c - b'0').collect();
    while xs.len() > 1 && xs.last() == Some(&0) { xs.pop(); }
    for voisin in [der.checked_sub(1), (der < 9).then_some(der + 1)].into_iter().flatten() {
        let mut v = d.clone();
        v[k - 1] = voisin;
        if !relit(&v) { continue; }
        // milieu de d et v : le plus petit des deux suivi de 5
        let mut milieu = if voisin < der { v.clone() } else { d.clone() };
        milieu.push(5);
        if xs == milieu { *d = v; return; }
    }
}

/// `String(x)` pour un nombre.
#[must_use]
pub fn nombre_en_chaine(x: f64) -> String {
    if x.is_nan() { return "NaN".into(); }
    if x == 0.0 { return "0".into(); }
    if x.is_infinite() { return if x > 0.0 { "Infinity".into() } else { "-Infinity".into() }; }
    if x < 0.0 { return format!("-{}", nombre_en_chaine(-x)); }
    // entier exact < 2^53 : écriture entière (ECMA-262 l'écrit sans exposant jusqu'à 10^21)
    #[allow(clippy::float_cmp)] // test d'entier exact : la comparaison au bit près est le but
    let entier = x < 9_007_199_254_740_992.0 && x.trunc() == x;
    if entier {
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)] // 0 < x < 2^53, entier : exact en u64
        return (x as u64).to_string();
    }
    let (mut d, e10) = chiffres_courts(x);
    departager_au_pair(x, &mut d, e10);
    let chiffres = texte(&d);
    let k = i64::try_from(d.len()).unwrap_or(i64::MAX);
    let nexp = e10 + 1; // valeur = 0,chiffres × 10^nexp
    let u = |i: i64| usize::try_from(i).unwrap_or(0);
    if k <= nexp && nexp <= 21 {
        chiffres + &"0".repeat(u(nexp - k))
    } else if 0 < nexp && nexp <= 21 {
        format!("{}.{}", &chiffres[..u(nexp)], &chiffres[u(nexp)..])
    } else if -6 < nexp && nexp <= 0 {
        format!("0.{}{}", "0".repeat(u(-nexp)), chiffres)
    } else {
        let e1 = nexp - 1;
        let signe = if e1 < 0 { '-' } else { '+' };
        if k == 1 { format!("{chiffres}e{signe}{}", e1.abs()) } else { format!("{}.{}e{signe}{}", &chiffres[..1], &chiffres[1..], e1.abs()) }
    }
}

#[cfg(test)]
mod essais {
    use super::nombre_en_chaine as f;
    #[test]
    fn formes_d_ecma_262() {
        for (x, t) in [(0.0, "0"), (-0.0, "0"), (f64::NAN, "NaN"), (f64::INFINITY, "Infinity"), (f64::NEG_INFINITY, "-Infinity"),
            (1.0, "1"), (-1.5, "-1.5"), (0.1, "0.1"), (1e21, "1e+21"), (1e20, "100000000000000000000"), (1e-6, "0.000001"),
            (1e-7, "1e-7"), (123e-20, "1.23e-18"), (5e-324, "5e-324"), (f64::MAX, "1.7976931348623157e+308"), (9_007_199_254_740_992.0, "9007199254740992")] {
            assert_eq!(f(x), t, "{x:e}");
        }
    }
    #[test]
    #[allow(clippy::excessive_precision)] // valeur exacte d'un double réel (pas de 0,25 à cette grandeur)
    fn departage_au_pair() {
        // relecture réelle (CH-064-D) : V8 rend « …875.2 »
        assert_eq!(f(1_860_313_443_422_875.25), "1860313443422875.2");
        assert_eq!(f(1_125_899_906_842_624.0 + 0.25), "1125899906842624.2"); // 2^50 + 0,25 : égalité, chiffre pair
        assert_eq!(f(1_125_899_906_842_624.0 + 0.75), "1125899906842624.8");
    }
}
