'use strict';
/* Tests de caractérisation des défauts, pas corrections. Ils décrivent le
 * comportement constaté ; inverser l'assertion signalée donne le test rouge
 * du comportement souhaité. Aucun corpus privé nécessaire.
 * 4.8.1 : défauts corrigés, assertions inversées ; chaque essai exige
 * désormais le comportement souhaité (rouge sur la 4.8.0). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {panneau}=require('../tools/audit-qualite-480.cjs');
const {Engine}=require('../src/engine.js');
const state=()=>({current:{identity:{part:12,cut:3}},batch:{state:'STOPPED',scope:{part:12,start:1,end:3},
 processed:[{cut:1}],deferred:[{cut:2}],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:[1,2,3].map(cut=>({identity:{part:12,cut}})),
 activeIdentity:{part:12,cut:3},stoppedAtEnd:{cut:3,applied:false}}});
test('D02 corrigé : la couverture du panneau est C1, dernier cut sans décision compris',async()=>{
 const p=await panneau(state());assert.match(p.$('lot-compteurs').innerHTML,/1 sur 3/);assert.doesNotMatch(p.$('lot-compteurs').innerHTML,/1 sur 2/);
 assert.match(p.$('batch').textContent,/dernier cut 3 non résolu/);
});
test('D03 corrigé : Tout télécharger garde l’avertissement du corpus incomplet',async()=>{
 const p=await panneau(state(),{reponses:{journal:{},dataset:{cloudIds:[]},'gcv1-diagnostic-export':{observationCount:1},
 'gcv1-corpus-export-plan':{cloudIds:[],missingCaptureIds:['absente']}}});
 await p.$('export-tout').onclick();await p.attendre();
 assert.ok(p.notes.some(n=>/1 capture.*absente/.test(n)));
 assert.doesNotMatch(p.$('export-status').textContent,/Tout est téléchargé/);
 assert.match(p.$('export-status').textContent,/Export incomplet.*corpus : 1 capture\(s\) LiDAR référencée\(s\) absente\(s\)/);
});
test('U01 corrigé : Écho indisponible, avec explication, pendant une reprise manuelle',async()=>{
 const s=state();s.batch.state='MANUAL_TAKEOVER';const p=await panneau(s,{hash:'#native'});
 assert.equal(p.$('native-start').disabled,true);assert.ok(p.notes.some(n=>/Reprise manuelle en cours dans Orbite/.test(n)));
 const engine=new Engine({},{});engine.s=s;assert.throws(()=>engine.assertBatchContextFree('démarrer Écho'),/Reprise manuelle/);
});
test('P02 corrigé : perf-lot sépare GCV1 (jusqu’à proposed) et décision sur le lot (jusqu’à l’observation)',()=>{
 const P=require('../tools/perf-lot.cjs'),t=Date.parse('2026-09-28T00:00:00Z');
 const events=[['before-captured',0],['proposed',100],['gcv1-shadow-observed',500]].map(([type,dt])=>({type,timestamp:new Date(t+dt).toISOString(),identity:{part:12,cut:1},lotObservation:{engineMs:400}}));
 const m=P.measure({events});assert.equal(m.analyseMs.median,100);assert.equal(m.decisionMs.median,400);
 assert.equal(m.observationMs.median,400,'proposed → gcv1-shadow-observed');assert.equal(m.analyseCompleteMs.median,500,'before-captured → gcv1-shadow-observed');
});
test('D01 corrigé : sans preuve de téléchargement, le vidage automatique ne purge rien',async()=>{
 const {Sessions}=require('../src/native-session.js'),settings=require('../src/settings.js');
 assert.equal(settings.export.releaseAfterExport,true);
 const cloud={captureId:'nuage-audit',pointsSceneRelative:[[0,0,0]]},clouds=new Map([['nuage-audit',cloud]]);
 const s={native:{id:'session-audit',status:'RUNNING',visits:[],incomplete:[],cloudIds:['nuage-audit']}};
 const store={all:async()=>[],getCloud:async id=>clouds.get(id),deleteCloud:async id=>clouds.delete(id)};
 const session=new Sessions({s,save:async()=>{}},{},store);
 const p=await panneau(s,{hash:'#native',globals:{BananeStorage3:class{constructor(){return store;}},BananeSettings:settings},reponses:{
 'native-export-advice':{due:true,bytesPending:1,segments:0},
 'native-export-manifest':{sessionId:'session-audit',cloudIds:['nuage-audit']},
 'native-export-ack':args=>session.ackExported(args.ids,{confirmes:args.confirmed})}});
 // DOM simulé : a.click() ne télécharge rien et ne lève pas d'exception.
 p.intervals[1]();await p.attendre();
 assert.equal(p.downloads.length,1,'un Blob demandé, aucun fichier confirmé');
 assert.ok(p.appels.some(a=>a.action==='native-export-ack'));
 assert.equal(clouds.has('nuage-audit'),true,'nuage gardé : aucun fichier confirmé');
 assert.deepEqual(s.native.exportState.releasedCloudIds,[]);
 assert.deepEqual(s.native.exportState.exportedCloudIds,['nuage-audit'],'sorti de la file du vidage, repris par l’export final');
});
