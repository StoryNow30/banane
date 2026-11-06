//! CH-068 (J4) : `src/gcv2-l1e.js` (décision L1-e d'un différé, correction d'écartement), ligne à ligne.
//! Portées : `referenceEcartement`, `signe`, `corriger` (sans `soutien` : une fonction ne traverse pas, la façade rejoue le JS),
//! `decider`.
#![warn(clippy::pedantic, missing_docs)]
#![allow(clippy::many_single_char_names, clippy::too_many_lines, clippy::cast_precision_loss, clippy::needless_range_loop)]
#![allow(clippy::neg_cmp_op_on_partial_ord, clippy::manual_range_contains, clippy::float_cmp)]
// (a+b)/2 garde l'ordre des opérations du JS (même arrondi) : `midpoint` ne le garantit pas
#![allow(clippy::manual_midpoint)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::indexing_slicing, clippy::unreachable, clippy::todo)]
use crate::j4::{fin_de, nombre, ou_nul};
use crate::js::{b, elem, elems, entier, est_tableau, g, hd, n, nul, nullish, o, p, s, vrai, Appel, R};
use ariane_vba::Valeur as V;

/// `REGLAGE` du module.
#[must_use]
pub fn reglage() -> V {
    o(vec![("voisines", n(20.0)), ("voisinesMin", n(10.0)), ("anomalieMinMm", n(15.0)), ("anomalieMaxMm", n(40.0)), ("soutienDessus", n(5.0)), ("soutienFlanc", n(3.0))])
}
fn reglage_de(v: &V) -> V { if matches!(v, V::Indefini) { reglage() } else { v.clone() } }
/// `arrondi(v, d)` : `fini(v)?Math.round(v*10**d)/10**d:null` (10**1 et 10**2 sont exacts).
fn arrondi(v: f64, d: i32) -> V { if v.is_finite() { let k = if d == 1 { 10.0 } else { 100.0 }; n(ariane_js::round(v * k) / k) } else { nul() } }

/// `t[i] !== 0` d'un tableau (trou : `undefined`).
fn non_zero(t: &V, i: usize) -> bool { !matches!(elem(t, i), V::Nombre(x) if x == 0.0) }

/// `referenceEcartement(table, cut, reglage)` sur un instantané décompacté de la liste d'ESV.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn reference_ecartement(table: &V, cut: &V, reglage_: &V) -> R<V> {
    if !vrai(table) || !entier(g(table, "n")) || !est_tableau(g(table, "st")) || !est_tableau(g(table, "fl")) || !est_tableau(g(table, "ed")) || !entier(cut) { return Ok(nul()); }
    let (Some(tn), Some(c)) = (fin_de(g(table, "n")), fin_de(cut)) else { return Ok(nul()) };
    let rg = reglage_de(reglage_);
    let voisines = nombre(p(&rg, "voisines")?)?;
    let (st, fl, ed) = (g(table, "st"), g(table, "fl"), g(table, "ed"));
    let ed_e = elems(ed).unwrap_or_default();
    let mut pris: Vec<(f64, f64)> = vec![];
    let mut d = 0.0f64;
    while (pris.len() as f64) < voisines && d < tn {
        let candidats: Vec<f64> = if d == 0.0 { vec![c] } else { vec![c - d, c + d] };
        for i in candidats {
            if i < 0.0 || i >= tn || (pris.len() as f64) >= voisines { continue; }
            if i > 9.0e15 { return hd("indice démesuré"); }
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
            let iu = i as usize;
            if non_zero(st, iu) || non_zero(fl, iu) { continue; }
            // e = ed.slice(6i, 6i+6) ; e.length<6 || !e.every(fini)
            let debut = iu.saturating_mul(6);
            let e: Vec<&Option<V>> = ed_e.iter().skip(debut).take(6).collect();
            if e.len() < 6 { continue; }
            let mut x = [0.0f64; 6];
            let mut ok = true;
            for (k, v) in e.iter().enumerate() {
                match v { None => return hd("bords troués"), Some(V::Nombre(y)) if y.is_finite() => { if let Some(c_) = x.get_mut(k) { *c_ = *y; } } Some(_) => { ok = false; break; } }
            }
            if !ok { continue; }
            pris.push((ariane_js::hypot(&[x[0] - x[3], x[1] - x[4], x[2] - x[5]]) / 10.0, d));
        }
        d += 1.0;
    }
    let vmin = nombre(p(&rg, "voisinesMin")?)?;
    if (pris.len() as f64) < vmin { return Ok(nul()); }
    let mut sv: Vec<f64> = pris.iter().map(|x| x.0).collect();
    ariane_js::trier_nombres(&mut sv);
    let m = sv.len() >> 1;
    let mil = if sv.len() % 2 == 1 { sv.get(m).copied() } else { match (sv.get(m.wrapping_sub(1)), sv.get(m)) { (Some(a), Some(c_)) => Some((a + c_) / 2.0), _ => None } };
    // vide (voisinesMin non numérique) : (s[-1]+s[0])/2 vaut NaN, comme en JS
    let mil = mil.unwrap_or(f64::NAN);
    Ok(o(vec![("mm", arrondi(mil, 2)), ("n", n(pris.len() as f64)), ("distMax", n(ariane_js::max_de(pris.iter().map(|x| x.1))))]))
}

/// `x[1]` d'un décalage (`h.decal[1]`), converti par `ToNumber` (soustraction).
fn decal1(h: &V) -> R<f64> {
    let d = p(h, "decal")?;
    match d { V::Chaine(_) => hd("indice d'une chaîne"), V::Objet(_) => nombre(crate::js::g_brut(d, "1")), x if est_tableau(x) => nombre(&elem(x, 1)), _ => Ok(f64::NAN) }
}

/// `signe(hyps, s)`.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn signe(hyps: &V, side: &V) -> R<f64> {
    let k = crate::j4::cle_propriete(side)?;
    let hs = if matches!(hyps, V::Objet(_)) { crate::js::g_brut(hyps, &k) } else if nullish(hyps) { return hd("hyps absent") } else { return hd("hyps non simple") };
    if !est_tableau(hs) { return hd("find d'un non-tableau"); }
    let t: Vec<V> = elems(hs).unwrap_or_default().into_iter().map(|x| x.unwrap_or(V::Indefini)).collect();
    let mut h0 = None;
    for h in &t { if vrai(p(h, "depart")?) { h0 = Some(h); break; } }
    if let Some(h0) = h0 {
        if let Some(g0) = fin_de(g(h0, "g")) {
            for h in &t {
                let dl = decal1(h)? - decal1(h0)?;
                if dl.abs() > 5.0 {
                    if let Some(gh) = fin_de(g(h, "g")) {
                        let x = ariane_js::sign((gh - g0) / dl);
                        return Ok(if x == 0.0 || x.is_nan() { 1.0 } else { x });
                    }
                }
            }
        }
    }
    Ok(if matches!(side, V::Chaine(c) if c == "left") { 1.0 } else { -1.0 })
}

/// `x.slice()` d'un tableau (trous gardés).
fn copie(v: &V) -> R<Vec<Option<V>>> { if est_tableau(v) { Ok(elems(v).unwrap_or_default()) } else { hd("slice d'un non-tableau") } }

/// `corriger({paire, g, hyps, ref, soutien, reglage})`, `soutien` absent (non fonction).
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn corriger(arg: &V) -> R<V> {
    if nullish(arg) { return hd("déstructuration de null/undefined"); }
    let (paire, gv, hyps, refv) = (g(arg, "paire"), g(arg, "g"), g(arg, "hyps"), g(arg, "ref"));
    let rg = reglage_de(g(arg, "reglage"));
    let ecart = match (fin_de(refv), fin_de(gv)) { (Some(r), Some(x)) => arrondi(r - x, 1), _ => nul() };
    let mut out = vec![("anomalie", b(false)), ("ecartMm", ecart.clone()), ("rail", nul()), ("decal", nul()), ("soutenue", b(false))];
    let Some(e) = fin_de(&ecart) else { return Ok(o(out)) };
    let a = e.abs();
    if a < nombre(p(&rg, "anomalieMinMm")?)? || a > nombre(p(&rg, "anomalieMaxMm")?)? { return Ok(o(out)); }
    if let Some(x) = out.first_mut() { x.1 = b(true); }
    let pl = ou_zero(p(p(paire, "left")?, "p")?);
    let pr = ou_zero(p(p(paire, "right")?, "p")?);
    let side = if nombre(&pl)? <= nombre(&pr)? { "left" } else { "right" };
    let mut dl = copie(p(p(paire, "left")?, "decal")?)?;
    let mut dr = copie(p(p(paire, "right")?, "decal")?)?;
    let (Some(r), Some(x)) = (fin_de(refv), fin_de(gv)) else { return hd("référence") };
    let sg = signe(hyps, &s(side))?;
    let cible = if side == "left" { &mut dl } else { &mut dr };
    let ancien = match cible.get(1) { Some(Some(v)) => nombre(v)?, _ => f64::NAN };
    let nouveau = match arrondi(ancien + (r - x) / sg, 2) { V::Nombre(y) => V::Nombre(y), _ => nul() };
    while cible.len() < 2 { cible.push(None); }
    if let Some(c) = cible.get_mut(1) { *c = Some(nouveau); }
    let decal = o(vec![("left", V::Tableau(dl)), ("right", V::Tableau(dr))]);
    if let Some(x) = out.get_mut(2) { x.1 = s(side); }
    if let Some(x) = out.get_mut(3) { x.1 = decal; }
    // `typeof soutien==='function'` : jamais vrai d'une valeur décodée ; m = null, soutenue reste fausse
    Ok(o(out))
}
/// `v ?? 0`.
fn ou_zero(v: &V) -> V { if nullish(v) { n(0.0) } else { v.clone() } }

/// `decider(d0, c)`.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn decider(d0: &V, c: &V) -> R<V> {
    let corrigee = vrai(c) && vrai(g(c, "anomalie")) && vrai(g(c, "soutenue"));
    let etat = p(d0, "etat")?;
    let est = |x: &V, t: &str| matches!(x, V::Chaine(y) if y == t);
    if est(etat, "valider") {
        let decal = if corrigee { g(c, "decal").clone() } else {
            let pa = p(d0, "paire")?;
            o(vec![("left", p(p(pa, "left")?, "decal")?.clone()), ("right", p(p(pa, "right")?, "decal")?.clone())])
        };
        return Ok(o(vec![("etat", s("valider")), ("motif", nul()), ("decal", decal), ("corrigee", b(corrigee))]));
    }
    if est(etat, "rien") && est(g(d0, "motif"), "plus-de-150-mm") && corrigee {
        return Ok(o(vec![("etat", s("valider")), ("motif", s("ecartement-corrige")), ("decal", g(c, "decal").clone()), ("corrigee", b(true))]));
    }
    if est(etat, "poser-sans-valider") { return Ok(o(vec![("etat", s("rien")), ("motif", s("sans-approche")), ("decal", nul()), ("corrigee", b(false))])); }
    Ok(o(vec![("etat", s("rien")), ("motif", ou_nul(g(d0, "motif"))), ("decal", nul()), ("corrigee", b(false))]))
}

/// Aiguillage `{f, a}` du module (numéro `GCV2_L1E`).
///
/// # Errors
/// `Js` ou `HorsDomaine`, comme les fonctions portées.
pub fn appeler(a: &Appel) -> R<V> {
    match a.f.as_str() {
        "referenceEcartement" => reference_ecartement(a.arg(0), a.arg(1), a.arg(2)),
        "signe" => signe(a.arg(0), a.arg(1)).map(n),
        "corriger" => corriger(a.arg(0)),
        "decider" => decider(a.arg(0), a.arg(1)),
        _ => hd("gcv2-l1e : fonction non portée"),
    }
}
