#!/usr/bin/env node
'use strict';
/* CH-059 — BANC DANS UN VRAI CHROMIUM : durée d'une sauvegarde de l'état, extension chargée (vrai service worker, vrai
 * chrome.storage.local, vrai `BananeStorage3` de l'arbre donné). État SYNTHÉTIQUE bâti sur la composition mesurée le 05/11 par
 * l'intégrateur (fin de journée : 1 152 visites Écho, 7 340 identifiants de nuages, listes d'export, périodes, lot) ; début de
 * journée : les mêmes champs avec 20 visites. Durée par cut = médiane × sauvegardes par cut mesurées par CH-058 (7,3 par visite
 * Écho, 8,3 par cut de lot). Entre deux sauvegardes : une visite et six nuages de plus, la dernière visite close.
 * Trois façons d'écrire : « avant » (copie entière puis `set`, comme le tronc), « morceaux » (copie entière puis
 * `store.setState` en morceaux : la branche sans le patch du moteur), « morceaux + patch » (état vivant passé au magasin).
 * Usage : CHROMIUM=/opt/pw-browsers/chromium node tools/ch059-banc-chromium.cjs [racine] [sauvegardes]. */
const path=require('node:path'),pw=require('playwright');
const racine=path.resolve(process.argv[2]||path.join(__dirname,'..')),N=+process.argv[3]||25;
(async()=>{
 const ctx=await pw.chromium.launchPersistentContext('',{executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',headless:true,
  args:['--headless=new',`--disable-extensions-except=${racine}`,`--load-extension=${racine}`]});
 try{let sw=null;for(let i=0;i<80&&!(sw=ctx.serviceWorkers()[0]);i++)await new Promise(r=>setTimeout(r,250));if(!sw)throw Error('service worker absent');
  for(let i=0;i<80;i++){if(await sw.evaluate(()=>typeof BananeStorage3==='function'&&typeof BananeCore3==='object'))break;await new Promise(r=>setTimeout(r,250));}
  const res=await sw.evaluate(async N=>{const K=BananeCore3,id=(p,i)=>`${p}-${String(i).padStart(6,'0')}-0000-4000-8000-000000000000`;
   const visite=i=>({visitId:id('v',i),visitIndex:i,identity:{pageId:'page',part:8+(i>>8),cut:i%256,shape:'U50',frameId:'frame',projectId:null},observationPeriodId:id('p',i>>3),
    relation:'first',startedAt:'2026-11-05T10:00:00.000Z',endedAt:'2026-11-05T10:00:05.000Z',label:'VALIDATE_CORRECTED_LEFT_ONLY',raison:null,complement:'r'.repeat(100)});
   const etat=nv=>{const nIds=Math.round(nv*7340/1152),nEx=Math.round(nIds*0.94);
    return {schemaVersion:4,version:K.VERSION,sessionId:id('s',0),mode:'observation',collection:'IDLE',records:[],incomplete:[],events:[],
     reglagesDivers:{blob:'x'.repeat(130000)},
     batch:{id:id('b',0),state:'COMPLETED',processed:Array.from({length:Math.min(600,nv*2)},(_,i)=>({key:id('k',i),identity:visite(i).identity,cut:i,evidence:{commandSent:true,ok:true,at:'2026-11-05T09:00:00.000Z',nav:{from:i,to:i+1}},validationAttemptId:id('a',i),pad:'y'.repeat(380)})),sequence:[],deferred:[]},
     native:{id:id('n',0),status:'RUNNING',visits:Array.from({length:nv},(_,i)=>visite(i)),cloudIds:Array.from({length:nIds},(_,i)=>id('c',i)+':left:0'),
      observationPeriods:Array.from({length:Math.max(1,Math.round(nv*0.45))},(_,i)=>({observationPeriodId:id('p',i),startedAt:'2026-11-05T10:00:00.000Z',endedAt:'2026-11-05T10:20:00.000Z',endTimeStatus:'observed',status:'ENDED'})),
      incomplete:[],metrics:{},exportState:{bytesStored:0,bytesPending:0,exportedCloudIds:Array.from({length:nEx},(_,i)=>id('c',i)+':left:0'),releasedCloudIds:Array.from({length:nEx},(_,i)=>id('c',i)+':left:0'),segments:9}}};};
   const pas=(s,k)=>{const n=s.native,v=visite(n.visits.length);v.endedAt=null;n.visits.at(-1).endedAt='2026-11-05T10:00:09.000Z';n.visits.push(v);
    for(let j=0;j<6;j++)n.cloudIds.push(id('c',100000+k*6+j)+':right:0');};
   const mediane=a=>{const b=a.slice().sort((x,y)=>x-y);return Math.round(b[b.length>>1]*100)/100;};
   const facons={avant:async s=>chrome.storage.local.set({banane3State:K.clone(s)}),morceaux:async s=>store.setState(K.clone(s)),'morceaux+patch':async s=>store.setState(s)};
   const out={};
   for(const [moment,nv] of [['debut',20],['fin',1152]])for(const [nom,f] of Object.entries(facons)){
    await chrome.storage.local.clear();store.connus=new Map();store.index=new Set();const s=etat(nv);const taille=JSON.stringify(s).length;await f(s);const t=[];
    for(let k=0;k<N;k++){pas(s,k);const t0=performance.now();await f(s);t.push(performance.now()-t0);}
    const ecrit=JSON.stringify((await chrome.storage.local.get('banane3State')).banane3State).length;
    const mo=x=>Math.round(JSON.stringify(x).length/1e4)/100;
    out[`${moment} / ${nom}`]={etatMemoireMo:Math.round(taille/1e4)/100,composition:{native:mo(s.native),visits:mo(s.native.visits),cloudIds:mo(s.native.cloudIds),
     exportState:mo(s.native.exportState),observationPeriods:mo(s.native.observationPeriods),batch:mo(s.batch)},etatEcritKo:Math.round(ecrit/100)/10,
     morceauxEcritsKo:nom==='avant'?null:Math.round((store.derniereEcriture?.octetsMorceaux||0)/100)/10,medianeMs:mediane(t),maxMs:Math.round(Math.max(...t)*100)/100,
     /* Sauvegardes par cut mesurées par CH-058 dans les journaux : 7,3 par visite Écho, 8,3 par cut de lot. */
     parCutEchoMs:Math.round(mediane(t)*7.3),parCutLotMs:Math.round(mediane(t)*8.3)};}
   return out;},N);
  console.log(JSON.stringify({chromium:ctx.browser()?.version()??null,sauvegardes:N,mesures:res},null,1));
 }finally{await ctx.close();}})().catch(e=>{console.error(e);process.exit(1);});
