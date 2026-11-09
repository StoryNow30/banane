//! CH-068 (J4) : `src/recherche-large.js` (CH-034, recherche large de la paire), ligne à ligne.
//! Portées (numéro `RECHERCHE_LARGE`) : `reglage`, `graines`, `grainesUtiles`, `grainesPics`, `decalage`, `relance`, `cellules`, `paires`,
//! `decider`, `resumer`. Le moteur gelé (`scientificProposeBothAvecReservoir`) est celui du cœur, dans l'état du module GCV1 que la
//! façade résout ; `ms` de `decider` (une horloge) est posé par la façade, mesuré autour de l'appel (`Date.now()`), comme le JS.
#![allow(clippy::many_single_char_names, clippy::too_many_lines, clippy::cast_precision_loss, clippy::needless_range_loop)]
#![allow(clippy::neg_cmp_op_on_partial_ord, clippy::manual_range_contains, clippy::float_cmp)]
// (a+b)/2 garde l'ordre des opérations du JS (même arrondi) : `midpoint` ne le garantit pas
#![allow(clippy::manual_midpoint)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::indexing_slicing, clippy::unreachable, clippy::todo)]
use crate::aides;
use crate::j4::{fin_de, nombre, nombres, opt, r1, trier_par};
use crate::js::{b, definir, distance_v, elem, elems, est_tableau, etaler, g, hd, n, nul, nullish, o, p, s, tab, vrai, Appel, R, INDEF};
use crate::lot;
use crate::shadow::{self, Etat};
use ariane_vba::Valeur as V;

const SIDES: [&str; 2] = ["left", "right"];
/// `VERSION`.
pub const VERSION: &str = "recherche-large-1";

/// `DEFAUT`.
#[must_use]
pub fn defaut() -> V {
    o(vec![("actif", b(false)), ("mode", s("differer")), ("porteeMm", n(400.0)), ("pasMm", n(120.0)), ("loinMm", n(50.0)), ("rapport", n(1.5)), ("presMm", n(15.0)),
        ("cellulesMax", n(12.0)), ("zones", nul()), ("passe", b(true)), ("sansPaireLoin", b(true)), ("soutienTop", n(0.0)), ("soutienFace", n(0.0)), ("grainesMode", s("grille"))])
}
fn est(v: &V, t: &str) -> bool { matches!(v, V::Chaine(c) if c == t) }
fn objet(v: &V) -> bool { matches!(v, V::Objet(_)) }
fn fusion(a: &V, c: &V) -> R<V> { let mut e = vec![]; etaler(&mut e, a)?; etaler(&mut e, c)?; Ok(V::Objet(e)) }

/// `reglage(valeur, defaut)`.
///
/// # Errors
/// `HorsDomaine`.
pub fn reglage(valeur: &V, defaut_: &V) -> R<V> {
    let defaut_ = if matches!(defaut_, V::Indefini) { defaut() } else { defaut_.clone() };
    let d = if objet(&defaut_) { fusion(&defaut(), &defaut_)? } else { defaut() };
    let illisible = |raison: &str| -> R<V> {
        let mut e = vec![("ok".to_owned(), b(false)), ("raison".to_owned(), s(raison))];
        etaler(&mut e, &d)?;
        definir(&mut e, "actif", b(false));
        Ok(V::Objet(e))
    };
    let valeur = match valeur {
        V::Indefini => o(vec![]),
        V::Booleen(false) => { let mut e = vec![("ok".to_owned(), b(true))]; etaler(&mut e, &d)?; definir(&mut e, "actif", b(false)); return Ok(V::Objet(e)); }
        x => x.clone(),
    };
    if !objet(&valeur) { return illisible("rechercheLarge illisible"); }
    let r = fusion(&d, &valeur)?;
    let k = |c: &str| g(&r, c);
    if !matches!(k("actif"), V::Booleen(_)) { return illisible("rechercheLarge.actif illisible"); }
    if !["differer", "choisir", "choisir-sur"].iter().any(|m| est(k("mode"), m)) { return illisible("rechercheLarge.mode illisible"); }
    for c in ["porteeMm", "pasMm", "loinMm", "presMm"] { if !matches!(fin_de(k(c)), Some(x) if x > 0.0) { return illisible(&format!("rechercheLarge.{c} illisible")); } }
    if !matches!(fin_de(k("rapport")), Some(x) if x >= 1.0) { return illisible("rechercheLarge.rapport illisible"); }
    if !(crate::js::entier(k("cellulesMax")) && matches!(k("cellulesMax"), V::Nombre(x) if *x >= 2.0)) { return illisible("rechercheLarge.cellulesMax illisible"); }
    let z = k("zones");
    let zones_ok = matches!(z, V::Nul) || (est_tableau(z) && crate::js::presents(z).iter().all(|x| matches!(x, V::Chaine(_))));
    if !zones_ok { return illisible("rechercheLarge.zones illisible"); }
    if !matches!(k("passe"), V::Booleen(_)) { return illisible("rechercheLarge.passe illisible"); }
    if !matches!(k("sansPaireLoin"), V::Booleen(_)) { return illisible("rechercheLarge.sansPaireLoin illisible"); }
    for c in ["soutienTop", "soutienFace"] { if !matches!(fin_de(k(c)), Some(x) if x >= 0.0) { return illisible(&format!("rechercheLarge.{c} illisible")); } }
    if !(est(k("grainesMode"), "grille") || est(k("grainesMode"), "pics")) { return illisible("rechercheLarge.grainesMode illisible"); }
    let zones = if vrai(z) { V::Tableau(elems(z).unwrap_or_default()) } else { nul() };
    let mut out = vec![("ok", b(true))];
    for c in ["actif", "mode", "porteeMm", "pasMm", "loinMm", "rapport", "presMm", "cellulesMax"] { out.push((c, k(c).clone())); }
    out.push(("zones", zones));
    for c in ["passe", "sansPaireLoin", "soutienTop", "soutienFace", "grainesMode"] { out.push((c, k(c).clone())); }
    Ok(o(out))
}

/// `graines(R)` : 0, puis ±pas, ±2 pas… jusqu'à ±portée.
///
/// # Errors
/// `HorsDomaine`.
pub fn graines(rv: &V) -> R<Vec<f64>> {
    let (pas, portee) = (nombre(p(rv, "pasMm")?)?, nombre(g(rv, "porteeMm"))?);
    let mut out = vec![0.0];
    if !(pas > 0.0) || (portee + 1e-9) / pas > 1.0e5 { return if pas <= portee + 1e-9 { hd("graines démesurées") } else { Ok(out) }; }
    let mut x = pas;
    while x <= portee + 1e-9 { out.push(x); out.push(-x); x += pas; }
    Ok(out)
}

/// `decalage(rail, p)` : `[long, lat, vert]` (mm) ou `None`.
///
/// # Errors
/// `Js` (projection non finie) ou `HorsDomaine`.
pub fn decalage(rail: &V, pt: &V) -> R<Option<[f64; 3]>> {
    let m = if vrai(rail) { g(rail, "sceneRelativeToProfileLocal") } else { rail };
    let o_ = if vrai(rail) { g(rail, "positionSceneRelative") } else { rail };
    if !est_tableau(m) || crate::js::longueur(m) != Some(16) || !est_tableau(o_) || !est_tableau(pt) { return Ok(None); }
    let a = crate::js::point_v(m, pt)?;
    let c = crate::js::point_v(m, o_)?;
    Ok(Some([1000.0 * (a[0] - c[0]), 1000.0 * (a[1] - c[1]), 1000.0 * (a[2] - c[2])]))
}

fn capture_prete(cap: &V) -> bool {
    if !vrai(cap) || !vrai(g(cap, "rails")) { return false; }
    let pts = g(cap, "pointsSceneRelative");
    if !est_tableau(pts) || crate::js::longueur(pts).unwrap_or(0) == 0 { return false; }
    SIDES.iter().all(|side| { let r = g(g(cap, "rails"), side); vrai(r) && est_tableau(g(r, "positionSceneRelative")) && est_tableau(g(r, "sceneRelativeToProfileLocal")) })
}

/// Une cellule forte d'une relance.
#[derive(Clone)]
struct Cellule { lat: f64, vert: f64, loss: f64, top: V, face: V, graine: f64 }
impl Cellule {
    fn valeur(&self) -> V { o(vec![("lat", n(self.lat)), ("vert", n(self.vert)), ("loss", n(self.loss)), ("top", self.top.clone()), ("face", self.face.clone()), ("graine", n(self.graine))]) }
}
fn etat_reservoir(et: &Etat) -> Etat { Etat { partial_flank: et.partial_flank, convention: et.convention, plafond: et.plafond.clone(), avec_reservoir: true } }

/// `relance(capture, lat, science)` : cellules fortes par rail, ou `None` (le moteur a levé).
fn relance(capture: &V, lat: f64, science: &V, et: &Etat) -> R<Option<[Vec<Cellule>; 2]>> {
    let rails0 = p(capture, "rails")?;
    let mut rails = vec![];
    etaler(&mut rails, rails0)?;
    for side in SIDES {
        let rail = g(rails0, side);
        let pos = lot::position_of(rail, &nombres(&[0.0, lat / 1000.0, 0.0]))?;
        let pr = g(rail, "positionSceneRelative");
        let mut t = [0.0; 3];
        for (i, c) in t.iter_mut().enumerate() { *c = nombre(&elem(&pos, i))? - nombre(&elem(pr, i))?; }
        definir(&mut rails, side, aides::translated(rail, t)?);
    }
    let rails = V::Objet(rails);
    let sci = if lat == 0.0 && vrai(science) && vrai(g(science, "rails")) { science.clone() } else {
        let mut c = vec![];
        etaler(&mut c, capture)?;
        definir(&mut c, "rails", rails.clone());
        match shadow::scientific_propose_both(&V::Objet(c), &etat_reservoir(et)) { Ok(v) => v, Err(ariane_js::Echec::Js { .. }) => return Ok(None), Err(e) => return Err(e) }
    };
    let mut out: [Vec<Cellule>; 2] = [vec![], vec![]];
    for (k, side) in SIDES.iter().enumerate() {
        let r = opt(&sci, &["rails", side]);
        if !vrai(r) || !vrai(g(r, "ok")) || !vrai(g(r, "_reservoir")) { continue; }
        let rs = g(r, "_reservoir");
        let pool = g(rs, "pool");
        if !est_tableau(pool) { return hd("réservoir illisible"); }
        let sign = nombre(g(rs, "sign"))?;
        for c in crate::js::presents(pool) {
            if !vrai(&c) || !vrai(g(&c, "windowOk")) || vrai(g(&c, "slopeLimited")) { continue; }
            let Some(loss) = fin_de(g(&c, "loss")) else { continue };
            // T.qualifyStrong(c) : dessus ≥ 15, flanc ≥ 6 (Candidate.DEFAULTS), pente tenue, fenêtre tenue
            if !(nombre(g(&c, "topRows"))? >= 15.0 && nombre(g(&c, "faceCount"))? >= 6.0) { continue; }
            let (u, z) = (nombre(g(&c, "u"))?, nombre(g(&c, "z"))?);
            let ps = lot::position_of(g(&rails, side), &nombres(&[0.0, sign * u, z]))?;
            if let Some(mm) = decalage(g(rails0, side), &ps)? {
                let ou_n = |v: &V| if nullish(v) { nul() } else { v.clone() };
                if let Some(x) = out.get_mut(k) { x.push(Cellule { lat: mm[1], vert: mm[2], loss, top: ou_n(g(&c, "topRows")), face: ou_n(g(&c, "faceCount")), graine: lat }); }
            }
        }
    }
    Ok(Some(out))
}

/// Points en travers par rail (`traversParRail`) : `[lat, vert]` (mm).
fn travers_par_rail(capture: &V) -> R<[Vec<[f64; 2]>; 2]> {
    let mut out: [Vec<[f64; 2]>; 2] = [vec![], vec![]];
    let pts = g(capture, "pointsSceneRelative");
    let vis = g(capture, "visibleByClipBoxes");
    let points: Vec<Option<[f64; 3]>> = match pts {
        V::Bloc { k, donnees } => { let k = *k as usize; if k < 3 { vec![] } else { donnees.chunks_exact(k).map(|c| match c { [x, y, z, ..] => Some([*x, *y, *z]), _ => None }).collect() } }
        x if est_tableau(x) => {
            let mut v = vec![];
            for e in elems(x).unwrap_or_default() {
                match e { Some(pt) if est_tableau(&pt) && crate::js::longueur(&pt).unwrap_or(0) >= 3 => v.push(Some(ariane_capture::xyz(&pt)?)), _ => v.push(None) }
            }
            v
        }
        _ => return hd("nuage non tabulaire"),
    };
    for (k, side) in SIDES.iter().enumerate() {
        let rail = p(p(capture, "rails")?, side)?;
        let m = crate::js::m16(p(rail, "sceneRelativeToProfileLocal")?)?;
        let [x0, y0, z0] = ariane_capture::xyz(g(rail, "positionSceneRelative"))?;
        let o_ = ariane_capture::point(&m, x0, y0, z0)?;
        let Some(lat) = out.get_mut(k) else { continue };
        for (i, pt) in points.iter().enumerate() {
            if vrai(vis) && matches!(elem(vis, i), V::Booleen(false)) { continue; }
            let Some([x, y, z]) = pt else { continue };
            let q = ariane_capture::point(&m, *x, *y, *z)?;
            if (q[0] - o_[0]).abs() > 0.5 || (q[2] - o_[2]).abs() > 0.1 { continue; }
            lat.push([1000.0 * (q[1] - o_[1]), 1000.0 * (q[2] - o_[2])]);
        }
    }
    Ok(out)
}

/// `grainesUtiles(capture, R)`.
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn graines_utiles(capture: &V, rv: &V) -> R<Vec<f64>> {
    let t = travers_par_rail(capture)?;
    let mut out = vec![];
    for gr in graines(rv)? {
        let utile = t.iter().any(|l| { let mut c = 0; for [x, _] in l { if (x - gr).abs() <= 180.0 { c += 1; if c >= 15 { return true; } } } false });
        if utile { out.push(gr); }
    }
    Ok(out)
}

/// `grainesPics(capture, R)`.
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn graines_pics(capture: &V, rv: &V) -> R<Vec<f64>> {
    let t = travers_par_rail(capture)?;
    let portee = nombre(p(rv, "porteeMm")?)?;
    let mut cases: Vec<(f64, f64)> = vec![];
    for l in &t {
        for [lat, vert] in l {
            if vert.abs() > 50.0 || lat.abs() > portee + 80.0 { continue; }
            let bb = ariane_js::round(lat / 10.0) + 0.0;
            match cases.iter_mut().find(|x| x.0 == bb) { Some(x) => x.1 += 1.0, None => cases.push((bb, 1.0)) }
        }
    }
    let mut idx: Vec<(f64, f64)> = cases.into_iter().filter(|x| x.1 >= 5.0).collect();
    trier_par(&mut idx, |x| x.0)?;
    // amas : [deb, fin, n, w]
    let mut amas: Vec<[f64; 4]> = vec![];
    for (bb, nn) in idx {
        match amas.last_mut() { Some(c) if bb - c[1] <= 2.0 => { c[1] = bb; c[2] += nn; c[3] += bb * nn; } _ => amas.push([bb, bb, nn, bb * nn]) }
    }
    let mut centres = vec![];
    for a in amas.iter().filter(|a| a[2] >= 15.0) {
        let (deb, w) = (a[0] * 10.0, (a[1] - a[0]) * 10.0);
        if w <= 120.0 { centres.push(a[3] / a[2] * 10.0); continue; }
        let k = (w / 120.0).ceil();
        let mut i = 0.0;
        while i < k { centres.push(deb + w * (i + 0.5) / k); i += 1.0; }
    }
    trier_par(&mut centres, |x| x.abs())?;
    let mut gs = vec![0.0];
    for c in centres {
        let x = ariane_js::max(-portee, ariane_js::min(portee, c));
        if gs.iter().all(|y| (y - x).abs() > 60.0) { gs.push(x); }
    }
    Ok(gs)
}

/// Résultat de `cellules`.
struct Cellules { cells: [Vec<Cellule>; 2], relances: f64, sautees: f64 }
fn cellules_r(capture: &V, rv: &V, science: &V, et: &Etat) -> R<Cellules> {
    let mut out = Cellules { cells: [vec![], vec![]], relances: 0.0, sautees: 0.0 };
    if !capture_prete(capture) { return Ok(out); }
    let utiles = if est(p(rv, "grainesMode")?, "pics") { graines_pics(capture, rv)? } else { graines_utiles(capture, rv)? };
    out.sautees = graines(rv)?.len() as f64 - utiles.len() as f64;
    let reprise = vrai(science) && vrai(g(science, "rails")) && SIDES.iter().all(|side| { let r = g(g(science, "rails"), side); vrai(r) && vrai(g(r, "_reservoir")) });
    for gr in utiles {
        let Some(r) = relance(capture, gr, if reprise { science } else { &INDEF }, et)? else { continue };
        if !(gr == 0.0 && reprise) { out.relances += 1.0; }
        for (k, xs) in r.into_iter().enumerate() {
            let Some(liste) = out.cells.get_mut(k) else { continue };
            for x in xs {
                if let Some(d) = liste.iter_mut().find(|c| ariane_js::hypot(&[c.lat - x.lat, c.vert - x.vert]) < 3.0) { if x.loss < d.loss { *d = x; } } else { liste.push(x); }
            }
        }
    }
    for l in &mut out.cells { trier_par(l, |c| c.loss)?; }
    Ok(out)
}
fn cellules_v(c: &Cellules) -> V {
    o(vec![("left", tab(c.cells[0].iter().map(Cellule::valeur).collect())), ("right", tab(c.cells[1].iter().map(Cellule::valeur).collect())), ("relances", n(c.relances)), ("grainesSautees", n(c.sautees))])
}

/// Une paire admissible.
#[derive(Clone)]
struct Paire { l: Cellule, r: Cellule, gauge: f64, prod: f64 }
impl Paire {
    fn valeur(&self) -> V { o(vec![("left", self.l.valeur()), ("right", self.r.valeur()), ("gaugeMm", n(self.gauge)), ("prod", n(self.prod))]) }
}
fn position_de(capture: &V, side: &str, c: &Cellule) -> R<V> { lot::position_of(p(p(capture, "rails")?, side)?, &nombres(&[0.0, c.lat / 1000.0, c.vert / 1000.0])) }
fn paires_r(capture: &V, cells: &Cellules, rv: &V) -> R<Vec<Paire>> {
    let cm = p(rv, "cellulesMax")?;
    let (kl, kr) = (crate::j4::fin_slice(cells.cells[0].len(), cm)?, crate::j4::fin_slice(cells.cells[1].len(), cm)?);
    let mut out = vec![];
    for l in cells.cells[0].iter().take(kl) {
        for r in cells.cells[1].iter().take(kr) {
            let gm = 1000.0 * distance_v(&position_de(capture, "left", l)?, &position_de(capture, "right", r)?)?;
            if !ariane_geometrie::jauge::admissible(ariane_geometrie::jauge::classify_mm(gm)) { continue; }
            out.push(Paire { l: l.clone(), r: r.clone(), gauge: gm, prod: l.loss * r.loss });
        }
    }
    trier_par(&mut out, |x| x.prod)?;
    Ok(out)
}
/// `paires(capture, cells, R)` sur des cellules fournies (objets `{lat, vert, loss, …}`, rendus tels quels dans les paires).
fn paires_v(capture: &V, cells: &V, rv: &V) -> R<V> {
    let cm = p(rv, "cellulesMax")?.clone();
    let liste = |side: &str| -> R<Vec<V>> {
        let t = p(cells, side)?;
        if !est_tableau(t) { return hd("cellules non tabulaires"); }
        let e = elems(t).unwrap_or_default();
        let k = crate::j4::fin_slice(e.len(), &cm)?;
        Ok(e.into_iter().take(k).map(|x| x.unwrap_or(V::Indefini)).collect())
    };
    let (ls, rs) = (liste("left")?, liste("right")?);
    let pos = |side: &str, c: &V| -> R<V> {
        if nullish(c) { return hd("cellule absente"); }
        lot::position_of(p(p(capture, "rails")?, side)?, &nombres(&[0.0, nombre(g(c, "lat"))? / 1000.0, nombre(g(c, "vert"))? / 1000.0]))
    };
    let mut out: Vec<(f64, V)> = vec![];
    for l in &ls {
        for r in &rs {
            let gm = 1000.0 * distance_v(&pos("left", l)?, &pos("right", r)?)?;
            if !ariane_geometrie::jauge::admissible(ariane_geometrie::jauge::classify_mm(gm)) { continue; }
            let prod = nombre(g(l, "loss"))? * nombre(g(r, "loss"))?;
            out.push((prod, o(vec![("left", l.clone()), ("right", r.clone()), ("gaugeMm", n(gm)), ("prod", n(prod))])));
        }
    }
    trier_par(&mut out, |x| x.0)?;
    Ok(tab(out.into_iter().map(|x| x.1).collect()))
}
fn ecart(pp: &Paire, lat_vert: &[[f64; 2]; 2]) -> f64 {
    ariane_js::max(ariane_js::hypot(&[pp.l.lat - lat_vert[0][0], pp.l.vert - lat_vert[0][1]]), ariane_js::hypot(&[pp.r.lat - lat_vert[1][0], pp.r.vert - lat_vert[1][1]]))
}
fn lv(pp: &Paire) -> [[f64; 2]; 2] { [[pp.l.lat, pp.l.vert], [pp.r.lat, pp.r.vert]] }

/// `decider({capture, positions, R, science})` sans `ms` (posé par la façade).
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn decider(arg: &V, et: &Etat) -> R<V> {
    let arg = if matches!(arg, V::Indefini) { o(vec![]) } else { arg.clone() };
    if nullish(&arg) { return hd("déstructuration de null"); }
    let (capture, positions, rv, science) = (g(&arg, "capture"), g(&arg, "positions"), g(&arg, "R"), g(&arg, "science"));
    let mode = if vrai(rv) { let m = g(rv, "mode"); if vrai(m) { m.clone() } else { nul() } } else { nul() };
    let base = [("version", s(VERSION)), ("etat", s("garde")), ("motif", nul()), ("mode", mode), ("paireLot", nul()), ("meilleure", nul()), ("concurrente", nul()), ("positions", nul()),
        ("cellules", o(vec![("left", n(0.0)), ("right", n(0.0)), ("relances", n(0.0))])), ("nPaires", n(0.0))];
    let fin_ = |t: Vec<(&str, V)>| -> V { let mut e: Vec<(String, V)> = base.iter().map(|(k, v)| ((*k).to_owned(), v.clone())).collect(); for (k, v) in t { definir(&mut e, k, v); } V::Objet(e) };
    if !vrai(rv) || matches!(g(rv, "ok"), V::Booleen(false)) || !matches!(g(rv, "actif"), V::Booleen(true)) { return Ok(fin_(vec![("motif", s("reglage-eteint"))])); }
    if !capture_prete(capture) || !vrai(positions) || !SIDES.iter().all(|side| est_tableau(g(positions, side))) { return Ok(fin_(vec![("motif", s("entree-illisible"))])); }
    let mut pose = [[0.0; 2]; 2];
    for (k, side) in SIDES.iter().enumerate() {
        let Some(d) = decalage(g(g(capture, "rails"), side), g(positions, side))? else { return Ok(fin_(vec![("motif", s("entree-illisible"))])) };
        if let Some(x) = pose.get_mut(k) { *x = [d[1], d[2]]; }
    }
    let cells = cellules_r(capture, rv, science, et)?;
    let pp = paires_r(capture, &cells, rv)?;
    let cel = o(vec![("left", n(cells.cells[0].len() as f64)), ("right", n(cells.cells[1].len() as f64)), ("relances", n(cells.relances)), ("grainesSautees", n(cells.sautees))]);
    let np = n(pp.len() as f64);
    let Some(best) = pp.first() else { return Ok(fin_(vec![("cellules", cel), ("nPaires", np), ("etat", s("garde")), ("motif", s("aucune-paire-forte"))])) };
    let pres = nombre(p(rv, "presMm")?)?;
    let lot_i = pp.iter().position(|x| ecart(x, &pose) <= pres);
    let res = |t: Vec<(&str, V)>| -> V {
        let mut v = vec![("cellules", cel.clone()), ("nPaires", np.clone()), ("paireLot", lot_i.and_then(|i| pp.get(i)).map_or_else(nul, Paire::valeur)), ("meilleure", best.valeur())];
        v.extend(t);
        fin_(v)
    };
    let (st, sf) = (nombre(g(rv, "soutienTop"))?, nombre(g(rv, "soutienFace"))?);
    let soutenue = |x: &Paire| -> R<bool> { Ok(ariane_js::min(nombre(&x.l.top)?, nombre(&x.r.top)?) >= st && ariane_js::min(nombre(&x.l.face)?, nombre(&x.r.face)?) >= sf) };
    let (loin, rapport) = (nombre(g(rv, "loinMm"))?, nombre(g(rv, "rapport"))?);
    let regle_differer = || -> R<V> {
        let Some(li) = lot_i else {
            if vrai(g(rv, "sansPaireLoin")) && ecart(best, &pose) <= loin { return Ok(res(vec![("etat", s("garde")), ("motif", s("pose-sans-paire-forte-proche"))])); }
            if !soutenue(best)? { return Ok(res(vec![("etat", s("garde")), ("motif", s("pose-sans-paire-forte-pauvre"))])); }
            return Ok(res(vec![("etat", s("differer")), ("motif", s("pose-sans-paire-forte"))]));
        };
        let lp = pp.get(li).map_or(f64::NAN, |x| x.prod);
        for (i, x) in pp.iter().enumerate() {
            if i != li && ecart(x, &pose) > loin && x.prod <= rapport * lp && soutenue(x)? { return Ok(res(vec![("etat", s("differer")), ("motif", s("concurrence")), ("concurrente", x.valeur())])); }
        }
        Ok(res(vec![("etat", s("garde")), ("motif", s("pose-unique"))]))
    };
    let m = g(rv, "mode");
    if est(m, "differer") { return regle_differer(); }
    let remplacement = || -> R<V> {
        let positions = o(vec![("left", position_de(capture, "left", &best.l)?), ("right", position_de(capture, "right", &best.r)?)]);
        Ok(res(vec![("etat", s("remplacer")), ("motif", s(if est(m, "choisir") { "meilleure-loin" } else { "meilleure-unique" })), ("positions", positions)]))
    };
    let bv = lv(best);
    let second = pp.iter().skip(1).find(|x| ecart(x, &bv) > loin);
    if est(m, "choisir-sur") {
        let lot_ok = match lot_i.and_then(|i| pp.get(i)) { None => true, Some(l) => l.prod >= rapport * best.prod };
        if ecart(best, &pose) > loin && soutenue(best)? && lot_ok && second.is_none_or(|x| x.prod >= rapport * best.prod) { return remplacement(); }
        return regle_differer();
    }
    if ecart(best, &pose) <= loin { return Ok(res(vec![("etat", s("garde")), ("motif", s("meilleure-proche"))])); }
    if let Some(x) = second { if x.prod < rapport * best.prod { return Ok(res(vec![("etat", s("differer")), ("motif", s("ambigu")), ("concurrente", x.valeur())])); } }
    remplacement()
}

/// `Number(v.toPrecision(4))` : 4 chiffres significatifs, égalité exacte vers le plus grand (ECMA-262), relu en double.
pub(crate) fn sig4(x: f64) -> V {
    if !x.is_finite() { return nul(); }
    if x == 0.0 { return n(0.0); }
    let a = x.abs();
    let exact = format!("{a:.1100e}");
    let Some((m, e)) = exact.split_once('e') else { return nul() };
    let Ok(e) = e.parse::<i32>() else { return nul() };
    let chiffres: Vec<u8> = m.bytes().filter(u8::is_ascii_digit).map(|c| c - b'0').collect();
    let (tete, reste) = chiffres.split_at(chiffres.len().min(4));
    let mut t: u32 = tete.iter().fold(0, |acc, d| acc * 10 + u32::from(*d));
    // au-delà du milieu, ou au milieu exact (égalité : le plus grand n) : vers le haut
    let sup = reste.first().is_some_and(|d| *d >= 5);
    if sup { t += 1; }
    let txt = format!("{}{t}e{}", if x < 0.0 { "-" } else { "" }, e - 3);
    txt.parse::<f64>().map_or_else(|_| nul(), n)
}
fn paire_mm(v: &V) -> R<V> {
    if !vrai(v) { return Ok(nul()); }
    let (l, r) = (p(v, "left")?, p(v, "right")?);
    Ok(o(vec![("left", tab(vec![r1(p(l, "lat")?), r1(g(l, "vert"))])), ("right", tab(vec![r1(p(r, "lat")?), r1(g(r, "vert"))])), ("gaugeMm", r1(g(v, "gaugeMm"))),
        ("prod", match g(v, "prod") { V::Nombre(x) => sig4(*x), _ => nul() }), ("top", tab(vec![g(l, "top").clone(), g(r, "top").clone()])), ("face", tab(vec![g(l, "face").clone(), g(r, "face").clone()]))]))
}

/// `resumer(d)`.
///
/// # Errors
/// `HorsDomaine`.
pub fn resumer(d: &V) -> R<V> {
    if !vrai(d) { return Ok(nul()); }
    let mut out = vec![("version", g(d, "version").clone()), ("etat", g(d, "etat").clone()), ("motif", g(d, "motif").clone()), ("mode", g(d, "mode").clone()), ("ms", g(d, "ms").clone()),
        ("cellules", g(d, "cellules").clone()), ("nPaires", g(d, "nPaires").clone()), ("paireLot", paire_mm(g(d, "paireLot"))?), ("meilleure", paire_mm(g(d, "meilleure"))?),
        ("concurrente", paire_mm(g(d, "concurrente"))?)];
    let (pl, me) = (g(d, "paireLot"), g(d, "meilleure"));
    if vrai(pl) && vrai(me) { out.push(("rapportMeilleure", sig4(nombre(g(me, "prod"))? / nombre(g(pl, "prod"))?))); }
    Ok(o(out))
}

/// Aiguillage `{f, a, etat}` du module (l'état du module GCV1 pour le moteur gelé).
///
/// # Errors
/// `Js` ou `HorsDomaine`, comme les fonctions portées.
pub fn appeler(a: &Appel, entree: &V) -> R<V> {
    let et = || lot::etat_globaux(entree).map(|x| x.0);
    match a.f.as_str() {
        "reglage" => reglage(a.arg(0), a.arg(1)),
        "graines" => Ok(nombres(&graines(a.arg(0))?)),
        "grainesUtiles" => Ok(crate::js::tab_n(&graines_utiles(a.arg(0), a.arg(1))?)),
        "grainesPics" => Ok(crate::js::tab_n(&graines_pics(a.arg(0), a.arg(1))?)),
        "decalage" => Ok(decalage(a.arg(0), a.arg(1))?.map_or_else(nul, |x| nombres(&x))),
        "relance" => {
            let lat = match a.arg(1) { V::Nombre(x) => *x, _ => return hd("graine non numérique") };
            Ok(match relance(a.arg(0), lat, a.arg(2), &et()?)? {
                None => nul(),
                Some(r) => o(vec![("left", tab(r[0].iter().map(Cellule::valeur).collect())), ("right", tab(r[1].iter().map(Cellule::valeur).collect()))]),
            })
        }
        "cellules" => Ok(cellules_v(&cellules_r(a.arg(0), a.arg(1), a.arg(2), &et()?)?)),
        "paires" => paires_v(a.arg(0), a.arg(1), a.arg(2)),
        "decider" => decider(a.arg(0), &et()?),
        "resumer" => resumer(a.arg(0)),
        _ => hd("recherche-large : fonction non portée"),
    }
}
