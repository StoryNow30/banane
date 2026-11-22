//! Files de travail d'Ariane (CH-071, lot 300–349 de l'inventaire) : ports au bit près de `src/file-parties.js`,
//! `src/file-prioritaire.js`, `src/serie-captures-vides.js` et `src/raison-correction.js`, quatre modules purs.
//!
//! Entrée de chaque fonction : `{a: [arguments]}`, tels que le JS les reçoit (plus, pour 317 et 334, ce que la façade
//! a lu à la place du JS : les chaînes du `Set` `jugesDeja`, les `Date.parse`). Les fonctions qui modifient un argument
//! en place rendent `{r, ops}` : `r` est la valeur rendue, `ops` le journal des écritures, appliqué par la façade sur
//! l'objet d'origine (`[0, clé, v]` : `etat[clé] = v` ; `[1, clé, v]` : `etat.collante[clé] = v` ; `[2, v]` :
//! `etat.series.push(v)`). L'arène du cœur est remise à zéro à chaque appel : rien n'est gardé ici entre deux appels.
mod js;
pub mod parties;
pub mod prioritaire;
pub mod raison;
pub mod serie;

use ariane_js::Echec;
use ariane_vba::Valeur;
use js::{arg, ch, hd, objet, pousser, sous, tableau, R};

/// Un état modifié en place, et le journal de ses écritures.
pub struct Ecrit {
    /// L'état, tel qu'il est après les écritures.
    pub e: Valeur,
    ops: Vec<Valeur>,
    /// Vrai si une série a été poussée dans `etat.series`.
    pousse: bool,
}
impl Ecrit {
    /// Un état reçu, sans écriture.
    #[must_use]
    pub fn new(e: Valeur) -> Self { Ecrit { e, ops: vec![], pousse: false } }
    /// `etat[k] = v`.
    ///
    /// # Errors
    /// Hors domaine si l'état n'est pas un objet simple.
    pub fn poser(&mut self, k: &str, v: Valeur) -> R<()> {
        js::poser(&mut self.e, k, v.clone())?;
        self.ops.push(tableau(vec![Valeur::Nombre(0.0), ch(k), v]));
        Ok(())
    }
    /// `etat.collante[k] = v`.
    ///
    /// # Errors
    /// Hors domaine si la collante n'est pas un objet simple.
    pub fn poser_collante(&mut self, k: &str, v: Valeur) -> R<()> {
        js::poser(sous(&mut self.e, "collante")?, k, v.clone())?;
        self.ops.push(tableau(vec![Valeur::Nombre(1.0), ch(k), v]));
        Ok(())
    }
    /// `etat.series.push(v)`.
    ///
    /// # Errors
    /// Hors domaine si `etat.series` n'est pas un tableau.
    pub fn pousser_serie(&mut self, v: Valeur) -> R<()> {
        pousser(sous(&mut self.e, "series")?, v.clone())?;
        self.ops.push(tableau(vec![Valeur::Nombre(2.0), v]));
        self.pousse = true;
        Ok(())
    }
    /// `{r, ops}` (et `alias` : la valeur rendue, ou son champ `ferme`, EST l'objet poussé dans `series`).
    fn rendre(self, r: Valeur, alias: f64) -> Valeur {
        objet(vec![("r", r), ("ops", tableau(self.ops)), ("alias", Valeur::Nombre(if self.pousse { alias } else { 0.0 }))])
    }
}

/// Une clé `__proto__` change le prototype à l'écriture et se lit autrement : le JS seul sait la traiter.
fn sans_proto(v: &Valeur) -> bool {
    match v {
        Valeur::Objet(t) => t.iter().all(|(k, x)| k != "__proto__" && sans_proto(x)),
        Valeur::Tableau(t) => t.iter().flatten().all(sans_proto),
        _ => true,
    }
}

fn b(x: bool) -> Valeur { Valeur::Booleen(x) }

/// Point d'entrée du cœur pour les fonctions 300 à 349.
///
/// # Errors
/// `Echec::HorsDomaine` : la façade rappelle le JS d'origine (le port ne lève jamais d'exception du JS lui-même).
pub fn appeler(fonction: u32, entree: &Valeur) -> Result<Valeur, Echec> {
    if !sans_proto(entree) { return hd("clé __proto__ dans l'entrée"); }
    let a = |i: usize| arg(entree, i);
    let r = match fonction {
        300 => parties::planifier(&a(0), &a(1), &a(2))?.valeur(),
        301 => parties::transition(&a(0), &a(1))?.valeur(),
        302 => parties::reprise(&a(0), &a(1))?.valeur(),
        303 => parties::reprise_de(&a(0))?,
        304 => parties::completer_bilan(&a(0), &a(1))?,
        305 => parties::relire(&a(0))?,
        306 => parties::classer_lot(&a(0)),
        307 => parties::registre_ajouter(&a(0), &a(1))?,
        308 => parties::entree_registre(&a(0))?,
        309 => parties::alertes_avec(&a(0), &a(1), &a(2))?,
        310 => parties::vue(&a(0))?,
        311 => b(parties::actif(&a(0))),
        312 => b(parties::terminal(&a(0))),
        315 => ch(prioritaire::classe(&a(0))),
        316 => prioritaire::apprendre_taux(&a(0))?,
        317 => {
            let juges: Vec<String> = entree.champ("juges").and_then(js::elements).unwrap_or_default().into_iter().flatten()
                .filter_map(|x| if let Valeur::Chaine(s) = x { Some(s) } else { None }).collect();
            prioritaire::ordonner(&a(0), &a(1), &juges)?
        }
        318 => Valeur::Chaine(prioritaire::plages(&a(0))?),
        320 => serie::reglage(&a(0))?,
        321 => serie::creer(&a(0))?,
        322 => { let mut w = Ecrit::new(a(0)); let r = serie::observer(&mut w, &a(1), &a(2))?; w.rendre(r, 0.0) }
        323 => serie::bilan(&a(0))?,
        330 => raison::lire_frappe(&a(0), &a(1)),
        331 => b(raison::est_touche_possible(&a(0))),
        332 => b(raison::autre_geste(&a(0))?),
        333 => raison::delai_de_grace(&a(0), &a(1), &a(2))?,
        334 => Valeur::Nombre(raison::derniere_validation(js::opt(entree, "temps"), js::opt(entree, "frappe"))?),
        335 => raison::nouvel_etat(&a(0)),
        336 => { let mut w = Ecrit::new(a(0)); let r = raison::finir(&mut w, &a(1))?; w.rendre(r, 1.0) }
        337 => { let mut w = Ecrit::new(a(0)); let r = raison::appuyer(&mut w, &a(1), &a(2))?; w.rendre(r, 2.0) }
        338 => { let mut w = Ecrit::new(a(0)); let r = raison::heriter(&mut w, &a(1), &a(2))?; w.rendre(r, 0.0) }
        339 => raison::resume_series(&a(0))?,
        340 => raison::appliquer(&a(0), &a(1))?,
        341 => raison::effacer(&a(0), &a(1))?,
        342 => raison::vue(&a(0), &a(1), &a(2))?,
        _ => return Err(Echec::hors_domaine(format!("ariane-file : fonction {fonction} non portée"))),
    };
    Ok(r.canonique())
}

#[cfg(test)]
mod essais {
    use super::*;
    fn e(args: Vec<Valeur>) -> Valeur { objet(vec![("a", tableau(args))]) }
    #[test]
    fn aiguillage() {
        assert!(matches!(appeler(349, &e(vec![])), Err(Echec::HorsDomaine(_))));
        assert_eq!(appeler(311, &e(vec![objet(vec![("etat", ch("lot"))])])).unwrap(), Valeur::Booleen(true));
        assert_eq!(appeler(318, &e(vec![Valeur::Nombres(vec![2.0, 1.0])])).unwrap(), ch("1, 2"));
        assert!(matches!(appeler(305, &e(vec![objet(vec![("__proto__", Valeur::Nul)])])), Err(Echec::HorsDomaine(_))));
    }
    #[test]
    fn ecrit_et_rendus() {
        let mut w = Ecrit::new(objet(vec![("collante", objet(vec![])), ("series", Valeur::Tableau(vec![]))]));
        w.poser("a", Valeur::Nul).unwrap();
        w.poser_collante("n", Valeur::Nombre(1.0)).unwrap();
        w.pousser_serie(ch("s")).unwrap();
        assert!(w.poser_collante("n", Valeur::Nul).is_ok());
        let r = w.rendre(Valeur::Nul, 1.0);
        assert_eq!(r.champ("alias"), Some(&Valeur::Nombre(1.0)));
        assert_eq!(js::longueur(r.champ("ops").unwrap()), Some(4));
        assert!(Ecrit::new(Valeur::Nul).poser("a", Valeur::Nul).is_err());
        assert_eq!(parties::Plan::Refus("x".into()).valeur(), objet(vec![("refus", ch("x"))]));
        assert_eq!(parties::Sortie::Meme(vec![]).valeur().champ("meme"), Some(&Valeur::Booleen(true)));
    }
    #[test]
    fn journal_et_alias() {
        let etat = appeler(335, &e(vec![])).unwrap();
        let f = objet(vec![("code", ch("pn")), ("cutKey", ch("k")), ("at", Valeur::Nombre(0.0))]);
        let r = appeler(337, &e(vec![etat, f])).unwrap();
        assert_eq!(r.champ("alias"), Some(&Valeur::Nombre(0.0)));
        assert_eq!(js::longueur(r.champ("ops").unwrap()), Some(2));
    }
}
