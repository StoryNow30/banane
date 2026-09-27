'use strict';
/* 4.8.0 — revue de code approfondie : attente sur un ESV muet, message de
 * clôture, vocabulaire. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,reglages,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';

test('« Arrêter » pendant l\'attente d\'un ESV muet : l\'attente cesse, aucun « reprend seul »',async()=>{
  let r;r=await pilote(L,{start:100,end:0,endMode:'partie',settings:reglages({rafraichirAuto:false}),esv:esv=>{const v=esv.validateAndNext.bind(esv),st=esv.state.bind(esv);let muet=false,n=0;
    esv.validateAndNext=async(...a)=>{const e=await v(...a);muet=true;return e;};
    esv.state=async(...a)=>{if(muet){if(++n===2)await r.b.api('stop');throw Error(MUET);}return st(...a);};}});
  const view=await r.b.settle();await new Promise(x=>setTimeout(x,30));const fin=await r.b.api('view');
  assert.equal(fin.batch.state,'STOPPED');assert.doesNotMatch(fin.notice||'',/reprend seul|le lot continue/);void view;
});

test('ESV muet sans navigation préalable : attente courte (2 relectures), pas 10',async()=>{
  const r=await pilote(L,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esv=>{const c=esv.capture.bind(esv),st=esv.state.bind(esv);let muet=false,n=0;
    esv.capture=async(...a)=>{muet=true;return c(...a);};esv.state=async(...a)=>{if(muet){n++;esv.lectures=n;throw Error(MUET);}return st(...a);};}});
  await r.b.settle();assert.ok(r.b.adapter.lectures<=4,`${r.b.adapter.lectures} lectures muettes`);
});

test('autre partie ouverte pendant un cut : le message ne dit pas que ce cut a été validé',async()=>{
  const r=await pilote(L,{start:100,end:0,endMode:'partie',settings:reglages({rafraichirAuto:false}),esv:esv=>{const capture=esv.capture.bind(esv);
    esv.capture=async(...a)=>{const c=await capture(...a);if(esv.identity.cut===102){esv.identity.part=24;esv.identity.cut=7;}return c;};}});
  const view=await r.b.settle();assert.match(view.notice,/qu’Ariane n’a pas validé/);assert.doesNotMatch(view.notice,/après la validation du cut 102/);
});

test('vocabulaire : « Banane » devient Ariane, sauf l\'ancienne Banane (V2)',async()=>{
  for(const [message,attendu,interdit] of [['Une ancienne Banane (V2) est active. Désactive-la.',/ancienne Banane \(V2\)/,/Ariane \(V2\)/],['Banane ne répond pas.',/Ariane ne répond pas/,/Banane/]]){
    const r=await pilote(L,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esv=>{esv.capture=async()=>{throw Error(message);};}});
    const view=await r.b.settle();assert.match(view.batch.error.message,attendu);assert.doesNotMatch(view.batch.error.message,interdit);}
});
