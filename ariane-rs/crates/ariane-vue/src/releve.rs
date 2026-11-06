//! Relevé de l'Écho (`Releveur`) comme transitions pures : l'état voyage dans la valeur,
#![allow(clippy::float_cmp)] // `!==` du JS (NaN, −0) et identifiants entiers générés par le pas
//! `maintenant`, `estVue`, `camera`, `planifier` et `emettre` sont demandés à la façade.
use crate::gestes::{cle_camera, ecart_camera, resume_camera};
use crate::util::{ch, champ, fini, med, nb, nul, num, obj, ou_nul, IND};
use ariane_js::Echec;
use ariane_vba::Valeur;

const VERSION: &str = "gestes-vue-v1";

struct Regles {
    seuil: f64,
    serie: f64,
    sondage: f64,
    lectures: f64,
    stabilite: f64,
}

#[allow(clippy::struct_excessive_bools)] // drapeaux du glisser JS, un par champ observé
struct Glisser {
    gen: f64,
    t0: f64,
    x0: Valeur,
    y0: Valeur,
    x: Valeur,
    y: Valeur,
    id: Valeur,
    pointeur: Valeur,
    bouton: Valeur,
    boutons: Valeur,
    pas: f64,
    longueur: f64,
    clic: bool,
    auxclic: bool,
    menu: bool,
    cam: Valeur,
    t1: Option<f64>,
    annule: bool,
    hors: bool,
    attente: bool,
}

#[derive(Clone)]
struct Molette {
    gen: f64,
    t0: f64,
    dernier: f64,
    crans: f64,
    somme: f64,
    deltas: Vec<Valeur>,
    intervalles: Vec<f64>,
    mode: Valeur,
    delta_x: f64,
    cam: Valeur,
    legacy: Valeur,
    fini: bool,
}

#[allow(clippy::large_enum_variant)] // les deux gestes sont gros ; les boxer à chaque pas ne change pas le résultat
enum Charge {
    Glisser(Glisser),
    Molette(Molette),
}

struct Apres {
    id: f64,
    prec: Option<String>,
    stables: f64,
    t0: f64,
    charge: Charge,
}

struct Etat {
    r: Regles,
    glissers: Vec<Glisser>,
    courant: Option<f64>,
    molette: Option<Molette>,
    cg: f64,
    cm: f64,
    ci: f64,
    apres: Vec<Apres>,
    prochain: f64,
}

fn f_req(v: &Valeur) -> Result<f64, Echec> {
    fini(v).ok_or_else(|| Echec::hors_domaine("nombre fini attendu"))
}

fn regle(v: &Valeur, k: &str, defaut: f64) -> Result<f64, Echec> {
    match v.champ(k) {
        None => Ok(defaut),
        Some(x) => f_req(x),
    }
}

fn regs_de(v: &Valeur) -> Result<Regles, Echec> {
    let vide = obj(vec![]);
    let src = if matches!(v, Valeur::Objet(_)) {
        v
    } else if matches!(v, Valeur::Indefini | Valeur::Nul) {
        &vide
    } else {
        return Err(Echec::hors_domaine("réglages de relevé"));
    };
    Ok(Regles {
        seuil: regle(src, "seuilPx", 3.0)?,
        serie: regle(src, "serieMs", 400.0)?,
        sondage: regle(src, "sondageMs", 80.0)?,
        lectures: regle(src, "lecturesStables", 3.0)?,
        stabilite: regle(src, "stabiliteMaxMs", 1500.0)?,
    })
}

fn b(v: &Valeur, k: &str) -> bool {
    matches!(champ(v, k), Valeur::Booleen(true))
}

fn opt_f(v: &Valeur, k: &str) -> Result<Option<f64>, Echec> {
    match champ(v, k) {
        Valeur::Indefini | Valeur::Nul => Ok(None),
        Valeur::Nombre(x) => Ok(Some(*x)),
        _ => Err(Echec::hors_domaine("instant non numérique")),
    }
}

impl Glisser {
    fn lire(v: &Valeur) -> Result<Self, Echec> {
        Ok(Self {
            gen: f_req(champ(v, "gen"))?,
            t0: f_req(champ(v, "t0"))?,
            x0: champ(v, "x0").clone(),
            y0: champ(v, "y0").clone(),
            x: champ(v, "x").clone(),
            y: champ(v, "y").clone(),
            id: champ(v, "id").clone(),
            pointeur: champ(v, "pointeur").clone(),
            bouton: champ(v, "bouton").clone(),
            boutons: champ(v, "boutons").clone(),
            pas: f_req(champ(v, "pas"))?,
            longueur: f_req(champ(v, "longueur"))?,
            clic: b(v, "clic"),
            auxclic: b(v, "auxclic"),
            menu: b(v, "menu"),
            cam: champ(v, "cam").clone(),
            t1: opt_f(v, "t1")?,
            annule: b(v, "annule"),
            hors: b(v, "hors"),
            attente: b(v, "attente"),
        })
    }
    fn ecrire(&self) -> Valeur {
        obj(vec![
            ("gen", num(self.gen)),
            ("t0", num(self.t0)),
            ("x0", self.x0.clone()),
            ("y0", self.y0.clone()),
            ("x", self.x.clone()),
            ("y", self.y.clone()),
            ("id", self.id.clone()),
            ("pointeur", self.pointeur.clone()),
            ("bouton", self.bouton.clone()),
            ("boutons", self.boutons.clone()),
            ("pas", num(self.pas)),
            ("longueur", num(self.longueur)),
            ("clic", Valeur::Booleen(self.clic)),
            ("auxclic", Valeur::Booleen(self.auxclic)),
            ("menu", Valeur::Booleen(self.menu)),
            ("cam", self.cam.clone()),
            ("t1", self.t1.map_or(IND, num)),
            ("annule", Valeur::Booleen(self.annule)),
            ("hors", Valeur::Booleen(self.hors)),
            ("attente", Valeur::Booleen(self.attente)),
        ])
    }
}

impl Molette {
    fn lire(v: &Valeur) -> Result<Self, Echec> {
        let deltas = match champ(v, "deltas") {
            Valeur::Tableau(t) => t.iter().map(|e| e.clone().unwrap_or(IND)).collect(),
            Valeur::Nombres(t) => t.iter().copied().map(num).collect(),
            Valeur::Indefini => vec![],
            _ => return Err(Echec::hors_domaine("deltas")),
        };
        let intervalles = match champ(v, "intervalles") {
            Valeur::Nombres(t) => t.clone(),
            Valeur::Tableau(t) => t
                .iter()
                .map(|e| match e {
                    Some(Valeur::Nombre(x)) => Ok(*x),
                    _ => Err(Echec::hors_domaine("intervalle")),
                })
                .collect::<Result<_, _>>()?,
            Valeur::Indefini => vec![],
            _ => return Err(Echec::hors_domaine("intervalles")),
        };
        Ok(Self {
            gen: f_req(champ(v, "gen"))?,
            t0: f_req(champ(v, "t0"))?,
            dernier: f_req(champ(v, "dernier"))?,
            crans: f_req(champ(v, "crans"))?,
            somme: f_req(champ(v, "somme"))?,
            deltas,
            intervalles,
            mode: champ(v, "mode").clone(),
            delta_x: f_req(champ(v, "deltaX"))?,
            cam: champ(v, "cam").clone(),
            legacy: champ(v, "legacy").clone(),
            fini: b(v, "fini"),
        })
    }
    fn ecrire(&self) -> Valeur {
        obj(vec![
            ("gen", num(self.gen)),
            ("t0", num(self.t0)),
            ("dernier", num(self.dernier)),
            ("crans", num(self.crans)),
            ("somme", num(self.somme)),
            (
                "deltas",
                Valeur::Tableau(self.deltas.iter().cloned().map(Some).collect()),
            ),
            ("intervalles", Valeur::Nombres(self.intervalles.clone())),
            ("mode", self.mode.clone()),
            ("deltaX", num(self.delta_x)),
            ("cam", self.cam.clone()),
            ("legacy", self.legacy.clone()),
            ("fini", Valeur::Booleen(self.fini)),
        ])
    }
}

impl Charge {
    fn lire(v: &Valeur) -> Result<Self, Echec> {
        match champ(v, "genre") {
            Valeur::Chaine(s) if s == "glisser" => Ok(Self::Glisser(Glisser::lire(v)?)),
            Valeur::Chaine(s) if s == "molette" => Ok(Self::Molette(Molette::lire(v)?)),
            _ => Err(Echec::hors_domaine("charge de relevé")),
        }
    }
    fn ecrire(&self) -> Valeur {
        match self {
            Self::Glisser(g) => {
                let mut o = g.ecrire();
                if let Valeur::Objet(p) = &mut o {
                    p.insert(0, ("genre".into(), ch("glisser")));
                }
                o
            }
            Self::Molette(m) => {
                let mut o = m.ecrire();
                if let Valeur::Objet(p) = &mut o {
                    p.insert(0, ("genre".into(), ch("molette")));
                }
                o
            }
        }
    }
}

impl Apres {
    fn lire(v: &Valeur) -> Result<Self, Echec> {
        let prec = match champ(v, "prec") {
            Valeur::Chaine(s) => Some(s.clone()),
            Valeur::Nul | Valeur::Indefini => None,
            _ => return Err(Echec::hors_domaine("prec")),
        };
        Ok(Self {
            id: f_req(champ(v, "id"))?,
            prec,
            stables: f_req(champ(v, "stables"))?,
            t0: f_req(champ(v, "t0"))?,
            charge: Charge::lire(champ(v, "charge"))?,
        })
    }
    fn ecrire(&self) -> Valeur {
        obj(vec![
            ("id", num(self.id)),
            ("prec", self.prec.as_deref().map_or(nul(), ch)),
            ("stables", num(self.stables)),
            ("t0", num(self.t0)),
            ("charge", self.charge.ecrire()),
        ])
    }
}

impl Etat {
    fn creer(reglages: &Valeur) -> Result<Self, Echec> {
        Ok(Self {
            r: regs_de(reglages)?,
            glissers: vec![],
            courant: None,
            molette: None,
            cg: 0.0,
            cm: 0.0,
            ci: 0.0,
            apres: vec![],
            prochain: 1.0,
        })
    }
    fn lire(v: &Valeur) -> Result<Self, Echec> {
        let r = champ(v, "r");
        let glissers = match champ(v, "glissers") {
            Valeur::Tableau(t) => t
                .iter()
                .map(|e| Glisser::lire(e.as_ref().unwrap_or(&IND)))
                .collect::<Result<_, _>>()?,
            _ => return Err(Echec::hors_domaine("glissers")),
        };
        let apres = match champ(v, "apres") {
            Valeur::Tableau(t) => t
                .iter()
                .map(|e| Apres::lire(e.as_ref().unwrap_or(&IND)))
                .collect::<Result<_, _>>()?,
            _ => return Err(Echec::hors_domaine("apres")),
        };
        let compte = champ(v, "compte");
        let courant = opt_f(v, "courant")?;
        let molette = match champ(v, "molette") {
            Valeur::Nul | Valeur::Indefini => None,
            autre => Some(Molette::lire(autre)?),
        };
        Ok(Self {
            r: Regles {
                seuil: f_req(champ(r, "seuilPx"))?,
                serie: f_req(champ(r, "serieMs"))?,
                sondage: f_req(champ(r, "sondageMs"))?,
                lectures: f_req(champ(r, "lecturesStables"))?,
                stabilite: f_req(champ(r, "stabiliteMaxMs"))?,
            },
            glissers,
            courant,
            molette,
            cg: f_req(champ(compte, "glissers"))?,
            cm: f_req(champ(compte, "molettes"))?,
            ci: f_req(champ(compte, "ignores"))?,
            apres,
            prochain: f_req(champ(v, "prochain"))?,
        })
    }
    fn ecrire(&self) -> Valeur {
        obj(vec![
            (
                "r",
                obj(vec![
                    ("seuilPx", num(self.r.seuil)),
                    ("serieMs", num(self.r.serie)),
                    ("sondageMs", num(self.r.sondage)),
                    ("lecturesStables", num(self.r.lectures)),
                    ("stabiliteMaxMs", num(self.r.stabilite)),
                ]),
            ),
            (
                "glissers",
                Valeur::Tableau(self.glissers.iter().map(|g| Some(g.ecrire())).collect()),
            ),
            ("courant", self.courant.map_or(nul(), num)),
            (
                "molette",
                self.molette.as_ref().map_or(nul(), Molette::ecrire),
            ),
            (
                "compte",
                obj(vec![
                    ("glissers", num(self.cg)),
                    ("molettes", num(self.cm)),
                    ("ignores", num(self.ci)),
                ]),
            ),
            (
                "apres",
                Valeur::Tableau(self.apres.iter().map(|a| Some(a.ecrire())).collect()),
            ),
            ("prochain", num(self.prochain)),
        ])
    }
    fn alloc(&mut self) -> f64 {
        let n = self.prochain;
        self.prochain += 1.0;
        n
    }
}

fn phase_de(action: &Valeur) -> &str {
    match champ(action, "phase") {
        Valeur::Chaine(s) => s.as_str(),
        _ => "debut",
    }
}
fn reponse(action: &Valeur) -> &Valeur {
    champ(action, "reponse")
}
fn mem(action: &Valeur) -> &Valeur {
    champ(action, "mem")
}

fn paquet(etat: Valeur, demande: Valeur, phase: Valeur, mem: Valeur) -> Valeur {
    obj(vec![
        ("etat", etat),
        ("demande", demande),
        ("phase", phase),
        ("mem", mem),
    ])
}
fn fin(etat: &Etat) -> Valeur {
    paquet(etat.ecrire(), nul(), nul(), nul())
}
fn hote(etat: &Etat, quoi: &str, phase: &str, mem: Valeur) -> Valeur {
    paquet(etat.ecrire(), obj(vec![("quoi", ch(quoi))]), ch(phase), mem)
}
fn plan(etat: &Etat, ms: f64, suite: Valeur, phase: Valeur, mem: Valeur) -> Valeur {
    paquet(
        etat.ecrire(),
        obj(vec![
            ("quoi", ch("planifier")),
            ("ms", num(ms)),
            ("suite", suite),
        ]),
        phase,
        mem,
    )
}
fn emet(etat: &Etat, resume: Valeur) -> Valeur {
    paquet(
        etat.ecrire(),
        obj(vec![("quoi", ch("emettre")), ("resume", resume)]),
        nul(),
        nul(),
    )
}

fn f_de(v: &Valeur) -> Result<f64, Echec> {
    match v {
        Valeur::Nombre(x) => Ok(*x),
        Valeur::Nul => Ok(0.0),
        Valeur::Indefini => Ok(f64::NAN),
        _ => Err(Echec::hors_domaine("coordonnée non numérique")),
    }
}
fn ou_zero_brut(v: &Valeur) -> Result<f64, Echec> {
    if !v.vrai() {
        return Ok(0.0);
    }
    match v {
        Valeur::Nombre(x) => Ok(*x),
        _ => Err(Echec::hors_domaine("delta non numérique")),
    }
}
fn id_bloque(stocke: &Valeur, evt: &Valeur) -> Result<bool, Echec> {
    if matches!(stocke, Valeur::Indefini | Valeur::Nul) {
        return Ok(false);
    }
    match (stocke, evt) {
        (Valeur::Nombre(a), Valeur::Nombre(b)) => Ok(*a != *b),
        (Valeur::Nombre(_), Valeur::Indefini | Valeur::Nul) => Ok(true),
        _ => Err(Echec::hors_domaine("pointerId non numérique")),
    }
}
fn coalescent(nouveau: &Valeur, ancien: &Valeur) -> Valeur {
    if matches!(nouveau, Valeur::Indefini | Valeur::Nul) {
        ancien.clone()
    } else {
        nouveau.clone()
    }
}
fn ptr(v: &Valeur) -> Valeur {
    match v {
        Valeur::Chaine(s) if !s.is_empty() => ch(s),
        _ => nul(),
    }
}

fn prendre_glisser(etat: &mut Etat, gen: f64) -> Result<Glisser, Echec> {
    let pos = etat
        .glissers
        .iter()
        .position(|g| g.gen == gen)
        .ok_or_else(|| Echec::hors_domaine("glisser inconnu"))?;
    let g = etat.glissers.remove(pos);
    if etat.courant == Some(gen) {
        etat.courant = None;
    }
    Ok(g)
}

fn resume_glisser(g: &Glisser, cam: &Valeur, stable: bool) -> Result<Valeur, Echec> {
    let (x, y, x0, y0) = (f_de(&g.x)?, f_de(&g.y)?, f_de(&g.x0)?, f_de(&g.y0)?);
    let net = ariane_js::hypot(&[x - x0, y - y0]);
    let mut camera = vec![
        ("avant", resume_camera(&g.cam)?),
        ("apres", resume_camera(cam)?),
        ("stable", Valeur::Booleen(stable)),
    ];
    if let Some(e) = ecart_camera(&g.cam, cam)? {
        camera.push(("deplacementMm", champ(&e, "deplacementMm").clone()));
        camera.push(("zoom", champ(&e, "zoom").clone()));
    }
    let duree = match g.t1 {
        Some(t1) => ariane_js::round(t1 - g.t0),
        None => f64::NAN,
    };
    Ok(obj(vec![
        ("version", ch(VERSION)),
        ("type", ch("glisser")),
        ("bouton", g.bouton.clone()),
        ("boutons", g.boutons.clone()),
        ("pointeur", g.pointeur.clone()),
        ("dxPx", ou_nul(nb(x - x0, 10.0))),
        ("dyPx", ou_nul(nb(y - y0, 10.0))),
        ("distancePx", ou_nul(nb(net, 10.0))),
        ("longueurPx", ou_nul(nb(g.longueur, 10.0))),
        ("pas", num(g.pas)),
        ("dureeMs", num(duree)),
        ("clic", Valeur::Booleen(g.clic)),
        ("auxclic", Valeur::Booleen(g.auxclic)),
        ("menuContextuel", Valeur::Booleen(g.menu)),
        ("annule", Valeur::Booleen(g.annule)),
        ("finHorsVue", Valeur::Booleen(g.hors)),
        ("camera", obj(camera)),
        ("debutMs", num(g.t0)),
    ]))
}

fn resume_molette(m: &Molette, cam: &Valeur, stable: bool) -> Result<Valeur, Echec> {
    let mut camera = vec![
        ("avant", resume_camera(&m.cam)?),
        ("apres", resume_camera(cam)?),
        ("stable", Valeur::Booleen(stable)),
    ];
    if let Some(e) = ecart_camera(&m.cam, cam)? {
        camera.push(("deplacementMm", champ(&e, "deplacementMm").clone()));
        camera.push(("zoom", champ(&e, "zoom").clone()));
    }
    Ok(obj(vec![
        ("version", ch(VERSION)),
        ("type", ch("molette")),
        ("crans", num(m.crans)),
        ("sens", num(ariane_js::sign(m.somme))),
        (
            "deltaY",
            Valeur::Tableau(m.deltas.iter().cloned().map(Some).collect()),
        ),
        ("deltaMode", m.mode.clone()),
        ("sommeDeltaY", ou_nul(nb(m.somme, 10.0))),
        ("deltaX", ou_nul(nb(m.delta_x, 10.0))),
        ("wheelDeltaY", m.legacy.clone()),
        ("dureeMs", num(ariane_js::round(m.dernier - m.t0))),
        (
            "intervalleMs",
            ou_nul(med(&m.intervalles).and_then(|x| nb(x, 10.0))),
        ),
        ("camera", obj(camera)),
        ("debutMs", num(m.t0)),
    ]))
}

fn terminer(etat: &mut Etat, id: f64, cam: &Valeur, stable: bool) -> Result<Valeur, Echec> {
    let pos = etat
        .apres
        .iter()
        .position(|a| a.id == id)
        .ok_or_else(|| Echec::hors_domaine("tour inconnu"))?;
    let apres = etat.apres.remove(pos);
    let resume = match &apres.charge {
        Charge::Glisser(g) => {
            etat.cg += 1.0;
            resume_glisser(g, cam, stable)?
        }
        Charge::Molette(m) => {
            etat.cm += 1.0;
            resume_molette(m, cam, stable)?
        }
    };
    Ok(emet(etat, resume))
}

fn tour(etat: &mut Etat, action: &Valeur) -> Result<Valeur, Echec> {
    let id = f_req(champ(action, "id"))?;
    match phase_de(action) {
        "debut" => Ok(hote(etat, "camera", "tr-cam", obj(vec![("id", num(id))]))),
        "tr-cam" => {
            let cam = reponse(action).clone();
            let pos = etat
                .apres
                .iter()
                .position(|a| a.id == id)
                .ok_or_else(|| Echec::hors_domaine("tour inconnu"))?;
            let cle = cle_camera(&cam)?;
            let assez = {
                let a = etat
                    .apres
                    .get_mut(pos)
                    .ok_or_else(|| Echec::hors_domaine("tour"))?;
                let meme = match (&cle, &a.prec) {
                    (Some(c), Some(p)) => c == p,
                    _ => false,
                };
                a.stables = if cle.is_some() && meme {
                    a.stables + 1.0
                } else {
                    0.0
                };
                a.prec = cle;
                a.stables >= etat.r.lectures - 1.0
            };
            if assez {
                return terminer(etat, id, &cam, true);
            }
            let mem = obj(vec![("id", num(id)), ("cam", cam)]);
            Ok(hote(etat, "maintenant", "tr-temps", mem))
        }
        "tr-temps" => {
            let maintenant = f_req(reponse(action))?;
            let cam = champ(mem(action), "cam").clone();
            let t0 = etat
                .apres
                .iter()
                .find(|a| a.id == id)
                .map(|a| a.t0)
                .ok_or_else(|| Echec::hors_domaine("tour"))?;
            if maintenant - t0 >= etat.r.stabilite {
                terminer(etat, id, &cam, false)
            } else {
                Ok(plan(
                    etat,
                    etat.r.sondage,
                    obj(vec![("faire", ch("tour")), ("id", num(id))]),
                    nul(),
                    nul(),
                ))
            }
        }
        _ => Err(Echec::hors_domaine("phase de tour")),
    }
}

fn armer_apres(etat: &mut Etat, charge: Charge, t0: f64, delai: f64) -> Valeur {
    let id = etat.alloc();
    etat.apres.push(Apres {
        id,
        prec: None,
        stables: 0.0,
        t0,
        charge,
    });
    plan(
        etat,
        delai,
        obj(vec![("faire", ch("tour")), ("id", num(id))]),
        nul(),
        nul(),
    )
}

fn finir_glisser(etat: &mut Etat, action: &Valeur) -> Result<Valeur, Echec> {
    match phase_de(action) {
        "debut" => {
            let gen = f_req(champ(action, "gen"))?;
            let g = prendre_glisser(etat, gen)?;
            let net = ariane_js::hypot(&[f_de(&g.x)? - f_de(&g.x0)?, f_de(&g.y)? - f_de(&g.y0)?]);
            let clic = matches!(g.bouton, Valeur::Nombre(b) if b == 0.0)
                && net < etat.r.seuil
                && g.longueur < etat.r.seuil;
            if clic {
                return Ok(fin(etat));
            }
            Ok(hote(
                etat,
                "maintenant",
                "fg-t0",
                obj(vec![("charge", Charge::Glisser(g).ecrire())]),
            ))
        }
        "fg-t0" => {
            let t0 = f_req(reponse(action))?;
            let charge = Charge::lire(champ(mem(action), "charge"))?;
            Ok(armer_apres(etat, charge, t0, etat.r.sondage))
        }
        _ => Err(Echec::hors_domaine("phase de fin de glisser")),
    }
}

fn preparer_molette(etat: &mut Etat, m: Molette) -> Valeur {
    // `finirMolette` : retire la molette courante si c'est elle, puis attend `t0` (sauf si déjà finie).
    let gen = m.gen;
    if etat.molette.as_ref().is_some_and(|c| c.gen == gen) {
        etat.molette = None;
    }
    if m.fini {
        return fin(etat);
    }
    let mut m = m;
    m.fini = true;
    hote(
        etat,
        "maintenant",
        "fm-t0",
        obj(vec![("charge", Charge::Molette(m).ecrire())]),
    )
}

fn finir_molette_t0(etat: &mut Etat, action: &Valeur, ensuite: Valeur) -> Result<Valeur, Echec> {
    let t0 = f_req(reponse(action))?;
    let charge = Charge::lire(champ(mem(action), "charge"))?;
    let id = etat.alloc();
    etat.apres.push(Apres {
        id,
        prec: None,
        stables: 0.0,
        t0,
        charge,
    });
    // délai 0 ; `ensuite` non nul : la façade continue l'événement (nouvelle série) après avoir planifié.
    Ok(plan(
        etat,
        0.0,
        obj(vec![("faire", ch("tour")), ("id", num(id))]),
        ensuite,
        mem(action).clone(),
    ))
}

fn garde(etat: &mut Etat, action: &Valeur) -> Result<Valeur, Echec> {
    let gen = f_req(champ(action, "gen"))?;
    match phase_de(action) {
        "debut" => {
            let courant = etat.molette.as_ref().is_some_and(|m| m.gen == gen);
            if !courant {
                return Ok(fin(etat));
            }
            Ok(hote(
                etat,
                "maintenant",
                "gm-t",
                obj(vec![("gen", num(gen))]),
            ))
        }
        "gm-t" => {
            let maintenant = f_req(reponse(action))?;
            let Some(m) = etat.molette.clone() else {
                return Ok(fin(etat));
            };
            if m.gen != gen || maintenant - m.dernier < etat.r.serie {
                return Ok(fin(etat));
            }
            Ok(preparer_molette(etat, m))
        }
        "fm-t0" => finir_molette_t0(etat, action, nul()),
        _ => Err(Echec::hors_domaine("phase de garde")),
    }
}

fn legacy_de(v: &Valeur) -> Valeur {
    fini(v).map_or(nul(), num)
}

fn ajouter_cran(m: &mut Molette, e: &Valeur, t: f64) -> Result<(), Echec> {
    m.crans += 1.0;
    m.somme += ou_zero_brut(champ(e, "deltaY"))?;
    m.delta_x += ou_zero_brut(champ(e, "deltaX"))?;
    if m.deltas.len() < 4 {
        m.deltas.push(champ(e, "deltaY").clone());
    }
    m.dernier = t;
    Ok(())
}

fn nouvelle_molette(etat: &mut Etat, e: &Valeur, t: f64, cam: Valeur) -> Result<(), Echec> {
    let gen = etat.alloc();
    etat.molette = Some(Molette {
        gen,
        t0: t,
        dernier: t,
        crans: 0.0,
        somme: 0.0,
        deltas: vec![],
        intervalles: vec![],
        mode: champ(e, "deltaMode").clone(),
        delta_x: 0.0,
        cam,
        legacy: legacy_de(champ(e, "wheelDeltaY")),
        fini: false,
    });
    let m = etat
        .molette
        .as_mut()
        .ok_or_else(|| Echec::hors_domaine("molette"))?;
    ajouter_cran(m, e, t)
}

fn evenement(etat: &mut Etat, action: &Valeur) -> Result<Valeur, Echec> {
    let e = champ(action, "e");
    let type_ = match champ(e, "type") {
        Valeur::Chaine(s) => s.as_str(),
        Valeur::Indefini => "",
        _ => return Err(Echec::hors_domaine("type d'événement")),
    };
    match phase_de(action) {
        "debut" => Ok(hote(etat, "maintenant", "avec-t", nul())),
        "avec-t" => {
            let t = f_req(reponse(action))?;
            let mem = obj(vec![("t", num(t))]);
            match type_ {
                "pointerdown" => Ok(hote(etat, "cibleEstVue", "pd-vue", mem)),
                "pointermove" => {
                    bouger(etat, e)?;
                    Ok(fin(etat))
                }
                "pointerup" | "pointercancel" => monter(etat, e, t, type_ == "pointercancel"),
                "click" | "auxclick" => {
                    clic(etat, t, type_ == "click");
                    Ok(fin(etat))
                }
                "contextmenu" => {
                    if let Some(g) = courant_mut(etat) {
                        g.menu = true;
                    }
                    Ok(fin(etat))
                }
                "wheel" => Ok(hote(etat, "cibleEstVue", "wh-vue", mem)),
                _ => Ok(fin(etat)),
            }
        }
        "pd-vue" => {
            if !reponse(action).vrai() {
                return Ok(fin(etat));
            }
            Ok(hote(etat, "camera", "pd-cam", mem(action).clone()))
        }
        "pd-cam" => {
            poser_glisser(
                etat,
                e,
                f_req(champ(mem(action), "t"))?,
                reponse(action).clone(),
            );
            Ok(fin(etat))
        }
        "pu-vue" => {
            let gen = f_req(champ(mem(action), "gen"))?;
            if let Some(g) = etat.glissers.iter_mut().find(|g| g.gen == gen) {
                g.hors = !reponse(action).vrai();
                g.attente = true;
            }
            Ok(plan(
                etat,
                0.0,
                obj(vec![("faire", ch("finirGlisser")), ("gen", num(gen))]),
                nul(),
                nul(),
            ))
        }
        "wh-vue" => {
            if !reponse(action).vrai() {
                return Ok(fin(etat));
            }
            let t = f_req(champ(mem(action), "t"))?;
            let expire = match &etat.molette {
                None => true,
                Some(m) => t - m.dernier > etat.r.serie,
            };
            if expire {
                if let Some(m) = etat.molette.clone() {
                    let mut memoire = mem(action).clone();
                    if let Valeur::Objet(p) = &mut memoire {
                        p.push(("suite".into(), ch("wh-suite")));
                    }
                    let debut = preparer_molette(etat, m);
                    return Ok(joindre_mem(debut, &memoire));
                }
                Ok(hote(etat, "camera", "wh-cam", mem(action).clone()))
            } else {
                if let Some(m) = etat.molette.as_mut() {
                    m.intervalles.push(t - m.dernier);
                }
                let m = etat
                    .molette
                    .as_mut()
                    .ok_or_else(|| Echec::hors_domaine("molette"))?;
                ajouter_cran(m, e, t)?;
                let gen = m.gen;
                Ok(plan(
                    etat,
                    etat.r.serie + 5.0,
                    obj(vec![("faire", ch("gardeMolette")), ("gen", num(gen))]),
                    nul(),
                    nul(),
                ))
            }
        }
        "fm-t0" => {
            let suite = champ(mem(action), "suite").clone();
            let phase = if matches!(suite, Valeur::Chaine(_)) {
                suite
            } else {
                nul()
            };
            finir_molette_t0(etat, action, phase)
        }
        "wh-suite" => Ok(hote(etat, "camera", "wh-cam", mem(action).clone())),
        "wh-cam" => {
            let t = f_req(champ(mem(action), "t"))?;
            nouvelle_molette(etat, e, t, reponse(action).clone())?;
            let gen = etat
                .molette
                .as_ref()
                .map(|m| m.gen)
                .ok_or_else(|| Echec::hors_domaine("molette"))?;
            Ok(plan(
                etat,
                etat.r.serie + 5.0,
                obj(vec![("faire", ch("gardeMolette")), ("gen", num(gen))]),
                nul(),
                nul(),
            ))
        }
        _ => Err(Echec::hors_domaine("phase d'événement")),
    }
}

fn fusion(base: Valeur, extra: &Valeur) -> Valeur {
    let mut paires = match base {
        Valeur::Objet(p) => p,
        autre => vec![("valeur".into(), autre)],
    };
    if let Valeur::Objet(e) = extra {
        for (k, v) in e {
            if let Some(slot) = paires.iter_mut().find(|(kk, _)| kk == k) {
                slot.1 = v.clone();
            } else {
                paires.push((k.clone(), v.clone()));
            }
        }
    }
    Valeur::Objet(paires)
}

fn joindre_mem(paquet_hote: Valeur, memoire: &Valeur) -> Valeur {
    let mut v = paquet_hote;
    if let Valeur::Objet(p) = &mut v {
        let actuel = p
            .iter()
            .find(|(k, _)| k == "mem")
            .map_or_else(nul, |(_, x)| x.clone());
        let fusionne = fusion(actuel, memoire);
        if let Some(slot) = p.iter_mut().find(|(k, _)| k == "mem") {
            slot.1 = fusionne;
        } else {
            p.push(("mem".into(), fusionne));
        }
    }
    v
}

fn courant_mut(etat: &mut Etat) -> Option<&mut Glisser> {
    let gen = etat.courant?;
    etat.glissers.iter_mut().find(|g| g.gen == gen)
}

fn bouger(etat: &mut Etat, e: &Valeur) -> Result<(), Echec> {
    let Some(gen) = etat.courant else {
        return Ok(());
    };
    let evt_id = champ(e, "pointerId");
    let bloque = {
        let Some(g) = etat.glissers.iter().find(|g| g.gen == gen) else {
            return Ok(());
        };
        if g.t1.is_some() || id_bloque(&g.id, evt_id)? {
            return Ok(());
        }
        false
    };
    let _ = bloque;
    let Some(g) = etat.glissers.iter_mut().find(|g| g.gen == gen) else {
        return Ok(());
    };
    let dx = f_de(champ(e, "clientX"))? - f_de(&g.x)?;
    let dy = f_de(champ(e, "clientY"))? - f_de(&g.y)?;
    g.pas += 1.0;
    g.longueur += ariane_js::hypot(&[dx, dy]);
    g.x = champ(e, "clientX").clone();
    g.y = champ(e, "clientY").clone();
    Ok(())
}

fn monter(etat: &mut Etat, e: &Valeur, t: f64, annule: bool) -> Result<Valeur, Echec> {
    let Some(gen) = etat.courant else {
        return Ok(fin(etat));
    };
    let evt_id = champ(e, "pointerId").clone();
    let garde = {
        let Some(g) = etat.glissers.iter().find(|g| g.gen == gen) else {
            return Ok(fin(etat));
        };
        g.t1.is_some() || id_bloque(&g.id, &evt_id)?
    };
    if garde {
        return Ok(fin(etat));
    }
    if let Some(g) = etat.glissers.iter_mut().find(|g| g.gen == gen) {
        g.t1 = Some(t);
        g.annule = annule;
        g.x = coalescent(champ(e, "clientX"), &g.x);
        g.y = coalescent(champ(e, "clientY"), &g.y);
    }
    let mem = obj(vec![("t", num(t)), ("gen", num(gen))]);
    Ok(hote(etat, "cibleEstVue", "pu-vue", mem))
}

fn clic(etat: &mut Etat, t: f64, est_clic: bool) {
    let Some(g) = courant_mut(etat) else { return };
    if g.t1.is_some_and(|t1| t - t1 <= 50.0) {
        if est_clic {
            g.clic = true;
        } else {
            g.auxclic = true;
        }
    }
}

fn poser_glisser(etat: &mut Etat, e: &Valeur, t: f64, cam: Valeur) {
    if let Some(gen) = etat.courant {
        let abandon = etat
            .glissers
            .iter()
            .find(|g| g.gen == gen)
            .is_some_and(|g| !g.attente);
        if abandon {
            etat.glissers.retain(|g| g.gen != gen);
        }
    }
    let gen = etat.alloc();
    etat.courant = Some(gen);
    etat.glissers.push(Glisser {
        gen,
        t0: t,
        x0: champ(e, "clientX").clone(),
        y0: champ(e, "clientY").clone(),
        x: champ(e, "clientX").clone(),
        y: champ(e, "clientY").clone(),
        id: champ(e, "pointerId").clone(),
        pointeur: ptr(champ(e, "pointerType")),
        bouton: champ(e, "button").clone(),
        boutons: champ(e, "buttons").clone(),
        pas: 0.0,
        longueur: 0.0,
        clic: false,
        auxclic: false,
        menu: false,
        cam,
        t1: None,
        annule: false,
        hors: false,
        attente: false,
    });
}

/// Un pas du relevé. `action.faire` : `creer`, `evenement`, `finirGlisser`, `gardeMolette`, `tour`.
pub fn pas(entree: &Valeur) -> Result<Valeur, Echec> {
    let action = champ(entree, "action");
    match champ(action, "faire") {
        Valeur::Chaine(s) if s == "creer" => {
            let reglages = champ(action, "reglages");
            let src = if matches!(reglages, Valeur::Indefini) {
                champ(entree, "reglages")
            } else {
                reglages
            };
            Ok(fin(&Etat::creer(src)?))
        }
        Valeur::Chaine(s) if s == "evenement" => {
            let mut e = Etat::lire(champ(entree, "etat"))?;
            evenement(&mut e, action)
        }
        Valeur::Chaine(s) if s == "finirGlisser" => {
            let mut e = Etat::lire(champ(entree, "etat"))?;
            finir_glisser(&mut e, action)
        }
        Valeur::Chaine(s) if s == "gardeMolette" => {
            let mut e = Etat::lire(champ(entree, "etat"))?;
            garde(&mut e, action)
        }
        Valeur::Chaine(s) if s == "tour" => {
            let mut e = Etat::lire(champ(entree, "etat"))?;
            tour(&mut e, action)
        }
        _ => Err(Echec::hors_domaine("relevé : action inconnue")),
    }
}
