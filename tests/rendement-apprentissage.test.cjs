'use strict';
/* Essais de tools/rendement-apprentissage.cjs : l'entonnoir d'un lot vers l'apprentissage, sur des tables de jointure fictives. Aucune donnée de terrain. */
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../tools/rendement-apprentissage.cjs');

const ecart = (g, d) => ({ gauche: { repere: 'profil', lateralMm: g, verticalMm: 0, dist3dMm: Math.abs(g) }, droite: { repere: 'profil', lateralMm: d, verticalMm: 0, dist3dMm: Math.abs(d) }, maxDist3dMm: Math.max(Math.abs(g), Math.abs(d)) });
const motif = (g, d) => ({ statut: 'DEFERRED_UNRESOLVED', gauche: { statut: 'unresolved', motif: g }, droite: { statut: d === 'candidate' ? 'candidate' : 'unresolved', motif: d } });
const L = (partie, cut, classe, plus) => ({ partie, cut, classe, dansEcho: false, dansJournal: classe !== 'hors-journal', visitesEcho: 0, motifDiffere: null, referenceHumaine: 'absent-de-l-echo', etiquetteEcho: null, ...plus });
const vu = (et, duree, e, geste) => ({ dansEcho: true, visitesEcho: 1, referenceHumaine: 'observee', etiquetteEcho: et, dureeVisiteS: duree, gesteValidationS: geste ?? 0.3, ecartHumain: e });

function tableFictive() {
  return { format: 'ariane-jointure-v2', table: [
    /* Posés par Ariane : 4, dont 1 jugé (corrigé de 6 mm) et 1 visité sans décision. */
    L(7, 1, 'posee'), L(7, 2, 'posee'), L(7, 3, 'posee', vu('VALIDATE_CORRECTED_LEFT_ONLY', 2.1, ecart(6, 0))),
    L(7, 4, 'posee', { dansEcho: true, visitesEcho: 1, referenceHumaine: 'sans-reference', etiquetteEcho: 'PASS_NO_DECISION' }),
    /* Différés : 5. Deux « sans nuage » (blocage), jugés ; un hors contrat jugé à 140 mm ; un garde après différé validé sans bouger en 0,9 s ; un non vu. */
    L(7, 10, 'differee', { motifDiffere: motif('input', 'input'), ...vu('VALIDATE_CORRECTED_BOTH', 2.4, ecart(-104, -55)) }),
    L(7, 11, 'differee', { motifDiffere: motif('input', 'input'), ...vu('VALIDATE_CORRECTED_BOTH', 3.1, ecart(30, 28)) }),
    L(7, 12, 'differee', { motifDiffere: motif('gauge-out-of-contract', 'gauge-out-of-contract'), ...vu('VALIDATE_CORRECTED_BOTH', 7.8, ecart(0, 140)) }),
    L(7, 13, 'differee', { motifDiffere: motif('candidate', 'candidate'), ...vu('VALIDATE_NO_MOVEMENT', 0.9, ecart(0, 0), null) }),
    L(7, 14, 'differee', { motifDiffere: motif('minTop', 'candidate') }),
    /* Hors journal : 2 vus, 1 corrigé de 7 mm, 1 validé sans bouger en 1,1 s. */
    L(7, 20, 'hors-journal', vu('VALIDATE_CORRECTED_BOTH', 2.7, ecart(7, 3))),
    L(7, 21, 'hors-journal', vu('VALIDATE_NO_MOVEMENT', 1.1, ecart(0, 0), null)),
  ] };
}
/* Qualification des états initiaux (Écho) : par cut, la paire est qualifiée ou non. */
const eligibilite = new Map([['7:3', true], ['7:10', true], ['7:11', false], ['7:12', true], ['7:13', true], ['7:20', true], ['7:21', false]]);

test('entonnoir : du lot aux cuts qui portent une information pour l’apprentissage', () => {
  const r = R.analyser([tableFictive()], { eligibilite });
  const p = r.parties[0];
  assert.equal(p.partie, 7);
  assert.deepEqual(p.lot, { cuts: 9, poses: 4, differes: 5, differesSansNuage: 2 });
  assert.deepEqual(p.echo, { cutsVus: 8, references: 7, posesJuges: 1, differesJuges: 4, horsJournalJuges: 2 });
  assert.equal(p.couverturePoses.jugés ?? p.couverturePoses.juges, 1);
  assert.equal(p.couverturePoses.poses, 4);
  assert.deepEqual(p.etiquettes, { sansMouvement: 2, sansMouvementRapide: 2, visitesCourtes: 2, corrigees: 5, plus10mm: 3, plus50mm: 2 });
  assert.deepEqual(p.differesJuges.parMotif, { 'input/input': { n: 2, plus50mm: 1, medianeMm: 67 }, 'gauge-out-of-contract/gauge-out-of-contract': { n: 1, plus50mm: 1, medianeMm: 140 }, 'candidate/candidate': { n: 1, plus50mm: 0, medianeMm: 0 } });
  assert.equal(p.differesJuges.sansTraitsAriane, 2, 'différés « aucun point » : aucune hypothèse de la GCV2 au lot');
  assert.deepEqual(p.apprenables, { references: 7, paireQualifiee: 5, informatifs: 2 }, 'informatif = paire qualifiée et correction de plus de 10 mm (cuts 10 et 12 ; le 11 n’a pas de paire qualifiée)');
  assert.equal(r.total.lot.cuts, 9);
  assert.equal(r.total.apprenables.informatifs, 2);
});

test('sans éligibilité : la paire qualifiée n’est pas inventée', () => {
  const r = R.analyser([tableFictive()]);
  assert.equal(r.parties[0].apprenables.paireQualifiee, null);
  assert.equal(r.parties[0].apprenables.informatifs, null);
  const txt = R.texte(r);
  assert.match(txt, /non mesuré/);
  assert.match(txt, /Partie 7/);
  assert.doesNotMatch(txt, /[0-9a-f]{8}-[0-9a-f]{4}/);
});

test('arguments', () => {
  assert.throws(() => R.lireArguments([]), /--table/);
  const a = R.lireArguments(['--table', 'a.json', '--table', 'b.json', '--echo', 'd', '--json', 's.json']);
  assert.deepEqual(a.tables, ['a.json', 'b.json']);
  assert.deepEqual(a.echo, ['d']);
});
