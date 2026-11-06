//! Texte d'un nombre : l'unique implémentation est `ariane_js::nombre::nombre_en_chaine`
//! (`String(x)`, portée dans `ariane-js`). Pour un nombre fini, c'est aussi le texte de
//! `JSON.stringify`. La parité de ces textes est celle du banc du chef sur cette fonction.

/// Texte JSON d'un nombre fini, et `String(x)` sinon. −0 et +0 donnent `"0"`.
#[must_use]
pub(crate) fn json_nombre(x: f64) -> String { ariane_js::nombre::nombre_en_chaine(x) }

/// `String(nombre)` : « NaN », « Infinity », « -Infinity », ou le texte d'un nombre fini.
#[must_use]
pub(crate) fn vers_chaine(x: f64) -> String { ariane_js::nombre::nombre_en_chaine(x) }

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
        assert_eq!(vers_chaine(f64::NAN), "NaN");
        assert_eq!(vers_chaine(f64::INFINITY), "Infinity");
        assert_eq!(vers_chaine(f64::NEG_INFINITY), "-Infinity");
    }
}
