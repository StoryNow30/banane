//! ABI identique à `ariane-coeur` : la coquille charge ce binaire comme un cœur.
//! Le cœur unique route déjà les fonctions 100 à 149 vers `appeler`.
use crate::appeler;
use ariane_js::Echec;
use ariane_vba::{decoder, encoder, Valeur};
use std::alloc::{alloc, dealloc, Layout};
use std::cell::Cell;

const ALIGN: usize = 8;
thread_local! { static RESULTAT: Cell<(usize, usize)> = const { Cell::new((0, 0)) }; }

/// Disposition alignée sur 8 : les blocs de nombres se lisent en `f64` sans copie.
fn disposition(n: usize) -> Layout { Layout::from_size_align(n.max(1), ALIGN).expect("disposition") }

/// Réserve `n` octets alignés sur 8. Le pointeur rendu appartient à l'appelant jusqu'à `vba_liberer` ou `vba_appel`.
///
/// # Safety
/// `alloc` avec une disposition non nulle (taille au moins 1, alignement 8) rend un pointeur valide pour
/// `n.max(1)` octets, ou le processus avorte : l'allocateur du binaire ne renvoie pas nul (`panic = abort`).
#[no_mangle]
pub extern "C" fn vba_reserver(n: usize) -> *mut u8 {
    // Invariant : disposition non nulle, donc le pointeur est aligné et exclusive jusqu'à libération.
    unsafe { alloc(disposition(n)) }
}

/// Libère un tampon issu de `vba_reserver`.
///
/// # Safety
/// `p` est le pointeur rendu par `vba_reserver(n)` pour ce même `n`, et il n'a pas encore été libéré.
#[no_mangle]
pub unsafe extern "C" fn vba_liberer(p: *mut u8, n: usize) {
    // Invariant : même disposition qu'à l'allocation, pointeur encore vivant.
    unsafe { dealloc(p, disposition(n)) }
}

#[no_mangle]
pub extern "C" fn vba_resultat() -> *const u8 { RESULTAT.with(|r| r.get().0 as *const u8) }

#[no_mangle]
pub extern "C" fn vba_liberer_resultat() {
    RESULTAT.with(|r| {
        let (p, n) = r.get();
        if p != 0 {
            // Invariant : `(p, n)` a été écrit par `vba_appel` et n'a pas encore été libéré.
            unsafe { dealloc(p as *mut u8, disposition(n)) }
        }
        r.set((0, 0));
    });
}

#[must_use]
pub fn executer(entree: &[u8]) -> Vec<u8> {
    let v = match decoder(entree) {
        Ok(v) => match appeler(0, &v) {
            Ok(v) => v,
            Err(Echec::Js { nom, message }) => Valeur::Erreur { nom: nom.into(), message },
            Err(Echec::HorsDomaine(raison)) => Valeur::Erreur { nom: "HorsDomaine".into(), message: raison },
        },
        Err(e) => Valeur::Erreur { nom: "TypeError".into(), message: e.0 },
    };
    encoder(&v)
}

/// Appelle le cœur. `p` est libéré ici ; le résultat se lit par `vba_resultat` puis `vba_liberer_resultat`.
///
/// # Safety
/// `p` vient de `vba_reserver(n)`, les `n` octets sont initialisés, et ce tampon n'est plus utilisé après l'appel.
#[no_mangle]
pub unsafe extern "C" fn vba_appel(_fonction: u32, p: *mut u8, n: usize) -> usize {
    vba_liberer_resultat();
    // Invariant : `p` est lisible sur `n` octets (écrits par la coquille avant l'appel).
    let sortie = unsafe { executer(std::slice::from_raw_parts(p, n)) };
    // Invariant : même couple `(p, n)` que `vba_reserver`, encore vivant.
    unsafe { vba_liberer(p, n) };
    // Invariant : disposition non nulle ; `q` reçoit exactement `sortie.len()` octets initialisés.
    let q = unsafe { alloc(disposition(sortie.len())) };
    unsafe { std::ptr::copy_nonoverlapping(sortie.as_ptr(), q, sortie.len()) };
    RESULTAT.with(|r| r.set((q as usize, sortie.len())));
    sortie.len()
}
