'use strict';
/* CH-116 : le juge du banc (chantiers/CH-116/outils/banc.cjs) sur un corpus et un rejeu fabriqués. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

test('banc CH-116 : tableau standard, reposés, bons bloqués, D-285, validation croisée', () => {
  const W = fs.mkdtempSync(path.join(os.tmpdir(), 'ch116-'));
  process.env.CH116_TRAVAIL = W; process.env.CH116_CORPUS = path.join(W, 'corpus.jsonl');
  const { LOTS, cle } = require('../chantiers/CH-116/outils/lots.cjs');
  const B = require('../chantiers/CH-116/outils/banc.cjs');
  const e = LOTS.find(x => x.lot === '1111'), k = cle(e), Z = { left: [0, 0, 0], right: [0, 0, 0] };
  const d = (lat) => ({ left: [0, lat, 0], right: [0, lat, 0] });
  const corpus = [
    { cut: 1, sortLot: 'pose', classe: 'juste', poseFinale: Z },
    { cut: 2, sortLot: 'pose', classe: 'juste', poseFinale: Z },             // bon bloqué par le réglage
    { cut: 3, sortLot: 'differe', classe: 'differe-corrige', poseFinale: d(30) }, // reposé juste
    { cut: 4, sortLot: 'differe', classe: 'differe-corrige', poseFinale: d(30) }, // reposé faux (> 50)
    { cut: 5, sortLot: 'pose', classe: 'juste', poseFinale: Z, exclu: 'd285-visite-courte' },
    { cut: 6, sortLot: 'pose', classe: 'non-juge', poseFinale: null, exclu: 'absent-de-l-echo' },
  ].map(c => ({ lot: '1111', partie: e.partie, rang: e.rang, ...c }));
  fs.writeFileSync(process.env.CH116_CORPUS, corpus.map(c => JSON.stringify(c)).join('\n') + '\n');
  const lig = (cut, x) => JSON.stringify({ type: 'cut', cut, reel: {}, profils: { [B.PROFIL]: x } });
  const pose = decal => ({ etat: 'pose', decal }), diff = { etat: 'differe' };
  fs.mkdirSync(path.join(W, 'rejeux', 'r'), { recursive: true });
  fs.writeFileSync(path.join(W, 'rejeux', 'r', k + '.jsonl'), [lig(1, pose(d(4))), lig(2, diff), lig(3, pose(d(33))), lig(4, pose(d(-60))), lig(5, pose(d(20))), lig(6, pose(Z))].join('\n') + '\n');
  const J = B.juger('r', { lots: ['1111'] }), t = J.parLot['1111'];
  assert.deepStrictEqual([t.cuts, t.poses, t.posesJuges, t.juste, t['10-50'], t['plus-50'], t.differes, t.reposesJustes, t.reposesFaux, t.bonsBloques], [6, 5, 3, 2, 0, 1, 1, 1, 1, 1]);
  const J2 = B.juger('r', { lots: ['1111'], avecCourtes: true });
  assert.strictEqual(J2.parLot['1111'].posesJuges, 4); assert.strictEqual(J2.parLot['1111']['10-50'], 1);
  assert.strictEqual(B.cout(t, B.POIDS), 100 + 5 + 1);
  const F = B.fidelite('r', { lots: ['1111'] });
  assert.strictEqual(F[k].cuts, 6);
  assert.match(B.croise({ noms: ['r'], lots: ['1111'], examen: 'aucun' }), /\| 1111 \| r /);
});
