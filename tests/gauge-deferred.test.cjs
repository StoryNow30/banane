/* GARDE D'ÉCARTEMENT — CHEMIN RUNTIME COMPLET.
 *
 * Deux trajets sont épinglés ici, tous deux relevés par la QA indépendante
 * comme non couverts par le lot correctif :
 *
 *   1. le chemin NORMAL : l'étage A de GCV1 refuse la paire, les deux rails
 *      deviennent une abstention, et le cut part en DEFERRED_UNRESOLVED par
 *      une navigation sans décision — sans apply, sans VALIDATE, sans SKIP ;
 *   2. le chemin de VIOLATION D'INVARIANT : l'étage A est contourné et une
 *      paire hors contrat atteint la boucle automatique. Le dernier garde du
 *      moteur doit alors arrêter le lot sans rien commander.
 *
 * Le cas 1 est joué sur un cut RÉEL du lot Edge de la partie 15, avec ses
 * poses avant et ses deltas publiés (`tests/fixtures/gauge-part15-smoke.json`).
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const G=require('../src/geometry.js');
const Gauge=require('../src/gauge.js');
const Shadow=require('../src/gcv1-shadow.js');
const C=require('../vendor/capture-core.js');
const {K,MemoryStore,SimulatedESV}=require('./fixtures.cjs');

const SMOKE=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gauge-part15-smoke.json'),'utf8'));
const smokeCut=n=>{const row=SMOKE.cuts.find(c=>c.cut===n);assert.ok(row,'cut '+n+' absent de la fixture');return row;};

/* Le moteur lit ses dépendances depuis globalThis dans ce contexte, comme au
 * chargement de background.js : le contrat d'écartement en fait partie. */
function engineWith(proposeBoth){
 const geometry={...G,proposeBoth};
 const ctx={BananeCore3:K,BananeGeometry3:geometry,BananeGauge4:Gauge};vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/engine.js'),'utf8'),ctx);
 return ctx.BananeEngine3.Engine;
}
/* Un double ESV posé sur les rails RÉELS d'un cut de la partie 15. Seules les
 * grandeurs de pose viennent du terrain ; la science n'est pas rejouée ici,
 * elle est remplacée par les propositions réellement publiées ce jour-là. */
class Part15ESV extends SimulatedESV{
 constructor(row){super();
  this.rails=K.clone({left:row.before.left,right:row.before.right});
  this.identity={...this.identity,part:row.part,cut:row.cut};}
}
const railsOf=row=>K.clone({left:row.before.left,right:row.before.right});
const scope=row=>({pageId:'fixture-page',part:row.part,start:row.cut,end:row.cut,testConfirmed:true,
 allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',
 geometryContract:{id:'GEOMETRY_CANDIDATE_V1',geometrySha256:'candidate-hash'},unresolvedPolicy:'defer'});

test('cut 850 : la paire réellement publiée en lot Edge est bien hors contrat',()=>{
 const row=smokeCut(850);
 const report=Gauge.assessPair(railsOf(row),row.deltas,C);
 assert.equal(row.statuses.left,'candidate');
 assert.equal(row.statuses.right,'candidate');
 assert.equal(report.gaugeClass,'HIGH_INVALID');
 assert.equal(report.admissible,false);
 assert.equal(report.measurable,true);
 /* Ce cut a bien été appliqué ET validé sur le terrain : c'est le défaut. */
 assert.equal(row.terrain.applied,true);
 assert.equal(row.terrain.validated,true);
});

test('chemin NORMAL : étage A → abstention des deux rails → DEFERRED_UNRESOLVED, rien d’autre',async()=>{
 const row=smokeCut(850);
 /* L'étage A est exercé pour de vrai : on part des candidats publiés ce
  * jour-là et on laisse `scientificProposeBoth` les arbitrer via la même
  * composition que la production, puis on publie par `toRuntimeRails`. */
 const science={rails:{},pairGauge:null,summary:{}};
 for(const side of ['left','right'])
  science.rails[side]={ok:true,side,frame:{sign:1},v46:{status:'candidate',delta:row.deltas[side]},
    astar:{status:'candidate',motif:'candidate',reason:null},
    next:{status:'candidate',motif:'candidate',reason:null,delta:row.deltas[side],
      loss:1e-6,topRows:40,faceCount:8,slopeLimited:false,activated:false,changed:false,
      nClusters:1,nStrongCompetitive:1,pick:{u:0,z:0}},
    competitive:{},poolMeta:{},s1Activated:false,s1Changed:false,publishedWeak:false,
    s1AmbiguityPreserved:false,deltaV46Next:0};
 const gate=Shadow._test.assessPublishedPair({rails:railsOf(row)},science.rails);
 assert.equal(gate.admissible,false,'la garde de paire doit refuser ce couple');
 /* Les deux rails deviennent une abstention attribuée à GCV1. */
 for(const side of ['left','right']){
  science.rails[side].next={...science.rails[side].next,status:'unresolved',
    motif:'gauge-out-of-contract',delta:null,pick:null,changed:false,
    reason:'Écartement de paire hors contrat : '+gate.predictedMm.toFixed(1)+' mm ('+gate.gaugeClass+').'};
 }
 const runtime=Shadow.toRuntimeRails(science);
 for(const side of ['left','right']){
  assert.equal(runtime[side].status,'unresolved',side);
  assert.equal(runtime[side].delta,null,side);
  assert.equal(runtime[side].confidence,0,side);
  assert.equal(runtime[side].source,'geometry-candidate-v1-abstention',side);
  assert.equal(runtime[side].gcv1.motif,'gauge-out-of-contract',side);
  assert.equal(runtime[side].geometryEngine,'geometry-candidate-v1',side);
 }

 /* Ces rails-là, tels quels, doivent traverser le moteur jusqu'au différé. */
 const Engine=engineWith(()=>K.clone(runtime));
 const adapter=new Part15ESV(row),store=new MemoryStore(),engine=new Engine(adapter,store);
 await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope(row));await engine.task;

 assert.equal(engine.s.batch.deferred.length,1,'exactement un cut différé');
 const deferred=engine.s.batch.deferred[0];
 assert.equal(deferred.cut,row.cut);
 /* `deferred` vient du moteur chargé dans un contexte vm : ses tableaux ont
  * un autre prototype, on les ramène dans ce realm avant comparaison. */
 assert.deepEqual([...deferred.unresolvedRails],['left','right'],'les DEUX rails sont abstenus');
 assert.equal(deferred.policy,'defer');
 assert.equal(deferred.bananeValidated,false);
 assert.equal(deferred.transition,'NEXT_CUT_WITHOUT_DECISION_SAME_PAGE_AND_PART');
 for(const side of ['left','right']){
  assert.equal(deferred.rails[side].gcv1.motif,'gauge-out-of-contract',side);
  assert.equal(deferred.rails[side].proposal,null,side+' : aucun delta différé');
 }
 /* Une seule commande, et c'est une navigation sans décision. */
 assert.deepEqual(adapter.calls,['capture','nextWithoutDecision']);
 assert.equal(adapter.calls.filter(c=>c==='apply').length,0,'0 apply');
 assert.equal(adapter.calls.filter(c=>c==='validate').length,0,'0 VALIDATE');
 assert.equal(adapter.calls.filter(c=>c==='skip').length,0,'0 SKIP');
 assert.equal(deferred.evidence.applyCommandSent,false);
 assert.equal(deferred.evidence.validationCommandSent,false);
 assert.equal(deferred.evidence.skipCommandSent,false);
 assert.equal(deferred.evidence.operatorDecision,null);
 /* Le différé est finalisé durablement, et aucun garde d'écartement n'a eu à
  * intervenir dans le moteur : l'étage A a suffi. */
 assert.equal(store.events.filter(e=>e.type==='defer-finalized').length,1,'un différé finalisé');
 assert.equal(store.events.some(e=>e.type==='gauge-contract-violation'),false,
  'le dernier garde ne doit pas avoir eu à se déclencher');
 assert.ok(!engine.s.reconcileRequired);
});

test('VIOLATION D’INVARIANT : une paire hors contrat qui atteint la boucle est arrêtée sans commande',async()=>{
 const row=smokeCut(850);
 /* L'étage A est délibérément contourné : la géométrie rend deux candidats
  * hors contrat, attribués à GCV1, comme si la garde de paire avait échoué. */
 const bypass=Object.fromEntries(['left','right'].map(side=>[side,{side,status:'candidate',
   delta:row.deltas[side].slice(),confidence:80,reasons:[],method:G.DEFAULTS.method,
   source:'geometry-candidate-v1-astar',geometryEngine:'geometry-candidate-v1',
   gcv1:{confidenceStatus:'candidate-v1'}}]));
 const Engine=engineWith(()=>K.clone(bypass));
 const adapter=new Part15ESV(row),store=new MemoryStore(),engine=new Engine(adapter,store);
 await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope(row));await engine.task;

 assert.equal(engine.s.batch.state,'ERROR','le lot s’arrête sur un état terminal, sans boucler');
 assert.match(engine.s.batch.error.message,/Écartement de paire hors contrat/);
 assert.match(engine.s.batch.error.message,/Aucune commande envoyée/);
 assert.equal(engine.s.batch.error.step,'apply');
 /* Aucune commande, d'aucune sorte. */
 assert.deepEqual(adapter.calls,['capture'],'seule la lecture initiale a eu lieu');
 for(const call of ['apply','validate','skip','nextWithoutDecision','restore'])
  assert.equal(adapter.calls.filter(c=>c===call).length,0,call);
 /* Aucun état partiellement appliqué, et rien à réconcilier. */
 assert.ok(!engine.s.reconcileRequired,'reconcileRequired doit rester faux');
 assert.equal(engine.s.applied,null,'aucune application enregistrée');
 assert.equal(engine.s.snapshot,null,'aucun snapshot pris');
 assert.ok(!engine.s.intent,'aucune intention pendante');
 assert.equal(engine.s.batch.processed.length,0);
 assert.equal(engine.s.batch.deferred.length,0);
 assert.equal(engine.s.batch.skipped.length,0);
 /* La violation est journalisée, et se nomme.  */
 const violation=store.events.find(e=>e.type==='gauge-contract-violation');
 assert.ok(violation,'un événement de violation doit exister');
 assert.equal(violation.gaugeClass,'HIGH_INVALID');
 assert.equal(violation.stage,'engine-pre-apply');
 assert.equal(violation.invariant,'GCV1_PAIR_GAUGE_GATE_SHOULD_HAVE_ABSTAINED');
 assert.equal(violation.commandSent,false);
 assert.equal(violation.validateSent,false);
 assert.equal(violation.skipSent,false);
 assert.deepEqual(violation.contract,Gauge.CONTRACT);
});
