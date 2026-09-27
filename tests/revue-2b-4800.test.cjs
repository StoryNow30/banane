'use strict';
/* 4.8.0 — seconde revue de code : un silence d'ESV pendant le dernier cut du
 * lot n'est pas une sortie de lot. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';

test('silence pendant le dernier cut (pas juste après la navigation) : le lot n\'est pas clos à tort',async()=>{
  const r=await pilote(L,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esv=>{const c=esv.capture.bind(esv),st=esv.state.bind(esv);let muet=0;
    esv.capture=async(...a)=>{const x=await c(...a);if(esv.identity.cut===103&&!esv.fait){esv.fait=true;muet=3;}return x;};
    esv.state=async(...a)=>{if(muet>0){muet--;throw Error(MUET);}return st(...a);};}});
  const view=await attendreFin(r);
  assert.equal(r.b.store.events.some(e=>e.type==='batch-stopped-at-end'&&e.reason==='adapter-lost-after-navigation'),false);
  assert.equal(view.batch.stoppedAtEnd?.cut,103);assert.equal(view.batch.stoppedAtEnd?.reason??null,null,'arrêt normal au dernier cut');
});
