'use strict';
/* CH-064 : parité de vendor/capture-core.js (partie pure) contre ariane-capture (fonction 10 du cœur).
 * Cas : sur chaque nuage réel et chaque rail, toutes les fonctions portées sur ses vraies matrices et ses vrais points
 * (un point sur 25), puis des cas limites synthétiques (non fini, singulier, trous, objets, chaînes, null).
 * Une entrée hors domaine du port est rejouée par le JS (comme le ferait la façade) et COMPTÉE à part. */
const C=require('../../vendor/capture-core.js'),{nuages}=require('../../tools/ch064-nuages.cjs');
let horsDomaine=0;
const I=C.identity(),SING=Array(16).fill(0),NONAFF=I.map((v,i)=>i===3?1:v);
const LIMITES=[['matrix',[null]],['matrix',[{elements:I}]],['matrix',[I.slice(0,15)]],['matrix',[I.map((v,i)=>i?v:NaN)]],['matrix',['0123456789abcdef']],['matrix',[5]],
 ['affine',[NONAFF]],['inverse',[SING]],['inverse',[I]],['point',[I.map((v,i)=>i===15?0:v),[0,0,0]]],['point',[I,[1,2]]],['point',[I,[1,,3]]],['point',[I.map(v=>v*1e300),[1e10,1e10,1e10]]],
 ['vector',[[1,2,3,4]]],['vector',[[1,,3]]],['vector',[{x:1,y:2,z:3}]],['vector',[{x:1,y:'2',z:3}]],['vector',[[1,2]]],['vector',[null]],['vector',[[1,2,Infinity]]],
 ['distance',[[0,0,0],[3,4,0]]],['distance',[[-0,0],[0,-0]]],['translation',[[1,-0,3]]],['rebase',[I,[1,2,3]]],['rebase',[NONAFF,[1,2,3]]],['identity',[]],
 ['serialRail',[{railMatrix:I,profileMatrix:SING,rotation:[0,0,0,'XYZ']},[0,0,0]]],['serialRail',[{railMatrix:I,profileMatrix:I},[0,0,0]]],['multiply',[I,SING]]];
module.exports={nom:'capture',description:'vendor/capture-core.js, partie pure',sources:['vendor/capture-core.js'],
 *cas({max=Infinity}={}){
  let i=0;for(const [f,a] of LIMITES)yield {id:'limite-'+(i++)+'-'+f,entree:{f,a}};
  let n=0;for(const c of nuages(max)){n++;
   for(const s of ['left','right']){const r=c.rails?.[s];if(!r)continue;const id='nuage-'+n+'-'+s;
    for(const k of ['railLocalToSceneRelative','profileLocalToSceneRelative','sceneRelativeToProfileLocal']){const m=r[k];
     yield {id:id+'-matrix-'+k,entree:{f:'matrix',a:[m]}};yield {id:id+'-affine-'+k,entree:{f:'affine',a:[m]}};yield {id:id+'-inverse-'+k,entree:{f:'inverse',a:[m]}};}
    yield {id:id+'-multiply',entree:{f:'multiply',a:[r.railLocalToSceneRelative,r.profileLocalToSceneRelative]}};
    yield {id:id+'-rebase',entree:{f:'rebase',a:[r.profileLocalToSceneRelative,r.positionSceneRelative]}};
    yield {id:id+'-distance',entree:{f:'distance',a:[r.positionSceneRelative,r.profileOriginSceneRelative]}};
    yield {id:id+'-translation',entree:{f:'translation',a:[r.positionSceneRelative]}};
    yield {id:id+'-vector',entree:{f:'vector',a:[r.positionSceneRelative]}};
    yield {id:id+'-serialRail',entree:{f:'serialRail',a:[{railMatrix:r.railLocalToSceneRelative,profileMatrix:r.profileLocalToSceneRelative,rotation:r.rotation,profileRotation:r.profileRotation},[0.5,-0.25,0.125]]}};
    const p=c.pointsSceneRelative;for(let j=0;j<p.length;j+=25)yield {id:id+'-point-'+j,entree:{f:'point',a:[r.sceneRelativeToProfileLocal,p[j]]}};
   }}},
 js({f,a}){return C[f](...a);},
 rs(e,coeur){try{return coeur.appeler(10,e);}catch(x){if(x.name==='HorsDomaine'){horsDomaine++;return C[e.f](...e.a);}throw x;}},
 bilan:()=>({horsDomaineRejouesEnJs:horsDomaine}),
 navigateur:{scripts:['vendor/capture-core.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js'],preparer:'coeur=>({coeur,hd:0})',
  js:'e=>BananeCaptureCore[e.f](...e.a)',rs:'(e,t)=>{try{return t.coeur.appeler(10,e);}catch(x){if(x.name==="HorsDomaine"){t.hd++;return BananeCaptureCore[e.f](...e.a);}throw x;}}',bilan:'t=>({horsDomaineRejouesEnJs:t.hd})'}};
