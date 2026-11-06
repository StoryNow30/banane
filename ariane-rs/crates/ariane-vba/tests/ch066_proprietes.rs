//! CH-066 : essais par propriétés du format VBA côté Rust (générateur maison à graine fixe, sans dépendance).
//! - toute valeur valide : `decoder(encoder(v))` réencode la même trame ;
//! - toute trame (mutée, forgée, aléatoire) : décoder ne panique jamais ; si elle est lue, la réencoder rend la même
//!   trame octet pour octet, sinon `ErreurVba` préfixée « VBA : ».
// octets tirés au hasard : la troncature en u8 est voulue
#![allow(clippy::cast_possible_truncation)]
mod commun;
use ariane_vba::{decoder, encoder, ErreurVba, Valeur, ENTETE};
use commun::{muter, valeur, Alea};
use std::panic::{catch_unwind, AssertUnwindSafe};

const CAS: usize = 20_000;

/// La propriété du ticket, pour une trame : jamais de panique, et lecture ⇒ réencodage identique.
fn propriete(t: &[u8]) -> Result<bool, String> {
    let r = catch_unwind(AssertUnwindSafe(|| decoder(t))).map_err(|_| format!("panique au décodage de {t:02x?}"))?;
    match r {
        Ok(v) => {
            let u = catch_unwind(AssertUnwindSafe(|| encoder(&v))).map_err(|_| format!("panique au réencodage de {t:02x?}"))?;
            if u == t { Ok(true) } else { Err(format!("réencodage différent : {t:02x?} → {u:02x?}")) }
        }
        Err(ErreurVba(m)) if m.starts_with("VBA : ") => Ok(false),
        Err(ErreurVba(m)) => Err(format!("refus sans préfixe : {m}")),
    }
}

#[test]
fn aller_retour_des_valeurs_valides() {
    let mut a = Alea::new(66);
    for i in 0..CAS {
        let v = valeur(&mut a, 0);
        let t = encoder(&v);
        assert_eq!(propriete(&t), Ok(true), "cas {i} : {v:?}");
    }
}

#[test]
fn trames_mutees() {
    let mut a = Alea::new(67);
    let (mut lues, mut refusees) = (0usize, 0usize);
    for i in 0..CAS {
        let t = encoder(&valeur(&mut a, 0));
        let m = muter(&mut a, &t);
        match propriete(&m) { Ok(true) => lues += 1, Ok(false) => refusees += 1, Err(e) => panic!("mutation {i} : {e}") }
    }
    assert_eq!(lues + refusees, CAS);
    assert!(refusees > 0 && lues > 0, "le générateur couvre les deux issues ({lues} lues, {refusees} refusées)");
}

#[test]
fn trames_aleatoires() {
    let mut a = Alea::new(68);
    for i in 0..CAS {
        let mut t = ENTETE.to_vec();
        // octets biaisés vers les étiquettes connues et les petites longueurs, pour descendre dans la grammaire
        for _ in 0..a.ent(40) {
            t.push(match a.ent(4) { 0 => a.ent(0x0D) as u8, 1 => 0, 2 => a.ent(4) as u8, _ => a.u64() as u8 });
        }
        if let Err(e) = propriete(&t) { panic!("trame aléatoire {i} : {e}"); }
    }
}

#[test]
fn toutes_les_troncatures() {
    let mut a = Alea::new(69);
    for _ in 0..200 {
        let t = encoder(&valeur(&mut a, 0));
        for n in 0..t.len() { assert_eq!(propriete(&t[..n]), Ok(false), "troncature à {n} de {t:02x?}"); }
    }
}

fn trame(corps: &[u8]) -> Vec<u8> { let mut t = ENTETE.to_vec(); t.extend_from_slice(corps); t }
fn u32le(n: u32) -> [u8; 4] { n.to_le_bytes() }

#[test]
fn trames_forgees() {
    let mut cas: Vec<(&str, Vec<u8>)> = vec![];
    for n in [u32::MAX, 0x8000_0001, 0x2000_0000] {
        for e in [0x05u8, 0x06, 0x08, 0x0A, 0x0B] { cas.push(("taille énorme", trame(&[&[e][..], &u32le(n)].concat()))); }
        cas.push(("bloc énorme", trame(&[&[0x09][..], &u32le(n), &[0xFF, 0, 0, 0, 0, 0, 0]].concat())));
    }
    for e in 0x0D..=0xFF { cas.push(("étiquette inconnue", trame(&[e]))); }
    cas.push(("bloc k = 0", trame(&[&[0x09][..], &u32le(1), &[0, 0, 0]].concat())));
    cas.push(("trou dans un objet", trame(&[&[0x08][..], &u32le(1), &u32le(1), b"a", &[0x07]].concat())));
    cas.push(("trou en racine", trame(&[0x07])));
    cas.push(("513 niveaux", trame(&[[0x06u8, 1, 0, 0, 0].repeat(513), vec![0]].concat())));
    cas.push(("bourrage non nul", trame(&[&[0x0A][..], &u32le(1), &[0, 0, 0, 1], &[0; 8]].concat())));
    cas.push(("UTF-8 invalide", trame(&[&[0x05][..], &u32le(2), &[0xC0, 0x80]].concat())));
    cas.push(("surrogat en UTF-8", trame(&[&[0x05][..], &u32le(3), &[0xED, 0xA0, 0x80]].concat())));
    for (nom, t) in &cas { assert_eq!(propriete(t), Ok(false), "{nom} : {t:02x?}"); }
    // lisibles mais non canoniques : la propriété (réencodage identique) tient quand même côté Rust
    let lisibles = [
        trame(&[&[0x06][..], &u32le(1), &[0x04], &1.0f64.to_le_bytes()].concat()),
        trame(&[&[0x08][..], &u32le(2), &u32le(1), b"a", &[0x02], &u32le(1), b"a", &[0x03]].concat()),
        trame(&[&[0x06][..], &u32le(1), &[0x0C], &u32le(1), b"E", &u32le(0)].concat()),
        trame(&[&[0x06][..], &u32le(512), &[0x07].repeat(512)].concat()),
    ];
    for t in &lisibles { assert_eq!(propriete(t), Ok(true), "{t:02x?}"); }
    assert!(matches!(decoder(&lisibles[3]), Ok(Valeur::Tableau(v)) if v.len() == 512 && v.iter().all(Option::is_none)));
}
