'use strict';
/* 4.9.5.1 (D-109) : chaque lecture d'une vue porte un petit diagnostic du signal de fin de chargement
 * (`diag`, dans le détail de l'étape `capture-read`), SANS changer la décision de lecture : même règle,
 * même temps simulé, mêmes vues lues que sans diagnostic (les essais de v3-turbo restent inchangés).
 * Page ESV simulée au rythme des images (tests/helpers/esv-images.cjs). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {esv,nuage}=require('./helpers/esv-images.cjs'),S=require('../src/settings.js');
const J=x=>JSON.parse(JSON.stringify(x));
const lus=f=>J(f.progress.filter(p=>p.stage==='capture-read').map(p=>p.detail));

test('lecture au signal : diagnostic sans condition manquante, compteurs de Potree et âge de la page',async()=>{
 const f=esv({cut:100});const pc=nuage(f);pc.numVisiblePoints=1234;f.ctx.Potree.lru={numPoints:5678,elements:9,size(){return 9;}};
 f.ctx.performance={now:()=>754321,memory:{usedJSHeapSize:300*1048576}};
 const before=await f.call('state'),t0=f.clock();await f.call('capture',before);
 assert.ok(f.clock()-t0<600,'toujours lu au signal, sans attente ajoutée');
 const d=lus(f);assert.deepEqual(d.map(x=>x.regle),['signal','signal']);
 for(const x of d){const g=x.diag;
  assert.equal(g.m,undefined,'au signal : aucune condition manquante');
  assert.deepEqual(g.nl,[0,0]);assert.ok(g.img>=2&&g.paires>=1);assert.deepEqual([g.pc,g.nc],[0,0]);
  assert.deepEqual([g.noeuds,g.pts,g.lruPts,g.lruNoeuds,g.memMo,g.navS],[1,1234,5678,9,300,754]);
  assert.ok(Number.isInteger(g.ageS)&&g.ageS>=0);
  assert.ok(JSON.stringify(g).length<260,`diagnostic compact : ${JSON.stringify(g).length} caractères`);}
});

test('chargement pendu : repli 800 ms, condition manquante « chargements », valeur finale et maximum',async()=>{
 const f=esv({cut:100,chargements:2});nuage(f);const before=await f.call('state'),t0=f.clock();
 await f.call('capture',before);assert.ok(f.clock()-t0>=2*S.pilote.stabiliteMs,'repli inchangé');
 for(const x of lus(f)){assert.equal(x.regle,'stabilite');assert.equal(x.diag.m,'chargements');assert.deepEqual(x.diag.nl,[2,2]);
  assert.ok(x.diag.pc>0&&x.diag.pc===x.diag.paires,'chaque paire d’images avait un chargement en cours');}
});

test('compteur de chargements qui retombe à 0 puis remonte : le maximum est gardé, la valeur finale aussi',async()=>{
 const f=esv({cut:100,chargements:0});nuage(f);const before=await f.call('state');
 /* Le compteur alterne 0 / 3 à chaque image : le signal ne trouve jamais deux images libres de suite. */
 const tic=f.ctx.requestAnimationFrame;f.ctx.requestAnimationFrame=fn=>tic(()=>{f.potree.numNodesLoading=f.potree.framenumber%2?3:0;fn();});
 await f.call('capture',before);
 for(const x of lus(f)){assert.equal(x.regle,'stabilite');assert.equal(x.diag.m,'chargements');assert.equal(x.diag.nl[1],3);assert.ok([0,3].includes(x.diag.nl[0]));}
});

test('sans compteur d’images de Potree : repli, condition manquante « images », 0 image vue',async()=>{
 const f=esv({cut:100});nuage(f);delete f.ctx.Potree.framenumber;const before=await f.call('state');
 await f.call('capture',before);
 for(const x of lus(f)){assert.equal(x.regle,'stabilite');assert.equal(x.diag.m,'images');assert.equal(x.diag.img,0);assert.equal(x.diag.paires,0);}
});

test('vue qui bouge à chaque image (nœuds immobiles) : repli, condition manquante « vue »',async()=>{
 const f=esv({cut:100});nuage(f);const before=await f.call('state'),cam=f.ctx.viewer.scene.getActiveCamera();
 let n=0;const tic=f.ctx.requestAnimationFrame;
 f.ctx.requestAnimationFrame=fn=>tic(()=>{if(f.progress.at(-1)?.stage==='capture-wait')cam.position={...cam.position,z:cam.position.z+1e-4*(n++%2?1:-1)};fn();});
 await f.call('capture',before);
 for(const x of lus(f)){assert.equal(x.regle,'stabilite');assert.equal(x.diag.m,'vue');assert.ok(x.diag.vc>0);assert.equal(x.diag.nc,0);assert.equal(x.diag.pc,0);}
});

test('cut référence (pas de signal) : diagnostic « hors-signal », sans compteurs d’images',async()=>{
 const f=esv({cut:101});nuage(f);const before=await f.call('state');await f.call('capture',before);
 for(const x of lus(f)){assert.equal(x.regle,'stabilite');assert.equal(x.diag.m,'hors-signal');assert.equal(x.diag.img,undefined);assert.equal(x.diag.noeuds,1);}
});

test('Potree sans LRU ni mémoire JS (Edge ou Firefox) : les champs absents sont omis, rien ne casse',async()=>{
 const f=esv({cut:100});nuage(f);delete f.ctx.performance;const before=await f.call('state');await f.call('capture',before);
 for(const x of lus(f)){assert.equal(x.regle,'signal');for(const k of ['lruPts','lruNoeuds','memMo','pts','navS'])assert.equal(k in x.diag,false,k);}
});
