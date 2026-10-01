const {test}=require('node:test'),assert=require('node:assert/strict');
const Pod=require('../src/pair-origin-distance.js');
const Lab=require('../tools/pair-lab.cjs');
const Geometry=require('../src/geometry.js');
const GeometryBrain=require('../src/geometry-brain.js');

test('canonical pairProfileOriginDistance reads only profileOriginSceneRelative',()=>{
 const left={profileOriginSceneRelative:[0,0,0],positionSceneRelative:[9,9,9]};
 const right={profileOriginSceneRelative:[0,1.5,0],positionSceneRelative:[0,0,0]};
 const m=Pod.pairProfileOriginDistance(left,right);
 assert.equal(m.status,'measured');
 assert.equal(m.name,'pairProfileOriginDistance');
 assert.equal(m.provenance,'profileOriginSceneRelative');
 assert.equal(m.notAnEsvGauge,true);
 assert.equal(m.sceneUnitsTimes1e3,1500);
 assert.doesNotMatch(JSON.stringify(m),/\bmm\b|écartement|ecartement/i);
});

test('pairOriginDistance is the canonical metric and does not fall back to positionSceneRelative',()=>{
 const left={positionSceneRelative:[0,0,0]};
 const right={positionSceneRelative:[0,1.49993,0]};
 const m=Pod.pairOriginDistance(left,right);
 assert.equal(m.status,'unavailable');
 assert.equal(m.reason,'profileOriginSceneRelative-missing');
 assert.equal(m.provenance,'profileOriginSceneRelative');
});

test('pairRailPositionDistance is a distinct secondary metric',()=>{
 const left={profileOriginSceneRelative:[1,0,0],positionSceneRelative:[0,0,0]};
 const right={profileOriginSceneRelative:[1,3,4],positionSceneRelative:[0,2,0]};
 const canon=Pod.pairProfileOriginDistance(left,right);
 const secondary=Pod.pairRailPositionDistance(left,right);
 assert.equal(canon.sceneUnits,5);
 assert.equal(secondary.sceneUnits,2);
 assert.equal(secondary.name,'pairRailPositionDistance');
 assert.equal(secondary.provenance,'positionSceneRelative');
});

test('missing canonical origins stay unavailable instead of inventing a distance',()=>{
 assert.equal(Pod.pairProfileOriginDistance(null,{profileOriginSceneRelative:[1,0,0]}).status,'unavailable');
 assert.equal(Pod.pairRailPositionDistance({positionSceneRelative:[1,0]},{positionSceneRelative:[0,0,0]}).status,'unavailable');
});

test('mandatory witness 6/9480 is reported-not-replayed and does not claim formula reproduction',()=>{
 const w=Lab.witnessBlock();
 assert.equal(w.identity.part,6);
 assert.equal(w.identity.cut,9480);
 assert.equal(w.status,'reported-not-replayed');
 assert.equal(w.formulaDoesNotClaimReproduction,true);
 assert.equal(w.pairOriginDistanceTimes1e3.initial,1499.93);
 assert.equal(w.pairOriginDistanceTimes1e3.bananeObserved,1517.73);
 assert.equal(w.pairOriginDistanceTimes1e3.engineFrozen,1518.19);
 assert.match(w.interpretation.join(' '),/ne prétend pas reproduire/);
});

test('a correction record without LiDAR keeps engine and brain unavailable',()=>{
 const doc={format:'banane-corrections-session-v4',clouds:[],records:[{
   part:17,cut:100,shape:'U50',sessionId:'s',lidarCaptureId:'absent',
   rails:{
    left:{initial:{profileOriginSceneRelative:[0,0,0]},corrected:{profileOriginSceneRelative:[0,0.01,0]}},
    right:{initial:{profileOriginSceneRelative:[0,1.48285,0]},corrected:{profileOriginSceneRelative:[0,1.43707,0]}}
   }
 }]};
 const {entries,coverage}=Lab.ingest(doc);
 assert.equal(coverage.engineUnavailableNoLidar,1);
 assert.equal(coverage.engineReplayed,0);
 const measured=Lab.measureCase(entries[0]);
 assert.ok(Math.abs(measured.pairProfileOriginDistanceTimes1e3.initial-1482.85)<1e-6);
 assert.equal(measured.pairProfileOriginDistanceTimes1e3.engineFrozen,null);
 assert.equal(measured.pairProfileOriginDistanceTimes1e3.brainOfflineReplayV1Forced,null);
 assert.doesNotMatch(JSON.stringify(measured),/cible 1436|usableForTraining|écartement/);
});

test('descriptive associations stay silent on two points and separate ante-human descriptors',()=>{
 const rows=[
  {identity:{part:6,cut:1},pairProfileOriginDistanceTimes1e3:{initial:1500,human:1435,engineFrozen:1518},
   anteHumanDescriptors:{pairEngineMinusInitialTimes1e3:18,absPairEngineMinusInitialTimes1e3:18},
   railErrorTimes1e3:{left:10,right:8}},
  {identity:{part:6,cut:2},pairProfileOriginDistanceTimes1e3:{initial:1440,human:1435,engineFrozen:1441},
   anteHumanDescriptors:{pairEngineMinusInitialTimes1e3:1,absPairEngineMinusInitialTimes1e3:1},
   railErrorTimes1e3:{left:2,right:1}}
 ];
 const a=Lab.descriptiveAssociations(rows);
 assert.equal(a.label,'associations-descriptives');
 assert.equal(a.usingHumanFinal.n,2);
 assert.equal(a.usingHumanFinal.pearsonAbsPairEngineHumanVsMaxRailError,null);
 assert.equal(a.usingAnteHumanDescriptors.n,2);
 assert.equal(a.usingAnteHumanDescriptors.pearsonAbsPairEngineMinusInitialVsMaxRailError,null);
 assert.match(a.note,/Aucun seuil/);
});

test('byPart uses the forced-offline brain series name',()=>{
  const rows=[
    {identity:{part:6,cut:1},pairProfileOriginDistanceTimes1e3:{initial:10,human:11,engineFrozen:12,brainOfflineReplayV1Forced:12.1}},
    {identity:{part:17,cut:2},pairProfileOriginDistanceTimes1e3:{initial:20,human:21,engineFrozen:null,brainOfflineReplayV1Forced:null}},
    {identity:{part:17,cut:3},pairProfileOriginDistanceTimes1e3:{initial:30,human:31,engineFrozen:null,brainOfflineReplayV1Forced:null}}
  ];
  const g=Lab.byPart(rows);
  assert.equal(g[6].cuts,1);
  assert.equal(g[17].engineFrozen.count,0);
  assert.equal(g[17].brainOfflineReplayV1Forced.count,0);
  assert.equal(g[17].initial.mean,25);
});

test('brainOfflineReplayV1Forced matches geometry-brain.js with the brain forced on and the same parameters',()=>{
 const capture={
  identity:{part:23,cut:1,shape:'U50',frameId:'f'},
  rails:{
   left:{profileContours:null,sceneRelativeToProfileLocal:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]},
   right:{profileContours:null,sceneRelativeToProfileLocal:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}
  },
  pointsSceneRelative:[[0,0,0],[0.01,0,0]],
  visibleByClipBoxes:[true,true]
 };
 const frozen=Geometry.proposeBoth(capture);
 const previous=GeometryBrain.reglages();
 try{
  GeometryBrain.configure({actif:true,autoriserSelectionSansPause:true,...Lab.BRAIN_OFFLINE_PARAMS});
  const viaModule=GeometryBrain.proposeBoth(capture);
  const viaLab=Lab.replayBrainOfflineV1Forced(frozen);
  assert.deepEqual(viaLab.proposals.left.status,viaModule.left.status);
  assert.deepEqual(viaLab.proposals.right.status,viaModule.right.status);
  assert.deepEqual(viaLab.proposals.left.delta,viaModule.left.delta);
  assert.deepEqual(viaLab.proposals.right.delta,viaModule.right.delta);
  assert.equal(Lab.BRAIN_OFFLINE_PARAMS.biaisVertical,GeometryBrain.AJUSTE.biaisVertical);
 }finally{
  GeometryBrain.configure({actif:false,autoriserSelectionSansPause:false,...previous,actif:false});
 }
 const off=GeometryBrain.reglages();
 assert.equal(off.actif,false,'le rejeu forcé ne doit pas laisser le cerveau allumé');
});

test('offline evaluation rows keep rail-level error only as a comparator',()=>{
 const doc={format:'banane-offline-evaluation-v1',results:[{
  identity:{part:20,cut:4,shape:'U50'},
  initialRails:{left:{profileOriginSceneRelative:[0,0,0]},right:{profileOriginSceneRelative:[1.5,0,0]}},
  finalHumanRails:{left:{profileOriginSceneRelative:[0,0,0]},right:{profileOriginSceneRelative:[1.436,0,0]}},
  proposal:null,
  rails:{left:{errorMm:{euclidean:4.2}},right:{errorMm:{euclidean:3.1}}}
 }]};
 const {entries}=Lab.ingest(doc);
 const measured=Lab.measureCase(entries[0]);
 assert.equal(measured.pairProfileOriginDistanceTimes1e3.initial,1500);
 assert.equal(measured.railErrorTimes1e3.left,4.2);
 assert.equal(measured.anteHumanDescriptors.pairEngineMinusInitialTimes1e3,null);
});
