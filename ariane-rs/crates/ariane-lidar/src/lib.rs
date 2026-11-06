//! CH-064-L : lecture du `LiDAR` en Rust, identique au bit près à la boucle par point de `capture()` dans `vendor/lidar.js`.
//!
//! Ce qui est porté : le parcours d'un nœud Potree non indexé, à positions flottantes (Float32 ou Float64), non normalisées,
//! lues dans le tableau du nœud (`array[i*stride+offset+k]`) — soit la boucle `for(let di=drawStart;di<drawEnd;di++)`.
//! Tout le reste de `capture()` (inventaire, sondes, attributs, `boxVisible`, statut, avertissements) reste le JS d'origine :
//! la coquille (`js/lidar-wasm.js`) n'insère qu'une branche avant la boucle d'origine, qui sert de repli.
//!
//! Identité (ÉTABLIE par `tools/ch064-l-parite.cjs` sur le corpus réel, et par les essais ci-dessous) :
//! - `C.point` : mêmes opérations dans le même ordre (`m[3]*x+m[7]*y+m[11]*z+m[15]`, puis trois numérateurs, puis `/w`),
//!   mêmes contrôles (`!finite(w)|||w|<1e-15` → « Projection non finie. », sortie non finie → « Transformation non finie. ») ;
//!   aucune contraction FMA (WASM n'en a pas ; x86-64 de base non plus).
//! - `Math.hypot`, `Math.max` : `ariane_js` (algorithme de V8).
//! - Élagages SANS effet sur les bits : division par `w` sautée quand `w == 1` (x/1 = x exactement, −0 et NaN compris) ;
//!   `Math.hypot` du point le plus proche sauté quand une borne basse sûre dépasse déjà le meilleur (voir `plus_proche`).
//! - L'horloge (`Date.now()-started>maxMillis`) n'est PAS lue ici : la coquille la lit entre deux tranches (≤ 4 096 points).
pub mod abi;

/// Version du format de l'arène (disposition de `MATS`, `ETAT`, des sorties et des codes d'erreur) : la coquille refuse
/// un cœur dont `lidar_version_arene()` diffère de la sienne.
pub const VERSION_ARENE: u32 = 1;

/// Les deux exceptions que `C.point` peut lever, dans le texte exact de `vendor/capture-core.js`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Erreur {
    /// `w` non fini ou de valeur absolue < 1e-15 : « Projection non finie. »
    Projection,
    /// Une coordonnée transformée non finie : « Transformation non finie. »
    Transformation,
}

impl Erreur {
    /// Code écrit dans `ETAT[E_ERREUR]` (0 : aucune ; 3 : tranche refusée par l'ABI).
    #[must_use]
    pub const fn code(self) -> f64 {
        match self {
            Erreur::Projection => 1.0,
            Erreur::Transformation => 2.0,
        }
    }
    /// Message de l'`Error` levée par la coquille, identique à celui de `vendor/capture-core.js`.
    #[must_use]
    pub const fn message(self) -> &'static str {
        match self {
            Erreur::Projection => "Projection non finie.",
            Erreur::Transformation => "Transformation non finie.",
        }
    }
}

/// Décalages des matrices dans le bloc `MATS` (16 nombres chacune, colonne majeure, comme Three.js).
/// `model` = `C.rebase(n.world, origin)`.
pub const M_MODELE: usize = 0;
/// `invModel` = `C.inverse(model)`.
pub const M_INVERSE: usize = 16;
/// `transforms[s]` = `C.multiply(frames[s].sceneRelativeToProfileLocal, model)`.
pub const M_LOCAL: [usize; 2] = [32, 48];
/// `frames[s].profileLocalToSceneRelative`.
pub const M_PROFIL_SCENE: [usize; 2] = [64, 80];
/// `frames[s].sceneRelativeToProfileLocal`.
pub const M_SCENE_PROFIL: [usize; 2] = [96, 112];
/// `bounds[0..3]` (demi-étendues de la fenêtre, repère profil).
pub const M_BORNES: usize = 128;
/// Taille du bloc `MATS`.
pub const N_MATS: usize = 131;

/// Disposition du bloc `ETAT` (nombres f64) partagé avec la coquille.
/// `out.quality.roundTripMaxSceneUnits` (entrée et sortie).
pub const E_ALLER_RETOUR: usize = 0;
/// Points inspectés par l'appel.
pub const E_TRAITES: usize = 1;
/// Positions non finies rencontrées par l'appel.
pub const E_NON_FINIS: usize = 2;
/// `perRail.left` / `perRail.right` ajoutés par l'appel.
pub const E_PAR_RAIL: [usize; 2] = [3, 4];
/// 0, ou `Erreur::code()`, ou 3 (tranche refusée).
pub const E_ERREUR: usize = 5;
/// Par côté, `nearestToRailOrigin` : `[présent, distance, indice, local×3, scène×3]`.
pub const E_PROCHE: [usize; 2] = [6, 15];
/// Taille du bloc `ETAT`.
pub const N_ETAT: usize = 24;

/// Coordonnée lue dans le tampon du nœud : `Float32Array` (élargi en f64 sans perte) ou `Float64Array`.
pub trait Coord: Copy {
    /// La coordonnée en nombre JS.
    fn f64(self) -> f64;
}
impl Coord for f32 {
    #[inline]
    fn f64(self) -> f64 {
        f64::from(self)
    }
}
impl Coord for f64 {
    #[inline]
    fn f64(self) -> f64 {
        self
    }
}

type Mat = [f64; 16];

/// `C.point(m, [x,y,z])` de `vendor/capture-core.js`, la matrice commençant à `m[o]`.
///
/// # Errors
/// `Erreur::Projection` ou `Erreur::Transformation`, aux mêmes conditions que le JS.
///
/// # Panics
/// Si `m` a moins de `o + 16` nombres.
#[inline]
pub fn point(m: &[f64], o: usize, x: f64, y: f64, z: f64) -> Result<[f64; 3], Erreur> {
    pt(m[o..o + 16].try_into().expect("matrice de 16"), x, y, z)
}

/// `C.point` sur une matrice de taille fixe (indices vérifiés à la compilation).
#[inline]
#[allow(clippy::float_cmp)] // w == 1 exactement : seul cas où la division est sautée (x/1 = x au bit près)
fn pt(m: &Mat, x: f64, y: f64, z: f64) -> Result<[f64; 3], Erreur> {
    let w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if !w.is_finite() || w.abs() < 1e-15 {
        return Err(Erreur::Projection);
    }
    let a = m[0] * x + m[4] * y + m[8] * z + m[12];
    let b = m[1] * x + m[5] * y + m[9] * z + m[13];
    let c = m[2] * x + m[6] * y + m[10] * z + m[14];
    // x/1 rend x au bit près (IEEE 754) : la division est sautée sans changer la sortie.
    let r = if w == 1.0 { [a, b, c] } else { [a / w, b / w, c / w] };
    if !(r[0].is_finite() && r[1].is_finite() && r[2].is_finite()) {
        return Err(Erreur::Transformation);
    }
    Ok(r)
}

/// `C.distance(a, b)` = `Math.hypot(...a.map((x,i)=>x-b[i]))`.
#[inline]
fn distance(a: &[f64; 3], b: &[f64; 3]) -> f64 {
    ariane_js::hypot(&[a[0] - b[0], a[1] - b[1], a[2] - b[2]])
}

/// `inRoi(p, bounds)` = `p.every((x,i)=>Math.abs(x)<=bounds[i])`.
#[inline]
fn dans(p: &[f64; 3], b: &[f64; 3]) -> bool {
    p[0].abs() <= b[0] && p[1].abs() <= b[1] && p[2].abs() <= b[2]
}

/// Seuil d'élagage du plus proche, au carré : un point dont `x²+y²+z²` (somme non compensée) dépasse ce seuil ne peut PAS
/// battre `meilleur`. La somme non compensée diffère du carré de l'hypot de V8 de quelques ulp ; la marge relative de 1e-9
/// en couvre des millions. Un meilleur non fini, ou un carré qui déborde, rend +∞ : tout point est alors calculé.
#[inline]
fn seuil_carre(meilleur: f64) -> f64 {
    if !meilleur.is_finite() {
        return f64::INFINITY;
    }
    let b = meilleur * (1.0 + 1e-9);
    b * b
}

/// Faut-il calculer `Math.hypot(...l)` ? Oui si aucun plus proche, si la somme est nulle, sous-normale, infinie ou NaN
/// (zone où la borne n'est pas garantie), ou si elle ne dépasse pas le seuil.
#[inline]
fn a_calculer(l: &[f64; 3], present: bool, seuil2: f64) -> bool {
    if !present {
        return true;
    }
    let s = l[0] * l[0] + l[1] * l[1] + l[2] * l[2];
    !(s.is_finite() && s > 1e-200) || s <= seuil2
}

/// Parcourt `n` points consécutifs d'un nœud : le point k est lu en `src[k*stride .. k*stride+3]` et porte l'indice source
/// `premier + k`. Rend le nombre de points retenus écrits dans `retenus` / `scene`. `etat` porte les compteurs de l'appel,
/// le maximum des allers-retours (cumulé) et le plus proche par côté (cumulé sur le nœud).
/// S'arrête AVANT un point si `retenus_avant + retenus_de_l_appel >= limite` (contrôle `pointsSceneRelative.length>=maxPoints`).
/// Sur exception, `etat[E_ERREUR]` porte son code ; les points retenus AVANT elle sont rendus (la coquille les traite, puis lève).
///
/// # Panics
/// Si `stride < 3`, si `m` a moins de `N_MATS` nombres, `etat` moins de `N_ETAT`, ou si `retenus` / `scene` sont plus courts
/// que les points retenus (l'ABI leur donne la capacité d'une tranche entière).
#[allow(clippy::too_many_arguments)]
// Indices de points : un tampon Potree (Float32Array) a moins de 2^32 éléments, l'indice tient dans un u32.
#[allow(clippy::cast_possible_truncation)]
pub fn parcourir<T: Coord>(
    src: &[T],
    stride: usize,
    n: usize,
    premier: u32,
    limite: f64,
    m: &[f64],
    etat: &mut [f64],
    retenus: &mut [u32],
    scene: &mut [f64],
) -> usize {
    let mat = |o: usize| -> Mat { m[o..o + 16].try_into().expect("matrice de 16") };
    let (modele, inverse) = (mat(M_MODELE), mat(M_INVERSE));
    let local_m = [mat(M_LOCAL[0]), mat(M_LOCAL[1])];
    let profil_scene = [mat(M_PROFIL_SCENE[0]), mat(M_PROFIL_SCENE[1])];
    let scene_profil = [mat(M_SCENE_PROFIL[0]), mat(M_SCENE_PROFIL[1])];
    let b = [m[M_BORNES], m[M_BORNES + 1], m[M_BORNES + 2]];
    // Plus proche par côté, tenu en variables locales et rendu à la fin.
    let mut proche = [[0.0f64; 9]; 2];
    for s in 0..2 {
        proche[s].copy_from_slice(&etat[E_PROCHE[s]..E_PROCHE[s] + 9]);
    }
    let mut present = [proche[0][0] != 0.0, proche[1][0] != 0.0];
    let mut seuil2 = [seuil_carre(proche[0][1]), seuil_carre(proche[1][1])];
    let mut rt = etat[E_ALLER_RETOUR];
    let (mut traites, mut non_finis, mut par_rail, mut k) = (0usize, 0usize, [0usize; 2], 0usize);
    let mut erreur = None;
    assert!(stride >= 3, "pas < 3");
    let n = n.min(if src.len() < 3 { 0 } else { (src.len() - 3) / stride + 1 });
    'points: for j in 0..n {
        if (k as f64) >= limite {
            break;
        }
        let q = &src[j * stride..j * stride + 3];
        let (x, y, z) = (q[0].f64(), q[1].f64(), q[2].f64());
        let i = premier + j as u32;
        traites += 1;
        if !(x.is_finite() && y.is_finite() && z.is_finite()) {
            non_finis += 1;
            continue;
        }
        let local = match (pt(&local_m[0], x, y, z), pt(&local_m[1], x, y, z)) {
            (Ok(g), Ok(d)) => [g, d],
            (Err(e), _) | (_, Err(e)) => {
                erreur = Some(e);
                break;
            }
        };
        let dedans = [dans(&local[0], &b), dans(&local[1], &b)];
        for s in 0..2 {
            if !a_calculer(&local[s], present[s], seuil2[s]) {
                continue;
            }
            let d = ariane_js::hypot(&local[s]);
            if !present[s] || d < proche[s][1] {
                let p = match pt(&modele, x, y, z) {
                    Ok(p) => p,
                    Err(e) => {
                        erreur = Some(e);
                        break 'points;
                    }
                };
                present[s] = true;
                seuil2[s] = seuil_carre(d);
                proche[s] = [1.0, d, f64::from(i), local[s][0], local[s][1], local[s][2], p[0], p[1], p[2]];
            }
        }
        if !(dedans[0] || dedans[1]) {
            continue;
        }
        let r = (|| -> Result<[f64; 3], Erreur> {
            let p = pt(&modele, x, y, z)?;
            let q = pt(&inverse, p[0], p[1], p[2])?;
            let retour = pt(&modele, q[0], q[1], q[2])?;
            rt = ariane_js::max(rt, distance(&retour, &p));
            for s in 0..2 {
                let l = pt(&scene_profil[s], p[0], p[1], p[2])?;
                let tour = pt(&profil_scene[s], l[0], l[1], l[2])?;
                rt = ariane_js::max(rt, distance(&tour, &p));
                if dedans[s] {
                    par_rail[s] += 1;
                }
            }
            Ok(p)
        })();
        match r {
            Ok(p) => {
                retenus[k] = i;
                scene[3 * k..3 * k + 3].copy_from_slice(&p);
                k += 1;
            }
            Err(e) => {
                erreur = Some(e);
                break;
            }
        }
    }
    for s in 0..2 {
        etat[E_PROCHE[s]..E_PROCHE[s] + 9].copy_from_slice(&proche[s]);
    }
    etat[E_ALLER_RETOUR] = rt;
    etat[E_TRAITES] = traites as f64;
    etat[E_NON_FINIS] = non_finis as f64;
    etat[E_PAR_RAIL[0]] = par_rail[0] as f64;
    etat[E_PAR_RAIL[1]] = par_rail[1] as f64;
    etat[E_ERREUR] = erreur.map_or(0.0, Erreur::code);
    k
}

#[cfg(test)]
#[allow(clippy::float_cmp, clippy::unreadable_literal, clippy::cast_possible_truncation, clippy::cast_precision_loss)] // essais au bit près
mod essais {
    use super::*;
    use std::vec::Vec;

    fn ident() -> [f64; 16] {
        [1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.]
    }
    fn trans(t: [f64; 3]) -> [f64; 16] {
        let mut m = ident();
        m[12] = t[0];
        m[13] = t[1];
        m[14] = t[2];
        m
    }
    fn mats(model: [f64; 16], l: [f64; 3], r: [f64; 3]) -> Vec<f64> {
        let mut m = std::vec![0.0; N_MATS];
        m[..16].copy_from_slice(&model);
        let inv = trans([-model[12], -model[13], -model[14]]);
        m[16..32].copy_from_slice(&inv);
        m[32..48].copy_from_slice(&trans([model[12] - l[0], model[13] - l[1], model[14] - l[2]]));
        m[48..64].copy_from_slice(&trans([model[12] - r[0], model[13] - r[1], model[14] - r[2]]));
        m[64..80].copy_from_slice(&trans(l));
        m[80..96].copy_from_slice(&trans(r));
        m[96..112].copy_from_slice(&trans([-l[0], -l[1], -l[2]]));
        m[112..128].copy_from_slice(&trans([-r[0], -r[1], -r[2]]));
        m[128..131].copy_from_slice(&[0.5, 0.4, 0.3]);
        m
    }

    #[test]
    fn point_identique_a_capture_core() {
        let m = trans([1.5, -2.0, 0.25]);
        assert_eq!(point(&m, 0, 1.0, 2.0, 3.0), Ok([2.5, 0.0, 3.25]));
        let mut p = m;
        p[15] = 0.0;
        assert_eq!(point(&p, 0, 1.0, 2.0, 3.0), Err(Erreur::Projection));
        p[15] = f64::NAN;
        assert_eq!(point(&p, 0, 1.0, 2.0, 3.0), Err(Erreur::Projection));
        let mut g = ident();
        g[12] = f64::MAX;
        assert_eq!(point(&g, 0, f64::MAX, 0.0, 0.0), Err(Erreur::Transformation));
        // −0 : 1×(−0) + 0×0 + 0×0 + 0 vaut +0 en IEEE comme en JS ; le signe n'est pas altéré par la division sautée.
        assert!(!point(&ident(), 0, -0.0, 0.0, 0.0).unwrap()[0].is_sign_negative());
        let mut d = ident();
        d[15] = 2.0;
        assert_eq!(point(&d, 0, 3.0, 1.0, -0.0).unwrap(), [1.5, 0.5, -0.0]);
    }

    #[test]
    fn parcours_retient_compte_et_s_arrete() {
        let m = mats(trans([10.0, 0.0, 0.0]), [0.0, 0.0, 0.0], [0.0, 1.5, 0.0]);
        // points locaux du nœud : dans le rail gauche, dans le droit, hors de tout, non fini
        let src: [f32; 12] = [-10.0, 0.1, 0.0, -10.2, 1.4, 0.1, 0.0, 0.0, 0.0, f32::NAN, 0.0, 0.0];
        let (mut e, mut r, mut s) = ([0.0; N_ETAT], [0u32; 8], [0.0; 24]);
        let k = parcourir(&src, 3, 4, 7, f64::INFINITY, &m, &mut e, &mut r, &mut s);
        assert_eq!(k, 2);
        assert_eq!(&r[..2], &[7, 8]);
        assert_eq!((e[E_TRAITES], e[E_NON_FINIS], e[E_PAR_RAIL[0]], e[E_PAR_RAIL[1]], e[E_ERREUR]), (4.0, 1.0, 1.0, 1.0, 0.0));
        assert_eq!(e[E_PROCHE[0] + 2], 7.0);
        assert_eq!(e[E_PROCHE[1] + 2], 8.0);
        // limite de points retenus : arrêt AVANT le point qui la dépasserait
        let mut e2 = [0.0; N_ETAT];
        let k = parcourir(&src, 3, 4, 7, 1.0, &m, &mut e2, &mut r, &mut s);
        assert_eq!((k, e2[E_TRAITES]), (1, 1.0));
    }

    #[test]
    fn exception_au_point_fautif_et_retenus_rendus() {
        let mut m = mats(ident(), [0.0; 3], [0.0, 1.5, 0.0]);
        // le rail droit projette à l'infini les points d'abscisse 5 : w = 1 + x·(−0,2)
        m[M_LOCAL[1] + 3] = -0.2;
        let src: [f64; 6] = [0.1, 0.0, 0.0, 5.0, 0.0, 0.0];
        let (mut e, mut r, mut s) = ([0.0; N_ETAT], [0u32; 4], [0.0; 12]);
        let k = parcourir(&src, 3, 2, 0, f64::INFINITY, &m, &mut e, &mut r, &mut s);
        assert_eq!(k, 1);
        assert_eq!(e[E_ERREUR], Erreur::Projection.code());
    }

    #[test]
    fn elagage_du_plus_proche_sans_effet() {
        // Même parcours avec et sans élagage (hypot calculé partout) : mêmes bits, sur 20 000 points pseudo-aléatoires.
        let m = mats(trans([3.0, -1.0, 0.5]), [0.2, 0.1, 0.0], [0.2, 1.6, 0.0]);
        let mut g = 12345u64;
        let mut al = || {
            g = g.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            ((g >> 11) as f64 / (1u64 << 53) as f64 - 0.5) * 8.0
        };
        let src: Vec<f32> = (0..60_000).map(|_| al() as f32).collect();
        let (mut e, mut r, mut s) = ([0.0; N_ETAT], std::vec![0u32; 20000], std::vec![0.0; 60000]);
        parcourir(&src, 3, 20000, 0, f64::INFINITY, &m, &mut e, &mut r, &mut s);
        // référence sans élagage
        let mut best = [(false, 0.0, 0u32); 2];
        for j in 0..20000 {
            let (x, y, z) = (f64::from(src[3 * j]), f64::from(src[3 * j + 1]), f64::from(src[3 * j + 2]));
            for (sd, b) in best.iter_mut().enumerate() {
                let l = point(&m, M_LOCAL[sd], x, y, z).unwrap();
                let d = ariane_js::hypot(&l);
                if !b.0 || d < b.1 {
                    *b = (true, d, j as u32);
                }
            }
        }
        for sd in 0..2 {
            assert_eq!(e[E_PROCHE[sd] + 1].to_bits(), best[sd].1.to_bits());
            assert_eq!(e[E_PROCHE[sd] + 2], f64::from(best[sd].2));
        }
    }
}
