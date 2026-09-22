'use strict';
/* 4.7.2 — la lecture native survit à un mouvement de caméra, pas à un
 * changement de cut ni de rail.
 *
 * Lot 3 du 22/09 : 378 captures sur 491 arrêtées par la caméra ; sur 89
 * visites, le budget de captures était épuisé par ces arrêts avant qu'une
 * seule lecture aboutisse. Un point lu ne dépend pas de la caméra : il vient
 * d'un buffer et d'une matrice de nœud revérifiés à chaque pause. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('../vendor/capture-core.js'),K=require('../src/core.js'),F=require('./v242/fixtures.cjs');

function page(){
  const left=F.rail(0,[0,0,0],0),right=F.rail(1.435,[0,0,0],0);
  right.children[1].children[0].geometry.attributes.position=F.buffer([[0,0,0],[0,-.035,0],[0,-.035,-.05]]);
  const root=F.object([0,0,0],'Scene');F.add(root,left);F.add(root,right);
  const camera=F.object([.2,0,3],'OrthographicCamera');camera.projectionMatrix={elements:C.identity()};
  const rows=[];for(let i=0;i<4000;i++){const x=-.49+.98*(i%400)/399;rows.push([x,.03,.02],[x,1.405,.02],[x+3,5,5]);}
  const mesh=F.object([0,0,0],'Points');mesh.isPoints=true;mesh.geometry={attributes:{position:F.buffer(rows)},drawRange:{start:0,count:Infinity}};
  const pc=F.object([0,0,0],'PointCloudOctree');pc.visibleNodes=[{sceneNode:mesh}];pc.material={clipBoxes:[],clipTask:0,clipMethod:0};
  const nodes=new Map([['O2N3DCutDescription',{textContent:'Cut 100 of part 23'}],['O2N3DCutShapeInfo',{textContent:'U50'}]]);
  let listener;const responses=new Map(),observers=[];
  const ctx={console,window:null,location:{origin:'https://esv.lidar.altametris.xyz'},document:{getElementById:id=>nodes.get(id)},
    BananeCaptureCore:C,BananeCore3:K,BananeSettings:require('../src/settings.js'),BananeLodSignature:require('../src/lod-signature.js'),
    BananeLidar:{...require('../vendor/lidar.js')},BananeNativeLidar4:require('../src/native-lidar.js'),BananeMerge3:require('../src/merge-clouds.js'),
    Potree:F.enums,viewer:{scene:{scene:root,pointclouds:[pc],getActiveCamera:()=>camera},renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})}}},
    MutationObserver:class{constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(node,options){this.node=node;this.options=options;}disconnect(){this.disconnected=true;}},
    setTimeout:(fn)=>queueMicrotask(fn),addEventListener:(event,fn)=>listener=fn,removeEventListener:()=>{},postMessage:m=>{if(m.kind==='banane3:result')responses.get(m.id)?.(m);},crypto:{randomUUID:K.uid}};
  ctx.window=ctx;vm.createContext(ctx);
  /* Accès d'essai aux fonctions internes, injecté ici et jamais livré. */
  const source=fs.readFileSync(path.join(__dirname,'../src/adapter-page.js'),'utf8').replace(/\}\)\(\);\s*$/,
    ';globalThis.__nativeTest={nativeCapture,nativeGuardState,nativeSnapshot,nativeApi};})();');
  vm.runInContext(source,ctx);
  return {ctx,camera,left,right,nodes,observers,api:ctx.__nativeTest};
}
async function capture(f,onCheckpoint){
  const expected=f.api.nativeSnapshot();
  return f.api.nativeCapture(expected,()=>true,{captureId:K.uid(),visitId:'visit',onCheckpoint:async chunk=>{await onCheckpoint?.(chunk);return {storageConfirmedAt:new Date().toISOString()};}});
}

test('un mouvement de caméra pendant la lecture ne l’interrompt plus et reste consigné',async()=>{
  const f=page();let moved=false;
  const data=await capture(f,()=>{if(!moved){moved=true;f.camera.position.x+=2;f.camera.position.z+=1;}});
  assert.ok(moved,'le checkpoint a eu lieu en cours de lecture');
  assert.equal(data.termination,null);assert.equal(data.status,'complete-loaded-buffers');
  assert.equal(data.railObservations.left.coverage.status,'qualified-candidate');
  assert.equal(data.railObservations.right.coverage.status,'qualified-candidate');
  assert.equal(data.readStrategy.cameraMoveTerminatesRead,false);assert.equal(data.readStrategy.cameraMovedDuringRead,true);
  assert.equal(data.readStrategy.pacing,'time-slices');assert.equal(data.readStrategy.guard,'identity-and-rail-pose');
});

test('sans mouvement de caméra, l’export le dit aussi',async()=>{
  const f=page(),data=await capture(f);
  assert.equal(data.readStrategy.cameraMovedDuringRead,false);assert.equal(data.termination,null);
});

test('un changement de cut pendant la lecture l’interrompt toujours',async()=>{
  const f=page();
  const data=await capture(f,()=>{f.nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';});
  assert.equal(data.termination.code,'TARGET_CHANGED');assert.match(data.status,/^partial-interrupted/);
});

test('un déplacement de rail pendant la lecture l’interrompt toujours',async()=>{
  const f=page();
  const data=await capture(f,()=>{f.left.position.y+=.01;});
  assert.equal(data.termination.code,'RAIL_STATE_CHANGED');
});

test('la garde ne lit que l’identité et les rails, sans inventaire des nœuds',()=>{
  const f=page();let inventories=0;const original=f.ctx.BananeLidar.inventory;
  f.ctx.BananeLidar.inventory=(...args)=>{inventories++;return original(...args);};
  const state=f.api.nativeGuardState();
  assert.equal(inventories,0);assert.equal(state.identity.cut,100);assert.ok(state.rails.left&&state.rails.right);
});

test('l’étiquette du cut est observée et seul un texte différent déclenche l’observation',()=>{
  const f=page(),api=f.api.nativeApi();let calls=0;
  assert.equal(api.watch(()=>calls++),true);const observer=f.observers[0];
  assert.equal(observer.node,f.nodes.get('O2N3DCutDescription'));
  observer.callback();assert.equal(calls,0,'réécriture à l’identique : rien');
  f.nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';observer.callback();assert.equal(calls,1);
  observer.callback();assert.equal(calls,1);
  api.uninstall();assert.equal(observer.disconnected,true);
});
