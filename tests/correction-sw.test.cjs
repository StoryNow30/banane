'use strict';
/* CH-028 — LA CORRECTION DANS ORBITE, côté service worker (background.js) : la liste naît d'un lot clos et entre au journal (donc dans l'export
 * Orbite), la correction est une VRAIE séance Écho marquée `correction`, « Ouvrir » enchaîne pause d'Écho → retour au cut → reprise d'Écho (l'adaptateur
 * refuse `goToCut` pendant Écho), et la fin inscrit le bilan par cut. Ariane n'envoie ni pose, ni validation, ni SKIP. Données fabriquées. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { K } = require('./fixtures.cjs'), Settings = require('../src/settings.js'), EC = require('../src/export-cache.js'), CL = require('../src/correction-liste.js');
const { background } = require('./helpers/background-harness.cjs');
const { journal } = require('./helpers/correction-journal.cjs');
/* L'adresse de la page ESV simulée est lue dans manifest.json (aucune adresse ESV écrite dans ce fichier). */
const esv = { id: 'test', url: require('../manifest.json').host_permissions[0].replace(/\*$/, '') + 'test', tab: { id: 1 } };
const ECRITURES = ['apply', 'validate', 'skip', 'validateInPlace', 'validerMajEspace', 'nextWithoutDecision'];

async function monter({ lot = { id: 'B1', state: 'COMPLETED', scope: { part: 5 } } } = {}) {
  const b = background({ globals: { BananeCore3: K, BananeSettings: Settings, BananeExportCache: EC, ArianeCorrectionListe: CL } });
  b.adapter.identity.part = 5; b.adapter.identity.cut = 10;
  b.adapter.ping = async function () { return { version: K.VERSION, pageId: this.identity.pageId, proprietaire: 'test', label: { part: this.identity.part, cut: this.identity.cut, pageId: this.identity.pageId } }; };
  b.adapter.goToCut = async function (cible) { this.calls.push('goToCut:' + cible.cut); const avant = { part: this.identity.part, cut: this.identity.cut };
    if (cible.part !== this.identity.part) return { resultat: 'refuse', refusal: { code: 'AUTRE_PARTIE', message: 'autre partie' }, emissions: 0, commandInvoked: false, identiteAvant: avant };
    this.identity.cut = cible.cut; return { resultat: 'confirme', chemin: 'evenement', emissions: 1, identiteAvant: avant, identiteApres: { part: 5, cut: cible.cut } }; };
  await b.api('connect', { tabId: 1 });
  for (const e of journal()) await b.store.putEvent({ eventId: K.uid(), ...e });
  b.ctx = null;
  if (lot) { b.fonction(`engine.s.batch=${JSON.stringify(lot)}`); }
  return b;
}
const evts = (b, type) => b.store.events.filter(e => e.type === type);
const visite = async (b, cut, label) => {
  const id = b.fonction('engine.s.native.id'), period = b.fonction('engine.s.native.currentPeriodId'), st = await b.adapter.state();
  st.identity.cut = cut;
  await b.message({ kind: 'native-event', type: 'visit-started', payload: { sessionId: id, observationPeriodId: period, visitId: 'v' + cut, identity: st.identity, initialObserved: st } }, esv);
  await b.message({ kind: 'native-event', type: 'visit-ended', payload: { sessionId: id, observationPeriodId: period, visitId: 'v' + cut, identity: st.identity, finalObserved: st, reason: 'finished', nextIdentity: null, endedAt: new Date().toISOString() } }, esv);
};

test('la liste naît d’un lot clos, entre UNE fois au journal (export Orbite) et dans la vue du panneau', async () => {
  const b = await monter();
  const v = await b.api('correction-liste');
  assert.equal(v.correction.etat, 'proposee');
  assert.deepEqual(v.correction.listes.map(l => [l.batchId, l.partie]), [['B1', 5]]);
  assert.deepEqual(v.correction.listes[0].entrees.map(e => e.cut), [14, 15, 16, 17, 19, 18, 13]);
  const j = evts(b, 'correction-liste');
  assert.equal(j.length, 1); assert.equal(j[0].batchId, 'B1'); assert.equal(j[0].partie, 5); assert.equal(j[0].version, CL.VERSION);
  assert.deepEqual(j[0].entrees.find(e => e.cut === 15).signaux, ['apres-differe', 'sans-appui']);
  await b.api('correction-liste');
  assert.equal(evts(b, 'correction-liste').length, 1, 'pas de doublon pour le même lot');
  assert.ok((await b.api('view')).correction, 'la vue du panneau porte la correction');
});

test('refusée pendant un lot ouvert ; rien n’est journalisé', async () => {
  const b = await monter({ lot: { id: 'B1', state: 'RUNNING', scope: { part: 5 } } });
  await assert.rejects(b.api('correction-liste'), /lot/i);
  assert.equal(evts(b, 'correction-liste').length, 0);
});

test('correction de bout en bout : séance Écho marquée, « Ouvrir » = pause → retour au cut → reprise, bilan inscrit ; aucune écriture d’Ariane', async () => {
  const b = await monter();
  await b.api('correction-liste');
  await b.api('correction-demarrer');
  assert.equal(b.fonction('engine.s.native.status'), 'RUNNING');
  const c = b.fonction('engine.s.native.correction');
  assert.equal(c.id, b.fonction('engine.s.correction.id')); assert.deepEqual(c.batchIds, ['B1']);
  assert.equal(b.fonction('engine.s.correction.etat'), 'ouverte');
  assert.equal(evts(b, 'correction-debut').length, 1);
  /* le « retour à un cut » ordinaire reste refusé pendant Écho */
  await assert.rejects(b.api('goto-cut', { part: 5, cut: 15 }), /Écho est actif/);
  b.adapter.calls.length = 0;
  const r = await b.api('correction-ouvrir', { part: 5, cut: 14 });
  assert.equal(r.ok, true); assert.equal(b.adapter.identity.cut, 14);
  assert.deepEqual(b.adapter.calls.filter(x => /^(nativePause|nativeResume|goToCut)/.test(x)), ['nativePause', 'goToCut:14', 'nativeResume']);
  assert.equal(b.fonction('engine.s.native.status'), 'RUNNING', 'Écho a repris');
  assert.equal(evts(b, 'correction-ouvrir').at(-1).resultat, 'confirme');
  /* hors liste : refusé sans rien envoyer, Écho intact */
  b.adapter.calls.length = 0;
  await assert.rejects(b.api('correction-ouvrir', { part: 5, cut: 11 }), /pas dans la liste/);
  assert.deepEqual(b.adapter.calls, []);
  await visite(b, 14, 'x');
  const fin = await b.api('correction-terminer');
  assert.equal(fin.correction.etat, 'terminee');
  assert.equal(b.fonction('engine.s.native.status'), 'FINISHED');
  const f = evts(b, 'correction-fin').at(-1);
  assert.equal(f.comptes.total, 7); assert.equal(f.lignes.find(l => l.cut === 14).visites >= 1, true);
  assert.deepEqual(b.adapter.calls.filter(x => ECRITURES.includes(x)), [], 'Ariane n’écrit rien dans ESV');
});

test('« Fermer la liste » efface une liste proposée, jamais une correction ouverte', async () => {
  const b = await monter();
  await b.api('correction-liste'); await b.api('correction-demarrer');
  await assert.rejects(b.api('correction-fermer'), /Termine/);
  await b.api('correction-terminer');
  const v = await b.api('correction-fermer');
  assert.equal(v.correction ?? null, null);
});

test('constats de la maquette : démarrage refusé tant qu’une pose reste appliquée ; liste réinscrite seulement si elle change ; relecture finie ≠ relecture en cours', async () => {
  const b = await monter();
  b.fonction(`engine.s.applied={identity:{part:5,cut:19}}`);
  await b.api('correction-liste');
  await assert.rejects(b.api('correction-demarrer'), /pose d’Ariane est appliquée/);
  assert.notEqual(b.fonction('engine.s.native?.status'), 'RUNNING', 'Écho non démarré');
  b.fonction('engine.s.applied=null');
  await b.store.putEvent({ eventId: K.uid(), type: 'garde-apres-differe-suivant', timestamp: '2026-10-31T10:00:30Z', batchId: 'B1', identity: { part: 5, cut: 12 }, cutsGarde: [13] });
  await b.api('correction-liste');
  assert.equal(evts(b, 'correction-liste').length, 2, 'la liste a changé (cut 12) : réinscrite');
  await b.api('correction-liste');
  assert.equal(evts(b, 'correction-liste').length, 2, 'inchangée : pas de doublon');
  b.fonction(`relecture.passe={etat:'finie',lotId:'B1'}`);
  await b.api('correction-liste');
  b.fonction(`relecture.passe={etat:'en-cours',lotId:'B1'}`);
  await assert.rejects(b.api('correction-liste'), /relecture du lot tourne encore/);
});

test('« Ouvrir » refusé par le retour au cut : le cut courant n’est pas noté, Écho reprend quand même', async () => {
  const b = await monter();
  await b.api('correction-liste'); await b.api('correction-demarrer');
  b.adapter.goToCut = async function () { this.calls.push('goToCut'); return { resultat: 'refuse', refusal: { code: 'X', message: 'refusé (essai)' }, emissions: 0, commandInvoked: false }; };
  const r = await b.api('correction-ouvrir', { part: 5, cut: 14 });
  assert.equal(r.ok, false);
  assert.equal(b.fonction('engine.s.correction.courant ?? null'), null);
  assert.equal(b.fonction('engine.s.native.status'), 'RUNNING');
  assert.equal(evts(b, 'correction-ouvrir').at(-1).resultat, 'refuse');
});

/* Demande de la mère (31/10) : l'opérateur ne démarre jamais Écho à la main pour la correction, et aucune séance Écho « correction » ne reste ouverte
 * par erreur : fin propre à la fin de la liste, à la fermeture du panneau, si Écho est fermé ailleurs (abandon), et après un redémarrage du service worker. */
const finPropre = async (b, raison) => {
  assert.equal(b.fonction('engine.s.correction.etat'), 'terminee', raison);
  assert.notEqual(b.fonction('engine.s.native.status'), 'RUNNING', raison + ' : Écho fermé');
  assert.ok(!['RUNNING', 'PAUSED', 'STARTING', 'PAUSED_ADAPTER_UNRESPONSIVE'].includes(b.fonction('engine.s.native.status')), raison + ' : aucune séance ouverte');
  const f = evts(b, 'correction-fin').at(-1); assert.equal(f.raison, raison); return f;
};
test('fin propre : la fermeture du panneau termine la correction et ferme sa séance Écho', async () => {
  const b = await monter(); await b.api('correction-liste');
  const port = b.connectPanel('chrome-extension://test/panel.html#automatic', 3, 33);
  await b.api('correction-demarrer');
  await port.disconnect(); for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r));
  await finPropre(b, 'panneau-ferme');
});
test('fin propre : la liste finie (chaque cut validé ou corrigé) termine d’elle-même à la lecture suivante de la vue', async () => {
  const b = await monter(); await b.api('correction-liste'); await b.api('correction-demarrer');
  await b.api('view'); assert.equal(b.fonction('engine.s.correction.etat'), 'ouverte', 'pas tant que des cuts restent');
  const cuts = b.fonction('engine.s.correction.listes[0].entrees.map(e=>e.cut)');
  b.fonction(`engine.s.native.visits=${JSON.stringify(cuts.map((c, i) => ({ visitId: 'v' + c, identity: { part: 5, cut: c }, startedAt: '2026-10-31T10:00:00Z', endedAt: '2026-10-31T10:00:05Z', label: i % 2 ? 'VALIDATE_NO_MOVEMENT' : 'VALIDATE_CORRECTED_LEFT' })))}`);
  const v = await b.api('view');
  assert.equal(v.correction.etat, 'terminee');
  const f = await finPropre(b, 'liste-finie'); assert.equal(f.comptes.traites, cuts.length);
});
test('fin propre : Écho terminé ailleurs (onglet Écho, abandon) ou service worker redémarré : la correction se clôt, bilan inscrit', async () => {
  const b = await monter(); await b.api('correction-liste'); await b.api('correction-demarrer');
  await b.api('native-end'); await b.api('view');
  await finPropre(b, 'echo-ferme');
  const c = await monter(); await c.api('correction-liste'); await c.api('correction-demarrer');
  c.fonction('correctionVivante=null');   /* ce qu'un redémarrage du service worker laisse : la mémoire de la correction vivante est perdue */
  await c.api('view');
  await finPropre(c, 'sw-redemarre');
});
test('« Ouvrir » en vol : la pause d’Écho qu’il fait ne clôt pas la correction', async () => {
  const b = await monter(); await b.api('correction-liste'); await b.api('correction-demarrer');
  let vue = null; const go = b.adapter.goToCut.bind(b.adapter);
  b.adapter.goToCut = async function (c) { vue = await b.api('view'); return go(c); };
  const r = await b.api('correction-ouvrir', { part: 5, cut: 14 });
  assert.equal(r.ok, true); assert.equal(vue.correction.etat, 'ouverte'); assert.equal(b.fonction('engine.s.correction.etat'), 'ouverte');
});
