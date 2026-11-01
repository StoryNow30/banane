'use strict';
/* CH-034 — RECHERCHE LARGE dans la DEUXIÈME PASSE (background.js, `passeDiffRechercheLarge`, réglage `lot.rechercheLarge` allumé avec `passe:true`) : une pose que la
 * passe s'apprête à écrire et que le module juge « différer » n'est pas écrite (décision « rien », motif `recherche-large`, journalisée avec le résumé du module) ; une pose
 * jugée « garde » suit son chemin. Service worker réel en VM, ESV simulé (tests/helpers/passe-differes.cjs : cuts 112 et 114 différés puis forcés à « valider » pendant la
 * passe). La décision du module est forcée (le module pur est essayé dans tests/recherche-large.test.cjs). Passe en ombre : rien n'est envoyé à ESV. Données synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, ev, j, decisions } = require('./helpers/garde-appuis.cjs');
const S = require('../src/settings.js');

test('passe : « différer » forcé sur le 112 → rien (recherche-large) ; « garde » sur le 114 → poserait ; le module est appelé avec le nuage de la passe', async () => {
  const appels = [];
  const surPasse = (b) => {
    if (b.ctx.BananeSettings.lot.rechercheLarge.actif) return;
    b.ctx.BananeSettings = { ...b.ctx.BananeSettings, lot: { ...b.ctx.BananeSettings.lot, rechercheLarge: { ...S.lot.rechercheLarge, actif: true, passe: true } } };
    const RL = b.ctx.BananeRechercheLarge;
    b.ctx.BananeRechercheLarge = { ...RL, decider: a => { const cut = a.capture?.identity?.cut ?? null; appels.push({ cut, mode: a.R.mode, rails: !!(a.capture.rails && a.capture.rails.left) });
      const base = { version: 'essai', mode: 'differer', ms: 1, cellules: { left: 1, right: 1, relances: 7 }, nPaires: 1, paireLot: null, meilleure: null, concurrente: null, positions: null };
      return cut === 112 ? { ...base, etat: 'differer', motif: 'pose-sans-paire-forte' } : { ...base, etat: 'garde', motif: 'pose-unique' }; } };
  };
  const x = await lotPasse({ ecritureAllumee: false, passe: {}, deux: true, surPasse });
  const d = decisions(x.b);
  assert.ok(d.some(([c, , dec, m]) => c === 112 && dec === 'rien' && m === 'recherche-large'), JSON.stringify(d));
  assert.ok(d.filter(([c]) => c === 112).every(([, , dec, m]) => dec === 'rien' && m === 'recherche-large'), 'le 112 n’est jamais posé');
  assert.ok(d.some(([c, , dec]) => c === 114 && dec === 'poserait'), 'le 114 (garde) est posé en ombre : ' + JSON.stringify(d));
  const e = j(ev(x.b, 'passe-differes-ombre')).find(e => e.identity.cut === 112);
  assert.equal(e.rechercheLarge.etat, 'differer'); assert.equal(e.rechercheLarge.motif, 'pose-sans-paire-forte'); assert.equal(e.garde.bloque, false, 'la garde A avait laissé passer');
  assert.ok(appels.some(a => a.cut === 112) && appels.some(a => a.cut === 114), JSON.stringify(appels));
  assert.ok(appels.every(a => a.mode === 'differer' && a.rails), 'mode « différer » forcé, capture de la passe transmise (les cuts forcés du montage sont capturés sans point)');
  assert.deepEqual(x.pasPasse, [], 'ombre : rien n’est envoyé à ESV');
});
