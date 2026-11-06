#!/usr/bin/env node
'use strict';
/* CH-058 — Banc « taille de l'état » dans un vrai Chromium, extension du dépôt chargée.
 *
 * Mesure, pour un état de 0,4 / 1 / 2 / 4 Mo (session Écho synthétique de la forme mesurée le 05/11 :
 * `visits`, `cloudIds`, `exportState.exportedCloudIds` et `releasedCloudIds`, `observationPeriods`) :
 *   1. `K.clone(état)` dans le service worker (la copie que fait `save()` et `view()`) ;
 *   2. `engine.save()` réel (copie + `chrome.storage.local.set`) ;
 *   3. la vue du panneau (`vuePanneau()` côté service worker, puis l'aller-retour `view` depuis le panneau) ;
 *   4. un cycle de visite Écho réel (`native.handle` : `visit-started` puis `visit-ended`), si la session accepte.
 * Puis la mémoire du panneau (tas JS après ramasse-miettes, nœuds DOM, écouteurs) pendant que la session
 * Écho grossit, et pendant N rafraîchissements à état constant.
 *
 * Aucune donnée terrain : tout est synthétique (identifiants aléatoires, aucune coordonnée).
 * L'état réel du moteur est remis tel qu'il était à la fin (le profil du navigateur est jetable).
 *
 *   node tools/ch058-banc-etat.cjs [--tailles 0.4,1,2,4] [--repetitions 15] [--panneau-s 60] [--export 0,50000,100000,150000]
 *        [--export-visites 1000] [--seulement-export] [--sortie f.json]
 * Variable CHROMIUM : chemin de Chromium (ex. /opt/pw-browsers/chromium). */
const path=require('node:path'),fs=require('node:fs');
const racine=path.resolve(__dirname,'..');

/* ---------- état synthétique (pur, testé sans navigateur) ---------- */
function hex(rnd,n){let s='';for(let i=0;i<n;i++)s+='0123456789abcdef'[Math.floor(rnd()*16)];return s;}
function uuid(rnd){return `${hex(rnd,8)}-${hex(rnd,4)}-4${hex(rnd,3)}-a${hex(rnd,3)}-${hex(rnd,12)}`;}
function alea(graine){let x=graine>>>0||1;return ()=>{x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};}
/* Une session Écho de `visites` visites. Proportions mesurées le 05/11 (segment 17 et état final) :
 * 6,4 identifiants de nuage par visite, une période d'observation pour 7,7 visites, exportés = libérés = nuages. */
function sessionEcho(visites,graine=1){const rnd=alea(graine),t0=Date.parse('2026-01-01T08:00:00Z');
 const periodes=[];for(let i=0;i<Math.max(1,Math.round(visites/7.7));i++)periodes.push({observationPeriodId:uuid(rnd),status:'ENDED',startedAt:new Date(t0+i*60000).toISOString(),
  endedAt:new Date(t0+i*60000+50000).toISOString(),endTimeStatus:'observed',reason:'pause'});
 const page=uuid(rnd),frame=uuid(rnd),visits=[],cloudIds=[];
 for(let i=0;i<visites;i++){const identity={pageId:page,part:8+(i%5),cut:1000+i,shape:'U50',frameId:frame,projectId:null};
  const debut=t0+i*4000;visits.push({visitId:uuid(rnd),visitIndex:i,identity,observationPeriodId:periodes[Math.floor(i/7.7)%periodes.length].observationPeriodId,
   relation:'first-observation',startedAt:new Date(debut).toISOString(),endedAt:new Date(debut+3000).toISOString(),label:null});
  const capture=uuid(rnd),n=6+(i%5===0?2:0);for(let k=0;k<n;k++)cloudIds.push(k<2?capture:`${capture}:${k%2?'right':'left'}:${k}`);}
 return {id:uuid(rnd),source:'banc-ch058',status:'PAUSED',startedAt:new Date(t0).toISOString(),finishedAt:null,observationPeriods:periodes,currentPeriodId:null,
  visits,cloudIds,incomplete:[],current:null,eventCount:visites*30,nextEventSeq:visites*30,interruptions:0,metrics:{},message:'banc CH-058',
  exportState:{bytesStored:0,bytesPending:0,exportedCloudIds:cloudIds.slice(),releasedCloudIds:cloudIds.slice(),segments:Math.ceil(visites/70),lastAdviceAt:null}};}
const mo=x=>Buffer.byteLength(JSON.stringify(x))/1048576;
/* Nombre de visites pour qu'une session pèse `cible` Mo (recherche par dichotomie, déterministe). */
function visitesPour(cible){let lo=1,hi=20000;while(hi-lo>5){const m=Math.floor((lo+hi)/2);if(mo(sessionEcho(m))<cible)lo=m;else hi=m;}return hi;}

/* ---------- statistiques ---------- */
const mediane=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor((s.length-1)/2)]:null;};
const r1=x=>x===null?null:Math.round(x*10)/10;

/* ---------- banc navigateur ---------- */
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
async function banc(o){
 const N=require('../tests/esv-maquette/navigateur.cjs');const pw=N.playwright();if(!pw)throw Error('Playwright introuvable.');
 const ctx=await pw.chromium.launchPersistentContext('',{executablePath:N.executable(),headless:true,viewport:{width:1200,height:800},
  args:['--headless=new',`--disable-extensions-except=${racine}`,`--load-extension=${racine}`,'--enable-precise-memory-info']});
 const erreurs=[],sortie={outil:'ch058-banc-etat',date:new Date().toISOString(),navigateur:null,etatBase:null,tailles:[],panneau:null,erreurs};
 try{
  for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await dormir(250);
  const sw=ctx.serviceWorkers()[0];if(!sw)throw Error('Service worker absent : extension non chargée.');
  const id=new URL(sw.url()).host;
  await sw.evaluate(async()=>{await ready;});
  sortie.navigateur=ctx.browser()?.version?.()??null;
  sortie.etatBase=await sw.evaluate(()=>({mo:JSON.stringify(engine.s).length/1048576}));
  /* 1 à 4 : par taille. */
  for(const cible of o.seulementExport?[]:o.tailles){
   const v=visitesPour(Math.max(0.01,cible-sortie.etatBase.mo));const session=sessionEcho(v,Math.round(cible*1000));
   const r=await sw.evaluate(async([session,rep])=>{const K=globalThis.BananeCore3,avant=engine.s.native;engine.s.native=session;
    const t=async f=>{const a=performance.now();await f();return performance.now()-a;},l={clone:[],save:[],vue:[],stockage:[]};
    const etatMo=JSON.stringify(engine.s).length/1048576;
    for(let i=0;i<rep;i++){l.clone.push(await t(()=>K.clone(engine.s)));l.save.push(await t(()=>engine.save()));l.vue.push(await t(()=>vuePanneau()));
     const copie=K.clone(engine.s);l.stockage.push(await t(()=>chrome.storage.local.set({banane3StateBancCh058:copie})));}
    await chrome.storage.local.remove('banane3StateBancCh058');
    globalThis.__ch058avant=avant;return {etatMo,l};},[session,o.repetitions]);
   /* Aller-retour de la vue depuis le panneau (ce que fait le panneau chaque seconde). */
   const p=await ctx.newPage();await p.goto(`chrome-extension://${id}/panel.html#home`);await dormir(800);
   const vuePanneauMs=await p.evaluate(async rep=>{const l=[];for(let i=0;i<rep;i++){const a=performance.now();await chrome.runtime.sendMessage({kind:'panel',action:'view',args:{}});l.push(performance.now()-a);}return l;},o.repetitions);
   await p.close();
   /* 4. Cycle de visite Écho réel. La session passe en RUNNING le temps du cycle, sans collecteur : seul le service worker travaille. */
   const cycle=await sw.evaluate(async rep=>{const n=engine.s.native,l=[],err=[];const per={observationPeriodId:crypto.randomUUID(),status:'RUNNING',startedAt:new Date().toISOString(),endTimeStatus:'open'};
    n.observationPeriods.push(per);n.currentPeriodId=per.observationPeriodId;n.status='RUNNING';
    const ident={pageId:'banc',part:8,cut:1,shape:'U50',frameId:'banc',projectId:null};
    for(let i=0;i<rep;i++){const visitId=crypto.randomUUID(),obs={identity:{...ident,cut:100000+i},capturedAt:new Date().toISOString(),status:'complete',partialReasons:[],geominfo:{status:'not-observed',raw:null,source:null}};
     const a=performance.now();
     try{await native.handle('visit-started',{sessionId:n.id,observationPeriodId:per.observationPeriodId,visitId,identity:obs.identity,initialObserved:obs});
      await native.handle('visit-ended',{sessionId:n.id,observationPeriodId:per.observationPeriodId,visitId,identity:obs.identity,finalObserved:{...obs,capturedAt:new Date().toISOString()},endedAt:new Date().toISOString(),reason:'target-changed',nextIdentity:{...ident,cut:100001+i}});
      l.push(performance.now()-a);}catch(e){err.push(String(e.message||e).slice(0,160));break;}}
    n.status='PAUSED';n.currentPeriodId=null;return {l,err};},Math.min(o.repetitions,10));
   await sw.evaluate(async()=>{engine.s.native=globalThis.__ch058avant;delete globalThis.__ch058avant;await engine.save();});
   const st=k=>r1(mediane(r.l[k]));
   sortie.tailles.push({cibleMo:cible,etatMo:r1(r.etatMo*100)/100,visites:v,repetitions:o.repetitions,
    cloneMs:st('clone'),saveMs:st('save'),stockageSeulMs:st('stockage'),vuePanneauSwMs:st('vue'),vuePanneauAllerRetourMs:r1(mediane(vuePanneauMs)),
    cycleVisiteEchoMs:cycle.l.length?r1(mediane(cycle.l)):null,cycleVisiteEchoErreur:cycle.err[0]||null,
    brut:{save:r.l.save.map(r1),stockage:r.l.stockage.map(r1),clone:r.l.clone.map(r1),cycle:cycle.l.map(r1)}});
   process.stderr.write(`# ${cible} Mo : ${JSON.stringify(sortie.tailles.at(-1),(k,x)=>k==='brut'?undefined:x)}\n`);}
  /* 5. Export automatique selon le nombre d'événements déjà dans IndexedDB (journée qui avance). */
  if(o.export.length)sortie.export=await bancExport(ctx,sw,id,o);
  /* 6. Mémoire du panneau : session Écho qui grossit, panneau ouvert sur l'onglet Écho ; puis état constant. */
  if(o.panneauS>0)sortie.panneau=await memoirePanneau(ctx,sw,id,o);
 }finally{await ctx.close();}
 return sortie;}
/* Un événement de lot synthétique, de la forme et du poids moyen mesurés (0,86 Ko le 05/11, journal plié). */
function evenementLot(i){return {eventId:'ch058-'+String(i).padStart(7,'0'),timestamp:new Date(Date.parse('2026-01-01T08:00:00Z')+i*100).toISOString(),type:i%3?'adapter-progress':'esv-observation',schema:1,
 sessionId:'banc',batchId:'banc-lot-'+(i%7),identity:{pageId:'banc',part:8+(i%5),cut:i%9000,shape:'U50',frameId:'banc',projectId:null},
 detail:{step:'capture',phase:i%11,pageMs:i*13.7,receivedMs:i*13.9,valeurs:Array.from({length:24},(_,k)=>Math.round((i*k)%997)/10),
  texte:'x'.repeat(360),drapeaux:{a:true,b:false,c:null},liste:[{k:'gauche',n:i%31},{k:'droit',n:i%29}]}};}
async function bancExport(ctx,sw,id,o){
 const session=sessionEcho(o.exportVisites,99);session.exportState.exportedCloudIds=session.exportState.exportedCloudIds.slice(0,Math.floor(session.cloudIds.length*0.93));
 session.exportState.releasedCloudIds=session.exportState.exportedCloudIds.slice();
 await sw.evaluate(s=>{globalThis.__ch058avant=engine.s.native;engine.s.native=s;},session);
 /* Les événements et visites de la session Écho elle-même (constants d'une mesure à l'autre). */
 await sw.evaluate(async([sid,nv])=>{const db=await store.open();await new Promise((res,rej)=>{const tx=db.transaction(['events','records'],'readwrite'),ev=tx.objectStore('events'),rc=tx.objectStore('records');
  for(let i=0;i<nv*30;i++)ev.put({eventId:'ch058-n'+i,timestamp:new Date().toISOString(),type:'native-operator-event',nativeSessionId:sid,eventSeq:i,detail:{x:'y'.repeat(600)}},'ch058-n'+i);
  for(let i=0;i<nv;i++)rc.put({recordId:'ch058-r'+i,id:'ch058-r'+i,nativeSessionId:sid,source:'native-passive-observation',visitIndex:i,identity:{pageId:'banc',part:8,cut:i,shape:'U50',frameId:'banc',projectId:null},
   railSnapshots:{left:[],right:[]},geometryCaptures:{},geometryEligibility:{left:{status:'x',reasons:[]},right:{status:'x',reasons:[]},pair:{status:'x',reasons:[]}},charge:'z'.repeat(3000)},'ch058-r'+i);
  tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});},[session.id,o.exportVisites]);
 const p=await ctx.newPage();await p.goto(`chrome-extension://${id}/panel.html#home`);await dormir(800);const cdp=await ctx.newCDPSession(p);await cdp.send('HeapProfiler.enable');
 const lignes=[];let deja=0;
 for(const total of o.export){
  /* On complète jusqu'à `total` événements de lot (hors session Écho). */
  for(let a=deja;a<total;a+=10000){const lot=Array.from({length:Math.min(10000,total-a)},(_,k)=>evenementLot(a+k));
   await sw.evaluate(async lot=>{const db=await store.open();await new Promise((res,rej)=>{const tx=db.transaction('events','readwrite'),os=tx.objectStore('events');for(const e of lot)os.put(e,e.eventId);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});},lot);}
  deja=total;
  const sw1=await sw.evaluate(async rep=>{const t=async f=>{const a=performance.now();await f();return performance.now()-a;};const m=[],c=[];
   for(let i=0;i<rep;i++){m.push(await t(()=>native.exportManifest()));c.push(await t(()=>native.exportAdvice()));}return {m,c};},3);
  /* Côté panneau : la lecture directe que fait `assembler` (tout `events`, tout `records`, puis filtre), et le tas JS juste après (sans ramasse-miettes). */
  await cdp.send('HeapProfiler.collectGarbage');const h0=(await cdp.send('Runtime.getHeapUsage')).usedSize;
  const pan=await p.evaluate(async sid=>{const db=await new Promise((res,rej)=>{const r=indexedDB.open('banane-test-v3');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
   const all=n=>new Promise((res,rej)=>{const r=db.transaction(n).objectStore(n).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
   const a=performance.now();const ev=(await all('events'));const rc=(await all('records'));const f=ev.filter(x=>x.nativeSessionId===sid).length+rc.filter(x=>x.nativeSessionId===sid).length;
   const ms=performance.now()-a;globalThis.__garde=[ev,rc];db.close();return {ms,f,lus:ev.length+rc.length};},session.id);
  const hPic=(await cdp.send('Runtime.getHeapUsage')).usedSize;await p.evaluate(()=>{delete globalThis.__garde;});
  const med=a=>r1(mediane(a));
  lignes.push({evenementsLot:total,exportManifestSwMs:med(sw1.m),exportAdviceSwMs:med(sw1.c),lectureDirectePanneauMs:r1(pan.ms),objetsLus:pan.lus,objetsGardes:pan.f,
   tasPanneauPendantLectureMo:r1((hPic-h0)/1048576)});
  process.stderr.write(`# export ${total} : ${JSON.stringify(lignes.at(-1))}\n`);}
 await p.close();
 await sw.evaluate(async()=>{const db=await store.open();await new Promise((res,rej)=>{const tx=db.transaction(['events','records'],'readwrite');
  for(const n of ['events','records'])tx.objectStore(n).delete(IDBKeyRange.bound('ch058-','ch058-\uffff'));tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});
  engine.s.native=globalThis.__ch058avant;delete globalThis.__ch058avant;await engine.save();});
 return {visitesSession:o.exportVisites,evenementsSession:o.exportVisites*30,lignes,
  note:'événements de lot synthétiques de 0,86 Ko ; le service worker (dataset) et le panneau (assembler) lisent TOUT IndexedDB puis filtrent la session'};}
async function memoirePanneau(ctx,sw,id,o){
 const p=await ctx.newPage();p.on('pageerror',e=>{});await p.goto(`chrome-extension://${id}/panel.html#native`);await dormir(1000);
 const cdp=await ctx.newCDPSession(p);await cdp.send('HeapProfiler.enable');
 const mesure=async()=>{await cdp.send('HeapProfiler.collectGarbage');const h=await cdp.send('Runtime.getHeapUsage');const d=await cdp.send('Memory.getDOMCounters');
  return {tasMo:r1(h.usedSize/1048576),noeuds:d.nodes,ecouteurs:d.jsEventListeners,documents:d.documents};};
 const croissance=[],constant=[];const pas=o.panneauPas;
 await sw.evaluate(()=>{globalThis.__ch058avant=engine.s.native;});
 /* a. La session grossit par paliers ; le panneau se rafraîchit seul (une vue par seconde). */
 for(let v=0;v<=o.panneauVisitesMax;v+=pas){const s=sessionEcho(Math.max(1,v),7);
  await sw.evaluate(s=>{engine.s.native=s;},s);await dormir(3000);croissance.push({visites:v,etatMo:r1(mo(s)*100)/100,...await mesure()});
  process.stderr.write(`# panneau ${v} visites : ${JSON.stringify(croissance.at(-1))}\n`);}
 /* b. État constant (la plus grande session), N secondes de rafraîchissements. */
 const t0=Date.now();while(Date.now()-t0<o.panneauS*1000){await dormir(Math.min(15000,o.panneauS*1000));constant.push({s:Math.round((Date.now()-t0)/1000),...await mesure()});
  process.stderr.write(`# panneau constant ${constant.at(-1).s} s : ${JSON.stringify(constant.at(-1))}\n`);}
 await sw.evaluate(async()=>{engine.s.native=globalThis.__ch058avant;delete globalThis.__ch058avant;await engine.save();});
 await p.close();return {croissance,constant,note:'tas JS mesuré APRÈS ramasse-miettes forcé (HeapProfiler.collectGarbage) : une croissance ici est une rétention, pas du brassage'};}

function args(argv){const o={tailles:[0.4,1,2,4],repetitions:15,panneauS:60,panneauPas:300,panneauVisitesMax:1500,sortie:null,export:[],exportVisites:1000,seulementExport:false};
 for(let i=0;i<argv.length;i++){const k=argv[i],v=argv[i+1];
  if(k==='--tailles'){o.tailles=v.split(',').map(Number);i++;}else if(k==='--repetitions'){o.repetitions=Number(v);i++;}
  else if(k==='--panneau-s'){o.panneauS=Number(v);i++;}else if(k==='--panneau-pas'){o.panneauPas=Number(v);i++;}
  else if(k==='--panneau-visites'){o.panneauVisitesMax=Number(v);i++;}
  else if(k==='--export'){o.export=v.split(',').map(Number);i++;}else if(k==='--export-visites'){o.exportVisites=Number(v);i++;}
  else if(k==='--seulement-export'){o.seulementExport=true;}else if(k==='--sortie'){o.sortie=v;i++;}
  else throw Error('Option inconnue : '+k);}return o;}
if(require.main===module){const o=args(process.argv.slice(2));
 banc(o).then(r=>{const t=JSON.stringify(r,null,1);if(o.sortie)fs.writeFileSync(o.sortie,t+'\n');else process.stdout.write(t+'\n');})
  .catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});}
module.exports={sessionEcho,visitesPour,mo,alea,uuid,args,banc,evenementLot};
