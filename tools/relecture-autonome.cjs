#!/usr/bin/env node
'use strict';
/*
 * relecture-autonome.cjs — si Ariane refaisait la relecture de Mic, en visitant les mêmes cuts, son moteur (et la hauteur
 * apprise) auraient-ils produit la même correction ? Étude HORS LIGNE (5.0, chantier « relecture autonome », fiche
 * fiches/RELECTURE_AUTONOME.md). Rien n'est changé à l'extension ; aucune action dans ESV.
 *
 *   node tools/relecture-autonome.cjs extraire --partie P:N --echo DOSSIER [--echo DOSSIER…] --jeu JEU.jsonl --sortie CAS.jsonl
 *   node tools/relecture-autonome.cjs etudier --cas CAS.jsonl [--cas …] [--zones ZONES.json] [--json SORTIE.json]
 *   node tools/relecture-autonome.cjs essai
 *
 * EXTRAIRE. Pour chaque cut que Mic a visité dans l'Écho (partie P:N) :
 *  - l'ENTRÉE SANS FUITE de sa première visite (`entreeSansFuite` de src/native-session.js, la frontière de l'ombre « mémoire des
 *    différés ») : la pose de départ (celle qu'ESV montrait, qu'elle vienne de l'extraction, d'un opérateur ou du lot Orbite) et les
 *    points capturés autour d'elle AVANT le premier geste de Mic. Jamais la référence humaine ;
 *  - le MOTEUR tel qu'il est livré (`Shadow.scientificProposeBoth`, gcv1-shadow.js) et la DÉCISION du lot sans appui
 *    (`LotDecision.decideCut`, premier passage : gardes de paire et d'écartement comprises), puis la HAUTEUR APPRISE
 *    (`src/hauteur-apprise.js`, `evaluer`), et la surface des règles métier (`src/regles-metier.js` : `flushPct`, quarts, rails de plus) ;
 *  - la correction de Mic : pose de départ → dernière validation (corrigée par l'écriture serveur, D-143), ou correction nulle par la
 *    règle « visité sans action = bon » (0,8 s). Repère profil du rail de départ, mm [longitudinal, latéral, vertical].
 * La sortie ne porte que des numéros de cut, des millimètres, des comptes et des drapeaux : aucune coordonnée, aucun identifiant.
 *
 * ETUDIER. Juge, cut par cut et rail par rail, la pose qu'Ariane aurait donnée contre la pose finale de Mic, et cherche une règle de
 * CORRECTION PRUDENTE (corriger seulement si…, sinon laisser) en validation croisée par partie. Voir la fiche.
 */
const fs = require('node:fs'), path = require('node:path');
const C = require('../vendor/capture-core.js');
const K = require('../src/core.js');
const X = require('../src/native-export.js');
const V = require('./lire-volumes.cjs');
const J = require('./jointure-echo-orbite.cjs');
const Shadow = require('../src/gcv1-shadow.js');
const L = require('../src/lot-decision.js');
const H = require('../src/hauteur-apprise.js');
const M = require('../src/regles-metier.js');
const { entreeSansFuite } = require('../src/native-session.js');

const SIDES = ['left', 'right'];
const FORMAT = 'ariane-relecture-autonome-cas-v1';
const fini = v => typeof v === 'number' && Number.isFinite(v);
const r1 = v => fini(v) ? Math.round(v * 10) / 10 : null;
const r2 = v => fini(v) ? Math.round(v * 100) / 100 : null;
const vec3 = v => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(fini) ? v.slice(0, 3) : null;

/* Décalage d'une position par rapport au rail de départ, repère profil de ce rail (mm, [long, lat, vert]). */
function decalage(rail, p) {
  const M16 = rail && rail.sceneRelativeToProfileLocal, o = rail && vec3(rail.positionSceneRelative), q = vec3(p);
  if (!Array.isArray(M16) || M16.length !== 16 || !o || !q) return null;
  const a = C.point(M16, q), b = C.point(M16, o);
  return [0, 1, 2].map(i => r2(1000 * (a[i] - b[i])));
}

/* ------------------------------------------------------------------ lecture de l'Écho */
const resoudre = D => v => v && typeof v === 'object' && typeof v.__ref === 'string' ? X.unfoldRefs(v, D) : v;
/* Les chunks de nuage des visites demandées, tous segments, dédoublonnés par chunkId. Les points sont gardés en Float32 relatifs
 * à la position du rail du chunk (la scène est en coordonnées absolues : Float64 ne tiendrait pas en mémoire sur les grosses parties). */
function chunksDesVisites(dossiers, visites) {
  const out = new Map(), vus = new Set();
  for (const d of dossiers) for (const en of J.__entreesEcho ? J.__entreesEcho([d]) : V.entrees(d)) {
    if (!/^(ariane|banane)-(native-v\d+|echo)-/.test(en.nom)) continue;
    let doc; try { doc = JSON.parse(en.lire().toString('utf8')); } catch { continue; }
    const R = resoudre(doc.dictionaries || {});
    for (const c of doc.clouds || []) {
      if (!c || !Array.isArray(c.pointsSceneRelative) || !visites.has(c.visitId) || !SIDES.includes(c.side)) continue;
      if (c.chunkId && vus.has(c.chunkId)) continue;
      if (c.chunkId) vus.add(c.chunkId);
      const rail = R(c.rail), o = rail && vec3(rail.positionSceneRelative);
      if (!o) continue;
      const n = c.pointsSceneRelative.length, f = new Float32Array(3 * n), vis = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const p = c.pointsSceneRelative[i];
        f[3 * i] = p[0] - o[0]; f[3 * i + 1] = p[1] - o[1]; f[3 * i + 2] = p[2] - o[2];
        vis[i] = Array.isArray(c.visibleByClipBoxes) ? (c.visibleByClipBoxes[i] === true ? 1 : 0) : 2;
      }
      const l = out.get(c.visitId) || [];
      l.push({ chunkId: c.chunkId || null, captureId: c.captureId, visitId: c.visitId, side: c.side, rail, origine: o,
        capturedAt: c.capturedAt || null, acquisition: c.acquisition ? { endedAt: c.acquisition.endedAt || null } : null,
        coordinateSystem: R(c.coordinateSystem) ?? null, f, vis });
      out.set(c.visitId, l);
    }
    doc = null;
  }
  return out;
}
/* Un chunk tel que `gatherInput` l'attend (points absolus, visibilité). `visibiliteAbsente` : visibilité non relevée → tout visible. */
function chunkComplet(k) {
  const n = k.vis.length, pts = new Array(n), vis = new Array(n), o = k.origine;
  for (let i = 0; i < n; i++) { pts[i] = [o[0] + k.f[3 * i], o[1] + k.f[3 * i + 1], o[2] + k.f[3 * i + 2]]; vis[i] = k.vis[i] !== 0; }
  return { chunkId: k.chunkId, captureId: k.captureId, visitId: k.visitId, side: k.side, rail: k.rail, capturedAt: k.capturedAt,
    acquisition: k.acquisition, coordinateSystem: k.coordinateSystem, pointsSceneRelative: pts, visibleByClipBoxes: vis };
}

/* Dernière validation observée d'un cut (D-143 compris), comme `referenceHumaine` de la jointure. */
function referenceHumaine(visites) {
  for (let i = visites.length - 1; i >= 0; i--) {
    const h = visites[i].humanFinalReference;
    if (h && h.state && SIDES.some(s => h.state.rails && h.state.rails[s] && vec3(h.state.rails[s].positionSceneRelative))) {
      const corr = J.corrigerParEcriture(visites[i], h);
      return { visite: visites[i], etat: corr && corr.etat ? corr.etat : h.state, rang: i };
    }
  }
  return null;
}
/* La première visite a-t-elle écrit « vu » (SeenByOperator) ? null si l'export ne porte pas les écritures. */
function vuEcrit(v) {
  if (!Array.isArray(v.serverWrites)) return null;
  return v.serverWrites.some(w => w && (w.kind === 'seen' || (w.body && Object.keys(w.body).length === 1 && 'SeenByOperator' in w.body)));
}

/* ------------------------------------------------------------------ calcul d'un cut */
/* `entree` : entrée sans fuite ; rend ce qu'Ariane aurait donné, en décalages depuis la pose de départ. */
const ecartementDe = pos => pos && vec3(pos.left) && vec3(pos.right) ? r1(1000 * Math.hypot(...[0, 1, 2].map(i => pos.left[i] - pos.right[i]))) : null;
/* Une décision du lot et sa hauteur apprise, en décalages depuis la pose de départ. */
function variante(capture, science, anchors) {
  const decision = L.decideCut({ capture, science, anchors, Shadow });
  let haut = null;
  if (decision.positions) { try { haut = H.evaluer({ capture, science, decision }); } catch { haut = null; } }
  const rails = {};
  for (const s of SIDES) {
    const h = haut && haut.rails[s];
    rails[s] = { pose: decision.positions ? decalage(capture.rails[s], decision.positions[s]) : null, hauteurMm: h ? h.correctionMm : null,
      hauteurAbstention: h ? h.abstention : null, groupe: h ? h.groupe : null, epaisseurDessusMm: h ? h.epaisseurDessusMm : null, pointsDessus: h ? h.pointsDessus : null };
  }
  return { decision, haut, v: { stage: decision.stage, reason: decision.reason ?? null, appuis: (decision.anchorsUsed || []).length,
    ecartDeVoieMm: r1(decision.guardMm ?? decision.fromPredictionMm), ecartementPoseMm: ecartementDe(decision.positions), rails } };
}
/* `entree` : entrée sans fuite ; rend ce qu'Ariane aurait donné, en décalages depuis la pose de départ :
 *  - sans appui (`seul`, champs à la racine) : le cut visité seul, premier passage du lot ;
 *  - `chaine` : avec pour appuis les poses qu'elle vient de donner aux cuts précédents de la même relecture (ordre des cuts),
 *    comme le lot le fait de ses propres poses. Jamais une pose de Mic. */
function poseAriane(entree, { tous = null, appuis = null } = {}) {
  const capture = { identity: entree.identity, rails: entree.rails, pointsSceneRelative: entree.points, visibleByClipBoxes: entree.visible };
  const science = Shadow.scientificProposeBoth(capture);
  const seul = variante(capture, science, []), decision = seul.decision, haut = seul.haut;
  const out = { stage: decision.stage, reason: decision.reason ?? null, ecartementMm: r1(science.pairGauge && science.pairGauge.predictedMm),
    ecartementDepartMm: ecartementDe({ left: entree.rails.left.positionSceneRelative, right: entree.rails.right.positionSceneRelative }),
    ecartementPoseMm: seul.v.ecartementPoseMm,
    pairGaugeRejected: !!(science.summary && science.summary.pairGaugeRejected), rails: {} };
  if (appuis) {
    const ch = variante(capture, science, appuis.liste);
    out.chaine = ch.v;
    if (ch.decision.positions && ch.decision.anchor !== false && ['first-pass', 'window', 'crossing'].includes(ch.decision.stage))
      L.rememberAnchor(appuis.liste, { identity: { part: capture.identity.part, cut: capture.identity.cut, frameId: null }, positions: ch.decision.positions, stage: ch.decision.stage }, 40);
  }
  for (const s of SIDES) {
    const r = science.rails[s], rail = entree.rails[s];
    const brut = r && r.ok && r.next && r.next.status === 'candidate' && Array.isArray(r.next.delta) ? r.next.delta.map(v => r2(1000 * v)) : null;
    const h = haut && haut.rails[s];
    out.rails[s] = {
      statut: r && r.ok ? r.next.status : 'absent', motif: r && r.ok ? (r.next.motif ?? null) : null,
      confiance: r && r.astar ? r1(r.astar.confidence) : null, rapportPerte: r && r.astar ? r2(r.astar.lossRatio) : null,
      topRows: r && r.ok ? (r.next.topRows ?? null) : null, faceCount: r && r.ok ? (r.next.faceCount ?? null) : null,
      s1: !!(r && r.s1Changed), fortsConcurrents: r && r.competitive ? (r.competitive.nStrongCompetitive ?? null) : null,
      /* Proposition du moteur (repère profil de la pose de départ) et pose de la décision. */
      moteur: brut, pose: decision.positions ? decalage(rail, decision.positions[s]) : null,
      hauteurMm: h ? h.correctionMm : null, hauteurAbstention: h ? h.abstention : null, groupe: h ? h.groupe : null,
      epaisseurDessusMm: h ? h.epaisseurDessusMm : null, pointsDessus: h ? h.pointsDessus : null,
    };
  }
  /* Surface des règles métier (PN, ADV) : tous les points de la capture, comme le lecteur de l'Écho de tools/regles-metier.cjs. */
  try {
    const cap2 = tous || capture;
    let sf = M.surface(cap2);
    if (!(sf.sidePoints >= M.DEFAULTS.surface.sidePointsMin) && tous) sf = M.surface({ rails: tous.rails, pointsSceneRelative: tous.pointsSceneRelative });
    out.surface = { flushPct: sf.flushPct ?? null, quadMin: sf.quadMin ?? null, sidePoints: sf.sidePoints ?? null, coeurPN: !!sf.coeurPN, advRails: sf.advRails ?? null };
  } catch { out.surface = null; }
  return out;
}

function extraire({ partie, projet, echo, jeu }) {
  const e = J.lireEcho(echo);
  const parCut = [...J.echoParCut(e.records, e.sessions).values()].filter(c => c.partie === partie && c.cut >= 0);  // D-172 : les premiers cuts d'une partie sont dans le périmètre
  const labels = new Map();
  if (jeu) for (const l of fs.readFileSync(jeu, 'utf8').split('\n')) {
    if (!l.trim()) continue; const o = JSON.parse(l); if (o.type === 'cut') labels.set(o.cut, o);
  }
  /* Les nuages de TOUTES les visites du cut : une visite plus tardive dont la pose de rail est encore celle du départ (Mic n'a rien
   * bougé entre-temps) complète la capture de la première, souvent partielle à l'Écho (un seul rail lu). `gatherInput` ne garde que
   * les chunks pris autour de la pose de départ (même matrice) et, si la première visite a déplacé un rail, acquis avant ce geste. */
  const visites = new Set(parCut.flatMap(c => c.visites.map(v => v.visitId)));
  const chunks = chunksDesVisites(echo, visites);
  const ctx = { pagesPerdues: e.pagesPerdues, capturesParVisite: e.capturesParVisite };
  const appuis = { liste: [] };
  const cas = [];
  for (const c of parCut.sort((a, b) => a.cut - b.cut)) {
    const v0 = c.visites[0], lab = labels.get(c.cut) || null;
    const before = v0.beforeEstablished && v0.beforeEstablished.rails;
    const o = { format: FORMAT, projet, partie, cut: c.cut, visites: c.visites.length,
      dwellPremiereS: r1((Date.parse(v0.endedAt) - Date.parse(v0.startedAt)) / 1000),
      vuEcrit: vuEcrit(v0), classeLot: lab ? lab.classe : null, sourceJeu: lab ? (lab.source || null) : null,
      jeuMax3dMm: lab && lab.etiquette && lab.etiquette.correctionMm ? r1(lab.etiquette.correctionMm.maxDist3dMm) : null,
      mic: null, ariane: null };
    /* Correction de Mic depuis la pose de départ de la première visite. */
    const ref = referenceHumaine(c.visites);
    if (before && SIDES.every(s => before[s])) {
      if (ref) {
        const rails = {}; for (const s of SIDES) rails[s] = decalage(before[s], ref.etat.rails && ref.etat.rails[s] && ref.etat.rails[s].positionSceneRelative);
        o.mic = { ref: 'validation', rails };
      } else {
        const sa = J.visiteSansAction(c, J.DUREE_VISITE_DEFAUT_S, ctx);
        o.mic = sa.appliquee ? { ref: 'visite-bon', rails: { left: [0, 0, 0], right: [0, 0, 0] } } : { ref: null, raison: sa.raison };
      }
    } else o.mic = { ref: null, raison: 'sans-pose-de-depart' };
    /* Ariane sur l'entrée sans fuite. */
    const propres = (chunks.get(v0.visitId) || []).length;
    const ks = c.visites.flatMap(v => chunks.get(v.visitId) || []).map(chunkComplet).map(k => ({ ...k, visitId: v0.visitId }));
    o.chunksPremiere = propres; o.chunksAutres = ks.length - propres;
    /* SKIP (D-172) : statut écrit par Mic, et ce que la première visite a vu (points par rail, statuts de lecture). */
    o.skipMic = c.visites.some(v => (v.serverWrites || []).some(w => w && w.body && w.body.ExtractionStatus === 'skipped'));
    o.lecture = [...new Set(e.capturesParVisite[v0.visitId] || [])];
    o.pointsParRail = Object.fromEntries(SIDES.map(s => [s, ks.filter(k => k.side === s).reduce((n, k) => n + k.pointsSceneRelative.length, 0)]));
    if (!before || !SIDES.every(s => before[s] && before[s].sceneRelativeToProfileLocal)) o.ariane = { etat: 'sans-pose-de-depart' };
    else {
      /* Visibilité non relevée (exports anciens) : `gatherInput` ne garde que `=== true` ; on la tient pour vraie, comme le lecteur de surface. */
      let entree = entreeSansFuite(v0, ks);
      /* La chaîne d'appuis ignore le repère de page (`frameId`) : la scène de l'Écho est en coordonnées du projet, les mêmes d'une page à l'autre. */
      if (!entree.points.length && ks.length) { for (const k of ks) k.visibleByClipBoxes = k.visibleByClipBoxes.map(() => true); entree = entreeSansFuite(v0, ks); o.visibiliteForcee = true; }
      if (!entree.points.length || !SIDES.every(s => entree.rails[s] && entree.rails[s].profileContours && entree.rails[s].profileContours.length)) o.ariane = { etat: 'sans-nuage', chunks: ks.length };
      else {
        const pts = [], vis = [];
        for (const k of ks) if (k.side && (before[k.side] && k.rail)) for (let i = 0; i < k.pointsSceneRelative.length; i++) { pts.push(k.pointsSceneRelative[i]); vis.push(k.visibleByClipBoxes[i]); }
        const tous = { rails: entree.rails, pointsSceneRelative: pts, visibleByClipBoxes: vis };
        try { entree.identity = { ...entree.identity, frameId: null };
        o.ariane = { etat: 'calcule', points: entree.points.length, ...poseAriane(entree, { tous, appuis }) }; }
        catch (err) { o.ariane = { etat: 'erreur', message: String(err && err.message || err).slice(0, 120) }; }
      }
    }
    cas.push(o);
    for (const v of c.visites) chunks.delete(v.visitId);
  }
  return cas;
}

/* ------------------------------------------------------------------ étude */
const norme = v => Math.hypot(v[0], v[1], v[2]);
const moins = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/* Pose proposée par Ariane pour un cut, selon la variante : « moteur » (proposition brute, sans garde), « decision » (premier passage du
 * lot : gardes comprises ; null si différé), avec ou sans la hauteur apprise. */
function proposee(cas, { source = 'decision', hauteur = true } = {}) {
  const a = cas.ariane; if (!a || a.etat !== 'calcule') return null;
  const out = {};
  for (const s of SIDES) {
    const r = a.rails[s], p = source === 'moteur' ? r.moteur : r.pose;
    if (!p) return null;
    out[s] = hauteur && fini(r.hauteurMm) ? [p[0], p[1], p[2] + r.hauteurMm] : p.slice();
  }
  return out;
}
const max3d = rails => rails ? Math.max(...SIDES.map(s => norme(rails[s]))) : null;
/* Jugement d'un cut avec référence : correction de Mic, pose d'Ariane (ou null), décision de corriger (bool). */
function juger(cas, pose, corriger) {
  const mic = cas.mic.rails, cMic = max3d(mic);
  const garde = { mic: r1(cMic) };
  const err = pose ? Math.max(...SIDES.map(s => norme(moins(pose[s], mic[s])))) : null;
  garde.erreur = r1(err);
  garde.deplacement = pose ? r1(max3d(pose)) : null;
  if (!pose || !corriger) { garde.resultat = cMic > 10 ? 'laisse-faux' : cMic > 5 ? 'laisse-5-10' : 'laisse-juste'; return garde; }
  /* Corrigé : juste à 5 mm, juste à 10 mm, ou faux ; « abime » si Mic ne touchait pas (≤ 5 mm) et qu'Ariane le met à plus de 10 mm… */
  if (err <= 5) garde.resultat = cMic > 5 ? 'reproduit5' : 'confirme';
  else if (err <= 10) garde.resultat = cMic > 5 ? 'reproduit10' : 'abime-5-10';
  else garde.resultat = cMic > 10 ? 'faux-reste' : 'abime';
  return garde;
}

module.exports = { FORMAT, decalage, referenceHumaine, vuEcrit, poseAriane, extraire, proposee, juger, max3d, chunksDesVisites, chunkComplet };

/* ------------------------------------------------------------------ ligne de commande */
function args(argv) {
  const o = { mode: argv[0], echo: [], cas: [] };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], val = () => { const v = argv[++i]; if (v === undefined) throw Error('valeur manquante après ' + k); return v; };
    if (k === '--partie') { const [p, n] = val().split(':').map(Number); o.projet = p; o.partie = n; }
    else if (k === '--echo') o.echo.push(val()); else if (k === '--jeu') o.jeu = val(); else if (k === '--sortie') o.sortie = val();
    else if (k === '--cas') o.cas.push(val()); else if (k === '--json') o.json = val(); else if (k === '--zones') o.zones = val();
    else throw Error('argument inconnu : ' + k);
  }
  return o;
}
if (require.main === module) {
  try {
    const a = args(process.argv.slice(2));
    if (a.mode === 'extraire') {
      if (!a.partie || !a.echo.length || !a.sortie) throw Error('extraire --partie P:N --echo DOSSIER --jeu JEU.jsonl --sortie CAS.jsonl');
      const cas = extraire(a);
      fs.mkdirSync(path.dirname(path.resolve(a.sortie)), { recursive: true });
      fs.writeFileSync(a.sortie, cas.map(c => JSON.stringify(c)).join('\n') + '\n');
      const n = k => cas.filter(c => c.ariane && c.ariane.etat === k).length;
      console.log(`partie ${a.projet}:${a.partie} : ${cas.length} cuts, calculés ${n('calcule')}, sans nuage ${n('sans-nuage')}, erreurs ${n('erreur')}, avec référence ${cas.filter(c => c.mic && c.mic.ref).length}`);
    } else throw Error('mode : extraire | etudier | essai');
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
