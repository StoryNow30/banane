const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs');
const {SimulatedESV,K}=require('./fixtures.cjs');
const options={part:23,navigation:{previousButtonId:'AssumedPrevious',inspection:'verified-dom-button-no-decision'}};
const target=source=>({...source,cut:99});

test('simulateur : nominal, absence, désactivation, annulation et doublon',async()=>{
 const esv=new SimulatedESV(),from=K.clone(esv.identity),to=target(from);
 for(const state of ['absent','disabled']){
  esv.previousButton=state;
  assert.equal((await esv.previousWithoutDecision(from,to,options,state)).refusal.code,'NAVIGATION_COMMAND_UNAVAILABLE');
 }
 await esv.cancel({operationId:'annule'});
 assert.equal((await esv.previousWithoutDecision(from,to,options,'annule')).refusal.code,'CANCELLED_BEFORE_COMMAND');
 esv.previousButton='available';
 const result=await esv.previousWithoutDecision(from,to,options,'retour');
 assert.equal(result.targetReached,true);assert.equal(result.serverConfirmed,false);
 assert.equal((await esv.previousWithoutDecision(from,to,options,'retour')).refusal.code,'OPERATION_ALREADY_INVOKED');
 assert.equal(esv.previousCalls.length,1);assert.equal(esv.calls.includes('validate')||esv.calls.includes('skip'),false);
});
test('simulateur : cible divergente, cut déjà validé, voisin hors liste',async()=>{
 const esv=new SimulatedESV(),from=K.clone(esv.identity),to=target(from);
 esv.previousIdentity={...to,cut:98};
 const wrong=await esv.previousWithoutDecision(from,to,options,'wrong');
 assert.equal(wrong.targetReached,false);assert.equal(wrong.reconcileRequired,true);
 const other=new SimulatedESV(),destination=target(other.identity);
 other.deferredCuts.add(K.cutId(destination));other.validatedCuts.add(K.cutId(destination));
 await other.previousWithoutDecision(other.identity,destination,options,'valid');
 assert.equal(other.repriseGuard(destination).reason,'ALREADY_VALIDATED');
 other.validatedCuts.clear();assert.equal(other.repriseGuard(destination).writable,true);
 other.deferredCuts.clear();assert.equal(other.repriseGuard(destination).reason,'NOT_OWN_DEFERRED_CUT');
});
test('adaptateur : clic unique sur bouton de test, lecture du cut cible',async()=>{
 const f=page(),from=(await f.call('state')).identity,to=target(from);let clicks=0;
 f.nodes.set('AssumedPrevious',{click(){clicks++;f.nodes.get('O2N3DCutDescription').textContent='Cut 99 of part 23';}});
 const result=await f.call('previousWithoutDecision',from,to,options,'return-1');
 assert.equal(result.targetReached,true);assert.equal(result.reconcileRequired,false);
 assert.equal(result.serverConfirmed,false);assert.equal(clicks,1);assert.equal(f.keyboard.length,0);
 const duplicate=await f.call('previousWithoutDecision',from,to,options,'return-1');
 assert.equal(duplicate.refusal.code,'OPERATION_ALREADY_INVOKED');assert.equal(clicks,1);
});
test('adaptateur : bouton inconnu et VALIDATE fourni comme précédent sont refusés',async()=>{
 const f=page(),from=(await f.call('state')).identity,to=target(from);
 const noProof=await f.call('previousWithoutDecision',from,to,{part:23,navigation:{previousButtonId:'AssumedPrevious'}},'no-proof');
 assert.equal(noProof.refusal.code,'UNVERIFIED_DOM_PATH');
 const forbidden=await f.call('previousWithoutDecision',from,to,{part:23,navigation:{...options.navigation,previousButtonId:'O2N3DCutValidate3DRail'}},'forbidden');
 assert.equal(forbidden.refusal.code,'UNVERIFIED_DOM_PATH');assert.equal(forbidden.commandInvoked,false);
 assert.equal(f.nodes.get('O2N3DCutDescription').textContent,'Cut 100 of part 23');
 for(const state of ['absent','disabled']){
  if(state==='disabled')f.nodes.set('AssumedPrevious',{disabled:true,click(){throw Error('interdit');}});
  assert.equal((await f.call('previousWithoutDecision',from,to,options,state)).refusal.code,'NAVIGATION_COMMAND_UNAVAILABLE');
 }
});
test('adaptateur : cut atteint inattendu et repère cible divergent sont incertains',async()=>{
 const f=page(),from=(await f.call('state')).identity,to=target(from);
 f.nodes.set('AssumedPrevious',{click(){f.nodes.get('O2N3DCutDescription').textContent='Cut 98 of part 23';}});
 const wrong=await f.call('previousWithoutDecision',from,to,options,'wrong');
 assert.equal(wrong.refusal.code,'UNEXPECTED_NAVIGATION_TARGET');assert.equal(wrong.reconcileRequired,true);
 const g=page(),source=(await g.call('state')).identity,otherFrame={...target(source),frameId:'other-frame'};
 g.nodes.set('AssumedPrevious',{click(){g.nodes.get('O2N3DCutDescription').textContent='Cut 99 of part 23';}});
 const frame=await g.call('previousWithoutDecision',source,otherFrame,options,'frame');
 assert.equal(frame.commandInvoked,true);assert.equal(frame.refusal.code,'UNEXPECTED_NAVIGATION_IDENTITY');
 assert.equal(frame.reconcileRequired,true);
});
test('adaptateur : absence de changement et cible invalide n’entraînent aucun rejeu',async()=>{
 const f=page(),from=(await f.call('state')).identity;let clicks=0;
 f.nodes.set('AssumedPrevious',{click(){clicks++;}});
 const invalid=await f.call('previousWithoutDecision',from,{...from,cut:101},options,'invalid');
 assert.equal(invalid.refusal.code,'INVALID_NAVIGATION_TARGET');assert.equal(clicks,0);
 const uncertain=await f.call('previousWithoutDecision',from,target(from),options,'unchanged');
 assert.equal(uncertain.refusal.code,'NO_NAVIGATION_OBSERVED');assert.equal(uncertain.reconcileRequired,true);
 assert.equal(clicks,1);
});
test('adaptateur : cut validé ou statut inconnu restent en lecture seule',async()=>{
 const f=page(),identity=(await f.call('state')).identity;
 const node={value:'valid',getAttribute(){return this.value;}};f.nodes.set('AssumedValidation',node);
 const control={id:'AssumedValidation',attribute:'data-state',validatedValue:'valid',unvalidatedValue:'invalid'};
 assert.equal((await f.call('repriseGuard',identity,[identity],control)).reason,'ALREADY_VALIDATED');
 node.value='invalid';assert.equal((await f.call('repriseGuard',identity,[identity],control)).writable,true);
 assert.equal((await f.call('repriseGuard',identity,[],control)).reason,'NOT_OWN_DEFERRED_CUT');
 assert.equal((await f.call('repriseGuard',identity,[identity],null)).reason,'VALIDATION_STATE_UNKNOWN');
 assert.equal((await f.call('repriseGuard',identity,[identity],control,true)).reason,'RECONCILE_REQUIRED');
 assert.equal((await f.call('repriseGuard',identity,[{...identity,frameId:'old-frame'}],control)).reason,'FRAME_CHANGED_RECAPTURE_REQUIRED');
});
