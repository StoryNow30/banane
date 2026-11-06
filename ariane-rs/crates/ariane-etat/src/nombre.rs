//! `Number.prototype.toString` et le nombre de `JSON.stringify` (ECMA-262), à partir des chiffres de Ryū.
use crate::ryu::d2s::{d2d, decimal_length17, DOUBLE_EXPONENT_BITS, DOUBLE_MANTISSA_BITS};

/// Texte JSON d'un nombre fini. `NaN` et les infinis ne sont pas du ressort de cette fonction.
/// −0 et +0 donnent `"0"`.
#[must_use]
pub(crate) fn json_nombre(x: f64) -> String {
    if x == 0.0 {
        return "0".into();
    }
    // Entiers exactement représentés : le texte décimal est celui de l'entier (pas d'exposant sous 2⁵³).
    if x.is_finite() && x.fract() == 0.0 && x.abs() <= 9_007_199_254_740_992.0 {
        return format!("{}", x as i64);
    }
    let bits = x.to_bits();
    let signe = (bits >> 63) != 0;
    let mantisse = bits & ((1u64 << DOUBLE_MANTISSA_BITS) - 1);
    let exposant = ((bits >> DOUBLE_MANTISSA_BITS) & ((1u64 << DOUBLE_EXPONENT_BITS) - 1)) as u32;
    let v = d2d(mantisse, exposant);
    let k = decimal_length17(v.mantissa) as usize;
    let mut chiffres = [0u8; 17];
    let mut m = v.mantissa;
    for i in (0..k).rev() {
        chiffres[i] = b'0' + (m % 10) as u8;
        m /= 10;
    }
    // n tel que le nombre vaut s × 10^(n−k), k = nombre de chiffres (spec ToString).
    let n = v.exponent + k as i32;
    let mut s = String::with_capacity(24);
    if signe {
        s.push('-');
    }
    let dig = |i: usize| chiffres[i] as char;
    if (k as i32) <= n && n <= 21 {
        for i in 0..k {
            s.push(dig(i));
        }
        for _ in 0..(n as usize - k) {
            s.push('0');
        }
    } else if 0 < n && n <= 21 {
        let nu = n as usize;
        for i in 0..nu {
            s.push(dig(i));
        }
        s.push('.');
        for i in nu..k {
            s.push(dig(i));
        }
    } else if -6 < n && n <= 0 {
        s.push('0');
        s.push('.');
        for _ in 0..(-n) {
            s.push('0');
        }
        for i in 0..k {
            s.push(dig(i));
        }
    } else {
        s.push(dig(0));
        if k > 1 {
            s.push('.');
            for i in 1..k {
                s.push(dig(i));
            }
        }
        s.push('e');
        let e = n - 1;
        if e >= 0 {
            s.push('+');
        } else {
            s.push('-');
        }
        { use std::fmt::Write; let _ = write!(s, "{}", e.abs()); }
    }
    s
}

/// `String(nombre)` pour un nombre fini, et « NaN » / « Infinity » / « -Infinity » sinon.
pub(crate) fn vers_chaine(x: f64) -> String {
    if x.is_nan() {
        "NaN".into()
    } else if x.is_infinite() {
        if x.is_sign_negative() { "-Infinity".into() } else { "Infinity".into() }
    } else {
        json_nombre(x)
    }
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn cas_connus() {
        assert_eq!(json_nombre(0.0), "0");
        assert_eq!(json_nombre(-0.0), "0");
        assert_eq!(json_nombre(1.0), "1");
        assert_eq!(json_nombre(-2.0), "-2");
        assert_eq!(json_nombre(0.1), "0.1");
        assert_eq!(json_nombre(0.3), "0.3");
        assert_eq!(json_nombre(1.435), "1.435");
        assert_eq!(json_nombre(1e20), "100000000000000000000");
        assert_eq!(json_nombre(1e21), "1e+21");
        assert_eq!(json_nombre(1e-6), "0.000001");
        assert_eq!(json_nombre(1e-7), "1e-7");
        assert_eq!(json_nombre(-1.23e21), "-1.23e+21");
        assert_eq!(json_nombre(9_007_199_254_740_992.0), "9007199254740992");
    }
}
