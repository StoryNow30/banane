(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.BananeGCV1Export=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';

 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const sameIdentity=(a,b)=>!!a&&!!b&&['pageId','part','cut','shape','frameId']
  .every(key=>a[key]==null||b[key]==null||a[key]===b[key]);
 const proposalIdOf=event=>event?.proposalId??event?.proposal?.id??event?.paused?.proposal?.id??null;
 const batchIdOf=event=>event?.batchId??event?.batch?.id??event?.paused?.batchId??null;

 function linkedEvents(events,observation){
  const proposalId=observation.proposalId;
  const batchId=observation.batchId;
  /* Un événement qui nomme une proposition ne peut appartenir qu'à elle.
   * Pour les anciens événements sans proposalId, le couple lot+cible n'est
   * utilisable que si une seule proposition explicite existe dans ce scope. */
  const scopedProposalIds=new Set(events.filter(event=>batchId&&batchIdOf(event)===batchId&&
   sameIdentity(event.identity,observation.identity)).map(proposalIdOf).filter(Boolean));
  const fallbackUnambiguous=scopedProposalIds.size<=1&&
   (!scopedProposalIds.size||proposalId&&scopedProposalIds.has(proposalId));
  return events.filter(event=>{
   if(event.type==='gcv1-shadow-observed')return false;
   const eventProposalId=proposalIdOf(event);
   if(eventProposalId)return !!proposalId&&eventProposalId===proposalId;
   return fallbackUnambiguous&&!!batchId&&batchIdOf(event)===batchId&&sameIdentity(event.identity,observation.identity);
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
   if(candidate.type==='before-captured'&&candidate.lidarId&&sameIdentity(candidate.identity,event.identity))
    return {captureId:candidate.lidarId,association:'preceding-before-captured-same-identity'};
  }
  return {captureId:null,association:'unavailable'};
 }

 function runtimeResult(events,observation){
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
  return {
   association:linked.length?'proposal-or-batch-id':'none',
   apply,validationIntent,validationObservation,validationAccepted,
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
   };
   observation.runtime=runtimeResult(source,{...observation,shadow});
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
