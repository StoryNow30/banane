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
mod noyau;
pub use noyau::{parcourir, point};

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

