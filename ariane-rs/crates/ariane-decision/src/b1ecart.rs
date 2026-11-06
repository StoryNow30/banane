//! CH-068 (J4) : `src/voie-b1-ecart.js` (règle de voie « B1-ECART », en ombre), ligne à ligne.
//! Portées (numéro `VOIE_B1_ECART`) : `lignesDeTable`, `repereDepuisLigne`, `ecartementReference`, `railTrouve`, `solutionsEcartement`,
//! `poseMmDe`, `ecartPoses`, `evaluer` (mémoire de l'ombre et moteur GCV1 résolus par la façade : la mémoire voyage en
//! `{batchId, poses, profondeurs:[[cut, profondeur]…]}`, le moteur en son état, comme pour `decideCut`).
//! Restent en JS : `relancerDepuis`, `sourceEcart` (reçoivent une fonction ; portées ici en interne), `creerMemoire` (rend un `Map`).
#![allow(clippy::many_single_char_names, clippy::too_many_lines, clippy::cast_precision_loss, clippy::needless_range_loop)]
#![allow(clippy::neg_cmp_op_on_partial_ord, clippy::manual_range_contains, clippy::float_cmp)]
// (a+b)/2 garde l'ordre des opérations du JS (même arrondi) : `midpoint` ne le garantit pas
#![allow(clippy::manual_midpoint)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::indexing_slicing, clippy::unreachable, clippy::todo)]
use crate::appuis;
use crate::j4::{iter_vals, med, nombre, nombres, opt, ou_nul, r1, r2f, svz, texte, texte_k};
use crate::js::{b, definir, distance_v, elem, elems, entier, est_tableau, etaler, g, g_brut, hd, n, nul, nullish, o, p, s, strict_egal, tab, vrai, Appel, R, INDEF};
use crate::lot;
use crate::recentree;
use crate::shadow::Etat;
use ariane_js::Echec;
use ariane_vba::Valeur as V;

const SIDES: [&str; 2] = ["left", "right"];
/// `VERSION`.
pub const VERSION: &str = "voie-b1-ecart-ombre-v1";

/// `REGLAGE`.
#[must_use]
pub fn reglage() -> V {
    o(vec![("fenetreListe", n(5.0)), ("fenetreMm", n(30.0)), ("choixMm", n(15.0)), ("accordMm", n(20.0)), ("gRefDefautMm", n(1435.0)), ("essaisMax", n(4.0)),
        ("solutionPorteeMm", n(320.0)), ("solutionPasMm", n(1.0)), ("solutionTolMm", n(0.5))])
}
fn defaut(v: &V, d: impl FnOnce() -> V) -> V { if matches!(v, V::Indefini) { d() } else { v.clone() } }
fn est(v: &V, t: &str) -> bool { matches!(v, V::Chaine(c) if c == t) }
/// `ToInt32(v)` (`x|0`) d'une primitive non textuelle.
fn int32(v: &V) -> R<i64> {
    let x = nombre(v)?;
    if !x.is_finite() { return Ok(0); }
    let t = x.trunc().rem_euclid(4_294_967_296.0);
    #[allow(clippy::cast_possible_truncation)]
    let u = t as i64;
    Ok(if u >= 2_147_483_648 { u - 4_294_967_296 } else { u })
}

// ---------------------------------------------------------------- liste d'ESV

/// `lignesDeTable(table, cut, fenetre)`.
///
/// # Errors
/// `HorsDomaine`.
pub fn lignes_de_table(table: &V, cut: &V, fenetre: &V) -> R<Vec<V>> {
    let mut rows = vec![];
    if !vrai(table) || !entier(g(table, "n")) || !est_tableau(g(table, "st")) || !est_tableau(g(table, "ed")) || !entier(cut) { return Ok(rows); }
    let fen = if matches!(fenetre, V::Indefini) { 5.0 } else { nombre(fenetre)? };
    let (tn, c) = (nombre(g(table, "n"))?, nombre(cut)?);
    let (debut, fin_) = (ariane_js::max(0.0, c - fen), ariane_js::min(tn - 1.0, c + fen));
    if debut.trunc() != debut && debut <= fin_ { return hd("fenêtre fractionnaire"); }
    if fin_ - debut > 1.0e6 { return hd("fenêtre démesurée"); }
    let (st, ed, fl) = (g(table, "st"), g(table, "ed"), g(table, "fl"));
    let ed_e = elems(ed).unwrap_or_default();
    let mut i = debut;
    while i <= fin_ {
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        let iu = i as usize;
        let e: Vec<&Option<V>> = ed_e.iter().skip(iu.saturating_mul(6)).take(6).collect();
        let flv = if vrai(fl) {
            match fl { V::Chaine(_) => return hd("drapeaux textuels"), V::Objet(_) => g_brut(fl, &iu.to_string()).clone(), x if est_tableau(x) => elem(x, iu), _ => V::Indefini }
        } else { fl.clone() };
        if matches!(flv, V::Chaine(_) | V::Objet(_)) || crate::js::est_tableau(&flv) { return hd("drapeau non numérique"); }
        let f = int32(&flv)?;
        let statut = match elem(st, iu) {
            V::Nombre(x) => if x == 0.0 { "valid" } else if x == 1.0 { "invalid" } else if x == 2.0 { "skipped" } else { "autre" },
            V::Chaine(_) => return hd("statut textuel"),
            V::Objet(_) | V::Tableau(_) | V::Nombres(_) | V::Booleens(_) | V::Bloc { .. } | V::Erreur { .. } => return hd("statut objet"),
            _ => "autre",
        };
        let mut bords = nul();
        if e.len() == 6 {
            let mut x = [0.0f64; 6];
            let mut ok = true;
            for (k, v) in e.iter().enumerate() {
                match v { None => return hd("bords troués"), Some(V::Nombre(y)) if y.is_finite() => { if let Some(c_) = x.get_mut(k) { *c_ = *y; } } Some(_) => { ok = false; break; } }
            }
            if ok { bords = o(vec![("left", nombres(&[x[0] / 1e4, x[1] / 1e4, x[2] / 1e4])), ("right", nombres(&[x[3] / 1e4, x[4] / 1e4, x[5] / 1e4]))]); }
        }
        rows.push(o(vec![("i", n(i)), ("statut", s(statut)), ("operateur", b(f & 1 != 0)), ("vu", b(f & 2 != 0)), ("fraiche", b(false)), ("bords", bords)]));
        i += 1.0;
    }
    Ok(rows)
}

/// `repereDepuisLigne(rows, cut, rails)`.
///
/// # Errors
/// `HorsDomaine`.
pub fn repere_depuis_ligne(rows: &V, cut: &V, rails: &V) -> R<V> {
    let rep = |etat: &str, t: V, rig: V| o(vec![("etat", s(etat)), ("T", t), ("rigideMm", rig)]);
    let liste = if vrai(rows) { if !est_tableau(rows) { return hd("lignes non tabulaires"); } iter_vals(rows) } else { vec![] };
    let mut ligne = None;
    for x in liste { if strict_egal(p(&x, "i")?, cut)? { ligne = Some(x); break; } }
    let Some(ligne) = ligne else { return Ok(rep("sans-ligne", nul(), nul())) };
    let bords = g(&ligne, "bords");
    if !vrai(bords) { return Ok(rep("sans-bords", nul(), nul())); }
    if !est(g(&ligne, "statut"), "invalid") || vrai(g(&ligne, "fraiche")) { return Ok(rep("ligne-non-depart", nul(), nul())); }
    let corrige = o(vec![("left", p(p(rails, "left")?, "positionSceneRelative")?.clone()), ("right", p(p(rails, "right")?, "positionSceneRelative")?.clone())]);
    let m = appuis::mesurer_t(bords, &corrige, &INDEF)?;
    if !vrai(&m) { return Ok(rep("mesure-impossible", nul(), nul())); }
    let ok = vrai(g(&m, "ok"));
    Ok(rep(if ok { "calibre" } else { "non-rigide" }, if ok { g(&m, "T").clone() } else { nul() }, r1(g(&m, "rigideMm"))))
}

/// `ecartementReference(table, cut, ancres, reglage)` : `{mm, source}`.
///
/// # Errors
/// `HorsDomaine`.
pub fn ecartement_reference(table: &V, cut: &V, ancres: &V, rg: &V) -> R<V> {
    if vrai(table) {
        let r = crate::l1e::reference_ecartement(table, cut, &INDEF)?;
        if vrai(&r) && crate::js::fini(g(&r, "mm")) { return Ok(o(vec![("mm", g(&r, "mm").clone()), ("source", s("liste"))])); }
    }
    let mut gs = vec![];
    let liste = if vrai(ancres) { if !est_tableau(ancres) { return hd("ancres non tabulaires"); } crate::js::presents(ancres) } else { vec![] };
    for a in &liste {
        if nullish(a) { return hd("appui absent"); }
        let (l, r) = (opt(a, &["positions", "left"]), opt(a, &["positions", "right"]));
        if vrai(l) && vrai(r) { gs.push(distance_v(l, r)? * 1000.0); }
    }
    if !gs.is_empty() { return Ok(o(vec![("mm", r2f(med(&gs)?.unwrap_or(f64::NAN))), ("source", s("appuis"))])); }
    let rg = defaut(rg, reglage);
    Ok(o(vec![("mm", p(&rg, "gRefDefautMm")?.clone()), ("source", s("defaut"))]))
}

// ---------------------------------------------------------------- complément par l'écartement

/// `railTrouve(rail)` : `{delta, origine}` ou `null`.
#[must_use]
pub fn rail_trouve(rail: &V) -> V {
    if !vrai(rail) || !matches!(g(rail, "ok"), V::Booleen(true)) { return nul(); }
    let nx = g(rail, "next");
    if est(opt(nx, &["status"]), "candidate") && est_tableau(g(nx, "delta")) { return o(vec![("delta", g(nx, "delta").clone()), ("origine", s("publie"))]); }
    let gd = opt(rail, &["pairGauge", "publishedBeforeGate", "delta"]);
    if est_tableau(gd) { return o(vec![("delta", gd.clone()), ("origine", s("avant-garde"))]); }
    let a = g(rail, "astar");
    if est(opt(a, &["status"]), "candidate") && est_tableau(g(a, "delta")) { return o(vec![("delta", g(a, "delta").clone()), ("origine", s("astar"))]); }
    nul()
}

fn autre_de(sur: &V) -> &'static str { if est(sur, "left") { "right" } else { "left" } }

/// `solutionsEcartement(cap, sur, deltaSur, gRef, o)` : `[{lat, vert}]`.
///
/// # Errors
/// `Js` (projection non finie) ou `HorsDomaine`.
pub fn solutions_ecartement(cap: &V, sur: &V, delta_sur: &V, gref: &V, ov: &V) -> R<Vec<V>> {
    let ov = defaut(ov, reglage);
    let autre = autre_de(sur);
    let rails = p(cap, "rails")?;
    let ks = crate::j4::cle_propriete(sur)?;
    let rs = if matches!(rails, V::Objet(_)) { g_brut(rails, &ks) } else { &INDEF };
    if nullish(rs) { return hd("rail sûr absent"); }
    let pos_sur = lot::position_of(rs, delta_sur)?;
    let vert = elem(delta_sur, 2);
    let V::Nombre(vert) = vert else { return hd("hauteur du rail sûr non numérique") };
    let ra = g(rails, autre);
    if nullish(ra) { return hd("autre rail absent"); }
    let gref = nombre(gref)?;
    let gf = |a: f64| -> R<f64> { Ok(distance_v(&lot::position_of(ra, &nombres(&[0.0, a / 1000.0, vert]))?, &pos_sur)? * 1000.0) };
    let (portee, pas, tol) = (nombre(p(&ov, "solutionPorteeMm")?)?, nombre(g(&ov, "solutionPasMm"))?, nombre(g(&ov, "solutionTolMm"))?);
    if !(pas > 0.0) || !portee.is_finite() || 2.0 * portee / pas > 2.0e5 { return hd("balayage démesuré"); }
    let mut sols = vec![];
    let (mut prev, mut prev2): (Option<(f64, f64)>, Option<(f64, f64)>) = (None, None);
    let mut a = -portee;
    while a <= portee {
        let e = (gf(a)? - gref).abs();
        if let (Some(pv), Some(p2)) = (prev, prev2) { if pv.1 <= p2.1 && pv.1 <= e && pv.1 <= 5.0 { sols.push(pv.0); } }
        prev2 = prev;
        prev = Some((a, e));
        a += pas;
    }
    let mut out = vec![];
    for a0 in sols {
        let (mut lo, mut hi) = (a0 - pas, a0 + pas);
        for _ in 0..20 {
            let m = (lo + hi) / 2.0;
            let ml = gf(lo)? - gref;
            let mm = gf(m)? - gref;
            if ariane_js::sign(ml) == ariane_js::sign(mm) { lo = m; } else { hi = m; }
        }
        let a = (lo + hi) / 2.0;
        if (gf(a)? - gref).abs() <= tol { out.push(o(vec![("lat", n(a)), ("vert", n(vert * 1000.0))])); }
    }
    Ok(out)
}

/// `poseMmDe(cap, decision)`.
///
/// # Errors
/// `Js` ou `HorsDomaine`.
pub fn pose_mm_de(cap: &V, decision: &V) -> R<V> {
    if !vrai(opt(decision, &["positions"])) { return Ok(nul()); }
    let pz = g(decision, "positions");
    let mut e = vec![];
    for side in SIDES {
        let l = recentree::local_mm(p(p(cap, "rails")?, side)?, g(pz, side))?;
        e.push((side, nombres(&[l[1], l[2]])));
    }
    Ok(o(e))
}
fn comp(v: &V, i: usize) -> R<f64> {
    match v { V::Chaine(_) => hd("indice d'une chaîne"), V::Objet(_) => nombre(g_brut(v, &i.to_string())), x if est_tableau(x) => nombre(&elem(x, i)), V::Indefini | V::Nul => hd("indice de null"), _ => Ok(f64::NAN) }
}
/// `ecartPoses(a, b)`.
///
/// # Errors
/// `HorsDomaine`.
pub fn ecart_poses(a: &V, c: &V) -> R<f64> {
    let mut m = f64::NEG_INFINITY;
    for side in SIDES {
        let (x, y) = (p(a, side)?, p(c, side)?);
        m = ariane_js::max(m, ariane_js::hypot(&[comp(x, 0)? - comp(y, 0)?, comp(x, 1)? - comp(y, 1)?]));
    }
    Ok(m)
}

/// `posee(d)` : étage `window` ou `choice` avec des positions.
fn posee(d: &V) -> bool { vrai(d) && (est(g(d, "stage"), "window") || est(g(d, "stage"), "choice")) && vrai(g(d, "positions")) }

// ---------------------------------------------------------------- l'ombre d'un cut différé

/// Mémoire de l'ombre (`creerMemoire`) : `poses` et `profondeurs` (`Map`, en paires dans l'ordre d'insertion).
pub struct Memoire { batch_id: V, poses: Vec<V>, profondeurs: Vec<(V, V)> }
impl Memoire {
    fn lire(v: &V) -> R<Memoire> {
        if !matches!(v, V::Objet(_)) { return hd("mémoire illisible"); }
        let poses = g(v, "poses");
        if !est_tableau(poses) { return hd("poses illisibles"); }
        let mut profondeurs = vec![];
        let pv = g(v, "profondeurs");
        if !est_tableau(pv) { return hd("profondeurs illisibles"); }
        for e in iter_vals(pv) {
            let (k, x) = (elem(&e, 0), elem(&e, 1));
            if crate::js::est_objet(&k) { return hd("clé objet"); }
            let k = if matches!(k, V::Nombre(z) if z == 0.0) { n(0.0) } else { k };
            profondeurs.push((k, x));
        }
        Ok(Memoire { batch_id: g(v, "batchId").clone(), poses: elems(poses).unwrap_or_default().into_iter().map(|x| x.unwrap_or(V::Indefini)).collect(), profondeurs })
    }
    fn get(&self, c: &V) -> R<V> {
        for (k, x) in &self.profondeurs { if svz(k, c)? { return Ok(x.clone()); } }
        Ok(V::Indefini)
    }
    fn valeur(&self) -> V {
        o(vec![("batchId", self.batch_id.clone()), ("poses", tab(self.poses.clone())),
            ("profondeurs", tab(self.profondeurs.iter().map(|(k, x)| tab(vec![k.clone(), x.clone()])).collect()))])
    }
}
/// Clé `part|frameId|cut` d'`appuisOmbre`.
fn cle_appui(a: &V) -> R<String> {
    let id = p(a, "identity")?;
    if nullish(id) { return hd("identité absente"); }
    let fr = g(id, "frameId");
    Ok(format!("{}|{}|{}", texte(g(id, "part"))?, if nullish(fr) { String::new() } else { texte(fr)? }, texte(g(id, "cut"))?))
}
/// `V.appuisOmbre(mem, reels)`.
fn appuis_ombre(mem: &Memoire, reels: &V) -> R<Vec<V>> {
    let reels = if vrai(reels) { if !est_tableau(reels) { return hd("appuis réels non tabulaires"); } iter_vals(reels) } else { vec![] };
    let mut vus = vec![];
    for a in &reels { vus.push(cle_appui(a)?); }
    let mut out = vec![];
    for x in &mem.poses { if !vus.contains(&cle_appui(x)?) { out.push(x.clone()); } }
    out.extend(reels);
    Ok(out)
}
fn meme(a: &V, c: &V) -> R<bool> { Ok(vrai(a) && vrai(c) && strict_egal(g(a, "part"), g(c, "part"))? && strict_egal(&ou_nul(g(a, "frameId")), &ou_nul(g(c, "frameId")))?) }
/// `V.doitRecalculer(mem, identity, decisionReelle)` (portée : `max(gap, frameGap, gaugeGap)` = 10).
fn doit_recalculer(mem: &Memoire, identity: &V, dr: &V) -> R<bool> {
    let st = opt(dr, &["stage"]);
    if vrai(st) && !est(st, "deferred") { return Ok(true); }
    let ic = g(identity, "cut");
    for x in &mem.poses {
        let pi = p(x, "identity")?;
        if !meme(pi, identity)? { continue; }
        let pc = p(pi, "cut")?;
        if strict_egal(pc, ic)? { continue; }
        if (nombre(pc)? - nombre(ic)?).abs() <= 10.0 { return Ok(true); }
    }
    Ok(false)
}
/// `L.commandsPositions(decision, {action:'lot'})`.
fn commande_positions_lot(d: &V) -> bool {
    if !vrai(opt(d, &["anchor"])) || !vrai(g(d, "positions")) { return false; }
    let st = g(d, "stage");
    est(st, "window") || est(st, "crossing")
}
/// Raison courte d'une décision qui ne pose pas : `String(reason||stage||'?').slice(0,40)`.
fn raison40(d: &V) -> R<String> {
    let r = g(d, "reason");
    let x = if vrai(r) { r.clone() } else if vrai(g(d, "stage")) { g(d, "stage").clone() } else { s("?") };
    texte_k(&x, 40)
}

struct Contexte<'a> { et: &'a Etat, gl: &'a lot::Globaux }
impl Contexte<'_> {
    /// `decider(a)` : `{decision, relance}` (le moteur relancé capté).
    fn decider(&self, a: &V) -> R<(V, V)> {
        let mut rel = None;
        let d = lot::decide_cut_r(a, self.et, self.gl, &mut rel)?;
        Ok((d, rel.unwrap_or(V::Nul)))
    }
}
fn avec(base: &V, t: Vec<(&str, V)>) -> R<V> { let mut e = vec![]; etaler(&mut e, base)?; for (k, v) in t { definir(&mut e, k, v); } Ok(V::Objet(e)) }

/// Une pose de la source « ecart » (le JS y ajoute `sur` et `origine`, que `evaluer` ne lit pas).
struct PoseEcart { decision: V, relance: V, pose: V }
/// `sourceEcart(decider, args, cap, science, gRef, opts, 'les-deux', reglage)`.
fn source_ecart(cx: &Contexte, args: &V, cap: &V, science: &V, gref: &V, opts: &V, rg: &V) -> R<(Option<PoseEcart>, V, f64, usize)> {
    let rails = p(science, "rails")?;
    let mut trouves = vec![];
    for side in SIDES { let t = rail_trouve(g(rails, side)); if vrai(&t) { trouves.push((side, t)); } }
    if trouves.is_empty() { return Ok((None, s("ecart:aucun-rail-trouve"), 0.0, 0)); }
    let mut poses: Vec<PoseEcart> = vec![];
    let mut essais = 0.0f64;
    let essais_max = nombre(p(rg, "essaisMax")?)?;
    for (sur, t) in trouves {
        let autre = if sur == "left" { "right" } else { "left" };
        let delta = g(&t, "delta");
        for sol in solutions_ecartement(cap, &s(sur), delta, gref, rg)? {
            if essais >= essais_max { break; }
            essais += 1.0;
            let decal = o(vec![(sur, nombres(&[nombre(&elem(delta, 1))? * 1000.0, nombre(&elem(delta, 2))? * 1000.0])), (autre, nombres(&[nombre(g(&sol, "lat"))?, nombre(g(&sol, "vert"))?]))]);
            let a = avec(args, vec![("anchors", recentree::appuis_depuis_decalage(cap, &decal)?), ("options", opts.clone())])?;
            let (d, rel) = cx.decider(&a)?;
            if posee(&d) { let pose = pose_mm_de(cap, &d)?; poses.push(PoseEcart { decision: d, relance: rel, pose }); }
        }
    }
    if poses.is_empty() { return Ok((None, s("ecart:aucune-pose-qualifiee"), essais, 0)); }
    let accord = nombre(g(rg, "accordMm"))?;
    let mut groupes: Vec<usize> = vec![];
    for (i, x) in poses.iter().enumerate() {
        let mut proche = false;
        for &j in &groupes { if let Some(gp) = poses.get(j) { if ecart_poses(&gp.pose, &x.pose)? <= accord { proche = true; break; } } }
        if !proche { groupes.push(i); }
    }
    if groupes.len() > 1 { return Ok((None, s("ecart:plusieurs"), essais, 0)); }
    let nb = poses.len();
    let Some(&i0) = groupes.first() else { return hd("groupe") };
    let pe = poses.into_iter().nth(i0);
    Ok((pe, nul(), essais, nb))
}

/// `evaluer({mem, capture, science, Shadow, table, ancresReelles, decisionReelle, commandeReelle, reglage})` : `({evenement, r}, mémoire après)`.
///
/// # Errors
/// `HorsDomaine` (la façade rejoue le JS) ; une exception reproduite du JS est rendue comme le JS : événement `erreur`.
pub fn evaluer(arg: &V, et: &Etat, gl: &lot::Globaux) -> R<(V, V)> {
    if nullish(arg) { return hd("déstructuration de null/undefined"); }
    for k in ["Shadow"] { if !matches!(g(arg, k), V::Indefini) { return hd("moteur non résolu"); } }
    let mut mem = Memoire::lire(g(arg, "mem"))?;
    let capture = g(arg, "capture");
    let science = g(arg, "science");
    let table = defaut(g(arg, "table"), nul);
    let ancres_reelles = defaut(g(arg, "ancresReelles"), || tab(vec![]));
    let dr = defaut(g(arg, "decisionReelle"), nul);
    let cr = defaut(g(arg, "commandeReelle"), nul);
    let rgv = defaut(g(arg, "reglage"), reglage);
    let identity = p(capture, "identity")?;
    let reason = opt(&dr, &["reason"]);
    let commande = if vrai(&cr) {
        let rs = g(&cr, "reason");
        s(&crate::js::tranche_utf16(&format!("{}:{}", texte(g(&cr, "action"))?, if nullish(rs) { String::new() } else { texte(rs)? }), 60)?)
    } else { nul() };
    let base = vec![("version", s(VERSION)), ("identity", o(vec![("part", ou_nul(p(identity, "part")?)), ("cut", ou_nul(g(identity, "cut")))])),
        ("reel", o(vec![("stage", ou_nul(opt(&dr, &["stage"]))), ("reason", if nullish(reason) { nul() } else { s(&texte_k(reason, 80)?) }), ("commande", commande)]))];
    let cx = Contexte { et, gl };
    match evaluer_corps(&cx, &mut mem, capture, science, &table, &ancres_reelles, &dr, &rgv, identity, &base) {
        Ok(v) => Ok((v, mem.valeur())),
        Err(Echec::Js { message, .. }) => {
            let mut e = base.clone();
            e.extend([("etat", s("erreur")), ("source", nul()), ("poseMm", nul()), ("verdict", o(vec![("posable", b(false)), ("raison", s("erreur"))])), ("message", s(&crate::js::tranche_utf16(&message, 160)?))]);
            Ok((o(vec![("evenement", o(e)), ("r", nul())]), mem.valeur()))
        }
        Err(e) => Err(e),
    }
}

#[allow(clippy::too_many_arguments)]
fn evaluer_corps(cx: &Contexte, mem: &mut Memoire, capture: &V, science: &V, table: &V, ancres_reelles: &V, dr: &V, rgv: &V, identity: &V, base: &[(&str, V)]) -> R<V> {
    let mut oe = vec![];
    etaler(&mut oe, &reglage())?;
    etaler(&mut oe, rgv)?;
    let ov = V::Objet(oe);
    let opts = o(vec![("guardMm", g(&ov, "fenetreMm").clone()), ("chooseMm", g(&ov, "choixMm").clone())]);
    let sci = o(vec![("rails", p(science, "rails")?.clone()), ("summary", g(science, "summary").clone())]);
    let ar = if vrai(ancres_reelles) { if !est_tableau(ancres_reelles) { return hd("ancres non tabulaires"); } V::Tableau(elems(ancres_reelles).unwrap_or_default()) } else { tab(vec![]) };
    let args = o(vec![("capture", capture.clone()), ("science", sci.clone()), ("anchors", ar)]);
    let ancres = tab(appuis_ombre(mem, ancres_reelles)?);
    let mut de_ombre: Vec<V> = vec![];
    for x in &mem.poses { de_ombre.push(p(p(x, "identity")?, "cut")?.clone()); }
    let dans_ombre = |c: &V| -> R<bool> { for x in &de_ombre { if svz(x, c)? { return Ok(true); } } Ok(false) };
    let mut d: Option<(V, V)> = None;
    let mut source = nul();
    let mut raisons: Vec<String> = vec![];
    let mut essais = 0.0f64;
    let mut appuis_b1: Vec<V> = vec![];
    // 1. la voie du lot et la chaîne de l'ombre
    if doit_recalculer(mem, identity, dr)? {
        let (dd, rel) = cx.decider(&avec(&args, vec![("anchors", ancres.clone()), ("options", opts.clone())])?)?;
        essais += 1.0;
        if posee(&dd) {
            let au = g(&dd, "anchorsUsed");
            let mut serie = false;
            if vrai(au) { if !est_tableau(au) { return hd("anchorsUsed non tabulaire"); } for c in crate::js::presents(au) { if dans_ombre(&c)? { serie = true; break; } } }
            source = s(if serie { "serie" } else { "lot" });
            d = Some((dd, rel));
        } else { raisons.push(format!("serie:{}", raison40(&dd)?)); }
    }
    // 2. les lignes valides de la liste d'ESV
    let fl = g(&ov, "fenetreListe").clone();
    let rows = lignes_de_table(table, g(identity, "cut"), &fl)?;
    let rows_v = tab(rows.clone());
    let rep = if rows.is_empty() { o(vec![("etat", s("sans-liste")), ("T", nul())]) } else { repere_depuis_ligne(&rows_v, g(identity, "cut"), p(capture, "rails")?)? };
    if d.is_none() {
        if vrai(g(&rep, "T")) {
            let ab = appuis::appuis(&rows_v, g(&rep, "T"), identity, &INDEF)?;
            appuis_b1 = iter_vals(&ab);
            if appuis_b1.is_empty() { raisons.push("b1:aucune-ligne-valide".to_owned()); } else {
                let (dd, rel) = cx.decider(&avec(&args, vec![("anchors", ancres.clone()), ("validated", ab.clone()), ("options", opts.clone())])?)?;
                essais += 1.0;
                if posee(&dd) { d = Some((dd, rel)); source = s("b1"); } else { raisons.push(format!("b1:{}", raison40(&dd)?)); }
            }
        } else { raisons.push(format!("b1:{}", texte(g(&rep, "etat"))?)); }
    }
    // 3. le complément par l'écartement
    let gref = ecartement_reference(table, g(identity, "cut"), &ancres, &ov)?;
    if d.is_none() {
        let (x, raison, e, _) = source_ecart(cx, &avec(&args, vec![("anchors", ancres.clone())])?, capture, &sci, g(&gref, "mm"), &opts, &ov)?;
        essais += e;
        if let Some(x) = x { d = Some((x.decision, x.relance)); source = s("ecart"); } else { raisons.push(texte(&raison)?); }
    }
    let r = match &d {
        Some((dd, rel)) => {
            let mut ap = iter_vals(&ancres);
            ap.extend(appuis_b1.iter().cloned());
            let ca = o(vec![("capture", capture.clone()), ("decision", dd.clone()), ("relance", rel.clone()), ("appuis", tab(ap))]);
            let f = |c: &V| -> R<V> { let x = mem.get(c)?; Ok(if nullish(&x) { n(0.0) } else { x }) };
            let comp = recentree::completer(&ca, &f)?;
            let mut e = vec![("decision".to_owned(), dd.clone()), ("relance".to_owned(), rel.clone())];
            if let V::Objet(c) = comp { for (k, v) in c { definir(&mut e, &k, v); } }
            V::Objet(e)
        }
        None => nul(),
    };
    let posable = vrai(&r) && vrai(g(&r, "posee"));
    if posable && vrai(g(&r, "anchor")) && commande_positions_lot(g(&r, "decision")) {
        let ic = g(identity, "cut");
        let mut i_ = None;
        for (i, x) in mem.poses.iter().enumerate() {
            let pi = p(x, "identity")?;
            if strict_egal(g(pi, "part"), g(identity, "part"))? && strict_egal(&ou_nul(g(pi, "frameId")), &ou_nul(g(identity, "frameId")))? && strict_egal(g(pi, "cut"), ic)? { i_ = Some(i); break; }
        }
        if let Some(i) = i_ { mem.poses.remove(i); }
        mem.poses.push(o(vec![("identity", o(vec![("part", g(identity, "part").clone()), ("cut", ic.clone()), ("frameId", ou_nul(g(identity, "frameId")))])),
            ("positions", g(&r, "positions").clone()), ("stage", g(&r, "stage").clone()), ("profondeur", g(&r, "profondeur").clone())]));
        while mem.poses.len() > 40 { mem.poses.remove(0); }
        if crate::js::est_objet(ic) { return hd("clé objet"); }
        let k = if matches!(ic, V::Nombre(z) if *z == 0.0) { n(0.0) } else { ic.clone() };
        let mut j = None;
        for (i, (kk, _)) in mem.profondeurs.iter().enumerate() { if svz(kk, &k)? { j = Some(i); break; } }
        if let Some(j) = j { mem.profondeurs.remove(j); }
        mem.profondeurs.push((k, g(&r, "profondeur").clone()));
    }
    let ecart_src = est(&source, "ecart");
    let (appuis_ev, appuis_ombre_ev) = if vrai(&r) && !ecart_src {
        let au = g(&r, "anchorsUsed");
        if !est_tableau(au) { return hd("anchorsUsed non tabulaire"); }
        let mut f = vec![];
        for c in crate::js::presents(au) { if dans_ombre(&c)? { f.push(c); } }
        (au.clone(), tab(f))
    } else { (tab(vec![]), tab(vec![])) };
    let rr = g(&r, "reason");
    let lignes: Vec<V> = appuis_b1.iter().map(|a| g(g(a, "identity"), "cut").clone()).take(12).collect();
    let mut ev: Vec<(&str, V)> = base.to_vec();
    ev.extend([("etat", s("calcule")), ("source", source.clone()), ("etage", if vrai(&r) { ou_nul(g(&r, "stage")) } else { nul() }),
        ("raison", if vrai(&r) && !nullish(rr) { s(&texte_k(rr, 80)?) } else { nul() }), ("appuis", appuis_ev), ("appuisOmbre", appuis_ombre_ev), ("lignesValides", tab(lignes)),
        ("repere", g(&rep, "etat").clone()), ("gRef", o(vec![("mm", match g(&gref, "mm") { V::Nombre(x) => r2f(*x), _ => nul() }), ("source", g(&gref, "source").clone())])),
        ("essais", n(essais)), ("confiance", if vrai(&r) { recentree::confiances(g(&r, "moteur")) } else { nul() }), ("ecartVoieMm", if vrai(&r) { r1(g(&r, "fromPredictionMm")) } else { nul() }),
        ("poseMm", if posable { recentree::pose_mm(capture, g(&r, "positions"))? } else { nul() }),
        ("verdict", if posable { o(vec![("posable", b(true)), ("raison", nul())]) } else {
            let j = crate::js::tranche_utf16(&raisons.join(" | "), 160)?;
            o(vec![("posable", b(false)), ("raison", s(if j.is_empty() { "aucune-source" } else { &j }))])
        })]);
    Ok(o(vec![("evenement", o(ev)), ("r", r)]))
}

/// Aiguillage `{f, a}` du module ; `evaluer` reçoit l'état du moteur GCV1 et les réglages globaux comme `decideCut`.
///
/// # Errors
/// `Js` ou `HorsDomaine`, comme les fonctions portées.
pub fn appeler(a: &Appel, entree: &V) -> R<V> {
    match a.f.as_str() {
        "lignesDeTable" => Ok(tab(lignes_de_table(a.arg(0), a.arg(1), a.arg(2))?)),
        "repereDepuisLigne" => repere_depuis_ligne(a.arg(0), a.arg(1), a.arg(2)),
        "ecartementReference" => ecartement_reference(a.arg(0), a.arg(1), a.arg(2), a.arg(3)),
        "railTrouve" => Ok(rail_trouve(a.arg(0))),
        "solutionsEcartement" => Ok(tab(solutions_ecartement(a.arg(0), a.arg(1), a.arg(2), a.arg(3), a.arg(4))?)),
        "poseMmDe" => pose_mm_de(a.arg(0), a.arg(1)),
        "ecartPoses" => ecart_poses(a.arg(0), a.arg(1)).map(n),
        "evaluer" => { let (et, gl) = lot::etat_globaux(entree)?; let (r, mem) = evaluer(a.arg(0), &et, &gl)?; Ok(o(vec![("r", r), ("mem", mem)])) }
        _ => hd("voie-b1-ecart : fonction non portée"),
    }
}
