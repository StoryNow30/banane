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
  /* Fin de l'essai : la reprise seule (CH-109) attend un rechargement d'ESV jusqu'à 90 s ; on arrête la relecture pour qu'elle abandonne son attente. */
  await b.api('relecture-arreter');
});
