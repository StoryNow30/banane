//! `src/gauge.js`, partie numérique : contrat d'écartement, classement, écartement mesuré et prédit, rapport de paire.
//! Bibliothèque interne de la décision du lot (étape 3) : trop petite pour une façade (la traversée coûterait plus que le
//! calcul). `parse` (lecture du texte affiché par ESV, aucune décision) reste en JS.
use crate::v46::{hd, n, obj, s};
use ariane_capture::{point, xyz};
use ariane_js::{hypot, Echec};
use ariane_vba::Valeur;

/// Sous cette valeur (mm) : hors contrat, trop serré.
pub const LOW_MM: f64 = 1420.0;
/// À partir d'ici (mm) : nominal.
pub const NOMINAL_MM: f64 = 1430.0;
/// Au-delà (mm) : hors contrat, trop large.
pub const MAXIMUM_MM: f64 = 1470.0;

#[must_use]
/// `classifyMm(valueMm)` : classe d'écartement (jamais de SKIP).
pub fn classify_mm(v: f64) -> &'static str {
    if !v.is_finite() { "INDETERMINATE" } else if v < LOW_MM { "LOW_INVALID" } else if v < NOMINAL_MM { "TOLERANCE" } else if v <= MAXIMUM_MM { "NOMINAL" } else { "HIGH_INVALID" }
}
#[must_use]
/// `admissible(gaugeClass)` : tolérance ou nominal.
pub fn admissible(c: &str) -> bool { c == "TOLERANCE" || c == "NOMINAL" }

fn nombres(v: Option<&Valeur>) -> Option<&[f64]> { match v { Some(Valeur::Nombres(t)) => Some(t), _ => None } }
fn rail<'a>(rails: &'a Valeur, cote: &str) -> Option<&'a Valeur> { match rails { Valeur::Objet(_) => rails.champ(cote), _ => None } }

/// `C.distance(a, b)` sur deux tableaux de nombres (b au moins aussi long que a).
fn distance(a: &[f64], b: &[f64]) -> Result<f64, Echec> {
    if b.len() < a.len() { return hd("distance : second point plus court"); }
    Ok(hypot(&a.iter().zip(b).map(|(x, y)| x - y).collect::<Vec<_>>()))
}

/// `gaugeMmOf(rails, C)` : distance des origines des deux rails, en mm (NaN si l'une manque).
///
/// # Errors
/// Hors domaine pour une position non numérique ou plus courte que l'autre.
pub fn gauge_mm_of(rails: &Valeur) -> Result<f64, Echec> {
    let pos = |c| rail(rails, c).and_then(|r| match r { Valeur::Objet(_) => r.champ("positionSceneRelative"), _ => None });
    let (a, b) = (pos("left"), pos("right"));
    let tableau = |v: Option<&Valeur>| matches!(v, Some(Valeur::Nombres(_) | Valeur::Tableau(_) | Valeur::Bloc { .. } | Valeur::Booleens(_)));
    if !tableau(a) || !tableau(b) { return Ok(f64::NAN); }
    match (nombres(a), nombres(b)) { (Some(a), Some(b)) => Ok(distance(a, b)? * 1000.0), _ => hd("position non numérique") }
}

/// `shifted(rail, delta, C)` : None quand le JS rend null.
fn decale(r: Option<&Valeur>, delta: Option<&Valeur>) -> Result<Option<Vec<f64>>, Echec> {
    let Some(r @ Valeur::Objet(_)) = r else { return match r { None | Some(Valeur::Indefini | Valeur::Nul) => Ok(None), _ => hd("rail") } };
    let est_tableau = |v: Option<&Valeur>| matches!(v, Some(Valeur::Nombres(_) | Valeur::Tableau(_) | Valeur::Bloc { .. } | Valeur::Booleens(_)));
    let (pos, m) = (r.champ("positionSceneRelative"), r.champ("profileLocalToSceneRelative"));
    if !est_tableau(delta) || !est_tableau(pos) || !m.is_some_and(Valeur::vrai) { return Ok(None); }
    let m = match m { Some(Valeur::Nombres(t)) if t.len() >= 16 => { let mut a = [0.0; 16]; a.copy_from_slice(&t[..16]); a } _ => return hd("profileLocalToSceneRelative") };
    let [x, y, z] = xyz(delta.unwrap())?;
    let monde = point(&m, x, y, z)?;
    let origine = point(&m, 0.0, 0.0, 0.0)?;
    let Some(p) = nombres(pos) else { return hd("position non numérique") };
    // position.map((v,i)=>v+(world[i]-origin[i])) : au-delà de 3, world[i] est undefined → NaN
    Ok(Some(p.iter().enumerate().map(|(i, v)| if i < 3 { v + (monde[i] - origine[i]) } else { f64::NAN }).collect()))
}

/// `predictedGaugeMm(rails, deltas, C)` : écartement après application des deltas, en mm.
///
/// # Errors
/// Projection non finie ; hors domaine pour une forme inattendue.
pub fn predicted_gauge_mm(rails: &Valeur, deltas: &Valeur) -> Result<f64, Echec> {
    let d = |c| match deltas { Valeur::Objet(_) => deltas.champ(c), _ => None };
    let a = decale(rail(rails, "left"), d("left"))?;
    let b = decale(rail(rails, "right"), d("right"))?;
    match (a, b) { (Some(a), Some(b)) => Ok(distance(&a, &b)? * 1000.0), _ => Ok(f64::NAN) }
}

/// `assessPair(rails, deltas, C)` : rapport complet d'un couple.
///
/// # Errors
/// Celles de [`gauge_mm_of`] et [`predicted_gauge_mm`].
pub fn assess_pair(rails: &Valeur, deltas: &Valeur) -> Result<Valeur, Echec> {
    let (avant, predit) = (gauge_mm_of(rails)?, predicted_gauge_mm(rails, deltas)?);
    let c = classify_mm(predit);
    Ok(obj(vec![("contract", s("gauge-contract-v2")), ("beforeMm", n(avant)), ("predictedMm", n(predit)), ("gaugeClass", s(c)),
        ("measurable", Valeur::Booleen(predit.is_finite())), ("admissible", Valeur::Booleen(admissible(c))),
        ("lowMm", n(LOW_MM)), ("nominalMm", n(NOMINAL_MM)), ("maximumMm", n(MAXIMUM_MM))]))
}
