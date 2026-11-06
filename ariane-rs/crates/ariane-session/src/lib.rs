//! Session d'Ariane (CH-070, lot 250–299 de l'inventaire D-295) : fonctions pures de `native-session`,
//! `part-summary-49` (entier), `historique-parties`, `native-reconstruction`, `core` (`expectedPoses`, `pairCorpus`).
//!
//! Entrée de chaque fonction : `{a: [arguments dans l'ordre du JS]}` (plus, pour les méthodes à `this` et les réglages,
//! les champs nommés dans `chantiers/CH-070/rapport.md`). Sortie : la valeur rendue par le JS, sous forme canonique
//! (`Valeur::canonique`). Rien ne survit entre deux appels (l'arène du cœur est remise à zéro).
pub mod historique;
pub mod js_extra;
pub mod noyau;
pub mod observateur;
pub mod reconstruction;
pub mod resume;
pub mod session;

use ariane_js::Echec;
use ariane_vba::Valeur;
use js_extra::arg;

/// Point d'entrée du cœur pour les fonctions 250 à 299.
///
/// # Errors
/// `Echec::Js` : l'exception que lèverait le JS ; `Echec::HorsDomaine` : la façade rappelle le JS d'origine.
pub fn appeler(fonction: u32, e: &Valeur) -> Result<Valeur, Echec> {
    let r = match fonction {
        250 => resume::project_event_valeur(&arg(e, 0)),
        251 => resume::summarize(&arg(e, 0), js_extra::Locale::de(js_extra::ch(e, "locale"))),
        252 => resume::from_journal(&arg(e, 0)),
        253 => resume::context_of_valeur(&arg(e, 0)),
        254 => resume::defer_kind_valeur(&arg(e, 0), &arg(e, 1)),
        260 => Ok(historique::fin_de(&arg(e, 0))),
        261 => historique::fiche_fin(&arg(e, 0), &arg(e, 1)),
        262 => historique::ajouter_fin(&arg(e, 0), &arg(e, 1)),
        263 => historique::historique(&arg(e, 0), js_extra::Locale::de(js_extra::ch(e, "locale"))),
        270 => session::pose_equal(&arg(e, 0), &arg(e, 1), &arg(e, 2)).map(Valeur::Booleen),
        271 => session::reference_par_ecriture(&arg(e, 0), &arg(e, 1), &arg(e, 2), &arg(e, 3), session::reglage(e, "ecritureReferenceSeuilM")?),
        272 => session::rail_delta(&arg(e, 0), &arg(e, 1), &arg(e, 2), session::reglage(e, "movementThresholdM")?),
        273 => session::visit_relation(&arg(e, 0), &arg(e, 1), &arg(e, 2), js_extra::ch(e, "autre")),
        274 => session::redacted_event(&arg(e, 0), &arg(e, 1)),
        275 => session::merge_metrics(js_extra::ch(e, "m"), &arg(e, 0)),
        276 => session::account_quality(&arg(e, 0), &arg(e, 1), session::reglage(e, "qualityRailLimit")?),
        277 => session::health(js_extra::ch(e, "native"), js_extra::chemin(e, &["reglages", "watermarkBytes"])),
        279 => match arg(e, 1) { Valeur::Chaine(side) => session::choose_geometry(&arg(e, 0), &side), _ => Err(Echec::hors_domaine("chooseGeometry : côté non chaîne")) },
        280 => session::classify(&arg(e, 0), session::Echo::de(e)?),
        281 => session::reference_from_write(&arg(e, 0), &arg(e, 1), &arg(e, 2), session::Echo::de(e)?),
        278 => session::export_advice(js_extra::ch(e, "native"), js_extra::chemin(e, &["reglages", "watermarkBytes"])),
        285 => noyau::expected_poses(&arg(e, 0), &arg(e, 1)),
        286 => noyau::pair_corpus(&arg(e, 0)),
        290 => match arg(e, 1) { Valeur::Chaine(side) => reconstruction::etiquette(&arg(e, 0), &side, &arg(e, 2)), _ => Err(Echec::hors_domaine("côté non chaîne")) },
        291 => reconstruction::meme_etiquette(&arg(e, 0), &arg(e, 1), &arg(e, 2)).map(Valeur::Booleen),
        292 => reconstruction::dist_mm(&arg(e, 0), &arg(e, 1)).map(js_extra::n_ou_nul),
        293 => match arg(e, 1) { Valeur::Chaine(side) => { let (n, t) = reconstruction::options(&arg(e, 2))?; reconstruction::reconstruire_rail(&arg(e, 0), &side, n, t) } _ => Err(Echec::hors_domaine("côté non chaîne")) },
        294 => { let (n, t) = reconstruction::options(&arg(e, 1))?; reconstruction::reconstruire_cut(&arg(e, 0), n, t) }
        296 => observateur::voisins(&arg(e, 0), &arg(e, 1)),
        // banc seulement : Date.parse au bit près (js_extra::date), entrée {a:[chaîne]}
        298 => match arg(e, 0) { Valeur::Chaine(c) => js_extra::date::parse(&c).map(Valeur::Nombre), _ => Err(Echec::hors_domaine("Date.parse : non chaîne")) },
        _ => Err(Echec::hors_domaine(format!("ariane-session : fonction {fonction} non portée"))),
    }?;
    Ok(r.canonique())
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn hors_lot() {
        assert!(matches!(appeler(299, &Valeur::Nul), Err(Echec::HorsDomaine(_))));
    }
}
