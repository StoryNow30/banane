'use strict';
/* Chargement des modules comme le service worker (KI-048) : fichiers de
 * `background.js`, dans l'ordre d'importScripts, sans `module` ni `require`. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const O=require('../../src/continuity-observer.js'),{K,base}=require('../fixtures.cjs');
const root=path.join(__dirname,'..','..'),SIDES=['left','right'];
const all=[...fs.readFileSync(path.join(root,'background.js'),'utf8').match(/importScripts\(([^)]*)\)/s)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
/* Préfixe de la liste jusqu'à la composition GCV1 : tout ce qui lie la décision sur le lot. */
const listed=all.slice(0,all.indexOf('src/gcv1-shadow.js')+1);
function load(files){const ctx={console,setTimeout,clearTimeout};ctx.self=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
  for(const f of files)vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});return ctx;}
/* Scénario du risque connu KI-047 (ancres fausses de 150 mm, choix sur la paire
 * parallèle). Depuis la 4.7.16, la garde d'écartement voisin le diffère sur ce
 * fixture (écartement du choix à 20,6 mm de celui des ancres) ; les essais de
 * traduction et d'ordre de chargement la coupent pour garder un choix à
 * traduire. `lot-decision-voie.test.cjs` garde les deux cas visibles. */
/* La vérité du fixture (pose du moteur sur la pose de base) est calculée une
 * fois, par le module Node : sous `vm`, la même science prend 3,6 s au lieu de
 * 1,5 s, et le fichier d'essai dépassait les 10 s sur une machine chargée.
 * Mêmes deltas au bit près (vérifié le 25/09) ; seule la décision testée
 * passe par les globales du service worker. */
let truthScience=null;
const fixtureScience=capture=>truthScience||(truthScience=require('../../src/gcv1-shadow.js').scientificProposeBoth(capture(base.rails)));
function build(L,Shadow,options={gaugeGuardMm:null}){
  const capture=rails=>({identity:{part:23,cut:105,frameId:'f'},rails,pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)});
  const s0=fixtureScience(capture);
  const truth=Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,w=K.C.point(P,s0.rails[side].next.delta),o=K.C.point(P,[0,0,0]);
    return [side,O.translated(r,w.map((v,i)=>v-o[i]))];}));
  const shifted=Object.fromEntries(SIDES.map(side=>{const r=truth[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
    const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+.15,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));
  const anchor=cut=>({identity:{part:23,cut,frameId:'f'},positions:Object.fromEntries(SIDES.map(s=>[s,shifted[s].positionSceneRelative]))});
  const cap=capture(shifted);
  return {capture:cap,decision:L.decideCut({capture:cap,science:Shadow.scientificProposeBoth(cap),anchors:[anchor(104),anchor(103)],Shadow,options})};
}
const scenario=(L,Shadow,options)=>build(L,Shadow,options).decision;
/* Capture munie de caméras comme celles du Pilote (KI-051) : une vue par rail,
 * centrée sur lui, ±`half` unité de scène en x et y. */
function withCameras(capture,half=.2){
  const cam=p=>({type:'OrthographicCamera',sceneRelativeToCamera:K.C.translation(p.map(v=>-v)),
    projection:[1/half,0,0,0, 0,1/half,0,0, 0,0,1,0, 0,0,0,1],viewport:{left:0,top:0,width:796,height:740}});
  return {...capture,viewCaptures:SIDES.map(s=>({camera:cam(capture.rails[s].positionSceneRelative)}))};
}
module.exports={listed,load,build,scenario,withCameras};
