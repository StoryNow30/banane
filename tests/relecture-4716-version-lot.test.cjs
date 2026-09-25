'use strict';
/* Relecture 4.7.16, constat I1 : une décision `lot-decision-v1` ne consigne pas
 * ses règles ; le rejeu les déduisait de la version de l'EXPORT, qui peut être
 * postérieure au lot. 4.7.18 : la version qui crée le lot est figée dans son
 * scope (`extensionVersion`) et le rejeu la préfère. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),K=require('../src/core.js'),A=require('../tools/acceptance-report.cjs');
const {pilote}=require('./helpers/pilote-lot.cjs');
const {pilotCut,pilotLot}=require('./helpers/acceptance-lot.cjs');

test('I1 : le lot garde la version qui l\'a créé',async()=>{
  const r=await pilote(L,{start:100,end:100});const view=await r.b.settle();
  assert.equal(view.batch.scope.extensionVersion,K.VERSION);assert.equal(K.VERSION,'4.7.19');
});

test('I1 : le rejeu d\'un lot v1 prend la version de création, pas celle de l\'export',()=>{
  const v1={version:'lot-decision-v1',stage:'deferred',reason:'no-anchor',applied:false};
  const cuts=[pilotCut(23,700,{lotObservation:v1}),pilotCut(23,701,{outcome:'deferred',lotObservation:v1})];
  const lot=pilotLot(23,cuts),clouds=cuts.map(c=>({captureId:c.observation.lidar.captureId,identity:c.id,rails:c.before,pointsSceneRelative:[[0,0,0]],visibleByClipBoxes:[true]}));
  lot.diagnostic.version='4.7.16';lot.journal.state.batch.scope.extensionVersion='4.7.11';
  const seen=[],Ls={decideCut(args){seen.push(args.options);return v1;}};
  const r=A.report([{label:'v1',...lot,relecture:null,corpus:{clouds}}],{replay:true,replayDeps:{L:Ls,Shadow:{},maxAnchors:40}});
  assert.equal(r.lots[0].lotDecisionRules.pairGuard,false,'4.7.11 : pas de garde de paire, même exporté par une 4.7.16');
  assert.equal(r.lots[0].lotDecisionRules.source,'export');assert.ok(seen.every(o=>o.pairGuard===false));
  delete lot.journal.state.batch.scope.extensionVersion;
  const sans=A.report([{label:'v1',...lot,relecture:null,corpus:{clouds}}],{replay:true,replayDeps:{L:Ls,Shadow:{},maxAnchors:40}});
  assert.equal(sans.lots[0].lotDecisionRules.pairGuard,true,'sans version de création : celle de l\'export, comme avant (limite dite)');
});
