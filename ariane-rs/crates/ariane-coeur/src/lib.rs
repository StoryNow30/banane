//! Cœur WASM d'Ariane (CH-064). Étape 1 : seules les sondes de sémantique numérique sont exportées
//! (`tools/ch064-sonde-math.cjs`) ; aucun module d'Ariane n'est encore porté.
#![allow(clippy::disallowed_methods)] // sondes : comparent volontairement std à V8
pub mod abi;

macro_rules! sonde1 { ($($nom:ident => $f:expr),* $(,)?) => { $( #[no_mangle] pub extern "C" fn $nom(x: f64) -> f64 { ($f)(x) } )* }; }
macro_rules! sonde2 { ($($nom:ident => $f:expr),* $(,)?) => { $( #[no_mangle] pub extern "C" fn $nom(x: f64, y: f64) -> f64 { ($f)(x, y) } )* }; }

// std de Rust (ce qu'un portage « naturel » écrirait)
sonde1! { std_sin => f64::sin, std_cos => f64::cos, std_exp => f64::exp, std_ln => f64::ln, std_ln_1p => f64::ln_1p,
          std_log10 => f64::log10, std_round => f64::round }
sonde2! { std_powf => f64::powf, std_hypot => f64::hypot, std_max => f64::max, std_min => f64::min }
#[no_mangle] pub extern "C" fn std_hypot3(x: f64, y: f64, z: f64) -> f64 { (x * x + y * y + z * z).sqrt() }

// sémantique JS portée (ariane-js)
sonde1! { js_round => ariane_js::round, js_sign => ariane_js::sign }
sonde2! { js_hypot => |x, y| ariane_js::hypot(&[x, y]), js_max => ariane_js::max, js_min => ariane_js::min }
#[no_mangle] pub extern "C" fn js_hypot3(x: f64, y: f64, z: f64) -> f64 { ariane_js::hypot(&[x, y, z]) }
