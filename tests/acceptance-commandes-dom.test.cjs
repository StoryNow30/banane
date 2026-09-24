'use strict';
/* CHANTIER 5 — cahier 4.8 §5.5 : boutons DOM conservés, vérifiés AVANT d'agir —
 * présence et `disabled`. La présence est couverte (`adapter.test.cjs`,
 * `gcv1-defer-export.test.cjs`) ; ces essais couvrent l'état désactivé, avec le
 * code réel de l'adaptateur (`src/adapter-page.js`) dans une page simulée. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const K=require('../src/core.js'),{page}=require('./helpers/page.cjs');

test('§5.5 : bouton de validation ESV désactivé : refus, aucun clic, aucun raccourci',async()=>{
  const f=page(),before=await f.call('state');let clics=0;
  const bouton=f.nodes.get('O2N3DCutValidate3DRail');bouton.disabled=true;bouton.click=()=>{clics++;};
  await assert.rejects(()=>f.call('validateAndNext',before.identity,{}),/Commande ESV indisponible/);
  assert.equal(clics,0);assert.equal(f.keyboard.length,0);
  assert.equal((await f.call('state')).identity.cut,100,'le cut n\'a pas changé');
});

test('§5.5 : bouton « prochain cut invalide » désactivé : navigation refusée sans clic, émission prouvée nulle',async()=>{
  const f=page(),before=await f.call('state');let clics=0;
  const bouton=f.nodes.get('O2N3DCutNextInvalid3DRail');bouton.disabled=true;bouton.click=()=>{clics++;};
  const evidence=await f.call('nextWithoutDecision',before.identity,{part:23},'op-desactive');
  assert.equal(clics,0);assert.equal(f.keyboard.length,0);
  assert.equal(evidence.refusal.code,'NAVIGATION_COMMAND_UNAVAILABLE');
  assert.equal(evidence.commandInvoked,false);assert.equal(evidence.commandSent,false);
  for(const k of ['applyCommandSent','validationCommandSent','skipCommandSent'])assert.equal(evidence[k],false,k);
});

test('§5.5 : sélection de rail désactivée : application refusée, aucun rail déplacé',async()=>{
  const f=page(),before=await f.call('state');let clics=0;
  const bouton=f.nodes.get('O2N3DCutLRClick');bouton.disabled=true;const select=bouton.click;bouton.click=()=>{clics++;select();};
  await assert.rejects(()=>f.call('apply',before,{left:{delta:[0,.012,.003]},right:{delta:[0,-.01,.004]}}),/Commande ESV indisponible/);
  assert.equal(clics,0);assert.ok(K.equalPoses((await f.call('state')).rails,before.rails,1e-12),'rails inchangés');
});
