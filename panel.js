(()=>{'use strict';
 const $=id=>document.getElementById(id),edited=new Set();let state=null,working=false,refreshing=false,uiError=null;
 /* V4.5.4 — une seule fenêtre, navigation interne.
  *
  * Avant : cinq pages HTML, cinq fenêtres popup. Ouvrir le Natif depuis
  * l'accueil laissait deux fenêtres empilées, et la reprise manuelle en ouvrait
  * une troisième. La vue est maintenant un état de CETTE page, porté par le
  * fragment d'URL pour qu'un rechargement la retrouve. */
 const VUES=['home','native','automatic','assisted'];
 const TITRES={
   home:{titre:'Une tâche, une fenêtre.',intro:'Choisis ce que tu veux faire dans ESV.'},
   native:{titre:'Mode Natif',intro:'Banane observe. Tu gardes entièrement la main dans ESV.'},
   automatic:{titre:'Pilotage automatique',intro:'Choisis une plage, puis suis le lot.'},
   assisted:{titre:'Essai assisté',intro:'Une proposition sur le cut affiché, à ta demande.'},
 };
 const routeDemandee=()=>{const v=(location.hash||'').replace(/^#/,'');return VUES.includes(v)?v:'home';};
 let which=routeDemandee();
 function appliquerVue(){
   document.body.dataset.window=which;
   for(const s of document.querySelectorAll('.vue'))s.hidden=s.dataset.vue!==which;
   for(const t of document.querySelectorAll('.nav-tab')){
     const actif=t.dataset.view===which;
     t.classList.toggle('actif',actif);
     if(actif)t.setAttribute('aria-current','page');else t.removeAttribute('aria-current');
   }
   const t=TITRES[which]||TITRES.home;
   if($('vue-titre'))$('vue-titre').textContent=t.titre;
   if($('vue-intro'))$('vue-intro').textContent=t.intro;
   if($('connection'))$('connection').hidden=which==='home';
 }
 function naviguer(vue,pousser=true){
   if(!VUES.includes(vue)||vue===which)return;
   which=vue;uiError=null;
   if(pousser&&location.hash!=='#'+vue)location.hash='#'+vue;
   appliquerVue();
   if(state)render(state);
   void discover().catch(()=>{});
   if(which==='native'){renderReglages();void renderHealth();}
 }
 addEventListener('hashchange',()=>naviguer(routeDemandee(),false));
 // Live port is the source of truth for window presence, including after a service-worker restart.
 let presencePort=null;
 function reportPresence(){try{const port=chrome.runtime.connect({name:'banane-panel-presence'});presencePort=port;
   // Le service worker demande un changement de vue plutôt que d'ouvrir une
   // seconde fenêtre quand on clique sur la pastille d'une autre vue.
   port.onMessage.addListener(m=>{if(m?.kind==='navigate')naviguer(m.view);});
   port.onDisconnect.addListener(()=>{if(presencePort===port){presencePort=null;setTimeout(reportPresence,500);}});
  }catch{setTimeout(reportPresence,1000);}}
 reportPresence();
 async function api(action,args={}){const r=await chrome.runtime.sendMessage({kind:'panel',action,args});if(!r)throw Error('Banane ne répond pas. Rouvre la fenêtre.');if(r.error)throw Error(r.error);return r.result;}
 /* Le moteur est gelé : ses messages renvoient encore vers « Mes corrections »,
  * mode retiré en 4.5.4. On ne peut pas les corriger à la source, donc on les
  * traduit ici vers ce que l'interface offre réellement. Afficher un message
  * qui désigne un mode inexistant est pire qu'un message imparfait. */
 const NOTICES=[[/Ouvre Mes corrections\.?/g,'Reprends ce cut directement dans ESV.']];
 function note(message,error=false){
   let texte=String(message??'');
   for(const [motif,remplacement] of NOTICES)texte=texte.replace(motif,remplacement);
   $('notice').textContent=texte;$('notice').classList.toggle('error',error);}
 function button(id,{hidden=false,disabled=false}={}){if($(id)){$(id).hidden=hidden;$(id).disabled=disabled;}}
 const openStatus=status=>['STARTING','RUNNING','PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(status);
 const manualActive=s=>openStatus(s.manual?.status),nativeActive=s=>openStatus(s.native?.status),active=s=>manualActive(s)||nativeActive(s);
 const recording=s=>['STARTING','RUNNING'].includes(s.manual?.status)||['STARTING','RUNNING'].includes(s.native?.status);
 function same(a,b){return a&&b&&['pageId','part','cut','shape','frameId'].every(k=>a[k]===b[k]);}
 function render(s){state=s;const id=s.current?.identity,b=s.batch,m=s.manual,n=s.native,busy=working||s.busy;
   $('context').textContent=id?`ESV · part ${id.part} · cut ${id.cut}`:'';
   if(which==='native'){
     const running=['STARTING','RUNNING'].includes(n?.status),paused=['PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(n?.status),open=nativeActive(s);
     note(n?.message||'Ouvre le premier cut à observer, puis démarre le mode Natif.',n?.status==='PAUSED_ADAPTER_UNRESPONSIVE');
     if(manualActive(s))note('Une session Mes corrections est active. Termine-la avant de démarrer le mode Natif.');
     if(['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE'].includes(b?.state))note('Un lot automatique est actif. Termine-le avant de démarrer le mode Natif.');
     $('native-count').textContent=n?.visits.length||0;const count=n?.incomplete.length||0;$('native-incomplete').hidden=!count;
     $('native-incomplete').textContent=`${count} visite(s) partielle(s), conservée(s) avec leur motif.`;
     button('native-start',{hidden:open,disabled:busy||manualActive(s)||['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE'].includes(b?.state)});
     $('native-start').textContent=n?.status==='FINISHED'?'Démarrer une nouvelle session':'Démarrer l’observation';
     button('native-pause',{hidden:!running,disabled:working});button('native-resume',{hidden:!paused,disabled:working});
     button('native-end',{hidden:!n||n.status==='FINISHED',disabled:working});
     button('native-download',{hidden:!(n?.status==='FINISHED'||n?.status==='PAUSED_ADAPTER_UNRESPONSIVE'),disabled:working});
     /* L'abandon reste offert tant qu'une session existe, y compris terminée :
      * c'est après l'avoir regardée qu'on décide de la jeter. */
     button('native-discard',{hidden:!n,disabled:working});
     if($('native-discard-note'))$('native-discard-note').hidden=!n;
   }else if(which==='automatic'){
     note(active(s)?'Une collecte manuelle est active. Termine-la avant de lancer un lot.':s.notice||'Choisis les bornes de ton lot TEST.');
     const running=['RUNNING','PAUSED','STOPPED','PAUSED_UNRESOLVED_RAIL','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE'].includes(b?.state),range=running?b.scope:null;
     for(const [f,v] of [['start',range?.start??id?.cut],['end',range?.end??id?.cut],['confidence',s.settings?.minConfidence]])if(v!==undefined&&!edited.has(f)&&document.activeElement!==$(f))$(f).value=v;
     const names={RUNNING:'En cours',PAUSED:'En pause',PAUSED_UNRESOLVED_RAIL:'Rail non résolu',PAUSED_AFTER_STATE_MISSING:'État final manquant',
       PAUSED_ADAPTER_UNRESPONSIVE:'Adaptateur sans réponse',MANUAL_TAKEOVER:'Reprise manuelle',STOPPED:'Arrêté',COMPLETED:'Terminé confirmé',
       FINISHED_WITH_UNCONFIRMED_ACTIONS:'Terminé avec actions non confirmées',ERROR:'Interrompu'};
     // Les cuts repris à la main sont comptés à part : Banane ne les a pas validés.
     const repris=b?.manuallyCompleted?.length?` · ${b.manuallyCompleted.length} repris à la main`:'';
     $('batch').textContent=b?`${names[b.state]||b.state} · ${b.processed.length} cuts traités · ${b.skipped.length} ignorés${repris}${b.error?' — '+b.error.message:''}`:'Aucun lot en cours.';
     /* PAUSED_AFTER_STATE_MISSING n'offre aucun bouton d'action : ni Réessayer,
      * ni SKIP, ni Reprise manuelle. L'opérateur voyait un message sans savoir
      * quoi faire. Ce n'est pourtant pas une panne : la commande est partie, ESV
      * a avancé, et le pilote refuse de compter une réussite qu'il n'a pas
      * observée. Il faut le dire, et dire quoi faire. */
     if(b?.state==='PAUSED_AFTER_STATE_MISSING')
       note('La commande est partie et ESV a changé de cut avant que Banane puisse relire l’état final. '
         +'Le placement a probablement été appliqué, mais Banane ne compte jamais une réussite qu’il n’a pas vue. '
         +'Vérifie le cut dans ESV, puis clique sur Arrêter pour clore le lot.');
     button('start-batch',{disabled:busy||active(s)||['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE'].includes(b?.state)});
     button('pause',{hidden:b?.state!=='RUNNING',disabled:working});/* V4.6.0 : Arrêter reste offert pendant la reprise manuelle — c'est la seule
 * sortie du lot avec « Repris manuellement ». Le masquer enfermait l'opérateur
 * dans un état dont rien ne le faisait sortir. */
button('stop',{hidden:!b||['STOPPED','COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','ERROR'].includes(b.state),disabled:working});
     button('resume',{hidden:!['PAUSED','STOPPED'].includes(b?.state),disabled:busy||active(s)});
     const actionable=b?.step==='apply'&&['unresolved-rail','low-confidence'].includes(b?.pauseReason);
     button('retry',{hidden:!actionable,disabled:busy||active(s)});
     /* « Reprise manuelle » est un ÉTAT DU PILOTE, pas une session de
      * correction : il archive le cut et te le rend sans commande. Le bouton
      * avait été retiré par erreur avec le mode Correction en 4.5.4, alors que
      * `src/engine.js` — gelé — continue de l'annoncer dans son message.
      * L'opérateur lisait donc « Choisis Réessayer, Reprise manuelle, SKIP
      * explicite ou Arrêter » devant trois boutons sur quatre. */
     button('manual-takeover',{hidden:!actionable,disabled:busy||active(s)});
     /* V4.6.0 : la reprise manuelle n'est plus une impasse. Le bouton de
      * déclaration n'existe que dans cet état ; le moteur refuse la déclaration
      * tant qu'ESV n'affiche pas le cut suivant. */
     button('manual-completion',{hidden:b?.state!=='MANUAL_TAKEOVER',disabled:busy||active(s)});
     if(b?.state==='MANUAL_TAKEOVER')
       note('Ce cut t’est rendu : Banane n’a envoyé aucune commande dessus. Corrige-le dans ESV, ouvre le cut suivant, '
         +'puis clique sur « Repris manuellement » — le lot repartira, et ce cut sera journalisé comme repris à la main, jamais comme validé par Banane.');
     button('explicit-skip',{hidden:!actionable,disabled:busy||active(s)});
     button('close-uncertain',{hidden:!s.reconcileRequired,disabled:busy});
     /* Terrain, cut 6/4245 : avec « Tenter la proposition expérimentale », le
      * moteur gelé applique malgré une confiance nulle. Les sélections du
      * cerveau sont donc coupées dans ce mode — il faut le dire, pas le taire. */
     if($('brain-policy')){
       const tente=$('policy')?.value==='attempt', allume=$('brain-toggle')?.checked;
       const sansPause=$('brain-sanspause')?.checked;
       if($('brain-sanspause-box'))$('brain-sanspause-box').hidden=!(tente&&allume);
       $('brain-policy').hidden=!(tente&&allume);
       $('brain-policy').textContent=sansPause
         ? 'Mode essai : le pilote appliquera les sélections du cerveau sans te les montrer avant. Chacune reste marquée dans l’export, donc tu pourras vérifier après coup ce qu’il a choisi et pourquoi.'
         : 'Politique « Tenter » : les sélections du cerveau sont désactivées, car le pilote les appliquerait sans pause. Le biais vertical reste appliqué. Coche ci-dessus pour les autoriser en essai, ou choisis « Mettre le lot en pause » pour les voir avant application.';
     }
   }else if(which==='assisted'){
     note(active(s)?'Une collecte manuelle est active. Termine-la avant de lancer une proposition.':s.notice||'Ouvre un cut puis demande une proposition.');
     button('analyze',{disabled:busy||active(s)});const p=s.mode==='assisted'&&same(s.proposal?.identity,id)&&s.before?s.proposal:null;
     $('proposals').replaceChildren();if(p)for(const side of ['left','right']){
       const fit=p.rails[side],box=document.createElement('div');box.className='proposal';const title=document.createElement('strong');title.textContent=side==='left'?'Rail gauche':'Rail droit';
       const delta=document.createElement('p');delta.textContent=fit.delta?`Latéral : ${(fit.delta[1]*1000).toFixed(1)} mm · vertical : ${(fit.delta[2]*1000).toFixed(1)} mm`:'Pas de position exploitable.';
       const score=document.createElement('small');score.textContent=`Indice LiDAR : ${fit.confidence}/100. ${fit.reasons.join(' ')}`;
       box.append(title,delta,score);$('proposals').append(box);
     }
     button('accept',{hidden:!p||!!s.applied,disabled:busy||active(s)||Object.values(p?.rails||{}).some(r=>!r.delta)});
     button('reject',{hidden:!p||!!s.applied,disabled:busy});button('restore',{hidden:!s.applied||s.validationStarted||!same(s.snapshot?.identity,id),disabled:busy||active(s)});
   }
   if(s.connection?.status==='unavailable'&&!active(s)&&!s.busy){$('connection')?.setAttribute('open','');note(s.connection.message,true);}
   button('connect',{disabled:busy||recording(s)});button('dataset',{disabled:busy||active(s)});button('journal',{disabled:working});if(uiError)note(uiError,true);
 }
 async function refresh(){if(refreshing)return;refreshing=true;try{render(await api('view'));}catch(e){note(e.message,true);}finally{refreshing=false;}}
 async function connect(){const value=$('tabs')?.value;if(!value)throw Error('Choisis ton onglet ESV dans Connexion à ESV.');await api('connect',{tabId:Number(value)});$('connection').open=false;}
 async function discover(){if(which==='home')return;const tabs=await api('list-tabs');$('tabs').replaceChildren();
   if(tabs.length!==1){const o=document.createElement('option');o.value='';o.textContent=tabs.length?'Choisir l’onglet à utiliser…':'Ouvre ESV dans Edge';$('tabs').append(o);}
   for(const t of tabs){const o=document.createElement('option');o.value=t.id;o.textContent=t.title||'ESV';$('tabs').append(o);}
   const s=await api('view');if(tabs.length===1&&!active(s)&&!s.busy&&!['RUNNING','PAUSED'].includes(s.batch?.state))await connect();
   else if(!tabs.length||tabs.length>1&&!s.current)$('connection').open=true;
 }
 function saveBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
 /* V4.5-R — export en flux, compacté et segmenté.
  *
  * L'ancienne version construisait `serialized.join(',')`, soit UNE chaîne JS de
  * plusieurs dizaines de Mo, en plus des objets déjà chargés et du Blob final.
  * Au-delà d'environ 64 Mo la fenêtre n'y survivait pas et la session entière
  * devenait intéléchargeable : toute la collecte était perdue.
  *
  * Trois changements : on ne concatène plus jamais (le Blob reçoit les morceaux
  * séparément), on relâche chaque nuage aussitôt sérialisé, et on coupe en
  * segments autonomes sous un budget d'octets. */
 /* Budget appliqué au FICHIER produit, métadonnées et dictionnaires compris.
  * Mesure sur un export réel du 15/09 : 27,3 Mo de nuages donnaient un fichier
  * de 40,7 Mo une fois ajoutés 7,2 Mo de dictionnaires et 6,2 Mo de
  * métadonnées. Le budget ne portait que sur les nuages, d'où le dépassement.
  * 48 Mo laisse une marge nette sous la limite de téléchargement observée. */
 const SET=()=>globalThis.BananeSettings;
 /* Lecture directe du stockage partagé avec le service worker.
  * Le panneau est de la même origine que lui, donc c'est la même base. Cela
  * évite le message géant qui échouait au-delà de 64 MiB — la vraie limite
  * rencontrée sur le terrain, celle de chrome.runtime.sendMessage. */
 let magasin=null;
 function store(){
   if(magasin!==null)return magasin;
   try{magasin=typeof BananeStorage3==='function'?new BananeStorage3():false;}catch{magasin=false;}
   return magasin;
 }
 async function lireDirect(nom,sessionId){
   const s=store();if(!s)return null;
   try{
     const tout=await s.all(nom);
     return tout.filter(x=>x.nativeSessionId===sessionId);
   }catch{return null;}
 }
 async function lireNuage(id){
   const s=store();
   if(s){try{const c=await s.getCloud(id);if(c)return c;}catch{/* repli message */}}
   return api('cloud',{id});
 }
 const EXPORT_SEGMENT_BYTES=SET()?.export.segmentBytes??48*1024*1024;
 const MIN_OBJECTS_PER_SEGMENT=SET()?.export.minObjectsPerSegment??48;
 // Réserve : le dernier nuage peut introduire un repère neuf (jusqu'à ~40 Ko)
 // et l'en-tête est replié à nouveau à la fermeture. Mesuré sans réserve :
 // 50,3 Mo pour un budget de 48. On vise donc un fichier réellement sous budget.
 const SEGMENT_RESERVE_BYTES=SET()?.export.segmentReserveBytes??4*1024*1024;
 const compactor=()=>globalThis.BananeNativeExport||null;
 async function writeSegments(data,prefix,{segmentBytes=EXPORT_SEGMENT_BYTES,compact=SET()?.export.compact!==false,label='',startIndex=0}={}){
   const {cloudIds,...metadata}=data,X=compact?compactor():null;
   const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
   const exportTrace={cloudObjects:0,chunks:0,captureSummaries:0,pointsExported:0};
   const written=[],acked=[];
   let interner=null,head='',parts=[],bytes=0,inSegment=0,segment=0;
   // Taille réelle du fichier en cours : en-tête REPLIÉ + nuages + dictionnaires.
   // Mesurer les métadonnées non repliées serait très pessimiste (50 Mo contre
   // 6 Mo repliés sur une session de 58 visites) et découperait à l'infini.
   const foldMeta=()=>JSON.stringify(X?X.foldRefs(metadata,interner):metadata).slice(0,-1);
   const fileBytes=()=>bytes+(interner?interner.bytes:0);
   // L'en-tête est sérialisé à la FERMETURE du segment : sinon `exportTrace`,
     // calculé au fil de la boucle, n'atterrissait jamais dans le fichier.
     const openSegment=()=>{interner=X?X.createInterner():null;head=foldMeta();parts=[];bytes=head.length;inSegment=0;};
   const closeSegment=()=>{if(!inSegment)return;segment++;
     // Terrain 15/09 : la trace n'était posée qu'après la boucle, donc seul le
     // DERNIER segment la portait. On la fige à chaque fermeture, avec l'état
     // cumulé à cet instant et ce que ce segment contient en propre.
     metadata.exportTrace={...exportTrace,
       completedAt:new Date().toISOString(),
       segmentIndex:startIndex+segment,segmentObjects:inSegment,
       cumulative:true,allRequestedObjectsPresent:exportTrace.cloudObjects===cloudIds.length};
     head=foldMeta();
     const info=`,"segment":${JSON.stringify({index:startIndex+segment,stamp,objects:inSegment,format:'banane-native-export-segment-v1'})}`;
     const dict=X?`,"dictionaries":${JSON.stringify(interner.dictionaries)}`:'';
     const fmt=X?`,"format":"${X.FORMAT}","compactedFrom":"${metadata.format||'banane-native-session-v2'}"`:'';
     const blob=new Blob([head,info,fmt,',"clouds":[',...parts,']',dict,'}'],{type:'application/json'});
     const name=`${prefix}-${stamp}${label}-seg${String(startIndex+segment).padStart(2,'0')}.json`;
     saveBlob(blob,name);written.push({name,objects:inSegment,approxBytes:bytes});parts=[];};
   openSegment();
   for(let i=0;i<cloudIds.length;i++){
     if(i%25===0||i===cloudIds.length-1)
       note(`Préparation du fichier : ${i+1} / ${cloudIds.length} objets LiDAR${segment?` · ${segment} segment(s) écrit(s)`:''}…`);
     let cloud=await lireNuage(cloudIds[i]);
     if(!cloud)throw Error('Un LiDAR manque dans le stockage. Les autres données restent conservées.');
     if(cloud.format==='banane-native-lidar-chunk-v1'){const points=cloud.pointsSceneRelative?.length||0;
       cloud.storageTrace={...(cloud.storageTrace||{}),pointsSaved:points,pointsExported:points};exportTrace.chunks++;exportTrace.pointsExported+=points;}
     if(cloud.format==='banane-native-lidar-capture-v2'){cloud.trace={...(cloud.trace||{}),pointsExported:cloud.trace?.pointsSaved||0};
       for(const side of ['left','right'])if(cloud.trace.perRail?.[side])cloud.trace.perRail[side].pointsExported=cloud.trace.perRail[side].pointsSaved||0;exportTrace.captureSummaries++;}
     const text=JSON.stringify(X?X.compactCloud(cloud,interner,{}):cloud);
     cloud=null; // relâché immédiatement : seul le texte reste en mémoire
     /* Deux planchers, pour la même raison : chaque segment répète les
      * métadonnées et reconstruit son dictionnaire. Terrain du 15/09 : un
      * segment de queue isolait 1,8 Mo de nuages au prix de 13,4 Mo de surcoût.
      * On ne coupe donc que si le segment courant est déjà substantiel ET si ce
      * qui reste justifie son propre surcoût. Le dépassement éventuel est borné
      * par la queue non coupée, très en dessous de la limite de téléchargement. */
     const restant=cloudIds.length-i;
     if(inSegment>=MIN_OBJECTS_PER_SEGMENT&&restant>=MIN_OBJECTS_PER_SEGMENT&&
        fileBytes()+text.length+SEGMENT_RESERVE_BYTES>segmentBytes){closeSegment();openSegment();}
     if(inSegment)parts.push(',');
     parts.push(text);bytes+=text.length+1;inSegment++;exportTrace.cloudObjects++;acked.push(cloudIds[i]);
   }
   closeSegment();
   return {written,acked,exportTrace,segments:segment};
 }
 /* Assemble le jeu d'export : manifeste léger par message, records et
  * événements lus directement dans le stockage. */
 async function assembler(manifeste){
   const id=manifeste.sessionId;
   const records=await lireDirect('records',id);
   const events=await lireDirect('events',id);
   if(records&&events){
     records.sort((a,b)=>(a.visitIndex??0)-(b.visitIndex??0));
     events.sort((a,b)=>(a.eventSeq||a.event_seq||0)-(b.eventSeq||b.event_seq||0));
     const {sessionId,recordCount,eventCount,alreadyExported,exportAdvice,...reste}=manifeste;
     return {...reste,records,events};
   }
   // Repli : ancien chemin par message, qui peut échouer sur une grosse session.
   note('Lecture directe indisponible, repli sur le transfert par message…');
   return api('native-export-plan');
 }
 async function dataset(data,prefix,options={}){
   const {written,acked,exportTrace,segments}=await writeSegments(data,prefix,options);
   const many=segments>1?` en ${segments} segments (à fusionner avec tools/merge-segments.cjs)`:'';
   if($('export-status'))$('export-status').textContent=
     `Fichier préparé${many} : ${data.records?.length??0} enregistrements et ${exportTrace.cloudObjects} LiDAR, ${exportTrace.pointsExported} points. Envoie ce JSON pour l’analyse.`;
   note(`Export terminé : ${written.map(w=>w.name).join(', ')}`);
   return {written,acked,segments};
 }
 /* Vidage automatique déclenché par le conseil du service worker : un segment
  * part sur le disque avant d'atteindre la limite, donc rien n'est perdu même
  * si la session est interrompue ensuite. */
 /* Santé de la collecte, visible pendant le travail dans ESV. Avant, une
  * dégradation du collecteur ou des captures perdues ne se voyaient qu'après
  * analyse hors ligne de l'export — donc trop tard pour réagir. */
 const LEVEL_TEXT={FULL:'complet',DEGRADED:'réduit',METADATA_ONLY:'métadonnées seules'};
 const mo=n=>(n/1048576).toFixed(n>=10485760?0:1)+' Mo';
 async function renderHealth(){
   if(!$('native-health'))return;
   let h=null;
   try{h=await api('native-health');}catch{return;}
   if(!h||!h.cloudsStored&&!h.visits){$('native-health').hidden=true;return;}
   $('native-health').hidden=false;
   const set=(id,v)=>{if($(id))$(id).textContent=v;};
   set('h-bytes',mo(h.bytesStored));
   set('h-pending',h.bytesPending?`dont ${mo(h.bytesPending)} pas encore écrits (seuil ${mo(h.watermark)})`:'tout est écrit sur disque');
   set('h-seg',String(h.segments));
   set('h-clouds',`${h.cloudsExported} / ${h.cloudsStored} objets LiDAR à l’abri`);
   /* Budget et refus ne sont PAS des pannes. Terrain du 15/09 : 530 budgets +
    * 86 refus de cut = 616 « échecs » affichés en rouge, dont zéro panne. */
   set('h-cap',`${h.captureCompleted} réussies · ${h.captureFailed} en panne`);
   const aPart=[];
   if(h.captureBudgeted)aPart.push(`${h.captureBudgeted} au budget par visite`);
   if(h.captureRefused)aPart.push(`${h.captureRefused} refus de cut`);
   set('h-caprate',aPart.length?`${aPart.join(' · ')} — normales, pas des pannes`
     :h.captureFailureRate?`${h.captureFailureRate} % d’échec`:'');
   set('h-queue',h.queueDepth===null?'—':`${h.queueDepth} en attente`);
   set('h-dropped',h.dropped?`${h.dropped} événements jetés`:'aucun événement jeté');
   set('h-level',LEVEL_TEXT[h.degradationLevel]||h.degradationLevel);
   set('h-peak',h.degradationPeak!==h.degradationLevel
     ? `pire niveau atteint : ${LEVEL_TEXT[h.degradationPeak]||h.degradationPeak}${h.recoveries?` · ${h.recoveries} rétablissement(s)`:''}`
     : '');
   const ecartes=(h.setAside||0)+(h.refused||0);
   if($('h-aside-box')){$('h-aside-box').hidden=!ecartes;set('h-aside',String(ecartes));}
   renderQualite(h.quality);
   /* La note doit NOMMER la cause. La capture du 15/09 montrait « niveau :
    * complet » au-dessus de « la collecte est gênée » : deux affirmations
    * contradictoires, dont aucune n'indiquait que l'alerte venait en réalité du
    * taux d'échec de capture. */
   const causes=[];
   if(h.degradationLevel!=='FULL')causes.push(`niveau réduit à « ${LEVEL_TEXT[h.degradationLevel]||h.degradationLevel} »`);
   if(h.captureFailureRate>=25)causes.push(`${h.captureFailureRate} % des captures LiDAR échouent (${h.captureFailed} sur ${h.captureCompleted+h.captureFailed})`);
   if(h.dropped>0)causes.push(`${h.dropped} événement(s) jeté(s)`);
   if(h.setAside>0)causes.push(`${h.setAside} élément(s) écarté(s)`);
   const alerte=causes.length>0;
   $('native-health').classList.toggle('health-alert',alerte);
   $('native-health').classList.toggle('health-ok',!alerte);
   const detail=ecartes&&h.setAsideItems.length
     ? ` Causes conservées : ${h.setAsideItems.map(i=>i.reason).slice(0,2).join(' ; ')}.`:'';
   set('h-note',alerte
     ? `Collecte gênée : ${causes.join(' · ')}.${h.refused?` ${h.refused} refus définitif(s), normaux, non comptés comme pannes.`:''}${detail}`
     : `Collecte au niveau complet. ${h.visits} visite(s) observée(s).${h.refused?` ${h.refused} refus définitif(s), normaux.`:''}`);
 }
 /* Réglages consultables : la collecte ne doit pas être une boîte noire.
  * Rendu une seule fois, depuis la source unique src/settings.js. */
 let reglagesRendus=false;
 function renderReglages(){
   const hote=$('reglages-liste'),S=SET();
   if(!hote||reglagesRendus||!S)return;
   reglagesRendus=true;
   let groupe=null;
   for(const r of S.describe()){
     if(r.groupe!==groupe){groupe=r.groupe;
       const t=document.createElement('p');t.className='settings-group';t.textContent=groupe;hote.append(t);}
     const dl=document.createElement('dl');dl.className='setting';
     const dt=document.createElement('dt');dt.textContent=r.nom;
     const dd=document.createElement('dd');dd.textContent=r.valeur;
     const p=document.createElement('p');p.textContent=r.pourquoi;
     dl.append(dt,dd,p);hote.append(dl);
   }
 }
 /* Qualité de capture : ce qui conditionne réellement le rendement du moteur.
  * Le flanc interne du champignon est le verrou — il lui en faut 6, la capture
  * en fournit 0 à 1 — et le filtre de visibilité en retire les deux tiers.
  * Autant le voir pendant la collecte plutôt que de le découvrir après coup. */
 /* Motifs d'exclusion en clair : le panneau ne doit pas afficher des étiquettes
  * de code à un opérateur en cabine. */
 const MOTIF={
   'roi-point-count-below-minimum':'trop peu de points dans la zone',
   'engine-useful-point-count-below-minimum':'trop peu de points utiles au moteur',
   'longitudinal-coverage-insufficient':'balayage longitudinal trop court',
   'longitudinal-span-insufficient':'étendue longitudinale trop faible',
   'transform-invalid':'repère non inversible',
   'capture-reference-association-unverified':'association au repère non vérifiée',
   'capture-interrupted-before-stable-boundary':'capture interrompue avant frontière stable'};
 function renderQualite(q){
   const boite=$('native-quality');
   if(!boite)return;
   if(!q||!q.snapshotsTotal&&!q.railsObserved){boite.hidden=true;return;}
   boite.hidden=false;
   const set=(id,v)=>{if($(id))$(id).textContent=v;};
   /* Chiffre de tête : les repères ayant obtenu au moins une fois un instantané
    * qualifié. C'est lui qui conditionne une proposition du moteur. Le taux par
    * instant de capture était trompeur — il comptait en échec toute capture
    * arrêtée par un changement de cible ou de vue, ce qui n'est pas un défaut
    * de couverture. Terrain du 15/09 : 8 % par instant, 100 % par repère sur
    * exactement les mêmes données. */
   set('q-rails',q.railsObserved?`${q.railsQualified} / ${q.railsObserved}`:'—');
   set('q-rails-note',q.railQualifiedRate===null?''
     :`${q.railQualifiedRate} % des repères observés${q.railsTruncated?' (suivi borné)':''}`);
   set('q-snap',`${q.snapshotsQualified} / ${q.snapshotsTotal}`);
   set('q-snap-rate',q.interruptedOnly
     ? `dont ${q.interruptedOnly} écarté(s) pour interruption seule, pas pour manque de points`
     : q.qualifiedRate===null?'':`${q.qualifiedRate} % qualifiés à l’instant de la capture`);
   set('q-clip',q.clipDropRate===null?'—':`${q.clipDropRate} %`);
   const face=q.faceKept+q.faceDropped;
   set('q-face',face?`${q.faceKept} / ${face}`:'—');
   set('q-face-note',q.faceDropRate===null?'':`${q.faceDropRate} % retirés par le clipping`);
   const rendement=q.railQualifiedRate!==null&&q.railQualifiedRate<60;
   const serre=q.faceDropRate!==null&&q.faceDropRate>=50;
   boite.classList.toggle('health-alert',rendement||serre);
   const causes=Object.entries(q.exclusionReasons||{})
     .filter(([r])=>r!=='capture-interrupted-before-stable-boundary')
     .sort((a,b)=>b[1]-a[1]).slice(0,2).map(([r,n])=>`${MOTIF[r]||r} (${n})`);
   set('q-note',rendement
     ? `Moins de 60 % des repères observés obtiennent un instantané qualifié.${causes.length?' Causes dominantes : '+causes.join(' ; ')+'.':''}`
     : serre
     ? 'Le moteur exige au moins 6 points de flanc interne pour proposer un placement. Le filtre de visibilité en retire la majorité : c’est le premier frein au rendement, à vérifier côté réglage des boîtes de découpe ESV.'
     : `Chaque repère observé a obtenu un instantané qualifié.${q.coverageShort?` ${q.coverageShort} instant(s) de capture écarté(s) pour couverture réellement insuffisante.`:''}`);
 }
 let autoExporting=false;
 async function autoExportIfAdvised(){
   if(autoExporting||working)return;
   try{
     const advice=await api('native-export-advice');
     if(!advice?.due)return;
     autoExporting=true;
     note(`Vidage automatique : ${(advice.bytesPending/1048576).toFixed(0)} Mo en attente, écriture d’un segment…`);
     const manifeste=await api('native-export-manifest');
     if(!manifeste?.cloudIds?.length){autoExporting=false;return;}
     const plan=await assembler(manifeste);
     const {acked}=await writeSegments(plan,'banane-native-v4',{label:'-auto',startIndex:advice.segments||0});
     await api('native-export-ack',{ids:acked});
     note(`Segment écrit automatiquement : ${acked.length} objets LiDAR mis à l’abri.`);
   }catch(e){note('Vidage automatique impossible : '+e.message,true);}
   finally{autoExporting=false;}
 }
 async function action(id,fn){if(working)return;uiError=null;working=true;if(state)render(state);try{await fn();}catch(e){uiError=e.message;working=false;if(state)render(state);note(e.message,true);return;}working=false;await refresh();}
 function on(id,fn){if($(id))$(id).onclick=()=>action(id,fn);}
 /* Navigation interne : plus aucune fenetre n'est ouverte depuis l'interface. */
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>naviguer(b.dataset.view));
 on('connect',connect);on('native-start',()=>api('native-start'));on('native-pause',()=>api('native-pause'));on('native-resume',()=>api('native-resume'));
 /* Fin de session et re-téléchargement passent aussi par le manifeste léger :
  * l'ancien chemin renvoyait toute la session en un message et échouait
  * au-delà de 64 MiB. */
 async function exportComplet(prefix){
   const manifeste=await api('native-export-manifest',{all:true});
   return dataset(await assembler(manifeste),prefix);
 }
 on('native-end',async()=>{await api('native-end');return exportComplet('banane-native-v4');});
 on('native-download',()=>exportComplet('banane-native-v4'));
/* Abandon : irréversible, donc une confirmation qui dit ce qui disparaît et
 * combien. Le compte rendu du service worker est affiché tel quel — un
 * effacement muet ne serait pas vérifiable. */
on('native-discard',async()=>{
  const h=await api('native-health').catch(()=>null);
  const quoi=h?`${h.cloudsStored} objet(s) LiDAR et ${h.visits} visite(s)`:'toutes les données de cette session';
  if(!confirm(`Supprimer définitivement ${quoi} ?\n\nAucun export ne sera produit. Les segments déjà téléchargés sur ton disque ne sont pas touchés.\n\nCette action est irréversible.`))
    throw Error('Abandon annulé : rien n’a été supprimé.');
  const r=await api('native-discard');
  note(`Session abandonnée : ${r.clouds} objet(s) LiDAR, ${r.records} visite(s) et ${r.events} événement(s) supprimés.`);
});
    on('start-batch',async()=>{if(!state?.current)throw Error('Connecte ESV avant de lancer le lot.');
   await api('settings',{mode:'automatic-test',minConfidence:Number($('confidence').value)});
   return api('start',{part:state.current.identity.part,start:Number($('start').value),end:Number($('end').value),testConfirmed:true,allowNavigationEvidence:true,lowConfidence:$('policy').value,geometryEngine:'geometry-candidate-v1'});});
 for(const id of ['pause','resume','stop','accept','reject','restore','close-uncertain'])on(id,()=>api(id));
 on('retry',()=>api('retry'));on('explicit-skip',()=>api('explicit-skip'));
 // Reprise manuelle : le pilote rend la main, sans ouvrir aucune fenêtre.
 on('manual-takeover',()=>api('manual-takeover'));
 /* V4.6.0 : l'opérateur déclare avoir traité le cut dans ESV. Banane journalise
  * la reprise sans prétendre l'avoir validée, puis repart au cut suivant. */
 on('manual-completion',()=>api('manual-completion'));
  on('analyze',async()=>{await api('settings',{mode:'assisted'});return api('analyze');});
 on('dataset',async()=>dataset(await api('dataset'),'banane-bilan-v4'));
on('assisted-dataset',async()=>dataset(await api('dataset'),'banane-bilan-v4'));
 on('gcv1-diagnostic-export',async()=>{
   const diagnostic=await api('gcv1-diagnostic-export');
   saveBlob(new Blob([JSON.stringify(diagnostic)],{type:'application/json'}),`banane-gcv1-diagnostic-${Date.now()}.json`);
   note(`Diagnostic GCV1 exporté : ${diagnostic.observationCount} observation(s).`);
 });
 on('gcv1-corpus-export',async()=>{
   const plan=await api('gcv1-corpus-export-plan');
   if(plan.cloudIds.length)await dataset(plan,'banane-gcv1-corpus',{compact:false});
   else saveBlob(new Blob([JSON.stringify({...plan,clouds:[]})],{type:'application/json'}),`banane-gcv1-corpus-${Date.now()}.json`);
   if(plan.missingCaptureIds.length)note(`Corpus GCV1 exporté ; ${plan.missingCaptureIds.length} capture(s) LiDAR référencée(s) sont absentes du store.`,true);
   else note(`Corpus GCV1 exporté : ${plan.cloudIds.length} capture(s) LiDAR.`);
 });
 /* Cerveau : interrupteur explicite, et compte rendu de ce qu'il a fait au
  * dernier passage. Un post-traitement qu'on ne voit pas agir serait pire que
  * pas de post-traitement du tout. */
 async function renderCerveau(){
   if(!$('brain-toggle'))return;
   try{
     const b=await api('brain-state');
     if(document.activeElement!==$('brain-toggle'))$('brain-toggle').checked=b.actif===true;
     if($('brain-sanspause')&&document.activeElement!==$('brain-sanspause'))
       $('brain-sanspause').checked=b.autoriserSelectionSansPause===true;
     const d=b.dernier;
     $('brain-journal').textContent=!d?''
       :d.actif!==true?'Dernier passage : le cerveau était éteint.'
       :d.erreur?`Dernier passage : le cerveau a échoué (${d.erreur}). La proposition du moteur a été rendue telle quelle.`
       :`Dernier passage : ${Object.entries(d.perRail||{}).map(([c,j])=>`${c==='left'?'gauche':'droite'} — ${j.action}${j.motif?' ('+j.motif+')':''}`).join(' · ')}`;
   }catch{/* le cerveau peut ne pas être joignable : ce n'est pas bloquant */}
 }
 if($('brain-sanspause'))$('brain-sanspause').onchange=()=>action('brain-sanspause',async()=>{
   await api('settings',{mode:state?.mode==='assisted'?'assisted':'automatic-test',
     brainSelectionSansPause:$('brain-sanspause').checked});
   if(state)render(state);
   note($('brain-sanspause').checked
     ? 'Sélections autorisées en mode « Tenter ». À utiliser pour observer le cerveau, pas en production.'
     : 'Sélections à nouveau réservées au mode « Mettre le lot en pause ».');
 });
 if($('brain-toggle'))$('brain-toggle').onchange=()=>action('brain-toggle',async()=>{
   await api('settings',{mode:state?.mode==='assisted'?'assisted':'automatic-test',brain:$('brain-toggle').checked});
   if(state)render(state);
   await renderCerveau();
   note($('brain-toggle').checked
     ? 'Cerveau activé. Chaque proposition qu’il touche est marquée dans l’export.'
     : 'Cerveau désactivé. Le moteur gelé propose seul.');
 });
 on('journal',async()=>saveBlob(new Blob([JSON.stringify(await api('journal'))],{type:'application/json'}),`banane-journal-v4-${Date.now()}.json`));
 for(const id of ['start','end','confidence'])if($(id))$(id).oninput=()=>edited.add(id);
 appliquerVue();
 void renderCerveau();
 discover().then(refresh).catch(e=>{uiError=e.message;note(e.message,true);$('connection')?.setAttribute('open','');});
 setInterval(()=>{if(!working)void refresh();},1000);
 // Contrôle du volume pendant la collecte : peu fréquent, jamais bloquant.
 // Le suivi continue quelle que soit la vue affichée : quitter l'onglet Natif
 // ne doit pas interrompre le vidage automatique d'une session en cours.
 setInterval(()=>{if(state&&nativeActive(state)){void autoExportIfAdvised();if(which==='native')void renderHealth();}},SET()?.export.advicePollMs??5000);
 if(which==='native'){renderReglages();void renderHealth();}
})();
