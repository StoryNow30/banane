//! Décision d'Ariane portée en Rust (CH-064-D) : règles de la relecture, gardes du lot, signal d'ESV, règles métier,
//! décision du lot, GCV2. Chaque module suit son fichier JS du tronc ligne à ligne ; `Valeur` (VBA) porte les objets.
//! Point d'entrée unique : `appeler(fonction, entree)`, `entree = {f: nom, a: [arguments]}` (numéros 50 à 99 du cœur).
// Les comparaisons gardent la forme du JS (comportement sur NaN compris) :
#![allow(clippy::neg_cmp_op_on_partial_ord, clippy::manual_range_contains, clippy::needless_range_loop)]
// Forme calquée sur le JS (un `if` par ligne du JS, branches identiques gardées pour suivre les règles) :
#![allow(clippy::suspicious_else_formatting, clippy::if_same_then_else, clippy::type_complexity, clippy::needless_lifetimes, clippy::unnecessary_unwrap)]
pub mod js;
pub mod critere;
pub mod gardes;
pub mod signal;
pub mod ombre;
pub mod crossing;
pub mod metier;
pub mod shadow;
pub mod aides;
pub mod lot;
pub mod j4;
pub mod appuis;
pub mod l1e;
pub mod recentree;
pub mod b1ecart;
#[cfg(test)]
mod essais;

use ariane_vba::Valeur;
pub use js::R;

/// Numéros du cœur réservés à ariane-decision.
pub const CRITERE: u32 = 50;
pub const SIGNAL: u32 = 51;
pub const GARDE_APRES_DIFFERE: u32 = 52;
pub const GARDE_PASSE_APPUIS: u32 = 53;
pub const RELECTURE_OMBRE: u32 = 54;
pub const REGLES_METIER: u32 = 55;
pub const LEVEL_CROSSING: u32 = 56;
pub const GCV1_SHADOW: u32 = 57;
pub const HAUTEUR: u32 = 58;
pub const FAUX_VERT: u32 = 59;
pub const LOT_DECISION: u32 = 60;
/// CH-068 (J4) : `src/appuis-liste.js`.
pub const APPUIS_LISTE: u32 = 61;
/// CH-068 (J4) : `src/gcv2-l1e.js`.
pub const GCV2_L1E: u32 = 62;
/// CH-068 (J4) : `src/voie-recentree.js`.
pub const VOIE_RECENTREE: u32 = 63;
/// CH-068 (J4) : `src/voie-b1-ecart.js`.
pub const VOIE_B1_ECART: u32 = 64;
/// Sonde de sémantique (Number::toString) : `{f:"nombreChaine", a:[[x…]]}` → chaînes.
pub const SONDE: u32 = 99;

pub fn appeler(fonction: u32, entree: &Valeur) -> R<Valeur> {
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
        SONDE if a.f == "nombreChaine" => Ok(Valeur::Tableau(js::presents(a.arg(0)).iter().map(|x| js::chaine(x).map(|c| Some(js::s(&c)))).collect::<R<Vec<_>>>()?)),
        _ => js::hd("ariane-decision : fonction inconnue"),
    }
}
