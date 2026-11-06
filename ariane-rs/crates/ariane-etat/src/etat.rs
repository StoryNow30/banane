//! Port de `src/etat-morceaux.js` (module pur).
use crate::jsval::{self, a, est_objet, est_tableau, get, possede, svz, Svz};
use crate::json::{self, clone_json};
use ariane_js::Echec;
use ariane_vba::Valeur;
use std::collections::{HashMap, HashSet};

pub const VERSION: f64 = 1.0;
const PREFIXE: &str = "banane3Morceau|";
const REF: &str = "__morceaux";

struct Chemin { racine: &'static str, segments: &'static [&'static str], taille: usize, en_ligne: Option<&'static str> }

fn chemins() -> &'static [Chemin] {
    &[
        Chemin { racine: "native", segments: &["visits"], taille: 32, en_ligne: None },
        Chemin { racine: "native", segments: &["observationPeriods"], taille: 32, en_ligne: None },
        Chemin { racine: "native", segments: &["cloudIds"], taille: 512, en_ligne: Some("nonExportes") },
        Chemin { racine: "native", segments: &["incomplete"], taille: 512, en_ligne: None },
        Chemin { racine: "native", segments: &["exportState", "exportedCloudIds"], taille: 512, en_ligne: None },
        Chemin { racine: "native", segments: &["exportState", "releasedCloudIds"], taille: 512, en_ligne: None },
        Chemin { racine: "manual", segments: &["records"], taille: 16, en_ligne: None },
        Chemin { racine: "manual", segments: &["cloudIds"], taille: 512, en_ligne: None },
        Chemin { racine: "manual", segments: &["sequence"], taille: 32, en_ligne: None },
        Chemin { racine: "manual", segments: &["incomplete"], taille: 512, en_ligne: None },
        Chemin { racine: "batch", segments: &["processed"], taille: 32, en_ligne: None },
        Chemin { racine: "batch", segments: &["sequence"], taille: 32, en_ligne: None },
        Chemin { racine: "batch", segments: &["deferred"], taille: 32, en_ligne: None },
        Chemin { racine: "batch", segments: &["skipped"], taille: 32, en_ligne: None },
        Chemin { racine: "batch", segments: &["paused"], taille: 32, en_ligne: None },
        Chemin { racine: "batch", segments: &["interrupted"], taille: 32, en_ligne: None },
        Chemin { racine: "batch", segments: &["manuallyCompleted"], taille: 32, en_ligne: None },
        Chemin { racine: "native", segments: &["qualityRails"], taille: 512, en_ligne: None },
    ]
}

fn chemin_texte(c: &[&str]) -> String { c.join(".") }

pub fn cle_morceau(racine: &str, segments: &str, id: &str, i: usize) -> String {
    format!("{PREFIXE}{racine}|{segments}|{id}|{i}")
}
fn id_valide(id: &str) -> bool { !id.is_empty() && id.len() <= 128 && !id.contains('|') }

/// `===` : −0 et +0 sont égaux, NaN n'est égal à rien.
fn egal_js(a: &Valeur, b: &Valeur) -> bool {
    match (a, b) {
        (Valeur::Nombre(x), Valeur::Nombre(y)) => x == y,
        _ => jsval::strict_eq(a, b),
    }
}

fn lire<'a>(mut o: &'a Valeur, segments: &[&str]) -> &'a Valeur {
    for k in segments {
        o = match o { Valeur::Objet(_) => get(o, k).unwrap_or(&Valeur::Indefini), _ => &Valeur::Indefini };
    }
    o
}

fn elements_de(v: &Valeur) -> Option<(Vec<Valeur>, bool)> {
    if est_tableau(v) {
        let mut t = vec![];
        if let Valeur::Tableau(a) = v { for e in a { t.push(e.clone().unwrap_or(Valeur::Indefini)); } }
        return Some((t, false));
    }
    if est_objet(v) {
        // Object.entries : l'ordre reçu est déjà celui du moteur (l'encodeur VBA a pris Object.keys).
        let t = jsval::obj(v).unwrap().iter().map(|(k, x)| jsval::tab(vec![jsval::s(k.clone()), x.clone()])).collect();
        return Some((t, true));
    }
    None
}

fn etaler_objet(v: &Valeur) -> Vec<(String, Valeur)> {
    match v {
        Valeur::Objet(t) => t.clone(),
        Valeur::Tableau(t) => t.iter().enumerate().filter_map(|(i, e)| e.as_ref().map(|x| (i.to_string(), x.clone()))).collect(),
        _ => vec![],
    }
}

fn mettre(o: &mut Valeur, k: &str, v: Valeur) {
    let Valeur::Objet(t) = o else { return };
    if let Some(p) = t.iter_mut().find(|(c, _)| c == k) { p.1 = v; } else { t.push((k.into(), v)); }
}
fn retirer_cle(o: &mut Valeur, k: &str) {
    if let Valeur::Objet(t) = o { t.retain(|(c, _)| c != k); }
}
fn prendre_mut<'a>(o: &'a mut Valeur, k: &str) -> Option<&'a mut Valeur> {
    let Valeur::Objet(t) = o else { return None };
    t.iter_mut().find(|(c, _)| c == k).map(|(_, v)| v)
}

fn non_exportes(racine: &Valeur, liste: &[Valeur]) -> Vec<Valeur> {
    let faits: HashSet<Svz> = match get(racine, "exportState").and_then(|e| get(e, "exportedCloudIds")) {
        Some(Valeur::Tableau(t)) => t.iter().filter_map(|e| e.as_ref().and_then(svz)).collect(),
        _ => HashSet::new(),
    };
    liste.iter().filter(|id| svz(id).is_none_or(|k| !faits.contains(&k))).cloned().collect()
}

fn connus_de(v: &Valeur) -> HashMap<String, (String, Option<Vec<Valeur>>)> {
    let mut m = HashMap::new();
    let paires: Vec<(String, Valeur)> = match v {
        Valeur::Tableau(t) => t.iter().filter_map(|e| {
            let e = e.as_ref()?;
            let Valeur::Tableau(p) = e else { return None };
            let k = p.first()?.as_ref().and_then(|x| jsval::chaine(x)).map(std::string::ToString::to_string)?;
            Some((k, p.get(1).and_then(std::clone::Clone::clone).unwrap_or(Valeur::Indefini)))
        }).collect(),
        Valeur::Objet(t) => t.clone(),
        _ => vec![],
    };
    for (k, val) in paires {
        let texte = jsval::chaine(a(&val, "texte")).unwrap_or("").to_string();
        let simples = match get(&val, "simples") {
            Some(Valeur::Tableau(t)) => Some(t.iter().map(|e| e.clone().unwrap_or(Valeur::Indefini)).collect()),
            _ => None,
        };
        if !texte.is_empty() || simples.is_some() { m.insert(k, (texte, simples)); }
    }
    m
}

fn paires_map(m: &[(String, Valeur)]) -> Valeur {
    jsval::tab(m.iter().map(|(k, v)| jsval::tab(vec![jsval::s(k.clone()), v.clone()])).collect())
}

pub fn decouper(etat: &Valeur, connus: &Valeur) -> Result<Valeur, Echec> {
    if !vrai_objet_ou_tableau(etat) {
        return Ok(jsval::o(vec![
            ("etat", clone_json(etat)),
            ("morceaux", jsval::tab(vec![])),
            ("simples", jsval::tab(vec![])),
        ]));
    }
    // null est faux en JS (`!etat`) : déjà couvert. Un tableau entre dans la fonction.
    let mut copie = Valeur::Objet(etaler_objet(etat));
    let mut racines: HashMap<String, Valeur> = HashMap::new();
    let mut morceaux: Vec<(String, Valeur)> = vec![];
    let mut simples: Vec<(String, Valeur)> = vec![];
    let connus = connus_de(connus);
    for racine in ["native", "manual", "batch"] {
        if let Some(r) = get(etat, racine) {
            if est_objet(r) && possede(r, REF) {
                let mut c = Valeur::Objet(jsval::obj(r).unwrap().to_vec());
                retirer_cle(&mut c, REF);
                racines.insert(racine.into(), c.clone());
                mettre(&mut copie, racine, c);
            }
        }
    }
    for spec in chemins() {
        let Some(r) = get(etat, spec.racine) else { continue };
        if !est_objet(r) { continue; }
        let Some(id) = jsval::chaine(a(r, "id")) else { continue };
        if !id_valide(id) { continue; }
        let valeur = lire(r, spec.segments);
        let Some((liste, objet)) = elements_de(valeur) else { continue };
        if liste.is_empty() { continue; }
        let mut c = if let Some(ex) = racines.get(spec.racine) { ex.clone() } else { Valeur::Objet(jsval::obj(r).unwrap().to_vec()) };
        let mut porteur_chemin: Vec<String> = vec![];
        // Copie superficielle le long du chemin, sur `c`.
        {
            let mut cur = &mut c;
            for (n, k) in spec.segments.iter().enumerate() {
                if n + 1 == spec.segments.len() { break; }
                let enfant = a(cur, k).clone();
                let copie_e = Valeur::Objet(etaler_objet(&enfant));
                mettre(cur, k, copie_e);
                porteur_chemin.push((*k).into());
                cur = prendre_mut(cur, k).unwrap();
            }
        }
        let remplacement = if objet {
            Valeur::Objet(vec![])
        } else if spec.en_ligne == Some("nonExportes") {
            jsval::tab(non_exportes(r, &liste))
        } else {
            jsval::tab(vec![])
        };
        let dernier = spec.segments[spec.segments.len() - 1];
        {
            let mut cur = &mut c;
            for k in &porteur_chemin { cur = prendre_mut(cur, k).unwrap(); }
            mettre(cur, dernier, remplacement);
        }
        let nb = liste.len().div_ceil(spec.taille);
        for i in 0..nb {
            let cle = cle_morceau(spec.racine, &chemin_texte(spec.segments), id, i);
            let tranche: Vec<Valeur> = liste.iter().skip(i * spec.taille).take(spec.taille).cloned().collect();
            if let Some((texte, Some(av))) = connus.get(&cle) {
                if av.len() == tranche.len() && tranche.iter().zip(av).all(|(x, y)| egal_js(x, y)) {
                    morceaux.push((cle, jsval::s(texte.clone())));
                    continue;
                }
            }
            let texte = json::stringify(&jsval::tab(tranche.clone())).ok_or_else(|| Echec::hors_domaine("tranche non sérialisable en JSON"))?;
            morceaux.push((cle.clone(), jsval::s(texte)));
            if tranche.iter().all(json::est_simple) {
                simples.push((cle, jsval::tab(tranche)));
            }
        }
        let mut ref_obj = vec![
            ("v".into(), jsval::n(VERSION)),
            ("id".into(), jsval::s(id)),
            ("longueur".into(), jsval::n(liste.len() as f64)),
            ("morceaux".into(), jsval::n(nb as f64)),
            ("taille".into(), jsval::n(spec.taille as f64)),
        ];
        if objet { ref_obj.push(("forme".into(), jsval::s("objet"))); }
        if let Some(nom) = spec.en_ligne { ref_obj.push(("enLigne".into(), jsval::s(nom))); }
        let mut refs = match get(&c, REF) { Some(Valeur::Objet(t)) => t.clone(), _ => vec![] };
        let ck = chemin_texte(spec.segments);
        if let Some(p) = refs.iter_mut().find(|(k, _)| k == &ck) { p.1 = Valeur::Objet(ref_obj); } else { refs.push((ck, Valeur::Objet(ref_obj))); }
        mettre(&mut c, REF, Valeur::Objet(refs));
        racines.insert(spec.racine.into(), c.clone());
        mettre(&mut copie, spec.racine, c);
    }
    Ok(jsval::o(vec![
        ("etat", clone_json(&copie)),
        ("morceaux", paires_map(&morceaux)),
        ("simples", paires_map(&simples)),
    ]))
}

fn vrai_objet_ou_tableau(v: &Valeur) -> bool {
    matches!(v, Valeur::Objet(_) | Valeur::Tableau(_))
}

pub fn cles_a_relire(etat: &Valeur) -> Valeur {
    let mut cles = vec![];
    for spec in chemins() {
        let r = a(etat, spec.racine);
        let ref_ = a(a(r, REF), &chemin_texte(spec.segments));
        if !ref_acceptable(r, ref_) { continue; }
        let id = jsval::chaine(a(ref_, "id")).unwrap();
        let n = jsval::nombre(a(ref_, "morceaux")).unwrap() as usize;
        for i in 0..n { cles.push(jsval::s(cle_morceau(spec.racine, &chemin_texte(spec.segments), id, i))); }
    }
    jsval::tab(cles)
}

fn ref_acceptable(r: &Valeur, rf: &Valeur) -> bool {
    if !est_objet(rf) { return false; }
    let Some(v) = jsval::nombre(a(rf, "v")) else { return false };
    if v != VERSION { return false; }
    let Some(id) = jsval::chaine(a(rf, "id")) else { return false };
    if !id_valide(id) { return false; }
    let Some(rid) = jsval::chaine(a(r, "id")) else { return false };
    if id != rid { return false; }
    let Some(n) = jsval::nombre(a(rf, "morceaux")) else { return false };
    n >= 0.0 && n <= 100_000.0 && jsval::est_entier(&jsval::n(n))
}

fn lus_de(v: &Valeur) -> HashMap<String, String> {
    let mut m = HashMap::new();
    let paires: Vec<(String, Valeur)> = match v {
        Valeur::Tableau(t) => t.iter().filter_map(|e| {
            let Valeur::Tableau(p) = e.as_ref()? else { return None };
            let k = p.first()?.as_ref().and_then(|x| jsval::chaine(x)).map(std::string::ToString::to_string)?;
            let val = p.get(1).and_then(std::clone::Clone::clone).unwrap_or(Valeur::Indefini);
            Some((k, val))
        }).collect(),
        Valeur::Objet(t) => t.clone(),
        _ => vec![],
    };
    for (k, val) in paires {
        if let Some(t) = jsval::chaine(&val) { m.insert(k, t.to_string()); }
    }
    m
}

pub fn recoller(etat: &Valeur, lus: &Valeur) -> Valeur {
    if !est_objet(etat) && !est_tableau(etat) {
        return jsval::o(vec![("etat", etat.clone()), ("manquants", jsval::tab(vec![])), ("relus", jsval::tab(vec![]))]);
    }
    let mut etat = etat.clone();
    let lus = lus_de(lus);
    let mut manquants = vec![];
    let mut relus = vec![];
    for spec in chemins() {
        let Some(r0) = get(&etat, spec.racine).cloned() else { continue };
        if !est_objet(&r0) { continue; }
        let ck = chemin_texte(spec.segments);
        let rf = a(a(&r0, REF), &ck).clone();
        if !est_objet(&rf) { continue; }
        let chemin_aff = format!("{}.{}", spec.racine, ck);
        let version_ok = jsval::nombre(a(&rf, "v")) == Some(VERSION);
        let id_ok = jsval::chaine(a(&rf, "id")) == jsval::chaine(a(&r0, "id"));
        let n_ok = jsval::nombre(a(&rf, "morceaux")).is_some_and(|n| jsval::est_entier(&jsval::n(n)));
        if !version_ok || !id_ok || !n_ok {
            manquants.push(jsval::o(vec![("chemin", jsval::s(&chemin_aff)), ("raison", jsval::s("reference-illisible"))]));
            continue;
        }
        let id = jsval::chaine(a(&rf, "id")).unwrap_or("");
        let n_f = jsval::nombre(a(&rf, "morceaux")).unwrap_or(0.0);
        let n = if n_f > 0.0 && n_f < 10_000_000.0 { n_f as usize } else { 0 };
        let mut elements = vec![];
        let mut saute = false;
        for i in 0..n {
            let cle = cle_morceau(spec.racine, &ck, id, i);
            let texte = lus.get(&cle).map(std::string::String::as_str);
            let morceau = texte.and_then(json::parse);
            let Some(Valeur::Tableau(morceau)) = morceau else {
                manquants.push(jsval::o(vec![
                    ("chemin", jsval::s(&chemin_aff)),
                    ("morceau", jsval::n(i as f64)),
                    ("raison", jsval::s("morceau-absent")),
                ]));
                saute = true;
                continue;
            };
            if let Some(t) = texte { relus.push((cle, jsval::s(t))); }
            for e in morceau { elements.push(e.unwrap_or(Valeur::Indefini)); }
            let _ = saute;
        }
        // Pose la liste recollée.
        let forme_objet = jsval::chaine(a(&rf, "forme")) == Some("objet");
        let en_ligne = jsval::chaine(a(&rf, "enLigne")).is_some();
        // Navigue en créant les intermédiaires.
        {
            let mut cur = get_mut_racine(&mut etat, spec.racine);
            for (n, k) in spec.segments.iter().enumerate() {
                if n + 1 == spec.segments.len() {
                    let en_ligne_val = a(cur, k).clone();
                    let nouveau = if forme_objet {
                        recolle_objet(&elements, &en_ligne_val)
                    } else if en_ligne {
                        dedoublonne(&elements, &en_ligne_val)
                    } else {
                        let mut t = elements.clone();
                        if let Valeur::Tableau(a) = &en_ligne_val { for e in a { t.push(e.clone().unwrap_or(Valeur::Indefini)); } }
                        jsval::tab(t)
                    };
                    mettre(cur, k, nouveau);
                    break;
                }
                if !est_objet(a(cur, k)) { mettre(cur, k, Valeur::Objet(vec![])); }
                cur = prendre_mut(cur, k).unwrap();
            }
        }
    }
    for racine in ["native", "manual", "batch"] {
        if let Some(r) = get_mut_opt(&mut etat, racine) {
            if est_objet(r) && possede(r, REF) { retirer_cle(r, REF); }
        }
    }
    jsval::o(vec![
        ("etat", etat),
        ("manquants", jsval::tab(manquants)),
        ("relus", paires_map(&relus)),
    ])
}

fn get_mut_racine<'a>(etat: &'a mut Valeur, k: &str) -> &'a mut Valeur { prendre_mut(etat, k).unwrap() }
fn get_mut_opt<'a>(etat: &'a mut Valeur, k: &str) -> Option<&'a mut Valeur> { prendre_mut(etat, k) }

fn recolle_objet(elements: &[Valeur], en_ligne: &Valeur) -> Valeur {
    let mut paires = vec![];
    for e in elements {
        let Valeur::Tableau(p) = e else { continue };
        if p.len() == 2 {
            if let Some(Valeur::Chaine(k)) = &p[0] {
                paires.push((k.clone(), p[1].clone().unwrap_or(Valeur::Indefini)));
            }
        }
    }
    let mut o = jsval::objet_depuis(paires);
    if est_objet(en_ligne) {
        if let Valeur::Objet(t) = en_ligne {
            if let Valeur::Objet(dst) = &mut o {
                for (k, v) in t {
                    if let Some(p) = dst.iter_mut().find(|(c, _)| c == k) { p.1 = v.clone(); } else { dst.push((k.clone(), v.clone())); }
                }
            }
        }
    }
    o
}

fn dedoublonne(elements: &[Valeur], en_ligne: &Valeur) -> Valeur {
    let mut vus: HashSet<Svz> = HashSet::new();
    let mut t = vec![];
    for e in elements {
        if let Some(k) = svz(e) { vus.insert(k); }
        t.push(e.clone());
    }
    if let Valeur::Tableau(a) = en_ligne {
        for e in a {
            let e = e.clone().unwrap_or(Valeur::Indefini);
            if let Some(k) = svz(&e) {
                if !vus.insert(k) { continue; }
            }
            t.push(e);
        }
    }
    jsval::tab(t)
}
