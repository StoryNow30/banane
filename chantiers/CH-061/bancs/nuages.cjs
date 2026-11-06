/* CH-061 : lit les nuages capturés réels (banane-lidar-capture-v1) dans les zips de banane-data, sans rien copier dans le dépôt.
 * Chemin des collections : variable BANANE_DATA (défaut /home/user/data/banane-data). */
'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const DATA=process.env.BANANE_DATA||'/home/user/data/banane-data';
function zips(){
  const out=[];const c=path.join(DATA,'collections');
  for(const d of fs.readdirSync(c)){const r=path.join(c,d,'raw');if(!fs.existsSync(r))continue;
    for(const f of fs.readdirSync(r).sort())if(/-ariane-lot-.*\.zip$/.test(f))out.push(path.join(r,f));}
  return out;
}
/* Champs lus par la géométrie (grep de src/geometry*.js, gcv1-shadow.js, placement-convention.js, lot-decision.js). */
const reduire=c=>({captureId:c.captureId,identity:c.identity,rails:c.rails,pointsSceneRelative:c.pointsSceneRelative,
  visibleByClipBoxes:c.visibleByClipBoxes,camera:c.camera,viewCaptures:c.viewCaptures});
/* Rend jusqu'à `max` nuages, en ordre stable (zip, segment, rang). */
function nuages(max=Infinity){
  const out=[];
  for(const z of zips()){
    const liste=execFileSync('unzip',['-Z1',z],{encoding:'utf8'}).split('\n').filter(n=>/gcv1-corpus-.*\.json$/.test(n)).sort();
    for(const n of liste){
      const j=JSON.parse(execFileSync('unzip',['-p',z,n],{maxBuffer:1<<30}).toString('utf8'));
      for(const c of j.clouds||[]){if(c.format==='banane-lidar-capture-v1'&&c.pointsSceneRelative?.length)out.push(reduire(c));if(out.length>=max)return out;}
    }
  }
  return out;
}
module.exports={nuages,zips,DATA};
