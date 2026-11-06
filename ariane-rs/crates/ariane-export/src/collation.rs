//! `String.prototype.localeCompare` (ICU, racine ; la locale française n'y change rien pour l'ASCII) restreint à l'ASCII
//! imprimable (0x20–0x7E). Mesuré (Node et Chromium) : aucun caractère ignorable, un poids primaire distinct par signe,
//! la casse au niveau tertiaire (minuscule avant majuscule). Au-delà de ce domaine : hors domaine (repli JS).
use ariane_js::Echec;
use core::cmp::Ordering;

/// Ordre primaire des signes ASCII imprimables (lettres : la minuscule et la majuscule partagent le même poids).
const ORDRE: &str = " _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$0123456789abcdefghijklmnopqrstuvwxyz";

fn poids(c: u8) -> Option<u8> {
    let l = c.to_ascii_lowercase();
    ORDRE.bytes().position(|x| x == l).and_then(|p| u8::try_from(p).ok())
}

/// Vrai si `localeCompare` est porté pour ce texte.
#[must_use]
pub fn porte(s: &str) -> bool { s.bytes().all(|c| (0x20..=0x7e).contains(&c)) }

/// `a.localeCompare(b)` (signe seulement).
///
/// # Errors
/// `HorsDomaine` hors de l'ASCII imprimable.
pub fn comparer(a: &str, b: &str) -> Result<Ordering, Echec> {
    if !porte(a) || !porte(b) { return Err(Echec::hors_domaine("localeCompare hors de l'ASCII imprimable")); }
    let pa = a.bytes().filter_map(poids);
    let pb = b.bytes().filter_map(poids);
    match pa.cmp(pb) {
        Ordering::Equal => {}
        o => return Ok(o),
    }
    // même suite primaire : même longueur ; la casse décide au premier écart (minuscule d'abord)
    for (x, y) in a.bytes().zip(b.bytes()) {
        match (x.is_ascii_uppercase(), y.is_ascii_uppercase()) { (false, true) => return Ok(Ordering::Less), (true, false) => return Ok(Ordering::Greater), _ => {} }
    }
    Ok(Ordering::Equal)
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn comme_icu() {
        assert_eq!(comparer("a", "B").unwrap(), Ordering::Less);
        assert_eq!(comparer("a-b", "ab").unwrap(), Ordering::Less);
        assert_eq!(comparer("A", "a").unwrap(), Ordering::Greater);
        assert_eq!(comparer("aB", "Ab").unwrap(), Ordering::Less);
        assert_eq!(comparer("", "a").unwrap(), Ordering::Less);
        assert_eq!(comparer("2026-11-06T10:00:00.000Z", "2026-11-06T09:59:59.999Z").unwrap(), Ordering::Greater);
        assert_eq!(comparer("x", "x").unwrap(), Ordering::Equal);
        assert!(comparer("é", "e").is_err());
        assert!(porte("abc") && !porte("\n"));
    }
}
