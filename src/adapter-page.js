/* Real ESV page adapter. Selectors originate in Banane V2–V2.4.2 sources.
 * No server URL/payload is invented. Canvas clicks and navigation require readback.
 */
(()=>{'use strict';
 /* Une autre Ariane s'est installée entre notre tampon et nos fichiers : on
  * n'installe rien, et notre tampon ne doit pas rester dans la page. */
 if(window.__BANANE_V3_PAGE){try{delete window.__ARIANE_PROPRIETAIRE;}catch{}return;}
 /* D1 (4.8.5, D-060) — L'ADAPTATEUR GARDE SES MODULES ET N'OBÉIT QU'À SON
  * PROPRIÉTAIRE. Le monde principal de la page est commun à toutes les
  * extensions : une autre Ariane qui injecte ses fichiers après nous remplace
  * les modules globaux (`window.Banane…`), et son bridge envoie ses commandes
  * sur la même page. Les modules sont donc lus UNE fois, ici ; le tampon posé
  * par le service worker juste avant l'injection désigne le propriétaire. */
 const C=window.BananeCaptureCore,L=window.BananeLidar,N=window.BananeNativeLidar4,K=window.BananeCore3;
 const M3=window.BananeMerge3,MP4=window.BananeManualPage4,NP4=window.BananeNativePage4,GV=window.BananeGestesVue||null;
 const PROPRIO=typeof window.__ARIANE_PROPRIETAIRE?.id==='string'?window.__ARIANE_PROPRIETAIRE.id:null;
 const PROPRIO_NOM=typeof window.__ARIANE_PROPRIETAIRE?.versionName==='string'?window.__ARIANE_PROPRIETAIRE.versionName:null;
 try{delete window.__ARIANE_PROPRIETAIRE;}catch{}
 /* Réglages du pilote : source unique dans src/settings.js. Repli sur les
  * anciennes valeurs codées en dur si le module n'est pas chargé, pour ne
  * jamais empêcher l'adaptateur de fonctionner. */
 const P=window.BananeSettings?.pilote||{tentativesParVue:3,stabiliteMs:800,budgetCaptureMs:60000,
   sondageMs:80,lecturesStables:3,attenteMs:12000,recentrages:3,attenteNavigationMs:15000,attenteClicMs:5000};
 const pageId=K.uid(),objects=new WeakMap(),frames=new WeakMap(),nativeFrames=new WeakMap(),nativeViews=new WeakMap();let frame=null,cancelled=false;
 /* D1. Annulations et invocations CORRÉLÉES À UNE OPÉRATION, par opposition au
  * drapeau `cancelled` que chaque entrée de l'adaptateur remet à faux. Ces deux
  * collections ne sont jamais vidées par une autre requête : une annulation
  * connue de la page reste connue, et une opération déjà invoquée ne peut pas
  * l'être une seconde fois. Elles vivent le temps du document, comme la page. */
 const cancelledOperations=new Set(),invokedOperations=new Map(),running=new Map();
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
 /* Objet « rail » de la scène : un Object3D avec un maillage et un profil qui
  * porte au moins une ligne. Partagé par `context()` et le relevé passif (D4). */
 function railCandidat(o){if(o.type!=='Object3D'||!o.children?.some(c=>c.type==='Mesh'))return null;
   return o.children.find(p=>p.children?.some(c=>c.type==='Line'))||null;}
 /* Ce que `context()` retient : un profil dont une ligne a ses sommets. */
 const railLu=o=>{const p=o&&railCandidat(o);return !!p&&p.children.some(c=>c.type==='Line'&&c.geometry?.attributes?.position);};
 function context(){
   if(window.__BANANE_V24||window.__BANANE_V23||window.__BANANE_V231||window.__BANANE_V2_LOADED__||window.__BANANE_V21_LOADED__||window.__BANANE_V22_LOADED__)throw Error('Une ancienne Banane (V2) est active. Désactive-la puis recharge ESV après sauvegarde.');
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
   for(const o of root.children||[]){if(o.type!=='Object3D')continue;const profile=railCandidat(o);if(!profile)continue;
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
     /* 4.7.3 : la découpe ESV fait partie de ce qui est chargé et visible. Sur
      * la collecte 4.7.2, ESV déplaçait sa boîte de découpe juste après le
      * changement de cut ; la lecture s'arrêtait (CLIP_CHANGED) et rien ne la
      * relançait, faute de nouveaux nœuds — 39 lectures, jusqu'à des visites de
      * 3,8 s sans instantané. Une découpe modifiée change donc l'époque. */
     const clips=(c.viewer.scene?.pointclouds||[]).map(pc=>{try{return L.clipSnapshot(pc,c.frame.origin,window.Potree||{});}catch(error){return {error:error.message};}});
     const loadSignature=JSON.stringify([tokens,clips]),signature='['+JSON.stringify(camera?.cameraToSceneRelative||null)+','+loadSignature+']',previous=nativeViews.get(c.root);
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
 /* V3, expériences I1 puis « turbo » (D-078, D-087, D-088 ; versions de test) : mode d'un cut.
  * Tirage fixe sur le numéro du cut (bit haut du hachage multiplicatif de Knuth) :
  * une relecture, une reprise ou un F5 gardent le mode, l'analyse le recalcule, et
  * les deux modes se mélangent tout au long du lot (pas de blocs : la vitesse dérive
  * de 19 à 22 % entre la première et la seconde moitié d'un lot). « rapide » passe
  * à `vendor/lidar.js`, inchangé, son option de pause existante ; « reference » ne
  * lui passe rien, comme la 4.9.0.5. Réglage absent ou inconnu : référence.
  * D-091 (4.9.0.9) : « echantillon » généralise le mode rapide et garde UN cut sur dix en
  * référence, pour surveiller la qualité : le cut est « référence » si son hachage tombe dans
  * le premier dixième (même hachage, lu comme une fraction). Le hachage de Fibonacci répartit
  * ces cuts régulièrement (un tous les 8 à 13 cuts consécutifs), sans paquets. */
 const DIXIEME=429496730; // ⌈2^32 / 10⌉
 function lectureDuCut(identity){const regle=P.modeRapide??P.lectureI1;
   if(regle==='toujours')return 'rapide';if(regle!=='tirage'&&regle!=='echantillon')return 'reference';
   const cut=identity?.cut;if(!Number.isInteger(cut))return 'reference';
   const h=Math.imul(cut>>>0,2654435761)>>>0;
   if(regle==='echantillon')return h<DIXIEME?'reference':'rapide';
   return h>>>31?'rapide':'reference';}
 /* D-088 (4.9.0.7, version de test) : ce que le mode « rapide » change, pièce par pièce, d'après les
  * mesures du banc ESV local (13 octobre, code d'origine d'ESV) :
  *   lecture   (I1) : lire sans attendre une image d'ESV (4.9.0.6) ;
  *   selection (I2) : le rail demandé est dans la vue dès l'image qui suit le clic (6 sur 6) ; on
  *                    attend cette image, et non plus trois sondages immobiles à 80 ms ;
  *   signal    (I3) : lire dès que plus rien ne charge (aucun chargement en cours et mêmes nœuds sur
  *                    deux images de suite) ; mêmes nœuds qu'après 800 ms dans 32 vues sur 32 ; la
  *                    règle des 800 ms reste le repli (chargement d'ESV pendu : le signal ne vient jamais) ;
  *   pose      (P1) : ESV pose le rail du côté courant au point du plan de coupe visé par le clic, même
  *                    hors de la vue : le bouton de rail fixe le côté, le clic part dans la même tâche,
  *                    calculé avec la caméra active ; sans attendre le recentrage (< 0,6 mm, 1 à 4 ms).
  * Chaque pièce se coupe seule dans les réglages ; une pièce qui ne conclut pas retombe sur la 4.9.0.5.
  * D-157 : `rapide.clicHumain` n'est pas une pièce (voir CLIC_HUMAIN, plus bas) ; il est lu à part. */
 const {clicHumain:REGLE_CLIC_HUMAIN,...PIECES_REGLEES}=P.rapide||{};
 const RAPIDE={lecture:true,selection:true,signal:true,pose:true,...PIECES_REGLEES};
 const piece=(mode,nom)=>mode==='rapide'&&RAPIDE[nom]!==false;
 /* Prochaine image d'ESV ; repli à 100 ms si la page ne dessine plus (onglet caché). */
 function prochaineImage(){return new Promise(resolve=>{let fini=false,minuterie=null;
   const fin=()=>{if(fini)return;fini=true;if(minuterie!==null)try{clearTimeout(minuterie);}catch{}resolve();};
   try{if(typeof requestAnimationFrame==='function')requestAnimationFrame(fin);}catch{}minuterie=setTimeout(fin,100);});}
 const imageEsv=()=>{const f=window.Potree?.framenumber;return Number.isFinite(f)?f:null;};
 const chargementsEsv=()=>{const n=window.Potree?.numNodesLoading;return Number.isFinite(n)?n:null;};
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
 async function captureOnce(expected,guard,lecture='reference'){guard();const c=context();
   const data=await L.capture({viewer:c.viewer,rails:['left','right'].map(s=>railState(c.pair[s])),origin:c.frame.origin,enums:window.Potree||{},guard,...(lecture==='rapide'?{pause:yieldToPage}:{}),
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
 let inventaireRecent=null;
 function loadedSignature(){
   const id=o=>o&&typeof o==='object'?objectId(o):'';
   const inv=L.inventory(context().viewer);inventaireRecent=inv;   // 4.9.5.3 : gardé pour le relevé de profondeur (diag), sans second parcours
   return SIG.signature(inv,id);
 }
 /* I3 : lire dès que plus rien ne charge. Prédicat (code de Potree 1.8 d'ESV) : au moins trois
  * images après le début de l'attente, puis deux images DISTINCTES de suite avec aucun chargement
  * en cours et la même signature. Un nœud visible non chargé aurait lancé un chargement à l'image
  * (compteur > 0) ; un nœud chargé non encore transféré l'aurait été (signature changée, deux par
  * image au plus). Repli inchangé : signature immobile pendant `stableForMs` (règle de la 4.9.0.5),
  * seule issue quand un chargement d'ESV reste pendu (un bloc en échec ne libère jamais sa place). */
 /* Relecture indépendante : Potree choisit les nœuds avec la caméra et la découpe de l'image
  * précédente. Les deux images du signal doivent donc aussi avoir la même caméra et la même
  * découpe, sinon un recadrage d'ESV à cette image-là passerait inaperçu. */
 function sceneEsv(){const c=context(),cam=L.cameraSnapshot(c.viewer,c.frame.origin);
   const boites=(c.viewer.scene?.pointclouds||[]).map(pc=>(pc.material?.clipBoxes||[]).map(b=>Array.from(b?.inverse?.elements||[]).join(',')).join(';')).join('|');
   return JSON.stringify(cam?.cameraToSceneRelative??null)+'#'+boites;}
 /* 4.9.5.1 (D-109) — DIAGNOSTIC DU SIGNAL, SANS RIEN CHANGER À LA DÉCISION. Sur le terrain, le signal
  * de fin de chargement s'éteint ~10 min après le chargement de la page ESV (tout passe au repli 800 ms),
  * et un F5 le rétablit. Pour savoir pourquoi, chaque lecture porte un petit relevé (`diag`), publié avec
  * l'étape `capture-read` (donc dans `lastDetail` du journal exporté) :
  *   ageS / navS : âge en secondes de l'adaptateur dans la page (chargement de ce script) / de la page
  *                 ESV (`performance.now()`, depuis la navigation : remis à zéro par un F5) ;
  *   img         : images d'ESV vues pendant l'attente ; nl : [chargements en cours à la fin, maximum vu] ;
  *   paires      : comparaisons d'une image à la précédente ; puis, parmi elles, celles où des chargements
  *                 étaient en cours (pc), où les nœuds avaient changé (nc), où la vue avait changé (vc) ;
  *   m           : au repli, la condition qui manquait à la dernière image comparée (« images » : moins
  *                 de 3 images ou compteur d'images absent ; « chargements » : `numNodesLoading` ≠ 0 ;
  *                 « noeuds » ; « vue » ; « aucune » : tout réuni sauf la seconde image) ; « hors-signal »
  *                 pour une lecture qui n'attend pas le signal (référence, relecture) ;
  *   noeuds, pts, lruPts, lruNoeuds, memMo : nœuds visibles lus, points visibles de Potree, points et nœuds
  *                 gardés par son cache (LRU), mémoire JS utilisée en Mo (Chrome seulement).
  * Coût : quelques comparaisons de nombres par image, un relevé de compteurs par lecture ; aucune attente,
  * aucune boucle ajoutée ; ~200 octets par lecture. Lu par `tools/signal-age.cjs`. */
 const ADAPTATEUR_CHARGE_A=Date.now();
 const nombreFini=v=>Number.isFinite(v)?v:undefined;
 /* 4.9.5.3 (S6) — relevés en lecture seule de la page ESV. Réglages : `BananeSettings.releves` / `.esvEvents`. */
 const REL=window.BananeSettings?.releves||{},ESVEV={ombre:true,noms:['railPairSelected','railPairUpdated','railPairSeen','loading','newPart'],parSecondeMax:30,...(window.BananeSettings?.esvEvents||{})};
 const relOn=nom=>REL[nom]!==false,NS_OMBRE='banane53';
 /* Posté à l'observateur (même monde) qui le réduit et le range ; jamais une commande, jamais une écriture. */
 const heurePage=()=>{try{const t=performance.now();return Number.isFinite(t)?t:null;}catch{return null;}};
 function posterObservateur(event){try{window.postMessage({kind:'banane5:evt',event},location.origin);}catch{}}
 /* Niveau d'un nœud Potree : `geometryNode.level` (ou `getLevel()`, ou `key.d` pour EPT), sinon la longueur du nom « r0123 » moins un. */
 function niveauNoeud(n){const g=n?.geometryNode||null;
   const essais=[()=>g?.level,()=>typeof g?.getLevel==='function'?g.getLevel():undefined,()=>g?.key?.d,()=>n?.level];
   for(const f of essais){try{const v=f();if(Number.isInteger(v)&&v>=0&&v<=64)return v;}catch{}}
   try{const nom=typeof g?.name==='string'?g.name:null;if(nom&&/^r[0-7]*$/.test(nom))return nom.length-1;}catch{}
   return null;}
 function niveauxNoeuds(inv){const nodes=inv?.nodes;if(!Array.isArray(nodes))return null;
   const v=nodes.map(niveauNoeud).filter(x=>x!==null).sort((a,b)=>a-b);
   return [v.length?v[0]:null,v.length?v[Math.floor((v.length-1)/2)]:null,v.length?v[v.length-1]:null,v.length,nodes.length];}
 function budgetPoints(){const vw=window.viewer;if(!vw)return null;
   let b;try{b=typeof vw.getPointBudget==='function'?vw.getPointBudget():vw.pointBudget;}catch{b=undefined;}
   return Number.isFinite(b)&&b>0?b:null;}
 function compteursEsv(sig){const d={ageS:Math.round((Date.now()-ADAPTATEUR_CHARGE_A)/1000)};
   try{const t=performance?.now?.();if(Number.isFinite(t))d.navS=Math.round(t/1000);}catch{}
   if(sig&&Number.isFinite(sig.count))d.noeuds=sig.count;
   try{let pts=0,vu=false;for(const pc of window.viewer?.scene?.pointclouds||context().viewer?.scene?.pointclouds||[]){const n=pc?.numVisiblePoints;if(Number.isFinite(n)){pts+=n;vu=true;}}if(vu)d.pts=pts;}catch{}
   try{const l=window.Potree?.lru;if(l){const a=nombreFini(l.numPoints),b=nombreFini(typeof l.size==='function'?l.size():l.elements);if(a!==undefined)d.lruPts=a;if(b!==undefined)d.lruNoeuds=b;}}catch{}
   try{const m=performance?.memory?.usedJSHeapSize;if(Number.isFinite(m))d.memMo=Math.round(m/1048576);}catch{}
   /* 4.9.5.3 (S6) : niveau d'octree des nœuds lus [min, médiane, max, nœuds au niveau connu, nœuds] (null si illisible) et budget de points du
    * lecteur (`getPointBudget()` ; null si absent). Lecture seule, sur l'inventaire déjà pris pour la signature. */
   if(relOn('diagCapture')){try{d.niv=niveauxNoeuds(inventaireRecent);}catch{d.niv=null;}try{d.bud=budgetPoints();}catch{d.bud=null;}}
   return d;}
 async function attendreChargement(guard,stableForMs){const debut=Date.now(),f0=imageEsv();
   let valeur=null,depuis=Date.now(),precedente=null,imagePrecedente=null,images=0,derniere=null;
   /* Diagnostic seulement (voir plus haut) : jamais lu par la décision. */
   let nlMax=null,paires=0,pc=0,nc=0,vc=0,manque='images';
   while(Date.now()-debut<12000){
     if(cancelled)throw Error('Action interrompue.');guard();
     /* Une lecture qui échoue est réessayée à l'image suivante, comme `waitFor` le faisait. */
     let sig,vue;try{sig=loadedSignature();vue=sceneEsv();}catch(e){derniere=e;precedente=null;await prochaineImage();continue;}
     const f=imageEsv(),nl=chargementsEsv(),libre=nl===0;
     if(nl!==null&&(nlMax===null||nl>nlMax))nlMax=nl;
     if(sig.value!==valeur){valeur=sig.value;depuis=Date.now();}
     if(f!==null&&f!==imagePrecedente){images++;
       if(f0!==null&&f-f0>=3&&libre&&precedente&&precedente.libre&&precedente.valeur===sig.value&&precedente.vue===vue&&sig.count>0)
         return {regle:'signal',images,diag:{...compteursEsv(sig),img:images,nl:[nl,nlMax],paires:paires+1,pc,nc,vc}};
       if(precedente){paires++;const charge=!libre||!precedente.libre,noeuds=precedente.valeur!==sig.value,change=precedente.vue!==vue;
         if(charge)pc++;if(noeuds)nc++;if(change)vc++;
         manque=f0===null||f-f0<3?'images':charge?'chargements':noeuds?'noeuds':change?'vue':'aucune';}
       precedente={valeur:sig.value,libre,vue};imagePrecedente=f;}
     if(sig.count>0&&Date.now()-depuis>=stableForMs){const fin=chargementsEsv();
       return {regle:'stabilite',images,chargementsEnCours:fin,diag:{...compteursEsv(sig),img:images,nl:[fin,nlMax],paires,pc,nc,vc,m:manque}};}
     await prochaineImage();}
   throw Error('Niveau de détail non stabilisé.'+(derniere?' '+derniere.message:''));}
 /* I2 : le rail demandé dans la vue, sur deux images de suite à caméra identique. Mêmes garanties
  * que `select` (incident du cut 3560 : une caméra immobile n'est pas un rail sélectionné), au
  * rythme des images au lieu de trois sondages à 80 ms ; clic répété comme en 4.8.0 (KI-063). */
 async function selectImage(side,expected,guard=()=>assertExpected(expected)){
   const essais=Math.max(1,P.recentrages??3);
   for(let essai=1;essai<=essais;essai++){guard();nativeClick(selectors[side]);
     let precedente=null;const debut=Date.now();
     while(Date.now()-debut<P.attenteMs){await prochaineImage();if(cancelled)throw Error('Action interrompue.');guard();
       const now=assertExpected(expected),c=context(),cam=L.cameraSnapshot(c.viewer,c.frame.origin);if(!cam){precedente=null;continue;}
       const valeur=JSON.stringify(cam.cameraToSceneRelative);
       if(valeur===precedente&&projectToView(cam,now.rails[side]?.positionSceneRelative)?.inView)return now;precedente=valeur;}}
   throw Error('Vue ESV non recentrée sur le rail '+side+'.');}
 /* 4.9.5.3 (S6) — COMPTEUR POTREE BLOQUÉ. `numNodesLoading` lu AU DÉBUT de chaque nouveau cut ; la même valeur > 0 au début de `cuts` cuts
  * de suite (défaut 3) : un chargement qui ne redescend plus (hypothèse D-109). Un événement `diag-compteur-bloque` par épisode (l'épisode
  * finit quand la valeur change ou retombe à 0). Aucune action : seul un événement posté à l'observateur. */
 const compteurCuts={cle:null,hist:[],episode:false};
 function noterCompteurDebutCut(){try{const C=REL.compteurBloque;if(C?.actif===false)return;
   const l=cutLabel();if(!l)return;const cle=l.part+':'+l.cut;if(cle===compteurCuts.cle)return;compteurCuts.cle=cle;
   const n=chargementsEsv(),N=Number.isInteger(C?.cuts)&&C.cuts>=2?C.cuts:3;compteurCuts.hist.push(n);while(compteurCuts.hist.length>N)compteurCuts.hist.shift();
   const h=compteurCuts.hist,bloque=h.length>=N&&n!==null&&n>0&&h.every(v=>v===n);
   if(!bloque){compteurCuts.episode=false;return;}
   if(compteurCuts.episode)return;compteurCuts.episode=true;
   posterObservateur({kind:'diag-compteur-bloque',valeur:n,cuts:N,cut:l.cut,pageMs:heurePage()});}catch{}}
 async function capture(expected,progress=()=>{}){noterCompteurDebutCut();try{installerOmbreEsv();}catch{}cancelled=false;const captures=[],attempts=[],startedAt=Date.now();
   const maxAttemptsPerView=P.tentativesParVue,stableForMs=P.stabiliteMs,budgetMs=P.budgetCaptureMs,lecture=lectureDuCut(expected?.identity);
   const guard=()=>{if(cancelled)throw Error('Lecture LiDAR annulée (arrêt demandé ou délai dépassé).');const now=assertExpected(expected);
     if(!K.equalPoses(now.rails,expected.rails))throw Error('Rails modifiés pendant la lecture.');
     if(Date.now()-startedAt>=budgetMs)throw Error('Lecture LiDAR instable : délai total de 60 secondes atteint.');};
   for(const side of ['left','right']){
     /* Lecture seule : une vue qui ne se recentre pas met le lot en pause
      * reprenable (« Lecture LiDAR instable »), au lieu de l'arrêter en erreur. */
     const debutVue=Date.now();
     guard();await (piece(lecture,'selection')?selectImage:select)(side,expected,guard).catch(e=>{if(String(e?.message).startsWith('Vue ESV non recentrée'))throw Error('Lecture LiDAR instable : '+e.message+' ESV est lent sur ce cut : rafraîchis la page ESV (F5), puis clique sur Reprendre.');throw e;});
     for(let attempt=1;attempt<=maxAttemptsPerView;attempt++){
       const began=Date.now();guard();progress('capture-wait',{side,attempt,maxAttemptsPerView});
       try{
         let attente;
         /* Signal à la première tentative seulement : une relecture attend comme la 4.9.0.5. */
         if(piece(lecture,'signal')&&attempt===1)attente=await attendreChargement(guard,stableForMs);
         else{let previous=null,unchangedSince=Date.now(),derniere=null;
           await waitFor(()=>{const signature=loadedSignature();derniere=signature;
             if(signature.value!==previous){previous=signature.value;unchangedSince=Date.now();}
             return signature.count>0&&Date.now()-unchangedSince>=stableForMs;
           },'Niveau de détail non stabilisé.',12000,guard);
           let diag;try{diag={...compteursEsv(derniere),nl:[chargementsEsv(),null],m:'hors-signal'};}catch{diag={m:'hors-signal'};}
           attente={regle:'stabilite',diag};}
         guard();progress('capture-read',{side,attempt,lecture,regle:attente.regle,...(attente.diag?{diag:attente.diag}:{})});
         const avantLecture=attente.regle==='signal'?loadedSignature().value:null;
         const data=await captureOnce(expected,guard,piece(lecture,'lecture')?'rapide':'reference');guard();
         /* Lu au signal : rien ne doit avoir changé pendant la lecture (elle rend la main à ESV à
          * chaque tranche). Sinon la vue était incomplète : relecture, comme toute lecture instable. */
         if(avantLecture!==null&&(loadedSignature().value!==avantLecture||chargementsEsv()!==0))
           throw Error('Lecture LiDAR instable : niveau de détail changé pendant la lecture.');
         attempts.push({side,attempt,status:'captured',durationMs:Date.now()-began,vueMs:Date.now()-debutVue,regle:attente.regle,...(attente.images!=null?{images:attente.images}:{})});captures.push(data);
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
   guard();const data=M3.merge(...captures);guard();
   data.readStrategy={maxAttemptsPerView,stableForMs,budgetMs,durationMs:Date.now()-startedAt,attempts,lecture,regleLecture:P.modeRapide??P.lectureI1??null,
     pieces:lecture==='rapide'?Object.keys(RAPIDE).filter(n=>RAPIDE[n]!==false):[],...(CLIC_CORRIGE?{clicHumain:CLIC_HUMAIN}:{})};
   /* 4.7.19 (KI-059) : la capture doit tenir dans un message Chrome (64 Mio).
    * Nœuds sans point réduits au-delà de 64 ; trop gros malgré tout : erreur
    * « Lecture LiDAR instable », que le lot traite en pause reprenable. */
   const nodes=data.nodes.length,compacted=M3.compactNodes(data),bytes=M3.messageBytes(data);
   if(bytes>M3.MESSAGE_BUDGET)throw Error(`Lecture LiDAR instable : capture de ${Number.isFinite(bytes)?Math.round(bytes/1048576)+' Mo':'taille illisible'}, trop grosse pour un message Chrome (64 Mo) — ${data.pointsSceneRelative.length} points, ${nodes} nœuds LiDAR chargés dans la vue${compacted?`, dont ${compacted} réduits`:''}. Attends la fin du chargement ou rapproche la vue du cut, puis clique sur Reprendre.`);
   progress('capture-ready',{attempts:attempts.length,points:data.pointsSceneRelative.length,nodes,compacted,bytes,lecture,regleLecture:data.readStrategy.regleLecture});return data;
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
 function refusalDetail(side,now,target,cam,view,motif=null){
   const fmt=p=>Array.isArray(p)?p.map(v=>Number(v).toFixed(6)).join(', '):'non-observé';
   const reason=motif?MOTIF_CLIC[motif]||motif:!cam?'caméra non lisible':!cam.viewport?'viewport absent'
     :'hors bornes : '+['x','y','z'].filter((_,i)=>Math.abs(view.ndc[i])>1).join('+');
   return `[repère=scene-relative frameId=${now.identity.frameId??'non-observé'}`
     +` ; source=(${fmt(now.rails[side]?.positionSceneRelative)}) ; cible=(${fmt(target)})`
     +` ; centre de vue=(${fmt(cam?.cameraToSceneRelative?.slice(12,15))})`
     +` ; ndc=(${fmt(view?.ndc)}) ; bornes=${motif?`[-${CLIC_MARGE},${CLIC_MARGE}] en x et y, dans la fenêtre`:'[-1,1] par composante'}`
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
/* 4.8.0 (KI-063) — ESV LENT : REDEMANDER LE RECENTRAGE. Terrain du 26/09
  * (parties 13 et 14) : trois lots sur cinq arrêtés en erreur par « Vue ESV non
  * recentrée », sur des cuts où ESV mettait 17 à 19 s à lire le nuage (4 s
  * d'ordinaire). Le clic de sélection d'un rail ne déplace aucun rail : le
  * répéter est sans effet sur la scène. Après une attente vaine, le clic est
  * donc répété (`recentrages` clics au plus) avant de conclure. */
 async function select(side,expected,guard=()=>assertExpected(expected)){
   const essais=Math.max(1,P.recentrages??3);
   for(let essai=1;;essai++){guard();nativeClick(selectors[side]);
     let previous=null,stable=0;
     try{return await waitFor(()=>{const now=assertExpected(expected);const c=context(),cam=L.cameraSnapshot(c.viewer,c.frame.origin);
       if(!cam)return false;const value=JSON.stringify(cam.cameraToSceneRelative);stable=value===previous?stable+1:0;previous=value;
       if(stable<P.lecturesStables)return false;
       return !!projectToView(cam,now.rails[side]?.positionSceneRelative)?.inView;},
       'Vue ESV non recentrée sur le rail '+side+'.',P.attenteMs,guard);}
     catch(e){if(essai>=essais||!String(e?.message).startsWith('Vue ESV non recentrée'))throw e;}}}
 /* 4.8.0 (terrain du 28/09, partie 15) — CLIC AU PIXEL PRÈS. ESV pose le rail
  * sur le pixel ENTIER du clic : sur les 122 rails posés de la partie 12,
  * l'écart pose/cible va de −1 à 0 pixel en horizontal et de 0 à +1 en
  * vertical. Vue habituelle (0,54 mm par pixel) : l'écart reste sous 1 mm.
  * Fenêtre d'ESV rétrécie (416 px, 0,96 mm par pixel) : il le dépassait, deux
  * poses sur six refusées (« le clic n'a pas produit le déplacement
  * demandé »), lot arrêté. Un rail posé à plus de 1 mm de la cible est donc
  * recliqué, décalé d'un demi-pixel dans un sens puis dans l'autre (la règle
  * d'arrondi d'ESV n'est pas supposée) ; dès que le rail s'est posé, l'écart
  * est lu, sans attendre les 5 s. Même tolérance qu'avant (1 mm), relue ensuite
  * par le moteur. */
 const DECALAGES_CLIC=[[0,0],[.5,.5],[-.5,-.5]];
 /* 5.0 (D-157) — CLIC HUMAIN DU MODE RAPIDE (fiches/RAPIDE_HUMAIN.md).
  * La pose directe (P1) presse le bouton du rail et clique dans la même tâche, avec la caméra encore active. Depuis la capture,
  * cette caméra est celle du rail DROIT (la capture lit le gauche puis le droit) : la cible gauche y projette à NDC x ≈ −7,
  * soit environ 2 000 px à gauche du canevas, hors de la fenêtre. Un humain ne peut pas produire ce clic (D-157 : 185 cuts sur
  * 185 en partie 29, 205 sur 205 en partie 1 du second projet). Réglage `pilote.rapide.clicHumain` :
  *   'tel-quel'        (défaut) : le comportement de la base, à l'octet près ;
  *   'gauche-recentre' : le rail droit d'abord, posé en direct depuis la vue active ; le rail gauche ensuite, avec recentrage ;
  *   'tout-recentre'   : les deux rails avec recentrage, le chemin des cuts de référence (comme la pièce « pose » coupée).
  * Valeur absente ou inconnue : 'tel-quel'. Dans les deux modes corrigés, AUCUN clic de pose ne part hors de la partie visible
  * du canevas : NDC du point cliqué dans ±0,99 (la marge du lot, KI-051, et de « déplacer la vue »), et point dans la fenêtre
  * quand la page en donne la taille. La pose directe est refusée AVANT de presser le bouton (la caméra ne change pas quand on le
  * presse) : pose avec recentrage, le repli existant. Le clic après recentrage est refusé comme une cible hors de la vue
  * (« Position proposée hors de la vue »), sans clic.
  * Garde-fou, quel que soit le mode : chaque clic de pose calculé hors de la partie visible est relevé (`clicsHorsVue`), sans
  * rien changer au clic, et part au service worker APRÈS la réponse (message `banane3:clic-hors-vue`, comme le relevé D4). */
 const CLIC_HUMAIN=['gauche-recentre','tout-recentre'].includes(REGLE_CLIC_HUMAIN)?REGLE_CLIC_HUMAIN:'tel-quel',CLIC_CORRIGE=CLIC_HUMAIN!=='tel-quel';
 /* 4.9.5 test 6 (D-164, Mic : « essayer les 2 méthodes ») : le mode peut venir du LOT. Le service worker lit le choix du panneau
  * au démarrage du lot, le fige dans le lot et l'envoie avec chaque `apply` (`options.clicHumain`), seulement s'il est corrigé.
  * Sans lui (ou valeur inconnue), le réglage de la page, comme avant : 'tel-quel' par défaut, la même trace à l'octet près. */
 const MODES_CLIC=['tel-quel','gauche-recentre','tout-recentre'];
 const modeClic=o=>o&&typeof o==='object'&&MODES_CLIC.includes(o.clicHumain)?o.clicHumain:CLIC_HUMAIN;
 const CLIC_MARGE=.99,MOTIF_CLIC={'hors-canevas':'hors du canevas','marge':'hors de la marge de 0,99','hors-fenetre':'hors de la fenêtre','vue-illisible':'vue illisible'};
 /* Point du clic sur l'écran : la formule de la pose, à l'identique (même ordre d'opérations). */
 const pointClic=(r,ndc,dx=0,dy=0)=>[r.left+(ndc[0]+1)*r.width/2+dx,r.top+(1-ndc[1])*r.height/2+dy];
 /* Ce point est-il dans la partie visible du canevas ? `null` si oui, sinon la raison. */
 function horsVueClic(r,x,y){
   if(!r||![x,y,r.left,r.top,r.width,r.height].every(Number.isFinite)||!(r.width>0)||!(r.height>0))return 'vue-illisible';
   const nx=(x-r.left)/r.width*2-1,ny=1-(y-r.top)/r.height*2;
   if(Math.abs(nx)>1||Math.abs(ny)>1)return 'hors-canevas';
   if(Math.abs(nx)>CLIC_MARGE||Math.abs(ny)>CLIC_MARGE)return 'marge';
   const largeur=window.innerWidth,hauteur=window.innerHeight;
   if(Number.isFinite(largeur)&&Number.isFinite(hauteur)&&largeur>0&&hauteur>0&&(x<0||y<0||x>=largeur||y>=hauteur))return 'hors-fenetre';
   return null;}
 /* Relevé du garde-fou : compact, borné (12 clics au plus par commande), jamais bloquant. */
 const clicsHorsVue=[];
 function noterClicHorsVue(cote,chemin,essai,raison,r,x,y,expected){try{if(clicsHorsVue.length>=12)return;
   const a=v=>Math.round(v*1000)/1000,b=v=>Math.round(v*10)/10;
   clicsHorsVue.push({cote,chemin,essai,raison,lecture:lectureDuCut(expected),ndc:[a((x-r.left)/r.width*2-1),a(1-(y-r.top)/r.height*2)],client:[b(x),b(y)]});}catch{}}
 /* Pose directe d'un mode corrigé : la cible doit être dans la partie visible de la vue ACTIVE. */
 function directeVisible(target){try{const c=context(),v=projectToView(L.cameraSnapshot(c.viewer,c.frame.origin),target);
   return !!v?.inView&&v.ndc.every(Number.isFinite)&&!horsVueClic(v.viewport,...pointClic(v.viewport,v.ndc));}catch{return false;}}
 const pixelMm=cam=>cam?.viewport?.width&&Array.isArray(cam.projection)&&cam.projection[0]?2/cam.projection[0]/cam.viewport.width*1000:NaN;
 async function clickPosition(side,target,expected,vue=null,mode=CLIC_HUMAIN){
   await select(side,expected);let dernier=null,pixel=NaN;
   /* 5.0 (« déplacer la vue ») : seulement si le service worker l'a demandé pour ce cut (réglage `deplacerVue`, coupé par défaut). */
   if(vue){const r=await amenerVue(side,target,expected,vue.etat,vue.reglages,vue.progress);vue.rapports.push(r);
     if(!r.ok){const remise=await remettreVue(vue.etat,side,expected,vue.reglages,vue.progress).catch(e=>({ok:false,erreur:e.message}));
       const nom=side==='left'?'gauche':'droit',poses=vue.poses.map(s=>s==='left'?'gauche':'droit');
       throw Error(`Vue ESV non amenée sur la cible du rail ${nom} (${r.raison}) : `+(poses.length?`le rail ${poses.join(' et ')} est déjà posé, rien n’est validé. État à réconcilier.`:'rien n’a été posé.')
         +(remise.ok===false?' Vue ESV non restituée : contrôle-la avant de reprendre.':''));}}
   for(const [essai,[dx,dy]] of DECALAGES_CLIC.entries()){
     const now=assertExpected(expected);const c=context(),cam=L.cameraSnapshot(c.viewer,c.frame.origin);
     const view=projectToView(cam,target);
     if(!view?.inView)throw Error('Position proposée hors de la vue : '+side+' '+refusalDetail(side,now,target,cam,view));
     const r=view.viewport,ndc=view.ndc,avant=now.rails[side].positionSceneRelative;pixel=pixelMm(cam);
     /* D-157 : mode corrigé, aucun clic hors de la partie visible ; tel-quel, le clic part comme avant, relevé. */
     const [x,y]=pointClic(r,ndc,dx,dy),horsVue=horsVueClic(r,x,y);
     if(horsVue&&mode!=='tel-quel')throw Error('Position proposée hors de la vue : '+side+' '+refusalDetail(side,now,target,cam,view,horsVue));
     if(horsVue)noterClicHorsVue(side,'recentre',essai+1,horsVue,r,x,y,expected);
     c.viewer.renderer.domElement.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window,
       clientX:x,clientY:y,button:0,buttons:1}));
     /* Posé : à 1 mm de la cible ; ou déplacé, puis immobile sur trois lectures. */
     let precedent=null,stable=0;
     const pose=await waitFor(()=>{const s=assertExpected(expected),p=s.rails[side].positionSceneRelative;
       if(C.distance(p,target)<=.001)return {s,ok:true};
       const cle=JSON.stringify(p);stable=cle===precedent?stable+1:0;precedent=cle;
       return C.distance(p,avant)>1e-6&&stable>=P.lecturesStables?{s,ok:false}:false;},
       'Le clic n’a pas produit le déplacement demandé pour '+side+'. État à réconcilier.',P.attenteClicMs)
       .catch(e=>{if(dernier)return {s:dernier,ok:false};throw e;});
     if(pose.ok)return pose.s;dernier=pose.s;}
   const ecart=C.distance(dernier.rails[side].positionSceneRelative,target)*1000;
   throw Error(`Le clic n’a pas produit le déplacement demandé pour ${side} : rail posé à ${ecart.toFixed(1).replace('.',',')} mm de la cible`
     +(Number.isFinite(pixel)?`, vue ESV à ${pixel.toFixed(2).replace('.',',')} mm par pixel${pixel>.9?' (agrandis la fenêtre d’ESV)':''}`:'')+'. État à réconcilier.');
 }
 /* P1 : pose sans recentrage. ESV pose le rail du côté COURANT au point où le rayon du clic coupe
  * son plan de coupe (5 × 7 m, les deux rails dedans) ; il ne vérifie pas que ce point soit dans
  * la vue. Le bouton de rail fixe le côté de façon synchrone ; la caméra, elle, ne suit qu'à
  * l'image suivante. Le clic part donc dans la MÊME tâche, calculé avec la caméra encore active :
  * celle qu'ESV utilise pour son rayon. Garde : côté d'ESV relu sur son bouton avant le clic ;
  * l'autre rail ne doit pas bouger. Ne conclut pas (`null`) : pose avec recentrage, comme avant. */
 const CLASSE_COTE={left:['O2N3DCutLRClick','leftRailSClass'],right:['O2N3DCutRRClick','rightRailSClass']};
 function poseDirecte(side,target,expected,mode=CLIC_HUMAIN){
   const autre=side==='left'?'right':'left',avant=assertExpected(expected),[id,classe]=CLASSE_COTE[side];
   /* Sans témoin du côté d'ESV (classe du bouton), rien n'est tenté : pose avec recentrage. */
   if(typeof document.getElementById(id)?.classList?.contains!=='function')return null;
   /* D-157, mode corrigé : cible hors de la partie visible de la vue active, rien n'est pressé ni cliqué. */
   if(mode!=='tel-quel'&&!directeVisible(target))return null;
   nativeClick(selectors[side]);if(!document.getElementById(id).classList.contains(classe))return null;
   const c=context(),cam=L.cameraSnapshot(c.viewer,c.frame.origin),view=projectToView(cam,target);
   if(!view||!view.ndc.every(v=>Number.isFinite(v)&&Math.abs(v)<50))return null;
   const r=view.viewport,ndc=view.ndc;
   for(const [essai,[dx,dy]] of DECALAGES_CLIC.entries()){
     const [x,y]=pointClic(r,ndc,dx,dy),horsVue=horsVueClic(r,x,y);
     if(mode!=='tel-quel'&&(horsVue||!view.inView))return null;
     if(horsVue)noterClicHorsVue(side,'directe',essai+1,horsVue,r,x,y,expected);
     c.viewer.renderer.domElement.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window,
       clientX:x,clientY:y,button:0,buttons:1}));
     const s=assertExpected(expected);
     if(C.distance(s.rails[autre].positionSceneRelative,avant.rails[autre].positionSceneRelative)>1e-9)
       throw Error('Le clic a déplacé le rail '+(autre==='left'?'gauche':'droit')+' au lieu du rail '+(side==='left'?'gauche':'droit')+'. État à réconcilier.');
     if(C.distance(s.rails[side].positionSceneRelative,target)<=.001)return s;
     if(C.distance(s.rails[side].positionSceneRelative,avant.rails[side].positionSceneRelative)<=1e-9)return null;}
   return null;}
 /* 5.0 (D-147) — DÉPLACER LA VUE : AMENER LA CIBLE D'UN RAIL DANS LA VUE D'ESV PAR UN GESTE HUMAIN (fiches/DEPLACER_VUE.md).
  *
  * Chaque rail a sa vue (±0,2 unité de scène, centrée sur lui après le bouton du rail) : une cible plus loin est « hors de la
  * vue » (KI-051) et le lot diffère le cut. L'opérateur, lui, dézoome à la molette ou glisse la vue au bouton gauche (D-147).
  * `amenerVue` fait de même, après `select` et avant la lecture de caméra qui sert au clic :
  *   1. caméra lue, cible projetée ; dans la vue (marge de 1 %) : rien ;
  *   2. sinon le plus petit geste dans les limites : dézoom si la vue entière tient (≤ `dezoomMax`, pixel ≤ `pixelMaxMm`),
  *      sinon glisser (≤ `glissementPxMax` px), sinon refus « hors-limites » ;
  *   3. le geste est émis comme un humain le fait (src/gestes-vue.js : mêmes événements, même ordre que Chromium ; jamais de
  *      `click` dans la vue), puis la caméra est attendue immobile, RELUE, et la cible REPROJETÉE ; le facteur d'un cran et le gain
  *      du glisser sont mesurés sur ce geste et servent au suivant ;
  *   4. au plus `gestesMax` gestes ; caméra immobile après un geste, rail déplacé, mauvais sens : arrêt (le rail déplacé est une
  *      erreur, « État à réconcilier ») ;
  *   5. la vue est remise ensuite (`remettreVue`) : crans dans l'autre sens, bouton du rail après un glisser, échelle relue.
  * Ni écriture dans la caméra, ni appel d'une fonction d'ESV, ni requête : des événements de souris et de molette, non fiables
  * (`isTrusted` faux), comme le `click` de pose d'aujourd'hui. Rien de ceci ne s'exécute sans demande du service worker. */
 const VUE_VERSION='deplacer-vue-v1';
 /* CH-018 : geste de déplacement réglable (`settings.deplacerVue.deplacement`, éteint par défaut : sans lui, rien ci-dessous ne change). */
 const DV=window.BananeDeplacementVue||null,journalVue=DV?new DV.Journal():null;
 const VUE_DEFAUTS={gestesMax:3,dezoomMax:1.5,glissementPxMax:250,pixelMaxMm:.9,marge:.99,remiseTolerance:.02};
 function reglagesVue(options){const S=window.BananeSettings?.deplacerVue||{},o=options&&typeof options==='object'?options:{};
   const E=GV?.EMISSION||{molette:{},glisser:{}};
   return {...VUE_DEFAUTS,...S,...o,deplacement:{...(S.deplacement||{}),...(o.deplacement||{})},molette:{facteurSuppose:1.1,...E.molette,...(S.molette||{}),...(o.molette||{})},glisser:{viseNdc:.8,...E.glisser,...(S.glisser||{}),...(o.glisser||{})}};}
 /* État partagé par les deux rails d'une pose : échelle de la vue habituelle, crans nets de dézoom, glisser fait, facteur d'un
  * cran et gain du glisser mesurés. */
 const etatVue=o=>({echelle0:null,pixel0:null,crans:0,glisse:false,facteurCran:o.molette.facteurSuppose,gain:1});
 const echelleVue=cam=>Math.abs(cam?.projection?.[0]??NaN);
 const r3v=v=>Number.isFinite(v)?Math.round(v*1000)/1000:null;
 const ndcVue=v=>v?[r3v(v.ndc[0]),r3v(v.ndc[1])]:null;
 const dansVue=(v,marge)=>!!v&&Math.abs(v.ndc[0])<=marge&&Math.abs(v.ndc[1])<=marge&&Math.abs(v.ndc[2])<=1;
 const procheCam=(a,b)=>!!a&&!!b&&a.cameraToSceneRelative.every((x,i)=>Math.abs(x-b.cameraToSceneRelative[i])<=1e-6)&&Math.abs(echelleVue(a)/echelleVue(b)-1)<=1e-6;
 /* Caméra immobile : `lecturesStables` comparaisons égales de suite, à `sondageMs` (comme `select`), à 1 µm et 1e-6 d'échelle près
  * (une visionneuse amortie approche sa cible sans l'atteindre au bit près). Plafond `attenteMs`. */
 async function cameraImmobile(guard){let prec=null,stables=0;const debut=Date.now();
   for(;;){await sleep(P.sondageMs);if(cancelled)throw Error('Action interrompue.');guard();const c=context(),cam=L.cameraSnapshot(c.viewer,c.frame.origin);
     stables=cam&&procheCam(cam,prec)?stables+1:0;prec=cam;if(stables>=P.lecturesStables||Date.now()-debut>=P.attenteMs)return cam;}}
 function centreVue(c){const r=c.viewer.renderer.domElement.getBoundingClientRect();return {r,x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};}
 const gesteGarde=expected=>()=>{if(cancelled)throw Error('Action interrompue.');assertExpected(expected);};
 async function emettreGeste(c,seq,guard){return GV.emettre(c.viewer.renderer.domElement,seq,{fenetre:window,attendre:ms=>sleep(ms),garde:guard});}
 async function amenerVue(side,target,expected,etat,o,progress=()=>{}){const debut=Date.now(),rapport={cote:side,ok:false,raison:null,gestes:[],ndcAvant:null,ndcApres:null,pixelMm:{avant:null,apres:null}};
   if(!GV){rapport.raison='module-absent';return rapport;}
   const guard=gesteGarde(expected);let c=context(),cam=L.cameraSnapshot(c.viewer,c.frame.origin);
   if(!cam?.viewport||!Number.isFinite(echelleVue(cam))){rapport.raison='camera-illisible';return rapport;}
   if(etat.echelle0===null){etat.echelle0=echelleVue(cam);etat.pixel0=pixelMm(cam);}
   else if(Math.abs(echelleVue(cam)/etat.echelle0-1)<=1e-9)etat.crans=0;   // la vue a été remise par ESV (recentrage)
   const poses0=assertExpected(expected).rails;
   let v=projectToView(cam,target);rapport.ndcAvant=ndcVue(v);rapport.pixelMm.avant=r3v(pixelMm(cam));
   if(dansVue(v,o.marge)){rapport.ok=true;rapport.raison='dans-la-vue';rapport.ndcApres=rapport.ndcAvant;rapport.pixelMm.apres=rapport.pixelMm.avant;rapport.dureeMs=Date.now()-debut;return rapport;}
   for(let n=0;n<o.gestesMax;n++){
     const b=GV.besoin(v.ndc,cam.viewport,o.marge),zoomActuel=etat.echelle0/echelleVue(cam),{r,x,y}=centreVue(c),geste={};
     const dezoomPossible=zoomActuel*b.dezoom<=o.dezoomMax*(1+1e-9)&&etat.pixel0*zoomActuel*b.dezoom<=o.pixelMaxMm;
     let seq=null,plan=null;const dv=DV&&o.deplacement?.actif===true?DV.reglages(o.deplacement):null;
     if(dezoomPossible&&(!dv||dv.geste==='molette')){const f=Math.max(1.0001,etat.facteurCran);
       let crans=Math.min(o.molette.cransMax,Math.max(1,Math.ceil(Math.log(b.dezoom)/Math.log(f)-1e-9)));
       while(crans>1&&(zoomActuel*Math.pow(f,crans)>o.dezoomMax*(1+1e-9)||etat.pixel0*zoomActuel*Math.pow(f,crans)>o.pixelMaxMm))crans--;
       Object.assign(geste,{type:'molette',crans,sens:o.molette.sensDezoom});
       plan={x,y,crans,sens:o.molette.sensDezoom};seq=GV.sequenceMolette({x,y,crans,sens:o.molette.sensDezoom,reglages:o.molette});}
     else if(b.panPx<=o.glissementPxMax&&(!dv||dv.geste!=='molette')){
       const vise=Math.min(o.marge,o.glisser.viseNdc),cl=u=>Math.max(-vise,Math.min(vise,u));
       let dx=(cl(v.ndc[0])-v.ndc[0])*r.width/2/etat.gain,dy=-(cl(v.ndc[1])-v.ndc[1])*r.height/2/etat.gain;
       const L2=Math.hypot(dx,dy);if(L2>o.glissementPxMax){dx*=o.glissementPxMax/L2;dy*=o.glissementPxMax/L2;}
       dx=Math.round(dx);dy=Math.round(dy);
       /* Départ loin du rail sélectionné (au centre de la vue), du côté opposé au mouvement ; les deux bouts dans la vue. */
       const borne=(u,a,l,d)=>Math.round(Math.max(a+20+Math.max(0,-d),Math.min(a+l-20-Math.max(0,d),u)));
       const x0=borne(x-Math.sign(dx||1)*.3*r.width,r.left,r.width,dx),y0=borne(y+(dy>0?-1:1)*.3*r.height,r.top,r.height,dy);
       Object.assign(geste,{type:'glisser',px:dx,py:dy});
       plan={x0,y0,x1:x0+dx,y1:y0+dy};seq=GV.sequenceGlisser({x0,y0,x1:x0+dx,y1:y0+dy,reglages:o.glisser});}
     else{rapport.raison=n?'gestes-epuises':'hors-limites';break;}
     const t0=Date.now();let cam2;
     if(dv){/* CH-018 : le module émet, relit la caméra immobile et juge ; la preuve est le mouvement mesuré, pas l'envoi. */
       const lire=()=>{const k=context();return L.cameraSnapshot(k.viewer,k.frame.origin);};
       const rd=await DV.deplacer({geste:dv.geste,plan,lireCamera:lire,emettre:s=>emettreGeste(c,s,guard),immobile:()=>cameraImmobile(guard),journal:journalVue,reglages:dv,emission:{molette:o.molette,glisser:o.glisser}});
       geste.deplacement={geste:rd.geste,ok:rd.ok,tentatives:rd.tentatives,raison:rd.raison};cam2=lire();}
     else{await emettreGeste(c,seq,guard);cam2=await cameraImmobile(guard);}
     geste.dureeMs=Date.now()-t0;geste.ndcAvant=ndcVue(v);
     /* Le geste ne doit jamais avoir bougé un rail. */
     const apres=assertExpected(expected).rails;
     for(const s of ['left','right'])if(C.distance(apres[s].positionSceneRelative,poses0[s].positionSceneRelative)>1e-9){
       rapport.gestes.push(geste);progress('vue-geste',{side,...geste,rail:s});
       throw Error('Le geste de vue a déplacé le rail '+(s==='left'?'gauche':'droit')+' ('+geste.type+'). État à réconcilier.');}
     if(!cam2||procheCam(cam2,cam)){geste.camera='immobile';rapport.gestes.push(geste);progress('vue-geste',{side,...geste});rapport.raison='camera-immobile';break;}
     if(geste.type==='molette'){const f=Math.pow(echelleVue(cam)/echelleVue(cam2),1/geste.crans);geste.facteurCran=r3v(f);
       if(f<1){etat.crans-=geste.crans;geste.sensInverse=true;}else{etat.crans+=geste.crans;etat.facteurCran=f;}}
     else{etat.glisse=true;const v2=projectToView(cam2,target),d=Math.hypot((v2.ndc[0]-v.ndc[0])*r.width/2,(v2.ndc[1]-v.ndc[1])*r.height/2),m=Math.hypot(geste.px,geste.py);
       if(m>0&&d>0){etat.gain=d/m;geste.gain=r3v(etat.gain);}}
     cam=cam2;c=context();v=projectToView(cam,target);geste.ndcApres=ndcVue(v);geste.zoom=r3v(etat.echelle0/echelleVue(cam));
     rapport.gestes.push(geste);progress('vue-geste',{side,...geste});
     if(geste.sensInverse){rapport.raison='sens-molette';break;}
     if(pixelMm(cam)>o.pixelMaxMm){rapport.raison='pixel';break;}
     if(dansVue(v,o.marge)){rapport.ok=true;break;}
   }
   if(!rapport.ok&&!rapport.raison)rapport.raison='gestes-epuises';
   rapport.ndcApres=ndcVue(v);rapport.pixelMm.apres=r3v(pixelMm(cam));rapport.dureeMs=Date.now()-debut;return rapport;}
 /* Remettre la vue habituelle : après un glisser, le bouton du rail la recentre ; des crans nets de dézoom sont rendus dans
  * l'autre sens (par séries de `cransMax`) si l'échelle n'est pas déjà revenue. L'échelle est relue : écart au plus
  * `remiseTolerance`, sinon `ok:false`. */
 async function remettreVue(etat,side,expected,o,progress=()=>{}){const t0=Date.now(),rap={ok:true,crans:0,recentre:false,ecartEchelle:0};
   if(!etat||etat.echelle0===null||(!etat.glisse&&!etat.crans))return rap;
   const guard=gesteGarde(expected);
   if(etat.glisse){await select(side,expected);rap.recentre=true;etat.glisse=false;}
   let c=context(),cam=L.cameraSnapshot(c.viewer,c.frame.origin);
   if(etat.crans&&Math.abs(echelleVue(cam)/etat.echelle0-1)>1e-9){const {x,y}=centreVue(c),sens=etat.crans>0?-o.molette.sensDezoom:o.molette.sensDezoom;
     let reste=Math.abs(etat.crans);
     while(reste>0){const n=Math.min(reste,o.molette.cransMax);await emettreGeste(c,GV.sequenceMolette({x,y,crans:n,sens,reglages:o.molette}),guard);reste-=n;rap.crans+=n;
       if(reste>0)await sleep(Math.round((o.molette.intervalleMs?.[1]??140)*2));}
     cam=await cameraImmobile(guard);}
   etat.crans=0;const ecart=Math.abs(echelleVue(cam)/etat.echelle0-1);rap.ecartEchelle=Math.round(ecart*1e6)/1e6;rap.ok=ecart<=o.remiseTolerance;
   rap.dureeMs=Date.now()-t0;progress('vue-remise',{side,...rap});return rap;}
 /* Action de page, sans pose : sélectionne le rail, amène la cible dans sa vue, puis REMET la vue (pré-vol du service worker,
  * relevés sur la maquette). Ne clique jamais dans la vue. */
 async function amenerDansLaVue(cote,cible,attendu,a4,a5){const [options,progress]=typeof a4==='function'?[{},a4]:[a4&&typeof a4==='object'?a4:{},typeof a5==='function'?a5:()=>{}];
   cancelled=false;if(cote!=='left'&&cote!=='right')throw Error('Côté de rail inconnu : '+cote);
   if(!Array.isArray(cible)||cible.length!==3||!cible.every(Number.isFinite))throw Error('Cible invalide.');
   assertExpected(attendu);const o=reglagesVue(options),etat=etatVue(o);
   await select(cote,attendu);
   const r={version:VUE_VERSION,...await amenerVue(cote,cible,attendu,etat,o,progress)};
   r.remise=await remettreVue(etat,cote,attendu,o,progress);if(r.ok&&!r.remise.ok){r.ok=false;r.raison='vue-non-restituee';}
   if(journalVue&&o.deplacement?.actif===true)r.journalGestes=journalVue.resume();
   return r;}
 /* `options` (troisième argument, facultatif) : `{deplacerVue}` envoyé par le service worker pour un cut que la vue seule
  * empêchait de poser (réglage `deplacerVue`, coupé par défaut). Sans lui, l'appel est celui d'avant, à l'identique. Avec lui :
  * pas de pose directe (P1), chaque rail est amené dans sa vue par un geste humain avant le clic, et la vue est remise à la fin. */
 async function apply(before,proposals,a3,a4){const [options,progress]=typeof a3==='function'?[{},a3]:[a3&&typeof a3==='object'?a3:{},typeof a4==='function'?a4:()=>{}];
   cancelled=false;const now=assertExpected(before);
   if(!K.equalPoses(now.rails,before.rails))throw Error('Rails modifiés avant l’application.');
   const plan=options.deplacerVue&&typeof options.deplacerVue==='object'?options.deplacerVue:null;
   const reglages=plan?reglagesVue(plan):null,vue=plan?{etat:etatVue(reglages),reglages,progress,rapports:[],poses:[]}:null;
   const expected=K.expectedPoses(before,proposals),directe=!vue&&piece(lectureDuCut(before.identity),'pose');
   /* D-157 : 'gauche-recentre' pose d'abord le rail droit, celui de la vue active après la capture ; 'tout-recentre' ne pose
    * jamais en direct. 'tel-quel' : gauche puis droit, en direct, comme avant. Test 6 : le mode du lot, s'il est transmis. */
   const mode=modeClic(options);
   const ordre=directe&&mode==='gauche-recentre'?['right','left']:['left','right'];
   const enDirect=s=>directe&&(mode==='tel-quel'||mode==='gauche-recentre'&&s==='right');
   for(const s of ordre){if(cancelled)throw Error('Action interrompue.');
     if(enDirect(s)&&poseDirecte(s,expected[s].positionSceneRelative,before.identity,mode))continue;
     if(enDirect(s))progress('apply-repli',{side:s});
     await clickPosition(s,expected[s].positionSceneRelative,before.identity,vue,mode);if(vue)vue.poses.push(s);}
   if(!vue){const fin=snapshot();fin.vueFin=vueFin(fin);return fin;}
   const remise=await remettreVue(vue.etat,'right',before.identity,reglages,progress);
   if(!remise.ok)throw Error(`Vue ESV non restituée après le déplacement de vue (échelle à ${(remise.ecartEchelle*100).toFixed(1).replace('.',',')} % de la vue habituelle) : les deux rails sont posés, rien n’est validé. Remets la vue d’ESV, puis contrôle le cut. État à réconcilier.`);
   const fin=snapshot();fin.deplacerVue={version:VUE_VERSION,cotes:vue.rapports,remise,...(journalVue&&reglages.deplacement?.actif===true?{journalGestes:journalVue.resume()}:{})};fin.vueFin=vueFin(fin);return fin;}
 /* 4.9.5.13 (analyse du lot 2:19 : le journal d'un `apply` ne gardait que « reçu » et une durée) : position de chaque rail posé dans la vue
  * ACTIVE d'ESV à la fin de la pose (NDC, dans la vue ou non, taille du pixel). Lecture seule ; une lecture impossible est dite, jamais levée.
  * Le moteur consigne le résultat d'`apply` en entier (`applied-verified`, `observed`). */
 function vueFin(s){const r3=v=>Math.round(v*1000)/1000;
   try{const c=context(),cam=L.cameraSnapshot(c.viewer,c.frame.origin),out={version:'vue-fin-v1',pixelMm:Number.isFinite(pixelMm(cam))?r3(pixelMm(cam)):null};
     for(const side of ['left','right']){const v=projectToView(cam,s.rails[side].positionSceneRelative);
       out[side]=v&&Array.isArray(v.ndc)?{ndc:v.ndc.slice(0,2).map(r3),dansVue:!!v.inView}:null;}
     return out;}
   catch(e){return {version:'vue-fin-v1',erreur:String(e?.message||e).slice(0,80)};}}
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
   evidence.meaning='Navigation ESV sans décision : Ariane n’a émis pour ce cut ni application de rail, ni VALIDATE, ni SKIP ; confirmation serveur indisponible.';
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

 /* KI-069 (4.8.6) — VALIDER SANS PASSER AU CUT SUIVANT, sur le DERNIER cut d'une
  * partie. Le bouton d'ESV « valider » valide ET charge le cut non validé
  * suivant ; au dernier cut il n'y en a plus et ESV charge la partie suivante
  * (terrain du 30/09, partie 36). Sur demande de l'opérateur, Ctrl+Entrée, le
  * raccourci d'ESV qui valide SANS passer au suivant, est relayé comme le
  * raccourci de SKIP (`nativeDecision`) : keydown puis keyup sur `document`.
  * HYPOTHÈSE À CONFIRMER SUR LE TERRAIN (aucun accès au code d'ESV ici) : le
  * gestionnaire d'ESV lit `e.which` (inspection du 20/09) et Ctrl+Entrée
  * appelle `buttonValidateRail()`, « valider sans suivant ». Si l'essai montre
  * un autre effet, le repli `commande:'bouton'` (réglage `validationDernierCut`)
  * clique un bouton dont l'identifiant est réglé (`boutonValiderSansSuivant`) :
  * aucun identifiant n'est deviné. Jamais de repli vers `selectors.validate`.
  *
  * PREUVE, sans jamais affirmer de navigation : identité inchangée ET compteur
  * « N on M treated » passé de N à N+1 (un seul compteur, même total). Sans
  * compteur lisible AVANT, rien n'est émis. Sans effet, ou cut changé : erreur,
  * le moteur s'arrête, l'opérateur valide lui-même. */
 const lireCompteur=()=>{const r=releverEsv(null);
   return r.compteur&&!(r.compteursVus>1)&&!r.compteurIllisible?{traites:r.compteur.traites,total:r.compteur.total}:null;};
 async function validateInPlace(identity,scope={},options={},progress=()=>{}){
   cancelled=false;const bouton=options?.commande==='bouton';
   const before=assertExpected(identity),startedAt=new Date().toISOString();
   const avant=lireCompteur();
   if(!avant)throw Error('Validation sans passage au suivant refusée : le compteur « N on M treated » n’est pas lisible (un seul compteur attendu) ; rien n’a été envoyé à ESV.');
   let command;
   if(bouton){const id=options.boutonId;
     if(typeof id!=='string'||!id)throw Error('Repli buttonValidateRail() : l’identifiant du bouton « valider sans suivant » d’ESV n’est pas réglé (réglage boutonValiderSansSuivant) ; rien n’a été envoyé à ESV.');
     command={id,exists:!!document.getElementById(id),disabled:!!document.getElementById(id)?.disabled};
   }else command={id:'Ctrl+Enter',exists:true,disabled:false};
   progress('validate-in-place-before-command',{identity:before.identity,command,compteur:avant});
   if(bouton)nativeClick(options.boutonId);
   else{const init={key:'Enter',code:'Enter',keyCode:13,which:13,ctrlKey:true,shiftKey:false,altKey:false,metaKey:false,bubbles:true,cancelable:true,composed:true};
     for(const type of ['keydown','keyup']){const e=new KeyboardEvent(type,init);
       /* Le gestionnaire d'ESV lit e.which : réglé explicitement si le constructeur ne le renseigne pas. */
       for(const [k,v] of [['which',13],['keyCode',13]])if(e[k]!==v)try{Object.defineProperty(e,k,{value:v});}catch{}
       document.dispatchEvent(e);}}
   let apres=null,compteur=null;
   try{compteur=await waitFor(()=>{const c=lireCompteur();return c&&c.traites!==avant.traites?c:false;},'',P.attenteNavigationMs);}catch{compteur=lireCompteur();}
   const nom=bouton?'Le bouton « valider sans suivant »':'Ctrl+Entrée',label=cutLabel();
   if(label&&K.key(label)!==K.key(identity))throw Error(`${nom} a fait changer le cut affiché (partie ${label.part}, cut ${label.cut}) : rien n’est affirmé validé. Contrôle le cut ${identity.cut} dans ESV.`);
   if(!compteur||compteur.total!==avant.total||compteur.traites!==avant.traites+1)
     throw Error(`${nom} sans effet constaté (compteur ${avant.traites} → ${compteur?compteur.traites:'illisible'} sur ${avant.total}) : le cut ${identity.cut} n’est pas confirmé validé.`);
   apres=snapshot();K.assertTarget(identity,apres.identity);
   return {format:'banane-validate-in-place-v1',trigger:bouton?'configured-validate-rail-button':'relayed-native-validate-shortcut',startedAt,
     operatorDecision:'VALIDATE',decisionCommand:command,command:bouton?'bouton':'ctrl-entrée',commandSent:true,
     navigationSemantics:'VALIDATE_IN_PLACE',afterObserved:true,afterState:apres,afterStateStatus:'OBSERVED_SAME_TARGET',
     beforeNavigationIdentity:K.completeIdentity(before.identity),navigationObserved:false,serverConfirmed:true,
     nextIdentity:null,nextReady:null,compteurAvant:avant,compteurApres:compteur,
     meaning:'Validation sans navigation : identité inchangée, compteur « N on M treated » passé de N à N+1 ; ESV est resté sur ce cut.'};
 }
 /* 5.0, RELECTURE APRÈS LE LOT (D-175, revue de la relecture, corrections 4 et 6 ; D-179) — VALIDER PAR MAJ+ESPACE, le geste de Mic.
  * Faits (Échos du projet 2, revue « trace ») : Mic valide TOUJOURS par Maj+Espace (1 377 validations sur 1 377, aucune par
  * Ctrl+Entrée) ; il frappe Maj (ShiftLeft) puis Espace, le canevas d'ESV ayant le focus. SUR UN VERT VALIDE, ESV valide SUR PLACE et
  * RESTE SUR LE MÊME CUT (Mic, deux fois, D-179) ; sur un cut rouge, il passe à un autre cut (cut + 1 dans 93 à 96 % des cas relevés).
  * Ce geste n'est employé que par la passe de relecture en mode « corriger », jamais par le lot (qui garde le bouton « valider et
  * suivant », D-092).
  * La frappe est relayée UNE fois, comme Mic la fait : keydown Maj, keydown Espace (Maj tenue), keyup Espace, keyup Maj, sur le
  * canevas d'ESV (elle remonte au document, où ESV lit `e.which`), `which`/`keyCode` réglés comme pour Maj+Retour arrière.
  * PREUVE : la page ne prouve PAS la validation ; elle rend le cut atteint après la touche, ou aucun changement observé (le cas normal
  * d'un vert : on n'attend qu'un court instant un autre cut, jamais les 15 s d'une navigation). La preuve est l'écriture « valid » de la
  * ligne vue par l'observateur passif, dans le service worker, qui contrôle aussi que le MÊME cut est toujours affiché. Refus AVANT
  * l'envoi (cut, partie ou page différents, libellé illisible, option inconnue, action interrompue) : erreur qui dit « rien n'a été
  * envoyé à ESV » ; après l'envoi, plus jamais : le résultat est rendu, sans renvoi de la touche. */
 /* Temps laissé à ESV pour changer de cut après Maj+Espace (il le fait en 180 ms environ sur un cut rouge) : au-delà, il valide sur place. */
 const FENETRE_SUR_PLACE_MS=1500;
 const TOUCHES_MAJ_ESPACE=[['keydown','Shift','ShiftLeft',16,true],['keydown',' ','Space',32,true],['keyup',' ','Space',32,true],['keyup','Shift','ShiftLeft',16,false]];
 async function validerMajEspace(identity,scope={},options={},progress=()=>{}){
   cancelled=false;const startedAt=new Date().toISOString(),sc=scope&&typeof scope==='object'?scope:{};
   const avantEnvoi=m=>Error(`${m} ; rien n’a été envoyé à ESV.`);
   if(options&&typeof options==='object'&&Object.keys(options).length)throw avantEnvoi(`Maj+Espace : option inconnue (${Object.keys(options).slice(0,3).join(', ')})`);
   let before;try{before=assertExpected(identity);}catch(e){throw avantEnvoi(`Maj+Espace refusé : ${e.message}`);}
   if(sc.pageId!=null&&before.identity.pageId!==sc.pageId)throw avantEnvoi('Maj+Espace refusé : page ESV différente de celle du lot (rechargée ?)');
   if(sc.part!=null&&before.identity.part!==sc.part)throw avantEnvoi(`Maj+Espace refusé : partie ${before.identity.part} affichée, partie ${sc.part} attendue`);
   const depart=cutLabel();if(!depart||K.key(depart)!==K.key(identity))throw avantEnvoi('Maj+Espace refusé : « Cut N of part P » illisible ou différent du cut attendu');
   progress('maj-espace-before-command',{identity:K.completeIdentity(before.identity)});
   if(cancelled)throw avantEnvoi('Maj+Espace : action interrompue avant l’envoi');
   let cible=null;try{cible=window.viewer?.renderer?.domElement||null;}catch{cible=null;}
   const ou=cible&&typeof cible.dispatchEvent==='function'?cible:document;
   for(const [type,key,code,num,maj] of TOUCHES_MAJ_ESPACE){
     const e=new KeyboardEvent(type,{key,code,keyCode:num,which:num,shiftKey:maj,ctrlKey:false,altKey:false,metaKey:false,bubbles:true,cancelable:true,composed:true});
     for(const [k,v] of [['which',num],['keyCode',num]])if(e[k]!==v)try{Object.defineProperty(e,k,{value:v});}catch{}
     ou.dispatchEvent(e);}
   const evidence={format:'banane-maj-espace-v1',trigger:'relayed-operator-validate-shortcut',startedAt,operatorDecision:'VALIDATE',command:'maj-espace',
     decisionCommand:{id:'Shift+Space',exists:true,disabled:false,cible:ou===document?'document':'canevas'},commandSent:true,serverConfirmed:false,
     beforeNavigationIdentity:K.completeIdentity(before.identity),navigationObserved:false,nextIdentity:null,nextReady:null,observedAt:null,meaning:null};
   progress('maj-espace-command-returned',{label:cutLabel()});
   const apres=await attendreAutreCut(identity,Math.min(P.attenteNavigationMs,FENETRE_SUR_PLACE_MS));
   if(!apres){evidence.meaning='Maj+Espace transmis une fois, cut inchangé après le délai : ESV valide sur place, sans changer de cut. Validation non affirmée ici (la preuve est l’écriture vue par le service worker). Aucune touche renvoyée.';return evidence;}
   evidence.navigationObserved=true;evidence.observedAt=new Date().toISOString();evidence.nextIdentity=K.completeIdentity(apres);
   progress('maj-espace-navigation-observed',{nextIdentity:apres});
   try{const pret=await waitFor(()=>{const n=snapshot();return K.key(n.identity)===K.key(apres)?n:false;},'Le cut atteint après Maj+Espace est affiché, mais ses rails ne sont pas prêts.',12000);
     evidence.nextReady=true;evidence.nextIdentity=K.completeIdentity(pret.identity);}
   catch(e){evidence.nextReady=false;progress('maj-espace-next-geometry-unavailable',{message:e.message,nextIdentity:apres});}
   evidence.meaning='Maj+Espace transmis une fois ; ESV a changé de cut. La validation est prouvée par l’écriture « valid » de la ligne, vue par le service worker, qui contrôle le cut affiché.';
   return evidence;}
 /* RETOUR À UN CUT (4.9, cadrage « Revenir à un cut », D-066, D-067, D-077 point 3) —
  * LECTURE SEULE. « Aller au cut N de la partie chargée, et confirmer son identité. »
  * Aucune décision : ni VALIDATE, ni SKIP, ni pose, ni bouton de rail, ni touche. Aller
  * sur un cut déjà validé est permis (consultation) ; Ariane n'y écrit rien.
  *
  * DEUX CHEMINS, puis le refus :
  *  1. ÉVÉNEMENT. La carte d'ESV change de cut en émettant son événement interne
  *     `railPairSelected` (partie, index) sur `#globalcontainer`, par la copie de jQuery
  *     exposée dans la page (`window.$`). HYPOTHÈSES, établies au banc ESV local (code
  *     d'origine d'ESV, serveur simulé, essai E1 du 6 octobre) et JAMAIS vérifiées sur
  *     le vrai ESV : l'index est le N de « Cut N of part P » ; la partie est passée en
  *     TEXTE, celui du numéro affiché (en nombre, le cut s'affiche mais ESV ne sait plus
  *     le valider ensuite) ; un index hors de la partie fait lever ESV. Le chemin n'est
  *     pris que si un écouteur de cet événement est visible sur l'élément (`$._data`,
  *     interne à jQuery) ; sinon, repli. Symboles internes non documentés (KI-026).
  *  2. PAS À PAS. Boutons « cut précédent » / « cut suivant » d'ESV, quel que soit le
  *     statut du cut (`O2N3DCutPrevious3DRail`, `O2N3DCutNext3DRail` : relevés au banc
  *     ESV local, HYPOTHÈSE sur le vrai ESV). Un clic par pas, chaque pas confirmé (le
  *     cut affiché avance d'exactement un, même partie) avant le suivant ; un pas raté
  *     n'est jamais recliqué. Ni `O2N3DCutNextInvalid3DRail` (il saute les cuts validés),
  *     ni raccourci clavier (cahier §5.5 : bouton vérifié avant d'agir).
  *  3. REFUS RENDU, avec la raison de chaque chemin écarté. Rien n'est émis.
  *
  * BORNES. 0 ≤ N et N < M, M lu dans le compteur « N on M treated » (comme `releverEsv`).
  * Sans compteur lisible, N ne dépasse pas le plus grand cut connu de la partie (le cut
  * affiché, ou `borneConnue` donné par le service worker) : un index au-delà ferait
  * lever ESV, et un « suivant » après le dernier cut quitterait la partie.
  *
  * PREUVE. Identité relue avant (« Cut N of part P »), contrôlée contre la cible, puis
  * relue après. Succès SEULEMENT si la partie ET le cut affichés sont la cible ; sinon
  * `incertain` et pause explicite, sans réémission. Les refus sont RENDUS, pas levés
  * (comme `nextWithoutDecision`). Une demande à la fois : une autre demande en vol, une
  * opération déjà invoquée, une action d'Ariane en cours dans la page (pose,
  * validation, navigation, lecture) ou une session Écho : refus. Annulation portée par
  * l'opération (`cancel({operationId})`) : avant l'émission, rien ne part ; entre deux
  * pas, le pas suivant ne part pas. Un événement déjà émis ne se rattrape pas : le cut
  * atteint est relu et dit. */
 const RETOUR={chemin:'auto',pasMax:40,...(window.BananeSettings?.retourCut||{})};
 const navigation={precedent:'O2N3DCutPrevious3DRail',suivant:'O2N3DCutNext3DRail',conteneur:'globalcontainer',evenement:'railPairSelected'};
 /* Actions de la page en cours, par requête : `goToCut` refuse de partir pendant l'une d'elles. */
 const actionsEnCours=new Map();let retourEnVol=null;
 function cheminEvenement(){try{const $=window.$;if(typeof $!=='function')return {disponible:false,raison:'jquery-absent'};
   const el=document.getElementById(navigation.conteneur);if(!el)return {disponible:false,raison:'conteneur-absent'};
   if(typeof $._data!=='function')return {disponible:false,raison:'ecouteurs-illisibles'};
   /* 4.9.5.3 : notre écouteur en ombre (espace de noms `banane53`) n'est pas un écouteur d'ESV : il ne rend jamais ce chemin disponible. */
   const ecouteurs=($._data(el,'events')?.[navigation.evenement]||[]).filter(h=>!String(h?.namespace||'').split('.').includes(NS_OMBRE));
   if(!ecouteurs.length)return {disponible:false,raison:'sans-ecouteur'};
   return {disponible:true,raison:null,jquery:typeof $.fn?.jquery==='string'?$.fn.jquery.slice(0,16):null};}
   catch{return {disponible:false,raison:'lecture-impossible'};}}
 function bornesPartie(courant,borneConnue){const r=releverEsv(null),total=r.compteur&&!(r.compteursVus>1)?r.compteur.total:null;
   if(Number.isInteger(total)&&total>0)return {total,max:total-1,source:'compteur'};
   return {total:null,max:Math.max(...[courant,borneConnue].filter(Number.isInteger)),source:'cut-connu'};}
 /* Attente d'un AUTRE cut affiché que `depuis`. Lecture seule : une annulation ne
  * l'interrompt pas (la commande est déjà partie), le délai la borne. */
 async function attendreAutreCut(depuis,delai=P.attenteNavigationMs){const debut=Date.now();
   for(;;){const l=cutLabel();if(l&&K.key(l)!==K.key(depuis))return l;if(Date.now()-debut>=delai)return null;await sleep(P.sondageMs);}}
 async function goToCut(target,options={},operationId=null,progress=()=>{}){
   const t0=Date.now(),o=options&&typeof options==='object'?options:{},pc=x=>x?{part:x.part,cut:x.cut}:null;
   const evidence={format:'ariane-goto-cut-v1',operationId:operationId??null,action:'GO_TO_CUT',lectureSeule:true,startedAt:new Date(t0).toISOString(),
     cible:{part:Number.isInteger(target?.part)?target.part:null,cut:Number.isInteger(target?.cut)?target.cut:null},identiteAvant:null,identiteApres:null,
     chemin:null,commande:'aucune',emissions:0,pas:null,cheminEvenement:null,cheminPas:null,bornes:null,commandInvoked:false,
     applyCommandSent:false,validationCommandSent:false,skipCommandSent:false,railCommandSent:false,keyboardSent:false,
     source:'symboles internes d’ESV relevés au banc ESV local (hypothèses), non vérifiés sur ESV',
     resultat:null,confirme:false,pauseExplicite:false,pret:null,refusal:null,endedAt:null,durationMs:null};
   const fin=(resultat,code=null,message=null)=>{evidence.resultat=resultat;evidence.confirme=resultat==='confirme';evidence.pauseExplicite=resultat==='incertain';
     if(code)evidence.refusal={code,message,at:new Date().toISOString()};evidence.endedAt=new Date().toISOString();evidence.durationMs=Date.now()-t0;return evidence;};
   const refuse=(code,message)=>fin('refuse',code,message+' Rien n’a été envoyé à ESV.');
   const annule=()=>!!operationId&&cancelledOperations.has(operationId)||cancelled;
   if(operationId&&cancelledOperations.has(operationId))return refuse('CANCELLED_BEFORE_COMMAND','Retour annulé avant toute émission.');
   if(operationId&&invokedOperations.has(operationId)){evidence.commandInvoked='unknown';evidence.firstInvokedAt=invokedOperations.get(operationId);
     return fin('refuse','OPERATION_ALREADY_INVOKED','Cette demande a déjà été invoquée une fois ; aucune seconde émission.');}
   if(retourEnVol)return refuse('ALREADY_RUNNING','Un retour à un cut est déjà en cours : une seule demande à la fois.');
   const autres=[...actionsEnCours.values()].filter(a=>a!=='goToCut'&&a!=='cancel'&&!LECTURES.has(a));
   if(autres.length)return refuse('ADAPTER_BUSY',`Action d’Ariane en cours dans ESV (${autres[0]}) : aucune navigation pendant une pose, une validation, une lecture ou un déplacement.`);
   if(native?.active||manual?.active)return refuse('SESSION_ACTIVE','Une session Écho est active : la navigation de consultation est refusée.');
   if(evidence.cible.part===null||evidence.cible.cut===null)return refuse('INVALID_TARGET','Cible invalide : partie et cut entiers attendus.');
   evidence.inheritedBlanketCancel=cancelled===true;cancelled=false;
   const avant=cutLabel();if(!avant)return refuse('IDENTITY_UNAVAILABLE_BEFORE','« Cut N of part P » illisible : cut de départ inconnu.');
   evidence.identiteAvant=pc(avant);
   if(target.pageId!=null&&target.pageId!==avant.pageId)return refuse('PAGE_MISMATCH','Page ESV différente de celle de la demande (rechargée ?).');
   if(target.part!==avant.part)return refuse('WRONG_PART',`Partie ${target.part} demandée, partie ${avant.part} chargée : seul un cut de la partie chargée est accessible.`);
   const bornes=bornesPartie(avant.cut,o.borneConnue);evidence.bornes=bornes;
   if(target.cut<0||target.cut>bornes.max)return refuse('OUT_OF_BOUNDS',`Cut ${target.cut} hors des bornes de la partie ${avant.part} (0 à ${bornes.max}${bornes.source==='compteur'?`, ${bornes.total} cuts au compteur`:', plus grand cut connu : compteur illisible'}).`);
   if(target.cut===avant.cut){evidence.chemin='aucun';evidence.identiteApres=pc(avant);return fin('confirme');}
   const sens=target.cut>avant.cut?1:-1,ecart=Math.abs(target.cut-avant.cut),bouton=commandInfo(sens>0?navigation.suivant:navigation.precedent);
   const pasMax=Number.isInteger(RETOUR.pasMax)&&RETOUR.pasMax>0?RETOUR.pasMax:40,choix=['auto','evenement','pas','off'].includes(o.chemin)?o.chemin:RETOUR.chemin;
   const ev=cheminEvenement(),pas={disponible:bouton.exists&&!bouton.disabled&&ecart<=pasMax,
     raison:!bouton.exists?'bouton-absent':bouton.disabled?'bouton-desactive':ecart>pasMax?'trop-de-pas':null,bouton:bouton.id,sens,ecart,pasMax};
   evidence.cheminEvenement=ev;evidence.cheminPas=pas;
   if(choix==='off')return refuse('PATH_DISABLED','Retour à un cut coupé dans les réglages (retourCut.chemin).');
   const chemin=choix!=='pas'&&ev.disponible?'evenement':choix!=='evenement'&&pas.disponible?'pas-a-pas':null;
   if(!chemin){const pourquoi=`événement : ${ev.raison}${choix==='evenement'?'':` ; pas à pas : ${pas.raison}`}`;
     if(choix==='evenement')return refuse('NAVIGATION_PATH_UNAVAILABLE','Événement interne d’ESV indisponible ('+pourquoi+').');
     return refuse({'bouton-absent':'NAVIGATION_COMMAND_UNAVAILABLE','bouton-desactive':'NAVIGATION_COMMAND_DISABLED','trop-de-pas':'TOO_MANY_STEPS'}[pas.raison]||'NAVIGATION_PATH_UNAVAILABLE',
       `Aucun chemin vers le cut ${target.cut} (${pourquoi}).`);}
   evidence.chemin=chemin;
   progress('goto-before-command',{operationId:evidence.operationId,chemin,identity:evidence.identiteAvant,cible:evidence.cible});
   /* Dernier instant révocable : rien ne s'intercale plus entre ce contrôle et l'émission. */
   if(annule())return refuse('CANCELLED_BEFORE_COMMAND','Retour annulé avant toute émission.');
   retourEnVol={operationId,depuis:t0};evidence.commandInvoked='unknown';
   if(operationId)invokedOperations.set(operationId,new Date().toISOString());
   /* Le cut atteint, relu ; succès seulement si c'est la cible, puis rails prêts (sans effet sur le succès). */
   const conclure=async l=>{const apres=l||cutLabel();evidence.identiteApres=pc(apres);
     if(!apres)return fin('incertain','IDENTITY_UNAVAILABLE_AFTER','« Cut N of part P » illisible après la commande : cut atteint inconnu. Contrôle ESV ; aucune commande renvoyée.');
     if(apres.part!==target.part||apres.cut!==target.cut)return fin('incertain',K.key(apres)===K.key(avant)?'NO_NAVIGATION_OBSERVED':'WRONG_TARGET_REACHED',
       K.key(apres)===K.key(avant)?`Commande émise, cut ${avant.cut} toujours affiché. Contrôle ESV ; aucune commande renvoyée.`
       :`ESV affiche le cut ${apres.cut} de la partie ${apres.part}, pas le cut ${target.cut} demandé. Contrôle ESV ; aucune commande renvoyée.`);
     try{evidence.pret=!!await waitFor(()=>{const s=snapshot();return K.key(s.identity)===K.key(apres)?s:false;},'',P.attenteMs);}catch{evidence.pret=false;}
     const final=cutLabel();evidence.identiteApres=pc(final);
     if(!final||final.part!==target.part||final.cut!==target.cut)return fin('incertain','TARGET_LEFT_AFTER_ARRIVAL',`Le cut ${target.cut} a été atteint puis quitté (${final?`cut ${final.cut} affiché`:'cut illisible'}). Contrôle ESV.`);
     return fin('confirme');};
   try{
     if(chemin==='evenement'){evidence.commande='evenement';
       try{evidence.emissions=1;window.$(document.getElementById(navigation.conteneur)).trigger(navigation.evenement,[String(target.part),target.cut]);}
       catch(e){evidence.identiteApres=pc(cutLabel());return fin('incertain','NAVIGATION_COMMAND_THREW',`L’événement interne d’ESV a levé (${String(e?.message||e).slice(0,160)}) : cut atteint à contrôler dans ESV ; aucune commande renvoyée.`);}
       evidence.commandInvoked=true;evidence.invokedAt=new Date().toISOString();
       progress('goto-command-returned',{operationId:evidence.operationId,chemin,label:pc(cutLabel())});
       return await conclure(await attendreAutreCut(avant));}
     evidence.commande='pas-a-pas';evidence.pas={sens,demandes:ecart,faits:0,bouton:bouton.id};let courant=avant;
     for(let i=0;i<ecart;i++){
       if(annule()){evidence.identiteApres=pc(cutLabel());if(i===0)evidence.commandInvoked=false;
         return fin(i?'interrompu':'refuse','CANCELLED_BETWEEN_STEPS',`Retour annulé après ${i} pas sur ${ecart} : cut ${courant.cut} affiché, aucun pas de plus.`);}
       const b=document.getElementById(bouton.id);
       if(!b||b.disabled){evidence.identiteApres=pc(cutLabel());
         return fin('interrompu',b?'NAVIGATION_COMMAND_DISABLED':'NAVIGATION_COMMAND_UNAVAILABLE',`Bouton ${bouton.id} ${b?'désactivé':'absent'} au pas ${i+1} sur ${ecart} : cut ${courant.cut} affiché, aucun pas de plus.`);}
       try{evidence.emissions++;b.click();}
       catch(e){evidence.identiteApres=pc(cutLabel());return fin('incertain','NAVIGATION_COMMAND_THREW',`Le bouton ${bouton.id} a levé au pas ${i+1} (${String(e?.message||e).slice(0,160)}) : contrôle ESV ; aucun pas de plus.`);}
       evidence.commandInvoked=true;
       const vu=await attendreAutreCut(courant),attendu=courant.cut+sens;
       if(!vu||vu.part!==target.part||vu.cut!==attendu){const l=vu||cutLabel();evidence.identiteApres=pc(l);
         return fin('incertain',!l?'IDENTITY_UNAVAILABLE_AFTER':!vu?'NO_NAVIGATION_OBSERVED':'WRONG_TARGET_REACHED',
           !l?`Cut illisible après le pas ${i+1} : contrôle ESV ; aucun pas de plus.`:!vu?`Pas ${i+1} sans effet : cut ${courant.cut} toujours affiché ; aucun pas de plus.`
           :`Pas ${i+1} : ESV affiche le cut ${vu.cut} de la partie ${vu.part} au lieu du cut ${attendu} ; aucun pas de plus.`);}
       courant=vu;evidence.pas.faits++;progress('goto-step',{operationId:evidence.operationId,pas:i+1,sur:ecart,identity:pc(vu)});}
     return await conclure(courant);
   }finally{retourEnVol=null;}
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
   manual=new MP4.Collector({state:snapshot,label:cutLabel,capture,
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
   const timer=setTimeout(()=>{nativeRequests.delete(requestId);reject(Error('Sauvegarde Écho sans accusé de réception.'));},10000);
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
     const input=e.data.input;if(input?.type==='geste-vue')return;   // un résumé de geste ne vient que du relevé de cette page
     handler({...input,target:{kind:input.targetKind}});};window.addEventListener('message',relay);nativeListeners.push(['message',relay,false]);
     releverGestesVue(handler);},
   uninstall:()=>{for(const [type,handler,options] of nativeListeners.splice(0)){if(type==='mutation')handler.disconnect();else window.removeEventListener(type,handler,options);}},
   editable:el=>el?.kind==='input'||!!el?.closest?.('input,textarea,select,[contenteditable="true"]'),
   targetKind:el=>el?.kind|| (el?.closest?.('#O2N3DCutValidate3DRail')?'validation':el?.closest?.('canvas')?'canvas':el?.closest?.('button,a')?'control':'other'),
   signalFailure:message=>{if(nativeFailureBanner)return;nativeFailureBanner=document.createElement('div');nativeFailureBanner.style.cssText='position:fixed;left:12px;bottom:12px;z-index:2147483646;max-width:520px;padding:10px 14px;background:#381f23;color:#ffd7dc;border:1px solid #8b5058;border-radius:8px;font:14px Arial;pointer-events:none';
     nativeFailureBanner.setAttribute('role','alert');nativeFailureBanner.textContent=message;document.documentElement.append(nativeFailureBanner);}};}
 /* 5.0 (« déplacer la vue ») — RELEVÉ DES GLISSERS ET DE LA MOLETTE DE L'OPÉRATEUR pendant une session Écho (réglage
  * `echo.gestesVue`). Écouteurs de la fenêtre, phase de capture, PASSIFS : ils lisent, n'empêchent rien, n'arrêtent rien, et ne
  * retiennent que les événements de confiance qui visent la vue d'ESV. La caméra est lue au premier événement du geste (avant
  * qu'ESV ne le traite) et quand elle est de nouveau immobile. Un résumé par geste (src/gestes-vue.js `Releveur`) part dans la
  * file de l'Écho ; les écouteurs sont retirés avec ceux de la session. */
 function releverGestesVue(handler){if(window.BananeSettings?.echo?.gestesVue===false||typeof GV?.Releveur!=='function')return;
   const vueEsv=()=>{try{return window.viewer?.renderer?.domElement||null;}catch{return null;}};
   const R=new GV.Releveur({lireCamera:()=>{const v=window.viewer;return v?L.cameraSnapshot(v,[0,0,0]):null;},
     emettre:geste=>{try{handler({type:'geste-vue',isTrusted:true,target:{kind:'canvas'},geste,observedAt:new Date().toISOString()});}catch{}},
     planifier:(fn,ms)=>setTimeout(fn,ms),maintenant:()=>heurePage()??Date.now(),
     estVue:t=>{const c=vueEsv();return !!c&&!!t&&(t===c||(typeof t.closest==='function'&&t.closest('canvas')===c));}});
   const ecoute=e=>R.evenement(e),opts={capture:true,passive:true};
   for(const t of GV.TYPES_RELEVE){window.addEventListener(t,ecoute,opts);nativeListeners.push([t,ecoute,opts]);}}
 async function nativeStart(options){if(native?.active)throw Error('Écho est déjà actif dans ESV.');nativeChannel=options.channel;
   native=native||new NP4.Observer(nativeApi());return native.start(options);}
 async function nativeResume(options){nativeChannel=options.channel;native=native||new NP4.Observer(nativeApi());return native.resume(options);}
 /* 4.9.5.3 (S6) — ÉCOUTEURS jQUERY EN OMBRE sur les événements internes d'ESV (`#globalcontainer`, par `window.$`). Le gestionnaire ne retourne
  * rien, n'arrête rien (ni `stopPropagation`, ni `preventDefault`, ni valeur retournée), est posé APRÈS ceux d'ESV et attrape toute
  * exception : les gestionnaires d'ESV passent comme avant. Espace de noms `banane53` (écouteurs retirés par lui seul, exclus des comptes de
  * l'empreinte et du chemin `goToCut`). Au plus `parSecondeMax` événements par seconde (le reste est compté, `perdus`). Arguments réduits
  * aux nombres, booléens et chaînes courtes. Posé au premier `ping` / `capture` où le conteneur existe (40 essais au plus). */
 const ombreEsv={installe:false,essais:0,fenetre:[],perdus:0};
 function installerOmbreEsv(){
   if(ESVEV.ombre===false||ombreEsv.installe||ombreEsv.essais>=40)return;ombreEsv.essais++;
   try{const $=window.$;if(typeof $!=='function')return;const el=document.getElementById('globalcontainer');if(!el)return;
     const jq=$(el);if(typeof jq?.on!=='function')return;
     jq.on(ESVEV.noms.map(n=>n+'.'+NS_OMBRE).join(' '),function(ev){
       try{const now=Date.now();while(ombreEsv.fenetre.length&&now-ombreEsv.fenetre[0]>1000)ombreEsv.fenetre.shift();
         if(ombreEsv.fenetre.length>=(ESVEV.parSecondeMax||30)){ombreEsv.perdus++;return;}ombreEsv.fenetre.push(now);
         const args=Array.prototype.slice.call(arguments,1,7).map(v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='boolean'?v:typeof v==='string'&&v.length<=24?v:null);
         const perdus=ombreEsv.perdus;ombreEsv.perdus=0;
         posterObservateur({kind:'esv-event',nom:String(ev?.type||''),args,pageMs:heurePage(),...(perdus?{perdus}:{})});}catch{}
       /* aucune valeur retournée : jQuery ne s'en sert pas, mais un `false` aurait arrêté la propagation. */
     });
     ombreEsv.installe=true;}catch{}}
 /* 4.9.5.3 (S6) — EMPREINTE DU CONTRAT ESV, à « Connecter » (lecture seule, aucune commande, aucune valeur de projet) : boutons de navigation d'ESV
  * (`O2N3Dcut…3DRail`), classes des deux boutons de rail, écouteurs jQuery de chacun des cinq événements sur `#globalcontainer` (les nôtres
  * exclus), versions de jQuery et de Potree. Haché (FNV-1a, 8 caractères) ; le détail part avec lui pour dire ce qui a changé. Comparée par le
  * service worker à la précédente DU MÊME ONGLET.
  * 4.9.5.4 (D-139) : l'empreinte ne contient plus ce qui dépend de l'ÉTAT de la page — les libellés (`title`) des boutons, qui changent selon
  * l'état, et le NOMBRE d'écouteurs par événement. Les boutons sont pris par leur identifiant seul, et un écouteur compte par sa PRÉSENCE
  * (vrai/faux). Les libellés et les nombres restent relevés dans `etat`, consigné sans être haché ni comparé (pour voir, au terrain, ce qui varie).
  * Audit P-5 (H14) : la classe de SÉLECTION d'un bouton de rail (`leftRailSClass` sélectionné, `leftRailUSClass` non, idem à droite) dépend elle
  * aussi de l'état de la page : sélectionner l'autre rail changeait l'empreinte (faux avis « contrat changé »). Elle est ramenée à
  * `leftRail(S|US)Class` : sa présence reste comparée (CLASSE_COTE la lit), son état non ; les classes brutes vont dans `etat`. Forme 2. */
 const FORME_CONTRAT=2,SELECTION_RAIL=/^(left|right)Rail(?:S|US)Class$/;
 function empreinteContrat(){const d={},etat={};
   try{const bs=[...document.querySelectorAll('[id^="O2N3DCut"]')].filter(el=>/3DRail$/.test(el.id)).slice(0,16);d.boutons=bs.map(el=>el.id);etat.titres=bs.map(el=>[el.id,(el.title||'').slice(0,60)]);}catch{d.boutons=null;etat.titres=null;}
   try{const classes=['O2N3DCutLRClick','O2N3DCutRRClick'].map(id=>{const el=document.getElementById(id);return el?[...el.classList].sort():null;});
     etat.rails=classes.map(c=>c?c.join(' ').slice(0,80):null);
     d.rails=classes.map(c=>c?[...new Set(c.map(x=>x.replace(SELECTION_RAIL,'$1Rail(S|US)Class')))].sort().join(' ').slice(0,80):null);}catch{d.rails=null;etat.rails=null;}
   try{const $=window.$;d.jquery=typeof $?.fn?.jquery==='string'?$.fn.jquery.slice(0,16):null;
     const el=document.getElementById('globalcontainer'),ev=typeof $==='function'&&typeof $._data==='function'&&el?$._data(el,'events'):null;
     const nombres=Object.fromEntries(ESVEV.noms.map(n=>[n,ev?(ev[n]||[]).filter(h=>!String(h?.namespace||'').split('.').includes(NS_OMBRE)).length:null]));
     d.ecouteurs=Object.fromEntries(Object.entries(nombres).map(([n,v])=>[n,v===null?null:v>0]));etat.ecouteurs=nombres;}catch{d.jquery=null;d.ecouteurs=null;etat.ecouteurs=null;}
   try{const v=window.Potree?.version;d.potree=v&&typeof v==='object'?[v.major,v.minor].filter(x=>Number.isFinite(x)).join('.')+(typeof v.suffix==='string'?String(v.suffix).slice(0,12):''):typeof v==='string'?v.slice(0,16):null;}catch{d.potree=null;}
   const texte=JSON.stringify(d);let h=2166136261>>>0;for(let i=0;i<texte.length;i++){h^=texte.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
   return {hash:h.toString(16).padStart(8,'0'),detail:d,etat,forme:FORME_CONTRAT};}
 /* T20a — RELEVÉ DU SÉLECTEUR DE PARTIES (lecture seule, au ping de contrat de l'équipement ; réglage `releves.selecteurParties`). SUPPOSÉ : la page
  * d'ESV offre un sélecteur dont chaque entrée est un lien `…&p=N` (architecture 5.0, § P ; jamais vu dans ESV par Ariane). Lus : les liens dont
  * l'adresse porte le paramètre `p`, leur texte (40 caractères) et l'entrée courante (classe `active`, `aria-current`, ou `p` de l'adresse de la
  * page). Rien n'est cliqué ni modifié. « absent » : aucun lien `p=` ; « illisible » : des liens `p=` sans numéro entier. */
 function selecteurParties(){const vus=new Map();let candidats=0;
   for(const a of [...document.querySelectorAll('a[href]')].slice(0,5000)){let v=null;
     try{const u=new URL(a.getAttribute('href'),location.href);if(!u.searchParams.has('p'))continue;candidats++;v=u.searchParams.get('p');}catch{continue;}
     if(!/^\d{1,6}$/.test(v||''))continue;const n=Number(v),li=a.closest('li');
     const actif=a.classList.contains('active')||['page','true'].includes(a.getAttribute('aria-current'))||!!li?.classList.contains('active');
     if(vus.has(n)){if(actif)vus.get(n).current=true;continue;}if(vus.size>=500)continue;
     vus.set(n,{part:n,label:String(a.textContent||'').replace(/\s+/g,' ').trim().slice(0,40)||null,current:actif});}
   if(!candidats)return {status:'absent',current:null,parts:[]};if(!vus.size)return {status:'illisible',current:null,parts:[]};
   const parts=[...vus.values()];
   if(parts.filter(x=>x.current).length!==1){const p=new URL(location.href).searchParams.get('p');for(const x of parts)x.current=/^\d{1,6}$/.test(p||'')&&x.part===Number(p);}
   const c=parts.filter(x=>x.current);return {status:'ok',current:c.length===1?c[0].part:null,parts};}
 /* CH-017 (T27a, PROPOSÉ ; appliqué par l'intégrateur après le relevé, par l'opérateur, d'un vrai changement de partie) — CHANGER DE PARTIE.
  * Clic sur l'entrée « p=N » du sélecteur de parties (SUPPOSÉ : liens `…&p=N`, architecture 5.0 § P, le même que lit `selecteurParties`).
  * Aucune écriture, aucune pose, aucune validation, aucun SKIP. Refus en clair, rien cliqué : partie invalide, une autre action d'Ariane en cours
  * (`occupe`), aucun lien vers la partie (`partie-absente`), libellé « Cut N of part P » illisible. Déjà sur la partie : `deja`, rien cliqué.
  * La réponse part AVANT le clic (il recharge peut-être la page) : elle n'est qu'un ACCUSÉ DE DEMANDE {ok, mode:'lien', de:{part,cut}, vers,
  * demandeA} ; la PREUVE du changement est la partie lue ensuite par le service worker (« Cut N of part P » et rails présents, borne 60 s). */
 /* CH-026 (PROPOSÉ ; appliqué par l'intégrateur) — LES GESTES DE L'OPÉRATEUR POUR PASSER À LA PARTIE SUIVANTE (témoignage de l'opérateur du 30/10,
  * jamais mesuré sur un vrai ESV) : « s'il n'y a plus aucun cut à valider devant, Espace » et « aller au dernier cut de la partie puis avancer avec Z ».
  * Ariane ne synthétise AUCUNE touche : elle clique le bouton d'ESV qui porte la même commande, dont elle lit avant l'existence et l'état.
  *  - `invalide-suivant` : « Next non validated cut » (`O2N3DCutNextInvalid3DRail`, établi par inspection : buttonNextInvalidCut → loadNextInvalidCut,
  *    chemin séparé de la validation et du SKIP). Seulement si le compteur « N on M treated » dit N = M (plus rien à valider dans la partie) :
  *    sinon refus `reste-a-valider`, rien cliqué (le bouton irait au cut non validé, dans la même partie).
  *  - `suivant-dernier` : « Next cut » (`O2N3DCutNext3DRail`, relevé au banc ESV local, l'équivalent de Z = cut suivant) depuis le DERNIER cut de la
  *    partie (index M − 1 ; le service worker y va d'abord par `goToCut`). Sinon refus `pas-au-dernier-cut`, rien cliqué.
  *  - `lien` (défaut, CH-017) : clic sur l'entrée « p=N » du sélecteur, en dernier repli.
  * Aucun de ces chemins n'émet de validation, de SKIP ni de pose ; chaque réponse le dit, avec le compteur et l'identité lus avant. La réponse part
  * AVANT le clic : un accusé de demande ; la preuve reste la partie lue ensuite par le service worker. */
 const MODES_PARTIE=['lien','invalide-suivant','suivant-dernier'];
 function changerPartie(options={}){const o=options&&typeof options==='object'?options:{},part=o.part,mode=MODES_PARTIE.includes(o.mode)?o.mode:'lien';
   if(!Number.isInteger(part)||part<0||part>1e6)return {ok:false,raison:'partie-invalide',mode};
   const autres=[...actionsEnCours.values()].filter(a=>a!=='changerPartie'&&!LECTURES.has(a));
   if(autres.length)return {ok:false,raison:'occupe',action:autres[0],mode};
   const lu=cutLabel();if(!lu)return {ok:false,raison:'libelle-illisible',mode};
   const de={part:lu.part,cut:lu.cut};if(lu.part===part)return {ok:true,deja:true,mode,de,vers:part};
   let compteur=null;try{const r=releverEsv(null);compteur=r.compteur&&!(r.compteursVus>1)?{traites:r.compteur.traites,total:r.compteur.total}:null;}catch{compteur=null;}
   const base={mode,de,vers:part,compteur,validationCommandSent:false,skipCommandSent:false,keyboardSent:false};
   if(mode!=='lien'){
     if(!compteur)return {ok:false,raison:'compteur-illisible',...base};
     const id=mode==='invalide-suivant'?selectors.next:navigation.suivant,b=commandInfo(id);
     if(mode==='invalide-suivant'&&compteur.traites<compteur.total)return {ok:false,raison:'reste-a-valider',bouton:b,...base};
     if(mode==='suivant-dernier'&&lu.cut!==compteur.total-1)return {ok:false,raison:'pas-au-dernier-cut',dernier:compteur.total-1,bouton:b,...base};
     if(!b.exists)return {ok:false,raison:'bouton-absent',bouton:b,...base};
     if(b.disabled)return {ok:false,raison:'bouton-desactive',bouton:b,...base};
     setTimeout(()=>{try{nativeClick(id);}catch{/* le service worker ne verra pas la partie : borne */}},0);
     return {ok:true,...base,bouton:b,demandeA:Date.now()};}
   const lien=[...document.querySelectorAll('a[href]')].slice(0,5000).find(a=>{try{return new URL(a.getAttribute('href'),location.href).searchParams.get('p')===String(part);}catch{return false;}});
   if(!lien)return {ok:false,raison:'partie-absente',...base};
   setTimeout(()=>{try{lien.click();}catch{/* le service worker ne verra pas la partie : borne */}},0);
   return {ok:true,...base,demandeA:Date.now()};}
 let intrusion=null;
 const methods={ping:(options)=>{try{installerOmbreEsv();}catch{}
   const contrat=options&&typeof options==='object'&&options.contrat===true&&relOn('empreinte')?(()=>{try{return empreinteContrat();}catch{return null;}})():null;
   const selecteur=options&&typeof options==='object'&&options.contrat===true&&relOn('selecteurParties')?(()=>{try{return selecteurParties();}catch{return {status:'illisible',current:null,parts:[]};}})():null;
   return {version:K.VERSION,versionName:K.VERSION_NAME??null,pageId,label:cutLabel(),proprietaire:PROPRIO,intrusion,capacites:['changerPartie',...MODES_PARTIE.filter(m=>m!=='lien').map(m=>'changerPartie:'+m)],...(contrat?{contrat}:{}),...(selecteur?{selecteurParties:selecteur}:{})};},state:snapshot,nativeSnapshot,changerPartie,capture,apply,restore,next,nextWithoutDecision,validateAndNext,validateInPlace,skipAndNext,goToCut,validerMajEspace,
   amenerDansLaVue,manualStart,manualPause:async()=>manual?manual.pause():{active:false},manualResume:async()=>manual?manual.resume():{active:false},
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
 window.__BANANE_V3_PAGE=Object.freeze({version:K.VERSION,versionName:K.VERSION_NAME??null,proprietaire:PROPRIO});
 /* D4 (4.8.5, D-061) — RELEVÉ PASSIF D'ESV, après CHAQUE capture, réussie ou
  * non : envoyé APRÈS la réponse, dans son propre message (la capture n'est ni
  * retardée, ni modifiée, ni transformable en erreur). LECTURE SEULE : aucune
  * commande, aucune écriture. (1) Le texte « N on M treated » s'il est lisible
  * (D-062 a : M, son total, est le nombre de cuts de la partie ; il sert à la
  * preuve de fin avec l'autre partie affichée à la reprise) ; `compteursVus` s'il y en a plusieurs ; un texte « treated » d'un
  * autre format → `compteurIllisible`. D-062 (4.8.5 test 2) : aussi le texte
  * « M cuts » (un nombre seul suivi de « cuts » ; ESV l'affiche peut-être,
  * « 7956 cuts ») → `cutsAffiches`, `cutsAffichesVus` s'il y en a plusieurs ;
  * « Cut N of part P » n'en est pas un. Journalisé pour qualification : le
  * service worker tire M (D-062 a) du seul compteur, jamais de ce texte.
  * (2) Le nombre d'objets « rail » que la
  * scène garde, filtrés comme `context()` (deux attendus ; des nombres, jamais
  * des poses). Chaque relevé porte l'identité lue, le cut demandé, la requête
  * et l'heure ; refait à chaque capture, jamais réemployé ; champ absent si
  * illisible, jamais d'erreur. */
 const COMPTEUR=/^\s*(\d[\d.,\u00a0\u202f ]{0,12}?)\s+on\s+(\d[\d.,\u00a0\u202f ]{0,12}?)\s+treated\s*$/i,MAX_TEXTES=20000;
 const TOTAL_CUTS=/^\s*(\d[\d.,\u00a0\u202f ]{0,12}?)\s+cuts\s*$/i;
 const nombre=t=>{const d=String(t).replace(/\D/g,'');return d.length&&d.length<=7?Number(d):NaN;};
 function releverEsv(requestId,demande){const r={at:new Date().toISOString(),requestId};
   if(Number.isInteger(demande?.cut))r.demande={part:demande.part??null,cut:demande.cut};
   try{const l=cutLabel();if(l)r.identity={pageId:l.pageId,part:l.part,cut:l.cut};}catch{}
   try{if(typeof document.createTreeWalker==='function'&&document.body){
     const w=document.createTreeWalker(document.body,typeof NodeFilter!=='undefined'?NodeFilter.SHOW_TEXT:4);let i=0,n=w.nextNode(),vus=0,cutsVus=0;
     for(;n&&i<MAX_TEXTES;n=w.nextNode(),i++){const texte=String(n.nodeValue||''),traite=/\btreated\b/i.test(texte),cuts=/\bcuts\b/i.test(texte);
       if(!traite&&!cuts)continue;
       const el=n.parentElement;if(el&&typeof el.checkVisibility==='function'&&el.checkVisibility()===false)continue;
       if(!traite){const t=[n.nodeValue,el?.textContent,el?.parentElement?.textContent].map(x=>TOTAL_CUTS.exec(String(x??''))).find(Boolean);
         const total=t?nombre(t[1]):NaN;if(Number.isFinite(total)){cutsVus++;if(!('cutsAffiches' in r))r.cutsAffiches=total;}continue;}
       /* Le compteur peut être réparti sur plusieurs éléments : le texte, puis son parent, puis le parent de celui-ci. */
       const m=[n.nodeValue,el?.textContent,el?.parentElement?.textContent].map(t=>COMPTEUR.exec(String(t??''))).find(Boolean);
       const traites=m?nombre(m[1]):NaN,total=m?nombre(m[2]):NaN;
       if(Number.isFinite(traites)&&Number.isFinite(total)){vus++;if(!r.compteur)r.compteur={traites,total};}else r.compteurIllisible=true;}
     if(r.compteur)delete r.compteurIllisible;if(vus>1)r.compteursVus=vus;if(cutsVus>1)r.cutsAffichesVus=cutsVus;
     if(n&&i>=MAX_TEXTES)r.textesTronques=true;}}
   catch{delete r.compteur;delete r.compteurIllisible;delete r.compteursVus;delete r.cutsAffiches;delete r.cutsAffichesVus;delete r.textesTronques;}
   try{const root=window.viewer?.scene?.scene;if(root)r.objetsRail=(root.children||[]).filter(railLu).length;}catch{delete r.objetsRail;}
   return r;}
 /* Commande d'un autre propriétaire (une autre Ariane active dans l'onglet) :
  * refusée, sans rien faire dans ESV, avec la cause et le remède. Si elle
  * aurait agi sur ESV, l'adaptateur se met en sécurité : il ne commande plus
  * ESV pour personne, son propriétaire compris, jusqu'au F5 ; lectures,
  * annulations et arrêts (Écho, session manuelle) restent permis. Revue
  * globale 4.8.5 : le refus EN SÉCURITÉ, adressé à notre propre lot, commence
  * par « Adaptateur ESV sans réponse » : c'est ce texte qui fait mettre le lot
  * en pause reprenable par le moteur épinglé, au lieu d'une erreur définitive.
  * Le refus à une AUTRE Ariane n'est pas un silence : il le dit tel quel. Il
  * nomme l'Ariane propriétaire de l'onglet (son tampon), pas ce code. */
 const LECTURES=new Set(['ping','state','nativeSnapshot']),EN_SECURITE=new Set([...LECTURES,'cancel','nativePause','nativeFinish','manualPause','manualFinish']);
 const nomVersion=K.VERSION_NAME||K.VERSION,nomProprietaire=PROPRIO_NOM||nomVersion;
 const SANS_REPONSE='Adaptateur ESV sans réponse : ';
 const refusEtranger=()=>PROPRIO===null?'Adaptateur ESV installé sans propriétaire : F5 sur ESV, puis Connecter.'
   :`Une autre Ariane (${nomProprietaire}) est active dans cet onglet : désactive-la dans edge://extensions, puis F5 sur ESV.`;
 /* D-062 (c) : la pose en cours va à son terme (la mise en sécurité ne vaut
  * qu'à l'entrée d'une commande) ; la commande suivante est refusée, avec ce
  * qu'elle laisse : validation refusée après la pose → pose faite, non validée,
  * à contrôler puis archiver (D-062 d) ; pose refusée → rien posé. */
 const SUITE={validateAndNext:'Validation refusée : la pose de ce cut est faite, non validée. Contrôle-la dans ESV AVANT tout F5 (un F5 peut l’effacer ; valide-la toi-même si elle est juste). Puis désactive l’autre Ariane dans edge://extensions, F5 sur ESV, et Archiver le résultat interrompu.',
   validateInPlace:'Validation refusée : la pose de ce cut est faite, non validée. Contrôle-la dans ESV AVANT tout F5 (un F5 peut l’effacer ; valide-la toi-même si elle est juste). Puis désactive l’autre Ariane dans edge://extensions, F5 sur ESV, et Archiver le résultat interrompu.',
   nextWithoutDecision:'Navigation refusée : rien n’a été envoyé à ESV pour ce cut. Désactive l’autre Ariane dans edge://extensions, puis F5 sur ESV ; contrôle ce cut dans ESV, puis Archiver le résultat interrompu.',
   skipAndNext:'SKIP refusé : rien n’a été décidé sur ce cut. Désactive l’autre Ariane dans edge://extensions, puis F5 sur ESV ; contrôle ce cut dans ESV, puis Archiver le résultat interrompu.',
   apply:'Pose refusée : rien n’a été posé sur ce cut. Désactive l’autre Ariane dans edge://extensions, puis F5 sur ESV, puis Archiver le résultat interrompu.',
   goToCut:'Retour à un cut refusé : rien n’a été envoyé à ESV. Désactive l’autre Ariane dans edge://extensions, puis F5 sur ESV.',
   validerMajEspace:'Validation refusée : la pose de ce cut est faite, non validée. Contrôle-la dans ESV AVANT tout F5 (un F5 peut l’effacer ; valide-la toi-même si elle est juste). Puis désactive l’autre Ariane dans edge://extensions, F5 sur ESV.',
   restore:'Restauration refusée. Désactive l’autre Ariane dans edge://extensions, puis F5 sur ESV ; contrôle ce cut dans ESV, puis Archiver le résultat interrompu.'};
 const refusSecurite=action=>SANS_REPONSE+`Ariane ${nomVersion} en sécurité : une autre Ariane a tenté de commander cet onglet (« ${intrusion.action} »). `
   +(SUITE[action]||'Désactive l’autre Ariane dans edge://extensions, puis F5 sur ESV, puis Reprendre.');
 // The isolated content script supplies a fresh per-document channel. It is a
 // routing nonce, not a claim that a hostile page is a security boundary.
 window.addEventListener('message',async e=>{if(e.source!==window||e.origin!==location.origin||e.data?.kind!=='banane3:command')return;
   const {id,channel,action,args=[],sentAt,proprietaire}=e.data;if(typeof id!=='string'||typeof channel!=='string'||!Object.hasOwn(methods,action))return;
   if(PROPRIO===null||proprietaire!==PROPRIO){if(PROPRIO!==null&&!EN_SECURITE.has(action)&&!intrusion)intrusion={action,at:new Date().toISOString()};
     window.postMessage({kind:'banane3:result',id,channel,error:refusEtranger()},location.origin);return;}
   if(intrusion&&!EN_SECURITE.has(action)){window.postMessage({kind:'banane3:result',id,channel,error:refusSecurite(action)},location.origin);return;}
   if(['manualStart','nativeStart','nativeResume'].includes(action))args[0]={...args[0],channel};
   /* D-091 (4.9.0.9) : chaque étape porte son heure dans la page (`pageMs`, depuis la réception de
    * la commande). Le pont horodatait à la réception du message : en mode rapide, la suite de
    * `scheduler.yield` passe avant ce message, et la lecture d'un rail paraissait durer 0 s. */
   const recueA=Date.now();
   const progress=(stage,detail={})=>window.postMessage({kind:'banane3:progress',id,channel,stage,
     detail:{...(detail&&typeof detail==='object'?detail:{}),pageMs:Date.now()-recueA}},location.origin);
   /* 4.8.0 (KI-063) — ANNULATION PÉRIMÉE. Un `cancel` sans identifiant
    * d'opération est global : arrivé en retard, il coupait une requête
    * étrangère (terrain du 26/09, partie 14 : « Export interrompu. » sur un lot
    * neuf, 45 s après un « Arrêter » resté sans réponse). Il ne vaut plus que
    * pour la requête qu'il vise (`requestId`, délai du bridge) ou, à défaut,
    * pour une requête déjà en cours quand il a été émis (`sentAt`). Un `cancel`
    * PORTANT un identifiant d'opération reste retenu, quel que soit l'ordre. */
   if(action==='cancel'){const o=args[0]&&typeof args[0]==='object'?args[0]:{};
     const target=typeof o.requestId==='string'?o.requestId:null,scoped=typeof o.operationId==='string';
     const stale=!scoped&&(target?!running.has(target):Number.isFinite(sentAt)&&![...running.values()].some(t=>t<=sentAt));
     if(stale){window.postMessage({kind:'banane3:result',id,channel,result:{cancelRequested:false,stale:true,requestId:target}},location.origin);return;}}
   else{running.set(id,Date.now());actionsEnCours.set(id,action);}
   try{progress('received');const result=await methods[action](...args,progress);window.postMessage({kind:'banane3:result',id,channel,result},location.origin);}
   catch(error){window.postMessage({kind:'banane3:result',id,channel,error:error.message},location.origin);}
   finally{running.delete(id);actionsEnCours.delete(id);
     /* D-157 : le relevé des clics hors vue, après la réponse ; rien de ce qui suit ne peut la toucher. */
     if((action==='apply'||action==='restore')&&clicsHorsVue.length)try{const clics=clicsHorsVue.splice(0),cible=args[0]?.identity;
       window.postMessage({kind:'banane3:clic-hors-vue',channel,requestId:id,releve:{requestId:id,action,mode:action==='apply'?modeClic(args[2]):CLIC_HUMAIN,
         identity:Number.isInteger(cible?.cut)?{part:Number.isInteger(cible.part)?cible.part:null,cut:cible.cut}:null,clics}},location.origin);}catch{}
     /* D4 : le relevé passif, après la réponse ; rien de ce qui suit ne peut la toucher. */
     if(action==='capture')try{window.postMessage({kind:'banane3:releve',channel,requestId:id,releve:releverEsv(id,args[0]?.identity)},location.origin);}catch{}}});
})();
