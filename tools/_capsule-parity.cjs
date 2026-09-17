'use strict';
/* Preuve de parité RAW ↔ CAPSULE, réutilisable par le test et le rapport.
 * Pour les 239 rails : trace depuis les données Natif brutes ET depuis la
 * capsule, avec le MÊME traceur, puis compare champ par champ. */
const C = require('./banane-capsule.cjs');

const FIELDS = ['exit', 'sign', 'pointsLocal', 'localPointsHash', 'width', 'topAnchors',
  'faceAnchors', 'templateLoss', 'templateLossRatio', 'topRows'];
const near = (a, b) => (a === null || b === null) ? a === b : Math.abs(a - b) <= 0;

function compareTrace(raw, cap) {
  const diffs = [];
  for (const f of FIELDS) {
    const a = raw[f], b = cap[f];
    const ok = typeof a === 'number' ? near(a, b) : JSON.stringify(a) === JSON.stringify(b);
    if (!ok) diffs.push({ field: f, raw: a, capsule: b });
  }
  for (const nested of ['coarseBest', 'refinedBest', 'seed', 'top']) {
    if (JSON.stringify(raw[nested]) !== JSON.stringify(cap[nested]))
      diffs.push({ field: nested, raw: raw[nested], capsule: cap[nested] });
  }
  return diffs;
}

/** Exécute la parité complète. Retourne { total, matched, divergences }. */
function run(id = 'rsf-v1', identitiesPath) {
  const F = require('./flank-support-shadow.cjs');
  const dirs = C.bootstrapPaths();
  /* RAW : index des visites + chunks nécessaires, préchargés une fois */
  const identities = require('fs').existsSync(identitiesPath || '')
    ? JSON.parse(require('fs').readFileSync(identitiesPath)) : null;
  const rawVisits = {};
  for (const [name, dir] of Object.entries(dirs)) {
    const corpus = F.readCorpus(dir);
    const visits = F.readVisitsOf(corpus);
    const byKey = new Map();
    for (const v of visits) byKey.set(`${v.sessionId}|${v.visitId}`, v);
    rawVisits[name] = { corpus, byKey };
  }
  const { rails } = C.loadRails(id);

  const readChunks = (corpus, needed) => {
    const out = new Map(), fs = require('fs'), path = require('path');
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
  };
  /* précharge tous les chunks RAW nécessaires, par corpus */
  const neededByCorpus = { 'historical-original': new Set(), 'final-complementary': new Set() };
  for (const r of rails) for (const cid of r.chunkRefs) neededByCorpus[r.key.corpus].add(cid);
  const rawChunks = {};
  for (const [name, s] of Object.entries(rawVisits))
    rawChunks[name] = readChunks(s.corpus, neededByCorpus[name]);

  const divergences = [];
  let matched = 0;
  for (const r of rails) {
    const side = r.key.side;
    /* capture depuis la CAPSULE */
    const capCapture = C.captureFromPayload(r);
    const capTrace = C.trace(capCapture, side);
    /* capture depuis le RAW, reconstruite comme replayRailExact */
    const v = rawVisits[r.key.corpus].byKey.get(`${r.key.sessionId}|${r.key.visitId}`);
    const el = v.geometryEligibility[side];
    const pts = [], vis = [];
    for (const cid of el.chunkIds) {
      const c = rawChunks[r.key.corpus].get(cid);
      for (let i = 0; i < c.points.length; i++) { pts.push(c.points[i]); vis.push(c.visible ? c.visible[i] : true); }
    }
    const snap = v.railSnapshots[side].find(s => s.snapshotId === el.snapshotId);
    const rawCapture = { rails: { [side]: snap.rail }, pointsSceneRelative: pts, visibleByClipBoxes: vis };
    const rawTrace = C.trace(rawCapture, side);
    const diffs = compareTrace(rawTrace, capTrace);
    /* confirmation d'identité contre RSF publié, quand fourni (jamais payload) */
    let identityOk = true;
    if (identities) {
      const idRow = identities.find(x => x.corpus === r.key.corpus && x.part === r.key.part
        && x.cut === r.key.cut && x.side === side);
      if (idRow && idRow.cohort === 'failure' && rawTrace.exit !== C.FAILURE_REASON) identityOk = false;
      if (idRow && idRow.cohort === 'control' && rawTrace.exit !== 'au-dela-du-point-etudie') identityOk = false;
    }
    if (diffs.length === 0 && identityOk) matched++;
    else divergences.push({ key: `${r.key.corpus}:${r.key.part}/${r.key.cut}/${side}`,
      cohort: r.key.cohort, diffs, identityOk, rawExit: rawTrace.exit });
  }
  return { total: rails.length, matched, divergences };
}

module.exports = { run, compareTrace, FIELDS };
if (require.main === module) {
  const r = run('rsf-v1', process.argv[2]);
  console.log(JSON.stringify({ total: r.total, matched: r.matched,
    divergences: r.divergences.length, detail: r.divergences.slice(0, 20) }, null, 1));
  if (r.matched !== r.total) { console.error('PARITÉ INCOMPLÈTE'); process.exit(1); }
}
