'use strict';
/* CH-097, défaut 2 — ÉCHO : au réveil du service worker, `init` recalcule le prochain numéro d'événement de la séance en cours. Avant : par
 * `Math.max(...events)`, un argument par événement ; au-delà de la limite d'arguments du moteur JavaScript (sous Node : entre 120 000 et 130 000),
 * `init` rejetait, donc `ready`, donc TOUTE action, à chaque réveil. Seuil du navigateur non mesuré ; aucune séance de cette taille vue (SUPPOSÉ).
 * Module réel, magasin fabriqué. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Sessions}=require('../src/native-session.js');
function seance(events,nextEventSeq){const n={id:'N1',status:'RUNNING',nextEventSeq,visits:[],observationPeriods:[],incomplete:[]};
 const engine={s:{native:n},save:async()=>{}},store={lireEvenementsNatif:async()=>events,all:async()=>events,putEvent:async()=>{}};
 return {n,s:new Sessions(engine,{},store)};}
const evts=N=>Array.from({length:N},(_,i)=>({nativeSessionId:'N1',eventSeq:i+1}));

test('200 000 événements : init ne rejette pas et reprend au plus grand numéro',async()=>{
 const {n,s}=seance(evts(200000),0);
 await assert.doesNotReject(s.init());
 assert.equal(n.nextEventSeq,200001,'200 000 relus, plus l’événement de reprise que init écrit lui-même');assert.equal(n.status,'PAUSED');});

test('même résultat qu’avant sur une petite séance : le plus grand de l’état gardé et des événements (eventSeq ou event_seq), plus l’événement de reprise',async()=>{
 for(const [events,garde,attendu] of [[[{nativeSessionId:'N1',eventSeq:3},{nativeSessionId:'N1',event_seq:7},{nativeSessionId:'N1'},{nativeSessionId:'AUTRE',eventSeq:99}],5,8],
   [[{nativeSessionId:'N1',eventSeq:3}],12,13],[[],undefined,1]]){
  const {n,s}=seance(events,garde);await s.init();
  assert.equal(n.nextEventSeq,attendu);}});
