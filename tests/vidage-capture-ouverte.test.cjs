'use strict';
/* 4.9.0.4 (retour de la séance du 12 octobre) — « Vider le cache des exports » répondait « Vidage impossible : une capture
 * est en cours (STALE) » après un lot terminé parce que son DERNIER cut à valider est DIFFÉRÉ (stoppedAtEnd.reason =
 * « dernier-cut-differe »). Dans ce cas le service worker (background.js, `closeAtExit`) clôt le lot SANS fermer la capture
 * « avant » du cut : collection = READY_FOR_AFTER (puis STALE dès que l'opérateur navigue dans ESV, `Engine.observe`),
 * lidarId présent, proposition présente. `src/export-cache.js` `refus` n'admettait que IDLE / AFTER_CAPTURED.
 *
 * Règle retenue : sur un lot FINI POUR DE BON (fin naturelle COMPLETED / FINISHED_WITH_UNCONFIRMED_ACTIONS, ou arrêt à son
 * dernier cut = STOPPED + stoppedAtEnd), une capture « avant » ouverte (BEFORE_CAPTURED, READY_FOR_AFTER, STALE) ne bloque
 * plus le vidage, À CONDITION que tout ce qu'elle tient soit gardé : son nuage LiDAR (`lidarId`), les événements qui le
 * nomment (lidarId, lidarCaptureId, captureId) ou nomment sa proposition, et les événements de la même visite (`visitId`),
 * ainsi que les visites qui le nomment. Un lot arrêté à la main (reprenable), un lot ouvert, une action en cours, Écho /
 * Correction, la grâce de 5 s, la clôture V1 : refus inchangés. `src/engine.js` n'est pas modifié.
 *
 * Données FABRIQUÉES (aucune donnée ni code d'ESV). Service worker RÉEL (background.js), moteur réel, faux stockage. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production}=require('./helpers/perf-production.cjs');
const EC=require('../src/export-cache.js'),X=require('../src/native-export.js'),Z=require('../src/zip-writer.js');
const Settings=require('../src/settings.js'),GCV1=require('../src/gcv1-export.js');
const {panneau}=require('../tools/audit-qualite-480.cjs');

/* ---------- 1. refus() : chaque couple (état du lot × collection) ---------- */
const FIN_DIFFERE={cut:105,reason:'dernier-cut-differe',issue:'dernier-cut-differe',motif:'dernier-invalide',target:null,total:500,at:'2026-01-01T09:00:00.000Z',applied:false};
const LOTS_FINIS={                                  // lots finis pour de bon
  'STOPPED + dernier-cut-differe':{state:'STOPPED',stoppedAtEnd:FIN_DIFFERE},
  'STOPPED + dernier-cut-valide':{state:'STOPPED',stoppedAtEnd:{cut:105,reason:'dernier-cut-valide',issue:'dernier-cut-valide',applied:true}},
  'STOPPED + dernier cut non résolu laissé (stopAtLotEnd)':{state:'STOPPED',stoppedAtEnd:{cut:101,at:'2026-01-01T09:00:00.000Z',applied:false}},
  'STOPPED + dernier cut posé non validé (stopAtLotEnd)':{state:'STOPPED',stoppedAtEnd:{cut:101,at:'2026-01-01T09:00:00.000Z',applied:true}},
  'STOPPED + sortie pendant un cut':{state:'STOPPED',stoppedAtEnd:{cut:101,reason:'navigation-other-part',issue:'sortie-pendant-cut',applied:true}},
  'COMPLETED':{state:'COMPLETED'},
  'FINISHED_WITH_UNCONFIRMED_ACTIONS':{state:'FINISHED_WITH_UNCONFIRMED_ACTIONS'}};
const LOTS_OUVERTS=['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE','PAUSED_DEFER_NAVIGATION_UNCERTAIN','MANUAL_TAKEOVER','ERROR'];
const OUVERTES=['BEFORE_CAPTURED','READY_FOR_AFTER','STALE'];
const c=(batch,collection,plus={})=>({state:{collection,batch:batch&&{id:'x',...batch},...(plus.state||{})},...plus.ctx});

test('refus : lot fini pour de bon × collection — libres ET captures ouvertes permis (manuel et automatique)',()=>{
  for(const [nom,lot] of Object.entries(LOTS_FINIS))
    for(const col of [undefined,null,'IDLE','AFTER_CAPTURED',...OUVERTES])
      for(const auto of [false,true])
        assert.equal(EC.refus(c(lot,col),{auto}),null,`${nom} × ${col} (auto=${auto})`);
});
test('refus : lot fini pour de bon × EXPORTED (jamais atteint depuis le panneau) : refus inchangé',()=>{
  for(const lot of Object.values(LOTS_FINIS))assert.match(EC.refus(c(lot,'EXPORTED'))??'',/^une capture est en cours \(EXPORTED\)/);
});
test('refus : lot arrêté À LA MAIN (STOPPED sans stoppedAtEnd) — capture ouverte refusée, dit quoi faire ; sans capture ouverte inchangé',()=>{
  const main={state:'STOPPED'};
  for(const col of OUVERTES){
    const r=EC.refus(c(main,col));assert.match(r??'',new RegExp('^une capture est en cours \\('+col+'\\)'),col);
    assert.match(r,/arrêté à la main/);assert.match(r,/Reprendre/,'dit quoi faire');assert.match(r,/puis vide|puis réessaie/);
    assert.match(EC.refus(c(main,col),{auto:true})??'',/peut être repris/,'automatique : refus « reprenable » d’abord');
  }
  for(const col of [undefined,null,'IDLE','AFTER_CAPTURED']){assert.equal(EC.refus(c(main,col)),null,'manuel permis sans capture ouverte');
    assert.match(EC.refus(c(main,col),{auto:true})??'',/peut être repris/);}
});
test('refus : lots ouverts (RUNNING, en pause, repris à la main, en erreur) — refus « pas terminé » avant toute capture, inchangé',()=>{
  for(const st of LOTS_OUVERTS)for(const col of ['IDLE','AFTER_CAPTURED',...OUVERTES])
    assert.match(EC.refus(c({state:st},col))??'',new RegExp('^un lot n’est pas terminé \\('+st+'\\)'),st+' × '+col);
});
test('refus : sans lot — capture manuelle ouverte refusée avec la marche à suivre ; libre permis',()=>{
  for(const col of OUVERTES){const r=EC.refus(c(null,col));assert.match(r??'',new RegExp('^une capture est en cours \\('+col+'\\)'),col);assert.match(r,/enregistre l’après ou annule/);}
  for(const col of [undefined,null,'IDLE','AFTER_CAPTURED'])assert.equal(EC.refus(c(null,col)),null,String(col));
});
test('refus : une capture ouverte sur un lot fini ne lève pas les autres refus (action en cours, Écho, Correction, clôture V1, grâce)',()=>{
  const lot=LOTS_FINIS['STOPPED + dernier-cut-differe'];
  for(const col of OUVERTES){
    assert.match(EC.refus({...c(lot,col),busy:true})??'',/travaille encore/);assert.match(EC.refus({...c(lot,col),task:Promise.resolve()})??'',/travaille encore/);
    assert.match(EC.refus({...c(lot,col),nativeActive:true})??'',/Écho est actif/);assert.match(EC.refus({...c(lot,col),manualActive:true})??'',/Mes corrections/);
    assert.match(EC.refus({...c(lot,col),timing:{batch:{closed:false}}})??'',/clôture de la mesure V1/);
    assert.match(EC.refus({...c(lot,col),timing:{batch:{closed:true},pending:new Set([1])}})??'',/écritures de mesure/);
    assert.match(EC.refus({...c(lot,col),graceObservations:'en-cours'})??'',/5 s au plus/);assert.match(EC.refus({...c(lot,col),graceObservations:'depuis-instantane'})??'',/refais l’export avant de vider/);
  }
});
test('refus : résultat incertain (intention, réconciliation, navigation différée en cours) sur un lot fini à capture ouverte : refusé, dit quoi faire',()=>{
  const lot=LOTS_FINIS['STOPPED + dernier-cut-differe'];
  const cas={'intention':{intent:{kind:'validate'}},'réconciliation':{reconcileRequired:true},'navigation différée':{deferIntent:{phase:'COMMAND_MAY_HAVE_BEEN_SENT'}}};
  for(const [nom,plus] of Object.entries(cas))for(const col of OUVERTES){
    const r=EC.refus({state:{collection:col,batch:{id:'x',...lot},...plus}});assert.match(r??'',/résultat.*à contrôler dans ESV/,nom+' × '+col);assert.match(r,/Archiver le résultat interrompu/);}
  assert.equal(EC.refus({state:{collection:'READY_FOR_AFTER',batch:{id:'x',...lot},deferIntent:{phase:'FINALIZED'}}}),null,'navigation différée finalisée : plus incertaine');
});
test('reprenable : seulement STOPPED sans stoppedAtEnd (avertissement du panneau inchangé)',()=>{
  assert.equal(EC.reprenable(c({state:'STOPPED'},'IDLE')),true);
  for(const lot of Object.values(LOTS_FINIS))assert.equal(EC.reprenable(c(lot,'READY_FOR_AFTER')),false);
});

/* ---------- 2. ce que la capture ouverte tient : capturesAGarder() ---------- */
const evenements=()=>[
  {eventId:'p0',type:'before-captured',lidarId:'cap-0',batchId:'lot-F'},                     // coupes passées
  {eventId:'p1',type:'gcv1-shadow-observed',lidarCaptureId:'cap-1',proposalId:'prop-1',batchId:'lot-F'},
  {eventId:'p2',type:'phase-timing',captureId:'cap-2',visitId:'v-2',batchId:'lot-F'},
  {eventId:'p3',type:'batch-state',batchId:'lot-F'},
  {eventId:'o0',type:'before-captured',lidarId:'cap-ouvert',batchId:'lot-F'},                // capture ouverte
  {eventId:'o1',type:'proposed',proposal:{id:'prop-ouvert'},batchId:'lot-F'},
  {eventId:'o2',type:'gcv1-shadow-observed',lidarCaptureId:'cap-ouvert',proposalId:'prop-ouvert',batchId:'lot-F'},
  {eventId:'o3',type:'phase-timing',captureId:'cap-ouvert',visitId:'v-ouvert',batchId:'lot-F'},
  {eventId:'o4',type:'phase-timing',captureId:null,visitId:'v-ouvert',batchId:'lot-F'},      // même visite, avant la capture
  {eventId:'o5',type:'esv-observation',visitId:'v-ouvert',batchId:'lot-F'},                  // même visite (observateur)
  {eventId:'o6',type:'defer-finalized',lidarCaptureId:'cap-ouvert',batchId:'lot-F'},
  {eventId:'q0',type:'dernier-cut-differe',batchId:'lot-F'},                                  // fin du lot : aucune référence
  {eventId:'q1',type:'batch-stopped-at-end',batchId:'lot-F'},
  {eventId:'q2',type:'phase-timing',visitId:'v-2',batchId:'lot-F'}];
const OUVERT=['o0','o1','o2','o3','o4','o5','o6'];
const plat=x=>JSON.parse(JSON.stringify(x));         // objets venus du service worker (autre « realm » vm) : comparés par valeur
const etat=(col,plus={})=>({collection:col,lidarId:'cap-ouvert',proposal:{id:'prop-ouvert'},before:{identity:{part:7,cut:105}},...plus});

test('capturesAGarder : le nuage lidarId, les événements qui le nomment ou nomment sa proposition, les événements de la même visite, les visites qui le nomment',()=>{
  const records=[{recordId:'r0',lidarCaptureId:'cap-0'},{recordId:'rx',lidarCaptureId:'cap-ouvert'}];
  for(const col of OUVERTES){
    const g=EC.capturesAGarder(etat(col),evenements(),records);
    assert.deepEqual(g.clouds,['cap-ouvert'],col);assert.deepEqual([...g.events].sort(),OUVERT,col);assert.deepEqual(g.records,['rx'],col);
  }
});
test('capturesAGarder : rien à garder sans nuage, sans capture ouverte, ou quand la capture est refermée (nuage et visite partent ensemble)',()=>{
  const vide={clouds:[],events:[],records:[]};
  assert.deepEqual(EC.capturesAGarder(etat('BEFORE_CAPTURED',{lidarId:null,proposal:null}),evenements(),[]),vide,'avant sans nuage : rien en base à garder');
  for(const col of [undefined,null,'IDLE','AFTER_CAPTURED','EXPORTED'])assert.deepEqual(EC.capturesAGarder(etat(col),evenements(),[{recordId:'r',lidarCaptureId:'cap-ouvert'}]),vide,String(col));
  assert.deepEqual(EC.capturesAGarder(null,[],[]),vide);
});

/* ---------- 3. service worker réel : l'état du terrain ---------- */
function stockage(b){const mem={},st=b.store;
  Object.assign(b.ctx.chrome.storage.local,{get:async k=>typeof k==='string'?(k in mem?{[k]:structuredClone(mem[k])}:{}):{},set:async o=>{for(const k of Object.keys(o))mem[k]=structuredClone(o[k]);}});
  st.deleteMany=async(nom,ids)=>{const g=new Set(ids);let n=0;
    if(nom==='events'){const a=st.events.length;st.events=st.events.filter(x=>!g.has(x.eventId));n=a-st.events.length;}
    else if(nom==='records'){const a=st.records.length;st.records=st.records.filter(x=>!g.has(x.recordId||x.id));n=a-st.records.length;}
    else for(const i of ids)if(st.clouds.delete(i))n++;
    return n;};
  st.keys=async n=>n==='clouds'?[...st.clouds.keys()]:n==='events'?st.events.map(x=>x.eventId):st.records.map(x=>x.recordId||x.id);
  const snap=()=>({at:Date.now(),ids:{events:st.events.map(x=>x.eventId),records:st.records.map(x=>x.recordId||x.id),clouds:[...st.clouds.keys()]},
    signatures:{events:Object.fromEntries(st.events.map(o=>[o.eventId,EC.signature(o)])),records:Object.fromEntries(st.records.map(o=>[o.recordId||o.id,EC.signature(o)]))}});
  return {mem,st,snap};}
/* Lot GCV1 « jusqu'à la fin de partie » fini sur un dernier cut différé : capture « avant » du dernier cut restée ouverte. */
async function terrain({collection='READY_FOR_AFTER',fin=FIN_DIFFERE,etatLot='STOPPED',lidarId='cap-ouvert'}={}){
  const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});const s=stockage(b),{st}=s;
  const e=b.get('engine'),r=b.get('timing');
  e.s.batch={id:'lot-F',state:etatLot,step:'apply',startedAt:new Date(Date.now()-3600e3).toISOString(),scope:{part:7,start:100,end:999999,endMode:'partie',geometryEngine:'geometry-candidate-v1',unresolvedPolicy:'defer'},
    processed:[{key:'k0',cut:100}],skipped:[],paused:[],interrupted:[{status:'DEFER_DERNIER_CUT_SANS_ENVOI',commandInvoked:false}],sequence:[],deferred:[{key:'k1',cut:101}],...(fin?{stoppedAtEnd:{...fin,at:new Date(Date.now()-60e3).toISOString()}}:{})};
  r.syncBatch(true);r.batch.closed=true;await Promise.allSettled([...r.pending]);
  e.s.before={identity:structuredClone(b.adapter.identity),rails:{}};e.s.lidarId=lidarId;e.s.proposal=lidarId?{id:'prop-ouvert',rails:{}}:null;e.s.collection=collection;
  st.events.length=0;st.records.length=0;st.clouds.clear();
  for(const ev of evenements())st.events.push(structuredClone(ev));
  for(let i=0;i<3;i++){st.records.push({recordId:'r'+i,identity:{part:7,cut:100+i},lidarCaptureId:'cap-'+i});st.clouds.set('cap-'+i,{captureId:'cap-'+i,pointsSceneRelative:[[0,0,0]]});}
  if(lidarId)st.clouds.set(lidarId,{captureId:lidarId,pointsSceneRelative:[[1,2,3],[4,5,6]]});
  return {b,e,r,st,...s};}
const vieillir=(b,id,ms)=>{const f=b.get('obsFins').get(id);if(f)f.at-=ms;};

test('TERRAIN reproduit : lot STOPPED + dernier-cut-differe, collection READY_FOR_AFTER puis STALE — vidage PERMIS (avant : « une capture est en cours »)',async()=>{
  for(const col of ['READY_FOR_AFTER','STALE']){
    const x=await terrain({collection:col});
    const info=await x.b.api('export-cache-info');
    assert.equal(info.refus,null,`${col} : vidage permis`);assert.equal(info.reprenable,false);
    assert.deepEqual(plat(info.capture.clouds),['cap-ouvert']);assert.deepEqual(plat(info.capture.events).sort(),OUVERT);assert.equal(info.capture.collection,col);
    assert.equal((await x.b.api('export-cache-info',{auto:true})).refus,null,'automatique (désactivé par défaut) : permis aussi sur un lot fini');
  }
});
test('TERRAIN : vidage manuel — le nuage de la capture ouverte est GARDÉ, les autres supprimés ; événements référencés gardés ; comptes exacts ; état intact',async()=>{
  for(const col of ['READY_FOR_AFTER','STALE','BEFORE_CAPTURED']){
    const x=await terrain({collection:col}),s=x.snap(),avant=JSON.stringify(x.e.s),total=s.ids.events.length;
    const out=await x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,exportAt:null,instantaneAt:s.at});
    assert.equal(out.cleared,true,col);
    assert.deepEqual([...x.st.clouds.keys()],['cap-ouvert'],col+' : seul le nuage de la capture ouverte reste');
    assert.equal(out.clouds,3);assert.equal(out.records,3);assert.equal(out.events,total-OUVERT.length,'comptes exacts : supprimés = présents − gardés');
    assert.deepEqual(x.st.events.map(v=>v.eventId).sort(),OUVERT,'événements gardés = ceux que la capture ouverte nomme');
    assert.deepEqual(plat(out.captureGardee),{collection:col,nuages:1,evenements:OUVERT.length,visites:0},col);
    assert.match(out.text,/capture ouverte du dernier cut gardée \(1 nuage/);assert.match(x.mem[EC.CLE].captureGardee?.collection??'',new RegExp(col));
    assert.equal(JSON.stringify(x.e.s),avant,'état du moteur et du lot : octet pour octet');
    assert.equal(x.e.s.batch.state,'STOPPED');assert.equal(x.e.s.batch.stoppedAtEnd.reason,'dernier-cut-differe');
    assert.equal(x.e.s.lidarId,'cap-ouvert');assert.ok(await x.st.getCloud('cap-ouvert'),'le nuage lu par analyze()/commandLot() est toujours là');
  }
});
test('TERRAIN : vidage automatique (après export confirmé) — même règle ; la capture ouverte part avec le prochain export',async()=>{
  const x=await terrain({collection:'STALE'}),s=x.snap();
  const out=await x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,exportAt:'2026-10-12T13:00:00.000Z',auto:true,instantaneAt:s.at});
  assert.equal(out.cleared,true);assert.deepEqual([...x.st.clouds.keys()],['cap-ouvert']);assert.deepEqual(plat(out.captureGardee),{collection:'STALE',nuages:1,evenements:OUVERT.length,visites:0});
  assert.match(out.text,/vidées après export du 2026-10-12T13:00:00/);assert.match(out.text,/capture ouverte du dernier cut gardée/);
});
test('TERRAIN : après le vidage, le moteur archive la capture ouverte (archivePending) et le second export reste cohérent',async()=>{
  const x=await terrain({collection:'STALE'}),s=x.snap();
  await x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,instantaneAt:s.at});
  await x.e.archivePending('target-changed');                       // ce que fait begin() quand la collection est STALE
  assert.equal(x.e.s.collection,'IDLE');assert.equal(x.e.s.before,null);
  const archive=x.st.records.find(r=>r.reason==='target-changed');assert.ok(archive,'enregistrement « incomplete-no-after » écrit');
  assert.equal(archive.lidarCaptureId,'cap-ouvert');assert.ok(await x.st.getCloud(archive.lidarCaptureId),'…et son nuage existe');
  const second=await x.b.api('dataset');
  assert.deepEqual(plat(second.cloudIds),['cap-ouvert']);
  const idsEv=new Set(second.events.map(v=>v.eventId));for(const id of OUVERT)assert.ok(idsEv.has(id),id+' dans le second export');
  assert.ok(!second.events.some(v=>['p0','p1','p2','p3','q0','q1','q2'].includes(v.eventId)),'rien de ce qui est déjà parti');
  for(const rec of second.records)if(rec.lidarCaptureId)assert.ok(second.cloudIds.includes(rec.lidarCaptureId),'toute visite du second export a son nuage');
  for(const ev of second.events)for(const id of [ev.lidarId,ev.lidarCaptureId,ev.captureId].filter(Boolean))assert.ok(second.cloudIds.includes(id),'tout événement du second export nomme un nuage présent : '+id);
  const meta=await x.b.api('dataset-meta');assert.match(meta.exportPeriod.previousDataCleared.text,/capture ouverte du dernier cut gardée/);
});
test('TERRAIN : un second vidage ne supprime pas non plus la capture ouverte (tant qu’elle est ouverte)',async()=>{
  const x=await terrain({collection:'READY_FOR_AFTER'});let s=x.snap();
  await x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,instantaneAt:s.at});
  s=x.snap();const out=await x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,instantaneAt:s.at});
  assert.deepEqual([...x.st.clouds.keys()],['cap-ouvert']);assert.equal(out.clouds,0);assert.equal(out.events,0);assert.equal(out.captureGardee.nuages,1);
});
test('TERRAIN : fins naturelles et arrêts au dernier cut — mêmes garanties, sans capture ouverte rien de plus n’est gardé',async()=>{
  for(const [etatLot,fin] of [['COMPLETED',null],['FINISHED_WITH_UNCONFIRMED_ACTIONS',null],['STOPPED',{cut:101,applied:true}]]){
    const x=await terrain({etatLot,fin});vieillir(x.b,'lot-F',10000);
    const s=x.snap(),out=await x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,instantaneAt:s.at});
    assert.deepEqual([...x.st.clouds.keys()],['cap-ouvert'],etatLot);assert.equal(out.captureGardee.nuages,1);
  }
  const x=await terrain({collection:'AFTER_CAPTURED'});const s=x.snap(),out=await x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,instantaneAt:s.at});
  assert.equal(x.st.clouds.size,0,'capture refermée : le nuage part avec sa visite');assert.equal(out.captureGardee??null,null);assert.equal(x.st.events.length,0);
});
test('TERRAIN : capture « avant » sans nuage (BEFORE_CAPTURED, lidarId nul) sur un lot fini — permis, rien à garder',async()=>{
  const x=await terrain({collection:'BEFORE_CAPTURED',lidarId:null});const s=x.snap();
  const out=await x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,instantaneAt:s.at});
  assert.equal(x.st.clouds.size,0);assert.equal(out.captureGardee??null,null);
});
test('LOT ARRÊTÉ À LA MAIN avec capture ouverte : refus INCHANGÉ (reprenable), rien n’est supprimé ; automatique aussi refusé',async()=>{
  for(const col of ['READY_FOR_AFTER','STALE','BEFORE_CAPTURED']){
    const x=await terrain({collection:col,fin:null});const s=x.snap(),avant=x.snap();
    await assert.rejects(x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,instantaneAt:s.at}),new RegExp('Vidage refusé : une capture est en cours \\('+col+'\\).*Reprendre'),col);
    await assert.rejects(x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,exportAt:'x',auto:true,instantaneAt:s.at}),/pas terminé.*repris/);
    assert.match((await x.b.api('export-cache-info')).refus??'',/capture est en cours/);assert.equal((await x.b.api('export-cache-info')).reprenable,true);
    assert.deepEqual(x.snap().ids,avant.ids,'rien supprimé');assert.equal(x.mem[EC.CLE],undefined,'aucun marqueur');
  }
});
test('lot en cours, en pause, repris à la main, en erreur, avec capture ouverte : refus inchangé',async()=>{
  for(const etatLot of ['RUNNING','PAUSED','MANUAL_TAKEOVER','ERROR']){
    const x=await terrain({etatLot,fin:null});const s=x.snap();
    await assert.rejects(x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true}),/Vidage refusé : un lot n’est pas terminé/,etatLot);assert.equal(x.st.clouds.size,4);
  }
});
test('lot fini + capture ouverte mais action en cours ou résultat incertain : refusé',async()=>{
  const x=await terrain({collection:'READY_FOR_AFTER'});const s=x.snap();
  x.e.busy=true;await assert.rejects(x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true}),/travaille encore/);x.e.busy=false;
  x.e.s.reconcileRequired=true;await assert.rejects(x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true}),/à contrôler dans ESV/);x.e.s.reconcileRequired=false;
  x.e.s.intent={kind:'validate'};await assert.rejects(x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true}),/à contrôler dans ESV/);x.e.s.intent=null;
  assert.equal(x.st.clouds.size,4);
});
test('vidage automatique : réglé à FAUX par défaut ; reste refusé pour un lot reprenable (avec ou sans capture ouverte)',()=>{
  assert.equal(Settings.export.viderApresExport,false,'défaut faux');
  for(const col of [undefined,'IDLE','AFTER_CAPTURED',...OUVERTES])assert.match(EC.refus(c({state:'STOPPED'},col),{auto:true})??'',/peut être repris/,String(col));
});

/* ---------- 4. panneau réel : confirmation et message ---------- */
async function ouvrir({capture=null,clearPlus={},auto=false,toutGarde=false}={}){
  const data={clouds:new Map(['cap-0','cap-1','cap-ouvert'].map((id,i)=>[id,{captureId:id,pointsSceneRelative:[[i,1,2],[3,4,5]]}])),
    events:[...Array.from({length:10},(_,i)=>({eventId:'e'+i,batchId:'lot-F'})),{eventId:'o0',batchId:'lot-F'},{eventId:'o1',batchId:'lot-F'}],
    records:[{recordId:'r0',identity:{part:7,cut:100}},{recordId:'r1',identity:{part:7,cut:101}}]},appels=[],confirmations=[];
  const store={all:async n=>structuredClone(n==='events'?data.events:n==='records'?data.records:[]),keys:async n=>n==='clouds'?[...data.clouds.keys()]:n==='events'?data.events.map(e=>e.eventId):data.records.map(r=>r.recordId),getCloud:async id=>structuredClone(data.clouds.get(id))};
  const diagnostic={format:'banane-gcv1-diagnostic-v1',version:'4.9.0.4',sessionId:'s',observationCount:3,observations:[...data.clouds.keys()].map(id=>({lidar:{captureId:id}}))};
  const meta={format:'banane-test-dataset-v4',version:'4.9.0.4',exportedAt:'2026-10-12T13:00:00.000Z',state:{batch:{id:'lot-F'}},cloudIds:[...data.clouds.keys()]};
  const globals={BananeStorage3:class{constructor(){return store;}},BananeExportCache:EC,BananeSettings:{...Settings,export:{...Settings.export,viderApresExport:auto}},BananeNativeExport:X,BananeZip:Z,
    BananeGCV1Export:{buildDiagnostic:()=>diagnostic,buildCorpusPlan:GCV1.buildCorpusPlan},confirm:t=>{confirmations.push(t);return true;}};
  const chromeExtra=auto?{downloads:{download:async()=>7,search:async()=>[{state:'complete'}],onChanged:{addListener(){},removeListener(){}}}}:{};
  if(toutGarde)capture={collection:'READY_FOR_AFTER',clouds:[...data.clouds.keys()],events:data.events.map(e=>e.eventId),records:data.records.map(r=>r.recordId)};
  const state={current:{identity:{part:7,cut:105}},collection:'READY_FOR_AFTER',batch:{state:'STOPPED',stoppedAtEnd:FIN_DIFFERE,scope:{part:7,start:100,end:999999},processed:[],deferred:[],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:[],activeIdentity:null}};
  const p=await panneau(state,{globals,chromeExtra,reponses:{'dataset-meta':meta,'journal-meta':{...meta,format:'banane-test-journal-v4',cloudIds:undefined},'gcv1-export-meta':{version:'4.9.0.4'},cloud:null,'export-cache-info':()=>({refus:null,reprenable:false,marqueur:null,capture}),
    'export-cache-clear':a=>{appels.push(a);const gardes=capture?{clouds:capture.clouds,events:capture.events,records:capture.records||[]}:{clouds:[],events:[],records:[]};
      return {cleared:true,events:a.ids.events.filter(i=>!gardes.events.includes(i)).length,records:a.ids.records.filter(i=>!gardes.records.includes(i)).length,clouds:a.ids.clouds.filter(i=>!gardes.clouds.includes(i)).length,
        captureGardee:capture?{collection:capture.collection,nuages:gardes.clouds.length,evenements:gardes.events.length,visites:gardes.records.length}:null,...clearPlus};}}});
  return {p,appels,confirmations};}
const CAPTURE={collection:'READY_FOR_AFTER',clouds:['cap-ouvert'],events:['o0','o1'],records:[]};

test('panneau : lot fini sur un dernier cut différé — le bouton est actif, la confirmation dit ce qui est GARDÉ et ne compte pas la capture parmi ce qui sera supprimé',async()=>{
  const t=await ouvrir({capture:CAPTURE});assert.equal(t.p.$('export-cache-clear').disabled,false);
  await t.p.$('export-cache-clear').onclick();await t.p.attendre();
  assert.equal(t.confirmations.length,1);const txt=t.confirmations[0];
  assert.match(txt,/2 visites, 10 événements, 2 nuages LiDAR/,'supprimé = présent − gardé');
  assert.match(txt,/GARDÉ/);assert.match(txt,/capture ouverte du dernier cut/);assert.match(txt,/1 nuage LiDAR/);assert.match(txt,/2 événements/);assert.match(txt,/prochain export/);
  assert.match(txt,/IRRÉVERSIBLE/);
  assert.equal(t.appels.length,1);assert.equal(t.appels[0].manuel,true);
  assert.match(t.p.$('export-status').textContent,/Cache des exports vidé : 10 événements, 2 visites, 2 nuages LiDAR\./);
  assert.match(t.p.$('export-status').textContent,/1 nuage gardé : capture du dernier cut/);
});
test('panneau : sans capture ouverte, le texte de confirmation et le message restent ceux d’avant (aucune phrase « gardé »)',async()=>{
  const t=await ouvrir({capture:null});await t.p.$('export-cache-clear').onclick();await t.p.attendre();
  assert.match(t.confirmations[0],/2 visites, 12 événements, 3 nuages LiDAR/);assert.doesNotMatch(t.confirmations[0],/GARDÉ/);
  assert.doesNotMatch(t.p.$('export-status').textContent,/nuage gardé/);
});

test('panneau : tout ce qui reste est gardé — pas de confirmation, message « rien d’autre à vider » qui dit ce qui est gardé',async()=>{
  const t=await ouvrir({toutGarde:true});await t.p.$('export-cache-clear').onclick();await t.p.attendre();
  assert.equal(t.confirmations.length,0);assert.equal(t.appels.length,0);
  assert.match(t.p.$('export-status').textContent,/Rien d’autre à vider\. 3 nuages gardés : capture du dernier cut/);
});
test('panneau : vidage AUTOMATIQUE après un export confirmé sur un lot fini à capture ouverte — le message dit ce qui est gardé',async()=>{
  const t=await ouvrir({capture:CAPTURE,auto:true});await t.p.$('export-tout').onclick();await t.p.attendre();
  const st=t.p.$('export-status').textContent;assert.equal(t.appels.length,1,st);assert.equal(t.appels[0].auto,true);
  assert.match(st,/Cache d’export vidé \(10 événements, 2 visites, 2 nuages\)/);assert.match(st,/1 nuage gardé : capture du dernier cut \(2 événements liés gardés aussi\)\. Elle partira avec le prochain export\./);
  assert.doesNotMatch(st,/incomplet|NON vidé/);
});
test('marqueur : le texte dit que la capture ouverte du dernier cut est gardée (et sinon reste celui d’avant)',()=>{
  const m={at:'2026-10-12T13:05:00.000Z',manuel:true};
  assert.equal(EC.texte(m),'données précédentes vidées manuellement le 2026-10-12T13:05:00.000Z, sans export confirmé par Ariane');
  assert.equal(EC.texte({...m,captureGardee:{collection:'STALE',nuages:0,evenements:0,visites:0}}),EC.texte(m));
  assert.match(EC.texte({...m,captureGardee:{collection:'STALE',nuages:1,evenements:7,visites:0}}),/; capture ouverte du dernier cut gardée \(1 nuage LiDAR, 7 événements\), qui figure de nouveau dans l’export suivant$/);
  assert.match(EC.texte({at:m.at,afterExportAt:'2026-10-12T13:00:00.000Z',captureGardee:{nuages:2,evenements:1,visites:1}}),/^données précédentes vidées après export du 2026-10-12T13:00:00.*2 nuages LiDAR, 1 événement, 1 visite/);
});
test('export-cache-info : refus => pas de capture annoncée ; permis sans capture ouverte => capture nulle',async()=>{
  const x=await terrain({collection:'READY_FOR_AFTER',fin:null});const i1=await x.b.api('export-cache-info');assert.notEqual(i1.refus,null);assert.equal(i1.capture,null);
  const y=await terrain({collection:'AFTER_CAPTURED'});const i2=await y.b.api('export-cache-info');assert.equal(i2.refus,null);assert.equal(i2.capture,null);
});
