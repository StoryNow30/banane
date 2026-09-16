/* Présence du corpus Natif privé, partagée par le banc et par les tests qui en
 * dépendent.
 *
 * `datasets/native/` n'est pas versionné : 47 Mo d'exports Natif/LiDAR bruts,
 * exclus sur consigne. Deux tests ne peuvent donc pas s'exécuter depuis un
 * clone GitHub propre. Ils sont IGNORÉS, pas réussis — un test ignoré se lit
 * `# SKIP` avec sa raison dans la sortie TAP, et le banc le compte à part.
 *
 * Le mode complet (`--full`, ou BANANE_BANC=full) exige au contraire le corpus
 * et refuse tout test ignoré : c'est celui du poste de travail, le seul qui
 * autorise à annoncer un banc entièrement vert.
 *
 * Voir datasets/native/README.md. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const DIRECTORY='datasets/native/reference/Banane';
const REQUIRED=['banane-native-v4-1789117835514.json','banane-native-v4-1789120447962.json','banane-native-v4-1789125861104.json'];
const REASON='corpus Natif privé absent (datasets/native/) : test ignoré, pas réussi. Voir datasets/native/README.md.';
const missing=(root=ROOT)=>REQUIRED.filter(name=>!fs.existsSync(path.join(root,DIRECTORY,name)));
const present=(root=ROOT)=>missing(root).length===0;
// Valeur prête pour l'option `skip` de node:test : false, ou la raison en clair.
const skip=(root=ROOT)=>present(root)?false:REASON;
const status=(root=ROOT)=>{const absents=missing(root);
 return {directory:DIRECTORY,required:REQUIRED,missing:absents,present:absents.length===0,
   mode:absents.length===0?'full':'partial',reason:absents.length===0?null:REASON};};
module.exports={ROOT,DIRECTORY,REQUIRED,REASON,missing,present,skip,status};
