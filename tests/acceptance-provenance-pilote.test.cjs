'use strict';
/* CHANTIER 5 — §14 I dans le Pilote : aucune position de l'opérateur dans
 * l'entrée d'une décision (cahier §10, §14 I). Deux chemins par lesquels une pose
 * humaine pourrait entrer : la reprise manuelle d'un cut, puis la reprise du
 * lot ; « Réessayer ce cut » après que l'opérateur a touché les rails pendant
 * une pause — défaut constaté, KI-055 proposé. Service worker réel en vm. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),K=require('../src/core.js');
const {pilote,SIDES}=require('./helpers/pilote-lot.cjs');

/* Reprise manuelle (MANUAL_TAKEOVER puis « Repris manuellement ») : l'opérateur
 * pose le cut 100 lui-même. Banane ne lit jamais cette pose ; le cut suivant est
 * décidé sur sa propre capture et sur les seules positions décidées auparavant. */
test('§14 I : dans le Pilote, la décision ne reçoit que la capture ESV du cut et les positions qu\'elle a elle-même décidées',async()=>{
  const calls=[],spy={...L,decideCut(args){const d=L.decideCut(args);
    calls.push({cut:args.capture.identity.cut,rails:K.clone(args.capture.rails),anchors:K.clone(args.anchors),positions:d.positions?K.clone(d.positions):null});return d;}};
  const r=await pilote(spy,{start:100,end:101,policy:'pause'});
  const capture=r.b.adapter.capture.bind(r.b.adapter);
  r.b.adapter.capture=async(...a)=>{r.b.adapter.noPoints=r.b.adapter.identity.cut===100;return capture(...a);};
  let view=await r.b.settle();
  assert.equal(view.batch.state,'PAUSED_UNRESOLVED_RAIL');assert.equal(view.batch.activeIdentity.cut,100);
  await r.b.api('manual-takeover');
  /* L'opérateur déplace les deux rails du cut 100 de 23 mm, puis passe au 101. */
  const humaine=K.expectedPoses({rails:r.b.adapter.rails},{left:{delta:[0,.023,.002]},right:{delta:[0,-.023,.002]}});
  r.b.adapter.rails=K.clone(humaine);await r.b.adapter.next();
  await r.b.api('manual-completion');view=await r.b.settle();
  assert.deepEqual(calls.map(c=>c.cut),[100,101]);assert.equal(view.batch.manuallyCompleted.length,1);
  const memePose=(a,b)=>SIDES.every(s=>K.C.distance(a[s].positionSceneRelative??a[s],b[s].positionSceneRelative??b[s])<1e-9);
  for(const c of calls){
    const lu=r.captured.filter(x=>x.cut===c.cut).at(-1);
    assert.ok(K.equalPoses(c.rails,lu.rails),`cut ${c.cut} : la décision lit la pose ESV capturée`);
    assert.ok(!memePose(c.rails,humaine),`cut ${c.cut} : pose humaine en entrée`);
    for(const a of c.anchors){
      const origine=calls.find(x=>x.cut===a.identity.cut&&x.positions&&memePose(x.positions,a.positions));
      assert.ok(origine,`cut ${c.cut} : appui ${a.identity.cut} sans décision d'origine`);
      assert.ok(!memePose(a.positions,humaine),`cut ${c.cut} : appui ${a.identity.cut} à la pose de l'opérateur`);}}
  /* 4.7.18 (KI-057) : le cut 100, repris à la main, n'a pas été posé par le
   * Pilote ; sa décision n'est pas un appui. Jusqu'à la 4.7.17, elle l'était. */
  assert.deepEqual(calls.at(-1).anchors.map(a=>a.identity.cut),[],'le cut 101 n\'a pas pour appui le cut 100 repris à la main');
});

/* KI-055 (chantier 5), corrigé en 4.7.18 : `Engine.retryPaused()` relit une
 * capture sans comparer les rails à la pose de départ (ce que fait `resume()`).
 * Le service worker refuse désormais « Réessayer » quand l'opérateur a touché
 * les rails pendant la pause : sa pose n'entre jamais dans le moteur. */
test('§14 I : « Réessayer ce cut » après un déplacement manuel des rails ne doit pas analyser la pose de l\'opérateur',async()=>{
  const calls=[],spy={...L,decideCut(args){calls.push(K.clone(args.capture.rails));return L.decideCut(args);}};
  const r=await pilote(spy,{start:100,end:100,policy:'pause'});
  r.b.adapter.noPoints=true;let view=await r.b.settle();
  assert.equal(view.batch.state,'PAUSED_UNRESOLVED_RAIL');
  const esv=K.clone(r.b.adapter.rails);
  const humaine=K.expectedPoses({rails:esv},{left:{delta:[0,.03,0]},right:{delta:[0,-.03,0]}});
  r.b.adapter.rails=K.clone(humaine);r.b.adapter.noPoints=false;
  const avant=calls.length;
  const refus=await r.b.api('retry').then(()=>null,e=>e);view=await r.b.settle();
  assert.match(String(refus?.message),/Rails modifiés pendant la pause/,'« Réessayer » est refusé');
  assert.equal(view.batch.state,'PAUSED_UNRESOLVED_RAIL','le lot reste en pause, sans nouvelle capture');
  assert.equal(calls.length,avant,'aucune décision sur la pose de l\'opérateur');
  /* Rails non touchés : « Réessayer » reste permis. */
  const r2=await pilote(spy,{start:100,end:100,policy:'pause'});r2.b.adapter.noPoints=true;await r2.b.settle();
  r2.b.adapter.noPoints=false;await r2.b.api('retry');const v2=await r2.b.settle();
  assert.notEqual(v2.batch.state,'PAUSED_UNRESOLVED_RAIL','réessai sans déplacement : le cut est repris');
  const vus=[...calls,...r.captured.map(c=>c.rails)];
  for(const rails of vus)assert.ok(!K.equalPoses(rails,humaine),'la pose de l\'opérateur est entrée dans la capture analysée');
});
