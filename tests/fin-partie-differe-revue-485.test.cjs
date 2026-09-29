'use strict';
/* D3 (4.8.5, KI-067) — revues dédiées du 29/09 : ce qui n'est PAS un départ
 * d'ESV, ce qui n'est PAS une preuve de fin, et une clôture propre. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {L,pilote,differe,quitte,navs,dernierDiffere,panneau,vueLot}=require('./helpers/fin-partie.cjs');
const {releve}=require('./helpers/fin-partie.cjs');
/* Revue dédiée de D3 (29/09). */
test('revue : erreur AVANT l’envoi (onglet fermé, autre partie ouverte à la main) : pas un départ, aucune fin affirmée',async()=>{
  const avant=esv=>{esv.nextWithoutDecision=async function(){this.calls.push('nextWithoutDecision');throw Error('Could not establish connection. Receiving end does not exist.');};};
  const r=await pilote(differe,{start:100,end:0,endMode:'partie',esv:avant});const view=await r.b.settle();
  assert.doesNotMatch(view.notice||'',/fin de partie probable/);assert.equal(view.batch.departApresDiffere,undefined);
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  await assert.rejects(r.b.api('resume'));assert.equal(await r.b.api('bornes-partie',{part:23}),null);
});
test('revue : ESV annonce une autre partie sans quitter la page : même preuve, même clôture',async()=>{
  const annonce=(esv,b)=>{const c=esv.capture.bind(esv);esv.capture=async(...a)=>{const out=await c(...a);await releve(b,{...esv.identity},{total:101,at:'2020-01-01T00:00:00.000Z'});return out;};
    const n=esv.nextWithoutDecision.bind(esv);esv.nextWithoutDecision=async(...a)=>{Object.assign(esv.identity,{part:24,cut:1});const e=await n(...a);
    return {...e,navigationObserved:true,nextIdentity:{...esv.identity},navigationAfter:{identity:{...esv.identity}}};};};
  const r=await pilote(differe,{start:100,end:0,endMode:'partie',esv:annonce});const view=await r.b.settle();
  assert.equal(view.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');assert.match(view.notice,/fin de partie probable/);
  const fin=await r.b.api('resume');assert.equal(fin.batch.state,'STOPPED');assert.equal((await r.b.api('bornes-partie',{part:23})).last,100);
});
test('revue : clôture propre (erreur effacée, interruption nommée) et fin connue plus loin jamais abaissée',async()=>{
  const {r}=await dernierDiffere({},{total:101});
  await r.b.fonction('retenirFinPartie')(23,9100,'fin constatée');
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  const view=await r.b.api('resume');
  assert.equal(view.batch.error,null,'plus d’erreur de navigation sur un lot clos proprement');
  assert.equal(view.batch.interrupted.at(-1).status,'DEFER_NAVIGATION_CLOSED_END_OF_PART');
  assert.equal((await r.b.api('bornes-partie',{part:23})).last,9100,'une fin plus loin, déjà connue, reste');
  const {$}=await panneau(view);assert.match($('batch').textContent,/lot clos après le cut 100 : ESV a quitté la partie après le différé/);
  assert.doesNotMatch($('batch').textContent,/Navigation sans décision transmise/);
});
test('revue : marque d’une autre intention (résultat clôturé, nouveau différé) : pas de « fin de partie probable »',async()=>{
  const {$}=await panneau(vueLot({departApresDiffere:{part:15,cut:9000,operationId:'op-ancienne',at:'t'}}));
  assert.equal($('resume').hidden,true);assert.doesNotMatch($('notice').textContent,/fin de partie probable/);
});
test('revue : ESV indisponible (page quittée) : la marche à suivre reste affichée, Reprendre en premier',async()=>{
  const {$}=await panneau(vueLot({departApresDiffere:{part:15,cut:9056,operationId:'op-9056',total:9057,dernier:true,at:'t'}},{connection:{status:'unavailable',message:'Adaptateur ESV sans réponse : page ESV rechargée ou fermée.'}}));
  assert.match($('notice').textContent,/fin de partie probable/);assert.equal($('resume').hidden,false);
});
test('revue : un résultat incertain d’une pose reste à clôturer à la main : pas de clôture automatique',async()=>{
  const {r}=await dernierDiffere();r.b.fonction('engine').s.reconcileRequired=true;
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  await assert.rejects(r.b.api('resume'),/résultat incertain/);assert.equal(await r.b.api('bornes-partie',{part:23}),null);
});
test('revue 2 : partie ANTÉRIEURE affichée à la reprise (ouverte à la main) : pas de preuve, lot fermé, rien retenu (D-062 b)',async()=>{
  const {r}=await dernierDiffere({},{total:101});
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:22,cut:5});
  const v=await r.b.api('resume');assert.match(v.notice,/partie 22, antérieure au lot[^]*pourrait être le dernier/);
  assert.equal(v.batch.state,'STOPPED');assert.equal(await r.b.api('bornes-partie',{part:23}),null);
});
test('revue 2 : canal fermé sans départ de page (« message port closed ») : pas de fin de partie probable',async()=>{
  const port=esv=>{esv.nextWithoutDecision=async function(){this.calls.push('nextWithoutDecision');throw Error('The message port closed before a response was received.');};};
  const r=await pilote(differe,{start:100,end:0,endMode:'partie',esv:port});const view=await r.b.settle();
  assert.equal(view.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');assert.equal(view.batch.departApresDiffere,undefined);
});
test('revue 2 : action encore en cours, ou intention de pose ouverte : pas de clôture',async()=>{
  const {r}=await dernierDiffere();const e=r.b.fonction('engine');
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  e.task=Promise.resolve();await assert.rejects(r.b.api('resume'),/Attends la fin de l’action en cours/);e.task=null;
  e.s.intent={identity:{part:23,cut:100}};await assert.rejects(r.b.api('resume'),/résultat incertain/);
  assert.equal(await r.b.api('bornes-partie',{part:23}),null);
});
