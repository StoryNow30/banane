'use strict';
/* CH-062 — patch PROPOSÉ de la page (chantiers/CH-062/adaptateur-ligne-de-base.patch, NON appliqué : src/adapter-page.js est hors du chantier).
 * L'essai applique le patch à une copie temporaire de src/adapter-page.js et joue la lecture rapide dans la page simulée au rythme des images
 * (tests/helpers/esv-images.cjs), avec un compteur de Potree bloqué à 1 après une requête de points en échec (HTTP 502), comme sur le terrain.
 * Réglage coupé : repli (comme aujourd'hui) ; allumé : lecture au signal ; compteur supérieur aux échecs (vrai chargement) : repli ; échec non vu
 * (aucun relevé de ressource) : repli. Si l'outil `patch` manque, l'essai se saute. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'..'),SRC=path.join(racine,'src/adapter-page.js'),PATCH=path.join(racine,'chantiers/CH-062/adaptateur-ligne-de-base.patch');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch062-')),copie=path.join(dir,'adapter-page.js');
const r=spawnSync('patch',['-s','-o',copie,SRC,PATCH],{encoding:'utf8'}),raison=r.status===0?null:'patch indisponible : '+(r.stderr||r.error?.message||r.status);
const opts=raison?{skip:raison}:{};
/* La page simulée lit src/adapter-page.js : on lui sert la copie patchée, et on lui ajoute un PerformanceObserver qui rend les ressources données. */
let ressources=[],ligneDeBase=false;
const lire=fs.readFileSync;fs.readFileSync=function(f,...a){if(!raison&&path.resolve(String(f))===SRC)return lire.call(fs,copie,...a);return lire.call(fs,f,...a);};
const P=require('./helpers/page.cjs'),pageOrig=P.page;
P.page=({globals={},...o}={})=>pageOrig({...o,globals:{...globals,
 PerformanceObserver:class{constructor(f){this.f=f;}observe(){this.f({getEntries:()=>ressources});}},
 BananeSettings:{...globals.BananeSettings,lot:{...globals.BananeSettings?.lot,signalEteint:{...globals.BananeSettings?.lot?.signalEteint,ligneDeBaseEchecs:ligneDeBase}}}}});
const {esv,nuage}=require('./helpers/esv-images.cjs');
const lus=f=>f.progress.filter(p=>p.stage==='capture-read').map(p=>p.detail);
async function lire1({chargements,echecs,allume}){ligneDeBase=allume;
 ressources=Array.from({length:echecs},(_,i)=>({name:`https://hote/x/ept-data/${i}-0-0-0.bin`,responseStatus:502}))
  .concat([{name:'https://hote/x/ept-data/1-0-0-1.bin',responseStatus:200},{name:'https://hote/x/ept-hierarchy/0-0-0-0.json',responseStatus:502}]);
 const f=esv({cut:100,chargements});nuage(f);const before=await f.call('state');await f.call('capture',before);return lus(f);}

test('patch de la ligne de base : coupé = repli ; allumé = signal ; vrai chargement en plus = repli ; échec non vu = repli',opts,async()=>{
 try{
  let d=await lire1({chargements:1,echecs:1,allume:false});assert.deepEqual(d.map(x=>x.regle),['stabilite','stabilite'],'coupé : le repli d’aujourd’hui');
  assert.equal(d[0].diag.ech,undefined,'coupé : aucun champ ajouté au diagnostic');
  d=await lire1({chargements:1,echecs:1,allume:true});assert.deepEqual(d.map(x=>x.regle),['signal','signal'],'allumé : compteur effectif nul, lecture au signal');
  assert.equal(d[0].diag.ech,1);assert.deepEqual(d[0].diag.nl[0],0,'compteur effectif');
  d=await lire1({chargements:2,echecs:1,allume:true});assert.deepEqual(d.map(x=>x.regle),['stabilite','stabilite'],'un vrai chargement en cours : repli');
  assert.equal(d[0].diag.m,'chargements');
  d=await lire1({chargements:1,echecs:0,allume:true});assert.deepEqual(d.map(x=>x.regle),['stabilite','stabilite'],'échec non vu (hiérarchie seulement) : repli');
 }finally{fs.readFileSync=lire;P.page=pageOrig;}
});
