'use strict';
/* CHANTIER 5 — la décision sur le lot dans le service worker : ce que le Pilote
 * passe à la décision (aucune option, D-050), le repli sur erreur après retrait
 * par une garde (KI-053, `background.js`), et le dernier garde d'écartement du
 * moteur, toujours actif sur une paire commandée par la décision (§7.2, §14 E).
 * `background.js` réel dans un contexte vm, ESV simulé (`helpers/pilote-lot.cjs`). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),K=require('../src/core.js'),{base}=require('./fixtures.cjs');
const {lot,SIDES}=require('./helpers/pilote-lot.cjs');

test('le Pilote ne passe aucune option : appel réel de la décision dans le service worker, règles 4.7.16 consignées',async()=>{
  const calls=[],spy={...L,decideCut(args){calls.push({keys:Object.keys(args).sort(),options:args.options,capture:Object.keys(args.capture).sort()});return L.decideCut(args);}};
  const {observed,view}=await lot(spy);
  assert.ok(calls.length>=2,`${calls.length} décisions`);assert.ok(!view.batch.error,JSON.stringify(view.batch.error));
  for(const c of calls){
    assert.deepEqual(c.keys,['Shadow','anchors','capture','science'],'aucune option passée à decideCut');assert.equal(c.options,undefined);
    assert.deepEqual(c.capture,['identity','pointsSceneRelative','rails','visibleByClipBoxes']);}
  for(const o of observed)assert.deepEqual([o.version,o.pairGuard,o.chainMm,o.gaugeGuardMm,o.minTop],
    [L.DEFAULTS.version,true,15,20,5],'la décision consigne les réglages par défaut de la 4.7.16');
  assert.equal(L.DEFAULTS.gaugeTargetStudy,false);assert.equal(L.DEFAULTS.gaugeChoice,false);
});

/* `background.js` (catch de `commandLot`) : sur une erreur, une paire retirée par
 * une garde est différée ; sans retrait, la proposition du moteur reste la seule,
 * comme en 4.7.9. */
test('KI-053 : une erreur pendant la commande d\'une paire retirée par la garde diffère le cut ; la paire du moteur n\'est jamais appliquée',async()=>{
  const panne=()=>{throw Error('panne de commande');};
  const retiree={...L,decideCut:()=>({version:'lot-decision-v4',stage:'window',guardDeferred:true,guardMm:156.2,fromPredictionMm:3,anchorsUsed:[99,98],anchor:false,
    positions:Object.fromEntries(SIDES.map(s=>[s,base.rails[s].positionSceneRelative]))}),commandRails:panne};
  /* 4.7.19 : le dernier cut du lot n'est ni validé ni différé (arrêt au dernier cut) ; le cut testé n'est donc pas le dernier. */
  const r=await lot(retiree,{end:101});
  assert.equal(r.applied.length,0,'aucune paire appliquée');
  assert.ok(r.observed.length>=1);
  for(const o of r.observed){assert.deepEqual(o.command,{action:'defer',reason:'guard-error: panne de commande'});assert.equal(o.applied,false);}
  assert.deepEqual(r.view.batch.deferred.map(d=>d.identity?.cut??d.cut),[100],'cut différé');
  for(const call of ['validate','skip'])assert.equal(r.b.adapter.calls.includes(call),false,call);
  /* Témoin : même erreur sans retrait par une garde → proposition du moteur, appliquée. */
  const sans={...retiree,decideCut:()=>({version:'lot-decision-v4',stage:'first-pass',guardMm:2,anchorsUsed:[],anchor:true,
    positions:Object.fromEntries(SIDES.map(s=>[s,base.rails[s].positionSceneRelative]))})};
  const t=await lot(sans,{end:100});
  assert.equal(t.applied.length,1);assert.match(t.observed[0].command.reason,/^error: panne de commande/);
});

test('§14 E : une paire commandée par la décision sur le lot reste soumise au dernier garde d\'écartement du moteur',async()=>{
  /* Premier étage contourné exprès : la « décision » rend la pose ESV de départ
   * (1 500 mm, hors contrat) comme positions commandées. */
  const horsContrat={...L,decideCut:()=>({version:'lot-decision-v4',stage:'window',fromPredictionMm:3,anchorsUsed:[99,98],anchor:false,
      positions:Object.fromEntries(SIDES.map(s=>[s,base.rails[s].positionSceneRelative]))}),
    commandRails:({runtimeRails})=>({action:'lot',reason:'window',rails:Object.fromEntries(SIDES.map(s=>[s,{...runtimeRails[s],status:'candidate',delta:[0,0,0],confidence:0,source:'lot-decision-window'}]))})};
  const r=await lot(horsContrat,{end:100});
  const gauge=K.C.distance(base.rails.left.positionSceneRelative,base.rails.right.positionSceneRelative)*1000;
  assert.ok(gauge>1470,`paire de départ à ${gauge.toFixed(1)} mm`);
  assert.equal(r.applied.length,0,'le dernier garde refuse avant tout clic');
  for(const call of ['validate','skip','nextWithoutDecision'])assert.equal(r.b.adapter.calls.includes(call),false,call);
  assert.ok(r.b.store.events.some(e=>e.type==='gauge-contract-violation'),'violation consignée par le moteur');
  assert.equal(r.view.batch.processed.length,0);
});
