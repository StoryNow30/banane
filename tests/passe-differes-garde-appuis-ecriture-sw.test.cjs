'use strict';
/* Garde A de la deuxième passe des différés (src/garde-passe-appuis.js, fiches/GARDE_PASSE_A.md), BRANCHÉE dans le service worker (`passeDiffOmbre`), en ombre comme en écriture.
 * Service worker réel en VM, ESV simulé (tests/helpers/passe-differes.cjs) : lot 111 à 115, les cuts 112 et 114 différés puis forcés à « valider » pendant la passe, à la pose
 * du 111 (38,4 mm du départ, pire rail). La chaîne normale du lot : 111, 113 et 115 (première passe). `surPasse` marque des voisins comme poses de L1 (GCV2 dans le lot),
 * comme le fait `lotCommands[cut].l1` pour une pose de la GCV2 dans le lot. Données synthétiques. Un lot par fichier (durée des essais). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev, j, marquerL1, decisions } = require('./helpers/garde-appuis.cjs');

test('écriture rallumée : 112 permis (chaîne normale à 1 cut) est écrit, 114 refusé (appui normal à 3 cuts > 2) ne l’est pas', async () => {
  const y = await lotPasse({ passe: { ecriture: true, passes: 1, gardeAppuis: { appuiNormalMaxCuts: 2 } }, deux: true, surPasse: marquerL1([113, 115]) });
  await relancer(y);
  assert.deepEqual(y.adapter.enPlace.map(e => e.cut), [112]);
  assert.deepEqual(ev(y.b, 'passe-differes-ecriture').map(e => [e.identity.cut, e.resultat]), [[112, 'ecrit']]);
  assert.equal(ev(y.b, 'passe-differes-ecriture-fin').at(-1).decidees, 1);
});
