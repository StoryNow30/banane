//! État, journal et listes d'Ariane, portés de JavaScript (CH-064-E).
//! Entrée et sortie : valeurs VBA. Le cœur appelle `appeler` pour les fonctions 100 à 149.
//! Le champ `f` choisit la fonction ; le numéro sert au routage du cœur.
//! Le port suit le JavaScript : une longueur de tableau devient un `f64` (`array.length`),
//! les comparaisons de nombres sont `===`, et les noms courts sont ceux du source.
#![allow(
    clippy::too_many_arguments,
    clippy::manual_range_contains,
    clippy::if_same_then_else,
    clippy::needless_borrow,
    clippy::collapsible_if,
    clippy::ptr_arg,
    clippy::needless_range_loop,
    clippy::type_complexity,
    clippy::neg_cmp_op_on_partial_ord,
    clippy::double_ended_iterator_last,
    clippy::map_entry,
    clippy::manual_filter,
    clippy::else_if_without_else,
    clippy::cast_precision_loss,
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::cast_possible_wrap,
    clippy::cast_lossless,
    clippy::many_single_char_names,
    clippy::similar_names,
    clippy::float_cmp,
    dead_code,
    unused
)]
mod date;
mod dataset;
mod etat;
mod journal;
mod json;
mod jsval;
mod liste;
mod nombre;
mod verts;

use ariane_js::Echec;
use ariane_vba::Valeur;
use jsval::{a, chaine};

pub(crate) use date::{parse_iso, vers_iso};
pub(crate) use nombre::json_nombre;

/// Lit un texte JSON. Seul le binaire de mesure s'en sert : le cœur reçoit du VBA.
#[must_use]
pub fn parse_json(texte: &str) -> Option<Valeur> { json::parse(texte) }

/// Point d'entrée du cœur (fonctions 100 à 149). `entree.f` choisit la fonction.
///
/// # Errors
/// `Echec::Js` reprend l'exception du JavaScript. `Echec::HorsDomaine` quand l'entrée sort de ce que le port sait reproduire.
pub fn appeler(_fonction: u32, entree: &Valeur) -> Result<Valeur, Echec> {
    let f = chaine(a(entree, "f")).unwrap_or("");
    match f {
        "decouper" => etat::decouper(a(entree, "etat"), a(entree, "connus")),
        "clesARelire" => Ok(etat::cles_a_relire(a(entree, "etat"))),
        "recoller" => Ok(etat::recoller(a(entree, "etat"), a(entree, "lus"))),
        "journal" => Ok(journal::indexer(entree)),
        "journalAppliquer" => Ok(journal::appliquer(entree)),
        "clesNatif" => journal::cles_natif(entree),
        "clesParType" => journal::cles_par_type(entree),
        "correction" => Ok(verts_ou(correction::construire(a(entree, "events"), a(entree, "options")))),
        "couverture" => Ok(correction::couverture(a(entree, "events"), a(entree, "options"))),
        "statut" => Ok(correction::statut_de(a(entree, "entree"), a(entree, "visites"))),
        "visites" => Ok(correction::visites_fusionnees(a(entree, "visites"), a(entree, "options"))),
        "apprenabilite" => Ok(correction::apprenabilite(a(entree, "rec"))),
        "bilan" => Ok(correction::bilan(a(entree, "entrees"), a(entree, "visites"), a(entree, "enregistrements"))),
        "parcours" => Ok(correction::parcours(a(entree, "listes"), a(entree, "options"))),
        "listeCompacter" => Ok(liste::compacter(a(entree, "t"), a(entree, "meta"))),
        "listeDecompacter" => Ok(liste::decompacter(a(entree, "snap"))),
        "listeAjouter" => Ok(liste::ajouter(a(entree, "mem"), a(entree, "partie"), a(entree, "cle"), a(entree, "cut"), a(entree, "bords"), a(entree, "at"), a(entree, "version"))),
        "listeComparer" => Ok(liste::comparer(a(entree, "p"), a(entree, "dec"), a(entree, "at"))),
        "listeBords" => Ok(liste::bords_corps(a(entree, "body"))),
        "listeChoisir" => Ok(liste::choisir_table(a(entree, "tables"), a(entree, "obs"))),
        "listeEmpreinte" => Ok(jsval::s(liste::empreinte(chaine(a(entree, "s")).unwrap_or("")))),
        "listeNom" => Ok(jsval::s(liste::nom_fichier(a(entree, "partie"), a(entree, "at")))),
        "listeTexte" => Ok(jsval::s(liste::texte_resume(a(entree, "r"), a(entree, "snap"), a(entree, "heure")))),
        "listeActif" => Ok(jsval::b(liste::actif(a(entree, "reglage")))),
        "vertsListe" => Ok(verts::liste(a(entree, "entree"), a(entree, "options"))),
        "vertsSignaux" => Ok(verts::signaux_valeur(a(entree, "entree"), a(entree, "options"))),
        "vertsDuree" => Ok(jsval::s(verts::duree(a(entree, "s")))),
        "vertsLignes" => Ok(verts::lignes_instantane(a(entree, "dec"))),
        "vertsCompacter" => Ok(jsval::s(verts::compacter_cuts(&nombres(a(entree, "cuts"))))),
        "dataset" => dataset::assembler(entree),
        _ => Err(Echec::erreur(format!("État : fonction inconnue {f}"))),
    }
}
fn verts_ou(v: Valeur) -> Valeur { v }
fn nombres(v: &Valeur) -> Vec<f64> {
    match v {
        Valeur::Nombres(t) => t.clone(),
        Valeur::Tableau(t) => t.iter().filter_map(|e| e.as_ref().and_then(jsval::nombre)).collect(),
        _ => vec![],
    }
}

pub mod abi;

mod correction;

#[cfg(test)]
mod essais_publics {
    use super::*;
    use ariane_vba::Valeur;

    fn appel(f: &str, champs: Vec<(&str, Valeur)>) -> Valeur {
        let mut p = vec![("f".into(), Valeur::Chaine(f.into()))];
        p.extend(champs.into_iter().map(|(k, v)| (k.to_string(), v)));
        appeler(100, &Valeur::Objet(p)).unwrap_or_else(|e| panic!("{f} : {e:?}"))
    }
    fn n(x: f64) -> Valeur { Valeur::Nombre(x) }
    fn s(t: &str) -> Valeur { Valeur::Chaine(t.into()) }

    #[test]
    fn etat_decouper_relire_recoller() {
        assert_eq!(etat::cle_morceau("native", "visits", "s", 0), "banane3Morceau|native|visits|s|0");
        let etat = Valeur::Objet(vec![("native".into(), Valeur::Objet(vec![
            ("id".into(), s("sess")),
            ("visits".into(), Valeur::Tableau(vec![Some(Valeur::Objet(vec![("a".into(), n(1.0))]))])),
        ]))]);
        let d = appel("decouper", vec![("etat", etat), ("connus", Valeur::Nul)]);
        let cles = appel("clesARelire", vec![("etat", d.champ("etat").unwrap().clone())]);
        let Valeur::Tableau(c) = cles else { panic!("clés") };
        assert_eq!(c.len(), 1);
        let r = appel("recoller", vec![("etat", d.champ("etat").unwrap().clone()), ("lus", d.champ("morceaux").unwrap().clone())]);
        assert!(r.champ("etat").is_some());
    }

    #[test]
    fn journal_index_et_requetes() {
        let ev = Valeur::Tableau(vec![Some(Valeur::Objet(vec![
            ("eventId".into(), s("b")), ("type".into(), s("batch-started")), ("nativeSessionId".into(), s("s")),
        ]))]);
        let types = Valeur::Tableau(vec![Some(s("batch-started"))]);
        let ix = appel("journal", vec![("events", ev), ("records", Valeur::Tableau(vec![])), ("types", types.clone())]);
        assert!(ix.champ("parType").is_some());
        let ops = Valeur::Tableau(vec![Some(Valeur::Objet(vec![
            ("op".into(), s("putEvent")),
            ("e".into(), Valeur::Objet(vec![("eventId".into(), s("c")), ("type".into(), s("batch-started")), ("nativeSessionId".into(), s("s"))])),
        ]))]);
        let ap = appel("journalAppliquer", vec![("events", Valeur::Tableau(vec![])), ("records", Valeur::Tableau(vec![])), ("types", types), ("ops", ops)]);
        assert!(ap.champ("totaux").is_some());
        let cn = appel("clesNatif", vec![("events", Valeur::Tableau(vec![])), ("records", Valeur::Tableau(vec![])), ("types", Valeur::Tableau(vec![])), ("sid", s("s"))]);
        assert!(cn.champ("events").is_some());
        let err = appeler(100, &Valeur::Objet(vec![
            ("f".into(), s("clesParType")),
            ("types".into(), Valeur::Tableau(vec![Some(s("batch-started"))])),
            ("demandes".into(), Valeur::Tableau(vec![Some(s("inconnu"))])),
            ("events".into(), Valeur::Tableau(vec![])),
            ("records".into(), Valeur::Tableau(vec![])),
        ]));
        assert!(err.is_err());
    }

    #[test]
    fn correction_construire_statut_bilan_parcours_couverture() {
        let events = Valeur::Tableau(vec![
            Some(Valeur::Objet(vec![
                ("type".into(), s("batch-started")), ("timestamp".into(), s("2026-11-06T10:00:00.000Z")),
                ("batch".into(), Valeur::Objet(vec![("id".into(), s("B"))])),
                ("identity".into(), Valeur::Objet(vec![("part".into(), n(7.0)), ("cut".into(), n(20.0))])),
            ])),
            Some(Valeur::Objet(vec![
                ("type".into(), s("gcv1-shadow-observed")), ("timestamp".into(), s("2026-11-06T10:00:01.000Z")),
                ("batchId".into(), s("B")),
                ("identity".into(), Valeur::Objet(vec![("part".into(), n(7.0)), ("cut".into(), n(20.0))])),
                ("lotObservation".into(), Valeur::Objet(vec![("command".into(), Valeur::Objet(vec![("action".into(), s("lot"))])), ("anchorsUsed".into(), Valeur::Tableau(vec![]))])),
            ])),
        ]);
        let opt = Valeur::Objet(vec![("partie".into(), n(7.0)), ("population".into(), Valeur::Booleen(true))]);
        let liste = appel("correction", vec![("events", events.clone()), ("options", opt.clone())]);
        let entrees = liste.champ("entrees").cloned().unwrap_or(Valeur::Tableau(vec![]));
        let visites = Valeur::Tableau(vec![Some(Valeur::Objet(vec![
            ("visitId".into(), s("v")), ("label".into(), s("VALIDATE_NO_MOVEMENT")), ("endedAt".into(), s("2026-11-06T10:01:00.000Z")),
            ("identity".into(), Valeur::Objet(vec![("part".into(), n(7.0)), ("cut".into(), n(20.0))])),
        ]))]);
        let entree = match &entrees { Valeur::Tableau(t) => t.first().cloned().flatten().unwrap_or(Valeur::Nul), _ => Valeur::Nul };
        let _ = appel("statut", vec![("entree", entree.clone()), ("visites", visites.clone())]);
        let _ = appel("visites", vec![("visites", visites.clone()), ("options", Valeur::Objet(vec![("echoOuvert".into(), Valeur::Booleen(false))]))]);
        let _ = appel("apprenabilite", vec![("rec", Valeur::Nul)]);
        let _ = appel("bilan", vec![("entrees", entrees.clone()), ("visites", visites), ("enregistrements", Valeur::Nul)]);
        let lignes = appel("bilan", vec![("entrees", entrees), ("visites", Valeur::Tableau(vec![])), ("enregistrements", Valeur::Nul)]);
        let _ = appel("parcours", vec![("listes", Valeur::Tableau(vec![Some(Valeur::Objet(vec![("lignes".into(), lignes.champ("lignes").unwrap().clone())]))])), ("options", Valeur::Objet(vec![("partieAffichee".into(), n(7.0))]))]);
        let _ = appel("couverture", vec![("events", events), ("options", Valeur::Objet(vec![]))]);
    }

    #[test]
    fn liste_fonctions() {
        let t = Valeur::Objet(vec![
            ("st".into(), Valeur::Nombres(vec![0.0, 1.0])),
            ("fl".into(), Valeur::Nombres(vec![1.0, 0.0])),
            ("ed".into(), Valeur::Tableau(vec![
                Some(n(0.0)), Some(n(0.0)), Some(n(0.0)), Some(n(10_000.0)), Some(n(0.0)), Some(n(0.0)),
                Some(Valeur::Nul), Some(n(1.0)), Some(n(2.0)), Some(n(3.0)), Some(n(4.0)), Some(n(5.0)),
            ])),
        ]);
        let meta = Valeur::Objet(vec![("partie".into(), n(3.0)), ("at".into(), s("2026-11-06T12:00:00.000Z")), ("cle".into(), s("abcd"))]);
        let snap = appel("listeCompacter", vec![("t", t), ("meta", meta.clone())]);
        let dec = appel("listeDecompacter", vec![("snap", snap.clone())]);
        assert!(dec.champ("n").is_some());
        let _ = appel("listeNom", vec![("partie", n(3.0)), ("at", s("2026-11-06T12:00:00.000Z"))]);
        let _ = appel("listeBords", vec![("body", Valeur::Objet(vec![
            ("ExtractionStatus".into(), s("valid")),
            ("XLeftEdge".into(), n(1.0)), ("YLeftEdge".into(), n(2.0)), ("ZLeftEdge".into(), n(3.0)),
            ("XRightEdge".into(), n(4.0)), ("YRightEdge".into(), n(5.0)), ("ZRightEdge".into(), n(6.0)),
        ]))]);
        let bords = Valeur::Nombres(vec![1000.0, 0.0, 0.0, 11_000.0, 0.0, 0.0]);
        let mem = appel("listeAjouter", vec![("mem", Valeur::Objet(vec![])), ("partie", n(1.0)), ("cle", s("cle")), ("cut", n(4.0)), ("bords", bords), ("at", s("2026-11-06T10:00:00.000Z")), ("version", s("5"))]);
        let _ = appel("listeComparer", vec![("p", mem.champ("1").cloned().unwrap_or(Valeur::Nul)), ("dec", dec), ("at", s("2026-11-06T12:00:00.000Z"))]);
        let _ = appel("listeChoisir", vec![("tables", Valeur::Tableau(vec![])), ("obs", Valeur::Objet(vec![("rows".into(), n(0.0))]))]);
        let _ = appel("listeEmpreinte", vec![("s", s("abc"))]);
        assert_eq!(liste::empreinte("abc").len(), 8);
        let _ = appel("listeTexte", vec![("r", Valeur::Objet(vec![("partie".into(), n(1.0)), ("memorises".into(), n(0.0))])), ("snap", snap), ("heure", Valeur::Nul)]);
        assert_eq!(appel("listeActif", vec![("reglage", Valeur::Indefini)]), Valeur::Booleen(true));
    }

    #[test]
    fn verts_liste_signaux_duree_lignes() {
        let mut lignes = vec![];
        for i in 0..30 {
            lignes.push(Some(Valeur::Objet(vec![
                ("i".into(), n(i as f64)), ("statut".into(), s("valid")), ("operateur".into(), Valeur::Booleen(false)),
                ("bords".into(), Valeur::Objet(vec![
                    ("left".into(), Valeur::Nombres(vec![i as f64, -0.7, 0.0])),
                    ("right".into(), Valeur::Nombres(vec![i as f64, 0.7, 0.0])),
                ])),
            ])));
        }
        let entree = Valeur::Objet(vec![
            ("partie".into(), n(1.0)),
            ("lot".into(), Valeur::Tableau(vec![Some(Valeur::Objet(vec![("cut".into(), n(10.0)), ("differe".into(), Valeur::Booleen(true))]))])),
            ("lignes".into(), Valeur::Tableau(lignes)),
            ("zonesPN".into(), Valeur::Tableau(vec![])),
        ]);
        let _ = appel("vertsListe", vec![("entree", entree.clone()), ("options", Valeur::Nul)]);
        let _ = appel("vertsSignaux", vec![("entree", entree.clone()), ("options", Valeur::Nul)]);
        let _ = verts::classer(&entree, &Valeur::Nul);
        assert_eq!(appel("vertsDuree", vec![("s", n(140.0))]), s("2 min 20 s"));
        assert_eq!(appel("vertsCompacter", vec![("cuts", Valeur::Nombres(vec![3.0, 4.0]))]), s("3, 4"));
        let dec = Valeur::Objet(vec![
            ("n".into(), n(1.0)), ("st".into(), Valeur::Nombres(vec![0.0])), ("fl".into(), Valeur::Nombres(vec![0.0])),
            ("ed".into(), Valeur::Nombres(vec![0.0, 0.0, 0.0, 0.0, 14_350.0, 0.0])),
        ]);
        let _ = appel("vertsLignes", vec![("dec", dec)]);
    }

    #[test]
    fn dataset_et_abi() {
        let session = Valeur::Objet(vec![
            ("id".into(), s("s")), ("status".into(), s("FINISHED")),
            ("startedAt".into(), s("2026-11-06T10:00:00.000Z")), ("finishedAt".into(), s("2026-11-06T11:00:00.000Z")),
            ("observationPeriods".into(), Valeur::Tableau(vec![Some(Valeur::Objet(vec![]))])),
            ("cloudIds".into(), Valeur::Tableau(vec![Some(s("a"))])),
            ("metrics".into(), Valeur::Objet(vec![("dropped".into(), n(0.0)), ("degradationLevels".into(), Valeur::Tableau(vec![]))])),
        ]);
        let records = Valeur::Tableau(vec![Some(Valeur::Objet(vec![
            ("nativeSessionId".into(), s("s")), ("visitIndex".into(), n(1.0)), ("status".into(), s("complete")),
            ("identity".into(), Valeur::Objet(vec![("part".into(), n(1.0)), ("cut".into(), n(2.0))])),
        ]))]);
        let ev = Valeur::Tableau(vec![Some(Valeur::Objet(vec![("nativeSessionId".into(), s("s")), ("eventSeq".into(), n(1.0))]))]);
        let d = appel("dataset", vec![("session", session), ("records", records), ("events", ev), ("exportedAt", s("2026-11-06T12:00:00.000Z"))]);
        assert_eq!(d.champ("format").and_then(|v| if let Valeur::Chaine(x) = v { Some(x.as_str()) } else { None }), Some("banane-native-session-v2"));
        let trame = ariane_vba::encoder(&Valeur::Objet(vec![("f".into(), s("listeEmpreinte")), ("s".into(), s("abc"))]));
        let retour = abi::executer(&trame);
        assert!(ariane_vba::decoder(&retour).is_ok());
        assert_eq!(json_nombre(1.0), "1");
    }

    #[test]
    fn essai_parse_json() {
        let v = super::parse_json(r#"{"f":"listeActif","reglage":null}"#).expect("json");
        assert_eq!(appeler(100, &v).expect("appel"), Valeur::Booleen(true));
    }
}
