'use strict';
/* 4.7.21 — bornes du lot remplies par Banane. ESV n'affiche pas le dernier cut
 * d'une partie : un lot « jusqu'à la fin de la partie » avance jusqu'à ce
 * qu'ESV quitte la partie, puis se clôt seul ; le service worker retient, par
 * partie, la fin saisie ou la fin constatée, que le panneau propose ensuite. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),S=require('../src/settings.js');
const {pilote}=require('./helpers/pilote-lot.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const rapide={...S,lot:{...S.lot,stateRetryMs:1}};

test('« fin de partie » : borne 999999 figée dans le scope ; ESV change de partie, lot clos, fin constatée retenue',async()=>{
  const r=await pilote(L,{start:100,end:0,endMode:'partie',settings:rapide,esv:esv=>{const v=esv.validateAndNext.bind(esv);let n=0;
    esv.validateAndNext=async(...a)=>{const e=await v(...a);if(++n===2){esv.identity.part=24;esv.identity.cut=0;e.nextIdentity={...esv.identity};}return e;};}});
  const view=await r.b.settle();
  assert.equal(view.batch.scope.endMode,'partie');assert.equal(view.batch.scope.end,999999);
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd.reason,'navigation-other-part');assert.equal(view.batch.stoppedAtEnd.cut,101);
  const f=await r.b.api('bornes-partie',{part:23});
  assert.equal(f.last,101);assert.equal(f.source,'fin constatée');
});

test('« fin de partie » : ESV muet après une validation, lot clos (sortie de partie probable), pas en panne',async()=>{
  const r=await pilote(L,{start:100,end:0,endMode:'partie',settings:rapide,esv:esv=>{const v=esv.validateAndNext.bind(esv),st=esv.state.bind(esv);let muet=false;
    esv.validateAndNext=async(...a)=>{const e=await v(...a);muet=true;return e;};
    esv.state=async(...a)=>{if(muet)throw Error(MUET);return st(...a);};}});
  const view=await r.b.settle();
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd.reason,'adapter-lost-after-navigation');
  assert.equal((await r.b.api('bornes-partie',{part:23})).source,'fin constatée');
});

test('fin saisie : retenue pour la partie ; une autre partie reste inconnue',async()=>{
  const r=await pilote(L,{start:100,end:101});await r.b.settle();
  const f=await r.b.api('bornes-partie',{part:23});assert.equal(f.last,101);assert.equal(f.source,'saisie');
  assert.equal(await r.b.api('bornes-partie',{part:24}),null);
});
