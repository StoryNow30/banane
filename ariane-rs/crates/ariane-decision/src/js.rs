//! Sémantique des valeurs JavaScript sur `Valeur` (VBA) : ce que les modules de décision font de leurs objets.
//!
//! Les modules de décision manipulent des objets quelconques (réglages lus d'un fichier, décisions, captures) : lecture de
//! propriété, `?.`, `typeof`, étalement `{...a}`, ordre des clés, conversion en chaîne. Ce module reproduit ce que fait V8,
//! et rend `HorsDomaine` pour ce qu'il ne reproduit pas (la façade rappelle alors le JS d'origine).
//!
//! Ordre des clés (ECMA-262, OrdinaryOwnPropertyKeys) : d'abord les clés d'indice de tableau (« 0 » à « 4294967294 »,
//! écriture canonique) par ordre croissant, puis les autres dans l'ordre d'insertion. `definir` le respecte.
use ariane_js::Echec;
use ariane_vba::Valeur as V;

pub type R<T> = Result<T, Echec>;
pub static INDEF: V = V::Indefini;

pub fn hd<T>(m: &str) -> R<T> { Err(Echec::hors_domaine(m)) }
pub fn n(x: f64) -> V { V::Nombre(x) }
pub fn s(x: &str) -> V { V::Chaine(x.to_owned()) }
pub fn b(x: bool) -> V { V::Booleen(x) }
pub fn nul() -> V { V::Nul }
/// Nombre ou `null` (`Number.isFinite(v)?v:null` déjà décidé par l'appelant).
pub fn n_ou_nul(x: Option<f64>) -> V { x.map_or(V::Nul, V::Nombre) }
/// Tableau dense.
pub fn tab(v: Vec<V>) -> V { V::Tableau(v.into_iter().map(Some).collect()) }
/// Tableau de nombres, sous sa forme canonique VBA (`Nombres` ; vide : `Tableau`) : celle qu'attendent les crates de géométrie.
pub fn tab_n(v: &[f64]) -> V { if v.is_empty() { V::Tableau(vec![]) } else { V::Nombres(v.to_vec()) } }
/// Forme canonique VBA d'une valeur (comme l'encodeur de la coquille la produirait) : tableaux denses de nombres → `Nombres`,
/// de booléens → `Booleens`, de tableaux de k nombres → `Bloc`. À appliquer à toute valeur bâtie ici et passée à ariane-geometrie.
pub fn canon(v: &V) -> V {
    match v {
        V::Objet(e) => V::Objet(e.iter().map(|(k, x)| (k.clone(), canon(x))).collect()),
        V::Tableau(t) if !t.is_empty() && t.iter().all(|e| matches!(e, Some(V::Nombre(_)))) => V::Nombres(t.iter().map(|e| num(e.as_ref().unwrap()).unwrap()).collect()),
        V::Tableau(t) if !t.is_empty() && t.iter().all(|e| matches!(e, Some(V::Booleen(_)))) => V::Booleens(t.iter().map(|e| matches!(e, Some(V::Booleen(true)))).collect()),
        V::Tableau(t) => {
            let c: Vec<Option<V>> = t.iter().map(|e| e.as_ref().map(canon)).collect();
            let k = match c.first() { Some(Some(V::Nombres(x))) => x.len(), _ => 0 };
            if k >= 1 && k <= 255 && c.iter().all(|e| matches!(e, Some(V::Nombres(x)) if x.len() == k)) {
                V::Bloc { k: k as u8, donnees: c.into_iter().flat_map(|e| if let Some(V::Nombres(x)) = e { x } else { unreachable!() }).collect() }
            } else { V::Tableau(c) }
        }
        x => x.clone(),
    }
}
pub fn tab_s(v: &[&str]) -> V { V::Tableau(v.iter().map(|x| Some(s(x))).collect()) }

/// Objet littéral `{k1:v1, k2:v2…}` : clés posées dans l'ordre, avec la règle des indices.
pub fn o(t: Vec<(&str, V)>) -> V {
    let mut e = Vec::with_capacity(t.len());
    for (k, v) in t { definir(&mut e, k, v); }
    V::Objet(e)
}

/// Clé d'indice de tableau : écriture décimale canonique d'un entier de 0 à 2³² − 2.
pub fn est_indice(k: &str) -> bool {
    if k.is_empty() || k.len() > 10 || !k.bytes().all(|c| c.is_ascii_digit()) { return false; }
    if k.len() > 1 && k.starts_with('0') { return false; }
    k.parse::<u64>().map(|x| x <= 4_294_967_294).unwrap_or(false)
}

/// `o[k] = v` sur un objet simple (propriété de données, objet extensible).
pub fn definir(e: &mut Vec<(String, V)>, k: &str, v: V) {
    if let Some(x) = e.iter_mut().find(|(c, _)| c == k) { x.1 = v; return; }
    if est_indice(k) {
        let kn: u64 = k.parse().unwrap();
        let pos = e.iter().position(|(c, _)| !est_indice(c) || c.parse::<u64>().unwrap() > kn).unwrap_or(e.len());
        e.insert(pos, (k.to_owned(), v));
    } else {
        e.push((k.to_owned(), v));
    }
}
pub fn definir_v(o: &mut V, k: &str, v: V) {
    if let V::Objet(e) = o { definir(e, k, v) } else { unreachable!("definir_v sur un non-objet") }
}
/// `delete o[k]`.
pub fn supprimer(o: &mut V, k: &str) { if let V::Objet(e) = o { e.retain(|(c, _)| c != k) } }

/// `typeof v === 'object' && v !== null` (les tableaux compris).
pub fn est_objet(v: &V) -> bool { matches!(v, V::Objet(_) | V::Tableau(_) | V::Nombres(_) | V::Booleens(_) | V::Bloc { .. }) }
pub fn est_tableau(v: &V) -> bool { matches!(v, V::Tableau(_) | V::Nombres(_) | V::Booleens(_) | V::Bloc { .. }) }
/// `!!v && typeof v === 'object' && !Array.isArray(v)`.
pub fn est_simple(v: &V) -> bool { matches!(v, V::Objet(_)) }
pub fn nullish(v: &V) -> bool { matches!(v, V::Indefini | V::Nul) }
pub fn num(v: &V) -> Option<f64> { if let V::Nombre(x) = v { Some(*x) } else { None } }
/// `Number.isFinite(v)`.
pub fn fini(v: &V) -> bool { matches!(v, V::Nombre(x) if x.is_finite()) }
pub fn fini_de(v: &V) -> Option<f64> { match v { V::Nombre(x) if x.is_finite() => Some(*x), _ => None } }
/// `Number.isInteger(v)`.
pub fn entier(v: &V) -> bool { matches!(v, V::Nombre(x) if x.is_finite() && x.trunc() == *x) }
pub fn chaine_de(v: &V) -> Option<&str> { if let V::Chaine(x) = v { Some(x) } else { None } }
pub fn vrai(v: &V) -> bool { v.vrai() }

/// Lecture `v.k` (ou `v?.k`) pour une clé NOMMÉE (ni indice, ni `length`, ni nom de `Object.prototype`) : seul un objet simple
/// en porte une ; tableaux, nombres, chaînes, booléens rendent `undefined`. Sur `null`/`undefined`, `v.k` lève : l'appelant
/// qui ne passe pas par `?.` doit l'avoir écarté (sinon `p`).
pub fn g<'a>(v: &'a V, k: &str) -> &'a V {
    debug_assert!(k != "length" && !est_indice(k));
    match v { V::Objet(e) => e.iter().find(|(c, _)| c == k).map(|(_, x)| x).unwrap_or(&INDEF), _ => &INDEF }
}
/// `v.k` strict : `null`/`undefined` lèvent un TypeError de V8 (message non reproduit : hors domaine).
pub fn p<'a>(v: &'a V, k: &str) -> R<&'a V> { if nullish(v) { hd("lecture d'une propriété de null/undefined") } else { Ok(g(v, k)) } }
/// `k in v` (propriété propre d'un objet simple ; les clés nommées des modules n'existent pas sur le prototype).
pub fn a_cle(v: &V, k: &str) -> bool { matches!(v, V::Objet(e) if e.iter().any(|(c, _)| c == k)) }

/// Éléments d'un tableau, trous conservés (`None`).
pub fn elems(v: &V) -> Option<Vec<Option<V>>> {
    Some(match v {
        V::Tableau(t) => t.clone(),
        V::Nombres(t) => t.iter().map(|&x| Some(V::Nombre(x))).collect(),
        V::Booleens(t) => t.iter().map(|&x| Some(V::Booleen(x))).collect(),
        V::Bloc { k, donnees } => donnees.chunks_exact(*k as usize).map(|c| Some(V::Nombres(c.to_vec()))).collect(),
        _ => return None,
    })
}
/// `v.length` d'un tableau.
pub fn longueur(v: &V) -> Option<usize> {
    Some(match v { V::Tableau(t) => t.len(), V::Nombres(t) => t.len(), V::Booleens(t) => t.len(), V::Bloc { k, donnees } => donnees.len() / *k as usize, _ => return None })
}
/// `v[i]` d'un tableau (trou ou hors bornes : `undefined`).
pub fn elem(v: &V, i: usize) -> V {
    match v {
        V::Tableau(t) => t.get(i).cloned().flatten().unwrap_or(V::Indefini),
        V::Nombres(t) => t.get(i).map_or(V::Indefini, |&x| V::Nombre(x)),
        V::Booleens(t) => t.get(i).map_or(V::Indefini, |&x| V::Booleen(x)),
        V::Bloc { k, donnees } => { let k = *k as usize; if (i + 1) * k <= donnees.len() { V::Nombres(donnees[i * k..(i + 1) * k].to_vec()) } else { V::Indefini } }
        _ => V::Indefini,
    }
}
/// Éléments présents (trous sautés), comme `every`, `some`, `filter`, `map`, `forEach`.
pub fn presents(v: &V) -> Vec<V> { elems(v).unwrap_or_default().into_iter().flatten().collect() }

/// `===` (NaN ≠ NaN, +0 = −0 ; objets : identité, jamais vraie entre deux valeurs décodées distinctes : hors domaine).
pub fn strict_egal(a: &V, b: &V) -> R<bool> {
    Ok(match (a, b) {
        (V::Indefini, V::Indefini) | (V::Nul, V::Nul) => true,
        (V::Booleen(x), V::Booleen(y)) => x == y,
        (V::Nombre(x), V::Nombre(y)) => x == y,
        (V::Chaine(x), V::Chaine(y)) => x == y,
        (x, y) if est_objet(x) && est_objet(y) => return hd("=== entre deux objets"),
        _ => false,
    })
}
/// `Array.prototype.includes` (SameValueZero ; un trou vaut `undefined`).
pub fn inclut(liste: &V, x: &V) -> R<bool> {
    let Some(t) = elems(liste) else { return hd("includes sur un non-tableau") };
    for e in t {
        let e = e.unwrap_or(V::Indefini);
        let ok = match (&e, x) { (V::Nombre(a), V::Nombre(b)) => a == b || (a.is_nan() && b.is_nan()), _ => strict_egal(&e, x)? };
        if ok { return Ok(true); }
    }
    Ok(false)
}

/// Étalement `{...src}` dans `dest`.
pub fn etaler(dest: &mut Vec<(String, V)>, src: &V) -> R<()> {
    match src {
        V::Indefini | V::Nul | V::Booleen(_) | V::Nombre(_) => {}
        V::Chaine(c) if c.is_empty() => {}
        V::Chaine(_) => return hd("étalement d'une chaîne"),
        V::Objet(e) => { for (k, v) in e { definir(dest, k, v.clone()); } }
        V::Erreur { .. } => return hd("étalement d'une erreur"),
        t => { for (i, x) in elems(t).unwrap().into_iter().enumerate() { if let Some(x) = x { definir(dest, &i.to_string(), x); } } }
    }
    Ok(())
}
/// `{...a, ...b}`.
pub fn fusion2(a: &V, b: &V) -> R<V> { let mut e = vec![]; etaler(&mut e, a)?; etaler(&mut e, b)?; Ok(V::Objet(e)) }
/// Entrées `Object.entries(v)` d'un objet simple ; tableaux et chaînes : hors domaine ; autres : aucune.
pub fn entrees(v: &V) -> R<Vec<(String, V)>> {
    match v {
        V::Objet(e) => Ok(e.clone()),
        V::Indefini | V::Nul => hd("Object.entries de null/undefined"),
        x if est_tableau(x) => hd("Object.entries d'un tableau"),
        V::Chaine(c) if !c.is_empty() => hd("Object.entries d'une chaîne"),
        _ => Ok(vec![]),
    }
}

// ---------------------------------------------------------------- conversion en chaîne

/// `Number.prototype.toString()` (base 10) : chiffres les plus courts qui relisent le même double (ceux de V8 et de Rust
/// coïncident : mesuré par `tools/ch064-d-sonde-nombres.cjs`), mise en forme d'ECMA-262 Number::toString.
pub fn nombre_chaine(x: f64) -> String {
    if x.is_nan() { return "NaN".into(); }
    if x == 0.0 { return "0".into(); }
    if x.is_infinite() { return if x > 0.0 { "Infinity".into() } else { "-Infinity".into() }; }
    if x < 0.0 { return format!("-{}", nombre_chaine(-x)); }
    let e = format!("{x:e}"); // « d.ddde±x », chiffres les plus courts
    let (mant, exp) = e.split_once('e').unwrap();
    let mut chiffres: String = mant.chars().filter(|c| *c != '.').collect();
    let e10 = exp.parse::<i64>().unwrap();
    departager_au_pair(x, &mut chiffres, e10);
    let k = chiffres.len() as i64;
    let nexp = e10 + 1; // valeur = 0,chiffres × 10^nexp
    if k <= nexp && nexp <= 21 {
        let mut s = chiffres; for _ in 0..(nexp - k) { s.push('0'); } s
    } else if 0 < nexp && nexp <= 21 {
        format!("{}.{}", &chiffres[..nexp as usize], &chiffres[nexp as usize..])
    } else if -6 < nexp && nexp <= 0 {
        format!("0.{}{}", "0".repeat((-nexp) as usize), chiffres)
    } else {
        let e1 = nexp - 1;
        let signe = if e1 < 0 { '-' } else { '+' };
        if k == 1 { format!("{chiffres}e{signe}{}", e1.abs()) } else { format!("{}.{}e{signe}{}", &chiffres[..1], &chiffres[1..], e1.abs()) }
    }
}

/// Départage d'ECMA-262 (Number::toString, étape 5) : si deux écritures de k chiffres relisent x et sont à égale distance
/// de x, on prend celle dont le dernier chiffre est PAIR. Rust (flt2dec) arrondit alors vers le haut : mesuré, 1 860 313 443 422 875,25
/// s'écrit « …875.3 » en Rust et « …875.2 » en V8. On teste les deux voisines du dernier chiffre : voisine qui relit x ET x
/// exactement au milieu (développement décimal exact de x, fini pour un double) ⇒ la voisine paire l'emporte.
fn departager_au_pair(x: f64, chiffres: &mut String, e10: i64) {
    let d: Vec<u8> = chiffres.bytes().map(|c| c - b'0').collect();
    let k = d.len();
    let der = d[k - 1];
    if der % 2 == 0 { return; } // déjà pair : rien à départager en sa faveur
    let relit = |v: &[u8]| -> bool {
        let s: String = v.iter().map(|c| (c + b'0') as char).collect();
        let t = if s.len() > 1 { format!("{}.{}e{}", &s[..1], &s[1..], e10) } else { format!("{s}e{e10}") };
        t.parse::<f64>().map(|y| y == x).unwrap_or(false)
    };
    // développement décimal exact de x (au plus ~770 chiffres significatifs), même exposant que les chiffres courts
    let exact = format!("{x:.1100e}");
    let (m, ex) = exact.split_once('e').unwrap();
    if ex.parse::<i64>().unwrap() != e10 { return; }
    let mut xs: Vec<u8> = m.bytes().filter(|c| *c != b'.').map(|c| c - b'0').collect();
    while xs.len() > 1 && *xs.last().unwrap() == 0 { xs.pop(); }
    for delta in [-1i8, 1] {
        let nd = der as i8 + delta;
        if !(0..=9).contains(&nd) { continue; }
        let mut v = d.clone();
        v[k - 1] = nd as u8;
        if !relit(&v) { continue; }
        // milieu de d et v : le plus petit des deux suivi de 5
        let mut milieu = if delta < 0 { v.clone() } else { d.clone() };
        milieu.push(5);
        if xs == milieu { *chiffres = v.iter().map(|c| (c + b'0') as char).collect(); return; }
    }
}

/// `String(v)` / gabarit `${v}` pour les valeurs que porte VBA.
pub fn chaine(v: &V) -> R<String> {
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
pub fn joindre(t: &V, sep: &str) -> R<String> {
    let Some(e) = elems(t) else { return hd("join sur un non-tableau") };
    let mut out = String::new();
    for (i, x) in e.iter().enumerate() {
        if i > 0 { out.push_str(sep); }
        match x { None | Some(V::Indefini) | Some(V::Nul) => {}, Some(x) => out.push_str(&chaine(x)?) }
    }
    Ok(out)
}
/// `s.slice(0, n)` en unités UTF-16 ; une coupe au milieu d'une paire de substitution rendrait une chaîne que VBA refuse.
pub fn tranche_utf16(c: &str, nmax: usize) -> R<String> {
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
pub fn arrondi1(x: f64) -> f64 { ariane_js::round(x * 10.0) / 10.0 }

/// Refuse toute clé `__proto__` dans une entrée : l'affectation JS la traiterait comme le prototype.
pub fn sans_proto(v: &V) -> R<()> {
    match v {
        V::Objet(e) => { for (k, x) in e { if k == "__proto__" { return hd("clé __proto__"); } sans_proto(x)?; } Ok(()) }
        V::Tableau(t) => { for x in t.iter().flatten() { sans_proto(x)?; } Ok(()) }
        _ => Ok(()),
    }
}

/// Arguments `{f, a}` d'un appel par nom : (nom, arguments ; un argument absent vaut `undefined`).
pub struct Appel { pub f: String, pub a: Vec<V> }
impl Appel {
    pub fn lire(e: &V) -> R<Appel> {
        let f = match g(e, "f") { V::Chaine(f) => f.clone(), _ => return hd("appel : f absent") };
        let a = match g(e, "a") { V::Indefini => vec![], x => match elems(x) { Some(t) => t.into_iter().map(|x| x.unwrap_or(V::Indefini)).collect(), None => return hd("appel : a non tableau") } };
        for x in &a { sans_proto(x)?; }
        Ok(Appel { f, a })
    }
    /// Argument i (absent : `undefined`).
    pub fn arg(&self, i: usize) -> &V { self.a.get(i).unwrap_or(&INDEF) }
    /// Nombre d'arguments passés (pour les valeurs par défaut : `undefined` passé explicitement vaut absent).
    pub fn nb(&self) -> usize { self.a.len() }
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn nombres_comme_v8() {
        for (x, t) in [(0.1, "0.1"), (1e21, "1e+21"), (1e20, "100000000000000000000"), (123.456, "123.456"), (1e-7, "1e-7"),
            (1.5e-7, "1.5e-7"), (0.000001, "0.000001"), (-0.0, "0"), (-2.5, "-2.5"), (5e-324, "5e-324"), (1.7976931348623157e308, "1.7976931348623157e+308"),
            (0.30000000000000004, "0.30000000000000004"), (7.95, "7.95"), (100.0, "100"), (2f64.powi(53), "9007199254740992"),
            (1860313443422875.25, "1860313443422875.2"), (1409126409351526.25, "1409126409351526.2")] {
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
pub fn gi(v: &V, i: usize) -> R<V> {
    match v {
        V::Objet(_) => Ok(g_brut(v, &i.to_string()).clone()),
        V::Chaine(c) if !c.is_empty() => hd("indice d'une chaîne"),
        x if est_tableau(x) => Ok(elem(x, i)),
        _ => Ok(V::Indefini),
    }
}
/// Lecture d'une clé quelconque d'un objet simple (indices compris).
pub fn g_brut<'a>(v: &'a V, k: &str) -> &'a V { match v { V::Objet(e) => e.iter().find(|(c, _)| c == k).map(|(_, x)| x).unwrap_or(&INDEF), _ => &INDEF } }

// ---------------------------------------------------------------- repères (vendor/capture-core.js)
pub use ariane_capture::M16;
/// Matrice lue par `C.point(m, p)` (`m[0]`…`m[15]` sans contrôle) : 16 nombres au moins, sinon hors domaine.
pub fn m16(v: &V) -> R<M16> {
    let mut a = [0.0; 16];
    match v {
        V::Nombres(t) if t.len() >= 16 => a.copy_from_slice(&t[..16]),
        V::Tableau(t) if t.len() >= 16 => { for i in 0..16 { a[i] = match &t[i] { Some(V::Nombre(x)) => *x, _ => return hd("matrice : élément non numérique") }; } }
        _ => return hd("matrice : 16 nombres attendus"),
    }
    Ok(a)
}
/// `C.point(m, p)` sur des valeurs.
pub fn point_v(m: &V, p: &V) -> R<[f64; 3]> { let m = m16(m)?; let [x, y, z] = ariane_capture::xyz(p)?; ariane_capture::point(&m, x, y, z) }
/// `C.distance(a,b)` : `Math.hypot(...a.map((x,i)=>x-b[i]))` pour deux points de 3 nombres.
pub fn distance3(a: &[f64; 3], b: &[f64; 3]) -> f64 { ariane_js::hypot(&[a[0] - b[0], a[1] - b[1], a[2] - b[2]]) }

/// Points d'un nuage (`pointsSceneRelative`), tels que les lit `const [x,y,z]=p` : bloc n×k (k ≥ 3 : trois premiers ; k < 3 :
/// NaN pour les absents), ou tableau de tableaux (trou ou `undefined` dans un point : NaN). Un élément qui n'est pas un tableau
/// (trou du tableau de points compris) : `None` si `sauter` (le JS le saute), sinon hors domaine (le JS lèverait).
pub fn points_xyz(v: &V, sauter: bool) -> R<Vec<Option<[f64; 3]>>> {
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
pub fn to_fixed(x: f64, f: usize) -> String {
    if x.is_nan() { return "NaN".into(); }
    if x.abs() >= 1e21 || x.is_infinite() { return nombre_chaine(x); }
    if x < 0.0 { return format!("-{}", to_fixed(-x, f)); }
    let x = x + 0.0;
    let r = format!("{x:.f$}");
    // égalité exacte : x vaut exactement r ± 0,5·10^−f ; développement exact de x
    let exact = format!("{x:.1100}");
    let (ent, frac) = exact.split_once('.').unwrap();
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
