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


test('défaut allumé avec « arrêter » au F5 : le réglage se lit allumé, F5 = arrêt ; valeurs illisibles du défaut : éteint, pause', async () => {
  let lu = null;
  const { b } = await lotPause({ actif: null, esv: (a, bb) => { defaut(bb, { defautActif: true, defautF5: 'arret' }); a.panneCapture.add(110);
    a.surAller = async t => { if (t.cut === 109 && !lu) lu = (await bb.api('relecture-etat')).repriseReglage; }; } });
  const p = await H.finPasse(b);
  assert.deepEqual(js(lu), { actif: true, f5: 'arret' }); assert.equal(p.etat, 'erreur');
  defaut(b, { defautActif: 'oui', defautF5: 'x' });
  assert.deepEqual(js((await b.api('relecture-etat')).repriseReglage), { actif: false, f5: 'pause' });
});
