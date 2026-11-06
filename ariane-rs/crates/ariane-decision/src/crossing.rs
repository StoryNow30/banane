//! `src/level-crossing.js` : passage à niveau lu par l'ornière (`frameOf`, `detect`, `edgeOf`, `positionAt`, `read`), à l'identique.
//! Les coordonnées locales d'un point (`frameOf(...).local(p)`) sont calculées une fois par rail et réutilisées : la fonction
//! est pure, les valeurs sont les mêmes que celles que le JS recalcule à chaque passage.
use crate::critere::vers_nombre;
use crate::js::*;
use ariane_vba::Valeur as V;
use std::collections::HashMap;

pub const SIDES: [&str; 2] = ["left", "right"];

/// Réglages numériques (`DEFAULTS` ou ceux de l'appelant, lus une fois : lecture et ToNumber sans effet de bord).
#[derive(Clone, Copy)]
pub struct Cfg { pub flush_min_pct: f64, pub side_in: f64, pub side_out: f64, pub along: f64, pub flush_below: f64, pub bin: f64, pub max_gap: f64,
    pub search: f64, pub drop: f64, pub groove_min: f64, pub groove_max: f64, pub head: f64, pub lat_off: f64, pub vert_off: f64 }
pub const DEFAUT: Cfg = Cfg { flush_min_pct: 50.0, side_in: 0.09, side_out: 0.45, along: 0.6, flush_below: 0.05, bin: 2.0, max_gap: 3.0, search: 180.0,
    drop: 25.0, groove_min: 30.0, groove_max: 100.0, head: 50.0, lat_off: -3.0, vert_off: 4.0 };
impl Cfg {
    pub fn lire(v: &V) -> R<Cfg> {
        if matches!(v, V::Indefini) { return Ok(DEFAUT); }
        if nullish(v) { return hd("cfg null"); }
        let f = |k: &str| vers_nombre(g(v, k));
        Ok(Cfg { flush_min_pct: f("flushMinPct")?, side_in: f("sideInM")?, side_out: f("sideOutM")?, along: f("alongM")?, flush_below: f("flushBelowM")?,
            bin: f("binMm")?, max_gap: f("maxGapBins")?, search: f("searchMm")?, drop: f("dropMm")?, groove_min: f("grooveMinMm")?, groove_max: f("grooveMaxMm")?,
            head: f("headMm")?, lat_off: f("lateralOffsetMm")?, vert_off: f("verticalOffsetMm")? })
    }
}
pub fn defaults() -> V {
    o(vec![("flushMinPct", n(50.0)), ("sideInM", n(0.09)), ("sideOutM", n(0.45)), ("alongM", n(0.6)), ("flushBelowM", n(0.05)), ("binMm", n(2.0)),
        ("maxGapBins", n(3.0)), ("searchMm", n(180.0)), ("dropMm", n(25.0)), ("grooveMinMm", n(30.0)), ("grooveMaxMm", n(100.0)), ("headMm", n(50.0)),
        ("lateralOffsetMm", n(-3.0)), ("verticalOffsetMm", n(4.0))])
}

/// `median` du module : élément d'indice ⌊n/2⌋ de la copie triée (jamais de moyenne) ; None si vide.
pub fn median(v: &[f64]) -> Option<f64> {
    if v.is_empty() { return None; }
    let mut s_ = v.to_vec();
    ariane_js::trier_nombres(&mut s_);
    Some(s_[s_.len() / 2])
}

/// Repère d'un rail (`frameOf`).
pub struct Repere { pub toward: f64, pub o: [f64; 3], pub m: M16, pub p: V }
impl Repere {
    pub fn local(&self, x: [f64; 3]) -> R<(f64, f64, f64)> {
        let q = ariane_capture::point(&self.m, x[0], x[1], x[2])?;
        Ok((q[0] - self.o[0], (q[1] - self.o[1]) * self.toward, q[2] - self.o[2]))
    }
}
pub fn frame_of(rails: &V, side: &str) -> R<Repere> {
    if nullish(rails) { return hd("rails absent"); }
    let r = g(rails, side);
    if nullish(r) { return hd("rail absent"); }
    let mv = g(r, "sceneRelativeToProfileLocal");
    let o_ = point_v(mv, g(r, "positionSceneRelative"))?;
    let autre = g(rails, if side == "left" { "right" } else { "left" });
    if nullish(autre) { return hd("autre rail absent"); }
    let other = point_v(mv, g(autre, "positionSceneRelative"))?;
    let sg = ariane_js::sign(other[1] - o_[1]);
    let toward = if sg.is_nan() || sg == 0.0 { 1.0 } else { sg };
    Ok(Repere { toward, o: o_, m: m16(mv)?, p: g(r, "profileLocalToSceneRelative").clone() })
}

/// Un seul rail (`edgeOf` ne lit que le sien).
pub fn lecture_rail(rails: &V, points: &V, side: &str) -> R<(Repere, Vec<(f64, f64, f64)>)> {
    let pts = if vrai(points) { points_xyz(points, false)? } else { vec![] };
    let f = frame_of(rails, side)?;
    let mut l = Vec::with_capacity(pts.len());
    for p_ in &pts { l.push(f.local(p_.unwrap())?); }
    Ok((f, l))
}
/// Lecture d'un nuage par rail : repère et coordonnées locales de chaque point (dans l'ordre du nuage).
pub struct Lecture { pub reperes: [Repere; 2], pub locaux: [Vec<(f64, f64, f64)>; 2] }
pub fn lecture(rails: &V, points: &V) -> R<Lecture> {
    let pts = if vrai(points) { points_xyz(points, false)? } else { vec![] };
    let mut reperes = vec![];
    let mut locaux = vec![];
    for side in SIDES {
        let f = frame_of(rails, side)?;
        let mut l = Vec::with_capacity(pts.len());
        for p_ in &pts { l.push(f.local(p_.unwrap())?); }
        reperes.push(f);
        locaux.push(l);
    }
    let r1 = reperes.pop().unwrap();
    let r0 = reperes.pop().unwrap();
    let l1 = locaux.pop().unwrap();
    let l0 = locaux.pop().unwrap();
    Ok(Lecture { reperes: [r0, r1], locaux: [l0, l1] })
}

pub struct Detection { pub flush_pct: Option<f64>, pub side_points: f64, pub crossing: bool }
pub fn detect(l: &Lecture, cfg: &Cfg) -> Detection {
    let (mut flush, mut all) = (0.0f64, 0.0f64);
    for i in 0..2 {
        for &(along, lat, z) in &l.locaux[i] {
            if along.abs() > cfg.along || lat.abs() < cfg.side_in || lat.abs() > cfg.side_out || z < -0.45 || z > 0.15 { continue; }
            all += 1.0;
            if z > -cfg.flush_below { flush += 1.0; }
        }
    }
    let flush_pct = if all != 0.0 { Some(ariane_js::round(100.0 * flush / all)) } else { None };
    Detection { flush_pct, side_points: all, crossing: matches!(flush_pct, Some(f) if f >= cfg.flush_min_pct) }
}

/// Profil en travers : pas (clé `Math.floor(l/binMm)`) dans l'ordre de première apparition, hauteurs (mm) dans l'ordre des points.
pub struct Profil { cles: Vec<f64>, pas: HashMap<u64, Vec<f64>> }
impl Profil {
    fn get(&self, b: f64) -> &[f64] { self.pas.get(&(b + 0.0).to_bits()).map(|v| v.as_slice()).unwrap_or(&[]) }
    fn entrees(&self) -> impl Iterator<Item = (f64, &Vec<f64>)> { self.cles.iter().map(|b| (*b, &self.pas[&(b + 0.0).to_bits()])) }
}
fn profile(locaux: &[(f64, f64, f64)], cfg: &Cfg) -> Profil {
    let lim = cfg.search + cfg.head + 20.0;
    let mut pr = Profil { cles: vec![], pas: HashMap::new() };
    for &(along, lat, z) in locaux {
        let (l_, h) = (lat * 1000.0, z * 1000.0);
        if along.abs() > 0.5 || l_.abs() > lim || h < -300.0 || h > 150.0 { continue; }
        let b_ = (l_ / cfg.bin).floor();
        let k = (b_ + 0.0).to_bits();
        pr.pas.entry(k).or_insert_with(|| { pr.cles.push(b_ + 0.0); vec![] }).push(h);
    }
    pr
}
#[derive(Clone, Copy)]
struct Rainure { edge: f64, width: f64 }
fn grooves(pr: &Profil, level: f64, cfg: &Cfg) -> R<Vec<Rainure>> {
    let lo = (-cfg.search / cfg.bin).floor();
    let hi = (cfg.search / cfg.bin).floor();
    if !(hi - lo).is_finite() || hi - lo > 1e7 { return hd("profil démesuré"); }
    let mut out = vec![];
    let (mut start, mut gap): (Option<f64>, f64) = (None, 0.0);
    let low = |b: f64| matches!(median(pr.get(b)), Some(m) if m < level - cfg.drop);
    let tolerated = |b: f64| match median(pr.get(b)) { None => true, Some(m) => m < level - cfg.drop / 2.0 };
    let mut b = lo;
    while b <= hi + 1.0 {
        if b <= hi && low(b) { if start.is_none() { start = Some(b); } gap = 0.0; b += 1.0; continue; }
        if start.is_some() && b <= hi && tolerated(b) && gap < cfg.max_gap { gap += 1.0; b += 1.0; continue; }
        if let Some(st) = start {
            let end = b - 1.0 - gap;
            let w = (end - st + 1.0) * cfg.bin;
            if w >= cfg.groove_min && w <= cfg.groove_max { out.push(Rainure { edge: st * cfg.bin, width: w }); }
        }
        start = None;
        gap = 0.0;
        b += 1.0;
    }
    Ok(out)
}
fn arr10(x: f64) -> f64 { ariane_js::round(x * 10.0) / 10.0 }

pub fn edge_of(locaux: &[(f64, f64, f64)], cfg: &Cfg) -> R<V> {
    let pr = profile(locaux, cfg);
    let mut meds: Vec<f64> = pr.entrees().filter(|(b_, _)| (b_ * cfg.bin).abs() <= cfg.search).map(|(_, v)| median(v).unwrap()).filter(|h| *h > -50.0 && *h < 60.0).collect();
    ariane_js::trier_nombres(&mut meds);
    if meds.is_empty() { return Ok(o(vec![("ok", b(false)), ("reason", s("no-surface"))])); }
    let level = meds[(0.75 * (meds.len() - 1) as f64).floor() as usize];
    let mut gr = grooves(&pr, level, cfg)?;
    if gr.is_empty() { return Ok(o(vec![("ok", b(false)), ("reason", s("no-groove")), ("levelMm", n(ariane_js::round(level)))])); }
    gr.sort_by(|x, y| { let d = x.edge.abs() - y.edge.abs(); if d < 0.0 { std::cmp::Ordering::Less } else if d > 0.0 { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal } });
    if gr.len() > 1 && (gr[0].edge.abs() - gr[1].edge.abs()).abs() < cfg.groove_min {
        return Ok(o(vec![("ok", b(false)), ("reason", s("ambiguous-groove")), ("grooves", n(gr.len() as f64)), ("levelMm", n(ariane_js::round(level)))]));
    }
    let e0 = gr[0].edge;
    let head: Vec<f64> = pr.entrees().filter(|(b_, _)| b_ * cfg.bin >= e0 - cfg.head && b_ * cfg.bin < e0 - 2.0).flat_map(|(_, v)| v.iter().copied()).filter(|h| *h > level - cfg.drop).collect();
    let top = median(&head).unwrap_or(level);
    let m = |b_: f64| median(pr.get(b_));
    let deep = |b_: f64| matches!(m(b_), Some(v) if v < top - cfg.drop);
    let half = |b_: f64| match m(b_) { None => true, Some(v) => v < top - cfg.drop / 2.0 };
    let mut e = e0;
    let mut b_ = ((e0 - 10.0) / cfg.bin).floor();
    let mut tours = 0u64;
    while b_ * cfg.bin <= e0 + gr[0].width {
        if deep(b_) && half(b_ + 1.0) { e = b_ * cfg.bin; break; }
        b_ += 1.0;
        tours += 1;
        if tours > 10_000_000 { return hd("balayage démesuré"); }
    }
    Ok(o(vec![("ok", b(true)), ("edgeMm", n(e)), ("widthMm", n(gr[0].width)), ("topMm", n(arr10(top))), ("levelMm", n(arr10(level))), ("grooves", n(gr.len() as f64))]))
}

pub fn position_at(f: &Repere, lat_mm: f64, z_mm: f64) -> R<[f64; 3]> {
    let q = [f.o[0], f.o[1] + f.toward * lat_mm / 1000.0, f.o[2] + z_mm / 1000.0];
    point_v(&f.p, &tab_n(&q))
}

/// `read(capture, cfg)`.
pub fn read(rails: &V, points: &V, cfg: &Cfg) -> R<V> {
    let l = lecture(rails, points)?;
    let d = detect(&l, cfg);
    let edges = [edge_of(&l.locaux[0], cfg)?, edge_of(&l.locaux[1], cfg)?];
    let ok = edges.iter().all(|e| matches!(g(e, "ok"), V::Booleen(true)));
    let reason = if ok { nul() } else {
        s(&(0..2).filter(|i| !matches!(g(&edges[*i], "ok"), V::Booleen(true))).map(|i| format!("{}:{}", SIDES[i], chaine_de(g(&edges[i], "reason")).unwrap())).collect::<Vec<_>>().join(" "))
    };
    let positions = if ok {
        let mut t = vec![];
        for i in 0..2 {
            let e = num(g(&edges[i], "edgeMm")).unwrap() + cfg.lat_off;
            let z = num(g(&edges[i], "topMm")).unwrap() + cfg.vert_off;
            t.push((SIDES[i], tab_n(&position_at(&l.reperes[i], e, z)?)));
        }
        o(t)
    } else { nul() };
    Ok(o(vec![("flushPct", n_ou_nul(d.flush_pct)), ("sidePoints", n(d.side_points)), ("crossing", b(d.crossing)),
        ("edges", o(vec![("left", edges[0].clone()), ("right", edges[1].clone())])), ("ok", b(ok)), ("reason", reason), ("positions", positions)]))
}

/// Capture `{rails, pointsSceneRelative}` lue comme le JS (`capture.rails`, `capture.pointsSceneRelative||[]`).
fn parts(capture: &V) -> R<(&V, &V)> { if nullish(capture) { return hd("capture absente"); } Ok((g(capture, "rails"), g(capture, "pointsSceneRelative"))) }

pub fn appeler(a: &Appel) -> R<V> {
    match a.f.as_str() {
        "read" => { let (r, p_) = parts(a.arg(0))?; read(r, p_, &Cfg::lire(a.arg(1))?) }
        "detect" => {
            let (r, p_) = parts(a.arg(0))?;
            let d = detect(&lecture(r, p_)?, &Cfg::lire(a.arg(1))?);
            Ok(o(vec![("flushPct", n_ou_nul(d.flush_pct)), ("sidePoints", n(d.side_points)), ("crossing", b(d.crossing))]))
        }
        "edgeOf" => {
            let (r, p_) = parts(a.arg(0))?;
            let side = match a.arg(1) { V::Chaine(c) if c == "left" || c == "right" => c.clone(), _ => return hd("côté") };
            let cfg = Cfg::lire(a.arg(2))?;
            edge_of(&lecture_rail(r, p_, &side)?.1, &cfg)
        }
        "positionAt" => {
            let (r, _) = parts(a.arg(0))?;
            let side = match a.arg(1) { V::Chaine(c) if c == "left" || c == "right" => c.clone(), _ => return hd("côté") };
            let (Some(x), Some(z)) = (num(a.arg(2)), num(a.arg(3))) else { return hd("positionAt : nombres attendus") };
            Ok(tab_n(&position_at(&frame_of(r, &side)?, x, z)?))
        }
        _ => hd("level-crossing : fonction non portée"),
    }
}
