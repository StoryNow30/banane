//! État, journal et listes d'Ariane, portés de JavaScript (CH-064-E).
//! Entrée et sortie : valeurs VBA. La fonction `appeler` est le seul point branché par le cœur (numéro 100).
#![allow(
    clippy::too_many_arguments,
    clippy::manual_range_contains,
    clippy::if_same_then_else,
    clippy::needless_borrow,
    clippy::collapsible_if,
    clippy::ptr_arg,
    clippy::needless_range_loop,
    clippy::type_complexity,
    clippy::neg_cmp_op_on_partial_ord,
    clippy::double_ended_iterator_last,
    clippy::map_entry,
    clippy::manual_filter,
    clippy::else_if_without_else,
    dead_code,
    unused
)]
mod date;
mod dataset;
mod etat;
mod journal;
mod json;
mod jsval;
mod liste;
mod nombre;
#[allow(unexpected_cfgs, dead_code, unused)]
mod ryu;
mod verts;

use ariane_js::Echec;
use ariane_vba::Valeur;
use jsval::{a, chaine};

pub use date::{parse_iso, vers_iso};
pub use json::parse as parse_json;
pub use nombre::json_nombre;

/// Point d'entrée unique. `entree.f` choisit la fonction.
pub fn appeler(entree: Valeur) -> Result<Valeur, Echec> {
    let f = chaine(a(&entree, "f")).unwrap_or("");
    match f {
        "decouper" => etat::decouper(a(&entree, "etat"), a(&entree, "connus")),
        "clesARelire" => Ok(etat::cles_a_relire(a(&entree, "etat"))),
        "recoller" => Ok(etat::recoller(a(&entree, "etat"), a(&entree, "lus"))),
        "journal" => Ok(journal::indexer(&entree)),
        "journalAppliquer" => Ok(journal::appliquer(&entree)),
        "clesNatif" => journal::cles_natif(&entree),
        "clesParType" => journal::cles_par_type(&entree),
        "correction" => Ok(verts_ou(correction::construire(a(&entree, "events"), a(&entree, "options")))),
        "couverture" => Ok(correction::couverture(a(&entree, "events"), a(&entree, "options"))),
        "statut" => Ok(correction::statut_de(a(&entree, "entree"), a(&entree, "visites"))),
        "visites" => Ok(correction::visites_fusionnees(a(&entree, "visites"), a(&entree, "options"))),
        "apprenabilite" => Ok(correction::apprenabilite(a(&entree, "rec"))),
        "bilan" => Ok(correction::bilan(a(&entree, "entrees"), a(&entree, "visites"), a(&entree, "enregistrements"))),
        "parcours" => Ok(correction::parcours(a(&entree, "listes"), a(&entree, "options"))),
        "listeCompacter" => Ok(liste::compacter(a(&entree, "t"), a(&entree, "meta"))),
        "listeDecompacter" => Ok(liste::decompacter(a(&entree, "snap"))),
        "listeAjouter" => Ok(liste::ajouter(a(&entree, "mem"), a(&entree, "partie"), a(&entree, "cle"), a(&entree, "cut"), a(&entree, "bords"), a(&entree, "at"), a(&entree, "version"))),
        "listeComparer" => Ok(liste::comparer(a(&entree, "p"), a(&entree, "dec"), a(&entree, "at"))),
        "listeBords" => Ok(liste::bords_corps(a(&entree, "body"))),
        "listeChoisir" => Ok(liste::choisir_table(a(&entree, "tables"), a(&entree, "obs"))),
        "listeEmpreinte" => Ok(jsval::s(liste::empreinte(chaine(a(&entree, "s")).unwrap_or("")))),
        "listeNom" => Ok(jsval::s(liste::nom_fichier(a(&entree, "partie"), a(&entree, "at")))),
        "listeTexte" => Ok(jsval::s(liste::texte_resume(a(&entree, "r"), a(&entree, "snap"), a(&entree, "heure")))),
        "listeActif" => Ok(jsval::b(liste::actif(a(&entree, "reglage")))),
        "vertsListe" => Ok(verts::liste(a(&entree, "entree"), a(&entree, "options"))),
        "vertsSignaux" => Ok(verts::signaux_valeur(a(&entree, "entree"), a(&entree, "options"))),
        "vertsDuree" => Ok(jsval::s(verts::duree(a(&entree, "s")))),
        "vertsLignes" => Ok(verts::lignes_instantane(a(&entree, "dec"))),
        "vertsCompacter" => Ok(jsval::s(verts::compacter_cuts(&nombres(a(&entree, "cuts"))))),
        "dataset" => dataset::assembler(&entree),
        _ => Err(Echec::erreur(format!("État : fonction inconnue {f}"))),
    }
}
fn verts_ou(v: Valeur) -> Valeur { v }
fn nombres(v: &Valeur) -> Vec<f64> {
    match v {
        Valeur::Nombres(t) => t.clone(),
        Valeur::Tableau(t) => t.iter().filter_map(|e| e.as_ref().and_then(jsval::nombre)).collect(),
        _ => vec![],
    }
}

pub mod abi;

mod correction;
