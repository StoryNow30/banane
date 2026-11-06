'use strict';
/* CH-067 (audit de CH-059) — RETOUR ARRIÈRE EN PLEIN LOT vers un paquet antérieur (qui ignore les morceaux).
 * src/etat-morceaux.js coupe aussi les listes du LOT (`batch.processed`, `deferred`, `sequence`, …) et les écrit VIDES dans
 * `banane3State`. La parade du retour arrière (`enLigne`) ne couvre que `native.cloudIds` ; `tools/ch059-retour-arriere.cjs`
 * n'essaie qu'une session Écho, jamais un lot.
 * Scénario : lot de la partie 8 en pause au cut 43 (40 cuts posés, 3 différés) ; l'opérateur réinstalle le paquet précédent
 * (2bc1f56) ; son `getState` relit `banane3State` tel quel : lot PAUSED avec 0 posé et 0 différé. Rattrapage, relecture, compteurs
 * de la file et contrôle « déjà différé » (src/engine.js) travaillent à vide ; s'il diffère de nouveau le cut 41, la remise à
 * jour recolle les deux listes : le cut 41 deux fois, même clé.
 * Faux chrome.storage.local (tests/helpers/journee-etat.cjs), données synthétiques.   node --test tests/ch067-morceaux-retour-lot.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const J=require('./helpers/journee-etat.cjs');

const lot=()=>({id:'lot-r',state:'PAUSED',scope:{part:8},processed:Array.from({length:40},(_,i)=>({key:'k'+i,cut:i,identity:{part:8,cut:i}})),
 deferred:[41,42,43].map(c=>({key:'d'+c,cut:c,identity:{part:8,cut:c}})),sequence:[],skipped:[],paused:[],interrupted:[],manuallyCompleted:[]});
const etat=()=>({schemaVersion:4,mode:'observation',events:[],records:[],batch:lot(),settings:{}});

test('un paquet antérieur (lecture brute de banane3State) relit les cuts posés et différés du lot en cours',async()=>{
 const fc=J.fauxChrome(),s=J.magasin(fc);await s.setState(etat());
 const ancien=fc.disque.get('banane3State');   /* ce que lit `getState` du paquet antérieur, tel quel */
 assert.equal(ancien.batch.processed.length,40,'cuts posés du lot vus par le paquet antérieur');
 assert.equal(ancien.batch.deferred.length,3,'cuts différés du lot vus par le paquet antérieur');
});

test('aller-retour : un cut différé de nouveau par le paquet antérieur n’est pas recollé deux fois',async()=>{
 const fc=J.fauxChrome(),s=J.magasin(fc);await s.setState(etat());
 /* Le paquet antérieur ne voit pas le cut 41 différé (liste vide) : il le diffère de nouveau, même clé, et réécrit tout l'état. */
 const ancien=JSON.parse(JSON.stringify(fc.disque.get('banane3State')));
 if(!ancien.batch.deferred.some(d=>d.key==='d41'))ancien.batch.deferred.push({key:'d41',cut:41,identity:{part:8,cut:41}});
 fc.disque.set('banane3State',ancien);
 const relu=await J.magasin(fc).getState(),cles=relu.batch.deferred.map(d=>d.key);
 assert.deepEqual(cles,[...new Set(cles)],'une clé de différé une seule fois');
});

/* Preuve sur le VRAI paquet antérieur (arbre 2bc1f56, moteur et stockage d'alors), si l'historique est là. */
const arbre=(()=>{const r=spawnSync('git',['cat-file','-t','2bc1f56'],{cwd:path.join(__dirname,'..'),encoding:'utf8'});return r.status===0&&r.stdout.trim()==='commit';})();
test('moteur de 2bc1f56 relancé sur l’état écrit par le tronc : lot repris avec ses cuts posés et différés',{skip:arbre?false:'historique 2bc1f56 absent'},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch067-ancien-'));
 try{const a=spawnSync('sh',['-c',`git archive 2bc1f56 src vendor | tar -x -C "${dir}"`],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
  assert.equal(a.status,0,a.stderr);
  const fc=J.fauxChrome(),s=J.magasin(fc);await s.setState(etat());
  globalThis.chrome=fc.chrome;const {Engine}=require(path.join(dir,'src/engine.js'));
  delete globalThis.BananeStorage3;require(path.join(dir,'src/storage.js'));const st=new globalThis.BananeStorage3();
  Object.assign(st,{putEvent:async()=>{},putRecord:async()=>{},all:async()=>[],getRecord:async()=>undefined,archiverVisites:async()=>{}});
  const e=new Engine({state:async()=>null},st);await e.init();
  assert.equal(e.s.batch?.state,'PAUSED');
  assert.deepEqual([e.s.batch.processed.length,e.s.batch.deferred.length],[40,3],'posés et différés relus par le moteur antérieur');}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
