'use strict';
/* RELECTURE INDÉPENDANTE 4.7.12 (audit/chantiers/relecture-478.md, constat B1),
 * de bout en bout : service worker, `commandLot`, `Engine.apply()`.
 * Décision de banc : premier passage retiré par la garde de continuité
 * (guardDeferred, 156 mm), reprise depuis la voie aboutie à 25 cm de la pose
 * ESV, donc hors de la vue de ±0,2 (KI-051). Attendu : le cut est différé, la
 * proposition du moteur n'est pas appliquée. Corrigé en 4.7.14 (KI-053). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const Shadow=require('../src/gcv1-shadow.js'),L=require('../src/lot-decision.js'),K=require('../src/core.js'),{base}=require('./fixtures.cjs');
const {withCameras}=require('./helpers/navigateur.cjs'),{background,gcv1Shadow}=require('./helpers/fond-relecture.cjs');
const SIDES=['left','right'];
/* Paire admissible (1 428 mm sur la fixture, comme `background.test.cjs`), puis
 * translatée de 0,25 le long de l'axe des rails : hors de la vue de chaque rail. */
function farTarget(rails){
  const inner=Object.fromEntries(SIDES.map(s=>{const P=rails[s].profileLocalToSceneRelative,w=K.C.point(P,[0,s==='left'?-.036:.036,.001]),o=K.C.point(P,[0,0,0]);
    return [s,rails[s].positionSceneRelative.map((v,i)=>v+w[i]-o[i])];}));
  const u=inner.right.map((v,i)=>v-inner.left[i]),n=Math.hypot(...u);
  return Object.fromEntries(SIDES.map(s=>[s,inner[s].map((v,i)=>v+u[i]/n*.25)]));
}
test('garde de continuité puis cible hors de la vue : le Pilote ne doit pas appliquer la proposition retirée',async()=>{
  const science=Shadow.scientificProposeBoth(base);
  const fake={...L,decideCut:({capture})=>({version:'lot-decision-v1',stage:'window',guardMm:156.2,guardDeferred:true,fromPredictionMm:3,
    anchorsUsed:[99,98],positions:farTarget(capture.rails),anchor:true})};
  const b=background({shadow:gcv1Shadow(science),globals:{BananeLotDecision:fake,BananeSettings:require('../src/settings.js'),BananeCore3:K}});
  const capture=b.adapter.capture.bind(b.adapter);b.adapter.capture=async(...a)=>withCameras(await capture(...a));
  const applied=[],apply=b.adapter.apply.bind(b.adapter);
  b.adapter.apply=async(before,proposals)=>{applied.push(K.clone(proposals));return apply(before,proposals);};
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  await b.api('start',{part:23,start:100,end:100,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',
    geometryEngine:'geometry-candidate-v1',unresolvedPolicy:'defer',lotDecision:'apply'});
  await b.settle();
  const observed=b.store.events.filter(e=>e.type==='gcv1-shadow-observed').map(e=>e.lotObservation);
  assert.ok(observed.length>=1&&observed.every(o=>o.guardDeferred===true),'la décision retire le premier passage');
  assert.equal(applied.length,0,`commande ${JSON.stringify(observed.map(o=>o.command))} ; appliqué : ${applied.map(p=>SIDES.map(s=>p[s].source).join('+')).join(' ; ')}`);
});
