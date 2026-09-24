'use strict';
/* CHANTIER 5 — §14 D, contrat de placement : abstention motivée plutôt que
 * proposition devinée ; sortie rejouable à l'identique. Moteur GCV1 réel sur la
 * fixture du banc (~0,4 à 1,2 s par appel : la reprise depuis la voie, qui le
 * relance, n'est pas rejouée ici pour tenir le délai du banc ; sa sortie ne
 * dépend que de la science GCV1, rejouée à l'identique ci-dessous). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const L=require('../src/lot-decision.js'),Shadow=require('../src/gcv1-shadow.js');
const {K,base}=require('./fixtures.cjs'),{pair,positions}=require('./helpers/acceptance-lot.cjs');
const SIDES=['left','right'],ROOT=path.join(__dirname,'..');
const capture=(rails,cut=105)=>({identity:{part:23,cut,frameId:'f'},rails,pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)});
const science0=Shadow.scientificProposeBoth(capture(base.rails));
const ambigu={summary:{},rails:Object.fromEntries(SIDES.map(s=>[s,{ok:true,next:{status:'unresolved',motif:'ambiguity'}}]))};
const pairFlag={summary:{pairGaugeRejected:false},rails:Object.fromEntries(SIDES.map(s=>[s,{ok:true,
  next:{status:'candidate',delta:[0,.001,0],changed:s==='left'},conventionCalibration:{applied:s!=='right',reason:s==='right'?'shift-out-of-domain':null}}]))};
/* Choix par la voie sur une grille construite (moteur et calage factices, comme
 * `acceptance-decision-lot.test.cjs`) : la logique du choix, sans le coût du moteur. */
function choixFactice(){
  const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);
  for(const f of ['vendor/capture-core.js','src/gauge.js','src/continuity-observer.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
  const grid={left:[{u:0,z:0,loss:1}],right:[{u:.014,z:0,loss:1.1},{u:.05,z:0,loss:.5}]};
  ctx.BananeGeometry3={DEFAULTS:{alternativeSeparation:.02},propose(c,side,{lab}){lab.onCoarse(grid[side].map(x=>({...x})));return {};}};
  ctx.BananePlacementConvention={bandOffsets:()=>({ok:true,top:new Array(20),face:new Array(10)}),calibrate:()=>({applied:false})};
  vm.runInContext(fs.readFileSync(path.join(ROOT,'src/lot-decision.js'),'utf8'),ctx,{filename:'src/lot-decision.js'});
  const rail=next=>({ok:true,next,frame:{sign:1,uSeed:0}});
  const Sh={scientificProposeBoth:()=>({summary:{pairGaugeRejected:false},rails:{left:rail({status:'candidate',delta:[0,0,0]}),right:rail({status:'unresolved',motif:'ambiguity'})}})};
  const args={capture:{identity:{part:2,cut:105,frameId:'f'},rails:pair(105,{left:[60,0],right:[60,0]},[0,0,0],1500),pointsSceneRelative:[[0,0,0]],visibleByClipBoxes:[true]},
    science:ambigu,anchors:[103,104].map(cut=>({identity:{part:2,cut,frameId:'f'},positions:positions(pair(cut))})),Shadow:Sh};
  return {L:ctx.BananeLotDecision,args};
}

test('§14 D : même entrée, même sortie — science GCV1 et décision sur le lot rejouées à l\'identique',()=>{
  assert.equal(JSON.stringify(Shadow.scientificProposeBoth(capture(base.rails))),JSON.stringify(science0),'science GCV1');
  assert.equal(JSON.stringify(Shadow.toRuntimeRails(science0)),JSON.stringify(Shadow.toRuntimeRails(science0)),'rails runtime');
  const anchors=[{identity:{part:23,cut:104,frameId:'f'},positions:L.decideCut({capture:capture(base.rails,104),science:science0,anchors:[],Shadow}).positions}];
  const stages=[];
  for(const [nom,args] of [['premier passage',{capture:capture(base.rails),science:science0,anchors:[],Shadow}],
    ['premier passage gardé',{capture:capture(base.rails),science:science0,anchors,Shadow}],
    ['sans appui',{capture:capture(base.rails),science:ambigu,anchors:[],Shadow}],
    ['garde de paire',{capture:capture(base.rails),science:pairFlag,anchors:[],Shadow}]]){
    const a=L.decideCut(args),b=L.decideCut({...args,anchors:K.clone(args.anchors)});
    assert.equal(JSON.stringify(b),JSON.stringify(a),nom);stages.push(a.stage+(a.reason?':'+a.reason:''));}
  assert.deepEqual(stages,['first-pass','first-pass','deferred:no-anchor','deferred:pair-guard']);
  const {L:F,args}=choixFactice(),c1=F.decideCut(args),c2=F.decideCut({...args,anchors:K.clone(args.anchors)});
  assert.equal(c1.stage,'choice');assert.equal(JSON.stringify(c2),JSON.stringify(c1),'choix par la voie');
});

test('§14 D : une décision sans position porte toujours son motif ; un différé commandé, deux abstentions motivées',()=>{
  const decisions=[ambigu,pairFlag].map(science=>L.decideCut({capture:capture(base.rails),science,anchors:[],Shadow}));
  assert.deepEqual(decisions.map(d=>d.reason),['no-anchor','pair-guard']);
  for(const d of decisions){assert.equal(d.stage,'deferred');assert.equal(d.positions,undefined);assert.ok(!d.anchor);}
  /* Différé commandé : deux abstentions GCV1, chacune avec son motif lisible. */
  const out=L.commandRails({decision:decisions[1],runtimeRails:Shadow.toRuntimeRails(science0),before:base.rails});
  assert.equal(out.action,'defer');
  for(const s of SIDES){assert.equal(out.rails[s].status,'unresolved');assert.equal(out.rails[s].delta,null);assert.match(out.rails[s].reasons[0],/garde de paire/);
    assert.equal(out.rails[s].lotDecision.reason,'pair-guard');}
  /* Abstention du moteur : motif consigné, jamais une position devinée. */
  const vide=Shadow.scientificProposeBoth({...capture(base.rails),pointsSceneRelative:[],visibleByClipBoxes:[]}),runtime=Shadow.toRuntimeRails(vide);
  for(const s of SIDES){assert.equal(runtime[s].status,'unresolved');assert.equal(runtime[s].delta,null);assert.ok(runtime[s].reasons[0]);
    assert.equal(runtime[s].source,'geometry-candidate-v1-abstention');}
});
