'use strict';
/* Garde A de la deuxième passe des différés (src/garde-passe-appuis.js, fiches/GARDE_PASSE_A.md), BRANCHÉE dans le service worker (`passeDiffOmbre`), en ombre comme en écriture.
 * Service worker réel en VM, ESV simulé (tests/helpers/passe-differes.cjs) : lot 111 à 115, les cuts 112 et 114 différés puis forcés à « valider » pendant la passe, à la pose
 * du 111 (38,4 mm du départ, pire rail). La chaîne normale du lot : 111, 113 et 115 (première passe). `surPasse` marque des voisins comme poses de L1 (GCV2 dans le lot),
 * comme le fait `lotCommands[cut].l1` pour une pose de la GCV2 dans le lot. Données synthétiques. Un lot par fichier (durée des essais). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev, j, marquerL1, decisions } = require('./helpers/garde-appuis.cjs');

test('ombre : les poses de la GCV2 dans le lot ne sont pas des appuis ; sans chaîne normale, la garde dit « rien » (motif garde-appuis) et le journalise', async () => {
  const x = await lotPasse({ ecritureAllumee: false, passe: {}, deux: true, surPasse: marquerL1([111, 113, 115]) });
  assert.deepEqual(decisions(x.b), [[112, 1, 'rien', 'garde-appuis'], [114, 1, 'rien', 'garde-appuis']], 'une seule passe : rien n’est posé, la seconde ne part pas');
  for (const e of ev(x.b, 'passe-differes-ombre')) {
    assert.deepEqual(j(e.garde), { bloque: true, motif: 'garde-appuis', deplacementMm: 38.4, appuiNormalCuts: null });
    assert.ok(['left', 'right'].every(s => e.decal[s].length === 3), 'le décalage refusé est journalisé');
  }
  const fin = ev(x.b, 'passe-differes-ombre-fin')[0]; assert.deepEqual(fin.cuts, []); assert.equal(fin.posees, 0); assert.equal(fin.differes, 2);
  assert.deepEqual(x.pasPasse, [], 'rien n’est envoyé à ESV');
});
