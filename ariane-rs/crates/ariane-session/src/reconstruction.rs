//! `src/native-reconstruction.js` : `etiquette`, `memeEtiquette`, `distMm`, `reconstruireRail`, `reconstruireCut`.
//! `couvertureDansRepere` (couverture recalculée à partir des points, `native-lidar.js`) n'est pas portée : quand un
//! instantané pris rail déplacé doit être recalculé ET que les nuages sont fournis, hors domaine (la façade rejoue le JS).
use crate::js_extra::{self as js, ch, chemin, est, hd, s, tab, Obj};
use crate::session::choose_geometry;
use ariane_js::Echec;
use ariane_vba::Valeur;

const SIDES: [&str; 2] = ["left", "right"];
const TOL_MM: f64 = 1.0;

/// `pos(rail)` : la liste des trois coordonnées si c'est un tableau de longueur 3.
fn pos(rail: &Valeur) -> Option<&Valeur> {
    let p = ch(rail, "positionSceneRelative");
    (js::est_tableau(p) && js::longueur(p) == Some(3.0)).then_some(p)
}
/// Trois nombres (sans trou, sans conversion) ; hors domaine sinon.
fn nombres3(p: &Valeur) -> Result<[f64; 3], Echec> {
    let l = js::denses(p)?.unwrap_or_default();
    let mut o = [0.0; 3];
    for (c, x) in o.iter_mut().zip(l.iter()) { *c = js::nombre(x).ok_or_else(|| Echec::hors_domaine("coordonnée non numérique"))?; }
    Ok(o)
}
/// `distMm(a, b)` (fonction 292).
///
/// # Errors
/// Hors domaine : coordonnées non numériques.
pub fn dist_mm(a: &Valeur, b: &Valeur) -> Result<Option<f64>, Echec> {
    let (Some(p), Some(q)) = (pos(a), pos(b)) else { return Ok(None) };
    let (p, q) = (nombres3(p)?, nombres3(q)?);
    Ok(Some(ariane_js::hypot(&[q[0] - p[0], q[1] - p[1], q[2] - p[2]]) * 1000.0))
}

/// `etiquette(record, side, depart)` (fonction 290).
///
/// # Errors
/// Hors domaine : coordonnées non numériques.
pub fn etiquette(record: &Valeur, side: &str, depart: &Valeur) -> Result<Valeur, Echec> {
    let (Some(fin), Some(d)) = (pos(chemin(record, &["humanFinalReference", "state", "rails", side])), pos(depart)) else { return Ok(Valeur::Nul) };
    let (f, dd) = (nombres3(fin)?, nombres3(d)?);
    Ok(Obj::new().et("finale", js::tranche(fin, 3)).et("correctionMm", Valeur::Nombres(vec![(f[0] - dd[0]) * 1000.0, (f[1] - dd[1]) * 1000.0, (f[2] - dd[2]) * 1000.0])).v())
}

/// `memeEtiquette(a, b, tolMm = 1)` (fonction 291).
///
/// # Errors
/// Hors domaine : listes non numériques ou à trous, tolérance non numérique.
pub fn meme_etiquette(a: &Valeur, b: &Valeur, tol: &Valeur) -> Result<bool, Echec> {
    let tol = match tol { Valeur::Indefini => TOL_MM, Valeur::Nombre(x) => *x, _ => return hd("memeEtiquette : tolérance") };
    if !a.vrai() || !b.vrai() { return Ok(false); }
    let liste = |v: &Valeur, k: &str| -> Result<Vec<f64>, Echec> {
        let l = js::denses(ch(v, k))?.ok_or_else(|| Echec::hors_domaine("memeEtiquette : liste"))?;
        l.iter().map(|x| js::nombre(x).ok_or_else(|| Echec::hors_domaine("memeEtiquette : nombre"))).collect()
    };
    let (ac, bc) = (liste(a, "correctionMm")?, liste(b, "correctionMm")?);
    for (i, v) in ac.iter().enumerate() { let w = bc.get(i).copied().unwrap_or(f64::NAN); if !((v - w).abs() <= tol) { return Ok(false); } }
    let (af, bf) = (liste(a, "finale")?, liste(b, "finale")?);
    for (i, v) in af.iter().enumerate() { let w = bf.get(i).copied().unwrap_or(f64::NAN); if !((v - w).abs() * 1000.0 <= tol) { return Ok(false); } }
    Ok(true)
}

/// `Date.parse(v)` brut : `undefined` et `null` (« null ») → NaN, chaîne → `js_extra::date` ; autre → hors domaine.
fn date_brut(v: &Valeur) -> Result<f64, Echec> {
    match v { Valeur::Indefini | Valeur::Nul => Ok(f64::NAN), Valeur::Chaine(c) => js::date::parse(c), _ => hd("Date.parse d'une valeur non chaîne") }
}
fn clone(v: &Valeur) -> Result<Valeur, Echec> { js::clone_json(v).ok_or_else(|| Echec::hors_domaine("clone de undefined (le JS lève)")) }
fn vide() -> Valeur { tab(vec![]) }

/// `reconstruireRail(record, side, {nuages, tolMm})` (fonction 293) ; `nuages` : vrai si la façade a reçu des nuages.
///
/// # Errors
/// Hors domaine : couverture à recalculer avec des nuages (non portée), clones de `undefined`, conversions, dates.
pub fn reconstruire_rail(record: &Valeur, side: &str, nuages: bool, tol: f64) -> Result<Valeur, Echec> {
    let stricte = choose_geometry(record, side)?;
    if est(ch(&stricte, "status"), "qualified-candidate") {
        return Ok(Obj::new().et("qualifie", Valeur::Booleen(true)).et("voie", s("stricte")).et("captureId", ch(&stricte, "captureId").clone())
            .et("chunkIds", ch(&stricte, "chunkIds").clone()).et("raisons", vide()).v());
    }
    let before = chemin(record, &["beforeEstablished", "rails", side]);
    if !before.vrai() { return Ok(Obj::new().et("qualifie", Valeur::Booleen(false)).et("voie", Valeur::Nul).et("raisons", tab(vec![s("etat-initial-absent")])).v()); }
    let sp = chemin(record, &["startPose", "rails", side]);
    let depart = if sp.vrai() { sp } else { before };
    let ecart = dist_mm(before, depart)?;
    if ecart.is_none_or(|e| e > tol) {
        return Ok(Obj::new().et("qualifie", Valeur::Booleen(false)).et("voie", Valeur::Nul).et("raisons", tab(vec![s("pose-de-depart-etiquette-differente-de-etat-initial")]))
            .et("ecartEtiquetteMm", js::n_ou_nul(ecart)).v());
    }
    let mut refus: Vec<Valeur> = vec![];
    let snaps = js::liste_ou_vide(chemin(record, &["railSnapshots", side]))?;
    let Valeur::Objet(rc) = clone(record)? else { return hd("record non objet") };
    for snap in &snaps {
        let mut copie = Obj(rc.clone());
        let Valeur::Objet(sc) = clone(snap)? else { return hd("instantané non objet") };
        let mut copie_snap = Obj(sc);
        let reclasse = est(ch(snap, "clipStatus"), "reclassified-to-current-clip");
        if reclasse { copie_snap.poser("clipStatus", s("verified-classifiable")); }
        copie.poser("railSnapshots", Obj::new().et(side, tab(vec![copie_snap.v()])).v());
        let mut be = Obj::new();
        be.etaler(copie.lire("beforeEstablished"))?;
        let mut rails = Obj::new();
        rails.etaler(ch(copie.lire("beforeEstablished"), "rails"))?;
        rails.poser(side, clone(ch(snap, "rail"))?);
        be.poser("rails", rails.v());
        copie.poser("beforeEstablished", be.v());
        copie.poser("operatorIntents", vide());
        let g = choose_geometry(&copie.v(), side)?;
        if !est(ch(&g, "status"), "qualified-candidate") {
            refus.extend(js::denses(ch(&g, "reasons"))?.unwrap_or_default().iter().cloned());
            continue;
        }
        let ecart_pose = dist_mm(before, ch(snap, "rail"))?;
        let meme = ecart_pose.is_some_and(|e| e <= tol);
        if !meme {
            if !nuages { refus.push(s("pose-differente-points-absents")); continue; }
            return hd("couvertureDansRepere non portée (native-lidar)");
        }
        let intention = match ch(record, "operatorIntents") { v if js::est_tableau(v) => js::elements(v).and_then(|l| l.first().cloned()).unwrap_or(Valeur::Indefini), Valeur::Indefini | Valeur::Nul => Valeur::Indefini, _ => return hd("operatorIntents") };
        let apres = intention.vrai() && {
            let o = ch(&intention, "observedAt");
            date_brut(ch(snap, "acquiredThroughAt"))? > if o.vrai() { date_brut(o)? } else { f64::NAN }
        };
        let chunk = ch(snap, "chunkIds");
        let chunk = match chunk { Valeur::Chaine(_) => chunk.clone(), v if js::est_tableau(v) => js::tranche(v, usize::MAX), _ => return hd("chunkIds non tableau") };
        return Ok(Obj::new().et("qualifie", Valeur::Booleen(true)).et("voie", s(if reclasse { "reclasse-decoupe" } else { "instantane-meme-pose" }))
            .et("captureId", ch(snap, "captureId").clone()).et("snapshotId", ch(snap, "snapshotId").clone()).et("chunkIds", chunk)
            .et("ecartPoseMm", js::n_ou_nul(ecart_pose)).et("apresIntention", Valeur::Booleen(apres)).et("couverture", Valeur::Nul).et("raisons", vide()).v());
    }
    let source = if refus.is_empty() { js::denses(ch(&stricte, "reasons"))?.unwrap_or_default().into_owned() } else { refus };
    let mut out: Vec<Valeur> = vec![];
    for x in source {
        if matches!(x, Valeur::Objet(_) | Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Bloc { .. }) { return hd("Set d'objets"); }
        let deja = out.iter().any(|y| js::strict(&x, y).unwrap_or(false) || matches!((&x, y), (Valeur::Nombre(a), Valeur::Nombre(b)) if a.is_nan() && b.is_nan()));
        if !deja { out.push(x); }
    }
    Ok(Obj::new().et("qualifie", Valeur::Booleen(false)).et("voie", Valeur::Nul).et("raisons", tab(out)).v())
}

/// `reconstruireCut(record, options)` (fonction 294).
///
/// # Errors
/// Voir [`reconstruire_rail`].
pub fn reconstruire_cut(record: &Valeur, nuages: bool, tol: f64) -> Result<Valeur, Echec> {
    let mut rails = Obj::new();
    let (mut q, mut st) = (true, true);
    for side in SIDES {
        let r = reconstruire_rail(record, side, nuages, tol)?;
        q &= ch(&r, "qualifie").vrai();
        st &= est(ch(&r, "voie"), "stricte");
        rails.poser(side, r);
    }
    Ok(Obj::new().et("qualifie", Valeur::Booleen(q)).et("stricte", Valeur::Booleen(st)).et("rails", rails.v()).v())
}

/// Options `{nuages, tolMm}` : (nuages fournis ?, tolérance) ; hors domaine pour une tolérance non numérique.
///
/// # Errors
/// Hors domaine : options nulles ou tolérance non numérique.
pub fn options(o: &Valeur) -> Result<(bool, f64), Echec> {
    match o {
        Valeur::Indefini => Ok((false, TOL_MM)),
        Valeur::Objet(_) => {
            let t = match ch(o, "tolMm") { Valeur::Indefini => TOL_MM, Valeur::Nombre(x) => *x, _ => return hd("tolMm non numérique") };
            Ok((ch(o, "nuages").vrai(), t))
        }
        _ => hd("options non objet"),
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    fn rail(x: f64) -> Valeur { Obj::new().et("positionSceneRelative", Valeur::Nombres(vec![x, 0.0, 0.0])).v() }
    #[test]
    fn distances_et_etiquettes() {
        assert_eq!(dist_mm(&rail(0.0), &rail(0.002)), Ok(Some(2.0)));
        let rec = Obj::new().et("humanFinalReference", Obj::new().et("state", Obj::new().et("rails", Obj::new().et("left", rail(0.01)).v()).v()).v()).v();
        let e = etiquette(&rec, "left", &rail(0.0)).unwrap_or(Valeur::Nul);
        assert_eq!(meme_etiquette(&e, &e, &Valeur::Indefini), Ok(true));
        let r = reconstruire_cut(&Obj::new().v(), false, 1.0).unwrap_or(Valeur::Nul);
        assert_eq!(ch(&r, "qualifie"), &Valeur::Booleen(false));
        assert!(options(&Valeur::Nul).is_err());
    }
}
