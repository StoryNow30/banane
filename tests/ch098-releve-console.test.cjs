'use strict';
/* CH-098 — relevé mémoire de console (chantiers/CH-098/releve-console.js) : lecture seule, nombres seulement, différence au 2e collage.
 * Joué dans une vm sur une fausse page (viewer, Potree, arbre de nœuds) gelée : toute écriture dans la page lèverait. */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../chantiers/CH-098/releve-console.js'),'utf8');
const geler=o=>{if(o&&typeof o==='object'&&!ArrayBuffer.isView(o)&&!Object.isFrozen(o)){Object.freeze(o);for(const k of Object.keys(o))geler(o[k]);}return o;};
function page(nGeom){const enfants={};for(let i=0;i<nGeom;i++)enfants[i]={loaded:true,geometry:{attributes:{position:{array:new Float32Array(300)}}},children:{}};
 const root={loaded:true,geometry:null,children:enfants};
 const pc={visibleNodes:[1,2],numVisiblePoints:2000,pcoGeometry:{root},root:{sceneNode:{geometry:{attributes:{position:{array:new Float32Array(30)}}}},children:[]}};
 const viewer=geler({scene:{pointclouds:[pc],scene:{children:[{children:[],geometry:{attributes:{position:{array:new Float32Array(3)}}}}]}},renderer:{info:{memory:{geometries:7,textures:2},programs:[1],render:{calls:5}}}});
 const Potree=geler({numNodesLoading:0,maxNodesLoading:4,lru:{numPoints:100,elements:3}});
 const copies=[],journal=[];
 const ctx={viewer,Potree,performance:{now:()=>5000,memory:{usedJSHeapSize:100*1048576,totalJSHeapSize:200*1048576,jsHeapSizeLimit:4096*1048576},getEntriesByType:()=>[1,2,3]},
  document:{getElementsByTagName:()=>({length:42})},copy:s=>copies.push(s),console:{log:(...a)=>journal.push(a)},fetch:()=>{throw Error('requête interdite');},XMLHttpRequest:function(){throw Error('requête interdite');}};
 ctx.window=ctx;return {ctx,copies};}
test('relevé : nombres seulement, rien d\'écrit hors de sa variable, différence au second collage',()=>{
 const p=page(4);vm.createContext(p.ctx);const a=vm.runInContext(code,p.ctx);
 assert.equal(a.tas.utiliseMo,100);assert.equal(a.potree.parNuage[0].avecGeometrie,4);assert.equal(a.potree.parNuage[0].geometrieMo,Math.round(4*1200/1048576*10)/10);
 assert.equal(a.potree.parNuage[0].sceneNodes,1);assert.equal(a.rendu.geometries,7);assert.equal(a.page.elementsDom,42);assert.equal(a.difference,undefined);
 /* Aucune chaîne dans le relevé, hors le nom du format. */
 const chaines=[];JSON.parse(JSON.stringify(a),(k,v)=>{if(typeof v==='string'&&k!=='format')chaines.push(k+'='+v);return v;});
 assert.deepEqual(chaines,[],'aucun texte');assert.equal(p.copies.length,1);
 const cles=Object.keys(p.ctx).filter(k=>!['viewer','Potree','performance','document','copy','console','fetch','XMLHttpRequest','window'].includes(k));
 assert.deepEqual(cles,['__releveMemoireCH098'],'seule sa propre variable est posée');
 p.ctx.performance.memory.usedJSHeapSize=160*1048576;const b=vm.runInContext(code,p.ctx);
 assert.equal(b.difference.tasMo,60);assert.equal(b.difference.noeudsAvecGeometrie,0);
});
test('relevé : page sans viewer ni Potree, aucune exception, valeurs nulles',()=>{
 const ctx={performance:{now:()=>1},document:{getElementsByTagName:()=>({length:1})},console:{log(){}}};ctx.window=ctx;vm.createContext(ctx);
 const r=vm.runInContext(code,ctx);assert.equal(r.tas.utiliseMo,null);assert.equal(r.potree.nuages,0);assert.equal(r.rendu.geometries,null);
});
