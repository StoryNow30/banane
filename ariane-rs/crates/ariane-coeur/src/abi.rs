//! ABI du cœur : un seul point d'appel, des octets VBA à l'aller et au retour.
//!
//! Côté JS (ariane-rs/coquille/coeur.js) : `p = vba_reserver(n)`, copie de la trame en p, `n2 = vba_appel(fonction, p, n)`
//! (la trame d'entrée est libérée par l'appel), lecture de `n2` octets en `vba_resultat()`, puis `vba_liberer_resultat()`.
//! Les tampons sont alignés sur 8 : les blocs de nombres se lisent par une vue `Float64Array`, sans copie.
use ariane_js::Echec;
use ariane_vba::{decoder, encoder, Valeur};
use std::alloc::{alloc, dealloc, Layout};
use std::cell::Cell;

const ALIGN: usize = 8;
thread_local! {
    /// Trame de la dernière réponse : (adresse, longueur), (0, 0) si aucune. Le cœur est mono-fil (WASM) : un seul appel
    /// à la fois, la réponse vit jusqu'au prochain `vba_appel` ou `vba_liberer_resultat`.
    static RESULTAT: Cell<(usize, usize)> = const { Cell::new((0, 0)) };
}

/// Disposition d'un tampon de `n` octets, aligné sur 8 (lecture des blocs de nombres par `Float64Array`).
fn disposition(n: usize) -> Layout {
    // ALIGN est une puissance de deux et n + 7 ne déborde pas pour une taille que l'allocateur peut servir
    Layout::from_size_align(n.max(1), ALIGN).unwrap_or(Layout::new::<u64>())
}

/// Tampon de `n` octets pour une trame d'entrée, à remplir par la coquille puis à passer à [`vba_appel`].
#[no_mangle]
pub extern "C" fn vba_reserver(n: usize) -> *mut u8 {
    // Nouveau cycle d'appel : la coquille a lu et rendu la réponse précédente ; tout ce que l'arène portait est mort.
    RESULTAT.with(|r| r.set((0, 0)));
    #[cfg(target_arch = "wasm32")]
    crate::arene::ARENE.remettre_a_zero();
    let d = disposition(n);
    // SÛRETÉ : `d` a une taille non nulle (n.max(1)) ; le pointeur est rendu tel quel à la coquille, qui n'en écrit que
    // `n` octets et le rend par `vba_appel` ou `vba_liberer` avec le même `n`.
    let p = unsafe { alloc(d) };
    if p.is_null() { std::alloc::handle_alloc_error(d); }
    p
}

/// Rend un tampon d'entrée non passé à [`vba_appel`].
///
/// # Safety
/// `p` vient de `vba_reserver(n)`, avec le même `n`, et n'a pas encore été rendu.
#[no_mangle]
pub unsafe extern "C" fn vba_liberer(p: *mut u8, n: usize) {
    // SÛRETÉ : contrat de l'appelant ci-dessus ; même disposition qu'à l'allocation.
    unsafe { dealloc(p, disposition(n)) }
}

/// Octets occupés dans l'arène par l'appel en cours ou le dernier appel (haute eau d'un appel ; 0 hors WASM).
#[no_mangle]
pub extern "C" fn vba_occupe() -> usize {
    #[cfg(target_arch = "wasm32")]
    { crate::arene::ARENE.occupe() }
    #[cfg(not(target_arch = "wasm32"))]
    { 0 }
}

/// Adresse de la trame de la dernière réponse (0 si aucune).
#[no_mangle]
pub extern "C" fn vba_resultat() -> *const u8 { RESULTAT.with(|r| r.get().0 as *const u8) }

/// Rend la trame de la dernière réponse.
#[no_mangle]
pub extern "C" fn vba_liberer_resultat() {
    RESULTAT.with(|r| {
        let (p, n) = r.get();
        if p != 0 {
            // SÛRETÉ : (p, n) a été posé par `vba_appel` à partir d'une allocation de `disposition(n)`, jamais rendue
            // depuis (la cellule est remise à zéro juste après).
            unsafe { dealloc(p as *mut u8, disposition(n)) }
        }
        r.set((0, 0));
    });
}

/// Table des fonctions du cœur. Une fonction reçoit la valeur décodée et rend une valeur (ou `Valeur::Erreur`).
fn aiguiller(fonction: u32, entree: Valeur) -> Valeur {
    let r = match fonction {
        0 => Ok(entree), // écho : preuve d'aller-retour du format
        1 => Ok(Valeur::Nul), // accusé : mesure de la traversée seule
        2 => nombres_en_chaines(&entree), // String(x) au bit près de V8 (sonde tools/ch064-sonde-nombres.cjs)
        10 => capture(&entree),
        20 => ariane_geometrie::v46::propose_both(champ(&entree, "capture"), champ(&entree, "options")),
        21 => match champ(&entree, "side") {
            Valeur::Chaine(c) => ariane_geometrie::v46::propose(champ(&entree, "capture"), c, champ(&entree, "options")),
            _ => Err(Echec::hors_domaine("side non chaîne")),
        },
        22 | 23 => gcv1(fonction, &entree),
        30 => match champ(&entree, "side") {
            Valeur::Chaine(c) => ariane_geometrie::convention::calibrate(champ(&entree, "capture"), c, champ(&entree, "delta"), champ(&entree, "options"), champ(&entree, "plafond")),
            _ => Err(Echec::hors_domaine("side non chaîne")),
        },
        31 => match champ(&entree, "side") {
            Valeur::Chaine(c) => ariane_geometrie::convention::band_offsets_valeur(champ(&entree, "capture"), c, champ(&entree, "delta"), champ(&entree, "options")),
            _ => Err(Echec::hors_domaine("side non chaîne")),
        },
        32 => jauge(&entree),
        // Blocs réservés aux sous-chantiers (fiche chantiers/CH-064-equipe.md) : un seul bras chacun.
        50..=99 => ariane_decision::appeler(fonction, &entree),
        100..=149 => ariane_etat::appeler(fonction, &entree),
        _ => Err(Echec::erreur(format!("Cœur : fonction inconnue {fonction}"))),
    };
    match r {
        Ok(v) => v,
        Err(Echec::Js { nom, message }) => Valeur::Erreur { nom: nom.into(), message },
        // La coquille lève alors ArianeCoeur.HorsDomaine ; la façade rappelle le JS d'origine.
        Err(Echec::HorsDomaine(raison)) => Valeur::Erreur { nom: "HorsDomaine".into(), message: raison },
    }
}

/// 2 : `{a: [nombres]}` → `[String(x), …]` (`ariane_js::nombre`).
fn nombres_en_chaines(e: &Valeur) -> Result<Valeur, Echec> {
    let Some(l) = e.champ("a").and_then(Valeur::elements) else { return Err(Echec::hors_domaine("a absent")) };
    Ok(Valeur::Tableau(l.into_iter().map(|v| match v {
        Valeur::Nombre(x) => Some(Valeur::Chaine(ariane_js::nombre::nombre_en_chaine(x))),
        _ => Some(Valeur::Indefini),
    }).collect()))
}

fn champ<'a>(v: &'a Valeur, k: &str) -> &'a Valeur { v.champ(k).unwrap_or(&Valeur::Indefini) }

/// 22 : GCV1 propose `{capture, side, options}` ; 23 : GCV1 proposeBoth `{capture, options}`.
/// Rend `{resultat, rappels}` : les appels de `lab.onCoarse` à rejouer par la façade, dans l'ordre.
fn gcv1(fonction: u32, e: &Valeur) -> Result<Valeur, Echec> {
    use ariane_geometrie::gcv1;
    let mut appels = vec![];
    let r = if fonction == 22 {
        let Valeur::Chaine(c) = champ(e, "side") else { return Err(Echec::hors_domaine("side non chaîne")) };
        gcv1::propose(champ(e, "capture"), c, champ(e, "options"), &mut appels)?
    } else {
        gcv1::propose_both(champ(e, "capture"), champ(e, "options"), &mut appels)?
    };
    let rappels = appels.into_iter().map(|a| Valeur::Objet(vec![
        ("cellules".into(), if a.cellules.is_empty() { Valeur::Tableau(vec![]) } else { Valeur::Nombres(a.cellules) }),
        ("meilleur".into(), Valeur::Nombres(a.meilleur.to_vec())),
        ("centres".into(), Valeur::Nombres(a.centres)),
        ("lab".into(), a.lab),
    ])).map(Some).collect();
    Ok(Valeur::Objet(vec![("resultat".into(), r), ("rappels".into(), Valeur::Tableau(rappels))]))
}

/// 32 : gauge.js (partie numérique), `{f, a}`.
fn jauge(e: &Valeur) -> Result<Valeur, Echec> {
    use ariane_geometrie::jauge as j;
    let a = e.champ("a").and_then(Valeur::elements).unwrap_or_default();
    let x = |i: usize| a.get(i).cloned().unwrap_or(Valeur::Indefini);
    match e.champ("f") {
        Some(Valeur::Chaine(f)) if f == "assessPair" => j::assess_pair(&x(0), &x(1)),
        Some(Valeur::Chaine(f)) if f == "gaugeMmOf" => j::gauge_mm_of(&x(0)).map(Valeur::Nombre),
        Some(Valeur::Chaine(f)) if f == "predictedGaugeMm" => j::predicted_gauge_mm(&x(0), &x(1)).map(Valeur::Nombre),
        Some(Valeur::Chaine(f)) if f == "classifyMm" => match x(0) { Valeur::Nombre(v) => Ok(Valeur::Chaine(j::classify_mm(v).into())), _ => Ok(Valeur::Chaine("INDETERMINATE".into())) },
        _ => Err(Echec::hors_domaine("jauge : fonction non portée")),
    }
}

/// 10 : capture-core, `{f: nom, a: [arguments]}`.
fn capture(e: &Valeur) -> Result<Valeur, Echec> {
    let f = match e.champ("f") { Some(Valeur::Chaine(s)) => s.as_str(), _ => return Err(Echec::hors_domaine("capture : f absent")) };
    let a = e.champ("a").and_then(Valeur::elements).ok_or_else(|| Echec::hors_domaine("capture : a absent"))?;
    ariane_capture::appeler(f, &a)
}

/// Point d'appel indépendant de la cible : trame VBA en entrée, trame VBA en sortie (WASM et programme natif).
#[must_use]
pub fn executer(fonction: u32, entree: &[u8]) -> Vec<u8> {
    let v = match decoder(entree) {
        Ok(v) => aiguiller(fonction, v),
        Err(e) => Valeur::Erreur { nom: "TypeError".into(), message: e.0 },
    };
    encoder(&v)
}

/// Exécute la fonction `fonction` du cœur sur la trame d'entrée ; rend la longueur de la trame de réponse, lisible à
/// [`vba_resultat`] jusqu'au prochain appel. La trame d'entrée est rendue ici.
///
/// # Safety
/// `p` vient de `vba_reserver(n)`, avec le même `n`, porte `n` octets écrits, et n'est plus utilisé par l'appelant.
#[no_mangle]
pub unsafe extern "C" fn vba_appel(fonction: u32, p: *mut u8, n: usize) -> usize {
    vba_liberer_resultat();
    // SÛRETÉ : `p` désigne `n` octets initialisés (contrat de l'appelant), lus avant d'être rendus.
    let sortie = executer(fonction, unsafe { std::slice::from_raw_parts(p, n) });
    // SÛRETÉ : même `p` et même `n` qu'à la réservation ; plus aucune référence vers l'entrée (`executer` a fini).
    unsafe { vba_liberer(p, n) };
    let d = disposition(sortie.len());
    // SÛRETÉ : taille non nulle ; l'allocation reçoit exactement `sortie.len()` octets, puis devient la réponse courante,
    // rendue par `vba_liberer_resultat`.
    let q = unsafe { alloc(d) };
    if q.is_null() { std::alloc::handle_alloc_error(d); }
    // SÛRETÉ : `q` vaut au moins `sortie.len()` octets, et les deux zones sont distinctes (allocation neuve).
    unsafe { std::ptr::copy_nonoverlapping(sortie.as_ptr(), q, sortie.len()) };
    RESULTAT.with(|r| r.set((q as usize, sortie.len())));
    sortie.len()
}
