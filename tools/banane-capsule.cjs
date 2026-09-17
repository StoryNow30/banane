#!/usr/bin/env node
'use strict';
/* Banane Research Capsule — capsules de recherche autonomes et versionnées.
 *
 * BUT. Permettre à un tiers (Grok / Loki) de rejouer une population de rails
 * Running Surface SANS jamais disposer des archives `.7z` ni de `banane-data` :
 * la capsule embarque, en JSON versionné, le MINIMUM SUFFISANT au replay
 * déterministe de chaque rail.
 *
 * CE FICHIER NE TOUCHE À AUCUN RUNTIME. Il importe `src/geometry.js` et
 * `vendor/capture-core.js` — gelés, empreintes vérifiées — pour REJOUER, jamais
 * pour modifier. Aucun seuil, aucun correctif, aucun changement moteur.
 *
 * ISOLATION HUMAINE. Le payload géométrique d'un rail ne contient AUCUNE donnée
 * humaine : ni `humanFinalReference`, ni correction opérateur, ni oracle, ni
 * cible d'entraînement, ni placement humain final. Le test anti-fuite vérifie
 * la SÉMANTIQUE : le mot « final » reste permis lorsqu'il désigne l'archive
 * `final` ou une provenance technique (`finalObserved` n'est jamais copié).
 *
 * PROVENANCE. Chaque rail nomme son archive source (`historical` / `final`),
 * son snapshot exact, ses chunks, et porte un SHA-256 de payload. Le manifeste
 * porte le SHA des deux archives, les commits de base et de méthodologie, la
 * liste des shards avec taille et SHA, et un SHA déterministe global.
 *
 * ÉCHEC EXPLICITE. Capsule absente, hash faux, shard manquant, rail incomplet :
 * arrêt explicite, jamais de fallback silencieux.
 *
 * UNITÉS de scène, jamais des millimètres.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const G = require('../src/geometry.js');

const ROOT = path.resolve(__dirname, '..');
const CAPSULES_DIR = path.join(ROOT, 'data', 'capsules');
const CAPSULE_FORMAT = 'banane-research-capsule-v1';
const FAILURE_REASON = 'Plan de roulement non estimable.';
const MIN_ROWS_FOR_LINE = 3;

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
/** Empreinte déterministe d'un objet, indépendante de l'horodatage. */
const shaOf = obj => sha256(Buffer.from(JSON.stringify(obj), 'utf8'));
const die = msg => { console.error('CAPSULE FAIL: ' + msg); process.exit(1); };

/* ===================== isolation humaine ==================================
 * La liste est SÉMANTIQUE : elle vise les champs de référence humaine du format
 * Natif, pas la sous-chaîne « final ». `finalObserved`, `humanFinalReference`,
 * `observedLabelCandidate` et les intentions opérateur ne sont jamais copiés.  */
const HUMAN_KEYS = new Set([
  'humanFinalReference', 'humanFinal', 'humanDeltaLocal', 'finalObserved',
  'finalHumanRails', 'observedLabelCandidate', 'operatorIntent', 'operatorIntents',
  'operatorEvents', 'multiIntent', 'humanLabel', 'oracle', 'trainingTarget',
  'usableForTraining', 'trainingExclusionReason',
]);
/** Détection récursive d'une clé de référence humaine, par sémantique. */
function findHumanKeys(obj, base = '') {
  const hits = [];
  (function walk(v, p) {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${p}[${i}]`));
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
      if (HUMAN_KEYS.has(k)) hits.push(`${p}.${k}`);
      /* filet supplémentaire : toute clé mentionnant human/operator/oracle/truth,
       * MAIS pas « final » seul, qui désigne l'archive ou une provenance. */
      else if (/human|operator|oracle|truth|trainingtarget/i.test(k)) hits.push(`${p}.${k}`);
      walk(x, `${p}.${k}`);
    }
  })(obj, base);
  return hits;
}

/* ===================== lecture des données Natif préparées ================= */

const CORPUS_ARCHIVE = { 'historical-original': 'historical', 'final-complementary': 'final' };

function loadShadowReader() {
  /* Le lecteur tolérant du shadow (déréférencement compact, dédup des segments)
   * est réutilisé tel quel : il ne produit aucune donnée dérivée, il lit. */
  return require('./flank-support-shadow.cjs');
}

/** Résout les répertoires de données préparés par le bootstrap. */
function bootstrapPaths() {
  const state = path.join(ROOT, '.banane-data', 'native-v46', 'extracted');
  const historical = process.env.BANANE_NATIVE_HISTORICAL_DIR || path.join(state, 'historical');
  const final = process.env.BANANE_NATIVE_FINAL_DIR || path.join(state, 'final');
  return { 'historical-original': historical, 'final-complementary': final };
}

/**
 * Construit l'index des visites des deux corpus préparés. Une seule lecture par
 * corpus ; les chunks sont chargés à la demande pour l'ensemble des chunkId
 * nécessaires.
 */
function readCorpora(dirs, F, neededByCorpus) {
  const out = {};
  for (const [name, dir] of Object.entries(dirs)) {
    if (!fs.existsSync(dir)) die(`répertoire Natif préparé absent : ${dir} (lancer le bootstrap prepare)`);
    const corpus = F.readCorpus(dir);
    const visits = F.readVisitsOf(corpus);
    const byKey = new Map();
    for (const v of visits) byKey.set(`${v.sessionId}|${v.visitId}`, v);
    /* préchargement des chunks : UNE passe sur les exports du corpus, au lieu
     * d'une relecture par rail. */
    const chunks = neededByCorpus ? readChunksFor(corpus, neededByCorpus[name] ?? new Set()) : new Map();
    out[name] = { corpus, visits, byKey, chunks };
  }
  return out;
}

/**
 * Chunks LiDAR nécessaires, lus directement des exports du corpus. Un chunk
 * n'est retenu qu'une fois (les segments sont cumulatifs). Réimplémenté ici
 * pour ne dépendre d'aucun interne du shadow.
 */
function readChunksFor(corpus, needed) {
  const out = new Map();
  for (const e of corpus.exports) {
    const raw = JSON.parse(fs.readFileSync(path.join(corpus.dir, e.file)));
    for (const c of raw.clouds ?? []) {
      if (c.format !== 'banane-native-lidar-chunk-v1') continue;
      if (!needed.has(c.chunkId) || out.has(c.chunkId)) continue;
      out.set(c.chunkId, { points: c.pointsSceneRelative, visible: c.visibleByClipBoxes ?? null });
    }
    if (out.size === needed.size) break;
  }
  return out;
}

/**
 * Payload géométrique d'UN rail, lu depuis les exports Natif bruts. AUCUNE
 * valeur humaine n'est copiée. L'ordre des points suit l'ordre des chunkId,
 * exactement comme le moteur les assemble.
 */
function extractRailPayload(identity, corpora) {
  const src = corpora[identity.corpus];
  if (!src) die(`corpus inconnu : ${identity.corpus}`);
  const visit = src.byKey.get(`${identity.sessionId}|${identity.visitId}`);
  if (!visit) die(`visite introuvable : ${identity.sessionId}|${identity.visitId}`);
  const el = visit.geometryEligibility?.[identity.side];
  if (!el) die(`éligibilité absente : ${identity.part}/${identity.cut}/${identity.side}`);
  if (el.status !== 'comparable-candidate')
    die(`rail non comparable : ${identity.part}/${identity.cut}/${identity.side} (${el.status})`);
  if (el.snapshotId !== identity.snapshotId)
    die(`snapshot divergent : attendu ${identity.snapshotId}, lu ${el.snapshotId}`);
  const snap = (visit.railSnapshots?.[identity.side] || []).find(s => s.snapshotId === el.snapshotId);
  if (!snap?.rail) die(`snapshot exact absent : ${el.snapshotId}`);
  if (!snap.rail.sceneRelativeToProfileLocal)
    die(`transformation absente du snapshot : ${el.snapshotId}`);

  /* chunks nommés, dans l'ordre de chunkIds, pris dans le cache préchargé une
   * seule fois par corpus (voir readCorpora). */
  const chunks = [];
  for (const chunkId of el.chunkIds ?? []) {
    const c = src.chunks.get(chunkId);
    if (!c) die(`chunk nommé absent : ${chunkId}`);
    chunks.push({ chunkId, points: c.points, visible: c.visible ?? null });
  }
  if (!chunks.length) die(`aucun chunk pour ${identity.part}/${identity.cut}/${identity.side}`);

  const payload = {
    key: { corpus: identity.corpus, cohort: identity.cohort,
           sessionId: identity.sessionId, visitId: identity.visitId,
           visitIndex: identity.visitIndex, part: identity.part, cut: identity.cut,
           side: identity.side },
    target: {
      pageId: visit.identity.pageId, part: visit.identity.part, cut: visit.identity.cut,
      shape: visit.identity.shape, frameId: visit.identity.frameId,
      projectId: visit.identity.projectId ?? null,
    },
    /* état initial exact + transformation : c'est `snap.rail`, copié tel quel,
     * SANS aucun champ humain. */
    railInitialState: snap.rail,
    snapshot: { snapshotId: el.snapshotId, criteriaVersion: el.criteriaVersion ?? null,
                referenceStatus: el.referenceStatus ?? null },
    chunkRefs: el.chunkIds ?? [],
    chunks,
    provenance: {
      archive: CORPUS_ARCHIVE[identity.corpus], corpus: identity.corpus,
      sourceFile: visit.sourceFile, snapshotId: el.snapshotId,
      captureId: (el.captureId ?? null),
      pointsSupplied: chunks.reduce((n, c) => n + c.points.length, 0),
    },
  };
  /* garde-fou : aucune clé humaine ne doit avoir traversé (railInitialState
   * peut en théorie porter des champs inattendus). */
  const leaks = findHumanKeys({ railInitialState: payload.railInitialState,
                                chunks: payload.chunks, target: payload.target,
                                snapshot: payload.snapshot });
  if (leaks.length) die(`fuite humaine dans le payload ${identity.part}/${identity.cut}: ${leaks.join(', ')}`);
  payload.payloadSha256 = shaOf({ key: payload.key, target: payload.target,
    railInitialState: payload.railInitialState, snapshot: payload.snapshot,
    chunkRefs: payload.chunkRefs, chunks: payload.chunks });
  return payload;
}

/* ===================== reconstruction de capture + traceur ================= */

/**
 * Reconstruit la capture EXACTEMENT comme `replayRailExact` du shadow : points
 * et visibilité concaténés dans l'ordre des chunks. Vaut pour un rail lu du RAW
 * comme d'une capsule — c'est ce qui rend la parité vérifiable.
 */
function captureFromPayload(payload) {
  const points = [], visible = [];
  for (const c of payload.chunks) for (let i = 0; i < c.points.length; i++) {
    points.push(c.points[i]);
    visible.push(c.visible ? c.visible[i] : true);
  }
  return { rails: { [payload.key.side]: payload.railInitialState },
           pointsSceneRelative: points, visibleByClipBoxes: visible };
}

/**
 * Traceur Running Surface — miroir du moteur gelé, réutilisant `G.median`,
 * `G.robustLine` et `C.point`. Identique à celui de Running Surface Failure Lab
 * V1 ; il sert ici UNIQUEMENT à prouver la parité RAW ↔ CAPSULE, jamais à
 * décider quoi que ce soit. L'accumulation `u += step` est celle du moteur.
 */
function trace(capture, side, cfg = G.DEFAULTS) {
  const rail = capture.rails?.[side];
  const out = { exit: null, sign: null, pointsLocal: null, width: null, topAnchors: null,
                faceAnchors: null, coarseBest: null, refinedBest: null, seed: null,
                templateLoss: null, templateLossRatio: null, topRows: null, top: null,
                localPointsHash: null };
  if (!capture.pointsSceneRelative?.length) return { ...out, exit: 'Aucun point LiDAR disponible.' };
  const contour = rail.profileContours?.reduce(
    (a, b) => (b.verticesSceneRelative?.length || 0) > (a?.verticesSceneRelative?.length || 0) ? b : a, null);
  if (!contour) return { ...out, exit: 'Contour du profil absent.' };
  const shape = contour.verticesSceneRelative.map(p => C.point(rail.sceneRelativeToProfileLocal, p));
  const sign = Math.sign(G.median(shape.map(p => p[1])));
  if (!sign) return { ...out, exit: 'Sens du profil ambigu.' };
  out.sign = sign;
  const vertices = shape.map(p => [sign * p[1], p[2]]), head = vertices.filter(p => p[1] > -0.04);
  if (head.length < 6) return { ...out, exit: 'Contour de champignon non reconnu.' };
  const points = [];
  for (let i = 0; i < capture.pointsSceneRelative.length; i++) {
    if (capture.visibleByClipBoxes?.[i] === false) continue;
    if (!Array.isArray(capture.pointsSceneRelative[i])
        || !capture.pointsSceneRelative[i].every(Number.isFinite)) continue;
    const q = C.point(rail.sceneRelativeToProfileLocal, capture.pointsSceneRelative[i]);
    if (q.every(Number.isFinite) && Math.abs(q[0]) <= 0.5 && Math.abs(q[1]) < 0.18 && Math.abs(q[2]) < 0.10)
      points.push([sign * q[1], q[2], q[0]]);
  }
  out.pointsLocal = points.length;
  out.localPointsHash = shaOf(points);
  if (points.length < 8) return { ...out, exit: 'Trop peu de points autour du champignon.' };
  const width = Math.max(...head.filter(p => p[1] > -0.012).map(p => p[0]));
  out.width = width;
  if (!(width > 0.025 && width < 0.12)) return { ...out, exit: 'Dimensions du profil hors du domaine testé.' };
  const topAnchors = [];
  for (let u = 0.012; u < width - 0.012; u += 0.006) {
    const nr = head.filter(p => Math.abs(p[0] - u) < 0.004);
    if (nr.length) topAnchors.push([u, Math.max(...nr.map(p => p[1]))]);
  }
  const faceAnchors = [];
  for (let z = -0.014; z >= -0.033; z -= 0.004) {
    const nr = head.filter(p => Math.abs(p[1] - z) < 0.004);
    if (nr.length) faceAnchors.push([Math.min(...nr.map(p => p[0])), z]);
  }
  out.topAnchors = topAnchors.length; out.faceAnchors = faceAnchors.length;
  if (topAnchors.length < 3 || faceAnchors.length < 3)
    return { ...out, exit: 'Surfaces du profil non identifiées.' };
  const loss = (anchors, u, z) => G.median(anchors.map(a => {
    let b = 0.025 * 0.025;
    for (const p of points) { const d = (p[0] - u - a[0]) ** 2 + (p[1] - z - a[1]) ** 2; if (d < b) b = d; }
    return b;
  }));
  let best = { loss: Infinity, u: 0, z: 0 };
  const coarse = [];
  const search = (cu, cz, ry, rz, step, retain = false) => {
    for (let u = cu - ry; u <= cu + ry + 1e-10; u += step)
      for (let z = cz - rz; z <= cz + rz + 1e-10; z += step) {
        const score = loss(topAnchors, u, z) + loss(faceAnchors, u, z) + 1e-7 * (Math.abs(u) + Math.abs(z));
        if (retain) coarse.push({ loss: score, u, z });
        if (score < best.loss) best = { loss: score, u, z };
      }
  };
  search(0, 0, cfg.searchY, cfg.searchZ, cfg.grid, true);
  const coarseBest = { ...best };
  let alternative = null;
  for (const c of coarse) {
    if (Math.hypot(c.u - coarseBest.u, c.z - coarseBest.z) < cfg.alternativeSeparation) continue;
    if (!alternative || c.loss < alternative.loss) alternative = c;
  }
  const templateLossRatio = alternative && coarseBest.loss > 0 ? alternative.loss / coarseBest.loss : Infinity;
  search(best.u, best.z, 0.004, 0.004, 0.001);
  out.coarseBest = coarseBest; out.refinedBest = { ...best };
  out.seed = [sign * best.u, best.z]; out.templateLoss = best.loss;
  out.templateLossRatio = Number.isFinite(templateLossRatio) ? templateLossRatio : null;
  const rows = points.filter(p =>
    p[0] > best.u + 0.012 && p[0] < best.u + width - 0.012 && Math.abs(p[1] - best.z) < cfg.topBand)
    .map(p => [p[0], p[1]]);
  out.topRows = rows.length;
  const top = G.robustLine(rows);
  if (!top) return { ...out, exit: FAILURE_REASON };
  out.top = { count: top.count, residual: top.residual, slope: top.slope, intercept: top.intercept,
              slopeLimited: top.slopeLimited };
  return { ...out, exit: 'au-dela-du-point-etudie' };
}

/* ===================== écriture d'une capsule ============================== */

function frozenHashes() {
  const files = ['src/geometry.js', 'src/engine.js', 'vendor/capture-core.js', 'vendor/lidar.js'];
  return Object.fromEntries(files.map(f => [f, sha256(fs.readFileSync(path.join(ROOT, f)))]));
}

/** Écrit la capsule `rsf-v1` en shards JSONL + manifest.json. */
function buildRsvV1({ identitiesPath, methodologyCommit, baseCommit, shardSize = 40 } = {}) {
  const F = loadShadowReader();
  const dirs = bootstrapPaths();
  const identities = JSON.parse(fs.readFileSync(identitiesPath));
  if (identities.length !== 239) die(`population attendue 239, reçue ${identities.length}`);
  const failures = identities.filter(x => x.cohort === 'failure').length;
  const controls = identities.filter(x => x.cohort === 'control').length;
  if (failures !== 63 || controls !== 176) die(`cohortes attendues 63/176, reçues ${failures}/${controls}`);

  /* première passe : visites seules, pour collecter les chunkId nécessaires */
  const visitsOnly = readCorpora(dirs, F);
  const neededByCorpus = { 'historical-original': new Set(), 'final-complementary': new Set() };
  for (const id of identities) {
    const v = visitsOnly[id.corpus]?.byKey.get(`${id.sessionId}|${id.visitId}`);
    const el = v?.geometryEligibility?.[id.side];
    if (el?.chunkIds) for (const c of el.chunkIds) neededByCorpus[id.corpus].add(c);
  }
  /* seconde passe : chunks préchargés en une seule lecture par corpus */
  const corpora = readCorpora(dirs, F, neededByCorpus);

  /* tri déterministe : corpus, part, cut, side */
  const sorted = identities.slice().sort((a, b) =>
    a.corpus < b.corpus ? -1 : a.corpus > b.corpus ? 1
    : a.part - b.part || a.cut - b.cut || (a.side < b.side ? -1 : a.side > b.side ? 1 : 0));

  const payloads = sorted.map(id => extractRailPayload(id, corpora));

  const outDir = path.join(CAPSULES_DIR, 'rsf-v1');
  const railsDir = path.join(outDir, 'rails');
  fs.rmSync(railsDir, { recursive: true, force: true });
  fs.mkdirSync(railsDir, { recursive: true });

  const shards = [];
  for (let i = 0; i < payloads.length; i += shardSize) {
    const chunk = payloads.slice(i, i + shardSize);
    const name = `rails-${String(shards.length).padStart(3, '0')}.jsonl`;
    const body = chunk.map(p => JSON.stringify(p)).join('\n') + '\n';
    fs.writeFileSync(path.join(railsDir, name), body);
    shards.push({ file: `rails/${name}`, rails: chunk.length,
                  bytes: Buffer.byteLength(body, 'utf8'), sha256: sha256(Buffer.from(body, 'utf8')),
                  keys: chunk.map(p => `${p.key.part}/${p.key.cut}/${p.key.side}`) });
  }

  const railIdentities = payloads.map(p => ({
    corpus: p.key.corpus, cohort: p.key.cohort, sessionId: p.key.sessionId,
    visitId: p.key.visitId, visitIndex: p.key.visitIndex, part: p.key.part,
    cut: p.key.cut, side: p.key.side, snapshotId: p.snapshot.snapshotId,
    archive: p.provenance.archive, payloadSha256: p.payloadSha256 }));

  const lock = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/native-v46.lock.json'))); }
                        catch { return null; } })();

  const manifestCore = {
    format: CAPSULE_FORMAT,
    id: 'rsf-v1',
    expectedTotal: 239, failures: 63, controls: 176,
    studiedExit: FAILURE_REASON,
    sourceArchives: {
      historical: { file: 'banane-native-v4.6-2026-09-16.7z', bytes: 34509008,
        sha256: '32e48aa79de988ab8bb6efc65d7038d4e27535e2a5f2486768438616f518bfc0' },
      final: { file: 'banane-native-v4.6-2026-09-16-final.7z', bytes: 56657500,
        sha256: '7cac220bd6e097f14ff1d39cbc431e7c6e918b819bdf521883bc33847ec12c66' },
    },
    methodologySource: { role: 'identification de la population uniquement, jamais payload',
                         commit: methodologyCommit },
    infrastructureBase: { branch: 'infra/research-bootstrap-v1', commit: baseCommit },
    lockDataset: lock ? (lock.id ?? lock.dataset ?? 'native-v46') : null,
    runtimeFrozenHashes: frozenHashes(),
    counts: { rails: payloads.length,
              perArchive: { historical: railIdentities.filter(r => r.archive === 'historical').length,
                            final: railIdentities.filter(r => r.archive === 'final').length } },
    shards: shards.map(s => ({ file: s.file, rails: s.rails, bytes: s.bytes, sha256: s.sha256 })),
    railIdentities,
    humanIsolation: {
      policy: 'aucun champ de référence humaine dans le payload géométrique',
      semanticNotSubstring: 'le mot « final » reste permis pour l’archive/provenance',
      forbiddenKeys: [...HUMAN_KEYS],
    },
    units: 'scene-units; physicalCalibrationStatus: not-independently-verified; never millimetres',
  };
  /* SHA déterministe global : porte sur le contenu, l'horodatage EXCLU. */
  const deterministicSha = shaOf(manifestCore);
  const manifest = { ...manifestCore, deterministicSha256: deterministicSha,
                     deterministicShaCovers: Object.keys(manifestCore),
                     generatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return { outDir, manifest, payloads, shards };
}

/* ===================== chargement + vérification =========================== */

function capsuleDir(id) { return path.join(CAPSULES_DIR, id); }

/** Charge et vérifie le manifeste ; échoue explicitement à la moindre anomalie. */
function loadManifest(id) {
  const p = path.join(capsuleDir(id), 'manifest.json');
  if (!fs.existsSync(p)) die(`manifeste absent : ${p}`);
  const m = JSON.parse(fs.readFileSync(p));
  if (m.format !== CAPSULE_FORMAT) die(`format inattendu : ${m.format}`);
  if (m.id !== id) die(`id incohérent : ${m.id} != ${id}`);
  const { deterministicSha256, deterministicShaCovers, generatedAt, ...core } = m;
  const recomputed = shaOf(Object.fromEntries(deterministicShaCovers.map(k => [k, core[k]])));
  if (recomputed !== deterministicSha256)
    die(`SHA déterministe faux : ${recomputed} != ${deterministicSha256}`);
  return m;
}

/** Charge tous les rails d'une capsule depuis ses shards, vérifiés. */
function loadRails(id) {
  const m = loadManifest(id);
  const rails = [];
  for (const s of m.shards) {
    const fp = path.join(capsuleDir(id), s.file);
    if (!fs.existsSync(fp)) die(`shard absent : ${s.file}`);
    const buf = fs.readFileSync(fp);
    if (buf.length !== s.bytes) die(`taille shard ${s.file} : ${buf.length} != ${s.bytes}`);
    if (sha256(buf) !== s.sha256) die(`SHA shard ${s.file} incorrect`);
    const lines = buf.toString('utf8').split('\n').filter(Boolean);
    if (lines.length !== s.rails) die(`shard ${s.file} : ${lines.length} rails != ${s.rails}`);
    for (const line of lines) {
      const p = JSON.parse(line);
      if (!p.railInitialState?.sceneRelativeToProfileLocal) die(`rail incomplet : transformation absente`);
      if (!p.chunks?.length) die(`rail incomplet : aucun chunk`);
      const recomputed = shaOf({ key: p.key, target: p.target, railInitialState: p.railInitialState,
        snapshot: p.snapshot, chunkRefs: p.chunkRefs, chunks: p.chunks });
      if (recomputed !== p.payloadSha256) die(`SHA payload rail ${p.key.part}/${p.key.cut} incorrect`);
      rails.push(p);
    }
  }
  if (rails.length !== m.expectedTotal) die(`rails chargés ${rails.length} != ${m.expectedTotal}`);
  return { manifest: m, rails };
}

/* ===================== CLI ================================================= */

function cmdVerify(id) {
  const { manifest, rails } = loadRails(id);
  const fail = rails.filter(r => r.key.cohort === 'failure').length;
  const ctl = rails.filter(r => r.key.cohort === 'control').length;
  if (fail !== manifest.failures) die(`failures ${fail} != ${manifest.failures}`);
  if (ctl !== manifest.controls) die(`controls ${ctl} != ${manifest.controls}`);
  /* les hashes gelés du manifeste doivent correspondre au runtime local */
  for (const [f, want] of Object.entries(manifest.runtimeFrozenHashes)) {
    const got = sha256(fs.readFileSync(path.join(ROOT, f)));
    if (got !== want) die(`runtime ${f} a divergé : ${got} != ${want}`);
  }
  /* étanchéité humaine sur l'ensemble des payloads chargés */
  for (const r of rails) {
    const leaks = findHumanKeys({ railInitialState: r.railInitialState, chunks: r.chunks,
      target: r.target, snapshot: r.snapshot, provenance: r.provenance });
    if (leaks.length) die(`fuite humaine ${r.key.part}/${r.key.cut}: ${leaks.join(', ')}`);
  }
  console.log(JSON.stringify({ ok: true, id, rails: rails.length, failures: fail, controls: ctl,
    shards: manifest.shards.length, deterministicSha256: manifest.deterministicSha256 }, null, 1));
}

function cmdSummary(id) {
  const { manifest, rails } = loadRails(id);
  const byArchive = {}, bySide = {}, bySession = {};
  let points = 0;
  for (const r of rails) {
    byArchive[r.provenance.archive] = (byArchive[r.provenance.archive] || 0) + 1;
    bySide[r.key.side] = (bySide[r.key.side] || 0) + 1;
    bySession[r.key.sessionId] = (bySession[r.key.sessionId] || 0) + 1;
    points += r.provenance.pointsSupplied;
  }
  console.log(JSON.stringify({ id, format: manifest.format, rails: rails.length,
    failures: manifest.failures, controls: manifest.controls, shards: manifest.shards.length,
    totalBytes: manifest.shards.reduce((a, s) => a + s.bytes, 0),
    byArchive, bySide, sessions: Object.keys(bySession).length, pointsTotal: points,
    deterministicSha256: manifest.deterministicSha256 }, null, 1));
}

function cmdPaths(id) {
  const m = loadManifest(id);
  console.log(JSON.stringify({ id, dir: capsuleDir(id),
    manifest: path.join(capsuleDir(id), 'manifest.json'),
    shards: m.shards.map(s => path.join(capsuleDir(id), s.file)) }, null, 1));
}

function main() {
  const [cmd, id] = process.argv.slice(2);
  if (cmd === 'verify') return cmdVerify(id || 'rsf-v1');
  if (cmd === 'summary') return cmdSummary(id || 'rsf-v1');
  if (cmd === 'paths') return cmdPaths(id || 'rsf-v1');
  if (cmd === 'build') {
    const arg = k => { const i = process.argv.indexOf(k); return i === -1 ? undefined : process.argv[i + 1]; };
    const r = buildRsvV1({ identitiesPath: arg('--identities'),
      methodologyCommit: arg('--methodology'), baseCommit: arg('--base') });
    console.log(`capsule écrite : ${path.relative(ROOT, r.outDir)}`);
    console.log(`shards : ${r.shards.length} · rails : ${r.payloads.length}`);
    console.log(`SHA déterministe : ${r.manifest.deterministicSha256}`);
    return;
  }
  console.error('usage : node tools/banane-capsule.cjs <verify|summary|paths> [rsf-v1]');
  console.error('        node tools/banane-capsule.cjs build --identities f.json --methodology <sha> --base <sha>');
  process.exit(2);
}

module.exports = { CAPSULE_FORMAT, FAILURE_REASON, MIN_ROWS_FOR_LINE, HUMAN_KEYS,
                   findHumanKeys, bootstrapPaths, readCorpora, extractRailPayload,
                   captureFromPayload, trace, buildRsvV1, loadManifest, loadRails,
                   frozenHashes, shaOf, sha256, capsuleDir };
if (require.main === module) main();
