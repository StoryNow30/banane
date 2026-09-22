'use strict';
/* 4.8 — l'entrée moteur est la lecture complète de la pose de départ.
 *
 * L'instantané qualifié reste la preuve ; la suite de la même lecture est
 * ajoutée tant qu'elle garde la pose et s'achève avant toute action humaine. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const K=require('../src/core.js'),Lab=require('../tools/placement-lab.cjs'),Legacy=require('../tools/native-offline-evaluate.cjs');
const {base}=require('./fixtures.cjs');
const identity={pageId:'page',part:1,cut:7,shape:'U50',frameId:'frame',projectId:null};
const t=s=>`2026-09-13T19:00:${s}Z`,intentAt=t('04.000');
const coord={name:'scene-relative',frameId:'frame',units:'metres-observed-not-independently-calibrated',physicalCalibrationStatus:'not-independently-verified'};

function fixture(){
  const clouds=new Map(),railSnapshots={left:[],right:[]};
  for(const side of ['left','right']){
    const rail=K.clone(base.rails[side]);
    const points=base.pointsSceneRelative.filter(p=>{const q=K.C.point(rail.sceneRelativeToProfileLocal,p);return Math.abs(q[0])<=.5&&Math.abs(q[1])<=.4&&Math.abs(q[2])<=.3;});
    const half=Math.floor(points.length/2),quarter=Math.floor(points.length/4);
    const chunk=(id,pts,endedAt,extra={})=>clouds.set(id,{format:'banane-native-lidar-chunk-v1',chunkId:id,captureId:id.split(':')[0],side,identity,coordinateSystem:coord,
      rail:extra.rail||rail,acquisition:{startedAt:t('00.500'),endedAt},...(extra.qualification?{qualification:extra.qualification}:{}),
      pointsSceneRelative:pts,visibleByClipBoxes:pts.map(()=>true)});
    const snapId=`cap:${side}:0`;
    chunk(snapId,points.slice(0,half),t('01.000'),{qualification:{status:'qualified-candidate',chunkIds:[snapId],coordinateSystem:coord,transform:{valid:true},associationStatus:'same-target-and-rail-pose'}});
    chunk(`cap:${side}:1`,points.slice(half,half+quarter),t('02.000'));                     // même lecture, avant toute action : retenu
    chunk(`cap:${side}:2`,points.slice(half+quarter),t('04.500'));                          // après l'intention : exclu
    chunk(`autre:${side}:1`,points.slice(half),t('02.000'));                                 // autre lecture : exclu
    const moved=K.expectedPoses({rails:base.rails},{left:{delta:[0,.01,0]},right:{delta:[0,.01,0]}})[side];
    chunk(`cap:${side}:3`,points.slice(half),t('02.500'),{rail:moved});                      // autre pose : exclu
    railSnapshots[side].push({snapshotId:snapId,side,identity,coordinateSystem:coord,chunkIds:[snapId],qualificationStatus:'qualified-candidate',
      criteriaVersion:'native-visible-roi-v1',acquisitionStartedAt:t('00.500'),acquiredThroughAt:t('01.000'),storedAt:t('01.100'),receiptEventSeq:1,
      transform:{valid:true},clipStatus:'verified-classifiable',associationStatus:'same-target-and-rail-pose',coverage:{status:'qualified-candidate',pointsInEngineUsefulRoi:100}});
  }
  const state={identity,rails:K.clone(base.rails),capturedAt:t('00.000')};
  return {clouds,record:{recordId:'record',visitId:'visit',identity,beforeEstablished:state,railSnapshots,stateTransitions:[],
    operatorIntents:[{intent:'VALIDATE',observedAt:intentAt,eventSeq:9,stateObservedBeforeInput:K.clone(state)}]}};
}

test('par défaut, la lecture complète ajoute la suite de la même lecture avant toute action humaine',()=>{
  const f=fixture(),full=Lab.prepareVisit(f.record,f.clouds),first=Lab.prepareVisit(f.record,f.clouds,[],{inputMode:'first-snapshot'});
  for(const side of ['left','right']){
    assert.equal(full.rails[side].status,'ready');assert.equal(first.rails[side].status,'ready');
    assert.equal(full.rails[side].inputMode,'initial-pose-read');assert.equal(first.rails[side].inputMode,'first-snapshot');
    assert.deepEqual(full.rails[side].chunks.map(c=>c.chunkId),[`cap:${side}:0`,`cap:${side}:1`]);
    assert.deepEqual(first.rails[side].chunks.map(c=>c.chunkId),[`cap:${side}:0`]);
    assert.ok(full.rails[side].points>first.rails[side].points);assert.equal(full.rails[side].readBoundaryAt,intentAt);
  }
  assert.equal(Lab.DEFAULT_INPUT_MODE,'initial-pose-read');
});

test('un bloc acquis après une correction observée du rail n’entre pas',()=>{
  const f=fixture(),beforeState=K.clone(f.record.beforeEstablished),afterState=K.clone(beforeState);afterState.capturedAt=t('01.500');
  afterState.rails.left=K.expectedPoses(beforeState,{left:{delta:[0,.01,0]},right:{delta:[0,0,0]}}).left;
  f.record.stateTransitions.push({observedAt:t('01.500'),eventSeq:8,effect:{kind:'rail-state-changed'},beforeState,afterState});
  const r=Lab.prepareVisit(f.record,f.clouds);
  assert.deepEqual(r.rails.left.chunks.map(c=>c.chunkId),['cap:left:0'],'la suite de lecture du rail corrigé s’arrête à la correction');
  assert.deepEqual(r.rails.right.chunks.map(c=>c.chunkId),['cap:right:0','cap:right:1'],'l’autre rail garde sa lecture complète');
});

test('le constructeur d’entrée refuse une lecture complète truquée',()=>{
  const f=fixture(),snap=f.clouds.get('cap:left:0');
  const eligibility={criteriaVersion:'native-visible-roi-v1',readMode:'initial-pose-read-v1',snapshotId:'cap:left:0',snapshotChunkIds:['cap:left:0'],boundaryAt:intentAt};
  const build=chunkIds=>Legacy.buildEngineInput({identity,side:'left',initialRail:f.record.beforeEstablished.rails.left,eligibility:{...eligibility,chunkIds}},f.clouds);
  assert.equal(build(['cap:left:0','cap:left:1']).status,'ready');
  assert.ok(build(['cap:left:0','autre:left:1']).reasons.includes('initial-pose-read-foreign-capture'));
  assert.ok(build(['cap:left:0','cap:left:2']).reasons.includes('initial-pose-read-after-human-boundary'));
  assert.ok(build(['cap:left:1','cap:left:0']).reasons.includes('qualified-checkpoint-not-exported'),'l’instantané doit rester à son rang');
  assert.ok(build(['cap:left:0','cap:left:3']).reasons.includes('chunk-rail-frame-mismatch'));
  assert.equal(snap.qualification.status,'qualified-candidate');
});
