'use strict';
/* 4.8.0 (KI-063) — arrêts du Pilote 4.7.21 sur le terrain du 26/09 (parties 13
 * et 14, bilans « INTERRUPTION A VOIR » et « LOT 14 INTERRUPTION »).
 *   1. ESV muet 30 s après la validation de 6629 (cut suivant annoncé : 6758,
 *      même partie) : la 4.7.21 closait le lot comme une fin de partie et
 *      retenait 6629 comme fin de la partie 13.
 *   2. Un « Arrêter » resté sans réponse pendant ce silence : 45 s plus tard,
 *      le délai du bridge renvoyait un `cancel` global, qui coupait la lecture
 *      du lot suivant (partie 14, cut 410 : « Export interrompu. »).
 *   3. Trois lots sur cinq arrêtés par « Vue ESV non recentrée » sur des cuts
 *      où ESV mettait 17 à 19 s à lire le nuage. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),S=require('../src/settings.js');
const {pilote}=require('./helpers/pilote-lot.cjs'),{bridge}=require('./helpers/bridge.cjs'),{page}=require('./helpers/page.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const rapide={...S,lot:{...S.lot,stateRetryMs:1}};
/* ESV muet après la première validation, pendant `silence` lectures, puis `ensuite(esv)`. */
const muet=(silence,ensuite=()=>{})=>esv=>{const v=esv.validateAndNext.bind(esv),st=esv.state.bind(esv);let reste=-1;
  esv.validateAndNext=async(...a)=>{const e=await v(...a);if(reste<0){reste=silence;}return e;};
  esv.state=async(...a)=>{if(reste>0){reste--;if(reste===0)ensuite(esv);throw Error(MUET);}return st(...a);};};

test('silence après une validation dans la partie, puis ESV revient sur la même partie : le lot continue',async()=>{
  const r=await pilote(L,{start:100,end:103,settings:rapide,esv:muet(5)});const view=await r.b.settle();
  assert.equal(r.b.store.events.some(e=>e.type==='batch-stopped-at-end'&&e.reason),false,'aucune sortie de partie inventée');
  assert.ok(r.b.store.events.some(e=>e.type==='adapter-state-retry'&&e.ok),'nouvelle lecture réussie après le silence');
  assert.equal(view.batch.stoppedAtEnd.cut,103,'le lot va jusqu\'à sa borne');
});

test('terrain partie 13 : silence puis ESV sur une autre partie — lot clos, fin retenue = cut annoncé dans la partie',async()=>{
  const r=await pilote(L,{start:100,end:0,endMode:'partie',settings:rapide,esv:muet(6,esv=>{esv.identity.part=24;esv.identity.cut=1;})});
  const view=await r.b.settle();
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd.reason,'navigation-other-part');
  assert.deepEqual(view.batch.stoppedAtEnd.target,{part:24,cut:1});
  assert.equal(r.b.adapter.calls.filter(c=>c==='capture').length,1,'aucune capture dans la partie 24');
  const f=await r.b.api('bornes-partie',{part:23});assert.equal(f.last,101,'ESV avait annoncé 101 : la partie va au moins jusque-là');assert.equal(f.source,'fin constatée');
});

test('silence qui dure, cut suivant dans la partie : pas de fin de partie retenue, pas de clôture « fin de lot »',async()=>{
  const r=await pilote(L,{start:100,end:0,endMode:'partie',settings:rapide,esv:muet(Infinity)});const view=await r.b.settle();
  assert.notEqual(view.batch.state,'RUNNING');assert.equal(view.batch.stoppedAtEnd??null,null);
  assert.equal(r.b.store.events.some(e=>e.type==='batch-stopped-at-end'),false);
  assert.equal(await r.b.api('bornes-partie',{part:23}),null,'aucune fin inventée pour la partie');
});

test('bridge : un cancel expiré ne relance pas de cancel ; une autre requête expirée annule elle seule',()=>{
  const f=bridge();
  const c=f.command('cancel');const avant=f.sent.length;f.timeout(c);
  assert.equal(f.sent.length,avant,'aucun cancel de cancel');
  const cap=f.command('capture');f.timeout(cap);const annul=f.sent.at(-1);
  assert.equal(annul.action,'cancel');assert.equal(annul.args[0].requestId,cap.request.id);assert.equal(typeof annul.sentAt,'number');
});

const PROPOSALS={left:{delta:[0,.012,.003]},right:{delta:[0,-.01,.004]}};
test('page : un cancel qui vise une requête terminée, ou émis avant la requête en cours, est ignoré',async()=>{
  const p=page(),before=await p.call('state');
  /* Délai de bridge d'une requête qui ne tourne plus. */
  assert.equal((await p.raw('cancel',[{requestId:'finie',reason:'bridge-timeout'}]).promise).stale,true);
  /* « Arrêter » émis avant la pose en cours, arrivé pendant celle-ci : ignoré. */
  const ancien=p.clock();p.advance(1000);const pose=p.raw('apply',[before,PROPOSALS]);
  assert.equal((await p.raw('cancel',[],{sentAt:ancien}).promise).stale,true);
  await pose.promise;
  /* Un cancel qui vise la requête en cours la coupe toujours. */
  const now=await p.call('state'),coupee=p.raw('restore',[before]);void now;
  const suivante=p.raw('apply',[await p.call('state'),PROPOSALS]);await p.raw('cancel',[{requestId:suivante.id}]).promise;
  await assert.rejects(suivante.promise,/Action interrompue/);await coupee.promise.catch(()=>{});
  /* Un cancel porté par une opération reste retenu, même sans requête en cours. */
  assert.equal((await p.raw('cancel',[{operationId:'op-1',reason:'stop'}],{sentAt:0}).promise).operationId,'op-1');
});

test('vue qui ne se recentre qu\'au deuxième clic : sélection redemandée, pas d\'erreur',async()=>{
  const p=page(),before=await p.call('state'),node=p.nodes.get('O2N3DCutRRClick'),clic=node.click;let n=0;
  node.click=function(){if(++n===1)return;return clic.call(this);};
  await p.call('apply',before,PROPOSALS);assert.equal(n,2,'un second clic de sélection');
});

test('vue qui ne se recentre jamais : refus après trois clics ; en lecture, pause reprenable',async()=>{
  let p=page(),before=await p.call('state'),n=0;
  p.nodes.get('O2N3DCutRRClick').click=function(){n++;};
  await assert.rejects(p.call('apply',before,PROPOSALS),/Vue ESV non recentrée sur le rail right\./);assert.equal(n,S.pilote.recentrages);
  p=page();before=await p.call('state');n=0;p.nodes.get('O2N3DCutRRClick').click();
  p.nodes.get('O2N3DCutLRClick').click=function(){n++;};
  await assert.rejects(p.call('capture',before),e=>{assert.match(e.message,/^Lecture LiDAR instable : Vue ESV non recentrée sur le rail left\./);return true;});
  assert.equal(n,S.pilote.recentrages);
});
