#!/usr/bin/env node
/* CH-065 : les deux patchs, sous forme de remplacements exacts (chantiers/CH-065/blocs.json : [ancien, nouveau] par fichier).
 * Source unique des patchs : les fichiers .patch de ce dossier en sont tirés (`patchs`), les essais s'en servent dans les deux sens
 * (`patcher` : tronc → patché ; `retirer` : patché → tronc), ce qui les garde valables avant ET après l'application par l'intégrateur.
 *   node chantiers/CH-065/appliquer.cjs etat [RACINE]        état de chaque fichier : origine | patché
 *   node chantiers/CH-065/appliquer.cjs appliquer RACINE      applique les patchs à l'arbre RACINE (refuse s'il n'est pas à l'origine)
 *   node chantiers/CH-065/appliquer.cjs patchs                réécrit lidar-direct.patch et geometrie-elaguee.patch depuis blocs.json */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const BLOCS=require('./blocs.json');
const GROUPES={'lidar-direct.patch':['vendor/lidar.js'],'geometrie-elaguee.patch':['src/geometry.js','src/geometry-candidate-v1.js']};
const une=(t,a,b,f)=>{const n=t.split(a).length-1;if(n!==1)throw Error(`CH-065 : bloc attendu une fois, trouvé ${n} fois dans ${f}`);return t.replace(a,()=>b);};
function etat(f,t){const p=BLOCS[f];if(!p)throw Error('fichier hors patch : '+f);
  if(p.every(([a])=>t.split(a).length===2)&&p.every(([,b])=>!t.includes(b)))return 'origine';
  if(p.every(([,b])=>t.split(b).length===2))return 'patché';
  return 'inconnu';}
const patcher=(f,t)=>BLOCS[f].reduce((t,[a,b])=>une(t,a,b,f),t);
const retirer=(f,t)=>BLOCS[f].slice().reverse().reduce((t,[a,b])=>une(t,b,a,f),t);
/* Texte d'origine et texte patché d'un fichier, quel que soit l'état de l'arbre. */
function versions(racine,f){const t=fs.readFileSync(path.join(racine,f),'utf8'),e=etat(f,t);
  if(e==='origine')return {origine:t,patche:patcher(f,t),etat:e};
  if(e==='patché')return {origine:retirer(f,t),patche:t,etat:e};
  throw Error(`CH-065 : ${f} n'est ni à l'origine ni patché`);}
module.exports={BLOCS,GROUPES,etat,patcher,retirer,versions};
if(require.main===module){
  const [cmd,racine=path.resolve(__dirname,'../..')]=process.argv.slice(2);
  if(cmd==='etat'){for(const f of Object.keys(BLOCS))console.log(f,etat(f,fs.readFileSync(path.join(racine,f),'utf8')));}
  else if(cmd==='appliquer'){for(const f of Object.keys(BLOCS)){const p=path.join(racine,f),t=fs.readFileSync(p,'utf8');
    if(etat(f,t)!=='origine')throw Error(f+' : pas à l\'origine');fs.writeFileSync(p,patcher(f,t));console.log('patché',f);}}
  else if(cmd==='patchs'){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ch065-'));
    for(const [nom,fichiers] of Object.entries(GROUPES)){let txt='';
      for(const f of fichiers){const v=versions(racine,f),a=path.join(tmp,'a'),b=path.join(tmp,'b');
        fs.writeFileSync(a,v.origine);fs.writeFileSync(b,v.patche);
        const d=spawnSync('diff',['-u','--label','a/'+f,'--label','b/'+f,a,b],{encoding:'utf8'});txt+=d.stdout;}
      fs.writeFileSync(path.join(__dirname,nom),txt);console.log('écrit',nom);}}
  else{console.error('usage : etat|appliquer RACINE|patchs');process.exit(2);}
}
