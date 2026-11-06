//! Session d'Ariane (CH-070, lot 250–299 de l'inventaire D-295) : fonctions pures de `native-session`,
//! `part-summary-49` (entier), `historique-parties`, `native-reconstruction`, `core` (`expectedPoses`, `pairCorpus`).
//!
//! Entrée de chaque fonction : `{a: [arguments dans l'ordre du JS]}` (plus, pour les méthodes à `this` et les réglages,
//! les champs nommés dans `chantiers/CH-070/rapport.md`). Sortie : la valeur rendue par le JS, sous forme canonique
//! (`Valeur::canonique`). Rien ne survit entre deux appels (l'arène du cœur est remise à zéro).
pub mod js;
pub mod resume;

use ariane_js::Echec;
use ariane_vba::Valeur;
use js::arg;

/// Point d'entrée du cœur pour les fonctions 250 à 299.
///
/// # Errors
/// `Echec::Js` : l'exception que lèverait le JS ; `Echec::HorsDomaine` : la façade rappelle le JS d'origine.
pub fn appeler(fonction: u32, e: &Valeur) -> Result<Valeur, Echec> {
    let r = match fonction {
        250 => resume::project_event_valeur(&arg(e, 0)),
        251 => resume::summarize(&arg(e, 0)),
        252 => resume::from_journal(&arg(e, 0)),
        253 => resume::context_of_valeur(&arg(e, 0)),
        254 => resume::defer_kind_valeur(&arg(e, 0), &arg(e, 1)),
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
