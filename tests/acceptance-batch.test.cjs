'use strict';
/* Lot sans journal (partie 9, 4.7.18) : le diagnostic couvre plusieurs lots ;
 * `--batch` ne garde que les observations du lot désigné. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../tools/acceptance-report.cjs');
const obs=(batchId,part,cut,t)=>({batchId,identity:{part,cut,frameId:'f'},timestamp:`2026-09-25T08:00:${String(t).padStart(2,'0')}Z`,observationEventId:'e'+t});
const diagnostic={observations:[obs('b9',9,100,1),obs('b3',3,50,2),obs('b9',9,101,3),obs('b2',2,7,4)]};
test('--batch : seules les observations du lot désigné ; les autres sont comptées à part',()=>{
  const all=A.lotCuts(diagnostic,null);assert.equal(all.cuts.length,4);assert.equal(all.observationsOutsideLot,0);
  const p9=A.lotCuts(diagnostic,null,'b9');assert.deepEqual(p9.cuts.map(c=>c.cut),[100,101]);assert.equal(p9.observationsOutsideLot,2);
  const journal={state:{batch:{id:'b3',processed:[]}}};
  assert.deepEqual(A.lotCuts(diagnostic,journal,'b9').cuts.map(c=>c.cut),[50],'le journal prime sur --batch');
});
test('lot complet : terminé, ou arrêté à sa borne (4.7.19 et suivantes) ; arrêté par l\'opérateur : incomplet',()=>{
  assert.equal(A.lotComplete({state:'COMPLETED'}),true);assert.equal(A.lotComplete({state:'FINISHED_WITH_UNCONFIRMED_ACTIONS'}),true);
  assert.equal(A.lotComplete({state:'STOPPED',stoppedAtEnd:{cut:8144,applied:false}}),true,'partie 12, 4.7.20 : arrêté sur son dernier cut');
  assert.equal(A.lotComplete({state:'STOPPED'}),false);assert.equal(A.lotComplete({state:'RUNNING'}),false);assert.equal(A.lotComplete(null),null);
});
