const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {MemoryStore,SimulatedESV}=require('./fixtures.cjs');
function background(){const adapter=new SimulatedESV(),store=new MemoryStore();store.all=async n=>n==='clouds'?[...store.clouds.values()]:store[n];store.keys=async()=>[...store.clouds.keys()];let onMessage,onConnect,click,onWindowRemoved,onTabRemoved;const opened=[],injected=[],panelTabs=[],launcherMessages=[];
 const ctx={URL,console,importScripts:()=>{},BananeEngine3:require('../src/engine.js'),BananeManualSession4:require('../src/manual-session.js'),BananeNativeSession4:require('../src/native-session.js'),BananeStorage3:class{constructor(){return store;}},BananeGeometryBrain:require('../src/geometry-brain.js'),
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
 return {adapter,store,api,message,click,opened,injected,launcherMessages,
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
 await b.api('native-pause');await b.api('native-resume');const data=await b.api('native-end');assert.equal(data.format,'banane-native-session-v2');
 assert.deepEqual(b.adapter.calls.filter(x=>x.startsWith('native')),['nativeStart','nativePause','nativeResume','nativeFinish']);
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
test('la politique « attempt » coupe les sélections, sauf accord explicite',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
 assert.match(src,/lowConfidence==='attempt'/,'la politique doit être lue au démarrage');
 assert.match(src,/autoriserSelectionSansPause===true/,
  'le mode essai doit être un accord explicite, pas un défaut');
 assert.match(src,/configure\(\{selectionActive:!tente\|\|autorise\}\)/,
  'sélections coupées en « attempt », sauf si l’essai est explicitement autorisé');
});
