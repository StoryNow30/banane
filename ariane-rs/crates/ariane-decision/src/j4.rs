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

/// Médiane du JS (`med`) : tri numérique, moyenne des deux du milieu ; vide : `None`.
#[must_use]
pub fn med(a: &[f64]) -> Option<f64> {
    if a.is_empty() { return None; }
    let mut b = a.to_vec();
    ariane_js::trier_nombres(&mut b);
    let i = b.len() >> 1;
    if b.len() % 2 == 1 { b.get(i).copied() } else { Some((b.get(i.wrapping_sub(1)).copied()? + b.get(i).copied()?) / 2.0) }
}

/// Distance de deux points à trois composantes (`Math.hypot(a0-b0, a1-b1, a2-b2)`).
#[must_use]
pub fn dist3(a: &[f64; 3], b: &[f64; 3]) -> f64 { ariane_js::hypot(&[a[0] - b[0], a[1] - b[1], a[2] - b[2]]) }
