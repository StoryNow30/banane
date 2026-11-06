//! `src/lot-decision.js` : décision sur le lot (`decideCut`) et ses aides pures, à l'identique.
//! Reste en JS : `commandRails` (appelle `expectedPoses`, fonction du moteur), la mémoire des appuis (`rememberAnchor`, `holdAnchor`,
//! `promoteAnchors` : tenue de listes), `viewCameras`/`inView`. Les réglages globaux lus par le module (`BananeSettings.releves.flushPct`,
//! `ombreVerticaleRefusee`, `fauxVertOmbre`, `hauteurApprise`, `conventionPlafond`) et l'état du module GCV1 (`Shadow.state()`)
//! sont résolus par la façade au moment de l'appel et passés en entrée.
use crate::aides::{self, Prediction, SIDES};
use crate::critere::vers_nombre;
use crate::crossing;
use crate::js::*;
use crate::shadow::{self, Etat};
use ariane_geometrie::{convention, gcv1, jauge};
use ariane_js::Echec;
use ariane_vba::Valeur as V;

pub fn defaults() -> V {
    o(vec![("version", s("lot-decision-v7")), ("lowGaugeGuardMm", n(1420.0)), ("gap", n(3.0)), ("anchors", n(2.0)), ("guardMm", n(30.0)), ("chooseMm", n(15.0)),
        ("maxDzMm", n(20.0)), ("minTop", n(5.0)), ("minFace", n(3.0)), ("chainMm", n(15.0)), ("pairGuard", b(true)), ("gaugeGuardMm", n(20.0)), ("gaugeGap", n(10.0)),
        ("gaugeCount", n(3.0)), ("gaugeChoice", b(false)), ("gaugeTargetStudy", b(false)), ("anchorRule", s("placed")), ("crossing", b(true)), ("crossingVoieMm", n(10.0)),
        ("framed", b(true)), ("frameGap", n(8.0)), ("frameAnchors", n(3.0)), ("validatedWindow", n(5.0)), ("validatedToleranceMm", n(8.0)), ("validatedMinInliers", n(3.0)),
        ("eligibleMotifs", tab_s(&["ambiguity", "gauge-out-of-contract", "flank", "minTop", "slope", "window"])), ("maxCandidates", n(6.0))])
}

/// Réglages globaux (`globalThis.BananeSettings`) lus par le module, résolus par la façade.
pub struct Globaux { pub flush_pct: V, pub ombre_verticale: V, pub faux_vert: V, pub hauteur: V }

struct Ctx<'a> { cfg: V, et: &'a Etat }
impl Ctx<'_> {
    fn c(&self, k: &str) -> &V { g(&self.cfg, k) }
    fn f(&self, k: &str) -> R<f64> { vers_nombre(self.c(k)) }
}

// ---------------------------------------------------------------- voisins et voie
fn same_track(a: &V, b_: &V) -> R<bool> {
    if !vrai(a) || !vrai(b_) { return Ok(false); }
    if !strict_egal(g(a, "part"), g(b_, "part"))? { return Ok(false); }
    let fa = match g(a, "frameId") { x if nullish(x) => nul(), x => x.clone() };
    let fb = match g(b_, "frameId") { x if nullish(x) => nul(), x => x.clone() };
    strict_egal(&fa, &fb)
}
fn ident<'a>(a: &'a V) -> R<&'a V> { p(a, "identity") }
fn cut_de(id: &V) -> R<V> { Ok(p(id, "cut")?.clone()) }
fn ecart_cut(a: &V, identity: &V) -> R<f64> { Ok((vers_nombre(&cut_de(ident(a)?)?)? - vers_nombre(&cut_de(identity)?)?).abs()) }
fn liste(v: &V) -> R<Vec<V>> {
    if !vrai(v) { return Ok(vec![]); }
    if !est_tableau(v) { return hd("liste non tableau"); }
    Ok(presents(v))
}
/// Tri stable par |Δcut| puis `slice(0, k)`.
fn plus_proches(mut l: Vec<V>, identity: &V, k: &V) -> R<Vec<V>> {
    let mut cles = vec![];
    for a in &l { let d = ecart_cut(a, identity)?; if d.is_nan() { return hd("cut non numérique"); } cles.push(d); }
    let mut idx: Vec<usize> = (0..l.len()).collect();
    idx.sort_by(|i, j| cles[*i].partial_cmp(&cles[*j]).unwrap());
    // `slice(0, undefined)` garde tout (CH-068)
    let fin = if matches!(k, V::Indefini) { l.len() } else { slice_debut(l.len(), vers_nombre(k)?) };
    let mut out = vec![];
    for i in idx.into_iter().take(fin) { out.push(std::mem::replace(&mut l[i], V::Indefini)); }
    Ok(out)
}
fn meme_voie_autre_cut(a: &V, identity: &V, fenetre: f64) -> R<bool> {
    let id = ident(a)?;
    if !same_track(id, identity)? { return Ok(false); }
    if strict_egal(&cut_de(id)?, &cut_de(identity)?)? { return Ok(false); }
    Ok(ecart_cut(a, identity)? <= fenetre)
}
fn neighbours(identity: &V, anchors: &[V], cx: &Ctx) -> R<Vec<V>> {
    let mut l = vec![];
    for a in anchors { if meme_voie_autre_cut(a, identity, cx.f("gap")?)? { l.push(a.clone()); } }
    plus_proches(l, identity, cx.c("anchors"))
}
fn framed_neighbours(identity: &V, anchors: &[V], cx: &Ctx) -> R<Option<Vec<V>>> {
    let mut same = vec![];
    for a in anchors { if meme_voie_autre_cut(a, identity, cx.f("frameGap")?)? { same.push(a.clone()); } }
    let c0 = vers_nombre(&cut_de(identity)?)?;
    let (mut av, mut ap) = (vec![], vec![]);
    for a in same { let c = vers_nombre(&cut_de(ident(&a)?)?)?; if c < c0 { av.push(a); } else if c > c0 { ap.push(a); } }
    let before = plus_proches(av, identity, cx.c("frameAnchors"))?;
    let after = plus_proches(ap, identity, cx.c("frameAnchors"))?;
    Ok(if vrai(cx.c("framed")) && !before.is_empty() && !after.is_empty() { Some([before, after].concat()) } else { None })
}
fn fit_framed(p_: &[[f64; 2]]) -> Option<f64> {
    let nn = p_.len();
    if nn < 4 { return None; }
    let sk = |k: f64| p_.iter().fold(0.0, |t, [x, _]| t + pow(*x, k));
    let tk = |k: f64| p_.iter().fold(0.0, |t, [x, y]| t + y * pow(*x, k));
    let a = [[nn as f64, sk(1.0), sk(2.0)], [sk(1.0), sk(2.0), sk(3.0)], [sk(2.0), sk(3.0), sk(4.0)]];
    let bv = [tk(0.0), tk(1.0), tk(2.0)];
    let det = |m: &[[f64; 3]; 3]| m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    let d = det(&a);
    if d.abs() < 1e-18 { return None; }
    Some(det(&[[bv[0], a[0][1], a[0][2]], [bv[1], a[1][1], a[1][2]], [bv[2], a[2][1], a[2][2]]]) / d)
}
struct Pred { list: Vec<V>, framed: bool, cuts: Vec<V> }
fn predict_de(initial: &V, pred: &Pred, side: &str) -> R<Prediction> {
    if pred.framed {
        let (o_, q) = aides::locaux(initial, &pred.list, side)?;
        let two = q.iter().filter(|p_| p_[0] < 0.0).count() >= 2 && q.iter().filter(|p_| p_[0] > 0.0).count() >= 2;
        let lateral = if two { fit_framed(&q.iter().map(|p_| [p_[0], p_[1]]).collect::<Vec<_>>()) } else { None };
        let vertical = if two { fit_framed(&q.iter().map(|p_| [p_[0], p_[2]]).collect::<Vec<_>>()) } else { None };
        if let (Some(la), Some(ve)) = (lateral, vertical) { return Ok(Prediction { lateral: la, vertical: ve, translation: aides::translation_de(initial, o_, la, ve)? }); }
    }
    aides::predict(initial, &pred.list, side)
}
/// CH-068 : `L.predictFramed(initial, anchors, side)`.
pub(crate) fn predict_framed(initial: &V, anchors: &[V], side: &str) -> R<Prediction> { predict_de(initial, &Pred { list: anchors.to_vec(), framed: true, cuts: vec![] }, side) }
/// `r.next.status==='candidate'` d'un rail `ok` : `next` absent fait lever le JS (TypeError de V8) : hors domaine (CH-068).
fn statut_candidat(r: &V) -> R<bool> {
    let nx = g(r, "next");
    if nullish(nx) { return hd("rail sans next (le JS lève)"); }
    Ok(matches!(g(nx, "status"), V::Chaine(c) if c == "candidate"))
}
fn rail<'a>(rails: &'a V, side: &str) -> R<&'a V> { p(rails, side) }
fn deviation_mm(rails: &V, pred: &Pred, positions: &V) -> R<f64> {
    let mut m = f64::NEG_INFINITY;
    for side in SIDES {
        let init = rail(rails, side)?;
        let mm = p(init, "sceneRelativeToProfileLocal")?;
        let o_ = point_v(mm, g(init, "positionSceneRelative"))?;
        let pr = predict_de(init, pred, side)?;
        let q = point_v(mm, p(positions, side)?)?;
        m = ariane_js::max(m, ((q[1] - o_[1] - pr.lateral) * 1000.0).abs());
    }
    Ok(m)
}
pub(crate) fn position_of(rail_: &V, delta: &V) -> R<V> {
    let pm = p(rail_, "profileLocalToSceneRelative")?;
    let w = point_v(pm, delta)?;
    let o_ = point_v(pm, &tab_n(&[0.0, 0.0, 0.0]))?;
    let pos = g(rail_, "positionSceneRelative");
    let Some(t) = elems(pos) else { return hd("positionSceneRelative non tableau") };
    let mut out = vec![];
    for (i, v) in t.iter().enumerate() {
        out.push(match v { None => None, Some(v) => Some(n(vers_nombre(v)? + w.get(i).copied().unwrap_or(f64::NAN) - o_.get(i).copied().unwrap_or(f64::NAN))) });
    }
    Ok(canon(&V::Tableau(out)))
}
fn positions_de(rails: &V, deltas: [&V; 2]) -> R<V> { Ok(o(vec![("left", position_of(rail(rails, "left")?, deltas[0])?), ("right", position_of(rail(rails, "right")?, deltas[1])?)])) }
fn gauge_of(positions: &V) -> R<f64> { Ok(distance_v(p(positions, "left")?, p(positions, "right")?)? * 1000.0) }
fn pair_gap_mm(rails: &V, a: &V, b_: &V) -> R<f64> {
    let mut m = f64::NEG_INFINITY;
    for side in SIDES {
        let mm = p(rail(rails, side)?, "sceneRelativeToProfileLocal")?;
        let pa = point_v(mm, p(a, side)?)?;
        let qb = point_v(mm, p(b_, side)?)?;
        m = ariane_js::max(m, ((pa[1] - qb[1]) * 1000.0).abs());
    }
    Ok(m)
}
fn minimal_capture(capture: &V, rails: V) -> V {
    o(vec![("format", s("banane-lot-decision-input-v1")), ("identity", match g(capture, "identity") { x if nullish(x) => nul(), x => x.clone() }), ("rails", rails),
        ("pointsSceneRelative", g(capture, "pointsSceneRelative").clone()), ("visibleByClipBoxes", g(capture, "visibleByClipBoxes").clone())])
}
fn seeded_rails(rails: &V, pred: &Pred) -> R<V> {
    let mut t = vec![];
    for side in SIDES { let r = rail(rails, side)?; let pr = predict_de(r, pred, side)?; t.push((side, aides::translated(r, pr.translation)?)); }
    Ok(o(t))
}
/// Points visibles (`pts.filter((_,i)=>vis[i]===true)`).
fn visibles(capture: &V) -> R<V> {
    let vis = g(capture, "visibleByClipBoxes");
    let pts = g(capture, "pointsSceneRelative");
    if !est_tableau(vis) { return Ok(pts.clone()); }
    if !est_tableau(pts) { return hd("points non tableau"); }
    Ok(match pts {
        V::Bloc { k, donnees } => {
            let k = *k as usize;
            let d: Vec<f64> = donnees.chunks_exact(k).enumerate().filter(|(i, _)| matches!(elem(vis, *i), V::Booleen(true))).flat_map(|(_, c)| c.iter().copied()).collect();
            if d.is_empty() { V::Tableau(vec![]) } else { V::Bloc { k: k as u8, donnees: d } }
        }
        t => V::Tableau(elems(t).unwrap().into_iter().enumerate().filter(|(i, e)| e.is_some() && matches!(elem(vis, *i), V::Booleen(true))).map(|(_, e)| e).collect()),
    })
}
fn crossing_read(capture: &V, cx: &Ctx) -> R<Option<V>> {
    if !vrai(cx.c("crossing")) { return Ok(None); }
    if nullish(capture) { return hd("capture absente"); }
    Ok(Some(crossing::read(g(capture, "rails"), &visibles(capture)?, &crossing::DEFAUT)?))
}

// ---------------------------------------------------------------- choix d'un minimum de la grille
struct Cand { rank: f64, u_mm: V, z_mm: V, loss: f64, top: f64, face: f64, delta: [f64; 3] }
impl Cand {
    fn valeur(&self, avec_delta: bool) -> V {
        let mut t = vec![("rank", n(self.rank)), ("uMm", self.u_mm.clone()), ("zMm", self.z_mm.clone()), ("loss", n(self.loss)), ("top", n(self.top)), ("face", n(self.face))];
        if avec_delta { t.push(("delta", tab_n(&self.delta))); }
        o(t)
    }
    fn u(&self) -> f64 { num(&self.u_mm).unwrap_or(0.0) }
    fn z(&self) -> f64 { num(&self.z_mm).unwrap_or(0.0) }
}
fn grid_of(capture: &V, side: &str, u_seed: &V) -> R<Option<Vec<[f64; 3]>>> {
    let lab = o(vec![("uSeeds", tab(vec![u_seed.clone()])), ("replaceOrigin", b(false)), ("recenterWindow", b(true)), ("partialFaceKeep", b(true)), ("onCoarse", s(gcv1::RAPPEL))]);
    let mut appels = vec![];
    gcv1::propose(capture, side, &canon(&o(vec![("lab", lab)])), &mut appels)?;
    Ok(appels.last().map(|a| a.cellules.chunks_exact(3).map(|c| [c[0], c[1], c[2]]).collect()))
}
fn local_minima(grid: &[[f64; 3]], sep: f64) -> Vec<[f64; 3]> {
    let mut m = vec![];
    for (i, c) in grid.iter().enumerate() {
        let mut lowest = true;
        for (j, o_) in grid.iter().enumerate() {
            if i == j || ariane_js::hypot(&[o_[0] - c[0], o_[1] - c[1]]) >= sep { continue; }
            if o_[2] < c[2] { lowest = false; break; }
        }
        if lowest { m.push(*c); }
    }
    m.sort_by(|a, b_| { let d = a[2] - b_[2]; if d < 0.0 { std::cmp::Ordering::Less } else if d > 0.0 { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal } });
    m
}
fn candidates_of(capture: &V, side: &str, science: &V) -> R<Option<Vec<Cand>>> {
    let r = science_rail(science, side);
    if !vrai(if nullish(r) { &INDEF } else { g(r, "ok") }) { return Ok(Some(vec![])); }
    let fr = p(r, "frame")?;
    let sign = vers_nombre(g(fr, "sign"))?;
    let Some(grid) = grid_of(capture, side, g(fr, "uSeed"))? else { return Ok(None) };
    let mut out = vec![];
    for (rank, m) in local_minima(&grid, 0.02).into_iter().take(24).enumerate() {
        let delta = [0.0, sign * m[0], m[1]];
        let bd = convention::band_offsets_valeur(capture, side, &tab_n(&delta), &o(vec![]))?;
        let ok = vrai(g(&bd, "ok"));
        out.push(Cand { rank: rank as f64, u_mm: r1v(m[0] * 1000.0), z_mm: r1v(m[1] * 1000.0), loss: m[2],
            top: if ok { longueur(g(&bd, "top")).unwrap_or(0) as f64 } else { 0.0 }, face: if ok { longueur(g(&bd, "face")).unwrap_or(0) as f64 } else { 0.0 }, delta });
    }
    Ok(Some(out))
}
fn science_rail<'a>(science: &'a V, side: &str) -> &'a V { let r = if nullish(science) { &INDEF } else { g(science, "rails") }; if nullish(r) { &INDEF } else { g(r, side) } }
fn qualifie(c: &Cand, cx: &Ctx) -> R<bool> {
    Ok(c.top >= cx.f("minTop")? && c.face >= cx.f("minFace")? && c.z().abs() <= cx.f("maxDzMm")? && c.u().abs() <= cx.f("chooseMm")?)
}
fn calibre(capture: &V, side: &str, delta: &[f64; 3], cx: &Ctx) -> R<V> {
    let cal = convention::calibrate(capture, side, &tab_n(delta), &V::Indefini, &cx.et.plafond)?;
    Ok(if vrai(g(&cal, "applied")) { g(&cal, "delta").clone() } else { tab_n(delta) })
}
enum Choix { Non(&'static str), Oui { delta: V, from: f64, rank: f64, top: f64, face: f64, ratio: V } }
fn choose_rail(capture: &V, side: &str, science: &V, cx: &Ctx, cands: &Option<Vec<Cand>>) -> R<Choix> {
    let r = science_rail(science, side);
    if !vrai(if nullish(r) { &INDEF } else { g(r, "ok") }) { return Ok(Choix::Non("frame")); }
    let Some(cs) = cands else { return Ok(Choix::Non("grid-unavailable")) };
    let mut near = vec![];
    for c in cs { if qualifie(c, cx)? { near.push(c); } }
    if near.is_empty() { return Ok(Choix::Non("no-qualified-minimum-near-prediction")); }
    if near.len() > 1 { return Ok(Choix::Non("several-minima-near-prediction")); }
    let pk = near[0];
    let ratio = match cs.first() { Some(c0) if c0.loss != 0.0 && !c0.loss.is_nan() => r1v(pk.loss / c0.loss), _ => nul() };
    Ok(Choix::Oui { delta: calibre(capture, side, &pk.delta, cx)?, from: pk.u().abs(), rank: pk.rank, top: pk.top, face: pk.face, ratio })
}
fn journal(cands: &Option<Vec<Cand>>) -> V {
    let Some(cs) = cands else { return tab(vec![]) };
    tab(cs.iter().take(6).map(|c| { let mut v = c.valeur(false); definir_v(&mut v, "loss", if c.loss.is_finite() { n(ariane_js::round(c.loss * 1e6) / 1e6) } else { nul() }); v }).collect())
}

// ---------------------------------------------------------------- écartement voisin
struct Ref { mm: f64, cuts: Vec<V> }
fn gauge_reference(identity: &V, anchors: &[V], cx: &Ctx) -> R<Option<Ref>> {
    let mut l = vec![];
    for a in anchors {
        if !meme_voie_autre_cut(a, identity, cx.f("gaugeGap")?)? { continue; }
        let pz = g(a, "positions");
        if nullish(pz) || !vrai(g(pz, "left")) || !vrai(g(pz, "right")) { continue; }
        l.push(a.clone());
    }
    let near = plus_proches(l, identity, cx.c("gaugeCount"))?;
    if near.is_empty() { return Ok(None); }
    let mut gs = vec![];
    for a in &near { let x = gauge_of(g(a, "positions"))?; if x.is_nan() { return hd("écartement NaN"); } gs.push(x); }
    ariane_js::trier_nombres(&mut gs);
    let m = gs.len() >> 1;
    let mm = if gs.len() % 2 == 1 { gs[m] } else { (gs[m - 1] + gs[m]) / 2.0 };
    let mut cuts = vec![];
    for a in &near { cuts.push(cut_de(ident(a)?)?); }
    Ok(Some(Ref { mm, cuts }))
}
fn gauge_jump(r: &Option<Ref>, positions: &V) -> R<Option<f64>> { match r { Some(r) => Ok(Some((gauge_of(positions)? - r.mm).abs())), None => Ok(None) } }
fn suspect(r: &Option<Ref>, positions: &V, cx: &Ctx) -> R<bool> {
    if r.is_none() { return Ok(false); }
    Ok(gauge_jump(r, positions)?.unwrap() > cx.f("gaugeGuardMm")?)
}
fn pair_flagged(science: &V) -> bool {
    let rr = |side: &str| science_rail(science, side);
    let changed = SIDES.iter().any(|s_| { let r = rr(s_); let nx = if nullish(r) { &INDEF } else { g(r, "next") }; !nullish(nx) && matches!(g(nx, "changed"), V::Booleen(true)) });
    changed && SIDES.iter().any(|s_| { let r = rr(s_); let c = if nullish(r) { &INDEF } else { g(r, "conventionCalibration") }; !nullish(c) && matches!(g(c, "reason"), V::Chaine(x) if x == "shift-out-of-domain") })
}

// ---------------------------------------------------------------- voisins validés (D-054)
fn local_mm(rail_: &V, pp: &V) -> R<[f64; 3]> {
    let m = g(rail_, "sceneRelativeToProfileLocal");
    let a = point_v(m, pp)?;
    let o_ = point_v(m, g(rail_, "positionSceneRelative"))?;
    Ok([(a[0] - o_[0]) * 1000.0, (a[1] - o_[1]) * 1000.0, (a[2] - o_[2]) * 1000.0])
}
fn consistent_validated(identity: &V, rails: &V, validated: &[V], cx: &Ctx) -> R<Vec<V>> {
    let mut cands = vec![];
    for a in validated {
        let id = if nullish(a) { &INDEF } else { g(a, "identity") };
        let part = if nullish(id) { &INDEF } else { g(id, "part") };
        if !strict_egal(part, p(identity, "part")?)? { continue; }
        if nullish(id) { return hd("identité absente"); }
        let fa = match g(id, "frameId") { x if nullish(x) => nul(), x => x.clone() };
        let fb = match g(identity, "frameId") { x if nullish(x) => nul(), x => x.clone() };
        if !strict_egal(&fa, &fb)? { continue; }
        if strict_egal(g(id, "cut"), g(identity, "cut"))? { continue; }
        if !((vers_nombre(g(id, "cut"))? - vers_nombre(g(identity, "cut"))?).abs() <= cx.f("validatedWindow")?) { continue; }
        let pz = g(a, "positions");
        if !SIDES.iter().all(|s_| !nullish(pz) && est_tableau(g(pz, s_))) { continue; }
        cands.push(a.clone());
    }
    if (cands.len() as f64) < cx.f("validatedMinInliers")? { return Ok(vec![]); }
    let mut pts = vec![];
    for a in &cands { let pz = g(a, "positions"); pts.push([local_mm(rail(rails, "left")?, g(pz, "left"))?, local_mm(rail(rails, "right")?, g(pz, "right"))?]); }
    let tol = cx.f("validatedToleranceMm")?;
    let (mut best, mut best_res): (Vec<usize>, f64) = (vec![], f64::INFINITY);
    for i in 0..cands.len() { for j in i + 1..cands.len() {
        let mut inl = vec![];
        let mut residual = 0.0;
        for k in 0..cands.len() {
            let (mut ok, mut r) = (true, 0.0);
            for s_ in 0..2 { for axis in [1, 2] {
                let (a, bb, c) = (pts[i][s_], pts[j][s_], pts[k][s_]);
                let dx = bb[0] - a[0];
                let at = if dx.abs() < 1e-9 { a[axis] } else { a[axis] + (bb[axis] - a[axis]) * (c[0] - a[0]) / dx };
                let e = (c[axis] - at).abs();
                r += e;
                if e > tol { ok = false; }
            } }
            if ok { inl.push(k); residual += r; }
        }
        if inl.len() > best.len() || inl.len() == best.len() && residual < best_res { best = inl; best_res = residual; }
    } }
    Ok(if best.len() as f64 >= cx.f("validatedMinInliers")? { best.into_iter().map(|k| cands[k].clone()).collect() } else { vec![] })
}

// ---------------------------------------------------------------- décision
fn avec(base: &[(String, V)], t: Vec<(&str, V)>) -> V { let mut e = base.to_vec(); for (k, v) in t { definir(&mut e, k, v); } V::Objet(e) }

#[allow(clippy::too_many_arguments)]
fn crossing_fallback(d: V, rails: &V, positions: &V, pred: &Pred, gref: &Option<Ref>, cx: &Ctx) -> R<V> {
    let mut deltas = vec![];
    for side in SIDES {
        let r = rail(rails, side)?;
        let m = p(r, "sceneRelativeToProfileLocal")?;
        let q = point_v(m, p(positions, side)?)?;
        let o_ = point_v(m, g(r, "positionSceneRelative"))?;
        deltas.push((side, tab_n(&[q[0] - o_[0], q[1] - o_[1], q[2] - o_[2]])));
    }
    let pair = jauge::assess_pair(rails, &o(deltas))?;
    let pm = num(g(&pair, "predictedMm")).unwrap_or(f64::NAN);
    let lc = g(&d, "levelCrossing").clone();
    let refuse = |reason: &str| -> R<V> { let mut l = vec![]; etaler(&mut l, &lc)?; definir(&mut l, "refused", s(reason)); definir(&mut l, "gaugeMm", r1v(pm)); let mut e = vec![]; etaler(&mut e, &d)?; definir(&mut e, "levelCrossing", V::Objet(l)); Ok(V::Objet(e)) };
    if !vrai(g(&pair, "admissible")) { return refuse(&format!("gauge-{}", chaine(g(&pair, "gaugeClass"))?)); }
    if suspect(gref, positions, cx)? { return refuse("gauge-guard"); }
    let mut dev: Option<f64> = None;
    if !pred.list.is_empty() {
        let dv = deviation_mm(rails, pred, positions)?;
        dev = Some(dv);
        if dv > cx.f("crossingVoieMm")? {
            let r = refuse("voie")?;
            let mut l = vec![]; etaler(&mut l, &lc)?; definir(&mut l, "refused", s("voie")); definir(&mut l, "fromPredictionMm", r1v(dv));
            let V::Objet(mut e) = r else { unreachable!() };
            definir(&mut e, "levelCrossing", V::Objet(l));
            return Ok(V::Objet(e));
        }
    }
    let guard_def = vrai(g(&d, "guardDeferred"));
    let reason = g(&d, "reason").clone();
    let V::Objet(e) = d else { unreachable!() };
    let mut rest: Vec<(String, V)> = e.into_iter().filter(|(k, _)| !["reason", "candidates", "gaugeJumpMm", "windowGaugeJumpMm", "guardDeferred"].contains(&k.as_str())).collect();
    for (k, v) in [("stage", s("crossing")), ("deferredReason", reason), ("anchorsUsed", tab(pred.cuts.clone())), ("gaugeMm", r1v(pm)), ("fromPredictionMm", dev.map_or(nul(), r1v)),
        ("positions", positions.clone()), ("anchor", b(true))] { definir(&mut rest, k, v); }
    if guard_def { definir(&mut rest, "guardDeferred", b(true)); }
    Ok(V::Objet(rest))
}

pub fn decide_cut_base(capture: &V, science: &V, anchors_in: &V, validated: &V, options: &V, et: &Etat, gl: &Globaux) -> R<V> {
    decide_cut_base_r(capture, science, anchors_in, validated, options, et, gl, &mut None)
}
/// CH-068 : `decideCutBase` qui rend aussi, dans `relance`, le résultat de l'unique appel au moteur relancé
/// (`Shadow.scientificProposeBoth(seeded)`), comme l'enveloppe `moteur` de `voie-recentree.js` (`recentrer`) le capte.
#[allow(clippy::too_many_arguments)]
pub fn decide_cut_base_r(capture: &V, science: &V, anchors_in: &V, validated: &V, options: &V, et: &Etat, gl: &Globaux, relance: &mut Option<V>) -> R<V> {
    let mut cfg = vec![];
    etaler(&mut cfg, &defaults())?;
    etaler(&mut cfg, options)?;
    let cx = Ctx { cfg: V::Objet(cfg), et };
    if nullish(capture) { return hd("capture absente"); }
    let identity = g(capture, "identity");
    let rails = g(capture, "rails");
    let mut base: Vec<(String, V)> = vec![];
    for (k, v) in [("version", cx.c("version").clone()), ("pairGuard", b(vrai(cx.c("pairGuard")))), ("chainMm", cx.c("chainMm").clone()), ("gaugeGuardMm", cx.c("gaugeGuardMm").clone()),
        ("lowGaugeGuardMm", match cx.c("lowGaugeGuardMm") { x if nullish(x) => nul(), x => x.clone() }), ("minTop", cx.c("minTop").clone()), ("anchorRule", cx.c("anchorRule").clone()),
        ("crossing", b(vrai(cx.c("crossing")))), ("framed", b(vrai(cx.c("framed"))))] { definir(&mut base, k, v); }
    let mut anchors = liste(anchors_in)?;
    if !nullish(validated) && vrai(&n(match validated { V::Chaine(c) => c.len() as f64, x => longueur(x).map_or(f64::NAN, |l| l as f64) })) {
        let kept = consistent_validated(identity, rails, &liste(validated)?, &cx)?;
        let mut cuts = vec![];
        for a in &kept { cuts.push(cut_de(ident(a)?)?); }
        definir(&mut base, "validatedAnchors", tab(cuts.clone()));
        if !kept.is_empty() {
            let mut nouv: Vec<V> = kept.iter().map(|a| o(vec![("identity", g(a, "identity").clone()), ("positions", g(a, "positions").clone()), ("stage", s("validated"))])).collect();
            for a in anchors {
                let id = ident(&a)?;
                let vu = same_track(id, identity)? && { let c = cut_de(id)?; let mut t = false; for x in &cuts { if matches!((x, &c), (V::Nombre(p1), V::Nombre(p2)) if p1 == p2) || strict_egal(x, &c).unwrap_or(false) { t = true; } } t };
                if !vu { nouv.push(a); }
            }
            anchors = nouv;
        }
    }
    let mut tous = true;
    for s_ in SIDES { let r = science_rail(science, s_); if !(!nullish(r) && vrai(g(r, "ok")) && statut_candidat(r)?) { tous = false; break; } }
    let applicable = tous
        && { let sm = if nullish(science) { &INDEF } else { g(science, "summary") }; !(!nullish(sm) && vrai(g(sm, "pairGaugeRejected"))) };
    let nb = neighbours(identity, &anchors, &cx)?;
    let gref = if !nullish(cx.c("gaugeGuardMm")) { gauge_reference(identity, &anchors, &cx)? } else { None };
    if let Some(r) = &gref { definir(&mut base, "gaugeReference", o(vec![("mm", r1v(r.mm)), ("cuts", tab(r.cuts.clone()))])); }
    let rd = crossing_read(capture, &cx)?;
    let framed = framed_neighbours(identity, &anchors, &cx)?;
    let src = framed.clone().unwrap_or_else(|| nb.clone());
    let mut pcuts = vec![];
    for a in &src { pcuts.push(cut_de(ident(a)?)?); }
    let pred = Pred { list: src.iter().map(|a| o(vec![("positions", g(a, "positions").clone())])).collect(), framed: framed.is_some(), cuts: pcuts };
    let pn = rd.as_ref().filter(|r| vrai(g(r, "crossing"))).cloned();
    if !matches!(cx.c("flushPctChaqueCut"), V::Booleen(false)) && !matches!(gl.flush_pct, V::Booleen(false)) {
        if let Some(r) = &rd { definir(&mut base, "flushPct", if fini(g(r, "flushPct")) { g(r, "flushPct").clone() } else { nul() }); }
    }
    if pred.framed { definir(&mut base, "framedAnchors", tab(pred.cuts.clone())); }
    if let Some(r) = &pn {
        let mut l = vec![("flushPct", g(r, "flushPct").clone()), ("read", g(r, "ok").clone())];
        if !vrai(g(r, "ok")) { l.push(("reason", g(r, "reason").clone())); }
        definir(&mut base, "levelCrossing", o(l));
    }
    let nb_cuts = || -> R<V> { let mut t = vec![]; for a in &nb { t.push(cut_de(ident(a)?)?); } Ok(tab(t)) };
    let pn_ok = pn.as_ref().is_some_and(|r| vrai(g(r, "ok")));
    if applicable {
        let sr = |s_: &str| g(g(science_rail(science, s_), "next"), "delta");
        let positions = positions_de(rails, [sr("left"), sr("right")])?;
        let guard = if pred.list.is_empty() { None } else { Some(r1v(deviation_mm(rails, &pred, &positions)?)) };
        let guard_v = guard.clone().unwrap_or(V::Nul);
        if pn_ok {
            let e = r1v(pair_gap_mm(rails, &positions, g(pn.as_ref().unwrap(), "positions"))?);
            let mut lc = vec![]; etaler(&mut lc, &g_brut(&V::Objet(base.clone()), "levelCrossing").clone())?; definir(&mut lc, "engineMm", e);
            definir(&mut base, "levelCrossing", V::Objet(lc));
        }
        let sous = match &guard_v { V::Nul => true, V::Nombre(x) => *x <= cx.f("guardMm")?, _ => false };
        if sous {
            if vrai(cx.c("pairGuard")) && pair_flagged(science) {
                return Ok(avec(&base, vec![("stage", s("deferred")), ("reason", s("pair-guard")), ("pairGuarded", b(true)), ("guardMm", guard_v), ("anchorsUsed", nb_cuts()?), ("anchor", b(false))]));
            }
            if !suspect(&gref, &positions, &cx)? {
                let gg = gauge_of(&positions)?;
                if !nullish(cx.c("lowGaugeGuardMm")) && pred.list.is_empty() && gg < cx.f("lowGaugeGuardMm")? {
                    return Ok(avec(&base, vec![("stage", s("deferred")), ("reason", s("first-pass-low-gauge")), ("gaugeMm", r1v(gg)), ("guardMm", guard_v), ("anchorsUsed", tab(vec![])), ("anchor", b(false))]));
                }
                return Ok(avec(&base, vec![("stage", s("first-pass")), ("guardMm", guard_v), ("anchorsUsed", nb_cuts()?), ("positions", positions), ("anchor", b(true))]));
            }
            definir(&mut base, "gaugeJumpMm", r1v(gauge_jump(&gref, &positions)?.unwrap()));
        }
        definir(&mut base, "guardMm", guard_v);
        definir(&mut base, "guardDeferred", b(true));
    }
    let deferred = |d: V| -> R<V> {
        if pn_ok && !vrai(g(&d, "pairGuarded")) { crossing_fallback(d, rails, g(pn.as_ref().unwrap(), "positions"), &pred, &gref, &cx) } else { Ok(d) }
    };
    if pred.list.is_empty() {
        let raison = if nullish(g_brut(&V::Objet(base.clone()), "gaugeJumpMm")) { "no-anchor" } else { "gauge-guard" };
        return deferred(avec(&base, vec![("stage", s("deferred")), ("reason", s(raison))]));
    }
    let anchors_used = tab(pred.cuts.clone());
    let seeded = minimal_capture(capture, seeded_rails(rails, &pred)?);
    let again = shadow::scientific_propose_both(&seeded, et)?;
    *relance = Some(again.clone());
    let ar = |s_: &str| science_rail(&again, s_);
    let mut tous = true;
    for s_ in SIDES { let r = ar(s_); if !(!nullish(r) && vrai(g(r, "ok")) && statut_candidat(r)?) { tous = false; break; } }
    let again_ok = tous && !vrai(g(g(&again, "summary"), "pairGaugeRejected"));
    let srails = g(&seeded, "rails");
    if again_ok {
        let d1 = |s_: &str| -> R<f64> { Ok(vers_nombre(&gi(g(g(ar(s_), "next"), "delta"), 1)?)?.abs() * 1000.0) };
        let dev = ariane_js::max(d1("left")?, d1("right")?);
        if dev <= cx.f("guardMm")? {
            let positions = positions_de(srails, [g(g(ar("left"), "next"), "delta"), g(g(ar("right"), "next"), "delta")])?;
            if !suspect(&gref, &positions, &cx)? {
                return Ok(avec(&base, vec![("stage", s("window")), ("fromPredictionMm", r1v(dev)), ("anchorsUsed", anchors_used), ("positions", positions), ("anchor", b(dev <= cx.f("chainMm")?))]));
            }
            definir(&mut base, "windowGaugeJumpMm", r1v(gauge_jump(&gref, &positions)?.unwrap()));
        }
    }
    let mut deltas: [Option<V>; 2] = [None, None];
    let mut chosen: Vec<(&str, V)> = vec![];
    let mut why: Vec<String> = vec![];
    let mut candidates: Vec<(&str, V)> = vec![];
    let etude = vrai(cx.c("gaugeChoice")) || vrai(cx.c("gaugeTargetStudy"));
    for (i, side) in SIDES.iter().enumerate() {
        let r = ar(side);
        if nullish(r) || !vrai(g(r, "ok")) { why.push(format!("{side}:frame")); continue; }
        let next = g(r, "next");
        // `next.status` : un rail `ok` sans `next` fait lever le JS (CH-068)
        if nullish(next) { return hd("rail sans next (le JS lève)"); }
        let pg = g(r, "pairGauge");
        let before = if !nullish(pg) && vrai(g(pg, "rejected")) { let pb = g(pg, "publishedBeforeGate"); if nullish(pb) { V::Indefini } else { g(pb, "delta").clone() } } else { V::Nul };
        let own = if matches!(g(next, "status"), V::Chaine(c) if c == "candidate") { g(next, "delta").clone() } else { before };
        if vrai(&own) && vers_nombre(&gi(&own, 1)?)?.abs() * 1000.0 <= cx.f("chooseMm")? { deltas[i] = Some(own); continue; }
        let list = candidates_of(&seeded, side, &again)?;
        candidates.push((side, journal(&list)));
        let motif = g(next, "motif");
        if !(vrai(&own) || inclut(cx.c("eligibleMotifs"), motif)?) {
            why.push(format!("{side}:{}", chaine(if vrai(motif) { motif } else { g(next, "status") })?));
            continue;
        }
        let pick = choose_rail(&seeded, side, &again, &cx, &list)?;
        if etude { return hd("gaugeChoice / gaugeTargetStudy : étude non portée"); }
        match pick {
            Choix::Non(r) => { why.push(format!("{side}:{r}")); }
            Choix::Oui { delta, from, rank, top, face, ratio } => {
                deltas[i] = Some(delta);
                chosen.push((side, o(vec![("fromPredictionMm", n(from)), ("rank", n(rank)), ("top", n(top)), ("face", n(face)), ("lossRatio", ratio)])));
            }
        }
    }
    let cand_v = o(candidates);
    if !deltas.iter().all(|d| d.as_ref().is_some_and(vrai)) {
        return deferred(avec(&base, vec![("stage", s("deferred")), ("reason", s(&why.join(" "))), ("anchorsUsed", anchors_used), ("candidates", cand_v)]));
    }
    let dl = o(vec![("left", deltas[0].clone().unwrap()), ("right", deltas[1].clone().unwrap())]);
    let pair = jauge::assess_pair(srails, &canon(&dl))?;
    let pm = num(g(&pair, "predictedMm")).unwrap_or(f64::NAN);
    if !vrai(g(&pair, "admissible")) {
        return deferred(avec(&base, vec![("stage", s("deferred")), ("reason", s(&format!("gauge-{}", chaine(g(&pair, "gaugeClass"))?))), ("gaugeMm", r1v(pm)), ("anchorsUsed", anchors_used), ("candidates", cand_v)]));
    }
    let positions = positions_de(srails, [g(&dl, "left"), g(&dl, "right")])?;
    if suspect(&gref, &positions, &cx)? {
        return deferred(avec(&base, vec![("stage", s("deferred")), ("reason", s("gauge-guard")), ("gaugeJumpMm", r1v(gauge_jump(&gref, &positions)?.unwrap())), ("gaugeMm", r1v(pm)),
            ("anchorsUsed", anchors_used), ("candidates", cand_v)]));
    }
    Ok(avec(&base, vec![("stage", s("choice")), ("chosen", o(chosen)), ("gaugeMm", r1v(pm)), ("anchorsUsed", anchors_used), ("candidates", cand_v), ("positions", positions), ("anchor", b(false))]))
}

// ---------------------------------------------------------------- consignes en ombre
fn reglage_de(options: &V, cle_opt: &str, globale: &V) -> V {
    if vrai(options) && !matches!(g(options, cle_opt), V::Indefini) { g(options, cle_opt).clone() } else { globale.clone() }
}
fn ombre_verticale(decision: &V, capture: &V, science: &V, options: &V, gl: &Globaux) -> R<V> {
    let o_ = reglage_de(options, "ombreVerticale", &gl.ombre_verticale);
    let ok = vrai(&o_) && matches!(g(&o_, "actif"), V::Booleen(true)) && matches!(g(&o_, "mm"), V::Nombre(x) if x.is_finite() && *x != 0.0);
    let pz = if nullish(decision) { &INDEF } else { g(decision, "positions") };
    if !ok || !vrai(pz) { return Ok(nul()); }
    let mm = num(g(&o_, "mm")).unwrap();
    let mut rails = vec![];
    for side in SIDES {
        let cal = science_rail(science, side);
        let cal = if nullish(cal) { &INDEF } else { g(cal, "conventionCalibration") };
        let r = if nullish(capture) { &INDEF } else { let rr = g(capture, "rails"); if nullish(rr) { &INDEF } else { g(rr, side) } };
        let pose = g(pz, side);
        if !vrai(cal) || !matches!(g(cal, "applied"), V::Booleen(false)) || !matches!(g(cal, "reason"), V::Chaine(c) if c == "shift-out-of-domain")
            || nullish(r) || !vrai(g(r, "profileLocalToSceneRelative")) || !est_tableau(pose) { continue; }
        let pm = g(r, "profileLocalToSceneRelative");
        let a = point_v(pm, &tab_n(&[0.0, 0.0, 0.0]))?;
        let bh = point_v(pm, &tab_n(&[0.0, 0.0, mm / 1000.0]))?;
        let haut = [bh[0] - a[0], bh[1] - a[1], bh[2] - a[2]];
        let Some(t) = elems(pose) else { unreachable!() };
        let mut reelle = vec![];
        let mut ombre = vec![];
        for (i, v) in t.iter().enumerate() {
            match v { None => { reelle.push(None); ombre.push(None); }
                Some(v) => { let x = vers_nombre(v)?; reelle.push(Some(n(um(x)))); ombre.push(Some(n(um(x + haut.get(i).copied().unwrap_or(f64::NAN))))); } }
        }
        rails.push((side, o(vec![("reelle", canon(&V::Tableau(reelle))), ("ombre", canon(&V::Tableau(ombre))),
            ("refus", o(vec![("reason", g(cal, "reason").clone()), ("dzMm", fini_r1(g(cal, "dzMm"))), ("duMm", fini_r1(g(cal, "duMm")))]))])));
    }
    if rails.is_empty() { return Ok(nul()); }
    Ok(o(vec![("version", s("e2-vertical-refuse-v1")), ("mm", g(&o_, "mm").clone()), ("repere", s("profil du rail, + = vers le haut")), ("rails", o(rails))]))
}
fn fini_r1(v: &V) -> V { match v { V::Nombre(x) if x.is_finite() => r1v(*x), _ => nul() } }

/// `decideCut` : la décision de base, puis les trois consignes en ombre (une panne d'une consigne ne change jamais la décision).
pub fn decide_cut(args: &V, et: &Etat, gl: &Globaux) -> R<V> { decide_cut_r(args, et, gl, &mut None) }
/// CH-068 : `decideCut` avec le résultat du moteur relancé (voir `decide_cut_base_r`).
pub fn decide_cut_r(args: &V, et: &Etat, gl: &Globaux, relance: &mut Option<V>) -> R<V> {
    if nullish(args) { return hd("arguments absents"); }
    let (capture, science, anchors, validated, options) = (g(args, "capture"), g(args, "science"), g(args, "anchors"), g(args, "validated"), g(args, "options"));
    let options_def = if matches!(options, V::Indefini) { o(vec![]) } else { options.clone() };
    let decision = decide_cut_base_r(capture, science, anchors, validated, &options_def, et, gl, relance)?;
    let mut out = decision.clone();
    // try { … } catch {} : une exception du JS est absorbée ; un hors-domaine ne se décide pas ici
    let absorber = |r: R<V>| -> R<Option<V>> { match r { Ok(v) => Ok(if vrai(&v) { Some(v) } else { None }), Err(Echec::Js { .. }) => Ok(None), Err(e) => Err(e) } };
    if let Some(ov) = absorber(ombre_verticale(&decision, capture, science, options, gl))? { definir_v(&mut out, "ombreVerticale", ov); }
    let pz = g(&decision, "positions");
    let fv = reglage_de(options, "fauxVertOmbre", &gl.faux_vert);
    if vrai(&fv) && matches!(g(&fv, "actif"), V::Booleen(true)) && vrai(pz) {
        if let Some(f) = absorber(aides::faux_vert_evaluer(capture, science, &decision, &fv))? { definir_v(&mut out, "fauxVertOmbre", f); }
    }
    let ha = reglage_de(options, "hauteurApprise", &gl.hauteur);
    if vrai(&ha) && matches!(g(&ha, "actif"), V::Booleen(true)) && vrai(pz) {
        if let Some(h) = absorber(aides::hauteur_evaluer(capture, science, &decision, &ha))? { definir_v(&mut out, "hauteurApprise", h); }
    }
    Ok(out)
}

/// `{f:'decideCut', a:[args sans Shadow], etat:{partialFlank, convention, plafond}, globaux:{flushPct, ombreVerticaleRefusee, fauxVertOmbre, hauteurApprise}}`.
/// CH-068 : état du moteur GCV1 et réglages globaux d'un appel `{etat, globaux}` (ceux que la façade résout pour `decideCut`).
pub fn etat_globaux(entree: &V) -> R<(Etat, Globaux)> {
    let etat = g(entree, "etat");
    let gv = g(entree, "globaux");
    let lire = |k: &str, d: bool| match g(etat, k) { V::Booleen(x) => Ok(*x), V::Indefini => Ok(d), _ => hd("état du module illisible") };
    let et = Etat { partial_flank: lire("partialFlank", true)?, convention: lire("convention", true)?, plafond: g(etat, "plafond").clone(), avec_reservoir: false };
    let gl = Globaux { flush_pct: g(gv, "flushPct").clone(), ombre_verticale: g(gv, "ombreVerticaleRefusee").clone(), faux_vert: g(gv, "fauxVertOmbre").clone(), hauteur: g(gv, "hauteurApprise").clone() };
    Ok((et, gl))
}
pub fn appeler(a: &Appel, entree: &V) -> R<V> {
    let etat = g(entree, "etat");
    let gv = g(entree, "globaux");
    let lire = |k: &str, d: bool| match g(etat, k) { V::Booleen(x) => Ok(*x), V::Indefini => Ok(d), _ => hd("état du module illisible") };
    let et = Etat { partial_flank: lire("partialFlank", true)?, convention: lire("convention", true)?, plafond: g(etat, "plafond").clone(), avec_reservoir: false };
    let gl = Globaux { flush_pct: g(gv, "flushPct").clone(), ombre_verticale: g(gv, "ombreVerticaleRefusee").clone(), faux_vert: g(gv, "fauxVertOmbre").clone(), hauteur: g(gv, "hauteurApprise").clone() };
    match a.f.as_str() {
        "decideCut" => decide_cut(a.arg(0), &et, &gl),
        _ => hd("lot-decision : fonction non portée"),
    }
}
