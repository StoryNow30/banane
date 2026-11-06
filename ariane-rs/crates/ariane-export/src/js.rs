//! Sémantique JS des objets, propre aux modules d'export : `JSON.stringify`, clone `JSON.parse(JSON.stringify(x))`,
//! ordre des clés d'un objet (indices d'abord, croissants, puis ordre d'insertion), longueurs UTF-16, `===`.
//! Les nombres en texte passent par `ariane_js::nombre::nombre_en_chaine` (seule implémentation de l'espace).
use ariane_js::nombre::nombre_en_chaine;
use ariane_js::Echec;
use ariane_vba::Valeur;

/// `undefined`, pour rendre une référence quand une propriété manque.
pub static INDEFINI: Valeur = Valeur::Indefini;

/// Propriété `k` d'un objet simple ; `undefined` pour une clé absente ou une valeur qui n'est pas un objet simple.
/// (Les tableaux et les primitives n'ont aucune des propriétés lues par ces modules, `length` mis à part, jamais lu ici.)
#[must_use]
pub fn prop<'a>(v: &'a Valeur, k: &str) -> &'a Valeur { v.champ(k).unwrap_or(&INDEFINI) }

/// `v?.k` : `undefined` sur `null` et `undefined`, sinon la propriété.
#[must_use]
pub fn prop_opt<'a>(v: &'a Valeur, k: &str) -> &'a Valeur { prop(v, k) }

/// `v.k` en JS : lève `TypeError` sur `null` et `undefined` ; ici le message de V8 n'est pas reproduit : hors domaine.
///
/// # Errors
/// `HorsDomaine` si `v` vaut `null` ou `undefined`.
pub fn prop_stricte<'a>(v: &'a Valeur, k: &str) -> Result<&'a Valeur, Echec> {
    if est_nul(v) { return Err(Echec::hors_domaine(format!("lecture de {k} sur null ou undefined"))); }
    Ok(prop(v, k))
}

/// `v == null`.
#[must_use]
pub fn est_nul(v: &Valeur) -> bool { matches!(v, Valeur::Indefini | Valeur::Nul) }

/// `typeof v === 'object' && v !== null` (tableaux compris).
#[must_use]
pub fn est_objet(v: &Valeur) -> bool {
    matches!(v, Valeur::Objet(_) | Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Bloc { .. } | Valeur::Booleens(_))
}

/// `Array.isArray(v)`.
#[must_use]
pub fn est_tableau(v: &Valeur) -> bool { matches!(v, Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Bloc { .. } | Valeur::Booleens(_)) }

/// Longueur d'un tableau (0 si ce n'en est pas un).
#[must_use]
pub fn longueur(v: &Valeur) -> usize {
    match v {
        Valeur::Tableau(t) => t.len(),
        Valeur::Nombres(t) => t.len(),
        Valeur::Booleens(t) => t.len(),
        Valeur::Bloc { k, donnees } => donnees.len() / usize::from(*k).max(1),
        _ => 0,
    }
}

/// Éléments d'un tableau (trou = `undefined`), ou `None`.
#[must_use]
pub fn elements(v: &Valeur) -> Option<Vec<Valeur>> { v.elements() }

/// `typeof v === 'string'` : la chaîne.
#[must_use]
pub fn chaine(v: &Valeur) -> Option<&str> { if let Valeur::Chaine(s) = v { Some(s) } else { None } }

/// `typeof v === 'number'` : le nombre.
#[must_use]
pub fn nombre(v: &Valeur) -> Option<f64> { if let Valeur::Nombre(x) = v { Some(*x) } else { None } }

/// Longueur JS d'une chaîne (unités UTF-16).
#[must_use]
pub fn longueur_utf16(s: &str) -> usize { s.chars().map(char::len_utf16).sum() }

/// `a === b` pour des primitives ; deux objets ne sont jamais égaux ici (identité inconnue en Rust) : hors domaine.
///
/// # Errors
/// `HorsDomaine` si les deux valeurs sont des objets (l'identité JS n'est pas portée).
pub fn strict_egal(a: &Valeur, b: &Valeur) -> Result<bool, Echec> {
    Ok(match (a, b) {
        (Valeur::Indefini, Valeur::Indefini) | (Valeur::Nul, Valeur::Nul) => true,
        (Valeur::Booleen(x), Valeur::Booleen(y)) => x == y,
        #[allow(clippy::float_cmp)] // `===` de JS : comparaison IEEE exacte (NaN ≠ NaN, −0 = +0)
        (Valeur::Nombre(x), Valeur::Nombre(y)) => x == y,
        (Valeur::Chaine(x), Valeur::Chaine(y)) => x == y,
        (x, y) if est_objet(x) && est_objet(y) => return Err(Echec::hors_domaine("=== entre deux objets")),
        _ => false,
    })
}

/// Clé d'indice de tableau (« 0 », « 17 »… jusqu'à 2³² − 2) : ces clés passent avant les autres dans un objet JS.
#[must_use]
pub fn indice_de_cle(k: &str) -> Option<u32> {
    let b = k.as_bytes();
    if b.is_empty() || b.len() > 10 || !b.iter().all(u8::is_ascii_digit) || (b.len() > 1 && b[0] == b'0') { return None; }
    let n: u64 = k.parse().ok()?;
    if n < 4_294_967_295 { u32::try_from(n).ok() } else { None }
}

/// `o[k] = v` sur un objet simple : remplace en place si la clé existe, sinon l'insère à sa place JS (indices croissants
/// d'abord, puis ordre d'insertion).
pub fn poser(o: &mut Vec<(String, Valeur)>, k: &str, v: Valeur) {
    if let Some(e) = o.iter_mut().find(|(c, _)| c == k) { e.1 = v; return; }
    if let Some(i) = indice_de_cle(k) {
        let pos = o.iter().position(|(c, _)| indice_de_cle(c).is_none_or(|j| j > i)).unwrap_or(o.len());
        o.insert(pos, (k.to_owned(), v));
    } else {
        o.push((k.to_owned(), v));
    }
}

/// `delete o[k]`.
pub fn retirer(o: &mut Vec<(String, Valeur)>, k: &str) { o.retain(|(c, _)| c != k); }

/// `'k' in o` (propriété propre ; les objets simples reçus n'ont pas d'autre prototype qu'`Object.prototype`, dont les
/// noms ne sont jamais demandés ici).
#[must_use]
pub fn possede(v: &Valeur, k: &str) -> bool { matches!(v, Valeur::Objet(t) if t.iter().any(|(c, _)| c == k)) }

/// Écrit une chaîne JSON (`QuoteJSONString`) : `"`, `\`, contrôles en `\b \t \n \f \r` ou `\u00xx`.
pub fn guillemets(s: &str, out: &mut String) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\t' => out.push_str("\\t"),
            '\n' => out.push_str("\\n"),
            '\u{c}' => out.push_str("\\f"),
            '\r' => out.push_str("\\r"),
            c if (c as u32) < 0x20 => {
                const HEX: &[u8; 16] = b"0123456789abcdef";
                let n = c as usize;
                out.push_str("\\u00");
                out.push(char::from(HEX[n >> 4]));
                out.push(char::from(HEX[n & 15]));
            }
            c => out.push(c),
        }
    }
    out.push('"');
}

fn nombre_json(x: f64, out: &mut String) {
    if x.is_finite() { out.push_str(&nombre_en_chaine(x)); } else { out.push_str("null"); }
}

/// Écrit `JSON.stringify(v)` dans `out` ; rend false si `v` ne s'écrit pas (undefined).
///
/// # Errors
/// `HorsDomaine` sur une valeur `Erreur` (jamais reçue de la coquille).
pub fn ecrire_json(v: &Valeur, out: &mut String) -> Result<bool, Echec> {
    match v {
        Valeur::Indefini => return Ok(false),
        Valeur::Nul => out.push_str("null"),
        Valeur::Booleen(b) => out.push_str(if *b { "true" } else { "false" }),
        Valeur::Nombre(x) => nombre_json(*x, out),
        Valeur::Chaine(s) => guillemets(s, out),
        Valeur::Tableau(t) => {
            out.push('[');
            for (i, e) in t.iter().enumerate() {
                if i > 0 { out.push(','); }
                match e { Some(x) => { if !ecrire_json(x, out)? { out.push_str("null"); } } None => out.push_str("null") }
            }
            out.push(']');
        }
        Valeur::Nombres(t) => {
            out.push('[');
            for (i, x) in t.iter().enumerate() { if i > 0 { out.push(','); } nombre_json(*x, out); }
            out.push(']');
        }
        Valeur::Booleens(t) => {
            out.push('[');
            for (i, b) in t.iter().enumerate() { if i > 0 { out.push(','); } out.push_str(if *b { "true" } else { "false" }); }
            out.push(']');
        }
        Valeur::Bloc { k, donnees } => {
            out.push('[');
            for (i, l) in donnees.chunks_exact(usize::from(*k).max(1)).enumerate() {
                if i > 0 { out.push(','); }
                out.push('[');
                for (j, x) in l.iter().enumerate() { if j > 0 { out.push(','); } nombre_json(*x, out); }
                out.push(']');
            }
            out.push(']');
        }
        Valeur::Objet(t) => {
            out.push('{');
            let mut premier = true;
            for (c, x) in t {
                if matches!(x, Valeur::Indefini) { continue; }
                if !premier { out.push(','); }
                premier = false;
                guillemets(c, out);
                out.push(':');
                ecrire_json(x, out)?;
            }
            out.push('}');
        }
        Valeur::Erreur { .. } => return Err(Echec::hors_domaine("Erreur dans une entrée")),
    }
    Ok(true)
}

/// `JSON.stringify(v)` ; `None` pour `undefined`.
///
/// # Errors
/// Voir [`ecrire_json`].
pub fn stringify(v: &Valeur) -> Result<Option<String>, Echec> {
    let mut s = String::new();
    Ok(if ecrire_json(v, &mut s)? { Some(s) } else { None })
}

/// `JSON.parse(JSON.stringify(v))` pour une valeur qui s'écrit (pas `undefined`) : clés `undefined` retirées, `undefined`
/// et trous des tableaux en `null`, nombres non finis en `null`, −0 en +0 ; ordre des clés conservé (le texte le suit, et
/// la relecture remet les indices en tête, où ils sont déjà).
#[must_use]
pub fn cloner(v: &Valeur) -> Valeur {
    let n = |x: f64| if x.is_finite() { Valeur::Nombre(x + 0.0) } else { Valeur::Nul };
    match v {
        Valeur::Indefini | Valeur::Erreur { .. } => Valeur::Nul,
        Valeur::Nombre(x) => n(*x),
        Valeur::Tableau(t) => Valeur::Tableau(t.iter().map(|e| Some(e.as_ref().map_or(Valeur::Nul, cloner))).collect()),
        Valeur::Nombres(t) => {
            if t.iter().all(|x| x.is_finite()) { Valeur::Nombres(t.iter().map(|x| x + 0.0).collect()) } else { Valeur::Tableau(t.iter().map(|&x| Some(n(x))).collect()) }
        }
        Valeur::Bloc { k, donnees } => {
            if donnees.iter().all(|x| x.is_finite()) { Valeur::Bloc { k: *k, donnees: donnees.iter().map(|x| x + 0.0).collect() } } else {
                Valeur::Tableau(donnees.chunks_exact(usize::from(*k).max(1)).map(|l| Some(Valeur::Tableau(l.iter().map(|&x| Some(n(x))).collect()))).collect())
            }
        }
        Valeur::Objet(t) => Valeur::Objet(t.iter().filter(|(_, x)| !matches!(x, Valeur::Indefini)).map(|(c, x)| (c.clone(), cloner(x))).collect()),
        x => x.clone(),
    }
}

/// `x == null ? x : JSON.parse(JSON.stringify(x))` (le `clone` de gcv1-export).
#[must_use]
pub fn cloner_ou_nul(v: &Valeur) -> Valeur { if est_nul(v) { v.clone() } else { cloner(v) } }

/// `x === undefined ? undefined : JSON.parse(JSON.stringify(x))` (la `copie` de phase-pli).
#[must_use]
pub fn copie(v: &Valeur) -> Valeur { if matches!(v, Valeur::Indefini) { Valeur::Indefini } else { cloner(v) } }

/// Objet simple bâti en Rust (clés dans l'ordre donné ; l'appelant n'y met pas de clés d'indice).
#[must_use]
pub fn objet(c: Vec<(&str, Valeur)>) -> Valeur { Valeur::Objet(c.into_iter().map(|(k, v)| (k.to_owned(), v)).collect()) }

/// Une chaîne.
#[must_use]
pub fn ch(s: &str) -> Valeur { Valeur::Chaine(s.to_owned()) }

/// Tableau de valeurs.
#[must_use]
pub fn tab(v: Vec<Valeur>) -> Valeur { Valeur::Tableau(v.into_iter().map(Some).collect()) }

/// `String(x)` pour un entier positif (compteurs).
#[must_use]
pub fn entier_en_chaine(n: usize) -> String { n.to_string() }

/// `String(v)` pour une primitive (concaténation `'…' + v`) ; un objet est hors domaine (`toString` non porté).
///
/// # Errors
/// `HorsDomaine` pour un objet ou un tableau.
pub fn en_chaine(v: &Valeur) -> Result<String, Echec> {
    Ok(match v {
        Valeur::Indefini => "undefined".into(),
        Valeur::Nul => "null".into(),
        Valeur::Booleen(b) => if *b { "true".into() } else { "false".into() },
        Valeur::Nombre(x) => nombre_en_chaine(*x),
        Valeur::Chaine(s) => s.clone(),
        _ => return Err(Echec::hors_domaine("conversion d'un objet en texte")),
    })
}

/// `s.slice(debut, fin)` en unités UTF-16 (indices déjà bornés, positifs) ; `None` si la coupe tombe au milieu d'une
/// paire de substitution (le JS rendrait un surrogat isolé, que la trame ne transporte pas).
#[must_use]
pub fn tranche_utf16(s: &str, debut: usize, fin: usize) -> Option<String> {
    let mut out = String::new();
    let mut i = 0usize;
    for c in s.chars() {
        let l = c.len_utf16();
        let (a, b) = (i, i + l);
        i = b;
        if b <= debut || a >= fin { continue; }
        if a < debut || b > fin { return None; }
        out.push(c);
    }
    Some(out)
}

/// `x === y` sur deux nombres (IEEE exact : NaN ≠ NaN, −0 = +0), la comparaison des modules JS.
#[must_use]
#[allow(clippy::float_cmp)] // `===` de JS : comparaison exacte voulue
pub fn egal_f(x: f64, y: f64) -> bool { x == y }

/// `Number.isInteger(x)`.
#[must_use]
pub fn est_entier(x: f64) -> bool { x.is_finite() && egal_f(x.trunc(), x) }

/// `!!v` (vérité JS).
#[must_use]
pub fn vrai(v: &Valeur) -> bool { v.vrai() }

/// `a ?? b` : `a` s'il n'est ni `null` ni `undefined`.
#[must_use]
pub fn ou<'a>(a: &'a Valeur, b: &'a Valeur) -> &'a Valeur { if est_nul(a) { b } else { a } }

/// `a || b`.
#[must_use]
pub fn ou_vrai<'a>(a: &'a Valeur, b: &'a Valeur) -> &'a Valeur { if a.vrai() { a } else { b } }

/// Noms de `Object.prototype` : `o[nom] || …` sur un objet simple les trouverait (fonctions), `o[nom] = …` sur
/// `__proto__` changerait le prototype ; ces clés sont hors domaine là où le JS lit ou écrit une clé libre.
pub const NOMS_DU_PROTOTYPE: [&str; 12] = ["__proto__", "constructor", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "toLocaleString",
    "toString", "valueOf", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"];

/// Ordre du tri par défaut de JS (`[].sort()` sur des chaînes) : unités UTF-16.
#[must_use]
pub fn cmp_utf16(a: &str, b: &str) -> core::cmp::Ordering { a.encode_utf16().cmp(b.encode_utf16()) }

fn normal_json(v: &Valeur, dans_tableau: bool) -> &Valeur {
    static NUL: Valeur = Valeur::Nul;
    match v {
        Valeur::Indefini if dans_tableau => &NUL,
        Valeur::Nombre(x) if !x.is_finite() => &NUL,
        x => x,
    }
}

/// `JSON.stringify(canon(a)) === JSON.stringify(canon(b))` (phase-pli : `canon` trie les clés), sans écrire le texte :
/// deux valeurs s'écrivent pareil si elles ont la même forme JSON (nombres égaux, −0 = +0, non finis = null, undefined
/// retiré des objets et null dans les tableaux, mêmes clés quel que soit leur ordre).
#[must_use]
pub fn egal_json(a: &Valeur, b: &Valeur) -> bool { egal_json_ctx(a, b, false) }

fn egal_json_ctx(a: &Valeur, b: &Valeur, dans_tableau: bool) -> bool {
    let (a, b) = (normal_json(a, dans_tableau), normal_json(b, dans_tableau));
    match (a, b) {
        (Valeur::Indefini, Valeur::Indefini) | (Valeur::Nul, Valeur::Nul) => true,
        (Valeur::Booleen(x), Valeur::Booleen(y)) => x == y,
        #[allow(clippy::float_cmp)] // égalité de l'écriture JSON : même double, ou ±0
        (Valeur::Nombre(x), Valeur::Nombre(y)) => x == y,
        (Valeur::Chaine(x), Valeur::Chaine(y)) => x == y,
        (Valeur::Objet(x), Valeur::Objet(y)) => {
            let def = |t: &Vec<(String, Valeur)>| t.iter().filter(|(_, v)| !matches!(v, Valeur::Indefini)).count();
            def(x) == def(y) && x.iter().filter(|(_, v)| !matches!(v, Valeur::Indefini)).all(|(k, v)| {
                y.iter().find(|(c, _)| c == k).is_some_and(|(_, w)| !matches!(w, Valeur::Indefini) && egal_json_ctx(v, w, false))
            })
        }
        (Valeur::Nombres(x), Valeur::Nombres(y)) => {
            #[allow(clippy::float_cmp)] // idem
            let r = x.len() == y.len() && x.iter().zip(y).all(|(p, q)| if p.is_finite() && q.is_finite() { p == q } else { !p.is_finite() && !q.is_finite() });
            r
        }
        (x, y) if est_tableau(x) && est_tableau(y) => {
            if longueur(x) != longueur(y) { return false; }
            let (Some(p), Some(q)) = (x.elements(), y.elements()) else { return false };
            p.iter().zip(&q).all(|(u, v)| egal_json_ctx(u, v, true))
        }
        _ => false,
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn json_comme_v8() {
        let v = objet(vec![("a", Valeur::Nombre(-0.0)), ("b", Valeur::Indefini), ("c", Valeur::Tableau(vec![None, Some(Valeur::Indefini), Some(Valeur::Nombre(f64::NAN))])),
            ("d", ch("é\"\\\n\u{1}\u{1f}")), ("e", Valeur::Bloc { k: 2, donnees: vec![1.5, 2.0, 1e21, 1e-7] })]);
        assert_eq!(stringify(&v).unwrap().unwrap(), r#"{"a":0,"c":[null,null,null],"d":"é\"\\\n\u0001\u001f","e":[[1.5,2],[1e+21,1e-7]]}"#);
        assert_eq!(stringify(&Valeur::Indefini).unwrap(), None);
    }
    #[test]
    fn clone_json() {
        let v = objet(vec![("a", Valeur::Nombre(-0.0)), ("b", Valeur::Indefini), ("c", Valeur::Nombres(vec![f64::INFINITY]))]);
        let c = cloner(&v);
        assert_eq!(stringify(&c).unwrap(), stringify(&v).unwrap());
        match c.champ("a") { Some(Valeur::Nombre(x)) => assert!(!x.is_sign_negative()), _ => panic!() }
        assert_eq!(c.champ("b"), None);
        assert_eq!(c.champ("c"), Some(&Valeur::Tableau(vec![Some(Valeur::Nul)])));
    }
    #[test]
    fn ordre_des_cles() {
        let mut o = vec![];
        poser(&mut o, "b", Valeur::Nul);
        poser(&mut o, "10", Valeur::Nul);
        poser(&mut o, "2", Valeur::Nul);
        poser(&mut o, "a", Valeur::Nul);
        poser(&mut o, "b", Valeur::Booleen(true));
        poser(&mut o, "01", Valeur::Nul);
        let k: Vec<&str> = o.iter().map(|(c, _)| c.as_str()).collect();
        assert_eq!(k, ["2", "10", "b", "a", "01"]);
        retirer(&mut o, "b");
        assert_eq!(o.len(), 4);
        assert_eq!(indice_de_cle("4294967294"), Some(4_294_967_294));
        assert_eq!(indice_de_cle("4294967295"), None);
    }
    #[test]
    fn utilitaires() {
        assert_eq!(longueur_utf16("a💥é"), 4);
        assert!(strict_egal(&Valeur::Nombre(0.0), &Valeur::Nombre(-0.0)).unwrap());
        assert!(!strict_egal(&Valeur::Nombre(f64::NAN), &Valeur::Nombre(f64::NAN)).unwrap());
        assert!(strict_egal(&Valeur::Objet(vec![]), &Valeur::Objet(vec![])).is_err());
        assert!(prop_stricte(&Valeur::Nul, "x").is_err());
        assert!(est_tableau(&Valeur::Nombres(vec![])) && !est_tableau(&Valeur::Objet(vec![])));
        assert!(est_objet(&Valeur::Tableau(vec![])) && !est_objet(&Valeur::Nul));
        assert_eq!(longueur(&Valeur::Bloc { k: 3, donnees: vec![0.0; 6] }), 2);
        assert_eq!(ou(&Valeur::Nul, &Valeur::Booleen(true)), &Valeur::Booleen(true));
        assert_eq!(ou_vrai(&Valeur::Nombre(0.0), &Valeur::Nul), &Valeur::Nul);
        assert!(possede(&objet(vec![("x", Valeur::Indefini)]), "x"));
        assert_eq!(copie(&Valeur::Indefini), Valeur::Indefini);
        assert_eq!(cloner_ou_nul(&Valeur::Nul), Valeur::Nul);
        assert_eq!(entier_en_chaine(12), "12");
        assert_eq!(tab(vec![Valeur::Nul]), Valeur::Tableau(vec![Some(Valeur::Nul)]));
        assert!(vrai(&ch("x")) && chaine(&ch("x")) == Some("x") && nombre(&Valeur::Nombre(1.0)) == Some(1.0));
        assert_eq!(prop_opt(&Valeur::Nul, "x"), &Valeur::Indefini);
        assert_eq!(elements(&Valeur::Nul), None);
        assert_eq!(en_chaine(&Valeur::Nombre(1.5)).unwrap(), "1.5");
        assert_eq!(en_chaine(&Valeur::Indefini).unwrap(), "undefined");
        assert!(en_chaine(&Valeur::Objet(vec![])).is_err());
        assert_eq!(tranche_utf16("ab💥c", 0, 3), None);
        assert_eq!(tranche_utf16("ab💥c", 0, 4).as_deref(), Some("ab💥"));
        assert_eq!(tranche_utf16("abc", 0, 20).as_deref(), Some("abc"));
        assert_eq!(cmp_utf16("\u{ffff}", "💥"), core::cmp::Ordering::Greater); // UTF-16 : 0xFFFF > 0xD83D
        assert!(NOMS_DU_PROTOTYPE.contains(&"constructor"));
        let a = objet(vec![("x", Valeur::Nombre(-0.0)), ("y", Valeur::Indefini), ("z", Valeur::Tableau(vec![None, Some(Valeur::Nombre(f64::NAN))]))]);
        let b = objet(vec![("z", Valeur::Tableau(vec![Some(Valeur::Indefini), Some(Valeur::Nul)])), ("x", Valeur::Nombre(0.0))]);
        assert!(egal_json(&a, &b));
        assert!(!egal_json(&a, &objet(vec![("x", Valeur::Nombre(0.0))])));
        assert!(egal_json(&Valeur::Nombres(vec![1.0, f64::NAN]), &Valeur::Tableau(vec![Some(Valeur::Nombre(1.0)), Some(Valeur::Nul)])));
        assert!(!egal_json(&ch("1"), &Valeur::Nombre(1.0)));
    }
}
