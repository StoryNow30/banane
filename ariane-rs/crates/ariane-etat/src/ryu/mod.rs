//! Ryū (Ulf Adams, 2018 ; port Rust dtolnay/ryu 1.0.18), inclus ici pour ne pas ajouter de dépendance.
//! Licence Apache 2.0 ou Boost 1.0. Sert uniquement à obtenir les chiffres décimaux exacts ; le format
//! JSON (ECMA-262) est appliqué par `crate::nombre`.
//!
//! # Safety
//! Les blocs `unsafe` de ce module sont ceux du port d'origine. Invariant : `mul_shift_all_64` écrit
//! dans deux pointeurs fournis par `d2d`, qui pointent vers des `u64` locaux de cette fonction ;
//! `assume_init` ne s'applique qu'après cette écriture. Aucun pointeur ne sort du module.
#![allow(clippy::all, clippy::pedantic, dead_code, unused_imports, non_upper_case_globals)]
pub mod common;
pub mod d2s;
pub mod d2s_full_table;
pub mod d2s_intrinsics;
