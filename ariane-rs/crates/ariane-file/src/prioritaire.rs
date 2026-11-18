//! `src/file-prioritaire.js` (CH-053-S) : classe d'un candidat, apprentissage des taux, file ordonnée, plages.
#![allow(clippy::float_cmp)] // `===` et `!==` du JS sur des nombres : comparaison exacte voulue
use crate::js::{ch, cle, elements, en_chaine, est, est_entier, est_fini, hd, iterer, nombre, objet, opt, poser, tableau, R};
use ariane_js::nombre::nombre_en_chaine;
use ariane_vba::Valeur;

const VERSION: &str = "file-prioritaire-1";
const SEUIL_VERT_FORT: f64 = 2.0;
const SEUIL_VERT_MOYEN: f64 = 1.0;
const PLANCHER_PAR_MIN: f64 = 5.0;
const HORS_CONTRAT: &str = "gauge-out-of-contract/gauge-out-of-contract";
const SANS_POINTS: &str = "input/input";

/// `r1(v)` : arrondi au dixième, `null` (None) si `v` n'est pas fini.
fn r1(v: f64) -> Option<f64> { if v.is_finite() { Some(ariane_js::round(v * 10.0) / 10.0) } else { None } }
fn nv(v: Option<f64>) -> Valeur { v.map_or(Valeur::Nul, Valeur::Nombre) }

/// `taux(n, informatifs, avecTraits, coutS)`.
fn taux(n: f64, informatifs: f64, avec_traits: f64, cout_s: f64) -> Valeur {
    // `r1(…) / 100` : null / 100 vaut 0
    let p = if n != 0.0 && !n.is_nan() { r1(informatifs / n * 100.0).unwrap_or(0.0) / 100.0 } else { 0.0 };
    let par_min = if cout_s > 0.0 { nv(r1(informatifs / cout_s * 60.0)) } else { Valeur::Nombre(0.0) };
    objet(vec![("n", Valeur::Nombre(n)), ("informatifs", Valeur::Nombre(informatifs)), ("avecTraits", Valeur::Nombre(avec_traits)), ("coutS", nv(r1(cout_s))), ("p", Valeur::Nombre(p)), ("parMin", par_min)])
}

/// `TAUX_DEFAUT` (mesuré le 04/11, voir le JS).
fn taux_defaut() -> Valeur {
    let t: [(&str, [f64; 4]); 8] = [("D-contrat", [8.0, 7.0, 7.0, 29.8]), ("D-sanspoints", [46.0, 25.0, 0.0, 172.0]), ("D-points", [11.0, 4.0, 4.0, 95.5]), ("vert-fort", [10.0, 5.0, 0.0, 21.1]),
        ("vert-moyen", [22.0, 2.0, 0.0, 36.3]), ("vert-faible", [68.0, 1.0, 0.0, 88.0]), ("vert-inconnu", [70.0, 5.0, 0.0, 129.5]), ("posee-ariane", [14.0, 1.0, 0.0, 23.8])];
    objet(t.iter().map(|(k, [n, i, a, c])| (*k, taux(*n, *i, *a, *c))).collect())
}

/// `classe(c)`.
#[must_use]
pub fn classe(c: &Valeur) -> &'static str {
    let src = opt(c, "source");
    if c.vrai() && est(src, "differe") {
        let m = opt(c, "motif");
        return if est(m, HORS_CONTRAT) { "D-contrat" } else if est(m, SANS_POINTS) { "D-sanspoints" } else { "D-points" };
    }
    if c.vrai() && est(src, "vert") {
        let Valeur::Nombre(s) = opt(c, "score") else { return "vert-inconnu" };
        if !s.is_finite() { return "vert-inconnu"; }
        return if *s >= SEUIL_VERT_FORT { "vert-fort" } else if *s >= SEUIL_VERT_MOYEN { "vert-moyen" } else { "vert-faible" };
    }
    "posee-ariane"
}

/// `apprendreTaux(observations)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn apprendre_taux(observations: &Valeur) -> R<Valeur> {
    let obs = if observations.vrai() { iterer(observations)? } else { vec![] };
    // acc : clé → (n, inf, tr, t), dans l'ordre des clés de V8
    let mut ordre = Valeur::Objet(vec![]);
    let mut acc: Vec<(String, [f64; 4])> = vec![];
    for o in obs {
        if !o.vrai() || !opt(&o, "classe").vrai() || !est_fini(opt(&o, "coutS")) { continue; }
        let k = cle(opt(&o, "classe"))?;
        let i = if let Some(i) = acc.iter().position(|(c, _)| *c == k) { i } else { acc.push((k.clone(), [0.0; 4])); poser(&mut ordre, &k, Valeur::Nul)?; acc.len() - 1 };
        let cout = crate::js::nombre(opt(&o, "coutS"))?;
        let (inf, tr) = (opt(&o, "informatif").vrai(), opt(&o, "avecTraits").vrai());
        if let Some((_, a)) = acc.get_mut(i) {
            a[0] += 1.0;
            a[3] += cout;
            if inf { a[1] += 1.0; }
            if inf && tr { a[2] += 1.0; }
        }
    }
    let Valeur::Objet(cles) = ordre else { return hd("accumulateur") };
    let mut out = Vec::with_capacity(cles.len());
    for (k, _) in cles {
        let Some((_, a)) = acc.iter().find(|(c, _)| *c == k) else { return hd("accumulateur") };
        out.push((k, taux(a[0], a[1], a[2], a[3])));
    }
    Ok(Valeur::Objet(out))
}

type Entree = (Vec<(&'static str, Valeur)>, f64, f64, f64);

fn groupe(source: &Valeur) -> R<&'static str> {
    let k = cle(source)?;
    Ok(match k.as_str() { "differe" => "poser", "vert" => "controler", _ => "corriger" }) // GROUPE.posee vaut aussi « corriger »
}

/// `ordonner(candidats, options)`. `juges` : les chaînes de `options.jugesDeja` (un `Set`, lu par la façade).
/// `taux` du rendu vaut `null` : la façade y remet l'objet `T` reçu (même référence que le JS).
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn ordonner(candidats: &Valeur, options: &Valeur, juges: &[String]) -> R<Valeur> {
    let vide = objet(vec![]);
    let options = match options { Valeur::Indefini => &vide, Valeur::Nul => return hd("options null"), x => x };
    let t_opt = opt(options, "taux");
    let defaut;
    let tt = if t_opt.vrai() { t_opt } else { defaut = taux_defaut(); &defaut };
    let pl = opt(options, "plancherParMin");
    let plancher = if est_fini(pl) { nombre(pl)? } else { PLANCHER_PAR_MIN };
    let traits = est(opt(options, "critere"), "avec-traits");
    // (champs de l'entrée, rendement `_r`, partie et cut en nombres pour le tri)
    let mut entrees: Vec<Entree> = vec![];
    let mut ecartes = vec![];
    let mut deja = 0.0;
    let liste = if candidats.vrai() { iterer(candidats)? } else { vec![] };
    for c in liste {
        if !c.vrai() || !est_entier(opt(&c, "cut")) { continue; }
        let (part, cut) = (opt(&c, "part").clone(), opt(&c, "cut").clone());
        let cle_j = format!("{}:{}", en_chaine(&part)?, en_chaine(&cut)?);
        if juges.contains(&cle_j) { deja += 1.0; continue; }
        let cl = classe(&c);
        let t = opt(tt, cl);
        let par_min = if t.vrai() && nombre(opt(t, "coutS"))? > 0.0 {
            let num = nombre(opt(t, if traits { "avecTraits" } else { "informatifs" }))?;
            r1(num / nombre(opt(t, "coutS"))? * 60.0)
        } else { None };
        let mut details = vec![("classe", ch(cl)), ("pInfo", if t.vrai() { opt(t, "p").clone() } else { Valeur::Nul }),
            ("coutS", if t.vrai() && opt(t, "n").vrai() { nv(r1(nombre(opt(t, "coutS"))? / nombre(opt(t, "n"))?)) } else { Valeur::Nul }), ("attenduParMin", nv(par_min))];
        if est_fini(opt(&c, "score")) { details.push(("score", opt(&c, "score").clone())); }
        if opt(&c, "motif").vrai() { details.push(("motif", opt(&c, "motif").clone())); }
        let src = opt(&c, "source");
        let e = vec![("part", part.clone()), ("cut", cut.clone()), ("groupe", ch(groupe(src)?)), ("signaux", tableau(vec![ch(cl)])), ("details", objet(details))];
        let du = est(src, "differe");
        if !du && !par_min.is_some_and(|p| p >= plancher) {
            ecartes.push(objet(vec![("part", part), ("cut", cut), ("classe", ch(cl)), ("attenduParMin", nv(par_min))]));
            continue;
        }
        let r = par_min.unwrap_or(-1.0);
        let pn = nombre(&part)?;
        let cn = nombre(&cut)?;
        entrees.push((e, r, pn, cn));
    }
    // Le comparateur du JS soustrait les parties : une partie qui vaut NaN le rendrait incohérent (ordre propre à TimSort).
    if entrees.len() > 1 && entrees.iter().any(|x| x.2.is_nan()) { return hd("partie non numérique dans le tri"); }
    let cmp = |a: f64, b: f64| a.partial_cmp(&b).unwrap_or(core::cmp::Ordering::Equal);
    let balayage = est(opt(options, "ordre"), "balayage");
    if balayage { entrees.sort_by(|a, b| cmp(a.2, b.2).then(cmp(a.3, b.3))); } else { entrees.sort_by(|a, b| cmp(b.1, a.1).then(cmp(a.2, b.2)).then(cmp(a.3, b.3))); }
    let entrees: Vec<Valeur> = entrees.into_iter().enumerate().map(|(i, (mut e, ..))| { e.push(("rang", Valeur::Nombre((i + 1) as f64))); objet(e) }).collect();
    Ok(objet(vec![("version", ch(VERSION)), ("ordre", ch(if balayage { "balayage" } else { "rendement" })), ("critere", ch(if traits { "avec-traits" } else { "informatif" })),
        ("plancherParMin", Valeur::Nombre(plancher)), ("dejaJuges", Valeur::Nombre(deja)), ("taux", Valeur::Nul), ("entrees", tableau(entrees)), ("ecartes", tableau(ecartes))]))
}

/// `plages(cuts)`.
///
/// # Errors
/// Hors domaine sur une entrée que le port ne reproduit pas à l'identique.
pub fn plages(cuts: &Valeur) -> R<String> {
    if matches!(cuts, Valeur::Indefini | Valeur::Nul) { return Ok(String::new()); }
    let Some(e) = elements(cuts) else { return hd("plages : tableau attendu") };
    let mut t: Vec<f64> = vec![];
    let mut vus = vec![];
    for x in e {
        let Some(Valeur::Nombre(c)) = x else { return hd("plages : nombre attendu") };
        if c.is_nan() { return hd("plages : NaN"); }
        let k = ariane_js::cle_same_value_zero(c);
        if !vus.contains(&k) { vus.push(k); t.push(c); }
    }
    ariane_js::trier_nombres(&mut t);
    let mut out: Vec<[f64; 2]> = vec![];
    for c in t {
        match out.last_mut() { Some(d) if c == d[1] + 1.0 => d[1] = c, _ => out.push([c, c]) }
    }
    Ok(out.iter().map(|[a, b]| {
        let (sa, sb) = (nombre_en_chaine(*a), nombre_en_chaine(*b));
        if a == b { sa } else if *b == a + 1.0 { format!("{sa}, {sb}") } else { format!("{sa}–{sb}") }
    }).collect::<Vec<_>>().join(", "))
}

#[cfg(test)]
#[allow(clippy::float_cmp)]
mod essais {
    use super::*;
    fn cand(src: &str, cut: f64, score: Option<f64>) -> Valeur {
        let mut c = vec![("part", Valeur::Nombre(13.0)), ("cut", Valeur::Nombre(cut)), ("source", ch(src))];
        if let Some(s) = score { c.push(("score", Valeur::Nombre(s))); }
        objet(c)
    }
    #[test]
    fn classes() {
        assert_eq!(classe(&cand("vert", 1.0, Some(2.5))), "vert-fort");
        assert_eq!(classe(&cand("vert", 1.0, None)), "vert-inconnu");
        assert_eq!(classe(&cand("differe", 1.0, None)), "D-points");
        assert_eq!(classe(&Valeur::Nul), "posee-ariane");
    }
    #[test]
    fn apprentissage_ordre_des_cles() {
        let o = |k: &str| objet(vec![("classe", ch(k)), ("coutS", Valeur::Nombre(10.0)), ("informatif", Valeur::Booleen(true))]);
        let r = apprendre_taux(&tableau(vec![o("b"), o("7"), o("b")])).unwrap();
        let Valeur::Objet(t) = &r else { panic!() };
        assert_eq!(t[0].0, "7");
        assert_eq!(opt(&r.champ("b").unwrap().clone(), "parMin"), &Valeur::Nombre(6.0));
    }
    #[test]
    fn file_et_plages() {
        let r = ordonner(&tableau(vec![cand("vert", 5.0, Some(3.0)), cand("differe", 4.0, None), cand("vert", 6.0, Some(0.0))]), &Valeur::Indefini, &[]).unwrap();
        assert_eq!(crate::js::longueur(opt(&r, "entrees")), Some(2));
        assert_eq!(crate::js::longueur(opt(&r, "ecartes")), Some(1));
        assert_eq!(plages(&Valeur::Nombres(vec![4215.0, 4213.0, 4214.0, 4220.0, 4222.0, 4223.0])).unwrap(), "4213–4215, 4220, 4222, 4223");
        assert!(plages(&ch("ab")).is_err());
    }
}
