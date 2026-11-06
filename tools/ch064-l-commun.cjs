'use strict';
/* CH-064-L : outillage commun de la lecture LiDAR (construction du noyau, chargement, exécution d'une vue).
 * Rien de produit n'est versionné : le .wasm autonome (mémoire bornée) est dans ariane-rs/target (ignoré). */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const RACINE=path.resolve(__dirname,'..'),ESPACE=path.join(RACINE,'ariane-rs'),CRATE=path.join(ESPACE,'crates','ariane-lidar');
const WASM=path.join(ESPACE,'target','wasm32-unknown-unknown','release','ariane_lidar.wasm');
function construireWasm(){
 const r=spawnSync('cargo',['build','--release','--target','wasm32-unknown-unknown','-p','ariane-lidar'],{cwd:ESPACE,encoding:'utf8'});
 if(r.status!==0)throw Error('Construction de ariane_lidar.wasm en échec :\n'+r.stderr);
 return WASM;
}
const lire=f=>fs.readFileSync(path.join(RACINE,f),'utf8');
const SOURCES={core:'vendor/capture-core.js',lidar:'vendor/lidar.js',coquille:'ariane-rs/crates/ariane-lidar/js/lidar-wasm.js',comparer:'tools/ch064-comparer.cjs'};
/* Modules dans Node : lidar.js d'origine, sa variante (même texte + branche), la coquille. */
function chargerNode(){
 const C=require(path.join(RACINE,SOURCES.core)),origine=require(path.join(RACINE,SOURCES.lidar)),W=require(path.join(RACINE,SOURCES.coquille));
 const module={exports:{}};new Function('module','exports','require',W.variante(lire(SOURCES.lidar)))(module,module.exports,()=>C);
 return {C,origine,variante:module.exports,W};
}
/* Exécute capture() sur une scène ; rend {ms, sortie} ou {ms, erreur}. Texte autonome (aussi évalué dans Chromium). */
async function executerCapture(L,scene,noyau,pause,options){
 globalThis.ArianeLidarNoyau=noyau;const t=performance.now();
 try{const o=await L.capture({viewer:scene.viewer,rails:scene.rails,origin:scene.origin,enums:scene.enums,guard:()=>{},pause,meta:{captureId:'banc'},...(options||{})});
  return {ms:performance.now()-t,sortie:o};}
 catch(e){return {ms:performance.now()-t,erreur:{nom:e.constructor.name,message:e.message}};}
 finally{globalThis.ArianeLidarNoyau=undefined;}
}
/* Sortie comparable : seuls les horodatages (capturedAt, durationMs) sont retirés ; tout le reste compte. */
function net(r){if(r.erreur)return r.erreur;const o={...r.sortie};delete o.capturedAt;o.quality={...o.quality};delete o.quality.durationMs;return o;}
module.exports={RACINE,CRATE,WASM,SOURCES,lire,construireWasm,chargerNode,executerCapture,net};
