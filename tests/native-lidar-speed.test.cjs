'use strict';
/* 4.7.2 — le lecteur natif accéléré lit EXACTEMENT les mêmes points.
 *
 * Deux changements de rythme ont été introduits : l'accès direct au buffer
 * (prouvé par les sondes) et le découpage par le temps. Aucun des deux ne doit
 * changer ce qui est retenu, transformé, classé visible ou qualifié. Ces
 * essais le vérifient sur la scène du banc (500 000 points, 20 nœuds). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../src/native-lidar.js'),B=require('../tools/native-capture-bench.cjs');
const ENUMS={ClipTask:{NONE:0,HIGHLIGHT:1,SHOW_INSIDE:2,SHOW_OUTSIDE:3},ClipMethod:{INSIDE_ANY:0,INSIDE_ALL:1}};
const scn=B.scene();

async function read(extra={}){
  const chunks=[];
  const result=await N.capture({viewer:scn.viewer,rails:{left:B.railState(scn.left),right:B.railState(scn.right)},origin:scn.origin,enums:ENUMS,
    maxInspected:500000,maxMillis:1e9,yieldEvery:2048,checkpointPoints:2048,pause:async()=>{},guard:()=>{},now:()=>0,
    captureId:'c',visitId:'v',meta:{identity:{pageId:'p',part:1,cut:1,shape:'U50',frameId:'f',projectId:null}},
    onCheckpoint:async chunk=>{chunks.push(chunk);return {storageConfirmedAt:'2026-09-22T00:00:00.000Z'};},...extra});
  const bySide=side=>chunks.filter(c=>c.side===side);
  const flat=(side,key)=>bySide(side).flatMap(c=>c[key]);
  return {result,chunks,points:side=>flat(side,'pointsSceneRelative'),local:side=>flat(side,'pointsProfileLocal'),
    sources:side=>flat(side,'pointSources'),visible:side=>flat(side,'visibleByClipBoxes'),
    firstQualified:side=>bySide(side).find(c=>c.qualification.status==='qualified-candidate')||null};
}

test('le chemin direct est bien emprunté sur un attribut Three.js flottant et vérifié par sondes',async()=>{
  const fast=await read();
  assert.ok(fast.result.sourceNodes.every(n=>n.readPath==='direct-buffer-verified-by-probes'));
  const slow=await read({directRead:false});
  assert.ok(slow.result.sourceNodes.every(n=>n.readPath==='attribute-accessor'));
});

test('chemin direct et chemin historique retiennent les mêmes points, dans le même ordre',async()=>{
  const fast=await read(),slow=await read({directRead:false});
  for(const key of ['pointsRead','pointsTransformed','pointsRetainedInRoi','pointsCheckpointed'])
    assert.equal(fast.result.trace[key],slow.result.trace[key],key);
  for(const side of ['left','right']){
    assert.deepEqual(fast.points(side),slow.points(side));assert.deepEqual(fast.local(side),slow.local(side));
    assert.deepEqual(fast.sources(side),slow.sources(side));assert.deepEqual(fast.visible(side),slow.visible(side));
    assert.deepEqual(fast.result.railObservations[side].coverage,slow.result.railObservations[side].coverage);
    assert.deepEqual(fast.result.railObservations[side].clipLoss,slow.result.railObservations[side].clipLoss);
    assert.equal(fast.firstQualified(side).chunkId,slow.firstQualified(side).chunkId);
  }
  assert.equal(fast.result.status,slow.result.status);
});

test('les tranches de temps changent le rythme des pauses, pas les points retenus',async()=>{
  let t=0;const counted=await read({yieldEvery:2048}),sliced=await read({yieldEvery:1e9,sliceMs:5,sliceClock:()=>(t+=.01)});
  for(const side of ['left','right']){
    assert.deepEqual(sliced.points(side),counted.points(side));assert.deepEqual(sliced.sources(side),counted.sources(side));
    assert.equal(sliced.result.railObservations[side].coverage.status,counted.result.railObservations[side].coverage.status);
  }
  assert.equal(sliced.result.pacing.mode,'time-slices');assert.equal(counted.result.pacing.mode,'point-count');
  assert.ok(sliced.result.pacing.pauses>0,'une tranche échue doit rendre la main');
  assert.ok(sliced.result.pacing.pauses<counted.result.pacing.pauses,'moins de pauses qu’au compte de 2048 points');
});

test('la garde et la vérification des sources restent exécutées à chaque pause en mode tranche',async()=>{
  let t=0,guards=0,pauses=0;
  const r=await read({yieldEvery:1e9,sliceMs:1,sliceClock:()=>(t+=.05),guard:()=>{guards++;},pause:async()=>{pauses++;}});
  assert.ok(pauses>0);assert.ok(guards>=pauses,'au moins une garde par pause');
  const error=Object.assign(Error('Cible différente : cut'),{code:'TARGET_CHANGED'});let seen=0;
  const stopped=await read({yieldEvery:1e9,sliceMs:1,sliceClock:()=>(t+=.05),guard:()=>{if(++seen>3)throw error;}});
  assert.equal(stopped.result.termination.code,'TARGET_CHANGED');assert.match(stopped.result.status,/^partial-interrupted/);
  assert.ok(r.result.trace.pointsRead>stopped.result.trace.pointsRead);
});

test('les bornes de points restent exactes sur le chemin direct',async()=>{
  const r=await read({maxInspected:12345});
  assert.equal(r.result.trace.pointsRead,12345);assert.equal(r.result.termination.code,'RESOURCE_LIMIT');
  assert.equal(r.result.termination.reason,'maximum-inspected-reached');
  const slow=await read({maxInspected:12345,directRead:false});
  assert.deepEqual(r.points('left'),slow.points('left'));assert.deepEqual(r.points('right'),slow.points('right'));
  const retained=await read({maxPointsPerRail:40});
  assert.equal(retained.result.railObservations.left.pointsRetained,40);assert.equal(retained.result.railObservations.right.pointsRetained,40);
  assert.equal(retained.result.termination.reason,'maximum-retained-reached');
});

test('le chemin direct est refusé dès qu’une condition manque ou qu’une sonde diverge',()=>{
  const {directReader}=N._test;
  const array=Float32Array.from([0,0,0,1,2,3,4,5,6,7,8,9]);
  const node=position=>({position,attribute:{count:position.count,point:i=>[position.getX?position.getX(i):position.array[i*3],
    position.getY?position.getY(i):position.array[i*3+1],position.getZ?position.getZ(i):position.array[i*3+2]],
    metadata:{stride:3,offset:0,itemSize:3,normalized:!!position.normalized}}});
  const plain={array,count:4,itemSize:3,normalized:false};
  const range={index:null,start:0,end:4,count:4};
  assert.ok(directReader(node(plain),range,new Set([0,1,2,3])));
  assert.equal(directReader(node(plain),{...range,index:{get:i=>i}},new Set([0,1])),null,'indexé');
  assert.equal(directReader(node({...plain,normalized:true}),range,new Set([0,1])),null,'normalisé');
  assert.equal(directReader(node({...plain,array:Int16Array.from(array)}),range,new Set([0,1])),null,'entier');
  assert.equal(directReader(node({...plain,isFloat16BufferAttribute:true}),range,new Set([0,1])),null,'float16');
  const lying={...plain,getX(i){return this.array[i*3]+1;},getY(i){return this.array[i*3+1];},getZ(i){return this.array[i*3+2];}};
  assert.equal(directReader(node(lying),range,new Set([0,1,2])),null,'un accesseur qui ne lit pas le tableau brut garde le chemin historique');
  assert.equal(directReader(node(plain),range,new Set()),null,'aucune sonde, aucune preuve');
});
