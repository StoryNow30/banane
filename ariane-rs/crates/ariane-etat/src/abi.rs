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
/// `n.max(1)` octets, ou le processus avorte : un pointeur nul passe par `handle_alloc_error`.
#[no_mangle]
pub extern "C" fn vba_reserver(n: usize) -> *mut u8 {
    let d = disposition(n);
    // SÛRETÉ : `d` a une taille non nulle (`n.max(1)`) et un alignement de 8. Le pointeur est rendu
    // tel quel à la coquille, qui n'en écrit que `n` octets et le rend par `vba_appel` ou `vba_liberer`
    // avec le même `n`.
    let p = unsafe { alloc(d) };
    if p.is_null() { std::alloc::handle_alloc_error(d); }
    p
}

/// Libère un tampon issu de `vba_reserver`.
///
/// # Safety
/// `p` est le pointeur rendu par `vba_reserver(n)` pour ce même `n`, et il n'a pas encore été libéré.
#[no_mangle]
// SÛRETÉ : `p` est le pointeur rendu par `vba_reserver(n)` pour ce même `n`, et il n'a pas encore été libéré.
pub unsafe extern "C" fn vba_liberer(p: *mut u8, n: usize) {
    // SÛRETÉ : contrat de l'appelant ci-dessus ; même disposition qu'à l'allocation.
    unsafe { dealloc(p, disposition(n)) }
}

/// Pointeur du dernier résultat, ou nul si aucun appel n'est en attente de lecture.
#[no_mangle]
pub extern "C" fn vba_resultat() -> *const u8 { RESULTAT.with(|r| r.get().0 as *const u8) }

/// Libère le dernier résultat. Sans effet s'il n'y en a pas.
#[no_mangle]
pub extern "C" fn vba_liberer_resultat() {
    RESULTAT.with(|r| {
        let (p, n) = r.get();
        if p != 0 {
            // SÛRETÉ : `(p, n)` a été posé par `vba_appel` à partir d'une allocation de `disposition(n)`,
            // jamais rendue depuis (la cellule est remise à zéro juste après).
            unsafe { dealloc(p as *mut u8, disposition(n)) }
        }
        r.set((0, 0));
    });
}

/// Décode l'entrée, appelle `appeler`, et réencode la valeur ou l'erreur.
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
// SÛRETÉ : `p` vient de `vba_reserver(n)`, les `n` octets sont initialisés, et ce tampon n'est plus utilisé après l'appel.
pub unsafe extern "C" fn vba_appel(_fonction: u32, p: *mut u8, n: usize) -> usize {
    vba_liberer_resultat();
    // SÛRETÉ : `p` désigne `n` octets initialisés (contrat de l'appelant), lus avant d'être rendus.
    let sortie = unsafe { executer(std::slice::from_raw_parts(p, n)) };
    // SÛRETÉ : même `p` et même `n` qu'à la réservation ; plus aucune référence vers l'entrée (`executer` a fini).
    unsafe { vba_liberer(p, n) };
    let d = disposition(sortie.len());
    // SÛRETÉ : taille non nulle ; l'allocation reçoit exactement `sortie.len()` octets, puis devient la réponse
    // courante, rendue par `vba_liberer_resultat`.
    let q = unsafe { alloc(d) };
    if q.is_null() { std::alloc::handle_alloc_error(d); }
    // SÛRETÉ : `q` vaut au moins `sortie.len()` octets, et les deux zones sont distinctes (allocation neuve).
    unsafe { std::ptr::copy_nonoverlapping(sortie.as_ptr(), q, sortie.len()) };
    RESULTAT.with(|r| r.set((q as usize, sortie.len())));
    sortie.len()
}

#[cfg(test)]
mod essais {
    use super::*;

    fn entree_actif() -> Vec<u8> {
        encoder(&Valeur::Objet(vec![
            ("f".into(), Valeur::Chaine("listeActif".into())),
            ("reglage".into(), Valeur::Indefini),
        ]))
    }

    #[test]
    fn essai_vba_reserver() {
        let p = super::vba_reserver(8);
        assert!(!p.is_null());
        assert_eq!(p as usize % 8, 0);
        // SÛRETÉ : `p` vient de `vba_reserver(8)` et n'a pas été libéré.
        unsafe { super::vba_liberer(p, 8) };
    }

    #[test]
    fn essai_vba_liberer() {
        let p = super::vba_reserver(1);
        // SÛRETÉ : même pointeur et même taille que `vba_reserver(1)`.
        unsafe { super::vba_liberer(p, 1) };
    }

    #[test]
    fn essai_vba_resultat() {
        super::vba_liberer_resultat();
        assert!(super::vba_resultat().is_null());
    }

    #[test]
    fn essai_vba_liberer_resultat() {
        super::vba_liberer_resultat();
        super::vba_liberer_resultat();
        assert!(super::vba_resultat().is_null());
    }

    #[test]
    fn essai_executer() {
        let brut = entree_actif();
        let v = decoder(&super::executer(&brut)).expect("vba");
        assert_eq!(v, Valeur::Booleen(true));
    }

    #[test]
    fn essai_vba_appel() {
        let entree = entree_actif();
        let n = entree.len();
        let p = super::vba_reserver(n);
        // SÛRETÉ : `p` vient de `vba_reserver(n)` et reçoit exactement les `n` octets de l'entrée.
        unsafe { std::ptr::copy_nonoverlapping(entree.as_ptr(), p, n) };
        // SÛRETÉ : `p` est le tampon réservé, initialisé sur `n` octets, rendu par cet appel.
        let len = unsafe { super::vba_appel(0, p, n) };
        let q = super::vba_resultat();
        assert!(!q.is_null());
        // SÛRETÉ : `q` désigne les `len` octets posés par `vba_appel`, encore vivants.
        let recu = unsafe { std::slice::from_raw_parts(q, len) }.to_vec();
        super::vba_liberer_resultat();
        assert_eq!(recu, super::executer(&entree));
        assert!(super::vba_resultat().is_null());
    }
}
