'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs');const {base,K}=require('./fixtures.cjs');
test('science seeded par la décision réelle : distincte de la paire, même entrée/receiver/résultat',async()=>{
 async function replay(enabled){const b=production({enabled}),shadow=b.get('BananeGCV1Shadow'),original=shadow.scientificProposeBoth;let calls=0,last,args,receiver;
  shadow.scientificProposeBoth=function(...a){calls++;args=a;receiver=this;last=original.apply(this,a);return last;};
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  const capture=K.clone(base);capture.identity={pageId:'fixture-page',frameId:'fixture-frame',shape:'U50',projectId:'project',part:23,cut:100};capture.captureId='original-C';
  const e=b.get('engine');e.s.current={identity:capture.identity};e.s.batch={id:'synthetic-science',state:'RUNNING',scope:{part:23,start:100,end:100}};
  const r=b.get('timing');if(r){r.syncBatch(true);r.ensureVisit(capture.identity);r.visit.captureId='original-C';r.visit.analysisId='analysis-science';}
  const anchors=[99,98].map(cut=>({identity:{...capture.identity,cut},positions:Object.fromEntries(['left','right'].map(side=>[side,capture.rails[side].positionSceneRelative]))}));
  const science={rails:{left:{ok:true,next:{status:'unresolved'}},right:{ok:true,next:{status:'unresolved'}}},summary:{}};
  const L=b.get('BananeLotDecision'),before=b.commands.length;
  const invoke=()=>L.decideCut({capture,science,anchors,Shadow:shadow});const decision=r?r.trackTask('observe-lot',invoke):invoke();
  assert.equal(calls,1);assert.equal(receiver,shadow);assert.equal(args.length,1);assert.ok(args[0]!==capture,'minimalCapture seeded est une nouvelle entrée, non la capture initiale');
  assert.equal(b.commands.length,before,'aucune commande adaptateur pour ce rejeu scientifique');
  if(r){const spans=b.store.events.filter(e=>e.type==='phase-timing'&&e.label==='v46-scientific');assert.equal(spans.length,2);assert.ok(spans.every(e=>e.inputKind==='seeded'&&e.analysisId==='analysis-science'&&e.inputId));
   assert.equal(b.store.events.filter(e=>e.label==='v46-pair-complete').length,0);
   // The boundary wrapper returns exactly the object produced by its original.
   const out=r.trackTask('observe-lot',()=>shadow.scientificProposeBoth(args[0]));assert.equal(out,last);assert.equal(calls,2);
  }
  return normalize(decision);
 }
 assert.deepEqual(await replay(true),await replay(false));
});
