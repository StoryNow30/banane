'use strict';
/* Garde A de la deuxième passe des différés (src/garde-passe-appuis.js, fiches/GARDE_PASSE_A.md), BRANCHÉE dans le service worker (`passeDiffOmbre`), en ombre comme en écriture.
 * Service worker réel en VM, ESV simulé (tests/helpers/passe-differes.cjs) : lot 111 à 115, les cuts 112 et 114 différés puis forcés à « valider » pendant la passe, à la pose
 * du 111 (38,4 mm du départ, pire rail). La chaîne normale du lot : 111, 113 et 115 (première passe). `surPasse` marque des voisins comme poses de L1 (GCV2 dans le lot),
 * comme le fait `lotCommands[cut].l1` pour une pose de la GCV2 dans le lot. Données synthétiques. Un lot par fichier (durée des essais). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev, j, marquerL1, decisions } = require('./helpers/garde-appuis.cjs');

test('ombre, garde coupée (`actif:false`) : les mêmes poses passent, la garde est mesurée et dite coupée', async () => {
  const y = await lotPasse({ ecritureAllumee: false, passe: { gardeAppuis: { actif: false } }, deux: true, surPasse: marquerL1([111, 113, 115]) });
  assert.deepEqual(decisions(y.b), [[112, 1, 'poserait', null], [114, 1, 'poserait', null]]);
  assert.deepEqual(j(ev(y.b, 'passe-differes-ombre')[0].garde), { bloque: false, motif: 'garde-coupee', deplacementMm: 38.4, appuiNormalCuts: null });
});
