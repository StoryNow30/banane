/* PORTÉE DU DERNIER GARDE D'ÉCARTEMENT — VOLONTAIREMENT GLOBALE.
 *
 * Le contrat d'écartement est une contrainte PHYSIQUE de la voie : il ne
 * dépend pas de l'algorithme qui a produit la proposition. Le dernier garde
 * vit donc dans `Engine.apply()`, au point de passage unique de toute
 * commande de déplacement, et il s'applique à TOUS les appelants :
 *
 *   — le lot Pilote GCV1 (`Engine.apply(true)` depuis la boucle du lot) ;
 *   — le lot automatique V4.6, qui emprunte la même boucle ;
 *   — la correction assistée d'un seul cut (« Accepter » du panneau, que
 *     `background.js` route vers `Engine.apply(false)`).
 *
 * Ce n'est pas un effet de bord : quel que soit le moteur, Banane ne doit pas
 * commander une paire hors de [1405, 1470] mm. GCV1 reste néanmoins le SEUL
 * chemin qui transforme normalement ce refus en `DEFERRED_UNRESOLVED` ; pour
 * les autres modes, le refus est un arrêt sûr, sans commande.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Engine}=require('../src/engine.js');
const G=require('../src/geometry.js');
const Gauge=require('../src/gauge.js');
const {K,MemoryStore,SimulatedESV}=require('./fixtures.cjs');

/* Écartement du double ESV avant correction : 1500,0 mm. */
const HORS_CONTRAT={left:[0,0.03,0.001],right:[0,-0.03,0.001]};   // ouvre la paire : ~1559,8 mm
const DANS_CONTRAT={left:[0,-0.03,0.001],right:[0,0.03,0.001]};   // referme : ~1440,0 mm
/* Une proposition V4.6 : ni `geometryEngine`, ni bloc `gcv1`. */
const v46Rails=deltas=>Object.fromEntries(['left','right'].map(side=>[side,{side,status:'candidate',
  delta:deltas[side].slice(),confidence:80,reasons:[],method:G.DEFAULTS.method,
  source:'lidar-template-supported'}]));

async function assisted(){const adapter=new SimulatedESV(),store=new MemoryStore(),engine=new Engine(adapter,store);
 await engine.init();engine.s.mode='assisted';return {adapter,store,engine};}

test('le panneau route bien « Accepter » vers Engine.apply : le garde est sur ce chemin',()=>{
 /* Épinglage statique : si cette route changeait, la correction assistée
  * cesserait de passer par le dernier garde sans qu'aucun essai ne le voie. */
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
 assert.match(src,/action==='accept'\)result=await engine\.apply\(/,
  '« accept » doit appeler Engine.apply, où vit le garde d’écartement');
});

test('A — correction assistée hors contrat : refus avant toute commande',async()=>{
 const {adapter,store,engine}=await assisted();
 await engine.analyze();
 /* La proposition vient de la géométrie V4.6 du dépôt ; on ne remplace que
  * les deltas, pour placer la paire hors contrat. */
 for(const side of ['left','right'])engine.s.proposal.rails[side].delta=HORS_CONTRAT[side].slice();
 const scene=JSON.stringify(adapter.rails);
 await assert.rejects(()=>engine.apply(false),err=>{
  assert.equal(err.code,'GAUGE_OUT_OF_CONTRACT');
  assert.match(err.message,/Aucune commande envoyée/);
  return true;});
 assert.deepEqual(adapter.calls,['capture'],'aucune commande après la lecture initiale');
 assert.equal(JSON.stringify(adapter.rails),scene,'la scène n’a pas bougé');
 assert.ok(!engine.s.reconcileRequired);
 assert.equal(engine.s.snapshot,null);
 assert.ok(!engine.s.intent);
 const violation=store.events.find(e=>e.type==='gauge-contract-violation');
 assert.ok(violation,'la violation est journalisée hors GCV1 aussi');
 assert.equal(violation.stage,'engine-pre-apply');
 /* Aucune attribution GCV1 sur cette proposition : le garde ne la réclame pas. */
 assert.equal(engine.s.proposal.rails.left.geometryEngine,undefined);
});

test('A bis — correction assistée admissible : comportement historique intact',async()=>{
 const {adapter,store,engine}=await assisted();
 await engine.analyze();
 for(const side of ['left','right'])engine.s.proposal.rails[side].delta=DANS_CONTRAT[side].slice();
 await engine.apply(false);
 assert.equal(adapter.calls.filter(c=>c==='apply').length,1);
 assert.equal(store.events.some(e=>e.type==='gauge-contract-violation'),false);
 assert.equal(store.events.some(e=>e.type==='applied-verified'),true);
 assert.ok(!engine.s.reconcileRequired);
});

/* ---- lot automatique V4.6, sans aucune attribution GCV1 ---- */
function batchEngine(rails){
 const geometry={...G,proposeBoth(){return K.clone(rails);}};
 const ctx={BananeCore3:K,BananeGeometry3:geometry,BananeGauge4:Gauge};vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/engine.js'),'utf8'),ctx);
 return ctx.BananeEngine3.Engine;
}
const v46Scope={pageId:'fixture-page',part:23,start:100,end:100,testConfirmed:true,
 allowNavigationEvidence:true,lowConfidence:'attempt'};
async function runBatch(rails){
 const Eng=batchEngine(rails),adapter=new SimulatedESV(),store=new MemoryStore(),engine=new Eng(adapter,store);
 await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch({...v46Scope});await engine.task;
 return {engine,adapter,store};
}

test('B — lot V4.6 hors contrat : refus avant adapter.apply, lot arrêté sans commande',async()=>{
 const {engine,adapter,store}=await runBatch(v46Rails(HORS_CONTRAT));
 assert.equal(engine.s.batch.scope.geometryEngine,undefined,'ce lot n’est pas un lot GCV1');
 assert.equal(engine.s.batch.state,'ERROR');
 assert.match(engine.s.batch.error.message,/Écartement de paire hors contrat/);
 assert.deepEqual(adapter.calls,['capture']);
 for(const call of ['apply','validate','skip','nextWithoutDecision'])
  assert.equal(adapter.calls.filter(c=>c===call).length,0,call);
 assert.ok(!engine.s.reconcileRequired);
 assert.equal(engine.s.batch.processed.length,0);
 assert.ok(store.events.some(e=>e.type==='gauge-contract-violation'));
 /* Un lot V4.6 n’a pas de chemin de différé GCV1 : le refus reste un arrêt. */
 assert.equal(engine.s.batch.deferred.length,0);
});

test('C — lot V4.6 admissible : appliqué et validé comme avant',async()=>{
 const {engine,adapter,store}=await runBatch(v46Rails(DANS_CONTRAT));
 assert.equal(adapter.calls.filter(c=>c==='apply').length,1);
 assert.equal(adapter.calls.filter(c=>c==='validate').length,1);
 assert.equal(engine.s.batch.processed.length,1);
 assert.equal(store.events.some(e=>e.type==='gauge-contract-violation'),false);
 /* La scène du double est déjà repartie sur le cut suivant après la
  * navigation ; l'état qui compte est celui relu juste après la commande. */
 const applied=store.events.find(e=>e.type==='applied-verified');
 assert.equal(Gauge.classifyMm(Gauge.gaugeMmOf(applied.observed.rails,K.C)),'NOMINAL',
  'la paire réellement appliquée est dans le contrat');
});

test('le garde ne consulte jamais l’attribution du moteur : la seule entrée est la paire prévue',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../src/engine.js'),'utf8');
 const bloc=src.slice(src.indexOf('ÉTAGE B'),src.indexOf("error.code='GAUGE_OUT_OF_CONTRACT'"));
 assert.ok(!/geometryEngine|gcv1/.test(bloc),
  'le garde ne doit pas dépendre du moteur d’origine : le contrat est physique');
 assert.ok(!/skipAndNext|explicit-skip|validateAndNext/.test(bloc),
  'le garde ne prononce aucune décision ESV');
});
