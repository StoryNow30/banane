//! CH-068 (J4) : essais `cargo test` des modules portés. Chaque attendu est la sortie du JS du tronc (`JSON.stringify`),
//! relevée avec `node` sur la même entrée ; la parité complète est celle du banc (`tools/ch064-parite.cjs --module decision`).
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::indexing_slicing)]
use crate::js::{elems, Appel};
use ariane_vba::Valeur as V;

/// JSON minimal (objets, tableaux, nombres, chaînes sans échappement, true/false/null) → `Valeur`, clés dans l'ordre.
fn lire(t: &str) -> V {
    fn val(b: &[u8], i: &mut usize) -> V {
        while b[*i].is_ascii_whitespace() { *i += 1; }
        match b[*i] {
            b'{' => {
                *i += 1; let mut e = vec![];
                loop {
                    while b[*i].is_ascii_whitespace() || b[*i] == b',' { *i += 1; }
                    if b[*i] == b'}' { *i += 1; break; }
                    let V::Chaine(k) = val(b, i) else { panic!("clé") };
                    while b[*i] != b':' { *i += 1; }
                    *i += 1;
                    let v = val(b, i);
                    crate::js::definir(&mut e, &k, v);
                }
                V::Objet(e)
            }
            b'[' => {
                *i += 1; let mut t = vec![];
                loop {
                    while b[*i].is_ascii_whitespace() || b[*i] == b',' { *i += 1; }
                    if b[*i] == b']' { *i += 1; break; }
                    t.push(Some(val(b, i)));
                }
                V::Tableau(t)
            }
            b'"' => { *i += 1; let d = *i; while b[*i] != b'"' { *i += 1; } let c = String::from_utf8(b[d..*i].to_vec()).unwrap(); *i += 1; V::Chaine(c) }
            b't' => { *i += 4; V::Booleen(true) }
            b'f' => { *i += 5; V::Booleen(false) }
            b'n' => { *i += 4; V::Nul }
            _ => { let d = *i; while *i < b.len() && (b[*i].is_ascii_digit() || b"+-.eE".contains(&b[*i])) { *i += 1; } V::Nombre(std::str::from_utf8(&b[d..*i]).unwrap().parse().unwrap()) }
        }
    }
    let mut i = 0;
    val(t.as_bytes(), &mut i)
}
/// `JSON.stringify` (nombres par `ariane_js::nombre::nombre_en_chaine`, non finis : `null`).
fn ecrire(v: &V) -> String {
    match v {
        V::Indefini | V::Nul => "null".into(),
        V::Booleen(x) => x.to_string(),
        V::Nombre(x) => if x.is_finite() { ariane_js::nombre::nombre_en_chaine(*x) } else { "null".into() },
        V::Chaine(c) => format!("\"{c}\""),
        V::Objet(e) => format!("{{{}}}", e.iter().filter(|(_, x)| !matches!(x, V::Indefini)).map(|(k, x)| format!("\"{k}\":{}", ecrire(x))).collect::<Vec<_>>().join(",")),
        t => format!("[{}]", elems(t).unwrap().iter().map(|x| x.as_ref().map_or("null".into(), ecrire)).collect::<Vec<_>>().join(",")),
    }
}
fn appel(f: &str, args: &str) -> Appel {
    let V::Tableau(a) = lire(args) else { panic!() };
    Appel { f: f.into(), a: a.into_iter().map(|x| x.unwrap_or(V::Indefini)).collect() }
}
fn verifier(numero: u32, f: &str, args: &str, attendu: &str) {
    let a = appel(f, args);
    let entree = crate::js::o(vec![("f", crate::js::s(f)), ("a", V::Tableau(a.a.into_iter().map(Some).collect()))]);
    let r = crate::appeler(numero, &entree).unwrap_or_else(|e| panic!("{f} : {e:?}"));
    assert_eq!(ecrire(&r), attendu, "{f}");
}

#[test]
fn appuis_liste() {
    verifier(crate::APPUIS_LISTE, "mesurerT", r#"[{"left":[1,2,3],"right":[4,5,6.001]},{"left":[0.5,1,1],"right":[3.5,4,4]}]"#,
        r#"{"T":[0.5,1,2.0005],"rigideMm":1.000000000000334,"ok":true}"#);
    verifier(crate::APPUIS_LISTE, "lireReponse", r#"[{"ok":false,"reason":"pas bon"}]"#, r#"{"ok":false,"reason":"refus"}"#);
    verifier(crate::APPUIS_LISTE, "lireReponse", r#"[{"ok":false,"reason":"page-absente"}]"#, r#"{"ok":false,"reason":"page-absente"}"#);
    verifier(crate::APPUIS_LISTE, "lireReponse",
        r#"[{"ok":true,"table":{"lignes":3,"debut":true},"geo":{"index":2,"mm":1.25},"rows":[{"i":1,"s":"valid","e":[1,2,3,4,5,6]},{"i":9,"s":"valid"},{"i":1,"s":"invalid"},{"i":3,"s":"x","t":true}]},{"cut":2,"fenetre":1}]"#,
        r#"{"ok":true,"table":{"lignes":3,"pages":null,"fraiches":null,"debut":true,"rompue":false,"tronquee":false,"tables":null},"geo":{"index":2,"mm":1.25,"secondMm":null},"rows":[{"i":1,"statut":"valid","operateur":false,"vu":false,"fraiche":false,"bords":{"left":[1,2,3],"right":[4,5,6]}}]}"#);
    verifier(crate::APPUIS_LISTE, "compter", r#"[[{"i":1,"statut":"valid","bords":{}},{"i":2,"statut":"zzz"},{"i":3,"statut":"valid","operateur":true}],2]"#,
        r#"{"lignes":2,"valid":2,"invalid":0,"skipped":0,"autre":0,"operateur":1,"fraiches":0,"sansBords":1}"#);
}

#[test]
fn gcv2_l1e() {
    let mut ed = vec![];
    for i in 0..30 { ed.push(format!("0,0,0,0,{},0", 14350 + i)); }
    let st: Vec<&str> = (0..30).map(|i| if i == 4 { "1" } else { "0" }).collect();
    let fl: Vec<&str> = (0..30).map(|i| if i == 3 { "1" } else { "0" }).collect();
    let table = format!(r#"{{"n":30,"st":[{}],"fl":[{}],"ed":[{}]}}"#, st.join(","), fl.join(","), ed.join(","));
    verifier(crate::GCV2_L1E, "referenceEcartement", &format!("[{table},5]"), r#"{"mm":1436.15,"n":20,"distMax":16}"#);
    verifier(crate::GCV2_L1E, "decider", r#"[{"etat":"rien","motif":"plus-de-150-mm"},{"anomalie":true,"soutenue":true,"decal":{"left":[0,1,2],"right":[0,3,4]}}]"#,
        r#"{"etat":"valider","motif":"ecartement-corrige","decal":{"left":[0,1,2],"right":[0,3,4]},"corrigee":true}"#);
    verifier(crate::GCV2_L1E, "corriger",
        r#"[{"paire":{"left":{"decal":[0,10,0],"p":0.2},"right":{"decal":[0,-5,0],"p":0.7}},"g":1460,"hyps":{"left":[{"decal":[0,0,0],"g":1450,"depart":true},{"decal":[0,10,0],"g":1460}],"right":[]},"ref":1435}]"#,
        r#"{"anomalie":true,"ecartMm":-25,"rail":"left","decal":{"left":[0,-15,0],"right":[0,-5,0]},"soutenue":false}"#);
}

#[test]
fn voie_recentree() {
    verifier(crate::VOIE_RECENTREE, "juger", "[7.5]", r#""juste10""#);
    verifier(crate::VOIE_RECENTREE, "juger", "[51]", r#""mauvaise-voie""#);
    verifier(crate::VOIE_RECENTREE, "memoireSerie",
        r#"[{"identity":{"part":1,"cut":10},"differes":[8,10,12,30],"validees":[{"identity":{"part":1,"cut":8},"visitIndex":2,"positions":{"left":[0,0,0],"right":[0,1.4,0]}},{"identity":{"part":1,"cut":12},"visitIndex":5,"positions":{"left":[1,0,0],"right":[1,1.4,0]}}]}]"#,
        r#"{"etat":"ok","serie":{"id":8,"rang":1,"longueur":3},"memoire":{"cuts":[12,8],"n":2,"dispersionMm":6,"porteMm":10},"appuis":[{"identity":{"part":1,"cut":12,"frameId":null},"positions":{"left":[1,0,0],"right":[1,1.4,0]},"stage":"operateur"},{"identity":{"part":1,"cut":8,"frameId":null},"positions":{"left":[0,0,0],"right":[0,1.4,0]},"stage":"operateur"}]}"#);
}

#[test]
fn voie_b1_ecart() {
    verifier(crate::VOIE_B1_ECART, "lignesDeTable", r#"[{"n":5,"st":[0,1,2,3,7],"fl":[0,1,2,3,-1],"ed":[10000,0,0,20000,0,0,1,2,3,4,5,6]},1,1]"#,
        r#"[{"i":0,"statut":"valid","operateur":false,"vu":false,"fraiche":false,"bords":{"left":[1,0,0],"right":[2,0,0]}},{"i":1,"statut":"invalid","operateur":true,"vu":false,"fraiche":false,"bords":{"left":[0.0001,0.0002,0.0003],"right":[0.0004,0.0005,0.0006]}},{"i":2,"statut":"skipped","operateur":false,"vu":true,"fraiche":false,"bords":null}]"#);
}

#[test]
fn recherche_large() {
    verifier(crate::RECHERCHE_LARGE, "reglage", r#"[{"actif":true,"mode":"choisir","cellulesMax":1.5}]"#,
        r#"{"ok":false,"raison":"rechercheLarge.cellulesMax illisible","actif":false,"mode":"differer","porteeMm":400,"pasMm":120,"loinMm":50,"rapport":1.5,"presMm":15,"cellulesMax":12,"zones":null,"passe":true,"sansPaireLoin":true,"soutienTop":0,"soutienFace":0,"grainesMode":"grille"}"#);
    verifier(crate::RECHERCHE_LARGE, "graines", r#"[{"pasMm":120,"porteeMm":400}]"#, "[0,120,-120,240,-240,360,-360]");
    // (12345).toPrecision(4) : égalité exacte, le plus grand ; (0.12344999).toPrecision(4)
    verifier(crate::RECHERCHE_LARGE, "resumer", r#"[{"paireLot":{"left":{"lat":1,"vert":2},"right":{"lat":3,"vert":4},"prod":12345,"gaugeMm":1435.04},"meilleure":{"left":{"lat":1,"vert":2},"right":{"lat":3,"vert":4},"prod":0.12344999}}]"#,
        r#"{"paireLot":{"left":[1,2],"right":[3,4],"gaugeMm":1435,"prod":12350,"top":[null,null],"face":[null,null]},"meilleure":{"left":[1,2],"right":[3,4],"gaugeMm":null,"prod":0.1234,"top":[null,null],"face":[null,null]},"concurrente":null,"rapportMeilleure":0.00001}"#);
}

#[test]
fn hors_domaine_sans_panique() {
    // entrées hostiles : jamais de panique, un refus récupérable (la façade rejoue le JS)
    for (num, f, a) in [(crate::APPUIS_LISTE, "mesurerT", "[{\"left\":[1,2,3],\"right\":[1,2,3]},{\"left\":[1,2,3],\"right\":[1,2,3]},null]"), (crate::GCV2_L1E, "signe", "[null,\"left\"]"),
        (crate::VOIE_RECENTREE, "localMm", "[null,[1,2,3]]"), (crate::VOIE_B1_ECART, "evaluer", "[{}]"), (crate::RECHERCHE_LARGE, "decider", "[null]")] {
        let ap = appel(f, a);
        let entree = crate::js::o(vec![("f", crate::js::s(f)), ("a", V::Tableau(ap.a.into_iter().map(Some).collect()))]);
        assert!(matches!(crate::appeler(num, &entree), Err(ariane_js::Echec::HorsDomaine(_))), "{f}");
    }
}
