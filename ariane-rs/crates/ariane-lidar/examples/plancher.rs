//! Plancher matériel : deux produits matrice-vecteur par point, sans contrôle (cargo run --release --example plancher).
fn main() {
    let mut g = 1u64;
    let src: Vec<f32> = (0..3 * 810_000).map(|_| { g = g.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); (((g >> 11) as f64 / (1u64 << 53) as f64 - 0.5) * 100.0) as f32 }).collect();
    let m: [f64; 32] = std::hint::black_box([1.0; 32]);
    let mut v = vec![];
    for _ in 0..15 {
        let t = std::time::Instant::now();
        let mut c = 0u32;
        for q in src.chunks_exact(3) {
            let (x, y, z) = (q[0] as f64, q[1] as f64, q[2] as f64);
            for o in [0, 16] {
                let a = m[o] * x + m[o + 4] * y + m[o + 8] * z + m[o + 12];
                let b = m[o + 1] * x + m[o + 5] * y + m[o + 9] * z + m[o + 13];
                let d = m[o + 2] * x + m[o + 6] * y + m[o + 10] * z + m[o + 14];
                if a.abs() <= 0.5 && b.abs() <= 0.4 && d.abs() <= 0.3 { c += 1; }
            }
        }
        std::hint::black_box(c);
        v.push(t.elapsed().as_secs_f64() * 1e3);
    }
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!("plancher : {:.2} ms, {:.1} ns/pt", v[7], v[7] * 1e6 / 810_000.0);
}
