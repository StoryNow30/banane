'use strict';
/* CH-053-C : chantiers/CH-053/causes-etat-initial.cjs et taux-apprenables --assouplie, sur une session SYNTHÉTIQUE de forme réelle. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { causes } = require('../chantiers/CH-053/causes-etat-initial.cjs');
const { mesurer, entreesEcho } = require('../tools/taux-apprenables.cjs');

const ID = p => ({ pageId: 'p', part: 90, cut: p, shape: 'U50', frameId: 'f', projectId: null });
const mat = (x, y, z) => [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1];
const rail = (x, y = 0) => ({ positionSceneRelative: [x, y, 0], railLocalToSceneRelative: mat(x, y, 0), profileLocalToSceneRelative: mat(x, y, 0), sceneRelativeToProfileLocal: mat(-x, -y, 0) });
const T0 = Date.UTC(2031, 4, 1, 8, 0, 0), iso = s => new Date(T0 + s * 1000).toISOString();
const snap = (cut, side, cap, r, o = {}) => ({ format: 'banane-native-rail-snapshot-v1', snapshotId: `${cap}:${side}:0`, captureId: cap, side, identity: ID(cut), chunkIds: [`${cap}:${side}:0`],
  rail: r, viewObservation: { viewEpochId: 'e' }, coordinateSystem: { name: 'scene-relative', units: 'metres-observed-not-independently-calibrated', frameId: 'f' },
  acquisitionStartedAt: iso(cut * 20 + (o.fin ?? 1)), acquiredThroughAt: iso(cut * 20 + (o.fin ?? 1)), emittedAt: iso(1), storedAt: iso(1), sourceStatus: 'reference-version-and-matrix-stable-through-checkpoint',
  clipStatus: o.clip || 'verified-classifiable', transform: { valid: true }, associationStatus: 'same-target-and-rail-pose', criteriaVersion: 'native-visible-roi-v1',
  coverage: { status: 'qualified-candidate', pointsInRoi: 300 }, qualificationStatus: 'qualified-candidate', exclusionReasons: [], receiptEventSeq: 5 });
const cap = (id, fin) => ({ captureId: id, startedAt: iso(0), termination: fin ? { code: fin } : null });
/* Cut : premiereFin = fin de la 1re capture ; la capture tardive porte les instantanés (pose déplacée si `deplace`). */
function visite(cut, { premiereFin = null, tardive = false, deplace = false, intentAt = 5, strict = false } = {}) {
  const l = rail(0), r = rail(1.435), a = `a${cut}`, b = `b${cut}`;
  const sn = { left: [], right: [] };
  const poseT = deplace ? [rail(.02), rail(1.455)] : [l, r];
  if (strict) { sn.left.push(snap(cut, 'left', a, l)); sn.right.push(snap(cut, 'right', a, r)); }
  else if (tardive) { sn.left.push(snap(cut, 'left', b, poseT[0], { fin: 2 })); sn.right.push(snap(cut, 'right', b, poseT[1], { fin: 2 })); }
  const eligibilite = s => strict ? { status: 'comparable-candidate', captureId: a, chunkIds: [`${a}:${s}:0`], reasons: [] } : { status: 'excluded', captureId: null, chunkIds: [], reasons: ['capture-used-a-different-rail-pose-than-initial-state'] };
  return { version: '4.9.0.18', recordId: `v${cut}`, visitId: `v${cut}`, visitIndex: cut, identity: ID(cut), startedAt: iso(cut * 20), endedAt: iso(cut * 20 + 6),
    beforeEstablished: { identity: ID(cut), rails: { left: l, right: r } }, startPose: null, railSnapshots: sn,
    geometryCaptures: { [a]: cap(a, premiereFin), ...(tardive ? { [b]: cap(b, null) } : {}) },
    operatorIntents: [{ intent: 'VALIDATE', observedAt: iso(cut * 20 + intentAt) }],
    humanFinalReference: { state: { rails: { left: rail(.004), right: rail(1.439) } } }, geometryEligibility: { left: eligibilite('left'), right: eligibilite('right'), pair: {} } };
}
const nuage = (id, clip, cx = 0) => ({ captureId: id, chunkId: id, startedAt: iso(0), completedAt: iso(1), clouds: [{ clipping: clip }],
  pointsSceneRelative: Array.from({ length: 300 }, (_, i) => [cx - .5 + i / 300, 0, -.02]), visibleByClipBoxes: Array(300).fill(true) });
function session(records) {
  const clouds = [];
  for (const r of records) { for (const s of ['left', 'right']) for (const sn of r.railSnapshots[s]) clouds.push({ ...nuage(sn.snapshotId, 'X', sn.rail.positionSceneRelative[0]), captureId: sn.snapshotId, chunkId: sn.snapshotId });
    for (const c of Object.values(r.geometryCaptures)) clouds.push({ captureId: c.captureId, startedAt: iso(0), completedAt: iso(1), termination: c.termination, clouds: [{ clipping: 'X' }] }); }
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cause-'));
  fs.writeFileSync(path.join(d, 'ariane-echo-seg01.json'), JSON.stringify({ format: 'banane-native-session-v2', session: { id: 's', cloudIds: clouds.map(c => c.chunkId || c.captureId) }, segment: { index: 1, stamp: 's' }, records, clouds }));
  return entreesEcho([d]);
}

test('causes : ventilation par fin de la 1re capture et cuts récupérables par voie', () => {
  const e = session([
    visite(1, { strict: true }),
    visite(2, { premiereFin: 'CLIP_CHANGED', tardive: true, intentAt: 1 }),                 // instantané tardif, même pose, après le geste
    visite(3, { premiereFin: 'RAIL_STATE_CHANGED', tardive: true, deplace: true, intentAt: 1 }),  // rail déplacé de 20 mm
    visite(4, { premiereFin: 'RESOURCE_LIMIT' }),                                            // rien à récupérer
  ]);
  const r = causes(e);
  assert.equal(r.cutsValides, 4); assert.equal(r.qualifiesStricts, 1); assert.equal(r.nonQualifies, 3);
  assert.deepEqual(r.parCause, { CLIP_CHANGED: 1, RAIL_STATE_CHANGED: 1, RESOURCE_LIMIT: 1 });
  assert.equal(r.avecCaptureTardiveQualifiee, 2); assert.equal(r.recuperables, 2);
  assert.deepEqual(r.parVoie, { 'instantane-meme-pose+instantane-meme-pose': 1, 'instantane-pose-differente+instantane-pose-differente': 1 });
  assert.equal(r.tauxStrictPct, 25); assert.equal(r.tauxAssoupliPct, 75);
});
test('taux-apprenables --assouplie : strict inchangé, assoupli plus haut, accord et parité', () => {
  const e = session([visite(1, { strict: true }), visite(2, { premiereFin: 'CLIP_CHANGED', tardive: true, intentAt: 1 }), visite(3, { premiereFin: 'TARGET_CHANGED' })]);
  const strict = mesurer(e), ass = mesurer(e, { assouplie: true });
  assert.equal(strict.cutsApprenables, 1); assert.equal(ass.cutsApprenables, 1);        // la mesure stricte ne bouge pas
  assert.equal(ass.assouplie.cutsApprenablesAssouplie, 2); assert.equal(ass.assouplie.gainParRapportAuStrict, 1);
  assert.deepEqual(ass.assouplie.accord, { cutsStrictsComparables: 1, memeEtiquette: 1, stricteRelueEgaleExportee: 3, cutsTotal: 3 });
  assert.equal(strict.assouplie, undefined);
});
