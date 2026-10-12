'use strict';
/* 4.9.0.3 (test 3) — grâce de réception de l'observateur passif ÉTENDUE : après l'arrêt MANUEL du lot (« Arrêter ») et
 * après sa fin naturelle (COMPLETED, ou FINISHED_WITH_UNCONFIRMED_ACTIONS : même fin, nommée par `closingState` selon la
 * confirmation serveur), comme après l'arrêt au dernier cut (test 2). Service worker RÉEL (background.js) en VM, ESV simulé.
 * Mêmes garde-fous : ce seul lot, 5 s, date absente/illisible/future refusée, aucune requête ajoutée, `launcher-status`
 * inchangé. Interactions : nouveau lot lancé pendant la grâce, vidage du cache des exports pendant la grâce. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const {production}=require('./helpers/perf-production.cjs');
const EC=require('../src/export-cache.js');
const write=(o={})=>({seq:1,kind:'write',via:'xhr',urlClass:'rail-pair-write',method:'PUT',status:204,outcome:'done',attempt:1,railPairId:'traj__00+1.5/2.5',bodyKeys:12,
 body:{a:1.5},startedEpochMs:Date.now()-400,endedEpochMs:Date.now()-250,durationMs:150,...o});
const send=(b,entries,observer='obs-1')=>b.raw({kind:'esv-observation',observer,entries}).out;
const stored=b=>b.store.events.filter(e=>e.type==='esv-observation');
const writes=b=>stored(b).filter(e=>e.kind==='write');
const REFUS={accept:false,reason:'no-session'};
/* Lot en cours posé directement (rapide) ; la fin passe par les VRAIS chemins (« Arrêter », jalon `batch-state` du moteur). */
async function lotOuvert(id='lot-A'){const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');
 e.s.batch={id,state:'RUNNING',step:'capture',startedAt:new Date(Date.now()-60000).toISOString(),scope:{part:23,start:100,end:101},processed:[],skipped:[],paused:[],interrupted:[],sequence:[],deferred:[]};
 r.syncBatch(true);r.ensureVisit(b.adapter.identity);return {b,e,r};}
/* Fait vieillir la fin relevée d'un lot (au lieu d'attendre 5 s). */
const vieillir=(b,id,ms)=>{const f=b.get('obsFins').get(id);assert.ok(f,'fin relevée pour '+id);f.at-=ms;};
const finDe=(e,etat)=>e.event('batch-state',{identity:null,state:etat,step:'capture',processed:1,skipped:0});

test('arrêt manuel (« Arrêter ») : l’écriture arrivée juste après est rangée avec le lot ; battement inchangé ; plus rien après 5 s',async()=>{
 const {b,e}=await lotOuvert();
 await b.api('stop');assert.equal(e.s.batch.state,'STOPPED');assert.equal(e.s.batch.stoppedAtEnd??null,null,'pas un arrêt au dernier cut');
 deq(send(b,[write({seq:1})]),{accept:true,stored:1,grace:true});
 const w=writes(b);assert.equal(w.length,1);assert.equal(w[0].batchId,'lot-A','attribuée au lot arrêté');assert.equal(w[0].sessionId,e.s.sessionId);
 assert.equal(b.raw({kind:'launcher-status'}).out.observation.seance,false,'le battement n’annonce pas de séance après l’arrêt');
 vieillir(b,'lot-A',4000);deq(send(b,[write({seq:2})]),{accept:true,stored:1,grace:true},'encore dans les 5 s');
 vieillir(b,'lot-A',1500);deq(send(b,[write({seq:3})]),REFUS,'après 5 s : rien');assert.equal(writes(b).length,2);
 await b.settle();
});

test('fin naturelle (COMPLETED, FINISHED_WITH_UNCONFIRMED_ACTIONS) vue au jalon `batch-state` : grâce de 5 s pour ce lot',async()=>{
 for(const etat of ['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS']){
  const id='lot-'+etat,{b,e}=await lotOuvert(id);
  deq(send(b,[write({seq:1})]),{accept:true,stored:1},etat+' : lot ouvert');
  e.s.batch.state=etat;deq(send(b,[write({seq:2})]),REFUS,etat+' : fin pas encore vue par le service worker (le moteur n’a rien daté)');
  await finDe(e,etat);deq(send(b,[write({seq:3})]),{accept:true,stored:1,grace:true},etat+' : fin vue');
  assert.deepEqual(writes(b).map(w=>w.batchId),[id,id],etat);
  vieillir(b,id,5500);deq(send(b,[write({seq:4})]),REFUS,etat+' : après 5 s');
  await b.settle();}
});

test('vrai lot (moteur réel, ESV simulé) jusqu’à sa fin naturelle : l’écriture reçue juste après est rangée avec lui',async()=>{
 const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});
 const v=await b.settle();assert.ok(['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS'].includes(v.batch.state),v.batch.state);
 deq(send(b,[write({seq:1})]),{accept:true,stored:1,grace:true});assert.equal(writes(b)[0].batchId,v.batch.id);
 vieillir(b,v.batch.id,6000);deq(send(b,[write({seq:2})]),REFUS);
});

test('arrêt manuel pendant une action : accepté tant que la boucle du moteur finit l’action de CE lot, puis 5 s après sa sortie',async()=>{
 const {b,e}=await lotOuvert();e.task=new Promise(()=>{});   // boucle du moteur encore dans l'action en cours
 await b.api('stop');vieillir(b,'lot-A',60000);
 deq(send(b,[write({seq:1})]),{accept:true,stored:1,grace:true},'action en cours du lot arrêté');
 e.task=null;deq(send(b,[write({seq:2})]),REFUS,'boucle finie sans sortie vue, fin ancienne : rien');
 await finDe(e,'STOPPED');deq(send(b,[write({seq:3})]),{accept:true,stored:1,grace:true},'sortie de la boucle : la grâce repart');
 assert.deepEqual(writes(b).map(w=>w.batchId),['lot-A','lot-A']);
});

test('garde-fous : ce seul lot ; « Arrêter » sur un lot déjà clos ne crée ni ne prolonge rien ; date future ; hors Orbite ; réglage coupé',async()=>{
 {const {b,e}=await lotOuvert();await b.api('stop');
  e.s.batch={...e.s.batch,id:'lot-X',state:'STOPPED'};deq(send(b,[write()]),REFUS,'un autre lot clos n’hérite pas de la grâce');}
 {const {b,e}=await lotOuvert();e.s.batch.state='STOPPED';await b.api('stop');deq(send(b,[write()]),REFUS,'déjà arrêté : pas de grâce');
  assert.equal(b.get('obsFins').has('lot-A'),false);}
 {const {b,e}=await lotOuvert();await finDe(e,'RUNNING');e.s.batch.state='FINISHED_WITH_UNCONFIRMED_ACTIONS';deq(send(b,[write()]),REFUS,'jalon d’un autre état : rien');}
 {const {b}=await lotOuvert();await b.api('stop');vieillir(b,'lot-A',-60000);deq(send(b,[write()]),REFUS,'fin datée dans le futur (horloge reculée) : refus');}
 {const {b,e}=await lotOuvert();await b.api('stop');e.s.mode='observation';deq(send(b,[write()]),REFUS,'hors Orbite : rien');}
 {const {b}=await lotOuvert();await b.api('stop');b.ctx.BananeSettings={...b.ctx.BananeSettings,observateurPassif:{actif:false}};
  assert.equal(send(b,[write()]).accept,false,'réglage coupé');}
 {/* Arrêt au dernier cut (test 2) : inchangé, date illisible toujours refusée même si une fin a été relevée avant. */
  const {b,e}=await lotOuvert();await b.api('stop');e.s.batch.stoppedAtEnd={cut:101,at:'illisible'};deq(send(b,[write()]),REFUS,'date illisible : jamais devinée');
  e.s.batch.stoppedAtEnd={cut:101,at:new Date(Date.now()-300).toISOString()};deq(send(b,[write({seq:2})]),{accept:true,stored:1,grace:true});}
});

test('nouveau lot lancé pendant la grâce : l’ancien garde ce que la page a vu avant le début du nouveau, le nouveau garde le reste, jamais l’inverse',async()=>{
 for(const fin of ['arret-manuel','dernier-cut']){
  const {b,e}=await lotOuvert('lot-A');deq(send(b,[write({seq:1,startedEpochMs:Date.now()-3000,endedEpochMs:Date.now()-2900})]),{accept:true,stored:1});
  const visiteA=writes(b)[0].visitId;assert.ok(visiteA);
  if(fin==='arret-manuel')await b.api('stop');
  else{e.s.batch.state='STOPPED';e.s.batch.stoppedAtEnd={cut:101,at:new Date(Date.now()-200).toISOString(),applied:true};}
  const avantB=Date.now()-150;   // la dernière écriture de A a commencé avant le début de B
  await new Promise(r=>setTimeout(r,5));
  await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});
  const B=e.s.batch.id,debutB=Date.parse(e.s.batch.startedAt);assert.notEqual(B,'lot-A');assert.ok(debutB>avantB);
  const r=send(b,[write({seq:2,startedEpochMs:avantB,endedEpochMs:avantB+100}),write({seq:3,startedEpochMs:debutB+5,endedEpochMs:debutB+50}),
   {seq:4,kind:'observer',version:1,world:'MAIN',installedBeforePageScripts:true,readyState:'complete',scriptsAtInstall:0,enabled:true,afterDenial:false,dropped:0,ignored:0},
   {seq:5,kind:'resource',class:'point-resource',n:3,bytes:300,startedEpochMs:avantB-10,endedEpochMs:avantB+40,windowMs:250}]);
  deq(r,{accept:true,stored:4},fin);
  const s=stored(b),of=seq=>s.find(x=>x.observer.seq===seq);
  assert.equal(of(2).batchId,'lot-A',fin+' : écriture vue avant le début de B → A');assert.equal(of(2).visitId,visiteA,fin+' : avec le contexte de mesure de A');
  assert.equal(of(5).batchId,'lot-A',fin+' : fichiers de points vus avant B → A');
  assert.equal(of(3).batchId,B,fin+' : écriture vue après le début de B → B');assert.equal(of(4).batchId,B,fin+' : marque sans date → séance courante (B)');
  vieillir(b,'lot-A',6000);   // grâce de A finie ; B est ouvert, ou clos depuis un instant (sa propre grâce)
  deq(send(b,[write({seq:6,startedEpochMs:debutB+10,endedEpochMs:debutB+60})]),{accept:true,stored:1},fin);
  assert.equal(stored(b).find(x=>x.observer.seq===6).batchId,B,fin+' : jamais à A');
  assert.equal(stored(b).filter(x=>x.batchId==='lot-A').length,3,fin+' : A n’a reçu que ce qui précède B');
  await b.settle();}
});

/* ---------- vidage du cache des exports pendant la grâce ---------- */
async function swCache(){
 const {b,e,r}=await lotOuvert('lot-V');const mem={};
 Object.assign(b.ctx.chrome.storage.local,{get:async k=>typeof k==='string'?(k in mem?{[k]:structuredClone(mem[k])}:{}):{},set:async o=>{for(const k of Object.keys(o))mem[k]=structuredClone(o[k]);}});
 const st=b.store;
 st.deleteMany=async(nom,ids)=>{const g=new Set(ids);if(nom==='events')st.events=st.events.filter(x=>!g.has(x.eventId));else if(nom==='records')st.records=st.records.filter(x=>!g.has(x.recordId||x.id));else for(const i of ids)st.clouds.delete(i);return ids.length;};
 st.keys=async n=>n==='clouds'?[...st.clouds.keys()]:n==='events'?st.events.map(x=>x.eventId):st.records.map(x=>x.recordId||x.id);
 const snap=()=>({at:Date.now(),ids:{events:st.events.map(x=>x.eventId),records:st.records.map(x=>x.recordId||x.id),clouds:[...st.clouds.keys()]},
  signatures:{events:Object.fromEntries(st.events.map(o=>[o.eventId,EC.signature(o)])),records:Object.fromEntries(st.records.map(o=>[o.recordId||o.id,EC.signature(o)]))}});
 return {b,e,r,st,mem,snap};}

test('vidage manuel pendant la grâce : refusé (rien supprimé) ; après la grâce, l’instantané contient la dernière écriture et tout part : aucune observation orpheline',async()=>{
 const {b,e,r,st,mem,snap}=await swCache();
 await b.api('stop');await Promise.allSettled([...r.pending]);
 deq(send(b,[write({seq:1})]),{accept:true,stored:1,grace:true},'dernière écriture reçue pendant la grâce');
 const info=await b.api('export-cache-info');assert.match(info.refus,/observations/,'le panneau dit pourquoi');
 const s1=snap(),avant=st.events.length;
 await assert.rejects(b.api('export-cache-clear',{ids:s1.ids,signatures:s1.signatures,manuel:true,exportAt:null,instantaneAt:s1.at}),/Vidage refusé : .*observations/);
 assert.equal(st.events.length,avant,'rien supprimé');assert.equal(mem[EC.CLE],undefined,'aucun marqueur');
 vieillir(b,'lot-V',5200);await Promise.allSettled([...r.pending]);
 assert.equal((await b.api('export-cache-info')).refus,null,'grâce finie : vidage permis');
 const s2=snap();assert.ok(s2.ids.events.includes(writes(b)[0].eventId),'la dernière écriture est dans l’instantané');
 const out=await b.api('export-cache-clear',{ids:s2.ids,signatures:s2.signatures,manuel:true,exportAt:null,instantaneAt:s2.at});
 assert.equal(out.cleared,true);assert.equal(stored(b).length,0,'aucune observation laissée sans son lot');
 deq(send(b,[write({seq:2})]),REFUS,'après la grâce : rien ne revient');assert.equal(stored(b).length,0);
 assert.equal(e.s.batch.state,'STOPPED','état du lot intact');
});

test('vidage automatique après un export commencé pendant la grâce : refusé même si la grâce est finie au moment du vidage',async()=>{
 /* Vidage automatique : V2 ne le permet qu'après un arrêt au dernier cut (lot terminé pour de bon). */
 const {b,e,r,st,snap}=await swCache();
 e.s.batch.state='STOPPED';e.s.batch.stoppedAtEnd={cut:101,at:new Date(Date.now()-100).toISOString(),applied:true};r.closeBatch('STOPPED');await Promise.allSettled([...r.pending]);
 assert.match((await b.api('export-cache-info',{auto:true})).refus,/observations/,'grâce en cours');
 const s1=snap();   // instantané pris au début de l'export, pendant la grâce
 deq(send(b,[write({seq:1})]),{accept:true,stored:1,grace:true},'arrivée APRÈS l’instantané');
 const a=Date.parse(e.s.batch.stoppedAtEnd.at)-5200;e.s.batch.stoppedAtEnd.at=new Date(a).toISOString();   // la grâce est finie
 assert.equal((await b.api('export-cache-info',{auto:true})).refus,null);
 await assert.rejects(b.api('export-cache-clear',{ids:s1.ids,signatures:s1.signatures,auto:true,exportAt:new Date(a+4000).toISOString(),instantaneAt:a+4000}),
  /Vidage refusé : des observations du lot .* après le début de l’export/);
 assert.equal(writes(b).length,1,'écriture gardée : le cache reste entier (aucune orpheline)');assert.equal(st.events.length>1,true);
 const s2=snap();const out=await b.api('export-cache-clear',{ids:s2.ids,signatures:s2.signatures,auto:true,exportAt:new Date().toISOString(),instantaneAt:s2.at});
 assert.equal(out.cleared,true);assert.equal(stored(b).length,0,'instantané pris après la grâce : la dernière écriture part avec le lot');
 /* Sans instant d'instantané (ancien panneau) : seule la grâce EN COURS est refusée. */
 const x=await swCache();await x.b.api('stop');await Promise.allSettled([...x.r.pending]);const s3=x.snap();
 await assert.rejects(x.b.api('export-cache-clear',{ids:s3.ids,signatures:s3.signatures,manuel:true}),/réessaie dans quelques secondes/);
});
