#!/usr/bin/env node
'use strict';
/*
 * relecture-autonome.cjs — si Ariane refaisait elle-même la relecture de Mic (D-170) : quels cuts visiterait-elle (méthode de Mic), que
 * proposerait-elle (moteur, décision du lot, hauteur apprise), et quelles corrections peut-elle faire seule sans risque, avec quels seuils ?
 * Étude HORS LIGNE (5.0, fiches/RELECTURE_AUTONOME.md). Rien n'est changé à l'extension ; aucune action dans ESV.
 *
 *   node tools/relecture-autonome.cjs extraire --partie P:N --echo DOSSIER [--echo DOSSIER…] [--jeu JEU.jsonl] --sortie CAS.jsonl
 *                                              [--graine-ecartement-fictive --table TABLE.json [--greffer ANCIEN-CAS.jsonl]]
 *   node tools/relecture-autonome.cjs skip     --partie P:N --echo DOSSIER [...] --sortie SKIP.jsonl
 *   node tools/relecture-autonome.cjs table    --partie P:N --echo DOSSIER --journal J.json [--journal …] --cas CAS.jsonl --sortie TABLE.json
 *   node tools/relecture-autonome.cjs etudier  --partie P:N --cas CAS.jsonl --table TABLE.json [--skip SKIP.jsonl] [--partie …] [--json S.json]
 *                                              [--reglages datasets/relecture-reglages-proposes.json --date AAAA-MM-JJ] [--graine-ecartement-fictive]
 *   node tools/relecture-autonome.cjs juger    --reglages R.json --partie P:N --cas … --table … [--skip …] --juger-partie-reservee [--json S.json]
 *   node tools/relecture-autonome.cjs essai
 *
 * EXTRAIRE. Pour chaque cut que Mic a visité dans l'Écho (partie P:N) :
 *  - l'ENTRÉE SANS FUITE de sa première visite (`entreeSansFuite` de src/native-session.js, la frontière de l'ombre « mémoire des
 *    différés ») : la pose de départ (celle qu'ESV montrait, qu'elle vienne de l'extraction, d'un opérateur ou du lot Orbite) et les
 *    points capturés autour d'elle AVANT le premier geste de Mic. Jamais la référence humaine ;
 *  - le MOTEUR tel qu'il est livré (`Shadow.scientificProposeBoth`, gcv1-shadow.js) et la DÉCISION du lot (`LotDecision.decideCut`) :
 *    seul (premier passage, gardes de paire et d'écartement comprises) et en chaîne (appuis : ses propres poses des cuts précédents de la
 *    relecture, jamais une pose de Mic), puis la HAUTEUR APPRISE (`src/hauteur-apprise.js`, `evaluer`) et la surface des règles métier
 *    (`src/regles-metier.js` : `flushPct`, quarts, rails de plus) ;
 *  - la correction de Mic : pose de départ → dernière validation (corrigée par l'écriture serveur, D-143), ou correction nulle par la
 *    règle « visité sans action = bon » (0,8 s). Repère profil du rail de départ, mm [longitudinal, latéral, vertical].
 * La sortie ne porte que des numéros de cut, des millimètres, des comptes et des drapeaux : aucune coordonnée, aucun identifiant.
 *
 * SKIP. Relevé de la règle de Mic (D-172) : SKIP écrits par Mic, points et nuages sources vus par rail. TABLE. Table de partie (hors dépôt)
 * pour une partie qui n'a pas de table des verts : lot (journaux), verts (Écho), zones PN et ADV reconnues sur les cuts du lot.
 *
 * ETUDIER (parties d'apprentissage seulement : le manifeste refuse les autres). Sélection « méthode de Mic » (PN et ADV avec leurs marges,
 * abords des rouges et des différés, isolés, liste « À contrôler », verts compris) ; couverture des corrections de Mic ; reproduction cut
 * par cut (à 5 et 10 mm, cuts abîmés, mauvaise voie, abstentions) ; règle de CORRECTION PRUDENTE (agir seulement si…, sinon laisser)
 * choisie en validation croisée par partie, puis figée sur toutes les parties ; variante par type de zone ; courbe ; coût en temps.
 * JUGER : applique un réglage figé, sans rien régler, et donne les chiffres bruts avec une borne de Wilson à 95 %.
 *
 * OPTION `--graine-ecartement-fictive` (chantier P7, hypothèse H2 du catalogue, COUPÉE par défaut ; fiches/P7_GRAINE_ECARTEMENT_FICTIVE.md,
 * src/graine-ecartement-fictive.js) :
 *  - EXTRAIRE : un cut que la chaîne diffère et dont la pose de départ est FICTIVE (1 500 mm) : si le moteur a trouvé un rail, l'autre est
 *    replacé à l'écartement de référence (médiane des poses actuelles des voisins à ±5 cuts, non différés par le lot, pose non fictive,
 *    jamais Mic ; sinon médiane de la partie) et le moteur livré est relancé ; paire gardée sous les gardes du module. Résultat dans
 *    `chaineGraine`, jamais un appui de la chaîne. `--greffer ANCIEN.jsonl` garde les cas d'une extraction antérieure (source d'Écho
 *    devenue incomplète) et n'y reporte la graine que si la chaîne rend la même décision ;
 *  - ETUDIER : la variante en chaîne d'un différé du lot prend cette pose ; la grille gagne le choix « agir sur un différé seulement s'il
 *    vient de la graine » (`differes: 'graine'`), réglé en validation croisée comme le reste ; un différé posé par la graine agit sans les
 *    seuils des verts, et ses corrections ne comptent pas dans les 90 % de la règle de service (`sobre`), qui reste celle des verts.
 *    Tables par partie et type de zone, tous genres (règle de service et chiffre central), plus « en grappe » et « différés du lot ».
 *    Sans l'option : chiffres inchangés (mêmes règles, mêmes bilans ; seules les tables ajoutées en plus).
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
const GE = require('../src/graine-ecartement-fictive.js');

const SIDES = ['left', 'right'];
const FORMAT = 'ariane-relecture-autonome-cas-v1';
const FORMAT_ETUDE = 'ariane-relecture-autonome-etude-v1', FORMAT_JUGEMENT = 'ariane-relecture-autonome-jugement-v1', FORMAT_REGLAGES = 'ariane-relecture-reglages-1';
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
function variante(capture, science, anchors, decision = L.decideCut({ capture, science, anchors, Shadow })) {
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
/* `graine` (option P7, coupée) : { actif, poses: [{ cut, positions, differe }], gPartie } — poses ACTUELLES des voisins (jamais une pose de
 * Mic) et médiane de la partie. Un cut que la chaîne diffère, pose de départ fictive, reçoit la graine (src/graine-ecartement-fictive.js) :
 * `chaineGraine`, même forme que `chaine`, plus la tentative ; la graine n'entre jamais dans la liste des appuis de la chaîne. */
function poseAriane(entree, { tous = null, appuis = null, graine = null } = {}) {
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
    if (graine && graine.actif === true) {
      const poses = (graine.poses || []).map(p => ({ identity: { part: capture.identity.part, cut: p.cut, frameId: capture.identity.frameId ?? null }, positions: p.positions, differe: p.differe === true }));
      const r = GE.reprendre({ decision: ch.decision, capture, science, poses, gPartie: graine.gPartie, Shadow, options: { actif: true, ...(graine.options || {}) } });
      if (r.tentative) {
        const t = { post: 'graine', pose: r.tentative.pose, reference: r.tentative.reference, trouves: r.tentative.trouves, essais: r.tentative.essais, accordMm: r.tentative.accordMm };
        out.chaineGraine = r.tentative.pose ? { ...variante(capture, science, null, r.decision).v, ...t, reason: null }
          : { stage: ch.decision.stage, reason: r.tentative.reason, appuis: 0, rails: { left: { pose: null }, right: { pose: null } }, ...t };
      }
    }
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

function extraire({ partie, projet, echo, jeu, graine = false, table = null }) {
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
  /* Option P7 : poses actuelles des cuts visités (pose de départ de leur première visite, avant tout geste de Mic), cuts différés par le lot
   * (table de la partie, comme l'étude ; sans table, le jeu) et médiane de la partie (poses actuelles hors lot, non fictives). */
  let posesActuelles = null, differeLot = null, gPartie = null;
  if (graine) {
    differeLot = new Map();
    if (table) for (const x of table.lot || []) differeLot.set(x.cut, x.differe === true || x.valide === false);
    else for (const [cut, lab] of labels) differeLot.set(cut, lab.classe === 'differee');
    posesActuelles = new Map();
    for (const c of parCut) {
      const b = c.visites[0] && c.visites[0].beforeEstablished && c.visites[0].beforeEstablished.rails;
      if (b && SIDES.every(s => b[s] && vec3(b[s].positionSceneRelative))) posesActuelles.set(c.cut, { left: vec3(b.left.positionSceneRelative), right: vec3(b.right.positionSceneRelative) });
    }
    gPartie = med([...posesActuelles].filter(([cut, p]) => !differeLot.has(cut) && !GE.estFictive(p)).map(([, p]) => ecartementDe(p)));
  }
  const graineDe = cut => {
    if (!graine) return null;
    const poses = [];
    for (let j = cut - GE.DEFAUTS.rayon; j <= cut + GE.DEFAUTS.rayon; j++) if (j !== cut && posesActuelles.has(j)) poses.push({ cut: j, positions: posesActuelles.get(j), differe: differeLot.get(j) === true });
    return { actif: true, poses, gPartie };
  };
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
        o.ariane = { etat: 'calcule', points: entree.points.length, ...poseAriane(entree, { tous, appuis, graine: graineDe(c.cut) }) }; }
        catch (err) { o.ariane = { etat: 'erreur', message: String(err && err.message || err).slice(0, 120) }; }
      }
    }
    cas.push(o);
    for (const v of c.visites) chunks.delete(v.visitId);
  }
  return cas;
}

/* ------------------------------------------------------------------ relevé SKIP (D-172) */
/* Règle de Mic : un cut ne se met en SKIP que si AUCUN point ne s'affiche, ou si UN SEUL scanner s'affiche. Le relevé lit, pour chaque cut
 * visité, le SKIP écrit par Mic (écriture serveur `ExtractionStatus: skipped`) et ce que ses visites ont montré : points retenus par rail
 * et nuages sources (préfixe `cloud-N` des nœuds) ayant fourni des points. Sortie : numéros de cut et comptes seulement. */
const scannerDe = id => { const m = /^(cloud-\d+)-node-/.exec(String(id || '')); return m ? m[1] : null; };
function releverSkip(dossiers, partie) {
  const parVisite = new Map();
  for (const d of dossiers) for (const en of V.entrees(d)) {
    if (!/^(ariane|banane)-(native-v\d+|echo)-/.test(en.nom)) continue;
    let doc; try { doc = JSON.parse(en.lire().toString('utf8')); } catch { continue; }
    for (const c of doc.clouds || []) {
      if (!c || !/capture/.test(c.format || '') || !c.visitId) continue;
      const v = parVisite.get(c.visitId) || { captures: 0, statuts: new Set(), left: { pts: 0, sc: new Set() }, right: { pts: 0, sc: new Set() } };
      v.captures++; if (c.status) v.statuts.add(c.status);
      for (const s of SIDES) { const o = c.railObservations && c.railObservations[s]; if (o && fini(o.pointsRetained)) v[s].pts = Math.max(v[s].pts, o.pointsRetained); }
      for (const n of c.sourceNodes || []) { const k = scannerDe(n && n.nodeId); if (k) for (const s of SIDES) if (n.retainedByRail && n.retainedByRail[s] > 0) v[s].sc.add(k); }
      parVisite.set(c.visitId, v);
    }
    doc = null;
  }
  const e = J.lireEcho(dossiers), par = J.echoParCut(e.records, e.sessions), out = [];
  for (const c of par.values()) {
    if (c.partie !== partie || c.cut < 0) continue;
    const vs = c.visites.map(v => parVisite.get(v.visitId)).filter(Boolean);
    const r = { cut: c.cut, skipMic: c.visites.some(v => (v.serverWrites || []).some(w => w && w.body && w.body.ExtractionStatus === 'skipped')),
      ecritures: c.visites.some(v => Array.isArray(v.serverWrites)), visites: c.visites.length, captures: vs.reduce((a, v) => a + v.captures, 0) };
    for (const s of SIDES) { r['points_' + s] = Math.max(0, ...vs.map(v => v[s].pts)); r['scanners_' + s] = Math.max(0, ...vs.map(v => v[s].sc.size)); }
    out.push(r);
  }
  return out.sort((a, b) => a.cut - b.cut);
}
/* Ce que la règle dirait d'un cut relevé : 'skip-aucun-point', 'skip-un-scanner', 'visiter', ou 'inconnu' (aucune capture : on ne sait pas). */
function verdictSkip(r) {
  if (!r.captures) return 'inconnu';
  if (SIDES.every(s => !r['points_' + s])) return 'skip-aucun-point';
  if (SIDES.some(s => r['points_' + s] > 0 && r['scanners_' + s] === 1) && SIDES.every(s => r['scanners_' + s] <= 1) && r.nuagesDistincts > 1) return 'skip-un-scanner';
  return 'visiter';
}
function bilanSkip(releve) {
  const nuages = Math.max(0, ...releve.map(r => Math.max(r.scanners_left, r.scanners_right)));
  const b = { cuts: releve.length, avecEcritures: releve.filter(r => r.ecritures).length, skipMic: 0, skipMicDebut: 0, nuagesSourcesMax: nuages,
    retrouves: 0, retrouvesDebut: 0, fausseAlerte: 0, inconnus: 0, skipMicInconnus: 0, cutsSkipMic: [] };
  for (const r of releve) {
    const v = verdictSkip({ ...r, nuagesDistincts: nuages });
    if (v === 'inconnu') { b.inconnus++; if (r.skipMic) b.skipMicInconnus++; }
    if (r.skipMic) { b.skipMic++; if (r.cut <= 3) b.skipMicDebut++; b.cutsSkipMic.push(r.cut); if (v.startsWith('skip')) { b.retrouves++; if (r.cut <= 3) b.retrouvesDebut++; } }
    else if (v.startsWith('skip') && r.ecritures) b.fausseAlerte++;
  }
  /* Un seul nuage source dans toute l'Écho : les scanners ne se distinguent pas dans les captures (tous dans le même nuage d'ESV). */
  b.scannersLisibles = nuages > 1;
  return b;
}

/* ------------------------------------------------------------------ zones depuis les cas, table d'une partie */
/* Plages qui se recouvrent ou se touchent : une seule. */
function fusionner(pl) { const out = []; for (const p of pl.slice().sort((a, b) => a[0] - b[0])) { const d = out.at(-1); if (d && p[0] <= d[1] + 1) d[1] = Math.max(d[1], p[1]); else out.push(p.slice()); } return out; }
/* Zones PN et ADV reconnues par le module des règles métier (src/regles-metier.js) sur les surfaces des cas, dans l'ordre des cuts, comme
 * l'ombre du lot. `cuts` : les cuts lus (ceux du lot pour une partie traitée par Orbite). Aucune étiquette de Mic n'entre. */
function zonesDepuisCas(cas, { cuts = null } = {}) {
  const mem = M.creerMemoire('relecture');
  for (const c of cas.filter(c => c.ariane && c.ariane.surface && (!cuts || cuts.has(c.cut))).sort((a, b) => a.cut - b.cut)) {
    const s = c.ariane.surface;
    const r = M.resumer({ identity: { part: c.partie, cut: c.cut }, decision: null, action: null, valide: null, surface: { flushPct: s.flushPct, quadMin: s.quadMin, coeurPN: s.coeurPN, advRails: s.advRails } });
    M.evaluer(mem, r); M.noter(mem, r, { differe: false });
  }
  const P = M.DEFAULTS.pn, A = M.DEFAULTS.adv;
  return { zonesPN: mem.zones.map(z => ({ debut: z.debut, fin: z.fin, controle: [Math.max(0, z.debut - P.margeAvant), z.fin + P.margeApres] })),
    zonesADV: fusionner(mem.zonesADV.map(z => [Math.max(0, z.debut - A.margeAvant), z.fin + A.margeApres])) };
}
/* Table de partie (même format que les tables de tools/verts-a-controler.cjs ; HORS DÉPÔT : elle porte les bords des rails) pour une partie
 * qui n'en a pas : lot lu dans les journaux Orbite, verts lus dans l'Écho (pose de départ de la première visite), zones reconnues sur les
 * cuts du lot, correction de Mic tirée des cas (pour les seuls jugements). */
function construireTable({ projet, partie, echo, journaux, cas }) {
  const RM = require('./regles-metier.cjs'), lot = new Map();
  for (const f of journaux) {
    const j = RM.lireJournal(f, partie);
    for (const d of j.decisions) { const differe = !j.valide.has(d.cut); lot.set(d.cut, lot.has(d.cut) ? lot.get(d.cut) && differe : differe); }
  }
  const mm = new Map(cas.filter(c => c.mic && c.mic.ref).map(c => [c.cut, max3d(c.mic.rails)]));
  const e = J.lireEcho(echo), par = J.echoParCut(e.records, e.sessions), cuts = [];
  for (const c of par.values()) {
    if (c.partie !== partie || c.cut < 0) continue;
    const v = c.visites[0], i = v && (v.initialObserved || v.firstObserved), A = vec3(i && i.rails && i.rails.left && i.rails.left.positionSceneRelative), B = vec3(i && i.rails && i.rails.right && i.rails.right.positionSceneRelative);
    let duree = 0; for (const w of c.visites) { const t = (Date.parse(w.endedAt) - Date.parse(w.startedAt)) / 1000; if (fini(t) && t >= 0) duree += Math.min(t, 120); }
    cuts.push({ i: c.cut, classe: lot.has(c.cut) ? (lot.get(c.cut) ? 'differee' : 'posee') : 'hors-journal', mm: mm.has(c.cut) ? r2(mm.get(c.cut)) : null,
      dureeS: r2(duree), visites: c.visites.length, bords: A && B ? { left: A, right: B } : null });
  }
  cuts.sort((a, b) => a.i - b.i);
  const z = zonesDepuisCas(cas, { cuts: new Set(lot.keys()) });
  return { format: 'ariane-verts-table-v1', projet, partie, lot: [...lot].sort((a, b) => a[0] - b[0]).map(([cut, differe]) => ({ cut, differe })),
    zonesPN: z.zonesPN, zonesADV: z.zonesADV, cuts, note: 'table de travail HORS DÉPÔT : elle porte les bords des rails' };
}

/* ------------------------------------------------------------------ sélection « méthode de Mic » */
/* PN avec leurs marges (règles métier : 4 cuts avant, 6 après), zones d'ADV avec leurs marges (30 cuts de part et d'autre), abords du lot
 * (grappe de 3 rouges au moins, trous de 5 cuts au plus : toute la plage et 3 cuts de marge ; rouge isolé : le cut d'avant et celui d'après ;
 * différé : 2 cuts de part et d'autre ; les rouges eux-mêmes compris), liste « À contrôler » des verts (module livré). Verts compris. */
const SELECTION = Object.freeze({ grappeMin: 3, trouCuts: 5, margeGrappe: 3, margeIsole: 1, margeDiffere: 2 });
const TYPES = Object.freeze(['pn', 'adv', 'abords', 'liste']);
function selection(t, { liste = null, cfg = SELECTION } = {}) {
  const type = new Map(), lot = new Map();
  for (const x of t.lot || []) lot.set(x.cut, x.differe === true || x.valide === false ? 'differe' : 'pose');
  const fin = Math.max(0, ...(t.cuts || []).map(c => c.i), ...lot.keys());
  const mettre = (a, b, k) => { for (let i = Math.max(0, a); i <= Math.min(fin, b); i++) if (!type.has(i)) type.set(i, k); };
  for (const z of t.zonesPN || []) { const c = z.controle || [z.debut, z.fin]; mettre(c[0], c[1], 'pn'); }
  for (const z of t.zonesADV || []) { const c = Array.isArray(z) ? z : z.controle || [z.debut, z.fin]; mettre(c[0], c[1], 'adv'); }
  const runs = [];
  for (const c of [...lot.keys()].sort((a, b) => a - b)) { const r = runs.at(-1); if (r && c - r.at(-1) <= cfg.trouCuts) r.push(c); else runs.push([c]); }
  for (const r of runs) {
    if (r.length >= cfg.grappeMin) mettre(r[0] - cfg.margeGrappe, r.at(-1) + cfg.margeGrappe, 'abords');
    else for (const c of r) mettre(c - cfg.margeIsole, c + cfg.margeIsole, 'abords');
  }
  for (const [c, k] of lot) if (k === 'differe') mettre(c - cfg.margeDiffere, c + cfg.margeDiffere, 'abords');
  for (const c of liste || []) mettre(c, c, 'liste');
  const compte = Object.fromEntries(TYPES.map(k => [k, 0])), verts = Object.fromEntries(TYPES.map(k => [k, 0]));
  let revisites = 0;
  for (const [c, k] of type) { compte[k]++; if (!lot.has(c)) verts[k]++; else if (lot.get(c) === 'pose') revisites++; }
  /* Cuts « en grappe » (catalogue P7) : toute la plage d'une grappe du lot et ses marges, quelle que soit la zone qui les a pris. */
  const enGrappe = new Set();
  for (const r of runs) if (r.length >= cfg.grappeMin) for (let i = Math.max(0, r[0] - cfg.margeGrappe); i <= r.at(-1) + cfg.margeGrappe; i++) enGrappe.add(i);
  return { type, lot, fin, compte, verts, revisites, grappes: runs.filter(r => r.length >= cfg.grappeMin).length, isoles: runs.filter(r => r.length === 1).length, enGrappe };
}
/* La liste « À contrôler » (src/verts-a-controler.js, réglages livrés) sur la table de la partie. */
function listeAControler(t) {
  const VACT = require('./verts-a-controler.cjs'), VAC = require('../src/verts-a-controler.js');
  const p = VACT.preparer(t), L = VAC.liste(p.entree, p.opt);
  return { cuts: L.verts.map(v => v.i), aControler: L.aControler, candidats: L.candidats };
}

/* ------------------------------------------------------------------ lignes, issues, bilans */
const norme = v => Math.hypot(v[0], v[1], v[2]);
const moins = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const max3d = rails => rails ? Math.max(...SIDES.map(s => norme(rails[s]))) : null;
const med = a => { const s = a.filter(fini).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const VARIANTES = Object.freeze(['seul+h', 'seul', 'chaine+h', 'chaine']);
/* Proposition d'Ariane (décalage depuis la pose actuelle) : `seul` (cut visité seul, premier passage du lot) ou `chaine` (appuis : ses propres
 * poses des cuts précédents de la relecture) ; `+h` : hauteur apprise ajoutée. null si la décision diffère. */
/* Option P7 (`graine`) : pour un cut DIFFÉRÉ PAR LE LOT (`differe`) que la chaîne diffère, la variante en chaîne prend la pose de la graine
 * d'écartement (`chaineGraine`) si elle pose ; la proposition porte alors `post: 'graine'`. */
const pose2 = src => !!(src && src.rails && SIDES.every(s => src.rails[s] && src.rails[s].pose));
function proposition(cas, variante, { graine = false, differe = false } = {}) {
  const a = cas.ariane; if (!a || a.etat !== 'calcule') return null;
  let src = variante.startsWith('chaine') ? a.chaine : a, post = null; const h = variante.endsWith('+h'); if (!src) return null;
  if (graine && differe && variante.startsWith('chaine') && !pose2(src) && a.chaineGraine && a.chaineGraine.post === 'graine' && pose2(a.chaineGraine)) { src = a.chaineGraine; post = 'graine'; }
  const out = {};
  for (const s of SIDES) { const r = src.rails[s], p = r && r.pose; if (!p) return null; out[s] = h && fini(r.hauteurMm) ? [p[0], p[1], p[2] + r.hauteurMm] : p.slice(); }
  return { rails: out, stage: src.stage, ecartementPoseMm: src.ecartementPoseMm ?? a.ecartementPoseMm ?? null, post };
}
/* Lignes de jugement d'une partie : un cut visité par Mic, sa zone, son genre (pose, différé, vert), sa référence et les propositions. */
function lignes({ cas, table, designation, graine = false }) {
  const L = table ? listeAControler(table) : { cuts: [] };
  const S = table ? selection(table, { liste: L.cuts }) : selection({ cuts: [], lot: [] });
  const gMed = med(cas.filter(c => c.ariane && fini(c.ariane.ecartementDepartMm) && Math.abs(c.ariane.ecartementDepartMm - 1500) > 0.05 && !S.lot.has(c.cut)).map(c => c.ariane.ecartementDepartMm));
  const out = [];
  for (const c of cas) {
    const ref = c.mic && c.mic.ref ? c.mic.rails : null;
    const l = { partie: designation, cut: c.cut, zone: S.type.get(c.cut) || 'hors', genre: S.lot.get(c.cut) || 'vert', ref: !!ref, mic: ref ? max3d(ref) : null,
      etat: c.ariane ? c.ariane.etat : null, grappe: !!(S.enGrappe && S.enGrappe.has(c.cut)) };
    if (ref) { const s = SIDES.reduce((a, b) => norme(ref[a]) >= norme(ref[b]) ? a : b); l.micAxe = Math.abs(ref[s][1]) >= Math.abs(ref[s][2]) ? 'lateral' : 'vertical'; }
    if (l.etat === 'calcule') {
      const a = c.ariane;
      l.conf = Math.min(...SIDES.map(s => fini(a.rails[s].confiance) ? a.rails[s].confiance : -1));
      l.var = {};
      for (const k of VARIANTES) {
        const p = proposition(c, k, { graine, differe: l.genre === 'differe' });
        if (!p) { l.var[k] = { stage: (k.startsWith('chaine') ? a.chaine && a.chaine.stage : a.stage) || null, d: null, e: null }; continue; }
        /* Mesures de la règle, celles du lecteur de la passe de relecture (src/relecture-critere.js) : écart = le plus grand |latéral| ou
         * |vertical| des deux rails ; voie = le plus grand |latéral| ; cohérence = différence des deux rails en latéral et en vertical. */
        const P = p.rails;
        l.var[k] = { stage: p.stage, post: p.post, d: max3d(P), e: ref ? Math.max(...SIDES.map(s => norme(moins(P[s], ref[s])))) : null,
          pire: Math.max(...SIDES.flatMap(s => [Math.abs(P[s][1]), Math.abs(P[s][2])])), latMax: Math.max(...SIDES.map(s => Math.abs(P[s][1]))),
          coh: Math.max(Math.abs(P.left[1] - P.right[1]), Math.abs(P.left[2] - P.right[2])),
          dg: fini(p.ecartementPoseMm) && fini(gMed) ? Math.abs(p.ecartementPoseMm - gMed) : null };
      }
    }
    out.push(l);
  }
  return { lignes: out, selection: S, liste: L, gMed };
}
/* Seuils de jugement (mêmes conventions que G1 et la porte du cahier) : juste à 5 et 10 mm, mauvaise voie au-delà de 50 mm. */
const SEUILS = Object.freeze({ juste5: 5, juste10: 10, mauvaiseVoie: 50 });
function issue(l, v, agitIci) {
  const m = l.mic;
  if (!agitIci) return m > 10 ? 'laisse-faux' : m > 5 ? 'laisse-5-10' : 'laisse-juste';
  const e = v.e;
  if (e > SEUILS.mauvaiseVoie) return 'mauvaise-voie';
  if (m > 5) return e <= 5 ? 'reproduit5' : e <= 10 ? 'reproduit10' : e > m + 5 ? 'aggrave' : 'faux-reste';
  return e <= 5 ? 'confirme' : e <= 10 ? 'gris' : 'abime';
}
/* Une règle prudente R = { variante, X, Y, D, C, G, stages, differes, poses } : Ariane n'agit que si sa pose s'écarte de la pose actuelle d'au
 * moins X mm (plus grand |latéral| ou |vertical| des deux rails), sans déplacer un rail de plus de D mm en travers (jamais de changement de
 * voie), avec une confiance d'au moins Y sur les deux rails (absente : refus), des rails cohérents (différence des deux rails ≤ C mm en latéral
 * et en vertical), un écartement à G mm au plus de la médiane de la partie, une étape de décision permise, jamais sur un cut différé par le
 * lot, et sur un cut posé par le lot seulement si `poses`. Sinon elle laisse le cut tel quel. Mêmes conditions que src/relecture-critere.js. */
function agit(l, R) {
  const v = l.var && l.var[R.variante];
  if (!v || v.d == null) return false;
  /* Option P7 : un cut différé par le lot n'est touché que par la graine d'écartement, et alors sans les seuils des verts : le moteur relancé
   * et les gardes du module ont décidé, et un différé doit être posé quelle que soit sa distance à la pose actuelle (fictive). */
  if (l.genre === 'differe' && R.differes === 'graine') return v.post === 'graine';
  if (R.stages && !R.stages.includes(v.stage)) return false;
  if (R.differes === false && l.genre === 'differe') return false;
  if (R.poses === false && l.genre === 'pose') return false;
  if (!(v.pire >= R.X)) return false;
  if (R.D != null && !(v.latMax <= R.D)) return false;
  if (!(l.conf >= R.Y)) return false;
  if (R.C != null && !(v.coh <= R.C)) return false;
  if (R.G != null && !(v.dg != null && v.dg <= R.G)) return false;
  return true;
}
/* Bilan sur les cuts jugeables (référence de Mic et nuage) : R une règle, une fonction ligne → règle (variante par type), ou { tout, variante }. */
function bilan(ls, R) {
  const b = { visites: 0, micSup5: 0, micSup10: 0, agit: 0, reproduit5: 0, reproduit10: 0, corrigesJustes: 0, confirme: 0, gris: 0, abime: 0, aggrave: 0,
    fauxReste: 0, mauvaiseVoie: 0, laisseFaux: 0, abstention: 0, degats: 0, erreurs10: 0 };
  for (const l of ls) {
    if (!l.ref || l.etat !== 'calcule') continue;
    b.visites++; if (l.mic > 5) b.micSup5++; if (l.mic > 10) b.micSup10++;
    const Rl = typeof R === 'function' ? R(l) : R;
    const v = l.var[Rl ? Rl.variante : (R && R.variante) || 'seul+h'];
    if (!v || v.d == null) { b.abstention++; if (l.mic > 10) b.laisseFaux++; continue; }
    const a = !Rl ? false : Rl.tout ? true : agit(l, Rl), i = issue(l, v, a);
    if (a) { b.agit++; if (v.e > 10) b.erreurs10++; if (l.mic > 10 && v.e <= 10) b.corrigesJustes++; }
    if (i === 'reproduit5') { b.reproduit5++; b.reproduit10++; } else if (i === 'reproduit10') b.reproduit10++;
    else if (i === 'confirme') b.confirme++; else if (i === 'gris') b.gris++; else if (i === 'abime') b.abime++;
    else if (i === 'aggrave') b.aggrave++; else if (i === 'faux-reste') b.fauxReste++; else if (i === 'mauvaise-voie') b.mauvaiseVoie++;
    else if (i === 'laisse-faux') b.laisseFaux++;
    if (a && (i === 'abime' || i === 'aggrave' || i === 'mauvaise-voie')) b.degats++;
  }
  b.partDegats = b.visites ? b.degats / b.visites : 0;
  return b;
}
const additionner = bs => { const o = bilan([], {}); delete o.partDegats; for (const b of bs) for (const [k, v] of Object.entries(b)) if (k !== 'partDegats') o[k] += v; o.partDegats = o.visites ? o.degats / o.visites : 0; return o; };

/* ------------------------------------------------------------------ règle prudente */
/* Les cuts différés par le lot sont exclus d'office (`differes: [false]`) : agir sur eux, c'est valider un cut que le lot a jugé dangereux ;
 * en validation croisée, la partie 1 du second projet y prend 4 poses sur la mauvaise voie (voie décalée de 13 à 27 cm, bon rail hors vue). */
/* Bornes exprimables dans le fichier de réglages (src/relecture-critere.js) : D de 1 à 500 mm, C et G de 0 à 100 mm (100 : pas de limite). */
const GRILLE = Object.freeze({ variante: VARIANTES, X: [3, 4, 5, 6, 8, 10, 12, 15, 20], Y: [0, 30, 50, 60, 65, 70, 75, 80], D: [60, 45, 30], C: [100, 10, 6], G: [100, 15, 10, 6],
  stages: [null, ['first-pass'], ['first-pass', 'crossing']], differes: [false], poses: [true, false] });
const CONTRAINTE = Object.freeze({ mauvaiseVoieMax: 0, degatsPartMax: 0.01 });
/* Option P7 : la grille gagne un seul choix, « agir sur un différé du lot seulement s'il vient de la graine d'écartement ». Sans l'option,
 * la grille livrée, inchangée (même objet). */
const GRILLE_GRAINE = Object.freeze({ ...GRILLE, differes: [false, 'graine'] });
const grilleDe = ({ graine = false } = {}) => graine ? GRILLE_GRAINE : GRILLE;
function regles(g = GRILLE) {
  const out = [];
  for (const variante of g.variante) for (const X of g.X) for (const Y of g.Y) for (const G of g.G || [null]) for (const D of g.D) for (const C of g.C || [null]) for (const stages of g.stages) for (const differes of g.differes) for (const poses of g.poses || [true])
    out.push({ variante, X, Y, G, D, C, stages, differes, poses });
  return out;
}
const plusGrand = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] > b[i]) return true; if (a[i] < b[i]) return false; } return false; };
/* La règle qui fait le plus de corrections justes (Mic > 10 mm, Ariane à 10 mm près), nettes des dégâts (cuts abîmés, aggravés, mauvaise voie),
 * avec 0 mauvaise voie et des dégâts ≤ 1 % des cuts visités, sur l'ensemble ET sur chaque partie d'apprentissage ; à égalité : moins de dégâts,
 * puis la plus prudente. Le gain net plutôt que les justes seules : sinon la règle garde des actions qui abîment autant qu'elles corrigent. */
function choisir(ls, { grille = GRILLE, contrainte = CONTRAINTE, parPartie = null, degatsParPartie = true, objectif = 'net' } = {}) {
  let best = null;
  for (const R of regles(grille)) {
    const b = bilan(ls, R);
    if (b.mauvaiseVoie > contrainte.mauvaiseVoieMax || b.partDegats > contrainte.degatsPartMax + 1e-12) continue;
    if (parPartie && parPartie.some(lp => { const bp = bilan(lp, R); return bp.mauvaiseVoie > contrainte.mauvaiseVoieMax || (degatsParPartie && bp.partDegats > contrainte.degatsPartMax + 1e-12); })) continue;
    /* Objectif « net » (retenu) : une correction juste moins un dégât ; « justes » : les corrections justes seules (à la lettre). */
    const cle = [objectif === 'net' ? b.corrigesJustes - b.degats : b.corrigesJustes, -b.degats, R.poses === false ? 1 : 0, R.X, R.Y, -(R.D ?? 999), -(R.C ?? 999), -(R.G ?? 999)];
    if (!best || plusGrand(cle, best.cle)) best = { R, b, cle };
  }
  return best;
}
/* Variante par type de zone : une règle par type, choisie sur les seules lignes de ce type. Sans règle admissible ni gain : le type est laissé. */
function choisirParType(parties, opts = {}) {
  const out = {};
  for (const k of TYPES) {
    const lp = parties.map(ls => ls.filter(l => l.zone === k));
    const best = choisir(lp.flat(), { ...opts, parPartie: lp, degatsParPartie: false });
    out[k] = best && best.b.corrigesJustes > 0 ? best.R : null;
  }
  return out;
}
/* Fonction ligne → règle ; `variante` : celle qui compte les abstentions des types laissés. */
const regleParType = rt => Object.assign(l => rt[l.zone] || null, { variante: (Object.values(rt).find(Boolean) || {}).variante || 'chaine+h' });
/* Variante SOBRE d'une règle : le plus grand écart minimal X (même règle par ailleurs) qui garde au moins 90 % de ses corrections justes sur
 * les mêmes lignes d'apprentissage, sous la même contrainte. Moins d'écritures dans ESV pour presque le même gain. */
const PART_SOBRE = 0.9;
function sobre(R, ls, { grille = GRILLE, contrainte = CONTRAINTE, parPartie = null } = {}) {
  /* Option P7 (`differes: 'graine'`) : un différé posé par la graine agit sans le seuil X ; ses corrections ne comptent donc pas dans la
   * part gardée (sinon elles laisseraient monter le seuil des verts sans rien gagner). Sans l'option : toutes les lignes, inchangé. */
  const sousX = R.differes === 'graine' ? ls.filter(l => l.genre !== 'differe') : ls;
  const ref = bilan(sousX, R).corrigesJustes;
  let out = R;
  for (const X of grille.X.filter(x => x > R.X)) {
    const Rx = { ...R, X }, b = bilan(ls, Rx), justes = sousX === ls ? b.corrigesJustes : bilan(sousX, Rx).corrigesJustes;
    if (justes < PART_SOBRE * ref || b.mauvaiseVoie > contrainte.mauvaiseVoieMax || b.partDegats > contrainte.degatsPartMax + 1e-12) continue;
    if (parPartie && parPartie.some(lp => bilan(lp, Rx).mauvaiseVoie > contrainte.mauvaiseVoieMax)) continue;
    out = Rx;
  }
  return out;
}
/* Borne de Wilson à 95 % d'une proportion k/n. */
function wilson(k, n, z = 1.959964) {
  if (!n) return { bas: null, haut: null };
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { bas: Math.max(0, (c - r) / d), haut: Math.min(1, (c + r) / d) };
}

/* ------------------------------------------------------------------ étude et jugement */
const TEMPS = Object.freeze({ micParVertS: 3.6, arianeCycleS: [1.8, 2.4] });
const dansSelection = r => r.lignes.filter(l => l.zone !== 'hors');
const tranche = m => m >= 25 ? '≥ 25 mm' : m >= 15 ? '15–25 mm' : '10–15 mm';
function couverture(r) {
  const ls = r.lignes.filter(l => l.ref), c10 = ls.filter(l => l.mic > 10), c5 = ls.filter(l => l.mic > 5), hors = c10.filter(l => l.zone === 'hors');
  const types = {}; for (const l of hors) { const k = `${l.genre} · ${l.micAxe} · ${tranche(l.mic)}`; types[k] = (types[k] || 0) + 1; }
  return { partie: r.designation, visitesAvecReference: ls.length, micSup10: c10.length, micSup10DansSelection: c10.length - hors.length,
    micSup5: c5.length, micSup5DansSelection: c5.filter(l => l.zone !== 'hors').length,
    parType: Object.fromEntries(TYPES.map(k => [k, c10.filter(l => l.zone === k).length])), hors: hors.map(l => ({ cut: l.cut, genre: l.genre, axe: l.micAxe, mm: r1(l.mic) })), typesHors: types,
    visitesHorsSelection: ls.filter(l => l.zone === 'hors').length };
}
function cout(r) {
  const S = r.selection, verts = TYPES.reduce((a, k) => a + S.verts[k], 0), visites = verts + S.revisites;
  return { partie: r.designation, selection: S.compte, verts: S.verts, vertsTotal: verts, revisitesPoses: S.revisites, listeAControler: r.liste.cuts.length,
    minutesMic: r1(verts * TEMPS.micParVertS / 60), minutesAriane: TEMPS.arianeCycleS.map(s => r1(verts * s / 60)), minutesArianeAvecRevisites: TEMPS.arianeCycleS.map(s => r1(visites * s / 60)),
    minutesArianeParType: Object.fromEntries(TYPES.map(k => [k, TEMPS.arianeCycleS.map(s => r1(S.verts[k] * s / 60))])) };
}
/* `parties` : [{ designation, cas, table, skip? }] (parties d'apprentissage). */
function etudier(parties, { grille = GRILLE, graine = false } = {}) {
  if (graine && !(grille.differes || []).includes('graine')) grille = grille === GRILLE ? GRILLE_GRAINE : { ...grille, differes: [...(grille.differes || [false]), 'graine'] };
  const res = parties.map(p => ({ ...p, ...lignes({ ...p, graine }) }));
  const sel = res.map(dansSelection);
  const tout = { tout: true, variante: 'chaine+h' };
  const central = res.map((r, i) => ({ partie: r.designation, seul: bilan(sel[i], { tout: true, variante: 'seul+h' }), chaine: bilan(sel[i], tout),
    chaineParType: Object.fromEntries(TYPES.map(k => [k, bilan(sel[i].filter(l => l.zone === k), tout)])), chaineGrappe: bilan(sel[i].filter(l => l.grappe), tout),
    chaineDiffere: bilan(sel[i].filter(l => l.genre === 'differe'), tout),
    nonMesurables: sel[i].filter(l => l.ref && l.etat !== 'calcule').length, sansReference: sel[i].filter(l => !l.ref).length }));
  const croisee = res.map((r, i) => {
    const train = sel.filter((_, j) => j !== i), best = choisir(train.flat(), { grille, parPartie: train });
    const parType = Object.fromEntries([...TYPES, 'hors'].map(k => [k, best ? bilan(sel[i].filter(l => l.zone === k), best.R) : null]));
    const genre = Object.fromEntries(['vert', 'pose', 'differe'].map(k => [k, best ? bilan(sel[i].filter(l => l.genre === k), best.R) : null]));
    const parTypeVert = Object.fromEntries(TYPES.map(k => [k, best ? bilan(sel[i].filter(l => l.zone === k && l.genre === 'vert'), best.R) : null]));
    const Rs = best ? sobre(best.R, train.flat(), { grille, parPartie: train }) : null;
    const parTypeVertSobre = Object.fromEntries(TYPES.map(k => [k, Rs ? bilan(sel[i].filter(l => l.zone === k && l.genre === 'vert'), Rs) : null]));
    /* Règle de service, tous genres (P7 : les différés posés par la graine entrent dans les zones ADV et abords, et dans les grappes). */
    const parTypeSobre = Object.fromEntries([...TYPES, 'hors'].map(k => [k, Rs ? bilan(sel[i].filter(l => l.zone === k), Rs) : null]));
    const genreSobre = Object.fromEntries(['vert', 'pose', 'differe'].map(k => [k, Rs ? bilan(sel[i].filter(l => l.genre === k), Rs) : null]));
    return { partie: r.designation, regle: best ? best.R : null, bilan: best ? bilan(sel[i], best.R) : null, parType, parTypeVert, genre, regleSobre: Rs, bilanSobre: Rs ? bilan(sel[i], Rs) : null, parTypeVertSobre,
      parTypeSobre, genreSobre, grappeSobre: Rs ? bilan(sel[i].filter(l => l.grappe), Rs) : null };
  });
  const fige = choisir(sel.flat(), { grille, parPartie: sel });
  const croiseeLettre = res.map((r, i) => { const train = sel.filter((_, j) => j !== i), best = choisir(train.flat(), { grille, parPartie: train, objectif: 'justes' });
    return { partie: r.designation, regle: best ? best.R : null, bilan: best ? bilan(sel[i], best.R) : null }; });
  const croiseeType = res.map((r, i) => { const rt = choisirParType(sel.filter((_, j) => j !== i), { grille }); return { partie: r.designation, regles: rt, bilan: bilan(sel[i], regleParType(rt)) }; });
  const figeType = choisirParType(sel, { grille });
  const courbe = fige ? [3, 4, 5, 6, 8, 10, 12, 15, 20, 30].map(X => ({ X, ...bilan(sel.flat(), { ...fige.R, X }) })) : [];
  const somme = f => additionner(croisee.map(f).filter(Boolean));
  return {
    format: FORMAT_ETUDE, graine: !!graine, parties: res.map(r => r.designation), selection: SELECTION, seuils: SEUILS, contrainte: CONTRAINTE, temps: TEMPS,
    couverture: res.map(couverture), central, croisee, totalCroisee: additionner(croisee.filter(c => c.bilan).map(c => c.bilan)),
    parTypeCroisee: Object.fromEntries([...TYPES].map(k => [k, additionner(croisee.filter(c => c.parType[k]).map(c => c.parType[k]))])),
    parTypeVertCroisee: Object.fromEntries([...TYPES].map(k => [k, additionner(croisee.filter(c => c.parTypeVert[k]).map(c => c.parTypeVert[k]))])),
    parTypeVertCroiseeSobre: Object.fromEntries([...TYPES].map(k => [k, additionner(croisee.filter(c => c.parTypeVertSobre[k]).map(c => c.parTypeVertSobre[k]))])),
    parGenreCroisee: Object.fromEntries(['vert', 'pose'].map(k => [k, additionner(croisee.filter(c => c.genre[k]).map(c => c.genre[k]))])),
    parTypeCroiseeSobre: Object.fromEntries([...TYPES, 'hors'].map(k => [k, somme(c => c.parTypeSobre[k])])),
    parGenreCroiseeSobre: Object.fromEntries(['vert', 'pose', 'differe'].map(k => [k, somme(c => c.genreSobre[k])])),
    grappeCroiseeSobre: somme(c => c.grappeSobre),
    fige: fige ? { regle: fige.R, bilan: fige.b, parPartie: res.map((r, i) => ({ partie: r.designation, ...bilan(sel[i], fige.R) })) } : null,
    croiseeLettre, totalCroiseeLettre: additionner(croiseeLettre.filter(c => c.bilan).map(c => c.bilan)),
    totalCroiseeSobre: additionner(croisee.filter(c => c.bilanSobre).map(c => c.bilanSobre)),
    figeSobre: fige ? (R => ({ regle: R, bilan: bilan(sel.flat(), R), parPartie: res.map((r, i) => ({ partie: r.designation, ...bilan(sel[i], R) })) }))(sobre(fige.R, sel.flat(), { grille, parPartie: sel })) : null,
    croiseeType, totalCroiseeType: additionner(croiseeType.map(c => c.bilan)), figeType,
    courbe, cout: res.map(cout),
    skip: res.filter(r => r.skip).map(r => ({ partie: r.designation, ...bilanSkip(r.skip) })),
  };
}
/* Jugement d'un réglage figé (aucun réglage ici) : chiffres bruts et borne de Wilson du taux d'erreur parmi les actions. */
const PORTE = Object.freeze({ mauvaiseVoieMax: 0, erreurMax: 0.09 });
function juger(parties, reglage, { graine = false } = {}) {
  const out = parties.map(p => {
    const r = { ...p, ...lignes({ ...p, graine }) }, ls = dansSelection(r), b = bilan(ls, reglage.regle);
    const bt = reglage.parType ? bilan(ls, regleParType(reglage.parType)) : null;
    const w = wilson(b.erreurs10, b.agit), wd = wilson(b.degats, b.visites);
    return { partie: r.designation, couverture: couverture(r), cout: cout(r), toutAgir: bilan(ls, { tout: true, variante: reglage.regle.variante }), bilan: b,
      erreur: b.agit ? b.erreurs10 / b.agit : null, wilsonErreur: w, wilsonDegats: wd, parType: Object.fromEntries(TYPES.map(k => [k, bilan(ls.filter(l => l.zone === k), reglage.regle)])),
      bilanActifs: reglage.actifs ? bilan(ls, Object.assign(l => reglage.actifs.includes(l.zone) ? reglage.regle : null, { variante: reglage.regle.variante })) : null,
      bilanParType: bt, bilanProcedure: reglage.procedure ? bilan(ls, reglage.procedure) : null, skip: r.skip ? bilanSkip(r.skip) : null,
      porte: { mauvaiseVoie: b.mauvaiseVoie <= PORTE.mauvaiseVoieMax, erreur: b.agit ? b.erreurs10 / b.agit <= PORTE.erreurMax : null, borneHaute: w.haut != null ? w.haut <= PORTE.erreurMax : null } };
  });
  const tot = additionner(out.map(o => o.bilan)), w = wilson(tot.erreurs10, tot.agit);
  const totP = reglage.procedure ? additionner(out.map(o => o.bilanProcedure)) : null, totA = reglage.actifs ? additionner(out.map(o => o.bilanActifs)) : null;
  return { format: FORMAT_JUGEMENT, regle: reglage.regle, procedure: reglage.procedure || null, porte: PORTE, parties: out, total: tot, wilsonErreur: w, wilsonDegats: wilson(tot.degats, tot.visites),
    totalProcedure: totP, wilsonErreurProcedure: totP ? wilson(totP.erreurs10, totP.agit) : null,
    actifs: reglage.actifs || null, totalActifs: totA, wilsonErreurActifs: totA ? wilson(totA.erreurs10, totA.agit) : null };
}

/* ------------------------------------------------------------------ réglages proposés */
/* Un type de zone AGIT dans la prochaine version si, en validation croisée de la règle de service (variante sobre), sur ses verts : 0 mauvaise voie, dégâts ≤ 1 % des visités, erreur
 * (pose finale à plus de 10 mm de Mic) ≤ 9 % des actions (porte du cahier), au moins 10 corrections justes, et au moins une correction juste
 * pour 2 minutes de visites d'Ariane (cycle haut, 2,4 s). Sinon il reste en OMBRE (visite, calcul, note ; rien n'est modifié). */
const CRITERES_TYPE = Object.freeze({ mauvaiseVoieMax: 0, degatsPartMax: 0.01, erreurMax: 0.09, justesMin: 10, justesParMinuteMin: 0.5 });
function decisionType(etude, k) {
  const b = (etude.parTypeVertCroiseeSobre || etude.parTypeVertCroisee)[k], minutes = etude.cout.reduce((a, c) => a + (c.minutesArianeParType[k] ? c.minutesArianeParType[k][1] : 0), 0);
  const raisons = [];
  if (b.mauvaiseVoie > CRITERES_TYPE.mauvaiseVoieMax) raisons.push('mauvaise voie');
  if (b.visites && b.degats / b.visites > CRITERES_TYPE.degatsPartMax) raisons.push('dégâts > 1 %');
  if (!b.agit || b.erreurs10 / b.agit > CRITERES_TYPE.erreurMax) raisons.push('erreur > 9 %');
  if (b.corrigesJustes < CRITERES_TYPE.justesMin) raisons.push('moins de 10 corrections justes');
  if (!(minutes > 0) || b.corrigesJustes / minutes < CRITERES_TYPE.justesParMinuteMin) raisons.push('moins d\'une correction juste pour 2 minutes de visites');
  return { action: raisons.length ? 'ombre' : 'agir', raisons, minutesArianeApprentissage: r1(minutes),
    croisee: (({ visites, micSup10, agit, corrigesJustes, reproduit5, reproduit10, degats, mauvaiseVoie, erreurs10 }) => ({ visites, micSup10, agit, corrigesJustes, reproduit5, reproduit10, degats, mauvaiseVoie, erreurs10 }))(b) };
}
/* Le fichier de réglages est au format que lit la passe de relecture (`ariane-relecture-reglages-1`, src/relecture-critere.js du chantier
 * de la relecture en ombre) : étapes permises, rôles, voie, cohérence, et par zone (pn, adv, abords, vert-hors-zone) corriger / seuil /
 * confiance. Le reste (origine, chiffres, variantes) est en plus : ce lecteur l'ignore. */
const EXCEPTION_GRAINE = 'graine-ecartement-fictive : un différé du lot est posé seulement par la graine d\'écartement sur pose fictive (src/graine-ecartement-fictive.js)';
const ZONE_LECTEUR = Object.freeze({ pn: 'pn', adv: 'adv', abords: 'abords', liste: 'vert-hors-zone' });
const ETAPES_TOUTES = Object.freeze(['first-pass', 'window', 'choice', 'crossing']);
const resume = b => (({ visites, micSup10, agit, corrigesJustes, reproduit5, reproduit10, degats, mauvaiseVoie, erreurs10 }) => ({ visites, micSup10, agit, corrigesJustes, reproduit5, reproduit10, degats, mauvaiseVoie, erreurs10 }))(b);
function reglagesProposes(etude, { date }) {
  if (!etude.fige) throw Error('aucune règle admissible : pas de réglage à proposer');
  /* Règle de SERVICE : la variante sobre. Le seuil de la procédure (le plus bas de la grille) fait bouger des verts de 3 à 8 mm, dans la
   * zone grise du bruit de la référence (3,6 à 6,4 mm, D-158) : ces petits déplacements ne se jugent pas, et chacun est une écriture dans
   * ESV. La variante sobre garde presque toutes les corrections justes avec quatre fois moins d'écritures. */
  const R = etude.figeSobre ? etude.figeSobre.regle : etude.fige.regle, decisions = Object.fromEntries(TYPES.map(k => [k, decisionType(etude, k)]));
  return {
    format: FORMAT_REGLAGES, statut: 'propose', date,
    note: 'Seuils de la règle de correction prudente de la relecture autonome, mesurés sur les six parties d\'apprentissage (fiches/RELECTURE_AUTONOME.md). Proposés : rien n\'agit sans décision de Mic. Une zone à corriger:false reste en ombre (visite, calcul, note).',
    etagesPermis: R.stages || ETAPES_TOUTES.slice(),
    roles: ['vert'],
    voie: { lateralMaxMm: R.D },
    coherence: { diffLateraleMaxMm: R.C ?? 100, diffVerticaleMaxMm: R.C ?? 100, ecartementMaxMm: R.G ?? 100 },
    zones: Object.fromEntries(TYPES.map(k => [ZONE_LECTEUR[k], { corriger: decisions[k].action === 'agir', seuilMm: R.X, confianceMin: R.Y }])),
    variante: { proposition: R.variante, sens: 'chaine : la décision du lot avec pour appuis les poses qu\'Ariane vient de donner aux cuts précédents de la relecture ; seul : le cut seul ; +h : hauteur apprise ajoutée à la pose' },
    jamais: ['cut différé par le lot', 'cut posé par le lot'],
    /* Option P7 : exception lue par `regleDuReglage` ; un lecteur qui l'ignore garde la règle prudente (jamais un différé). */
    ...(R.differes === 'graine' ? { exceptionDifferes: EXCEPTION_GRAINE } : {}),
    origine: { outil: 'tools/relecture-autonome.cjs etudier', fiche: 'fiches/RELECTURE_AUTONOME.md', parties: etude.parties,
      procedure: 'validation croisée par partie (une partie laissée de côté, réglage sur les autres, mesure sur elle), puis règle figée sur les six parties d\'apprentissage ; aucune partie réservée lue pour régler',
      objectif: 'le plus de corrections justes (correction de Mic > 10 mm, pose d\'Ariane à 10 mm près de celle de Mic), nettes des cuts abîmés',
      contrainte: { mauvaiseVoie: 0, degatsPartMax: CONTRAINTE.degatsPartMax, mauvaiseVoieMm: SEUILS.mauvaiseVoie }, mesure: 'écart = le plus grand |latéral| ou |vertical| des deux rails, comme src/relecture-critere.js' },
    selection: { ...SELECTION, pn: { margeAvant: M.DEFAULTS.pn.margeAvant, margeApres: M.DEFAULTS.pn.margeApres }, adv: { margeAvant: M.DEFAULTS.adv.margeAvant, margeApres: M.DEFAULTS.adv.margeApres }, liste: 'src/verts-a-controler.js, réglages livrés' },
    criteresZone: { ...CRITERES_TYPE, sens: 'une zone corrige si, en validation croisée sur ses verts : 0 mauvaise voie, dégâts ≤ 1 % des visités, erreur ≤ 9 % des actions, au moins 10 corrections justes, au moins une correction juste pour 2 minutes de visites' },
    decisionsZone: Object.fromEntries(TYPES.map(k => [ZONE_LECTEUR[k], decisions[k]])),
    seuilService: { seuilMm: R.X, note: `seuil de la procédure relevé tant que la règle garde au moins ${Math.round(100 * PART_SOBRE)} % de ses corrections justes en apprentissage : moins d'écritures dans ESV, petits déplacements dans le bruit de la référence évités`, croisee: resume(etude.totalCroiseeSobre) },
    regleProcedure: { seuilMm: etude.fige.regle.X, regle: etude.fige.regle, note: 'règle de plus grand gain net de la grille, pour mémoire', croisee: resume(etude.totalCroisee) },
    varianteParZone: { note: 'une règle par zone, choisie sur cette seule zone : moins bonne que la règle commune en validation croisée ; pour mémoire', regles: etude.figeType },
    croisee: { total: resume(etude.totalCroiseeSobre), parPartie: etude.croisee.map(c => ({ partie: c.partie, regle: c.regleSobre, ...(c.bilanSobre ? resume(c.bilanSobre) : {}) })) },
    temps: TEMPS,
  };
}
/* Règle prête pour `juger`, relue depuis le fichier de réglages. */
function regleDuReglage(g) {
  const z = g.zones || {}, une = z.pn || Object.values(z)[0] || {}, et = Array.isArray(g.etagesPermis) && !ETAPES_TOUTES.every(e => g.etagesPermis.includes(e)) ? g.etagesPermis : null;
  const base = { variante: g.variante && g.variante.proposition || 'chaine+h', X: une.seuilMm, Y: une.confianceMin ?? 0, D: g.voie && g.voie.lateralMaxMm,
    C: g.coherence ? g.coherence.diffLateraleMaxMm : null, G: g.coherence ? g.coherence.ecartementMaxMm : null, stages: et,
    differes: typeof g.exceptionDifferes === 'string' && g.exceptionDifferes.startsWith('graine-ecartement-fictive') ? 'graine' : false, poses: !(g.jamais || []).includes('cut posé par le lot') };
  return { regle: base, parType: g.varianteParZone && g.varianteParZone.regles || null,
    actifs: TYPES.filter(k => z[ZONE_LECTEUR[k]] && z[ZONE_LECTEUR[k]].corriger === true),
    procedure: g.regleProcedure ? { ...base, X: g.regleProcedure.seuilMm } : null };
}

/* ------------------------------------------------------------------ texte */
const pc = (a, b) => b ? `${Math.round(1000 * a / b) / 10} %` : '—';
const decrire = R => !R ? 'aucune' : `${R.variante}, écart ≥ ${R.X} mm${R.D != null ? `, rail déplacé de ${R.D} mm au plus en travers` : ''}${R.Y > 0 ? `, confiance ≥ ${R.Y}` : ', confiance présente'}${R.C != null && R.C < 100 ? `, rails cohérents à ${R.C} mm` : ''}${R.G != null && R.G < 100 ? `, écartement à ${R.G} mm de la médiane` : ''}${R.stages ? `, étapes ${R.stages.join('/')}` : ''}${R.differes === false ? ', jamais sur un différé' : R.differes === 'graine' ? ', différés : graine d\'écartement seulement' : ''}${R.poses === false ? ', jamais sur un cut posé par le lot' : ''}`;
const ligneBilan = b => `${b.visites} | ${b.micSup10} | ${b.agit} | ${b.reproduit5} | ${b.reproduit10} | ${b.corrigesJustes} | ${b.abime + b.aggrave} | ${b.mauvaiseVoie} | ${b.abstention} | ${b.laisseFaux}`;
const ENTETE_BILAN = 'visités mesurables | Mic > 10 mm | agit | reproduit ≤ 5 | reproduit ≤ 10 | corrections justes | abîmés | mauvaise voie | abstentions | laissés faux';
function texte(o) {
  const L = [];
  if (o.format === FORMAT_ETUDE) {
    L.push('## Couverture', '', 'Partie | visités avec réf. | Mic > 10 mm | dans la sélection | PN | ADV | abords | liste | hors sélection (genre · axe · taille)', '---|--:|--:|--:|--:|--:|--:|--:|---');
    for (const c of o.couverture) L.push(`${c.partie} | ${c.visitesAvecReference} | ${c.micSup10} | ${c.micSup10DansSelection} (${pc(c.micSup10DansSelection, c.micSup10)}) | ${c.parType.pn} | ${c.parType.adv} | ${c.parType.abords} | ${c.parType.liste} | ${Object.entries(c.typesHors).map(([k, n]) => `${n} ${k}`).join(' ; ') || '—'}`);
    L.push('', '## Chiffre central (agir partout où Ariane pose, sans règle)', '', `Partie | variante | ${ENTETE_BILAN} | non mesurables`, '---|---' + '|--:'.repeat(11));
    for (const c of o.central) { L.push(`${c.partie} | seul+h | ${ligneBilan(c.seul)} | ${c.nonMesurables}`); L.push(`${c.partie} | chaîne+h | ${ligneBilan(c.chaine)} | ${c.nonMesurables}`); }
    L.push('', '## Validation croisée (règle apprise sans la partie)', '', `Partie | règle | ${ENTETE_BILAN}`, '---|---' + '|--:'.repeat(10));
    for (const c of o.croisee) L.push(`${c.partie} | ${decrire(c.regle)} | ${c.bilan ? ligneBilan(c.bilan) : '—'}`);
    L.push(`total | | ${ligneBilan(o.totalCroisee)}`);
    L.push('', `Par type de zone (validation croisée, règle commune) :`); for (const k of TYPES) L.push(`- ${k} : ${ligneBilan(o.parTypeCroisee[k])}`);
    L.push('', `Règle figée : ${decrire(o.fige && o.fige.regle)}`, o.fige ? `- en échantillon : ${ligneBilan(o.fige.bilan)}` : '');
    L.push('', `Objectif à la lettre (corrections justes seules), validation croisée : ${ligneBilan(o.totalCroiseeLettre)}`);
    if (o.figeSobre) { L.push('', `Règle de service (variante sobre) : ${decrire(o.figeSobre.regle)}`, `- validation croisée : ${ligneBilan(o.totalCroiseeSobre)}`); for (const c of o.croisee) if (c.bilanSobre) L.push(`  - ${c.partie} (X ${c.regleSobre.X}) : ${ligneBilan(c.bilanSobre)}`); }
    const lb = b => b ? `${b.visites} | ${b.micSup10} | ${b.agit} | ${b.corrigesJustes} | ${b.erreurs10} | ${b.abime + b.aggrave} | ${b.mauvaiseVoie} | ${b.abstention}` : '—';
    const EN = 'visités | Mic > 10 mm | agit | justes | erreurs > 10 mm | abîmés | mauvaise voie | abstentions';
    L.push('', `## Par partie et type de zone (règle de service, validation croisée, tous genres${o.graine ? ' ; option graine d\'écartement sur pose fictive' : ''})`, '', `Partie | zone | ${EN}`, '---|---' + '|--:'.repeat(8));
    for (const c of o.croisee) { if (!c.parTypeSobre) continue; for (const k of TYPES) L.push(`${c.partie} | ${k} | ${lb(c.parTypeSobre[k])}`); L.push(`${c.partie} | en grappe | ${lb(c.grappeSobre)}`); L.push(`${c.partie} | différés du lot | ${lb(c.genreSobre.differe)}`); }
    if (o.parTypeCroiseeSobre) { for (const k of TYPES) L.push(`total | ${k} | ${lb(o.parTypeCroiseeSobre[k])}`); L.push(`total | en grappe | ${lb(o.grappeCroiseeSobre)}`); L.push(`total | différés du lot | ${lb(o.parGenreCroiseeSobre.differe)}`); }
    L.push('', '## Chiffre central par type de zone (chaîne+h, agir partout)', '', `Partie | zone | ${EN}`, '---|---' + '|--:'.repeat(8));
    for (const c of o.central) { if (!c.chaineParType) continue; for (const k of TYPES) L.push(`${c.partie} | ${k} | ${lb(c.chaineParType[k])}`); L.push(`${c.partie} | en grappe | ${lb(c.chaineGrappe)}`); L.push(`${c.partie} | différés du lot | ${lb(c.chaineDiffere)}`); }
    L.push('', '## Variante par type (validation croisée)'); for (const c of o.croiseeType) L.push(`- ${c.partie} : ${ligneBilan(c.bilan)}`); L.push(`- total : ${ligneBilan(o.totalCroiseeType)}`);
    L.push('', '## Courbe (règle figée, X variable, en échantillon)', '', 'X | agit | corrections justes | reproduit ≤ 10 | dégâts | mauvaise voie | erreurs > 10 mm', '--:|--:|--:|--:|--:|--:|--:');
    for (const c of o.courbe) L.push(`${c.X} | ${c.agit} | ${c.corrigesJustes} | ${c.reproduit10} | ${c.degats} | ${c.mauvaiseVoie} | ${c.erreurs10}`);
    L.push('', '## Coût', '', 'Partie | verts en plus | revisites de poses | min Mic (3,6 s) | min Ariane (1,8–2,4 s)', '---|--:|--:|--:|---');
    for (const c of o.cout) L.push(`${c.partie} | ${c.vertsTotal} | ${c.revisitesPoses} | ${c.minutesMic} | ${c.minutesAriane.join('–')}`);
    if (o.skip.length) { L.push('', '## SKIP'); for (const s of o.skip) L.push(`- ${s.partie} : ${s.skipMic} SKIP de Mic (${s.skipMicDebut} aux cuts 0–3), retrouvés ${s.retrouves}, fausses alertes ${s.fausseAlerte}, scanners lisibles : ${s.scannersLisibles ? 'oui' : 'non'}`); }
  } else if (o.format === FORMAT_JUGEMENT) {
    L.push(`Règle de service figée : ${decrire(o.regle)}`, '', `Partie | ${ENTETE_BILAN} | erreur parmi les actions (Wilson 95 %)`, '---' + '|--:'.repeat(11));
    for (const p of o.parties) L.push(`${p.partie} | ${ligneBilan(p.bilan)} | ${p.erreur == null ? '—' : pc(p.bilan.erreurs10, p.bilan.agit)} (${p.wilsonErreur.haut == null ? '—' : `≤ ${Math.round(1000 * p.wilsonErreur.haut) / 10} %`})`);
    L.push(`total | ${ligneBilan(o.total)} | ${pc(o.total.erreurs10, o.total.agit)} (${o.wilsonErreur.haut == null ? '—' : `≤ ${Math.round(1000 * o.wilsonErreur.haut) / 10} %`})`);
    if (o.actifs) { L.push('', `Types qui agissent (${o.actifs.join(', ') || 'aucun'}) :`); for (const p of o.parties) L.push(`- ${p.partie} : ${ligneBilan(p.bilanActifs)}`);
      L.push(`- total : ${ligneBilan(o.totalActifs)} ; erreur ${pc(o.totalActifs.erreurs10, o.totalActifs.agit)} (≤ ${o.wilsonErreurActifs.haut == null ? '—' : Math.round(1000 * o.wilsonErreurActifs.haut) / 10 + ' %'})`); }
    if (o.procedure) { L.push('', `Règle de la procédure, pour mémoire : ${decrire(o.procedure)}`); for (const p of o.parties) L.push(`- ${p.partie} : ${ligneBilan(p.bilanProcedure)}`);
      L.push(`- total : ${ligneBilan(o.totalProcedure)} ; erreur ${pc(o.totalProcedure.erreurs10, o.totalProcedure.agit)} (≤ ${o.wilsonErreurProcedure.haut == null ? '—' : Math.round(1000 * o.wilsonErreurProcedure.haut) / 10 + ' %'})`); }
  }
  return L.join('\n');
}

/* ------------------------------------------------------------------ essai synthétique */
/* Une partie inventée : un PN (cuts 50–56), un lot de rouges, des verts. Les cas portent directement la correction de Mic et la proposition
 * d'Ariane ; rien n'est lu sur le disque. */
function casSynthetique({ cut, mic, pose, conf = 80, stage = 'first-pass', surface = null }) {
  const rails = {}; for (const s of SIDES) rails[s] = { statut: 'candidate', confiance: conf, pose: pose ? pose[s] : null, hauteurMm: 0 };
  return { format: FORMAT, projet: 9, partie: 1, cut, mic: mic ? { ref: 'validation', rails: mic } : { ref: null },
    ariane: { etat: 'calcule', stage: pose ? stage : 'deferred', ecartementDepartMm: 1437, ecartementPoseMm: 1437, rails, chaine: { stage: pose ? stage : 'deferred', ecartementPoseMm: 1437, rails }, surface } };
}
function essai() {
  const v = (lat, z) => ({ left: [0, lat, z], right: [0, lat, z] }), cas = [], cuts = [];
  for (let c = 40; c <= 70; c++) {
    const pn = c >= 50 && c <= 56, mic = pn ? v(0, -35) : v(0, 0), pose = c === 60 ? v(0, 12) : pn ? v(0, -34) : v(0, 1);
    cas.push(casSynthetique({ cut: c, mic, pose, surface: { flushPct: pn ? 80 : 0, quadMin: pn ? 70 : 0, sidePoints: 900, coeurPN: pn, advRails: 0 } }));
    cuts.push({ i: c, classe: c === 45 || c === 46 ? 'posee' : 'hors-journal', mm: r1(max3d(mic)), dureeS: 2, visites: 1, bords: { left: [c, 0.7175, 0], right: [c, -0.7175, 0] } });
  }
  const table = { format: 'ariane-verts-table-v1', projet: 9, partie: 1, lot: [{ cut: 45, differe: false }, { cut: 46, differe: false }], zonesPN: zonesDepuisCas(cas).zonesPN, zonesADV: [], cuts };
  return { cas, table };
}

/* ------------------------------------------------------------------ greffe (option P7) */
/* Cas d'une extraction ANTÉRIEURE (`anciens`, source d'Écho devenue incomplète sur le disque) et cas d'une extraction nouvelle avec l'option
 * (`nouveaux`) : la graine (`chaineGraine`) n'est reportée sur un cas ancien que si la chaîne nouvelle y rend la même décision (étape et
 * poses à 0,5 mm près). Rien d'autre ne change dans les cas anciens. `differe` : cuts différés par le lot (pour compter les cuts visés). */
function memeChaine(a, b) {
  if (!a || !b || a.stage !== b.stage) return false;
  return SIDES.every(s => { const p = a.rails && a.rails[s] && a.rails[s].pose, q = b.rails && b.rails[s] && b.rails[s].pose; return (!p && !q) || (!!p && !!q && [0, 1, 2].every(i => Math.abs(p[i] - q[i]) < 0.5)); });
}
function greffer(anciens, nouveaux, { differe = new Set() } = {}) {
  const par = new Map(nouveaux.map(c => [c.cut, c])), bilan = { cuts: anciens.length, visees: 0, greffes: 0, chaineDifferente: 0, absents: 0, chainesComparees: 0, chainesIdentiques: 0 };
  const cas = anciens.map(o => {
    const a = o.ariane, vise = differe.has(o.cut) && a && a.etat === 'calcule' && a.chaine && !pose2(a.chaine) && GE.DEFAUTS.ecartementFictifMm - GE.DEFAUTS.toleranceFictiveMm < (a.ecartementDepartMm ?? 0) && (a.ecartementDepartMm ?? 0) < GE.DEFAUTS.ecartementFictifMm + GE.DEFAUTS.toleranceFictiveMm;
    if (vise) bilan.visees++;
    const n = par.get(o.cut), nv = n && n.ariane && n.ariane.etat === 'calcule' ? n.ariane : null;
    /* Contrôle de reproduction : sur tous les cuts calculés des deux côtés, la chaîne nouvelle rend-elle l'ancienne ? */
    if (nv && a && a.etat === 'calcule' && a.chaine && nv.chaine) { bilan.chainesComparees++; if (memeChaine(a.chaine, nv.chaine)) bilan.chainesIdentiques++; }
    if (!nv || !nv.chaineGraine) { if (vise) bilan.absents++; return o; }
    if (!a || a.etat !== 'calcule' || !memeChaine(a.chaine, nv.chaine)) { if (vise) bilan.chaineDifferente++; return o; }
    if (vise) bilan.greffes++;
    return { ...o, ariane: { ...a, chaineGraine: nv.chaineGraine } };
  });
  return { cas, bilan };
}

module.exports = { FORMAT, FORMAT_ETUDE, FORMAT_JUGEMENT, FORMAT_REGLAGES, decalage, referenceHumaine, vuEcrit, poseAriane, extraire, chunksDesVisites, chunkComplet,
  releverSkip, verdictSkip, bilanSkip, fusionner, zonesDepuisCas, construireTable, SELECTION, TYPES, selection, listeAControler, VARIANTES, proposition, lignes,
  SEUILS, issue, agit, bilan, additionner, GRILLE, CONTRAINTE, regles, choisir, choisirParType, regleParType, PART_SOBRE, sobre, wilson, TEMPS, couverture, cout, etudier, PORTE, juger,
  CRITERES_TYPE, decisionType, reglagesProposes, regleDuReglage, texte, essai, max3d, grilleDe, GRILLE_GRAINE, EXCEPTION_GRAINE, greffer, memeChaine };

/* ------------------------------------------------------------------ ligne de commande */
const lireJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
function args(argv) {
  const o = { mode: argv[0], echo: [], journal: [], parties: [] };
  const courante = () => { if (!o.parties.length) throw Error('--partie d\'abord'); return o.parties.at(-1); };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], val = () => { const v = argv[++i]; if (v === undefined) throw Error('valeur manquante après ' + k); return v; };
    if (k === '--partie') { const [p, n] = val().split(':').map(Number); if (!Number.isInteger(p) || !Number.isInteger(n)) throw Error('--partie PROJET:PARTIE'); o.projet = p; o.partie = n; o.parties.push({ projet: p, partie: n, designation: `${p}:${n}` }); }
    else if (k === '--echo') o.echo.push(val()); else if (k === '--jeu') o.jeu = val(); else if (k === '--sortie') o.sortie = val();
    else if (k === '--journal') o.journal.push(val());
    else if (k === '--cas') { const v = val(); if (o.mode === 'table') o.casFichier = v; else courante().cas = v; }
    else if (k === '--table') courante().table = val(); else if (k === '--skip') courante().skip = val();
    else if (k === '--json') o.json = val(); else if (k === '--reglages') o.reglages = val(); else if (k === '--date') o.date = val();
    else if (k === '--juger-partie-reservee') o.jugerReservee = true;
    else if (k === '--graine-ecartement-fictive') o.graine = true; else if (k === '--greffer') o.greffer = val();
    else throw Error('argument inconnu : ' + k);
  }
  return o;
}
function chargerParties(a, outil) {
  const Manifeste = require('./manifeste-parties.cjs'), m = Manifeste.lire();
  const { avis } = Manifeste.controler(m, a.parties.map(p => ({ projet: p.projet, partie: p.partie })), { outil, jugerReservee: !!a.jugerReservee });
  if (avis) console.error(avis);
  return a.parties.map(p => {
    if (!p.cas || !p.table) throw Error(`partie ${p.designation} : --cas et --table attendus`);
    const cas = lireJsonl(p.cas);
    if (cas.some(c => c.format !== FORMAT || c.partie !== p.partie)) throw Error(`${p.cas} : cas d'une autre partie ou d'un autre format`);
    const table = JSON.parse(fs.readFileSync(p.table, 'utf8'));
    if (table.partie !== p.partie) throw Error(`${p.table} : table d'une autre partie`);
    return { designation: p.designation, cas, table, skip: p.skip ? lireJsonl(p.skip) : null };
  });
}
if (require.main === module) {
  try {
    const a = args(process.argv.slice(2));
    if (a.mode === 'extraire') {
      if (!a.partie || !a.echo.length || !a.sortie) throw Error('extraire --partie P:N --echo DOSSIER [--jeu JEU.jsonl] --sortie CAS.jsonl');
      const tableP7 = a.graine && a.parties[0] && a.parties[0].table ? JSON.parse(fs.readFileSync(a.parties[0].table, 'utf8')) : null;
      if (tableP7 && tableP7.partie !== a.partie) throw Error(`${a.parties[0].table} : table d'une autre partie`);
      let cas = extraire({ ...a, table: tableP7 });
      if (a.greffer) {
        if (!a.graine) throw Error('--greffer ne sert qu\'avec --graine-ecartement-fictive');
        const g = greffer(lireJsonl(a.greffer), cas, { differe: new Set([...(tableP7 ? selection(tableP7).lot : new Map())].filter(([, k]) => k === 'differe').map(([c]) => c)) });
        cas = g.cas; console.log(`greffe sur ${a.greffer} : ${JSON.stringify(g.bilan)}`);
      }
      fs.mkdirSync(path.dirname(path.resolve(a.sortie)), { recursive: true });
      fs.writeFileSync(a.sortie, cas.map(c => JSON.stringify(c)).join('\n') + '\n');
      const n = k => cas.filter(c => c.ariane && c.ariane.etat === k).length;
      console.log(`partie ${a.projet}:${a.partie} : ${cas.length} cuts, calculés ${n('calcule')}, sans nuage ${n('sans-nuage')}, erreurs ${n('erreur')}, avec référence ${cas.filter(c => c.mic && c.mic.ref).length}`
        + (a.graine ? `, graines tentées ${cas.filter(c => c.ariane && c.ariane.chaineGraine).length}, posées ${cas.filter(c => c.ariane && c.ariane.chaineGraine && c.ariane.chaineGraine.pose).length}` : ''));
    } else if (a.mode === 'skip') {
      if (!a.partie || !a.echo.length || !a.sortie) throw Error('skip --partie P:N --echo DOSSIER --sortie SKIP.jsonl');
      const r = releverSkip(a.echo, a.partie); fs.writeFileSync(a.sortie, r.map(x => JSON.stringify(x)).join('\n') + '\n');
      console.log(JSON.stringify(bilanSkip(r)));
    } else if (a.mode === 'table') {
      if (!a.partie || !a.echo.length || !a.journal.length || !a.casFichier || !a.sortie) throw Error('table --partie P:N --echo DOSSIER --journal J.json [...] --cas CAS.jsonl --sortie TABLE.json (hors dépôt : bords des rails)');
      const t = construireTable({ projet: a.projet, partie: a.partie, echo: a.echo, journaux: a.journal, cas: lireJsonl(a.casFichier) });
      fs.writeFileSync(a.sortie, JSON.stringify(t));
      console.log(`partie ${a.projet}:${a.partie} : lot ${t.lot.length} (${t.lot.filter(x => x.differe).length} différés), PN ${t.zonesPN.length}, ADV ${t.zonesADV.length}, ${t.cuts.length} cuts à l'Écho`);
    } else if (a.mode === 'etudier') {
      const o = etudier(chargerParties(a, 'relecture-autonome'), { graine: !!a.graine });
      if (a.json) fs.writeFileSync(a.json, JSON.stringify(o, null, 1));
      if (a.reglages) fs.writeFileSync(a.reglages, JSON.stringify(reglagesProposes(o, { date: a.date || new Date().toISOString().slice(0, 10) }), null, 2) + '\n');
      console.log(texte(o));
    } else if (a.mode === 'juger') {
      if (!a.reglages) throw Error('juger --reglages datasets/relecture-reglages-proposes.json --partie P:N --cas … --table … [--juger-partie-reservee]');
      const o = juger(chargerParties(a, 'relecture-autonome (jugement)'), regleDuReglage(JSON.parse(fs.readFileSync(a.reglages, 'utf8'))), { graine: !!a.graine });
      if (a.json) fs.writeFileSync(a.json, JSON.stringify(o, null, 1));
      console.log(texte(o));
    } else if (a.mode === 'essai') {
      const { cas, table } = essai(), o = etudier([{ designation: '9:1', cas, table }, { designation: '9:2', cas, table }]);
      console.log(texte(o));
    } else throw Error('mode : extraire | skip | table | etudier | juger | essai');
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
