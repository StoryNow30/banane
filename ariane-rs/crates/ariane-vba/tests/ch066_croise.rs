//! CH-066 : croisement natif JS ↔ Rust par fichiers de trames (u32 longueur petit-boutiste, puis la trame).
//! - `CH066_TRAMES_JS=f` : trames écrites par `node tools/ch066-fuzz-vba.cjs --ecrire-trames f` ; chacune se relit en Rust,
//!   se réencode à l'octet, et sa forme `canonique()` est déjà la trame (le JS n'écrit que des trames canoniques).
//! - `CH066_TRAMES_RUST=f` : écrit des trames canoniques Rust que `--lire-trames f` relit et réécrit côté JS.
//!
//! Sans ces variables, les deux essais ne font rien (ils restent verts dans `cargo test`).
mod commun;
use ariane_vba::{decoder, encoder};
use commun::{valeur, Alea};

#[test]
fn trames_js_relues_par_le_rust() {
    let Ok(f) = std::env::var("CH066_TRAMES_JS") else { return };
    let b = std::fs::read(&f).expect("fichier de trames JS");
    let (mut p, mut n) = (0usize, 0usize);
    while p < b.len() {
        let l = u32::from_le_bytes([b[p], b[p + 1], b[p + 2], b[p + 3]]) as usize;
        let t = &b[p + 4..p + 4 + l];
        p += 4 + l;
        n += 1;
        let v = decoder(t).unwrap_or_else(|e| panic!("trame JS n° {n} refusée : {e:?}"));
        assert_eq!(encoder(&v), t, "trame JS n° {n} réencodée autrement");
        assert_eq!(encoder(&v.canonique()), t, "trame JS n° {n} : canonique() la change");
    }
    println!("CH-066 : {n} trames JS relues, réencodées et canoniques");
}

#[test]
fn trames_rust_pour_le_js() {
    let Ok(f) = std::env::var("CH066_TRAMES_RUST") else { return };
    let mut a = Alea::new(70);
    let mut sortie = vec![];
    for _ in 0..20_000 {
        let t = encoder(&valeur(&mut a, 0).canonique());
        sortie.extend_from_slice(&u32::try_from(t.len()).expect("trame < 4 Gio").to_le_bytes());
        sortie.extend_from_slice(&t);
    }
    std::fs::write(&f, sortie).expect("écriture des trames Rust");
}
