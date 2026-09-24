const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {MemoryStore,SimulatedESV}=require('./fixtures.cjs');
function background({shadow,adapter=new SimulatedESV(),store=new MemoryStore(),globals={}}={}){store.all=async n=>n==='clouds'?[...store.clouds.values()]:store[n];store.keys=async()=>[...store.clouds.keys()];let onMessage,onConnect,click,onWindowRemoved,onTabRemoved;const opened=[],injected=[],panelTabs=[],launcherMessages=[];
 const ctx={URL,console,importScripts:()=>{},BananeEngine3:require('../src/engine.js'),BananeManualSession4:require('../src/manual-session.js'),BananeNativeSession4:require('../src/native-session.js'),BananeGCV1Export:require('../src/gcv1-export.js'),BananeStorage3:class{constructor(){return store;}},BananeGeometryBrain:require('../src/geometry-brain.js'),
  BananeGCV1Shadow:shadow,...globals,
  chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>onMessage=f},onConnect:{addListener:f=>onConnect=f}},
   action:{onClicked:{addListener:f=>click=f}},storage:{local:{get:async()=>({}),set:async()=>{}}},
   tabs:{get:async id=>({id,url:'https://esv.lidar.altametris.xyz/rails_validation/test'}),query:async({url}={})=>!url?[{id:1,url:'https://esv.lidar.altametris.xyz/rails_validation/test',title:'ESV TEST'},...panelTabs]:
     Array.isArray(url)?[]:url.startsWith('chrome-extension:')?[]:[{id:1,title:'ESV TEST'}],
    sendMessage:async(id,m)=>m.kind==='launcher-visibility'?launcherMessages.push(m):({result:await adapter[m.action](...m.args)}),
    onRemoved:{addListener:fn=>onTabRemoved=fn}},
   scripting:{executeScript:async options=>injected.push(options)},windows:{create:async o=>{opened.push(o);panelTabs.push({id:opened.length+20,url:o.url,windowId:opened.length});return {id:opened.length};},
    update:async()=>{},onRemoved:{addListener:fn=>onWindowRemoved=fn}}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),ctx);
 const sender={id:'test',url:'chrome-extension://test/panel.html',tab:{id:20}};
 const message=(m,from=sender)=>new Promise(resolve=>{const ret=onMessage(m,from,resolve);if(ret!==true)resolve(undefined);});
 const api=async(action,args={})=>{const r=await message({kind:'panel',action,args});if(r.error)throw Error(r.error);return r.result;};
 return {adapter,store,api,message,click,opened,injected,launcherMessages,shadow,
  connectPanel:(url='chrome-extension://test/panel.html',windowId=99,tabId=199)=>{let disconnected;
   // V4.5.4 : le service worker demande un changement de vue par le port ;
   // le banc doit pouvoir l'observer pour vérifier qu'aucune fenêtre n'est ouverte en double.
   const posted=[];
   const port={name:'banane-panel-presence',sender:{id:'test',url,tab:{id:tabId,windowId}},
     postMessage:m=>posted.push(m),onDisconnect:{addListener:f=>disconnected=f}};
   onConnect(port);return {posted,disconnect:async()=>{disconnected();await new Promise(resolve=>setImmediate(resolve));}};},
 closeWindow:async id=>{const index=panelTabs.findIndex(tab=>tab.windowId===id);
   if(index>=0){const [tab]=panelTabs.splice(index,1);onTabRemoved?.(tab.id);}
   onWindowRemoved?.(id);await new Promise(resolve=>setImmediate(resolve));}};
}
function shadowHarness({fallback=false,pilotFailure=false,contractHash='candidate-hash'}={}){let enabled=false,activeAssistedEnabled=false,armed=false,last=null;
 const calls={arm:0,disarm:0,consume:0};
 return {calls,
  configure(options={}){if(Object.hasOwn(options,'enabled'))enabled=options.enabled;if(Object.hasOwn(options,'activeAssisted'))activeAssistedEnabled=options.activeAssisted;return this.state();},
  state:()=>({enabled,activeAssistedEnabled,selector:armed||'shadow',contract:{id:'GEOMETRY_CANDIDATE_V1',geometrySha256:contractHash}}),journal:()=>last,
  armOnce(selector){assert.ok(['active-assisted','active-pilot-test'].includes(selector));if(selector==='active-assisted')assert.equal(activeAssistedEnabled,true);assert.equal(armed,false);armed=selector;calls.arm++;
   last={contract:{id:'GEOMETRY_CANDIDATE_V1',geometrySha256:contractHash},selection:{selector,
     requestedEngine:'geometry-candidate-v1',selectedEngine:pilotFailure?null:fallback?'v4.6':'geometry-candidate-v1',fallback:pilotFailure?false:fallback,
     fallbackReason:fallback?'candidate-test-failure':null},comparison:{v46:{},gcv1:fallback?null:{},selectedEngine:fallback?'v4.6':'geometry-candidate-v1',fallback}};},
  disarm(){armed=false;calls.disarm++;return this.state();},
  consumeLast(){calls.consume++;const out=last;last=null;return out;},
 };
}
test('the ESV launch button hides while any Banane window remains and returns after the last closes',async()=>{
 const b=background(),sender={id:'test',url:'https://esv.lidar.altametris.xyz/rails_validation/test',tab:{id:1}},status=()=>b.message({kind:'launcher-status'},sender);
 assert.equal((await status()).visible,true);await b.api('open-window',{window:'native'});assert.equal((await status()).visible,false);
 assert.equal(b.launcherMessages.at(-1).visible,false);
 // V4.5.4 : demander une autre vue ne crée plus de seconde fenêtre, donc
 // fermer l'unique fenêtre suffit à faire revenir la pastille.
 await b.api('open-window',{window:'automatic'});
 await b.closeWindow(1);assert.equal((await status()).visible,true);
 assert.equal(b.launcherMessages.at(-1).visible,true);
 assert.equal(await b.message({kind:'launcher-status'},{id:'test',url:'https://example.org/',tab:{id:8}}),undefined);
});
test('window presence still works when extension URL tab filters return no matches',async()=>{
 const b=background(),sender={id:'test',tab:{id:1,url:'https://esv.lidar.altametris.xyz/rails_validation/test'}};
 await b.click();assert.equal((await b.message({kind:'launcher-status'},sender)).visible,false);
 assert.equal(b.launcherMessages.at(-1).visible,false);
 const port=b.connectPanel('chrome-extension://test/panel.html',1,21);
 await b.closeWindow(1);assert.equal((await b.message({kind:'launcher-status'},sender)).visible,true);
 await port.disconnect();assert.equal((await b.message({kind:'launcher-status'},sender)).visible,true);
});
test('panel registration alone restores visibility state after a service worker restart',async()=>{
 const b=background(),sender={id:'test',url:'https://esv.lidar.altametris.xyz/rails_validation/test',tab:{id:1}};
 const port=b.connectPanel('chrome-extension://test/panel.html#native',15,28);
 assert.equal((await b.message({kind:'launcher-status'},sender)).visible,false);
 await port.disconnect();assert.equal((await b.message({kind:'launcher-status'},sender)).visible,false);
 await b.closeWindow(15);assert.equal((await b.message({kind:'launcher-status'},sender)).visible,true);
});
test('dedicated panel accepts an extension-tab sender; website and foreign senders cannot issue commands',async()=>{
 const b=background();assert.equal((await b.api('list-tabs')).length,1);
 assert.equal(await b.message({kind:'panel',action:'before'},{id:'test',url:'https://esv.lidar.altametris.xyz/rails_validation/test',tab:{id:1}}),undefined);
 assert.equal(await b.message({kind:'panel',action:'before'},{id:'other',url:'chrome-extension://test/panel.html'}),undefined);
 await b.click();assert.equal(b.opened[0].type,'popup');assert.equal(b.opened[0].url,'chrome-extension://test/panel.html#home');
});
test('production background routes capture and persists exports with clouds separate from journal',async()=>{
 const b=background();await b.api('connect',{tabId:1});assert.equal(b.injected[0].world,'MAIN');
 await b.api('before');await b.api('after');const journal=await b.api('journal'),data=await b.api('dataset');
 assert.equal(journal.records.length,1);assert.equal(journal.clouds,undefined);assert.equal(data.cloudIds.length,1);assert.equal(data.records.length,1);
 assert.ok((await b.api('cloud',{id:data.cloudIds[0]})).pointsSceneRelative.length);
 const invalid=await b.api('view');await assert.rejects(()=>b.api('settings',{mode:'assisted',searchY:-1}),/Paramètre invalide/);
 assert.equal((await b.api('view')).mode,invalid.mode);
});
test('panel polling returns immediately, allows only one pending observation, and preserves the original batch error',async()=>{
 const b=background();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 await assert.rejects(()=>b.api('start',{part:23,start:100,end:100,testConfirmed:true,lowConfidence:'attempt',allowNavigationEvidence:false}),/Avant de lancer/);
 let calls=0,reject;b.adapter.state=()=>{calls++;return new Promise((resolve,r)=>{reject=r;});};
 const views=await Promise.all([b.api('view'),b.api('view'),b.api('view')]);assert.equal(calls,1);assert.ok(views.every(v=>v.notice.includes('Avant de lancer')));
 reject(Error('Timeout ESV'));await new Promise(r=>setImmediate(r));b.adapter.state=async()=>{throw Error('Adaptateur absent');};
 const after=await b.api('view');assert.match(after.notice,/Avant de lancer/);assert.equal(after.connection.status,'unavailable');
});
/* V4.5.4 — une seule fenêtre. Avant, chaque vue était une page distincte et
 * ouvrir le Natif depuis l'accueil laissait deux popups empilées ; la reprise
 * manuelle en ouvrait une troisième. Le contrat est maintenant plus strict :
 * quelle que soit la suite de demandes, il n'existe jamais qu'une fenêtre. */
test('toutes les vues vivent dans une seule fenêtre, jamais une seconde',async()=>{
 const b=background();
 await b.api('open-window',{window:'native'});
 assert.equal(b.opened.length,1,'la première demande ouvre la fenêtre');
 assert.equal(b.opened[0].url,'chrome-extension://test/panel.html#native');
 for(const which of ['automatic','assisted','home','native'])await b.api('open-window',{window:which});
 assert.equal(b.opened.length,1,'aucune fenêtre supplémentaire, même après quatre demandes');
 await assert.rejects(()=>b.api('open-window',{window:'https://example.org'}),/inconnue/);
 await assert.rejects(()=>b.api('open-window',{window:'corrections'}),/inconnue/,
   'le mode Correction est retiré');
});
test('la fenêtre ouverte reçoit la vue demandée au lieu d’être dupliquée',async()=>{
 const b=background();
 const port=b.connectPanel('chrome-extension://test/panel.html#home',7,70);
 await b.api('open-window',{window:'automatic'});
 assert.equal(b.opened.length,0,'une fenêtre déjà présente est réutilisée');
 // Le port naît dans le contexte VM : comparer les champs, pas les prototypes.
 const dernier=port.posted?.at(-1);
 assert.equal(dernier?.kind,'navigate','la fenêtre existante est priée de changer de vue');
 assert.equal(dernier?.view,'automatic');
});
/* V4.5.4 — le mode Correction est retiré. Le test vérifie qu'il l'est
 * réellement, à la fois côté commandes et côté injection dans la page : une
 * suppression qui laisserait le code injecté ne serait pas une suppression.
 * La récupération d'une session enregistrée AVANT la mise à jour reste
 * ouverte : retirer un mode ne doit pas rendre ses données illisibles. */
test('le mode Correction est retiré, mais ses données restent récupérables',async()=>{
 const b=background();await b.api('connect',{tabId:1});
 for(const action of ['manual-start','manual-pause','manual-resume'])
  await assert.rejects(()=>b.api(action),/retiré en 4\.5\.4/,action+' doit être refusé');
 const injecte=b.injected.find(i=>i.world==='MAIN')?.files||[];
 assert.ok(!injecte.some(f=>f.includes('manual-page')),
  'manual-page.js ne doit plus être injecté dans la page ESV');
 assert.ok(injecte.includes('src/native-page.js'),'la collecte Natif reste injectée');
 // Les chemins de récupération répondent encore : sans session enregistrée ils
 // le disent clairement, au lieu du refus « mode retiré ».
 for(const action of ['manual-download','manual-end'])
  await assert.rejects(()=>b.api(action),/Aucune session/,
   action+' doit rester disponible pour récupérer une session antérieure');
});
/* V4.6.0, revue Astra. La réciproque du test suivant : un lot en reprise
 * manuelle est un LOT ACTIF, et le service worker le garantit lui-même. Ni un
 * nouveau lot, ni le mode Natif ne prennent sa place — quoi que l'interface
 * affiche, puisqu'un appel direct au service worker contourne l'interface. */
test('a manual takeover holds the batch context against a new batch or native mode',async()=>{
 const b=background();await b.api('connect',{tabId:1});b.adapter.noPoints=true;
 await b.api('settings',{mode:'automatic-test'});
 const depart=(await b.api('view')).current.identity;
 await b.api('start',{part:depart.part,start:depart.cut,end:depart.cut+1,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});
 // Le lot tourne en tâche de fond : on attend la pause sur rail non résolu.
 let vue;for(let i=0;i<400&&(vue=await b.api('view')).batch?.state!=='PAUSED_UNRESOLVED_RAIL';i++)await new Promise(r=>setImmediate(r));
 assert.equal(vue.batch.state,'PAUSED_UNRESOLVED_RAIL');
 await b.api('manual-takeover');assert.equal((await b.api('view')).batch.state,'MANUAL_TAKEOVER');
 await assert.rejects(()=>b.api('native-start'),/Reprise manuelle en cours/);
 await assert.rejects(()=>b.api('start',{part:depart.part,start:depart.cut,end:depart.cut+1,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'}),/Reprise manuelle en cours/);
 assert.equal(b.adapter.calls.includes('nativeStart'),false);
 assert.equal((await b.api('view')).batch.state,'MANUAL_TAKEOVER','le contexte du lot est intact');
 // Arrêter reste la sortie disponible, côté service worker aussi.
 await b.api('stop');assert.equal((await b.api('view')).batch.state,'STOPPED');
});
test('native mode excludes corrections and pilot commands while remaining command-free',async()=>{
 const b=background();await b.api('connect',{tabId:1});await b.api('native-start');
 await assert.rejects(()=>b.api('manual-start'),/mode Natif/);await assert.rejects(()=>b.api('settings',{mode:'automatic-test'}),/mode Natif/);
 assert.ok(b.adapter.calls.includes('nativeStart'));assert.equal(b.adapter.calls.some(x=>['apply','next','validate','skip'].includes(x)),false);
 await b.api('native-pause');await b.api('native-resume');const data=await b.api('native-end');assert.equal(data.format,'banane-native-session-end-v1');assert.equal(data.status,'FINISHED');
 assert.ok(JSON.stringify(data).length<4096,'la fin de session ne renvoie qu’un résumé, jamais la session entière');
 assert.deepEqual(b.adapter.calls.filter(x=>x.startsWith('native')),['nativeStart','nativePause','nativeResume','nativeFinish']);
});

test('background arms GCV1 for one assisted analysis and persists proposal provenance with its proposalId',async()=>{
 const shadow=shadowHarness(),b=background({shadow});await b.api('connect',{tabId:1});
 await b.api('gcv1-shadow-configure',{activeAssisted:true});await b.api('settings',{mode:'assisted'});
 const proposal=await b.api('analyze');
 assert.equal(shadow.calls.arm,1);assert.equal(shadow.calls.disarm,1);assert.equal(shadow.state().selector,'shadow');
 assert.equal(proposal.geometryEngine,'geometry-candidate-v1');assert.equal(proposal.geometrySelection.fallback,false);
 assert.equal(proposal.geometrySelection.contractId,'GEOMETRY_CANDIDATE_V1');
 const event=b.store.events.find(e=>e.type==='gcv1-shadow-observed');assert.ok(event);
 assert.equal(event.proposalId,proposal.id);assert.equal(event.shadow.selection.selectedEngine,'geometry-candidate-v1');
 assert.equal(b.store.state.proposal.id,proposal.id);assert.equal(b.store.state.proposal.geometryEngine,'geometry-candidate-v1');
});

test('manual GCV1 export actions reuse the persisted observation and LiDAR without adapter traffic',async()=>{
 const shadow=shadowHarness(),b=background({shadow});await b.api('connect',{tabId:1});
 await b.api('gcv1-shadow-configure',{activeAssisted:true});await b.api('settings',{mode:'assisted'});
 const proposal=await b.api('analyze'),observed=b.store.events.find(e=>e.type==='gcv1-shadow-observed');
 const calls=b.adapter.calls.slice(),diagnostic=await b.api('gcv1-diagnostic-export');
 assert.equal(diagnostic.observationCount,1);assert.equal(diagnostic.observations[0].proposalId,proposal.id);
 assert.equal(diagnostic.observations[0].sessionId,observed.sessionId);
 assert.equal(diagnostic.observations[0].lidar.captureId,observed.lidarCaptureId);
 const corpus=await b.api('gcv1-corpus-export-plan');
 assert.deepEqual(corpus.cloudIds,[observed.lidarCaptureId]);assert.deepEqual(corpus.missingCaptureIds,[]);
 assert.deepEqual(b.adapter.calls,calls,'exports never call ESV');
});

test('background persists an explicit atomic fallback on the existing V4.6 proposal',async()=>{
 const shadow=shadowHarness({fallback:true}),b=background({shadow});await b.api('connect',{tabId:1});
 await b.api('gcv1-shadow-configure',{activeAssisted:true});await b.api('settings',{mode:'assisted'});
 const proposal=await b.api('analyze'),event=b.store.events.find(e=>e.type==='gcv1-shadow-observed');
 assert.equal(proposal.geometryEngine,'v4.6');assert.equal(proposal.geometrySelection.fallback,true);
 assert.match(proposal.geometrySelection.fallbackReason,/candidate-test-failure/);
 assert.equal(event.proposalId,proposal.id);assert.equal(event.shadow.selection.fallback,true);
});

test('automatic-test remains V4.6 unless its batch scope explicitly selects GCV1; Native never arms it',async()=>{
 const shadow=shadowHarness(),b=background({shadow});await b.api('connect',{tabId:1});
 await b.api('gcv1-shadow-configure',{activeAssisted:true});await b.api('settings',{mode:'automatic-test'});await b.api('analyze');
 assert.equal(shadow.calls.arm,0,'automatic analysis stays on V4.6');assert.equal(shadow.calls.consume,1);
 const nativeShadow=shadowHarness(),n=background({shadow:nativeShadow});await n.api('connect',{tabId:1});
 await n.api('gcv1-shadow-configure',{activeAssisted:true});await n.api('native-start');
 await assert.rejects(()=>n.api('analyze'),/mode Natif/);assert.equal(nativeShadow.calls.arm,0);
 await n.api('native-end');
});

test('a GCV1 pilot batch persists its engine contract, selects it once per analysis, and applies a candidate',async()=>{
 const shadow=shadowHarness(),b=background({shadow});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const apply=b.adapter.apply.bind(b.adapter);let releaseApply;
 b.adapter.apply=(...args)=>new Promise((resolve,reject)=>{releaseApply=()=>apply(...args).then(resolve,reject);});
 await b.api('start',{part:23,start:100,end:100,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'pause',geometryEngine:'geometry-candidate-v1'});
 while(!releaseApply)await new Promise(r=>setImmediate(r));
 const pending=await b.api('view');assert.equal(pending.proposal.geometryEngine,'geometry-candidate-v1');
 assert.equal(pending.proposal.geometrySelection.selector,'active-pilot-test');assert.equal(pending.proposal.geometrySelection.fallback,false);
 releaseApply();
 while(!['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','ERROR'].includes((await b.api('view')).batch?.state))await new Promise(r=>setImmediate(r));
 const view=await b.api('view'),started=b.store.events.find(e=>e.type==='batch-started'),observed=b.store.events.find(e=>e.type==='gcv1-shadow-observed');
 assert.equal(view.batch.scope.geometryEngine,'geometry-candidate-v1');assert.equal(view.batch.scope.geometryContract.geometrySha256,'candidate-hash');
 assert.equal(view.batch.scope.requestedLowConfidence,'pause');assert.equal(view.batch.scope.lowConfidence,'attempt');
 assert.equal(started.batch.scope.geometryEngine,'geometry-candidate-v1');assert.equal(observed.shadow.selection.selector,'active-pilot-test');
 assert.equal(observed.shadow.selection.selectedEngine,'geometry-candidate-v1');assert.equal(shadow.calls.arm,1);assert.equal(shadow.calls.disarm,1);
 assert.equal(b.adapter.calls.filter(x=>x==='apply').length,1);assert.equal(b.adapter.calls.includes('skip'),false);
});

test('a GCV1 pilot technical error clears the V4.6 proposal and stops before apply',async()=>{
 const b=background({shadow:shadowHarness({pilotFailure:true})});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 await b.api('start',{part:23,start:100,end:100,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1'});
 while((await b.api('view')).batch?.state==='RUNNING')await new Promise(r=>setImmediate(r));
 const view=await b.api('view');assert.equal(view.batch.state,'ERROR');assert.match(view.batch.error.message,/GCV1 Pilote TEST/);
 assert.equal(view.proposal,null);assert.equal(b.adapter.calls.includes('apply'),false);assert.equal(b.adapter.calls.includes('skip'),false);
 assert.ok(b.store.events.some(e=>e.type==='gcv1-pilot-error'));
});

test('restart refuses a GCV1 batch whose persisted engine contract no longer matches',async()=>{
 const store=new MemoryStore(),first=background({shadow:shadowHarness(),store});await first.api('connect',{tabId:1});await first.api('settings',{mode:'automatic-test'});
 await first.api('start',{part:23,start:100,end:100,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1'});
 while((await first.api('view')).batch?.state==='RUNNING')await new Promise(r=>setImmediate(r));
 store.state.batch.state='PAUSED';store.state.batch.scope.geometryContract.geometrySha256='different-engine';
 const restarted=background({shadow:shadowHarness(),store});await assert.rejects(()=>restarted.api('resume'),/indisponible ou incohérent/);
 assert.equal((await restarted.api('view')).batch.scope.geometryEngine,'geometry-candidate-v1');
});

test('the automatic TEST UI names GCV1 explicitly in every pilot start command',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
 assert.match(src,/api\('start',[^;]*geometryEngine:'geometry-candidate-v1'/);
});

test('background disarms the selector in finally when assisted analysis fails',async()=>{
 const shadow=shadowHarness(),b=background({shadow});await b.api('connect',{tabId:1});
 await b.api('gcv1-shadow-configure',{activeAssisted:true});await b.api('settings',{mode:'assisted'});
 b.adapter.capture=async()=>{throw Error('capture-test-failure');};
 await assert.rejects(()=>b.api('analyze'),/capture-test-failure/);
 assert.equal(shadow.calls.arm,1);assert.equal(shadow.calls.disarm,1);assert.equal(shadow.state().selector,'shadow');
});

test('a new service worker facade starts with active-assisted disabled',async()=>{
 const first=shadowHarness(),b=background({shadow:first});await b.api('gcv1-shadow-configure',{activeAssisted:true});
 assert.equal((await b.api('gcv1-shadow-state')).activeAssistedEnabled,true);
 const restarted=background({shadow:shadowHarness()});
 assert.equal((await restarted.api('gcv1-shadow-state')).activeAssistedEnabled,false);
 assert.equal((await restarted.api('gcv1-shadow-state')).selector,'shadow');
});

/* L'ORDRE DE CHARGEMENT EST LA MÉCANIQUE ENTIÈRE.
 *
 * `src/engine.js` lie sa géométrie au chargement depuis globalThis. La
 * substitution ne tient que si `geometry-brain.js` se charge APRÈS
 * `geometry.js` et AVANT `engine.js`. Ce n'est pas vérifiable au runtime dans
 * ce banc Node — le moteur y est chargé par `require`, donc avec la géométrie
 * gelée directe — mais c'est vérifiable statiquement, et c'est ce qui compte :
 * une réorganisation de la liste casserait le branchement en silence. */
test('le cerveau se charge entre la géométrie gelée et le moteur',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
 const liste=src.match(/importScripts\(([^)]*)\)/s)[1];
 const rang=f=>liste.indexOf("'"+f+"'");
 for(const f of ['src/geometry.js','src/brain.js','src/geometry-brain.js','src/engine.js'])
  assert.ok(rang(f)>=0,'fichier absent de importScripts : '+f);
 assert.ok(rang('src/geometry.js')<rang('src/geometry-brain.js'),
  'la géométrie gelée doit être chargée avant la composition');
 assert.ok(rang('src/brain.js')<rang('src/geometry-brain.js'),
  'le cerveau doit être chargé avant la composition qui l’utilise');
 assert.ok(rang('src/geometry-brain.js')<rang('src/engine.js'),
  'la composition doit être en place AVANT que le moteur lie sa géométrie');
});
/* KI-048 : la décision sur le lot lie la géométrie GCV1 au chargement ; placée
 * après `gcv1-shadow.js`, elle recevait la façade V4.6, sans grille. */
test('la décision sur le lot se charge après la géométrie GCV1 et avant la composition',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
 const liste=src.match(/importScripts\(([^)]*)\)/s)[1],rang=f=>liste.indexOf("'"+f+"'");
 for(const f of ['src/geometry-candidate-v1.js','src/placement-convention.js','src/continuity-observer.js','src/lot-decision.js','src/gcv1-shadow.js'])
  assert.ok(rang(f)>=0,'fichier absent de importScripts : '+f);
 assert.ok(rang('src/geometry-candidate-v1.js')<rang('src/lot-decision.js')&&rang('src/lot-decision.js')<rang('src/gcv1-shadow.js'),
  'src/lot-decision.js doit être chargé entre geometry-candidate-v1.js et gcv1-shadow.js');
 assert.ok(rang('src/continuity-observer.js')<rang('src/lot-decision.js'),'la continuité doit précéder la décision sur le lot');
});
/* Même raison, autre dépendance : `src/engine.js` et `src/gcv1-shadow.js`
 * lisent tous deux le contrat d'écartement depuis globalThis au chargement, et
 * refusent de se construire sans lui (« contrat d'écartement absent »). Une
 * réorganisation de la liste qui placerait `gauge.js` après eux casserait le
 * chargement de l'extension en silence dans ce banc Node, où les deux modules
 * sont obtenus par `require`. Le contrôle est donc statique, comme pour le
 * cerveau. */
test('le contrat d’écartement se charge avant le moteur et avant la composition GCV1',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
 const liste=src.match(/importScripts\(([^)]*)\)/s)[1];
 const rang=f=>liste.indexOf("'"+f+"'");
 assert.ok(rang('src/gauge.js')>=0,'src/gauge.js absent de importScripts');
 for(const f of ['src/gcv1-shadow.js','src/engine.js'])
  assert.ok(rang('src/gauge.js')<rang(f),
   'src/gauge.js doit être chargé AVANT '+f+' qui en dépend au chargement');
});
test('la politique « attempt » coupe les sélections, sauf accord explicite',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
 assert.match(src,/lowConfidence==='attempt'/,'la politique doit être lue au démarrage');
 assert.match(src,/autoriserSelectionSansPause===true/,
  'le mode essai doit être un accord explicite, pas un défaut');
 assert.match(src,/configure\(\{selectionActive:!tente\|\|autorise\}\)/,
  'sélections coupées en « attempt », sauf si l’essai est explicitement autorisé');
});

/* 4.7.8 — décision sur le lot EN OBSERVATION dans le Pilote (amendement n°9) :
 * consignée avec l'observation GCV1, ancres gardées dans le lot, rien appliqué
 * au-delà de ce que le Pilote applique déjà. */
test('a GCV1 pilot batch records the lot decision in observation, never applies it',async()=>{
 const Shadow=require('../src/gcv1-shadow.js'),{base}=require('./fixtures.cjs');
 const science=Shadow.scientificProposeBoth(base);
 async function run(withLot){
  const shadow=shadowHarness();const arm=shadow.armOnce.bind(shadow);
  shadow.armOnce=selector=>{arm(selector);const out=shadow.consumeLast();shadow.consumeLast=()=>{shadow.calls.consume++;const o=shadow.pending;shadow.pending=null;return o;};
   shadow.pending={...out,rails:science.rails,summary:science.summary};};
  shadow.scientificProposeBoth=Shadow.scientificProposeBoth;
  const globals=withLot?{BananeLotDecision:require('../src/lot-decision.js'),BananeSettings:require('../src/settings.js'),BananeCore3:require('../src/core.js')}:{};
  const b=background({shadow,globals});
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1'});
  while(!['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','ERROR','PAUSED'].includes((await b.api('view')).batch?.state))await new Promise(r=>setImmediate(r));
  return {b,view:await b.api('view'),observed:b.store.events.filter(e=>e.type==='gcv1-shadow-observed')};
 }
 const lot=await run(true),control=await run(false);
 assert.ok(lot.observed.length>=1);
 for(const event of lot.observed){assert.equal(event.lotObservation.applied,false);assert.equal(event.lotObservation.displayed,false);
  assert.equal(event.lotObservation.stage,'first-pass');assert.ok(Number.isFinite(event.lotObservation.engineMs));}
 assert.equal(lot.observed[0].lotObservation.guardMm,null,'premier cut du lot : aucune ancre');
 if(lot.observed.length>1)assert.ok(lot.observed[1].lotObservation.guardMm<=30,'second cut confirmé par le premier');
 // Aucune interférence : mêmes commandes, même état de lot qu'un Pilote sans observation.
 assert.deepEqual(lot.b.adapter.calls,control.b.adapter.calls);
 assert.equal(lot.view.batch.state,control.view.batch.state);
 assert.ok(control.observed.every(e=>e.lotObservation===undefined));
});

/* 4.7.10 — la décision sur le lot COMMANDE dans un lot créé avec « appliquer »
 * (D-041, D-042) : les rails remis à `Engine.apply()` sont ceux de la décision,
 * la proposition du moteur reste dans l'événement « proposed ». « Observer
 * seulement », ou un lot sans ce champ : exactement la 4.7.9. */
test('a GCV1 pilot batch created with lotDecision apply commands the lot decision; observe changes nothing',async()=>{
 const Shadow=require('../src/gcv1-shadow.js'),L=require('../src/lot-decision.js'),K=require('../src/core.js'),{base}=require('./fixtures.cjs');
 const science=Shadow.scientificProposeBoth(base),SIDES=['left','right'];
 /* Décision factice : reprise depuis la voie, à 6 mm de la proposition V4.6 du
  * banc (42 mm vers l'intérieur par rail sur la fixture, écartée à 1 500 mm) ;
  * paire à 1 428 mm. */
 const moved=rails=>Object.fromEntries(SIDES.map(s=>{const P=rails[s].profileLocalToSceneRelative,w=K.C.point(P,[0,s==='left'?-.036:.036,.001]),o=K.C.point(P,[0,0,0]);
   return [s,rails[s].positionSceneRelative.map((v,i)=>v+w[i]-o[i])];}));
 const fake={...L,decideCut:({capture})=>({version:'lot-decision-v1',stage:'window',fromPredictionMm:6,anchorsUsed:[99],positions:moved(capture.rails),anchor:true})};
 async function run(lotDecision){
  /* Chaque armement publie la sélection GCV1 du harnais avec la science de la fixture. */
  const shadow=shadowHarness(),arm=shadow.armOnce.bind(shadow),consume=shadow.consumeLast.bind(shadow);
  shadow.armOnce=selector=>{arm(selector);shadow.pending={...consume(),rails:science.rails,summary:science.summary};};
  shadow.consumeLast=()=>{shadow.calls.consume++;const o=shadow.pending;shadow.pending=null;return o;};
  shadow.scientificProposeBoth=Shadow.scientificProposeBoth;
  const b=background({shadow,globals:{BananeLotDecision:fake,BananeSettings:require('../src/settings.js'),BananeCore3:K}});
  const applied=[],apply=b.adapter.apply.bind(b.adapter);
  b.adapter.apply=async(before,proposals)=>{applied.push({before:K.clone(before),proposals:K.clone(proposals)});return apply(before,proposals);};
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',
   ...(lotDecision?{lotDecision}:{})});
  while(!['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','ERROR','PAUSED'].includes((await b.api('view')).batch?.state))await new Promise(r=>setImmediate(r));
  return {b,view:await b.api('view'),applied,observed:b.store.events.filter(e=>e.type==='gcv1-shadow-observed'),
   proposed:b.store.events.filter(e=>e.type==='proposed')};
 }
 const lot=await run('apply');
 assert.equal(lot.view.batch.scope.lotDecision,'apply');
 assert.ok(lot.applied.length>=1&&lot.view.batch.error==null,JSON.stringify(lot.view.batch.error));
 for(const a of lot.applied){const expected=K.expectedPoses(a.before,a.proposals),want=moved(a.before.rails);
  for(const s of SIDES){assert.ok(K.C.distance(expected[s].positionSceneRelative,want[s])<1e-9,'position commandée = position de la décision ('+s+')');
   assert.equal(a.proposals[s].source,'lot-decision-window');}}
 for(const e of lot.observed){assert.deepEqual(e.lotObservation.command,{action:'lot',reason:'window',gaugeMm:e.lotObservation.command.gaugeMm});
  assert.equal(e.lotObservation.applied,true);}
 for(const e of lot.proposed)for(const s of SIDES)assert.notEqual(e.proposal.rails[s].source,'lot-decision-window','« proposed » garde la proposition du moteur');
 for(const mode of ['observe',undefined]){const control=await run(mode);
  assert.equal(control.view.batch.scope.lotDecision,'observe');
  assert.equal(control.applied.length,lot.applied.length);
  for(const a of control.applied)for(const s of SIDES)assert.notEqual(a.proposals[s].source,'lot-decision-window');
  for(const e of control.observed){assert.equal(e.lotObservation.command,undefined);assert.equal(e.lotObservation.applied,false);}}
 const b=background({shadow:shadowHarness()});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 await assert.rejects(b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',
  geometryEngine:'geometry-candidate-v1',lotDecision:'toujours'}),/Décision sur le lot inconnue/);
});
