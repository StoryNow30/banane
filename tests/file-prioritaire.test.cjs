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

/* ------------------------------------------------------------------ simulation (tools/file-prioritaire.cjs) */
const S = require('../tools/file-prioritaire.cjs');
const ob = (part, cut, classe, informatif, coutS, extra = {}) => ({ part, cut, classe, informatif, coutS, sautReel: 0, premiereVisite: part * 1000 + cut, ...extra });
function jeuFictif() {
  const o = [];
  for (const p of [1, 2]) {
    o.push(ob(p, 10, 'D-sanspoints', true, 4), ob(p, 11, 'D-sanspoints', true, 4), ob(p, 12, 'D-sanspoints', false, 4));
    for (const c of [50, 51, 52, 53]) o.push(ob(p, c, 'vert-faible', false, 1));
  }
  return o;
}

test('simuler : la pratique actuelle est l’ensemble des cuts visités, dans l’ordre des visites', () => {
  const r = S.simuler(jeuFictif(), { coutSaut: 0 });
  assert.equal(r.actuel.cuts, 14); assert.equal(r.actuel.informatifs, 4); assert.equal(r.actuel.tempsS, 32);
  assert.equal(r.actuel.parMin, 7.5);
});

test('simuler : la file écarte les verts sans rendement ; sans coût de saut, le gain vient du temps non perdu', () => {
  const r = S.simuler(jeuFictif(), { coutSaut: 0 });
  assert.equal(r.file.cuts, 6); assert.equal(r.file.informatifs, 4); assert.equal(r.file.tempsS, 24);
  assert.equal(r.file.parMin, 10); assert.equal(r.file.rapport, 1.33);
});

test('simuler : chaque saut entre cuts non voisins coûte coutSaut (un par partie ici, entrée de la plage)', () => {
  const r = S.simuler(jeuFictif(), { coutSaut: 6 });
  assert.equal(r.file.tempsS, 36); assert.equal(r.file.parMin, 6.7);
  assert.ok(r.file.rapport < 1, 'avec ce saut la file ne gagne rien sur ce jeu fictif : le résultat le dit');
});

test('simuler : le coût d’un saut subi pendant la pratique actuelle est retiré avant de recompter la file', () => {
  const o = jeuFictif().map(x => (x.part === 1 && x.cut === 10 ? { ...x, coutS: 10, sautReel: 1 } : x));
  const r = S.simuler(o, { coutSaut: 6 });
  assert.equal(r.actuel.tempsS, 38);
  assert.equal(r.file.tempsS, 36, 'cut 10 : 10 s mesurés dont 6 de saut → 4 s de base, puis un saut compté une fois en tête de plage');
});

test('simuler : validation croisée par partie (les taux de la partie jugée ne servent pas)', () => {
  const o = jeuFictif().filter(x => x.part === 1).concat(
    [ob(2, 10, 'D-sanspoints', true, 4), ob(2, 50, 'vert-moyen', true, 1)]);
  const r = S.simuler(o, { coutSaut: 0 });
  /* Partie 2 : la classe vert-moyen n’a aucune observation hors partie 2 → pas de taux → le vert est écarté, même s’il était informatif. */
  assert.equal(r.file.informatifs, 2 + 1);
  assert.equal(r.perdus.informatifs, 1);
});

test('simuler : la borne haute ne garde que les cuts informatifs, au coût de base', () => {
  const r = S.simuler(jeuFictif(), { coutSaut: 0 });
  assert.equal(r.borne.cuts, 4); assert.equal(r.borne.tempsS, 16); assert.equal(r.borne.parMin, 15);
});

test('simuler : la tête de file ne garde que les classes au moins aussi productives que la pratique actuelle', () => {
  const o = jeuFictif().concat([ob(1, 20, 'D-points', false, 9), ob(2, 20, 'D-points', false, 9)]);
  const r = S.simuler(o, { coutSaut: 0 });
  assert.equal(r.file.cuts, 8, 'la file complète garde les deux différés D-points (travail dû)');
  assert.equal(r.tete.cuts, 6, 'la tête les laisse pour après');
});

test('etiquetage : retirer les validations sans mouvement de moins de 1,5 s change le dénominateur, jamais le nombre d’informatifs', () => {
  const refs = [
    { etiquette: 'VALIDATE_NO_MOVEMENT', dureeVisiteS: 0.9, qualifiee: true, mm: 0 }, { etiquette: 'VALIDATE_NO_MOVEMENT', dureeVisiteS: 3, qualifiee: true, mm: 0 },
    { etiquette: 'VALIDATE_CORRECTED_BOTH', dureeVisiteS: 2, qualifiee: true, mm: 40 }, { etiquette: 'VALIDATE_CORRECTED_BOTH', dureeVisiteS: 2, qualifiee: false, mm: 40 },
  ];
  const e = S.effetEtiquetage(refs);
  assert.deepEqual({ refs: e.avant.references, app: e.avant.apprenables, inf: e.avant.informatifs }, { refs: 4, app: 3, inf: 1 });
  assert.deepEqual({ refs: e.apres.references, app: e.apres.apprenables, inf: e.apres.informatifs }, { refs: 3, app: 2, inf: 1 });
  assert.equal(e.retirees, 1); assert.equal(e.retireesInformatives, 0);
});

test('plan de séance : tailles de l’échantillon qui démontre D-223 (plus de 50 mm au plus 3 %, borne haute de Wilson à 95 %)', () => {
  assert.equal(S.tailleD223(0), 125);
  assert.equal(S.tailleD223(1), 185);
  assert.equal(S.tailleD223(2), 239);
});

test('ordonner : l’ordre « balayage » garde les mêmes cuts mais les parcourt partie par partie dans l’ordre des cuts', () => {
  const taux = F.apprendreTaux([{ classe: 'D-contrat', informatif: true, coutS: 4 }, { classe: 'D-sanspoints', informatif: true, coutS: 8 }]);
  const c = [D(2, 5, 'input/input'), D(1, 9, 'gauge-out-of-contract/gauge-out-of-contract'), D(1, 3, 'input/input')];
  assert.deepEqual(F.ordonner(c, { taux }).entrees.map(e => e.cut), [9, 3, 5]);
  const b = F.ordonner(c, { taux, ordre: 'balayage' });
  assert.deepEqual(b.entrees.map(e => `${e.part}:${e.cut}`), ['1:3', '1:9', '2:5']);
  assert.equal(b.ordre, 'balayage');
});

test('echantillon : tirage reproductible, sans doublon, borné par les posés disponibles', () => {
  const cuts = Array.from({ length: 200 }, (_, i) => i + 1000);
  const a = S.echantillonPoses(cuts, 125, 42), b = S.echantillonPoses(cuts, 125, 42), c = S.echantillonPoses(cuts, 125, 43);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  assert.equal(new Set(a).size, 125); assert.ok(a.every(x => cuts.includes(x)));
  assert.deepEqual(a, [...a].sort((x, y) => x - y));
  assert.equal(S.echantillonPoses([1, 2, 3], 10, 7).length, 3);
});

test('echantillon : l’ordre du tirage permet de juger par tranches (les 125 premiers forment eux-mêmes un tirage au sort)', () => {
  const cuts = Array.from({ length: 300 }, (_, i) => i);
  const t = S.echantillonPoses(cuts, 239, 9, { ordreDuTirage: true });
  assert.equal(t.length, 239);
  assert.deepEqual([...S.echantillonPoses(cuts, 125, 9, { ordreDuTirage: true })], t.slice(0, 125), 'même graine : la tranche A est le début du tirage complet');
});
