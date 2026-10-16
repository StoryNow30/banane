(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.BananeCore3,
  typeof module==='object'?require('./settings.js'):root.BananeSettings);
 if(typeof module==='object')module.exports=api;else root.BananeNativeSession4=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(K,S){
 'use strict';
 const OPEN=['STARTING','RUNNING','PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'];
 const SIDES=['left','right'],unique=a=>[...new Set(a.filter(Boolean))];
 const completeRails=state=>SIDES.every(side=>!!state?.rails?.[side]);
 const anyRail=state=>SIDES.some(side=>!!state?.rails?.[side]);
 const iso=()=>new Date().toISOString();
 const poseEqual=(a,b,tolerance=1e-7)=>['railLocalToSceneRelative','profileLocalToSceneRelative'].every(name=>
  Array.isArray(a?.[name])&&Array.isArray(b?.[name])&&a[name].length===16&&b[name].length===16&&
  a[name].every((value,index)=>Number.isFinite(value)&&Number.isFinite(b[name][index])&&Math.abs(value-b[name][index])<=tolerance));
 const eventTime=event=>Date.parse(event?.observedAt||event?.timestamp||'');
 /* 4.9.0.18 (AM-13) : déplacement d'un rail entre deux poses, en millimètres, dans le repère profil
  * de la pose de départ (latéral, vertical, longitudinal) et en distance ; `changed` applique le seuil
  * métier (`settings.echo.movementThresholdM`), `identical` la comparaison exacte d'avant (1e-7). */
 const railDelta=(from,to,thresholdM=S.echo?.movementThresholdM??0.001)=>{
  const a=from?.positionSceneRelative,b=to?.positionSceneRelative,inv=from?.sceneRelativeToProfileLocal;
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==3||b.length!==3)return {status:'unavailable',changed:!poseEqual(from,to),identical:poseEqual(from,to),distanceMm:null,localMm:null};
  const distance=Math.hypot(...b.map((v,i)=>v-a[i])),mm=v=>Math.round(v*1e4)/10;
  let local=null;if(Array.isArray(inv)&&inv.length===16){const f=K.C.point(inv,a),t=K.C.point(inv,b);local=t.map((v,i)=>mm(v-f[i]));}
  return {status:'measured',changed:distance>thresholdM,identical:poseEqual(from,to),distanceMm:mm(distance),localMm:local,thresholdMm:thresholdM*1000};};
 const sameCutKey=(a,b)=>K.cutKey(a)===K.cutKey(b);
 /* D-143 : la référence humaine corrigée par l'écriture serveur de validation. ESV écrit la pose finale des deux rails (corps
  * `XLeftEdge`…`ZRightEdge`, même repère que `positionSceneRelative`). Si cette écriture diffère de plus de
  * `settings.echo.ecritureReferenceSeuilM` (1 mm) de l'état de référence, la référence lue à la touche était périmée (un clic
  * sur un rail quelques ms avant la touche : ESV applique le déplacement après). Rend null s'il n'y a rien à corriger, sinon
  * { state, poseFrom, sides, maxDiffMm, diffMm } : `state` est le dernier état observé s'il concorde avec l'écriture à 1 mm près
  * (`poseFrom: 'last-observed-state'`), sinon la référence dont les positions des rails écrits sont celles de l'écriture
  * (`poseFrom: 'write'`, l'orientation du repère profil est gardée). Fonction pure, partagée avec tools/jointure-echo-orbite.cjs. */
 const WRITE_EDGES={left:['XLeftEdge','YLeftEdge','ZLeftEdge'],right:['XRightEdge','YRightEdge','ZRightEdge']};
 const writeRails=body=>{const out={};if(body&&typeof body==='object')for(const side of SIDES){const v=WRITE_EDGES[side].map(key=>body[key]);if(v.every(x=>typeof x==='number'&&Number.isFinite(x)))out[side]=v;}return out;};
 const railPosition=(state,side)=>{const p=state?.rails?.[side]?.positionSceneRelative;return Array.isArray(p)&&p.length>=3&&p.slice(0,3).every(Number.isFinite)?p.slice(0,3):null;};
 const pointDistance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 function referenceParEcriture(referenceState,lastObserved,body,toleranceM=S.echo?.ecritureReferenceSeuilM??0.001){
  const written=writeRails(body),sides=SIDES.filter(side=>written[side]);if(!sides.length||!referenceState?.rails)return null;
  const diffMm={};let max=0;
  for(const side of sides){const p=railPosition(referenceState,side),d=p?pointDistance(p,written[side]):null;
   diffMm[side]=d===null?null:Math.round(d*1e4)/10;if(d===null||d>toleranceM)max=Math.max(max,d===null?Infinity:d);}
  if(!(max>0))return null;
  const concordant=!!lastObserved&&sides.every(side=>{const p=railPosition(lastObserved,side);return p&&pointDistance(p,written[side])<=toleranceM;});
  const state=K.clone(concordant?lastObserved:referenceState);
  if(concordant){for(const side of SIDES)if(!state.rails?.[side]&&referenceState.rails[side]){(state.rails??={})[side]=K.clone(referenceState.rails[side]);}}
  else for(const side of sides){const old=referenceState.rails[side];
   state.rails[side]={positionSceneRelative:written[side].slice(),...(Array.isArray(old?.sceneRelativeToProfileLocal)?{sceneRelativeToProfileLocal:K.clone(old.sceneRelativeToProfileLocal)}:{}),positionSource:'validation-write'};}
  return {state,poseFrom:concordant?'last-observed-state':'write',sides,diffMm,maxDiffMm:Number.isFinite(max)?Math.round(max*1e4)/10:null};}
 /* 5.0 (audit 5.0, I8 (2)) — ENTRÉE SANS FUITE de l'ombre « mémoire des différés » : la frontière de l'observation « continuité » (amendement
  * n°7). Seuls sont copiés l'identité, la visite, la pose de départ (`beforeEstablished`) et les instants des transitions (pour couper au
  * premier changement de rail) ; les points sont ceux des captures prises AUTOUR DE LA POSE DE DÉPART, achevées avant ce changement
  * (`gatherInput`). La référence humaine, la pose finale, les intentions et les écritures de la visite ne sont jamais lues. */
 function entreeSansFuite(record,chunks,O=typeof module==='object'?require('./continuity-observer.js'):globalThis.BananeContinuityObserver){
  const vue={visitId:record.visitId,visitIndex:record.visitIndex,identity:K.clone(record.identity),beforeEstablished:K.clone(record.beforeEstablished),
   stateTransitions:(record.stateTransitions||[]).map(t=>({observedAt:t.observedAt,effect:{kind:t.effect?.kind??null}}))};
  const input=O.gatherInput(vue,chunks),before=vue.beforeEstablished?.rails||{};
  const rails=Object.fromEntries(SIDES.map(side=>[side,before[side]?{...before[side],profileContours:input.contours[side]??before[side].profileContours}:null]));
  return {identity:vue.identity,visitId:vue.visitId,visitIndex:vue.visitIndex,rails,points:input.points,visible:input.visible};
 }
 class Sessions{
  /* Réglages centralisés dans src/settings.js ; ces alias restent exposés pour
   * les tests et les outils qui les lisaient déjà. */
  static EXPORT_WATERMARK_BYTES=S.export.watermarkBytes;
  static BYTES_PER_POINT_ESTIMATE=S.export.bytesPerPointEstimate;
  static BYTES_PER_CLOUD_OVERHEAD=S.export.bytesPerCloudOverhead;
  /* Borne du suivi par repère : la carte est conservée dans la session, donc
   * persistée. Au-delà on cesse d'ajouter des clés et on le signale, plutôt
   * que de laisser la mesure de qualité peser sur la collecte. */
  static QUALITY_RAIL_LIMIT=4000;
  /* Clé d'un repère observé : identité du cut plus le côté. */
  static railKey(identity,side){
   if(!identity||!side)return null;
   const p=identity.part,c=identity.cut;
   if(p===undefined&&c===undefined)return null;
   return `${p??'?'}/${c??'?'}/${side}`;
  }
  constructor(engine,adapter,store){this.e=engine;this.adapter=adapter;this.store=store;this.queue=Promise.resolve();}
  active(){return OPEN.includes(this.e.s.native?.status);}
  running(){return ['STARTING','RUNNING'].includes(this.e.s.native?.status);}
  async init(){const n=this.e.s.native;if(!this.running())return;
   n.metrics=n.metrics||{};n.metrics.pointsSavedByRail=n.metrics.pointsSavedByRail||{left:0,right:0};n.metrics.captureCheckpoints=n.metrics.captureCheckpoints||0;
   const recoveredAt=iso(),events=(await this.store.all('events')).filter(event=>event.nativeSessionId===n.id);
   n.nextEventSeq=Math.max(n.nextEventSeq||0,...events.map(event=>event.eventSeq||event.event_seq||0));
   const period=n.observationPeriods?.find(item=>item.observationPeriodId===n.currentPeriodId);
   if(period&&!period.endedAt){period.status='INTERRUPTED_RECOVERED';period.endTimeStatus='unknown';period.recoveredAt=recoveredAt;
    period.reason='worker-restarted-before-period-closure';}
   if(n.current){const record=n.current;record.leaveReason='worker-restart';record.endTimeStatus='unknown';record.endedAt=null;
    record.recoveredClosure={status:'INTERRUPTED_RECOVERED',recoveredAt,endTimeStatus:'unknown',finalStateInvented:false};
    this.partialReason(record,'worker-restarted-before-visit-closure');this.classify(record);await this.saveRecord(record);n.incomplete=unique([...(n.incomplete||[]),record.recordId]);n.current=null;}
   n.status='PAUSED';n.currentPeriodId=null;n.message='Observation native interrompue. Reprendre créera une nouvelle période sans inventer la continuité pendant l’interruption.';
   n.interruptions=(n.interruptions||0)+1;await this.nativeEvent('recovered-closure',{sessionId:n.id,observationPeriodId:period?.observationPeriodId||null,
    identity:null,recoveredAt,endTimeStatus:'unknown',finalStateInvented:false});await this.e.save();}
  async nativeEvent(type,detail={}){const n=this.e.s.native,copy=K.clone(detail),identity=detail.identity===null?null:K.completeIdentity(detail.identity||{});
   const eventSeq=n?(n.nextEventSeq=(n.nextEventSeq||0)+1):1;
   const event={...copy,eventId:K.uid(),timestamp:iso(),type:'native-'+type,nativeSessionId:n?.id||detail.sessionId,
    observationPeriodId:detail.observationPeriodId||null,identity,eventSeq,event_seq:eventSeq};
   await this.store.putEvent(event);return event;}
  /* F5 en Écho (fiches/ECHO_F5.md) : un démarrage ou une reprise qui échoue marque sa période (`reason:'start-failed'`, `error`) ; l'essai
   * suivant la remplace au lieu de s'empiler (terrain : six périodes de 0 à 60 ms en 8 s). Au pire, une seule période marquée en fin de liste. */
  failPeriod(period,error){period.status='INTERRUPTED';period.endedAt=iso();period.endTimeStatus='observed';period.reason='start-failed';
   period.error=String(error?.message||error||'?').slice(0,240);}
  newPeriod(n){const list=n.observationPeriods;while(list.length&&list.at(-1).reason==='start-failed')list.pop();
   const period={observationPeriodId:K.uid(),startedAt:iso(),endedAt:null,endTimeStatus:'open',status:'STARTING'};
   n.observationPeriods.push(period);n.currentPeriodId=period.observationPeriodId;return period;}
  async start(){if(this.starting||this.ending)throw Error('Le mode Natif est déjà en cours de démarrage ou de fermeture.');this.starting=true;
   try{const old=this.e.s.native;if(['PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(old?.status))return this.resume();
    /* 4.9.0.18 (AM-19) : une session finie, avec des visites, jamais téléchargée en entier, n'est pas remplacée :
     * elle deviendrait inaccessible depuis le panneau (manifeste et « Télécharger à nouveau » visent la session courante). */
    if(old?.status==='FINISHED'&&(old.visits||[]).length&&!old.exportState?.finalExportAt)
      throw Error(`La session Écho précédente (${old.visits.length} visite(s)) n’a pas été téléchargée en entier : clique d’abord sur « Télécharger à nouveau la session », ou abandonne-la.`);
    if(this.active()||this.e.busy||this.e.task||this.e.s.manual&&OPEN.includes(this.e.s.manual.status)||
      ['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE'].includes(this.e.s.batch?.state))
      throw Error('Termine ou arrête l’activité en cours avant de démarrer le mode Natif.');
    const n={id:K.uid(),source:'native-passive-observation',status:'STARTING',startedAt:iso(),finishedAt:null,
      observationPeriods:[],currentPeriodId:null,visits:[],cloudIds:[],incomplete:[],current:null,eventCount:0,nextEventSeq:0,interruptions:0,
      metrics:{queueDepthMax:0,dropped:0,sendFailures:0,captureCompleted:0,captureFailed:0,captureCheckpoints:0,
       pointsSavedByRail:{left:0,right:0},inputHandlerMs:{p50:0,p95:0,max:0,samples:0},degradationLevels:[]},
      message:'Démarrage de l’observation passive…'};
    this.e.s.native=n;this.e.s.mode='observation';const period=this.newPeriod(n);await this.e.save();
    await this.nativeEvent('session-started',{sessionId:n.id,observationPeriodId:period.observationPeriodId,identity:null});
    try{await this.adapter.nativeStart({sessionId:n.id,observationPeriodId:period.observationPeriodId});n.status='RUNNING';period.status='RUNNING';
      n.message='Observation native active. Travaille normalement dans ESV : Banane n’envoie aucune commande.';await this.e.save();return this.e.view();}
    catch(error){n.status='PAUSED_ADAPTER_UNRESPONSIVE';this.failPeriod(period,error);n.message=error.message;await this.e.save();throw error;}
   }finally{this.starting=false;}}
  receive(type,data){const next=this.queue.then(()=>this.handle(type,data));this.queue=next.catch(()=>{});return next;}
  /* 4.7.2 — lecture d'UN enregistrement par sa clé. Avant, chaque événement
   * tardif d'une visite close (capture achevée après le changement de cut,
   * fréquent au rythme réel) relisait TOUS les enregistrements de la base,
   * sessions passées comprises. Le coût croissait avec l'historique. */
  async recordById(id){if(typeof this.store.getRecord==='function')return this.store.getRecord(id);
   return (await this.store.all('records')).find(item=>(item.recordId||item.id)===id);}
  async record(data){const n=this.e.s.native,current=n?.current;if(current?.visitId===data.visitId)return current;
   const saved=data.visitId?await this.recordById(data.visitId):null;
   if(!saved||saved.nativeSessionId!==n?.id||saved.visitId!==data.visitId)throw Error('La visite native ne correspond à aucun enregistrement conservé.');return saved;}
  mergeMetrics(metrics){if(!metrics)return;const m=this.e.s.native.metrics;m.queueDepthMax=Math.max(m.queueDepthMax,metrics.queueDepthMax||0);
   m.dropped=Math.max(m.dropped,metrics.dropped||0);m.sendFailures=Math.max(m.sendFailures,metrics.sendFailures||0);
   m.captureCompleted=Math.max(m.captureCompleted,metrics.captureCompleted||0);m.captureFailed=Math.max(m.captureFailed,metrics.captureFailed||0);
   m.captureCheckpoints=Math.max(m.captureCheckpoints||0,metrics.captureCheckpoints||0);
   if(metrics.inputHandlerMs)m.inputHandlerMs={...metrics.inputHandlerMs,max:Math.max(m.inputHandlerMs.max||0,metrics.inputHandlerMs.max||0)};
   if(metrics.degradationLevel&&!m.degradationLevels.includes(metrics.degradationLevel))m.degradationLevels.push(metrics.degradationLevel);
   // V4.5-R : niveau courant, pic, rétablissements et éléments écartés, pour que
   // la santé de la collecte soit lisible en direct et conservée dans l'export.
   if(metrics.degradationLevel)m.degradationLevel=metrics.degradationLevel;
   if(metrics.degradationPeak)m.degradationPeak=metrics.degradationPeak;
   if(Number.isFinite(metrics.queueDepth))m.queueDepth=metrics.queueDepth;
   for(const k of ['degradationEvents','recoveries','setAside','refused','captureBudgeted','captureRefused','captureSkippedAfterOperatorRailChange'])
    if(Number.isFinite(metrics[k]))m[k]=Math.max(m[k]||0,metrics[k]);
   if(Array.isArray(metrics.setAsideItems)&&metrics.setAsideItems.length){
    m.setAsideItems=metrics.setAsideItems.slice(0,32);}}
  async saveRecord(record){record.updatedAt=iso();await this.store.putRecord(record);}
  /* 4.7.7 — OBSERVATION « CONTINUITÉ » (cahier 4.8, amendement n°7).
   * À la fin d'une première visite, la proposition que GCV1 aurait faite en
   * partant des cuts voisins déjà validés est calculée par
   * `src/continuity-observer.js` et consignée dans `continuityObservation`.
   * Rien n'est appliqué, affiché ni commandé. Le calcul tourne hors de la file
   * des événements (il ne retarde pas leur accusé de réception), une visite à
   * la fois ; seule l'écriture finale repasse par la file, pour ne jamais
   * écraser une mise à jour concurrente de la visite. */
  continuityTools(){
   const observer=typeof module==='object'?require('./continuity-observer.js'):globalThis.BananeContinuityObserver;
   const shadow=typeof module==='object'?require('./gcv1-shadow.js'):globalThis.BananeGCV1Shadow;
   return observer&&typeof shadow?.scientificProposeBoth==='function'?{observer,shadow}:null;}
  continuityOn(){return S.continuity?.observe!==false&&!!this.continuityTools();}
  /* 5.0 (I8 (2)) : la même file sert l'ombre « mémoire des différés », calculée après la continuité de la visite. */
  scheduleContinuity(visitId){
   const continuite=this.continuityOn(),memoire=!!this.memoireReglage();
   if(!continuite&&!memoire)return;
   (this.continuityPending??=[]).push(visitId);
   while(this.continuityPending.length>(S.continuity?.maxPending??4)){const v=this.continuityPending.shift();
    if(continuite)void this.writeContinuity(v,{format:'banane-continuity-observation-v1',status:'skipped-backlog',applied:false,displayed:false});}
   if(!this.continuityRunning){this.continuityRunning=this.drainContinuity().finally(()=>{this.continuityRunning=null;});}}
  async drainContinuity(){await Promise.resolve();
   while(this.continuityPending?.length){const visitId=this.continuityPending.shift();
    if(this.continuityOn())try{await this.observeContinuity(visitId);}
    catch(e){await this.writeContinuity(visitId,{format:'banane-continuity-observation-v1',status:'error',reason:String(e?.message||e),applied:false,displayed:false});}
    try{await this.observeMemoire(visitId);}catch{/* ombre : jamais bloquant */}}}
  /* 5.0 (audit 5.0, I8 (2)) — MÉMOIRE DES DIFFÉRÉS EN OMBRE (`memoire-differes-ombre`, réglage `memoireDifferesOmbre`, module
   * src/voie-recentree.js). À la fin de la PREMIÈRE visite d'un cut que le lot Orbite de la partie a différé : la mémoire de la série (les
   * corrections déjà validées par l'opérateur sur les autres cuts différés de la série, visites antérieures de cette session), puis le
   * moteur recentré sur leur voie, sur l'entrée sans fuite (`entreeSansFuite`). Consigné seulement, dans l'export de l'Écho
   * (`nativeSessionId`) ; l'Écho reste passif. Si le lot de la partie n'est pas connu d'Ariane (aucun enregistrement de lot de cette
   * partie dans l'état du moteur), un seul événement « differes-inconnus » le dit, et rien n'est calculé. */
  memoireReglage(){const r=(globalThis.BananeSettings||S)?.memoireDifferesOmbre;return r&&r.actif===true?r:null;}
  memoireOutils(){
   const V=typeof module==='object'?require('./voie-recentree.js'):globalThis.BananeVoieRecentree;
   const O=typeof module==='object'?require('./continuity-observer.js'):globalThis.BananeContinuityObserver;
   const Shadow=typeof module==='object'?require('./gcv1-shadow.js'):globalThis.BananeGCV1Shadow;
   return V&&O&&typeof Shadow?.scientificProposeBoth==='function'?{V,O,Shadow}:null;}
  /* Cuts que le lot de la partie a laissés différés : dernier enregistrement de lot (hors Écho et Correction) de chaque cut. Null : aucun lot connu. */
  differesDuLot(part){
   const dernier=new Map();
   for(const r of this.e.s.records||[]){if(!r||r.nativeSessionId||r.manualSessionId||r.identity?.part!==part||!Number.isInteger(r.identity?.cut))continue;dernier.set(r.identity.cut,r);}
   if(!dernier.size)return null;
   return [...dernier.values()].filter(r=>r.status==='deferred-unresolved').map(r=>r.identity.cut).sort((a,b)=>a-b);}
  /* Validation utilisable comme mémoire : celle de la continuité (une intention, état frais et associé), ou une référence corrigée par
   * l'écriture serveur de validation (D-143), plus sûre encore. */
  valideePourMemoire(O,r){const f=r?.humanFinalReference;
   if(O.validated(r))return true;
   return f?.source==='validation-write'&&r.operatorIntent==='VALIDATE'&&(r.operatorIntents||[]).length===1&&SIDES.every(side=>(f.state?.rails?.[side]?.positionSceneRelative||[]).length===3);}
  async observeMemoire(visitId){
   const n=this.e.s.native,reglage=this.memoireReglage();if(!n||!reglage)return;
   const record=await this.recordById(visitId);
   if(!record||record.nativeSessionId!==n.id||record.visitRelation?.type!=='first-observation'||!record.beforeEstablished?.rails)return;
   /* Numéro d'ordre de la session (l'export de l'Écho range ses événements par `eventSeq`), pris au moment où l'événement est rangé. */
   const id=record.identity,base=()=>{const eventSeq=n.nextEventSeq=(n.nextEventSeq||0)+1;return {eventId:K.uid(),timestamp:iso(),type:'memoire-differes-ombre',schema:1,nativeSessionId:n.id,
    observationPeriodId:record.observationPeriodId||null,visitId:record.visitId,visitIndex:record.visitIndex,eventSeq,event_seq:eventSeq};};
   const differes=this.differesDuLot(id.part);
   if(!differes){const vus=(this.memoireSansLot??=new Set());if(vus.has(n.id+'|'+id.part))return;vus.add(n.id+'|'+id.part);
    await this.store.putEvent({...base(),version:'memoire-differes-ombre-v1',identity:{part:id.part??null,cut:id.cut??null},frontiere:'avant-reference',etat:'differes-inconnus',
     manque:'la liste des cuts différés par le lot de cette partie (aucun enregistrement de lot de la partie dans l\'état d\'Ariane)',verdict:{posable:false,raison:'differes-inconnus'}});return;}
   if(!differes.includes(id.cut))return;
   const t0=Date.now();let ev;
   try{const outils=this.memoireOutils();if(!outils)throw Error('modules absents');const {V,O,Shadow}=outils;
    const portee=reglage.ecartSerieMax*Math.max(1,differes.length),validees=[];
    for(const visit of n.visits||[]){if(!(visit.visitIndex<record.visitIndex)||visit.identity?.part!==id.part||Math.abs((visit.identity?.cut??Infinity)-id.cut)>portee)continue;
     const other=await this.recordById(visit.visitId);if(!other||other.nativeSessionId!==n.id||!this.valideePourMemoire(O,other))continue;
     validees.push({identity:K.clone(other.identity),visitIndex:other.visitIndex,positions:Object.fromEntries(SIDES.map(side=>[side,other.humanFinalReference.state.rails[side].positionSceneRelative.slice()]))});}
    const chunks=[];for(const cid of record.lidarChunkIds||[]){const c=await this.store.getCloud(cid);if(c)chunks.push(c);}
    const entree=entreeSansFuite(record,chunks,O);
    if(!entree.points.length||!SIDES.every(side=>entree.rails[side]?.profileContours?.length))ev={...V.memoireSerie({identity:id,differes,validees,seuils:reglage}),etat:'sans-nuage'};
    ev=ev?{version:'memoire-differes-ombre-v1',identity:{part:id.part??null,cut:id.cut??null},frontiere:'avant-reference',etat:'sans-nuage',serie:ev.serie,memoire:ev.memoire,verdict:{posable:false,raison:'sans-nuage'}}
     :V.evaluerEcho({entree,differes,validees,Shadow,seuils:reglage}).evenement;
    ev={...ev,points:entree.points.length};}
   catch(e){ev={version:'memoire-differes-ombre-v1',identity:{part:id.part??null,cut:id.cut??null},frontiere:'avant-reference',etat:'erreur',message:String(e?.message||e).slice(0,160),verdict:{posable:false,raison:'erreur'}};}
   await this.store.putEvent({...base(),...ev,ms:Date.now()-t0});}
  async observeContinuity(visitId){const n=this.e.s.native,tools=this.continuityTools();if(!n||!tools)return;
   const record=await this.recordById(visitId);
   if(!record||record.nativeSessionId!==n.id||record.visitRelation?.type!=='first-observation'||!record.beforeEstablished?.rails)return;
   // Ancres : visites ANTÉRIEURES de cette session, voisines du cut ; la visite observée n'est jamais relue au-delà de sa pose de départ.
   const earlier=[];
   for(const visit of n.visits||[])if(visit.visitIndex<record.visitIndex&&tools.observer.near(record.identity,visit.identity,tools.observer.DEFAULTS.gap)){
    const other=await this.recordById(visit.visitId);if(other&&other.nativeSessionId===n.id)earlier.push(other);}
   const anchors=tools.observer.selectAnchors(record,earlier);
   const chunks=[];if(anchors.length)for(const id of record.lidarChunkIds||[]){const chunk=await this.store.getCloud(id);if(chunk)chunks.push(chunk);}
   await this.writeContinuity(visitId,tools.observer.observe({record,anchors,chunks,Shadow:tools.shadow}));}
  writeContinuity(visitId,observation){
   const next=this.queue.then(async()=>{const record=await this.recordById(visitId);if(!record)return;
    record.continuityObservation=observation;await this.saveRecord(record);});
   this.queue=next.catch(()=>{});return next;}
  async continuityIdle(limitMs=S.continuity?.drainAtEndMs??15000){
   if(!this.continuityRunning)return;let timer;
   await Promise.race([this.continuityRunning,new Promise(resolve=>{timer=setTimeout(resolve,limitMs);})]);clearTimeout(timer);}
  partialReason(record,reason){record.partialReasons=record.partialReasons||[];if(reason&&!record.partialReasons.includes(reason))record.partialReasons.push(reason);}
  establishBefore(record,state){if(!state||!anyRail(state))return;record.beforeEstablishedByRail=record.beforeEstablishedByRail||{left:null,right:null};
   if(!record.beforeEstablished){record.beforeEstablished=K.clone(state);record.beforeEstablished.rails={left:null,right:null};}
   for(const side of SIDES)if(!record.beforeEstablishedByRail[side]&&state.rails?.[side]){record.beforeEstablishedByRail[side]={side,rail:K.clone(state.rails[side]),
     observedAt:state.capturedAt||iso(),viewObservation:K.clone(state.viewObservation??null),identity:K.completeIdentity(state.identity),immutable:true};
    record.beforeEstablished.rails[side]=K.clone(state.rails[side]);}
   const observed=SIDES.filter(side=>record.beforeEstablishedByRail[side]);record.beforeEstablishment={status:observed.length===2?'complete-by-rail':'partial-by-rail',
    observedRails:observed,simultaneous:observed.length===2&&record.beforeEstablishedByRail.left.observedAt===record.beforeEstablishedByRail.right.observedAt,
    observedAtByRail:Object.fromEntries(SIDES.map(side=>[side,record.beforeEstablishedByRail[side]?.observedAt||null])),immutablePerRail:true};}
  /* Relation d'une visite aux précédentes du même cut — 4.7.2.
   *
   * Dans la session, la liste chronologique `n.visits` suffit : elle retient la
   * DERNIÈRE visite du cut (l'ancienne lecture intégrale prenait la dernière
   * dans l'ordre des clés, c'est-à-dire des UUID). Entre sessions, un index des
   * autres sessions est construit une fois par vie du service worker, au lieu
   * d'une lecture intégrale de la base à chaque début de visite. */
  async crossSessionIndex(n){if(this.crossIndex?.sessionId===n.id)return this.crossIndex.map;const map=new Map();
   for(const record of await this.store.all('records'))
    if(record.source==='native-passive-observation'&&record.visitId&&record.nativeSessionId!==n.id)
     map.set(K.cutKey(record.identity),{visitId:record.visitId,nativeSessionId:record.nativeSessionId});
   this.crossIndex={sessionId:n.id,map};return map;}
  /* 4.9.0.18 (AM-08) : la relation entre visites se fait sur la clé métier (partie, cut) : `pageId` et
   * `frameId` changent à chaque F5 ou recentrage, et rendaient toute revisite d'une autre page « première
   * observation » (et la revisite inter-session impossible). */
  visitRelation(n,identity,periodId,cross){const cut=K.cutKey(identity);
   const previous=(n.visits||[]).slice().reverse().find(visit=>visit.visitId&&K.cutKey(visit.identity)===cut);
   if(previous)return {type:previous.observationPeriodId===periodId?'revisit':'pause-continuation',relatedVisitId:previous.visitId,relatedSessionId:n.id};
   const other=cross?.get(cut);
   if(other)return {type:'cross-session-revisit',relatedVisitId:other.visitId,relatedSessionId:other.nativeSessionId};
   return {type:'first-observation',relatedVisitId:null,relatedSessionId:null};}
  redactedEvent(type,data){if(type==='capture-ready'){const cloud=data.cloud||{},pointsByRail=Object.fromEntries(SIDES.map(side=>[side,cloud.railObservations?.[side]?.pointsRetained||0]));
    return {...data,cloud:{format:cloud.format,captureId:cloud.captureId,identity:cloud.identity,status:cloud.status,termination:cloud.termination,pointsByRail,trace:cloud.trace}};}
   if(type==='capture-checkpoint'){const chunk=data.chunk||{};return {...data,chunk:{format:chunk.format,chunkId:chunk.chunkId,captureId:chunk.captureId,visitId:chunk.visitId,
     side:chunk.side,identity:chunk.identity,capturedAt:chunk.capturedAt,acquisition:chunk.acquisition,
     qualification:chunk.qualification?{status:chunk.qualification.status,criteriaVersion:chunk.qualification.criteriaVersion,
      acquiredThroughAt:chunk.qualification.acquiredThroughAt,coverage:chunk.qualification.coverage}:null,points:chunk.pointsSceneRelative?.length||0}};}
   return data;}
  async handle(type,data){const n=this.e.s.native;if(!n||n.id!==data.sessionId||!this.active())throw Error('La session Natif n’est plus active.');
   if(n.status==='PAUSED'&&data.observationPeriodId&&n.currentPeriodId===null)await this.heal(data);
   this.mergeMetrics(data.collectorMetrics);n.eventCount++;
   // A checkpoint event represents a completed storage write; other events
   // retain their ordinary arrival order. This is not a physical cut order.
   const logged=type==='capture-checkpoint'?null:await this.nativeEvent(type,this.redactedEvent(type,data));
   if(type==='period-started'){const period=n.observationPeriods.find(item=>item.observationPeriodId===data.observationPeriodId);
    if(period){period.status='RUNNING';period.startedAt=data.startedAt||period.startedAt;period.endTimeStatus='open';}await this.e.save();return {saved:true,eventSeq:logged.eventSeq};}
   if(type==='visit-started'){
    if(n.current){this.partialReason(n.current,'new-visit-before-previous-close');n.current.status='partial';n.incomplete=unique([...n.incomplete,n.current.recordId]);await this.saveRecord(n.current);}
    const identity=K.completeIdentity(data.identity||data.initialObserved?.identity||{}),visitIndex=n.visits.length,cross=await this.crossSessionIndex(n);
    const record={format:'banane-native-visit-v2',version:K.VERSION,recordId:data.visitId,id:data.visitId,nativeSessionId:n.id,
      source:'native-passive-observation',observationPeriodId:data.observationPeriodId,visitId:data.visitId,visitIndex,
      previousVisitId:data.previousVisitId||n.visits.at(-1)?.visitId||null,nextVisitId:null,visitRelation:this.visitRelation(n,identity,data.observationPeriodId,cross),identity,
      startedAt:data.initialObserved?.capturedAt||iso(),endedAt:null,endTimeStatus:'open',firstObserved:K.clone(data.initialObserved),beforeEstablished:null,beforeEstablishedByRail:{left:null,right:null},
      beforeEstablishment:{status:'not-established',observedAt:null,immutable:true},lastObserved:K.clone(data.initialObserved),humanFinalReference:null,
      initialObserved:K.clone(data.initialObserved),finalObserved:K.clone(data.initialObserved),stateTransitions:[],operatorEvents:[],operatorIntents:[],multiIntent:false,observedEffects:[],
      /* 4.9.0.18 : pose de départ = dernier état observé AVANT le premier geste (AM-03) ; toutes les références
       * de validation (AM-02) ; écritures de validation d'ESV jointes (AM-14) ; poses de chaque transition (AM-03). */
      startPose:null,humanFinalReferences:[],serverWrites:[],railPoseHistory:[],
      operatorIntent:null,commandSentByBanane:false,commandSent:'not-observed',serverConfirmed:false,serverConfirmationStatus:'not-observed',
      navigationObserved:false,nextObservedIdentity:null,lidarCaptureIds:[],lidarChunkIds:[],geometryCaptures:{},geometryObservations:{left:[],right:[]},
      railSnapshots:{left:[],right:[]},
      geometryEligibility:{left:{status:'not-evaluated',reasons:[]},right:{status:'not-evaluated',reasons:[]},pair:{status:'not-evaluated',reasons:[]}},
      geominfo:data.initialObserved?.geominfo||{status:'not-observed',raw:null,source:null},
      esvSequence:{previousCutId:null,nextCutId:null,sequenceIndex:null,chainage:null,status:'not-observed'},
      context:{track:null,switch:null,levelCrossing:null,esvObject:null,status:'not-observed'},partialReasons:[],status:'observing',
      usableAsNativeReference:false,usableForOfflineEvaluationByRail:{left:false,right:false},usableForTraining:false,
      trainingExclusionReason:'native-reference-requires-explicit-review'};
    this.establishBefore(record,data.initialObserved);for(const reason of data.initialObserved?.partialReasons||[])this.partialReason(record,reason);
    const previousId=n.visits.at(-1)?.visitId;if(previousId){const previous=await this.recordById(previousId);
      if(previous&&previous.nativeSessionId===n.id&&previous.visitId===previousId){previous.nextVisitId=record.visitId;await this.saveRecord(previous);}}
    /* 4.7.20 (piste H) : début de la visite, pour le temps par cut du panneau. */
    n.current=record;n.visits.push({visitId:record.visitId,visitIndex,identity,observationPeriodId:record.observationPeriodId,relation:record.visitRelation.type,startedAt:record.startedAt});
    this.e.s.current=K.clone(data.initialObserved);await this.saveRecord(record);await this.e.save();return {saved:true,recordId:record.recordId,eventSeq:logged.eventSeq};
   }
   if(type==='observation-failed'){if(n.current){this.partialReason(n.current,data.reason||'observation-failed');await this.saveRecord(n.current);}
    n.incomplete=unique([...n.incomplete,n.current?.recordId]);await this.e.save();return {saved:true,eventSeq:logged.eventSeq};}
   if(type==='operator-event'&&!data.visitId)return {saved:true,eventSeq:logged.eventSeq};
   /* 5.0 (« déplacer la vue ») : glisser ou série de crans de l'opérateur, observation seule. Consigné au journal ; rangé dans la
    * visite (32 au plus, et un compte jamais tronqué). Rien d'autre de la visite n'en dépend. */
   if(type==='operator-gesture'){if(!data.visitId)return {saved:true,eventSeq:logged.eventSeq};
    let visite=null;try{visite=await this.record(data);}catch{visite=null;}   // visite inconnue : consigné au journal seulement
    const g=data.geste&&typeof data.geste==='object'?data.geste:null;
    if(visite&&g){const resume=visite.gestesVueResume??={glissers:0,molettes:0,crans:0,gardes:0};
     if(g.type==='glisser')resume.glissers++;else if(g.type==='molette'){resume.molettes++;resume.crans+=Number.isFinite(g.crans)?g.crans:0;}
     const liste=visite.gestesVue??=[];if(liste.length<32){liste.push({...K.clone(g),eventSeq:logged.eventSeq});resume.gardes=liste.length;}
     await this.saveRecord(visite);}
    return {saved:true,eventSeq:logged.eventSeq};}
   const record=data.visitId?await this.record(data):null;
   if(type==='operator-event'){
    const observed={...K.clone(data.event),eventSeq:logged.eventSeq,event_seq:logged.eventSeq,collectorSeq:data.collectorSeq??null};record.operatorEvents.push(observed);
    if(record.operatorEvents.length>128){record.operatorEvents.shift();this.partialReason(record,'operator-events-truncated');}
    /* 4.9.0.18 (AM-16) : résumé des gestes, jamais tronqué : compte par touche, premier et dernier. */
    this.summariseGesture(record,observed);
    /* 4.9.0.18 (AM-03) : la pose de départ est le dernier état observé avant le PREMIER geste (hors intention :
     * une validation sans aucun geste vu avant garde le premier état établi, pour ne cacher aucune correction) ;
     * l'ancien `beforeEstablished` (premier état vu, immuable) reste consigné pour comparaison. */
    if(!record.startPose&&data.stateObservedBeforeInput&&anyRail(data.stateObservedBeforeInput)){
     /* Premier événement = une intention, alors que les rails ont déjà bougé sans geste vu : on ne cache aucune
      * correction, la pose de départ reste le premier état établi, et le cas est nommé. */
     const sansGeste=!!observed.intent&&(record.railPoseHistory||[]).length>0&&record.beforeEstablished?.rails;
     const st=sansGeste?{rails:record.beforeEstablished.rails,capturedAt:record.beforeEstablished.capturedAt||null,identity:record.identity}:data.stateObservedBeforeInput;
     record.startPose={rails:K.clone(st.rails),capturedAt:st.capturedAt||null,identity:K.completeIdentity(st.identity),source:sansGeste?'before-established-no-gesture-seen':'last-state-before-first-gesture',
      eventSeq:logged.eventSeq,firstGesture:{type:observed.type,key:observed.key??null,targetKind:observed.targetKind??null,observedAt:observed.observedAt||logged.timestamp},
      differsFromBeforeEstablished:SIDES.some(side=>record.beforeEstablished?.rails?.[side]&&st.rails?.[side]&&!poseEqual(record.beforeEstablished.rails[side],st.rails[side]))};}
    if(observed.intent){const state=K.clone(data.stateObservedBeforeInput||record.lastObserved||null),intent={intent:observed.intent,observedAt:observed.observedAt||logged.timestamp,
       eventSeq:logged.eventSeq,collectorSeq:data.collectorSeq??null,repeat:!!observed.repeat,stateObservedBeforeInput:state};
      if(state){try{K.assertTarget(record.identity,state.identity);}catch{state.identityAssociation='mismatch';}}
      record.operatorIntents.push(intent);record.multiIntent=record.operatorIntents.length>1;record.operatorIntent=record.multiIntent?'AMBIGUOUS_MULTIPLE':observed.intent;
      record.operatorIntentObservedAt=intent.observedAt;if(observed.intent==='VALIDATE'){
       /* 4.9.0.18 (AM-02) : chaque validation a sa référence ; `humanFinalReference` est la DERNIÈRE
        * (avant : la première, jamais mise à jour : valider, bouger encore, revalider gardait l'ancienne pose). */
       const freshness=state&&Number.isFinite(eventTime(intent))&&Number.isFinite(Date.parse(state.capturedAt||''))?eventTime(intent)-Date.parse(state.capturedAt):null;
       const skew=S.echo?.freshnessSkewMs??50,uncertain=freshness!==null&&freshness<-skew;
       const reference={status:uncertain?'candidate-timing-uncertain':'candidate-observed',state,
        observedAt:intent.observedAt,eventSeq:intent.eventSeq,decisionKey:observed.decisionKey??null,
        association:{identityMatched:state?.identityAssociation!=='mismatch',freshnessMs:freshness,
         source:uncertain?'cached-state-arrived-after-operator-input':freshness!==null&&freshness<0?'state-read-within-skew-after-input':'last-passively-observed-state-before-intent',
         eventTimeStamp:observed.eventTimeStamp??null,stateCapturedAt:state?.capturedAt||null,reviewed:false}};
       (record.humanFinalReferences??=[]).push(reference);record.humanFinalReference=reference;
       record.humanFinalReferenceSource=record.humanFinalReferences.length>1?'last-validate-intent':'sole-validate-intent';
       if(uncertain)this.partialReason(record,'cached-state-observed-after-operator-input');}}
    await this.saveRecord(record);return {saved:true,eventSeq:logged.eventSeq};
   }
   if(type==='state-observed'){
    K.assertTarget(record.identity,data.state.identity);record.lastObserved=K.clone(data.state);record.finalObserved=K.clone(data.state);this.establishBefore(record,data.state);
    record.stateTransitions.push({observedAt:data.state.capturedAt,trigger:data.trigger,effect:data.effect,eventSeq:logged.eventSeq});record.observedEffects.push(K.clone(data.effect));
    if(record.stateTransitions.length>64){record.stateTransitions.shift();this.partialReason(record,'state-transitions-truncated');}
    /* 4.9.0.18 (AM-03, C-02) : la pose de chaque transition de rails, pour la trajectoire du geste. */
    if(/rail/.test(data.effect?.kind||'')){(record.railPoseHistory??=[]).push({observedAt:data.state.capturedAt,eventSeq:logged.eventSeq,afterGesture:record.operatorEvents.length>0,
      rails:Object.fromEntries(SIDES.map(side=>[side,data.state.rails?.[side]?{positionSceneRelative:K.clone(data.state.rails[side].positionSceneRelative),
       railLocalToSceneRelative:K.clone(data.state.rails[side].railLocalToSceneRelative),profileLocalToSceneRelative:K.clone(data.state.rails[side].profileLocalToSceneRelative)}:null]))});
     if(record.railPoseHistory.length>64){record.railPoseHistory.shift();this.partialReason(record,'rail-pose-history-truncated');}
     /* D-143 : un rail qui bouge juste après la touche de validation (≤ `changementApresIntentionMs`) : la référence lue à la
      * touche peut être périmée ; l'écriture serveur de validation la corrige (noteServerWriteNow). */
     const validate=(record.operatorIntents||[]).filter(item=>item.intent==='VALIDATE').pop(),after=validate?Date.parse(data.state.capturedAt||'')-eventTime(validate):NaN;
     if(validate&&after>=0&&after<=(S.echo?.changementApresIntentionMs??150))this.partialReason(record,'rail-change-after-validate-intent');}
    for(const reason of data.state.partialReasons||[])this.partialReason(record,reason);this.e.s.current=K.clone(data.state);await this.saveRecord(record);return {saved:true,eventSeq:logged.eventSeq};
   }
   if(type==='capture-checkpoint'){
    const chunk=K.clone(data.chunk);K.assertTarget(record.identity,chunk.identity);if(!SIDES.includes(chunk.side))throw Error('Côté de capture Natif invalide.');
    if(chunk.visitId&&chunk.visitId!==record.visitId)throw Error('Checkpoint LiDAR associé à une autre visite.');
    if(record.lidarChunkIds.includes(chunk.chunkId)||await this.store.getCloud(chunk.chunkId))throw Error('Identifiant de bloc LiDAR déjà utilisé : copie immuable non remplacée.');
    chunk.nativeSessionId=n.id;chunk.visitId=record.visitId;chunk.source='native-passive-observation';chunk.storageTrace={pointsSaved:chunk.pointsSceneRelative?.length||0,pointsExported:0};
    await this.store.putCloud(chunk.chunkId,chunk);const storedAt=iso();if(!record.lidarChunkIds.includes(chunk.chunkId))record.lidarChunkIds.push(chunk.chunkId);if(!n.cloudIds.includes(chunk.chunkId))n.cloudIds.push(chunk.chunkId);
    this.accountStored(n,chunk);this.accountQuality(n,chunk);
    const capture=record.geometryCaptures[chunk.captureId]||(record.geometryCaptures[chunk.captureId]={captureId:chunk.captureId,visitId:record.visitId,status:'reading',sides:{}});
    const side=capture.sides[chunk.side]||(capture.sides[chunk.side]={side:chunk.side,chunkIds:[],pointsSaved:0,rail:K.clone(chunk.rail),viewObservation:K.clone(chunk.viewObservation),capturedAt:chunk.capturedAt});
    n.metrics.pointsSavedByRail=n.metrics.pointsSavedByRail||{left:0,right:0};
    if(!side.chunkIds.includes(chunk.chunkId)){side.chunkIds.push(chunk.chunkId);side.pointsSaved+=chunk.pointsSceneRelative?.length||0;n.metrics.pointsSavedByRail[chunk.side]+=chunk.pointsSceneRelative?.length||0;}
    const qualification=chunk.qualification;if(qualification?.format==='banane-native-rail-snapshot-v1'){
     record.railSnapshots??={left:[],right:[]};
     const snapshot={format:qualification.format,snapshotId:chunk.chunkId,captureId:chunk.captureId,side:chunk.side,identity:K.clone(chunk.identity),
      chunkIds:K.clone(qualification.chunkIds||[chunk.chunkId]),rail:K.clone(chunk.rail),viewObservation:K.clone(chunk.viewObservation),
      coordinateSystem:K.clone(chunk.coordinateSystem),acquisitionStartedAt:qualification.acquisitionStartedAt,
      acquiredThroughAt:qualification.acquiredThroughAt,emittedAt:chunk.acquisition?.emittedAt||null,storedAt,
      sourceStatus:qualification.sourceStatus,clipStatus:qualification.clipStatus,transform:K.clone(qualification.transform),
      associationStatus:qualification.associationStatus,criteriaVersion:qualification.criteriaVersion,coverage:K.clone(qualification.coverage),
      qualificationStatus:qualification.status,exclusionReasons:K.clone(qualification.exclusionReasons||[]),receiptEventSeq:null,
      captureStatusAtQualification:'reading',independentOfCaptureTermination:true};
     record.railSnapshots[chunk.side].push(snapshot);}
    await this.saveRecord(record);await this.e.save();const stored=await this.nativeEvent(type,{...this.redactedEvent(type,data),storageConfirmedAt:storedAt,
     receiptStatus:'cloud-and-record-stored'});
    if(qualification?.format==='banane-native-rail-snapshot-v1'){record.railSnapshots[chunk.side].at(-1).receiptEventSeq=stored.eventSeq;
     if(record.endedAt!==null||record.endTimeStatus==='unknown')this.classify(record);await this.saveRecord(record);}
    return {saved:true,eventSeq:stored.eventSeq,chunkId:chunk.chunkId,storageConfirmedAt:storedAt};
   }
   if(type==='capture-ready'){
    const cloud=K.clone(data.cloud);K.assertTarget(record.identity,cloud.identity);cloud.nativeSessionId=n.id;cloud.visitId=record.visitId;
    cloud.source='native-passive-observation';cloud.railStateProvenance='native-observed-current-loaded-view';
    const capture=record.geometryCaptures[cloud.captureId]||(record.geometryCaptures[cloud.captureId]={captureId:cloud.captureId,visitId:record.visitId,status:'reading',sides:{}});
    if(cloud.format==='banane-native-lidar-capture-v2'){
      const saved=SIDES.reduce((sum,side)=>sum+(capture.sides[side]?.pointsSaved||0),0);cloud.trace=cloud.trace||{};cloud.trace.pointsSaved=saved;cloud.trace.perRail=cloud.trace.perRail||{};
      for(const side of SIDES)if(cloud.trace.perRail[side])cloud.trace.perRail[side].pointsSaved=capture.sides[side]?.pointsSaved||0;
      cloud.trace.pointsExported=0;capture.status=cloud.status;capture.startedAt=cloud.startedAt;capture.completedAt=cloud.completedAt;capture.termination=K.clone(cloud.termination);
      capture.trace=K.clone(cloud.trace);capture.viewObservation=K.clone(cloud.viewObservation);
      for(const side of SIDES){const observation=cloud.railObservations?.[side];if(!observation)continue;const savedSide=capture.sides[side]?.pointsSaved||0;
       const entry={captureId:cloud.captureId,side,chunkIds:(capture.sides[side]?.chunkIds||[]).slice(),pointsSaved:savedSide,pointsRetained:observation.pointsRetained||0,
        startedAt:cloud.startedAt,capturedAt:observation.capturedAt,completedAt:observation.completedAt,rail:K.clone(observation.rail),viewObservation:K.clone(cloud.viewObservation??null),
        transform:K.clone(observation.transform??null),coverage:K.clone(observation.coverage??null),associationStatus:observation.associationStatus,coordinateSystem:K.clone(cloud.coordinateSystem??null),eventSeq:logged.eventSeq,
        geometryInputStatus:observation.geometryInputStatus,exclusionReasons:K.clone(observation.exclusionReasons||[]),captureStatus:cloud.status,termination:K.clone(cloud.termination),trace:K.clone(cloud.trace)};
       record.geometryObservations[side].push(entry);
       for(const snapshot of record.railSnapshots?.[side]||[])if(snapshot.captureId===cloud.captureId&&
         (!poseEqual(snapshot.rail,observation.rail)||cloud.coordinateSystem&&JSON.stringify(snapshot.coordinateSystem)!==JSON.stringify(cloud.coordinateSystem))){
         snapshot.revocations??=[];snapshot.revocations.push({reason:'capture-report-contradicts-snapshot-frame',observedAt:logged.timestamp,
          evidence:'same-capture-rail-pose-or-coordinate-system-mismatch'});}}}
    else{capture.status=cloud.status;capture.legacy=true;record.lidarQuality={points:cloud.pointsSceneRelative?.length||0,perRail:K.clone(cloud.quality?.perRail||{}),
       completeLoadedRoi:cloud.scope?.completeLoadedRoi===true};}
    this.accountQuality(n,cloud);
    await this.store.putCloud(cloud.captureId,cloud);if(!record.lidarCaptureIds.includes(cloud.captureId))record.lidarCaptureIds.push(cloud.captureId);if(!n.cloudIds.includes(cloud.captureId))n.cloudIds.push(cloud.captureId);
    this.accountStored(n,cloud);
    record.lidarStatus=cloud.status;if(record.endedAt!==null||record.endTimeStatus==='unknown')this.classify(record);await this.saveRecord(record);await this.e.save();
    return {saved:true,eventSeq:logged.eventSeq,captureId:cloud.captureId};
   }
   if(type==='capture-failed'){this.partialReason(record,data.reason||'capture-failed');record.lidarStatus='not-captured';
    if(data.degradationLevel==='METADATA_ONLY')this.partialReason(record,'collector-degraded-to-metadata-only');if(record.endedAt)this.classify(record);await this.saveRecord(record);return {saved:true,eventSeq:logged.eventSeq};}
   if(type==='visit-ended'){
    if(data.finalObserved){K.assertTarget(record.identity,data.finalObserved.identity);record.lastObserved=K.clone(data.finalObserved);record.finalObserved=K.clone(data.finalObserved);this.establishBefore(record,data.finalObserved);}
    record.endedAt=data.endedAt||iso();record.endTimeStatus='observed';record.leaveReason=data.reason;record.nextObservedIdentity=data.nextIdentity?K.completeIdentity(data.nextIdentity):null;
    record.navigationObserved=data.reason==='target-changed'&&!!record.nextObservedIdentity;
    if(record.navigationObserved)record.observedEffects.push({kind:'target-changed',nextIdentity:record.nextObservedIdentity,observedAt:record.endedAt,eventSeq:logged.eventSeq});
    this.classify(record);await this.saveRecord(record);if(record.status!=='complete')n.incomplete=unique([...n.incomplete,record.recordId]);
    /* 4.7.20 (piste H) : fin et issue de la visite (validé, corrigé, SKIP), en bref, pour l'activité du panneau. */
    const resume=n.visits.find(v=>v.visitId===record.visitId);if(resume){resume.endedAt=record.endedAt;resume.label=record.observedLabelCandidate||null;}
    if(n.current?.visitId===record.visitId)n.current=null;await this.e.save();this.scheduleContinuity(record.visitId);return {saved:true,eventSeq:logged.eventSeq};
   }
   if(type==='period-ended'){const period=n.observationPeriods.find(item=>item.observationPeriodId===data.observationPeriodId);
    if(period){period.endedAt=data.endedAt||iso();period.endTimeStatus='observed';period.status=data.reason==='finished'?'FINISHED':'PAUSED';period.reason=data.reason;period.metrics=data.metrics;}
    await this.e.save();return {saved:true,eventSeq:logged.eventSeq};}
   throw Error('Événement Natif inconnu : '+type);
  }
  chooseGeometry(record,side){const before=record.beforeEstablished?.rails?.[side],observations=record.geometryObservations?.[side]||[],failures=[];
   if(!before)return {status:'excluded',captureId:null,chunkIds:[],points:0,reasons:['initial-rail-state-missing']};
   if(record.version!=='4.4.1'){
    const snapshots=record.railSnapshots?.[side]||[],intent=record.operatorIntents?.[0],intentAt=eventTime(intent);
    for(const snapshot of snapshots){const reasons=[...(snapshot.exclusionReasons||[])];
     if(snapshot.revocations?.length)reasons.push(...snapshot.revocations.map(item=>item.reason));
     if(snapshot.qualificationStatus!=='qualified-candidate'||snapshot.coverage?.status!=='qualified-candidate')reasons.push('checkpoint-not-qualified');
     if(snapshot.criteriaVersion!=='native-visible-roi-v1')reasons.push('snapshot-criteria-unknown');
     if(snapshot.sourceStatus!=='reference-version-and-matrix-stable-through-checkpoint')reasons.push('source-stability-not-demonstrated');
     if(snapshot.clipStatus!=='verified-classifiable')reasons.push('clipping-not-verified');
     if(!snapshot.transform?.valid)reasons.push('transform-invalid');
     if(snapshot.associationStatus!=='same-target-and-rail-pose'||!poseEqual(snapshot.rail,before))reasons.push('capture-used-a-different-rail-pose-than-initial-state');
     if(!snapshot.receiptEventSeq||!snapshot.storedAt||!snapshot.chunkIds?.length)reasons.push('storage-receipt-or-chunks-missing');
     if(!snapshot.coordinateSystem?.frameId||snapshot.coordinateSystem.frameId!==record.identity?.frameId||
       snapshot.coordinateSystem.units!=='metres-observed-not-independently-calibrated')reasons.push('coordinate-frame-or-units-unverified');
     try{K.assertTarget(record.identity,snapshot.identity);}catch{reasons.push('snapshot-identity-mismatch');}
     const finished=Date.parse(snapshot.acquiredThroughAt||''),started=Date.parse(snapshot.acquisitionStartedAt||'');
     if(!Number.isFinite(finished)||!Number.isFinite(started)||started>finished)reasons.push('acquisition-time-invalid');
     if(intent&&(!Number.isFinite(intentAt)||finished>intentAt))reasons.push('geometry-acquired-after-operator-intent');
     if(reasons.length){failures.push(...reasons);continue;}
     return {status:'qualified-candidate',snapshotId:snapshot.snapshotId,captureId:snapshot.captureId,chunkIds:snapshot.chunkIds.slice(),
      points:snapshot.coverage.pointsInRoi,acquiredThroughAt:snapshot.acquiredThroughAt,storedAt:snapshot.storedAt,
      receiptEventSeq:snapshot.receiptEventSeq,capturedAt:snapshot.acquisitionStartedAt,viewEpochId:snapshot.viewObservation?.viewEpochId||null,
      coordinateSystem:K.clone(snapshot.coordinateSystem),criteriaVersion:snapshot.criteriaVersion,reasons:[]};}
    return {status:'excluded',snapshotId:null,captureId:null,chunkIds:[],points:0,reasons:unique(failures.length?failures:['qualified-stored-snapshot-missing'])};
   }
   for(const observation of observations){const reasons=[];
    if(observation.geometryInputStatus!=='qualified-candidate'||observation.coverage?.status!=='qualified-candidate')reasons.push(...(observation.exclusionReasons||['coverage-not-qualified']));
    if(!observation.transform?.valid)reasons.push('transform-invalid');if(observation.associationStatus!=='same-target-and-rail-pose')reasons.push('capture-reference-association-unverified');
    if(!poseEqual(observation.rail,before))reasons.push('capture-used-a-different-rail-pose-than-initial-state');if(!observation.chunkIds?.length||!observation.pointsSaved)reasons.push('saved-points-missing');
    if(record.operatorIntents?.[0]?.eventSeq&&observation.eventSeq>=record.operatorIntents[0].eventSeq)reasons.push('geometry-completed-after-operator-intent');
    if(reasons.length){failures.push(...reasons);continue;}
    return {status:'qualified-candidate',captureId:observation.captureId,chunkIds:observation.chunkIds.slice(),points:observation.pointsSaved,
     capturedAt:observation.capturedAt,viewEpochId:observation.viewObservation?.viewEpochId||null,coordinateSystem:K.clone(observation.coordinateSystem??null),reasons:[]};}
   return {status:'excluded',captureId:null,chunkIds:[],points:0,reasons:unique(failures.length?failures:['qualified-capture-missing'])};}
  classify(record){const initial=record.beforeEstablished||record.firstObserved||record.initialObserved,last=record.lastObserved||record.finalObserved;
   record.partialReasons=record.partialReasons||[];record.geometryEligibility=record.geometryEligibility||{left:{},right:{},pair:{}};
   record.usableForOfflineEvaluationByRail=record.usableForOfflineEvaluationByRail||{left:false,right:false};
   if(!initial)this.partialReason(record,'initial-state-not-established');if(!last)this.partialReason(record,'last-state-missing');
   if(initial&&last)try{K.assertTarget(initial.identity,last.identity);}catch{this.partialReason(record,'initial-last-identity-mismatch');}
   if(!completeRails(initial)||!completeRails(last))this.partialReason(record,'one-or-both-rails-missing');
   const intents=record.operatorIntents||[],kinds=unique(intents.map(item=>item.intent));record.multiIntent=intents.length>1;
   /* 4.9.0.18 (AM-02) : plusieurs validations SANS autre intention = une seule décision, la dernière ; des intentions de
    * natures différentes (VALIDATE puis SKIP) restent ambiguës. */
   const repeatedValidate=intents.length>1&&kinds.length===1&&kinds[0]==='VALIDATE';
   const sole=intents.length===1?intents[0]:repeatedValidate?intents.at(-1):null;
   record.intentCollapse=repeatedValidate?{kind:'repeated-validate',count:intents.length,referenceFrom:'last-validate-intent'}:null;
   record.operatorIntent=intents.length===0?null:kinds.length>1?'AMBIGUOUS_MULTIPLE':kinds[0];
   /* 4.9.0.18 (AM-03) : l'étiquette compare la pose finale à la pose de départ = dernier état avant le premier geste ;
    * à défaut (aucun geste), au premier état établi. */
   const start=record.startPose?.rails?record.startPose:initial;record.labelBasis={startPose:record.startPose?.source||'before-established',thresholdMm:(S.echo?.movementThresholdM??0.001)*1000};
   if(!intents.length){record.observedLabelCandidate='PASS_NO_DECISION';this.partialReason(record,'operator-decision-not-observed');}
   else if(kinds.length>1){record.observedLabelCandidate='AMBIGUOUS_MULTIPLE_INTENTS';this.partialReason(record,'multiple-operator-intents-observed');}
   else if(sole.intent==='SKIP'){record.observedLabelCandidate='SKIP';record.humanFinalReference=null;}
   else if(sole.intent==='VALIDATE'){
    const reference=record.humanFinalReference?.state;if(!reference){this.partialReason(record,'human-final-reference-missing');record.observedLabelCandidate=null;}
    else{try{K.assertTarget(record.identity,reference.identity);}catch{this.partialReason(record,'human-final-reference-identity-mismatch');}
     const rails={};record.humanDelta={};for(const side of SIDES)if(start?.rails?.[side]&&reference.rails?.[side]){const d=railDelta(start.rails[side],reference.rails[side]);
      rails[side]={positionChanged:d.changed};record.humanDelta[side]=d;}
     record.observedLabelCandidate=K.manualDecision(rails,'VALIDATE');
     /* Pour comparaison hors ligne : l'étiquette qu'aurait donnée l'ancienne règle (premier état vu, comparaison exacte). */
     const legacy={};for(const side of SIDES)if(initial?.rails?.[side]&&reference.rails?.[side])legacy[side]={positionChanged:!poseEqual(initial.rails[side],reference.rails[side])};
     record.labelBasis.legacyLabel=K.manualDecision(legacy,'VALIDATE');}}
   else{record.observedLabelCandidate='UNKNOWN_INTENT';this.partialReason(record,'unknown-operator-intent');}
   /* 4.9.0.18 (AM-14, AM-18) : une écriture de validation d'ESV observée vaut effet de la décision ; le motif est
    * recalculé à chaque classification (une écriture arrive après la clôture de la visite). */
   record.partialReasons=record.partialReasons.filter(reason=>reason!=='decision-effect-not-observed');
   if(intents.length&&!record.navigationObserved&&!record.serverConfirmed)this.partialReason(record,'decision-effect-not-observed');
   for(const side of SIDES)record.geometryEligibility[side]=this.chooseGeometry(record,side);
   const reference=record.humanFinalReference,referenceReasons=[];
   if(!sole||sole.intent!=='VALIDATE')referenceReasons.push(record.multiIntent?'multiple-operator-intents-observed':sole?.intent==='SKIP'?'operator-skip-observed':'validated-reference-not-observed');
   if(!reference?.state)referenceReasons.push('human-final-reference-missing');if(reference?.association?.identityMatched===false)referenceReasons.push('human-final-reference-identity-mismatch');
   if(reference?.source!=='validation-write'&&(reference?.association?.freshnessMs===null||reference?.association?.freshnessMs<-(S.echo?.freshnessSkewMs??50)||reference?.association?.freshnessMs>1500))referenceReasons.push('human-final-reference-not-freshly-observed');
   if(!record.navigationObserved&&!record.serverConfirmed)referenceReasons.push('decision-effect-not-observed');
   for(const side of SIDES){const eligibility=record.geometryEligibility[side],reasons=[...eligibility.reasons,...referenceReasons];
    if(!reference?.state?.rails?.[side])reasons.push('human-final-rail-state-missing');eligibility.referenceStatus=reference?.status||'not-observed';eligibility.reasons=unique(reasons);
    eligibility.status=eligibility.status==='qualified-candidate'&&!eligibility.reasons.length?'comparable-candidate':'excluded';record.usableForOfflineEvaluationByRail[side]=eligibility.status==='comparable-candidate';}
   const left=record.geometryEligibility.left,right=record.geometryEligibility.right,pairReasons=[];
   if(left.status!=='comparable-candidate')pairReasons.push(...left.reasons.map(reason=>'left:'+reason));if(right.status!=='comparable-candidate')pairReasons.push(...right.reasons.map(reason=>'right:'+reason));
   if(left.captureId&&right.captureId&&(left.coordinateSystem?.name!==right.coordinateSystem?.name||left.coordinateSystem?.units!==right.coordinateSystem?.units))pairReasons.push('left-right-coordinate-systems-differ');
   record.geometryEligibility.pair={status:!pairReasons.length?'comparable-candidate':'excluded',leftCaptureId:left.captureId,rightCaptureId:right.captureId,
    simultaneousRequired:false,sameViewEpoch:left.viewEpochId===right.viewEpochId,compatibilityChecked:true,reasons:unique(pairReasons)};
   record.usableAsNativeReference=record.geometryEligibility.pair.status==='comparable-candidate';record.usableForTraining=false;
   record.trainingExclusionReason=sole?.intent==='SKIP'?'operator-skip-observed':kinds.length>1?'multiple-operator-intents-observed':'native-reference-requires-explicit-review';
   if(!record.lidarCaptureIds?.length&&!record.lidarChunkIds?.length)this.partialReason(record,'lidar-missing');
   const metadataComplete=!!initial&&!!last&&!!record.endedAt&&record.endTimeStatus!=='unknown';record.status=metadataComplete&&!record.partialReasons.length?'complete':'partial';
  }
  /* 4.9.0.18 (AM-16) : résumé des gestes par touche, jamais tronqué. */
  summariseGesture(record,observed){const g=record.gestureSummary??={count:0,firstAt:null,lastAt:null,byKey:{},editable:0};
   g.count++;const at=observed.observedAt||null;if(!g.firstAt)g.firstAt=at;g.lastAt=at;if(observed.editable){g.editable++;return;}
   const name=observed.type==='keydown'?(observed.decisionKey||observed.key||observed.code||'key'):observed.type;
   const k=g.byKey[name]??={n:0,firstAt:at,lastAt:at};k.n++;k.lastAt=at;}
  /* 4.9.0.18 (AM-14) : écriture de validation d'ESV vue par l'observateur de page pendant Écho, jointe à la visite
   * en cours, sinon à la dernière visite close depuis moins de `ecritureJointeMs` (l'écriture part après la
   * navigation). La visite devient `serverConfirmed`, et sa classification est refaite si elle était close. Passe par la
   * file des événements : une écriture de l'observation « continuité » ne doit jamais écraser la sienne, ni l'inverse. */
  noteServerWrite(write){const next=this.queue.then(()=>this.noteServerWriteNow(write));this.queue=next.catch(()=>{});return next;}
  async noteServerWriteNow(write){const n=this.e.s.native;if(!n||!this.active()||!write)return null;
   const at=Date.parse(write.timestamp||'')||Date.now(),grace=S.echo?.ecritureJointeMs??5000,body=write.body&&typeof write.body==='object'?write.body:null;
   /* 4.9.0.19 (terrain, partie 24) : ESV écrit deux sortes de choses. « Vu par l'opérateur » (SeenByOperator seul) à
    * l'arrivée sur un cut ; la VALIDATION (ExtractionStatus valid + TreatedByOperator, avec les bords en repère monde)
    * 0,5 à 0,7 s après le geste, souvent APRÈS le changement de cut. Seule la validation confirme. */
   const kind=body?.ExtractionStatus==='valid'&&body?.TreatedByOperator===true?'validation':body?.SeenByOperator===true?'seen':'other';
   /* Rattachement : par numéro de ligne (`rowIndex` = numéro du cut sur la partie 24 : 36 lignes sur 36) à la dernière visite
    * de ce cut dont la fenêtre contient l'écriture ; sinon par l'heure (visite en cours, ou dernière visite close). */
   const dans=r=>{const s=Date.parse(r.startedAt||''),e=r.endedAt?Date.parse(r.endedAt):Infinity;return Number.isFinite(s)&&at>=s-1000&&at<=e+grace;};
   let record=null,method=null;
   if(Number.isInteger(write.rowIndex)){
    for(const visit of n.visits.slice().reverse()){if(visit.identity?.cut!==write.rowIndex)continue;
     const r=n.current?.visitId===visit.visitId?n.current:await this.recordById(visit.visitId);
     if(r&&r.nativeSessionId===n.id&&dans(r)){record=r;method='row-index';break;}}}
   if(!record){record=n.current;method=record?'time-current-visit':null;
    if(!record){const last=n.visits.at(-1);if(last){const r=await this.recordById(last.visitId);
      if(r&&r.nativeSessionId===n.id&&(!r.endedAt||at-Date.parse(r.endedAt)<=grace)){record=r;method='time-last-closed-visit';}}}}
   if(!record)return null;
   const entry={eventId:write.eventId||null,at:write.timestamp||iso(),kind,status:write.status??null,method:write.method||null,outcome:write.outcome||null,
    attempt:write.attempt??null,rowIndex:Number.isInteger(write.rowIndex)?write.rowIndex:null,body:body?K.clone(body):null,
    joinedTo:n.current?.visitId===record.visitId?'current-visit':'closed-visit',joinMethod:method,durationMs:write.durationMs??null};
   (record.serverWrites??=[]).push(entry);if(record.serverWrites.length>16)record.serverWrites.shift();
   if(kind==='validation'&&Number.isInteger(entry.status)&&entry.status>=200&&entry.status<300){record.serverConfirmed=true;
    record.serverConfirmationStatus='observed-validation-write-'+entry.status;record.serverConfirmedAt=entry.at;
    /* D-143 : l'écriture de validation fait foi sur la référence humaine (rattachement par numéro de ligne seulement). */
    if(method==='row-index')this.referenceFromWrite(record,entry,at);}
   if(record.endedAt!==null)this.classify(record);await this.saveRecord(record);return entry;}
  /* D-143 : la référence lue à la touche est périmée si ESV a appliqué le déplacement après la touche (clic sur un rail
   * quelques ms avant). Si les rails de l'écriture de validation diffèrent de plus de 1 mm de `humanFinalReference`, celle-ci
   * est remplacée (dernier état observé s'il concorde avec l'écriture, sinon positions de l'écriture) ; l'ancienne reste dans
   * `humanFinalReferences`, marquée remplacée. La classification est refaite par l'appelant. Aucune requête ESV. */
  referenceFromWrite(record,entry,writeAt){const current=record.humanFinalReference;
   if(!current?.state||!(writeAt>=eventTime(current)))return false;
   const fix=referenceParEcriture(current.state,record.lastObserved,entry.body);if(!fix)return false;
   const stateAt=Date.parse(fix.state.capturedAt||''),freshness=fix.poseFrom==='last-observed-state'&&Number.isFinite(stateAt)?eventTime(current)-stateAt:0;
   /* `candidate-observed` : les outils en aval ne retiennent que ce statut ; la pose vient d'une écriture observée, pas d'un doute d'horloge. */
   const next={status:'candidate-observed',state:fix.state,observedAt:current.observedAt,eventSeq:current.eventSeq,decisionKey:current.decisionKey??null,source:'validation-write',
    association:{identityMatched:current.association?.identityMatched!==false,freshnessMs:freshness,source:'validation-write',eventTimeStamp:current.association?.eventTimeStamp??null,
     stateCapturedAt:fix.state.capturedAt||null,reviewed:false},
    replacedByWrite:{eventId:entry.eventId,at:entry.at,status:entry.status,rowIndex:entry.rowIndex,poseFrom:fix.poseFrom,sides:fix.sides,diffMm:fix.diffMm,maxDiffMm:fix.maxDiffMm,thresholdMm:(S.echo?.ecritureReferenceSeuilM??0.001)*1000},
    replaces:{status:current.status,stateCapturedAt:current.state?.capturedAt||null,eventSeq:current.eventSeq,source:current.source||current.association?.source||null}};
   const list=record.humanFinalReferences??=[],index=list.findIndex(item=>item.eventSeq===current.eventSeq&&item.observedAt===current.observedAt&&!item.supersededBy);
   if(index>=0)list[index].supersededBy='validation-write';else list.push({...K.clone(current),supersededBy:'validation-write'});
   list.push(next);record.humanFinalReference=next;record.humanFinalReferenceSource='validation-write';return true;}
  /* 4.9.0.18 (AM-05) : la page ESV observée a été rechargée, a quitté ESV ou l'onglet a été fermé. L'observateur de la
   * page a disparu avec elle : la visite en cours est close telle qu'elle est (rien d'inventé), la période interrompue,
   * la session mise en pause « adaptateur sans réponse ». La reprise (automatique ou « Reprendre ») ouvre une période neuve. */
  async pageLost(reason='page-reloaded'){const n=this.e.s.native;if(!n||!this.running())return null;
   await this.queue.catch(()=>{});
   const period=n.observationPeriods?.find(item=>item.observationPeriodId===n.currentPeriodId);
   if(period&&!period.endedAt){period.status='INTERRUPTED';period.endedAt=iso();period.endTimeStatus='observed';period.reason=reason;}
   if(n.current){const record=n.current;record.leaveReason=reason;record.endedAt=iso();record.endTimeStatus='observed-page-lost';this.partialReason(record,reason);
    this.classify(record);await this.saveRecord(record);n.incomplete=unique([...(n.incomplete||[]),record.recordId]);n.current=null;}
   n.status='PAUSED_ADAPTER_UNRESPONSIVE';n.currentPeriodId=null;n.pageLost={reason,at:iso()};n.interruptions=(n.interruptions||0)+1;
   n.message=reason==='tab-closed'?'Écho : l’onglet ESV a été fermé. La capture est arrêtée ; rouvre ESV, puis Connecter et Reprendre.'
     :'Écho : la page ESV a été rechargée (F5). La capture est arrêtée jusqu’à la reprise'+(S.echo?.repriseAutomatique?' automatique…':' : clique sur Connecter puis Reprendre.');
   await this.nativeEvent('page-lost',{sessionId:n.id,observationPeriodId:period?.observationPeriodId||null,identity:null,reason});await this.e.save();return n.pageLost;}
  /* 4.9.0.18 (AM-07) : le service worker a redémarré (veille, onglet en arrière-plan) mais la page observe toujours et
   * renvoie des événements de la période déclarée interrompue : la période et la session reprennent, la visite close par
   * `init()` est rouverte si elle est encore en cours dans la page. */
  async heal(data){const n=this.e.s.native;const period=n.observationPeriods?.find(item=>item.observationPeriodId===data.observationPeriodId);
   if(!period||period.status!=='INTERRUPTED_RECOVERED')return false;
   period.status='RUNNING';period.endTimeStatus='open';period.healedAt=iso();period.reason='worker-restart-healed-page-still-observing';
   n.status='RUNNING';n.currentPeriodId=period.observationPeriodId;n.message='Observation native active (reprise après redémarrage du service worker : la page observait toujours).';
   n.healed=(n.healed||0)+1;
   if(data.visitId&&!n.current){const record=await this.recordById(data.visitId);
    if(record&&record.nativeSessionId===n.id&&record.recoveredClosure&&record.endedAt===null){record.recoveredClosure.healed=true;record.recoveredClosure.healedAt=iso();
     record.leaveReason=null;record.endTimeStatus='open';record.partialReasons=(record.partialReasons||[]).filter(r=>r!=='worker-restarted-before-visit-closure');
     n.incomplete=(n.incomplete||[]).filter(id=>id!==record.recordId);n.current=record;await this.saveRecord(record);}}
   await this.nativeEvent('worker-restart-healed',{sessionId:n.id,observationPeriodId:period.observationPeriodId,identity:null});await this.e.save();return true;}
  async pause(){const n=this.e.s.native;if(!n||n.status!=='RUNNING')throw Error('Aucune observation Natif active à mettre en pause.');
   try{const result=await this.adapter.nativePause();await this.queue;this.mergeMetrics(result?.metrics);n.status='PAUSED';n.currentPeriodId=null;
    n.message='Observation en pause. Reprendre ouvrira une nouvelle période, sans continuité supposée.';await this.e.save();return this.e.view();}
   catch(error){n.status='PAUSED_ADAPTER_UNRESPONSIVE';n.message=error.message;await this.e.save();throw error;}}
  async resume(){const n=this.e.s.native;if(!n||!['PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(n.status))throw Error('Aucune observation Natif en pause.');
   const period=this.newPeriod(n);try{await this.adapter.nativeResume({sessionId:n.id,observationPeriodId:period.observationPeriodId});n.status='RUNNING';period.status='RUNNING';
    n.message='Nouvelle période d’observation native active.';await this.e.save();return this.e.view();}catch(error){n.status='PAUSED_ADAPTER_UNRESPONSIVE';
    this.failPeriod(period,error);n.message=error.message;await this.e.save();throw error;}}
  /* `end({dataset:false})` rend un résumé léger au lieu de la session entière.
   * 4.7.2 terrain : la fin de session renvoyait tout le jeu (88 Mo de visites et
   * d'événements pour 105 visites) dans un seul message vers le panneau —
   * « Message exceeded maximum allowed size of 64MiB ». L'export passe de toute
   * façon par le manifeste léger et la lecture directe du stockage. */
  end(options={}){if(this.ending)return this.ending;this.ending=this.close(options).finally(()=>{this.ending=null;});return this.ending;}
  endSummary(){const n=this.e.s.native;if(!n)return null;
   return {format:'banane-native-session-end-v1',version:K.VERSION,sessionId:n.id,status:n.status,finishedAt:n.finishedAt||null,
    visits:(n.visits||[]).length,incomplete:(n.incomplete||[]).length,cloudsStored:(n.cloudIds||[]).length,adapterError:n.adapterError||null};}
  /* V4.5.4 — abandon explicite d'une session.
   *
   * Une session d'essai, une mauvaise cible, un départ raté : il n'existait
   * aucun moyen de jeter ce qui venait d'être collecté. Il fallait terminer la
   * session, télécharger, puis supprimer le fichier — et les nuages restaient
   * dans IndexedDB.
   *
   * L'abandon est IRRÉVERSIBLE et ne produit aucun export : c'est le contraire
   * de `end()`. Il arrête d'abord l'observation dans la page (sinon le
   * collecteur continue d'écrire dans ce qu'on efface), puis supprime nuages,
   * visites et événements de cette session. Le compte de ce qui a été supprimé
   * est retourné : un effacement muet ne serait pas vérifiable. */
  async discard(){
   const n=this.e.s.native;if(!n)throw Error('Aucune session Natif conservée.');
   const sessionId=n.id;
   try{await this.adapter.nativeFinish({sessionId,reason:'session-discarded'});}catch{/* la page peut déjà être partie */}
   let nuages=0,visites=0,evenements=0;
   for(const id of n.cloudIds||[]){try{await this.store.deleteCloud(id);nuages++;}catch{/* déjà absent */}}
   try{
    for(const r of await this.store.all('records'))
     if(r.nativeSessionId===sessionId){await this.store.deleteRecord(r.recordId||r.id);visites++;}
   }catch{/* le comptage ne doit pas empêcher la suite */}
   try{
    for(const ev of await this.store.all('events'))
     if(ev.sessionId===sessionId||ev.nativeSessionId===sessionId){await this.store.deleteEvent(ev.eventId);evenements++;}
   }catch{/* idem */}
   this.e.s.native=null;this.e.s.mode='idle';
   await this.e.save();
   return {discarded:true,sessionId,clouds:nuages,records:visites,events:evenements};
  }
  async close({dataset=true}={}){const n=this.e.s.native;if(!n)throw Error('Aucune session Natif à terminer.');let adapterError=null;
   try{const result=await this.adapter.nativeFinish();this.mergeMetrics(result?.metrics);}catch(error){adapterError=error;n.message='Fin interrompue : '+error.message;}
   await this.queue;await this.continuityIdle();await this.queue;if(n.current){this.partialReason(n.current,'session-ended-before-visit-close');this.classify(n.current);await this.saveRecord(n.current);
    n.incomplete=unique([...n.incomplete,n.current.recordId]);n.current=null;}
   n.status=adapterError?'PAUSED_ADAPTER_UNRESPONSIVE':'FINISHED';n.finishedAt=iso();n.adapterError=adapterError?.message||null;n.currentPeriodId=null;
   // Une visite = un enregistrement : le compte vient de la session, sans relire toute la base.
   await this.nativeEvent('session-finished',{sessionId:n.id,identity:null,status:n.status,records:(n.visits||[]).length,incomplete:n.incomplete.length,adapterError:n.adapterError});
   await this.e.save();return dataset?this.dataset():this.endSummary();}
  /* V4.5-R — comptabilité de volume et conseil d'export segmenté.
   * Au-delà d'environ 64 Mo, la préparation du fichier unique échouait dans la
   * fenêtre et la session entière devenait intéléchargeable : toute la collecte
   * était perdue. On mesure donc le volume au fil de l'eau et on signale au
   * panneau qu'il faut vider un segment AVANT d'atteindre ce mur. */
  /* Estimation suffisante et peu coûteuse : on ne sérialise pas deux fois les
   * points. Le même calcul sert à créditer au stockage et à débiter à la purge,
   * donc les deux ne peuvent pas diverger. */
  cloudBytes(cloud){
   const points=cloud?.pointsSceneRelative?.length||0;
   return points?points*Sessions.BYTES_PER_POINT_ESTIMATE+Sessions.BYTES_PER_CLOUD_OVERHEAD
     :JSON.stringify(cloud||{}).length;
  }
  accountStored(n,cloud){
   try{
    n.exportState??={bytesStored:0,bytesPending:0,exportedCloudIds:[],releasedCloudIds:[],segments:0,lastAdviceAt:null};
    const x=n.exportState;
    const bytes=this.cloudBytes(cloud);
    x.bytesStored+=bytes;x.bytesPending+=bytes;
    n.metrics??={};n.metrics.bytesStored=x.bytesStored;n.metrics.bytesPending=x.bytesPending;
   }catch{/* la comptabilité ne doit jamais interrompre la collecte */}
  }
  /* Conseil lu par le panneau à chaque rafraîchissement. Le panneau exécute le
   * téléchargement : un service worker MV3 ne peut pas créer d'URL d'objet, et
   * l'extension ne demande pas la permission "downloads". */
  exportAdvice(){
   const n=this.e.s.native;if(!n)return null;
   const x=n.exportState;if(!x)return null;
   const pending=n.cloudIds.filter(id=>!x.exportedCloudIds.includes(id));
   const due=x.bytesPending>=Sessions.EXPORT_WATERMARK_BYTES&&pending.length>0;
   return {due,reason:due?'watermark-reached':null,bytesStored:x.bytesStored,bytesPending:x.bytesPending,
    watermark:Sessions.EXPORT_WATERMARK_BYTES,pendingClouds:pending.length,segments:x.segments,
    note:'Segment vidé automatiquement pour ne jamais atteindre la limite de téléchargement.'};
  }
  /* V4.5 — qualité de capture agrégée au fil de l'eau.
   *
   * Mesure du 15/09 sur deux sessions réelles : le flanc interne du champignon
   * est le verrou du moteur — médiane 0 à 1 point observé pour un seuil de 6 —
   * et le filtre de visibilité en retire les deux tiers. C'est la cause
   * principale du faible rendement, et elle ne se voyait qu'après une enquête
   * hors ligne. On l'agrège ici pour qu'elle soit lisible pendant la collecte. */
  accountQuality(n,cloud){
   try{
    n.quality??={snapshotsQualified:0,snapshotsTotal:0,interruptedOnly:0,exclusionReasons:{},
      railsObserved:0,railsQualified:0,railsTruncated:false,
      clip:{inRoiKept:0,inRoiDropped:0,nearTopKept:0,nearTopDropped:0,nearFaceKept:0,nearFaceDropped:0}};
    n.qualityRails??={};
    const q=n.quality,vus=n.qualityRails;
    /* Niveau repère : un repère compte comme qualifié dès qu'un instantané
     * qualifié a existé pour lui. C'est ce qui conditionne réellement une
     * proposition du moteur, et c'est la seule lecture actionnable pendant la
     * collecte — bien plus que le taux par instant de capture ci-dessous. */
    if(cloud?.format==='banane-native-lidar-chunk-v1'){
     const cle=Sessions.railKey(cloud.identity,cloud.side);
     if(cle){
      if(vus[cle]===undefined){
       if(q.railsObserved>=Sessions.QUALITY_RAIL_LIMIT)q.railsTruncated=true;
       else{vus[cle]=0;q.railsObserved++;}
      }
      if(vus[cle]===0&&cloud.qualification?.status==='qualified-candidate'){vus[cle]=1;q.railsQualified++;}
     }
     n.metrics??={};n.metrics.quality=q;return;
    }
    if(cloud?.format!=='banane-native-lidar-capture-v2')return;
    for(const side of SIDES){
     const obs=cloud.railObservations?.[side];if(!obs)continue;
     q.snapshotsTotal++;
     const motifs=obs.coverage?.exclusionReasons||[];
     if(obs.coverage?.status==='qualified-candidate')q.snapshotsQualified++;
     else{
      /* « Interrompu avant frontière stable » n'est PAS un défaut de couverture :
       * c'est une réserve de provenance (la capture s'est arrêtée sur un
       * changement de cible, de vue ou de découpe). Le confondre avec un manque
       * de points faisait lire 8 % là où la couverture était suffisante. */
      if(motifs.length===1&&motifs[0]==='capture-interrupted-before-stable-boundary')q.interruptedOnly++;
      for(const r of motifs)q.exclusionReasons[r]=(q.exclusionReasons[r]||0)+1;
     }
     const cl=obs.clipLoss;if(!cl)continue;
     for(const k of Object.keys(q.clip))if(Number.isFinite(cl[k]))q.clip[k]+=cl[k];
    }
    n.metrics??={};n.metrics.quality=q;
   }catch{/* la qualité ne doit jamais interrompre la collecte */}
  }
  /* V4.5-R — santé de la collecte, lisible en direct dans la fenêtre Natif.
   * Avant, une dégradation ou des captures perdues ne se voyaient qu'après
   * analyse hors ligne de l'export, donc trop tard pour réagir. */
  health(){
   const n=this.e.s.native;if(!n)return null;
   const m=n.metrics||{},x=n.exportState||{};
   /* Le taux d'échec ne porte QUE sur les vraies pannes. Terrain du 15/09 :
    * 530 des 616 « échecs » étaient le budget par visite, 86 des refus
    * légitimes de cut — soit 616 sur 616 sans une seule panne réelle, affichés
    * jusqu'ici comme « 53 % d'échec » en rouge. */
   const captures=(m.captureCompleted||0)+(m.captureFailed||0);
   return {status:n.status||null,visits:(n.visits||[]).length,
    bytesStored:x.bytesStored||0,bytesPending:x.bytesPending||0,
    watermark:Sessions.EXPORT_WATERMARK_BYTES,segments:x.segments||0,
    cloudsStored:(n.cloudIds||[]).length,cloudsExported:(x.exportedCloudIds||[]).length,
    captureCompleted:m.captureCompleted||0,captureFailed:m.captureFailed||0,
    captureBudgeted:m.captureBudgeted||0,captureRefused:m.captureRefused||0,
    captureFailureRate:captures?Math.round((m.captureFailed||0)/captures*100):0,
    queueDepth:m.queueDepth??null,queueDepthMax:m.queueDepthMax||0,
    dropped:m.dropped||0,sendFailures:m.sendFailures||0,
    degradationLevel:m.degradationLevel||'FULL',degradationPeak:m.degradationPeak||m.degradationLevel||'FULL',
    recoveries:m.recoveries||0,setAside:m.setAside||0,refused:m.refused||0,
    setAsideItems:(m.setAsideItems||[]).slice(0,8),
    quality:(()=>{const q=n.quality;if(!q)return null;const c=q.clip;
     const roi=c.inRoiKept+c.inRoiDropped,face=c.nearFaceKept+c.nearFaceDropped,top=c.nearTopKept+c.nearTopDropped;
     const ecartes=q.snapshotsTotal-q.snapshotsQualified;
     return {snapshotsQualified:q.snapshotsQualified,snapshotsTotal:q.snapshotsTotal,
      qualifiedRate:q.snapshotsTotal?Math.round(q.snapshotsQualified/q.snapshotsTotal*100):null,
      railsObserved:q.railsObserved||0,railsQualified:q.railsQualified||0,
      railsTruncated:q.railsTruncated===true,
      railQualifiedRate:q.railsObserved?Math.round((q.railsQualified||0)/q.railsObserved*100):null,
      interruptedOnly:q.interruptedOnly||0,
      interruptedShare:ecartes>0?Math.round((q.interruptedOnly||0)/ecartes*100):null,
      coverageShort:Math.max(0,ecartes-(q.interruptedOnly||0)),
      exclusionReasons:{...(q.exclusionReasons||{})},
      clipDropRate:roi?Math.round(c.inRoiDropped/roi*100):null,
      faceKept:c.nearFaceKept,faceDropped:c.nearFaceDropped,
      faceDropRate:face?Math.round(c.nearFaceDropped/face*100):null,
      topDropRate:top?Math.round(c.nearTopDropped/top*100):null};})()};
  }
  /* V4.5.4 — le vidage automatique libère réellement la place.
   *
   * Terrain du 15/09 : le vidage se déclenchait bien vers 30-37 Mo, mais rien
   * n'était libéré ensuite. Session 3dd20460 — segment automatique de 314
   * objets à 09:39, puis export final de 680 objets à 09:41 : les 314 déjà
   * écrits l'étaient une seconde fois. Session 28bfe0a5 en 4.5.3 — 77,3 Mo
   * accumulés pour 646 objets, dont 315 déjà sur disque. La session ne
   * repartait jamais de zéro, d'où le retour du mur malgré le vidage.
   *
   * Désormais, un objet acquitté est PURGÉ d'IndexedDB. Deux garde-fous :
   *   — `n.cloudIds` garde la liste COMPLÈTE de tout ce qui a été produit, donc
   *     l'export final déclare aussi les objets purgés ;
   *   — `tools/merge-segments.cjs` contrôle l'intégrité sur l'UNION des
   *     identifiants déclarés : si un segment automatique manque à la fusion,
   *     il est signalé nommément au lieu de disparaître en silence.
   * La purge ne masque donc jamais une perte : elle la rend détectable.
   *
   * 4.8.0 (audit qualité, D01) : un objet n'est purgé que si le fichier qui
   * le contient est CONFIRMÉ écrit (`confirmes`, rendu par chrome.downloads au
   * panneau). Un objet écrit sans confirmation sort de la file d'attente mais
   * reste dans IndexedDB : l'export final le reprend. Sans `confirmes`, rien
   * n'est purgé. */
  /* 4.8.0 (terrain du 28/09) : `fichiers` = nombre de fichiers écrits par ce
   * vidage. Le compteur de segments comptait les vidages, pas les fichiers :
   * un vidage de neuf fichiers laissait le suivant repartir trop bas (deux
   * « auto-seg04 » le 28/09 ; rien de perdu, mais trompeur). */
  async ackExported(ids,{confirmes=[],fichiers=1,final=false}={}){
   const n=this.e.s.native;if(!n)throw Error('Aucune session Natif conservée.');
   n.exportState??={bytesStored:0,bytesPending:0,exportedCloudIds:[],releasedCloudIds:[],segments:0,lastAdviceAt:null};
   /* 4.9.0.18 (AM-19) : l'export FINAL confirmé est noté ; sans lui, « Démarrer une nouvelle session » est refusé. */
   if(final){n.exportState.finalExportAt=iso();n.exportState.finalExportFiles=Number.isInteger(fichiers)?fichiers:null;
    if(!(ids||[]).length){await this.e.save();return {acknowledged:0,final:true,finalExportAt:n.exportState.finalExportAt};}}
   const x=n.exportState;x.releasedCloudIds??=[];const added=[];
   for(const id of ids||[])if(!x.exportedCloudIds.includes(id)){x.exportedCloudIds.push(id);added.push(id);}
   x.segments+=Math.max(1,Number.isInteger(fichiers)?fichiers:1);x.bytesPending=0;x.lastAdviceAt=iso();
   let libere=0,octets=0;
   const purgeables=new Set(confirmes||[]);let gardes=0;
   if(S.export.releaseAfterExport){
    for(const id of added){
     if(!purgeables.has(id)){gardes++;continue;}
     try{
      const cloud=await this.store.getCloud(id);
      if(cloud)octets+=this.cloudBytes(cloud);
      await this.store.deleteCloud(id);
      if(!x.releasedCloudIds.includes(id))x.releasedCloudIds.push(id);
      libere++;
     }catch{/* un objet non purgeable reste lisible : jamais bloquant */}
    }
    x.bytesStored=Math.max(0,(x.bytesStored||0)-octets);
   }
   n.metrics??={};n.metrics.bytesPending=0;n.metrics.exportSegments=x.segments;
   n.metrics.bytesStored=x.bytesStored;n.metrics.cloudsReleased=x.releasedCloudIds.length;
   await this.e.save();
   return {acknowledged:added.length,segments:x.segments,exported:x.exportedCloudIds.length,
    released:libere,kept:gardes,releasedTotal:x.releasedCloudIds.length,bytesFreed:octets,total:n.cloudIds.length};
  }
  /* V4.5.3 — manifeste d'export SANS les records ni les événements.
   *
   * Terrain du 15/09 : sur une session de 92 visites, l'export échouait avec
   * « Message exceeded maximum allowed size of 64MiB ». Ce n'est pas la limite
   * de téléchargement mais celle de `chrome.runtime.sendMessage` : `dataset()`
   * renvoyait records et événements en un seul message, qui dépasse 64 MiB dès
   * que la session grossit. Deux segments étaient écrits, puis plus rien —
   * 717 objets sur 977 mis à l'abri.
   *
   * Le panneau lit désormais records, événements et nuages DIRECTEMENT dans
   * IndexedDB : il partage l'origine du service worker, donc la même base. Le
   * message ne transporte plus que l'état de session et la liste des
   * identifiants, quelques dizaines de kilo-octets. */
  async exportManifest(tous=false){
   const n=this.e.s.native;if(!n)throw Error('Aucune session Natif conservée.');
   const full=await this.dataset();
   const done=tous?[]:(n.exportState?.exportedCloudIds||[]);
   /* Un objet purgé n'est plus lisible : il ne doit pas être demandé au
    * panneau, qui le rapporterait comme manquant. Mais il reste déclaré dans
    * `leger.cloudIds` (la session), donc la fusion sait qu'il doit se trouver
    * dans un segment antérieur et le signale s'il est absent. */
   const libere=n.exportState?.releasedCloudIds||[];
   const indisponible=new Set([...done,...libere]);
   const {records,events,...leger}=full;
   return {...leger,sessionId:n.id,
    cloudIds:full.cloudIds.filter(id=>!indisponible.has(id)),
    declaredCloudIds:full.cloudIds,
    recordCount:records.length,eventCount:events.length,
    alreadyExported:done.length,released:libere.length,
    exportAdvice:this.exportAdvice()};
  }
  /* Métadonnées + uniquement les nuages pas encore écrits sur disque. */
  async exportPlan(){
   const data=await this.dataset();const n=this.e.s.native;
   const done=n.exportState?.exportedCloudIds||[];
   return {...data,cloudIds:data.cloudIds.filter(id=>!done.includes(id)),
    alreadyExported:done.length,exportAdvice:this.exportAdvice()};
  }
  async dataset(){const n=this.e.s.native;if(!n)throw Error('Aucune session Natif conservée.');
   const records=(await this.store.all('records')).filter(record=>record.nativeSessionId===n.id).sort((a,b)=>(a.visitIndex??0)-(b.visitIndex??0));
   const counts=new Map();for(const record of records){const key=K.cutId(record.identity);counts.set(key,(counts.get(key)||0)+1);}
   const lossCauses={};for(const record of records)for(const side of SIDES)for(const reason of record.geometryEligibility?.[side]?.reasons||[])lossCauses[reason]=(lossCauses[reason]||0)+1;
   const firstStored=Object.fromEntries(SIDES.map(side=>[side,records.map(record=>{const snapshot=record.railSnapshots?.[side]?.find(item=>
     item.qualificationStatus==='qualified-candidate'&&item.receiptEventSeq&&!item.revocations?.length&&
     item.sourceStatus==='reference-version-and-matrix-stable-through-checkpoint'&&item.clipStatus==='verified-classifiable'&&
     item.coordinateSystem?.frameId===record.identity?.frameId&&poseEqual(item.rail,record.beforeEstablished?.rails?.[side]));
     return snapshot?{record,snapshot}:null;}).filter(Boolean)]));
   const median=a=>a.length?a.slice().sort((x,y)=>x-y)[Math.floor((a.length-1)/2)]:null;
   const latency=Object.fromEntries(SIDES.map(side=>{const values=firstStored[side].map(({record,snapshot})=>Date.parse(snapshot.acquiredThroughAt)-Date.parse(record.startedAt)).filter(v=>Number.isFinite(v)&&v>=0);
     return [side,{count:values.length,medianMs:median(values),maximumMs:values.length?Math.max(...values):null}];}));
   const durationMinutes=n.finishedAt?Math.max(0,(Date.parse(n.finishedAt)-Date.parse(n.startedAt))/60000):null;
   /* Santé de la capture (4.7.2) : ce qu'il faut regarder en premier après une
    * session au rythme réel. Part des visites dont chaque rail a un instantané
    * qualifié et stocké pour sa pose initiale, nombre de lectures par visite,
    * et causes d'arrêt des lectures. */
   const captures=records.flatMap(record=>Object.values(record.geometryCaptures||{}));
   const terminations={};for(const capture of captures){const key=capture.termination?.code||(capture.status==='reading'?'NOT_REPORTED':'NONE');terminations[key]=(terminations[key]||0)+1;}
   const captureHealth={visits:records.length,captures:captures.length,capturesPerVisit:records.length?captures.length/records.length:null,terminations,
     qualifiedInitialSnapshotRateByRail:Object.fromEntries(SIDES.map(side=>[side,records.length?firstStored[side].length/records.length:null]))};
   const closureSummary={captureHealth,status:n.status,visits:records.length,complete:records.filter(record=>record.status==='complete').length,partial:records.filter(record=>record.status!=='complete').length,
     returns:[...counts.values()].filter(count=>count>1).reduce((sum,count)=>sum+count-1,0),observationPeriods:n.observationPeriods.length,lidarCaptures:n.cloudIds.length,
     usableByRail:Object.fromEntries(SIDES.map(side=>[side,records.filter(record=>record.geometryEligibility?.[side]?.status==='comparable-candidate').length])),
     usablePairs:records.filter(record=>record.geometryEligibility?.pair?.status==='comparable-candidate').length,geometryLossCauses:lossCauses,
     firstQualifiedStoredSnapshotByRail:Object.fromEntries(SIDES.map(side=>[side,firstStored[side].length])),
     firstQualifiedAcquisitionLatencyByRail:latency,durationMinutes,
     comparableCandidateRailsPerMinute:durationMinutes?records.reduce((sum,record)=>sum+SIDES.filter(side=>record.geometryEligibility?.[side]?.status==='comparable-candidate').length,0)/durationMinutes:null,
     droppedEvents:n.metrics.dropped,degradationLevels:n.metrics.degradationLevels,serverConfirmationAvailable:false,serverConfirmationStatus:'not-observed',
     serverConfirmationNotAnError:true,passiveContract:{commandsByBanane:0,cameraChangesByBanane:0,railSelectionsByBanane:0,navigationByBanane:0}};
   const events=(await this.store.all('events')).filter(event=>event.nativeSessionId===n.id).sort((a,b)=>(a.eventSeq||a.event_seq||0)-(b.eventSeq||b.event_seq||0));
   return {format:'banane-native-session-v2',version:K.VERSION,exportedAt:iso(),session:K.clone(n),records,events,closureSummary,cloudIds:n.cloudIds.slice()};
  }
 }
 return {Sessions,poseEqual,referenceParEcriture,entreeSansFuite};
});
