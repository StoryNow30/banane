'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const COUPE='Could not establish connection. Receiving end does not exist.';
const finMoteur=async r=>{let v;for(let i=0;i<400&&(v=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));return v;};
/* 4.8.0 — sixième revue : un lot clos puis relancé n'affiche plus sa fin d'avant. */
test('cut de fin muet (lot clos), F5 et « Reprendre » : le lot finit, sa fin précédente est effacée',async()=>{
  const r=await pilote(espion,{start:100,end:102,settings:reglages(),esv:esv=>{esvLent(esv,{lecturesInstables:false});const n=esv.nextWithoutDecision.bind(esv),st=esv.state.bind(esv);let muet=false;
    esv.nextWithoutDecision=async(...a)=>{const e=await n(...a);muet=true;return e;};esv.state=async(...a)=>{if(muet&&!esv.recharges&&esv.identity.cut===102)throw Error(MUET);return st(...a);};}});
  await r.b.settle();let view=await finMoteur(r);assert.equal(view.batch.stoppedAtEnd?.issue,'fin-sans-pose');
  r.b.adapter.onReload();r.b.adapter.identity.cut=102;await r.b.api('resume');view=await attendreFin(r);
  assert.equal(view.batch.stoppedAtEnd?.cut,102);assert.equal(view.batch.stoppedAtEnd?.issue,undefined,'fin normale, plus « fin sans pose »');
});
