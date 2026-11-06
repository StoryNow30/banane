//! `src/part-summary-49.js` (résumé de partie), entier : `projectEvent`, `summarize`, `fromJournal`, `contextOf`,
//! `deferKind`. Même ordre des opérations que le JS ; un événement est tenu sous sa forme projetée, typée.
//! Un événement DÉJÀ projeté reçu en entrée doit avoir la forme exacte que `projectEvent` produit (types, clés) :
//! sinon hors domaine, et la façade rejoue le JS.
use crate::js::{self, ch, chemin, cmp_utf16, entier, est, hd, locale_compare, s, s_ou_nul, tab, Carte, Obj};
use ariane_js::{cle_same_value_zero, Echec};
use ariane_vba::Valeur;
use core::cmp::Ordering;

const FORMAT: &str = "ariane-resume-partie-1";
const SIDES: [&str; 2] = ["left", "right"];
const OPEN: [&str; 7] = ["RUNNING", "PAUSED", "PAUSED_UNRESOLVED_RAIL", "PAUSED_DEFER_NAVIGATION_UNCERTAIN", "PAUSED_AFTER_STATE_MISSING",
    "PAUSED_ADAPTER_UNRESPONSIVE", "MANUAL_TAKEOVER"];
const TYPES: [&str; 9] = ["batch-started", "batch-state", "batch-rebased-after-reload", "before-captured", "gcv1-shadow-observed",
    "validation-accepted", "defer-finalized", "batch-manual-completion", "explicit-skip-observation"];

fn decisive(st: &str) -> u8 { match st { "posed" => 4, "deferred" => 3, "manual" => 2, "skipped" => 1, _ => 0 } }

/// `present(v)` : ni null, ni undefined, ni '', ni 'not-observed'.
pub(crate) fn present(v: &Valeur) -> bool {
    !matches!(v, Valeur::Indefini | Valeur::Nul) && !est(v, "") && !est(v, "not-observed")
}
/// `text(v)`.
pub(crate) fn text(v: &Valeur) -> Result<Option<String>, Echec> { if present(v) { js::en_chaine(v).map(Some) } else { Ok(None) } }
/// `time(v)`.
fn time(v: &Valeur) -> Option<String> { js::chaine(v).filter(|x| !x.is_empty()).map(str::to_owned) }

/// Identité normalisée.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Ident {
    pub(crate) project_id: Option<String>,
    pub(crate) page_id: Option<String>,
    pub(crate) frame_id: Option<String>,
    pub(crate) shape: Option<String>,
    pub(crate) part: Option<f64>,
    pub(crate) cut: Option<f64>,
}
impl Ident {
    fn valeur(&self) -> Valeur {
        Obj::new().et("projectId", s_ou_nul(self.project_id.as_deref())).et("pageId", s_ou_nul(self.page_id.as_deref()))
            .et("frameId", s_ou_nul(self.frame_id.as_deref())).et("shape", s_ou_nul(self.shape.as_deref()))
            .et("part", js::n_ou_nul(self.part)).et("cut", js::n_ou_nul(self.cut)).v()
    }
}

/// `identity(x)` sur une valeur brute.
fn identity(x: &Valeur) -> Result<Option<Ident>, Echec> {
    if !x.vrai() || !matches!(x, Valeur::Objet(_) | Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Bloc { .. }) { return Ok(None); }
    identity_de(|k| ch(x, k).clone())
}
/// `identity` sur un objet dont les champs sont donnés par `f`.
fn identity_de(f: impl Fn(&str) -> Valeur) -> Result<Option<Ident>, Echec> {
    let project_id = match text(&f("projectId"))? { Some(p) => Some(p), None => text(&f("project"))? };
    Ok(Some(Ident { project_id, page_id: text(&f("pageId"))?, frame_id: text(&f("frameId"))?, shape: text(&f("shape"))?,
        part: entier(&f("part")), cut: entier(&f("cut")) }))
}

/// Identité DÉJÀ normalisée (événement projeté reçu en entrée) : forme exacte de `identity`, sinon hors domaine.
fn identity_projetee(x: &Valeur) -> Result<Option<Ident>, Echec> {
    match x {
        Valeur::Nul => Ok(None),
        Valeur::Objet(_) => {
            let t = |k: &str| -> Result<Option<String>, Echec> {
                match ch(x, k) { Valeur::Nul => Ok(None), Valeur::Chaine(c) if !c.is_empty() => Ok(Some(c.clone())), _ => hd("identité projetée : champ texte") }
            };
            let n = |k: &str| -> Result<Option<f64>, Echec> {
                match ch(x, k) { Valeur::Nul => Ok(None), v => entier(v).map(Some).ok_or_else(|| Echec::hors_domaine("identité projetée : entier")) }
            };
            Ok(Some(Ident { project_id: t("projectId")?, page_id: t("pageId")?, frame_id: t("frameId")?, shape: t("shape")?, part: n("part")?, cut: n("cut")? }))
        }
        _ => hd("identité projetée : forme"),
    }
}

/// `identityOfEntry(p)`.
fn identity_of_entry(p: &Valeur) -> Result<Option<Ident>, Echec> {
    let i = ch(p, "identity");
    if i.vrai() { return identity(i); }
    let Valeur::Chaine(cle) = ch(p, "key") else { return Ok(None) };
    let f: Vec<&str> = cle.split('|').collect();
    let n = |i: usize| -> Valeur {
        match f.get(i) { Some(v) if !v.is_empty() && v.bytes().all(|c| c.is_ascii_digit()) => Valeur::Nombre(v.parse::<f64>().unwrap_or(f64::NAN)), _ => Valeur::Nul }
    };
    let c = |i: usize| -> Valeur { f.get(i).map_or(Valeur::Indefini, |x| s(x)) };
    identity_de(|k| match k { "pageId" => c(0), "part" => n(1), "cut" => n(2), "shape" => c(3), "frameId" => c(4), "projectId" => c(5), _ => Valeur::Indefini })
}

/// `contextOf(i)` : clé de contexte (forme JSON de V8), ou None.
pub(crate) fn context_of(i: Option<&Ident>) -> Option<String> {
    let i = i?;
    let part = i.part?;
    let p = ariane_js::nombre::nombre_en_chaine(if part == 0.0 { 0.0 } else { part });
    let q = |x: &str| js::json(&s(x)).unwrap_or_default();
    if let Some(pr) = &i.project_id { return Some(format!("[\"projet\",{},{p}]", q(pr))); }
    match (&i.page_id, &i.frame_id, &i.shape) {
        (Some(a), Some(b), Some(c)) => Some(format!("[\"page\",{},{},{},{p}]", q(a), q(b), q(c))),
        _ => None,
    }
}

/// `motifsOf(rails)`.
fn motifs_of(rails: &Valeur) -> Result<Vec<String>, Echec> {
    let mut out = vec![];
    for side in SIDES {
        let r = ch(rails, side);
        let m = chemin(r, &["gcv1", "motif"]);
        let m = if js::nul(m) { chemin(r, &["next", "motif"]) } else { m };
        if present(m) { out.push(js::en_chaine(m)?); }
    }
    Ok(out)
}

/// `deferKind(motifs, gauge)` sur des motifs déjà lus.
fn defer_kind(motifs: &[String], gauge: bool) -> &'static str {
    if motifs.iter().any(|m| m == "input") { return "noInput"; }
    if gauge || motifs.iter().any(|m| m == "gauge-out-of-contract") { return "gaugeRejected"; }
    if motifs.is_empty() { "unclassifiedDeferred" } else { "engineDeferred" }
}

/// Événement projeté.
#[derive(Debug, Clone)]
#[allow(clippy::struct_excessive_bools)] // un booléen par champ de la projection JS
struct Ev {
    event_id: Option<String>,
    typ: String,
    timestamp: Option<String>,
    session_id: Option<String>,
    batch_id: Option<String>,
    identity: Option<Ident>,
    started_at: Option<String>,
    state: Option<String>,
    from: Option<Ident>,
    gauge: bool,
    motifs: Option<Vec<String>>,
    posed: bool,
    confirmed: bool,
    command_sent: bool,
    /// Champs propres au type, présents (pour rendre la projection telle quelle).
    projete: bool,
}

/// `projectEvent(e)` : None si l'événement n'est pas retenu.
fn project_event(e: &Valeur) -> Result<Option<Ev>, Echec> {
    if !e.vrai() || !matches!(e, Valeur::Objet(_) | Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Bloc { .. }) { return Ok(None); }
    if est(ch(e, "projection"), FORMAT) { return projete(e).map(Some); }
    let Valeur::Chaine(typ) = ch(e, "type") else { return Ok(None) };
    if !TYPES.contains(&typ.as_str()) || present(ch(e, "nativeSessionId")) || present(ch(e, "manualSessionId")) { return Ok(None); }
    let timestamp = time(ch(e, "timestamp"));
    let mut p = Ev { event_id: text(ch(e, "eventId"))?, typ: typ.clone(), timestamp: timestamp.clone(), session_id: text(ch(e, "sessionId"))?,
        batch_id: text(ch(e, "batchId"))?, identity: identity(ch(e, "identity"))?, started_at: None, state: None, from: None, gauge: false,
        motifs: None, posed: false, confirmed: false, command_sent: false, projete: false };
    match typ.as_str() {
        "batch-started" => {
            if let Some(b) = text(chemin(e, &["batch", "id"]))? { p.batch_id = Some(b); }
            p.started_at = time(chemin(e, &["batch", "startedAt"])).or(timestamp);
        }
        "batch-state" => { p.state = match text(ch(e, "state"))? { Some(x) => Some(x), None => text(chemin(e, &["batch", "state"]))? }; }
        "batch-rebased-after-reload" => {
            // `{...e.identity, pageId, frameId}` : l'étalement d'une chaîne ou d'un tableau ne copie que des indices,
            // jamais lus par identity ; `ch` rend `undefined` sur ces formes, comme la lecture sur l'objet étalé.
            let base = ch(e, "identity");
            let (dp, df) = (ch(e, "dePageId").clone(), ch(e, "deFrameId").clone());
            p.from = identity_de(|k| match k { "pageId" => dp.clone(), "frameId" => df.clone(), _ => ch(base, k).clone() })?;
        }
        "gcv1-shadow-observed" => {
            p.gauge = matches!(chemin(e, &["shadow", "summary", "pairGaugeRejected"]), Valeur::Booleen(true));
            p.motifs = Some(motifs_of(chemin(e, &["shadow", "rails"]))?);
        }
        "validation-accepted" => p.posed = est(ch(e, "action"), "VALIDATE"),
        "defer-finalized" => { p.confirmed = matches!(ch(e, "deferredConfirmed"), Valeur::Booleen(true)); p.motifs = Some(motifs_of(ch(e, "rails"))?); }
        "explicit-skip-observation" => p.command_sent = matches!(ch(e, "commandSent"), Valeur::Booleen(true)),
        _ => {}
    }
    Ok(Some(p))
}

/// Un événement déjà projeté, relu : la forme de `projectEvent` est exigée.
fn projete(e: &Valeur) -> Result<Ev, Echec> {
    let Valeur::Objet(t) = e else { return hd("projection : forme") };
    let a = |k: &str| t.iter().any(|(c, _)| c == k);
    for k in ["eventId", "type", "timestamp", "sessionId", "batchId", "identity"] { if !a(k) { return hd("projection : clé absente"); } }
    let txt = |k: &str| -> Result<Option<String>, Echec> {
        match ch(e, k) { Valeur::Nul => Ok(None), Valeur::Chaine(c) if !c.is_empty() => Ok(Some(c.clone())), _ => hd("projection : champ texte") }
    };
    let Valeur::Chaine(typ) = ch(e, "type") else { return hd("projection : type") };
    let mut p = Ev { event_id: txt("eventId")?, typ: typ.clone(), timestamp: txt("timestamp")?, session_id: txt("sessionId")?, batch_id: txt("batchId")?,
        identity: identity_projetee(ch(e, "identity"))?, started_at: None, state: None, from: None, gauge: false, motifs: None, posed: false,
        confirmed: false, command_sent: false, projete: true };
    let exige = |k: &str| if a(k) { Ok(()) } else { hd("projection : champ du type absent") };
    match typ.as_str() {
        "batch-started" => { exige("startedAt")?; p.started_at = txt("startedAt")?; }
        "batch-state" => { exige("state")?; p.state = txt("state")?; }
        "batch-rebased-after-reload" => { exige("from")?; p.from = identity_projetee(ch(e, "from"))?; }
        "gcv1-shadow-observed" => { p.gauge = matches!(ch(e, "gauge"), Valeur::Booleen(true)); }
        "validation-accepted" => p.posed = ch(e, "posed").vrai(),
        "defer-finalized" => {
            p.confirmed = ch(e, "confirmed").vrai();
            let m = ch(e, "motifs");
            p.motifs = if m.vrai() {
                let l = js::elements(m).ok_or_else(|| Echec::hors_domaine("projection : motifs"))?;
                Some(l.iter().map(|x| js::chaine(x).map(str::to_owned).ok_or_else(|| Echec::hors_domaine("projection : motif"))).collect::<Result<_, _>>()?)
            } else { None };
        }
        "explicit-skip-observation" => p.command_sent = ch(e, "commandSent").vrai(),
        _ => {}
    }
    Ok(p)
}

/// La projection rendue par `projectEvent` (pour l'appel direct).
fn ev_valeur(p: &Ev) -> Valeur {
    let mut o = Obj::new().et("projection", s(FORMAT)).et("eventId", s_ou_nul(p.event_id.as_deref())).et("type", s(&p.typ))
        .et("timestamp", s_ou_nul(p.timestamp.as_deref())).et("sessionId", s_ou_nul(p.session_id.as_deref()))
        .et("batchId", s_ou_nul(p.batch_id.as_deref())).et("identity", p.identity.as_ref().map_or(Valeur::Nul, Ident::valeur));
    let motifs = |m: &Option<Vec<String>>| js::tab_s(m.as_deref().unwrap_or(&[]));
    match p.typ.as_str() {
        "batch-started" => o.poser("startedAt", s_ou_nul(p.started_at.as_deref())),
        "batch-state" => o.poser("state", s_ou_nul(p.state.as_deref())),
        "batch-rebased-after-reload" => o.poser("from", p.from.as_ref().map_or(Valeur::Nul, Ident::valeur)),
        "gcv1-shadow-observed" => { o.poser("gauge", Valeur::Booleen(p.gauge)); o.poser("motifs", motifs(&p.motifs)); }
        "validation-accepted" => o.poser("posed", Valeur::Booleen(p.posed)),
        "defer-finalized" => { o.poser("confirmed", Valeur::Booleen(p.confirmed)); o.poser("motifs", motifs(&p.motifs)); }
        "explicit-skip-observation" => o.poser("commandSent", Valeur::Booleen(p.command_sent)),
        _ => {}
    }
    o.v()
}

/// `projectEvent(e)` (fonction 250) : un événement déjà projeté est rendu tel quel.
///
/// # Errors
/// Hors domaine (voir le module).
pub fn project_event_valeur(e: &Valeur) -> Result<Valeur, Echec> {
    match project_event(e)? {
        None => Ok(Valeur::Nul),
        Some(p) if p.projete => Ok(e.clone()),
        Some(p) => Ok(ev_valeur(&p)),
    }
}

fn chrono(a: &Ev, b: &Ev) -> Result<Ordering, Echec> {
    let o = locale_compare(a.timestamp.as_deref().unwrap_or(""), b.timestamp.as_deref().unwrap_or(""))?;
    if o != Ordering::Equal { return Ok(o); }
    locale_compare(a.event_id.as_deref().unwrap_or(""), b.event_id.as_deref().unwrap_or(""))
}

/// Tri stable par un comparateur faillible (`TimSort` de V8 : stable ; le comparateur est un préordre total, le résultat
/// est unique). Les chaînes sont vérifiées AVANT le tri par `verifier`.
fn trier<T>(v: &mut [T], f: impl Fn(&T, &T) -> Result<Ordering, Echec>) -> Result<(), Echec> {
    let mut err = None;
    v.sort_by(|a, b| match f(a, b) { Ok(o) => o, Err(e) => { err.get_or_insert(e); Ordering::Equal } });
    match err { Some(e) => Err(e), None => Ok(()) }
}

/// `readEvents(events)`.
fn read_events(events: &Valeur) -> Result<Vec<Ev>, Echec> {
    let mut seen = std::collections::HashSet::new();
    let mut out = vec![];
    if js::est_tableau(events) {
        for raw in js::elements(events).unwrap_or_default().iter() {
            let Some(e) = project_event(raw)? else { continue };
            if let Some(id) = &e.event_id { if !seen.insert(id.clone()) { continue; } }
            out.push(e);
        }
    }
    trier(&mut out, chrono)?;
    Ok(out)
}

/// Entrée durable d'un lot (listes du lot courant).
#[derive(Debug, Clone)]
struct Fait {
    status: &'static str,
    identity: Option<Ident>,
    at: Option<String>,
    motifs: Option<Vec<String>>,
    shadow: bool,
    gauge: bool,
}

#[derive(Debug, Clone)]
struct Lot {
    id: String,
    started_at: Option<String>,
    start_known: bool,
    start_identity: Option<Ident>,
    state: Option<String>,
    current: bool,
    excluded: bool,
    events: Vec<usize>,
    entries: Vec<Fait>,
}

/// `buildLots(all, session, cur)`.
fn build_lots(all: &[Ev], session: &str, cur: Option<&Valeur>) -> Result<Carte<String, Lot>, Echec> {
    let cur_id = match cur { Some(c) => Some(js::en_chaine(ch(c, "id"))?), None => None };
    let mut lots: Carte<String, Lot> = Carte::default();
    let lot_of = |lots: &mut Carte<String, Lot>, id: &str| {
        if !lots.has(&id.to_owned()) {
            lots.set(id.to_owned(), Lot { id: id.to_owned(), started_at: None, start_known: false, start_identity: None, state: None, current: false, excluded: false, events: vec![], entries: vec![] });
        }
    };
    for e in all {
        if let (Some(sid), Some(bid)) = (&e.session_id, &e.batch_id) {
            if sid != session && Some(bid) != cur_id.as_ref() { lot_of(&mut lots, bid); if let Some(l) = lots.get_mut(bid) { l.excluded = true; } }
        }
    }
    for e in all {
        if e.typ == "batch-started" { if let Some(bid) = &e.batch_id {
            lot_of(&mut lots, bid);
            if let Some(l) = lots.get_mut(bid) { if !l.start_known { l.start_known = true; l.started_at.clone_from(&e.started_at); l.start_identity.clone_from(&e.identity); } }
        } }
    }
    if let (Some(c), Some(cid)) = (cur, &cur_id) {
        lot_of(&mut lots, cid);
        let st = text(ch(c, "state"))?;
        if let Some(l) = lots.get_mut(cid) {
            l.current = true;
            l.state = st;
            if l.started_at.is_none() { l.started_at = time(ch(c, "startedAt")); }
        }
    }
    for e in all {
        if let Some(bid) = &e.batch_id { if e.typ != "batch-started" {
            lot_of(&mut lots, bid);
            if let Some(l) = lots.get_mut(bid) {
                if let Some(t) = &e.timestamp {
                    if !l.start_known && !l.current && l.started_at.as_ref().is_none_or(|sa| cmp_utf16(t, sa) == Ordering::Less) { l.started_at = Some(t.clone()); }
                }
            }
        } }
    }
    // timeline : lots datés, courant en dernier, puis par heure (localeCompare)
    let mut timeline: Vec<(bool, String, String)> = lots.valeurs().filter_map(|l| l.started_at.as_ref().map(|sa| (l.current, sa.clone(), l.id.clone()))).collect();
    trier(&mut timeline, |a, b| { let o = a.0.cmp(&b.0); if o != Ordering::Equal { return Ok(o); } locale_compare(&a.1, &b.1) })?;
    let running = |t: Option<&String>| -> Option<String> {
        let t = t?;
        let mut found = None;
        for (_, sa, id) in &timeline { if cmp_utf16(sa, t) != Ordering::Greater { found = Some(id.clone()); } }
        found
    };
    for (i, e) in all.iter().enumerate() {
        if e.typ == "batch-started" || e.session_id.as_ref().is_some_and(|x| x != session) { continue; }
        let lid = match &e.batch_id { Some(b) => Some(b.clone()), None => running(e.timestamp.as_ref()) };
        if let Some(lid) = lid { if let Some(l) = lots.get_mut(&lid) { if !l.excluded { l.events.push(i); } } }
    }
    if let (Some(c), Some(cid)) = (cur, &cur_id) {
        let mut entries = vec![];
        let at = |p: &Valeur| { let a = chemin(p, &["evidence", "startedAt"]); if js::nul(a) { chemin(p, &["evidence", "navigationAfter", "observedAt"]).clone() } else { a.clone() } };
        let mut entry = |p: &Valeur, status: &'static str, a: &Valeur, motifs: Option<Vec<String>>| -> Result<(), Echec> {
            entries.push(Fait { status, identity: identity_of_entry(p)?, at: time(a), motifs, shadow: false, gauge: false });
            Ok(())
        };
        for p in &js::liste_ou_vide(ch(c, "processed"))? { entry(p, "posed", &at(p), None)?; }
        for p in &js::liste_ou_vide(ch(c, "deferred"))? { entry(p, "deferred", ch(p, "deferredAt"), Some(motifs_of(ch(p, "rails"))?))?; }
        for p in &js::liste_ou_vide(ch(c, "manuallyCompleted"))? { entry(p, "manual", ch(p, "declaredAt"), None)?; }
        for p in &js::liste_ou_vide(ch(c, "skipped"))? { entry(p, "skipped", &at(p), None)?; }
        let mut pi = js::liste_ou_vide(ch(c, "paused"))?;
        pi.extend(js::liste_ou_vide(ch(c, "interrupted"))?);
        for p in &pi { if p.vrai() && !est(ch(p, "status"), "MANUAL_COMPLETION") { entry(p, "visit", ch(p, "at"), None)?; } }
        if let Some(l) = lots.get_mut(cid) { l.entries = entries; }
    }
    Ok(lots)
}

/// Union de contextes (partition seulement : la racine choisie n'est jamais observable).
#[derive(Default)]
struct Unions { parent: std::collections::HashMap<String, String> }
impl Unions {
    fn find(&mut self, k: &str) -> String {
        if !self.parent.contains_key(k) { self.parent.insert(k.to_owned(), k.to_owned()); }
        let mut r = k.to_owned();
        while let Some(p) = self.parent.get(&r) { if *p == r { break; } r.clone_from(p); }
        let mut x = k.to_owned();
        while x != r { let n = self.parent.get(&x).cloned().unwrap_or_else(|| r.clone()); self.parent.insert(x, r.clone()); x = n; }
        r
    }
    fn join(&mut self, a: &str, b: &str) { let (ra, rb) = (self.find(a), self.find(b)); if ra != rb { self.parent.insert(rb, ra); } }
}

fn link_contexts(lots: &Carte<String, Lot>, all: &[Ev], cur: Option<&Valeur>) -> Result<Unions, Echec> {
    let mut u = Unions::default();
    let active = match cur { Some(c) => identity(ch(c, "activeIdentity"))?, None => None };
    for l in lots.valeurs() {
        if l.excluded { continue; }
        let mut by_part: Carte<u64, String> = Carte::default();
        let mut link = |u: &mut Unions, i: Option<&Ident>| {
            let Some(k) = context_of(i) else { return };
            u.find(&k);
            let part = cle_same_value_zero(i.and_then(|x| x.part).unwrap_or(f64::NAN));
            if let Some(p) = by_part.get(&part).cloned() { u.join(&p, &k); } else { by_part.set(part, k); }
        };
        if l.start_identity.is_some() { link(&mut u, l.start_identity.as_ref()); }
        for &i in &l.events {
            let Some(e) = all.get(i) else { continue };
            if e.typ == "batch-rebased-after-reload" {
                if let (Some(a), Some(b)) = (context_of(e.from.as_ref()), context_of(e.identity.as_ref())) {
                    #[allow(clippy::float_cmp)] // === de JS sur deux entiers
                    if e.from.as_ref().and_then(|x| x.part) == e.identity.as_ref().and_then(|x| x.part) { u.join(&a, &b); }
                }
            } else if e.batch_id.is_some() { link(&mut u, e.identity.as_ref()); }
        }
        for x in &l.entries { link(&mut u, x.identity.as_ref()); }
        if l.current { link(&mut u, active.as_ref()); }
    }
    Ok(u)
}

#[derive(Debug, Clone)]
struct Ligne { cut: f64, status: &'static str, kind: Option<&'static str> }
impl Ligne {
    fn valeur(&self) -> Valeur { Obj::new().et("cut", Valeur::Nombre(self.cut)).et("status", s(self.status)).et("kind", s_ou_nul(self.kind)).v() }
}

struct Issues { cuts: Carte<u64, Ligne>, identity_unknown: f64, unlinked: f64, belongs: bool, placed: bool }

struct R { cut: f64, decisive: Option<usize>, gauge: bool }

fn outcomes(l: &Lot, all: &[Ev], in_group: &mut dyn FnMut(Option<&Ident>) -> bool, part: f64) -> Issues {
    let mut facts: Vec<Fait> = vec![];
    for &i in &l.events {
        let Some(e) = all.get(i) else { continue };
        let f = match e.typ.as_str() {
            "before-captured" => Some(("visit", false, false, None)),
            "gcv1-shadow-observed" => Some(("visit", true, e.gauge, None)),
            "validation-accepted" => Some((if e.posed { "posed" } else { "visit" }, false, false, None)),
            "defer-finalized" => Some((if e.confirmed { "deferred" } else { "visit" }, false, false, Some(e.motifs.clone()))),
            "batch-manual-completion" => Some(("manual", false, false, None)),
            "explicit-skip-observation" => Some((if e.command_sent { "skipped" } else { "visit" }, false, false, None)),
            _ => None,
        };
        if let Some((status, shadow, gauge, motifs)) = f {
            facts.push(Fait { status, identity: e.identity.clone(), at: e.timestamp.clone(), motifs: motifs.flatten(), shadow, gauge });
        }
    }
    facts.extend(l.entries.iter().cloned());
    let mut rows: Carte<u64, R> = Carte::default();
    let (mut identity_unknown, mut unlinked) = (0.0, 0.0);
    for (fi, f) in facts.iter().enumerate() {
        let cut = f.identity.as_ref().and_then(|x| x.cut);
        let (true, Some(cut)) = (context_of(f.identity.as_ref()).is_some(), cut) else { identity_unknown += 1.0; continue };
        if !in_group(f.identity.as_ref()) {
            #[allow(clippy::float_cmp)] // === de JS sur deux entiers
            if f.identity.as_ref().and_then(|x| x.part) == Some(part) { unlinked += 1.0; }
            continue;
        }
        let k = cle_same_value_zero(cut);
        if !rows.has(&k) { rows.set(k, R { cut, decisive: None, gauge: false }); }
        let Some(r) = rows.get_mut(&k) else { continue };
        if f.shadow { r.gauge = f.gauge; }
        if f.status == "visit" { continue; }
        let a = f.at.as_deref().unwrap_or("");
        let remplace = match r.decisive.and_then(|d| facts.get(d)) {
            None => true,
            Some(d) => {
                let b = d.at.as_deref().unwrap_or("");
                let o = cmp_utf16(a, b);
                o == Ordering::Greater || o == Ordering::Equal && decisive(f.status) >= decisive(d.status)
            }
        };
        if remplace { r.decisive = Some(fi); }
    }
    let mut cuts: Carte<u64, Ligne> = Carte::default();
    for (k, r) in rows.iter() {
        let d = r.decisive.and_then(|d| facts.get(d));
        let status = d.map_or("unknown", |d| d.status);
        let kind = if status == "deferred" { Some(defer_kind(d.and_then(|d| d.motifs.as_deref()).unwrap_or(&[]), r.gauge)) } else { None };
        cuts.set(*k, Ligne { cut: r.cut, status, kind });
    }
    let belongs = facts.iter().any(|f| in_group(f.identity.as_ref()));
    let placed = context_of(l.start_identity.as_ref()).is_some() || facts.iter().any(|f| context_of(f.identity.as_ref()).is_some());
    Issues { cuts, identity_unknown, unlinked, belongs, placed }
}

fn count_rows(rows: &[&Ligne]) -> Valeur {
    let mut c = [0.0f64; 10];
    let idx = |k: &str| ["distinct", "posed", "deferred", "engineDeferred", "gaugeRejected", "noInput", "unclassifiedDeferred", "manual", "skipped", "unknown"].iter().position(|x| *x == k);
    for r in rows {
        c[0] += 1.0;
        if let Some(i) = idx(r.status) { c[i] += 1.0; }
        if r.status == "deferred" { if let Some(i) = r.kind.and_then(idx) { c[i] += 1.0; } }
    }
    let noms = ["distinct", "posed", "deferred", "engineDeferred", "gaugeRejected", "noInput", "unclassifiedDeferred", "manual", "skipped", "unknown"];
    Valeur::Objet(noms.iter().zip(c).map(|(k, x)| ((*k).to_owned(), Valeur::Nombre(x))).collect())
}

fn trier_lignes(v: &mut [&Ligne]) { v.sort_by(|a, b| { let d = a.cut - b.cut; if d < 0.0 { Ordering::Less } else if d > 0.0 { Ordering::Greater } else { Ordering::Equal } }); }

/// `summarize(options)` (fonction 251).
///
/// # Errors
/// Hors domaine (voir le module).
pub fn summarize(o: &Valeur) -> Result<Valeur, Echec> {
    let o = match o { Valeur::Indefini => &Valeur::Objet(vec![]), Valeur::Objet(_) => o, _ => return hd("summarize : options non objet") };
    let defaut = |k: &str, d: Valeur| -> Valeur { match ch(o, k) { Valeur::Indefini => d, v => v.clone() } };
    let session_id = defaut("sessionId", Valeur::Nul);
    let batch = defaut("batch", Valeur::Nul);
    let shown = defaut("identity", Valeur::Nul);
    let events = defaut("events", Valeur::Tableau(vec![]));
    let history = defaut("historyStatus", s("unavailable"));
    let details = defaut("details", Valeur::Booleen(false)).vrai();
    let status = match js::chaine(&history) { Some(h @ ("available" | "loading" | "unavailable")) => h.to_owned(), _ => "unavailable".to_owned() };
    let session = text(&session_id)?;
    let mut r = Obj::new().et("format", s(FORMAT)).et("scope", Valeur::Nul).et("historyStatus", s(&status)).et("historyComplete", Valeur::Booleen(false))
        .et("partTotal", Valeur::Nul).et("lots", tab(vec![])).et("counts", Valeur::Nul).et("deferredCuts", tab(vec![])).et("unknownCuts", tab(vec![]))
        .et("inProgress", Valeur::Nombre(0.0)).et("activeCut", Valeur::Nul).et("identityUnknown", Valeur::Nombre(0.0)).et("missingStarts", Valeur::Nombre(0.0))
        .et("unlinked", Valeur::Nombre(0.0)).et("otherPageLots", Valeur::Nombre(0.0)).et("excludedLots", Valeur::Nombre(0.0));
    let Some(session) = session else { return Ok(r.v()) };
    let cur = if batch.vrai() && present(ch(&batch, "id")) { Some(&batch) } else { None };
    let all = read_events(&events)?;
    let lots = build_lots(&all, &session, cur)?;
    let mut u = link_contexts(&lots, &all, cur)?;
    r.poser("excludedLots", Valeur::Nombre(lots.valeurs().filter(|l| l.excluded).count() as f64));

    let mut anchor: Option<Ident> = None;
    let mut source = "esv";
    if let Some(c) = cur {
        let cid = js::en_chaine(ch(c, "id"))?;
        let part = entier(chemin(c, &["scope", "part"]));
        let l = lots.get(&cid).ok_or_else(|| Echec::hors_domaine("lot courant absent"))?;
        let mut cands = vec![identity(ch(c, "activeIdentity"))?, l.start_identity.clone()];
        cands.extend(l.entries.iter().map(|x| x.identity.clone()));
        #[allow(clippy::float_cmp)] // === de JS sur deux entiers
        { anchor = cands.into_iter().find(|i| context_of(i.as_ref()).is_some() && part.is_none_or(|p| i.as_ref().and_then(|x| x.part) == Some(p))).flatten(); }
        if anchor.is_some() { source = "lot"; }
    }
    if anchor.is_none() { let i = identity(&shown)?; if context_of(i.as_ref()).is_some() { anchor = i; } }
    let Some(anchor) = anchor else { return Ok(r.v()) };
    let anchor_part = anchor.part.unwrap_or(f64::NAN);
    let group = u.find(&context_of(Some(&anchor)).unwrap_or_default());
    let mut in_group = |i: Option<&Ident>| -> bool { context_of(i).is_some_and(|k| u.find(&k) == group) };
    r.poser("scope", Obj::new().et("sessionId", s(&session)).et("source", s(source)).et("part", Valeur::Nombre(anchor_part))
        .et("projectId", s_ou_nul(anchor.project_id.as_deref())).et("pageId", s_ou_nul(anchor.page_id.as_deref()))
        .et("frameId", s_ou_nul(anchor.frame_id.as_deref())).et("shape", s_ou_nul(anchor.shape.as_deref())).v());

    let (mut identity_unknown, mut other_page_lots) = (0.0f64, 0.0f64);
    let mut part_lots: Vec<(&Lot, Issues)> = vec![];
    for l in lots.valeurs() {
        if l.excluded { continue; }
        let o = outcomes(l, &all, &mut in_group, anchor_part);
        let mine = l.current && source == "lot" || l.start_identity.is_some() && in_group(l.start_identity.as_ref()) || o.belongs;
        #[allow(clippy::float_cmp)] // === de JS sur deux entiers
        let meme_partie = l.start_identity.as_ref().and_then(|x| x.part) == Some(anchor_part);
        if mine { part_lots.push((l, o)); }
        else if !o.placed && o.identity_unknown != 0.0 { identity_unknown += o.identity_unknown; }
        else if o.unlinked != 0.0 || meme_partie { other_page_lots += 1.0; }
    }
    trier(&mut part_lots, |a, b| {
        let o = a.0.current.cmp(&b.0.current);
        if o != Ordering::Equal { return Ok(o); }
        let o = locale_compare(a.0.started_at.as_deref().unwrap_or(""), b.0.started_at.as_deref().unwrap_or(""))?;
        if o != Ordering::Equal { return Ok(o); }
        locale_compare(&a.0.id, &b.0.id)
    })?;

    let (mut in_progress, mut active_cut) = (0.0, None);
    let cur_state = match cur { Some(c) => text(ch(c, "state"))?, None => None };
    if let (Some(c), Some(cl)) = (cur, part_lots.iter_mut().find(|x| x.0.current)) {
        if cur_state.as_deref().is_some_and(|st| OPEN.contains(&st)) {
            if let Some(a) = identity(ch(c, "activeIdentity"))? {
                if let Some(cut) = a.cut {
                    let k = cle_same_value_zero(cut);
                    let st = cl.1.cuts.get(&k).map(|x| x.status);
                    if in_group(Some(&a)) && st.is_none_or(|x| x == "unknown") { in_progress = 1.0; active_cut = Some(cut); cl.1.cuts.delete(&k); }
                }
            }
        }
    }
    let mut merged: Carte<u64, Ligne> = Carte::default();
    for x in &part_lots { for (k, row) in x.1.cuts.iter() { merged.set(*k, row.clone()); } }
    if let Some(ac) = active_cut { let k = cle_same_value_zero(ac); if merged.has(&k) { merged.set(k, Ligne { cut: ac, status: "unknown", kind: None }); } }

    let (mut missing_starts, mut unlinked) = (0.0, 0.0);
    let mut lots_v = vec![];
    let mut tous_complets = true;
    for x in &part_lots {
        let l = x.0;
        let mut rows: Vec<&Ligne> = x.1.cuts.valeurs().collect();
        trier_lignes(&mut rows);
        if !l.start_known { missing_starts += 1.0; }
        identity_unknown += x.1.identity_unknown;
        unlinked += x.1.unlinked;
        let state = if l.current { l.state.clone() } else {
            l.events.iter().filter_map(|&i| all.get(i)).rfind(|e| e.typ == "batch-state" && e.state.is_some()).and_then(|e| e.state.clone())
        };
        let complete = status == "available" && l.start_known && x.1.identity_unknown == 0.0 && x.1.unlinked == 0.0;
        tous_complets &= complete;
        let mut lot = Obj::new().et("id", s(&l.id)).et("startedAt", s_ou_nul(l.started_at.as_deref())).et("startKnown", Valeur::Booleen(l.start_known))
            .et("state", s_ou_nul(state.as_deref())).et("current", Valeur::Booleen(l.current)).et("complete", Valeur::Booleen(complete)).et("counts", count_rows(&rows));
        if details { lot.poser("cuts", tab(rows.iter().map(|r| r.valeur()).collect())); }
        lots_v.push(lot.v());
    }
    let mut rows: Vec<&Ligne> = merged.valeurs().collect();
    trier_lignes(&mut rows);
    r.poser("lots", tab(lots_v));
    r.poser("counts", count_rows(&rows));
    r.poser("deferredCuts", tab(rows.iter().filter(|x| x.status == "deferred").map(|x| Valeur::Nombre(x.cut)).collect()));
    r.poser("unknownCuts", tab(rows.iter().filter(|x| x.status == "unknown").map(|x| Valeur::Nombre(x.cut)).collect()));
    r.poser("inProgress", Valeur::Nombre(in_progress));
    r.poser("activeCut", js::n_ou_nul(active_cut));
    r.poser("identityUnknown", Valeur::Nombre(identity_unknown));
    r.poser("missingStarts", Valeur::Nombre(missing_starts));
    r.poser("unlinked", Valeur::Nombre(unlinked));
    r.poser("otherPageLots", Valeur::Nombre(other_page_lots));
    if details { r.poser("cuts", tab(rows.iter().map(|x| x.valeur()).collect())); }
    r.poser("historyComplete", Valeur::Booleen(status == "available" && identity_unknown == 0.0 && other_page_lots == 0.0 && tous_complets));
    Ok(r.v())
}

/// `fromJournal(j)` (fonction 252).
///
/// # Errors
/// Aucune (signature commune des fonctions du lot).
pub fn from_journal(j: &Valeur) -> Result<Valeur, Echec> {
    let st = ch(j, "state");
    let s0 = if st.vrai() { st } else { &js::INDEFINI };
    let ou_nul = |v: &Valeur| if js::nul(v) { Valeur::Nul } else { v.clone() };
    let mut events = vec![];
    for l in [ch(j, "events"), ch(s0, "events")] { if js::est_tableau(l) { events.extend(js::elements(l).unwrap_or_default().iter().cloned()); } }
    Ok(Obj::new().et("sessionId", ou_nul(ch(s0, "sessionId"))).et("batch", ou_nul(ch(s0, "batch")))
        .et("identity", ou_nul(chemin(s0, &["current", "identity"]))).et("events", tab(events)).et("historyStatus", s("available")).v())
}

/// `contextOf(i)` (fonction 253) sur une valeur brute.
///
/// # Errors
/// Hors domaine : champ non primitif (sa forme JSON n'est pas reproduite ici).
pub fn context_of_valeur(i: &Valeur) -> Result<Valeur, Echec> {
    if !i.vrai() { return Ok(Valeur::Nul); }
    let Some(part) = entier(ch(i, "part")) else { return Ok(Valeur::Nul) };
    let pj = |k: &str| -> Result<String, Echec> {
        let v = ch(i, k);
        if matches!(v, Valeur::Objet(_) | Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Bloc { .. }) { return hd("contextOf : champ objet"); }
        Ok(js::json(v).unwrap_or_else(|| "null".into()))
    };
    let p = js::json(&Valeur::Nombre(part)).unwrap_or_default();
    if ch(i, "projectId").vrai() { return Ok(s(&format!("[\"projet\",{},{p}]", pj("projectId")?))); }
    if ch(i, "pageId").vrai() && ch(i, "frameId").vrai() && ch(i, "shape").vrai() {
        return Ok(s(&format!("[\"page\",{},{},{},{p}]", pj("pageId")?, pj("frameId")?, pj("shape")?)));
    }
    Ok(Valeur::Nul)
}

/// `deferKind(motifs, gauge)` (fonction 254).
///
/// # Errors
/// Hors domaine : `motifs` ni tableau ni chaîne.
pub fn defer_kind_valeur(motifs: &Valeur, gauge: &Valeur) -> Result<Valeur, Echec> {
    let g = matches!(gauge, Valeur::Booleen(true));
    let k = match motifs {
        Valeur::Chaine(c) => if c.contains("input") { "noInput" } else if g || c.contains("gauge-out-of-contract") { "gaugeRejected" } else if c.is_empty() { "unclassifiedDeferred" } else { "engineDeferred" },
        v if js::est_tableau(v) => {
            let l = js::elements(v).unwrap_or_default();
            let a = |x: &str| l.iter().any(|m| est(m, x));
            if a("input") { "noInput" } else if g || a("gauge-out-of-contract") { "gaugeRejected" } else if l.is_empty() { "unclassifiedDeferred" } else { "engineDeferred" }
        }
        _ => return hd("deferKind : motifs"),
    };
    Ok(s(k))
}

#[cfg(test)]
mod essais {
    use super::*;
    fn ev(typ: &str, id: &str, ts: &str, cut: f64) -> Valeur {
        Obj::new().et("type", s(typ)).et("eventId", s(id)).et("timestamp", s(ts)).et("batchId", s("b1"))
            .et("identity", Obj::new().et("pageId", s("p")).et("frameId", s("f")).et("shape", s("s")).et("part", Valeur::Nombre(3.0)).et("cut", Valeur::Nombre(cut)).v()).v()
    }
    #[test]
    fn projection_et_resume() {
        let e = ev("validation-accepted", "e1", "2026-01-01T00:00:01Z", 5.0);
        let p = project_event_valeur(&Obj::new().et("type", s("x")).v());
        assert_eq!(p, Ok(Valeur::Nul));
        let p = project_event_valeur(&e).unwrap_or(Valeur::Nul);
        assert_eq!(ch(&p, "posed"), &Valeur::Booleen(false));
        assert_eq!(project_event_valeur(&p).as_ref(), Ok(&p));
        let st = Obj::new().et("type", s("batch-started")).et("eventId", s("e0")).et("timestamp", s("2026-01-01T00:00:00Z"))
            .et("batch", Obj::new().et("id", s("b1")).v()).et("identity", ch(&e, "identity").clone()).v();
        let o = Obj::new().et("sessionId", s("S")).et("events", tab(vec![e, st])).et("historyStatus", s("available")).et("identity", ch(&p, "identity").clone()).v();
        let r = summarize(&o).unwrap_or(Valeur::Nul);
        assert_eq!(chemin(&r, &["counts", "distinct"]), &Valeur::Nombre(1.0));
        assert_eq!(chemin(&r, &["counts", "unknown"]), &Valeur::Nombre(1.0));
        assert_eq!(ch(&r, "historyComplete"), &Valeur::Booleen(true));
    }
    #[test]
    fn journal_contexte_motif() {
        let j = Obj::new().et("events", tab(vec![s("a")])).et("state", Obj::new().et("sessionId", s("S")).v()).v();
        let r = from_journal(&j).unwrap_or(Valeur::Nul);
        assert_eq!(ch(&r, "sessionId"), &s("S"));
        let i = Obj::new().et("projectId", s("P")).et("part", Valeur::Nombre(-0.0)).v();
        assert_eq!(context_of_valeur(&i), Ok(s("[\"projet\",\"P\",0]")));
        assert_eq!(defer_kind_valeur(&tab(vec![]), &Valeur::Booleen(true)), Ok(s("gaugeRejected")));
        assert!(defer_kind_valeur(&Valeur::Nul, &Valeur::Nul).is_err());
    }
}
