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
pub fn tab_n(v: &[f64]) -> V { V::Tableau(v.iter().map(|&x| Some(V::Nombre(x))).collect()) }
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
    let chiffres: String = mant.chars().filter(|c| *c != '.').collect();
    let k = chiffres.len() as i64;
    let nexp = exp.parse::<i64>().unwrap() + 1; // valeur = 0,chiffres × 10^nexp
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
            (0.30000000000000004, "0.30000000000000004"), (7.95, "7.95"), (100.0, "100"), (2f64.powi(53), "9007199254740992")] {
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
