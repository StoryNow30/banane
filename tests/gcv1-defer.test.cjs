/* BANANE 4.7 — DIFFÉRER UN UNRESOLVED GCV1.
 *
 * Ce que ces essais démontrent : qu'un cut réellement non résolu par GCV1 peut
 * être quitté par une NAVIGATION SANS DÉCISION, qu'il est enregistré une fois,
 * et que rien d'autre ne l'est. Ce qu'ils ne démontrent PAS : l'effet réel de
 * Maj+Z dans Edge. Une doublure ESV ne prouve pas ce qu'ESV fait — voir la
 * procédure terrain de CHANGELOG.md et la limite déclarée dans
 * `shortcutEquivalence` de src/adapter-page.js.
 *
 * Le banc est découpé en trois fichiers pour tenir le budget de temps par
 * fichier de tools/verify.cjs ; le harnais commun est dans tests/helpers/defer.cjs.
 */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {G,K,GCV1,MemoryStore,SimulatedESV,EngineWith,candidate,unresolved,scope,byCut,pilot,counts,restartFrom}=require('./helpers/defer.cjs');

/* ---------------------------------------------------------------- Defer simple */

test('un rail unresolved diffère le cut entier : zéro apply, VALIDATE ou SKIP, une navigation, un deferred',async()=>{
 const {engine,adapter,store}=await pilot(byCut({default:unresolved(['right'])}));
 assert.deepEqual(counts(adapter),{apply:0,validate:0,skip:0,nextWithoutDecision:1,capture:1});
 const b=engine.s.batch;
 assert.equal(b.deferred.length,1);assert.equal(b.processed.length,0);assert.equal(b.skipped.length,0);assert.equal(b.paused.length,0);
 const entry=b.deferred[0];
 assert.equal(entry.cut,100);assert.deepEqual(entry.unresolvedRails,['right']);
 assert.equal(entry.nextIdentity.cut,101);assert.equal(entry.transition,'NEXT_CUT_WITHOUT_DECISION_SAME_PAGE_AND_PART');
 assert.equal(entry.bananeValidated,false);
 // Le rail candidat n'a PAS été appliqué d'abord : le cut entier est différé.
 assert.equal(entry.rails.left.status,'candidate');assert.equal(entry.rails.right.status,'unresolved');
 const record=store.records.find(r=>r.format==='banane-deferred-unresolved-v1');
 assert.equal(record.decision,'DEFERRED_UNRESOLVED');assert.equal(record.operatorDecision,null);
 assert.equal(record.applyCommandSent,false);assert.equal(record.validationCommandSent,false);assert.equal(record.skipCommandSent,false);
 assert.equal(record.commandScope,'banane-operation-only');assert.equal(record.usableForTraining,false);
 assert.equal(record.scientificDecisionPreserved,'gcv1-unresolved-rails-remain-unresolved');
 assert.ok(record.lidarCaptureId,'la capture LiDAR est référencée, pas inventée');
 assert.equal(record.proposalId,store.events.find(e=>e.type==='proposed').proposal.id);
});

test('les deux rails unresolved sont différés de la même façon, sans décision',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}));
 assert.deepEqual(counts(adapter),{apply:0,validate:0,skip:0,nextWithoutDecision:1,capture:1});
 assert.deepEqual(engine.s.batch.deferred[0].unresolvedRails,['left','right']);
});

test('un lot mixte traite, diffère, traite, sans application partielle du cut différé',async()=>{
 const {engine,adapter}=await pilot(byCut({700:candidate(),701:unresolved(['right']),702:candidate()}),{start:700,end:702});
 const b=engine.s.batch;
 assert.deepEqual(b.processed.map(x=>x.cut),[700,702]);
 assert.deepEqual(b.deferred.map(x=>x.cut),[701]);
 assert.equal(b.skipped.length,0);
 assert.deepEqual(counts(adapter),{apply:2,validate:2,skip:0,nextWithoutDecision:1,capture:3});
 const bilan=engine.closureSummary();
 assert.equal(bilan.completed,2);assert.equal(bilan.deferred,1);assert.equal(bilan.skipped,0);
 assert.deepEqual(bilan.deferredCuts,[K.cutId(b.deferred[0].identity)]);
 assert.equal(b.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');
});

/* ------------------------------------------------------------------ Politiques */

test('la politique pause d’un lot ancien, sans le champ, reste la pause historique',async()=>{
 const Engine=EngineWith(byCut({default:unresolved()})),adapter=new SimulatedESV(),store=new MemoryStore();
 const ancien=new Engine(adapter,store);await ancien.init();ancien.s.mode='automatic-test';
 const ancienScope=scope({end:101});delete ancienScope.unresolvedPolicy;ancienScope.pageId=adapter.identity.pageId;
 ancien.s.batch={id:'lot-4.6',state:'PAUSED',step:'capture',scope:ancienScope,processed:[],skipped:[],paused:[],
  interrupted:[],sequence:[],activeIdentity:K.completeIdentity(adapter.identity)};
 await ancien.save();
 const repris=new Engine(adapter,store);await repris.init();
 assert.deepEqual(repris.s.batch.deferred,[],'un lot ancien se relit avec une collection deferred vide');
 assert.equal(repris.unresolvedPolicy(repris.s.batch),'pause');
 await repris.resume();await repris.task;
 assert.equal(repris.s.batch.state,'PAUSED_UNRESOLVED_RAIL');
 assert.equal(adapter.calls.includes('nextWithoutDecision'),false);
 assert.equal(repris.s.batch.deferred.length,0);
});

test('un changement du réglage d’interface ne convertit pas un lot en cours',async()=>{
 const {engine}=await pilot(byCut({default:unresolved()}),{unresolvedPolicy:'pause'});
 assert.equal(engine.s.batch.state,'PAUSED_UNRESOLVED_RAIL');
 // Le scope persistant est la seule source : rien d'extérieur ne le réécrit.
 assert.equal(engine.s.batch.scope.unresolvedPolicy,'pause');
 assert.equal(engine.unresolvedPolicy(engine.s.batch),'pause');
 assert.equal(engine.s.batch.paused[0].unresolvedPolicy,'pause');
});

test('hors Pilote GCV1, le défaut reste la pause et defer ne s’applique pas',async()=>{
 const v46=Object.fromEntries(['left','right'].map(side=>[side,{side,status:'unresolved',delta:null,confidence:0,
  reasons:['moteur v4.6'],method:G.DEFAULTS.method,source:'no-estimate'}]));
 const sansMoteur=scope();delete sansMoteur.geometryEngine;delete sansMoteur.geometryContract;delete sansMoteur.unresolvedPolicy;
 const Engine=EngineWith(()=>K.clone(v46)),adapter=new SimulatedESV(),store=new MemoryStore();
 const engine=new Engine(adapter,store);await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(sansMoteur);await engine.task;
 assert.equal(engine.s.batch.scope.unresolvedPolicy,'pause');
 assert.equal(engine.s.batch.state,'PAUSED_UNRESOLVED_RAIL');
 assert.equal(adapter.calls.includes('nextWithoutDecision'),false);
});

/* ----------------------------------------------------------------- Éligibilité */

test('une proposition d’une autre identité ne peut pas différer le cut courant',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}),{},({engine})=>{
  const analyze=engine.analyze.bind(engine);
  engine.analyze=async(...args)=>{const p=await analyze(...args);p.identity={...p.identity,cut:p.identity.cut+7};return p;};
 });
 assert.equal(engine.s.batch.state,'PAUSED_UNRESOLVED_RAIL');
 assert.equal(adapter.calls.includes('nextWithoutDecision'),false);
 assert.equal(engine.s.batch.paused[0].deferRefused.reason,'PROPOSAL_IDENTITY_MISMATCH');
});

test('un repli hors GCV1 déclaré dans la sélection interdit le defer',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}),{},({engine})=>{
  const analyze=engine.analyze.bind(engine);
  engine.analyze=async(...args)=>{const p=await analyze(...args);
   p.geometryEngine='v4.6';p.geometrySelection={selector:'active-pilot-test',requestedEngine:GCV1,selectedEngine:'v4.6',fallback:true};return p;};
 });
 assert.equal(engine.s.batch.state,'PAUSED_UNRESOLVED_RAIL');
 assert.equal(adapter.calls.includes('nextWithoutDecision'),false);
 assert.equal(engine.s.batch.paused[0].deferRefused.reason,'GCV1_NOT_SELECTED');
});

test('un delta manquant qui n’est pas une abstention GCV1 n’est pas un unresolved GCV1',async()=>{
 // Gauche : abstention GCV1 authentique. Droite : delta manquant SANS abstention.
 const rails=unresolved(['left']);rails.right={...rails.right,delta:null,status:'candidate'};
 const {engine,adapter}=await pilot(byCut({default:rails}));
 assert.equal(engine.s.batch.state,'PAUSED_UNRESOLVED_RAIL');
 assert.equal(adapter.calls.includes('nextWithoutDecision'),false);
 assert.equal(engine.s.batch.paused[0].deferRefused.reason,'MISSING_DELTA_WITHOUT_GCV1_ABSTENTION');
});

test('une erreur technique GCV1 garde son diagnostic et ne diffère rien',async()=>{
 const {engine,adapter}=await pilot(()=>{throw Error('candidate-technical-test');});
 assert.equal(engine.s.batch.state,'ERROR');assert.match(engine.s.batch.error.message,/candidate-technical-test/);
 assert.deepEqual(counts(adapter),{apply:0,validate:0,skip:0,nextWithoutDecision:0,capture:1});
 assert.equal(engine.s.batch.deferred.length,0);
});

test('les politiques de faible confiance et S1 sont inchangées par 4.7',async()=>{
 const s1=await pilot(byCut({default:candidate(0,'non-calibrated-s1-selection')}));
 assert.equal(s1.engine.s.batch.processed.length,1);assert.equal(s1.engine.s.batch.deferred.length,0);
 assert.equal(s1.adapter.calls.filter(x=>x==='apply').length,1);
 const basse=await pilot(byCut({default:candidate(5)}),{lowConfidence:'pause'});
 assert.equal(basse.engine.s.batch.state,'PAUSED');assert.equal(basse.engine.s.batch.pauseReason,'low-confidence');
 assert.equal(basse.adapter.calls.includes('nextWithoutDecision'),false);assert.equal(basse.engine.s.batch.deferred.length,0);
});
