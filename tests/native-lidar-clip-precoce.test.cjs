'use strict';
/* CH-049-A — la découpe d'ESV bouge juste après un changement de cut (mesuré : 95 captures sur 527 finissent en
 * CLIP_CHANGED, toutes la 1re de leur visite). Le changement n'était constaté qu'à un checkpoint (seuil de points
 * retenus), soit 300 à 500 ms de lecture jetée. Il doit l'être à la pause qui suit, sans changer ce qui est retenu
 * quand la découpe ne bouge pas. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../src/native-lidar.js'),B=require('../tools/native-capture-bench.cjs');
const ENUMS={ClipTask:{NONE:0,HIGHLIGHT:1,SHOW_INSIDE:2,SHOW_OUTSIDE:3},ClipMethod:{INSIDE_ANY:0,INSIDE_ALL:1}};

/* `bougerAuCheckpoint` : la découpe bouge juste après le n-ième checkpoint ; on compte les pauses qui suivent. */
async function lire({bougerAuCheckpoint=null}={}){
  const scn=B.scene(),chunks=[];let pauses=0,depuisMouvement=null,checkpoints=0;
  const result=await N.capture({viewer:scn.viewer,rails:{left:B.railState(scn.left),right:B.railState(scn.right)},origin:scn.origin,enums:ENUMS,
    maxInspected:500000,maxMillis:1e9,yieldEvery:512,checkpointPoints:300,coverage:{minimumLongitudinalSpan:99},guard:()=>{},now:()=>0,
    pause:async()=>{pauses++;if(depuisMouvement!==null)depuisMouvement++;},
    captureId:'c',visitId:'v',meta:{identity:{pageId:'p',part:1,cut:1,shape:'U50',frameId:'f',projectId:null}},
    onCheckpoint:async chunk=>{chunks.push(chunk);checkpoints++;
      if(bougerAuCheckpoint!==null&&checkpoints===bougerAuCheckpoint){const m=scn.viewer.scene.pointclouds[0].material;
        m.clipTask=ENUMS.ClipTask.SHOW_INSIDE;m.clipBoxes=[{inverse:[1,0,0,0,0,1,0,0,0,0,1,0,0.5,0,0,1]}];depuisMouvement=0;}
      return {storageConfirmedAt:'2026-11-04T00:00:00.000Z'};}});
  return {result,chunks,pauses,pausesApresMouvement:depuisMouvement};
}

test('sans mouvement de découpe, la lecture n\'est pas interrompue et retient les mêmes points',async()=>{
  const a=await lire(),b=await lire();
  assert.equal(a.result.termination,null);
  assert.equal(a.result.trace.pointsRetainedInRoi,b.result.trace.pointsRetainedInRoi);
  assert.ok(a.result.trace.pointsCheckpointed>0);
});

test('une découpe qui bouge est constatée à la pause suivante, sans attendre un autre checkpoint',async()=>{
  const r=await lire({bougerAuCheckpoint:1});
  assert.equal(r.result.termination?.code,'CLIP_CHANGED');
  assert.ok(r.pausesApresMouvement<=1,`constaté ${r.pausesApresMouvement} pauses après le mouvement (attendu : au plus 1)`);
});
