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


test('défaut allumé, mais l’opérateur a éteint le réglage dans le panneau : son choix l’emporte (F5 = erreur, comme avant)', async () => {
  const { b } = await lotPause({ actif: false, esv: (a, bb) => { defaut(bb, { defautActif: true, defautF5: 'pause' }); a.panneCapture.add(110); } });
  const p = await H.finPasse(b);
  assert.equal(p.etat, 'erreur'); assert.equal(H.evenements(b, 'relecture-pause').length, 0);
});
