'use strict';
/* F1 (relecture du test 3, fusion 2c2309f) : `measure()` développe les références de dictionnaire des jalons V1 d'un
 * bilan v4 ; les observations passives (`esv-observation`) du MÊME journal doivent rester visibles. Appel direct de
 * measure() sur un bilan brut, sans passer par la ligne de commande perf-lot (qui développe tout avant). Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {measure,toMarkdown}=require('../tools/perf-phases.cjs'),{journal}=require('./helpers/perf-phases.cjs');
const write={type:'esv-observation',schema:1,eventId:'w1',kind:'write',timeOrigin:1000,ms:1600,sessionId:'S',batchId:'B',observer:{id:'obs-1',seq:1},
 status:204,outcome:'done',attempt:1,railPairId:'r',bodyKeys:1,body:{a:1},startedEpochMs:2450,endedEpochMs:2600,durationMs:150};
const avecDictionnaire=j=>{const ident=j.events.find(e=>e.identity).identity;
 return {...j,version:'4.9.0.3',dictionaries:{identities:[ident]},events:j.events.map(e=>e.identity?{...e,identity:{__ref:'identities:0'}}:e)};};
test('bilan v4 à dictionnaire : observations vues par appel direct de measure(), comme sans dictionnaire',()=>{
 const j=journal();j.events.push(write);
 const sans=measure(j,{tous:true}),avec=measure(avecDictionnaire(j),{tous:true});
 assert.equal(sans.observations.available,true,'témoin sans dictionnaire');
 assert.ok(avec.refs.resolved>0,'références développées');
 assert.equal(avec.observations.available,true,'avec dictionnaire : les observations doivent rester visibles');
 assert.equal(avec.observations.writes.n,1);assert.equal(avec.observations.writes.linked,1,'écriture reliée à la visite (fenêtre de temps)');
 assert.equal(avec.observations.writes.rows[0].visitId,'visit');
 const md=toMarkdown(avec);assert.doesNotMatch(md,/Aucune observation passive|Observateur : absent/);assert.match(md,/Écritures : 1 dont 1 acquittée/);
});
test('bilan v4 à dictionnaire sans jalon V1 : les observations restent lues (retour anticipé)',()=>{
 const j=journal();const b=avecDictionnaire({...j,events:[...j.events.map(e=>({...e,batchId:'AUTRE'})),write]});
 const m=measure(b,{batchId:'B',sessionId:'S'});
 assert.equal(m.available,false,'aucun jalon du lot demandé');
 assert.equal(m.observations.available,true);assert.equal(m.observations.writes.n,1);
});
test('les jalons développés servent toujours aux phases (identité lue dans le dictionnaire)',()=>{
 const j=journal();j.events.push(write);const m=measure(avecDictionnaire(j),{tous:true});
 assert.equal(m.visits.length,1);assert.equal(m.visits[0].identity.cut,100);assert.equal(m.visits[0].validContext,true);
});
