//! Vue d'Ariane (CH-072, numéros **350 à 399**). Port au bit près des fonctions pures de
//! `src/deplacement-vue.js` et `src/gestes-vue.js`.
//!
//! Restent en JS, par nature : `sequence`, `sequenceMolette`, `sequenceGlisser`, `sequenceClicDroit`
//! (`Math.random` / `alea`, nombre d'appels dépendant des données), `construire` et `emettre` (DOM),
//! `deplacer` (async). Le relevé (`evenement`, `finirGlisser`, `finirMolette`, `apres`) est une transition
//! pure : l'état et les réponses de l'hôte (`maintenant`, `estVue`, `camera`) voyagent dans la valeur.
//!
//! Rien ne survit d'un appel à l'autre. La forme rendue passe par [`Valeur::canonique`].

#[cfg(target_arch = "wasm32")]
mod abi;
mod deplacement;
mod gestes;
mod releve;
mod util;

use ariane_js::Echec;
use ariane_vba::Valeur;
use util::champ;

/// Point d'entrée du cœur pour les fonctions 350 à 399.
///
/// # Errors
/// `Echec::HorsDomaine` : numéro hors lot, fonction laissée en JS, ou entrée que le port ne reproduit pas
/// (la façade rappelle alors le JS). `Echec::Js` n'est pas produit par ce lot : ces fonctions rendent `null`
/// plutôt que de lever, hors accès exotique rejoué en JS.
pub fn appeler(fonction: u32, entree: &Valeur) -> Result<Valeur, Echec> {
    if !(350..=399).contains(&fonction) {
        return Err(Echec::hors_domaine("ariane-vue : numéro hors 350–399"));
    }
    let v = match fonction {
        350 => deplacement::reglages(champ(entree, "s")),
        351 => Ok(deplacement::journal_vide()),
        352 => deplacement::journal_noter(
            champ(entree, "etat"),
            champ(entree, "geste"),
            champ(entree, "e"),
        ),
        353 => deplacement::journal_resume(champ(entree, "etat")),
        354 => deplacement::juger(
            champ(entree, "geste"),
            champ(entree, "plan"),
            champ(entree, "avant"),
            champ(entree, "apres"),
            champ(entree, "r"),
        ),
        355 => deplacement::geste_journal(champ(entree, "g")).map(|v| v.unwrap_or(Valeur::Nul)),
        356 => deplacement::detail_deplacement(champ(entree, "c"), champ(entree, "ctx")),
        357 => deplacement::detail_remise(
            champ(entree, "remise"),
            champ(entree, "erreur"),
            champ(entree, "ctx"),
        ),
        358 => Ok(deplacement::bilan_vide()),
        359 => deplacement::bilan_noter_deplacement(champ(entree, "etat"), champ(entree, "d")),
        360 => deplacement::bilan_noter_remise(champ(entree, "etat"), champ(entree, "r")),
        361 => deplacement::bilan_est_vide(champ(entree, "etat")),
        362 => deplacement::bilan_resume(champ(entree, "etat")),
        370 => gestes::approche(
            champ(entree, "x"),
            champ(entree, "y"),
            champ(entree, "boutons"),
            champ(entree, "dernier"),
        ),
        371 => gestes::besoin(
            champ(entree, "ndc"),
            champ(entree, "viewport"),
            champ(entree, "marge"),
        ),
        372 => gestes::ecart_camera(champ(entree, "avant"), champ(entree, "apres"))
            .map(|v| v.unwrap_or(Valeur::Nul)),
        373 => gestes::meme_camera(champ(entree, "a"), champ(entree, "b")),
        374 => gestes::pixel_mm(champ(entree, "cam")).map(Valeur::Nombre),
        375 => gestes::resume_camera(champ(entree, "cam")),
        376 => releve::pas(entree),
        380..=382 => Err(Echec::hors_domaine(
            "ariane-vue : suite de gestes non portée (Math.random reste en JS)",
        )),
        383..=384 => Err(Echec::hors_domaine("ariane-vue : émission DOM non portée")),
        385 => Err(Echec::hors_domaine(
            "ariane-vue : deplacer (async) non porté",
        )),
        _ => Err(Echec::hors_domaine("ariane-vue : fonction non portée")),
    }?;
    Ok(v.canonique())
}

#[cfg(test)]
#[allow(clippy::float_cmp, clippy::too_many_lines)]
mod essais {
    use super::*;
    use util::{ch, num, obj};

    #[allow(clippy::needless_pass_by_value)]
    fn ok(f: u32, e: Valeur) -> Valeur {
        appeler(f, &e).unwrap_or_else(|err| panic!("appel {f} : {err:?}"))
    }
    fn champ_n(v: &Valeur, k: &str) -> f64 {
        match v.champ(k) {
            Some(Valeur::Nombre(x)) => *x,
            autre => panic!("{k} : {autre:?}"),
        }
    }

    #[test]
    fn numero_hors_lot() {
        assert!(matches!(
            appeler(349, &Valeur::Nul),
            Err(Echec::HorsDomaine(_))
        ));
        assert!(matches!(
            appeler(400, &Valeur::Nul),
            Err(Echec::HorsDomaine(_))
        ));
    }

    #[test]
    fn reglages_defaut_et_plafond() {
        let d = ok(350, obj(vec![("s", Valeur::Indefini)]));
        assert_eq!(d.champ("actif"), Some(&Valeur::Booleen(false)));
        assert_eq!(d.champ("geste"), Some(&ch("molette")));
        assert_eq!(d.champ("erreur"), Some(&Valeur::Nul));
        assert_eq!(champ_n(&d, "tentativesMax"), 2.0);
        assert_eq!(champ_n(&d, "mouvementMinMm"), 0.5);
        let c = ok(
            350,
            obj(vec![(
                "s",
                obj(vec![
                    ("actif", Valeur::Booleen(true)),
                    ("geste", ch("clic-droit")),
                    ("tentativesMax", num(2.0)),
                ]),
            )]),
        );
        assert_eq!(c.champ("actif"), Some(&Valeur::Booleen(true)));
        assert_eq!(c.champ("geste"), Some(&ch("clic-droit")));
        assert_eq!(c.champ("erreur"), Some(&Valeur::Nul));
        let p = ok(
            350,
            obj(vec![(
                "s",
                obj(vec![
                    ("actif", Valeur::Booleen(true)),
                    ("tentativesMax", num(99.0)),
                ]),
            )]),
        );
        assert_eq!(champ_n(&p, "tentativesMax"), 4.0);
        let z = ok(
            350,
            obj(vec![("s", obj(vec![("tentativesMax", num(0.0))]))]),
        );
        assert_eq!(champ_n(&z, "tentativesMax"), 1.0);
        let inconnu = ok(
            350,
            obj(vec![(
                "s",
                obj(vec![
                    ("actif", Valeur::Booleen(true)),
                    ("geste", ch("telepathie")),
                ]),
            )]),
        );
        assert_eq!(inconnu.champ("actif"), Some(&Valeur::Booleen(false)));
        assert_eq!(inconnu.champ("erreur"), Some(&ch("geste-inconnu")));
        assert_eq!(inconnu.champ("geste"), Some(&ch("molette")));
    }

    #[test]
    fn journal_vide_puis_mouvement() {
        let etat = ok(351, Valeur::Nul);
        let r = ok(353, obj(vec![("etat", etat.clone())]));
        assert_eq!(r.champ("meilleur"), Some(&Valeur::Nul));
        assert_eq!(r.champ("version"), Some(&ch("deplacement-vue-v1")));
        let e = obj(vec![
            ("resultat", ch("mouvement")),
            ("deplacementMm", num(40.0)),
            ("zoom", num(1.0)),
        ]);
        let etat = ok(
            352,
            obj(vec![("etat", etat), ("geste", ch("molette")), ("e", e)]),
        );
        let r = ok(353, obj(vec![("etat", etat)]));
        let m = r.champ("gestes").and_then(|g| g.champ("molette")).unwrap();
        assert_eq!(champ_n(m, "mouvements"), 1.0);
        assert_eq!(champ_n(m, "taux"), 1.0);
        assert_eq!(r.champ("meilleur"), Some(&ch("molette")));
    }

    #[test]
    fn detail_remise_message_recentrage_inconnu() {
        let ctx = obj(vec![("phase", ch("pose"))]);
        let m = ok(357, obj(vec![("remise", Valeur::Nul), ("erreur", ch("Vue ESV non restituée après le déplacement de vue (échelle à 2,5 % de la vue habituelle) : les deux rails sont posés.")), ("ctx", ctx.clone())]));
        assert_eq!(m.champ("resultat"), Some(&ch("echec")));
        assert_eq!(m.champ("source"), Some(&ch("message")));
        assert_eq!(champ_n(&m, "ecartEchelle"), 0.025);
        let r = ok(
            357,
            obj(vec![
                ("remise", Valeur::Nul),
                ("erreur", ch("Vue ESV non recentrée sur le rail right.")),
                ("ctx", ctx.clone()),
            ]),
        );
        assert_eq!(r.champ("raison"), Some(&ch("recentrage-impossible")));
        assert_eq!(r.champ("recentre"), Some(&Valeur::Booleen(false)));
        let x = ok(
            357,
            obj(vec![
                ("remise", Valeur::Nul),
                ("erreur", ch("Action interrompue.")),
                ("ctx", ctx),
            ]),
        );
        assert_eq!(x.champ("resultat"), Some(&ch("inconnu")));
        assert_eq!(x.champ("raison"), Some(&ch("erreur:Action interrompue.")));
    }

    #[test]
    fn detail_deplacement_et_bilan() {
        let cote = obj(vec![
            ("cote", ch("left")),
            ("ok", Valeur::Booleen(true)),
            ("raison", Valeur::Nul),
            ("ndcAvant", Valeur::Nombres(vec![1.34, 0.1])),
            ("ndcApres", Valeur::Nombres(vec![0.9, 0.1])),
            (
                "pixelMm",
                obj(vec![("avant", num(0.5)), ("apres", num(0.7))]),
            ),
            ("dureeMs", num(812.0)),
            (
                "gestes",
                Valeur::Tableau(vec![Some(obj(vec![
                    ("type", ch("molette")),
                    ("crans", num(3.0)),
                    ("zoom", num(1.352)),
                    ("camera", Valeur::Nul),
                    ("ndcAvant", Valeur::Nombres(vec![1.34, 0.1])),
                    ("ndcApres", Valeur::Nombres(vec![0.9, 0.1])),
                    ("dureeMs", num(790.0)),
                    (
                        "deplacement",
                        obj(vec![
                            ("geste", ch("clic-droit")),
                            ("ok", Valeur::Booleen(true)),
                            ("tentatives", num(2.0)),
                            ("raison", Valeur::Nul),
                        ]),
                    ),
                ]))]),
            ),
        ]);
        let d = ok(
            356,
            obj(vec![
                ("c", cote),
                (
                    "ctx",
                    obj(vec![("phase", ch("pose")), ("geste", ch("molette"))]),
                ),
            ]),
        );
        assert_eq!(d.champ("cote"), Some(&ch("left")));
        assert_eq!(d.champ("geste"), Some(&ch("clic-droit")));
        assert_eq!(champ_n(&d, "tentatives"), 2.0);
        assert!(matches!(
            appeler(356, &obj(vec![("c", Valeur::Nul)])),
            Ok(Valeur::Nul)
        ));
        let mut b = ok(358, Valeur::Nul);
        b = ok(359, obj(vec![("etat", b), ("d", d)]));
        let faite = ok(
            357,
            obj(vec![
                (
                    "remise",
                    obj(vec![
                        ("ok", Valeur::Booleen(true)),
                        ("crans", num(3.0)),
                        ("ecartEchelle", num(0.0)),
                        ("dureeMs", num(100.0)),
                    ]),
                ),
                ("erreur", Valeur::Nul),
                ("ctx", obj(vec![("phase", ch("pose"))])),
            ]),
        );
        b = ok(360, obj(vec![("etat", b), ("r", faite)]));
        let resume = ok(362, obj(vec![("etat", b.clone())]));
        assert_eq!(champ_n(&resume, "deplacements"), 1.0);
        assert_eq!(champ_n(&resume, "deplacementsReussis"), 1.0);
        assert_eq!(champ_n(&resume, "remisesFaites"), 1.0);
        assert_eq!(champ_n(&resume, "tempsAjouteMs"), 912.0);
        assert_eq!(ok(361, obj(vec![("etat", b)])), Valeur::Booleen(false));
        assert_eq!(
            ok(361, obj(vec![("etat", ok(358, Valeur::Nul))])),
            Valeur::Booleen(true)
        );
    }

    fn cam(x: f64, s: f64) -> Valeur {
        obj(vec![
            (
                "cameraToSceneRelative",
                Valeur::Nombres(vec![
                    0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 10.0, x, 0.0, 1.0,
                ]),
            ),
            (
                "projection",
                Valeur::Nombres(vec![
                    s, 0.0, 0.0, 0.0, 0.0, s, 0.0, 0.0, 0.0, 0.0, -1.0e-4, 0.0, 0.0, 0.0, 0.0, 1.0,
                ]),
            ),
            (
                "viewport",
                obj(vec![("width", num(800.0)), ("height", num(600.0))]),
            ),
        ])
    }

    #[test]
    fn camera_ecart_pixel_resume_meme() {
        let a = cam(0.0, 5.0);
        assert_eq!(ok(374, obj(vec![("cam", a.clone())])), num(0.5));
        let resume = ok(375, obj(vec![("cam", a.clone())]));
        assert_eq!(resume.champ("mmPx"), Some(&num(0.5)));
        let e = ok(
            372,
            obj(vec![("avant", a.clone()), ("apres", cam(0.05, 5.0 / 1.2))]),
        );
        match e.champ("deplacementMm") {
            Some(Valeur::Nombres(t)) => assert_eq!(t.as_slice(), &[50.0, 0.0, 0.0]),
            autre => panic!("{autre:?}"),
        }
        assert_eq!(e.champ("zoom"), Some(&num(1.2)));
        assert_eq!(
            ok(373, obj(vec![("a", a.clone()), ("b", a.clone())])),
            Valeur::Booleen(true)
        );
        assert_eq!(
            ok(373, obj(vec![("a", a), ("b", cam(1.0, 5.0))])),
            Valeur::Booleen(false)
        );
        assert!(matches!(
            appeler(
                372,
                &obj(vec![("avant", Valeur::Nul), ("apres", Valeur::Nul)])
            ),
            Ok(Valeur::Nul)
        ));
    }

    #[test]
    fn besoin_et_approche() {
        let b = ok(
            371,
            obj(vec![
                ("ndc", Valeur::Nombres(vec![1.15, 0.2])),
                (
                    "viewport",
                    obj(vec![("width", num(800.0)), ("height", num(600.0))]),
                ),
                ("marge", Valeur::Indefini),
            ]),
        );
        assert_eq!(b.champ("dans"), Some(&Valeur::Booleen(false)));
        assert!((champ_n(&b, "dezoom") - 1.15 / 0.99).abs() < 1e-12);
        assert!((champ_n(&b, "panPx") - 0.16 * 400.0).abs() < 1e-9);
        let dans = ok(
            371,
            obj(vec![
                ("ndc", Valeur::Nombres(vec![0.5, -0.98])),
                (
                    "viewport",
                    obj(vec![("width", num(800.0)), ("height", num(600.0))]),
                ),
            ]),
        );
        assert_eq!(dans.champ("dans"), Some(&Valeur::Booleen(true)));
        let a = ok(370, obj(vec![("x", num(10.0)), ("y", num(20.0))]));
        match &a {
            Valeur::Tableau(t) => assert_eq!(t.len(), 2),
            autre => panic!("{autre:?}"),
        }
    }

    #[test]
    fn releve_creer_et_fonctions_laissees_en_js() {
        let e = ok(
            376,
            obj(vec![("action", obj(vec![("faire", ch("creer"))]))]),
        );
        assert!(e.champ("etat").is_some());
        assert_eq!(e.champ("demande"), Some(&Valeur::Nul));
        assert!(matches!(
            appeler(381, &Valeur::Nul),
            Err(Echec::HorsDomaine(_))
        ));
        assert!(matches!(
            appeler(383, &Valeur::Nul),
            Err(Echec::HorsDomaine(_))
        ));
        assert!(matches!(
            appeler(385, &Valeur::Nul),
            Err(Echec::HorsDomaine(_))
        ));
        assert!(matches!(
            appeler(399, &Valeur::Nul),
            Err(Echec::HorsDomaine(_))
        ));
    }

    #[test]
    fn geste_journal_ignore_le_vide() {
        assert!(matches!(
            appeler(355, &obj(vec![("g", Valeur::Nul)])),
            Ok(Valeur::Nul)
        ));
        let g = ok(
            355,
            obj(vec![(
                "g",
                obj(vec![("type", ch("molette")), ("zoom", num(1.25))]),
            )]),
        );
        assert_eq!(g.champ("type"), Some(&ch("molette")));
        assert_eq!(champ_n(&g, "zoom"), 1.25);
    }
}
