//! `src/geometry.js` : `propose`, `enforcePairSupport`, `proposeBoth`, `robustLine`.
use ariane_capture::{point, xyz, M16};
use ariane_js::{cle_same_value_zero, hypot, max_de, mediane, min_de, Echec};
use ariane_vba::Valeur;
use std::collections::HashSet;

pub(crate) const METHODE: &str = "template-surfaces-v3";
/// DEFAULTS, dans l'ordre des clés du JS.
const DEFAUTS: [(&str, f64); 13] = [
    ("searchY", 0.08), ("searchZ", 0.04), ("grid", 0.003), ("minTop", 15.0), ("minFace", 6.0), ("maxResidual", 0.004),
    ("minConfidence", 55.0), ("topBand", 0.012), ("faceBand", 0.01), ("alternativeSeparation", 0.02),
    ("minTemplateLossRatio", 1.5), ("maxSingleRailLateral", 0.06), ("pairedSupportLateral", 0.04),
];
const BORNES: [(&str, f64, f64); 10] = [
    ("searchY", 0.005, 0.2), ("searchZ", 0.005, 0.1), ("grid", 0.001, 0.01), ("minTop", 3.0, 500.0), ("minFace", 3.0, 500.0),
    ("minConfidence", 0.0, 100.0), ("alternativeSeparation", 0.005, 0.1), ("minTemplateLossRatio", 1.0, 100.0),
    ("maxSingleRailLateral", 0.01, 0.2), ("pairedSupportLateral", 0.005, 0.2),
];

pub(crate) fn n(x: f64) -> Valeur { Valeur::Nombre(x) }
pub(crate) fn s(x: &str) -> Valeur { Valeur::Chaine(x.into()) }
pub(crate) fn obj(t: Vec<(&str, Valeur)>) -> Valeur { Valeur::Objet(t.into_iter().map(|(k, v)| (k.to_owned(), v)).collect()) }
pub(crate) fn hd<T>(m: &str) -> Result<T, Echec> { Err(Echec::hors_domaine(m)) }

/// Réglages fusionnés `{...DEFAULTS, ...options, method}` : valeur rendue telle quelle (`parameters`) et lecture numérique.
pub struct Reglages { pub valeur: Valeur }
impl Reglages {
    /// `force_methode` : `propose` force `method` à DEFAULTS.method ; `enforcePairSupport` ne le fait pas.
    pub fn fusionner(options: &Valeur, force_methode: bool) -> Result<Self, Echec> { Self::fusionner_sans(options, force_methode, false) }
    pub fn fusionner_sans(options: &Valeur, force_methode: bool, sans_lab: bool) -> Result<Self, Echec> {
        let mut t: Vec<(String, Valeur)> = DEFAUTS.iter().map(|(k, v)| (k.to_string(), n(*v))).collect();
        t.push(("method".into(), s(METHODE)));
        match options {
            Valeur::Indefini | Valeur::Nul => {}
            Valeur::Objet(o) => {
                for (k, v) in o {
                    if k == "__proto__" { return hd("réglage __proto__"); }
                    match t.iter_mut().find(|(c, _)| c == k) { Some(e) => e.1 = v.clone(), None => t.push((k.clone(), v.clone())) }
                }
            }
            _ => return hd("options non objet"),
        }
        if force_methode { t.iter_mut().find(|(c, _)| c == "method").unwrap().1 = s(METHODE); }
        if sans_lab { t.retain(|(c, _)| c != "lab"); }
        Ok(Reglages { valeur: Valeur::Objet(t) })
    }
    pub(crate) fn brut(&self, k: &str) -> &Valeur { self.valeur.champ(k).unwrap_or(&Valeur::Indefini) }
    /// Valeur numérique d'un réglage ; un réglage non numérique serait converti par le JS : hors domaine.
    pub(crate) fn f(&self, k: &str) -> Result<f64, Echec> { match self.brut(k) { Valeur::Nombre(x) => Ok(*x), _ => hd("réglage non numérique") } }
    pub(crate) fn valider(&self) -> Result<(), Echec> {
        for (k, lo, hi) in BORNES {
            let ok = matches!(self.brut(k), Valeur::Nombre(x) if x.is_finite() && (lo..=hi).contains(x));
            if !ok { return Err(Echec::erreur(format!("Paramètre géométrique invalide : {k}"))); }
        }
        self.coherence()
    }
    pub(crate) fn coherence(&self) -> Result<(), Echec> {
        // pairedSupportLateral >= maxSingleRailLateral (comparaison JS : deux nombres, sinon hors domaine)
        if self.f("pairedSupportLateral")? >= self.f("maxSingleRailLateral")? {
            return Err(Echec::erreur("Paramètres géométriques incohérents : appui pair >= déplacement isolé."));
        }
        Ok(())
    }
}

/// Droite robuste (`robustLine`) : médiane des pentes par paires espacées, bornée à ±0,5.
#[derive(Clone, Debug)]
pub struct Droite { pub slope: f64, pub raw_slope: f64, pub slope_limited: bool, pub intercept: f64, pub residual: f64, pub count: usize }
impl Droite {
    pub(crate) fn valeur(&self) -> Valeur {
        obj(vec![("slope", n(self.slope)), ("rawSlope", n(self.raw_slope)), ("slopeLimited", Valeur::Booleen(self.slope_limited)),
            ("intercept", n(self.intercept)), ("residual", n(self.residual)), ("count", n(self.count as f64))])
    }
}
pub fn robust_line(rows: &[[f64; 2]]) -> Option<Droite> {
    if rows.len() < 3 { return None; }
    let mut slopes = vec![];
    let stride = std::cmp::max(1, rows.len() / 70);
    let mut i = 0;
    while i < rows.len() {
        let mut j = i + stride;
        while j < rows.len() {
            let dx = rows[j][0] - rows[i][0];
            if dx.abs() > 0.01 { slopes.push((rows[j][1] - rows[i][1]) / dx); }
            j += stride;
        }
        i += stride;
    }
    let raw = if slopes.is_empty() { 0.0 } else { mediane(&slopes) };
    let slope = ariane_js::max(-0.5, ariane_js::min(0.5, raw));
    let intercept = mediane(&rows.iter().map(|p| p[1] - slope * p[0]).collect::<Vec<_>>());
    let residual = mediane(&rows.iter().map(|p| (p[1] - slope * p[0] - intercept).abs()).collect::<Vec<_>>());
    // slopeLimited : slope !== rawSlope (NaN impossible : les pentes sont finies)
    Some(Droite { slope, raw_slope: raw, slope_limited: slope != raw, intercept, residual, count: rows.len() })
}

// ---------------------------------------------------------------- lecture de l'entrée

pub(crate) enum Vis<'a> { Absente, Liste(&'a Valeur) }
impl Vis<'_> {
    pub(crate) fn est_faux(&self, i: usize) -> bool {
        match self {
            Vis::Absente => false,
            Vis::Liste(v) => match v {
                Valeur::Booleens(t) => t.get(i) == Some(&false),
                Valeur::Tableau(t) => matches!(t.get(i), Some(Some(Valeur::Booleen(false)))),
                _ => false,
            },
        }
    }
    pub(crate) fn contient_nul(&self) -> bool {
        match self { Vis::Liste(Valeur::Tableau(t)) => t.iter().any(|e| matches!(e, Some(Valeur::Nul))), _ => false }
    }
}
pub(crate) fn vis(v: Option<&Valeur>) -> Result<Vis<'_>, Echec> {
    match v {
        None | Some(Valeur::Indefini) | Some(Valeur::Nul) => Ok(Vis::Absente),
        Some(x @ (Valeur::Booleens(_) | Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Bloc { .. })) => Ok(Vis::Liste(x)),
        _ => hd("visibleByClipBoxes"),
    }
}
pub(crate) fn longueur_tableau(v: &Valeur) -> Option<usize> {
    match v {
        Valeur::Tableau(t) => Some(t.len()), Valeur::Nombres(t) => Some(t.len()), Valeur::Booleens(t) => Some(t.len()),
        Valeur::Bloc { k, donnees } => Some(donnees.len() / *k as usize), _ => None,
    }
}

/// Points de la scène retenus par le filtre de `propose` (visibles, tableaux de nombres finis), projetés.
/// Rend l'erreur que lèverait `C.point` (point de moins de trois coordonnées).
pub(crate) fn pour_chaque_point(ps: &Valeur, vis: &Vis, m: &M16, mut f: impl FnMut([f64; 3])) -> Result<(), Echec> {
    match ps {
        Valeur::Bloc { k, donnees } => {
            let k = *k as usize;
            for (i, c) in donnees.chunks_exact(k).enumerate() {
                if vis.est_faux(i) || !c.iter().all(|x| x.is_finite()) { continue; }
                let g = |j: usize| if j < k { c[j] } else { f64::NAN };
                f(point(m, g(0), g(1), g(2))?);
            }
        }
        Valeur::Tableau(t) => {
            for (i, e) in t.iter().enumerate() {
                if vis.est_faux(i) { continue; }
                let p = match e { Some(p) => p, None => continue };
                let present_fini = match p {
                    Valeur::Nombres(v) => v.iter().all(|x| x.is_finite()),
                    Valeur::Tableau(v) => v.iter().all(|x| match x { None => true, Some(Valeur::Nombre(y)) => y.is_finite(), _ => false }),
                    Valeur::Bloc { .. } | Valeur::Booleens(_) => false,
                    _ => continue, // pas un tableau
                };
                if !present_fini { continue; }
                let [x, y, z] = xyz(p)?;
                f(point(m, x, y, z)?);
            }
        }
        Valeur::Nombres(_) | Valeur::Booleens(_) => {} // aucun élément n'est un tableau
        _ => return hd("pointsSceneRelative"),
    }
    Ok(())
}

pub(crate) fn sommets(v: &Valeur) -> Result<Vec<[f64; 3]>, Echec> {
    match v {
        Valeur::Bloc { k, donnees } => Ok(donnees.chunks_exact(*k as usize).map(|c| {
            let g = |j: usize| if j < c.len() { c[j] } else { f64::NAN };
            [g(0), g(1), g(2)]
        }).collect()),
        Valeur::Tableau(t) => t.iter().map(|e| match e { Some(p @ (Valeur::Nombres(_) | Valeur::Tableau(_))) => xyz(p), _ => hd("sommet non tabulaire") }).collect(),
        _ => hd("verticesSceneRelative"),
    }
}

// ---------------------------------------------------------------- propose

fn non_resolu(cote: &str, raison: &str, cfg: &Reglages) -> Valeur {
    obj(vec![("side", s(cote)), ("status", s("unresolved")), ("delta", Valeur::Nul), ("confidence", n(0.0)),
        ("reasons", Valeur::Tableau(vec![Some(s(raison))])), ("method", cfg.brut("method").clone()), ("source", s("no-estimate")),
        ("parameters", cfg.valeur.clone())])
}
pub(crate) fn avec(mut v: Valeur, en_plus: Vec<(&str, Valeur)>) -> Valeur {
    if let Valeur::Objet(t) = &mut v {
        for (k, x) in en_plus { match t.iter_mut().find(|(c, _)| c == k) { Some(e) => e.1 = x, None => t.push((k.into(), x)) } }
    }
    v
}

pub fn propose(capture: &Valeur, cote: &str, options: &Valeur) -> Result<Valeur, Echec> {
    let cfg = Reglages::fusionner(options, true)?;
    cfg.valider()?;
    if !matches!(capture, Valeur::Objet(_)) { return hd("capture non objet"); }
    let rails = capture.champ("rails");
    let rail = match rails {
        None | Some(Valeur::Indefini) | Some(Valeur::Nul) => None,
        Some(r @ Valeur::Objet(_)) => r.champ(cote),
        Some(_) => return hd("rails non objet"),
    };
    let rail = match rail {
        None | Some(Valeur::Indefini) | Some(Valeur::Nul) | Some(Valeur::Booleen(false)) => return Err(Echec::erreur(format!("Profil absent : {cote}"))),
        Some(Valeur::Nombre(x)) if x.is_nan() || *x == 0.0 => return Err(Echec::erreur(format!("Profil absent : {cote}"))),
        Some(Valeur::Chaine(c)) if c.is_empty() => return Err(Echec::erreur(format!("Profil absent : {cote}"))),
        Some(r @ Valeur::Objet(_)) => r,
        Some(_) => return hd("rail non objet"),
    };
    let ps = capture.champ("pointsSceneRelative").unwrap_or(&Valeur::Indefini);
    let nps = match ps { Valeur::Indefini | Valeur::Nul => 0, _ => longueur_tableau(ps).ok_or_else(|| Echec::hors_domaine("pointsSceneRelative"))? };
    if nps == 0 { return Ok(non_resolu(cote, "Aucun point LiDAR disponible.", &cfg)); }
    // contour le plus fourni (reduce, première égalité gardée)
    let contour = match rail.champ("profileContours") {
        None | Some(Valeur::Indefini) | Some(Valeur::Nul) => None,
        Some(Valeur::Tableau(t)) => {
            let mut a: Option<&Valeur> = None;
            let lg = |c: Option<&Valeur>| -> Result<usize, Echec> {
                match c.and_then(|c| c.champ("verticesSceneRelative")) {
                    None | Some(Valeur::Indefini) | Some(Valeur::Nul) => Ok(0),
                    Some(v) => longueur_tableau(v).ok_or_else(|| Echec::hors_domaine("verticesSceneRelative")),
                }
            };
            for b in t {
                let b = match b { Some(b @ Valeur::Objet(_)) => b, _ => return hd("contour non objet") };
                if lg(Some(b))? > lg(a)? { a = Some(b); }
            }
            a
        }
        Some(Valeur::Nombres(_)) | Some(Valeur::Bloc { .. }) | Some(Valeur::Booleens(_)) => return hd("contour non objet"),
        Some(_) => return hd("profileContours"),
    };
    let contour = match contour { Some(c) => c, None => return Ok(non_resolu(cote, "Contour du profil absent.", &cfg)) };
    let m: M16 = match rail.champ("sceneRelativeToProfileLocal") {
        Some(Valeur::Nombres(t)) if t.len() >= 16 => { let mut a = [0.0; 16]; a.copy_from_slice(&t[..16]); a }
        _ => return hd("sceneRelativeToProfileLocal"),
    };
    let mut shape = vec![];
    for p in sommets(contour.champ("verticesSceneRelative").unwrap())? { shape.push(point(&m, p[0], p[1], p[2])?); }
    let sign = ariane_js::sign(mediane(&shape.iter().map(|p| p[1]).collect::<Vec<_>>()));
    if sign.is_nan() || sign == 0.0 { return Ok(non_resolu(cote, "Sens du profil ambigu.", &cfg)); }
    let vertices: Vec<[f64; 2]> = shape.iter().map(|p| [sign * p[1], p[2]]).collect();
    let head: Vec<[f64; 2]> = vertices.iter().copied().filter(|p| p[1] > -0.04).collect();
    if head.len() < 6 { return Ok(non_resolu(cote, "Contour de champignon non reconnu.", &cfg)); }
    let vis = vis(capture.champ("visibleByClipBoxes"))?;
    let mut points: Vec<[f64; 3]> = vec![];
    pour_chaque_point(ps, &vis, &m, |q| {
        if q.iter().all(|v| v.is_finite()) && q[0].abs() <= 0.5 && q[1].abs() < 0.18 && q[2].abs() < 0.10 { points.push([sign * q[1], q[2], q[0]]); }
    })?;
    if points.len() < 8 { return Ok(non_resolu(cote, "Trop peu de points autour du champignon.", &cfg)); }
    let width = max_de(head.iter().filter(|p| p[1] > -0.012).map(|p| p[0]));
    if !(width > 0.025 && width < 0.12) { return Ok(non_resolu(cote, "Dimensions du profil hors du domaine testé.", &cfg)); }
    let mut top_anchors: Vec<[f64; 2]> = vec![];
    let mut u = 0.012;
    while u < width - 0.012 {
        let near: Vec<&[f64; 2]> = head.iter().filter(|p| (p[0] - u).abs() < 0.004).collect();
        if !near.is_empty() { top_anchors.push([u, max_de(near.iter().map(|p| p[1]))]); }
        u += 0.006;
    }
    let mut face_anchors: Vec<[f64; 2]> = vec![];
    let mut z = -0.014;
    while z >= -0.033 {
        let near: Vec<&[f64; 2]> = head.iter().filter(|p| (p[1] - z).abs() < 0.004).collect();
        if !near.is_empty() { face_anchors.push([min_de(near.iter().map(|p| p[0])), z]); }
        z -= 0.004;
    }
    if top_anchors.len() < 3 || face_anchors.len() < 3 { return Ok(non_resolu(cote, "Surfaces du profil non identifiées.", &cfg)); }
    let borne = 0.025 * 0.025;
    let loss = |anchors: &[[f64; 2]], u: f64, z: f64, tampon: &mut Vec<f64>| -> f64 {
        tampon.clear();
        for a in anchors {
            let mut best = borne;
            for p in &points {
                let (du, dz) = (p[0] - u - a[0], p[1] - z - a[1]);
                let d = du * du + dz * dz; // ** 2 ≡ x*x au bit près (mesuré, Node et Chromium)
                best = ariane_js::min_positif_fini(best, d); // d ≥ +0 et fini : identique à `if (d < best) best = d`
            }
            tampon.push(best);
        }
        mediane(tampon)
    };
    let mut tampon = Vec::with_capacity(top_anchors.len().max(face_anchors.len()));
    #[derive(Clone, Copy)]
    struct Cand { loss: f64, u: f64, z: f64 }
    let mut best = Cand { loss: f64::INFINITY, u: 0.0, z: 0.0 };
    let mut coarse: Vec<Cand> = vec![];
    let mut search = |cu: f64, cz: f64, ry: f64, rz: f64, step: f64, retain: bool, best: &mut Cand, coarse: &mut Vec<Cand>| {
        let mut u = cu - ry;
        while u <= cu + ry + 1e-10 {
            let mut z = cz - rz;
            while z <= cz + rz + 1e-10 {
                let score = loss(&top_anchors, u, z, &mut tampon) + loss(&face_anchors, u, z, &mut tampon) + 1e-7 * (u.abs() + z.abs());
                if retain { coarse.push(Cand { loss: score, u, z }); }
                if score < best.loss { *best = Cand { loss: score, u, z }; }
                z += step;
            }
            u += step;
        }
    };
    search(0.0, 0.0, cfg.f("searchY")?, cfg.f("searchZ")?, cfg.f("grid")?, true, &mut best, &mut coarse);
    let coarse_best = best;
    let separation = cfg.f("alternativeSeparation")?;
    let mut alternative: Option<Cand> = None;
    for c in &coarse {
        if hypot(&[c.u - coarse_best.u, c.z - coarse_best.z]) < separation { continue; }
        if alternative.is_none_or(|a| c.loss < a.loss) { alternative = Some(*c); }
    }
    let ratio = match alternative { Some(a) if coarse_best.loss > 0.0 => a.loss / coarse_best.loss, _ => f64::INFINITY };
    search(best.u, best.z, 0.004, 0.004, 0.001, false, &mut best, &mut coarse);
    let (top_band, face_band) = (cfg.f("topBand")?, cfg.f("faceBand")?);
    let top_rows: Vec<[f64; 2]> = points.iter().filter(|p| p[0] > best.u + 0.012 && p[0] < best.u + width - 0.012 && (p[1] - best.z).abs() < top_band).map(|p| [p[0], p[1]]).collect();
    let top = match robust_line(&top_rows) { Some(t) => t, None => return Ok(non_resolu(cote, "Plan de roulement non estimable.", &cfg)) };
    let face_rows: Vec<[f64; 2]> = points.iter().filter(|p| {
        let drop = top.slope * p[0] + top.intercept - p[1];
        drop > 0.009 && drop < 0.034 && (p[0] - best.u).abs() < face_band
    }).map(|p| [p[1], p[0]]).collect();
    let face = robust_line(&face_rows);
    let (mut surface_u, mut surface_z) = (best.u, best.z);
    let mut reasons: Vec<&str> = vec![];
    if let Some(f) = &face {
        let denom = 1.0 - f.slope * top.slope;
        if denom.abs() > 0.5 { surface_u = (f.intercept + f.slope * top.intercept) / denom; surface_z = top.slope * surface_u + top.intercept; }
    }
    let (search_y, search_z) = (cfg.f("searchY")?, cfg.f("searchZ")?);
    if !surface_u.is_finite() || !surface_z.is_finite() || surface_u.abs() > search_y + 0.01 || surface_z.abs() > search_z + 0.01 {
        return Ok(non_resolu(cote, "Intersection hors de la fenêtre expérimentale.", &cfg));
    }
    let max_residual = cfg.f("maxResidual")?;
    let face_count = face.as_ref().map_or(0, |f| f.count) as f64;
    // face?.residual || maxResidual*2 : un résidu nul (ou NaN) est « faux » en JS
    let face_res = match &face { Some(f) if !(f.residual == 0.0 || f.residual.is_nan()) => f.residual, _ => max_residual * 2.0 };
    let residual = ariane_js::max(top.residual, face_res);
    let bins = |rows: &[[f64; 2]], pas: f64| rows.iter().map(|p| cle_same_value_zero((p[0] / pas).floor())).collect::<HashSet<_>>().len() as f64;
    let (bins_top, bins_face) = (bins(&top_rows, 0.006), bins(&face_rows, 0.005));
    let face_valeur = face.as_ref().map_or(Valeur::Nul, Droite::valeur);
    let metrics = obj(vec![
        ("points", n(points.len() as f64)), ("topCount", n(top.count as f64)), ("faceCount", n(face_count)), ("residual", n(residual)),
        ("seed", Valeur::Nombres(vec![sign * best.u, best.z])), ("surfaceIntersection", Valeur::Nombres(vec![sign * surface_u, surface_z])),
        ("topSpanBins", n(bins_top)), ("faceSpanBins", n(bins_face)), ("templateLoss", n(best.loss)),
        ("templateAmbiguity", obj(vec![
            ("coarseBestLoss", n(coarse_best.loss)),
            ("alternativeLoss", alternative.map_or(Valeur::Nul, |a| n(a.loss))),
            ("lossRatio", if ratio.is_finite() { n(ratio) } else { Valeur::Nul }),
            ("separation", alternative.map_or(Valeur::Nul, |a| n(hypot(&[a.u - coarse_best.u, a.z - coarse_best.z])))),
            ("alternative", alternative.map_or(Valeur::Nul, |a| Valeur::Nombres(vec![sign * a.u, a.z]))),
        ])),
    ]);
    let (min_top, min_face) = (cfg.f("minTop")?, cfg.f("minFace")?);
    let mut unsupported: Vec<&str> = vec![];
    if (top.count as f64) < min_top { unsupported.push("Plan de roulement insuffisamment observé."); }
    if face.is_none() || face_count < min_face { unsupported.push("Flanc interne insuffisamment observé."); }
    if top.slope_limited || face.as_ref().is_some_and(|f| f.slope_limited) { unsupported.push("Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée."); }
    let joint = |v: Valeur| avec(v, vec![("metrics", metrics.clone()), ("top", top.valeur()), ("face", face_valeur.clone())]);
    if !unsupported.is_empty() { return Ok(joint(non_resolu(cote, &unsupported.join(" "), &cfg))); }
    if ratio < cfg.f("minTemplateLossRatio")? {
        return Ok(joint(non_resolu(cote, "Plusieurs placements concurrents du champignon sont géométriquement plausibles.", &cfg)));
    }
    let tc = top.count as f64;
    let m1 = ariane_js::min(ariane_js::min(ariane_js::min(ariane_js::min(1.0, tc / min_top), face_count / min_face), bins_top / 5.0), bins_face / 3.0);
    let mut confidence = 100.0 * m1 * crate::exp(-residual / 0.006);
    confidence = ariane_js::round(ariane_js::max(0.0, ariane_js::min(100.0, confidence)));
    let non_verifiee = matches!(vis, Vis::Absente) || vis.contient_nul();
    if non_verifiee { confidence = ariane_js::min(confidence, 25.0); reasons.push("Découpe du nuage non vérifiée."); }
    if (top.count as f64) < min_top { reasons.push("Peu de points sur le dessus."); }
    if face_count < min_face { reasons.push("Peu de points sur le flanc interne."); }
    if residual > max_residual { reasons.push("Nappes dispersées."); }
    if confidence < cfg.f("minConfidence")? { reasons.push("Confiance heuristique faible."); }
    Ok(obj(vec![
        ("side", s(cote)), ("status", s("candidate")), ("delta", Valeur::Nombres(vec![0.0, sign * best.u, best.z])), ("confidence", n(confidence)),
        ("reasons", Valeur::Tableau(reasons.iter().map(|r| Some(s(r))).collect())), ("method", cfg.brut("method").clone()),
        ("source", s("lidar-template-supported")), ("parameters", cfg.valeur.clone()), ("metrics", metrics), ("top", top.valeur()), ("face", face_valeur),
    ]))
}

/// `enforcePairSupport` sur les deux propositions (déjà calculées par ce port).
pub fn enforce_pair_support(mut gauche: Valeur, mut droite: Valeur, options: &Valeur) -> Result<Valeur, Echec> {
    let cfg = Reglages::fusionner(options, false)?;
    cfg.coherence()?;
    let lat = |p: &Valeur| -> Option<f64> {
        match p.champ("delta") { Some(Valeur::Nombres(d)) => Some(d[1].abs()), _ => None }
    };
    let (lg, ld) = (lat(&gauche), lat(&droite));
    if let (Some(lg), Some(ld)) = (lg, ld) {
        let max_single = cfg.f("maxSingleRailLateral")?;
        let paired = cfg.f("pairedSupportLateral")?;
        let extreme = if lg > max_single { Some(0) } else if ld > max_single { Some(1) } else { None };
        if let Some(e) = extreme {
            let autre = if e == 0 { ld } else { lg };
            if autre < paired {
                let cible = if e == 0 { &mut gauche } else { &mut droite };
                let mut raisons = match cible.champ("reasons") { Some(Valeur::Tableau(t)) => t.clone(), _ => vec![] };
                raisons.push(Some(s("Grand déplacement isolé : le second rail ne confirme pas ce placement.")));
                *cible = avec(cible.clone(), vec![("status", s("unresolved")), ("delta", Valeur::Nul), ("confidence", n(0.0)),
                    ("source", s("no-estimate")), ("reasons", Valeur::Tableau(raisons))]);
            }
        }
    }
    Ok(obj(vec![("left", gauche), ("right", droite)]))
}

pub fn propose_both(capture: &Valeur, options: &Valeur) -> Result<Valeur, Echec> {
    let g = propose(capture, "left", options)?;
    let d = propose(capture, "right", options)?;
    enforce_pair_support(g, d, options)
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn droite_robuste_exacte_sur_une_droite() {
        let rows: Vec<[f64; 2]> = (0..40).map(|i| { let x = i as f64 * 0.002; [x, 0.25 * x + 0.1] }).collect();
        let d = robust_line(&rows).unwrap();
        assert!((d.slope - 0.25).abs() < 1e-12 && !d.slope_limited && d.count == 40);
        assert!(robust_line(&rows[..2]).is_none());
    }
    #[test]
    fn pente_bornee() {
        let rows: Vec<[f64; 2]> = (0..20).map(|i| { let x = i as f64 * 0.01; [x, 2.0 * x] }).collect();
        let d = robust_line(&rows).unwrap();
        assert_eq!(d.slope, 0.5);
        assert!(d.slope_limited);
    }
    #[test]
    fn reglages_ordre_des_cles_et_validation() {
        let o = Valeur::Objet(vec![("autre".into(), Valeur::Nombre(1.0)), ("grid".into(), Valeur::Nombre(0.004)), ("method".into(), s("x"))]);
        let r = Reglages::fusionner(&o, true).unwrap();
        let Valeur::Objet(t) = &r.valeur else { panic!() };
        let cles: Vec<&str> = t.iter().map(|(k, _)| k.as_str()).collect();
        assert_eq!(cles.len(), 15);
        assert_eq!(cles[2], "grid");
        assert_eq!(cles[13], "method");
        assert_eq!(cles[14], "autre");
        assert_eq!(r.brut("method"), &s(METHODE));
        let mauvais = Reglages::fusionner(&Valeur::Objet(vec![("grid".into(), Valeur::Nombre(0.0))]), true).unwrap();
        assert_eq!(mauvais.valider(), Err(Echec::erreur("Paramètre géométrique invalide : grid")));
    }
    #[test]
    fn profil_absent_et_nuage_vide() {
        let c = Valeur::Objet(vec![("rails".into(), Valeur::Objet(vec![]))]);
        assert_eq!(propose(&c, "left", &Valeur::Indefini), Err(Echec::erreur("Profil absent : left")));
        let c = Valeur::Objet(vec![("rails".into(), Valeur::Objet(vec![("left".into(), Valeur::Objet(vec![]))]))]);
        let v = propose(&c, "left", &Valeur::Indefini).unwrap();
        assert_eq!(v.champ("reasons"), Some(&Valeur::Tableau(vec![Some(s("Aucun point LiDAR disponible."))])));
    }
}
