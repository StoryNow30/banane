'use strict';
/* 4.9.0.4 — « Vider le cache des exports » après un lot RÉEL (service worker réel, moteur réel, ESV simulé, pilote GCV1 de banc)
 * qui se termine sur son dernier cut. MESURÉ avant le correctif (tests/…, mesure du 12 octobre) : trois fins laissent la
 * capture « avant » du dernier cut OUVERTE (collection READY_FOR_AFTER, lidarId présent, nuage en base) et le vidage répondait
 * « une capture est en cours » :
 *   - dernier cut à valider DIFFÉRÉ (le cas du terrain, stoppedAtEnd.reason = dernier-cut-differe) ;
 *   - dernier cut du lot POSÉ mais non validé (stopAtLotEnd, applied:true : pose appliquée, snapshot présent) ;
 *   - dernier cut du lot NON RÉSOLU, laissé sans commande (stopAtLotEnd, applied:false).
 * Les fins « dernier cut validé sur place » et « fin naturelle » laissent AFTER_CAPTURED (déjà permis). Après le vidage, la
 * capture ouverte reste exploitable : nuage et événements qui la nomment gardés, annulation / reprise du lot possibles. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),EC=require('../src/export-cache.js');
const {dernierCut,differe}=require('./helpers/dernier-cut.cjs'),{lot}=require('./helpers/pilote-lot.cjs');
const plat=x=>JSON.parse(JSON.stringify(x));
const nonResolu={...L,decideCut:()=>({version:L.DEFAULTS.version,stage:'deferred',reason:'guard',guardDeferred:true,guardMm:40,anchorsUsed:[99]})};
const FINS={
  'dernier cut différé (cas du terrain)':async()=>{const {r,view}=await dernierCut({decision:differe});return {b:r.b,view};},
  'dernier cut posé, non validé':async()=>{const r=await lot(L,{start:100,end:100});return {b:r.b,view:r.view};},
  'dernier cut non résolu, laissé sans commande':async()=>{const r=await lot(nonResolu,{start:100,end:100});return {b:r.b,view:r.view};}};

/* Le faux stockage supprime vraiment (comme IndexedDB) ; `keys` lit le magasin demandé. */
function stockage(b){const st=b.store;b.ctx.BananeExportCache=EC;      // le banc de ces essais ne charge pas src/export-cache.js tout seul
  st.deleteMany=async(nom,ids)=>{const g=new Set(ids);let n=0;
    if(nom==='events'){const a=st.events.length;st.events=st.events.filter(x=>!g.has(x.eventId));n=a-st.events.length;}
    else if(nom==='records'){const a=st.records.length;st.records=st.records.filter(x=>!g.has(x.recordId||x.id));n=a-st.records.length;}
    else for(const i of ids)if(st.clouds.delete(i))n++;
    return n;};
  st.keys=async n=>n==='clouds'?[...st.clouds.keys()]:n==='events'?st.events.map(x=>x.eventId):st.records.map(x=>x.recordId||x.id);
  return ()=>({at:Date.now(),ids:{events:st.events.map(x=>x.eventId),records:st.records.map(x=>x.recordId||x.id),clouds:[...st.clouds.keys()]},
    signatures:{events:Object.fromEntries(st.events.map(o=>[o.eventId,EC.signature(o)])),records:Object.fromEntries(st.records.map(o=>[o.recordId||o.id,EC.signature(o)]))}});}
/* La grâce de 5 s de l'observateur est ailleurs (tests/obs-grace-*.test.cjs) : la fin du lot est datée d'il y a une minute. */
const vieillir=(b,e)=>{e.s.batch.stoppedAtEnd.at=new Date(Date.now()-60e3).toISOString();for(const f of b.fonction('obsFins').values())f.at-=60e3;};
const nomme=(e,id,pid)=>e.lidarId===id||e.lidarCaptureId===id||e.captureId===id||(pid&&(e.proposalId===pid||e.proposal?.id===pid));

for(const [nom,fin] of Object.entries(FINS)){
  test(`lot réel — ${nom} : la capture « avant » reste ouverte, le vidage est permis et la garde`,async()=>{
    const {b,view}=await fin(),snap=stockage(b),e=b.fonction('engine');
    assert.equal(view.batch.state,'STOPPED');assert.ok(view.batch.stoppedAtEnd,'fin au dernier cut');
    assert.equal(e.s.collection,'READY_FOR_AFTER','mesuré : capture « avant » du dernier cut restée ouverte');
    const id=e.s.lidarId,pid=e.s.proposal?.id;assert.ok(id&&pid&&b.store.clouds.has(id),'lidarId, proposition, nuage en base');
    const lies=b.store.events.filter(x=>nomme(x,id,pid)).map(x=>x.eventId);assert.ok(lies.length>=2,'événements du journal qui nomment la capture : '+lies.length);
    vieillir(b,e);
    const info=await b.api('export-cache-info');
    assert.equal(info.refus,null,'avant 4.9.0.4 : « une capture est en cours (READY_FOR_AFTER) »');assert.deepEqual(plat(info.capture.clouds),[id]);
    const avantEtat=JSON.stringify(e.s),s=snap(),total=s.ids.events.length,nuages=s.ids.clouds.length;
    const out=await b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,exportAt:null,instantaneAt:s.at});
    assert.equal(out.cleared,true);
    assert.deepEqual([...b.store.clouds.keys()],[id],'seul le nuage de la capture ouverte reste');assert.equal(out.clouds,nuages-1);
    const reste=b.store.events.map(x=>x.eventId);for(const x of lies)assert.ok(reste.includes(x),'événement gardé : '+x);
    assert.equal(out.events,total-reste.length,'comptes exacts');assert.ok(reste.length>=lies.length);
    assert.equal(plat(out.captureGardee).nuages,1);assert.equal(plat(out.captureGardee).collection,'READY_FOR_AFTER');
    assert.equal(JSON.stringify(e.s),avantEtat,'état du moteur et du lot : octet pour octet');
    // « Annuler la capture » (action du panneau) : le moteur archive la capture ouverte ; la visite nomme un nuage PRÉSENT.
    await b.api('cancel-before');
    const archive=b.store.records.find(r=>r.reason==='operator-cancelled');assert.ok(archive,'visite « incomplete-no-after » écrite');
    assert.equal(archive.lidarCaptureId,id);assert.ok(b.store.clouds.has(archive.lidarCaptureId),'…et son nuage existe');
    // Second export : cohérent (tout nuage nommé est présent, rien de ce qui est déjà parti).
    const second=await b.api('dataset');assert.deepEqual(plat(second.cloudIds),[id]);
    for(const r of second.records)if(r.lidarCaptureId)assert.ok(second.cloudIds.includes(r.lidarCaptureId));
    for(const x of second.events)for(const c of [x.lidarId,x.lidarCaptureId,x.captureId].filter(Boolean))assert.ok(second.cloudIds.includes(c),'nuage nommé présent : '+c);
  });
}

test('lot réel — dernier cut posé non validé : après le vidage, « Reprendre » valide le cut ; sa visite nomme le nuage gardé',async()=>{
  const r=await lot(L,{start:100,end:100}),b=r.b,snap=stockage(b),e=b.fonction('engine');
  assert.equal(e.s.collection,'READY_FOR_AFTER');assert.ok(e.s.applied,'pose appliquée, non validée');const id=e.s.lidarId;
  vieillir(b,e);const s=snap();
  await b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,instantaneAt:s.at});
  assert.deepEqual([...b.store.clouds.keys()],[id]);
  await b.api('resume');const v=await b.settle();                    // le lot reprend à l'étape « validate » de ce cut
  const rec=b.store.records.find(x=>x.lidarCaptureId===id&&!x.reason);assert.ok(rec,'visite finale écrite par finish()');
  assert.ok(b.store.clouds.has(rec.lidarCaptureId),'son nuage est toujours en base');
  assert.equal(v.batch.processed.length,1,'le cut est compté une fois');
});

test('lot réel — dernier cut validé sur place et fin naturelle : AFTER_CAPTURED, rien à garder (visite finale et nuage partent ensemble)',async()=>{
  const {r}=await dernierCut(),b=r.b,snap=stockage(b),e=b.fonction('engine');
  assert.equal(e.s.collection,'AFTER_CAPTURED');vieillir(b,e);const s=snap();
  const info=await b.api('export-cache-info');assert.equal(info.refus,null);assert.equal(info.capture??null,null);
  const out=await b.api('export-cache-clear',{ids:s.ids,signatures:s.signatures,manuel:true,instantaneAt:s.at});
  assert.equal(b.store.clouds.size,0);assert.equal(out.captureGardee??null,null);assert.equal(b.store.records.length,0);
});
