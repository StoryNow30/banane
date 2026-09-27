'use strict';
/* 4.8.0 — cinquième revue de code : une lecture sur un lot déjà en pause
 * n'attend pas ESV et ne le clôt pas ; le cut de fin atteint après un différé
 * est reconnu. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const finMoteur=async r=>{let v;for(let i=0;i<400&&(v=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));return v;};

test('lot en pause sur le cut de fin, ESV muet : les lectures du panneau ne le closent pas',async()=>{
  const r=await pilote(espion,{start:100,end:102,settings:reglages(),esv:esv=>{esvLent(esv);}});
  let view=await r.b.settle();assert.equal(view.batch.state,'PAUSED');
  r.b.adapter.state=async()=>{throw Error(MUET);};
  for(let i=0;i<5;i++)view=await r.b.api('view');await new Promise(x=>setTimeout(x,30));view=await r.b.api('view');
  assert.equal(view.batch.state,'PAUSED','toujours en pause, reprenable');assert.equal(view.batch.stoppedAtEnd??null,null);
});

test('cut de fin atteint par un différé, ESV muet dessus : lot clos proprement',async()=>{
  const r=await pilote(espion,{start:100,end:102,settings:reglages(),esv:esv=>{const n=esv.nextWithoutDecision.bind(esv),st=esv.state.bind(esv);let muet=false;
    esv.nextWithoutDecision=async(...a)=>{const e=await n(...a);muet=true;return e;};esv.state=async(...a)=>{if(muet&&esv.identity.cut===102)throw Error(MUET);return st(...a);};}});
  await r.b.settle();const view=await finMoteur(r);
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd?.issue,'fin-sans-pose');assert.equal(view.batch.stoppedAtEnd?.cut,102);
});
