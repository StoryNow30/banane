'use strict';
/* 4.8.1 (audit qualité 4.8, P01) : la vue du panneau retire le lourd AVANT de
 * copier l'état, et rend exactement ce que rendait panelView(engine.view()). */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {pilote,espion,esvLent,reglages,attendreFin}=require('./helpers/esv-lent.cjs');
test('vue du panneau : même contenu qu’avant, sans copier les enregistrements',async()=>{
  const r=await pilote(espion,{start:100,end:103,settings:reglages(),esv:esv=>esvLent(esv,{lecturesInstables:false})});await attendreFin(r);
  const ctx=r.b.ctx,run=c=>JSON.parse(vm.runInContext(`JSON.stringify(${c})`,ctx));
  assert.deepEqual(run('vuePanneau()'),run('panelView(engine.view())'));
  /* Ce que la vue du panneau copie : ni les enregistrements, ni lotPosed. */
  const copie=vm.runInContext(`(()=>{const c0=BananeCore3.clone,vus=[];
    BananeCore3.clone=x=>{vus.push(!!x&&('records' in x||'lotPosed' in (x.batch||{})));return c0(x);};
    engine.s.batch.lotPosed=[{identity:{cut:100}}];
    try{const v=vuePanneau();return {vus,recordsCount:v.recordsCount,lotPosedCount:v.batch.lotPosedCount};}finally{BananeCore3.clone=c0;}})()`,ctx);
  assert.deepEqual([...copie.vus],[false],'une seule copie, sans le lourd');
  assert.equal(copie.recordsCount,run('engine.s.records.length'));assert.equal(copie.lotPosedCount,1);
});
