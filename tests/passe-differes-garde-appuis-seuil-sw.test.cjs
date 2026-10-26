'use strict';
/* Garde A de la deuxième passe des différés (src/garde-passe-appuis.js, fiches/GARDE_PASSE_A.md), BRANCHÉE dans le service worker (`passeDiffOmbre`), en ombre comme en écriture.
 * Service worker réel en VM, ESV simulé (tests/helpers/passe-differes.cjs) : lot 111 à 115, les cuts 112 et 114 différés puis forcés à « valider » pendant la passe, à la pose
 * du 111 (38,4 mm du départ, pire rail). La chaîne normale du lot : 111, 113 et 115 (première passe). `surPasse` marque des voisins comme poses de L1 (GCV2 dans le lot),
 * comme le fait `lotCommands[cut].l1` pour une pose de la GCV2 dans le lot. Données synthétiques. Un lot par fichier (durée des essais). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev, j, marquerL1, decisions } = require('./helpers/garde-appuis.cjs');

test('ombre : seuil de déplacement lu dans les réglages : à 30 mm, 38,4 mm est « loin du départ » et 114 passe', async () => {
  const y = await lotPasse({ ecritureAllumee: false, passe: { gardeAppuis: { appuiNormalMaxCuts: 2, deplacementMaxMm: 30 } }, deux: true, surPasse: marquerL1([113, 115]) });
  assert.deepEqual(ev(y.b, 'passe-differes-ombre-fin')[0].cuts, [112, 114]);
  assert.equal(ev(y.b, 'passe-differes-ombre')[1].garde.motif, 'loin-du-depart');
});
