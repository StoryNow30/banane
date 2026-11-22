#!/usr/bin/env node
'use strict';
/* CH-070 : banc de TEMPS d'ariane-session dans Chromium (/opt/pw-browsers/chromium), machine au repos, rien d'autre en
 * parallèle. Pour chaque fonction portée : jusqu'à 50 entrées RÉELLES de banane-data (exports Écho et bilans du 04 au
 * 06/11), 15 répétitions ; une répétition = un appel par entrée (copies préparées hors chronométrage pour les
 * fonctions qui modifient leur entrée) ; temps par appel = durée de la répétition / nombre d'entrées. Côté WASM :
 * par la façade, traversée JS ↔ WASM (VBA) comprise. Sortie : médiane et P90 par appel, JS et WASM, rapport WASM/JS.
 *   CH070_TRAVAIL=… node --max-old-space-size=8000 tools/ch070-banc-temps.cjs [--json SORTIE] [--rep 15] */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const C=require('./ch064-corpus.cjs'),X=require('../src/native-export.js'),P=require('../src/part-summary-49.js'),K=require('../src/core.js'),NS=require('../src/native-session.js');
const LM=require('../src/liste-memoire.js'),{construire}=require('./ch070-construire.cjs');
const RACINE=path.resolve(__dirname,'..'),a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null,REP=Number(arg('--rep')||15),MAX=50;
const lire=(z,e)=>JSON.parse(execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1,encoding:'utf8'}));
function premier(motif){for(const z of C.zips())for(const e of C.entrees(z))if(motif.test(e))return lire(z,e);return null;}
const echo=X.expand(premier(/ariane-echo-.*seg01/)),bilan=premier(/bilan-v4.*seg01/),liste=premier(/ariane-liste-partie13/);
const recs=echo.records.slice(0,MAX),nat=echo.session,x=P.fromJournal(bilan),proj=x.events.map(P.projectEvent).filter(Boolean);
const ev=echo.events.filter(e=>/capture-ready|capture-checkpoint|operator-gesture/.test(e.type)).slice(0,MAX).map(e=>[e.type.replace(/^native-/,''),e]);
const clouds=(echo.clouds||[]).slice(0,MAX).map(c=>({...c,pointsSceneRelative:undefined}));
const d=()=>[0.003,-0.002,0.0005];
/* Entrées par fonction : [module, fonction, liste d'arguments, mutante] */
const CAS=[
 ['resume','summarize',[[{...x,events:proj,historyStatus:'available'}]],false],
 ['resume','projectEvent',x.events.slice(0,MAX).map(e=>[e]),false],
 ['historique','historique',[[{departs:bilan.fichesDepart,fins:bilan.finsLot,courant:bilan.state.batch,version:bilan.version}]],false],
 ['historique','ficheFin',[[{...bilan.state.batch,state:'COMPLETED'},{version:'5',at:bilan.exportedAt}]],false],
 ['historique','ajouterFin',(bilan.finsLot||[]).slice(0,MAX).map(f=>[bilan.finsLot,{...f,motif:'x'}]),false],
 ['session','classify',recs.map(r=>[r]),true],
 ['session','chooseGeometry',recs.map(r=>[r,'left']),false],
 ['session','referenceFromWrite',recs.filter(r=>(r.serverWrites||[]).some(w=>w?.body)).map(r=>{const w=r.serverWrites.find(w=>w?.body);return [r,{...w,eventId:'e',at:w.at,status:200,rowIndex:0},Date.parse(r.humanFinalReference?.observedAt||'')+5];}),true],
 ['session','health',[[]],false],
 ['session','exportAdvice',[[]],false],
 ['session','mergeMetrics',[[nat.metrics]],true],
 ['session','accountQuality',clouds.map(c=>[{},c]),true],
 ['session','redactedEvent',ev,false],
 ['session','visitRelation',recs.map((r,i)=>[{id:nat.id,visits:nat.visits.slice(0,i)},r.identity,r.observationPeriodId,null]),false],
 ['session','poseEqual',recs.filter(r=>r.beforeEstablished?.rails?.left&&r.humanFinalReference?.state?.rails?.left).map(r=>[r.beforeEstablished.rails.left,r.humanFinalReference.state.rails.left]),false],
 ['session','referenceParEcriture',recs.filter(r=>(r.serverWrites||[]).some(w=>w?.body)&&r.humanFinalReference?.state).map(r=>[r.humanFinalReference.state,r.lastObserved,r.serverWrites.find(w=>w?.body).body]),false],
 ['noyau','expectedPoses',recs.filter(r=>r.beforeEstablished?.rails).map(r=>[r.beforeEstablished,{left:{delta:d()},right:{delta:d()}}]),false],
 ['reconstruction','reconstruireCut',recs.map(r=>[r]),false],
 ['observateur','voisins',null,false]];
const methodes=new Set(['classify','chooseGeometry','referenceFromWrite','health','exportAdvice','mergeMetrics','accountQuality','redactedEvent','visitRelation']);
(async()=>{
 const w=construire(),{chromium}=require('playwright'),b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
 const p=await b.newPage();await p.route('http://localhost/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>banc</title>'}));await p.goto('http://localhost/banc');
 for(const s of ['vendor/capture-core.js','vendor/lidar.js','src/core.js','src/settings.js','src/raison-correction.js','src/continuity-observer.js','src/native-session.js','src/native-lidar.js',
  'src/native-reconstruction.js','src/part-summary-49.js','src/historique-parties.js','src/liste-memoire.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-session.js'])
  await p.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
 await p.addScriptTag({content:'(function(){const module={exports:{}};'+fs.readFileSync(path.join(RACINE,'src/esv-observer.js'),'utf8')+'\n;window.BananeEsvObserver=module.exports;})();'});
 const ua=await p.evaluate(b64=>{const o=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),coeur=ArianeCoeur.creer(o),NS=BananeNativeSession4;
  const F=ArianeFacadeSession,S=F.session(coeur,NS,BananeSettings,BananeCore3);
  window.__b={coeur,M:{resume:{js:ArianePartSummary49,rs:F.resume(coeur,ArianePartSummary49)},historique:{js:BananeHistoriqueParties,rs:F.historique(coeur,BananeHistoriqueParties)},
   session:{js:{...NS,methodes:NS.Sessions.prototype},rs:{...S}},noyau:{js:BananeCore3,rs:F.noyau(coeur,BananeCore3)},reconstruction:{js:BananeNativeReconstruction,rs:F.reconstruction(coeur,BananeNativeReconstruction)},
   observateur:{js:BananeEsvObserver,rs:F.observateur(coeur,BananeEsvObserver)}}};
  return navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0];},fs.readFileSync(w).toString('base64'));
 const resultats=[];
 for(const [mod,f,args0,mutante] of CAS){
  let args=args0;
  if(f==='voisins'){args=null;}
  if(args&&!args.length){resultats.push({fonction:f,entrees:0});continue;}
  const r=await p.evaluate(async ([mod,f,args,mutante,REP,liste,nat,methode])=>{
   const B=window.__b,M=B.M[mod],q=(v,x)=>{const s=v.slice().sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(x*s.length))];};
   let appels;
   if(f==='voisins'){const E=BananeEsvObserver,dd=BananeListeMemoire.decompacter(liste),t=E.newTable(true),rows=[],N=['valid','invalid','skipped','autre'],ED=['XLeftEdge','YLeftEdge','ZLeftEdge','XRightEdge','YRightEdge','ZRightEdge'];
    for(let i=0;i<dd.n;i++){const o={RowKey:'r'+i,ExtractionStatus:N[dd.st[i]]};ED.forEach((k,j)=>{const v=dd.ed[6*i+j];if(v!==null)o[k]=v/1e4;});rows.push(o);}E.addRows(t,rows);
    const T=new Map([['T',t]]);args=[];for(let k=0;k<50;k++){const i=(k*197)%t.rk.length,o=6*i;args.push([T,{cut:i,fenetre:5,world:{left:[t.ed[o],t.ed[o+1],t.ed[o+2]],right:[t.ed[o+3],t.ed[o+4],t.ed[o+5]]}}]);}}
   const ceci=()=>{const s=Object.create(BananeNativeSession4.Sessions.prototype);s.e={s:{native:structuredClone(nat)}};return s;};
   function lot(cote){
    const fn=methode?(cote==='js'?BananeNativeSession4.Sessions.prototype[f]:M.rs.methodes[f]):M[cote][f];
    const copies=mutante?args.map(x=>structuredClone(x)):args,ici=methode?args.map(()=>ceci()):null;
    const t0=performance.now();for(let i=0;i<copies.length;i++)fn.apply(methode?ici[i]:M[cote],copies[i]);return (performance.now()-t0)/copies.length;}
   const ms={js:[],rs:[]};for(let k=0;k<3;k++){lot('js');lot('rs');}
   for(let k=0;k<REP;k++){ms.js.push(lot('js'));ms.rs.push(lot('rs'));}
   const c=M.rs.compteurs?M.rs.compteurs():null;
   return {entrees:args.length,jsMediane:q(ms.js,.5),jsP90:q(ms.js,.9),wasmMediane:q(ms.rs,.5),wasmP90:q(ms.rs,.9),servis:c?{coeur:c.coeur,replis:c.repliHorsDomaine+c.repliFormat}:null,memoireCoeur:B.coeur.etat()};
  },[mod,f,args,mutante,REP,f==='voisins'?liste:null,nat,methodes.has(f)]);
  r.fonction=f;r.rapport=r.wasmMediane/r.jsMediane;resultats.push(r);console.error(f,JSON.stringify(r));}
 await b.close();
 const out={format:'ch070-banc-temps-v1',navigateur:ua,repetitions:REP,resultats};
 if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify(out,null,1)+'\n');console.log(JSON.stringify(out,null,1));
})().catch(e=>{console.error(e);process.exit(1);});
