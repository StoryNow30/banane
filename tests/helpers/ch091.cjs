'use strict';
/* Module d'aide des essais CH-091 (tests/ch091-*.test.cjs).
 * CH-091 — REPRISE APRÈS UN ARRÊT DU SERVICE WORKER ENTRE LA CAPTURE « AVANT » ET L'ANALYSE. L'état durable porte alors l'étape `capture`
 * avec un avant déjà enregistré (`READY_FOR_AFTER`, nuage stocké) : la reprise rappelait begin(), qui refusait (« Capture avant déjà
 * ouverte ») et le lot finissait en ERREUR. Essais :
 *  1. arrêt à cet instant précis, reprise : le lot repart et se termine, avec les mêmes commandes qu'un lot sans arrêt ;
 *  2. arrêt simulé après CHAQUE écriture confirmée du lot (toute la coupe, pas seulement la fenêtre de CH-086), deux ordres de magasin,
 *     ESV qui relit ou « navigation seule » : jamais d'ERREUR, jamais de pose ni de validation en double, aucun SKIP, rien de perdu ;
 *  3. cas voisins : nuage absent du stockage, avant sans étape d'enregistrement finie, cible changée, rails modifiés, capture manuelle.
 * Le patch (chantiers/CH-091/engine.patch) est appliqué à une COPIE de src/engine.js tant que le tronc ne le porte pas ; ce module doit
 * être chargé AVANT tests/helpers/ch086.cjs, qui lit alors le moteur déjà en cache. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),{spawnSync}=require('node:child_process');
const SRC=path.resolve(__dirname,'../../src/engine.js'),PATCH=process.env.CH091_PATCH||path.resolve(__dirname,'../../chantiers/CH-091/engine.patch');
const MARQUE='captureAvantDejaFaite';
const ORIGINAL=fs.readFileSync(SRC,'utf8'),DEJA=ORIGINAL.includes(MARQUE);
let r={status:0},PATCHE=ORIGINAL;
if(!DEJA){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch091-'));fs.mkdirSync(path.join(dir,'src'));fs.writeFileSync(path.join(dir,'src/engine.js'),ORIGINAL);
 r=fs.existsSync(PATCH)?spawnSync('patch',['-s','-p1','-d',dir,'-i',PATCH],{encoding:'utf8'}):{status:1,stderr:'patch absent : '+PATCH};
 if(r.status===0)PATCHE=fs.readFileSync(path.join(dir,'src/engine.js'),'utf8');fs.rmSync(dir,{recursive:true,force:true});
 const m=new Module(SRC,module);m.filename=SRC;m.paths=Module._nodeModulePaths(path.dirname(SRC));m._compile(PATCHE,SRC);m.loaded=true;require.cache[SRC]=m;}
const patchOk=()=>{assert.equal(r.status,0,'patch : '+(r.stderr||r.stdout||r.error?.message));assert.ok(PATCHE.includes(MARQUE));};
const H=require('./ch086.cjs');const {Engine,K,ALLUME,StoreLent,ESV,lot,normaliser}=H;

/* L'état durable de l'instant visé : étape `capture`, avant et nuage enregistrés (`before-captured` sauvegardé, `step=analyze` pas encore). */
const instantVise=x=>{if(x.k!=='etat')return false;const s=StoreLent.etat(x);return s.batch?.state==='RUNNING'&&s.batch.step==='capture'&&s.collection==='READY_FOR_AFTER'&&!!s.lidarId&&!s.intent&&!s.applied;};
/* Redémarre sur ce qui est durable après la k-ième écriture confirmée. `modifier(store,esv)` altère l'état relu (cas voisins). */
async function redemarrer(journal,k,{navigationSeule=false,modifier=null}={}){
 const store=StoreLent.apres(journal,k),dernier=journal[k-1].esv,esv=new ESV({navigationSeule});
 esv.identity=K.clone(dernier.identity);esv.rails=K.clone(dernier.rails);
 if(modifier)modifier(store,esv);
 const e=new Engine(esv,store);e.ecrituresApresValidation=ALLUME;const durable=store.state;await e.init();
 return {e,esv,store,durable,avant:dernier.cmd.slice()};}
async function reprendre(o){let refus=null;try{await o.e.resume();await o.e.task;await o.store.fileEtat;await o.store.fileIdb;}catch(x){refus=x.message;}
 return {...o,refus,cmd:[...o.avant,...o.esv.cmd]};}
/* Aucune pose ni validation en double, aucune validation sans pose, aucun SKIP, aucun cut compté sans sa validation ni compté deux fois. */
function sansPerteNiDoublon(o,k,fin){const compte=c=>o.cmd.filter(x=>x===c).length,ou=`k=${k} ${JSON.stringify(o.cmd)}`;
 for(let cut=100;cut<=fin;cut++){assert.ok(compte('apply:'+cut)<=1,'pose en double sur '+cut+' '+ou);assert.ok(compte('validate:'+cut)<=1,'validation en double sur '+cut+' '+ou);
  if(compte('validate:'+cut))assert.equal(compte('apply:'+cut),1,'validation sans pose sur '+cut+' '+ou);}
 assert.equal(o.cmd.some(c=>c.startsWith('skip')),false,'SKIP '+ou);
 const b=o.e.s.batch;if(!b)return;
 for(const p of b.processed)assert.equal(compte('validate:'+p.cut),1,`cut ${p.cut} compté sans validation ${ou}`);
 assert.equal(new Set(b.processed.map(p=>p.cut)).size,b.processed.length,'cut compté deux fois '+ou);
 /* Rien de perdu : ce que l'état porte est dans IndexedDB. */
 for(const x of o.e.s.events)assert.ok(o.store.events.has(x.eventId),`événement ${x.type} de l’état absent d’IndexedDB ${ou}`);
 for(const v of o.e.s.records){const id=v.recordId||v.id;assert.deepEqual(normaliser(o.store.records.get(id)),normaliser(v),`visite ${v.identity?.cut} différente en base ${ou}`);}}
const TERMINE=['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS'];
/* Arrêt après chaque écriture confirmée de TOUT le lot ; reprise complète rejouée une fois par état durable distinct. Issues admises :
 * lot terminé (toutes les coupes posées et validées une fois), ou pause MOTIVÉE par une commande en cours à l'arrêt (intention de pose ou
 * de validation durable, validation transmise sans acceptation). Jamais ERREUR. */
async function arretsPartout({navigationSeule,ordre,fin=101}){
 const {store,esv:temoin}=await lot({navigationSeule,ordre,fin});const j=store.journal;
 const vus=new Set(),issues=new Map();let rejoues=0,vises=0,termines=0;
 for(let k=1;k<=j.length;k++){const d=StoreLent.apres(j,k),cle=(d.texte||'')+'|'+JSON.stringify([...d.records.values()])+'|'+JSON.stringify(j[k-1].esv)+'|'+[...d.clouds.keys()];
  if(vus.has(cle))continue;vus.add(cle);rejoues++;if(instantVise(j[k-1]))vises++;
  const o=await reprendre(await redemarrer(j,k,{navigationSeule}));const b=o.e.s.batch,s=o.durable;
  const issue=b?.state??'aucun-lot';issues.set(issue,(issues.get(issue)||0)+1);
  sansPerteNiDoublon(o,k,fin);
  assert.notEqual(issue,'ERROR',`k=${k} : reprise en ERREUR (${b?.error?.message}) depuis étape ${s?.batch?.step}, collection ${s?.collection}`);
  if(!s?.batch)continue;
  if(TERMINE.includes(issue)){termines++;
   assert.deepEqual(o.cmd,temoin.cmd,`k=${k} : commandes différentes du lot sans arrêt`);
   assert.deepEqual(b.processed.map(p=>p.cut),Array.from({length:fin-99},(_,i)=>100+i),`k=${k} : coupes comptées`);
  }else{
   /* Pause : elle doit être motivée par une commande que l'arrêt a pu couper, et rien n'a été renvoyé à ESV. */
   const motif=s.intent?.kind||(b.state==='PAUSED_AFTER_STATE_MISSING'?'validation-non-acceptee':null);
   assert.ok(motif,`k=${k} : pause sans motif (${b.state}, ${o.refus}) depuis étape ${s.batch.step}, collection ${s.collection}`);
   assert.deepEqual(o.esv.cmd,[],`k=${k} : commande envoyée malgré la pause ${JSON.stringify(o.esv.cmd)}`);}}
 return {ecritures:j.length,rejoues,vises,termines,issues:[...issues]};}
module.exports={...H,patchOk,MARQUE,instantVise,redemarrer,reprendre,sansPerteNiDoublon,arretsPartout,TERMINE};
