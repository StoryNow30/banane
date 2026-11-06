//! Port de `src/correction-liste.js` (module pur).
use crate::date::{self, parse_iso};
use crate::jsval::{self, a, chaine, cmp_nombre, est_entier, est_objet, nombre, vrai};
use ariane_vba::Valeur;
use std::cmp::Ordering;
use std::collections::HashMap;

const SIGNAUX: [&str; 6] = ["passe-ecrite", "apres-differe", "sans-appui", "garde-suivant", "relecture", "differe"];
const FIN_APRES_ARRET_S: f64 = 5.0;
const DEPART_VERT_S: f64 = 30.0;

fn instant(e: &Valeur) -> Option<f64> {
    let t = a(e, "timestamp");
    let s = match t { Valeur::Chaine(s) => s.as_str(), _ => "" };
    if s.is_empty() { return None; }
    parse_iso(s).filter(|x| x.is_finite())
}
fn cut_de(e: &Valeur) -> Option<f64> {
    let c = a(a(e, "identity"), "cut");
    if est_entier(c) { nombre(c) } else { None }
}
fn de_partie(e: &Valeur, part: &Valeur) -> bool {
    let id = a(e, "identity");
    vrai(id) && jsval::strict_eq(a(id, "part"), part) && est_entier(a(id, "cut"))
}
fn arr1(v: Option<f64>) -> Valeur {
    match v { Some(x) if x.is_finite() => jsval::n(ariane_js::round(x * 10.0) / 10.0), _ => jsval::nul() }
}
fn max_decal(d: &Valeur) -> Option<f64> {
    let mut m: Option<f64> = None;
    for cote in ["left", "right"] {
        if let Some(t) = jsval::comme_liste(a(d, cote)) {
            for x in &t {
                if let Some(v) = nombre(x) {
                    if v.is_finite() {
                        let a = v.abs();
                        m = Some(match m { None => ariane_js::max(0.0, a), Some(p) => ariane_js::max(p, a) });
                    }
                }
            }
        }
    }
    m
}

struct Lot<'a> { ev: Vec<usize>, b: String, t0: f64, fin: f64, part: Valeur, src: &'a [Valeur] }

fn evenements(v: &Valeur) -> Vec<&Valeur> { jsval::elements(v) }

fn lot_de<'a>(events: &'a [Valeur], partie: &Valeur, batch_id: Option<&str>) -> Option<Lot<'a>> {
    let mut idx: Vec<usize> = (0..events.len()).filter(|&i| instant(&events[i]).is_some()).collect();
    idx.sort_by(|&i, &j| cmp_nombre(instant(&events[i]).unwrap(), instant(&events[j]).unwrap()));
    let departs: Vec<usize> = idx.iter().copied().filter(|&i| {
        let e = &events[i];
        chaine(a(e, "type")) == Some("batch-started") && est_objet(a(e, "batch")) && chaine(a(a(e, "batch"), "id")).is_some()
    }).collect();
    let mut decisions: HashMap<String, f64> = HashMap::new();
    for &i in &idx {
        let e = &events[i];
        if chaine(a(e, "type")) == Some("gcv1-shadow-observed") {
            if let Some(id) = chaine(a(e, "batchId")) { *decisions.entry(id.to_string()).or_insert(0.0) += 1.0; }
        }
    }
    let mien = if let Some(bid) = batch_id {
        departs.iter().copied().filter(|&i| chaine(a(a(&events[i], "batch"), "id")) == Some(bid)).last()
    } else {
        let de_part: Vec<usize> = departs.iter().copied().filter(|&i| jsval::strict_eq(a(a(&events[i], "identity"), "part"), partie)).collect();
        let mut m: Option<usize> = None;
        for i in de_part {
            let id = chaine(a(a(&events[i], "batch"), "id")).unwrap();
            let d = *decisions.get(id).unwrap_or(&0.0);
            let mieux = match m {
                None => true,
                Some(j) => {
                    let jd = *decisions.get(chaine(a(a(&events[j], "batch"), "id")).unwrap()).unwrap_or(&0.0);
                    d >= jd
                }
            };
            if mieux { m = Some(i); }
        }
        m
    }?;
    let e = &events[mien];
    let b = chaine(a(a(e, "batch"), "id")).unwrap().to_string();
    let t0 = instant(e)?;
    let part = if est_entier(partie) { partie.clone() } else {
        let id = a(e, "identity");
        if !vrai(id) { if matches!(id, Valeur::Nul) { Valeur::Nul } else { Valeur::Indefini } } else { a(id, "part").clone() }
    };
    let mut fin = f64::INFINITY;
    if let Some(&s) = departs.iter().find(|&&i| instant(&events[i]).unwrap() > t0 && chaine(a(a(&events[i], "batch"), "id")) != Some(b.as_str())) {
        fin = instant(&events[s]).unwrap();
    }
    if let Some(&ar) = idx.iter().find(|&&i| {
        let ev = &events[i];
        chaine(a(ev, "type")) == Some("batch-stopped-at-end") && instant(ev).unwrap() > t0 && instant(ev).unwrap() < fin
    }) {
        fin = ariane_js::min(fin, instant(&events[ar]).unwrap() + FIN_APRES_ARRET_S * 1000.0);
    } else if let Some(&rel) = idx.iter().find(|&&i| chaine(a(&events[i], "type")) == Some("relecture-debut") && chaine(a(&events[i], "batchId")) == Some(b.as_str())) {
        fin = ariane_js::min(fin, instant(&events[rel]).unwrap());
    }
    Some(Lot { ev: idx, b, t0, fin, part, src: events })
}

struct Acc { signaux: Vec<&'static str>, details: Vec<(String, Valeur)> }
impl Acc {
    fn ajoute(&mut self, cle: &'static str, detail: Option<Valeur>) {
        if !self.signaux.contains(&cle) { self.signaux.push(cle); }
        if let Some(d) = detail {
            if let Some(p) = self.details.iter_mut().find(|(k, _)| k == cle) { p.1 = d; } else { self.details.push((cle.into(), d)); }
        }
    }
}

fn bit_cut(c: f64) -> u64 { c.to_bits() }

pub fn construire(events: &Valeur, options: &Valeur) -> Valeur {
    let ev = evenements(events);
    let owned: Vec<Valeur> = ev.into_iter().cloned().collect();
    let partie = a(options, "partie");
    let batch = chaine(a(options, "batchId"));
    let Some(lot) = lot_de(&owned, partie, batch) else {
        return jsval::o(vec![
            ("version", jsval::s("correction-liste-1")),
            ("trouve", jsval::b(false)),
            ("partie", jsval::ou_nul(partie)),
            ("batchId", jsval::ou_nul(a(options, "batchId"))),
            ("entrees", jsval::tab(vec![])),
            ("comptes", jsval::nul()),
        ]);
    };
    let part = &lot.part;
    let mut shadow: HashMap<u64, usize> = HashMap::new();
    let mut cibles_ordre: Vec<f64> = vec![];
    let mut cibles: HashMap<u64, f64> = HashMap::new();
    for &i in &lot.ev {
        let e = &owned[i];
        if chaine(a(e, "type")) == Some("gcv1-shadow-observed") && chaine(a(e, "batchId")) == Some(lot.b.as_str()) && de_partie(e, part) {
            let c = cut_de(e).unwrap();
            let k = bit_cut(c);
            if !cibles.contains_key(&k) { cibles_ordre.push(c); }
            cibles.insert(k, c);
            shadow.insert(k, i);
        }
    }
    for &i in &lot.ev {
        let e = &owned[i];
        if chaine(a(e, "type")) == Some("capture-abandoned") && chaine(a(e, "reason")) == Some("depart-sur-vert") && de_partie(e, part) {
            let t = instant(e).unwrap();
            if t >= lot.t0 && t <= lot.t0 + DEPART_VERT_S * 1000.0 {
                if let Some(c) = cut_de(e) { cibles.remove(&bit_cut(c)); }
            }
        }
    }
    let mut poses: HashMap<u64, f64> = HashMap::new();
    for &i in &lot.ev {
        let e = &owned[i];
        let t = instant(e).unwrap();
        if chaine(a(e, "type")) == Some("esv-observation") && chaine(a(e, "kind")) == Some("write") && t >= lot.t0 && t < lot.fin {
            if let Some(st) = nombre(a(e, "status")) {
                if est_entier(&jsval::n(st)) && (200.0..300.0).contains(&st)
                    && chaine(a(a(e, "body"), "ExtractionStatus")) == Some("valid")
                    && matches!(a(a(e, "body"), "TreatedByOperator"), Valeur::Booleen(true))
                {
                    if let Some(row) = nombre(a(e, "rowIndex")) {
                        if est_entier(&jsval::n(row)) && cibles.contains_key(&bit_cut(row)) { poses.insert(bit_cut(row), row); }
                    }
                }
            }
        }
    }
    let mut passe: HashMap<u64, usize> = HashMap::new();
    for &i in &lot.ev {
        let e = &owned[i];
        if chaine(a(e, "type")) == Some("passe-differes-ecriture") && chaine(a(e, "resultat")) == Some("ecrit")
            && (chaine(a(e, "batchId")) == Some(lot.b.as_str()) || chaine(a(e, "lotId")) == Some(lot.b.as_str()))
            && de_partie(e, part) && instant(e).unwrap() >= lot.t0
        {
            if let Some(c) = cut_de(e) {
                if cibles.contains_key(&bit_cut(c)) { passe.insert(bit_cut(c), i); }
            }
        }
    }
    for k in passe.keys() { poses.remove(k); }
    let mut differes: Vec<f64> = cibles.values().copied().filter(|c| !poses.contains_key(&bit_cut(*c)) && !passe.contains_key(&bit_cut(*c))).collect();
    let mut sig: HashMap<u64, Acc> = HashMap::new();
    let mut ordre_sig: Vec<f64> = vec![];
    let mut touche = |cut: f64, sig: &mut HashMap<u64, Acc>, ordre: &mut Vec<f64>, cle: &'static str, detail: Option<Valeur>| {
        let k = bit_cut(cut);
        if !sig.contains_key(&k) { ordre.push(cut); sig.insert(k, Acc { signaux: vec![], details: vec![] }); }
        sig.get_mut(&k).unwrap().ajoute(cle, detail);
    };
    let mut garde: HashMap<u64, usize> = HashMap::new();
    for &i in &lot.ev {
        let e = &owned[i];
        if chaine(a(e, "type")) == Some("garde-apres-differe") && chaine(a(e, "batchId")) == Some(lot.b.as_str()) && de_partie(e, part) {
            if let Some(c) = cut_de(e) { garde.insert(bit_cut(c), i); }
        }
    }
    for c in differes.iter().copied() {
        let sh = shadow.get(&bit_cut(c)).map(|&i| &owned[i]);
        let l = sh.map(|e| a(e, "lotObservation")).unwrap_or(&Valeur::Indefini);
        let cmd = a(l, "command");
        let motif = if garde.contains_key(&bit_cut(c)) {
            jsval::s("garde-apres-differe")
        } else if let Some(r) = chaine(a(cmd, "reason")) {
            jsval::s(r)
        } else if let Some(st) = chaine(a(l, "stage")) {
            jsval::s(st)
        } else {
            jsval::nul()
        };
        touche(c, &mut sig, &mut ordre_sig, "differe", Some(jsval::o(vec![("motif", motif)])));
    }
    for (&k, &i) in &passe {
        let e = &owned[i];
        let c = poses_cut(k);
        touche(c, &mut sig, &mut ordre_sig, "passe-ecrite", Some(jsval::o(vec![("decalMm", arr1(max_decal(a(e, "decal"))))])));
    }
    for c in poses.values().copied() {
        let sh = shadow.get(&bit_cut(c)).map(|&i| &owned[i]);
        let l = sh.map(|e| a(e, "lotObservation")).unwrap_or(&Valeur::Indefini);
        let cmd = a(l, "command");
        let appuis = if let Some(t) = jsval::comme_liste(a(l, "anchorsUsed")) {
            Some(t.len() as f64)
        } else if est_objet(a(l, "l1")) && est_objet(a(a(l, "l1"), "chaine")) {
            let v = a(a(a(l, "l1"), "chaine"), "appuis");
            if let Some(x) = nombre(v) { if x.is_finite() { Some(x) } else { None } } else { None }
        } else { None };
        let mut r1 = vec![];
        for k in [1.0, 2.0] {
            let pred = c - k;
            if differes.iter().any(|d| d.to_bits() == pred.to_bits()) || passe.contains_key(&bit_cut(pred)) { r1.push(pred); }
        }
        let par_le_lot = chaine(a(cmd, "action")) == Some("lot");
        if !r1.is_empty() {
            touche(c, &mut sig, &mut ordre_sig, "apres-differe", Some(jsval::o(vec![("differes", jsval::tab(r1.iter().copied().map(jsval::n).collect()))])));
        }
        if appuis == Some(0.0) && (!r1.is_empty() || par_le_lot) {
            let raison = chaine(a(cmd, "reason")).map(jsval::s).unwrap_or(jsval::nul());
            touche(c, &mut sig, &mut ordre_sig, "sans-appui", Some(jsval::o(vec![("commande", raison)])));
        }
    }
    for &i in &lot.ev {
        let e = &owned[i];
        if chaine(a(e, "type")) == Some("garde-apres-differe-suivant") && chaine(a(e, "batchId")) == Some(lot.b.as_str()) && de_partie(e, part) {
            if let Some(c) = cut_de(e) {
                if poses.contains_key(&bit_cut(c)) {
                    let cg = match jsval::comme_liste(a(e, "cutsGarde")) {
                        Some(t) => jsval::tab(t.into_iter().take(4).collect()),
                        None => jsval::tab(vec![]),
                    };
                    touche(c, &mut sig, &mut ordre_sig, "garde-suivant", Some(jsval::o(vec![("cutsGarde", cg)])));
                }
            }
        }
    }
    let hors = vrai(a(options, "relectureHorsLot"));
    for &i in &lot.ev {
        let e = &owned[i];
        if chaine(a(e, "type")) == Some("relecture-ombre")
            && (chaine(a(e, "batchId")) == Some(lot.b.as_str()) || chaine(a(e, "lotId")) == Some(lot.b.as_str()))
            && de_partie(e, part) && chaine(a(e, "verdict")) == Some("je corrigerais") && chaine(a(e, "action")) != Some("corrige")
        {
            if let Some(c) = cut_de(e) {
                if hors || poses.contains_key(&bit_cut(c)) || passe.contains_key(&bit_cut(c)) {
                    touche(c, &mut sig, &mut ordre_sig, "relecture", Some(jsval::o(vec![("pireMm", arr1(nombre(a(e, "pireMm"))))])));
                }
            }
        }
    }
    let mut entrees: Vec<(f64, String, Vec<&'static str>, Vec<(String, Valeur)>, f64)> = ordre_sig.into_iter().map(|c| {
        let acc = sig.remove(&bit_cut(c)).unwrap();
        let signaux: Vec<&str> = SIGNAUX.iter().copied().filter(|k| acc.signaux.contains(k)).collect();
        let force = signaux.iter().map(|k| SIGNAUX.iter().position(|s| s == k).unwrap() as f64).fold(f64::INFINITY, ariane_js::min);
        let groupe = if signaux.contains(&"differe") { "poser" } else { "corriger" };
        (c, groupe.into(), signaux, acc.details, force)
    }).collect();
    entrees.sort_by(|a, b| {
        let g = if a.1 == b.1 { Ordering::Equal } else if a.1 == "corriger" { Ordering::Less } else { Ordering::Greater };
        g.then_with(|| cmp_nombre(a.4, b.4)).then_with(|| cmp_nombre(b.2.len() as f64, a.2.len() as f64)).then_with(|| cmp_nombre(a.0, b.0))
    });
    let n_entrees = entrees.len();
    let mut a_corriger = 0.0;
    let mut a_poser = 0.0;
    let mut par = [0.0f64; 6];
    let liste: Vec<Valeur> = entrees.iter().enumerate().map(|(i, (c, groupe, signaux, details, _))| {
        if groupe == "corriger" { a_corriger += 1.0; } else { a_poser += 1.0; }
        for (k, nom) in SIGNAUX.iter().enumerate() { if signaux.contains(nom) { par[k] += 1.0; } }
        jsval::o(vec![
            ("part", part.clone()),
            ("cut", jsval::n(*c)),
            ("groupe", jsval::s(groupe.clone())),
            ("signaux", jsval::tab(signaux.iter().copied().map(jsval::s).collect())),
            ("details", Valeur::Objet(details.clone())),
            ("rang", jsval::n((i + 1) as f64)),
        ])
    }).collect();
    let par_signal = Valeur::Objet(SIGNAUX.iter().enumerate().map(|(i, k)| ((*k).into(), jsval::n(par[i]))).collect());
    let mut comptes = vec![
        ("cibles".into(), jsval::n(cibles.len() as f64)),
        ("poses".into(), jsval::n((poses.len() + passe.len()) as f64)),
        ("differes".into(), jsval::n(differes.len() as f64)),
        ("aCorriger".into(), jsval::n(a_corriger)),
        ("aPoser".into(), jsval::n(a_poser)),
        ("parSignal".into(), par_signal),
    ];
    let _ = n_entrees;
    let mut sortie = vec![
        ("version".into(), jsval::s("correction-liste-1")),
        ("trouve".into(), jsval::b(true)),
        ("partie".into(), part.clone()),
        ("batchId".into(), jsval::s(&lot.b)),
        ("debut".into(), jsval::s(date::vers_iso(lot.t0).unwrap_or_default())),
        ("entrees".into(), jsval::tab(liste)),
    ];
    if vrai(a(options, "population")) {
        let mut p: Vec<f64> = poses.values().copied().chain(passe.keys().copied().map(poses_cut)).collect();
        p.sort_by(|a, b| cmp_nombre(*a, *b));
        differes.sort_by(|a, b| cmp_nombre(*a, *b));
        sortie.push(("population".into(), jsval::o(vec![
            ("poses", jsval::tab(p.into_iter().map(jsval::n).collect())),
            ("differes", jsval::tab(differes.iter().copied().map(jsval::n).collect())),
        ])));
    }
    sortie.push(("comptes".into(), Valeur::Objet(comptes)));
    Valeur::Objet(sortie)
}

fn poses_cut(bits: u64) -> f64 { f64::from_bits(bits) }
fn est_tableau(v: &Valeur) -> bool { matches!(v, Valeur::Tableau(_)) }

pub fn statut_de(entree: &Valeur, visites: &Valeur) -> Valeur {
    let part = a(entree, "part");
    let cut = a(entree, "cut");
    let v: Vec<&Valeur> = jsval::elements(visites).into_iter().filter(|x| {
        vrai(a(x, "identity")) && jsval::strict_eq(a(a(x, "identity"), "part"), part) && jsval::strict_eq(a(a(x, "identity"), "cut"), cut)
    }).collect();
    if v.is_empty() { return jsval::o(vec![("statut", jsval::s("a-faire")), ("visites", jsval::n(0.0))]); }
    let force = |s: &str| match s { "corrige" => 4, "valide" => 3, "en-cours" => 2, _ => 1 };
    let statut_visite = |x: &Valeur| {
        let l = chaine(a(x, "label")).unwrap_or("");
        if l.starts_with("VALIDATE_CORRECTED") { "corrige" } else if l == "VALIDATE_NO_MOVEMENT" { "valide" } else if l.is_empty() && vrai(a(x, "encours")) { "en-cours" } else { "vu" }
    };
    let mut best = v[0];
    let mut st = statut_visite(best);
    for x in v.iter().copied() {
        let s = statut_visite(x);
        if force(s) >= force(st) { best = x; st = s; }
    }
    let n = v.len() as f64;
    let visit_id = a(best, "visitId").clone();
    let visit_id = if matches!(visit_id, Valeur::Indefini) { jsval::nul() } else { visit_id };
    if st == "en-cours" {
        return jsval::o(vec![("statut", jsval::s("en-cours")), ("visites", jsval::n(n)), ("visitId", visit_id)]);
    }
    let l = chaine(a(best, "label")).unwrap_or("");
    let rails = if l.contains("BOTH") { 2.0 } else if l.starts_with("VALIDATE_CORRECTED") { 1.0 } else { 0.0 };
    jsval::o(vec![
        ("statut", jsval::s(st)),
        ("visites", jsval::n(n)),
        ("visitId", visit_id),
        ("label", if l.is_empty() { jsval::nul() } else { jsval::s(l) }),
        ("rails", jsval::n(rails)),
    ])
}

pub fn visites_fusionnees(visites: &Valeur, options: &Valeur) -> Valeur {
    let v: Vec<&Valeur> = jsval::elements(visites).into_iter().filter(|x| vrai(a(x, "identity"))).collect();
    let issues = a(options, "issues");
    let echo = vrai(a(options, "echoOuvert"));
    let n = v.len();
    jsval::tab(v.iter().enumerate().map(|(i, x)| {
        let vid = a(x, "visitId");
        let p = if chaine(a(x, "label")).unwrap_or("").is_empty() {
            chaine(vid).and_then(|id| chaine(a(issues, id))).map(|s| s.to_string())
        } else { None };
        let label = if let Some(l) = chaine(a(x, "label")) { if !l.is_empty() { Some(l.to_string()) } else { p.clone() } } else { p.clone() };
        // `v.label || p || null`
        let label = match a(x, "label") {
            Valeur::Chaine(s) if !s.is_empty() => jsval::s(s.clone()),
            _ => p.clone().map(jsval::s).unwrap_or(jsval::nul()),
        };
        let encours = !vrai(a(x, "endedAt")) && i + 1 == n && echo;
        jsval::o(vec![
            ("visitId", if matches!(vid, Valeur::Indefini) { jsval::nul() } else { vid.clone() }),
            ("identity", a(x, "identity").clone()),
            ("label", label),
            ("encours", jsval::b(encours)),
            ("provisoire", jsval::b(p.is_some())),
        ])
    }).collect())
}

pub fn apprenabilite(rec: &Valeur) -> Valeur {
    if !est_objet(rec) { return jsval::o(vec![("apprenable", jsval::b(false)), ("pertes", jsval::tab(vec![jsval::s("enregistrement-absent")]))]); }
    let intents: Vec<&Valeur> = jsval::elements(a(rec, "operatorIntents")).into_iter().filter(|x| chaine(a(x, "intent")) == Some("VALIDATE")).collect();
    if intents.is_empty() { return jsval::o(vec![("apprenable", jsval::b(false)), ("pertes", jsval::tab(vec![jsval::s("sans-validation")]))]); }
    let mut pertes = vec![];
    let e = a(rec, "geometryEligibility");
    for (c, nom) in [("left", "gauche"), ("right", "droite")] {
        if chaine(a(a(e, c), "status")) != Some("comparable-candidate") { pertes.push(format!("etat-initial-{nom}")); }
    }
    if chaine(a(a(rec, "humanFinalReference"), "status")) != Some("candidate-observed") { pertes.push("reference-humaine".into()); }
    let stockes: std::collections::HashSet<&str> = jsval::elements(a(rec, "lidarCaptureIds")).into_iter().filter_map(chaine).collect();
    let voulus: Vec<&str> = ["left", "right"].into_iter().filter_map(|c| {
        let side = a(e, c);
        if chaine(a(side, "status")) == Some("comparable-candidate") { chaine(a(side, "captureId")) } else { None }
    }).collect();
    if stockes.is_empty() || voulus.iter().any(|i| !stockes.contains(i)) { pertes.push("nuage".into()); }
    if matches!(a(rec, "multiIntent"), Valeur::Booleen(true)) || intents.len() > 1 || vrai(a(rec, "intentCollapse")) {
        pertes.push("intention-ambigue".into());
    }
    jsval::o(vec![
        ("apprenable", jsval::b(pertes.is_empty())),
        ("pertes", jsval::tab(pertes.into_iter().map(jsval::s).collect())),
    ])
}

pub fn bilan(entrees: &Valeur, visites: &Valeur, enregistrements: &Valeur) -> Valeur {
    let mut c = [("a-faire", 0.0), ("en-cours", 0.0), ("corrige", 0.0), ("valide", 0.0), ("vu", 0.0)];
    let avec = est_objet(enregistrements);
    let mut apprenables = 0.0;
    let lignes: Vec<Valeur> = jsval::elements(entrees).into_iter().map(|e| {
        let s = statut_de(e, visites);
        let st = chaine(a(&s, "statut")).unwrap_or("vu").to_string();
        if let Some(p) = c.iter_mut().find(|(k, _)| *k == st) { p.1 += 1.0; }
        let mut ligne = vec![
            ("part".into(), a(e, "part").clone()),
            ("cut".into(), a(e, "cut").clone()),
            ("groupe".into(), a(e, "groupe").clone()),
            ("signaux".into(), a(e, "signaux").clone()),
        ];
        if let Valeur::Objet(t) = s { for (k, v) in t { if ligne.iter().all(|(c, _)| c != &k) { ligne.push((k, v)); } } }
        if avec && matches!(st.as_str(), "corrige" | "valide") {
            if let Some(id) = chaine(a(&Valeur::Objet(ligne.clone()), "visitId")) {
                let ap = apprenabilite(a(enregistrements, id));
                if matches!(a(&ap, "apprenable"), Valeur::Booleen(true)) { apprenables += 1.0; }
                if let Valeur::Objet(t) = ap { for (k, v) in t { ligne.push((k, v)); } }
            }
        }
        Valeur::Objet(ligne)
    }).collect();
    let mut comptes = vec![
        ("total".into(), jsval::n(lignes.len() as f64)),
        ("a-faire".into(), jsval::n(c[0].1)),
        ("en-cours".into(), jsval::n(c[1].1)),
        ("corrige".into(), jsval::n(c[2].1)),
        ("valide".into(), jsval::n(c[3].1)),
        ("vu".into(), jsval::n(c[4].1)),
        ("traites".into(), jsval::n(c[2].1 + c[3].1)),
    ];
    if avec { comptes.push(("apprenables".into(), jsval::n(apprenables))); }
    jsval::o(vec![("lignes", jsval::tab(lignes)), ("comptes", Valeur::Objet(comptes))])
}

pub fn parcours(listes: &Valeur, options: &Valeur) -> Valeur {
    let mut parts: Vec<f64> = vec![];
    let mut par: HashMap<u64, Vec<(f64, String)>> = HashMap::new();
    for l in jsval::elements(listes) {
        for x in jsval::elements(a(l, "lignes")) {
            let p = a(x, "part");
            let c = a(x, "cut");
            if !est_entier(p) || !est_entier(c) { continue; }
            let (pf, cf) = (nombre(p).unwrap(), nombre(c).unwrap());
            let m = par.entry(bit_cut(pf)).or_default();
            if !parts.contains(&pf) { parts.push(pf); }
            if m.iter().all(|(k, _)| k.to_bits() != cf.to_bits()) {
                m.push((cf, chaine(a(x, "statut")).unwrap_or("a-faire").to_string()));
            }
        }
    }
    let mut ordre = vec![];
    for p in &parts {
        let mut cuts = par.get(&bit_cut(*p)).cloned().unwrap_or_default();
        cuts.sort_by(|a, b| cmp_nombre(a.0, b.0));
        for (c, st) in cuts { ordre.push((*p, c, st)); }
    }
    let courant = a(options, "courant");
    let c_ok = est_entier(a(courant, "part")) && est_entier(a(courant, "cut"));
    let (cp, cc) = if c_ok { (nombre(a(courant, "part")), nombre(a(courant, "cut"))) } else { (None, None) };
    let depart = if let Some(p) = cp { p } else if est_entier(a(options, "partieAffichee")) { nombre(a(options, "partieAffichee")).unwrap() } else { f64::NAN };
    let i0 = if depart.is_finite() { parts.iter().position(|p| p.to_bits() == depart.to_bits()) } else { None };
    let tour: Vec<f64> = match i0 { Some(i) => parts[i..].iter().chain(parts[..i].iter()).copied().collect(), None => parts.clone() };
    let ouvert = |p: f64, c: f64| c_ok && cp.unwrap().to_bits() == p.to_bits() && cc.unwrap().to_bits() == c.to_bits();
    let mut suivant = jsval::nul();
    for p in &tour {
        let mut cuts: Vec<(f64, String)> = ordre.iter().filter(|x| x.0.to_bits() == p.to_bits() && x.2 == "a-faire" && !ouvert(x.0, x.1)).map(|x| (x.1, x.2.clone())).collect();
        let apres: Vec<(f64, String)> = if cp.map(|d| d.to_bits() == p.to_bits()).unwrap_or(false) && c_ok {
            cuts.iter().filter(|(c, _)| *c > cc.unwrap()).cloned().collect()
        } else { vec![] };
        let x = apres.first().cloned().or_else(|| cuts.first().cloned());
        if let Some((c, _)) = x { suivant = jsval::o(vec![("part", jsval::n(*p)), ("cut", jsval::n(c))]); break; }
        let _ = cuts;
    }
    let parties: Vec<Valeur> = parts.iter().map(|p| {
        let l: Vec<_> = ordre.iter().filter(|x| x.0.to_bits() == p.to_bits()).collect();
        let faits = l.iter().filter(|x| x.2 == "corrige" || x.2 == "valide").count() as f64;
        let reste = l.iter().any(|x| x.2 == "a-faire" || x.2 == "en-cours");
        let entamee = l.iter().any(|x| x.2 != "a-faire") || cp.map(|d| d.to_bits() == p.to_bits()).unwrap_or(false);
        let etat = if !reste { "faite" } else if entamee { "en-cours" } else { "a-faire" };
        jsval::o(vec![("partie", jsval::n(*p)), ("etat", jsval::s(etat)), ("faits", jsval::n(faits)), ("total", jsval::n(l.len() as f64))])
    }).collect();
    jsval::o(vec![
        ("version", jsval::s("correction-parcours-1")),
        ("ordre", jsval::tab(ordre.iter().map(|(p, c, _)| jsval::o(vec![("part", jsval::n(*p)), ("cut", jsval::n(*c))])).collect())),
        ("suivant", suivant),
        ("parties", jsval::tab(parties)),
    ])
}

pub fn couverture(events: &Valeur, options: &Valeur) -> Valeur {
    let owned: Vec<Valeur> = jsval::elements(events).into_iter().cloned().collect();
    let mut idx: Vec<usize> = (0..owned.len()).filter(|&i| instant(&owned[i]).is_some()).collect();
    idx.sort_by(|&i, &j| cmp_nombre(instant(&owned[i]).unwrap(), instant(&owned[j]).unwrap()));
    let max = nombre(a(options, "max")).filter(|m| est_entier(&jsval::n(*m)) && *m > 0.0).unwrap_or(16.0) as usize;
    let mut vus: Vec<(String, f64, String)> = vec![];
    for &i in &idx {
        let e = &owned[i];
        if chaine(a(e, "type")) == Some("batch-started") {
            let id = chaine(a(a(e, "batch"), "id"));
            let part = a(a(e, "identity"), "part");
            if let Some(id) = id {
                if est_entier(part) && vus.iter().all(|(b, _, _)| b != id) && chaine(a(options, "lotOuvert")) != Some(id) {
                    vus.push((id.to_string(), nombre(part).unwrap(), chaine(a(e, "timestamp")).unwrap_or("").to_string()));
                }
            }
        }
    }
    if vus.len() > max { vus = vus.split_off(vus.len() - max); }
    let mut debuts: HashMap<String, (Vec<String>, f64)> = HashMap::new();
    let mut fins: HashMap<String, usize> = HashMap::new();
    for &i in &idx {
        let e = &owned[i];
        if chaine(a(e, "type")) == Some("correction-debut") {
            if let Some(id) = chaine(a(e, "correctionId")) {
                if est_tableau(a(e, "batchIds")) {
                    let ids = jsval::elements(a(e, "batchIds")).into_iter().filter_map(chaine).map(|s| s.to_string()).collect();
                    debuts.insert(id.to_string(), (ids, instant(e).unwrap_or(0.0)));
                }
            }
        }
        if chaine(a(e, "type")) == Some("correction-fin") && chaine(a(e, "etat")) != Some("erreur") {
            if let Some(id) = chaine(a(e, "correctionId")) { fins.insert(id.to_string(), i); }
        }
    }
    let mut exclus: HashMap<String, (String, String, f64)> = HashMap::new();
    let mut traites: HashMap<String, (String, String, Option<String>, Vec<String>, f64)> = HashMap::new();
    for (id, &i) in &fins {
        let Some((bids, _)) = debuts.get(id) else { continue };
        let f = &owned[i];
        let raison = chaine(a(f, "raison")).unwrap_or("");
        if raison == "liste-finie" {
            for b in bids { exclus.insert(b.clone(), (id.clone(), raison.to_string(), instant(f).unwrap_or(0.0))); }
            continue;
        }
        for l in jsval::elements(a(f, "lignes")) {
            if est_entier(a(l, "part")) && est_entier(a(l, "cut")) {
                let st = chaine(a(l, "statut")).unwrap_or("");
                if st == "corrige" || st == "valide" {
                    let cle = format!("{}|{}", nombre(a(l, "part")).unwrap(), nombre(a(l, "cut")).unwrap());
                    traites.insert(cle, (id.clone(), st.to_string(), chaine(a(f, "raison")).map(|s| s.to_string()), bids.clone(), instant(f).unwrap_or(0.0)));
                }
            }
        }
    }
    // Rejoue construire pour chaque lot. On repasse le journal entier : même résultat que le JS.
    let mut par_lot = vec![];
    let mut decide: HashMap<u64, Vec<(f64, Option<Valeur>, String)>> = HashMap::new();
    let mut ordre_parts: Vec<f64> = vec![];
    for (bid, partie, debut) in &vus {
        let mut opt = vec![("batchId".into(), jsval::s(bid.clone())), ("population".into(), jsval::b(true))];
        let l = construire(&jsval::tab(owned.clone()), &Valeur::Objet(opt.clone()));
        if !matches!(a(&l, "trouve"), Valeur::Booleen(true)) { continue; }
        let part = nombre(a(&l, "partie")).unwrap_or(*partie);
        let mut liste = l.clone();
        if let Valeur::Objet(t) = &mut liste {
            if let Some(p) = t.iter_mut().find(|(k, _)| k == "population") { p.1 = Valeur::Indefini; }
        }
        par_lot.push((bid.clone(), part, debut.clone(), liste.clone()));
        if !decide.contains_key(&bit_cut(part)) { ordre_parts.push(part); decide.insert(bit_cut(part), vec![]); }
        let entrees_map: HashMap<u64, Valeur> = jsval::elements(a(&l, "entrees")).into_iter().filter_map(|e| nombre(a(e, "cut")).map(|c| (bit_cut(c), e.clone()))).collect();
        let pop = a(&l, "population");
        let mut cuts = vec![];
        for nom in ["poses", "differes"] {
            for c in jsval::elements(a(pop, nom)).into_iter().filter_map(nombre) { cuts.push(c); }
        }
        let d = decide.get_mut(&bit_cut(part)).unwrap();
        for c in cuts {
            d.retain(|(x, _, _)| x.to_bits() != c.to_bits());
            d.push((c, entrees_map.get(&bit_cut(c)).cloned(), bid.clone()));
        }
        let _ = opt;
    }
    let mut retires = vec![];
    let mut listes = vec![];
    let mut apres = 0.0;
    for p in &ordre_parts {
        let mut garde_e = vec![];
        for (cut, entree, bid) in decide.get(&bit_cut(*p)).cloned().unwrap_or_default() {
            let Some(entree) = entree else { continue };
            apres += 1.0;
            if exclus.contains_key(&bid) { continue; }
            let cle = format!("{p}|{cut}");
            if let Some((cid, st, fin, bids, _)) = traites.get(&cle) {
                if bids.iter().any(|b| b == &bid) {
                    retires.push(jsval::o(vec![
                        ("part", jsval::n(*p)), ("cut", jsval::n(cut)), ("batchId", jsval::s(&bid)),
                        ("correctionId", jsval::s(cid.clone())), ("statut", jsval::s(st.clone())),
                        ("fin", fin.clone().map(jsval::s).unwrap_or(jsval::nul())),
                    ]));
                    continue;
                }
            }
            let force = jsval::elements(a(&entree, "signaux")).into_iter().filter_map(chaine).map(|k| SIGNAUX.iter().position(|s| *s == k).unwrap_or(99) as f64).fold(f64::INFINITY, ariane_js::min);
            garde_e.push((cut, entree, bid, force));
        }
        let ids: Vec<String> = par_lot.iter().filter(|l| l.1.to_bits() == p.to_bits() && !exclus.contains_key(&l.0)).map(|l| l.0.clone()).collect();
        if ids.is_empty() { continue; }
        garde_e.sort_by(|pa, pb| {
            let ga = chaine(jsval::a(&pa.1, "groupe")).unwrap_or("");
            let gb = chaine(jsval::a(&pb.1, "groupe")).unwrap_or("");
            let g = if ga == gb { Ordering::Equal } else if ga == "corriger" { Ordering::Less } else { Ordering::Greater };
            let la = jsval::elements(jsval::a(&pa.1, "signaux")).len() as f64;
            let lb = jsval::elements(jsval::a(&pb.1, "signaux")).len() as f64;
            g.then_with(|| cmp_nombre(pa.3, pb.3)).then_with(|| cmp_nombre(lb, la)).then_with(|| cmp_nombre(pa.0, pb.0))
        });
        let entrees: Vec<Valeur> = garde_e.iter().enumerate().map(|(i, (_, e, bid, _))| {
            let mut o = match e.clone() { Valeur::Objet(t) => t, _ => vec![] };
            if let Some(p) = o.iter_mut().find(|(k, _)| k == "rang") { p.1 = jsval::n((i + 1) as f64); }
            else { o.push(("rang".into(), jsval::n((i + 1) as f64))); }
            if let Some(p) = o.iter_mut().find(|(k, _)| k == "batchId") { p.1 = jsval::s(bid.clone()); }
            else { o.push(("batchId".into(), jsval::s(bid.clone()))); }
            Valeur::Objet(o)
        }).collect();
        let ac = entrees.iter().filter(|e| chaine(a(e, "groupe")) == Some("corriger")).count() as f64;
        let ap = entrees.iter().filter(|e| chaine(a(e, "groupe")) == Some("poser")).count() as f64;
        listes.push(jsval::o(vec![
            ("partie", jsval::n(*p)),
            ("batchId", jsval::s(ids.last().cloned().unwrap_or_default())),
            ("batchIds", jsval::tab(ids.iter().cloned().map(jsval::s).collect())),
            ("entrees", jsval::tab(entrees)),
            ("comptes", jsval::o(vec![("lots", jsval::n(ids.len() as f64)), ("aCorriger", jsval::n(ac)), ("aPoser", jsval::n(ap))])),
        ]));
    }
    let ex: Vec<Valeur> = par_lot.iter().filter(|l| exclus.contains_key(&l.0)).map(|l| {
        let (cid, fin, _) = exclus.get(&l.0).unwrap();
        jsval::o(vec![
            ("batchId", jsval::s(&l.0)), ("partie", jsval::n(l.1)), ("raison", jsval::s("aurore-terminee")),
            ("correctionId", jsval::s(cid.clone())), ("fin", jsval::s(fin.clone())),
        ])
    }).collect();
    let lots: Vec<Valeur> = par_lot.iter().map(|l| jsval::o(vec![
        ("batchId", jsval::s(&l.0)), ("partie", jsval::n(l.1)), ("debut", jsval::s(&l.2)),
        ("entrees", jsval::n(jsval::elements(a(&l.3, "entrees")).len() as f64)),
        ("exclu", jsval::b(exclus.contains_key(&l.0))),
    ])).collect();
    let avant: f64 = par_lot.iter().fold(0.0, |s, l| s + jsval::elements(a(&l.3, "entrees")).len() as f64);
    let proposes: f64 = listes.iter().fold(0.0, |s, l| s + jsval::elements(a(l, "entrees")).len() as f64);
    let n_lots = par_lot.len() as f64;
    let par_lot_v: Vec<Valeur> = par_lot.into_iter().map(|(bid, part, debut, liste)| jsval::o(vec![
        ("batchId", jsval::s(bid)), ("partie", jsval::n(part)), ("debut", jsval::s(debut)), ("liste", liste),
    ])).collect();
    jsval::o(vec![
        ("version", jsval::s("correction-couverture-1")),
        ("listes", jsval::tab(listes)),
        ("parLot", jsval::tab(par_lot_v)),
        ("exclus", jsval::tab(ex.clone())),
        ("retires", jsval::tab(retires.clone())),
        ("lots", jsval::tab(lots)),
        ("comptes", jsval::o(vec![
            ("lots", jsval::n(n_lots)),
            ("avantFusion", jsval::n(avant)),
            ("apresFusion", jsval::n(apres)),
            ("proposes", jsval::n(proposes)),
            ("lotsExclus", jsval::n(ex.len() as f64)),
            ("cutsRetires", jsval::n(retires.len() as f64)),
        ])),
    ])
}
