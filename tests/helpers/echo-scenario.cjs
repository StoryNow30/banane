'use strict';
/* RM-11 (test 9) — SCÉNARIO D'ÉCHO DÉTERMINISTE, pour prouver que l'Écho ne change pas.
 *
 * Horloge et identifiants figés : le même scénario, joué deux fois par le même code, rend le même texte. Il a servi à figer la RÉFÉRENCE
 * (`tests/echo-raison-reference.json`) avec le code de la test 8 (4.9.5.8) AVANT d'écrire la fonction ; l'essai `tests/echo-raison.test.cjs`
 * le rejoue avec le code de la test 9 et exige le même texte, octet pour octet, à la chaîne de version près.
 *
 * Le scénario ne tape aucune touche de raison (il tape pourtant des chiffres 7 et 8 et d'autres touches, que la fonction ne lit pas).
 * `racine` : la racine d'un arbre de l'extension (par défaut celui-ci), pour rejouer la référence sur un ancien arbre. */
const path=require('node:path'),crypto=require('node:crypto');
const jouer=async function jouer({racine=path.resolve(__dirname,'../..'),demarrage=undefined,frappes=null,prelude=true,envelopper=null,leger=false}={}){
 const RealDate=Date,RealUUID=crypto.randomUUID;let t=RealDate.parse('2026-10-19T09:00:00.000Z'),compteur=0;
 class DateFigee extends RealDate{constructor(...a){if(a.length)super(...a);else super(t);}static now(){return t;}}
 globalThis.Date=DateFigee;
 Object.defineProperty(globalThis.crypto,'randomUUID',{configurable:true,writable:true,value:()=>'00000000-0000-4000-8000-'+String(++compteur).padStart(12,'0')});
 try{
  const K=require(path.join(racine,'src/core.js')),{Sessions}=require(path.join(racine,'src/native-session.js')),{Engine}=require(path.join(racine,'src/engine.js')),
   {base,MemoryStore}=require(path.join(racine,'tests/fixtures.cjs'));
  const avancer=ms=>{t+=ms;};
  const store=new MemoryStore();store.all=async name=>name==='clouds'?[...store.clouds.values()]:store[name];store.keys=async()=>[...store.clouds.keys()];
  /* `leger` : sans les contours de profil (41 Ko par rail) pour les essais qui rejouent des milliers d'événements. */
  const rails=()=>{const r=K.clone(base.rails);if(leger)for(const side of Object.keys(r))delete r[side].profileContours;return r;};
  const st=(cut=100,part=23)=>({identity:{pageId:'page-a',part,cut,shape:'U50',frameId:'frame-page-a',projectId:null},rails:rails(),capturedAt:new RealDate(t).toISOString(),status:'complete',partialReasons:[],
   viewObservation:{status:'observed',viewEpochId:'v',observedAt:new RealDate(t).toISOString()},geominfo:{status:'not-observed',raw:null,source:null}});
  const appels=[],adapter={state:async()=>st(),nativeStart:async(a)=>{appels.push(['nativeStart',a]);return {active:true};},nativePause:async()=>({metrics:{}}),nativeResume:async(a)=>{appels.push(['nativeResume',a]);return {active:true};},nativeFinish:async()=>({metrics:{}})};
  const adaptateur=envelopper?envelopper(adapter):adapter;
  const engine=new Engine(adaptateur,store);await engine.init();const sessions=new Sessions(engine,adaptateur,store);await sessions.init();
  const ctx=()=>{const n=engine.s.native;return {sessionId:n.id,observationPeriodId:n.currentPeriodId};};
  const moved=(state,delta)=>({...K.clone(state),rails:K.expectedPoses(state,delta),capturedAt:new RealDate(t).toISOString()});
  const open=async(visitId,cut,part=23)=>{const state=st(cut,part);await sessions.receive('visit-started',{...ctx(),visitId,identity:state.identity,initialObserved:state});return state;};
  const observe=async(visitId,state)=>sessions.receive('state-observed',{...ctx(),visitId,identity:state.identity,state,trigger:'poll',effect:{kind:'rail-state-changed'}});
  const touche=async(visitId,state,event)=>sessions.receive('operator-event',{...ctx(),visitId,identity:state.identity,stateObservedBeforeInput:state,
   event:{type:'keydown',observedAt:new RealDate(t).toISOString(),code:null,key:null,shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,repeat:false,targetKind:'canvas',editable:false,intent:null,decisionKey:null,...event}});
  const fermer=async(visitId,state,next)=>sessions.receive('visit-ended',{...ctx(),visitId,identity:state.identity,finalObserved:state,reason:'target-changed',
   nextIdentity:next===null?null:{...state.identity,cut:next},endedAt:new RealDate(t).toISOString()});
  if(demarrage===undefined)await sessions.start();else await sessions.start(demarrage);
  if(prelude){
  /* visite 1 : une correction puis la validation (Maj+Espace) ; touches 7, 8 et d'autres, pas de raison. */
  let a=await open('v1',100);avancer(400);await touche('v1',a,{code:'KeyD',key:'character'});avancer(120);
  a=moved(a,{left:{delta:[0,.012,0]},right:{delta:[0,0,0]}});await observe('v1',a);avancer(300);
  await touche('v1',a,{code:'Digit7',key:'character'});avancer(50);await touche('v1',a,{type:'keyup',code:'Digit7',key:'character'});avancer(200);
  await touche('v1',a,{code:'Space',key:' ',shiftKey:true,intent:'VALIDATE',decisionKey:'Shift+Space'});avancer(80);await fermer('v1',a,101);
  /* visite 2 : validée telle quelle, une touche 8 ensuite. */
  let b=await open('v2',101);avancer(900);await touche('v2',b,{code:'Digit8',key:'character'});avancer(700);
  await touche('v2',b,{code:'Space',key:' ',shiftKey:true,intent:'VALIDATE',decisionKey:'Shift+Space'});avancer(60);await fermer('v2',b,102);
  /* visite 3 : sautée (Maj+Retour arrière). */
  const c=await open('v3',102);avancer(500);await touche('v3',c,{code:'Backspace',key:'Backspace',shiftKey:true,intent:'SKIP',decisionKey:'Shift+Backspace'});avancer(40);await fermer('v3',c,103);
  /* visite 4 : un saut de 40 cuts, validée en place, après une pause et une reprise. */
  await sessions.pause();avancer(5000);await sessions.resume();avancer(10);
  let d=await open('v4',143);avancer(600);d=moved(d,{left:{delta:[0,0,0]},right:{delta:[0,-.02,0]}});await observe('v4',d);avancer(250);
  await touche('v4',d,{code:'Enter',key:'Enter',ctrlKey:true,intent:'VALIDATE',decisionKey:'Ctrl+Enter'});avancer(30);await fermer('v4',d,null);
  }
  if(frappes)await frappes({sessions,engine,store,touche,open,observe,fermer,moved,avancer,st,K,appels,ctx,maintenant:()=>t});
  await sessions.end({dataset:false});
  const donnees=await sessions.dataset();
  return JSON.parse(JSON.stringify({records:store.records,events:store.events,native:engine.s.native,dataset:donnees}));
 }finally{globalThis.Date=RealDate;Object.defineProperty(globalThis.crypto,'randomUUID',{configurable:true,writable:true,value:RealUUID});}
};

/* Empreintes d'un résultat : SHA-256 du texte de chaque partie (l'ordre des clés compte : octet pour octet), la chaîne de version rendue à celle
 * de la référence. `visites` et `evenements` donnent une empreinte par élément, pour dire LAQUELLE a changé. */
jouer.empreintes=(res,versionDeReference,versionCourante)=>{
 const h=v=>crypto.createHash('sha256').update(JSON.stringify(v).split(versionCourante||versionDeReference).join(versionDeReference)).digest('hex');
 return {records:h(res.records),events:h(res.events),native:h(res.native),dataset:h(res.dataset),
  visites:res.records.map(r=>[r.visitId,h(r)]),evenements:res.events.map(e=>[e.type,h(e)])};};
module.exports=jouer;
