'use strict';
/* CH-092 (relecture en adversaire de CH-086) — DÉFAUT 1 : après une pause `ECRITURE_NON_CONFIRMEE`, « Reprendre » ne repasse pas la porte.
 * `porteEcritures` met `this.fenetre` à null avant d'attendre ; quand la porte échoue (écriture refusée, reprise refusée aussi), le lot
 * se met en pause et l'état garde `fenetreEcritures`. À la reprise par l'opérateur (le message dit « Reprendre quand le stockage
 * répond »), plus aucune porte ne tient (`this.fenetre` est null) : les événements de la fenêtre refusés par IndexedDB ne sont jamais
 * réécrits, et `fenetreEcritures` (la liste de ce qui reste à réécrire) est écrasée par la fenêtre suivante. Seul init() (redémarrage
 * du service worker) les rattrape, tant qu'ils sont encore dans les 150 derniers événements de l'état.
 * Essais rouges marqués `todo` : ils décrivent le comportement attendu, aucune correction n'est faite ici (src/engine.js est protégé). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {StoreLent,ESV,Engine,K,ALLUME,scope}=require('./helpers/ch086.cjs');

/* Magasin lent dont IndexedDB peut refuser les événements (panne passagère). Les événements d'état du lot (`batch-…`) passent, pour que la
 * pause motivée soit consignée comme dans l'essai 4a de CH-086 ; tous les autres sont refusés tant que la panne dure. */
class StorePanneEvenements extends StoreLent{
 putEvent(e){const c=K.clone(e);return this.idb(()=>{if(this.panneEvent&&this.panneEvent(c))throw Error('IndexedDB refuse');this.events.set(c.eventId,c);this.noter('event',c);});}
}
async function lotEnPanne(){
 const esv=new ESV();const store=new StorePanneEvenements({esv:()=>({identity:esv.identity,rails:esv.rails,cmd:esv.cmd.slice()})});
 let panne=false;store.panneEvent=c=>panne&&!String(c.type).startsWith('batch-');
 /* La panne commence au retour de la validation du cut 101 (début de la fenêtre) et dure jusqu'à ce que l'essai la lève. */
 const base=esv.validateAndNext.bind(esv);esv.validateAndNext=async(...a)=>{const r=await base(...a);if(esv.cmd.at(-1)==='validate:101')panne=true;return r;};
 const e=new Engine(esv,store);e.ecrituresApresValidation=ALLUME;await e.init();e.s.mode='automatic-test';
 await e.startBatch(scope({end:102}));await e.task;await store.fileEtat;await store.fileIdb;
 return {e,esv,store,reparer:()=>{panne=false;}};}

test('montage : événements refusés dans la fenêtre du cut 101 : pause motivée, aucune commande de plus (comportement livré, vert)',async()=>{
 const {e,esv}=await lotEnPanne();
 assert.equal(e.s.batch.state,'PAUSED');assert.equal(e.s.batch.error?.code,'ECRITURE_NON_CONFIRMEE');
 assert.deepEqual(esv.cmd,['apply:100','validate:100','apply:101','validate:101']);
 assert.ok(e.s.fenetreEcritures?.evenements.length>0,'l’état garde la liste des écritures à refaire');
});

test('défaut 1a : après la pause, stockage réparé puis Reprendre : les événements de la fenêtre refusés sont dans IndexedDB à la fin du lot',
 {todo:'CH-092 défaut 1 : la reprise ne repasse pas la porte (src/engine.js, porteEcritures / resume)'},async()=>{
 const {e,esv,store,reparer}=await lotEnPanne();
 const attendus=e.s.fenetreEcritures.evenements.slice();
 reparer();await e.resume();await e.task;await store.fileEtat;await store.fileIdb;
 assert.equal(e.s.batch.processed.length,3,'le lot a fini');assert.equal(esv.cmd.filter(c=>c.startsWith('skip')).length,0);
 const manquants=attendus.filter(id=>!store.events.has(id)).map(id=>e.s.events.find(x=>x.eventId===id)?.type??'?');
 assert.deepEqual(manquants,[],'événements de la fenêtre absents d’IndexedDB après la reprise : '+manquants.join(', '));
});

test('défaut 1b : après la reprise, la preuve de validation du cut 101 (`validation-accepted`) est dans le journal durable',
 {todo:'CH-092 défaut 1 : événement de validation perdu du journal IndexedDB'},async()=>{
 const {e,store,reparer}=await lotEnPanne();
 reparer();await e.resume();await e.task;await store.fileEtat;await store.fileIdb;
 const acceptes=[...store.events.values()].filter(x=>x.type==='validation-accepted').map(x=>x.identity?.cut).sort();
 assert.deepEqual(acceptes,[100,101,102]);
});

test('défaut 1c : Reprendre alors que le stockage refuse toujours : aucune nouvelle pose tant que les écritures du cut précédent ne sont pas confirmées',
 {todo:'CH-092 défaut 1 : la porte « stocké » ne tient plus après une pause'},async()=>{
 const {e,esv,store}=await lotEnPanne();
 try{await e.resume();await e.task;}catch{/* refus de reprise accepté */}
 await store.fileEtat;await store.fileIdb;
 assert.deepEqual(esv.cmd,['apply:100','validate:100','apply:101','validate:101'],'aucune commande après la pause, stockage toujours en panne');
});
