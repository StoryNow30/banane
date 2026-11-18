//! Cœur d'Ariane (CH-064) : un seul binaire, compilé en WASM (option A, D-294) et en natif (option B, mesure).
//! `abi` : le point d'appel VBA et l'aiguillage des fonctions ; `sondes` : les fonctions de la sonde numérique
//! (`tools/ch064-sonde-math.cjs`), qui comparent volontairement la std de Rust à V8 ; `arene` (WASM seulement) :
//! l'allocateur, remis à zéro à chaque appel.
pub mod abi;
#[cfg(target_arch = "wasm32")]
pub mod arene;
pub mod sondes;
