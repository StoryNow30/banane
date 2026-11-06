//! Export d'Ariane en Rust (CH-069, lot 200–249 de l'inventaire) : `native-export`, `phase-pli`, `gcv1-export`
//! (`buildDiagnostic`), `export-cache` (fonctions pures) et `crc32` de `zip-writer`, au bit près du JS.
//! Un seul point d'entrée, [`appeler`] ; aucune donnée ne survit à un appel (l'arène du cœur est remise à zéro).
//! Toute entrée que le port ne reproduit pas à l'identique rend `Echec::HorsDomaine` : la façade
//! (`ariane-rs/coquille/facade-export.js`) rappelle alors le JS d'origine.
pub mod cache;
pub mod collation;
pub mod crc;
pub mod date;
pub mod gcv1;
pub mod js;
pub mod natif;
pub mod pli;

use ariane_js::Echec;
use ariane_vba::Valeur;

/// Point d'entrée du cœur pour les fonctions 200 à 249 (table : `chantiers/CH-069/rapport.md`).
///
/// # Errors
/// `Echec::Js` : l'exception que lèverait le JS ; `Echec::HorsDomaine` : la façade rappelle le JS d'origine.
pub fn appeler(fonction: u32, entree: &Valeur) -> Result<Valeur, Echec> {
    let r = match fonction {
        200 => crc::crc32(entree),
        201 => cache::signature(entree),
        202 => cache::signatures(entree),
        203 => cache::captures_a_garder(entree),
        204 => cache::refus(entree),
        205 => cache::reprenable(entree),
        206 => cache::fini(entree),
        207 => cache::fiche_depart(entree),
        208 => cache::ajouter_depart(entree),
        210 => natif::compact(entree),
        211 => natif::expand(entree),
        212 => natif::expand_cloud_appel(entree),
        213 => natif::unfold_refs(entree),
        214 => natif::misfiled(entree),
        215 => natif::alleger(entree),
        216 => natif::entete_mince(entree),
        217 => natif::delta_metadonnees(entree),
        218 => natif::evenements_par_reference(entree),
        219 => natif::rehydrater(entree),
        220 => pli::plier(entree),
        221 => pli::deplier(entree),
        222 => pli::est_plie(entree),
        223 => pli::eligible_appel(entree),
        230 => gcv1::build_diagnostic(entree),
        _ => Err(Echec::hors_domaine(format!("ariane-export : fonction {fonction} non portée"))),
    };
    // La sortie ne va qu'à la coquille, qui la décode en valeurs JS : toute forme d'encodage d'un même tableau (06, 09,
    // 0A, 0B) y donne les mêmes valeurs. Pas de copie canonique ici (une copie entière de la sortie, mesurée : elle
    // faisait passer un segment Écho réel au-dessus du plafond de 256 Mio).
    r
}

#[cfg(test)]
mod essais {
    use super::*;
    #[test]
    fn aiguillage() {
        assert!(matches!(appeler(249, &Valeur::Nul), Err(Echec::HorsDomaine(_))));
        let e = js::objet(vec![("octets", Valeur::Tableau(vec![Some(Valeur::Nombre(1.0))]))]);
        assert!(appeler(200, &e).is_err()); // forme non canonique en entrée (la coquille enverrait Nombres)
        let e = js::objet(vec![("octets", Valeur::Nombres(vec![1.0]))]);
        assert!(matches!(appeler(200, &e), Ok(Valeur::Nombre(_))));
        assert_eq!(appeler(222, &js::objet(vec![("events", Valeur::Nul)])), Ok(Valeur::Booleen(false)));
    }
}
