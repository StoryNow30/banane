//! Partie pure de `src/journal-index.js` : l'index en mémoire (clés par type et par session).
//! La lecture `IndexedDB`, le Proxy et l'horloge restent en JavaScript.
use crate::jsval::{self, a, chaine, cmp_utf16, est_objet};
use ariane_vba::Valeur;
use std::collections::{HashMap, HashSet};

#[derive(Clone)]
struct Index {
    invalide: bool,
    events: f64,
    records: f64,
    par_type: Vec<(String, HashSet<String>)>,
    ev_natif: Vec<(String, HashSet<String>)>,
    rec_natif: Vec<(String, HashSet<String>)>,
}

impl Index {
    fn vide() -> Self { Self { invalide: false, events: 0.0, records: 0.0, par_type: vec![], ev_natif: vec![], rec_natif: vec![] } }
}

fn carte<'a>(m: &'a mut Vec<(String, HashSet<String>)>, k: &str) -> &'a mut HashSet<String> {
    if let Some(i) = m.iter().position(|(c, _)| c == k) { return &mut m[i].1; }
    m.push((k.to_string(), HashSet::new()));
    &mut m.last_mut().unwrap().1
}
fn ajouter(m: &mut Vec<(String, HashSet<String>)>, k: &str, cle: &str) { carte(m, k).insert(cle.to_string()); }
fn retirer(cartes: [&mut Vec<(String, HashSet<String>)>; 2], cles: &[String]) {
    // Deux cartes distinctes : on ne peut pas les emprunter ensemble facilement. Fait par l'appelant.
    let _ = (cartes, cles);
}
fn retirer_une(m: &mut Vec<(String, HashSet<String>)>, cles: &[String]) {
    for (_, s) in m.iter_mut() { for k in cles { s.remove(k); } }
}

fn cle_evenement(e: &Valeur) -> Option<String> { chaine(a(e, "eventId")).map(std::string::ToString::to_string) }
fn cle_visite(r: &Valeur) -> Option<String> {
    let id = a(r, "recordId");
    if jsval::vrai(id) { return chaine(id).map(std::string::ToString::to_string); }
    chaine(a(r, "id")).filter(|s| !s.is_empty()).map(std::string::ToString::to_string)
}

fn noter_evenement(ix: &mut Index, e: &Valeur, types: &HashSet<String>) {
    let Some(cle) = cle_evenement(e) else { return };
    if !est_objet(e) { return; }
    if let Some(t) = chaine(a(e, "type")) {
        if types.contains(t) { ajouter(&mut ix.par_type, t, &cle); }
    }
    if let Some(sid) = chaine(a(e, "nativeSessionId")) { ajouter(&mut ix.ev_natif, sid, &cle); }
}
fn noter_visite(ix: &mut Index, r: &Valeur) {
    let Some(cle) = cle_visite(r) else { return };
    if !est_objet(r) { return; }
    if let Some(sid) = chaine(a(r, "nativeSessionId")) { ajouter(&mut ix.rec_natif, sid, &cle); }
}

fn types_de(v: &Valeur) -> (Vec<String>, HashSet<String>) {
    let mut vus = vec![];
    let mut set = HashSet::new();
    for e in jsval::elements(v) {
        if let Some(t) = chaine(e) {
            if set.insert(t.to_string()) { vus.push(t.to_string()); }
        }
    }
    (vus, set)
}

fn liste_chaines(v: &Valeur) -> Vec<String> {
    jsval::elements(v).into_iter().filter_map(|e| chaine(e).map(std::string::ToString::to_string)).collect()
}

fn paires(m: &[(String, HashSet<String>)]) -> Valeur {
    jsval::tab(m.iter().map(|(k, s)| {
        let mut cles: Vec<String> = s.iter().cloned().collect();
        cles.sort_by(|a, b| cmp_utf16(a, b));
        jsval::tab(vec![jsval::s(k.clone()), jsval::tab(cles.into_iter().map(jsval::s).collect())])
    }).collect())
}

fn rendu(ix: &Index, types: &[String]) -> Valeur {
    jsval::o(vec![
        ("invalide", jsval::b(ix.invalide)),
        ("totaux", jsval::o(vec![("events", jsval::n(ix.events)), ("records", jsval::n(ix.records))])),
        ("types", jsval::tab(types.iter().cloned().map(jsval::s).collect())),
        ("parType", paires(&ix.par_type)),
        ("evNatif", paires(&ix.ev_natif)),
        ("recNatif", paires(&ix.rec_natif)),
    ])
}

/// Construction : une passe sur `events` et `records`, comme `construire`.
pub fn indexer(entree: &Valeur) -> Valeur {
    let (types, set) = types_de(a(entree, "types"));
    let ev = jsval::elements(a(entree, "events"));
    let rec = jsval::elements(a(entree, "records"));
    let mut ix = Index::vide();
    ix.events = ev.len() as f64;
    ix.records = rec.len() as f64;
    if ev.iter().any(|e| cle_evenement(e).is_none()) || rec.iter().any(|r| cle_visite(r).is_none()) {
        // Le magasin réel a une clé chaîne par objet. Une clé absente ou non chaîne invalide l'index,
        // comme `store.keys()` qui rendrait une clé non chaîne.
        ix.invalide = true;
    }
    for e in &ev { noter_evenement(&mut ix, e, &set); }
    for r in &rec { noter_visite(&mut ix, r); }
    rendu(&ix, &types)
}

fn appliquer_op(ix: &mut Index, op: &Valeur, types: &HashSet<String>) {
    let nom = chaine(a(op, "op")).unwrap_or("");
    match nom {
        "putEvent" => {
            let e = a(op, "e");
            if est_objet(e) && chaine(a(e, "eventId")).is_none() { ix.invalide = true; }
            noter_evenement(ix, e, types);
            ix.events += 1.0;
        }
        "putRecord" => {
            let r = a(op, "r");
            if est_objet(r) && cle_visite(r).is_none() { ix.invalide = true; }
            noter_visite(ix, r);
            ix.records += 1.0;
        }
        "deleteEvent" => {
            let ids = chaine(a(op, "id")).map(|s| vec![s.to_string()]).unwrap_or_default();
            retirer_une(&mut ix.par_type, &ids);
            retirer_une(&mut ix.ev_natif, &ids);
        }
        "deleteRecord" => {
            let ids = chaine(a(op, "id")).map(|s| vec![s.to_string()]).unwrap_or_default();
            retirer_une(&mut ix.rec_natif, &ids);
        }
        "deleteMany" | "deleteIfUnchanged" => {
            let magasin = chaine(a(op, "nom")).unwrap_or("");
            let ids = if nom == "deleteMany" { liste_chaines(a(op, "ids")) } else { liste_chaines(a(op, "supprimes")) };
            if magasin == "events" { retirer_une(&mut ix.par_type, &ids); retirer_une(&mut ix.ev_natif, &ids); }
            else if magasin == "records" { retirer_une(&mut ix.rec_natif, &ids); }
        }
        "clearAll" => {
            ix.par_type.clear();
            ix.ev_natif.clear();
            ix.rec_natif.clear();
            ix.events = 0.0;
            ix.records = 0.0;
        }
        _ => { ix.invalide = true; }
    }
}

/// Rejoue des écritures et suppressions sur un index construit, ou à vide si `base` est absent.
pub fn appliquer(entree: &Valeur) -> Valeur {
    let (types, set) = types_de(a(entree, "types"));
    let mut ix = if est_objet(a(entree, "events")) || jsval::est_tableau(a(entree, "events")) || jsval::est_tableau(a(entree, "records")) {
        // Reconstruit depuis le corpus puis applique. Le résultat de `indexer` n'est pas réinjecté : on refait la passe.
        let ev = jsval::elements(a(entree, "events"));
        let rec = jsval::elements(a(entree, "records"));
        let mut ix = Index::vide();
        ix.events = ev.len() as f64;
        ix.records = rec.len() as f64;
        if ev.iter().any(|e| cle_evenement(e).is_none()) || rec.iter().any(|r| !est_objet(r) || cle_visite(r).is_none() && est_objet(r)) {
            if ev.iter().any(|e| !est_objet(e) || cle_evenement(e).is_none()) { ix.invalide = true; }
        }
        for e in &ev { noter_evenement(&mut ix, e, &set); }
        for r in &rec { noter_visite(&mut ix, r); }
        ix
    } else {
        Index::vide()
    };
    for op in jsval::elements(a(entree, "ops")) { appliquer_op(&mut ix, op, &set); }
    rendu(&ix, &types)
}

/// Clés triées d'une session, comme `clesNatif` quand l'index est sûr.
pub fn cles_natif(entree: &Valeur) -> Result<Valeur, ariane_js::Echec> {
    let sid = chaine(a(entree, "sid")).ok_or_else(|| ariane_js::Echec::hors_domaine("sid absent"))?;
    let ix = indexer(entree);
    // indexer a déjà trié. On extrait.
    let prendre = |nom: &str| -> Vec<Valeur> {
        for e in jsval::elements(a(&ix, nom)) {
            let Valeur::Tableau(p) = e else { continue };
            if chaine(p.first().and_then(|x| x.as_ref()).unwrap_or(&Valeur::Indefini)) == Some(sid) {
                return match p.get(1).and_then(|x| x.as_ref()) { Some(Valeur::Tableau(t)) => t.iter().filter_map(std::clone::Clone::clone).collect(), _ => vec![] };
            }
        }
        vec![]
    };
    let ev = prendre("evNatif");
    let rec = prendre("recNatif");
    Ok(jsval::o(vec![
        ("events", jsval::tab(ev)),
        ("records", jsval::tab(rec)),
        ("invalide", a(&ix, "invalide").clone()),
        ("totaux", a(&ix, "totaux").clone()),
    ]))
}

/// Union triée des clés de plusieurs types. Erreur si un type n'est pas indexé (même message que le JS).
pub fn cles_par_type(entree: &Valeur) -> Result<Valeur, ariane_js::Echec> {
    let (types, set) = types_de(a(entree, "types"));
    for t in jsval::elements(a(entree, "demandes")) {
        let nom = chaine(t).unwrap_or("");
        if !set.contains(nom) {
            return Err(ariane_js::Echec::erreur(format!("Type non indexé : {nom}")));
        }
    }
    let ix = indexer(entree);
    let mut u = HashSet::new();
    let demandes: HashSet<&str> = jsval::elements(a(entree, "demandes")).into_iter().filter_map(chaine).collect();
    for e in jsval::elements(a(&ix, "parType")) {
        let Valeur::Tableau(p) = e else { continue };
        let k = chaine(p.first().and_then(|x| x.as_ref()).unwrap_or(&Valeur::Indefini)).unwrap_or("");
        if demandes.contains(k) {
            if let Some(Valeur::Tableau(t)) = p.get(1).and_then(|x| x.as_ref()) {
                for c in t { if let Some(s) = c.as_ref().and_then(chaine) { u.insert(s.to_string()); } }
            }
        }
    }
    let mut cles: Vec<String> = u.into_iter().collect();
    cles.sort_by(|a, b| cmp_utf16(a, b));
    let _ = types;
    Ok(jsval::tab(cles.into_iter().map(jsval::s).collect()))
}
