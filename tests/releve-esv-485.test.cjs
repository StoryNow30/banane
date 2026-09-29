'use strict';
/* D4 (4.8.5, D-061) — instrumentation passive : après chaque capture, réussie
 * ou non, sans commande ni écriture dans ESV, le texte « N on M treated » s'il
 * est lisible et le nombre d'objets « rail » que la scène garde (filtrés comme
 * la lecture du cut courant). Le relevé part APRÈS la réponse, dans son propre
 * message ; il porte l'identité lue, le cut demandé, la requête et l'heure ;
 * format inconnu → champ absent, jamais d'erreur ; jamais réemployé. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs'),F=require('./v242/fixtures.cjs'),K=require('../src/core.js');
const {background,shadowHarness}=require('./helpers/background-harness.cjs');
function lidarPage(){const f=page(),pc=F.object([0,0,0],'PointCloudOctree');
  const n=F.object([0,0,0],'Points');n.geometry={attributes:{position:F.buffer([[0,.01,.01],[0,1.425,.01]])}};
  pc.material={clipBoxes:[],clipTask:0,clipMethod:0};pc.visibleNodes=[{sceneNode:n}];
  f.ctx.viewer.scene.pointclouds=[pc];f.ctx.Potree=F.enums;
  /* Textes de la page, lus en lecture seule (TreeWalker) ; un texte peut avoir un élément parent. */
  let textes=[];f.ctx.document.body={};
  f.ctx.document.createTreeWalker=()=>{let i=-1;return {nextNode:()=>{if(++i>=textes.length)return null;const t=textes[i];return typeof t==='string'?{nodeValue:t}:t;}};};
  const capturer=async()=>{const n0=f.reponses.length,r=await f.call('capture',await f.call('state'));
    const rep=f.reponses.at(-1),m=f.releves.at(-1);assert.equal(m.requestId,rep.id,'relevé de CETTE capture');
    assert.ok(f.reponses.length>n0);return {capture:r,releve:m.releve,message:m};};
  return {...f,textes:t=>{textes=t;},capturer};}

test('relevé après chaque capture : compteur lu, puis absent, puis illisible, puis cut changé — jamais réemployé, jamais dans la capture',async()=>{
  const f=lidarPage();
  f.textes(['Cut 100 of part 23','Validation','6593 on 6732 treated']);
  let {capture,releve:r}=await f.capturer();
  assert.equal('releve' in capture,false);assert.equal('releveEsv' in capture,false,'la capture reste celle d’avant');
  assert.equal(r.identity.part,23);assert.equal(r.identity.cut,100);assert.ok(r.identity.pageId);assert.ok(Date.parse(r.at));assert.deepEqual({...r.demande},{part:23,cut:100});
  assert.deepEqual({...r.compteur},{traites:6593,total:6732});assert.equal(r.objetsRail,2);
  f.textes(['Cut 100 of part 23']);({releve:r}=await f.capturer());
  assert.equal('compteur' in r,false,'absent : jamais la valeur précédente');assert.equal(r.compteurIllisible,undefined);
  f.textes(['six on many treated']);({releve:r}=await f.capturer());
  assert.equal('compteur' in r,false,'format inconnu : champ absent');assert.equal(r.compteurIllisible,true);
  f.nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';f.textes(['6594 on 6732 treated']);({releve:r}=await f.capturer());
  assert.equal(r.identity.cut,101);assert.deepEqual({...r.compteur},{traites:6594,total:6732});
});
test('compteur réparti sur plusieurs éléments, ou chiffres groupés : lu ; masqué : ignoré ; plusieurs : comptés',async()=>{
  const f=lidarPage();
  f.textes([{nodeValue:' on 6732 treated',parentElement:{textContent:'6593 on 6732 treated'}}]);
  assert.deepEqual({...(await f.capturer()).releve.compteur},{traites:6593,total:6732});
  f.textes(['6,593 on 6,732 treated']);assert.deepEqual({...(await f.capturer()).releve.compteur},{traites:6593,total:6732});
  f.textes([{nodeValue:'6500 on 6732 treated',parentElement:{textContent:'6500 on 6732 treated',checkVisibility:()=>false}},'6593 on 6732 treated','12 on 40 treated']);
  const r=(await f.capturer()).releve;assert.deepEqual({...r.compteur},{traites:6593,total:6732});assert.equal(r.compteursVus,2);
});
test('capture en échec (un troisième objet « rail » dans la scène) : le relevé part quand même, après l’erreur',async()=>{
  const f=lidarPage();F.add(f.root,F.rail(3,[0,0,0],0));f.textes(['6593 on 6732 treated']);
  await assert.rejects(f.call('capture',{identity:{part:23,cut:100}}),/identifiables|Cible|Rails|rails/);
  const m=f.releves.at(-1);assert.equal(m.requestId,f.reponses.at(-1).id);assert.ok(f.reponses.at(-1).error);
  assert.equal(m.releve.objetsRail,3);assert.equal(m.releve.compteur.traites,6593);assert.deepEqual({...m.releve.demande},{part:23,cut:100});
});
test('un objet sans sommets n’est pas compté, comme à la lecture du cut',async()=>{
  const f=lidarPage(),vide=F.rail(3,[0,0,0],0);for(const p of vide.children)for(const c of p.children||[])if(c.type==='Line')c.geometry={attributes:{}};
  F.add(f.root,vide);assert.equal((await f.capturer()).releve.objetsRail,2);
});
test('bridge : le relevé part au service worker, sans toucher les réponses en attente',()=>{
  const {bridge}=require('./helpers/bridge.cjs'),b=bridge();
  const c=b.command('capture');b.deliver(c,{kind:'banane3:result',result:{pointsSceneRelative:[]}});
  b.emit({kind:'banane3:releve',channel:c.request.channel,requestId:c.request.id,releve:{at:'t',objetsRail:2}});
  assert.deepEqual(Object.keys(c.replies[0]).sort(),['diagnostic','result']);
  const t=b.traces.find(x=>x.kind==='esv-releve');assert.ok(t);assert.equal(t.releve.objetsRail,2);
  b.emit({kind:'banane3:releve',channel:'autre',releve:{at:'x'}});assert.equal(b.traces.filter(x=>x.kind==='esv-releve').length,1,'canal étranger ignoré');
});
test('service worker : relevé rangé au journal (esv-releve), champs vérifiés, identité complétée',async()=>{
  const b=background({shadow:shadowHarness(),globals:{BananeCore3:K}});await b.api('connect',{tabId:1});
  const esv={id:'test',url:'https://esv.lidar.altametris.xyz/rails_validation/test',tab:{id:1}};
  await b.message({kind:'esv-releve',releve:{at:'2026-09-29T06:00:00.000Z',requestId:'r1',identity:{pageId:'p',part:23,cut:100},demande:{part:23,cut:100},
    compteur:{traites:6593,total:6732},objetsRail:2,lidarCaptureId:'faux',batchId:'faux'}},esv);
  await new Promise(r=>setImmediate(r));
  const e=b.store.events.find(x=>x.type==='esv-releve');assert.ok(e,'rangé dans le journal');
  assert.deepEqual({...e.compteur},{traites:6593,total:6732});assert.equal(e.identity.cut,100);assert.equal(e.identity.pageId,'p');assert.ok('frameId' in e.identity,'identité complétée');
  assert.equal(e.at,'2026-09-29T06:00:00.000Z');assert.equal(e.requestId,'r1');assert.equal('lidarCaptureId' in e,false);assert.equal('batchId' in e,false);
  await b.message({kind:'esv-releve',releve:{at:'t',objetsRail:3}},esv);await new Promise(r=>setImmediate(r));
  assert.equal(b.store.events.filter(x=>x.type==='esv-releve').at(-1).identity,null,'jamais l’identité d’un autre cut');
  await b.message({kind:'esv-releve',releve:{at:'u'}},{...esv,tab:{id:99}});await new Promise(r=>setImmediate(r));
  assert.equal(b.store.events.filter(x=>x.type==='esv-releve').length,2,'autre onglet ignoré');
});
test('service worker : un journal indisponible ne lève rien',async()=>{
  const b=background({shadow:shadowHarness(),globals:{BananeCore3:K}});await b.api('connect',{tabId:1});
  b.store.putEvent=async()=>{throw Error('stockage plein');};
  await b.message({kind:'esv-releve',releve:{at:'t',objetsRail:2}},{id:'test',url:'https://esv.lidar.altametris.xyz/rails_validation/test',tab:{id:1}});
  await new Promise(r=>setImmediate(r));
});
test('D-062 : le texte « M cuts » (total de la partie) est lu aussi ; « Cut N of part P » n’en est pas un',async()=>{
  const f=lidarPage();
  f.textes(['Cut 100 of part 23','7956 cuts','6593 on 6732 treated']);
  let r=(await f.capturer()).releve;assert.equal(r.cutsAffiches,7956);assert.deepEqual({...r.compteur},{traites:6593,total:6732});
  f.textes([{nodeValue:' cuts',parentElement:{textContent:'7 956 cuts'}}]);r=(await f.capturer()).releve;assert.equal(r.cutsAffiches,7956,'réparti, chiffres groupés');
  f.textes(['Cut 100 of part 23','Validated cuts','cuts']);r=(await f.capturer()).releve;assert.equal('cutsAffiches' in r,false);
  f.textes(['101 cuts','101 cuts']);r=(await f.capturer()).releve;assert.equal(r.cutsAffiches,101);assert.equal(r.cutsAffichesVus,2);
});
test('D-062 : service worker : « M cuts » rangé au journal',async()=>{
  const b=background({shadow:shadowHarness(),globals:{BananeCore3:K}});await b.api('connect',{tabId:1});
  await b.message({kind:'esv-releve',releve:{at:'t',identity:{pageId:'p',part:23,cut:100},cutsAffiches:7956,cutsAffichesVus:1}},{id:'test',url:'https://esv.lidar.altametris.xyz/rails_validation/test',tab:{id:1}});
  await new Promise(r=>setImmediate(r));
  const e=b.store.events.find(x=>x.type==='esv-releve');assert.equal(e.cutsAffiches,7956);assert.equal(e.cutsAffichesVus,1);
});
