'use strict';
/* CH-059 — état écrit en morceaux (`src/etat-morceaux.js`, `src/storage.js`) : relecture identique, retour arrière, session remplacée,
 * morceau manquant, écritures concurrentes. Faux `chrome.storage.local` en mémoire. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../src/etat-morceaux.js'),J=require('./helpers/journee-etat.cjs');
const visite=i=>({visitId:'v'+i,visitIndex:i,identity:{part:8,cut:100+i},relation:'first',startedAt:'t',endedAt:i%3?'t2':null,label:i%2?'VALIDATE':null});
const etat=(nVisites=150,nIds=1200)=>({schemaVersion:4,mode:'observation',events:[],records:[],
 native:{id:'session-a',status:'RUNNING',visits:Array.from({length:nVisites},(_,i)=>visite(i)),cloudIds:Array.from({length:nIds},(_,i)=>'c'+i),
  observationPeriods:[{observationPeriodId:'p1',startedAt:'t',status:'RUNNING'}],incomplete:['v3'],qualityRails:{'8/100/left':1,'8/100/right':0},
  exportState:{bytesStored:10,exportedCloudIds:Array.from({length:900},(_,i)=>'c'+i),releasedCloudIds:Array.from({length:800},(_,i)=>'c'+i),segments:3}},
 batch:{id:'lot-1',state:'COMPLETED',processed:Array.from({length:130},(_,i)=>({key:'k'+i,cut:i})),sequence:[],deferred:[{key:'d'}]}});

test('découpe puis recollage : l\'état est identique octet pour octet, l\'état vivant n\'est pas touché',()=>{
 const e=etat(),avant=JSON.stringify(e),{etat:ecrit,morceaux}=M.decouper(e);
 assert.equal(JSON.stringify(e),avant,'aucune modification de l\'état reçu');
 assert.deepEqual([ecrit.native.visits,ecrit.native.exportState.exportedCloudIds,ecrit.batch.processed],[[],[],[]],'listes écrites vides');
 assert.deepEqual(ecrit.native.cloudIds,e.native.cloudIds.slice(900),'parade du retour arrière : les nuages pas encore exportés restent aussi en ligne');
 assert.deepEqual(ecrit.native.qualityRails,{});assert.ok(JSON.stringify(ecrit).length<6000,'état écrit borné');
 const {etat:relu,manquants}=M.recoller(JSON.parse(JSON.stringify(ecrit)),morceaux);
 assert.deepEqual(manquants,[]);assert.equal(JSON.stringify(relu),avant);
});

test('magasin réel : seul un morceau changé est réécrit, dans le même set que l\'état',async()=>{
 const fc=J.fauxChrome(),s=J.magasin(fc),e=etat();await s.setState(e);const premier=fc.journal.at(-1);
 assert.ok(premier.cles.includes('banane3State')&&premier.cles.length>10,'tous les morceaux la première fois');
 await s.setState(e);assert.deepEqual(fc.journal.at(-1).cles,['banane3State'],'rien de changé : l\'état seul');
 e.native.visits.push(visite(150));e.native.cloudIds.push('c1200');e.native.visits[149].label='SKIP';await s.setState(e);
 assert.deepEqual(fc.journal.at(-1).cles.sort(),['banane3Morceau|native|cloudIds|session-a|2','banane3Morceau|native|visits|session-a|4','banane3State'].sort());
 const relu=await J.magasin(fc).getState();assert.deepEqual(relu,JSON.parse(JSON.stringify(e)));
});

test('retour arrière : une version antérieure lit des listes vides sans planter ; ses ajouts sont repris à la suite',async()=>{
 const fc=J.fauxChrome(),s=J.magasin(fc),e=etat(70,10);await s.setState(e);
 /* L'ancienne version lit `banane3State` tel quel, ajoute une visite et un nuage, et réécrit tout l'état (références comprises). */
 const ancien=JSON.parse(JSON.stringify(fc.disque.get('banane3State')));
 assert.equal(ancien.native.visits.length,0);
 ancien.native.visits.push(visite(70));ancien.native.cloudIds.push('c10');fc.disque.set('banane3State',ancien);
 const relu=await J.magasin(fc).getState();
 assert.deepEqual(relu.native.visits.map(v=>v.visitId),[...e.native.visits.map(v=>v.visitId),'v70']);
 assert.deepEqual(relu.native.cloudIds,[...e.native.cloudIds,'c10']);assert.ok(!('__morceaux' in relu.native));
});

test('session neuve (autre identifiant) : rien de l\'ancienne n\'est recollé ; ses morceaux restent jusqu\'au démarrage suivant, puis sont retirés',async()=>{
 for(const listeCles of [true,false]){const fc=J.fauxChrome();if(!listeCles)delete fc.chrome.storage.local.getKeys;
  const s=J.magasin(fc),e=etat(10,10);await s.setState(e);let retraits=0;const remove=fc.chrome.storage.local.remove;fc.chrome.storage.local.remove=async k=>{retraits++;return remove(k);};
  e.native={id:'session-b',status:'RUNNING',visits:[visite(0)],cloudIds:['z'],observationPeriods:[],incomplete:[],exportState:{exportedCloudIds:[],releasedCloudIds:[]}};
  await s.setState(e);assert.equal(retraits,0,'aucun retrait en cours de route');
  assert.ok([...fc.disque.keys()].some(k=>k.includes('session-a')),'encore là avant le redémarrage');
  const relu=await J.magasin(fc).getState();assert.deepEqual(relu.native.visits.map(v=>v.visitId),['v0']);assert.deepEqual(relu.native.cloudIds,['z']);
  assert.ok(![...fc.disque.keys()].some(k=>k.includes('session-a')),`retirés au démarrage (${listeCles?'clés listées':'index seul'})`);
  assert.equal(fc.disque.get('banane3MorceauxIndex').length,[...fc.disque.keys()].filter(k=>k.startsWith('banane3Morceau|')).length,'index à jour');}
 /* Retour arrière qui remplace la session : l'objet neuf ne porte pas de référence, rien n'est recollé. */
 const fc=J.fauxChrome(),s=J.magasin(fc);await s.setState(etat(10,10));fc.disque.get('banane3State').native={id:'session-c',visits:[],cloudIds:[]};
 assert.deepEqual((await J.magasin(fc).getState()).native.visits,[]);
});

test('arrêt du service worker entre deux écritures, ou écriture refusée : l\'état relu est exactement le dernier écrit, jamais un morceau absent ou périmé',async()=>{
 for(let arret=1;arret<=40;arret+=3){const fc=J.fauxChrome(),s=J.magasin(fc),e=etat(60,500);let ecrits=0,dernier=null;
  const set=fc.chrome.storage.local.set;fc.chrome.storage.local.set=async o=>{if(ecrits>=arret)throw Error('service worker arrêté');ecrits++;await set(o);};
  for(let k=0;k<45;k++){e.native.visits.push(visite(60+k));e.native.visits[k%60].label='L'+k;for(let j=0;j<6;j++)e.native.cloudIds.push(`n${k}-${j}`);
   if(k%7===0)e.batch={id:'lot-'+k,state:'RUNNING',processed:Array.from({length:70+k},(_,i)=>({key:'k'+i})),sequence:[],deferred:[]};
   const instantane=JSON.stringify(e);try{await s.setState(e);dernier=instantane;}catch{/* l'écriture n'a pas eu lieu */}}
  const relu=await J.magasin(fc).getState();
  assert.equal(relu.etatMorceauxManquants,undefined,`arrêt après ${arret} écritures : aucun morceau manquant`);
  assert.equal(JSON.stringify(relu),dernier,`arrêt après ${arret} écritures : l'état relu est le dernier écrit, morceaux compris`);}
});

test('morceau absent : signalé, jamais inventé ; le reste est relu',async()=>{
 const fc=J.fauxChrome(),s=J.magasin(fc);await s.setState(etat(150,10));fc.disque.delete('banane3Morceau|native|visits|session-a|1');
 const relu=await J.magasin(fc).getState();
 assert.equal(relu.native.visits.length,118);assert.deepEqual(relu.etatMorceauxManquants,[{chemin:'native.visits',morceau:1,raison:'morceau-absent'}]);
});

test('sauvegardes concurrentes : écrites dans l\'ordre d\'appel, la dernière l\'emporte ; l\'état vivant peut changer pendant l\'attente',async()=>{
 const fc=J.fauxChrome(),s=J.magasin(fc),e=etat(10,10);
 const p1=s.setState(e);e.native.visits.push(visite(10));const p2=s.setState(e);e.native.visits.push(visite(11));await Promise.all([p1,p2]);
 const relu=await J.magasin(fc).getState();assert.equal(relu.native.visits.length,11,'la seconde sauvegarde (11 visites), pas l\'état d\'après');
});

test('magasin sans module de découpe (contexte isolé) : écriture d\'avant, état entier',async()=>{
 const fc=J.fauxChrome(),s=J.magasin(fc);s.morceauxApi=()=>null;const e=etat(10,10);await s.setState(e);
 assert.deepEqual(fc.disque.get('banane3State'),JSON.parse(JSON.stringify(e)));
});

test('exportAdvice : même résultat que la recherche d\'avant, en temps linéaire (20 000 identifiants)',async()=>{
 const fc=J.fauxChrome(),a=await J.ouvrir(fc);await a.sessions.start();const n=a.engine.s.native,N=20000;
 n.cloudIds=Array.from({length:N},(_,i)=>`c${i}`);n.exportState={bytesStored:9e9,bytesPending:9e9,exportedCloudIds:n.cloudIds.filter((_,i)=>i%3),releasedCloudIds:[],segments:4,lastAdviceAt:null};
 const naif=n.cloudIds.filter(id=>!n.exportState.exportedCloudIds.includes(id)).length;
 const t0=process.hrtime.bigint(),r=a.sessions.exportAdvice(),ms=Number(process.hrtime.bigint()-t0)/1e6;
 assert.equal(r.pendingClouds,naif);assert.equal(r.due,true);
 assert.ok(ms<200,`exportAdvice : ${ms.toFixed(1)} ms pour ${N} identifiants (la recherche d'avant : ≈ ${N}² comparaisons)`);
 /* Ajouts suivis par l'ensemble, liste modifiée hors de lui (longueur différente) : toujours juste. */
 await a.sessions.ackExported(['c0','c3'],{confirmes:[],fichiers:1});n.exportState.bytesPending=9e9;n.exportState.exportedCloudIds.push('c6');
 assert.equal(a.sessions.exportAdvice().pendingClouds,naif-3);
});
