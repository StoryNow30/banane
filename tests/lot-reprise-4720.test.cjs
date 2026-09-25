'use strict';
/* 4.7.20 — ESV occupé un instant (KI-061 : nouvelle lecture avant de conclure),
 * et reprise lancée après un rechargement d'ESV (autre repère) refusée en clair.
 * Suite de `lot-fin-4720.test.cjs`, séparée pour tenir en 10 s. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),S=require('../src/settings.js');
const {pilote}=require('./helpers/pilote-lot.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
/* Réglages du service worker avec des nouvelles lectures immédiates. */
const rapide={...S,lot:{...S.lot,stateRetryMs:1}};

test('ESV occupé un instant : nouvelle lecture, le lot continue',async()=>{
  const r=await pilote(L,{start:100,end:102,settings:rapide,esv:esv=>{const st=esv.state.bind(esv);let n=0;
    // La 1re lecture du cut 101 est celle de la navigation simulée ; la 2e, celle du lot.
    esv.state=async(...a)=>{if(esv.identity.cut===101&&++n===2)throw Error(MUET);return st(...a);};}});
  const view=await r.b.settle();
  assert.equal(view.batch.stoppedAtEnd?.cut,102,'arrêt normal au dernier cut');
  assert.ok(r.b.store.events.some(e=>e.type==='adapter-state-retry'&&e.ok===true));
});

test('reprise refusée après un rechargement d’ESV (autre repère)',async()=>{
  const spy={...L,decideCut(args){if(args.capture.identity.cut===101)return {version:L.DEFAULTS.version,stage:'deferred',reason:'guard',guardDeferred:true,guardMm:40,anchorsUsed:[100]};return L.decideCut(args);}};
  const r=await pilote(spy,{start:100,end:103});await r.b.settle();
  r.b.adapter.identity.cut=101;r.b.adapter.identity.frameId='frame-apres-rechargement';
  await assert.rejects(()=>r.b.api('start',{part:23,start:101,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',
    geometryEngine:'geometry-candidate-v1',unresolvedPolicy:'defer',lotDecision:'apply',lotReprise:true}),/rechargée depuis le lot précédent/);
});
