//! Port de `src/verts-a-controler.js` (module pur).
use crate::jsval::{self, a, chaine, cmp_nombre, est_entier, est_objet, nombre, vrai};
use crate::liste::decompacter;
use ariane_vba::Valeur;
use std::collections::{HashMap, HashSet};

struct Cfg {
    fenetre: f64, isole: f64, toute: bool, ref_min: f64, voisins_dz: f64, voisins_min: f64, voisins_voie: f64,
    marge_avant: f64, marge_apres: f64,
    poids: [f64; 9], bornes: [f64; 6], echelles: [f64; 6], zones: [f64; 5],
    seuil: f64, temps: f64, trou: f64, differe: f64, plages_max: f64,
}
fn defaut() -> Cfg {
    Cfg {
        fenetre: 5.0, isole: 5.0, toute: false, ref_min: 20.0, voisins_dz: 10.0, voisins_min: 3.0, voisins_voie: 5.0,
        marge_avant: 4.0, marge_apres: 6.0,
        poids: [0.5, 0.5, 1.0, 0.5, 0.0, 1.0, 0.5, 0.0, 0.0],
        bornes: [40.0, 40.0, 40.0, 40.0, 40.0, 6.0],
        echelles: [10.0, 10.0, 10.0, 10.0, 10.0, 5.0],
        zones: [2.0, 2.0, 2.0, 2.0, 2.0],
        seuil: 1.0, temps: 3.7, trou: 2.0, differe: 2.0, plages_max: 200.0,
    }
}
fn fusion(base: &Valeur, dessus: &Valeur) -> Valeur {
    let mut o = match base { Valeur::Objet(t) => t.clone(), _ => vec![] };
    if let Valeur::Objet(b) = dessus {
        for (k, v) in b {
            let fusionner = est_objet(v) && !matches!(v, Valeur::Tableau(_)) && o.iter().any(|(c, x)| c == k && est_objet(x));
            if fusionner {
                let ancien = o.iter().find(|(c, _)| c == k).unwrap().1.clone();
                let mut m = match ancien { Valeur::Objet(t) => t, _ => vec![] };
                if let Valeur::Objet(n) = v { for (kk, vv) in n { if let Some(p) = m.iter_mut().find(|(c, _)| c == kk) { p.1 = vv.clone(); } else { m.push((kk.clone(), vv.clone())); } } }
                if let Some(p) = o.iter_mut().find(|(c, _)| c == k) { p.1 = Valeur::Objet(m); }
            } else if let Some(p) = o.iter_mut().find(|(c, _)| c == k) { p.1 = v.clone(); } else { o.push((k.clone(), v.clone())); }
        }
    }
    Valeur::Objet(o)
}
fn nb(o: &Valeur, k: &str, d: f64) -> f64 { nombre(a(o, k)).unwrap_or(d) }
fn cfg_de(o: &Valeur) -> Cfg {
    let mut c = defaut();
    if !est_objet(o) { return c; }
    c.fenetre = nb(o, "fenetreCuts", c.fenetre);
    c.isole = nb(o, "fenetreIsoleCuts", c.isole);
    if let Valeur::Booleen(drapeau) = a(o, "touteLaPartie") { c.toute = *drapeau; }
    c.ref_min = nb(o, "referenceLignesMin", c.ref_min);
    c.voisins_dz = nb(o, "voisinsDenivele", c.voisins_dz);
    c.voisins_min = nb(o, "voisinsMin", c.voisins_min);
    c.voisins_voie = nb(o, "voisinsVoie", c.voisins_voie);
    c.seuil = nb(o, "seuil", c.seuil);
    c.temps = nb(o, "tempsParVertS", c.temps);
    c.plages_max = nb(o, "plagesMax", c.plages_max);
    let p = a(o, "pn");
    c.marge_avant = nb(p, "margeAvant", c.marge_avant);
    c.marge_apres = nb(p, "margeApres", c.marge_apres);
    let noms_p = ["ecartement", "denivele", "hauteur", "poses", "voie", "rouges", "differe", "pn", "adv"];
    for (i, k) in noms_p.iter().enumerate() { c.poids[i] = nb(a(o, "poids"), k, c.poids[i]); }
    let noms_b = ["ecartementMm", "deniveleMm", "hauteurMm", "posesMm", "voieMm", "rouges"];
    for (i, k) in noms_b.iter().enumerate() {
        c.bornes[i] = nb(a(o, "bornes"), k, c.bornes[i]);
        c.echelles[i] = nb(a(o, "echelles"), k, c.echelles[i]);
    }
    for (i, k) in noms_b[..5].iter().enumerate() { c.zones[i] = nb(a(o, "zonesMortes"), k, c.zones[i]); }
    c.trou = nb(a(o, "plage"), "trouCuts", c.trou);
    c.differe = nb(a(o, "plage"), "differeCuts", c.differe);
    c
}
fn r1(v: f64) -> f64 { ariane_js::round(v * 10.0) / 10.0 }
fn r2(v: f64) -> f64 { ariane_js::round(v * 100.0) / 100.0 }
fn n_ou_nul(v: Option<f64>) -> Valeur { match v { Some(x) if x.is_finite() => jsval::n(x), _ => jsval::nul() } }

fn mediane(mut v: Vec<f64>) -> Option<f64> {
    v.retain(|x| x.is_finite());
    if v.is_empty() { return None; }
    v.sort_by(|a, b| cmp_nombre(*a, *b));
    let m = v.len() >> 1;
    Some(if v.len() % 2 == 1 { v[m] } else { f64::midpoint(v[m - 1], v[m]) })
}

struct Zone { debut: f64, fin: f64, c0: f64, c1: f64 }
fn zones_de(v: &Valeur, avant: f64, apres: f64) -> Vec<Zone> {
    let mut out = vec![];
    for z in jsval::elements(v) {
        if let Valeur::Tableau(t) = z {
            if t.len() == 2 && t.iter().flatten().all(est_entier) {
                let a = nombre(t[0].as_ref().unwrap()).unwrap();
                let b = nombre(t[1].as_ref().unwrap()).unwrap();
                out.push(Zone { debut: a, fin: b, c0: a, c1: b });
                continue;
            }
        }
        if est_objet(z) {
            if let Valeur::Tableau(c) = a(z, "controle") {
                if c.len() >= 2 && c.iter().take(2).flatten().all(est_entier) {
                let ca = nombre(c[0].as_ref().unwrap()).unwrap();
                let cb = nombre(c[1].as_ref().unwrap()).unwrap();
                let debut = if est_entier(a(z, "debut")) { nombre(a(z, "debut")).unwrap() } else { ca };
                let fin = if est_entier(a(z, "fin")) { nombre(a(z, "fin")).unwrap() } else { cb };
                    out.push(Zone { debut, fin, c0: ca, c1: cb });
                    continue;
                }
            }
            if est_entier(a(z, "debut")) && est_entier(a(z, "fin")) {
                let d = nombre(a(z, "debut")).unwrap();
                let f = nombre(a(z, "fin")).unwrap();
                let c0 = ariane_js::max(0.0, d - avant);
                out.push(Zone { debut: d, fin: f, c0, c1: f + apres });
            }
        }
    }
    out
}
fn zone_val(z: &Zone) -> Valeur {
    jsval::o(vec![("debut", jsval::n(z.debut)), ("fin", jsval::n(z.fin)), ("controle", jsval::tab(vec![jsval::n(z.c0), jsval::n(z.c1)]))])
}

struct Ligne { i: f64, statut: String, operateur: bool, g: Option<f64>, dz: Option<f64>, bords: Option<[[f64; 3]; 2]> }

fn v3(v: &Valeur) -> Option<[f64; 3]> {
    let t = jsval::comme_liste(v)?;
    if t.len() != 3 { return None; }
    let mut o = [0.0; 3];
    for (i, e) in t.iter().enumerate() {
        let x = nombre(e)?;
        if !x.is_finite() { return None; }
        o[i] = x;
    }
    Some(o)
}
fn mesures_ligne(x: &Valeur) -> (Option<f64>, Option<f64>, Option<[[f64; 3]; 2]>) {
    let b = a(x, "bords");
    let left = v3(a(b, "left"));
    let right = v3(a(b, "right"));
    let ok = left.zip(right);
    let g = nombre(a(x, "g")).filter(|v| v.is_finite()).or_else(|| ok.map(|(l, r)| ariane_js::hypot(&[l[0] - r[0], l[1] - r[1], l[2] - r[2]]) * 1000.0));
    let dz = nombre(a(x, "dz")).filter(|v| v.is_finite()).or_else(|| ok.map(|(l, r)| (l[2] - r[2]) * 1000.0));
    (g, dz, ok.map(|(l, r)| [l, r]))
}
fn lignes_de(entree: &Valeur) -> Vec<Ligne> {
    let mut out = vec![];
    let mut vus = HashSet::new();
    for x in jsval::elements(a(entree, "lignes")) {
        if !est_entier(a(x, "i")) { continue; }
        let i = nombre(a(x, "i")).unwrap();
        if !vus.insert(i.to_bits()) { continue; }
        let (g, dz, bords) = mesures_ligne(x);
        out.push(Ligne { i, statut: chaine(a(x, "statut")).unwrap_or("").to_string(), operateur: matches!(a(x, "operateur"), Valeur::Booleen(true)), g, dz, bords });
    }
    out
}

fn proche(arr: &[f64], c: f64) -> f64 {
    let mut lo = 0usize;
    let mut hi = arr.len();
    while lo < hi {
        let m = usize::midpoint(lo, hi);
        if arr[m] < c { lo = m + 1; } else { hi = m; }
    }
    let mut d = f64::INFINITY;
    if lo < arr.len() { d = ariane_js::min(d, arr[lo] - c); }
    if lo > 0 { d = ariane_js::min(d, c - arr[lo - 1]); }
    d
}
fn compte(arr: &[f64], c: f64, r: f64) -> f64 {
    let mut n = 0.0;
    for x in arr {
        if *x < c - r { continue; }
        if *x > c + r { break; }
        n += 1.0;
    }
    n
}

struct Sig {
    i: f64, ecart: Option<f64>, deniv: Option<f64>, vv: Option<f64>, vh: Option<f64>, poses: Option<f64>,
    rouges: f64, dist_lot: Option<f64>, dist_diff: Option<f64>, pn: Option<(f64, f64)>, adv: Option<(f64, f64)>,
    score: f64, raisons: Vec<&'static str>,
}

fn voie(c: f64, pos: &HashMap<u64, [[f64; 3]; 2]>, r#ref: &HashMap<u64, [[f64; 3]; 2]>, portee: f64) -> Option<(f64, f64)> {
    let b = pos.get(&c.to_bits())?;
    let mut a = None;
    let mut z = None;
    let mut d = 1.0;
    while d <= portee && a.is_none() {
        let i = c - d;
        if let Some(bb) = r#ref.get(&i.to_bits()) { a = Some((i, *bb)); }
        d += 1.0;
    }
    d = 1.0;
    while d <= portee && z.is_none() {
        let i = c + d;
        if let Some(bb) = r#ref.get(&i.to_bits()) { z = Some((i, *bb)); }
        d += 1.0;
    }
    let (ia, ba) = a?;
    let (iz, bz) = z?;
    let w = (c - ia) / (iz - ia);
    let mut v = 0.0;
    let mut h = 0.0;
    for s in 0..2 {
        let p = [0, 1, 2].map(|k| ba[s][k] + w * (bz[s][k] - ba[s][k]));
        let q = b[s];
        v = ariane_js::max(v, (q[2] - p[2]).abs() * 1000.0);
        h = ariane_js::max(h, ariane_js::hypot(&[q[0] - p[0], q[1] - p[1]]) * 1000.0);
    }
    Some((v, h))
}

fn signaux(entree: &Valeur, options: &Valeur) -> (Cfg, f64, f64, Vec<f64>, Vec<f64>, Vec<Zone>, Vec<Zone>, Vec<Sig>) {
    let cfg = cfg_de(options);
    let mut lot: Vec<(f64, bool)> = jsval::elements(a(entree, "lot")).into_iter().filter_map(|x| {
        if est_entier(a(x, "cut")) { Some((nombre(a(x, "cut")).unwrap(), matches!(a(x, "differe"), Valeur::Booleen(true)))) } else { None }
    }).collect();
    let mut cuts: Vec<f64> = vec![];
    let mut set = HashSet::new();
    for (c, _) in &lot { if set.insert(c.to_bits()) { cuts.push(*c); } }
    cuts.sort_by(|a, b| cmp_nombre(*a, *b));
    let mut differes = vec![];
    let mut sd = HashSet::new();
    for (c, d) in &lot { if *d && sd.insert(c.to_bits()) { differes.push(*c); } }
    differes.sort_by(|a, b| cmp_nombre(*a, *b));
    let _ = lot;
    let zones = zones_de(a(entree, "zonesPN"), cfg.marge_avant, cfg.marge_apres);
    let zones_adv = zones_de(a(entree, "zonesADV"), 0.0, 0.0);
    let mut lignes = lignes_de(entree);
    lignes.sort_by(|a, b| cmp_nombre(a.i, b.i));
    let verts: Vec<Ligne> = lignes.into_iter().filter(|x| x.statut == "valid" && !x.operateur && !set.contains(&x.i.to_bits())).collect();
    let gs: Vec<f64> = verts.iter().filter_map(|x| x.g).filter(|g| g.is_finite()).collect();
    let n_gs = gs.len() as f64;
    let ref_ec = if n_gs >= cfg.ref_min { mediane(gs).map(r1) } else { None };
    let mut dz = HashMap::new();
    let mut pos = HashMap::new();
    for v in &verts {
        if let Some(z) = v.dz { if z.is_finite() { dz.insert(v.i.to_bits(), z); } }
        if let Some(b) = v.bords { pos.insert(v.i.to_bits(), b); }
    }
    let mut poses = HashMap::new();
    for x in jsval::elements(a(entree, "posees")) {
        if est_entier(a(x, "i")) {
            if let (Some(l), Some(r)) = (v3(a(a(x, "bords"), "left")), v3(a(a(x, "bords"), "right"))) {
                poses.insert(nombre(a(x, "i")).unwrap().to_bits(), [l, r]);
            }
        }
    }
    let mut out = vec![];
    for v in &verts {
        let dist_lot = if cuts.is_empty() { f64::INFINITY } else { proche(&cuts, v.i) };
        let pn = zones.iter().find(|z| v.i >= z.c0 && v.i <= z.c1);
        let adv = zones_adv.iter().find(|z| v.i >= z.c0 && v.i <= z.c1);
        let n5 = compte(&cuts, v.i, 5.0);
        let fen = if n5 >= 2.0 { cfg.fenetre } else { ariane_js::min(cfg.fenetre, cfg.isole) };
        if !cfg.toute && pn.is_none() && adv.is_none() && !(dist_lot <= fen) { continue; }
        let mut vois = vec![];
        let mut d = -cfg.voisins_dz;
        while d <= cfg.voisins_dz {
            if d != 0.0 {
                if let Some(z) = dz.get(&(v.i + d).to_bits()) { vois.push(*z); }
            }
            d += 1.0;
        }
        let mdz = if vois.len() as f64 >= cfg.voisins_min && v.dz.is_some_and(f64::is_finite) { mediane(vois) } else { None };
        let dist_diff = if differes.is_empty() { f64::INFINITY } else { proche(&differes, v.i) };
        let vo = voie(v.i, &pos, &pos, cfg.voisins_voie);
        let vp = if poses.is_empty() { None } else { voie(v.i, &pos, &poses, cfg.voisins_voie) };
        out.push(Sig {
            i: v.i,
            ecart: match (ref_ec, v.g) { (Some(r), Some(g)) if g.is_finite() => Some(r1((g - r).abs())), _ => None },
            deniv: mdz.and_then(|m| v.dz.map(|z| r1((z - m).abs()))),
            vv: vo.map(|(vv, _)| r1(vv)),
            vh: vo.map(|(_, h)| r1(h)),
            poses: vp.map(|(vv, _)| r1(vv)),
            rouges: compte(&cuts, v.i, 5.0),
            dist_lot: if dist_lot.is_finite() { Some(dist_lot) } else { None },
            dist_diff: if dist_diff.is_finite() { Some(dist_diff) } else { None },
            pn: pn.map(|z| (z.debut, z.fin)),
            adv: adv.map(|z| (z.debut, z.fin)),
            score: 0.0, raisons: vec![],
        });
    }
    (cfg, ref_ec.unwrap_or(f64::NAN), n_gs, cuts, differes, zones, zones_adv, out)
}

fn noter(s: &Sig, cfg: &Cfg) -> (f64, Vec<&'static str>) {
    let mut t: Vec<(&'static str, f64)> = vec![];
    let terme = |x: f64, i: usize| ariane_js::max(0.0, ariane_js::min(x, cfg.bornes[i]) - cfg.zones[i]) / cfg.echelles[i];
    if let Some(x) = s.ecart { if x.is_finite() { t.push(("ecartement", cfg.poids[0] * terme(x, 0))); } }
    if let Some(x) = s.deniv { if x.is_finite() { t.push(("denivele", cfg.poids[1] * terme(x, 1))); } }
    if let Some(x) = s.vv { if x.is_finite() { t.push(("hauteur", cfg.poids[2] * terme(x, 2))); } }
    if let Some(x) = s.poses { if x.is_finite() { t.push(("poses", cfg.poids[3] * terme(x, 3))); } }
    if let Some(x) = s.vh { if x.is_finite() { t.push(("voie", cfg.poids[4] * terme(x, 4))); } }
    if s.rouges > 0.0 { t.push(("grappe", cfg.poids[5] * ariane_js::min(s.rouges, cfg.bornes[5]) / cfg.echelles[5])); }
    if let Some(d) = s.dist_diff { if d.is_finite() && d <= cfg.differe { t.push(("differe", cfg.poids[6])); } }
    if s.pn.is_some() { t.push(("pn", cfg.poids[7])); }
    if s.adv.is_some() { t.push(("adv", if cfg.poids[8] == 0.0 { 0.0 } else { cfg.poids[8] })); }
    let mut score = 0.0;
    for (_, v) in &t { score += *v; }
    let mut raisons: Vec<(&str, f64)> = t.into_iter().filter(|(_, v)| *v > 0.0).collect();
    raisons.sort_by(|a, b| cmp_nombre(b.1, a.1));
    (r2(score), raisons.into_iter().map(|(k, _)| k).collect())
}

fn sig_val(s: &Sig, avec_score: bool) -> Valeur {
    let mut p = vec![
        ("i".into(), jsval::n(s.i)),
        ("ecartementMm".into(), n_ou_nul(s.ecart)),
        ("deniveleMm".into(), n_ou_nul(s.deniv)),
        ("voieVerticaleMm".into(), n_ou_nul(s.vv)),
        ("voieLateraleMm".into(), n_ou_nul(s.vh)),
        ("hauteurPosesMm".into(), n_ou_nul(s.poses)),
        ("rouges".into(), jsval::n(s.rouges)),
        ("distLot".into(), n_ou_nul(s.dist_lot)),
        ("distDiffere".into(), n_ou_nul(s.dist_diff)),
        ("pn".into(), s.pn.map_or(jsval::nul(), |(a, b)| jsval::o(vec![("debut", jsval::n(a)), ("fin", jsval::n(b))]))),
        ("adv".into(), s.adv.map_or(jsval::nul(), |(a, b)| jsval::o(vec![("debut", jsval::n(a)), ("fin", jsval::n(b))]))),
    ];
    if avec_score {
        p.push(("score".into(), jsval::n(s.score)));
        p.push(("raisons".into(), jsval::tab(s.raisons.iter().copied().map(jsval::s).collect())));
    }
    Valeur::Objet(p)
}

pub fn classer(entree: &Valeur, options: &Valeur) -> Valeur {
    let (cfg, rec, nl, cuts, differes, zones, adv, mut sig) = signaux(entree, options);
    for s in &mut sig {
        let (sc, r) = noter(s, &cfg);
        s.score = sc; s.raisons = r;
    }
    sig.sort_by(|a, b| cmp_nombre(b.score, a.score).then_with(|| cmp_nombre(a.i, b.i)));
    enveloppe(entree, &cfg, rec, nl, &cuts, &differes, &zones, &adv, &sig, true)
}
fn enveloppe(_e: &Valeur, _c: &Cfg, rec: f64, nl: f64, cuts: &[f64], differes: &[f64], zones: &[Zone], adv: &[Zone], sig: &[Sig], scores: bool) -> Valeur {
    jsval::o(vec![
        ("reference", jsval::o(vec![("ecartementMm", if rec.is_finite() { jsval::n(rec) } else { jsval::nul() }), ("lignes", jsval::n(nl))])),
        ("signaux", jsval::tab(sig.iter().map(|s| sig_val(s, scores && s.score != 0.0 || !s.raisons.is_empty())).collect())),
        ("cutsLot", jsval::tab(cuts.iter().copied().map(jsval::n).collect())),
        ("differes", jsval::tab(differes.iter().copied().map(jsval::n).collect())),
        ("zones", jsval::tab(zones.iter().map(zone_val).collect())),
        ("zonesADV", jsval::tab(adv.iter().map(zone_val).collect())),
        ("verts", jsval::tab(sig.iter().map(|s| sig_val(s, true)).collect())),
    ])
}

pub fn signaux_valeur(entree: &Valeur, options: &Valeur) -> Valeur {
    let (cfg, rec, nl, cuts, differes, zones, adv, sig) = signaux(entree, options);
    let _ = cfg;
    enveloppe(entree, &cfg, rec, nl, &cuts, &differes, &zones, &adv, &sig, false)
}

pub fn compacter_cuts(cuts: &[f64]) -> String {
    let mut u = vec![];
    let mut vus = HashSet::new();
    for c in cuts { if vus.insert(c.to_bits()) { u.push(*c); } }
    u.sort_by(|a, b| cmp_nombre(*a, *b));
    let mut out: Vec<(f64, f64)> = vec![];
    for c in u {
        if let Some(d) = out.last_mut() { if c == d.1 + 1.0 { d.1 = c; continue; } }
        out.push((c, c));
    }
    out.iter().map(|(a, b)| {
        let (sa, sb) = (fmt_i(*a), fmt_i(*b));
        if a == b { sa } else if *b == a + 1.0 { format!("{sa}, {sb}") } else { format!("{sa}–{sb}") }
    }).collect::<Vec<_>>().join(", ")
}
fn fmt_i(x: f64) -> String { format!("{}", x as i64) }

#[derive(Clone)]
struct Plage { debut: f64, fin: f64, cuts: Vec<f64>, motif: String, libelle: String, score: f64, raisons: Vec<String> }

/// Liste de fin de lot (`liste` de `src/verts-a-controler.js`).
#[allow(clippy::too_many_lines)]
pub fn liste(entree: &Valeur, options: &Valeur) -> Valeur {
    let (cfg, rec, nl, cuts, differes, zones, adv, mut sig) = signaux(entree, options);
    for s in &mut sig { let (sc, r) = noter(s, &cfg); s.score = sc; s.raisons = r; }
    sig.sort_by(|a, b| cmp_nombre(b.score, a.score).then_with(|| cmp_nombre(a.i, b.i)));
    let retenus: Vec<&Sig> = sig.iter().filter(|s| s.score >= cfg.seuil).collect();
    let mut tri = retenus.clone();
    tri.sort_by(|a, b| cmp_nombre(a.i, b.i));
    let mut groupes: Vec<(f64, f64, Vec<f64>, Vec<Sig>)> = vec![];
    for v in &tri {
        if let Some(p) = groupes.last_mut() {
            if v.i - p.1 <= cfg.trou { p.1 = v.i; p.2.push(v.i); p.3.push((*v).clone()); continue; }
        }
        groupes.push((v.i, v.i, vec![v.i], vec![(*v).clone()]));
    }
    let mut plages: Vec<Plage> = groupes.iter().map(|g| {
        let pn = g.3.iter().find_map(|v| v.pn);
        let advz = g.3.iter().find_map(|v| v.adv);
        let diff: Vec<f64> = differes.iter().copied().filter(|c| *c >= g.0 - cfg.differe && *c <= g.1 + cfg.differe).collect();
        let lot: Vec<f64> = cuts.iter().copied().filter(|c| *c >= g.0 - cfg.fenetre && *c <= g.1 + cfg.fenetre).collect();
        let mut raisons = vec![];
        for v in &g.3 { for r in &v.raisons { if !raisons.contains(&(*r).to_string()) { raisons.push((*r).to_string()); } } }
        let (motif, libelle) = if let Some((a, b)) = pn {
            ("pn".into(), format!("PN {}–{}", fmt_i(a), fmt_i(b)))
        } else if !diff.is_empty() {
            let lib = if diff.len() == 1 { format!("autour du différé {}", fmt_i(diff[0])) } else { format!("autour des différés {}–{}", fmt_i(diff[0]), fmt_i(*diff.last().unwrap())) };
            ("differe".into(), lib)
        } else if let Some((a, b)) = advz {
            ("adv".into(), format!("ADV {}–{}", fmt_i(a), fmt_i(b)))
        } else if lot.len() >= 3 {
            ("grappe".into(), format!("grappe {}–{}", fmt_i(lot[0]), fmt_i(*lot.last().unwrap())))
        } else if raisons.first().map(std::string::String::as_str) == Some("ecartement") {
            let lib = if g.2.len() == 1 { format!("écartement, cut {}", fmt_i(g.0)) } else { format!("écartement, cuts {}–{}", fmt_i(g.0), fmt_i(g.1)) };
            ("ecartement".into(), lib)
        } else if matches!(raisons.first().map(std::string::String::as_str), Some("denivele" | "hauteur")) {
            let lib = if g.2.len() == 1 { format!("hauteur, cut {}", fmt_i(g.0)) } else { format!("hauteur, cuts {}–{}", fmt_i(g.0), fmt_i(g.1)) };
            ("hauteur".into(), lib)
        } else if !lot.is_empty() {
            let mut meilleur = lot[0];
            for c in &lot { if (c - g.0).abs() < (meilleur - g.0).abs() { meilleur = *c; } }
            ("voisin".into(), format!("près du cut {}", fmt_i(meilleur)))
        } else {
            ("voisin".into(), format!("cuts {}–{}", fmt_i(g.0), fmt_i(g.1)))
        };
        let score = g.3.iter().map(|v| v.score).fold(f64::NEG_INFINITY, ariane_js::max);
        Plage { debut: g.0, fin: g.1, cuts: g.2.clone(), motif, libelle, score, raisons }
    }).collect();
    // Fusion des plages voisines de même libellé.
    let mut fusionnes: Vec<Plage> = vec![];
    for p in plages.drain(..) {
        let meme = fusionnes.last().is_some_and(|d| d.libelle == p.libelle && ["pn", "adv", "differe", "grappe", "voisin"].contains(&p.motif.as_str()));
        if meme {
            let d = fusionnes.last_mut().unwrap();
            d.fin = p.fin; d.cuts.extend(p.cuts); d.score = ariane_js::max(d.score, p.score);
            for r in p.raisons { if !d.raisons.contains(&r) { d.raisons.push(r); } }
        } else { fusionnes.push(p); }
    }
    let tronque = fusionnes.len() as f64 > cfg.plages_max;
    let maxp = cfg.plages_max as usize;
    let plages_v: Vec<Valeur> = fusionnes.iter().take(maxp).map(|p| jsval::o(vec![
        ("debut", jsval::n(p.debut)), ("fin", jsval::n(p.fin)),
        ("cuts", jsval::tab(p.cuts.iter().copied().map(jsval::n).collect())),
        ("nombre", jsval::n(p.cuts.len() as f64)),
        ("motif", jsval::s(&p.motif)), ("libelle", jsval::s(&p.libelle)),
        ("scoreMax", jsval::n(p.score)),
        ("raisons", jsval::tab(p.raisons.iter().cloned().map(jsval::s).collect())),
        ("cutsTexte", jsval::s(compacter_cuts(&p.cuts))),
    ])).collect();
    let verts: Vec<Valeur> = retenus.iter().map(|v| jsval::o(vec![
        ("i", jsval::n(v.i)), ("score", jsval::n(v.score)),
        ("raisons", jsval::tab(v.raisons.iter().copied().map(jsval::s).collect())),
        ("ecartementMm", n_ou_nul(v.ecart)), ("deniveleMm", n_ou_nul(v.deniv)),
        ("hauteurMm", n_ou_nul(v.vv)), ("rouges", jsval::n(v.rouges)), ("distDiffere", n_ou_nul(v.dist_diff)),
    ])).collect();
    let partie = a(entree, "partie");
    jsval::o(vec![
        ("format", jsval::s("ariane-verts-a-controler-1")),
        ("version", jsval::s("verts-a-controler-v1")),
        ("partie", if est_entier(partie) { partie.clone() } else { jsval::nul() }),
        ("candidats", jsval::n(sig.len() as f64)),
        ("aControler", jsval::n(retenus.len() as f64)),
        ("tempsEstimeS", jsval::n(ariane_js::round(retenus.len() as f64 * cfg.temps))),
        ("tempsParVertS", jsval::n(cfg.temps)),
        ("seuil", jsval::n(cfg.seuil)),
        ("reference", jsval::o(vec![("ecartementMm", if rec.is_finite() { jsval::n(rec) } else { jsval::nul() }), ("lignes", jsval::n(nl))])),
        ("cutsDuLot", jsval::n(cuts.len() as f64)),
        ("differes", jsval::n(differes.len() as f64)),
        ("zonesPN", jsval::tab(zones.iter().map(zone_val).collect())),
        ("zonesADV", jsval::tab(adv.iter().map(zone_val).collect())),
        ("plages", jsval::tab(plages_v)),
        ("plagesTronquees", jsval::b(tronque)),
        ("verts", jsval::tab(verts)),
    ])
}
impl Clone for Sig {
    fn clone(&self) -> Self { Sig { raisons: self.raisons.clone(), ..*self } }
}

pub fn duree(s: &Valeur) -> String {
    let Some(s) = nombre(s) else { return String::new() };
    if !s.is_finite() || s < 0.0 { return String::new(); }
    let m = (s / 60.0).floor();
    let r = ariane_js::round(s - 60.0 * m);
    if m == 0.0 {
        format!("{} s", r as i64)
    } else if r == 0.0 { format!("{} min", m as i64) } else { format!("{} min {} s", m as i64, r as i64) }
}

pub fn lignes_instantane(dec: &Valeur) -> Valeur {
    let d = if chaine(a(dec, "format")).is_some() { decompacter(dec) } else { dec.clone() };
    if !est_objet(&d) || !est_entier(a(&d, "n")) && nombre(a(&d, "n")).is_none() { return jsval::tab(vec![]); }
    let n = nombre(a(&d, "n")).unwrap_or(0.0) as usize;
    let st = match a(&d, "st") { Valeur::Tableau(t) => t.iter().map(|e| e.as_ref().and_then(nombre).unwrap_or(3.0)).collect::<Vec<_>>(), Valeur::Nombres(t) => t.clone(), _ => vec![] };
    let fl = match a(&d, "fl") { Valeur::Tableau(t) => t.iter().map(|e| e.as_ref().and_then(nombre).unwrap_or(0.0)).collect::<Vec<_>>(), Valeur::Nombres(t) => t.clone(), _ => vec![] };
    let ed = match a(&d, "ed") {
        Valeur::Nombres(t) => t.iter().copied().map(Some).collect::<Vec<_>>(),
        Valeur::Tableau(t) => t.iter().map(|e| e.as_ref().and_then(nombre)).collect(),
        _ => vec![],
    };
    let noms = ["valid", "invalid", "skipped", "autre"];
    let mut out = vec![];
    for i in 0..n {
        let e: Vec<Option<f64>> = (0..6).map(|j| ed.get(6 * i + j).copied().flatten()).collect();
        let ok = e.len() == 6 && e.iter().all(|v| v.is_some_and(f64::is_finite));
        let st_i = *st.get(i).unwrap_or(&3.0);
        let fl_i = *fl.get(i).unwrap_or(&0.0);
        let statut = if st_i.fract() == 0.0 && (0.0..4.0).contains(&st_i) { noms[st_i as usize] } else { "autre" };
        let bords = if ok {
            let e: Vec<f64> = e.into_iter().map(|v| v.unwrap()).collect();
            jsval::o(vec![
                ("left", jsval::tab(vec![jsval::n(e[0] / 1e4), jsval::n(e[1] / 1e4), jsval::n(e[2] / 1e4)])),
                ("right", jsval::tab(vec![jsval::n(e[3] / 1e4), jsval::n(e[4] / 1e4), jsval::n(e[5] / 1e4)])),
            ])
        } else { jsval::nul() };
        out.push(jsval::o(vec![
            ("i", jsval::n(i as f64)),
            ("statut", jsval::s(statut)),
            ("operateur", jsval::b((fl_i as i64 & 1) == 1)),
            ("bords", bords),
        ]));
    }
    jsval::tab(out)
}
