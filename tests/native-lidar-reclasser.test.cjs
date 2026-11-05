'use strict';
/* CH-053-C, piste « reclasser les points lus sous l'ancienne découpe ». Quand la découpe d'ESV bouge en cours de lecture
 * (CLIP_CHANGED), les points retenus mais pas encore sauvegardés étaient jetés. Ils sont maintenant classés de nouveau
 * contre la découpe courante (visibilité = fonction du point et de la découpe, rien d'autre) et sauvegardés dans un bloc
 * MARQUÉ `reclassified-to-current-clip`. La définition stricte ne l'accepte pas (clipStatus ≠ verified-classifiable) :
 * le taux strict et les étiquettes ne bougent pas ; seule la définition assouplie (tools/taux-apprenables.cjs
 * --assouplie) le retient. Données : scène synthétique du banc, rien du terrain. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../src/native-lidar.js'),B=require('../tools/native-capture-bench.cjs'),L=require('../vendor/lidar.js');
const ENUMS={ClipTask:{NONE:0,HIGHLIGHT:1,SHOW_INSIDE:2,SHOW_OUTSIDE:3},ClipMethod:{INSIDE_ANY:0,INSIDE_ALL:1}};

async function lire({bouger=null,options={}}={}){
  const scn=B.scene(),chunks=[];let checkpoints=0;
  const result=await N.capture({viewer:scn.viewer,rails:{left:B.railState(scn.left),right:B.railState(scn.right)},origin:scn.origin,enums:ENUMS,
    maxInspected:500000,maxMillis:1e9,yieldEvery:512,checkpointPoints:300,coverage:{minimumLongitudinalSpan:99},guard:()=>{},now:()=>0,
    pause:async()=>{},captureId:'c',visitId:'v',meta:{identity:{pageId:'p',part:1,cut:1,shape:'U50',frameId:'f',projectId:null}},...options,
    onCheckpoint:async chunk=>{chunks.push(chunk);checkpoints++;
      if(bouger!==null&&checkpoints===bouger){const m=scn.viewer.scene.pointclouds[0].material;
        m.clipTask=ENUMS.ClipTask.SHOW_INSIDE;m.clipBoxes=[{inverse:[1,0,0,0,0,1,0,0,0,0,1,0,-513236.9,-6638161,-60,1]}];}
      return {storageConfirmedAt:'2026-11-05T00:00:00.000Z'};}});
  return {result,chunks,scn};
}
const reclasses=chunks=>chunks.filter(c=>c.qualification?.clipStatus==='reclassified-to-current-clip');

test('sans mouvement de découpe : aucun bloc reclassé, mêmes blocs qu\'avant',async()=>{
  const a=await lire(),b=await lire({options:{reclasserDecoupe:false}});
  assert.equal(reclasses(a.chunks).length,0);
  assert.equal(a.chunks.length,b.chunks.length);
});

test('découpe qui bouge : le tampon non sauvegardé est reclassé et sauvegardé, marqué, terminaison inchangée',async()=>{
  const sans=await lire({bouger:1,options:{reclasserDecoupe:false}});
  const avec=await lire({bouger:1});
  assert.equal(avec.result.termination?.code,'CLIP_CHANGED');
  assert.equal(sans.result.termination?.code,'CLIP_CHANGED');
  assert.equal(reclasses(sans.chunks).length,0);
  const r=reclasses(avec.chunks);
  assert.ok(r.length>0,'aucun bloc reclassé');
  // Les blocs d'avant le mouvement sont identiques, non révoqués.
  assert.deepEqual(avec.chunks.slice(0,sans.chunks.length).map(c=>c.chunkId),sans.chunks.map(c=>c.chunkId));
  for(const c of r){
    assert.equal(c.qualification.sourceStatus,'reference-version-and-matrix-stable-through-checkpoint');
    assert.ok(c.qualification.exclusionReasons.includes('clip-reclassified-not-strict'));
    assert.ok(c.reclassification&&c.reclassification.points===c.pointsSceneRelative.length);
    assert.equal(c.pointsSceneRelative.length,c.visibleByClipBoxes.length);
    assert.equal(c.pointsProfileLocal.length,c.pointsSceneRelative.length);
  }
});

test('accord : la visibilité d\'un point reclassé = celle d\'une lecture directe sous la découpe courante',async()=>{
  const {chunks,scn}=await lire({bouger:1});
  const clip=L.clipSnapshot(scn.viewer.scene.pointclouds[0],scn.origin,ENUMS);
  const r=reclasses(chunks);assert.ok(r.length>0);let n=0,faux=0,vrais=0;
  for(const c of r)c.pointsSceneRelative.forEach((p,i)=>{n++;const v=L.boxVisible(clip,p);if(c.visibleByClipBoxes[i]!==v)faux++;if(v===true)vrais++;});
  assert.ok(n>0);assert.equal(faux,0);
  assert.ok(vrais>0&&vrais<n,'la découpe doit changer la visibilité de certains points seulement (essai non vide)');
});
