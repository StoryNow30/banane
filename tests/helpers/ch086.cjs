'use strict';
/* Module d'aide des essais CH-086 (tests/ch086-*.test.cjs).
 * CH-086 (piste 1 de CH-084) — ÉCRITURES APRÈS LA VALIDATION EN FOND. Après le retour de la commande de validation, la visite, les
 * événements `validation-observation` et `validation-accepted` et les sauvegardes qui suivent partent sans être attendus ; la preuve
 * « stocké » est exigée avant l'intention de pose suivante. Essais :
 *  1. le lot n'attend plus ces écritures (la capture suivante démarre pendant qu'elles courent) ; rien n'est en vol au moment où une
 *     pose est commandée ;
 *  2. commandes à ESV, poses, validations, événements, visites et état final identiques, réglage éteint et allumé (ESV qui relit, et ESV
 *     « navigation seule » comme sur le terrain) ;
 *  3. arrêt simulé du service worker APRÈS CHAQUE ÉCRITURE CONFIRMÉE du lot, dans deux ordres (FIFO, et chrome.storage en avance sur
 *     IndexedDB) : init() retrouve un état sûr, IndexedDB rattrape l'état, la reprise ne pose ni ne valide jamais deux fois, aucun SKIP ;
 *  4. écriture refusée ou trop lente à la porte : une reprise, puis pause motivée, sans commande.
 * Le patch (chantiers/CH-086/engine.patch) est appliqué à une COPIE de src/engine.js tant que le tronc ne le porte pas. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),{spawnSync}=require('node:child_process');
const SRC=path.resolve(__dirname,'../../src/engine.js'),PATCH=process.env.CH086_PATCH||path.resolve(__dirname,'../../chantiers/CH-086/engine.patch');
const ORIGINAL=fs.readFileSync(SRC,'utf8'),DEJA=ORIGINAL.includes('porteEcritures');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch086-'));fs.mkdirSync(path.join(dir,'src'));fs.writeFileSync(path.join(dir,'src/engine.js'),ORIGINAL);
const r=DEJA?{status:0}:spawnSync('patch',['-s','-p1','-d',dir,'-i',PATCH],{encoding:'utf8'});
const PATCHE=DEJA?ORIGINAL:(r.status===0?fs.readFileSync(path.join(dir,'src/engine.js'),'utf8'):ORIGINAL);
if(!DEJA){const m=new Module(SRC,module);m.filename=SRC;m.paths=Module._nodeModulePaths(path.dirname(SRC));m._compile(PATCHE,SRC);m.loaded=true;require.cache[SRC]=m;}
const patchOk=()=>{assert.equal(r.status,0,'patch : '+(r.stderr||r.stdout||r.error?.message));assert.ok(PATCHE.includes('porteEcritures'));};
const {Engine}=require('../../src/engine.js');const {SimulatedESV,K}=require('../fixtures.cjs');
const S=require('../../src/settings.js');
const ALLUME=S.ecrituresApresValidation,ETEINT={enFond:false,delaiMs:2000};
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));

/* Magasin lent : l'état passe un par un (comme src/storage.js, `enFile`), IndexedDB aussi (transactions ordonnées). `journal` garde
 * l'ordre des écritures CONFIRMÉES, avec ce qu'ESV affichait et les commandes déjà envoyées à cet instant. `ordre:'etat-avant'` :
 * chrome.storage confirme tout de suite, IndexedDB après (pire cas pour la cohérence état / journal). */
class StoreLent{
 constructor({etatMs=3,idbMs=2,ordre='fifo',esv=()=>null}={}){Object.assign(this,{etatMs,idbMs,ordre,esv});
  this.state=null;this.clouds=new Map();this.events=new Map();this.records=new Map();this.journal=[];this.fileEtat=Promise.resolve();this.fileIdb=Promise.resolve();
  this.enAttente=0;this.panneEtat=null;this.panneRecord=null;this.lenteurEtat=null;}
 noter(k,v){this.journal.push({k,v,esv:K.clone(this.esv())});}
 /* Lecture d'un état du journal (gardé en texte). */
 static etat(x){return typeof x.v==='string'?JSON.parse(x.v):x.v;}
 enFile(nom,ms,fn){this.enAttente++;const t=this[nom].then(async()=>{if(ms>0)await pause(ms);fn();}).finally(()=>{this.enAttente--;});this[nom]=t.catch(()=>{});return t;}
 /* Comme src/storage.js : l'état vivant est reçu et figé (ici sérialisé) À L'APPEL, avant toute attente. */
 copieALaSauvegarde=true;
 get state(){return this.texte==null?null:JSON.parse(this.texte);}set state(v){this.texte=v==null?null:JSON.stringify(v);}
 async getState(){return this.state;}
 setState(s){const c=JSON.stringify(s),ms=this.lenteurEtat?this.lenteurEtat():this.ordre==='etat-avant'?0:this.etatMs;
  return this.enFile('fileEtat',ms,()=>{if(this.panneEtat&&this.panneEtat())throw Error('stockage plein');this.texte=c;this.noter('etat',c);});}
 idb(fn){return this.enFile('fileIdb',this.ordre==='etat-avant'?this.idbMs*4:this.idbMs,fn);}
 putEvent(e){const c=K.clone(e);return this.idb(()=>{this.events.set(c.eventId,c);this.noter('event',c);});}
 putRecord(x){const c=K.clone(x),id=c.recordId||c.id;return this.idb(()=>{if(this.panneRecord&&this.panneRecord())throw Error('IndexedDB refuse');this.records.set(id,c);this.noter('record',c);});}
 async putCloud(id,c){this.clouds.set(id,K.clone(c));this.noter('cloud',{id,c:K.clone(c)});}
 async getCloud(id){return this.clouds.has(id)?K.clone(this.clouds.get(id)):undefined;}
 async getRecord(id){return this.records.has(id)?K.clone(this.records.get(id)):undefined;}
 async all(n){return K.clone(n==='records'?[...this.records.values()]:n==='events'?[...this.events.values()]:n==='clouds'?[...this.clouds.values()]:[]);}
 /* Ce qu'un service worker arrêté juste après la k-ième écriture confirmée relirait. */
 static apres(journal,k){const s=new StoreLent({etatMs:0,idbMs:0});
  for(const {k:t,v} of journal.slice(0,k)){if(t==='etat')s.texte=v;else if(t==='event')s.events.set(v.eventId,K.clone(v));
   else if(t==='record')s.records.set(v.recordId||v.id,K.clone(v));else if(t==='cloud')s.clouds.set(v.id,K.clone(v.c));}
  s.journal=[];return s;}
}
/* ESV simulé qui consigne chaque commande avec son cut. `navigationSeule` : comme sur le terrain, l'état final n'est pas relu. */
class ESV extends SimulatedESV{
 constructor({navigationSeule=false}={}){super();this.cmd=[];this.navigationSeule=navigationSeule;this.surCapture=null;this.surApply=null;}
 async capture(e){if(this.surCapture)this.surCapture(this.identity.cut);return super.capture(e);}
 async apply(b,p){this.cmd.push('apply:'+this.identity.cut);if(this.surApply)this.surApply(this.identity.cut);return super.apply(b,p);}
 async validateAndNext(...a){this.cmd.push('validate:'+this.identity.cut);const ev=await super.validateAndNext(...a);
  if(!this.navigationSeule)return ev;return {...ev,afterObserved:false,afterStateStatus:'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED',afterState:null};}
 async skipAndNext(...a){this.cmd.push('skip:'+this.identity.cut);return super.skipAndNext(...a);}
}
const scope=(extra={})=>({part:23,start:100,end:104,testConfirmed:true,lowConfidence:'attempt',allowNavigationEvidence:true,...extra});
async function lot({reglage=ALLUME,ordre='fifo',navigationSeule=false,fin=102,store:avec=null,avant=null}={}){
 const esv=new ESV({navigationSeule});const store=avec||new StoreLent({ordre,esv:()=>({identity:esv.identity,rails:esv.rails,cmd:esv.cmd.slice()})});
 const e=new Engine(esv,store);e.ecrituresApresValidation=reglage;await e.init();e.s.mode='automatic-test';
 if(avant)avant(e,esv,store);
 await e.startBatch(scope({end:fin}));await e.task;await store.fileEtat;await store.fileIdb;return {e,esv,store};}

/* Normalisation : identifiants aléatoires renumérotés dans l'ordre d'apparition, heures et durées masquées. */
function normaliser(x){const ids=new Map(),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,iso=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/;
 const DUREES=new Set(['durationMs','capturedAt','cutStartedAt','startedAt','createdAt','timestamp','at']);
 const v=(k,y)=>{if(DUREES.has(k))return '<t>';if(typeof y==='string'&&uuid.test(y)){if(!ids.has(y))ids.set(y,'id'+ids.size);return ids.get(y);}
  if(typeof y==='string'&&iso.test(y))return '<t>';if(Array.isArray(y))return y.map((z,i)=>v(i,z));
  if(y&&typeof y==='object')return Object.fromEntries(Object.keys(y).sort().map(c=>[c,v(c,y[c])]));return y;};
 return v('',x);}
const enregistrements=({e,esv,store})=>normaliser({cmd:esv.cmd,calls:esv.calls,
 evenements:[...store.events.values()].filter(x=>x.type!=='ecritures-fond-reprises'),
 visites:[...store.records.values()],nuages:[...store.clouds.keys()].length,etat:(({events,...reste})=>({...reste,types:events.map(x=>x.type)}))(store.state),
 lot:e.s.batch});


/* Rejoue l'arrêt : relit ce qui est durable après la k-ième écriture confirmée, redémarre, reprend si on peut, et vérifie. */
async function arretApres(journal,k,{navigationSeule,reprendre=true}){
 const store=StoreLent.apres(journal,k),dernier=journal[k-1].esv,esv=new ESV({navigationSeule});
 esv.identity=K.clone(dernier.identity);esv.rails=K.clone(dernier.rails);const avant=dernier.cmd.slice();
 const e=new Engine(esv,store);e.ecrituresApresValidation=ALLUME;const etat=store.state;await e.init();
 /* Rien de perdu : tout ce que l'état durable porte est aussi dans IndexedDB après init(). */
 for(const x of e.s.events)assert.ok(store.events.has(x.eventId),`k=${k} : événement ${x.type} de l’état absent d’IndexedDB`);
 for(const v of e.s.records){const id=v.recordId||v.id;assert.deepEqual(normaliser(store.records.get(id)),normaliser(v),`k=${k} : visite ${v.identity?.cut} différente en base`);}
 /* Intention de validation durable sans acceptation : rapprochement, pause, rien de renvoyé. */
 if(etat?.intent?.kind==='validate'){assert.equal(e.s.reconcileRequired,true,`k=${k}`);assert.notEqual(e.s.batch.state,'RUNNING');}
 if(reprendre)try{await e.resume();await e.task;}catch{/* pause motivée : le lot ne repart pas */}
 const cmd=[...avant,...esv.cmd],compte=c=>cmd.filter(x=>x===c).length;
 for(let cut=100;cut<=102;cut++){assert.ok(compte('apply:'+cut)<=1,`k=${k} : pose en double sur ${cut} ${JSON.stringify(cmd)}`);
  assert.ok(compte('validate:'+cut)<=1,`k=${k} : validation en double sur ${cut} ${JSON.stringify(cmd)}`);
  if(compte('validate:'+cut))assert.equal(compte('apply:'+cut),1,`k=${k} : validation sans pose sur ${cut}`);}
 assert.equal(cmd.some(c=>c.startsWith('skip')),false,`k=${k} : SKIP`);
 /* Un cut compté l'a été sur sa validation (jamais sans commande). */
 for(const p of e.s.batch?.processed||[])assert.equal(compte('validate:'+p.cut),1,`k=${k} : cut ${p.cut} compté sans validation`);
 return {etat:e.s.batch?.state,reprise:[...store.events.values()].some(x=>x.type==='ecritures-fond-reprises')};}
/* Arrêt après chaque écriture confirmée de la fenêtre ; la reprise complète n'est rejouée qu'une fois par état durable distinct (même
 * état, même visites : même reprise) ; les contrôles « rien de perdu » sont faits à chaque point. */
async function arretsFenetre({navigationSeule,ordre,fin=101}){
 const {store}=await lot({navigationSeule,ordre,fin});const j=store.journal;
 assert.ok(j.filter(x=>x.k==='etat'&&StoreLent.etat(x).fenetreEcritures).length>=3,'des états durables portent la fenêtre');
 const points=[];for(let k=1;k<=j.length;k++){const c=j[k-1].esv.cmd;if(c.at(-1)?.startsWith('validate')||j[k]?.esv.cmd.at(-1)?.startsWith('validate'))points.push(k);}
 const vus=new Set(),etats=new Map();let reprises=0,rejoues=0;
 for(const k of points){const d=StoreLent.apres(j,k),cle=(d.texte||'')+'|'+JSON.stringify([...d.records.values()])+'|'+JSON.stringify(j[k-1].esv);
  const rejouer=!vus.has(cle);vus.add(cle);if(rejouer)rejoues++;
  const o=await arretApres(j,k,{navigationSeule,reprendre:rejouer});etats.set(o.etat,(etats.get(o.etat)||0)+1);if(o.reprise)reprises++;}
 return {points:points.length,rejoues,reprises,etats:[...etats]};}
module.exports={patchOk,Engine,K,S,ALLUME,ETEINT,StoreLent,ESV,scope,lot,normaliser,enregistrements,arretApres,arretsFenetre};
