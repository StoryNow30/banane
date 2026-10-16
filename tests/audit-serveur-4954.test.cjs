'use strict';
/* 4.9.5.4 (D-141, D-134) — ÉVÉNEMENT `audit-serveur` : le champ partie doit être celui de la page qui a chargé la liste, et l'export d'Écho doit
 * le garder.
 *
 * Constat : un événement portait « partie 29 » avec les totaux de la partie 12. La partie venait du lot gardé dans l'état du moteur (`batch.scope.part`),
 * même clos depuis longtemps, alors que la liste lue était celle de la partie affichée dans ESV. Et l'export d'Écho, qui ne garde que les événements
 * marqués de `nativeSessionId`, ne le voyait pas (D-134).
 * Règle : la partie vient de ce qui est en cours — la séance Écho (sa dernière visite), sinon un lot encore ouvert, sinon la capture en cours — et
 * jamais d'un lot clos. Sans source sûre : `partie:null`, et les validations attendues ne sont pas calculées (elles ne se comparent qu'à la liste de
 * la même partie). Pendant Écho, l'événement porte `nativeSessionId`. Données synthétiques ; lecture seule. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,memoire}=require('./helpers/perf-production.cjs');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x));
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const stored=(b,t)=>b.store.events.filter(e=>e.type===t);
const send=(b,entries,observer='obs-1')=>b.raw({kind:'esv-observation',observer,entries});

async function amorce(mutation){
 const local=memoire(),b=production({local});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 b.ctx.BananeSettings={...b.ctx.BananeSettings,releves:{...b.ctx.BananeSettings.releves,auditSilenceMs:5}};
 const e=b.get('engine');mutation(e,b);
 const t0=Date.now()-60000,iso=t=>new Date(t).toISOString();
 const resume=valid=>({seq:1,kind:'list-summary',listKey:'cle-liste',pages:3,okPages:3,rows:2000,chars:1,counts:{valid,invalid:2000-valid,skipped:0},firstStartedEpochMs:t0-500,lastEndedEpochMs:t0,durationMs:500,beforeSession:true});
 const page=(valid,fin,rows)=>({seq:9,kind:'list-page',listKey:'cle-liste',status:200,outcome:'done',rows,counts:{valid,invalid:rows-valid,skipped:0},startedEpochMs:fin-300,endedEpochMs:fin,durationMs:300,chars:5});
 /* Première lecture (avant la séance), puis des validations d'Ariane de deux parties, puis la seconde lecture. */
 send(b,[resume(1500)],'obs-A');await attendre(25);
 for(const [dt,part] of [[10000,12],[20000,12],[30000,29],[35000,29],[36000,29]])await b.store.putEvent({eventId:'v'+dt,timestamp:iso(t0+dt),type:'validation-accepted',identity:{part,cut:dt}});
 send(b,[page(1502,t0+50000,2000)],'obs-B');await attendre(60);
 return {b,audits:stored(b,'audit-serveur')};
}

test('Écho sur la partie 12 alors que le dernier lot, clos, était sur la partie 29 : l\'événement dit 12, et il sort avec l\'export d\'Écho',async()=>{
 const {b,audits}=await amorce(e=>{
  e.s.batch={id:'lot-ancien',state:'STOPPED',scope:{part:29,start:1,end:50}};
  e.s.native={id:'echo-1',status:'RUNNING',visits:[{visitId:'v1',visitIndex:0,identity:{part:12,cut:3}},{visitId:'v2',visitIndex:1,identity:{part:12,cut:4}}]};
 });
 assert.equal(audits.length,1);
 const a=plat(audits[0]);
 assert.equal(a.partie,12,'la partie de la séance Écho, pas celle du lot clos');
 assert.equal(a.partieSource,'echo');
 assert.equal(a.attendus,2,'les deux validations d\'Ariane de la partie 12 seulement');
 assert.equal(a.nativeSessionId,'echo-1','marqué comme les observations d\'Écho : il sort avec l\'export d\'Écho');
 /* Les deux règles de rangement : l'export d'Écho (panel.js : nativeSessionId === session) le garde, le journal d'Orbite (hors Écho) l'écarte. */
 assert.ok([a].filter(x=>x.nativeSessionId==='echo-1').length===1);
 assert.ok(!([a].filter(x=>!(x.nativeSessionId||x.manualSessionId||x.observationPeriodId||x.railSnapshots)).length),'écarté du journal d\'Orbite, comme les observations');
});

test('Écho démarré mais pas encore de visite : la partie n\'est pas devinée à partir d\'un lot clos',async()=>{
 const {audits}=await amorce(e=>{
  e.s.batch={id:'lot-ancien',state:'COMPLETED',scope:{part:29,start:1,end:50}};
  e.s.native={id:'echo-2',status:'RUNNING',visits:[]};
 });
 const a=plat(audits[0]);
 assert.equal(a.partie,null);assert.equal(a.partieSource,null);
 assert.equal(a.attendus,null,'sans partie sûre, pas de validations attendues (elles ne se comparent qu\'à la liste de la même partie)');
 assert.equal(a.ecart,null);
 assert.equal(a.nativeSessionId,'echo-2');
});

test('lot clos seul, sans aucune séance : l\'observateur ne range rien, donc aucun événement (et jamais la partie du lot clos)',async()=>{
 const {audits}=await amorce(e=>{e.s.batch={id:'lot-ancien',state:'STOPPED',scope:{part:29,start:1,end:50}};});
 assert.deepEqual(audits.map(a=>a.partie),[],'rien n\'est observé hors séance');
});

test('lot ouvert (en cours ou en pause) : la partie du lot, comme avant',async()=>{
 for(const state of ['RUNNING','PAUSED','PAUSED_ADAPTER_UNRESPONSIVE']){
  const {audits}=await amorce(e=>{e.s.batch={id:'lot-r',state,scope:{part:29,start:1,end:50}};});
  const a=plat(audits[0]);
  assert.equal(a.partie,29,state);assert.equal(a.partieSource,'lot');assert.equal(a.attendus,3,'les trois validations de la partie 29');assert.ok(!('nativeSessionId' in a));
 }
});

test('séance de corrections sans lot : la partie de la capture en cours',async()=>{
 const {audits}=await amorce(e=>{e.s.batch=null;e.s.manual={id:'m-1',status:'RUNNING'};e.s.before={identity:{part:12,cut:7}};});
 const a=plat(audits[0]);
 assert.equal(a.partie,12);assert.equal(a.partieSource,'capture');assert.equal(a.attendus,2);
});

test('lot qui vient de se clore (grâce de l\'observateur) : sa partie reste la bonne, la page n\'a pas changé',async()=>{
 const {audits}=await amorce((e,b)=>{
  e.s.batch={id:'lot-fin',state:'STOPPED',scope:{part:29,start:1,end:50},stoppedAtEnd:{at:new Date(Date.now()-500).toISOString()}};
 });
 const a=plat(audits[0]);
 assert.equal(a.partie,29);assert.equal(a.partieSource,'lot');
});

test('lecture seule : l\'audit n\'envoie aucune commande à ESV',async()=>{
 const {b}=await amorce(e=>{e.s.native={id:'echo-3',status:'RUNNING',visits:[{visitIndex:0,identity:{part:12,cut:3}}]};});
 assert.deepEqual(b.commands.filter(x=>!['ping','state','nativeSnapshot'].includes(x.action)),[]);
});
