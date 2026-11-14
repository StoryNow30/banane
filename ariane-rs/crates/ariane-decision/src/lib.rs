//! Décision d'Ariane portée en Rust (CH-064-D) : règles de la relecture, gardes du lot, signal d'ESV, règles métier,
//! décision du lot, GCV2. Chaque module suit son fichier JS du tronc ligne à ligne ; `Valeur` (VBA) porte les objets.
//! Point d'entrée unique : `appeler(fonction, entree)`, `entree = {f: nom, a: [arguments]}` (numéros 50 à 99 du cœur).
// Les comparaisons gardent la forme du JS (comportement sur NaN compris) :
#![allow(clippy::neg_cmp_op_on_partial_ord, clippy::manual_range_contains, clippy::needless_range_loop)]
// Forme calquée sur le JS (un `if` par ligne du JS, branches identiques gardées pour suivre les règles) :
#![cfg_attr(not(test), warn(clippy::unwrap_used, clippy::expect_used))]
// Les comparaisons exactes de nombres sont celles du JS (`===`, `<`) : le port est exact au bit près, c'est le but.
#![allow(clippy::float_cmp)]
#![allow(clippy::suspicious_else_formatting, clippy::if_same_then_else, clippy::type_complexity, clippy::needless_lifetimes, clippy::unnecessary_unwrap)]
mod js;
mod critere;
mod gardes;
mod signal;
mod ombre;
mod crossing;
mod metier;
mod shadow;
mod aides;
mod lot;
// CH-068 (tranche J4)
mod j4;
mod appuis;
mod l1e;
mod recentree;
mod b1ecart;
mod large;
mod l1;
#[cfg(test)]
mod essais;
#[cfg(test)]
mod essais_j4;
#[cfg(test)]
mod essais_l1;

use ariane_vba::Valeur;
use ariane_js::Echec;

// Numéros du cœur réservés à ariane-decision (50 à 99, un seul bras dans `ariane-coeur/src/abi.rs`).
/// `src/relecture-critere.js`.
pub const CRITERE: u32 = 50;
/// `src/relecture-signal.js`.
pub const SIGNAL: u32 = 51;
/// `src/garde-apres-differe.js`.
pub const GARDE_APRES_DIFFERE: u32 = 52;
/// `src/garde-passe-appuis.js`.
pub const GARDE_PASSE_APPUIS: u32 = 53;
/// `src/relecture-ombre.js`.
pub const RELECTURE_OMBRE: u32 = 54;
/// `src/regles-metier.js` (calcul ; la mémoire reste en JS).
pub const REGLES_METIER: u32 = 55;
/// `src/level-crossing.js`.
pub const LEVEL_CROSSING: u32 = 56;
/// `src/gcv1-shadow.js` (science du moteur GCV1).
pub const GCV1_SHADOW: u32 = 57;
/// `src/hauteur-apprise.js`.
pub const HAUTEUR: u32 = 58;
/// `src/faux-vert-ombre.js`.
pub const FAUX_VERT: u32 = 59;
/// `src/lot-decision.js` (`decideCut`).
pub const LOT_DECISION: u32 = 60;
/// CH-068 (J4) : `src/appuis-liste.js`.
pub const APPUIS_LISTE: u32 = 61;
/// CH-068 (J4) : `src/gcv2-l1e.js`.
pub const GCV2_L1E: u32 = 62;
/// CH-068 (J4) : `src/voie-recentree.js`.
pub const VOIE_RECENTREE: u32 = 63;
/// CH-068 (J4) : `src/voie-b1-ecart.js`.
pub const VOIE_B1_ECART: u32 = 64;
/// CH-068 (J4) : `src/recherche-large.js`.
pub const RECHERCHE_LARGE: u32 = 65;
/// CH-074 (J5) : `src/gcv2-l1.js`.
pub const GCV2_L1: u32 = 66;
/// Sonde de sémantique (`Number::toString`) : `{f:"nombreChaine", a:[[x…]]}` → chaînes.
pub const SONDE: u32 = 99;

/// Point d'entrée du cœur pour les fonctions 50 à 99 : `entree = {f: nom, a: [arguments], …}`.
///
/// # Errors
/// `Echec::Js` : l'exception que lèverait le JS (même constructeur, même message) ; `Echec::HorsDomaine` : entrée que le port
/// ne reproduit pas à l'identique, la façade rappelle le JS d'origine.
pub fn appeler(fonction: u32, entree: &Valeur) -> Result<Valeur, Echec> {
    let a = js::Appel::lire(entree)?;
    match fonction {
        CRITERE => critere::appeler(&a),
        SIGNAL => signal::appeler(&a),
        GARDE_APRES_DIFFERE => gardes::apres_differe::appeler(&a),
        GARDE_PASSE_APPUIS => gardes::passe_appuis::appeler(&a),
        RELECTURE_OMBRE => ombre::appeler(&a),
        REGLES_METIER => metier::appeler(&a),
        LEVEL_CROSSING => crossing::appeler(&a),
        GCV1_SHADOW => shadow::appeler(&a, js::g(entree, "etat")),
        HAUTEUR => aides::appeler("hauteur", &a),
        FAUX_VERT => aides::appeler("fauxVert", &a),
        LOT_DECISION => lot::appeler(&a, entree),
        APPUIS_LISTE => appuis::appeler(&a),
        GCV2_L1E => l1e::appeler(&a),
        VOIE_RECENTREE => recentree::appeler(&a, entree),
        VOIE_B1_ECART => b1ecart::appeler(&a, entree),
        RECHERCHE_LARGE => large::appeler(&a, entree),
        GCV2_L1 => l1::appeler(&a, entree),
        SONDE if a.f == "nombreChaine" => Ok(Valeur::Tableau(js::presents(a.arg(0)).iter().map(|x| js::chaine(x).map(|c| Some(js::s(&c)))).collect::<js::R<Vec<_>>>()?)),
        _ => js::hd("ariane-decision : fonction inconnue"),
    }
}
