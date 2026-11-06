//! `src/gcv1-shadow.js` : science du moteur GCV1 (`scientificProposeBoth`, avec ou sans réservoir), à l'identique.
//! Le moteur V4.6 gelé (`src/geometry.js`), A_STAR (`src/geometry-candidate-v1.js`), le calage de convention et le contrat
//! d'écartement sont ceux d'ariane-geometrie. L'état du module JS (drapeaux `partialFlank`, `convention`) et le plafond du calage
//! (réglage global `BananeSettings.conventionPlafond`) sont résolus par la façade et passés en entrée.
use crate::js::*;
use ariane_geometrie::{convention, gcv1, jauge, v46};
use ariane_js::{hypot, Echec};
use ariane_vba::Valeur as V;
use std::collections::HashMap;

const RATIO: f64 = 1.5;
const SEP: f64 = 0.02;
const GRID: f64 = 0.003;
const MIN_TOP: f64 = 15.0;
const MIN_FACE: f64 = 6.0;
const TOP_BAND: f64 = 0.012;
const FACE_BAND: f64 = 0.01;
const SEARCH_Y: f64 = 0.08;
const SEARCH_Z: f64 = 0.04;

pub fn round6(x: f64) -> f64 { ariane_js::round(x * 1e6) / 1e6 }
/// Clé `round6(u)+','+round6(z)` (deux nombres égaux ⇔ même chaîne ; −0 et +0 confondus, NaN confondus).
fn cle(u: f64, z: f64) -> (u64, u64) { (ariane_js::cle_same_value_zero(round6(u)), ariane_js::cle_same_value_zero(round6(z))) }
fn ordre(a: f64, b: f64) -> std::cmp::Ordering { let d = a - b; if d < 0.0 { std::cmp::Ordering::Less } else if d > 0.0 { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal } }
fn nv(x: Option<f64>) -> V { n_ou_nul(x) }

/// Réglages venus de la façade.
#[derive(Clone)]
pub struct Etat { pub partial_flank: bool, pub convention: bool, pub plafond: V, pub avec_reservoir: bool }

// ---------------------------------------------------------------- repère du rail (prepareFrame)
pub struct Frame { pub sign: f64, pub width: f64, pub points: Vec<[f64; 3]>, pub u_median: f64, pub z_median: f64 }
fn echec_frame(raison: &str, extra: Option<(&str, f64)>) -> Result<Frame, V> {
    let mut t = vec![("ok", b(false)), ("reason", s(raison))];
    if let Some((k, x)) = extra { t.push((k, n(x))); }
    Err(o(t))
}
/// Points d'un nuage tels que les lit `prepareFrame` : `None` = sauté (non tableau, ou un élément PRÉSENT non fini) ;
/// un trou (que `every` saute) devient NaN et fera lever `C.point`.
fn points_frame(v: &V) -> R<Vec<Option<[f64; 3]>>> {
    Ok(match v {
        V::Bloc { k, donnees } => {
            let k = *k as usize;
            donnees.chunks_exact(k).map(|c| if c.iter().all(|x| x.is_finite()) { Some([c[0], *c.get(1).unwrap_or(&f64::NAN), *c.get(2).unwrap_or(&f64::NAN)]) } else { None }).collect()
        }
        V::Tableau(t) => t.iter().map(|e| {
            let Some(x) = e else { return None };
            let el = elems(x)?;
            if !el.iter().flatten().all(fini) { return None; }
            let g3 = |i: usize| el.get(i).cloned().flatten().and_then(|y| num(&y)).unwrap_or(f64::NAN);
            Some([g3(0), g3(1), g3(2)])
        }).collect(),
        V::Nombres(t) => vec![None; t.len()],
        V::Booleens(t) => vec![None; t.len()],
        _ => return hd("nuage non tabulaire"),
    })
}
fn prepare_frame(capture: &V, side: &str) -> R<Result<Frame, V>> {
    let rails = if nullish(capture) { &INDEF } else { g(capture, "rails") };
    let rail = if nullish(rails) { &INDEF } else { g(rails, side) };
    if !vrai(rail) { return Ok(echec_frame("Profil absent.", None)); }
    let pts_v = g(capture, "pointsSceneRelative");
    let lg = if nullish(pts_v) { None } else { match pts_v { V::Chaine(c) => Some(c.len()), x => longueur(x) } };
    if lg.unwrap_or(0) == 0 { return Ok(echec_frame("Aucun point LiDAR disponible.", None)); }
    if matches!(pts_v, V::Chaine(_)) { return hd("points en chaîne"); }
    let pc = g(rail, "profileContours");
    let contour: Option<V> = if nullish(pc) { None } else {
        if !est_tableau(pc) { return hd("profileContours non tableau"); }
        let lgv = |c: &V| -> R<f64> { if nullish(c) { return Ok(0.0); } let v = g(c, "verticesSceneRelative"); if nullish(v) { Ok(0.0) } else { Ok(longueur(v).ok_or_else(|| Echec::hors_domaine("vertices"))? as f64) } };
        let mut a: Option<V> = None;
        for bv in presents(pc) {
            if nullish(&bv) { return hd("contour nul"); }
            if lgv(&bv)? > a.as_ref().map_or(Ok(0.0), lgv)? { a = Some(bv); }
        }
        a
    };
    let Some(contour) = contour.filter(vrai) else { return Ok(echec_frame("Contour du profil absent.", None)) };
    let m = g(rail, "sceneRelativeToProfileLocal");
    let verts = g(&contour, "verticesSceneRelative");
    if !est_tableau(verts) { return hd("verticesSceneRelative"); }
    let mut shape = vec![];
    for p_ in elems(verts).unwrap() { match p_ { Some(p_) => shape.push(point_v(m, &p_)?), None => return hd("trou dans un contour") } }
    let ys: Vec<f64> = shape.iter().map(|p_| p_[1]).collect();
    let sign = ariane_js::sign(ariane_js::mediane(&ys));
    if sign.is_nan() || sign == 0.0 { return Ok(echec_frame("Sens du profil ambigu.", None)); }
    let head: Vec<[f64; 2]> = shape.iter().map(|p_| [sign * p_[1], p_[2]]).filter(|p_| p_[1] > -0.04).collect();
    if head.len() < 6 { return Ok(echec_frame("Contour de champignon non reconnu.", None)); }
    let vis = g(capture, "visibleByClipBoxes");
    if !nullish(vis) && !est_tableau(vis) && !est_simple(vis) && !matches!(vis, V::Booleen(_) | V::Nombre(_)) { return hd("visibleByClipBoxes"); }
    let mm = m16(m)?;
    let mut points = vec![];
    for (i, src) in points_frame(pts_v)?.into_iter().enumerate() {
        let cache = match vis { V::Objet(_) => g_brut(vis, &i.to_string()).clone(), x if est_tableau(x) => elem(x, i), _ => V::Indefini };
        if matches!(cache, V::Booleen(false)) { continue; }
        let Some(src) = src else { continue };
        let q = ariane_capture::point(&mm, src[0], src[1], src[2])?;
        if q[0].abs() <= 0.5 && q[1].abs() < 0.18 && q[2].abs() < 0.10 { points.push([sign * q[1], q[2], q[0]]); }
    }
    if points.len() < 8 { return Ok(echec_frame("Trop peu de points autour du champignon.", Some(("pointsLocal", points.len() as f64)))); }
    let width = ariane_js::max_de(head.iter().filter(|p_| p_[1] > -0.012).map(|p_| p_[0]));
    if !(width > 0.025 && width < 0.12) { return Ok(echec_frame("Dimensions du profil hors du domaine testé.", Some(("width", width)))); }
    let mut top_anchors = 0;
    let mut u = 0.012;
    while u < width - 0.012 { if head.iter().any(|p_| (p_[0] - u).abs() < 0.004) { top_anchors += 1; } u += 0.006; }
    let mut face_anchors = 0;
    let mut z = -0.014;
    while z >= -0.033 { if head.iter().any(|p_| (p_[1] - z).abs() < 0.004) { face_anchors += 1; } z -= 0.004; }
    if top_anchors < 3 || face_anchors < 3 { return Ok(echec_frame("Surfaces du profil non identifiées.", None)); }
    let mut us: Vec<f64> = points.iter().map(|p_| p_[0]).collect();
    let mut zs: Vec<f64> = points.iter().map(|p_| p_[1]).collect();
    ariane_js::trier_nombres(&mut us);
    ariane_js::trier_nombres(&mut zs);
    Ok(Ok(Frame { sign, width, u_median: us[us.len() >> 1], z_median: zs[zs.len() >> 1], points }))
}
fn u_seed(f: &Frame) -> f64 {
    let u = ariane_js::mediane(&f.points.iter().map(|p_| p_[0]).collect::<Vec<_>>());
    if u.is_finite() { let r = round6(u); if r.is_finite() { r } else { f.u_median } } else { f.u_median }
}

// ---------------------------------------------------------------- propositions compactes
fn opt_chain<'a>(v: &'a V, ks: &[&str]) -> &'a V { let mut x = v; for k in ks { if nullish(x) { return &INDEF; } x = g(x, k); } x }
fn nn(v: &V) -> V { if nullish(v) { nul() } else { v.clone() } }
fn ou_ou(a: &V, b_: &V) -> V { if nullish(a) { nn(b_) } else { a.clone() } }
pub fn compact_proposal(p_: &V) -> R<V> {
    let st = g(p_, "status");
    let candidate = matches!(st, V::Chaine(c) if c == "candidate");
    let reason = if candidate { nul() } else { let r = g(p_, "reasons"); if vrai(r) { s(&joindre(r, " ")?) } else { s("") } };
    let delta = if vrai(g(p_, "delta")) { g(p_, "delta").clone() } else { nul() };
    let met = g(p_, "metrics");
    let seed = opt_chain(met, &["seed"]);
    Ok(o(vec![("status", st.clone()), ("reason", reason), ("delta", delta), ("loss", nn(opt_chain(met, &["templateLoss"]))),
        ("topRows", ou_ou(opt_chain(p_, &["top", "count"]), opt_chain(met, &["topCount"]))),
        ("faceCount", ou_ou(opt_chain(p_, &["face", "count"]), opt_chain(met, &["faceCount"]))),
        ("seed", if vrai(seed) { seed.clone() } else { nul() }), ("confidence", nn(g(p_, "confidence"))),
        ("lossRatio", nn(opt_chain(met, &["templateAmbiguity", "lossRatio"]))), ("alternative", nn(opt_chain(met, &["templateAmbiguity", "alternative"]))),
        ("uCenters", nn(opt_chain(met, &["lab", "uCenters"]))), ("coarseCount", nn(opt_chain(met, &["lab", "coarseCount"]))),
        ("slopeLimited", b(vrai(opt_chain(p_, &["top", "slopeLimited"])) || vrai(opt_chain(p_, &["face", "slopeLimited"]))))]))
}
fn motif_of(p_: &V) -> &'static str {
    match g(p_, "status") { V::Chaine(c) if c == "absent" => return "absent", V::Chaine(c) if c == "candidate" => return "candidate", _ => {} }
    let r = match g(p_, "reason") { V::Chaine(c) => c.as_str(), _ => "" };
    if r.contains("Plan de roulement non estimable") { "rsf" } else if r.contains("Plan de roulement insuffisamment observé") { "minTop" }
    else if r.contains("Flanc interne") { "flank" } else if r.contains("Plusieurs placements concurrents") { "ambiguity" }
    else if r.contains("Intersection hors de la fenêtre") { "window" } else if r.contains("Inclinaison") { "slope" }
    else if r.contains("Grand déplacement isolé") { "pair-lateral" } else { "other" }
}
fn face_tier(fc: f64) -> &'static str { if fc >= MIN_FACE { "STRONG_FACE" } else if fc >= 3.0 { "PARTIAL_FACE" } else { "WEAK_FACE" } }
fn face_tier_v(v: &V) -> R<&'static str> { let x = if vrai(v) { crate::critere::vers_nombre(v)? } else { 0.0 }; Ok(face_tier(x)) }

// ---------------------------------------------------------------- cellules caractérisées
#[derive(Clone, Debug)]
pub struct Ch { pub u: f64, pub z: f64, pub loss: Option<f64>, pub top_rows: f64, pub face_count: f64, pub slope: Option<f64>, pub slope_limited: bool,
    pub window_ok: bool, pub tier: &'static str, pub motif: &'static str, pub dist_u: f64, pub dist_origin: f64, pub seed: Option<[f64; 2]>, pub tags: Option<Vec<String>> }
impl Ch {
    pub fn valeur(&self) -> V {
        let mut t = vec![("u", n(self.u)), ("z", n(self.z)), ("loss", nv(self.loss)), ("topRows", n(self.top_rows)), ("faceCount", n(self.face_count)),
            ("slope", nv(self.slope)), ("slopeLimited", b(self.slope_limited)), ("windowOk", b(self.window_ok)), ("tier", s(self.tier)), ("motif", s(self.motif)),
            ("distU", n(self.dist_u)), ("distOrigin", n(self.dist_origin))];
        if let Some(sd) = self.seed { t.push(("seed", tab_n(&sd))); }
        if let Some(tg) = &self.tags { t.push(("tags", tab(tg.iter().map(|x| s(x)).collect()))); }
        o(t)
    }
    fn strong(&self) -> bool { self.top_rows >= MIN_TOP && self.face_count >= MIN_FACE && !self.slope_limited && self.window_ok }
}
fn top_rows_at(f: &Frame, u: f64, z: f64) -> f64 {
    let (lo, hi) = (u + 0.012, u + f.width - 0.012);
    if !(hi > lo) { return 0.0; }
    f.points.iter().filter(|p_| p_[0] > lo && p_[0] < hi && (p_[1] - z).abs() < TOP_BAND).count() as f64
}
fn characterize(f: &Frame, u: f64, z: f64, centres: &[f64], known: Option<f64>) -> Ch {
    let um0 = if f.u_median.is_nan() || f.u_median == 0.0 { 0.0 } else { f.u_median };
    let top_pts: Vec<[f64; 2]> = f.points.iter().filter(|p_| p_[0] > u + 0.012 && p_[0] < u + f.width - 0.012 && (p_[1] - z).abs() < TOP_BAND).map(|p_| [p_[0], p_[1]]).collect();
    let top = v46::robust_line(&top_pts);
    let top_rows = top_pts.len() as f64;
    let (dist_u, dist_origin) = (round6((u - um0).abs()), round6(u.abs()));
    let Some(top) = top else {
        return Ch { u: round6(u), z: round6(z), loss: known, top_rows, face_count: 0.0, slope: None, slope_limited: false, window_ok: false, tier: "WEAK_FACE",
            motif: "rsf", dist_u, dist_origin, seed: None, tags: None };
    };
    let mut face_pts = vec![];
    for p_ in &f.points {
        let drop = top.slope * p_[0] + top.intercept - p_[1];
        if drop > 0.009 && drop < 0.034 && (p_[0] - u).abs() < FACE_BAND { face_pts.push([p_[1], p_[0]]); }
    }
    let face = v46::robust_line(&face_pts);
    let face_count = face.as_ref().map_or(0.0, |x| x.count as f64);
    let (mut su, mut sz) = (u, z);
    if let Some(fc) = &face {
        let denom = 1.0 - fc.slope * top.slope;
        if denom.abs() > 0.5 { su = (fc.intercept + fc.slope * top.intercept) / denom; sz = top.slope * su + top.intercept; }
    }
    let uw = centres.iter().any(|cu| (su - cu).abs() <= SEARCH_Y + 0.01);
    let zw = sz.abs() <= SEARCH_Z + 0.01;
    let window_ok = uw && zw && su.is_finite() && sz.is_finite();
    let slope_limited = top.slope_limited || face.as_ref().is_some_and(|x| x.slope_limited);
    let motif = if (top.count as f64) < MIN_TOP { "minTop" } else if face.is_none() || face_count < MIN_FACE { "flank" } else if slope_limited { "slope" } else if !window_ok { "window" } else { "candidate" };
    Ch { u: round6(u), z: round6(z), loss: known, top_rows, face_count, slope: Some(top.slope), slope_limited, window_ok, tier: face_tier(face_count), motif,
        dist_u, dist_origin, seed: Some([f.sign * u, z]), tags: None }
}
#[derive(Clone, Copy)]
struct Uzl { u: f64, z: f64, loss: f64 }
fn local_minima(cells: &[Uzl]) -> Vec<usize> {
    let mut map: HashMap<(u64, u64), usize> = HashMap::new();
    for (i, c) in cells.iter().enumerate() { map.insert(cle(c.u, c.z), i); }
    let mut mins = vec![];
    for (i, c) in cells.iter().enumerate() {
        let mut ok = true;
        let mut du = -GRID;
        while du <= GRID + 1e-12 {
            let mut dz = -GRID;
            while dz <= GRID + 1e-12 {
                if !(du.abs() < 1e-12 && dz.abs() < 1e-12) {
                    if let Some(&j) = map.get(&cle(c.u + du, c.z + dz)) { if cells[j].loss < c.loss - 1e-15 { ok = false; break; } }
                }
                dz += GRID;
            }
            if !ok { break; }
            du += GRID;
        }
        if ok { mins.push(i); }
    }
    mins
}
struct Garde { u: f64, z: f64, loss: Option<f64>, tags: Vec<String> }
pub struct Reduit { pub pool: Vec<Ch>, n_coarse: usize, n_local_min: usize, n_dense: usize, n_strong_dense: usize }
fn reduce_pool(coarse: &[Uzl], f: &Frame, centres: &[f64], extras: &[(f64, f64, Option<f64>, &str)]) -> Reduit {
    if coarse.is_empty() { return Reduit { pool: vec![], n_coarse: 0, n_local_min: 0, n_dense: 0, n_strong_dense: 0 }; }
    let mins = local_minima(coarse);
    let mut ordre_k: Vec<(u64, u64)> = vec![];
    let mut keep: HashMap<(u64, u64), Garde> = HashMap::new();
    let mut add = |u: f64, z: f64, loss: Option<f64>, tag: &str| {
        if !u.is_finite() || !z.is_finite() { return; }
        let k = cle(u, z);
        let e = keep.entry(k).or_insert_with(|| { ordre_k.push(k); Garde { u, z, loss, tags: vec![] } });
        if !e.tags.iter().any(|t| t == tag) { e.tags.push(tag.to_owned()); }
    };
    let mut min_loss = 0usize;
    let mut min_sup: Option<usize> = None;
    let mut top_rows = vec![0.0; coarse.len()];
    for (i, c) in coarse.iter().enumerate() {
        if c.loss < coarse[min_loss].loss { min_loss = i; }
        let nn_ = top_rows_at(f, c.u, c.z);
        top_rows[i] = nn_;
        if nn_ >= MIN_TOP && min_sup.is_none_or(|j| c.loss < coarse[j].loss) { min_sup = Some(i); }
    }
    add(coarse[min_loss].u, coarse[min_loss].z, Some(coarse[min_loss].loss), "min-loss");
    if let Some(j) = min_sup { add(coarse[j].u, coarse[j].z, Some(coarse[j].loss), "min-loss-supported"); }
    for &i in &mins { add(coarse[i].u, coarse[i].z, Some(coarse[i].loss), "local-min"); }
    for (u, z, l, t) in extras { add(*u, *z, *l, t); }
    let mut dense: Vec<Ch> = vec![];
    for (i, c) in coarse.iter().enumerate() {
        if top_rows[i] < MIN_TOP { continue; }
        let mut ch = characterize(f, c.u, c.z, centres, Some(c.loss));
        ch.loss = Some(c.loss);
        ch.tags = Some(vec!["top>=15".into()]);
        dense.push(ch);
    }
    let strong: Vec<&Ch> = dense.iter().filter(|c| c.strong()).collect();
    let n_strong_dense = strong.len();
    let min_par = |l: &[&Ch]| -> Uzl { let m = l.iter().fold(None::<&Ch>, |a, b_| match a { None => Some(b_), Some(a) => if b_.loss.unwrap() < a.loss.unwrap() { Some(b_) } else { Some(a) } }).unwrap(); Uzl { u: m.u, z: m.z, loss: m.loss.unwrap() } };
    if !strong.is_empty() {
        let cs: Vec<Uzl> = strong.iter().map(|c| Uzl { u: c.u, z: c.z, loss: c.loss.unwrap() }).collect();
        for i in local_minima(&cs) { add(cs[i].u, cs[i].z, Some(cs[i].loss), "strong-local-min"); }
        let m = min_par(&strong);
        add(m.u, m.z, Some(m.loss), "min-loss-strong");
    }
    let partial: Vec<&Ch> = dense.iter().filter(|c| c.tier == "PARTIAL_FACE" && c.top_rows >= MIN_TOP && c.window_ok && !c.slope_limited).collect();
    if !partial.is_empty() {
        let cs: Vec<Uzl> = partial.iter().map(|c| Uzl { u: c.u, z: c.z, loss: c.loss.unwrap() }).collect();
        for i in local_minima(&cs) { add(cs[i].u, cs[i].z, Some(cs[i].loss), "partial-local-min"); }
        let m = min_par(&partial);
        add(m.u, m.z, Some(m.loss), "min-loss-partial");
    }
    let mut pool = vec![];
    for k in &ordre_k {
        let c = &keep[k];
        let from = dense.iter().find(|d| round6(d.u) == round6(c.u) && round6(d.z) == round6(c.z));
        let mut ch = from.cloned().unwrap_or_else(|| characterize(f, c.u, c.z, centres, c.loss));
        ch.loss = c.loss;
        ch.tags = Some(match from {
            Some(d) => { let mut t = d.tags.clone().unwrap_or_default(); for x in &c.tags { if !t.contains(x) { t.push(x.clone()); } } t }
            None => c.tags.clone(),
        });
        pool.push(ch);
    }
    pool.sort_by(|a, b_| ordre(a.loss.map_or(0.0, |x| x), b_.loss.map_or(0.0, |x| x)));
    Reduit { pool, n_coarse: coarse.len(), n_local_min: mins.len(), n_dense: dense.len(), n_strong_dense }
}

fn loss_ratio(loss: Option<f64>, lmin: Option<f64>) -> f64 {
    let (Some(l), Some(m)) = (loss.filter(|x| x.is_finite()), lmin.filter(|x| x.is_finite())) else { return f64::INFINITY };
    if m <= 0.0 { return if l <= 0.0 { 1.0 } else { f64::INFINITY }; }
    l / m
}
fn in_competitive(c: &Ch, lmin: Option<f64>) -> bool { c.loss.is_some_and(f64::is_finite) && loss_ratio(c.loss, lmin) <= RATIO }
fn spatial_clusters<T: Clone>(cells: &[T], uz: impl Fn(&T) -> (f64, f64)) -> Vec<Vec<T>> {
    let nb = cells.len();
    if nb == 0 { return vec![]; }
    let mut parent: Vec<usize> = (0..nb).collect();
    fn find(p_: &mut Vec<usize>, i: usize) -> usize { if p_[i] == i { i } else { let r = find(p_, p_[i]); p_[i] = r; r } }
    for i in 0..nb { for j in i + 1..nb {
        let (a, bz) = (uz(&cells[i]), uz(&cells[j]));
        if hypot(&[a.0 - bz.0, a.1 - bz.1]) < SEP { let ra = find(&mut parent, i); let rb = find(&mut parent, j); if ra != rb { parent[ra] = rb; } }
    } }
    let mut ordre_r: Vec<usize> = vec![];
    let mut groupes: HashMap<usize, Vec<T>> = HashMap::new();
    for i in 0..nb { let r = find(&mut parent, i); groupes.entry(r).or_insert_with(|| { ordre_r.push(r); vec![] }).push(cells[i].clone()); }
    ordre_r.into_iter().map(|r| groupes.remove(&r).unwrap()).collect()
}

/// Cellule publiée (du réservoir, ou celle d'A_STAR) : ce qu'en lisent `next`, `compactCell` et les gardes.
#[derive(Clone)]
struct Pick { u: f64, z: f64, loss: V, top_rows: V, face_count: V, slope_limited: bool, window_ok: bool, tier: V, motif: V, tags: Vec<String> }
impl Pick {
    fn de_ch(c: &Ch) -> Pick {
        Pick { u: c.u, z: c.z, loss: nv(c.loss), top_rows: n(c.top_rows), face_count: n(c.face_count), slope_limited: c.slope_limited, window_ok: c.window_ok,
            tier: s(c.tier), motif: s(c.motif), tags: c.tags.clone().unwrap_or_default() }
    }
    fn strong(&self) -> R<bool> {
        let tr = crate::critere::vers_nombre(&self.top_rows)?;
        let fc = crate::critere::vers_nombre(&self.face_count)?;
        Ok(tr >= MIN_TOP && fc >= MIN_FACE && !self.slope_limited && self.window_ok)
    }
    fn compact(&self) -> V {
        o(vec![("u", n(self.u)), ("z", n(self.z)), ("loss", self.loss.clone()), ("topRows", self.top_rows.clone()), ("faceCount", self.face_count.clone()),
            ("slopeLimited", b(self.slope_limited)), ("windowOk", b(self.window_ok)), ("tier", self.tier.clone()), ("motif", self.motif.clone()),
            ("tags", tab(self.tags.iter().map(|x| s(x)).collect()))])
    }
}
fn cell_from_astar(astar: &V, sign: f64) -> R<Option<Pick>> {
    let seed = g(astar, "seed");
    if !vrai(seed) { return Ok(None); }
    let s0 = crate::critere::vers_nombre(&gi(seed, 0)?)?;
    let s1 = crate::critere::vers_nombre(&gi(seed, 1)?)?;
    Ok(Some(Pick { u: round6(sign * s0), z: round6(s1), loss: g(astar, "loss").clone(), top_rows: g(astar, "topRows").clone(), face_count: g(astar, "faceCount").clone(),
        slope_limited: vrai(g(astar, "slopeLimited")), window_ok: matches!(g(astar, "status"), V::Chaine(c) if c == "candidate"),
        tier: s(face_tier_v(g(astar, "faceCount"))?), motif: g(astar, "motif").clone(), tags: vec!["astar-published".into()] }))
}
fn already_qualified(astar: &V) -> R<bool> {
    if !matches!(g(astar, "status"), V::Chaine(c) if c == "candidate") { return Ok(false); }
    let tr = crate::critere::vers_nombre(&nn_zero(g(astar, "topRows")))?;
    let fc = crate::critere::vers_nombre(&nn_zero(g(astar, "faceCount")))?;
    Ok(tr >= MIN_TOP && fc >= MIN_FACE && !vrai(g(astar, "slopeLimited")))
}
fn nn_zero(v: &V) -> V { if nullish(v) { n(0.0) } else { v.clone() } }

struct Pub { status: V, motif: V, reason: V, pick: Option<Pick>, changed: bool, activated: bool, n_strong: V, n_clusters: V }

/// Rail scientifique (`scientificRail`). `Err(Js)` : le JS aurait levé (rendu `{ok:false, side, error}` par l'appelant).
fn scientific_rail(capture: &V, side: &str, et: &Etat) -> R<V> {
    let v46p = v46::propose(capture, side, &V::Indefini)?;
    let mut v46c = compact_proposal(&v46p)?;
    let mo = motif_of(&v46c);
    definir_v(&mut v46c, "motif", s(mo));
    let frame = match prepare_frame(capture, side)? {
        Ok(f) => f,
        Err(e) => return Ok(o(vec![("ok", b(false)), ("side", s(side)), ("reason", g(&e, "reason").clone()), ("v46", v46c), ("astar", nul()), ("next", nul()),
            ("s1Activated", b(false)), ("s1Changed", b(false)), ("publishedWeak", b(false))])),
    };
    let useed = u_seed(&frame);
    let mut lab = vec![("uSeeds", tab_n(&[useed])), ("replaceOrigin", b(false)), ("recenterWindow", b(true))];
    if et.partial_flank { lab.push(("partialFaceKeep", b(true))); }
    lab.push(("onCoarse", s(gcv1::RAPPEL)));
    let mut appels = vec![];
    let astar_p = gcv1::propose(capture, side, &o(vec![("lab", o(lab))]), &mut appels)?;
    let (coarse, meilleur, centres): (Vec<Uzl>, Option<[f64; 3]>, Vec<f64>) = match appels.last() {
        Some(a) => (a.cellules.chunks_exact(3).map(|c| Uzl { u: c[0], z: c[1], loss: c[2] }).collect(), Some(a.meilleur), a.centres.clone()),
        None => (vec![], None, vec![0.0]),
    };
    let mut astar = compact_proposal(&astar_p)?;
    let mo = motif_of(&astar);
    definir_v(&mut astar, "motif", s(mo));
    let uc = opt_chain(&astar_p, &["metrics", "lab", "uCenters"]);
    definir_v(&mut astar, "uCenters", if vrai(uc) { uc.clone() } else { tab_n(&centres) });
    let mut extras: Vec<(f64, f64, Option<f64>, &str)> = vec![];
    if let Some(m) = meilleur { extras.push((m[0], m[1], Some(m[2]), "coarse-best")); }
    let loss_de = |v: &V| -> R<Option<f64>> { match g(v, "loss") { V::Nul | V::Indefini => Ok(None), V::Nombre(x) => Ok(Some(*x)), _ => hd("loss non numérique") } };
    for (pv, tag) in [(&astar, "astar-published"), (&v46c, "engine-published")] {
        let sd = g(pv, "seed");
        if vrai(sd) {
            let a0 = crate::critere::vers_nombre(&gi(sd, 0)?)?;
            let a1 = crate::critere::vers_nombre(&gi(sd, 1)?)?;
            extras.push((frame.sign * a0, a1, loss_de(pv)?, tag));
        }
    }
    let centres_pool: Vec<f64> = if appels.is_empty() { vec![0.0] } else { centres.clone() };
    let reduit = reduce_pool(&coarse, &frame, &centres_pool, &extras);
    let mut lmin: Option<f64> = None;
    for c in &reduit.pool { if let Some(l) = c.loss.filter(|x| x.is_finite()) { if lmin.is_none_or(|m| l < m) { lmin = Some(l); } } }
    if lmin.is_none() { if let V::Nombre(l) = g(&astar, "loss") { if l.is_finite() { lmin = Some(*l); } } }
    let competitive: Vec<&Ch> = reduit.pool.iter().filter(|c| in_competitive(c, lmin)).collect();
    let strong_c: Vec<Ch> = competitive.iter().filter(|c| c.strong()).map(|c| (*c).clone()).collect();
    let n_clusters_view = spatial_clusters(&strong_c, |c| (c.u, c.z)).len();
    let n_strong_pool = reduit.pool.iter().filter(|c| c.strong()).count();
    // politique S1
    let s1 = if already_qualified(&astar)? {
        Pub { status: g(&astar, "status").clone(), motif: g(&astar, "motif").clone(), reason: if vrai(g(&astar, "reason")) { g(&astar, "reason").clone() } else { nul() },
            pick: cell_from_astar(&astar, frame.sign)?, changed: false, activated: false, n_strong: n(strong_c.len() as f64), n_clusters: n(n_clusters_view as f64) }
    } else {
        let clusters = spatial_clusters(&strong_c, |c| (c.u, c.z));
        if clusters.len() == 1 {
            let pick = clusters[0].iter().fold(None::<&Ch>, |a, b_| match a { None => Some(b_), Some(a) => if b_.loss.unwrap() < a.loss.unwrap() { Some(b_) } else { Some(a) } }).unwrap();
            Pub { status: s("candidate"), motif: s("candidate"), reason: nul(), pick: Some(Pick::de_ch(pick)), changed: true, activated: true,
                n_strong: n(strong_c.len() as f64), n_clusters: n(1.0) }
        } else if clusters.len() > 1 {
            Pub { status: s("unresolved"), motif: s("ambiguity"), reason: s("Plusieurs placements STRONG compétitifs spatialement distincts."), pick: None,
                changed: false, activated: true, n_strong: n(strong_c.len() as f64), n_clusters: n(clusters.len() as f64) }
        } else {
            Pub { status: g(&astar, "status").clone(), motif: g(&astar, "motif").clone(), reason: if vrai(g(&astar, "reason")) { g(&astar, "reason").clone() } else { nul() },
                pick: cell_from_astar(&astar, frame.sign)?, changed: false, activated: true, n_strong: n(0.0), n_clusters: n(0.0) }
        }
    };
    let v46_cell = reduit.pool.iter().find(|c| c.tags.as_ref().is_some_and(|t| t.iter().any(|x| x == "engine-published")));
    let preserve = {
        let astar_cand = matches!(g(&astar, "status"), V::Chaine(c) if c == "candidate");
        if astar_cand || !matches!(g(&astar, "motif"), V::Chaine(c) if c == "ambiguity") { false }
        else if !s1.changed || !matches!(&s1.status, V::Chaine(c) if c == "candidate") || s1.pick.is_none() { false }
        else if !matches!(g(&v46c, "status"), V::Chaine(c) if c == "candidate") { false }
        else if !v46_cell.is_some_and(|c| c.strong()) { false }
        else {
            let a = v46_cell.unwrap();
            let p_ = s1.pick.as_ref().unwrap();
            spatial_clusters(&[(a.u, a.z), (p_.u, p_.z)], |x| *x).len() > 1
        }
    };
    let pubr = if preserve {
        Pub { status: s("unresolved"), motif: s("ambiguity"), reason: if vrai(g(&astar, "reason")) { g(&astar, "reason").clone() } else { nul() }, pick: None,
            changed: false, activated: true, n_strong: s1.n_strong.clone(), n_clusters: s1.n_clusters.clone() }
    } else { s1 };
    let cand = matches!(&pubr.status, V::Chaine(c) if c == "candidate");
    let next_delta: Option<[f64; 3]> = if cand { pubr.pick.as_ref().map(|p_| [0.0, frame.sign * p_.u, p_.z]) } else { None };
    let pk = pubr.pick.as_ref();
    let mut next = o(vec![("status", pubr.status.clone()), ("motif", pubr.motif.clone()), ("reason", if vrai(&pubr.reason) { pubr.reason.clone() } else { nul() }),
        ("delta", next_delta.map_or(nul(), |d| tab_n(&d))), ("loss", pk.map_or(nul(), |p_| nn(&p_.loss))), ("topRows", pk.map_or(nul(), |p_| nn(&p_.top_rows))),
        ("faceCount", pk.map_or(nul(), |p_| nn(&p_.face_count))), ("slopeLimited", b(pk.is_some_and(|p_| p_.slope_limited))), ("activated", b(pubr.activated)),
        ("changed", b(pubr.changed)), ("nClusters", nn(&pubr.n_clusters)), ("nStrongCompetitive", nn(&pubr.n_strong)), ("pick", pk.map_or(nul(), |p_| p_.compact()))]);
    let published_weak = cand && pk.is_some() && !pk.unwrap().strong()?;
    let fc_next = crate::critere::vers_nombre(&nn_zero(g(&next, "faceCount")))?;
    let partial_used = et.partial_flank && cand && fc_next < MIN_FACE;
    let mut conv = nul();
    if et.convention && cand && next_delta.is_some() {
        conv = convention::calibrate(capture, side, &tab_n(&next_delta.unwrap()), &V::Indefini, &et.plafond)?;
        if vrai(g(&conv, "applied")) {
            let dd = g(&next, "delta").clone();
            definir_v(&mut next, "rawDelta", dd);
            let d = g(&conv, "delta");
            definir_v(&mut next, "delta", canon(&V::Tableau(elems(d).ok_or_else(|| Echec::hors_domaine("delta du calage"))?)));
        }
    }
    let mut t: Vec<(&str, V)> = vec![("ok", b(true)), ("side", s(side))];
    if et.avec_reservoir {
        t.push(("_reservoir", o(vec![("pool", tab(reduit.pool.iter().map(Ch::valeur).collect())), ("lmin", nv(lmin)), ("sign", n(frame.sign))])));
    }
    t.extend([
        ("frame", o(vec![("sign", n(frame.sign)), ("width", n(round6(frame.width))), ("pointsLocal", n(frame.points.len() as f64)), ("uMedian", n(round6(frame.u_median))),
            ("uSeed", n(useed)), ("zMedian", n(frame.z_median))])),
        ("v46", v46c.clone()), ("astar", astar), ("next", next),
        ("competitive", o(vec![("lmin", nv(lmin)), ("nPool", n(reduit.pool.len() as f64)), ("nCompetitive", n(competitive.len() as f64)),
            ("nStrongPool", n(n_strong_pool as f64)), ("nStrongCompetitive", n(strong_c.len() as f64)), ("nClusters", n(n_clusters_view as f64))])),
        ("poolMeta", o(vec![("nCoarse", n(reduit.n_coarse as f64)), ("nLocalMin", n(reduit.n_local_min as f64)), ("nKept", n(reduit.pool.len() as f64)),
            ("nDense", n(reduit.n_dense as f64)), ("nStrongDense", n(reduit.n_strong_dense as f64))])),
        ("s1Activated", b(pubr.activated)), ("s1Changed", b(pubr.changed)), ("publishedWeak", b(published_weak)), ("partialFlank", b(et.partial_flank)),
        ("partialFlankUsed", b(partial_used)), ("s1AmbiguityPreserved", b(preserve)), ("convention", b(et.convention)), ("conventionCalibration", conv),
        ("deltaV46Next", hypot_delta(g(&v46c, "delta"), &next_delta.map_or(nul(), |d| tab_n(&d)))?),
    ]);
    Ok(o(t))
}
fn hypot_delta(a: &V, b_: &V) -> R<V> {
    if !vrai(a) && !vrai(b_) { return Ok(n(0.0)); }
    if !vrai(a) || !vrai(b_) { return Ok(nul()); }
    let c = |v: &V, i: usize| -> R<f64> { let x = gi(v, i)?; if vrai(&x) { crate::critere::vers_nombre(&x) } else { Ok(0.0) } };
    Ok(n(hypot(&[c(a, 0)? - c(b_, 0)?, c(a, 1)? - c(b_, 1)?, c(a, 2)? - c(b_, 2)?])))
}

fn reject_pair(rail: &mut V, report: &V) -> R<()> {
    let pubn = g(rail, "next").clone();
    let mut pg = vec![];
    etaler(&mut pg, report)?;
    definir(&mut pg, "rejected", b(true));
    definir(&mut pg, "publishedBeforeGate", o(["status", "motif", "delta", "loss", "topRows", "faceCount", "pick", "changed", "activated"].iter().map(|k| (*k, g(&pubn, k).clone())).collect()));
    definir_v(rail, "pairGauge", V::Objet(pg));
    let pm = num(g(report, "predictedMm")).unwrap_or(f64::NAN);
    let raison = format!("Écartement de paire hors contrat : {} mm ({}, admissible {}–{} mm).", to_fixed(pm, 1), chaine(g(report, "gaugeClass"))?,
        chaine(g(report, "lowMm"))?, chaine(g(report, "maximumMm"))?);
    let mut nx = vec![];
    etaler(&mut nx, &pubn)?;
    for (k, v) in [("status", s("unresolved")), ("motif", s("gauge-out-of-contract")), ("reason", s(&raison)), ("delta", nul()), ("pick", nul()), ("changed", b(false))] { definir(&mut nx, k, v); }
    definir_v(rail, "next", V::Objet(nx));
    definir_v(rail, "s1Changed", b(false));
    definir_v(rail, "publishedWeak", b(false));
    definir_v(rail, "partialFlankUsed", b(false));
    let dv = g(g(rail, "v46"), "delta").clone();
    definir_v(rail, "deltaV46Next", hypot_delta(&dv, &nul())?);
    let cc = g(rail, "conventionCalibration").clone();
    if vrai(&cc) { let mut c2 = vec![]; etaler(&mut c2, &cc)?; definir(&mut c2, "appliedToPublication", b(false)); definir_v(rail, "conventionCalibration", V::Objet(c2)); }
    Ok(())
}

pub fn scientific_propose_both(capture: &V, et: &Etat) -> R<V> {
    let mut rails: Vec<V> = vec![];
    for side in ["left", "right"] {
        rails.push(match scientific_rail(capture, side, et) {
            Ok(r) => r,
            Err(Echec::Js { message, .. }) => o(vec![("ok", b(false)), ("side", s(side)), ("error", s(&message))]),
            Err(e) => return Err(e),
        });
    }
    let candidat = |r: &V| matches!(g(r, "ok"), V::Booleen(true)) && matches!(g(g(r, "next"), "status"), V::Chaine(c) if c == "candidate") && est_tableau(g(g(r, "next"), "delta"));
    let pair = if candidat(&rails[0]) && candidat(&rails[1]) {
        let rv = if nullish(capture) { &INDEF } else { g(capture, "rails") };
        Some(jauge::assess_pair(rv, &canon(&o(vec![("left", g(g(&rails[0], "next"), "delta").clone()), ("right", g(g(&rails[1], "next"), "delta").clone())])))?)
    } else { None };
    let rejete = pair.as_ref().is_some_and(|p_| vrai(g(p_, "measurable")) && !vrai(g(p_, "admissible")));
    if let Some(p_) = &pair {
        for r in rails.iter_mut() {
            if rejete { reject_pair(r, p_)?; } else { let mut t = vec![]; etaler(&mut t, p_)?; definir(&mut t, "rejected", b(false)); definir_v(r, "pairGauge", V::Objet(t)); }
        }
    }
    let compte = |f: &dyn Fn(&V) -> bool| n(rails.iter().filter(|r| f(r)).count() as f64);
    let summary = o(vec![
        ("nextCandidates", compte(&|r| { let nx = g(r, "next"); !nullish(nx) && matches!(g(nx, "status"), V::Chaine(c) if c == "candidate") })),
        ("nextUnresolved", compte(&|r| { let nx = g(r, "next"); vrai(nx) && !matches!(g(nx, "status"), V::Chaine(c) if c == "candidate") })),
        ("s1Activated", compte(&|r| vrai(g(r, "s1Activated")))), ("s1Changed", compte(&|r| vrai(g(r, "s1Changed")))),
        ("publishedWeak", compte(&|r| vrai(g(r, "publishedWeak")))), ("pairGaugeRejected", b(rejete)),
        ("pairGaugeMm", pair.as_ref().map_or(nul(), |p_| g(p_, "predictedMm").clone())), ("pairGaugeClass", pair.as_ref().map_or(nul(), |p_| g(p_, "gaugeClass").clone())),
    ]);
    let mut rs = rails.into_iter();
    Ok(o(vec![("rails", o(vec![("left", rs.next().unwrap()), ("right", rs.next().unwrap())])), ("pairGauge", pair.unwrap_or(V::Nul)), ("summary", summary)]))
}

/// `{f:'scientificProposeBoth'|'scientificProposeBothAvecReservoir', a:[capture], etat:{partialFlank, convention, plafond}}`.
pub fn appeler(a: &Appel, etat: &V) -> R<V> {
    let lire = |k: &str, d: bool| match g(etat, k) { V::Booleen(x) => Ok(*x), V::Indefini => Ok(d), _ => hd("état du module illisible") };
    let mut et = Etat { partial_flank: lire("partialFlank", true)?, convention: lire("convention", true)?, plafond: g(etat, "plafond").clone(), avec_reservoir: false };
    match a.f.as_str() {
        "scientificProposeBoth" => scientific_propose_both(a.arg(0), &et),
        "scientificProposeBothAvecReservoir" => { et.avec_reservoir = true; scientific_propose_both(a.arg(0), &et) }
        _ => hd("gcv1-shadow : fonction non portée"),
    }
}
