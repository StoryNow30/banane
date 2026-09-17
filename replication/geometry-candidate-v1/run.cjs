#!/usr/bin/env node
'use strict';
/* Geometry Candidate V1 — replay capsule.
 * Utilise UNIQUEMENT les copies pinned/ (octet-identiques à 0dbcb7a).
 * N’écrit aucun oracle. N’exige aucun compte de recoveries. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CAPSULE = __dirname;
const PINNED = path.join(CAPSULE, 'pinned');
const SHA = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const shaFile = (p) => SHA(fs.readFileSync(p));

const Next = require('./pinned/tools/geometry-engine-next-v0.cjs');
const N = require('./pinned/tools/materialized-native.cjs');
const FAA = require('./pinned/tools/face-aware-arbitration-v1.cjs');
const G = require('./pinned/src/geometry.js');
const B = require('./pinned/src/geometry-baseline.js');
const CONFIG = JSON.parse(fs.readFileSync(path.join(CAPSULE, 'candidate-v1-config.json'), 'utf8'));

function parseArgs(argv) {
  const out = { dataset: null, output: path.join(process.cwd(), 'geometry-candidate-v1-replay.json'), hashOnly: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dataset') out.dataset = argv[++i];
    else if (a === '--out' || a === '--output') out.output = path.resolve(argv[++i]);
    else if (a === '--hash-only') out.hashOnly = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw Error('argument inconnu : ' + a);
  }
  return out;
}

function listPinned() {
  const files = [];
  function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) files.push({ rel: 'pinned/' + r, sha256: shaFile(p), bytes: fs.statSync(p).size });
    }
  }
  walk(PINNED, '');
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  return files;
}

function assertContracts() {
  const geometry = shaFile(path.join(PINNED, 'src/geometry.js'));
  const baseline = shaFile(path.join(PINNED, 'src/geometry-baseline.js'));
  const aStar = FAA.assertAStarFrozen();
  const blockers = [];
  if (geometry !== CONFIG.geometrySha256) blockers.push('geometry.js');
  if (baseline !== CONFIG.baselineSha256) blockers.push('geometry-baseline.js');
  if (aStar !== CONFIG.composition.aStar.hash) blockers.push('A_STAR_HASH');
  if (Next.COMPOSITION_HASH !== CONFIG.compositionHash) blockers.push('COMPOSITION_HASH');
  if (G.DEFAULTS.searchY !== 0.08 || G.DEFAULTS.searchZ !== 0.04) blockers.push('searchY/Z');
  if (G.DEFAULTS.minTop !== 15 || G.DEFAULTS.minFace !== 6) blockers.push('minTop/minFace');
  if (G.DEFAULTS.minTemplateLossRatio !== 1.5) blockers.push('ratio');
  if (JSON.stringify(G.DEFAULTS) !== JSON.stringify(B.DEFAULTS)) blockers.push('baseline≠engine');
  if (blockers.length) throw Error('contrat Candidate V1 rompu : ' + blockers.join(', '));
  return { geometry, baseline, aStar, composition: Next.COMPOSITION_HASH };
}

function compactPub(p) {
  if (!p) return null;
  return {
    status: p.status || null,
    motif: p.motif || null,
    reason: p.reason || null,
    delta: p.delta || null,
    loss: p.loss ?? null,
    topRows: p.topRows ?? null,
    faceCount: p.faceCount ?? null,
    slopeLimited: !!p.slopeLimited,
  };
}

function railOut(r) {
  return {
    key: r.key,
    sessionId: r.sessionId,
    visitIndex: r.visitIndex,
    part: r.part,
    cut: r.cut,
    side: r.side,
    cohort: r.role === 'control' ? 'control' : (r.role === 'failure' ? 'failure' : r.role),
    ok: !!r.ok,
    skipReasons: r.skipReasons || [],
    v46: compactPub(r.engine),
    astar: compactPub(r.astar),
    next: compactPub(r.next) && {
      ...compactPub(r.next),
      activated: !!r.next.activated,
      changed: !!r.next.changed,
      nClusters: r.next.nClusters ?? null,
      nStrongCompetitive: r.next.nStrongCompetitive ?? null,
    },
    alreadyQualified: !!r.alreadyQualified,
    s1Activated: !!r.s1Activated,
    s1Changed: !!r.s1Changed,
    publishedWeak: !!r.publishedWeak,
    classV46Next: r.classV46Next || null,
    classV46Astar: r.classV46Astar || null,
    attribution: r.attribution || null,
    frame: r.frame ? { sign: r.frame.sign, width: r.frame.width, pointsLocal: r.frame.pointsLocal, uMedian: r.frame.uMedian, uSeed: r.frame.uSeed } : null,
    competitive: r.competitive || null,
  };
}

function stableStringify(obj) {
  return JSON.stringify(obj) + '\n';
}

function replay(dataset, output) {
  const hashes = assertContracts();
  const lock = Next.loadLock239();
  if (lock.n !== 239) throw Error('lock ≠ 239');
  const keys = [...lock.failureKeys, ...lock.controlKeys];
  if (keys.length !== 239) throw Error('clés lock ≠ 239');
  if (!dataset || !fs.existsSync(dataset)) {
    const err = new Error('dataset introuvable : ' + dataset);
    err.code = 'DATASET_MISSING';
    throw err;
  }
  const { base, docs, visits } = N.readVisits(dataset);
  const pack = Next.assembleKeys(visits, keys, docs, base);
  const nReady = pack.rails.filter((r) => r.assembled?.ready).length;
  if (nReady !== 239) {
    const missing = pack.rails.filter((r) => !r.assembled?.ready).map((r) => r.key);
    const err = new Error('population assemblée ' + nReady + '/239 — STOP');
    err.code = 'POPULATION_NOT_239';
    err.missing = missing;
    throw err;
  }
  const rows = [];
  for (const item of pack.rails) {
    const role = lock.failureKeys.includes(item.key) ? 'failure' : 'control';
    rows.push(railOut(Next.analyseAssembled(item, role)));
  }
  rows.sort((a, b) => a.key.localeCompare(b.key));
  const report = {
    format: 'geometry-candidate-v1-replay',
    candidate: {
      id: 'GEOMETRY_CANDIDATE_V1',
      sourceTip: CONFIG.source.tip,
      compositionHash: hashes.composition,
      aStarHash: hashes.aStar,
      geometrySha256: hashes.geometry,
      baselineSha256: hashes.baseline,
    },
    dataset: {
      repo: CONFIG.dataset.repo,
      branch: CONFIG.dataset.branch,
      head: CONFIG.dataset.head,
      path: CONFIG.dataset.path,
      resolved: path.resolve(dataset),
    },
    lock: { n: 239, failures: lock.failureKeys.length, controls: lock.controlKeys.length, assembled: nReady, chunksLoaded: pack.chunksLoaded, chunksNeeded: pack.chunksNeeded },
    counts: {
      n: rows.length,
      v46Candidate: rows.filter((r) => r.v46?.status === 'candidate').length,
      nextCandidate: rows.filter((r) => r.next?.status === 'candidate').length,
      s1Changed: rows.filter((r) => r.s1Changed).length,
      publishedWeak: rows.filter((r) => r.publishedWeak).length,
    },
    rails: rows,
  };
  const text = stableStringify(report);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, text);
  return { output, sha256: SHA(Buffer.from(text)), n: rows.length, assembled: nReady };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write('node replication/geometry-candidate-v1/run.cjs --dataset <materialized-dataset> [--out file.json]\n');
    return;
  }
  const hashes = assertContracts();
  if (args.hashOnly) {
    const pinned = listPinned();
    process.stdout.write(JSON.stringify({ ok: true, hashes, pinned }, null, 2) + '\n');
    return;
  }
  if (!args.dataset) throw Error('manque --dataset');
  const t0 = Date.now();
  const r = replay(args.dataset, args.output);
  process.stderr.write(`replay ${r.n}/239 sha=${r.sha256} ${Date.now() - t0} ms -> ${r.output}\n`);
}

if (require.main === module) {
  try { main(); }
  catch (e) {
    process.stderr.write(String(e.message || e) + '\n');
    process.exit(e.code === 'POPULATION_NOT_239' || e.code === 'DATASET_MISSING' ? 2 : 1);
  }
}

module.exports = { parseArgs, assertContracts, listPinned, replay, shaFile, CAPSULE, PINNED, CONFIG };
