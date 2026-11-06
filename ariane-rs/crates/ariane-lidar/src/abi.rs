//! ABI du noyau de lecture : arène STATIQUE de taille fixe, aucune allocation, aucune croissance de la mémoire linéaire.
//!
//! La coquille (`js/lidar-wasm.js`) obtient une fois les adresses des blocs, puis, par tranche d'au plus `CAPACITE` points :
//! copie la tranche du tampon Potree dans `entree` (`Float32Array.prototype.set`), écrit l'état, appelle
//! `lidar_parcourir_f32` (ou `_f64`), relit l'état et les sorties. Dans le module autonome `ariane_lidar.wasm`, la mémoire
//! ne grandit jamais (512 Kio initiale = maximale, `build.rs`) : le `ArrayBuffer` n'est jamais détaché et les vues JS sont
//! créées une seule fois. Liée dans `ariane-coeur`, l'arène est une donnée statique de plus du cœur.
//! Taille : entrée 128 Kio, sorties 4 096 × (4 + 24) octets = 112 Kio, matrices et état < 2 Kio.
use crate::{parcourir, Coord, E_ERREUR, N_ETAT, N_MATS, VERSION_ARENE};
use core::cell::UnsafeCell;

/// Points au plus par appel (= `yieldEvery` par défaut de `capture()`).
pub const CAPACITE: usize = 4096;
/// Octets du tampon d'entrée (4 096 points Float64 au pas 4, ou Float32 au pas 8).
pub const ENTREE_OCTETS: usize = 131_072;

#[repr(C, align(8))]
struct Arene {
    entree: [u8; ENTREE_OCTETS],
    mats: [f64; N_MATS],
    etat: [f64; N_ETAT],
    retenus: [u32; CAPACITE],
    scene: [f64; 3 * CAPACITE],
}
struct Partage(UnsafeCell<Arene>);
// SÛRETÉ : WASM sans fils d'exécution ; la coquille est synchrone, un seul appel à la fois touche l'arène.
unsafe impl Sync for Partage {}
static ARENE: Partage = Partage(UnsafeCell::new(Arene {
    entree: [0; ENTREE_OCTETS],
    mats: [0.0; N_MATS],
    etat: [0.0; N_ETAT],
    retenus: [0; CAPACITE],
    scene: [0.0; 3 * CAPACITE],
}));

/// Adresse d'un champ de l'arène, sans créer de référence (la coquille écrit dans ces blocs entre deux appels).
macro_rules! adresse { ($champ:ident, $t:ty) => { core::ptr::addr_of_mut!((*ARENE.0.get()).$champ).cast::<$t>() }; }

/// Version du format de l'arène (`VERSION_ARENE`).
#[no_mangle]
pub extern "C" fn lidar_version_arene() -> u32 { VERSION_ARENE }
/// Adresse du tampon d'entrée (`ENTREE_OCTETS` octets, aligné sur 8).
#[no_mangle]
pub extern "C" fn lidar_entree() -> *mut u8 {
    // SÛRETÉ : adresse d'un champ d'une statique, aucune référence créée.
    unsafe { adresse!(entree, u8) }
}
/// Taille du tampon d'entrée en octets.
#[no_mangle]
pub extern "C" fn lidar_entree_octets() -> usize { ENTREE_OCTETS }
/// Points au plus par tranche.
#[no_mangle]
pub extern "C" fn lidar_capacite() -> usize { CAPACITE }
/// Adresse du bloc `MATS` (`N_MATS` nombres).
#[no_mangle]
pub extern "C" fn lidar_matrices() -> *mut f64 {
    // SÛRETÉ : comme `lidar_entree`.
    unsafe { adresse!(mats, f64) }
}
/// Adresse du bloc `ETAT` (`N_ETAT` nombres).
#[no_mangle]
pub extern "C" fn lidar_etat() -> *mut f64 {
    // SÛRETÉ : comme `lidar_entree`.
    unsafe { adresse!(etat, f64) }
}
/// Adresse des indices sources retenus (`CAPACITE` entiers).
#[no_mangle]
pub extern "C" fn lidar_retenus() -> *mut u32 {
    // SÛRETÉ : comme `lidar_entree`.
    unsafe { adresse!(retenus, u32) }
}
/// Adresse des points scène retenus (`3 × CAPACITE` nombres).
#[no_mangle]
pub extern "C" fn lidar_scene() -> *mut f64 {
    // SÛRETÉ : comme `lidar_entree`.
    unsafe { adresse!(scene, f64) }
}

fn appel<T: Coord>(n: u32, stride: u32, premier: u32, limite: f64) -> u32 {
    let (n, stride) = (n as usize, stride as usize);
    let largeur = core::mem::size_of::<T>();
    // SÛRETÉ : seul accès à l'arène pendant l'appel (coquille synchrone, pas de fils) ; aucune référence ne survit à l'appel.
    let a = unsafe { &mut *ARENE.0.get() };
    // Bornes vérifiées : une tranche qui sortirait de l'arène est refusée (code 3), jamais lue.
    if n > CAPACITE || stride < 3 || (n > 0 && ((n - 1) * stride + 3) * largeur > ENTREE_OCTETS) {
        a.etat[E_ERREUR] = 3.0;
        return 0;
    }
    let lus = if n == 0 { 0 } else { (n - 1) * stride + 3 };
    // SÛRETÉ : `entree` est alignée sur 8 (repr(C, align(8)), premier champ) ; `lus × largeur ≤ ENTREE_OCTETS` vérifié
    // ci-dessus ; tout motif de bits est un f32 ou un f64 valide.
    let src = unsafe { core::slice::from_raw_parts(a.entree.as_ptr().cast::<T>(), lus) };
    let k = parcourir(src, stride, n, premier, limite, &a.mats, &mut a.etat, &mut a.retenus, &mut a.scene);
    u32::try_from(k).unwrap_or(u32::MAX) // k ≤ n ≤ CAPACITE
}

/// Tranche d'un tampon `Float32Array` : `n` points au pas `stride` (en nombres), copiés en `lidar_entree()`.
/// Rend le nombre de points retenus ; compteurs, plus proche et erreur dans `lidar_etat()`.
#[no_mangle]
pub extern "C" fn lidar_parcourir_f32(n: u32, stride: u32, premier: u32, limite: f64) -> u32 { appel::<f32>(n, stride, premier, limite) }
/// Tranche d'un tampon `Float64Array` (même contrat que `lidar_parcourir_f32`).
#[no_mangle]
pub extern "C" fn lidar_parcourir_f64(n: u32, stride: u32, premier: u32, limite: f64) -> u32 { appel::<f64>(n, stride, premier, limite) }

#[cfg(test)]
// essais au bit près ; l'entrée est alignée sur 8 (vérifié en tête de l'essai) ; CAPACITE tient dans un u32
#[allow(clippy::float_cmp, clippy::cast_ptr_alignment, clippy::cast_possible_truncation)]
mod essais {
    use super::*;
    use crate::{E_PAR_RAIL, E_PROCHE, E_TRAITES, M_BORNES};

    /// Un seul essai pour toute l'ABI : l'arène est une statique partagée, les essais parallèles s'y marcheraient dessus.
    #[test]
    fn abi_complete() {
        assert_eq!(lidar_version_arene(), VERSION_ARENE);
        assert_eq!((lidar_capacite(), lidar_entree_octets()), (CAPACITE, ENTREE_OCTETS));
        assert_eq!(lidar_entree() as usize % 8, 0);
        // SÛRETÉ : blocs de l'arène, tailles N_MATS, N_ETAT, ENTREE_OCTETS, CAPACITE ; aucun autre accès pendant l'essai.
        let (m, e, x32, x64, r, s) = unsafe {
            (
                core::slice::from_raw_parts_mut(lidar_matrices(), N_MATS),
                core::slice::from_raw_parts_mut(lidar_etat(), N_ETAT),
                core::slice::from_raw_parts_mut(lidar_entree().cast::<f32>(), 6),
                core::slice::from_raw_parts_mut(lidar_entree().cast::<f64>(), 6),
                core::slice::from_raw_parts(lidar_retenus(), CAPACITE),
                core::slice::from_raw_parts(lidar_scene(), 3 * CAPACITE),
            )
        };
        // Toutes les matrices à l'identité, fenêtre de ±0,5 × 0,4 × 0,3.
        m.fill(0.0);
        for o in (0..128).step_by(16) {
            for d in [0, 5, 10, 15] {
                m[o + d] = 1.0;
            }
        }
        m[M_BORNES..M_BORNES + 3].copy_from_slice(&[0.5, 0.4, 0.3]);
        let verifier = |e: &[f64], r: &[u32], s: &[f64]| {
            assert_eq!((e[E_TRAITES], e[E_PAR_RAIL[0]], e[E_PAR_RAIL[1]], e[E_ERREUR]), (2.0, 1.0, 1.0, 0.0));
            assert_eq!((r[0], s[0], s[1]), (10, 0.25, 0.0));
            assert_eq!(e[E_PROCHE[0] + 2], 10.0);
        };
        x32.copy_from_slice(&[0.25, 0.0, 0.0, 9.0, 9.0, 9.0]);
        e.fill(0.0);
        assert_eq!(lidar_parcourir_f32(2, 3, 10, f64::INFINITY), 1);
        verifier(e, r, s);
        x64.copy_from_slice(&[0.25, 0.0, 0.0, 9.0, 9.0, 9.0]);
        e.fill(0.0);
        assert_eq!(lidar_parcourir_f64(2, 3, 10, f64::INFINITY), 1);
        verifier(e, r, s);
        // Tranches refusées : trop longue, pas < 3, débordement de l'entrée.
        for (n, pas) in [(CAPACITE as u32 + 1, 3), (2, 2), (4096, 9)] {
            e.fill(0.0);
            assert_eq!(lidar_parcourir_f64(n, pas, 0, f64::INFINITY), 0);
            assert_eq!(e[E_ERREUR], 3.0);
        }
    }
}
