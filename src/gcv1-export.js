(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.BananeGCV1Export=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';

 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const IDENTITY_FIELDS=['pageId','part','cut','shape','frameId'];
 const sameCompleteIdentity=(a,b)=>!!a&&!!b&&IDENTITY_FIELDS.every(key=>
  Object.prototype.hasOwnProperty.call(a,key)&&Object.prototype.hasOwnProperty.call(b,key)&&
  a[key]!=null&&b[key]!=null&&a[key]===b[key]);
 const proposalIdOf=event=>event?.proposalId??event?.proposal?.id??event?.paused?.proposal?.id??null;
 const batchIdOf=event=>event?.batchId??event?.batch?.id??event?.paused?.batchId??null;

 function linkedEvents(events,observation){
  const proposalId=observation.proposalId;
  const batchId=observation.batchId;
  /* Un événement qui nomme une proposition ne peut appartenir qu'à elle.
   * Pour les anciens événements sans proposalId, le couple lot+cible n'est
   * utilisable que si une seule proposition explicite existe dans ce scope. */
  const scopedProposalIds=new Set(events.filter(event=>batchId&&batchIdOf(event)===batchId&&
   sameCompleteIdentity(event.identity,observation.identity)).map(proposalIdOf).filter(Boolean));
  const fallbackUnambiguous=scopedProposalIds.size<=1&&
   (!scopedProposalIds.size||proposalId&&scopedProposalIds.has(proposalId));
  return events.filter(event=>{
   if(event.type==='gcv1-shadow-observed')return false;
   const eventProposalId=proposalIdOf(event);
   if(eventProposalId)return !!proposalId&&eventProposalId===proposalId;
   return fallbackUnambiguous&&!!batchId&&batchIdOf(event)===batchId&&sameCompleteIdentity(event.identity,observation.identity);
  });
 }

 function findBatchId(events,event,proposalId){
  if(event.batchId)return event.batchId;
  const ids=new Set(events.filter(e=>proposalId&&proposalIdOf(e)===proposalId).map(batchIdOf).filter(Boolean));
  return ids.size===1?[...ids][0]:null;
 }

 function findCapture(events,event,proposalId){
  if(event.lidarCaptureId)return {captureId:event.lidarCaptureId,association:'persisted-on-observation'};
  const exact=events.filter(e=>proposalId&&proposalIdOf(e)===proposalId)
   .map(e=>e.lidarCaptureId??e.paused?.lidarCaptureId??null).filter(Boolean);
  if(new Set(exact).size===1)return {captureId:exact[0],association:'proposal-id'};
  const index=events.indexOf(event);
  for(let i=index-1;i>=0;i--){
   const candidate=events[i];
   if(candidate.type==='gcv1-shadow-observed'||candidate.type==='batch-started')break;
   if(candidate.type==='before-captured'&&candidate.lidarId&&sameCompleteIdentity(candidate.identity,event.identity))
    return {captureId:candidate.lidarId,association:'preceding-before-captured-same-identity'};
  }
  return {captureId:null,association:'unavailable'};
 }

 /* D4, revue Astra. UN `deferral` VIENT D'UNE SEULE OPÉRATION.
  *
  * L'ancienne version prenait, pour chaque type d'événement, le DERNIER du
  * tableau. Or `store.all('events')` rend les événements par clé — des UUID
  * aléatoires — et non par chronologie : sur une proposition ayant porté deux
  * opérations (une préparée puis interrompue, une seconde reprise), l'export
  * pouvait mêler l'intention de A, la navigation de B et la finalisation d'une
  * troisième. Les faits sont donc regroupés PAR OPÉRATION, une opération est
  * choisie explicitement, et seuls ses événements sont agrégés.
  *
  * Aucun ordre de tableau, aucun ordre lexical d'UUID n'entre dans ce choix. */
 const DEFER_PHASES=['defer-intent','defer-command-possible','defer-navigation-observation',
  'defer-navigation-accepted','defer-finalized'];
 const DEFER_OUTCOMES=['defer-navigation-uncertain','defer-navigation-not-emitted','defer-navigation-not-dispatched',
  'defer-navigation-uncertain-on-restart','defer-intent-not-emitted-on-restart','defer-intent-closed',
  'defer-intent-abandoned-before-emission','defer-intent-orphaned','defer-authorization-revoked',
  'defer-final-event-repaired-on-restart','defer-finalized-without-durable-entry'];
 const DEFER_TYPES=new Set([...DEFER_PHASES,...DEFER_OUTCOMES]);

 /* Regroupement par `operationId`. Les événements qui n'en portent pas — un
  * journal antérieur à 4.7 — ne rejoignent AUCUN groupe : on ne leur attribue
  * pas après coup l'identifiant d'une opération, ce qui fabriquerait une
  * association que les données ne portent pas. Ils sont comptés et exposés. */
 function groupDeferEvents(linked,observation){
  const groups=new Map(),legacy=[];
  for(const event of linked){
   if(!DEFER_TYPES.has(event.type))continue;
   const batchId=event.batchId??null;
   if(batchId&&observation.batchId&&batchId!==observation.batchId)continue;
   const id=typeof event.operationId==='string'&&event.operationId?event.operationId:null;
   if(!id){legacy.push(event);continue;}
   if(!groups.has(id))groups.set(id,[]);
   groups.get(id).push(event);
  }
  return {groups,legacy};
 }
 /* Un seul événement par type DANS UNE MÊME opération. Des doublons y sont des
  * réémissions du même fait : on prend le plus récent par timestamp et, à
  * timestamp égal, on départage par identifiant. Ce départage ordonne des
  * événements ÉQUIVALENTS de façon reproductible ; il ne sert jamais de
  * chronologie entre opérations. */
 function pickDeferEvent(groupEvents,type){
  const list=groupEvents.filter(e=>e.type===type);
  if(!list.length)return null;
  if(list.length===1)return clone(list[0]);
  const sorted=list.slice().sort((a,b)=>
   String(a.timestamp??'').localeCompare(String(b.timestamp??''))||
   String(a.eventId??'').localeCompare(String(b.eventId??'')));
  return clone(sorted[sorted.length-1]);
 }
 /* Choix de l'opération, dans cet ordre et sur des faits durables seulement :
  * une finalisation unique l'emporte ; sinon l'intention encore persistée, si
  * elle appartient bien à ce groupe ; sinon l'unique opération présente. Toute
  * autre situation est une AMBIGUÏTÉ, exportée telle quelle. */
 function selectDeferOperation(groups,legacy,state){
  /* Les identifiants sont RENDUS triés : l'ordre d'insertion d'une Map suit
   * celui du tableau lu, et rien de ce que l'export publie ne doit en dépendre.
   * Ce tri est une présentation stable, jamais une chronologie. */
  const ids=[...groups.keys()].sort(),base={operationIds:ids,legacyEventsWithoutOperationId:legacy.length};
  if(!ids.length)return {operationId:null,events:[],selectedBy:null,
   ambiguity:legacy.length?{reason:'DEFER_EVENTS_WITHOUT_OPERATION_ID',...base}:null,...base};
  const finalized=ids.filter(id=>groups.get(id).some(e=>e.type==='defer-finalized'));
  if(finalized.length===1)return {operationId:finalized[0],events:groups.get(finalized[0]),
   selectedBy:'durable-finalization',ambiguity:null,...base};
  if(finalized.length>1)return {operationId:null,events:[],selectedBy:null,
   ambiguity:{reason:'MULTIPLE_FINALIZED_OPERATIONS',finalizedOperationIds:finalized.slice().sort(),...base},...base};
  const active=typeof state?.deferIntent?.operationId==='string'?state.deferIntent.operationId:null;
  if(active&&groups.has(active))return {operationId:active,events:groups.get(active),
   selectedBy:'persisted-active-intent',ambiguity:null,...base};
  if(ids.length===1)return {operationId:ids[0],events:groups.get(ids[0]),
   selectedBy:'single-operation',ambiguity:null,...base};
  return {operationId:null,events:[],selectedBy:null,
   ambiguity:{reason:'MULTIPLE_OPERATIONS_NO_DURABLE_SELECTOR',...base},...base};
 }
 function deferralResult(linked,observation,state){
  const {groups,legacy}=groupDeferEvents(linked,observation);
  if(!groups.size&&!legacy.length)return null;
  const selection=selectDeferOperation(groups,legacy,state);
  const common={operationIds:selection.operationIds,selectedBy:selection.selectedBy,
   legacyEventsWithoutOperationId:selection.legacyEventsWithoutOperationId,
   duplicateEventsInOperation:selection.events.length-new Set(selection.events.map(e=>e.type)).size};
  if(!selection.operationId)return {status:'DEFER_AMBIGUOUS',confirmed:false,operationId:null,
   policy:null,identity:null,nextIdentity:null,transition:null,proposalId:null,lidarCaptureId:null,
   lidarCaptureStatus:'not-available',recordId:null,railsAtDeferral:null,unresolvedRails:null,motif:null,
   navigationWithoutDecision:null,uncertainty:null,ambiguity:selection.ambiguity,...common};
  const pick=type=>pickDeferEvent(selection.events,type);
  const intent=pick('defer-intent'),observationEvent=pick('defer-navigation-observation');
  const accepted=pick('defer-navigation-accepted'),finalized=pick('defer-finalized');
  /* L'issue non confirmée vient elle aussi de CETTE opération, jamais d'une
   * autre : c'est exactement le mélange que D4 supprime. */
  const outcome=DEFER_OUTCOMES.map(type=>pick(type)).filter(Boolean)
   .sort((a,b)=>String(a.timestamp??'').localeCompare(String(b.timestamp??''))||
    String(a.eventId??'').localeCompare(String(b.eventId??''))).at(-1)||null;
  const evidence=finalized?.evidence||accepted?.evidence||observationEvent?.evidence||null;
  return {
   status:finalized?'DEFERRED_UNRESOLVED':'DEFER_NOT_CONFIRMED',
   confirmed:!!finalized,
   operationId:selection.operationId,
   policy:intent?.policy??'defer',
   identity:clone(finalized?.identity??intent?.identity??null),
   nextIdentity:clone(finalized?.nextIdentity??accepted?.nextIdentity??null),
   transition:finalized?.transition??accepted?.transition??observationEvent?.transition??null,
   proposalId:finalized?.proposalId??intent?.proposalId??null,
   lidarCaptureId:finalized?.lidarCaptureId??intent?.lidarCaptureId??null,
   lidarCaptureStatus:(finalized?.lidarCaptureId??intent?.lidarCaptureId)?'persisted-on-intent':'not-available',
   recordId:finalized?.recordId??null,
   railsAtDeferral:clone(finalized?.rails??intent?.rails??null),
   unresolvedRails:clone(finalized?.unresolvedRails??intent?.unresolvedRails??null),
   motif:intent?.eligibility??null,
   navigationWithoutDecision:{
    commandInvoked:finalized?.commandInvoked??observationEvent?.commandInvoked??null,
    navigationObserved:observationEvent?.navigationObserved??(finalized?true:null),
    commandScope:'banane-operation-only',bananeValidated:false,
    applyCommandSent:false,validationCommandSent:false,skipCommandSent:false,
    shortcutEquivalence:clone(evidence?.shortcutEquivalence??null),
    correlation:clone(evidence?.correlation??null),evidence:clone(evidence)},
   uncertainty:finalized?null:clone(outcome||observationEvent||null),
   ambiguity:selection.ambiguity,...common};
 }

 function runtimeResult(events,observation,state){
  const linked=linkedEvents(events,observation);
  const last=type=>clone(linked.filter(e=>e.type===type).at(-1)||null);
  const apply=last('applied-verified');
  const validationIntent=last('validation-intent');
  const validationObservation=last('validation-observation');
  const validationAccepted=last('validation-accepted');
  const pause=last('batch-paused-unresolved-rail');
  const interruption=linked.slice().reverse().find(e=>[
   'batch-error','batch-after-state-missing','batch-action-interrupted','batch-validation-not-accepted-on-restart',
  ].includes(e.type));
  const evidence=validationAccepted?.evidence||validationObservation?.evidence||null;
  const unresolved=Object.entries(observation.shadow?.rails||{}).filter(([,rail])=>
   rail?.next&&rail.next.status!=='candidate').map(([side,rail])=>({side,status:rail.next.status,motif:rail.next.motif??null,reason:rail.next.reason??rail.reason??null}));
  /* BANANE 4.7 — issue « différé ». Construite à partir des faits persistés, et
   * séparée de la décision scientifique : un rail unresolved reste unresolved,
   * `abstention` ci-dessous le conserve. Différer est une issue du PILOTE, ni
   * une résolution GCV1, ni une validation humaine, ni un nouveau label.
   * Les différés CONFIRMÉS ne sont jamais confondus avec les intentions
   * incertaines : seul `defer-finalized` confirme. */
  const deferral=deferralResult(linked,observation,state);
  return {
   association:linked.length?'proposal-or-batch-id':'none',
   apply,validationIntent,validationObservation,validationAccepted,deferral,
   afterObserved:evidence?.afterObserved??validationObservation?.afterObserved??apply?.afterObserved??null,
   serverConfirmed:evidence?.serverConfirmed??validationObservation?.serverConfirmed??null,
   navigationObserved:evidence?.navigationObserved??validationObservation?.navigationObserved??null,
   nextIdentity:clone(validationAccepted?.nextIdentity??evidence?.nextIdentity??null),
   transition:validationAccepted?.transition??validationObservation?.expectedTransition??evidence?.expectedTransition??null,
   interruption:clone(interruption||null),
   abstention:pause?{status:pause.paused?.status||'PAUSED_UNRESOLVED_RAIL',event:clone(pause)}
    :unresolved.length?{status:'GCV1_UNRESOLVED',rails:unresolved}:null,
  };
 }

 function railView(side,scientific,proposal){
  const runtime=proposal?.rails?.[side]||null;
  const next=scientific?.next||null;
  return {
   status:runtime?.status??next?.status??(scientific?.error?'error':null),
   source:runtime?.source??null,
   delta:clone(runtime?.delta??next?.delta??null),
   confidence:runtime?.confidence??scientific?.astar?.confidence??null,
   confidenceStatus:runtime?.gcv1?.confidenceStatus??null,
   branch:runtime?.source==='geometry-candidate-v1-s1'?'S1':runtime?.source==='geometry-candidate-v1-astar'?'A_STAR':
    (runtime?.status==='unresolved'||next&&next.status!=='candidate'?'ABSTENTION':null),
   scientificRail:clone(scientific||null),
  };
 }

 function buildDiagnostic({version=null,sessionId=null,state=null,events=[],exportedAt=new Date().toISOString()}={}){
  const source=clone(events);
  const observations=[];
  for(const event of source.filter(e=>e.type==='gcv1-shadow-observed')){
   const shadow=event.shadow||{},proposalId=event.proposalId??null;
   const batchId=findBatchId(source,event,proposalId);
   const capture=findCapture(source,event,proposalId);
   const proposed=source.filter(e=>e.type==='proposed'&&proposalIdOf(e)===proposalId).at(-1)?.proposal||null;
   const observation={
    observationEventId:event.eventId??null,
    identity:clone(event.identity??proposed?.identity??null),
    timestamp:shadow.observedAt??event.timestamp??null,
    sessionId:event.sessionId??null,
    sessionScope:event.sessionId?'persisted':'legacy-unscoped',
    batchId,
    proposalId,
    lidar:{captureId:capture.captureId,association:capture.association},
    format:shadow.format??null,
    contract:clone(shadow.contract??null),
    selection:clone(shadow.selection??null),
    runtimeDecisionUntouched:shadow.runtimeDecisionUntouched??null,
    commandsByShadow:shadow.commandsByShadow??null,
    error:shadow.error??null,
    rails:Object.fromEntries(['left','right'].map(side=>[side,railView(side,shadow.rails?.[side],proposed)])),
    summary:clone(shadow.summary??null),
    comparison:clone(shadow.comparison??null),
    // 4.7.8 : décision sur le lot, en observation seulement (amendement n°9).
    lotObservation:clone(event.lotObservation??null),
   };
   // `state` porte l'intention différée encore persistée : elle sert à choisir
   // l'opération courante quand aucune finalisation durable ne tranche (D4).
   observation.runtime=runtimeResult(source,{...observation,shadow},state);
   observations.push(observation);
  }
  return {format:'banane-gcv1-diagnostic-v1',version,exportedAt,scope:'current-engine-session',
   sessionId:sessionId??state?.sessionId??null,observationCount:observations.length,observations};
 }

 async function buildCorpusPlan({diagnostic,getCloud,exportedAt=new Date().toISOString()}={}){
  if(!diagnostic||typeof getCloud!=='function')throw Error('Diagnostic GCV1 et accès LiDAR requis.');
  const ids=[...new Set((diagnostic.observations||[]).map(o=>o.lidar?.captureId).filter(Boolean))];
  const captureReferences=[],cloudIds=[];
  for(const captureId of ids){
   const cloud=await getCloud(captureId);
   const available=cloud!=null;
   captureReferences.push({captureId,status:available?'available':'missing'});
   if(available)cloudIds.push(captureId);
  }
  return {format:'banane-gcv1-lidar-corpus-v1',version:diagnostic.version??null,exportedAt,
   scope:diagnostic.scope,sessionId:diagnostic.sessionId,diagnostic:clone(diagnostic),
   captureReferences,missingCaptureIds:captureReferences.filter(r=>r.status==='missing').map(r=>r.captureId),cloudIds};
 }

 return {buildDiagnostic,buildCorpusPlan};
});
