'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const finMoteur=async r=>{let v;for(let i=0;i<400&&(v=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));return v;};
/* 4.8.0 — quatrième revue : « Arrêter » pendant une reprise qui attend ESV ; deux reprises à la fois. */
test('« Arrêter » pendant que « Reprendre » attend la page ESV : le lot n\'est pas relancé',async()=>{
  let r;r=await pilote(L,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esv=>{esvLent(esv);const inj=esv.onInject;let n=0;
    esv.onInject=()=>{if(esv.recharges&&++n===1){void r.b.api('stop');return;}inj();};}});
  let view=await r.b.settle();assert.equal(view.batch.state,'PAUSED');
  const valides=r.b.adapter.calls.filter(c=>c==='validate').length;
  r.b.adapter.onReload();await r.b.api('resume').catch(()=>{});view=await finMoteur(r);
  assert.equal(view.batch.state,'STOPPED');assert.equal(r.b.adapter.calls.filter(c=>c==='validate').length,valides,'aucune validation après l\'arrêt');
});

test('deux « Reprendre » à la fois : le second est refusé en clair',async()=>{
  let r;r=await pilote(L,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esv=>{esvLent(esv);const inj=esv.onInject;let n=0;
    esv.onInject=()=>{if(esv.recharges&&++n===1){esv.second=r.b.api('resume').then(()=>'ok',e=>e.message);return;}inj();};}});
  await r.b.settle();r.b.adapter.onReload();await r.b.api('resume');
  assert.match(await r.b.adapter.second,/Reprise déjà en cours/);await attendreFin(r);
});
