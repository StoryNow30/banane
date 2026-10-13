'use strict';
/* V3, mode « rapide » de la 4.9.0.7 (D-088) : sur un cut tiré rapide, Ariane sélectionne sa vue au rythme
 * des images (I2), lit dès que plus rien ne charge (I3) et pose sans attendre le recentrage (P1). Un cut
 * « référence » fait tout comme la 4.9.0.5. Page ESV simulée au plus près du banc ESV local du 13 octobre :
 * le bouton de rail fixe le côté et sa classe tout de suite, la caméra ne suit qu'à l'image suivante ; le
 * clic pose le rail du côté courant au point visé, calculé avec la caméra active. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs'),K=require('../src/core.js'),S=require('../src/settings.js');
const J=x=>JSON.parse(JSON.stringify(x));/* tableaux venus du contexte de la page : autre domaine */
const PROPOSALS={left:{delta:[0,.012,.003]},right:{delta:[0,-.01,.004]}};

/* Page « comme ESV » : classes des boutons, caméra recopiée à l'image suivante (une image toutes les
 * 16 ms), compteurs de Potree. Horloge à événements discrets : une minuterie avance l'horloge quand
 * elle échoit (et non quand elle est posée), une minuterie annulée ne coûte rien. */
function esv({cut=100,pilote={},chargements=0}={}){
 const potree={framenumber:0,numNodesLoading:chargements};
 const globals={Potree:potree,...(Object.keys(pilote).length?{BananeSettings:{...S,pilote:{...S.pilote,...pilote}}}:{})};
 const f=page({globals}),cam=f.ctx.viewer.scene.getActiveCamera(),images=[],clics=[];
 const minuteries=new Map();let numero=0,prevu=false,prochaine=16;
 const tourner=()=>{prevu=false;if(!minuteries.size)return;
  const [id,m]=[...minuteries].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];minuteries.delete(id);
  if(m.at>f.clock())f.advance(m.at-f.clock());while(prochaine<=f.clock()){image();prochaine+=16;}m.fn();planifier();};
 const planifier=()=>{if(!prevu){prevu=true;setImmediate(tourner);}};
 f.ctx.setTimeout=(fn,ms=0)=>{const id=++numero;minuteries.set(id,{at:f.clock()+ms,fn});planifier();return id;};
 f.ctx.clearTimeout=id=>{minuteries.delete(id);};
 f.ctx.requestAnimationFrame=fn=>f.ctx.setTimeout(fn,prochaine-f.clock()>0?prochaine-f.clock():16);
 f.nodes.get('O2N3DCutDescription').textContent=`Cut ${cut} of part 23`;
 let cote='left';const enAttente=[];
 for(const [id,side,classe] of [['O2N3DCutLRClick','left','leftRailSClass'],['O2N3DCutRRClick','right','rightRailSClass']]){
  const n=f.nodes.get(id),clic=n.click;
  n.classList={contains:c=>c===classe&&cote===side};
  n.click=function(){clics.push(side);const avant=cam.position;clic.call(this);const apres=cam.position;cam.position=avant;cote=side;enAttente.push(()=>{cam.position=apres;});};
 }
 /* Une image : la caméra suit la vue demandée, le compteur d'images avance. */
 function image(){potree.framenumber++;images.push(potree.framenumber);for(const a of enAttente.splice(0))a();}
 return {...f,potree,clics,image,cote:()=>cote};
}
/* Un nuage visible (un nœud) pour que la signature compte au moins un nœud. */
function nuage(f){const F=require('./v242/fixtures.cjs'),L=require('../vendor/lidar.js'),pc=F.object([0,0,0],'PointCloudOctree'),n=F.object([0,0,0],'Points');
 n.geometry={attributes:{position:F.buffer([[0,.01,.01],[0,1.425,.01]])}};pc.material={clipBoxes:[],clipTask:0,clipMethod:0};pc.visibleNodes=[{sceneNode:n}];
 f.ctx.viewer.scene.pointclouds=[pc];f.ctx.Potree.ClipTask=F.enums.ClipTask;f.ctx.Potree.ClipMethod=F.enums.ClipMethod;f.ctx.BananeLidar.capture=opts=>L.capture(opts);return pc;}

test('réglage : mode rapide tiré cut par cut, quatre pièces actives, ligne du panneau',()=>{
 assert.equal(S.pilote.modeRapide,'tirage');assert.deepEqual({...S.pilote.rapide},{lecture:true,selection:true,signal:true,pose:true});
 const l=S.describe().find(x=>x.nom==='Mode rapide (V3)');assert.equal(l.valeur,'un cut sur deux, tiré au sort');
 assert.match(l.pourquoi,/mêmes contrôles, mêmes points/);
});

test('P1 : cut rapide, pose sans attendre le recentrage, même depuis la vue de l\'autre rail',async()=>{
 const f=esv({cut:100});f.nodes.get('O2N3DCutRRClick').click();f.image();
 const before=await f.call('state'),t0=f.clock();
 const r=await f.call('apply',before,PROPOSALS);
 assert.ok(K.equalPoses(r.rails,K.expectedPoses(before,PROPOSALS),.001),'les deux rails à la cible (1 mm)');
 assert.equal(f.clock()-t0,0,'aucune attente : ni sondage, ni image');
 assert.deepEqual(J(f.clics.slice(-2)),['left','right'],'un clic de bouton par rail, aucun recentrage attendu');
 assert.equal(f.progress.filter(p=>p.stage==='apply-repli').length,0);
});

test('P1 : cut référence, pose comme la 4.9.0.5 (sélection puis trois sondages immobiles)',async()=>{
 const f=esv({cut:101}),before=await f.call('state'),t0=f.clock();
 const r=await f.call('apply',before,PROPOSALS);
 assert.ok(K.equalPoses(r.rails,K.expectedPoses(before,PROPOSALS),.001));
 assert.ok(f.clock()-t0>=2*S.pilote.lecturesStables*S.pilote.sondageMs,`attente de la 4.9.0.5 : ${f.clock()-t0} ms`);
});

test('P1 : ESV ne prend pas le côté demandé (classe inchangée) : rien n\'est cliqué sur le canevas, pose avec recentrage',async()=>{
 const f=esv({cut:100}),before=await f.call('state');
 const lr=f.nodes.get('O2N3DCutLRClick');lr.classList={contains:()=>false};
 let canevas=0;const d=f.ctx.viewer.renderer.domElement.dispatchEvent;f.ctx.viewer.renderer.domElement.dispatchEvent=function(e){canevas++;return d.call(this,e);};
 const r=await f.call('apply',before,PROPOSALS);
 assert.ok(K.equalPoses(r.rails,K.expectedPoses(before,PROPOSALS),.001));
 assert.deepEqual(J(f.progress.filter(p=>p.stage==='apply-repli').map(p=>p.detail.side)),['left']);
 assert.equal(canevas,2,'un clic de pose par rail : aucun clic perdu sur le mauvais rail');
});

test('P1 : le clic déplace l\'autre rail : arrêt, état à réconcilier (aucune seconde tentative)',async()=>{
 const f=esv({cut:100}),before=await f.call('state');
 const d=f.ctx.viewer.renderer.domElement;const orig=d.dispatchEvent;
 d.dispatchEvent=function(e){const r=f.right.position;r.x+=.01;return true;};void orig;
 await assert.rejects(f.call('apply',before,PROPOSALS),/^Error: Le clic a déplacé le rail droit au lieu du rail gauche\. État à réconcilier\.$/);
});

test('P1 coupée dans les réglages : pose avec recentrage même sur un cut rapide',async()=>{
 const f=esv({cut:100,pilote:{rapide:{pose:false}}}),before=await f.call('state'),t0=f.clock();
 await f.call('apply',before,PROPOSALS);assert.ok(f.clock()-t0>0);
 assert.equal(f.progress.filter(p=>p.stage==='apply-repli').length,0);
});

test('I2 + I3 : cut rapide, vue sélectionnée à l\'image et lecture au signal, sur les deux vues',async()=>{
 const f=esv({cut:100});nuage(f);const before=await f.call('state'),t0=f.clock();
 const out=await f.call('capture',before);const ms=f.clock()-t0;
 assert.deepEqual(J(out.readStrategy.attempts.map(a=>[a.side,a.regle])),[['left','signal'],['right','signal']]);
 assert.deepEqual(J(out.readStrategy.pieces),['lecture','selection','signal','pose']);
 assert.ok(out.readStrategy.attempts.every(a=>a.images>=2));
 assert.ok(ms<600,`deux vues en ${ms} ms simulées (la règle des 800 ms en demande au moins 1 600)`);
 assert.deepEqual(J(f.progress.filter(p=>p.stage==='capture-read').map(p=>p.detail.regle)),['signal','signal']);
});

test('I3 : référence, la règle des 800 ms reste celle de la 4.9.0.5',async()=>{
 const f=esv({cut:101});nuage(f);const before=await f.call('state'),t0=f.clock();
 const out=await f.call('capture',before);
 assert.deepEqual(J(out.readStrategy.attempts.map(a=>a.regle)),['stabilite','stabilite']);assert.deepEqual(J(out.readStrategy.pieces),[]);
 assert.ok(f.clock()-t0>=2*S.pilote.stabiliteMs);
});

test('I3 : chargement d\'ESV pendu (un bloc en échec) : le signal ne conclut jamais, repli sur la règle des 800 ms',async()=>{
 const f=esv({cut:100,chargements:1});nuage(f);const before=await f.call('state'),t0=f.clock();
 const out=await f.call('capture',before);
 assert.deepEqual(J(out.readStrategy.attempts.map(a=>a.regle)),['stabilite','stabilite']);
 assert.ok(f.clock()-t0>=2*S.pilote.stabiliteMs);
});

test('I3 : sans compteur d\'images de Potree, repli sur la règle des 800 ms',async()=>{
 const f=esv({cut:100});nuage(f);delete f.ctx.Potree.framenumber;const before=await f.call('state');
 const out=await f.call('capture',before);assert.deepEqual(J(out.readStrategy.attempts.map(a=>a.regle)),['stabilite','stabilite']);
});

test('I3 : le niveau de détail change pendant une lecture au signal : relecture, et la relecture attend comme la 4.9.0.5',async()=>{
 const f=esv({cut:100});const pc=nuage(f);const before=await f.call('state'),L=require('../vendor/lidar.js');let lectures=0;
 f.ctx.BananeLidar.capture=async opts=>{lectures++;const d=await L.capture(opts);if(lectures===1)pc.visibleNodes=[...pc.visibleNodes,{sceneNode:pc.visibleNodes[0].sceneNode}];return d;};
 const out=await f.call('capture',before);
 assert.deepEqual(J(out.readStrategy.attempts.filter(a=>a.side==='left').map(a=>[a.status,a.regle??null])),[['discarded',null],['captured','stabilite']]);
 assert.equal(f.progress.filter(p=>p.stage==='capture-retry').length,1);
 assert.match(f.progress.find(p=>p.stage==='capture-retry').detail.message,/niveau de détail changé pendant la lecture/);
});

test('I2 : vue qui ne se recentre jamais sur un cut rapide : trois clics puis pause reprenable, comme la 4.9.0.5',async()=>{
 const f=esv({cut:100});nuage(f);const before=await f.call('state');f.nodes.get('O2N3DCutRRClick').click();f.image();
 let n=0;f.nodes.get('O2N3DCutLRClick').click=function(){n++;};
 await assert.rejects(f.call('capture',before),e=>{assert.match(e.message,/^Lecture LiDAR instable : Vue ESV non recentrée sur le rail left\./);return true;});
 assert.equal(n,S.pilote.recentrages);
});
