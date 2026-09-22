/* Real ESV page adapter. Selectors originate in Banane V2–V2.4.2 sources.
 * No server URL/payload is invented. Canvas clicks and navigation require readback.
 */
(()=>{'use strict';if(window.__BANANE_V3_PAGE)return;
 const C=window.BananeCaptureCore,L=window.BananeLidar,N=window.BananeNativeLidar4,K=window.BananeCore3;
 /* Réglages du pilote : source unique dans src/settings.js. Repli sur les
  * anciennes valeurs codées en dur si le module n'est pas chargé, pour ne
  * jamais empêcher l'adaptateur de fonctionner. */
 const P=window.BananeSettings?.pilote||{tentativesParVue:3,stabiliteMs:800,budgetCaptureMs:60000,
   sondageMs:80,lecturesStables:3,attenteMs:12000,attenteNavigationMs:15000,attenteClicMs:5000};
 const pageId=K.uid(),objects=new WeakMap(),frames=new WeakMap(),nativeFrames=new WeakMap(),nativeViews=new WeakMap();let frame=null,cancelled=false;
 /* D1. Annulations et invocations CORRÉLÉES À UNE OPÉRATION, par opposition au
  * drapeau `cancelled` que chaque entrée de l'adaptateur remet à faux. Ces deux
  * collections ne sont jamais vidées par une autre requête : une annulation
  * connue de la page reste connue, et une opération déjà invoquée ne peut pas
  * l'être une seconde fois. Elles vivent le temps du document, comme la page. */
 const cancelledOperations=new Set(),invokedOperations=new Map();
 const selectors={label:'O2N3DCutDescription',shape:'O2N3DCutShapeInfo',left:'O2N3DCutLRClick',right:'O2N3DCutRRClick',validate:'O2N3DCutValidate3DRail',next:'O2N3DCutNextInvalid3DRail'};
 const objectId=o=>{if(!objects.has(o))objects.set(o,K.uid());return objects.get(o);};
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 function cutLabel(){const text=document.getElementById(selectors.label)?.textContent||'',match=/Cut\s+(\d+)\s+of\s+part\s+(\d+)/i.exec(text);
   if(!match)return null;return {pageId,part:Number(match[2]),cut:Number(match[1])};}
 function commandInfo(id){const el=document.getElementById(id);return {id,exists:!!el,tag:el?.tagName||null,disabled:!!el?.disabled,
   title:(el?.title||'').slice(0,180),text:(el?.textContent||'').trim().slice(0,180)};}
 /* MÉMOÏSATION DE L'IDENTIFICATION DES RAILS.
  *
  * `context()` reparcourt la scène et calcule, pour CHAQUE rail, la moyenne des
  * ordonnées de tous les sommets du contour — 625 sommets par rail sur le
  * terrain — uniquement pour décider quel objet est à gauche et lequel à droite.
  *
  * Or `context()` est appelé par `snapshot()`, lui-même appelé par
  * `assertExpected()`, lui-même appelé par `guard()` — qui s'exécute à CHAQUE
  * itération de `waitFor`, donc toutes les 80 ms pendant toute la capture.
  * Mesure terrain : la capture représente 85 % du temps du pilote (6,95 s sur
  * 8,16 s par cut), dont 2,4 s d'attente AVANT la première lecture. Ce recalcul
  * consomme le temps processeur dont ESV a besoin pour stabiliser son niveau de
  * détail — c'est-à-dire précisément ce qu'on attend.
  *
  * Le résultat ne change pas tant que le cut, le profil, la racine et sa
  * matrice sont les mêmes. On le conserve, et on revérifie ces quatre choses à
  * chaque appel — elles coûtent une regex et une comparaison de 16 nombres.
  * Les POSES des rails, elles, restent relues à neuf : `railState()` lit les
  * matrices monde à chaque fois, donc un rail déplacé est vu immédiatement. */
 const contextes=new WeakMap();
 function context(){
   if(window.__BANANE_V24||window.__BANANE_V23||window.__BANANE_V231||window.__BANANE_V2_LOADED__||window.__BANANE_V21_LOADED__||window.__BANANE_V22_LOADED__)throw Error('Une ancienne Banane est active. Désactive-la puis recharge ESV après sauvegarde.');
   const viewer=window.viewer,root=viewer?.scene?.scene;if(!root)throw Error('Ouvre une coupe dans ESV 3D.');
   const text=document.getElementById(selectors.label)?.textContent||'',m=/Cut\s+(\d+)\s+of\s+part\s+(\d+)/i.exec(text);
   if(!m)throw Error('Identité de cut introuvable.');
   const shape=document.getElementById(selectors.shape)?.textContent?.trim();if(!shape)throw Error('Profil introuvable.');
   const garde=contextes.get(root);
   const matriceRacine=C.worldMatrix(root);
   if(garde&&garde.part===Number(m[2])&&garde.cut===Number(m[1])&&garde.shape===shape&&
      garde.enfants===(root.children?.length||0)&&
      garde.rootMatrix.every((v,i)=>Math.abs(v-matriceRacine[i])<=1e-9)&&
      ['left','right'].every(s=>garde.pair[s]&&garde.pair[s].object.parent===root))
     return {viewer,root,pair:garde.pair,frame:garde.frame,
       identity:{pageId,part:garde.part,cut:garde.cut,shape,frameId:garde.frame.id,projectId:null}};
   const candidates=[];
   for(const o of root.children||[]){if(o.type!=='Object3D')continue;
     const profile=o.children?.find(p=>p.children?.some(c=>c.type==='Line'));
     if(!profile||!o.children?.some(c=>c.type==='Mesh'))continue;
     const lines=profile.children.filter(c=>c.type==='Line'&&c.geometry?.attributes?.position);
     const line=lines.sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count)[0];
     if(!line)continue;const reader=C.attribute(line.geometry.attributes.position),inv=C.inverse(C.worldMatrix(profile)),world=C.worldMatrix(line),ys=[];
     for(let i=0;i<reader.count;i++)ys.push(C.point(inv,C.point(world,reader.point(i)))[1]);
     const centre=ys.reduce((a,b)=>a+b,0)/ys.length;
     if(Math.abs(centre)<.005)throw Error('Correspondance G/D du profil ambiguë.');
     candidates.push({object:o,profile,side:centre>0?'left':'right',objectId:objectId(o),profileId:objectId(profile)});
   }
   if(shape!=='U50')throw Error('Profil non testé : '+shape+'. Capture automatique limitée au U50 observé.');
   if(candidates.length!==2||new Set(candidates.map(r=>r.side)).size!==2)throw Error('Les deux rails ne sont pas identifiables sans ambiguïté.');
   const rootMatrix=matriceRacine;frame=frames.get(root);
   if(!frame||rootMatrix.some((v,i)=>Math.abs(v-frame.rootMatrix[i])>1e-9)){
     frame={id:K.uid(),origin:C.point(C.worldMatrix(candidates.find(r=>r.side==='left').object),[0,0,0]),rootMatrix};frames.set(root,frame);}
   const pair=Object.fromEntries(candidates.map(r=>[r.side,r]));
   contextes.set(root,{part:Number(m[2]),cut:Number(m[1]),shape,pair,frame,rootMatrix,enfants:root.children?.length||0});
   return {viewer,root,pair,frame,identity:{pageId,part:Number(m[2]),cut:Number(m[1]),shape,frameId:frame.id,projectId:null}};
 }
 function railState(r){return {object:r.object,profile:r.profile,railMatrix:C.worldMatrix(r.object),profileMatrix:C.worldMatrix(r.profile),rotation:C.rotation(r.object),profileRotation:C.rotation(r.profile)};}
 function sameRailPose(a,b,tolerance=1e-7){return ['railLocalToSceneRelative','profileLocalToSceneRelative'].every(name=>
   Array.isArray(a?.[name])&&Array.isArray(b?.[name])&&a[name].length===16&&b[name].length===16&&a[name].every((value,index)=>Number.isFinite(value)&&Number.isFinite(b[name][index])&&Math.abs(value-b[name][index])<=tolerance));}
 function snapshot(){const c=context();return {identity:K.completeIdentity(c.identity),capturedAt:new Date().toISOString(),
   geominfo:{status:'not-observed',raw:null,source:null},
   mapping:Object.fromEntries(['left','right'].map(s=>[s,{objectId:c.pair[s].objectId,profileId:c.pair[s].profileId,method:'observed-U50-mirrored-contour'}])),
   rails:Object.fromEntries(['left','right'].map(s=>[s,C.serialRail(railState(c.pair[s]),c.frame.origin)]))};}
 function nativeContext(){const partialReasons=[],label=cutLabel(),shape=document.getElementById(selectors.shape)?.textContent?.trim()||null;
   if(!label)partialReasons.push('cut-identity-not-observed');if(!shape)partialReasons.push('shape-not-observed');
   const viewer=window.viewer,root=viewer?.scene?.scene;if(!root)return {viewer:null,root:null,pair:{},frame:null,label,shape,partialReasons:[...partialReasons,'scene-not-ready']};
   const candidates=[];
   for(const o of root.children||[]){try{if(o.type!=='Object3D')continue;
     const profile=o.children?.find(p=>p.children?.some(c=>c.type==='Line'));if(!profile||!o.children?.some(c=>c.type==='Mesh'))continue;
     const lines=profile.children.filter(c=>c.type==='Line'&&c.geometry?.attributes?.position);
     const line=lines.sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count)[0];if(!line)continue;
     const reader=C.attribute(line.geometry.attributes.position),inv=C.inverse(C.worldMatrix(profile)),world=C.worldMatrix(line),ys=[];
     for(let i=0;i<reader.count;i++)ys.push(C.point(inv,C.point(world,reader.point(i)))[1]);
     const centre=ys.reduce((a,b)=>a+b,0)/ys.length;if(Math.abs(centre)<.005){partialReasons.push('rail-side-ambiguous');continue;}
     candidates.push({object:o,profile,side:centre>0?'left':'right',objectId:objectId(o),profileId:objectId(profile)});
   }catch(e){partialReasons.push('rail-object-unreadable:'+e.message);}}
   const pair={};for(const candidate of candidates){if(pair[candidate.side])partialReasons.push('duplicate-'+candidate.side+'-rail');else pair[candidate.side]=candidate;}
   for(const side of ['left','right'])if(!pair[side])partialReasons.push('rail-'+side+'-not-observed');
   const rootMatrix=C.worldMatrix(root);let nativeFrame=nativeFrames.get(root);
   if(!nativeFrame||rootMatrix.some((v,i)=>Math.abs(v-nativeFrame.rootMatrix[i])>1e-9)){
     nativeFrame={id:K.uid(),origin:C.point(rootMatrix,[0,0,0]),rootMatrix};nativeFrames.set(root,nativeFrame);}
   return {viewer,root,pair,frame:nativeFrame,label,shape,partialReasons};
 }
 function nativeViewObservation(c){if(!c.viewer||!c.frame||!c.root)return {status:'not-observed',viewEpochId:null,observedAt:new Date().toISOString(),loadedNodeCount:null};
   try{const inventory=L.inventory(c.viewer),camera=L.cameraSnapshot(c.viewer,c.frame.origin),tokens=inventory.nodes.map(node=>[
      objectId(node.obj),objectId(node.geometry),objectId(node.position),node.position.array||node.position.data?.array?objectId(node.position.array||node.position.data?.array):null,node.attribute.count,node.position.version??null,
      node.position.data?.version??null,node.world,node.drawRange?.start??0,node.drawRange?.count??null]);
     /* Deux époques (4.7.2). `viewEpochId` garde son sens : nœuds chargés ET
      * caméra. `loadEpochId` ne suit que les nœuds chargés : c'est lui qui dit
      * si une nouvelle lecture peut apporter des points. La même sérialisation
      * sert aux deux — JSON.stringify([a,b]) vaut '['+a+','+b+']'. */
     const loadSignature=JSON.stringify(tokens),signature='['+JSON.stringify(camera?.cameraToSceneRelative||null)+','+loadSignature+']',previous=nativeViews.get(c.root);
     const view=previous?.signature===signature?previous:{signature,viewEpochId:K.uid(),loadSignature,
       loadEpochId:previous?.loadSignature===loadSignature&&previous?.loadEpochId?previous.loadEpochId:K.uid()};nativeViews.set(c.root,view);
     return {status:'observed',viewEpochId:view.viewEpochId,loadEpochId:view.loadEpochId,observedAt:new Date().toISOString(),loadedNodeCount:inventory.nodes.length,
       unsupportedNodeCount:inventory.clouds.reduce((sum,cloud)=>sum+(cloud.unsupportedNodes?.length||0),0),camera:camera?{type:camera.type,cameraToSceneRelative:camera.cameraToSceneRelative,viewport:camera.viewport}:null};
   }catch(error){return {status:'unavailable',viewEpochId:null,observedAt:new Date().toISOString(),loadedNodeCount:null,reason:error.message};}}
 function nativeSnapshot(){const c=nativeContext(),identity=K.completeIdentity({pageId,part:c.label?.part??null,cut:c.label?.cut??null,
    shape:c.shape,frameId:c.frame?.id??null,projectId:null}),rails={left:null,right:null},mapping={left:null,right:null};
   for(const side of ['left','right'])if(c.pair[side]&&c.frame){try{rails[side]=C.serialRail(railState(c.pair[side]),c.frame.origin);
     mapping[side]={objectId:c.pair[side].objectId,profileId:c.pair[side].profileId,method:'passive-observed-contour-side'};
   }catch(e){c.partialReasons.push('rail-'+side+'-state-unreadable:'+e.message);}}
   const viewObservation=nativeViewObservation(c);if(viewObservation.status!=='observed')c.partialReasons.push('loaded-view-'+viewObservation.status);
   return {identity,capturedAt:new Date().toISOString(),status:c.partialReasons.length?'partial':'complete',partialReasons:[...new Set(c.partialReasons)],
     geominfo:{status:'not-observed',raw:null,source:null},mapping,rails,viewObservation};
 }
 /* Garde de capture native — 4.7.2 : identité et rails, rien d'autre.
  *
  * La garde est appelée à chaque pause du lecteur. Elle passait par
  * `nativeSnapshot`, qui recalcule aussi l'observation de vue : inventaire de
  * tous les nœuds chargés, lecture de la caméra et sérialisation JSON d'une
  * signature de tous les nœuds. Rien de cela ne sert à décider si la lecture
  * doit s'arrêter ; seules l'identité du cut et la pose des rails comptent. */
 function nativeGuardState(){const c=nativeContext(),identity=K.completeIdentity({pageId,part:c.label?.part??null,cut:c.label?.cut??null,
    shape:c.shape,frameId:c.frame?.id??null,projectId:null}),rails={left:null,right:null};
   for(const side of ['left','right'])if(c.pair[side]&&c.frame){try{rails[side]=C.serialRail(railState(c.pair[side]),c.frame.origin);}catch(e){rails[side]=null;}}
   return {identity,rails,viewer:c.viewer,origin:c.frame?.origin||null};}
 function nativeCameraMatrix(viewer,origin){try{const camera=viewer?.scene?.getActiveCamera?.();return camera&&origin?C.rebase(C.worldMatrix(camera),origin):null;}catch(e){return null;}}
 /* Rendre la main à ESV entre deux tranches de lecture. `requestIdleCallback`
  * attendait un temps libre qui n'arrive jamais pendant qu'ESV dessine : chaque
  * pause coûtait les 16 ms de son délai maximal. `scheduler.yield` (ou, à
  * défaut, un message de canal) laisse passer les entrées et le rendu en
  * attente, puis reprend aussitôt. */
 function yieldToPage(){
   if(typeof scheduler!=='undefined'&&typeof scheduler.yield==='function')return scheduler.yield();
   if(typeof MessageChannel==='function')return new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();resolve();};channel.port2.postMessage(0);});
   return new Promise(resolve=>setTimeout(resolve,0));}
 async function nativeCapture(expected,isActive=()=>true,request={}){const initial=nativeSnapshot();K.assertTarget(expected.identity,initial.identity);
   const c=nativeContext(),railInputs={},associationByRail={};
   for(const side of ['left','right'])if(initial.rails[side]&&expected.rails?.[side]&&c.pair[side]&&sameRailPose(initial.rails[side],expected.rails[side])){
     railInputs[side]=railState(c.pair[side]);associationByRail[side]='same-target-and-rail-pose';}
   /* Un mouvement de caméra N'ARRÊTE PLUS la lecture (4.7.2).
    *
    * Un point lu reste valable quelle que soit la caméra : il est pris dans le
    * buffer du nœud et transformé par la matrice du nœud, deux choses que le
    * lecteur revérifie à chaque pause (`sourceUnchanged`) ; la découpe est
    * revérifiée à chaque checkpoint. Lots du 22/09 : 378 captures sur 491
    * arrêtées par la caméra au lot 3, et le budget de 24 captures par visite
    * épuisé par ces arrêts sur 89 visites — la lecture était tuée pendant le
    * déplacement de vue qui accompagne chaque changement de cut. Le mouvement
    * reste consigné, pour que l'export dise ce qui s'est passé. */
   const cameraAtStart=expected.viewObservation?.camera?.cameraToSceneRelative||nativeCameraMatrix(c.viewer,c.frame?.origin);
   let guards=0;
   const guard=()=>{guards++;if(!isActive()){const error=Error('passive-lidar-read-cancelled');error.code='COLLECTOR_STOPPED';throw error;}
     const now=nativeGuardState();try{K.assertTarget(expected.identity,now.identity);}catch(error){error.code='TARGET_CHANGED';throw error;}
     for(const side of Object.keys(railInputs))if(!now.rails[side]||!sameRailPose(now.rails[side],expected.rails[side])){const error=Error('rail-state-changed-during-passive-lidar-read:'+side);error.code='RAIL_STATE_CHANGED';throw error;}};
   const data=await N.capture({viewer:c.viewer,rails:railInputs,associationByRail,origin:c.frame?.origin||[0,0,0],enums:window.Potree||{},guard,pause:yieldToPage,
     captureId:request.captureId||K.uid(),visitId:request.visitId||null,viewObservation:expected.viewObservation||initial.viewObservation,onCheckpoint:request.onCheckpoint,
     maxNodes:512,maxPointsPerRail:50000,maxInspected:500000,maxMillis:1800,yieldEvery:65536,sliceMs:5,probeCount:33,checkpointPoints:2048,
     meta:{version:K.VERSION,sessionId:pageId,identity:expected.identity,part:expected.identity.part,cut:expected.identity.cut,shape:expected.identity.shape,
       coordinateBridge:{sceneFrameId:expected.identity.frameId,captureSceneRelativeToSessionSceneRelative:C.identity()},datasetIdentity:'not-observed'}});
   const cameraAtEnd=nativeCameraMatrix(c.viewer,c.frame?.origin);
   const cameraMoved=Array.isArray(cameraAtStart)&&Array.isArray(cameraAtEnd)?cameraAtStart.some((value,index)=>Math.abs(value-cameraAtEnd[index])>1e-7):null;
   data.readStrategy={mode:'passive-prioritized-loaded-view',cameraChangedByBanane:false,railSelectionChangedByBanane:false,navigationChangedByBanane:false,
     maximumPointsPerRail:50000,maximumInspected:500000,maximumMillis:1800,maximumLoadedNodes:512,yieldEvery:65536,progressiveCheckpointPoints:2048,
     pacing:'time-slices',sliceMs:5,yieldMechanism:typeof scheduler!=='undefined'&&typeof scheduler.yield==='function'?'scheduler.yield':typeof MessageChannel==='function'?'message-channel':'timeout',
     guard:'identity-and-rail-pose',guardCalls:guards,cameraMoveTerminatesRead:false,cameraMovedDuringRead:cameraMoved};
   return data;
 }
 async function waitFor(check,message,timeout=P.attenteMs,guard=()=>{}){const start=Date.now();let last;
   while(Date.now()-start<timeout){if(cancelled)throw Error('Action interrompue.');guard();try{const value=check();if(value)return value;}catch(e){last=e;}
     await sleep(P.sondageMs);}throw Error(message+(last?' '+last.message:''));}
 function assertExpected(expected){const now=snapshot();K.assertTarget(expected.identity||expected,now.identity);return now;}
 function nativeClick(id){const button=document.getElementById(id);if(!button||button.disabled)throw Error('Commande ESV indisponible : '+id);button.click();}
 function nativeDecision(operatorDecision){
   if(operatorDecision==='VALIDATE'){nativeClick(selectors.validate);return {commandSent:true,command:'VALIDATE'};}
   if(operatorDecision!=='SKIP')throw Error('Décision opérateur inconnue.');
   // No SKIP button or server endpoint has been observed. Relay the documented
   // ESV shortcut to its own keyboard handler; never substitute Next Invalid.
   const init={key:'Backspace',code:'Backspace',shiftKey:true,ctrlKey:false,metaKey:false,altKey:false,bubbles:true,cancelable:true,composed:true};
   document.dispatchEvent(new KeyboardEvent('keydown',init));
   document.dispatchEvent(new KeyboardEvent('keyup',init));
   return {commandSent:true,command:'SKIP'};
 }
 async function captureOnce(expected,guard){guard();const c=context();
   const data=await L.capture({viewer:c.viewer,rails:['left','right'].map(s=>railState(c.pair[s])),origin:c.frame.origin,enums:window.Potree||{},guard,
     meta:{version:K.VERSION,captureId:K.uid(),sessionId:pageId,visitId:`${c.frame.id}:${c.identity.part}:${c.identity.cut}`,
       identity:c.identity,part:c.identity.part,cut:c.identity.cut,shape:c.identity.shape,railStateProvenance:'observed-before',
       coordinateBridge:{sceneFrameId:c.frame.id,captureSceneRelativeToSessionSceneRelative:C.identity()},datasetIdentity:'not-observed'}});
   guard();return data;}
 /* SIGNATURE DU NIVEAU DE DÉTAIL CHARGÉ.
  *
  * Appelée à chaque itération de `waitFor`, donc toutes les 80 ms pendant toute
  * l'attente de stabilisation — 2,4 s par rail en médiane sur le terrain.
  *
  * L'ancienne version sérialisait DEUX fois : un `JSON.stringify` par nœud
  * (jusqu'à 512), puis un tri de ces chaînes, puis un second `JSON.stringify`
  * de l'ensemble. On n'a besoin que de savoir si quelque chose a changé : une
  * empreinte numérique commutative suffit, elle ne demande ni tri ni chaînes
  * intermédiaires, et elle se compare en un test d'égalité.
  *
  * Commutative et donc insensible à l'ordre des nœuds, comme l'était le tri
  * qu'elle remplace. La valeur reste une chaîne pour que l'appelant, inchangé,
  * continue de comparer par `!==`. */
 /* Déléguée à `src/lod-signature.js` : une fonction dont une collision coûterait
  * la lecture d'un nuage incomplet doit pouvoir s'auditer et se tester seule.
  * Voir ce fichier pour le raisonnement et tests/lod-signature.test.cjs pour les
  * sept propriétés de discrimination vérifiées. */
 const SIG=window.BananeLodSignature;
 function loadedSignature(){
   const id=o=>o&&typeof o==='object'?objectId(o):'';
   return SIG.signature(L.inventory(context().viewer),id);
 }
 async function capture(expected,progress=()=>{}){cancelled=false;const captures=[],attempts=[],startedAt=Date.now();
   const maxAttemptsPerView=P.tentativesParVue,stableForMs=P.stabiliteMs,budgetMs=P.budgetCaptureMs;
   const guard=()=>{if(cancelled)throw Error('Export interrompu.');const now=assertExpected(expected);
     if(!K.equalPoses(now.rails,expected.rails))throw Error('Rails modifiés pendant la lecture.');
     if(Date.now()-startedAt>=budgetMs)throw Error('Lecture LiDAR instable : délai total de 60 secondes atteint.');};
   for(const side of ['left','right']){
     guard();await select(side,expected,guard);
     for(let attempt=1;attempt<=maxAttemptsPerView;attempt++){
       const began=Date.now();guard();progress('capture-wait',{side,attempt,maxAttemptsPerView});
       try{
         let previous=null,unchangedSince=Date.now();
         await waitFor(()=>{const signature=loadedSignature();
           if(signature.value!==previous){previous=signature.value;unchangedSince=Date.now();}
           return signature.count>0&&Date.now()-unchangedSince>=stableForMs;
         },'Niveau de détail non stabilisé.',12000,guard);
         guard();progress('capture-read',{side,attempt});
         const data=await captureOnce(expected,guard);guard();
         attempts.push({side,attempt,status:'captured',durationMs:Date.now()-began});captures.push(data);
         progress('capture-view-ready',{side,attempt,points:data.pointsSceneRelative.length});break;
       }catch(e){
         // Never retain points from a failed attempt or retry after a moved rail,
         // a different cut, Stop, or an exhausted overall budget.
         guard();if(!K.transientCaptureError(e))throw e;
         attempts.push({side,attempt,status:'discarded',message:e.message,durationMs:Date.now()-began});
         progress('capture-retry',{side,attempt,maxAttemptsPerView,message:e.message});
         if(attempt===maxAttemptsPerView)throw Error(`Lecture LiDAR instable : rail ${side==='left'?'gauche':'droit'} après ${attempt} tentatives. ${e.message}`);
       }
     }
   }
   guard();const data=window.BananeMerge3.merge(...captures);guard();
   data.readStrategy={maxAttemptsPerView,stableForMs,budgetMs,durationMs:Date.now()-startedAt,attempts};
   progress('capture-ready',{attempts:attempts.length,points:data.pointsSceneRelative.length});return data;
 }
 /* Projection d'un point scene-relative dans la vue courante. Définition UNIQUE
  * de « dans la vue » : celle dont dépend le clic, partagée par l'attente de
  * sélection et par le garde d'émission, pour qu'elles ne puissent pas diverger. */
 function projectToView(cam,point){
   if(!cam||!cam.viewport||!Array.isArray(point))return null;
   const ndc=C.point(C.multiply(cam.projection,cam.sceneRelativeToCamera),point);
   return {ndc,viewport:cam.viewport,inView:!ndc.some(v=>v < -1||v>1)};
 }
 /* Un refus d'émission doit être explicable sans rejeu : repère, source, cible,
  * centre de vue, NDC par composante et bornes retenues. */
 function refusalDetail(side,now,target,cam,view){
   const fmt=p=>Array.isArray(p)?p.map(v=>Number(v).toFixed(6)).join(', '):'non-observé';
   const reason=!cam?'caméra non lisible':!cam.viewport?'viewport absent'
     :'hors bornes : '+['x','y','z'].filter((_,i)=>Math.abs(view.ndc[i])>1).join('+');
   return `[repère=scene-relative frameId=${now.identity.frameId??'non-observé'}`
     +` ; source=(${fmt(now.rails[side]?.positionSceneRelative)}) ; cible=(${fmt(target)})`
     +` ; centre de vue=(${fmt(cam?.cameraToSceneRelative?.slice(12,15))})`
     +` ; ndc=(${fmt(view?.ndc)}) ; bornes=[-1,1] par composante`
     +` ; viewport=${cam?.viewport?`${cam.viewport.width.toFixed(1)}x${cam.viewport.height.toFixed(1)}px`:'absent'}`
     +` ; raison=${reason}]`;
 }
 /* SÉLECTION D'UN RAIL — incident terrain du 21/09/2026, cut 3560.
  *
  * Une caméra IMMOBILE n'est pas un rail SÉLECTIONNÉ. ESV recentre sa vue
  * orthographique sur le rail cliqué de façon asynchrone : « inchangée depuis
  * trois lectures » se lit exactement comme « pas encore partie », et comme
  * « jamais partie ». Attendre la seule stabilité rendait donc la main avec la
  * caméra du rail PRÉCÉDENT.
  *
  * Ce n'est pas rattrapable en aval : la vue mesurée sur les 66 vues du lot
  * terrain fait 0,4 unité de scène, l'entraxe des rails 1,50 — 3,75 fois plus.
  * Les deux rails ne peuvent jamais coexister dans la vue, et le rail non
  * sélectionné projette à |ndc| ≈ 7,4. L'attente doit donc observer le rail
  * DEMANDÉ revenu dans la vue, en plus de la stabilité.
  *
  * Le prédicat reste la condition dont dépend le clic — aucun seuil d'amplitude
  * n'est introduit : le rail sélectionné projette à ndc ≈ 0, l'autre à ≈ 7,4. */
 async function select(side,expected,guard=()=>assertExpected(expected)){guard();nativeClick(selectors[side]);
   let previous=null,stable=0;
   await waitFor(()=>{const now=assertExpected(expected);const c=context(),cam=L.cameraSnapshot(c.viewer,c.frame.origin);
     if(!cam)return false;const value=JSON.stringify(cam.cameraToSceneRelative);stable=value===previous?stable+1:0;previous=value;
     if(stable<P.lecturesStables)return false;
     return !!projectToView(cam,now.rails[side]?.positionSceneRelative)?.inView;},
     'Vue ESV non recentrée sur le rail '+side+'.',P.attenteMs,guard);}
 async function clickPosition(side,target,expected){
   await select(side,expected);const now=assertExpected(expected);const c=context(),cam=L.cameraSnapshot(c.viewer,c.frame.origin);
   const view=projectToView(cam,target);
   if(!view?.inView)throw Error('Position proposée hors de la vue : '+side+' '+refusalDetail(side,now,target,cam,view));
   const r=view.viewport,ndc=view.ndc;
   c.viewer.renderer.domElement.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window,
     clientX:r.left+(ndc[0]+1)*r.width/2,clientY:r.top+(1-ndc[1])*r.height/2,button:0,buttons:1}));
   return waitFor(()=>{const now=assertExpected(expected);return C.distance(now.rails[side].positionSceneRelative,target)<=.001?now:false;},
     'Le clic n’a pas produit le déplacement demandé pour '+side+'. État à réconcilier.',P.attenteClicMs);
 }
 async function apply(before,proposals){cancelled=false;const now=assertExpected(before);
   if(!K.equalPoses(now.rails,before.rails))throw Error('Rails modifiés avant l’application.');
   const expected=K.expectedPoses(before,proposals);
   for(const s of ['left','right']){if(cancelled)throw Error('Action interrompue.');await clickPosition(s,expected[s].positionSceneRelative,before.identity);}
   return snapshot();}
 async function restore(before){cancelled=false;assertExpected(before);
   for(const s of ['left','right'])await clickPosition(s,before.rails[s].positionSceneRelative,before.identity);return snapshot();}
 async function next(identity){cancelled=false;assertExpected(identity);nativeClick(selectors.next);
   const target=await waitFor(()=>{const n=cutLabel();return n&&K.key(n)!==K.key(identity)?n:false;},'Aucun changement de cut après navigation.');
   return waitFor(()=>{const now=snapshot();return K.key(now.identity)===K.key(target)?now:false;},'Le cut suivant est affiché, mais ses rails ne sont pas encore disponibles.');}
 /* NAVIGATION SANS DÉCISION — Banane 4.7.
  *
  * CE QUE LE CODE ACCESSIBLE ÉTABLIT. `O2N3DCutNextInvalid3DRail` est un bouton
  * ESV relevé dans les sources Banane V2–V2.4.2 (audit-corpus.md, A5), déjà
  * câblé ici par `next()` depuis la V3. Il n'est ni `O2N3DCutValidate3DRail` ni
  * le raccourci SKIP : DECISIONS.md pose explicitement que le chemin SKIP ne
  * passe PAS par lui. C'est donc la seule commande native observée du dépôt qui
  * change de cut sans porter de décision.
  *
  * L'ÉQUIVALENCE AVEC MAJ+Z EST ÉTABLIE — inspection terrain du 20/09/2026.
  * Le JavaScript ESV réellement chargé dans Edge a été lu. Son gestionnaire
  * clavier contient `e.shiftKey && 90 == e.which ? t.buttonNextInvalidCut()`, et
  * le bouton est câblé par `$('#O2N3DCutNextInvalid3DRail').click(function(){
  * t.buttonNextInvalidCut() })`. Les deux chemins convergent donc sur la MÊME
  * fonction native, `buttonNextInvalidCut()`, qui appelle
  * `loadNextInvalidCut('positive')`.
  *
  * Les chemins décisionnels sont séparés dans ce même code :
  * `buttonValidateRail()` et `buttonValidateRailAndNext()` passent par
  * `railPairUpdated(…, 'valid', …)`, `buttonSkipRail()` par
  * `railPairUpdated(…, 'skipped', …)`. Le chemin utilisé ici n'en touche aucun :
  * le contrat « navigation sans décision » est donc observé, pas supposé.
  *
  * CE QUE CELA NE REND PAS GARANTI. Cette preuve vient de l'observation du code
  * chargé, pas d'une documentation du fournisseur : `buttonNextInvalidCut`,
  * `loadNextInvalidCut` et l'identifiant DOM restent des symboles internes non
  * publiés, susceptibles de changer à une mise à jour d'ESV (KI-026). C'est une
  * intégration, pas un contrat public.
  *
  * POURQUOI PAS UN KeyboardEvent « Z » MALGRÉ TOUT. L'inspection montre bien un
  * gestionnaire clavier, mais le défaut 6 d'AUDIT_PILOTE.md rappelle qu'un
  * KeyboardEvent dispatché ne prouve pas sa prise en compte. Le bouton atteint
  * la même fonction et rend, lui, un état vérifiable avant l'action (présence,
  * `disabled`) : il reste le chemin retenu.
  *
  * AUCUN REPLI. Commande absente, désactivée ou cible différente : l'opération
  * rend un refus AVANT toute émission. Ni VALIDATE, ni SKIP, ni saisie d'un
  * numéro de cut ne remplacent cette action.
  *
  * Les refus sont RENDUS, pas levés : une exception ne traverse le bridge que
  * sous forme de message, ce qui perdrait la distinction entre « rien n'est
  * parti » et « on ne sait pas ». */
 async function nextWithoutDecision(identity,scope={},operationId=null,progress=()=>{}){
   const startedAt=new Date().toISOString();
   const evidence={format:'banane-next-without-decision-v1',operationId:operationId??null,
     action:'NEXT_WITHOUT_DECISION',trigger:'observed-esv-next-invalid-rail-button',startedAt,
     command:commandInfo(selectors.next),
     /* Établie par inspection du JavaScript ESV chargé, pas par une
      * documentation du fournisseur : `source` et `stability` le disent, pour
      * que l'export ne laisse jamais lire un contrat public là où il n'y a
      * qu'une intégration observée. */
     shortcutEquivalence:{claimedShortcut:'Maj+Z',established:true,
       basis:'inspection terrain du JavaScript ESV : le gestionnaire clavier (e.shiftKey && 90 == e.which) et #O2N3DCutNextInvalid3DRail appellent tous deux buttonNextInvalidCut(), qui appelle loadNextInvalidCut("positive")',
       verification:'confirmé par inspection directe du JavaScript ESV dans Edge le 2026-09-20',
       observedPath:['keydown shiftKey && which===90','buttonNextInvalidCut()','loadNextInvalidCut("positive")'],
       buttonPath:['#O2N3DCutNextInvalid3DRail click','buttonNextInvalidCut()','loadNextInvalidCut("positive")'],
       decisionPathsObservedSeparate:{
         validate:'buttonValidateRail() / buttonValidateRailAndNext() → railPairUpdated(…, "valid", …)',
         skip:'buttonSkipRail() → railPairUpdated(…, "skipped", …)'},
       source:'observation du code ESV chargé, non documentation fournisseur',
       stability:'symboles et identifiant DOM internes ESV, non documentés publiquement : susceptibles de changer (KI-026)'},
     /* Corrélation réellement disponible : ESV ne renvoie pas d'identifiant
      * d'opération. Elle tient à la requête/réponse du bridge, qui relie cette
      * preuve à UN appel, et au contrôle de cible fait dans la page juste avant
      * l'action. Une navigation manuelle concurrente reste hors de portée. */
     correlation:{operationId:operationId??null,source:'banane-bridge-request-response',
       esvEchoesOperationId:false,targetVerifiedInPageBeforeCommand:false,
       concurrentManualNavigationExcluded:false},
     operatorDecision:null,decisionCommand:null,commandScope:'banane-operation-only',
     bananeValidated:false,applyCommandSent:false,validationCommandSent:false,skipCommandSent:false,
     commandRequested:true,commandInvoked:false,commandSent:false,invokedAt:null,
     beforeNavigationIdentity:null,navigationObserved:false,serverConfirmed:false,afterObserved:false,
     nextIdentity:null,nextIdentityComplete:false,nextReady:null,navigationAfter:null,observedAt:null,refusal:null};
   const refuse=(code,message)=>{evidence.refusal={code,message,at:new Date().toISOString()};return evidence;};
   /* D1, revue Astra. ANNULATION PORTÉE PAR L'OPÉRATION.
    *
    * `cancelled` est un drapeau de module que CHAQUE entrée de l'adaptateur
    * remet à faux : une requête arrivée après un `cancel` effaçait donc
    * l'annulation et cliquait quand même. `cancelledOperations` ne l'est
    * jamais — aucune autre requête, aucun callback tardif n'en retire une
    * entrée — et le contrôle vaut quel que soit l'ordre d'arrivée des deux
    * messages. C'est ce qui rend l'annulation corrélée à SON opération.
    *
    * `invokedOperations` garantit au plus UNE invocation par opération : un
    * message dupliqué ou rejoué ne peut pas produire un second clic. Il rend
    * alors `commandInvoked:'unknown'` — cet appel-ci n'a pas cliqué, mais
    * l'opération, elle, a déjà pu produire son effet. */
   if(operationId&&cancelledOperations.has(operationId))
     return refuse('CANCELLED_BEFORE_COMMAND','Opération annulée avant toute action : '+operationId);
   if(operationId&&invokedOperations.has(operationId)){
     evidence.commandInvoked='unknown';evidence.operationAlreadyInvoked=true;
     evidence.firstInvokedAt=invokedOperations.get(operationId);
     return refuse('OPERATION_ALREADY_INVOKED','Cette opération a déjà été invoquée une fois ; aucune seconde action.');
   }
   /* Le drapeau global est remis à faux pour que les attentes de CETTE
    * opération fonctionnent, comme le font les autres entrées de l'adaptateur.
    * Il est d'abord relevé : un `cancel` sans identifiant d'opération — un
    * délai de bridge sur une autre requête — est consigné, jamais silencieux. */
   evidence.inheritedBlanketCancel=cancelled===true;cancelled=false;
   // Identité complète vérifiée AU PLUS PRÈS du point d'effet, dans la page.
   let before;try{before=assertExpected(identity);}
   catch(e){return refuse('TARGET_MISMATCH_BEFORE_COMMAND',e.message);}
   evidence.beforeNavigationIdentity=K.completeIdentity(before.identity);
   evidence.correlation.targetVerifiedInPageBeforeCommand=true;
   /* Contexte d'exécution : un rechargement d'ESV crée un nouveau `pageId`, que
    * `assertExpected` refuse déjà. Le lot est revérifié ici, dans la page, au
    * plus près du point d'effet — pas seulement côté moteur avant l'attente. */
   if(scope&&scope.pageId!=null&&before.identity.pageId!==scope.pageId)
     return refuse('BATCH_CONTEXT_MISMATCH_BEFORE_COMMAND','Contexte de page différent de celui du lot.');
   if(scope&&scope.part!=null&&before.identity.part!==scope.part)
     return refuse('BATCH_CONTEXT_MISMATCH_BEFORE_COMMAND','Part affichée hors du lot : '+before.identity.part);
   // Observation armée avant l'action : le libellé de départ est lu d'abord.
   const startLabel=cutLabel();
   if(!startLabel||K.key(startLabel)!==K.key(identity))
     return refuse('TARGET_MISMATCH_BEFORE_COMMAND','Le cut affiché a changé avant la navigation sans décision.');
   if(cancelled)return refuse('CANCELLED_BEFORE_COMMAND','Action interrompue avant émission.');
   const button=document.getElementById(selectors.next);
   if(!button||button.disabled)return refuse('NAVIGATION_COMMAND_UNAVAILABLE','Commande ESV indisponible : '+selectors.next);
   progress('defer-before-command',{identity:evidence.beforeNavigationIdentity,operationId:evidence.operationId,command:evidence.command});
   /* D1. DERNIER INSTANT ENCORE RÉVOCABLE DANS LA PAGE. `progress()` poste un
    * message et les contrôles ci-dessus lisent le DOM : une annulation a pu
    * arriver entre-temps. Elle est donc relue ici, et plus rien ne s'intercale
    * entre ce contrôle et le clic. Une annulation connue de la page avant le
    * clic prouve la non-émission ; c'est la seule chose que la page puisse
    * prouver, et elle ne prétend rien au-delà. */
   if(operationId&&cancelledOperations.has(operationId))
     return refuse('CANCELLED_BEFORE_COMMAND','Opération annulée avant le clic : '+operationId);
   if(cancelled)return refuse('CANCELLED_BEFORE_COMMAND','Action interrompue avant le clic.');
   /* Plus rien n'est révocable à partir d'ici : l'état inconnu est posé AVANT
    * l'appel, et n'est relevé qu'au retour. Une exception de la page laisse donc
    * « unknown », jamais un `false` rassurant. L'opération est marquée invoquée
    * AVANT le clic, pour qu'un doublon ne puisse pas en produire un second même
    * si celui-ci lève. */
   evidence.commandInvoked='unknown';
   if(operationId)invokedOperations.set(operationId,new Date().toISOString());
   try{button.click();}catch(e){return refuse('NAVIGATION_COMMAND_THREW',e.message);}
   evidence.commandInvoked=true;evidence.commandSent=true;evidence.invokedAt=new Date().toISOString();
   progress('defer-command-returned',{operationId:evidence.operationId,label:cutLabel()});
   const immediate=cutLabel();
   let nextLabel=immediate&&K.key(immediate)!==K.key(identity)?immediate:null;
   if(!nextLabel){
     try{nextLabel=await waitFor(()=>{const n=cutLabel();return n&&K.key(n)!==K.key(identity)?n:false;},
       'Navigation sans décision transmise, cut inchangé : aucune progression observée.',P.attenteNavigationMs);}
     catch(e){return refuse(cancelled?'CANCELLED_DURING_OBSERVATION':'NO_NAVIGATION_OBSERVED',e.message);}
   }
   evidence.navigationObserved=true;evidence.observedAt=new Date().toISOString();
   evidence.navigationAfter={label:nextLabel,observedAt:evidence.observedAt};
   progress('defer-navigation-observed',{operationId:evidence.operationId,nextIdentity:nextLabel});
   try{const ready=await waitFor(()=>{const now=snapshot();return K.key(now.identity)===K.key(nextLabel)?now:false;},
       'Le cut suivant est affiché, mais ses rails ne sont pas encore disponibles.',12000);
     evidence.nextReady=true;evidence.nextIdentity=K.completeIdentity(ready.identity);
     evidence.nextIdentityComplete=true;evidence.navigationAfter.identity=evidence.nextIdentity;}
   catch(e){evidence.nextReady=false;evidence.nextIdentity=K.completeIdentity(nextLabel);
     evidence.nextIdentityComplete=false;evidence.nextIdentityUnavailableReason=e.message;
     progress('defer-next-geometry-unavailable',{operationId:evidence.operationId,message:e.message,nextIdentity:nextLabel});}
   evidence.meaning='Navigation ESV sans décision : Banane n’a émis pour ce cut ni application de rail, ni VALIDATE, ni SKIP ; confirmation serveur indisponible.';
   return evidence;
 }
 async function decisionAndNext(identity,operatorDecision,scope={},progress=()=>{}){
   cancelled=false;const beforeCommand=assertExpected(identity),startedAt=new Date().toISOString();
   const command=operatorDecision==='VALIDATE'?commandInfo(selectors.validate):{id:'Shift+Backspace',exists:true,disabled:false};
   const navigationSemantics=operatorDecision==='VALIDATE'&&command.id===selectors.validate&&
     /load\s+next\s+non[-\s]?validated\s+cut/i.test(command.title)
     ?'VALIDATE_NEXT_NON_VALIDATED_CUT':null;
   progress('decision-before-command',{identity:beforeCommand.identity,operatorDecision,command});
   /* RELECTURE IMMÉDIATE APRÈS LA COMMANDE.
    *
    * Le bouton de validation d'ESV valide ET navigue. `src/engine.js`, gelé,
    * ARRÊTE le lot quand la relecture sur la même identité échoue (ligne 171
    * puis 257). Terrain du 15/09 : 12 lots arrêtés sur 12, ici même.
    *
    * HONNÊTETÉ SUR CE CHANGEMENT : rapprocher la relecture du clic ne corrige
    * PAS le défaut observé. Ni la construction de l'objet ni `progress(...)`
    * ne rendent la main à la boucle d'événements — il n'y avait donc aucun
    * yield à supprimer entre les deux. Si ESV change son libellé de façon
    * synchrone dans le gestionnaire de clic, ce qui est ce que montrent les
    * journaux, la relecture échouait avant et échoue encore.
    *
    * Le changement est conservé parce qu'il est gratuit et strictement meilleur
    * dans le cas où le gestionnaire d'ESV serait asynchrone, et parce qu'il
    * rend la séquence lisible. Il ne doit pas être présenté comme un correctif.
    * Le vrai défaut est architectural et décrit dans AUDIT_PILOTE.md. */
   const sent=nativeDecision(operatorDecision);
   let apres=null,apresErreur=null;
   try{const vu=snapshot();K.assertTarget(identity,vu.identity);apres=vu;}catch(e){apresErreur=e;}
   const evidence={trigger:operatorDecision==='VALIDATE'?'observed-legacy-validation-button':'relayed-native-skip-shortcut',startedAt,
     operatorDecision,decisionCommand:command,navigationSemantics,commandSent:sent.commandSent===true,afterObserved:false,serverConfirmed:false,navigationObserved:false,
     afterStateStatus:'PENDING',beforeNavigationIdentity:K.completeIdentity(beforeCommand.identity),afterState:null,nextIdentity:null,nextReady:null};
   progress('decision-command-returned',{operatorDecision,label:cutLabel()});
   try{
     if(apresErreur)throw apresErreur;
     const after=apres;evidence.afterObserved=true;evidence.afterState=after;evidence.afterStateStatus='OBSERVED_SAME_TARGET';
     progress('decision-after-observed',{identity:after.identity});
   }catch(e){
     const label=cutLabel();
     if(label&&K.key(label)!==K.key(identity))evidence.afterStateStatus='AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED';
     else throw e;
   }
   const changed=cutLabel();
   const nextLabel=changed&&K.key(changed)!==K.key(identity)?changed:await waitFor(()=>{const n=cutLabel();return n&&K.key(n)!==K.key(identity)?n:false;},
     `${operatorDecision} transmis, résultat non confirmé : le cut n’a pas changé.`,P.attenteNavigationMs);
   evidence.navigationObserved=true;evidence.navigationAfter={label:nextLabel,observedAt:new Date().toISOString()};
   progress('navigation-observed',{nextIdentity:nextLabel});
   if(identity.cut<(scope.end??Infinity)&&nextLabel.part===(scope.part??nextLabel.part)&&nextLabel.cut<=(scope.end??Infinity)){
     try{const ready=await waitFor(()=>{const n=snapshot();return K.key(n.identity)===K.key(nextLabel)?n:false;},'Le cut suivant est affiché mais ses rails ne sont pas prêts.',12000);
       evidence.nextReady=true;evidence.nextIdentity=K.completeIdentity(ready.identity);}
     catch(e){evidence.nextReady=false;evidence.nextIdentity=K.completeIdentity(nextLabel);progress('next-geometry-unavailable',{message:e.message,nextIdentity:nextLabel});}
   }else evidence.nextIdentity=K.completeIdentity(nextLabel);
   evidence.meaning=evidence.afterObserved?'État après commande relu sur la même identité ; navigation observée ; confirmation serveur indisponible.':'Navigation observée avant relecture de l’état après ; confirmation serveur indisponible.';
   return evidence;
 }
 const validateAndNext=(identity,scope,progress)=>decisionAndNext(identity,'VALIDATE',scope,progress);
 const skipAndNext=(identity,scope,progress)=>decisionAndNext(identity,'SKIP',scope,progress);
 let manual=null,manualChannel=null,manualBanner=null;const manualRequests=new Map(),manualListeners=[];
 function manualMessage(type,payload){const requestId=K.uid();return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{manualRequests.delete(requestId);reject(Error('Enregistrement sans accusé de réception. Aucune commande ESV n’est relancée.'));},10000);
   manualRequests.set(requestId,{resolve,reject,timer,channel:manualChannel});
   window.postMessage({kind:'banane4:manual-event',channel:manualChannel,requestId,type,payload},location.origin);
 });}
 window.addEventListener('message',e=>{if(e.source!==window||e.origin!==location.origin||e.data?.kind!=='banane4:manual-ack')return;
   const pending=manualRequests.get(e.data.requestId);if(!pending||pending.channel!==e.data.channel)return;
   manualRequests.delete(e.data.requestId);clearTimeout(pending.timer);if(e.data.error)pending.reject(Error(e.data.error));else pending.resolve(e.data.result);
 });
 async function manualStart(options){
   if(manual?.active)throw Error('Une session de corrections est déjà active dans ESV.');
   manualChannel=options.channel;cancelled=false;
   manual=new window.BananeManualPage4.Collector({state:snapshot,label:cutLabel,capture,
     settle:async label=>{let previous=null,stable=0;return waitFor(()=>{
       const now=snapshot();if(K.key(now.identity)!==K.key(label))return false;
       const signature=JSON.stringify([now.mapping,now.rails]);stable=signature===previous?stable+1:0;previous=signature;return stable>=P.lecturesStables?now:false;
     },'Les rails du cut ne sont pas prêts.',12000,()=>{const now=cutLabel();if(!now||K.key(now)!==K.key(label))throw Error('Le cut a changé pendant sa préparation.');});},
     left:before=>select('left',before),nativeDecision,cancel:async()=>{cancelled=true;},
     send:manualMessage,now:()=>Date.now(),interval:(fn,ms)=>setInterval(fn,ms),clearInterval:id=>clearInterval(id),
     install:handler=>{const relay=e=>{if(e.source!==window||e.origin!==location.origin||e.data?.kind!=='banane4:operator-input'||e.data.channel!==manualChannel)return;
       handler({...e.data.input,target:{kind:e.data.input.targetKind},preventDefault(){},stopImmediatePropagation(){}});};
       window.addEventListener('message',relay);manualListeners.push(['message',relay]);},
     uninstall:()=>{for(const [type,handler] of manualListeners.splice(0))window.removeEventListener(type,handler,true);},
     editable:el=>!!el?.closest?.('input,textarea,select,[contenteditable="true"]'),
     isValidation:el=>el?.kind==='validation',isCanvas:el=>el?.kind==='canvas',
     paint:message=>{if(!manualBanner){manualBanner=document.createElement('div');
       manualBanner.style.cssText='position:fixed;left:12px;bottom:12px;z-index:2147483646;max-width:520px;padding:10px 14px;background:#18191b;color:#f4db72;border:1px solid #625a34;border-radius:8px;font:14px Arial;pointer-events:none';
       manualBanner.setAttribute('role','status');document.documentElement.append(manualBanner);}
       manualBanner.textContent=message;
       window.postMessage({kind:'banane4:manual-phase',channel:manualChannel,phase:manual?.phase||'PREPARING'},location.origin);}
   });return manual.start(options);
 }
 let native=null,nativeChannel=null,nativeFailureBanner=null;const nativeRequests=new Map(),nativeListeners=[];
 function nativeMessage(type,payload){const requestId=K.uid();return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{nativeRequests.delete(requestId);reject(Error('Sauvegarde Natif sans accusé de réception.'));},10000);
   nativeRequests.set(requestId,{resolve,reject,timer,channel:nativeChannel});
   window.postMessage({kind:'banane4:native-event',channel:nativeChannel,requestId,type,payload},location.origin);
 });}
 window.addEventListener('message',e=>{if(e.source!==window||e.origin!==location.origin||e.data?.kind!=='banane4:native-ack')return;
   const pending=nativeRequests.get(e.data.requestId);if(!pending||pending.channel!==e.data.channel)return;
   nativeRequests.delete(e.data.requestId);clearTimeout(pending.timer);if(e.data.error)pending.reject(Error(e.data.error));else pending.resolve(e.data.result);
 });
 function nativeApi(){return {snapshot:nativeSnapshot,capture:nativeCapture,send:nativeMessage,now:()=>Date.now(),performanceNow:()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now(),
   interval:(fn,ms)=>setInterval(fn,ms),clearInterval:id=>clearInterval(id),defer:fn=>setTimeout(fn,0),
   /* Détection immédiate du changement de cut : l'étiquette ESV est observée
    * au lieu d'attendre le prochain relevé périodique (125 ms). Le relevé reste
    * actif : l'observateur n'est qu'un déclencheur de plus, sans effet sur ESV. */
   watch:handler=>{const node=document.getElementById(selectors.label);if(!node||typeof MutationObserver!=='function')return false;
     /* Seul un TEXTE différent déclenche : une réécriture à l'identique par
      * ESV, même répétée à chaque image, ne coûte qu'une comparaison. */
     let last=node.textContent;const observer=new MutationObserver(()=>{const text=node.textContent;if(text===last)return;last=text;handler();});
     observer.observe(node,{characterData:true,childList:true,subtree:true});
     nativeListeners.push(['mutation',observer,null]);return true;},
   install:handler=>{const relay=e=>{if(e.source!==window||e.origin!==location.origin||e.data?.kind!=='banane4:native-input'||e.data.channel!==nativeChannel)return;
     const input=e.data.input;handler({...input,target:{kind:input.targetKind}});};window.addEventListener('message',relay);nativeListeners.push(['message',relay,false]);},
   uninstall:()=>{for(const [type,handler,options] of nativeListeners.splice(0)){if(type==='mutation')handler.disconnect();else window.removeEventListener(type,handler,options);}},
   editable:el=>el?.kind==='input'||!!el?.closest?.('input,textarea,select,[contenteditable="true"]'),
   targetKind:el=>el?.kind|| (el?.closest?.('#O2N3DCutValidate3DRail')?'validation':el?.closest?.('canvas')?'canvas':el?.closest?.('button,a')?'control':'other'),
   signalFailure:message=>{if(nativeFailureBanner)return;nativeFailureBanner=document.createElement('div');nativeFailureBanner.style.cssText='position:fixed;left:12px;bottom:12px;z-index:2147483646;max-width:520px;padding:10px 14px;background:#381f23;color:#ffd7dc;border:1px solid #8b5058;border-radius:8px;font:14px Arial;pointer-events:none';
     nativeFailureBanner.setAttribute('role','alert');nativeFailureBanner.textContent=message;document.documentElement.append(nativeFailureBanner);}};}
 async function nativeStart(options){if(native?.active)throw Error('Le mode Natif est déjà actif dans ESV.');nativeChannel=options.channel;
   native=native||new window.BananeNativePage4.Observer(nativeApi());return native.start(options);}
 async function nativeResume(options){nativeChannel=options.channel;native=native||new window.BananeNativePage4.Observer(nativeApi());return native.resume(options);}
 const methods={ping:()=>({version:K.VERSION,pageId,label:cutLabel()}),state:snapshot,nativeSnapshot,capture,apply,restore,next,nextWithoutDecision,validateAndNext,skipAndNext,
   manualStart,manualPause:async()=>manual?manual.pause():{active:false},manualResume:async()=>manual?manual.resume():{active:false},
   manualFinish:async()=>manual?manual.finish():{active:false},nativeStart,nativePause:async()=>native?native.pause():{active:false},
   nativeResume,nativeFinish:async()=>native?native.finish():{active:false},
   /* Un `cancel` PORTANT un identifiant d'opération est retenu pour elle seule
    * et définitivement : plus aucune requête, si tardive soit-elle, ne la
    * réautorise. Sans identifiant — un délai de bridge, par exemple — il garde
    * son ancien sens global, qui ne concerne que l'attente en cours. */
   cancel:async(options=null)=>{cancelled=true;
     const operationId=options&&typeof options==='object'&&typeof options.operationId==='string'?options.operationId:null;
     if(operationId)cancelledOperations.add(operationId);
     return {cancelRequested:true,operationId,scopedCancelledOperations:cancelledOperations.size};}};
 window.__BANANE_V3_PAGE={version:K.VERSION};
 // The isolated content script supplies a fresh per-document channel. It is a
 // routing nonce, not a claim that a hostile page is a security boundary.
 window.addEventListener('message',async e=>{if(e.source!==window||e.origin!==location.origin||e.data?.kind!=='banane3:command')return;
   const {id,channel,action,args=[]}=e.data;if(typeof id!=='string'||typeof channel!=='string'||!Object.hasOwn(methods,action))return;
   if(['manualStart','nativeStart','nativeResume'].includes(action))args[0]={...args[0],channel};
   const progress=(stage,detail={})=>window.postMessage({kind:'banane3:progress',id,channel,stage,detail},location.origin);
   try{progress('received');const result=await methods[action](...args,progress);window.postMessage({kind:'banane3:result',id,channel,result},location.origin);}
   catch(error){window.postMessage({kind:'banane3:result',id,channel,error:error.message},location.origin);}});
})();
