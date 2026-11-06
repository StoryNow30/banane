//! Essais Rust de ariane-decision : sorties attendues relevées sur le JS du tronc (Node 22), cas à la main.
//! La parité complète est le banc (`tools/ch064-parite.cjs --module decision`) ; ces essais tiennent les cas typiques.
use crate::js::*;
use crate::*;
use ariane_vba::Valeur as V;

fn champ_s<'a>(v: &'a V, k: &str) -> &'a str { chaine_de(g(v, k)).unwrap() }
fn jugement() -> V {
    o(vec![("poseCalculee", o(vec![])), ("ecartMm", o(vec![("left", o(vec![("lat", n(-10.04)), ("vert", n(2.0))])), ("right", o(vec![("lat", n(-9.0)), ("vert", n(1.2))]))])),
        ("etage", s("window")), ("appuis", tab_n(&[1.0, 2.0])), ("confiance", o(vec![("left", n(90.0)), ("right", n(88.0))]))])
}

#[test]
fn critere_seuil_et_confiance() {
    let r = critere::juger(&o(vec![("jugement", jugement()), ("zone", s("pn")), ("role", s("vert"))]), &V::Indefini).unwrap();
    assert_eq!(champ_s(&r, "raison"), "écart 10 mm sous le seuil de la zone pn (15 mm)");
    let r = critere::juger(&o(vec![("jugement", jugement()), ("zone", s("adv")), ("role", s("vert"))]), &V::Indefini).unwrap();
    assert_eq!(champ_s(&r, "regle"), "confiance");
    assert_eq!(champ_s(&r, "raison"), "confiance du rail gauche 90 sous 95");
}

#[test]
fn critere_reglages_invalides() {
    let r = critere::reglages(&o(vec![("format", s("ariane-relecture-reglages-1")), ("statut", s("x"))]), &s("propose")).unwrap();
    assert_eq!(joindre(g(&r, "invalides"), "|").unwrap(), "zones.pn|zones.adv|zones.abords|zones.vert-hors-zone|voie.lateralMaxMm|roles|jamais");
    let p = critere::correction_permise(&r).unwrap();
    assert_eq!(champ_s(&p, "raison"), "réglages invalides : zones.pn, zones.adv, zones.abords, zones.vert-hors-zone, voie.lateralMaxMm, roles");
}

#[test]
fn garde_apres_differe_r3() {
    let r = gardes::apres_differe::juger(&o(vec![("cut", n(10.0)), ("differesLot", tab_n(&[9.0, 8.0, 8.0, 3.0])), ("appuis", n(1.0))]), &V::Indefini).unwrap();
    assert_eq!(champ_s(&r, "motif"), "garde-apres-differe");
    assert_eq!(joindre(g(&r, "voisinsDifferes"), ",").unwrap(), "8,9");
}

#[test]
fn garde_passe_appuis_appui_normal() {
    let e = o(vec![("cut", n(10.0)), ("decal", o(vec![("left", tab_n(&[3.0, 4.0, 0.0])), ("right", tab_n(&[0.0, 0.0, 1.0]))])), ("cutsNormaux", tab_n(&[2.0, 13.0]))]);
    let r = gardes::passe_appuis::juger(&e, &V::Indefini, false).unwrap();
    assert_eq!(champ_s(&r, "motif"), "appui-normal");
    assert_eq!(num(g(&r, "deplacementMm")), Some(5.0));
    assert_eq!(num(g(&r, "appuiNormalCuts")), Some(3.0));
}

#[test]
fn signal_seuil_puis_recharger() {
    let mut e = signal::creer(&o(vec![("actif", b(true)), ("lectures", n(2.0))])).unwrap();
    let c = o(vec![("readStrategy", o(vec![("lecture", s("rapide")), ("attempts", tab(vec![o(vec![("status", s("captured")), ("attempt", n(1.0)), ("regle", s("stabilite"))])]))]))]);
    let r1 = signal::observer(&e, &c, &V::Indefini).unwrap();
    assert_eq!(champ_s(g(&r1, "r"), "action"), "rien");
    e = g(&r1, "e").clone();
    let r2 = signal::observer(&e, &c, &V::Indefini).unwrap();
    assert_eq!(champ_s(g(&r2, "r"), "action"), "recharger");
    assert_eq!(num(g(g(&r2, "e"), "detections")), Some(1.0));
}

#[test]
fn appel_par_numero() {
    let e = o(vec![("f", s("lectureDe")), ("a", tab(vec![V::Nul]))]);
    assert_eq!(appeler(SIGNAL, &e).unwrap(), s("neutre"));
    assert!(matches!(appeler(SIGNAL, &o(vec![("f", s("inconnue"))])), Err(ariane_js::Echec::HorsDomaine(_))));
}

#[test]
fn selection_grappe_differe_pn() {
    let lot = tab(vec![o(vec![("cut", n(10.0))]), o(vec![("cut", n(12.0))]), o(vec![("cut", n(14.0))]), o(vec![("cut", n(40.0)), ("differe", b(true))])]);
    let e = o(vec![("total", n(100.0)), ("lot", lot), ("zonesPN", tab(vec![tab_n(&[60.0, 62.0])]))]);
    let r = ombre::selection(&e, &V::Indefini).unwrap();
    let libs: Vec<String> = presents(g(&r, "plages")).iter().map(|p_| chaine_de(g(p_, "libelle")).unwrap().to_owned()).collect();
    assert_eq!(libs, ["grappe 7–17", "autour du différé 38–42", "PN 60–62"]);
    assert_eq!((num(g(&r, "total")), num(g(&r, "traverses")), num(g(&r, "tempsEstimeS"))), (Some(16.0), Some(3.0), Some(51.0)));
}

#[test]
fn duree_et_fit_at() {
    assert_eq!(ombre::duree(&n(140.0)), "2 min 20 s");
    assert_eq!(ombre::duree(&n(45.0)), "45 s");
    assert_eq!(aides::fit_at(&[[1.0, 2.0], [2.0, 4.0], [3.0, 6.5]]), -0.3333333333333333);
}

#[test]
fn regles_metier_activation() {
    let e = o(vec![("aurait", s("differer")), ("regles", tab_s(&["pn-chaque-cut"]))]);
    assert!(metier::doit_differer(&e, &o(vec![("actif", b(true)), ("regles", o(vec![("pn-chaque-cut", b(true))]))])).unwrap());
    assert!(!metier::doit_differer(&e, &o(vec![("actif", b(false)), ("regles", o(vec![("pn-chaque-cut", b(true))]))])).unwrap());
}
