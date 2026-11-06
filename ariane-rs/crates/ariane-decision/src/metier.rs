//! `src/regles-metier.js` : surface au ras par quart, rails de plus (ADV), résumé d'un cut, activation, événement, à l'identique.
//! Restent en JS (tenue de comptes sur une mémoire à `Map` et `Set`, qui ne passe pas en VBA, et sans calcul lourd) :
//! `creerMemoire`, `evaluer`, `noter`, `lignes`.
use crate::critere::vers_nombre;
use crate::crossing::{self, SIDES};
use crate::js::{o, s, n, b, tab_n, R, vrai, nullish, hd, g, gi, p, INDEF, est_tableau, points_xyz, nul, tab, elem, Ou, n_ou_nul, longueur, presents, fini, elems, num, distance3, entier, g_brut, definir, Appel};
use crate::ombre::fusion;
use ariane_vba::Valeur as V;
use std::collections::HashMap;

pub(crate) fn defaults() -> V {
    o(vec![("version", s("regles-metier-v1")),
        ("surface", o(vec![("sidePointsMin", n(200.0)), ("quadPointsMin", n(30.0)), ("quadNombreMin", n(3.0)), ("quadMinPct", n(50.0)), ("flushMinPct", n(50.0))])),
        ("pn", o(vec![("confirmation", n(2.0)), ("confirmationEcartCuts", n(3.0)), ("consecutifs", b(true)), ("margeAvant", n(4.0)), ("margeApres", n(6.0))])),
        ("grappe", o(vec![("fenetreCuts", n(6.0)), ("differesMin", n(2.0)), ("procheCuts", n(2.0))])),
        ("enPlace", o(vec![("mm", n(1.0))])),
        ("ecartement", o(vec![("seuilMm", n(15.0)), ("lignesMin", n(20.0))])),
        ("adv", o(vec![("version", s("adv-rail-de-plus-v1")), ("pasM", n(0.01)), ("lateralM", n(0.4)), ("longM", n(0.5)), ("trancheM", n(0.1)), ("zMinM", n(-0.4)),
            ("zMaxM", n(0.2)), ("pointsPas", n(3.0)), ("hautM", n(-0.03)), ("continuite", n(0.5)), ("basM", n(-0.08)), ("creuxM", n(-0.15)), ("tete", tab_n(&[-0.09, 0.03])),
            ("largeurMinPas", n(3.0)), ("largeurMaxPas", n(16.0)), ("contreRail", o(vec![("debutMaxM", n(0.065)), ("finMaxM", n(0.125))])), ("platMax", n(0.5)),
            ("sautPas", n(3.0)), ("chutePas", n(5.0)), ("confirmation", n(2.0)), ("confirmationEcartCuts", n(3.0)), ("trouCuts", n(10.0)), ("margeAvant", n(30.0)),
            ("margeApres", n(30.0))])),
        ("verts", o(vec![("trouCuts", n(5.0)), ("grappeMin", n(3.0)), ("margeGrappe", n(3.0))])),
        ("memoireCuts", n(80.0))])
}
/// Écart de bord des tranches (repris du JS).
const EPS: f64 = 1e-9;
const REGLES: [&str; 3] = ["zone-validation-en-place", "pn-chaque-cut", "grappe-differes"];
const QUARTS: [&str; 4] = ["leftIn", "leftOut", "rightIn", "rightOut"];
fn cfg_de(options: &V) -> R<V> { if vrai(options) { fusion(&defaults(), options) } else { Ok(defaults()) } }
fn r1(x: f64) -> Option<f64> { if x.is_finite() { Some(ariane_js::round(x * 10.0) / 10.0) } else { None } }

// ---------------------------------------------------------------- rails de plus (ADV)
struct Adv { pas: f64, lateral: f64, long: f64, tranche: f64, zmin: f64, zmax: f64, points_pas: f64, haut: f64, continuite: f64, bas: f64, creux: f64,
    tete0: f64, tete1: f64, lmin: f64, lmax: f64, cr_debut: f64, cr_fin: f64, plat: f64, saut: f64, chute: f64 }
fn adv_de(a: &V) -> R<Adv> {
    if nullish(a) { return hd("adv absent"); }
    let f = |k: &str| vers_nombre(g(a, k));
    let tete = g(a, "tete");
    let cr = g(a, "contreRail");
    if nullish(tete) || nullish(cr) { return hd("adv incomplet"); }
    Ok(Adv { pas: f("pasM")?, lateral: f("lateralM")?, long: f("longM")?, tranche: f("trancheM")?, zmin: f("zMinM")?, zmax: f("zMaxM")?, points_pas: f("pointsPas")?,
        haut: f("hautM")?, continuite: f("continuite")?, bas: f("basM")?, creux: f("creuxM")?, tete0: vers_nombre(&gi(tete, 0)?)?, tete1: vers_nombre(&gi(tete, 1)?)?,
        lmin: f("largeurMinPas")?, lmax: f("largeurMaxPas")?, cr_debut: vers_nombre(g(cr, "debutMaxM"))?, cr_fin: vers_nombre(g(cr, "finMaxM"))?, plat: f("platMax")?,
        saut: f("sautPas")?, chute: f("chutePas")? })
}

/// `railsDePlus(capture, options)` : (rails, cotes) ; `None` = `{rails:null, cotes:null}`.
pub(crate) fn rails_de_plus(capture: &V, cfg: &V) -> R<V> {
    let a_ = p(cfg, "adv")?;
    let pts_v = if nullish(capture) { &INDEF } else { g(capture, "pointsSceneRelative") };
    let tous = if est_tableau(pts_v) { points_xyz(pts_v, true)? } else { vec![] };
    let rails = if nullish(capture) { &INDEF } else { g(capture, "rails") };
    let rl = if nullish(rails) { &INDEF } else { g(rails, "left") };
    let rr = if nullish(rails) { &INDEF } else { g(rails, "right") };
    if !vrai(rl) || !vrai(rr) || tous.is_empty() { return Ok(o(vec![("rails", nul()), ("cotes", nul())])); }
    let a = adv_de(a_)?;
    let nn = ariane_js::round(a.lateral / a.pas);
    let t = ariane_js::round(2.0 * a.long / a.tranche);
    if !nn.is_finite() || nn.abs() > 1e6 { return hd("profil ADV démesuré"); }
    let mut total = 0.0;
    let mut cotes = vec![];
    for side in SIDES {
        let fr = crossing::frame_of(rails, side)?;
        // pas : hauteurs dans l'ordre des points ; tranches : maximum par tranche
        let mut bins: HashMap<u64, (Vec<f64>, HashMap<u64, f64>)> = HashMap::new();
        for p_ in tous.iter().flatten() {
            let (along, lat, z) = fr.local(*p_)?;
            if !(along.abs() <= a.long) || !(lat.abs() < a.lateral) || z < a.zmin || z > a.zmax { continue; }
            let b_ = (lat / a.pas).floor() + 0.0;
            let e = bins.entry(ariane_js::cle_same_value_zero(b_)).or_insert_with(|| (vec![], HashMap::new()));
            e.0.push(z);
            let tt = ((along + a.long) / a.tranche).floor() + 0.0;
            let m = e.1.entry(ariane_js::cle_same_value_zero(tt)).or_insert(f64::NEG_INFINITY);
            *m = ariane_js::max(*m, z);
        }
        let mut cl: Vec<char> = vec![];
        let mut b_ = -nn;
        while b_ < nn {
            match bins.get(&ariane_js::cle_same_value_zero(b_)) {
                Some(e) if !((e.0.len() as f64) < a.points_pas) => {
                    let mut z = e.0.clone();
                    ariane_js::trier_nombres(&mut z);
                    let p90 = z[std::cmp::min(z.len() - 1, crate::js::rang((0.9 * z.len() as f64).floor()))];
                    let cont = e.1.values().filter(|v| **v > a.haut).count() as f64 / t;
                    cl.push(if p90 > a.haut { if cont >= a.continuite { '#' } else { '^' } } else if p90 > a.bas { '+' } else if p90 > a.creux { '-' } else { '.' });
                }
                _ => cl.push(' '),
            }
            b_ += 1.0;
        }
        let lat = |i: f64| (i - nn + 0.5) * a.pas;
        let tete = |i: f64| lat(i) >= a.tete0 - EPS && lat(i) <= a.tete1 + EPS;
        let (mut hauts, mut dehors) = (0.0, 0.0);
        for (i, c) in cl.iter().enumerate() { if !tete(i as f64) && *c != ' ' { dehors += 1.0; if *c == '#' || *c == '^' { hauts += 1.0; } } }
        let mut rails_v: Vec<V> = vec![];
        if !(dehors > 0.0 && hauts / dehors > a.plat) {
            let bas = |c: char| c == '+' || c == '-' || c == '.' || c == ' ';
            let creux = |c: Option<char>| c == Some('-') || c == Some('.');
            let at = |i: i64| usize::try_from(i).ok().and_then(|u| cl.get(u).copied());
            let voisin = |mut i: i64, d: i64| { let mut k = 0.0; while at(i) == Some('^') && k < a.saut { i += d; k += 1.0; } at(i).unwrap_or(' ') };
            let mut deb: i64 = -1;
            let len = i64::try_from(cl.len()).unwrap_or(i64::MAX);
            for i in 0..=len {
                let h = i < len && at(i) == Some('#') && !tete(i as f64);
                if h && deb < 0 { deb = i; }
                if h || deb < 0 { continue; }
                let (x, y) = (deb, i - 1);
                let w = (y - x + 1) as f64;
                deb = -1;
                if w < a.lmin || w > a.lmax || x == 0 || y == len - 1 { continue; }
                if tete((x - 1) as f64) || tete((y + 1) as f64) { continue; }
                if lat(x as f64) > a.tete1 + EPS && lat(x as f64) <= a.cr_debut + EPS && lat(y as f64) <= a.cr_fin + EPS { continue; }
                if !bas(voisin(x - 1, -1)) || !bas(voisin(y + 1, 1)) { continue; }
                let mut ch = false;
                let (mut k, mut ki) = (1.0, 1i64);
                while k <= a.chute && !ch { ch = creux(at(x - ki)) || creux(at(y + ki)); k += 1.0; ki += 1; }
                if !ch { continue; }
                rails_v.push(tab_n(&[ariane_js::round(lat(x as f64) * 100.0 - 0.5), ariane_js::round(lat(y as f64) * 100.0 + 0.5)]));
            }
        }
        total += rails_v.len() as f64;
        cotes.push((side, tab(rails_v)));
    }
    Ok(o(vec![("rails", n(total)), ("cotes", o(cotes))]))
}

// ---------------------------------------------------------------- surface au ras, par quart
pub(crate) fn surface(capture: &V, options: &V) -> R<V> {
    let cfg_all = cfg_de(options)?;
    let cfg = p(&cfg_all, "surface")?.clone();
    let vis = if nullish(capture) { &INDEF } else { g(capture, "visibleByClipBoxes") };
    let tous_v = if nullish(capture) { &INDEF } else { g(capture, "pointsSceneRelative") };
    if nullish(capture) { return hd("capture absente"); }
    let rails = g(capture, "rails");
    // points retenus (filter saute les trous de `tous` ; vis[i]===true)
    let pts: Vec<Option<[f64; 3]>> = if est_tableau(tous_v) {
        if est_tableau(vis) {
            let src = points_xyz(tous_v, true)?;
            let present: Vec<bool> = match tous_v { V::Tableau(t) => t.iter().map(std::option::Option::is_some).collect(), _ => vec![true; src.len()] };
            let mut out = vec![];
            for (i, x) in src.into_iter().enumerate() {
                if !present[i] { continue; }
                if matches!(elem(vis, i), V::Booleen(true)) {
                    match x { Some(x) => out.push(Some(x)), None => return hd("point non tabulaire") }
                }
            }
            out
        } else { points_xyz(tous_v, false)? }
    } else { vec![] };
    let mut qn = [0.0f64; 4];
    let mut qf = [0.0f64; 4];
    let (mut nt, mut ft) = (0.0f64, 0.0f64);
    for (si, side) in SIDES.iter().enumerate() {
        let fr = crossing::frame_of(rails, side)?;
        for p_ in &pts {
            let (along, lat, z) = fr.local(p_.ou_hd()?)?;
            let a = lat.abs();
            if along.abs() > 0.6 || a < 0.09 || a > 0.45 || z < -0.45 || z > 0.15 { continue; }
            let k = si * 2 + usize::from(lat <= 0.0);
            qn[k] += 1.0; nt += 1.0;
            if z > -0.05 { qf[k] += 1.0; ft += 1.0; }
        }
    }
    let flush = if nt == 0.0 { None } else { Some(ariane_js::round(100.0 * ft / nt)) };
    let qpm = vers_nombre(g(&cfg, "quadPointsMin"))?;
    let peuples: Vec<usize> = (0..4).filter(|k| qn[*k] >= qpm).collect();
    let quad_min = if peuples.len() as f64 >= vers_nombre(g(&cfg, "quadNombreMin"))? {
        Some(ariane_js::min_de(peuples.iter().map(|k| ariane_js::round(100.0 * qf[*k] / qn[*k]))))
    } else { None };
    let adv = rails_de_plus(capture, &cfg_all)?;
    let coeur = nt >= vers_nombre(g(&cfg, "sidePointsMin"))? && flush.is_some() && flush.ou_hd()? >= vers_nombre(g(&cfg, "flushMinPct"))?
        && quad_min.is_some() && quad_min.ou_hd()? >= vers_nombre(g(&cfg, "quadMinPct"))?;
    Ok(o(vec![("flushPct", n_ou_nul(flush)), ("sidePoints", n(nt)), ("quadMin", n_ou_nul(quad_min)),
        ("quarts", o(QUARTS.iter().enumerate().map(|(k, q)| (*q, if qn[k] == 0.0 { nul() } else { n(ariane_js::round(100.0 * qf[k] / qn[k])) })).collect())),
        ("coeurPN", b(coeur)), ("advRails", g(&adv, "rails").clone()), ("advCotes", g(&adv, "cotes").clone())]))
}

// ---------------------------------------------------------------- résumé, activation, événement
fn v3(a: &V) -> bool { est_tableau(a) && longueur(a) == Some(3) && presents(a).iter().all(fini) }
fn trois(a: &V) -> [f64; 3] { let Some(t) = elems(a) else { return [f64::NAN; 3] }; [0, 1, 2].map(|i| t[i].as_ref().and_then(num).unwrap_or(f64::NAN)) }
pub(crate) fn resumer(arg: &V) -> R<V> {
    if nullish(arg) { return hd("déstructuration de null/undefined"); }
    let (identity, decision, action, valide, sv, ini, fin) = (g(arg, "identity"), g(arg, "decision"), g(arg, "action"), g(arg, "valide"), g(arg, "surface"), g(arg, "initiale"), g(arg, "finale"));
    let ok = |p_: &V| vrai(p_) && SIDES.iter().all(|x| v3(g(p_, x)));
    let dist = |a: &V, b_: &V| distance3(&trois(a), &trois(b_));
    let depl = if ok(ini) && ok(fin) { n_ou_nul(r1(ariane_js::max_de(SIDES.iter().map(|x| dist(g(ini, x), g(fin, x)) * 1000.0)))) } else { nul() };
    let ecart = if ok(fin) { n_ou_nul(r1(dist(g(fin, "left"), g(fin, "right")) * 1000.0)) } else { nul() };
    let opt = |o_: &V, k: &str| -> V { if nullish(o_) { nul() } else { match g(o_, k) { x if nullish(x) => nul(), x => x.clone() } } };
    let ar = if nullish(sv) { &INDEF } else { g(sv, "advRails") };
    Ok(o(vec![("cut", opt(identity, "cut")), ("part", opt(identity, "part")), ("stage", opt(decision, "stage")), ("reason", opt(decision, "reason")),
        ("action", if nullish(action) { nul() } else { action.clone() }),
        ("valide", match valide { V::Booleen(x) => b(*x), _ => nul() }), ("deplacementMm", depl), ("ecartementMm", ecart),
        ("flushPct", opt(sv, "flushPct")), ("quadMin", opt(sv, "quadMin")), ("coeurPN", b(!nullish(sv) && matches!(g(sv, "coeurPN"), V::Booleen(true)))),
        ("advRails", if entier(ar) { ar.clone() } else { nul() })]))
}

pub(crate) fn doit_differer(e: &V, reglage: &V) -> R<bool> {
    if !vrai(e) || !matches!(g(e, "aurait"), V::Chaine(c) if c == "differer") || !vrai(reglage) || !matches!(g(reglage, "actif"), V::Booleen(true)) || !vrai(g(reglage, "regles")) {
        return Ok(false);
    }
    let rg = g(e, "regles");
    let liste = if vrai(rg) { rg.clone() } else { tab(vec![]) };
    if !est_tableau(&liste) { return hd("regles non tableau"); }
    let rr = g(reglage, "regles");
    Ok(presents(&liste).iter().any(|id| matches!(id, V::Chaine(c) if REGLES.contains(&c.as_str()) && matches!(g_brut(rr, c), V::Booleen(true)))))
}

/// `JSON.parse(JSON.stringify(v))` pour une valeur VBA.
pub(crate) fn json_aller_retour(v: &V) -> R<V> {
    Ok(match v {
        V::Nombre(x) => if x.is_finite() { n(*x + 0.0) } else { nul() },
        V::Objet(e) => { let mut out = vec![]; for (k, x) in e { if !matches!(x, V::Indefini) { definir(&mut out, k, json_aller_retour(x)?); } } V::Objet(out) }
        t if est_tableau(t) => V::Tableau(elems(t).ou_hd()?.into_iter().map(|x| Ok(Some(match x { None | Some(V::Indefini) => nul(), Some(y) => json_aller_retour(&y)? }))).collect::<R<Vec<_>>>()?),
        V::Erreur { .. } => return hd("JSON d'une erreur"),
        x => x.clone(),
    })
}
pub(crate) fn evenement(e: &V, opts: &V) -> R<V> {
    if matches!(opts, V::Nul) { return hd("options null"); }
    let premier = vrai(g(opts, "premier"));
    let portee = match g(opts, "portee") { V::Indefini => s("cut"), x => x.clone() };
    let actif = match g(opts, "actif") { V::Indefini => nul(), x => x.clone() };
    let cfg = cfg_de(g(opts, "options"))?;
    let opt = |k: &str| -> V { if nullish(e) { nul() } else { match g(e, k) { x if nullish(x) => nul(), x => x.clone() } } };
    let regles = if nullish(e) { tab(vec![]) } else { match g(e, "regles") { x if vrai(x) => x.clone(), _ => tab(vec![]) } };
    let mut t = vec![("version", g(&cfg, "version").clone()), ("portee", portee), ("identity", o(vec![("part", opt("part")), ("cut", opt("cut"))])),
        ("zone", opt("zone")), ("surface", opt("surface")), ("reel", opt("reel")), ("regles", regles), ("aurait", opt("aurait"))];
    if vrai(&actif) { t.push(("actif", actif)); }
    if premier { t.push(("seuils", json_aller_retour(&cfg)?)); }
    Ok(o(t))
}

pub(crate) fn appeler(a: &Appel) -> R<V> {
    match a.f.as_str() {
        "surface" => surface(a.arg(0), a.arg(1)),
        "railsDePlus" => rails_de_plus(a.arg(0), &cfg_de(a.arg(1))?),
        "resumer" => resumer(a.arg(0)),
        "doitDifferer" => doit_differer(a.arg(0), a.arg(1)).map(b),
        "evenement" => evenement(a.arg(0), a.arg(1)),
        _ => hd("regles-metier : fonction non portée"),
    }
}
