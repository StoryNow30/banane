//! `src/raison-correction.js` (RM-11) : lecture d'une frappe, état de séance (raison collante), raison de la visite,
//! vue du panneau. Les fonctions qui modifient l'état en place passent par [`Ecrit`] : journal des écritures.
use crate::js::{ch, cle, elements, est, est_entier, est_fini, hd, incrementer, iterer, lire, nombre, objet, objetal, opt, ou_nul, plus_un_ou, strict, tableau, R};
use crate::Ecrit;
use ariane_vba::Valeur;

const FORMAT: &str = "ariane-raison-v1";
const CODES: [&str; 6] = ["rail-voisin", "adv", "pn", "nuage-pauvre", "hauteur", "autre"];
const LIBELLES: [&str; 6] = ["Rail voisin", "ADV", "PN", "Nuage diffus ou pauvre", "Hauteur seulement", "Autre"];
const TABLES: [&str; 3] = ["chiffres", "alt-chiffres", "pave"];
const CAUSES: [&str; 6] = ["touche-0", "autre-raison", "changement-partie", "saut", "pause", "fin-seance"];
const HISTORIQUE_MAX: usize = 6;
const BANDE: usize = 24;
const MODIFICATEURS: [&str; 17] = ["Shift", "ShiftLeft", "ShiftRight", "Control", "ControlLeft", "ControlRight", "Alt", "AltLeft", "AltRight", "Meta", "MetaLeft", "MetaRight",
    "CapsLock", "NumLock", "ScrollLock", "AltGraph", "OS"];
/// `REGLAGE_DEFAUT` : doubleAppuiMs, sautCuts, rappelCollanteCuts.
const DOUBLE_APPUI_MS: f64 = 600.0;
const SAUT_CUTS: f64 = 30.0;
const RAPPEL_COLLANTE_CUTS: f64 = 40.0;

/// `/^(?:Digit|Numpad)([0-6])$/` : le chiffre lu.
fn numero(code: &str) -> Option<u8> {
    let reste = code.strip_prefix("Digit").or_else(|| code.strip_prefix("Numpad"))?;
    match reste.as_bytes() { [d @ b'0'..=b'6'] => Some(d - b'0'), _ => None }
}
fn dans(v: &Valeur, liste: &[&str]) -> bool { matches!(v, Valeur::Chaine(s) if liste.contains(&s.as_str())) }
/// Une valeur du réglage (`(reglage || REGLAGE_DEFAUT).k`).
fn regle(reglage: &Valeur, k: &str, defaut: f64) -> R<f64> { if reglage.vrai() { nombre(opt(reglage, k)) } else { Ok(defaut) } }

/// `lireFrappe(ev, touches)`.
#[must_use]
pub fn lire_frappe(ev: &Valeur, touches: &Valeur) -> Valeur {
    let table = if matches!(touches, Valeur::Indefini) { "chiffres" } else { match touches { Valeur::Chaine(s) if TABLES.contains(&s.as_str()) => s.as_str(), _ => return Valeur::Nul } };
    if !ev.vrai() || !objetal(ev) || !est(opt(ev, "type"), "keydown") || matches!(opt(ev, "editable"), Valeur::Booleen(true)) || matches!(opt(ev, "repeat"), Valeur::Booleen(true)) { return Valeur::Nul; }
    let Valeur::Chaine(code) = opt(ev, "code") else { return Valeur::Nul };
    let Some(d) = numero(code) else { return Valeur::Nul };
    if opt(ev, "ctrlKey").vrai() || opt(ev, "metaKey").vrai() { return Valeur::Nul; }
    let alt = opt(ev, "altKey").vrai();
    if table == "chiffres" && alt { return Valeur::Nul; }
    if table == "alt-chiffres" && !alt { return Valeur::Nul; }
    if table == "pave" && (alt || !code.starts_with("Numpad")) { return Valeur::Nul; }
    if d == 0 { objet(vec![("efface", Valeur::Booleen(true))]) } else { objet(vec![("code", ch(CODES.get(usize::from(d - 1)).copied().unwrap_or("autre")))]) }
}

/// `estTouchePossible(code)`.
#[must_use]
pub fn est_touche_possible(code: &Valeur) -> bool { matches!(code, Valeur::Chaine(s) if numero(s).is_some()) }

/// `autreGeste(evenements)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn autre_geste(evenements: &Valeur) -> R<bool> {
    let l = if evenements.vrai() { iterer(evenements)? } else { vec![] };
    for ev in l {
        if !ev.vrai() || matches!(opt(&ev, "editable"), Valeur::Booleen(true)) { continue; }
        if !dans(opt(&ev, "type"), &["keydown", "pointerdown", "mousedown", "click"]) { continue; }
        if let Valeur::Chaine(c) = opt(&ev, "code") { if MODIFICATEURS.contains(&c.as_str()) || numero(c).is_some() { continue; } }
        return Ok(true);
    }
    Ok(false)
}

/// `delaiDeGrace(validationMs, frappeMs, graceMs)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn delai_de_grace(validation: &Valeur, frappe: &Valeur, grace: &Valeur) -> R<Valeur> {
    let (Valeur::Nombre(v), Valeur::Nombre(f)) = (validation, frappe) else { return Ok(Valeur::Nul) };
    if !v.is_finite() || !f.is_finite() { return Ok(Valeur::Nul); }
    let d = f - v;
    Ok(if d >= 0.0 && d <= nombre(grace)? { Valeur::Nombre(ariane_js::round(d)) } else { Valeur::Nul })
}

/// `derniereValidation(visite, frappeMs)`, la façade ayant lu `Date.parse(i.observedAt || '')` pour chaque intention
/// VALIDATE (`temps`, `null` pour les autres), dans l'ordre de `visite.operatorIntents`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn derniere_validation(temps: &Valeur, frappe: &Valeur) -> R<f64> {
    let f = nombre(frappe)?;
    let mut dernier = f64::NAN;
    for t in elements(temps).unwrap_or_default().into_iter().flatten() {
        let Valeur::Nombre(t) = t else { continue };
        if t.is_finite() && t <= f && !(t < dernier) { dernier = t; }
    }
    Ok(dernier)
}

/// `nouvelEtat(touches)`.
#[must_use]
pub fn nouvel_etat(touches: &Valeur) -> Valeur {
    let t = if dans(touches, &TABLES) { touches.clone() } else { ch("chiffres") };
    objet(vec![("format", ch(FORMAT)), ("actif", Valeur::Booleen(true)), ("touches", t), ("collante", Valeur::Nul), ("derniere", Valeur::Nul), ("serieSuivante", Valeur::Nombre(1.0)),
        ("series", Valeur::Tableau(vec![])), ("poses", Valeur::Nombre(0.0))])
}

fn resume_de(c: &Valeur, fin_par: Valeur) -> Valeur {
    let mut o: Vec<(&str, Valeur)> = ["serie", "code", "partie", "cutDebut", "cutFin", "nCuts"].iter().map(|k| (*k, opt(c, k).clone())).collect();
    o.push(("finPar", fin_par));
    objet(o)
}
/// `fermer(etat, cause)` : la série finie (poussée dans `etat.series`), ou null.
fn fermer(w: &mut Ecrit, cause: &str) -> R<Valeur> {
    let c = opt(&w.e, "collante").clone();
    if !c.vrai() { return Ok(Valeur::Nul); }
    let fin = resume_de(&c, ch(cause));
    w.pousser_serie(fin.clone())?;
    w.poser("collante", Valeur::Nul)?;
    Ok(fin)
}

/// `finir(etat, cause)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn finir(w: &mut Ecrit, cause: &Valeur) -> R<Valeur> {
    if !w.e.vrai() { return Ok(Valeur::Nul); }
    let Valeur::Chaine(c) = cause else { return Ok(Valeur::Nul) };
    if !CAUSES.contains(&c.as_str()) { return Ok(Valeur::Nul); }
    fermer(w, &c.clone())
}

fn pose(code: &Valeur, serie: Valeur, ouvre: bool, ferme: Valeur) -> Valeur {
    objet(vec![("type", ch("pose")), ("code", code.clone()), ("source", ch("touche")), ("serie", serie), ("ouvre", Valeur::Booleen(ouvre)), ("ferme", ferme)])
}

/// `appuyer(etat, frappe, reglage)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn appuyer(w: &mut Ecrit, frappe: &Valeur, reglage: &Valeur) -> R<Valeur> {
    if lire(frappe, "efface")?.vrai() {
        w.poser("derniere", Valeur::Nul)?;
        let ferme = fermer(w, "touche-0")?;
        return Ok(objet(vec![("type", ch("efface")), ("ferme", ferme)]));
    }
    let code = opt(frappe, "code").clone();
    let d = lire(&w.e, "derniere")?.clone();
    let mut double = d.vrai() && strict(opt(&d, "code"), &code)? && strict(opt(&d, "cutKey"), opt(frappe, "cutKey"))?;
    if double {
        let ecart = nombre(crate::js::lire_at(frappe)?)? - nombre(crate::js::lire_at(&d)?)?;
        double = ecart >= 0.0 && ecart <= regle(reglage, "doubleAppuiMs", DOUBLE_APPUI_MS)?;
    }
    let p = plus_un_ou(opt(&w.e, "poses"))?;
    w.poser("poses", Valeur::Nombre(p))?;
    if !double {
        w.poser("derniere", objet(vec![("code", code.clone()), ("cutKey", opt(frappe, "cutKey").clone()), ("at", crate::js::lire_at(frappe)?.clone())]))?;
        return Ok(pose(&code, Valeur::Nul, false, Valeur::Nul));
    }
    w.poser("derniere", Valeur::Nul)?;
    let c = opt(&w.e, "collante").clone();
    if c.vrai() && strict(opt(&c, "code"), &code)? { return Ok(pose(&code, opt(&c, "serie").clone(), false, Valeur::Nul)); }
    let ferme = fermer(w, "autre-raison")?;
    let (serie, suivante) = incrementer(opt(&w.e, "serieSuivante"))?;
    w.poser("serieSuivante", Valeur::Nombre(suivante))?;
    let cut = ou_nul(opt(frappe, "cut"));
    w.poser("collante", objet(vec![("serie", Valeur::Nombre(serie)), ("code", code.clone()), ("partie", ou_nul(opt(frappe, "part"))), ("cutDebut", cut.clone()), ("cutFin", cut.clone()),
        ("dernierCut", cut), ("nCuts", Valeur::Nombre(1.0)), ("eventSeq", ou_nul(opt(frappe, "eventSeq"))), ("ouverteA", ou_nul(opt(frappe, "poseeA")))]))?;
    Ok(pose(&code, Valeur::Nombre(serie), true, ferme))
}

/// `heriter(etat, identity, reglage)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn heriter(w: &mut Ecrit, identity: &Valeur, reglage: &Valeur) -> R<Valeur> {
    let c = opt(&w.e, "collante").clone();
    if !c.vrai() { return Ok(Valeur::Nul); }
    let (part, cut) = (opt(identity, "part"), opt(identity, "cut"));
    if !strict(part, opt(&c, "partie"))? { fermer(w, "changement-partie")?; return Ok(Valeur::Nul); }
    if !est_entier(cut) || (nombre(cut)? - nombre(opt(&c, "dernierCut"))?).abs() > regle(reglage, "sautCuts", SAUT_CUTS)? { fermer(w, "saut")?; return Ok(Valeur::Nul); }
    if !matches!(c, Valeur::Objet(_)) { return hd("collante non objet"); }
    let cn = nombre(cut)?;
    if !strict(cut, opt(&c, "dernierCut"))? { let (_, n) = incrementer(opt(&c, "nCuts"))?; w.poser_collante("nCuts", Valeur::Nombre(n))?; }
    w.poser_collante("dernierCut", cut.clone())?;
    let fin = ariane_js::max(nombre(opt(&c, "cutFin"))?, cn);
    w.poser_collante("cutFin", Valeur::Nombre(fin))?;
    let debut = ariane_js::min(nombre(opt(&c, "cutDebut"))?, cn);
    w.poser_collante("cutDebut", Valeur::Nombre(debut))?;
    Ok(objet(vec![("code", opt(&c, "code").clone()), ("source", ch("collante")), ("serie", opt(&c, "serie").clone()), ("eventSeq", opt(&c, "eventSeq").clone())]))
}

/// `resumeSeries(etat)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn resume_series(etat: &Valeur) -> R<Valeur> {
    if !etat.vrai() { return Ok(Valeur::Tableau(vec![])); }
    let Some(s) = elements(lire(etat, "series")?) else { return hd("series non tableau") };
    let mut out = Vec::with_capacity(s.len() + 1);
    for x in s {
        out.push(Some(match x {
            None => Valeur::Indefini, // trou du map, devenu undefined par la décomposition
            Some(Valeur::Objet(o)) => Valeur::Objet(o),
            Some(Valeur::Nul | Valeur::Indefini | Valeur::Nombre(_) | Valeur::Booleen(_)) => objet(vec![]),
            Some(Valeur::Chaine(c)) if c.is_empty() => objet(vec![]),
            Some(_) => return hd("décomposition d'une chaîne ou d'un tableau"),
        }));
    }
    let c = opt(etat, "collante");
    if c.vrai() { out.push(Some(resume_de(c, Valeur::Nul))); }
    Ok(Valeur::Tableau(out))
}

/// `appliquer(visite, raison)`, `avant` valant `visite.raisonCorrection` : la nouvelle raison (la façade la pose sur
/// la visite et la rend, même objet).
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn appliquer(avant: &Valeur, raison: &Valeur) -> R<Valeur> {
    let historique = if avant.vrai() {
        let h = opt(avant, "historique");
        let mut l = if h.vrai() { iterer(h)? } else { vec![] };
        l.push(objet(vec![("code", opt(avant, "code").clone()), ("source", opt(avant, "source").clone()), ("poseeA", opt(avant, "poseeA").clone())]));
        let debut = l.len().saturating_sub(HISTORIQUE_MAX);
        l.split_off(debut)
    } else { vec![] };
    let av = lire(raison, "apresValidationMs")?;
    Ok(objet(vec![("format", ch(FORMAT)), ("code", opt(raison, "code").clone()), ("source", opt(raison, "source").clone()), ("serie", ou_nul(opt(raison, "serie"))),
        ("poseeA", ou_nul(opt(raison, "poseeA"))), ("eventSeq", ou_nul(opt(raison, "eventSeq"))), ("apresValidationMs", if est_fini(av) { av.clone() } else { Valeur::Nul }),
        ("historique", tableau(historique))]))
}

/// `effacer(visite, detail)` : null, ou la raison « aucune » à poser.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn effacer(avant: &Valeur, detail: &Valeur) -> R<Valeur> {
    if !avant.vrai() { return Ok(Valeur::Nul); }
    let r = objet(vec![("code", Valeur::Nul), ("source", ch("touche")), ("serie", Valeur::Nul), ("poseeA", ou_nul(opt(detail, "poseeA"))), ("eventSeq", ou_nul(opt(detail, "eventSeq"))),
        ("apresValidationMs", ou_nul(opt(detail, "apresValidationMs")))]);
    appliquer(avant, &r)
}

/// `vue(etat, visites, reglage)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn vue(etat: &Valeur, visites: &Valeur, reglage: &Valeur) -> R<Valeur> {
    if !etat.vrai() || !matches!(opt(etat, "actif"), Valeur::Booleen(true)) { return Ok(objet(vec![("actif", Valeur::Booleen(false))])); }
    let c = opt(etat, "collante");
    let liste = match elements(visites) { Some(l) => { let d = l.len().saturating_sub(BANDE); l.into_iter().skip(d).collect() } None => vec![] };
    let mut bande = Vec::with_capacity(liste.len());
    let mut avec = 0.0;
    for v in liste {
        let Some(v) = v else { bande.push(None); continue };
        let cut = ou_nul(opt(lire(&v, "identity")?, "cut"));
        let r = lire(&v, "raison")?;
        let code = if dans(r, &CODES) { r.clone() } else { Valeur::Nul };
        if code.vrai() { avec += 1.0; }
        bande.push(Some(objet(vec![("cut", cut), ("code", code)])));
    }
    let n_bande = bande.len() as f64;
    let collante = if c.vrai() {
        let code = opt(c, "code");
        let k = cle(code)?;
        let libelle = match CODES.iter().position(|x| *x == k) { Some(i) => ch(LIBELLES.get(i).copied().unwrap_or("")), None => code.clone() };
        objet(vec![("code", code.clone()), ("libelle", libelle), ("serie", opt(c, "serie").clone()), ("nCuts", opt(c, "nCuts").clone()), ("depuis", opt(c, "cutDebut").clone())])
    } else { Valeur::Nul };
    let rappel = c.vrai() && nombre(opt(c, "nCuts"))? >= regle(reglage, "rappelCollanteCuts", RAPPEL_COLLANTE_CUTS)?;
    let series = match lire(etat, "series")? {
        Valeur::Chaine(s) => s.encode_utf16().count(),
        x => match crate::js::longueur(x) { Some(n) => n, None => return hd("series non tableau") },
    };
    let poses = opt(etat, "poses");
    Ok(objet(vec![("actif", Valeur::Booleen(true)), ("touches", opt(etat, "touches").clone()), ("collante", collante), ("rappel", Valeur::Booleen(rappel)), ("bande", Valeur::Tableau(bande)),
        ("couverture", objet(vec![("visites", Valeur::Nombre(n_bande)), ("avecRaison", Valeur::Nombre(avec))])), ("poses", if poses.vrai() { poses.clone() } else { Valeur::Nombre(0.0) }),
        ("series", Valeur::Nombre(series as f64))]))
}

#[cfg(test)]
#[allow(clippy::float_cmp)] // essais d'identité au bit près : la comparaison exacte est le but
mod essais {
    use super::*;
    fn touche(code: &str) -> Valeur { objet(vec![("type", ch("keydown")), ("code", ch(code))]) }
    #[test]
    fn frappes() {
        assert_eq!(lire_frappe(&touche("Digit2"), &Valeur::Indefini), objet(vec![("code", ch("adv"))]));
        assert_eq!(lire_frappe(&touche("Numpad0"), &ch("pave")), objet(vec![("efface", Valeur::Booleen(true))]));
        assert_eq!(lire_frappe(&touche("Digit7"), &Valeur::Indefini), Valeur::Nul);
        assert!(est_touche_possible(&ch("Digit6")));
        assert!(!autre_geste(&tableau(vec![touche("ShiftLeft"), touche("Digit1")])).unwrap());
        assert!(autre_geste(&tableau(vec![touche("KeyA")])).unwrap());
        assert_eq!(delai_de_grace(&Valeur::Nombre(100.0), &Valeur::Nombre(350.4), &Valeur::Nombre(500.0)).unwrap(), Valeur::Nombre(250.0));
        assert_eq!(derniere_validation(&Valeur::Nombres(vec![5.0, 9.0, 20.0]), &Valeur::Nombre(10.0)).unwrap(), 9.0);
    }
    #[test]
    fn double_appui_puis_heritage() {
        let mut w = Ecrit::new(nouvel_etat(&Valeur::Indefini));
        let f = objet(vec![("code", ch("pn")), ("cutKey", ch("13:4")), ("at", Valeur::Nombre(0.0)), ("part", Valeur::Nombre(13.0)), ("cut", Valeur::Nombre(4.0))]);
        appuyer(&mut w, &f, &Valeur::Indefini).unwrap();
        let r = appuyer(&mut w, &f, &Valeur::Indefini).unwrap();
        assert_eq!(opt(&r, "ouvre"), &Valeur::Booleen(true));
        let h = heriter(&mut w, &objet(vec![("part", Valeur::Nombre(13.0)), ("cut", Valeur::Nombre(6.0))]), &Valeur::Indefini).unwrap();
        assert_eq!(opt(&h, "source"), &ch("collante"));
        assert_eq!(opt(opt(&w.e, "collante"), "nCuts"), &Valeur::Nombre(2.0));
        let fin = finir(&mut w, &ch("pause")).unwrap();
        assert_eq!(opt(&fin, "cutFin"), &Valeur::Nombre(6.0));
        assert_eq!(crate::js::longueur(&resume_series(&w.e).unwrap()), Some(1));
        assert!(matches!(vue(&w.e, &Valeur::Indefini, &Valeur::Indefini).unwrap(), Valeur::Objet(_)));
        let a = appliquer(&Valeur::Nul, &objet(vec![("code", ch("pn")), ("source", ch("touche"))])).unwrap();
        let b = effacer(&a, &Valeur::Indefini).unwrap();
        assert_eq!(crate::js::longueur(opt(&b, "historique")), Some(1));
    }
}
