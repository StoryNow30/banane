//! Sémantique JavaScript (V8) en Rust : tout calcul métier passe par ici pour donner les MÊMES bits que le JS.
//!
//! Mesuré (tools/ch064-sonde-math.cjs) : `f64::hypot` et `f64::round` de Rust divergent de `Math.hypot` et
//! `Math.round` de V8 sur 35 % et 51 % des tirages ; les portages ci-dessous, 0 sur 1 000 000.
//! `sqrt`, `ceil`, `floor`, `trunc`, `abs` de std sont exacts (opérations IEEE, instructions WASM natives) : permis.
//! `hypot`, `round`, `min`, `max`, `sin`, `cos`, `ln`, `log10`, `ln_1p`, `powf`, `exp` de std : INTERDITS dans les crates
//! métier (clippy.toml), remplacés par ce module.

/// `Math.hypot` de V8 (builtins math.tq) : ∞ l'emporte sur NaN, mise à l'échelle par le maximum, somme compensée.
#[must_use]
pub fn hypot(v: &[f64]) -> f64 {
    let mut max = 0.0f64;
    let mut nan = false;
    for &x in v {
        let a = x.abs();
        if a == f64::INFINITY {
            return f64::INFINITY;
        }
        if a.is_nan() {
            nan = true;
        } else if a > max {
            max = a;
        }
    }
    if nan {
        return f64::NAN;
    }
    if max == 0.0 {
        return 0.0;
    }
    let (mut somme, mut compensation) = (0.0f64, 0.0f64);
    for &x in v {
        let n = x.abs() / max;
        let terme = n * n - compensation;
        let provisoire = somme + terme;
        compensation = (provisoire - somme) - terme;
        somme = provisoire;
    }
    somme.sqrt() * max
}

/// `Math.round` de V8 : plafond, puis −1 si le plafond dépasse x de plus d'un demi ; −0 rendu sur [−0,5 ; −0].
#[must_use]
pub fn round(x: f64) -> f64 {
    if !x.is_finite() {
        return x;
    }
    let mut v = x.ceil();
    if v - 0.5 > x {
        v -= 1.0;
    }
    if v == 0.0 && x.is_sign_negative() {
        return -0.0;
    }
    v
}

/// `Math.max` à deux arguments : NaN contamine, +0 > −0.
#[must_use]
pub fn max(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        return f64::NAN;
    }
    if a == 0.0 && b == 0.0 {
        return if a.is_sign_negative() { b } else { a };
    }
    if a > b { a } else { b }
}

/// `Math.min` à deux arguments : NaN contamine, −0 < +0.
#[must_use]
pub fn min(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        return f64::NAN;
    }
    if a == 0.0 && b == 0.0 {
        return if a.is_sign_negative() { a } else { b };
    }
    if a < b { a } else { b }
}

/// `Math.sign` : NaN, ±0 conservés.
#[must_use]
pub fn sign(x: f64) -> f64 {
    if x.is_nan() || x == 0.0 { x } else if x > 0.0 { 1.0 } else { -1.0 }
}

#[cfg(test)]
#[allow(clippy::float_cmp)] // essais d'identité au bit près : la comparaison exacte est le but
mod essais {
    use super::*;
    #[test]
    fn round_cas_speciaux() {
        assert_eq!(round(2.5), 3.0);
        assert_eq!(round(-2.5), -2.0);
        assert_eq!(round(-1.5), -1.0);
        assert!(round(-0.5).is_sign_negative() && round(-0.5) == 0.0);
        assert!(round(-0.0).is_sign_negative());
        assert!(round(-0.2).is_sign_negative());
        assert!(!round(0.2).is_sign_negative());
        assert_eq!(round(0.499_999_999_999_999_94), 0.0);
        assert_eq!(round(4_503_599_627_370_495.5), 4_503_599_627_370_496.0);
    }
    #[test]
    fn max_min_zero_signe_et_nan() {
        assert!(!max(-0.0, 0.0).is_sign_negative());
        assert!(min(0.0, -0.0).is_sign_negative());
        assert!(max(1.0, f64::NAN).is_nan());
        assert!(min(f64::NAN, 1.0).is_nan());
    }
    #[test]
    fn hypot_speciaux() {
        assert_eq!(hypot(&[]), 0.0);
        assert_eq!(hypot(&[f64::NAN, f64::INFINITY]), f64::INFINITY);
        assert!(hypot(&[f64::NAN, 1.0]).is_nan());
        assert_eq!(hypot(&[3.0, 4.0]), 5.0);
    }
}

/// Échec d'un calcul porté : soit l'exception que le JS lèverait (même constructeur, même message), soit « hors domaine » :
/// l'entrée sort de ce que le port sait reproduire à l'identique (types inattendus…), et la façade rappelle le JS d'origine.
#[derive(Debug, Clone, PartialEq)]
pub enum Echec {
    /// L'exception du JS : constructeur (`Error`, `TypeError`, `RangeError`) et message à l'identique.
    Js {
        /// Constructeur de l'exception.
        nom: &'static str,
        /// Message de l'exception.
        message: String,
    },
    /// Entrée hors du domaine du port, avec la raison (diagnostic seulement).
    HorsDomaine(String),
}
impl Echec {
    /// Une `Error` du JS, avec ce message.
    pub fn erreur(message: impl Into<String>) -> Self { Echec::Js { nom: "Error", message: message.into() } }
    /// Une entrée que le port ne sait pas reproduire : la façade rejouera le JS.
    pub fn hors_domaine(raison: impl Into<String>) -> Self { Echec::HorsDomaine(raison.into()) }
}

/// Médiane de `src/geometry.js` (`median`) : copie triée par `(a,b)=>a-b`, NaN si vide, moyenne des deux milieux si pair.
/// Tri stable (comme `TimSort` de V8) ; avec des nombres sans NaN, le comparateur est un préordre total cohérent et le
/// résultat est unique. Les appelants garantissent l'absence de NaN (sinon : hors domaine).
#[must_use]
pub fn mediane(a: &[f64]) -> f64 {
    if a.is_empty() {
        return f64::NAN;
    }
    let mut b = a.to_vec();
    trier_nombres(&mut b);
    let i = b.len() >> 1;
    if b.len() % 2 == 1 { b[i] } else { f64::midpoint(b[i - 1], b[i]) }
}

/// `tableau.sort((a,b)=>a-b)` sur des nombres sans NaN : tri stable, −0 et +0 égaux (ordre d'origine conservé).
pub fn trier_nombres(b: &mut [f64]) {
    b.sort_by(|x, y| {
        let d = x - y;
        if d < 0.0 { core::cmp::Ordering::Less } else if d > 0.0 { core::cmp::Ordering::Greater } else { core::cmp::Ordering::Equal }
    });
}

/// `Math.max(...a)` : −∞ si vide.
pub fn max_de(a: impl IntoIterator<Item = f64>) -> f64 { a.into_iter().fold(f64::NEG_INFINITY, max) }
/// `Math.min(...a)` : +∞ si vide.
pub fn min_de(a: impl IntoIterator<Item = f64>) -> f64 { a.into_iter().fold(f64::INFINITY, min) }

/// Clé d'ensemble JS (`Set`, `SameValueZero`) pour un nombre : −0 et +0 confondus, tous les NaN confondus.
#[must_use]
pub fn cle_same_value_zero(x: f64) -> u64 {
    if x.is_nan() { 0x7ff8_0000_0000_0000 } else if x == 0.0 { 0 } else { x.to_bits() }
}

#[cfg(test)]
#[allow(clippy::float_cmp)] // essais d'identité au bit près : la comparaison exacte est le but
mod essais_mediane {
    use super::*;
    #[test]
    fn mediane_comme_js() {
        assert!(mediane(&[]).is_nan());
        assert_eq!(mediane(&[3.0, 1.0, 2.0]), 2.0);
        assert_eq!(mediane(&[4.0, 1.0, 3.0, 2.0]), 2.5);
        // stabilité : [-0, 0] reste dans l'ordre, la moyenne vaut (−0 + 0)/2 = +0
        assert!(!mediane(&[-0.0, 0.0]).is_sign_negative());
        assert!(mediane(&[-0.0]).is_sign_negative());
    }
}

// ---------------------------------------------------------------- exp correctement arrondi (cœur natif, option B)
// Mesuré (CH-064, étape 1 bis) : Math.exp de Chromium 153 est correctement arrondi sur tous les tirages vérifiés ; la
// bibliothèque du système (glibc) en diffère sur 151 tirages sur 200 000, ce port sur 0 sur 1 200 000. En WASM, l'import
// JS reste la règle (identique par construction à TOUT moteur) ; ce port ne sert qu'au programme natif.
#[inline]
fn two_sum(a: f64, b: f64) -> (f64, f64) { let s = a + b; let bb = s - a; (s, (a - (s - bb)) + (b - bb)) }
#[inline]
fn coupe(a: f64) -> (f64, f64) { let c = 134_217_729.0 * a; let h = c - (c - a); (h, a - h) }
#[inline]
fn two_prod(a: f64, b: f64) -> (f64, f64) {
    let p = a * b;
    let ((ah, al), (bh, bl)) = (coupe(a), coupe(b));
    (p, ((ah * bh - p) + ah * bl + al * bh) + al * bl)
}
#[derive(Clone, Copy)]
struct Dd(f64, f64);
impl Dd {
    fn plus(self, o: Dd) -> Dd { let (s, e) = two_sum(self.0, o.0); let (h, l) = two_sum(s, e + self.1 + o.1); Dd(h, l) }
    fn fois(self, o: Dd) -> Dd { let (p, e) = two_prod(self.0, o.0); let (h, l) = two_sum(p, e + (self.0 * o.1 + self.1 * o.0)); Dd(h, l) }
    fn fois_f(self, d: f64) -> Dd { let (p, e) = two_prod(self.0, d); let (h, l) = two_sum(p, e + self.1 * d); Dd(h, l) }
}
/// exp correctement arrondi sur [−708 ; 709] (double-double : réduction par ln 2 puis par 2¹⁰, Taylor à 14 termes,
/// dix carrés) ; au-delà, la bibliothèque du système.
#[allow(clippy::disallowed_methods)]
#[must_use]
pub fn exp_correctement_arrondi(x: f64) -> f64 {
    const LN2_HI: f64 = f64::from_bits(0x3FE6_2E42_FEFA_39EF);
    const LN2_LO: f64 = f64::from_bits(0x3C7A_BC9E_3B39_803F);
    if x.is_nan() { return x; }
    if !(-708.0..=709.0).contains(&x) { return x.exp(); }
    let k = (x / LN2_HI).round();
    let (p, pe) = two_prod(k, LN2_HI);
    let (q, qe) = two_prod(k, LN2_LO);
    let r = Dd(x, 0.0).plus(Dd(-p, -pe)).plus(Dd(-q, -qe));
    let t = Dd(r.0 / 1024.0, r.1 / 1024.0);
    let (mut s, mut terme) = (Dd(1.0, 0.0), Dd(1.0, 0.0));
    for i in 1..=14 { terme = terme.fois(t).fois_f(1.0 / f64::from(i)); s = s.plus(terme); }
    for _ in 0..10 { s = s.fois(s); }
    // k est un entier de [−1022 ; 1023] (|x| ≤ 709 ⇒ |k| ≤ 1023) : l'exposant biaisé k + 1023 tient sur 11 bits.
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let e = f64::from_bits(((k as i64 + 1023) as u64) << 52);
    two_sum(s.0 * e, s.1 * e).0
}

/// `if (d < best) best = d` sans branchement, pour les boucles chaudes : `f64::min` (minnum, `minsd` sur x86).
/// Identique au bit près SEULEMENT si ni `d` ni `best` n'est NaN et s'ils ne sont pas deux zéros de signes opposés :
/// l'appelant le garantit (sommes de carrés de nombres finis, toujours ≥ +0). Mesuré : en natif, la forme à
/// branchement de la perte de V4.6 coûtait 36 ms par nuage contre 23 ms en WASM (profil : 97 % dans cette boucle).
/// En WASM, la forme à comparaison reste la plus rapide (`f64.min` propage NaN : LLVM devrait émuler minnum).
#[inline]
#[allow(clippy::disallowed_methods)]
#[must_use]
pub fn min_positif_fini(best: f64, d: f64) -> f64 {
    #[cfg(target_arch = "wasm32")]
    { if d < best { d } else { best } }
    #[cfg(not(target_arch = "wasm32"))]
    { best.min(d) }
}
