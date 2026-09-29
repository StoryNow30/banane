'use strict';
/* D-062 (c) et (d), version de test 2 — MISE EN SÉCURITÉ PENDANT UNE POSE.
 * Une autre Ariane commande l'onglet pendant qu'Ariane pose une paire : la pose
 * en cours va à son terme (deux rails), la validation suivante est refusée, le
 * lot passe en pause ; l'opérateur contrôle le cut (risque accepté, D-062 d).
 * Aucune validation ni SKIP automatique ; aucune commande renvoyée. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs'),K=require('../src/core.js'),C=require('../vendor/capture-core.js');
const {pilote,panneau}=require('./helpers/fin-partie.cjs'),L=require('../src/lot-decision.js');
const PROPOSITIONS={left:{delta:[0,.012,.003]},right:{delta:[0,-.01,.004]}};

/* Page ESV simulée dont la pose peut être SUSPENDUE : au clic de sélection du
 * rail droit (le gauche est posé), toutes les minuteries de l'adaptateur sont
 * retenues jusqu'à `lacher()`. */
function pageSuspendue(){let retenue=null,lacher=null,armee;const arme=new Promise(r=>{armee=r;});
  const f=page({globals:{setTimeout:(fn,ms=0)=>{const go=()=>queueMicrotask(fn);if(retenue)retenue.then(go);else go();}}});
  const droite=f.nodes.get('O2N3DCutRRClick'),clic=droite.click.bind(droite);
  droite.click=()=>{clic();if(!retenue){retenue=new Promise(r=>{lacher=r;});armee();}};
  return {f,arme,lacher:()=>lacher()};}
const position=(f,side)=>{const p=(side==='left'?f.left:f.right).position;return [p.x,p.y,p.z];};

test('adaptateur : intrusion entre les deux clics : la paire se termine, la validation est refusée, rien n’est validé',async()=>{
  const {f,arme,lacher}=pageSuspendue();
  const before=await f.call('state'),attendu=K.expectedPoses(before,PROPOSITIONS);
  let finie=false;const pose=f.call('apply',before,PROPOSITIONS).then(r=>{finie=true;return r;});
  await arme;assert.equal(finie,false,'pose suspendue entre les deux clics');
  /* Une autre Ariane commande l'onglet pendant la suspension : refusée, mise en sécurité. */
  await assert.rejects(f.raw('validateAndNext',[before.identity,{}],{proprietaire:'autre'}).promise,e=>/^Une autre Ariane/.test(e.message));
  assert.equal((await f.call('ping')).intrusion?.action,'validateAndNext');
  lacher();const apres=await pose;
  for(const s of ['left','right'])assert.ok(C.distance(apres.rails[s].positionSceneRelative,attendu[s].positionSceneRelative)<=.001,`rail ${s} posé`);
  let refus=null;await f.call('validateAndNext',before.identity,{}).catch(e=>{refus=e.message;});
  assert.match(refus,/^Adaptateur ESV sans réponse : Ariane 4\.8\.5 test 2 en sécurité : une autre Ariane a tenté de commander cet onglet \(« validateAndNext »\)\. Validation refusée : la pose de ce cut est faite, non validée\./);
  assert.match(refus,/Contrôle-la dans ESV AVANT tout F5[^]*Archiver le résultat interrompu/);
  assert.equal(f.nodes.get('O2N3DCutDescription').textContent,'Cut 100 of part 23','aucune validation, aucune navigation');
});
test('adaptateur : intrusion AVANT la pose : pose refusée, rien posé, le message le dit',async()=>{
  const f=page(),before=await f.call('state'),gauche=position(f,'left');
  await assert.rejects(f.raw('next',[],{proprietaire:'autre'}).promise);
  let refus=null;await f.call('apply',before,PROPOSITIONS).catch(e=>{refus=e.message;});
  assert.match(refus,/^Adaptateur ESV sans réponse : [^]*Pose refusée : rien n’a été posé sur ce cut/);
  assert.deepEqual(position(f,'left'),gauche);
});

test('lot : validation refusée après la pose (adaptateur en sécurité) : lot en pause, pose gardée, message, archivage proposé',async()=>{
  /* Le refus exact de l'adaptateur réel, obtenu comme ci-dessus. */
  const {f,arme,lacher}=pageSuspendue();const b0=await f.call('state');const pose=f.call('apply',b0,PROPOSITIONS);await arme;
  await f.raw('next',[],{proprietaire:'autre'}).promise.catch(()=>{});lacher();await pose;
  const refus=await f.call('validateAndNext',b0.identity,{}).then(()=>null,e=>e.message);assert.ok(refus);
  const r=await pilote(L,{start:100,end:105,esv:esv=>{esv.validateAndNext=async function(){this.calls.push('validateAndNext');throw Error(refus);};}});
  const view=await r.b.settle();
  assert.equal(r.applied.length,1,'la pose en cours est allée à son terme');
  assert.equal(r.b.adapter.calls.filter(c=>c==='validateAndNext').length,1,'une seule tentative, jamais renvoyée');
  assert.ok(!r.b.adapter.calls.includes('skip'),'aucun SKIP');
  assert.equal(view.batch.state,'PAUSED_ADAPTER_UNRESPONSIVE','le lot passe en pause');assert.equal(view.reconcileRequired,true);
  assert.match(view.notice,/Validation refusée : la pose de ce cut est faite, non validée/);
  const {$}=await panneau(view);
  assert.equal($('close-uncertain').hidden,false,'« Archiver le résultat interrompu » proposé');assert.equal($('resume').hidden,true,'pas de reprise sur un résultat incertain');
});
