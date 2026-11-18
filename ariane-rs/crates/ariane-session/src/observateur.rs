//! `src/esv-observer.js`, table observée : `voisins(tables, req)` (fonction 296), pour la mesure. La table vit dans la
//! page d'ESV (monde principal, sous la politique de sécurité d'ESV, sans cœur WASM) : en production, `voisins` reste
//! en JS (voir le rapport). Entrée : `tables` en liste `[{key, n, ed, st, fl, pages, fraiches, debut, rompue,
//! tronquee}]` (la carte et ses tableaux parallèles, `n = rk.length`), `req` tel quel.
use crate::js_extra::{self as js, ch, chemin, hd, s, tab, Obj};
use ariane_js::Echec;
use ariane_vba::Valeur;

const NOMS: [&str; 4] = ["valid", "invalid", "skipped", "autre"];
const VOISINS_MAX: f64 = 10.0;

fn nombres(v: &Valeur) -> Result<std::borrow::Cow<'_, [f64]>, Echec> {
    match v {
        Valeur::Nombres(t) => Ok(std::borrow::Cow::Borrowed(t)),
        Valeur::Tableau(t) if t.is_empty() => Ok(std::borrow::Cow::Owned(vec![])),
        _ => hd("voisins : colonne non numérique"),
    }
}
/// `p` : tableau de 3 nombres finis, sinon None.
fn point(p: &Valeur) -> Result<Option<[f64; 3]>, Echec> {
    if !js::est_tableau(p) || js::longueur(p) != Some(3.0) { return Ok(None); }
    let l = js::denses(p)?.unwrap_or_default();
    let mut o = [0.0; 3];
    for (c, x) in o.iter_mut().zip(l.iter()) { match js::fini(x) { Some(v) => *c = v, None => return Ok(None) } }
    Ok(Some(o))
}

/// `voisins(tables, req)`.
///
/// # Errors
/// Hors domaine : colonnes non numériques.
pub fn voisins(tables: &Valeur, req: &Valeur) -> Result<Valeur, Echec> {
    let invalide = || Obj::new().et("ok", Valeur::Booleen(false)).et("reason", s("demande-invalide")).v();
    let (cut, w) = (js::entier(ch(req, "cut")), js::entier(ch(req, "fenetre")));
    let (Some(cut), Some(w)) = (cut, w) else { return Ok(invalide()) };
    if cut < 0.0 || w < 1.0 || w > VOISINS_MAX { return Ok(invalide()); }
    let (Some(wl), Some(wr)) = (point(chemin(req, &["world", "left"]))?, point(chemin(req, &["world", "right"]))?) else { return Ok(invalide()) };
    let ts = js::denses(tables)?.ok_or_else(|| Echec::hors_domaine("voisins : tables"))?;
    if ts.is_empty() { return Ok(Obj::new().et("ok", Valeur::Booleen(false)).et("reason", s("sans-table")).v()); }
    let mut best: Option<(usize, usize, f64)> = None;
    let mut second = f64::INFINITY;
    let mut cols = vec![];
    for (ti, t) in ts.iter().enumerate() {
        let n = js::nombre(ch(t, "n")).ok_or_else(|| Echec::hors_domaine("voisins : n"))?;
        let ed = nombres(ch(t, "ed"))?;
        let g = |k: usize| ed.get(k).copied().unwrap_or(f64::NAN);
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)] // longueur d'un tableau JS : entier positif
        for i in 0..(n as usize) {
            let o = 6 * i;
            let dl = ariane_js::hypot(&[g(o) - wl[0], g(o + 1) - wl[1], g(o + 2) - wl[2]]);
            let dr = ariane_js::hypot(&[g(o + 3) - wr[0], g(o + 4) - wr[1], g(o + 5) - wr[2]]);
            let d = ariane_js::max(dl, dr);
            if d.is_nan() { continue; }
            match best {
                Some((_, _, bd)) if !(d < bd) => { if d < second { second = d; } }
                Some((_, _, bd)) => { second = ariane_js::min(second, bd); best = Some((ti, i, d)); }
                None => best = Some((ti, i, d)),
            }
        }
        cols.push(ed);
    }
    let Some((ti, index, d)) = best else { return Ok(Obj::new().et("ok", Valeur::Booleen(false)).et("reason", s("sans-ligne")).v()) };
    let t = ts.get(ti).ok_or_else(|| Echec::hors_domaine("voisins : table"))?;
    let n = js::nombre(ch(t, "n")).unwrap_or(0.0);
    let (st, fl) = (nombres(ch(t, "st"))?, nombres(ch(t, "fl"))?);
    let ed = cols.get(ti).ok_or_else(|| Echec::hors_domaine("voisins : colonnes"))?;
    let mut rows = vec![];
    let debut = ariane_js::max(0.0, cut - w);
    let fin = ariane_js::min(n - 1.0, cut + w);
    let mut i = debut;
    while i <= fin {
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)] // i entier de 0 à n − 1
        let k = i as usize;
        let e: Vec<f64> = ed.get(6 * k..(6 * k + 6).min(ed.len())).unwrap_or_default().to_vec();
        let nom = st.get(k).and_then(|x| { #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)] let j = *x as usize; (x.fract() == 0.0 && *x >= 0.0).then(|| NOMS.get(j)).flatten() }).copied().unwrap_or("autre");
        #[allow(clippy::cast_possible_truncation)] // drapeaux : petits entiers (0 à 7)
        let f = fl.get(k).map_or(0, |x| *x as i64);
        let fin_e = e.iter().all(|x| x.is_finite());
        rows.push(Obj::new().et("i", Valeur::Nombre(i)).et("s", s(nom)).et("t", Valeur::Booleen(f & 1 != 0)).et("v", Valeur::Booleen(f & 2 != 0))
            .et("f", Valeur::Booleen(f & 4 != 0)).et("e", if fin_e { Valeur::Nombres(e) } else { Valeur::Nul }).v());
        i += 1.0;
    }
    Ok(Obj::new().et("ok", Valeur::Booleen(true))
        .et("table", Obj::new().et("lignes", Valeur::Nombre(n)).et("pages", ch(t, "pages").clone()).et("fraiches", ch(t, "fraiches").clone())
            .et("debut", ch(t, "debut").clone()).et("rompue", ch(t, "rompue").clone()).et("tronquee", ch(t, "tronquee").clone())
            .et("tables", Valeur::Nombre(ts.len() as f64)).v())
        .et("geo", Obj::new().et("index", Valeur::Nombre(index as f64)).et("mm", Valeur::Nombre(d * 1000.0))
            .et("secondMm", if second.is_finite() { Valeur::Nombre(second * 1000.0) } else { Valeur::Nul }).v())
        .et("rows", tab(rows)).v())
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn plus_proche() {
        let t = Obj::new().et("key", s("T")).et("n", Valeur::Nombre(2.0)).et("ed", Valeur::Nombres(vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 5.0, 0.0, 0.0, 6.0, 0.0, 0.0]))
            .et("st", Valeur::Nombres(vec![0.0, 1.0])).et("fl", Valeur::Nombres(vec![1.0, 6.0])).v();
        let req = Obj::new().et("cut", Valeur::Nombre(0.0)).et("fenetre", Valeur::Nombre(1.0))
            .et("world", Obj::new().et("left", Valeur::Nombres(vec![5.0, 0.0, 0.0])).et("right", Valeur::Nombres(vec![6.0, 0.0, 0.0])).v()).v();
        let r = voisins(&tab(vec![t]), &req).unwrap_or(Valeur::Nul);
        assert_eq!(chemin(&r, &["geo", "index"]), &Valeur::Nombre(1.0));
        assert_eq!(chemin(&r, &["geo", "secondMm"]), &Valeur::Nombre(5000.0));
        assert_eq!(js::longueur(ch(&r, "rows")), Some(2.0));
    }
}
