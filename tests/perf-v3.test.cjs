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

test('le tirage de l\'outil est celui de la page, cut par cut, pour chaque règle',async()=>{
 const S=require('../src/settings.js');
 for(const regle of [undefined,'tirage','echantillon','toujours','reference'])for(let cut=100;cut<108;cut++){
   const f=page(regle?{globals:{BananeSettings:{...S,pilote:{...S.pilote,modeRapide:regle}}}}:undefined),pc=F.object([0,0,0],'PointCloudOctree');const n=F.object([0,0,0],'Points');n.geometry={attributes:{position:F.buffer([[0,.01,.01],[0,1.425,.01]])}};
   pc.material={clipBoxes:[],clipTask:0,clipMethod:0};pc.visibleNodes=[{sceneNode:n}];f.ctx.viewer.scene.pointclouds=[pc];f.ctx.Potree=F.enums;
   f.nodes.get('O2N3DCutDescription').textContent=`Cut ${cut} of part 23`;f.ctx.BananeLidar.capture=opts=>L.capture(opts);
   const out=await f.call('capture',await f.call('state'));
   const r=regle??S.pilote.modeRapide;assert.equal(out.readStrategy.lecture,T.REGLES[r](cut),`${r} / cut ${cut}`);assert.equal(out.readStrategy.regleLecture,r);
   assert.equal(f.progress.find(p=>p.stage==='capture-ready').detail.regleLecture,r,'règle consignée dans le journal');
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
 assert.deepEqual(r.controle,{capturesSansMode:0,desaccords:0,modesVus:['rapide','reference'],regle:'tirage',regleConsignee:false,reglesVues:[],etapesDateesParLaPage:0});
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

test('4.9.0.7 : vues lues au signal ou à la règle des 800 ms, poses retombées sur le recentrage, pose médiane, par mode',()=>{
 const j=deuxVisites(),r1=capture('r1',100,'rapide',300,Date.UTC(2026,9,13,8)),r2=capture('r2',101,'reference',900,Date.UTC(2026,9,13,8,1));
 for(const e of r1)if(e.lastStage==='capture-read')e.lastDetail.regle=e.lastDetail.side==='left'?'signal':'stabilite';
 for(const e of r2)if(e.lastStage==='capture-read')e.lastDetail.regle='stabilite';
 j.events.push(...r1,...r2,{type:'adapter-progress',timestamp:new Date(Date.UTC(2026,9,13,8,0,30)).toISOString(),identity:id(100),requestId:'a1',action:'apply',elapsedMs:2,lastStage:'apply-repli',lastDetail:{side:'right'}});
 const r=T.comparer(j);
 assert.deepEqual([r.bras.rapide.vuesAuSignal,r.bras.rapide.vuesALaStabilite,r.bras.reference.vuesAuSignal,r.bras.reference.vuesALaStabilite],[1,1,0,2]);
 assert.deepEqual([r.bras.rapide.posesReplis,r.bras.reference.posesReplis],[1,0]);
 assert.ok(Number.isFinite(r.bras.rapide.poseMedianeMs)&&Number.isFinite(r.bras.reference.poseMedianeMs));
 const md=T.toMarkdown(r);assert.match(md,/Vues lues au signal \/ à la règle des 800 ms \| 0 \/ 2 \| 1 \/ 1 \|/);assert.match(md,/Poses retombées sur le recentrage \| 0 \| 1 \|/);
});

/* D-091 (4.9.0.9) : règle consignée par la page, étapes datées par la page. */
test('4.9.0.9 : règle « echantillon » consignée : les cuts 100 et 101 sont rapides, aucun désaccord, et dit',()=>{
 const j=deuxVisites(),c1=capture('r1',100,'rapide',300,Date.UTC(2026,9,13,8)),c2=capture('r2',101,'rapide',300,Date.UTC(2026,9,13,8,1));
 for(const e of [...c1,...c2])if(e.lastStage==='capture-ready'&&e.lastDetail)e.lastDetail.regleLecture='echantillon';j.events.push(...c1,...c2);
 const r=T.comparer(j);assert.equal(r.controle.regle,'echantillon');assert.equal(r.controle.regleConsignee,true);assert.equal(r.controle.desaccords,0);
 assert.equal(r.bras.rapide.visites,2);assert.equal(r.bras.reference.visites,0);assert.match(T.toMarkdown(r),/« echantillon » \(un cut sur dix en référence\), consignée par la page/);
 // La même capture lue avec le tirage de la 4.9.0.7 : le cut 101 serait compté en désaccord.
 for(const e of [...c1,...c2])if(e.lastStage==='capture-ready'&&e.lastDetail)delete e.lastDetail.regleLecture;
 assert.equal(T.comparer(j).controle.desaccords,1);
});

test('4.9.0.9 : deux règles consignées dans un lot : la plus fréquente, et l’alerte ; règle inconnue : refusée',()=>{
 const j=deuxVisites(),c1=capture('r1',100,'rapide',300,Date.UTC(2026,9,13,8)),c2=capture('r2',101,'rapide',300,Date.UTC(2026,9,13,8,1)),c3=capture('r3',101,'rapide',300,Date.UTC(2026,9,13,8,2));
 const regle=(ev,nom)=>{for(const e of ev)if(e.lastStage==='capture-ready'&&e.lastDetail)e.lastDetail.regleLecture=nom;};
 regle(c1,'echantillon');regle(c2,'echantillon');regle(c3,'tirage');j.events.push(...c1,...c2,...c3);
 const r=T.comparer(j);assert.equal(r.controle.regle,'echantillon');assert.deepEqual(r.controle.reglesVues.sort(),['echantillon','tirage']);
 assert.match(T.toMarkdown(r),/ATTENTION, plusieurs règles consignées/);
 regle(c1,'inventee');regle(c2,'inventee');assert.throws(()=>T.comparer(j),/Règle de tirage inconnue de l'outil : inventee/);
});

test('4.9.0.9 : étapes datées par la page : la lecture par rail est mesurée même si le pont reçoit tout d’un coup',()=>{
 const j=deuxVisites(),c=capture('r1',100,'rapide',300,Date.UTC(2026,9,13,8));
 // Le pont reçoit la lecture et la fin de vue en même temps (mode rapide) ; la page, elle, a daté chaque étape.
 for(const e of c)if(e.lastDetail){e.lastDetail.pageMs=e.elapsedMs-5;if(e.lastStage==='capture-read')e.elapsedMs+=300;}
 j.events.push(...c);const r=T.comparer(j);
 assert.equal(r.bras.rapide.lectureParRailMs,300,'heure de la page');assert.equal(r.controle.etapesDateesParLaPage,1);
 const sans=deuxVisites(),c0=capture('r1',100,'rapide',300,Date.UTC(2026,9,13,8));for(const e of c0)if(e.lastStage==='capture-read')e.elapsedMs+=300;
 sans.events.push(...c0);assert.equal(T.comparer(sans).bras.rapide.lectureParRailMs,0,'sans heure de la page : l’artefact de la 4.9.0.8');
});
