'use strict';
/* 4.8.0 — revue de code approfondie (ead1cd1..83e2ebe), reprise après un
 * rafraîchissement d'ESV : appuis en attente promus, cut du lot introuvable,
 * silence passager qui n'est pas un rechargement. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';

test('rattachement : l\'appui en attente du dernier cut validé est promu puis translaté',async()=>{
  const r=await pilote(L,{start:100,end:103,settings:reglages(),esv:esvLent});await attendreFin(r);
  const reb=r.b.store.events.find(e=>e.type==='batch-rebased-after-reload');assert.ok(reb);
  const v=await r.b.api('view'),appuis=(v.batch.lotObservation?.anchors||[]).filter(a=>a.identity.frameId==='repere-apres-F5').map(a=>a.identity.cut);
  assert.ok(appuis.includes(100)&&appuis.includes(101),`100 et 101 (validés avant la pause) servent d'appuis dans le nouveau repère : ${appuis}`);
});
