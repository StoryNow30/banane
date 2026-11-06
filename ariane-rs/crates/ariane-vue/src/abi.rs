//! ABI du module autonome : même quartet que le cœur (`vba_reserver`, `vba_appel`, `vba_resultat`, `vba_liberer_resultat`),
//! pour que `ariane-rs/coquille/coeur.js` charge `ariane_vue.wasm`. Aucun état entre deux appels.
use ariane_vba::{decoder, encoder, Valeur};
use std::alloc::{alloc, dealloc, Layout};
use std::cell::Cell;

const ALIGN: usize = 8;
thread_local! {
    static RESULTAT: Cell<(usize, usize)> = const { Cell::new((0, 0)) };
}

fn disposition(n: usize) -> Layout {
    Layout::from_size_align(n.max(1), ALIGN).unwrap_or(Layout::new::<u64>())
}

/// Tampon de `n` octets pour une trame d'entrée.
#[no_mangle]
pub extern "C" fn vba_reserver(n: usize) -> *mut u8 {
    RESULTAT.with(|r| r.set((0, 0)));
    let d = disposition(n);
    // SÛRETÉ : `d` a une taille non nulle ; le pointeur est rendu à la coquille, qui n'en écrit que `n` octets
    // et le rend par `vba_appel` ou `vba_liberer` avec le même `n`.
    let p = unsafe { alloc(d) };
    if p.is_null() {
        std::alloc::handle_alloc_error(d);
    }
    p
}

/// Rend un tampon d'entrée non passé à [`vba_appel`].
///
/// # Safety
/// `p` vient de `vba_reserver(n)`, avec le même `n`, et n'a pas encore été rendu.
#[no_mangle]
pub unsafe extern "C" fn vba_liberer(p: *mut u8, n: usize) {
    // SÛRETÉ : contrat de l'appelant ; même disposition qu'à l'allocation.
    unsafe { dealloc(p, disposition(n)) }
}

/// Adresse de la trame de la dernière réponse (0 si aucune).
#[no_mangle]
pub extern "C" fn vba_resultat() -> *const u8 {
    RESULTAT.with(|r| r.get().0 as *const u8)
}

/// Rend la trame de la dernière réponse.
#[no_mangle]
pub extern "C" fn vba_liberer_resultat() {
    RESULTAT.with(|r| {
        let (p, n) = r.get();
        if p != 0 {
            // SÛRETÉ : (p, n) a été posé par `vba_appel` à partir d'une allocation de `disposition(n)`, jamais rendue depuis.
            unsafe { dealloc(p as *mut u8, disposition(n)) }
        }
        r.set((0, 0));
    });
}

fn executer(fonction: u32, entree: &[u8]) -> Vec<u8> {
    let v = match decoder(entree) {
        Ok(v) => match crate::appeler(fonction, &v) {
            Ok(v) => v,
            Err(ariane_js::Echec::Js { nom, message }) => Valeur::Erreur {
                nom: (*nom).to_owned(),
                message,
            },
            Err(ariane_js::Echec::HorsDomaine(raison)) => Valeur::Erreur {
                nom: "HorsDomaine".into(),
                message: raison,
            },
        },
        Err(e) => Valeur::Erreur {
            nom: "TypeError".into(),
            message: e.0,
        },
    };
    encoder(&v)
}

/// Exécute la fonction et rend la longueur de la trame de réponse.
///
/// # Safety
/// `p` vient de `vba_reserver(n)`, avec le même `n`, porte `n` octets écrits, et n'est plus utilisé par l'appelant.
#[no_mangle]
pub unsafe extern "C" fn vba_appel(fonction: u32, p: *mut u8, n: usize) -> usize {
    vba_liberer_resultat();
    // SÛRETÉ : `p` désigne `n` octets initialisés (contrat de l'appelant), lus avant d'être rendus.
    let sortie = executer(fonction, unsafe { std::slice::from_raw_parts(p, n) });
    // SÛRETÉ : même `p` et même `n` qu'à la réservation ; plus aucune référence vers l'entrée.
    unsafe { vba_liberer(p, n) };
    let d = disposition(sortie.len());
    // SÛRETÉ : taille non nulle ; l'allocation reçoit exactement `sortie.len()` octets, puis devient la réponse courante.
    let q = unsafe { alloc(d) };
    if q.is_null() {
        std::alloc::handle_alloc_error(d);
    }
    // SÛRETÉ : `q` couvre `sortie.len()` octets et les deux zones sont distinctes (allocation neuve).
    unsafe { std::ptr::copy_nonoverlapping(sortie.as_ptr(), q, sortie.len()) };
    RESULTAT.with(|r| r.set((q as usize, sortie.len())));
    sortie.len()
}
