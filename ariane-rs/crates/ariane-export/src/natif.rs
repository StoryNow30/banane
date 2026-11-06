//! Port de `src/native-export.js`. Restent en JS : `createInterner`, `compactCloud` et `foldRefs` avec un interneur reçu
//! (objet à méthodes, état partagé entre appels, `this.bytes`), `exportMode`, `MODES` (fonctions), `confirmerJalon`
//! (rend l'un des objets reçus, par identité). Les fonctions qui rendent des objets de l'entrée PAR IDENTITÉ (`alleger`,
//! `enteteMince`, `deltaMetadonnees`, `evenementsParReference`, `rehydraterEvenements`) rendent ici des indices ou des
//! clés : la façade remet les objets d'origine.
use crate::js::{self, ch, objet, prop, tab};
use ariane_js::nombre::nombre_en_chaine;
use ariane_js::Echec;
use ariane_vba::Valeur;
use std::collections::HashMap;

/// `FORMAT` du module.
pub const FORMAT: &str = "banane-native-session-v3-compact";
const REF: &str = "__ref";
const CHUNK: &str = "banane-native-lidar-chunk-v1";
const FORMES: [&str; 4] = ["rails", "views", "coords", "identities"];
const UNE_FOIS: [&str; 8] = ["events", "records", "state", "stateOmits", "closureSummary", "v1TimingExport", "diagnostic", "raisonSeries"];

fn hd<T>(m: &str) -> Result<T, Echec> { Err(Echec::hors_domaine(m)) }

/// `shapeOf(o)` pour un objet simple non tableau ; l'ordre de `SHAPES` compte.
fn forme_de(o: &Valeur) -> Option<usize> {
    let r = prop(o, "railLocalToSceneRelative");
    if js::est_tableau(r) && js::est_tableau(prop(o, "profileLocalToSceneRelative")) && js::est_tableau(prop(o, "sceneRelativeToProfileLocal")) { return Some(0); }
    if !matches!(prop(o, "viewEpochId"), Valeur::Indefini) && !matches!(prop(o, "camera"), Valeur::Indefini) { return Some(1); }
    if matches!(prop(o, "name"), Valeur::Chaine(s) if s == "scene-relative") && matches!(prop(o, "matrixLayout"), Valeur::Chaine(_)) { return Some(2); }
    if let Valeur::Objet(t) = o {
        if ["pageId", "part", "cut", "frameId"].iter().all(|k| js::possede(o, k)) && t.len() <= 8 { return Some(3); }
    }
    None
}

/// Tableau de points : premier élément tableau dont le premier élément est un nombre (court-circuit du JS).
fn tableau_de_points(v: &Valeur) -> bool {
    match v {
        Valeur::Bloc { .. } => true,
        Valeur::Tableau(t) => match t.first() {
            Some(Some(Valeur::Nombres(_))) => true,
            Some(Some(Valeur::Tableau(u))) => matches!(u.first(), Some(Some(Valeur::Nombre(_)))),
            _ => false,
        },
        _ => false,
    }
}

/// Interneur d'un document (celui de `compact`).
struct Interneur { store: [Vec<Valeur>; 4], index: [HashMap<String, usize>; 4] }
impl Interneur {
    fn new() -> Self { Interneur { store: Default::default(), index: Default::default() } }
    fn intern(&mut self, f: usize, v: &Valeur) -> Result<usize, Echec> {
        let Some(k) = js::stringify(v)? else { return hd("structure non sérialisable") };
        if let Some(&i) = self.index[f].get(&k) { return Ok(i); }
        let i = self.store[f].len();
        self.store[f].push(js::cloner(v));
        self.index[f].insert(k, i);
        Ok(i)
    }
}

fn cles_sures(t: &[(String, Valeur)]) -> Result<(), Echec> {
    if t.iter().any(|(k, _)| k == "__proto__") { return hd("clé __proto__"); }
    Ok(())
}

fn fold(v: &Valeur, it: &mut Interneur) -> Result<Valeur, Echec> {
    match v {
        Valeur::Tableau(t) => {
            if tableau_de_points(v) { return Ok(v.clone()); }
            Ok(Valeur::Tableau(t.iter().map(|e| e.as_ref().map(|x| fold(x, it)).transpose()).collect::<Result<_, _>>()?))
        }
        Valeur::Objet(t) => {
            if let Some(f) = forme_de(v) {
                let i = it.intern(f, v)?;
                return Ok(objet(vec![(REF, Valeur::Chaine(format!("{}:{i}", FORMES[f])))]));
            }
            cles_sures(t)?;
            Ok(Valeur::Objet(t.iter().map(|(k, x)| Ok((k.clone(), fold(x, it)?))).collect::<Result<_, Echec>>()?))
        }
        x => Ok(x.clone()),
    }
}

/// `Number(texte)` restreint aux écritures décimales entières canoniques (et « » qui vaut 0) ; sinon hors domaine.
fn indice_de(t: &str) -> Result<f64, Echec> {
    if t.is_empty() { return Ok(0.0); }
    if t.bytes().all(|b| b.is_ascii_digit()) && (t.len() == 1 || !t.starts_with('0')) && t.len() <= 15 {
        return t.parse::<f64>().map_err(|_| Echec::hors_domaine("indice"));
    }
    hd("indice de référence non canonique")
}

/// Élément `i` d'une table de dictionnaire (tableau ou objet), ou `undefined`.
fn element<'a>(table: &'a Valeur, i: f64, texte_i: &str) -> Result<&'a Valeur, Echec> {
    Ok(match table {
        Valeur::Tableau(t) => {
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)] // entier positif < 10^15 (indice_de)
            let n = i as usize;
            t.get(n).and_then(Option::as_ref).unwrap_or(&js::INDEFINI)
        }
        Valeur::Objet(_) => prop(table, texte_i),
        Valeur::Nombres(_) | Valeur::Bloc { .. } | Valeur::Booleens(_) => return hd("table de dictionnaire compacte"),
        Valeur::Chaine(s) if !s.is_empty() => return hd("table de dictionnaire chaîne"),
        _ => &js::INDEFINI,
    })
}

fn unfold(v: &Valeur, dico: &Valeur) -> Result<Valeur, Echec> {
    match v {
        Valeur::Tableau(t) => {
            if tableau_de_points(v) { return Ok(v.clone()); }
            Ok(Valeur::Tableau(t.iter().map(|e| e.as_ref().map(|x| unfold(x, dico)).transpose()).collect::<Result<_, _>>()?))
        }
        Valeur::Objet(t) => {
            if let Valeur::Chaine(r) = prop(v, REF) {
                // lastIndexOf(':') ; absent : slice(0, -1) et slice(0)
                let (nom, reste) = match r.rfind(':') {
                    Some(p) => (r[..p].to_owned(), r[p + 1..].to_owned()),
                    None => (js::tranche_utf16(r, 0, js::longueur_utf16(r).saturating_sub(1)).ok_or_else(|| Echec::hors_domaine("coupe UTF-16"))?, r.clone()),
                };
                let i = indice_de(&reste)?;
                let table = match dico {
                    Valeur::Objet(_) => prop(dico, &nom),
                    Valeur::Indefini | Valeur::Nul => return hd("dictionnaires nuls (TypeError en JS)"),
                    x if !x.vrai() => &js::INDEFINI,
                    _ => return hd("dictionnaires non objet"),
                };
                let x = if table.vrai() { element(table, i, &nombre_en_chaine(i))? } else { &js::INDEFINI };
                if !table.vrai() || !x.vrai() { return Err(Echec::erreur(format!("Référence de dictionnaire introuvable : {r}"))); }
                return Ok(js::cloner(x));
            }
            cles_sures(t)?;
            Ok(Valeur::Objet(t.iter().map(|(k, x)| Ok((k.clone(), unfold(x, dico)?))).collect::<Result<_, Echec>>()?))
        }
        x => Ok(x.clone()),
    }
}

/// Coordonnée lue par la projection : `ToNumber` des types simples ; texte et objets hors domaine.
fn coordonnee(v: Option<&Valeur>) -> Result<f64, Echec> {
    Ok(match v {
        None | Some(Valeur::Indefini) => f64::NAN,
        Some(Valeur::Nul) => 0.0,
        Some(Valeur::Booleen(b)) => f64::from(u8::from(*b)),
        Some(Valeur::Nombre(x)) => *x,
        _ => return hd("coordonnée non numérique"),
    })
}

fn vecteur(v: &Valeur, n: usize) -> Result<Vec<f64>, Echec> {
    match v {
        Valeur::Nombres(t) => Ok((0..n).map(|i| t.get(i).copied().unwrap_or(f64::NAN)).collect()),
        Valeur::Tableau(t) => (0..n).map(|i| coordonnee(t.get(i).and_then(Option::as_ref))).collect(),
        Valeur::Nombre(_) | Valeur::Booleen(_) => Ok(vec![f64::NAN; n]),
        _ => hd("matrice ou point de forme non portée"),
    }
}

fn projeter(mm: &mut Option<[f64; 16]>, m: &Valeur, x: f64, y: f64, z: f64) -> Result<[f64; 3], Echec> {
    if mm.is_none() {
        let mv = vecteur(m, 16)?;
        let mut t = [0.0f64; 16];
        t.copy_from_slice(&mv);
        *mm = Some(t);
    }
    let Some(t) = mm.as_ref() else { return hd("matrice") };
    ariane_capture::point(t, x, y, z)
}

fn restore(c: Valeur) -> Result<Valeur, Echec> {
    if js::est_nul(&c) { return hd("nuage nul"); }
    let d = prop(&c, "droppedDerivedFields");
    if !js::est_tableau(d) || js::longueur(d) == 0 { return Ok(c); }
    let dropped = js::elements(d).unwrap_or_default();
    if !matches!(c, Valeur::Objet(_)) { return Ok(c); }
    let Valeur::Objet(mut out) = c else { return hd("objet attendu") };
    js::retirer(&mut out, "droppedDerivedFields");
    let a = |s: &str| dropped.iter().any(|x| matches!(x, Valeur::Chaine(c) if c == s));
    if a("pointsProfileLocal") {
        let o = Valeur::Objet(out);
        let rail = prop(&o, "rail");
        let m = if rail.vrai() { prop(rail, "sceneRelativeToProfileLocal") } else { rail };
        let pts = prop(&o, "pointsSceneRelative");
        let mut mm = None;
        let v = if m.vrai() && js::est_tableau(pts) {
            match pts {
                Valeur::Bloc { k, donnees } => {
                    let k = usize::from(*k);
                    let mut r = Vec::with_capacity(donnees.len() / k * 3);
                    for l in donnees.chunks_exact(k) {
                        let g = |i: usize| l.get(i).copied().unwrap_or(f64::NAN);
                        r.extend_from_slice(&projeter(&mut mm, m, g(0), g(1), g(2))?);
                    }
                    Valeur::Bloc { k: 3, donnees: r }
                }
                Valeur::Tableau(t) => {
                    let mut r = Vec::with_capacity(t.len());
                    for p in t {
                        r.push(match p {
                            None => None,
                            Some(p) if js::est_tableau(p) && !matches!(p, Valeur::Bloc { .. }) => {
                                let q = vecteur(p, 3)?;
                                Some(Valeur::Nombres(projeter(&mut mm, m, q[0], q[1], q[2])?.to_vec()))
                            }
                            Some(_) => return hd("point de forme non portée"),
                        });
                    }
                    Valeur::Tableau(r)
                }
                _ => return hd("points de forme non portée"),
            }
        } else { Valeur::Tableau(vec![]) };
        let Valeur::Objet(o) = o else { return hd("objet attendu") };
        out = o;
        js::poser(&mut out, "pointsProfileLocal", v);
    }
    if a("pointSources") { js::poser(&mut out, "pointSources", Valeur::Nul); }
    Ok(Valeur::Objet(out))
}

fn expand_cloud(c: &Valeur, dico: &Valeur) -> Result<Valeur, Echec> { restore(unfold(c, dico)?) }

fn options_suppr(options: &Valeur, k: &str) -> bool { !matches!(prop(options, k), Valeur::Booleen(false)) }

fn strip(c: &Valeur, options: &Valeur) -> Result<Valeur, Echec> {
    if js::est_nul(c) { return hd("nuage nul"); }
    if !matches!(prop(c, "format"), Valeur::Chaine(s) if s == CHUNK) { return Ok(c.clone()); }
    let Valeur::Objet(t) = c else { return Ok(c.clone()) };
    let mut dropped = vec![];
    let mut out = Vec::with_capacity(t.len());
    for (k, x) in t {
        if (k == "pointsProfileLocal" && options_suppr(options, "dropProfileLocal")) || (k == "pointSources" && options_suppr(options, "dropPointSources")) {
            dropped.push(ch(k));
            continue;
        }
        out.push((k.clone(), x.clone()));
    }
    if !dropped.is_empty() { js::poser(&mut out, "droppedDerivedFields", tab(dropped)); }
    Ok(Valeur::Objet(out))
}

/// 210 : `compact(doc, options)` sur `{doc, options}`.
///
/// # Errors
/// `HorsDomaine` : document non objet, `clouds` non tableau, nuage nul, clé `__proto__`.
pub fn compact(e: &Valeur) -> Result<Valeur, Echec> {
    let doc = prop(e, "doc");
    let o = prop(e, "options");
    let vide = Valeur::Objet(vec![]);
    let opt = if o.vrai() { o } else { &vide };
    let Valeur::Objet(d) = doc else { return hd("document non objet") };
    let mut it = Interneur::new();
    let rest = Valeur::Objet(d.iter().filter(|(k, _)| k != "clouds").cloned().collect());
    let meta = fold(&rest, &mut it)?;
    let clouds = prop(doc, "clouds");
    let packed = match clouds {
        x if !x.vrai() => Valeur::Tableau(vec![]),
        Valeur::Tableau(t) => Valeur::Tableau(t.iter().map(|c| c.as_ref().map(|c| fold(&strip(c, opt)?, &mut it)).transpose()).collect::<Result<_, _>>()?),
        _ => return hd("clouds non tableau d'objets"),
    };
    let Valeur::Objet(mut out) = meta else { return hd("méta non objet") };
    let f = prop(doc, "format");
    js::poser(&mut out, "format", ch(FORMAT));
    js::poser(&mut out, "compactedFrom", if f.vrai() { f.clone() } else { Valeur::Nul });
    let mut dropped = vec![];
    if options_suppr(opt, "dropProfileLocal") { dropped.push(ch("pointsProfileLocal")); }
    if options_suppr(opt, "dropPointSources") { dropped.push(ch("pointSources")); }
    let tailles = Valeur::Objet(FORMES.iter().zip(it.store.iter()).map(|(n, s)| ((*n).to_owned(), Valeur::Nombre(s.len() as f64))).collect());
    js::poser(&mut out, "compaction", objet(vec![("tool", ch("native-export.js")), ("droppedDerivedFields", tab(dropped)), ("dictionarySizes", tailles),
        ("note", ch("Aucune valeur modifiée. pointsProfileLocal est recalculable exactement par sceneRelativeToProfileLocal x pointsSceneRelative ; pointSources est un diagnostic."))]));
    js::poser(&mut out, "clouds", packed);
    let [a, b, c, d] = it.store;
    js::poser(&mut out, "dictionaries", objet(vec![("rails", Valeur::Tableau(a.into_iter().map(Some).collect())), ("views", Valeur::Tableau(b.into_iter().map(Some).collect())),
        ("coords", Valeur::Tableau(c.into_iter().map(Some).collect())), ("identities", Valeur::Tableau(d.into_iter().map(Some).collect()))]));
    Ok(Valeur::Objet(out))
}

/// `(seg.index || 0) >= 2`, `t.cloudObjects > t.segmentObjects` : nombres ou booléens seulement.
fn en_nombre(v: &Valeur) -> Result<f64, Echec> {
    match v { Valeur::Nombre(x) => Ok(*x), Valeur::Booleen(b) => Ok(f64::from(u8::from(*b))), Valeur::Nul => Ok(0.0), _ => hd("comparaison non numérique") }
}

/// `misfiledHead(doc)`.
///
/// # Errors
/// `HorsDomaine` pour une comparaison sur des types non numériques.
pub fn misfiled_head(doc: &Valeur) -> Result<bool, Echec> {
    let seg = if doc.vrai() { prop(doc, "segment") } else { doc };
    let t = if doc.vrai() { prop(doc, "exportTrace") } else { doc };
    let clouds = prop(doc, "clouds");
    let longueur_vraie = match clouds {
        x if !x.vrai() => false,
        x if js::est_tableau(x) => js::longueur(x) > 0,
        Valeur::Chaine(_) => true,
        Valeur::Objet(_) => prop(clouds, "length").vrai(),
        _ => false,
    };
    if !seg.vrai() || matches!(prop(seg, "selfContained"), Valeur::Booleen(true)) || !matches!(prop(doc, "format"), Valeur::Chaine(s) if s == FORMAT) || !longueur_vraie { return Ok(false); }
    let fini = |v: &Valeur| matches!(v, Valeur::Nombre(x) if x.is_finite());
    if !t.vrai() || !fini(prop(t, "cloudObjects")) || !fini(prop(t, "segmentObjects")) {
        let i = prop(seg, "index");
        return Ok(if i.vrai() { en_nombre(i)? } else { 0.0 } >= 2.0);
    }
    Ok(en_nombre(prop(t, "cloudObjects"))? > en_nombre(prop(t, "segmentObjects"))?)
}

/// 214 : `misfiledHead(doc)` sur `{doc}`.
///
/// # Errors
/// Voir [`misfiled_head`].
pub fn misfiled(e: &Valeur) -> Result<Valeur, Echec> { Ok(Valeur::Booleen(misfiled_head(prop(e, "doc"))?)) }

/// 211 : `expand(doc, options)` sur `{doc, options}` (un document d'un autre format est rendu tel quel).
///
/// # Errors
/// `HorsDomaine` : document ou méta non objet, `clouds` non tableau, nuage nul ; `Error` du JS sur une référence absente.
pub fn expand(e: &Valeur) -> Result<Valeur, Echec> {
    let doc = prop(e, "doc");
    let options = prop(e, "options");
    if js::est_nul(doc) { return hd("document nul"); }
    if !matches!(prop(doc, "format"), Valeur::Chaine(s) if s == FORMAT) { return Ok(doc.clone()); }
    let Valeur::Objet(d) = doc else { return hd("document non objet") };
    let dd = prop(doc, "dictionaries");
    let vide = Valeur::Objet(vec![]);
    let dico = if dd.vrai() { dd } else { &vide };
    let previous = if options.vrai() { prop(options, "previousDictionaries") } else { options };
    let rest = Valeur::Objet(d.iter().filter(|(k, _)| !matches!(k.as_str(), "clouds" | "dictionaries" | "compaction" | "compactedFrom")).cloned().collect());
    let Valeur::Objet(mut meta) = unfold(&rest, dico)? else { return hd("méta non objet") };
    let cf = prop(doc, "compactedFrom");
    js::poser(&mut meta, "format", if cf.vrai() { cf.clone() } else { ch("banane-native-session-v2") });
    let clouds = prop(doc, "clouds");
    let liste: &[Option<Valeur>] = match clouds { Valeur::Tableau(t) => t, x if !x.vrai() => &[], _ => return hd("clouds non tableau") };
    let mut list = liste;
    let mut head = vec![];
    let mut repair = None;
    if misfiled_head(doc)? {
        if previous.vrai() {
            head.push(Some(expand_cloud(list.first().and_then(Option::as_ref).unwrap_or(&js::INDEFINI), previous)?));
            repair = Some(objet(vec![("issue", ch("KI-060")), ("action", ch("reread")), ("note", ch("premier nuage relu avec le dictionnaire du segment précédent"))]));
        } else {
            repair = Some(objet(vec![("issue", ch("KI-060")), ("action", ch("dropped")), ("note", ch("premier nuage retiré : ses références visent le dictionnaire du segment précédent, absent"))]));
        }
        list = list.get(1..).unwrap_or(&[]);
    }
    if let Some(r) = repair { js::poser(&mut meta, "segmentRepair", r); }
    // `[...head, ...list.map(...)]` : l'étalement change les trous en undefined
    for c in list { head.push(Some(match c { Some(c) => expand_cloud(c, dico)?, None => Valeur::Indefini })); }
    js::poser(&mut meta, "clouds", Valeur::Tableau(head));
    Ok(Valeur::Objet(meta))
}

/// 212 : `expandCloud(cloud, dictionaries)` sur `{cloud, dictionaries}`.
///
/// # Errors
/// Comme [`expand`].
pub fn expand_cloud_appel(e: &Valeur) -> Result<Valeur, Echec> { expand_cloud(prop(e, "cloud"), prop(e, "dictionaries")) }

/// 213 : `unfoldRefs(value, dictionaries)` sur `{value, dictionaries}`.
///
/// # Errors
/// Comme [`expand`].
pub fn unfold_refs(e: &Valeur) -> Result<Valeur, Echec> { unfold(prop(e, "value"), prop(e, "dictionaries")) }

/// `vrai(v)` du mode « allege ».
fn vrai_sonde(v: &Valeur) -> bool {
    match v {
        Valeur::Booleen(true) => true,
        Valeur::Objet(t) => t.iter().any(|(_, x)| matches!(x, Valeur::Booleen(true))),
        Valeur::Tableau(t) => t.iter().any(|x| matches!(x, Some(Valeur::Booleen(true)))),
        Valeur::Booleens(t) => t.iter().any(|&b| b),
        _ => false,
    }
}

fn touche_la_zone(n: &Valeur) -> bool {
    match prop(n, "probes") {
        Valeur::Tableau(t) => t.iter().flatten().any(|p| p.vrai() && js::est_objet(p) && (vrai_sonde(prop(p, "roiHit")) || vrai_sonde(prop(p, "hierarchyRoiHit")))),
        _ => false, // tableaux de primitives ou de lignes : aucune sonde objet
    }
}

/// 215 : `alleger(cloud)` sur `{cloud}` (ou `{cloud: {nodes}}`) : rend les indices des nœuds dont les sondes sont retirées
/// (vide : le JS rend le nuage tel quel) ; la façade bâtit le nuage allégé avec les objets d'origine.
///
/// # Errors
/// Jamais (signature commune).
pub fn alleger(e: &Valeur) -> Result<Valeur, Echec> {
    let c = prop(e, "cloud");
    let nodes = prop(c, "nodes");
    let mut r = vec![];
    if c.vrai() && js::est_objet(c) {
        if let Valeur::Tableau(t) = nodes {
            for (i, n) in t.iter().enumerate() {
                let Some(n) = n else { continue };
                let vide_sans_zone = n.vrai() && js::est_objet(n) && js::possede(n, "probes") && matches!(prop(n, "retained"), Valeur::Nombre(x) if js::egal_f(*x, 0.0)) && !touche_la_zone(n);
                if !vide_sans_zone { continue; }
                r.push(i as f64);
            }
        }
    }
    Ok(if r.is_empty() { Valeur::Tableau(vec![]) } else { Valeur::Nombres(r) })
}

/// 216 : `enteteMince(metadata)` sur `{metadata}` : rend `{cles, vides}`, les clés gardées telles quelles et celles
/// remplacées par `[]`, dans l'ordre ; la façade remet les valeurs d'origine.
///
/// # Errors
/// `HorsDomaine` si `metadata` n'est pas un objet simple.
pub fn entete_mince(e: &Valeur) -> Result<Valeur, Echec> {
    let Valeur::Objet(t) = prop(e, "metadata") else { return hd("métadonnées non objet") };
    let mut cles = vec![];
    let mut vides = vec![];
    for (k, x) in t {
        if !UNE_FOIS.contains(&k.as_str()) { cles.push(ch(k)); vides.push(false); } else if js::est_tableau(x) { cles.push(ch(k)); vides.push(true); }
    }
    Ok(objet(vec![("cles", tab(cles)), ("vides", if vides.is_empty() { Valeur::Tableau(vec![]) } else { Valeur::Booleens(vides) })]))
}

// ------------------------------------------------------------------------------------------- empreintes (CH-049-C)

fn base36(mut n: u64) -> String {
    const C: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if n == 0 { return "0".into(); }
    let mut v = vec![];
    while n > 0 { v.push(C[(n % 36) as usize]); n /= 36; }
    v.reverse();
    String::from_utf8(v).unwrap_or_default()
}

/// `empreinte(s)` (cyrb53 à trois états) sur les unités UTF-16 de `s`.
#[must_use]
pub fn empreinte(s: &str) -> String {
    let (mut h1, mut h2, mut h3): (u32, u32, u32) = (0xdead_beef, 0x41c6_ce57, 0x9e37_79b1);
    let mut n = 0usize;
    for c in s.encode_utf16() {
        let c = u32::from(c);
        h1 = (h1 ^ c).wrapping_mul(2_654_435_761);
        h2 = (h2 ^ c).wrapping_mul(1_597_334_677);
        h3 = (h3 ^ c).wrapping_mul(2_246_822_519);
        n += 1;
    }
    h1 = (h1 ^ (h1 >> 16)).wrapping_mul(2_246_822_507) ^ (h2 ^ (h2 >> 13)).wrapping_mul(3_266_489_909);
    h2 = (h2 ^ (h2 >> 16)).wrapping_mul(2_246_822_507) ^ (h1 ^ (h1 >> 13)).wrapping_mul(3_266_489_909);
    let v = 4_294_967_296u64 * u64::from(2_097_151 & h2) + u64::from(h1);
    format!("{}.{}.{n}", base36(v), base36(u64::from(h3)))
}

fn empreinte_json(v: &Valeur) -> Result<String, Echec> {
    match js::stringify(v)? { Some(s) => Ok(empreinte(&s)), None => hd("empreinte de undefined (TypeError en JS)") }
}

/// Clé d'une liste du delta (`cleEvenement`, `cleVisite`) : `None` pour null/undefined.
fn cle_evenement(e: &Valeur) -> Result<Option<Valeur>, Echec> {
    if !e.vrai() { return Ok(if js::est_nul(e) { None } else { Some(e.clone()) }); }
    let id = prop(e, "eventId");
    if id.vrai() { return Ok(Some(id.clone())); }
    let s = prop(e, "eventSeq");
    if !js::est_nul(s) { return Ok(Some(Valeur::Chaine(format!("seq:{}", js::en_chaine(s)?)))); }
    Ok(None)
}
fn cle_visite(r: &Valeur) -> Option<Valeur> {
    if !r.vrai() { return if js::est_nul(r) { None } else { Some(r.clone()) }; }
    let v = js::ou_vrai(prop(r, "recordId"), prop(r, "id"));
    if v.vrai() { Some(v.clone()) } else { None }
}

/// `deltaListe(liste, cle, avant)` : indices gardés, et le jalon suivant (clés et empreintes, ordre d'une `Map`).
/// Indices gardés, puis clés et empreintes du jalon suivant.
type Delta = (Vec<f64>, Vec<Valeur>, Vec<Valeur>);

fn delta_liste(liste: &Valeur, evenements: bool, avant: Option<&HashMap<crate::cache::CleSet, String>>) -> Result<Delta, Echec> {
    let l = match liste { x if !x.vrai() => vec![], x if js::est_tableau(x) => js::elements(x).unwrap_or_default(), _ => return hd("liste non tableau") };
    let mut gardes = vec![];
    let mut ordre: Vec<(crate::cache::CleSet, Valeur, String)> = vec![];
    let mut pos: HashMap<crate::cache::CleSet, usize> = HashMap::new();
    for (i, x) in l.iter().enumerate() {
        let k = if evenements { cle_evenement(x)? } else { cle_visite(x) };
        let Some(k) = k else { gardes.push(i as f64); continue };
        let h = empreinte_json(x)?;
        let c = crate::cache::cle_set(&k)?;
        if avant.is_none_or(|a| a.get(&c) != Some(&h)) { gardes.push(i as f64); }
        if let Some(&p) = pos.get(&c) { ordre[p].2.clone_from(&h); } else { pos.insert(c.clone(), ordre.len()); ordre.push((c, k, h)); }
    }
    let (cles, emp) = ordre.into_iter().map(|(_, k, h)| (k, Valeur::Chaine(h))).unzip();
    Ok((gardes, cles, emp))
}

fn jalon_map(v: &Valeur) -> Result<HashMap<crate::cache::CleSet, String>, Echec> {
    let cles = js::elements(prop(v, "cles")).ok_or_else(|| Echec::hors_domaine("jalon : cles"))?;
    let emp = js::elements(prop(v, "empreintes")).ok_or_else(|| Echec::hors_domaine("jalon : empreintes"))?;
    let mut m = HashMap::new();
    for (k, h) in cles.iter().zip(emp.iter()) {
        let Valeur::Chaine(h) = h else { return hd("empreinte non chaîne (la Map ne la compare pas ainsi)") };
        m.insert(crate::cache::cle_set(k)?, h.clone());
    }
    Ok(m)
}

fn nombres(v: Vec<f64>) -> Valeur { if v.is_empty() { Valeur::Tableau(vec![]) } else { Valeur::Nombres(v) } }

/// 217 : `deltaMetadonnees(doc, jalon)`. Entrée `{session, events, records, jalon}` où `session` vaut `doc.session`, et
/// `jalon` est `null`/absent ou `{version, session, events: {cles, empreintes}, records: {cles, empreintes}}` (les `Map`
/// du JS, en entrées). Rend `{valide, sessionId, events: {gardes, cles, empreintes}, records: {…}}`.
///
/// # Errors
/// `HorsDomaine` : listes non tableaux, clés objets, empreinte de `undefined`.
pub fn delta_metadonnees(e: &Valeur) -> Result<Valeur, Echec> {
    let s = prop(e, "session");
    let session = if s.vrai() { prop(s, "id") } else { s };
    let j = prop(e, "jalon");
    let valide = j.vrai() && matches!(prop(j, "version"), Valeur::Nombre(x) if js::egal_f(*x, 1.0)) && !matches!(session, Valeur::Indefini)
        && js::strict_egal(prop(j, "session"), session)?;
    let (ae, ar) = if valide { (Some(jalon_map(prop(j, "events"))?), Some(jalon_map(prop(j, "records"))?)) } else { (None, None) };
    let (g1, c1, h1) = delta_liste(prop(e, "events"), true, ae.as_ref())?;
    let (g2, c2, h2) = delta_liste(prop(e, "records"), false, ar.as_ref())?;
    let part = |g, c, h| objet(vec![("gardes", nombres(g)), ("cles", tab(c)), ("empreintes", tab(h))]);
    Ok(objet(vec![("valide", Valeur::Booleen(valide)), ("sessionId", if matches!(session, Valeur::Indefini) { Valeur::Nul } else { session.clone() }),
        ("events", part(g1, c1, h1)), ("records", part(g2, c2, h2))]))
}

fn signature_liste(textes: &[String]) -> String {
    let mut h = String::from("liste");
    for t in textes { h.push_str(&empreinte(t)); h = empreinte(&h); }
    h
}

fn textes(l: &[Valeur]) -> Result<Vec<String>, Echec> {
    l.iter().map(|x| js::stringify(x)?.ok_or_else(|| Echec::hors_domaine("empreinte de undefined (TypeError en JS)"))).collect()
}

/// 218 : `evenementsParReference(evenements, reference, options)` : rend `null` ou `{total, longueurJournal, signature,
/// positions}` ; la façade bâtit `ajouts` (`{position, evenement}`, l'événement d'origine) et `reference: 'journal'`.
///
/// # Errors
/// `HorsDomaine` : listes non tableaux, `partMaxAjouts` non numérique, événement `undefined` du journal.
pub fn evenements_par_reference(e: &Valeur) -> Result<Valeur, Echec> {
    let (ev, re) = (prop(e, "evenements"), prop(e, "reference"));
    if !js::est_tableau(ev) || !js::est_tableau(re) { return hd("listes non tableaux"); }
    let (ev, re) = (js::elements(ev).unwrap_or_default(), js::elements(re).unwrap_or_default());
    let o = prop(e, "options");
    let part = if o.vrai() { prop(o, "partMaxAjouts") } else { o };
    let p = match part { x if !x.vrai() => 0.01, Valeur::Nombre(x) => *x, _ => return hd("partMaxAjouts non numérique") };
    let plafond = ariane_js::max(16.0, (re.len() as f64 * p).floor());
    let tr: Vec<Option<String>> = re.iter().map(js::stringify).collect::<Result<_, _>>()?;
    let mut positions = vec![];
    let mut j = 0usize;
    for (i, x) in ev.iter().enumerate() {
        if j < re.len() && js::stringify(x)? == tr[j] { j += 1; continue; }
        positions.push(i as f64);
        if positions.len() as f64 > plafond { return Ok(Valeur::Nul); }
    }
    if j != re.len() { return Ok(Valeur::Nul); }
    let tr: Vec<String> = tr.into_iter().collect::<Option<_>>().ok_or_else(|| Echec::hors_domaine("empreinte de undefined (TypeError en JS)"))?;
    Ok(objet(vec![("total", Valeur::Nombre(ev.len() as f64)), ("longueurJournal", Valeur::Nombre(re.len() as f64)),
        ("signature", Valeur::Chaine(signature_liste(&tr))), ("positions", nombres(positions))]))
}

/// 219 : `rehydraterEvenements(ref, reference)` : rend la suite des sources, `j ≥ 0` pour `reference[j]`, `−(a+1)` pour
/// `ref.ajouts[a].evenement` ; la façade remet les objets d'origine. Lève les deux `Error` du JS.
///
/// # Errors
/// `Error` du JS (autre journal) ; `HorsDomaine` pour des formes que le JS lirait par coercition.
pub fn rehydrater(e: &Valeur) -> Result<Valeur, Echec> {
    let (r, re) = (prop(e, "ref"), prop(e, "reference"));
    if !js::est_tableau(re) { return hd("journal non tableau"); }
    let re = js::elements(re).unwrap_or_default();
    if !r.vrai() || !js::strict_egal(&Valeur::Nombre(re.len() as f64), prop(r, "longueurJournal"))? {
        return Err(Echec::erreur("Ce n’est pas le journal de cet export (taille différente) : le bilan ne peut pas être reconstruit."));
    }
    let sig = signature_liste(&textes(&re)?);
    if !matches!(prop(r, "signature"), Valeur::Chaine(s) if *s == sig) {
        return Err(Echec::erreur("Ce n’est pas le journal de cet export (contenu différent) : le bilan ne peut pas être reconstruit."));
    }
    let aj = prop(r, "ajouts");
    if !js::est_tableau(aj) { return hd("ajouts non tableau"); }
    let aj = js::elements(aj).unwrap_or_default();
    let total = match prop(r, "total") { Valeur::Nombre(x) if *x <= 1e8 => *x, Valeur::Nombre(_) => return hd("total démesuré"), Valeur::Indefini => f64::NAN, _ => return hd("total non numérique") };
    let mut out = vec![];
    let (mut a, mut j) = (0usize, 0usize);
    let mut i = 0usize;
    while (i as f64) < total {
        let pris = if a < aj.len() {
            if js::est_nul(&aj[a]) { return hd("ajout nul"); }
            matches!(prop(&aj[a], "position"), Valeur::Nombre(p) if js::egal_f(*p, i as f64))
        } else { false };
        if pris { a += 1; out.push(-(a as f64)); } else { out.push(j as f64); j += 1; }
        i += 1;
    }
    Ok(nombres(out))
}

#[cfg(test)]
mod essais {
    use super::*;
    fn n(x: f64) -> Valeur { Valeur::Nombre(x) }
    fn rail() -> Valeur {
        let id: Vec<f64> = vec![1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 5., 0., 0., 1.];
        objet(vec![("railLocalToSceneRelative", Valeur::Nombres(id.clone())), ("profileLocalToSceneRelative", Valeur::Nombres(id.clone())), ("sceneRelativeToProfileLocal", Valeur::Nombres(id))])
    }
    fn chunk() -> Valeur {
        objet(vec![("format", ch(CHUNK)), ("rail", rail()), ("pointsSceneRelative", Valeur::Bloc { k: 3, donnees: vec![1., 2., 3.] }),
            ("pointsProfileLocal", Valeur::Bloc { k: 3, donnees: vec![6., 2., 3.] }), ("pointSources", js::tab(vec![n(1.)]))])
    }
    #[test]
    fn compact_puis_expand() {
        let doc = objet(vec![("format", ch("banane-native-session-v2")), ("rails", js::tab(vec![rail(), rail()])), ("clouds", js::tab(vec![chunk(), chunk()]))]);
        let c = compact(&objet(vec![("doc", doc)])).unwrap();
        assert_eq!(prop(prop(prop(&c, "compaction"), "dictionarySizes"), "rails"), &n(1.0));
        assert_eq!(prop(&c, "format"), &ch(FORMAT));
        let x = expand(&objet(vec![("doc", c.clone())])).unwrap();
        assert_eq!(prop(&x, "format"), &ch("banane-native-session-v2"));
        let c0 = js::elements(prop(&x, "clouds")).unwrap().remove(0);
        assert_eq!(prop(&c0, "pointsProfileLocal"), &Valeur::Bloc { k: 3, donnees: vec![6., 2., 3.] });
        assert_eq!(prop(&c0, "pointSources"), &Valeur::Nul);
        assert_eq!(misfiled(&objet(vec![("doc", c)])).unwrap(), Valeur::Booleen(false));
        let u = unfold_refs(&objet(vec![("value", objet(vec![(REF, ch("rails:3"))])), ("dictionaries", objet(vec![]))]));
        assert_eq!(u, Err(Echec::erreur("Référence de dictionnaire introuvable : rails:3")));
        assert!(expand_cloud_appel(&objet(vec![("cloud", Valeur::Nul)])).is_err());
    }
    #[test]
    fn allegement_et_entete() {
        let noeud = |r: f64, hit: bool| objet(vec![("retained", n(r)), ("probes", js::tab(vec![objet(vec![("roiHit", Valeur::Booleen(hit))])]))]);
        let c = objet(vec![("nodes", js::tab(vec![noeud(0., false), noeud(1., false), noeud(0., true)]))]);
        assert_eq!(alleger(&objet(vec![("cloud", c)])).unwrap(), Valeur::Nombres(vec![0.0]));
        let m = objet(vec![("a", n(1.)), ("events", js::tab(vec![])), ("state", objet(vec![]))]);
        assert_eq!(entete_mince(&objet(vec![("metadata", m)])).unwrap(), objet(vec![("cles", js::tab(vec![ch("a"), ch("events")])), ("vides", Valeur::Booleens(vec![false, true]))]));
    }
    #[test]
    fn empreintes_et_delta() {
        assert_eq!(base36(0), "0");
        assert_eq!(base36(35), "z");
        let ev = js::tab(vec![objet(vec![("eventId", ch("a"))]), objet(vec![("eventSeq", n(3.))]), Valeur::Nul]);
        let r = delta_metadonnees(&objet(vec![("session", objet(vec![("id", ch("S"))])), ("events", ev.clone()), ("records", Valeur::Indefini)])).unwrap();
        assert_eq!(prop(prop(&r, "events"), "gardes"), &Valeur::Nombres(vec![0., 1., 2.]));
        let ev2 = prop(&r, "events").clone();
        let j = objet(vec![("version", n(1.)), ("session", ch("S")), ("events", ev2), ("records", objet(vec![("cles", js::tab(vec![])), ("empreintes", js::tab(vec![]))]))]);
        let r2 = delta_metadonnees(&objet(vec![("session", objet(vec![("id", ch("S"))])), ("events", ev), ("records", Valeur::Indefini), ("jalon", j)])).unwrap();
        assert_eq!(prop(prop(&r2, "events"), "gardes"), &Valeur::Nombres(vec![2.]));
        assert_eq!(prop(&r2, "valide"), &Valeur::Booleen(true));
    }
    #[test]
    fn par_reference() {
        let a = |s: &str| objet(vec![("x", ch(s))]);
        let refe = js::tab(vec![a("1"), a("2")]);
        let r = evenements_par_reference(&objet(vec![("evenements", js::tab(vec![a("1"), a("n"), a("2")])), ("reference", refe.clone())])).unwrap();
        assert_eq!(prop(&r, "positions"), &Valeur::Nombres(vec![1.0]));
        let rf = objet(vec![("longueurJournal", n(2.)), ("signature", prop(&r, "signature").clone()), ("total", n(3.)), ("ajouts", js::tab(vec![objet(vec![("position", n(1.))])]))]);
        assert_eq!(rehydrater(&objet(vec![("ref", rf), ("reference", refe.clone())])).unwrap(), Valeur::Nombres(vec![0., -1., 1.]));
        assert!(matches!(rehydrater(&objet(vec![("ref", Valeur::Nul), ("reference", refe)])), Err(Echec::Js { .. })));
    }
}
