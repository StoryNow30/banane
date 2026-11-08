//! `Date.parse` (V8), domaine restreint : la forme ISO 8601 d'ECMA-262 (« Date Time String Format ») AVEC décalage
//! (`Z`, `±HH:mm`) ou date seule (UTC). Seule forme relevée dans les journaux réels du 04 au 06/11 (363 956 dates, toutes
//! de `toISOString`). Au-delà — heure sans décalage (heure LOCALE de l'opérateur), minuscules, espaces, formes que
//! V8 confie à son analyseur « hérité » (implémentation-définie) : hors domaine. Règles relevées sur V8 (Node et Chromium) :
//! jour 1 à 31 quel que soit le mois (31 février = 3 mars) ; fraction de longueur quelconque, tronquée à la
//! milliseconde. Un champ hors plage (mois 13, jour 0, 24 h non nulle, décalage +24:00, année −000000, |t| > 8,64e15) :
//! l'analyseur ISO de V8 refuse, puis son analyseur hérité accepte parfois (« 0003-13 » rend une date) : hors domaine.
//! Seule la chaîne vide rend NaN.
//! Proposé par CH-070 (ariane-session, `js_extra::date`) ; parité : `ariane-rs/parite/session-date.cjs`.
use crate::Echec;

fn hd<T>(raison: &str) -> Result<T, Echec> { Err(Echec::hors_domaine(raison)) }

fn chiffres(o: &[u8], i: usize, n: usize) -> Option<i64> {
    let t = o.get(i..i + n)?;
    if !t.iter().all(u8::is_ascii_digit) { return None; }
    Some(t.iter().fold(0i64, |a, c| a * 10 + i64::from(c - b'0')))
}
/// Jours depuis le 1970-01-01 du 1er du mois `m` (1 à 12) de l'année `y` (calendrier grégorien proleptique).
fn jours_civils(y: i64, m: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// `Date.parse(s)`.
///
/// # Errors
/// Hors domaine : toute forme autre que la forme ISO stricte décrite ci-dessus (et la chaîne vide, NaN).
#[allow(clippy::cast_precision_loss)] // |t| ≤ 8,64e15 < 2^53 : conversion exacte
pub fn parse(s: &str) -> Result<f64, Echec> {
    if s.is_empty() { return Ok(f64::NAN); }
    let o = s.as_bytes();
    let mut i;
    let annee = if let Some(b'+' | b'-') = o.first() {
        let Some(a) = chiffres(o, 1, 6) else { return hd("Date.parse : forme non ISO") };
        i = 7;
        // −000000 : refusée par l'analyseur ISO de V8, puis confiée à son analyseur hérité (implémentation-définie)
        if o.first() == Some(&b'-') { if a == 0 { return hd("Date.parse : année −000000"); } -a } else { a }
    } else { let Some(a) = chiffres(o, 0, 4) else { return hd("Date.parse : forme non ISO") }; i = 4; a };
    let (mut mois, mut jour) = (1, 1);
    if o.get(i) == Some(&b'-') {
        let Some(m) = chiffres(o, i + 1, 2) else { return hd("Date.parse : mois") };
        mois = m;
        i += 3;
        if o.get(i) == Some(&b'-') {
            let Some(d) = chiffres(o, i + 1, 2) else { return hd("Date.parse : jour") };
            jour = d;
            i += 3;
        }
    }
    let (mut h, mut mi, mut se, mut ms, mut frac_nulle, mut decalage) = (0, 0, 0, 0, true, 0i64);
    if i < o.len() {
        if o.get(i) != Some(&b'T') { return hd("Date.parse : séparateur"); }
        let (Some(hh), Some(b':'), Some(mm)) = (chiffres(o, i + 1, 2), o.get(i + 3), chiffres(o, i + 4, 2)) else { return hd("Date.parse : heure") };
        h = hh; mi = mm; i += 6;
        if o.get(i) == Some(&b':') {
            let Some(ss) = chiffres(o, i + 1, 2) else { return hd("Date.parse : secondes") };
            se = ss; i += 3;
            if o.get(i) == Some(&b'.') {
                let debut = i + 1;
                let mut j = debut;
                while o.get(j).is_some_and(u8::is_ascii_digit) { j += 1; }
                if j == debut { return hd("Date.parse : fraction vide"); }
                let f = o.get(debut..j).unwrap_or_default();
                ms = (0..3).fold(0i64, |a, k| a * 10 + f.get(k).map_or(0, |c| i64::from(c - b'0')));
                frac_nulle = f.iter().all(|&c| c == b'0');
                i = j;
            }
        }
        match o.get(i) {
            Some(b'Z') if i + 1 == o.len() => {}
            Some(&c @ (b'+' | b'-')) if i + 6 == o.len() => {
                let (Some(dh), Some(b':'), Some(dm)) = (chiffres(o, i + 1, 2), o.get(i + 3), chiffres(o, i + 4, 2)) else { return hd("Date.parse : décalage") };
                if dh > 23 || dm > 59 { return hd("Date.parse : décalage hors plage"); }
                decalage = (dh * 60 + dm) * 60_000 * if c == b'-' { -1 } else { 1 };
            }
            _ => return hd("Date.parse : heure sans décalage (locale) ou suffixe"),
        }
    }
    // champ hors plage : l'analyseur ISO de V8 refuse, puis son analyseur hérité accepte parfois (« 0003-13 ») : hors domaine
    if !(1..=12).contains(&mois) || !(1..=31).contains(&jour) || h > 24 || mi > 59 || se > 59 { return hd("Date.parse : champ hors plage"); }
    if h == 24 && (mi != 0 || se != 0 || !frac_nulle) { return hd("Date.parse : 24 h non nulle"); }
    let jours = jours_civils(annee, mois) + jour - 1;
    let t = i128::from(jours) * 86_400_000 + i128::from(((h * 60 + mi) * 60 + se) * 1000 + ms) - i128::from(decalage);
    if t.abs() > 8_640_000_000_000_000 { return hd("Date.parse : hors de ±8,64e15"); }
    // |t| ≤ 8,64e15 : tient dans un i64 et se convertit exactement
    Ok(i64::try_from(t).map_or(f64::NAN, |x| x as f64))
}

#[cfg(test)]
#[allow(clippy::float_cmp)]
mod essais {
    use super::parse;
    #[test]
    fn formes_relevees_sur_v8() {
        for (s, t) in [("2026-11-06T07:21:00.000Z", 1_793_949_660_000.0), ("2026-11-06", 1_793_923_200_000.0), ("2026", 1_767_225_600_000.0),
            ("2026-11-06T07:21:00.1234Z", 1_793_949_660_123.0), ("2026-11-06T07:21:00.000+01:00", 1_793_946_060_000.0),
            ("2026-11-06T24:00:00.000Z", 1_794_009_600_000.0), ("2026-02-30T00:00:00.000Z", 1_772_409_600_000.0),
            ("+275760-09-13T00:00:00.000Z", 8.64e15), ("-271821-04-20T00:00:00.000Z", -8.64e15), ("0000-01-01", -62_167_219_200_000.0),
            ("-000001-01-01T00:00Z", -62_198_755_200_000.0), ("1970-01-01T00:00:00.000Z", 0.0)] {
            assert_eq!(parse(s), Ok(t), "{s}");
        }
        assert!(parse("").is_ok_and(f64::is_nan));
        for s in ["2026-13-01", "2026-01-32", "2026-11-06T24:00:01.000Z", "2026-11-06T24:00:00.0001Z", "0003-13",
            "+275760-09-13T00:00:00.001Z", "2026-11-06T07:21:00.000+24:00"] {
            assert!(parse(s).is_err(), "{s}");
        }
        for s in ["2026-11-06T07:21:00", "2026-11-06t07:21:00z", " 2026-11-06", "+0100", "2026-1-06", "undefined", "-000000-01-01T00:00:00Z"] { assert!(parse(s).is_err(), "{s}"); }
    }
}
