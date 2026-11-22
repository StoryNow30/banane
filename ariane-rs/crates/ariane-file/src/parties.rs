//! `src/file-parties.js` (CH-017, CH-026, CH-039) : machine à états réductrice de la file de parties, registre, alertes,
//! vue. Une fonction JS = une fonction ici, mêmes noms, même ordre des opérations. Les fonctions qui rendent l'état
//! reçu tel quel (`ignore`, refus, file inactive) le disent par `Sortie::Meme` : la façade rend alors l'OBJET reçu.
#![allow(clippy::float_cmp)] // `===` et `!==` du JS sur des nombres : comparaison exacte voulue
use crate::js::{a_l_indice, ch, copie, cle, elements, en_chaine, est, est_entier, hd, incrementer, longueur, lire, nombre, objet, opt, plus_un_ou, poser, pousser, sous, strict, tableau, texte, R};
use ariane_js::nombre::nombre_en_chaine;
use ariane_vba::Valeur;

const MAX_REGISTRE: usize = 50;
const MAX_PARTIES: f64 = 20.0;
const MAX_LISTE: usize = 2000;
const ACTIFS: [&str; 4] = ["lot", "passe", "relecture", "changement"];
const TERMINAUX: [&str; 2] = ["fin", "arret"];
const TENTATIVES_MAX: f64 = 2.0;

/// Une ligne de `MOTIFS` : code, issue pour la file, alerte, texte.
struct Motif { code: &'static str, file: &'static str, alerte: bool, texte: &'static str }
const MOTIFS: [Motif; 17] = [
    Motif { code: "fin-normale", file: "continue", alerte: false, texte: "fin normale du lot" },
    Motif { code: "partie-sans-rouge", file: "continue", alerte: false, texte: "partie sans cut rouge : comptée comme faite" },
    Motif { code: "depart-sur-vert", file: "continue", alerte: false, texte: "départ sur un cut vert, rien à traiter devant (aucune pose écrite)" },
    Motif { code: "partie-changee-par-esv", file: "continue", alerte: false, texte: "ESV a ouvert seul la partie suivante après la validation du dernier cut : retour sur la partie du lot" },
    Motif { code: "passe-arretee", file: "continue", alerte: false, texte: "deuxième passe arrêtée sans écriture en suspens" },
    Motif { code: "relecture-arretee", file: "continue", alerte: false, texte: "relecture arrêtée sans écriture en suspens" },
    Motif { code: "nombre-atteint", file: "fin", alerte: false, texte: "nombre de parties atteint" },
    Motif { code: "operateur", file: "arret", alerte: false, texte: "arrêtée par l’opérateur" },
    Motif { code: "ecriture-incertaine", file: "arret", alerte: true, texte: "pose écrite non validée : contrôle le cut dans ESV" },
    Motif { code: "refus-lot", file: "arret", alerte: true, texte: "le lot s’est arrêté sur un refus ou une anomalie" },
    Motif { code: "lot-non-demarre", file: "arret", alerte: true, texte: "le lot de la partie n’a pas pu démarrer" },
    Motif { code: "changement-impossible", file: "arret", alerte: true, texte: "la page d’ESV ne change pas de partie" },
    Motif { code: "commande-absente", file: "arret", alerte: true, texte: "l’adaptateur ne sait pas changer de partie" },
    Motif { code: "onglet-ferme", file: "arret", alerte: true, texte: "l’onglet ESV a été fermé" },
    Motif { code: "selecteur-illisible", file: "arret", alerte: true, texte: "le sélecteur de parties d’ESV n’offre plus la partie suivante : arrêt prudent" },
    Motif { code: "esv-muet", file: "arret", alerte: true, texte: "ESV ne répond plus" },
    Motif { code: "retour-impossible", file: "arret", alerte: true, texte: "ESV a changé de partie seul ; retour impossible" },
];
fn motif(code: &str) -> Option<&'static Motif> { MOTIFS.iter().find(|m| m.code == code) }
/// `MOTIFS[v]` pour une valeur dynamique.
fn motif_de(v: &Valeur) -> R<Option<&'static Motif>> { Ok(motif(&cle(v)?)) }

/// Seuils de l'alerte (`SEUILS`).
const SEUIL_DIFFERES: f64 = 2.0;
const SEUIL_CORRIGES: f64 = 0.05;
const SEUIL_REFUS: f64 = 1.0;

/// `entier(v, max)` : v si entier de [0, max[, sinon null (bits gardés, −0 compris).
fn entier(v: &Valeur, max: f64) -> Valeur { if est_entier(v) && matches!(v, Valeur::Nombre(x) if *x >= 0.0 && *x < max) { v.clone() } else { Valeur::Nul } }
fn entier8(v: &Valeur) -> Valeur { entier(v, 1e8) }
fn n_de(v: &Valeur) -> Option<f64> { if let Valeur::Nombre(x) = v { Some(*x) } else { None } }

/// `cuts(l)` : entiers de [0, 1e8[, sans doublon (`SameValueZero`, premier gardé), triés, 2000 au plus.
fn cuts(l: &Valeur) -> Valeur {
    let Some(e) = elements(l) else { return Valeur::Tableau(vec![]) };
    let mut vus = vec![];
    let mut t: Vec<f64> = vec![];
    for x in e.into_iter().flatten() {
        if let Valeur::Nombre(c) = entier8(&x) {
            let k = ariane_js::cle_same_value_zero(c);
            if !vus.contains(&k) { vus.push(k); t.push(c); }
        }
    }
    ariane_js::trier_nombres(&mut t);
    t.truncate(MAX_LISTE);
    Valeur::Tableau(t.into_iter().map(|x| Some(Valeur::Nombre(x))).collect())
}

fn etat_dans(e: &Valeur, liste: &[&str]) -> bool { e.vrai() && matches!(opt(e, "etat"), Valeur::Chaine(s) if liste.contains(&s.as_str())) }
/// `actif(e)`.
#[must_use]
pub fn actif(e: &Valeur) -> bool { etat_dans(e, &ACTIFS) }
/// `terminal(e)`.
#[must_use]
pub fn terminal(e: &Valeur) -> bool { etat_dans(e, &TERMINAUX) }

/// Issue de `planifier`.
pub enum Plan {
    /// `{refus}`.
    Refus(String),
    /// `{plan}`.
    Plan(Vec<Valeur>),
}
impl Plan {
    /// La valeur rendue par le JS.
    #[must_use]
    pub fn valeur(self) -> Valeur {
        match self { Plan::Refus(s) => objet(vec![("refus", Valeur::Chaine(s))]), Plan::Plan(p) => objet(vec![("plan", tableau(p))]) }
    }
}

/// `planifier(selecteur, courante, n)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn planifier(selecteur: &Valeur, courante: &Valeur, n: &Valeur) -> R<Plan> {
    let nn = n_de(n).unwrap_or(f64::NAN);
    if !est_entier(n) || nn < 1.0 || nn > MAX_PARTIES { return Ok(Plan::Refus("nombre de parties : un entier de 1 à 20".into())); }
    let parts = opt(selecteur, "parts");
    if !selecteur.vrai() || !est(lire(selecteur, "status")?, "ok") || longueur(parts).unwrap_or(0) == 0 {
        let s = if est(opt(selecteur, "status"), "absent") { "absent" } else { "illisible ou pas encore relevé" };
        return Ok(Plan::Refus(format!("sélecteur de parties d’ESV {s} : clique sur « Reconnecter »")));
    }
    if !est_entier(courante) { return Ok(Plan::Refus("partie affichée par ESV illisible".into())); }
    let c = n_de(courante).unwrap_or(f64::NAN);
    let liste: Vec<Valeur> = elements(parts).unwrap_or_default().into_iter().flatten().map(|x| opt(&x, "part").clone()).filter(|p| !matches!(entier(p, 1e7), Valeur::Nul)).collect();
    let Some(i) = liste.iter().position(|p| n_de(p) == Some(c)) else {
        return Ok(Plan::Refus(format!("la partie affichée ({}) n’est pas dans le sélecteur d’ESV", nombre_en_chaine(c))));
    };
    // n entier de [1, 20] : conversion exacte
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let nu = nn as usize;
    let plan: Vec<Valeur> = liste.into_iter().skip(i).take(nu).collect();
    if plan.len() < nu {
        let l = plan.len();
        return Ok(Plan::Refus(format!("le sélecteur d’ESV n’offre que {l} partie{} à partir de la partie {}, pas {}", if l > 1 { "s" } else { "" }, nombre_en_chaine(c), nombre_en_chaine(nn))));
    }
    Ok(Plan::Plan(plan))
}

fn partie_neuve(part: Valeur, rang: Valeur, at: &Valeur) -> Valeur {
    objet(vec![("part", part), ("rang", rang), ("lotId", Valeur::Nul), ("debut", at.clone()), ("fin", Valeur::Nul), ("motifs", Valeur::Tableau(vec![])), ("issueLot", Valeur::Nul),
        ("passe", Valeur::Nul), ("relecture", Valeur::Nul), ("resume", Valeur::Nul), ("alertes", Valeur::Tableau(vec![]))])
}

/// `arreter(e, motif, at, detail)`.
fn arreter(e: &mut Valeur, code: &str, at: &Valeur, detail: &Valeur) -> R<()> {
    let connu = motif(code);
    let m = connu.or_else(|| motif("refus-lot")).ok_or_else(|| ariane_js::Echec::hors_domaine("table des motifs"))?;
    poser(e, "etat", ch(if m.file == "fin" { "fin" } else { "arret" }))?;
    let code_fin = if connu.is_some() { code } else { "refus-lot" };
    let d = texte(detail, 400)?;
    poser(e, "motifFin", objet(vec![("code", ch(code_fin)), ("texte", ch(m.texte)), ("detail", d.clone()), ("at", at.clone())]))?;
    let partie = opt(e, "partie").clone();
    let alerte = if m.alerte {
        let p = if partie.vrai() { opt(&partie, "part").clone() } else { Valeur::Indefini };
        objet(vec![("code", ch(code_fin)), ("texte", ch(m.texte)), ("detail", d), ("at", at.clone()), ("part", crate::js::ou_nul(&p))])
    } else { Valeur::Nul };
    poser(e, "alerte", alerte)?;
    if partie.vrai() {
        let mut p = partie;
        if !matches!(p, Valeur::Objet(_)) { return hd("partie non objet"); }
        let fin = if opt(&p, "fin").vrai() { opt(&p, "fin").clone() } else { at.clone() };
        poser(&mut p, "fin", fin)?;
        poser(&mut p, "interrompue", Valeur::Booleen(true))?;
        pousser(sous(e, "bilan")?, p)?;
        poser(e, "partie", Valeur::Nul)?;
    }
    poser(e, "changement", Valeur::Nul)?;
    poser(e, "depuis", at.clone())
}

/// `noter(e, motif, detail)`.
fn noter(e: &mut Valeur, code: &Valeur, detail: &Valeur) -> R<()> {
    if !opt(e, "partie").vrai() { return Ok(()); }
    let t = match motif_de(code)? { Some(m) => ch(m.texte), None => Valeur::Nul };
    let d = texte(detail, 300)?;
    let p = sous(e, "partie")?;
    if !matches!(p, Valeur::Objet(_)) { return hd("partie non objet"); }
    pousser(sous(p, "motifs")?, objet(vec![("code", code.clone()), ("texte", t), ("detail", d)]))
}

/// `relire(v)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn relire(v: &Valeur) -> R<Valeur> {
    if !matches!(v, Valeur::Objet(_)) || n_de(opt(v, "v")) != Some(1.0) || !matches!(opt(v, "id"), Valeur::Chaine(_)) || !(actif(v) || terminal(v)) { return Ok(Valeur::Nul); }
    let plan = opt(v, "plan");
    let Some(pl) = elements(plan) else { return Ok(Valeur::Nul) };
    if pl.is_empty() || pl.iter().flatten().any(|p| matches!(entier(p, 1e7), Valeur::Nul)) || matches!(entier(opt(v, "k"), MAX_PARTIES), Valeur::Nul) { return Ok(Valeur::Nul); }
    if n_de(opt(v, "k")).unwrap_or(f64::NAN) >= pl.len() as f64 { return Ok(Valeur::Nul); }
    if longueur(opt(v, "bilan")).is_none() { return Ok(Valeur::Nul); }
    copie(v)
}

/// Rendu de `transition` et `reprise`.
pub enum Sortie {
    /// `{etat, …}` où `etat` est l'objet REÇU : seuls les autres champs sont rendus, la façade y remet l'objet.
    Meme(Vec<(&'static str, Valeur)>),
    /// `{etat: neuf, actions}`.
    Neuf(Valeur, Valeur),
}
impl Sortie {
    /// `{meme, r}` pour la façade.
    #[must_use]
    pub fn valeur(self) -> Valeur {
        match self {
            Sortie::Meme(c) => objet(vec![("meme", Valeur::Booleen(true)), ("r", objet(c))]),
            Sortie::Neuf(e, a) => objet(vec![("meme", Valeur::Booleen(false)), ("r", objet(vec![("etat", e), ("actions", a)]))]),
        }
    }
}
fn ignore(raison: String) -> Sortie { Sortie::Meme(vec![("actions", Valeur::Tableau(vec![])), ("ignore", Valeur::Chaine(raison))]) }
fn neuf(e: Valeur, actions: Vec<Valeur>) -> Sortie { Sortie::Neuf(e, tableau(actions)) }
fn action(t: &str, champs: Vec<(&str, Valeur)>) -> Valeur { let mut c = vec![("type", ch(t))]; c.extend(champs); objet(c) }

/// `e.partie` (objet exigé) en lecture.
fn partie(e: &Valeur) -> R<&Valeur> {
    let p = lire(e, "partie")?;
    if matches!(p, Valeur::Objet(_)) { Ok(p) } else { hd("partie non objet") }
}
fn partie_mut(e: &mut Valeur) -> R<&mut Valeur> {
    let p = sous(e, "partie")?;
    if matches!(p, Valeur::Objet(_)) { Ok(p) } else { hd("partie non objet") }
}

/// `transition(etat, ev)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn transition(etat: &Valeur, ev: &Valeur) -> R<Sortie> {
    let at = match opt(ev, "at") { Valeur::Chaine(s) => Valeur::Chaine(s.clone()), _ => Valeur::Nul };
    let ty = opt(ev, "type").clone();
    let t = |s: &str| est(&ty, s);
    if t("demarrer") {
        if actif(etat) { return Ok(ignore("file déjà en cours".into())); }
        let plan = match planifier(lire(ev, "selecteur")?, lire(ev, "courante")?, lire(ev, "n")?)? {
            Plan::Refus(r) => return Ok(Sortie::Meme(vec![("actions", Valeur::Tableau(vec![])), ("refus", Valeur::Chaine(r))])),
            Plan::Plan(p) => p,
        };
        let id = lire(ev, "id")?;
        if !matches!(id, Valeur::Chaine(s) if !s.is_empty()) { return Ok(Sortie::Meme(vec![("actions", Valeur::Tableau(vec![])), ("refus", ch("identifiant de file absent"))])); }
        let la = lire(ev, "lotArgs")?;
        let lot_args = if la.vrai() && crate::js::objetal(la) { copie(la)? } else { Valeur::Nul };
        let p0 = plan.first().cloned().unwrap_or(Valeur::Indefini);
        let e = objet(vec![("v", Valeur::Nombre(1.0)), ("id", id.clone()), ("etat", ch("lot")), ("n", lire(ev, "n")?.clone()), ("plan", tableau(plan)), ("k", Valeur::Nombre(0.0)),
            ("debut", at.clone()), ("depuis", at.clone()), ("partie", partie_neuve(p0.clone(), Valeur::Nombre(0.0), &at)), ("bilan", Valeur::Tableau(vec![])),
            ("changement", Valeur::Nul), ("motifFin", Valeur::Nul), ("alerte", Valeur::Nul), ("reprises", Valeur::Nombre(0.0)), ("lotArgs", lot_args)]);
        return Ok(neuf(e, vec![action("demarrer-lot", vec![("part", p0), ("rang", Valeur::Nombre(0.0))])]));
    }
    if t("oublier") {
        return Ok(if terminal(etat) || !etat.vrai() { Sortie::Neuf(Valeur::Nul, Valeur::Tableau(vec![])) } else { ignore("file en cours : arrête-la d’abord".into()) });
    }
    if !actif(etat) { return Ok(ignore("aucune file en cours".into())); }
    let mut e = copie(etat)?;
    let detail = opt(ev, "detail").clone();
    if t("arreter") { arreter(&mut e, "operateur", &at, &Valeur::Nul)?; return Ok(neuf(e, vec![action("arreter-activite", vec![])])); }
    if t("onglet-ferme") { arreter(&mut e, "onglet-ferme", &at, &detail)?; return Ok(neuf(e, vec![action("arreter-activite", vec![])])); }
    if t("suspens") { arreter(&mut e, "ecriture-incertaine", &at, &detail)?; return Ok(neuf(e, vec![])); }
    let hors = |et: &str| -> R<Sortie> { Ok(ignore(format!("événement {} hors de l’état {et}", en_chaine(&ty)?))) };
    let etat_e = match opt(&e, "etat") { Valeur::Chaine(s) => s.clone(), _ => String::new() };
    match etat_e.as_str() {
        "lot" => {
            if t("lot-demarre") {
                if partie(&e)?.champ("lotId").is_some_and(Valeur::vrai) { return Ok(ignore("lot déjà noté".into())); }
                let lot_id = opt(ev, "lotId");
                if !matches!(lot_id, Valeur::Chaine(_)) || !strict(opt(ev, "part"), opt(partie(&e)?, "part"))? { return Ok(ignore("lot d’une autre partie".into())); }
                poser(partie_mut(&mut e)?, "lotId", lot_id.clone())?;
                poser(&mut e, "depuis", at)?;
                return Ok(neuf(e, vec![]));
            }
            if t("lot-refuse") { arreter(&mut e, "lot-non-demarre", &at, &detail)?; return Ok(neuf(e, vec![])); }
            if t("lot-fin") {
                let lid = opt(partie(&e)?, "lotId").clone();
                if !lid.vrai() || !strict(opt(ev, "lotId"), &lid)? { return Ok(ignore("fin d’un autre lot".into())); }
                let issue = texte(opt(ev, "issue"), 60)?;
                let r = opt(ev, "resume");
                let resume = if r.vrai() && crate::js::objetal(r) { copie(r)? } else { Valeur::Nul };
                let p = partie_mut(&mut e)?;
                poser(p, "issueLot", issue)?;
                poser(p, "resume", resume)?;
                let mv = opt(ev, "motif").clone();
                let m = motif_de(&mv)?;
                if m.is_none() || est(&mv, "nombre-atteint") || est(&mv, "passe-arretee") || est(&mv, "relecture-arretee") {
                    arreter(&mut e, "refus-lot", &at, &ch(&format!("motif de fin de lot inconnu : {}", en_chaine(&mv)?)))?;
                    return Ok(neuf(e, vec![]));
                }
                let m = m.ok_or_else(|| ariane_js::Echec::hors_domaine("motif"))?;
                if m.file == "arret" { arreter(&mut e, m.code, &at, &detail)?; return Ok(neuf(e, vec![])); }
                noter(&mut e, &mv, &detail)?;
                poser(&mut e, "etat", ch("passe"))?;
                poser(&mut e, "depuis", at.clone())?;
                if est(&mv, "partie-changee-par-esv") || matches!(opt(ev, "horsPartie"), Valeur::Booleen(true)) {
                    let p = partie_mut(&mut e)?;
                    poser(p, "retourLot", objet(vec![("at", at), ("fait", Valeur::Booleen(false))]))?;
                    let vers = opt(p, "part").clone();
                    return Ok(neuf(e, vec![action("retour-lot", vec![("vers", vers)])]));
                }
                return Ok(neuf(e, vec![]));
            }
            hors("lot")
        }
        "passe" => {
            if t("retour-lot-ok") || t("retour-lot-echec") {
                let rl = opt(partie(&e)?, "retourLot").clone();
                if !rl.vrai() || opt(&rl, "fait").vrai() { return Ok(ignore("aucun retour sur la partie du lot en attente".into())); }
                if !strict(opt(ev, "lotId"), opt(partie(&e)?, "lotId"))? { return Ok(ignore("retour d’un autre lot".into())); }
                if t("retour-lot-echec") { arreter(&mut e, "retour-impossible", &at, &detail)?; return Ok(neuf(e, vec![])); }
                let rl = sous(partie_mut(&mut e)?, "retourLot")?;
                poser(rl, "fait", Valeur::Booleen(true))?;
                poser(rl, "revenuA", at.clone())?;
                poser(&mut e, "depuis", at)?;
                return Ok(neuf(e, vec![]));
            }
            if !t("passe-fin") { return hors("passe"); }
            let rl = opt(partie(&e)?, "retourLot").clone();
            if rl.vrai() && !lire(&rl, "fait")?.vrai() { return Ok(ignore("retour sur la partie du lot en attente".into())); }
            if !strict(opt(ev, "lotId"), opt(partie(&e)?, "lotId"))? { return Ok(ignore("fin de passe d’un autre lot".into())); }
            let passe = objet(vec![("issue", texte(opt(ev, "issue"), 40)?), ("ecrits", entier8(opt(ev, "ecrits")))]);
            poser(partie_mut(&mut e)?, "passe", passe)?;
            if opt(ev, "ecritureEnSuspens").vrai() { arreter(&mut e, "ecriture-incertaine", &at, &detail)?; return Ok(neuf(e, vec![])); }
            if est(opt(ev, "issue"), "arretee") || est(opt(ev, "issue"), "erreur") { noter(&mut e, &ch("passe-arretee"), &detail)?; }
            poser(&mut e, "etat", ch("relecture"))?;
            poser(&mut e, "depuis", at)?;
            Ok(neuf(e, vec![]))
        }
        "relecture" => {
            if !t("relecture-fin") { return hors("relecture"); }
            if !strict(opt(ev, "lotId"), opt(partie(&e)?, "lotId"))? { return Ok(ignore("fin de relecture d’un autre lot".into())); }
            let issue = opt(ev, "issue").clone();
            let rel = objet(vec![("issue", texte(&issue, 40)?), ("corriges", entier8(opt(ev, "corriges"))), ("faits", entier8(opt(ev, "faits"))), ("mode", texte(opt(ev, "mode"), 20)?)]);
            poser(partie_mut(&mut e)?, "relecture", rel)?;
            if opt(ev, "ecritureEnSuspens").vrai() { arreter(&mut e, "ecriture-incertaine", &at, &detail)?; return Ok(neuf(e, vec![])); }
            if est(&issue, "non-lancee") && matches!(opt(ev, "horsPartie"), Valeur::Booleen(true)) && !opt(partie(&e)?, "retourRelecture").vrai() {
                let p = partie_mut(&mut e)?;
                let vers = opt(p, "part").clone();
                poser(p, "retourRelecture", objet(vec![("at", at.clone()), ("vers", vers.clone())]))?;
                poser(p, "relecture", Valeur::Nul)?;
                poser(&mut e, "depuis", at)?;
                return Ok(neuf(e, vec![action("retour-partie", vec![("vers", vers)])]));
            }
            if !est(&issue, "finie") {
                let d = if detail.vrai() { detail.clone() } else { ch(&format!("relecture {}", en_chaine(&issue)?)) };
                noter(&mut e, &ch("relecture-arretee"), &d)?;
            }
            let bilan = lire(&e, "bilan")?.clone();
            let mut p = partie(&e)?.clone();
            poser(&mut p, "fin", at.clone())?;
            let al = alertes(&p, &bilan)?;
            poser(&mut p, "alertes", al)?;
            pousser(sous(&mut e, "bilan")?, p)?;
            poser(&mut e, "partie", Valeur::Nul)?;
            let k = lire(&e, "k")?.clone();
            let Valeur::Nombre(kn) = k else { return hd("k non numérique") };
            let Some(lp) = longueur(lire(&e, "plan")?) else { return hd("plan non tableau") };
            if kn + 1.0 >= lp as f64 {
                arreter(&mut e, "nombre-atteint", &at, &Valeur::Nul)?;
                return Ok(neuf(e, vec![action("registre", vec![("rang", k)])]));
            }
            let vers = a_l_indice(opt(&e, "plan"), kn + 1.0);
            poser(&mut e, "etat", ch("changement"))?;
            poser(&mut e, "changement", objet(vec![("vers", vers.clone()), ("tentatives", Valeur::Nombre(0.0)), ("envoyeA", Valeur::Nul)]))?;
            poser(&mut e, "depuis", at)?;
            Ok(neuf(e, vec![action("registre", vec![("rang", k)]), action("changer-partie", vec![("vers", vers)])]))
        }
        "changement" => {
            if t("changement-envoye") {
                let ch_ = lire(&e, "changement")?.clone();
                if !strict(opt(ev, "vers"), lire(&ch_, "vers")?)? { return Ok(ignore("autre partie".into())); }
                let (_, n) = incrementer(opt(&ch_, "tentatives"))?;
                let c = sous(&mut e, "changement")?;
                poser(c, "tentatives", Valeur::Nombre(n))?;
                poser(c, "envoyeA", at)?;
                return Ok(neuf(e, vec![]));
            }
            if t("changement-ok") {
                if !strict(opt(ev, "part"), lire(lire(&e, "changement")?, "vers")?)? { return Ok(ignore("partie atteinte différente de la partie demandée".into())); }
                let (_, k) = incrementer(opt(&e, "k"))?;
                poser(&mut e, "k", Valeur::Nombre(k))?;
                poser(&mut e, "etat", ch("lot"))?;
                poser(&mut e, "changement", Valeur::Nul)?;
                let plan = lire(&e, "plan")?;
                if longueur(plan).is_none() { return hd("plan non tableau"); }
                let part = a_l_indice(plan, k);
                poser(&mut e, "partie", partie_neuve(part.clone(), Valeur::Nombre(k), &at))?;
                poser(&mut e, "depuis", at)?;
                return Ok(neuf(e, vec![action("demarrer-lot", vec![("part", part), ("rang", Valeur::Nombre(k))])]));
            }
            if t("changement-echec") {
                let mv = opt(ev, "motif");
                let code = match mv { Valeur::Chaine(s) if ["commande-absente", "esv-muet", "onglet-ferme", "selecteur-illisible"].contains(&s.as_str()) => s.clone(), _ => "changement-impossible".into() };
                arreter(&mut e, &code, &at, &detail)?;
                return Ok(neuf(e, vec![]));
            }
            hors("changement")
        }
        _ => Ok(ignore("état inconnu".into())),
    }
}

/// `reprise(etat, constat = {})`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn reprise(etat: &Valeur, constat: &Valeur) -> R<Sortie> {
    let vide = objet(vec![]);
    let constat = if matches!(constat, Valeur::Indefini) { &vide } else { constat };
    let at = crate::js::ou_nul(crate::js::lire_at(constat)?);
    if !actif(etat) { return Ok(Sortie::Meme(vec![("actions", Valeur::Tableau(vec![]))])); }
    let mut e = copie(etat)?;
    let r = plus_un_ou(opt(&e, "reprises"))?;
    poser(&mut e, "reprises", Valeur::Nombre(r))?;
    if matches!(opt(constat, "ongletPresent"), Valeur::Booleen(false)) {
        arreter(&mut e, "onglet-ferme", &at, &ch("onglet absent au redémarrage du service worker"))?;
        return Ok(neuf(e, vec![]));
    }
    let et = opt(&e, "etat").clone();
    let en_attente = est(&et, "lot") && !lire(partie(&e)?, "lotId")?.vrai() || est(&et, "changement");
    if en_attente && opt(constat, "ecritureEnSuspens").vrai() {
        let d = opt(constat, "detailSuspens");
        let d = if d.vrai() { d.clone() } else { ch("écriture en suspens au redémarrage") };
        arreter(&mut e, "ecriture-incertaine", &at, &d)?;
        return Ok(neuf(e, vec![]));
    }
    if est(&et, "lot") && !opt(partie(&e)?, "lotId").vrai() {
        let l = opt(constat, "lotFile").clone();
        let p = partie(&e)?;
        if l.vrai() && opt(&l, "id").vrai() && strict(opt(&l, "rang"), opt(&e, "k"))? && strict(opt(&l, "part"), opt(p, "part"))? {
            poser(partie_mut(&mut e)?, "lotId", opt(&l, "id").clone())?;
            return Ok(neuf(e, vec![]));
        }
        let a = action("demarrer-lot", vec![("part", opt(p, "part").clone()), ("rang", opt(&e, "k").clone())]);
        return Ok(neuf(e, vec![a]));
    }
    if est(&et, "passe") {
        let rl = opt(partie(&e)?, "retourLot");
        if rl.vrai() && !opt(rl, "fait").vrai() {
            let a = action("retour-lot", vec![("vers", opt(partie(&e)?, "part").clone())]);
            return Ok(neuf(e, vec![a]));
        }
    }
    if est(&et, "changement") {
        let c = lire(&e, "changement")?.clone();
        let vers = lire(&c, "vers")?.clone();
        if strict(opt(constat, "partieAffichee"), &vers)? {
            let ev = objet(vec![("type", ch("changement-ok")), ("part", vers), ("at", at)]);
            return transition(&e, &ev);
        }
        let tent = opt(&c, "tentatives");
        if nombre(tent)? >= TENTATIVES_MAX {
            let d = format!("partie {} non atteinte après {} tentatives", en_chaine(&vers)?, en_chaine(tent)?);
            arreter(&mut e, "changement-impossible", &at, &ch(&d))?;
            return Ok(neuf(e, vec![]));
        }
        return Ok(neuf(e, vec![action("changer-partie", vec![("vers", vers)])]));
    }
    Ok(neuf(e, vec![]))
}

const CLOS: [&str; 4] = ["STOPPED", "COMPLETED", "FINISHED_WITH_UNCONFIRMED_ACTIONS", "ERROR"];
/// `classerLot(l)`.
#[must_use]
pub fn classer_lot(l: &Valeur) -> Valeur {
    let et = opt(l, "etat");
    if !l.vrai() || !matches!(et, Valeur::Chaine(s) if CLOS.contains(&s.as_str())) { return Valeur::Nul; }
    if opt(l, "ecritureEnSuspens").vrai() || est(et, "FINISHED_WITH_UNCONFIRMED_ACTIONS") { return ch("ecriture-incertaine"); }
    if est(et, "COMPLETED") { return ch("fin-normale"); }
    if est(et, "ERROR") { return ch("refus-lot"); }
    let s = opt(l, "stoppedAtEnd");
    let (issue, raison) = (opt(s, "issue"), opt(s, "reason"));
    if est(issue, "partie-sans-rouge") || est(raison, "partie-sans-rouge") { return ch("partie-sans-rouge"); }
    if est(issue, "depart-sur-vert") || est(raison, "depart-sur-vert") { return ch("depart-sur-vert"); }
    if est(raison, "partie-changee-par-esv") { return ch("partie-changee-par-esv"); }
    if s.vrai() { return ch("fin-normale"); }
    ch(if opt(l, "arretOperateur").vrai() { "operateur" } else { "refus-lot" })
}

/// `entreeRegistre(x)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn entree_registre(x: &Valeur) -> R<Valeur> {
    let c = opt(x, "corriges");
    let corr: Vec<Valeur> = match elements(c) {
        Some(t) => t.into_iter().flatten().filter(|c| !matches!(entier8(opt(c, "cut")), Valeur::Nul)).take(MAX_LISTE).map(|c| {
            let e = opt(&c, "ecartMm");
            let ecart = match e { Valeur::Nombre(v) if v.is_finite() => Valeur::Nombre(ariane_js::round(v * 10.0) / 10.0), _ => Valeur::Nul };
            objet(vec![("cut", opt(&c, "cut").clone()), ("ecartMm", ecart)])
        }).collect(),
        None => vec![],
    };
    Ok(objet(vec![("fileId", texte(opt(x, "fileId"), 80)?), ("part", entier(opt(x, "part"), 1e7)), ("rang", entier(opt(x, "rang"), MAX_PARTIES)), ("lotId", texte(opt(x, "lotId"), 80)?),
        ("at", texte(opt(x, "at"), 40)?), ("poses", cuts(opt(x, "poses"))), ("passe", cuts(opt(x, "passe"))), ("corriges", tableau(corr)), ("valides", cuts(opt(x, "valides")))]))
}

/// `registreAjouter(registre, x)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn registre_ajouter(registre: &Valeur, x: &Valeur) -> R<Valeur> {
    let mut l: Vec<Valeur> = match elements(registre) { Some(t) => t.into_iter().flatten().filter(crate::js::objetal).collect(), None => vec![] };
    let n = entree_registre(x)?;
    let mut i = None;
    for (j, r) in l.iter().enumerate() {
        if strict(opt(r, "fileId"), opt(&n, "fileId"))? && strict(opt(r, "rang"), opt(&n, "rang"))? && strict(opt(r, "lotId"), opt(&n, "lotId"))? { i = Some(j); break; }
    }
    match i { Some(j) => { if let Some(s) = l.get_mut(j) { *s = n; } } None => l.push(n) }
    let debut = l.len().saturating_sub(MAX_REGISTRE);
    Ok(tableau(l.split_off(debut)))
}

/// `alertes(partie, precedents = [], seuils = SEUILS)` (seuils par défaut si `seuils` est `undefined`).
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn alertes_avec(partie: &Valeur, precedents: &Valeur, seuils: &Valeur) -> R<Valeur> {
    let (sd, sc, sr) = if matches!(seuils, Valeur::Indefini) { (SEUIL_DIFFERES, SEUIL_CORRIGES, SEUIL_REFUS) } else {
        let f = |k: &str| -> R<f64> { match lire(seuils, k)? { Valeur::Nombre(x) => Ok(*x), Valeur::Indefini => Ok(f64::NAN), _ => hd("seuil non numérique") } };
        if !matches!(seuils, Valeur::Objet(_)) { return hd("seuils non objet"); }
        (f("differesFoisMediane")?, f("corrigesPart")?, f("refus")?)
    };
    let vide = objet(vec![]);
    let precedents = if matches!(precedents, Valeur::Indefini) { Valeur::Tableau(vec![]) } else { precedents.clone() };
    let resume_de = |p: &Valeur| -> Valeur { let r = opt(p, "resume"); if r.vrai() { r.clone() } else { vide.clone() } };
    let r = resume_de(partie);
    let traites = entier8(opt(&r, "traites"));
    let tn = n_de(&traites);
    // part(q) = traites ? q / traites : null ; null comparé vaut 0
    let part = |q: f64| -> f64 { match tn { Some(t) if t != 0.0 => q / t, _ => 0.0 } };
    let dif_de = |s: &Valeur| -> Option<f64> {
        let d = n_de(&entier8(opt(s, "differes")))?;
        let ep = n_de(&entier8(opt(s, "ecritsPasse"))).filter(|x| *x != 0.0).unwrap_or(0.0);
        Some(ariane_js::max(0.0, d - ep))
    };
    let dif = dif_de(&r);
    let Some(prec) = elements(&precedents) else { return hd("precedents non tableau") };
    let mut ratios = vec![];
    for p in prec.into_iter().flatten() {
        let s = resume_de(&p);
        // `t && entier(s.differes) !== null ? … / t : null` : t nul (0 ou −0) rend t lui-même, gardé par le filtre
        match n_de(&entier8(opt(&s, "traites"))) {
            Some(t) if t == 0.0 => ratios.push(t),
            Some(t) => { if let Some(d) = dif_de(&s) { ratios.push(d / t); } }
            None => {}
        }
    }
    ariane_js::trier_nombres(&mut ratios);
    let n = ratios.len();
    #[allow(clippy::manual_midpoint)] // (a + b) / 2 du JS, au bit près
    let med = if n == 0 { None } else if n % 2 == 1 { ratios.get((n - 1) / 2).copied() } else { Some((ratios.get(n / 2 - 1).copied().unwrap_or(f64::NAN) + ratios.get(n / 2).copied().unwrap_or(f64::NAN)) / 2.0) };
    let mut out = vec![];
    if let (Some(d), Some(m)) = (dif, med) {
        if m > 0.0 && part(d) > sd * m {
            out.push(objet(vec![("code", ch("differes")), ("texte", Valeur::Chaine(format!("différés : {} sur {}, plus de {} fois la médiane des parties précédentes", nombre_en_chaine(d), en_chaine(&traites)?, nombre_en_chaine(sd))))]));
        }
    }
    let rel = opt(partie, "relecture");
    let (corr, relus) = (entier8(opt(rel, "corriges")), entier8(opt(rel, "faits")));
    if let (Some(c), Some(rl)) = (n_de(&corr), n_de(&relus).filter(|x| *x != 0.0)) {
        if c / rl > sc {
            out.push(objet(vec![("code", ch("corriges")), ("texte", Valeur::Chaine(format!("cuts corrigés par la relecture : {} sur {} relus, plus de {} %", nombre_en_chaine(c), nombre_en_chaine(rl), nombre_en_chaine(ariane_js::round(sc * 100.0)))))]));
        }
    }
    if let Some(rf) = n_de(&entier8(opt(&r, "refus"))) {
        if rf >= sr { out.push(objet(vec![("code", ch("refus")), ("texte", Valeur::Chaine(format!("{} refus de la page", nombre_en_chaine(rf))))])); }
    }
    Ok(tableau(out))
}
fn alertes(partie: &Valeur, precedents: &Valeur) -> R<Valeur> { alertes_avec(partie, precedents, &Valeur::Indefini) }

/// `completerBilan(e, {lotId, passe = null, relecture = null} = {})`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn completer_bilan(e: &Valeur, o: &Valeur) -> R<Valeur> {
    let vide = objet(vec![]);
    let o = match o { Valeur::Indefini => &vide, Valeur::Nul => return hd("déstructuration de null"), x => x };
    let lot_id = opt(o, "lotId");
    let defaut = |v: &Valeur| if matches!(v, Valeur::Indefini) { Valeur::Nul } else { v.clone() };
    let (passe, relecture) = (defaut(opt(o, "passe")), defaut(opt(o, "relecture")));
    if !e.vrai() || !est(opt(e, "etat"), "arret") { return Ok(Valeur::Nul); }
    let Some(lb) = longueur(lire(e, "bilan")?) else { return hd("bilan non tableau") };
    if lb == 0 || !matches!(lot_id, Valeur::Chaine(_)) { return Ok(Valeur::Nul); }
    let p = a_l_indice(opt(e, "bilan"), (lb - 1) as f64);
    if !strict(lire(&p, "lotId")?, lot_id)? { return Ok(Valeur::Nul); }
    let mut n = copie(e)?;
    let mut change = false;
    let b = sous(&mut n, "bilan")?;
    let Valeur::Tableau(t) = b else { return hd("bilan") };
    let Some(Some(q)) = t.last_mut() else { return hd("bilan vide") };
    if !opt(q, "passe").vrai() && passe.vrai() && matches!(opt(&passe, "issue"), Valeur::Chaine(_)) {
        poser(q, "passe", objet(vec![("issue", texte(opt(&passe, "issue"), 40)?), ("ecrits", entier8(opt(&passe, "ecrits")))]))?;
        change = true;
    }
    if !opt(q, "relecture").vrai() && relecture.vrai() && matches!(opt(&relecture, "issue"), Valeur::Chaine(_)) {
        let r = &relecture;
        poser(q, "relecture", objet(vec![("issue", texte(opt(r, "issue"), 40)?), ("corriges", entier8(opt(r, "corriges"))), ("faits", entier8(opt(r, "faits"))), ("mode", texte(opt(r, "mode"), 20)?), ("apresArret", Valeur::Booleen(true))]))?;
        change = true;
    }
    Ok(if change { n } else { Valeur::Nul })
}

/// `repriseDe(e)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn reprise_de(e: &Valeur) -> R<Valeur> {
    if !e.vrai() || !est(opt(e, "etat"), "arret") { return Ok(Valeur::Nul); }
    let Some(b) = elements(lire(e, "bilan")?) else { return hd("bilan non tableau") };
    let mut faites = 0usize;
    for p in b.into_iter().flatten() { if !lire(&p, "interrompue")?.vrai() { faites += 1; } }
    let plan = lire(e, "plan")?;
    let Some(lp) = longueur(plan) else { return hd("plan non tableau") };
    if faites >= lp { return Ok(Valeur::Nul); }
    Ok(objet(vec![("rang", Valeur::Nombre(faites as f64)), ("part", a_l_indice(plan, faites as f64)), ("reste", Valeur::Nombre((lp - faites) as f64))]))
}

/// `vue(e)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn vue(e: &Valeur) -> R<Valeur> {
    if !e.vrai() { return Ok(Valeur::Nul); }
    let plan = lire(e, "plan")?;
    let Some(pl) = elements(plan) else { return hd("plan non tableau") };
    let p = lire(e, "partie")?;
    let en_cours = if p.vrai() {
        let mut c = vec![("part", lire(p, "part")?.clone()), ("rang", opt(p, "rang").clone()), ("lot", Valeur::Booleen(opt(p, "lotId").vrai()))];
        let rl = opt(p, "retourLot");
        if rl.vrai() && !opt(rl, "fait").vrai() { c.push(("retour", Valeur::Booleen(true))); }
        objet(c)
    } else { Valeur::Nul };
    let c = lire(e, "changement")?;
    let changement = if c.vrai() { objet(vec![("vers", opt(c, "vers").clone()), ("tentatives", opt(c, "tentatives").clone())]) } else { Valeur::Nul };
    let Some(b) = elements(lire(e, "bilan")?) else { return hd("bilan non tableau") };
    let mut bilan = Vec::with_capacity(b.len());
    for x in b {
        let Some(p) = x else { bilan.push(None); continue };
        let Some(m) = elements(lire(&p, "motifs")?) else { return hd("motifs non tableau") };
        let mut motifs = Vec::with_capacity(m.len());
        for y in m { motifs.push(match y { None => None, Some(z) => Some(lire(&z, "code")?.clone()) }); }
        let al = opt(&p, "alertes");
        let mut o = vec![("part", opt(&p, "part").clone()), ("rang", opt(&p, "rang").clone()), ("issueLot", opt(&p, "issueLot").clone()), ("motifs", Valeur::Tableau(motifs)),
            ("resume", opt(&p, "resume").clone()), ("passe", opt(&p, "passe").clone()), ("relecture", opt(&p, "relecture").clone()), ("alertes", if al.vrai() { al.clone() } else { Valeur::Tableau(vec![]) })];
        if opt(&p, "interrompue").vrai() { o.push(("interrompue", Valeur::Booleen(true))); }
        bilan.push(Some(objet(o)));
    }
    let rep = opt(e, "reprises");
    Ok(objet(vec![("id", opt(e, "id").clone()), ("etat", opt(e, "etat").clone()), ("n", opt(e, "n").clone()), ("plan", Valeur::Tableau(pl)), ("rang", opt(e, "k").clone()), ("enCours", en_cours),
        ("changement", changement), ("bilan", Valeur::Tableau(bilan)), ("motifFin", opt(e, "motifFin").clone()), ("alerte", opt(e, "alerte").clone()),
        ("reprises", if rep.vrai() { rep.clone() } else { Valeur::Nombre(0.0) }), ("reprise", reprise_de(e)?)]))
}

#[cfg(test)]
mod essais {
    use super::*;
    use crate::js::tableau;
    fn sel(parts: &[f64]) -> Valeur { objet(vec![("status", ch("ok")), ("parts", tableau(parts.iter().map(|p| objet(vec![("part", Valeur::Nombre(*p))])).collect()))]) }
    fn demarre() -> Valeur {
        let ev = objet(vec![("type", ch("demarrer")), ("selecteur", sel(&[3.0, 4.0])), ("courante", Valeur::Nombre(3.0)), ("n", Valeur::Nombre(2.0)), ("id", ch("f1")), ("at", ch("t0"))]);
        let Sortie::Neuf(e, _) = transition(&Valeur::Nul, &ev).unwrap() else { panic!() };
        e
    }
    #[test]
    fn planifier_refus_et_plan() {
        assert!(matches!(planifier(&sel(&[3.0]), &Valeur::Nombre(3.0), &Valeur::Nombre(2.0)).unwrap(), Plan::Refus(s) if s.contains("n’offre que 1 partie à partir")));
        assert!(matches!(planifier(&sel(&[3.0, 4.0]), &Valeur::Nombre(3.0), &Valeur::Nombre(2.0)).unwrap(), Plan::Plan(p) if p.len() == 2));
        assert!(matches!(planifier(&Valeur::Nul, &Valeur::Nombre(3.0), &Valeur::Nombre(25.0)).unwrap(), Plan::Refus(_)));
    }
    #[test]
    fn transition_et_reprise() {
        let e = demarre();
        assert!(actif(&e) && !terminal(&e));
        let Sortie::Neuf(e2, _) = transition(&e, &objet(vec![("type", ch("arreter")), ("at", ch("t1"))])).unwrap() else { panic!() };
        assert!(terminal(&e2));
        assert!(matches!(transition(&e, &objet(vec![("type", ch("x"))])).unwrap(), Sortie::Meme(_)));
        assert!(matches!(reprise(&e, &Valeur::Indefini).unwrap(), Sortie::Neuf(_, a) if longueur(&a) == Some(1)));
        assert!(reprise(&e, &Valeur::Nul).is_err());
        assert!(matches!(reprise_de(&e2).unwrap(), Valeur::Objet(_)));
        assert!(matches!(vue(&e2).unwrap(), Valeur::Objet(_)));
        assert_eq!(relire(&e2).unwrap(), copie(&e2).unwrap());
        assert_eq!(completer_bilan(&e2, &Valeur::Indefini).unwrap(), Valeur::Nul);
    }
    #[test]
    fn registre_classement_alertes() {
        assert_eq!(classer_lot(&objet(vec![("etat", ch("COMPLETED"))])), ch("fin-normale"));
        let x = objet(vec![("fileId", ch("f")), ("poses", Valeur::Nombres(vec![3.0, 1.0, 3.0, -1.0]))]);
        let e = entree_registre(&x).unwrap();
        assert_eq!(opt(&e, "poses"), &tableau(vec![Valeur::Nombre(1.0), Valeur::Nombre(3.0)]));
        let r = registre_ajouter(&tableau(vec![e.clone()]), &x).unwrap();
        assert_eq!(longueur(&r), Some(1));
        let p = objet(vec![("resume", objet(vec![("refus", Valeur::Nombre(2.0))]))]);
        assert_eq!(longueur(&alertes_avec(&p, &Valeur::Indefini, &Valeur::Indefini).unwrap()), Some(1));
    }
}
