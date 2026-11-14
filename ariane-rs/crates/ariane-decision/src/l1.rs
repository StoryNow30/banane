//! CH-074 (tranche J5) : `src/gcv2-l1.js` (GCV2 L1 sur les différés du lot : hypothèses H0 à H6, score figé, décisions L1 et
//! L1-e), ligne à ligne. Restent en JS : `avecRupture` (reçoit un `Map`, porté en interne pour `deciderDiffere`),
//! `reglerLeviers` et `leviersActifs` (état du module : la façade envoie les leviers en vigueur avec chaque appel), `commander`
//! (reçoit `expectedPoses`, une fonction du moteur). Les `Float64Array` du modèle et des probabilités voyagent en tableaux ;
//! la façade les rétablit à la sortie (`probas`, `x.n`, `coef`). Le diagnostic (`LEVIERS.diag`, journal seulement) reste en JS.
#![warn(clippy::pedantic, missing_docs)]
#![allow(clippy::many_single_char_names, clippy::too_many_lines, clippy::cast_precision_loss, clippy::needless_range_loop)]
#![allow(clippy::neg_cmp_op_on_partial_ord, clippy::manual_range_contains, clippy::float_cmp, clippy::similar_names)]
#![allow(clippy::too_many_arguments, clippy::fn_params_excessive_bools, clippy::struct_excessive_bools)]
// (a+b)/2 garde l'ordre des opérations du JS (même arrondi) : `midpoint` ne le garantit pas
#![allow(clippy::manual_midpoint)]
// une ligne du JS par ligne Rust : plusieurs `if` sur une ligne gardent la forme du JS
#![allow(clippy::possible_missing_else)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::indexing_slicing, clippy::unreachable, clippy::todo)]
use crate::aides::{self, SIDES};
use crate::critere::vers_nombre;
use crate::j4::{cle_propriete, fin_de, longueur_js, ou_nul, plus, svz, texte, texte_k};
use crate::js::{
    b, definir, elem, elems, entier, est_indice, est_simple, est_tableau, etaler, fini, g, g_brut, gi, hd, inclut, longueur, n, nul, nullish,
    o, p, s, strict_egal, tab, tab_n, vrai, Appel, R, INDEF,
};
use crate::metier::json_aller_retour;
use crate::shadow::{self, Etat};
use crate::{l1e, lot, recentree};
use ariane_geometrie::convention;
use ariane_js::{hypot, Echec};
use ariane_vba::Valeur as V;
use std::cell::RefCell;
use std::collections::HashSet;

const VERSION: &str = "gcv2-l1-1";
const FORMAT_PARAMS: &str = "ariane-gcv2-parametres-v1";
const MAX_HYP: usize = 12;
const DOUBLON_MM: f64 = 0.75;
// H6 (« voie décalée »)
const H6_FENETRE: f64 = 10.0;
const H6_K: usize = 5;
const H6_DISPERSION: f64 = 50.0;
const H6_RESERVOIR: f64 = 5.0;
const H6_PROCHE_MAX: f64 = 5.0;
const H6_DESSUS: f64 = 5.0;
const H6_FLANC: f64 = 3.0;
const H6_CONCURRENT: f64 = 45.0;
// `E.REGLAGE` (src/gcv2-l1e.js)
const SOUTIEN_DESSUS: f64 = 5.0;
const SOUTIEN_FLANC: f64 = 3.0;
// `Candidate.DEFAULTS` (src/geometry-candidate-v1.js), lus par `qualifyStrong`
const MIN_TOP: f64 = 15.0;
const MIN_FACE: f64 = 6.0;
const RATIO: f64 = 1.5;

// ---------------------------------------------------------------- transcendantes du moteur JS
#[cfg(target_arch = "wasm32")]
fn log1p(x: f64) -> f64 {
    #[link(wasm_import_module = "env")]
    extern "C" { fn js_log1p(x: f64) -> f64; }
    // SÛRETÉ : `js_log1p` est l'import `env.js_log1p` fourni par la coquille (Math.log1p) : fonction pure de f64 vers f64,
    // sans pointeur ni état ; aucun invariant mémoire en jeu.
    unsafe { js_log1p(x) }
}
#[cfg(target_arch = "wasm32")]
fn log10(x: f64) -> f64 {
    #[link(wasm_import_module = "env")]
    extern "C" { fn js_log10(x: f64) -> f64; }
    // SÛRETÉ : `js_log10` est l'import `env.js_log10` fourni par la coquille (Math.log10) : fonction pure de f64 vers f64,
    // sans pointeur ni état ; aucun invariant mémoire en jeu.
    unsafe { js_log10(x) }
}
/// Hors WASM (essais `cargo test`) : la bibliothèque du système, NON garantie identique à V8.
#[cfg(not(target_arch = "wasm32"))]
#[allow(clippy::disallowed_methods)]
fn log1p(x: f64) -> f64 { x.ln_1p() }
#[cfg(not(target_arch = "wasm32"))]
#[allow(clippy::disallowed_methods)]
fn log10(x: f64) -> f64 { x.log10() }
fn exp(x: f64) -> f64 { ariane_geometrie::exp(x) }

// ---------------------------------------------------------------- sémantique JS (lectures strictes, coercitions)
fn tn(v: &V) -> R<f64> { vers_nombre(v) }
/// Composante `i` d'un décalage lu (`ToNumber`).
fn c3(t: &[V; 3], i: usize) -> R<f64> { t.get(i).map_or_else(|| hd("composante"), tn) }
/// Nombre entier positif fini, vérifié par l'appelant, en indice.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn en_usize(x: f64) -> usize { x as usize }
fn est(v: &V, t: &str) -> bool { matches!(v, V::Chaine(c) if c == t) }
/// `v[i]` (v nul : le JS lève).
fn ix(v: &V, i: usize) -> R<V> { if nullish(v) { hd("indice de null/undefined") } else { gi(v, i) } }
fn ixn(v: &V, i: usize) -> R<f64> { tn(&ix(v, i)?) }
/// `v[cle]` pour une clé quelconque (`ToPropertyKey`) ; v nul : le JS lève.
fn gk(v: &V, cle: &V) -> R<V> {
    if nullish(v) { return hd("propriété de null/undefined"); }
    let k = cle_propriete(cle)?;
    Ok(match v {
        V::Objet(_) => g_brut(v, &k).clone(),
        V::Chaine(c) if !c.is_empty() => return hd("propriété d'une chaîne"),
        x if est_tableau(x) => {
            if k == "length" { return hd("length par clé"); }
            if est_indice(&k) { k.parse::<usize>().map_or(V::Indefini, |i| elem(x, i)) } else { V::Indefini }
        }
        _ => V::Indefini,
    })
}
/// `fini(v)?Math.round(v*10**d)/10**d:null` (10**d exact pour d ≤ 4).
fn ar(x: f64, d: u32) -> V {
    if !x.is_finite() { return nul(); }
    let k = match d { 1 => 10.0, 2 => 100.0, 3 => 1000.0, _ => 10_000.0 };
    n(ariane_js::round(x * k) / k)
}
fn arv(v: &V, d: u32) -> V { match v { V::Nombre(x) => ar(*x, d), _ => nul() } }
fn sig4v(v: &V) -> V { match v { V::Nombre(x) if x.is_finite() => crate::large::sig4(*x), _ => nul() } }
/// `Math.max(...t)` / `Math.min(...t)` (`ToNumber` de chaque valeur).
fn maxv(t: &[f64]) -> f64 { ariane_js::max_de(t.iter().copied()) }
fn minv(t: &[f64]) -> f64 { ariane_js::min_de(t.iter().copied()) }
/// Éléments d'un tableau parcouru par `for…of`, `map`, `filter` : tableau sans trou (un trou : hors domaine).
fn dense(v: &V) -> R<Vec<V>> {
    let Some(t) = elems(v) else { return hd("tableau attendu") };
    t.into_iter().map(|e| e.map_or_else(|| hd("tableau troué"), Ok)).collect()
}
/// `(v||[])` parcouru : falsy → vide, tableau dense, sinon hors domaine.
fn liste_ou_vide(v: &V) -> R<Vec<V>> { if vrai(v) { dense(v) } else { Ok(vec![]) } }
/// `Math.hypot(...v)` d'un tableau (`ToNumber`).
fn norme_v(v: &V) -> R<f64> { let t = dense(v)?; let x: Vec<f64> = t.iter().map(tn).collect::<R<_>>()?; Ok(hypot(&x)) }
/// `norme(moins(a,b))` : `Math.hypot(...a.map((x,i)=>x-b[i]))`.
fn norme_moins(a: &V, b_: &V) -> R<f64> {
    let t = dense(a)?;
    let mut x = vec![];
    for (i, e) in t.iter().enumerate() { x.push(tn(e)? - ixn(b_, i)?); }
    Ok(hypot(&x))
}
/// `Array.isArray(v)&&v.length>=3&&v.slice(0,3).every(fini)?v.slice(0,3):null` (un trou parmi les trois : hors domaine).
fn vec3(v: &V) -> R<Option<[f64; 3]>> {
    if !est_tableau(v) { return Ok(None); }
    let Some(t) = elems(v) else { return Ok(None) };
    if t.len() < 3 { return Ok(None); }
    let mut out = [0.0; 3];
    for (i, o_) in out.iter_mut().enumerate() {
        match t.get(i) { Some(Some(V::Nombre(x))) if x.is_finite() => *o_ = *x, Some(None) => return hd("point troué"), _ => return Ok(None) }
    }
    Ok(Some(out))
}
/// Tri stable par clés (ordre lexicographique, `true` = décroissant), comme `sort((a,b)=>k1(a)-k1(b)||k2(a)-k2(b)…)` ;
/// une clé NaN (comparateur NaN : ordre propre à V8) : hors domaine dès qu'il y a deux éléments.
fn trier<T>(v: Vec<T>, cles: impl Fn(&T) -> R<Vec<f64>>, sens: &[bool]) -> R<Vec<T>> {
    if v.len() < 2 { return Ok(v); }
    let mut k = vec![];
    for x in &v { let c = cles(x)?; if c.iter().any(|y| y.is_nan()) { return hd("tri : clé NaN"); } k.push(c); }
    let mut idx: Vec<usize> = (0..v.len()).collect();
    idx.sort_by(|i, j| {
        let (Some(a), Some(b_)) = (k.get(*i), k.get(*j)) else { return std::cmp::Ordering::Equal };
        for (t, (x, y)) in a.iter().zip(b_.iter()).enumerate() {
            let d = if sens.get(t).copied().unwrap_or(false) { y - x } else { x - y };
            // Inf − Inf (NaN) : le comparateur JS vaut 0 (`||` passe à la clé suivante), comme deux clés égales
            if d < 0.0 { return std::cmp::Ordering::Less; }
            if d > 0.0 { return std::cmp::Ordering::Greater; }
        }
        std::cmp::Ordering::Equal
    });
    let mut src: Vec<Option<T>> = v.into_iter().map(Some).collect();
    let mut out = Vec::with_capacity(src.len());
    for i in idx { if let Some(x) = src.get_mut(i).and_then(Option::take) { out.push(x); } }
    Ok(out)
}
/// `t.slice().sort()` (ordre par défaut : unités UTF-16) de chaînes ; autre élément : hors domaine.
fn trier_textes(t: Vec<V>) -> R<Vec<V>> {
    if t.iter().any(|x| !matches!(x, V::Chaine(_))) && t.len() > 1 { return hd("tri par défaut d'un non-texte"); }
    let mut t = t;
    t.sort_by(|a, b_| match (a, b_) { (V::Chaine(x), V::Chaine(y)) => x.encode_utf16().cmp(y.encode_utf16()), _ => std::cmp::Ordering::Equal });
    Ok(t)
}
/// `[...new Set(t)]` (`SameValueZero`).
fn uniques(t: Vec<V>) -> R<Vec<V>> {
    let mut out: Vec<V> = vec![];
    for x in t { let mut vu = false; for y in &out { if svz(y, &x)? { vu = true; break; } } if !vu { out.push(x); } }
    Ok(out)
}
fn joindre(t: &[V], sep: &str) -> R<String> {
    let mut out = String::new();
    for (i, x) in t.iter().enumerate() { if i > 0 { out.push_str(sep); } if !nullish(x) { out.push_str(&texte(x)?); } }
    Ok(out)
}
/// `(v||[]).length`.
fn long_ou0(v: &V) -> V { if vrai(v) { longueur_js(v) } else { n(0.0) } }
fn mettre(o_: &mut V, k: &str, v: V) -> R<()> { if let V::Objet(e) = o_ { definir(e, k, v); Ok(()) } else { hd("affectation sur un non-objet") } }
/// `{...a, k1:v1, …}`.
fn etale(a: &V, t: Vec<(&str, V)>) -> R<V> { let mut e = vec![]; etaler(&mut e, a)?; for (k, v) in t { definir(&mut e, k, v); } Ok(V::Objet(e)) }
fn rail_de<'a>(capture: &'a V, side: &str) -> R<&'a V> { p(p(capture, "rails")?, side) }
fn autre(side: &str) -> &'static str { if side == "left" { "right" } else { "left" } }
fn par_cote(f: impl Fn(&str) -> R<V>) -> R<V> { Ok(o(vec![("left", f("left")?), ("right", f("right")?)])) }

// ---------------------------------------------------------------- contexte d'un appel
/// État lu hors des arguments : moteur GCV1 (drapeaux, plafond du calage), réglages globaux du lot, leviers en vigueur.
pub struct Cx<'a> {
    et: &'a Etat,
    gl: &'a lot::Globaux,
    lev: &'a V,
}
impl Cx<'_> {
    fn l(&self, k: &str) -> &V { g(self.lev, k) }
    fn lb(&self, k: &str) -> bool { vrai(self.l(k)) }
    fn lfini(&self, k: &str) -> bool { fini(self.l(k)) }
    fn ln(&self, k: &str) -> R<f64> { tn(self.l(k)) }
    fn reservoir(&self) -> Etat { Etat { partial_flank: self.et.partial_flank, convention: self.et.convention, plafond: self.et.plafond.clone(), avec_reservoir: true } }
}

/// Capture d'un appel, possédée : `{...capture, rails:{...capture.rails, [side]: rail}}` se fait en échangeant le rail sur place
/// le temps d'un calcul (l'arène ne rend rien avant la fin de l'appel : copier le nuage à chaque soutien la remplirait).
pub struct Cap { c: RefCell<V> }
impl Cap {
    fn new(v: V) -> Cap { Cap { c: RefCell::new(v) } }
    fn v(&self) -> R<std::cell::Ref<'_, V>> { self.c.try_borrow().map_err(|_| Echec::hors_domaine("capture déjà empruntée")) }
    fn vrai(&self) -> R<bool> { Ok(vrai(&*self.v()?)) }
    fn echanger(&self, rails: &mut [(&'static str, V)]) -> R<()> {
        let mut c = self.c.try_borrow_mut().map_err(|_| Echec::hors_domaine("capture déjà empruntée"))?;
        let V::Objet(e) = &mut *c else { return hd("capture non objet") };
        let Some((_, r)) = e.iter_mut().find(|(k, _)| k == "rails") else { return hd("capture sans rails") };
        let V::Objet(re) = r else { return hd("rails non objet") };
        for (side, nv) in rails.iter_mut() {
            let Some((_, x)) = re.iter_mut().find(|(k, _)| k == side) else { return hd("rail absent") };
            std::mem::swap(x, nv);
        }
        Ok(())
    }
    /// `f(capT)` avec `capT` la capture aux rails remplacés.
    fn avec_rails<T>(&self, mut rails: Vec<(&'static str, V)>, f: impl FnOnce(&V) -> R<T>) -> R<T> {
        self.echanger(&mut rails)?;
        let r = match self.v() { Ok(c) => f(&c), Err(e) => Err(e) };
        self.echanger(&mut rails)?;
        r
    }
}

// ---------------------------------------------------------------- repère
/// `decalage(rail, p)` : composantes (mm, `r2`) ou `None`.
fn decalage_brut(rail: &V, pt: &V) -> R<Option<[V; 3]>> {
    if !vrai(rail) { return Ok(None); }
    let m = g(rail, "sceneRelativeToProfileLocal");
    let o_ = vec3(g(rail, "positionSceneRelative"))?;
    let q = vec3(pt)?;
    let (Some(o_), Some(q)) = (o_, q) else { return Ok(None) };
    if !est_tableau(m) || longueur(m) != Some(16) { return Ok(None); }
    let mm = crate::js::m16(m)?;
    let a = ariane_capture::point(&mm, q[0], q[1], q[2])?;
    let bb = ariane_capture::point(&mm, o_[0], o_[1], o_[2])?;
    Ok(Some([ar(1000.0 * (a[0] - bb[0]), 2), ar(1000.0 * (a[1] - bb[1]), 2), ar(1000.0 * (a[2] - bb[2]), 2)]))
}
fn decalage_v(rail: &V, pt: &V) -> R<V> { Ok(decalage_brut(rail, pt)?.map_or_else(nul, |t| tab(t.to_vec()))) }
/// `decalage` en nombres ; une composante nulle (non finie) ferait passer `null` dans l'arithmétique : hors domaine.
fn decalage_f(rail: &V, pt: &V) -> R<Option<[f64; 3]>> {
    let Some(t) = decalage_brut(rail, pt)? else { return Ok(None) };
    let mut out = [0.0; 3];
    for (o_, x) in out.iter_mut().zip(t.iter()) { match x { V::Nombre(y) => *o_ = *y, _ => return hd("décalage non fini") } }
    Ok(Some(out))
}
fn dec_v(t: &[f64; 3]) -> V { tab_n(t) }
/// `L.positionOf(capture.rails[side], mm.map(v=>v/1000))`.
fn positions_mm(rail: &V, mm: &V) -> R<V> {
    let t = dense(mm)?;
    let mut d = vec![];
    for x in &t { d.push(tn(x)? / 1000.0); }
    lot::position_of(rail, &tab_n(&d))
}
fn positions_f(rail: &V, mm: &[f64; 3]) -> R<V> { lot::position_of(rail, &tab_n(&[mm[0] / 1000.0, mm[1] / 1000.0, mm[2] / 1000.0])) }
/// `gaugeMm(a,b)=1000*C.distance(a,b)`.
fn gauge_mm(a: &V, b_: &V) -> R<f64> { Ok(1000.0 * crate::js::distance_v(a, b_)?) }

// ---------------------------------------------------------------- signal d'un rail (src/hauteur-apprise.js)
struct Sig { groupe: V, ep: V, pd: V, pf: V }
fn groupe(cal: &V) -> V {
    if !vrai(cal) { return nul(); }
    if matches!(g(cal, "applied"), V::Booleen(true)) { return s("applique"); }
    if matches!(g(cal, "applied"), V::Booleen(false)) && est(g(cal, "reason"), "shift-out-of-domain") { return s("refuse"); }
    nul()
}
fn r1f(v: &V) -> V { match v { V::Nombre(x) if x.is_finite() => n(ariane_js::round(x * 10.0) / 10.0), _ => nul() } }
/// `H.signalRail(capture, {rails:{[side]:{conventionCalibration:cal}}}, side, position)`.
fn signal_rail(capture: &V, cal: &V, side: &str, position: &V) -> R<Sig> {
    let rail = aides_rail(capture, side);
    let (mut nb, mut nf, mut ep) = (nul(), nul(), nul());
    if !nullish(rail) && vrai(g(rail, "sceneRelativeToProfileLocal")) && est_tableau(position) {
        let m = g(rail, "sceneRelativeToProfileLocal");
        let a = crate::js::point_v(m, position)?;
        let o_ = crate::js::point_v(m, g(rail, "positionSceneRelative"))?;
        let delta = tab_n(&[a[0] - o_[0], a[1] - o_[1], a[2] - o_[2]]);
        let cfg = convention::Reglages::fusionner(&o(vec![]))?;
        if let Ok(e) = convention::band_offsets(capture, side, &delta, &cfg)? {
            nb = n(e.top.len() as f64);
            nf = n(e.face.len() as f64);
            ep = if e.top.is_empty() { nul() } else { r1f(&n(convention::quantile(&e.top, 0.9) - convention::quantile(&e.top, 0.1))) };
        }
    }
    Ok(Sig { groupe: groupe(cal), ep, pd: nb, pf: nf })
}
fn aides_rail<'a>(capture: &'a V, side: &str) -> &'a V {
    let r = if nullish(capture) { &INDEF } else { g(capture, "rails") };
    if nullish(r) { &INDEF } else { g(r, side) }
}
/// `H.correctionRail(sig, 'first-pass')` (modèle figé) : (correction, abstention).
fn correction_rail(sig: &Sig) -> (f64, V) {
    if !vrai(&sig.groupe) { return (0.0, s("calage")); }
    let (Some(nb), Some(ep)) = (fin_de(&sig.pd), fin_de(&sig.ep)) else { return (0.0, s("dessus-peu-observe")) };
    if nb < 15.0 { return (0.0, s("dessus-peu-observe")); }
    let (a, bb, part) = if est(&sig.groupe, "applique") { (3.28, -0.5, 0.5) } else { (17.89, -1.14, 1.0) };
    let brut = part * (a + bb * ep);
    let borne = ariane_js::sign(brut) * ariane_js::min(brut.abs(), 5.0);
    let mm = ariane_js::round(borne * 10.0) / 10.0;
    (if mm == 0.0 { 0.0 } else { mm }, nul())
}
struct Mes { pos: V, sig: Sig, cor: (f64, V) }
fn mesures_pose(cap: &Cap, side: &str, mm: &[f64; 3], calage: &V) -> R<Mes> {
    let c = cap.v()?;
    let pos = positions_f(rail_de(&c, side)?, mm)?;
    let cal = if vrai(calage) { calage.clone() } else { nul() };
    let sig = signal_rail(&c, &cal, side, &pos)?;
    let cor = correction_rail(&sig);
    Ok(Mes { pos, sig, cor })
}
/// `mesuresTranslatees(capture, side, mm, calage)` : le signal lu sur la capture au rail translaté à la pose.
fn mesures_translatees(cap: &Cap, side: &'static str, mm: &V, calage: &V) -> R<Mes> {
    let (pos, tr) = {
        let c = cap.v()?;
        let rail = rail_de(&c, side)?;
        let pos = positions_mm(rail, mm)?;
        let pr = g(rail, "positionSceneRelative");
        let tp = dense(&pos)?;
        if tp.len() != 3 { return hd("translation de longueur ≠ 3"); }
        let mut t = [0.0; 3];
        for (i, x) in t.iter_mut().enumerate() { *x = tn(&ix(&pos, i)?)? - ixn(pr, i)?; }
        (pos, aides::translated(rail, t)?)
    };
    let cal = if vrai(calage) { calage.clone() } else { nul() };
    let sig = cap.avec_rails(vec![(side, tr)], |ct| signal_rail(ct, &cal, side, &pos))?;
    let cor = correction_rail(&sig);
    Ok(Mes { pos, sig, cor })
}
fn cote(side: &V) -> R<&'static str> { match side { V::Chaine(c) if c == "left" => Ok("left"), V::Chaine(c) if c == "right" => Ok("right"), _ => hd("côté inconnu") } }
/// `soutienRail(capture, side, mm)` : (dessus, flanc).
fn soutien(cap: &Cap, side: &'static str, mm: &V) -> R<(f64, f64)> {
    let m = mesures_translatees(cap, side, mm, &V::Nul)?;
    Ok((fin_de(&m.sig.pd).unwrap_or(0.0), fin_de(&m.sig.pf).unwrap_or(0.0)))
}
fn soutien_v(x: (f64, f64)) -> V { o(vec![("dessus", n(x.0)), ("flanc", n(x.1))]) }
/// Les deux rails d'une paire de décalages soutenus (`E.REGLAGE`).
fn soutenue(cap: &Cap, decal: &V) -> R<bool> {
    for side in SIDES { let m = soutien(cap, side, p(decal, side)?)?; if !(m.0 >= SOUTIEN_DESSUS && m.1 >= SOUTIEN_FLANC) { return Ok(false); } }
    Ok(true)
}

// ---------------------------------------------------------------- variante (décision du lot et hauteur apprise)
struct Variante { decision: V, haut: V, v: V }
fn variante(cap: &Cap, science: &V, anchors: &V, options: &V, cx: &Cx) -> R<Variante> {
    let c = cap.v()?;
    let opts = if vrai(options) { options.clone() } else { V::Indefini };
    let decision = lot::decide_cut_parts(&c, science, anchors, &V::Indefini, &opts, cx.et, cx.gl, &mut None)?;
    let pz = g(&decision, "positions");
    let mut haut = nul();
    if vrai(pz) {
        haut = match aides::hauteur_evaluer(&c, science, &decision, &V::Indefini) { Ok(h) => h, Err(Echec::Js { .. }) => nul(), Err(e) => return Err(e) };
    }
    let mut rails = vec![];
    for side in SIDES {
        let h = if vrai(&haut) { p(g(&haut, "rails"), side)?.clone() } else { haut.clone() };
        let pose = if vrai(pz) { decalage_v(rail_de(&c, side)?, &gk(pz, &s(side))?)? } else { nul() };
        let hv = |k: &str| if vrai(&h) { g(&h, k).clone() } else { nul() };
        rails.push((side, o(vec![("pose", pose), ("hauteurMm", hv("correctionMm")), ("hauteurAbstention", hv("abstention")), ("groupe", hv("groupe"))])));
    }
    let au = g(&decision, "anchorsUsed");
    let appuis = long_ou0(au);
    let v = o(vec![("stage", g(&decision, "stage").clone()), ("reason", ou_nul(g(&decision, "reason"))), ("appuis", appuis), ("rails", o(rails))]);
    Ok(Variante { decision, haut, v })
}
fn variante_v(cap: &Cap, science: &V, anchors: &V, options: &V, cx: &Cx) -> R<V> {
    let x = variante(cap, science, anchors, options, cx)?;
    Ok(o(vec![("decision", x.decision), ("haut", x.haut), ("v", x.v)]))
}

/// `decalageDepuisDepart(rails, positions)`.
fn decalage_depuis_depart(rails: &V, positions: &V) -> R<V> {
    if !vrai(rails) || !vrai(positions) { return Ok(nul()); }
    let mut out = vec![];
    for side in SIDES {
        let Some(a) = decalage_brut(g(rails, side), g(positions, side))? else { return Ok(nul()) };
        let [_, a1, a2] = a;
        out.push((side, tab(vec![a1, a2])));
    }
    Ok(o(out))
}

// ---------------------------------------------------------------- H6 « voie décalée »
fn med(t: &[V]) -> R<V> {
    let f: Vec<f64> = t.iter().filter_map(fin_de).collect();
    Ok(crate::j4::med(&f)?.map_or_else(nul, n))
}
fn moy_paire(d: &V) -> R<[f64; 2]> {
    let (l, r) = (p(d, "left")?, p(d, "right")?);
    Ok([plus(&ix(l, 0)?, &ix(r, 0)?)? / 2.0, plus(&ix(l, 1)?, &ix(r, 1)?)? / 2.0])
}
fn copie_tableau(v: &V) -> R<V> { if est_tableau(v) { Ok(v.clone()) } else { hd("slice d'un non-tableau") } }
/// `decalagesH6(identity, voisins)`.
fn decalages_h6(identity: &V, voisins: &V) -> R<V> {
    if nullish(identity) { return hd("identity absente"); }
    let mut v = vec![];
    let fid = |x: &V| -> V { let f = g(x, "frameId"); if nullish(f) { nul() } else { f.clone() } };
    let cut0 = p(identity, "cut")?;
    for a in liste_ou_vide(voisins)? {
        if !vrai(&a) || !vrai(g(&a, "decalage")) || !vrai(g(&a, "identity")) { continue; }
        let id = g(&a, "identity");
        if !strict_egal(g(id, "part"), g(identity, "part"))? || !strict_egal(&fid(id), &fid(identity))? { continue; }
        if strict_egal(g(id, "cut"), cut0)? { continue; }
        if !((tn(g(id, "cut"))? - tn(cut0)?).abs() <= H6_FENETRE) { continue; }
        v.push(a);
    }
    let c0 = tn(cut0)?;
    let v = trier(v, |a| { let c = tn(g(g(a, "identity"), "cut"))?; Ok(vec![(c - c0).abs(), c]) }, &[false, false])?;
    let Some(p0) = v.first() else { return Ok(nul()) };
    let dist = |a: &V| -> R<f64> { Ok((tn(g(g(a, "identity"), "cut"))? - c0).abs()) };
    let source = |a: &V| if est(g(a, "source"), "humain") { "humain" } else { "lot" };
    let kk: Vec<&V> = v.iter().take(H6_K).collect();
    let d0 = g(p0, "decalage");
    let proche_paire = moy_paire(d0)?;
    let proche_dist = dist(p0)?;
    let proche = o(vec![("left", copie_tableau(p(d0, "left")?)?), ("right", copie_tableau(p(d0, "right")?)?), ("paire", tab_n(&proche_paire)),
        ("dist", n(proche_dist)), ("n", n(1.0)), ("source", s(source(p0)))]);
    let mut mediane = nul();
    let mut disp = (0.0, 0.0);
    if kk.len() >= 2 {
        let m = |f: &dyn Fn(&V) -> R<[V; 2]>| -> R<V> {
            let mut c0_ = vec![]; let mut c1_ = vec![];
            for a in &kk { let [x, y] = f(a)?; c0_.push(x); c1_.push(y); }
            Ok(tab(vec![med(&c0_)?, med(&c1_)?]))
        };
        let cote_ = |side: &'static str| move |a: &V| -> R<[V; 2]> { let d = p(p(a, "decalage")?, side)?; Ok([ix(d, 0)?, ix(d, 1)?]) };
        let paire_ = |a: &V| -> R<[V; 2]> { let x = moy_paire(g(a, "decalage"))?; Ok([n(x[0]), n(x[1])]) };
        let lm = m(&cote_("left"))?;
        let rm = m(&cote_("right"))?;
        let pm = m(&paire_)?;
        let etendue = |f: &dyn Fn(&V) -> R<[V; 2]>| -> R<f64> { let mut x = vec![]; for a in &kk { x.push(tn(&f(a)?[0])?); } Ok(maxv(&x) - minv(&x)) };
        let (dl, dr, dp) = (etendue(&cote_("left"))?, etendue(&cote_("right"))?, etendue(&paire_)?);
        disp = (dl, dr);
        let mut dmax = vec![];
        for a in &kk { dmax.push(dist(a)?); }
        let humain = kk.iter().any(|a| est(g(a, "source"), "humain"));
        mediane = o(vec![("left", lm), ("right", rm), ("paire", pm), ("n", n(kk.len() as f64)), ("distMax", n(maxv(&dmax))), ("source", s(if humain { "humain" } else { "lot" })),
            ("dispersion", o(vec![("left", n(dl)), ("right", n(dr)), ("paire", n(dp))]))]);
    }
    let mut motifs = vec![];
    if vrai(&mediane) {
        if disp.0 > H6_DISPERSION || disp.1 > H6_DISPERSION { motifs.push(s("appuis-contradictoires")); }
        if proche_dist > H6_PROCHE_MAX { motifs.push(s("appui-trop-loin")); }
    } else { motifs.push(s(if v.is_empty() { "aucun-appui" } else { "un-seul-appui" })); }
    let reference = if vrai(&mediane) {
        let mut ancres = vec![];
        for a in &kk { ancres.push(o(vec![("cut", g(g(a, "identity"), "cut").clone()), ("source", s(source(a)))])); }
        o(vec![("left", g(&mediane, "left").clone()), ("right", g(&mediane, "right").clone()), ("n", g(&mediane, "n").clone()), ("distMax", g(&mediane, "distMax").clone()),
            ("distMin", n(proche_dist)), ("dispersion", o(vec![("left", n(disp.0)), ("right", n(disp.1))])), ("ancres", tab(ancres)), ("motifs", tab(motifs.clone()))])
    } else { nul() };
    Ok(o(vec![("proche", proche), ("mediane", mediane), ("reference", reference), ("motifs", tab(motifs))]))
}

// ---------------------------------------------------------------- hypothèses d'un cut
/// Outils du réservoir (`Shadow.reservoirOutils`).
fn loss_ratio(loss: &V, lmin: &V) -> f64 {
    let (Some(l), Some(m)) = (fin_de(loss), fin_de(lmin)) else { return f64::INFINITY };
    if m <= 0.0 { return if l <= 0.0 { 1.0 } else { f64::INFINITY }; }
    l / m
}
fn in_competitive(c: &V, lmin: &V) -> bool { fini(g(c, "loss")) && loss_ratio(g(c, "loss"), lmin) <= RATIO }
fn qualify_strong(c: &V) -> R<V> {
    if !vrai(c) { return Ok(b(false)); }
    if !(tn(g(c, "topRows"))? >= MIN_TOP) { return Ok(b(false)); }
    if !(tn(g(c, "faceCount"))? >= MIN_FACE) { return Ok(b(false)); }
    if vrai(g(c, "slopeLimited")) { return Ok(b(false)); }
    Ok(g(c, "windowOk").clone())
}
/// `(c.tags||[]).includes('astar-published')`.
fn a_astar(c: &V) -> R<bool> {
    let t = g(c, "tags");
    match t {
        x if !vrai(x) => Ok(false),
        V::Chaine(x) => Ok(x.contains("astar-published")),
        x if est_tableau(x) => inclut(x, &s("astar-published")),
        _ => hd("tags non tableau"),
    }
}
fn cle_cellule(c: &V) -> R<String> {
    let u = ariane_js::round(tn(g(c, "u"))? * 1e6);
    let z = ariane_js::round(tn(g(c, "z"))? * 1e6);
    Ok(format!("{},{}", ariane_js::nombre::nombre_en_chaine(u), ariane_js::nombre::nombre_en_chaine(z)))
}
#[derive(Clone)]
struct Cel { c: V, ratio: f64, comp: bool, strong: V, astar: bool, publiee: bool }
struct H6i { source: V, ampleur: f64, dist: V, n: V, disp: V }
struct Item { origine: &'static str, sous: String, mm: [f64; 3], calage: V, cellule: Option<usize>, chaine_rail: Option<V>, h6: Option<H6i> }
struct Gardee { it: Item, origines: Vec<&'static str>, sous: Vec<String>, cellules: Vec<usize>, cellule: Option<usize>, calage: V, h6: Option<H6i> }
struct Hyp { e: Vec<(String, V)>, traits: Vec<(String, V)>, pos: V, hauteur: bool }

/// Arguments de `hypothesesDuCut`.
struct ArgsHyp<'a> { science: &'a V, seul: &'a V, chaine: &'a V, appuis_avant: &'a V, voisins: &'a V, g_med: &'a V, voisins_lot: &'a V, depart_esv: &'a V }

fn hypotheses_du_cut(cap: &Cap, a: &ArgsHyp, cx: &Cx) -> R<V> {
    let ArgsHyp { science, seul, chaine, appuis_avant, voisins, g_med, voisins_lot, depart_esv } = *a;
    let (identity, ident_cut) = { let c = cap.v()?; let id = p(&c, "identity")?.clone(); let ic = if nullish(&id) { V::Indefini } else { g(&id, "cut").clone() }; (id, ic) };
    let base_h6: Option<[[f64; 3]; 2]> = if matches!(depart_esv, V::Booleen(false)) { None } else if vrai(depart_esv) {
        let mut t = [[0.0; 3]; 2];
        for (k, side) in SIDES.iter().enumerate() { let d = p(depart_esv, side)?; for i in 0..3 { let V::Nombre(x) = ix(d, i)? else { return hd("départ non numérique") }; if let Some(r) = t.get_mut(k).and_then(|r| r.get_mut(i)) { *r = x; } } }
        Some(t)
    } else { Some([[0.0; 3]; 2]) };
    let voisins_l = dense(voisins)?;
    let (fam_lot, fam_tous) = if base_h6.is_some() {
        let vl = if vrai(voisins_lot) { voisins_lot.clone() } else {
            let mut t = vec![];
            for x in &voisins_l { if est(p(x, "source")?, "lot") { t.push(x.clone()); } }
            tab(t)
        };
        (decalages_h6(&identity, &vl)?, decalages_h6(&identity, voisins)?)
    } else { (nul(), nul()) };
    let mut tronques_h6 = [0.0f64; 2];
    let mut voie: Option<[[f64; 2]; 2]> = None;
    let ch_dec = if vrai(chaine) { g(chaine, "decision").clone() } else { V::Indefini };
    let ch_appuis = |d: &V| -> bool { let au = g(d, "anchorsUsed"); vrai(&long_ou0(au)) };
    if vrai(chaine) && vrai(&ch_dec) && ch_appuis(&ch_dec) {
        let c = cap.v()?;
        voie = match recentree::prediction_de(&c, &ch_dec, appuis_avant) { Ok(x) => x, Err(Echec::Js { .. }) => None, Err(e) => return Err(e) };
    }
    let mut interp: Option<[[f64; 2]; 2]> = None;
    let mut info = o(vec![("n", n(0.0)), ("humains", n(0.0)), ("lot", n(0.0)), ("encadre", b(false)), ("coupMin", nul()), ("ecartementMm", nul())]);
    if !voisins_l.is_empty() {
        let (liste, encadre, cuts) = lot::l1_voisins(&identity, &voisins_l, cx.et)?;
        if !liste.is_empty() {
            let mut utilises = vec![];
            for x in &voisins_l { let c_ = p(p(x, "identity")?, "cut")?; let mut dans = false; for k in &cuts { if svz(k, c_)? { dans = true; break; } } if dans { utilises.push(x.clone()); } }
            let c = cap.v()?;
            let mut t = [[0.0; 2]; 2];
            for (k, side) in SIDES.iter().enumerate() {
                let pr = lot::l1_predire(rail_de(&c, side)?, &liste, encadre, side)?;
                if let Some(x) = t.get_mut(k) { *x = [pr.lateral * 1000.0, pr.vertical * 1000.0]; }
            }
            interp = Some(t);
            let gr = lot::l1_ecartement(&identity, &voisins_l, cx.et)?;
            let mut coups = vec![];
            for k in &cuts { coups.push((tn(k)? - tn(&ident_cut)?).abs()); }
            let nh = utilises.iter().filter(|a| est(g(a, "source"), "humain")).count();
            let nl = utilises.iter().filter(|a| est(g(a, "source"), "lot")).count();
            info = o(vec![("n", n(cuts.len() as f64)), ("humains", n(nh as f64)), ("lot", n(nl as f64)), ("encadre", b(encadre)), ("coupMin", n(minv(&coups))),
                ("ecartementMm", gr.map_or_else(nul, |x| ar(x, 1)))]);
        }
    }
    let humains_info = vrai(g(&info, "humains"));
    let mut res: Vec<(Vec<Gardee>, Vec<Cel>, V)> = vec![];
    let mut tronques: [Vec<V>; 2] = [vec![], vec![]];
    let mut rail_info: Vec<(&str, V)> = vec![];
    for (ks, side) in SIDES.iter().enumerate() {
        let side: &'static str = side;
        let r = p(p(science, "rails")?, side)?.clone();
        let rs = if vrai(&r) && vrai(g(&r, "ok")) && vrai(g(&r, "_reservoir")) { g(&r, "_reservoir").clone() } else { nul() };
        let mut items = vec![Item { origine: "H0", sous: "depart".into(), mm: [0.0; 3], calage: nul(), cellule: None, chaine_rail: None, h6: None }];
        let mut cellules: Vec<Cel> = vec![];
        if vrai(&rs) {
            let nx = g(&r, "next");
            let pick = if vrai(nx) && vrai(g(nx, "pick")) { Some(cle_cellule(g(nx, "pick"))?) } else { None };
            let lmin = g(&rs, "lmin");
            for c in dense(p(&rs, "pool")?)? {
                if nullish(&c) { return hd("cellule nulle"); }
                let ratio = loss_ratio(g(&c, "loss"), lmin);
                let comp = in_competitive(&c, lmin);
                let strong = qualify_strong(&c)?;
                let astar = a_astar(&c)?;
                let publiee = match &pick { Some(pk) => cle_cellule(&c)? == *pk, None => false };
                cellules.push(Cel { c, ratio, comp, strong, astar, publiee });
            }
        }
        let mise = |k: usize, origine: &'static str, sous: &str| -> R<Item> {
            let Some(cel) = cellules.get(k) else { return hd("cellule") };
            let u = tn(g(&cel.c, "u"))?;
            let z = match g(&cel.c, "z") { V::Nombre(z) => *z, _ => return hd("z non numérique") };
            let brut = [0.0, tn(g(&rs, "sign"))? * u, z];
            let c = cap.v()?;
            let cal = convention::calibrate(&c, side, &tab_n(&brut), &o(vec![]), &cx.et.plafond)?;
            let fin = if vrai(g(&cal, "applied")) { let d = g(&cal, "delta"); [ixn(d, 0)?, ixn(d, 1)?, ixn(d, 2)?] } else { brut };
            Ok(Item { origine, sous: sous.into(), mm: [1000.0 * fin[0], 1000.0 * fin[1], 1000.0 * fin[2]], calage: cal, cellule: Some(k), chaine_rail: None, h6: None })
        };
        if let Some(k) = cellules.iter().position(|k| k.astar) { items.push(mise(k, "H1", "astar")?); }
        if vrai(chaine) && vrai(&ch_dec) && vrai(g(&ch_dec, "positions")) && ch_appuis(&ch_dec) {
            let c = cap.v()?;
            let Some(mm) = decalage_f(rail_de(&c, side)?, &gk(g(&ch_dec, "positions"), &s(side))?)? else { return hd("décalage de la chaîne nul (le JS lève)") };
            let cr = p(p(p(chaine, "v")?, "rails")?, side)?.clone();
            items.push(Item { origine: "H3", sous: "chaine".into(), mm, calage: nul(), cellule: None, chaine_rail: Some(cr), h6: None });
        }
        if let Some(vo) = voie { let x = vo.get(ks).copied().unwrap_or([0.0; 2]); items.push(Item { origine: "H3", sous: "voie".into(), mm: [0.0, x[0], x[1]], calage: nul(), cellule: None, chaine_rail: None, h6: None }); }
        if let Some(it) = interp { let x = it.get(ks).copied().unwrap_or([0.0; 2]); items.push(Item { origine: "H4", sous: (if humains_info { "voisins-humains" } else { "voisins-lot" }).into(), mm: [0.0, x[0], x[1]], calage: nul(), cellule: None, chaine_rail: None, h6: None }); }
        let sur = autre(side);
        let r_sur = p(p(science, "rails")?, sur)?.clone();
        if let Some(gm) = fin_de(g_med) {
            let ok = vrai(&r_sur) && vrai(g(&r_sur, "ok")) && {
                let nx = g(&r_sur, "next");
                if nullish(nx) { return hd("rail sans next (le JS lève)"); }
                est(g(nx, "status"), "candidate") && est_tableau(g(nx, "delta"))
            };
            if ok {
                let c = cap.v()?;
                let d_sur = g(g(&r_sur, "next"), "delta").clone();
                let pos_sur = lot::position_of(rail_de(&c, sur)?, &d_sur)?;
                let vert = 1000.0 * ixn(&d_sur, 2)?;
                let rail = rail_de(&c, side)?;
                let gf = |a: f64| -> R<f64> { gauge_mm(&lot::position_of(rail, &tab_n(&[0.0, a / 1000.0, vert / 1000.0]))?, &pos_sur) };
                let mut a_ = 0.0;
                for _ in 0..4 { let pente = (gf(a_ + 5.0)? - gf(a_)?) / 5.0; if !(pente.abs() > 0.3) { a_ = f64::NAN; break; } a_ -= (gf(a_)? - gm) / pente; }
                if a_.is_finite() && a_.abs() <= 80.0 && (gf(a_)? - gm).abs() < 0.5 { items.push(Item { origine: "H5", sous: "ecartement-median".into(), mm: [0.0, a_, vert], calage: nul(), cellule: None, chaine_rail: None, h6: None }); }
            }
        }
        if let Some(bh) = base_h6 {
            let bs = bh.get(ks).copied().unwrap_or([0.0; 3]);
            for mode in ["rail", "paire"] { for (fam, fv) in [("lot", &fam_lot), ("tous", &fam_tous)] { for vr in ["proche", "mediane"] {
                let f = if vrai(fv) { g(fv, vr).clone() } else { fv.clone() };
                if !vrai(&f) || (fam == "tous" && !est(g(&f, "source"), "humain")) { continue; }
                let off = if mode == "paire" { g(&f, "paire").clone() } else { g(&f, side).clone() };
                let (o0, o1) = (ixn(&off, 0)?, ixn(&off, 1)?);
                let src = g(&f, "source").clone();
                let disp = if vr == "mediane" { let d = g(&f, "dispersion"); if mode == "paire" { g(d, "paire").clone() } else { g(d, side).clone() } } else {
                    let md = g(fv, "mediane"); if vrai(md) { g(g(md, "dispersion"), if mode == "paire" { "paire" } else { side }).clone() } else { nul() } };
                let src_txt = texte(&src)?;
                items.push(Item { origine: "H6", sous: format!("h6-{src_txt}-{vr}-{mode}"), mm: [bs[0], bs[1] + o0, bs[2] + o1], calage: nul(), cellule: None, chaine_rail: None,
                    h6: Some(H6i { source: src, ampleur: hypot(&[o0, o1]), dist: if vr == "proche" { g(&f, "dist").clone() } else { g(&f, "distMax").clone() }, n: g(&f, "n").clone(), disp }) });
            } } }
        }
        let mut h2: Vec<usize> = (0..cellules.len()).filter(|i| cellules.get(*i).is_some_and(|k| !k.astar && (k.comp || vrai(&k.strong)))).collect();
        h2 = trier(h2, |i| {
            let Some(k) = cellules.get(*i) else { return hd("cellule") };
            let cs = if k.comp { tn(&k.strong)? } else { 0.0 };
            Ok(vec![cs, if k.comp { 1.0 } else { 0.0 }, tn(g(&k.c, "loss"))?])
        }, &[true, true, false])?;
        let mut h2_items = vec![];
        for i in &h2 {
            let Some(k) = cellules.get(*i) else { return hd("cellule") };
            let sous = if k.comp { if vrai(&k.strong) { "comp-strong" } else { "comp" } } else { "strong-ecartee" };
            h2_items.push(mise(*i, "H2", sous)?);
        }
        let mut gardees: Vec<Gardee> = vec![];
        let ajoute = |gardees: &mut Vec<Gardee>, it: Item| -> R<bool> {
            let pos_d = gardees.iter().position(|gd| hypot(&[gd.it.mm[0] - it.mm[0], gd.it.mm[1] - it.mm[1], gd.it.mm[2] - it.mm[2]]) < DOUBLON_MM);
            if let Some(di) = pos_d {
                let Some(d) = gardees.get_mut(di) else { return hd("gardée") };
                if !d.origines.contains(&it.origine) { d.origines.push(it.origine); }
                d.sous.push(it.sous.clone());
                if let Some(ic) = it.cellule {
                    d.cellules.push(ic);
                    let remplace = match d.cellule { None => true, Some(dc) => {
                        let (Some(a1), Some(a2)) = (cellules.get(ic), cellules.get(dc)) else { return hd("cellule") };
                        tn(g(&a1.c, "loss"))? < tn(g(&a2.c, "loss"))? } };
                    if remplace { d.cellule = Some(ic); d.calage = it.calage.clone(); }
                }
                if let Some(h) = it.h6 {
                    let prend = match &d.h6 { None => true, Some(dh) => !est(&dh.source, "lot") && est(&h.source, "lot") };
                    if prend { d.h6 = Some(h); }
                }
                return Ok(true);
            }
            if gardees.len() >= MAX_HYP { return Ok(false); }
            let cellules_ = it.cellule.map_or_else(Vec::new, |c| vec![c]);
            let h6 = it.h6.as_ref().map(|h| H6i { source: h.source.clone(), ampleur: h.ampleur, dist: h.dist.clone(), n: h.n.clone(), disp: h.disp.clone() });
            gardees.push(Gardee { origines: vec![it.origine], sous: vec![it.sous.clone()], cellules: cellules_, cellule: it.cellule, calage: it.calage.clone(), h6, it });
            Ok(true)
        };
        for it in items { let h6 = it.origine == "H6"; if !ajoute(&mut gardees, it)? && h6 { if let Some(t) = tronques_h6.get_mut(ks) { *t += 1.0; } } }
        for it in h2_items { let mm = it.mm; if !ajoute(&mut gardees, it)? { if let Some(t) = tronques.get_mut(ks) { t.push(tab(mm.iter().map(|v| ar(*v, 2)).collect())); } } }
        let rok = vrai(&r) && vrai(g(&r, "ok"));
        let nx = || -> R<&V> { let x = g(&r, "next"); if nullish(x) { hd("rail sans next (le JS lève)") } else { Ok(x) } };
        let statut = if rok { g(nx()?, "status").clone() } else { s("absent") };
        let motif = if rok { ou_nul(g(nx()?, "motif")) } else if vrai(&r) && vrai(g(&r, "error")) { s("erreur") } else { s("absent") };
        let ast = if vrai(&r) { g(&r, "astar").clone() } else { nul() };
        let comp = if vrai(&r) { g(&r, "competitive").clone() } else { nul() };
        let frame = if vrai(&r) { g(&r, "frame").clone() } else { nul() };
        let cv = |k: &str| if vrai(&comp) { g(&comp, k).clone() } else { nul() };
        rail_info.push((side, o(vec![("statut", statut), ("motif", motif),
            ("confianceAstar", if vrai(&ast) { arv(g(&ast, "confidence"), 1) } else { nul() }), ("rapportPerteAstar", if vrai(&ast) { arv(g(&ast, "lossRatio"), 2) } else { nul() }),
            ("s1", b(vrai(&r) && vrai(g(&r, "s1Changed")))), ("fortsConcurrents", if vrai(&comp) { ou_nul(g(&comp, "nStrongCompetitive")) } else { nul() }),
            ("competitives", cv("nCompetitive")), ("grappes", cv("nClusters")), ("fortsReservoir", cv("nStrongPool")),
            ("reservoir", if vrai(&rs) { longueur_js(g(&rs, "pool")) } else { n(0.0) }), ("pointsRail", if vrai(&frame) { g(&frame, "pointsLocal").clone() } else { nul() }),
            ("perteMin", if vrai(&rs) { sig4v(g(&rs, "lmin")) } else { nul() })])));
        res.push((gardees, cellules, rs));
    }
    let gm = fin_de(g_med);
    let ch_v = if vrai(chaine) { g(chaine, "v").clone() } else { nul() };
    let mut hyps: [Vec<Hyp>; 2] = [vec![], vec![]];
    for (ks, side) in SIDES.iter().enumerate() {
        let side: &'static str = side;
        let Some((gardees, cellules, rs)) = res.get(ks) else { return hd("rail") };
        let rinfo_s1 = rail_info.get(ks).is_some_and(|(_, v)| vrai(g(v, "s1")));
        let autre_ = autre(side);
        let mut out = vec![];
        for (i, gd) in gardees.iter().enumerate() {
            let mm_v = dec_v(&gd.it.mm);
            let m = if gd.h6.is_some() { mesures_translatees(cap, side, &mm_v, &gd.calage)? } else { mesures_pose(cap, side, &gd.it.mm, &gd.calage)? };
            let sig = &m.sig;
            let dc = gd.cellule.and_then(|k| cellules.get(k));
            let mut proche: Option<(f64, &Cel)> = None;
            if dc.is_none() && !cellules.is_empty() {
                let sign = tn(g(rs, "sign"))?;
                for k in cellules {
                    let d = hypot(&[1000.0 * (sign * tn(g(&k.c, "u"))?) - gd.it.mm[1], 1000.0 * tn(g(&k.c, "z"))? - gd.it.mm[2]]);
                    if proche.is_none_or(|(bd, _)| d < bd) { proche = Some((d, k)); }
                }
            }
            let pos_autre = { let c = cap.v()?; g(rail_de(&c, autre_)?, "positionSceneRelative").clone() };
            let gauge0 = gauge_mm(&m.pos, &pos_autre)?;
            let cels: Vec<&Cel> = gd.cellules.iter().filter_map(|k| cellules.get(*k)).collect();
            let some = |f: &dyn Fn(&Cel) -> bool| cels.iter().any(|k| f(k));
            let cv = |k: &str| dc.map_or_else(nul, |c| ou_nul(g(&c.c, k)));
            let balises = match dc { Some(c) => { let t = g(&c.c, "tags"); tab(trier_textes(liste_ou_vide(t)?)?) } None => nul() };
            let cal = &gd.calage;
            let mm = gd.it.mm;
            let ecart_voie = |mm: &[f64; 3]| voie.and_then(|vo| vo.get(ks).copied()).map_or_else(nul, |x| ar(hypot(&[mm[1] - x[0], mm[2] - x[1]]), 2));
            let ecart_vois = |mm: &[f64; 3]| interp.and_then(|vo| vo.get(ks).copied()).map_or_else(nul, |x| ar(hypot(&[mm[1] - x[0], mm[2] - x[1]]), 2));
            let mut traits: Vec<(String, V)> = vec![];
            let mut t = |k: &str, v: V| definir(&mut traits, k, v);
            t("perte", dc.map_or_else(nul, |c| sig4v(g(&c.c, "loss"))));
            t("ratioPerte", dc.map_or_else(nul, |c| ar(c.ratio, 3)));
            t("lignesSommet", cv("topRows"));
            t("faces", cv("faceCount"));
            t("strong", if dc.is_some() { b(some(&|k| vrai(&k.strong))) } else { nul() });
            t("palier", cv("tier"));
            t("pente", dc.map_or_else(nul, |c| b(vrai(g(&c.c, "slopeLimited")))));
            t("fenetre", dc.map_or_else(nul, |c| b(vrai(g(&c.c, "windowOk")))));
            t("competitive", if dc.is_some() { b(some(&|k| k.comp)) } else { nul() });
            t("astar", b(some(&|k| k.astar)));
            let publiee = some(&|k| k.publiee);
            t("publiee", b(publiee));
            t("s1", b(publiee && rinfo_s1));
            t("balises", balises);
            t("distCelluleMm", proche.map_or_else(nul, |(d, _)| ar(d, 1)));
            t("ratioCelluleProche", proche.map_or_else(nul, |(_, k)| ar(k.ratio, 3)));
            t("strongCelluleProche", proche.map_or_else(nul, |(_, k)| k.strong.clone()));
            t("pointsDessus", sig.pd.clone());
            t("pointsFlanc", sig.pf.clone());
            t("epaisseurDessusMm", sig.ep.clone());
            t("dzConventionMm", if vrai(cal) { arv(g(cal, "dzMm"), 2) } else { nul() });
            t("duConventionMm", if vrai(cal) { arv(g(cal, "duMm"), 2) } else { nul() });
            t("convention", if vrai(cal) { if vrai(g(cal, "applied")) { s("appliquee") } else if vrai(g(cal, "reason")) { g(cal, "reason").clone() } else { s("refusee") } } else { nul() });
            t("groupeHauteur", match &gd.it.chaine_rail { Some(cr) => ou_nul(g(cr, "groupe")), None => sig.groupe.clone() });
            t("deplMm", ar(hypot(&mm), 2));
            t("ecartVoieMm", ecart_voie(&mm));
            t("ecartVoisinsMm", ecart_vois(&mm));
            t("ecartementAutreH0Mm", ar(gauge0, 1));
            t("ecartMedAutreH0Mm", gm.map_or_else(nul, |x| ar(gauge0 - x, 1)));
            t("chaineEtage", if gd.it.chaine_rail.is_some() { if nullish(&ch_v) { return hd("chaine.v absente"); } g(&ch_v, "stage").clone() } else { nul() });
            if let Some(h6) = &gd.h6 {
                let cel = match dc { Some(c) => Some((0.0, c)), None => proche };
                let dans = cel.is_some_and(|(d, _)| d <= H6_RESERVOIR);
                t("h6AmpleurMm", ar(h6.ampleur, 2));
                t("h6DistCuts", h6.dist.clone());
                t("h6NVoisins", h6.n.clone());
                t("h6DispersionMm", arv(&h6.disp, 2));
                t("h6DansReservoir", b(dans));
                t("h6Perte", match cel { Some((_, k)) if dans => sig4v(g(&k.c, "loss")), _ => nul() });
                t("h6LignesSommet", match cel { Some((_, k)) if dans => ou_nul(g(&k.c, "topRows")), _ => nul() });
            }
            let correction: Option<f64> = match &gd.it.chaine_rail {
                Some(cr) => match g(cr, "hauteurMm") { V::Nombre(x) if x.is_finite() && *x != 0.0 => Some(*x), _ => None },
                None => if m.cor.0 != 0.0 && !m.cor.0.is_nan() { Some(m.cor.0) } else { None },
            };
            t("hauteurMm", correction.map_or_else(nul, n));
            t("hauteurAbstention", match &gd.it.chaine_rail { Some(cr) => ou_nul(g(cr, "hauteurAbstention")), None => m.cor.1.clone() });
            let mut orig: Vec<V> = gd.origines.iter().map(|x| s(x)).collect();
            orig = trier_textes(orig)?;
            let sous_o = trier_textes(uniques(gd.sous.iter().map(|x| s(x)).collect())?)?;
            let e = vec![("rang".to_owned(), n(i as f64)), ("origine".to_owned(), s(gd.it.origine)), ("sous".to_owned(), s(gd.sous.first().map_or("", String::as_str))),
                ("origines".to_owned(), tab(orig)), ("sousOrigines".to_owned(), tab(sous_o)), ("decal".to_owned(), tab(mm.iter().map(|v| ar(*v, 2)).collect()))];
            let base_traits = traits.clone();
            out.push(Hyp { e: e.clone(), traits, pos: m.pos.clone(), hauteur: false });
            if let Some(cor) = correction {
                let mm2 = [mm[0], mm[1], mm[2] + cor];
                let pos = { let c = cap.v()?; positions_f(rail_de(&c, side)?, &mm2)? };
                let mut e2 = e;
                if let Some(x) = e2.iter_mut().find(|(k, _)| k == "decal") { x.1 = tab(mm2.iter().map(|v| ar(*v, 2)).collect()); }
                let mut tr2 = base_traits;
                let g2 = gauge_mm(&pos, &pos_autre)?;
                definir(&mut tr2, "deplMm", ar(hypot(&mm2), 2));
                definir(&mut tr2, "ecartVoieMm", ecart_voie(&mm2));
                definir(&mut tr2, "ecartVoisinsMm", ecart_vois(&mm2));
                definir(&mut tr2, "ecartementAutreH0Mm", ar(g2, 1));
                definir(&mut tr2, "ecartMedAutreH0Mm", gm.map_or_else(nul, |x| ar(g2 - x, 1)));
                out.push(Hyp { e: e2, traits: tr2, pos, hauteur: true });
            }
        }
        if let Some(h) = hyps.get_mut(ks) { *h = out; }
    }
    // ecartPaireMedMm (après que les deux rails ont leurs hypothèses)
    let poses: [Vec<V>; 2] = [hyps[0].iter().map(|h| h.pos.clone()).collect(), hyps[1].iter().map(|h| h.pos.clone()).collect()];
    for ks in 0..2 {
        let autres = poses.get(1 - ks).cloned().unwrap_or_default();
        let Some(hs) = hyps.get_mut(ks) else { return hd("rail") };
        for h in hs.iter_mut() {
            let v = if let Some(gmv) = gm {
                let mut mini = f64::INFINITY;
                for op in &autres { mini = ariane_js::min(mini, (gauge_mm(&h.pos, op)? - gmv).abs()); }
                if mini.is_finite() { ar(mini, 1) } else { nul() }
            } else { nul() };
            definir(&mut h.traits, "ecartPaireMedMm", v);
        }
    }
    let [hl_, hr_] = &hyps;
    let rails_v = o(vec![("left", tab(hl_.iter().map(Hyp::clone_v).collect())), ("right", tab(hr_.iter().map(Hyp::clone_v).collect()))]);
    let (ecart_depart, abstenu) = {
        let c = cap.v()?;
        let ed = gauge_mm(g(rail_de(&c, "left")?, "positionSceneRelative"), g(rail_de(&c, "right")?, "positionSceneRelative"))?;
        let mut tous = true;
        for side in SIDES {
            let r = p(p(science, "rails")?, side)?;
            if !(vrai(r) && vrai(g(r, "ok")) && { let nx = g(r, "next"); if nullish(nx) { return hd("rail sans next (le JS lève)"); } est(g(nx, "status"), "candidate") }) { tous = false; break; }
        }
        let sm = g(science, "summary");
        (ed, !tous || (vrai(sm) && vrai(g(sm, "pairGaugeRejected"))))
    };
    let support = |mm: [[f64; 3]; 2]| -> R<[(f64, f64); 2]> { Ok([soutien(cap, "left", &dec_v(&mm[0]))?, soutien(cap, "right", &dec_v(&mm[1]))?]) };
    let soutenu = |x: &(f64, f64)| x.0 >= H6_DESSUS && x.1 >= H6_FLANC;
    let ref_h6 = |fv: &V| -> R<V> {
        let r = if vrai(fv) { g(fv, "reference").clone() } else { fv.clone() };
        if !vrai(&r) { return Ok(nul()); }
        let Some(bh) = base_h6 else { return hd("base H6") };
        let rv = |side: &str, i: usize| -> R<f64> { ixn(p(&r, side)?, i) };
        let pose = |k: usize, side: &str| -> R<V> { let bs = bh.get(k).copied().unwrap_or([0.0; 3]); Ok(tab(vec![ar(bs[1] + rv(side, 0)?, 2), ar(bs[2] + rv(side, 1)?, 2)])) };
        let mmr = [[bh[0][0], bh[0][1] + rv("left", 0)?, bh[0][2] + rv("left", 1)?], [bh[1][0], bh[1][1] + rv("right", 0)?, bh[1][2] + rv("right", 1)?]];
        let s_ref = support(mmr)?;
        let s_dep = support([[0.0; 3]; 2])?;
        let loin = maxv(&[(bh[0][1] + rv("left", 0)?).abs(), (bh[1][1] + rv("right", 0)?).abs()]) > H6_CONCURRENT;
        let mut motifs = dense(p(&r, "motifs")?)?;
        if !s_ref.iter().all(soutenu) { motifs.push(s("sans-support-local")); }
        if loin && s_dep.iter().all(soutenu) { motifs.push(s("voie-concurrente-au-depart")); }
        let disp = p(&r, "dispersion")?;
        let sure = motifs.is_empty();
        Ok(o(vec![("left", pose(0, "left")?), ("right", pose(1, "right")?), ("n", g(&r, "n").clone()), ("distMin", g(&r, "distMin").clone()), ("distMax", g(&r, "distMax").clone()),
            ("dispersionMm", o(vec![("left", arv(g(disp, "left"), 2)), ("right", arv(g(disp, "right"), 2))])), ("ancres", g(&r, "ancres").clone()),
            ("support", o(vec![("reference", tab(s_ref.iter().map(|x| soutien_v(*x)).collect())), ("depart", tab(s_dep.iter().map(|x| soutien_v(*x)).collect()))])),
            ("motifs", tab(motifs)), ("sure", b(sure))]))
    };
    let voie_h6 = if base_h6.is_some() { o(vec![("tous", ref_h6(&fam_tous)?), ("lot", ref_h6(&fam_lot)?), ("departLot", b(vrai(depart_esv)))]) } else { nul() };
    let sd = p(seul, "decision")?;
    if nullish(sd) { return hd("seul.decision absente (le JS lève)"); }
    let raison = { let r = g(sd, "reason"); if nullish(r) { nul() } else { s(&texte_k(r, 60)?) } };
    let ch_info = |k: &str| if vrai(chaine) { g(&ch_dec, k).clone() } else { nul() };
    let appuis_ch = if vrai(chaine) { let au = g(&ch_dec, "anchorsUsed"); long_ou0(au) } else { n(0.0) };
    if vrai(chaine) && nullish(&ch_dec) { return hd("chaine.decision absente"); }
    let pg = g(science, "pairGauge");
    let sm = g(science, "summary");
    let cut = o(vec![("abstenu", b(abstenu)), ("differe", b(est(g(sd, "stage"), "deferred"))), ("etage", g(sd, "stage").clone()), ("raison", raison),
        ("etageChaine", ch_info("stage")), ("appuisChaine", appuis_ch), ("voisins", info), ("ecartDepartMm", ar(ecart_depart, 1)), ("gMedMm", arv(g_med, 1)),
        ("ecartementMm", if vrai(pg) { arv(g(pg, "predictedMm"), 1) } else { nul() }), ("ecartementRejete", b(vrai(sm) && vrai(g(sm, "pairGaugeRejected")))),
        ("nHyp", o(vec![("left", n(hyps[0].len() as f64)), ("right", n(hyps[1].len() as f64))]))]);
    let [tl, tr] = tronques;
    Ok(o(vec![("rails", rails_v), ("rail", o(rail_info)), ("tronques", o(vec![("left", tab(tl)), ("right", tab(tr))])), ("voieH6", voie_h6),
        ("tronquesH6", o(vec![("left", n(tronques_h6[0])), ("right", n(tronques_h6[1]))])), ("cut", cut)]))
}
impl Hyp {
    fn clone_v(&self) -> V { let mut e = self.e.clone(); e.push(("traits".into(), V::Objet(self.traits.clone()))); e.push(("hauteur".into(), b(self.hauteur))); V::Objet(e) }
}

// ---------------------------------------------------------------- traits et score
/// `T(nom, src, chemin, tr)`.
#[allow(clippy::struct_field_names)]
struct Tr { nom: &'static str, src: &'static str, chemin: &'static str, tr: &'static str }
const fn t_(nom: &'static str, src: &'static str, chemin: &'static str, tr: &'static str) -> Tr { Tr { nom, src, chemin, tr } }
const NUM: [Tr; 53] = [
    t_("perte", "hyp", "perte", "log10"), t_("ratioPerte", "hyp", "ratioPerte", "log"), t_("lignesSommet", "hyp", "lignesSommet", "log"), t_("faces", "hyp", "faces", "id"),
    t_("pointsDessus", "hyp", "pointsDessus", "log"), t_("pointsFlanc", "hyp", "pointsFlanc", "log"), t_("epaisseurDessusMm", "hyp", "epaisseurDessusMm", "id"),
    t_("distCelluleMm", "hyp", "distCelluleMm", "log"), t_("ratioCelluleProche", "hyp", "ratioCelluleProche", "log"),
    t_("dzConventionMm", "hyp", "dzConventionMm", "id"), t_("duConventionMm", "hyp", "duConventionMm", "id"), t_("deplMm", "hyp", "deplMm", "log"),
    t_("ecartVoieMm", "hyp", "ecartVoieMm", "log"), t_("ecartVoisinsMm", "hyp", "ecartVoisinsMm", "log"), t_("ecartMedAutreH0Mm", "hyp", "ecartMedAutreH0Mm", "abs"),
    t_("ecartPaireMedMm", "hyp", "ecartPaireMedMm", "abs"), t_("hauteurMm", "hyp", "hauteurMm", "id"),
    t_("strong", "hyp", "strong", "bool"), t_("pente", "hyp", "pente", "bool"), t_("fenetre", "hyp", "fenetre", "bool"), t_("competitive", "hyp", "competitive", "bool"),
    t_("astar", "hyp", "astar", "bool"), t_("publiee", "hyp", "publiee", "bool"), t_("s1", "hyp", "s1", "bool"), t_("strongCelluleProche", "hyp", "strongCelluleProche", "bool"),
    t_("hauteur", "lig", "hauteur", "bool"),
    t_("confianceAstar", "rail", "confianceAstar", "id"), t_("rapportPerteAstar", "rail", "rapportPerteAstar", "log"), t_("s1Rail", "rail", "s1", "bool"),
    t_("fortsConcurrents", "rail", "fortsConcurrents", "log"), t_("competitives", "rail", "competitives", "log"), t_("grappes", "rail", "grappes", "log"),
    t_("fortsReservoir", "rail", "fortsReservoir", "log"), t_("reservoir", "rail", "reservoir", "log"), t_("pointsRail", "rail", "pointsRail", "log"), t_("perteMin", "rail", "perteMin", "log10"),
    t_("appuisChaine", "ctx", "appuisChaine", "id"), t_("voisinsN", "ctx", "voisinsN", "id"), t_("voisinsHumains", "ctx", "voisinsHumains", "id"), t_("voisinsLot", "ctx", "voisinsLot", "id"),
    t_("voisinsEncadre", "ctx", "voisinsEncadre", "bool"), t_("voisinsCoupMin", "ctx", "voisinsCoupMin", "log"), t_("ecartDepartMedMm", "ctx", "ecartDepartMedMm", "abs"),
    t_("accNProches5", "acc", "nProches5", "log"), t_("accNProches10", "acc", "nProches10", "log"), t_("accPlusProcheMm", "acc", "plusProcheMm", "log"),
    t_("accDistH1Mm", "acc", "distH1Mm", "log"), t_("accDistChaineMm", "acc", "distChaineMm", "log"), t_("accDistVoisinsMm", "acc", "distVoisinsMm", "log"), t_("accNOrigines", "acc", "nOrigines", "id"),
    t_("h6AmpleurMm", "hyp", "h6AmpleurMm", "log"), t_("h6DistCuts", "hyp", "h6DistCuts", "log"), t_("h6NVoisins", "hyp", "h6NVoisins", "id"),
];
const NUM2: [Tr; 4] = [
    t_("h6DispersionMm", "hyp", "h6DispersionMm", "log"), t_("h6Perte", "hyp", "h6Perte", "log10"), t_("h6LignesSommet", "hyp", "h6LignesSommet", "log"), t_("h6DansReservoir", "hyp", "h6DansReservoir", "bool"),
];
fn num_traits() -> impl Iterator<Item = &'static Tr> { NUM.iter().chain(NUM2.iter()) }
const CAT: [Tr; 10] = [
    t_("palier", "hyp", "palier", "id"), t_("convention", "hyp", "convention", "id"), t_("groupeHauteur", "hyp", "groupeHauteur", "id"), t_("chaineEtage", "hyp", "chaineEtage", "id"),
    t_("hauteurAbstention", "hyp", "hauteurAbstention", "id"), t_("statut", "rail", "statut", "id"), t_("motif", "rail", "motif", "id"), t_("etageChaine", "ctx", "etageChaine", "id"),
    t_("zone", "ctx", "zone", "id"), t_("role", "ctx", "role", "id"),
];
const MULTI: [Tr; 3] = [t_("balises", "hyp", "balises", "id"), t_("origines", "lig", "origines", "id"), t_("sousOrigines", "lig", "sousOrigines", "id")];

/// `transfo(tr, v)`.
fn transfo(tr: &str, v: &V) -> f64 {
    if nullish(v) { return f64::NAN; }
    if tr == "bool" { return match v { V::Booleen(true) => 1.0, V::Booleen(false) => 0.0, _ => f64::NAN }; }
    let V::Nombre(x) = v else { return f64::NAN };
    let x = *x;
    if !x.is_finite() { return f64::NAN; }
    match tr { "log" => ariane_js::sign(x) * log1p(x.abs()), "log10" => log10(ariane_js::max(x, 1e-12)), "abs" => x.abs(), _ => x }
}
fn transfo_v(tr: &V, v: &V) -> V { n(match tr { V::Chaine(t) => transfo(t, v), _ => transfo("", v) }) }
/// `accords(hyps)`.
fn accords(hyps: &[V]) -> R<Vec<V>> {
    let dec = |h: &V| -> R<[f64; 3]> { let d = p(h, "decal")?; Ok([ixn(d, 0)?, ixn(d, 1)?, ixn(d, 2)?]) };
    let d = |a: &[f64; 3], c: &[f64; 3]| hypot(&[a[0] - c[0], a[1] - c[1], a[2] - c[2]]);
    let inc = |h: &V, k: &str, x: &str| -> R<bool> { let l = p(h, k)?; if nullish(l) { return hd("includes de null"); } match l { V::Chaine(c) => Ok(c.contains(x)), t if est_tableau(t) => inclut(t, &s(x)), _ => hd("includes") } };
    let mut decs = vec![];
    for h in hyps { decs.push(dec(h)?); }
    let trouve = |k: &str, x: &str| -> R<Option<usize>> { for (i, h) in hyps.iter().enumerate() { if !vrai(g(h, "hauteur")) && inc(h, k, x)? { return Ok(Some(i)); } } Ok(None) };
    let (h1, ch, vo) = (trouve("origines", "H1")?, trouve("sousOrigines", "chaine")?, trouve("origines", "H4")?);
    let mut out = vec![];
    for (i, h) in hyps.iter().enumerate() {
        let Some(di) = decs.get(i) else { return hd("décalage") };
        let (mut n5, mut n10, mut mini) = (0.0, 0.0, f64::INFINITY);
        for (j, dj) in decs.iter().enumerate() { if j == i { continue; } let e = d(di, dj); if e <= 5.0 { n5 += 1.0; } if e <= 10.0 { n10 += 1.0; } if e < mini { mini = e; } }
        let dist = |x: Option<usize>| x.and_then(|j| decs.get(j)).map_or_else(nul, |dj| n(d(di, dj)));
        out.push(o(vec![("nProches5", n(n5)), ("nProches10", n(n10)), ("plusProcheMm", if mini.is_finite() { n(mini) } else { nul() }), ("distH1Mm", dist(h1)),
            ("distChaineMm", dist(ch)), ("distVoisinsMm", dist(vo)), ("nOrigines", longueur_js(p(h, "origines")?))]));
    }
    Ok(out)
}
/// `brut(ligne, rail, ctx, acc)` : `{n, c, m}` (`n` : tableau, rétabli en `Float64Array` par la façade).
fn brut(ligne: &V, rail: &V, ctx: &V, acc: &V) -> R<V> {
    if nullish(ligne) { return hd("ligne nulle"); }
    let hyp = if vrai(g(ligne, "traits")) { g(ligne, "traits") } else { &V::Objet(vec![]) };
    let rail = if vrai(rail) { rail } else { &V::Objet(vec![]) };
    let src = |t: &Tr| -> &V { match t.src { "hyp" => hyp, "lig" => ligne, "rail" => rail, "ctx" => ctx, _ => acc } };
    let lire = |t: &Tr| -> R<V> { let x = src(t); if nullish(x) { hd("source nulle") } else { Ok(g(x, t.chemin).clone()) } };
    let mut nn = vec![];
    for t in num_traits() { nn.push(transfo(t.tr, &lire(t)?)); }
    let mut c = vec![];
    for t in &CAT { let v = lire(t)?; c.push(if nullish(&v) { s("∅") } else { s(&texte(&v)?) }); }
    let mut m = vec![];
    for t in &MULTI {
        let v = lire(t)?;
        m.push(if est_tableau(&v) { let mut x = vec![]; for e in dense(&v)? { x.push(s(&texte(&e)?)); } tab(x) } else { V::Tableau(vec![]) });
    }
    Ok(o(vec![("n", tab_n(&nn)), ("c", tab(c)), ("m", tab(m))]))
}
/// `new Float64Array(p)` : longueur (`ToIndex`).
fn longueur_typee(v: &V) -> R<usize> {
    match v {
        V::Indefini | V::Nul => Ok(0),
        V::Nombre(x) if x.is_finite() && *x > -1.0 && x.trunc() <= 1e7 => Ok(en_usize(ariane_js::max(x.trunc(), 0.0))),
        V::Booleen(x) => Ok(usize::from(*x)),
        _ => hd("longueur de Float64Array"),
    }
}
/// `coder(fit, l)` (sans `out` ni `off`).
fn coder(fit: &V, l: &V) -> R<Vec<f64>> {
    if nullish(fit) || nullish(l) { return hd("coder : null"); }
    let pn = longueur_typee(g(fit, "p"))?;
    let mut out = vec![0.0; pn];
    let mut j = 0usize;
    let mut ecrire = |x: f64, j: &mut usize| { if let Some(o_) = out.get_mut(*j) { *o_ = x; } *j += 1; };
    let ln = p(l, "n")?;
    let (lc, lm) = (p(l, "c")?, p(l, "m")?);
    let Some(num) = elems(p(fit, "num")?) else { return hd("fit.num") };
    for (c, f) in num.iter().enumerate() {
        let Some(f) = f else { continue };
        if !vrai(f) || vrai(g(f, "constant")) { continue; }
        let v = ix(ln, c)?;
        let ko = matches!(v, V::Nombre(x) if x.is_nan());
        let x = if ko { 0.0 } else { ariane_js::max(-6.0, ariane_js::min(6.0, (tn(&v)? - tn(g(f, "moy"))?) / tn(g(f, "sd"))?)) };
        ecrire(x, &mut j);
        if vrai(g(f, "manque")) { ecrire(if ko { 1.0 } else { 0.0 }, &mut j); }
    }
    let Some(cat) = elems(p(fit, "cat")?) else { return hd("fit.cat") };
    for (c, vals) in cat.iter().enumerate() {
        let Some(vals) = vals else { continue };
        if !est_tableau(vals) { return hd("catégories non tableau"); }
        if longueur(vals).unwrap_or(0) > 1 {
            let lcc = ix(lc, c)?;
            for v in crate::j4::iter_vals(vals) { ecrire(if strict_egal(&lcc, &v)? { 1.0 } else { 0.0 }, &mut j); }
        }
    }
    let Some(multi) = elems(p(fit, "multi")?) else { return hd("fit.multi") };
    for (c, vals) in multi.iter().enumerate() {
        let Some(vals) = vals else { continue };
        if !est_tableau(vals) { return hd("catégories non tableau"); }
        let lmc = ix(lm, c)?;
        if !est_tableau(&lmc) { return hd("l.m non tableau"); }
        for v in crate::j4::iter_vals(vals) { ecrire(if inclut(&lmc, &v)? { 1.0 } else { 0.0 }, &mut j); }
    }
    Ok(out)
}
fn sigmoide(z: f64) -> f64 { if z >= 0.0 { 1.0 / (1.0 + exp(-z)) } else { exp(z) / (1.0 + exp(z)) } }
fn platt(c: &V, z: f64) -> R<f64> { if nullish(c) { return hd("calibrage nul"); } Ok(sigmoide(tn(g(c, "a"))? * z + tn(g(c, "b"))?)) }
/// `probas(mod, x)` : (p10, p5).
fn probas(m: &V, x: &V) -> R<(f64, f64)> {
    if nullish(m) { return hd("modèle nul"); }
    let v = coder(p(m, "fit")?, x)?;
    let lin = |mm: &V| -> R<f64> {
        if nullish(mm) { return hd("modèle nul"); }
        let mut s_ = tn(g(mm, "intercept"))?;
        let coef = p(mm, "coef")?;
        for (j, x) in v.iter().enumerate() { s_ += x * ixn(coef, j)?; }
        Ok(s_)
    };
    Ok((platt(p(m, "cal10")?, lin(p(m, "m10")?)?)?, platt(p(m, "cal5")?, lin(p(m, "m5")?)?)?))
}
/// `modeleFige(params, usage)`.
fn modele_fige(params: &V, usage: &V) -> R<V> {
    let usage = if matches!(usage, V::Indefini) { s("lot") } else { usage.clone() };
    if !vrai(params) || !est(g(params, "format"), FORMAT_PARAMS) { return Err(Echec::erreur(format!("paramètres : format {FORMAT_PARAMS} attendu"))); }
    let us = g(params, "usages");
    let u = if vrai(us) { gk(us, &usage)? } else { us.clone() };
    if !vrai(&u) { return Err(Echec::erreur(format!("paramètres : usage « {} » absent", texte(&usage)?))); }
    // new Map(…) : la dernière entrée d'un même nom l'emporte
    let norm_l = liste_ou_vide(g(&u, "normalisation"))?;
    let mut norm: Vec<(V, V)> = vec![];
    for x in norm_l { if nullish(&x) { return hd("normalisation nulle"); } let k = g(&x, "nom").clone(); if let Some(e) = { let mut f = None; for (i, (kk, _)) in norm.iter().enumerate() { if svz(kk, &k)? { f = Some(i); break; } } f } { if let Some(e) = norm.get_mut(e) { e.1 = x; } } else { norm.push((k, x)); } }
    let accord = !matches!(g(params, "accord"), V::Booleen(false));
    let mut num = vec![];
    let mut noms: Vec<String> = vec![];
    for t in num_traits() {
        let mut x = V::Indefini;
        for (k, v) in &norm { if est(k, t.nom) { x = v.clone(); } }
        if vrai(&x) {
            let manque = vrai(g(&x, "manque"));
            noms.push(t.nom.to_owned());
            if manque { noms.push(format!("{}:manque", t.nom)); }
            num.push(o(vec![("moy", g(&x, "moyenne").clone()), ("sd", g(&x, "ecartType").clone()), ("constant", b(false)), ("manque", b(manque))]));
        } else { num.push(nul()); }
    }
    let cats = p(&u, "categories")?;
    let lire_cat = |nom: &str| -> R<V> { let v = gk(cats, &s(nom))?; if !vrai(&v) { Ok(V::Tableau(vec![])) } else if est_tableau(&v) { Ok(v) } else { hd("catégories non tableau") } };
    let mut cat = vec![];
    for t in &CAT { let vals = lire_cat(t.nom)?; if longueur(&vals).unwrap_or(0) > 1 { for v in crate::j4::iter_vals(&vals) { noms.push(format!("{}={}", t.nom, texte(&v)?)); } } cat.push(vals); }
    let mut multi = vec![];
    for t in &MULTI { let vals = lire_cat(t.nom)?; for v in crate::j4::iter_vals(&vals) { noms.push(format!("{}∋{}", t.nom, texte(&v)?)); } multi.push(vals); }
    let col = g(&u, "colonnes");
    let egal = est_tableau(col) && longueur(col) == Some(noms.len()) && noms.iter().enumerate().all(|(i, x)| matches!(elem(col, i), V::Chaine(c) if c == *x));
    if !egal {
        if nullish(col) { return hd("colonnes absentes"); }
        return Err(Echec::erreur(format!("paramètres : les colonnes reconstruites ({}) ne sont pas celles du fichier ({}) : refus", noms.len(), texte(&longueur_js(col))?)));
    }
    let pn = noms.len() as f64;
    for k in ["modele10", "modele5"] {
        let co = p(p(&u, k)?, "coefficients")?;
        if nullish(co) { return hd("coefficients absents"); }
        if !matches!(longueur_js(co), V::Nombre(x) if x == pn) { return Err(Echec::erreur(format!("paramètres : {k} n'a pas {} coefficients", ariane_js::nombre::nombre_en_chaine(pn)))); }
    }
    let coef = |k: &str| -> R<V> { let co = g(g(&u, k), "coefficients"); if !est_tableau(co) { return hd("coefficients non tableau"); } let mut x = vec![]; for e in dense(co)? { x.push(tn(&e)?); } Ok(tab_n(&x)) };
    let cal = |k: &str| -> R<V> { let c = p(&u, k)?; if nullish(c) { return hd("calibrage absent"); } Ok(o(vec![("a", g(c, "a").clone()), ("b", g(c, "b").clone())])) };
    let seuils = g(&u, "seuils");
    if matches!(seuils, V::Indefini) { return hd("JSON.parse(undefined)"); }
    let fit = o(vec![("num", tab(num)), ("cat", tab(cat)), ("multi", tab(multi)), ("noms", tab(noms.iter().map(|x| s(x)).collect())), ("p", n(pn)), ("accord", b(accord))]);
    Ok(o(vec![("usage", usage), ("version", ou_nul(g(params, "version"))), ("date", ou_nul(g(params, "date"))), ("fit", fit),
        ("m10", o(vec![("coef", coef("modele10")?), ("intercept", g(g(&u, "modele10"), "intercept").clone())])),
        ("m5", o(vec![("coef", coef("modele5")?), ("intercept", g(g(&u, "modele5"), "intercept").clone())])),
        ("cal10", cal("calibrage10")?), ("cal5", cal("calibrage5")?), ("seuils", json_aller_retour(seuils)?)]))
}

/// `casDuDiffere({cut, zone, hyp, gMed, voieRef})`.
fn cas_du_differe(cut: &V, zone: &V, hyp: &V, g_med: &V, voie_ref: &V) -> R<V> {
    let hc = p(p(hyp, "cut")?, "ecartDepartMm")?.clone();
    let hcut = g(hyp, "cut");
    let v = if vrai(g(hcut, "voisins")) { g(hcut, "voisins").clone() } else { V::Objet(vec![]) };
    let edm = match (fin_de(&hc), fin_de(g_med)) { (Some(a), Some(c)) => n(a - c), _ => nul() };
    let ctx = o(vec![("zone", zone.clone()), ("role", s("differe")), ("etageChaine", g(hcut, "etageChaine").clone()), ("appuisChaine", g(hcut, "appuisChaine").clone()),
        ("voisinsN", ou_nul(g(&v, "n"))), ("voisinsHumains", ou_nul(g(&v, "humains"))), ("voisinsLot", ou_nul(g(&v, "lot"))), ("voisinsEncadre", ou_nul(g(&v, "encadre"))),
        ("voisinsCoupMin", ou_nul(g(&v, "coupMin"))), ("ecartDepartMedMm", edm)]);
    let mut rails = vec![];
    let mut i0s = vec![];
    for side in SIDES {
        let mut liste = vec![];
        for h in dense(p(p(hyp, "rails")?, side)?)? {
            if nullish(&h) { return hd("hypothèse nulle"); }
            let tr = etale(g(&h, "traits"), vec![("zone", zone.clone()), ("role", s("differe"))])?;
            let mut e = vec![]; etaler(&mut e, &h)?; definir(&mut e, "traits", tr);
            liste.push(V::Objet(e));
        }
        let acc = accords(&liste)?;
        let rail = p(p(hyp, "rail")?, side)?;
        let mut hs = vec![];
        for (i, h) in liste.iter().enumerate() {
            let orig = p(h, "origines")?;
            let h6 = match orig { V::Chaine(c) => c.contains("H6"), t if est_tableau(t) => inclut(t, &s("H6"))?, _ => return hd("origines") };
            hs.push(o(vec![("rang", g(h, "rang").clone()), ("hauteur", b(vrai(g(h, "hauteur")))), ("origines", orig.clone()), ("sousOrigines", g(h, "sousOrigines").clone()),
                ("decal", g(h, "decal").clone()), ("g", p(p(h, "traits")?, "ecartementAutreH0Mm")?.clone()), ("x", brut(h, rail, &ctx, acc.get(i).unwrap_or(&INDEF))?), ("h6", b(h6))]));
        }
        let mut i0 = -1.0;
        for (i, h) in hs.iter().enumerate() { if !vrai(g(h, "hauteur")) && inclut_v(g(h, "origines"), "H0")? { i0 = i as f64; break; } }
        if i0 < 0.0 {
            for (i, h) in hs.iter().enumerate() {
                if vrai(g(h, "hauteur")) { continue; }
                let d = p(h, "decal")?;
                if nullish(d) { return hd("decal nul"); }
                let mut tous = true;
                for x in dense(d)? { if !(tn(&x)?.abs() < 0.75) { tous = false; break; } }
                if tous { i0 = i as f64; break; }
            }
        }
        i0s.push((side, n(i0)));
        rails.push((side, o(vec![("hyps", tab(hs))])));
    }
    Ok(o(vec![("cut", cut.clone()), ("zone", zone.clone()), ("role", s("differe")), ("gMed", fin_de(g_med).map_or_else(nul, |x| ar(x, 1))), ("G0", hc),
        ("rails", o(rails)), ("voieRef", if vrai(voie_ref) { voie_ref.clone() } else { nul() }), ("i0", o(i0s))]))
}
fn inclut_v(l: &V, x: &str) -> R<bool> { match l { V::Chaine(c) => Ok(c.contains(x)), t if est_tableau(t) => inclut(t, &s(x)), _ => hd("includes") } }
/// `ecartementPaire(k, hl, hr)`.
fn ecartement_paire(k: &V, hl: &V, hr: &V) -> R<Option<f64>> {
    let g0 = p(k, "G0")?;
    let (Some(a), Some(l), Some(r)) = (fin_de(g0), fin_de(p(hl, "g")?), fin_de(p(hr, "g")?)) else { return Ok(None) };
    Ok(Some(a + (l - a) + (r - a)))
}
fn hyps_de(k: &V, side: &str) -> R<V> { Ok(p(p(p(k, "rails")?, side)?, "hyps")?.clone()) }
fn longueur_l(v: &V) -> R<usize> { match longueur_js(v) { V::Nombre(x) if x >= 0.0 && x.is_finite() => Ok(en_usize(x)), V::Indefini => Ok(0), _ => hd("longueur") } }
/// Probabilités d'un cas : `probasDonnees[s]` ou `probas(mod, h.x).p10`.
fn probas_cas(k: &V, m: &V, donnees: &V) -> R<[Vec<f64>; 2]> {
    let mut out: [Vec<f64>; 2] = [vec![], vec![]];
    for (ks, side) in SIDES.iter().enumerate() {
        let mut t = vec![];
        if vrai(donnees) {
            let d = g(donnees, side);
            if !est_tableau(d) { return hd("Float64Array.from d'un non-tableau"); }
            for x in crate::j4::iter_vals(d) { t.push(tn(&x)?); }
        } else {
            for h in dense(&hyps_de(k, side)?)? { if nullish(&h) { return hd("hypothèse nulle"); } t.push(probas(m, g(&h, "x"))?.0); }
        }
        if let Some(o_) = out.get_mut(ks) { *o_ = t; }
    }
    Ok(out)
}
fn probas_v(pr: &[Vec<f64>; 2]) -> V { let [l, r] = pr; o(vec![("left", tab_n(l)), ("right", tab_n(r))]) }
fn pv(pr: &[Vec<f64>], ks: usize, i: &V) -> R<f64> {
    let t = pr.get(ks).map_or(&[][..], Vec::as_slice);
    Ok(match idx(i)? { Some(j) => t.get(j).copied().unwrap_or(f64::NAN), None => f64::NAN })
}
/// Indice d'un tableau lu par `t[i]` : entier positif canonique, ou `None` (lecture d'une clé non indicielle : `undefined`).
fn idx(i: &V) -> R<Option<usize>> {
    match i {
        V::Nombre(x) if x.is_finite() && *x >= 0.0 && x.trunc() == *x && *x < 4_294_967_295.0 => Ok(Some(en_usize(*x))),
        V::Chaine(c) if est_indice(c) => Ok(c.parse::<usize>().ok()),
        V::Chaine(c) if c == "length" => hd("length par clé"),
        V::Nombre(_) | V::Booleen(_) | V::Nul | V::Indefini | V::Chaine(_) => Ok(None),
        _ => hd("indice objet"),
    }
}
fn at(t: &V, i: &V) -> R<V> { if nullish(t) { return hd("indice de null"); } match idx(i)? { Some(j) => gi(t, j), None => Ok(V::Indefini) } }
fn seuils_zone(m: &V, zone: &V) -> R<V> {
    let se = p(m, "seuils")?;
    if nullish(se) { return hd("seuils absents"); }
    let z = gk(se, zone)?;
    if vrai(&z) { return Ok(z); }
    let h = g(se, "hors");
    Ok(if vrai(h) { h.clone() } else { o(vec![("actif", b(false))]) })
}
fn max4(hl: &V, hr: &V) -> R<f64> {
    let (dl, dr) = (p(hl, "decal")?, p(hr, "decal")?);
    Ok(maxv(&[ixn(dl, 1)?.abs(), ixn(dl, 2)?.abs(), ixn(dr, 1)?.abs(), ixn(dr, 2)?.abs()]))
}
struct Best { i: V, j: V, v: f64, ecart: f64, h0: bool, permises: f64 }
/// `meilleurePaire(k, p, regle)`.
fn meilleure_paire(k: &V, pr: &[Vec<f64>; 2], regle: &V) -> R<Best> {
    let (lh, rh) = (hyps_de(k, "left")?, hyps_de(k, "right")?);
    let i0s = p(k, "i0")?;
    let (i0, j0) = (p(i0s, "left")?.clone(), p(i0s, "right")?.clone());
    let mut best = Best { i: i0.clone(), j: j0.clone(), v: pv(pr, 0, &i0)? * pv(pr, 1, &j0)?, ecart: 0.0, h0: true, permises: 0.0 };
    let (nl, nr) = (longueur_l(&lh)?, longueur_l(&rh)?);
    let g_med = fin_de(p(k, "gMed")?);
    let contrat = p(regle, "contratMm")?;
    for i in 0..nl { for j in 0..nr {
        if strict_egal(&n(i as f64), &i0)? && strict_egal(&n(j as f64), &j0)? { continue; }
        let (hl, hr) = (gi(&lh, i)?, gi(&rh, j)?);
        if nullish(&hl) || nullish(&hr) { return hd("hypothèse nulle"); }
        let Some(gp) = ecartement_paire(k, &hl, &hr)? else { continue };
        let med_ok = match g_med { Some(m) => (gp - m).abs() <= tn(g(regle, "ecartementMedianeMm"))?, None => false };
        if !(med_ok || (gp >= ixn(contrat, 0)? && gp <= ixn(contrat, 1)?)) { continue; }
        best.permises += 1.0;
        let v = pr.first().and_then(|t| t.get(i)).copied().unwrap_or(f64::NAN) * pr.get(1).and_then(|t| t.get(j)).copied().unwrap_or(f64::NAN);
        if v > best.v { best = Best { i: n(i as f64), j: n(j as f64), v, ecart: max4(&hl, &hr)?, h0: false, permises: best.permises }; }
    } }
    Ok(best)
}
fn paire_de(hl: &V, hr: &V) -> V {
    let c = |h: &V| o(vec![("decal", g(h, "decal").clone()), ("origines", g(h, "origines").clone()), ("sousOrigines", g(h, "sousOrigines").clone()), ("hauteur", g(h, "hauteur").clone())]);
    o(vec![("left", c(hl)), ("right", c(hr))])
}
fn hypothese(hl: &V, hr: &V) -> R<V> {
    let mut t = vec![];
    for h in [hl, hr] { let or = p(h, "origines")?; if !est_tableau(or) { return hd("origines non tableau"); } t.extend(crate::j4::iter_vals(or)); }
    Ok(s(&joindre(&trier_textes(uniques(t)?)?, "+")?))
}
/// Fin commune de `deciderL1` et `deciderL1Ref`.
fn regle_l1(k: &V, m: &V, pr: &[Vec<f64>; 2], best: &Best, regle: &V, reference: bool, max150: f64) -> R<V> {
    let z = seuils_zone(m, p(k, "zone")?)?;
    let (hl, hr) = (at(&hyps_de(k, "left")?, &best.i)?, at(&hyps_de(k, "right")?, &best.j)?);
    if nullish(&hl) || nullish(&hr) { return hd("hypothèse nulle"); }
    let ecart3d = ariane_js::max(norme_v(p(&hl, "decal")?)?, norme_v(p(&hr, "decal")?)?);
    let mut out = vec![];
    let mut t = |k_: &str, v: V| definir(&mut out, k_, v);
    t("zone", g(k, "zone").clone()); t("tau", ou_nul(g(&z, "tau"))); t("delta", ou_nul(g(&z, "delta"))); t("p", ar(best.v, 4)); t("ecartDepartMm", ar(ecart3d, 1));
    t("ecartMaxLatVertMm", ar(best.ecart, 1)); t("paire", paire_de(&hl, &hr)); t("i", best.i.clone()); t("j", best.j.clone()); t("permises", n(best.permises));
    t("hypothese", hypothese(&hl, &hr)?); t("probas", probas_v(pr));
    if reference { t("selection", s("reference")); }
    let fin = |etat: &str, motif: V, extra: Vec<(&str, V)>| -> V { let mut e = out.clone(); definir(&mut e, "etat", s(etat)); definir(&mut e, "motif", motif); for (k_, v) in extra { definir(&mut e, k_, v); } V::Objet(e) };
    if best.h0 { let mut v = fin("rien", s("depart-le-plus-probable"), vec![]); mettre(&mut v, "paire", nul())?; return Ok(v); }
    if !vrai(g(&z, "actif")) { return Ok(fin("rien", s("zone-inactive"), vec![])); }
    if best.ecart < tn(g(&z, "delta"))? { return Ok(fin("rien", s("sous-delta"), vec![])); }
    if best.v >= tn(g(&z, "tau"))? { return Ok(fin("valider", nul(), vec![])); }
    if !reference && est(g(regle, "variante"), "L1-v") {
        let loin = ecart3d > max150;
        return Ok(fin(if loin { "rien" } else { "valider" }, s(if loin { "plus-de-150-mm" } else { "sous-tau-a-controler" }), vec![("aControler", b(ecart3d <= max150))]));
    }
    if ecart3d > max150 { return Ok(fin("rien", s("plus-de-150-mm"), vec![])); }
    Ok(fin("poser-sans-valider", s("sous-tau"), vec![]))
}
fn sans_depart(k: &V, pr: &[Vec<f64>; 2]) -> R<Option<V>> {
    let i0 = p(k, "i0")?;
    if nullish(i0) { return hd("i0 absent"); }
    for side in SIDES { if tn(g(i0, side))? < 0.0 {
        return Ok(Some(o(vec![("etat", s("rien")), ("motif", s("sans-pose-de-depart")), ("p", nul()), ("paire", nul()), ("ecartDepartMm", nul()), ("zone", g(k, "zone").clone()), ("probas", probas_v(pr))])));
    } }
    Ok(None)
}
fn regle_defaut() -> V {
    o(vec![("version", s("L1")), ("variante", s("L1")), ("sansValiderMaxMm", n(150.0)), ("ecartementMedianeMm", n(15.0)), ("contratMm", tab_n(&[1420.0, 1470.0])),
        ("lotOptions", o(vec![("pairGuard", b(false)), ("gap", n(10.0))]))])
}
/// `deciderL1(k, mod, regle, probasDonnees)`.
fn decider_l1(k: &V, m: &V, regle: &V, donnees: &V) -> R<V> {
    if nullish(k) { return hd("cas nul"); }
    let pr = probas_cas(k, m, donnees)?;
    if let Some(v) = sans_depart(k, &pr)? { return Ok(v); }
    let best = meilleure_paire(k, &pr, regle)?;
    let max150 = tn(g(regle, "sansValiderMaxMm"))?;
    regle_l1(k, m, &pr, &best, regle, false, max150)
}
/// `deciderL1Ref(k, mod, ref, capture, probasDonnees)`.
fn decider_l1_ref(k: &V, m: &V, refmm: f64, cap: &Cap, donnees: &V, cx: &Cx) -> R<V> {
    let pr = probas_cas(k, m, donnees)?;
    if let Some(v) = sans_depart(k, &pr)? { return Ok(v); }
    let (lh, rh) = (hyps_de(k, "left")?, hyps_de(k, "right")?);
    let i0s = p(k, "i0")?;
    let (i0, j0) = (p(i0s, "left")?.clone(), p(i0s, "right")?.clone());
    let mut best = Best { i: i0.clone(), j: j0.clone(), v: pv(&pr, 0, &i0)? * pv(&pr, 1, &j0)?, ecart: 0.0, h0: true, permises: 0.0 };
    let sel = tn(cx.l("selectionRefMm"))?;
    for i in 0..longueur_l(&lh)? { for j in 0..longueur_l(&rh)? {
        if strict_egal(&n(i as f64), &i0)? && strict_egal(&n(j as f64), &j0)? { continue; }
        let v = pr.first().and_then(|t| t.get(i)).copied().unwrap_or(f64::NAN) * pr.get(1).and_then(|t| t.get(j)).copied().unwrap_or(f64::NAN);
        if !(v > best.v) { continue; }
        let (hl, hr) = (gi(&lh, i)?, gi(&rh, j)?);
        if nullish(&hl) || nullish(&hr) { return hd("hypothèse nulle"); }
        let gg = ecartement_decal(cap, &o(vec![("left", p(&hl, "decal")?.clone()), ("right", p(&hr, "decal")?.clone())]))?;
        if !((gg - refmm).abs() <= sel) { continue; }
        best.permises += 1.0;
        best = Best { i: n(i as f64), j: n(j as f64), v, ecart: max4(&hl, &hr)?, h0: false, permises: best.permises };
    } }
    regle_l1(k, m, &pr, &best, &regle_defaut(), true, 150.0)
}
/// `ecartementDecal(capture, decal)`.
fn ecartement_decal(cap: &Cap, decal: &V) -> R<f64> {
    let c = cap.v()?;
    let l = positions_mm(rail_de(&c, "left")?, p(decal, "left")?)?;
    let r = positions_mm(rail_de(&c, "right")?, p(decal, "right")?)?;
    gauge_mm(&l, &r)
}
/// `ramenerRail(capture, decal, rail, ref, maxMm)`.
fn ramener_rail(cap: &Cap, decal: &V, rail: &V, refmm: &V, max_mm: f64) -> R<V> {
    let (dl, dr) = (copie_tableau(p(decal, "left")?)?, copie_tableau(p(decal, "right")?)?);
    let side = cote(rail)?;
    let base1 = ix(p(decal, side)?, 1)?;
    let rf = tn(refmm)?;
    let avec = |x: V| -> R<V> {
        let mut d = if side == "left" { dl.clone() } else { dr.clone() };
        let Some(mut e) = elems(&d) else { return hd("décalage") };
        if e.len() < 2 { e.resize(2, None); }
        if let Some(c) = e.get_mut(1) { *c = Some(x); }
        d = V::Tableau(e);
        Ok(if side == "left" { o(vec![("left", d), ("right", dr.clone())]) } else { o(vec![("left", dl.clone()), ("right", d)]) })
    };
    let gf = |a: f64| -> R<f64> { ecartement_decal(cap, &avec(n(plus(&base1, &n(a))?))?) };
    let mut a = 0.0;
    for _ in 0..6 { let pente = (gf(a + 5.0)? - gf(a)?) / 5.0; if !(pente.abs() > 0.3) { return Ok(nul()); } a -= (gf(a)? - rf) / pente; }
    if !a.is_finite() || a.abs() > max_mm || (gf(a)? - rf).abs() > 0.5 { return Ok(nul()); }
    avec(ar(plus(&base1, &n(a))?, 2))
}
/// `corrigerDecal({capture, decal, ref, ordre, gApprox, leviers})`.
fn corriger_decal(cap: &Cap, decal: &V, refmm: &V, ordre: &V, g_approx: &V, lev: &V) -> R<V> {
    let gv = if vrai(g(lev, "exact")) && cap.vrai()? { n(ecartement_decal(cap, decal)?) } else { g_approx.clone() };
    let ecart = match (fin_de(&gv), fin_de(refmm)) { (Some(x), Some(r)) => ar(r - x, 1), _ => nul() };
    let mut out = o(vec![("ref", refmm.clone()), ("ecartMm", ecart.clone()), ("anomalie", b(false)), ("rail", nul()), ("soutenue", b(false)), ("decal", nul())]);
    let Some(e) = fin_de(&ecart) else { return Ok(out) };
    let e = e.abs();
    if e < tn(g(lev, "anomalieMinMm"))? || e > tn(g(lev, "anomalieMaxMm"))? { return Ok(out); }
    mettre(&mut out, "anomalie", b(true))?;
    if !cap.vrai()? { return Ok(out); }
    let ord = dense(ordre)?;
    let ord: Vec<V> = if vrai(g(lev, "autreRail")) { ord } else { ord.into_iter().take(1).collect() };
    let mut rail_pris = false;
    for sv in ord {
        let nd = ramener_rail(cap, decal, &sv, refmm, 60.0)?;
        if !vrai(&nd) { continue; }
        let side = cote(&sv)?;
        let m = soutien(cap, side, p(&nd, side)?)?;
        if m.0 >= SOUTIEN_DESSUS && m.1 >= SOUTIEN_FLANC { mettre(&mut out, "rail", sv)?; mettre(&mut out, "soutenue", b(true))?; mettre(&mut out, "decal", nd)?; return Ok(out); }
        if !rail_pris { mettre(&mut out, "rail", sv)?; rail_pris = true; }
    }
    Ok(out)
}
/// `ordreRails(capture, decal, p)`.
fn ordre_rails(cap: &Cap, decal: &V, pr: &V) -> R<V> {
    let ord = |a: bool| tab(vec![s(if a { "left" } else { "right" }), s(if a { "right" } else { "left" })]);
    if vrai(pr) { if let (Some(l), Some(r)) = (fin_de(g(pr, "left")), fin_de(g(pr, "right"))) { return Ok(ord(l <= r)); } }
    let ml = soutien(cap, "left", p(decal, "left")?)?;
    let mr = soutien(cap, "right", p(decal, "right")?)?;
    Ok(ord(ml.0 <= mr.0))
}

// ---------------------------------------------------------------- voie absolue, recherche recentrée
/// `voieAbsolue(capture, cut, voisins, fenetre, parCote, coherents)`.
fn voie_absolue(cap: &Cap, cut: &V, voisins: &V, fenetre: &V, par_cote: &V, coherents: &V) -> R<V> {
    let fenetre = if matches!(fenetre, V::Indefini) { 6.0 } else { tn(fenetre)? };
    let par_cote = if matches!(par_cote, V::Indefini) { n(3.0) } else { par_cote.clone() };
    let cut_n = tn(cut)?;
    let mut vus: HashSet<u64> = HashSet::new();
    let mut liste: Vec<([[V; 3]; 2], f64)> = vec![];
    for v in liste_ou_vide(voisins)? {
        if !vrai(&v) || !vrai(g(&v, "identity")) || !vrai(g(&v, "positions")) || !entier(g(g(&v, "identity"), "cut")) { continue; }
        let vc = tn(g(g(&v, "identity"), "cut"))?;
        let dc = vc - cut_n;
        if dc == 0.0 || dc.is_nan() || dc.abs() > fenetre || vus.contains(&ariane_js::cle_same_value_zero(vc)) { continue; }
        let c = cap.v()?;
        let (Some(l), Some(r)) = (decalage_brut(rail_de(&c, "left")?, g(g(&v, "positions"), "left"))?, decalage_brut(rail_de(&c, "right")?, g(g(&v, "positions"), "right"))?) else { continue };
        vus.insert(ariane_js::cle_same_value_zero(vc));
        liste.push(([l, r], dc));
    }
    if vrai(coherents) && liste.len() >= 3 {
        let (pc, bm) = (tn(g(coherents, "parCutMm"))?, tn(g(coherents, "baseMm"))?);
        let ok = |a: &([[V; 3]; 2], f64), c: &([[V; 3]; 2], f64)| -> R<bool> {
            for (da, dc_) in a.0.iter().zip(c.0.iter()) {
                if !(hypot(&[tn(&da[1])? - tn(&dc_[1])?, tn(&da[2])? - tn(&dc_[2])?]) <= pc * (a.1 - c.1).abs() + bm) { return Ok(false); } }
            Ok(true)
        };
        let mut gardes = vec![];
        for (i, a) in liste.iter().enumerate() { let mut un = false; for (j, c) in liste.iter().enumerate() { if i != j && ok(a, c)? { un = true; break; } } if un { gardes.push(a.clone()); } }
        if gardes.len() >= 2 { liste = gardes; }
    }
    let pc_n = tn(&par_cote)?;
    let mut out = vec![];
    for (k, side) in SIDES.iter().enumerate() {
        let pts: Vec<([V; 3], f64)> = liste.iter().filter_map(|q| q.0.get(k).map(|d| (d.clone(), q.1))).collect();
        let av = trier(pts.iter().filter(|q| q.1 < 0.0).cloned().collect(), |q| Ok(vec![q.1]), &[true])?;
        let ap = trier(pts.iter().filter(|q| q.1 > 0.0).cloned().collect(), |q| Ok(vec![q.1]), &[false])?;
        let prendre = |t: Vec<([V; 3], f64)>| -> Vec<([V; 3], f64)> { let fin = crate::js::slice_debut(t.len(), pc_n); t.into_iter().take(fin).collect() };
        let (av, ap) = (prendre(av), prendre(ap));
        let pp: Vec<([V; 3], f64)> = av.iter().chain(ap.iter()).cloned().collect();
        if pp.is_empty() { return Ok(nul()); }
        let pr = trier(pp.clone(), |q| Ok(vec![q.1.abs()]), &[false])?;
        let Some(pr) = pr.first() else { return Ok(nul()) };
        let nb = pp.len() as f64;
        let fit = |c: usize| -> R<(V, Option<f64>)> {
            let mut sx = 0.0; let mut sy = 0.0;
            for q in &pp { sx += tn(&q.0[0])?; } let mx = sx / nb;
            for q in &pp { sy += c3(&q.0, c)?; } let my = sy / nb;
            let mut sxx = 0.0; for q in &pp { sxx += crate::js::pow(tn(&q.0[0])? - mx, 2.0); }
            let pente = nb >= 2.0 && sxx > 1.0;
            let bb = if pente { let mut t = 0.0; for q in &pp { t += (tn(&q.0[0])? - mx) * (c3(&q.0, c)? - my); } t / sxx } else { 0.0 };
            let a = if pente { n(my - bb * mx) } else { pr.0.get(c).cloned().unwrap_or(V::Indefini) };
            let res = if nb >= 3.0 { let an = tn(&a)?; let mut t = vec![]; for q in &pp { t.push((c3(&q.0, c)? - (an + bb * tn(&q.0[0])?)).abs()); } Some(maxv(&t)) } else { None };
            Ok((a, res))
        };
        let (fl, fv) = (fit(1)?, fit(2)?);
        let encadre = match (av.first(), ap.first()) {
            (Some(a), Some(c)) => {
                let (a0, c0) = (tn(&a.0[0])?, tn(&c.0[0])?);
                let t = if (c0 - a0).abs() > 1e-6 { (0.0 - a0) / (c0 - a0) } else { 0.5 };
                let (a1, a2, c1, c2) = (tn(&a.0[1])?, tn(&a.0[2])?, tn(&c.0[1])?, tn(&c.0[2])?);
                o(vec![("v", tab(vec![ar(a1 + t * (c1 - a1), 1), ar(a2 + t * (c2 - a2), 1)])), ("saut", ar(hypot(&[c1 - a1, c2 - a2]), 1)), ("cuts", tab_n(&[-a.1, c.1]))])
            }
            _ => nul(),
        };
        out.push((*side, o(vec![("v", tab(vec![arv(&fl.0, 1), arv(&fv.0, 1)])), ("proche", tab(vec![arv(&pr.0[1], 1), arv(&pr.0[2], 1)])), ("distProche", n(pr.1.abs())),
            ("n", o(vec![("avant", n(av.len() as f64)), ("apres", n(ap.len() as f64))])), ("residuMm", fl.1.map_or_else(nul, |x| ar(x, 1))), ("encadre", encadre)])));
    }
    Ok(o(out))
}
fn filtre_fort() -> V { o(vec![("minTop", n(15.0)), ("minFace", n(6.0)), ("ratioMax", n(1.5))]) }
/// `rechercheRecentree(capture, seeds, filtre)`.
fn recherche_recentree(cap: &Cap, seeds: &V, filtre: &V, cx: &Cx) -> R<V> {
    if nullish(seeds) { return hd("graines nulles"); }
    let mut rails: Vec<(&'static str, V)> = vec![];
    let mut tr_rails: [Option<V>; 2] = [None, None];
    let mut orig: [Option<V>; 2] = [None, None];
    {
        let c = cap.v()?;
        for (k, side) in SIDES.iter().enumerate() {
            let sd = g(seeds, side);
            if !vrai(sd) { continue; }
            let rail = rail_de(&c, side)?;
            let pos = lot::position_of(rail, &tab_n(&[0.0, ixn(sd, 0)? / 1000.0, ixn(sd, 1)? / 1000.0]))?;
            let pr = g(rail, "positionSceneRelative");
            if dense(&pos)?.len() != 3 { return hd("translation de longueur ≠ 3"); }
            let mut t = [0.0; 3];
            for (i, x) in t.iter_mut().enumerate() { *x = tn(&ix(&pos, i)?)? - ixn(pr, i)?; }
            let tr = aides::translated(rail, t)?;
            if let Some(x) = tr_rails.get_mut(k) { *x = Some(tr.clone()); }
            if let Some(x) = orig.get_mut(k) { *x = Some(rail.clone()); }
            rails.push((side, tr));
        }
    }
    let et = cx.reservoir();
    cap.avec_rails(rails, |ct| {
        let sci = match shadow::scientific_propose_both(ct, &et) { Ok(v) => v, Err(Echec::Js { .. }) => return Ok(nul()), Err(e) => return Err(e) };
        let mut out = vec![];
        for (k, side) in SIDES.iter().enumerate() {
            if !vrai(g(seeds, side)) { continue; }
            let r = p(p(&sci, "rails")?, side)?;
            if !vrai(r) || !vrai(g(r, "ok")) || !vrai(g(r, "_reservoir")) { out.push((*side, V::Tableau(vec![]))); continue; }
            let rs = g(r, "_reservoir");
            let lmin = g(rs, "lmin");
            let (Some(Some(rail_t)), Some(Some(rail_o))) = (tr_rails.get(k), orig.get(k)) else { return hd("rail translaté") };
            let mut t = vec![];
            for c in dense(p(rs, "pool")?)? {
                if nullish(&c) { return hd("cellule nulle"); }
                if !vrai(g(&c, "windowOk")) || vrai(g(&c, "slopeLimited")) { continue; }
                let top0 = { let x = g(&c, "topRows"); if nullish(x) { 0.0 } else { tn(x)? } };
                if !(top0 >= tn(g(filtre, "minTop"))?) { continue; }
                let face0 = { let x = g(&c, "faceCount"); if nullish(x) { 0.0 } else { tn(x)? } };
                if !(face0 >= tn(g(filtre, "minFace"))?) { continue; }
                let ratio = loss_ratio(g(&c, "loss"), lmin);
                if !(ratio <= tn(g(filtre, "ratioMax"))?) { continue; }
                let u = tn(g(&c, "u"))?;
                let z = match g(&c, "z") { V::Nombre(z) => *z, _ => return hd("z non numérique") };
                let brut = [0.0, tn(g(rs, "sign"))? * u, z];
                let cal = convention::calibrate(ct, side, &tab_n(&brut), &o(vec![]), &cx.et.plafond)?;
                let fin = if vrai(g(&cal, "applied")) { g(&cal, "delta").clone() } else { tab_n(&brut) };
                let mmv = decalage_v(rail_o, &lot::position_of(rail_t, &fin)?)?;
                let strong = qualify_strong(&c)?;
                let fort = if vrai(&strong) { b(in_competitive(&c, lmin)) } else { strong };
                let astar = a_astar(&c)?;
                if !vrai(&mmv) { continue; }
                t.push(o(vec![("mm", mmv), ("ratio", ar(ratio, 3)), ("top", g(&c, "topRows").clone()), ("face", g(&c, "faceCount").clone()), ("fort", fort), ("astar", b(astar))]));
            }
            out.push((*side, tab(t)));
        }
        Ok(o(out))
    })
}
/// Cellule de `pairesRecentrees`.
#[derive(Clone)]
struct CelR { mm: V, ratio: V, top: V, face: V, fort: V, astar: V, vues: Vec<usize>, graines: Vec<V> }
impl CelR {
    fn valeur(&self, avec_graines: bool) -> V {
        let mut t = vec![("mm", self.mm.clone()), ("ratio", self.ratio.clone()), ("top", self.top.clone()), ("face", self.face.clone()), ("fort", self.fort.clone()), ("astar", self.astar.clone())];
        if avec_graines { t.push(("graines", tab(self.graines.clone()))); }
        o(t)
    }
}
#[derive(Clone)]
struct Paire { decal: V, dg: V, dv: Option<f64>, dz: Option<f64>, depl: V, cel: (usize, usize), top: f64, face: f64, ratio: f64, fort: V }
impl Paire {
    fn valeur(&self, cl: &[CelR], cr: &[CelR]) -> V {
        let gr = |c: Option<&CelR>| c.map_or_else(|| V::Tableau(vec![]), |c| tab(c.graines.clone()));
        o(vec![("decal", self.decal.clone()), ("dg", self.dg.clone()), ("dv", self.dv.map_or_else(nul, n)), ("dz", self.dz.map_or_else(nul, n)), ("depl", self.depl.clone()),
            ("top", n(self.top)), ("face", n(self.face)), ("ratio", n(self.ratio)), ("fort", self.fort.clone()),
            ("graines", o(vec![("left", gr(cl.get(self.cel.0))), ("right", gr(cr.get(self.cel.1)))]))])
    }
}
struct Recherche { paires: Vec<Paire>, cellules: [Vec<CelR>; 2], graines: Vec<V>, relances: usize }
fn ou_v(a: &V, c: &V) -> V { if vrai(a) { a.clone() } else { c.clone() } }
fn et_v(a: &V, c: &V) -> V { if vrai(a) { c.clone() } else { a.clone() } }
/// `pairesRecentrees(capture, graines, refMm, va, ecartMm, {filtre, dedupMm, assez})`.
fn paires_recentrees(cap: &Cap, graines: &V, ref_mm: &V, va: &V, ecart_mm: &V, filtre: &V, dedup: &V, assez: Option<&dyn Fn(&[Paire]) -> R<bool>>, cx: &Cx) -> R<Recherche> {
    let dedup = if matches!(dedup, V::Indefini) { 5.0 } else { tn(dedup)? };
    let mut cs: [Vec<CelR>; 2] = [vec![], vec![]];
    let mut vues: Vec<(V, V, Vec<V>)> = vec![];
    let rf = tn(ref_mm)?;
    let em = tn(ecart_mm)?;
    let paires = |cs: &[Vec<CelR>; 2]| -> R<Vec<Paire>> {
        let mut r = vec![];
        let [cl, cr] = cs;
        for (il, l) in cl.iter().enumerate() { for (ir, rr) in cr.iter().enumerate() {
            let arr = |m: &V| -> R<V> { let mut t = vec![]; for x in dense(m)? { t.push(arv(&n(tn(&x)?), 2)); } Ok(tab(t)) };
            let decal = o(vec![("left", arr(&l.mm)?), ("right", arr(&rr.mm)?)]);
            let dg = rf - ecartement_decal(cap, &decal)?;
            if !(dg.abs() <= em) { continue; }
            let (dv, dz) = if vrai(va) {
                let mut a = vec![]; let mut c = vec![];
                for side in SIDES { let d = p(&decal, side)?; let pr = p(p(va, side)?, "proche")?; a.push((ixn(d, 1)? - ixn(pr, 0)?).abs()); c.push((ixn(d, 2)? - ixn(pr, 1)?).abs()); }
                (Some(maxv(&a)), Some(maxv(&c)))
            } else { (None, None) };
            let depl = ar(ariane_js::max(norme_v(p(&decal, "left")?)?, norme_v(p(&decal, "right")?)?), 1);
            r.push(Paire { decal, dg: ar(dg, 1), dv, dz, depl, cel: (il, ir), top: ariane_js::min(tn(&l.top)?, tn(&rr.top)?), face: ariane_js::min(tn(&l.face)?, tn(&rr.face)?),
                ratio: ariane_js::max(tn(&l.ratio)?, tn(&rr.ratio)?), fort: et_v(&l.fort, &rr.fort) });
        } }
        trier(r, |a| Ok(vec![a.dv.unwrap_or(0.0), tn(&a.dg)?.abs()]), &[false, false])
    };
    let mut out = vec![];
    for gv in liste_ou_vide(graines)? {
        if !vrai(&gv) { continue; }
        let mut ok = true;
        for side in SIDES { let x = g(&gv, side); if !est_tableau(x) { ok = false; break; } for e in dense(x)? { if !fini(&e) { ok = false; break; } } if !ok { break; } }
        if !ok { continue; }
        let mut dej = None;
        for (i, v) in vues.iter().enumerate() {
            let mut tous = true;
            for (k, side) in SIDES.iter().enumerate() { let vv = if k == 0 { &v.0 } else { &v.1 }; let gs = g(&gv, side);
                if !(hypot(&[ixn(vv, 0)? - ixn(gs, 0)?, ixn(vv, 1)? - ixn(gs, 1)?]) < dedup) { tous = false; break; } }
            if tous { dej = Some(i); break; }
        }
        if let Some(i) = dej { if let Some(v) = vues.get_mut(i) { v.2.push(g(&gv, "nom").clone()); } continue; }
        let vi = vues.len();
        vues.push((g(&gv, "left").clone(), g(&gv, "right").clone(), vec![g(&gv, "nom").clone()]));
        let seeds = o(vec![("left", g(&gv, "left").clone()), ("right", g(&gv, "right").clone())]);
        let rr = recherche_recentree(cap, &seeds, filtre, cx)?;
        if !vrai(&rr) { continue; }
        for (k, side) in SIDES.iter().enumerate() {
            let Some(c_s) = cs.get_mut(k) else { return hd("rail") };
            for x in liste_ou_vide(g(&rr, side))? {
                let xm = g(&x, "mm").clone();
                let mut d = None;
                for (i, c) in c_s.iter().enumerate() { if hypot(&[ixn(&c.mm, 1)? - ixn(&xm, 1)?, ixn(&c.mm, 2)? - ixn(&xm, 2)?]) < 2.0 { d = Some(i); break; } }
                if let Some(i) = d {
                    let Some(c) = c_s.get_mut(i) else { return hd("cellule") };
                    if !c.vues.contains(&vi) { c.vues.push(vi); }
                    if tn(g(&x, "ratio"))? < tn(&c.ratio)? { c.ratio = g(&x, "ratio").clone(); }
                    c.top = n(ariane_js::max(tn(&c.top)?, tn(g(&x, "top"))?));
                    c.face = n(ariane_js::max(tn(&c.face)?, tn(g(&x, "face"))?));
                    c.fort = ou_v(&c.fort, g(&x, "fort"));
                } else {
                    c_s.push(CelR { mm: xm, ratio: g(&x, "ratio").clone(), top: g(&x, "top").clone(), face: g(&x, "face").clone(), fort: g(&x, "fort").clone(), astar: g(&x, "astar").clone(), vues: vec![vi], graines: vec![] });
                }
            }
        }
        if let Some(f) = assez { out = paires(&cs)?; if f(&out)? { break; } }
    }
    let _ = out;
    for c_s in &mut cs { for c in c_s.iter_mut() {
        let mut t = vec![];
        for vi in &c.vues { if let Some(v) = vues.get(*vi) { t.extend(v.2.iter().cloned()); } }
        c.graines = uniques(t)?;
    } }
    let paires_f = paires(&cs)?;
    let mut gr = vec![];
    for v in &vues { gr.push(s(&joindre(&v.2, "=")?)); }
    Ok(Recherche { paires: paires_f, cellules: cs, graines: gr, relances: vues.len() })
}
fn recherche_v(r: &Recherche) -> V {
    let [cl, cr] = &r.cellules;
    o(vec![("paires", tab(r.paires.iter().map(|x| x.valeur(cl, cr)).collect())), ("cellules", o(vec![("left", tab(cl.iter().map(|c| c.valeur(true)).collect())), ("right", tab(cr.iter().map(|c| c.valeur(true)).collect()))])),
        ("graines", tab(r.graines.clone())), ("relances", n(r.relances as f64))])
}

/// `avecRupture(voie, cut, zones)` : `zones` en table (clé : cut, valeur : ADV ?).
fn avec_rupture(voie: &V, cut: &V, zones: &std::collections::HashMap<u64, bool>) -> R<V> {
    if !vrai(voie) { return Ok(voie.clone()); }
    let adv = |c: f64| zones.get(&ariane_js::cle_same_value_zero(c)).copied().unwrap_or(false);
    let cn = tn(cut)?;
    let t = adv(cn);
    let mut rompu = false;
    for a in liste_ou_vide(g(voie, "ancres"))? {
        if nullish(&a) { return hd("ancre nulle"); }
        let ac = tn(g(&a, "cut"))?;
        let (mut c, fin) = (ariane_js::min(ac, cn), ariane_js::max(ac, cn));
        if fin - c > 1e6 { return hd("plage démesurée"); }
        while c <= fin { if zones.contains_key(&ariane_js::cle_same_value_zero(c)) && adv(c) != t { rompu = true; break; } c += 1.0; }
        if rompu { break; }
    }
    if !rompu { return Ok(voie.clone()); }
    let mut motifs = dense(p(voie, "motifs")?)?;
    motifs.push(s("rupture-de-serie"));
    etale(voie, vec![("motifs", tab(motifs)), ("sure", b(false))])
}

/// `voieDeListe(table, cut, capture, cfg)`.
fn voie_de_liste(table: &V, cut: &V, cap: &Cap, cfg: &V) -> R<V> {
    let cfg = if matches!(cfg, V::Indefini) { o(vec![("fenetre", n(8.0)), ("parCote", n(3.0)), ("residuMaxMm", n(4.0)), ("rigideMaxMm", n(2.0))]) } else { cfg.clone() };
    let c = cap.v()?;
    if !vrai(table) || !vrai(&c) || !vrai(g(&c, "rails")) || !entier(cut) { return Ok(nul()); }
    let cutn = tn(cut)?;
    let tn_ = tn(g(table, "n"))?;
    if cutn < 0.0 || cutn >= tn_ { return Ok(nul()); }
    let ed = p(table, "ed")?;
    if !est_tableau(ed) { return hd("ed non tableau"); }
    let row = |i: f64| -> R<Option<[[f64; 3]; 2]>> {
        let lg = longueur(ed).unwrap_or(0) as f64; // exact : longueur < 2^53
        let deb = crate::js::slice_debut(en_usize(lg), 6.0 * i);
        let fin = crate::js::slice_debut(en_usize(lg), 6.0 * i + 6.0);
        if fin < deb || fin - deb != 6 { return Ok(None); }
        let mut e = [0.0; 6];
        for (k, x) in e.iter_mut().enumerate() { match elems(ed).and_then(|t| t.get(deb + k).cloned()) { Some(Some(V::Nombre(y))) if y.is_finite() => *x = y, Some(None) => return hd("ed troué"), _ => return Ok(None) } }
        Ok(Some([[e[0] / 1e4, e[1] / 1e4, e[2] / 1e4], [e[3] / 1e4, e[4] / 1e4, e[5] / 1e4]]))
    };
    let Some(r0) = row(cutn)? else { return Ok(nul()) };
    let mut prs = [[0.0; 3]; 2];
    for (k, side) in SIDES.iter().enumerate() {
        let rail = g(g(&c, "rails"), side);
        if !vrai(rail) { return Ok(nul()); }
        let Some(pr) = vec3(g(rail, "positionSceneRelative"))? else { return Ok(nul()) };
        if let Some(x) = prs.get_mut(k) { *x = pr; }
    }
    let tt: [[f64; 3]; 2] = [[r0[0][0] - prs[0][0], r0[0][1] - prs[0][1], r0[0][2] - prs[0][2]], [r0[1][0] - prs[1][0], r0[1][1] - prs[1][1], r0[1][2] - prs[1][2]]];
    let rigide = 1000.0 * hypot(&[tt[0][0] - tt[1][0], tt[0][1] - tt[1][1], tt[0][2] - tt[1][2]]);
    if !(rigide <= tn(g(&cfg, "rigideMaxMm"))?) { return Ok(o(vec![("sure", b(false)), ("rigideMm", ar(rigide, 1)), ("motif", s("repere"))])); }
    let tm = [(tt[0][0] + tt[1][0]) / 2.0, (tt[0][1] + tt[1][1]) / 2.0, (tt[0][2] + tt[1][2]) / 2.0];
    let mut pts: [Vec<([V; 3], f64, f64)>; 2] = [vec![], vec![]];
    let (mut avant, mut apres) = (0.0, 0.0);
    let (fen, pcote) = (tn(g(&cfg, "fenetre"))?, tn(g(&cfg, "parCote"))?);
    let (st, fl) = (p(table, "st")?, p(table, "fl")?);
    for sens in [-1.0, 1.0] {
        let mut k = 0.0;
        let mut j = cutn + sens;
        let mut garde = 0u32;
        while (j - cutn).abs() <= fen && j >= 0.0 && j < tn_ && k < pcote {
            garde += 1; if garde > 1_000_000 { return hd("boucle démesurée"); }
            let nul_ = |t: &V| -> R<bool> { Ok(matches!(at(t, &n(j))?, V::Nombre(x) if x == 0.0)) };
            if !nul_(st)? || !nul_(fl)? { j += sens; continue; }
            let Some(r) = row(j)? else { j += sens; continue };
            let mut d: [Option<[V; 3]>; 2] = [None, None];
            for (kk, side) in SIDES.iter().enumerate() {
                let Some(rr) = r.get(kk) else { return hd("rail") };
                let pt = tab_n(&[rr[0] - tm[0], rr[1] - tm[1], rr[2] - tm[2]]);
                if let Some(x) = d.get_mut(kk) { *x = decalage_brut(g(g(&c, "rails"), side), &pt)?; }
            }
            let [Some(dl), Some(dr)] = d else { j += sens; continue };
            pts[0].push((dl, sens, j)); pts[1].push((dr, sens, j));
            k += 1.0; if sens < 0.0 { avant += 1.0; } else { apres += 1.0; }
            j += sens;
        }
    }
    if avant + apres < 2.0 { return Ok(o(vec![("sure", b(false)), ("n", o(vec![("avant", n(avant)), ("apres", n(apres))])), ("rigideMm", ar(rigide, 1)), ("motif", s("voisins"))])); }
    let proche = |k: usize, sens: f64| -> R<Option<([V; 3], f64, f64)>> {
        let t: Vec<([V; 3], f64, f64)> = pts.get(k).map(|x| x.iter().filter(|q| q.1 == sens).cloned().collect()).unwrap_or_default();
        Ok(trier(t, |q| Ok(vec![(q.2 - cutn).abs()]), &[false])?.into_iter().next())
    };
    let (mut interp, mut ecart_cuts) = (nul(), nul());
    if avant > 0.0 && apres > 0.0 {
        let mut e = vec![];
        for (k, side) in SIDES.iter().enumerate() {
            let (Some(a), Some(bq)) = (proche(k, -1.0)?, proche(k, 1.0)?) else { return hd("voisin absent") };
            let (a, bb) = (&a.0, &bq.0);
            let (a0, b0) = (tn(&a[0])?, tn(&bb[0])?);
            let t = if (b0 - a0).abs() > 1e-6 { (0.0 - a0) / (b0 - a0) } else { 0.5 };
            let (a1, a2, b1, b2) = (tn(&a[1])?, tn(&a[2])?, tn(&bb[1])?, tn(&bb[2])?);
            e.push((*side, tab(vec![ar(a1 + t * (b1 - a1), 2), ar(a2 + t * (b2 - a2), 2)])));
        }
        interp = o(e);
        let (Some(x), Some(y)) = (proche(0, 1.0)?, proche(0, -1.0)?) else { return hd("voisin absent") };
        ecart_cuts = n(x.2 - y.2);
    }
    let ajuster = |pp: &[([V; 3], f64, f64)], cc: usize| -> R<(f64, f64)> {
        let nb = pp.len() as f64;
        let mut sx = 0.0; for q in pp { sx += tn(&q.0[0])?; } let mx = sx / nb;
        let mut sy = 0.0; for q in pp { sy += c3(&q.0, cc)?; } let my = sy / nb;
        let mut sxx = 0.0; for q in pp { sxx += crate::js::pow(tn(&q.0[0])? - mx, 2.0); }
        let bb = if sxx > 1e-6 { let mut t = 0.0; for q in pp { t += (tn(&q.0[0])? - mx) * (c3(&q.0, cc)? - my); } t / sxx } else { 0.0 };
        let a = my - bb * mx;
        let mut r = vec![]; for q in pp { r.push((c3(&q.0, cc)? - (a + bb * tn(&q.0[0])?)).abs()); }
        Ok((a, maxv(&r)))
    };
    let mut out = vec![("n", o(vec![("avant", n(avant)), ("apres", n(apres))])), ("rigideMm", ar(rigide, 1))];
    let mut res = 0.0;
    for (k, side) in SIDES.iter().enumerate() {
        let pp = pts.get(k).map_or(&[][..], Vec::as_slice);
        let (fl_, fv_) = (ajuster(pp, 1)?, ajuster(pp, 2)?);
        out.push((side, tab(vec![ar(fl_.0, 2), ar(fv_.0, 2)])));
        res = ariane_js::max(res, fl_.1);
    }
    let sure = avant >= 1.0 && apres >= 1.0 && res <= tn(g(&cfg, "residuMaxMm"))?;
    out.extend([("interp", interp), ("ecartCuts", ecart_cuts), ("residuMm", ar(res, 1)), ("sure", b(sure))]);
    Ok(o(out))
}

/// `voieGeometrique(capture, poses, cut, maxCuts)`.
fn voie_geometrique(cap: &Cap, poses: &[V], cut: &V, max_cuts: &V) -> R<V> {
    let c = cap.v()?;
    if !vrai(&c) || !vrai(g(&c, "rails")) { return Ok(nul()); }
    let mc = if matches!(max_cuts, V::Indefini) { 6.0 } else { tn(max_cuts)? };
    let cn = tn(cut)?;
    let mut pts: Vec<(f64, [[V; 3]; 2])> = vec![];
    for v in poses {
        if !vrai(v) || !vrai(g(v, "identity")) || !vrai(g(v, "positions")) { continue; }
        let vc = g(g(v, "identity"), "cut");
        if strict_egal(vc, cut)? || (tn(vc)? - cn).abs() > mc { continue; }
        let (Some(l), Some(r)) = (decalage_brut(g(g(&c, "rails"), "left"), g(g(v, "positions"), "left"))?, decalage_brut(g(g(&c, "rails"), "right"), g(g(v, "positions"), "right"))?) else { continue };
        pts.push((tn(vc)?, [l, r]));
    }
    if pts.is_empty() { return Ok(nul()); }
    let av = trier(pts.iter().filter(|q| q.0 < cn).cloned().collect(), |q| Ok(vec![q.0]), &[true])?;
    let ap = trier(pts.iter().filter(|q| q.0 > cn).cloned().collect(), |q| Ok(vec![q.0]), &[false])?;
    let lin = |a: &(f64, [[V; 3]; 2]), bq: &(f64, [[V; 3]; 2]), k: usize, i: usize| -> R<f64> {
        let (Some(da_), Some(db_)) = (a.1.get(k), bq.1.get(k)) else { return hd("rail") };
        let da = tn(&db_[0])? - tn(&da_[0])?;
        Ok(if da.abs() > 1e-6 { c3(da_, i)? + (0.0 - tn(&da_[0])?) * (c3(db_, i)? - c3(da_, i)?) / da } else { (c3(da_, i)? + c3(db_, i)?) / 2.0 })
    };
    let (a, bq, mode) = if let (Some(a), Some(bq)) = (av.first(), ap.first()) { (a.clone(), bq.clone(), "interp") } else {
        let cc = if av.is_empty() { &ap } else { &av };
        let Some(c0) = cc.first() else { return hd("c[0] absent (le JS lève)") };
        let Some(bq) = cc.get(1) else { return Ok(o(vec![("mode", s("un-seul")), ("distCuts", n((c0.0 - cn).abs()))])) };
        (c0.clone(), bq.clone(), "extrap")
    };
    let dist = ariane_js::max((a.0 - cn).abs(), if mode == "interp" { (bq.0 - cn).abs() } else { 0.0 });
    let mut out = vec![("mode", s(mode)), ("distCuts", n(dist))];
    for (k, side) in SIDES.iter().enumerate() { out.push((side, tab(vec![ar(lin(&a, &bq, k, 1)?, 2), ar(lin(&a, &bq, k, 2)?, 2)]))); }
    Ok(o(out))
}

// ---------------------------------------------------------------- décision L1-e
struct Dd { etat: V, motif: V, decal: V, corrigee: bool }
impl Dd {
    fn de(v: &V) -> Dd { Dd { etat: g(v, "etat").clone(), motif: g(v, "motif").clone(), decal: g(v, "decal").clone(), corrigee: vrai(g(v, "corrigee")) } }
    fn rien(m: &str) -> Dd { Dd { etat: s("rien"), motif: s(m), decal: nul(), corrigee: false } }
    fn valider(m: V, decal: V, corrigee: bool) -> Dd { Dd { etat: s("valider"), motif: m, decal, corrigee } }
    fn est(&self, e: &str) -> bool { est(&self.etat, e) }
    fn motif_est(&self, m: &str) -> bool { est(&self.motif, m) }
}
fn paire_d0(d0: &V) -> R<V> { let pa = p(d0, "paire")?; Ok(o(vec![("left", p(p(pa, "left")?, "decal")?.clone()), ("right", p(p(pa, "right")?, "decal")?.clone())])) }
fn zone_dans(l: &V, defaut: &[&str], zone: &V) -> R<bool> { if vrai(l) { if !est_tableau(l) { return hd("zones non tableau"); } inclut(l, zone) } else { Ok(defaut.iter().any(|d| est(zone, d))) } }
fn va_cote<'a>(va: &'a V, side: &str) -> R<&'a V> { p(va, side) }
fn va_proche_ok(va: &V, cx: &Cx) -> R<bool> {
    for side in SIDES { if !(tn(g(va_cote(va, side)?, "distProche"))? <= cx.ln("rechProcheMaxCuts")?) { return Ok(false); } }
    Ok(true)
}
fn max_ecart_voie(decal: &V, voie: &V, cle: Option<&str>) -> R<f64> {
    let mut t = vec![];
    for side in SIDES { let vs = p(voie, side)?; let r = match cle { Some(k) => p(vs, k)?.clone(), None => vs.clone() }; t.push((ixn(p(decal, side)?, 1)? - ixn(&r, 0)?).abs()); }
    Ok(maxv(&t))
}
fn decal_voie(v: &V) -> R<V> {
    let c = |side: &str| -> R<V> { let x = p(v, side)?; Ok(tab(vec![n(0.0), ix(x, 0)?, ix(x, 1)?])) };
    Ok(o(vec![("left", c("left")?), ("right", c("right")?)]))
}
/// La « branche » (rail par rail, voie géométrique) ; `None` sans paire.
fn branche(k: &V, cap: &Cap, cx: &Cx) -> R<Option<V>> {
    let gv = p(k, "voieGeo")?;
    let mut decal: Vec<(&str, V)> = vec![];
    for side in SIDES {
        let gs = p(gv, side)?;
        let mut best: Option<(f64, V)> = None;
        for h in dense(&hyps_de(k, side)?)? {
            let d = p(&h, "decal")?;
            let e = (ixn(d, 1)? - ixn(gs, 0)?).abs();
            if e <= cx.ln("brancheMm")? && (ixn(d, 2)? - ixn(gs, 1)?).abs() <= cx.ln("brancheVertMm")? && best.as_ref().is_none_or(|(be, _)| e < *be) { best = Some((e, d.clone())); }
        }
        if let Some((_, d)) = best { decal.push((side, copie_tableau(&d)?)); }
    }
    if decal.len() < 2 { return Ok(None); }
    let decal = o(decal);
    let ga = ecartement_decal(cap, &decal)?;
    let be = cx.l("brancheEcartement");
    if ga >= ixn(be, 0)? && ga <= ixn(be, 1)? && soutenue(cap, &decal)? { return Ok(Some(decal)); }
    Ok(None)
}
fn branche_permise(k: &V, cx: &Cx) -> R<bool> {
    let gv = g(k, "voieGeo");
    if !vrai(gv) { return Ok(false); }
    Ok(est(g(gv, "mode"), "interp") || (est(g(gv, "mode"), "extrap") && tn(g(gv, "distCuts"))? <= cx.ln("brancheExtrapCuts")?))
}
fn coherents(cx: &Cx) -> V { if cx.lb("voisinsCoherents") { o(vec![("parCutMm", cx.l("voisinsCoherentsParCutMm").clone()), ("baseMm", cx.l("voisinsCoherentsBaseMm").clone())]) } else { nul() } }
fn plus_proche_hyp(k: &V, side: &str, cible: &V, seuil: f64) -> R<Option<V>> {
    let mut best: Option<(f64, V)> = None;
    for h in dense(&hyps_de(k, side)?)? { let d = p(&h, "decal")?; let e = norme_moins(d, cible)?; if e <= seuil && best.as_ref().is_none_or(|(be, _)| e < *be) { best = Some((e, d.clone())); } }
    Ok(best.map(|x| x.1))
}

/// `deciderL1e(k, mod, ref, capture, probasDonnees)`.
fn decider_l1e(k: &V, m: &V, refv: &V, cap: &Cap, donnees: &V, cx: &Cx) -> R<V> {
    if cx.lb("diag") { return hd("diagnostic : reste au JS"); }
    if nullish(k) { return hd("cas nul"); }
    let ref_ok = vrai(refv) && fini(g(refv, "mm"));
    let refmm = if vrai(refv) { g(refv, "mm").clone() } else { V::Indefini };
    let capv = cap.vrai()?;
    let d0 = if cx.lfini("selectionRefMm") && ref_ok && capv { decider_l1_ref(k, m, tn(&refmm)?, cap, donnees, cx)? } else { decider_l1(k, m, &regle_defaut(), donnees)? };
    let pr = g(&d0, "probas").clone();
    let mut c = nul();
    if vrai(g(&d0, "paire")) && entier(g(&d0, "i")) && entier(g(&d0, "j")) && ref_ok {
        let (hl, hr) = (at(&hyps_de(k, "left")?, g(&d0, "i"))?, at(&hyps_de(k, "right")?, g(&d0, "j"))?);
        if nullish(&hl) || nullish(&hr) { return hd("hypothèse nulle"); }
        let decal = o(vec![("left", g(&hl, "decal").clone()), ("right", g(&hr, "decal").clone())]);
        let ga = ecartement_paire(k, &hl, &hr)?.map_or_else(nul, n);
        if nullish(&pr) { return hd("probas nulles"); }
        let pp = o(vec![("left", at(p(&pr, "left")?, g(&d0, "i"))?), ("right", at(p(&pr, "right")?, g(&d0, "j"))?)]);
        let ordre = ordre_rails(cap, &decal, &pp)?;
        c = corriger_decal(cap, &decal, &refmm, &ordre, &ga, cx.lev)?;
    }
    let cv = |kk: &str| g(&c, kk).clone();
    let mut dd = Dd::de(&l1e::decider(&d0, &c)?);
    let d0e = |e: &str| est(g(&d0, "etat"), e);
    let soutenu = |decal: &V| soutenue(cap, decal);
    let czv = cx.l("corrigeValideZones");
    if est_tableau(czv) && dd.est("valider") && dd.corrigee && d0e("valider") && vrai(g(&d0, "paire")) && capv && !inclut(czv, p(k, "zone")?)? {
        let decal0 = paire_d0(&d0)?;
        if soutenu(&decal0)? { dd = Dd::valider(nul(), decal0, false); }
    }
    if cx.lb("anomalieNonCorrigeeRien") && dd.est("valider") && vrai(&c) && vrai(&cv("anomalie")) && !vrai(&cv("soutenue")) {
        let decal0 = if vrai(g(&d0, "paire")) { paire_d0(&d0)? } else { nul() };
        let voie_ok = || -> R<bool> {
            if !cx.lfini("anomalieNonCorrigeeVoieMm") { return Ok(true); }
            let va = voie_absolue(cap, p(k, "cut")?, g(k, "voisinsAbs"), cx.l("voieAbsFenetre"), &V::Indefini, &nul())?;
            if !vrai(&va) { return Ok(false); }
            for side in SIDES {
                let vs = va_cote(&va, side)?;
                if !(tn(g(vs, "distProche"))? <= cx.ln("rechProcheMaxCuts")? && (ixn(p(&decal0, side)?, 1)? - ixn(p(vs, "proche")?, 0)?).abs() <= cx.ln("anomalieNonCorrigeeVoieMm")?) { return Ok(false); }
            }
            Ok(true)
        };
        let garde = cx.lfini("anomalieNonCorrigeePMin") && d0e("valider") && vrai(&decal0) && capv && tn(g(&d0, "p"))? >= cx.ln("anomalieNonCorrigeePMin")? && soutenu(&decal0)? && voie_ok()?;
        dd = if garde { Dd::valider(nul(), decal0, false) } else { Dd::rien("anomalie-non-corrigee") };
    }
    let sure = |x: &V| vrai(x) && vrai(g(x, "sure"));
    let (vt, vr, vl, vp) = (g(k, "voieTransport"), g(k, "voieRef"), g(k, "voieListe"), g(k, "voieProche"));
    let voie = if sure(vt) { vt.clone() } else if sure(vr) { vr.clone() } else if cx.lb("voieListe") && sure(vl) { vl.clone() }
        else if cx.lfini("voieProcheSureCuts") && vrai(vp) && tn(g(vp, "dist"))? <= cx.ln("voieProcheSureCuts")? { vp.clone() } else { nul() };
    if dd.est("rien") && d0e("poser-sans-valider") && vrai(&c) && capv {
        let decal = paire_d0(&d0)?;
        let em = cv("ecartMm");
        if cx.lfini("sousTauCoherentMm") && !vrai(&cv("anomalie")) && fini(&em) && tn(&em)?.abs() <= cx.ln("sousTauCoherentMm")? && soutenu(&decal)? { dd = Dd::valider(s("sous-tau-coherent"), decal, false); }
        else if cx.lb("sousTauCorrige") && vrai(&cv("anomalie")) && vrai(&cv("soutenue")) { dd = Dd::valider(s("sous-tau-corrige"), cv("decal"), true); }
    }
    if dd.est("rien") && cx.lb("voisins") && vrai(&voie) && capv && !dd.motif_est("anomalie-non-corrigee") {
        let base = decal_voie(&voie)?;
        let mut d: Vec<(&str, V)> = vec![];
        let mut raffines = 0;
        for side in SIDES {
            let cible = p(&base, side)?.clone();
            match plus_proche_hyp(k, side, &cible, cx.ln("voisinsRaffineMm")?)? { Some(h) => { d.push((side, copie_tableau(&h)?)); raffines += 1; } None => d.push((side, cible)) }
        }
        let decal = o(d);
        let gg = ecartement_decal(cap, &decal)?;
        let ok = (!cx.lb("raffineObligatoire") || raffines == 2) && (!ref_ok || (tn(&refmm)? - gg).abs() <= cx.ln("voisinsEcartMaxMm")?);
        if ok && soutenu(&decal)? { dd = Dd::valider(s("voie-voisins"), decal, false); }
    }
    let voie_c = if vrai(&voie) { voie.clone() } else if cx.lb("consensusVoieProche") && vrai(vp) && tn(g(vp, "dist"))? <= cx.ln("voieProcheMaxCuts")? { vp.clone() } else { nul() };
    if dd.est("rien") && cx.lb("consensus") && vrai(&voie_c) && capv && ref_ok && !dd.motif_est("anomalie-non-corrigee") {
        let rf = tn(&refmm)?;
        let mut cands = vec![];
        if vrai(g(&d0, "paire")) { cands.push(paire_d0(&d0)?); }
        if vrai(&c) && vrai(&cv("anomalie")) && vrai(&cv("soutenue")) { cands.push(cv("decal")); }
        if nullish(&pr) { return hd("probas nulles"); }
        for side in SIDES {
            let ot = autre(side);
            let hs = dense(&hyps_de(k, side)?)?;
            let pt = p(&pr, side)?;
            let i0 = p(p(k, "i0")?, side)?;
            let mut l = vec![];
            for (i, h) in hs.iter().enumerate() { if strict_egal(&n(i as f64), i0)? { continue; } l.push((h.clone(), tn(&gi(pt, i)?)?)); }
            let l = trier(l, |x| Ok(vec![x.1]), &[true])?;
            let Some((h0, _)) = l.first() else { continue };
            let vo = p(&voie_c, ot)?;
            let base = o(vec![(side, copie_tableau(p(h0, "decal")?)?), (ot, tab(vec![n(0.0), ix(vo, 0)?, ix(vo, 1)?]))]);
            let nd = ramener_rail(cap, &base, &s(ot), &refmm, 60.0)?;
            if vrai(&nd) { cands.push(nd); }
        }
        for cand in cands {
            let gg = ecartement_decal(cap, &cand)?;
            let dv = max_ecart_voie(&cand, &voie_c, None)?;
            if (rf - gg).abs() <= cx.ln("consensusEcartMm")? && dv <= cx.ln("consensusVoieMm")? && soutenu(&cand)? { dd = Dd::valider(s("consensus"), cand, false); break; }
        }
        if dd.est("rien") && cx.lb("consensusTous") {
            // paireConsensus
            let near = |side: &str| -> R<Vec<V>> { let mut t = vec![]; let vo = p(&voie_c, side)?; for h in dense(&hyps_de(k, side)?)? { if (ixn(p(&h, "decal")?, 1)? - ixn(vo, 0)?).abs() <= cx.ln("consensusVoieMm")? { t.push(h); } } Ok(t) };
            let mut cs = vec![];
            for hl in near("left")? { for hr in near("right")? {
                let decal = o(vec![("left", g(&hl, "decal").clone()), ("right", g(&hr, "decal").clone())]);
                let dg = (rf - ecartement_decal(cap, &decal)?).abs();
                if dg <= cx.ln("consensusEcartMm")? { let dv = max_ecart_voie(&decal, &voie_c, None)?; cs.push((decal, dg, dv)); }
            } }
            let cs = trier(cs, |x| Ok(vec![x.2, x.1]), &[false, false])?;
            for (decal, _, _) in cs { if soutenu(&decal)? { dd = Dd::valider(s("consensus-tous"), decal, false); break; } }
        }
    }
    if dd.est("rien") && cx.lb("branche") && !cx.lb("brancheDernier") && capv && branche_permise(k, cx)? && !dd.motif_est("anomalie-non-corrigee") {
        if let Some(decal) = branche(k, cap, cx)? { dd = Dd::valider(s("branche"), decal, false); }
    }
    let voie_v = vrai(&voie);
    let cem = || -> R<f64> { Ok(tn(&cv("ecartMm"))?.abs()) };
    if dd.est("valider") && !voie_v && cx.lb("sansVoieRien") && !dd.motif_est("branche") { dd = Dd::rien("sans-voie"); }
    if dd.est("valider") && !voie_v && d0e("valider") && cx.lfini("validerSansVoieMinP") && !(tn(g(&d0, "p"))? >= cx.ln("validerSansVoieMinP")?) { dd = Dd::rien("sans-voie-p"); }
    if dd.est("valider") && d0e("rien") && dd.corrigee && vrai(&c) && cx.lfini("anomalieMinRienMm") && !(cem()? >= cx.ln("anomalieMinRienMm")?) { dd = Dd::rien("anomalie-faible"); }
    if dd.est("valider") && d0e("rien") && dd.corrigee && vrai(&c) && !voie_v && cx.lfini("anomalieMinRienSansVoieMm") && !(cem()? >= cx.ln("anomalieMinRienSansVoieMm")?) { dd = Dd::rien("anomalie-faible-sans-voie"); }
    if dd.est("valider") && d0e("rien") && dd.corrigee && cx.lfini("corrigeVoieMaxMm") && (!voie_v || max_ecart_voie(&dd.decal, &voie, None)? > cx.ln("corrigeVoieMaxMm")?) { dd = Dd::rien("corrige-hors-voie"); }
    if dd.est("valider") && capv && (cx.lfini("soutienMinDessus") || cx.lfini("soutienMinFlanc")) {
        let mut tous = true;
        for side in SIDES {
            let m_ = soutien(cap, side, p(&dd.decal, side)?)?;
            let dessus_ok = !cx.lfini("soutienMinDessus") || m_.0 >= cx.ln("soutienMinDessus")?;
            let flanc_ok = !cx.lfini("soutienMinFlanc") || m_.1 >= cx.ln("soutienMinFlanc")?;
            if !dessus_ok || !flanc_ok { tous = false; break; }
        }
        if !tous { dd = Dd::rien("soutien-faible"); }
    }
    if dd.est("valider") && cx.lfini("vetoVoieMm") && voie_v && !dd.motif_est("voie-voisins") && !dd.motif_est("consensus") && !dd.motif_est("branche") {
        let ev = max_ecart_voie(&dd.decal, &voie, None)?;
        if ev > cx.ln("vetoVoieMm")? { dd = Dd::rien("veto-voie"); }
    }
    // Cap 5b : recherche recentrée
    let coh = coherents(cx);
    let saute = |dd: &Dd| -> R<bool> {
        if !cx.lfini("rechSauteProcheMm") || !dd.est("valider") || !vrai(&dd.decal) || !zone_dans(cx.l("rechSauteProcheZones"), &["adv"], p(k, "zone")?)? { return Ok(false); }
        let va = voie_absolue(cap, p(k, "cut")?, g(k, "voisinsAbs"), cx.l("voieAbsFenetre"), &n(3.0), &coh)?;
        if !vrai(&va) { return Ok(false); }
        for side in SIDES {
            let vs = va_cote(&va, side)?;
            let (d, pr_) = (p(&dd.decal, side)?, p(vs, "proche")?);
            if !(tn(g(vs, "distProche"))? <= cx.ln("rechSauteProcheCuts")? && hypot(&[ixn(d, 1)? - ixn(pr_, 0)?, ixn(d, 2)? - ixn(pr_, 1)?]) <= cx.ln("rechSauteProcheMm")?) { return Ok(false); }
        }
        Ok(true)
    };
    if cx.lb("rechercheADV") && capv && ref_ok && zone_dans(cx.l("rechZones"), &["adv"], p(k, "zone")?)? && !saute(&dd)? {
        let mut va = voie_absolue(cap, p(k, "cut")?, g(k, "voisinsAbs"), cx.l("voieAbsFenetre"), &n(3.0), &coh)?;
        let vlv = g(k, "voieListe");
        let par_liste = cx.lfini("rechListeResMm") && vrai(vlv) && vrai(g(vlv, "left")) && tn(g(p(vlv, "n")?, "avant"))? >= 1.0 && tn(g(p(vlv, "n")?, "apres"))? >= 1.0
            && tn(g(vlv, "residuMm"))? <= cx.ln("rechListeResMm")? && zone_dans(cx.l("rechListeZones"), &["abords"], p(k, "zone")?)?
            && !(vrai(&va) && va_proche_ok(&va, cx)?);
        if par_liste {
            let mk = |side: &str| o(vec![("v", g(vlv, side).clone()), ("proche", g(vlv, side).clone()), ("distProche", n(1.0)), ("n", g(vlv, "n").clone()), ("residuMm", g(vlv, "residuMm").clone()), ("encadre", nul()), ("liste", b(true))]);
            va = o(vec![("left", mk("left")), ("right", mk("right"))]);
        }
        let lv = |a: &V| -> R<V> { if vrai(a) { Ok(tab(vec![ix(a, 1)?, ix(a, 2)?])) } else { Ok(nul()) } };
        let gd = { let x = cx.l("rechGraineDecalMm"); if vrai(x) { x.clone() } else { n(0.0) } };
        let gd0 = if vrai(g(&d0, "paire")) { let pa = p(&d0, "paire")?; o(vec![("left", lv(p(p(pa, "left")?, "decal")?)?), ("right", lv(p(p(pa, "right")?, "decal")?)?)]) } else { nul() };
        let gdd = if vrai(&dd.decal) { o(vec![("left", lv(p(&dd.decal, "left")?)?), ("right", lv(p(&dd.decal, "right")?)?)]) } else { nul() };
        let (gpr, gva) = if vrai(&va) {
            (o(vec![("left", p(va_cote(&va, "left")?, "proche")?.clone()), ("right", p(va_cote(&va, "right")?, "proche")?.clone())]),
             o(vec![("left", p(va_cote(&va, "left")?, "v")?.clone()), ("right", p(va_cote(&va, "right")?, "v")?.clone())]))
        } else { (nul(), nul()) };
        let gh0 = o(vec![("left", tab_n(&[0.0, 0.0])), ("right", tab_n(&[0.0, 0.0]))]);
        let gtab = |nom: &str| -> Option<&V> { match nom { "d0" => Some(&gd0), "dd" => Some(&gdd), "proche" => Some(&gpr), "va" => Some(&gva), "h0" => Some(&gh0), _ => None } };
        let ordre = { let x = cx.l("rechOrdreGraines"); if vrai(x) { dense(x)? } else { ["d0", "dd", "proche", "va", "h0"].iter().map(|x| s(x)).collect() } };
        let mut gr = vec![];
        for nm in ordre {
            let gg = match &nm { V::Chaine(c_) => gtab(c_), V::Nombre(_) | V::Booleen(_) | V::Nul | V::Indefini => None, _ => return hd("nom de graine objet") };
            let Some(gg) = gg else { continue };
            if !vrai(gg) { continue; }
            let cote_g = |side: &str| -> R<V> { let x = p(gg, side)?; Ok(tab(vec![n(plus(&ix(x, 0)?, &gd)?), ix(x, 1)?])) };
            gr.push(o(vec![("nom", nm.clone()), ("left", cote_g("left")?), ("right", cote_g("right")?)]));
        }
        let fd = o(vec![("minTop", cx.l("rechMinTop").clone()), ("minFace", cx.l("rechMinFace").clone()), ("ratioMax", cx.l("rechRatioMax").clone())]);
        let ratio_contra = if cx.lfini("rechContraRatioMax") { cx.l("rechContraRatioMax").clone() } else { g(&fd, "ratioMax").clone() };
        let filtre_rech = if tn(&ratio_contra)? > tn(g(&fd, "ratioMax"))? { etale(&fd, vec![("ratioMax", ratio_contra.clone())])? } else { fd.clone() };
        let (min_top, min_face, ratio_max, rc) = (tn(g(&fd, "minTop"))?, tn(g(&fd, "minFace"))?, tn(g(&fd, "ratioMax"))?, tn(&ratio_contra)?);
        let garde = |pq: &Paire| -> R<bool> { Ok(pq.top >= min_top && pq.face >= min_face && pq.ratio <= ratio_max && (!cx.lfini("rechPaireTopMin") || pq.top >= cx.ln("rechPaireTopMin")?)) };
        let h_ok = |pq: &Paire| -> R<bool> {
            if !cx.lfini("rechHauteurMaxMm") { return Ok(true); }
            for side in SIDES { let d = p(&pq.decal, side)?; let z = ixn(d, 2)?; let pz = ixn(p(va_cote(&va, side)?, "proche")?, 1)?;
                if !(ariane_js::min((z - pz).abs(), z.abs()) <= cx.ln("rechHauteurMaxMm")?) { return Ok(false); } }
            Ok(true)
        };
        let admis = |ps: &[Paire]| -> R<Vec<Paire>> {
            if !vrai(&va) { return Ok(vec![]); }
            let mut out = vec![];
            for pq in ps {
                if !garde(pq)? || !(tn(&pq.dg)?.abs() <= cx.ln("rechEcartMm")?) || !(tn(&pq.depl)? <= cx.ln("rechMaxDeplMm")?) { continue; }
                let Some(dv) = pq.dv else { continue };
                if !(dv <= cx.ln("rechVoieMaxMm")?) { continue; }
                if cx.lfini("rechVoieParCutMm") && !(dv <= cx.ln("rechVoieParCutMm")? * maxv(&[1.0, tn(g(va_cote(&va, "left")?, "distProche"))?, tn(g(va_cote(&va, "right")?, "distProche"))?])) { continue; }
                if par_liste && !(dv <= cx.ln("rechListeVoieMm")?) { continue; }
                if !h_ok(pq)? { continue; }
                out.push(pq.clone());
            }
            Ok(out)
        };
        let proche_ok = vrai(&va) && tn(g(va_cote(&va, "left")?, "distProche"))? <= cx.ln("rechProcheMaxCuts")? && tn(g(va_cote(&va, "right")?, "distProche"))? <= cx.ln("rechProcheMaxCuts")?
            && (!cx.lfini("rechVoisinsMin") || { let mut t = true; for side in SIDES { let nn = p(va_cote(&va, side)?, "n")?; if !(plus(g(nn, "avant"), g(nn, "apres"))? >= cx.ln("rechVoisinsMin")?) { t = false; break; } } t });
        let ecart = |a: &V, c_: &V| -> R<f64> { let mut t = vec![]; for side in SIDES { t.push(norme_moins(p(a, side)?, p(c_, side)?)?); } Ok(maxv(&t)) };
        let choisir = |ps: &[Paire]| -> R<(Vec<Paire>, Option<usize>, bool)> {
            let adm = admis(ps)?;
            let best = if proche_ok && !adm.is_empty() { Some(0) } else { None };
            let mut ambigu = false;
            if let Some(bi) = best { if let Some(bp) = adm.get(bi) { for (i, pq) in adm.iter().enumerate() { if i != bi && ecart(&pq.decal, &bp.decal)? > cx.ln("rechUniqueMm")? { ambigu = true; break; } } } }
            Ok((adm, best, ambigu))
        };
        let assez_f = |ps: &[Paire]| -> R<bool> { let (_, b_, a_) = choisir(ps)?; Ok(b_.is_some() && !a_) };
        let assez: Option<&dyn Fn(&[Paire]) -> R<bool>> = if cx.lb("rechArret") { Some(&assez_f) } else { None };
        let em = ariane_js::max(cx.ln("rechEcartMm")?, 15.0);
        let rech = paires_recentrees(cap, &tab(gr), &refmm, &va, &n(em), &filtre_rech, cx.l("rechDedupMm"), assez, cx)?;
        let (adm, best, ambigu) = choisir(&rech.paires)?;
        let best = best.and_then(|i| adm.get(i)).cloned();
        if dd.est("rien") && !ambigu { if let Some(bp) = &best { dd = Dd::valider(s("recherche-adv"), bp.decal.clone(), false); } }
        else if dd.est("valider") {
            let mut contra = false;
            if cx.lfini("rechContraMinMm") {
                for (ks, side) in SIDES.iter().enumerate() {
                    let cel = rech.cellules.get(ks).map_or(&[][..], Vec::as_slice);
                    let mut ms = vec![];
                    for x in cel {
                        let mut dans = false; for gn in &x.graines { if est(gn, "dd") { dans = true; break; } }
                        if dans && tn(&x.top)? >= min_top && tn(&x.face)? >= min_face && tn(&x.ratio)? <= rc {
                            let d = p(&dd.decal, side)?;
                            ms.push(hypot(&[ixn(&x.mm, 1)? - ixn(d, 1)?, ixn(&x.mm, 2)? - ixn(d, 2)?]));
                        }
                    }
                    if ms.is_empty() { continue; }
                    let mi = minv(&ms);
                    if mi > cx.ln("rechContraMinMm")? && mi <= cx.ln("rechContraMaxMm")? { contra = true; break; }
                }
            }
            if contra && best.is_some() && !ambigu { if let Some(bp) = &best { dd = Dd::valider(s("recherche-adv-contredite"), bp.decal.clone(), false); } }
            else if contra && cx.lb("rechContraRien") { dd = Dd::rien("recherche-adv-contredite-rien"); }
            else if cx.lb("rechRemplace") && best.is_some() && !ambigu && { let bp = best.as_ref().map_or(V::Nul, |x| x.decal.clone()); ecart(&bp, &dd.decal)? > cx.ln("rechRemplaceMm")? } {
                if let Some(bp) = &best { dd = Dd::valider(s("recherche-adv-remplace"), bp.decal.clone(), false); }
            }
            else if cx.lb("rechSansPaireRien") && (best.is_none() || ambigu) { dd = Dd::rien("recherche-adv-sans-paire"); }
        }
        if dd.est("rien") && cx.lb("rechEncadre") && vrai(&va) && {
            let mut t = true;
            for side in SIDES { let e = g(va_cote(&va, side)?, "encadre");
                if !(vrai(e) && { let cu = dense(p(e, "cuts")?)?; let x: Vec<f64> = cu.iter().map(tn).collect::<R<_>>()?; maxv(&x) <= cx.ln("rechEncadreMaxCuts")? } && tn(g(e, "saut"))? <= cx.ln("rechEncadreSautMm")?) { t = false; break; } }
            t
        } {
            let mut decal = vec![];
            let mut contredit = false;
            for (ks, side) in SIDES.iter().enumerate() {
                let v = p(p(va_cote(&va, side)?, "encadre")?, "v")?.clone();
                let mut bb: Option<(f64, &CelR)> = None;
                for x in rech.cellules.get(ks).map_or(&[][..], Vec::as_slice) {
                    if tn(&x.top)? >= min_top && tn(&x.face)? >= min_face && tn(&x.ratio)? <= rc {
                        let e = hypot(&[ixn(&x.mm, 1)? - ixn(&v, 0)?, ixn(&x.mm, 2)? - ixn(&v, 1)?]);
                        if bb.is_none_or(|(be, _)| e < be) { bb = Some((e, x)); }
                    }
                }
                if let Some((e, _)) = bb { if e > 5.0 && e <= cx.ln("rechContraMaxMm")? { contredit = true; } }
                decal.push((*side, match bb { Some((e, x)) if e <= 5.0 => { let mut t = vec![]; for z in dense(&x.mm)? { t.push(arv(&n(tn(&z)?), 2)); } tab(t) } _ => tab(vec![n(0.0), ix(&v, 0)?, ix(&v, 1)?]) }));
            }
            let decal = o(decal);
            let sout = !contredit && soutenu(&decal)?;
            if sout && (tn(&refmm)? - ecartement_decal(cap, &decal)?).abs() <= cx.ln("rechEncadreEcartMm")? { dd = Dd::valider(s("recherche-adv-encadre"), decal, false); }
        }
    }
    if dd.est("rien") && cx.lb("branche") && cx.lb("brancheDernier") && capv && branche_permise(k, cx)? && !dd.motif_est("anomalie-non-corrigee") && !dd.motif_est("recherche-adv-contredite-rien") {
        if let Some(decal) = branche(k, cap, cx)? { dd = Dd::valider(s("branche"), decal, false); }
    }
    if dd.est("valider") && vrai(&dd.decal) && capv && (cx.lfini("vetoVoieAbsMm") || cx.lfini("voieIncoherenteMm")) {
        let va = voie_absolue(cap, p(k, "cut")?, g(k, "voisinsAbs"), cx.l("voieAbsFenetre"), &n(3.0), &coh)?;
        if vrai(&va) && va_proche_ok(&va, cx)? {
            let ev = max_ecart_voie(&dd.decal, &va, Some("v"))?;
            if cx.lfini("vetoVoieAbsMm") && ev > cx.ln("vetoVoieAbsMm")? { dd = Dd::rien("veto-voie-absolue"); }
            else if cx.lfini("voieIncoherenteMm") && {
                let mut t = vec![]; for side in SIDES { let r = g(va_cote(&va, side)?, "residuMm"); t.push(if nullish(r) { 0.0 } else { tn(r)? }); } maxv(&t) > cx.ln("voieIncoherenteMm")?
            } { dd = Dd::rien("voie-incoherente"); }
        }
    }
    let correction = if vrai(&c) { o(vec![("ref", refmm.clone()), ("ecartMm", cv("ecartMm")), ("anomalie", cv("anomalie")), ("rail", cv("rail")), ("soutenue", cv("soutenue")), ("appliquee", b(dd.corrigee))]) }
        else { o(vec![("ref", if ref_ok { refmm.clone() } else { nul() }), ("appliquee", b(false))]) };
    let base0 = if vrai(g(&d0, "paire")) { g(&d0, "paire").clone() } else {
        let h6 = || o(vec![("origines", tab(vec![s("H6")])), ("sousOrigines", V::Tableau(vec![])), ("hauteur", b(false))]);
        o(vec![("left", h6()), ("right", h6())])
    };
    let paire = if vrai(&dd.decal) { par_cote(|side| etale(g(&base0, side), vec![("decal", gk(&dd.decal, &s(side))?)]))? } else { nul() };
    let ecart_dep = if vrai(&paire) { ar(ariane_js::max(norme_v(p(p(&paire, "left")?, "decal")?)?, norme_v(p(p(&paire, "right")?, "decal")?)?), 1) } else { g(&d0, "ecartDepartMm").clone() };
    let t13 = o(vec![("etat", g(&d0, "etat").clone()), ("motif", ou_nul(g(&d0, "motif"))), ("paire", if vrai(g(&d0, "paire")) { paire_d0(&d0)? } else { nul() })]);
    etale(&d0, vec![("variante", s("L1-e")), ("etat", dd.etat), ("motif", dd.motif), ("paire", paire), ("ecartDepartMm", ecart_dep), ("correction", correction), ("test13", t13)])
}

// ---------------------------------------------------------------- un différé, de bout en bout
fn positions_de(cap: &Cap, paire: &V) -> R<V> {
    let c = cap.v()?;
    par_cote(|side| positions_mm(rail_de(&c, side)?, p(p(paire, side)?, "decal")?))
}
fn corriger_pose_chaine(cap: &Cap, decal: &V, refv: &V, cx: &Cx) -> R<V> {
    if !vrai(refv) || !fini(g(refv, "mm")) { return Ok(o(vec![("decal", decal.clone()), ("correction", o(vec![("ref", nul()), ("appliquee", b(false))]))])); }
    let rm = g(refv, "mm").clone();
    let ordre = ordre_rails(cap, decal, &nul())?;
    let c = corriger_decal(cap, decal, &rm, &ordre, &nul(), cx.lev)?;
    let ok = vrai(g(&c, "anomalie")) && vrai(g(&c, "soutenue"));
    Ok(o(vec![("decal", if ok { g(&c, "decal").clone() } else { decal.clone() }), ("correction", o(vec![("ref", rm), ("ecartMm", g(&c, "ecartMm").clone()), ("anomalie", g(&c, "anomalie").clone()),
        ("rail", g(&c, "rail").clone()), ("soutenue", g(&c, "soutenue").clone()), ("appliquee", b(ok))]))]))
}
fn ecart_a_voie(cap: &Cap, cut: &V, voisins: &V, decal: &V, cx: &Cx) -> R<V> {
    let va = voie_absolue(cap, cut, voisins, cx.l("voieAbsFenetre"), &n(3.0), &coherents(cx))?;
    if !vrai(&va) || !va_proche_ok(&va, cx)? { return Ok(nul()); }
    Ok(o(vec![("proche", n(max_ecart_voie(decal, &va, Some("proche"))?)), ("droite", n(max_ecart_voie(decal, &va, Some("v"))?))]))
}
fn contre_chaine(gv: &V, decal_chaine: &V, seuil: &V) -> R<bool> {
    let d = if vrai(gv) { g(gv, "decision").clone() } else { gv.clone() };
    let Some(sm) = fin_de(seuil) else { return Ok(false) };
    if !vrai(&d) || !est(g(&d, "etat"), "valider") || !vrai(g(&d, "paire")) { return Ok(false); }
    for side in SIDES { if norme_moins(p(p(g(&d, "paire"), side)?, "decal")?, p(decal_chaine, side)?)? > sm { return Ok(true); } }
    Ok(false)
}
fn voisin_lot(v: &V) -> R<V> {
    let id = g(v, "identity");
    let pz = g(v, "positions");
    Ok(o(vec![("identity", o(vec![("part", g(id, "part").clone()), ("cut", g(id, "cut").clone()), ("frameId", ou_nul(g(id, "frameId")))])),
        ("positions", o(vec![("left", copie_tableau(p(pz, "left")?)?), ("right", copie_tableau(p(pz, "right")?)?)])), ("stage", s("verifie")), ("source", s("lot")),
        ("decalage", decalage_depuis_depart(g(v, "rails"), pz)?)]))
}
fn arrondis2(v: &V) -> R<V> { let mut t = vec![]; for x in dense(v)? { t.push(arv(&x, 2)); } Ok(tab(t)) }
/// `deciderDiffere({...})`.
fn decider_differe(arg: &V, cx: &Cx) -> R<V> {
    if nullish(arg) { return hd("déstructuration de null"); }
    let d_ = |k: &str, d: V| -> V { let x = g(arg, k); if matches!(x, V::Indefini) { d } else { x.clone() } };
    let regle_d = regle_defaut();
    let (science, appuis, options, voisins, zone, plages, modele, regle, reference, vt, voie_liste) = (g(arg, "science").clone(), d_("appuis", V::Tableau(vec![])),
        d_("options", g(&regle_d, "lotOptions").clone()), d_("voisins", V::Tableau(vec![])), d_("zone", s("abords")), d_("plagesADV", V::Tableau(vec![])), g(arg, "modele").clone(),
        d_("regle", regle_d.clone()), d_("reference", nul()), d_("voisinsTransport", nul()), d_("voieListe", nul()));
    if !vrai(&modele) { return Err(Echec::erreur("GCV2 L1 : modèle absent.")); }
    for side in SIDES { if !(vrai(&science) && vrai(g(&science, "rails")) && vrai(g(g(&science, "rails"), side))) { return Err(Echec::erreur("GCV2 L1 : science incomplète.")); } }
    let cap = Cap::new(g(arg, "capture").clone());
    let id = { let c = cap.v()?; p(&c, "identity")?.clone() };
    if !est_tableau(&appuis) { return hd("appuis non tableau"); }
    let seul = variante(&cap, &science, &V::Tableau(vec![]), &options, cx)?;
    let chaine = variante(&cap, &science, &appuis, &options, cx)?;
    let mut vs = vec![];
    for v in dense(&voisins)? { if vrai(&v) && vrai(g(&v, "identity")) && vrai(g(&v, "positions")) && vrai(g(&v, "rails")) { vs.push(voisin_lot(&v)?); } }
    let mut gs = vec![];
    for v in &vs { let pz = g(v, "positions"); let x = gauge_mm(g(pz, "left"), g(pz, "right"))?; if x.is_finite() && (x - 1500.0).abs() > 0.05 { gs.push(n(x)); } }
    let g_med = med(&gs)?;
    let vs_v = tab(vs.clone());
    let seul_v = o(vec![("decision", seul.decision.clone()), ("v", seul.v.clone())]);
    let chaine_v = o(vec![("decision", chaine.decision.clone()), ("v", chaine.v.clone())]);
    let hyp = hypotheses_du_cut(&cap, &ArgsHyp { science: &science, seul: &seul_v, chaine: &chaine_v, appuis_avant: &appuis, voisins: &vs_v, g_med: &g_med, voisins_lot: &vs_v, depart_esv: &nul() }, cx)?;
    let vh6 = g(&hyp, "voieH6");
    let ancres = { let l = if vrai(vh6) { g(vh6, "lot") } else { vh6 }; let a = if vrai(l) { g(l, "ancres") } else { l }; liste_ou_vide(a)? };
    let cut = g(&id, "cut").clone();
    let mut bornes = vec![tn(&cut)?];
    for a in &ancres { if nullish(a) { return hd("ancre nulle"); } bornes.push(tn(g(a, "cut"))?); }
    let (bmin, bmax) = (minv(&bornes), maxv(&bornes));
    if bmax - bmin > 1e6 { return hd("plage démesurée"); }
    let mut zmap = std::collections::HashMap::new();
    let pl = liste_ou_vide(&plages)?;
    let mut x = bmin;
    while x <= bmax {
        let mut adv = false;
        for pg in &pl { if !est_tableau(pg) { return hd("plage non tableau"); } if x >= tn(&elem(pg, 0))? && x <= tn(&elem(pg, 1))? { adv = true; break; } }
        zmap.insert(ariane_js::cle_same_value_zero(x), adv);
        x += 1.0;
    }
    let voie_ref = if vrai(vh6) { avec_rupture(g(vh6, "lot"), &cut, &zmap)? } else { nul() };
    let mut k = cas_du_differe(&cut, &zone, &hyp, &g_med, &voie_ref)?;
    if vrai(&voie_liste) { mettre(&mut k, "voieListe", voie_liste)?; }
    let vt_l = if est_tableau(&vt) { dense(&vt)? } else { vec![] };
    let mut poses = dense(&voisins)?;
    poses.extend(vt_l.iter().cloned());
    mettre(&mut k, "voieGeo", voie_geometrique(&cap, &poses, &cut, cx.l("brancheMaxCuts"))?)?;
    let mut abs_ = vs.clone();
    for v in &vt_l { if vrai(v) && vrai(g(v, "identity")) && vrai(g(v, "positions")) { abs_.push(v.clone()); } }
    mettre(&mut k, "voisinsAbs", tab(abs_))?;
    let proche_de = |r: &V| -> R<V> { let pr = g(r, "proche"); Ok(o(vec![("left", arrondis2(p(pr, "left")?)?), ("right", arrondis2(p(pr, "right")?)?), ("dist", g(pr, "dist").clone())])) };
    if !vt_l.is_empty() {
        let mut v2 = vs.clone();
        for v in &vt_l { if vrai(v) && vrai(g(v, "identity")) && vrai(g(v, "positions")) && vrai(g(v, "rails")) { v2.push(voisin_lot(v)?); } }
        let r = decalages_h6(&id, &tab(v2))?;
        if vrai(&r) && vrai(g(&r, "reference")) {
            let rf = g(&r, "reference");
            let motifs = g(rf, "motifs").clone();
            let sure = longueur(&motifs).unwrap_or(0) == 0;
            mettre(&mut k, "voieTransport", o(vec![("left", arrondis2(g(rf, "left"))?), ("right", arrondis2(g(rf, "right"))?), ("n", g(rf, "n").clone()), ("distMin", g(rf, "distMin").clone()),
                ("motifs", motifs), ("sure", b(sure))]))?;
        }
        if vrai(&r) && vrai(g(&r, "proche")) { mettre(&mut k, "voieProche", proche_de(&r)?)?; }
    }
    if !vrai(g(&k, "voieProche")) && cx.lfini("voieProcheSureCuts") && !vs.is_empty() {
        let r = decalages_h6(&id, &vs_v)?;
        if vrai(&r) && vrai(g(&r, "proche")) { mettre(&mut k, "voieProche", proche_de(&r)?)?; }
    }
    let d = if est(g(&regle, "variante"), "L1-e") { decider_l1e(&k, &modele, &reference, &cap, &nul(), cx)? } else { decider_l1(&k, &modele, &regle, &nul())? };
    let positions = if vrai(g(&d, "paire")) && !est(g(&d, "etat"), "rien") { positions_de(&cap, g(&d, "paire"))? } else { nul() };
    let au = g(&chaine.decision, "anchorsUsed");
    let ch = o(vec![("stage", g(&chaine.decision, "stage").clone()), ("reason", ou_nul(g(&chaine.decision, "reason"))), ("anchorsUsed", if vrai(au) { au.clone() } else { V::Tableau(vec![]) })]);
    Ok(o(vec![("decision", d), ("positions", positions), ("gMed", g_med), ("cas", k), ("hyp", hyp), ("chaine", ch)]))
}
/// `resumer(r)`.
fn resumer(r: &V) -> R<V> {
    let d = p(r, "decision")?;
    if nullish(d) { return hd("décision nulle"); }
    let pa = g(d, "paire");
    let paire = if vrai(pa) { o(vec![("left", p(p(pa, "left")?, "decal")?.clone()), ("right", p(p(pa, "right")?, "decal")?.clone())]) } else { nul() };
    let ch = g(r, "chaine");
    let chaine = if vrai(ch) {
        let rs = g(ch, "reason");
        let au = p(ch, "anchorsUsed")?;
        if nullish(au) { return hd("anchorsUsed nul"); }
        o(vec![("stage", g(ch, "stage").clone()), ("reason", if nullish(rs) { nul() } else { s(&texte_k(rs, 80)?) }), ("appuis", longueur_js(au))])
    } else { nul() };
    let hy = g(r, "hyp");
    let nhyp = if vrai(hy) { p(p(hy, "cut")?, "nHyp")?.clone() } else { nul() };
    let mut out = vec![];
    let mut t = |k: &str, v: V| definir(&mut out, k, v);
    t("version", s(VERSION)); t("etat", g(d, "etat").clone()); t("motif", ou_nul(g(d, "motif"))); t("zone", g(d, "zone").clone()); t("tau", g(d, "tau").clone());
    t("delta", g(d, "delta").clone()); t("p", g(d, "p").clone()); t("hypothese", ou_nul(g(d, "hypothese"))); t("ecartDepartMm", g(d, "ecartDepartMm").clone());
    t("ecartMaxLatVertMm", ou_nul(g(d, "ecartMaxLatVertMm"))); t("paires", ou_nul(g(d, "permises"))); t("paire", paire);
    t("aControler", if matches!(g(d, "aControler"), V::Booleen(true)) { b(true) } else { V::Indefini }); t("gMedMm", arv(g(r, "gMed"), 1)); t("chaine", chaine); t("nHyp", nhyp);
    if est(g(d, "variante"), "L1-e") {
        t("variante", s("L1-e")); t("correction", g(d, "correction").clone()); t("test13", g(d, "test13").clone());
        if vrai(g(d, "diag")) { t("diag", g(d, "diag").clone()); }
    }
    Ok(V::Objet(out))
}

// ---------------------------------------------------------------- aiguillage
fn arg_obj<'a>(a: &'a Appel, i: usize) -> R<&'a V> { let x = a.arg(i); if nullish(x) { hd("déstructuration de null/undefined") } else { Ok(x) } }
fn defaut<'a>(v: &'a V, d: &'a V) -> &'a V { if matches!(v, V::Indefini) { d } else { v } }
fn probas_args(pr: &V) -> R<[Vec<f64>; 2]> {
    let mut out: [Vec<f64>; 2] = [vec![], vec![]];
    for (k, side) in SIDES.iter().enumerate() {
        let t = p(pr, side)?;
        if nullish(t) { return hd("probas nulles"); }
        let mut x = vec![];
        if est_tableau(t) { for e in crate::j4::iter_vals(t) { x.push(tn(&e)?); } } else if !est_simple(t) { return hd("probas non tableau"); } else { return hd("probas objet"); }
        if let Some(o_) = out.get_mut(k) { *o_ = x; }
    }
    Ok(out)
}

/// Aiguillage `{f, a, etat, globaux, leviers}` du module (numéro `GCV2_L1`) : état du moteur GCV1 et réglages globaux comme
/// `decideCut`, leviers en vigueur (`leviersActifs()`) résolus par la façade.
///
/// # Errors
/// `Js` ou `HorsDomaine`, comme les fonctions portées.
pub fn appeler(a: &Appel, entree: &V) -> R<V> {
    let (et, gl) = lot::etat_globaux(entree)?;
    let lev = g(entree, "leviers");
    if !est_simple(lev) { return hd("leviers absents"); }
    let cx = Cx { et: &et, gl: &gl, lev };
    let cap = |i: usize| Cap::new(a.arg(i).clone());
    let regle = regle_defaut();
    match a.f.as_str() {
        "decalage" => decalage_v(a.arg(0), a.arg(1)),
        "variante" => variante_v(&cap(0), a.arg(1), a.arg(2), a.arg(3), &cx),
        "decalageDepuisDepart" => decalage_depuis_depart(a.arg(0), a.arg(1)),
        "decalagesH6" => decalages_h6(a.arg(0), a.arg(1)),
        "hypothesesDuCut" => {
            let e = arg_obj(a, 0)?;
            let vide = V::Tableau(vec![]);
            let (ch, ap, vo, gm, vl, de) = (defaut(g(e, "chaine"), &V::Nul), defaut(g(e, "appuisAvant"), &vide), defaut(g(e, "voisins"), &vide), defaut(g(e, "gMed"), &V::Nul),
                defaut(g(e, "voisinsLot"), &V::Nul), defaut(g(e, "departEsv"), &V::Nul));
            if !est_tableau(vo) { return hd("voisins non tableau"); }
            let c = Cap::new(g(e, "capture").clone());
            hypotheses_du_cut(&c, &ArgsHyp { science: g(e, "science"), seul: g(e, "seul"), chaine: ch, appuis_avant: ap, voisins: vo, g_med: gm, voisins_lot: vl, depart_esv: de }, &cx)
        }
        "transfo" => Ok(transfo_v(a.arg(0), a.arg(1))),
        "accords" => Ok(tab(accords(&dense(a.arg(0))?)?)),
        "brut" => brut(a.arg(0), a.arg(1), a.arg(2), a.arg(3)),
        "coder" => { if a.nb() > 2 && !(matches!(a.arg(2), V::Indefini) && matches!(a.arg(3), V::Indefini)) { return hd("coder avec out : reste au JS"); } Ok(tab_n(&coder(a.arg(0), a.arg(1))?)) }
        "soutienRail" => Ok(soutien_v(soutien(&cap(0), cote(a.arg(1))?, a.arg(2))?)),
        "modeleFige" => modele_fige(a.arg(0), a.arg(1)),
        "probas" => { let (p10, p5) = probas(a.arg(0), a.arg(1))?; Ok(o(vec![("p10", n(p10)), ("p5", n(p5))])) }
        "casDuDiffere" => { let e = arg_obj(a, 0)?; cas_du_differe(g(e, "cut"), g(e, "zone"), g(e, "hyp"), g(e, "gMed"), g(e, "voieRef")) }
        "ecartementPaire" => { let (hl, hr) = (a.arg(1), a.arg(2)); if nullish(hl) || nullish(hr) || nullish(a.arg(0)) { return hd("null"); } Ok(ecartement_paire(a.arg(0), hl, hr)?.map_or_else(nul, n)) }
        "meilleurePaire" => {
            if nullish(a.arg(1)) || nullish(a.arg(0)) { return hd("null"); }
            let b_ = meilleure_paire(a.arg(0), &probas_args(a.arg(1))?, defaut(a.arg(2), &regle))?;
            Ok(o(vec![("i", b_.i), ("j", b_.j), ("v", n(b_.v)), ("ecart", n(b_.ecart)), ("h0", b(b_.h0)), ("permises", n(b_.permises))]))
        }
        "deciderL1" => decider_l1(a.arg(0), a.arg(1), defaut(a.arg(2), &regle), defaut(a.arg(3), &V::Nul)),
        "deciderL1e" => decider_l1e(a.arg(0), a.arg(1), a.arg(2), &cap(3), defaut(a.arg(4), &V::Nul), &cx),
        "positionsDe" => { if nullish(a.arg(1)) { return hd("null"); } positions_de(&cap(0), a.arg(1)) }
        "ecartementDecal" => Ok(n(ecartement_decal(&cap(0), a.arg(1))?)),
        "ramenerRail" => { let mx = if matches!(a.arg(4), V::Indefini) { 60.0 } else { tn(a.arg(4))? }; ramener_rail(&cap(0), a.arg(1), a.arg(2), a.arg(3), mx) }
        "corrigerDecal" => {
            let e = arg_obj(a, 0)?;
            let c = Cap::new(g(e, "capture").clone());
            corriger_decal(&c, g(e, "decal"), g(e, "ref"), g(e, "ordre"), defaut(g(e, "gApprox"), &V::Nul), defaut(g(e, "leviers"), lev))
        }
        "ordreRails" => ordre_rails(&cap(0), a.arg(1), defaut(a.arg(2), &V::Nul)),
        "corrigerPoseChaine" => corriger_pose_chaine(&cap(0), a.arg(1), a.arg(2), &cx),
        "ecartAVoie" => ecart_a_voie(&cap(0), a.arg(1), a.arg(2), a.arg(3), &cx),
        "contreChaine" => Ok(b(contre_chaine(a.arg(0), a.arg(1), a.arg(2))?)),
        "voieDeListe" => voie_de_liste(a.arg(0), a.arg(1), &cap(2), a.arg(3)),
        "voieGeometrique" => { let pz = liste_ou_vide(a.arg(1))?; voie_geometrique(&cap(0), &pz, a.arg(2), a.arg(3)) }
        "deciderDiffere" => decider_differe(a.arg(0), &cx),
        "resumer" => resumer(a.arg(0)),
        "voieAbsolue" => voie_absolue(&cap(0), a.arg(1), a.arg(2), a.arg(3), a.arg(4), defaut(a.arg(5), &V::Nul)),
        "rechercheRecentree" => { let ff = filtre_fort(); recherche_recentree(&cap(0), a.arg(1), defaut(a.arg(2), &ff), &cx) }
        "pairesRecentrees" => {
            let opts = defaut(a.arg(5), &V::Indefini);
            if matches!(opts, V::Nul) { return hd("options null"); }
            if !nullish(g(opts, "assez")) { return hd("assez : reste au JS"); }
            let ff = filtre_fort();
            let r = paires_recentrees(&cap(0), a.arg(1), a.arg(2), a.arg(3), a.arg(4), defaut(g(opts, "filtre"), &ff), g(opts, "dedupMm"), None, &cx)?;
            Ok(recherche_v(&r))
        }
        _ => hd("gcv2-l1 : fonction non portée"),
    }
}
