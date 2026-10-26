'use strict';
/* Garde A de la deuxième passe (src/garde-passe-appuis.js, fiches/GARDE_PASSE_A.md) BRANCHÉE dans le banc (tools/banc-differes.cjs), comme dans le service worker.
 * Lot SYNTHÉTIQUE (partie 91, cuts 1 à 8, captures de tests/helpers/gcv2-jeu-fixture.cjs) : la chaîne normale pose 1 et 8 ; 2 à 7 n'ont pas de rail droit (différés par la
 * chaîne). Dans le lot, la GCV2 est forcée à poser le 2 (pose de la GCV2 dans le lot). Pendant la passe seulement (le 8 est voisin), elle est forcée à « valider » les cuts
 * 3 et 4 à 10 mm du départ ; la caméra des captures synthétiques est inconnue, la commande de ces poses forcées est acceptée « dans la vue ». Aucune donnée de terrain. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const B = require('../tools/banc-differes.cjs');
const L1 = require('../src/gcv2-l1.js');
const F = require('./helpers/gcv2-jeu-fixture.cjs');
const SIDES = ['left', 'right'];
const PARAMS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datasets', 'gcv2-parametres-h6.json'), 'utf8'));
const T0 = Date.UTC(2031, 4, 1, 8, 0, 0), iso = s => new Date(T0 + s * 1000).toISOString();
const ORIGINE = [458559.4, 6699187.6, 24.0];
const CUTS = [1, 2, 3, 4, 5, 6, 7, 8], VALIDES = [1, 8];
const capDe = cut => { const c = F.capture({ cut, graine: 10 + cut, origine: [ORIGINE[0] + cut, ORIGINE[1], ORIGINE[2]] });
  const pts = VALIDES.includes(cut) ? c.pointsSceneRelative : c.pointsSceneRelative.filter(p => Math.abs(p[1] - ORIGINE[1]) < 0.5);
  return { rails: c.rails, pointsSceneRelative: pts, visibleByClipBoxes: pts.map(() => true), camera: null, viewCaptures: [] }; };
const CAPTURES = new Map(CUTS.map(c => [`cap-${c}`, capDe(c)]));
function journal() {
  const events = [{ eventId: 'b0', timestamp: iso(1), type: 'batch-started', batch: { id: 'lot-a-0000', scope: { part: 91, start: 1, end: 8, extensionVersion: '9.9.9' } } }], records = [];
  for (const cut of CUTS) {
    const valide = VALIDES.includes(cut), t = 10 * cut;
    events.push({ eventId: `d-${cut}`, timestamp: iso(t), type: 'gcv1-shadow-observed', identity: { part: 91, cut, frameId: 'cadre' }, batchId: 'lot-a-0000', lidarCaptureId: `cap-${cut}`,
      lotObservation: { stage: valide ? 'first-pass' : 'deferred', reason: valide ? null : 'no-anchor', anchorsUsed: [], anchor: valide, anchorHeld: valide, command: { action: 'engine', reason: valide ? 'first-pass' : 'deferred' } } });
    if (!valide) continue;
    events.push({ eventId: `v-${cut}`, timestamp: iso(t + 2), type: 'validation-accepted', batchId: 'lot-a-0000', identity: { part: 91, cut } });
    const cap = CAPTURES.get(`cap-${cut}`);
    records.push({ identity: { part: 91, cut }, capturedAt: iso(t + 1), rails: Object.fromEntries(SIDES.map(s => [s, { initial: cap.rails[s], corrected: { positionSceneRelative: cap.rails[s].positionSceneRelative.slice() } }])) });
  }
  return { events, records };
}
const PAIRE = { left: { decal: [0, 10, 0] }, right: { decal: [0, 10, 0] } };
function rejouer(gardeAppuis, { env = null } = {}) {
  const decider = L1.deciderDiffere, commander = L1.commander, sauve = { l: process.env.BANC_LEVIERS, g: process.env.BANC_GARDE_APPUIS };
  let force = false;
  process.env.BANC_LEVIERS = JSON.stringify({ deuxiemePasse: 2, transport: true });
  if (env !== null) process.env.BANC_GARDE_APPUIS = env; else delete process.env.BANC_GARDE_APPUIS;
  L1.commander = o => { const c = commander(o); if (!force) return c; force = false; return { ...c, action: 'lot', vue: null }; };
  L1.deciderDiffere = a => { const r = decider(a), cut = a.capture.identity.cut, enPasse = (a.voisins || []).some(v => v.identity.cut === 8);
    if (!(cut === 2 && !enPasse) && !([3, 4].includes(cut) && enPasse)) return r;
    force = true;
    return { ...r, decision: { ...r.decision, etat: 'valider', motif: null, p: 0.9, paire: PAIRE, hypothese: 'H1', ecartDepartMm: 10 }, positions: L1.positionsDe(a.capture, PAIRE) }; };
  try { return B.rejouerLot({ journal: journal(), captures: CAPTURES, projet: 9, partie: 91, lotId: 'lot-a', parametres: PARAMS, profils: ['L1-se'], gardeAppuis }); }
  finally {
    L1.deciderDiffere = decider; L1.commander = commander;
    for (const [k, v] of [['BANC_LEVIERS', sauve.l], ['BANC_GARDE_APPUIS', sauve.g]]) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}
const cut = (r, c) => r.find(l => l.cut === c).profils['L1-se'];

test('banc, garde livrée : la pose de la passe à 10 mm du départ passe si la chaîne normale est à 4 cuts ou moins ; l’en-tête consigne la garde', () => {
  const r = rejouer();
  assert.deepEqual(r[0].l1e.gardeAppuis, { actif: true, deplacementMaxMm: 100, appuiNormalMaxCuts: 4 });
  assert.equal(cut(r, 2).etat, 'pose'); assert.equal(cut(r, 2).source, 'gcv2'); assert.equal(cut(r, 2).passe2, undefined, 'le 2 : GCV2 dans le lot');
  assert.equal(cut(r, 3).etat, 'pose'); assert.deepEqual(cut(r, 3).passe2, { passe: 1, garde: { bloque: false, motif: 'appui-normal', deplacementMm: 10, appuiNormalCuts: 2 } });
  assert.equal(cut(r, 4).etat, 'pose'); assert.deepEqual(cut(r, 4).passe2.garde, { bloque: false, motif: 'appui-normal', deplacementMm: 10, appuiNormalCuts: 3 });
});

test('banc : ni la pose de la GCV2 dans le lot (2) ni celle de la passe (3) ne sont des appuis ; 4 est refusé (chaîne normale à 3 cuts > 2), aux deux passes', () => {
  const r = rejouer({ appuiNormalMaxCuts: 2 });
  assert.equal(cut(r, 3).etat, 'pose', '3 : la chaîne normale (1) à 2 cuts');
  const q = cut(r, 4);
  assert.equal(q.etat, 'differe'); assert.equal(q.decal, undefined);
  assert.deepEqual(q.passe2, { passe: 2, motif: 'garde-appuis', garde: { bloque: true, motif: 'garde-appuis', deplacementMm: 10, appuiNormalCuts: 3 } }, 'redécidé à la passe 2 (la passe 1 a posé le 3), refusé encore');
  /* Garde coupée : la même pose passe. */
  const c = rejouer(false);
  assert.equal(cut(c, 4).etat, 'pose'); assert.equal(cut(c, 4).passe2.garde.motif, 'garde-coupee');
  assert.deepEqual(c[0].l1e.gardeAppuis, { actif: false, deplacementMaxMm: 100, appuiNormalMaxCuts: 4 });
});

test('banc : réglage par BANC_GARDE_APPUIS (mesure seulement) ; illisible : erreur ; la garde ne touche pas la colonne sans passe', () => {
  const r = rejouer(undefined, { env: JSON.stringify({ deplacementMaxMm: 5 }) });
  assert.deepEqual(r[0].l1e.gardeAppuis, { actif: true, deplacementMaxMm: 5, appuiNormalMaxCuts: 4 });
  assert.equal(cut(r, 4).passe2.garde.motif, 'loin-du-depart');
  assert.throws(() => rejouer({ appuiNormalMaxCuts: -1 }), /garde des appuis de la passe : gardeAppuis\.appuiNormalMaxCuts illisible/);
  assert.throws(() => rejouer(undefined, { env: '"oui"' }), /gardeAppuis illisible/);
  /* Le lot (avant la passe) est le même avec ou sans garde. */
  const a = rejouer(), b = rejouer({ appuiNormalMaxCuts: 0 });
  for (const c of [1, 2, 5, 6, 7, 8]) assert.deepEqual({ ...cut(a, c), passe2: null }, { ...cut(b, c), passe2: null }, 'cut ' + c);
});
