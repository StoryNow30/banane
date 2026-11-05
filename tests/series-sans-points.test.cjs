'use strict';
/* Essais de tools/series-sans-points.cjs sur un journal fictif. Aucune donnée de terrain. */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../tools/series-sans-points.cjs');

const T0 = Date.parse('2026-11-04T12:00:00Z');
const iso = s => new Date(T0 + s * 1000).toISOString();
const ms = s => T0 + s * 1000;
let n = 0;
const capture = (part, cut, s, points, nl) => {
  const requestId = `r-${++n}`;
  return [
    { type: 'adapter-progress', timestamp: iso(s - 0.5), identity: { part, cut }, requestId, action: 'capture', lastStage: 'capture-read',
      lastDetail: { side: 'left', diag: { nl: nl || [0, 0], noeuds: 7, pts: 500000 } } },
    { type: 'adapter-result', timestamp: iso(s), identity: { part, cut }, requestId, action: 'capture', elapsedMs: 1700, lastStage: 'capture-ready',
      lastDetail: { points, nodes: 7 }, batchId: `lot-${part}` },
  ];
};
const differe = (part, cut, s) => ({ type: 'defer-finalized', timestamp: iso(s), identity: { part, cut } });
const valide = (part, cut, s) => ({ type: 'validation-accepted', timestamp: iso(s), identity: { part, cut } });
const requetes = (s, ept, echecs = 0) => ({ type: 'esv-observation', kind: 'resource', class: 'point-resource', timestamp: iso(s), n: ept, ept,
  startedEpochMs: ms(s), endedEpochMs: ms(s) + 200, echecs, statuts: echecs ? { 200: ept - echecs, 502: echecs } : { 200: ept } });
const debut = (part, s) => ({ type: 'batch-started', timestamp: iso(s), identity: { part, cut: 1 }, batch: { id: `lot-${part}`, scope: { part } } });

function journalFictif() {
  const ev = [debut(10, 0)];
  /* Avant la série : des captures pleines, des requêtes de points toutes les 10 s. */
  for (let i = 0; i < 30; i++) ev.push(requetes(1 + i * 10, 2));
  ev.push(...capture(10, 100, 300, 5000), valide(10, 100, 301));
  ev.push(...capture(10, 101, 305, 4800), valide(10, 101, 306));
  /* Une requête en échec, puis la série : quatre captures vides, aucune requête pendant 200 s, compteur bloqué. */
  ev.push(requetes(308, 3, 1));
  ev.push(...capture(10, 200, 310, 0, [1, 1]), differe(10, 200, 311));
  ev.push(...capture(10, 201, 315, 0, [1, 1]), differe(10, 201, 316));
  ev.push(...capture(10, 202, 320, 0, [1, 2]), differe(10, 202, 321));
  ev.push(...capture(10, 203, 325, 0, [1, 1]), differe(10, 203, 326));
  /* Après : les requêtes reprennent, les captures sont pleines. */
  for (let i = 0; i < 20; i++) ev.push(requetes(330 + i * 10, 2));
  ev.push(...capture(10, 300, 340, 6000), valide(10, 300, 341));
  /* Deux captures vides seulement : sous le minimum, pas une série. */
  ev.push(...capture(10, 400, 350, 0), differe(10, 400, 351));
  ev.push(...capture(10, 401, 355, 0), differe(10, 401, 356));
  ev.push(...capture(10, 402, 360, 3000), valide(10, 402, 361));
  /* Autre partie : trois vides d'affilée, mais la troisième est dans une autre partie : deux séries de moins de 3. */
  ev.push(debut(11, 400));
  ev.push(...capture(10, 500, 405, 0), differe(10, 500, 406));
  ev.push(...capture(10, 501, 410, 0), differe(10, 501, 411));
  ev.push(...capture(11, 1, 415, 0), differe(11, 1, 416));
  /* Les événements sont mélangés : l'outil trie par horodatage. */
  return { version: '5', events: ev.slice().reverse() };
}

test('série de captures vides : repérée, bornée, datée, avec les requêtes et l’échec qui précède', () => {
  const R = S.analyser(journalFictif(), { min: 3 });
  assert.equal(R.captures, 13);
  assert.equal(R.vides, 9);
  assert.equal(R.series.length, 1, 'deux vides de suite ne font pas une série ; un changement de partie coupe la série');
  const s = R.series[0];
  assert.equal(s.partie, 10);
  assert.equal(s.captures, 4);
  assert.equal(s.cuts, 4);
  assert.equal(s.cutsDifferes, 4);
  assert.equal(s.premierCut, 200);
  assert.equal(s.dernierCut, 203);
  assert.equal(s.debut, iso(310));
  assert.equal(s.fin, iso(325));
  assert.equal(s.dureeS, 15);
  assert.equal(s.requetes.avant5min, 58 + 3, 'les 29 fenêtres de 2 ept-data dans les 5 min d’avant (celle de la 1re seconde est hors fenêtre), plus celle en échec');
  assert.equal(s.requetes.pendant, 0);
  assert.ok(s.requetes.apres5min >= 20);
  assert.equal(s.echecAvant.delaiS, 2, 'la requête en échec précède la série de 2 s');
  assert.deepEqual(s.echecAvant.statuts, { 200: 2, 502: 1 });
  assert.equal(s.compteurBloque, 4, 'les quatre lectures avaient numNodesLoading ≥ 1');
  assert.equal(R.cutsDifferesDansSeries, 4);
  assert.equal(R.parPartie[10].vides, 8);
  assert.equal(R.parPartie[11].vides, 1);
});

test('sans série : rien d’inventé, comptes à zéro', () => {
  const ev = [debut(3, 0), ...capture(3, 1, 10, 4000), valide(3, 1, 11), ...capture(3, 2, 20, 0), differe(3, 2, 21)];
  const R = S.analyser({ version: '5', events: ev }, { min: 3 });
  assert.equal(R.series.length, 0);
  assert.equal(R.cutsDifferesDansSeries, 0);
  assert.equal(R.dureeSeriesS, 0);
  const txt = S.texte(R, 'fictif');
  assert.match(txt, /aucune série/i);
  assert.doesNotMatch(txt, /[0-9a-f]{8}-[0-9a-f]{4}/, 'aucun identifiant dans le texte');
});

test('texte : une ligne par série, des comptes et des numéros de cut seulement', () => {
  const R = S.analyser(journalFictif(), { min: 3 });
  const txt = S.texte(R, 'fictif');
  assert.match(txt, /Partie 10/);
  assert.match(txt, /200 … 203/);
  assert.match(txt, /502/);
  assert.doesNotMatch(txt, /lot-10|r-\d/, 'ni identifiant de lot ni identifiant de requête');
});

test('arguments : un journal ou un dossier, pas les deux ; minimum entier', () => {
  assert.throws(() => S.lireArguments(['--journal', 'a.json', '--dossier', 'd']), /pas les deux/);
  assert.throws(() => S.lireArguments(['--journal', 'a.json', '--min', 'x']), /--min/);
  const a = S.lireArguments(['--journal', 'a.json', '--journal', 'b.json', '--min', '5', '--json', 's.json']);
  assert.deepEqual(a.journaux, ['a.json', 'b.json']);
  assert.equal(a.min, 5);
  assert.equal(a.json, 's.json');
});
