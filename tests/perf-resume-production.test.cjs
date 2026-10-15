'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs');
const {SimulatedESV}=require('./fixtures.cjs'),{measure}=require('../tools/perf-phases.cjs');
async function pausedLot(enabled){
 const adapter=new SimulatedESV();let release,entered;const reached=new Promise(r=>entered=r),barrier=new Promise(r=>release=r),capture=adapter.capture;
 let first=true;adapter.capture=async function(...args){if(first){first=false;entered();await barrier;}return capture.apply(this,args);};
 const b=production({enabled,adapter});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'});
 await reached;await b.api('pause');release();const paused=await b.settle();assert.equal(paused.batch.state,'PAUSED');
 await b.api('resume');const view=await b.settle(),journal=await b.api('journal');return {b,view,journal,m:measure(journal)};
}
test('pause/reprise réelle de production : même séquence de commandes et toutes les visites conservées',async()=>{
 const a=await pausedLot(false),b=await pausedLot(true);
 assert.deepEqual(normalize(b.b.commands),normalize(a.b.commands));assert.deepEqual(normalize(b.b.adapter.rails),normalize(a.b.adapter.rails));
 assert.equal(b.view.batch.state,a.view.batch.state);assert.equal(b.m.visits.length,2);assert.equal(b.m.lots[0].coverage.missing.length,0);
 assert.equal(b.m.lots[0].stops.causes.operator,1);assert.equal(b.m.lots[0].stops.interventions.filter(e=>e.name==='resume').length,1);
 assert.equal(b.m.lots[0].coverage.complete,false);
});
