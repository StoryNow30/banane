'use strict';
/* CH-053-S — essais du module src/file-prioritaire.js (file prioritaire des cuts à corriger) et de la simulation tools/file-prioritaire.cjs.
 * Données fictives seulement : aucune donnée de terrain, aucun identifiant. */
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/file-prioritaire.js');

const D = (part, cut, motif) => ({ part, cut, source: 'differe', motif });
const Vt = (part, cut, score) => ({ part, cut, source: 'vert', score });

test('classe : un différé se range d’après le motif des deux rails', () => {
  assert.equal(F.classe(D(1, 1, 'gauge-out-of-contract/gauge-out-of-contract')), 'D-contrat');
  assert.equal(F.classe(D(1, 2, 'input/input')), 'D-sanspoints');
  assert.equal(F.classe(D(1, 3, 'candidate/ambiguity')), 'D-points');
  assert.equal(F.classe(D(1, 4, null)), 'D-points', 'motif inconnu : on suppose des points (le moins optimiste des deux)');
});

test('classe : un vert se range d’après son score, sans score il est « inconnu »', () => {
  assert.equal(F.classe(Vt(1, 1, 2.5)), 'vert-fort');
  assert.equal(F.classe(Vt(1, 2, 1.2)), 'vert-moyen');
  assert.equal(F.classe(Vt(1, 3, 0.3)), 'vert-faible');
  assert.equal(F.classe(Vt(1, 4, null)), 'vert-inconnu');
  assert.equal(F.classe({ part: 1, cut: 5, source: 'posee' }), 'posee-ariane');
});

test('apprendreTaux : compte, part informative, coût et rendement par minute', () => {
  const T = F.apprendreTaux([
    { classe: 'D-contrat', informatif: true, coutS: 4 }, { classe: 'D-contrat', informatif: false, coutS: 2 },
    { classe: 'vert-faible', informatif: false, coutS: 1 }, { classe: 'vert-faible', informatif: false, coutS: 1 },
  ]);
  assert.deepEqual(T['D-contrat'], { n: 2, informatifs: 1, avecTraits: 0, coutS: 6, p: 0.5, parMin: 10 });
  assert.equal(T['vert-faible'].parMin, 0);
  assert.equal(T['D-sanspoints'], undefined, 'une classe sans observation n’a pas de taux');
});

test('ordonner : les classes les plus productives passent d’abord, à rendement égal l’ordre des cuts', () => {
  const taux = F.apprendreTaux([
    { classe: 'D-contrat', informatif: true, coutS: 4 }, { classe: 'D-sanspoints', informatif: true, coutS: 4 }, { classe: 'D-sanspoints', informatif: false, coutS: 4 },
    { classe: 'vert-fort', informatif: true, coutS: 2 }, { classe: 'vert-faible', informatif: false, coutS: 1 },
  ]);
  const R = F.ordonner([D(1, 30, 'input/input'), D(1, 10, 'input/input'), Vt(1, 5, 3), D(1, 20, 'gauge-out-of-contract/gauge-out-of-contract'), Vt(1, 6, 0.1)], { taux });
  assert.deepEqual(R.entrees.map(e => e.cut), [5, 20, 10, 30], 'vert fort (30/min), hors contrat (15/min), puis les deux sans points dans l’ordre des cuts ; le vert faible est écarté');
  assert.deepEqual(R.entrees.map(e => e.rang), [1, 2, 3, 4]);
  assert.equal(R.ecartes.length, 1);
  assert.equal(R.ecartes[0].cut, 6);
});

test('ordonner : tout différé reste dans la file (le travail est dû), même sous le plancher ; un vert sous le plancher est écarté', () => {
  const taux = F.apprendreTaux([{ classe: 'D-points', informatif: false, coutS: 10 }, { classe: 'vert-moyen', informatif: false, coutS: 2 }]);
  const R = F.ordonner([D(1, 1, 'candidate/candidate'), Vt(1, 2, 1.5)], { taux, plancherParMin: 5 });
  assert.deepEqual(R.entrees.map(e => e.cut), [1]);
  assert.equal(R.entrees[0].groupe, 'poser');
  assert.deepEqual(R.ecartes.map(e => e.cut), [2]);
});

test('ordonner : les cuts déjà jugés ne sont pas reproposés (cuts jamais jugés d’abord)', () => {
  const taux = F.apprendreTaux([{ classe: 'D-sanspoints', informatif: true, coutS: 4 }]);
  const R = F.ordonner([D(2, 7, 'input/input'), D(2, 8, 'input/input')], { taux, jugesDeja: new Set(['2:7']) });
  assert.deepEqual(R.entrees.map(e => e.cut), [8]);
  assert.equal(R.dejaJuges, 1);
});

test('ordonner : chaque entrée suit le format de la liste à corriger (part, cut, groupe, signaux, details, rang)', () => {
  const taux = F.apprendreTaux([{ classe: 'vert-fort', informatif: true, coutS: 2 }]);
  const e = F.ordonner([Vt(3, 9, 4)], { taux }).entrees[0];
  assert.equal(e.part, 3); assert.equal(e.cut, 9); assert.equal(e.groupe, 'controler');
  assert.deepEqual(e.signaux, ['vert-fort']);
  assert.equal(e.details.classe, 'vert-fort'); assert.equal(e.details.attenduParMin, 30); assert.equal(e.details.pInfo, 1);
  assert.equal(e.rang, 1);
});

test('ordonner : le critère « avec-traits » range d’abord les différés où Ariane a décidé quelque chose', () => {
  const taux = F.apprendreTaux([
    { classe: 'D-sanspoints', informatif: true, coutS: 2 }, { classe: 'D-points', informatif: true, avecTraits: true, coutS: 4 },
  ]);
  const a = F.ordonner([D(1, 1, 'input/input'), D(1, 2, 'candidate/candidate')], { taux, critere: 'informatif' }).entrees.map(e => e.cut);
  const b = F.ordonner([D(1, 1, 'input/input'), D(1, 2, 'candidate/candidate')], { taux, critere: 'avec-traits' }).entrees.map(e => e.cut);
  assert.deepEqual(a, [1, 2]);
  assert.deepEqual(b, [2, 1]);
});

test('plages : les cuts consécutifs d’une file se lisent comme des plages', () => {
  assert.equal(F.plages([4213, 4214, 4215, 4220, 4231, 4232]), '4213–4215, 4220, 4231, 4232');
});

test('ordonner : sans taux fourni, les taux mesurés le 04/11 servent (module sans état)', () => {
  const R = F.ordonner([D(1, 1, 'input/input'), Vt(1, 2, 3)]);
  assert.equal(R.entrees.length, 2);
  assert.ok(R.taux['vert-fort'].parMin > R.taux['vert-faible'].parMin);
});
