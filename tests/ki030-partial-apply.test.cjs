/* KI-030 — APPLICATION PARTIELLE DES DEUX RAILS : CARACTÉRISATION.
 *
 * `src/adapter-page.js` applique les rails SÉQUENTIELLEMENT :
 *
 *   for(const s of ['left','right']) await clickPosition(s, …)
 *
 * Cette boucle date de la baseline V4.5.7 (`569c9a5`) : elle est antérieure à
 * V4.6 et à tout 4.7, qui n'ont introduit ni la boucle ni un nouveau chemin
 * pour l'atteindre. Si le garde d'émission refuse sur le SECOND rail — vue non
 * recentrée, position hors vue — le PREMIER est déjà déplacé et rien ne le
 * restaure automatiquement.
 *
 * CE QUI EST VÉRIFIÉ ICI n'est pas une atomicité : le cahier 4.7 ne la demande
 * nulle part, et son §6 écarte explicitement toute prétention de transaction.
 * Les propriétés réellement exigées sont l'absence de corruption SILENCIEUSE et
 * l'absence de poursuite dangereuse. Ce fichier les fixe :
 *
 *   1. l'état partiel est RÉEL — il est constaté, pas souhaité ;
 *   2. aucun VALIDATE, aucun SKIP ne suit ;
 *   3. le moteur pose `reconcileRequired` et se ferme à toute écriture ;
 *   4. la fermeture survit au redémarrage, depuis les seules données persistées ;
 *   5. l'opérateur dispose d'une sortie qui ramène vraiment les deux rails.
 *
 * Tant que ces cinq points tiennent, KI-030 reste une dette documentée et non
 * un défaut bloquant. Si un jour l'un d'eux cède, ce fichier vire au rouge.
 * Le point 1 décrit l'état ACTUEL, pas un état souhaitable : le jour où la
 * réconciliation restaurera le premier rail, il faudra le réécrire sciemment —
 * c'est le but d'un test de caractérisation, pas un obstacle au correctif.
 * `incident-3560.test.cjs` ne couvre que le refus sur le PREMIER rail, où
 * l'exposition est nulle : aucun rail n'a bougé.
 */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../src/engine.js');
const {MemoryStore,SimulatedESV,K}=require('./fixtures.cjs');

const PROPOSALS={left:{delta:[0,-.02,.004]},right:{delta:[0,.018,.004]}};

/* ESV dont l'apply reproduit la boucle réelle de l'adaptateur : le rail gauche
 * est déplacé, puis le droit est refusé par le garde de vue. Le refus est levé
 * APRÈS la mutation du premier rail, exactement comme dans la page. */
class PartialESV extends SimulatedESV{
 async apply(before,proposals){
  this.calls.push('apply');
  const cible=K.expectedPoses(before,proposals);
  this.rails.left=K.clone(cible.left);           // 1er rail : réellement déplacé.
  throw Error('Vue ESV non recentrée sur le rail right.'); // 2nd rail : refusé.
 }
}

async function app(){const adapter=new PartialESV(),store=new MemoryStore();
 const engine=new Engine(adapter,store);await engine.init();return {adapter,store,engine};}

const proposer=async e=>{e.s.mode='assisted';await e.analyze();
 for(const side of ['left','right'])e.s.proposal.rails[side].delta=PROPOSALS[side].delta.slice();};
/* `K.equalPoses` exige les DEUX rails : pour isoler un côté, on compare sa
 * matrice directement. */
const pose=rail=>rail.railLocalToSceneRelative;

test('KI-030 · le refus sur le second rail laisse un état partiel RÉEL, sans aucune décision ESV',async()=>{
 const {adapter,engine:e}=await app();await proposer(e);
 const avant=K.clone(adapter.rails);
 await assert.rejects(()=>e.apply(),/Vue ESV non recentrée sur le rail right\./);
 /* 1. L'exposition est réelle : c'est précisément ce que KI-030 décrit. */
 assert.notDeepEqual(pose(adapter.rails.left),pose(avant.left),
   'le rail gauche a bien été déplacé avant le refus');
 assert.deepEqual(pose(adapter.rails.right),pose(avant.right),
   'le rail droit n’a pas bougé : l’état est partiel');
 /* 2. Aucune décision n'a suivi l'application partielle. */
 assert.equal(adapter.calls.filter(c=>c==='validate').length,0,'aucun VALIDATE');
 assert.equal(adapter.calls.filter(c=>c==='skip').length,0,'aucun SKIP');
 /* 3. La corruption n'est pas silencieuse. */
 assert.equal(e.s.reconcileRequired,true);
 assert.equal(e.s.applied,null,'rien n’est compté comme appliqué');
});

test('KI-030 · après l’état partiel, toute nouvelle écriture est refusée',async()=>{
 const {engine:e}=await app();await proposer(e);
 await assert.rejects(()=>e.apply(),/Vue ESV non recentrée/);
 for(const [nom,appel] of [['apply',()=>e.apply()],['validateAndNext',()=>e.validateAndNext({part:23})],
   ['resume',()=>e.resume()]])
  await assert.rejects(appel,/Réconciliation requise/,nom+' doit être refusé');
 /* `startBatch` empile plusieurs gardes AVANT `gate()` — mode, déclaration
  * TEST, capture ouverte. Lequel parle en premier importe peu et dépend de
  * l'ordre des contrôles : ce qui est exigé ici, c'est qu'aucun lot ne démarre
  * sur un état incertain, et qu'aucune application ne soit retentée. */
 e.s.mode='automatic-test';
 await assert.rejects(()=>e.startBatch({part:23,start:100,end:102,testConfirmed:true,
   lowConfidence:'attempt',allowNavigationEvidence:true}),/./,'aucun lot ne démarre sur un état incertain');
 assert.equal(e.s.batch,null,'aucun lot n’a été créé');
});

test('KI-030 · la fermeture survit au redémarrage, depuis les seules données persistées',async()=>{
 const {adapter,store,engine:e}=await app();await proposer(e);
 await assert.rejects(()=>e.apply(),/Vue ESV non recentrée/);
 // Runtime recréé : aucune variable mémoire du processus interrompu n'est conservée.
 const relance=new Engine(adapter,store);await relance.init();
 assert.equal(relance.s.reconcileRequired,true,'l’état incertain est durable');
 await assert.rejects(()=>relance.apply(),/Réconciliation requise/);
 assert.equal(adapter.calls.filter(c=>c==='apply').length,1,'aucune seconde tentative d’application');
});

test('KI-030 · l’opérateur a une sortie qui ramène réellement les deux rails',async()=>{
 const {adapter,engine:e}=await app();await proposer(e);
 const avant=K.clone(adapter.rails);
 await assert.rejects(()=>e.apply(),/Vue ESV non recentrée/);
 await e.restore();
 assert.ok(K.equalPoses(avant,adapter.rails,1e-12),'les deux rails sont revenus à leur pose d’origine');
 assert.equal(e.s.reconcileRequired,false,'l’état incertain est levé une fois la scène restaurée');
 assert.equal(adapter.calls.filter(c=>c==='validate').length,0,'toujours aucun VALIDATE');
});

test('KI-030 · en lot, l’application partielle arrête le lot sans rien compter',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';
 await e.startBatch({part:23,start:100,end:102,testConfirmed:true,lowConfidence:'attempt',allowNavigationEvidence:true});
 await e.task;
 const b=e.s.batch;
 assert.equal(b.processed.length,0,'aucun cut traité');
 assert.equal(b.skipped.length,0,'aucun cut ignoré');
 assert.equal((b.deferred||[]).length,0,'un échec d’apply n’est pas un différé');
 assert.equal(b.state,'ERROR');
 assert.equal(e.s.reconcileRequired,true);
 assert.equal(adapter.calls.filter(c=>c==='validate').length,0,'aucun VALIDATE');
 assert.equal(adapter.calls.filter(c=>c==='skip').length,0,'aucun SKIP');
 /* Le lot ne repart pas tout seul sur un état incertain. */
 await assert.rejects(()=>e.resume(),/Réconciliation requise/);
 assert.ok(store.events.some(x=>x.type==='batch-error'||x.type==='batch-action-interrupted')
   ||b.error,'l’arrêt est tracé');
});
