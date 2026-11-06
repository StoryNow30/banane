//! `new Date(nombre).toISOString()` (ECMA-262 : `TimeClip`, puis la forme `YYYY-MM-DDTHH:mm:ss.sssZ`, années étendues
//! `±YYYYYY` hors de [0 ; 9999]). Aucune analyse de texte ici (`Date.parse` reste en JS).

/// Valeur de temps après `TimeClip` : `None` (date invalide) si non finie ou |t| > 8,64e15 ; sinon tronquée, +0.
#[must_use]
pub fn time_clip(t: f64) -> Option<i64> {
    if !t.is_finite() || t.abs() > 8.64e15 { return None; }
    #[allow(clippy::cast_possible_truncation)] // |t| ≤ 8,64e15 < 2^63, entier après troncature
    Some(t.trunc() as i64)
}

/// Jour civil (année, mois 1–12, jour 1–31) d'un nombre de jours depuis le 1970-01-01 (algorithme de H. Hinnant).
#[must_use]
pub fn civil(jours: i64) -> (i64, i64, i64) {
    let z = jours + 719_468;
    let ere = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + ere * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// `new Date(t).toISOString()` ; `None` quand le JS lève `RangeError: Invalid time value`.
#[must_use]
pub fn iso(t: f64) -> Option<String> {
    let t = time_clip(t)?;
    let jours = t.div_euclid(86_400_000);
    let ms = t.rem_euclid(86_400_000);
    let (y, m, d) = civil(jours);
    let an = if (0..=9999).contains(&y) { format!("{y:04}") } else if y < 0 { format!("-{:06}", -y) } else { format!("+{y:06}") };
    Some(format!("{an}-{m:02}-{d:02}T{:02}:{:02}:{:02}.{:03}Z", ms / 3_600_000, ms / 60_000 % 60, ms / 1000 % 60, ms % 1000))
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn comme_to_iso_string() {
        assert_eq!(iso(0.0).as_deref(), Some("1970-01-01T00:00:00.000Z"));
        assert_eq!(iso(-1.0).as_deref(), Some("1969-12-31T23:59:59.999Z"));
        assert_eq!(iso(1_762_430_400_123.9).as_deref(), Some("2025-11-06T12:00:00.123Z"));
        assert_eq!(iso(-0.5).as_deref(), Some("1970-01-01T00:00:00.000Z"));
        assert_eq!(iso(8.64e15).as_deref(), Some("+275760-09-13T00:00:00.000Z"));
        assert_eq!(iso(-8.64e15).as_deref(), Some("-271821-04-20T00:00:00.000Z"));
        assert_eq!(iso(-62_198_755_200_000.0).as_deref(), Some("-000001-01-01T00:00:00.000Z"));
        assert_eq!(iso(f64::NAN), None);
        assert_eq!(iso(8.64e15 + 1.0), None);
        assert_eq!(time_clip(3.7), Some(3));
        assert_eq!(civil(0), (1970, 1, 1));
    }
}
