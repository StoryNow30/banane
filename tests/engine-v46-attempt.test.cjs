const {test}=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../src/engine.js');const {MemoryStore,SimulatedESV,base,K}=require('./fixtures.cjs');
/* Lot V4.6.0, revue Astra complémentaire — IDENTITÉ DE TENTATIVE.
 *
 * `s.events` survit d'un lot à l'autre. Chercher l'acceptation par
 * pageId/part/cut revenait donc à confondre deux tentatives sur le même cut :
 * l'acceptation d'un lot antérieur pouvait créditer le lot courant. Chaque
 * validation porte désormais un `validationAttemptId`, créé avant la requête
 * irréversible et vérifié avec son `batchId` et son `proposalId`.
 *
 * Les quatre régressions demandées par la revue. Fichier séparé : chacune fait
 * tourner deux lots, et le banc borne chaque fichier à 10 s. */
async function app(){const adapter=new SimulatedESV(),store=new MemoryStore(),engine=new Engine(adapter,store);await engine.init();return {adapter,store,engine};}
const scope=(extra={})=>({part:23,start:100,end:100,testConfirmed:true,lowConfidence:'attempt',allowNavigationEvidence:true,...extra});
const enValidation=(adapter,id)=>({id,state:'RUNNING',step:'validate',scope:{...scope(),pageId:adapter.identity.pageId},
  processed:[],skipped:[],paused:[],interrupted:[],sequence:[],activeIdentity:K.clone(adapter.identity)});
// Le cut 100 est rouvert dans ESV, rails d'origine : le lot suivant repart dessus.
const rouvrirLeCut100=(adapter,e)=>{adapter.identity.cut=100;adapter.rails=K.clone(base.rails);
  e.s.before=null;e.s.proposal=null;e.s.applied=null;e.s.collection='IDLE';};
// Un lot complet qui accepte le cut 100 et laisse son acceptation dans le journal.
async function lotAccepte(e,adapter,id='lot-A'){
 await e.analyze();e.s.batch=enValidation(adapter,id);await e.apply();await e.validateAndNext(scope());
 return e.s.applied?.validationAttempt||null;
}

test('an acceptance from an earlier batch never credits a later batch on the same cut',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';
 const tentativeA=await lotAccepte(e,adapter);
 const acceptations=store.events.filter(x=>x.type==='validation-accepted');
 assert.equal(acceptations.length,1,'le lot A a bien laissé une acceptation dans le journal');
 assert.equal(acceptations[0].batchId,'lot-A');assert.equal(acceptations[0].identity.cut,100);
 // Lot B : même cut 100, nouvelle proposition, interruption AVANT toute validation.
 rouvrirLeCut100(adapter,e);await e.analyze();
 e.s.batch=enValidation(adapter,'lot-B');await e.apply();await e.save();
 assert.notEqual(e.s.applied.proposalId,tentativeA.proposalId,'la proposition du lot B est bien une autre');
 assert.equal(e.s.applied.validationAttempt,undefined,'le lot B n’a pas encore tenté de valider');
 const redemarre=new Engine(adapter,store);await redemarre.init();
 assert.equal(redemarre.s.batch.id,'lot-B');
 assert.equal(redemarre.s.batch.processed.length,0,'l’acceptation du lot A ne crédite pas le lot B');
 assert.equal(redemarre.s.batch.lastCompletedIdentity??null,null);
});

/* Le pendant du précédent : un intent ancien sur le même cut ne doit pas non
 * plus être lu comme l'intent courant. S'il l'était, le lot B se croirait
 * « commande partie » et se bloquerait sur un cut qu'il n'a jamais commandé. */
test('an intent from an earlier batch is not read as the current attempt',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';
 await lotAccepte(e,adapter);
 assert.ok(store.events.some(x=>x.type==='validation-intent'&&x.identity.cut===100),'le lot A a laissé son intent');
 rouvrirLeCut100(adapter,e);await e.analyze();
 e.s.batch=enValidation(adapter,'lot-B');await e.apply();await e.save();
 const redemarre=new Engine(adapter,store);await redemarre.init();
 // Rien n'est parti dans le lot B : il ne se bloque pas, et la reprise valide normalement.
 assert.notEqual(redemarre.s.batch.state,'PAUSED_AFTER_STATE_MISSING');
 assert.equal(redemarre.s.batch.step,'validate');
 const avant=adapter.calls.filter(c=>c==='validate').length;
 await redemarre.resume();await redemarre.task;
 assert.equal(adapter.calls.filter(c=>c==='validate').length,avant+1,'le lot B conduit sa propre validation');
 assert.equal(redemarre.s.batch.processed.length,1);
 assert.equal(redemarre.s.batch.processed[0].cut,100);
});

test('an accepted current attempt is credited exactly once, however many restarts follow',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';
 const tentative=await lotAccepte(e,adapter,'lot-unique');
 assert.ok(tentative.validationAttemptId,'la tentative est identifiée');
 const accepte=store.events.find(x=>x.type==='validation-accepted');
 assert.equal(accepte.validationAttemptId,tentative.validationAttemptId);
 assert.equal(accepte.batchId,'lot-unique');assert.equal(accepte.proposalId,tentative.proposalId);
 const premier=new Engine(adapter,store);await premier.init();
 assert.equal(premier.s.batch.processed.length,1);
 assert.equal(premier.s.batch.processed[0].validationAttemptId,tentative.validationAttemptId);
 assert.equal(premier.s.batch.processed[0].recovered,true);
 // Deuxième redémarrage sur le même état : toujours un seul crédit.
 const second=new Engine(adapter,store);await second.init();
 assert.equal(second.s.batch.processed.length,1);
 assert.equal(adapter.calls.filter(c=>c==='validate').length,1,'aucune commande n’est renvoyée');
});

/* Le cas le plus dangereux : la tentative courante est REFUSÉE, et une
 * acceptation ancienne du même cut dort dans le journal. Le refus doit tenir. */
test('a refused current attempt is never rescued by an older acceptance of the same cut',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';
 await lotAccepte(e,adapter);
 assert.equal(store.events.filter(x=>x.type==='validation-accepted').length,1);
 rouvrirLeCut100(adapter,e);await e.analyze();
 const sc={...scope(),pageId:adapter.identity.pageId},depart=K.clone(adapter.identity);
 e.s.batch=enValidation(adapter,'lot-B');await e.apply();
 // Navigation inattendue : saut de 100 à 105, refusée en marche.
 adapter.validateAndNext=async()=>{adapter.calls.push('validate');await adapter.next();
   return {commandSent:true,afterObserved:false,afterStateStatus:'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED',serverConfirmed:false,
     navigationObserved:true,nextIdentity:{...depart,cut:105},navigationAfter:{identity:{...depart,cut:105}}};};
 await assert.rejects(()=>e.validateAndNext(sc),/AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED/);
 const tentativeB=e.s.applied.validationAttempt;
 assert.equal(store.events.some(x=>x.type==='validation-accepted'&&x.validationAttemptId===tentativeB.validationAttemptId),false);
 const redemarre=new Engine(adapter,store);await redemarre.init();
 assert.equal(redemarre.s.batch.processed.length,0,'l’acceptation ancienne ne rattrape pas un refus');
 assert.equal(redemarre.s.batch.state,'PAUSED_AFTER_STATE_MISSING');
 assert.equal(redemarre.s.batch.error.code,'VALIDATION_NOT_ACCEPTED_BEFORE_RESTART');
 assert.equal(redemarre.s.batch.interrupted.at(-1).validationAttemptId,tentativeB.validationAttemptId);
 await assert.rejects(()=>redemarre.resume(),/État final manquant/);
 assert.equal(redemarre.closureSummary().completed,0);
});

/* Chemin hérité, ajouté avec la garde : un état écrit par une version
 * antérieure à V4.6.0 ne porte aucun identifiant de tentative. Si un intent
 * sans identifiant existe pour ce cut, la commande a pu partir — ni crédit, ni
 * renvoi. C'est le seul cas où l'absence d'identifiant bloque, et il ne doit
 * pas attraper un lot qui n'a simplement pas encore tenté de valider. */
test('a pre-V4.6.0 state without an attempt id is neither credited nor resent',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';
 await e.analyze();e.s.batch=enValidation(adapter,'lot-hérité');await e.apply();
 // Tel que 4.5.7 l'écrivait : un intent sans identifiant de tentative.
 await e.event('validation-intent',{identity:adapter.identity,commandSent:false,afterObserved:false,serverConfirmed:false,navigationObserved:false});
 assert.equal(e.s.applied.validationAttempt,undefined);
 assert.equal(store.events.at(-1).validationAttemptId,undefined);
 const redemarre=new Engine(adapter,store);await redemarre.init();
 assert.equal(redemarre.s.batch.processed.length,0);
 assert.equal(redemarre.s.batch.state,'PAUSED_AFTER_STATE_MISSING');
 assert.equal(redemarre.s.batch.interrupted.at(-1).legacyStateWithoutAttemptId,true);
 await assert.rejects(()=>redemarre.resume(),/État final manquant/);
 assert.equal(adapter.calls.filter(c=>c==='validate').length,0,'aucune commande n’est envoyée');
});
