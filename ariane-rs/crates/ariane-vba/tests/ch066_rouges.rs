//! CH-066 : essais ROUGES des défauts trouvés côté Rust (marqués `ignore` pour que `cargo test` reste vert tant que le
//! chef de CH-064 n'a pas corrigé ; les lancer : `cargo test -p ariane-vba --test ch066_rouges -- --ignored`).
//! Chacun est minimal et porte la référence du défaut dans chantiers/CH-066/rapport.md.
use ariane_vba::{decoder, encoder, Valeur, ENTETE};
use std::alloc::{GlobalAlloc, Layout, System};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

/// Allocateur compteur : octets vivants et haute eau (mesure de l'amplification mémoire du décodeur).
struct Compteur;
static VIVANTS: AtomicUsize = AtomicUsize::new(0);
static HAUTE_EAU: AtomicUsize = AtomicUsize::new(0);
static SEUL: Mutex<()> = Mutex::new(());
// SÛRETÉ : délègue à l'allocateur système, avec la même disposition ; ne fait que compter.
unsafe impl GlobalAlloc for Compteur {
    unsafe fn alloc(&self, l: Layout) -> *mut u8 {
        let v = VIVANTS.fetch_add(l.size(), Ordering::SeqCst) + l.size();
        HAUTE_EAU.fetch_max(v, Ordering::SeqCst);
        // SÛRETÉ : contrat de `GlobalAlloc::alloc`, transmis tel quel.
        unsafe { System.alloc(l) }
    }
    unsafe fn dealloc(&self, p: *mut u8, l: Layout) {
        VIVANTS.fetch_sub(l.size(), Ordering::SeqCst);
        // SÛRETÉ : `p` vient de `alloc` avec la même disposition.
        unsafe { System.dealloc(p, l) }
    }
}
#[global_allocator]
static A: Compteur = Compteur;

/// Haute eau des allocations pendant `f` (au-dessus de ce qui vivait avant).
fn haute_eau<T>(f: impl FnOnce() -> T) -> (T, usize) {
    let _g = SEUL.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let base = VIVANTS.load(Ordering::SeqCst);
    HAUTE_EAU.store(base, Ordering::SeqCst);
    let r = f();
    (r, HAUTE_EAU.load(Ordering::SeqCst) - base)
}

fn trame(corps: &[u8]) -> Vec<u8> { let mut t = ENTETE.to_vec(); t.extend_from_slice(corps); t }

/// R1 (P2) : une trame de 2 564 octets (512 tableaux annonçant 2^32-1 éléments, imbriqués, tronqués) fait réserver
/// `min(n, 65 536)` places à chaque niveau AVANT de lire un seul élément. En WASM (plafond 256 Mio) : trappe du cœur.
/// Attendu : la mémoire réservée reste proportionnelle à la trame lue (ici : moins de 1 Mio).
#[test]
#[ignore = "CH-066 rouge R1 : amplification mémoire du décodeur (Vec::with_capacity sur une longueur annoncée)"]
fn r1_reservation_proportionnelle_a_la_trame() {
    for e in [0x06u8, 0x08] {
        let mut corps = vec![];
        for _ in 0..512 { corps.push(e); corps.extend_from_slice(&u32::MAX.to_le_bytes()); if e == 0x08 { corps.extend_from_slice(&[1, 0, 0, 0, b'a']); } }
        let t = trame(&corps);
        let (r, octets) = haute_eau(|| decoder(&t));
        assert!(r.is_err());
        assert!(octets < 1 << 20, "étiquette {e:#04x} : trame de {} octets, {octets} octets réservés", t.len());
    }
}

/// R2 (P3) : l'encodeur panique sur un bloc de k = 0 (division par zéro) bâti en Rust. En WASM : trappe, repli JS.
/// Attendu : jamais de panique ; une trame que la coquille sait lire.
#[test]
#[ignore = "CH-066 rouge R2 : encoder panique sur Valeur::Bloc { k: 0 }"]
fn r2_encoder_bloc_k_nul_sans_panique() {
    let v = Valeur::Bloc { k: 0, donnees: vec![] };
    let t = catch_unwind(AssertUnwindSafe(|| encoder(&v))).expect("panique de l'encodeur");
    assert!(decoder(&t).is_ok(), "{t:02x?}");
}

/// R3 (P3) : l'encodeur écrit, pour une valeur bâtie en Rust sans passer par `canonique()`, des trames que tout décodeur
/// refuse (`Nombres`/`Booleens`/`Bloc` vides ; bloc de longueur non multiple de k). La coquille lève alors
/// « VBA : … » et la façade rejoue le JS (repli de format).
/// Attendu : la trame se relit (vide → tableau vide, comme `canonique()`).
#[test]
#[ignore = "CH-066 rouge R3 : encoder écrit des trames refusées pour des tableaux typés vides ou un bloc incomplet"]
fn r3_encoder_ne_produit_que_des_trames_lisibles() {
    for v in [Valeur::Nombres(vec![]), Valeur::Booleens(vec![]), Valeur::Bloc { k: 3, donnees: vec![] }, Valeur::Bloc { k: 2, donnees: vec![1.0, 2.0, 3.0] }] {
        let t = encoder(&v);
        assert!(decoder(&t).is_ok(), "{v:?} → {t:02x?} : {:?}", decoder(&t));
    }
}

/// R4 (P3) : `canonique()` se dit « la trame que l'encodeur de la coquille produirait », mais garde l'ordre Rust des clés
/// entières et les clés en double. Le JS, lui, range les clés d'index d'abord (ordre croissant) et garde UNE clé (la
/// première place, la dernière valeur). La trame Rust se relit donc en JS autrement qu'elle ne s'écrit, et
/// `champ("a")` (première occurrence) ne lit pas la même valeur que le JS (dernière).
#[test]
#[ignore = "CH-066 rouge R4 : canonique() ne range pas les clés entières et ne fusionne pas les clés en double"]
fn r4_canonique_range_les_cles_comme_le_js() {
    let o = Valeur::Objet(vec![("b".into(), Valeur::Nul), ("1".into(), Valeur::Nul), ("0".into(), Valeur::Nul)]);
    let cles: Vec<String> = match o.canonique() { Valeur::Objet(t) => t.into_iter().map(|(k, _)| k).collect(), _ => vec![] };
    assert_eq!(cles, ["0", "1", "b"]);
    let d = Valeur::Objet(vec![("a".into(), Valeur::Booleen(false)), ("z".into(), Valeur::Nul), ("a".into(), Valeur::Booleen(true))]);
    assert_eq!(d.canonique(), Valeur::Objet(vec![("a".into(), Valeur::Booleen(true)), ("z".into(), Valeur::Nul)]));
}
