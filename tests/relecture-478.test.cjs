'use strict';
/* Contre-exemples : assertions décrivant les défauts de la version relue,
 * sans modification de production. Doubles géométriques pour isoler les
 * décisions de seuil et de comptage, pas pour établir des résultats terrain. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const O=require('../src/continuity-observer.js'),Lab=require('../tools/placement-lab.cjs');
const Study=require('../tools/lot-choice-study.cjs'),{matrix}=require('../tools/cut-matrix.cjs');
const L=require('../src/lot-decision.js'),Candidate=require('../src/geometry-candidate-v1.js'),Convention=require('../src/placement-convention.js');
const {base}=require('./fixtures.cjs'),C=require('../vendor/capture-core.js'),sides=['left','right'];
test('D-038 : une visite sans pose initiale disparaît du dénominateur',()=>{
 const session={records:[{visitIndex:0,visitId:'v0',identity:{part:1,cut:1},visitRelation:{type:'first-observation'}}],clouds:[]};
 assert.equal(Study.studySession(session,'sans-pose').summary.cuts,0);assert.equal(matrix(session,'sans-pose').summary.distinctCuts,1);
 console.log('sans pose : étude = 0 cut ; matrice = 1 cut');
});
test('D-038 : 10,04 mm devient juste dans étude et matrice',t=>{
 const record={visitId:'v',visitIndex:0,identity:{part:23,cut:101},visitRelation:{type:'first-observation'},beforeEstablished:{rails:base.rails}},session={records:[record],clouds:[]};
 t.mock.method(O,'gatherInput',()=>({points:[[0,0,0]],visible:[true],contours:{left:[],right:[]},chunkIds:[],duplicatesRemoved:0}));
 t.mock.method(O,'startRails',()=>({rails:base.rails}));
 t.mock.method(O,'proposeFrom',()=>({applicable:true,rails:Object.fromEntries(sides.map(s=>[s,{positionSceneRelative:base.rails[s].positionSceneRelative}]))}));
 t.mock.method(Lab,'referenceFor',(r,s)=>{const rail=base.rails[s],M=rail.profileLocalToSceneRelative,a=C.point(M,[0,0,0]),b=C.point(M,[0,.01004,0]);return {status:'candidate',finalRail:{positionSceneRelative:rail.positionSceneRelative.map((x,i)=>x+b[i]-a[i])}};});
 const study=Study.studySession(session,'seuil'),m=matrix(session,'seuil');
 assert.equal(study.rows[0].worstMm,10);assert.equal(study.summary.lot.wrong,0);assert.equal(m.rows[0].outcome,'applied-right');
 console.log('10,04 mm > 10 ; étude faux = 0 ; matrice = applied-right');
});
test('25e minimum : étude accepte, embarqué refuse',t=>{
 const grid=Array.from({length:24},(_,i)=>({u:.1+i*.03,z:0,loss:i+1}));grid.push({u:0,z:0,loss:25});
 t.mock.method(Candidate,'propose',(cap,side,opt)=>{opt.lab.onCoarse(grid);return {};});
 t.mock.method(Convention,'bandOffsets',()=>({ok:true,top:Array(15).fill(0),face:Array(3).fill(0)}));
 t.mock.method(Convention,'calibrate',()=>({applied:false}));
 const science={rails:{left:{ok:true,frame:{sign:1,uSeed:0}}}},s=Study.chooseRail(base,'left',science,15),r=L.chooseRail(base,'left',science);
 assert.equal(s.ok,true);assert.equal(s.rankByLoss,24);assert.equal(r.ok,false);
 console.log('étude ok=true rang=24 ; embarqué '+r.reason);
});
test('garde seulement latérale : +50 mm vertical devient ancre',()=>{
 const identity={part:23,cut:105,frameId:'f'},anchor={identity:{...identity,cut:104},positions:Object.fromEntries(sides.map(s=>[s,base.rails[s].positionSceneRelative]))};
 const science={summary:{pairGaugeRejected:false},rails:Object.fromEntries(sides.map(s=>[s,{ok:true,next:{status:'candidate',delta:[0,0,.05]}}]))};
 const d=L.decideCut({capture:{identity,rails:base.rails},science,anchors:[anchor],Shadow:{}});
 assert.equal(d.stage,'first-pass');assert.equal(d.guardMm,0);assert.equal(d.anchor,true);
 console.log('vertical 50 mm ; garde = 0 ; first-pass ; anchor = true');
});
test('deux observations du même cut occupent les deux places d’ancre',()=>{
 const identity={part:23,cut:105,frameId:'f'},a={identity:{...identity,cut:104}},b={identity:{...identity,cut:103}};
 assert.deepEqual(L.neighbours(identity,[a,a,b]).map(x=>x.identity.cut),[104,104]);console.log('ancres 104,104,103 : sélection 104,104');
});
