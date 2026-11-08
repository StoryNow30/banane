'use strict';
/* D-296 (CH-064, étape 6 a) : lecture LiDAR en Rust dans la page. Fichiers fabriqués à jour, chargeur, identité au bit près avec
 * vendor/lidar.js, repli sur refus, bilan de l'événement `rust`. Les fichiers de page sont chargés dans un contexte vm à part,
 * dans l'ordre de PAGE_FILES (background.js). */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const RACINE=path.resolve(__dirname,'..');
const PAGE=['vendor/capture-core.js','vendor/lidar.js','vendor/ariane-lidar.js','vendor/ariane-lidar-wasm.js','vendor/lidar-rust.js','src/lidar-rust.js'];
function page({WebAssembly:W=WebAssembly,sans=[]}={}){
 const ctx=vm.createContext({WebAssembly:W,atob,Date,Math,Promise,Error,TypeError,RangeError,Float32Array,Float64Array,Uint32Array,Uint8Array,Uint16Array,Object,Array,Number,JSON,String,Symbol,Set,Map});
 ctx.globalThis=ctx;for(const f of PAGE)if(!sans.includes(f))vm.runInContext(fs.readFileSync(path.join(RACINE,f),'utf8'),ctx,{filename:f});return ctx;}
/* Scène Potree minimale (deux nœuds, attributs sans accesseur comme la maquette d'ESV), tirage fixe. */
function scene(n=30000){let s=7;const al=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296-0.5);
 const id=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],tr=(x,y,z)=>{const m=id();m[12]=x;m[13]=y;m[14]=z;return m;};
 const noeud=()=>{const a=new Float32Array(3*n);for(let i=0;i<n;i++){const p=i%5===0;a[3*i]=p?al()*1.2:al()*30;a[3*i+1]=p?(i%10===0?0:1.5)+al()*0.9:al()*30;a[3*i+2]=p?al()*0.7:al()*6;}
  return {sceneNode:{visible:true,parent:null,matrixWorld:{elements:tr(10,-3,1)},geometry:{attributes:{position:{array:a,itemSize:3,count:n,version:0,normalized:false},
   intensity:{array:new Uint16Array(n).map((_,i)=>i%4096),itemSize:1,count:n,version:0,normalized:false}},drawRange:{start:0,count:Infinity},boundingBox:null}},geometryNode:null};};
 const pc={visible:true,parent:null,visibleNodes:[noeud(),noeud()],material:{clipBoxes:[{inverse:{elements:[0.3,0,0,0,0,0.3,0,0,0,0,0.3,0,-3,0.9,-0.3,1]}}],clipPolygons:[],clipTask:2,clipMethod:0}};
 const rail=r=>({object:{},profile:{type:'Group',children:[]},railMatrix:r,profileMatrix:r,rotation:[0,0,0,'XYZ'],profileRotation:[0,0,0,'XYZ']});
 return {viewer:{scene:{pointclouds:[pc],getActiveCamera:()=>null},renderer:null},rails:[rail(tr(10,-3,1)),rail(tr(10,-1.5,1))],origin:[0.5,0.25,0],
  enums:{ClipTask:{NONE:0,HIGHLIGHT:1,SHOW_INSIDE:2,SHOW_OUTSIDE:3},ClipMethod:{INSIDE_ANY:0,INSIDE_ALL:1}}};}
const options=sc=>({...sc,guard:()=>{},pause:()=>Promise.resolve(),meta:{captureId:'essai'}});
const net=o=>{const x=JSON.parse(JSON.stringify(o));delete x.capturedAt;delete x.quality.durationMs;return x;};

test('fichiers fabriqués à jour (module, coquille, variante de vendor/lidar.js)',()=>{
 const {verifier}=require('../tools/rust-lidar-paquet.cjs');assert.deepStrictEqual(verifier(),[]);});

test('lecture servie par le noyau WASM : sortie identique à vendor/lidar.js, bilan « servi »',async()=>{
 const p=page(),R=p.BananeLidarRustChargeur;assert.strictEqual(R.pret(),true,String(R.raison));
 const ref=net(await p.BananeLidar.capture(options(scene()))),w=net(await R.capture(options(scene())));
 assert.ok(ref.pointsSceneRelative.length>1000);assert.deepStrictEqual(w,ref);
 // octets comparés aussi (−0, ordre des clés) : JSON de chaque nombre au bit près
 const bits=o=>Buffer.from(new Float64Array(o.pointsSceneRelative.flat()).buffer).toString('base64');assert.strictEqual(bits(w),bits(ref));
 const b=R.bilan(true);assert.strictEqual(b.module,'lidar');assert.strictEqual(b.servi,true);assert.strictEqual(b.repli,false);assert.ok(b.tranchesWasm>0);
});

test('compilation refusée par la page (CSP) : pas de noyau, raison dite, la lecture d’origine reste disponible',async()=>{
 const W={...WebAssembly,Module:function(){throw new WebAssembly.CompileError('WebAssembly.Module(): refusé par la politique de la page');}};
 const p=page({WebAssembly:W}),R=p.BananeLidarRustChargeur;
 assert.strictEqual(R.pret(),false);assert.match(R.raison,/^chargement refusé : /);
 const b=R.bilan(false);assert.deepStrictEqual({servi:b.servi,repli:b.repli},{servi:false,repli:true});assert.match(b.raison,/chargement refusé/);
 assert.ok((await p.BananeLidar.capture(options(scene()))).pointsSceneRelative.length>1000);});

test('module absent : pas de noyau, raison « module absent »',()=>{
 const p=page({sans:['vendor/ariane-lidar-wasm.js']});assert.strictEqual(p.BananeLidarRustChargeur.pret(),false);assert.strictEqual(p.BananeLidarRustChargeur.raison,'module absent');});

test('réglage rust.lidar présent, actif par défaut',()=>{
 const S=require('../src/settings.js');assert.deepStrictEqual({...S.rust},{lidar:true});assert.ok(Object.isFrozen(S.rust));});

test('background.js injecte les fichiers de page dans l’ordre, après vendor/lidar.js',()=>{
 const b=fs.readFileSync(path.join(RACINE,'background.js'),'utf8'),m=/const PAGE_FILES=\[([^\]]*)\]/.exec(b),l=m[1].match(/'[^']+'/g).map(x=>x.slice(1,-1));
 const i=l.indexOf('vendor/lidar.js');assert.deepStrictEqual(l.slice(i,i+5),['vendor/lidar.js','vendor/ariane-lidar.js','vendor/ariane-lidar-wasm.js','vendor/lidar-rust.js','src/lidar-rust.js']);});
