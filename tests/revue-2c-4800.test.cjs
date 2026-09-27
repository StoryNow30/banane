'use strict';
/* 4.8.0 — seconde revue de code (83e2ebe..82e6e66) : « Pause » pendant
 * l'attente d'un ESV muet. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';

test('« Pause » pendant l\'attente d\'un ESV muet : le lot reste reprenable',async()=>{
  let r;r=await pilote(L,{start:100,end:103,settings:reglages(),esv:esv=>{const v=esv.validateAndNext.bind(esv),st=esv.state.bind(esv);let muet=false,n=0;
    esv.validateAndNext=async(...a)=>{const e=await v(...a);if(!n)muet=true;return e;};
    esv.state=async(...a)=>{if(muet){n++;if(n===2)await r.b.api('pause');if(n<4)throw Error(MUET);muet=false;}return st(...a);};}});
  let view=await r.b.settle();
  /* Le moteur finit son attente (ESV répond à la 4e lecture), puis s'arrête en pause. */
  for(let i=0;i<200&&(view=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));
  assert.equal(view.batch.state,'PAUSED','pas « adaptateur sans réponse »');
  await r.b.api('resume');view=await attendreFin(r);assert.equal(view.batch.stoppedAtEnd?.cut,103);
});
