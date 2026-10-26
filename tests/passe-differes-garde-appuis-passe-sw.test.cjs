'use strict';
/* Garde A de la deuxième passe des différés (src/garde-passe-appuis.js, fiches/GARDE_PASSE_A.md), BRANCHÉE dans le service worker (`passeDiffOmbre`), en ombre comme en écriture.
 * Service worker réel en VM, ESV simulé (tests/helpers/passe-differes.cjs) : lot 111 à 115, les cuts 112 et 114 différés puis forcés à « valider » pendant la passe, à la pose
 * du 111 (38,4 mm du départ, pire rail). La chaîne normale du lot : 111, 113 et 115 (première passe). `surPasse` marque des voisins comme poses de L1 (GCV2 dans le lot),
 * comme le fait `lotCommands[cut].l1` pour une pose de la GCV2 dans le lot. Données synthétiques. Un lot par fichier (durée des essais). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev, j, marquerL1, decisions } = require('./helpers/garde-appuis.cjs');

test('ombre : une pose de la passe n’est pas un appui ; seuils lus dans les réglages (appuiNormalMaxCuts 2)', async () => {
  /* 113 et 115 : GCV2 dans le lot. 112 : chaîne normale (111) à 1 cut, il passe. 114 : la passe vient de poser 112 (2 cuts), la GCV2 dans le lot 113 (1 cut) ;
   * la chaîne normale (111) est à 3 cuts > 2 : refusé, aux deux passes. */
  const x = await lotPasse({ ecritureAllumee: false, passe: { gardeAppuis: { appuiNormalMaxCuts: 2 } }, deux: true, surPasse: marquerL1([113, 115]) });
  assert.deepEqual(decisions(x.b), [[112, 1, 'poserait', null], [114, 1, 'rien', 'garde-appuis'], [114, 2, 'rien', 'garde-appuis']]);
  const g = ev(x.b, 'passe-differes-ombre').map(e => j(e.garde));
  assert.deepEqual(g[0], { bloque: false, motif: 'appui-normal', deplacementMm: 38.4, appuiNormalCuts: 1 });
  assert.deepEqual(g[1], { bloque: true, motif: 'garde-appuis', deplacementMm: 38.4, appuiNormalCuts: 3 });
  assert.deepEqual(ev(x.b, 'passe-differes-ombre-fin')[0].cuts, [112]);
});
