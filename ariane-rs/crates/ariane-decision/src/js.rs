//! Sémantique des valeurs JavaScript sur `Valeur` (VBA) : ce que les modules de décision font de leurs objets.
//!
//! Les modules de décision manipulent des objets quelconques (réglages lus d'un fichier, décisions, captures) : lecture de
//! propriété, `?.`, `typeof`, étalement `{...a}`, ordre des clés, conversion en chaîne. Ce module reproduit ce que fait V8,
//! et rend `HorsDomaine` pour ce qu'il ne reproduit pas (la façade rappelle alors le JS d'origine).
//!
//! Ordre des clés (ECMA-262, `OrdinaryOwnPropertyKeys`) : d'abord les clés d'indice de tableau (« 0 » à « 4294967294 »,
//! écriture canonique) par ordre croissant, puis les autres dans l'ordre d'insertion. `definir` le respecte.
use ariane_js::Echec;
use ariane_vba::Valeur as V;

pub(crate) type R<T> = Result<T, Echec>;
pub(crate) static INDEF: V = V::Indefini;

pub(crate) fn hd<T>(m: &str) -> R<T> { Err(Echec::hors_domaine(m)) }
pub(crate) fn n(x: f64) -> V { V::Nombre(x) }
pub(crate) fn s(x: &str) -> V { V::Chaine(x.to_owned()) }
pub(crate) fn b(x: bool) -> V { V::Booleen(x) }
pub(crate) fn nul() -> V { V::Nul }
/// Nombre ou `null` (`Number.isFinite(v)?v:null` déjà décidé par l'appelant).
pub(crate) fn n_ou_nul(x: Option<f64>) -> V { x.map_or(V::Nul, V::Nombre) }
/// Tableau dense.
pub(crate) fn tab(v: Vec<V>) -> V { V::Tableau(v.into_iter().map(Some).collect()) }
/// Tableau de nombres, sous sa forme canonique VBA (`Nombres` ; vide : `Tableau`) : celle qu'attendent les crates de géométrie.
pub(crate) fn tab_n(v: &[f64]) -> V { if v.is_empty() { V::Tableau(vec![]) } else { V::Nombres(v.to_vec()) } }
/// Forme canonique VBA (`Valeur::canonique` d'ariane-vba) : à appliquer à toute valeur bâtie ici et passée à ariane-geometrie.
pub(crate) fn canon(v: &V) -> V { v.canonique() }
pub(crate) fn tab_s(v: &[&str]) -> V { V::Tableau(v.iter().map(|x| Some(s(x))).collect()) }

/// Objet littéral `{k1:v1, k2:v2…}` : clés posées dans l'ordre, avec la règle des indices.
pub(crate) fn o(t: Vec<(&str, V)>) -> V {
    let mut e = Vec::with_capacity(t.len());
    for (k, v) in t { definir(&mut e, k, v); }
    V::Objet(e)
}

/// Clé d'indice de tableau : écriture décimale canonique d'un entier de 0 à 2³² − 2.
pub(crate) fn est_indice(k: &str) -> bool {
    if k.is_empty() || k.len() > 10 || !k.bytes().all(|c| c.is_ascii_digit()) { return false; }
    if k.len() > 1 && k.starts_with('0') { return false; }
    k.parse::<u64>().is_ok_and(|x| x <= 4_294_967_294)
}

/// `o[k] = v` sur un objet simple (propriété de données, objet extensible).
pub(crate) fn definir(e: &mut Vec<(String, V)>, k: &str, v: V) {
    if let Some(x) = e.iter_mut().find(|(c, _)| c == k) { x.1 = v; return; }
    if est_indice(k) {
        let kn: u64 = k.parse().unwrap_or(u64::MAX);
        let pos = e.iter().position(|(c, _)| !est_indice(c) || c.parse::<u64>().unwrap_or(u64::MAX) > kn).unwrap_or(e.len());
        e.insert(pos, (k.to_owned(), v));
    } else {
        e.push((k.to_owned(), v));
    }
}
pub(crate) fn definir_v(o: &mut V, k: &str, v: V) {
    if let V::Objet(e) = o { definir(e, k, v) } else { unreachable!("definir_v sur un non-objet") }
}

/// `typeof v === 'object' && v !== null` (les tableaux compris).
pub(crate) fn est_objet(v: &V) -> bool { matches!(v, V::Objet(_) | V::Tableau(_) | V::Nombres(_) | V::Booleens(_) | V::Bloc { .. }) }
pub(crate) fn est_tableau(v: &V) -> bool { matches!(v, V::Tableau(_) | V::Nombres(_) | V::Booleens(_) | V::Bloc { .. }) }
/// `!!v && typeof v === 'object' && !Array.isArray(v)`.
pub(crate) fn est_simple(v: &V) -> bool { matches!(v, V::Objet(_)) }
pub(crate) fn nullish(v: &V) -> bool { matches!(v, V::Indefini | V::Nul) }
pub(crate) fn num(v: &V) -> Option<f64> { if let V::Nombre(x) = v { Some(*x) } else { None } }
/// `Number.isFinite(v)`.
pub(crate) fn fini(v: &V) -> bool { matches!(v, V::Nombre(x) if x.is_finite()) }
pub(crate) fn fini_de(v: &V) -> Option<f64> { match v { V::Nombre(x) if x.is_finite() => Some(*x), _ => None } }
/// `Number.isInteger(v)`.
pub(crate) fn entier(v: &V) -> bool { matches!(v, V::Nombre(x) if x.is_finite() && x.trunc() == *x) }
pub(crate) fn chaine_de(v: &V) -> Option<&str> { if let V::Chaine(x) = v { Some(x) } else { None } }
pub(crate) fn vrai(v: &V) -> bool { v.vrai() }

/// Lecture `v.k` (ou `v?.k`) pour une clé NOMMÉE (ni indice, ni `length`, ni nom de `Object.prototype`) : seul un objet simple
/// en porte une ; tableaux, nombres, chaînes, booléens rendent `undefined`. Sur `null`/`undefined`, `v.k` lève : l'appelant
/// qui ne passe pas par `?.` doit l'avoir écarté (sinon `p`).
pub(crate) fn g<'a>(v: &'a V, k: &str) -> &'a V {
    debug_assert!(k != "length" && !est_indice(k));
    match v { V::Objet(e) => e.iter().find(|(c, _)| c == k).map_or(&INDEF, |(_, x)| x), _ => &INDEF }
}
/// `v.k` strict : `null`/`undefined` lèvent un `TypeError` de V8 (message non reproduit : hors domaine).
pub(crate) fn p<'a>(v: &'a V, k: &str) -> R<&'a V> { if nullish(v) { hd("lecture d'une propriété de null/undefined") } else { Ok(g(v, k)) } }

/// Éléments d'un tableau, trous conservés (`None`).
pub(crate) fn elems(v: &V) -> Option<Vec<Option<V>>> {
    Some(match v {
        V::Tableau(t) => t.clone(),
        V::Nombres(t) => t.iter().map(|&x| Some(V::Nombre(x))).collect(),
        V::Booleens(t) => t.iter().map(|&x| Some(V::Booleen(x))).collect(),
        V::Bloc { k, donnees } => donnees.chunks_exact(*k as usize).map(|c| Some(V::Nombres(c.to_vec()))).collect(),
        _ => return None,
    })
}
/// `v.length` d'un tableau.
pub(crate) fn longueur(v: &V) -> Option<usize> {
    Some(match v { V::Tableau(t) => t.len(), V::Nombres(t) => t.len(), V::Booleens(t) => t.len(), V::Bloc { k, donnees } => donnees.len() / *k as usize, _ => return None })
}
/// `v[i]` d'un tableau (trou ou hors bornes : `undefined`).
pub(crate) fn elem(v: &V, i: usize) -> V {
    match v {
        V::Tableau(t) => t.get(i).cloned().flatten().unwrap_or(V::Indefini),
        V::Nombres(t) => t.get(i).map_or(V::Indefini, |&x| V::Nombre(x)),
        V::Booleens(t) => t.get(i).map_or(V::Indefini, |&x| V::Booleen(x)),
        V::Bloc { k, donnees } => { let k = *k as usize; if (i + 1) * k <= donnees.len() { V::Nombres(donnees[i * k..(i + 1) * k].to_vec()) } else { V::Indefini } }
        _ => V::Indefini,
    }
}
/// Éléments présents (trous sautés), comme `every`, `some`, `filter`, `map`, `forEach`.
pub(crate) fn presents(v: &V) -> Vec<V> { elems(v).unwrap_or_default().into_iter().flatten().collect() }

/// `===` (NaN ≠ NaN, +0 = −0 ; objets : identité, jamais vraie entre deux valeurs décodées distinctes : hors domaine).
pub(crate) fn strict_egal(a: &V, b: &V) -> R<bool> {
    Ok(match (a, b) {
        (V::Indefini, V::Indefini) | (V::Nul, V::Nul) => true,
        (V::Booleen(x), V::Booleen(y)) => x == y,
        (V::Nombre(x), V::Nombre(y)) => x == y,
        (V::Chaine(x), V::Chaine(y)) => x == y,
        (x, y) if est_objet(x) && est_objet(y) => return hd("=== entre deux objets"),
        _ => false,
    })
}
/// `Array.prototype.includes` (`SameValueZero` ; un trou vaut `undefined`).
pub(crate) fn inclut(liste: &V, x: &V) -> R<bool> {
    let Some(t) = elems(liste) else { return hd("includes sur un non-tableau") };
    for e in t {
        let e = e.unwrap_or(V::Indefini);
        let ok = match (&e, x) { (V::Nombre(a), V::Nombre(b)) => a == b || (a.is_nan() && b.is_nan()), _ => strict_egal(&e, x)? };
        if ok { return Ok(true); }
    }
    Ok(false)
}

/// Étalement `{...src}` dans `dest`.
pub(crate) fn etaler(dest: &mut Vec<(String, V)>, src: &V) -> R<()> {
    match src {
        V::Indefini | V::Nul | V::Booleen(_) | V::Nombre(_) => {}
        V::Chaine(c) if c.is_empty() => {}
        V::Chaine(_) => return hd("étalement d'une chaîne"),
        V::Objet(e) => { for (k, v) in e { definir(dest, k, v.clone()); } }
        V::Erreur { .. } => return hd("étalement d'une erreur"),
        t => { for (i, x) in elems(t).ou_hd()?.into_iter().enumerate() { if let Some(x) = x { definir(dest, &i.to_string(), x); } } }
    }
    Ok(())
}
/// `{...a, ...b}`.
pub(crate) fn fusion2(a: &V, b: &V) -> R<V> { let mut e = vec![]; etaler(&mut e, a)?; etaler(&mut e, b)?; Ok(V::Objet(e)) }
/// Entrées `Object.entries(v)` d'un objet simple ; tableaux et chaînes : hors domaine ; autres : aucune.
pub(crate) fn entrees(v: &V) -> R<Vec<(String, V)>> {
    match v {
        V::Objet(e) => Ok(e.clone()),
        V::Indefini | V::Nul => hd("Object.entries de null/undefined"),
        x if est_tableau(x) => hd("Object.entries d'un tableau"),
        V::Chaine(c) if !c.is_empty() => hd("Object.entries d'une chaîne"),
        _ => Ok(vec![]),
    }
}

// ---------------------------------------------------------------- conversion en chaîne

/// `Number.prototype.toString()` (base 10) : une seule implémentation, `ariane_js::nombre::nombre_en_chaine` (départage au pair compris).
pub(crate) use ariane_js::nombre::nombre_en_chaine as nombre_chaine;

/// `String(v)` / gabarit `${v}` pour les valeurs que porte VBA.
pub(crate) fn chaine(v: &V) -> R<String> {
    Ok(match v {
        V::Indefini => "undefined".into(),
        V::Nul => "null".into(),
        V::Booleen(x) => if *x { "true".into() } else { "false".into() },
        V::Nombre(x) => nombre_chaine(*x),
        V::Chaine(c) => c.clone(),
        V::Objet(_) => "[object Object]".into(),
        V::Erreur { .. } => return hd("String d'une erreur"),
        t => joindre(t, ",")?,
    })
}
/// `t.join(sep)` : `null`, `undefined` et trous donnent la chaîne vide.
pub(crate) fn joindre(t: &V, sep: &str) -> R<String> {
    let Some(e) = elems(t) else { return hd("join sur un non-tableau") };
    let mut out = String::new();
    for (i, x) in e.iter().enumerate() {
        if i > 0 { out.push_str(sep); }
        match x { None | Some(V::Indefini | V::Nul) => {}, Some(x) => out.push_str(&chaine(x)?) }
    }
    Ok(out)
}
/// `s.slice(0, n)` en unités UTF-16 ; une coupe au milieu d'une paire de substitution rendrait une chaîne que VBA refuse.
pub(crate) fn tranche_utf16(c: &str, nmax: usize) -> R<String> {
    let mut u = 0usize;
    let mut out = String::new();
    for ch in c.chars() {
        let l = ch.len_utf16();
        if u + l > nmax { if u < nmax { return hd("slice au milieu d'une paire de substitution"); } break; }
        out.push(ch); u += l;
    }
    Ok(out)
}
/// `Math.round(v*10)/10`.
pub(crate) fn arrondi1(x: f64) -> f64 { ariane_js::round(x * 10.0) / 10.0 }

/// Refuse toute clé `__proto__` dans une entrée : l'affectation JS la traiterait comme le prototype.
pub(crate) fn sans_proto(v: &V) -> R<()> {
    match v {
        V::Objet(e) => { for (k, x) in e { if k == "__proto__" { return hd("clé __proto__"); } sans_proto(x)?; } Ok(()) }
        V::Tableau(t) => { for x in t.iter().flatten() { sans_proto(x)?; } Ok(()) }
        _ => Ok(()),
    }
}

/// Arguments `{f, a}` d'un appel par nom : (nom, arguments ; un argument absent vaut `undefined`).
pub(crate) struct Appel { pub f: String, pub a: Vec<V> }
impl Appel {
    pub(crate) fn lire(e: &V) -> R<Appel> {
        let f = match g(e, "f") { V::Chaine(f) => f.clone(), _ => return hd("appel : f absent") };
        let a = match g(e, "a") { V::Indefini => vec![], x => match elems(x) { Some(t) => t.into_iter().map(|x| x.unwrap_or(V::Indefini)).collect(), None => return hd("appel : a non tableau") } };
        for x in &a { sans_proto(x)?; }
        Ok(Appel { f, a })
    }
    /// Argument i (absent : `undefined`).
    pub(crate) fn arg(&self, i: usize) -> &V { self.a.get(i).unwrap_or(&INDEF) }
    /// Nombre d'arguments passés (pour les valeurs par défaut : `undefined` passé explicitement vaut absent).
    pub(crate) fn nb(&self) -> usize { self.a.len() }
}

#[cfg(test)]
#[allow(clippy::disallowed_methods, clippy::excessive_precision)]
mod essais {
    use super::*;
    #[test]
    fn nombres_comme_v8() {
        for (x, t) in [(0.1, "0.1"), (1e21, "1e+21"), (1e20, "100000000000000000000"), (123.456, "123.456"), (1e-7, "1e-7"),
            (1.5e-7, "1.5e-7"), (0.000_001, "0.000001"), (-0.0, "0"), (-2.5, "-2.5"), (5e-324, "5e-324"), (f64::MAX, "1.7976931348623157e+308"),
            (0.300_000_000_000_000_04, "0.30000000000000004"), (7.95, "7.95"), (100.0, "100"), (2f64.powi(53), "9007199254740992"),
            (1_860_313_443_422_875.25, "1860313443422875.2"), (1_409_126_409_351_526.25, "1409126409351526.2")] {
            assert_eq!(nombre_chaine(x), t, "{x:e}");
        }
    }
    #[test]
    fn ordre_des_cles() {
        let v = o(vec![("b", n(1.0)), ("2", n(2.0)), ("a", n(3.0)), ("0", n(4.0)), ("01", n(5.0))]);
        let V::Objet(e) = v else { panic!() };
        let k: Vec<&str> = e.iter().map(|(k, _)| k.as_str()).collect();
        assert_eq!(k, ["0", "2", "b", "a", "01"]);
    }
    #[test]
    fn tranche() {
        assert_eq!(tranche_utf16("abc", 2).unwrap(), "ab");
        assert!(tranche_utf16("a💥", 2).is_err());
        assert_eq!(tranche_utf16("a💥", 3).unwrap(), "a💥");
    }
}

/// `v[i]` générique (objet simple aux clés d'indice, tableau) ; autre : `undefined` (une chaîne : hors domaine).
pub(crate) fn gi(v: &V, i: usize) -> R<V> {
    match v {
        V::Objet(_) => Ok(g_brut(v, &i.to_string()).clone()),
        V::Chaine(c) if !c.is_empty() => hd("indice d'une chaîne"),
        x if est_tableau(x) => Ok(elem(x, i)),
        _ => Ok(V::Indefini),
    }
}
/// Lecture d'une clé quelconque d'un objet simple (indices compris).
pub(crate) fn g_brut<'a>(v: &'a V, k: &str) -> &'a V { match v { V::Objet(e) => e.iter().find(|(c, _)| c == k).map_or(&INDEF, |(_, x)| x), _ => &INDEF } }

// ---------------------------------------------------------------- repères (vendor/capture-core.js)
pub(crate) use ariane_capture::M16;
/// Matrice lue par `C.point(m, p)` (`m[0]`…`m[15]` sans contrôle) : 16 nombres au moins, sinon hors domaine.
pub(crate) fn m16(v: &V) -> R<M16> {
    let mut a = [0.0; 16];
    match v {
        V::Nombres(t) if t.len() >= 16 => a.copy_from_slice(&t[..16]),
        V::Tableau(t) if t.len() >= 16 => { for i in 0..16 { a[i] = match &t[i] { Some(V::Nombre(x)) => *x, _ => return hd("matrice : élément non numérique") }; } }
        _ => return hd("matrice : 16 nombres attendus"),
    }
    Ok(a)
}
/// `C.point(m, p)` sur des valeurs.
pub(crate) fn point_v(m: &V, p: &V) -> R<[f64; 3]> { let m = m16(m)?; let [x, y, z] = ariane_capture::xyz(p)?; ariane_capture::point(&m, x, y, z) }
/// `C.distance(a,b)` : `Math.hypot(...a.map((x,i)=>x-b[i]))` pour deux points de 3 nombres.
pub(crate) fn distance3(a: &[f64; 3], b: &[f64; 3]) -> f64 { ariane_js::hypot(&[a[0] - b[0], a[1] - b[1], a[2] - b[2]]) }

/// Points d'un nuage (`pointsSceneRelative`), tels que les lit `const [x,y,z]=p` : bloc n×k (k ≥ 3 : trois premiers ; k < 3 :
/// NaN pour les absents), ou tableau de tableaux (trou ou `undefined` dans un point : NaN). Un élément qui n'est pas un tableau
/// (trou du tableau de points compris) : `None` si `sauter` (le JS le saute), sinon hors domaine (le JS lèverait).
pub(crate) fn points_xyz(v: &V, sauter: bool) -> R<Vec<Option<[f64; 3]>>> {
    Ok(match v {
        V::Bloc { k, donnees } => {
            let k = *k as usize;
            donnees.chunks_exact(k).map(|c| Some([c[0], if k > 1 { c[1] } else { f64::NAN }, if k > 2 { c[2] } else { f64::NAN }])).collect()
        }
        V::Tableau(t) => {
            let mut out = Vec::with_capacity(t.len());
            for e in t {
                match e {
                    Some(x) if est_tableau(x) => out.push(Some(ariane_capture::xyz(x)?)),
                    _ if sauter => out.push(None),
                    _ => return hd("point non tabulaire"),
                }
            }
            out
        }
        V::Nombres(t) => { if sauter { vec![None; t.len()] } else { return hd("point non tabulaire") } }
        V::Booleens(t) => { if sauter { vec![None; t.len()] } else { return hd("point non tabulaire") } }
        _ => return hd("nuage non tabulaire"),
    })
}

/// `Number.prototype.toFixed(f)` (0 ≤ f ≤ 20) : n entier le plus proche de x·10^f, à égalité exacte le PLUS GRAND (ECMA-262),
/// là où Rust arrondit au pair ; x < 0 : « - » puis toFixed(−x) ; |x| ≥ 10²¹ : String(x).
pub(crate) fn to_fixed(x: f64, f: usize) -> String {
    if x.is_nan() { return "NaN".into(); }
    if x.abs() >= 1e21 || x.is_infinite() { return nombre_chaine(x); }
    if x < 0.0 { return format!("-{}", to_fixed(-x, f)); }
    let x = x + 0.0;
    let r = format!("{x:.f$}");
    // égalité exacte : x vaut exactement r ± 0,5·10^−f ; développement exact de x
    let exact = format!("{x:.1100}");
    let Some((ent, frac)) = exact.split_once('.') else { return r };
    let frac = frac.trim_end_matches('0');
    if frac.len() == f + 1 && frac.ends_with('5') {
        // milieu exact : prendre le plus grand des deux voisins
        let bas = format!("{}{}", ent, &frac[..f]);
        let mut chiffres: Vec<u8> = bas.bytes().map(|c| c - b'0').collect();
        let mut i = chiffres.len();
        loop { if i == 0 { chiffres.insert(0, 1); break; } i -= 1; if chiffres[i] == 9 { chiffres[i] = 0; } else { chiffres[i] += 1; break; } }
        let s_: String = chiffres.iter().map(|c| (c + b'0') as char).collect();
        let k = s_.len() - f;
        return if f == 0 { s_ } else { format!("{}.{}", &s_[..k], &s_[k..]) };
    }
    r
}
#[cfg(test)]
mod essais_fixed {
    use super::to_fixed;
    #[test]
    fn comme_v8() {
        for (x, f, t) in [(0.25, 1, "0.3"), (1.45, 1, "1.4"), (1503.5, 0, "1504"), (2.5, 0, "3"), (-2.5, 0, "-3"), (-0.0, 1, "0.0"), (1564.04999, 1, "1564.0"),
            (9.95, 1, "9.9"), (99.75, 1, "99.8"), (0.0, 1, "0.0"), (-0.04, 1, "-0.0"), (1e21, 1, "1e+21")] {
            assert_eq!(to_fixed(x, f), t, "{x}");
        }
    }
}

/// `x ** y` / `Math.pow` du moteur JS qui exécute (import WASM, comme les transcendantes : les bits de V8 changent d'une version
/// à l'autre). En natif (essais `cargo test`, programme de l'option B) : `powf` de la bibliothèque, NON garanti identique à V8.
#[cfg(target_arch = "wasm32")]
pub(crate) fn pow(x: f64, y: f64) -> f64 {
    #[link(wasm_import_module = "env")]
    extern "C" { fn js_pow(x: f64, y: f64) -> f64; }
    // SÛRETÉ : `js_pow` est l'import `env.js_pow` fourni par la coquille (Math.pow) : fonction pure de deux f64 vers un f64,
    // sans pointeur ni état partagé ; l'appeler ne peut violer aucun invariant mémoire du module.
    unsafe { js_pow(x, y) }
}
#[cfg(not(target_arch = "wasm32"))]
#[allow(clippy::disallowed_methods)]
pub(crate) fn pow(x: f64, y: f64) -> f64 { x.powf(y) }

/// `t.slice(0, k)` (k : `ToIntegerOrInfinity` ; négatif : depuis la fin).
pub(crate) fn slice_debut(len: usize, k: f64) -> usize {
    let k = if k.is_nan() { 0.0 } else { k.trunc() };
    if k < 0.0 { rang(ariane_js::max((len as f64) + k, 0.0)) } else { rang(ariane_js::min(k, len as f64)) }
}
/// Rang (indice de tableau) d'un nombre fini positif ou nul que l'appelant a déjà borné par une longueur : troncature vers zéro,
/// comme un indice JS. Hors de ce domaine (jamais atteint) : 0.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)] // x ∈ [0, longueur] vérifié ci-dessous : conversion exacte
pub(crate) fn rang(x: f64) -> usize { if x.is_finite() && x >= 0.0 && x <= usize::MAX as f64 { x as usize } else { 0 } }
/// `C.distance(a,b)` générique : `Math.hypot(...a.map((x,i)=>x-b[i]))` (trou ou absent : NaN).
pub(crate) fn distance_v(a: &V, b_: &V) -> R<f64> {
    let (Some(ta), Some(tb)) = (elems(a), elems(b_)) else { return hd("distance : tableaux attendus") };
    let mut d = vec![];
    for (i, x) in ta.iter().enumerate() {
        let xa = match x { None | Some(V::Indefini) => f64::NAN, Some(V::Nombre(v)) => *v, _ => return hd("distance : non numérique") };
        let xb = match tb.get(i) { None | Some(None | Some(V::Indefini)) => f64::NAN, Some(Some(V::Nombre(v))) => *v, _ => return hd("distance : non numérique") };
        d.push(if x.is_none() { f64::NAN } else { xa - xb });
    }
    Ok(ariane_js::hypot(&d))
}
/// `r1` sans `+0` : `Number.isFinite(v)?Math.round(v*10)/10:null`.
pub(crate) fn r1v(x: f64) -> V { if x.is_finite() { n(ariane_js::round(x * 10.0) / 10.0) } else { nul() } }
pub(crate) fn um(x: f64) -> f64 { ariane_js::round(x * 1e6) / 1e6 }

/// Invariant du port (une valeur que le JS garantit à cet endroit) : son absence rend hors domaine — la façade rejoue le JS —
/// au lieu de paniquer. Remplace `unwrap`/`expect` hors des essais.
pub(crate) trait Ou<T> {
    /// La valeur, ou `HorsDomaine`.
    fn ou_hd(self) -> R<T>;
}
impl<T> Ou<T> for Option<T> {
    fn ou_hd(self) -> R<T> { self.ok_or_else(|| Echec::hors_domaine("invariant du port non tenu")) }
}
