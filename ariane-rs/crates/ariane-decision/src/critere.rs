//! `src/relecture-critere.js` : règle prudente de correction de la relecture (`reglages`, `correctionPermise`, `juger`), à l'identique.
use crate::js::{o, b, n, s, tab_s, R, hd, nombre_chaine, arrondi1, est_tableau, longueur, presents, elems, vrai, est_simple, g, definir, nul, nullish, INDEF, est_objet, Ou, inclut, tranche_utf16, entier, num, tab, joindre, chaine, p, chaine_de, fini_de, Appel};
use ariane_vba::Valeur as V;

const ZONES: [&str; 4] = ["pn", "adv", "abords", "vert-hors-zone"];
const ZONES_OPTION: [&str; 1] = ["ecartement"];
const ETAGES: [&str; 4] = ["first-pass", "window", "choice", "crossing"];
const VARIANTES: [&str; 4] = ["chaine+h", "chaine", "seul+h", "seul"];
const LATERAL_MAX_MM: f64 = 45.0;
const JAMAIS: [&str; 2] = ["cut différé par le lot", "cut posé par le lot"];
const FORMAT: &str = "ariane-relecture-reglages-1";
const SIDES: [&str; 2] = ["left", "right"];

/// `DEFAUT` (objet gelé du module), dans l'ordre de ses clés.
pub(crate) fn defaut() -> V {
    let z = |c: bool, s: f64, m: f64| o(vec![("corriger", b(c)), ("seuilMm", n(s)), ("confianceMin", n(m))]);
    o(vec![("format", s(FORMAT)), ("statut", s("provisoire")), ("etagesPermis", tab_s(&["first-pass", "window"])), ("appuisMin", n(2.0)),
        ("roles", tab_s(&["vert"])), ("jamais", tab_s(&JAMAIS)), ("variante", o(vec![("proposition", s("chaine+h"))])),
        ("voie", o(vec![("lateralMaxMm", n(LATERAL_MAX_MM))])),
        ("coherence", o(vec![("diffLateraleMaxMm", n(6.0)), ("diffVerticaleMaxMm", n(6.0)), ("ecartementMaxMm", n(8.0))])),
        ("zones", o(vec![("pn", z(true, 15.0, 85.0)), ("adv", z(true, 8.0, 95.0)), ("abords", z(true, 8.0, 80.0)), ("vert-hors-zone", z(false, 15.0, 90.0)),
            ("ecartement", z(false, 8.0, 0.0))]))])
}

/// `nombre(v,min,max)`.
fn nombre(v: &V, min: f64, max: f64) -> bool { matches!(v, V::Nombre(x) if x.is_finite() && *x >= min && *x <= max) }
/// `ToNumber` des valeurs que VBA porte ; chaînes et objets : coercition non portée.
pub(crate) fn vers_nombre(v: &V) -> R<f64> {
    match v { V::Nombre(x) => Ok(*x), V::Indefini => Ok(f64::NAN), V::Nul => Ok(0.0), V::Booleen(x) => Ok(if *x { 1.0 } else { 0.0 }), _ => hd("coercition numérique") }
}
/// `virgule(v)` : `String(Math.round(v*10)/10).replace('.',',')`.
pub(crate) fn virgule(v: f64) -> String { nombre_chaine(arrondi1(v)).replacen('.', ",", 1) }
fn virgule_v(v: &V) -> R<String> { Ok(virgule(vers_nombre(v)?)) }
fn tout_chaine(t: &[&str], x: &V) -> bool { matches!(x, V::Chaine(c) if t.contains(&c.as_str())) }

/// `liste(v,d,ok)` : `Array.isArray(v)&&v.length&&v.every(ok)?v.slice():d.slice()`.
fn liste(v: &V, d: &[&str], ok: impl Fn(&V) -> bool) -> V {
    if est_tableau(v) && longueur(v).unwrap_or(0) > 0 && presents(v).iter().all(ok) { V::Tableau(elems(v).unwrap_or_default()) } else { tab_s(d) }
}

pub(crate) fn reglages(fichier: &V, source: &V) -> R<V> {
    let f = if vrai(fichier) && est_simple(fichier) { Some(fichier) } else { None };
    let Some(f) = f.filter(|f| matches!(g(f, "format"), V::Chaine(c) if c == FORMAT)) else {
        let V::Objet(mut e) = reglages(&defaut(), &s("defaut"))? else { unreachable!() };
        definir(&mut e, "refus", if f.is_some() { s("format") } else { nul() });
        return Ok(V::Objet(e));
    };
    let dz = |z: &str| -> (f64, f64) { match z { "pn" => (15.0, 85.0), "adv" => (8.0, 95.0), "abords" => (8.0, 80.0), "vert-hors-zone" => (15.0, 90.0), _ => (8.0, 0.0) } };
    let mut zones = vec![];
    let mut invalides: Vec<V> = vec![];
    let fz = g(f, "zones");
    for z in ZONES {
        let (ds, dc) = dz(z);
        let x = if nullish(fz) { &INDEF } else { g(fz, z) };
        if !vrai(x) || !est_objet(x) || est_tableau(x) { invalides.push(s(&format!("zones.{z}"))); }
        let y = if vrai(x) && est_objet(x) { x } else { &INDEF };
        if vrai(x) && !matches!(g(y, "corriger"), V::Booleen(_)) { invalides.push(s(&format!("zones.{z}.corriger"))); }
        if vrai(x) && !nombre(g(y, "seuilMm"), 1.0, 500.0) { invalides.push(s(&format!("zones.{z}.seuilMm"))); }
        let corriger = match g(y, "corriger") { V::Booleen(c) => *c, _ => false };
        let seuil = if nombre(g(y, "seuilMm"), 1.0, 500.0) { g(y, "seuilMm").clone() } else { n(ds) };
        let conf = if nombre(g(y, "confianceMin"), 0.0, 100.0) { g(y, "confianceMin").clone() } else { n(dc) };
        definir(&mut zones, z, o(vec![("corriger", b(corriger)), ("seuilMm", seuil), ("confianceMin", conf)]));
    }
    for z in ZONES_OPTION {
        let (ds, dc) = dz(z);
        let d = || o(vec![("corriger", b(false)), ("seuilMm", n(ds)), ("confianceMin", n(dc))]);
        let x = if nullish(fz) { &INDEF } else { g(fz, z) };
        if matches!(x, V::Indefini) { definir(&mut zones, z, d()); continue; }
        if !vrai(x) || !est_objet(x) || est_tableau(x) { invalides.push(s(&format!("zones.{z}"))); definir(&mut zones, z, d()); continue; }
        if !matches!(g(x, "corriger"), V::Booleen(_)) { invalides.push(s(&format!("zones.{z}.corriger"))); }
        if !nombre(g(x, "seuilMm"), 1.0, 500.0) { invalides.push(s(&format!("zones.{z}.seuilMm"))); }
        let corriger = match g(x, "corriger") { V::Booleen(c) => *c, _ => false };
        let seuil = if nombre(g(x, "seuilMm"), 1.0, 500.0) { g(x, "seuilMm").clone() } else { n(ds) };
        let conf = if nombre(g(x, "confianceMin"), 0.0, 100.0) { g(x, "confianceMin").clone() } else { n(dc) };
        definir(&mut zones, z, o(vec![("corriger", b(corriger)), ("seuilMm", seuil), ("confianceMin", conf)]));
    }
    let c = if vrai(g(f, "coherence")) { g(f, "coherence") } else { &INDEF };
    let v = if vrai(g(f, "voie")) { g(f, "voie") } else { &INDEF };
    let lateral_ok = nombre(g(v, "lateralMaxMm"), 1.0, LATERAL_MAX_MM);
    if !lateral_ok { invalides.push(s("voie.lateralMaxMm")); }
    let roles = g(f, "roles");
    let roles_ok = est_tableau(roles) && longueur(roles).ou_hd()? > 0 && presents(roles).iter().all(|r| matches!(r, V::Chaine(c) if c == "vert"));
    if !roles_ok { invalides.push(s("roles")); }
    let jamais = g(f, "jamais");
    let jamais_ok = est_tableau(jamais) && { let mut ok = true; for x in JAMAIS { if !inclut(jamais, &s(x))? { ok = false; break; } } ok };
    if !jamais_ok { invalides.push(s("jamais")); }
    let variante = match g(f, "variante") { V::Chaine(c) => s(c), x if nullish(x) => V::Indefini, x => g(x, "proposition").clone() };
    let statut = match g(f, "statut") { V::Chaine(c) => s(&tranche_utf16(c, 40)?), _ => s("inconnu") };
    let ap = g(f, "appuisMin");
    let appuis_min = if entier(ap) && num(ap).ou_hd()? >= 0.0 && num(ap).ou_hd()? <= 40.0 { ap.clone() } else { n(0.0) };
    let jamais_v = if jamais_ok {
        let t: Vec<V> = presents(jamais).into_iter().filter(|x| matches!(x, V::Chaine(_))).take(8).collect();
        tab(t)
    } else { tab_s(&JAMAIS) };
    let sel = g(f, "selection");
    let selection = if vrai(sel) && est_simple(sel) { sel.clone() } else { nul() };
    let coh = |k: &str, d: f64| if nombre(g(c, k), 0.0, 100.0) { g(c, k).clone() } else { n(d) };
    Ok(o(vec![("format", s(FORMAT)), ("statut", statut), ("source", source.clone()), ("invalides", tab(invalides)),
        ("etagesPermis", liste(g(f, "etagesPermis"), &["first-pass", "window"], |e| tout_chaine(&ETAGES, e))),
        ("appuisMin", appuis_min),
        ("variante", if tout_chaine(&VARIANTES, &variante) { variante } else { s("chaine+h") }),
        ("jamais", jamais_v), ("selection", selection),
        ("roles", if roles_ok { V::Tableau(elems(roles).ou_hd()?) } else { tab_s(&["vert"]) }),
        ("voie", o(vec![("lateralMaxMm", if lateral_ok { g(v, "lateralMaxMm").clone() } else { n(LATERAL_MAX_MM) })])),
        ("coherence", o(vec![("diffLateraleMaxMm", coh("diffLateraleMaxMm", 6.0)), ("diffVerticaleMaxMm", coh("diffVerticaleMaxMm", 6.0)), ("ecartementMaxMm", coh("ecartementMaxMm", 8.0))])),
        ("zones", V::Objet(zones))]))
}

pub(crate) fn correction_permise(r: &V) -> R<V> {
    let non = |m: &str| Ok(o(vec![("ok", b(false)), ("raison", s(m))]));
    if !vrai(r) || !est_objet(r) { return non("réglages illisibles"); }
    if matches!(g(r, "refus"), V::Chaine(c) if c == "format") { return non("fichier de réglages d’un autre format"); }
    if !matches!(g(r, "source"), V::Chaine(c) if c == "propose") { return non("fichier proposé absent ou illisible (défaut provisoire)"); }
    let inv = g(r, "invalides");
    if !est_tableau(inv) { return non("réglages non vérifiés"); }
    let l = longueur(inv).ou_hd()?;
    if l > 0 {
        let t = V::Tableau(elems(inv).ou_hd()?.into_iter().take(6).collect());
        return non(&format!("réglages invalides : {}", joindre(&t, ", ")?));
    }
    Ok(o(vec![("ok", b(true)), ("raison", nul())]))
}

fn cote(side: &str) -> &'static str { if side == "left" { "gauche" } else { "droit" } }
fn ou_inconnu(v: &V) -> R<String> { if nullish(v) { Ok("?".into()) } else { chaine(v) } }

pub(crate) fn juger(entree: &V, r: &V) -> R<V> {
    let non = |regle: &str, raison: String| Ok(o(vec![("corriger", b(false)), ("regle", s(regle)), ("raison", s(&raison))]));
    let def = defaut();
    let r = if matches!(r, V::Indefini) { &def } else { r };
    let e = if vrai(entree) && est_objet(entree) { entree } else { &INDEF };
    let j = g(e, "jugement");
    if !vrai(j) || !vrai(g(j, "poseCalculee")) || !vrai(g(j, "ecartMm")) { return non("pose", "aucune pose calculée".into()); }
    let sk = g(e, "skipOmbre");
    if !nullish(sk) && vrai(g(sk, "raison")) { return non("skip", format!("cut à SKIP en ombre ({})", chaine(g(sk, "raison"))?)); }
    let rr = |k| p(r, k);
    let roles = if est_tableau(rr("roles")?) { rr("roles")?.clone() } else { tab_s(&["vert"]) };
    let jamais = if est_tableau(rr("jamais")?) { rr("jamais")?.clone() } else { tab_s(&JAMAIS) };
    let role = g(e, "role");
    if matches!(role, V::Chaine(c) if c == "differe") && inclut(&jamais, &s(JAMAIS[0]))? { return non("role", "jamais un cut différé par le lot".into()); }
    if matches!(role, V::Chaine(c) if c == "lot") && inclut(&jamais, &s(JAMAIS[1]))? { return non("role", "jamais un cut posé par le lot".into()); }
    if !inclut(&roles, role)? { return non("role", format!("rôle « {} » non permis ({})", ou_inconnu(role)?, joindre(&roles, ", ")?)); }
    let etages = if est_tableau(rr("etagesPermis")?) { rr("etagesPermis")?.clone() } else { tab_s(&["first-pass", "window"]) };
    let etage = g(j, "etage");
    if !inclut(&etages, etage)? { return non("etage", format!("étage « {} » non permis ({})", ou_inconnu(etage)?, joindre(&etages, ", ")?)); }
    let appuis_min = if entier(rr("appuisMin")?) { num(rr("appuisMin")?).ou_hd()? } else { 2.0 };
    let n_appuis = longueur(g(j, "appuis")).unwrap_or(0) as f64;
    if n_appuis < appuis_min {
        return non("appuis", format!("{} appui{} du lot, {} au moins", nombre_chaine(n_appuis), if n_appuis > 1.0 { "s" } else { "" }, nombre_chaine(appuis_min)));
    }
    let zones = rr("zones")?;
    let zone = g(e, "zone");
    let zone_est = |z: &str| matches!(zone, V::Chaine(c) if c == z);
    if zone_est("ecartement") {
        let ec = if nullish(zones) { &INDEF } else { g(zones, "ecartement") };
        let cor = if nullish(ec) { &INDEF } else { g(ec, "corriger") };
        if !matches!(cor, V::Booleen(true)) { return non("zone", "vert hors plage entré pour son écartement : ombre seulement".into()); }
    }
    if !tout_chaine(&["pn", "adv", "abords", "ecartement"], zone) { return non("zone", format!("zone « {} » : jamais corrigée (D-180)", ou_inconnu(zone)?)); }
    let zn = chaine_de(zone).ou_hd()?;
    let z = if nullish(zones) { &INDEF } else { g(zones, zn) };
    if !vrai(z) { return non("zone", format!("zone « {zn} » inconnue")); }
    if !matches!(g(z, "corriger"), V::Booleen(true)) { return non("zone", format!("zone {zn} : correction coupée")); }
    let tous = |x: &V| vrai(x) && SIDES.iter().all(|sd| vrai(g(x, sd)));
    let ec = if tous(g(e, "ecritBrut")) { g(e, "ecritBrut") } else if tous(g(e, "ecrit")) { g(e, "ecrit") } else if tous(g(j, "ecartBrutMm")) { g(j, "ecartBrutMm") } else { g(j, "ecartMm") };
    let lire = |sd: &str, a: &str| { let x = g(ec, sd); if nullish(x) { None } else { fini_de(g(x, a)) } };
    if !SIDES.iter().all(|sd| ["lat", "vert"].iter().all(|a| lire(sd, a).is_some())) { return non("pose", "écart par rail illisible".into()); }
    let [ll, lv, rl, rv] = [lire("left", "lat").ou_hd()?, lire("left", "vert").ou_hd()?, lire("right", "lat").ou_hd()?, lire("right", "vert").ou_hd()?];
    let pire = ariane_js::max_de([ll.abs(), lv.abs(), rl.abs(), rv.abs()]);
    let seuil = vers_nombre(g(z, "seuilMm"))?;
    if !(pire >= seuil) { return non("seuil", format!("écart {} mm sous le seuil de la zone {zn} ({} mm)", virgule(pire), virgule(seuil))); }
    let conf = g(j, "confiance");
    for sd in SIDES {
        let c = if nullish(conf) { &INDEF } else { g(conf, sd) };
        let Some(cv) = fini_de(c) else {
            return non("confiance", format!("confiance du rail {} {}", cote(sd), if matches!(c, V::Chaine(x) if x == "s1") { "non calibrée (S1)" } else { "absente" }));
        };
        let conf_min = vers_nombre(g(z, "confianceMin"))?;
        if cv < conf_min { return non("confiance", format!("confiance du rail {} {} sous {}", cote(sd), virgule(cv), virgule(conf_min))); }
    }
    let dv = defaut();
    let voie = if vrai(rr("voie")?) { rr("voie")? } else { g(&dv, "voie") };
    let coh = if vrai(rr("coherence")?) { rr("coherence")? } else { g(&dv, "coherence") };
    let lat_max = vers_nombre(g(voie, "lateralMaxMm"))?;
    for (sd, lat) in [("left", ll), ("right", rl)] {
        if !(lat.abs() <= lat_max) {
            return non("voie", format!("rail {} déplacé de {} mm en travers (plus de {} mm : autre voie possible)", cote(sd), virgule(lat.abs()), virgule_v(g(voie, "lateralMaxMm"))?));
        }
    }
    let (dl, dvv) = ((ll - rl).abs(), (lv - rv).abs());
    if !(dl <= vers_nombre(g(coh, "diffLateraleMaxMm"))?) { return non("coherence", format!("rails incohérents en travers ({} mm d’écart entre les deux rails)", virgule(dl))); }
    if !(dvv <= vers_nombre(g(coh, "diffVerticaleMaxMm"))?) { return non("coherence", format!("rails incohérents en hauteur ({} mm d’écart entre les deux rails)", virgule(dvv))); }
    let (em, er) = (g(e, "ecartementMm"), g(e, "ecartementRefMm"));
    if !matches!(em, V::Indefini) || !matches!(er, V::Indefini) {
        let Some(emv) = fini_de(em) else { return non("coherence", "écartement de la pose écrite illisible".into()) };
        let Some(refv) = fini_de(er) else { return non("coherence", "aucun écartement de référence (appuis du lot)".into()) };
        let gg = fini_de(g(e, "ecartementBrutMm")).unwrap_or(emv);
        let d = (gg - refv).abs();
        if !(d <= vers_nombre(g(coh, "ecartementMaxMm"))?) {
            return non("coherence", format!("écartement {} mm, à {} mm de la référence {} mm", virgule(emv), virgule(d), virgule(refv)));
        }
    }
    let cs: Vec<String> = SIDES.iter().map(|sd| virgule(fini_de(g(conf, sd)).unwrap_or(f64::NAN))).collect();
    Ok(o(vec![("corriger", b(true)), ("regle", s("ok")),
        ("raison", s(&format!("zone {zn}, écart {} mm (seuil {}), confiance {}, rails cohérents", virgule(pire), virgule(seuil), cs.join(" / "))))]))
}

/// Appel par nom (`{f, a}`).
pub(crate) fn appeler(a: &Appel) -> R<V> {
    match a.f.as_str() {
        "reglages" => reglages(a.arg(0), &if matches!(a.arg(1), V::Indefini) { s("defaut") } else { a.arg(1).clone() }),
        "correctionPermise" => correction_permise(a.arg(0)),
        "juger" => juger(a.arg(0), a.arg(1)),
        "DEFAUT" => Ok(defaut()),
        _ => hd("relecture-critere : fonction non portée"),
    }
}
