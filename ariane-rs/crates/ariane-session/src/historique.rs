//! `src/historique-parties.js`, partie pure : `finDe`, `ficheFin`, `ajouterFin`, `historique` (`lireFins` et
//! `noterFin` lisent et écrivent le stockage : restent en JS). Dates : `js_extra::date` ; tri : `localeCompare` sur
//! la locale de l'opérateur, passée par la façade.
use crate::js_extra::{self as js, ch, chemin, est, hd, s, tab, Carte, Locale, Obj};
use ariane_js::Echec;
use ariane_vba::Valeur;

const MAX_FINS: usize = 200;
const FIN_PARTIE: f64 = 999_999.0;
const CLOS: [&str; 3] = ["STOPPED", "COMPLETED", "FINISHED_WITH_UNCONFIRMED_ACTIONS"];

/// `entier(v)` : entier de 0 à 1e8 exclu, sinon null.
fn entier(v: &Valeur) -> Valeur { js::entier(v).filter(|x| *x >= 0.0 && *x < 1e8).map_or(Valeur::Nul, Valeur::Nombre) }
/// `texte(v, n)`.
fn texte(v: &Valeur, n: usize) -> Result<Valeur, Echec> {
    match v { Valeur::Chaine(c) if !c.is_empty() => Ok(s(&js::tranche_utf16(c, n)?)), _ => Ok(Valeur::Nul) }
}
/// `iso(v)` : la chaîne si `Date.parse` la lit, sinon null.
fn iso(v: &Valeur) -> Result<Valeur, Echec> {
    match v { Valeur::Chaine(c) => Ok(if js::date::parse(c)?.is_finite() { v.clone() } else { Valeur::Nul }), _ => Ok(Valeur::Nul) }
}
/// `a || b`.
fn ou(a: Valeur, b: impl FnOnce() -> Result<Valeur, Echec>) -> Result<Valeur, Echec> { if a.vrai() { Ok(a) } else { b() } }
/// `distincts(l)` : nombre de cuts entiers distincts (trous sautés par `map` puis `filter`).
fn distincts(l: &Valeur) -> f64 {
    if !js::est_tableau(l) { return 0.0; }
    let mut vus = std::collections::HashSet::new();
    let elements: Vec<Valeur> = match l { Valeur::Tableau(t) => t.iter().flatten().cloned().collect(), _ => js::elements(l).unwrap_or_default().into_owned() };
    for x in &elements {
        let c = ch(x, "cut");
        let c = if js::nul(c) { chemin(x, &["identity", "cut"]) } else { c };
        if let Some(n) = js::entier(c) { vus.insert(ariane_js::cle_same_value_zero(n)); }
    }
    vus.len() as f64
}
/// `comptes(b)`.
fn comptes(b: &Valeur) -> [(&'static str, f64); 4] {
    [("poses", distincts(ch(b, "processed"))), ("differes", distincts(ch(b, "deferred"))), ("main", distincts(ch(b, "manuallyCompleted"))), ("sautes", distincts(ch(b, "skipped")))]
}
/// `Number(v)` sans chaîne.
fn number(v: &Valeur) -> Result<f64, Echec> {
    match v { Valeur::Indefini => Ok(f64::NAN), Valeur::Nul => Ok(0.0), Valeur::Booleen(b) => Ok(if *b { 1.0 } else { 0.0 }), Valeur::Nombre(x) => Ok(*x), _ => hd("Number() d'une chaîne ou d'un objet") }
}
/// `finPartieDe(sc)`.
fn fin_partie_de(sc: &Valeur) -> Result<bool, Echec> {
    let a = est(ch(sc, "endMode"), "partie") || number(ch(sc, "end"))? >= FIN_PARTIE;
    Ok(a && js::entier(ch(sc, "start")).is_some_and(|x| (0.0..=1.0).contains(&x)))
}

/// `ficheFin(b, o = {})` (fonction 261).
///
/// # Errors
/// Hors domaine : `o` nul, dates hors forme ISO, `Number()` d'une chaîne, coupe d'une paire de substitution.
pub fn fiche_fin(b: &Valeur, o: &Valeur) -> Result<Valeur, Echec> {
    let o = match o { Valeur::Indefini => &Valeur::Objet(vec![]), Valeur::Nul => return hd("ficheFin : o nul (le JS lève)"), x => x };
    let st = ch(b, "state");
    if !b.vrai() || !matches!(ch(b, "id"), Valeur::Chaine(_)) || !(CLOS.iter().any(|c| est(st, c)) || est(st, "ERROR")) { return Ok(Valeur::Nul); }
    let started = iso(ch(b, "startedAt"))?;
    let ended = ou(iso(chemin(b, &["stoppedAtEnd", "at"]))?, || ou(iso(ch(o, "at"))?, || Ok(Valeur::Nul)))?;
    let duree = match (&started, &ended) {
        (Valeur::Chaine(a), Valeur::Chaine(z)) => Some(js::date::parse(z)? - js::date::parse(a)?),
        _ => None,
    };
    let motif = ou(texte(ch(o, "motif"), 80)?, || ou(texte(chemin(b, &["stoppedAtEnd", "reason"]), 80)?, || ou(texte(chemin(b, &["stoppedAtEnd", "issue"]), 80)?, ||
        if est(st, "ERROR") { ou(texte(chemin(b, &["error", "message"]), 160)?, || Ok(s("erreur"))) } else if est(st, "STOPPED") { Ok(s("arret")) } else { Ok(s("fin-naturelle")) })))?;
    let mut f = Obj::new().et("batchId", ch(b, "id").clone()).et("part", entier(chemin(b, &["scope", "part"]))).et("version", texte(ch(o, "version"), 20)?)
        .et("startedAt", started).et("endedAt", ended).et("dureeMs", duree.filter(|d| d.is_finite() && *d >= 0.0).map_or(Valeur::Nul, Valeur::Nombre));
    for (k, v) in comptes(b) { f.poser(k, Valeur::Nombre(v)); }
    f.poser("ecritsPasse", entier(ch(o, "ecritsPasse")));
    f.poser("fin", fin_de(b));
    f.poser("motif", motif);
    f.poser("etat", st.clone());
    f.poser("finPartie", Valeur::Booleen(fin_partie_de(ch(b, "scope"))?));
    Ok(f.v())
}

/// Tri stable faillible (voir resume.rs).
fn trier<T>(v: &mut [T], f: impl Fn(&T, &T) -> Result<core::cmp::Ordering, Echec>) -> Result<(), Echec> {
    let mut err = None;
    v.sort_by(|a, b| match f(a, b) { Ok(o) => o, Err(e) => { err.get_or_insert(e); core::cmp::Ordering::Equal } });
    match err { Some(e) => Err(e), None => Ok(()) }
}
/// `String(v || '')`.
fn chaine_ou_vide(v: &Valeur) -> Result<String, Echec> { if v.vrai() { js::en_chaine(v) } else { Ok(String::new()) } }

/// `historique({departs, fins, courant, version} = {})` (fonction 263).
///
/// # Errors
/// Hors domaine : options nulles, dates hors forme ISO, locale non vérifiée (tri), `String()` d'un objet.
pub fn historique(opts: &Valeur, loc: Locale) -> Result<Valeur, Echec> {
    let o = match opts { Valeur::Indefini => &Valeur::Objet(vec![]), Valeur::Objet(_) => opts, _ => return hd("historique : options non objet") };
    let liste = |k: &str| -> Vec<Valeur> { let v = ch(o, k); match v { Valeur::Tableau(t) => t.iter().flatten().cloned().collect(), _ if js::est_tableau(v) => js::elements(v).unwrap_or_default().into_owned(), _ => vec![] } };
    let id_de = |x: &Valeur| -> Option<String> { if x.vrai() { js::chaine(ch(x, "batchId")).map(str::to_owned) } else { None } };
    let d: Vec<(String, Valeur)> = liste("departs").into_iter().filter_map(|x| id_de(&x).filter(|i| !i.starts_with("echo:")).map(|i| (i, x))).collect();
    let mut fm: Carte<String, Valeur> = Carte::default();
    for x in liste("fins") { if let Some(i) = id_de(&x) { fm.set(i, x); } }
    let mut tri: Vec<(String, String, Valeur)> = d.iter().map(|(i, x)| Ok((chaine_ou_vide(ch(x, "at"))?, i.clone(), x.clone()))).collect::<Result<_, Echec>>()?;
    trier(&mut tri, |a, b| js::locale_compare(&a.0, &b.0, loc))?;
    let mut premier: Carte<String, Valeur> = Carte::default();
    for (_, i, x) in tri { if !premier.has(&i) { premier.set(i, x); } }
    let courant = ch(o, "courant");
    let lot = if courant.vrai() && matches!(ch(courant, "id"), Valeur::Chaine(_)) { Some(courant) } else { None };
    let mut ids: Vec<String> = vec![];
    let mut vus = std::collections::HashSet::new();
    for i in fm.iter().map(|(k, _)| k.clone()).chain(premier.iter().map(|(k, _)| k.clone())).chain(lot.and_then(|c| js::chaine(ch(c, "id")).map(str::to_owned))) {
        if vus.insert(i.clone()) { ids.push(i); }
    }
    let version = ch(o, "version");
    let mut out: Vec<(String, Valeur)> = vec![];
    for id in &ids {
        let f = fm.get(id);
        let dd = premier.get(id);
        let c = lot.filter(|c| js::chaine(ch(c, "id")) == Some(id.as_str()));
        let dep = dd.map(|d| Obj::new().et("valides", entier(ch(d, "valides"))).et("invalides", entier(ch(d, "invalides"))).et("ignores", entier(ch(d, "ignores"))).et("total", entier(ch(d, "total"))).v());
        let fin_p = match (f, c) { (Some(f), _) => matches!(ch(f, "finPartie"), Valeur::Booleen(true)), (None, Some(c)) => fin_partie_de(ch(c, "scope"))?, _ => false };
        let vivant = c.is_some_and(|c| fin_de(c) == s("en-cours"));
        let n = match c { Some(c) if f.is_none() || vivant => Some(comptes(c)), _ => None };
        let fin = if vivant { s("en-cours") } else if let Some(f) = f {
            let x = ch(f, "fin");
            if ["complete", "arretee", "interrompue"].iter().any(|k| est(x, k)) { x.clone() } else { s("interrompue") }
        } else if let Some(c) = c { fin_de(c) } else { s("interrompue") };
        let fv = f.unwrap_or(&js::INDEFINI);
        let cv = c.unwrap_or(&js::INDEFINI);
        let dv = dd.unwrap_or(&js::INDEFINI);
        let part = { let a = entier(ch(fv, "part")); if js::nul(&a) { let b = entier(chemin(cv, &["scope", "part"])); if js::nul(&b) { entier(ch(dv, "partie")) } else { b } } else { a } };
        let started = ou(iso(ch(fv, "startedAt"))?, || ou(iso(ch(cv, "startedAt"))?, || iso(ch(dv, "at"))))?;
        let ended = if vivant { Valeur::Nul } else { iso(ch(fv, "endedAt"))? };
        let ver = ou(texte(ch(fv, "version"), 20)?, || ou(texte(ch(dv, "version"), 20)?, || if c.is_some() { texte(version, 20) } else { Ok(Valeur::Nul) }))?;
        let compte = |k: &str, i: usize| -> Valeur { match (&n, f) { (Some(n), _) => n.get(i).map_or(Valeur::Nul, |x| Valeur::Nombre(x.1)), (None, Some(f)) => entier(ch(f, k)), _ => Valeur::Nul } };
        let cibles = match &dep { Some(d) if fin_p => ch(d, "invalides").clone(), _ => Valeur::Nul };
        let e = Obj::new().et("part", part).et("batchId", s(id)).et("startedAt", started.clone()).et("endedAt", ended).et("version", ver)
            .et("depart", dep.unwrap_or(Valeur::Nul)).et("cibles", cibles).et("poses", compte("poses", 0)).et("differes", compte("differes", 1))
            .et("ecritsPasse", f.map_or(Valeur::Nul, |f| entier(ch(f, "ecritsPasse")))).et("main", compte("main", 2)).et("sautes", compte("sautes", 3)).et("fin", fin).v();
        out.push((chaine_ou_vide(&started)?, e));
    }
    trier(&mut out, |a, b| js::locale_compare(&b.0, &a.0, loc))?;
    Ok(tab(out.into_iter().map(|(_, e)| e).collect()))
}

/// `finDe(b)` (fonction 260).
#[must_use]
pub fn fin_de(b: &Valeur) -> Valeur {
    let st = ch(b, "state");
    s(if est(st, "COMPLETED") || est(st, "FINISHED_WITH_UNCONFIRMED_ACTIONS") { "complete" }
      else if est(st, "STOPPED") { if ch(b, "stoppedAtEnd").vrai() { "complete" } else { "arretee" } }
      else if est(st, "ERROR") { "interrompue" } else { "en-cours" })
}

/// `x && typeof x === 'object' && typeof x.batchId === 'string'`.
fn fiche_valable(x: &Valeur) -> bool { matches!(x, Valeur::Objet(_)) && matches!(ch(x, "batchId"), Valeur::Chaine(_)) }

/// `ajouterFin(liste, fiche)` (fonction 262).
///
/// # Errors
/// Aucune en pratique (signature commune).
pub fn ajouter_fin(liste: &Valeur, fiche: &Valeur) -> Result<Valeur, Echec> {
    let mut l: Vec<Valeur> = if crate::js_extra::est_tableau(liste) {
        crate::js_extra::elements(liste).unwrap_or_default().iter().filter(|x| fiche_valable(x)).cloned().collect()
    } else { vec![] };
    if !fiche.vrai() || !fiche_valable(fiche) { return Ok(tab(l)); }
    let id = ch(fiche, "batchId");
    let i = l.iter().position(|x| ch(x, "batchId") == id);
    let Valeur::Objet(champs) = fiche else { return hd("fiche non objet") };
    match i {
        None => {
            l.push(fiche.clone());
            let debut = l.len().saturating_sub(MAX_FINS);
            Ok(tab(l.split_off(debut)))
        }
        Some(i) => {
            let mut o = Obj::new();
            if let Some(ancien) = l.get(i) { o.etaler(ancien)?; }
            // Object.entries puis fromEntries : l'ordre des indices est rétabli au décodage par le JS
            for (k, v) in champs { if !matches!(v, Valeur::Indefini | Valeur::Nul) { o.poser(k, v.clone()); } }
            if let Some(e) = l.get_mut(i) { *e = o.v(); }
            Ok(tab(l))
        }
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn fiche_et_historique() {
        let b = Obj::new().et("id", s("L1")).et("state", s("COMPLETED")).et("startedAt", s("2026-11-06T07:00:00.000Z"))
            .et("stoppedAtEnd", Obj::new().et("at", s("2026-11-06T08:00:00.000Z")).v()).et("processed", tab(vec![Obj::new().et("cut", Valeur::Nombre(3.0)).v()])).v();
        let f = fiche_fin(&b, &Valeur::Indefini).unwrap_or(Valeur::Nul);
        assert_eq!(ch(&f, "dureeMs"), &Valeur::Nombre(3_600_000.0));
        assert_eq!(ch(&f, "poses"), &Valeur::Nombre(1.0));
        let h = historique(&Obj::new().et("fins", tab(vec![f])).v(), Locale::verifiee()).unwrap_or(Valeur::Nul);
        let Valeur::Tableau(t) = h else { panic!("tableau attendu") };
        assert_eq!(t.len(), 1);
        assert!(historique(&Valeur::Nul, Locale::verifiee()).is_err());
    }
    #[test]
    fn fin_et_ajout() {
        let b = Obj::new().et("state", s("STOPPED")).et("stoppedAtEnd", Valeur::Booleen(true)).v();
        assert_eq!(fin_de(&b), s("complete"));
        assert_eq!(fin_de(&Valeur::Nul), s("en-cours"));
        let f1 = Obj::new().et("batchId", s("a")).et("poses", Valeur::Nombre(3.0)).et("motif", Valeur::Nul).v();
        let f2 = Obj::new().et("batchId", s("a")).et("poses", Valeur::Nul).et("motif", s("arret")).v();
        let l = ajouter_fin(&tab(vec![f1, Valeur::Nombre(1.0)]), &f2).unwrap_or(Valeur::Nul);
        let Valeur::Tableau(t) = l else { panic!("tableau attendu") };
        assert_eq!(t.len(), 1);
        let e = t[0].clone().unwrap_or(Valeur::Nul);
        assert_eq!(ch(&e, "poses"), &Valeur::Nombre(3.0));
        assert_eq!(ch(&e, "motif"), &s("arret"));
    }
}
