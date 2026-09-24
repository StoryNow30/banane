'use strict';
/* Relevé de la décision sur le lot dans des lots exportés (relecture 4.7.12) :
 * lecture seule, un cut retiré par une garde est rapporté avec sa commande. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {scanLot}=require('../tools/lot-command-scan.cjs');
test('cut retiré par la garde puis rendu au moteur : rapporté avec sa commande et ce que le Pilote a fait',()=>{
  const obs=(cut,t,lotObservation,runtime={})=>({identity:{part:1,cut},timestamp:t,observationEventId:'e'+cut,lotObservation,runtime});
  const r=scanLot({label:'t',journal:null,corpus:null,diagnostic:{version:'4.7.12',observations:[
    obs(10,'1',{stage:'window',guardDeferred:true,guardMm:40,anchorsUsed:[8,9],engineMs:300,command:{action:'engine',reason:'hors-vue-left'}},{apply:{}}),
    obs(11,'2',{stage:'first-pass',anchorsUsed:[],engineMs:0,command:{action:'engine',reason:'first-pass'}})]}});
  assert.deepEqual(r.stages,{window:1,'first-pass':1});
  assert.deepEqual(r.guarded,[{cut:10,stage:'window',guardMm:40,pairGuarded:false,command:'engine/hors-vue-left',runtimeApplied:true,deferral:null}]);
  assert.equal(r.decisionMs.relaunched.n,1);assert.equal(r.decisionMs.relaunched.max,300);assert.equal(r.decisionMs.direct.n,1);
  assert.equal(r.ricochet,undefined,'rejeu seulement sur demande');
});
