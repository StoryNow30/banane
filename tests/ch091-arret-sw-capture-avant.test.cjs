'use strict';
/* CH-091 : arrêt du service worker entre l'enregistrement de la capture « avant » (`before-captured` sauvegardé) et l'étape d'analyse
 * (`step=analyze` pas encore sauvegardé). La reprise repart proprement, sans commande en double, sans pose ni validation perdue. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {patchOk,Engine,K,StoreLent,ESV,lot,instantVise,redemarrer,reprendre,sansPerteNiDoublon,TERMINE}=require('./helpers/ch091.cjs');
const FIN=101;let memo=null;
const temoin=async()=>memo||(memo=await lot({fin:FIN}));
const points=j=>j.map((x,i)=>instantVise(x)?i+1:0).filter(Boolean);
test('le patch s’applique au tronc (ou le tronc le porte)',patchOk);
test('l’instant existe : un état durable porte l’étape capture avec l’avant et le nuage enregistrés, pour chaque coupe',async()=>{
 const {store}=await temoin();const p=points(store.journal);
 assert.deepEqual([...new Set(p.map(k=>StoreLent.etat(store.journal[k-1]).before.identity.cut))],[100,101]);});
for(const navigationSeule of [false,true])
 test(`arrêt à cet instant, puis Reprendre (navigation seule ${navigationSeule}) : le lot se termine, mêmes commandes qu’un lot sans arrêt`,async()=>{
  const {store,esv}=await lot({fin:FIN,navigationSeule});
  for(const k of points(store.journal)){
   const d=await redemarrer(store.journal,k,{navigationSeule});
   assert.equal(d.e.s.batch.state,'PAUSED',`k=${k} : pause reprenable après init()`);assert.ok(!d.e.s.reconcileRequired);
   const nuages=d.store.clouds.size,o=await reprendre(d);
   assert.equal(o.refus,null,`k=${k}`);assert.ok(TERMINE.includes(o.e.s.batch.state),`k=${k} : ${o.e.s.batch.state} ${o.e.s.batch.error?.message||''}`);
   assert.deepEqual(o.cmd,esv.cmd,`k=${k} : commandes`);sansPerteNiDoublon(o,k,FIN);
   /* Le nuage déjà stocké sert : aucune seconde lecture LiDAR de la coupe interrompue, aucun nuage orphelin. */
   const cut=d.durable.before.identity.cut;
   assert.equal(o.esv.calls.filter(c=>c==='capture').length,FIN-cut,`k=${k} : lectures LiDAR après la reprise`);
   assert.equal(o.store.clouds.size,nuages+FIN-cut,`k=${k} : nuages`);
   const ev=[...o.store.events.values()].filter(x=>x.type==='capture-avant-reprise');
   assert.equal(ev.length,1,`k=${k}`);assert.equal(ev[0].lidarId,d.durable.lidarId);assert.equal(ev[0].identity.cut,cut);
   assert.equal([...o.store.events.values()].some(x=>x.type==='batch-error'),false,`k=${k} : batch-error`);}
 });
test('nuage absent du stockage à la reprise : la lecture LiDAR est refaite (aucune commande avant), le lot se termine',async()=>{
 const {store,esv}=await temoin();const k=points(store.journal)[0];
 const o=await reprendre(await redemarrer(store.journal,k,{modifier:s=>s.clouds.clear()}));
 assert.ok(TERMINE.includes(o.e.s.batch.state),o.e.s.batch.state+' '+(o.e.s.batch.error?.message||''));assert.deepEqual(o.cmd,esv.cmd);sansPerteNiDoublon(o,k,FIN);
 assert.equal(o.esv.calls.filter(c=>c==='capture').length,FIN-99);assert.ok([...o.store.events.values()].some(x=>x.type==='capture-restarted'));});
test('avant ouvert avec un nuage noté mais sans fin d’enregistrement (BEFORE_CAPTURED) : la lecture est refaite, le lot se termine',async()=>{
 const {store,esv}=await temoin();const k=points(store.journal)[0];
 const o=await reprendre(await redemarrer(store.journal,k,{modifier:s=>{const e=s.state;e.collection='BEFORE_CAPTURED';s.state=e;}}));
 assert.ok(TERMINE.includes(o.e.s.batch.state),o.e.s.batch.state+' '+(o.e.s.batch.error?.message||''));assert.deepEqual(o.cmd,esv.cmd);sansPerteNiDoublon(o,k,FIN);});
test('rails modifiés pendant l’arrêt : la reprise est refusée, le lot reste en pause, aucune commande',async()=>{
 const {store}=await temoin();const k=points(store.journal)[0];
 const o=await reprendre(await redemarrer(store.journal,k,{modifier:(s,esv)=>{esv.rails.left.railLocalToSceneRelative[13]+=0.05;}}));
 assert.match(o.refus||'',/Rails modifiés/);assert.equal(o.e.s.batch.state,'PAUSED');assert.deepEqual(o.esv.cmd,[]);});
test('cible changée pendant l’arrêt : la reprise est refusée, aucune commande',async()=>{
 const {store}=await temoin();const k=points(store.journal)[0];
 const o=await reprendre(await redemarrer(store.journal,k,{modifier:(s,esv)=>{esv.identity={...esv.identity,cut:esv.identity.cut+1};}}));
 assert.match(o.refus||'',/Cible différente/);assert.notEqual(o.e.s.batch.state,'ERROR');assert.deepEqual(o.esv.cmd,[]);});
test('hors lot, la capture manuelle garde son refus : un avant ouvert ne se rouvre pas',async()=>{
 const esv=new ESV(),store=new StoreLent({esv:()=>({})});const e=new Engine(esv,store);await e.init();
 await e.begin();assert.equal(e.s.collection,'READY_FOR_AFTER');
 await assert.rejects(()=>e.begin(),/Capture avant déjà ouverte/);});
