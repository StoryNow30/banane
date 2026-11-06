//! Ryū (Ulf Adams, 2018 ; port Rust dtolnay/ryu 1.0.18), inclus ici pour ne pas ajouter de dépendance.
//! Licence Apache 2.0 ou Boost 1.0. Sert uniquement à obtenir les chiffres décimaux exacts ; le format
//! JSON (ECMA-262) est appliqué par `crate::nombre`.
#![allow(clippy::all, dead_code, unused_imports, non_upper_case_globals)]
pub mod common;
pub mod d2s;
pub mod d2s_full_table;
pub mod d2s_intrinsics;
