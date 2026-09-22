#!/usr/bin/env node
'use strict';
/*
 * native-capture-bench.cjs — banc du lecteur LiDAR passif du mode Natif.
 *
 *   node tools/native-capture-bench.cjs [--module src/native-lidar.js] [--json SORTIE]
 *        [--profile ancien|nouveau] [--yield-ms 16] [--guard-ms 2]
 *
 * POURQUOI CE BANC. Sur le terrain, le lecteur plafonne à ~106 000 points par
 * seconde quelle que soit la session (lots du 22/09 : 106, 107, 110 pts/ms).
 * Ce débit ne dépend ni du nombre de points retenus ni du préfiltre : il vient
 * du RYTHME des pauses. Chaque pause attendait `requestIdleCallback` avec un
 * délai maximal de 16 ms ; ESV dessine en continu, la page n'a donc jamais de
 * temps libre et chaque pause coûte les 16 ms entières. 2048 points par pause
 * × 1/16 ms = 128 000 points/s, au bruit près le plafond observé.
 *
 * CE QUE LE BANC MODÉLISE, ET CE QU'IL NE MODÉLISE PAS. Il exécute le vrai
 * lecteur sur une scène synthétique proche des captures du 22/09 (≈ 20 nœuds,
 * ≈ 500 000 points en mémoire, 2 nœuds utiles, ~2 % des points dans la ROI).
 * Le coût CPU est réel ; le coût d'une pause et celui de la garde (qui lit
 * l'état ESV) sont MODÉLISÉS par une horloge simulée, avec des valeurs
 * paramétrables. Il ne mesure pas le rendu Potree ni Edge : il compare deux
 * rythmes de lecture sous les mêmes hypothèses.
 */
const fs=require('node:fs'),path=require('node:path');
const C=require('../vendor/capture-core.js');

function arg(name,fallback){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:fallback;}

/* Attribut de position au comportement Three.js : accesseurs getX/getY/getZ
 * présents, comme dans ESV. `C.attribute` les appelle — c'est le chemin lent
 * réellement emprunté en production. */
function threeAttribute(array){
  return {array,itemSize:3,count:array.length/3,version:0,normalized:false,
    getX(i){return this.array[i*3];},getY(i){return this.array[i*3+1];},getZ(i){return this.array[i*3+2];}};
}
function object(position,type='Object3D',angle=0){
  const o={type,visible:true,position:{x:position[0],y:position[1],z:position[2]},scale:{x:1,y:1,z:1},
    quaternion:{x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)},rotation:{x:0,y:0,z:angle,order:'ZYX'},
    matrixAutoUpdate:true,children:[],parent:null};
  o.matrixWorld={elements:C.worldMatrix(o)};return o;
}
function add(parent,child){parent.children.push(child);child.parent=parent;child.matrixWorld={elements:C.worldMatrix(child)};return child;}
function rail(y,origin,angle){
  const r=object([origin[0],origin[1]+y,origin[2]],'Object3D',angle);add(r,object([0,0,0],'Mesh'));
  const p=add(r,object([0,0,0]));const line=add(p,object([0,0,0],'Line'));
  const pts=[[0,0,0],[0,.035,0],[0,.035,-.05]];line.geometry={attributes:{position:{array:Float32Array.from(pts.flat()),itemSize:3,count:3,version:0,normalized:false}}};
  return r;
}
/* Générateur pseudo-aléatoire déterministe : même scène à chaque exécution. */
function rng(seed){let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}

function scene({nodes=20,pointsPerNode=25000,usefulNodes=2,roiShare=.02,seed=7}={}){
  const origin=[513237,6638161,60],angle=.25,left=rail(0,origin,angle),right=rail(1.435,origin,angle);
  const root=object([0,0,0],'Scene');add(root,left);add(root,right);
  const random=rng(seed),visibleNodes=[];
  const toWorld=(r,local)=>C.point(C.worldMatrix(r),local);
  for(let n=0;n<nodes;n++){
    const nodeOrigin=[origin[0]+(n<usefulNodes?0:8+2*n),origin[1],origin[2]];
    const mesh=object(nodeOrigin,'Points');mesh.isPoints=true;
    const array=new Float32Array(pointsPerNode*3);
    for(let i=0;i<pointsPerNode;i++){
      let world;
      if(n<usefulNodes&&random()<roiShare){
        /* Point dans la ROI d'un rail (repère profil local), dessus et flanc. */
        const r=random()<.5?left:right,local=[-.5+random(),-.12+.24*random(),-.06+.08*random()];
        world=toWorld(r,local);
      }else{
        /* Point de la scène hors ROI : ballast, traverses, environnement. */
        world=[nodeOrigin[0]-4+8*random(),nodeOrigin[1]-4+8*random(),nodeOrigin[2]-1.5+3*random()];
        if(n<usefulNodes){const l=C.point(C.inverse(C.worldMatrix(left)),world);if(Math.abs(l[0])<=.5&&Math.abs(l[1])<=.4&&Math.abs(l[2])<=.3)world[2]-=2;}
      }
      array[i*3]=world[0]-nodeOrigin[0];array[i*3+1]=world[1]-nodeOrigin[1];array[i*3+2]=world[2]-nodeOrigin[2];
    }
    mesh.geometry={attributes:{position:threeAttribute(array)},drawRange:{start:0,count:Infinity}};
    visibleNodes.push({sceneNode:mesh});
  }
  const pc=object([0,0,0],'PointCloudOctree');pc.visibleNodes=visibleNodes;pc.material={clipBoxes:[],clipTask:0,clipMethod:0};
  const camera=object([origin[0],origin[1],origin[2]+3],'OrthographicCamera');camera.projectionMatrix={elements:C.identity()};
  const viewer={scene:{scene:root,pointclouds:[pc],getActiveCamera:()=>camera}};
  return {viewer,left,right,origin};
}
function railState(r){const profile=r.children[1];return {object:r,profile,railMatrix:C.worldMatrix(r),profileMatrix:C.worldMatrix(profile),
  rotation:C.rotation(r),profileRotation:C.rotation(profile)};}
function busy(ms){if(ms<=0)return;const end=process.hrtime.bigint()+BigInt(Math.round(ms*1e6));while(process.hrtime.bigint()<end);}

/* Profils de lecture. `ancien` reproduit les réglages 4.7.1 de l'adaptateur ;
 * `nouveau` ceux de la 4.7.2. Seuls le rythme des pauses et le coût modélisé
 * d'une pause diffèrent : la scène, les critères et les bornes sont identiques. */
const PROFILES={
  ancien:{yieldEvery:2048,sliceMs:null,yieldMs:16,guardMs:2},
  nouveau:{yieldEvery:65536,sliceMs:5,yieldMs:8,guardMs:.3},
};
async function runOnce(N,profile,scn){
  let simulated=0;const t0=performance.now(),clock=()=>performance.now()-t0+simulated;
  const firstQualified={left:null,right:null};let pauses=0,guards=0;
  const result=await N.capture({viewer:scn.viewer,rails:{left:railState(scn.left),right:railState(scn.right)},origin:scn.origin,enums:{ClipTask:{NONE:0,HIGHLIGHT:1,SHOW_INSIDE:2,SHOW_OUTSIDE:3},ClipMethod:{INSIDE_ANY:0,INSIDE_ALL:1}},
    maxNodes:512,maxPointsPerRail:50000,maxInspected:500000,maxMillis:1800,yieldEvery:profile.yieldEvery,probeCount:33,checkpointPoints:2048,
    ...(profile.sliceMs?{sliceMs:profile.sliceMs,sliceClock:clock}:{}),
    now:clock,pause:async()=>{pauses++;simulated+=profile.yieldMs;},guard:()=>{guards++;busy(profile.guardMs);},
    captureId:'bench',visitId:'bench',meta:{identity:{pageId:'bench',part:1,cut:1,shape:'U50',frameId:'bench',projectId:null}},
    onCheckpoint:async chunk=>{if(chunk.qualification?.status==='qualified-candidate'&&firstQualified[chunk.side]===null)firstQualified[chunk.side]=clock();return {storageConfirmedAt:new Date().toISOString()};}});
  return {durationMs:clock(),firstQualifiedMs:firstQualified,pauses,guards,pointsRead:result.trace.pointsRead,
    pointsAvailable:result.trace.pointsAvailableInBuffers,status:result.status,termination:result.termination?.code||null,
    retained:{left:result.railObservations.left.pointsRetained,right:result.railObservations.right.pointsRetained},
    qualified:{left:result.railObservations.left.coverage.status,right:result.railObservations.right.coverage.status}};
}
async function run(){
  const modulePath=path.resolve(arg('--module',path.join(__dirname,'../src/native-lidar.js')));
  const N=require(modulePath);const out=arg('--json',null);
  const names=arg('--profile',null)?[arg('--profile')]:Object.keys(PROFILES);
  const scn=scene();const rows={};
  for(const name of names){
    const profile={...PROFILES[name]};
    if(arg('--yield-ms',null))profile.yieldMs=Number(arg('--yield-ms'));
    if(arg('--guard-ms',null))profile.guardMs=Number(arg('--guard-ms'));
    rows[name]={profile,...await runOnce(N,profile,scn)};
  }
  const f=v=>v===null?'—':v.toFixed(0);
  console.log('════ BANC DU LECTEUR NATIF ════');
  console.log(`module ${path.relative(process.cwd(),modulePath)} · scène : ${rows[names[0]].pointsAvailable} points en mémoire, 20 nœuds`);
  console.log('horloge simulée : coût CPU réel + pauses et gardes modélisées (voir --yield-ms, --guard-ms)');
  for(const [name,r] of Object.entries(rows)){
    console.log(`\n${name.padEnd(8)} pause ${r.profile.yieldMs} ms · garde ${r.profile.guardMs} ms · ${r.profile.sliceMs?'tranche '+r.profile.sliceMs+' ms':'pause tous les '+r.profile.yieldEvery+' points'}`);
    console.log(`  1er instantané qualifié  gauche ${f(r.firstQualifiedMs.left)} ms · droit ${f(r.firstQualifiedMs.right)} ms`);
    console.log(`  capture complète         ${f(r.durationMs)} ms · ${r.pointsRead} points lus sur ${r.pointsAvailable} · ${r.pauses} pauses · ${r.guards} gardes`);
    console.log(`  fin                      ${r.status}${r.termination?' ('+r.termination+')':''} · retenus G ${r.retained.left} D ${r.retained.right}`);
  }
  if(out)fs.writeFileSync(out,JSON.stringify({format:'banane-native-capture-bench-v1',rows},null,1)+'\n');
  return rows;
}
if(require.main===module)run().catch(e=>{console.error(e);process.exit(1);});
module.exports={scene,runOnce,PROFILES,railState};
