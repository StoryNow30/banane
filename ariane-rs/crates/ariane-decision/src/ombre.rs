//! `src/relecture-ombre.js` : sélection des cuts de la relecture, jugement d'un cut visité, SKIP en ombre, à l'identique.
use crate::critere::vers_nombre;
use crate::js::*;
use ariane_vba::Valeur as V;
use std::collections::HashMap;

const VERSION: &str = "relecture-ombre-v1";
const SIDES: [&str; 2] = ["left", "right"];
const ORDRE_ZONES: [&str; 5] = ["pn", "adv", "abords", "vert-hors-zone", "ecartement"];
/// Bornes de sécurité du port : une plage plus longue que ceci ferait tourner le JS des minutes (ou sans fin).
const PLAGE_MAX: f64 = 2_000_000.0;

pub fn defaults() -> V {
    o(vec![("version", s(VERSION)), ("isole", o(vec![("marge", n(1.0))])), ("differe", o(vec![("marge", n(2.0))])),
        ("grappe", o(vec![("trouCuts", n(5.0)), ("min", n(3.0)), ("marge", n(3.0))])),
        ("aControler", o(vec![("marge", n(1.0))])), ("trouMaxCuts", n(3.0)), ("fusionTrouCuts", n(0.0)), ("relireCutsDuLot", b(false)),
        ("priorites", tab_s(&["pn", "adv", "grappe", "differe", "isole", "a-controler", "ecartement", "trou"])),
        ("plafondParZone", o(vec![("adv", nul()), ("abords", nul()), ("vert-hors-zone", n(20.0)), ("ecartement", n(20.0))])),
        ("plafondCuts", nul()), ("adv", o(vec![("fusionTrouCuts", n(40.0))])), ("ecartement", o(vec![("marge", n(1.0))])),
        ("tempsParCutS", n(3.0)), ("tempsTraverseS", n(1.0)), ("seuilCorrigerMm", n(5.0)), ("zoneGrise", tab_n(&[3.6, 6.4]))])
}
fn zone_de_motif(m: &str) -> &'static str {
    match m { "pn" => "pn", "adv" => "adv", "grappe" | "differe" | "isole" => "abords", "a-controler" => "vert-hors-zone", "ecartement" => "ecartement", _ => "vert-hors-zone" }
}
fn libelle(m: &str) -> String {
    match m { "pn" => "PN", "adv" => "ADV", "grappe" => "grappe", "differe" => "autour du différé", "isole" => "cut isolé", "a-controler" => "à contrôler",
        "ecartement" => "écartement", "trou" => "trou bouché", x => x }.to_owned()
}
/// `entier(v)` du module : entier positif ou nul.
fn entier_pos(v: &V) -> Option<f64> { match v { V::Nombre(x) if x.is_finite() && x.trunc() == *x && *x >= 0.0 => Some(*x), _ => None } }
fn r1(x: f64) -> Option<f64> { if x.is_finite() { Some(ariane_js::round(x * 10.0) / 10.0 + 0.0) } else { None } }
fn um(x: f64) -> f64 { ariane_js::round(x * 1e6) / 1e6 }

/// `fusion(a, b)` : un niveau de profondeur pour les objets simples.
pub fn fusion(a: &V, b_: &V) -> R<V> {
    let mut out = vec![];
    etaler(&mut out, a)?;
    let ent = if vrai(b_) { entrees(b_)? } else { vec![] };
    for (k, v) in ent {
        let ak = g_brut(a, &k);
        let x = if vrai(&v) && est_objet(&v) && !est_tableau(&v) && vrai(ak) && est_objet(ak) { fusion2(ak, &v)? } else { v };
        definir(&mut out, &k, x);
    }
    Ok(V::Objet(out))
}
pub fn cfg_de(options: &V) -> R<V> { if vrai(options) { fusion(&defaults(), options) } else { Ok(defaults()) } }
/// `cfg.a.b` strict (TypeError de V8 sur null/undefined : hors domaine).
fn pp(cfg: &V, a: &str, b_: &str) -> R<V> { Ok(p(p(cfg, a)?, b_)?.clone()) }
fn ppn(cfg: &V, a: &str, b_: &str) -> R<f64> { vers_nombre(&pp(cfg, a, b_)?) }
fn tiret(a: f64, z: f64) -> String { if a == z { nombre_chaine(a) } else { format!("{}–{}", nombre_chaine(a), nombre_chaine(z)) } }

/// `plage(x)`.
pub fn plage(x: &V) -> Option<(f64, f64)> {
    if let Some(c) = entier_pos(x) { return Some((c, c)); }
    if est_tableau(x) && longueur(x) == Some(2) {
        let t = elems(x).unwrap();
        if t.iter().flatten().all(|e| entier_pos(e).is_some()) {
            if let (Some(a), Some(z)) = (t[0].as_ref().and_then(entier_pos), t[1].as_ref().and_then(entier_pos)) { if a <= z { return Some((a, z)); } }
            return None;
        }
    }
    if vrai(x) && est_tableau(g(x, "controle")) { return plage(g(x, "controle")); }
    if vrai(x) { if let (Some(a), Some(z)) = (entier_pos(g(x, "debut")), entier_pos(g(x, "fin"))) { if a <= z { return Some((a, z)); } } }
    None
}

#[derive(Clone)]
struct Brute { a: f64, z: f64, motif: String, zone: Option<String> }
#[derive(Clone)]
struct CutSel { cut: f64, role: &'static str, zone: String }
#[derive(Clone)]
struct Plage { debut: f64, fin: f64, motifs: Vec<String>, zone: String, priorite: f64, libelle: String, cuts: Vec<CutSel>, traverses: Vec<f64>, liste: Vec<f64> }
struct Hors { debut: f64, fin: f64, motifs: Vec<String>, libelle: String }

fn cle(x: f64) -> u64 { (x + 0.0).to_bits() }
fn ensemble_ajouter(v: &mut Vec<f64>, x: f64) { if !v.contains(&x) { v.push(x + 0.0); } }

fn plages_du_lot(lot: &[(f64, bool)], cfg: &V) -> R<Vec<Brute>> {
    let mut out = vec![];
    let mut cuts: Vec<f64> = vec![];
    for (c, _) in lot { ensemble_ajouter(&mut cuts, *c); }
    ariane_js::trier_nombres(&mut cuts);
    let mut groupes: Vec<Vec<f64>> = vec![];
    for c in cuts {
        let ajoute = match groupes.last() { Some(g_) => c - *g_.last().unwrap() <= ppn(cfg, "grappe", "trouCuts")?, None => false };
        if ajoute { groupes.last_mut().unwrap().push(c); } else { groupes.push(vec![c]); }
    }
    for g_ in &groupes {
        if g_.len() as f64 >= ppn(cfg, "grappe", "min")? {
            let m = ppn(cfg, "grappe", "marge")?;
            out.push(Brute { a: g_[0] - m, z: g_.last().unwrap() + m, motif: "grappe".into(), zone: None });
        } else {
            for &c in g_ { let m = ppn(cfg, "isole", "marge")?; out.push(Brute { a: c - m, z: c + m, motif: "isole".into(), zone: None }); }
        }
    }
    for &(c, d) in lot { if d { let m = ppn(cfg, "differe", "marge")?; out.push(Brute { a: c - m, z: c + m, motif: "differe".into(), zone: None }); } }
    Ok(out)
}

fn enchainer(ps: &[(f64, f64)], trou: &V) -> Vec<(f64, f64)> {
    let t = entier_pos(trou).unwrap_or(0.0);
    let mut s_ = ps.to_vec();
    s_.sort_by(|x, y| { let d = x.0 - y.0; if d < 0.0 { std::cmp::Ordering::Less } else if d > 0.0 { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal } });
    let mut out: Vec<(f64, f64)> = vec![];
    for p_ in s_ {
        match out.last_mut() { Some(d) if p_.0 - d.1 - 1.0 <= t => d.1 = ariane_js::max(d.1, p_.1), _ => out.push(p_) }
    }
    out
}
fn zone_brute(p_: &Brute) -> String { p_.zone.clone().unwrap_or_else(|| zone_de_motif(&p_.motif).to_owned()) }
fn parcourir(p_: &Brute, mut f: impl FnMut(f64)) -> R<()> {
    if !(p_.a <= p_.z) { return Ok(()); }
    if p_.z - p_.a > PLAGE_MAX { return hd("plage démesurée"); }
    let mut c = p_.a;
    while c <= p_.z { f(c); c += 1.0; }
    Ok(())
}

pub fn selection(entree: &V, options: &V) -> R<V> {
    let cfg = cfg_de(options)?;
    let e = if vrai(entree) && est_objet(entree) { entree } else { &INDEF };
    let total = entier_pos(g(e, "total")).filter(|t| *t > 0.0);
    let max = total.map_or(f64::INFINITY, |t| t - 1.0);
    let mut lot: Vec<(f64, bool)> = vec![];
    if est_tableau(g(e, "lot")) {
        for x in presents(g(e, "lot")) {
            let c = if nullish(&x) { &INDEF } else { g(&x, "cut") };
            if let Some(c) = entier_pos(c) { if c <= max { lot.push((c, matches!(g(&x, "differe"), V::Booleen(true)))); } }
        }
    }
    let mut differes = vec![];
    for (c, d) in &lot { if *d { ensemble_ajouter(&mut differes, *c); } }
    let mut poses = vec![];
    for (c, d) in &lot { if !*d && !differes.contains(c) { ensemble_ajouter(&mut poses, *c); } }
    let mut brutes = plages_du_lot(&lot, &cfg)?;
    for (cle_, motif) in [("zonesPN", "pn"), ("zonesADV", "adv"), ("aControler", "a-controler"), ("ecartement", "ecartement")] {
        let src = g(e, cle_);
        let mut ps: Vec<(f64, f64)> = if est_tableau(src) { presents(src).iter().filter_map(plage).collect() } else { vec![] };
        if motif == "adv" { ps = enchainer(&ps, &pp(&cfg, "adv", "fusionTrouCuts")?); }
        if motif == "ecartement" && !ps.is_empty() {
            let mut q = vec![];
            for (a, z) in ps { let m = ppn(&cfg, "ecartement", "marge")?; q.push((a - m, z + m)); }
            ps = q;
        }
        if motif == "a-controler" {
            let ac = g(&cfg, "aControler");
            let m = entier_pos(if nullish(ac) { &INDEF } else { g(ac, "marge") }).unwrap_or(0.0);
            ps = ps.into_iter().map(|(a, z)| (a - m, z + m)).collect();
        }
        for (a, z) in ps { brutes.push(Brute { a, z, motif: motif.into(), zone: None }); }
    }
    let mut bornees: Vec<Brute> = brutes.into_iter().map(|p_| Brute { a: ariane_js::max(0.0, p_.a), z: ariane_js::min(max, p_.z), ..p_ }).filter(|p_| p_.a <= p_.z).collect();
    // D-284 : trous bouchés
    let tmax = entier_pos(g(&cfg, "trouMaxCuts")).unwrap_or(0.0);
    if tmax > 0.0 {
        let mut zde: HashMap<u64, String> = HashMap::new();
        let mut ordre: Vec<f64> = vec![];
        for z in ORDRE_ZONES { for p_ in &bornees { if zone_brute(p_) == z { parcourir(p_, |c| { if let std::collections::hash_map::Entry::Vacant(v) = zde.entry(cle(c)) { v.insert(z.into()); ordre.push(c); } })?; } } }
        let mut cs = ordre;
        ariane_js::trier_nombres(&mut cs);
        for i in 1..cs.len() {
            let gap = cs[i] - cs[i - 1] - 1.0;
            if gap >= 1.0 && gap <= tmax { bornees.push(Brute { a: cs[i - 1] + 1.0, z: cs[i] - 1.0, motif: "trou".into(), zone: Some(zde[&cle(cs[i - 1])].clone()) }); }
        }
    }
    let mut zone_de: HashMap<u64, String> = HashMap::new();
    let mut couverts: Vec<f64> = vec![];
    for z in ORDRE_ZONES { for p_ in &bornees { if zone_brute(p_) == z { parcourir(p_, |c| { if let std::collections::hash_map::Entry::Vacant(v) = zone_de.entry(cle(c)) { v.insert(z.into()); couverts.push(c); } })?; } } }
    let mut motifs_de: HashMap<u64, Vec<String>> = HashMap::new();
    for p_ in &bornees { parcourir(p_, |c| { let m = motifs_de.entry(cle(c)).or_default(); if !m.contains(&p_.motif) { m.push(p_.motif.clone()); } })?; }
    ariane_js::trier_nombres(&mut couverts);
    struct Fondue { a: f64, z: f64, cuts: Vec<f64>, zone: String }
    let mut fondues: Vec<Fondue> = vec![];
    for c in couverts {
        let zc = zone_de[&cle(c)].clone();
        let joint = match fondues.last() { Some(d) if d.zone == zc => c - d.z - 1.0 <= vers_nombre(g(&cfg, "fusionTrouCuts"))?, _ => false };
        if joint { let d = fondues.last_mut().unwrap(); d.z = c; d.cuts.push(c); } else { fondues.push(Fondue { a: c, z: c, cuts: vec![c], zone: zc }); }
    }
    let prio = g(&cfg, "priorites");
    let rang = |m: &str| -> R<f64> {
        if nullish(prio) { return hd("priorites absent"); }
        if !est_tableau(prio) { return hd("priorites non tableau"); }
        let t = elems(prio).unwrap();
        Ok(t.iter().position(|x| matches!(x, Some(V::Chaine(c)) if c == m)).unwrap_or(t.len()) as f64)
    };
    let relire = vrai(g(&cfg, "relireCutsDuLot"));
    let decrire = |a: f64, z: f64, liste: &[f64]| -> R<Plage> {
        let mut motifs: Vec<String> = vec![];
        for c in liste { for m in motifs_de.get(&cle(*c)).map(|v| v.as_slice()).unwrap_or(&[]) { if !motifs.contains(m) { motifs.push(m.clone()); } } }
        let zone = zone_de[&cle(liste[0])].clone();
        let mut ms: Vec<(f64, String)> = vec![];
        for m in motifs { ms.push((rang(&m)?, m)); }
        ms.sort_by(|x, y| { let d = x.0 - y.0; if d < 0.0 { std::cmp::Ordering::Less } else if d > 0.0 { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal } });
        let ms: Vec<String> = ms.into_iter().map(|x| x.1).collect();
        let tete = ms.iter().find(|m| zone_de_motif(m) == zone).unwrap_or(&ms[0]).clone();
        let (mut cuts, mut traverses) = (vec![], vec![]);
        for &c in liste {
            let pose = poses.contains(&c);
            if pose && !relire { traverses.push(c); }
            else { cuts.push(CutSel { cut: c, role: if differes.contains(&c) { "differe" } else if pose { "lot" } else { "vert" }, zone: zone_de[&cle(c)].clone() }); }
        }
        Ok(Plage { debut: a, fin: z, motifs: ms, zone, priorite: rang(&tete)?, libelle: format!("{} {}", libelle(&tete), tiret(a, z)), cuts, traverses, liste: liste.to_vec() })
    };
    let mut candidates = vec![];
    for f in &fondues { candidates.push(decrire(f.a, f.z, &f.cuts)?); }
    let mut gardees: Vec<Plage> = candidates.iter().filter(|p_| p_.zone == "pn").cloned().collect();
    let mut hors_plafond: Vec<Hors> = vec![];
    let obligatoire = |c: f64| motifs_de.get(&cle(c)).is_some_and(|m| m.iter().any(|x| x == "a-controler" || x == "ecartement"));
    let budgeter = |liste: Vec<Plage>, plafond: &V, exempter: bool, hors_plafond: &mut Vec<Hors>| -> R<Vec<Plage>> {
        let mut reste = entier_pos(plafond).unwrap_or(f64::INFINITY);
        let mut dans_budget = 0;
        let mut out = vec![];
        let mut hors = |p_: &Plage, debut: f64, out: &mut Vec<Plage>| -> R<()> {
            let mut suite: Vec<f64> = vec![];
            let mut ob: Option<bool> = None;
            let mut rendre = |suite: &mut Vec<f64>, ob: Option<bool>, out: &mut Vec<Plage>| -> R<()> {
                if suite.is_empty() { return Ok(()); }
                if ob == Some(true) { out.push(decrire(suite[0], *suite.last().unwrap(), suite)?); }
                else { hors_plafond.push(Hors { debut: suite[0], fin: *suite.last().unwrap(), motifs: p_.motifs.clone(), libelle: p_.libelle.clone() }); }
                suite.clear();
                Ok(())
            };
            for &c in p_.liste.iter().filter(|x| **x >= debut) {
                let o_ = exempter && obligatoire(c);
                if ob.is_some() && Some(o_) != ob { rendre(&mut suite, ob, out)?; }
                ob = Some(o_);
                suite.push(c);
            }
            rendre(&mut suite, ob, out)
        };
        let mut triee = liste;
        triee.sort_by(|x, y| { let d = x.priorite - y.priorite; let d = if d != 0.0 && !d.is_nan() { d } else { x.debut - y.debut }; if d < 0.0 { std::cmp::Ordering::Less } else if d > 0.0 { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal } });
        for p_ in triee {
            if p_.cuts.len() as f64 <= reste { reste -= p_.cuts.len() as f64; out.push(p_); dans_budget += 1; continue; }
            if dans_budget == 0 && reste > 0.0 {
                let coupe = p_.cuts[reste as usize - 1].cut;
                let l: Vec<f64> = p_.liste.iter().copied().filter(|c| *c <= coupe).collect();
                out.push(decrire(p_.debut, coupe, &l)?);
                dans_budget += 1;
                hors(&p_, coupe + 1.0, &mut out)?;
                reste = 0.0;
                continue;
            }
            hors(&p_, p_.debut, &mut out)?;
        }
        Ok(out)
    };
    let ppz = g(&cfg, "plafondParZone");
    let par_zone_budget = if vrai(ppz) && est_objet(ppz) { ppz.clone() } else { o(vec![]) };
    let mut apres_zones = vec![];
    for z in ORDRE_ZONES.iter().filter(|z| **z != "pn") {
        let l: Vec<Plage> = candidates.iter().filter(|x| x.zone == *z).cloned().collect();
        apres_zones.extend(budgeter(l, &g_brut(&par_zone_budget, z).clone(), true, &mut hors_plafond)?);
    }
    let pc = g(&cfg, "plafondCuts").clone();
    gardees.extend(budgeter(apres_zones, &pc, false, &mut hors_plafond)?);
    let ordre = |x: f64, y: f64| { let d = x - y; if d < 0.0 { std::cmp::Ordering::Less } else if d > 0.0 { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal } };
    gardees.sort_by(|x, y| ordre(x.debut, y.debut));
    hors_plafond.sort_by(|x, y| ordre(x.debut, y.debut));
    let mut i = hors_plafond.len();
    while i > 1 {
        i -= 1;
        if hors_plafond[i - 1].fin + 1.0 == hors_plafond[i].debut && hors_plafond[i - 1].motifs.join(",") == hors_plafond[i].motifs.join(",") {
            let b_ = hors_plafond.remove(i);
            hors_plafond[i - 1].fin = b_.fin;
            hors_plafond[i - 1].libelle = b_.libelle;
        }
    }
    let mut cuts = vec![];
    for (i, p_) in gardees.iter().enumerate() {
        for c in &p_.cuts { cuts.push(o(vec![("cut", n(c.cut)), ("role", s(c.role)), ("zone", s(&c.zone)), ("plage", n(i as f64))])); }
    }
    let traverses: usize = gardees.iter().map(|p_| p_.traverses.len()).sum();
    let par_zone = o(ORDRE_ZONES.iter().map(|z| (*z, n(cuts.iter().filter(|c| matches!(g(c, "zone"), V::Chaine(x) if x == z)).count() as f64))).collect());
    let tps = ariane_js::round(cuts.len() as f64 * vers_nombre(g(&cfg, "tempsParCutS"))? + traverses as f64 * vers_nombre(g(&cfg, "tempsTraverseS"))?);
    let partie = entier_pos(g(e, "partie")).map_or(nul(), |_| g(e, "partie").clone());
    let motifs_v = |m: &[String]| tab(m.iter().map(|x| s(x)).collect());
    Ok(o(vec![("format", s("ariane-relecture-selection-1")), ("version", g(&cfg, "version").clone()), ("partie", partie), ("total", n(cuts.len() as f64)),
        ("traverses", n(traverses as f64)), ("parZone", par_zone), ("tempsEstimeS", n(tps)),
        ("plafondCuts", if entier_pos(&pc).is_some() { pc.clone() } else { nul() }),
        ("plafondParZone", o(["adv", "abords", "vert-hors-zone", "ecartement"].iter().map(|z| { let x = g_brut(&par_zone_budget, z); (*z, if entier_pos(x).is_some() { x.clone() } else { nul() }) }).collect())),
        ("plages", tab(gardees.iter().map(|p_| o(vec![("debut", n(p_.debut)), ("fin", n(p_.fin)), ("motifs", motifs_v(&p_.motifs)), ("zone", s(&p_.zone)),
            ("libelle", s(&p_.libelle)), ("relus", n(p_.cuts.len() as f64)), ("traverses", tab_n(&p_.traverses))])).collect())),
        ("cuts", tab(cuts)),
        ("horsPlafond", tab(hors_plafond.iter().map(|h| o(vec![("debut", n(h.debut)), ("fin", n(h.fin)), ("motifs", motifs_v(&h.motifs)), ("libelle", s(&h.libelle)),
            ("raison", s("plafond-cuts"))])).collect()))]))
}

pub fn options_selection(bloc: &V) -> V {
    let b_ = if vrai(bloc) && est_objet(bloc) { bloc } else { &INDEF };
    let nn = |v: &V, d: f64| match v { V::Nombre(x) if x.is_finite() && x.trunc() == *x && *x >= 0.0 && *x <= 100.0 => v.clone(), _ => n(d) };
    let def = |k: &str| !matches!(g(b_, k), V::Indefini);
    let mut t = vec![];
    if def("grappeMin") || def("trouCuts") || def("margeGrappe") {
        t.push(("grappe", o(vec![("min", nn(g(b_, "grappeMin"), 3.0)), ("trouCuts", nn(g(b_, "trouCuts"), 5.0)), ("marge", nn(g(b_, "margeGrappe"), 3.0))])));
    }
    if def("margeIsole") { t.push(("isole", o(vec![("marge", nn(g(b_, "margeIsole"), 1.0))]))); }
    if def("margeDiffere") { t.push(("differe", o(vec![("marge", nn(g(b_, "margeDiffere"), 2.0))]))); }
    o(t)
}

// ---------------------------------------------------------------- jugement

/// `ecartRail(rail, p, {brut})` : écart (mm) dans le repère profil du rail.
pub fn ecart_rail(rail: &V, pv: &V, brut: bool) -> R<V> {
    let m = p(rail, "sceneRelativeToProfileLocal")?;
    let a = point_v(m, pv)?;
    let o_ = point_v(m, p(rail, "positionSceneRelative")?)?;
    let d: Vec<f64> = (0..3).map(|i| (a[i] - o_[i]) * 1000.0).collect();
    let f = |x: f64| if brut { n(x + 0.0) } else { n_ou_nul(r1(x)) };
    Ok(o(vec![("long", f(d[0])), ("lat", f(d[1])), ("vert", f(d[2]))]))
}
fn ecart_brut(rail: &V, pv: &V) -> R<[f64; 3]> {
    let m = p(rail, "sceneRelativeToProfileLocal")?;
    let a = point_v(m, pv)?;
    let o_ = point_v(m, p(rail, "positionSceneRelative")?)?;
    Ok([(a[0] - o_[0]) * 1000.0 + 0.0, (a[1] - o_[1]) * 1000.0 + 0.0, (a[2] - o_[2]) * 1000.0 + 0.0])
}

/// Positions rendues par `poseCalculee` (tableau d'origine copié, ou point calculé) et corrections.
pub struct Pose { pub positions: [V; 2], pub hauteur_mm: Option<[f64; 2]> }
pub fn pose_calculee(decision: &V, rails: &V, hauteur: &V) -> R<Option<Pose>> {
    let pz = if nullish(decision) { &INDEF } else { g(decision, "positions") };
    if !vrai(pz) { return Ok(None); }
    for sd in SIDES {
        let x = g(pz, sd);
        if !(est_tableau(x) && longueur(x) == Some(3) && presents(x).iter().all(fini)) { return Ok(None); }
    }
    let ha = g(decision, "hauteurApprise");
    let h = if nullish(ha) { &INDEF } else { g(ha, "rails") };
    let mut out: [V; 2] = [V::Indefini, V::Indefini];
    let mut corr = [0.0; 2];
    for (i, sd) in SIDES.iter().enumerate() {
        let hs = if nullish(h) { &INDEF } else { g(h, sd) };
        let cm = if nullish(hs) { &INDEF } else { g(hs, "correctionMm") };
        let mm = if vrai(hauteur) && fini(cm) { num(cm).unwrap() } else { 0.0 };
        let r = if nullish(rails) { &INDEF } else { g(rails, sd) };
        let porte = mm != 0.0 && !nullish(r) && vrai(g(r, "sceneRelativeToProfileLocal")) && vrai(g(r, "profileLocalToSceneRelative"));
        if porte {
            let mut q = point_v(g(r, "sceneRelativeToProfileLocal"), g(pz, sd))?;
            q[2] += mm / 1000.0;
            let w = point_v(g(r, "profileLocalToSceneRelative"), &tab_n(&q))?;
            out[i] = tab_n(&w);
        } else {
            out[i] = V::Tableau(elems(g(pz, sd)).unwrap());
        }
        corr[i] = if porte { mm } else { 0.0 };
    }
    Ok(Some(Pose { positions: out, hauteur_mm: if vrai(h) && vrai(hauteur) { Some(corr) } else { None } }))
}
fn pose_valeur(p_: &Pose) -> V {
    o(vec![("positions", o(vec![("left", p_.positions[0].clone()), ("right", p_.positions[1].clone())])),
        ("hauteurMm", p_.hauteur_mm.map_or(nul(), |c| o(vec![("left", n(c[0])), ("right", n(c[1]))])))])
}

pub fn confiance(science: &V) -> V {
    let rails = if nullish(science) { &INDEF } else { g(science, "rails") };
    if !vrai(rails) { return nul(); }
    o(SIDES.iter().map(|sd| {
        let r = g(rails, sd);
        let a = if nullish(r) { &INDEF } else { g(r, "astar") };
        let c = if nullish(a) { &INDEF } else { g(a, "confidence") };
        (*sd, n_ou_nul(fini_de(c).and_then(r1)))
    }).collect())
}
fn s1_de(science: &V) -> V {
    let rails = if nullish(science) { &INDEF } else { g(science, "rails") };
    if !vrai(rails) { return nul(); }
    o(SIDES.iter().map(|sd| { let r = g(rails, sd); (*sd, b(!nullish(r) && matches!(g(r, "s1Changed"), V::Booleen(true)))) }).collect())
}
/// `p.map(um)` : trous conservés, coercition des seuls non-nombres simples.
fn map_um(t: &V) -> R<V> {
    let mut out = vec![];
    for e in elems(t).unwrap() { out.push(match e { None => None, Some(x) => Some(n(um(vers_nombre(&x)?))) }); }
    Ok(V::Tableau(out))
}
fn nombre_virgule(x: f64) -> String { r1(x).map_or("null".into(), |v| nombre_chaine(v).replacen('.', ",", 1)) }
fn nombre_virgule_v(x: &V) -> String { match fini_de(x) { Some(v) => nombre_virgule(v), None => "null".into() } }

pub fn juger(arg: &V, options: &V) -> R<V> {
    if nullish(arg) { return hd("déstructuration de null/undefined"); }
    let capture = g(arg, "capture");
    let decision = g(arg, "decision");
    let science = match g(arg, "science") { V::Indefini => &V::Nul, x => x };
    let hauteur = match g(arg, "hauteur") { V::Indefini => &V::Booleen(true), x => x };
    let cfg = cfg_de(options)?;
    let rails = if nullish(capture) { &INDEF } else { g(capture, "rails") };
    let mut actuelle: Option<V> = None;
    if vrai(rails) && SIDES.iter().all(|sd| { let r = g(rails, sd); !nullish(r) && est_tableau(g(r, "positionSceneRelative")) }) {
        actuelle = Some(o(vec![("left", map_um(g(g(rails, "left"), "positionSceneRelative"))?), ("right", map_um(g(g(rails, "right"), "positionSceneRelative"))?)]));
    }
    let etage = if nullish(decision) { V::Nul } else { match g(decision, "stage") { x if nullish(x) => V::Nul, x => x.clone() } };
    let reason = if nullish(decision) { &INDEF } else { g(decision, "reason") };
    let motif = if nullish(reason) { V::Nul } else { s(&tranche_utf16(&chaine(reason)?, 80)?) };
    let au = if nullish(decision) { &INDEF } else { g(decision, "anchorsUsed") };
    let appuis = if est_tableau(au) { V::Tableau(elems(au).unwrap().into_iter().take(12).collect()) } else { tab(vec![]) };
    let mut base = vec![("etage", etage.clone()), ("motifDecision", motif.clone()), ("appuis", appuis), ("confiance", confiance(science)), ("s1", s1_de(science)),
        ("poseActuelle", actuelle.clone().unwrap_or(V::Nul))];
    let calc = if actuelle.is_some() { pose_calculee(decision, rails, hauteur)? } else { None };
    let Some(calc) = calc else {
        let et = if vrai(&etage) { chaine(&etage)? } else { "?".into() };
        let mo = if vrai(&motif) { format!(" : {}", chaine(&motif)?) } else { String::new() };
        base.extend([("poseCalculee", nul()), ("ecartMm", nul()), ("ecartBrutMm", nul()), ("pireMm", nul()), ("hauteurMm", nul()), ("zoneGrise", b(false)),
            ("verdict", s("je laisserais")), ("raison", s(&format!("aucune pose sûre calculée ({et}{mo}) : rien à proposer")))]);
        return Ok(o(base));
    };
    let mut ecart = vec![];
    let mut brut = vec![];
    let mut bruts = [[0.0; 3]; 2];
    for (i, sd) in SIDES.iter().enumerate() { ecart.push((*sd, ecart_rail(g(rails, sd), &calc.positions[i], false)?)); }
    for (i, sd) in SIDES.iter().enumerate() {
        bruts[i] = ecart_brut(g(rails, sd), &calc.positions[i])?;
        brut.push((*sd, o(vec![("long", n(bruts[i][0])), ("lat", n(bruts[i][1])), ("vert", n(bruts[i][2]))])));
    }
    let mut pire = 0.0;
    let mut ou: Option<(usize, usize, f64)> = None;
    for i in 0..2 { for ax in [1, 2] { let v = bruts[i][ax].abs(); if v > pire { pire = v; ou = Some((i, ax, bruts[i][ax])); } } }
    let seuil_v = g(&cfg, "seuilCorrigerMm").clone();
    let corrige = pire >= vers_nombre(&seuil_v)?;
    let zg = g(&cfg, "zoneGrise");
    if nullish(zg) { return hd("zoneGrise absent"); }
    let gris = pire >= vers_nombre(&gi(zg, 0)?)? && { pire <= vers_nombre(&gi(zg, 1)?)? };
    let nom = |i: usize| if i == 0 { "gauche" } else { "droit" };
    let lieu = match ou {
        Some((i, ax, v)) => format!("rail {}, {} {} mm", nom(i), if ax == 1 { "latéral" } else { "vertical" }, nombre_virgule(v.abs())),
        None => "aucun écart".into(),
    };
    let h = match calc.hauteur_mm {
        Some(c) if c.iter().any(|x| *x != 0.0) => format!(" ; hauteur apprise {}",
            (0..2).filter(|i| c[*i] != 0.0).map(|i| format!("{} {}{} mm", nom(i), if c[i] > 0.0 { "+" } else { "" }, nombre_virgule(c[i]))).collect::<Vec<_>>().join(", ")),
        _ => String::new(),
    };
    let pose_c = o(vec![("left", map_um(&calc.positions[0])?), ("right", map_um(&calc.positions[1])?)]);
    let et = chaine(&etage)?;
    let raison = if corrige { format!("{lieu} (seuil {} mm, étage {et}){h}", nombre_virgule_v(&seuil_v)) }
        else { format!("écart le plus grand : {lieu}, sous le seuil de {} mm{h}", nombre_virgule_v(&seuil_v)) };
    base.extend([("poseCalculee", pose_c), ("ecartMm", o(ecart)), ("ecartBrutMm", o(brut)), ("pireMm", n_ou_nul(r1(pire))),
        ("hauteurMm", calc.hauteur_mm.map_or(nul(), |c| o(vec![("left", n(c[0])), ("right", n(c[1]))]))), ("zoneGrise", b(gris)),
        ("verdict", s(if corrige { "je corrigerais" } else { "je laisserais" })), ("raison", s(&raison))]);
    Ok(o(base))
}

// ---------------------------------------------------------------- SKIP en ombre
fn points_de(capture: &V) -> Option<(V, V, f64)> {
    let q = if nullish(capture) { &INDEF } else { let qq = g(capture, "quality"); if nullish(qq) { &INDEF } else { g(qq, "perRail") } };
    if vrai(q) && SIDES.iter().all(|sd| entier(g(q, sd))) {
        let (l, r) = (num(g(q, "left")).unwrap(), num(g(q, "right")).unwrap());
        return Some((n(l), n(r), l + r));
    }
    let pts = if nullish(capture) { &INDEF } else { g(capture, "pointsSceneRelative") };
    longueur(pts).map(|k| (nul(), nul(), k as f64))
}
pub fn skip_ombre(captures: &V, opts: &V) -> R<V> {
    if matches!(opts, V::Nul) { return hd("options null"); }
    let min = match g(opts, "min") { V::Indefini => 2.0, x => vers_nombre(x)? };
    let liste: Vec<V> = if est_tableau(captures) { presents(captures).into_iter().filter(vrai).collect() } else if vrai(captures) { vec![captures.clone()] } else { vec![] };
    let comptes: Vec<Option<(V, V, f64)>> = liste.iter().map(points_de).collect();
    let p0 = comptes.first().cloned().flatten();
    let vides = comptes.iter().filter(|c| matches!(c, Some((_, _, t)) if *t == 0.0)).count();
    Ok(o(vec![("raison", if liste.len() as f64 >= min && vides == liste.len() { s("aucun-point") } else { nul() }),
        ("points", p0.map_or(nul(), |(l, r, _)| o(vec![("left", l), ("right", r)]))), ("captures", n(liste.len() as f64)), ("capturesVides", n(vides as f64))]))
}
pub fn capture_vide(capture: &V) -> bool { matches!(points_de(capture), Some((_, _, t)) if t == 0.0) }

pub fn duree(x: &V) -> String {
    let Some(sv) = fini_de(x) else { return String::new() };
    if sv < 0.0 { return String::new(); }
    let m = (sv / 60.0).floor();
    let r = ariane_js::round(sv - 60.0 * m);
    if m != 0.0 { format!("{} min{}", nombre_chaine(m), if r != 0.0 { format!(" {} s", nombre_chaine(r)) } else { String::new() }) } else { format!("{} s", nombre_chaine(r)) }
}

pub fn appeler(a: &Appel) -> R<V> {
    match a.f.as_str() {
        "plage" => Ok(plage(a.arg(0)).map_or(nul(), |(x, y)| tab_n(&[x, y]))),
        "selection" => selection(a.arg(0), a.arg(1)),
        "optionsSelection" => Ok(options_selection(a.arg(0))),
        "ecartRail" => {
            let o3 = a.arg(2);
            if matches!(o3, V::Nul) { return hd("options null"); }
            ecart_rail(a.arg(0), a.arg(1), vrai(match g(o3, "brut") { V::Indefini => &V::Booleen(false), x => x }))
        }
        "poseCalculee" => {
            let o3 = a.arg(2);
            if matches!(o3, V::Nul) { return hd("options null"); }
            let h = match g(o3, "hauteur") { V::Indefini => V::Booleen(true), x => x.clone() };
            Ok(pose_calculee(a.arg(0), a.arg(1), &h)?.map_or(nul(), |p_| pose_valeur(&p_)))
        }
        "confiance" => Ok(confiance(a.arg(0))),
        "juger" => juger(a.arg(0), a.arg(1)),
        "skipOmbre" => skip_ombre(a.arg(0), a.arg(1)),
        "captureVide" => Ok(b(capture_vide(a.arg(0)))),
        "duree" => Ok(s(&duree(a.arg(0)))),
        _ => hd("relecture-ombre : fonction non portée"),
    }
}
