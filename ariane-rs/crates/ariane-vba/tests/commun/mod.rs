//! CH-066 : générateur à graine fixe partagé par les essais par propriétés (sans dépendance).
#![allow(dead_code, clippy::cast_possible_truncation)]
use ariane_vba::Valeur;

/// xorshift64* : reproductible, sans dépendance.
pub struct Alea(u64);
impl Alea {
    pub fn new(graine: u64) -> Self { Alea(graine.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1) }
    pub fn u64(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }
    pub fn ent(&mut self, n: usize) -> usize { (self.u64() % n as u64) as usize }
    pub fn proba(&mut self, p: f64) -> bool { (self.u64() >> 11) as f64 / (1u64 << 53) as f64 + 0.0 < p }
}

const SPECIAUX: [f64; 12] = [0.0, -0.0, f64::NAN, f64::INFINITY, f64::NEG_INFINITY, 5e-324, -5e-324, f64::MAX, f64::MIN_POSITIVE,
    9_007_199_254_740_992.0, 9_007_199_254_740_994.0, 0.1];
pub fn nombre(a: &mut Alea) -> f64 {
    match a.ent(4) {
        0 => SPECIAUX[a.ent(SPECIAUX.len())],
        1 => f64::from_bits(a.u64()), // bits quelconques : NaN à charge, sous-normaux
        2 => a.ent(2000) as f64 - 1000.0,
        _ => (a.u64() as f64) * if a.proba(0.5) { -1.0 } else { 1.0 },
    }
}
const MORCEAUX: [&str; 12] = ["a", "z", "é", "💥", "\u{0}", "\u{FEFF}", "\u{FFFF}", "\u{10FFFF}", "__proto__", "1", "10", "constructor"];
pub fn chaine(a: &mut Alea) -> String {
    let n = a.ent(6);
    (0..n).map(|_| MORCEAUX[a.ent(MORCEAUX.len())]).collect()
}

/// Valeur quelconque et VALIDE (toute variante sauf celles qu'aucune trame ne porte : `Nombres`/`Booleens`/`Bloc` vides,
/// bloc de k = 0 ou de longueur non multiple de k). Non canonique en général (tableau `Tableau` de nombres, clés en double…).
pub fn valeur(a: &mut Alea, prof: usize) -> Valeur {
    if prof >= 5 || a.proba(0.3 + 0.1 * prof as f64) {
        return match a.ent(7) {
            0 => Valeur::Indefini,
            1 => Valeur::Nul,
            2 => Valeur::Booleen(a.proba(0.5)),
            3 | 4 => Valeur::Nombre(nombre(a)),
            5 => Valeur::Chaine(chaine(a)),
            _ => Valeur::Erreur { nom: chaine(a), message: chaine(a) },
        };
    }
    match a.ent(6) {
        0 => Valeur::Nombres((0..=a.ent(8)).map(|_| nombre(a)).collect()),
        1 => Valeur::Booleens((0..=a.ent(8)).map(|_| a.proba(0.5)).collect()),
        2 => {
            let k = if a.proba(0.1) { 255 } else { 1 + a.ent(4) };
            let n = 1 + a.ent(4);
            Valeur::Bloc { k: k as u8, donnees: (0..n * k).map(|_| nombre(a)).collect() }
        }
        3 | 4 => Valeur::Tableau((0..a.ent(6)).map(|_| if a.proba(0.15) { None } else { Some(valeur(a, prof + 1)) }).collect()),
        _ => Valeur::Objet((0..a.ent(6)).map(|_| (chaine(a), valeur(a, prof + 1))).collect()),
    }
}

/// Mutation d'une trame valide : tronquée, bit, octet, taille énorme, étiquette inconnue, octets en plus, octets ôtés.
pub fn muter(a: &mut Alea, t: &[u8]) -> Vec<u8> {
    let mut o = t.to_vec();
    let corps = o.len().saturating_sub(4).max(1);
    match a.ent(7) {
        0 => { o.truncate(a.ent(o.len())); }
        1 => { if o.len() > 4 { let p = 4 + a.ent(corps); o[p] ^= 1 << a.ent(8); } }
        2 => { if o.len() > 4 { let p = 4 + a.ent(corps); o[p] = a.u64() as u8; } }
        3 => {
            if o.len() >= 9 {
                let p = 4 + a.ent(o.len() - 8);
                let n: u32 = [u32::MAX, 0x7FFF_FFFF, 0x8000_0001, 0x2000_0000, 0x1_0000, 0][a.ent(6)];
                o[p..p + 4].copy_from_slice(&n.to_le_bytes());
            }
        }
        4 => { if o.len() > 4 { let p = 4 + a.ent(corps); o[p] = 0x0D + a.ent(0xF3) as u8; } }
        5 => { for _ in 0..=a.ent(8) { o.push(a.u64() as u8); } }
        _ => { if o.len() > 4 { let d = 4 + a.ent(corps); let f = (d + a.ent(8)).min(o.len()); o.drain(d..f); } }
    }
    o
}
