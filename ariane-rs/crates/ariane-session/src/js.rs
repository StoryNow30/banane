//! Sémantique JS sur `Valeur`, au plus près de V8, pour les modules de session.
//!
//! Tout ce qui sort du domaine reproduit à l'identique rend `Echec::HorsDomaine` : la façade rejoue alors le JS.
//! - lecture de propriété (`a?.b`) : objets simples, `length` des tableaux et chaînes ; un nom de `Object.prototype`
//!   lu sur un objet qui ne le porte pas en propre est HORS DOMAINE (le JS rendrait la fonction héritée) ;
//! - `String(v)` : primitives seulement (un objet ou un tableau : hors domaine) ;
//! - `localeCompare` : chaînes d'ASCII imprimable (32 à 126) seulement, ordre racine d'ICU relevé dans Node et vérifié
//!   sur 800 000 paires tirées (0 écart) ; au-delà : hors domaine ;
//! - `JSON.stringify` : valeurs VBA (pas de fonction, pas de `toJSON` appelable, chaînes bien formées), clés d'indice
//!   d'abord (ordre de `OrdinaryOwnPropertyKeys`) ;
//! - comparaison `<` de deux chaînes : unités UTF-16.
use ariane_js::Echec;
use ariane_vba::Valeur;
use core::cmp::Ordering;
use std::borrow::Cow;
use std::fmt::Write as _;

/// `undefined` partagé, rendu par les lectures absentes.
pub static INDEFINI: Valeur = Valeur::Indefini;

/// Noms portés par `Object.prototype` : lus sur un objet simple qui ne les a pas en propre, le JS rend l'héritage.
const HERITES: [&str; 12] = ["constructor", "__proto__", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable",
    "toString", "valueOf", "toLocaleString", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"];

/// Raccourci : un refus « hors domaine ».
///
/// # Errors
/// Toujours : `Echec::HorsDomaine(raison)`.
pub fn hd<T>(raison: &str) -> Result<T, Echec> { Err(Echec::hors_domaine(raison)) }

/// `v?.[k]` pour un nom FIXE choisi par le code (jamais un nom de `Object.prototype`, jamais `length`) : `undefined`
/// si `v` n'est pas un objet simple ou n'a pas la clé.
#[must_use]
pub fn ch<'a>(v: &'a Valeur, k: &str) -> &'a Valeur {
    match v { Valeur::Objet(t) => t.iter().rev().find(|(c, _)| c == k).map_or(&INDEFINI, |(_, x)| x), _ => &INDEFINI }
}

/// Chemin de noms fixes : `v?.a?.b?.c`.
#[must_use]
pub fn chemin<'a>(v: &'a Valeur, ks: &[&str]) -> &'a Valeur {
    let mut x = v;
    for k in ks { x = ch(x, k); }
    x
}

/// `v?.[k]` pour une clé venue des données : hors domaine si le JS lirait une propriété héritée ou un indice.
///
/// # Errors
/// Hors domaine : nom hérité absent en propre, ou lecture sur un tableau ou une chaîne.
pub fn ch_dyn<'a>(v: &'a Valeur, k: &str) -> Result<&'a Valeur, Echec> {
    match v {
        Valeur::Objet(t) => match t.iter().rev().find(|(c, _)| c == k) {
            Some((_, x)) => Ok(x),
            None if HERITES.contains(&k) => hd("clé héritée de Object.prototype"),
            None => Ok(&INDEFINI),
        },
        Valeur::Indefini | Valeur::Nul | Valeur::Booleen(_) | Valeur::Nombre(_) => Ok(&INDEFINI),
        _ => hd("clé dynamique sur un tableau ou une chaîne"),
    }
}

/// Le JS accepte-t-il cette clé comme clé dynamique d'objet sans surprise (pas d'héritage, pas `__proto__`) ?
#[must_use]
pub fn cle_sure(k: &str) -> bool { !HERITES.contains(&k) }

/// `v?.length` : tableaux (toutes formes) et chaînes (unités UTF-16).
#[must_use]
pub fn longueur(v: &Valeur) -> Option<f64> {
    Some(match v {
        Valeur::Tableau(t) => t.len() as f64,
        Valeur::Nombres(t) => t.len() as f64,
        Valeur::Booleens(t) => t.len() as f64,
        Valeur::Bloc { k, donnees } => (donnees.len() / usize::from((*k).max(1))) as f64,
        Valeur::Chaine(s) => s.encode_utf16().count() as f64,
        _ => return None,
    })
}

/// `Array.isArray(v)`.
#[must_use]
pub fn est_tableau(v: &Valeur) -> bool {
    matches!(v, Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Bloc { .. })
}

/// Éléments d'un tableau (trou → `undefined`), sans copie pour la forme générale.
#[must_use]
pub fn elements(v: &Valeur) -> Option<Cow<'_, [Valeur]>> {
    match v {
        Valeur::Tableau(t) => Some(Cow::Owned(t.iter().map(|e| e.clone().unwrap_or(Valeur::Indefini)).collect())),
        _ => v.elements().map(Cow::Owned),
    }
}

/// Éléments d'un tableau ; `[]` si `v` est faux (`v||[]`) ; hors domaine si `v` est vrai sans être un tableau
/// (le JS itérerait une chaîne ou lèverait).
///
/// # Errors
/// Hors domaine : valeur vraie non tableau.
pub fn liste_ou_vide(v: &Valeur) -> Result<Vec<Valeur>, Echec> {
    if !v.vrai() { return Ok(vec![]); }
    match elements(v) { Some(e) => Ok(e.into_owned()), None => hd("itération d'une valeur non tableau") }
}

/// Nombre si `v` est un nombre.
#[must_use]
pub fn nombre(v: &Valeur) -> Option<f64> { if let Valeur::Nombre(x) = v { Some(*x) } else { None } }

/// `Number.isInteger(v)` : le nombre, s'il est entier.
#[must_use]
#[allow(clippy::float_cmp)] // Number.isInteger : égalité exacte avec la troncature
pub fn entier(v: &Valeur) -> Option<f64> { nombre(v).filter(|x| x.is_finite() && x.trunc() == *x) }

/// `Number.isFinite(v)`.
#[must_use]
pub fn fini(v: &Valeur) -> Option<f64> { nombre(v).filter(|x| x.is_finite()) }

/// Chaîne si `v` est une chaîne.
#[must_use]
pub fn chaine(v: &Valeur) -> Option<&str> { if let Valeur::Chaine(s) = v { Some(s) } else { None } }

/// `v === s` pour une chaîne `s`.
#[must_use]
pub fn est(v: &Valeur, s: &str) -> bool { chaine(v) == Some(s) }

/// `v === undefined || v === null`.
#[must_use]
pub fn nul(v: &Valeur) -> bool { matches!(v, Valeur::Indefini | Valeur::Nul) }

/// `String(v)` pour une primitive.
///
/// # Errors
/// Hors domaine : objet ou tableau (`toString` et `join` ne sont pas reproduits).
pub fn en_chaine(v: &Valeur) -> Result<String, Echec> {
    Ok(match v {
        Valeur::Indefini => "undefined".into(),
        Valeur::Nul => "null".into(),
        Valeur::Booleen(b) => if *b { "true".into() } else { "false".into() },
        Valeur::Nombre(x) => ariane_js::nombre::nombre_en_chaine(*x),
        Valeur::Chaine(s) => s.clone(),
        _ => return hd("String() d'un objet"),
    })
}

/// `a === b` pour des primitives ; hors domaine si l'une est un objet ou un tableau (identité non transportée).
///
/// # Errors
/// Hors domaine : comparaison d'identité d'objets.
pub fn strict(a: &Valeur, b: &Valeur) -> Result<bool, Echec> {
    Ok(match (a, b) {
        (Valeur::Indefini, Valeur::Indefini) | (Valeur::Nul, Valeur::Nul) => true,
        (Valeur::Booleen(x), Valeur::Booleen(y)) => x == y,
        #[allow(clippy::float_cmp)] // === de JS : comparaison IEEE exacte (NaN ≠ NaN, −0 = +0)
        (Valeur::Nombre(x), Valeur::Nombre(y)) => x == y,
        (Valeur::Chaine(x), Valeur::Chaine(y)) => x == y,
        (Valeur::Objet(_) | Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Bloc { .. }, _)
        | (_, Valeur::Objet(_) | Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Bloc { .. }) => {
            return hd("=== entre objets");
        }
        _ => false,
    })
}

/// `a < b` (et l'ordre) de deux chaînes JS : unités UTF-16.
#[must_use]
pub fn cmp_utf16(a: &str, b: &str) -> Ordering { a.encode_utf16().cmp(b.encode_utf16()) }

/// Poids primaire racine d'ICU d'un caractère ASCII imprimable (relevé dans Node : voir l'en-tête).
fn primaire(c: u8) -> Option<u8> {
    const ORDRE: &[u8] = b" _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$0123456789";
    if let Some(i) = ORDRE.iter().position(|&x| x == c) { return u8::try_from(i).ok(); }
    let n = u8::try_from(ORDRE.len()).ok()?;
    match c {
        b'a'..=b'z' => Some(n + (c - b'a')),
        b'A'..=b'Z' => Some(n + (c - b'A')),
        _ => None,
    }
}

/// `a.localeCompare(b)` (signe) sur l'ASCII imprimable : poids primaires, puis la casse (minuscule avant majuscule).
///
/// # Errors
/// Hors domaine : un caractère hors de 32 à 126.
pub fn locale_compare(a: &str, b: &str) -> Result<Ordering, Echec> {
    if a == b { return Ok(Ordering::Equal); }
    let pa: Option<Vec<u8>> = a.bytes().map(primaire).collect();
    let pb: Option<Vec<u8>> = b.bytes().map(primaire).collect();
    let (Some(pa), Some(pb)) = (pa, pb) else { return hd("localeCompare hors de l'ASCII imprimable") };
    let o = pa.cmp(&pb);
    if o != Ordering::Equal { return Ok(o); }
    Ok(a.bytes().map(|c| c.is_ascii_uppercase()).cmp(b.bytes().map(|c| c.is_ascii_uppercase())))
}

/// Une clé est-elle un indice de tableau (chaîne canonique d'un entier de 0 à 2³² − 2) ?
#[must_use]
pub fn est_indice(k: &str) -> bool {
    if k.is_empty() || k.len() > 10 || !k.bytes().all(|c| c.is_ascii_digit()) || (k.len() > 1 && k.starts_with('0')) { return false; }
    k.parse::<u64>().is_ok_and(|n| n < 4_294_967_295)
}

/// Clés d'un objet dans l'ordre de `Object.keys` : indices croissants, puis les autres dans l'ordre d'insertion.
#[must_use]
pub fn cles_ordonnees(t: &[(String, Valeur)]) -> Vec<usize> {
    let mut ind: Vec<(u64, usize)> = t.iter().enumerate().filter(|(_, (k, _))| est_indice(k)).filter_map(|(i, (k, _))| k.parse::<u64>().ok().map(|n| (n, i))).collect();
    ind.sort_unstable();
    let mut r: Vec<usize> = ind.into_iter().map(|(_, i)| i).collect();
    r.extend(t.iter().enumerate().filter(|(_, (k, _))| !est_indice(k)).map(|(i, _)| i));
    r
}

fn json_chaine(s: &str, o: &mut String) {
    o.push('"');
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\u{8}' => o.push_str("\\b"),
            '\u{c}' => o.push_str("\\f"),
            '\n' => o.push_str("\\n"),
            '\r' => o.push_str("\\r"),
            '\t' => o.push_str("\\t"),
            c if (c as u32) < 0x20 => { let _ = write!(o, "\\u{:04x}", c as u32); }
            c => o.push(c),
        }
    }
    o.push('"');
}

fn json_nombre(x: f64, o: &mut String) {
    if x.is_finite() { o.push_str(&ariane_js::nombre::nombre_en_chaine(x)); } else { o.push_str("null"); }
}

/// Écrit `v` en JSON ; rend false si `v` est `undefined` (absent du JSON).
fn json_valeur(v: &Valeur, o: &mut String) -> bool {
    match v {
        Valeur::Indefini | Valeur::Erreur { .. } => return false,
        Valeur::Nul => o.push_str("null"),
        Valeur::Booleen(b) => o.push_str(if *b { "true" } else { "false" }),
        Valeur::Nombre(x) => json_nombre(*x, o),
        Valeur::Chaine(s) => json_chaine(s, o),
        Valeur::Nombres(t) => { o.push('['); for (i, x) in t.iter().enumerate() { if i > 0 { o.push(','); } json_nombre(*x, o); } o.push(']'); }
        Valeur::Booleens(t) => { o.push('['); for (i, b) in t.iter().enumerate() { if i > 0 { o.push(','); } o.push_str(if *b { "true" } else { "false" }); } o.push(']'); }
        Valeur::Bloc { k, donnees } => {
            o.push('[');
            for (i, l) in donnees.chunks_exact(usize::from((*k).max(1))).enumerate() {
                if i > 0 { o.push(','); }
                o.push('[');
                for (j, x) in l.iter().enumerate() { if j > 0 { o.push(','); } json_nombre(*x, o); }
                o.push(']');
            }
            o.push(']');
        }
        Valeur::Tableau(t) => {
            o.push('[');
            for (i, e) in t.iter().enumerate() {
                if i > 0 { o.push(','); }
                match e { Some(x) => { if !json_valeur(x, o) { o.push_str("null"); } } None => o.push_str("null") }
            }
            o.push(']');
        }
        Valeur::Objet(t) => {
            o.push('{');
            let mut premier = true;
            for i in cles_ordonnees(t) {
                let Some((k, x)) = t.get(i) else { continue };
                if matches!(x, Valeur::Indefini) { continue; }
                if !premier { o.push(','); }
                premier = false;
                json_chaine(k, o);
                o.push(':');
                json_valeur(x, o);
            }
            o.push('}');
        }
    }
    true
}

/// `JSON.stringify(v)` ; `None` pour `undefined`.
#[must_use]
pub fn json(v: &Valeur) -> Option<String> {
    let mut o = String::new();
    json_valeur(v, &mut o).then_some(o)
}

/// `JSON.parse(JSON.stringify(v))` (`K.clone`) : `undefined` retiré des objets, `null` dans les tableaux, nombres non
/// finis → `null`, −0 → 0, ordre des clés de `Object.keys` (indices d'abord) ; `None` pour `undefined`.
#[must_use]
pub fn clone_json(v: &Valeur) -> Option<Valeur> {
    let n = |x: f64| if x.is_finite() { Valeur::Nombre(if x == 0.0 { 0.0 } else { x }) } else { Valeur::Nul };
    Some(match v {
        Valeur::Indefini | Valeur::Erreur { .. } => return None,
        Valeur::Nombre(x) => n(*x),
        Valeur::Nombres(t) => Valeur::Tableau(t.iter().map(|&x| Some(n(x))).collect()),
        Valeur::Bloc { k, donnees } => Valeur::Tableau(donnees.chunks_exact(usize::from((*k).max(1))).map(|l| Some(Valeur::Tableau(l.iter().map(|&x| Some(n(x))).collect()))).collect()),
        Valeur::Tableau(t) => Valeur::Tableau(t.iter().map(|e| Some(e.as_ref().and_then(clone_json).unwrap_or(Valeur::Nul))).collect()),
        Valeur::Objet(t) => Valeur::Objet(cles_ordonnees(t).into_iter().filter_map(|i| t.get(i)).filter_map(|(k, x)| clone_json(x).map(|c| (k.clone(), c))).collect()),
        x => x.clone(),
    })
}

/// Objet en construction, avec la sémantique d'affectation de JS : une clé déjà présente garde sa place.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Obj(pub Vec<(String, Valeur)>);
impl Obj {
    /// Objet vide.
    #[must_use]
    pub fn new() -> Self { Obj(vec![]) }
    /// `o[k] = v`.
    pub fn poser(&mut self, k: &str, v: Valeur) {
        if let Some(e) = self.0.iter_mut().find(|(c, _)| c == k) { e.1 = v; } else { self.0.push((k.to_owned(), v)); }
    }
    /// `o[k] = v`, en chaîne.
    #[must_use]
    pub fn et(mut self, k: &str, v: Valeur) -> Self { self.poser(k, v); self }
    /// `o.k` (propre).
    #[must_use]
    pub fn lire(&self, k: &str) -> &Valeur { self.0.iter().find(|(c, _)| c == k).map_or(&INDEFINI, |(_, x)| x) }
    /// `{...v}` pour un objet simple (`undefined`, `null` et les primitives non chaînes ne copient rien).
    ///
    /// # Errors
    /// Hors domaine : étalement d'une chaîne ou d'un tableau (indices copiés).
    pub fn etaler(&mut self, v: &Valeur) -> Result<(), Echec> {
        match v {
            Valeur::Objet(t) => { for (k, x) in t { self.poser(k, x.clone()); } Ok(()) }
            Valeur::Indefini | Valeur::Nul | Valeur::Booleen(_) | Valeur::Nombre(_) => Ok(()),
            Valeur::Chaine(s) if s.is_empty() => Ok(()),
            _ => hd("étalement d'un tableau ou d'une chaîne"),
        }
    }
    /// La valeur.
    #[must_use]
    pub fn v(self) -> Valeur { Valeur::Objet(self.0) }
}

/// Une chaîne JS.
#[must_use]
pub fn s(x: &str) -> Valeur { Valeur::Chaine(x.to_owned()) }
/// Chaîne ou `null`.
#[must_use]
pub fn s_ou_nul(x: Option<&str>) -> Valeur { x.map_or(Valeur::Nul, s) }
/// Nombre ou `null`.
#[must_use]
pub fn n_ou_nul(x: Option<f64>) -> Valeur { x.map_or(Valeur::Nul, Valeur::Nombre) }
/// Tableau de valeurs.
#[must_use]
pub fn tab(v: Vec<Valeur>) -> Valeur { Valeur::Tableau(v.into_iter().map(Some).collect()) }
/// Tableau de chaînes.
#[must_use]
pub fn tab_s(v: &[String]) -> Valeur { tab(v.iter().map(|x| s(x)).collect()) }

/// Carte JS (`Map`) à clés quelconques, ordre d'insertion ; une clé supprimée puis reposée passe à la fin.
#[derive(Debug, Clone)]
pub struct Carte<K: Eq + std::hash::Hash + Clone, V> {
    ordre: Vec<Option<(K, V)>>,
    index: std::collections::HashMap<K, usize>,
}
impl<K: Eq + std::hash::Hash + Clone, V> Default for Carte<K, V> {
    fn default() -> Self { Carte { ordre: vec![], index: std::collections::HashMap::new() } }
}
impl<K: Eq + std::hash::Hash + Clone, V> Carte<K, V> {
    /// `m.get(k)`.
    pub fn get(&self, k: &K) -> Option<&V> { self.index.get(k).and_then(|&i| self.ordre.get(i)).and_then(|e| e.as_ref().map(|(_, v)| v)) }
    /// `m.get(k)`, modifiable.
    pub fn get_mut(&mut self, k: &K) -> Option<&mut V> {
        let i = *self.index.get(k)?;
        self.ordre.get_mut(i).and_then(|e| e.as_mut().map(|(_, v)| v))
    }
    /// `m.has(k)`.
    pub fn has(&self, k: &K) -> bool { self.index.contains_key(k) }
    /// `m.set(k, v)` : une clé présente garde sa place.
    pub fn set(&mut self, k: K, v: V) {
        if let Some(&i) = self.index.get(&k) {
            if let Some(e) = self.ordre.get_mut(i) { *e = Some((k, v)); }
        } else {
            self.index.insert(k.clone(), self.ordre.len());
            self.ordre.push(Some((k, v)));
        }
    }
    /// `m.delete(k)`.
    pub fn delete(&mut self, k: &K) {
        if let Some(i) = self.index.remove(k) { if let Some(e) = self.ordre.get_mut(i) { *e = None; } }
    }
    /// `m.size`.
    #[must_use]
    pub fn len(&self) -> usize { self.index.len() }
    /// `m.size === 0`.
    #[must_use]
    pub fn is_empty(&self) -> bool { self.index.is_empty() }
    /// Entrées dans l'ordre.
    pub fn iter(&self) -> impl Iterator<Item = (&K, &V)> { self.ordre.iter().filter_map(|e| e.as_ref().map(|(k, v)| (k, v))) }
    /// Valeurs dans l'ordre, modifiables.
    pub fn valeurs_mut(&mut self) -> impl Iterator<Item = &mut V> { self.ordre.iter_mut().filter_map(|e| e.as_mut().map(|(_, v)| v)) }
    /// Valeurs dans l'ordre.
    pub fn valeurs(&self) -> impl Iterator<Item = &V> { self.iter().map(|(_, v)| v) }
}

/// Arguments d'un appel : `{a:[…]}` → l'argument `i` (`undefined` au-delà).
#[must_use]
pub fn arg(e: &Valeur, i: usize) -> Valeur {
    match ch(e, "a") {
        Valeur::Tableau(t) => t.get(i).cloned().flatten().unwrap_or(Valeur::Indefini),
        v => v.elements().and_then(|l| l.get(i).cloned()).unwrap_or(Valeur::Indefini),
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn locale_compare_ascii() {
        assert_eq!(locale_compare("a", "B"), Ok(Ordering::Less));
        assert_eq!(locale_compare("b", "B"), Ok(Ordering::Less));
        assert_eq!(locale_compare("a-b", "ab"), Ok(Ordering::Less));
        assert_eq!(locale_compare("_", "-"), Ok(Ordering::Less));
        assert_eq!(locale_compare("9", "a"), Ok(Ordering::Less));
        assert_eq!(locale_compare("", "a"), Ok(Ordering::Less));
        assert_eq!(locale_compare("aB", "Ab"), Ok(Ordering::Less));
        assert!(locale_compare("é", "e").is_err());
    }
    #[test]
    fn json_comme_v8() {
        let o = Obj::new().et("b", Valeur::Nombre(-0.0)).et("2", Valeur::Indefini).et("1", s("\u{1}\"")).et("a", tab(vec![Valeur::Indefini, Valeur::Nombre(f64::NAN)])).v();
        assert_eq!(json(&o).as_deref(), Some("{\"1\":\"\\u0001\\\"\",\"b\":0,\"a\":[null,null]}"));
        assert_eq!(json(&Valeur::Indefini), None);
        assert_eq!(clone_json(&Valeur::Nombres(vec![-0.0, f64::INFINITY])), Some(tab(vec![Valeur::Nombre(0.0), Valeur::Nul])));
    }
    #[test]
    fn lectures() {
        let o = Obj::new().et("x", s("abc")).v();
        assert_eq!(longueur(ch(&o, "x")), Some(3.0));
        assert!(ch_dyn(&o, "constructor").is_err());
        assert_eq!(ch_dyn(&o, "y"), Ok(&INDEFINI));
        assert!(est_indice("0") && est_indice("4294967294") && !est_indice("4294967295") && !est_indice("01"));
        assert_eq!(cmp_utf16("\u{ffff}", "\u{10000}"), Ordering::Greater);
        assert_eq!(en_chaine(&Valeur::Nombre(1e21)).as_deref(), Ok("1e+21"));
        assert!(strict(&Valeur::Nombre(0.0), &Valeur::Nombre(-0.0)).unwrap_or(false));
    }
    #[test]
    fn carte_ordre() {
        let mut m: Carte<u64, i32> = Carte::default();
        m.set(1, 1); m.set(2, 2); m.set(1, 3); m.delete(&2); m.set(2, 4);
        assert_eq!(m.iter().map(|(k, v)| (*k, *v)).collect::<Vec<_>>(), vec![(1, 3), (2, 4)]);
        assert_eq!(m.len(), 2);
    }
}
