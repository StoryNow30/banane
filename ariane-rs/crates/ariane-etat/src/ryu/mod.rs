//! Chiffres décimaux d'un `f64`, repris de Ryū.
//!
//! Provenance : algorithme d'Ulf Adams, 2018 ; port Rust de David Tolnay, crate `ryu` version 1.0.18.
//! Fichiers repris, table complète (pas la variante courte) : `common.rs`, `d2s.rs`,
//! `d2s_full_table.rs`, `d2s_intrinsics.rs`. Aucune dépendance Cargo : le binaire WASM n'en a pas.
//!
//! Licence d'amont, au choix : Apache 2.0 ou Boost 1.0. Licence choisie pour cette copie : Apache 2.0.
//! Les en-têtes d'origine restent dans chaque fichier.
//!
//! Seuls les chiffres sont utilisés. Le texte JSON est appliqué ensuite par `crate::nombre`.
//!
//! # Safety
//! `mul_shift_all_64` écrit dans deux pointeurs fournis par `d2d`. Ces pointeurs désignent des `u64`
//! locaux de `d2d`, encore non initialisés, et ils ne sortent pas de la fonction. `assume_init` ne
//! s'applique qu'après cette écriture. `get_unchecked` n'est appelé qu'avec un indice déjà borné par
//! la taille de la table.
#![allow(clippy::all, clippy::pedantic, dead_code, unused_imports, non_upper_case_globals)]
pub(crate) mod common;
pub(crate) mod d2s;
pub(crate) mod d2s_full_table;
pub(crate) mod d2s_intrinsics;
