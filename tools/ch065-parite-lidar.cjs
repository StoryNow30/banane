#!/usr/bin/env node
/* CH-065 : parité de capture() de vendor/lidar.js, d'origine contre patché (chantiers/CH-065/lidar-direct.patch), sur les nuages réels
 * de banane-data (tools/ch065-nuages.cjs) placés dans une scène Potree factice (tools/ch065-scene.js).
 * Comparés, champ par champ et au bit (Object.is, −0 et NaN compris) : la sortie entière de capture() hors `capturedAt` et `durationMs`,
 * l'exception levée (nom et message), et la suite des appels guard()/pause() (mêmes points d'arrêt).
 *  - chaque nuage, variante « reel » (ses points, 19 nœuds Float32) ;
 *  - un nuage sur --pas (défaut 25) : toutes les variantes de tools/ch065-scene.js (Float64, entrelacé, indexé, normalisé, non finis,
 *    découpe, drawRange fractionnaire, plafonds, pauses, transformation non finie, vue vide, un point) ;
 *  - un nuage sur --pas-plein (défaut 100) : 505 000 points (remplissage), comme au terrain.
 * Usage : node tools/ch065-parite-lidar.cjs --reference RACINE --patche RACINE [--max N] [--sortie F.json]   Sortie 0 si tout est identique. */
'use strict';
const path=require('path'),fs=require('fs'),crypto=require('crypto');
const {parcourir,PREFIXES}=require('./ch065-nuages.cjs'),{scene,VARIANTES,THREE_FACTICE}=require('./ch065-scene.js');
/* Les classes d'attribut de la scène tiennent lieu de THREE.BufferAttribute de la page (reconnaissance par identité de fonction). */
globalThis.THREE=THREE_FACTICE;
/* CH065_SANS_THREE=1 : la page n'expose pas THREE, l'accesseur est inconnu : le patch passe par la preuve complète, tranche par tranche. */
if(process.env.CH065_SANS_THREE==='1')globalThis.THREE=undefined;   /* avant le chargement : l'instantané est vide */
function arg(n,d){const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:d;}
const REF=path.resolve(arg('--reference',path.join(__dirname,'..'))),PAT=arg('--patche',null),MAX=Number(arg('--max',Infinity));
const PAS=Number(arg('--pas',25)),PAS_PLEIN=Number(arg('--pas-plein',100)),SORTIE=arg('--sortie',null);
if(!PAT)throw Error('--patche RACINE manquant');
/* Espion posé AVANT le chargement des modules : le patch prend l'instantané des fonctions de THREE au chargement. */
const P=THREE_FACTICE.BufferAttribute.prototype,G0=P.getX;let lectures=0;P.getX=function(i){if(this.itemSize===3)lectures++;return G0.call(this,i);};
const LA=require(path.join(REF,'vendor/lidar.js')),LB=require(path.join(path.resolve(PAT),'vendor/lidar.js'));
if(LA===LB)throw Error('même module chargé deux fois');
function canon(v){
  if(typeof v==='number')return Object.is(v,-0)?'-0':Number.isNaN(v)?'NaN':v===Infinity?'Inf':v===-Infinity?'-Inf':String(v);
  if(v===null||v===undefined)return String(v);
  if(typeof v!=='object')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canon).join(',')+']';
  return '{'+Object.keys(v).filter(k=>k!=='capturedAt'&&k!=='durationMs').map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
}
async function jouer(L,c,nom,opts){
  const sc=scene(c,opts),appels=[];lectures=0;
  const options={viewer:sc.viewer,rails:sc.rails,origin:sc.origin,enums:sc.enums,guard:()=>appels.push('g'),pause:async()=>{appels.push('p');},meta:{captureId:'ch065'}};
  for(const k of ['maxPoints','maxInspected','yieldEvery'])if(opts[k]!==undefined)options[k]=opts[k];
  try{const o=await L.capture(options);return {sortie:canon(o),appels:appels.join(''),statut:o.status,retenus:o.quality.retained,lus:o.quality.inspected,accesseur:lectures};}
  catch(e){return {erreur:(e?.name||'')+': '+(e?.message||String(e)),appels:appels.join('')};}
}
(async()=>{
  const res={sansThree:process.env.CH065_SANS_THREE==='1',date:new Date().toISOString(),collections:PREFIXES,nuages:0,jeux:0,ecarts:0,premiersEcarts:[],parVariante:{},statuts:{},erreurs:{},ms:{reference:0,patche:0}};
  const hA=crypto.createHash('sha256'),hB=crypto.createHash('sha256');const file=[];
  parcourir((c,o)=>{if(c.rails?.left?.profileLocalToSceneRelative&&c.rails?.right?.profileLocalToSceneRelative)file.push({c:{rails:c.rails,pointsSceneRelative:c.pointsSceneRelative},o});},MAX);
  for(const [rang,{c,o}] of file.entries()){
    const jeux=[['reel',VARIANTES.reel]];
    if(rang%PAS===0)for(const [k,v] of Object.entries(VARIANTES))if(k!=='reel')jeux.push([k,v]);
    if(rang%PAS_PLEIN===0)jeux.push(['plein-505000',{total:505000}]);
    for(const [nom,opts] of jeux){
      let t=performance.now();const a=await jouer(LA,c,nom,{graine:1234+rang,...opts});res.ms.reference+=performance.now()-t;
      t=performance.now();const b=await jouer(LB,c,nom,{graine:1234+rang,...opts});res.ms.patche+=performance.now()-t;
      const direct=b.accesseur!==undefined&&a.lus>0&&b.accesseur<a.lus/4;const pd=res.lectureDirecte=res.lectureDirecte||{};pd[nom]=(pd[nom]||0)+(direct?1:0);
      delete a.accesseur;delete b.accesseur;
      const ka=JSON.stringify(a),kb=JSON.stringify(b);hA.update(ka);hB.update(kb);res.jeux++;
      const pv=res.parVariante[nom]=res.parVariante[nom]||{jeux:0,ecarts:0};pv.jeux++;
      if(ka!==kb){res.ecarts++;pv.ecarts++;if(res.premiersEcarts.length<5)res.premiersEcarts.push({variante:nom,collection:o.collection,fichier:o.fichier,rang:o.rang,
        a:a.erreur||a.statut,b:b.erreur||b.statut});}
      if(a.erreur)res.erreurs[a.erreur]=(res.erreurs[a.erreur]||0)+1;else res.statuts[nom+' → '+a.statut]=(res.statuts[nom+' → '+a.statut]||0)+1;
    }
    res.nuages++;
    if(res.nuages%500===0)console.error(res.nuages,'nuages',res.jeux,'jeux, écarts',res.ecarts);
  }
  res.sha={reference:hA.digest('hex'),patche:hB.digest('hex')};res.ms.reference=Math.round(res.ms.reference);res.ms.patche=Math.round(res.ms.patche);
  console.log(JSON.stringify(res,null,1));if(SORTIE)fs.writeFileSync(SORTIE,JSON.stringify(res,null,1)+'\n');
  process.exit(res.ecarts||res.sha.reference!==res.sha.patche?1:0);
})();
