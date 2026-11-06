//! Port de `src/phase-pli.js` (repli des jalons `phase-timing` par visite). Les événements rendus TELS QUELS par le JS
//! (non repliés, ou d'un groupe illisible) le sont ici par leur indice : la façade remet l'objet d'origine.
//! Sortie de `plier`/`deplier` : `{sources, nouveaux, …}`, `sources[i] ≥ 0` : l'événement d'entrée de cet indice,
//! `sources[i] = −(k+1)` : `nouveaux[k]`.
use crate::date;
use crate::js::{self, ch, objet, prop};
use ariane_js::nombre::nombre_en_chaine;
use ariane_js::Echec;
use ariane_vba::Valeur;
use std::collections::HashMap;

const TYPE: &str = "phase-timing-pli";
const TYPE_FORMES: &str = "phase-timing-pli-formes";
const ENTETE: [&str; 6] = ["schema", "clockId", "timeOrigin", "sessionId", "batchId", "visitId"];
const CTX: [&str; 5] = ["identity", "captureId", "analysisId", "proposalId", "selector"];
const LIGNE: [&str; 4] = ["seq", "batchSeq", "ms", "kind"];
const PERDUES: [&str; 3] = ["eventId", "timestamp", "type"];
const MARQUE_REF: char = '§';
const MARQUE_MS: &str = "=";

/// Champs d'un objet simple, dans l'ordre JS.
type Champs = Vec<(String, Valeur)>;

fn hd<T>(m: &str) -> Result<T, Echec> { Err(Echec::hors_domaine(m)) }
/// Exception levée par le JS dans un bloc `try` (le groupe est alors laissé tel quel) : distincte du hors-domaine.
struct Leve;
type R<T> = Result<Result<T, Leve>, Echec>;

fn fini(v: &Valeur) -> bool { matches!(v, Valeur::Nombre(x) if x.is_finite()) }
fn entier(v: &Valeur) -> bool { matches!(v, Valeur::Nombre(x) if js::est_entier(*x)) }
fn texte(v: &Valeur) -> bool { matches!(v, Valeur::Chaine(_)) }
fn est(v: &Valeur, s: &str) -> bool { matches!(v, Valeur::Chaine(c) if c == s) }

/// `UUID` du JS : 8-4-4-4-12 chiffres hexadécimaux, casse indifférente.
fn uuid(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 36 && b.iter().enumerate().all(|(i, c)| if matches!(i, 8 | 13 | 18 | 23) { *c == b'-' } else { c.is_ascii_hexdigit() })
}

/// `eligible(e)`.
#[must_use]
pub fn eligible(e: &Valeur) -> bool {
    if !matches!(e, Valeur::Objet(_)) || !est(prop(e, "type"), "phase-timing") || !matches!(prop(e, "schema"), Valeur::Nombre(x) if js::egal_f(*x, 1.0)) || est(prop(e, "kind"), "health") { return false; }
    if !matches!(prop(e, "visitId"), Valeur::Chaine(s) if !s.is_empty()) || !fini(prop(e, "ms")) || !fini(prop(e, "timeOrigin")) || !entier(prop(e, "seq")) || !entier(prop(e, "batchSeq")) { return false; }
    if !texte(prop(e, "clockId")) || !texte(prop(e, "sessionId")) || !texte(prop(e, "batchId")) || !texte(prop(e, "kind")) { return false; }
    CTX.iter().all(|k| js::possede(e, k))
}

fn num(v: &Valeur) -> f64 { if let Valeur::Nombre(x) = v { *x } else { f64::NAN } }
fn txt(v: &Valeur) -> &str { if let Valeur::Chaine(s) = v { s } else { "" } }

/// Clé de groupe : `JSON.stringify([sessionId, batchId, clockId, timeOrigin, visitId])` (−0 et +0 s'écrivent « 0 »).
fn cle_groupe(e: &Valeur) -> (String, String, String, u64, String) {
    (txt(prop(e, "sessionId")).to_owned(), txt(prop(e, "batchId")).to_owned(), txt(prop(e, "clockId")).to_owned(), (num(prop(e, "timeOrigin")) + 0.0).to_bits(), txt(prop(e, "visitId")).to_owned())
}

/// Formes de ligne (globales à l'export), avec annulation des ajouts d'un groupe refusé.
struct Formes { liste: Vec<(String, Vec<String>)>, index: HashMap<(String, Vec<String>), usize> }

fn cles_libres(k: &str) -> Result<(), Echec> { if js::NOMS_DU_PROTOTYPE.contains(&k) { hd("clé de résumé du prototype") } else { Ok(()) } }

fn tri_par_seq(es: &[(usize, &Valeur)]) -> Vec<(usize, Valeur)> {
    let mut v: Vec<(usize, Valeur)> = es.iter().map(|(i, e)| (*i, (*e).clone())).collect();
    v.sort_by(|a, b| { let d = num(prop(&a.1, "seq")) - num(prop(&b.1, "seq")); d.partial_cmp(&0.0).unwrap_or(core::cmp::Ordering::Equal) });
    v
}

fn plier_groupe(es: &[(usize, Valeur)], formes: &mut Formes) -> R<Valeur> {
    let premier = &es[0].1;
    let mut u: Vec<String> = vec![];
    let mut index_u: HashMap<String, usize> = HashMap::new();
    let mut entete = vec![];
    for k in ENTETE { entete.push((k.to_owned(), prop(premier, k).clone())); }
    let mut etat: Vec<Valeur> = CTX.iter().map(|k| js::copie(prop(premier, k))).collect();
    let ctx = Valeur::Objet(CTX.iter().map(|k| ((*k).to_owned(), js::copie(prop(premier, k)))).collect());
    let mut rows = vec![];
    let (mut rk, mut rs, mut rj): (Champs, Champs, Champs) = (vec![], vec![], vec![]);
    let (mut seq_prec, mut bs_prec) = (0.0f64, 0.0f64);
    let m0 = num(prop(premier, "ms"));
    for (_, e) in es {
        let Valeur::Objet(champs) = e else { return hd("événement non objet") };
        let ms = num(prop(e, "ms"));
        let mut explicites: Vec<(String, Valeur)> = vec![];
        for (j, k) in CTX.iter().enumerate() {
            if !js::egal_json(prop(e, k), &etat[j]) { js::poser(&mut explicites, k, js::copie(prop(e, k))); etat[j] = js::copie(prop(e, k)); }
        }
        for (k, x) in champs {
            if k == "__proto__" { return hd("clé __proto__"); }
            if PERDUES.contains(&k.as_str()) || ENTETE.contains(&k.as_str()) || LIGNE.contains(&k.as_str()) || CTX.contains(&k.as_str()) { continue; }
            if !matches!(x, Valeur::Indefini) { js::poser(&mut explicites, k, js::copie(x)); }
        }
        let mut cles: Vec<String> = explicites.iter().map(|(k, _)| k.clone()).collect();
        cles.sort_by(|a, b| js::cmp_utf16(a, b));
        let kind = txt(prop(e, "kind")).to_owned();
        let cle = (kind.clone(), cles.clone());
        let id = if let Some(&i) = formes.index.get(&cle) { i } else { let i = formes.liste.len(); formes.liste.push(cle.clone()); formes.index.insert(cle, i); i };
        let mut ligne = vec![Some(Valeur::Nombre(num(prop(e, "seq")) - seq_prec)), Some(Valeur::Nombre(num(prop(e, "batchSeq")) - bs_prec)), Some(Valeur::Nombre(ms)), Some(Valeur::Nombre(id as f64))];
        for k in &cles {
            let v = explicites.iter().find(|(c, _)| c == k).map_or(&js::INDEFINI, |(_, v)| v);
            if let Valeur::Chaine(s) = v { if s.starts_with(MARQUE_REF) || s == MARQUE_MS { return Ok(Err(Leve)); } }
            #[allow(clippy::float_cmp)] // `v === e.ms` du JS
            let est_ms = matches!(v, Valeur::Nombre(x) if *x == ms);
            ligne.push(Some(if est_ms { ch(MARQUE_MS) } else if let Valeur::Chaine(s) = v {
                if uuid(s) {
                    let i = if let Some(&i) = index_u.get(s) { i } else { let i = u.len(); u.push(s.clone()); index_u.insert(s.clone(), i); i };
                    Valeur::Chaine(format!("{MARQUE_REF}{i}"))
                } else { v.clone() }
            } else { v.clone() }));
        }
        rows.push(Some(Valeur::Tableau(ligne)));
        seq_prec = num(prop(e, "seq"));
        bs_prec = num(prop(e, "batchSeq"));
        cles_libres(&kind)?;
        let n = match rk.iter().find(|(c, _)| *c == kind) { Some((_, Valeur::Nombre(x))) => *x, _ => 0.0 };
        js::poser(&mut rk, &kind, Valeur::Nombre(n + 1.0));
        if kind == "span" {
            if let (Valeur::Chaine(l), true, true) = (prop(e, "label"), fini(prop(e, "fromMs")), fini(prop(e, "toMs"))) {
                cles_libres(l)?;
                let (a, b) = match rs.iter().find(|(c, _)| c == l) { Some((_, Valeur::Nombres(t))) => (t[0], t[1]), _ => (0.0, 0.0) };
                let b = ariane_js::round((b + num(prop(e, "toMs")) - num(prop(e, "fromMs"))) * 10.0) / 10.0;
                js::poser(&mut rs, l, Valeur::Nombres(vec![a + 1.0, b]));
            }
        }
        if kind == "point" || kind == "visit" {
            if let Valeur::Chaine(p) = prop(e, "point") {
                if p == "__proto__" { return hd("point __proto__"); }
                if !rj.iter().any(|(c, _)| c == p) { js::poser(&mut rj, p, Valeur::Nombre(ariane_js::round((ms - m0) * 10.0) / 10.0)); }
            }
        }
    }
    let mut out = vec![("type".to_owned(), ch(TYPE))];
    for (k, v) in entete { js::poser(&mut out, &k, v); }
    js::poser(&mut out, "ctx", ctx);
    js::poser(&mut out, "n", Valeur::Nombre(rows.len() as f64));
    js::poser(&mut out, "r", objet(vec![("k", Valeur::Objet(rk)), ("s", Valeur::Objet(rs)), ("j", Valeur::Objet(rj))]));
    if !u.is_empty() { js::poser(&mut out, "u", js::tab(u.into_iter().map(Valeur::Chaine).collect())); }
    js::poser(&mut out, "rows", Valeur::Tableau(rows));
    Ok(Ok(Valeur::Objet(out)))
}

fn hex(n: u64, k: usize) -> String { format!("{n:0k$x}") }

/// Nombre d'un élément de ligne pour `+=` : nombre, ou hors domaine (concaténations et coercitions non portées).
fn n_ligne(v: Option<&Valeur>) -> Result<f64, Echec> { match v { Some(Valeur::Nombre(x)) => Ok(*x), _ => hd("ligne non numérique") } }

/// Opérande numérique de `a + b` (nombres, null, booléens, undefined) ; texte et objets hors domaine (concaténation).
fn addition(v: &Valeur) -> Result<f64, Echec> {
    match v {
        Valeur::Nombre(x) => Ok(*x),
        Valeur::Indefini => Ok(f64::NAN),
        Valeur::Nul => Ok(0.0),
        Valeur::Booleen(b) => Ok(f64::from(u8::from(*b))),
        _ => hd("addition avec un texte ou un objet"),
    }
}

fn lire(v: &Valeur, u: &[Valeur]) -> Result<Valeur, Echec> {
    if let Valeur::Chaine(s) = v {
        if let Some(reste) = s.strip_prefix(MARQUE_REF) {
            if reste.is_empty() { return Ok(u.first().cloned().unwrap_or(Valeur::Indefini)); }
            if !(reste.bytes().all(|b| b.is_ascii_digit()) && (reste.len() == 1 || !reste.starts_with('0')) && reste.len() <= 9) { return hd("référence § non canonique"); }
            let i: usize = reste.parse().map_err(|_| Echec::hors_domaine("référence §"))?;
            return Ok(u.get(i).cloned().unwrap_or(Valeur::Indefini));
        }
    }
    Ok(v.clone())
}

fn deplier_groupe(g: &Valeur, formes: &[Valeur], index_groupe: usize) -> R<Vec<Valeur>> {
    let u = match prop(g, "u") { x if js::est_tableau(x) => js::elements(x).unwrap_or_default(), _ => vec![] };
    let gctx = prop(g, "ctx");
    let mut etat: Vec<Valeur> = CTX.iter().map(|k| js::copie(prop(gctx, k))).collect();
    let rows: Vec<Option<Valeur>> = match prop(g, "rows") {
        x if !x.vrai() => vec![],
        Valeur::Tableau(t) => t.clone(),
        x if js::est_tableau(x) => js::elements(x).unwrap_or_default().into_iter().map(Some).collect(),
        _ => return Ok(Err(Leve)),
    };
    let mut sortie = vec![];
    let (mut seq, mut bs) = (0.0f64, 0.0f64);
    for (i, r) in rows.iter().enumerate() {
        let Some(r) = r else { continue };
        let r = match r {
            x if js::est_tableau(x) => js::elements(x).unwrap_or_default(),
            Valeur::Nul | Valeur::Indefini | Valeur::Nombre(_) | Valeur::Booleen(_) => return Ok(Err(Leve)),
            _ => return hd("ligne de forme non portée"),
        };
        seq += n_ligne(r.first())?;
        bs += n_ligne(r.get(1))?;
        let ms = r.get(2).cloned().unwrap_or(Valeur::Indefini);
        let f = match r.get(3) {
            Some(Valeur::Nombre(x)) => {
                let x = x + 0.0;
                if x >= 0.0 && js::est_entier(x) && x < formes.len() as f64 {
                    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)] // entier positif borné par la longueur
                    let n = x as usize;
                    &formes[n]
                } else { &js::INDEFINI }
            }
            _ => return hd("indice de forme non numérique"),
        };
        if !matches!(f, Valeur::Objet(_)) { return Ok(Err(Leve)); }
        let Some(ts) = date::iso(addition(prop(g, "timeOrigin"))? + addition(&ms)?) else { return Ok(Err(Leve)) };
        let gi = u64::try_from(index_groupe % 65_536).unwrap_or(0);
        let mut e: Vec<(String, Valeur)> = vec![
            ("eventId".into(), Valeur::Chaine(format!("70690000-{}-4000-8000-{}", hex(gi, 4), hex(u64::try_from(i).unwrap_or(0), 12)))),
            ("timestamp".into(), Valeur::Chaine(ts)), ("type".into(), ch("phase-timing"))];
        for k in ENTETE { js::poser(&mut e, k, prop(g, k).clone()); }
        js::poser(&mut e, "seq", Valeur::Nombre(seq));
        js::poser(&mut e, "batchSeq", Valeur::Nombre(bs));
        js::poser(&mut e, "ms", ms.clone());
        js::poser(&mut e, "kind", prop(f, "k").clone());
        let c = prop(f, "c");
        let Some(cl) = js::elements(c) else { return Ok(Err(Leve)) };
        let trous: Vec<bool> = match c { Valeur::Tableau(t) => t.iter().map(Option::is_none).collect(), _ => vec![false; cl.len()] };
        for (j, k) in cl.iter().enumerate() {
            if trous[j] { continue; }
            let Valeur::Chaine(k) = k else { return hd("clé de forme non chaîne") };
            if k == "__proto__" { return hd("clé __proto__"); }
            let v = r.get(4 + j).cloned().unwrap_or(Valeur::Indefini);
            let val = if est(&v, MARQUE_MS) { ms.clone() } else { lire(&v, &u)? };
            if let Some(p) = CTX.iter().position(|c| c == k) { etat[p] = js::copie(&val); } else { js::poser(&mut e, k, js::copie(&val)); }
        }
        for (p, k) in CTX.iter().enumerate() { js::poser(&mut e, k, js::copie(&etat[p])); }
        sortie.push(Valeur::Objet(e));
    }
    Ok(Ok(sortie))
}

fn sans_perdues(e: &Valeur) -> Valeur {
    match e { Valeur::Objet(t) => Valeur::Objet(t.iter().filter(|(k, _)| k != "eventId" && k != "timestamp").cloned().collect()), x => x.clone() }
}

fn sources(v: Vec<f64>) -> Valeur { if v.is_empty() { Valeur::Tableau(vec![]) } else { Valeur::Nombres(v) } }

/// 220 : `plier(events)` sur `{events}` ; rend `{sources, nouveaux, bilan}`.
///
/// # Errors
/// `HorsDomaine` : clés du prototype dans un résumé, événements que le JS lirait par coercition.
pub fn plier(e: &Valeur) -> Result<Valeur, Echec> {
    let ev = prop(e, "events");
    let compact: Vec<Option<Valeur>>;
    let liste: &[Option<Valeur>] = match ev {
        Valeur::Tableau(t) => t,
        x if js::est_tableau(x) => { compact = js::elements(x).unwrap_or_default().into_iter().map(Some).collect(); &compact }
        _ => &[],
    };
    let n_avant = liste.len();
    let mut groupes: Vec<Vec<(usize, &Valeur)>> = vec![];
    let mut index: HashMap<(String, String, String, u64, String), usize> = HashMap::new();
    for (i, x) in liste.iter().enumerate() {
        let Some(x) = x else { continue };
        if !eligible(x) { continue; }
        let k = cle_groupe(x);
        if let Some(&g) = index.get(&k) { groupes[g].push((i, x)); } else { index.insert(k, groupes.len()); groupes.push(vec![(i, x)]); }
    }
    let mut formes = Formes { liste: vec![], index: HashMap::new() };
    let mut plies: HashMap<usize, Valeur> = HashMap::new();
    let mut exclus = vec![false; liste.len()];
    let (mut nb_refus, mut nb_plies) = (0usize, 0usize);
    for g in &groupes {
        let avant = formes.liste.len();
        let es = tri_par_seq(g);
        let essai = (|| -> R<Valeur> {
            let Ok(ev) = plier_groupe(&es, &mut formes)? else { return Ok(Err(Leve)) };
            let fl: Vec<Valeur> = formes.liste.iter().map(forme_valeur).collect();
            let Ok(r) = deplier_groupe(&ev, &fl, 0)? else { return Ok(Err(Leve)) };
            if r.len() != es.len() || !es.iter().zip(&r).all(|((_, a), b)| js::egal_json(&sans_perdues(a), &sans_perdues(b))) { return Ok(Err(Leve)); }
            Ok(Ok(ev))
        })()?;
        if let Ok(ev) = essai {
            plies.insert(g[0].0, ev);
            for (i, _) in g { exclus[*i] = true; }
            nb_plies += g.len();
        } else {
            for c in formes.liste.drain(avant..) { formes.index.remove(&c); }
            nb_refus += g.len();
        }
    }
    let mut src = vec![];
    let mut nouveaux = vec![];
    let mut formes_posees = false;
    let n_groupes = plies.len();
    for (i, x) in liste.iter().enumerate() {
        if x.is_none() { continue; }
        if let Some(ev) = plies.remove(&i) {
            if !formes_posees {
                nouveaux.push(objet(vec![("type", ch(TYPE_FORMES)), ("schema", Valeur::Nombre(1.0)), ("formes", js::tab(formes.liste.iter().map(forme_valeur).collect()))]));
                src.push(-(nouveaux.len() as f64));
                formes_posees = true;
            }
            nouveaux.push(ev);
            src.push(-(nouveaux.len() as f64));
            continue;
        }
        if exclus[i] { continue; }
        src.push(i as f64);
    }
    let apres = src.len();
    Ok(objet(vec![("sources", sources(src)), ("nouveaux", js::tab(nouveaux)), ("bilan", objet(vec![("evenementsAvant", Valeur::Nombre(n_avant as f64)),
        ("evenementsApres", Valeur::Nombre(apres as f64)), ("jalonsPlies", Valeur::Nombre(nb_plies as f64)), ("jalonsLaisses", Valeur::Nombre(nb_refus as f64)),
        ("groupes", Valeur::Nombre(n_groupes as f64))]))]))
}

fn forme_valeur(f: &(String, Vec<String>)) -> Valeur { objet(vec![("k", Valeur::Chaine(f.0.clone())), ("c", js::tab(f.1.iter().map(|c| Valeur::Chaine(c.clone())).collect()))]) }

/// 221 : `deplier(events)` sur `{events}` ; rend `{meme: true}` quand le JS rend son entrée elle-même (aucun pli), sinon
/// `{sources, nouveaux}`.
///
/// # Errors
/// `HorsDomaine` pour des lignes que le JS lirait par coercition.
pub fn deplier(e: &Valeur) -> Result<Valeur, Echec> {
    let ev = prop(e, "events");
    let liste: Vec<Valeur> = match ev { x if js::est_tableau(x) => js::elements(x).unwrap_or_default(), _ => vec![] };
    let de_type = |x: &Valeur, t: &str| x.vrai() && est(prop(x, "type"), t);
    if !liste.iter().any(|x| de_type(x, TYPE)) { return Ok(objet(vec![("meme", Valeur::Booleen(true))])); }
    let formes = liste.iter().find(|x| de_type(x, TYPE_FORMES)).map(|x| prop(x, "formes"));
    let mut src = vec![];
    let mut nouveaux = vec![];
    let mut n = 0usize;
    for (i, x) in liste.iter().enumerate() {
        if de_type(x, TYPE_FORMES) { continue; }
        if de_type(x, TYPE) {
            let r = match formes {
                Some(f) if js::est_tableau(f) => {
                    let fl = js::elements(f).unwrap_or_default();
                    deplier_groupe(x, &fl, n)?
                }
                _ => Err(Leve),
            };
            match r {
                Ok(v) => for y in v { nouveaux.push(y); src.push(-(nouveaux.len() as f64)); },
                Err(Leve) => src.push(i as f64),
            }
            n += 1;
            continue;
        }
        src.push(i as f64);
    }
    Ok(objet(vec![("sources", sources(src)), ("nouveaux", js::tab(nouveaux))]))
}

/// 222 : `estPlie(events)` sur `{events}`.
///
/// # Errors
/// Jamais (signature commune).
pub fn est_plie(e: &Valeur) -> Result<Valeur, Echec> {
    let ev = prop(e, "events");
    let r = match ev { Valeur::Tableau(t) => t.iter().flatten().any(|x| x.vrai() && est(prop(x, "type"), TYPE)), _ => false };
    Ok(Valeur::Booleen(r))
}

/// 223 : `eligible(e)` sur `{e}`.
///
/// # Errors
/// Jamais (signature commune).
pub fn eligible_appel(e: &Valeur) -> Result<Valeur, Echec> { Ok(Valeur::Booleen(eligible(prop(e, "e")))) }

/// Texte d'un nombre (diagnostic des essais).
#[must_use]
pub fn nombre_texte(x: f64) -> String { nombre_en_chaine(x) }

#[cfg(test)]
mod essais {
    use super::*;
    fn jalon(seq: f64, kind: &str, extra: Vec<(&str, Valeur)>) -> Valeur {
        let mut c = vec![("eventId", ch("x")), ("timestamp", ch("t")), ("type", ch("phase-timing")), ("schema", Valeur::Nombre(1.0)), ("clockId", ch("c")),
            ("timeOrigin", Valeur::Nombre(1_762_430_400_000.0)), ("sessionId", ch("s")), ("batchId", ch("b")), ("visitId", ch("v")), ("seq", Valeur::Nombre(seq)),
            ("batchSeq", Valeur::Nombre(seq)), ("ms", Valeur::Nombre(seq * 10.5)), ("kind", ch(kind)), ("identity", Valeur::Nul), ("captureId", Valeur::Nul),
            ("analysisId", Valeur::Nul), ("proposalId", ch("01234567-89ab-cdef-0123-456789abcdef")), ("selector", Valeur::Nul)];
        c.extend(extra);
        objet(c)
    }
    #[test]
    fn plier_puis_deplier() {
        let evs = js::tab(vec![jalon(2.0, "point", vec![("point", ch("b"))]), ch("autre"), jalon(1.0, "span", vec![("label", ch("l")), ("fromMs", Valeur::Nombre(0.0)), ("toMs", Valeur::Nombre(3.0))])]);
        let r = plier(&objet(vec![("events", evs.clone())])).unwrap();
        assert_eq!(prop(&r, "sources"), &Valeur::Nombres(vec![-1.0, -2.0, 1.0]));
        assert_eq!(prop(prop(&r, "bilan"), "jalonsPlies"), &Valeur::Nombre(2.0));
        let nv = js::elements(prop(&r, "nouveaux")).unwrap();
        let plie = js::tab(vec![nv[0].clone(), nv[1].clone(), ch("autre")]);
        assert_eq!(est_plie(&objet(vec![("events", plie.clone())])).unwrap(), Valeur::Booleen(true));
        let d = deplier(&objet(vec![("events", plie)])).unwrap();
        assert_eq!(prop(&d, "sources"), &Valeur::Nombres(vec![-1.0, -2.0, 2.0]));
        let dv = js::elements(prop(&d, "nouveaux")).unwrap();
        assert!(js::egal_json(&sans_perdues(&dv[0]), &sans_perdues(&js::elements(&evs).unwrap()[2])));
        assert_eq!(deplier(&objet(vec![("events", js::tab(vec![]))])).unwrap(), objet(vec![("meme", Valeur::Booleen(true))]));
        assert_eq!(eligible_appel(&objet(vec![("e", jalon(1.0, "health", vec![]))])).unwrap(), Valeur::Booleen(false));
        assert!(uuid("01234567-89AB-cdef-0123-456789abcdef") && !uuid("x"));
        assert_eq!(nombre_texte(1.5), "1.5");
    }
}
