'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const COUPE='Could not establish connection. Receiving end does not exist.';
const finMoteur=async r=>{let v;for(let i=0;i<400&&(v=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));return v;};
/* 4.8.0 — sixième revue : silence d'ESV au milieu du dernier cut (déjà commencé) : pas de clôture. */
test('dernier cut repris après F5, puis ESV muet pendant sa lecture : pause « sans réponse », pas de lot clos',async()=>{
  const r=await pilote(espion,{start:100,end:102,settings:reglages(),esv:esvLent});
  let view=await r.b.settle();assert.equal(view.batch.state,'PAUSED');
  r.b.adapter.onReload();const cap=r.b.adapter.capture.bind(r.b.adapter),st=r.b.adapter.state.bind(r.b.adapter);let muet=false;
  r.b.adapter.capture=async(...a)=>{muet=true;return cap(...a);};r.b.adapter.state=async(...a)=>{if(muet)throw Error(MUET);return st(...a);};
  await r.b.api('resume');await r.b.settle();view=await finMoteur(r);
  assert.equal(view.batch.state,'PAUSED_ADAPTER_UNRESPONSIVE');assert.equal(view.batch.stoppedAtEnd??null,null);
});
