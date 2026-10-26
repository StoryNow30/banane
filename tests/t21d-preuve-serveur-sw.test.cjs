'use strict';
/* T21d (fiches/H_PREUVE_SERVEUR.md, correctif 1) — PREUVE SERVEUR RATTACHÉE APRÈS COUP. Sur le lot de la 4:2, l'écriture de validation 204 partait
 * 182 à 456 ms APRÈS la navigation sur laquelle le lot avance : elle n'était jamais jointe au cut, et `applied-verified.serverConfirmed` était faux
 * par construction. Service worker réel en VM, moteur réel, ESV simulé, écritures de l'observateur passif relayées par le montage
 * tests/helpers/d3-ecritures.cjs (forme de src/esv-observer.js). Instrumentation seulement : commandes, état du lot et preuve de validation inchangés. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lot,J}=require('./helpers/d3-ecritures.cjs');
const {Sessions}=require('../src/native-session.js'),{Engine}=require('../src/engine.js'),{K,base,MemoryStore}=require('./fixtures.cjs');
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const ev=(r,t)=>r.b.store.events.filter(e=>e.type===t);
const neutre=x=>JSON.parse(JSON.stringify(x).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<h>'));
/* Validation du lot (cuts 100 à 102), puis l'écriture 204 de la ligne relayée `apres[cut]` ms plus tard (après la navigation), corps de validation. */
const apres=delais=>cut=>delais[cut]===undefined?[]:[{status:204,rowIndex:cut,apresMs:delais[cut],debutMs:Date.now()+delais[cut]}];
const visites=r=>r.e.s.records.filter(x=>x.commandSent);

test('écriture 204 après la navigation (182, 300, 456 ms) : rattachée à la visite de son cut (noms d’Écho + champ dédié), événement de rattachement, bilan sans « non confirmé » ; applied-verified et validation-intent à null',async()=>{
 const r=await lot({ecritures:apres({100:182,101:300,102:456})});await attendre(700);
 const v=visites(r);assert.deepEqual(J(v.map(x=>x.identity.cut)),[100,101,102]);
 for(const x of v){assert.equal(x.serverConfirmed,true,'cut '+x.identity.cut);assert.equal(x.serverConfirmationStatus,'observed-validation-write-204');
  assert.equal(x.serverConfirmation.statut,204);assert.equal(x.serverConfirmation.par,'rowIndex');assert.ok(!Number.isNaN(Date.parse(x.serverConfirmedAt)));
  assert.notEqual(x.validationProof,'server-confirmed','la preuve de validation du lot (celle du moteur) ne change pas');}
 const e=ev(r,'validation-ecriture-observee');assert.deepEqual(J(e.map(x=>[x.identity.cut,x.statut,x.par,x.visite])),[[100,204,'rowIndex','rattachee'],[101,204,'rowIndex','rattachee'],[102,204,'rowIndex','rattachee']]);
 for(const [x,d] of e.map((x,i)=>[x,[182,300,456][i]])){assert.ok(x.apresEnvoiMs>=d-5&&x.apresEnvoiMs<=d+80,`début de l’écriture après l’envoi de la validation : ${x.apresEnvoiMs} ms (attendu ≈ ${d})`);
  assert.ok(x.apresRetourMs>0,`écriture partie après le retour de la validation (navigation observée) : ${x.apresRetourMs} ms`);}
 assert.deepEqual(J(r.e.closureSummary().withoutServerConfirmation),[],'recalculé à la clôture : plus aucun cut « sans confirmation »');
 /* Les visites gardées dans le magasin (exports) portent la preuve. */
 for(const c of [100,101,102])assert.equal(r.b.store.records.find(x=>x.identity?.cut===c&&x.commandSent)?.serverConfirmed,true,'magasin, cut '+c);
 /* Aucune décision ni état du lot changé : l'évidence du lot et l'état de clôture restent ceux d'avant. */
 assert.ok(r.e.s.batch.processed.every(p=>p.evidence.serverConfirmed===false));assert.equal(r.etat,'FINISHED_WITH_UNCONFIRMED_ACTIONS');
 /* applied-verified et validation-intent : serverConfirmed vaut null (inconnu à cet instant) ; l'observation de validation garde son verdict. */
 const av=ev(r,'applied-verified'),vi=ev(r,'validation-intent'),vo=ev(r,'validation-observation');
 assert.equal(av.length,3);assert.ok(av.every(x=>x.serverConfirmed===null),JSON.stringify(av.map(x=>x.serverConfirmed)));
 assert.equal(vi.length,3);assert.ok(vi.every(x=>x.serverConfirmed===null));
 assert.ok(vo.every(x=>x.serverConfirmed===false),'la navigation reste la preuve du lot (aucune réponse HTTP lue pendant la validation)');
});

test('écriture vue AVANT que le moteur ait complété la visite : en attente, rattachée à l’observation de la validation',async()=>{
 /* Relayée pendant la validation, avant la navigation (le montage la relaie avant de rendre la main au moteur). */
 const r=await lot({ecritures:cut=>[{status:204,rowIndex:cut}]});await attendre(100);
 const e=ev(r,'validation-ecriture-observee');assert.deepEqual(J(e.map(x=>[x.identity.cut,x.visite])),[[100,'en-attente'],[101,'en-attente'],[102,'en-attente']]);
 assert.ok(visites(r).every(x=>x.serverConfirmed===true&&x.serverConfirmation.par==='rowIndex'));
});

test('Écho : le résumé de séance dit la confirmation serveur à partir des visites (avant : « not-observed » en dur)',async()=>{
 const store=new MemoryStore();store.all=async n=>n==='clouds'?[...store.clouds.values()]:store[n];store.keys=async()=>[...store.clouds.keys()];
 const st=(cut=100)=>({identity:{pageId:'page-a',part:23,cut,shape:'U50',frameId:'frame-a',projectId:null},rails:K.clone(base.rails),capturedAt:new Date().toISOString(),status:'complete',partialReasons:[],
  viewObservation:{status:'observed',viewEpochId:'v',observedAt:new Date().toISOString()},geominfo:{status:'not-observed',raw:null,source:null}});
 const adapter={state:async()=>st(),nativeStart:async()=>({active:true}),nativePause:async()=>({metrics:{}}),nativeResume:async()=>({active:true}),nativeFinish:async()=>({metrics:{}})};
 const engine=new Engine(adapter,store);await engine.init();const S=new Sessions(engine,adapter,store);await S.init();await S.start();
 const ctx=()=>({sessionId:engine.s.native.id,observationPeriodId:engine.s.native.currentPeriodId});
 for(const [i,cut] of [[1,100],[2,101]].entries()){const v='v'+(i+1),s=st(cut);await S.receive('visit-started',{...ctx(),visitId:v,identity:s.identity,initialObserved:s});
  await S.receive('operator-event',{...ctx(),visitId:v,identity:s.identity,stateObservedBeforeInput:s,event:{type:'keydown',intent:'VALIDATE',decisionKey:'Ctrl+Enter',observedAt:new Date().toISOString()}});
  await S.receive('visit-ended',{...ctx(),visitId:v,identity:s.identity,finalObserved:s,reason:'target-changed',nextIdentity:{...s.identity,cut:cut+1},endedAt:new Date().toISOString()});}
 await S.noteServerWrite({eventId:'w1',timestamp:new Date().toISOString(),status:204,method:'PUT',outcome:'done',attempt:1,rowIndex:101,body:{ExtractionStatus:'valid',TreatedByOperator:true}});
 const d=await S.end();
 assert.equal(d.closureSummary.serverConfirmationAvailable,true);assert.equal(d.closureSummary.serverConfirmationStatus,'observed-validation-writes');assert.equal(d.closureSummary.serverConfirmedVisits,1);
 assert.equal(d.closureSummary.serverConfirmationNotAnError,true);
});
