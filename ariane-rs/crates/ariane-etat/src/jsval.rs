//! Lectures d'une `Valeur` avec la sémantique JS utile aux modules portés.
use ariane_vba::Valeur;
use std::collections::HashMap;

pub fn obj(v: &Valeur) -> Option<&[(String, Valeur)]> {
    match v { Valeur::Objet(t) => Some(t), _ => None }
}
pub fn est_objet(v: &Valeur) -> bool { matches!(v, Valeur::Objet(_)) }
pub fn est_tableau(v: &Valeur) -> bool { matches!(v, Valeur::Tableau(_)) }

pub fn get<'a>(v: &'a Valeur, k: &str) -> Option<&'a Valeur> {
    obj(v).and_then(|t| t.iter().find(|(c, _)| c == k).map(|(_, x)| x))
}
pub fn a<'a>(v: &'a Valeur, k: &str) -> &'a Valeur {
    get(v, k).unwrap_or(&Valeur::Indefini)
}
pub fn possede(v: &Valeur, k: &str) -> bool { get(v, k).is_some() }

pub fn chaine(v: &Valeur) -> Option<&str> { match v { Valeur::Chaine(s) => Some(s), _ => None } }
pub fn nombre(v: &Valeur) -> Option<f64> { match v { Valeur::Nombre(x) => Some(*x), _ => None } }

pub fn vrai(v: &Valeur) -> bool {
    match v {
        Valeur::Indefini | Valeur::Nul => false,
        Valeur::Booleen(b) => *b,
        Valeur::Nombre(x) => !(x.is_nan() || *x == 0.0),
        Valeur::Chaine(s) => !s.is_empty(),
        _ => true,
    }
}

/// `Number.isInteger`.
pub fn est_entier(v: &Valeur) -> bool {
    match v { Valeur::Nombre(x) => x.is_finite() && x.fract() == 0.0, _ => false }
}
pub fn entier_f(x: f64) -> bool { x.is_finite() && x.fract() == 0.0 }

/// `ToInt32` (`x | 0`).
pub fn vers_int32(v: &Valeur) -> i32 {
    let x = match v {
        Valeur::Nombre(x) => *x,
        Valeur::Booleen(b) => { if *b { 1.0 } else { 0.0 } }
        Valeur::Nul | Valeur::Indefini => return 0,
        Valeur::Chaine(s) => parse_nombre_js(s).unwrap_or(f64::NAN),
        _ => return 0,
    };
    if !x.is_finite() || x == 0.0 { return 0; }
    let t = x.trunc();
    let mut m = t % 4294967296.0;
    if m < 0.0 { m += 4294967296.0; }
    (m as u32) as i32
}

/// `Number(x)` pour les types que le journal porte.
pub fn vers_f64(v: &Valeur) -> f64 {
    match v {
        Valeur::Nombre(x) => *x,
        Valeur::Booleen(b) => { if *b { 1.0 } else { 0.0 } }
        Valeur::Nul => 0.0,
        Valeur::Indefini => f64::NAN,
        Valeur::Chaine(s) => parse_nombre_js(s).unwrap_or(f64::NAN),
        _ => f64::NAN,
    }
}

fn parse_nombre_js(s: &str) -> Option<f64> {
    let t = s.trim();
    if t.is_empty() { return Some(0.0); }
    if t == "Infinity" || t == "+Infinity" { return Some(f64::INFINITY); }
    if t == "-Infinity" { return Some(f64::NEG_INFINITY); }
    // JSON / littéral : pas de soulignement.
    t.parse().ok()
}

/// Tableau, bloc de nombres ou bloc de booléens, sous forme de valeurs. `None` si ce n'est pas une liste.
pub fn comme_liste(v: &Valeur) -> Option<Vec<Valeur>> {
    Some(match v {
        Valeur::Tableau(t) => t.iter().map(|e| e.clone().unwrap_or(Valeur::Indefini)).collect(),
        Valeur::Nombres(t) => t.iter().copied().map(Valeur::Nombre).collect(),
        Valeur::Booleens(t) => t.iter().copied().map(Valeur::Booleen).collect(),
        _ => return None,
    })
}

pub fn elements(v: &Valeur) -> Vec<&Valeur> {
    match v {
        Valeur::Tableau(t) => t.iter().filter_map(|e| e.as_ref()).collect(),
        _ => vec![],
    }
}

/// Éléments y compris les trous (None).
pub fn elements_bruts(v: &Valeur) -> Option<&[Option<Valeur>]> {
    match v { Valeur::Tableau(t) => Some(t), _ => None }
}

pub fn o(paires: Vec<(&str, Valeur)>) -> Valeur {
    Valeur::Objet(paires.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
}
pub fn n(x: f64) -> Valeur { Valeur::Nombre(x) }
pub fn s(t: impl Into<String>) -> Valeur { Valeur::Chaine(t.into()) }
pub fn b(v: bool) -> Valeur { Valeur::Booleen(v) }
pub fn nul() -> Valeur { Valeur::Nul }
pub fn indef() -> Valeur { Valeur::Indefini }

pub fn tab(v: Vec<Valeur>) -> Valeur { Valeur::Tableau(v.into_iter().map(Some).collect()) }

/// `x ?? null` : indéfini devient null, le reste est gardé.
pub fn ou_nul(v: &Valeur) -> Valeur {
    match v { Valeur::Indefini => Valeur::Nul, autre => autre.clone() }
}

/// Comparaison `===` pour les primitifs du journal (chaînes, nombres par bits, booléens, null, indéfini).
pub fn strict_eq(a: &Valeur, b: &Valeur) -> bool {
    match (a, b) {
        (Valeur::Indefini, Valeur::Indefini) | (Valeur::Nul, Valeur::Nul) => true,
        (Valeur::Booleen(x), Valeur::Booleen(y)) => x == y,
        (Valeur::Nombre(x), Valeur::Nombre(y)) => x.to_bits() == y.to_bits(),
        (Valeur::Chaine(x), Valeur::Chaine(y)) => x == y,
        _ => false,
    }
}

/// Clé SameValueZero pour un primitif. Les objets n'ont pas de clé (égalité de référence).
#[derive(Clone, PartialEq, Eq, Hash)]
pub enum Svz { U, Z, B(bool), N(u64), S(String) }
pub fn svz(v: &Valeur) -> Option<Svz> {
    Some(match v {
        Valeur::Indefini => Svz::U,
        Valeur::Nul => Svz::Z,
        Valeur::Booleen(b) => Svz::B(*b),
        Valeur::Nombre(x) => Svz::N(if x.is_nan() { 0x7ff8_0000_0000_0000 } else if *x == 0.0 { 0 } else { x.to_bits() }),
        Valeur::Chaine(s) => Svz::S(s.clone()),
        _ => return None,
    })
}

pub fn map_paires(v: &Valeur) -> Vec<(String, Valeur)> {
    match v {
        Valeur::Objet(t) => t.clone(),
        Valeur::Tableau(t) => t.iter().enumerate().filter_map(|(i, e)| e.as_ref().map(|x| (i.to_string(), x.clone()))).collect(),
        _ => vec![],
    }
}

/// Objet construit à partir de paires, dernière valeur gagnante, position de la première occurrence.
pub fn objet_depuis(paires: impl IntoIterator<Item = (String, Valeur)>) -> Valeur {
    let mut pos: HashMap<String, usize> = HashMap::new();
    let mut out: Vec<(String, Valeur)> = vec![];
    for (k, v) in paires {
        if let Some(&i) = pos.get(&k) { out[i].1 = v; } else { pos.insert(k.clone(), out.len()); out.push((k, v)); }
    }
    Valeur::Objet(out)
}

pub fn cmp_nombre(a: f64, b: f64) -> std::cmp::Ordering {
    let d = a - b;
    if d < 0.0 { std::cmp::Ordering::Less } else if d > 0.0 { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal }
}

/// Tri des chaînes comme `Array.prototype.sort` (unités UTF-16).
pub fn cmp_utf16(a: &str, b: &str) -> std::cmp::Ordering {
    fn u16(s: &str, buf: &mut Vec<u16>) { buf.clear(); buf.extend(s.encode_utf16()); }
    let (mut xa, mut xb) = (Vec::new(), Vec::new());
    u16(a, &mut xa); u16(b, &mut xb);
    xa.cmp(&xb)
}

pub fn trier_chaines(v: &mut [String]) { v.sort_by(|a, b| cmp_utf16(a, b)); }
