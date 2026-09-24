/* Décision sur le lot dans le Pilote (4.7.8 à 4.7.12), au niveau du service
 * worker : observation, commande, reprise après archivage. Séparé de
 * `background.test.cjs` pour tenir sous 10 s par fichier. */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {MemoryStore,SimulatedESV}=require('./fixtures.cjs');
const {background,shadowHarness}=require('./helpers/background-harness.cjs');

/* 4.7.8 — décision sur le lot EN OBSERVATION dans le Pilote (amendement n°9) :
 * consignée avec l'observation GCV1, ancres gardées dans le lot, rien appliqué
 * au-delà de ce que le Pilote applique déjà. */
test('a GCV1 pilot batch records the lot decision in observation, never applies it',async()=>{
 const Shadow=require('../src/gcv1-shadow.js'),{base}=require('./fixtures.cjs');
 const science=Shadow.scientificProposeBoth(base);
 async function run(withLot){
  const shadow=shadowHarness();const arm=shadow.armOnce.bind(shadow);
  shadow.armOnce=selector=>{arm(selector);const out=shadow.consumeLast();shadow.consumeLast=()=>{shadow.calls.consume++;const o=shadow.pending;shadow.pending=null;return o;};
   shadow.pending={...out,rails:science.rails,summary:science.summary};};
  shadow.scientificProposeBoth=Shadow.scientificProposeBoth;
  const globals=withLot?{BananeLotDecision:require('../src/lot-decision.js'),BananeSettings:require('../src/settings.js'),BananeCore3:require('../src/core.js')}:{};
  const b=background({shadow,globals});
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1'});
  while(!['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','ERROR','PAUSED'].includes((await b.api('view')).batch?.state))await new Promise(r=>setImmediate(r));
  return {b,view:await b.api('view'),observed:b.store.events.filter(e=>e.type==='gcv1-shadow-observed')};
 }
 const lot=await run(true),control=await run(false);
 assert.ok(lot.observed.length>=1);
 for(const event of lot.observed){assert.equal(event.lotObservation.applied,false);assert.equal(event.lotObservation.displayed,false);
  assert.equal(event.lotObservation.stage,'first-pass');assert.ok(Number.isFinite(event.lotObservation.engineMs));}
 assert.equal(lot.observed[0].lotObservation.guardMm,null,'premier cut du lot : aucune ancre');
 if(lot.observed.length>1)assert.ok(lot.observed[1].lotObservation.guardMm<=30,'second cut confirmé par le premier');
 // Aucune interférence : mêmes commandes, même état de lot qu'un Pilote sans observation.
 assert.deepEqual(lot.b.adapter.calls,control.b.adapter.calls);
 assert.equal(lot.view.batch.state,control.view.batch.state);
 assert.ok(control.observed.every(e=>e.lotObservation===undefined));
});

/* KI-052 (partie 33, 24/09, cut 8090) : après « Archiver le résultat
 * interrompu », « Reprendre » relançait la boucle à l'étape « apply » sans
 * proposition (« Cannot read properties of null (reading 'rails') »). La
 * reprise recommence désormais le cut courant par sa capture. */
test('resume after closing an interrupted apply restarts the current cut from its capture',async()=>{
 const b=background();let fail=true;const apply=b.adapter.apply.bind(b.adapter);
 b.adapter.apply=async(...a)=>{if(fail){fail=false;throw Error('Position proposée hors de la vue : left');}return apply(...a);};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});
 const settle=async()=>{while(['RUNNING'].includes((await b.api('view')).batch?.state))await new Promise(r=>setImmediate(r));return b.api('view');};
 let view=await settle();assert.equal(view.batch.state,'ERROR');assert.equal(view.batch.step,'apply');
 await b.adapter.next();await b.api('close-uncertain');                    // l'opérateur passe au cut suivant et archive
 view=await b.api('view');assert.equal(view.batch.state,'STOPPED');
 await b.api('resume');view=await settle();
 assert.ok(!/reading 'rails'/.test(view.batch.error?.message||''),view.batch.error?.message);
 assert.equal(view.batch.processed.length,1);assert.equal(view.batch.processed[0].cut,101);
});
