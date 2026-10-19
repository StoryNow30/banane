'use strict';
/* 4.9.0.4, relecture indépendante (constat DON-1) — COURSE entre l'instantané du panneau et la suppression.
 *
 * Le panneau prend son instantané (identifiants + signatures) quand la capture « avant » X du dernier cut est OUVERTE (le nuage X
 * y figure). Si la capture est ensuite archivée, refermée ou annulée (second panneau, appel direct au service worker,
 * ou fenêtre de confirmation), le moteur écrit la visite R(X) qui NOMME X. R(X) n'est pas dans l'instantané, donc elle reste ;
 * `captureOuverteAGarder()` ne voit plus de capture ouverte (état vivant relu après des attentes), `garder.clouds` est vide, et le
 * « second contrôle » compare null à null. Avant la correction : X était SUPPRIMÉ alors que R(X) restait (visite orpheline).
 * Règle ajoutée : jamais de suppression d'un nuage que nomme une visite qui RESTE (src/export-cache.js, supprimer()), et le
 * second contrôle compare l'identifiant relevé AU DÉBUT de la lecture (captureOuverteAGarder).
 *
 * Données FABRIQUÉES (aucune donnée ni code d'ESV, aucune valeur d'une vraie partie). Service worker RÉEL, moteur réel, faux stockage. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production}=require('./helpers/perf-production.cjs');
const EC=require('../src/export-cache.js');

/* ---------- 1. supprimer() : l'intégrité visite -> nuage ---------- */
function faux({records=[],clouds=['X','Y'],events=[]}={}){
  const st={records:records.map(r=>structuredClone(r)),clouds:new Map(clouds.map(i=>[i,{captureId:i}])),events:events.map(e=>structuredClone(e))};
  st.all=async n=>n==='records'?structuredClone(st.records):n==='events'?structuredClone(st.events):[...st.clouds.values()];
  st.deleteMany=async(nom,ids)=>{const g=new Set(ids);let n=0;
    if(nom==='records'){const a=st.records.length;st.records=st.records.filter(r=>!g.has(r.recordId||r.id));n=a-st.records.length;}
    else if(nom==='events'){const a=st.events.length;st.events=st.events.filter(e=>!g.has(e.eventId));n=a-st.events.length;}
    else for(const i of ids)if(st.clouds.delete(i))n++;
    return n;};
  st.deleteIfUnchanged=async(nom,ids,sigs,signature)=>{const supprimes=[],gardes=[],liste=nom==='records'?st.records:st.events,cle=o=>nom==='records'?(o.recordId||o.id):o.eventId;
    for(const id of ids){const o=liste.find(x=>cle(x)===id);if(!o)continue;if(signature(o)===sigs[id])supprimes.push(id);else gardes.push(id);}
    const s=new Set(supprimes);if(nom==='records')st.records=st.records.filter(r=>!s.has(r.recordId||r.id));else st.events=st.events.filter(e=>!s.has(e.eventId));
    return {supprimes,gardes};};
  return st;}
const sigs=st=>({events:Object.fromEntries(st.events.map(e=>[e.eventId,EC.signature(e)])),records:Object.fromEntries(st.records.map(r=>[r.recordId||r.id,EC.signature(r)]))});

test('supprimer : une visite qui RESTE (écrite après l’instantané) garde le nuage qu’elle nomme',async()=>{
  const st=faux({records:[]}),ids={events:[],records:[],clouds:['X','Y']},sg=sigs(st);
  st.records.push({recordId:'R-X',lidarCaptureId:'X',reason:'target-changed'});            // écrite APRÈS l'instantané
  const out=await EC.supprimer(st,ids,{events:[],records:[],clouds:[]},sg);
  assert.deepEqual([...st.clouds.keys()],['X'],'X gardé (nommé par R-X), Y supprimé');assert.equal(out.clouds,1);assert.equal(st.records.length,1);
});
test('supprimer : les morceaux (lidarChunkIds) que nomme une visite qui reste sont gardés aussi',async()=>{
  const st=faux({clouds:['X','C1','C2','Y']});const ids={clouds:['X','C1','C2','Y']},sg=sigs(st);
  st.records.push({recordId:'R-X',lidarCaptureId:'X',lidarChunkIds:['C1','C2']});
  await EC.supprimer(st,ids,{},sg);assert.deepEqual([...st.clouds.keys()].sort(),['C1','C2','X']);
});
test('supprimer : une visite de l’instantané MODIFIÉE depuis (donc gardée) garde son nuage',async()=>{
  const st=faux({records:[{recordId:'R-X',lidarCaptureId:'X',status:'a'}]}),ids={records:['R-X'],clouds:['X','Y']},sg=sigs(st);
  st.records[0].status='b';                                                                // modifiée après l'instantané : gardée par deleteIfUnchanged
  const out=await EC.supprimer(st,ids,{},sg);
  assert.deepEqual(out.modifies.records,['R-X']);assert.deepEqual([...st.clouds.keys()],['X']);
});
test('supprimer : visite ET nuage de l’instantané, visite supprimée dans la même passe — les deux partent ensemble (inchangé)',async()=>{
  const st=faux({records:[{recordId:'R-X',lidarCaptureId:'X'}]}),ids={records:['R-X'],clouds:['X','Y']};
  const out=await EC.supprimer(st,ids,{},sigs(st));
  assert.equal(st.records.length,0);assert.equal(st.clouds.size,0);assert.equal(out.clouds,2);assert.equal(out.records,1);
});
test('supprimer : une visite qui reste mais ne nomme pas le nuage ne le protège pas (inchangé)',async()=>{
  const st=faux({records:[{recordId:'R-Z',lidarCaptureId:'Z'}],clouds:['X','Z']}),ids={clouds:['X']};
  const out=await EC.supprimer(st,ids,{},sigs(st));assert.deepEqual([...st.clouds.keys()],['Z']);assert.equal(out.clouds,1);
});
test('supprimer : le nuage de `garder` reste gardé et un nuage nommé par aucune visite part (inchangé)',async()=>{
  const st=faux({clouds:['G','Y']}),out=await EC.supprimer(st,{clouds:['G','Y']},{clouds:['G']},{});
  assert.deepEqual([...st.clouds.keys()],['G']);assert.equal(out.clouds,1);
});

/* ---------- 2. service worker réel : la course ---------- */
const FIN={cut:105,reason:'dernier-cut-differe',issue:'dernier-cut-differe',motif:'dernier-invalide',target:null,total:500,applied:false};
const evenements=()=>[
  {eventId:'p0',type:'before-captured',lidarId:'cap-0',batchId:'lot-F'},
  {eventId:'o0',type:'before-captured',lidarId:'cap-ouvert',batchId:'lot-F'},
  {eventId:'o1',type:'proposed',proposal:{id:'prop-ouvert'},batchId:'lot-F'},
  {eventId:'o2',type:'gcv1-shadow-observed',lidarCaptureId:'cap-ouvert',proposalId:'prop-ouvert',batchId:'lot-F'},
  {eventId:'q0',type:'dernier-cut-differe',batchId:'lot-F'}];
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
/* Lot fini sur un dernier cut différé, capture « avant » X du dernier cut ouverte (READY_FOR_AFTER). */
async function terrain(){
  const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});const s=stockage(b),{st}=s;
  const e=b.get('engine'),r=b.get('timing');
  e.s.batch={id:'lot-F',state:'STOPPED',step:'apply',startedAt:new Date(Date.now()-3600e3).toISOString(),scope:{part:7,start:100,end:999999,endMode:'partie',geometryEngine:'geometry-candidate-v1',unresolvedPolicy:'defer'},
    processed:[{key:'k0',cut:100}],skipped:[],paused:[],interrupted:[],sequence:[],deferred:[],stoppedAtEnd:{...FIN,at:new Date(Date.now()-60e3).toISOString()}};
  r.syncBatch(true);r.batch.closed=true;await Promise.allSettled([...r.pending]);
  e.s.before=await b.adapter.state();e.s.lidarId='cap-ouvert';e.s.proposal={id:'prop-ouvert',rails:{}};e.s.collection='READY_FOR_AFTER';
  st.events.length=0;st.records.length=0;st.clouds.clear();
  for(const ev of evenements())st.events.push(structuredClone(ev));
  for(let i=0;i<3;i++){st.records.push({recordId:'r'+i,identity:{part:7,cut:100+i},lidarCaptureId:'cap-'+i});st.clouds.set('cap-'+i,{captureId:'cap-'+i,pointsSceneRelative:[[0,0,0]]});}
  st.clouds.set('cap-ouvert',{captureId:'cap-ouvert',pointsSceneRelative:[[1,2,3],[4,5,6]]});
  const vieux=b.get('obsFins').get('lot-F');if(vieux)vieux.at-=60e3;
  return {b,e,r,st,...s};}
const demande=(x,s)=>x.b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,instantaneAt:s.at});
/* Cohérence : toute visite qui nomme un nuage le trouve en base ; le nuage de la capture ouverte du moteur aussi. */
function coherent(x,msg){
  for(const r of x.st.records)for(const id of [r.lidarCaptureId,...(r.lidarChunkIds||[])].filter(Boolean))assert.ok(x.st.clouds.has(id),`${msg} : la visite ${r.recordId||r.id} nomme le nuage ${id}, absent de la base`);
  const ouverte=x.e.s.lidarId&&['BEFORE_CAPTURED','READY_FOR_AFTER','STALE'].includes(x.e.s.collection)?x.e.s.lidarId:null;
  if(ouverte)assert.ok(x.st.clouds.has(ouverte),`${msg} : le nuage de la capture ouverte est absent`);}

test('témoin : sans mutation, le nuage de la capture ouverte est gardé et la base reste cohérente (inchangé)',async()=>{
  const x=await terrain(),s=x.snap();await demande(x,s);
  assert.deepEqual([...x.st.clouds.keys()],['cap-ouvert']);coherent(x,'témoin');
});
const MUTATIONS={
  'archivée (archivePending, ce que fait begin() sur STALE)':x=>x.e.archivePending('target-changed'),
  'annulée (« Annuler la capture »)':x=>x.b.api('cancel-before'),
  'refermée (« Enregistrer l’après »)':async x=>{await x.e.finish();}};
for(const [nom,mut] of Object.entries(MUTATIONS))
  test(`course — la capture ouverte est ${nom} ENTRE l’instantané et la demande : son nuage est gardé, aucune visite orpheline`,async()=>{
    const x=await terrain(),s=x.snap();                                  // l'instantané contient cap-ouvert, capture ouverte
    await mut(x);assert.ok(!['BEFORE_CAPTURED','READY_FOR_AFTER','STALE'].includes(x.e.s.collection),'la capture n’est plus ouverte : '+x.e.s.collection);
    const nouvelle=x.st.records.find(r=>r.lidarCaptureId==='cap-ouvert');assert.ok(nouvelle,'la visite qui nomme le nuage est écrite');
    await demande(x,s);
    assert.ok(x.st.clouds.has('cap-ouvert'),'le nuage nommé par la visite qui reste est GARDÉ');assert.ok(x.st.records.some(r=>r.recordId===nouvelle.recordId&&r.id===nouvelle.id),'la visite reste');
    assert.ok(!x.st.clouds.has('cap-0')&&!x.st.clouds.has('cap-1'),'les nuages exportés des cuts passés partent');coherent(x,nom);
  });
test('course — la capture est refermée PENDANT la lecture des événements du vidage : nuage gardé, rien d’orphelin',async()=>{
  for(const mut of ['archivePending','finish']){
    const x=await terrain(),s=x.snap(),all=x.st.all;let fait=false;
    x.st.all=async n=>{const r=await all(n);if(n==='events'&&!fait){fait=true;if(mut==='finish')await x.e.finish();else await x.e.archivePending('target-changed');}return r;};
    let erreur=null;try{await demande(x,s);}catch(e){erreur=e;}
    assert.ok(fait,'la mutation a eu lieu pendant la lecture');
    assert.ok(x.st.clouds.has('cap-ouvert'),mut+' : nuage gardé'+(erreur?' (vidage refusé : '+erreur.message+')':''));coherent(x,mut);
  }
});
test('course — la capture est refermée pendant la lecture : le « second contrôle » refuse (il compare l’état relevé au DÉBUT), rien n’est supprimé',async()=>{
  const x=await terrain(),s=x.snap(),all=x.st.all;let fait=false,avant;
  x.st.all=async n=>{const r=await all(n);if(n==='events'&&!fait){fait=true;await x.e.archivePending('target-changed');avant=JSON.stringify([x.st.events.length,x.st.records.length,[...x.st.clouds.keys()]]);}return r;};
  await assert.rejects(demande(x,s),/capture ouverte a changé pendant la préparation/);
  assert.equal(JSON.stringify([x.st.events.length,x.st.records.length,[...x.st.clouds.keys()]]),avant,'rien supprimé');
});
