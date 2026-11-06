//! `src/relecture-signal.js` : signal de fin de chargement d'ESV éteint pendant la relecture, à l'identique.
//! `observer` et `recharge` modifient leur état `e` : le port rend `{r, e}` (résultat, état après l'appel) et la façade
//! recopie dans l'objet d'origine les clés qui ont changé.
use crate::critere::vers_nombre;
use crate::js::*;
use ariane_vba::Valeur as V;

const NUMS: [(&str, f64); 6] = [("lectures", 8.0), ("delaiAvantMs", 500.0), ("sondageMs", 500.0), ("attenteRepriseMs", 90000.0), ("silenceListeMs", 2500.0), ("attenteSansListeMs", 10000.0)];

pub fn defaults() -> V {
    o(vec![("actif", b(false)), ("lectures", n(8.0)), ("rechargementsMax", n(1.0)), ("delaiAvantMs", n(500.0)), ("sondageMs", n(500.0)),
        ("attenteRepriseMs", n(90000.0)), ("silenceListeMs", n(2500.0)), ("attenteSansListeMs", n(10000.0))])
}

pub fn reglage(x: &V) -> R<V> {
    let mut r = vec![];
    etaler(&mut r, &defaults())?;
    if vrai(x) && est_objet(x) { etaler(&mut r, x)?; }
    let mut r = V::Objet(r);
    for (k, d) in NUMS { if !matches!(g(&r, k), V::Nombre(v) if v.is_finite() && *v >= 0.0) { definir_v(&mut r, k, n(d)); } }
    if !matches!(g(&r, "lectures"), V::Nombre(v) if v.is_finite() && v.trunc() == *v && *v > 0.0) { definir_v(&mut r, "lectures", n(8.0)); }
    if !(entier(g(&r, "rechargementsMax")) && num(g(&r, "rechargementsMax")).unwrap() >= 0.0) { definir_v(&mut r, "rechargementsMax", n(1.0)); }
    let actif = matches!(g(&r, "actif"), V::Booleen(true));
    definir_v(&mut r, "actif", b(actif));
    Ok(r)
}

pub fn lecture_de(capture: &V) -> &'static str {
    let rs = if nullish(capture) { &INDEF } else { g(capture, "readStrategy") };
    if !vrai(rs) || !matches!(g(rs, "lecture"), V::Chaine(c) if c == "rapide") || !est_tableau(g(rs, "attempts")) { return "neutre"; }
    let vues: Vec<V> = presents(g(rs, "attempts")).into_iter()
        .filter(|a| vrai(a) && matches!(g(a, "status"), V::Chaine(c) if c == "captured") && matches!(g(a, "attempt"), V::Nombre(x) if *x == 1.0) || vrai(a) && matches!(g(a, "status"), V::Chaine(c) if c == "captured") && matches!(g(a, "attempt"), V::Indefini))
        .collect();
    if vues.is_empty() { return "neutre"; }
    let regle = |a: &V, r: &str| matches!(g(a, "regle"), V::Chaine(c) if c == r);
    if vues.iter().any(|a| regle(a, "signal")) { return "signal"; }
    if vues.iter().all(|a| regle(a, "stabilite")) { "repli" } else { "neutre" }
}

pub fn creer(x: &V) -> R<V> { Ok(o(vec![("reglage", reglage(x)?), ("serie", n(0.0)), ("detections", n(0.0)), ("rechargements", n(0.0)), ("dernier", nul())])) }

fn etat(e: &V) -> R<V> { if est_simple(e) { Ok(e.clone()) } else { hd("état de signal non objet") } }

pub fn observer(e0: &V, capture: &V, opts: &V) -> R<V> {
    let mut e = etat(e0)?;
    if matches!(opts, V::Nul) { return hd("options null"); }
    let l = lecture_de(capture);
    definir_v(&mut e, "dernier", s(l));
    if l == "signal" { definir_v(&mut e, "serie", n(0.0)); }
    else if l == "repli" { let v = vers_nombre(g(&e, "serie"))?; definir_v(&mut e, "serie", n(v + 1.0)); }
    let serie = g(&e, "serie").clone();
    let rien = |e: V| Ok(o(vec![("r", o(vec![("lecture", s(l)), ("serie", serie.clone()), ("action", s("rien")), ("raison", nul())])), ("e", e)]));
    if l != "repli" { return rien(e); }
    let reg = p(&e, "reglage")?.clone();
    if nullish(&reg) { return hd("reglage absent"); }
    if !strict_egal(&serie, g(&reg, "lectures"))? { return rien(e); }
    let det = vers_nombre(g(&e, "detections"))?;
    definir_v(&mut e, "detections", n(det + 1.0));
    let peut = match g(opts, "peutRecharger") { V::Indefini => true, x => vrai(x) };
    let rech = g(&e, "rechargements").clone();
    let raison = if !vrai(g(&reg, "actif")) { Some("réglage coupé".to_string()) }
        else if !peut { Some("pause et reprise de la relecture éteintes".to_string()) }
        else if vers_nombre(&rech)? >= vers_nombre(g(&reg, "rechargementsMax"))? {
            Some(format!("{} rechargement{} déjà faits", chaine(&rech)?, if vers_nombre(&rech)? > 1.0 { "s" } else { "" }))
        } else { None };
    Ok(o(vec![("r", o(vec![("lecture", s(l)), ("serie", serie), ("action", s(if raison.is_some() { "signaler" } else { "recharger" })),
        ("raison", raison.map_or(nul(), |r| s(&r)))])), ("e", e)]))
}

pub fn recharge(e0: &V) -> R<V> {
    let mut e = etat(e0)?;
    let v = vers_nombre(g(&e, "rechargements"))?;
    definir_v(&mut e, "rechargements", n(v + 1.0));
    definir_v(&mut e, "serie", n(0.0));
    Ok(o(vec![("r", V::Indefini), ("e", e)]))
}

pub fn bilan(e: &V) -> R<V> {
    let e = p(e, "reglage").map(|_| e)?;
    let reg = g(e, "reglage");
    if nullish(reg) { return hd("reglage absent"); }
    Ok(o(vec![("serie", g(e, "serie").clone()), ("detections", g(e, "detections").clone()), ("rechargements", g(e, "rechargements").clone()),
        ("lectures", g(reg, "lectures").clone()), ("actif", g(reg, "actif").clone()), ("rechargementsMax", g(reg, "rechargementsMax").clone())]))
}

pub fn appeler(a: &Appel) -> R<V> {
    match a.f.as_str() {
        "reglage" => reglage(a.arg(0)),
        "lectureDe" => Ok(s(lecture_de(a.arg(0)))),
        "creer" => creer(a.arg(0)),
        "observer" => observer(a.arg(0), a.arg(1), a.arg(2)),
        "recharge" => recharge(a.arg(0)),
        "bilan" => bilan(a.arg(0)),
        _ => hd("relecture-signal : fonction non portée"),
    }
}
