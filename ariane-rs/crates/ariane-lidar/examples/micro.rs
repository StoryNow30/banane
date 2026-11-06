//! Micro-banc natif du noyau (cargo run --release --example micro) : 810 000 points pseudo-aléatoires, tranches de 4 096.
use ariane_lidar::*;
fn main() {
    let mut m = vec![0.0; N_MATS];
    let ident = |m: &mut [f64], o: usize, t: [f64; 3]| { for k in 0..16 { m[o + k] = if k % 5 == 0 { 1.0 } else { 0.0 }; } m[o + 12] = t[0]; m[o + 13] = t[1]; m[o + 14] = t[2]; };
    for (o, t) in [(0, [3.0, -1.0, 0.5]), (16, [-3.0, 1.0, -0.5]), (32, [2.8, -1.1, 0.5]), (48, [2.8, -2.6, 0.5]), (64, [0.2, 0.1, 0.0]), (80, [0.2, 1.6, 0.0]), (96, [-0.2, -0.1, 0.0]), (112, [-0.2, -1.6, 0.0])] { ident(&mut m, o, t); }
    m[128..131].copy_from_slice(&[0.5, 0.4, 0.3]);
    let mut g = 1u64;
    let src: Vec<f32> = (0..3 * 810_000).map(|_| { g = g.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); (((g >> 11) as f64 / (1u64 << 53) as f64 - 0.5) * 100.0) as f32 }).collect();
    let (mut e, mut r, mut s) = ([0.0; N_ETAT], vec![0u32; 4096], vec![0.0; 3 * 4096]);
    let mut v = vec![];
    for _ in 0..15 {
        let t = std::time::Instant::now();
        let mut tot = 0;
        for c in (0..810_000).step_by(4096) {
            let n = 4096.min(810_000 - c);
            e[6] = 0.0; e[15] = 0.0;
            tot += parcourir(&src[3 * c..3 * (c + n)], 3, n, c as u32, f64::INFINITY, &m, &mut e, &mut r, &mut s);
        }
        v.push(t.elapsed().as_secs_f64() * 1e3);
        std::hint::black_box(tot);
    }
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!("natif : {:.2} ms, {:.1} ns/pt", v[7], v[7] * 1e6 / 810_000.0);
}
