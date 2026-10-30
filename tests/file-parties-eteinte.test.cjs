'use strict';
/* CH-017 — FILE ÉTEINTE (défaut de src/settings.js) : rien ne change. Les actions « file-* » restent inconnues, la vue du panneau, le scope du lot
 * et l'export n'en portent rien, aucune clé de la file n'est lue ni écrite, « Démarrer » et « Arrêter » sont ceux d'avant. La comparaison octet pour
 * octet avec le tronc est dans le rapport du chantier (chantiers/CH-017.rapport.md). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, fermer, FICHE, LOT_ARGS, S } = require('./helpers/file-parties-sw.cjs');
test.afterEach(fermer);

test('livrée allumée dans la test 25 (D-268) : src/settings.js `file.actif` vaut true ; la file ne part que si l\'opérateur la lance', () => {
  assert.equal(S.file.actif, true); assert.ok(Object.isFrozen(S.file));
});

test('file éteinte : actions inconnues, vue, scope et export sans file, aucune clé de la file touchée, Démarrer et Arrêter inchangés', async () => {
  const M = montage({ fiche: { ...FICHE, actif: false } }); const b = await M.vie();
  const lus = [], ecrits = [], loc = b.ctx.chrome.storage.local, get = loc.get, set = loc.set;
  loc.get = k => { lus.push(...[].concat(k ?? '*')); return get(k); }; loc.set = o => { ecrits.push(...Object.keys(o)); return set(o); };
  await b.api('connect', { tabId: 1 }); await b.api('settings', { mode: 'automatic-test' });
  for (const a of ['file-etat', 'file-demarrer', 'file-arreter', 'file-oublier']) await assert.rejects(b.api(a, { n: 2, lotArgs: LOT_ARGS }), /Commande inconnue/);
  const v = await b.api('view'); assert.equal(Object.hasOwn(v, 'fileParties'), false);
  await b.api('start', { part: 23, start: 5, end: 9, ...LOT_ARGS });
  const sc = M.lots[0].scope; assert.equal(Object.hasOwn(sc, 'fileParties'), false); assert.equal(sc.relecture, 'corriger', 'test 27 : relecture « corriger » par défaut (non réglable), figée dans le scope comme avant le choix gardé');
  await b.api('stop'); assert.notEqual(M.engine().s.batch.state, 'RUNNING', '« Arrêter » arrête le lot comme avant');
  const meta = await b.api('journal-meta'); assert.equal(Object.hasOwn(meta, 'fileParties'), false);
  for (const k of [...lus, ...ecrits]) assert.ok(!/^banane60(FileParties|RegistreFile)$/.test(k), 'clé de la file touchée : ' + k);
  assert.equal(M.journal('file-parties').length + M.journal('file-parties-reprise').length, 0);
  assert.equal(b.get('fileP').tic, null, 'aucun tic');
  assert.ok(!M.adapter.calls.some(c => c.startsWith('changerPartie')));
});

test('file éteinte avec un état de file gardé (version précédente allumée) : rien n’est repris au réveil', async () => {
  const M = montage({ fiche: { ...FICHE, actif: false } });
  M.local.m.banane60FileParties = { v: 1, id: 'x', etat: 'changement', n: 2, plan: [23, 24], k: 0, bilan: [], changement: { vers: 24, tentatives: 1 }, partie: null };
  await M.vie(); await new Promise(r => setTimeout(r, 80));
  assert.equal(M.etat(), null); assert.ok(!M.adapter.calls.some(c => c.startsWith('changerPartie')));
  assert.equal(M.journal('file-parties-reprise').length, 0);
});
