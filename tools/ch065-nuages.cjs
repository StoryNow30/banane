/* CH-065 : nuages capturés réels (format banane-lidar-capture-v1) lus dans les zips de banane-data, sans rien copier dans ce dépôt.
 * Parcourt TOUS les fichiers JSON de toutes les archives des collections choisies (lot, Écho, liste, bilan…) et retient tout objet
 * au format banane-lidar-capture-v1 qui porte des points. Doublons (même captureId et mêmes points) écartés.
 * Variables : BANANE_DATA (défaut /home/user/data/banane-data), CH065_COLLECTIONS (préfixes séparés par des virgules,
 * défaut « 2026-11-04,2026-11-05,2026-11-06 »).
 * Usage direct : node tools/ch065-nuages.cjs  → inventaire par collection. */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const DATA=process.env.BANANE_DATA||'/home/user/data/banane-data';
const PREFIXES=(process.env.CH065_COLLECTIONS||'2026-11-04,2026-11-05,2026-11-06').split(',').map(s=>s.trim()).filter(Boolean);
function zips(){
  const out=[],c=path.join(DATA,'collections');if(!fs.existsSync(c))return out;
  for(const d of fs.readdirSync(c).sort()){if(!PREFIXES.some(p=>d.startsWith(p)))continue;const r=path.join(c,d,'raw');if(!fs.existsSync(r))continue;
    for(const f of fs.readdirSync(r).sort())if(f.endsWith('.zip'))out.push({collection:d,zip:path.join(r,f)});}
  return out;
}
/* Recherche en profondeur des captures ; les tableaux de points ne sont pas parcourus. */
function trouver(o,out,prof=0){
  if(!o||typeof o!=='object'||prof>12)return;
  if(o.format==='banane-lidar-capture-v1'&&Array.isArray(o.pointsSceneRelative)){out.push(o);return;}
  if(Array.isArray(o)){if(o.length&&typeof o[0]!=='object')return;for(const x of o)trouver(x,out,prof+1);return;}
  for(const k of Object.keys(o))trouver(o[k],out,prof+1);
}
/* Parcourt les nuages un par un (rappel), sans tout garder en mémoire. */
function parcourir(rappel,max=Infinity){
  const vus=new Set();let n=0;
  for(const {collection,zip} of zips()){
    const liste=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).split('\n').filter(x=>x.endsWith('.json')).sort();
    for(const nom of liste){
      let j;try{j=JSON.parse(execFileSync('unzip',['-p',zip,nom],{maxBuffer:2**31-1}).toString('utf8'));}catch{continue;}
      const trouves=[];trouver(j,trouves);j=null;
      for(const c of trouves){
        const cle=crypto.createHash('sha256').update(String(c.captureId)+'|'+JSON.stringify(c.pointsSceneRelative)).digest('hex');
        if(vus.has(cle))continue;vus.add(cle);
        if(rappel(c,{collection,zip:path.basename(zip),fichier:nom,rang:n})===false)return n+1;
        if(++n>=max)return n;
      }
    }
  }
  return n;
}
function nuages(max=Infinity){const out=[];parcourir(c=>{out.push(c);},max);return out;}
module.exports={zips,parcourir,nuages,DATA,PREFIXES};
if(require.main===module){
  const par={};let points=0,vides=0;
  const n=parcourir((c,o)=>{const k=o.collection;par[k]=par[k]||{nuages:0,points:0,vides:0};par[k].nuages++;par[k].points+=c.pointsSceneRelative.length;points+=c.pointsSceneRelative.length;
    if(!c.pointsSceneRelative.length){par[k].vides++;vides++;}});
  console.log(JSON.stringify({nuages:n,points,vides,parCollection:par},null,1));
}
