//! `src/placement-convention.js` : calage de convention (`calibrate`, `bandOffsets`, `quantile`), à l'identique.
//! `template` rend des fonctions en JS : il n'est porté qu'en interne. Le plafond (`plafondMode`) lit une globale
//! (`BananeSettings.conventionPlafond`) : la façade la résout en JS et la passe dans `plafondEffectif`.
use crate::v46::{avec, hd, n, obj, longueur_tableau, pour_chaque_point, s, sommets, vis};
use ariane_capture::{point, M16};
use ariane_js::{max_de, min_de, trier_nombres, Echec};
use ariane_vba::Valeur;

const DEFAUTS: [(&str, Option<f64>); 10] = [("version", None), ("topQuantile", Some(0.9)), ("faceQuantile", Some(0.5)), ("topOffsetMm", Some(1.0)),
    ("faceOffsetMm", Some(-2.6)), ("faceFallbackMm", Some(0.0)), ("minTopPoints", Some(15.0)), ("minFacePoints", Some(6.0)), ("bandMm", Some(12.0)), ("maxShiftMm", Some(8.0))];
const STEP: f64 = 0.0005;

/// `quantile(values, p)` : élément de rang `min(n−1, ⌊p·n⌋)` de la copie triée ; NaN si vide.
pub fn quantile(v: &[f64], p: f64) -> f64 {
    if v.is_empty() { return f64::NAN; }
    let mut b = v.to_vec();
    trier_nombres(&mut b);
    let i = (p * b.len() as f64).floor();
    // Math.min(len-1, floor(p*len)) : p fini attendu (réglage numérique) ; un rang négatif rendrait undefined en JS
    if !(i >= 0.0) { return f64::NAN; }
    b[std::cmp::min(b.len() - 1, i as usize)]
}

pub struct Gabarit { pub sign: f64, pub width: f64, tops: Vec<Option<f64>>, faces: Vec<Option<f64>> }
impl Gabarit {
    fn rang(x: f64) -> Option<usize> { let r = ariane_js::round(x); if r >= 0.0 && r.is_finite() { Some(r as usize) } else { None } }
    pub fn top_at(&self, u: f64) -> Option<f64> { if u < 0.0 || u > self.width { None } else { Self::rang(u / STEP).and_then(|i| self.tops.get(i).copied().flatten()) } }
    pub fn face_at(&self, z: f64) -> Option<f64> { if z > 0.0 || z < -0.04 { None } else { Self::rang(-z / STEP).and_then(|i| self.faces.get(i).copied().flatten()) } }
}

/// `template(rail)` : None quand le JS rend null ; Err quand il lèverait (ou hors domaine).
pub fn gabarit(rail: Option<&Valeur>) -> Result<Option<(Gabarit, M16)>, Echec> {
    let rail = match rail { None | Some(Valeur::Indefini | Valeur::Nul) => return Ok(None), Some(r @ Valeur::Objet(_)) => r, Some(_) => return hd("rail non objet") };
    let contour = match rail.champ("profileContours") {
        None | Some(Valeur::Indefini | Valeur::Nul) => None,
        Some(Valeur::Tableau(t)) => {
            let mut a: Option<&Valeur> = None;
            let lg = |c: Option<&Valeur>| -> Result<usize, Echec> {
                match c.and_then(|c| c.champ("verticesSceneRelative")) {
                    None | Some(Valeur::Indefini | Valeur::Nul) => Ok(0),
                    Some(v) => longueur_tableau(v).ok_or_else(|| Echec::hors_domaine("verticesSceneRelative")),
                }
            };
            for b in t {
                let b = match b { Some(b @ Valeur::Objet(_)) => b, _ => return hd("contour non objet") };
                if lg(Some(b))? > lg(a)? { a = Some(b); }
            }
            a
        }
        Some(_) => return hd("profileContours"),
    };
    let Some(contour) = contour else { return Ok(None) };
    let m: M16 = match rail.champ("sceneRelativeToProfileLocal") {
        Some(Valeur::Nombres(t)) if t.len() >= 16 => { let mut a = [0.0; 16]; a.copy_from_slice(&t[..16]); a }
        _ => return hd("sceneRelativeToProfileLocal"),
    };
    let mut shape = vec![];
    for p in sommets(contour.champ("verticesSceneRelative").unwrap())? { shape.push(point(&m, p[0], p[1], p[2])?); }
    let mut ys: Vec<f64> = shape.iter().map(|p| p[1]).collect();
    trier_nombres(&mut ys);
    let sign = ariane_js::sign(ys[ys.len() >> 1]);
    if sign.is_nan() || sign == 0.0 { return Ok(None); }
    let head: Vec<[f64; 2]> = shape.iter().map(|p| [sign * p[1], p[2]]).filter(|p| p[1] > -0.04).collect();
    if head.len() < 6 { return Ok(None); }
    let width = max_de(head.iter().filter(|p| p[1] > -0.012).map(|p| p[0]));
    if !(width > 0.025 && width < 0.12) { return Ok(None); }
    let (mut tops, mut faces) = (vec![], vec![]);
    let mut u = 0.0;
    while u <= width + 1e-9 {
        let near: Vec<&[f64; 2]> = head.iter().filter(|p| (p[0] - u).abs() < 0.004).collect();
        tops.push(if near.is_empty() { None } else { Some(max_de(near.iter().map(|p| p[1]))) });
        u += STEP;
    }
    let mut z = 0.0;
    while z >= -0.04 - 1e-9 {
        let near: Vec<&[f64; 2]> = head.iter().filter(|p| (p[1] - z).abs() < 0.004).collect();
        faces.push(if near.is_empty() { None } else { Some(min_de(near.iter().map(|p| p[0]))) });
        z -= STEP;
    }
    Ok(Some((Gabarit { sign, width, tops, faces }, m)))
}

pub struct Reglages { valeur: Valeur }
impl Reglages {
    pub fn fusionner(options: &Valeur) -> Result<Self, Echec> {
        let mut t: Vec<(String, Valeur)> = DEFAUTS.iter().map(|(k, v)| (k.to_string(), match v { Some(x) => n(*x), None => s("convention-envelope-v1") })).collect();
        match options {
            Valeur::Indefini | Valeur::Nul => {}
            Valeur::Objet(o) => for (k, v) in o {
                if k == "__proto__" { return hd("réglage __proto__"); }
                match t.iter_mut().find(|(c, _)| c == k) { Some(e) => e.1 = v.clone(), None => t.push((k.clone(), v.clone())) }
            },
            _ => return hd("options non objet"),
        }
        Ok(Reglages { valeur: Valeur::Objet(t) })
    }
    fn brut(&self, k: &str) -> &Valeur { self.valeur.champ(k).unwrap_or(&Valeur::Indefini) }
    fn f(&self, k: &str) -> Result<f64, Echec> { match self.brut(k) { Valeur::Nombre(x) => Ok(*x), _ => hd("réglage non numérique") } }
}

pub struct Ecarts { pub sign: f64, pub top: Vec<f64>, pub face: Vec<f64> }

fn delta_valide(delta: &Valeur) -> Option<[f64; 3]> {
    match delta { Valeur::Nombres(d) if d.len() == 3 && d.iter().all(|x| x.is_finite()) => Some([d[0], d[1], d[2]]), _ => None }
}

/// `bandOffsets` : Ok(Err(raison)) quand le JS rend `{ok:false, reason}`.
pub fn band_offsets(capture: &Valeur, cote: &str, delta: &Valeur, cfg: &Reglages) -> Result<Result<Ecarts, &'static str>, Echec> {
    let rail = match capture {
        Valeur::Indefini | Valeur::Nul => None,
        Valeur::Objet(_) => match capture.champ("rails") { None | Some(Valeur::Indefini | Valeur::Nul) => None, Some(r @ Valeur::Objet(_)) => r.champ(cote), Some(_) => return hd("rails") },
        _ => return hd("capture"),
    };
    let Some((t, m)) = gabarit(rail)? else { return Ok(Err("template-unavailable")) };
    let Some(d) = delta_valide(delta) else {
        // tableau de 3 à trous dont les présents sont finis : le JS le juge valide (every saute les trous) : hors domaine
        if let Valeur::Tableau(t) = delta {
            if t.len() == 3 && t.iter().any(Option::is_none) && t.iter().all(|e| match e { None => true, Some(Valeur::Nombre(x)) => x.is_finite(), _ => false }) { return hd("delta à trous"); }
        }
        return Ok(Err("delta-invalid"));
    };
    let (bu, bz, band) = (t.sign * d[1], d[2], cfg.f("bandMm")? / 1000.0);
    let (mut top, mut face) = (vec![], vec![]);
    let ps = capture.champ("pointsSceneRelative").unwrap_or(&Valeur::Indefini);
    let ps = if ps.vrai() { ps } else { &Valeur::Tableau(vec![]) };
    if longueur_tableau(ps).is_none() { return hd("pointsSceneRelative"); }
    let vis = vis(capture.champ("visibleByClipBoxes"))?;
    pour_chaque_point(ps, &vis, &m, |q| {
        if !(q[0].abs() <= 0.5 && q[1].abs() < 0.18 && q[2].abs() < 0.10) { return; }
        let (lu, lz) = (t.sign * q[1] - bu, q[2] - bz);
        if lu > 0.012 && lu < t.width - 0.012 && lz.abs() < band { if let Some(z) = t.top_at(lu) { if (lz - z).abs() < band { top.push((lz - z) * 1000.0); } } }
        if lz < -0.009 && lz > -0.034 && lu.abs() < band { if let Some(u) = t.face_at(lz) { if (lu - u).abs() < band { face.push((lu - u) * 1000.0); } } }
    })?;
    Ok(Ok(Ecarts { sign: t.sign, top, face }))
}

fn copie(delta: &Valeur) -> Result<Valeur, Echec> {
    match delta {
        Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Bloc { .. } => Ok(delta.clone()),
        _ => Ok(Valeur::Nul),
    }
}

/// `calibrate(capture, side, delta, options)` ; `plafond` : `plafondMode(cfg)` déjà résolu par la façade.
pub fn calibrate(capture: &Valeur, cote: &str, delta: &Valeur, options: &Valeur, plafond: &Valeur) -> Result<Valeur, Echec> {
    let cfg = Reglages::fusionner(options)?;
    let offsets = band_offsets(capture, cote, delta, &cfg)?;
    let base = obj(vec![("version", cfg.brut("version").clone()), ("applied", Valeur::Booleen(false)), ("rawDelta", copie(delta)?), ("delta", copie(delta)?)]);
    let o = match offsets { Err(r) => return Ok(avec(base, vec![("reason", s(r))])), Ok(o) => o };
    let (top_n, face_n) = (o.top.len() as f64, o.face.len() as f64);
    if top_n < cfg.f("minTopPoints")? { return Ok(avec(base, vec![("reason", s("top-under-observed")), ("topN", n(top_n)), ("faceN", n(face_n))])); }
    let (pt, pf) = (cfg.f("topQuantile")?, cfg.f("faceQuantile")?);
    if !(pt >= 0.0) || !(pf >= 0.0) { return hd("quantile négatif ou NaN (rang hors tableau en JS)"); }
    let top_q = quantile(&o.top, pt);
    let face_q = if o.face.is_empty() { None } else { Some(quantile(&o.face, pf)) };
    let median = face_n >= cfg.f("minFacePoints")?;
    let face_mode = if median { "median" } else { "under-observed" };
    let dz = top_q + cfg.f("topOffsetMm")?;
    let du = if median { face_q.unwrap_or(0.0) + cfg.f("faceOffsetMm")? } else {
        match cfg.brut("faceFallbackMm") { Valeur::Nombre(x) => *x, _ => f64::NAN /* Number.isFinite(non-nombre) est faux */ }
    };
    if !dz.is_finite() || !du.is_finite() { return Ok(avec(base, vec![("reason", s("offset-not-finite")), ("topN", n(top_n)), ("faceN", n(face_n))])); }
    let max_shift = cfg.f("maxShiftMm")?;
    let fq = face_q.map_or(Valeur::Nul, n);
    let d = delta_valide(delta).expect("validé par bandOffsets");
    if dz.abs() > max_shift || du.abs() > max_shift {
        let mode = match plafond { Valeur::Booleen(true) => 2, Valeur::Chaine(c) if c == "vertical" => 1, _ => 0 };
        if mode == 0 || (mode == 1 && du.abs() > max_shift) {
            return Ok(avec(base, vec![("reason", s("shift-out-of-domain")), ("topN", n(top_n)), ("faceN", n(face_n)), ("duMm", n(du)), ("dzMm", n(dz))]));
        }
        let cap = |m: f64| ariane_js::sign(m) * ariane_js::min(m.abs(), max_shift);
        let (adu, adz) = (cap(du), cap(dz));
        let mut t = vec![("applied", Valeur::Booleen(true)), ("delta", Valeur::Nombres(vec![d[0], d[1] + o.sign * adu / 1000.0, d[2] + adz / 1000.0])),
            ("reason", s("shift-out-of-domain")), ("capped", Valeur::Booleen(true)), ("capMm", cfg.brut("maxShiftMm").clone())];
        if mode == 1 { t.push(("capAxes", s("vertical"))); }
        t.extend([("duMm", n(du)), ("dzMm", n(dz)), ("appliedDuMm", n(adu)), ("appliedDzMm", n(adz)), ("restDuMm", n(du - adu)), ("restDzMm", n(dz - adz)),
            ("topN", n(top_n)), ("faceN", n(face_n)), ("faceMode", s(face_mode)), ("topQuantileMm", n(top_q)), ("faceQuantileMm", fq)]);
        return Ok(avec(base, t));
    }
    let corrige = Valeur::Nombres(vec![d[0], d[1] + o.sign * du / 1000.0, d[2] + dz / 1000.0]);
    Ok(avec(base, vec![("applied", Valeur::Booleen(true)), ("delta", corrige), ("duMm", n(du)), ("dzMm", n(dz)), ("topN", n(top_n)), ("faceN", n(face_n)),
        ("faceMode", s(face_mode)), ("topQuantileMm", n(top_q)), ("faceQuantileMm", fq)]))
}

/// `bandOffsets` rendu comme le JS : `{ok:false, reason}` ou `{ok:true, sign, top, face}`.
pub fn band_offsets_valeur(capture: &Valeur, cote: &str, delta: &Valeur, options: &Valeur) -> Result<Valeur, Echec> {
    let cfg = Reglages::fusionner(options)?;
    let nb = |v: Vec<f64>| if v.is_empty() { Valeur::Tableau(vec![]) } else { Valeur::Nombres(v) };
    Ok(match band_offsets(capture, cote, delta, &cfg)? {
        Err(r) => obj(vec![("ok", Valeur::Booleen(false)), ("reason", s(r))]),
        Ok(o) => obj(vec![("ok", Valeur::Booleen(true)), ("sign", n(o.sign)), ("top", nb(o.top)), ("face", nb(o.face))]),
    })
}
