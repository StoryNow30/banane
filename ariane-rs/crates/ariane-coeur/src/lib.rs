//! Cœur d'Ariane (CH-064) : un seul binaire, compilé en WASM (option A, D-294) et en natif (option B, mesure).
//! `abi` : le point d'appel VBA et l'aiguillage des fonctions ; `sondes` : les fonctions de la sonde numérique
//! (`tools/ch064-sonde-math.cjs`), qui comparent volontairement la std de Rust à V8.
pub mod abi;
pub mod sondes;
