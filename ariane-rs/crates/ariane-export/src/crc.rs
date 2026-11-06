//! `crc32` de `src/zip-writer.js` (polynôme 0xEDB88320, incrémental) : même table, même ordre des opérations.
use crate::js;
use ariane_js::Echec;
use ariane_vba::Valeur;

const fn table() -> [u32; 256] {
    let mut t = [0u32; 256];
    let mut n = 0;
    while n < 256 {
        #[allow(clippy::cast_possible_truncation)] // n < 256
        let mut c = n as u32;
        let mut k = 0;
        while k < 8 { c = if c & 1 == 1 { 0xEDB8_8320 ^ (c >> 1) } else { c >> 1 }; k += 1; }
        t[n] = c;
        n += 1;
    }
    t
}
static TABLE: [u32; 256] = table();

/// Tables du découpage par 8 octets : `T8[j][n]` = CRC de l'octet n suivi de j octets nuls (arithmétique entière exacte :
/// même résultat, au bit près, que la boucle octet par octet du JS).
const fn tables8() -> [[u32; 256]; 8] {
    let mut t = [[0u32; 256]; 8];
    t[0] = table();
    let mut j = 1;
    while j < 8 {
        let mut n = 0;
        while n < 256 { let c = t[j - 1][n]; t[j][n] = (c >> 8) ^ t[0][(c & 0xFF) as usize]; n += 1; }
        j += 1;
    }
    t
}
static T8: [[u32; 256]; 8] = tables8();

/// `ToInt32` d'ECMA-262 (troncature, modulo 2³², NaN et ±∞ en 0), rendu sur 32 bits.
#[must_use]
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)] // modulo 2^32 exact : |r| < 2^32 avant la conversion
pub fn vers_u32(x: f64) -> u32 {
    if !x.is_finite() { return 0; }
    let r = x.trunc() % 4_294_967_296.0;
    let r = if r < 0.0 { r + 4_294_967_296.0 } else { r };
    r as u64 as u32
}

/// CRC-32 d'octets, en reprenant `crc` (0 au départ).
#[must_use]
pub fn crc32_octets(octets: &[u8], crc: u32) -> u32 {
    let mut c = crc ^ 0xFFFF_FFFF;
    let mut blocs = octets.chunks_exact(8);
    for b in &mut blocs {
        let a = c ^ u32::from_le_bytes([b[0], b[1], b[2], b[3]]);
        c = T8[7][(a & 0xFF) as usize] ^ T8[6][((a >> 8) & 0xFF) as usize] ^ T8[5][((a >> 16) & 0xFF) as usize] ^ T8[4][(a >> 24) as usize]
            ^ T8[3][usize::from(b[4])] ^ T8[2][usize::from(b[5])] ^ T8[1][usize::from(b[6])] ^ T8[0][usize::from(b[7])];
    }
    for &o in blocs.remainder() { c = TABLE[((c ^ u32::from(o)) & 0xFF) as usize] ^ (c >> 8); }
    c ^ 0xFFFF_FFFF
}

/// 200 : `crc32(octets, crc = 0)` sur `{octets: [nombres], crc}` ; chaque élément passe par `ToInt32` comme en JS.
///
/// # Errors
/// `HorsDomaine` si `octets` n'est pas un tableau de nombres ou si `crc` n'est ni un nombre ni absent.
pub fn crc32(e: &Valeur) -> Result<Valeur, Echec> {
    let crc = match js::prop(e, "crc") { Valeur::Indefini => 0, Valeur::Nombre(x) => vers_u32(*x), _ => return Err(Echec::hors_domaine("crc non numérique")) };
    let mut c = crc ^ 0xFFFF_FFFF;
    match js::prop(e, "octets") {
        Valeur::Nombres(t) => for &x in t { c = TABLE[((c ^ vers_u32(x)) & 0xFF) as usize] ^ (c >> 8); },
        Valeur::Tableau(t) if t.is_empty() => {}
        _ => return Err(Echec::hors_domaine("octets : tableau de nombres attendu")),
    }
    Ok(Valeur::Nombre(f64::from(c ^ 0xFFFF_FFFF)))
}

/// Chemin direct de la façade (sans trame VBA) : `n` octets en `p`, CRC précédent `crc`.
///
/// # Safety
/// `p` désigne `n` octets lisibles (tampon réservé par `vba_reserver(n)` et rempli par la coquille).
#[no_mangle]
pub unsafe extern "C" fn ariane_export_crc32(p: *const u8, n: usize, crc: u32) -> u32 {
    if n == 0 { return crc32_octets(&[], crc); }
    // SÛRETÉ : contrat de l'appelant ci-dessus (n octets lisibles en p, non modifiés pendant l'appel).
    crc32_octets(unsafe { std::slice::from_raw_parts(p, n) }, crc)
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn valeurs_connues() {
        assert_eq!(crc32_octets(b"123456789", 0), 0xCBF4_3926);
        assert_eq!(crc32_octets(b"6789", crc32_octets(b"12345", 0)), 0xCBF4_3926);
        // découpage par 8 contre la boucle octet par octet, toutes longueurs de 0 à 40
        let o: Vec<u8> = (0..40u32).map(|i| u8::try_from(i * 37 % 251).unwrap()).collect();
        for n in 0..=40 {
            let mut c = 0xFFFF_FFFFu32;
            for &x in &o[..n] { c = TABLE[((c ^ u32::from(x)) & 0xFF) as usize] ^ (c >> 8); }
            assert_eq!(crc32_octets(&o[..n], 0), c ^ 0xFFFF_FFFF);
        }
        let e = js::objet(vec![("octets", Valeur::Nombres(b"123456789".iter().map(|&b| f64::from(b)).collect()))]);
        assert_eq!(crc32(&e).unwrap(), Valeur::Nombre(f64::from(0xCBF4_3926u32)));
        assert_eq!(crc32(&js::objet(vec![("octets", Valeur::Tableau(vec![]))])).unwrap(), Valeur::Nombre(0.0));
        assert!(crc32(&js::objet(vec![("octets", Valeur::Nul)])).is_err());
        assert_eq!(vers_u32(-1.0), 0xFFFF_FFFF);
        assert_eq!(vers_u32(4_294_967_297.5), 1);
        assert_eq!(vers_u32(f64::NAN), 0);
        // SÛRETÉ (essai) : tampon de 9 octets valide pendant l'appel.
        assert_eq!(unsafe { ariane_export_crc32(b"123456789".as_ptr(), 9, 0) }, 0xCBF4_3926);
    }
}
