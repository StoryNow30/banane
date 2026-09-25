'use strict';
/* 4.7.19 — reprise des différés : un lot « Reprise » part des cuts POSÉS et
 * validés par le lot précédent autour de ses différés ; rien d'autre (§14 I). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js');
const {pilote}=require('./helpers/pilote-lot.cjs');

test('service worker : le lot de reprise part des cuts posés autour du différé, consignés pour le rejeu',async()=>{
  const seen=[];
  const spy={...L,decideCut(args){const cut=args.capture.identity.cut;seen.push({cut,anchors:Array.from(args.anchors,a=>a.identity.cut)});
    /* 101 : paire retirée par une garde, différée (aucune position commandable). */
    if(cut===101&&seen.filter(s=>s.cut===101).length===1)return {version:L.DEFAULTS.version,stage:'deferred',reason:'guard',guardDeferred:true,guardMm:40,anchorsUsed:[100]};
    return L.decideCut(args);}};
  const r=await pilote(spy,{start:100,end:103});let view=await r.b.settle();
  assert.equal(view.batch.state,'STOPPED','arrêt au dernier cut (103), posé sans validation');assert.deepEqual(view.batch.deferred.map(d=>d.identity.cut),[101]);
  assert.equal(view.batch.lotPosed,undefined,'le panneau ne reçoit que le nombre');assert.equal(view.batch.lotPosedCount,2,'100 et 102 posés et validés ; 103, dernier, non validé');
  /* Reprise : ESV rouvert sur le différé. */
  r.b.adapter.identity.cut=101;
  await r.b.api('start',{part:23,start:101,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',
    geometryEngine:'geometry-candidate-v1',unresolvedPolicy:'defer',lotDecision:'apply',lotReprise:true});
  view=await r.b.settle();
  const scope=view.batch.scope.lotReprise;
  assert.deepEqual(scope.anchors.map(a=>a.identity.cut),[100,102],'103, non validé, n\'est pas appui');assert.equal(scope.deferredCuts,1);
  const second=seen.at(-1);assert.equal(second.cut,101);assert.deepEqual(second.anchors,[100,102],'encadré : appuis des deux côtés');
  const obs=r.observed().at(-1);assert.deepEqual(obs.reprise.anchors.map(a=>a.identity.cut),[100,102],'appuis de départ consignés');
  assert.deepEqual(obs.framedAnchors,[100,102],'voie encadrée');
});

