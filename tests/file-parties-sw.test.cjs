'use strict';
/* CH-017 — PILOTE DE LA FILE DE PARTIES dans le service worker (background.js en VM, faux adaptateur, lot simulé : tests/helpers/file-parties-sw.cjs).
 * 2 parties puis 3 ; partie sans rouge ; un essai par motif d'arrêt (écriture incertaine avec son alerte, refus du lot, arrêt par l'opérateur,
 * changement impossible, commande absente, ESV muet, onglet fermé) ; redémarrage du service worker en plein changement de partie ; registre. */
const { test } = require('node:test'), assert0 = require('node:assert/strict');
/* Les objets viennent de la VM (autre royaume) : comparés par leur JSON. */
const j = x => JSON.parse(JSON.stringify(x ?? null)), assert = Object.assign(Object.create(assert0), { deepEqual: (a, b, m) => assert0.deepStrictEqual(j(a), j(b), m) });
const { montage, fermer, LOT_ARGS } = require('./helpers/file-parties-sw.cjs');
test.afterEach(fermer);
const COMMANDES_FILE = new Set(['ping', 'state', 'changerPartie']);

async function deroule(n) {
  const M = montage(); await M.vie();
  const v = await M.demarrer(n);
  assert.equal(v.file.etat, 'lot'); assert.deepEqual(v.file.plan, [23, 24, 25, 26].slice(0, n));
  for (let k = 0; k < n; k++) await M.partie(k);
  await M.jusqua(() => M.etat()?.etat === 'fin', 3000, 'fin de file');
  return M;
}
function controleCommun(M, n) {
  assert.equal(M.etat().motifFin.code, 'nombre-atteint'); assert.equal(M.etat().alerte, null);
  assert.deepEqual(M.lots.map(l => l.scope.part), [23, 24, 25, 26].slice(0, n), 'un lot par partie, dans l’ordre du sélecteur');
  for (const [k, l] of M.lots.entries()) {
    assert.deepEqual(l.scope.fileParties, { id: M.etat().id, rang: k, n }, 'le lot porte la file dans son scope');
    assert.equal(l.scope.relecture, 'corriger', 'D-261 : relecture et correction toujours');
    assert.equal(l.scope.endMode, 'partie'); assert.equal(l.scope.lotDecision, LOT_ARGS.lotDecision);
  }
  assert.deepEqual(M.adapter.calls.filter(c => c.startsWith('changerPartie')), [24, 25, 26].slice(0, n - 1).map(p => 'changerPartie:' + p));
  assert.ok(!M.adapter.calls.some(c => ['skip', 'validate', 'apply'].includes(c)), 'la file n’envoie ni SKIP, ni validation, ni pose');
  for (const c of M.commandesEsv()) assert.ok(COMMANDES_FILE.has(c), 'commande ESV hors catégorie : ' + c);
}

test('2 parties : deux lots (scope de la file, relecture « corriger »), un changement de partie, fin « nombre-atteint » ; registre noté', async () => {
  const M = await deroule(2); controleCommun(M, 2);
  const R = M.local.m.banane60RegistreFile;
  assert.deepEqual(R.map(r => [r.part, r.rang, r.lotId]), [[23, 0, 'lot-1'], [24, 1, 'lot-2']]);
  assert.deepEqual(R[0].poses, [5, 6]);
  const vue = await M.b.api('view'); assert.equal(vue.fileParties.etat, 'fin'); assert.equal(vue.fileParties.bilan.length, 2);
  const meta = await M.b.api('journal-meta'); assert.equal(meta.fileParties.registre.length, 2, 'le registre part avec l’export');
  assert.ok(M.journal('file-parties').some(e => e.vers === 'fin'));
});

test('3 parties : trois lots, deux changements, bilan de trois parties ; « Oublier » efface l’état, jamais le registre', async () => {
  const M = await deroule(3); controleCommun(M, 3);
  assert.equal(M.etat().bilan.length, 3);
  await M.b.api('file-oublier'); assert.equal(M.etat(), null); assert.equal(M.local.m.banane60FileParties, undefined);
  assert.equal(M.local.m.banane60RegistreFile.length, 3, 'registre gardé');
});

test('partie sans rouge : comptée comme faite, la file passe à la suivante', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 3000, 'lot 1');
  M.clore({ stoppedAtEnd: { issue: 'partie-sans-rouge', reason: 'partie-sans-rouge', cut: 5, at: new Date().toISOString() }, processed: [], deferred: [] });
  await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture'); M.relire({ etat: 'non-lancee', message: 'partie sans cut rouge : rien à relire' });
  await M.partie(1); await M.jusqua(() => M.etat()?.etat === 'fin');
  assert.deepEqual(M.etat().bilan[0].motifs.map(m => m.code), ['partie-sans-rouge', 'relecture-arretee']);
});

test('écriture incertaine (pose d’Ariane non validée) : la file s’arrête, alerte « contrôle le cut dans ESV » ; ni relecture attendue ni partie suivante', async () => {
  const M = montage(); await M.vie(); await M.demarrer(3);
  await M.jusqua(() => M.etat()?.partie?.lotId, 3000, 'lot 1');
  M.engine().s.applied = { identity: { part: 23, cut: 8 } };
  M.clore();
  await M.jusqua(() => M.etat()?.etat === 'arret', 3000, 'arrêt');
  assert.equal(M.etat().motifFin.code, 'ecriture-incertaine');
  const vue = await M.b.api('view');
  assert.match(vue.fileParties.alerte.texte, /contrôle le cut dans ESV/); assert.match(vue.fileParties.alerte.detail, /cut 8/);
  await new Promise(r => setTimeout(r, 120));
  assert.equal(M.lots.length, 1); assert.ok(!M.adapter.calls.some(c => c.startsWith('changerPartie')), 'aucun changement de partie');
});

test('refus propre au lot (lot arrêté sans fin de partie) et arrêt par l’opérateur (« Arrêter » pendant le lot) : la file s’arrête', async () => {
  let M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId); M.clore({ stoppedAtEnd: null });
  await M.jusqua(() => M.etat()?.etat === 'arret'); assert.equal(M.etat().motifFin.code, 'refus-lot'); assert.ok(M.etat().alerte);
  /* lot en ERROR (ne se reprend pas) : arrêt, jamais une attente sans fin */
  M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId); M.clore({ state: 'ERROR', stoppedAtEnd: null });
  await M.jusqua(() => M.etat()?.etat === 'arret', 3000, 'arrêt sur ERROR'); assert.equal(M.etat().motifFin.code, 'refus-lot');
  M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId);
  await M.b.api('stop');
  await M.jusqua(() => M.etat()?.etat === 'arret'); assert.equal(M.etat().motifFin.code, 'operateur'); assert.equal(M.etat().alerte, null);
  await M.jusqua(() => M.engine().s.batch.state !== 'RUNNING', 3000, 'lot arrêté');
});

test('« Démarrer » à la main pendant la file : refusé ; file éteinte, puis rallumée : refus de lancer sans sélecteur lisible', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId);
  await assert.rejects(M.b.api('start', { part: 23, start: 5, end: 9, ...LOT_ARGS }), /File de parties en cours/);
  const N = montage(); N.adapter.parts = []; await N.vie();
  await assert.rejects(N.demarrer(2), /sélecteur de parties/);
  assert.equal(N.etat(), null, 'rien n’est gardé quand la file ne peut pas partir');
});

for (const [nom, regler, motif] of [
  ['commande absente (adaptateur d’aujourd’hui)', a => { a.capacite = false; }, 'commande-absente'],
  ['la page refuse le changement', a => { a.refus = 'partie-absente'; }, 'changement-impossible'],
  ['la page ne change jamais de partie (borne)', a => { a.bloque = true; }, 'changement-impossible'],
  ['ESV muet au moment du changement', a => { a.muet = true; }, 'esv-muet'],
]) test(`changement de partie : ${nom} → arrêt « ${motif} », alerte et bilan`, async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.partie(0); regler(M.adapter);
  await M.jusqua(() => M.etat()?.etat === 'arret', 4000, 'arrêt');
  assert.equal(M.etat().motifFin.code, motif); assert.ok(M.etat().alerte); assert.equal(M.etat().bilan.length, 1);
  assert.equal(M.lots.length, 1, 'aucun lot de plus');
  if (motif === 'commande-absente') assert.ok(!M.adapter.calls.some(c => c.startsWith('changerPartie')), 'commande jamais envoyée à un adaptateur qui ne la connaît pas');
});

test('onglet ESV fermé pendant la file : arrêt « onglet-ferme »', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId); M.ongletFerme = true;
  await M.jusqua(() => M.etat()?.etat === 'arret'); assert.equal(M.etat().motifFin.code, 'onglet-ferme');
});

test('relecture non lancée parce qu’ESV affiche déjà la partie suivante : retour sur la partie du lot, relance de la relecture (D-261)', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId); M.clore();
  await M.jusqua(() => M.etat()?.etat === 'relecture');
  M.adapter.identity = { ...M.adapter.identity, part: 24, cut: 1 };   /* au dernier cut, ESV a chargé la partie suivante */
  let relances = 0; M.b.ctx.relectureLancer = async () => { relances++; M.relire({ gen: 100 }); return {}; };
  M.relire({ etat: 'non-lancee', message: 'ESV affiche la partie 24, pas celle du lot (23)' });
  await M.jusqua(() => M.etat()?.etat === 'changement' || M.etat()?.etat === 'lot' && M.etat()?.k === 1, 3000, 'partie suivante');
  assert.equal(relances, 1); assert.deepEqual(M.adapter.calls.filter(c => c.startsWith('changerPartie')).slice(0, 1), ['changerPartie:23'], 'retour sur la partie 23 d’abord');
  await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.k === 1);
  assert.deepEqual(M.etat().bilan[0].motifs.map(m => m.code), ['fin-normale'], 'relecture finie après le retour');
});

test('redémarrage du service worker en plein changement de partie : état relu, registre consulté, changement rejoué une fois, lot suivant démarré, jamais deux', async () => {
  const M = montage(); await M.vie(); await M.demarrer(3);
  await M.partie(0); M.adapter.bloque = true;
  await M.jusqua(() => M.etat()?.etat === 'changement' && M.local.m.banane60FileParties?.changement?.tentatives === 1, 3000, 'changement envoyé et gardé');
  M.tuer(); M.adapter.bloque = false;
  await M.vie();
  await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.partie?.lotId, 3000, 'lot de la partie 24 après la reprise');
  const rep = M.journal('file-parties-reprise'); assert.equal(rep.length, 1); assert.equal(rep[0].etat, 'changement'); assert.deepEqual(rep[0].actions, ['changer-partie']);
  assert.equal(M.etat().reprises, 1); assert.equal(M.etat().k, 1);
  assert.deepEqual(M.lots.map(l => l.scope.part), [23, 24], 'un seul lot pour la partie 24');
  assert.deepEqual(M.adapter.calls.filter(c => c.startsWith('changerPartie')), ['changerPartie:24', 'changerPartie:24']);
  /* et la suite tourne dans la nouvelle vie */
  await M.partie(1); await M.partie(2); await M.jusqua(() => M.etat()?.etat === 'fin');
  assert.deepEqual(M.etat().bilan.map(p => p.part), [23, 24, 25]);
});

test('redémarrage avec une pose d’Ariane non validée gardée par le moteur : la reprise s’arrête sur « écriture incertaine », rien ne part', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.partie(0); M.adapter.bloque = true;
  await M.jusqua(() => M.local.m.banane60FileParties?.changement?.tentatives === 1);
  M.tuer(); M.adapter.bloque = false;
  M.local.m.banane50RelectureIntention = [{ cut: 4, part: 23, lotId: 'lot-1', origine: 'relecture' }];
  await M.vie();
  await M.jusqua(() => M.etat()?.etat === 'arret', 3000, 'arrêt à la reprise');
  assert.equal(M.etat().motifFin.code, 'ecriture-incertaine'); assert.match(M.etat().alerte.detail, /cut 4/);
  assert.deepEqual(M.adapter.calls.filter(c => c.startsWith('changerPartie')), ['changerPartie:24'], 'aucun changement rejoué');
});
