'use strict';
/* D-344 (opérateur, 11/11) : « La caméra a changé pendant l'export » n'arrête plus le lot. Partie 20, cut 89 : la vue a bougé
 * légèrement pendant la lecture des points, le lot est passé en ERREUR et la Constellation s'est arrêtée. Désormais la page
 * relit la vue (la lecture ratée est jetée en entier) ; si toutes les tentatives échouent, le lot se met en pause reprenable.
 * Le changement de découpe du nuage, de cut ou de rail reste fatal. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs'),F=require('./v242/fixtures.cjs');
const {Engine}=require('../src/engine.js'),{MemoryStore,SimulatedESV,K}=require('./fixtures.cjs');
const CAMERA="La caméra a changé pendant l'export. Garde la vue immobile et réessaie.";
const DECOUPE="La découpe du nuage a changé pendant l'export. Recommence lorsque la vue est stable.";
function points(rows){const n=F.object([0,0,0],'Points');n.geometry={attributes:{position:F.buffer(rows)}};return {sceneNode:n};}
function lidarPage(){const f=page(),pc=F.object([0,0,0],'PointCloudOctree');
 pc.material={clipBoxes:[],clipTask:0,clipMethod:0};pc.visibleNodes=[points([[0,.01,.01],[0,1.425,.01]])];
 f.ctx.viewer.scene.pointclouds=[pc];f.ctx.Potree=F.enums;return {...f,pc};}
test('core : le changement de caméra est passager ; la découpe et les autres verdicts ne changent pas',()=>{
 assert.equal(K.transientCaptureError(CAMERA),true);assert.equal(K.transientCaptureError(Error(CAMERA)),true);
 for(const m of [DECOUPE,'Cible différente : cut','Action interrompue.','La caméra a changé.',''])assert.equal(K.transientCaptureError(m),false,m);});
test('page : caméra changée à la première lecture → la vue est relue, seule la lecture réussie est gardée',async()=>{
 const f=lidarPage(),before=await f.call('state'),vraie=f.ctx.BananeLidar.capture;let lectures=0;
 f.ctx.BananeLidar.capture=async(...a)=>{lectures++;if(lectures===1)throw Error(CAMERA);return vraie(...a);};
 const data=await f.call('capture',before);
 assert.ok(lectures>=2,'relue : '+lectures);
 assert.ok(f.progress.some(p=>p.stage==='capture-retry'&&p.detail.message===CAMERA),'tentative jetée et relue');
 assert.ok(data.readStrategy.attempts.some(a=>a.status==='discarded'&&a.message===CAMERA));});
test('page : la découpe changée reste fatale (une seule lecture)',async()=>{
 const f=lidarPage(),before=await f.call('state');let lectures=0;
 f.ctx.BananeLidar.capture=async()=>{lectures++;throw Error(DECOUPE);};
 await assert.rejects(()=>f.call('capture',before),e=>e.message===DECOUPE);assert.equal(lectures,1);});
test('moteur : caméra changée jusqu\'au bout → lot en PAUSE reprenable (pas ERREUR), rien d\'envoyé, Reprendre finit le lot sans SKIP',async()=>{
 const adapter=new SimulatedESV(),store=new MemoryStore(),e=new Engine(adapter,store);await e.init();e.s.mode='automatic-test';
 const capture=adapter.capture.bind(adapter);let panne=true;
 adapter.capture=async(...a)=>{if(adapter.identity.cut===101&&panne){panne=false;throw Error(CAMERA);}return capture(...a);};
 await e.startBatch({part:23,start:100,end:102,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});await e.task;
 assert.equal(e.s.batch.state,'PAUSED',e.s.batch.error?.message);assert.equal(e.s.batch.error.retryableCapture,true);
 assert.deepEqual(adapter.calls,['capture','apply','validate','next'],'rien d\'envoyé sur le cut en pause');
 await e.resume();await e.task;
 assert.deepEqual(e.s.batch.processed.map(x=>x.cut),[100,101,102],e.s.batch.error?.message);
 assert.equal(adapter.calls.includes('skip'),false);});
