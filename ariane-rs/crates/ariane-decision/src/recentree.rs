//! CH-068 (J4) : `src/voie-recentree.js` (recentrer sur la voie, commun aux ombres de la 5.0), ligne à ligne.
//! Portées (numéro `VOIE_RECENTREE`) : `localMm`, `poseMm`, `vueNecessaire`, `camerasLarges`, `geste`, `traceMoteur`, `confiances`,
//! `profondeur` (sans fonction d'appui), `predictionDe`, `mesures`, `regle`, `enRegle`, `verdictPrudent`, `completer` (sans
//! `expectedPoses`), `recentrer` (moteur GCV1 résolu par la façade, comme `decideCut`), `appuisDepuisDecalage`,
//! `choisirDansLePool` (sans fonction de contrat), `ecartPose`, `juger`, `memoireSerie`.
//! Restent en JS : `creerMemoire`, `series` (rendent un `Map`), `noterDecisionReelle`, `appuisOmbre`, `doitRecalculer`,
//! `evaluerDiffere` (mémoire à `Map`, fonctions de la page), `evaluerEcho` (appelle le moteur hors de `decideCut`).
#![warn(clippy::pedantic, missing_docs)]
#![allow(clippy::many_single_char_names, clippy::too_many_lines, clippy::cast_precision_loss, clippy::needless_range_loop)]
#![allow(clippy::neg_cmp_op_on_partial_ord, clippy::manual_range_contains, clippy::float_cmp)]
// (a+b)/2 garde l'ordre des opérations du JS (même arrondi) : `midpoint` ne le garantit pas
#![allow(clippy::manual_midpoint)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::indexing_slicing, clippy::unreachable, clippy::todo)]
use crate::aides;
use crate::j4::{iter_vals, longueur_js, med, nombre, ou_nul, plus, r1, r1f, r2f, svz, texte_k, trier_par, nombres, opt};
use crate::js::{b, definir, distance_v, elem, elems, est_tableau, etaler, g, g_brut, hd, inclut, m16, n, nul, nullish, o, p, point_v, s, strict_egal, tab, vrai, Appel, R, INDEF};
use crate::lot;
use crate::shadow::Etat;
use ariane_vba::Valeur as V;

const SIDES: [&str; 2] = ["left", "right"];
/// `VERSION`.
pub const VERSION: &str = "voie-recentree-v1";
/// `L.VIEW_MARGIN`.
const VIEW_MARGIN: f64 = 0.99;

/// `REGLE_PRUDENTE`.
#[must_use]
pub fn regle_prudente() -> V {
    o(vec![("etages", tab(vec![s("window")])), ("confianceMin", n(55.0)), ("ecartementVoisinMm", n(10.0)), ("profondeurMax", n(10.0)), ("fenetreMm", n(30.0)),
        ("dezoomMax", n(1.5)), ("glissementPxMax", n(250.0))])
}
/// `MEMOIRE_SERIE`.
#[must_use]
pub fn memoire_serie_defaut() -> V {
    o(vec![("ecartSerieMax", n(10.0)), ("K", n(3.0)), ("appuis", n(2.0)), ("mmParCut", n(3.0)), ("porteDispersionMm", n(10.0)),
        ("etages", tab(vec![s("first-pass"), s("window"), s("choice")]))])
}
fn pool_defaut() -> V { o(vec![("tolMm", n(15.0)), ("minHaut", n(5.0)), ("minFlanc", n(3.0)), ("separationMm", n(20.0))]) }
fn jugement_defaut() -> V { o(vec![("justeMm", n(5.0)), ("fauxMm", n(10.0)), ("mauvaiseVoieMm", n(50.0))]) }
fn defaut(v: &V, d: impl FnOnce() -> V) -> V { if matches!(v, V::Indefini) { d() } else { v.clone() } }
fn est(v: &V, t: &str) -> bool { matches!(v, V::Chaine(c) if c == t) }
/// `v[i]` converti par `ToNumber` (indice d'un tableau ; objet simple : sa clé ; chaîne : hors domaine).
fn idx(v: &V, i: usize) -> R<f64> {
    match v {
        V::Chaine(_) => hd("indice d'une chaîne"),
        V::Objet(_) => nombre(g_brut(v, &i.to_string())),
        x if est_tableau(x) => nombre(&elem(x, i)),
        V::Indefini | V::Nul => hd("indice de null/undefined"),
        _ => Ok(f64::NAN),
    }
}
/// `a > b` du JS sur deux valeurs quelconques (`ToNumber` des deux ; deux chaînes : hors domaine).
fn sup(a: &V, b_: &V) -> R<bool> { Ok(nombre(a)? > nombre(b_)?) }

// ---------------------------------------------------------------- repères

/// `localMm(rail, p)`.
///
/// # Errors
/// `Js` (projection non finie) ou `HorsDomaine`.
pub fn local_mm(rail: &V, pt: &V) -> R<[f64; 3]> {
    let m = p(rail, "sceneRelativeToProfileLocal")?;
    let a = point_v(m, pt)?;
    let o_ = point_v(m, g(rail, "positionSceneRelative"))?;
    Ok([(a[0] - o_[0]) * 1000.0, (a[1] - o_[1]) * 1000.0, (a[2] - o_[2]) * 1000.0])
}
fn rail_de<'a>(capture: &'a V, side: &str) -> R<&'a V> { p(p(capture, "rails")?, side) }

/// `poseMm(capture, positions)`.
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn pose_mm(capture: &V, positions: &V) -> R<V> {
    if !vrai(positions) { return Ok(nul()); }
    let mut e = vec![];
    for side in SIDES {
        let l = local_mm(rail_de(capture, side)?, g(positions, side))?;
        e.push((side, tab(l.iter().map(|x| r1f(*x)).collect())));
    }
    Ok(o(e))
}

// ---------------------------------------------------------------- vue

/// `C.point(C.multiply(cam.projection, cam.sceneRelativeToCamera), p)`.
fn ndc_of(cam: &V, pt: &V) -> R<[f64; 3]> {
    let m = ariane_capture::multiply(&m16(g(cam, "projection"))?, &m16(g(cam, "sceneRelativeToCamera"))?);
    let [x, y, z] = ariane_capture::xyz(pt)?;
    ariane_capture::point(&m, x, y, z)
}

/// `L.viewCameras(capture)` : caméra de chaque rail (celle où il projette au plus près du centre, à 0,5 au plus).
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn view_cameras(capture: &V) -> R<[Option<V>; 2]> {
    let mut cams = vec![opt(capture, &["camera"]).clone()];
    let vc = opt(capture, &["viewCaptures"]);
    if vrai(vc) {
        if !est_tableau(vc) { return hd("viewCaptures non tabulaire"); }
        // `.map` saute les trous, l'étalement en fait des `undefined`
        for v in elems(vc).unwrap_or_default() { cams.push(match v { Some(v) => opt(&v, &["camera"]).clone(), None => V::Indefini }); }
    }
    let cams: Vec<V> = cams.into_iter().filter(|c| vrai(opt(c, &["projection"])) && vrai(opt(c, &["sceneRelativeToCamera"]))).collect();
    let mut out: [Option<V>; 2] = [None, None];
    for (k, side) in SIDES.iter().enumerate() {
        let pt = opt(capture, &["rails", side, "positionSceneRelative"]);
        if !est_tableau(pt) { continue; }
        let mut ds = vec![];
        for (i, cam) in cams.iter().enumerate() { let ndc = ndc_of(cam, pt)?; ds.push((i, ariane_js::hypot(&[ndc[0], ndc[1]]))); }
        trier_par(&mut ds, |x| x.1)?;
        if let Some(&(i, d)) = ds.first() { if d <= 0.5 { if let (Some(sl), Some(c)) = (out.get_mut(k), cams.get(i)) { *sl = Some(c.clone()); } } }
    }
    Ok(out)
}

/// `vueNecessaire(capture, positions, marge)`.
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn vue_necessaire(capture: &V, positions: &V, marge: &V) -> R<V> {
    let marge = if matches!(marge, V::Indefini) { VIEW_MARGIN } else { nombre(marge)? };
    let cams = view_cameras(capture)?;
    let (mut dans, mut inconnu, mut dezoom, mut pan_px, mut pan_mm) = (true, false, 1.0f64, 0.0f64, 0.0f64);
    let mut par = vec![];
    for (k, side) in SIDES.iter().enumerate() {
        let cam = cams.get(k).cloned().flatten();
        let Some(cam) = cam.filter(|c| vrai(g(c, "viewport"))) else { inconnu = true; par.push((*side, nul())); continue };
        if nullish(positions) { return hd("positions absentes"); }
        let ndc = ndc_of(&cam, g(positions, side))?;
        let (ax, ay) = (ndc[0].abs(), ndc[1].abs());
        let kk = ariane_js::max(ax, ay) / marge;
        let (ex_x, ex_y) = (ariane_js::max(0.0, ax - marge), ariane_js::max(0.0, ay - marge));
        let vp = g(&cam, "viewport");
        let px_x = ex_x * nombre(p(vp, "width")?)? / 2.0;
        let px_y = ex_y * nombre(p(vp, "height")?)? / 2.0;
        let proj = g(&cam, "projection");
        let mm_x = ex_x * 1000.0 / idx(proj, 0)?.abs();
        let mm_y = ex_y * 1000.0 / idx(proj, 5)?.abs();
        let ok = kk <= 1.0 && ndc[2].abs() <= 1.0;
        let (dz, pp, pm) = (ariane_js::max(1.0, kk), ariane_js::max(px_x, px_y), ariane_js::max(mm_x, mm_y));
        par.push((*side, o(vec![("ok", b(ok)), ("dezoom", n(dz)), ("panPx", n(pp)), ("panMm", n(pm)), ("ndc", nombres(&[ndc[0], ndc[1]]))])));
        if !ok { dans = false; }
        dezoom = ariane_js::max(dezoom, dz); pan_px = ariane_js::max(pan_px, pp); pan_mm = ariane_js::max(pan_mm, pm);
    }
    Ok(o(vec![("dans", b(dans && !inconnu)), ("inconnu", b(inconnu)), ("dezoom", n(dezoom)), ("panPx", n(pan_px)), ("panMm", n(pan_mm)), ("par", o(par))]))
}

/// `camerasLarges(capture)`.
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn cameras_larges(capture: &V) -> R<V> {
    let cams = view_cameras(capture)?;
    let mut e = vec![];
    for (k, side) in SIDES.iter().enumerate() {
        let v = match cams.get(k).cloned().flatten() {
            Some(c) => {
                let mut x = vec![];
                etaler(&mut x, &c)?;
                let pr = g(&c, "projection");
                if !est_tableau(pr) { return hd("projection non tabulaire"); }
                let mut t = vec![];
                for (i, v) in elems(pr).unwrap_or_default().into_iter().enumerate() {
                    t.push(match v { Some(v) if i == 0 || i == 5 => Some(n(nombre(&v)? / 1000.0)), v => v });
                }
                definir(&mut x, "projection", crate::js::canon(&V::Tableau(t)));
                V::Objet(x)
            }
            None => nul(),
        };
        e.push((*side, v));
    }
    Ok(o(e))
}

/// `geste(vue, seuils)`.
///
/// # Errors
/// `HorsDomaine`.
pub fn geste(vue: &V, seuils: &V) -> R<V> {
    if !vrai(vue) { return Ok(nul()); }
    let seuils = defaut(seuils, regle_prudente);
    let base = |nom: &str| -> V {
        o(vec![("geste", s(nom)), ("dezoom", match g(vue, "dezoom") { V::Nombre(x) => r2f(*x), _ => nul() }), ("glissementPx", r1(g(vue, "panPx"))), ("glissementMm", r1(g(vue, "panMm")))])
    };
    if vrai(g(vue, "inconnu")) { return Ok(base("inconnu")); }
    if vrai(g(vue, "dans")) { return Ok(base("dans-la-vue")); }
    let dm = opt(&seuils, &["dezoomMax"]);
    if crate::js::fini(dm) && nombre(g(vue, "dezoom"))? <= nombre(dm)? { return Ok(base("dezoom")); }
    let gm = opt(&seuils, &["glissementPxMax"]);
    if crate::js::fini(gm) && nombre(g(vue, "panPx"))? <= nombre(gm)? { return Ok(base("glissement")); }
    Ok(base("hors-limites"))
}

// ---------------------------------------------------------------- moteur relancé

/// `traceMoteur(sci)`.
///
/// # Errors
/// `HorsDomaine`.
pub fn trace_moteur(sci: &V) -> R<V> {
    if !vrai(sci) { return Ok(nul()); }
    let mut e = vec![];
    for side in SIDES {
        let r = opt(sci, &["rails", side]);
        let v = if vrai(r) && vrai(g(r, "ok")) {
            let nx = p(r, "next")?;
            if nullish(nx) { return hd("next absent"); }
            o(vec![("statut", g(nx, "status").clone()), ("motif", g(nx, "motif").clone()), ("confiance", ou_nul(opt(r, &["astar", "confidence"]))),
                ("topRows", ou_nul(g(nx, "topRows"))), ("faceCount", ou_nul(g(nx, "faceCount"))), ("rapportPerte", ou_nul(opt(r, &["astar", "lossRatio"]))),
                ("s1", b(vrai(g(r, "s1Changed")))), ("flancPartiel", b(vrai(g(r, "partialFlankUsed")))), ("fortsConcurrents", ou_nul(opt(r, &["competitive", "nStrongCompetitive"])))])
        } else { o(vec![("statut", s("absent"))]) };
        e.push((side, v));
    }
    e.push(("ecartementMm", ou_nul(opt(sci, &["pairGauge", "predictedMm"]))));
    Ok(o(e))
}

/// `confiances(trace)`.
#[must_use]
pub fn confiances(trace: &V) -> V {
    if !vrai(trace) { return nul(); }
    o(SIDES.iter().map(|side| {
        let t = g(trace, side);
        let v = if vrai(opt(t, &["s1"])) { s("s1") } else if crate::js::fini(opt(t, &["confiance"])) { r1(g(t, "confiance")) } else { nul() };
        (*side, v)
    }).collect())
}

/// Profondeur connue d'un appui (`profondeurAppui`).
pub type ProfondeurAppui<'a> = &'a dyn Fn(&V) -> R<V>;
#[allow(clippy::unnecessary_wraps)] // signature de `ProfondeurAppui`
fn zero(_: &V) -> R<V> { Ok(n(0.0)) }

/// `profondeur(decision, profondeurAppui)`.
///
/// # Errors
/// `HorsDomaine`.
pub fn profondeur(decision: &V, f: ProfondeurAppui) -> R<f64> {
    if est(opt(decision, &["stage"]), "first-pass") { return Ok(0.0); }
    let au = opt(decision, &["anchorsUsed"]);
    let mut m = 0.0f64;
    if vrai(au) {
        if !est_tableau(au) { return hd("anchorsUsed non tabulaire"); }
        for c in elems(au).unwrap_or_default() {
            let x = match c { None => f64::NAN, Some(c) => { let v = f(&c)?; nombre(if nullish(&v) { &V::Nombre(0.0) } else { &v })? } };
            m = ariane_js::max(m, x);
        }
    }
    Ok(1.0 + m)
}

/// Les éléments d'un `new Set(x||[])` (ordre d'insertion, `SameValueZero`, −0 rangé en +0).
fn ensemble(v: &V) -> R<Vec<V>> {
    if !vrai(v) { return Ok(vec![]); }
    if !est_tableau(v) { return hd("Set d'un non-tableau"); }
    let mut out: Vec<V> = vec![];
    for x in iter_vals(v) {
        let x = if matches!(x, V::Nombre(z) if z == 0.0) { n(0.0) } else { x };
        let mut vu = false;
        for y in &out { if svz(y, &x)? { vu = true; break; } }
        if !vu { out.push(x); }
    }
    Ok(out)
}
fn filtre_appuis(appuis: &V) -> R<Vec<V>> {
    if !vrai(appuis) { return Ok(vec![]); }
    if !est_tableau(appuis) { return hd("appuis non tabulaires"); }
    Ok(crate::js::presents(appuis))
}
fn cut_de(a: &V) -> R<&V> { p(p(a, "identity")?, "cut") }

/// `predictionDe(capture, decision, appuis)` : `[latéral, vertical]` (mm) par rail, ou `None`.
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn prediction_de(capture: &V, decision: &V, appuis: &V) -> R<Option<[[f64; 2]; 2]>> {
    let cuts = ensemble(p(decision, "anchorsUsed")?)?;
    let mut liste = vec![];
    for a in filtre_appuis(appuis)? {
        let c = cut_de(&a)?;
        let mut dedans = false;
        for x in &cuts { if svz(x, c)? { dedans = true; break; } }
        if dedans { liste.push(a); }
    }
    if liste.is_empty() || liste.len() != cuts.len() { return Ok(None); }
    let fa = g(decision, "framedAnchors");
    let framed = !nullish(fa) && vrai(&longueur_js(fa));
    let ancres: Vec<V> = liste.iter().map(|a| o(vec![("positions", g(a, "positions").clone())])).collect();
    let mut out = [[0.0; 2]; 2];
    for (k, side) in SIDES.iter().enumerate() {
        let init = rail_de(capture, side)?;
        let pr = if framed { lot::predict_framed(init, &ancres, side)? } else { aides::predict(init, &ancres, side)? };
        if let Some(x) = out.get_mut(k) { *x = [pr.lateral * 1000.0, pr.vertical * 1000.0]; }
    }
    Ok(Some(out))
}
fn prediction_v(pr: &[[f64; 2]; 2]) -> V { o(vec![("left", nombres(&pr[0])), ("right", nombres(&pr[1]))]) }

/// `predictionDe` en valeur (`null` ou `{left:[…], right:[…]}`).
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn prediction_de_v(capture: &V, decision: &V, appuis: &V) -> R<V> { Ok(prediction_de(capture, decision, appuis)?.map_or_else(nul, |x| prediction_v(&x))) }

/// `mesures(capture, decision, positions, appuis)` : les clés, dans l'ordre du JS.
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn mesures(capture: &V, decision: &V, positions: &V, appuis: &V) -> R<Vec<(String, V)>> {
    let mut dep = [[0.0; 2]; 2];
    let mut de = vec![];
    if nullish(positions) { return hd("positions absentes"); }
    for (k, side) in SIDES.iter().enumerate() {
        let l = local_mm(rail_de(capture, side)?, g(positions, side))?;
        if let Some(x) = dep.get_mut(k) { *x = [l[1], l[2]]; }
        de.push((*side, nombres(&[l[1], l[2]])));
    }
    let mut out = vec![("deplacementMm".to_owned(), o(de))];
    let st = p(decision, "stage")?;
    if !est(st, "window") && !est(st, "choice") { return Ok(out); }
    let au = g(decision, "anchorsUsed");
    let mut utilises = vec![];
    for a in filtre_appuis(appuis)? {
        let c = cut_de(&a)?;
        let inc = if vrai(au) { if !est_tableau(au) { return hd("includes d'un non-tableau"); } inclut(au, c)? } else { false };
        if inc { utilises.push(a); }
    }
    if let Some(pr) = prediction_de(capture, decision, appuis)? {
        out.push(("prediction".to_owned(), prediction_v(&pr)));
        out.push(("devLatMm".to_owned(), n(ariane_js::max((dep[0][0] - pr[0][0]).abs(), (dep[1][0] - pr[1][0]).abs()))));
        out.push(("devVertMm".to_owned(), n(ariane_js::max((dep[0][1] - pr[0][1]).abs(), (dep[1][1] - pr[1][1]).abs()))));
    }
    if !utilises.is_empty() {
        let mut devs = vec![];
        let mut gs = vec![];
        for a in &utilises {
            let pz = p(a, "positions")?;
            let (l, r) = (p(pz, "left")?, p(pz, "right")?);
            devs.push(idx(l, 2)? - idx(r, 2)?);
            gs.push(distance_v(l, r)? * 1000.0);
        }
        let (pl, pr_) = (p(positions, "left")?, p(positions, "right")?);
        let md = med(&devs)?.unwrap_or(0.0);
        out.push(("deversEcartMm".to_owned(), n(((idx(pl, 2)? - idx(pr_, 2)?) - md).abs() * 1000.0)));
        let ec = distance_v(pl, pr_)? * 1000.0;
        out.push(("ecartementMm".to_owned(), n(ec)));
        out.push(("ecartVoisinMm".to_owned(), n((ec - med(&gs)?.unwrap_or(0.0)).abs())));
    }
    Ok(out)
}

// ---------------------------------------------------------------- règle

/// `regle(g, r, zone, temoinRow)` : `null` (acceptée) ou le motif du refus.
///
/// # Errors
/// `HorsDomaine`.
pub fn regle(gv: &V, r: &V, zone: &V, temoin: &V) -> R<V> {
    let adv = vrai(opt(zone, &["adv"]));
    let k = if adv && !nullish(gv) && vrai(g(gv, "adv")) && crate::js::est_objet(g(gv, "adv")) { let mut e = vec![]; etaler(&mut e, gv)?; etaler(&mut e, g(gv, "adv"))?; V::Objet(e) } else { gv.clone() };
    if adv && matches!(p(gv, "adv")?, V::Booleen(false)) { return Ok(s("adv-interdit")); }
    if vrai(p(gv, "sansAncre")?) && vrai(temoin) && !est(g(temoin, "reason"), "no-anchor") { return Ok(s("avec-ancre")); }
    let et = g(&k, "etages");
    if vrai(et) {
        if !est_tableau(et) { return hd("etages non tabulaire"); }
        if !inclut(et, p(r, "stage")?)? { return Ok(s("etage")); }
    }
    let nn = |v: &V| !nullish(v);
    if nn(g(&k, "fenetreMm")) && nn(p(r, "fromPredictionMm")?) && sup(g(r, "fromPredictionMm"), g(&k, "fenetreMm"))? { return Ok(s("fenetre")); }
    if nn(g(&k, "appuisMin")) {
        let la = |c: &str| -> R<V> { let x = g(r, c); Ok(if vrai(x) { longueur_js(x) } else { n(0.0) }) };
        if nullish(r) { return hd("r absent"); }
        if plus(&la("anchorsUsed")?, &la("validatedAnchors")?)? < nombre(g(&k, "appuisMin"))? { return Ok(s("appuis")); }
    }
    if nn(g(&k, "profMax")) && sup(p(r, "profondeur")?, g(&k, "profMax"))? { return Ok(s("profondeur")); }
    if nn(g(&k, "confMin")) && est(p(r, "stage")?, "window") {
        // c = SIDES.map(s => r.moteur?.[s]?.s1 ? Infinity : r.moteur?.[s]?.confiance)
        let mut c = vec![];
        for side in SIDES { let m = opt(r, &["moteur", side]); c.push(if vrai(opt(m, &["s1"])) { f64::INFINITY } else { match opt(m, &["confiance"]) { V::Nombre(x) if x.is_finite() || *x == f64::INFINITY => *x, _ => f64::NAN } }); }
        // every(Number.isFinite(x) || x === Infinity) : NaN marque ici une valeur qui n'est ni l'un ni l'autre
        if c.iter().any(|x| x.is_nan()) { return Ok(s("confiance")); }
        let cm = nombre(g(&k, "confMin"))?;
        if !c.iter().all(|x| *x >= cm) { return Ok(s("confiance")); }
    }
    for (cle, rc, motif) in [("vertMm", "devVertMm", "vertical"), ("deversMm", "deversEcartMm", "devers"), ("ecartVoisinMm", "ecartVoisinMm", "ecartement-voisin")] {
        if nn(g(&k, cle)) && nn(p(r, rc)?) && sup(g(r, rc), g(&k, cle))? { return Ok(s(motif)); }
    }
    for (cle, i, motif) in [("cohMm", 0usize, "coherence"), ("cohVMm", 1usize, "coherence-vertical")] {
        if nn(g(&k, cle)) && vrai(p(r, "deplacementMm")?) {
            let d = g(r, "deplacementMm");
            if (idx(p(d, "left")?, i)? - idx(p(d, "right")?, i)?).abs() > nombre(g(&k, cle))? { return Ok(s(motif)); }
        }
    }
    let (dzm, ppm) = (g(&k, "dezoomMax"), g(&k, "panPxMax"));
    if nn(dzm) || nn(ppm) {
        let vue = p(r, "vue")?;
        if !vrai(vue) || vrai(g(vue, "inconnu")) { return Ok(s("vue-inconnue")); }
        if !vrai(g(vue, "dans")) {
            let a = nn(dzm) && nombre(g(vue, "dezoom"))? <= nombre(dzm)?;
            let c = a || (nn(ppm) && nombre(g(vue, "panPx"))? <= nombre(ppm)?);
            if !c { return Ok(s("vue")); }
        }
    }
    Ok(nul())
}

/// `[...x]` d'un tableau (trous en `undefined`).
fn etale(v: &V) -> R<V> { if est_tableau(v) { Ok(tab(iter_vals(v))) } else { hd("étalement d'un non-tableau") } }

/// `enRegle(s)`.
///
/// # Errors
/// `HorsDomaine`.
pub fn en_regle(sv: &V) -> R<V> {
    let sv = defaut(sv, regle_prudente);
    if nullish(&sv) { return hd("seuils absents"); }
    let et = g(&sv, "etages");
    Ok(o(vec![("etages", if vrai(et) { etale(et)? } else { nul() }), ("confMin", ou_nul(g(&sv, "confianceMin"))), ("ecartVoisinMm", ou_nul(g(&sv, "ecartementVoisinMm"))),
        ("profMax", ou_nul(g(&sv, "profondeurMax"))), ("fenetreMm", ou_nul(g(&sv, "fenetreMm"))), ("dezoomMax", ou_nul(g(&sv, "dezoomMax"))), ("panPxMax", ou_nul(g(&sv, "glissementPxMax")))]))
}

/// `x || '?'`.
fn ou_q(v: &V) -> V { if vrai(v) { v.clone() } else { s("?") } }

/// `verdictPrudent(r, seuils)`.
///
/// # Errors
/// `HorsDomaine`.
pub fn verdict_prudent(r: &V, seuils: &V) -> R<V> {
    if !vrai(p(r, "posee")?) {
        let raison = if est(g(r, "stage"), "deferred") { format!("differe:{}", texte_k(&ou_q(g(r, "reason")), 60)?) } else {
            let c = opt(r, &["commande", "reason"]);
            let x = if vrai(c) { c.clone() } else { ou_q(g(r, "stage")) };
            format!("sans-pose:{}", texte_k(&x, 60)?)
        };
        return Ok(o(vec![("posable", b(false)), ("raison", s(&raison))]));
    }
    let motif = regle(&en_regle(seuils)?, r, &INDEF, &INDEF)?;
    Ok(if vrai(&motif) { o(vec![("posable", b(false)), ("raison", motif)]) } else { o(vec![("posable", b(true)), ("raison", nul())]) })
}

// ---------------------------------------------------------------- recentrage

/// `x.slice()` d'une valeur vraie (tableau : trous gardés ; chaîne : elle-même).
fn copie(v: &V) -> R<V> { match v { V::Chaine(_) => Ok(v.clone()), x if est_tableau(x) => Ok(V::Tableau(elems(x).unwrap_or_default())), _ => hd("slice d'un non-tableau") } }

/// `completer({capture, decision, relance, appuis, runtimeRails, before, expectedPoses, vue, profondeurAppui})`, branche sans
/// `expectedPoses` (fonction de la page : jamais décodée ici).
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn completer(arg: &V, f: ProfondeurAppui) -> R<V> {
    if nullish(arg) { return hd("déstructuration de null/undefined"); }
    let (capture, decision) = (g(arg, "capture"), g(arg, "decision"));
    let relance = defaut(g(arg, "relance"), nul);
    let appuis = defaut(g(arg, "appuis"), || tab(vec![]));
    let pa = g(arg, "profondeurAppui");
    if !matches!(pa, V::Indefini) { return hd("profondeurAppui non fonction"); }
    let st = opt(decision, &["stage"]);
    let positions = if vrai(opt(decision, &["positions"])) && !est(st, "deferred") { g(decision, "positions").clone() } else { nul() };
    let au = opt(decision, &["anchorsUsed"]);
    let va = opt(decision, &["validatedAnchors"]);
    let mut r = vec![("version".to_owned(), s(VERSION)), ("stage".to_owned(), ou_nul(st)), ("reason".to_owned(), ou_nul(opt(decision, &["reason"]))),
        ("anchorsUsed".to_owned(), if vrai(au) { copie(au)? } else { tab(vec![]) }), ("validatedAnchors".to_owned(), if vrai(va) { va.clone() } else { nul() }),
        ("framed".to_owned(), b(vrai(opt(decision, &["framedAnchors"])))), ("fromPredictionMm".to_owned(), ou_nul(opt(decision, &["fromPredictionMm"]))),
        ("guardMm".to_owned(), ou_nul(opt(decision, &["guardMm"]))), ("anchor".to_owned(), b(vrai(opt(decision, &["anchor"])))),
        ("profondeur".to_owned(), n(profondeur(decision, f)?)), ("commande".to_owned(), nul()), ("posee".to_owned(), b(vrai(&positions))), ("positions".to_owned(), positions.clone()),
        ("moteur".to_owned(), if est(st, "window") || est(st, "choice") { trace_moteur(&relance)? } else { nul() })];
    if vrai(&positions) {
        for (k, v) in mesures(capture, decision, &positions, &appuis)? { definir(&mut r, &k, v); }
        if nullish(capture) { return hd("capture absente"); }
        let vue = if vrai(g(capture, "camera")) || vrai(&longueur_js(opt(capture, &["viewCaptures"]))) { vue_necessaire(capture, &positions, &INDEF)? } else { nul() };
        definir(&mut r, "vue", vue);
    }
    Ok(V::Objet(r))
}

/// `recentrer({capture, science, anchors, validated, Shadow, options, …})` : `{decision, …completer}` (moteur GCV1 du cœur).
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn recentrer(arg: &V, et: &Etat, gl: &lot::Globaux) -> R<V> {
    if nullish(arg) { return hd("déstructuration de null/undefined"); }
    for k in ["runtimeRails", "before", "expectedPoses", "profondeurAppui"] { if !matches!(g(arg, k), V::Indefini) { return hd("argument de la page"); } }
    let anchors = defaut(g(arg, "anchors"), || tab(vec![]));
    let mut da = vec![("capture", g(arg, "capture").clone()), ("science", g(arg, "science").clone()), ("anchors", anchors.clone()), ("validated", g(arg, "validated").clone())];
    if vrai(g(arg, "options")) { da.push(("options", g(arg, "options").clone())); }
    let mut relance = None;
    let decision = lot::decide_cut_r(&o(da), et, gl, &mut relance)?;
    let validated = g(arg, "validated");
    let mut ap = iter_vals(&anchors);
    if !est_tableau(&anchors) { return hd("anchors non tabulaire"); }
    if vrai(validated) { if !est_tableau(validated) { return hd("validated non tabulaire"); } ap.extend(iter_vals(validated)); }
    let ca = o(vec![("capture", g(arg, "capture").clone()), ("decision", decision.clone()), ("relance", relance.unwrap_or(V::Nul)), ("appuis", tab(ap))]);
    let mut out = vec![("decision".to_owned(), decision)];
    if let V::Objet(e) = completer(&ca, &zero)? { for (k, v) in e { definir(&mut out, &k, v); } }
    Ok(V::Objet(out))
}

/// `appuisDepuisDecalage(capture, decalage)`.
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn appuis_depuis_decalage(capture: &V, decalage: &V) -> R<V> {
    let id = p(capture, "identity")?;
    let mut out = vec![];
    for k in [1.0f64, 2.0] {
        let part = p(id, "part")?.clone();
        let cut = nombre(g(id, "cut"))? - k;
        let mut pos = vec![];
        for side in SIDES {
            let r = rail_de(capture, side)?;
            if nullish(r) { return hd("rail absent"); }
            let o_ = point_v(g(r, "sceneRelativeToProfileLocal"), g(r, "positionSceneRelative"))?;
            let d = p(decalage, side)?;
            let q = [o_[0] - k, o_[1] + idx(d, 0)? / 1000.0, o_[2] + idx(d, 1)? / 1000.0];
            pos.push((side, nombres(&point_v(g(r, "profileLocalToSceneRelative"), &nombres(&q))?)));
        }
        out.push(o(vec![("identity", o(vec![("part", part), ("cut", n(cut)), ("frameId", ou_nul(g(id, "frameId")))])), ("stage", s("decalage")), ("positions", o(pos))]));
    }
    Ok(tab(out))
}

/// `choisirDansLePool(pools, voie, ecartementAdmissible, options)` (contrat absent : jamais une fonction décodée).
///
/// # Errors
/// `HorsDomaine`.
pub fn choisir_dans_le_pool(pools: &V, voie: &V, options: &V) -> R<V> {
    let mut oe = vec![];
    etaler(&mut oe, &pool_defaut())?;
    etaler(&mut oe, &defaut(options, || o(vec![])))?;
    let ov = V::Objet(oe);
    let num = |k: &str| nombre(g(&ov, k));
    let V::Objet(cles) = voie else { return if nullish(voie) { hd("Object.keys de null") } else if matches!(voie, V::Chaine(c) if !c.is_empty()) || est_tableau(voie) { hd("clés d'un non-objet") } else { Ok(o(vec![("pose", o(vec![]))])) } };
    let mut pose = vec![];
    for (c, vc) in cles {
        if nullish(pools) { return hd("pools absent"); }
        let pc = if matches!(pools, V::Objet(_)) { g_brut(pools, c) } else { &INDEF };
        let pc = if vrai(pc) { if !est_tableau(pc) { return hd("pool non tabulaire"); } crate::js::presents(pc) } else { vec![] };
        let (v0, v1) = (idx(vc, 0)?, idx(vc, 1)?);
        let mut pres = vec![];
        for cd in pc {
            if nullish(&cd) { return hd("candidat absent"); }
            if !(nombre(g(&cd, "haut"))? >= num("minHaut")?) { continue; }
            if !(nombre(g(&cd, "flanc"))? >= num("minFlanc")?) { continue; }
            if vrai(g(&cd, "pente")) { continue; }
            if !(ariane_js::hypot(&[nombre(g(&cd, "fla"))? - v0, nombre(g(&cd, "fve"))? - v1]) <= num("tolMm")?) { continue; }
            pres.push(cd);
        }
        let mut cles_perte = vec![];
        for (i, cd) in pres.iter().enumerate() { cles_perte.push((i, nombre(g(cd, "perte"))?)); }
        trier_par(&mut cles_perte, |x| x.1)?;
        let mut grappes: Vec<&V> = vec![];
        for (i, _) in cles_perte {
            let Some(cd) = pres.get(i) else { continue };
            let mut proche = false;
            for gg in &grappes { if ariane_js::hypot(&[nombre(g(gg, "fla"))? - nombre(g(cd, "fla"))?, nombre(g(gg, "fve"))? - nombre(g(cd, "fve"))?]) < num("separationMm")? { proche = true; break; } }
            if !proche { grappes.push(cd); }
        }
        if grappes.len() != 1 {
            return Ok(o(vec![("pose", nul()), ("raison", s(if grappes.is_empty() { "aucun minimum près de la voie" } else { "plusieurs minima près de la voie" }))]));
        }
        let Some(g0) = grappes.first() else { return hd("grappe") };
        definir(&mut pose, c, tab(vec![g(g0, "fla").clone(), g(g0, "fve").clone()]));
    }
    Ok(o(vec![("pose", V::Objet(pose))]))
}

/// `ecartPose(pose, mic)`.
///
/// # Errors
/// `HorsDomaine`.
pub fn ecart_pose(pose: &V, mic: &V) -> R<V> {
    if !vrai(pose) || !vrai(mic) { return Ok(nul()); }
    let mut e = vec![];
    for side in SIDES {
        let (pp, m) = (g(pose, side), g(mic, side));
        if !vrai(pp) || !vrai(m) { e.push(f64::NAN); continue; }
        let trois = matches!(longueur_js(pp), V::Nombre(x) if x == 3.0);
        let m0 = { let x = match m { V::Objet(_) => g_brut(m, "0").clone(), V::Chaine(_) => return hd("indice d'une chaîne"), x if est_tableau(x) => elem(x, 0), _ => V::Indefini }; if nullish(&x) { 0.0 } else { nombre(&x)? } };
        let (a, c, d) = if trois { (idx(pp, 0)?, idx(pp, 1)?, idx(pp, 2)?) } else { (0.0, idx(pp, 0)?, idx(pp, 1)?) };
        e.push(ariane_js::hypot(&[m0 - a, idx(m, 1)? - c, idx(m, 2)? - d]));
    }
    Ok(if e.iter().all(|x| x.is_finite()) { n(ariane_js::max_de(e)) } else { nul() })
}

/// `juger(ecartMm, seuils)`.
///
/// # Errors
/// `HorsDomaine`.
pub fn juger(ecart: &V, seuils: &V) -> R<V> {
    let Some(x) = crate::j4::fin_de(ecart) else { return Ok(s("non-jugee")) };
    let sv = defaut(seuils, jugement_defaut);
    if x > nombre(p(&sv, "mauvaiseVoieMm")?)? { return Ok(s("mauvaise-voie")); }
    if x > nombre(g(&sv, "fauxMm"))? { return Ok(s("fausse")); }
    Ok(s(if x <= nombre(g(&sv, "justeMm"))? { "juste5" } else { "juste10" }))
}

/// `series(cuts, ecart)` : (cut, {id, rang, longueur}) dans l'ordre d'insertion du `Map`.
fn series(cuts: &V, ecart: f64) -> R<Vec<(f64, [f64; 3])>> {
    let vals = match cuts { V::Chaine(_) => vec![], x if est_tableau(x) => ensemble(x)?, x if !vrai(x) => vec![], _ => return hd("série d'un non-tableau") };
    let mut tri: Vec<f64> = vals.iter().filter_map(|v| match v { V::Nombre(x) if x.is_finite() && x.trunc() == *x => Some(*x), _ => None }).collect();
    trier_par(&mut tri, |x| *x)?;
    let mut res: Vec<(f64, [f64; 3])> = vec![];
    let mut cur: Vec<f64> = vec![];
    let ferme = |cur: &mut Vec<f64>, res: &mut Vec<(f64, [f64; 3])>| {
        let id = cur.first().copied().unwrap_or(f64::NAN);
        let l = cur.len() as f64;
        for (i, c) in cur.iter().enumerate() {
            let v = [id, i as f64, l];
            if let Some(x) = res.iter_mut().find(|x| x.0 == *c) { x.1 = v; } else { res.push((*c, v)); }
        }
        cur.clear();
    };
    for c in tri {
        if let Some(der) = cur.last() { if c - der > ecart { ferme(&mut cur, &mut res); } }
        cur.push(c);
    }
    ferme(&mut cur, &mut res);
    Ok(res)
}
fn serie_get(ser: &[(f64, [f64; 3])], c: &V) -> Option<[f64; 3]> { match c { V::Nombre(x) => ser.iter().find(|y| y.0 == *x).map(|y| y.1), _ => None } }
fn serie_v(x: [f64; 3]) -> V { o(vec![("id", n(x[0])), ("rang", n(x[1])), ("longueur", n(x[2]))]) }
fn meme_voie(a: &V, c: &V) -> R<bool> {
    if !vrai(a) || !vrai(c) { return Ok(false); }
    Ok(strict_egal(g(a, "part"), g(c, "part"))? && strict_egal(&ou_nul(g(a, "frameId")), &ou_nul(g(c, "frameId")))?)
}

/// `memoireSerie({identity, differes, validees, seuils})`.
///
/// # Errors
/// `HorsDomaine`.
pub fn memoire_serie(arg: &V) -> R<V> {
    if nullish(arg) { return hd("déstructuration de null/undefined"); }
    let identity = g(arg, "identity");
    let mut se = vec![];
    etaler(&mut se, &memoire_serie_defaut())?;
    etaler(&mut se, &defaut(g(arg, "seuils"), memoire_serie_defaut))?;
    let sv = V::Objet(se);
    let ser = series(g(arg, "differes"), nombre(g(&sv, "ecartSerieMax"))?)?;
    let cut = p(identity, "cut")?;
    let Some(serie) = serie_get(&ser, cut) else {
        return Ok(o(vec![("etat", s("hors-serie")), ("serie", nul()), ("memoire", nul()), ("appuis", tab(vec![]))]));
    };
    let mut par_cut: Vec<(f64, V)> = vec![];
    let validees = g(arg, "validees");
    let vals = if vrai(validees) { if !est_tableau(validees) { return hd("validees non tabulaires"); } iter_vals(validees) } else { vec![] };
    for v in vals {
        let vi = p(&v, "identity")?;
        if !meme_voie(vi, identity)? { continue; }
        let vc = p(vi, "cut")?;
        if strict_egal(vc, cut)? { continue; }
        let Some(sx) = serie_get(&ser, vc) else { continue };
        if sx[0] != serie[0] { continue; }
        let V::Nombre(c) = vc else { continue };
        match par_cut.iter_mut().find(|x| x.0 == *c) {
            Some(x) => { if nombre(g(&v, "visitIndex"))? > nombre(g(&x.1, "visitIndex"))? { x.1 = v.clone(); } }
            None => par_cut.push((*c, v.clone())),
        }
    }
    let cn = nombre(cut)?;
    let mut mem: Vec<(f64, f64, V)> = vec![];
    for (c, v) in par_cut { mem.push(((c - cn).abs(), nombre(g(&v, "visitIndex"))?, v)); }
    if mem.len() > 1 && mem.iter().any(|x| !x.1.is_finite()) { return hd("visitIndex non fini"); }
    mem.sort_by(|a, c| {
        let d = a.0 - c.0;
        let d = if d == 0.0 { c.1 - a.1 } else { d };
        if d < 0.0 { core::cmp::Ordering::Less } else if d > 0.0 { core::cmp::Ordering::Greater } else { core::cmp::Ordering::Equal }
    });
    let k = crate::j4::fin_slice(mem.len(), g(&sv, "K"))?;
    mem.truncate(k);
    let porte = g(&sv, "porteDispersionMm").clone();
    if mem.is_empty() {
        return Ok(o(vec![("etat", s("sans-memoire")), ("serie", serie_v(serie)), ("memoire", o(vec![("cuts", tab(vec![])), ("n", n(0.0)), ("dispersionMm", nul()), ("porteMm", porte)])), ("appuis", tab(vec![]))]));
    }
    let disp = ariane_js::max_de(mem.iter().map(|x| x.0)) * nombre(g(&sv, "mmParCut"))?;
    let memoire = o(vec![("cuts", tab(mem.iter().map(|x| g(g(&x.2, "identity"), "cut").clone()).collect())), ("n", n(mem.len() as f64)), ("dispersionMm", n(disp)), ("porteMm", porte.clone())]);
    if disp > nombre(&porte)? { return Ok(o(vec![("etat", s("serie-instable")), ("serie", serie_v(serie)), ("memoire", memoire), ("appuis", tab(vec![]))])); }
    let ka = crate::j4::fin_slice(mem.len(), g(&sv, "appuis"))?;
    let appuis: Vec<V> = mem.iter().take(ka).map(|x| {
        let id = g(&x.2, "identity");
        o(vec![("identity", o(vec![("part", g(id, "part").clone()), ("cut", g(id, "cut").clone()), ("frameId", ou_nul(g(id, "frameId")))])), ("positions", g(&x.2, "positions").clone()), ("stage", s("operateur"))])
    }).collect();
    Ok(o(vec![("etat", s("ok")), ("serie", serie_v(serie)), ("memoire", memoire), ("appuis", tab(appuis))]))
}

/// Aiguillage `{f, a}` du module ; `recentrer` reçoit l'état du moteur GCV1 et les réglages globaux comme `decideCut`.
///
/// # Errors
/// `Js` ou `HorsDomaine`, comme les fonctions portées.
pub fn appeler(a: &Appel, entree: &V) -> R<V> {
    match a.f.as_str() {
        "localMm" => Ok(nombres(&local_mm(a.arg(0), a.arg(1))?)),
        "poseMm" => pose_mm(a.arg(0), a.arg(1)),
        "vueNecessaire" => vue_necessaire(a.arg(0), a.arg(1), a.arg(2)),
        "camerasLarges" => cameras_larges(a.arg(0)),
        "geste" => geste(a.arg(0), a.arg(1)),
        "traceMoteur" => trace_moteur(a.arg(0)),
        "confiances" => Ok(confiances(a.arg(0))),
        "profondeur" => { if !matches!(a.arg(1), V::Indefini) { return hd("profondeurAppui non fonction"); } Ok(n(profondeur(a.arg(0), &zero)?)) }
        "predictionDe" => prediction_de_v(a.arg(0), a.arg(1), a.arg(2)),
        "mesures" => { let e = mesures(a.arg(0), a.arg(1), a.arg(2), a.arg(3))?; let mut x = vec![]; for (k, v) in e { definir(&mut x, &k, v); } Ok(V::Objet(x)) }
        "regle" => regle(a.arg(0), a.arg(1), &defaut(a.arg(2), nul), &defaut(a.arg(3), nul)),
        "enRegle" => en_regle(a.arg(0)),
        "verdictPrudent" => verdict_prudent(a.arg(0), a.arg(1)),
        "completer" => completer(a.arg(0), &zero),
        "recentrer" => { let (et, gl) = lot::etat_globaux(entree)?; recentrer(a.arg(0), &et, &gl) }
        "appuisDepuisDecalage" => appuis_depuis_decalage(a.arg(0), a.arg(1)),
        // `typeof ecartementAdmissible==='function'` n'est jamais vrai d'une valeur décodée
        "choisirDansLePool" => choisir_dans_le_pool(a.arg(0), a.arg(1), a.arg(3)),
        "ecartPose" => ecart_pose(a.arg(0), a.arg(1)),
        "juger" => juger(a.arg(0), a.arg(1)),
        "memoireSerie" => memoire_serie(a.arg(0)),
        _ => hd("voie-recentree : fonction non portée"),
    }
}
