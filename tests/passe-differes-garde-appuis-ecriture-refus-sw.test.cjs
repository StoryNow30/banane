'use strict';
/* Garde A de la deuxième passe des différés (src/garde-passe-appuis.js, fiches/GARDE_PASSE_A.md), BRANCHÉE dans le service worker (`passeDiffOmbre`), en ombre comme en écriture.
 * Service worker réel en VM, ESV simulé (tests/helpers/passe-differes.cjs) : lot 111 à 115, les cuts 112 et 114 différés puis forcés à « valider » pendant la passe, à la pose
 * du 111 (38,4 mm du départ, pire rail). La chaîne normale du lot : 111, 113 et 115 (première passe). `surPasse` marque des voisins comme poses de L1 (GCV2 dans le lot),
 * comme le fait `lotCommands[cut].l1` pour une pose de la GCV2 dans le lot. Données synthétiques. Un lot par fichier (durée des essais). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev, j, marquerL1, decisions } = require('./helpers/garde-appuis.cjs');

test('écriture rallumée : une pose refusée par la garde n’est jamais écrite, même après « Relancer »', async () => {
  const x = await lotPasse({ passe: { ecriture: true, passes: 1 }, deux: true, surPasse: marquerL1([111, 113, 115]) });
  await relancer(x);
  assert.deepEqual(x.pasPasse, []); assert.deepEqual(x.adapter.enPlace, []);
  assert.equal(ev(x.b, 'passe-differes-ecriture').length, 0);
  assert.ok(ev(x.b, 'passe-differes-ombre').every(e => e.decision === 'rien' && e.motif === 'garde-appuis' && e.garde.bloque === true));
  assert.ok(!ev(x.b, 'validation-accepted').some(q => q.passeDifferes), 'aucune validation de la passe');
});
