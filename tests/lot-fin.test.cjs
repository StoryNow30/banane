'use strict';
/* 4.7.19 — le Pilote s'arrête au dernier cut du lot (retour terrain du 25/09) :
 * le bouton d'ESV valide ET charge le cut non validé suivant, au besoin dans la
 * partie suivante. Au dernier cut, la paire est posée, pas validée ; un cut non
 * résolu (politique « différer ») est laissé sans commande ni navigation. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js');
const {lot}=require('./helpers/pilote-lot.cjs');

test('dernier cut posé, non validé : ESV reste sur le cut',async()=>{
  const r=await lot(L,{start:100,end:100});
  assert.equal(r.view.batch.state,'STOPPED');assert.equal(r.view.batch.stoppedAtEnd.cut,100);assert.equal(r.view.batch.stoppedAtEnd.applied,true);
  assert.equal(r.applied.length,1,'paire posée');
  assert.equal(r.b.adapter.calls.includes('validate'),false,'aucune validation');assert.equal(r.b.adapter.identity.cut,100,'ESV reste sur le cut');
});

test('dernier cut non résolu, politique « différer » : ni commande ni navigation',async()=>{
  const retiree={...L,decideCut:()=>({version:L.DEFAULTS.version,stage:'deferred',reason:'guard',guardDeferred:true,guardMm:40,anchorsUsed:[99]})};
  const r=await lot(retiree,{start:100,end:100});
  assert.equal(r.view.batch.state,'STOPPED');assert.equal(r.view.batch.stoppedAtEnd.applied,false);
  assert.equal(r.applied.length,0);assert.equal(r.view.batch.deferred.length,0,'pas de différé : aucune navigation');
  assert.equal(r.b.adapter.identity.cut,100);
});

test('reprise refusée sans lot Pilote précédent qui ait des différés',async()=>{
  const {pilote}=require('./helpers/pilote-lot.cjs');const {b}=await pilote(L,{start:100,end:100});await b.settle();
  await assert.rejects(()=>b.api('start',{part:23,start:100,end:100,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',
    geometryEngine:'geometry-candidate-v1',unresolvedPolicy:'defer',lotDecision:'apply',lotReprise:true}),/aucun cut différé/);
});
