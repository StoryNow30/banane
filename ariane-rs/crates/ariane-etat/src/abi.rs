//! ABI identique à `ariane-coeur` : la coquille charge ce binaire comme un cœur.
//! Le chef branchera `100 => ariane_etat::appeler(entree)` dans le cœur unique.
use crate::appeler;
use ariane_js::Echec;
use ariane_vba::{decoder, encoder, Valeur};
use std::alloc::{alloc, dealloc, Layout};
use std::cell::Cell;

const ALIGN: usize = 8;
thread_local! { static RESULTAT: Cell<(usize, usize)> = const { Cell::new((0, 0)) }; }
fn disposition(n: usize) -> Layout { Layout::from_size_align(n.max(1), ALIGN).expect("disposition") }

#[no_mangle]
pub extern "C" fn vba_reserver(n: usize) -> *mut u8 { unsafe { alloc(disposition(n)) } }
/// # Safety
/// `p` vient de `vba_reserver(n)`.
#[no_mangle]
pub unsafe extern "C" fn vba_liberer(p: *mut u8, n: usize) { unsafe { dealloc(p, disposition(n)) } }
#[no_mangle]
pub extern "C" fn vba_resultat() -> *const u8 { RESULTAT.with(|r| r.get().0 as *const u8) }
#[no_mangle]
pub extern "C" fn vba_liberer_resultat() {
    RESULTAT.with(|r| {
        let (p, n) = r.get();
        if p != 0 { unsafe { dealloc(p as *mut u8, disposition(n)) } }
        r.set((0, 0));
    });
}

pub fn executer(entree: &[u8]) -> Vec<u8> {
    let v = match decoder(entree) {
        Ok(v) => match appeler(v) {
            Ok(v) => v,
            Err(Echec::Js { nom, message }) => Valeur::Erreur { nom: nom.into(), message },
            Err(Echec::HorsDomaine(raison)) => Valeur::Erreur { nom: "HorsDomaine".into(), message: raison },
        },
        Err(e) => Valeur::Erreur { nom: "TypeError".into(), message: e.0 },
    };
    encoder(&v)
}

/// # Safety
/// `p` vient de `vba_reserver(n)` et porte `n` octets. Il est libéré ici.
#[no_mangle]
pub unsafe extern "C" fn vba_appel(_fonction: u32, p: *mut u8, n: usize) -> usize {
    vba_liberer_resultat();
    let sortie = unsafe { executer(std::slice::from_raw_parts(p, n)) };
    unsafe { vba_liberer(p, n) };
    let q = unsafe { alloc(disposition(sortie.len())) };
    unsafe { std::ptr::copy_nonoverlapping(sortie.as_ptr(), q, sortie.len()) };
    RESULTAT.with(|r| r.set((q as usize, sortie.len())));
    sortie.len()
}
