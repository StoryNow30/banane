'use strict';
/* P2 (cahier §15, KI-038) : écart entre la première pose humaine et sa repose à
 * l'aveugle, dans la même session. Un rail n'est retenu que s'il a été éloigné
 * (preuve dans les états observés) et si la repose passe la référence stricte. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../tools/p2-plancher.cjs'),O=require('../src/continuity-observer.js');
const {K,base}=require('./fixtures.cjs');
const SIDES=['left','right'],T0=Date.parse('2026-09-25T08:00:00.000Z'),at=ms=>new Date(T0+ms).toISOString();
function shifted(rails,lat,vert=0){return Object.fromEntries(SIDES.map(side=>{const r=rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+lat/1000,o[2]+vert/1000]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));}
const identity=cut=>({pageId:'p',part:34,cut,shape:'U50',frameId:'f',projectId:null});
/* Une visite : pose de départ = première pose humaine ; un état éloigné ; la repose validée. */
function visite(cut,i,{loin=60,repose=[2,-1],intents=1}={}){
  const id=identity(cut),debut=at(i*10000),final={identity:id,capturedAt:at(i*10000+5000),rails:shifted(base.rails,...repose)};
  const intent={intent:'VALIDATE',observedAt:at(i*10000+5200),eventSeq:i*100,stateObservedBeforeInput:final};
  const record={visitId:'v'+i,visitIndex:i,identity:id,beforeEstablished:{capturedAt:debut,identity:id,rails:K.clone(base.rails)},
    operatorIntents:Array.from({length:intents},()=>intent),multiIntent:intents>1,endedAt:at(i*10000+6000),
    humanFinalReference:{status:'candidate-observed',state:final,observedAt:intent.observedAt,eventSeq:i*100,association:{identityMatched:true,freshnessMs:200}}};
  const events=[{type:'native-state-observed',visitId:record.visitId,state:{identity:id,capturedAt:at(i*10000+2000),rails:shifted(base.rails,loin)}}];
  return {record,events};
}
test('P2 : écart de la repose à la première pose, rails éloignés seulement, référence stricte',()=>{
  const v=[visite(8451,1),visite(8452,2,{loin:12}),visite(8453,3,{intents:2}),visite(8454,4,{repose:[-3,0.5]})];
  const r=P.mesurer({records:v.map(x=>x.record),events:v.flatMap(x=>x.events)});
  assert.equal(r.cuts,2);assert.equal(r.rails,4);
  assert.deepEqual(r.rows.map(x=>[x.cut,x.side,x.lateralMm,x.verticalMm]),[[8451,'left',2,-1],[8451,'right',2,-1],[8454,'left',-3,0.5],[8454,'right',-3,0.5]]);
  assert.deepEqual(r.lateralMm,{count:4,median:2.5,p90:3,maximum:3});assert.deepEqual(r.verticalMm,{count:4,median:0.75,p90:1,maximum:1});
  assert.ok(r.exclus.some(x=>x.cut===8452&&/éloigné de 12 mm/.test(x.raison)),'retouche sans éloignement : écartée');
  assert.ok(r.exclus.some(x=>x.cut===8453&&x.raison==='multi-intent-reference-ambiguous'),'double intention : écartée');
  assert.match(P.toMarkdown(r),/Latéral \| 2,5|Latéral \| 2.5/);
});
test('P2 : le format est celui que lit le rapport d\'acceptation (--p2)',()=>{
  const A=require('../tools/acceptance-report.cjs');const v=[visite(8451,1)];
  const p2=P.mesurer({records:v.map(x=>x.record),events:v.flatMap(x=>x.events)});
  const md=A.toMarkdown(A.report([],{p2}));assert.match(md,/P2 \(un opérateur\) \(latéral 2 \/ 2, vertical 1 \/ 1 mm\)/);
});
