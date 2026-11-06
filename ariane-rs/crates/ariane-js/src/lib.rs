//! Sémantique JavaScript (V8) en Rust : tout calcul métier passe par ici pour donner les MÊMES bits que le JS.
//!
//! Mesuré (tools/ch064-sonde-math.cjs) : `f64::hypot` et `f64::round` de Rust divergent de `Math.hypot` et
//! `Math.round` de V8 sur 35 % et 51 % des tirages ; les portages ci-dessous, 0 sur 1 000 000.
//! `sqrt`, `ceil`, `floor`, `trunc`, `abs` de std sont exacts (opérations IEEE, instructions WASM natives) : permis.
//! `hypot`, `round`, `min`, `max`, `sin`, `cos`, `ln`, `log10`, `ln_1p`, `powf`, `exp` de std : INTERDITS dans les crates
//! métier (clippy.toml), remplacés par ce module.

/// `Math.hypot` de V8 (builtins math.tq) : ∞ l'emporte sur NaN, mise à l'échelle par le maximum, somme compensée.
pub fn hypot(v: &[f64]) -> f64 {
    let mut max = 0.0f64;
    let mut nan = false;
    for &x in v {
        let a = x.abs();
        if a == f64::INFINITY {
            return f64::INFINITY;
        }
        if a.is_nan() {
            nan = true;
        } else if a > max {
            max = a;
        }
    }
    if nan {
        return f64::NAN;
    }
    if max == 0.0 {
        return 0.0;
    }
    let (mut somme, mut compensation) = (0.0f64, 0.0f64);
    for &x in v {
        let n = x.abs() / max;
        let terme = n * n - compensation;
        let provisoire = somme + terme;
        compensation = (provisoire - somme) - terme;
        somme = provisoire;
    }
    somme.sqrt() * max
}

/// `Math.round` de V8 : plafond, puis −1 si le plafond dépasse x de plus d'un demi ; −0 rendu sur [−0,5 ; −0].
pub fn round(x: f64) -> f64 {
    if !x.is_finite() {
        return x;
    }
    let mut v = x.ceil();
    if v - 0.5 > x {
        v -= 1.0;
    }
    if v == 0.0 && x.is_sign_negative() {
        return -0.0;
    }
    v
}

/// `Math.max` à deux arguments : NaN contamine, +0 > −0.
pub fn max(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        return f64::NAN;
    }
    if a == 0.0 && b == 0.0 {
        return if a.is_sign_negative() { b } else { a };
    }
    if a > b { a } else { b }
}

/// `Math.min` à deux arguments : NaN contamine, −0 < +0.
pub fn min(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        return f64::NAN;
    }
    if a == 0.0 && b == 0.0 {
        return if a.is_sign_negative() { a } else { b };
    }
    if a < b { a } else { b }
}

/// `Math.sign` : NaN, ±0 conservés.
pub fn sign(x: f64) -> f64 {
    if x.is_nan() || x == 0.0 { x } else if x > 0.0 { 1.0 } else { -1.0 }
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn round_cas_speciaux() {
        assert_eq!(round(2.5), 3.0);
        assert_eq!(round(-2.5), -2.0);
        assert_eq!(round(-1.5), -1.0);
        assert!(round(-0.5).is_sign_negative() && round(-0.5) == 0.0);
        assert!(round(-0.0).is_sign_negative());
        assert!(round(-0.2).is_sign_negative());
        assert!(!round(0.2).is_sign_negative());
        assert_eq!(round(0.49999999999999994), 0.0);
        assert_eq!(round(4503599627370495.5), 4503599627370496.0);
    }
    #[test]
    fn max_min_zero_signe_et_nan() {
        assert!(!max(-0.0, 0.0).is_sign_negative());
        assert!(min(0.0, -0.0).is_sign_negative());
        assert!(max(1.0, f64::NAN).is_nan());
        assert!(min(f64::NAN, 1.0).is_nan());
    }
    #[test]
    fn hypot_speciaux() {
        assert_eq!(hypot(&[]), 0.0);
        assert_eq!(hypot(&[f64::NAN, f64::INFINITY]), f64::INFINITY);
        assert!(hypot(&[f64::NAN, 1.0]).is_nan());
        assert_eq!(hypot(&[3.0, 4.0]), 5.0);
    }
}
