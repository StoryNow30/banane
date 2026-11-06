//! Mesure du RSS du programme natif (option B) après un appel. Lit une valeur JSON sur l'entrée standard,
//! l'enveloppe `{f, …}` est passée à `appeler`. N'écrit aucune donnée du corpus : seulement VmRSS et VmHWM.
use ariane_etat::{appeler, parse_json};
use std::io::Read;

fn main() {
    let mut s = String::new();
    std::io::stdin().read_to_string(&mut s).expect("lecture");
    let v = parse_json(&s).expect("json");
    let _ = appeler(100, &v);
    let statut = std::fs::read_to_string("/proc/self/status").unwrap_or_default();
    let champ = |k: &str| {
        statut.lines().find(|l| l.starts_with(k)).and_then(|l| l.split_whitespace().nth(1)).unwrap_or("0").to_string()
    };
    println!("{{\"rssKo\":{},\"hwmKo\":{}}}", champ("VmRSS:"), champ("VmHWM:"));
}
