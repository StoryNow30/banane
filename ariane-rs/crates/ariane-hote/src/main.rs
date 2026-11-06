//! Option B (CH-064, étape 1 bis) : le cœur d'Ariane en programme NATIF, joint par `chrome.runtime.connectNative`.
//!
//! Protocole du native messaging : chaque message est une longueur `u32` (ordre natif) puis du JSON UTF-8, sur l'entrée
//! et la sortie standard. Enveloppe :
//!   reçu   `{"i":n,"f":fonction,"t":"<trame VBA en base64>"}`  ou  `{"i":n,"c":"etat"|"rendre"|"quitter"}`
//!   rendu  `{"i":n,"k":rang,"n":morceaux,"t":"<base64>","us":[décodage,calcul,encodage]}` ; une réponse de plus de
//!          `MORCEAU` caractères est découpée (Chrome refuse tout message de plus d'1 Mo venant du programme).
//! Prototype de mesure, hors paquet : rien n'est installé sur le poste de l'opérateur.
use std::io::{self, Read, Write};
use std::time::Instant;

const MORCEAU: usize = 960_000; // base64, multiple de 4, sous la limite d'1 Mo du message rendu

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
fn b64_encoder(o: &[u8]) -> String {
    let mut s = Vec::with_capacity(o.len().div_ceil(3) * 4);
    for c in o.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        s.push(B64[(n >> 18) as usize & 63]);
        s.push(B64[(n >> 12) as usize & 63]);
        s.push(if c.len() > 1 { B64[(n >> 6) as usize & 63] } else { b'=' });
        s.push(if c.len() > 2 { B64[n as usize & 63] } else { b'=' });
    }
    String::from_utf8(s).unwrap()
}
fn b64_decoder(s: &[u8]) -> Option<Vec<u8>> {
    let mut t = [255u8; 256];
    for (i, &c) in B64.iter().enumerate() { t[c as usize] = i as u8; }
    if !s.len().is_multiple_of(4) { return None; }
    let mut o = Vec::with_capacity(s.len() / 4 * 3);
    for c in s.chunks(4) {
        let mut n = 0u32;
        let mut pad = 0;
        for &x in c {
            n <<= 6;
            if x == b'=' { pad += 1; } else { let v = t[x as usize]; if v == 255 { return None; } n |= v as u32; }
        }
        o.push((n >> 16) as u8);
        if pad < 2 { o.push((n >> 8) as u8); }
        if pad < 1 { o.push(n as u8); }
    }
    Some(o)
}

/// Champ d'une enveloppe plate écrite par Chrome (`JSON.stringify` d'un objet simple : pas d'espace, valeurs simples).
fn champ<'a>(j: &'a [u8], cle: &str) -> Option<&'a [u8]> {
    let motif = format!("\"{cle}\":");
    let p = j.windows(motif.len()).position(|w| w == motif.as_bytes())? + motif.len();
    let r = &j[p..];
    if r.first() == Some(&b'"') {
        let f = r[1..].iter().position(|&c| c == b'"')?;
        Some(&r[1..1 + f])
    } else {
        let f = r.iter().position(|&c| c == b',' || c == b'}').unwrap_or(r.len());
        Some(&r[..f])
    }
}

fn lire(entree: &mut impl Read) -> io::Result<Option<Vec<u8>>> {
    let mut l = [0u8; 4];
    match entree.read_exact(&mut l) { Ok(()) => {}, Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None), Err(e) => return Err(e) }
    let mut m = vec![0u8; u32::from_ne_bytes(l) as usize];
    entree.read_exact(&mut m)?;
    Ok(Some(m))
}
fn ecrire(sortie: &mut impl Write, json: &str) -> io::Result<()> {
    sortie.write_all(&(json.len() as u32).to_ne_bytes())?;
    sortie.write_all(json.as_bytes())?;
    sortie.flush()
}

/// Mémoire du processus (Linux : /proc/self/status) ; ailleurs : null.
fn memoire() -> String {
    let s = std::fs::read_to_string("/proc/self/status").unwrap_or_default();
    let v = |k: &str| s.lines().find(|l| l.starts_with(k)).and_then(|l| l.split_whitespace().nth(1)).unwrap_or("null").to_string();
    format!("{{\"rssKo\":{},\"hauteEauKo\":{}}}", v("VmRSS:"), v("VmHWM:"))
}

#[cfg(target_os = "linux")]
extern "C" { fn malloc_trim(pad: usize) -> i32; }
fn rendre() { #[cfg(target_os = "linux")] unsafe { malloc_trim(0); } }

fn main() -> io::Result<()> {
    let (mut entree, mut sortie) = (io::stdin().lock(), io::stdout().lock());
    let depart = Instant::now();
    while let Some(m) = lire(&mut entree)? {
        let i = champ(&m, "i").map(|v| String::from_utf8_lossy(v).into_owned()).unwrap_or_else(|| "null".into());
        if let Some(c) = champ(&m, "c") {
            match c {
                b"etat" => ecrire(&mut sortie, &format!("{{\"i\":{i},\"memoire\":{},\"pid\":{},\"vieMs\":{}}}", memoire(), std::process::id(), depart.elapsed().as_millis()))?,
                b"rendre" => { rendre(); ecrire(&mut sortie, &format!("{{\"i\":{i},\"memoire\":{}}}", memoire()))? }
                b"quitter" => return Ok(()),
                // mesure de la limite de taille d'un message rendu : un message JSON d'environ `o` octets
                b"grand" => {
                    let o: usize = champ(&m, "o").and_then(|v| std::str::from_utf8(v).ok()?.parse().ok()).unwrap_or(0);
                    let entete = format!("{{\"i\":{i},\"t\":\"");
                    let corps = "A".repeat(o.saturating_sub(entete.len() + 2));
                    ecrire(&mut sortie, &format!("{entete}{corps}\"}}"))?
                }
                _ => ecrire(&mut sortie, &format!("{{\"i\":{i},\"erreur\":\"commande inconnue\"}}"))?,
            }
            continue;
        }
        let f: u32 = champ(&m, "f").and_then(|v| std::str::from_utf8(v).ok()?.parse().ok()).unwrap_or(u32::MAX);
        let t0 = Instant::now();
        let Some(trame) = champ(&m, "t").and_then(b64_decoder) else {
            ecrire(&mut sortie, &format!("{{\"i\":{i},\"erreur\":\"enveloppe illisible\"}}"))?;
            continue;
        };
        drop(m);
        let t1 = Instant::now();
        let r = ariane_coeur::abi::executer(f, &trame);
        drop(trame);
        let t2 = Instant::now();
        let t = b64_encoder(&r);
        drop(r);
        let t3 = Instant::now();
        let us = format!("[{},{},{}]", (t1 - t0).as_micros(), (t2 - t1).as_micros(), (t3 - t2).as_micros());
        let n = t.len().div_ceil(MORCEAU).max(1);
        for k in 0..n {
            let part = &t[k * MORCEAU..std::cmp::min(t.len(), (k + 1) * MORCEAU)];
            ecrire(&mut sortie, &format!("{{\"i\":{i},\"k\":{k},\"n\":{n},\"t\":\"{part}\",\"us\":{us}}}"))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn base64_aller_retour() {
        for n in 0..20 { let o: Vec<u8> = (0..n).map(|i| (i * 37) as u8).collect(); assert_eq!(b64_decoder(b64_encoder(&o).as_bytes()).unwrap(), o); }
    }
    #[test]
    fn enveloppe() {
        let j = br#"{"i":7,"f":20,"t":"QUJD"}"#;
        assert_eq!(champ(j, "i"), Some(&b"7"[..]));
        assert_eq!(champ(j, "f"), Some(&b"20"[..]));
        assert_eq!(champ(j, "t"), Some(&b"QUJD"[..]));
    }
}
