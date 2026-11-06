//! Décision d'Ariane portée en Rust (CH-064-D) : règles de la relecture, gardes du lot, signal d'ESV, règles métier,
//! décision du lot, GCV2. Chaque module suit son fichier JS du tronc ligne à ligne ; `Valeur` (VBA) porte les objets.
//! Point d'entrée unique : `appeler(fonction, entree)`, `entree = {f: nom, a: [arguments]}` (numéros 50 à 99 du cœur).
// Les comparaisons gardent la forme du JS (comportement sur NaN compris) :
#![allow(clippy::neg_cmp_op_on_partial_ord, clippy::manual_range_contains, clippy::needless_range_loop)]
pub mod js;
pub mod critere;
pub mod gardes;
pub mod signal;
pub mod ombre;
pub mod crossing;
pub mod metier;
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
        SONDE if a.f == "nombreChaine" => Ok(Valeur::Tableau(js::presents(a.arg(0)).iter().map(|x| js::chaine(x).map(|c| Some(js::s(&c)))).collect::<R<Vec<_>>>()?)),
        _ => js::hd("ariane-decision : fonction inconnue"),
    }
}
