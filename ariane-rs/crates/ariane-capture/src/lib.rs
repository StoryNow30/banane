//! Port de la partie PURE de `vendor/capture-core.js` (calcul des repères). Restent en JS, par nature : `compose`,
//! `worldMatrix`, `rotation`, `railState`, `equalRails` (objets Three.js vivants de la page, identité d'objets),
//! `attribute` (tampons et accesseurs de Potree), et `reference` (compare des rotations par `JSON.stringify`).
//!
//! Deux niveaux : des fonctions sur `f64` (utilisées par la géométrie, sans allocation inutile) et `appeler`, sur des
//! `Valeur` (banc de parité et façade), qui reproduit la validation du JS et rend `Echec::HorsDomaine` pour toute
//! entrée dont le JS dépendrait de coercitions non portées : la façade rappelle alors le JS d'origine.

use ariane_js::{hypot, Echec};
use ariane_vba::Valeur;

/// Matrice 4 × 4 en colonnes, comme `Matrix4.elements` de Three.js.
pub type M16 = [f64; 16];
const IDENTITE: M16 = [1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.];

fn echec<T>(m: &str) -> Result<T, Echec> { Err(Echec::erreur(m)) }

/// `point(m,p)` : projection homogène ; mêmes contrôles et mêmes messages que le JS.
///
/// # Errors
/// « Projection non finie. » si w n'est pas fini ou vaut moins de 1e-15 ; « Transformation non finie. » sinon.
#[inline]
pub fn point(m: &M16, x: f64, y: f64, z: f64) -> Result<[f64; 3], Echec> {
    let w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if !w.is_finite() || w.abs() < 1e-15 { return echec("Projection non finie."); }
    let out = [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w];
    if !out.iter().all(|v| v.is_finite()) { return echec("Transformation non finie."); }
    Ok(out)
}

/// `affine(m)` sur une matrice déjà validée : la dernière ligne doit être (0, 0, 0, 1) à 1e-12 près.
///
/// # Errors
/// « Transformation affine attendue. »
pub fn affine(a: &M16) -> Result<M16, Echec> {
    let e = ariane_js::max(ariane_js::max(ariane_js::max(a[3].abs(), a[7].abs()), a[11].abs()), (a[15] - 1.0).abs());
    if e > 1e-12 { return echec("Transformation affine attendue."); }
    Ok(*a)
}

#[must_use]
/// `multiply(a,b)` : produit a × b, dans l'ordre exact des additions du JS (départ à +0).
pub fn multiply(a: &M16, b: &M16) -> M16 {
    let mut c = [0.0f64; 16];
    for j in 0..4 { for i in 0..4 { for k in 0..4 { c[4 * j + i] += a[4 * k + i] * b[4 * j + k]; } } }
    c
}

/// Inversion de Gauss-Jordan à pivot partiel, dans l'ordre exact des opérations du JS.
///
/// # Errors
/// « Matrice singulière : repère non exploitable. » si un pivot vaut moins de 1e-14.
pub fn inverse(a: &M16) -> Result<M16, Echec> {
    let mut rows = [[0.0f64; 8]; 4];
    for (i, r) in rows.iter_mut().enumerate() {
        *r = [a[i], a[4 + i], a[8 + i], a[12 + i], 0., 0., 0., 0.];
        r[4 + i] = 1.0;
    }
    for col in 0..4 {
        let mut p = col;
        for i in col + 1..4 { if rows[i][col].abs() > rows[p][col].abs() { p = i; } }
        if rows[p][col].abs() < 1e-14 { return echec("Matrice singulière : repère non exploitable."); }
        rows.swap(col, p);
        let d = rows[col][col];
        for j in 0..8 { rows[col][j] /= d; }
        for i in 0..4 {
            if i != col {
                let v = rows[i][col];
                for j in 0..8 { rows[i][j] -= v * rows[col][j]; }
            }
        }
    }
    let mut out = [0.0f64; 16];
    for (i, o) in out.iter_mut().enumerate() { *o = rows[i % 4][4 + i / 4]; }
    Ok(out)
}

/// `rebase(m, origin)` : la matrice, rendue affine, avec sa translation diminuée de l'origine.
///
/// # Errors
/// Celles d'[`affine`].
///
/// # Panics
/// Si `origine` a moins de trois nombres (l'appelant le vérifie).
pub fn rebase(m: &M16, origine: &[f64]) -> Result<M16, Echec> {
    let mut a = affine(m)?;
    for i in 0..3 { a[12 + i] -= origine[i]; }
    Ok(a)
}

// ---------------------------------------------------------------- niveau Valeur (validation du JS)


/// `Array.from(x)` réduit aux nombres : Some(liste) où None = élément non numérique (ou trou) ; None si non porté.
fn elements(v: &Valeur) -> Option<Vec<Option<f64>>> {
    Some(match v {
        Valeur::Nombres(t) => t.iter().map(|&x| Some(x)).collect(),
        Valeur::Bloc { .. } | Valeur::Booleens(_) => vec![None; longueur(v)?],
        Valeur::Tableau(t) => t.iter().map(|e| match e { Some(Valeur::Nombre(x)) => Some(*x), _ => None }).collect(),
        Valeur::Chaine(s) => vec![None; s.chars().count()],
        Valeur::Objet(_) => return None,
        _ => vec![], // nombre, booléen, null… : Array.from rend []
    })
}
fn longueur(v: &Valeur) -> Option<usize> {
    match v {
        Valeur::Nombres(t) => Some(t.len()),
        Valeur::Bloc { k, donnees } => Some(donnees.len() / *k as usize),
        Valeur::Booleens(t) => Some(t.len()),
        Valeur::Tableau(t) => Some(t.len()),
        _ => None,
    }
}

/// `matrix(m)` : `Array.from(m?.elements || m || [])`, 16 nombres finis.
///
/// # Errors
/// « Matrice 4 × 4 absente ou non finie. » ; hors domaine pour un objet tabulaire (`length`), non porté.
pub fn matrice(m: &Valeur) -> Result<M16, Echec> {
    let source = match m.champ("elements") { Some(e) if e.vrai() => e, _ => m };
    let liste = if source.vrai() { elements(source).ok_or_else(|| Echec::hors_domaine("matrice : objet tabulaire"))? } else { vec![] };
    if liste.len() != 16 || !liste.iter().all(|x| x.is_some_and(f64::is_finite)) { return echec("Matrice 4 × 4 absente ou non finie."); }
    let mut a = [0.0; 16];
    for (o, x) in a.iter_mut().zip(liste) { *o = x.unwrap_or(f64::NAN); } // toutes présentes : vérifié ci-dessus
    Ok(a)
}

/// Tableau de nombres (domaine des fonctions qui lisent `m[i]` sans contrôle).
fn nombres(v: &Valeur, au_moins: usize) -> Result<&[f64], Echec> {
    match v { Valeur::Nombres(t) if t.len() >= au_moins => Ok(t), _ => Err(Echec::hors_domaine("tableau de nombres attendu")) }
}
fn m16(v: &Valeur) -> Result<M16, Echec> {
    match v { Valeur::Nombres(t) if t.len() == 16 => { let mut a = [0.0; 16]; a.copy_from_slice(t); Ok(a) } _ => Err(Echec::hors_domaine("16 nombres attendus")) }
}
/// `[x,y,z]=p` : trois premiers éléments ; absent = undefined = NaN dans le calcul.
///
/// # Errors
/// Hors domaine pour un élément non numérique ou un point non tabulaire (le JS convertirait ou lèverait).
pub fn xyz(p: &Valeur) -> Result<[f64; 3], Echec> {
    let mut o = [f64::NAN; 3];
    match p {
        Valeur::Nombres(t) => { for (i, x) in t.iter().take(3).enumerate() { o[i] = *x; } }
        Valeur::Tableau(t) => {
            for (i, e) in t.iter().take(3).enumerate() {
                match e { None | Some(Valeur::Indefini) => {}, Some(Valeur::Nombre(x)) => o[i] = *x, _ => return Err(Echec::hors_domaine("coordonnée non numérique")) }
            }
        }
        _ => return Err(Echec::hors_domaine("point non tabulaire")),
    }
    Ok(o)
}
fn sortie(m: &[f64]) -> Valeur { Valeur::Nombres(m.to_vec()) }

/// `vector(v)` : tableau → `slice(0,3)` (trous conservés) ; sinon `[v?.x, v?.y, v?.z]`.
///
/// # Errors
/// « Coordonnées absentes ou non finies. »
pub fn vecteur(v: &Valeur) -> Result<Valeur, Echec> {
    let (t, trous): (Vec<Option<f64>>, bool) = match v {
        Valeur::Nombres(t) => (t.iter().take(3).map(|&x| Some(x)).collect(), false),
        Valeur::Tableau(t) => {
            let mut o = vec![];
            for e in t.iter().take(3) {
                match e { None => o.push(None), Some(Valeur::Nombre(x)) => o.push(Some(*x)), _ => return echec("Coordonnées absentes ou non finies.") }
            }
            (o, true)
        }
        Valeur::Objet(_) => {
            let c = |k| match v.champ(k) { Some(Valeur::Nombre(x)) => Ok(Some(*x)), _ => Err(()) };
            match (c("x"), c("y"), c("z")) { (Ok(a), Ok(b), Ok(d)) => (vec![a, b, d], false), _ => return echec("Coordonnées absentes ou non finies.") }
        }
        _ => return echec("Coordonnées absentes ou non finies."),
    };
    // every() saute les trous ; ils restent dans le tableau rendu
    if t.len() != 3 || !t.iter().all(|x| x.is_none_or(f64::is_finite)) { return echec("Coordonnées absentes ou non finies."); }
    if trous && t.iter().any(Option::is_none) {
        return Ok(Valeur::Tableau(t.into_iter().map(|x| x.map(Valeur::Nombre)).collect()));
    }
    Ok(Valeur::Nombres(t.into_iter().map(|x| x.unwrap_or(f64::NAN)).collect())) // sans trou : vérifié ci-dessus
}

/// Appel par nom (banc de parité, façade) : `args` sont les arguments JS, dans l'ordre.
///
/// # Errors
/// L'exception du JS ; hors domaine pour une fonction non portée ou une entrée à coercition.
pub fn appeler(nom: &str, args: &[Valeur]) -> Result<Valeur, Echec> {
    let a = |i: usize| args.get(i).unwrap_or(&Valeur::Indefini);
    match nom {
        "identity" => Ok(sortie(&IDENTITE)),
        "vector" => vecteur(a(0)),
        "matrix" => Ok(sortie(&matrice(a(0))?)),
        "affine" => Ok(sortie(&affine(&matrice(a(0))?)?)),
        "inverse" => Ok(sortie(&inverse(&matrice(a(0))?)?)),
        "multiply" => Ok(sortie(&multiply(&m16(a(0))?, &m16(a(1))?))),
        "point" => {
            let m = nombres(a(0), 16)?;
            let mut mm = [0.0; 16];
            mm.copy_from_slice(&m[..16]);
            let [x, y, z] = xyz(a(1))?;
            Ok(sortie(&point(&mm, x, y, z)?))
        }
        "distance" => {
            let (p, q) = (nombres(a(0), 0)?, nombres(a(1), 0)?);
            if q.len() < p.len() { return Err(Echec::hors_domaine("distance : second point plus court")); }
            let d: Vec<f64> = p.iter().zip(q).map(|(x, y)| x - y).collect();
            Ok(Valeur::Nombre(hypot(&d)))
        }
        "translation" => {
            let p = nombres(a(0), 3)?;
            if p.len() != 3 { return Err(Echec::hors_domaine("translation : 3 nombres")); }
            let mut m = IDENTITE;
            m[12..15].copy_from_slice(p);
            Ok(sortie(&m))
        }
        "rebase" => {
            let m = matrice(a(0))?;
            let o = nombres(a(1), 3)?;
            Ok(sortie(&rebase(&m, o)?))
        }
        "serialRail" => {
            let r = a(0);
            if !matches!(r, Valeur::Objet(_)) { return Err(Echec::hors_domaine("serialRail : objet attendu")); }
            let o = nombres(a(1), 3)?;
            let champ = |k| r.champ(k).cloned().unwrap_or(Valeur::Indefini);
            let rm = rebase(&matrice(&champ("railMatrix"))?, o)?;
            let pm = rebase(&matrice(&champ("profileMatrix"))?, o)?;
            let position = point(&rm, 0., 0., 0.)?;
            let origine = point(&pm, 0., 0., 0.)?;
            let axes: Vec<f64> = [0usize, 4, 8].iter().map(|&i| hypot(&[pm[i], pm[i + 1], pm[i + 2]])).collect();
            let inv = inverse(&pm)?;
            Ok(Valeur::Objet(vec![
                ("positionSceneRelative".into(), sortie(&position)),
                ("profileOriginSceneRelative".into(), sortie(&origine)),
                ("profileAxisLengthsSceneUnits".into(), sortie(&axes)),
                ("railLocalToSceneRelative".into(), sortie(&rm)),
                ("profileLocalToSceneRelative".into(), sortie(&pm)),
                ("sceneRelativeToProfileLocal".into(), sortie(&inv)),
                ("rotation".into(), champ("rotation")),
                ("profileRotation".into(), champ("profileRotation")),
            ]))
        }
        _ => Err(Echec::hors_domaine(format!("capture : fonction non portée {nom}"))),
    }
}

#[cfg(test)]
#[allow(clippy::float_cmp)] // essais d'identité au bit près : la comparaison exacte est le but
mod essais {
    use super::*;
    #[test]
    fn inverse_de_l_identite_et_singuliere() {
        assert_eq!(inverse(&IDENTITE).unwrap(), IDENTITE);
        assert_eq!(inverse(&[0.0; 16]), Err(Echec::erreur("Matrice singulière : repère non exploitable.")));
    }
    #[test]
    fn point_non_fini() {
        let mut m = IDENTITE;
        m[15] = 0.0;
        assert_eq!(point(&m, 0., 0., 0.), Err(Echec::erreur("Projection non finie.")));
        assert_eq!(point(&IDENTITE, 1., 2., 3.).unwrap(), [1., 2., 3.]);
    }
    #[test]
    fn matrice_par_elements_et_refus() {
        let m = Valeur::Objet(vec![("elements".into(), Valeur::Nombres(IDENTITE.to_vec()))]);
        assert_eq!(matrice(&m).unwrap(), IDENTITE);
        assert!(matches!(matrice(&Valeur::Nul), Err(Echec::Js { .. })));
        assert!(matches!(matrice(&Valeur::Nombres(vec![1.0; 15])), Err(Echec::Js { .. })));
    }
}
