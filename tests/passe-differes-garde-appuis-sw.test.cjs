'use strict';
/* Garde A de la deuxième passe des différés (src/garde-passe-appuis.js, fiches/GARDE_PASSE_A.md), BRANCHÉE dans le service worker (`passeDiffOmbre`), en ombre comme en écriture.
 * Service worker réel en VM, ESV simulé (tests/helpers/passe-differes.cjs) : lot 111 à 115, les cuts 112 et 114 différés puis forcés à « valider » pendant la passe, à la pose
 * du 111 (38,4 mm du départ, pire rail). La chaîne normale du lot : 111, 113 et 115 (première passe). `surPasse` marque des voisins comme poses de L1 (GCV2 dans le lot),
 * comme le fait `lotCommands[cut].l1` pour une pose de la GCV2 dans le lot. Données synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const S = require('../src/settings.js');
const { production } = require('./helpers/perf-production.cjs');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');
const j = x => JSON.parse(JSON.stringify(x));
const marquerL1 = cuts => b => { const lc = b.get('engine').s.batch.lotCommands; for (const c of cuts) lc[c] = { ...lc[c], l1: true }; };
const decisions = b => ev(b, 'passe-differes-ombre').map(e => [e.identity.cut, e.passe, e.decision, e.motif ?? null]);

test('ombre, garde livrée : 112 et 114 poseraient (appui de la chaîne normale à 1 cut) ; l’événement porte la garde mesurée', async () => {
  const x = await lotPasse({ ecritureAllumee: false, passe: {}, deux: true });
  const dec = ev(x.b, 'passe-differes-ombre');
  assert.deepEqual(dec.map(e => [e.identity.cut, e.decision]), [[112, 'poserait'], [114, 'poserait']]);
  for (const e of dec) assert.deepEqual(j(e.garde), { bloque: false, motif: 'appui-normal', deplacementMm: 38.4, appuiNormalCuts: 1 });
  assert.deepEqual(ev(x.b, 'passe-differes-ombre-fin')[0].cuts, [112, 114]);
});

test('ombre : les poses de la GCV2 dans le lot ne sont pas des appuis ; sans chaîne normale, la garde dit « rien » (motif garde-appuis) et le journalise', async () => {
  const x = await lotPasse({ ecritureAllumee: false, passe: {}, deux: true, surPasse: marquerL1([111, 113, 115]) });
  assert.deepEqual(decisions(x.b), [[112, 1, 'rien', 'garde-appuis'], [114, 1, 'rien', 'garde-appuis']], 'une seule passe : rien n’est posé, la seconde ne part pas');
  for (const e of ev(x.b, 'passe-differes-ombre')) {
    assert.deepEqual(j(e.garde), { bloque: true, motif: 'garde-appuis', deplacementMm: 38.4, appuiNormalCuts: null });
    assert.ok(['left', 'right'].every(s => e.decal[s].length === 3), 'le décalage refusé est journalisé');
  }
  const fin = ev(x.b, 'passe-differes-ombre-fin')[0]; assert.deepEqual(fin.cuts, []); assert.equal(fin.posees, 0); assert.equal(fin.differes, 2);
  assert.deepEqual(x.pasPasse, [], 'rien n’est envoyé à ESV');
  /* Garde coupée (`actif:false`) : les mêmes poses passent, la garde est mesurée et dite coupée. */
  const y = await lotPasse({ ecritureAllumee: false, passe: { gardeAppuis: { actif: false } }, deux: true, surPasse: marquerL1([111, 113, 115]) });
  assert.deepEqual(decisions(y.b), [[112, 1, 'poserait', null], [114, 1, 'poserait', null]]);
  assert.deepEqual(j(ev(y.b, 'passe-differes-ombre')[0].garde), { bloque: false, motif: 'garde-coupee', deplacementMm: 38.4, appuiNormalCuts: null });
});

test('ombre : une pose de la passe n’est pas un appui ; seuils lus dans les réglages (appuiNormalMaxCuts 2)', async () => {
  /* 113 et 115 : GCV2 dans le lot. 112 : chaîne normale (111) à 1 cut, il passe. 114 : la passe vient de poser 112 (2 cuts), la GCV2 dans le lot 113 (1 cut) ;
   * la chaîne normale (111) est à 3 cuts > 2 : refusé, aux deux passes. */
  const x = await lotPasse({ ecritureAllumee: false, passe: { gardeAppuis: { appuiNormalMaxCuts: 2 } }, deux: true, surPasse: marquerL1([113, 115]) });
  assert.deepEqual(decisions(x.b), [[112, 1, 'poserait', null], [114, 1, 'rien', 'garde-appuis'], [114, 2, 'rien', 'garde-appuis']]);
  const g = ev(x.b, 'passe-differes-ombre').map(e => j(e.garde));
  assert.deepEqual(g[0], { bloque: false, motif: 'appui-normal', deplacementMm: 38.4, appuiNormalCuts: 1 });
  assert.deepEqual(g[1], { bloque: true, motif: 'garde-appuis', deplacementMm: 38.4, appuiNormalCuts: 3 });
  assert.deepEqual(ev(x.b, 'passe-differes-ombre-fin')[0].cuts, [112]);
  /* Seuil de déplacement lu aussi : à 30 mm, 38,4 mm est « loin du départ » et 114 passe. */
  const y = await lotPasse({ ecritureAllumee: false, passe: { gardeAppuis: { appuiNormalMaxCuts: 2, deplacementMaxMm: 30 } }, deux: true, surPasse: marquerL1([113, 115]) });
  assert.deepEqual(ev(y.b, 'passe-differes-ombre-fin')[0].cuts, [112, 114]);
  assert.equal(ev(y.b, 'passe-differes-ombre')[1].garde.motif, 'loin-du-depart');
});

test('écriture rallumée : une pose refusée par la garde n’est jamais écrite ; la pose permise l’est', async () => {
  /* Tout refusé : aucune navigation, aucune pose, aucune validation, même après « Relancer ». */
  const x = await lotPasse({ passe: { ecriture: true, passes: 1 }, deux: true, surPasse: marquerL1([111, 113, 115]) });
  await relancer(x);
  assert.deepEqual(x.pasPasse, []); assert.deepEqual(x.adapter.enPlace, []);
  assert.equal(ev(x.b, 'passe-differes-ecriture').length, 0);
  assert.ok(ev(x.b, 'passe-differes-ombre').every(e => e.decision === 'rien' && e.motif === 'garde-appuis' && e.garde.bloque === true));
  assert.ok(!ev(x.b, 'validation-accepted').some(q => q.passeDifferes), 'aucune validation de la passe');
  /* 112 permis (chaîne normale à 1 cut), 114 refusé (appui normal à 3 cuts > 2) : seul 112 est écrit. */
  const y = await lotPasse({ passe: { ecriture: true, passes: 1, gardeAppuis: { appuiNormalMaxCuts: 2 } }, deux: true, surPasse: marquerL1([113, 115]) });
  await relancer(y);
  assert.deepEqual(y.adapter.enPlace.map(e => e.cut), [112]);
  assert.deepEqual(ev(y.b, 'passe-differes-ecriture').map(e => [e.identity.cut, e.resultat]), [[112, 'ecrit']]);
  assert.equal(ev(y.b, 'passe-differes-ecriture-fin').at(-1).decidees, 1);
});

test('réglage : garde illisible ou module absent, la passe est coupée ; clé absente : garde livrée', () => {
  const b = production({}), niveau = passe => { b.ctx.BananeSettings = { ...S, lot: { ...S.lot, passeDifferes: passe } }; return b.get('passeDiffReglage')(); };
  assert.deepEqual(j(niveau({}).garde), { ok: true, actif: true, deplacementMaxMm: 100, appuiNormalMaxCuts: 4 });
  assert.equal(niveau({ gardeAppuis: { appuiNormalMaxCuts: 6 } }).garde.appuiNormalMaxCuts, 6);
  assert.equal(niveau({ gardeAppuis: { appuiNormalMaxCuts: 6 } }).garde.deplacementMaxMm, 100, 'clé par clé');
  assert.equal(niveau({ gardeAppuis: false }).mode, 'ombre'); assert.equal(niveau({ gardeAppuis: false }).garde.actif, false);
  for (const v of ['x', null, true, 0, [], { actif: 'oui' }, { deplacementMaxMm: -1 }, { appuiNormalMaxCuts: 1.5 }]) assert.equal(niveau({ gardeAppuis: v }).mode, 'off', JSON.stringify(v));
  assert.equal(niveau({ ecriture: true, gardeAppuis: 'x' }).mode, 'off', 'jamais d’écriture sans sa garde');
  const G = b.ctx.BananeGardePasseAppuis; b.ctx.BananeGardePasseAppuis = undefined;
  try { assert.equal(niveau({}).mode, 'off', 'module de la garde absent'); } finally { b.ctx.BananeGardePasseAppuis = G; }
  assert.equal(niveau({}).mode, 'ombre');
});
