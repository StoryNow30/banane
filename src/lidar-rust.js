/* D-296 (étape 6 a de CH-064) — LECTURE LiDAR EN RUST DANS LA PAGE ESV : chargeur et bilan, monde MAIN.
 *
 * Injecté après vendor/lidar.js, vendor/ariane-lidar.js (coquille), vendor/ariane-lidar-wasm.js (module en base64) et
 * vendor/lidar-rust.js (variante de vendor/lidar.js, exportée sous BananeLidarRust), tous fabriqués par
 * tools/rust-lidar-paquet.cjs. Il compile le module une fois, installe le noyau (globalThis.ArianeLidarNoyau, lu par la seule
 * variante) et expose BananeLidarRustChargeur :
 *   pret()        vrai si le noyau est installé ;
 *   raison        pourquoi il ne l'est pas (module absent, taille fausse, compilation refusée par la page, version d'arène…) ;
 *   capture(o)    la capture de la variante (même contrat que BananeLidar.capture), servie par le noyau ;
 *   bilan(servi)  ce que la dernière capture a pris au noyau : tranches WASM, tranches rejouées en JS après une trappe,
 *                 nœuds laissés aux lectures d'origine (par raison).
 * Repli : rien ici ne lève. Sans noyau, adapter-page.js lit par vendor/lidar.js d'origine ; avec lui, un nœud non éligible
 * passe par la boucle d'origine et une tranche en trappe ou refusée est rejouée par le noyau JS équivalent (coquille). La sortie
 * de capture() est identique au bit près à celle de vendor/lidar.js (parité sur les 4 647 captures réelles, CH-064). */
(function(root){
 'use strict';
 const W=root.ArianeLidarWasm,M=root.ARIANE_LIDAR_WASM,V=root.BananeLidarRust;
 let noyau=null,raison=null,avant=null;
 try{
  if(!W||!V)raison='coquille ou variante absente';
  else if(!M||typeof M.base64!=='string')raison='module absent';
  else if(typeof WebAssembly!=='object')raison='WebAssembly indisponible';
  else{
   const b=atob(M.base64),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);
   if(o.length!==M.octets)raison='taille du module fausse';
   else{noyau=W.noyauWasm(new WebAssembly.Module(o));root.ArianeLidarNoyau=noyau;}
  }
 }catch(e){noyau=null;raison='chargement refusé : '+String(e&&e.message||e).slice(0,120);}
 const etat=()=>noyau?{tranches:noyau.tranches(),reprises:noyau.reprises(),refus:W.refus()}:null;
 const ecart=(a,b)=>{const r={};for(const k of Object.keys(b||{}))if((b[k]||0)-((a&&a[k])||0))r[k]=(b[k]||0)-((a&&a[k])||0);return r;};
 let dernier=null;
 async function capture(options){avant=etat();try{return await V.capture(options);}finally{const apres=etat();
   dernier=avant&&apres?{tranchesWasm:apres.tranches-avant.tranches-(apres.reprises-avant.reprises),tranchesRejouees:apres.reprises-avant.reprises,
    noeudsOrigine:ecart(avant.refus,apres.refus)}:null;}}
 function bilan(servi){
  if(!servi)return {module:'lidar',servi:false,repli:true,raison:raison||'réglage coupé'};
  const d=dernier||{tranchesWasm:0,tranchesRejouees:0,noeudsOrigine:{}};
  return {module:'lidar',servi:d.tranchesWasm>0,repli:d.tranchesRejouees>0||Object.keys(d.noeudsOrigine).length>0||d.tranchesWasm===0,
   raison:d.tranchesRejouees>0?'trappe':Object.keys(d.noeudsOrigine)[0]||(d.tranchesWasm===0?'aucun nœud éligible':null),...d};
 }
 root.BananeLidarRustChargeur=Object.freeze({pret:()=>noyau!==null,get raison(){return raison;},capture,bilan});
})(typeof globalThis!=='undefined'?globalThis:this);
