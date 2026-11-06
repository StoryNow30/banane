//! Assemblage pur de `Sessions.dataset` (`src/native-session.js`). L'horloge (`exportedAt`) et les lectures
//! `IndexedDB` sont fournies par l'appelant. `K.clone` est le clone JSON.
use crate::date::parse_iso;
use crate::jsval::{self, a, chaine, cmp_nombre, est_objet, nombre, vrai};
use crate::json::clone_json;
use ariane_js::Echec;
use ariane_vba::Valeur;
use std::collections::HashMap;

const SIDES: [&str; 2] = ["left", "right"];

fn type_error(lu: &str) -> Echec {
    Echec::Js { nom: "TypeError", message: format!("Cannot read properties of undefined (reading '{lu}')") }
}

fn cut_id(identity: &Valeur) -> String {
    let mut morceaux = Vec::with_capacity(6);
    for k in ["pageId", "part", "cut", "shape", "frameId", "projectId"] {
        let v = if k == "projectId" {
            let direct = a(identity, "projectId");
            if matches!(direct, Valeur::Indefini) {
                let p = a(identity, "project");
                if vrai(p) && chaine(&p) != Some("not-observed") { p.clone() } else { Valeur::Nul }
            } else { direct.clone() }
        } else { a(identity, k).clone() };
        morceaux.push(match &v {
            Valeur::Chaine(s) => s.clone(),
            Valeur::Nombre(x) => crate::nombre::vers_chaine(*x),
            Valeur::Booleen(b) => { if *b { "true".into() } else { "false".into() } }
            _ => "not-observed".into(),
        });
    }
    morceaux.join("|")
}

fn pose_egale(a_pose: &Valeur, b_pose: &Valeur) -> bool {
    for nom in ["railLocalToSceneRelative", "profileLocalToSceneRelative"] {
        let (aa, bb) = (a(a_pose, nom), a(b_pose, nom));
        let xv = nombres16(aa);
        let yv = nombres16(bb);
        if xv.len() != 16 || yv.len() != 16 { return false; }
        if !xv.iter().zip(yv.iter()).all(|(p, q)| p.is_finite() && q.is_finite() && (p - q).abs() <= 1e-7) { return false; }
    }
    true
}
fn nombres16(v: &Valeur) -> Vec<f64> {
    match v {
        Valeur::Nombres(t) => t.clone(),
        Valeur::Tableau(t) => t.iter().map(|e| e.as_ref().and_then(nombre).unwrap_or(f64::NAN)).collect(),
        _ => vec![],
    }
}

fn visit_index(r: &Valeur) -> f64 {
    match a(r, "visitIndex") { Valeur::Indefini | Valeur::Nul => 0.0, v => jsval::vers_f64(v) }
}
fn seq_de(e: &Valeur) -> f64 {
    for k in ["eventSeq", "event_seq"] {
        let v = a(e, k);
        if vrai(v) { return jsval::vers_f64(v); }
    }
    0.0
}

fn mediane_basse(mut a: Vec<f64>) -> Valeur {
    if a.is_empty() { return jsval::nul(); }
    a.sort_by(|x, y| cmp_nombre(*x, *y));
    jsval::n(a[(a.len() - 1) / 2])
}

/// Assemble l'objet `dataset` de `src/native-session.js`. La fonction JS est gardée d'un bloc : c'est elle que la parité relit.
#[allow(clippy::too_many_lines)]
pub fn assembler(entree: &Valeur) -> Result<Valeur, Echec> {
    let n = a(entree, "session");
    if !est_objet(n) { return Err(Echec::erreur("Aucune session Natif conservée.")); }
    let id = chaine(a(n, "id")).unwrap_or("");
    let mut records: Vec<Valeur> = jsval::elements(a(entree, "records")).into_iter().filter(|r| chaine(a(r, "nativeSessionId")) == Some(id)).cloned().collect();
    records.sort_by(|a, b| cmp_nombre(visit_index(a), visit_index(b)));
    let mut events: Vec<Valeur> = jsval::elements(a(entree, "events")).into_iter().filter(|e| chaine(a(e, "nativeSessionId")) == Some(id)).cloned().collect();
    events.sort_by(|a, b| cmp_nombre(seq_de(a), seq_de(b)));

    let mut counts: HashMap<String, f64> = HashMap::new();
    let mut ordre_counts = vec![];
    for r in &records {
        let k = cut_id(a(r, "identity"));
        if !counts.contains_key(&k) { ordre_counts.push(k.clone()); }
        *counts.entry(k).or_insert(0.0) += 1.0;
    }
    let mut loss: Vec<(String, f64)> = vec![];
    for r in &records {
        let elig = a(r, "geometryEligibility");
        for side in SIDES {
            for reason in jsval::elements(a(a(elig, side), "reasons")) {
                if let Some(k) = chaine(reason) {
                    if let Some(p) = loss.iter_mut().find(|(c, _)| c == k) { p.1 += 1.0; } else { loss.push((k.to_string(), 1.0)); }
                }
            }
        }
    }
    let mut first: [Vec<(usize, usize)>; 2] = [vec![], vec![]];
    for (ri, r) in records.iter().enumerate() {
        for (si, side) in SIDES.iter().enumerate() {
            let snaps = jsval::elements(a(a(r, "railSnapshots"), side));
            for (j, item) in snaps.iter().enumerate() {
                if chaine(a(item, "qualificationStatus")) != Some("qualified-candidate") { continue; }
                if !vrai(a(item, "receiptEventSeq")) { continue; }
                let rev = a(item, "revocations");
                let rev_len = match rev { Valeur::Tableau(t) => t.len(), Valeur::Nombres(t) => t.len(), Valeur::Indefini | Valeur::Nul => 0, _ => 1 };
                if rev_len != 0 { continue; }
                if chaine(a(item, "sourceStatus")) != Some("reference-version-and-matrix-stable-through-checkpoint") { continue; }
                if chaine(a(item, "clipStatus")) != Some("verified-classifiable") { continue; }
                if !jsval::strict_eq(a(a(item, "coordinateSystem"), "frameId"), a(a(r, "identity"), "frameId")) { continue; }
                if !pose_egale(a(item, "rail"), a(a(a(r, "beforeEstablished"), "rails"), side)) { continue; }
                first[si].push((ri, j));
                break;
            }
        }
    }
    let mut latence = vec![];
    for (si, side) in SIDES.iter().enumerate() {
        let mut values = vec![];
        for (ri, j) in &first[si] {
            let r = &records[*ri];
            let snaps = jsval::elements(a(a(r, "railSnapshots"), side));
            let item = snaps[*j];
            let a_ms = chaine(a(item, "acquiredThroughAt")).and_then(parse_iso);
            let b_ms = chaine(a(r, "startedAt")).and_then(parse_iso);
            if let (Some(a), Some(b)) = (a_ms, b_ms) {
                let d = a - b;
                if d.is_finite() && d >= 0.0 { values.push(d); }
            }
        }
        let max = if values.is_empty() { jsval::nul() } else { jsval::n(values.iter().copied().fold(f64::NEG_INFINITY, ariane_js::max)) };
        latence.push(((*side).to_string(), jsval::o(vec![("count", jsval::n(values.len() as f64)), ("medianMs", mediane_basse(values)), ("maximumMs", max)])));
    }
    let periods = a(n, "observationPeriods");
    if !matches!(periods, Valeur::Tableau(_)) { return Err(type_error("length")); }
    let clouds = a(n, "cloudIds");
    if !matches!(clouds, Valeur::Tableau(_) | Valeur::Nombres(_)) { return Err(type_error("length")); }
    let metrics = a(n, "metrics");
    if !est_objet(metrics) { return Err(type_error("dropped")); }
    let fin = a(n, "finishedAt");
    let duration = if vrai(fin) {
        let d = (parse_iso(chaine(fin).unwrap_or("")).unwrap_or(f64::NAN) - parse_iso(chaine(a(n, "startedAt")).unwrap_or("")).unwrap_or(f64::NAN)) / 60000.0;
        jsval::n(ariane_js::max(0.0, d))
    } else { jsval::nul() };
    let dur_f = nombre(&duration);
    let mut rails_ok = 0.0;
    for r in &records { for side in SIDES { if chaine(a(a(a(r, "geometryEligibility"), side), "status")) == Some("comparable-candidate") { rails_ok += 1.0; } } }
    let par_minute = match dur_f { Some(d) if d != 0.0 && d.is_finite() => jsval::n(rails_ok / d), _ => jsval::nul() };
    let mut caps: Vec<(usize, String)> = vec![];
    for (i, r) in records.iter().enumerate() {
        if let Some(t) = jsval::obj(a(r, "geometryCaptures")) {
            for (k, _) in t { caps.push((i, k.clone())); }
        }
    }
    let mut terminaisons: Vec<(String, f64)> = vec![];
    for (i, k) in &caps {
        let c = a(a(&records[*i], "geometryCaptures"), k);
        let key = chaine(a(a(c, "termination"), "code")).map_or_else(|| {
            if chaine(a(c, "status")) == Some("reading") { "NOT_REPORTED".into() } else { "NONE".into() }
        }, std::string::ToString::to_string);
        if let Some(p) = terminaisons.iter_mut().find(|(c, _)| c == &key) { p.1 += 1.0; } else { terminaisons.push((key, 1.0)); }
    }
    let mut par_rail = vec![];
    for (si, side) in SIDES.iter().enumerate() {
        let taux = if records.is_empty() { jsval::nul() } else { jsval::n(first[si].len() as f64 / records.len() as f64) };
        par_rail.push(((*side).to_string(), taux));
    }
    let capture_health = jsval::o(vec![
        ("visits", jsval::n(records.len() as f64)),
        ("captures", jsval::n(caps.len() as f64)),
        ("capturesPerVisit", if records.is_empty() { jsval::nul() } else { jsval::n(caps.len() as f64 / records.len() as f64) }),
        ("terminations", Valeur::Objet(terminaisons.into_iter().map(|(k, v)| (k, jsval::n(v))).collect())),
        ("qualifiedInitialSnapshotRateByRail", Valeur::Objet(par_rail)),
    ]);
    let confirmes = records.iter().filter(|r| matches!(a(r, "serverConfirmed"), Valeur::Booleen(true))).count();
    let mut usable = vec![];
    for side in SIDES {
        let n_ok = records.iter().filter(|r| chaine(a(a(a(r, "geometryEligibility"), side), "status")) == Some("comparable-candidate")).count();
        usable.push((side.to_string(), jsval::n(n_ok as f64)));
    }
    let mut fermeture = vec![
        ("captureHealth".into(), capture_health),
        ("status".into(), a(n, "status").clone()),
        ("visits".into(), jsval::n(records.len() as f64)),
        ("complete".into(), jsval::n(records.iter().filter(|r| chaine(a(r, "status")) == Some("complete")).count() as f64)),
        ("partial".into(), jsval::n(records.iter().filter(|r| chaine(a(r, "status")) != Some("complete")).count() as f64)),
        ("returns".into(), jsval::n({ let mut s = 0.0; for k in &ordre_counts { let c = counts[k]; if c > 1.0 { s += c - 1.0; } } s })),
        ("observationPeriods".into(), jsval::n(jsval::elements(periods).len() as f64)),
        ("lidarCaptures".into(), jsval::n(match clouds { Valeur::Tableau(t) => t.len(), Valeur::Nombres(t) => t.len(), _ => 0 } as f64)),
        ("usableByRail".into(), Valeur::Objet(usable)),
        ("usablePairs".into(), jsval::n(records.iter().filter(|r| chaine(a(a(a(r, "geometryEligibility"), "pair"), "status")) == Some("comparable-candidate")).count() as f64)),
        ("geometryLossCauses".into(), Valeur::Objet(loss.into_iter().map(|(k, v)| (k, jsval::n(v))).collect())),
        ("firstQualifiedStoredSnapshotByRail".into(), jsval::o(vec![("left", jsval::n(first[0].len() as f64)), ("right", jsval::n(first[1].len() as f64))])),
        ("firstQualifiedAcquisitionLatencyByRail".into(), Valeur::Objet(latence)),
        ("durationMinutes".into(), duration),
        ("comparableCandidateRailsPerMinute".into(), par_minute),
        ("droppedEvents".into(), a(metrics, "dropped").clone()),
        ("degradationLevels".into(), a(metrics, "degradationLevels").clone()),
        ("serverConfirmationAvailable".into(), jsval::b(confirmes > 0)),
        ("serverConfirmationStatus".into(), jsval::s(if confirmes > 0 { "observed-validation-writes" } else { "not-observed" })),
    ];
    if confirmes > 0 { fermeture.push(("serverConfirmedVisits".into(), jsval::n(confirmes as f64))); }
    fermeture.push(("serverConfirmationNotAnError".into(), jsval::b(true)));
    fermeture.push(("passiveContract".into(), jsval::o(vec![
        ("commandsByBanane", jsval::n(0.0)), ("cameraChangesByBanane", jsval::n(0.0)),
        ("railSelectionsByBanane", jsval::n(0.0)), ("navigationByBanane", jsval::n(0.0)),
    ])));
    let raison = if vrai(a(n, "raison")) { resume_series(a(n, "raison")) } else { vec![] };
    let exported_at = chaine(a(entree, "exportedAt")).unwrap_or("").to_string();
    let mut sortie = vec![
        ("format".into(), jsval::s("banane-native-session-v2")),
        ("version".into(), jsval::s("5")),
        ("exportedAt".into(), jsval::s(exported_at)),
        ("session".into(), clone_json(n)),
        ("records".into(), jsval::tab(records)),
        ("events".into(), jsval::tab(events)),
        ("closureSummary".into(), Valeur::Objet(fermeture)),
        ("cloudIds".into(), clouds.clone()),
    ];
    if !raison.is_empty() { sortie.push(("raisonSeries".into(), jsval::tab(raison))); }
    Ok(Valeur::Objet(sortie))
}

fn resume_series(etat: &Valeur) -> Vec<Valeur> {
    if !vrai(etat) { return vec![]; }
    let mut out: Vec<Valeur> = jsval::elements(a(etat, "series")).into_iter().cloned().collect();
    // `{...s}` copie l'objet. Un élément non objet est ignoré comme le spread d'un non-objet... un élément de tableau est un objet de série.
    if vrai(a(etat, "collante")) {
        let c = a(etat, "collante");
        out.push(jsval::o(vec![
            ("serie", a(c, "serie").clone()), ("code", a(c, "code").clone()), ("partie", a(c, "partie").clone()),
            ("cutDebut", a(c, "cutDebut").clone()), ("cutFin", a(c, "cutFin").clone()), ("nCuts", a(c, "nCuts").clone()),
            ("finPar", jsval::nul()),
        ]));
    }
    out
}
