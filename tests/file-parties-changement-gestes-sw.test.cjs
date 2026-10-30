'use strict';
/* CH-026 — CHANGEMENT DE PARTIE PAR LES GESTES DE L'OPÉRATEUR (témoignage du 30/10 : « Espace s'il n'y a plus aucun cut à valider devant », « dernier cut
 * puis Z »), le clic du sélecteur en dernier repli. Service worker réel en VM, faux adaptateur qui suit chantiers/CH-026/adaptateur-changement-partie.patch
 * (tests/helpers/file-parties-sw.cjs, `gestes`). Prouve l'ordre des tentatives, l'absence de toute validation et de tout SKIP, le journal complet de
 * chaque tentative et de l'échec, et l'alerte lisible. Ne prouve rien sur un vrai ESV. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, fermer } = require('./helpers/file-parties-sw.cjs');
test.afterEach(fermer);

async function jusquauChangement(M, reglage = {}) {
  await M.vie(); Object.assign(M.adapter, { gestes: true, ...reglage });
  await M.demarrer(2); await M.partie(0);
}
const tentatives = M => M.journal('file-parties-changement').filter(e => !e.retour);
const sansDecision = M => assert.ok(!M.adapter.calls.some(c => /^(validate|skip|apply)/.test(c)), 'aucune validation, aucun SKIP, aucune pose : ' + M.adapter.calls.join(','));

test('plus rien à valider dans la partie : « Next non validated cut » (son « Espace ») ouvre la partie suivante ; une tentative, journalisée', async () => {
  const M = montage(); await jusquauChangement(M, { reste: 0 });
  await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.k === 1, 3000, 'lot de la partie 24');
  const t = tentatives(M); assert.equal(t.length, 1);
  assert.equal(t[0].mode, 'invalide-suivant'); assert.equal(t[0].issue, 'ok'); assert.equal(t[0].sansDecision, true);
  assert.deepEqual({ ...t[0].compteur }, { traites: 10, total: 10 }); assert.equal(t[0].bouton.id, 'O2N3DCutNextInvalid3DRail'); assert.equal(t[0].identiteApres.part, 24);
  assert.ok(Number.isInteger(t[0].dureeMs));
  assert.ok(!M.adapter.calls.includes('changerPartie:24'), 'le lien n’est pas cliqué'); sansDecision(M);
});

test('il reste des cuts à valider : « Espace » refusé sans rien cliquer, puis dernier cut (goToCut) et « Next cut » (son « Z »)', async () => {
  const M = montage(); await jusquauChangement(M, { reste: 3, total: 10 });
  await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.k === 1, 3000, 'lot de la partie 24');
  const t = tentatives(M); assert.deepEqual(t.map(x => [x.mode, x.issue, x.raison]), [['invalide-suivant', 'refus', 'reste-a-valider'], ['suivant-dernier', 'ok', null]]);
  assert.match(t[0].texte, /il reste des cuts à valider \(7 traités sur 10\)/);
  assert.deepEqual({ ...t[1].goto }, { cut: 9, resultat: 'confirme', chemin: 'evenement', code: null });
  assert.ok(M.adapter.calls.includes('goToCut:9')); sansDecision(M);
});

test('les deux gestes sans effet : le clic du sélecteur, en dernier repli, ouvre la partie ; trois tentatives au journal', async () => {
  const M = montage(); await jusquauChangement(M, { reste: 0, sansEffet: ['invalide-suivant', 'suivant-dernier'] });
  M.adapter.identity.cut = 9;
  await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.k === 1, 5000, 'lot de la partie 24');
  assert.deepEqual(tentatives(M).map(x => [x.mode, x.issue]), [['invalide-suivant', 'sans-effet'], ['suivant-dernier', 'sans-effet'], ['lien', 'ok']]);
  assert.ok(M.adapter.calls.includes('changerPartie:24')); sansDecision(M);
});

test('tout échoue : arrêt « changement-impossible » avec une alerte qui dit chaque tentative ; événement d’échec complet (sélecteur avant et après)', async () => {
  const M = montage(); await jusquauChangement(M, { reste: 2, sansEffet: ['suivant-dernier'], bloque: true });
  await M.jusqua(() => M.etat()?.etat === 'arret', 6000, 'arrêt');
  const e = M.etat(); assert.equal(e.motifFin.code, 'changement-impossible');
  assert.match(e.alerte.detail, /essayé : invalide-suivant : il reste des cuts à valider \(8 traités sur 10\) ; suivant-dernier : la partie 24 n’est pas affichée après 1 s.* ; lien : la partie 24 n’est pas affichée/);
  const f = M.journal('file-parties-changement-echec'); assert.equal(f.length, 1);
  assert.equal(f[0].tentatives.length, 3); assert.deepEqual({ ...f[0].selecteurAvant }, { status: 'ok', current: 23, n: 4, vers: true });
  assert.equal(f[0].selecteurApres.current, 23); assert.equal(f[0].motif, 'changement-impossible'); assert.ok(f[0].dureeMs >= 0);
  sansDecision(M);
});

test('un geste ouvre une AUTRE partie que la suivante prévue : arrêt prudent immédiat, rien d’autre n’est essayé', async () => {
  const M = montage(); await jusquauChangement(M, { reste: 0, ouvre: 26 });
  await M.jusqua(() => M.etat()?.etat === 'arret', 3000, 'arrêt');
  assert.match(M.etat().alerte.detail, /ESV a ouvert la partie 26 au lieu de la partie 24 : arrêt prudent/);
  assert.deepEqual(tentatives(M).map(x => [x.mode, x.issue]), [['invalide-suivant', 'autre-partie']]);
  assert.ok(!M.adapter.calls.includes('changerPartie:24'));
});

test('adaptateur d’aujourd’hui (sans les modes) : seul le lien, jamais un mode qu’il ignorerait ; tentative journalisée', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2); await M.partie(0);
  await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.k === 1, 3000, 'lot de la partie 24');
  assert.ok(!M.adapter.calls.some(c => /changerPartie:(invalide|suivant)/.test(c)));
  assert.deepEqual(tentatives(M).map(x => [x.mode, x.issue]), [['lien', 'ok']]);
});
