//! Sémantique JS des objets et des valeurs, telle que la lisent les quatre modules : lecture de propriété, écriture
//! (ordre des clés de V8 : indices entiers d'abord, puis l'ordre d'insertion), copie par `JSON.parse(JSON.stringify(x))`,
//! `String(x)`, égalité stricte, vérité, conversion en nombre. Tout ce que ce module ne sait pas reproduire à
//! l'identique (exception du JS, coercition d'une chaîne, objet comparé par identité…) rend `Echec::HorsDomaine` :
//! la façade rejoue alors le JS d'origine, qui fait (ou lève) exactement ce qu'il ferait.
#![allow(clippy::float_cmp)] // `===` et `!==` du JS sur des nombres : comparaison exacte voulue
use ariane_js::nombre::nombre_en_chaine;
use ariane_js::Echec;
use ariane_vba::Valeur;

/// Résultat d'un calcul porté.
pub type R<T> = Result<T, Echec>;

/// `undefined`, rendu par référence pour une propriété absente.
pub static INDEFINI: Valeur = Valeur::Indefini;

/// Propriétés de `Object.prototype` : une clé dynamique qui en est une lirait la propriété héritée (une fonction).
const PROTO: [&str; 12] = [
    "constructor", "__defineGetter__", "__defineSetter__", "hasOwnProperty", "__lookupGetter__", "__lookupSetter__",
    "isPrototypeOf", "propertyIsEnumerable", "toString", "valueOf", "__proto__", "toLocaleString",
];

/// Raccourci : hors domaine, avec la raison.
pub fn hd<T>(raison: &str) -> R<T> { Err(Echec::hors_domaine(raison)) }

/// `v.k` pour une clé écrite dans le code (jamais héritée) : `undefined` si absente ou si `v` est une primitive ;
/// `null` et `undefined` lèveraient une `TypeError` : hors domaine.
pub fn lire<'a>(v: &'a Valeur, k: &str) -> R<&'a Valeur> {
    match v {
        Valeur::Indefini | Valeur::Nul => hd("lecture d'une propriété de null ou undefined"),
        _ => Ok(v.champ(k).unwrap_or(&INDEFINI)),
    }
}

/// `v?.k` : `undefined` sur `null` et `undefined`.
pub fn opt<'a>(v: &'a Valeur, k: &str) -> &'a Valeur { v.champ(k).unwrap_or(&INDEFINI) }

/// `v.at` : sur une chaîne ou un tableau, `at` est la méthode héritée (`Array.prototype.at`) : hors domaine.
pub fn lire_at(v: &Valeur) -> R<&Valeur> {
    if matches!(v, Valeur::Chaine(_)) || longueur(v).is_some() { return hd("v.at sur une chaîne ou un tableau"); }
    lire(v, "at")
}

/// `a ?? b`.
pub fn ou_nul(v: &Valeur) -> Valeur { if matches!(v, Valeur::Indefini | Valeur::Nul) { Valeur::Nul } else { v.clone() } }

/// Vrai si `v` est la chaîne `s`.
pub fn est(v: &Valeur, s: &str) -> bool { matches!(v, Valeur::Chaine(c) if c == s) }

/// Une chaîne, en valeur.
pub fn ch(s: &str) -> Valeur { Valeur::Chaine(s.into()) }

/// Un objet bâti dans l'ordre de ses clés littérales (aucune n'est un indice).
pub fn objet(champs: Vec<(&str, Valeur)>) -> Valeur { Valeur::Objet(champs.into_iter().map(|(k, v)| (k.to_string(), v)).collect()) }

/// Un tableau dense.
pub fn tableau(t: Vec<Valeur>) -> Valeur { Valeur::Tableau(t.into_iter().map(Some).collect()) }

/// La clé est-elle un indice de tableau (« 0 », « 17 », … ≤ 2³² − 2) ? V8 range ces clés d'abord, par valeur croissante.
fn indice(k: &str) -> Option<u64> {
    if k.is_empty() || k.len() > 10 || !k.bytes().all(|b| b.is_ascii_digit()) || (k.len() > 1 && k.starts_with('0')) { return None; }
    let n: u64 = k.parse().ok()?;
    (n < 4_294_967_295).then_some(n)
}

/// `o[k] = v` sur un objet simple : une clé présente garde sa place ; une clé neuve se range comme dans V8.
pub fn poser(o: &mut Valeur, k: &str, v: Valeur) -> R<()> {
    let Valeur::Objet(t) = o else { return hd("écriture d'une propriété hors d'un objet simple") };
    if let Some(e) = t.iter_mut().find(|(c, _)| c == k) { e.1 = v; return Ok(()); }
    if let Some(n) = indice(k) {
        let i = t.iter().position(|(c, _)| indice(c).is_none_or(|m| m > n)).unwrap_or(t.len());
        t.insert(i, (k.to_string(), v));
    } else {
        t.push((k.to_string(), v));
    }
    Ok(())
}

/// Le champ `k` de l'objet `o`, pour le modifier en place (objet simple exigé, champ présent).
pub fn sous<'a>(o: &'a mut Valeur, k: &str) -> R<&'a mut Valeur> {
    let Valeur::Objet(t) = o else { return hd("objet attendu") };
    match t.iter_mut().find(|(c, _)| c == k) { Some(e) => Ok(&mut e.1), None => hd("champ absent") }
}

/// Les éléments d'un tableau, trous compris (`None`) ; `None` si `v` n'est pas un tableau.
pub fn elements(v: &Valeur) -> Option<Vec<Option<Valeur>>> {
    Some(match v {
        Valeur::Tableau(t) => t.clone(),
        _ => v.elements()?.into_iter().map(Some).collect(),
    })
}

/// Longueur d'un tableau.
pub fn longueur(v: &Valeur) -> Option<usize> {
    match v {
        Valeur::Tableau(t) => Some(t.len()),
        Valeur::Nombres(t) => Some(t.len()),
        Valeur::Booleens(t) => Some(t.len()),
        Valeur::Bloc { k, donnees } => Some(if *k == 0 { 0 } else { donnees.len() / usize::from(*k) }),
        _ => None,
    }
}

/// `a.push(x)` : tableau exigé (les formes compactes de la VBA sont dépliées).
pub fn pousser(a: &mut Valeur, x: Valeur) -> R<()> {
    if !matches!(a, Valeur::Tableau(_)) {
        let Some(e) = elements(a) else { return hd("push hors d'un tableau") };
        *a = Valeur::Tableau(e);
    }
    if let Valeur::Tableau(t) = a { t.push(Some(x)); }
    Ok(())
}

/// `a[i]` pour un nombre `i` : l'élément si `i` est un indice présent, sinon `undefined` (trou compris).
pub fn a_l_indice(a: &Valeur, i: f64) -> Valeur {
    if !(i >= 0.0 && i.fract() == 0.0) { return Valeur::Indefini; }
    let Some(e) = elements(a) else { return Valeur::Indefini };
    // i entier positif fini : la conversion est exacte tant que i < 2^53 ; au-delà, l'indice est absent de toute façon
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let n = i as usize;
    e.get(n).cloned().flatten().unwrap_or(Valeur::Indefini)
}

/// Itération `for (const x of v)` : un tableau rend ses éléments (un trou donne `undefined`), une chaîne ses points de
/// code ; le reste lève une `TypeError` (hors domaine).
pub fn iterer(v: &Valeur) -> R<Vec<Valeur>> {
    if let Valeur::Chaine(s) = v { return Ok(s.chars().map(|c| Valeur::Chaine(c.to_string())).collect()); }
    match elements(v) {
        Some(e) => Ok(e.into_iter().map(|x| x.unwrap_or(Valeur::Indefini)).collect()),
        None => hd("valeur non itérable"),
    }
}

/// `JSON.parse(JSON.stringify(v))` : clés à `undefined` retirées, `undefined` et trous des tableaux en `null`, nombres
/// non finis en `null`, −0 en +0.
pub fn copie(v: &Valeur) -> R<Valeur> {
    fn dans(v: &Valeur) -> R<Option<Valeur>> {
        Ok(Some(match v {
            Valeur::Indefini => return Ok(None),
            Valeur::Nombre(x) => if x.is_finite() { Valeur::Nombre(if *x == 0.0 { 0.0 } else { *x }) } else { Valeur::Nul },
            Valeur::Objet(t) => {
                let mut o = Vec::with_capacity(t.len());
                for (k, x) in t { if let Some(y) = dans(x)? { o.push((k.clone(), y)); } }
                Valeur::Objet(o)
            }
            Valeur::Erreur { .. } => return hd("erreur dans une copie JSON"),
            Valeur::Nul | Valeur::Booleen(_) | Valeur::Chaine(_) => v.clone(),
            _ => {
                let mut o = vec![];
                for x in elements(v).unwrap_or_default() { o.push(Some(match x { Some(y) => dans(&y)?.unwrap_or(Valeur::Nul), None => Valeur::Nul })); }
                Valeur::Tableau(o)
            }
        }))
    }
    match dans(v)? { Some(x) => Ok(x), None => hd("JSON.parse(undefined)") }
}

/// `String(v)`.
pub fn en_chaine(v: &Valeur) -> R<String> {
    Ok(match v {
        Valeur::Indefini => "undefined".into(),
        Valeur::Nul => "null".into(),
        Valeur::Booleen(b) => if *b { "true".into() } else { "false".into() },
        Valeur::Nombre(x) => nombre_en_chaine(*x),
        Valeur::Chaine(s) => s.clone(),
        Valeur::Objet(t) => {
            if t.iter().any(|(k, _)| k == "toString" || k == "valueOf") { return hd("objet à toString propre"); }
            "[object Object]".into()
        }
        Valeur::Erreur { .. } => return hd("erreur"),
        _ => {
            let mut s = String::new();
            for (i, x) in elements(v).unwrap_or_default().into_iter().enumerate() {
                if i > 0 { s.push(','); }
                match x { None | Some(Valeur::Indefini | Valeur::Nul) => {}, Some(y) => s.push_str(&en_chaine(&y)?) }
            }
            s
        }
    })
}

/// Clé de propriété d'une valeur dynamique (`t[v]`) ; une clé héritée de `Object.prototype`, un objet ou un tableau
/// converti en clé : hors domaine.
pub fn cle(v: &Valeur) -> R<String> {
    let k = match v {
        Valeur::Objet(_) | Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Bloc { .. } | Valeur::Erreur { .. } => return hd("objet en clé"),
        _ => en_chaine(v)?,
    };
    if PROTO.contains(&k.as_str()) { return hd("clé héritée de Object.prototype"); }
    Ok(k)
}

/// `typeof v === 'string' && v ? v.slice(0, n) : null` (tranche en unités UTF-16 ; couper une paire de substitution
/// laisserait un surrogat isolé, que la VBA ne transporte pas : hors domaine).
pub fn texte(v: &Valeur, n: usize) -> R<Valeur> {
    let Valeur::Chaine(s) = v else { return Ok(Valeur::Nul) };
    if s.is_empty() { return Ok(Valeur::Nul); }
    let mut u = 0usize;
    for (i, c) in s.char_indices() {
        let l = c.len_utf16();
        if u + l > n {
            if u < n { return hd("tranche au milieu d'une paire de substitution"); }
            return Ok(Valeur::Chaine(s[..i].to_string()));
        }
        u += l;
    }
    Ok(Valeur::Chaine(s.clone()))
}

/// `Number.isInteger(v)`.
pub fn est_entier(v: &Valeur) -> bool { matches!(v, Valeur::Nombre(x) if x.is_finite() && x.fract() == 0.0) }

/// `Number.isFinite(v)`.
pub fn est_fini(v: &Valeur) -> bool { matches!(v, Valeur::Nombre(x) if x.is_finite()) }

/// `a === b`. Deux objets (ou tableaux) se comparent par identité, que la VBA ne transporte pas : hors domaine.
pub fn strict(a: &Valeur, b: &Valeur) -> R<bool> {
    Ok(match (a, b) {
        (Valeur::Nombre(x), Valeur::Nombre(y)) => x == y,
        (Valeur::Chaine(x), Valeur::Chaine(y)) => x == y,
        (Valeur::Booleen(x), Valeur::Booleen(y)) => x == y,
        (Valeur::Nul, Valeur::Nul) | (Valeur::Indefini, Valeur::Indefini) => true,
        (x, y) if objetal(x) && objetal(y) => return hd("comparaison de deux objets"),
        _ => false,
    })
}

/// Objet ou tableau (`typeof v === 'object' && v !== null`).
pub fn objetal(v: &Valeur) -> bool { !matches!(v, Valeur::Indefini | Valeur::Nul | Valeur::Booleen(_) | Valeur::Nombre(_) | Valeur::Chaine(_) | Valeur::Erreur { .. }) }

/// `ToNumber(v)` sans coercition de chaîne ni d'objet (hors domaine) : `null` → 0, `undefined` → NaN.
pub fn nombre(v: &Valeur) -> R<f64> {
    match v {
        Valeur::Nombre(x) => Ok(*x),
        Valeur::Nul => Ok(0.0),
        Valeur::Indefini => Ok(f64::NAN),
        Valeur::Booleen(b) => Ok(if *b { 1.0 } else { 0.0 }),
        _ => hd("coercition numérique d'une chaîne ou d'un objet"),
    }
}

/// `(x || 0) + 1` : une valeur vraie non numérique concaténerait : hors domaine.
pub fn plus_un_ou(v: &Valeur) -> R<f64> {
    if !v.vrai() { return Ok(1.0); }
    match v { Valeur::Nombre(x) => Ok(x + 1.0), _ => hd("(x || 0) + 1 sur une valeur non numérique") }
}

/// `x++` sur une propriété : nombre exigé (rend l'ancienne valeur et la nouvelle).
pub fn incrementer(v: &Valeur) -> R<(f64, f64)> {
    match v { Valeur::Nombre(x) => Ok((*x, x + 1.0)), _ => hd("++ sur une valeur non numérique") }
}

/// Le `i`-ème argument (`undefined` au-delà).
pub fn arg(e: &Valeur, i: usize) -> Valeur {
    e.champ("a").and_then(elements).and_then(|t| t.into_iter().nth(i).flatten()).unwrap_or(Valeur::Indefini)
}

#[cfg(test)]
#[allow(clippy::float_cmp)]
mod essais {
    use super::*;
    #[test]
    fn ordre_des_cles_comme_v8() {
        let mut o = objet(vec![("b", Valeur::Nul)]);
        poser(&mut o, "10", Valeur::Nul).unwrap();
        poser(&mut o, "2", Valeur::Nul).unwrap();
        poser(&mut o, "a", Valeur::Nul).unwrap();
        poser(&mut o, "b", Valeur::Booleen(true)).unwrap();
        let Valeur::Objet(t) = o else { panic!() };
        assert_eq!(t.iter().map(|(k, _)| k.as_str()).collect::<Vec<_>>(), ["2", "10", "b", "a"]);
        assert_eq!(t[2].1, Valeur::Booleen(true));
    }
    #[test]
    fn copie_json() {
        let v = objet(vec![("a", Valeur::Indefini), ("b", Valeur::Nombre(-0.0)), ("c", Valeur::Tableau(vec![None, Some(Valeur::Indefini), Some(Valeur::Nombre(f64::NAN))]))]);
        let c = copie(&v).unwrap();
        assert_eq!(c, objet(vec![("b", Valeur::Nombre(0.0)), ("c", tableau(vec![Valeur::Nul, Valeur::Nul, Valeur::Nul]))]));
        assert!(!matches!(c.champ("b"), Some(Valeur::Nombre(x)) if x.is_sign_negative()));
        assert!(copie(&Valeur::Indefini).is_err());
    }
    #[test]
    fn chaines_et_cles() {
        assert_eq!(en_chaine(&tableau(vec![Valeur::Nombre(1.0), Valeur::Nul, tableau(vec![ch("a"), ch("b")])])).unwrap(), "1,,a,b");
        assert_eq!(en_chaine(&objet(vec![])).unwrap(), "[object Object]");
        assert!(cle(&ch("toString")).is_err());
        assert_eq!(cle(&Valeur::Nombre(-0.0)).unwrap(), "0");
        assert_eq!(texte(&ch("abcdef"), 3).unwrap(), ch("abc"));
        assert!(texte(&ch("a😀"), 2).is_err());
        assert_eq!(texte(&ch(""), 3).unwrap(), Valeur::Nul);
    }
    #[test]
    fn egalite_et_nombres() {
        assert!(strict(&Valeur::Nombre(0.0), &Valeur::Nombre(-0.0)).unwrap());
        assert!(!strict(&Valeur::Nombre(f64::NAN), &Valeur::Nombre(f64::NAN)).unwrap());
        assert!(strict(&objet(vec![]), &objet(vec![])).is_err());
        assert!(!strict(&objet(vec![]), &Valeur::Nul).unwrap());
        assert_eq!(nombre(&Valeur::Nul).unwrap(), 0.0);
        assert!(nombre(&ch("1")).is_err());
        assert_eq!(plus_un_ou(&Valeur::Nombre(f64::NAN)).unwrap(), 1.0);
        assert_eq!(a_l_indice(&Valeur::Nombres(vec![4.0, 5.0]), -0.0), Valeur::Nombre(4.0));
        assert_eq!(iterer(&ch("ab")).unwrap(), vec![ch("a"), ch("b")]);
        assert!(lire(&Valeur::Nul, "x").is_err());
    }
}
