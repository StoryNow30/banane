//! Lectures et écritures de [`Valeur`] calquées sur le JS (vérité, nombres, texte, tableaux).
use ariane_js::Echec;
use ariane_vba::Valeur;

pub const IND: Valeur = Valeur::Indefini;

pub fn num(x: f64) -> Valeur {
    Valeur::Nombre(x)
}
pub fn ch(s: &str) -> Valeur {
    Valeur::Chaine(s.to_owned())
}
pub fn nul() -> Valeur {
    Valeur::Nul
}

pub fn obj(paires: Vec<(&str, Valeur)>) -> Valeur {
    Valeur::Objet(paires.into_iter().map(|(k, v)| (k.to_owned(), v)).collect())
}

pub fn champ<'a>(v: &'a Valeur, k: &str) -> &'a Valeur {
    v.champ(k).unwrap_or(&IND)
}

pub fn nombre(v: &Valeur) -> Option<f64> {
    match v {
        Valeur::Nombre(x) => Some(*x),
        _ => None,
    }
}

pub fn est_tableau(v: &Valeur) -> bool {
    matches!(
        v,
        Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Bloc { .. }
    )
}

/// `Number.isFinite` : seulement un nombre fini (pas de coercition).
pub fn fini(v: &Valeur) -> Option<f64> {
    nombre(v).filter(|x| x.is_finite())
}

/// `Number.isInteger`.
pub fn entier(v: &Valeur) -> Option<f64> {
    nombre(v).filter(|x| x.is_finite() && x.fract() == 0.0)
}

/// `Math.round(v*k)/k` si `v` est fini, sinon `None` (le JS rend `null`).
pub fn nb(v: f64, k: f64) -> Option<f64> {
    if !v.is_finite() {
        return None;
    }
    Some(ariane_js::round(v * k) / k)
}

pub fn nb_v(v: &Valeur, k: f64) -> Option<f64> {
    fini(v).and_then(|x| nb(x, k))
}

pub fn ou_nul(x: Option<f64>) -> Valeur {
    x.map_or(Valeur::Nul, num)
}

/// Médiane de `src/deplacement-vue.js` (`med`) : tri `(x,y)=>x-y`, vide → null, paire → `(a+b)/2` (pas `midpoint`).
#[allow(clippy::manual_midpoint)] // (a+b)/2 du JS : `midpoint` évite le débordement et changerait les bits
pub fn med(a: &[f64]) -> Option<f64> {
    if a.is_empty() {
        return None;
    }
    let mut b = a.to_vec();
    ariane_js::trier_nombres(&mut b);
    let i = b.len() / 2;
    if b.len() % 2 == 1 {
        b.get(i).copied()
    } else {
        let (Some(x), Some(y)) = (i.checked_sub(1).and_then(|j| b.get(j)), b.get(i)) else {
            return None;
        };
        Some((*x + *y) / 2.0)
    }
}

/// `v.slice(0, n)` sur des unités UTF-16. Une coupe au milieu d'un caractère (substitut) est hors domaine :
/// la chaîne résultante ne passerait pas dans le VBA.
pub fn tranche(s: &str, n: usize) -> Result<String, Echec> {
    let mut unites = 0usize;
    for (i, c) in s.char_indices() {
        let u = c.len_utf16();
        let Some(apres) = unites.checked_add(u) else {
            return Err(Echec::hors_domaine("tranche"));
        };
        if apres > n {
            return Err(Echec::hors_domaine(
                "tranche au milieu d'une paire de substituts",
            ));
        }
        unites = apres;
        if unites == n {
            let fin = i
                .checked_add(c.len_utf8())
                .ok_or_else(|| Echec::hors_domaine("tranche"))?;
            return s
                .get(..fin)
                .map(str::to_owned)
                .ok_or_else(|| Echec::hors_domaine("tranche"));
        }
    }
    Ok(s.to_owned())
}

/// `txt` : chaîne coupée, sinon `null`.
pub fn txt(v: &Valeur, n: usize) -> Result<Valeur, Echec> {
    match v {
        Valeur::Chaine(s) => Ok(ch(&tranche(s, n)?)),
        _ => Ok(nul()),
    }
}

/// `a||b` au sens JS (vérité, pas coalescence).
pub fn ou<'a>(a: &'a Valeur, b: &'a Valeur) -> &'a Valeur {
    if a.vrai() {
        a
    } else {
        b
    }
}

pub fn opt_nombre(v: &Valeur) -> Result<Option<f64>, Echec> {
    match v {
        Valeur::Indefini | Valeur::Nul => Ok(None),
        Valeur::Nombre(x) => Ok(Some(*x)),
        _ => Err(Echec::hors_domaine("nombre ou vide attendu")),
    }
}

/// Élément d'une liste lue comme le ferait `t[i]` (trou et absent → manque, `null` → 0 en arithmétique).
#[derive(Clone, Copy)]
pub enum Elem {
    Manque,
    Nul,
    Nombre(f64),
}

impl Elem {
    fn de(v: &Valeur) -> Result<Self, Echec> {
        match v {
            Valeur::Indefini => Ok(Self::Manque),
            Valeur::Nul => Ok(Self::Nul),
            Valeur::Nombre(x) => Ok(Self::Nombre(*x)),
            _ => Err(Echec::hors_domaine("élément non numérique")),
        }
    }
    /// Coercition `ToNumber` réduite à ce que ces modules font sur un élément de matrice.
    pub fn f(self) -> f64 {
        match self {
            Self::Nombre(x) => x,
            Self::Nul => 0.0,
            Self::Manque => f64::NAN,
        }
    }
}

pub fn liste(v: &Valeur) -> Result<Vec<Elem>, Echec> {
    match v {
        Valeur::Nombres(t) => Ok(t.iter().copied().map(Elem::Nombre).collect()),
        Valeur::Tableau(t) => t
            .iter()
            .map(|e| match e {
                None => Ok(Elem::Manque),
                Some(x) => Elem::de(x),
            })
            .collect(),
        _ => Err(Echec::hors_domaine("liste de nombres attendue")),
    }
}

pub fn au(l: &[Elem], i: usize) -> Elem {
    l.get(i).copied().unwrap_or(Elem::Manque)
}

/// `JSON.stringify` d'un nombre (null si non fini, « 0 » pour −0), pour la clé d'immobilité du relevé.
pub fn json_nombre(x: f64) -> String {
    if !x.is_finite() {
        return "null".to_owned();
    }
    ariane_js::nombre::nombre_en_chaine(x)
}

pub fn json_liste(v: &Valeur) -> Result<String, Echec> {
    let l = liste(v)?;
    let mut s = String::from("[");
    for (i, e) in l.iter().enumerate() {
        if i > 0 {
            s.push(',');
        }
        match e {
            Elem::Nombre(x) => s.push_str(&json_nombre(*x)),
            Elem::Nul | Elem::Manque => s.push_str("null"),
        }
    }
    s.push(']');
    Ok(s)
}
