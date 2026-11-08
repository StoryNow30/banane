//! `src/geometry-candidate-v1.js` (GCV1) : la méthode V4.6 et ses options de laboratoire (`options.lab`), à l'identique.
//! Module distinct de `v46` comme les deux fichiers JS sont distincts : chacun suit son fichier.
//!
//! `lab.onCoarse` (une fonction) ne traverse pas : la façade le remplace par la chaîne `RAPPEL`, qui vaut « fonction »
//! ici ; le cœur rend la liste des appels (grille et méta), que la façade rejoue dans l'ordre, et la façade remet la
//! fonction à sa place dans `parameters.lab`.
use crate::v46::{avec, hd, n, obj, pour_chaque_point, robust_line, s, sommets, vis, longueur_tableau, Droite, Reglages, Vis};
use ariane_capture::{point, M16};
use ariane_js::{cle_same_value_zero, hypot, max_de, mediane, min_de, Echec};
use ariane_vba::Valeur;
use std::collections::HashSet;

/// Valeur que la façade met à la place de `lab.onCoarse` (une fonction ne traverse pas) : vaut « fonction » ici.
pub const RAPPEL: &str = "\u{0}ariane:onCoarse";
const ECHEC_PLAN: &str = "Plan de roulement non estimable.";
const MIN_TOP_ROWS: usize = 3;
const DEF_MIN_FACE: f64 = 6.0;
const DEF_MIN_TOP: f64 = 15.0;

/// Un appel de `lab.onCoarse(cells, meta)` à rejouer par la façade.
pub struct AppelRappel {
    /// Les cases grossières, à plat : u, z, loss.
    pub cellules: Vec<f64>,
    /// Le meilleur candidat au moment de l'appel : u, z, loss.
    pub meilleur: [f64; 3],
    /// Les centres de fenêtre en u (`uCenters.slice()`).
    pub centres: Vec<f64>,
    /// Le `lab` de cet appel (celui des options, ou celui d'une reprise de `pairZTransfer`).
    pub lab: Valeur,
}

struct Lab<'a> { v: &'a Valeur }
impl Lab<'_> {
    fn c(&self, k: &str) -> &Valeur { self.v.champ(k).unwrap_or(&Valeur::Indefini) }
    fn vrai(&self, k: &str) -> bool { self.c(k).vrai() }
    fn fini(&self, k: &str) -> Option<f64> { match self.c(k) { Valeur::Nombre(x) if x.is_finite() => Some(*x), _ => None } }
}

#[derive(Clone, Copy)]
struct Cand { loss: f64, u: f64, z: f64, top_rows: Option<usize>, score: f64 }

/// Lab effectif : `options.lab && typeof options.lab === 'object'` (objet simple seulement ; un tableau : hors domaine).
fn lab_de(options: &Valeur) -> Result<Option<&Valeur>, Echec> {
    match options {
        Valeur::Indefini => Ok(None),
        Valeur::Objet(_) => match options.champ("lab") {
            Some(l @ Valeur::Objet(_)) => Ok(Some(l)),
            Some(Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Bloc { .. } | Valeur::Booleens(_)) => hd("lab tableau"),
            _ => Ok(None),
        },
        _ => hd("options non objet"), // null : le JS lève sur options.lab
    }
}

fn non_resolu(cote: &str, raison: &str, cfg: &Reglages, parametres: &Valeur) -> Valeur {
    obj(vec![("side", s(cote)), ("status", s("unresolved")), ("delta", Valeur::Nul), ("confidence", n(0.0)),
        ("reasons", Valeur::Tableau(vec![Some(s(raison))])), ("method", cfg.brut("method").clone()), ("source", s("no-estimate")),
        ("parameters", parametres.clone())])
}

/// `propose(capture, side, options)` de GCV1 ; les appels de `lab.onCoarse` sont ajoutés à `appels`, dans l'ordre.
///
/// # Errors
/// L'exception que lèverait le JS (réglage invalide ou incohérent, profil absent, projection non finie) ; hors domaine
/// pour une entrée que le port ne reproduit pas (la façade rejoue alors le JS).
pub fn propose(capture: &Valeur, cote: &str, options: &Valeur, appels: &mut Vec<AppelRappel>) -> Result<Valeur, Echec> {
    let lab_v = lab_de(options)?;
    let cfg = Reglages::fusionner_sans(options, true, true)?;
    if !matches!(capture, Valeur::Objet(_)) { return hd("capture non objet"); }
    let rails = capture.champ("rails");
    let rail = match rails {
        None | Some(Valeur::Indefini | Valeur::Nul) => None,
        Some(r @ Valeur::Objet(_)) => r.champ(cote),
        Some(_) => return hd("rails non objet"),
    };
    cfg.valider()?;
    let rail = match rail {
        None | Some(Valeur::Indefini | Valeur::Nul | Valeur::Booleen(false)) => return Err(Echec::erreur(format!("Profil absent : {cote}"))),
        Some(r @ Valeur::Objet(_)) => r,
        Some(_) => return hd("rail non objet"),
    };
    // parameters = lab ? {...cfg, lab: {...lab}} : cfg
    let parametres = match lab_v { Some(l) => avec(cfg.valeur.clone(), vec![("lab", l.clone())]), None => cfg.valeur.clone() };
    let nr = |r: &str| non_resolu(cote, r, &cfg, &parametres);
    let ps = capture.champ("pointsSceneRelative").unwrap_or(&Valeur::Indefini);
    let nps = match ps { Valeur::Indefini | Valeur::Nul => 0, _ => longueur_tableau(ps).ok_or_else(|| Echec::hors_domaine("pointsSceneRelative"))? };
    if nps == 0 { return Ok(nr("Aucun point LiDAR disponible.")); }
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
                let Some(b @ Valeur::Objet(_)) = b else { return hd("contour non objet") };
                if lg(Some(b))? > lg(a)? { a = Some(b); }
            }
            a
        }
        Some(_) => return hd("profileContours"),
    };
    let Some(contour) = contour else { return Ok(nr("Contour du profil absent.")) };
    let m: M16 = match rail.champ("sceneRelativeToProfileLocal") {
        Some(Valeur::Nombres(t)) if t.len() >= 16 => { let mut a = [0.0; 16]; a.copy_from_slice(&t[..16]); a }
        _ => return hd("sceneRelativeToProfileLocal"),
    };
    let mut shape = vec![];
    for p in sommets(contour.champ("verticesSceneRelative").unwrap_or(&Valeur::Indefini))? { shape.push(point(&m, p[0], p[1], p[2])?); }
    let sign = ariane_js::sign(mediane(&shape.iter().map(|p| p[1]).collect::<Vec<_>>()));
    if sign.is_nan() || sign == 0.0 { return Ok(nr("Sens du profil ambigu.")); }
    let vertices: Vec<[f64; 2]> = shape.iter().map(|p| [sign * p[1], p[2]]).collect();
    let head: Vec<[f64; 2]> = vertices.iter().copied().filter(|p| p[1] > -0.04).collect();
    if head.len() < 6 { return Ok(nr("Contour de champignon non reconnu.")); }
    let vis = vis(capture.champ("visibleByClipBoxes"))?;
    let mut points: Vec<[f64; 3]> = vec![];
    pour_chaque_point(ps, &vis, &m, |q| {
        if q.iter().all(|v| v.is_finite()) && q[0].abs() <= 0.5 && q[1].abs() < 0.18 && q[2].abs() < 0.10 { points.push([sign * q[1], q[2], q[0]]); }
    })?;
    if points.len() < 8 { return Ok(nr("Trop peu de points autour du champignon.")); }
    let width = max_de(head.iter().filter(|p| p[1] > -0.012).map(|p| p[0]));
    if !(width > 0.025 && width < 0.12) { return Ok(nr("Dimensions du profil hors du domaine testé.")); }
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
    if top_anchors.len() < 3 || face_anchors.len() < 3 { return Ok(nr("Surfaces du profil non identifiées.")); }
    let borne = 0.025 * 0.025;
    let loss = |anchors: &[[f64; 2]], u: f64, z: f64, tampon: &mut Vec<f64>| -> f64 {
        tampon.clear();
        for a in anchors {
            let mut best = borne;
            for p in &points {
                let (du, dz) = (p[0] - u - a[0], p[1] - z - a[1]);
                let d = du * du + dz * dz;
                best = ariane_js::min_positif_fini(best, d); // d ≥ +0 et fini : identique à `if (d < best) best = d`
            }
            tampon.push(best);
        }
        mediane(tampon)
    };
    let mut tampon = Vec::with_capacity(top_anchors.len().max(face_anchors.len()));
    let mut best = Cand { loss: f64::INFINITY, u: 0.0, z: 0.0, top_rows: None, score: f64::NAN };
    let mut coarse: Vec<Cand> = vec![];
    let mut search = |cu: f64, cz: f64, ry: f64, rz: f64, step: f64, retain: bool, best: &mut Cand, coarse: &mut Vec<Cand>| {
        let mut u = cu - ry;
        while u <= cu + ry + 1e-10 {
            let mut z = cz - rz;
            while z <= cz + rz + 1e-10 {
                let score = loss(&top_anchors, u, z, &mut tampon) + loss(&face_anchors, u, z, &mut tampon) + 1e-7 * (u.abs() + z.abs());
                let c = Cand { loss: score, u, z, top_rows: None, score: f64::NAN };
                if retain { coarse.push(c); }
                if score < best.loss { *best = c; }
                z += step;
            }
            u += step;
        }
    };
    let (search_y, search_z, grid) = (cfg.f("searchY")?, cfg.f("searchZ")?, cfg.f("grid")?);
    let lab = lab_v.map(|v| Lab { v });
    let mut u_centers: Vec<f64> = vec![0.0];
    if let Some(l) = &lab {
        match l.c("uSeeds") {
            v @ (Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Bloc { .. } | Valeur::Booleens(_)) => {
                let seeds: Vec<f64> = v.elements().unwrap_or_default().into_iter().filter_map(|e| match e { Valeur::Nombre(x) if x.is_finite() => Some(x), _ => None }).collect();
                if !seeds.is_empty() {
                    if l.vrai("replaceOrigin") { u_centers.clear(); }
                    for u in seeds { if !u_centers.iter().any(|c| (c - u).abs() < 1e-9) { u_centers.push(u); } }
                }
            }
            _ if l.vrai("cloudUSeed") => {
                let u_med = mediane(&points.iter().map(|p| p[0]).collect::<Vec<_>>());
                if u_med.is_finite() {
                    if l.vrai("replaceOrigin") { u_centers.clear(); u_centers.push(u_med); } else if u_med.abs() > 1e-9 { u_centers.push(u_med); }
                }
            }
            _ => {}
        }
        if u_centers.is_empty() { u_centers.push(0.0); }
    }
    for &cu in &u_centers { search(cu, 0.0, search_y, search_z, grid, true, &mut best, &mut coarse); }
    let loss_min_coarse = best;
    let top_band = cfg.f("topBand")?;
    let top_rows_at = |u: f64, z: f64| points.iter().filter(|p| p[0] > u + 0.012 && p[0] < u + width - 0.012 && (p[1] - z).abs() < top_band).count();
    let separation = cfg.f("alternativeSeparation")?;
    if let Some(l) = &lab {
        if l.vrai("cloudZSeed") {
            let z_med = mediane(&points.iter().map(|p| p[1]).collect::<Vec<_>>());
            if z_med.is_finite() { search(0.0, z_med, search_y, search_z, grid, true, &mut best, &mut coarse); }
        }
        if let Some(pz) = l.fini("pairSeedZ") { search(0.0, pz, search_y, search_z, grid, true, &mut best, &mut coarse); }
        if l.vrai("lockZToCloud") {
            let z_med = mediane(&points.iter().map(|p| p[1]).collect::<Vec<_>>());
            if z_med.is_finite() {
                let mut pick: Option<usize> = None;
                for (i, c) in coarse.iter().enumerate() {
                    if (c.z - z_med).abs() > 0.012 { continue; }
                    if pick.is_none_or(|p| c.loss < coarse[p].loss) { pick = Some(i); }
                }
                if pick.is_none() {
                    for (i, c) in coarse.iter().enumerate() {
                        if pick.is_none_or(|p| (c.z - z_med).abs() < (coarse[p].z - z_med).abs()) { pick = Some(i); }
                    }
                }
                if let Some(p) = pick { let c = coarse[p]; best = Cand { loss: c.loss, u: c.u, z: c.z, top_rows: None, score: f64::NAN }; }
            }
        }
        let penalty = l.fini("supportPenalty").unwrap_or(0.0);
        if l.vrai("preferSupported") || penalty > 0.0 || l.vrai("multiMinima") {
            for i in 0..coarse.len() { let (u, z) = (coarse[i].u, coarse[i].z); coarse[i].top_rows = Some(top_rows_at(u, z)); }
            if penalty > 0.0 {
                let mut pick = 0usize;
                for i in 0..coarse.len() {
                    let tr = coarse[i].top_rows.unwrap_or(0); // calculé juste au-dessus pour toutes les cases
                    coarse[i].score = coarse[i].loss + penalty * (if tr < MIN_TOP_ROWS { 1.0 } else { 0.0 });
                    if coarse[i].score < coarse[pick].score { pick = i; }
                }
                let c = coarse[pick];
                best = Cand { loss: c.loss, u: c.u, z: c.z, top_rows: None, score: f64::NAN };
            }
            if l.vrai("multiMinima") {
                let mut minima: Vec<Cand> = vec![];
                for (i, c) in coarse.iter().enumerate() {
                    let mut local = true;
                    for (j, o) in coarse.iter().enumerate() {
                        if i == j { continue; }
                        if hypot(&[o.u - c.u, o.z - c.z]) >= separation { continue; }
                        if o.loss < c.loss { local = false; break; }
                    }
                    if local { minima.push(*c); }
                }
                minima.sort_by(|a, b| { let d = a.loss - b.loss; if d < 0.0 { std::cmp::Ordering::Less } else if d > 0.0 { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal } });
                let supported: Vec<&Cand> = minima.iter().filter(|c| c.top_rows.unwrap_or(0) >= MIN_TOP_ROWS).collect();
                let pick = if l.vrai("preferSupported") && !supported.is_empty() { Some(*supported[0]) } else { minima.first().copied() };
                if let Some(c) = pick { best = Cand { loss: c.loss, u: c.u, z: c.z, top_rows: None, score: f64::NAN }; }
            } else if l.vrai("preferSupported") {
                let mut sup: Option<Cand> = None;
                for c in &coarse { if c.top_rows.unwrap_or(0) >= MIN_TOP_ROWS && sup.is_none_or(|s| c.loss < s.loss) { sup = Some(*c); } }
                if let Some(c) = sup { best = Cand { loss: c.loss, u: c.u, z: c.z, top_rows: None, score: f64::NAN }; }
            }
        }
        if matches!(l.c("onCoarse"), Valeur::Chaine(c) if c == RAPPEL) {
            appels.push(AppelRappel {
                cellules: coarse.iter().flat_map(|c| [c.u, c.z, c.loss]).collect(),
                meilleur: [best.u, best.z, best.loss], centres: u_centers.clone(), lab: l.v.clone(),
            });
        }
    }
    let coarse_best = best;
    let mut alternative: Option<Cand> = None;
    let prefer = lab.as_ref().is_some_and(|l| l.vrai("preferSupported"));
    for c in &coarse {
        if prefer && c.top_rows.unwrap_or_else(|| top_rows_at(c.u, c.z)) < MIN_TOP_ROWS { continue; }
        if hypot(&[c.u - coarse_best.u, c.z - coarse_best.z]) < separation { continue; }
        if alternative.is_none_or(|a| c.loss < a.loss) { alternative = Some(*c); }
    }
    let ratio = match alternative { Some(a) if coarse_best.loss > 0.0 => a.loss / coarse_best.loss, _ => f64::INFINITY };
    search(best.u, best.z, 0.004, 0.004, 0.001, false, &mut best, &mut coarse);
    if lab.as_ref().is_some_and(|l| l.vrai("preserveCoarseSupport")) {
        let (refined_n, coarse_n) = (top_rows_at(best.u, best.z), top_rows_at(coarse_best.u, coarse_best.z));
        if refined_n < MIN_TOP_ROWS && coarse_n >= MIN_TOP_ROWS { best = coarse_best; }
    }
    let face_band = cfg.f("faceBand")?;
    let top_rows: Vec<[f64; 2]> = points.iter().filter(|p| p[0] > best.u + 0.012 && p[0] < best.u + width - 0.012 && (p[1] - best.z).abs() < top_band).map(|p| [p[0], p[1]]).collect();
    let Some(top) = robust_line(&top_rows) else { return Ok(nr("Plan de roulement non estimable.")) };
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
    let mut u_window_ok = surface_u.abs() <= search_y + 0.01;
    if lab.as_ref().is_some_and(|l| l.vrai("recenterWindow")) { u_window_ok = u_centers.iter().any(|cu| (surface_u - cu).abs() <= search_y + 0.01); }
    if !surface_u.is_finite() || !surface_z.is_finite() || !u_window_ok || surface_z.abs() > search_z + 0.01 {
        return Ok(nr("Intersection hors de la fenêtre expérimentale."));
    }
    let max_residual = cfg.f("maxResidual")?;
    let face_count = face.as_ref().map_or(0, |f| f.count) as f64;
    let face_res = match &face { Some(f) if !(f.residual == 0.0 || f.residual.is_nan()) => f.residual, _ => max_residual * 2.0 };
    let residual = ariane_js::max(top.residual, face_res);
    let bins = |rows: &[[f64; 2]], pas: f64| rows.iter().map(|p| cle_same_value_zero((p[0] / pas).floor())).collect::<HashSet<_>>().len() as f64;
    let (bins_top, bins_face) = (bins(&top_rows, 0.006), bins(&face_rows, 0.005));
    let face_valeur = face.as_ref().map_or(Valeur::Nul, Droite::valeur);
    let (min_top, min_face) = (cfg.f("minTop")?, cfg.f("minFace")?);
    let mut metrics_t: Vec<(&str, Valeur)> = vec![
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
    ];
    let mut lab_m: Vec<(&str, Valeur)> = vec![];
    if let Some(l) = &lab {
        lab_m = vec![
            ("lossMinCoarse", Valeur::Nombres(vec![sign * loss_min_coarse.u, loss_min_coarse.z, loss_min_coarse.loss])),
            ("selectedCoarse", Valeur::Nombres(vec![sign * coarse_best.u, coarse_best.z, coarse_best.loss])),
            ("topRows", n(top_rows.len() as f64)), ("coarseCount", n(coarse.len() as f64)),
            ("uCenters", if u_centers.is_empty() { Valeur::Tableau(vec![]) } else { Valeur::Nombres(u_centers.clone()) }),
            ("recenterWindow", Valeur::Booleen(l.vrai("recenterWindow"))), ("replaceOrigin", Valeur::Booleen(l.vrai("replaceOrigin"))),
            ("flank", obj(vec![
                ("faceRows", n(face_rows.len() as f64)), ("faceCount", n(face_count)), ("topCount", n(top.count as f64)), ("topSlope", n(top.slope)),
                ("topSlopeLimited", Valeur::Booleen(top.slope_limited)), ("faceSlope", face.as_ref().map_or(Valeur::Nul, |f| n(f.slope))),
                ("faceSlopeLimited", Valeur::Booleen(face.as_ref().is_some_and(|f| f.slope_limited))), ("faceBand", n(face_band)),
                ("minTop", cfg.brut("minTop").clone()), ("minFace", cfg.brut("minFace").clone()),
            ])),
        ];
    }
    let mut unsupported: Vec<&str> = vec![];
    let min_top_req = min_top;
    let mut min_face_req = min_face;
    let lab_portes = lab.as_ref().filter(|l| l.vrai("adaptiveFace") || l.vrai("relativeFace") || l.vrai("partialFaceKeep") || l.vrai("explicitFaceAbstain"));
    if let Some(l) = lab_portes {
        if l.vrai("adaptiveFace") {
            let visibles = points.iter().filter(|p| (p[0] - best.u).abs() < face_band && p[1] < best.z - 0.006 && p[1] > best.z - 0.040).count() as f64;
            min_face_req = if visibles <= 0.0 { min_face } else { ariane_js::min(min_face, ariane_js::max(3.0, visibles)) };
            lab_m.push(("adaptiveFace", obj(vec![("visibleInZone", n(visibles)), ("minFaceReq", n(min_face_req))])));
        }
        if l.vrai("relativeFace") {
            min_face_req = ariane_js::max(3.0, ariane_js::round(DEF_MIN_FACE * top.count as f64 / DEF_MIN_TOP));
            lab_m.push(("relativeFace", obj(vec![("minFaceReq", n(min_face_req)), ("topCount", n(top.count as f64)), ("ratio", n(DEF_MIN_FACE / DEF_MIN_TOP))])));
        }
        let strong_rs = top.count as f64 >= DEF_MIN_TOP;
        let face_partial = face.is_some() && face_count >= 3.0 && face_count < min_face_req;
        let skip_face_gate = l.vrai("partialFaceKeep") && strong_rs && face_partial && !top.slope_limited && face.as_ref().is_some_and(|f| !f.slope_limited); // face existe si face_partial
        if l.vrai("partialFaceKeep") {
            lab_m.push(("partialFaceKeep", obj(vec![("strongRs", Valeur::Booleen(strong_rs)), ("facePartial", Valeur::Booleen(face_partial)),
                ("skipFaceGate", Valeur::Booleen(skip_face_gate)), ("faceCount", n(face_count)), ("minFaceReq", n(min_face_req))])));
        }
        lab_m.push(("minTopReq", n(min_top_req)));
        lab_m.push(("minFaceReq", n(min_face_req)));
        lab_m.push(("skipFaceGate", Valeur::Booleen(skip_face_gate)));
        if (top.count as f64) < min_top_req { unsupported.push("Plan de roulement insuffisamment observé."); }
        if (face.is_none() || face_count < min_face_req) && !skip_face_gate {
            if l.vrai("explicitFaceAbstain") {
                if face.is_none() || face_count < 3.0 {
                    unsupported.push(if face_rows.is_empty() { "Flanc interne absent de la fenêtre d’observation ; abstention." } else { "Flanc interne trop clairsemé pour estimer une nappe ; abstention." });
                } else { unsupported.push("Flanc interne partiellement observé ; abstention plutôt que publication."); }
            } else { unsupported.push("Flanc interne insuffisamment observé."); }
        }
        if top.slope_limited || face.as_ref().is_some_and(|f| f.slope_limited) { unsupported.push("Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée."); }
    } else {
        if (top.count as f64) < min_top { unsupported.push("Plan de roulement insuffisamment observé."); }
        if face.is_none() || face_count < min_face { unsupported.push("Flanc interne insuffisamment observé."); }
        if top.slope_limited || face.as_ref().is_some_and(|f| f.slope_limited) { unsupported.push("Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée."); }
    }
    if lab.is_some() { metrics_t.push(("lab", obj(lab_m))); }
    let metrics = obj(metrics_t);
    let joint = |v: Valeur| avec(v, vec![("metrics", metrics.clone()), ("top", top.valeur()), ("face", face_valeur.clone())]);
    if !unsupported.is_empty() { return Ok(joint(nr(&unsupported.join(" ")))); }
    if ratio < cfg.f("minTemplateLossRatio")? { return Ok(joint(nr("Plusieurs placements concurrents du champignon sont géométriquement plausibles."))); }
    let tc = top.count as f64;
    let m1 = ariane_js::min(ariane_js::min(ariane_js::min(ariane_js::min(1.0, tc / min_top), face_count / min_face), bins_top / 5.0), bins_face / 3.0);
    let mut confidence = 100.0 * m1 * crate::exp(-residual / 0.006);
    confidence = ariane_js::round(ariane_js::max(0.0, ariane_js::min(100.0, confidence)));
    if matches!(vis, Vis::Absente) || vis.contient_nul() { confidence = ariane_js::min(confidence, 25.0); reasons.push("Découpe du nuage non vérifiée."); }
    if tc < min_top { reasons.push("Peu de points sur le dessus."); }
    if face_count < min_face { reasons.push("Peu de points sur le flanc interne."); }
    if residual > max_residual { reasons.push("Nappes dispersées."); }
    if confidence < cfg.f("minConfidence")? { reasons.push("Confiance heuristique faible."); }
    Ok(obj(vec![
        ("side", s(cote)), ("status", s("candidate")), ("delta", Valeur::Nombres(vec![0.0, sign * best.u, best.z])), ("confidence", n(confidence)),
        ("reasons", Valeur::Tableau(reasons.iter().map(|r| Some(s(r))).collect())), ("method", cfg.brut("method").clone()),
        ("source", s("lidar-template-supported")), ("parameters", parametres), ("metrics", metrics), ("top", top.valeur()), ("face", face_valeur),
    ]))
}

/// `enforcePairSupport` de GCV1 (`delete cfg.lab`, sans forcer `method`), sur un objet `{left, right}` quelconque.
///
/// # Errors
/// Réglages incohérents ; hors domaine pour des options non objet ou des raisons non tabulaires.
pub fn enforce_pair_support(mut props: Valeur, options: &Valeur) -> Result<Valeur, Echec> {
    let cfg = Reglages::fusionner_sans(options, false, true)?;
    let delta = |p: Option<&Valeur>| -> Option<f64> { match p.and_then(|p| p.champ("delta")) { Some(Valeur::Nombres(d)) if d.len() >= 2 => Some(d[1].abs()), _ => None } };
    let (lg, ld) = (delta(props.champ("left")), delta(props.champ("right")));
    cfg.coherence()?;
    if let (Some(lg), Some(ld)) = (lg, ld) {
        let (max_single, paired) = (cfg.f("maxSingleRailLateral")?, cfg.f("pairedSupportLateral")?);
        let extreme = if lg > max_single { Some("left") } else if ld > max_single { Some("right") } else { None };
        if let Some(e) = extreme {
            let autre = if e == "left" { ld } else { lg };
            if autre < paired {
                let Some(courant) = props.champ(e).cloned() else { return Ok(props) };
                let mut raisons = match courant.champ("reasons") { Some(Valeur::Tableau(t)) => t.clone(), Some(Valeur::Indefini | Valeur::Nul) | None => vec![], Some(_) => return hd("reasons") };
                raisons.push(Some(s("Grand déplacement isolé : le second rail ne confirme pas ce placement.")));
                let nouveau = avec(courant, vec![("status", s("unresolved")), ("delta", Valeur::Nul), ("confidence", n(0.0)), ("source", s("no-estimate")), ("reasons", Valeur::Tableau(raisons))]);
                props = avec(props, vec![(e, nouveau)]);
            }
        }
    }
    Ok(props)
}

/// `proposeBoth(capture, options)` de GCV1, `pairZTransfer` compris.
///
/// # Errors
/// L'exception que lèverait le JS (réglage invalide ou incohérent, profil absent, projection non finie) ; hors domaine
/// pour une entrée que le port ne reproduit pas (la façade rejoue alors le JS).
pub fn propose_both(capture: &Valeur, options: &Valeur, appels: &mut Vec<AppelRappel>) -> Result<Valeur, Echec> {
    let lab = lab_de(options)?;
    let g = propose(capture, "left", options, appels)?;
    let d = propose(capture, "right", options, appels)?;
    let mut out = enforce_pair_support(obj(vec![("left", g), ("right", d)]), options)?;
    let lab = match lab { Some(l) if l.champ("pairZTransfer").is_some_and(Valeur::vrai) => l, _ => return Ok(out) };
    for (cote, autre) in [("left", "right"), ("right", "left")] {
        let Some(p) = out.champ(cote) else { continue };
        let echoue = matches!(p.champ("status"), Some(Valeur::Chaine(st)) if st == "unresolved") && match p.champ("reasons") {
            Some(Valeur::Tableau(t)) => t.iter().map(|r| match r { Some(Valeur::Chaine(c)) => Ok(c.as_str()), _ => Err(()) }).collect::<Result<Vec<_>, _>>().map_err(|()| Echec::hors_domaine("raisons"))?.join(" ").contains(ECHEC_PLAN),
            _ => false,
        };
        let Some(o) = out.champ(autre) else { continue };
        let pz = match (o.champ("status"), o.champ("delta")) { (Some(Valeur::Chaine(st)), Some(Valeur::Nombres(d))) if st == "candidate" && d.len() >= 3 => Some(d[2]), _ => None };
        let (true, Some(pz)) = (echoue, pz) else { continue };
        let lab2 = avec(lab.clone(), vec![("cloudZSeed", Valeur::Booleen(true)), ("preferSupported", Valeur::Booleen(true)), ("pairSeedZ", n(pz))]);
        let options2 = avec(options.clone(), vec![("lab", lab2)]);
        let retry = propose(capture, cote, &options2, appels)?;
        out = avec(out, vec![(cote, retry)]);
    }
    enforce_pair_support(out, options)
}
