'use strict';
/* CH-037 (défaut 2, test 30) — LE DERNIER CUT VALIDÉ RESTAIT AFFICHÉ NON VALIDÉ. Côté service worker (background.js) avec la VRAIE séance Écho
 * (src/native-session.js, événements natifs fabriqués) : le libellé d'une visite n'était posé qu'à sa clôture ; une visite perdue avec la page (changement
 * de partie par l'opérateur : `pageLost`) n'en recevait jamais. Ici : la visite OUVERTE validée (Maj+Espace observé) compte tout de suite, la visite
 * perdue avec la page aussi, un cut revisité garde son résultat le plus fort ; l'écran (src/ui5.js), la fin « liste finie » et `correction-fin` portent
 * le même résultat. Données fabriquées (forme des cuts 9748 et 3250 du 01/11, numéros ramenés au journal fabriqué). Ariane n'écrit rien dans ESV. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { K } = require('./fixtures.cjs'), Settings = require('../src/settings.js'), EC = require('../src/export-cache.js'), CL = require('../src/correction-liste.js');
const { background } = require('./helpers/background-harness.cjs');
const { journal } = require('./helpers/correction-journal.cjs');
const esv = { id: 'test', url: require('../manifest.json').host_permissions[0].replace(/\*$/, '') + 'test', tab: { id: 1 } };
const ECRITURES = /^(apply|validate|skip|validateInPlace|validerMajEspace|nextWithoutDecision)/;

async function monter() {
  const b = background({ globals: { BananeCore3: K, BananeSettings: Settings, BananeExportCache: EC, ArianeCorrectionListe: CL } });
  b.adapter.identity.part = 5; b.adapter.identity.cut = 10;
  b.adapter.ping = async function () { return { version: K.VERSION, pageId: this.identity.pageId, proprietaire: 'test', label: { part: this.identity.part, cut: this.identity.cut, pageId: this.identity.pageId } }; };
  await b.api('connect', { tabId: 1 });
  for (const e of journal()) await b.store.putEvent({ eventId: K.uid(), ...e });
  b.fonction(`engine.s.batch=${JSON.stringify({ id: 'B1', state: 'COMPLETED', scope: { part: 5 } })}`);
  await b.api('correction-liste'); await b.api('correction-demarrer');
  let k = 0;
  const ctx = () => ({ sessionId: b.fonction('engine.s.native.id'), observationPeriodId: b.fonction('engine.s.native.currentPeriodId') });
  const etat = async cut => { const st = await b.adapter.state(); st.identity.cut = cut; return st; };
  const ouvrir = async (cut, id = 'v' + cut + '-' + (++k)) => { const st = await etat(cut); await b.message({ kind: 'native-event', type: 'visit-started', payload: { ...ctx(), visitId: id, identity: st.identity, initialObserved: st } }, esv); return { id, st }; };
  const bouger = (st, mm) => ({ ...K.clone(st), rails: K.expectedPoses(st, { left: { delta: [0, mm / 1000, 0] }, right: { delta: [0, mm / 1000, 0] } }), capturedAt: new Date().toISOString() });
  const valider = async ({ id, st }, avant = st) => {
    await b.message({ kind: 'native-event', type: 'operator-event', payload: { ...ctx(), visitId: id, identity: st.identity, stateObservedBeforeInput: st, event: { type: 'keydown', key: 'a', observedAt: new Date().toISOString() } } }, esv);
    if (avant !== st) await b.message({ kind: 'native-event', type: 'state-observed', payload: { ...ctx(), visitId: id, identity: st.identity, state: avant, trigger: 'poll', effect: { kind: 'rail-state-changed' } } }, esv);
    await b.message({ kind: 'native-event', type: 'operator-event', payload: { ...ctx(), visitId: id, identity: st.identity, stateObservedBeforeInput: avant, event: { type: 'keydown', intent: 'VALIDATE', decisionKey: 'Shift+Space', observedAt: new Date().toISOString() } } }, esv); };
  const fermer = async ({ id, st }) => b.message({ kind: 'native-event', type: 'visit-ended', payload: { ...ctx(), visitId: id, identity: st.identity, finalObserved: st, reason: 'target-changed', nextIdentity: { ...st.identity, cut: st.identity.cut + 1 }, endedAt: new Date().toISOString() } }, esv);
  return { b, ouvrir, valider, fermer, bouger };
}
/* Le statut de l'écran : celui que Signal calcule (src/ui5.js) avec la vue du panneau ; ici la même fusion, depuis la vue renvoyée au panneau. */
const ecran = v => { const C = v.correction, n = v.native, I = C.issues || null;
  const F = CL.visitesFusionnees(n.correction?.id === C.id ? n.visits : [], { issues: I, echoOuvert: ['STARTING', 'RUNNING', 'PAUSED', 'PAUSED_ADAPTER_UNRESPONSIVE'].includes(n.status) });
  return Object.fromEntries(CL.bilan(C.listes.flatMap(l => l.entrees), F).lignes.map(l => [l.cut, l.statut])); };

test('CH-037 : la visite OUVERTE compte dès que Maj+Espace est observé (validé, ou corrigé si un rail a bougé), sans navigation', async () => {
  const { b, ouvrir, valider, fermer, bouger } = await monter();
  const a = await ouvrir(14); await valider(a);
  let v = await b.api('view');
  assert.equal(ecran(v)[14], 'valide', 'validé tel quel, visite encore ouverte');
  assert.equal(b.fonction('engine.s.native.visits').at(-1).endedAt, undefined, 'Écho n’a pas clos la visite');
  const c = await ouvrir(15); await valider(c, bouger(c.st, 20));
  v = await b.api('view');
  assert.equal(ecran(v)[15], 'corrige', 'corrigé : un rail a bougé avant Maj+Espace');
  assert.match(v.correction.issues[c.id], /^VALIDATE_CORRECTED/);
  /* L'étiquette provisoire est celle qu'Écho pose à la clôture (même classification). */
  await fermer(c); assert.equal(b.fonction('engine.s.native.visits').find(x => x.visitId === c.id).label, v.correction.issues[c.id]);
  /* Une visite ouverte SANS validation reste « ouverte ». */
  await ouvrir(16); v = await b.api('view'); assert.equal(ecran(v)[16], 'en-cours');
  assert.ok(!b.adapter.calls.some(x => ECRITURES.test(x)), 'aucune écriture d’Ariane');
});

test('CH-037 : visite perdue avec la page (changement de partie par l’opérateur) après Maj+Espace : comptée validée, à l’écran et dans correction-fin', async () => {
  const { b, ouvrir, valider } = await monter();
  const a = await ouvrir(14); await valider(a);
  await b.fonction('native.pageLost("page-reloaded")');
  assert.equal(b.fonction('engine.s.native.visits').at(-1).label, undefined, 'le résumé d’Écho n’a pas d’étiquette (cause constatée)');
  const v = await b.api('view');
  assert.equal(ecran(v)[14], 'valide');
  await b.api('correction-terminer');
  const fin = b.store.events.filter(e => e.type === 'correction-fin').at(-1);
  assert.equal(fin.lignes.find(l => l.cut === 14).statut, 'valide', 'le bilan porte le même résultat que l’écran');
  assert.equal(fin.regleStatut, CL.REGLE_STATUT);
});

test('CH-037 : cut revisité (forme du cut 3250 : corrigé, sans décision, validé, sans décision) : « corrigé » à l’écran et dans correction-fin', async () => {
  const { b, ouvrir, valider, fermer, bouger } = await monter();
  let x = await ouvrir(14); await valider(x, bouger(x.st, 20)); await fermer(x);
  x = await ouvrir(14); await fermer(x);
  x = await ouvrir(14); await valider(x); await fermer(x);
  x = await ouvrir(14); await fermer(x);
  const labels = b.fonction('engine.s.native.visits').map(v => v.label);
  assert.deepEqual(labels.map(l => l.replace(/_(BOTH|LEFT_ONLY|RIGHT_ONLY)$/, '')), ['VALIDATE_CORRECTED', 'PASS_NO_DECISION', 'VALIDATE_NO_MOVEMENT', 'PASS_NO_DECISION']);
  const v = await b.api('view');
  assert.equal(ecran(v)[14], 'corrige');
  await b.api('correction-terminer');
  const l = b.store.events.filter(e => e.type === 'correction-fin').at(-1).lignes.find(l => l.cut === 14);
  assert.equal(l.statut, 'corrige'); assert.equal(l.visites, 4); assert.match(l.label, /^VALIDATE_CORRECTED/);
});

test('CH-037 : liste finie dès la dernière validation observée, sans navigation (fin « liste-finie », bilan identique à l’écran)', async () => {
  const { b, ouvrir, valider, fermer } = await monter();
  const cuts = b.fonction('engine.s.correction.listes').flatMap(l => l.entrees.map(e => e.cut));
  for (const [i, cut] of cuts.entries()) { const x = await ouvrir(cut); await valider(x); if (i < cuts.length - 1) await fermer(x); }
  const avant = ecran(await b.api('view'));
  await b.api('view');
  const fin = b.store.events.filter(e => e.type === 'correction-fin').at(-1);
  assert.ok(fin, 'la correction est close'); assert.equal(fin.raison, 'liste-finie');
  assert.deepEqual(Object.fromEntries(fin.lignes.map(l => [l.cut, l.statut])), avant, 'même résultat que l’écran');
  assert.ok(Object.values(avant).every(s => s === 'valide'));
});
