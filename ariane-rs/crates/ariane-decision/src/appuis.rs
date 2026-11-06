//! CH-068 (J4) : `src/appuis-liste.js` (B1, appuis lus dans la liste des coupes d'ESV), ligne à ligne.
//! Portées : `bordsCorps`, `mesurerT`, `noterRepere` (modifie son premier argument), `resumeRepere`, `lireReponse`, `accord`,
//! `appuis`, `compter`, `regle`, `comparer`, `resumeDecision`. Reste en JS : `politique` (reçoit une fonction).
#![warn(clippy::pedantic, missing_docs)]
#![allow(clippy::many_single_char_names, clippy::too_many_lines, clippy::cast_precision_loss, clippy::needless_range_loop)]
#![allow(clippy::neg_cmp_op_on_partial_ord, clippy::manual_range_contains, clippy::float_cmp)]
// (a+b)/2 garde l'ordre des opérations du JS (même arrondi) : `midpoint` ne le garantit pas
#![allow(clippy::manual_midpoint)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::indexing_slicing, clippy::unreachable, clippy::todo)]
use crate::j4::{cle_propriete, dist3, fin, nombre, ou_nul, r1, r1f, v3, v6, nombres};
use crate::js::{b, definir, definir_v, elems, est_objet, est_tableau, g, hd, inclut, n, nul, nullish, o, p, s, strict_egal, tab, vrai, Appel, R, INDEF};
use ariane_vba::Valeur as V;

const SIDES: [&str; 2] = ["left", "right"];
const EDGES: [&str; 6] = ["XLeftEdge", "YLeftEdge", "ZLeftEdge", "XRightEdge", "YRightEdge", "ZRightEdge"];

/// `DEFAULTS` du module.
#[must_use]
pub fn defaults() -> V {
    o(vec![("fenetre", n(5.0)), ("accordMm", n(20.0)), ("rigideMm", n(2.0)), ("repereEcartMm", n(5.0)), ("delaiPageMs", n(600.0)), ("statuts", tab(vec![s("valid")]))])
}
/// `cfg` d'un argument par défaut (`cfg=DEFAULTS`) : `undefined` vaut le défaut.
fn cfg_de(v: &V) -> V { if matches!(v, V::Indefini) { defaults() } else { v.clone() } }

/// `bordsCorps(body)`.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn bords_corps(body: &V) -> R<V> {
    if !vrai(body) || !est_objet(body) { return Ok(nul()); }
    let mut e = [0.0; 6];
    for (i, k) in EDGES.iter().enumerate() {
        let x = if est_tableau(body) { &INDEF } else { g(body, k) };
        match x { V::Nombre(v) if v.is_finite() => { if let Some(c) = e.get_mut(i) { *c = *v; } } _ => return Ok(nul()) }
    }
    Ok(o(vec![("left", nombres(&e[..3])), ("right", nombres(&e[3..]))]))
}

fn lire3(bords: &V, side: &str) -> R<Option<[f64; 3]>> { v3(g(bords, side)) }

/// `mesurerT(bords, corrige, cfg)`.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn mesurer_t(bords: &V, corrige: &V, cfg: &V) -> R<V> {
    if !vrai(bords) { return Ok(nul()); }
    let mut bv = [[0.0; 3]; 2];
    let mut cv = [[0.0; 3]; 2];
    for (k, side) in SIDES.iter().enumerate() {
        let Some(x) = lire3(bords, side)? else { return Ok(nul()) };
        let y = if nullish(corrige) { None } else { lire3(corrige, side)? };
        let Some(y) = y else { return Ok(nul()) };
        if let (Some(a), Some(c)) = (bv.get_mut(k), cv.get_mut(k)) { *a = x; *c = y; }
    }
    let d = |k: usize| -> [f64; 3] { let (a, c) = (bv.get(k).copied().unwrap_or([0.0; 3]), cv.get(k).copied().unwrap_or([0.0; 3])); [a[0] - c[0], a[1] - c[1], a[2] - c[2]] };
    let (dl, dr) = (d(0), d(1));
    let rigide = dist3(&dl, &dr) * 1000.0;
    let cfg = cfg_de(cfg);
    let seuil = nombre(p(&cfg, "rigideMm")?)?;
    let t: Vec<f64> = dl.iter().zip(dr.iter()).map(|(x, y)| (x + y) / 2.0).collect();
    Ok(o(vec![("T", nombres(&t)), ("rigideMm", n(rigide)), ("ok", b(rigide <= seuil))]))
}

/// `repere[k]` d'un repère (objet simple), pour `++` et `Math.max`.
fn champ_num(r: &V, k: &str) -> R<f64> { nombre(g(r, k)) }
/// Composante i de `T` (`T[i]`), convertie par `ToNumber` comme la soustraction de `dist`.
fn comp(t: &V, i: usize) -> R<f64> {
    match t {
        V::Chaine(_) => hd("indice d'une chaîne"),
        V::Objet(_) => nombre(crate::js::g_brut(t, &i.to_string())),
        x if est_tableau(x) => nombre(&crate::js::elem(x, i)),
        _ => Ok(f64::NAN),
    }
}

/// `noterRepere(repere, frameId, mesure, cfg)` : rend `(résultat, repère après, le résultat est le repère)`.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn noter_repere(repere: &V, frame_id: &V, mesure: &V, cfg: &V) -> R<(V, V, bool)> {
    let mut rep = repere.clone();
    if !vrai(mesure) { return Ok((rep.clone(), rep, true)); }
    let meme = vrai(repere) && strict_egal(&p(repere, "frameId")?.clone(), frame_id)?;
    if meme && !matches!(repere, V::Objet(_)) { return hd("repère non simple"); }
    if !vrai(p(mesure, "ok")?) {
        if meme { let x = champ_num(&rep, "refusees")?; definir_v(&mut rep, "refusees", n(x + 1.0)); }
        if meme { return Ok((rep.clone(), rep, true)); }
        let neuf = o(vec![("frameId", frame_id.clone()), ("T", nul()), ("paires", n(0.0)), ("ecartMaxMm", n(0.0)), ("refusees", n(1.0)), ("etat", s("sans-mesure"))]);
        return Ok((neuf, rep, false));
    }
    if !meme || !vrai(g(&rep, "T")) {
        let refusees = if meme { g(&rep, "refusees").clone() } else { n(0.0) };
        let neuf = o(vec![("frameId", frame_id.clone()), ("T", p(mesure, "T")?.clone()), ("paires", n(1.0)), ("ecartMaxMm", n(0.0)), ("refusees", refusees), ("etat", s("calibre"))]);
        return Ok((neuf, rep, false));
    }
    let (ta, tb) = (g(&rep, "T").clone(), p(mesure, "T")?.clone());
    if nullish(&tb) { return hd("T de la mesure absent"); }
    let mut d = [0.0; 3];
    for (i, c) in d.iter_mut().enumerate() { *c = comp(&ta, i)? - comp(&tb, i)?; }
    let e = ariane_js::hypot(&d) * 1000.0;
    let pa = champ_num(&rep, "paires")?;
    definir_v(&mut rep, "paires", n(pa + 1.0));
    let em = champ_num(&rep, "ecartMaxMm")?;
    definir_v(&mut rep, "ecartMaxMm", n(ariane_js::max(em, e)));
    let cfg = cfg_de(cfg);
    if e > nombre(p(&cfg, "repereEcartMm")?)? { definir_v(&mut rep, "etat", s("instable")); }
    Ok((rep.clone(), rep, true))
}

/// `resumeRepere(R)`.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn resume_repere(r: &V) -> R<V> {
    if !vrai(r) { return Ok(nul()); }
    Ok(o(vec![("etat", g(r, "etat").clone()), ("paires", g(r, "paires").clone()), ("ecartMaxMm", r1(g(r, "ecartMaxMm"))), ("refusees", g(r, "refusees").clone())]))
}

/// `int(v, max)`.
fn int_(v: &V, max: f64) -> V { match v { V::Nombre(x) if x.is_finite() && x.trunc() == *x && *x >= 0.0 && *x <= max => v.clone(), _ => nul() } }
/// `/^[\w-]{1,40}$/.test(c)`.
fn motif_raison(c: &str) -> bool { let l = c.chars().count(); (1..=40).contains(&l) && c.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-') }

/// `lireReponse(r, {cut, fenetre}={})`.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn lire_reponse(r: &V, opts: &V) -> R<V> {
    let (cut, fenetre) = match opts {
        V::Nul => return hd("déstructuration de null"),
        V::Indefini => (INDEF.clone(), n(5.0)),
        x => { let f = g(x, "fenetre"); (g(x, "cut").clone(), if matches!(f, V::Indefini) { n(5.0) } else { f.clone() }) }
    };
    if !vrai(r) || !est_objet(r) { return Ok(o(vec![("ok", b(false)), ("reason", s("sans-reponse"))])); }
    if !matches!(g(r, "ok"), V::Booleen(true)) {
        let raison = match g(r, "reason") { V::Chaine(c) if motif_raison(c) => s(c), _ => s("refus") };
        return Ok(o(vec![("ok", b(false)), ("reason", raison)]));
    }
    let tv = g(r, "table");
    let t = if vrai(tv) && est_objet(tv) { tv.clone() } else { o(vec![]) };
    let tt = |k: &str| if est_tableau(&t) { &INDEF } else { g(&t, k) };
    let table = o(vec![("lignes", int_(tt("lignes"), 1e7)), ("pages", int_(tt("pages"), 1e6)), ("fraiches", int_(tt("fraiches"), 1e7)),
        ("debut", b(matches!(tt("debut"), V::Booleen(true)))), ("rompue", b(matches!(tt("rompue"), V::Booleen(true)))),
        ("tronquee", b(matches!(tt("tronquee"), V::Booleen(true)))), ("tables", int_(tt("tables"), 100.0))]);
    let gv = g(r, "geo");
    let geo_o = if vrai(gv) && est_objet(gv) { Some(gv) } else { None };
    let geo = match geo_o {
        Some(gg) if !matches!(int_(g(gg, "index"), 1e7), V::Nul) && matches!(g(gg, "mm"), V::Nombre(x) if x.is_finite() && *x >= 0.0) =>
            o(vec![("index", g(gg, "index").clone()), ("mm", g(gg, "mm").clone()), ("secondMm", if fin(g(gg, "secondMm")) { g(gg, "secondMm").clone() } else { nul() })]),
        _ => nul(),
    };
    let fen = nombre(&fenetre)?;
    let cutn = nombre(&cut)?;
    let mut rows = vec![];
    let mut vus: Vec<u64> = vec![];
    let rv = g(r, "rows");
    if est_tableau(rv) {
        let t = elems(rv).unwrap_or_default();
        let fin_ = crate::j4::borne_slice(t.len(), 2.0 * fen + 1.0);
        for x in t.iter().take(fin_) {
            let x = x.clone().unwrap_or(V::Indefini);
            let iv = if nullish(&x) { &INDEF } else { g(&x, "i") };
            let i = int_(iv, 1e7);
            let V::Nombre(iff) = i else { continue };
            if (iff - cutn).abs() > fen || vus.contains(&ariane_js::cle_same_value_zero(iff)) { continue; }
            vus.push(ariane_js::cle_same_value_zero(iff));
            let e = v6(g(&x, "e"))?;
            let statut = match g(&x, "s") { V::Chaine(c) if ["valid", "invalid", "skipped"].contains(&c.as_str()) => s(c), _ => s("autre") };
            rows.push(o(vec![("i", i.clone()), ("statut", statut), ("operateur", b(matches!(g(&x, "t"), V::Booleen(true)))), ("vu", b(matches!(g(&x, "v"), V::Booleen(true)))),
                ("fraiche", b(matches!(g(&x, "f"), V::Booleen(true)))),
                ("bords", match e { Some(e) => o(vec![("left", nombres(&e[..3])), ("right", nombres(&e[3..]))]), None => nul() })]));
        }
    }
    Ok(o(vec![("ok", b(true)), ("table", table), ("geo", geo), ("rows", tab(rows))]))
}

/// `accord(rep, cut, cfg)`.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn accord(rep: &V, cut: &V, cfg: &V) -> R<V> {
    let geo = if nullish(rep) { INDEF.clone() } else { g(rep, "geo").clone() };
    let cfg = cfg_de(cfg);
    let raison = if vrai(&geo) {
        let table = p(rep, "table")?;
        if !vrai(p(table, "debut")?) { s("debut-non-vu") } else if vrai(p(table, "rompue")?) { s("table-rompue") }
        else if !strict_egal(g(&geo, "index"), cut)? { s("indice-different") }
        else if nombre(g(&geo, "mm"))? > nombre(p(&cfg, "accordMm")?)? { s("trop-loin") } else { nul() }
    } else { s("sans-geometrie") };
    let ecart = if vrai(&geo) { n(nombre(g(&geo, "index"))? - nombre(cut)?) } else { nul() };
    Ok(o(vec![("ok", b(matches!(raison, V::Nul))), ("raison", raison), ("indiceGeo", ou_nul(if nullish(&geo) { &INDEF } else { g(&geo, "index") })),
        ("ecartIndice", ecart), ("geoMm", r1(if nullish(&geo) { &INDEF } else { g(&geo, "mm") })), ("secondMm", r1(if nullish(&geo) { &INDEF } else { g(&geo, "secondMm") }))]))
}

/// Itérable `rows||[]` (tableau ; autre valeur vraie : le JS lève).
fn liste_ou_vide(rows: &V) -> R<Vec<V>> {
    if !vrai(rows) { return Ok(vec![]); }
    if !est_tableau(rows) { return hd("liste non tabulaire"); }
    Ok(elems(rows).unwrap_or_default().into_iter().map(|x| x.unwrap_or(V::Indefini)).collect())
}

/// `appuis(rows, T, identity, cfg)`.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn appuis(rows: &V, t: &V, identity: &V, cfg: &V) -> R<V> {
    let Some(tv) = v3(t)? else { return Ok(tab(vec![])) };
    let cfg = cfg_de(cfg);
    let mut out = vec![];
    // `filter` saute les trous
    let presents: Vec<V> = if !vrai(rows) { vec![] } else if est_tableau(rows) { crate::js::presents(rows) } else { return hd("liste non tabulaire") };
    for x in presents {
        if strict_egal(p(&x, "i")?, p(identity, "cut")?)? { continue; }
        let st = p(&cfg, "statuts")?;
        if !est_tableau(st) { return hd("statuts non tabulaires"); }
        if !inclut(st, g(&x, "statut"))? { continue; }
        let bords = g(&x, "bords");
        if !vrai(bords) { continue; }
        let mut pos = vec![];
        let mut ok = true;
        for side in SIDES { if let Some(v) = v3(g(bords, side))? { pos.push((side, v)); } else { ok = false; break; } }
        if !ok { continue; }
        let positions = o(pos.into_iter().map(|(side, v)| (side, nombres(&[v[0] - tv[0], v[1] - tv[1], v[2] - tv[2]]))).collect());
        out.push(o(vec![("identity", o(vec![("part", g(identity, "part").clone()), ("cut", g(&x, "i").clone()), ("frameId", ou_nul(g(identity, "frameId")))])),
            ("positions", positions), ("stage", s("list-validated"))]));
    }
    Ok(tab(out))
}

/// `compter(rows, cut)`.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn compter(rows: &V, cut: &V) -> R<V> {
    let V::Objet(mut e) = o(vec![("lignes", n(0.0)), ("valid", n(0.0)), ("invalid", n(0.0)), ("skipped", n(0.0)), ("autre", n(0.0)), ("operateur", n(0.0)), ("fraiches", n(0.0)), ("sansBords", n(0.0))]) else { return hd("objet") };
    let plus = |e: &mut Vec<(String, V)>, k: &str| -> R<()> {
        let x = e.iter().find(|(c, _)| c == k).map_or(V::Indefini, |(_, v)| v.clone());
        let v = nombre(&x)? + 1.0;
        definir(e, k, n(v));
        Ok(())
    };
    for x in liste_ou_vide(rows)? {
        if strict_egal(p(&x, "i")?, cut)? { continue; }
        plus(&mut e, "lignes")?;
        let k = cle_propriete(g(&x, "statut"))?;
        plus(&mut e, &k)?;
        if vrai(g(&x, "operateur")) { plus(&mut e, "operateur")?; }
        if vrai(g(&x, "fraiche")) { plus(&mut e, "fraiches")?; }
        if !vrai(g(&x, "bords")) { plus(&mut e, "sansBords")?; }
    }
    Ok(V::Objet(e))
}

/// `regle(d0)`.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn regle(d0: &V) -> R<V> {
    let st = if nullish(d0) { &INDEF } else { g(d0, "stage") };
    if matches!(st, V::Chaine(c) if c == "deferred") { return Ok(s("dernier-recours")); }
    if matches!(st, V::Chaine(c) if c == "first-pass") && nullish(g(d0, "guardMm")) { return Ok(s("garde-premier-passage")); }
    Ok(s("inchange"))
}

fn pose(d: &V) -> R<Option<[[f64; 3]; 2]>> {
    if !vrai(d) || matches!(g(d, "stage"), V::Chaine(c) if c == "deferred") { return Ok(None); }
    let pz = g(d, "positions");
    if !vrai(pz) { return Ok(None); }
    let Some(l) = v3(g(pz, "left"))? else { return Ok(None) };
    let Some(r) = v3(g(pz, "right"))? else { return Ok(None) };
    Ok(Some([l, r]))
}

/// `comparer(d0, d1)` (deux valeurs décodées distinctes : `d0===d1` n'est vrai qu'entre primitives égales).
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn comparer(d0: &V, d1: &V) -> R<V> {
    let (p0, p1) = (pose(d0)?, pose(d1)?);
    let ecart = match (p0, p1) {
        (Some(a), Some(c)) => r1f(ariane_js::max(dist3(&a[0], &c[0]) * 1000.0, dist3(&a[1], &c[1]) * 1000.0)),
        _ => nul(),
    };
    let identiques = if est_objet(d0) && est_objet(d1) { false } else { strict_egal(d0, d1)? };
    let changement = if identiques { "aucun" } else if p0.is_some() && p1.is_none() { "pose-retiree" } else if p0.is_none() && p1.is_some() { "pose-ajoutee" }
        else if p0.is_some() && matches!(ecart, V::Nombre(x) if x > 1.0) { "pose-deplacee" } else { "aucun" };
    Ok(o(vec![("changement", s(changement)), ("ecartPoseMm", ecart)]))
}

/// `x.slice(0, 12)` d'une valeur vraie (tableau : trous gardés ; chaîne : unités UTF-16).
fn tranche12(v: &V) -> R<V> {
    match v {
        V::Chaine(c) => Ok(s(&crate::js::tranche_utf16(c, 12)?)),
        x if est_tableau(x) => Ok(V::Tableau(elems(x).unwrap_or_default().into_iter().take(12).collect())),
        _ => hd("slice d'un non-tableau"),
    }
}

/// `resumeDecision(d)`.
///
/// # Errors
/// `HorsDomaine` hors du domaine du port.
pub fn resume_decision(d: &V) -> R<V> {
    if !vrai(d) { return Ok(nul()); }
    let au = g(d, "anchorsUsed");
    let au = if vrai(au) { tranche12(au)? } else { tab(vec![]) };
    let va = g(d, "validatedAnchors");
    let va = if vrai(va) { tranche12(va)? } else { nul() };
    Ok(o(vec![("stage", ou_nul(g(d, "stage"))), ("reason", ou_nul(g(d, "reason"))), ("anchorsUsed", au), ("validatedAnchors", va),
        ("guardMm", ou_nul(g(d, "guardMm"))), ("fromPredictionMm", ou_nul(g(d, "fromPredictionMm"))), ("gaugeMm", ou_nul(g(d, "gaugeMm")))]))
}

/// Aiguillage `{f, a}` du module (numéro `APPUIS_LISTE`).
///
/// # Errors
/// `Js` ou `HorsDomaine`, comme les fonctions portées.
pub fn appeler(a: &Appel) -> R<V> {
    match a.f.as_str() {
        "bordsCorps" => bords_corps(a.arg(0)),
        "mesurerT" => mesurer_t(a.arg(0), a.arg(1), a.arg(2)),
        "noterRepere" => { let (r, e, meme) = noter_repere(a.arg(0), a.arg(1), a.arg(2), a.arg(3))?; Ok(o(vec![("r", r), ("e", e), ("meme", b(meme))])) }
        "resumeRepere" => resume_repere(a.arg(0)),
        "lireReponse" => lire_reponse(a.arg(0), a.arg(1)),
        "accord" => accord(a.arg(0), a.arg(1), a.arg(2)),
        "appuis" => appuis(a.arg(0), a.arg(1), a.arg(2), a.arg(3)),
        "compter" => compter(a.arg(0), a.arg(1)),
        "regle" => regle(a.arg(0)),
        "comparer" => comparer(a.arg(0), a.arg(1)),
        "resumeDecision" => resume_decision(a.arg(0)),
        _ => hd("appuis-liste : fonction non portée"),
    }
}
