//! Décision du lot, GCV2, règles, gardes et relecture (sous-chantier CH-064-D) : squelette posé par le chef.
//! Numéros de fonction du cœur réservés : 50 à 99 (un seul bras dans `ariane-coeur/src/abi.rs`).
use ariane_js::Echec;
use ariane_vba::Valeur;

/// Point d'entrée du cœur pour les fonctions 50 à 99.
///
/// # Errors
/// `Echec::Js` : l'exception que lèverait le JS ; `Echec::HorsDomaine` : la façade rappelle le JS d'origine.
pub fn appeler(fonction: u32, _entree: &Valeur) -> Result<Valeur, Echec> {
    Err(Echec::hors_domaine(format!("ariane-decision : fonction {fonction} non portée")))
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn squelette_hors_domaine() {
        assert!(matches!(appeler(50, &Valeur::Nul), Err(Echec::HorsDomaine(_))));
    }
}
