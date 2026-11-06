//! Géométrie d'Ariane portée de `src/geometry.js` (méthode « template-surfaces-v3 », dite V4.6), à l'identique.
//! Chaque ligne suit l'ordre des opérations flottantes du JS. `Math.*` passe par `ariane-js` ; `Math.exp` par l'import
//! JS (`crate::exp`). Les entrées que le port ne reproduit pas (coercitions, types inattendus) rendent `HorsDomaine`.
pub mod v46;

/// `Math.exp` du moteur JS qui exécute (import WASM) ; en essai natif, la std (les essais natifs ne comparent pas au JS).
#[cfg(target_arch = "wasm32")]
pub fn exp(x: f64) -> f64 {
    #[link(wasm_import_module = "env")]
    extern "C" { fn js_exp(x: f64) -> f64; }
    unsafe { js_exp(x) }
}
#[cfg(not(target_arch = "wasm32"))]
#[allow(clippy::disallowed_methods)]
pub fn exp(x: f64) -> f64 { x.exp() }
