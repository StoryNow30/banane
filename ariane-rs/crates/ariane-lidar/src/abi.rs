//! ABI du noyau de lecture : arène STATIQUE de taille fixe, aucune allocation, aucune croissance de la mémoire linéaire.
//!
//! La coquille (`js/lidar-wasm.js`) obtient une fois les adresses des blocs, puis, par tranche d'au plus `CAPACITE` points :
//! copie la tranche du tampon Potree dans `ENTREE` (`Float32Array.prototype.set`), écrit l'état, appelle
//! `lidar_parcourir_f32` (ou `_f64`), relit l'état et les sorties. Comme la mémoire ne grandit jamais (512 Kio, `build.rs`),
//! le `ArrayBuffer` n'est jamais détaché : les vues JS sont créées une seule fois.
//! Taille : entrée 128 Kio, sorties 4 096 × (4 + 24) octets = 112 Kio, matrices et état < 2 Kio, pile 64 Kio.
use crate::{parcourir, N_ETAT, N_MATS};
use core::cell::UnsafeCell;

/// Points au plus par appel (= `yieldEvery` par défaut de `capture()`).
pub const CAPACITE: usize = 4096;
/// Octets du tampon d'entrée (assez pour 4 096 points Float64 au pas 4, ou Float32 au pas 8).
pub const ENTREE_OCTETS: usize = 131072;

#[repr(C, align(8))]
struct Arene {
    entree: [u8; ENTREE_OCTETS],
    mats: [f64; N_MATS],
    etat: [f64; N_ETAT],
    retenus: [u32; CAPACITE],
    scene: [f64; 3 * CAPACITE],
}
struct Partage(UnsafeCell<Arene>);
// WASM sans fils d'exécution : un seul appelant à la fois (la coquille est synchrone).
unsafe impl Sync for Partage {}
static ARENE: Partage = Partage(UnsafeCell::new(Arene {
    entree: [0; ENTREE_OCTETS],
    mats: [0.0; N_MATS],
    etat: [0.0; N_ETAT],
    retenus: [0; CAPACITE],
    scene: [0.0; 3 * CAPACITE],
}));
fn arene() -> *mut Arene { ARENE.0.get() }

#[no_mangle]
pub extern "C" fn lidar_entree() -> *mut u8 { unsafe { (*arene()).entree.as_mut_ptr() } }
#[no_mangle]
pub extern "C" fn lidar_entree_octets() -> usize { ENTREE_OCTETS }
#[no_mangle]
pub extern "C" fn lidar_capacite() -> usize { CAPACITE }
#[no_mangle]
pub extern "C" fn lidar_matrices() -> *mut f64 { unsafe { (*arene()).mats.as_mut_ptr() } }
#[no_mangle]
pub extern "C" fn lidar_etat() -> *mut f64 { unsafe { (*arene()).etat.as_mut_ptr() } }
#[no_mangle]
pub extern "C" fn lidar_retenus() -> *mut u32 { unsafe { (*arene()).retenus.as_mut_ptr() } }
#[no_mangle]
pub extern "C" fn lidar_scene() -> *mut f64 { unsafe { (*arene()).scene.as_mut_ptr() } }

fn appel<T: crate::Coord>(n: u32, stride: u32, premier: u32, limite: f64) -> u32 {
    let (n, stride) = (n as usize, stride as usize);
    let largeur = core::mem::size_of::<T>();
    // Bornes vérifiées : une tranche trop longue est refusée (code 3), jamais lue hors de l'arène.
    let a = unsafe { &mut *arene() };
    if n > CAPACITE || stride < 3 || (n > 0 && ((n - 1) * stride + 3) * largeur > ENTREE_OCTETS) {
        a.etat[crate::E_ERREUR] = 3.0;
        return 0;
    }
    let lus = if n == 0 { 0 } else { (n - 1) * stride + 3 };
    let src = unsafe { core::slice::from_raw_parts(a.entree.as_ptr() as *const T, lus) };
    parcourir(src, stride, n, premier, limite, &a.mats, &mut a.etat, &mut a.retenus, &mut a.scene) as u32
}

/// Tranche d'un tampon `Float32Array` : `n` points au pas `stride` (en nombres), copiés en `lidar_entree()`.
#[no_mangle]
pub extern "C" fn lidar_parcourir_f32(n: u32, stride: u32, premier: u32, limite: f64) -> u32 { appel::<f32>(n, stride, premier, limite) }
/// Tranche d'un tampon `Float64Array`.
#[no_mangle]
pub extern "C" fn lidar_parcourir_f64(n: u32, stride: u32, premier: u32, limite: f64) -> u32 { appel::<f64>(n, stride, premier, limite) }
