'use strict';
/* Module d'aide des essais CH-094 (tests/ch094-*.test.cjs et tests/ch092-moteur-reprise-apres-porte.test.cjs).
 * CH-094 — APRÈS UNE PAUSE « ÉCRITURE NON CONFIRMÉE », LA REPRISE REPASSE LA PORTE. Les patchs du moteur sont appliqués à une COPIE de
 * src/engine.js tant que le tronc ne les porte pas, dans l'ordre de leur livraison : celui de CH-091 (s'il est dans le dépôt et que le
 * moteur ne le porte pas), puis celui de CH-094. Ce module doit être chargé AVANT tests/helpers/ch086.cjs, qui lit alors le moteur
 * déjà en cache. `CH094_SANS_PATCH=1` : moteur du dépôt tel quel (pour revoir les essais rouges). */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'../..'),SRC=path.join(racine,'src/engine.js');
const PATCHS=[['CH-091','captureAvantDejaFaite',false],['CH-094','fenetreRestee',true]];
const ORIGINAL=fs.readFileSync(SRC,'utf8');let texte=ORIGINAL;const etat={};
for(const [dossier,marque,exige] of PATCHS){const p=path.join(racine,'chantiers',dossier,'engine.patch');
 if(texte.includes(marque)){etat[dossier]='porté';continue;}
 if(process.env.CH094_SANS_PATCH==='1'){etat[dossier]='écarté';continue;}
 if(!fs.existsSync(p)){etat[dossier]=exige?'patch absent : '+p:'absent du dépôt';continue;}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch094-'));fs.mkdirSync(path.join(dir,'src'));fs.writeFileSync(path.join(dir,'src/engine.js'),texte);
 const r=spawnSync('patch',['-s','-p1','-d',dir,'-i',p],{encoding:'utf8'});
 if(r.status===0){texte=fs.readFileSync(path.join(dir,'src/engine.js'),'utf8');etat[dossier]='appliqué';}else etat[dossier]='refusé : '+(r.stderr||r.stdout||r.error?.message);
 fs.rmSync(dir,{recursive:true,force:true});}
if(texte!==ORIGINAL){const m=new Module(SRC,module);m.filename=SRC;m.paths=Module._nodeModulePaths(path.dirname(SRC));m._compile(texte,SRC);m.loaded=true;require.cache[SRC]=m;}
const patchOk=()=>{assert.ok(['porté','appliqué'].includes(etat['CH-094']),'patch CH-094 : '+etat['CH-094']);assert.ok(!String(etat['CH-091']).startsWith('refusé'),'patch CH-091 : '+etat['CH-091']);
 assert.ok(texte.includes('fenetreRestee'));};
const H=require('./ch086.cjs');const {StoreLent,ESV,Engine,K,ALLUME,scope}=H;

/* Magasin lent dont IndexedDB peut refuser ou RETENIR un événement. `sort(c)` rend 'refus' (l'écriture lève), 'retenu' (elle attend
 * `lacher()`, hors de la file : une transaction qui ne finit pas ne bloque pas les suivantes) ou rien (écriture normale). */
class StorePannes extends StoreLent{
 constructor(o){super(o);this.sort=()=>null;this.retenus=[];this.verrou=new Promise(ok=>{this.lacher=ok;});}
 putEvent(e){const c=K.clone(e),s=this.sort(c);const ecrire=()=>{this.events.set(c.eventId,c);this.noter('event',c);};
  if(s==='retenu'){this.retenus.push(c.eventId);return this.verrou.then(ecrire);}
  return this.idb(()=>{if(s==='refus')throw Error('IndexedDB refuse');ecrire();});}
}
const attendre=async store=>{await store.fileEtat;await store.fileIdb;};
/* Lot de trois cuts ; `monter({e,esv,store})` pose les pannes avant le départ. */
async function lotPannes({fin=102,reglage=ALLUME,monter=null}={}){
 const esv=new ESV();const store=new StorePannes({esv:()=>({identity:esv.identity,rails:esv.rails,cmd:esv.cmd.slice()})});
 const e=new Engine(esv,store);e.ecrituresApresValidation=reglage;await e.init();e.s.mode='automatic-test';
 const o={e,esv,store};if(monter)monter(o);
 await e.startBatch(scope({end:fin}));await e.task;await attendre(store);return o;}
/* Reprise par l'opérateur ; un refus de reprise est rendu, pas levé. */
async function reprendre({e,store}){let refus=null;try{await e.resume();await e.task;}catch(x){refus=x.message;}await attendre(store);return refus;}
/* Aucune pose ni validation en double, aucune validation sans pose, aucun SKIP, aucun cut compté sans sa validation. */
function sansPerteNiDoublon({e,esv},fin=102){const compte=c=>esv.cmd.filter(x=>x===c).length,ou=JSON.stringify(esv.cmd);
 for(let cut=100;cut<=fin;cut++){assert.ok(compte('apply:'+cut)<=1,'pose en double sur '+cut+' '+ou);assert.ok(compte('validate:'+cut)<=1,'validation en double sur '+cut+' '+ou);
  if(compte('validate:'+cut))assert.equal(compte('apply:'+cut),1,'validation sans pose sur '+cut+' '+ou);}
 assert.equal(esv.cmd.some(c=>c.startsWith('skip')),false,'SKIP '+ou);
 for(const p of e.s.batch?.processed||[])assert.equal(compte('validate:'+p.cut),1,'cut '+p.cut+' compté sans validation');}
module.exports={...H,patchOk,etatPatchs:etat,StorePannes,lotPannes,reprendre,attendre,sansPerteNiDoublon};
