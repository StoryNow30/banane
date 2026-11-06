//! `JSON.stringify` et `JSON.parse` pour les valeurs du journal (UTF-8 bien formé, pas de toJSON).
use crate::jsval::{est_objet, est_tableau};
use crate::nombre::json_nombre;
use ariane_vba::Valeur;

pub fn stringify(v: &Valeur) -> Option<String> {
    let mut s = String::new();
    ecrire(v, &mut s)?;
    Some(s)
}

fn ecrire(v: &Valeur, s: &mut String) -> Option<()> {
    match v {
        Valeur::Indefini => return None,
        Valeur::Nul => s.push_str("null"),
        Valeur::Booleen(true) => s.push_str("true"),
        Valeur::Booleen(false) => s.push_str("false"),
        Valeur::Nombre(x) => {
            if x.is_finite() { s.push_str(&json_nombre(*x)); } else { s.push_str("null"); }
        }
        Valeur::Chaine(t) => ecrire_chaine(t, s),
        Valeur::Tableau(t) => {
            s.push('[');
            for (i, e) in t.iter().enumerate() {
                if i > 0 { s.push(','); }
                match e {
                    None | Some(Valeur::Indefini) => s.push_str("null"),
                    Some(x) => { ecrire(x, s)?; }
                }
            }
            s.push(']');
        }
        Valeur::Objet(t) => {
            s.push('{');
            let mut premier = true;
            for (k, x) in t {
                if matches!(x, Valeur::Indefini) { continue; }
                if !premier { s.push(','); }
                premier = false;
                ecrire_chaine(k, s);
                s.push(':');
                ecrire(x, s)?;
            }
            s.push('}');
        }
        // Ces formes ne sortent pas de JSON.parse. On les refuse plutôt que d'inventer un texte.
        Valeur::Bloc { .. } | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Erreur { .. } => return None,
    }
    Some(())
}

fn ecrire_chaine(t: &str, s: &mut String) {
    s.push('"');
    for c in t.chars() {
        match c {
            '"' => s.push_str("\\\""),
            '\\' => s.push_str("\\\\"),
            '\u{0008}' => s.push_str("\\b"),
            '\u{000c}' => s.push_str("\\f"),
            '\n' => s.push_str("\\n"),
            '\r' => s.push_str("\\r"),
            '\t' => s.push_str("\\t"),
            c if (c as u32) < 0x20 => s.push_str(&format!("\\u{:04x}", c as u32)),
            c => s.push(c),
        }
    }
    s.push('"');
}

struct Lec<'a> { b: &'a [u8], i: usize }
impl<'a> Lec<'a> {
    fn blanc(&mut self) { while matches!(self.b.get(self.i), Some(b' ' | b'\n' | b'\r' | b'\t')) { self.i += 1; } }
    fn car(&mut self) -> Option<u8> { let c = *self.b.get(self.i)?; self.i += 1; Some(c) }
    fn att(&mut self, c: u8) -> bool { self.blanc(); if self.b.get(self.i) == Some(&c) { self.i += 1; true } else { false } }
}

pub fn parse(texte: &str) -> Option<Valeur> {
    let mut l = Lec { b: texte.as_bytes(), i: 0 };
    let v = valeur(&mut l)?;
    l.blanc();
    if l.i != l.b.len() { return None; }
    Some(v)
}

fn valeur(l: &mut Lec) -> Option<Valeur> {
    l.blanc();
    match l.car()? {
        b'n' => mot(l, b"ull").then_some(Valeur::Nul),
        b't' => mot(l, b"rue").then_some(Valeur::Booleen(true)),
        b'f' => mot(l, b"alse").then_some(Valeur::Booleen(false)),
        b'"' => Some(Valeur::Chaine(chaine(l)?)),
        b'[' => tableau(l),
        b'{' => objet(l),
        c => { l.i -= 1; if c == b'-' || c.is_ascii_digit() { nombre(l) } else { None } },
    }
}
fn mot(l: &mut Lec, reste: &[u8]) -> bool {
    if l.b.get(l.i..l.i + reste.len()) == Some(reste) { l.i += reste.len(); true } else { false }
}
fn tableau(l: &mut Lec) -> Option<Valeur> {
    let mut t = vec![];
    l.blanc();
    if l.att(b']') { return Some(Valeur::Tableau(t)); }
    loop {
        t.push(Some(valeur(l)?));
        l.blanc();
        if l.att(b']') { break; }
        if !l.att(b',') { return None; }
    }
    Some(Valeur::Tableau(t))
}
fn objet(l: &mut Lec) -> Option<Valeur> {
    let mut paires = vec![];
    l.blanc();
    if l.att(b'}') { return Some(crate::jsval::objet_depuis(paires)); }
    loop {
        l.blanc();
        if l.car()? != b'"' { return None; }
        let k = chaine(l)?;
        if !l.att(b':') { return None; }
        paires.push((k, valeur(l)?));
        l.blanc();
        if l.att(b'}') { break; }
        if !l.att(b',') { return None; }
    }
    // Clés d'indice entier d'abord, dans l'ordre numérique, puis les autres dans l'ordre d'apparition.
    let mut indices: Vec<(u32, String, Valeur)> = vec![];
    let mut autres: Vec<(String, Valeur)> = vec![];
    let mut vus_idx = std::collections::HashMap::<u32, usize>::new();
    let mut vus_autre = std::collections::HashMap::<String, usize>::new();
    for (k, v) in paires {
        if let Some(i) = indice_canonique(&k) {
            if let Some(&p) = vus_idx.get(&i) { indices[p].2 = v; } else { vus_idx.insert(i, indices.len()); indices.push((i, k, v)); }
        } else if let Some(&p) = vus_autre.get(&k) { autres[p].1 = v; } else { vus_autre.insert(k.clone(), autres.len()); autres.push((k, v)); }
    }
    indices.sort_by_key(|(i, _, _)| *i);
    let mut out = Vec::with_capacity(indices.len() + autres.len());
    for (_, k, v) in indices { out.push((k, v)); }
    out.extend(autres);
    Some(Valeur::Objet(out))
}
fn indice_canonique(k: &str) -> Option<u32> {
    if k.is_empty() || k.len() > 10 { return None; }
    let b = k.as_bytes();
    if b[0] == b'0' { return if k == "0" { Some(0) } else { None }; }
    if !b.iter().all(|c| c.is_ascii_digit()) { return None; }
    let n: u64 = k.parse().ok()?;
    if n > u32::MAX as u64 { return None; }
    Some(n as u32)
}
fn chaine(l: &mut Lec) -> Option<String> {
    let mut s = String::new();
    loop {
        let c = l.car()?;
        match c {
            b'"' => return Some(s),
            b'\\' => {
                match l.car()? {
                    b'"' => s.push('"'),
                    b'\\' => s.push('\\'),
                    b'/' => s.push('/'),
                    b'b' => s.push('\u{0008}'),
                    b'f' => s.push('\u{000c}'),
                    b'n' => s.push('\n'),
                    b'r' => s.push('\r'),
                    b't' => s.push('\t'),
                    b'u' => {
                        let mut u = 0u32;
                        for _ in 0..4 {
                            let h = l.car()?;
                            u = u << 4 | hex(h)? as u32;
                        }
                        // Paire de substituts : on assemble un scalaire. Un substitut isolé n'entre pas dans une String Rust.
                        if (0xD800..=0xDBFF).contains(&u) {
                            if l.b.get(l.i) == Some(&b'\\') && l.b.get(l.i + 1) == Some(&b'u') {
                                let sauve = l.i;
                                l.i += 2;
                                let mut v = 0u32;
                                let mut ok = true;
                                for _ in 0..4 {
                                    match l.car().and_then(hex) { Some(h) => v = v << 4 | h as u32, None => { ok = false; break; } }
                                }
                                if ok && (0xDC00..=0xDFFF).contains(&v) {
                                    let cp = 0x10000 + ((u - 0xD800) << 10) + (v - 0xDC00);
                                    s.push(char::from_u32(cp)?);
                                    continue;
                                }
                                l.i = sauve;
                            }
                            return None;
                        }
                        if (0xDC00..=0xDFFF).contains(&u) { return None; }
                        s.push(char::from_u32(u)?);
                    }
                    _ => return None,
                }
            }
            c if c < 0x80 => s.push(c as char),
            _ => {
                l.i -= 1;
                let rest = std::str::from_utf8(&l.b[l.i..]).ok()?;
                let ch = rest.chars().next()?;
                l.i += ch.len_utf8();
                if (ch as u32) < 0x20 { return None; }
                s.push(ch);
            }
        }
    }
}
fn hex(c: u8) -> Option<u8> { match c { b'0'..=b'9' => Some(c - b'0'), b'a'..=b'f' => Some(c - b'a' + 10), b'A'..=b'F' => Some(c - b'A' + 10), _ => None } }
fn nombre(l: &mut Lec) -> Option<Valeur> {
    let deb = l.i;
    if l.b.get(l.i) == Some(&b'-') { l.i += 1; }
    let d0 = *l.b.get(l.i)?;
    if d0 == b'0' { l.i += 1; }
    else if d0.is_ascii_digit() { while l.b.get(l.i).map(|c| c.is_ascii_digit()).unwrap_or(false) { l.i += 1; } }
    else { return None; }
    if l.b.get(l.i) == Some(&b'.') {
        l.i += 1;
        let a = l.i;
        while l.b.get(l.i).map(|c| c.is_ascii_digit()).unwrap_or(false) { l.i += 1; }
        if l.i == a { return None; }
    }
    if matches!(l.b.get(l.i), Some(b'e' | b'E')) {
        l.i += 1;
        if matches!(l.b.get(l.i), Some(b'+' | b'-')) { l.i += 1; }
        let a = l.i;
        while l.b.get(l.i).map(|c| c.is_ascii_digit()).unwrap_or(false) { l.i += 1; }
        if l.i == a { return None; }
    }
    let t = std::str::from_utf8(&l.b[deb..l.i]).ok()?;
    let x: f64 = t.parse().ok()?;
    Some(Valeur::Nombre(if x == 0.0 { 0.0 } else { x }))
}

/// `JSON.parse(JSON.stringify(x))` : −0 devient +0, non fini devient null, indéfini d'objet disparaît, trou et indéfini de tableau deviennent null.
pub fn clone_json(v: &Valeur) -> Valeur {
    match v {
        Valeur::Indefini => Valeur::Indefini,
        Valeur::Nul => Valeur::Nul,
        Valeur::Booleen(b) => Valeur::Booleen(*b),
        Valeur::Nombre(x) => { if !x.is_finite() { Valeur::Nul } else if *x == 0.0 { Valeur::Nombre(0.0) } else { Valeur::Nombre(*x) } }
        Valeur::Chaine(t) => Valeur::Chaine(t.clone()),
        Valeur::Tableau(t) => Valeur::Tableau(t.iter().map(|e| Some(match e {
            None => Valeur::Nul,
            Some(x) => { let y = clone_json(x); if matches!(y, Valeur::Indefini) { Valeur::Nul } else { y } }
        })).collect()),
        Valeur::Objet(t) => Valeur::Objet(t.iter().filter_map(|(k, x)| {
            let y = clone_json(x);
            if matches!(y, Valeur::Indefini) { None } else { Some((k.clone(), y)) }
        }).collect()),
        autre => autre.clone(),
    }
}

pub fn est_simple(v: &Valeur) -> bool {
    match v { Valeur::Nul | Valeur::Indefini | Valeur::Booleen(_) | Valeur::Nombre(_) | Valeur::Chaine(_) => true, _ => !est_objet(v) && !est_tableau(v) }
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn aller_retour_simples() {
        let v = Valeur::Objet(vec![
            ("b".into(), Valeur::Nombre(-0.0)),
            ("a".into(), Valeur::Chaine("é\"\\".into())),
            ("n".into(), Valeur::Tableau(vec![Some(Valeur::Nul), Some(Valeur::Nombre(f64::NAN)), None])),
        ]);
        let t = stringify(&v).unwrap();
        assert_eq!(t, r#"{"b":0,"a":"é\"\\","n":[null,null,null]}"#);
        let p = parse(&t).unwrap();
        assert_eq!(stringify(&p).unwrap(), t);
    }
    #[test]
    fn cles_entieres() {
        let p = parse(r#"{"a":1,"10":2,"2":3,"b":4}"#).unwrap();
        let Valeur::Objet(t) = p else { panic!() };
        assert_eq!(t.iter().map(|(k, _)| k.as_str()).collect::<Vec<_>>(), vec!["2", "10", "a", "b"]);
    }
}
