'use strict';
/* Pannes simulées d'ESV, avec le vrai adaptateur : ce qu'Ariane fait quand ESV refuse une écriture, quand le
 * nuage ne se stabilise jamais, quand les rails n'arrivent pas, quand le nuage est vide.
 *   node --test --test-timeout=90000 tests/esv-maquette/pannes.test.cjs */
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
let env=null;
before(async()=>{if(!raison){env=await N.ouvrir({maquette:{cuts:8,latence:20}});
  env.serveur.pannes({ecritureRefusee:{cuts:[100],http:500},railsAbsents:{cuts:[102]},nuageInstable:{cuts:[101],dureeMs:4000},nuageVide:{cuts:[103]}});
  await env.page.reload();await env.page.evaluate(()=>window.__maquette.pret);await env.page.waitForFunction(()=>window.__maquette.etat().railsPrets);await env.injecter();}});
after(async()=>{if(env)await env.fermer();});
test('écriture refusée (HTTP 500) : ESV navigue quand même, la ligne reprend son statut, Ariane ne voit pas le refus (4.8.6)',opts,async()=>{
  const s=(await env.appel('state')).result;assert.equal(s.identity.cut,100);
  const r=await env.appel('validateAndNext',[s.identity,{part:23,end:107}]);assert.equal(r.error,undefined,r.error);
  assert.equal(r.result.navigationObserved,true,'navigation observée malgré le refus');assert.equal(r.result.serverConfirmed,false);
  await env.page.waitForFunction(()=>window.__maquette.journal.some(e=>e.type==='ecriture-refusee'));
  assert.equal(env.serveur.journal.refus.length,1);assert.equal(env.serveur.journal.ecritures.length,0,'rien d’écrit');
  const e=await env.etat();assert.equal(e.statuts[0],'i','le cut 100 est resté invalide côté liste');
});
test('nuage instable 4 s : Ariane attend la stabilité du niveau de détail avant de lire (pas de lecture d’un nuage qui change)',opts,async()=>{
  const s=(await env.appel('state')).result;assert.equal(s.identity.cut,101);
  const r=await env.appel('capture',[s]);assert.equal(r.error,undefined,r.error);
  const gauche=r.result.readStrategy.attempts.find(a=>a.side==='left'&&a.status==='captured');
  assert.ok(gauche&&gauche.durationMs>=4000,'lecture gauche attendue après la fin de l’instabilité : '+JSON.stringify(r.result.readStrategy.attempts));
  const remplacements=await env.page.evaluate(()=>window.__maquette.journal.filter(e=>e.type==='panne'&&e.panne==='nuageInstable').length);assert.ok(remplacements>=10,'nœuds remplacés pendant 4 s : '+remplacements);
  assert.equal(r.result.pointsSceneRelative.length>0,true);
});
test('rails absents : la navigation observe le libellé mais pas les rails (nextReady = false)',opts,async()=>{
  const s=(await env.appel('state')).result;assert.equal(s.identity.cut,101);
  const r=await env.appel('nextWithoutDecision',[s.identity,{part:23},'op-pannes-1']);assert.equal(r.error,undefined,r.error);
  assert.equal(r.result.navigationObserved,true);assert.equal(r.result.nextIdentity.cut,102);assert.equal(r.result.nextReady,false);
  assert.match(r.result.nextIdentityUnavailableReason||'',/rails ne sont pas encore disponibles/);
});
test('nuage vide : capture sans point (statut no-points), pas d’erreur de page',opts,async()=>{
  await env.page.evaluate(()=>window.__maquette.allerA(103));await env.page.waitForFunction(()=>window.__maquette.etat().cut===103&&window.__maquette.etat().railsPrets);
  const s=(await env.appel('state')).result;const r=await env.appel('capture',[s]);
  assert.ok(r.error&&/instable|aucun point|no-points|Niveau de détail/i.test(r.error)||r.result?.status==='no-points','capture vide : '+(r.error||r.result?.status));
  assert.deepEqual(env.erreurs.filter(e=>!/status of 500/.test(e)),[],'seule la ressource refusée (500) est signalée par le navigateur');
});
