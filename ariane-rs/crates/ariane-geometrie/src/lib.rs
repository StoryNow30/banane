//! Géométrie d'Ariane portée de `src/geometry.js` (méthode « template-surfaces-v3 », dite V4.6), à l'identique.
//! Chaque ligne suit l'ordre des opérations flottantes du JS. `Math.*` passe par `ariane-js` ; `Math.exp` par l'import
//! JS (`crate::exp`). Les entrées que le port ne reproduit pas (coercitions, types inattendus) rendent `HorsDomaine`.
// Les comparaisons gardent la forme du JS (y compris leur comportement sur NaN) et les boucles indexées son ordre :
#![allow(clippy::neg_cmp_op_on_partial_ord, clippy::manual_range_contains, clippy::needless_range_loop)]
pub mod v46;
pub mod gcv1;
pub mod convention;
pub mod jauge;

/// `Math.exp` du moteur JS qui exécute (import WASM) ; en natif (programme de l'option B), l'exp correctement arrondi
/// d'ariane-js, mesuré identique à celui de Chromium 153 (pas à celui de Node 22).
#[cfg(target_arch = "wasm32")]
pub fn exp(x: f64) -> f64 {
    #[link(wasm_import_module = "env")]
    extern "C" { fn js_exp(x: f64) -> f64; }
    unsafe { js_exp(x) }
}
#[cfg(not(target_arch = "wasm32"))]
pub fn exp(x: f64) -> f64 { ariane_js::exp_correctement_arrondi(x) }
