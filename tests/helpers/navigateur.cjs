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
function build(L,Shadow){
  const capture=rails=>({identity:{part:23,cut:105,frameId:'f'},rails,pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)});
  const s0=Shadow.scientificProposeBoth(capture(base.rails));
  const truth=Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,w=K.C.point(P,s0.rails[side].next.delta),o=K.C.point(P,[0,0,0]);
    return [side,O.translated(r,w.map((v,i)=>v-o[i]))];}));
  const shifted=Object.fromEntries(SIDES.map(side=>{const r=truth[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
    const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+.15,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));
  const anchor=cut=>({identity:{part:23,cut,frameId:'f'},positions:Object.fromEntries(SIDES.map(s=>[s,shifted[s].positionSceneRelative]))});
  const cap=capture(shifted);
  return {capture:cap,decision:L.decideCut({capture:cap,science:Shadow.scientificProposeBoth(cap),anchors:[anchor(104),anchor(103)],Shadow})};
}
const scenario=(L,Shadow)=>build(L,Shadow).decision;
module.exports={listed,load,build,scenario};
