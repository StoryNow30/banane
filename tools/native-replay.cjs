#!/usr/bin/env node
'use strict';
/* Rejeu HORS LIGNE du moteur V4.6 gelé sur la collecte Natif V4.6 — LECTURE SEULE.
 *
 * Ce fichier ne modifie rien. Il n'écrit que son propre résultat. Il n'importe ni
 * `src/engine.js`, ni `src/geometry-brain.js`, ni Pair Arbitration : uniquement
 * `src/geometry.js` et `vendor/capture-core.js`, tous deux GELÉS depuis 4.4.0 et
 * vérifiés par empreinte au démarrage. Aucun seuil n'est modifié : `propose` est
 * appelé sans options, donc sur ses DEFAULTS.
 *
 * TROIS ÉTAGES STRICTEMENT SÉPARÉS, dans cet ordre et sans retour en arrière :
 *
 *   1. DÉCISION MOTEUR   — `replayRail` / `replayCut`. Ne lit AUCUNE valeur
 *                          humaine. Expose les candidats réellement produits :
 *                          seed, surfaceIntersection, alternative, statut,
 *                          lossRatio, et la décision du moteur.
 *   2. MESURE            — `measureCut`. C'est ici, et seulement ici, qu'entre
 *                          la référence humaine. Elle ne peut pas remonter dans
 *                          l'étage 1 : `replayCut` a déjà rendu son résultat.
 *   3. INTERPRÉTATION    — `classify`. Ne lit que la sortie des étages 1 et 2,
 *                          jamais les données brutes. Purement descriptive :
 *                          aucune règle, aucun réglage, aucun apprentissage.
 *
 * CE QUI EST REJOUÉ, ET RIEN D'AUTRE. Le choix du snapshot n'est pas le mien :
 * il est écrit dans la collecte. Pour chaque visite et chaque rail,
 * `geometryEligibility[side]` nomme son `status` et ses `chunkIds`. Le banc ne
 * rejoue que les rails dont le statut vaut `comparable-candidate`, avec
 * exactement les chunks nommés. Aucun point n'est ajouté, aucun candidat
 * fabriqué, aucune interpolation.
 *
 * UNITÉS. Unités de scène, `physicalCalibrationStatus: not-independently-verified`.
 * Jamais converties en millimètres. La « relation de paire » est la distance
 * entre les origines de profil gauche et droite : ce n'est pas un écartement de
 * voie physique. Aucune cible fixe.
 *
 * AUCUN PARAMÈTRE N'EST RÉGLÉ ICI. Ni K, ni R, ni minBase, ni ancre, ni porte :
 * ce banc ne contient aucune politique. Il décrit ce que le moteur gelé produit.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const G = require('../src/geometry.js');

const ROOT = path.resolve(__dirname, '..');
/* Convention d'ÉVALUATION reprise du banc hors ligne pour que les chiffres
 * soient comparables. Elle sert à COMPTER, jamais à décider. */
const TOLERANCE_ORACLE = 0.010;

/** Les trois étages ne doivent pas tourner sur une géométrie différente de celle gelée. */
function assertFrozenEngine() {
  const pinned = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/v4.4.0-frozen-engine-hashes.json')));
  const files = pinned.files || pinned;
  const bad = [];
  for (const [rel, expected] of Object.entries(files)) {
    if (!/geometry\.js$|capture-core\.js$|lidar\.js$/.test(rel)) continue;
    const got = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
    const want = typeof expected === 'string' ? expected : expected.sha256;
    if (got !== want) bad.push(`${rel}\n    attendu ${want}\n    obtenu  ${got}`);
  }
  if (bad.length) throw Error('Géométrie gelée altérée — rejeu refusé :\n  ' + bad.join('\n  '));
  return files;
}

/* ------------------------------------------------------------------ lecture */

const norm = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Applique la partie linéaire de `m` à un DÉPLACEMENT (et non à un point). */
const move = (m, v) => {
  const o = C.point(m, [0, 0, 0]), w = C.point(m, v);
  return [w[0] - o[0], w[1] - o[1], w[2] - o[2]];
};

/** Déréférence le dictionnaire `{"__ref":"rails:3"}` du format compact v3. */
function derefer(dictionaries) {
  const seen = new WeakMap();
  return function deref(v) {
    if (Array.isArray(v)) return v.map(deref);
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length === 1 && keys[0] === '__ref') {
        const [name, i] = v.__ref.split(':');
        return deref(dictionaries[name][Number(i)]);
      }
      if (seen.has(v)) return seen.get(v);
      const out = {};
      seen.set(v, out);
      for (const k of keys) out[k] = deref(v[k]);
      return out;
    }
    return v;
  };
}

/**
 * Deux pièges de la collecte, constatés sur les données et non supposés.
 *
 *   1. Les exports sont cumulatifs, mais le segment le plus complet d'une
 *      session n'est PAS celui d'indice le plus élevé : les fichiers sans
 *      « auto- » sont des exports manuels postérieurs. Le critère correct est
 *      l'horodatage. Contrôle : 176 + 232 + 271 = 679 visites, exactement ce
 *      qu'annonce le manifest de la collecte.
 *   2. Les nuages sont LIBÉRÉS au fil des segments : aucun segment ne les porte
 *      tous. Il faut l'union des chunks sur l'ensemble des fichiers.
 */
function indexCollection(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  if (!files.length) throw Error('Aucun export Natif dans ' + dir);
  const latest = new Map();
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f)));
    const sid = raw.session.id, stamp = raw.segment.stamp;
    if (!latest.has(sid) || stamp > latest.get(sid).stamp) latest.set(sid, { stamp, file: f });
  }
  return { files, latestPerSession: latest };
}

/** Visites dédupliquées, lues depuis l'export le plus tardif de chaque session. */
function readVisits(dir, index) {
  const visits = [];
  for (const { file } of index.latestPerSession.values()) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, file)));
    const deref = derefer(raw.dictionaries);
    for (const r of raw.records) {
      visits.push({
        sessionId: raw.session.id, sourceFile: file,
        visitId: r.visitId, visitIndex: r.visitIndex,
        identity: deref(r.identity),
        status: r.status, lidarStatus: r.lidarStatus ?? null,
        usableAsNativeReference: r.usableAsNativeReference === true,
        usableForOfflineEvaluationByRail: r.usableForOfflineEvaluationByRail ?? null,
        usableForTraining: r.usableForTraining === true,
        trainingExclusionReason: r.trainingExclusionReason ?? null,
        multiIntent: r.multiIntent === true,
        observedLabelCandidate: r.observedLabelCandidate ?? null,
        commandSentByBanane: r.commandSentByBanane === true,
        geometryEligibility: deref(r.geometryEligibility ?? null),
        railSnapshots: deref(r.railSnapshots ?? null),
        humanFinalReference: deref(r.humanFinalReference ?? null),
      });
    }
  }
  return visits;
}

/** Points des chunks explicitement nommés par `geometryEligibility`, et d'eux seuls. */
function readNeededChunks(dir, index, needed) {
  const out = new Map();
  for (const f of index.files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f)));
    for (const c of raw.clouds) {
      if (c.format !== 'banane-native-lidar-chunk-v1') continue;
      if (!needed.has(c.chunkId) || out.has(c.chunkId)) continue;
      out.set(c.chunkId, {
        points: c.pointsSceneRelative,
        visible: c.visibleByClipBoxes ?? null,
        qualification: c.qualification ? { status: c.qualification.status,
          reasons: c.qualification.exclusionReasons ?? [] } : null,
      });
    }
    if (out.size === needed.size) break;
  }
  return out;
}

/* =========================== ÉTAGE 1 — DÉCISION MOTEUR =====================
 * Aucune valeur humaine n'est lue sous cette ligne et jusqu'à l'étage 2.     */

/** Pose initiale du rail au moment de la capture, telle que la collecte l'a figée. */
function initialRail(visit, side) {
  const snaps = visit.railSnapshots?.[side];
  const el = visit.geometryEligibility?.[side];
  if (Array.isArray(snaps) && snaps.length) {
    const byId = el?.snapshotId && snaps.find(s => s.snapshotId === el.snapshotId);
    return (byId || snaps[snaps.length - 1]).rail ?? null;
  }
  return null;
}

/**
 * Assemble la capture d'UN rail à partir des chunks que la collecte a nommés,
 * puis appelle la géométrie gelée. `propose` est appelé sans options : ses
 * DEFAULTS s'appliquent, aucun seuil n'est touché.
 */
function replayRail(visit, side, chunks) {
  const el = visit.geometryEligibility?.[side] ?? null;
  const status = el?.status ?? 'absent';
  if (status !== 'comparable-candidate')
    return { replayed: false, eligibility: status, reasons: el?.reasons ?? [], proposal: null };
  const rail = initialRail(visit, side);
  if (!rail) return { replayed: false, eligibility: status, reasons: ['pose-initiale-absente'], proposal: null };
  const ids = el.chunkIds ?? [];
  const points = [], visible = [];
  let missing = 0;
  for (const id of ids) {
    const c = chunks.get(id);
    if (!c) { missing++; continue; }
    for (let i = 0; i < c.points.length; i++) {
      points.push(c.points[i]);
      visible.push(c.visible ? c.visible[i] : true);
    }
  }
  if (missing) return { replayed: false, eligibility: status, reasons: [`chunks-absents:${missing}/${ids.length}`], proposal: null };
  if (!points.length) return { replayed: false, eligibility: status, reasons: ['aucun-point'], proposal: null };
  const capture = { rails: { [side]: rail }, pointsSceneRelative: points, visibleByClipBoxes: visible };
  return { replayed: true, eligibility: status, reasons: [], rail, points: points.length,
           proposal: G.propose(capture, side) };
}

/** Les candidats RÉELLEMENT produits, lus tels quels. Aucun n'est fabriqué. */
function exposedCandidates(proposal) {
  const m = proposal?.metrics || {}, ta = m.templateAmbiguity || {}, out = {};
  if (m.seed) out.seed = [0, m.seed[0], m.seed[1]];
  if (m.surfaceIntersection) out.surfaceIntersection = [0, m.surfaceIntersection[0], m.surfaceIntersection[1]];
  if (ta.alternative) out.alternative = [0, ta.alternative[0], ta.alternative[1]];
  return out;
}

/**
 * Rejeu d'un cut entier. `enforcePairSupport` est appliqué exactement comme le
 * fait `proposeBoth`, mais seulement quand les DEUX rails ont été rejoués :
 * l'appui de paire est une règle du moteur gelé, pas une invention du banc.
 */
function replayCut(visit, chunks) {
  const rails = { left: replayRail(visit, 'left', chunks), right: replayRail(visit, 'right', chunks) };
  let paired = false;
  if (rails.left.replayed && rails.right.replayed) {
    const both = G.enforcePairSupport({ left: rails.left.proposal, right: rails.right.proposal }, {});
    rails.left.proposal = both.left; rails.right.proposal = both.right;
    paired = true;
  }
  const engine = {};
  for (const side of ['left', 'right']) {
    const r = rails[side], p = r.proposal;
    engine[side] = {
      replayed: r.replayed, eligibility: r.eligibility, notReplayedReasons: r.reasons,
      pointsUsed: r.points ?? null,
      status: p?.status ?? null,
      confidence: p?.confidence ?? null,
      lossRatio: p?.metrics?.templateAmbiguity?.lossRatio ?? null,
      separation: p?.metrics?.templateAmbiguity?.separation ?? null,
      candidates: p ? exposedCandidates(p) : {},
      engineDelta: p?.delta ?? null,
      reasons: p?.reasons ?? [],
    };
  }
  return { pairSupportApplied: paired, rails: engine,
           initialRails: { left: initialRail(visit, 'left'), right: initialRail(visit, 'right') } };
}

/* =========================== ÉTAGE 2 — MESURE ==============================
 * La référence humaine apparaît ICI pour la première fois. L'étage 1 a déjà
 * rendu son résultat : elle ne peut pas l'influencer.                        */

/**
 * Déplacement humain, exprimé dans le repère local du profil — comparable aux
 * candidats. Il est DÉDUIT de deux poses observées, jamais d'une étiquette.
 * Fiabilité observationnelle seulement : ce n'est pas une vérité d'entraînement.
 */
function humanDeltaLocal(visit, side, initial) {
  const ref = visit.humanFinalReference;
  if (!ref || ref.status !== 'candidate-observed') return null;
  const finalRail = ref.state?.rails?.[side];
  if (!finalRail || !initial) return null;
  const a = initial.profileOriginSceneRelative, b = finalRail.profileOriginSceneRelative;
  if (!a || !b) return null;
  return move(initial.sceneRelativeToProfileLocal, [b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
}

/** Distance d'un placement candidat à la référence humaine, par rail. */
function measureCut(visit, replay) {
  const out = { left: null, right: null, humanStatus: visit.humanFinalReference?.status ?? 'absent' };
  for (const side of ['left', 'right']) {
    const initial = replay.initialRails[side];
    const human = humanDeltaLocal(visit, side, initial);
    if (!human) { out[side] = { human: null, errors: {}, engineError: null }; continue; }
    const cands = replay.rails[side].candidates, errors = {};
    for (const [name, d] of Object.entries(cands)) errors[name] = norm(d, human);
    const applied = replay.rails[side].engineDelta;
    out[side] = { human, errors, engineError: applied ? norm(applied, human) : null };
  }
  return out;
}

/** Relation de paire — distance entre origines de profil. JAMAIS un écartement physique. */
function pairRelation(replay, leftName, rightName) {
  const l = replay.initialRails.left, r = replay.initialRails.right;
  if (!l || !r) return null;
  const dl = leftName ? replay.rails.left.candidates[leftName] : [0, 0, 0];
  const dr = rightName ? replay.rails.right.candidates[rightName] : [0, 0, 0];
  if (!dl || !dr) return null;
  const a = l.profileOriginSceneRelative.map((v, i) => v + move(l.profileLocalToSceneRelative, dl)[i]);
  const b = r.profileOriginSceneRelative.map((v, i) => v + move(r.profileLocalToSceneRelative, dr)[i]);
  return norm(a, b);
}

/* ======================= ÉTAGE 3 — INTERPRÉTATION ==========================
 * Ne lit que les sorties des étages 1 et 2. Purement DESCRIPTIF : aucune règle
 * n'est proposée, aucun paramètre n'est réglé, rien n'est appris.           */

const FAMILY_OF = { seed: 'best', surfaceIntersection: 'best', alternative: 'alternative' };

/**
 * Classement descriptif d'un cut, dans les six catégories demandées. L'ordre
 * des tests est celui de l'énoncé : la première catégorie qui s'applique gagne,
 * et « non-qualifiable » absorbe tout ce qui n'est pas mesurable.
 */
function classify(visit, replay, measure, tol = TOLERANCE_ORACLE) {
  const sides = ['left', 'right'];
  const replayed = sides.filter(s => replay.rails[s].replayed);
  if (replayed.length < 2)
    return { classe: 'non-qualifiable', motif: `rails rejoués : ${replayed.length}/2`,
             details: Object.fromEntries(sides.map(s => [s, replay.rails[s].eligibility])) };
  if (!sides.every(s => measure[s]?.human))
    return { classe: 'non-qualifiable', motif: 'référence humaine absente ou non observée',
             details: { humanStatus: measure.humanStatus } };
  if (visit.multiIntent)
    return { classe: 'non-qualifiable', motif: 'intentions opérateur multiples' };

  const best = {}, engineFam = {}, bestFam = {};
  for (const s of sides) {
    const errs = measure[s].errors;
    if (!Object.keys(errs).length)
      return { classe: 'non-qualifiable', motif: `aucun candidat exposé sur ${s}` };
    const [name, err] = Object.entries(errs).sort((a, b) => a[1] - b[1])[0];
    best[s] = { name, err, family: FAMILY_OF[name] };
    bestFam[s] = FAMILY_OF[name];
    const d = replay.rails[s].engineDelta;
    engineFam[s] = d ? (Object.entries(replay.rails[s].candidates)
      .find(([, v]) => norm(v, d) < 1e-12) || [null])[0] : null;
    engineFam[s] = engineFam[s] ? FAMILY_OF[engineFam[s]] : null;
  }
  const resolved = sides.filter(s => replay.rails[s].status === 'candidate');
  const engineErr = sides.map(s => measure[s].engineError);
  const engineOk = resolved.length === 2 && engineErr.every(e => e !== null && e <= tol);
  const bestOk = sides.every(s => best[s].err <= tol);

  if (engineOk) return { classe: 'moteur-correct', motif: 'les deux rails résolus sous la convention d’évaluation',
                         details: { engineError: engineErr, best } };
  if (!bestOk) return { classe: 'aucun-candidat-satisfaisant',
                        motif: 'le meilleur placement exposé reste au-dessus de la convention d’évaluation',
                        details: { best, engineError: engineErr } };
  if (resolved.length < 2)
    return { classe: 'moteur-abstient-bon-candidat-expose',
             motif: `rails non résolus : ${sides.filter(s => !resolved.includes(s)).join(',')}`,
             details: { best, engineError: engineErr } };
  const familleDifferente = sides.filter(s => engineFam[s] && engineFam[s] !== bestFam[s]);
  if (familleDifferente.length)
    return { classe: 'mauvaise-famille-alors-qu-une-autre-est-meilleure',
             motif: `famille à changer : ${familleDifferente.join(',')}`,
             details: { engineFamily: engineFam, bestFamily: bestFam, best, engineError: engineErr } };
  return { classe: 'rail-resolu-a-changer-pour-ameliorer-la-paire',
           motif: 'même famille des deux côtés, mais une variante exposée fait mieux',
           details: { best, engineError: engineErr } };
}

/* --------------------------------------------------- socle d'ancrage local */

/**
 * Compte, PAR PART, les cuts dont les deux rails atteignent `lossRatio >= R`,
 * et dit si un socle d'au moins `minBase` cuts existe réellement. C'est une
 * MESURE de faisabilité, pas un réglage : R et minBase sont ceux déjà figés par
 * Pair Arbitration V1, repris tels quels et jamais ajustés ici.
 */
function anchorFeasibility(rows, R = 5, minBase = 5) {
  const byPart = new Map();
  for (const row of rows) {
    const p = row.identity.part;
    if (!byPart.has(p)) byPart.set(p, { part: p, cuts: 0, replayedBoth: 0, settled: 0, settledCuts: [] });
    const e = byPart.get(p);
    e.cuts++;
    const L = row.engine.rails.left, Rr = row.engine.rails.right;
    if (!(L.replayed && Rr.replayed)) continue;
    e.replayedBoth++;
    if (L.status === 'candidate' && Rr.status === 'candidate'
        && Math.min(L.lossRatio ?? -Infinity, Rr.lossRatio ?? -Infinity) >= R) {
      e.settled++; e.settledCuts.push(row.identity.cut);
    }
  }
  return [...byPart.values()].sort((a, b) => a.part - b.part).map(e => ({
    ...e, R, minBase, socleExists: e.settled >= minBase,
    settledCuts: e.settledCuts.sort((a, b) => a - b),
  }));
}

/* ------------------------------------------------------------------ pilote */

function run(dir, { tol = TOLERANCE_ORACLE } = {}) {
  const frozen = assertFrozenEngine();
  const index = indexCollection(dir);
  const visits = readVisits(dir, index);
  const needed = new Set();
  for (const v of visits) for (const s of ['left', 'right']) {
    const el = v.geometryEligibility?.[s];
    if (el?.status === 'comparable-candidate') for (const id of el.chunkIds ?? []) needed.add(id);
  }
  const chunks = readNeededChunks(dir, index, needed);
  const rows = visits.map(visit => {
    const engine = replayCut(visit, chunks);          // étage 1
    const measure = measureCut(visit, engine);        // étage 2
    const interpretation = classify(visit, engine, measure, tol); // étage 3
    return {
      sessionId: visit.sessionId, visitId: visit.visitId, visitIndex: visit.visitIndex,
      identity: visit.identity,
      provenance: {
        sourceFile: visit.sourceFile, visitStatus: visit.status, lidarStatus: visit.lidarStatus,
        usableAsNativeReference: visit.usableAsNativeReference,
        usableForOfflineEvaluationByRail: visit.usableForOfflineEvaluationByRail,
        usableForTraining: visit.usableForTraining,
        trainingExclusionReason: visit.trainingExclusionReason,
        multiIntent: visit.multiIntent, observedLabelCandidate: visit.observedLabelCandidate,
        commandSentByBanane: visit.commandSentByBanane,
      },
      engine, measure, interpretation,
      pairRelation: {
        initial: engine.rails.left.replayed && engine.rails.right.replayed ? pairRelation(engine, null, null) : null,
        engineApplied: engine.rails.left.engineDelta && engine.rails.right.engineDelta
          ? pairRelation(engine, 'seed', 'seed') : null,
      },
    };
  });
  return { frozen, index, rows, chunksRead: chunks.size, chunksNeeded: needed.size };
}

function summarise(rows, tol = TOLERANCE_ORACLE) {
  const count = f => rows.filter(f).length;
  const classes = {};
  for (const r of rows) classes[r.interpretation.classe] = (classes[r.interpretation.classe] || 0) + 1;
  return {
    visits: rows.length,
    distinctCuts: new Set(rows.map(r => `${r.identity.part}/${r.identity.cut}`)).size,
    parts: [...new Set(rows.map(r => r.identity.part))].sort((a, b) => a - b),
    railsReplayed: rows.reduce((n, r) => n + ['left', 'right'].filter(s => r.engine.rails[s].replayed).length, 0),
    cutsReplayedBoth: count(r => r.engine.rails.left.replayed && r.engine.rails.right.replayed),
    cutsWithHumanReference: count(r => r.measure.left?.human && r.measure.right?.human),
    comparable: count(r => r.interpretation.classe !== 'non-qualifiable'),
    classes,
    oracleTolerance: tol,
    anchorFeasibility: anchorFeasibility(rows),
  };
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage : node tools/native-replay.cjs <dossier-collecte> [--output f.json] [--report f.md]');
    process.exit(2);
  }
  const { frozen, rows, chunksRead, chunksNeeded, index } = run(dir);
  const summary = summarise(rows);
  const body = {
    format: 'banane-native-replay-v1',
    nature: 'rejeu hors ligne, lecture seule — aucune politique, aucun réglage, aucun entraînement',
    generatedAt: new Date().toISOString(),
    engine: { version: '4.6.0', geometryMethod: G.DEFAULTS.method, parameters: G.DEFAULTS,
              frozenHashes: frozen, calledWithoutOptions: true },
    units: 'scene-units; physicalCalibrationStatus: not-independently-verified; never millimetres',
    collection: { directory: path.resolve(dir), files: index.files.length,
                  latestPerSession: Object.fromEntries([...index.latestPerSession].map(([k, v]) => [k, v.file])),
                  chunksNeeded, chunksRead },
    humanReferenceCaveat:
      'les références humaines sont fiables au sens OBSERVATIONNEL uniquement ; elles ne sont pas '
    + 'promues en vérité d’entraînement et ne servent à aucune décision de l’étage 1',
    summary, rows,
  };
  const out = process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : null;
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(body, null, 1));
    console.log(`rejeu écrit : ${out}`);
    console.log(`sha256 : ${crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex')}`);
  }
  console.log(JSON.stringify(summary, null, 2));
}

module.exports = { assertFrozenEngine, derefer, indexCollection, readVisits, readNeededChunks,
                   initialRail, replayRail, exposedCandidates, replayCut, humanDeltaLocal,
                   measureCut, pairRelation, classify, anchorFeasibility, run, summarise,
                   move, norm, FAMILY_OF, TOLERANCE_ORACLE };
if (require.main === module) main();
