'use strict';
// L'ORDRE COMPTE. `src/engine.js` est gelé et lie sa géométrie au chargement.
// La composition V4.6 (géométrie gelée + cerveau) reste la décision runtime.
// GCV1 est chargé ensuite comme copie scientifique figée. La façade conserve
// V4.6 par défaut, et ne sélectionne GCV1 que pour un appel explicitement armé.
/* ORDRE. `src/lot-decision.js` lit la grille d'A_STAR par `geometry-candidate-v1.js`,
 * qu'il lie au chargement via `BananeGeometry3`. Or `src/gcv1-shadow.js`
 * remplace ensuite `BananeGeometry3` par sa façade V4.6, qui ignore la demande
 * de grille : chargé après lui, le choix par la voie ne voyait aucun minimum
 * (défaut de la 4.7.8, KI-048). Il est donc chargé juste après la géométrie
 * GCV1 et avant la composition. */
importScripts('vendor/capture-core.js','src/core.js','src/settings.js','src/gauge.js','src/geometry.js',
 'src/brain.js','src/geometry-brain.js','src/gcv1-shadow-bootstrap.js',
 'src/geometry-candidate-v1.js','src/placement-convention.js','src/continuity-observer.js','src/lot-decision.js','src/gcv1-shadow.js',
 'src/gcv1-export.js','src/engine.js','src/storage.js','src/manual-session.js','src/native-session.js');
const store=new BananeStorage3();let selectedTab=null,engine,manual,native,pollPromise=null;
const VERSION=globalThis.BananeCore3?.VERSION||'4.7.18';
const PAGE_FILES=['vendor/capture-core.js','vendor/lidar.js','src/core.js','src/settings.js','src/lod-signature.js','src/merge-clouds.js','src/native-lidar.js','src/native-page.js','src/adapter-page.js'];
const GCV1_ENGINE='geometry-candidate-v1',V46_ENGINE='v4.6';
function liveGCV1Contract(){
 const contract=globalThis.BananeGCV1Shadow?.state?.().contract;
 if(!contract?.id||!contract?.geometrySha256)throw Error('Moteur GCV1 Pilote TEST indisponible.');
 return {id:contract.id,geometrySha256:contract.geometrySha256};
}
function assertPilotContract(scope){
 if(scope?.geometryEngine!==GCV1_ENGINE)return;
 const live=liveGCV1Contract(),saved=scope.geometryContract;
 if(!saved||saved.id!==live.id||saved.geometrySha256!==live.geometrySha256)
  throw Error('Moteur GCV1 du lot indisponible ou incohérent : reprise refusée.');
}
// V4.5.7 — une seule page. Les vues sont un état interne de panel.html, plus
// des fenêtres distinctes : ouvrir le Natif depuis l'accueil laissait deux
// popups empilées. Le mode Correction est retiré.
const PANEL='panel.html';
const VIEWS=['home','native','automatic','assisted'];
const esvURL=url=>{try{const u=new URL(url);return u.origin==='https://esv.lidar.altametris.xyz'&&u.pathname.startsWith('/rails_validation/');}catch{return false;}};
// The URL filter for extension pages is not reliable without a tabs permission. Track
// windows created here and live extension-page ports instead of guessing from tabs.query({url}).
const panelWindows=new Map(),panelPorts=new Map();
function launcherState(){const ids=new Set(panelWindows.keys());
 for(const [port,info] of panelPorts)ids.add(info.windowId??port);
 return {visible:ids.size===0,openWindows:ids.size};}
async function syncLauncher(){const state=launcherState(),tabs=await chrome.tabs.query({});
 await Promise.allSettled(tabs.filter(tab=>esvURL(tab.url)).map(tab=>chrome.tabs.sendMessage(tab.id,{kind:'launcher-visibility',visible:state.visible})));return state;}
async function call(action,...args){if(selectedTab===null)throw Error('Sélectionne un onglet ESV.');
 const tab=await chrome.tabs.get(selectedTab);if(!esvURL(tab.url))throw Error('L’onglet sélectionné n’est plus une page ESV autorisée.');
 const reply=await chrome.tabs.sendMessage(selectedTab,{kind:'page-command',action,args});
 if(reply?.diagnostic&&!['state','ping','nativeSnapshot','nativeStart','nativePause','nativeResume','nativeFinish'].includes(action))await engine.event('adapter-result',{...reply.diagnostic,error:reply.error||null});
 if(reply?.error)throw Error(reply.error);
 if(!reply||!Object.hasOwn(reply,'result'))throw Error('Aucune réponse de l’adaptateur ESV.');return reply.result;}
const adapter=Object.fromEntries(['ping','state','nativeSnapshot','capture','apply','restore','next','nextWithoutDecision','validateAndNext','skipAndNext','manualStart','manualPause','manualResume','manualFinish','nativeStart','nativePause','nativeResume','nativeFinish','cancel'].map(a=>[a,(...args)=>call(a,...args)]));
adapter.capabilities={serverConfirmation:false};
const ready=(async()=>{selectedTab=(await chrome.storage.local.get('banane3Tab')).banane3Tab??null;engine=new BananeEngine3.Engine(adapter,store);
 // Le moteur reste inchangé. On enveloppe seulement l'appel public analyze()
 // afin d'armer pour UN appel le candidat actif Assisté, puis de persister le
 // journal comparatif. Hors Assisté, le retour reste exactement V4.6.
 const analyzeV46=engine.analyze.bind(engine);
 engine.analyze=async(...args)=>{
   const gcv1=globalThis.BananeGCV1Shadow;
   const activeAssisted=engine.s.mode==='assisted'&&gcv1?.state?.().activeAssistedEnabled===true;
   const pilotScope=engine.s.mode==='automatic-test'&&engine.s.batch?.scope?.geometryEngine===GCV1_ENGINE
     ?engine.s.batch.scope:null;
   if(pilotScope)assertPilotContract(pilotScope);
   const selector=pilotScope?'active-pilot-test':activeAssisted?'active-assisted':null;
   let proposal,analysisError=null;
   try{if(selector)gcv1.armOnce(selector);proposal=await analyzeV46(...args);}
   catch(e){analysisError=e;}
   finally{gcv1?.disarm?.();}
   const shadow=gcv1?.consumeLast?.()||null;
   /* Engine.analyze() reste l'unique constructeur de s.proposal. On annote le
    * même objet après le calcul pour rendre la provenance durable ; event()
    * persiste ensuite ensemble l'état annoté et le proposalId comparatif. */
   if(selector&&proposal&&shadow?.selection){
     proposal.geometryEngine=shadow.selection.selectedEngine;
     proposal.geometrySelection={selector,requestedEngine:GCV1_ENGINE,
       selectedEngine:shadow.selection.selectedEngine,fallback:shadow.selection.fallback===true,
       fallbackReason:shadow.selection.fallbackReason||null,contractId:shadow.contract?.id||null,
       geometrySha256:shadow.contract?.geometrySha256||null};
   }
   /* Décision sur le lot (amendement n°9, D-039), calculée sur la capture du
    * cut et les cuts déjà passés du lot, consignée avec l'observation GCV1.
    * 4.7.10 (D-041, D-042) : dans un lot créé avec « appliquer », elle COMMANDE
    * — la proposition remise au lot porte ses positions (`commandLot`). Un lot
    * « observer seulement », ou créé avant la 4.7.10, reste en observation.
    * Une erreur ici n'arrête rien : la proposition du moteur reste la seule. */
   let lotObservation=null;
   if(pilotScope&&shadow&&!shadow.error)try{lotObservation=await observeLot(shadow);}
    catch(e){lotObservation={stage:'error',reason:e?.message||String(e),applied:false};}
   if(lotObservation&&pilotScope?.lotDecision==='apply'&&proposal&&!analysisError&&shadow?.selection?.selectedEngine===GCV1_ENGINE)try{proposal=await commandLot(proposal,lotObservation);}
    catch(e){/* KI-053 : une paire retirée par la garde n'est jamais rendue, même sur erreur. */
     if(lotObservation.guardDeferred&&globalThis.BananeLotDecision?.deferRails){
       const d=globalThis.BananeLotDecision.deferRails(proposal.rails,lotObservation,'guard-error','décision sur le lot : paire du moteur retirée par la garde ; commande impossible ('+(e?.message||String(e))+')');
       engine.s.proposal=proposal={...proposal,rails:d.rails,lotCommand:{action:'defer',reason:'guard-error',stage:lotObservation.stage,engineRails:proposal.rails}};
       lotObservation.command={action:'defer',reason:'guard-error: '+(e?.message||String(e))};lotObservation.applied=false;}
     else lotObservation.command={action:'engine',reason:'error: '+(e?.message||String(e))};}
   /* 4.7.18 (KI-057) : l'appui proposé attend que le cut soit validé avec ces
    * positions ; il ne compte qu'une fois posé (`promoteAnchors`). */
   if(lotObservation&&pilotScope)holdLotAnchor(lotObservation,pilotScope.lotDecision==='apply'?lotObservation.command??null:null);
   if(shadow)await engine.event('gcv1-shadow-observed',{identity:proposal?.identity||engine.s.before?.identity||null,
     sessionId:engine.s.sessionId,batchId:engine.s.batch?.id||null,lidarCaptureId:engine.s.lidarId||null,
     proposalId:proposal?.id||null,shadow,...(lotObservation?{lotObservation}:{})});
   if(analysisError)throw analysisError;
   if(pilotScope&&shadow?.selection?.selectedEngine!==GCV1_ENGINE){
     engine.s.proposal=null;
     const reason=shadow?.selection?.fallbackReason||shadow?.error||'sélection GCV1 absente';
     await engine.event('gcv1-pilot-error',{identity:engine.s.before?.identity||null,message:reason,geometryEngine:GCV1_ENGINE});
     throw Error('GCV1 Pilote TEST : '+reason);
   }
   return proposal;
 };
 await engine.init();
 manual=new BananeManualSession4.Sessions(engine,adapter,store);native=new BananeNativeSession4.Sessions(engine,adapter,store);await manual.init();await native.init();})();
/* 4.7.10 — la décision commande. La proposition du moteur n'est pas modifiée
 * (l'événement « proposed » la garde telle quelle) : une NOUVELLE proposition,
 * même identifiant, porte les rails de la décision et devient celle du lot.
 * `Engine.apply()` garde tous ses contrôles : état ESV inchangé, écartement
 * dans le contrat avant commande, relecture à 1 mm après. */
/* « La ligne », Assisté : l'écartement de la proposition affichée, calculé comme
 * le garde du moteur (poses attendues après application), pour la plage
 * 1405–1470 du panneau. Lecture seule, aucune valeur centrale ni cible. */
function assistGauge(v){
 try{const K=globalThis.BananeCore3,G=globalThis.BananeGauge4,p=v?.proposal,b=v?.before;
  if(!K||!G||!p?.rails||!b?.rails||!['left','right'].every(side=>p.rails[side]?.delta))return null;
  const mm=G.gaugeMmOf(K.expectedPoses(b,p.rails),K.C),cls=G.classifyMm(mm);
  return Number.isFinite(mm)?{proposalId:p.id??null,mm:Math.round(mm*10)/10,gaugeClass:cls,admissible:G.admissible(cls),contract:G.CONTRACT}:null;
 }catch{return null;}
}
async function commandLot(proposal,lotObservation){
 const L=globalThis.BananeLotDecision,K=globalThis.BananeCore3,before=engine.s.before?.rails;
 /* 4.7.11 — caméras de la capture : la cible doit tomber dans la vue du rail (KI-051). */
 const capture=engine.s.lidarId?await store.getCloud(engine.s.lidarId):null;
 const command=L.commandRails({decision:lotObservation,runtimeRails:proposal.rails,before,expectedPoses:K.expectedPoses,cameras:L.viewCameras(capture)});
 lotObservation.command={action:command.action,reason:command.reason,...(command.gaugeMm!=null?{gaugeMm:command.gaugeMm}:{}),...(command.ndc?{ndc:command.ndc}:{})};
 lotObservation.applied=command.action==='lot';
 /* « La ligne » : le panneau dessine « posé par la voie » les cuts traités que
  * la décision a commandés ; la trace vit dans le lot, bornée à ses cuts. */
 const b=engine.s.batch,cut=engine.s.before?.identity?.cut;
 if(b&&Number.isInteger(cut)){b.lotCommands=b.lotCommands||{};b.lotCommands[cut]={...(b.lotCommands[cut]||{}),cut,action:command.action,stage:lotObservation.stage};}
 if(command.action==='engine')return proposal;
 engine.s.proposal={...proposal,rails:command.rails,lotCommand:{...lotObservation.command,stage:lotObservation.stage,
   anchorsUsed:lotObservation.anchorsUsed||[],engineRails:proposal.rails}};
 return engine.s.proposal;
}
/* Décision sur le lot : l'état du lot (ancres) vit dans le lot lui-même,
 * persisté avec lui, et disparaît avec lui. */
let lotAnchorCandidate=null;
function holdLotAnchor(lotObservation,command){
 const L=globalThis.BananeLotDecision,batch=engine.s.batch,candidate=lotAnchorCandidate;lotAnchorCandidate=null;
 if(!candidate||!batch?.lotObservation||typeof L?.holdAnchor!=='function')return;
 lotObservation.anchorHeld=L.commandsPositions(lotObservation,command);
 if(lotObservation.anchorHeld)L.holdAnchor(batch.lotObservation,candidate);
}
async function observeLot(shadow){
 const L=globalThis.BananeLotDecision,S=globalThis.BananeSettings,batch=engine.s.batch;
 if(!L||!batch||S?.lot?.observe===false)return null;
 const capture=engine.s.lidarId?await store.getCloud(engine.s.lidarId):null;
 if(!capture?.rails?.left||!capture?.rails?.right||!Array.isArray(capture.pointsSceneRelative))return {stage:'no-capture',applied:false};
 const identity=globalThis.BananeCore3.completeIdentity(capture.identity||engine.s.before?.identity||{});
 const state=batch.lotObservation||(batch.lotObservation={version:L.DEFAULTS.version,anchors:[],pending:[]});
 lotAnchorCandidate=null;
 /* 4.7.18 (KI-057) : les cuts validés depuis la décision précédente deviennent
  * appuis ; une décision ne s'appuie que sur des cuts posés. */
 if(typeof L.promoteAnchors==='function')L.promoteAnchors(state,(batch.processed||[]).map(p=>p.identity).filter(Boolean),S?.lot?.maxAnchors??40);
 const t0=Date.now();
 const decision=L.decideCut({capture:{identity,rails:capture.rails,pointsSceneRelative:capture.pointsSceneRelative,
   visibleByClipBoxes:capture.visibleByClipBoxes},science:{rails:shadow.rails,summary:shadow.summary},anchors:state.anchors,Shadow:globalThis.BananeGCV1Shadow});
 /* « La ligne » : l'écart de chaque cut à la voie de ses voisins (garde du
  * premier passage, ou distance à la prédiction pour une reprise ou un choix),
  * pour le profil du panneau. Borné aux cuts du lot. */
 const chosen=decision.chosen?Object.values(decision.chosen).map(c=>c.fromPredictionMm).filter(Number.isFinite):[];
 const ecartMm=decision.guardMm??decision.fromPredictionMm??(chosen.length?Math.max(...chosen):null);
 if(Number.isInteger(identity.cut)){batch.lotCommands=batch.lotCommands||{};
   batch.lotCommands[identity.cut]={...(batch.lotCommands[identity.cut]||{}),cut:identity.cut,stage:decision.stage,ecartMm:Number.isFinite(ecartMm)?ecartMm:null};}
 if(decision.anchor)lotAnchorCandidate={identity:{part:identity.part,cut:identity.cut,frameId:identity.frameId??null},positions:decision.positions,stage:decision.stage};
 return {...decision,applied:false,displayed:false,engineMs:Date.now()-t0};
}
async function openPanel(which='home'){if(!VIEWS.includes(which))throw Error('Vue inconnue.');
 const url=chrome.runtime.getURL(PANEL)+'#'+which;
 // Une fenêtre Banane existe déjà : on la ramène au premier plan et on lui
 // demande de changer de vue, plutôt que d'en empiler une seconde.
 const existing=[...panelWindows.keys()][0]??[...panelPorts.values()][0]?.windowId;
 if(existing!==undefined){try{await chrome.windows.update(existing,{focused:true});
   for(const port of panelPorts.keys()){try{port.postMessage({kind:'navigate',view:which});}catch{/* port fermé */}}
   await syncLauncher();return;}
  catch{panelWindows.delete(existing);}}
 const window=await chrome.windows.create({url,type:'popup',width:560,height:820});
 if(Number.isInteger(window?.id))panelWindows.set(window.id,url);
 await syncLauncher();}
chrome.action.onClicked.addListener(()=>openPanel());
chrome.runtime.onConnect.addListener(port=>{
 const url=port.sender?.url||port.sender?.tab?.url;
 // Le fragment d'URL porte la vue : il ne doit pas fausser la comparaison.
 const sansFragment=(url||'').split('#')[0];
 if(port.name!=='banane-panel-presence'||port.sender?.id!==chrome.runtime.id||sansFragment!==chrome.runtime.getURL(PANEL))return;
 panelPorts.set(port,{url,windowId:port.sender?.tab?.windowId,tabId:port.sender?.tab?.id});
 if(Number.isInteger(port.sender?.tab?.windowId))panelWindows.set(port.sender.tab.windowId,url);
 port.onDisconnect.addListener(()=>{panelPorts.delete(port);void syncLauncher().catch(()=>{});});
 void syncLauncher().catch(()=>{});
});
chrome.windows.onRemoved?.addListener(id=>{panelWindows.delete(id);for(const [port,info] of panelPorts)if(info.windowId===id)panelPorts.delete(port);void syncLauncher().catch(()=>{});});
chrome.tabs.onRemoved?.addListener(id=>{for(const [port,info] of panelPorts)if(info.tabId===id)panelPorts.delete(port);void syncLauncher().catch(()=>{});});
function pollCurrent(){
 if(pollPromise||engine.busy||engine.task||manual?.active()||native?.active()||selectedTab===null)return;
 pollPromise=engine.observe().then(()=>{engine.s.connection={status:'ready',observedAt:new Date().toISOString()};})
  .catch(e=>{engine.s.connection={status:'unavailable',message:e.message};})
  .finally(()=>{pollPromise=null;});
}
async function dispatch(m){await ready;const {action,args={}}=m;
 if(action==='open-window'){await openPanel(args.window);return {opened:true};}
 if(action==='list-tabs')return (await chrome.tabs.query({url:'https://esv.lidar.altametris.xyz/rails_validation/*'})).map(t=>({id:t.id,title:t.title}));
 if(action==='connect'){
  if(engine.busy||engine.task||manual.running()||native.running())throw Error('Termine l’activité en cours avant de changer d’onglet.');
  const tab=await chrome.tabs.get(Number(args.tabId));if(!esvURL(tab.url))throw Error('Onglet ESV invalide.');
  // Only extension-origin UI requests can inject the fixed, bundled adapter.
  await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:PAGE_FILES});
  await chrome.scripting.executeScript({target:{tabId:tab.id},world:'ISOLATED',files:['src/bridge.js']});
  selectedTab=tab.id;await chrome.storage.local.set({banane3Tab:selectedTab});
  const ping=await call('ping');if(ping?.version!==VERSION)throw Error(`Recharge la page ESV pour activer Banane ${VERSION}.`);
  await engine.observe();engine.s.connection={status:'ready',observedAt:new Date().toISOString()};await engine.save();return engine.view();}
 if(action==='view'){pollCurrent();const v=engine.view();return {...v,assistGauge:assistGauge(v)};}
 // V4.6.0 : une reprise manuelle est un lot actif. Le mode Natif ne prend pas sa place.
 if(action==='native-start'){engine.assertBatchContextFree('démarrer le mode Natif');return native.start();}
 if(action==='native-pause')return native.pause();
 if(action==='native-resume')return native.resume();
 if(action==='native-end')return native.end({dataset:false});
 if(action==='native-download')return native.dataset();
 // V4.5-R : export segmenté. Le panneau demande un plan (métadonnées + nuages
 // pas encore écrits), écrit le segment, puis acquitte les identifiants.
 if(action==='native-health')return native.health();
 if(action==='native-export-advice')return native.exportAdvice();
 if(action==='native-export-manifest')return native.exportManifest(args?.all===true);
 if(action==='native-export-plan')return native.exportPlan();
 if(action==='native-export-ack')return native.ackExported(args?.ids||[]);
 // Abandon : irréversible, sans export. La confirmation est demandée côté panneau.
 if(action==='native-discard')return native.discard();
 // État du cerveau : ce qu'il est réglé à faire, et ce qu'il a fait au dernier passage.
 if(action==='brain-state')return {...BananeGeometryBrain.reglages(),ajuste:BananeGeometryBrain.AJUSTE,dernier:BananeGeometryBrain.journal()};
 // Gates internes GCV1 : shadow et actif Assisté sont OFF à chaque démarrage
 // du service worker. Elles n'accordent aucun accès à l'adaptateur ; seule la
 // géométrie rendue par l'appel Assisté explicitement armé peut changer.
 if(action==='gcv1-shadow-state')return {...BananeGCV1Shadow.state(),dernier:BananeGCV1Shadow.journal()};
 if(action==='gcv1-shadow-configure'){
   if(engine.busy||engine.task||manual.running()||native.running())throw Error('Termine l’activité en cours avant de changer le shadow GCV1.');
   const options={};
   if(Object.prototype.hasOwnProperty.call(args||{},'enabled'))options.enabled=args.enabled;
   if(Object.prototype.hasOwnProperty.call(args||{},'activeAssisted'))options.activeAssisted=args.activeAssisted;
   // Flanc partiel (cahier 4.8, amendement n°3) : actif par défaut, coupable sans rebuild.
   if(Object.prototype.hasOwnProperty.call(args||{},'partialFlank'))options.partialFlank=args.partialFlank;
   // Calage de convention (amendement n°4) : actif par défaut, coupable pour un essai.
   if(Object.prototype.hasOwnProperty.call(args||{},'convention'))options.convention=args.convention;
   return BananeGCV1Shadow.configure(options);
 }
 // Exports GCV1 strictement manuels : ils relisent les événements et les
 // captures déjà persistés. Aucun calcul géométrique ni appel adaptateur.
 if(action==='gcv1-diagnostic-export')return BananeGCV1Export.buildDiagnostic({version:VERSION,
   sessionId:engine.s.sessionId,state:engine.view(),events:await store.all('events')});
 if(action==='gcv1-corpus-export-plan'){
   const diagnostic=BananeGCV1Export.buildDiagnostic({version:VERSION,sessionId:engine.s.sessionId,
     state:engine.view(),events:await store.all('events')});
   return BananeGCV1Export.buildCorpusPlan({diagnostic,getCloud:id=>store.getCloud(id)});
 }
 // V4.5.7 — le mode Correction est retiré : aucune nouvelle session ne peut
 // être démarrée, et la page ESV ne reçoit plus manual-page.js. Fermeture et
 // téléchargement restent ouverts pour récupérer une session déjà enregistrée
 // avant la mise à jour : la retirer ne doit pas rendre ses données illisibles.
 if(['manual-start','manual-pause','manual-resume'].includes(action))
  throw Error('Le mode Correction a été retiré en 4.5.4. Utilise le mode Natif.');
 if(action==='manual-end')return manual.end();
 if(action==='manual-download')return manual.dataset();
 if(native.active()&&!['cloud','native-download','native-health','native-export-advice','native-export-manifest','native-export-plan','native-export-ack','native-discard'].includes(action))throw Error('Le mode Natif est actif. Termine-le avant d’utiliser Mes corrections, l’assisté ou le pilote.');
 if(manual.active()&&!['cloud','journal','dataset'].includes(action))throw Error('Une session est active dans Mes corrections. Termine-la avant de piloter un lot ou d’utiliser l’assisté.');
 if(action==='pause'){await engine.pause();return engine.view();}if(action==='stop'){await engine.stop();return engine.view();}
 if(action==='resume'){assertPilotContract(engine.s.batch?.scope);
  /* Relecture 4.7.12, constat I3 : « Reprendre » sur le cut encore affiché et
   * archivé recapturait ce cut, que le moteur refuse d'écrire ; le lot passait
   * en ERROR, non reprenable, et perdait ses appuis. La reprise est refusée
   * AVANT tout changement d'état : le lot reste arrêté, reprenable dès le cut
   * suivant. */
  const affiche=await adapter.state().catch(()=>null);
  if(affiche?.identity)try{engine.writable(affiche.identity);}
   catch{throw Error(`Cut ${affiche.identity.cut} : résultat incertain archivé, Banane n’y écrit plus. Passe au cut suivant dans ESV, puis clique sur Reprendre.`);}
  /* KI-052 : « Archiver le résultat interrompu » arrête le lot en laissant
   * l'étape « apply » et efface la proposition ; reprendre relançait la boucle
   * sur une proposition absente. Sans proposition, la reprise recommence le
   * cut par sa capture. */
  if(engine.s.batch?.step==='apply'&&!engine.s.proposal&&!engine.s.intent&&!engine.s.reconcileRequired)engine.s.batch.step='capture';
  await engine.resume();return engine.view();}
 /* 4.7.18 (KI-055, chantier 5) : « Réessayer ce cut » relit une capture. Si
  * l'opérateur a déplacé les rails pendant la pause, cette capture serait SA
  * pose, qui entrerait dans le moteur et la décision sur le lot (cahier §10,
  * §14 I) : refusé, comme « Reprendre » (« Rails modifiés depuis la lecture
  * interrompue »). `src/engine.js` est épinglé : le contrôle vit ici. */
 if(action==='retry'){const ref=engine.s.before?.rails;
   if(ref){const now=await engine.adapter.state();
     if(!globalThis.BananeCore3.equalPoses(ref,now.rails))throw Error('Rails modifiés pendant la pause : « Réessayer » analyserait ta pose, il est refusé. Choisis Reprise manuelle ou SKIP explicite.');}
   await engine.retryPaused();return engine.view();}
 if(action==='manual-takeover'){await engine.manualTakeover();return engine.view();}
 // V4.6.0 : l'opérateur déclare avoir traité le cut lui-même ; le lot reprend au suivant.
 if(action==='manual-completion'){await engine.manualCompletion();return engine.view();}
 if(action==='explicit-skip'){await engine.skipPaused();return engine.view();}
 if(action==='start'){
  // Avant tout archivage : un lot en reprise manuelle garde son contexte.
  engine.assertBatchContextFree('un nouveau lot');
  if(engine.s.before&&!engine.s.applied&&!engine.s.intent)await engine.archivePending('new-automatic-batch');
  /* GARDE-FOU DÉCOUVERT SUR LE TERRAIN, cut 6/4245.
   *
   * Une sélection du cerveau porte `confidence: 0` pour que le pilote la mette
   * en pause. Mais `src/engine.js` — gelé, ligne 233 — ne met en pause que
   * si `scope.lowConfidence !== 'attempt'`. Avec la politique « Tenter la
   * proposition expérimentale », le pilote a donc appliqué tout seul une
   * sélection explicitement marquée « jamais à appliquer automatiquement ».
   *
   * La confiance nulle ne suffit pas : on coupe la sélection à la source quand
   * la politique permet de tenter. Le cerveau continue de retirer le biais
   * vertical — cette correction-là garde la confiance du moteur et n'a jamais
   * été en cause. Un rail ambigu redevient alors `unresolved`, ce qui met le
   * lot en pause par le chemin `missing`, avant même la question de confiance. */
  const geometryEngine=args?.geometryEngine||V46_ENGINE;
  if(![V46_ENGINE,GCV1_ENGINE].includes(geometryEngine))throw Error('Moteur géométrique de lot inconnu.');
  const startArgs={...args,geometryEngine};
  if(geometryEngine===GCV1_ENGINE){
    startArgs.geometryContract=liveGCV1Contract();
    startArgs.requestedLowConfidence=args?.lowConfidence||null;
    // La publication GCV1 est la frontière d'admissibilité du lot TEST : une
    // candidate finie, y compris S1 à confiance non calibrée, n'est pas
    // repassée dans le seuil de confiance historique V4.6.
    startArgs.lowConfidence='attempt';
    /* 4.7.10 — décision sur le lot, figée dans le scope à la création : elle
     * commande seulement si le lot est créé avec « appliquer » (D-041, D-042). */
    if(args?.lotDecision!==undefined&&!['apply','observe'].includes(args.lotDecision))throw Error('Décision sur le lot inconnue.');
    startArgs.lotDecision=args?.lotDecision==='apply'?'apply':'observe';
  }else delete startArgs.lotDecision;
  /* 4.7.18 (relecture 4.7.16, I1) : la version qui CRÉE le lot, figée dans son
   * scope ; le rejeu la préfère à la version de l'export, qui peut être plus récente. */
  startArgs.extensionVersion=VERSION;
  const tente=startArgs.lowConfidence==='attempt';
  const autorise=BananeGeometryBrain.reglages().autoriserSelectionSansPause===true;
  BananeGeometryBrain.configure({selectionActive:!tente||autorise});
  await engine.startBatch(startArgs);return engine.view();}
 if(action==='cloud')return store.getCloud(args.id);
 if(action==='journal')return {format:'banane-test-journal-v4',version:VERSION,state:engine.view(),events:await store.all('events'),records:await store.all('records'),closureSummary:engine.closureSummary()};
 if(action==='dataset')return {format:'banane-test-dataset-v4',version:VERSION,exportedAt:new Date().toISOString(),state:engine.view(),events:await store.all('events'),records:await store.all('records'),closureSummary:engine.closureSummary(),cloudIds:await store.keys('clouds')};
 return engine.locked(async()=>{
  let result;
  if(action==='settings'){
    if(!['observation','assisted','automatic-test'].includes(args.mode))throw Error('Mode invalide.');
    const settings={...engine.s.settings};
    for(const k of ['minConfidence','searchY','searchZ'])if(args[k]!==undefined){
      const v=Number(args[k]),ranges={minConfidence:[0,100],searchY:[.01,.15],searchZ:[.01,.08]};
      if(!Number.isFinite(v)||v<ranges[k][0]||v>ranges[k][1])throw Error('Paramètre invalide : '+k);settings[k]=v;}
    // Le cerveau vit hors des réglages géométriques : ce ne sont pas des seuils
    // du moteur, et ils ne doivent pas se retrouver dans `settings` que le
    // moteur gelé valide.
    if(args.brain!==undefined)BananeGeometryBrain.configure({actif:args.brain===true});
    if(args.brainSelectionSansPause!==undefined)
     BananeGeometryBrain.configure({autoriserSelectionSansPause:args.brainSelectionSansPause===true});
    engine.s.mode=args.mode;engine.s.settings=settings;
    result=engine.view();
  }else if(action==='before')result=await engine.begin();
  else if(action==='after')result=await engine.finish();
  else if(action==='lidar')result=await engine.standalone();
  else if(action==='analyze')result=await engine.analyze();
  else if(action==='accept')result=await engine.apply(false);
  else if(action==='reject'){engine.s.proposal=null;await engine.event('proposal-rejected');result=engine.view();}
  else if(action==='restore')result=await engine.restore();
  else if(action==='reconcile')result=await engine.reconcile();
  else if(action==='close-uncertain')result=await engine.closeUncertain();
  else if(action==='cancel-before'){await engine.archivePending('operator-cancelled');result=engine.view();}
  else if(action==='references')result=await engine.exportReferences();
  else throw Error('Commande inconnue.');return result;
 });
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 if(m.kind==='launcher-status'&&sender.tab?.id&&esvURL(sender.url||sender.tab?.url)){
  respond(launcherState());return;}
 if(m.kind==='heartbeat'){respond({ok:true});return;}
 if(m.kind==='manual-event'&&sender.tab?.id===selectedTab&&esvURL(sender.url)){
  ready.then(()=>manual.receive(m.type,m.payload)).then(result=>respond({result}),e=>respond({error:e.message}));return true;
 }
 if(m.kind==='native-event'&&sender.tab?.id===selectedTab&&esvURL(sender.url)){
  ready.then(()=>native.receive(m.type,m.payload)).then(result=>respond({result}),e=>respond({error:e.message}));return true;
 }
 if(m.kind==='adapter-trace'&&sender.tab?.id===selectedTab&&esvURL(sender.url)){
  ready.then(()=>{if(m.action==='capture')engine.s.captureProgress={stage:m.lastStage,...m.lastDetail};
    return engine.event('adapter-progress',{requestId:m.requestId,action:m.action,elapsedMs:m.elapsedMs,acknowledged:m.acknowledged,lastStage:m.lastStage,lastDetail:m.lastDetail});}).then(()=>respond({ok:true}),e=>respond({error:e.message}));return true;
 }
 if(m.kind==='open-panel'){openPanel().then(()=>respond({ok:true}),e=>respond({error:e.message}));return true;}
 // Le fragment d'URL porte la vue affichée ; seule l'origine de la page compte.
 if(m.kind!=='panel'||(sender.url||'').split('#')[0]!==chrome.runtime.getURL(PANEL))return;
 dispatch(m).then(result=>respond({result}),async e=>{if(engine){engine.s.notice=e.message;await engine.save().catch(()=>{});}respond({error:e.message});});return true;
});
