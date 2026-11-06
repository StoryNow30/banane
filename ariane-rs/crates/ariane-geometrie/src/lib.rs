//! Géométrie d'Ariane portée de `src/geometry.js` (méthode « template-surfaces-v3 », dite V4.6), à l'identique.
//! Chaque ligne suit l'ordre des opérations flottantes du JS. `Math.*` passe par `ariane-js` ; `Math.exp` par l'import
//! JS (`crate::exp`). Les entrées que le port ne reproduit pas (coercitions, types inattendus) rendent `HorsDomaine`.
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
    // SÛRETÉ : `js_exp` est l'import `env.js_exp` fourni par la coquille (Math.exp) : fonction pure de f64 vers f64,
    // sans pointeur ni état ; aucun invariant mémoire en jeu.
    unsafe { js_exp(x) }
}
/// `Math.exp` hors WASM : l'exp correctement arrondi d'`ariane-js` (identique à celui de Chromium 153, mesuré).
#[cfg(not(target_arch = "wasm32"))]
#[must_use]
pub fn exp(x: f64) -> f64 { ariane_js::exp_correctement_arrondi(x) }
