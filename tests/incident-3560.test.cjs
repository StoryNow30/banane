/* INCIDENT TERRAIN — partie 9, cut 3560, 21/09/2026.
 *
 * L'apply a été refusé par « Position proposée hors de la vue : left » alors que
 * la proposition GCV1 était applicable. Cause : `select()` n'attendait qu'une
 * caméra IMMOBILE, jamais le rail DEMANDÉ revenu dans la vue. ESV recentre sa
 * vue orthographique de façon asynchrone, donc « inchangée » se lit comme « pas
 * encore partie » : la main était rendue avec la caméra du rail précédent.
 *
 * Ce harnais reproduit les trois grandeurs relevées dans le bilan V4 et le
 * diagnostic GCV1 du lot, que `tests/helpers/page.cjs` ne modélise pas (il
 * déplace la caméra SYNCHRONEMENT dans `click()` et projette en identité) :
 *   1. la projection orthographique réelle d'ESV — demi-largeur 0,2 unité ;
 *   2. l'entraxe réel des rails — 1,50 unité, soit 3,75 fois la largeur de vue ;
 *   3. le recentrage RETARDÉ de la caméra après le clic de sélection.
 * Sur les 66 vues capturées du lot, le rail sélectionné projette à ndc ≈ 0 et
 * l'autre à |ndc| ≈ 7,5 : les deux rails ne peuvent jamais coexister dans la vue.
 *
 * `BANANE_ADAPTER_3560` permet de rejouer ces mêmes scénarios contre un autre
 * fichier adaptateur, pour vérifier que la reproduction est bien rouge avant
 * correctif. Par défaut, l'adaptateur du dépôt est utilisé. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('../vendor/capture-core.js'),K=require('../src/core.js'),F=require('./v242/fixtures.cjs');

const ADAPTER=process.env.BANANE_ADAPTER_3560||path.join(__dirname,'../src/adapter-page.js');
/* Relevés du cut 3560 : matrice de projection d'ESV, entraxe, recul axial de la
 * caméra (0,2000 unité, constant sur les 66 vues du lot). */
const ESV_PROJECTION=[4.999999999175515,0,0,0, 0,4.945397815097155,0,0, 0,0,-9.999742361984585e-05,0, 0,0,0,1];
const GAUGE=1.5,VIEW_BACK=.2;
const PROPOSALS={left:{delta:[0,-.039594,.004]},right:{delta:[0,.021,.004]}};

/* Regard le long de l'axe du rail : droite écran = -Y monde, haut = +Z monde. */
const cameraAt=p=>[0,-1,0,0, 0,0,1,0, -1,0,0,0, p[0]-VIEW_BACK,p[1],p[2],1];

function esv({migrationPolls=0}={}){
 const left=F.rail(0,[0,0,0],0),right=F.rail(GAUGE,[0,0,0],0);
 right.children[1].children[0].geometry.attributes.position=F.buffer([[0,0,0],[0,-.035,0],[0,-.035,-.05]]);
 const root=F.object([0,0,0],'Scene');F.add(root,left);F.add(root,right);
 const camera=F.object([0,0,0],'OrthographicCamera');
 camera.matrixWorldAutoUpdate=false;camera.projectionMatrix={elements:ESV_PROJECTION};
 const railPosition=side=>{const o=side==='left'?left:right;return [o.position.x,o.position.y,o.position.z];};
 /* La capture parcourt gauche puis droite : l'apply commence donc toujours avec
  * la caméra sur le rail DROIT, et exige une migration de 1,50 unité. */
 let camSide='right',pending=null,remaining=0;
 const place=side=>{camera.matrixWorld={elements:cameraAt(railPosition(side))};};
 place(camSide);
 const canvasClicks=[],validateClicks=[],keyboard=[];let clock=0,listener;
 const nodes=new Map(),responses=new Map(),progress=[];
 const viewport={left:0,top:0,width:640,height:640};
 const canvas={getBoundingClientRect:()=>({...viewport}),dispatchEvent:e=>{
  /* Le clic agit sur le rail que la vue montre, pas sur celui qu'on visait. */
  const ndc=[(e.clientX-viewport.left)/(viewport.width/2)-1,1-(e.clientY-viewport.top)/(viewport.height/2)];
  const world=C.point(C.worldMatrix(camera),[ndc[0]/ESV_PROJECTION[0],ndc[1]/ESV_PROJECTION[5],-VIEW_BACK]);
  const rail=camSide==='left'?left:right;[rail.position.x,rail.position.y,rail.position.z]=world;
  canvasClicks.push({side:camSide,world});place(camSide);
 }};
 for(const [id,text] of [['O2N3DCutDescription','Cut 3560 of part 9'],['O2N3DCutShapeInfo','U50']])nodes.set(id,{textContent:text});
 for(const [id,side] of [['O2N3DCutLRClick','left'],['O2N3DCutRRClick','right']])
  /* ESV accuse le clic immédiatement mais ne recentre qu'après `migrationPolls`
   * sondages. `Infinity` modélise une vue qui ne se recentre jamais. */
  nodes.set(id,{click(){if(side===camSide){pending=null;return;}pending=side;remaining=migrationPolls;}});
 nodes.set('O2N3DCutValidate3DRail',{title:'Press ↵ to validate both rails',click(){validateClicks.push(true);}});
 nodes.set('O2N3DCutNextInvalid3DRail',{click(){nodes.get('O2N3DCutDescription').textContent='Cut 3561 of part 9';}});
 const ctx={console,window:null,location:{origin:'https://esv.lidar.altametris.xyz'},
  document:{getElementById:id=>nodes.get(id),dispatchEvent:e=>{keyboard.push(e);return true;}},
  BananeCaptureCore:C,BananeCore3:K,BananeSettings:require('../src/settings.js'),
  BananeLodSignature:require('../src/lod-signature.js'),BananeLidar:{...require('../vendor/lidar.js')},
  BananeNativeLidar4:require('../src/native-lidar.js'),BananeMerge3:require('../src/merge-clouds.js'),
  viewer:{scene:{scene:root,pointclouds:[],getActiveCamera:()=>camera},renderer:{domElement:canvas}},
  Date:class extends Date{static now(){return clock;}},
  setTimeout:(fn,ms=0)=>{clock+=ms;queueMicrotask(()=>{
    if(pending&&remaining--<=0){camSide=pending;pending=null;place(camSide);}
    fn();});},
  MouseEvent:class{constructor(type,args){this.type=type;Object.assign(this,args);}},
  KeyboardEvent:class{constructor(type,args){this.type=type;Object.assign(this,args);}},
  addEventListener:(event,fn)=>listener=fn,
  postMessage:m=>{if(m.kind==='banane3:progress')progress.push(m);else responses.get(m.id)(m);},
  crypto:{randomUUID:K.uid}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(ADAPTER,'utf8'),ctx);
 const call=(action,...args)=>{const id=K.uid();return new Promise((resolve,reject)=>{
   responses.set(id,m=>m.error?reject(Error(m.error)):resolve(m.result));
   listener({source:vm.runInContext('window',ctx),origin:ctx.location.origin,
     data:{kind:'banane3:command',channel:'fixture',id,action,args}});});};
 return {call,canvasClicks,validateClicks,keyboard,left,right,camera,
   camSide:()=>camSide,ndcOf:p=>C.point(C.multiply(C.matrix(camera.projectionMatrix),
     C.inverse(C.rebase(C.worldMatrix(camera),railPosition('left')))),p)};
}

test('3560 : le harnais reproduit les grandeurs terrain — vue 0,4 u, entraxe 1,50 u, rail opposé hors vue', async()=>{
 const f=esv(),before=await f.call('state');
 assert.ok(Math.abs(1/ESV_PROJECTION[0]-.2)<1e-9,'demi-largeur de vue relevée');
 const l=before.rails.left.positionSceneRelative,r=before.rails.right.positionSceneRelative;
 assert.ok(Math.abs(C.distance(l,r)-GAUGE)<1e-9,'entraxe terrain');
 /* Caméra sur le rail droit à l'entrée de l'apply, comme après la capture. */
 assert.equal(f.camSide(),'right');
 const opposite=f.ndcOf(l);
 assert.ok(Math.abs(opposite[0])>7,`le rail non sélectionné doit projeter loin hors vue, vu ${opposite[0]}`);
 assert.ok(Math.abs(f.ndcOf(r)[0])<=1e-9,'le rail sélectionné projette au centre');
});

test('3560 : caméra retardée — la proposition exacte est appliquée, aucune décision émise', async()=>{
 const f=esv({migrationPolls:5}),before=await f.call('state');
 const result=await f.call('apply',before,PROPOSALS);
 const expected=K.expectedPoses(before,PROPOSALS);
 assert.ok(K.equalPoses(result.rails,expected,1e-9),'la pose appliquée est exactement celle décidée par le runtime');
 for(const side of ['left','right'])
  assert.ok(C.distance(result.rails[side].positionSceneRelative,expected[side].positionSceneRelative)<1e-9,side);
 /* Un clic par rail, sur le bon rail, et aucune décision. */
 assert.equal(f.canvasClicks.length,2);
 assert.deepEqual(f.canvasClicks.map(c=>c.side),['left','right']);
 assert.equal(f.validateClicks.length,0,'aucun VALIDATE');
 assert.equal(f.keyboard.length,0,'aucun SKIP');
});

test('3560 : la caméra ne se recentre jamais — refus, zéro clic rail, zéro VALIDATE, zéro SKIP', async()=>{
 const f=esv({migrationPolls:Infinity}),before=await f.call('state');
 await assert.rejects(f.call('apply',before,PROPOSALS),/Vue ESV non recentrée sur le rail left\./);
 assert.equal(f.canvasClicks.length,0,'aucun clic rail émis');
 assert.equal(f.validateClicks.length,0,'aucun VALIDATE');
 assert.equal(f.keyboard.length,0,'aucun SKIP');
 /* Les rails restent à leur pose d'origine : rien n'a été appliqué. */
 const after=await f.call('state');
 assert.ok(K.equalPoses(after.rails,before.rails,1e-12),'aucun rail déplacé');
});

test('3560 : une caméra immobile sur le mauvais rail ne déclare pas la sélection réussie', async()=>{
 /* La caméra est parfaitement stable pendant tout le délai de migration : c'est
  * exactement ce que l'ancien prédicat prenait pour une sélection réussie. */
 const f=esv({migrationPolls:40}),before=await f.call('state');
 assert.equal(f.camSide(),'right');
 const result=await f.call('apply',before,PROPOSALS);
 assert.ok(K.equalPoses(result.rails,K.expectedPoses(before,PROPOSALS),1e-9));
 /* Aucun clic n'a pu partir avant que la vue ne montre réellement le rail visé. */
 assert.deepEqual(f.canvasClicks.map(c=>c.side),['left','right']);
});

test('3560 : un refus légitime expose repère, source, cible, centre de vue, ndc et bornes', async()=>{
 /* Cible délibérément hors de la vue sur un rail correctement sélectionné :
  * le garde d'émission doit rester, et son refus doit être explicable seul. */
 const g=esv({migrationPolls:0}),b=await g.call('state');
 const outside={left:{delta:[0,-5,0]},right:PROPOSALS.right};
 await assert.rejects(g.call('apply',b,outside),e=>{
   assert.match(e.message,/^Position proposée hors de la vue : left /);
   assert.match(e.message,/repère=scene-relative frameId=/);
   assert.match(e.message,/source=\(/);assert.match(e.message,/cible=\(/);
   assert.match(e.message,/centre de vue=\(/);assert.match(e.message,/ndc=\(/);
   assert.match(e.message,/bornes=\[-1,1\] par composante/);
   assert.match(e.message,/viewport=640\.0x640\.0px/);
   assert.match(e.message,/raison=hors bornes : x/);
   return true;});
 assert.equal(g.canvasClicks.length,0,'aucun clic sur un refus légitime');
 assert.equal(g.validateClicks.length,0);assert.equal(g.keyboard.length,0);
});
