//! Modules lus par la décision du lot, à l'identique :
//! `src/continuity-observer.js` (`fitAt`, `predict`, `translated`), `src/hauteur-apprise.js` (`evaluer`), `src/faux-vert-ombre.js` (`evaluer`).
use crate::critere::vers_nombre;
use crate::js::*;
use crate::metier::json_aller_retour;
use ariane_geometrie::convention;
use ariane_vba::Valeur as V;

pub const SIDES: [&str; 2] = ["left", "right"];

// ---------------------------------------------------------------- continuité
/// `fitAt(points)` : moindres carrés y = a + b·x, évalué en x = 0.
pub fn fit_at(p_: &[[f64; 2]]) -> f64 {
    if p_.len() == 1 { return p_[0][1]; }
    let (mut sx, mut sy, mut sxx, mut sxy) = (0.0, 0.0, 0.0, 0.0);
    for [x, y] in p_ { sx += x; sy += y; sxx += x * x; sxy += x * y; }
    let nn = p_.len() as f64;
    let d = nn * sxx - sx * sx;
    let bb = if d.abs() > 1e-12 { (nn * sxy - sx * sy) / d } else { 0.0 };
    (sy - bb * sx) / nn
}
pub struct Prediction { pub lateral: f64, pub vertical: f64, pub translation: [f64; 3] }
/// Décalages locaux des appuis (`C.point(M, a.positions[side]) − o`).
pub fn locaux(initial: &V, anchors: &[V], side: &str) -> R<([f64; 3], Vec<[f64; 3]>)> {
    let m = p(initial, "sceneRelativeToProfileLocal")?;
    let o_ = point_v(m, g(initial, "positionSceneRelative"))?;
    let mut q = vec![];
    for a in anchors {
        let pos = p(a, "positions")?;
        let pp = point_v(m, p(pos, side)?)?;
        q.push([pp[0] - o_[0], pp[1] - o_[1], pp[2] - o_[2]]);
    }
    Ok((o_, q))
}
pub fn translation_de(initial: &V, o_: [f64; 3], lateral: f64, vertical: f64) -> R<[f64; 3]> {
    let pm = g(initial, "profileLocalToSceneRelative");
    let a = point_v(pm, &tab_n(&o_))?;
    let b_ = point_v(pm, &tab_n(&[o_[0], o_[1] + lateral, o_[2] + vertical]))?;
    Ok([b_[0] - a[0], b_[1] - a[1], b_[2] - a[2]])
}
/// `O.predict(initial, anchors, side)`.
pub fn predict(initial: &V, anchors: &[V], side: &str) -> R<Prediction> {
    if nullish(initial) { return hd("rail initial absent"); }
    let (o_, q) = locaux(initial, anchors, side)?;
    let lateral = fit_at(&q.iter().map(|p_| [p_[0], p_[1]]).collect::<Vec<_>>());
    let vertical = fit_at(&q.iter().map(|p_| [p_[0], p_[2]]).collect::<Vec<_>>());
    Ok(Prediction { lateral, vertical, translation: translation_de(initial, o_, lateral, vertical)? })
}
/// `O.translated(rail, t)` : copie JSON du rail, repères translatés, inverse recalculé, contours translatés.
pub fn translated(rail: &V, t: [f64; 3]) -> R<V> {
    let mut r = json_aller_retour(rail)?;
    if !est_simple(&r) { return hd("rail non objet"); }
    let add = |p_: &V| -> R<V> {
        if nullish(p_) { return hd("point absent"); }
        let [x, y, z] = [gi(p_, 0)?, gi(p_, 1)?, gi(p_, 2)?].map(|v| vers_nombre(&v));
        Ok(tab_n(&[x? + t[0], y? + t[1], z? + t[2]]))
    };
    let mut tr = [1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.];
    tr[12] = t[0]; tr[13] = t[1]; tr[14] = t[2];
    for k in ["railLocalToSceneRelative", "profileLocalToSceneRelative"] {
        let m = m16_lecture(g(&r, k))?;
        definir_v(&mut r, k, tab_n(&ariane_capture::multiply(&tr, &m)));
    }
    let inv = ariane_capture::inverse(&ariane_capture::matrice(&canon(g(&r, "profileLocalToSceneRelative")))?)?;
    definir_v(&mut r, "sceneRelativeToProfileLocal", tab_n(&inv));
    let pos = add(g(&r, "positionSceneRelative"))?;
    definir_v(&mut r, "positionSceneRelative", pos);
    let ori = add(g(&r, "profileOriginSceneRelative"))?;
    definir_v(&mut r, "profileOriginSceneRelative", ori);
    let pc = g(&r, "profileContours").clone();
    if vrai(&pc) {
        if !est_tableau(&pc) { return hd("profileContours non tableau"); }
        let mut out = vec![];
        for k in elems(&pc).unwrap() {
            let Some(k) = k else { out.push(None); continue };
            let mut e = vec![];
            etaler(&mut e, &k)?;
            let vs = g(&k, "verticesSceneRelative");
            if !est_tableau(vs) { return hd("verticesSceneRelative"); }
            let mut nv = vec![];
            for p_ in elems(vs).unwrap() { nv.push(match p_ { None => None, Some(p_) => Some(add(&p_)?) }); }
            definir(&mut e, "verticesSceneRelative", canon(&V::Tableau(nv)));
            out.push(Some(V::Objet(e)));
        }
        definir_v(&mut r, "profileContours", V::Tableau(out));
    }
    Ok(canon(&r))
}
/// `C.multiply(a, b)` lit `b[4*j+k]` sans contrôle : 16 nombres attendus (sinon hors domaine).
fn m16_lecture(v: &V) -> R<M16> { m16(&canon(v)) }

// ---------------------------------------------------------------- calage : bande sous le gabarit
fn delta_de(rail: &V, pos: &V) -> R<[f64; 3]> {
    let m = g(rail, "sceneRelativeToProfileLocal");
    let a = point_v(m, pos)?;
    let o_ = point_v(m, g(rail, "positionSceneRelative"))?;
    Ok([a[0] - o_[0], a[1] - o_[1], a[2] - o_[2]])
}
/// `Convention.bandOffsets(capture, side, delta)` : None si `ok:false`, sinon (dessus, flanc).
fn bande(capture: &V, side: &str, delta: [f64; 3]) -> R<Option<(Vec<f64>, Vec<f64>)>> {
    let b_ = convention::band_offsets_valeur(capture, side, &tab_n(&delta), &o(vec![]))?;
    if !vrai(g(&b_, "ok")) { return Ok(None); }
    let lire = |k: &str| -> Vec<f64> { presents(g(&b_, k)).iter().map(|x| num(x).unwrap_or(f64::NAN)).collect() };
    Ok(Some((lire("top"), lire("face"))))
}
fn cal_de<'a>(science: &'a V, side: &str) -> &'a V {
    let rails = if nullish(science) { &INDEF } else { g(science, "rails") };
    let r = if nullish(rails) { &INDEF } else { g(rails, side) };
    let c = if nullish(r) { &INDEF } else { g(r, "conventionCalibration") };
    if vrai(c) { c } else { &V::Nul }
}
fn calage_de(cal: &V) -> V {
    if !vrai(cal) { return nul(); }
    if matches!(g(cal, "applied"), V::Booleen(true)) { return s("applique"); }
    let r = g(cal, "reason");
    if vrai(r) { r.clone() } else { s("refuse") }
}
fn fini_r1(v: &V) -> V { match fini_de(v) { Some(x) => r1v(x), None => nul() } }
fn signaux_ok(capture: &V, decision: &V) -> bool {
    let pz = if nullish(decision) { &INDEF } else { g(decision, "positions") };
    let rails = if nullish(capture) { &INDEF } else { g(capture, "rails") };
    vrai(pz) && vrai(rails) && SIDES.iter().all(|s_| est_tableau(g(pz, s_)))
}
fn rail_de<'a>(capture: &'a V, side: &str) -> &'a V { let r = if nullish(capture) { &INDEF } else { g(capture, "rails") }; if nullish(r) { &INDEF } else { g(r, side) } }

// ---------------------------------------------------------------- hauteur apprise
fn modele_defaut() -> V {
    o(vec![("version", s("hauteur-apprise-v1")), ("forme", s("lineaire-epaisseur")), ("plafondMm", n(5.0)), ("pointsDessusMin", n(15.0)),
        ("etages", tab_s(&["first-pass", "window", "choice"])), ("applique", o(vec![("a", n(3.28)), ("b", n(-0.5)), ("part", n(0.5))])),
        ("refuse", o(vec![("a", n(17.89)), ("b", n(-1.14)), ("part", n(1.0))]))])
}
fn groupe_valide(g_: &V) -> bool { vrai(g_) && fini(g(g_, "a")) && fini(g(g_, "b")) && fini(g(g_, "part")) }
fn modele_de(reglage: &V) -> V {
    let mut m = modele_defaut();
    if vrai(reglage) {
        if matches!(g(reglage, "plafondMm"), V::Nombre(x) if x.is_finite() && *x >= 0.0) { definir_v(&mut m, "plafondMm", g(reglage, "plafondMm").clone()); }
        if fini(g(reglage, "pointsDessusMin")) { definir_v(&mut m, "pointsDessusMin", g(reglage, "pointsDessusMin").clone()); }
        if est_tableau(g(reglage, "etages")) { definir_v(&mut m, "etages", V::Tableau(elems(g(reglage, "etages")).unwrap())); }
        for k in ["applique", "refuse"] {
            let gg = g(reglage, k);
            if groupe_valide(gg) { definir_v(&mut m, k, o(vec![("a", g(gg, "a").clone()), ("b", g(gg, "b").clone()), ("part", g(gg, "part").clone())])); }
        }
    }
    m
}
pub fn hauteur_evaluer(capture: &V, science: &V, decision: &V, reglage: &V) -> R<V> {
    if !signaux_ok(capture, decision) { return Ok(nul()); }
    let pz = g(decision, "positions");
    let etage = match g(decision, "stage") { x if nullish(x) => nul(), x => x.clone() };
    let m = modele_de(reglage);
    let plafond = num(g(&m, "plafondMm")).unwrap();
    let mut rails = vec![];
    for side in SIDES {
        let cal = cal_de(science, side);
        let rail = rail_de(capture, side);
        let pos = g(pz, side);
        let (mut nb, mut ep): (Option<f64>, Option<f64>) = (None, None);
        if !nullish(rail) && vrai(g(rail, "sceneRelativeToProfileLocal")) {
            if let Some((top, face)) = bande(capture, side, delta_de(rail, pos)?)? {
                nb = Some(top.len() as f64); let _ = face;
                ep = if top.is_empty() { None } else { Some(convention::quantile(&top, 0.9) - convention::quantile(&top, 0.1)) };
            }
        }
        let groupe = if !vrai(cal) { nul() } else if matches!(g(cal, "applied"), V::Booleen(true)) { s("applique") }
            else if matches!(g(cal, "applied"), V::Booleen(false)) && matches!(g(cal, "reason"), V::Chaine(c) if c == "shift-out-of-domain") { s("refuse") } else { nul() };
        let ep_v = ep.map_or(nul(), r1v);
        // correctionRail
        let (corr, abst, borne): (f64, Option<&str>, bool) = if !inclut(g(&m, "etages"), &etage)? { (0.0, Some("etage"), false) }
            else if !vrai(&groupe) { (0.0, Some("calage"), false) }
            else if nb.is_none() || nb.unwrap() < num(g(&m, "pointsDessusMin")).unwrap() || !fini(&ep_v) { (0.0, Some("dessus-peu-observe"), false) }
            else {
                let gg = g(&m, chaine_de(&groupe).unwrap());
                if !groupe_valide(gg) { (0.0, Some("modele"), false) } else {
                    let (a, bb, part) = (num(g(gg, "a")).unwrap(), num(g(gg, "b")).unwrap(), num(g(gg, "part")).unwrap());
                    let brut = part * (a + bb * num(&ep_v).unwrap());
                    let bo = ariane_js::sign(brut) * ariane_js::min(brut.abs(), plafond);
                    let mm = ariane_js::round(bo * 10.0) / 10.0;
                    let mm = if bo.is_finite() { mm } else { f64::NAN };
                    (if mm == 0.0 { 0.0 } else { mm }, None, brut.abs() > plafond)
                }
            };
        let corr_v = if corr.is_nan() { nul() } else { n(corr) };
        let mut t = vec![("groupe", groupe), ("calage", calage_de(cal)), ("dzMm", fini_r1(if vrai(cal) { g(cal, "dzMm") } else { &INDEF })), ("epaisseurDessusMm", ep_v),
            ("pointsDessus", n_ou_nul(nb)), ("correctionMm", corr_v.clone()), ("abstention", abst.map_or(nul(), s))];
        if borne { t.push(("borne", b(true))); }
        let reelle: Vec<f64> = presents_nombres(pos)?;
        t.push(("reelle", tab_n(&reelle.iter().map(|x| um(*x)).collect::<Vec<_>>())));
        if !matches!(corr_v, V::Nombre(x) if x == 0.0) && !nullish(rail) && vrai(g(rail, "profileLocalToSceneRelative")) {
            let pm = g(rail, "profileLocalToSceneRelative");
            let cm = vers_nombre(&corr_v)?;
            let a = point_v(pm, &tab_n(&[0.0, 0.0, 0.0]))?;
            let bh = point_v(pm, &tab_n(&[0.0, 0.0, cm / 1000.0]))?;
            let h = [bh[0] - a[0], bh[1] - a[1], bh[2] - a[2]];
            t.push(("corrigee", tab_n(&reelle.iter().enumerate().map(|(i, v)| um(v + h.get(i).copied().unwrap_or(f64::NAN))).collect::<Vec<_>>())));
        }
        rails.push((side, o(t)));
    }
    let cop = |k: &str| { let mut e = vec![]; let _ = etaler(&mut e, g(&m, k)); V::Objet(e) };
    Ok(o(vec![("version", s("hauteur-apprise-v1")), ("etage", etage), ("repere", s("profil du rail, + = vers le haut")),
        ("modele", o(vec![("plafondMm", g(&m, "plafondMm").clone()), ("applique", cop("applique")), ("refuse", cop("refuse"))])), ("rails", o(rails))]))
}
/// `pose.map(…)` d'une position : tableau de nombres sans trou (sinon hors domaine).
fn presents_nombres(pos: &V) -> R<Vec<f64>> {
    let Some(t) = elems(pos) else { return hd("position non tableau") };
    t.into_iter().map(|e| match e { Some(V::Nombre(x)) => Ok(x), _ => hd("position non numérique") }).collect()
}

// ---------------------------------------------------------------- faux vert en ombre
pub fn faux_vert_evaluer(capture: &V, science: &V, decision: &V, reglage: &V) -> R<V> {
    if !signaux_ok(capture, decision) { return Ok(nul()); }
    let pz = g(decision, "positions");
    let mut rails = vec![];
    let seuil = |k: &str, d: f64| -> f64 { if nullish(reglage) { d } else { fini_de(g(reglage, k)).unwrap_or(d) } };
    let (dzmin, epmin) = (seuil("dzMinMm", 11.0), seuil("epaisseurMinMm", 14.0));
    let mut suspects = vec![];
    for side in SIDES {
        let cal = cal_de(science, side);
        let rail = rail_de(capture, side);
        let pos = g(pz, side);
        let mut bnd: Option<(f64, f64, Option<f64>)> = None;
        if !nullish(rail) && vrai(g(rail, "sceneRelativeToProfileLocal")) && est_tableau(pos) {
            if let Some((top, face)) = bande(capture, side, delta_de(rail, pos)?)? {
                let nb = top.len() as f64;
                bnd = Some((nb, face.len() as f64, if nb != 0.0 { Some(convention::quantile(&top, 0.9) - convention::quantile(&top, 0.1)) } else { None }));
            }
        }
        let dz = fini_r1(if vrai(cal) { g(cal, "dzMm") } else { &INDEF });
        let ep = match bnd { Some((_, _, Some(e))) => r1v(e), _ => nul() };
        if !matches!(dz, V::Nul) && num(&dz).unwrap().abs() >= dzmin && !matches!(ep, V::Nul) && num(&ep).unwrap() >= epmin { suspects.push(s(side)); }
        rails.push((side, o(vec![("dzMm", dz), ("calage", calage_de(cal)), ("epaisseurDessusMm", ep), ("pointsDessus", bnd.map_or(nul(), |x| n(x.0))),
            ("pointsFlanc", bnd.map_or(nul(), |x| n(x.1)))])));
    }
    let diff = !suspects.is_empty();
    Ok(o(vec![("version", s("faux-vert-ombre-v1")), ("verdict", s(if diff { "differer" } else { "valider" })), ("motif", if diff { s("hauteur-ambigue") } else { nul() }),
        ("railsSuspects", tab(suspects)), ("rails", o(rails)), ("seuils", o(vec![("dzMinMm", n(dzmin)), ("epaisseurMinMm", n(epmin))]))]))
}

pub fn appeler(module: &str, a: &Appel) -> R<V> {
    let e = a.arg(0);
    if nullish(e) { return hd("déstructuration de null/undefined"); }
    match (module, a.f.as_str()) {
        ("hauteur", "evaluer") => hauteur_evaluer(g(e, "capture"), g(e, "science"), g(e, "decision"), g(e, "reglage")),
        ("fauxVert", "evaluer") => faux_vert_evaluer(g(e, "capture"), g(e, "science"), g(e, "decision"), g(e, "reglage")),
        _ => hd("fonction non portée"),
    }
}
