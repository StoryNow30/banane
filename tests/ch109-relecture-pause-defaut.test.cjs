'use strict';
/* CH-109 (A) — DÉFAUT DE LA PAUSE ET DE LA REPRISE DE LA RELECTURE, réglable (`BananeSettings.relecturePause`, src/settings.js). Quand l'opérateur n'a
 * jamais choisi (aucun réglage gardé, installation neuve), `defautActif` et `defautF5` décident ; un choix de l'opérateur (marqué `v: 2`) l'emporte toujours.
 * D-341 (choix écrit de l'opérateur, 11/11) : ALLUMÉ par défaut. Migration unique : un « éteint » gardé sans marque (posé par l'ancien défaut ou avant
 * D-341) passe à « allumé » une fois, avec la marque ; ensuite un « éteint » choisi est respecté.
 * Allumé par défaut : un F5 (ESV muet) pendant la relecture la met EN PAUSE au cut où elle était (le point gardé), au lieu de l'arrêter en erreur. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../src/settings.js');
const {H,lotPause,attendreEtat}=require('./helpers/relecture-pause.cjs');
const js=x=>JSON.parse(JSON.stringify(x));
const defaut=(bb,v)=>{bb.ctx.BananeSettings={...bb.ctx.BananeSettings,relecturePause:v};};

test('D-341 : livré allumé, « mettre en pause » au F5', () => {
  assert.deepEqual(js(S.relecturePause), { defautActif: true, defautF5: 'pause' });
});

test('migration unique : un « éteint » gardé sans marque passe à « allumé » une fois ; un « éteint » choisi ensuite est respecté', async () => {
  const { b } = await lotPause({ actif: null, esv: (a, bb) => defaut(bb, { defautActif: true, defautF5: 'pause' }) });
  await H.finPasse(b);
  b.local.m.banane51RelecturePauseReglage = { actif: false, f5: 'arret' };
  assert.deepEqual(js((await b.api('relecture-etat')).repriseReglage), { actif: true, f5: 'arret' }, 'migré : allumé, le choix du F5 gardé');
  assert.deepEqual(js(b.local.m.banane51RelecturePauseReglage), { actif: true, f5: 'arret', v: 2 }, 'migration gardée avec sa marque');
  assert.deepEqual(js(await b.api('relecture-pause-reglage', { actif: false, f5: 'pause' })), { actif: false, f5: 'pause' });
  assert.deepEqual(js(b.local.m.banane51RelecturePauseReglage), { actif: false, f5: 'pause', v: 2 }, 'le choix de l’opérateur porte la marque');
  assert.deepEqual(js((await b.api('relecture-etat')).repriseReglage), { actif: false, f5: 'pause' }, 'un « éteint » choisi est respecté');
  /* Défaut éteint : aucune migration. */
  defaut(b, { defautActif: false, defautF5: 'pause' }); b.local.m.banane51RelecturePauseReglage = { actif: false, f5: 'pause' };
  assert.equal((await b.api('relecture-etat')).repriseReglage.actif, false); assert.equal(b.local.m.banane51RelecturePauseReglage.v, undefined);
});

test('défaut allumé, aucun choix gardé : le F5 pendant la relecture la met en pause au cut où elle était, le point est gardé', async () => {
  let lu = null;
  const { b } = await lotPause({ actif: null, esv: (a, bb) => { defaut(bb, { defautActif: true, defautF5: 'pause' }); a.panneCapture.add(110);
    a.surAller = async t => { if (t.cut === 109 && !lu) lu = (await bb.api('relecture-etat')).repriseReglage; }; } });
  const p = await attendreEtat(b, 'en-pause');
  assert.deepEqual(js(lu), { actif: true, f5: 'pause' }, 'le défaut du réglage décide quand rien n’est gardé');
  assert.equal(p.pauseRaison, 'esv'); assert.equal(p.cut, 110, 'gardée au cut où elle était');
  assert.equal(b.local.m.banane51RelectureReprise?.sel?.cuts?.[b.local.m.banane51RelectureReprise.index]?.cut, 110, 'point de reprise au cut 110');
  assert.equal(H.evenements(b, 'relecture-pause').length, 1);
  assert.match(p.message, /relecture gardée en pause au cut 110/);
});

test('défaut allumé, mais l’opérateur a éteint le réglage dans le panneau : son choix l’emporte (F5 = erreur, comme avant)', async () => {
  const { b } = await lotPause({ actif: false, esv: (a, bb) => { defaut(bb, { defautActif: true, defautF5: 'pause' }); a.panneCapture.add(110); } });
  const p = await H.finPasse(b);
  assert.equal(p.etat, 'erreur'); assert.equal(H.evenements(b, 'relecture-pause').length, 0);
});

test('défaut allumé avec « arrêter » au F5 : le réglage se lit allumé, F5 = arrêt ; valeurs illisibles du défaut : éteint, pause', async () => {
  let lu = null;
  const { b } = await lotPause({ actif: null, esv: (a, bb) => { defaut(bb, { defautActif: true, defautF5: 'arret' }); a.panneCapture.add(110);
    a.surAller = async t => { if (t.cut === 109 && !lu) lu = (await bb.api('relecture-etat')).repriseReglage; }; } });
  const p = await H.finPasse(b);
  assert.deepEqual(js(lu), { actif: true, f5: 'arret' }); assert.equal(p.etat, 'erreur');
  defaut(b, { defautActif: 'oui', defautF5: 'x' });
  assert.deepEqual(js((await b.api('relecture-etat')).repriseReglage), { actif: false, f5: 'pause' });
});
