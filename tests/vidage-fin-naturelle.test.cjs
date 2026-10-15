'use strict';
/* A2 / T3D-2 / OBS-9 (relecture du test 3) : après une fin NATURELLE du lot (COMPLETED, ou FINISHED_WITH_UNCONFIRMED_ACTIONS,
 * même fin nommée par `closingState` selon la confirmation serveur), « Vider le cache des exports » restait refusé (« un lot
 * n'est pas terminé (FINISHED…) : arrête-le ») et grisé jusqu'au lot suivant, alors que « Arrêter » est caché dans ces états
 * et qu'ils ne se reprennent pas (engine.js). Ces deux états sont des fins : vidage manuel permis après la grâce de 5 s
 * de l'observateur, bouton actif. Inchangé : refus pendant la grâce, refus du vidage AUTOMATIQUE d'un STOPPED sans
 * `stoppedAtEnd` (reprenable). Service worker RÉEL (background.js), moteur réel, ESV simulé ; faux stockage. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production}=require('./helpers/perf-production.cjs');
const EC=require('../src/export-cache.js');

function stockage(b){const mem={},st=b.store;
 Object.assign(b.ctx.chrome.storage.local,{get:async k=>typeof k==='string'?(k in mem?{[k]:structuredClone(mem[k])}:{}):{},set:async o=>{for(const k of Object.keys(o))mem[k]=structuredClone(o[k]);}});
 st.deleteMany=async(nom,ids)=>{const g=new Set(ids);if(nom==='events')st.events=st.events.filter(x=>!g.has(x.eventId));else if(nom==='records')st.records=st.records.filter(x=>!g.has(x.recordId||x.id));else for(const i of ids)st.clouds.delete(i);return ids.length;};
 st.keys=async n=>n==='clouds'?[...st.clouds.keys()]:n==='events'?st.events.map(x=>x.eventId):st.records.map(x=>x.recordId||x.id);
 const snap=()=>({at:Date.now(),ids:{events:st.events.map(x=>x.eventId),records:st.records.map(x=>x.recordId||x.id),clouds:[...st.clouds.keys()]},
  signatures:{events:Object.fromEntries(st.events.map(o=>[o.eventId,EC.signature(o)])),records:Object.fromEntries(st.records.map(o=>[o.recordId||o.id,EC.signature(o)]))}});
 return {mem,st,snap};}
const vieillir=(b,id,ms)=>{const f=b.get('obsFins').get(id);assert.ok(f,'fin relevée pour '+id);f.at-=ms;};

test('vrai lot jusqu’à sa fin naturelle (FINISHED_WITH_UNCONFIRMED_ACTIONS) : vidage refusé pendant la grâce, PERMIS après, état du lot intact',async()=>{
 const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});const {mem,st,snap}=stockage(b);
 await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});
 const v=await b.settle(),e=b.get('engine'),r=b.get('timing');await Promise.allSettled([...r.pending]);
 assert.equal(v.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS','fin naturelle mesurée sur ce lot simulé');
 assert.match((await b.api('export-cache-info')).refus??'',/observations/,'grâce de 5 s en cours : refus');
 vieillir(b,v.batch.id,5200);
 const info=await b.api('export-cache-info');assert.equal(info.refus,null,'fin naturelle : vidage permis (avant : « un lot n’est pas terminé »)');
 assert.equal(info.reprenable,false,'pas d’avertissement « reprenable » : ces états ne se reprennent pas');
 assert.equal((await b.api('export-cache-info',{auto:true})).refus,null,'le vidage automatique (désactivé par défaut) l’accepterait aussi');
 const avant=JSON.stringify(e.s),s=snap();assert.ok(s.ids.events.length>0,'le cache contient le journal du lot');
 const out=await b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,exportAt:null,instantaneAt:s.at});
 assert.equal(out.cleared,true);assert.equal(out.events,s.ids.events.length);assert.ok(mem[EC.CLE],'marqueur écrit');
 assert.equal(st.events.filter(x=>s.ids.events.includes(x.eventId)).length,0,'les événements exportés sont partis');
 assert.equal(JSON.stringify(e.s),avant,'état du moteur et du lot : intact');
});

test('COMPLETED vu au jalon `batch-state` : même règle (refus pendant la grâce, permis après)',async()=>{
 const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});stockage(b);
 const e=b.get('engine'),r=b.get('timing');
 e.s.batch={id:'lot-C',state:'RUNNING',step:'capture',startedAt:new Date(Date.now()-60000).toISOString(),scope:{part:23,start:100,end:101},processed:[],skipped:[],paused:[],interrupted:[],sequence:[],deferred:[]};
 r.syncBatch(true);r.ensureVisit(b.adapter.identity);
 e.s.batch.state='COMPLETED';r.closeBatch('COMPLETED');await e.event('batch-state',{identity:null,state:'COMPLETED',step:'capture',processed:1,skipped:0});await Promise.allSettled([...r.pending]);
 assert.match((await b.api('export-cache-info')).refus??'',/observations/);
 vieillir(b,'lot-C',5200);assert.equal((await b.api('export-cache-info')).refus,null);
});

test('règle du module : fins naturelles permises ; lots ouverts refusés avec un texte juste ; STOPPED reprenable inchangé',()=>{
 const c=state=>({state:{collection:'IDLE',batch:{id:'x',...state}}});
 for(const st of ['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS']){assert.equal(EC.refus(c({state:st})),null,st);assert.equal(EC.refus(c({state:st}),{auto:true}),null,st+' auto');assert.equal(EC.reprenable(c({state:st})),false,st);}
 for(const st of ['RUNNING','PAUSED','MANUAL_TAKEOVER','ERROR','PAUSED_ADAPTER_UNRESPONSIVE'])assert.match(EC.refus(c({state:st}))??'',new RegExp('un lot n’est pas terminé \\('+st+'\\) : arrête-le'),st);
 assert.match(EC.refus(c({state:'STOPPED'}),{auto:true})??'',/peut être repris/,'STOPPED sans stoppedAtEnd : auto refusé');
 assert.equal(EC.refus(c({state:'STOPPED'})),null,'STOPPED : manuel permis');assert.equal(EC.reprenable(c({state:'STOPPED'})),true);
 assert.equal(EC.refus(c({state:'STOPPED',stoppedAtEnd:{cut:1}}),{auto:true}),null);
 assert.equal(EC.refus({...c({state:'COMPLETED'}),graceObservations:'en-cours'})?.includes('5 s au plus'),true,'grâce toujours respectée');
});
