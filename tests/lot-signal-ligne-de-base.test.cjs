'use strict';
/* CH-062 — patch de la page (chantiers/CH-062/adaptateur-ligne-de-base.patch), APPLIQUÉ au tronc par l'intégrateur (06/11) : l'essai le vérifie, puis lit
 * src/adapter-page.js tel quel. Avant l'application, il l'appliquait à une copie.
 * L'essai applique le patch à une copie temporaire de src/adapter-page.js et joue la lecture rapide dans la page simulée au rythme des images
 * (tests/helpers/esv-images.cjs), avec un compteur de Potree bloqué après des requêtes de points en échec (HTTP 502), comme sur le terrain.
 * Si l'outil `patch` manque, l'essai se saute. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'..'),SRC=path.join(racine,'src/adapter-page.js'),PATCH=path.join(racine,'chantiers/CH-062/adaptateur-ligne-de-base.patch');
/* Le patch touche src/adapter-page.js et src/esv-observer.js : appliqué à une copie des deux, dans un dossier temporaire. Sans l'outil `patch`, l'essai
 * se saute ; un patch qui ne s'applique plus est un ÉCHEC. */
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch062-')),copie=path.join(dir,'src/adapter-page.js');fs.mkdirSync(path.join(dir,'src'));
for(const f of ['adapter-page.js','esv-observer.js'])fs.copyFileSync(path.join(racine,'src',f),path.join(dir,'src',f));
const DEJA=fs.readFileSync(SRC,'utf8').includes('chargementsEffectifs')||undefined;
const r=DEJA?{status:0}:spawnSync('patch',['-s','-p1','-d',dir,'-i',PATCH],{encoding:'utf8'}),raison=r.error?.code==='ENOENT'?'outil patch absent':null;
const opts=raison?{skip:raison}:{};
test('le patch est appliqué au tronc (ou s’y applique)',opts,()=>{assert.equal(r.status,0,'patch : '+(r.stderr||r.stdout));if(DEJA)assert.equal(spawnSync('patch',['-s','-p1','-R','--dry-run','-d',racine,'-i',PATCH],{encoding:'utf8'}).status,0,'le tronc porte exactement ce patch');});
/* La page simulée lit src/adapter-page.js : on lui sert la copie patchée, avec un PerformanceObserver qui rend les ressources données (ou aucun). */
let ressources=[],reglage={},sansObservateur=false;
const lire=fs.readFileSync;fs.readFileSync=function(f,...a){if(!raison&&path.resolve(String(f))===SRC)return lire.call(fs,copie,...a);return lire.call(fs,f,...a);};
const P=require('./helpers/page.cjs'),pageOrig=P.page;
P.page=({globals={},...o}={})=>pageOrig({...o,globals:{...globals,
 ...(sansObservateur?{}:{PerformanceObserver:class{constructor(f){this.f=f;}observe(){this.f({getEntries:()=>ressources});}}}),
 BananeSettings:{...globals.BananeSettings,lot:{...globals.BananeSettings?.lot,signalEteint:{...globals.BananeSettings?.lot?.signalEteint,...reglage}}}}});
const {esv,nuage}=require('./helpers/esv-images.cjs');
const J=x=>JSON.parse(JSON.stringify(x??null));   /* objets du contexte vm : copiés dans ce contexte-ci pour deepStrictEqual */
const lus=f=>J(f.progress.filter(p=>p.stage==='capture-read').map(p=>p.detail));
const evts=f=>J(f.reponses.filter(m=>m.kind==='banane5:evt').map(m=>m.event));
async function lire1({chargements,echecs,allume,declencheur='signal',absent=false,noeud=null}){reglage={ligneDeBaseEchecs:allume,declencheur,zoneRailM:3};sansObservateur=absent;
 ressources=Array.from({length:echecs},(_,i)=>({name:`/x/ept-data/${i}-0-0-0.bin`,responseStatus:502}))
  .concat([{name:'/x/ept-data/1-0-0-1.bin',responseStatus:200},{name:'/x/ept-hierarchy/0-0-0-0.json',responseStatus:502}]);
 const f=esv({cut:100,chargements}),pc=nuage(f);
 /* Arbre de Potree : une racine et le nœud en échec « 0-0-0-0 », avec sa boîte dans le repère du nuage (matrice identité). */
 if(noeud){pc.pcoGeometry={root:{filename:()=>'r',children:{0:{filename:()=>'0-0-0-0',boundingBox:noeud,children:{}}}}};pc.matrixWorld={elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]};}
 const before=await f.call('state'),capture=J(await f.call('capture',before));return {d:lus(f),f,capture,before};}
const boite=(min,max)=>({min:{x:min[0],y:min[1],z:min[2]},max:{x:max[0],y:max[1],z:max[2]}});

test('ligne de base : coupé = repli ; allumé = signal ; vrai chargement = repli ; échec non vu = repli ; journal [compteur, échecs, motif]',opts,async()=>{
 try{
  let {d}=await lire1({chargements:1,echecs:1,allume:false});assert.deepEqual(d.map(x=>x.regle),['stabilite','stabilite'],'coupé : le repli d’aujourd’hui');
  assert.equal(d[0].diag.lb,undefined,'coupé : aucun champ ajouté au diagnostic');
  ({d}=await lire1({chargements:1,echecs:1,allume:true}));assert.deepEqual(d.map(x=>x.regle),['signal','signal'],'allumé : compteur effectif nul, lecture au signal');
  assert.deepEqual(d[0].diag.lb,[1,1,null],'compteur brut, échecs, pas de repli');assert.equal(d[0].diag.nl[0],0,'compteur effectif');
  ({d}=await lire1({chargements:2,echecs:1,allume:true}));assert.deepEqual(d.map(x=>x.regle),['stabilite','stabilite'],'un vrai chargement en cours : repli');
  assert.equal(d[0].diag.m,'chargements');assert.deepEqual(d[0].diag.lb,[2,1,null]);
  ({d}=await lire1({chargements:1,echecs:0,allume:true}));assert.deepEqual(d.map(x=>x.regle),['stabilite','stabilite'],'échec non vu (hiérarchie seulement) : repli');
 }finally{}
});

test('ligne de base : compteur SOUS les échecs, ou observateur absent : repli d’aujourd’hui et un événement « ligne-base-repli » par épisode',opts,async()=>{
 let {d,f}=await lire1({chargements:1,echecs:2,allume:true});
 assert.deepEqual(d.map(x=>x.regle),['stabilite','stabilite'],'compteur sous les échecs : repli');assert.deepEqual(d[0].diag.lb,[1,2,'sous']);
 let e=evts(f).filter(x=>x.kind==='ligne-base-repli');assert.equal(e.length,1,'un seul événement pour l’épisode');assert.deepEqual([e[0].motif,e[0].compteur,e[0].echecs],['sous',1,2]);
 ({d,f}=await lire1({chargements:1,echecs:1,allume:true,absent:true}));
 assert.deepEqual(d.map(x=>x.regle),['stabilite','stabilite'],'sans observateur : repli');assert.deepEqual(d[0].diag.lb,[1,0,'absent']);
 e=evts(f).filter(x=>x.kind==='ligne-base-repli');assert.equal(e.length,1);assert.equal(e[0].motif,'absent');
});

test('nœud en échec : clé relevée, `touche` vrai s’il coupe la zone du rail, faux loin du rail, null s’il est introuvable',opts,async()=>{
 try{
  const pres=await lire1({chargements:1,echecs:1,allume:true,noeud:boite([-1,-1,-1],[2,2,2])});
  assert.deepEqual(pres.capture.readStrategy.trouEchec,{noeuds:1,cles:['0-0-0-0'],touche:true,trouves:1});
  const loin=await lire1({chargements:1,echecs:1,allume:true,noeud:boite([100,100,100],[120,120,120])});assert.equal(loin.capture.readStrategy.trouEchec.touche,false);
  const sans=await lire1({chargements:1,echecs:1,allume:true});assert.equal(sans.capture.readStrategy.trouEchec.touche,null,'arbre de Potree illisible : inconnu');
  const coupe=await lire1({chargements:1,echecs:1,allume:false});assert.equal(coupe.capture.readStrategy.trouEchec,undefined,'tout coupé : rien relevé');
  const trou=await lire1({chargements:1,echecs:1,allume:false,declencheur:'trou',noeud:boite([-1,-1,-1],[2,2,2])});
  assert.equal(trou.capture.readStrategy.trouEchec.touche,true,'déclencheur « trou » seul : relevé, sans ligne de base');assert.deepEqual(trou.d.map(x=>x.regle),['stabilite','stabilite']);
 }finally{fs.readFileSync=lire;P.page=pageOrig;}
});
