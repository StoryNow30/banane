//! CH-068 (tranche J4) : aides communes aux modules J4 (`appuis`, `l1e`, `recentree`, `b1ecart`, `large`).
//! Chacune reproduit une expression précise du JS de référence ; ce qu'elle ne reproduit pas rend `HorsDomaine`.
#![warn(clippy::pedantic, missing_docs)]
#![allow(clippy::many_single_char_names, clippy::too_many_lines, clippy::cast_precision_loss, clippy::needless_range_loop)]
#![allow(clippy::neg_cmp_op_on_partial_ord, clippy::manual_range_contains, clippy::float_cmp)]
// (a+b)/2 garde l'ordre des opérations du JS (même arrondi) : `midpoint` ne le garantit pas
#![allow(clippy::manual_midpoint)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::indexing_slicing, clippy::unreachable, clippy::todo)]
use crate::critere::vers_nombre;
use crate::js::{elems, est_tableau, fini, g, hd, n, nul, R};
use ariane_vba::Valeur as V;

/// `typeof v==='number'&&Number.isFinite(v)`.
#[must_use]
pub fn fin(v: &V) -> bool { fini(v) }
/// Valeur numérique d'un `V::Nombre` fini.
#[must_use]
pub fn fin_de(v: &V) -> Option<f64> { match v { V::Nombre(x) if x.is_finite() => Some(*x), _ => None } }

/// `Array.isArray(a)&&a.length===3&&a.every(fin)` ; un trou (que `every` saute) rendrait un point incomplet : hors domaine.
///
/// # Errors
/// `HorsDomaine` sur un tableau troué.
pub fn v3(a: &V) -> R<Option<[f64; 3]>> {
    if !est_tableau(a) { return Ok(None); }
    let Some(t) = elems(a) else { return Ok(None) };
    if t.len() != 3 { return Ok(None); }
    let mut out = [0.0; 3];
    for (i, e) in t.iter().enumerate() {
        match e {
            None => return hd("point troué"),
            Some(V::Nombre(x)) if x.is_finite() => { if let Some(o) = out.get_mut(i) { *o = *x; } }
            Some(_) => return Ok(None),
        }
    }
    Ok(Some(out))
}
/// Les six nombres finis d'un tableau de longueur 6 (`Array.isArray(e)&&e.length===6&&e.every(fin)`), trou : hors domaine.
///
/// # Errors
/// `HorsDomaine` sur un tableau troué.
pub fn v6(a: &V) -> R<Option<[f64; 6]>> {
    if !est_tableau(a) { return Ok(None); }
    let Some(t) = elems(a) else { return Ok(None) };
    if t.len() != 6 { return Ok(None); }
    let mut out = [0.0; 6];
    for (i, e) in t.iter().enumerate() {
        match e {
            None => return hd("tableau troué"),
            Some(V::Nombre(x)) if x.is_finite() => { if let Some(o) = out.get_mut(i) { *o = *x; } }
            Some(_) => return Ok(None),
        }
    }
    Ok(Some(out))
}
/// Tableau dense de nombres (forme canonique VBA).
#[must_use]
pub fn nombres(t: &[f64]) -> V { crate::js::tab_n(t) }

/// `Number.isFinite(v)?Math.round(v*10)/10:null` (aucune coercition).
#[must_use]
pub fn r1(v: &V) -> V { match v { V::Nombre(x) if x.is_finite() => n(ariane_js::round(x * 10.0) / 10.0), _ => nul() } }
/// `r1` sur un nombre.
#[must_use]
pub fn r1f(x: f64) -> V { if x.is_finite() { n(ariane_js::round(x * 10.0) / 10.0) } else { nul() } }
/// `Number.isFinite(v)?Math.round(v*100)/100:null`.
#[must_use]
pub fn r2f(x: f64) -> V { if x.is_finite() { n(ariane_js::round(x * 100.0) / 100.0) } else { nul() } }

/// `ToNumber(v)` (primitives ; chaîne, objet : hors domaine).
///
/// # Errors
/// `HorsDomaine` hors des primitives non textuelles.
pub fn nombre(v: &V) -> R<f64> { vers_nombre(v) }

/// `v ?? null`.
#[must_use]
pub fn ou_nul(v: &V) -> V { if crate::js::nullish(v) { nul() } else { v.clone() } }
/// `a?.k` (chaîne d'accès optionnels sur des clés nommées).
#[must_use]
pub fn opt<'a>(v: &'a V, ks: &[&str]) -> &'a V {
    let mut x = v;
    for k in ks { if crate::js::nullish(x) { return &crate::js::INDEF; } x = g(x, k); }
    x
}

/// Clé de propriété `ToPropertyKey(v)` d'une primitive (nombre : `ariane_js::nombre::nombre_en_chaine`).
///
/// # Errors
/// `HorsDomaine` pour un objet, un tableau, ou la clé `__proto__`.
pub fn cle_propriete(v: &V) -> R<String> {
    let k = match v {
        V::Indefini => "undefined".to_owned(),
        V::Nul => "null".to_owned(),
        V::Booleen(x) => if *x { "true".to_owned() } else { "false".to_owned() },
        V::Nombre(x) => ariane_js::nombre::nombre_en_chaine(*x),
        V::Chaine(c) => c.clone(),
        _ => return hd("clé de propriété non primitive"),
    };
    if k == "__proto__" { return hd("clé __proto__"); }
    Ok(k)
}

/// `x.slice(a, b)` d'un tableau (bornes déjà réduites par `ToIntegerOrInfinity`, négatives depuis la fin).
#[must_use]
pub fn borne_slice(len: usize, k: f64) -> usize { crate::js::slice_debut(len, k) }

/// Médiane du JS (`med`) : tri numérique, moyenne des deux du milieu ; vide : `None` (`null`).
///
/// # Errors
/// `HorsDomaine` si une valeur n'est pas finie (comparateur NaN : ordre propre à V8).
pub fn med(a: &[f64]) -> R<Option<f64>> {
    if a.is_empty() { return Ok(None); }
    let mut b = a.to_vec();
    trier_par(&mut b, |x| *x)?;
    let i = b.len() >> 1;
    Ok(if b.len() % 2 == 1 { b.get(i).copied() } else { match (b.get(i.wrapping_sub(1)), b.get(i)) { (Some(x), Some(y)) => Some((x + y) / 2.0), _ => None } })
}
/// Distance de deux points à trois composantes (`Math.hypot(a0-b0, a1-b1, a2-b2)`).
#[must_use]
pub fn dist3(a: &[f64; 3], b: &[f64; 3]) -> f64 { ariane_js::hypot(&[a[0] - b[0], a[1] - b[1], a[2] - b[2]]) }

/// `String(v)` : nombres par `ariane_js::nombre::nombre_en_chaine`, tableaux joints par « , » (éléments nuls et trous vides).
///
/// # Errors
/// `HorsDomaine` pour une erreur.
pub fn texte(v: &V) -> R<String> {
    Ok(match v {
        V::Indefini => "undefined".to_owned(),
        V::Nul => "null".to_owned(),
        V::Booleen(x) => if *x { "true".to_owned() } else { "false".to_owned() },
        V::Nombre(x) => ariane_js::nombre::nombre_en_chaine(*x),
        V::Chaine(c) => c.clone(),
        V::Objet(_) => "[object Object]".to_owned(),
        V::Erreur { .. } => return hd("String d'une erreur"),
        t => {
            let mut out = String::new();
            for (i, x) in elems(t).unwrap_or_default().iter().enumerate() {
                if i > 0 { out.push(','); }
                match x { None | Some(V::Indefini | V::Nul) => {} Some(x) => out.push_str(&texte(x)?) }
            }
            out
        }
    })
}
/// `String(v).slice(0, k)`.
///
/// # Errors
/// `HorsDomaine` (coupe au milieu d'une paire de substitution, erreur).
pub fn texte_k(v: &V, k: usize) -> R<String> { crate::js::tranche_utf16(&texte(v)?, k) }

/// `v.length` (tableau, chaîne en unités UTF-16, objet simple : sa clé `length`) ; autre primitive : `undefined`.
#[must_use]
pub fn longueur_js(v: &V) -> V {
    match v {
        V::Chaine(c) => n(c.encode_utf16().count() as f64),
        V::Objet(_) => crate::js::g_brut(v, "length").clone(),
        x if est_tableau(x) => n(crate::js::longueur(x).unwrap_or(0) as f64),
        _ => V::Indefini,
    }
}
/// `a + b` de deux valeurs dont aucune n'est une chaîne ni un objet (sinon : hors domaine).
///
/// # Errors
/// `HorsDomaine` si l'addition concaténerait.
pub fn plus(a: &V, b: &V) -> R<f64> { Ok(nombre(a)? + nombre(b)?) }
/// Éléments d'un tableau, trous en `undefined` (itération `for…of`, étalement).
#[must_use]
pub fn iter_vals(v: &V) -> Vec<V> { elems(v).unwrap_or_default().into_iter().map(|x| x.unwrap_or(V::Indefini)).collect() }
/// `SameValueZero(a, b)` (`Set.has`, `includes`) entre primitives ; objets : hors domaine.
///
/// # Errors
/// `HorsDomaine` entre deux objets.
pub fn svz(a: &V, b: &V) -> R<bool> {
    match (a, b) { (V::Nombre(x), V::Nombre(y)) => Ok(x == y || (x.is_nan() && y.is_nan())), _ => crate::js::strict_egal(a, b) }
}
/// Tri stable d'éléments par une clé numérique, comme `sort((a,b)=>k(a)-k(b))` : clés non finies (comparateur NaN
/// possible, ordre propre au `TimSort` de V8) : hors domaine dès qu'il y a au moins deux éléments.
///
/// # Errors
/// `HorsDomaine` si une clé n'est pas finie.
pub fn trier_par<T>(t: &mut [T], cle: impl Fn(&T) -> f64) -> R<()> {
    if t.len() > 1 && t.iter().any(|x| !cle(x).is_finite()) { return hd("tri : clé non finie"); }
    t.sort_by(|a, b| { let d = cle(a) - cle(b); if d < 0.0 { core::cmp::Ordering::Less } else if d > 0.0 { core::cmp::Ordering::Greater } else { core::cmp::Ordering::Equal } });
    Ok(())
}
