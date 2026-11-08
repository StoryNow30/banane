#!/usr/bin/env node
/* CH-065 : quatre patchs séparables, sous forme de remplacements exacts (chantiers/CH-065/blocs.json : patch → fichier → [[ancien, nouveau], …]).
 *   lidar-direct           vendor/lidar.js                 lecture directe du tampon, sans allocation par point
 *   geometrie-elaguee-lot  src/geometry-candidate-v1.js    recherche élaguée du moteur du lot (GCV1)
 *   geometrie-elaguee-v46  src/geometry.js                 recherche élaguée du moteur V4.6 gelé
 *   mediane-exacte         src/geometry-candidate-v1.js    médiane par tri natif quand l'ordre est le même (robustLine, characterize)
 * Source unique : les fichiers .patch en sont tirés (`patchs`) ; les essais et les gardes s'en servent dans les deux sens, ce qui les garde valables
 * quel que soit le sous-ensemble de patchs appliqué par l'intégrateur.
 *   node chantiers/CH-065/appliquer.cjs etat [RACINE]                         patchs présents dans l'arbre
 *   node chantiers/CH-065/appliquer.cjs appliquer RACINE [patch,patch…]      applique (défaut : les quatre)
 *   node chantiers/CH-065/appliquer.cjs patchs                                réécrit les .patch depuis blocs.json */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const PATCHS=require('./blocs.json'),NOMS=Object.keys(PATCHS);
const FICHIERS=[...new Set(NOMS.flatMap(n=>Object.keys(PATCHS[n])))];
const BLOCS=Object.fromEntries(FICHIERS.map(f=>[f,NOMS.filter(n=>PATCHS[n][f]).flatMap(n=>PATCHS[n][f])]));
const compte=(t,s)=>t.split(s).length-1;
const une=(t,a,b,f)=>{const n=compte(t,a);if(n!==1)throw Error(`CH-065 : bloc attendu une fois, trouvé ${n} fois dans ${f}`);return t.replace(a,()=>b);};
/* État d'un patch dans un fichier : 'present' | 'absent' ; tout autre cas lève (fichier à moitié patché ou modifié autour des blocs). */
function etatPatch(nom,f,t){const p=PATCHS[nom][f];
  if(p.every(([a,b])=>compte(t,a)===1&&!t.includes(b)))return 'absent';
  if(p.every(([,b])=>compte(t,b)===1))return 'present';
  throw Error(`CH-065 : ${f} ni avec ni sans le patch ${nom}`);}
const presents=(f,t)=>NOMS.filter(n=>PATCHS[n][f]&&etatPatch(n,f,t)==='present');
const patcher=(f,t,noms=NOMS)=>noms.filter(n=>PATCHS[n][f]).reduce((t,n)=>PATCHS[n][f].reduce((t,[a,b])=>une(t,a,b,f),t),t);
const retirer=(f,t,noms=NOMS)=>noms.filter(n=>PATCHS[n][f]).reduce((t,n)=>PATCHS[n][f].slice().reverse().reduce((t,[a,b])=>une(t,b,a,f),t),t);
/* origine : sans aucun bloc de CH-065 ; patche : avec les patchs `noms` (défaut : tous) ; presents : ceux de l'arbre. */
function versions(racine,f,noms=NOMS){const t=fs.readFileSync(path.join(racine,f),'utf8'),p=presents(f,t),origine=retirer(f,t,p);
  return {origine,patche:patcher(f,origine,noms),presents:p,etat:p.length?'patché':'origine'};}
module.exports={PATCHS,NOMS,FICHIERS,BLOCS,etatPatch,presents,patcher,retirer,versions};
if(require.main===module){
  const [cmd,racine=path.resolve(__dirname,'../..'),liste]=process.argv.slice(2);
  if(cmd==='etat'){for(const n of NOMS)console.log(n.padEnd(22),Object.keys(PATCHS[n]).map(f=>f+' '+etatPatch(n,f,fs.readFileSync(path.join(racine,f),'utf8'))).join(' ; '));}
  else if(cmd==='appliquer'){const noms=liste?liste.split(','):NOMS;for(const n of noms)if(!PATCHS[n])throw Error('patch inconnu : '+n);
    for(const f of FICHIERS){const p=path.join(racine,f),t=fs.readFileSync(p,'utf8'),a=noms.filter(n=>PATCHS[n][f]);if(!a.length)continue;
      for(const n of a)if(etatPatch(n,f,t)!=='absent')throw Error(f+' : '+n+' déjà présent');fs.writeFileSync(p,patcher(f,t,a));console.log('patché',f,a.join(','));}}
  else if(cmd==='patchs'){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ch065-'));
    for(const n of NOMS){let txt='';
      for(const f of Object.keys(PATCHS[n])){const o=versions(racine,f).origine,a=path.join(tmp,'a'),b=path.join(tmp,'b');
        fs.writeFileSync(a,o);fs.writeFileSync(b,patcher(f,o,[n]));
        txt+=spawnSync('diff',['-u','--label','a/'+f,'--label','b/'+f,a,b],{encoding:'utf8'}).stdout;}
      fs.writeFileSync(path.join(__dirname,n+'.patch'),txt);console.log('écrit',n+'.patch');}}
  else{console.error('usage : etat|appliquer RACINE [patchs]|patchs');process.exit(2);}
}
