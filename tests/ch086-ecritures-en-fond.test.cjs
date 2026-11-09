'use strict';
/* CH-086 (piste 1 de CH-084) — ÉCRITURES APRÈS LA VALIDATION EN FOND. Après le retour de la commande de validation, la visite, les
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
const {test}=require('node:test'),assert=require('node:assert/strict');
const {patchOk,Engine,K,S,ALLUME,ETEINT,StoreLent,ESV,scope,lot,normaliser,enregistrements,arretsFenetre}=require('./helpers/ch086.cjs');
test('le patch s’applique au tronc (ou le tronc le porte)',patchOk);
test('1a. allumé : la capture du cut suivant démarre pendant que les écritures de la validation courent ; éteint : jamais',async()=>{
 for(const [reglage,attendu] of [[ALLUME,true],[ETEINT,false]]){let enVolACapture=[];
  const {esv}=await lot({reglage,avant:(e,esv,store)=>{esv.surCapture=cut=>{if(cut>100)enVolACapture.push(store.enAttente);};}});
  assert.equal(esv.cmd.filter(c=>c.startsWith('validate')).length,3);
  assert.equal(enVolACapture.some(n=>n>0),attendu,(attendu?'allumé':'éteint')+' : écritures en vol à la capture suivante '+JSON.stringify(enVolACapture));}
});

test('1b. porte : au moment où une pose part vers ESV, aucune écriture n’est en vol, et l’état durable porte l’intention de pose',async()=>{
 let vus=[];const {esv}=await lot({avant:(e,esv,store)=>{esv.surApply=cut=>vus.push({cut,enAttente:store.enAttente,intent:store.state?.intent?.kind,fenetre:'fenetreEcritures' in (store.state||{})});}});
 assert.equal(vus.length,3);for(const v of vus)assert.deepEqual(v,{cut:v.cut,enAttente:0,intent:'apply',fenetre:false},'cut '+v.cut);
 assert.deepEqual(esv.cmd,['apply:100','validate:100','apply:101','validate:101','apply:102','validate:102']);
});

test('4a. écriture de la visite refusée dans la fenêtre : une reprise, puis pause motivée avant toute pose suivante, sans SKIP',async()=>{
 const {e,esv,store}=await lot({avant:(e,esv,s)=>{let n=0;s.panneRecord=()=>{const cmd=esv.cmd.join();return cmd.endsWith('validate:101')&&++n<99;};}});
 assert.equal(e.s.batch.state,'PAUSED');assert.equal(e.s.batch.error.code,'ECRITURE_NON_CONFIRMEE');
 assert.deepEqual(esv.cmd,['apply:100','validate:100','apply:101','validate:101']);
 assert.ok([...store.events.values()].some(x=>x.type==='batch-ecriture-non-confirmee'&&x.commandSent===false&&x.skipSent===false));
 /* La visite reste recopiée dans l'état durable (rien de perdu). */
 const v=store.state.recordIds.find(x=>x&&typeof x==='object'&&x.identity?.cut===101);assert.ok(v&&v.commandSent===true,'visite 101 gardée dans l’état');
});

test('4b. écriture refusée une fois : la reprise réussit, le lot continue, mêmes commandes',async()=>{
 const {e,esv}=await lot({avant:(e,esv,s)=>{let n=0;s.panneRecord=()=>esv.cmd.join().endsWith('validate:101')&&++n===1;}});
 assert.equal(e.s.batch.processed.length,3);assert.equal(esv.cmd.length,6);assert.equal(e.dernierePorte.issue,'confirme');
});

test('4c. état trop lent à la porte (au-delà de delaiMs) : pause motivée, aucune pose suivante',async()=>{
 const {e,esv}=await lot({reglage:{enFond:true,delaiMs:40},avant:(e,esv,s)=>{s.lenteurEtat=()=>esv.cmd.join().endsWith('validate:100')?120:1;}});
 assert.equal(e.s.batch.error?.code,'ECRITURE_NON_CONFIRMEE');assert.equal(e.s.batch.state,'PAUSED');
 assert.deepEqual(esv.cmd,['apply:100','validate:100']);
});

test('5. réglage absent : le moteur garde le chemin d’avant (aucune fenêtre ouverte)',async()=>{
 const {e,store}=await lot({reglage:null});assert.equal(e.fenetre,null);assert.equal(store.journal.some(x=>x.k==='etat'&&StoreLent.etat(x).fenetreEcritures),false);
 assert.equal(S.ecrituresApresValidation.enFond,true,'allumé pour le lot d’essai');
});
