'use strict';
/* CH-040 — côté service worker (background.js) : la liste de l'Aurore couvre tous les lots clos du journal, et non plus le bilan de la DERNIÈRE file
 * (02/11, test 31 : la file relancée sur la partie 1 avait masqué la partie 0 et le premier lot de la partie 1). Session fabriquée
 * (tests/helpers/aurore-session.cjs) ; faux adaptateur. Ariane n'envoie ni pose, ni validation, ni SKIP. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { K } = require('./fixtures.cjs'), Settings = require('../src/settings.js'), EC = require('../src/export-cache.js'), CL = require('../src/correction-liste.js');
const { background } = require('./helpers/background-harness.cjs');
const { session } = require('./helpers/aurore-session.cjs');
const ECRITURES = /^(apply|validate|skip|validateInPlace|validerMajEspace|nextWithoutDecision)/;

const FINIE = { finD: 'liste-finie', lignesD: [{ part: 2, cut: 20, statut: 'corrige' }, { part: 2, cut: 21, statut: 'valide' }] };
async function monter(opts = FINIE) {
  const b = background({ globals: { BananeCore3: K, BananeSettings: Settings, BananeExportCache: EC, ArianeCorrectionListe: CL } });
  b.adapter.identity.part = 1; b.adapter.identity.cut = 14;
  b.adapter.ping = async function () { return { version: K.VERSION, pageId: this.identity.pageId, proprietaire: 'test', label: { part: this.identity.part, cut: this.identity.cut, pageId: this.identity.pageId } }; };
  await b.api('connect', { tabId: 1 });
  for (const e of session(opts)) await b.store.putEvent({ eventId: K.uid(), ...e });
  b.fonction(`engine.s.batch=${JSON.stringify({ id: 'C', state: 'COMPLETED', scope: { part: 1 } })}`);
  /* La seconde file (partie 1 seule), arrêtée : son bilan ne porte que le lot C. C'est elle qui masquait tout le reste. */
  b.fonction(`fileP.etat=${JSON.stringify({ id: 'F2', etat: 'arret', parties: [1], bilan: [{ part: 1, lotId: 'C' }] })}`);
  return b;
}
const evts = (b, type) => b.store.events.filter(e => e.type === type);

test('la file relancée ne masque plus les autres lots : parties 0 et 1, trois lots, le lot repris exclu', async () => {
  const b = await monter();
  const v = await b.api('correction-liste');
  assert.deepEqual(v.correction.listes.map(l => [l.partie, l.batchIds]), [[0, ['A']], [1, ['B', 'C']]]);
  assert.deepEqual(v.correction.listes.map(l => l.entrees.length), [3, 4]);
  /* Une `correction-liste` par lot, au format de CH-028 (le lot D, déjà repris, n'est pas réinscrit). */
  assert.deepEqual(evts(b, 'correction-liste').map(e => e.batchId).sort(), ['A', 'B', 'C']);
  const [cv] = evts(b, 'correction-couverture');
  assert.equal(cv.version, CL.VERSION_COUVERTURE);
  assert.deepEqual(cv.comptes, { lots: 4, avantFusion: 10, apresFusion: 9, proposes: 7, lotsExclus: 1, cutsRetires: 0 });
  assert.deepEqual(cv.parties.map(p => [p.partie, p.batchIds, p.cuts]), [[0, ['A'], 3], [1, ['B', 'C'], 4]]);
  assert.deepEqual(cv.exclus.map(x => x.batchId), ['D']);
  await b.api('correction-liste');
  assert.equal(evts(b, 'correction-couverture').length, 1, 'inchangée : pas de doublon');
});

test('la séance Écho et `correction-debut` portent tous les lots ; aucune écriture d’Ariane', async () => {
  const b = await monter();
  await b.api('correction-liste'); await b.api('correction-demarrer');
  assert.deepEqual(b.fonction('engine.s.native.correction.batchIds'), ['A', 'B', 'C']);
  assert.deepEqual(evts(b, 'correction-debut').at(-1).batchIds, ['A', 'B', 'C']);
  assert.equal(b.fonction('engine.s.native.correction.cuts.length'), 7);
  assert.ok(!b.adapter.calls.some(c => ECRITURES.test(c)), b.adapter.calls.join(','));
});

test('« Terminer » à la main avant la fin : rien de traité, donc tout est reproposé (décision du 02/11 : ne rien perdre)', async () => {
  const b = await monter({ avecD: false });
  await b.api('correction-liste'); await b.api('correction-demarrer'); await b.api('correction-terminer');
  const v = await b.api('correction-liste');
  assert.equal(v.correction.etat, 'proposee');
  assert.deepEqual(v.correction.listes.map(l => l.entrees.length), [3, 4]);
});

test('Aurore terminée à la main, un cut traité : seul lui sort ; le lot « liste finie » ne revient pas', async () => {
  const b = await monter({ finD: 'operateur', lignesD: [{ part: 2, cut: 20, statut: 'corrige' }, { part: 2, cut: 21, statut: 'vu' }] });
  const v = await b.api('correction-liste');
  assert.deepEqual(v.correction.listes.map(l => [l.partie, l.entrees.map(e => e.cut)]).at(-1), [2, [21]]);
  const [cv] = evts(b, 'correction-couverture');
  assert.deepEqual(cv.retires.map(x => [x.cut, x.statut, x.fin]), [[20, 'corrige', 'operateur']]);
  const b2 = await monter(FINIE);
  await b2.api('correction-liste'); await b2.api('correction-demarrer');
  b2.fonction("engine.s.correction.etat='terminee'");
  await b2.store.putEvent({ eventId: K.uid(), timestamp: new Date().toISOString(), type: 'correction-fin', correctionId: b2.fonction('engine.s.correction.id'), raison: 'liste-finie', lignes: [] });
  await assert.rejects(b2.api('correction-liste'), /déjà été repris/);
});

test('lots demandés (`batchIds`) : inchangé, ces lots-là, une liste par lot', async () => {
  const b = await monter();
  const v = await b.api('correction-liste', { batchIds: ['C'] });
  assert.deepEqual(v.correction.listes.map(l => [l.partie, l.batchId, l.batchIds]), [[1, 'C', ['C']]]);
  assert.equal(evts(b, 'correction-couverture').length, 0);
});
