'use strict';
/* CH-124 : la liste du DÉPART d'un lot reconstituée par le banc (`listeDeDepart`, tools/banc-differes.cjs) depuis le dernier instantané exporté.
 * Un cut du lot traité depuis (drapeau « traité ») était INVALIDE au départ : le lot ne traite que les invalides (la fiche de départ en compte autant que de cuts
 * du lot). Il revient donc à sa pose de départ, sans drapeau et INVALIDE : hors de la référence d'écartement de la décision L1-e et hors de la voie courante de
 * l'ancre, comme le service worker l'a vu. Données de synthèse. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const Banc = require('../tools/banc-differes.cjs');
const T = [1200.5, 3400.25, 12];
function table() { const st = [], fl = [], ed = []; for (let i = 0; i < 40; i++) { st.push(0); fl.push(0); ed.push(i * 10000, 14350, 0, i * 10000, 0, 0); } return { n: 40, st, fl, ed }; }
const depart = (t, i, dG = [0, 0, 0], dD = [0, 0, 0]) => ({ left: [0, 1, 2].map(k => t.ed[6 * i + k] / 1e4 - T[k] + dG[k]), right: [0, 1, 2].map(k => t.ed[6 * i + 3 + k] / 1e4 - T[k] + dD[k]) });
test('cuts du lot traités : pose de départ, sans drapeau, INVALIDES ; les autres lignes ne changent pas', () => {
  const t = table(), lot = [];
  /* 10 à 13 : posés par le lot puis validés (ligne réécrite à 150 mm, drapeau 1, valide) ; 14 : différé jamais traité (toujours invalide, à sa pose de départ) ; 20 : traité par l'opérateur hors lot */
  /* la pose réelle du lot (150 mm à gauche du départ) est celle que la ligne porte : elle donne la translation monde − scène, comme la pose de départ des lignes intactes */
  for (const i of [10, 11, 12, 13]) { lot.push({ cut: i, depart: depart(t, i), pose: depart(t, i, [0, 0.15, 0], [0, 0.15, 0]) }); t.ed[6 * i + 1] += 1500; t.ed[6 * i + 4] += 1500; t.fl[i] = 1; t.st[i] = 0; }
  t.st[14] = 1; lot.push({ cut: 14, depart: depart(t, 14), pose: null });
  t.fl[20] = 3;
  const D = Banc.listeDeDepart(t, lot); assert.ok(D); assert.equal(D.remises, 4);
  for (const i of [10, 11, 12, 13]) { assert.equal(D.table.fl[i], 0); assert.equal(D.table.st[i], 1, `cut ${i} : invalide au départ`); assert.equal(D.table.ed[6 * i + 1], 14350); assert.equal(D.table.ed[6 * i + 4], 0); }
  assert.equal(D.table.st[14], 1); assert.equal(D.table.fl[14], 0);
  assert.equal(D.table.fl[20], 3); assert.equal(D.table.st[20], 0);
  assert.equal(D.table.st.filter(v => v === 1).length, 5, 'autant d’invalides que de cuts du lot');
  /* appliquée à une liste déjà du départ, elle ne change rien */
  const D2 = Banc.listeDeDepart(D.table, lot); assert.deepEqual(D2.table.st, D.table.st); assert.deepEqual(D2.table.fl, D.table.fl); assert.deepEqual(D2.table.ed, D.table.ed);
});
