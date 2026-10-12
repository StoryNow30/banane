'use strict';
/* V3, expérience I1 (D-087) : l'outil `tools/perf-v3.cjs` sépare un lot selon le mode de lecture tiré pour chaque cut.
 * Le tirage de l'outil doit être celui de la page (sinon la comparaison mélange les modes), le mode consigné par la
 * page doit primer, et un désaccord doit se voir. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../tools/perf-v3.cjs'),{journal,id}=require('./helpers/perf-phases.cjs');
const {page}=require('./helpers/page.cjs'),F=require('./v242/fixtures.cjs'),L=require('../vendor/lidar.js');

function deuxVisites(){const j=journal(),v1=j.events.filter(e=>e.visitId==='visit'),fin=j.events.filter(e=>e.kind==='batch'&&e.point==='end'||e.kind==='health');
 const d=2000,v2=v1.map(e=>{const c={...e,eventId:'2'+e.eventId,visitId:'visit2',identity:id(101),ms:e.ms+d};
  if(Number.isFinite(c.fromMs)){c.fromMs+=d;c.toMs+=d;}if(c.kind==='visit')c.navigationMs=d;return c;});
 for(const e of fin)e.ms+=d;for(const h of fin.filter(e=>e.kind==='health'))h.visits=2;
 j.events.find(e=>e.point==='next-observed'&&e.visitId==='visit').nextIdentity=id(101);
 j.events=[...j.events.filter(e=>!fin.includes(e)),...v2,...fin];j.events.forEach((e,i)=>{e.batchSeq=i+1;e.seq=i+1;});
 j.state.batch.sequence=[{identity:id(100)},{identity:id(101)}];return j;}
/* Une capture : deux rails, stabilité 800 ms, lecture `lu` ms par rail. */
function capture(requestId,cut,lecture,lu,t0){const ev=[],at=(stage,elapsedMs,lastDetail)=>ev.push({type:'adapter-progress',timestamp:new Date(t0+elapsedMs).toISOString(),
  identity:id(cut),requestId,action:'capture',elapsedMs,acknowledged:true,lastStage:stage,lastDetail});
 let t=0;for(const side of ['left','right']){t+=300;at('capture-wait',t,{side,attempt:1,maxAttemptsPerView:3});t+=800;at('capture-read',t,{side,attempt:1,lecture});
  t+=lu;at('capture-view-ready',t,{side,attempt:1,points:500});}
 t+=10;at('capture-ready',t,{attempts:2,points:1000,nodes:3,compacted:0,bytes:1,lecture});
 ev.push({type:'adapter-result',timestamp:new Date(t0+t).toISOString(),identity:id(cut),requestId,action:'capture',elapsedMs:t,acknowledged:true,lastStage:'capture-ready',error:null});
 return ev;}

test('le tirage de l\'outil est celui de la page, cut par cut',async()=>{
 const S=require('../src/settings.js');
 for(let cut=100;cut<108;cut++){
   const f=page(),pc=F.object([0,0,0],'PointCloudOctree');const n=F.object([0,0,0],'Points');n.geometry={attributes:{position:F.buffer([[0,.01,.01],[0,1.425,.01]])}};
   pc.material={clipBoxes:[],clipTask:0,clipMethod:0};pc.visibleNodes=[{sceneNode:n}];f.ctx.viewer.scene.pointclouds=[pc];f.ctx.Potree=F.enums;
   f.nodes.get('O2N3DCutDescription').textContent=`Cut ${cut} of part 23`;f.ctx.BananeLidar.capture=opts=>L.capture(opts);
   const out=await f.call('capture',await f.call('state'));
   assert.equal(out.readStrategy.lecture,T.tirage(cut),`cut ${cut}`);assert.equal(out.readStrategy.regleLecture,S.pilote.lectureI1);
 }
});

test('deux cuts, un par mode : visites, étapes par rail et contrôle du tirage',()=>{
 const j=deuxVisites();j.events.push(...capture('r1',100,'rapide',300,Date.UTC(2026,9,13,8)),...capture('r2',101,'reference',900,Date.UTC(2026,9,13,8,1)));
 const r=T.comparer(j);
 assert.equal(T.tirage(100),'rapide');assert.equal(T.tirage(101),'reference');
 assert.equal(r.bras.rapide.visites,1);assert.equal(r.bras.reference.visites,1);
 assert.equal(r.bras.rapide.lectureParRailMs,300);assert.equal(r.bras.reference.lectureParRailMs,900);
 assert.equal(r.bras.rapide.stabiliteParRailMs,800);assert.equal(r.bras.rapide.selectionParRailMs,300);
 assert.equal(r.bras.rapide.captures,1);assert.equal(r.bras.reference.captureMedianeMs,2*(300+800+900)+10);
 assert.equal(r.bras.rapide.partPosee,1);assert.equal(r.ecart.cycleMs,0);
 assert.deepEqual(r.controle,{capturesSansMode:0,desaccords:0,modesVus:['rapide','reference']});
 const md=T.toMarkdown(r);assert.match(md,/Lecture par rail \(médiane \/ P90\) \| 0,90 s \/ 0,90 s \| 0,30 s \/ 0,30 s/);
 assert.match(md,/Écart du cycle médian \(rapide − référence\) : 0,00 s/);assert.match(md,/0 capture\(s\) dont le mode consigné diffère du tirage/);
});

test('mode consigné contraire au tirage : la capture suit le mode consigné et le désaccord est compté',()=>{
 const j=deuxVisites();j.events.push(...capture('r1',100,'reference',300,Date.UTC(2026,9,13,8)));
 const r=T.comparer(j);assert.equal(r.controle.desaccords,1);assert.equal(r.bras.reference.captures,1);assert.equal(r.bras.rapide.captures,0);
});

test('export d\'avant la 4.9.0.6 (aucun mode consigné) : mode recalculé par le tirage, et dit',()=>{
 const j=deuxVisites();const ev=capture('r1',100,undefined,300,Date.UTC(2026,9,13,8));for(const e of ev)if(e.lastDetail)delete e.lastDetail.lecture;j.events.push(...ev);
 const r=T.comparer(j);assert.equal(r.controle.capturesSansMode,1);assert.equal(r.bras.rapide.captures,1);
 assert.match(T.toMarkdown(r),/mode recalculé par le tirage/);
});

test('intervalle de l\'écart : reproductible, absent sous deux valeurs',()=>{
 const a=[7000,7100,7200,7300,7400,7500],b=[6000,6100,6200,6300,6400,6500];
 assert.deepEqual(T.intervalle(a,b),T.intervalle(a,b));const i=T.intervalle(a,b);assert.ok(i.bas<-1000&&i.haut>-1000&&i.haut<0);
 assert.equal(T.intervalle([1],b),null);assert.equal(T.BRUIT_AA_PCT,7);
});
