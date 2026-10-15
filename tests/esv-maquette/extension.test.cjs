'use strict';
/* Banc « extension réelle » : l'extension du dépôt chargée dans Chromium, l'hôte
 * d'ESV routé vers la maquette, un lot Orbite de deux cuts lancé par les
 * messages du panneau (tools/banc-esv.cjs). Prouve la chaîne service worker →
 * pont → adaptateur → page sur la maquette ; ne prouve rien sur le vrai ESV.
 *   node --test --test-timeout=120000 tests/esv-maquette/extension.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs'),{banc}=require('../../tools/banc-esv.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
test('lot Orbite de deux cuts, extension réelle, maquette ESV',opts,async()=>{
  /* décalage 5 : les cuts 105 et 106 du scénario sont résolus par le moteur (posés puis validés) ; 100 à 102 sont différés. */
  const r=await banc({cuts:2,decalage:5,latence:30,delai:60000});
  assert.deepEqual(r.erreurs,[],'aucune erreur de page, de panneau, de service worker ni de route');
  assert.ok(['STOPPED','COMPLETED','PAUSED'].includes(r.etatFinal),'lot terminé : '+r.etatFinal+' — '+r.notice);
  assert.ok(r.commandes.capture>=2,'une capture par cut au moins : '+JSON.stringify(r.commandes));
  assert.equal(r.cuts.length,2,'deux cuts dans le journal');
  assert.ok(r.maquette.chargements>=2,'la maquette a chargé les deux cuts');
  assert.ok(r.commandes.apply>=1&&r.commandes.validateAndNext>=1,'au moins une pose validée : '+JSON.stringify(r.commandes));
  assert.ok(r.ecrituresServeur.some(e=>e.status==='valid'),'une écriture « valid » reçue par le serveur');
  console.log(`# lot : ${r.etatFinal}, ${r.dureeLotMs} ms, commandes ${JSON.stringify(r.commandes)}, écritures ${r.ecrituresServeur.length}, cuts ${r.cuts.map(c=>c.cut+':'+c.dureeMs+'ms').join(' ')}`);
});
