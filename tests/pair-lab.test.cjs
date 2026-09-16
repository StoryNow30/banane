const {test}=require('node:test'),assert=require('node:assert/strict');
const Pod=require('../src/pair-origin-distance.js');
const Lab=require('../tools/pair-lab.cjs');

test('pairOriginDistance is a scene-unit euclidean distance and is never named a gauge',()=>{
 const left={positionSceneRelative:[0,0,0]},right={positionSceneRelative:[0,1.49993,0]};
 const m=Pod.pairOriginDistance(left,right);
 assert.equal(m.status,'measured');
 assert.equal(m.name,'pairOriginDistance');
 assert.equal(m.notAnEsvGauge,true);
 assert.equal(m.unitName,'scene-units');
 assert.equal(m.physicalCalibrationStatus,'not-attested');
 assert.ok(Math.abs(m.sceneUnitsTimes1e3-1499.93)<1e-6);
 assert.doesNotMatch(JSON.stringify(m),/\bmm\b|écartement|ecartement/i);
});

test('profileOriginSceneRelative is preferred over positionSceneRelative',()=>{
 const left={profileOriginSceneRelative:[1,0,0],positionSceneRelative:[9,9,9]};
 const right={profileOriginSceneRelative:[1,3,4],positionSceneRelative:[0,0,0]};
 const m=Pod.pairOriginDistance(left,right);
 assert.equal(m.sceneUnits,5);
});

test('missing origins stay unavailable instead of inventing a distance',()=>{
 assert.equal(Pod.pairOriginDistance(null,{positionSceneRelative:[1,0,0]}).status,'unavailable');
 assert.equal(Pod.pairOriginDistance({positionSceneRelative:[1,0]}, {positionSceneRelative:[0,0,0]}).status,'unavailable');
});

test('mandatory witness 6/9480 keeps the three reported pairOriginDistance values',()=>{
 const w=Lab.witnessBlock();
 assert.equal(w.identity.part,6);
 assert.equal(w.identity.cut,9480);
 assert.equal(w.pairOriginDistanceTimes1e3.initial,1499.93);
 assert.equal(w.pairOriginDistanceTimes1e3.bananeObserved,1517.73);
 assert.equal(w.pairOriginDistanceTimes1e3.engine,1518.19);
 assert.equal(w.pairOriginDistanceTimes1e3.human,null);
 assert.ok(w.interpretation.every(line=>!/cible|seuil|1436/.test(line)||/Aucune cible/.test(line)));
});

test('Banane and the frozen engine both increased pairOriginDistance on the witness, away from the later human tightening reported on other parts',()=>{
 const w=Lab.WITNESS.observed.pairOriginDistanceTimes1e3;
 assert.ok(w.banane>w.initial);
 assert.ok(w.engineFrozen>w.initial);
 assert.ok(Math.abs(w.banane-w.engineFrozen)<1);
});

test('a correction record is measured without reading a training label or imposing 1436',()=>{
 const record={part:17,cut:100,shape:'U50',sessionId:'s',
  rails:{
   left:{initial:{positionSceneRelative:[0,0,0]},corrected:{positionSceneRelative:[0,0.01,0]}},
   right:{initial:{positionSceneRelative:[0,1.48285,0]},corrected:{positionSceneRelative:[0,1.43707,0]}}
  }};
 const measured=Lab.measureCase(Lab.fromCorrectionRecord(record));
 assert.equal(measured.identity.part,17);
 assert.ok(Math.abs(measured.pairOriginDistanceTimes1e3.initial-1482.85)<1e-6);
 assert.ok(Math.abs(measured.pairOriginDistanceTimes1e3.human-1427.07)<1e-6);
 assert.equal(measured.pairOriginDistanceTimes1e3.engine,null);
 assert.doesNotMatch(JSON.stringify(measured),/1436|usableForTraining|écartement/);
});

test('prediction stays descriptive and refuses to invent a correlation on two points',()=>{
 const rows=[
  {identity:{part:6,cut:1},pairOriginDistanceTimes1e3:{initial:1500,human:1436,engine:1518,brain:null},railErrorTimes1e3:{left:10,right:8}},
  {identity:{part:6,cut:2},pairOriginDistanceTimes1e3:{initial:1440,human:1436,engine:1441,brain:null},railErrorTimes1e3:{left:2,right:1}}
 ];
 const p=Lab.prediction(rows);
 assert.equal(p.nWithEngineAndHuman,2);
 assert.equal(p.pearsonAbsPairEngineErrorVsMaxRailError,null);
 assert.match(p.note,/Aucun seuil/);
 assert.equal(p.meanEngineMinusHumanTimes1e3,(82+5)/2);
});

test('byPart does not mix parts and does not drop a singleton part',()=>{
  const rows=[
    {identity:{part:6,cut:1},pairOriginDistanceTimes1e3:{initial:10,human:11,engine:12,brain:null}},
    {identity:{part:17,cut:2},pairOriginDistanceTimes1e3:{initial:20,human:21,engine:null,brain:null}},
    {identity:{part:17,cut:3},pairOriginDistanceTimes1e3:{initial:30,human:31,engine:null,brain:null}}
  ];
  const g=Lab.byPart(rows);
  assert.equal(g[6].cuts,1);
  assert.equal(g[17].cuts,2);
  assert.equal(g[17].initial.mean,25);
});

test('offline evaluation rows keep rail-level error only as a comparator, not as a pair label',()=>{
 const row={identity:{part:20,cut:4},initialRails:{left:{positionSceneRelative:[0,0,0]},right:{positionSceneRelative:[1.5,0,0]}},
  finalHumanRails:{left:{positionSceneRelative:[0,0,0]},right:{positionSceneRelative:[1.436,0,0]}},
  proposal:null,rails:{left:{errorMm:{euclidean:4.2}},right:{errorMm:{euclidean:3.1}}}};
 const measured=Lab.measureCase(Lab.fromOfflineRow(row));
 assert.equal(measured.pairOriginDistanceTimes1e3.initial,1500);
 assert.equal(measured.railErrorTimes1e3.left,4.2);
});
