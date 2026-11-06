//! `src/garde-apres-differe.js` et `src/garde-passe-appuis.js`, à l'identique.
use crate::critere::vers_nombre;
use crate::js::*;
use ariane_vba::Valeur as V;

const SIDES: [&str; 2] = ["left", "right"];

/// Premier paramètre déstructuré (`{a,b}={}`) : `undefined` vaut `{}`, `null` lève (hors domaine).
fn destructure(v: &V) -> R<&V> { match v { V::Nul => hd("déstructuration de null"), x => Ok(x) } }

// ---------------------------------------------------------------- garde après un différé (R1, R3)
pub mod apres_differe {
    use super::*;
    pub fn defaut() -> V { o(vec![("actif", b(true)), ("ombre", b(false)), ("regle", s("R3")), ("coupures", n(2.0)), ("appuisMin", n(2.0))]) }
    const CLES: [&str; 5] = ["actif", "ombre", "regle", "coupures", "appuisMin"];

    pub fn reglage(valeur: &V, defaut_: &V) -> R<V> {
        let d = if est_simple(defaut_) { fusion2(&defaut(), defaut_)? } else { defaut() };
        let livre: Vec<(&str, V)> = CLES.iter().map(|k| (*k, g(&d, k).clone())).collect();
        let illisible = |raison: &str| { let mut t = vec![("ok", b(false)), ("raison", s(raison))]; t.extend(livre.clone()); Ok(o(t)) };
        let vide = o(vec![]);
        let valeur = match valeur {
            V::Indefini => &vide,
            V::Booleen(false) => { let mut t = vec![("ok", b(true))]; t.extend(livre.clone()); t.push(("actif", b(false))); return Ok(o(t)); }
            x => x,
        };
        if !est_simple(valeur) { return illisible("gardeApresDiffere illisible"); }
        let r = fusion2(&d, valeur)?;
        if !matches!(g(&r, "actif"), V::Booleen(_)) { return illisible("gardeApresDiffere.actif illisible"); }
        if !matches!(g(&r, "ombre"), V::Booleen(_)) { return illisible("gardeApresDiffere.ombre illisible"); }
        if !matches!(g(&r, "regle"), V::Chaine(c) if c == "R1" || c == "R3") { return illisible("gardeApresDiffere.regle illisible"); }
        if !(entier(g(&r, "coupures")) && num(g(&r, "coupures")).unwrap() >= 1.0) { return illisible("gardeApresDiffere.coupures illisible"); }
        if !(entier(g(&r, "appuisMin")) && num(g(&r, "appuisMin")).unwrap() >= 0.0) { return illisible("gardeApresDiffere.appuisMin illisible"); }
        let mut t = vec![("ok", b(true))];
        for k in CLES { t.push((k, g(&r, k).clone())); }
        Ok(o(t))
    }

    pub fn voisins_differes(cut: &V, differes: &V, coupures: &V) -> R<Vec<f64>> {
        if !entier(cut) || !est_tableau(differes) { return Ok(vec![]); }
        let c = num(cut).unwrap();
        let mut lim: Option<f64> = None;
        let mut vus: Vec<f64> = vec![];
        for x in presents(differes) {
            if !entier(&x) { continue; }
            let x = num(&x).unwrap();
            if !(x < c) { continue; }
            let l = match lim { Some(l) => l, None => { let l = c - vers_nombre(coupures)?; lim = Some(l); l } };
            if x >= l && !vus.contains(&x) { vus.push(x + 0.0); } // Set ramène −0 à +0
        }
        ariane_js::trier_nombres(&mut vus);
        Ok(vus)
    }

    pub fn juger(entree: &V, r_: &V) -> R<V> {
        let e = destructure(entree)?;
        let r = if est_simple(r_) { r_.clone() } else { reglage(&V::Indefini, &V::Indefini)? };
        let vd = voisins_differes(g(e, "cut"), g(e, "differesLot"), g(&r, "coupures"))?;
        let ap = g(e, "appuis");
        let a = if entier(ap) && num(ap).unwrap() >= 0.0 { Some(ap.clone()) } else { None };
        let mut out = vec![("regle", g(&r, "regle").clone()), ("appuis", a.clone().unwrap_or(V::Nul)), ("voisinsDifferes", tab_n(&vd))];
        let ok_faux = matches!(g(&r, "ok"), V::Booleen(false));
        if ok_faux { out.push(("reglageIllisible", b(true))); }
        let actif_faux = matches!(g(&r, "actif"), V::Booleen(false));
        let ombre = !ok_faux && actif_faux && matches!(g(&r, "ombre"), V::Booleen(true));
        let rendre = |differer: bool, motif: &str, aurait: Option<bool>| {
            let mut t = vec![("differer", b(differer)), ("motif", s(motif))];
            if let Some(x) = aurait { t.push(("aurait", b(x))); }
            t.extend(out.clone());
            Ok(o(t))
        };
        if !ok_faux && actif_faux && !ombre { return rendre(false, "garde-coupee", None); }
        let aurait = !vd.is_empty() && !(matches!(g(&r, "regle"), V::Chaine(c) if c == "R3") && {
            let av = match &a { Some(V::Nombre(x)) => *x, _ => 0.0 };
            av >= vers_nombre(g(&r, "appuisMin"))?
        });
        if ombre { return rendre(false, "ombre", Some(aurait)); }
        if vd.is_empty() { return rendre(false, "pas-de-differe", None); }
        if !aurait { return rendre(false, "appuis", None); }
        rendre(true, "garde-apres-differe", None)
    }

    pub fn appeler(a: &Appel) -> R<V> {
        match a.f.as_str() {
            "reglage" => reglage(a.arg(0), a.arg(1)),
            "voisinsDifferes" => Ok(tab_n(&voisins_differes(a.arg(0), a.arg(1), a.arg(2))?)),
            "juger" => juger(a.arg(0), a.arg(1)),
            _ => hd("garde-apres-differe : fonction non portée"),
        }
    }
}

// ---------------------------------------------------------------- garde A de la deuxième passe
pub mod passe_appuis {
    use super::*;
    pub fn defaut() -> V { o(vec![("actif", b(true)), ("deplacementMaxMm", n(100.0)), ("appuiNormalMaxCuts", n(4.0))]) }

    pub fn reglage(valeur: &V, defaut_: &V) -> R<V> {
        let d = if est_simple(defaut_) { fusion2(&defaut(), defaut_)? } else { defaut() };
        let vide = o(vec![]);
        let valeur = match valeur {
            V::Indefini => &vide,
            V::Booleen(false) => return Ok(o(vec![("ok", b(true)), ("actif", b(false)), ("deplacementMaxMm", g(&d, "deplacementMaxMm").clone()),
                ("appuiNormalMaxCuts", g(&d, "appuiNormalMaxCuts").clone())])),
            x => x,
        };
        let non = |r: &str| Ok(o(vec![("ok", b(false)), ("raison", s(r))]));
        if !est_simple(valeur) { return non("gardeAppuis illisible"); }
        let r = fusion2(&d, valeur)?;
        if !matches!(g(&r, "actif"), V::Booleen(_)) { return non("gardeAppuis.actif illisible"); }
        if !matches!(g(&r, "deplacementMaxMm"), V::Nombre(x) if x.is_finite() && *x > 0.0) { return non("gardeAppuis.deplacementMaxMm illisible"); }
        if !(entier(g(&r, "appuiNormalMaxCuts")) && num(g(&r, "appuiNormalMaxCuts")).unwrap() >= 0.0) { return non("gardeAppuis.appuiNormalMaxCuts illisible"); }
        Ok(o(vec![("ok", b(true)), ("actif", g(&r, "actif").clone()), ("deplacementMaxMm", g(&r, "deplacementMaxMm").clone()),
            ("appuiNormalMaxCuts", g(&r, "appuiNormalMaxCuts").clone())]))
    }

    pub fn deplacement_mm(decal: &V) -> Option<f64> {
        if !est_simple(decal) { return None; }
        let mut m = f64::NEG_INFINITY;
        for sd in SIDES {
            let v = g(decal, sd);
            if !est_tableau(v) || longueur(v).unwrap() < 3 { return None; }
            let t: Vec<Option<V>> = elems(v).unwrap().into_iter().take(3).collect();
            if !t.iter().flatten().all(fini) { return None; }
            let x: Vec<f64> = t.iter().map(|e| e.as_ref().and_then(num).unwrap_or(f64::NAN)).collect();
            m = ariane_js::max(m, ariane_js::hypot(&x));
        }
        Some(m)
    }

    pub fn appui_normal_cuts(cut: &V, normaux: &V) -> Option<f64> {
        if !entier(cut) || !est_tableau(normaux) { return None; }
        let c = num(cut).unwrap();
        let mut m: Option<f64> = None;
        for x in elems(normaux).unwrap() {
            let Some(x) = x.filter(entier).and_then(|x| num(&x)) else { continue };
            if x == c { continue; }
            let d = (x - c).abs();
            if m.is_none_or(|m| d < m) { m = Some(d); }
        }
        m
    }

    pub fn juger(entree: &V, r_: &V, r_passe: bool) -> R<V> {
        let e = destructure(entree)?;
        let def;
        let r = if r_passe && !matches!(r_, V::Indefini) { r_ } else { def = reglage(&V::Indefini, &V::Indefini)?; &def };
        let d = deplacement_mm(g(e, "decal"));
        let a = appui_normal_cuts(g(e, "cut"), g(e, "cutsNormaux"));
        let out = vec![("deplacementMm", n_ou_nul(d.map(arrondi1))), ("appuiNormalCuts", n_ou_nul(a))];
        let rendre = |bloque: bool, motif: &str| { let mut t = vec![("bloque", b(bloque)), ("motif", s(motif))]; t.extend(out.clone()); Ok(o(t)) };
        if !vrai(r) || matches!(g(r, "ok"), V::Booleen(false)) { return rendre(true, "garde-appuis"); }
        if matches!(g(r, "actif"), V::Booleen(false)) { return rendre(false, "garde-coupee"); }
        if let Some(dv) = d { if !(dv < vers_nombre(g(r, "deplacementMaxMm"))?) { return rendre(false, "loin-du-depart"); } }
        if let (Some(_), Some(av)) = (d, a) { if av <= vers_nombre(g(r, "appuiNormalMaxCuts"))? { return rendre(false, "appui-normal"); } }
        rendre(true, "garde-appuis")
    }

    pub fn appeler(a: &Appel) -> R<V> {
        match a.f.as_str() {
            "reglage" => reglage(a.arg(0), a.arg(1)),
            "deplacementMm" => Ok(n_ou_nul(deplacement_mm(a.arg(0)))),
            "appuiNormalCuts" => Ok(n_ou_nul(appui_normal_cuts(a.arg(0), a.arg(1)))),
            "juger" => juger(a.arg(0), a.arg(1), a.nb() >= 2),
            _ => hd("garde-passe-appuis : fonction non portée"),
        }
    }
}
