//! Fonctions pures de `src/deplacement-vue.js`. `deplacer` (async, émission) reste en JS.
use crate::util::{
    au, ch, champ, entier, fini, liste, med, nb, nb_v, nul, num, obj, opt_nombre, ou, ou_nul, txt,
    Elem, IND,
};
use ariane_js::Echec;
use ariane_vba::Valeur;

const VERSION: &str = "deplacement-vue-v1";
const GESTES: [&str; 3] = ["molette", "clic-droit", "glisse-synthetique"];
const PLAFOND: f64 = 4.0;

fn geste_connu(s: &str) -> bool {
    GESTES.contains(&s)
}

/// `reglages(S)`.
pub fn reglages(s: &Valeur) -> Result<Valeur, Echec> {
    let source = match s {
        Valeur::Indefini
        | Valeur::Nul
        | Valeur::Booleen(_)
        | Valeur::Nombre(_)
        | Valeur::Chaine(_) => None,
        Valeur::Objet(_) => Some(s),
        _ => return Err(Echec::hors_domaine("reglages : objet simple attendu")),
    };
    let lire = |k: &str| source.and_then(|o| o.champ(k));
    let mut cles = vec![
        "actif",
        "geste",
        "tentativesMax",
        "mouvementMinMm",
        "zoomMin",
    ];
    if let Some(Valeur::Objet(p)) = source {
        for (k, _) in p {
            if !cles.contains(&k.as_str()) {
                cles.push(k.as_str());
            }
        }
    }
    if !cles.contains(&"erreur") {
        cles.push("erreur");
    }
    let brut = |k: &str| lire(k).cloned();
    let geste_src = brut("geste").unwrap_or_else(|| ch("molette"));
    let (geste_ok, erreur) = match &geste_src {
        Valeur::Chaine(g) if geste_connu(g) => (ch(g), nul()),
        _ => (ch("molette"), ch("geste-inconnu")),
    };
    // `r.actif===true && !erreur`. Une clé absente laisse le défaut (faux) : pas d'allumage.
    let actif = matches!(brut("actif").as_ref(), Some(Valeur::Booleen(true)))
        && matches!(erreur, Valeur::Nul);
    let t = match brut("tentativesMax") {
        Some(v) => fini(&v).map_or(2.0, f64::floor),
        None => 2.0,
    };
    let tente = ariane_js::max(1.0, ariane_js::min(PLAFOND, t));
    let mut paires = Vec::new();
    for k in cles {
        let v = match k {
            "actif" => Valeur::Booleen(actif),
            "geste" => geste_ok.clone(),
            "erreur" => erreur.clone(),
            "tentativesMax" => num(tente),
            "mouvementMinMm" => brut(k).unwrap_or_else(|| num(0.5)),
            "zoomMin" => brut(k).unwrap_or_else(|| num(0.005)),
            autre => brut(autre).unwrap_or(IND),
        };
        paires.push((k, v));
    }
    let _ = geste_ok;
    Ok(obj(paires))
}

#[derive(Clone)]
struct Compte {
    tentatives: f64,
    mouvements: f64,
    immobiles: f64,
    sens: f64,
    illisibles: f64,
    deplacements: Vec<f64>,
    zooms: Vec<f64>,
}
impl Compte {
    fn vide() -> Self {
        Self {
            tentatives: 0.0,
            mouvements: 0.0,
            immobiles: 0.0,
            sens: 0.0,
            illisibles: 0.0,
            deplacements: vec![],
            zooms: vec![],
        }
    }
    fn lire(v: &Valeur) -> Result<Self, Echec> {
        let nums = |k: &str| -> Result<Vec<f64>, Echec> {
            match champ(v, k) {
                Valeur::Indefini | Valeur::Nul => Ok(vec![]),
                Valeur::Nombres(t) => Ok(t.clone()),
                Valeur::Tableau(t) => t
                    .iter()
                    .map(|e| match e {
                        Some(Valeur::Nombre(x)) => Ok(*x),
                        _ => Err(Echec::hors_domaine("journal : liste non numérique")),
                    })
                    .collect(),
                _ => Err(Echec::hors_domaine("journal : liste attendue")),
            }
        };
        let n = |k: &str| fini(champ(v, k)).unwrap_or(0.0);
        Ok(Self {
            tentatives: n("tentatives"),
            mouvements: n("mouvements"),
            immobiles: n("immobiles"),
            sens: n("sensInverses"),
            illisibles: n("illisibles"),
            deplacements: nums("deplacements")?,
            zooms: nums("zooms")?,
        })
    }
    fn ecrire(&self) -> Valeur {
        obj(vec![
            ("tentatives", num(self.tentatives)),
            ("mouvements", num(self.mouvements)),
            ("immobiles", num(self.immobiles)),
            ("sensInverses", num(self.sens)),
            ("illisibles", num(self.illisibles)),
            ("deplacements", Valeur::Nombres(self.deplacements.clone())),
            ("zooms", Valeur::Nombres(self.zooms.clone())),
        ])
    }
}

struct Journal {
    g: Vec<Compte>,
}
impl Journal {
    fn vide() -> Self {
        Self {
            g: GESTES.iter().map(|_| Compte::vide()).collect(),
        }
    }
    fn lire(v: &Valeur) -> Result<Self, Echec> {
        let mut g = Vec::new();
        for nom in GESTES {
            g.push(Compte::lire(champ(champ(v, "g"), nom))?);
        }
        Ok(Self { g })
    }
    fn ecrire(&self) -> Valeur {
        obj(vec![(
            "g",
            obj(GESTES
                .iter()
                .zip(self.g.iter())
                .map(|(k, c)| (*k, c.ecrire()))
                .collect()),
        )])
    }
}

/// État de journal vide (trois gestes).
pub fn journal_vide() -> Valeur {
    Journal::vide().ecrire()
}

/// `Journal.noter`.
pub fn journal_noter(etat: &Valeur, geste: &Valeur, e: &Valeur) -> Result<Valeur, Echec> {
    let mut j = Journal::lire(etat)?;
    let Some(Valeur::Chaine(nom)) = Some(geste) else {
        return Ok(j.ecrire());
    };
    let Some(i) = GESTES.iter().position(|k| *k == nom.as_str()) else {
        return Ok(j.ecrire());
    };
    let Some(c) = j.g.get_mut(i) else {
        return Ok(j.ecrire());
    };
    let resultat = champ(e, "resultat");
    if resultat == &ch("illisible") {
        c.illisibles += 1.0;
        return Ok(j.ecrire());
    }
    c.tentatives += 1.0;
    if resultat == &ch("mouvement") {
        c.mouvements += 1.0;
    } else if resultat == &ch("immobile") {
        c.immobiles += 1.0;
    } else if resultat == &ch("sens-inverse") {
        c.sens += 1.0;
    }
    if resultat != &ch("immobile") {
        if let Some(d) = fini(champ(e, "deplacementMm")) {
            c.deplacements.push(d);
        }
        if let Some(z) = fini(champ(e, "zoom")) {
            c.zooms.push(z);
        }
    }
    Ok(j.ecrire())
}

/// `Journal.resume`.
pub fn journal_resume(etat: &Valeur) -> Result<Valeur, Echec> {
    let j = Journal::lire(etat)?;
    let mut taux_max = 0.0;
    let mut meilleur = nul();
    let mut gestes = Vec::new();
    for (nom, c) in GESTES.iter().zip(j.g.iter()) {
        let taux = if c.tentatives == 0.0 {
            0.0
        } else {
            nb(c.mouvements / c.tentatives, 1000.0).unwrap_or(0.0)
        };
        gestes.push((
            *nom,
            obj(vec![
                ("tentatives", num(c.tentatives)),
                ("mouvements", num(c.mouvements)),
                ("immobiles", num(c.immobiles)),
                ("sensInverses", num(c.sens)),
                ("illisibles", num(c.illisibles)),
                ("taux", num(taux)),
                (
                    "deplacementMedianMm",
                    ou_nul(med(&c.deplacements).and_then(|x| nb(x, 10.0))),
                ),
                (
                    "zoomMedian",
                    ou_nul(med(&c.zooms).and_then(|x| nb(x, 1000.0))),
                ),
            ]),
        ));
        if c.tentatives != 0.0 && taux > taux_max {
            taux_max = taux;
            meilleur = ch(nom);
        }
    }
    Ok(obj(vec![
        ("version", ch(VERSION)),
        ("gestes", obj(gestes)),
        ("meilleur", meilleur),
    ]))
}

fn seuil_inf(valeur: f64, seuil: &Valeur) -> Result<bool, Echec> {
    match seuil {
        Valeur::Indefini | Valeur::Nul => Ok(false),
        Valeur::Nombre(s) => Ok(valeur < *s),
        _ => Err(Echec::hors_domaine("seuil non numérique")),
    }
}

/// `juger(geste, plan, avant, apres, r)`.
pub fn juger(
    geste: &Valeur,
    plan: &Valeur,
    avant: &Valeur,
    apres: &Valeur,
    r: &Valeur,
) -> Result<Valeur, Echec> {
    let Some(e) = crate::gestes::ecart_camera(avant, apres)? else {
        return Ok(obj(vec![("resultat", ch("illisible"))]));
    };
    let dep_l = liste(champ(&e, "deplacementMm"))?;
    let dep = ariane_js::hypot(&[ou_zero(au(&dep_l, 0)), ou_zero(au(&dep_l, 1))]);
    let zoom = champ(&e, "zoom").clone();
    let dep_r = ou_nul(nb(dep, 10.0));
    let molette = matches!(geste, Valeur::Chaine(s) if s == "molette");
    if molette {
        // `!Number.isFinite(zoom)` court-circuite : le seuil n'est pas lu.
        let Some(z) = fini(&zoom) else {
            return Ok(obj(vec![
                ("resultat", ch("immobile")),
                ("deplacementMm", dep_r),
                ("zoom", zoom),
            ]));
        };
        if seuil_inf((z - 1.0).abs(), champ(r, "zoomMin"))? {
            return Ok(obj(vec![
                ("resultat", ch("immobile")),
                ("deplacementMm", dep_r),
                ("zoom", zoom),
            ]));
        }
        let un = num(1.0);
        let sens = ou(champ(plan, "sens"), &un);
        let sens_n = match sens {
            Valeur::Nombre(x) => *x,
            Valeur::Nul | Valeur::Indefini => 1.0,
            _ => return Err(Echec::hors_domaine("sens non numérique")),
        };
        let dezoom = sens_n >= 0.0;
        let mouvement = (z > 1.0) == dezoom;
        let resultat = if mouvement {
            "mouvement"
        } else {
            "sens-inverse"
        };
        return Ok(obj(vec![
            ("resultat", ch(resultat)),
            ("type", ch("zoom")),
            ("deplacementMm", dep_r),
            ("zoom", zoom),
        ]));
    }
    if seuil_inf(dep, champ(r, "mouvementMinMm"))? {
        return Ok(obj(vec![
            ("resultat", ch("immobile")),
            ("deplacementMm", dep_r),
            ("zoom", zoom),
        ]));
    }
    let x0 = opt_nombre(champ(plan, "x0"))?.unwrap_or(f64::NAN);
    let y0 = opt_nombre(champ(plan, "y0"))?.unwrap_or(f64::NAN);
    let x1 = opt_nombre(champ(plan, "x1"))?.unwrap_or(f64::NAN);
    let y1 = opt_nombre(champ(plan, "y1"))?.unwrap_or(f64::NAN);
    let dx = x1 - x0;
    let dy = y1 - y0;
    let a0 = au(&dep_l, 0).f();
    let a1 = au(&dep_l, 1).f();
    let scal = -dx * a0 + dy * a1;
    let resultat = if scal < 0.0 {
        "sens-inverse"
    } else {
        "mouvement"
    };
    Ok(obj(vec![
        ("resultat", ch(resultat)),
        ("type", ch("deplacement")),
        ("deplacementMm", dep_r),
        ("zoom", zoom),
    ]))
}

fn ou_zero(e: Elem) -> f64 {
    if Valeur::Nombre(e.f()).vrai() {
        e.f()
    } else {
        0.0
    }
}

fn ndc(v: &Valeur) -> Valeur {
    let t: Vec<f64> = match v {
        Valeur::Nombres(t) => t.clone(),
        Valeur::Tableau(t) if t.len() == 2 => {
            let mut o = Vec::new();
            for e in t {
                match e {
                    Some(Valeur::Nombre(x)) => o.push(*x),
                    _ => return nul(),
                }
            }
            o
        }
        _ => return nul(),
    };
    if t.len() != 2 || !t.iter().copied().all(f64::is_finite) {
        return nul();
    }
    let (Some(&a), Some(&b)) = (t.first(), t.get(1)) else {
        return nul();
    };
    Valeur::Nombres(vec![nb(a, 1000.0).unwrap_or(a), nb(b, 1000.0).unwrap_or(b)])
}

/// `gesteJournal`.
pub fn geste_journal(g: &Valeur) -> Result<Option<Valeur>, Echec> {
    if !g.vrai() || !matches!(g, Valeur::Objet(_) | Valeur::Tableau(_)) {
        return Ok(None);
    }
    let d = champ(g, "deplacement");
    let d = if d.vrai() && matches!(d, Valeur::Objet(_) | Valeur::Tableau(_)) {
        Some(d)
    } else {
        None
    };
    let tente = d.and_then(|x| entier(champ(x, "tentatives")));
    let ok = match d {
        Some(x) => Valeur::Booleen(matches!(champ(x, "ok"), Valeur::Booleen(true))),
        None => nul(),
    };
    Ok(Some(obj(vec![
        ("type", txt(champ(g, "type"), 20)?),
        (
            "geste",
            match d {
                Some(x) => txt(champ(x, "geste"), 24)?,
                None => nul(),
            },
        ),
        ("tentatives", ou_nul(tente)),
        ("ok", ok),
        (
            "raison",
            match d {
                Some(x) => txt(champ(x, "raison"), 40)?,
                None => nul(),
            },
        ),
        ("camera", txt(champ(g, "camera"), 20)?),
        (
            "sensInverse",
            Valeur::Booleen(matches!(champ(g, "sensInverse"), Valeur::Booleen(true))),
        ),
        ("crans", ou_nul(entier(champ(g, "crans")))),
        ("zoom", ou_nul(nb_v(champ(g, "zoom"), 1000.0))),
        ("ndcAvant", ndc(champ(g, "ndcAvant"))),
        ("ndcApres", ndc(champ(g, "ndcApres"))),
        ("dureeMs", ou_nul(nb_v(champ(g, "dureeMs"), 1.0))),
    ])))
}

/// `detailDeplacement`.
pub fn detail_deplacement(c: &Valeur, ctx: &Valeur) -> Result<Valeur, Echec> {
    if !c.vrai() || !matches!(c, Valeur::Objet(_) | Valeur::Tableau(_)) {
        return Ok(nul());
    }
    let mut gestes = Vec::new();
    let source: Vec<Valeur> = match champ(c, "gestes") {
        Valeur::Tableau(t) => t.iter().take(8).map(|e| e.clone().unwrap_or(IND)).collect(),
        _ => vec![],
    };
    for g in &source {
        if let Some(v) = geste_journal(g)? {
            gestes.push(v);
        }
    }
    let tent = gestes.iter().fold(0.0, |t, g| {
        let n = match champ(g, "tentatives") {
            Valeur::Nombre(x) if Valeur::Nombre(*x).vrai() => *x,
            _ => 0.0,
        };
        t + n
    });
    let geste = gestes
        .iter()
        .find_map(|g| match champ(g, "geste") {
            Valeur::Chaine(s) if !s.is_empty() => Some(ch(s)),
            _ => None,
        })
        .map_or_else(|| txt(champ(ctx, "geste"), 24), Ok)?;
    let pixel = champ(c, "pixelMm");
    let pixel = if pixel.vrai() && matches!(pixel, Valeur::Objet(_) | Valeur::Tableau(_)) {
        obj(vec![
            ("avant", ou_nul(nb_v(champ(pixel, "avant"), 1000.0))),
            ("apres", ou_nul(nb_v(champ(pixel, "apres"), 1000.0))),
        ])
    } else {
        nul()
    };
    let cote = match champ(c, "cote") {
        Valeur::Chaine(s) if s == "left" || s == "right" => ch(s),
        _ => nul(),
    };
    Ok(obj(vec![
        ("phase", txt(champ(ctx, "phase"), 12)?),
        ("cote", cote),
        ("geste", geste),
        (
            "ok",
            Valeur::Booleen(matches!(champ(c, "ok"), Valeur::Booleen(true))),
        ),
        ("raison", txt(champ(c, "raison"), 40)?),
        (
            "tentatives",
            if Valeur::Nombre(tent).vrai() {
                num(tent)
            } else {
                nul()
            },
        ),
        (
            "gestes",
            Valeur::Tableau(gestes.into_iter().map(Some).collect()),
        ),
        ("ndcAvant", ndc(champ(c, "ndcAvant"))),
        ("ndcApres", ndc(champ(c, "ndcApres"))),
        ("pixelMm", pixel),
        ("dureeMs", ou_nul(nb_v(champ(c, "dureeMs"), 1.0))),
    ]))
}

fn suite_echelle(s: &str) -> Option<f64> {
    let p = "(échelle à ";
    let r = s.strip_prefix(p)?;
    let b = r.as_bytes();
    let mut i = 0usize;
    if b.get(i).is_none_or(|c| !c.is_ascii_digit()) {
        return None;
    }
    while b.get(i).is_some_and(u8::is_ascii_digit) {
        i += 1;
    }
    if matches!(b.get(i), Some(b',' | b'.')) {
        let sep = i;
        i += 1;
        let debut = i;
        while b.get(i).is_some_and(u8::is_ascii_digit) {
            i += 1;
        }
        if i == debut {
            i = sep;
        }
    }
    let mut j = i;
    if b.get(j) == Some(&b' ') {
        j += 1;
    }
    if b.get(j) != Some(&b'%') {
        return None;
    }
    let brut = r.get(..i)?;
    brut.replace(',', ".").parse().ok()
}

fn ecart_dans_message(s: &str) -> Option<f64> {
    let marque = "Vue ESV non restituée";
    let mut reste = s;
    while let Some(i) = reste.find(marque) {
        let apres = reste.get(i + marque.len()..)?;
        let coupure = apres.find('(').unwrap_or(apres.len());
        if let Some(n) = apres.get(coupure..).and_then(suite_echelle) {
            return Some(n);
        }
        reste = reste.get(i + 1..)?;
    }
    None
}

fn base_remise(ctx: &Valeur) -> Result<Vec<(&'static str, Valeur)>, Echec> {
    Ok(vec![
        ("phase", txt(champ(ctx, "phase"), 12)?),
        (
            "dureeApplyMs",
            ou_nul(nb_v(champ(ctx, "dureeApplyMs"), 1.0)),
        ),
    ])
}

/// `detailRemise`.
pub fn detail_remise(remise: &Valeur, erreur: &Valeur, ctx: &Valeur) -> Result<Valeur, Echec> {
    let mut base = base_remise(ctx)?;
    if remise.vrai() && matches!(remise, Valeur::Objet(_) | Valeur::Tableau(_)) {
        let ok = matches!(champ(remise, "ok"), Valeur::Booleen(true));
        let crans = entier(champ(remise, "crans"));
        let recentre = matches!(champ(remise, "recentre"), Valeur::Booleen(true));
        let tentative = if let Some(c) = crans.filter(|c| *c > 0.0) {
            let repli = num(c);
            let denom_v = ou(champ(ctx, "cransMax"), &repli);
            let denom = match denom_v {
                Valeur::Nombre(x) => ariane_js::max(1.0, *x),
                _ => return Err(Echec::hors_domaine("cransMax non numérique")),
            };
            num(f64::ceil(c / denom))
        } else if recentre {
            num(1.0)
        } else {
            num(0.0)
        };
        base.extend([
            ("resultat", ch(if ok { "faite" } else { "echec" })),
            ("ok", Valeur::Booleen(ok)),
            (
                "ecartEchelle",
                ou_nul(nb_v(champ(remise, "ecartEchelle"), 1.0e6)),
            ),
            ("crans", ou_nul(crans)),
            ("recentre", Valeur::Booleen(recentre)),
            ("tentative", tentative),
            ("dureeMs", ou_nul(nb_v(champ(remise, "dureeMs"), 1.0))),
            ("raison", if ok { nul() } else { ch("vue-non-restituee") }),
            ("source", ch("rapport")),
        ]);
        return Ok(obj(base));
    }
    if let Valeur::Chaine(s) = erreur {
        if let Some(p) = ecart_dans_message(s) {
            base.extend([
                ("resultat", ch("echec")),
                ("ok", Valeur::Booleen(false)),
                ("ecartEchelle", ou_nul(nb(p / 100.0, 1.0e4))),
                ("crans", nul()),
                ("recentre", nul()),
                ("tentative", nul()),
                ("dureeMs", nul()),
                ("raison", ch("vue-non-restituee")),
                ("source", ch("message")),
            ]);
            return Ok(obj(base));
        }
        if s.starts_with("Vue ESV non recentrée sur le rail ") {
            base.extend([
                ("resultat", ch("echec")),
                ("ok", Valeur::Booleen(false)),
                ("ecartEchelle", nul()),
                ("crans", nul()),
                ("recentre", Valeur::Booleen(false)),
                ("tentative", nul()),
                ("dureeMs", nul()),
                ("raison", ch("recentrage-impossible")),
                ("source", ch("message")),
            ]);
            return Ok(obj(base));
        }
    }
    let bout = txt(erreur, 100)?;
    let bout = if bout.vrai() { bout } else { ch("?") };
    let mut raison = String::from("erreur:");
    if let Valeur::Chaine(s) = &bout {
        raison.push_str(s);
    }
    base.extend([
        ("resultat", ch("inconnu")),
        ("ok", Valeur::Booleen(false)),
        ("ecartEchelle", nul()),
        ("crans", nul()),
        ("recentre", nul()),
        ("tentative", nul()),
        ("dureeMs", nul()),
        ("raison", ch(&raison)),
        ("source", ch("erreur")),
    ]);
    Ok(obj(base))
}

#[derive(Clone, Copy)]
struct Bilan {
    dep: f64,
    reussis: f64,
    remises: f64,
    faites: f64,
    echecs: f64,
    inconnues: f64,
    temps: f64,
    ecart: f64,
}
impl Bilan {
    fn zero() -> Self {
        Self {
            dep: 0.0,
            reussis: 0.0,
            remises: 0.0,
            faites: 0.0,
            echecs: 0.0,
            inconnues: 0.0,
            temps: 0.0,
            ecart: 0.0,
        }
    }
    fn lire(v: &Valeur) -> Result<Self, Echec> {
        let n = |k: &str| match champ(v, k) {
            Valeur::Indefini => Ok(0.0),
            Valeur::Nombre(x) => Ok(*x),
            _ => Err(Echec::hors_domaine("bilan : champ non numérique")),
        };
        Ok(Self {
            dep: n("deplacements")?,
            reussis: n("reussis")?,
            remises: n("remises")?,
            faites: n("remisesFaites")?,
            echecs: n("echecs")?,
            inconnues: n("remisesInconnues")?,
            temps: n("tempsMs")?,
            ecart: n("ecartMax")?,
        })
    }
    fn ecrire(self) -> Valeur {
        obj(vec![
            ("deplacements", num(self.dep)),
            ("reussis", num(self.reussis)),
            ("remises", num(self.remises)),
            ("remisesFaites", num(self.faites)),
            ("echecs", num(self.echecs)),
            ("remisesInconnues", num(self.inconnues)),
            ("tempsMs", num(self.temps)),
            ("ecartMax", num(self.ecart)),
        ])
    }
}

pub fn bilan_vide() -> Valeur {
    Bilan::zero().ecrire()
}

pub fn bilan_noter_deplacement(etat: &Valeur, d: &Valeur) -> Result<Valeur, Echec> {
    let mut b = Bilan::lire(etat)?;
    if !d.vrai() {
        return Ok(b.ecrire());
    }
    b.dep += 1.0;
    if champ(d, "ok").vrai() {
        b.reussis += 1.0;
    } else {
        b.echecs += 1.0;
    }
    if let Some(ms) = fini(champ(d, "dureeMs")) {
        b.temps += ms;
    }
    Ok(b.ecrire())
}

pub fn bilan_noter_remise(etat: &Valeur, r: &Valeur) -> Result<Valeur, Echec> {
    let mut b = Bilan::lire(etat)?;
    if !r.vrai() {
        return Ok(b.ecrire());
    }
    b.remises += 1.0;
    match champ(r, "resultat") {
        Valeur::Chaine(s) if s == "faite" => b.faites += 1.0,
        Valeur::Chaine(s) if s == "echec" => b.echecs += 1.0,
        _ => b.inconnues += 1.0,
    }
    if let Some(ms) = fini(champ(r, "dureeMs")) {
        b.temps += ms;
    }
    if let Some(e) = fini(champ(r, "ecartEchelle")) {
        if e > b.ecart {
            b.ecart = e;
        }
    }
    Ok(b.ecrire())
}

pub fn bilan_est_vide(etat: &Valeur) -> Result<Valeur, Echec> {
    let b = Bilan::lire(etat)?;
    Ok(Valeur::Booleen(
        !num(b.dep).vrai() && !num(b.remises).vrai(),
    ))
}

pub fn bilan_resume(etat: &Valeur) -> Result<Valeur, Echec> {
    let b = Bilan::lire(etat)?;
    Ok(obj(vec![
        ("version", ch(VERSION)),
        ("deplacements", num(b.dep)),
        ("deplacementsReussis", num(b.reussis)),
        ("remises", num(b.remises)),
        ("remisesFaites", num(b.faites)),
        ("remisesInconnues", num(b.inconnues)),
        ("echecs", num(b.echecs)),
        ("tempsAjouteMs", ou_nul(nb(b.temps, 1.0))),
        ("ecartRemiseMax", ou_nul(nb(b.ecart, 1.0e6))),
    ]))
}
