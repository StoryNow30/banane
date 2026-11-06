//! Fonctions pures de `src/gestes-vue.js`. Les suites qui tirent `Math.random` et l'émission DOM restent en JS.
use crate::util::{
    au, ch, champ, est_tableau, json_liste, liste, nb, nul, num, obj, opt_nombre, ou_nul, Elem,
};
use ariane_js::Echec;
use ariane_vba::Valeur;

fn f_ou_nan(v: &Valeur) -> Result<f64, Echec> {
    match v {
        Valeur::Indefini => Ok(f64::NAN),
        Valeur::Nul => Ok(0.0),
        Valeur::Nombre(x) => Ok(*x),
        _ => Err(Echec::hors_domaine("nombre attendu")),
    }
}

/// `pixelMm`. `NaN` si la caméra ne donne pas une taille (comme le JS).
pub fn pixel_mm(cam: &Valeur) -> Result<f64, Echec> {
    if !cam.vrai() {
        return Ok(f64::NAN);
    }
    let vp = champ(cam, "viewport");
    if !vp.vrai() {
        return Ok(f64::NAN);
    }
    let largeur = champ(vp, "width");
    if !largeur.vrai() {
        return Ok(f64::NAN);
    }
    let proj = champ(cam, "projection");
    if !est_tableau(proj) {
        return Ok(f64::NAN);
    }
    let l = liste(proj)?;
    let p0 = au(&l, 0);
    if !num(p0.f()).vrai() {
        return Ok(f64::NAN);
    }
    let (Elem::Nombre(p), Valeur::Nombre(w)) = (p0, largeur) else {
        return Err(Echec::hors_domaine(
            "pixelMm : largeur ou focale non numérique",
        ));
    };
    Ok(2.0 / p.abs() / w * 1000.0)
}

/// `resumeCamera`.
pub fn resume_camera(cam: &Valeur) -> Result<Valeur, Echec> {
    if !cam.vrai() {
        return Ok(nul());
    }
    let mm = nb(pixel_mm(cam)?, 1000.0);
    let vue = if champ(cam, "viewport").vrai() {
        let vp = champ(cam, "viewport");
        if !matches!(vp, Valeur::Objet(_)) {
            return Err(Echec::hors_domaine("viewport non objet"));
        }
        let arrondi =
            |k: &str| -> Result<f64, Echec> { Ok(ariane_js::round(f_ou_nan(champ(vp, k))?)) };
        Valeur::Nombres(vec![arrondi("width")?, arrondi("height")?])
    } else {
        nul()
    };
    Ok(obj(vec![("mmPx", ou_nul(mm)), ("vue", vue)]))
}

/// `ecartCamera`. `None` si une caméra n'a pas de repère (le JS rend `null`).
pub fn ecart_camera(avant: &Valeur, apres: &Valeur) -> Result<Option<Valeur>, Echec> {
    let a = champ(avant, "cameraToSceneRelative");
    let b = champ(apres, "cameraToSceneRelative");
    if !avant.vrai() || !apres.vrai() || !a.vrai() || !b.vrai() {
        return Ok(None);
    }
    let la = liste(a)?;
    let lb = liste(b)?;
    let mut d = [0.0; 3];
    for (i, slot) in d.iter_mut().enumerate() {
        let idx = i + 12;
        *slot = au(&lb, idx).f() - au(&la, idx).f();
    }
    let d0 = d.first().copied().unwrap_or(f64::NAN);
    let d1 = d.get(1).copied().unwrap_or(f64::NAN);
    let d2 = d.get(2).copied().unwrap_or(f64::NAN);
    let axe = |k: usize| -> f64 {
        let base = k.saturating_mul(4);
        let v0 = au(&la, base).f();
        let v1 = au(&la, base.saturating_add(1)).f();
        let v2 = au(&la, base.saturating_add(2)).f();
        let n = ariane_js::hypot(&[v0, v1, v2]);
        let n = if num(n).vrai() { n } else { 1.0 };
        (d0 * v0 + d1 * v1 + d2 * v2) / n * 1000.0
    };
    let pa = pixel_mm(avant)?;
    let pb = pixel_mm(apres)?;
    let zoom = if pa.is_finite() && pb.is_finite() && pa > 0.0 {
        ou_nul(nb(pb / pa, 1000.0))
    } else {
        nul()
    };
    let dep = Valeur::Tableau(
        vec![
            ou_nul(nb(axe(0), 10.0)),
            ou_nul(nb(axe(1), 10.0)),
            ou_nul(nb(axe(2), 10.0)),
        ]
        .into_iter()
        .map(Some)
        .collect(),
    );
    Ok(Some(obj(vec![("deplacementMm", dep), ("zoom", zoom)])))
}

/// `memeCamera`.
pub fn meme_camera(a: &Valeur, b: &Valeur) -> Result<Valeur, Echec> {
    if !a.vrai() || !b.vrai() {
        return Ok(Valeur::Booleen(false));
    }
    let comparer = |cle: &str, eps: f64| -> Result<bool, Echec> {
        let (x, y) = (champ(a, cle), champ(b, cle));
        if !est_tableau(x) || !est_tableau(y) {
            return Err(Echec::hors_domaine("memeCamera : tableau attendu"));
        }
        let (lx, ly) = (liste(x)?, liste(y)?);
        for (i, e) in lx.iter().enumerate() {
            let d = (e.f() - au(&ly, i).f()).abs();
            if d > eps {
                return Ok(false);
            }
        }
        Ok(true)
    };
    // Le JS lève si `projection` manque : hors domaine, la façade rejoue.
    if !est_tableau(champ(a, "cameraToSceneRelative"))
        || !est_tableau(champ(b, "cameraToSceneRelative"))
    {
        return Ok(Valeur::Booleen(false));
    }
    let ok = comparer("cameraToSceneRelative", 1e-9)? && comparer("projection", 1e-12)?;
    Ok(Valeur::Booleen(ok))
}

/// `besoin(ndc, viewport, marge=.99)`.
pub fn besoin(ndc: &Valeur, viewport: &Valeur, marge: &Valeur) -> Result<Valeur, Echec> {
    let l = liste(ndc)?;
    let ax = au(&l, 0).f().abs();
    let ay = au(&l, 1).f().abs();
    let m = match marge {
        Valeur::Indefini => 0.99,
        Valeur::Nul => 0.0,
        Valeur::Nombre(x) => *x,
        _ => return Err(Echec::hors_domaine("marge non numérique")),
    };
    let ex = |a: f64| ariane_js::max(0.0, a - m);
    let largeur = f_ou_nan(champ(viewport, "width"))?;
    let hauteur = f_ou_nan(champ(viewport, "height"))?;
    let dezoom = ariane_js::max(1.0, ariane_js::max(ax, ay) / m);
    let pan = ariane_js::max(ex(ax) * largeur / 2.0, ex(ay) * hauteur / 2.0);
    Ok(obj(vec![
        ("dans", Valeur::Booleen(ax <= m && ay <= m)),
        ("dezoom", num(dezoom)),
        ("panPx", num(pan)),
    ]))
}

fn mouvement(x: f64, y: f64, dernier: &Valeur) -> Result<(f64, f64), Echec> {
    if !dernier.vrai() {
        return Ok((0.0, 0.0));
    }
    let l = liste(dernier)?;
    let dx = ariane_js::round(x - au(&l, 0).f());
    let dy = ariane_js::round(y - au(&l, 1).f());
    Ok((dx, dy))
}

/// `approche(x, y, boutons=0, dernier=null)`.
pub fn approche(
    x: &Valeur,
    y: &Valeur,
    boutons: &Valeur,
    dernier: &Valeur,
) -> Result<Valeur, Echec> {
    let (Some(x), Some(y)) = (opt_nombre(x)?, opt_nombre(y)?) else {
        return Err(Echec::hors_domaine("approche : coordonnées non numériques"));
    };
    let boutons = match boutons {
        Valeur::Indefini => num(0.0),
        autre => autre.clone(),
    };
    let (mx, my) = mouvement(x, y, dernier)?;
    let pression = if boutons.vrai() { 0.5 } else { 0.0 };
    let mv = [("movementX", num(mx)), ("movementY", num(my))];
    let mut init_p = vec![
        ("pointerId", num(1.0)),
        ("pointerType", ch("mouse")),
        ("isPrimary", Valeur::Booleen(true)),
        ("width", num(1.0)),
        ("height", num(1.0)),
        ("tiltX", num(0.0)),
        ("tiltY", num(0.0)),
        ("twist", num(0.0)),
        ("tangentialPressure", num(0.0)),
        ("clientX", num(x)),
        ("clientY", num(y)),
        ("button", num(-1.0)),
        ("buttons", boutons.clone()),
        ("pressure", num(pression)),
    ];
    init_p.extend(mv);
    let init_s = obj(vec![
        ("clientX", num(x)),
        ("clientY", num(y)),
        ("button", num(0.0)),
        ("buttons", boutons),
        ("movementX", num(mx)),
        ("movementY", num(my)),
    ]);
    let desc = |genre: &str, type_: &str, init: Valeur| {
        obj(vec![
            ("genre", ch(genre)),
            ("type", ch(type_)),
            ("init", init),
            ("apresMs", num(0.0)),
        ])
    };
    Ok(Valeur::Tableau(vec![
        Some(desc("pointer", "pointermove", obj(init_p))),
        Some(desc("mouse", "mousemove", init_s)),
    ]))
}

/// Clé d'immobilité : `JSON.stringify([cameraToSceneRelative, projection])`, ou `None` si la caméra est vide.
pub fn cle_camera(c: &Valeur) -> Result<Option<String>, Echec> {
    if matches!(c, Valeur::Nul | Valeur::Indefini) || !c.vrai() {
        return Ok(None);
    }
    if !matches!(c, Valeur::Objet(_)) {
        return Err(Echec::hors_domaine("caméra non objet"));
    }
    let morceau = |k: &str| -> Result<String, Echec> {
        let v = champ(c, k);
        if matches!(v, Valeur::Indefini | Valeur::Nul) {
            return Ok("null".to_owned());
        }
        if !est_tableau(v) {
            return Err(Echec::hors_domaine("champ de caméra non tabulaire"));
        }
        json_liste(v)
    };
    Ok(Some(format!(
        "[{},{}]",
        morceau("cameraToSceneRelative")?,
        morceau("projection")?
    )))
}
