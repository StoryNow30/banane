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

/// Éléments d'un tableau SANS TROU (là où le JS les sauterait : `every`, `filter`, `map`…) ; None si `v` n'est pas
/// un tableau.
///
/// # Errors
/// Hors domaine : tableau à trous.
pub fn denses(v: &Valeur) -> Result<Option<Cow<'_, [Valeur]>>, Echec> {
    if let Valeur::Tableau(t) = v { if t.iter().any(Option::is_none) { return hd("tableau à trous"); } }
    Ok(elements(v))
}

/// `v.slice(0, n)` d'un tableau, trous conservés.
#[must_use]
pub fn tranche(v: &Valeur, n: usize) -> Valeur {
    match v {
        Valeur::Tableau(t) => Valeur::Tableau(t.iter().take(n).cloned().collect()),
        _ => tab(elements(v).map(|l| l.iter().take(n).cloned().collect()).unwrap_or_default()),
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

/// Locales (résolues par `new Intl.Collator().resolvedOptions().locale`) dont l'ordre de l'ASCII imprimable est
/// l'ordre racine d'ICU : vérifié sur 100 000 paires tirées par locale, dans Node ET dans Chromium (0 écart). Le danois,
/// le tchèque, le lituanien et l'estonien divergent (contractions, place de y et z) : hors domaine.
const LOCALES: [&str; 18] = ["en", "en-US", "en-GB", "fr", "fr-FR", "fr-CA", "fr-BE", "fr-CH", "de", "de-DE", "es", "it", "nl", "pt", "pt-BR", "sv", "tr", "pl"];

/// Locale de l'opérateur (passée par la façade) : `Some` si son ordre ASCII est vérifié.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Locale(bool);
impl Locale {
    /// Locale lue dans l'entrée (`{locale: "fr-FR"}`).
    #[must_use]
    pub fn de(v: &Valeur) -> Self { Locale(chaine(v).is_some_and(|l| LOCALES.contains(&l))) }
    /// Locale vérifiée (essais).
    #[must_use]
    pub fn verifiee() -> Self { Locale(true) }
}

/// `a.localeCompare(b)` (signe) sur l'ASCII imprimable : poids primaires, puis la casse (minuscule avant majuscule).
///
/// # Errors
/// Hors domaine : locale non vérifiée, ou un caractère hors de 32 à 126.
pub fn locale_compare(a: &str, b: &str, loc: Locale) -> Result<Ordering, Echec> {
    if !loc.0 { return hd("localeCompare : locale non vérifiée"); }
    if a == b { return Ok(Ordering::Equal); }
    let pa: Option<Vec<u8>> = a.bytes().map(primaire).collect();
    let pb: Option<Vec<u8>> = b.bytes().map(primaire).collect();
    let (Some(pa), Some(pb)) = (pa, pb) else { return hd("localeCompare hors de l'ASCII imprimable") };
    let o = pa.cmp(&pb);
    if o != Ordering::Equal { return Ok(o); }
    Ok(a.bytes().map(|c| c.is_ascii_uppercase()).cmp(b.bytes().map(|c| c.is_ascii_uppercase())))
}

/// `s.slice(0, n)` en unités UTF-16 ; hors domaine si la coupe tombe au milieu d'une paire de substitution.
///
/// # Errors
/// Hors domaine : coupe d'une paire (le JS rendrait un substitut isolé, non transportable).
pub fn tranche_utf16(s: &str, n: usize) -> Result<String, Echec> {
    let mut u = 0usize;
    for (i, c) in s.char_indices() {
        let l = c.len_utf16();
        if u + l > n { return if u < n { hd("slice : paire coupée") } else { Ok(s.get(..i).unwrap_or_default().to_owned()) }; }
        u += l;
    }
    Ok(s.to_owned())
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
        let l = Locale::verifiee();
        assert_eq!(locale_compare("a", "B", l), Ok(Ordering::Less));
        assert_eq!(locale_compare("b", "B", l), Ok(Ordering::Less));
        assert_eq!(locale_compare("a-b", "ab", l), Ok(Ordering::Less));
        assert_eq!(locale_compare("_", "-", l), Ok(Ordering::Less));
        assert_eq!(locale_compare("9", "a", l), Ok(Ordering::Less));
        assert_eq!(locale_compare("", "a", l), Ok(Ordering::Less));
        assert_eq!(locale_compare("aB", "Ab", l), Ok(Ordering::Less));
        assert!(locale_compare("é", "e", l).is_err());
        assert!(locale_compare("a", "b", Locale::de(&s("da"))).is_err());
        assert_eq!(locale_compare("a", "b", Locale::de(&s("fr-FR"))), Ok(Ordering::Less));
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

/// `Date.parse` (V8), domaine restreint : la forme ISO 8601 d'ECMA-262 (« Date Time String Format ») AVEC décalage
/// (`Z`, `±HH:mm`) ou date seule (UTC). Seule forme relevée dans les journaux réels du 04 au 06/11 (363 956 dates, toutes
/// de `toISOString`). Au-delà — heure sans décalage (heure LOCALE de l'opérateur), minuscules, espaces, formes que
/// V8 confie à son analyseur « hérité » (implémentation-définie) : hors domaine. Règles relevées sur V8 (Node et Chromium) :
/// jour 1 à 31 quel que soit le mois (31 février = 3 mars) ; fraction de longueur quelconque, tronquée à la
/// milliseconde. Un champ hors plage (mois 13, jour 0, 24 h non nulle, décalage +24:00, année −000000, |t| > 8,64e15) :
/// l'analyseur ISO de V8 refuse, puis son analyseur hérité accepte parfois (« 0003-13 » rend une date) : hors domaine.
/// Seule la chaîne vide rend NaN.
pub mod date {
    use super::hd;
    use ariane_js::Echec;

    fn chiffres(o: &[u8], i: usize, n: usize) -> Option<i64> {
        let t = o.get(i..i + n)?;
        if !t.iter().all(u8::is_ascii_digit) { return None; }
        Some(t.iter().fold(0i64, |a, c| a * 10 + i64::from(c - b'0')))
    }
    /// Jours depuis le 1970-01-01 du 1er du mois `m` (1 à 12) de l'année `y` (calendrier grégorien proleptique).
    fn jours_civils(y: i64, m: i64) -> i64 {
        let y = if m <= 2 { y - 1 } else { y };
        let era = y.div_euclid(400);
        let yoe = y - era * 400;
        let mp = (m + 9) % 12;
        let doy = (153 * mp + 2) / 5;
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        era * 146_097 + doe - 719_468
    }

    /// `Date.parse(s)`.
    ///
    /// # Errors
    /// Hors domaine : toute forme autre que la forme ISO stricte décrite ci-dessus (et la chaîne vide, NaN).
    #[allow(clippy::cast_precision_loss)] // |t| ≤ 8,64e15 < 2^53 : conversion exacte
    pub fn parse(s: &str) -> Result<f64, Echec> {
        if s.is_empty() { return Ok(f64::NAN); }
        let o = s.as_bytes();
        let mut i;
        let annee = if let Some(b'+' | b'-') = o.first() {
            let Some(a) = chiffres(o, 1, 6) else { return hd("Date.parse : forme non ISO") };
            i = 7;
            // −000000 : refusée par l'analyseur ISO de V8, puis confiée à son analyseur hérité (implémentation-définie)
            if o.first() == Some(&b'-') { if a == 0 { return hd("Date.parse : année −000000"); } -a } else { a }
        } else { let Some(a) = chiffres(o, 0, 4) else { return hd("Date.parse : forme non ISO") }; i = 4; a };
        let (mut mois, mut jour) = (1, 1);
        if o.get(i) == Some(&b'-') {
            let Some(m) = chiffres(o, i + 1, 2) else { return hd("Date.parse : mois") };
            mois = m;
            i += 3;
            if o.get(i) == Some(&b'-') {
                let Some(d) = chiffres(o, i + 1, 2) else { return hd("Date.parse : jour") };
                jour = d;
                i += 3;
            }
        }
        let (mut h, mut mi, mut se, mut ms, mut frac_nulle, mut decalage) = (0, 0, 0, 0, true, 0i64);
        if i < o.len() {
            if o.get(i) != Some(&b'T') { return hd("Date.parse : séparateur"); }
            let (Some(hh), Some(b':'), Some(mm)) = (chiffres(o, i + 1, 2), o.get(i + 3), chiffres(o, i + 4, 2)) else { return hd("Date.parse : heure") };
            h = hh; mi = mm; i += 6;
            if o.get(i) == Some(&b':') {
                let Some(ss) = chiffres(o, i + 1, 2) else { return hd("Date.parse : secondes") };
                se = ss; i += 3;
                if o.get(i) == Some(&b'.') {
                    let debut = i + 1;
                    let mut j = debut;
                    while o.get(j).is_some_and(u8::is_ascii_digit) { j += 1; }
                    if j == debut { return hd("Date.parse : fraction vide"); }
                    let f = o.get(debut..j).unwrap_or_default();
                    ms = (0..3).fold(0i64, |a, k| a * 10 + f.get(k).map_or(0, |c| i64::from(c - b'0')));
                    frac_nulle = f.iter().all(|&c| c == b'0');
                    i = j;
                }
            }
            match o.get(i) {
                Some(b'Z') if i + 1 == o.len() => {}
                Some(&c @ (b'+' | b'-')) if i + 6 == o.len() => {
                    let (Some(dh), Some(b':'), Some(dm)) = (chiffres(o, i + 1, 2), o.get(i + 3), chiffres(o, i + 4, 2)) else { return hd("Date.parse : décalage") };
                    if dh > 23 || dm > 59 { return hd("Date.parse : décalage hors plage"); }
                    decalage = (dh * 60 + dm) * 60_000 * if c == b'-' { -1 } else { 1 };
                }
                _ => return hd("Date.parse : heure sans décalage (locale) ou suffixe"),
            }
        }
        // champ hors plage : l'analyseur ISO de V8 refuse, puis son analyseur hérité accepte parfois (« 0003-13 ») : hors domaine
        if !(1..=12).contains(&mois) || !(1..=31).contains(&jour) || h > 24 || mi > 59 || se > 59 { return hd("Date.parse : champ hors plage"); }
        if h == 24 && (mi != 0 || se != 0 || !frac_nulle) { return hd("Date.parse : 24 h non nulle"); }
        let jours = jours_civils(annee, mois) + jour - 1;
        let t = i128::from(jours) * 86_400_000 + i128::from(((h * 60 + mi) * 60 + se) * 1000 + ms) - i128::from(decalage);
        if t.abs() > 8_640_000_000_000_000 { return hd("Date.parse : hors de ±8,64e15"); }
        // |t| ≤ 8,64e15 : tient dans un i64 et se convertit exactement
        Ok(i64::try_from(t).map_or(f64::NAN, |x| x as f64))
    }

    #[cfg(test)]
    #[allow(clippy::float_cmp)]
    mod essais {
        use super::parse;
        #[test]
        fn formes_relevees_sur_v8() {
            for (s, t) in [("2026-11-06T07:21:00.000Z", 1_793_949_660_000.0), ("2026-11-06", 1_793_923_200_000.0), ("2026", 1_767_225_600_000.0),
                ("2026-11-06T07:21:00.1234Z", 1_793_949_660_123.0), ("2026-11-06T07:21:00.000+01:00", 1_793_946_060_000.0),
                ("2026-11-06T24:00:00.000Z", 1_794_009_600_000.0), ("2026-02-30T00:00:00.000Z", 1_772_409_600_000.0),
                ("+275760-09-13T00:00:00.000Z", 8.64e15), ("-271821-04-20T00:00:00.000Z", -8.64e15), ("0000-01-01", -62_167_219_200_000.0),
                ("-000001-01-01T00:00Z", -62_198_755_200_000.0), ("1970-01-01T00:00:00.000Z", 0.0)] {
                assert_eq!(parse(s), Ok(t), "{s}");
            }
            assert!(parse("").is_ok_and(f64::is_nan));
            for s in ["2026-13-01", "2026-01-32", "2026-11-06T24:00:01.000Z", "2026-11-06T24:00:00.0001Z", "0003-13",
                "+275760-09-13T00:00:00.001Z", "2026-11-06T07:21:00.000+24:00"] {
                assert!(parse(s).is_err(), "{s}");
            }
            for s in ["2026-11-06T07:21:00", "2026-11-06t07:21:00z", " 2026-11-06", "+0100", "2026-1-06", "undefined", "-000000-01-01T00:00:00Z"] { assert!(parse(s).is_err(), "{s}"); }
        }
    }
}

/// `JSON.parse(texte)` (sans `reviver`) : grammaire stricte d'ECMA-404 ; une clé répétée garde sa première place et sa
/// dernière valeur ; `__proto__` est une clé propre comme les autres (la VBA le transporte). Toute erreur de syntaxe,
/// et un substitut isolé (`"\ud800"`, chaîne non transportable), est hors domaine : le message de V8 n'est pas reproduit.
pub mod json {
    use super::hd;
    use ariane_js::Echec;
    use ariane_vba::Valeur;

    struct L<'a> { o: &'a [u8], p: usize, prof: usize }
    impl L<'_> {
        fn blanc(&mut self) { while matches!(self.o.get(self.p), Some(b' ' | b'\t' | b'\n' | b'\r')) { self.p += 1; } }
        fn octet(&self) -> Option<u8> { self.o.get(self.p).copied() }
        fn mot(&mut self, m: &[u8], v: Valeur) -> Result<Valeur, Echec> {
            if self.o.get(self.p..self.p + m.len()) == Some(m) { self.p += m.len(); Ok(v) } else { hd("JSON.parse : syntaxe") }
        }
        fn hex4(&mut self) -> Result<u32, Echec> {
            let t = self.o.get(self.p..self.p + 4).ok_or_else(|| Echec::hors_domaine("JSON.parse : \\u"))?;
            let s = core::str::from_utf8(t).map_err(|_| Echec::hors_domaine("JSON.parse : \\u"))?;
            if !s.bytes().all(|c| c.is_ascii_hexdigit()) { return hd("JSON.parse : \\u"); }
            self.p += 4;
            u32::from_str_radix(s, 16).map_err(|_| Echec::hors_domaine("JSON.parse : \\u"))
        }
        fn chaine(&mut self) -> Result<String, Echec> {
            self.p += 1; // "
            let mut out = String::new();
            loop {
                let debut = self.p;
                while let Some(c) = self.octet() { if c == b'"' || c == b'\\' || c < 0x20 { break; } self.p += 1; }
                let morceau = core::str::from_utf8(self.o.get(debut..self.p).unwrap_or_default()).map_err(|_| Echec::hors_domaine("JSON.parse : UTF-8"))?;
                out.push_str(morceau);
                match self.octet() {
                    Some(b'"') => { self.p += 1; return Ok(out); }
                    Some(b'\\') => {
                        self.p += 1;
                        let e = self.octet().ok_or_else(|| Echec::hors_domaine("JSON.parse : échappement"))?;
                        self.p += 1;
                        match e {
                            b'"' => out.push('"'), b'\\' => out.push('\\'), b'/' => out.push('/'), b'b' => out.push('\u{8}'),
                            b'f' => out.push('\u{c}'), b'n' => out.push('\n'), b'r' => out.push('\r'), b't' => out.push('\t'),
                            b'u' => {
                                let u = self.hex4()?;
                                let c = if (0xD800..0xDC00).contains(&u) {
                                    if self.o.get(self.p..self.p + 2) != Some(b"\\u") { return hd("JSON.parse : substitut isolé"); }
                                    self.p += 2;
                                    let v = self.hex4()?;
                                    if !(0xDC00..0xE000).contains(&v) { return hd("JSON.parse : substitut isolé"); }
                                    0x10000 + ((u - 0xD800) << 10) + (v - 0xDC00)
                                } else if (0xDC00..0xE000).contains(&u) { return hd("JSON.parse : substitut isolé"); } else { u };
                                out.push(char::from_u32(c).ok_or_else(|| Echec::hors_domaine("JSON.parse : point de code"))?);
                            }
                            _ => return hd("JSON.parse : échappement"),
                        }
                    }
                    _ => return hd("JSON.parse : chaîne"),
                }
            }
        }
        fn nombre(&mut self) -> Result<Valeur, Echec> {
            let debut = self.p;
            if self.octet() == Some(b'-') { self.p += 1; }
            match self.octet() {
                Some(b'0') => self.p += 1,
                Some(b'1'..=b'9') => { while self.octet().is_some_and(|c| c.is_ascii_digit()) { self.p += 1; } }
                _ => return hd("JSON.parse : nombre"),
            }
            if self.octet() == Some(b'.') {
                self.p += 1;
                if !self.octet().is_some_and(|c| c.is_ascii_digit()) { return hd("JSON.parse : nombre"); }
                while self.octet().is_some_and(|c| c.is_ascii_digit()) { self.p += 1; }
            }
            if matches!(self.octet(), Some(b'e' | b'E')) {
                self.p += 1;
                if matches!(self.octet(), Some(b'+' | b'-')) { self.p += 1; }
                if !self.octet().is_some_and(|c| c.is_ascii_digit()) { return hd("JSON.parse : nombre"); }
                while self.octet().is_some_and(|c| c.is_ascii_digit()) { self.p += 1; }
            }
            let t = core::str::from_utf8(self.o.get(debut..self.p).unwrap_or_default()).map_err(|_| Echec::hors_domaine("JSON.parse : nombre"))?;
            // `str::parse::<f64>` arrondit correctement, comme la lecture des littéraux de V8
            t.parse::<f64>().map(Valeur::Nombre).map_err(|_| Echec::hors_domaine("JSON.parse : nombre"))
        }
        fn valeur(&mut self) -> Result<Valeur, Echec> {
            self.prof += 1;
            // au-delà de 500 niveaux, la trame VBA de sortie serait refusée (512) : hors domaine, sans risque pour la pile
            if self.prof > 500 { return hd("JSON.parse : profondeur"); }
            self.blanc();
            let v = match self.octet() {
                Some(b'{') => {
                    self.p += 1;
                    let mut t: Vec<(String, Valeur)> = vec![];
                    self.blanc();
                    if self.octet() == Some(b'}') { self.p += 1; } else {
                        loop {
                            self.blanc();
                            if self.octet() != Some(b'"') { return hd("JSON.parse : clé"); }
                            let k = self.chaine()?;
                            self.blanc();
                            if self.octet() != Some(b':') { return hd("JSON.parse : deux-points"); }
                            self.p += 1;
                            let x = self.valeur()?;
                            if let Some(e) = t.iter_mut().find(|(c, _)| *c == k) { e.1 = x; } else { t.push((k, x)); }
                            self.blanc();
                            match self.octet() { Some(b',') => self.p += 1, Some(b'}') => { self.p += 1; break; } _ => return hd("JSON.parse : objet") }
                        }
                    }
                    Valeur::Objet(t)
                }
                Some(b'[') => {
                    self.p += 1;
                    let mut t = vec![];
                    self.blanc();
                    if self.octet() == Some(b']') { self.p += 1; } else {
                        loop {
                            t.push(Some(self.valeur()?));
                            self.blanc();
                            match self.octet() { Some(b',') => self.p += 1, Some(b']') => { self.p += 1; break; } _ => return hd("JSON.parse : tableau") }
                        }
                    }
                    Valeur::Tableau(t)
                }
                Some(b'"') => Valeur::Chaine(self.chaine()?),
                Some(b't') => self.mot(b"true", Valeur::Booleen(true))?,
                Some(b'f') => self.mot(b"false", Valeur::Booleen(false))?,
                Some(b'n') => self.mot(b"null", Valeur::Nul)?,
                Some(b'-' | b'0'..=b'9') => self.nombre()?,
                _ => return hd("JSON.parse : syntaxe"),
            };
            self.prof -= 1;
            Ok(v)
        }
    }

    /// `JSON.parse(texte)`.
    ///
    /// # Errors
    /// Hors domaine : erreur de syntaxe (le JS lèverait une `SyntaxError` au message propre à V8), substitut isolé.
    pub fn parse(texte: &str) -> Result<Valeur, Echec> {
        let mut l = L { o: texte.as_bytes(), p: 0, prof: 0 };
        let v = l.valeur()?;
        l.blanc();
        if l.p != l.o.len() { return hd("JSON.parse : texte après la valeur"); }
        Ok(v)
    }

    #[cfg(test)]
    mod essais {
        use super::parse;
        use ariane_vba::Valeur;
        #[test]
        fn grammaire() {
            assert_eq!(parse(" {\"a\":1,\"b\":[true,null],\"a\":-0} "), Ok(Valeur::Objet(vec![("a".into(), Valeur::Nombre(-0.0)), ("b".into(), Valeur::Tableau(vec![Some(Valeur::Booleen(true)), Some(Valeur::Nul)]))])));
            assert_eq!(parse("\"\\ud83d\\ude00\\n\""), Ok(Valeur::Chaine("😀\n".into())));
            for t in ["", "01", "1.", "{'a':1}", "[1,]", "\"\\ud800\"", "\u{feff}{}", "nul", "1 2", "\"\t\""] { assert!(parse(t).is_err(), "{t}"); }
            assert!(matches!(parse("-0"), Ok(Valeur::Nombre(x)) if x == 0.0 && x.is_sign_negative()));
            assert_eq!(parse("1e400"), Ok(Valeur::Nombre(f64::INFINITY)));
        }
    }
}
