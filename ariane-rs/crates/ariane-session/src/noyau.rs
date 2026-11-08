//! `src/core.js` : `expectedPoses` et `pairCorpus` (le reste du module est déjà porté ailleurs ou tient du stockage).
use crate::js_extra::{self as js, ch, chemin, hd, json, s, tab, Carte, Obj};
use ariane_js::Echec;
use ariane_vba::Valeur;

const SIDES: [&str; 2] = ["left", "right"];

/// Seize nombres d'un tableau de forme exacte (lecture `m[i]` du JS sans conversion) ; hors domaine sinon.
fn m16(v: &Valeur) -> Result<[f64; 16], Echec> {
    let l = js::denses(v)?.ok_or_else(|| Echec::hors_domaine("matrice non tableau"))?;
    if l.len() != 16 { return hd("matrice de longueur ≠ 16"); }
    let mut m = [0.0; 16];
    for (o, x) in m.iter_mut().zip(l.iter()) { *o = js::nombre(x).ok_or_else(|| Echec::hors_domaine("matrice non numérique"))?; }
    Ok(m)
}
fn v16(m: &[f64; 16]) -> Valeur { Valeur::Nombres(m.to_vec()) }

/// `expectedPoses(before, proposals)` (fonction 285).
///
/// # Errors
/// `Echec::Js` : « Proposition absente : <côté> », et les messages de `C.point` / `C.inverse` ; hors domaine : formes
/// où le JS lèverait une `TypeError` ou convertirait.
pub fn expected_poses(before: &Valeur, proposals: &Valeur) -> Result<Valeur, Echec> {
    if js::nul(before) || js::nul(proposals) { return hd("expectedPoses : argument absent"); }
    let rails = ch(before, "rails");
    let Some(Valeur::Objet(out0)) = js::clone_json(rails) else { return hd("expectedPoses : rails non objet") };
    let mut out = Obj(out0);
    for side in SIDES {
        let p = ch(proposals, side);
        let delta = ch(p, "delta");
        if !delta.vrai() { return Err(Echec::erreur(format!("Proposition absente : {side}"))); }
        let rb = ch(rails, side);
        if js::nul(rb) { return hd("expectedPoses : rail absent"); }
        let pl = m16(ch(rb, "profileLocalToSceneRelative"))?;
        let [x, y, z] = ariane_capture::xyz(delta)?;
        let world = ariane_capture::point(&pl, x, y, z)?;
        let origin = ariane_capture::point(&pl, 0.0, 0.0, 0.0)?;
        let d = [world[0] - origin[0], world[1] - origin[1], world[2] - origin[2]];
        let Valeur::Objet(r0) = out.lire(side).clone() else { return hd("expectedPoses : rail cloné non objet") };
        let mut r = Obj(r0);
        let mut t = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
        t[12] = d[0]; t[13] = d[1]; t[14] = d[2];
        for name in ["railLocalToSceneRelative", "profileLocalToSceneRelative"] {
            let m = m16(r.lire(name))?;
            r.poser(name, v16(&ariane_capture::multiply(&t, &m)));
        }
        let plm = m16(r.lire("profileLocalToSceneRelative"))?;
        // C.inverse passe par C.matrix (16 nombres finis, sinon « Matrice 4 × 4 absente ou non finie. »)
        r.poser("sceneRelativeToProfileLocal", v16(&ariane_capture::inverse(&ariane_capture::matrice(&v16(&plm))?)?));
        let rl = m16(r.lire("railLocalToSceneRelative"))?;
        r.poser("positionSceneRelative", Valeur::Nombres(ariane_capture::point(&rl, 0.0, 0.0, 0.0)?.to_vec()));
        r.poser("profileOriginSceneRelative", Valeur::Nombres(ariane_capture::point(&plm, 0.0, 0.0, 0.0)?.to_vec()));
        out.poser(side, r.v());
    }
    Ok(out.v())
}

/// Clé de carte JS (`SameValueZero`) pour une valeur primitive.
fn cle(v: &Valeur) -> Result<String, Echec> {
    Ok(match v {
        Valeur::Indefini => "u".into(), Valeur::Nul => "n".into(), Valeur::Booleen(b) => format!("b{b}"),
        Valeur::Nombre(x) => format!("x{}", ariane_js::cle_same_value_zero(*x)), Valeur::Chaine(c) => format!("s{c}"),
        _ => return hd("clé de carte objet"),
    })
}
/// `'texte' + v`.
fn plus(a: &str, v: &Valeur) -> Result<String, Echec> { Ok(format!("{a}{}", js::en_chaine(v)?)) }
/// `{name, data}`.
fn entree(name: &Valeur, data: &Valeur) -> Valeur { Obj::new().et("name", name.clone()).et("data", data.clone()).v() }

/// `pairCorpus(files)` (fonction 286).
///
/// # Errors
/// Hors domaine : JSON invalide (le message de V8 entre dans `errors`), texte non chaîne, clés objets, `===` entre objets.
pub fn pair_corpus(files: &Valeur) -> Result<Valeur, Echec> {
    let Some(files) = js::denses(files)? else { return hd("pairCorpus : files non tableau") };
    let mut captures: Carte<String, Valeur> = Carte::default();
    let mut records: Carte<String, Valeur> = Carte::default();
    let (mut errors, mut duplicates): (Vec<Valeur>, Vec<Valeur>) = (vec![], vec![]);
    for f in files.iter() {
        if !matches!(f, Valeur::Objet(_)) { return hd("pairCorpus : fichier non objet"); }
        let name = ch(f, "name");
        let Valeur::Chaine(texte) = ch(f, "text") else { return hd("pairCorpus : texte non chaîne") };
        let d = json::parse(texte)?;
        if !matches!(d, Valeur::Objet(_)) {
            let n = if matches!(name, Valeur::Indefini) { "fichier".to_owned() } else { js::en_chaine(name)? };
            errors.push(s(&format!("{n} : objet JSON attendu.")));
            continue;
        }
        let mut arrays: Vec<Vec<Valeur>> = vec![];
        for k in ["clouds", "records", "manualReferences"] {
            let v = ch(&d, k);
            if !matches!(v, Valeur::Indefini) && !js::est_tableau(v) { errors.push(s(&format!("{} : {k} doit être une liste.", js::en_chaine(name)?))); }
            arrays.push(if js::est_tableau(v) { js::elements(v).unwrap_or_default().into_owned() } else { vec![] });
        }
        let vide = vec![];
        let (clouds, recs, manuels) = (arrays.first().unwrap_or(&vide), arrays.get(1).unwrap_or(&vide), arrays.get(2).unwrap_or(&vide));
        for cloud in std::iter::once(&d).chain(clouds.iter()) {
            let id = ch(cloud, "captureId");
            if !id.vrai() || !js::est_tableau(ch(cloud, "pointsSceneRelative")) { continue; }
            let k = cle(id)?;
            let contradictoire = match captures.get(&k) { Some(e) => js::json(ch(e, "data")) != js::json(cloud), None => false };
            if contradictoire { errors.push(s(&plus("captureId contradictoire : ", id)?)); } else { captures.set(k, entree(name, cloud)); }
        }
        for r in recs.iter().chain(manuels.iter()) {
            let id = ch(r, "recordId");
            if !id.vrai() { continue; }
            let k = cle(id)?;
            match records.get(&k) {
                Some(e) => { if js::json(ch(e, "data")) == js::json(r) { duplicates.push(id.clone()); } else { errors.push(s(&plus("recordId contradictoire : ", id)?)); } }
                None => records.set(k, entree(name, r)),
            }
        }
    }
    let (mut paired, mut missing) = (vec![], vec![]);
    for r in records.valeurs() {
        let rd = ch(r, "data");
        let c = match cle(ch(rd, "lidarCaptureId")) { Ok(k) => captures.get(&k), Err(_) => return hd("lidarCaptureId objet") };
        let Some(c) = c else { missing.push(r.clone()); continue };
        let cd = ch(c, "data");
        let mut bad: Vec<String> = vec![];
        for k in ["part", "cut", "shape", "sessionId", "visitId"] {
            let (a, b) = (ch(rd, k), ch(cd, k));
            if matches!(a, Valeur::Indefini) || matches!(b, Valeur::Indefini) || !js::strict(a, b)? { bad.push(k.into()); }
        }
        if !js::strict(chemin(rd, &["coordinateBridge", "sceneFrameId"]), chemin(cd, &["coordinateBridge", "sceneFrameId"]))? { bad.push("sceneFrameId".into()); }
        for side in SIDES {
            let (initial, rail) = (chemin(rd, &["rails", side, "initial"]), chemin(cd, &["rails", side]));
            if !initial.vrai() || !rail.vrai() || js::json(ch(initial, "profileLocalToSceneRelative")) != js::json(ch(rail, "profileLocalToSceneRelative")) { bad.push(format!("{side}.initial")); }
        }
        if bad.is_empty() { paired.push(Obj::new().et("reference", r.clone()).et("capture", c.clone()).v()); }
        else { errors.push(s(&format!("{} : {}", plus("Association refusée ", ch(rd, "recordId"))?, bad.join(", ")))); }
    }
    Ok(Obj::new().et("paired", tab(paired)).et("missing", tab(missing)).et("errors", tab(errors)).et("duplicates", tab(duplicates))
        .et("uniqueRecords", Valeur::Nombre(records.len() as f64)).et("uniqueCaptures", Valeur::Nombre(captures.len() as f64)).v())
}

#[cfg(test)]
mod essais {
    use super::*;
    fn ident() -> Valeur { Valeur::Nombres(vec![1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0]) }
    #[test]
    fn poses_attendues() {
        let rail = Obj::new().et("railLocalToSceneRelative", ident()).et("profileLocalToSceneRelative", ident()).v();
        let before = Obj::new().et("rails", Obj::new().et("left", rail.clone()).et("right", rail).v()).v();
        let p = Obj::new().et("left", Obj::new().et("delta", Valeur::Nombres(vec![0.1, 0.0, 0.0])).v()).et("right", Obj::new().et("delta", Valeur::Nombres(vec![0.0, 0.2, 0.0])).v()).v();
        let r = expected_poses(&before, &p).unwrap_or(Valeur::Nul);
        assert_eq!(chemin(&r, &["left", "positionSceneRelative"]), &Valeur::Nombres(vec![0.1, 0.0, 0.0]));
        let p2 = Obj::new().et("left", Obj::new().v()).v();
        assert_eq!(expected_poses(&before, &p2), Err(Echec::erreur("Proposition absente : left")));
    }
    #[test]
    fn corpus_apparie() {
        let cap = r#"{"captureId":"c1","pointsSceneRelative":[],"part":1,"cut":2,"shape":"s","sessionId":"S","visitId":"v","rails":{"left":{"profileLocalToSceneRelative":[1]},"right":{"profileLocalToSceneRelative":[2]}}}"#;
        let rec = r#"{"records":[{"recordId":"r1","lidarCaptureId":"c1","part":1,"cut":2,"shape":"s","sessionId":"S","visitId":"v","rails":{"left":{"initial":{"profileLocalToSceneRelative":[1]}},"right":{"initial":{"profileLocalToSceneRelative":[2]}}}}]}"#;
        let files = tab(vec![Obj::new().et("name", s("a")).et("text", s(cap)).v(), Obj::new().et("name", s("b")).et("text", s(rec)).v(), Obj::new().et("name", s("c")).et("text", s("[]")).v()]);
        let r = pair_corpus(&files).unwrap_or(Valeur::Nul);
        assert_eq!(js::longueur(ch(&r, "paired")), Some(1.0));
        assert_eq!(ch(&r, "errors"), &tab(vec![s("c : objet JSON attendu.")]));
    }
}
