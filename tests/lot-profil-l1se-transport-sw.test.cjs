'use strict';
/* 4.9.5.15 (fiches/L1_CAP5.md) — LE PROFIL DU LOT « L1-se » (défaut) : une pose validée de la GCV2 devient voisine de TRANSPORT pour la voie de
 * référence de la GCV2 sur les cuts suivants du même lot (levier `transport` de src/gcv2-l1.js), jamais appui de la chaîne (D-221 tenu).
 * Montage commun : tests/helpers/lot-profil.cjs. Données synthétiques ; la décision de la GCV2 est forcée sur 112. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotDiffere, d112, decisions } = require('./helpers/lot-profil.cjs');

for (const profil of ['L1-s', 'L1-se']) test(`profil « ${profil} » : pose validée de la GCV2 ${profil === 'L1-se' ? 'gardée pour le transport' : 'sans transport'}, jamais appui`, async () => {
  const x = await lotDiffere({ etat: 'valider', profil: profil === 'L1-se' ? null : profil });
  const d = d112(x); assert.equal(d.command.reason, 'gcv2-l1'); assert.equal(d.command.l1s, 'gcv2'); assert.notEqual(d.anchorHeld, true, 'pas un appui');
  const t = JSON.parse(JSON.stringify(x.b.get('l1eTransport')));
  if (profil === 'L1-se') {
    assert.deepEqual(t.poses.map(p => p.identity.cut), [112], 'la pose de la GCV2 sur 112 est gardée pour le transport');
    const p = t.poses[0];
    assert.ok(['left', 'right'].every(s => p.positions[s].length === 3 && Array.isArray(p.rails[s].sceneRelativeToProfileLocal)), 'positions et pose de départ de la capture');
  } else assert.equal(t.poses.length, 0, 'L1-s : pas de transport');
  const d113 = decisions(x.b).find(([c]) => c === 113)[1]; assert.ok(!(d113.anchorsUsed || []).includes(112), '113 ne s\'appuie pas sur 112');
});
