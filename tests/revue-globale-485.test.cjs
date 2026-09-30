'use strict';
/* D7 (4.8.6) — revue de tout le diff 4.8.6 : défauts d'INTERACTION entre
 * chantiers (cohabitation D1 × moteur épinglé, garde D2 × fin de partie D3,
 * noms de version). */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {background,shadowHarness}=require('./helpers/background-harness.cjs');
const {page}=require('./helpers/page.cjs');
const {pilote,dernierDiffere,panneau}=require('./helpers/fin-partie.cjs');
const K=require('../src/core.js'),L=require('../src/lot-decision.js');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));

/* Le moteur épinglé ne met en pause reprenable qu'une erreur qui dit
 * « Adaptateur ESV sans réponse » (src/engine.js, fin de la boucle du lot) ;
 * toute autre erreur met le lot en ERROR, sans reprise possible. */
test('adaptateur en sécurité pendant un lot : pause reprenable (F5 puis Reprendre), jamais ERROR',async()=>{
  const p=page();
  /* Le refus à une autre Ariane n'est pas un silence : il ne passe pas pour « sans réponse ». */
  await assert.rejects(p.raw('next',[],{proprietaire:'autre'}).promise,e=>/^Une autre Ariane \(4\.8\.6\)/.test(e.message));
  let refus=null;await p.call('capture',{identity:{part:23,cut:100}}).catch(e=>{refus=e.message;});
  assert.match(refus,/^Adaptateur ESV sans réponse : Ariane 4\.8\.6 en sécurité/);
  const r=await pilote(L,{start:100,end:105,esv:esv=>{esv.capture=async function(){this.calls.push('capture');throw Error(refus);};}});
  const view=await r.b.settle();
  assert.equal(view.batch.state,'PAUSED_ADAPTER_UNRESPONSIVE');
});

/* Onglet ESV simulé pour chrome.scripting (comme les essais D1). */
function onglet(marqueur,tampon){const injecte=[],fenetre=marqueur?{__BANANE_V3_PAGE:marqueur}:{};if(tampon)fenetre.__ARIANE_PROPRIETAIRE=tampon;
  return {injecte,fenetre,executeScript:async o=>{injecte.push(o);
    if(o.func)return [{frameId:0,result:vm.runInNewContext(`(${o.func})(...args)`,{window:fenetre,args:o.args||[]})}];
    return [{frameId:0,result:undefined}];}};}
test('une autre Ariane de test est nommée comme dans edge://extensions (« 4.8.6 test 2 »), marqueur et ping compris',async()=>{
  const t=onglet({version:'4.8.6.2',versionName:'4.8.6 test 2',proprietaire:'autre'}),b=background({shadow:shadowHarness(),executeScript:t.executeScript});
  await assert.rejects(b.api('connect',{tabId:1}),/Une autre Ariane \(4\.8\.6 test 2\) est active/);
  const p=page();assert.equal(p.ctx.__BANANE_V3_PAGE.versionName,'4.8.6');assert.equal((await p.call('ping')).versionName,'4.8.6');
});
test('tampon d’une autre Ariane déjà posé (connexion simultanée) : refus, rien d’injecté, son tampon gardé',async()=>{
  const t=onglet(null,{id:'autre',version:'4.8.6.1',versionName:'4.8.6 test 1'}),b=background({shadow:shadowHarness(),executeScript:t.executeScript});
  await assert.rejects(b.api('connect',{tabId:1}),/Une autre Ariane \(4\.8\.6 test 1\) est active/);
  assert.equal(t.injecte.filter(o=>o.files).length,0);assert.equal(t.fenetre.__ARIANE_PROPRIETAIRE.id,'autre');
});
test('course : notre adaptateur installé avec le tampon d’une autre Ariane refuse notre ping en la nommant ; refus définitif',async()=>{
  const p=page({proprietaire:'autre',tampon:{versionName:'4.8.6 test 2'}});
  await assert.rejects(p.call('ping'),e=>/^Une autre Ariane \(4\.8\.6 test 2\)/.test(e.message));
  const src=fs.readFileSync(path.join(root,'background.js'),'utf8');
  assert.ok(src.includes("callSur(tabId,'ping').catch(e=>{throw /^Une autre Ariane/.test(e?.message||'')?definitif(e.message):e;})"),'le ping refusé arrête la reconnexion');
});
test('notre propre tampon resté seul (injection interrompue) : la connexion repart',async()=>{
  const t=onglet(null,{id:'test',version:K.VERSION}),b=background({shadow:shadowHarness(),executeScript:t.executeScript});
  await b.api('connect',{tabId:1});assert.ok(t.injecte.some(o=>o.files?.includes('src/adapter-page.js')));
});

test('garde D2 × fin de partie D3 : le dernier cut refusé reste compté parmi les différés, motif compris',async()=>{
  const {r}=await dernierDiffere();
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  const view=await r.b.api('resume');
  assert.equal(view.batch.deferred.some(x=>x.cut===100),false,'exports inchangés : le moteur n’a pas confirmé ce différé');
  assert.equal(view.batch.lotCommands[100].reason,'first-pass-low-gauge');
  const {$}=await panneau(view);assert.match($('lot-compteurs').innerHTML,/refusés \(écartement bas\) : 100/);
  assert.match($('lot-compteurs').innerHTML,/Différés[^]*>1</,'compté parmi les différés du panneau');
});
test('« écartement bas » seulement si le cut a vraiment été différé par la commande du lot',async()=>{
  const id=cut=>({pageId:'p',part:11,cut,shape:'U50',frameId:'f'});
  const vue=action=>({current:{identity:id(712)},batch:{state:'RUNNING',scope:{part:11,start:700,end:999999,endMode:'partie',geometryEngine:'geometry-candidate-v1'},
    processed:[{cut:706}],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],sequence:[706,707,712].map(c=>({cut:c})),activeIdentity:id(712),
    deferred:[{identity:id(707),deferredAt:'2026-09-29T08:00:00Z'}],lotCommands:{707:{cut:707,stage:'deferred',reason:'first-pass-low-gauge',...(action?{action}:{})}}}});
  assert.match((await panneau(vue('defer'))).$('lot-compteurs').innerHTML,/écartement bas/);
  assert.doesNotMatch((await panneau(vue('engine'))).$('lot-compteurs').innerHTML,/écartement bas/,'le moteur a gardé la main : autre cause');
  assert.doesNotMatch((await panneau(vue(null))).$('lot-compteurs').innerHTML,/écartement bas/,'commande jamais émise');
});

test('nom de version : une seule valeur, celle du manifeste, partout où il est écrit (stable : aucun nom de test)',()=>{
  const nom=manifest.version_name||manifest.version;assert.equal(K.VERSION_NAME,nom);
  for(const f of ['panel.html','panel.js','src/bridge.js','background.js']){
    const s=fs.readFileSync(path.join(root,f),'utf8'),tests=[...s.matchAll(/\d+\.\d+\.\d+ test \d+/g)].map(m=>m[0]);
    if(manifest.version_name)for(const v of tests)assert.equal(v,nom,`${f} : « ${v} »`);
    else assert.deepEqual(tests,[],`${f} : nom de test dans une stable`);
    assert.ok(s.includes(nom),`${f} : ${nom}`);}
});

test('panneau : « fin de partie probable » vient du service worker (une seule règle)',async()=>{
  const {r,view}=await dernierDiffere();assert.equal(view.finDePartieProbable,true);
  const avec=await panneau(view);assert.equal(avec.$('resume').hidden,false);
  const sans=await panneau({...view,finDePartieProbable:false});assert.equal(sans.$('resume').hidden,true);
  assert.doesNotMatch(sans.$('notice').textContent,/fin de partie probable/);
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',cut:100});await r.b.api('resume').catch(()=>{});
  assert.equal((await r.b.api('view')).finDePartieProbable,false,'preuve refusée : plus proposé');
});
