'use strict';
/* CH-094 — APRÈS UNE PAUSE « ÉCRITURE NON CONFIRMÉE », LA REPRISE REPASSE LA PORTE ET RÉÉCRIT LE JOURNAL (défaut 1 de CH-092).
 * Les essais 1a, 1b, 1c de CH-092 sont dans tests/ch092-moteur-reprise-apres-porte.test.cjs. Ici :
 *  2. le voisin du rapport CH-092 : une reprise abandonnée sur délai, qui finit plus tard, n'efface pas la liste de la fenêtre suivante ;
 *  3. après la reprise : ni pose ni validation perdue ou doublée, aucun SKIP ; la réécriture est consignée ;
 *  4. stockage toujours en panne : nouvelle pause motivée à chaque Reprendre, aucune commande, la liste est gardée ;
 *  5. la liste restée en attente tient la porte aussi hors de la boucle du lot (pose à la main) et après un redémarrage ;
 *  6. lot sans panne de stockage : mêmes commandes, événements, visites et état, à l'octet, avec et sans le patch. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{spawnSync}=require('node:child_process');
const {patchOk,Engine,lot,lotPannes,reprendre,attendre,sansPerteNiDoublon}=require('./helpers/ch094.cjs');
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const QUATRE=['apply:100','validate:100','apply:101','validate:101'];
/* Panne des événements (hors `batch-…`) du retour de la validation du cut 101 jusqu'à `reparer()` : le montage de CH-092. */
const panne101=o=>{let panne=false;o.store.sort=c=>panne&&!String(c.type).startsWith('batch-')?'refus':null;
 const base=o.esv.validateAndNext.bind(o.esv);o.esv.validateAndNext=async(...a)=>{const r=await base(...a);if(o.esv.cmd.at(-1)==='validate:101')panne=true;return r;};
 o.reparer=()=>{panne=false;};};

test('le patch s’applique (après celui de CH-091 s’il est dans le dépôt), ou le tronc le porte',patchOk);

test('2. voisin : une reprise abandonnée sur délai finit pendant la fenêtre suivante : la liste de cette fenêtre n’est pas effacée, la porte tient',async()=>{
 /* Phase 1 (retour de la validation du cut 100) : les événements sont RETENUS (ni confirmés ni refusés) : délai à la porte, reprise
  * retenue aussi, pause. Phase 2 : le stockage répond, Reprendre. Phase 3 (retour de la validation du cut 101) : les écritures retenues
  * sont lâchées (la vieille reprise finit pendant la fenêtre du cut 101) et les événements NOUVEAUX sont refusés. La capture du cut 102
  * dure 80 ms : la vieille reprise a fini avant la porte. Attendu : la porte du cut 102 voit le refus, pause, aucune pose du cut 102. */
 let phase=0;const premiere=new Set();
 const o=await lotPannes({reglage:{enFond:true,delaiMs:40},monter:({esv,store})=>{
  store.sort=c=>String(c.type).startsWith('batch-')?null:phase===1?'retenu':phase===3&&!premiere.has(c.eventId)?'refus':null;
  const base=esv.validateAndNext.bind(esv);esv.validateAndNext=async(...a)=>{const r=await base(...a);
   if(esv.cmd.at(-1)==='validate:100'&&phase===0)phase=1;
   if(esv.cmd.at(-1)==='validate:101'){phase=3;store.lacher();}return r;};
  const capture=esv.capture.bind(esv);esv.capture=async(...a)=>{if(esv.identity.cut===102)await pause(80);return capture(...a);};}});
 const {e,esv,store}=o;
 assert.equal(e.s.batch.error?.code,'ECRITURE_NON_CONFIRMEE');assert.deepEqual(esv.cmd,['apply:100','validate:100']);
 assert.ok(store.retenus.length>0,'des écritures sont retenues');
 for(const id of e.s.fenetreEcritures.evenements)premiere.add(id);
 phase=2;await reprendre(o);await pause(60);await attendre(store);
 const absents=e.s.events.filter(x=>!store.events.has(x.eventId)).map(x=>x.type);
 assert.deepEqual({cmd:esv.cmd,etat:e.s.batch.state,code:e.s.batch.error?.code??null,absents:absents.length>0,liste:(e.s.fenetreEcritures?.evenements.length??0)>0},
  {cmd:QUATRE,etat:'PAUSED',code:'ECRITURE_NON_CONFIRMEE',absents:true,liste:true},
  'la pose du cut 102 ne part pas tant que des événements du cut 101 sont absents d’IndexedDB ('+absents.join(', ')+')');
 for(const id of premiere)assert.ok(store.events.has(id),'événement de la première fenêtre écrit');
 sansPerteNiDoublon(o);
});

test('3. après la pause, stockage réparé puis Reprendre : six commandes, aucune en double, aucun SKIP ; réécriture consignée ; plus de liste en attente',async()=>{
 const o=await lotPannes({monter:panne101});const {e,esv,store}=o;
 assert.equal(e.s.batch.error?.code,'ECRITURE_NON_CONFIRMEE');const attendus=e.s.fenetreEcritures.evenements.slice();
 o.reparer();assert.equal(await reprendre(o),null);
 assert.deepEqual(esv.cmd,[...QUATRE,'apply:102','validate:102']);sansPerteNiDoublon(o);
 assert.equal(e.s.batch.state,(await lot()).e.s.batch.state,'même état de fin qu’un lot sans panne');assert.equal(e.s.batch.processed.length,3);assert.equal(e.s.batch.error,null);
 assert.equal('fenetreEcritures' in e.s,false);assert.equal('fenetreEcritures' in store.state,false,'l’état durable ne porte plus la liste');
 const reprises=[...store.events.values()].filter(x=>x.type==='ecritures-fond-reprises');
 assert.equal(reprises.length,1);assert.equal(reprises[0].evenementsReecrits,attendus.length);assert.equal(reprises[0].erreur,null);assert.equal(reprises[0].motif,'intention-de-pose');
 /* Tout ce que l'état porte est dans le journal durable, et chaque validation acceptée y est une seule fois. */
 for(const x of e.s.events)assert.ok(store.events.has(x.eventId),x.type+' absent d’IndexedDB');
 assert.deepEqual([...store.events.values()].filter(x=>x.type==='validation-accepted').map(x=>x.identity.cut).sort(),[100,101,102]);
});

test('4. stockage toujours en panne : chaque Reprendre redonne une pause motivée, sans commande ; réparé ensuite, le lot finit',async()=>{
 const o=await lotPannes({monter:panne101});const {e,esv,store}=o;const liste=e.s.fenetreEcritures.evenements.slice();
 for(let i=1;i<=2;i++){await reprendre(o);
  assert.deepEqual(esv.cmd,QUATRE,'reprise '+i+' : aucune commande');assert.equal(e.s.batch.state,'PAUSED');assert.equal(e.s.batch.error?.code,'ECRITURE_NON_CONFIRMEE');
  assert.deepEqual(e.s.fenetreEcritures?.evenements,liste,'reprise '+i+' : la liste des écritures à refaire est gardée');
  assert.deepEqual(store.state.fenetreEcritures?.evenements,liste,'reprise '+i+' : et dans l’état durable');
  assert.match(e.s.notice,/non confirmées/);}
 const pauses=[...store.events.values()].filter(x=>x.type==='batch-ecriture-non-confirmee');
 assert.equal(pauses.length,3);for(const p of pauses){assert.equal(p.commandSent,false);assert.equal(p.skipSent,false);}
 o.reparer();assert.equal(await reprendre(o),null);
 assert.deepEqual(esv.cmd,[...QUATRE,'apply:102','validate:102']);sansPerteNiDoublon(o);
 for(const id of liste)assert.ok(store.events.has(id));
});

test('5a. redémarrage du service worker pendant la panne (init() ne peut pas réécrire), puis Reprendre : pause motivée, puis réparé : le lot finit',async()=>{
 /* Montage : le compte rendu d'init() (`ecritures-fond-reprises`) passe ; s'il est refusé lui aussi, init() lève (comportement livré, hors CH-094). */
 const o=await lotPannes({monter:panne101});const liste=o.e.s.fenetreEcritures.evenements.slice();
 const sort=o.store.sort;o.store.sort=c=>c.type==='ecritures-fond-reprises'&&c.erreur?null:sort(c);
 const e=new Engine(o.esv,o.store);e.ecrituresApresValidation=o.e.ecrituresApresValidation;await e.init();const p={...o,e};
 assert.deepEqual(e.s.fenetreEcritures?.evenements,liste,'init() en panne garde la liste');
 await reprendre(p);assert.deepEqual(o.esv.cmd,QUATRE);assert.equal(e.s.batch.error?.code,'ECRITURE_NON_CONFIRMEE');
 o.reparer();assert.equal(await reprendre(p),null);
 assert.deepEqual(o.esv.cmd,[...QUATRE,'apply:102','validate:102']);sansPerteNiDoublon(p);
 for(const id of liste)assert.ok(o.store.events.has(id));
});

test('5b. lot arrêté après la pause, pose à la main alors que le stockage refuse toujours : refusée, aucune commande',async()=>{
 const o=await lotPannes({monter:panne101});const {e,esv}=o;
 await e.stop();await attendre(o.store);
 await assert.rejects(()=>e.apply(true),x=>x.code==='ECRITURE_NON_CONFIRMEE');
 assert.deepEqual(esv.cmd,QUATRE);
});
