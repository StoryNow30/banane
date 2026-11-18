//! Données synthétiques communes aux essais (aucune donnée réelle dans le dépôt) : un champignon rectangulaire de
//! 70 mm de large, contour et points `LiDAR` sur son dessus (z = 0) et son flanc côté voie (u = 0), repère identité.
use ariane_vba::Valeur;

/// Une capture synthétique : rails gauche et droit identiques, `n` points par surface et par rang de x.
pub fn capture(n: usize) -> Valeur {
    let mut contour = vec![];
    for i in 0..=14 { contour.push(Valeur::Nombres(vec![0.0, f64::from(i) * 0.005, 0.0])); } // dessus
    for i in 1..=8 { contour.push(Valeur::Nombres(vec![0.0, 0.0, -f64::from(i) * 0.005])); } // flanc
    let rail = Valeur::Objet(vec![
        ("sceneRelativeToProfileLocal".into(), Valeur::Nombres(vec![1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.])),
        ("profileContours".into(), Valeur::Tableau(vec![Some(Valeur::Objet(vec![("verticesSceneRelative".into(), Valeur::Tableau(contour.into_iter().map(Some).collect()))]))])),
    ]);
    let mut pts = vec![];
    let pas = 1.0 / n as f64;
    for k in 0..n {
        let x = -0.3 + 0.6 * (k as f64) * pas;
        for i in 0..=34 { pts.extend_from_slice(&[x, f64::from(i) * 0.002, 0.0]); }
        for i in 1..=15 { pts.extend_from_slice(&[x, 0.0, -f64::from(i) * 0.002]); }
    }
    Valeur::Objet(vec![
        ("rails".into(), Valeur::Objet(vec![("left".into(), rail.clone()), ("right".into(), rail)])),
        ("pointsSceneRelative".into(), Valeur::Bloc { k: 3, donnees: pts }),
        ("visibleByClipBoxes".into(), Valeur::Booleens(vec![true; n * 50])),
    ])
}
