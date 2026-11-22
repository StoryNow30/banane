//! `JSON.parse(texte)` (sans `reviver`) : grammaire stricte d'ECMA-404 ; une clé répétée garde sa première place et sa
//! dernière valeur ; `__proto__` est une clé propre comme les autres (la VBA le transporte). Toute erreur de syntaxe,
//! et un substitut isolé (`"\ud800"`, chaîne non transportable), est hors domaine : le message de V8 n'est pas reproduit.
//! Proposé par CH-070 (ariane-session, `js_extra::json`) ; `JSON.stringify` et `K.clone` : `js_extra::json` et `clone_json`.
use crate::Echec;

fn hd<T>(raison: &str) -> Result<T, Echec> { Err(Echec::hors_domaine(raison)) }
use ariane_vba::Valeur;

struct L<'a> { o: &'a [u8], p: usize, prof: usize }
impl L<'_> {
    fn blanc(&mut self) { while matches!(self.o.get(self.p), Some(b' ' | b'\t' | b'\n' | b'\r')) { self.p += 1; } }
    fn octet(&self) -> Option<u8> { self.o.get(self.p).copied() }
    fn mot(&mut self, m: &[u8], v: Valeur) -> Result<Valeur, Echec> {
        if self.o.get(self.p..self.p + m.len()) == Some(m) { self.p += m.len(); Ok(v) } else { hd("JSON.parse : syntaxe") }
    }
    fn hex4(&mut self) -> Result<u32, Echec> {
        let t = self.o.get(self.p..self.p + 4).ok_or_else(|| Echec::hors_domaine("JSON.parse : \\u"))?;
        let s = core::str::from_utf8(t).map_err(|_| Echec::hors_domaine("JSON.parse : \\u"))?;
        if !s.bytes().all(|c| c.is_ascii_hexdigit()) { return hd("JSON.parse : \\u"); }
        self.p += 4;
        u32::from_str_radix(s, 16).map_err(|_| Echec::hors_domaine("JSON.parse : \\u"))
    }
    fn chaine(&mut self) -> Result<String, Echec> {
        self.p += 1; // "
        let mut out = String::new();
        loop {
            let debut = self.p;
            while let Some(c) = self.octet() { if c == b'"' || c == b'\\' || c < 0x20 { break; } self.p += 1; }
            let morceau = core::str::from_utf8(self.o.get(debut..self.p).unwrap_or_default()).map_err(|_| Echec::hors_domaine("JSON.parse : UTF-8"))?;
            out.push_str(morceau);
            match self.octet() {
                Some(b'"') => { self.p += 1; return Ok(out); }
                Some(b'\\') => {
                    self.p += 1;
                    let e = self.octet().ok_or_else(|| Echec::hors_domaine("JSON.parse : échappement"))?;
                    self.p += 1;
                    match e {
                        b'"' => out.push('"'), b'\\' => out.push('\\'), b'/' => out.push('/'), b'b' => out.push('\u{8}'),
                        b'f' => out.push('\u{c}'), b'n' => out.push('\n'), b'r' => out.push('\r'), b't' => out.push('\t'),
                        b'u' => {
                            let u = self.hex4()?;
                            let c = if (0xD800..0xDC00).contains(&u) {
                                if self.o.get(self.p..self.p + 2) != Some(b"\\u") { return hd("JSON.parse : substitut isolé"); }
                                self.p += 2;
                                let v = self.hex4()?;
                                if !(0xDC00..0xE000).contains(&v) { return hd("JSON.parse : substitut isolé"); }
                                0x10000 + ((u - 0xD800) << 10) + (v - 0xDC00)
                            } else if (0xDC00..0xE000).contains(&u) { return hd("JSON.parse : substitut isolé"); } else { u };
                            out.push(char::from_u32(c).ok_or_else(|| Echec::hors_domaine("JSON.parse : point de code"))?);
                        }
                        _ => return hd("JSON.parse : échappement"),
                    }
                }
                _ => return hd("JSON.parse : chaîne"),
            }
        }
    }
    fn nombre(&mut self) -> Result<Valeur, Echec> {
        let debut = self.p;
        if self.octet() == Some(b'-') { self.p += 1; }
        match self.octet() {
            Some(b'0') => self.p += 1,
            Some(b'1'..=b'9') => { while self.octet().is_some_and(|c| c.is_ascii_digit()) { self.p += 1; } }
            _ => return hd("JSON.parse : nombre"),
        }
        if self.octet() == Some(b'.') {
            self.p += 1;
            if !self.octet().is_some_and(|c| c.is_ascii_digit()) { return hd("JSON.parse : nombre"); }
            while self.octet().is_some_and(|c| c.is_ascii_digit()) { self.p += 1; }
        }
        if matches!(self.octet(), Some(b'e' | b'E')) {
            self.p += 1;
            if matches!(self.octet(), Some(b'+' | b'-')) { self.p += 1; }
            if !self.octet().is_some_and(|c| c.is_ascii_digit()) { return hd("JSON.parse : nombre"); }
            while self.octet().is_some_and(|c| c.is_ascii_digit()) { self.p += 1; }
        }
        let t = core::str::from_utf8(self.o.get(debut..self.p).unwrap_or_default()).map_err(|_| Echec::hors_domaine("JSON.parse : nombre"))?;
        // `str::parse::<f64>` arrondit correctement, comme la lecture des littéraux de V8
        t.parse::<f64>().map(Valeur::Nombre).map_err(|_| Echec::hors_domaine("JSON.parse : nombre"))
    }
    fn valeur(&mut self) -> Result<Valeur, Echec> {
        self.prof += 1;
        // au-delà de 500 niveaux, la trame VBA de sortie serait refusée (512) : hors domaine, sans risque pour la pile
        if self.prof > 500 { return hd("JSON.parse : profondeur"); }
        self.blanc();
        let v = match self.octet() {
            Some(b'{') => {
                self.p += 1;
                let mut t: Vec<(String, Valeur)> = vec![];
                self.blanc();
                if self.octet() == Some(b'}') { self.p += 1; } else {
                    loop {
                        self.blanc();
                        if self.octet() != Some(b'"') { return hd("JSON.parse : clé"); }
                        let k = self.chaine()?;
                        self.blanc();
                        if self.octet() != Some(b':') { return hd("JSON.parse : deux-points"); }
                        self.p += 1;
                        let x = self.valeur()?;
                        if let Some(e) = t.iter_mut().find(|(c, _)| *c == k) { e.1 = x; } else { t.push((k, x)); }
                        self.blanc();
                        match self.octet() { Some(b',') => self.p += 1, Some(b'}') => { self.p += 1; break; } _ => return hd("JSON.parse : objet") }
                    }
                }
                Valeur::Objet(t)
            }
            Some(b'[') => {
                self.p += 1;
                let mut t = vec![];
                self.blanc();
                if self.octet() == Some(b']') { self.p += 1; } else {
                    loop {
                        t.push(Some(self.valeur()?));
                        self.blanc();
                        match self.octet() { Some(b',') => self.p += 1, Some(b']') => { self.p += 1; break; } _ => return hd("JSON.parse : tableau") }
                    }
                }
                Valeur::Tableau(t)
            }
            Some(b'"') => Valeur::Chaine(self.chaine()?),
            Some(b't') => self.mot(b"true", Valeur::Booleen(true))?,
            Some(b'f') => self.mot(b"false", Valeur::Booleen(false))?,
            Some(b'n') => self.mot(b"null", Valeur::Nul)?,
            Some(b'-' | b'0'..=b'9') => self.nombre()?,
            _ => return hd("JSON.parse : syntaxe"),
        };
        self.prof -= 1;
        Ok(v)
    }
}

/// `JSON.parse(texte)`.
///
/// # Errors
/// Hors domaine : erreur de syntaxe (le JS lèverait une `SyntaxError` au message propre à V8), substitut isolé.
pub fn parse(texte: &str) -> Result<Valeur, Echec> {
    let mut l = L { o: texte.as_bytes(), p: 0, prof: 0 };
    let v = l.valeur()?;
    l.blanc();
    if l.p != l.o.len() { return hd("JSON.parse : texte après la valeur"); }
    Ok(v)
}

#[cfg(test)]
mod essais {
    use super::parse;
    use ariane_vba::Valeur;
    #[test]
    fn grammaire() {
        assert_eq!(parse(" {\"a\":1,\"b\":[true,null],\"a\":-0} "), Ok(Valeur::Objet(vec![("a".into(), Valeur::Nombre(-0.0)), ("b".into(), Valeur::Tableau(vec![Some(Valeur::Booleen(true)), Some(Valeur::Nul)]))])));
        assert_eq!(parse("\"\\ud83d\\ude00\\n\""), Ok(Valeur::Chaine("😀\n".into())));
        for t in ["", "01", "1.", "{'a':1}", "[1,]", "\"\\ud800\"", "\u{feff}{}", "nul", "1 2", "\"\t\""] { assert!(parse(t).is_err(), "{t}"); }
        assert!(matches!(parse("-0"), Ok(Valeur::Nombre(x)) if x == 0.0 && x.is_sign_negative()));
        assert_eq!(parse("1e400"), Ok(Valeur::Nombre(f64::INFINITY)));
    }
}
