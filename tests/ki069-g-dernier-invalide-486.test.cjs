'use strict';
/* KI-069 (4.8.6), retour terrain du 30/09 (partie 37, M = 8640) : 8504 était le
 * DERNIER CUT INVALIDE (aucun cut à valider devant lui), pas M−1 : Ariane l'a
 * différé, et ESV a quitté la partie. Le compteur « N on M treated » le dit :
 * restants = M − traités ; devant = restants − (cuts déjà différés par ce lot) − 1.
 * Devant = 0 → dernier cut à valider : Ctrl+Entrée, ou rien envoyé si différé, puis arrêt. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {dernierCut,differe,L,appels,navigations}=require('./helpers/dernier-cut.cjs');
const cpt=(traites,total=8640)=>i=>({identity:i,compteur:{traites,total}});
const unCut=o=>({options:{start:100,end:105,endMode:null,...o}});

test('dernier invalide (1 restant = le cut courant), pas M−1 : Ctrl+Entrée, aucun « suivant », lot clos',async()=>{
  const {r,view}=await dernierCut({mesure:cpt(8639),...unCut({end:0,endMode:'partie'})});
  assert.equal(appels(r,'validateInPlace'),1);assert.deepEqual(navigations(r),[]);assert.equal(r.b.adapter.identity.cut,100);
  assert.equal(view.notice,'Fin du lot : dernier cut à valider de la partie (100) validé ; ESV est resté sur ce cut.');
  assert.equal(view.batch.stoppedAtEnd.issue,'dernier-cut-valide');assert.equal(view.batch.stoppedAtEnd.motif,'dernier-invalide');
  const e=r.b.store.events.find(x=>x.type==='validation-en-place');assert.equal(e.motif,'dernier-invalide');assert.equal(e.total,8640);assert.equal(e.cut,100);
});
test('dernier invalide, cut différé : rien envoyé à ESV, lot clos (le cas du 30/09)',async()=>{
  const {r,view}=await dernierCut({decision:differe,mesure:cpt(8639),...unCut({end:0,endMode:'partie'})});
  assert.deepEqual(navigations(r),[]);assert.equal(view.batch.state,'STOPPED');
  assert.equal(view.notice,'Fin du lot : dernier cut à valider de la partie (100), différé ; rien n’a été envoyé à ESV.');
  assert.equal(view.batch.stoppedAtEnd.issue,'dernier-cut-differe');
});
test('deux restants (un cut à valider devant) : comportement actuel',async()=>{
  const {r,view}=await dernierCut({mesure:cpt(8638),...unCut({end:101})});
  assert.equal(appels(r,'validateInPlace'),0);assert.ok(appels(r,'validate')>=1);assert.ok(!/dernier cut/.test(view.notice||''));
});
test('un cut différé plus tôt dans le lot compte : 3 restants, 1 différé → le 3e cut est le dernier invalide',async()=>{
  /* cut 100 différé (3 restants : devant = 2) ; 101 : 3 restants, 1 différé, devant = 1 ; 102 : 2 restants, devant = 0. */
  const par={100:8637,101:8637,102:8638};
  const decision={...L,decideCut:(...a)=>a[0]?.capture?.identity?.cut===100?differe.decideCut(...a):L.decideCut(...a)};
  const {r,view}=await dernierCut({decision,mesure:i=>({identity:i,compteur:{traites:par[i.cut]??8638,total:8640}}),...unCut({end:0,endMode:'partie'})});
  assert.equal(appels(r,'nextWithoutDecision'),1,'le différé de 100 navigue normalement');
  assert.equal(appels(r,'validateInPlace'),1);assert.equal(r.b.adapter.identity.cut,102);assert.equal(appels(r,'validate'),1,'101 validé par le bouton habituel (devant = 1)');
  assert.match(view.notice,/^Fin du lot : dernier cut à valider de la partie \(102\) validé/);
});
/* Garde-fous de la règle, sur la fonction du service worker (lot factice en cours, relevé frais du cut 100). */
async function regle(mod){const {r}=await dernierCut({mesure:cpt(8639),...unCut({end:101})});
  const b=r.b.fonction('engine').s.batch;b.state='RUNNING';b.cutStartedAt='2020-01-01T00:00:00.000Z';
  b.totalReleve={part:23,cut:100,total:8640,totalSource:'compteur',traites:8639,at:new Date().toISOString()};b.skipped=[];b.manuallyCompleted=[];b.deferred=[];
  mod(b);return r.b.fonction('dernierCutCertain')(100);}
test('témoin de la règle : devant = 0 → dernier-invalide',async()=>{assert.equal((await regle(()=>{}))?.motif,'dernier-invalide');});
test('un cut SKIPPÉ dans le lot : détection refusée (son compte est inconnu)',async()=>{assert.equal(await regle(b=>{b.skipped=[{cut:50}];}),null);});
test('un cut repris à la main : détection refusée',async()=>{assert.equal(await regle(b=>{b.manuallyCompleted=[{cut:50}];}),null);});
test('un cut différé situé APRÈS le cut courant : détection refusée (il serait devant)',async()=>{assert.equal(await regle(b=>{b.deferred=[{cut:150}];b.totalReleve.traites=8638;}),null);});
test('un cut différé derrière : compté (8638 traités, 1 différé → devant = 0)',async()=>{assert.equal((await regle(b=>{b.deferred=[{cut:50}];b.totalReleve.traites=8638;}))?.motif,'dernier-invalide');});
test('traités illisibles, ou supérieurs au total : refusé',async()=>{
  assert.equal(await regle(b=>{b.totalReleve.traites=null;}),null);assert.equal(await regle(b=>{b.totalReleve.traites=8640;}),null);});
