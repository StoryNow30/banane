//! `Date.parse` et `Date.prototype.toISOString` pour les instants ISO du journal (calendrier grégorien proleptique, sans seconde intercalaire).

fn bissextile(y: i32) -> bool { y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) }

fn jours_avant(y: i32, m: u32, d: u32) -> Option<i64> {
    if !(1..=12).contains(&m) { return None; }
    let mut dim = [0u32, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if bissextile(y) { dim[2] = 29; }
    if d < 1 || d > dim[m as usize] { return None; }
    let mut jours = 0i64;
    if y >= 1970 {
        for yy in 1970..y { jours += if bissextile(yy) { 366 } else { 365 }; }
    } else {
        for yy in y..1970 { jours -= if bissextile(yy) { 366 } else { 365 }; }
    }
    for mm in 1..m { jours += dim[mm as usize] as i64; }
    Some(jours + d as i64 - 1)
}

fn civil(mut jours: i64) -> (i32, u32, u32) {
    // Jours depuis 1970-01-01, peut être négatif.
    let mut y = 1970i32;
    if jours >= 0 {
        loop {
            let n = if bissextile(y) { 366 } else { 365 };
            if jours < n { break; }
            jours -= n;
            y += 1;
        }
    } else {
        loop {
            y -= 1;
            let n = if bissextile(y) { 366 } else { 365 };
            jours += n;
            if jours >= 0 { break; }
        }
    }
    let mut dim = [0u32, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if bissextile(y) { dim[2] = 29; }
    let mut m = 1u32;
    while jours >= dim[m as usize] as i64 { jours -= dim[m as usize] as i64; m += 1; }
    (y, m, jours as u32 + 1)
}

/// Millisecondes UTC, ou `None` si la chaîne n'est pas un instant ISO que le port sait lire.
pub fn parse_iso(s: &str) -> Option<f64> {
    let b = s.as_bytes();
    if b.len() < 10 { return None; }
    let an = std::str::from_utf8(b.get(0..4)?).ok()?.parse::<i32>().ok()?;
    if b.get(4) != Some(&b'-') || b.get(7) != Some(&b'-') { return None; }
    let mois = std::str::from_utf8(b.get(5..7)?).ok()?.parse::<u32>().ok()?;
    let jour = std::str::from_utf8(b.get(8..10)?).ok()?.parse::<u32>().ok()?;
    let mut i = 10usize;
    let (h, mi, sec, ms) = if b.get(i) == Some(&b'T') {
        i += 1;
        if b.len() < i + 8 { return None; }
        let h = std::str::from_utf8(b.get(i..i + 2)?).ok()?.parse::<u32>().ok()?;
        if b.get(i + 2) != Some(&b':') || b.get(i + 5) != Some(&b':') { return None; }
        let mi = std::str::from_utf8(b.get(i + 3..i + 5)?).ok()?.parse::<u32>().ok()?;
        let sec = std::str::from_utf8(b.get(i + 6..i + 8)?).ok()?.parse::<u32>().ok()?;
        if h > 23 || mi > 59 || sec > 59 { return None; }
        i += 8;
        let mut ms = 0u32;
        if b.get(i) == Some(&b'.') {
            i += 1;
            let deb = i;
            while i < b.len() && b[i].is_ascii_digit() { i += 1; }
            if i == deb { return None; }
            let frac = &s[deb..i];
            let mut p = frac.as_bytes().to_vec();
            if p.len() > 3 { p.truncate(3); }
            while p.len() < 3 { p.push(b'0'); }
            ms = std::str::from_utf8(&p).ok()?.parse().ok()?;
        }
        (h, mi, sec, ms)
    } else {
        (0, 0, 0, 0)
    };
    let decalage = if i == b.len() && b.get(10) != Some(&b'T') {
        0i64
    } else if b.get(i) == Some(&b'Z') && i + 1 == b.len() {
        0
    } else if matches!(b.get(i), Some(b'+') | Some(b'-')) && i + 6 == b.len() && b.get(i + 3) == Some(&b':') {
        let signe = if b[i] == b'+' { 1i64 } else { -1 };
        let oh = std::str::from_utf8(b.get(i + 1..i + 3)?).ok()?.parse::<i64>().ok()?;
        let om = std::str::from_utf8(b.get(i + 4..i + 6)?).ok()?.parse::<i64>().ok()?;
        if oh > 23 || om > 59 { return None; }
        signe * (oh * 60 + om) * 60_000
    } else {
        return None;
    };
    let jours = jours_avant(an, mois, jour)?;
    let ms = jours * 86_400_000 + h as i64 * 3_600_000 + mi as i64 * 60_000 + sec as i64 * 1000 + ms as i64;
    Some((ms - decalage) as f64)
}

/// `new Date(ms).toISOString()`.
pub fn vers_iso(ms: f64) -> Option<String> {
    if !ms.is_finite() { return None; }
    let arr = ms.trunc();
    if (ms - arr).abs() >= 0.5 && ms.is_sign_positive() { /* round half? toISOString uses the exact time value, already an integer for Date.parse */ }
    let v = if ms < 0.0 && ms != arr { arr - 1.0 } else { arr };
    // Time value is already integer ms from Date.parse. Trunc toward 0 would be wrong for negatives; our data is positive.
    let n = v as i64;
    let jours = n.div_euclid(86_400_000);
    let mut tod = n.rem_euclid(86_400_000);
    let (y, m, d) = civil(jours);
    let h = tod / 3_600_000; tod %= 3_600_000;
    let mi = tod / 60_000; tod %= 60_000;
    let s = tod / 1000; let milli = tod % 1000;
    Some(format!("{y:04}-{m:02}-{d:02}T{h:02}:{mi:02}:{s:02}.{milli:03}Z"))
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn aller_retour() {
        for s in ["2026-10-31T11:00:00.000Z", "2026-10-31T11:00:00Z", "2026-11-06T12:55:30.123Z", "1970-01-01T00:00:00.000Z"] {
            let ms = parse_iso(s).unwrap();
            let iso = vers_iso(ms).unwrap();
            let attendu = if s.ends_with(".000Z") || !s.contains('.') { s.replace('Z', ".000Z").replace("..000", ".") } else { s.into() };
            let attendu = if s.contains('.') { s.to_string() } else { s.trim_end_matches('Z').to_string() + ".000Z" };
            assert_eq!(iso, attendu, "{s} → {ms}");
        }
        assert_eq!(parse_iso("2026-11-06T12:00:00+02:00"), parse_iso("2026-11-06T10:00:00Z"));
        assert!(parse_iso("2026-02-31T00:00:00Z").is_none());
    }
}
