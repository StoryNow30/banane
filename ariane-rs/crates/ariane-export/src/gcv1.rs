//! Port de `buildDiagnostic` de `src/gcv1-export.js` (`exportedAt` reçu de la façade, qui calcule le défaut
//! `new Date().toISOString()` du JS quand il manque). Reste en JS : `buildCorpusPlan` (asynchrone, reçoit une fonction).
use crate::cache::{cle_set, CleSet};
use crate::collation;
use crate::js::{self, ch, objet, prop};
use ariane_js::Echec;
use ariane_vba::Valeur;
use core::cmp::Ordering;
use std::collections::{HashMap, HashSet};

fn hd<T>(m: &str) -> Result<T, Echec> { Err(Echec::hors_domaine(m)) }
fn nul() -> Valeur { Valeur::Nul }
fn est(v: &Valeur, s: &str) -> bool { matches!(v, Valeur::Chaine(c) if c == s) }
/// `a ?? b ?? … ?? null`.
fn ou<'a>(l: &[&'a Valeur]) -> &'a Valeur {
    static NUL: Valeur = Valeur::Nul;
    l.iter().copied().find(|v| !js::est_nul(v)).unwrap_or(&NUL)
}
/// `x?.a?.b…`.
fn chemin<'a>(v: &'a Valeur, c: &[&str]) -> &'a Valeur { c.iter().fold(v, |x, k| prop(x, k)) }
fn clone(v: &Valeur) -> Valeur { js::cloner_ou_nul(v) }
fn eq(a: &Valeur, b: &Valeur) -> Result<bool, Echec> { js::strict_egal(a, b) }

const IDENTITE: [&str; 5] = ["pageId", "part", "cut", "shape", "frameId"];
const DEFER_PHASES: [&str; 5] = ["defer-intent", "defer-command-possible", "defer-navigation-observation", "defer-navigation-accepted", "defer-finalized"];
const DEFER_OUTCOMES: [&str; 11] = ["defer-navigation-uncertain", "defer-navigation-not-emitted", "defer-navigation-not-dispatched",
    "defer-navigation-uncertain-on-restart", "defer-intent-not-emitted-on-restart", "defer-intent-closed", "defer-intent-abandoned-before-emission",
    "defer-intent-orphaned", "defer-authorization-revoked", "defer-final-event-repaired-on-restart", "defer-finalized-without-durable-entry"];

fn same_complete_identity(a: &Valeur, b: &Valeur) -> Result<bool, Echec> {
    if !a.vrai() || !b.vrai() { return Ok(false); }
    for k in IDENTITE {
        if !js::possede(a, k) || !js::possede(b, k) || js::est_nul(prop(a, k)) || js::est_nul(prop(b, k)) || !eq(prop(a, k), prop(b, k))? { return Ok(false); }
    }
    Ok(true)
}
fn proposal_id_of(e: &Valeur) -> &Valeur { ou(&[prop(e, "proposalId"), chemin(e, &["proposal", "id"]), chemin(e, &["paused", "proposal", "id"])]) }
fn batch_id_of(e: &Valeur) -> &Valeur { ou(&[prop(e, "batchId"), chemin(e, &["batch", "id"]), chemin(e, &["paused", "batchId"])]) }

/// `new Set(valeurs)` : valeurs distinctes dans l'ordre d'insertion.
fn ensemble<'a>(l: impl IntoIterator<Item = &'a Valeur>) -> Result<Vec<&'a Valeur>, Echec> {
    let mut vus: HashSet<CleSet> = HashSet::new();
    let mut out = vec![];
    for v in l { if vus.insert(cle_set(v)?) { out.push(v); } }
    Ok(out)
}

/// Index des événements, bâti une fois : `proposalIdOf` et `batchIdOf` de chacun, et les rangs par valeur (ordre du
/// journal). Remplace les balayages complets du JS par observation, sans en changer le résultat : `x === v` pour une
/// primitive `v` qui n'est pas NaN équivaut à `SameValueZero(x, v)`.
struct Index<'a> {
    events: &'a [Valeur],
    pid: Vec<&'a Valeur>,
    bid: Vec<&'a Valeur>,
    rangs_prop: HashMap<CleSet, Vec<usize>>,
    rangs_lot: HashMap<CleSet, Vec<usize>>,
}
impl<'a> Index<'a> {
    fn new(events: &'a [Valeur]) -> Result<Self, Echec> {
        let (mut pid, mut bid, mut rangs_prop, mut rangs_lot) = (vec![], vec![], HashMap::<CleSet, Vec<usize>>::new(), HashMap::<CleSet, Vec<usize>>::new());
        for (i, e) in events.iter().enumerate() {
            let (p, b) = (proposal_id_of(e), batch_id_of(e));
            rangs_prop.entry(cle_set(p)?).or_default().push(i);
            rangs_lot.entry(cle_set(b)?).or_default().push(i);
            pid.push(p);
            bid.push(b);
        }
        Ok(Index { events, pid, bid, rangs_prop, rangs_lot })
    }
    /// Rangs des événements dont la valeur indexée est `=== v` (NaN n'est égal à rien).
    fn rangs<'m>(m: &'m HashMap<CleSet, Vec<usize>>, v: &Valeur) -> Result<&'m [usize], Echec> {
        if matches!(v, Valeur::Nombre(x) if x.is_nan()) { return Ok(&[]); }
        Ok(m.get(&cle_set(v)?).map_or(&[][..], Vec::as_slice))
    }
}

fn find_batch_id(ix: &Index, event: &Valeur, pid: &Valeur) -> Result<Valeur, Echec> {
    if prop(event, "batchId").vrai() { return Ok(prop(event, "batchId").clone()); }
    let mut l = vec![];
    if pid.vrai() { for &i in Index::rangs(&ix.rangs_prop, pid)? { let b = ix.bid[i]; if b.vrai() { l.push(b); } } }
    let ids = ensemble(l)?;
    Ok(if ids.len() == 1 { ids[0].clone() } else { nul() })
}

fn find_capture(ix: &Index, index: usize, pid: &Valeur) -> Result<(Valeur, &'static str), Echec> {
    let events = ix.events;
    let event = &events[index];
    if prop(event, "lidarCaptureId").vrai() { return Ok((prop(event, "lidarCaptureId").clone(), "persisted-on-observation")); }
    let mut exact = vec![];
    if pid.vrai() {
        for &i in Index::rangs(&ix.rangs_prop, pid)? { let e = &events[i]; let c = ou(&[prop(e, "lidarCaptureId"), chemin(e, &["paused", "lidarCaptureId"])]); if c.vrai() { exact.push(c); } }
    }
    if ensemble(exact.iter().copied())?.len() == 1 { return Ok((exact[0].clone(), "proposal-id")); }
    for c in events[..index].iter().rev() {
        let t = prop(c, "type");
        if est(t, "gcv1-shadow-observed") || est(t, "batch-started") { break; }
        if est(t, "before-captured") && prop(c, "lidarId").vrai() && same_complete_identity(prop(c, "identity"), prop(event, "identity"))? {
            return Ok((prop(c, "lidarId").clone(), "preceding-before-captured-same-identity"));
        }
    }
    Ok((nul(), "unavailable"))
}

fn linked_events<'a>(ix: &Index<'a>, pid: &Valeur, batch: &Valeur, identite: &Valeur) -> Result<Vec<&'a Valeur>, Echec> {
    let events = ix.events;
    let du_lot: &[usize] = if batch.vrai() { Index::rangs(&ix.rangs_lot, batch)? } else { &[] };
    let mut sc = vec![];
    for &i in du_lot { if same_complete_identity(prop(&events[i], "identity"), identite)? { let p = ix.pid[i]; if p.vrai() { sc.push(p); } } }
    let sc = ensemble(sc)?;
    let fallback = sc.len() <= 1 && (sc.is_empty() || (pid.vrai() && { let k = cle_set(pid)?; sc.iter().map(|v| cle_set(v)).collect::<Result<Vec<_>, _>>()?.contains(&k) }));
    let ombre = |i: usize| est(prop(&events[i], "type"), "gcv1-shadow-observed");
    let mut rangs: Vec<usize> = vec![];
    if pid.vrai() { rangs.extend(Index::rangs(&ix.rangs_prop, pid)?.iter().copied().filter(|&i| !ombre(i))); }
    if fallback {
        for &i in du_lot { if !ombre(i) && !ix.pid[i].vrai() && same_complete_identity(prop(&events[i], "identity"), identite)? { rangs.push(i); } }
    }
    rangs.sort_unstable();
    Ok(rangs.into_iter().map(|i| &events[i]).collect())
}

/// `String(x ?? '')` pour le tri des réémissions.
fn texte_tri(v: &Valeur) -> Result<String, Echec> { if js::est_nul(v) { Ok(String::new()) } else { js::en_chaine(v) } }

/// Trie (stable) des événements par `(timestamp, eventId)` au sens de `localeCompare`.
fn trier(l: &mut [Valeur]) -> Result<(), Echec> {
    let mut cles = Vec::with_capacity(l.len());
    for e in l.iter() {
        let (a, b) = (texte_tri(prop(e, "timestamp"))?, texte_tri(prop(e, "eventId"))?);
        if !collation::porte(&a) || !collation::porte(&b) { return hd("localeCompare hors de l'ASCII imprimable"); }
        cles.push((a, b));
    }
    let mut idx: Vec<usize> = (0..l.len()).collect();
    idx.sort_by(|&i, &j| {
        let (a, b) = (&cles[i], &cles[j]);
        collation::comparer(&a.0, &b.0).unwrap_or(Ordering::Equal).then_with(|| collation::comparer(&a.1, &b.1).unwrap_or(Ordering::Equal))
    });
    let copie: Vec<Valeur> = idx.iter().map(|&i| l[i].clone()).collect();
    l.clone_from_slice(&copie);
    Ok(())
}

fn pick(evs: &[&Valeur], t: &str) -> Result<Valeur, Echec> {
    let mut l: Vec<Valeur> = evs.iter().filter(|e| est(prop(e, "type"), t)).map(|e| (*e).clone()).collect();
    if l.is_empty() { return Ok(nul()); }
    if l.len() > 1 { trier(&mut l)?; }
    Ok(clone(&l[l.len() - 1]))
}

fn tab_ch(l: &[String]) -> Valeur { js::tab(l.iter().map(|s| ch(s)).collect()) }

fn deferral_result(linked: &[&Valeur], obs_batch: &Valeur, state: &Valeur) -> Result<Valeur, Echec> {
    let mut groupes: Vec<(String, Vec<&Valeur>)> = vec![];
    let mut legacy = 0usize;
    for e in linked {
        let t = prop(e, "type");
        if !(DEFER_PHASES.iter().chain(DEFER_OUTCOMES.iter()).any(|d| est(t, d))) { continue; }
        let b = ou(&[prop(e, "batchId")]);
        if b.vrai() && obs_batch.vrai() && !eq(b, obs_batch)? { continue; }
        match prop(e, "operationId") {
            Valeur::Chaine(id) if !id.is_empty() => match groupes.iter_mut().find(|(k, _)| k == id) { Some(g) => g.1.push(e), None => groupes.push((id.clone(), vec![e])) },
            _ => legacy += 1,
        }
    }
    if groupes.is_empty() && legacy == 0 { return Ok(nul()); }
    let mut ids: Vec<String> = groupes.iter().map(|(k, _)| k.clone()).collect();
    ids.sort_by(|a, b| js::cmp_utf16(a, b));
    let base = |c: &mut Vec<(&str, Valeur)>| { c.push(("operationIds", tab_ch(&ids))); c.push(("legacyEventsWithoutOperationId", Valeur::Nombre(legacy as f64))); };
    let groupe = |id: &str| groupes.iter().find(|(k, _)| k == id).map(|(_, v)| v.clone()).unwrap_or_default();
    let ambigu = |raison: &str, fin: Option<&[String]>| {
        let mut c = vec![("reason", ch(raison))];
        if let Some(f) = fin { c.push(("finalizedOperationIds", tab_ch(f))); }
        base(&mut c);
        objet(c)
    };
    // (operationId, événements, selectedBy, ambiguity)
    let (op, evs, par, amb): (Option<String>, Vec<&Valeur>, Option<&str>, Valeur) = if ids.is_empty() {
        (None, vec![], None, if legacy > 0 { ambigu("DEFER_EVENTS_WITHOUT_OPERATION_ID", None) } else { nul() })
    } else {
        let fin: Vec<String> = ids.iter().filter(|id| groupe(id).iter().any(|e| est(prop(e, "type"), "defer-finalized"))).cloned().collect();
        let actif = match chemin(state, &["deferIntent", "operationId"]) { Valeur::Chaine(s) => Some(s.clone()), _ => None };
        if fin.len() == 1 { (Some(fin[0].clone()), groupe(&fin[0]), Some("durable-finalization"), nul()) } else if fin.len() > 1 {
            let mut f = fin.clone();
            f.sort_by(|a, b| js::cmp_utf16(a, b));
            (None, vec![], None, ambigu("MULTIPLE_FINALIZED_OPERATIONS", Some(&f)))
        } else if let Some(a) = actif.filter(|a| !a.is_empty() && ids.contains(a)) {
            let g = groupe(&a);
            (Some(a), g, Some("persisted-active-intent"), nul())
        } else if ids.len() == 1 { (Some(ids[0].clone()), groupe(&ids[0]), Some("single-operation"), nul()) } else {
            (None, vec![], None, ambigu("MULTIPLE_OPERATIONS_NO_DURABLE_SELECTOR", None))
        }
    };
    let types = ensemble(evs.iter().map(|e| prop(e, "type")))?.len();
    let par_v = par.map_or(nul(), ch);
    let common = |c: &mut Vec<(&str, Valeur)>| {
        c.push(("operationIds", tab_ch(&ids)));
        c.push(("selectedBy", par_v.clone()));
        c.push(("legacyEventsWithoutOperationId", Valeur::Nombre(legacy as f64)));
        c.push(("duplicateEventsInOperation", Valeur::Nombre(evs.len() as f64 - types as f64)));
    };
    let Some(op) = op else {
        let mut c = vec![("status", ch("DEFER_AMBIGUOUS")), ("confirmed", Valeur::Booleen(false)), ("operationId", nul()), ("policy", nul()), ("identity", nul()),
            ("nextIdentity", nul()), ("transition", nul()), ("proposalId", nul()), ("lidarCaptureId", nul()), ("lidarCaptureStatus", ch("not-available")),
            ("recordId", nul()), ("railsAtDeferral", nul()), ("unresolvedRails", nul()), ("motif", nul()), ("navigationWithoutDecision", nul()),
            ("uncertainty", nul()), ("ambiguity", amb)];
        common(&mut c);
        return Ok(objet(c));
    };
    let intent = pick(&evs, "defer-intent")?;
    let obs = pick(&evs, "defer-navigation-observation")?;
    let acc = pick(&evs, "defer-navigation-accepted")?;
    let fin = pick(&evs, "defer-finalized")?;
    let mut issues = vec![];
    for t in DEFER_OUTCOMES { let p = pick(&evs, t)?; if p.vrai() { issues.push(p); } }
    if issues.len() > 1 { trier(&mut issues)?; }
    let outcome = issues.pop().unwrap_or(Valeur::Nul);
    let ev_fin = prop(&fin, "evidence");
    let evidence = if ev_fin.vrai() { ev_fin } else if prop(&acc, "evidence").vrai() { prop(&acc, "evidence") } else if prop(&obs, "evidence").vrai() { prop(&obs, "evidence") } else { &Valeur::Nul };
    let evidence = evidence.clone();
    let lid = ou(&[prop(&fin, "lidarCaptureId"), prop(&intent, "lidarCaptureId")]);
    let pol = prop(&intent, "policy");
    let fv = fin.vrai();
    let nav = objet(vec![
        ("commandInvoked", ou(&[prop(&fin, "commandInvoked"), prop(&obs, "commandInvoked")]).clone()),
        ("navigationObserved", { let n = prop(&obs, "navigationObserved"); if js::est_nul(n) { if fv { Valeur::Booleen(true) } else { nul() } } else { n.clone() } }),
        ("commandScope", ch("banane-operation-only")), ("bananeValidated", Valeur::Booleen(false)), ("applyCommandSent", Valeur::Booleen(false)),
        ("validationCommandSent", Valeur::Booleen(false)), ("skipCommandSent", Valeur::Booleen(false)),
        ("shortcutEquivalence", clone(ou(&[prop(&evidence, "shortcutEquivalence")]))), ("correlation", clone(ou(&[prop(&evidence, "correlation")]))), ("evidence", clone(&evidence))]);
    let incertitude = if fv { nul() } else { clone(if outcome.vrai() { &outcome } else if obs.vrai() { &obs } else { &Valeur::Nul }) };
    let mut c = vec![
        ("status", ch(if fv { "DEFERRED_UNRESOLVED" } else { "DEFER_NOT_CONFIRMED" })), ("confirmed", Valeur::Booleen(fv)), ("operationId", Valeur::Chaine(op)),
        ("policy", if js::est_nul(pol) { ch("defer") } else { pol.clone() }),
        ("identity", clone(ou(&[prop(&fin, "identity"), prop(&intent, "identity")]))),
        ("nextIdentity", clone(ou(&[prop(&fin, "nextIdentity"), prop(&acc, "nextIdentity")]))),
        ("transition", ou(&[prop(&fin, "transition"), prop(&acc, "transition"), prop(&obs, "transition")]).clone()),
        ("proposalId", ou(&[prop(&fin, "proposalId"), prop(&intent, "proposalId")]).clone()),
        ("lidarCaptureId", lid.clone()),
        ("lidarCaptureStatus", ch(if lid.vrai() { "persisted-on-intent" } else { "not-available" })),
        ("recordId", ou(&[prop(&fin, "recordId")]).clone()),
        ("railsAtDeferral", clone(ou(&[prop(&fin, "rails"), prop(&intent, "rails")]))),
        ("unresolvedRails", clone(ou(&[prop(&fin, "unresolvedRails"), prop(&intent, "unresolvedRails")]))),
        ("motif", ou(&[prop(&intent, "eligibility")]).clone()),
        ("navigationWithoutDecision", nav), ("uncertainty", incertitude), ("ambiguity", amb)];
    common(&mut c);
    Ok(objet(c))
}

const INTERRUPTIONS: [&str; 4] = ["batch-error", "batch-after-state-missing", "batch-action-interrupted", "batch-validation-not-accepted-on-restart"];

fn runtime_result(ix: &Index, pid: &Valeur, batch: &Valeur, identite: &Valeur, shadow: &Valeur, state: &Valeur) -> Result<Valeur, Echec> {
    let linked = linked_events(ix, pid, batch, identite)?;
    let last = |t: &str| linked.iter().rev().find(|e| est(prop(e, "type"), t)).map_or(nul(), |e| clone(e));
    let apply = last("applied-verified");
    let vi = last("validation-intent");
    let vo = last("validation-observation");
    let va = last("validation-accepted");
    let pause = last("batch-paused-unresolved-rail");
    let interruption = linked.iter().rev().find(|e| INTERRUPTIONS.iter().any(|t| est(prop(e, "type"), t))).map_or(nul(), |e| clone(e));
    let evidence = if prop(&va, "evidence").vrai() { prop(&va, "evidence").clone() } else if prop(&vo, "evidence").vrai() { prop(&vo, "evidence").clone() } else { nul() };
    let rails = chemin(shadow, &["rails"]);
    let entrees: Vec<(String, Valeur)> = match rails {
        Valeur::Objet(t) => t.clone(),
        Valeur::Tableau(t) => t.iter().enumerate().filter_map(|(i, x)| x.as_ref().map(|x| (i.to_string(), x.clone()))).collect(),
        _ => vec![],
    };
    let mut unresolved = vec![];
    for (side, rail) in &entrees {
        let next = prop(rail, "next");
        if next.vrai() && !est(prop(next, "status"), "candidate") {
            unresolved.push(objet(vec![("side", ch(side)), ("status", prop(next, "status").clone()), ("motif", ou(&[prop(next, "motif")]).clone()),
                ("reason", ou(&[prop(next, "reason"), prop(rail, "reason")]).clone())]));
        }
    }
    let deferral = deferral_result(&linked, batch, state)?;
    let abstention = if pause.vrai() {
        let s = chemin(&pause, &["paused", "status"]);
        objet(vec![("status", if s.vrai() { s.clone() } else { ch("PAUSED_UNRESOLVED_RAIL") }), ("event", clone(&pause))])
    } else if !unresolved.is_empty() { objet(vec![("status", ch("GCV1_UNRESOLVED")), ("rails", js::tab(unresolved))]) } else { nul() };
    let vu = |k: &str| prop(&vo, k);
    Ok(objet(vec![
        ("association", ch(if linked.is_empty() { "none" } else { "proposal-or-batch-id" })),
        ("apply", apply.clone()), ("validationIntent", vi), ("validationObservation", vo.clone()), ("validationAccepted", va.clone()), ("deferral", deferral),
        ("afterObserved", ou(&[prop(&evidence, "afterObserved"), vu("afterObserved"), prop(&apply, "afterObserved")]).clone()),
        ("serverConfirmed", ou(&[prop(&evidence, "serverConfirmed"), vu("serverConfirmed")]).clone()),
        ("navigationObserved", ou(&[prop(&evidence, "navigationObserved"), vu("navigationObserved")]).clone()),
        ("nextIdentity", clone(ou(&[prop(&va, "nextIdentity"), prop(&evidence, "nextIdentity")]))),
        ("transition", ou(&[prop(&va, "transition"), vu("expectedTransition"), prop(&evidence, "expectedTransition")]).clone()),
        ("interruption", interruption), ("abstention", abstention)]))
}

fn rail_view(side: &str, scientific: &Valeur, proposal: &Valeur) -> Valeur {
    let r0 = chemin(proposal, &["rails", side]);
    let runtime = if r0.vrai() { r0 } else { &Valeur::Nul };
    let n0 = prop(scientific, "next");
    let next = if n0.vrai() { n0 } else { &Valeur::Nul };
    let src = prop(runtime, "source");
    let status = { let s = ou(&[prop(runtime, "status"), prop(next, "status")]); if js::est_nul(s) { if prop(scientific, "error").vrai() { ch("error") } else { nul() } } else { s.clone() } };
    let branch = if est(src, "geometry-candidate-v1-s1") { ch("S1") } else if est(src, "geometry-candidate-v1-astar") { ch("A_STAR") }
        else if est(prop(runtime, "status"), "unresolved") || (next.vrai() && !est(prop(next, "status"), "candidate")) { ch("ABSTENTION") } else { nul() };
    objet(vec![("status", status), ("source", ou(&[src]).clone()), ("delta", clone(ou(&[prop(runtime, "delta"), prop(next, "delta")]))),
        ("confidence", ou(&[prop(runtime, "confidence"), chemin(scientific, &["astar", "confidence"])]).clone()),
        ("confidenceStatus", ou(&[chemin(runtime, &["gcv1", "confidenceStatus"])]).clone()), ("branch", branch),
        ("scientificRail", clone(if scientific.vrai() { scientific } else { &Valeur::Nul }))])
}

/// 230 : `buildDiagnostic({version, sessionId, state, events, exportedAt})` ; la façade passe `exportedAt` (défaut du JS
/// calculé par elle).
///
/// # Errors
/// `HorsDomaine` : argument nul, `events` non tableau ou portant `null`, comparaisons d'objets, `localeCompare` hors ASCII.
pub fn build_diagnostic(e: &Valeur) -> Result<Valeur, Echec> {
    let a = prop(e, "args");
    let a = if matches!(a, Valeur::Indefini) { &Valeur::Objet(vec![]) as &Valeur } else { a };
    if js::est_nul(a) { return hd("argument nul (TypeError en JS)"); }
    let def = |k: &str, d: Valeur| if matches!(prop(a, k), Valeur::Indefini) { d } else { prop(a, k).clone() };
    let version = def("version", nul());
    let session_id = def("sessionId", nul());
    let state = def("state", nul());
    let exported_at = prop(e, "exportedAt").clone();
    let ev = prop(a, "events");
    let source: Vec<Valeur> = match ev {
        Valeur::Indefini => vec![],
        x if js::est_tableau(x) => js::elements(&js::cloner(x)).unwrap_or_default(),
        _ => return hd("events non tableau"),
    };
    if source.iter().any(js::est_nul) { return hd("événement nul (TypeError en JS)"); }
    let ix = Index::new(&source)?;
    let mut observations = vec![];
    for (index, event) in source.iter().enumerate() {
        if !est(prop(event, "type"), "gcv1-shadow-observed") { continue; }
        let sh = prop(event, "shadow");
        let vide = Valeur::Objet(vec![]);
        let shadow = if sh.vrai() { sh } else { &vide };
        let pid = ou(&[prop(event, "proposalId")]);
        let batch = find_batch_id(&ix, event, pid)?;
        let (cap, assoc) = find_capture(&ix, index, pid)?;
        let mut proposed = &Valeur::Nul;
        for &i in Index::rangs(&ix.rangs_prop, pid)?.iter().rev() { if est(prop(&source[i], "type"), "proposed") { proposed = prop(&source[i], "proposal"); break; } }
        let proposed = if proposed.vrai() { proposed } else { &Valeur::Nul };
        let identite = clone(ou(&[prop(event, "identity"), prop(proposed, "identity")]));
        let rails_sci = prop(shadow, "rails");
        let runtime = runtime_result(&ix, pid, &batch, &identite, shadow, &state)?;
        observations.push(objet(vec![
            ("observationEventId", ou(&[prop(event, "eventId")]).clone()), ("identity", identite),
            ("timestamp", ou(&[prop(shadow, "observedAt"), prop(event, "timestamp")]).clone()),
            ("sessionId", ou(&[prop(event, "sessionId")]).clone()),
            ("sessionScope", ch(if prop(event, "sessionId").vrai() { "persisted" } else { "legacy-unscoped" })),
            ("batchId", batch), ("proposalId", pid.clone()),
            ("lidar", objet(vec![("captureId", cap), ("association", ch(assoc))])),
            ("format", ou(&[prop(shadow, "format")]).clone()), ("contract", clone(ou(&[prop(shadow, "contract")]))), ("selection", clone(ou(&[prop(shadow, "selection")]))),
            ("runtimeDecisionUntouched", ou(&[prop(shadow, "runtimeDecisionUntouched")]).clone()), ("commandsByShadow", ou(&[prop(shadow, "commandsByShadow")]).clone()),
            ("error", ou(&[prop(shadow, "error")]).clone()),
            ("rails", objet(vec![("left", rail_view("left", prop(rails_sci, "left"), proposed)), ("right", rail_view("right", prop(rails_sci, "right"), proposed))])),
            ("summary", clone(ou(&[prop(shadow, "summary")]))), ("comparison", clone(ou(&[prop(shadow, "comparison")]))),
            ("lotObservation", clone(ou(&[prop(event, "lotObservation")]))), ("runtime", runtime)]));
    }
    let sid = ou(&[&session_id, prop(&state, "sessionId")]).clone();
    Ok(objet(vec![("format", ch("banane-gcv1-diagnostic-v1")), ("version", version), ("exportedAt", exported_at), ("scope", ch("current-engine-session")),
        ("sessionId", sid), ("observationCount", Valeur::Nombre(observations.len() as f64)), ("observations", js::tab(observations))]))
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn diagnostic_minimal() {
        let ident = objet(vec![("pageId", ch("p")), ("part", Valeur::Nombre(1.0)), ("cut", Valeur::Nombre(2.0)), ("shape", ch("s")), ("frameId", ch("f"))]);
        let evs = js::tab(vec![
            objet(vec![("type", ch("before-captured")), ("lidarId", ch("L")), ("identity", ident.clone())]),
            objet(vec![("type", ch("proposed")), ("proposalId", ch("P")), ("batchId", ch("B")), ("proposal", objet(vec![("identity", ident.clone())]))]),
            objet(vec![("type", ch("defer-intent")), ("proposalId", ch("P")), ("operationId", ch("O")), ("timestamp", ch("2"))]),
            objet(vec![("type", ch("defer-intent")), ("proposalId", ch("P")), ("operationId", ch("O")), ("timestamp", ch("1")), ("policy", ch("x"))]),
            objet(vec![("type", ch("gcv1-shadow-observed")), ("proposalId", ch("P")), ("identity", ident), ("shadow", objet(vec![("rails", objet(vec![("left", objet(vec![("next", objet(vec![("status", ch("unresolved"))]))]))]))]))]),
        ]);
        let r = build_diagnostic(&objet(vec![("args", objet(vec![("events", evs)])), ("exportedAt", ch("T"))])).unwrap();
        let o = &js::elements(prop(&r, "observations")).unwrap()[0];
        assert_eq!(prop(o, "batchId"), &ch("B"));
        assert_eq!(prop(prop(o, "lidar"), "association"), &ch("preceding-before-captured-same-identity"));
        let d = prop(prop(o, "runtime"), "deferral");
        assert_eq!(prop(d, "selectedBy"), &ch("single-operation"));
        assert_eq!(prop(d, "duplicateEventsInOperation"), &Valeur::Nombre(1.0));
        assert_eq!(prop(d, "policy"), &ch("defer")); // le plus récent (timestamp « 2 ») n'a pas de politique
        assert_eq!(prop(prop(prop(o, "runtime"), "abstention"), "status"), &ch("GCV1_UNRESOLVED"));
        assert!(build_diagnostic(&objet(vec![("args", Valeur::Nul)])).is_err());
    }
}
