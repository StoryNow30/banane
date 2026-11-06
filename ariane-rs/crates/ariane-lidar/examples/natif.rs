#![allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
//! Noyau en natif sur des vues réelles écrites par `tools/ch064-l-natif.cjs` (fichier temporaire hors dépôt).
//! Format : u32 vues ; par vue : u32 nœuds ; par nœud : 131 f64 (MATS), u32 points, points × 3 f32. Rend une ligne par vue :
//! la médiane de 15 répétitions (échauffement exclu) du parcours de tous les nœuds par tranches de 4 096 points, en ms.
use ariane_lidar::{parcourir, E_PROCHE, E_TRAITES, N_ETAT, N_MATS};
fn main() {
    let octets = std::fs::read(std::env::args().nth(1).expect("fichier")).expect("lecture");
    let mut i = 0usize;
    let u32_ = |o: &[u8], i: &mut usize| -> usize { let v = u32::from_le_bytes(o[*i..*i + 4].try_into().unwrap()) as usize; *i += 4; v };
    let vues = u32_(&octets, &mut i);
    let mut lues: Vec<Vec<(Vec<f64>, Vec<f32>)>> = vec![];
    for _ in 0..vues {
        let n = u32_(&octets, &mut i);
        let mut noeuds = vec![];
        for _ in 0..n {
            let m: Vec<f64> = octets[i..i + 8 * N_MATS].chunks_exact(8).map(|c| f64::from_le_bytes(c.try_into().unwrap())).collect();
            i += 8 * N_MATS;
            let c = u32_(&octets, &mut i);
            let s: Vec<f32> = octets[i..i + 12 * c].chunks_exact(4).map(|c| f32::from_le_bytes(c.try_into().unwrap())).collect();
            i += 12 * c;
            noeuds.push((m, s));
        }
        lues.push(noeuds);
    }
    let (mut r, mut sc) = (vec![0u32; 4096], vec![0.0; 3 * 4096]);
    for vue in &lues {
        let mut t = vec![];
        for _ in 0..16 {
            let d = std::time::Instant::now();
            for (m, s) in vue {
                let mut e = [0.0; N_ETAT];
                e[E_PROCHE[0]] = 0.0;
                e[E_PROCHE[1]] = 0.0;
                let n = s.len() / 3;
                let mut di = 0;
                while di < n {
                    let nb = 4096.min(n - di);
                    parcourir(&s[3 * di..3 * (di + nb)], 3, nb, di as u32, f64::INFINITY, m, &mut e, &mut r, &mut sc);
                    di += e[E_TRAITES] as usize;
                }
            }
            t.push(d.elapsed().as_secs_f64() * 1e3);
        }
        t.remove(0);
        t.sort_by(f64::total_cmp);
        println!("{}", t[7]);
    }
}
