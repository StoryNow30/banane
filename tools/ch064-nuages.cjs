'use strict';
/* CH-064 : nuages capturés réels (format banane-lidar-capture-v1), lus dans les zips de banane-data sans rien copier ici.
 * Repris de chantiers/CH-061/bancs/nuages.cjs (branche chantier/CH-061, ca08c48), étendu à TOUTES les entrées
 * gcv1-corpus-*.json des collections du 04/11 et du 05/11 (tools/ch064-corpus.cjs), dédoublonnées par captureId.
 * reduire : seulement les champs lus par la géométrie et la décision de pose (liste de CH-061). */
const {zips,entrees}=require('./ch064-corpus.cjs'),{execFileSync}=require('node:child_process');
const reduire=c=>({captureId:c.captureId,identity:c.identity,rails:c.rails,pointsSceneRelative:c.pointsSceneRelative,
 visibleByClipBoxes:c.visibleByClipBoxes,camera:c.camera,viewCaptures:c.viewCaptures});
/* Itère les nuages (ordre stable : zip, entrée, rang), au plus `max`, chacun une seule fois. */
function*nuages(max=Infinity){const vus=new Set();let n=0;
 for(const z of zips())for(const e of entrees(z).filter(x=>/gcv1-corpus-.*\.json$/.test(x)).sort()){
  const j=JSON.parse(execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1}).toString('utf8'));
  for(const c of j.clouds||[]){if(c.format!=='banane-lidar-capture-v1'||!c.pointsSceneRelative?.length||vus.has(c.captureId))continue;
   vus.add(c.captureId);yield reduire(c);if(++n>=max)return;}}}
module.exports={nuages,reduire};
