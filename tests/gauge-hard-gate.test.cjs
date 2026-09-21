/* ÉTAGE B — DERNIER GARDE AVANT COMMANDE, INDÉPENDANT DE LA COUCHE GCV1.
 *
 * L'étage A de GCV1 transforme normalement une paire hors contrat en
 * abstention. Ces essais CONTOURNENT volontairement l'étage A : la proposition
 * est injectée directement dans le moteur, avec deux deltas présents, pour
 * démontrer que la seconde défense existe réellement et qu'elle ne commande
 * rien.
 *
 * Un déclenchement réel de cet étage dans un lot GCV1 est une violation
 * d'invariant, pas une seconde façon de trancher : le moteur ne fabrique aucun
 * résultat scientifique, il refuse d'agir et laisse un état récupérable.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Engine}=require('../src/engine.js');
const {MemoryStore,SimulatedESV,K}=require('./fixtures.cjs');
const Gauge=require('../src/gauge.js');

/* Écartement du double ESV avant correction : 1500,0 mm. Les couples ci-dessous
 * sont calibrés sur ce double, et vérifiés par l'essai de calibration. */
const HORS_HAUT={left:[0,0.03,0.001],right:[0,-0.03,0.001]};   // écarte la paire : ~1559,8 mm
const HORS_BAS={left:[0,-0.06,0.001],right:[0,0.06,0.001]};    // referme trop : ~1380,1 mm
const DANS_CONTRAT={left:[0,-0.03,0.001],right:[0,0.03,0.001]};// ~1440,0 mm

async function app(){const adapter=new SimulatedESV(),store=new MemoryStore(),engine=new Engine(adapter,store);
 await engine.init();engine.s.mode='assisted';return {adapter,store,engine};}
/* Injection directe : on remplace les deltas de la proposition déjà analysée,
 * sans passer par la géométrie ni par GCV1. */
async function proposeThen(engine,deltas){
 await engine.analyze();
 for(const side of ['left','right'])engine.s.proposal.rails[side].delta=deltas[side].slice();
 return engine;
}
const predicted=(engine,deltas)=>
  Gauge.gaugeMmOf(K.expectedPoses(engine.s.before,{left:{delta:deltas.left},right:{delta:deltas.right}}),K.C);

test('calibration du double : les trois couples encadrent bien le contrat',async()=>{
 const {engine}=await app();await engine.analyze();
 assert.equal(Gauge.classifyMm(Gauge.gaugeMmOf(engine.s.before.rails,K.C)),'HIGH_INVALID','le BEFORE du double est 1500 mm');
 assert.equal(Gauge.classifyMm(predicted(engine,HORS_HAUT)),'HIGH_INVALID');
 assert.equal(Gauge.classifyMm(predicted(engine,HORS_BAS)),'LOW_INVALID');
 assert.equal(Gauge.classifyMm(predicted(engine,DANS_CONTRAT)),'NOMINAL');
});

for(const [nom,deltas,classe] of [['au-dessus de 1470',HORS_HAUT,'HIGH_INVALID'],['en dessous de 1405',HORS_BAS,'LOW_INVALID']]){
 test(`écartement ${nom} : aucune commande, aucun VALIDATE, aucun SKIP, état récupérable`,async()=>{
  const {adapter,store,engine}=await app();
  await proposeThen(engine,deltas);
  const railsAvant=JSON.stringify(adapter.rails);
  await assert.rejects(()=>engine.apply(),err=>{
   assert.equal(err.code,'GAUGE_OUT_OF_CONTRACT');
   assert.match(err.message,/Écartement de paire hors contrat/);
   assert.match(err.message,/Aucune commande envoyée/);
   return true;});
  // aucune commande d'aucune sorte n'a atteint l'adaptateur
  assert.equal(adapter.calls.filter(c=>c==='apply').length,0,'apply');
  assert.equal(adapter.calls.filter(c=>c==='validate').length,0,'VALIDATE');
  assert.equal(adapter.calls.filter(c=>c==='skip').length,0,'SKIP');
  assert.equal(adapter.calls.filter(c=>c==='nextWithoutDecision').length,0,'navigation');
  assert.equal(adapter.calls.filter(c=>c==='restore').length,0,'restore');
  assert.deepEqual(adapter.calls,['capture'],'seule la lecture initiale a eu lieu');
  // la scène simulée n'a pas bougé
  assert.equal(JSON.stringify(adapter.rails),railsAvant,'aucune mutation ESV');
  // état récupérable : rien de sale n'est resté dans le moteur
  assert.ok(!engine.s.reconcileRequired,'reconcileRequired doit rester faux');
  assert.equal(engine.s.applied,null,'aucune application enregistrée');
  assert.ok(!engine.s.intent,'aucune intention pendante');
  assert.equal(engine.s.snapshot,null,'aucun snapshot pris');
  assert.equal(engine.s.validationStarted,false,'aucune validation entamée');
  // et la violation est journalisée explicitement
  const event=store.events.find(e=>e.type==='gauge-contract-violation');
  assert.ok(event,'un événement de violation doit exister');
  assert.equal(event.gaugeClass,classe);
  assert.equal(event.commandSent,false);
  assert.equal(event.validateSent,false);
  assert.equal(event.skipSent,false);
  assert.equal(event.stage,'engine-pre-apply');
  assert.equal(event.invariant,'GCV1_PAIR_GAUGE_GATE_SHOULD_HAVE_ABSTAINED');
  assert.deepEqual(event.contract,Gauge.CONTRACT);
  assert.ok(Number.isFinite(event.gaugeMm)&&Number.isFinite(event.beforeGaugeMm));
  // le refus est rejouable : rien n'a changé, la seconde tentative refuse pareil
  await assert.rejects(()=>engine.apply(),/hors contrat/);
  assert.equal(adapter.calls.filter(c=>c==='apply').length,0);
 });
}

test('une paire dans le contrat passe le dernier garde et s’applique normalement',async()=>{
 const {adapter,store,engine}=await app();
 await proposeThen(engine,DANS_CONTRAT);
 await engine.apply();
 assert.equal(adapter.calls.filter(c=>c==='apply').length,1);
 assert.equal(store.events.some(e=>e.type==='gauge-contract-violation'),false);
 assert.equal(store.events.some(e=>e.type==='applied-verified'),true);
 assert.ok(!engine.s.reconcileRequired);
 assert.equal(Gauge.classifyMm(Gauge.gaugeMmOf(adapter.rails,K.C)),'NOMINAL','la scène est dans le contrat');
});

test('un écartement non mesurable ne peut pas franchir le dernier garde',()=>{
 /* La condition du moteur est `!Gauge.admissible(classe)` : une mesure non
  * finie tombe donc dans le refus, jamais dans le passage. */
 assert.equal(Gauge.classifyMm(NaN),'INDETERMINATE');
 assert.equal(Gauge.admissible('INDETERMINATE'),false);
 /* En pratique cette branche est hors d'atteinte avec un état bien formé :
  * `K.expectedPoses` RECALCULE `positionSceneRelative` depuis la matrice du
  * rail, donc l'état attendu porte toujours les deux origines. */
 const before={rails:{left:{railLocalToSceneRelative:K.C.identity(),profileLocalToSceneRelative:K.C.identity()},
   right:{railLocalToSceneRelative:K.C.translation([0,1.44,0]),profileLocalToSceneRelative:K.C.translation([0,1.44,0])}}};
 const expected=K.expectedPoses(before,{left:{delta:[0,0,0]},right:{delta:[0,0,0]}});
 assert.ok(Array.isArray(expected.left.positionSceneRelative),'origine gauche recalculée');
 assert.ok(Array.isArray(expected.right.positionSceneRelative),'origine droite recalculée');
 assert.equal(Gauge.classifyMm(Gauge.gaugeMmOf(expected,K.C)),'NOMINAL');
});

test('un état malformé échoue avant le garde, et ne commande rien non plus',async()=>{
 const {adapter,engine}=await app();
 await proposeThen(engine,DANS_CONTRAT);
 delete adapter.rails.right.railLocalToSceneRelative;
 await assert.rejects(()=>engine.apply());
 assert.equal(adapter.calls.filter(c=>c==='apply').length,0,'aucune commande');
 assert.equal(adapter.calls.filter(c=>c==='validate').length,0,'aucun VALIDATE');
 assert.equal(adapter.calls.filter(c=>c==='skip').length,0,'aucun SKIP');
});
