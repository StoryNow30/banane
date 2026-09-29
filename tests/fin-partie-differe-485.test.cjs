'use strict';
/* D3 (4.8.5, KI-067, D-060) — fin de partie après un différé. Terrain du 28/09,
 * partie 15 : le « suivant sans décision » envoyé depuis le dernier cut (9056,
 * sans point LiDAR) fait quitter la page à ESV ; le moteur (épinglé) le lit
 * comme une navigation sans progression et met le lot en pause. Dans un lot
 * « jusqu'à la fin de la partie », sur un cut sans pose : pause avec un message
 * clair ; à la reprise, une AUTRE partie affichée après cette navigation
 * prouve la fin (lot clos, fin retenue). Aucune commande n'est renvoyée. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js');
const {pilote}=require('./helpers/pilote-lot.cjs');
const BFCACHE='The page keeping the extension port is moved into back/forward cache, so the message channel is closed.';
/* Décision factice : le cut est refusé (différé), comme un cut sans point LiDAR. */
const differe={...L,decideCut:()=>({version:'lot-decision-v7',stage:'deferred',reason:'first-pass-low-gauge',gaugeMm:1405,lowGaugeGuardMm:1420,guardMm:null,anchorsUsed:[],anchor:false})};
/* ESV quitte la page au « suivant sans décision ». */
const quitte=esv=>{esv.nextWithoutDecision=async function(){this.calls.push('nextWithoutDecision');throw Error(BFCACHE);};};
const navs=r=>r.b.adapter.calls.filter(c=>c==='nextWithoutDecision').length;
async function dernierDiffere(options={}){const r=await pilote(differe,{start:100,end:0,endMode:'partie',esv:quitte,...options});return {r,view:await r.b.settle()};}

test('dernier différé, ESV quitte la page : pause, message clair, aucune commande renvoyée',async()=>{
  const {r,view}=await dernierDiffere();
  assert.equal(view.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');
  assert.match(view.notice,/ESV a quitté la page après le différé du cut 100 ; fin de partie probable : clique sur Reprendre \(F5 seulement si ESV reste figée\)/);
  assert.equal(navs(r),1,'une seule navigation');assert.equal(await r.b.api('bornes-partie',{part:23}),null,'aucune fin affirmée sans preuve');
  assert.equal((await r.b.api('view')).batch.departApresDiffere.cut,100,'le panneau reçoit le départ');
});
test('reprise sur une autre partie après ce différé : lot clos, fin de partie retenue, rien renvoyé',async()=>{
  const {r}=await dernierDiffere();
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  const view=await r.b.api('resume');
  assert.equal(view.batch.state,'STOPPED');assert.match(view.notice,/Fin du lot : ESV a quitté la partie après le cut 100/);
  assert.equal(view.batch.stoppedAtEnd.cut,100);assert.equal(view.batch.stoppedAtEnd.reason,'navigation-other-part-after-defer');
  const f=await r.b.api('bornes-partie',{part:23});assert.equal(f.last,100);assert.equal(f.source,'fin constatée après différé');
  assert.equal(navs(r),1,'aucune navigation renvoyée');assert.equal(r.b.adapter.calls.filter(c=>c==='capture').length,1,'aucune capture dans la partie 24');
  assert.ok(r.b.store.events.some(e=>e.type==='defer-intent-closed'),'intention clôturée, sans renvoi');
});
test('reprise sur la MÊME partie : pas de preuve de fin, la pause reste, rien renvoyé',async()=>{
  const {r}=await dernierDiffere();
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',cut:100});
  await assert.rejects(r.b.api('resume'),/ESV affiche encore la partie 23 : pas de fin de partie[^]*clôture ce résultat incertain/);
  const view=await r.b.api('view');assert.equal(view.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');
  assert.equal(view.batch.departApresDiffere,undefined,'plus de « fin de partie probable » : la marche à suivre redevient la clôture');
  assert.equal(await r.b.api('bornes-partie',{part:23}),null);assert.equal(navs(r),1);
});
test('lot borné : comportement de la 4.8.0 (incertitude réelle, pas de fin de partie)',async()=>{
  const r=await pilote(differe,{start:100,end:105,esv:quitte});const view=await r.b.settle();
  assert.equal(view.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');assert.doesNotMatch(view.notice,/fin de partie probable/);
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  await assert.rejects(r.b.api('resume'));
  assert.notEqual((await r.b.api('bornes-partie',{part:23}))?.source,'fin constatée après différé','la borne saisie du lot reste, aucune fin constatée');
});
test('autre partie ouverte à la main au milieu d’un cut (sans ce différé) : arrêt de protection, aucune fin retenue',async()=>{
  const r=await pilote(L,{start:100,end:0,endMode:'partie',esv:esv=>{const c=esv.capture.bind(esv);
    esv.capture=async(...a)=>{const out=await c(...a);esv.identity.part=24;esv.identity.cut=7;return out;};}});
  const view=await r.b.settle();
  assert.equal(view.batch.state,'STOPPED');assert.equal(await r.b.api('bornes-partie',{part:23}),null,'rien affirmé sur la fin');
});
test('onglet sorti d’ESV pendant une lecture : erreur reprenable, comme une page absente',async()=>{
  const {background,shadowHarness}=require('./helpers/background-harness.cjs');
  const b=background({shadow:shadowHarness()});await b.api('connect',{tabId:1});
  b.fonction('chrome').tabs.get=async id=>({id,url:'https://www.example.org/'});
  await assert.rejects(b.fonction('callSur')(1,'state'),e=>e.code==='ESV_PAGE_ABSENTE'&&/n’affiche plus ESV/.test(e.message));
});
/* Panneau : « Reprendre » est proposé dans ce cas (seulement), avec la marche à suivre. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',onclick:null,oninput:null,
  attrs:{},style:{},classList:{toggle(){},add(){}},dataset:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},
  replaceChildren(){},append(el){this.enfants=(this.enfants||[]).concat(el);},addEventListener(){},querySelectorAll:()=>[],set onchange(_){}});
async function panneau(state){const elements=new Map(),crees=[];
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:()=>{const e=element();crees.push(e);return e;},
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),sendMessage:async({action})=>({result:action==='view'?state:action==='list-tabs'?[]:{}})}};
  const context={document,chrome,location:{hash:'#automatic'},addEventListener:()=>{},setInterval:()=>{},setTimeout:()=>{},clearTimeout:()=>{},console,Date,
    matchMedia:()=>({matches:true,addEventListener(){}}),requestAnimationFrame:()=>{}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8'),context);
  for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));return {$:id=>document.getElementById(id),textes:()=>crees.map(e=>e.textContent).join(' | ')};}
const vueLot=(extra,autre={})=>({current:{identity:{pageId:'p',part:15,cut:9056,shape:'U50',frameId:'f'}},deferIntent:{identity:{part:15,cut:9056},operationId:'op-9056',phase:'COMMAND_MAY_HAVE_BEEN_SENT',commandInvoked:'unknown'},...autre,
  batch:{state:'PAUSED_DEFER_NAVIGATION_UNCERTAIN',scope:{part:15,start:106,end:999999,endMode:'partie',geometryEngine:'geometry-candidate-v1'},
    processed:[],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],deferred:[],sequence:[],activeIdentity:{part:15,cut:9056},...extra}});
test('panneau : après le départ d’ESV au différé, « Reprendre » est proposé et la marche à suivre est dite',async()=>{
  const {$,textes}=await panneau(vueLot({departApresDiffere:{part:15,cut:9056,operationId:'op-9056',at:'t'}}));
  assert.equal($('resume').hidden,false);assert.match($('notice').textContent,/fin de partie probable : clique sur Reprendre/);
  const sans=await panneau(vueLot({}));assert.equal(sans.$('resume').hidden,true,'navigation incertaine ordinaire : pas de reprise');
});

/* Revue dédiée de D3 (29/09). */
test('revue : erreur AVANT l’envoi (onglet fermé, autre partie ouverte à la main) : pas un départ, aucune fin affirmée',async()=>{
  const avant=esv=>{esv.nextWithoutDecision=async function(){this.calls.push('nextWithoutDecision');throw Error('Could not establish connection. Receiving end does not exist.');};};
  const r=await pilote(differe,{start:100,end:0,endMode:'partie',esv:avant});const view=await r.b.settle();
  assert.doesNotMatch(view.notice||'',/fin de partie probable/);assert.equal(view.batch.departApresDiffere,undefined);
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  await assert.rejects(r.b.api('resume'));assert.equal(await r.b.api('bornes-partie',{part:23}),null);
});
test('revue : ESV annonce une autre partie sans quitter la page : même preuve, même clôture',async()=>{
  const annonce=esv=>{const n=esv.nextWithoutDecision.bind(esv);esv.nextWithoutDecision=async(...a)=>{Object.assign(esv.identity,{part:24,cut:1});const e=await n(...a);
    return {...e,navigationObserved:true,nextIdentity:{...esv.identity},navigationAfter:{identity:{...esv.identity}}};};};
  const r=await pilote(differe,{start:100,end:0,endMode:'partie',esv:annonce});const view=await r.b.settle();
  assert.equal(view.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');assert.match(view.notice,/fin de partie probable/);
  const fin=await r.b.api('resume');assert.equal(fin.batch.state,'STOPPED');assert.equal((await r.b.api('bornes-partie',{part:23})).last,100);
});
test('revue : clôture propre (erreur effacée, interruption nommée) et fin connue plus loin jamais abaissée',async()=>{
  const {r}=await dernierDiffere();
  await r.b.fonction('retenirFinPartie')(23,9100,'fin constatée');
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  const view=await r.b.api('resume');
  assert.equal(view.batch.error,null,'plus d’erreur de navigation sur un lot clos proprement');
  assert.equal(view.batch.interrupted.at(-1).status,'DEFER_NAVIGATION_CLOSED_END_OF_PART');
  assert.equal((await r.b.api('bornes-partie',{part:23})).last,9100,'une fin plus loin, déjà connue, reste');
  const {$}=await panneau(view);assert.match($('batch').textContent,/lot clos après le cut 100 : ESV a quitté la partie après le différé/);
  assert.doesNotMatch($('batch').textContent,/Navigation sans décision transmise/);
});
test('revue : marque d’une autre intention (résultat clôturé, nouveau différé) : pas de « fin de partie probable »',async()=>{
  const {$}=await panneau(vueLot({departApresDiffere:{part:15,cut:9000,operationId:'op-ancienne',at:'t'}}));
  assert.equal($('resume').hidden,true);assert.doesNotMatch($('notice').textContent,/fin de partie probable/);
});
test('revue : ESV indisponible (page quittée) : la marche à suivre reste affichée, Reprendre en premier',async()=>{
  const {$}=await panneau(vueLot({departApresDiffere:{part:15,cut:9056,operationId:'op-9056',at:'t'}},{connection:{status:'unavailable',message:'Adaptateur ESV sans réponse : page ESV rechargée ou fermée.'}}));
  assert.match($('notice').textContent,/fin de partie probable/);assert.equal($('resume').hidden,false);
});
test('revue : un résultat incertain d’une pose reste à clôturer à la main : pas de clôture automatique',async()=>{
  const {r}=await dernierDiffere();r.b.fonction('engine').s.reconcileRequired=true;
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  await assert.rejects(r.b.api('resume'),/résultat incertain/);assert.equal(await r.b.api('bornes-partie',{part:23}),null);
});
test('revue 2 : partie ANTÉRIEURE affichée à la reprise (ouverte à la main) : pas de preuve, rien retenu',async()=>{
  const {r}=await dernierDiffere();
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:22,cut:5});
  await assert.rejects(r.b.api('resume'),/partie 22[^]*pas une preuve de fin/);
  assert.equal((await r.b.api('view')).batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');assert.equal(await r.b.api('bornes-partie',{part:23}),null);
});
test('revue 2 : canal fermé sans départ de page (« message port closed ») : pas de fin de partie probable',async()=>{
  const port=esv=>{esv.nextWithoutDecision=async function(){this.calls.push('nextWithoutDecision');throw Error('The message port closed before a response was received.');};};
  const r=await pilote(differe,{start:100,end:0,endMode:'partie',esv:port});const view=await r.b.settle();
  assert.equal(view.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');assert.equal(view.batch.departApresDiffere,undefined);
});
test('revue 2 : action encore en cours, ou intention de pose ouverte : pas de clôture',async()=>{
  const {r}=await dernierDiffere();const e=r.b.fonction('engine');
  Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
  e.task=Promise.resolve();await assert.rejects(r.b.api('resume'),/Attends la fin de l’action en cours/);e.task=null;
  e.s.intent={identity:{part:23,cut:100}};await assert.rejects(r.b.api('resume'),/résultat incertain/);
  assert.equal(await r.b.api('bornes-partie',{part:23}),null);
});
