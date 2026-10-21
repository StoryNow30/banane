'use strict';
/* Test 17 (fiches/PASSATION_T17_INTEGRATION.md) — fusion pause de la relecture + deuxième passe : une relecture EN PAUSE tient ESV (elle y reste « active »), la deuxième passe en écriture n'y écrit donc pas tant qu'on n'a pas
 * Repris ou Arrêté la relecture ; « Reprendre » est refusée tant que la deuxième passe écrit. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, ev } = require('./helpers/passe-differes.cjs');
const attendre = ms => new Promise(r => setTimeout(r, ms));

test('relecture en pause : la deuxième passe en écriture ne part pas (relancée à la main), puis part après « Arrêter la relecture »', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, relecture: 'ombre' });
  assert.match(ev(x.b, 'passe-differes-ecriture-fin').at(-1).raison, /pose d’Ariane attend ta validation au cut 113/);
  await x.b.api('relecture-pause-reglage', { actif: true, f5: 'pause' });
  /* L'opérateur valide le dernier cut (ESV passe à un autre cut), lance la relecture, la met en pause. */
  x.adapter.identity.cut = 114;
  const lot = x.b.get('engine').s.batch; lot.stoppedAtEnd = { ...lot.stoppedAtEnd, at: new Date(Date.now() - 60000).toISOString() };
  const aller = x.adapter.goToCut.bind(x.adapter); let demande = false;
  x.adapter.goToCut = async (...a) => { if (!demande) { demande = true; await x.b.api('relecture-pause'); } return aller(...a); };
  await x.b.api('relecture-lancer');
  for (let i = 0; i < 600 && x.b.get('relecture').passe?.etat !== 'en-pause'; i++) await attendre(10);
  assert.equal(x.b.get('relecture').passe.etat, 'en-pause');
  const avant = x.adapter.enPlace.length;
  await assert.rejects(x.b.api('passe-differes-ecrire'), /Relecture en pause/);
  await x.b.get('passeDiffEcrireDemande')(); await x.b.get('passeDiff').cours; await attendre(50);
  const fin = ev(x.b, 'passe-differes-ecriture-fin').at(-1);
  assert.equal(fin.issue, 'refus-depart'); assert.match(fin.raison, /relecture/); assert.equal(x.adapter.enPlace.length, avant, 'rien n’est écrit dans ESV pendant la pause');
  await x.b.api('relecture-arreter');
  await x.b.api('passe-differes-ecrire'); await x.b.get('passeDiff').cours; await attendre(50);
  assert.equal(ev(x.b, 'passe-differes-ecriture-fin').at(-1).issue, 'fin'); assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112]);
});
