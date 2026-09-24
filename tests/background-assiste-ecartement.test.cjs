'use strict';
/* « La ligne », Assisté : la vue porte l'écartement de la proposition affichée,
 * calculé comme le garde du moteur (poses attendues), pour la plage du
 * panneau. Lecture seule ; sans les modules de calcul, rien n'est inventé. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {background,shadowHarness}=require('./helpers/background-harness.cjs');
const K=require('../src/core.js'),G=require('../src/gauge.js');

test('Assisté : écartement de la proposition, classe du contrat, même proposition',async()=>{
  const b=background({shadow:shadowHarness(),globals:{BananeCore3:K,BananeGauge4:G}});await b.api('connect',{tabId:1});
  await b.api('gcv1-shadow-configure',{activeAssisted:true});await b.api('settings',{mode:'assisted'});
  const proposal=await b.api('analyze'),view=await b.api('view'),g=view.assistGauge;
  assert.ok(g,'écartement présent');assert.equal(g.proposalId,proposal.id);
  const attendu=G.gaugeMmOf(K.expectedPoses(view.before,proposal.rails),K.C);
  assert.equal(g.mm,Math.round(attendu*10)/10);assert.equal(g.gaugeClass,G.classifyMm(attendu));assert.equal(g.admissible,G.admissible(g.gaugeClass));
  assert.deepEqual(g.contract,G.CONTRACT);
});
test('sans proposition, ou sans les modules de calcul : pas d\'écartement',async()=>{
  const b=background({shadow:shadowHarness(),globals:{BananeCore3:K,BananeGauge4:G}});await b.api('connect',{tabId:1});
  assert.equal((await b.api('view')).assistGauge,null);
  const c=background({shadow:shadowHarness()});await c.api('connect',{tabId:1});
  await c.api('gcv1-shadow-configure',{activeAssisted:true});await c.api('settings',{mode:'assisted'});await c.api('analyze');
  assert.equal((await c.api('view')).assistGauge,null);
});
