'use strict';
/* D-062, P2 (version de test 2) — REPRISE COMPLÈTE après une intrusion :
 * intrusion pendant un lot → pause → F5 → réinstallation → retour au cut du
 * lot → reprise, jusqu'à la fin du lot. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs');
const {pilote,espion,esvLent,reglages,attendreFin}=require('./helpers/esv-lent.cjs');

test('reprise complète : intrusion pendant un lot → pause → F5 → réinstallation → retour au cut → reprise jusqu’à la fin',async()=>{
  /* Le refus exact de l'adaptateur réel en sécurité, sur une lecture de cut. */
  const p=page();await p.raw('next',[],{proprietaire:'autre'}).promise.catch(()=>{});
  const refus=await p.call('capture',{identity:{part:23,cut:102}}).then(()=>null,e=>e.message);
  assert.match(refus,/^Adaptateur ESV sans réponse : Ariane 4\.8\.6 test 2 en sécurité[^]*F5 sur ESV, puis Reprendre/);
  let enSecurite=false;
  const r=await pilote(espion,{start:101,end:103,settings:reglages(),esv:esv=>{esv.identity.cut=101;esvLent(esv,{lecturesInstables:false});
    const capture=esv.capture.bind(esv),reload=esv.onReload;
    esv.capture=async(...a)=>{if(esv.identity.cut===102&&!esv.recharges)enSecurite=true;if(enSecurite)throw Error(refus);return capture(...a);};
    /* F5 : nouvelle page, adaptateur neuf, plus en sécurité. */
    esv.onReload=()=>{enSecurite=false;reload();};}});
  let view=await r.b.settle();
  assert.ok(['PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(view.batch.state),'pause reprenable, pas ERROR : '+view.batch.state);
  assert.ok(!view.reconcileRequired,'rien d’incertain : aucune pose en cours');
  assert.match(view.notice,/en sécurité/);
  const valides=r.b.adapter.calls.filter(c=>c==='validate').length;
  r.b.adapter.onReload();
  await r.b.api('resume');view=await attendreFin(r);
  assert.ok(r.b.store.events.some(e=>e.type==='batch-rebased-after-reload'),'lot rattaché à la nouvelle page');
  assert.equal(view.batch.stoppedAtEnd?.cut,103,'le lot va jusqu’à sa fin');
  assert.ok(view.batch.processed.some(x=>(x.cut??x.identity?.cut)===102),'le cut interrompu est repris et traité');
  /* 102 validé ; 103, dernier cut du lot, posé sans validation (arrêt au dernier cut, 4.7.19). */
  assert.equal(r.b.adapter.calls.filter(c=>c==='validate').length-valides,1,'seul 102 validé après la reprise');
  assert.equal(view.batch.stoppedAtEnd?.applied,true,'103 posé, non validé');
});
