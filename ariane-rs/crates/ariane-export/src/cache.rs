//! Fonctions pures de `src/export-cache.js`. Restent en JS : `supprimer`, `lire`, `ecrire`, `lireDeparts`,
//! `noterDepart` (stockage, asynchrones), `texte` (`new Date(texte)` : analyse de date), `texteDepart` et `heureParis`
//! (`Intl.DateTimeFormat`, fuseau de Paris).
use crate::js::{self, prop};
use ariane_js::{cle_same_value_zero, Echec};
use ariane_vba::Valeur;

const LOT_TERMINE: &str = "STOPPED";
const TERMINES: [&str; 3] = [LOT_TERMINE, "COMPLETED", "FINISHED_WITH_UNCONFIRMED_ACTIONS"];
const CAPTURES_OUVERTES: [&str; 3] = ["BEFORE_CAPTURED", "READY_FOR_AFTER", "STALE"];

fn est(v: &Valeur, s: &str) -> bool { matches!(v, Valeur::Chaine(c) if c == s) }
fn parmi(v: &Valeur, l: &[&str]) -> bool { l.iter().any(|s| est(v, s)) }
/// `COLLECTIONS_LIBRES.includes(v)` : `undefined`, `null`, « IDLE », « `AFTER_CAPTURED` ».
fn libre(v: &Valeur) -> bool { js::est_nul(v) || parmi(v, &["IDLE", "AFTER_CAPTURED"]) }

/// `finiPourDeBon(b)`.
#[must_use]
pub fn fini_pour_de_bon(b: &Valeur) -> bool {
    b.vrai() && (est(prop(b, "state"), "COMPLETED") || est(prop(b, "state"), "FINISHED_WITH_UNCONFIRMED_ACTIONS")
        || (est(prop(b, "state"), LOT_TERMINE) && prop(b, "stoppedAtEnd").vrai()))
}

fn incertain(s: &Valeur) -> bool {
    let d = prop(s, "deferIntent");
    prop(s, "intent").vrai() || prop(s, "reconcileRequired").vrai() || (d.vrai() && !est(prop(d, "phase"), "FINALIZED"))
}

fn refus_capture(s: &Valeur, b: &Valeur) -> Result<Option<String>, Echec> {
    let col = js::en_chaine(prop(s, "collection"))?;
    let base = format!("une capture est en cours ({col})");
    if !parmi(prop(s, "collection"), &CAPTURES_OUVERTES) { return Ok(Some(base)); }
    if !b.vrai() || !prop(b, "state").vrai() { return Ok(Some(base + " : enregistre l’après ou annule la capture, puis réessaie")); }
    if !fini_pour_de_bon(b) {
        return Ok(Some(base + " : le lot est arrêté à la main au milieu d’un cut et peut être repris. Clique sur « Reprendre » (ou lance un nouveau lot) et laisse-le aller jusqu’à sa fin, puis vide le cache"));
    }
    if incertain(s) {
        return Ok(Some(format!("un résultat reste à contrôler dans ESV et une capture est ouverte ({col}) : clique d’abord sur « Archiver le résultat interrompu », puis réessaie")));
    }
    Ok(None)
}

/// `t.pending.size > 0` : nombre, booléen ou null comparés comme en JS ; autre type hors domaine.
fn taille_positive(v: &Valeur) -> Result<bool, Echec> {
    Ok(match v {
        Valeur::Nombre(x) => *x > 0.0,
        Valeur::Booleen(b) => *b,
        Valeur::Nul | Valeur::Indefini => false,
        _ => return Err(Echec::hors_domaine("pending.size non numérique")),
    })
}

/// 204 : `refus(c, options)` sur `{c, options}` ; `c.timing.pending` (Set ou Map en JS) arrive sous la forme `{size}`.
///
/// # Errors
/// `HorsDomaine` : `c` nul, conversions d'objets en texte, `size` non numérique.
pub fn refus(e: &Valeur) -> Result<Valeur, Echec> {
    let c = prop(e, "c");
    let options = prop(e, "options");
    let s0 = js::prop_stricte(c, "state")?;
    let vide = Valeur::Objet(vec![]);
    let s = if s0.vrai() { s0 } else { &vide };
    let b = prop(s, "batch");
    let r = |m: &str| Ok(js::ch(m));
    if options.vrai() && prop(options, "auto").vrai() && b.vrai() && est(prop(b, "state"), LOT_TERMINE) && !prop(b, "stoppedAtEnd").vrai() {
        return r("le lot est arrêté mais pas terminé : il peut être repris (vidage automatique refusé)");
    }
    if b.vrai() && prop(b, "state").vrai() && !parmi(prop(b, "state"), &TERMINES) {
        return Ok(Valeur::Chaine(format!("un lot n’est pas terminé ({}) : arrête-le ou termine-le d’abord", js::en_chaine(prop(b, "state"))?)));
    }
    if prop(c, "busy").vrai() || prop(c, "task").vrai() { return r("Ariane travaille encore (action en cours)"); }
    if prop(c, "nativeActive").vrai() { return r("Écho est actif"); }
    if prop(c, "manualActive").vrai() { return r("une session Mes corrections est active"); }
    if !libre(prop(s, "collection")) {
        if let Some(m) = refus_capture(s, b)? { return Ok(Valeur::Chaine(m)); }
    }
    let t = prop(c, "timing");
    if t.vrai() && prop(t, "batch").vrai() && !prop(prop(t, "batch"), "closed").vrai() { return r("la clôture de la mesure V1 du lot n’est pas terminée"); }
    if t.vrai() && prop(t, "pending").vrai() && taille_positive(prop(prop(t, "pending"), "size"))? { return r("des écritures de mesure sont encore en cours"); }
    let g = prop(c, "graceObservations");
    if est(g, "en-cours") { return r("les dernières observations du lot qui vient de finir peuvent encore arriver (5 s au plus) : réessaie dans quelques secondes"); }
    if est(g, "depuis-instantane") { return r("des observations du lot qui venait de finir ont pu arriver après le début de l’export (5 s au plus après sa fin) : elles ne sont pas dans cet export ; refais l’export avant de vider"); }
    Ok(Valeur::Nul)
}

/// 205 : `reprenable(c)` sur `{c}`.
///
/// # Errors
/// `HorsDomaine` si `c` est nul (le JS lève une `TypeError`).
pub fn reprenable(e: &Valeur) -> Result<Valeur, Echec> {
    let st = js::prop_stricte(prop(e, "c"), "state")?;
    let b = if st.vrai() { prop(st, "batch") } else { st };
    Ok(Valeur::Booleen(b.vrai() && est(prop(b, "state"), LOT_TERMINE) && !prop(b, "stoppedAtEnd").vrai()))
}

/// 206 : `finiPourDeBon(b)` sur `{b}`.
///
/// # Errors
/// Jamais (signature commune).
pub fn fini(e: &Valeur) -> Result<Valeur, Echec> { Ok(Valeur::Booleen(fini_pour_de_bon(prop(e, "b")))) }

/// Clé d'appartenance à un `Set` JS pour une primitive (`SameValueZero`) ; objets hors domaine.
#[derive(PartialEq, Eq, Hash, Clone)]
pub enum CleSet {
    /// undefined / null / booléen.
    Speciale(u8),
    /// Nombre (−0 = +0, NaN = NaN).
    Nombre(u64),
    /// Chaîne.
    Chaine(String),
}

/// Clé `SameValueZero` d'une primitive.
///
/// # Errors
/// `HorsDomaine` pour un objet (identité JS non portée).
pub fn cle_set(v: &Valeur) -> Result<CleSet, Echec> {
    Ok(match v {
        Valeur::Indefini => CleSet::Speciale(0),
        Valeur::Nul => CleSet::Speciale(1),
        Valeur::Booleen(b) => CleSet::Speciale(2 + u8::from(*b)),
        Valeur::Nombre(x) => CleSet::Nombre(cle_same_value_zero(*x)),
        Valeur::Chaine(s) => CleSet::Chaine(s.clone()),
        _ => return Err(Echec::hors_domaine("objet comme clé d'ensemble")),
    })
}

/// 203 : `capturesAGarder(s, events, records)` sur `{s, events, records}`.
///
/// # Errors
/// `HorsDomaine` si l'identifiant de capture, celui de proposition ou une visite (`visitId`) est un objet.
pub fn captures_a_garder(e: &Valeur) -> Result<Valeur, Echec> {
    let s = prop(e, "s");
    let vide = || js::objet(vec![("clouds", js::tab(vec![])), ("events", js::tab(vec![])), ("records", js::tab(vec![]))]);
    if !s.vrai() || !parmi(prop(s, "collection"), &CAPTURES_OUVERTES) || !prop(s, "lidarId").vrai() { return Ok(vide()); }
    let id = prop(s, "lidarId");
    let p = prop(s, "proposal");
    let pid = if p.vrai() { prop(p, "id") } else { p };
    if js::est_objet(id) || js::est_objet(pid) { return Err(Echec::hors_domaine("identifiant de capture ou de proposition objet")); }
    let eq = |a: &Valeur, b: &Valeur| js::strict_egal(a, b).unwrap_or(false);
    let nomme = |o: &Valeur| -> bool {
        if !o.vrai() { return false; }
        let pa = prop(o, "paused");
        let pr = prop(o, "proposal");
        eq(prop(o, "lidarId"), id) || eq(prop(o, "lidarCaptureId"), id) || eq(prop(o, "captureId"), id)
            || (pa.vrai() && eq(prop(pa, "lidarCaptureId"), id))
            || (pid.vrai() && (eq(prop(o, "proposalId"), pid) || (pr.vrai() && eq(prop(pr, "id"), pid))
                || (pa.vrai() && prop(pa, "proposal").vrai() && eq(prop(prop(pa, "proposal"), "id"), pid))))
    };
    let evs = js::elements(prop(e, "events")).unwrap_or_default();
    let mut visites = std::collections::HashSet::new();
    for x in &evs { if nomme(x) { let v = prop(x, "visitId"); if v.vrai() { visites.insert(cle_set(v)?); } } }
    let mut ev_ids = vec![];
    for x in &evs {
        let garde = nomme(x) || (x.vrai() && prop(x, "visitId").vrai() && visites.contains(&cle_set(prop(x, "visitId"))?));
        if garde { let i = prop(x, "eventId"); if !matches!(i, Valeur::Indefini) { ev_ids.push(i.clone()); } }
    }
    let mut rc_ids = vec![];
    for r in js::elements(prop(e, "records")).unwrap_or_default() {
        if nomme(&r) { let i = js::ou_vrai(prop(&r, "recordId"), prop(&r, "id")); if !matches!(i, Valeur::Indefini) { rc_ids.push(i.clone()); } }
    }
    Ok(js::objet(vec![("clouds", js::tab(vec![id.clone()])), ("events", js::tab(ev_ids)), ("records", js::tab(rc_ids))]))
}

/// FNV-1a 32 bits sur les unités UTF-16 d'un texte, puis `longueur:hex` (la `signature` du JS).
#[must_use]
pub fn signature_texte(t: &str) -> String {
    let mut h: u32 = 0x811c_9dc5;
    let mut n = 0usize;
    for u in t.encode_utf16() { h ^= u32::from(u); h = h.wrapping_mul(0x0100_0193); n += 1; }
    format!("{n}:{h:x}")
}

/// `signature(objet)` : taille + FNV-1a du JSON.
///
/// # Errors
/// Voir [`js::stringify`].
pub fn signature_de(v: &Valeur) -> Result<String, Echec> { Ok(signature_texte(&js::stringify(v)?.unwrap_or_default())) }

/// 201 : `signature(objet)` sur `{objet}`.
///
/// # Errors
/// Voir [`js::stringify`].
pub fn signature(e: &Valeur) -> Result<Valeur, Echec> { Ok(Valeur::Chaine(signature_de(prop(e, "objet"))?)) }

/// 202 : `objets.map(signature)` sur `{objets}` (un seul passage pour tout un magasin).
///
/// # Errors
/// `HorsDomaine` si `objets` n'est pas un tableau.
pub fn signatures(e: &Valeur) -> Result<Valeur, Echec> {
    let l = js::elements(prop(e, "objets")).ok_or_else(|| Echec::hors_domaine("objets : tableau attendu"))?;
    Ok(js::tab(l.iter().map(|o| signature_de(o).map(Valeur::Chaine)).collect::<Result<_, _>>()?))
}

/// `entier(v)` : entier de [0 ; 1e8[, sinon null (−0 rendu tel quel, comme en JS).
fn entier(v: &Valeur) -> Valeur {
    match v { Valeur::Nombre(x) if js::est_entier(*x) && *x >= 0.0 && *x < 1e8 => Valeur::Nombre(*x), _ => Valeur::Nul }
}

/// 207 : `ficheDepart(obs, ctx)` sur `{obs, ctx}`.
///
/// # Errors
/// `HorsDomaine` si `version` se coupe au milieu d'une paire UTF-16.
pub fn fiche_depart(e: &Valeur) -> Result<Valeur, Echec> {
    let obs = prop(e, "obs");
    let ctx = prop(e, "ctx");
    let counts = prop(obs, "counts");
    let c = obs.vrai() && est(prop(obs, "kind"), "list-summary") && counts.vrai() && js::est_objet(counts);
    let valides = if c { entier(prop(counts, "valid")) } else { Valeur::Nul };
    let invalides = if c { entier(prop(counts, "invalid")) } else { Valeur::Nul };
    let lignes = entier(if obs.vrai() { prop(obs, "rows") } else { obs });
    if matches!(valides, Valeur::Nul) || matches!(invalides, Valeur::Nul) || !lignes.vrai() { return Ok(Valeur::Nul); }
    let cle = prop(obs, "listKey");
    let Some(n) = js::nombre(&lignes) else { return Ok(Valeur::Nul) };
    if !matches!(cle, Valeur::Chaine(k) if !k.is_empty() && k != "undefined") || n < 2.0 { return Ok(Valeur::Nul); }
    let at = if let Valeur::Chaine(s) = prop(obs, "timestamp") { Valeur::Chaine(s.clone()) } else { Valeur::Nul };
    let vide = Valeur::Objet(vec![]);
    let k = if ctx.vrai() { ctx } else { &vide };
    let batch = match (prop(k, "batchId"), prop(obs, "batchId")) { (Valeur::Chaine(s), _) | (_, Valeur::Chaine(s)) => Valeur::Chaine(s.clone()), _ => Valeur::Nul };
    let version = match prop(k, "version") {
        Valeur::Chaine(s) => Valeur::Chaine(js::tranche_utf16(s, 0, 20).ok_or_else(|| Echec::hors_domaine("version coupée dans une paire UTF-16"))?),
        _ => Valeur::Nul,
    };
    Ok(js::objet(vec![("at", at), ("batchId", batch), ("partie", entier(prop(k, "partie"))), ("version", version), ("valides", valides),
        ("invalides", invalides), ("ignores", entier(prop(counts, "skipped"))), ("total", lignes)]))
}

/// 208 : `ajouterDepart(liste, fiche)` sur `{liste, fiche}` : rend les INDICES des éléments de la liste rendue (−1 pour
/// `fiche`), que la façade remplace par les objets d'origine (le JS rend ces objets eux-mêmes).
///
/// # Errors
/// `HorsDomaine` si une comparaison `===` porte sur deux objets.
pub fn ajouter_depart(e: &Valeur) -> Result<Valeur, Echec> {
    let liste = prop(e, "liste");
    let fiche = prop(e, "fiche");
    let el = js::elements(liste).unwrap_or_default();
    let l: Vec<usize> = (0..el.len()).filter(|&i| el[i].vrai() && js::est_objet(&el[i])).collect();
    let rendre = |v: Vec<f64>| Ok(if v.is_empty() { Valeur::Tableau(vec![]) } else { Valeur::Nombres(v) });
    let idx = |l: &[usize]| l.iter().map(|&i| i as f64).collect::<Vec<_>>();
    if !fiche.vrai() { return rendre(idx(&l)); }
    for &i in &l {
        let x = &el[i];
        let mut tous = true;
        for k in ["batchId", "valides", "invalides", "total"] { if !js::strict_egal(prop(x, k), prop(fiche, k))? { tous = false; break; } }
        if tous { return rendre(idx(&l)); }
    }
    let mut v = idx(&l);
    v.push(-1.0);
    let debut = v.len().saturating_sub(200);
    rendre(v[debut..].to_vec())
}

#[cfg(test)]
mod essais {
    use super::*;
    use crate::js::{ch, objet};
    #[test]
    fn refus_et_reprise() {
        let c = |s: Valeur| objet(vec![("c", objet(vec![("state", s)]))]);
        assert_eq!(refus(&c(Valeur::Nul)).unwrap(), Valeur::Nul);
        let lot = |st: &str| objet(vec![("batch", objet(vec![("state", ch(st))]))]);
        assert_eq!(refus(&c(lot("RUNNING"))).unwrap(), ch("un lot n’est pas terminé (RUNNING) : arrête-le ou termine-le d’abord"));
        assert_eq!(reprenable(&c(lot("STOPPED"))).unwrap(), Valeur::Booleen(true));
        assert!(refus(&objet(vec![("c", Valeur::Nul)])).is_err());
        let ouverte = objet(vec![("collection", ch("STALE"))]);
        assert_eq!(refus(&c(ouverte)).unwrap(), ch("une capture est en cours (STALE) : enregistre l’après ou annule la capture, puis réessaie"));
        assert_eq!(fini(&objet(vec![("b", objet(vec![("state", ch("COMPLETED"))]))])).unwrap(), Valeur::Booleen(true));
    }
    #[test]
    fn captures() {
        let s = objet(vec![("collection", ch("STALE")), ("lidarId", ch("L")), ("proposal", objet(vec![("id", ch("P"))]))]);
        let evs = js::tab(vec![objet(vec![("eventId", ch("a")), ("lidarId", ch("L")), ("visitId", ch("V"))]), objet(vec![("eventId", ch("b")), ("visitId", ch("V"))]),
            objet(vec![("eventId", ch("c"))]), objet(vec![("eventId", ch("d")), ("proposal", objet(vec![("id", ch("P"))]))])]);
        let r = captures_a_garder(&objet(vec![("s", s), ("events", evs), ("records", js::tab(vec![objet(vec![("id", ch("r")), ("lidarCaptureId", ch("L"))])]))])).unwrap();
        assert_eq!(r, objet(vec![("clouds", js::tab(vec![ch("L")])), ("events", js::tab(vec![ch("a"), ch("b"), ch("d")])), ("records", js::tab(vec![ch("r")]))]));
    }
    #[test]
    fn signatures_fnv() {
        assert_eq!(signature_texte(""), "0:811c9dc5");
        assert_eq!(signature(&objet(vec![("objet", objet(vec![("a", Valeur::Nombre(1.0))]))])).unwrap(), ch(&signature_texte("{\"a\":1}")));
        assert_eq!(signatures(&objet(vec![("objets", js::tab(vec![Valeur::Indefini]))])).unwrap(), js::tab(vec![ch("0:811c9dc5")]));
        assert!(cle_set(&Valeur::Objet(vec![])).is_err());
    }
    #[test]
    fn fiches() {
        let obs = objet(vec![("kind", ch("list-summary")), ("counts", objet(vec![("valid", Valeur::Nombre(3.0)), ("invalid", Valeur::Nombre(0.0))])),
            ("rows", Valeur::Nombre(5.0)), ("listKey", ch("k")), ("batchId", ch("B"))]);
        let f = fiche_depart(&objet(vec![("obs", obs), ("ctx", objet(vec![("partie", Valeur::Nombre(7.0)), ("version", ch("5"))]))])).unwrap();
        assert_eq!(prop(&f, "batchId"), &ch("B"));
        assert_eq!(prop(&f, "ignores"), &Valeur::Nul);
        let r = ajouter_depart(&objet(vec![("liste", js::tab(vec![f.clone(), Valeur::Nul])), ("fiche", f)])).unwrap();
        assert_eq!(r, Valeur::Nombres(vec![0.0]));
        let r = ajouter_depart(&objet(vec![("liste", Valeur::Nul), ("fiche", objet(vec![]))])).unwrap();
        assert_eq!(r, Valeur::Nombres(vec![-1.0]));
    }
}
