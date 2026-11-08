//! `src/serie-captures-vides.js` (CH-051) : garde « série de captures vides » du lot.
//! `observer` modifie l'état reçu en place : le port rend la réponse ET le journal des écritures (`[clé, valeur]`, dans
//! l'ordre du JS), que la façade applique sur l'objet d'origine (une clé neuve s'ajoute à la même place qu'en JS).
use crate::js::{est_entier, hd, incrementer, lire, nombre, objet, opt, poser, R};
use crate::Ecrit;
use ariane_vba::Valeur;

const DEFAUT: [(&str, f64); 7] = [("actif", 0.0), ("seuil", 3.0), ("attenteMs", 20000.0), ("attentesParEssai", 1.0), ("rechargement", 1.0), ("rechargementsParSerie", 1.0), ("reessaiApresCuts", 10.0)];
const ENTIERS: [(&str, f64); 5] = [("seuil", 1.0), ("attenteMs", 0.0), ("attentesParEssai", 1.0), ("rechargementsParSerie", 0.0), ("reessaiApresCuts", 1.0)];

/// `reglage(S)` (la façade le gèle, comme `Object.freeze`).
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn reglage(s: &Valeur) -> R<Valeur> {
    let vide = objet(vec![]);
    let s = if s.vrai() && crate::js::objetal(s) { s } else { &vide };
    let mut r = objet(DEFAUT.iter().map(|(k, v)| (*k, if *k == "actif" || *k == "rechargement" { Valeur::Booleen(*v != 0.0) } else { Valeur::Nombre(*v) })).collect());
    let a = opt(s, "actif");
    poser(&mut r, "actif", Valeur::Booleen(matches!(a, Valeur::Booleen(true))))?;
    for (k, min) in ENTIERS {
        let v = opt(s, k);
        if matches!(v, Valeur::Indefini) { continue; }
        if est_entier(v) && nombre(v)? >= min { poser(&mut r, k, v.clone())?; } else { poser(&mut r, "actif", Valeur::Booleen(false))?; }
    }
    match opt(s, "rechargement") {
        Valeur::Indefini => {}
        Valeur::Booleen(b) => poser(&mut r, "rechargement", Valeur::Booleen(*b))?,
        _ => poser(&mut r, "actif", Valeur::Booleen(false))?,
    }
    Ok(r)
}

/// `creer(S)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn creer(s: &Valeur) -> R<Valeur> {
    let z = || Valeur::Nombre(0.0);
    Ok(objet(vec![("reglage", reglage(s)?), ("vides", z()), ("serie", Valeur::Booleen(false)), ("series", z()), ("attentes", z()), ("rechargements", z()),
        ("differesSansAttente", z()), ("depuisDernierEssai", z()), ("attentesEssai", z())]))
}

fn reponse(e: &Valeur, action: &str, plus: Vec<(&str, Valeur)>) -> Valeur {
    let mut c = vec![("action", crate::js::ch(action)), ("serie", opt(e, "series").clone()), ("vides", opt(e, "vides").clone())];
    c.extend(plus);
    objet(c)
}
fn inc(w: &mut Ecrit, k: &str) -> R<()> { let (_, n) = incrementer(opt(&w.e, k))?; w.poser(k, Valeur::Nombre(n)) }
fn differer(w: &mut Ecrit, motif: &str) -> R<Valeur> { inc(w, "differesSansAttente")?; Ok(reponse(&w.e, "differer", vec![("motif", crate::js::ch(motif))])) }
fn attendre(w: &mut Ecrit, attente: &Valeur) -> R<Valeur> {
    inc(w, "attentes")?;
    inc(w, "attentesEssai")?;
    w.poser("depuisDernierEssai", Valeur::Nombre(0.0))?;
    Ok(reponse(&w.e, "attendre", vec![("attenteMs", attente.clone())]))
}
fn fermer(w: &mut Ecrit) -> R<()> {
    for k in ["vides", "serie", "attentes", "rechargements", "differesSansAttente", "depuisDernierEssai", "attentesEssai"] {
        w.poser(k, if k == "serie" { Valeur::Booleen(false) } else { Valeur::Nombre(0.0) })?;
    }
    Ok(())
}

/// `observer(e, capture, ctx)` : la réponse, et `w` porte les écritures sur `e`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn observer(w: &mut Ecrit, capture: &Valeur, ctx: &Valeur) -> R<Valeur> {
    let rg = lire(&w.e, "reglage")?.clone();
    let vide = objet(vec![]);
    let c = if ctx.vrai() { ctx } else { &vide };
    if !lire(&rg, "actif")?.vrai() { return Ok(reponse(&w.e, "rien", vec![])); }
    if !matches!(w.e, Valeur::Objet(_)) { return hd("état non objet"); }
    let points = if capture.vrai() && crate::js::objetal(capture) && crate::js::est_fini(opt(capture, "points")) { Some(nombre(opt(capture, "points"))?) } else { None };
    let Some(points) = points else { return Ok(reponse(&w.e, "rien", vec![])) };
    if points > 0.0 { fermer(w)?; return Ok(reponse(&w.e, "rien", vec![])); }
    let n = |w: &Ecrit, k: &str| nombre(opt(&w.e, k));
    let r = |k: &str| nombre(opt(&rg, k));
    let attente = opt(&rg, "attenteMs").clone();
    if opt(c, "apresAttente").vrai() {
        if n(w, "attentesEssai")? < r("attentesParEssai")? { return attendre(w, &attente); }
        w.poser("depuisDernierEssai", Valeur::Nombre(0.0))?;
        if !opt(&rg, "rechargement").vrai() { return differer(w, "rechargement-coupe"); }
        if n(w, "rechargements")? >= r("rechargementsParSerie")? { return differer(w, "serie-en-cours"); }
        if matches!(opt(c, "rechargementPossible"), Valeur::Booleen(false)) { return differer(w, "rechargement-impossible"); }
        inc(w, "rechargements")?;
        w.poser("depuisDernierEssai", Valeur::Nombre(0.0))?;
        return Ok(reponse(&w.e, "recharger", vec![]));
    }
    if opt(c, "apresRechargement").vrai() { w.poser("depuisDernierEssai", Valeur::Nombre(0.0))?; return differer(w, "serie-en-cours"); }
    inc(w, "vides")?;
    if !opt(&w.e, "serie").vrai() {
        if n(w, "vides")? < r("seuil")? { return Ok(reponse(&w.e, "rien", vec![])); }
        w.poser("serie", Valeur::Booleen(true))?;
        inc(w, "series")?;
        w.poser("attentesEssai", Valeur::Nombre(0.0))?;
        return attendre(w, &attente);
    }
    inc(w, "depuisDernierEssai")?;
    if n(w, "depuisDernierEssai")? >= r("reessaiApresCuts")? { w.poser("attentesEssai", Valeur::Nombre(0.0))?; return attendre(w, &attente); }
    differer(w, "serie-en-cours")
}

/// `bilan(e)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn bilan(e: &Valeur) -> R<Valeur> {
    let mut c = vec![];
    for k in ["serie", "series", "vides", "attentes", "rechargements", "differesSansAttente"] { c.push((k, lire(e, k)?.clone())); }
    Ok(objet(c))
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn reglage_et_creer() {
        let r = reglage(&objet(vec![("actif", Valeur::Booleen(true)), ("seuil", Valeur::Nombre(0.0))])).unwrap();
        assert_eq!(opt(&r, "actif"), &Valeur::Booleen(false));
        assert_eq!(opt(&creer(&Valeur::Nul).unwrap(), "vides"), &Valeur::Nombre(0.0));
    }
    #[test]
    fn serie_puis_attente() {
        let mut e = creer(&objet(vec![("actif", Valeur::Booleen(true)), ("seuil", Valeur::Nombre(2.0))])).unwrap();
        let vide = objet(vec![("points", Valeur::Nombre(0.0))]);
        let mut actions = vec![];
        for _ in 0..3 {
            let mut w = Ecrit::new(e.clone());
            actions.push(opt(&observer(&mut w, &vide, &Valeur::Indefini).unwrap(), "action").clone());
            e = w.e;
        }
        assert_eq!(actions, vec![crate::js::ch("rien"), crate::js::ch("attendre"), crate::js::ch("differer")]);
        assert_eq!(opt(&bilan(&e).unwrap(), "series"), &Valeur::Nombre(1.0));
    }
}
