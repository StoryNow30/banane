//! VBA : valeurs binaires Ariane, version 1 (spécification : chantiers/CH-064/vba.md).
//! Codec sans perte entre la coquille JS et le cœur WASM. Encodage canonique : `encoder(decoder(t)) == t`.

/// En-tête de toute trame : « VBA » puis la version du format (1).
pub const ENTETE: [u8; 4] = [0x56, 0x42, 0x41, 0x01];
const PROFONDEUR_MAX: usize = 512;

/// Une valeur JS, telle que la transporte une trame (une variante par étiquette de la spécification).
#[derive(Debug, Clone, PartialEq)]
pub enum Valeur {
    /// `undefined` (étiquette 00).
    Indefini,
    /// `null` (01).
    Nul,
    /// `false` / `true` (02, 03).
    Booleen(bool),
    /// Un nombre, bits compris (04).
    Nombre(f64),
    /// Une chaîne bien formée (05).
    Chaine(String),
    /// Un tableau quelconque (06) ; un élément `None` est un trou (07).
    Tableau(Vec<Option<Valeur>>),
    /// Un objet simple, clés dans l'ordre (08).
    Objet(Vec<(String, Valeur)>),
    /// Un tableau de n tableaux de k nombres (09), rangé à plat (n×k valeurs).
    Bloc {
        /// Longueur de chaque ligne (1 à 255).
        k: u8,
        /// Les n×k nombres, ligne après ligne.
        donnees: Vec<f64>,
    },
    /// Un tableau de nombres (0A).
    Nombres(Vec<f64>),
    /// Un tableau de booléens (0B).
    Booleens(Vec<bool>),
    /// Une exception à relever côté JS (0C), en sortie seulement.
    Erreur {
        /// Constructeur : `Error`, `TypeError`, `RangeError` ou `HorsDomaine`.
        nom: String,
        /// Message, à l'identique de celui du JS.
        message: String,
    },
}

/// Trame refusée au décodage (message préfixé par « VBA : »).
#[derive(Debug, PartialEq)]
pub struct ErreurVba(pub String);

fn err<T>(m: &str) -> Result<T, ErreurVba> { Err(ErreurVba(format!("VBA : {m}"))) }

struct Lecteur<'a> { o: &'a [u8], p: usize }
impl<'a> Lecteur<'a> {
    fn octet(&mut self) -> Result<u8, ErreurVba> {
        let b = *self.o.get(self.p).ok_or_else(|| ErreurVba("VBA : trame tronquée".into()))?;
        self.p += 1;
        Ok(b)
    }
    fn tranche(&mut self, n: usize) -> Result<&'a [u8], ErreurVba> {
        let fin = self.p.checked_add(n).ok_or_else(|| ErreurVba("VBA : longueur invalide".into()))?;
        if fin > self.o.len() { return err("trame tronquée"); }
        let t = &self.o[self.p..fin];
        self.p = fin;
        Ok(t)
    }
    fn u32(&mut self) -> Result<usize, ErreurVba> {
        let t = self.tranche(4)?;
        Ok(u32::from_le_bytes([t[0], t[1], t[2], t[3]]) as usize)
    }
    fn f64(&mut self) -> Result<f64, ErreurVba> {
        let t = self.tranche(8)?;
        let mut b = [0u8; 8];
        b.copy_from_slice(t);
        Ok(f64::from_le_bytes(b))
    }
    fn chaine(&mut self) -> Result<String, ErreurVba> {
        let n = self.u32()?;
        let t = self.tranche(n)?;
        match core::str::from_utf8(t) { Ok(s) => Ok(s.to_owned()), Err(_) => err("chaîne UTF-8 invalide") }
    }
    fn bourrage(&mut self) -> Result<(), ErreurVba> {
        while !self.p.is_multiple_of(8) {
            if self.octet()? != 0 { return err("bourrage non nul"); }
        }
        Ok(())
    }
    fn nombres(&mut self, n: usize) -> Result<Vec<f64>, ErreurVba> {
        let t = self.tranche(n.checked_mul(8).ok_or_else(|| ErreurVba("VBA : longueur invalide".into()))?)?;
        Ok(t.chunks_exact(8).map(|c| f64::from_le_bytes([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]])).collect())
    }
    fn valeur(&mut self, prof: usize, dans_tableau: bool) -> Result<Option<Valeur>, ErreurVba> {
        if prof > PROFONDEUR_MAX { return err("profondeur excessive"); }
        Ok(Some(match self.octet()? {
            0x00 => Valeur::Indefini,
            0x01 => Valeur::Nul,
            0x02 => Valeur::Booleen(false),
            0x03 => Valeur::Booleen(true),
            0x04 => Valeur::Nombre(self.f64()?),
            0x05 => Valeur::Chaine(self.chaine()?),
            0x06 => {
                let n = self.u32()?;
                let mut v = Vec::with_capacity(n.min(1 << 16));
                for _ in 0..n { v.push(self.valeur(prof + 1, true)?); }
                Valeur::Tableau(v)
            }
            0x07 if dans_tableau => return Ok(None),
            0x08 => {
                let n = self.u32()?;
                let mut v = Vec::with_capacity(n.min(1 << 16));
                for _ in 0..n {
                    let k = self.chaine()?;
                    let x = self.valeur(prof + 1, false)?.expect("hors tableau, jamais un trou");
                    v.push((k, x));
                }
                Valeur::Objet(v)
            }
            0x09 => {
                let n = self.u32()?;
                let k = self.octet()?;
                if k == 0 || n == 0 { return err("bloc vide"); }
                self.bourrage()?;
                Valeur::Bloc { k, donnees: self.nombres(n * k as usize)? }
            }
            0x0A => {
                let n = self.u32()?;
                if n == 0 { return err("tableau de nombres vide"); }
                self.bourrage()?;
                Valeur::Nombres(self.nombres(n)?)
            }
            0x0B => {
                let n = self.u32()?;
                if n == 0 { return err("tableau de booléens vide"); }
                let t = self.tranche(n)?;
                let mut v = Vec::with_capacity(n);
                for &b in t { v.push(match b { 0 => false, 1 => true, _ => return err("booléen invalide") }); }
                Valeur::Booleens(v)
            }
            0x0C => { let nom = self.chaine()?; let message = self.chaine()?; Valeur::Erreur { nom, message } }
            e => return err(&format!("étiquette inconnue {e:#04x}")),
        }))
    }
}

/// Décode une trame complète.
///
/// # Errors
/// En-tête absent, trame tronquée, étiquette inconnue, bourrage non nul, chaîne invalide, trou hors tableau,
/// profondeur excessive, octets après la racine.
pub fn decoder(o: &[u8]) -> Result<Valeur, ErreurVba> {
    if o.len() < 4 || o[..4] != ENTETE { return err("en-tête absent"); }
    let mut l = Lecteur { o, p: 4 };
    let Some(v) = l.valeur(0, false)? else { return err("trou hors tableau") };
    if l.p != o.len() { return err("octets après la racine"); }
    Ok(v)
}

/// Encodeur canonique (une valeur n'a qu'une trame).
pub struct Ecrivain {
    /// La trame en cours, en-tête compris.
    pub o: Vec<u8>,
}
impl Default for Ecrivain { fn default() -> Self { Self::new() } }
impl Ecrivain {
    /// Trame vide (en-tête seul).
    #[must_use]
    pub fn new() -> Self { Ecrivain { o: ENTETE.to_vec() } }
    fn u32(&mut self, n: usize) {
        let n = u32::try_from(n).expect("VBA : longueur de plus de 4 Gio, refusée par la spécification");
        self.o.extend_from_slice(&n.to_le_bytes());
    }
    fn chaine(&mut self, s: &str) { self.u32(s.len()); self.o.extend_from_slice(s.as_bytes()); }
    fn bourrage(&mut self) { while !self.o.len().is_multiple_of(8) { self.o.push(0); } }
    /// Ajoute une valeur à la trame.
    ///
    /// # Panics
    /// Si une longueur dépasse 4 Gio (la spécification la refuse ; impossible en WASM 32 bits).
    pub fn valeur(&mut self, v: &Valeur) {
        match v {
            Valeur::Indefini => self.o.push(0x00),
            Valeur::Nul => self.o.push(0x01),
            Valeur::Booleen(b) => self.o.push(if *b { 0x03 } else { 0x02 }),
            Valeur::Nombre(x) => { self.o.push(0x04); self.o.extend_from_slice(&x.to_le_bytes()); }
            Valeur::Chaine(s) => { self.o.push(0x05); self.chaine(s); }
            Valeur::Tableau(t) => {
                self.o.push(0x06);
                self.u32(t.len());
                for e in t { match e { None => self.o.push(0x07), Some(x) => self.valeur(x) } }
            }
            Valeur::Objet(t) => {
                self.o.push(0x08);
                self.u32(t.len());
                for (k, x) in t { self.chaine(k); self.valeur(x); }
            }
            Valeur::Bloc { k, donnees } => {
                self.o.push(0x09);
                self.u32(donnees.len() / *k as usize);
                self.o.push(*k);
                self.bourrage();
                for x in donnees { self.o.extend_from_slice(&x.to_le_bytes()); }
            }
            Valeur::Nombres(t) => {
                self.o.push(0x0A);
                self.u32(t.len());
                self.bourrage();
                for x in t { self.o.extend_from_slice(&x.to_le_bytes()); }
            }
            Valeur::Booleens(t) => {
                self.o.push(0x0B);
                self.u32(t.len());
                for &b in t { self.o.push(u8::from(b)); }
            }
            Valeur::Erreur { nom, message } => { self.o.push(0x0C); self.chaine(nom); self.chaine(message); }
        }
    }
}

/// Trame canonique d'une valeur.
///
/// # Panics
/// Si une longueur dépasse 4 Gio (voir [`Ecrivain::valeur`]).
#[must_use]
pub fn encoder(v: &Valeur) -> Vec<u8> { let mut e = Ecrivain::new(); e.valeur(v); e.o }

impl Valeur {
    /// Champ d'un objet, par clé.
    #[must_use]
    pub fn champ(&self, cle: &str) -> Option<&Valeur> {
        match self { Valeur::Objet(t) => t.iter().find(|(k, _)| k == cle).map(|(_, v)| v), _ => None }
    }
}

impl Valeur {
    /// Éléments d'un tableau, quelle que soit sa forme d'encodage (un trou devient `Indefini`) ; None si ce n'est pas un tableau.
    #[must_use]
    pub fn elements(&self) -> Option<Vec<Valeur>> {
        Some(match self {
            Valeur::Tableau(t) => t.iter().map(|e| e.clone().unwrap_or(Valeur::Indefini)).collect(),
            Valeur::Nombres(t) => t.iter().map(|&x| Valeur::Nombre(x)).collect(),
            Valeur::Booleens(t) => t.iter().map(|&b| Valeur::Booleen(b)).collect(),
            Valeur::Bloc { k, donnees } => donnees.chunks_exact(*k as usize).map(|c| Valeur::Nombres(c.to_vec())).collect(),
            _ => return None,
        })
    }
}

impl Valeur {
    /// Vérité au sens de JS (`if (v)`).
    #[must_use]
    pub fn vrai(&self) -> bool {
        match self {
            Valeur::Indefini | Valeur::Nul => false,
            Valeur::Booleen(b) => *b,
            Valeur::Nombre(x) => !(x.is_nan() || *x == 0.0),
            Valeur::Chaine(s) => !s.is_empty(),
            _ => true,
        }
    }
}

#[cfg(test)]
#[allow(clippy::float_cmp)] // essais d'identité au bit près : la comparaison exacte est le but
mod essais {
    use super::*;
    fn aller_retour(v: &Valeur) {
        let t = encoder(v);
        let w = decoder(&t).unwrap();
        assert_eq!(encoder(&w), t);
    }
    #[test]
    fn toutes_les_etiquettes() {
        aller_retour(&Valeur::Objet(vec![
            ("a".into(), Valeur::Indefini), ("b".into(), Valeur::Nul), ("c".into(), Valeur::Booleen(true)),
            ("d".into(), Valeur::Nombre(-0.0)), ("e".into(), Valeur::Chaine("é💥".into())),
            ("f".into(), Valeur::Tableau(vec![None, Some(Valeur::Nombre(f64::NAN)), Some(Valeur::Tableau(vec![]))])),
            ("g".into(), Valeur::Bloc { k: 3, donnees: vec![1.0, 2.0, 3.0, -0.0, f64::INFINITY, 6.0] }),
            ("h".into(), Valeur::Nombres(vec![0.1])), ("i".into(), Valeur::Booleens(vec![true, false])),
            ("j".into(), Valeur::Erreur { nom: "Error".into(), message: "Profil absent : left".into() }),
        ]));
    }
    #[test]
    fn moins_zero_conserve() {
        let t = encoder(&Valeur::Nombre(-0.0));
        match decoder(&t).unwrap() { Valeur::Nombre(x) => assert!(x == 0.0 && x.is_sign_negative()), _ => panic!() }
    }
    #[test]
    fn alignement_des_blocs() {
        let t = encoder(&Valeur::Tableau(vec![Some(Valeur::Chaine("x".into())), Some(Valeur::Nombres(vec![1.0]))]));
        // en-tête 4, 06, n 4, 05, l 4, 'x', 0A, n 4 → 19 octets, bourrage jusqu'à 24, puis 8 octets
        assert_eq!(t.len(), 32);
    }
    #[test]
    fn refus() {
        assert!(decoder(&[0x56, 0x42, 0x41, 0x02, 0x00]).is_err());
        assert!(decoder(&[0x56, 0x42, 0x41, 0x01, 0x07]).is_err()); // trou hors tableau
        assert!(decoder(&[0x56, 0x42, 0x41, 0x01, 0x00, 0x00]).is_err()); // octets en trop
        assert!(decoder(&[0x56, 0x42, 0x41, 0x01, 0x0B, 1, 0, 0, 0, 2]).is_err());
    }
}

#[cfg(test)]
mod essais_publics {
    use super::*;
    #[test]
    fn champ_elements_vrai() {
        let o = Valeur::Objet(vec![("a".into(), Valeur::Nombre(1.0))]);
        assert_eq!(o.champ("a"), Some(&Valeur::Nombre(1.0)));
        assert_eq!(o.champ("b"), None);
        assert_eq!(Valeur::Nul.champ("a"), None);
        let b = Valeur::Bloc { k: 2, donnees: vec![1.0, 2.0, 3.0, 4.0] };
        assert_eq!(b.elements(), Some(vec![Valeur::Nombres(vec![1.0, 2.0]), Valeur::Nombres(vec![3.0, 4.0])]));
        assert_eq!(Valeur::Tableau(vec![None]).elements(), Some(vec![Valeur::Indefini]));
        assert_eq!(Valeur::Nul.elements(), None);
        for (v, attendu) in [(Valeur::Indefini, false), (Valeur::Nombre(-0.0), false), (Valeur::Nombre(f64::NAN), false), (Valeur::Chaine(String::new()), false),
            (Valeur::Chaine("0".into()), true), (Valeur::Tableau(vec![]), true), (Valeur::Objet(vec![]), true), (Valeur::Booleen(true), true)] {
            assert_eq!(v.vrai(), attendu, "{v:?}");
        }
    }
    #[test]
    fn ecrivain_et_encoder_concordent() {
        let v = Valeur::Chaine("é".into());
        let mut e = Ecrivain::new();
        e.valeur(&v);
        assert_eq!(e.o, encoder(&v));
        assert_eq!(Ecrivain::default().o, ENTETE.to_vec());
    }
}
