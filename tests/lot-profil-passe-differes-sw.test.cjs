'use strict';
/* Cap 5b (fiches/PASSATION_CAP5_B.md § 15) — DEUXIÈME PASSE EN OMBRE dans le service worker (réglage `lot.passeDifferes` de src/settings.js : `ecriture:false` ; `ombre:false` la coupe).
 * Service worker réel en VM (tests/helpers/lot-profil.cjs) : cuts 111 à 114, le 112 sans point (différé). La GCV2 est forcée à « valider » sur le 112
 * pendant la passe seulement. La passe relit le nuage du magasin, décide avec les voisins de fin de lot (111 ET 113) et ne touche PAS à ESV. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { production, base, K, S, EsvTrou, SCOPE, ev, attendre } = require('./helpers/lot-profil.cjs');

async function lot({ passe, profil = null }) {
  const adapter = new EsvTrou([]), b = production({ adapter });
  b.ctx.BananeSettings = { ...b.ctx.BananeSettings, voiePrediteOmbre: { ...S.voiePrediteOmbre, actif: false },
    lot: { ...S.lot, ...(profil ? { profil } : {}), passeDifferes: { ...S.lot.passeDifferes, ...(passe ? { ecriture: false, passes: 1 } : { ombre: false }) } } };
  const G = b.ctx.BananeGcv2L1, appels = [];
  b.ctx.BananeGcv2L1 = { ...G, deciderDiffere: a => {
    const cut = a.capture.identity.cut;
    appels.push({ cut, voisins: (a.voisins || []).map(v => v.identity.cut).sort(), transport: (a.voisinsTransport || []).map(v => v.identity.cut), zone: a.zone, sansVoieRien: G.leviersActifs().sansVoieRien });
    /* Dans le lot, la GCV2 tombe en panne sur le 112 : il est différé. Dans la passe, elle valide. */
    if (cut === 112 && appels.filter(x => x.cut === 112).length < 2) throw Error('panne simulée de la GCV2');
    const r = G.deciderDiffere(a);
    if (cut !== 112) return r;
    const p0 = b.store.events.find(e => e.type === 'gcv1-shadow-observed' && e.identity?.cut === 111)?.lotObservation?.positions;
    const paire = { left: { decal: G.decalage(a.capture.rails.left, p0.left) }, right: { decal: G.decalage(a.capture.rails.right, p0.right) } };
    return { ...r, decision: { ...r.decision, etat: 'valider', motif: null, p: 0.9, paire, hypothese: 'H1', ecartDepartMm: 1 }, positions: G.positionsDe(a.capture, paire) };
  } };
  await b.api('connect', { tabId: 1 }); await b.api('settings', { mode: 'automatic-test' });
  adapter.identity.cut = 111; adapter.rails = K.clone(base.rails); adapter.ajuster();
  await b.api('start', { part: 23, start: 111, end: 114, ...SCOPE }); await b.settle(); await attendre(30);
  const cours = b.get('passeDiff').cours; if (cours) await cours; await attendre(30);
  return { b, adapter, appels };
}

test('deuxième passe en ombre : voisins de fin de lot (avant ET après), décision journalisée, aucune écriture vers ESV ; coupée explicitement', async () => {
  const off = await lot({ passe: false });
  assert.equal(ev(off.b, 'passe-differes-ombre-fin').length, 0, 'coupée (ombre:false) : aucune passe');
  const on = await lot({ passe: true });
  const fin = ev(on.b, 'passe-differes-ombre-fin'); assert.equal(fin.length, 1, 'une passe par lot');
  assert.equal(fin[0].mode, 'ombre'); assert.equal(fin[0].differes, 1, 'le 112 est le seul différé'); assert.deepEqual(fin[0].cuts, [112], 'le 112 serait posé');
  const dec = ev(on.b, 'passe-differes-ombre'); assert.equal(dec.length, 1); assert.equal(dec[0].decision, 'poserait'); assert.equal(dec[0].identity.cut, 112);
  assert.ok(['left', 'right'].every(s => dec[0].decal[s].length === 3 && dec[0].decal[s].every(Number.isFinite)));
  /* Voisins : pendant le lot, le 112 ne connaît que le 111 ; pendant la passe, le 111 ET le 113. */
  const a112 = on.appels.filter(x => x.cut === 112);
  assert.equal(a112.length, 2); assert.ok(a112[0].voisins.includes(111) && !a112[0].voisins.includes(113), 'dans le lot : avant seulement');
  assert.ok(a112[1].voisins.includes(111) && a112[1].voisins.includes(113), 'dans la passe : avant ET après');
  /* Aucune écriture : les commandes envoyées à ESV sont celles du lot sans passe. */
  assert.deepEqual(on.adapter.calls, off.adapter.calls, 'la passe n\'envoie rien à ESV');
  assert.equal(ev(on.b, 'l1-pose-sans-valider').length, 0);
  /* Leviers de la passe (`sansVoieRien`) : réglés le temps de l'appel dans la passe seulement, rendus ensuite. */
  assert.deepEqual(a112.map(x => x.sansVoieRien), [false, true]); assert.equal(on.b.ctx.BananeGcv2L1.leviersActifs().sansVoieRien, false);
});
