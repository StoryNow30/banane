'use strict';
/* V1, correction proposée (3) : segments d'exécution, réouverture, ERROR et
 * remplacement de lot, sans fabriquer de clôture. Diagnostic partie 23 :
 * lot rouvert puis ERROR, resté sans fin ; navigation postérieure attribuée à
 * une validation en place déjà close. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production}=require('./helpers/perf-production.cjs');
const {Recorder}=require('../src/perf-phase.js'),{id}=require('./helpers/perf-phases.cjs');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
/* Fin de lot, reprise sur la coupe déjà traitée (refus du moteur : ERROR), puis
 * nouveau lot : le premier n'a plus de fin connue. */
const runs=new Map();
function reopenedThenError(enabled){if(!runs.has(enabled))runs.set(enabled,run(enabled));return runs.get(enabled);}
async function run(enabled){
 const b=production({enabled});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 await b.api('start',{part:23,start:100,end:101,...SCOPE});await b.settle();await b.api('stop');
 const e=b.get('engine'),first=e.s.batch.id;b.adapter.identity.cut=100;e.s.before=null;e.s.batch.step='capture';
 const before=b.commands.length;await b.api('resume');await b.settle();assert.equal(e.s.batch.state,'ERROR');
 // Le refus de protection ne relance aucune capture ni pose.
 assert.deepEqual([...new Set(b.commands.slice(before).map(c=>c.action))],['state']);
 b.adapter.identity.cut=102;await b.api('start',{part:23,start:102,end:103,...SCOPE}).catch(()=>{});await b.settle();
 return {b,first,second:e.s.batch.id,journal:await b.api('journal')};
}
test('lot rouvert puis ERROR : arrêt compté, segment suspendu, remplacement motivé, aucune clôture fabriquée',async()=>{
 const {b,first,second,journal}=await reopenedThenError(true);
 const lot=journal.events.filter(e=>e.type==='phase-timing'&&e.batchId===first),kind=k=>lot.filter(e=>e.kind===k);
 const halts=kind('control').filter(e=>e.name==='halt');
 assert.equal(halts.length,1,'l’ERROR du lot rouvert est un arrêt, même si la coupe active n’est pas la dernière visite');
 assert.deepEqual([halts[0].cause,halts[0].state],['protection','ERROR']);
 const batch=kind('batch'),at=p=>batch.filter(e=>e.point===p);
 assert.deepEqual(batch.map(e=>[e.point,e.segment]),[['start',1],['end',1],['reopened',2],['suspended',2],['replaced',2]]);
 assert.equal(at('suspended')[0].state,'ERROR');assert.equal(at('suspended')[0].knownBoundary,false);
 assert.deepEqual([at('replaced')[0].byBatchId,at('replaced')[0].lastState,at('replaced')[0].closedAtReplacement],[second,'ERROR',false]);
 // Rien de fabriqué : pas de seconde fin, santé jamais finale, export incomplet.
 assert.equal(at('end').length,1);assert.ok(kind('health').every(h=>h.ms<at('end')[0].ms||h.finalSnapshot===false));
 assert.equal(journal.v1TimingExport.lots.find(l=>l.batchId===first).complete,false);
 // Visite ouverte pendant la suspension : gardée, et dite hors exécution.
 const suspendedVisits=kind('visit').filter(e=>e.lotSuspended==='ERROR');
 assert.deepEqual(suspendedVisits.map(e=>e.identity.cut),[100]);
 // Passivité (mêmes commandes et poses avec ou sans mesure) : banc d'équivalence de la mission, 9 scénarios.
});
test('navigation après la fin du lot : pas présentée comme le passage suivant d’une validation en place',()=>{
 const events=[],engine={s:{mode:'automatic-test',sessionId:'S',batch:{id:'B',state:'RUNNING',scope:{part:23,start:100,end:103}}}};
 let time=0,n=0;const r=new Recorder(engine,{putEvent:e=>{events.push(e);}},{now:()=>time,uid:()=>String(++n)});
 r.syncBatch(true);r.ensureVisit(id(100));
 time=10;const q=r.startRequest('validateInPlace',[]);time=20;r.endRequest(q,{identity:id(100),serverConfirmed:true});
 engine.s.batch.state='COMPLETED';r.event('batch-state',{state:'COMPLETED',identity:id(100)});assert.equal(r.batch.closed,true);
 r.batch.closed=false;time=500;const s=r.startRequest('state',[]);time=510;r.endRequest(s,{identity:id(101)});
 assert.equal(events.filter(e=>e.point==='next-observed').length,0);
 const late=events.filter(e=>e.point==='navigation-after-close');assert.equal(late.length,1);
 assert.deepEqual([late[0].visitId,late[0].atMs,late[0].nextIdentity.cut],[events.find(e=>e.kind==='visit').visitId,510,101]);
});
/* Analyse : exécutions successives d'un lot, bornes connues ou non, sans fin inventée. */
const {measure,toMarkdown}=require('../tools/perf-phases.cjs'),{journal}=require('./helpers/perf-phases.cjs');
test('analyse : exécutions séparées, vie complète non mesurée sans fin connue, visites hors exécution',async()=>{
 const {first,journal:j}=await reopenedThenError(true),m=measure(j,{tous:true}),lot=m.lots.find(l=>l.batchId===first),x=lot.executions;
 assert.deepEqual(x.rows.map(r=>[r.segment,r.from.point,r.to?.point,r.to?.state??null,r.to?.knownBoundary??null]),[[1,'start','end','STOPPED',true],[2,'reopened','suspended','ERROR',false]]);
 assert.ok(x.rows.every(r=>Number.isFinite(r.durationMs)&&r.durationMs>=0));assert.equal(x.rows[0].durationMs,lot.totalMs,'premier intervalle inchangé');
 assert.equal(x.lifetimeMs,null);assert.equal(x.lifetimeReason,'end-unknown');assert.equal(x.executionMs,null);
 assert.equal(x.replaced.lastState,'ERROR');assert.equal(x.replaced.closedAtReplacement,false);
 assert.deepEqual(x.visitsOutsideExecution.map(v=>[v.identity.cut,v.reason]),[[100,'lot-suspended']]);
 assert.equal(lot.coverage.complete,false);assert.match(toMarkdown(m),/Exécutions : 1\) start → end STOPPED/);assert.match(toMarkdown(m),/Vie complète non mesurée \(fin inconnue\)/);
});
test('analyse : ancien journal sans « suspended » — un arrêt en ERROR borne l’exécution ; lot simple inchangé',()=>{
 const j=journal(),m0=measure(j),x0=m0.lots[0].executions;
 assert.equal(x0.rows.length,1);assert.equal(x0.lifetimeMs,m0.lots[0].totalMs);assert.equal(x0.executionMs,m0.lots[0].totalMs);assert.deepEqual(x0.visitsOutsideExecution,[]);
 const end=j.events.find(e=>e.point==='end'),ctx=j.events[1];j.events=j.events.filter(e=>e!==end);
 j.events.push({...ctx,eventId:'halt',kind:'control',name:'halt',cause:'protection',state:'ERROR',ms:1605,batchSeq:20});
 const x=measure(j).lots[0].executions;
 assert.deepEqual(x.rows.map(r=>[r.from.point,r.to.point,r.to.state,r.to.knownBoundary,r.durationMs]),[['start','halt','ERROR',false,1615]]);
 assert.equal(x.lifetimeMs,null);assert.equal(measure(j).lots[0].totalMs,null);
});
