'use strict';
/* CH-063 : outils de mesure (niveau de détail suffisant, attente et réseau). Données synthétiques, aucune donnée de terrain. */
const test = require('node:test'), assert = require('node:assert/strict');
const N = require('../tools/ch063-niveau-detail.cjs'), A = require('../tools/ch063-attente-reseau.cjs');
const boite = (cote) => ({ min: [0, 0, 0], max: [cote, cote, cote] });
const capture = () => ({ identity: { part: 1, cut: 2 }, rails: {},
  nodes: [{ reportedPotreeGeometryNodeBoundingBox: boite(64) }, { reportedPotreeGeometryNodeBoundingBox: boite(32) }, { reportedPotreeGeometryNodeBoundingBox: boite(8) }],
  pointsSceneRelative: [[0, 0, 0], [1, 1, 1], [2, 2, 2], [3, 3, 3]], pointSources: [[0, 5], [1, 1], [2, 0], [2, 3]], visibleByClipBoxes: [true, false, true, true] });

test('le niveau d\'un nœud se lit dans sa boîte (racine / 2^n) ; une boîte non conforme est illisible', () => {
  assert.deepEqual(N.niveauxDesNoeuds(capture()), [0, 1, 3]);
  const c = capture(); c.nodes[2].reportedPotreeGeometryNodeBoundingBox = boite(10);
  assert.deepEqual(N.niveauxDesNoeuds(c), [0, 1, null]);
  assert.deepEqual(N.niveauxDesPoints(capture()), [0, 1, 3, 3]);
});
test('la coupe garde exactement les points de niveau ≤ L, dans l\'ordre, avec leur visibilité ; un niveau inconnu refuse la coupe', () => {
  const c = capture(), nv = N.niveauxDesPoints(c), k = N.couper(c, nv, 1);
  assert.deepEqual(k.pointsSceneRelative, [[0, 0, 0], [1, 1, 1]]);
  assert.deepEqual(k.visibleByClipBoxes, [true, false]);
  assert.equal(N.couper(c, nv, 3).pointsSceneRelative.length, 4);
  assert.equal(N.couper(c, [0, 1, null, 3], 3), null);
});
test('deux poses ne sont identiques que si statut, confiance et décalage sont égaux au bit près', () => {
  const p = (d, st = 'candidate', cf = 50) => ({ left: { statut: st, confiance: cf, delta: [0, d, 0] }, right: { statut: st, confiance: cf, delta: [0, 0, 0] } });
  assert.equal(N.comparer(p(0.01), p(0.01)).identique, true);
  const r = N.comparer(p(0.01), p(0.0103));
  assert.equal(r.identique, false); assert.ok(Math.abs(r.mmMax - 0.3) < 1e-9);
  assert.equal(N.comparer(p(0.01), p(0.01, 'rejected')).statut, false);
  assert.equal(N.comparer(p(0.01), p(0.01, 'candidate', 49)).identique, false);
  assert.equal(N.comparer(p(0.01), { erreur: 'x' }).identique, false);
});
test('temps en vol : union des empans coupée à la fenêtre d\'attente', () => {
  const R = [{ a: 0, b: 100 }, { a: 50, b: 150 }, { a: 300, b: 400 }, { a: 900, b: 1200 }];
  assert.equal(A.enVol(R, 0, 1000), 150 + 100 + 100);
  assert.equal(A.enVol(R, 120, 350), 30 + 50);
  assert.equal(A.enVol([], 0, 10), 0);
  assert.equal(A.dans(R, 140, 310).length, 2);
});
test('captures : une capture lue rail par rail, le lot et la relecture séparés, le silence après le dernier octet', () => {
  const t = x => new Date(Date.UTC(2026, 10, 5, 8, 0, 0) + x).toISOString(), E = (x, st, d) => ({ type: 'adapter-progress', action: 'capture', requestId: 'r', timestamp: t(x), lastStage: st, lastDetail: d });
  const ev = [E(10, 'capture-wait', { side: 'left' }), E(500, 'capture-read', { side: 'left', regle: 'signal', lecture: 'rapide' }), E(510, 'capture-view-ready', { side: 'left' }),
    E(520, 'capture-wait', { side: 'right' }), E(1500, 'capture-read', { side: 'right', regle: 'stabilite', lecture: 'rapide' }), E(1510, 'capture-view-ready', { side: 'right' }),
    { type: 'adapter-result', action: 'capture', requestId: 'r', timestamp: t(1520), demandeA: t(0), error: null },
    { type: 'esv-observation', class: 'point-resource', n: 2, bytes: 10, startedEpochMs: Date.parse(t(100)), endedEpochMs: Date.parse(t(300)) },
    { type: 'relecture-debut', timestamp: t(5000) }];
  const L = A.analyser({ events: ev });
  assert.equal(L.length, 1); assert.equal(L[0].relecture, false);
  assert.equal(L[0].rails.left.attenteMs, 490); assert.equal(L[0].rails.left.requetes, 2); assert.equal(L[0].rails.left.enVolMs, 200);
  assert.equal(L[0].rails.left.silenceApresReseauMs, 200);
  assert.equal(L[0].rails.right.requetes, 0); assert.equal(L[0].rails.right.silenceApresReseauMs, 980);
  const G = A.agreger(L);
  assert.equal(G.lot.captures, 1); assert.equal(G.relecture.captures, 0);
  assert.equal(G.lot.partDeLAttenteEnVol, Math.round(1000 * 200 / 1470) / 10);
});
test('agrégat : relu depuis le JSON, un décalage absent d\'un côté ne passe jamais pour « sous le millimètre »', () => {
  const p = d => ({ left: { statut: 'candidate', confiance: 1, delta: d }, right: { statut: 'candidate', confiance: 1, delta: [0, 0, 0] } });
  const c = JSON.parse(JSON.stringify(N.comparer(p([0, 0, 0]), p(null))));
  assert.equal(c.identique, false); assert.equal(c.mmMax, null);
  const L = [{ lisible: true, max: 3, points: 4, candidat: true, coupes: { 1: { points: 1, ...c } } },
    { lisible: true, max: 3, points: 4, candidat: true, coupes: { 1: { points: 1, ...N.comparer(p([0, 0.002, 0]), p([0, 0, 0])) } } }];
  const A = N.agreger(JSON.parse(JSON.stringify(L)), [1]).coupes[1];
  assert.deepEqual([A.identiques, A.differentes, A.memeStatutSousDemiMm, A.memeStatutAu1mmOuPlus, A.candidatsIdentiques], [0, 2, 0, 1, 0]);
});
