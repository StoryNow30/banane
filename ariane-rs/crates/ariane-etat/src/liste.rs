//! Partie pure de `src/liste-memoire.js`. Le stockage `chrome.storage` reste en JavaScript.
use crate::date::{self, parse_iso};
use crate::jsval::{self, a, chaine, cmp_utf16, est_entier, est_objet, nombre, vers_int32, vrai};
use crate::json;
use ariane_vba::Valeur;

const FORMAT: &str = "ariane-liste-instantane-1";
const MAX_PARTIES: usize = 12;
const MAX_CUTS: usize = 20000;
const SEUIL_MM: f64 = 1.0;
const SEUIL_NOUVEAU_MM: f64 = 0.5;
const UNITE: f64 = 1e4;
const STATUTS: [&str; 4] = ["valid", "invalid", "skipped", "autre"];
const EDGES: [&str; 6] = ["XLeftEdge", "YLeftEdge", "ZLeftEdge", "XRightEdge", "YRightEdge", "ZRightEdge"];
const LECTURE: &str = "r[i] = ligne du cut i : [statut + 4 × drapeaux, six bords]. Statut 0 valid, 1 invalid, 2 skipped, 3 autre ; drapeaux 1 TreatedByOperator, 2 SeenByOperator. Pour chaque bord, la première valeur connue est absolue, les suivantes sont l’écart à la précédente valeur connue de la même colonne ; null = absent.";

pub(crate) fn empreinte(s: &str) -> String {
    let mut h: u32 = 0x811c_9dc5;
    for c in s.encode_utf16() {
        h ^= c as u32;
        h = (h as i32).wrapping_mul(0x0100_0193u32 as i32) as u32;
    }
    format!("{h:08x}")
}

fn dm(v: f64) -> Option<f64> { if v.is_finite() { Some(ariane_js::round(v * UNITE)) } else { None } }

fn nombres_ou_trous(v: &Valeur) -> Vec<Option<f64>> {
    match v {
        Valeur::Nombres(t) => t.iter().copied().map(Some).collect(),
        Valeur::Tableau(t) => t.iter().map(|e| match e { Some(Valeur::Nombre(x)) => Some(*x), _ => None }).collect(),
        _ => vec![],
    }
}
fn f64s(v: &Valeur) -> Vec<f64> { nombres_ou_trous(v).into_iter().map(|x| x.unwrap_or(f64::NAN)).collect() }

pub(crate) fn compacter(t: &Valeur, meta: &Valeur) -> Valeur {
    let st = f64s(a(t, "st"));
    let fl = f64s(a(t, "fl"));
    let ed = nombres_ou_trous(a(t, "ed"));
    let n = st.len();
    let mut last = [None; 6];
    let mut r = Vec::with_capacity(n);
    for i in 0..n {
        let sf = (vers_int32(&jsval::n(st.get(i).copied().unwrap_or(0.0))) & 3) + 4 * (vers_int32(&jsval::n(*fl.get(i).unwrap_or(&0.0))) & 3);
        let mut row = vec![jsval::n(sf as f64)];
        for j in 0..6 {
            let v = ed.get(6 * i + j).copied().flatten();
            match v {
                None => row.push(jsval::nul()),
                Some(v) => {
                    let delta = match last[j] { None => v, Some(p) => v - p };
                    row.push(jsval::n(delta));
                    last[j] = Some(v);
                }
            }
        }
        r.push(jsval::tab(row));
    }
    let rv = jsval::tab(r);
    let texte = json::stringify(&rv).unwrap_or_default();
    let partie = a(meta, "partie");
    jsval::o(vec![
        ("format", jsval::s(FORMAT)),
        ("partie", if est_entier(partie) { partie.clone() } else { jsval::nul() }),
        ("at", if vrai(a(meta, "at")) { a(meta, "at").clone() } else { jsval::nul() }),
        ("version", if vrai(a(meta, "version")) { a(meta, "version").clone() } else { jsval::nul() }),
        ("cle", if vrai(a(meta, "cle")) { a(meta, "cle").clone() } else { jsval::nul() }),
        ("lignes", jsval::n(n as f64)),
        ("sig", jsval::s(empreinte(&texte))),
        ("unite", jsval::s("0,1 mm (monde, bords gauche X Y Z puis droit X Y Z)")),
        ("lecture", jsval::s(LECTURE)),
        ("r", rv),
    ])
}

fn lignes_r(v: &Valeur) -> Option<Vec<Vec<Option<f64>>>> {
    match v {
        Valeur::Bloc { k, donnees } => {
            let k = *k as usize;
            if k == 0 { return None; }
            Some(donnees.chunks(k).map(|c| c.iter().copied().map(Some).collect()).collect())
        }
        Valeur::Tableau(t) => Some(t.iter().map(|e| match e.as_ref() {
            Some(Valeur::Nombres(n)) => n.iter().copied().map(Some).collect(),
            Some(Valeur::Tableau(row)) => row.iter().map(|x| x.as_ref().and_then(nombre)).collect(),
            Some(autre) => jsval::comme_liste(autre).unwrap_or_default().into_iter().map(|x| nombre(&x)).collect(),
            None => vec![],
        }).collect()),
        _ => None,
    }
}

pub(crate) fn decompacter(snap: &Valeur) -> Valeur {
    if chaine(a(snap, "format")) != Some(FORMAT) { return jsval::nul(); }
    let Some(rows) = lignes_r(a(snap, "r")) else { return jsval::nul() };
    let n = rows.len();
    let mut st = Vec::with_capacity(n);
    let mut fl = Vec::with_capacity(n);
    let mut ed: Vec<Valeur> = Vec::with_capacity(6 * n);
    let mut last = [None; 6];
    for cellules in rows {
        let sf = cellules.first().copied().flatten().map_or(3, |x| vers_int32(&jsval::n(x)));
        st.push(jsval::n((sf & 3) as f64));
        fl.push(jsval::n(((sf >> 2) & 3) as f64));
        for j in 0..6 {
            let v = cellules.get(1 + j).copied().flatten();
            match v {
                Some(v) if v.is_finite() => {
                    let abs = match last[j] { None => v, Some(p) => p + v };
                    last[j] = Some(abs);
                    ed.push(jsval::n(abs));
                }
                _ => ed.push(jsval::nul()),
            }
        }
    }
    jsval::o(vec![
        ("n", jsval::n(n as f64)),
        ("st", jsval::tab(st)),
        ("fl", jsval::tab(fl)),
        ("ed", jsval::tab(ed)),
        ("partie", a(snap, "partie").clone()),
        ("at", a(snap, "at").clone()),
        ("cle", a(snap, "cle").clone()),
        ("sig", a(snap, "sig").clone()),
    ])
}

pub(crate) fn nom_fichier(partie: &Valeur, at: &Valeur) -> String {
    let p = if est_entier(partie) { nombre(partie).unwrap().to_string().trim_end_matches(".0").to_string() } else { "X".into() };
    // to_string of 7.0 via format of the integer
    let p = if est_entier(partie) { format!("{}", nombre(partie).unwrap() as i64) } else { "X".into() };
    format!("ariane-liste-partie{p}-{}.json", heure_compacte(chaine(at).unwrap_or("")))
}
fn heure_compacte(iso: &str) -> String {
    let Some(ms) = parse_iso(iso) else { return "heure-inconnue".into() };
    let Some(s) = date::vers_iso(ms) else { return "heure-inconnue".into() };
    // 2026-11-06T12:55:30.123Z → 20261106-125530Z
    let sans: String = s.chars().filter(|c| *c != '-' && *c != ':').collect();
    let sans = if let Some(i) = sans.find('.') { let z = sans.rfind('Z').unwrap_or(sans.len()); format!("{}Z", &sans[..i]) } else { sans };
    sans.replacen('T', "-", 1)
}

pub(crate) fn bords_corps(body: &Valeur) -> Valeur {
    if !est_objet(body) || chaine(a(body, "ExtractionStatus")) != Some("valid") { return jsval::nul(); }
    let mut e = vec![];
    for k in EDGES {
        match nombre(a(body, k)).and_then(dm) { Some(v) => e.push(jsval::n(v)), None => return jsval::nul() }
    }
    jsval::tab(e)
}

fn indice(k: &str) -> Option<u32> {
    if k == "0" { return Some(0); }
    if k.is_empty() || k.len() > 10 || k.as_bytes()[0] == b'0' || !k.bytes().all(|c| c.is_ascii_digit()) { return None; }
    let n: u64 = k.parse().ok()?;
    if n > u32::MAX as u64 { None } else { Some(n as u32) }
}
fn poser(o: &mut Vec<(String, Valeur)>, k: String, v: Valeur) {
    if let Some(i) = o.iter().position(|(c, _)| c == &k) { o[i].1 = v; return; }
    if let Some(idx) = indice(&k) {
        let pos = o.iter().position(|(c, _)| match indice(c) { Some(j) if j > idx => true, None => true, _ => false }).unwrap_or(o.len());
        o.insert(pos, (k, v));
    } else { o.push((k, v)); }
}
fn obj_mut(v: &mut Valeur) -> &mut Vec<(String, Valeur)> { if let Valeur::Objet(t) = v { t } else { unreachable!() } }

pub(crate) fn ajouter(mem: &Valeur, partie: &Valeur, cle: &Valeur, cut: &Valeur, bords: &Valeur, at_iso: &Valeur, version: &Valeur) -> Valeur {
    if !est_entier(partie) || !est_entier(cut) || nombre(cut).unwrap() < 0.0 { return mem.clone(); }
    let Some(b) = jsval::comme_liste(bords) else { return mem.clone() };
    if b.len() != 6 { return mem.clone(); }
    let mut m = if est_objet(mem) { jsval::obj(mem).unwrap().to_vec() } else { vec![] };
    let pk = format!("{}", nombre(partie).unwrap() as i64);
    let ck = format!("{}", nombre(cut).unwrap() as i64);
    let cle_s = chaine(cle).unwrap_or("");
    let mut p = match m.iter().find(|(k, _)| k == &pk).map(|(_, v)| v.clone()) {
        Some(ex) if chaine(a(&ex, "cle")) == Some(cle_s) => {
            let mut t = jsval::obj(&ex).unwrap().to_vec();
            if let Some(c) = t.iter_mut().find(|(k, _)| k == "cuts") { *c = ("cuts".into(), Valeur::Objet(jsval::obj(&c.1).map(<[(std::string::String, ariane_vba::Valeur)]>::to_vec).unwrap_or_default())); }
            // re-copy cuts and vus
            let mut t = jsval::obj(&ex).unwrap().to_vec();
            for nom in ["cuts", "vus"] {
                if let Some(c) = t.iter_mut().find(|(k, _)| k == nom) {
                    c.1 = Valeur::Objet(jsval::obj(&c.1).map(<[(std::string::String, ariane_vba::Valeur)]>::to_vec).unwrap_or_default());
                }
            }
            Valeur::Objet(t)
        }
        _ => jsval::o(vec![("cle", jsval::s(cle_s)), ("cuts", Valeur::Objet(vec![])), ("vus", Valeur::Objet(vec![])), ("passage", jsval::nul())]),
    };
    let n_cuts = jsval::obj(a(&p, "cuts")).map_or(0, <[(std::string::String, ariane_vba::Valeur)]>::len);
    let deja = jsval::obj(a(&p, "cuts")).is_some_and(|t| t.iter().any(|(k, _)| k == &ck));
    if !deja && n_cuts >= MAX_CUTS { return mem.clone(); }
    let t = parse_iso(chaine(at_iso).unwrap_or("")).map_or(0.0, |ms| (ms / 1000.0).floor());
    let version = match version { Valeur::Chaine(s) => jsval::s(s.chars().take(20).collect::<String>()), _ => jsval::nul() };
    let mut ligne = b;
    ligne.push(jsval::n(t));
    ligne.push(version);
    {
        let cuts = obj_mut(prendre(&mut p, "cuts"));
        poser(cuts, ck.clone(), jsval::tab(ligne));
    }
    if let Valeur::Objet(v) = prendre(&mut p, "vus") { v.retain(|(k, _)| k != &ck); }
    let maj = if let Valeur::Chaine(s) = at_iso { if s.is_empty() { jsval::s("") } else { jsval::s(s.clone()) } } else { jsval::s("") };
    if let Valeur::Objet(t) = &mut p {
        if let Some(c) = t.iter_mut().find(|(k, _)| k == "maj") { c.1 = maj; } else { t.push(("maj".into(), maj)); }
    }
    poser(&mut m, pk, p);
    if m.len() > MAX_PARTIES {
        let mut cles: Vec<String> = m.iter().map(|(k, _)| k.clone()).collect();
        cles.sort_by(|a, b| {
            let ma = chaine(a_de(&m, a, "maj")).unwrap_or("undefined");
            let mb = chaine(a_de(&m, b, "maj")).unwrap_or("undefined");
            cmp_utf16(ma, mb)
        });
        for k in cles.into_iter().take(m.len() - MAX_PARTIES) { m.retain(|(c, _)| c != &k); }
    }
    Valeur::Objet(m)
}
fn a_de<'a>(m: &'a [(String, Valeur)], k: &str, champ: &str) -> &'a Valeur {
    m.iter().find(|(c, _)| c == k).map_or(&Valeur::Indefini, |(_, v)| a(v, champ))
}
fn prendre<'a>(o: &'a mut Valeur, k: &str) -> &'a mut Valeur {
    let Valeur::Objet(t) = o else { unreachable!() };
    if !t.iter().any(|(c, _)| c == k) { t.push((k.into(), Valeur::Objet(vec![]))); }
    t.iter_mut().find(|(c, _)| c == k).map(|(_, v)| v).unwrap()
}

fn hypot3(a: f64, b: f64, c: f64) -> f64 { ariane_js::hypot(&[a, b, c]) }
fn arr1(v: f64) -> f64 { ariane_js::round(v * 10.0) / 10.0 }

pub(crate) fn comparer(p: &Valeur, dec: &Valeur, at_iso: &Valeur) -> Valeur {
    let p_ok = est_objet(p);
    let dec_ok = est_objet(dec);
    let cle_diff = p_ok && dec_ok && chaine(a(p, "cle")) != chaine(a(dec, "cle"));
    if !p_ok || !dec_ok || chaine(a(p, "cle")) != chaine(a(dec, "cle")) {
        return jsval::o(vec![
            ("ecarts", jsval::tab(vec![])), ("comparees", jsval::n(0.0)), ("nouvelles", jsval::n(0.0)),
            ("partie", if p_ok { p.clone() } else { jsval::nul() }),
            ("cleDifferente", jsval::b(cle_diff)),
        ]);
    }
    let n = nombre(a(dec, "n")).unwrap_or(0.0);
    let ed = nombres_ou_trous(a(dec, "ed"));
    let st = f64s(a(dec, "st"));
    let cuts = jsval::obj(a(p, "cuts")).map(<[(std::string::String, ariane_vba::Valeur)]>::to_vec).unwrap_or_default();
    let vus_av = jsval::obj(a(p, "vus")).map(<[(std::string::String, ariane_vba::Valeur)]>::to_vec).unwrap_or_default();
    let mut comparees = 0.0;
    let mut nouvelles = 0.0;
    let mut vus = vec![];
    let mut ecarts = vec![];
    for (k, e) in &cuts {
        let Ok(i) = k.parse::<f64>() else { continue };
        if !i.is_finite() || i.fract() != 0.0 || i >= n { continue }
        let ii = i as usize;
        if !matches!(e, Valeur::Tableau(_) | Valeur::Nombres(_)) { continue; }
        let bords_e: Vec<f64> = nombres_ou_trous(e).into_iter().map(|x| x.unwrap_or(f64::NAN)).collect();
        if bords_e.len() < 6 { continue; }
        let r: Vec<Option<f64>> = (0..6).map(|j| ed.get(6 * ii + j).copied().flatten()).collect();
        if r.iter().any(std::option::Option::is_none) { continue; }
        let r: Vec<f64> = r.into_iter().map(|v| v.unwrap()).collect();
        comparees += 1.0;
        let g = hypot3(bords_e[0] - r[0], bords_e[1] - r[1], bords_e[2] - r[2]) / 10.0;
        let d = hypot3(bords_e[3] - r[3], bords_e[4] - r[4], bords_e[5] - r[5]) / 10.0;
        if !(g > SEUIL_MM || d > SEUIL_MM) { continue; }
        let prev = vus_av.iter().find(|(c, _)| c == k).map(|(_, v)| v);
        let nouveau = match prev {
            Some(Valeur::Tableau(t)) => {
                let p0 = t.first().and_then(|e| e.as_ref()).and_then(nombre).unwrap_or(f64::NAN);
                let p1 = t.get(1).and_then(|e| e.as_ref()).and_then(nombre).unwrap_or(f64::NAN);
                (p0 - g).abs() > SEUIL_NOUVEAU_MM || (p1 - d).abs() > SEUIL_NOUVEAU_MM
            }
            _ => true,
        };
        if nouveau { nouvelles += 1.0; }
        vus.push((k.clone(), jsval::tab(vec![jsval::n(arr1(g)), jsval::n(arr1(d))])));
        let statut = st.get(ii).copied().filter(|s| s.fract() == 0.0 && (0.0..4.0).contains(s)).map_or("autre", |s| STATUTS[s as usize]);
        ecarts.push((i, jsval::o(vec![
            ("cut", jsval::n(i)), ("gaucheMm", jsval::n(arr1(g))), ("droiteMm", jsval::n(arr1(d))),
            ("statut", jsval::s(statut)), ("nouveau", jsval::b(nouveau)),
        ])));
    }
    ecarts.sort_by(|a, b| jsval::cmp_nombre(a.0, b.0));
    let mut partie = jsval::obj(p).unwrap().to_vec();
    if let Some(c) = partie.iter_mut().find(|(k, _)| k == "vus") { c.1 = Valeur::Objet(vus); } else { partie.push(("vus".into(), Valeur::Objet(vus))); }
    let passage = jsval::o(vec![
        ("at", if matches!(at_iso, Valeur::Indefini) { jsval::nul() } else { at_iso.clone() }),
        ("memorises", jsval::n(cuts.len() as f64)),
        ("comparees", jsval::n(comparees)),
        ("constatees", jsval::n(ecarts.len() as f64)),
        ("nouvelles", jsval::n(nouvelles)),
    ]);
    if let Some(c) = partie.iter_mut().find(|(k, _)| k == "passage") { c.1 = passage; } else { partie.push(("passage".into(), passage)); }
    jsval::o(vec![
        ("ecarts", jsval::tab(ecarts.into_iter().map(|(_, v)| v).collect())),
        ("comparees", jsval::n(comparees)),
        ("nouvelles", jsval::n(nouvelles)),
        ("partie", Valeur::Objet(partie)),
    ])
}

pub(crate) fn choisir_table(tables: &Valeur, obs: &Valeur) -> Valeur {
    let rows = nombre(a(obs, "rows"));
    let mut l = vec![];
    for t in jsval::elements(tables) {
        let st = a(t, "st");
        let n = match st { Valeur::Tableau(a) => a.len(), Valeur::Nombres(a) => a.len(), _ => continue };
        let ok = est_objet(t) && matches!(a(t, "fl"), Valeur::Tableau(_) | Valeur::Nombres(_)) && matches!(a(t, "ed"), Valeur::Tableau(_) | Valeur::Nombres(_))
            && !matches!(a(t, "rompue"), Valeur::Booleen(true)) && !matches!(a(t, "tronquee"), Valeur::Booleen(true))
            && matches!(a(t, "debut"), Valeur::Booleen(true)) && rows.is_some_and(|r| est_entier(&jsval::n(r)) && n == r as usize);
        if ok { l.push(t.clone()); }
    }
    if let Some(t) = l.iter().find(|t| chaine(a(t, "key")) == chaine(a(obs, "listKey")) && chaine(a(obs, "listKey")).is_some()) { return t.clone(); }
    if l.len() == 1 { l.pop().unwrap() } else { jsval::nul() }
}

pub(crate) fn texte_resume(r: &Valeur, snap: &Valeur, heure: &Valeur) -> String {
    let h = |iso: &Valeur| -> String {
        if est_objet(heure) || matches!(heure, Valeur::Chaine(_)) {
            // L'adaptateur passe le texte déjà formaté dans `heureTexte`, sinon l'ISO tel quel.
            if let Some(s) = chaine(a(r, "heureTexte")) { return s.to_string(); }
        }
        chaine(iso).filter(|s| !s.is_empty()).unwrap_or("heure inconnue").to_string()
    };
    let at = if matches!(a(snap, "at"), Valeur::Indefini | Valeur::Nul) { a(r, "instantaneAt") } else { a(snap, "at") };
    let lignes = match nombre(a(snap, "lignes")) { Some(n) => format!("{}", n as i64), None => "?".into() };
    let base = format!("Liste d’ESV relue, partie {} · instantané du {} ({lignes} lignes)", texte_num_ou(a(r, "partie")), h(at));
    let mem = nombre(a(r, "memorises")).unwrap_or(0.0);
    if mem == 0.0 { return format!("{base} · aucun cut mémorisé d’Ariane pour cette partie."); }
    let p = a(r, "passage");
    if est_objet(p) {
        format!("{base} · cuts d’Ariane mémorisés {} · comparés {} · corrections constatées {} (dont {} depuis le dernier passage)",
            fmt_num(mem), fmt_num(nombre(a(p, "comparees")).unwrap_or(0.0)), fmt_num(nombre(a(p, "constatees")).unwrap_or(0.0)), fmt_num(nombre(a(p, "nouvelles")).unwrap_or(0.0)))
    } else {
        format!("{base} · cuts d’Ariane mémorisés {} · pas encore comparés", fmt_num(mem))
    }
}
fn fmt_num(x: f64) -> String { if x.fract() == 0.0 && x.abs() < 1e15 { format!("{}", x as i64) } else { crate::nombre::json_nombre(x) } }
fn texte_num_ou(v: &Valeur) -> String { nombre(v).map_or_else(|| match v { Valeur::Chaine(s) => s.clone(), Valeur::Nul => "null".into(), _ => "undefined".into() }, fmt_num) }

pub(crate) fn actif(reglage: &Valeur) -> bool {
    if matches!(reglage, Valeur::Indefini) { return true; }
    !matches!(a(a(reglage, "listeMemoire"), "actif"), Valeur::Booleen(false))
}
