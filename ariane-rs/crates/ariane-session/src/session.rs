//! `src/native-session.js` : fonctions pures et méthodes de `Sessions` dont l'état passe en entrée.
//! Les réglages (`S.echo.*`, `S.export.watermarkBytes`) et ce que la méthode lit de `this` viennent de la façade ;
//! une méthode qui modifie un objet rend l'objet modifié, et la façade le recopie en place (voir facade-session.js).
//! Toute entrée où le JS lèverait au milieu d'une modification, ou convertirait une chaîne ou un objet en nombre, est
//! hors domaine : la façade rejoue le JS, qui fait exactement ce qu'il faisait.
use crate::js_extra::{self as js, ch, chemin, est, fini, hd, longueur, nombre, s, tab, Obj, INDEFINI};
use ariane_js::Echec;
use ariane_vba::Valeur;

const SIDES: [&str; 2] = ["left", "right"];

/// `Math.round(x)`.
fn round(x: f64) -> f64 { ariane_js::round(x) }
/// `mm = v => Math.round(v*1e4)/10`.
fn mm(v: f64) -> f64 { round(v * 1e4) / 10.0 }

/// `ToNumber` des primitives sans chaîne : `undefined` → NaN, `null` → 0, booléens ; hors domaine au-delà.
fn vers_nombre(v: &Valeur) -> Result<f64, Echec> {
    match v {
        Valeur::Indefini => Ok(f64::NAN),
        Valeur::Nul => Ok(0.0),
        Valeur::Booleen(b) => Ok(if *b { 1.0 } else { 0.0 }),
        Valeur::Nombre(x) => Ok(*x),
        _ => hd("conversion en nombre d'une chaîne ou d'un objet"),
    }
}
/// `v || d`.
fn ou(v: &Valeur, d: Valeur) -> Valeur { if v.vrai() { v.clone() } else { d } }
/// `v ?? d`.
fn ou_nul(v: &Valeur, d: Valeur) -> Valeur { if js::nul(v) { d } else { v.clone() } }

/// Seize nombres finis d'un tableau (lecture `m[i]` du JS) ; None si la forme diffère.
fn seize(v: &Valeur) -> Option<Vec<f64>> {
    let l = js::elements(v)?;
    if l.len() != 16 { return None; }
    l.iter().map(nombre).collect()
}

/// `poseEqual(a, b, tolerance = 1e-7)` (fonction 270).
///
/// # Errors
/// Hors domaine : tolérance non numérique, tableau à trous (`every` les sauterait).
pub fn pose_equal(a: &Valeur, b: &Valeur, tol: &Valeur) -> Result<bool, Echec> {
    let tol = match tol { Valeur::Indefini => 1e-7, Valeur::Nombre(x) => *x, _ => return hd("poseEqual : tolérance") };
    for name in ["railLocalToSceneRelative", "profileLocalToSceneRelative"] {
        let (x, y) = (ch(a, name), ch(b, name));
        if !js::est_tableau(x) || !js::est_tableau(y) { return Ok(false); }
        let (Some(x), Some(y)) = (js::denses(x)?, js::denses(y)?) else { return Ok(false) };
        if x.len() != 16 || y.len() != 16 { return Ok(false); }
        for (u, v) in x.iter().zip(y.iter()) {
            let (Some(u), Some(v)) = (fini(u), fini(v)) else { return Ok(false) };
            if !((u - v).abs() <= tol) { return Ok(false); }
        }
    }
    Ok(true)
}

/// `Array.isArray(p) && p.length === 3`.
fn forme3(v: &Valeur) -> bool { js::est_tableau(v) && js::longueur(v) == Some(3.0) }
/// Les trois coordonnées d'un point de forme 3 ; hors domaine si l'une n'est pas un nombre (trou compris).
fn trois(v: &Valeur) -> Result<[f64; 3], Echec> {
    let l = js::denses(v)?.unwrap_or_default();
    let mut o = [0.0; 3];
    for (i, x) in l.iter().enumerate() { if let (Some(c), Some(n)) = (o.get_mut(i), nombre(x)) { *c = n; } else { return hd("coordonnée non numérique"); } }
    Ok(o)
}

/// `railDelta(from, to, thresholdM)` (interne à `classify` ; fonction 272 pour le banc). `seuil` : défaut du réglage.
///
/// # Errors
/// Hors domaine : coordonnées ou seuil non numériques ; `Echec::Js` : « Projection non finie. » de `C.point`.
pub fn rail_delta(from: &Valeur, to: &Valeur, threshold: &Valeur, seuil: f64) -> Result<Valeur, Echec> {
    let threshold = match threshold { Valeur::Indefini => seuil, Valeur::Nombre(x) => *x, _ => return hd("railDelta : seuil") };
    let (pa, pb) = (ch(from, "positionSceneRelative"), ch(to, "positionSceneRelative"));
    let eq = pose_equal(from, to, &Valeur::Indefini)?;
    if forme3(pa) && forme3(pb) {} else {
        return Ok(Obj::new().et("status", s("unavailable")).et("changed", Valeur::Booleen(!eq)).et("identical", Valeur::Booleen(eq))
            .et("distanceMm", Valeur::Nul).et("localMm", Valeur::Nul).v());
    }
    let (a, b) = (trois(pa)?, trois(pb)?);
    let distance = ariane_js::hypot(&[b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    let inv = ch(from, "sceneRelativeToProfileLocal");
    let mut local = Valeur::Nul;
    if js::est_tableau(inv) && js::longueur(inv) == Some(16.0) {
        let m = seize(inv).ok_or_else(|| Echec::hors_domaine("railDelta : matrice non numérique"))?;
        let mut m16 = [0.0; 16];
        m16.copy_from_slice(&m);
        let f = ariane_capture::point(&m16, a[0], a[1], a[2])?;
        let t = ariane_capture::point(&m16, b[0], b[1], b[2])?;
        local = Valeur::Nombres(vec![mm(t[0] - f[0]), mm(t[1] - f[1]), mm(t[2] - f[2])]);
    }
    Ok(Obj::new().et("status", s("measured")).et("changed", Valeur::Booleen(distance > threshold)).et("identical", Valeur::Booleen(eq))
        .et("distanceMm", Valeur::Nombre(mm(distance))).et("localMm", local).et("thresholdMm", Valeur::Nombre(threshold * 1000.0)).v())
}

/// `railPosition(state, side)`.
fn rail_position(state: &Valeur, side: &str) -> Result<Option<[f64; 3]>, Echec> {
    let p = chemin(state, &["rails", side, "positionSceneRelative"]);
    if !js::est_tableau(p) { return Ok(None); }
    let l = js::elements(p).unwrap_or_default();
    if l.len() < 3 { return Ok(None); }
    if let Valeur::Tableau(t) = p { if t.iter().take(3).any(Option::is_none) { return hd("railPosition : trou"); } }
    let mut o = [0.0; 3];
    for i in 0..3 { let Some(x) = l.get(i).and_then(fini) else { return Ok(None) }; o[i] = x; }
    Ok(Some(o))
}
fn distance(a: &[f64; 3], b: &[f64; 3]) -> f64 { ariane_js::hypot(&[a[0] - b[0], a[1] - b[1], a[2] - b[2]]) }

/// `K.clone(x)` : hors domaine pour `undefined` (le JS lèverait une `SyntaxError` de `JSON.parse`).
fn clone(x: &Valeur) -> Result<Valeur, Echec> { js::clone_json(x).ok_or_else(|| Echec::hors_domaine("clone de undefined")) }

/// `referenceParEcriture(referenceState, lastObserved, body, toleranceM)` (fonction 271).
///
/// # Errors
/// Hors domaine : états non objets ou tolérance non numérique (voir le module).
pub fn reference_par_ecriture(reference: &Valeur, last: &Valeur, body: &Valeur, tol: &Valeur, seuil: f64) -> Result<Valeur, Echec> {
    let tol = match tol { Valeur::Indefini => seuil, Valeur::Nombre(x) => *x, _ => return hd("referenceParEcriture : tolérance") };
    let edges = |side: &str| if side == "left" { ["XLeftEdge", "YLeftEdge", "ZLeftEdge"] } else { ["XRightEdge", "YRightEdge", "ZRightEdge"] };
    let mut written: Vec<(&str, [f64; 3])> = vec![];
    if matches!(body, Valeur::Objet(_) | Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Bloc { .. }) {
        for side in SIDES {
            let e = edges(side);
            if let (Some(x), Some(y), Some(z)) = (fini(ch(body, e[0])), fini(ch(body, e[1])), fini(ch(body, e[2]))) { written.push((side, [x, y, z])); }
        }
    }
    let rails = ch(reference, "rails");
    if written.is_empty() || !rails.vrai() { return Ok(Valeur::Nul); }
    if !matches!(rails, Valeur::Objet(_)) { return hd("referenceParEcriture : rails non objet"); }
    let mut diff = Obj::new();
    let mut max = 0.0f64;
    for (side, w) in &written {
        let d = rail_position(reference, side)?.map(|p| distance(&p, w));
        diff.poser(side, js::n_ou_nul(d.map(mm)));
        match d { None => max = ariane_js::max(max, f64::INFINITY), Some(d) if d > tol => max = ariane_js::max(max, d), _ => {} }
    }
    if !(max > 0.0) { return Ok(Valeur::Nul); }
    let mut concordant = last.vrai();
    if concordant { for (side, w) in &written { if !rail_position(last, side)?.is_some_and(|p| distance(&p, w) <= tol) { concordant = false; break; } } }
    let source = if concordant { last } else { reference };
    let Valeur::Objet(champs) = clone(source)? else { return hd("referenceParEcriture : état non objet") };
    let mut state = Obj(champs);
    if concordant {
        for side in SIDES {
            let rr = ch(rails, side);
            let present = ch(state.lire("rails"), side).vrai();
            if !present && rr.vrai() {
                let mut r = match state.lire("rails") {
                    Valeur::Objet(t) => Obj(t.clone()),
                    Valeur::Indefini | Valeur::Nul => Obj::new(),
                    _ => return hd("referenceParEcriture : rails du dernier état non objet"),
                };
                r.poser(side, clone(rr)?);
                state.poser("rails", r.v());
            }
        }
    } else {
        let Valeur::Objet(t) = state.lire("rails") else { return hd("referenceParEcriture : rails non objet") };
        let mut r = Obj(t.clone());
        for (side, w) in &written {
            let old = ch(rails, side);
            let mut x = Obj::new().et("positionSceneRelative", Valeur::Nombres(w.to_vec()));
            let inv = ch(old, "sceneRelativeToProfileLocal");
            if js::est_tableau(inv) { x.poser("sceneRelativeToProfileLocal", clone(inv)?); }
            x.poser("positionSource", s("validation-write"));
            r.poser(side, x.v());
        }
        state.poser("rails", r.v());
    }
    Ok(Obj::new().et("state", state.v()).et("poseFrom", s(if concordant { "last-observed-state" } else { "write" }))
        .et("sides", tab(written.iter().map(|(x, _)| s(x)).collect())).et("diffMm", diff.v())
        .et("maxDiffMm", if max.is_finite() { Valeur::Nombre(mm(max)) } else { Valeur::Nul }).v())
}

/// `identityValue(x, k)` puis `?? 'not-observed'` et `join` : une partie de `K.cutKey`.
fn morceau_cle(x: &Valeur, k: &str) -> Result<String, Echec> {
    let v = ch(x, k);
    if js::nul(v) { return Ok("not-observed".into()); }
    js::en_chaine(v)
}
/// `K.cutKey(x)`.
pub(crate) fn cut_key(x: &Valeur) -> Result<String, Echec> { Ok(format!("{}|{}", morceau_cle(x, "part")?, morceau_cle(x, "cut")?)) }

/// `visitRelation(n, identity, periodId, cross)` (fonction 273). `autre` : `cross?.get(cutKey(identity))`, donné par la
/// façade (la carte ne traverse pas).
///
/// # Errors
/// Hors domaine : une visite nulle (le JS lèverait), `===` entre objets.
pub fn visit_relation(n: &Valeur, identity: &Valeur, period: &Valeur, autre: &Valeur) -> Result<Valeur, Echec> {
    if js::nul(n) { return hd("visitRelation : n absent (le JS lève)"); }
    let cut = cut_key(identity)?;
    let visites = js::liste_ou_vide(ch(n, "visits"))?;
    for v in visites.iter().rev() {
        if !matches!(v, Valeur::Objet(_)) { return hd("visitRelation : visite non objet"); }
        if ch(v, "visitId").vrai() && cut_key(ch(v, "identity"))? == cut {
            let meme = js::strict(ch(v, "observationPeriodId"), period)?;
            return Ok(Obj::new().et("type", s(if meme { "revisit" } else { "pause-continuation" })).et("relatedVisitId", ch(v, "visitId").clone())
                .et("relatedSessionId", ch(n, "id").clone()).v());
        }
    }
    if autre.vrai() {
        return Ok(Obj::new().et("type", s("cross-session-revisit")).et("relatedVisitId", ch(autre, "visitId").clone())
            .et("relatedSessionId", ch(autre, "nativeSessionId").clone()).v());
    }
    Ok(Obj::new().et("type", s("first-observation")).et("relatedVisitId", Valeur::Nul).et("relatedSessionId", Valeur::Nul).v())
}

/// `x?.length` au sens de JS : tableaux et chaînes, ou la clé `length` d'un objet.
fn lire_length(v: &Valeur) -> Valeur {
    match v { Valeur::Objet(_) => ch(v, "length").clone(), _ => longueur(v).map_or(Valeur::Indefini, Valeur::Nombre) }
}

/// `redactedEvent(type, data)` (fonction 274). Les autres types rendent `data` (la façade rend l'objet d'origine).
///
/// # Errors
/// Hors domaine : `data` non objet pour les trois types réduits.
pub fn redacted_event(typ: &Valeur, data: &Valeur) -> Result<Valeur, Echec> {
    let t = js::chaine(typ).unwrap_or("");
    if !matches!(t, "capture-ready" | "capture-checkpoint" | "operator-gesture") { return Ok(data.clone()); }
    let Valeur::Objet(champs) = data else { return hd("redactedEvent : data non objet") };
    let mut o = Obj::new();
    match t {
        "capture-ready" => {
            let cloud = ou(ch(data, "cloud"), Obj::new().v());
            let mut pts = Obj::new();
            for side in SIDES { pts.poser(side, ou(chemin(&cloud, &["railObservations", side, "pointsRetained"]), Valeur::Nombre(0.0))); }
            o.etaler(data)?;
            let mut c = Obj::new();
            for k in ["format", "captureId", "identity", "status", "termination"] { c.poser(k, ch(&cloud, k).clone()); }
            c.poser("pointsByRail", pts.v());
            c.poser("trace", ch(&cloud, "trace").clone());
            o.poser("cloud", c.v());
        }
        "capture-checkpoint" => {
            let chunk = ou(ch(data, "chunk"), Obj::new().v());
            o.etaler(data)?;
            let mut c = Obj::new();
            for k in ["format", "chunkId", "captureId", "visitId", "side", "identity", "capturedAt", "acquisition"] { c.poser(k, ch(&chunk, k).clone()); }
            let q = ch(&chunk, "qualification");
            c.poser("qualification", if q.vrai() {
                let mut x = Obj::new();
                for k in ["status", "criteriaVersion", "acquiredThroughAt", "coverage"] { x.poser(k, ch(q, k).clone()); }
                x.v()
            } else { Valeur::Nul });
            c.poser("points", ou(&lire_length(ch(&chunk, "pointsSceneRelative")), Valeur::Nombre(0.0)));
            o.poser("chunk", c.v());
        }
        _ => { for (k, v) in champs { if k != "collectorMetrics" { o.poser(k, v.clone()); } } }
    }
    Ok(o.v())
}

/// `Math.max(a, b)` après `ToNumber`.
fn max_js(a: &Valeur, b: &Valeur) -> Result<f64, Echec> { Ok(ariane_js::max(vers_nombre(a)?, vers_nombre(b)?)) }

/// `mergeMetrics(metrics)` (fonction 275) sur `m = this.e.s.native.metrics` : rend `{m, setAside}` (`setAside` : la
/// façade remplace `m.setAsideItems` par `metrics.setAsideItems.slice(0, 32)`, éléments d'origine), ou `undefined`
/// si `metrics` est faux.
///
/// # Errors
/// Hors domaine : `m` absent, conversions de chaînes, `degradationLevels` non tableau (le JS lèverait en cours de route).
pub fn merge_metrics(m: &Valeur, metrics: &Valeur) -> Result<Valeur, Echec> {
    if !metrics.vrai() { return Ok(Valeur::Indefini); }
    let Valeur::Objet(t) = m else { return hd("mergeMetrics : m non objet") };
    if !matches!(metrics, Valeur::Objet(_)) { return hd("mergeMetrics : metrics non objet"); }
    let mut o = Obj(t.clone());
    let zero = Valeur::Nombre(0.0);
    for k in ["queueDepthMax", "dropped", "sendFailures", "captureCompleted", "captureFailed"] {
        let x = max_js(o.lire(k), &ou(ch(metrics, k), zero.clone()))?;
        o.poser(k, Valeur::Nombre(x));
    }
    let x = max_js(&ou(o.lire("captureCheckpoints"), zero.clone()), &ou(ch(metrics, "captureCheckpoints"), zero.clone()))?;
    o.poser("captureCheckpoints", Valeur::Nombre(x));
    let ihm = ch(metrics, "inputHandlerMs");
    if ihm.vrai() {
        let ancien = o.lire("inputHandlerMs");
        if js::nul(ancien) { return hd("mergeMetrics : inputHandlerMs absent (le JS lève)"); }
        let mx = max_js(&ou(ch(ancien, "max"), zero.clone()), &ou(ch(ihm, "max"), zero.clone()))?;
        let mut n = Obj::new();
        n.etaler(ihm)?;
        n.poser("max", Valeur::Nombre(mx));
        o.poser("inputHandlerMs", n.v());
    }
    let dl = ch(metrics, "degradationLevel");
    if dl.vrai() {
        if !matches!(dl, Valeur::Chaine(_) | Valeur::Nombre(_) | Valeur::Booleen(_)) { return hd("mergeMetrics : niveau non primitif"); }
        let niveaux = o.lire("degradationLevels");
        let Some(mut l) = js::elements(niveaux).map(std::borrow::Cow::into_owned) else { return hd("mergeMetrics : degradationLevels non tableau") };
        let mut deja = false;
        for x in &l { if js::strict(x, dl).or_else(|_| hd::<bool>("includes d'un objet"))? || matches!((x, dl), (Valeur::Nombre(a), Valeur::Nombre(b)) if a.is_nan() && b.is_nan()) { deja = true; } }
        if !deja { l.push(dl.clone()); o.poser("degradationLevels", tab(l)); }
        o.poser("degradationLevel", dl.clone());
    }
    let dp = ch(metrics, "degradationPeak");
    if dp.vrai() {
        if !matches!(dp, Valeur::Chaine(_) | Valeur::Nombre(_) | Valeur::Booleen(_)) { return hd("mergeMetrics : pic non primitif"); }
        o.poser("degradationPeak", dp.clone());
    }
    if let Some(q) = fini(ch(metrics, "queueDepth")) { o.poser("queueDepth", Valeur::Nombre(q)); }
    for k in ["degradationEvents", "recoveries", "setAside", "refused", "captureBudgeted", "captureRefused", "captureSkippedAfterOperatorRailChange"] {
        if let Some(v) = fini(ch(metrics, k)) {
            let x = max_js(&ou(o.lire(k), zero.clone()), &Valeur::Nombre(v))?;
            o.poser(k, Valeur::Nombre(x));
        }
    }
    let sa = ch(metrics, "setAsideItems");
    let mut remplace = false;
    if js::est_tableau(sa) && longueur(sa).is_some_and(|n| n > 0.0) {
        let l = js::elements(sa).unwrap_or_default();
        o.poser("setAsideItems", tab(l.iter().take(32).cloned().collect()));
        remplace = true;
    }
    Ok(Obj::new().et("m", o.v()).et("setAside", Valeur::Booleen(remplace)).v())
}

/// `Sessions.railKey(identity, side)`.
fn rail_key(identity: &Valeur, side: &Valeur) -> Result<Option<String>, Echec> {
    if !identity.vrai() || !side.vrai() { return Ok(None); }
    let (p, c) = (ch(identity, "part"), ch(identity, "cut"));
    if matches!(p, Valeur::Indefini) && matches!(c, Valeur::Indefini) { return Ok(None); }
    let t = |v: &Valeur| if js::nul(v) { Ok("?".to_owned()) } else { js::en_chaine(v) };
    Ok(Some(format!("{}/{}/{}", t(p)?, t(c)?, js::en_chaine(side)?)))
}

/// `accountQuality(n, cloud)` (fonction 276) : rend `{quality, qualityRails, metricsQuality}` à recopier dans `n`
/// (`metricsQuality` : `n.metrics.quality = n.quality` à poser), ou `undefined` si rien n'est modifié.
/// `limite` : `Sessions.QUALITY_RAIL_LIMIT`.
///
/// # Errors
/// Hors domaine : toute forme où le JS lèverait (exception avalée par son `try`, modification partielle).
pub fn account_quality(n: &Valeur, cloud: &Valeur, limite: f64) -> Result<Valeur, Echec> {
    if !matches!(n, Valeur::Objet(_)) { return hd("accountQuality : n non objet"); }
    let zero = || Valeur::Nombre(0.0);
    let q0 = ch(n, "quality");
    let q0 = if js::nul(q0) {
        let clip = ["inRoiKept", "inRoiDropped", "nearTopKept", "nearTopDropped", "nearFaceKept", "nearFaceDropped"].iter().fold(Obj::new(), |o, k| o.et(k, zero()));
        Obj::new().et("snapshotsQualified", zero()).et("snapshotsTotal", zero()).et("interruptedOnly", zero()).et("exclusionReasons", Obj::new().v())
            .et("railsObserved", zero()).et("railsQualified", zero()).et("railsTruncated", Valeur::Booleen(false)).et("clip", clip.v()).v()
    } else { q0.clone() };
    let Valeur::Objet(qt) = q0 else { return hd("accountQuality : quality non objet") };
    let mut q = Obj(qt);
    let v0 = ch(n, "qualityRails");
    let v0 = if js::nul(v0) { Obj::new().v() } else { v0.clone() };
    let Valeur::Objet(vt) = v0 else { return hd("accountQuality : qualityRails non objet") };
    let mut vus = Obj(vt);
    let metrics = ch(n, "metrics");
    if !js::nul(metrics) && !matches!(metrics, Valeur::Objet(_)) { return hd("accountQuality : metrics non objet"); }
    let num = |v: &Valeur| -> Result<f64, Echec> { nombre(v).ok_or_else(|| Echec::hors_domaine("accountQuality : compteur non numérique")) };
    let rendre = |q: Obj, vus: Obj| Obj::new().et("quality", q.v()).et("qualityRails", vus.v()).et("metricsQuality", Valeur::Booleen(true)).v();
    if est(ch(cloud, "format"), "banane-native-lidar-chunk-v1") {
        if let Some(cle) = rail_key(ch(cloud, "identity"), ch(cloud, "side"))? {
            if !js::cle_sure(&cle) { return hd("accountQuality : clé héritée"); }
            if matches!(vus.lire(&cle), Valeur::Indefini) {
                let obs = num(q.lire("railsObserved"))?;
                if obs >= limite { q.poser("railsTruncated", Valeur::Booleen(true)); }
                else { vus.poser(&cle, zero()); q.poser("railsObserved", Valeur::Nombre(obs + 1.0)); }
            }
            #[allow(clippy::float_cmp)] // vus[cle] === 0
            let est_zero = nombre(vus.lire(&cle)) == Some(0.0);
            if est_zero && est(chemin(cloud, &["qualification", "status"]), "qualified-candidate") {
                vus.poser(&cle, Valeur::Nombre(1.0));
                let x = num(q.lire("railsQualified"))?;
                q.poser("railsQualified", Valeur::Nombre(x + 1.0));
            }
        }
        return Ok(rendre(q, vus));
    }
    if !est(ch(cloud, "format"), "banane-native-lidar-capture-v2") {
        // `n.quality ??=` et `n.qualityRails ??=` ont déjà eu lieu : rendus, sans `metrics.quality`
        return Ok(Obj::new().et("quality", q.v()).et("qualityRails", vus.v()).et("metricsQuality", Valeur::Booleen(false)).v());
    }
    for side in SIDES {
        let obs = chemin(cloud, &["railObservations", side]);
        if !obs.vrai() { continue; }
        let total = num(q.lire("snapshotsTotal"))?;
        q.poser("snapshotsTotal", Valeur::Nombre(total + 1.0));
        let motifs_v = chemin(obs, &["coverage", "exclusionReasons"]);
        let motifs = js::liste_ou_vide(motifs_v)?;
        if est(chemin(obs, &["coverage", "status"]), "qualified-candidate") {
            let x = num(q.lire("snapshotsQualified"))?;
            q.poser("snapshotsQualified", Valeur::Nombre(x + 1.0));
        } else {
            if motifs.len() == 1 && motifs.first().is_some_and(|m| est(m, "capture-interrupted-before-stable-boundary")) {
                let x = num(q.lire("interruptedOnly"))?;
                q.poser("interruptedOnly", Valeur::Nombre(x + 1.0));
            }
            let Valeur::Objet(et) = q.lire("exclusionReasons").clone() else { return hd("accountQuality : exclusionReasons non objet") };
            let mut e = Obj(et);
            for r in &motifs {
                let Valeur::Chaine(k) = r else { return hd("accountQuality : motif non chaîne") };
                if !js::cle_sure(k) { return hd("accountQuality : motif hérité"); }
                let a = e.lire(k);
                let x = if a.vrai() { num(a)? } else { 0.0 };
                e.poser(k, Valeur::Nombre(x + 1.0));
            }
            q.poser("exclusionReasons", e.v());
        }
        let cl = ch(obs, "clipLoss");
        if !cl.vrai() { continue; }
        let Valeur::Objet(ct) = q.lire("clip").clone() else { return hd("accountQuality : clip non objet") };
        let mut c = Obj(ct.clone());
        for (k, _) in &ct {
            if !js::cle_sure(k) { return hd("accountQuality : clé héritée"); }
            if let Some(v) = fini(js::ch_dyn(cl, k)?) {
                let x = num(c.lire(k))?;
                c.poser(k, Valeur::Nombre(x + v));
            }
        }
        q.poser("clip", c.v());
    }
    Ok(rendre(q, vus))
}

/// `round(a / b * 100)` du JS.
fn pc(a: f64, b: f64) -> f64 { round(a / b * 100.0) }

/// `x || 0` pour un compteur, hors domaine s'il n'est ni faux ni nombre.
fn compteur(v: &Valeur) -> Result<Valeur, Echec> {
    if !v.vrai() { return Ok(Valeur::Nombre(0.0)); }
    if matches!(v, Valeur::Nombre(_)) { Ok(v.clone()) } else { hd("compteur non numérique") }
}
fn n_de(v: &Valeur) -> f64 { nombre(v).unwrap_or(0.0) }

/// `health()` (fonction 277) sur `n = this.e.s.native` ; `filigrane` : `Sessions.EXPORT_WATERMARK_BYTES`.
///
/// # Errors
/// Hors domaine : compteurs non numériques (le JS les concaténerait ou les convertirait).
pub fn health(n: &Valeur, filigrane: &Valeur) -> Result<Valeur, Echec> {
    if !n.vrai() { return Ok(Valeur::Nul); }
    if !matches!(n, Valeur::Objet(_)) { return hd("health : n non objet"); }
    let m = ou(ch(n, "metrics"), Obj::new().v());
    let x = ou(ch(n, "exportState"), Obj::new().v());
    let cm = |k: &str| compteur(ch(&m, k));
    let (cc, cf) = (cm("captureCompleted")?, cm("captureFailed")?);
    let captures = n_de(&cc) + n_de(&cf);
    let len = |v: &Valeur| -> Result<f64, Echec> { if !v.vrai() { return Ok(0.0); } longueur(v).filter(|_| js::est_tableau(v)).ok_or_else(|| Echec::hors_domaine("health : liste non tableau")) };
    let dl = ou(ch(&m, "degradationLevel"), s("FULL"));
    let pic = ou(ch(&m, "degradationPeak"), ou(ch(&m, "degradationLevel"), s("FULL")));
    let sai_v = ch(&m, "setAsideItems");
    if sai_v.vrai() && !js::est_tableau(sai_v) { return hd("health : setAsideItems non tableau"); }
    let qualite = match ch(n, "quality") {
        q if !q.vrai() => Valeur::Nul,
        q => {
            let c = ch(q, "clip");
            let f = |k: &str| nombre(ch(c, k)).ok_or_else(|| Echec::hors_domaine("health : clip non numérique"));
            let (ik, id, fk, fd, tk, td) = (f("inRoiKept")?, f("inRoiDropped")?, f("nearFaceKept")?, f("nearFaceDropped")?, f("nearTopKept")?, f("nearTopDropped")?);
            let (roi, face, top) = (ik + id, fk + fd, tk + td);
            let g = |k: &str| nombre(ch(q, k)).ok_or_else(|| Echec::hors_domaine("health : qualité non numérique"));
            let (sq, st) = (g("snapshotsQualified")?, g("snapshotsTotal")?);
            let ecartes = st - sq;
            let cq = |k: &str| compteur(ch(q, k));
            let (ro, rq, io) = (cq("railsObserved")?, cq("railsQualified")?, cq("interruptedOnly")?);
            let er = ch(q, "exclusionReasons");
            let er = if er.vrai() { let mut o = Obj::new(); o.etaler(er)?; o.v() } else { Obj::new().v() };
            let si = |c: bool, v: f64| if c { Valeur::Nombre(v) } else { Valeur::Nul };
            Obj::new().et("snapshotsQualified", Valeur::Nombre(sq)).et("snapshotsTotal", Valeur::Nombre(st))
                .et("qualifiedRate", si(st != 0.0 && !st.is_nan(), pc(sq, st)))
                .et("railsObserved", ro.clone()).et("railsQualified", rq.clone())
                .et("railsTruncated", Valeur::Booleen(matches!(ch(q, "railsTruncated"), Valeur::Booleen(true))))
                .et("railQualifiedRate", if ch(q, "railsObserved").vrai() { Valeur::Nombre(pc(n_de(&rq), n_de(ch(q, "railsObserved")))) } else { Valeur::Nul })
                .et("interruptedOnly", io.clone())
                .et("interruptedShare", si(ecartes > 0.0, pc(n_de(&io), ecartes)))
                .et("coverageShort", Valeur::Nombre(ariane_js::max(0.0, ecartes - n_de(&io))))
                .et("exclusionReasons", er)
                .et("clipDropRate", si(roi != 0.0 && !roi.is_nan(), pc(id, roi)))
                .et("faceKept", Valeur::Nombre(fk)).et("faceDropped", Valeur::Nombre(fd))
                .et("faceDropRate", si(face != 0.0 && !face.is_nan(), pc(fd, face)))
                .et("topDropRate", si(top != 0.0 && !top.is_nan(), pc(td, top))).v()
        }
    };
    Ok(Obj::new().et("status", ou(ch(n, "status"), Valeur::Nul)).et("visits", Valeur::Nombre(len(ch(n, "visits"))?))
        .et("bytesStored", compteur(ch(&x, "bytesStored"))?).et("bytesPending", compteur(ch(&x, "bytesPending"))?)
        .et("watermark", filigrane.clone()).et("segments", compteur(ch(&x, "segments"))?)
        .et("cloudsStored", Valeur::Nombre(len(ch(n, "cloudIds"))?)).et("cloudsExported", Valeur::Nombre(len(ch(&x, "exportedCloudIds"))?))
        .et("captureCompleted", cc).et("captureFailed", cf.clone())
        .et("captureBudgeted", cm("captureBudgeted")?).et("captureRefused", cm("captureRefused")?)
        .et("captureFailureRate", Valeur::Nombre(if captures != 0.0 && !captures.is_nan() { pc(n_de(&cf), captures) } else { 0.0 }))
        .et("queueDepth", ou_nul(ch(&m, "queueDepth"), Valeur::Nul)).et("queueDepthMax", cm("queueDepthMax")?)
        .et("dropped", cm("dropped")?).et("sendFailures", cm("sendFailures")?)
        .et("degradationLevel", dl).et("degradationPeak", pic)
        .et("recoveries", cm("recoveries")?).et("setAside", cm("setAside")?).et("refused", cm("refused")?)
        .et("setAsideItems", if sai_v.vrai() { js::tranche(sai_v, 8) } else { tab(vec![]) })
        .et("quality", qualite).v())
}

/// `exportAdvice()` (fonction 278) sur `n = this.e.s.native` ; `filigrane` : `Sessions.EXPORT_WATERMARK_BYTES`.
///
/// # Errors
/// Hors domaine : identifiants non primitifs, octets non numériques.
pub fn export_advice(n: &Valeur, filigrane: &Valeur) -> Result<Valeur, Echec> {
    if !n.vrai() { return Ok(Valeur::Nul); }
    let x = ch(n, "exportState");
    if !x.vrai() { return Ok(Valeur::Nul); }
    let ex = js::liste_ou_vide(ch(x, "exportedCloudIds"))?;
    let cle = |v: &Valeur| -> Result<(u8, String), Echec> {
        Ok(match v {
            Valeur::Indefini => (0, String::new()), Valeur::Nul => (1, String::new()), Valeur::Booleen(b) => (2, b.to_string()),
            Valeur::Nombre(f) => (3, ariane_js::cle_same_value_zero(*f).to_string()), Valeur::Chaine(c) => (4, c.clone()),
            _ => return hd("exportAdvice : identifiant objet"),
        })
    };
    let faits: std::collections::HashSet<(u8, String)> = ex.iter().map(cle).collect::<Result<_, _>>()?;
    let ids = ch(n, "cloudIds");
    let Some(ids) = js::denses(ids)? else { return hd("exportAdvice : cloudIds non tableau") };
    let mut pending = 0.0;
    for id in ids.iter() { if !faits.contains(&cle(id)?) { pending += 1.0; } }
    let bp = ch(x, "bytesPending");
    let (Some(bpn), Valeur::Nombre(w)) = (nombre(bp).or(if matches!(bp, Valeur::Indefini) { Some(f64::NAN) } else { None }), filigrane) else { return hd("exportAdvice : octets") };
    let due = bpn >= *w && pending > 0.0;
    Ok(Obj::new().et("due", Valeur::Booleen(due)).et("reason", if due { s("watermark-reached") } else { Valeur::Nul })
        .et("bytesStored", ch(x, "bytesStored").clone()).et("bytesPending", bp.clone()).et("watermark", filigrane.clone())
        .et("pendingClouds", Valeur::Nombre(pending)).et("segments", ch(x, "segments").clone())
        .et("note", s("Segment vidé automatiquement pour ne jamais atteindre la limite de téléchargement.")).v())
}

/// `Date.parse(v || '')` : faux → NaN ; chaîne → `js_extra::date` ; autre (conversion en texte) → hors domaine.
fn date_de(v: &Valeur) -> Result<f64, Echec> {
    if !v.vrai() { return Ok(f64::NAN); }
    match v { Valeur::Chaine(c) => js::date::parse(c), _ => hd("Date.parse d'une valeur non chaîne") }
}
/// `eventTime(e) = Date.parse(e?.observedAt || e?.timestamp || '')`.
fn event_time(e: &Valeur) -> Result<f64, Echec> {
    let o = ch(e, "observedAt");
    date_de(if o.vrai() { o } else { ch(e, "timestamp") })
}
/// `unique(a) = [...new Set(a.filter(Boolean))]` sur des primitives.
fn unique(a: &[Valeur]) -> Result<Vec<Valeur>, Echec> {
    let mut out: Vec<Valeur> = vec![];
    for x in a.iter().filter(|x| x.vrai()) {
        if matches!(x, Valeur::Objet(_) | Valeur::Tableau(_) | Valeur::Nombres(_) | Valeur::Booleens(_) | Valeur::Bloc { .. }) { return hd("unique d'objets"); }
        let mut deja = false;
        for y in &out { if js::strict(x, y)? { deja = true; break; } } // NaN est faux : jamais ici
        if !deja { out.push(x.clone()); }
    }
    Ok(out)
}
/// `identityValue(x, k)` de core.js.
fn identity_value<'a>(x: &'a Valeur, k: &str) -> &'a Valeur {
    if k == "projectId" {
        let p = ch(x, "projectId");
        if !js::nul(p) { return p; }
        let q = ch(x, "project");
        if q.vrai() && !est(q, "not-observed") { q } else { &VNUL }
    } else { ch(x, k) }
}
static VNUL: Valeur = Valeur::Nul;
/// `K.assertTarget(a, b)` lève-t-il ? (`differences(a, b).length > 0`)
fn cible_differe(a: &Valeur, b: &Valeur) -> Result<bool, Echec> {
    for k in ["pageId", "part", "cut", "shape", "frameId", "projectId"] { if !js::strict(identity_value(a, k), identity_value(b, k))? { return Ok(true); } }
    Ok(false)
}
/// `[...(v || [])]` : éléments d'une liste (trous → `undefined`).
fn etaler_liste(v: &Valeur) -> Result<Vec<Valeur>, Echec> { js::liste_ou_vide(v) }
/// `x?.length` vrai ?
fn longueur_vraie(v: &Valeur) -> bool { lire_length(v).vrai() }
/// `x.slice()` d'une liste ou d'une chaîne non vide.
fn copie_liste(v: &Valeur) -> Result<Valeur, Echec> {
    match v {
        Valeur::Chaine(_) => Ok(v.clone()),
        _ if js::est_tableau(v) => Ok(js::tranche(v, usize::MAX)),
        _ => hd("slice d'une valeur non tableau"),
    }
}
/// `a >= b` / `a > b` du JS sur deux valeurs numériques (`undefined` → NaN) ; hors domaine au-delà.
fn num_cmp(v: &Valeur) -> Result<f64, Echec> { vers_nombre(v) }
/// `K.clone(x)` ; `undefined` → hors domaine (`JSON.parse(undefined)` lève).
fn clone_ou_hd(x: &Valeur) -> Result<Valeur, Echec> { clone(x) }

/// `chooseGeometry(record, side)` (fonction 279).
///
/// # Errors
/// Hors domaine : formes où le JS lèverait ou convertirait (voir le module) ; dates hors de la forme ISO.
pub fn choose_geometry(record: &Valeur, side: &str) -> Result<Valeur, Echec> {
    if !matches!(record, Valeur::Objet(_)) { return hd("chooseGeometry : record non objet"); }
    let before = chemin(record, &["beforeEstablished", "rails", side]);
    let vide = || tab(vec![]);
    if !before.vrai() {
        return Ok(Obj::new().et("status", s("excluded")).et("captureId", Valeur::Nul).et("chunkIds", vide()).et("points", Valeur::Nombre(0.0))
            .et("reasons", js::tab(vec![s("initial-rail-state-missing")])).v());
    }
    let mut failures: Vec<Valeur> = vec![];
    if !est(ch(record, "version"), "4.4.1") {
        let snapshots = js::liste_ou_vide(chemin(record, &["railSnapshots", side]))?;
        let intent = premier(ch(record, "operatorIntents"))?;
        let intent_at = event_time(&intent)?;
        for snap in &snapshots {
            if !matches!(snap, Valeur::Objet(_)) { return hd("instantané non objet"); }
            let mut reasons = etaler_liste(ch(snap, "exclusionReasons"))?;
            let rev = ch(snap, "revocations");
            if longueur_vraie(rev) {
                let Some(l) = js::denses(rev)? else { return hd("revocations non tableau") };
                for it in l.iter() { if !matches!(it, Valeur::Objet(_)) { return hd("révocation non objet"); } reasons.push(ch(it, "reason").clone()); }
            }
            let p = |r: &mut Vec<Valeur>, m: &str| r.push(s(m));
            if !est(ch(snap, "qualificationStatus"), "qualified-candidate") || !est(chemin(snap, &["coverage", "status"]), "qualified-candidate") { p(&mut reasons, "checkpoint-not-qualified"); }
            if !est(ch(snap, "criteriaVersion"), "native-visible-roi-v1") { p(&mut reasons, "snapshot-criteria-unknown"); }
            if !est(ch(snap, "sourceStatus"), "reference-version-and-matrix-stable-through-checkpoint") { p(&mut reasons, "source-stability-not-demonstrated"); }
            if !est(ch(snap, "clipStatus"), "verified-classifiable") { p(&mut reasons, "clipping-not-verified"); }
            if !chemin(snap, &["transform", "valid"]).vrai() { p(&mut reasons, "transform-invalid"); }
            if !est(ch(snap, "associationStatus"), "same-target-and-rail-pose") || !pose_equal(ch(snap, "rail"), before, &Valeur::Indefini)? { p(&mut reasons, "capture-used-a-different-rail-pose-than-initial-state"); }
            if !ch(snap, "receiptEventSeq").vrai() || !ch(snap, "storedAt").vrai() || !longueur_vraie(ch(snap, "chunkIds")) { p(&mut reasons, "storage-receipt-or-chunks-missing"); }
            let cs = ch(snap, "coordinateSystem");
            if !ch(cs, "frameId").vrai() || !js::strict(ch(cs, "frameId"), chemin(record, &["identity", "frameId"]))? || !est(ch(cs, "units"), "metres-observed-not-independently-calibrated") {
                p(&mut reasons, "coordinate-frame-or-units-unverified");
            }
            if cible_differe(ch(record, "identity"), ch(snap, "identity"))? { p(&mut reasons, "snapshot-identity-mismatch"); }
            let finished = date_de(ch(snap, "acquiredThroughAt"))?;
            let started = date_de(ch(snap, "acquisitionStartedAt"))?;
            if !finished.is_finite() || !started.is_finite() || started > finished { p(&mut reasons, "acquisition-time-invalid"); }
            if intent.vrai() && (!intent_at.is_finite() || finished > intent_at) { p(&mut reasons, "geometry-acquired-after-operator-intent"); }
            if !reasons.is_empty() { failures.extend(reasons); continue; }
            let ve = chemin(snap, &["viewObservation", "viewEpochId"]);
            return Ok(Obj::new().et("status", s("qualified-candidate")).et("snapshotId", ch(snap, "snapshotId").clone()).et("captureId", ch(snap, "captureId").clone())
                .et("chunkIds", copie_liste(ch(snap, "chunkIds"))?).et("points", chemin(snap, &["coverage", "pointsInRoi"]).clone())
                .et("acquiredThroughAt", ch(snap, "acquiredThroughAt").clone()).et("storedAt", ch(snap, "storedAt").clone())
                .et("receiptEventSeq", ch(snap, "receiptEventSeq").clone()).et("capturedAt", ch(snap, "acquisitionStartedAt").clone())
                .et("viewEpochId", ou(ve, Valeur::Nul)).et("coordinateSystem", clone_ou_hd(cs)?).et("criteriaVersion", ch(snap, "criteriaVersion").clone())
                .et("reasons", vide()).v());
        }
        let r = if failures.is_empty() { vec![s("qualified-stored-snapshot-missing")] } else { failures };
        return Ok(Obj::new().et("status", s("excluded")).et("snapshotId", Valeur::Nul).et("captureId", Valeur::Nul).et("chunkIds", vide()).et("points", Valeur::Nombre(0.0))
            .et("reasons", tab(unique(&r)?)).v());
    }
    let observations = js::liste_ou_vide(chemin(record, &["geometryObservations", side]))?;
    let intent0 = premier(ch(record, "operatorIntents"))?;
    for obs in &observations {
        if !matches!(obs, Valeur::Objet(_)) { return hd("observation non objet"); }
        let mut reasons: Vec<Valeur> = vec![];
        if !est(ch(obs, "geometryInputStatus"), "qualified-candidate") || !est(chemin(obs, &["coverage", "status"]), "qualified-candidate") {
            let ex = ch(obs, "exclusionReasons");
            if ex.vrai() { reasons.extend(etaler_liste(ex)?); } else { reasons.push(s("coverage-not-qualified")); }
        }
        if !chemin(obs, &["transform", "valid"]).vrai() { reasons.push(s("transform-invalid")); }
        if !est(ch(obs, "associationStatus"), "same-target-and-rail-pose") { reasons.push(s("capture-reference-association-unverified")); }
        if !pose_equal(ch(obs, "rail"), before, &Valeur::Indefini)? { reasons.push(s("capture-used-a-different-rail-pose-than-initial-state")); }
        if !longueur_vraie(ch(obs, "chunkIds")) || !ch(obs, "pointsSaved").vrai() { reasons.push(s("saved-points-missing")); }
        let es = ch(&intent0, "eventSeq");
        if es.vrai() && num_cmp(ch(obs, "eventSeq"))? >= num_cmp(es)? { reasons.push(s("geometry-completed-after-operator-intent")); }
        if !reasons.is_empty() { failures.extend(reasons); continue; }
        let cs = ch(obs, "coordinateSystem");
        return Ok(Obj::new().et("status", s("qualified-candidate")).et("captureId", ch(obs, "captureId").clone()).et("chunkIds", copie_liste(ch(obs, "chunkIds"))?)
            .et("points", ch(obs, "pointsSaved").clone()).et("capturedAt", ch(obs, "capturedAt").clone())
            .et("viewEpochId", ou(chemin(obs, &["viewObservation", "viewEpochId"]), Valeur::Nul))
            .et("coordinateSystem", clone_ou_hd(&ou_nul(cs, Valeur::Nul))?).et("reasons", vide()).v());
    }
    let r = if failures.is_empty() { vec![s("qualified-capture-missing")] } else { failures };
    Ok(Obj::new().et("status", s("excluded")).et("captureId", Valeur::Nul).et("chunkIds", vide()).et("points", Valeur::Nombre(0.0)).et("reasons", tab(unique(&r)?)).v())
}

/// `record.operatorIntents?.[0]` : premier élément d'une liste (`undefined` sinon) ; hors domaine pour une chaîne.
fn premier(v: &Valeur) -> Result<Valeur, Echec> {
    match v {
        Valeur::Chaine(_) => hd("operatorIntents chaîne"),
        Valeur::Objet(_) => Ok(ch(v, "0").clone()),
        _ => Ok(js::elements(v).and_then(|l| l.first().cloned()).unwrap_or(Valeur::Indefini)),
    }
}

/// Réglages de `classify` et `referenceFromWrite` (résolus par la façade : `S.echo?.x ?? défaut`).
#[derive(Debug, Clone, Copy)]
pub struct Echo {
    /// `movementThresholdM`.
    pub mouvement: f64,
    /// `ecritureReferenceSeuilM`.
    pub ecriture: f64,
    /// `freshnessSkewMs`.
    pub fraicheur: f64,
}
impl Echo {
    /// Les trois réglages lus dans l'entrée.
    ///
    /// # Errors
    /// Hors domaine : réglage non numérique.
    pub fn de(e: &Valeur) -> Result<Self, Echec> {
        Ok(Echo { mouvement: reglage(e, "movementThresholdM")?, ecriture: reglage(e, "ecritureReferenceSeuilM")?, fraicheur: reglage(e, "freshnessSkewMs")? })
    }
}

/// `this.partialReason(record, reason)` sur la liste tenue à part.
fn partial(l: &mut Vec<Valeur>, reason: &str) {
    if !l.iter().any(|x| est(x, reason)) { l.push(s(reason)); }
}
/// `completeRails(state)`.
fn complete_rails(st: &Valeur) -> bool { SIDES.iter().all(|side| chemin(st, &["rails", side]).vrai()) }
/// `K.manualDecision(rails, 'VALIDATE')` sur deux drapeaux.
fn manual_decision(left: bool, right: bool) -> &'static str {
    if left && right { "VALIDATE_CORRECTED_BOTH" } else if left { "VALIDATE_CORRECTED_LEFT_ONLY" } else if right { "VALIDATE_CORRECTED_RIGHT_ONLY" } else { "VALIDATE_NO_MOVEMENT" }
}
/// `a || b || c`.
fn premier_vrai<'a>(l: &[&'a Valeur]) -> &'a Valeur { l.iter().find(|x| x.vrai()).copied().unwrap_or_else(|| l.last().copied().unwrap_or(&INDEFINI)) }

/// `classify(record)` (fonction 280) : rend `{record, assignes}` — l'enregistrement modifié et les clés de premier niveau
/// affectées, dans l'ordre de leur PREMIÈRE affectation par le JS (la façade les recopie en place). `chooseGeometry`
/// et `partialReason` sont ceux du prototype (la façade le vérifie).
///
/// # Errors
/// Hors domaine : toute forme où le JS lèverait en cours de modification (exception levée après des affectations),
/// conversions implicites, dates hors forme ISO.
pub fn classify(record: &Valeur, echo: Echo) -> Result<Valeur, Echec> {
    let Valeur::Objet(champs) = record else { return hd("classify : record non objet") };
    let mut r = Obj(champs.clone());
    let mut assignes: Vec<&str> = vec![];
    let affecter = |r: &mut Obj, a: &mut Vec<&'static str>, k: &'static str, v: Valeur| { r.poser(k, v); if !a.contains(&k) { a.push(k); } };
    let initial = premier_vrai(&[ch(record, "beforeEstablished"), ch(record, "firstObserved"), ch(record, "initialObserved")]).clone();
    let last = premier_vrai(&[ch(record, "lastObserved"), ch(record, "finalObserved")]).clone();
    // record.partialReasons = record.partialReasons || []  (tenue à part jusqu'au filtre, puis reposée)
    let pr0 = ch(record, "partialReasons");
    let mut pr: Vec<Valeur> = if pr0.vrai() {
        if !js::est_tableau(pr0) { return hd("partialReasons non tableau"); }
        js::denses(pr0)?.unwrap_or_default().into_owned()
    } else { vec![] };
    affecter(&mut r, &mut assignes, "partialReasons", tab(pr.clone()));
    let ge0 = ch(record, "geometryEligibility");
    if ge0.vrai() && !matches!(ge0, Valeur::Objet(_)) { return hd("geometryEligibility non objet"); }
    let mut ge = if ge0.vrai() { let Valeur::Objet(x) = ge0 else { return hd("ge") }; Obj(x.clone()) }
        else { Obj::new().et("left", Obj::new().v()).et("right", Obj::new().v()).et("pair", Obj::new().v()) };
    affecter(&mut r, &mut assignes, "geometryEligibility", ge.clone().v());
    let uo0 = ch(record, "usableForOfflineEvaluationByRail");
    if uo0.vrai() && !matches!(uo0, Valeur::Objet(_)) { return hd("usableForOfflineEvaluationByRail non objet"); }
    let mut uo = if uo0.vrai() { let Valeur::Objet(x) = uo0 else { return hd("uo") }; Obj(x.clone()) }
        else { Obj::new().et("left", Valeur::Booleen(false)).et("right", Valeur::Booleen(false)) };
    affecter(&mut r, &mut assignes, "usableForOfflineEvaluationByRail", uo.clone().v());
    if !initial.vrai() { partial(&mut pr, "initial-state-not-established"); }
    if !last.vrai() { partial(&mut pr, "last-state-missing"); }
    if initial.vrai() && last.vrai() && cible_differe(ch(&initial, "identity"), ch(&last, "identity"))? { partial(&mut pr, "initial-last-identity-mismatch"); }
    if !complete_rails(&initial) || !complete_rails(&last) { partial(&mut pr, "one-or-both-rails-missing"); }
    let iv = ch(record, "operatorIntents");
    let intents: Vec<Valeur> = if iv.vrai() {
        let Some(l) = js::denses(iv)? else { return hd("operatorIntents non tableau") };
        l.into_owned()
    } else { vec![] };
    let mut valeurs_intent = vec![];
    for it in &intents { if !matches!(it, Valeur::Objet(_)) { return hd("intention non objet"); } valeurs_intent.push(ch(it, "intent").clone()); }
    let kinds = unique(&valeurs_intent)?;
    affecter(&mut r, &mut assignes, "multiIntent", Valeur::Booleen(intents.len() > 1));
    let repeated = intents.len() > 1 && kinds.len() == 1 && kinds.first().is_some_and(|k| est(k, "VALIDATE"));
    let sole = if intents.len() == 1 { intents.first().cloned() } else if repeated { intents.last().cloned() } else { None };
    affecter(&mut r, &mut assignes, "intentCollapse", if repeated {
        Obj::new().et("kind", s("repeated-validate")).et("count", Valeur::Nombre(intents.len() as f64)).et("referenceFrom", s("last-validate-intent")).v()
    } else { Valeur::Nul });
    affecter(&mut r, &mut assignes, "operatorIntent", if intents.is_empty() { Valeur::Nul } else if kinds.len() > 1 { s("AMBIGUOUS_MULTIPLE") } else { kinds.first().cloned().unwrap_or(Valeur::Indefini) });
    let sp = ch(record, "startPose");
    let start = if ch(sp, "rails").vrai() { sp.clone() } else { initial.clone() };
    let mut label = Obj::new().et("startPose", ou(ch(sp, "source"), s("before-established"))).et("thresholdMm", Valeur::Nombre(echo.mouvement * 1000.0));
    affecter(&mut r, &mut assignes, "labelBasis", label.clone().v());
    let sole_intent = sole.as_ref().map_or(&INDEFINI, |x| ch(x, "intent"));
    let hfr = ch(record, "humanFinalReference").clone();
    if intents.is_empty() { affecter(&mut r, &mut assignes, "observedLabelCandidate", s("PASS_NO_DECISION")); partial(&mut pr, "operator-decision-not-observed"); }
    else if kinds.len() > 1 { affecter(&mut r, &mut assignes, "observedLabelCandidate", s("AMBIGUOUS_MULTIPLE_INTENTS")); partial(&mut pr, "multiple-operator-intents-observed"); }
    else if sole.is_none() { return hd("classify : sole nul (le JS lève)"); }
    else if est(sole_intent, "SKIP") { affecter(&mut r, &mut assignes, "observedLabelCandidate", s("SKIP")); affecter(&mut r, &mut assignes, "humanFinalReference", Valeur::Nul); }
    else if est(sole_intent, "VALIDATE") {
        let reference = ch(&hfr, "state");
        if reference.vrai() {
            if cible_differe(ch(record, "identity"), ch(reference, "identity"))? { partial(&mut pr, "human-final-reference-identity-mismatch"); }
            let mut delta = Obj::new();
            affecter(&mut r, &mut assignes, "humanDelta", delta.clone().v());
            let mut ch_lr = [false, false];
            for (i, side) in SIDES.iter().enumerate() {
                let (a, b) = (chemin(&start, &["rails", side]), chemin(reference, &["rails", side]));
                if a.vrai() && b.vrai() {
                    // une exception de C.point ici sortirait de classify après des affectations : hors domaine
                    let d = rail_delta(a, b, &Valeur::Indefini, echo.mouvement).map_err(|e| match e { Echec::Js { .. } => Echec::hors_domaine("railDelta lève"), x => x })?;
                    if let Some(c) = ch_lr.get_mut(i) { *c = ch(&d, "changed").vrai(); }
                    delta.poser(side, d);
                }
            }
            affecter(&mut r, &mut assignes, "humanDelta", delta.v());
            affecter(&mut r, &mut assignes, "observedLabelCandidate", s(manual_decision(ch_lr[0], ch_lr[1])));
            let mut lg = [false, false];
            for (i, side) in SIDES.iter().enumerate() {
                let (a, b) = (chemin(&initial, &["rails", side]), chemin(reference, &["rails", side]));
                if a.vrai() && b.vrai() { if let Some(c) = lg.get_mut(i) { *c = !pose_equal(a, b, &Valeur::Indefini)?; } }
            }
            label.poser("legacyLabel", s(manual_decision(lg[0], lg[1])));
            affecter(&mut r, &mut assignes, "labelBasis", label.clone().v());
        } else { partial(&mut pr, "human-final-reference-missing"); affecter(&mut r, &mut assignes, "observedLabelCandidate", Valeur::Nul); }
    }
    else { affecter(&mut r, &mut assignes, "observedLabelCandidate", s("UNKNOWN_INTENT")); partial(&mut pr, "unknown-operator-intent"); }
    pr.retain(|x| !est(x, "decision-effect-not-observed"));
    let nav = ch(record, "navigationObserved").vrai() || ch(record, "serverConfirmed").vrai();
    if !intents.is_empty() && !nav { partial(&mut pr, "decision-effect-not-observed"); }
    affecter(&mut r, &mut assignes, "partialReasons", tab(pr.clone()));
    // chooseGeometry ne lit aucun des champs que classify a modifiés jusqu'ici : l'enregistrement d'entrée suffit
    let mut elig = [Obj::new(), Obj::new()];
    for (i, side) in SIDES.iter().enumerate() {
        let Valeur::Objet(g) = choose_geometry(record, side)? else { return hd("chooseGeometry") };
        if let Some(e) = elig.get_mut(i) { *e = Obj(g); }
        ge.poser(side, elig.get(i).cloned().unwrap_or_default().v());
    }
    let reference = r.lire("humanFinalReference").clone();
    let mut ref_reasons: Vec<Valeur> = vec![];
    if sole.is_none() || !est(sole_intent, "VALIDATE") {
        ref_reasons.push(s(if intents.len() > 1 { "multiple-operator-intents-observed" } else if est(sole_intent, "SKIP") { "operator-skip-observed" } else { "validated-reference-not-observed" }));
    }
    if !ch(&reference, "state").vrai() { ref_reasons.push(s("human-final-reference-missing")); }
    if matches!(chemin(&reference, &["association", "identityMatched"]), Valeur::Booleen(false)) { ref_reasons.push(s("human-final-reference-identity-mismatch")); }
    let f = chemin(&reference, &["association", "freshnessMs"]);
    if !est(ch(&reference, "source"), "validation-write") && (matches!(f, Valeur::Nul) || { let x = vers_nombre(f)?; x < -echo.fraicheur || x > 1500.0 }) {
        ref_reasons.push(s("human-final-reference-not-freshly-observed"));
    }
    if !nav { ref_reasons.push(s("decision-effect-not-observed")); }
    for (i, side) in SIDES.iter().enumerate() {
        let Some(e) = elig.get_mut(i) else { continue };
        let mut reasons = js::denses(e.lire("reasons"))?.map(std::borrow::Cow::into_owned).ok_or_else(|| Echec::hors_domaine("reasons"))?;
        reasons.extend(ref_reasons.iter().cloned());
        if !chemin(&reference, &["state", "rails", side]).vrai() { reasons.push(s("human-final-rail-state-missing")); }
        e.poser("referenceStatus", ou(ch(&reference, "status"), s("not-observed")));
        let u = unique(&reasons)?;
        let comparable = est(e.lire("status"), "qualified-candidate") && u.is_empty();
        e.poser("reasons", tab(u));
        e.poser("status", s(if comparable { "comparable-candidate" } else { "excluded" }));
        uo.poser(side, Valeur::Booleen(comparable));
        ge.poser(side, e.clone().v());
    }
    let (left, right) = (elig[0].clone().v(), elig[1].clone().v());
    let mut pair: Vec<Valeur> = vec![];
    for (nom, x) in [("left:", &left), ("right:", &right)] {
        if !est(ch(x, "status"), "comparable-candidate") {
            for m in js::denses(ch(x, "reasons"))?.unwrap_or_default().iter() { pair.push(s(&format!("{nom}{}", js::en_chaine(m)?))); }
        }
    }
    let (lc, rc) = (ch(&left, "coordinateSystem"), ch(&right, "coordinateSystem"));
    if ch(&left, "captureId").vrai() && ch(&right, "captureId").vrai() && (!js::strict(ch(lc, "name"), ch(rc, "name"))? || !js::strict(ch(lc, "units"), ch(rc, "units"))?) {
        pair.push(s("left-right-coordinate-systems-differ"));
    }
    let pair_ok = pair.is_empty();
    ge.poser("pair", Obj::new().et("status", s(if pair_ok { "comparable-candidate" } else { "excluded" })).et("leftCaptureId", ch(&left, "captureId").clone())
        .et("rightCaptureId", ch(&right, "captureId").clone()).et("simultaneousRequired", Valeur::Booleen(false))
        .et("sameViewEpoch", Valeur::Booleen(js::strict(ch(&left, "viewEpochId"), ch(&right, "viewEpochId"))?)).et("compatibilityChecked", Valeur::Booleen(true))
        .et("reasons", tab(unique(&pair)?)).v());
    affecter(&mut r, &mut assignes, "geometryEligibility", ge.v());
    affecter(&mut r, &mut assignes, "usableForOfflineEvaluationByRail", uo.v());
    affecter(&mut r, &mut assignes, "usableAsNativeReference", Valeur::Booleen(pair_ok));
    affecter(&mut r, &mut assignes, "usableForTraining", Valeur::Booleen(false));
    affecter(&mut r, &mut assignes, "trainingExclusionReason", s(if est(sole_intent, "SKIP") && sole.is_some() { "operator-skip-observed" } else if kinds.len() > 1 { "multiple-operator-intents-observed" } else { "native-reference-requires-explicit-review" }));
    if !longueur_vraie(ch(record, "lidarCaptureIds")) && !longueur_vraie(ch(record, "lidarChunkIds")) { partial(&mut pr, "lidar-missing"); }
    affecter(&mut r, &mut assignes, "partialReasons", tab(pr.clone()));
    let meta = initial.vrai() && last.vrai() && ch(record, "endedAt").vrai() && !est(ch(record, "endTimeStatus"), "unknown");
    affecter(&mut r, &mut assignes, "status", s(if meta && pr.is_empty() { "complete" } else { "partial" }));
    Ok(Obj::new().et("record", r.v()).et("assignes", tab(assignes.iter().map(|k| s(k)).collect())).v())
}

/// `referenceFromWrite(record, entry, writeAt)` (fonction 281) : rend `{retour:false}`, ou `{retour:true, index, ajout,
/// next}` que la façade applique (`list[index].supersededBy`, sinon `list.push(ajout)` ; `list.push(next)` ;
/// `record.humanFinalReference = next` ; `record.humanFinalReferenceSource`).
///
/// # Errors
/// Hors domaine : `writeAt` non numérique, liste non tableau ou à éléments non objets, dates hors forme ISO.
pub fn reference_from_write(record: &Valeur, entry: &Valeur, write_at: &Valeur, echo: Echo) -> Result<Valeur, Echec> {
    let faux = || Obj::new().et("retour", Valeur::Booleen(false)).v();
    let current = ch(record, "humanFinalReference");
    if !ch(current, "state").vrai() { return Ok(faux()); }
    let w = vers_nombre(write_at)?;
    let et = event_time(current)?;
    if !(w >= et) { return Ok(faux()); }
    if js::nul(entry) { return hd("referenceFromWrite : entry absente (le JS lève)"); }
    let fix = reference_par_ecriture(ch(current, "state"), ch(record, "lastObserved"), ch(entry, "body"), &Valeur::Indefini, echo.ecriture)?;
    if !fix.vrai() { return Ok(faux()); }
    let state = ch(&fix, "state").clone();
    let state_at = date_de(ch(&state, "capturedAt"))?;
    let fresh = if est(ch(&fix, "poseFrom"), "last-observed-state") && state_at.is_finite() { et - state_at } else { 0.0 };
    let assoc = ch(current, "association");
    let next = Obj::new().et("status", s("candidate-observed")).et("state", state.clone()).et("observedAt", ch(current, "observedAt").clone())
        .et("eventSeq", ch(current, "eventSeq").clone()).et("decisionKey", ou_nul(ch(current, "decisionKey"), Valeur::Nul)).et("source", s("validation-write"))
        .et("association", Obj::new().et("identityMatched", Valeur::Booleen(!matches!(ch(assoc, "identityMatched"), Valeur::Booleen(false))))
            .et("freshnessMs", Valeur::Nombre(fresh)).et("source", s("validation-write")).et("eventTimeStamp", ou_nul(ch(assoc, "eventTimeStamp"), Valeur::Nul))
            .et("stateCapturedAt", ou(ch(&state, "capturedAt"), Valeur::Nul)).et("reviewed", Valeur::Booleen(false)).v())
        .et("replacedByWrite", Obj::new().et("eventId", ch(entry, "eventId").clone()).et("at", ch(entry, "at").clone()).et("status", ch(entry, "status").clone())
            .et("rowIndex", ch(entry, "rowIndex").clone()).et("poseFrom", ch(&fix, "poseFrom").clone()).et("sides", ch(&fix, "sides").clone())
            .et("diffMm", ch(&fix, "diffMm").clone()).et("maxDiffMm", ch(&fix, "maxDiffMm").clone()).et("thresholdMm", Valeur::Nombre(echo.ecriture * 1000.0)).v())
        .et("replaces", Obj::new().et("status", ch(current, "status").clone()).et("stateCapturedAt", ou(chemin(current, &["state", "capturedAt"]), Valeur::Nul))
            .et("eventSeq", ch(current, "eventSeq").clone()).et("source", ou(ch(current, "source"), ou(ch(assoc, "source"), Valeur::Nul))).v()).v();
    let liste = ch(record, "humanFinalReferences");
    let items: Vec<Valeur> = if js::nul(liste) { vec![] } else {
        let Some(l) = js::elements(liste) else { return hd("humanFinalReferences non tableau") };
        if let Valeur::Tableau(t) = liste { if t.iter().any(Option::is_none) { return hd("humanFinalReferences à trous"); } }
        l.into_owned()
    };
    let mut index = -1.0;
    for (i, it) in items.iter().enumerate() {
        if !matches!(it, Valeur::Objet(_)) { return hd("référence non objet"); }
        if js::strict(ch(it, "eventSeq"), ch(current, "eventSeq"))? && js::strict(ch(it, "observedAt"), ch(current, "observedAt"))? && !ch(it, "supersededBy").vrai() { index = i as f64; break; }
    }
    let ajout = if index < 0.0 {
        let Valeur::Objet(c) = clone(current)? else { return hd("clone de la référence") };
        let mut o = Obj(c);
        o.poser("supersededBy", s("validation-write"));
        o.v()
    } else { Valeur::Nul };
    Ok(Obj::new().et("retour", Valeur::Booleen(true)).et("index", Valeur::Nombre(index)).et("ajout", ajout).et("next", next).v())
}

/// Réglage numérique résolu par la façade (`{reglages: {...}}`, valeurs `S.echo?.x ?? défaut` du JS).
///
/// # Errors
/// Hors domaine : réglage absent ou non numérique (le JS comparerait une chaîne).
pub fn reglage(e: &Valeur, cle: &str) -> Result<f64, Echec> { nombre(chemin(e, &["reglages", cle])).ok_or_else(|| Echec::hors_domaine("réglage non numérique")) }

/// `INDEFINI` réexporté pour les appelants.
#[must_use]
pub fn indefini() -> &'static Valeur { &INDEFINI }

#[cfg(test)]
#[allow(clippy::float_cmp)]
mod essais {
    use super::*;
    fn pose(x: f64) -> Valeur {
        let m: Vec<f64> = (0..16).map(|i| if i % 5 == 0 { 1.0 } else { 0.0 }).collect();
        Obj::new().et("positionSceneRelative", Valeur::Nombres(vec![x, 0.0, 0.0])).et("sceneRelativeToProfileLocal", Valeur::Nombres(m.clone()))
            .et("railLocalToSceneRelative", Valeur::Nombres(m.clone())).et("profileLocalToSceneRelative", Valeur::Nombres(m)).v()
    }
    #[test]
    fn delta_et_egalite() {
        assert_eq!(pose_equal(&pose(0.0), &pose(1.0), &Valeur::Indefini), Ok(true));
        let d = rail_delta(&pose(0.0), &pose(0.002), &Valeur::Indefini, 0.001).unwrap_or(Valeur::Nul);
        assert_eq!(ch(&d, "changed"), &Valeur::Booleen(true));
        assert_eq!(ch(&d, "distanceMm"), &Valeur::Nombre(2.0));
    }
    #[test]
    fn reference_ecriture() {
        let etat = Obj::new().et("rails", Obj::new().et("left", pose(0.0)).v()).v();
        let body = Obj::new().et("XLeftEdge", Valeur::Nombre(0.01)).et("YLeftEdge", Valeur::Nombre(0.0)).et("ZLeftEdge", Valeur::Nombre(0.0)).v();
        let r = reference_par_ecriture(&etat, &Valeur::Nul, &body, &Valeur::Indefini, 0.001).unwrap_or(Valeur::Nul);
        assert_eq!(ch(&r, "poseFrom"), &s("write"));
        assert_eq!(ch(&r, "maxDiffMm"), &Valeur::Nombre(10.0));
    }
    #[test]
    fn visite_et_reduction() {
        let id = Obj::new().et("part", Valeur::Nombre(1.0)).et("cut", Valeur::Nombre(2.0)).v();
        let n = Obj::new().et("id", s("N")).et("visits", tab(vec![Obj::new().et("visitId", s("v")).et("identity", id.clone()).et("observationPeriodId", s("p")).v()])).v();
        let r = visit_relation(&n, &id, &s("p"), &Valeur::Indefini).unwrap_or(Valeur::Nul);
        assert_eq!(ch(&r, "type"), &s("revisit"));
        let d = Obj::new().et("collectorMetrics", Valeur::Nombre(1.0)).et("x", Valeur::Nombre(2.0)).v();
        assert_eq!(redacted_event(&s("operator-gesture"), &d), Ok(Obj::new().et("x", Valeur::Nombre(2.0)).v()));
    }
    #[test]
    fn metriques_qualite_sante_export() {
        let m = Obj::new().et("queueDepthMax", Valeur::Nombre(1.0)).et("degradationLevels", tab(vec![])).v();
        let r = merge_metrics(&m, &Obj::new().et("queueDepthMax", Valeur::Nombre(4.0)).et("degradationLevel", s("LOW")).v()).unwrap_or(Valeur::Nul);
        assert_eq!(chemin(&r, &["m", "queueDepthMax"]), &Valeur::Nombre(4.0));
        let n = Obj::new().et("status", s("RUNNING")).v();
        let c = Obj::new().et("format", s("banane-native-lidar-chunk-v1")).et("side", s("left")).et("identity", Obj::new().et("part", Valeur::Nombre(1.0)).v())
            .et("qualification", Obj::new().et("status", s("qualified-candidate")).v()).v();
        let q = account_quality(&n, &c, 4000.0).unwrap_or(Valeur::Nul);
        assert_eq!(chemin(&q, &["quality", "railsQualified"]), &Valeur::Nombre(1.0));
        let h = health(&n, &Valeur::Nombre(10.0)).unwrap_or(Valeur::Nul);
        assert_eq!(ch(&h, "degradationLevel"), &s("FULL"));
        let n = Obj::new().et("cloudIds", tab(vec![s("a"), s("b")])).et("exportState", Obj::new().et("bytesPending", Valeur::Nombre(20.0)).et("exportedCloudIds", tab(vec![s("a")])).v()).v();
        let a = export_advice(&n, &Valeur::Nombre(10.0)).unwrap_or(Valeur::Nul);
        assert_eq!(ch(&a, "pendingClouds"), &Valeur::Nombre(1.0));
        assert_eq!(ch(&a, "due"), &Valeur::Booleen(true));
    }
}
