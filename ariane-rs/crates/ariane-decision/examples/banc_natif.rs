//! Banc NATIF (option B) de ariane-decision : rejoue des trames VBA (`tools/ch064-d-banc-temps.cjs --natif`) et mesure le temps
//! (décodage VBA, calcul, encodage compris : ce que ferait l'hôte natif) et la mémoire (`VmHWM`, `VmRSS` de /proc/self/status).
//!   cargo run --release -p ariane-decision --example `banc_natif` -- FICHIER [REPETITIONS]
//! Fichier : suite de [u32 numéro du poste][u32 fonction][u32 longueur][trame VBA], petit-boutiste. Sortie : JSON sur stdout.
//! En natif, `Math.pow` et `Math.exp` ne sont pas ceux du moteur (voir `js::pow`) : temps seulement, jamais une parité.
// Outil de mesure : comptes et rangs de la trame (< 2^32, octets lus), conversions bornées par construction.
#![allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
use std::time::Instant;

fn statut(cle: &str) -> u64 {
    std::fs::read_to_string("/proc/self/status").ok().and_then(|s| s.lines().find(|l| l.starts_with(cle)).and_then(|l| l.split_whitespace().nth(1)).and_then(|x| x.parse().ok())).unwrap_or(0)
}
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let octets = std::fs::read(&a[1]).expect("fichier de trames");
    let rep: usize = a.get(2).and_then(|x| x.parse().ok()).unwrap_or(15);
    let mut p = 0usize;
    let u32le = |o: &[u8], p: usize| u32::from_le_bytes([o[p], o[p + 1], o[p + 2], o[p + 3]]) as usize;
    let mut par_poste: std::collections::BTreeMap<usize, Vec<f64>> = std::collections::BTreeMap::default();
    let rss0 = statut("VmRSS:");
    while p < octets.len() {
        let (poste, f, n) = (u32le(&octets, p), u32le(&octets, p + 4) as u32, u32le(&octets, p + 8));
        let trame = &octets[p + 12..p + 12 + n];
        p += 12 + n;
        let mut t = vec![];
        for i in 0..=rep {
            let t0 = Instant::now();
            let v = ariane_vba::decoder(trame).expect("trame");
            let r = ariane_decision::appeler(f, &v);
            let sortie = match r { Ok(x) => ariane_vba::encoder(&x), Err(_) => vec![] };
            std::hint::black_box(sortie);
            if i > 0 { t.push(t0.elapsed().as_secs_f64() * 1000.0); }
        }
        t.sort_by(|x, y| x.partial_cmp(y).unwrap());
        par_poste.entry(poste).or_default().push(t[t.len() / 2]);
    }
    let q = |v: &[f64], x: f64| { let mut s = v.to_vec(); s.sort_by(|a, b| a.partial_cmp(b).unwrap()); s[std::cmp::min(s.len() - 1, (x * s.len() as f64) as usize)] };
    let lignes: Vec<String> = par_poste.iter().map(|(k, v)| format!("\"{k}\":{{\"cas\":{},\"mediane\":{},\"p90\":{}}}", v.len(), q(v, 0.5), q(v, 0.9))).collect();
    println!("{{\"repetitions\":{rep},\"postes\":{{{}}},\"vmRssAvantKo\":{rss0},\"vmRssKo\":{},\"vmHwmKo\":{}}}", lignes.join(","), statut("VmRSS:"), statut("VmHWM:"));
}
