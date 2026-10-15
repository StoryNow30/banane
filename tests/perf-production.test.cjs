'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs');const {SimulatedESV}=require('./fixtures.cjs');
const {measure}=require('../tools/perf-phases.cjs');
async function lot(enabled,options={}){const b=production({enabled,adapter:options.adapter});
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply',...options.scope});
 const view=await b.settle(),journal=await b.api('journal');return {b,view,journal,m:measure(journal)};}
test('imports réels de production : mêmes commandes, ordre, arguments et positions avec/sans V1',async()=>{
 const a=await lot(false),b=await lot(true);
 assert.deepEqual(normalize(b.b.commands),normalize(a.b.commands));assert.deepEqual(normalize(b.b.adapter.rails),normalize(a.b.adapter.rails));
 assert.equal(b.view.batch.state,a.view.batch.state);assert.deepEqual(normalize(b.b.adapter.calls),normalize(a.b.adapter.calls));
 assert.equal(b.m.available,true);assert.equal(b.m.visits.length,2);assert.equal(b.m.lots[0].coverage.missing.length,0);
 assert.ok(b.m.lots[0].coverage.overlap.length>=1,'la navigation combinée doit rester un chevauchement');
 assert.equal(b.m.visits[0].phases[0].reason,'already-visible');assert.equal(b.m.visits[1].phases[4].reason,'last-cut-left-unvalidated');
 const spans=b.journal.events.filter(e=>e.type==='phase-timing'&&e.kind==='span');
 assert.equal(spans.filter(s=>s.label==='v46-pair-complete').length,2);assert.equal(spans.filter(s=>s.label==='v46-scientific').length,4);
 assert.ok(spans.filter(s=>s.label==='v46-scientific').every(s=>s.inputKind==='initial'&&s.analysisId&&s.inputId));
 assert.equal(b.m.lots[0].coverage.complete,false);assert.ok(b.m.lots[0].instrumentation.maxEventBytes<4096);
});
test('différé sur les imports réels : toutes les visites présentes, aucune pose ni validation ajoutée',async()=>{
 const aa=new SimulatedESV(),bb=new SimulatedESV();aa.noPoints=bb.noPoints=true;
 const a=await lot(false,{adapter:aa}),b=await lot(true,{adapter:bb});
 assert.deepEqual(normalize(b.b.adapter.calls),normalize(a.b.adapter.calls));assert.ok(!bb.calls.includes('apply'));assert.ok(!bb.calls.includes('validate'));
 assert.equal(b.m.visits.length,2);assert.equal(b.m.lots[0].coverage.missing.length,0);
 assert.ok(b.m.visits.every(v=>v.phases[3].status==='inapplicable'));assert.equal(b.m.lots[0].coverage.complete,false,'projet absent reste une limite');
});
