//! CH-061 : prototype de noyaux d'Ariane en Rust, compilé en WebAssembly brut (sans wasm-bindgen).
//! Rien ici n'est branché dans l'extension : bancs seulement.
//!
//! Règle de fidélité : chaque noyau refait les MÊMES opérations flottantes, dans le même ordre, que le
//! JavaScript qu'il remplace (pas de FMA, pas de réassociation). Les seules libertés prises sont celles
//! qui ne changent aucun bit : l'ordre d'un minimum, le partage d'une sous-expression identique.

use std::alloc::{alloc, dealloc, Layout};

#[no_mangle]
pub extern "C" fn reserver(octets: usize) -> *mut u8 {
    unsafe { alloc(Layout::from_size_align(octets.max(8), 8).unwrap()) }
}
#[no_mangle]
pub extern "C" fn liberer(p: *mut u8, octets: usize) {
    unsafe { dealloc(p, Layout::from_size_align(octets.max(8), 8).unwrap()) }
}

/// `Math.hypot` de V8 (builtins/math.tq) : maximum, mise à l'échelle, somme compensée de Kahan.
/// `f64::hypot` (libm) ne donne pas toujours le même dernier bit : on reproduit V8.
#[inline]
pub fn hypot_v8(v: &[f64]) -> f64 {
    let mut max = 0.0f64;
    let mut nan = false;
    for &x in v {
        let a = x.abs();
        if a.is_nan() { nan = true; } else if a > max { max = a; }
    }
    if max == f64::INFINITY { return f64::INFINITY; }
    if nan { return f64::NAN; }
    if max == 0.0 { return 0.0; }
    let (mut sum, mut comp) = (0.0f64, 0.0f64);
    for &x in v {
        let n = x.abs() / max;
        let s = n * n - comp;
        let p = sum + s;
        comp = (p - sum) - s;
        sum = p;
    }
    sum.sqrt() * max
}

/// Médiane de geometry.js : tri croissant, milieu, moyenne des deux milieux si pair.
#[inline]
fn mediane(b: &mut [f64]) -> f64 {
    if b.is_empty() { return f64::NAN; }
    b.sort_by(|x, y| x.partial_cmp(y).unwrap());
    let i = b.len() >> 1;
    if b.len() % 2 == 1 { b[i] } else { (b[i - 1] + b[i]) / 2.0 }
}

const MAX_ANCRES: usize = 64;

/// `loss(top)+loss(face)` de geometry.js pour une case (u,z).
/// JS : pour chaque ancre a, min sur p de (p0-u-a0)**2+(p1-z-a1)**2, borné par .025*.025.
/// Ici : (p0-u) et (p1-z) calculés une fois par point et partagés entre ancres (même valeur, même bit).
#[inline]
fn perte_case(pts: &[f64], top: &[f64], face: &[f64], u: f64, z: f64, bt: &mut [f64], bf: &mut [f64]) -> f64 {
    let b0 = 0.025f64 * 0.025f64;
    let nt = top.len() / 2;
    let nf = face.len() / 2;
    for k in 0..nt { bt[k] = b0; }
    for k in 0..nf { bf[k] = b0; }
    let n = pts.len() / 2;
    for i in 0..n {
        let t0 = pts[2 * i] - u;
        let t1 = pts[2 * i + 1] - z;
        for k in 0..nt {
            let dx = t0 - top[2 * k];
            let dz = t1 - top[2 * k + 1];
            let d = dx * dx + dz * dz;
            if d < bt[k] { bt[k] = d; }
        }
        for k in 0..nf {
            let dx = t0 - face[2 * k];
            let dz = t1 - face[2 * k + 1];
            let d = dx * dx + dz * dz;
            if d < bf[k] { bf[k] = d; }
        }
    }
    mediane(&mut bt[..nt]) + mediane(&mut bf[..nf])
}

/// `search(cu,cz,ry,rz,step,retain)` de geometry.js.
/// `meilleur` = [loss,u,z] en entrée et en sortie (le meilleur persiste entre deux appels, comme en JS).
/// `grossier` (triplets loss,u,z) reçoit les cases si non nul ; renvoie le nombre de cases.
#[no_mangle]
pub extern "C" fn geo_search(pts: *const f64, n: usize, top: *const f64, nt: usize, face: *const f64, nf: usize,
                             cu: f64, cz: f64, ry: f64, rz: f64, step: f64, meilleur: *mut f64,
                             grossier: *mut f64, capacite: usize) -> usize {
    if nt > MAX_ANCRES || nf > MAX_ANCRES { return usize::MAX; }
    let pts = unsafe { std::slice::from_raw_parts(pts, 2 * n) };
    let top = unsafe { std::slice::from_raw_parts(top, 2 * nt) };
    let face = unsafe { std::slice::from_raw_parts(face, 2 * nf) };
    let m = unsafe { std::slice::from_raw_parts_mut(meilleur, 3) };
    let mut bt = [0.0f64; MAX_ANCRES];
    let mut bf = [0.0f64; MAX_ANCRES];
    let mut cases = 0usize;
    let mut u = cu - ry;
    while u <= cu + ry + 1e-10 {
        let mut z = cz - rz;
        while z <= cz + rz + 1e-10 {
            let score = perte_case(pts, top, face, u, z, &mut bt, &mut bf) + 1e-7 * (u.abs() + z.abs());
            if !grossier.is_null() && cases < capacite {
                unsafe { *grossier.add(3 * cases) = score; *grossier.add(3 * cases + 1) = u; *grossier.add(3 * cases + 2) = z; }
            }
            cases += 1;
            if score < m[0] { m[0] = score; m[1] = u; m[2] = z; }
            z += step;
        }
        u += step;
    }
    cases
}


/// Variante élaguée de `geo_search` : points triés par p0 (fait ici), et pour chaque ancre seuls les points avec
/// |p0-u-a0| < 26 mm sont examinés. Hors fenêtre, la distance dépasse .025² : le minimum (borné) est inchangé.
/// Même arithmétique que geometry.js : ((p0-u)-a0)² + ((p1-z)-a1)².
#[no_mangle]
pub extern "C" fn geo_search_elague(pts: *const f64, n: usize, top: *const f64, nt: usize, face: *const f64, nf: usize,
                                    cu: f64, cz: f64, ry: f64, rz: f64, step: f64, meilleur: *mut f64,
                                    grossier: *mut f64, capacite: usize) -> usize {
    if nt > MAX_ANCRES || nf > MAX_ANCRES { return usize::MAX; }
    let pts = unsafe { std::slice::from_raw_parts(pts, 2 * n) };
    let top = unsafe { std::slice::from_raw_parts(top, 2 * nt) };
    let face = unsafe { std::slice::from_raw_parts(face, 2 * nf) };
    let m = unsafe { std::slice::from_raw_parts_mut(meilleur, 3) };
    let mut ord: Vec<usize> = (0..n).collect();
    ord.sort_by(|&a, &b| pts[2 * a].partial_cmp(&pts[2 * b]).unwrap());
    let xs: Vec<f64> = ord.iter().map(|&i| pts[2 * i]).collect();
    let ys: Vec<f64> = ord.iter().map(|&i| pts[2 * i + 1]).collect();
    let borne = |v: f64| xs.partition_point(|&x| x < v);
    const MARGE: f64 = 0.026;
    let b0 = 0.025f64 * 0.025f64;
    let mut bt = [0.0f64; MAX_ANCRES];
    let mut bf = [0.0f64; MAX_ANCRES];
    let mut cases = 0usize;
    let mut u = cu - ry;
    while u <= cu + ry + 1e-10 {
        let mut z = cz - rz;
        while z <= cz + rz + 1e-10 {
            for (anc, b, na) in [(top, &mut bt, nt), (face, &mut bf, nf)] {
                for k in 0..na {
                    let (a0, a1) = (anc[2 * k], anc[2 * k + 1]);
                    let (lo, hi) = (borne(u + a0 - MARGE), borne(u + a0 + MARGE));
                    let mut mm = b0;
                    for i in lo..hi {
                        let dx = xs[i] - u - a0;
                        let dz = ys[i] - z - a1;
                        let d = dx * dx + dz * dz;
                        if d < mm { mm = d; }
                    }
                    b[k] = mm;
                }
            }
            let score = mediane(&mut bt[..nt]) + mediane(&mut bf[..nf]) + 1e-7 * (u.abs() + z.abs());
            if !grossier.is_null() && cases < capacite {
                unsafe { *grossier.add(3 * cases) = score; *grossier.add(3 * cases + 1) = u; *grossier.add(3 * cases + 2) = z; }
            }
            cases += 1;
            if score < m[0] { m[0] = score; m[1] = u; m[2] = z; }
            z += step;
        }
        u += step;
    }
    cases
}

/// `C.point(m,p)` de capture-core.js, sans le contrôle d'erreur (fait par l'appelant sur le résultat).
#[inline]
fn point(m: &[f64; 16], x: f64, y: f64, z: f64) -> ([f64; 3], f64) {
    let w = m[3] * x + m[7] * y + m[11] * z + m[15];
    ([(m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) / w], w)
}
#[inline]
fn dist(a: &[f64; 3], b: &[f64; 3]) -> f64 { hypot_v8(&[a[0] - b[0], a[1] - b[1], a[2] - b[2]]) }
#[inline]
fn fini3(p: &[f64; 3]) -> bool { p[0].is_finite() && p[1].is_finite() && p[2].is_finite() }

/// Boucle par point de `capture()` (vendor/lidar.js), pour un nœud non indexé.
/// Entrée `mats` (f64) : model, invModel, transforms[0..2], frames[s].profileLocalToSceneRelative,
/// frames[s].sceneRelativeToProfileLocal = 8 matrices de 16, puis bounds (3).
/// `src` : positions Float32 du nœud, copiées dans la mémoire WASM (stride, offset en flottants).
/// Sorties :
///  - `retenus` (u32) : indices source retenus ; `scene` (f64 ×3) : point scène ; `cotes` (u8) : bit0 gauche, bit1 droit ;
///  - `etat` (f64) : [inspected, nonFinite, roundTripMax, perRailL, perRailR,
///                    nearestL: dist, idx, local×3, scene×3, nearestR: dist, idx, local×3, scene×3, erreurProjection]
///    (nearest dist = +inf si aucun ; les valeurs en entrée sont reprises : le JS enchaîne les nœuds).
/// Renvoie le nombre de points retenus. `limite` borne les retenus (maxPoints restant).
#[no_mangle]
pub extern "C" fn lidar_scan(src: *const f32, nsrc: usize, stride: usize, offset: usize, debut: usize, fin: usize,
                             mats: *const f64, retenus: *mut u32, scene: *mut f64, cotes: *mut u8, limite: usize,
                             etat: *mut f64) -> usize {
    let src = unsafe { std::slice::from_raw_parts(src, nsrc) };
    let mm = unsafe { std::slice::from_raw_parts(mats, 8 * 16 + 3) };
    let mat = |k: usize| -> [f64; 16] { let mut a = [0.0; 16]; a.copy_from_slice(&mm[16 * k..16 * k + 16]); a };
    let (model, inv_model, tr0, tr1) = (mat(0), mat(1), mat(2), mat(3));
    let (pl2s0, pl2s1, s2pl0, s2pl1) = (mat(4), mat(5), mat(6), mat(7));
    let bounds = [mm[128], mm[129], mm[130]];
    let e = unsafe { std::slice::from_raw_parts_mut(etat, 26) };
    let in_roi = |p: &[f64; 3]| p[0].abs() <= bounds[0] && p[1].abs() <= bounds[1] && p[2].abs() <= bounds[2];
    let mut n = 0usize;
    for i in debut..fin {
        if n >= limite { break; }
        let base = i * stride + offset;
        let (x, y, z) = (src[base] as f64, src[base + 1] as f64, src[base + 2] as f64);
        e[0] += 1.0;
        if !(x.is_finite() && y.is_finite() && z.is_finite()) { e[1] += 1.0; continue; }
        let (l0, w0) = point(&tr0, x, y, z);
        let (l1, w1) = point(&tr1, x, y, z);
        // C.point lève une erreur si w ou le résultat n'est pas fini : on le signale, le JS rejouera le nœud.
        if !(w0.is_finite() && w0.abs() >= 1e-15 && w1.is_finite() && w1.abs() >= 1e-15 && fini3(&l0) && fini3(&l1)) { e[25] = 1.0; return n; }
        let locals = [l0, l1];
        let inside = [in_roi(&l0), in_roi(&l1)];
        for s in 0..2 {
            let d = hypot_v8(&locals[s]);
            let o = 5 + 10 * s;
            // JS : if(!last||dist<last.distance) ; e[o] vaut +inf au départ.
            if d < e[o] {
                let (p, _) = point(&model, x, y, z);
                e[o] = d; e[o + 1] = i as f64;
                e[o + 2] = locals[s][0]; e[o + 3] = locals[s][1]; e[o + 4] = locals[s][2];
                e[o + 5] = p[0]; e[o + 6] = p[1]; e[o + 7] = p[2];
            }
        }
        if !(inside[0] || inside[1]) { continue; }
        let (p, _) = point(&model, x, y, z);
        let (q, _) = point(&inv_model, p[0], p[1], p[2]);
        let (back, _) = point(&model, q[0], q[1], q[2]);
        let mut rt = e[2];
        let d0 = dist(&back, &p); if d0 > rt { rt = d0; }
        for s in 0..2 {
            let (a, b) = if s == 0 { (&s2pl0, &pl2s0) } else { (&s2pl1, &pl2s1) };
            let (q, _) = point(a, p[0], p[1], p[2]);
            let (round, _) = point(b, q[0], q[1], q[2]);
            let d = dist(&round, &p); if d > rt { rt = d; }
            if inside[s] { e[3 + s] += 1.0; }
        }
        e[2] = rt;
        unsafe {
            *retenus.add(n) = i as u32;
            *scene.add(3 * n) = p[0]; *scene.add(3 * n + 1) = p[1]; *scene.add(3 * n + 2) = p[2];
            *cotes.add(n) = (inside[0] as u8) | ((inside[1] as u8) << 1);
        }
        n += 1;
    }
    n
}

/// Compression deflate brute (pour le banc zip), niveau 1..9. Renvoie la longueur écrite dans `sortie`, ou 0 si trop petit.
#[no_mangle]
pub extern "C" fn deflate_brut(entree: *const u8, n: usize, niveau: u8, sortie: *mut u8, capacite: usize) -> usize {
    let e = unsafe { std::slice::from_raw_parts(entree, n) };
    let v = miniz_oxide::deflate::compress_to_vec(e, niveau);
    if v.len() > capacite { return 0; }
    unsafe { std::ptr::copy_nonoverlapping(v.as_ptr(), sortie, v.len()); }
    v.len()
}

/// CRC-32 (zip), table, pour comparer au CRC de zip-writer.js.
#[no_mangle]
pub extern "C" fn crc32(entree: *const u8, n: usize, depart: u32) -> u32 {
    static mut TABLE: [u32; 256] = [0; 256];
    static mut PRETE: bool = false;
    unsafe {
        if !PRETE {
            for i in 0..256u32 { let mut c = i; for _ in 0..8 { c = if c & 1 != 0 { 0xEDB88320 ^ (c >> 1) } else { c >> 1 }; } TABLE[i as usize] = c; }
            PRETE = true;
        }
        let e = std::slice::from_raw_parts(entree, n);
        let mut c = !depart;
        for &b in e { c = TABLE[((c ^ b as u32) & 0xFF) as usize] ^ (c >> 8); }
        !c
    }
}

/// Appel vide : coût d'une traversée JS → WASM → JS.
#[no_mangle]
pub extern "C" fn vide(x: f64) -> f64 { x }

/// JSON : analyse puis réécriture (serde_json::Value), pour comparer à JSON.parse + JSON.stringify de V8.
/// Renvoie la longueur écrite (0 si erreur ou si la sortie ne tient pas).
#[no_mangle]
pub extern "C" fn json_aller_retour(entree: *const u8, n: usize, sortie: *mut u8, capacite: usize) -> usize {
    let e = unsafe { std::slice::from_raw_parts(entree, n) };
    let v: serde_json::Value = match serde_json::from_slice(e) { Ok(v) => v, Err(_) => return 0 };
    let s = match serde_json::to_vec(&v) { Ok(s) => s, Err(_) => return 0 };
    if s.len() > capacite { return 0; }
    unsafe { std::ptr::copy_nonoverlapping(s.as_ptr(), sortie, s.len()); }
    s.len()
}
