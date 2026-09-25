'use strict';
/* 4.7.20 (KI-061) — fin de partie après une validation : dans un reliquat, la
 * validation du dernier cut non validé fait charger par ESV la suite, au besoin
 * dans la partie suivante (terrain du 25/09, partie 6 : 7634 → 8131, puis ESV
 * muet). Et une reprise lancée après un rechargement d'ESV (autre repère) est
 * refusée en clair. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),S=require('../src/settings.js');
const {pilote}=require('./helpers/pilote-lot.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
/* Réglages du service worker avec des nouvelles lectures immédiates. */
const rapide={...S,lot:{...S.lot,stateRetryMs:1}};

test('validation suivie d’un changement de partie : lot clos, rien hors du lot',async()=>{
  const r=await pilote(L,{start:100,end:105,settings:rapide,esv:esv=>{const v=esv.validateAndNext.bind(esv);
    esv.validateAndNext=async(...a)=>{const e=await v(...a);esv.identity.part=24;esv.identity.cut=0;e.nextIdentity={...esv.identity};return e;};}});
  const view=await r.b.settle();
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd.reason,'navigation-other-part');
  assert.equal(view.batch.stoppedAtEnd.cut,100);assert.deepEqual(view.batch.stoppedAtEnd.target,{part:24,cut:0});
  assert.equal(r.b.adapter.calls.filter(c=>c==='capture').length,1,'aucune capture dans la partie suivante');
  assert.match(view.notice,/hors du lot/);
});

test('ESV muet après la navigation vers la fin du lot : lot clos, pas en panne',async()=>{
  const r=await pilote(L,{start:100,end:105,settings:rapide,esv:esv=>{const v=esv.validateAndNext.bind(esv),st=esv.state.bind(esv);let muet=false;
    esv.validateAndNext=async(...a)=>{const e=await v(...a);esv.identity.cut=105;e.nextIdentity={...esv.identity};muet=true;return e;};
    esv.state=async(...a)=>{if(muet)throw Error(MUET);return st(...a);};}});
  const view=await r.b.settle();
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd.reason,'adapter-lost-after-navigation');
  assert.deepEqual(view.batch.stoppedAtEnd.target,{part:23,cut:105});assert.match(view.notice,/ne répond plus/);
  assert.ok(r.b.store.events.some(e=>e.type==='batch-stopped-at-end'&&e.reason==='adapter-lost-after-navigation'));
});
