//! Allocateur du cœur WASM : une arène à pointeur, remise à zéro au début de chaque appel (`vba_reserver`).
//!
//! Pourquoi (mesuré, CH-064) : avec l'allocateur par défaut (dlmalloc), la mémoire linéaire grandit par petits pas ; chaque
//! `memory.grow` déclenchait dans V8 un ramasse-miettes complet du tas JS. Sur un journal de lot de 125 Mo, 72 % du temps
//! passait dans le ramasse-miettes et l'écho de la trame dépassait dix minutes (0,9 s en natif). Ici :
//! - la mémoire grandit par DOUBLEMENT (quelques croissances seulement, même pour des centaines de Mo) ;
//! - rien ne survit à un appel (le cœur n'a pas d'état entre deux appels, plan § D) : l'arène repart à son début au
//!   prochain `vba_reserver`, et la mémoire d'un appel est bornée par sa haute eau ; la coquille réinstancie au-delà
//!   de son seuil ;
//! - `dealloc` et `realloc` de la DERNIÈRE allocation reculent ou étendent sur place (les `Vec` qui grandissent) ;
//!   les autres libérations ne rendent rien avant la remise à zéro.
//!
//! Mono-fil : WASM sans fils d'exécution ; aucune synchronisation.
use core::alloc::{GlobalAlloc, Layout};
use core::arch::wasm32::{memory_grow, memory_size};
use core::cell::Cell;

const PAGE: usize = 65_536;

/// État de l'arène : début (fixé au premier usage), sommet, fin de la mémoire, et dernière allocation.
pub struct Arene {
    debut: Cell<usize>,
    sommet: Cell<usize>,
    fin: Cell<usize>,
    dernier: Cell<usize>,
}

// SÛRETÉ : la cible wasm32-unknown-unknown est mono-fil ; aucun accès concurrent aux cellules n'est possible.
unsafe impl Sync for Arene {}

impl Arene {
    /// Arène vide ; elle se fixe sur la fin de la mémoire au premier usage.
    #[must_use]
    pub const fn new() -> Self { Arene { debut: Cell::new(0), sommet: Cell::new(0), fin: Cell::new(0), dernier: Cell::new(0) } }

    fn initialiser(&self) {
        if self.debut.get() == 0 {
            let fin = memory_size(0) * PAGE;
            self.debut.set(fin);
            self.sommet.set(fin);
            self.fin.set(fin);
        }
    }

    /// Fait en sorte que la mémoire couvre `jusqu_a` octets : doublement, sinon le juste nécessaire ; false si impossible.
    fn couvrir(&self, jusqu_a: usize) -> bool {
        if jusqu_a <= self.fin.get() { return true; }
        let manque = (jusqu_a - self.fin.get()).div_ceil(PAGE);
        let pages = manque.max(memory_size(0));
        for p in [pages, manque] {
            if memory_grow(0, p) != usize::MAX {
                self.fin.set(self.fin.get() + p * PAGE);
                return true;
            }
        }
        false
    }

    /// Remet l'arène à son début : toutes les allocations précédentes sont mortes (fin d'un cycle d'appel).
    pub fn remettre_a_zero(&self) {
        self.initialiser();
        self.sommet.set(self.debut.get());
        self.dernier.set(0);
    }

    /// Octets occupés depuis la dernière remise à zéro (haute eau d'un appel).
    pub fn occupe(&self) -> usize { self.sommet.get() - self.debut.get() }
}

impl Default for Arene { fn default() -> Self { Self::new() } }

// SÛRETÉ (contrat de GlobalAlloc) : chaque bloc rendu est aligné sur `layout.align()`, de `layout.size()` octets au moins,
// entièrement dans la mémoire linéaire (couverte avant d'être rendue) et disjoint de tout autre bloc vivant : le sommet ne
// fait que croître entre deux remises à zéro, et ne recule que sur la dernière allocation libérée. La remise à zéro n'est
// faite que par `vba_reserver`, quand la coquille a fini d'utiliser toutes les données de l'appel précédent.
unsafe impl GlobalAlloc for Arene {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        self.initialiser();
        let p = self.sommet.get().next_multiple_of(layout.align());
        let Some(fin) = p.checked_add(layout.size()) else { return core::ptr::null_mut() };
        if !self.couvrir(fin) { return core::ptr::null_mut(); }
        self.sommet.set(fin);
        self.dernier.set(p);
        p as *mut u8
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        let p = ptr as usize;
        if p == self.dernier.get() && p + layout.size() == self.sommet.get() {
            self.sommet.set(p);
            self.dernier.set(0);
        }
    }

    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, taille: usize) -> *mut u8 {
        let p = ptr as usize;
        if p == self.dernier.get() && p + layout.size() == self.sommet.get() {
            let Some(fin) = p.checked_add(taille) else { return core::ptr::null_mut() };
            if !self.couvrir(fin) { return core::ptr::null_mut(); }
            self.sommet.set(fin);
            return ptr;
        }
        // SÛRETÉ : `layout` décrit le bloc `ptr` (contrat de l'appelant) ; la nouvelle disposition garde son alignement.
        let nouveau = unsafe { self.alloc(Layout::from_size_align_unchecked(taille, layout.align())) };
        if !nouveau.is_null() {
            // SÛRETÉ : les deux blocs sont vivants et disjoints (le nouveau est au-delà de l'ancien sommet).
            unsafe { core::ptr::copy_nonoverlapping(ptr, nouveau, layout.size().min(taille)) };
        }
        nouveau
    }
}

/// L'allocateur du cœur WASM.
#[global_allocator]
pub static ARENE: Arene = Arene::new();
