#!/usr/bin/env node
'use strict';
// Offline-only experiment harness. No browser, adapter, native actions or learning API.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const K=require('../src/core.js'),Geometry=require('../src/geometry.js'),Legacy=require('./native-offline-evaluate.cjs');
const SIDES=['left','right'];
const hash=value=>crypto.createHash('sha256').update(Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const copy=value=>JSON.parse(JSON.stringify(value));
const rounded=value=>Number.isFinite(value)?Math.round(value*1e6)/1e6:null;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const completeIdentity=identity=>K.completeIdentity(identity);
const identityMatches=(a,b)=>K.identityFields.every(field=>(a?.[field]??null)===(b?.[field]??null));
const railSignature=rail=>rail&&[rail.positionSceneRelative,rail.railLocalToSceneRelative,
 rail.profileLocalToSceneRelative,rail.sceneRelativeToProfileLocal];
function observedRailTransition(record,transition,observations){
 const event=observations.find(e=>e.eventSeq===transition.eventSeq&&e.type==='native-state-observed');
 const before=transition.beforeState||transition.effect?.beforeState||observations.filter(e=>e.eventSeq<transition.eventSeq)
  .sort((a,b)=>b.eventSeq-a.eventSeq)[0]?.state||record.firstObserved||record.initialObserved;
 const after=transition.afterState||transition.effect?.afterState||event?.state;
 if(!before||!after)return {sides:[],uncertain:true,reason:'transition-states-missing'};
 if(before.identity?.frameId!==record.identity?.frameId||after.identity?.frameId!==record.identity?.frameId)
  return {sides:[],uncertain:true,reason:'transition-coordinate-frame-changed'};
 if(!identityMatches(before.identity,record.identity)||!identityMatches(after.identity,record.identity))
  return {sides:[],uncertain:true,reason:'transition-identity-mismatch'};
 if(!validTime(before.capturedAt)||!validTime(after.capturedAt)||before.capturedAt>after.capturedAt||
  !validTime(transition.observedAt)||after.capturedAt!==transition.observedAt)
  return {sides:[],uncertain:true,reason:'transition-timestamp-inconsistent'};
 const sides=[],changes={};for(const side of SIDES){const a=railSignature(before.rails?.[side]),b=railSignature(after.rails?.[side]);
  if(!a||!b||!a.every(v=>Array.isArray(v)&&v.every(Number.isFinite))||!b.every(v=>Array.isArray(v)&&v.every(Number.isFinite)))
   return {sides:[],uncertain:true,reason:'transition-rail-side-unverifiable'};
  if(!same(a,b)){sides.push(side);changes[side]=same(a[0],b[0])?'rail-profile-frame-changed':'rail-position-changed';}}
 if(!sides.length&&transition.effect?.kind!=='loaded-view-changed')
  return {sides:[],uncertain:true,reason:'rail-transition-without-attributable-rail-change'};
 return {sides,changes,uncertain:false,reason:sides.length?'rail-pose-or-profile-frame-changed':'loaded-view-only'};
}
function temporalBoundaries(record,observations=[]){const rows=(record.stateTransitions||[])
 .filter(t=>['rail-state-changed','rail-and-loaded-view-changed','loaded-view-changed'].includes(t.effect?.kind))
 .sort((a,b)=>(a.eventSeq??Infinity)-(b.eventSeq??Infinity));
 const known={left:null,right:null},unknown=[];
 if((record.partialReasons||[]).includes('state-transitions-truncated'))
  unknown.push({at:null,reason:'state-transitions-truncated',eventSeq:null});
 for(const row of rows){if(!validTime(row.observedAt)){unknown.push({at:null,reason:'rail-transition-timestamp-missing',eventSeq:row.eventSeq});continue;}
  const verdict=observedRailTransition(record,row,observations);
  if(verdict.uncertain){if(row.effect?.kind!=='loaded-view-changed')unknown.push({at:row.observedAt,reason:verdict.reason,eventSeq:row.eventSeq});continue;}
  for(const side of verdict.sides)if(!known[side]||row.observedAt<known[side].at)
   known[side]={at:row.observedAt,reason:verdict.changes[side],eventKind:row.effect.kind,eventSeq:row.eventSeq};}
 return {known,unknown};}

// Read only acquisition, initial state and geometry. Never consult final/label/eligibility.
/* Entrée moteur (4.8) : `initial-pose-read` par défaut — l'instantané qualifié
 * plus la suite de la même lecture, sur la même pose, avant toute action
 * humaine (voir `initialPoseReadIds`). `first-snapshot` reproduit l'entrée
 * historique, pour comparer. */
const INPUT_MODES=Object.freeze(['initial-pose-read','first-snapshot']),DEFAULT_INPUT_MODE='initial-pose-read';
function prepareRail(record,side,clouds,observations=[],boundaries=temporalBoundaries(record,observations),options={}){
 const inputMode=options.inputMode||DEFAULT_INPUT_MODE;if(!INPUT_MODES.includes(inputMode))throw Error('Mode d’entrée inconnu : '+inputMode);
 const initial=record.beforeEstablished,firstChange=boundaries.known[side]?.at||null,
  firstUnknown=boundaries.unknown.sort((a,b)=>String(a.at).localeCompare(String(b.at)))[0]||null;
 const bounds=[firstChange&&{at:firstChange,reason:'no-qualified-pre-correction-snapshot'},
  firstUnknown&&{at:firstUnknown.at,reason:'no-qualified-before-unattributed-rail-transition',detail:firstUnknown.reason}]
  .filter(Boolean).sort((a,b)=>String(a.at).localeCompare(String(b.at)));
 const firstBoundary=bounds[0]||null;
 const snapshots=(record.railSnapshots?.[side]||[]).filter(q=>q.qualificationStatus==='qualified-candidate')
  .sort((a,b)=>String(a.acquiredThroughAt).localeCompare(String(b.acquiredThroughAt))||String(a.snapshotId).localeCompare(String(b.snapshotId)));
 const reasons=[];
 if(!initial?.rails?.[side]||!validTime(initial.capturedAt)||!identityMatches(initial.identity,record.identity))reasons.push('initial-established-state-missing-or-mismatched');
 if(firstBoundary&&(!firstBoundary.at||initial?.capturedAt>=firstBoundary.at))reasons.push('initial-established-after-or-unverifiable-transition');
 if(!snapshots.length)reasons.push('no-qualified-snapshot');
 const eligible=snapshots.filter(q=>validTime(q.acquisitionStartedAt)&&validTime(q.acquiredThroughAt)&&
  (!firstBoundary||firstBoundary.at&&q.acquiredThroughAt<firstBoundary.at)&&(!initial?.capturedAt||q.acquisitionStartedAt>=initial.capturedAt));
 if(snapshots.length&&!eligible.length)reasons.push(firstBoundary?.reason||'qualified-snapshot-timing-unverifiable');
 const timing={firstObservedRailChangeAt:firstChange,firstUnattributedTransitionAt:firstUnknown?.at??null,
  firstUnattributedTransitionReason:firstUnknown?.reason??null,firstObservedRailChangeKind:boundaries.known[side]?.reason??null,
  temporalBoundary:firstBoundary};
 if(reasons.length)return {status:'excluded',reasons,...timing,qualifiedSnapshots:snapshots.length};
 const snapshot=eligible[0];
 if(!identityMatches(snapshot.identity,record.identity)||snapshot.side!==side)reasons.push('snapshot-identity-or-side-mismatch');
 if(snapshot.transform?.valid!==true||snapshot.clipStatus!=='verified-classifiable'||snapshot.associationStatus!=='same-target-and-rail-pose')reasons.push('snapshot-transform-clip-or-association-unverified');
 if(!snapshot.storedAt||!Number.isInteger(snapshot.receiptEventSeq))reasons.push('snapshot-persistence-unverified');
 if(snapshot.coverage?.status!=='qualified-candidate'||!snapshot.coverage?.pointsInEngineUsefulRoi)reasons.push('snapshot-useful-roi-unqualified');
 if(snapshot.coordinateSystem?.name!=='scene-relative'||snapshot.coordinateSystem?.frameId!==record.identity?.frameId)reasons.push('snapshot-coordinate-frame-unverified');
 if(reasons.length)return {status:'excluded',reasons,snapshotId:snapshot.snapshotId,...timing};
 const descriptor={identity:record.identity,side,initialRail:initial.rails[side],eligibility:{criteriaVersion:snapshot.criteriaVersion,
  snapshotId:snapshot.snapshotId,chunkIds:snapshot.chunkIds}};
 const intentAt=(record.operatorIntents||[]).map(intent=>intent.observedAt).filter(validTime).sort()[0]||null;
 const boundaryAt=[firstBoundary?.at,intentAt].filter(validTime).sort()[0]||null;
 if(inputMode==='initial-pose-read'){const ids=Legacy.initialPoseReadIds(descriptor.eligibility,clouds,side,boundaryAt);
  if(ids)descriptor.eligibility={...descriptor.eligibility,readMode:'initial-pose-read-v1',snapshotChunkIds:snapshot.chunkIds.slice(),chunkIds:ids,boundaryAt};}
 const input=Legacy.buildEngineInput(descriptor,clouds);
 if(input.status!=='ready')return {status:'excluded',reasons:input.reasons,snapshotId:snapshot.snapshotId,...timing};
 const checkpoint=clouds.get(snapshot.snapshotId);
 if(!checkpoint||!same(checkpoint.qualification?.coordinateSystem,snapshot.coordinateSystem)||
  !same(checkpoint.qualification?.chunkIds,snapshot.chunkIds)||checkpoint.qualification?.transform?.valid!==true||
  checkpoint.qualification?.associationStatus!=='same-target-and-rail-pose')
  return {status:'excluded',reasons:['snapshot-checkpoint-contract-mismatch'],snapshotId:snapshot.snapshotId,...timing};
 const allPoints=input.chunks.reduce((n,c)=>n+(c.pointsSceneRelative?.length||0),0);
 return {...input,snapshotId:snapshot.snapshotId,snapshotAcquiredThroughAt:snapshot.acquiredThroughAt,
  ...timing,initialObservedAt:initial.capturedAt,initialRail:copy(initial.rails[side]),
  inputMode,readBoundaryAt:boundaryAt,snapshotChunkCount:snapshot.chunkIds.length,inputChunkCount:descriptor.eligibility.chunkIds.length,
  quality:{...copy(snapshot.coverage),clipStatus:snapshot.clipStatus,transform:copy(snapshot.transform),
   sourceStatus:snapshot.sourceStatus,pointsExported:allPoints,pointsOutsideVerifiedClip:allPoints-input.points},
  coordinateSystem:copy(snapshot.coordinateSystem)};
}
function prepareVisit(record,clouds,observations=[],options={}){const boundaries=temporalBoundaries(record,observations);
 const rails=Object.fromEntries(SIDES.map(side=>[side,prepareRail(record,side,clouds,observations,boundaries,options)]));
 const pair=Legacy.buildPairInput(rails.left,rails.right);
 return {recordId:record.recordId,visitId:record.visitId,identity:completeIdentity(record.identity),rails,pair};}
// Future variants implement exactly this adapter; reference code is left byte-identical.
const engines=Object.freeze({reference:Object.freeze({id:'reference',method:Geometry.DEFAULTS.method,
 parameters:Geometry.DEFAULTS,run(prepared){const proposals={left:null,right:null},errors={};
  if(prepared.pair.status==='ready')try{Object.assign(proposals,Geometry.proposeBoth(prepared.pair.capture,this.parameters));}catch(e){errors.pair=e.message;}
  for(const side of SIDES)if(!proposals[side]&&prepared.rails[side].status==='ready')
   try{proposals[side]=Geometry.propose(prepared.rails[side].capture,side,this.parameters);}catch(e){errors[side]=e.message;}
  return {proposals,errors};}})});
function execute(prepared,adapter=engines.reference){if(typeof adapter.run!=='function'||!adapter.id||!adapter.parameters)throw Error('Invalid engine adapter');
 return adapter.run(prepared);}
function referenceFor(record,side,initial,snapshotAcquiredThroughAt){const final=record.humanFinalReference,state=final?.state;
 if(final?.status!=='candidate-observed'||!state?.rails?.[side])return {status:'unavailable',reason:'human-final-candidate-missing'};
 if(!identityMatches(state.identity,record.identity))return {status:'unavailable',reason:'human-final-identity-mismatch'};
 const intents=record.operatorIntents||[];
 if(intents.length!==1||record.multiIntent===true||intents[0].intent!=='VALIDATE')
  return {status:'unavailable',reason:intents.length>1||record.multiIntent===true?'multi-intent-reference-ambiguous':'no-single-validate-intent'};
 const intent=intents[0],association=final.association;
 if(association?.identityMatched===false||!identityMatches(intent.stateObservedBeforeInput?.identity,record.identity))
  return {status:'unavailable',reason:'final-pre-input-identity-mismatch-or-missing'};
 if(!validTime(intent.observedAt)||!validTime(state.capturedAt)||!validTime(final.observedAt)||
  !validTime(snapshotAcquiredThroughAt)||!validTime(record.beforeEstablished?.capturedAt))
  return {status:'unavailable',reason:'human-final-timestamps-missing-or-invalid'};
 if(final.observedAt!==intent.observedAt||!Number.isInteger(final.eventSeq)||!Number.isInteger(intent.eventSeq)||
  final.eventSeq!==intent.eventSeq||
  !same(state,intent.stateObservedBeforeInput)||association?.stateCapturedAt!=null&&association.stateCapturedAt!==state.capturedAt)
  return {status:'unavailable',reason:'human-final-not-associated-with-validate-state'};
 if(association?.source==='cached-state-arrived-after-operator-input')
  return {status:'unavailable',reason:'human-final-association-untrusted'};
 const freshness=Date.parse(intent.observedAt)-Date.parse(state.capturedAt);
 if(freshness<0||freshness>1500||association?.freshnessMs!=null&&association.freshnessMs!==freshness||
  state.capturedAt<record.beforeEstablished.capturedAt||state.capturedAt<snapshotAcquiredThroughAt)
  return {status:'unavailable',reason:'human-final-not-freshly-observed'};
 if(validTime(record.endedAt)&&record.endedAt<intent.observedAt)
  return {status:'unavailable',reason:'human-final-after-visit-ended'};
 const delta=Legacy.humanDelta(initial,state.rails[side]);if(!delta?.every(Number.isFinite))return {status:'unavailable',reason:'human-delta-transform-invalid'};
 return {status:'candidate',finalRail:copy(state.rails[side]),deltaLocal:delta,label:record.observedLabelCandidate||'unspecified',
  referenceReviewed:false,observedAt:final.observedAt,freshnessMs:freshness};}
function score(proposal,reference,units){if(reference.status!=='candidate')return {status:'not-comparable',reason:reference.reason};
 if(proposal?.status!=='candidate'||!Array.isArray(proposal.delta))return {status:'unresolved',reason:proposal?.reasons||['engine-no-proposal']};
 const d=proposal.delta.map((x,i)=>x-reference.deltaLocal[i]);
 return {status:'comparable',unit:'scene-unit; physical calibration NOT independently verified',
  errorSceneUnits:{longitudinal:rounded(d[0]),lateral:rounded(d[1]),vertical:rounded(d[2]),euclidean:rounded(Math.hypot(...d))},
  physicalMillimetres:units?.physicalCalibrationStatus==='independently-verified'&&units?.units==='metres-verified'?
   {lateral:rounded(d[1]*1000),vertical:rounded(d[2]*1000),euclidean:rounded(Math.hypot(...d)*1000)}:null};}
function compactInput(input){return input.status==='ready'?{status:'ready',inputHash:input.inputHash,snapshotId:input.snapshotId,
  snapshotAcquiredThroughAt:input.snapshotAcquiredThroughAt,firstObservedRailChangeAt:input.firstObservedRailChangeAt,
  firstUnattributedTransitionAt:input.firstUnattributedTransitionAt,firstUnattributedTransitionReason:input.firstUnattributedTransitionReason,
  firstObservedRailChangeKind:input.firstObservedRailChangeKind,temporalBoundary:input.temporalBoundary,
  points:input.points,sourceChunkIds:input.capture.sourceChunkIds,initialObservedAt:input.initialObservedAt,
  initialPositionSceneRelative:input.initialRail.positionSceneRelative,initialRail:input.initialRail,
 coordinateSystem:input.coordinateSystem,quality:input.quality}:{status:'excluded',reasons:input.reasons,
  firstObservedRailChangeAt:input.firstObservedRailChangeAt,firstUnattributedTransitionAt:input.firstUnattributedTransitionAt,
  firstUnattributedTransitionReason:input.firstUnattributedTransitionReason,firstObservedRailChangeKind:input.firstObservedRailChangeKind,
  temporalBoundary:input.temporalBoundary,
  snapshotId:input.snapshotId||null};}
function explicitProposal(proposal,initial){if(!proposal)return null;const result=copy(proposal);
 result.deltaFrame='initial-rail-profile-local';result.scoreMeaning='uncalibrated-heuristic-not-probability';
 if(result.status==='candidate'&&result.delta&&initial){try{const origin=K.C.point(initial.sceneRelativeToProfileLocal,initial.positionSceneRelative),
   moved=origin.map((v,i)=>v+result.delta[i]);result.proposedPositionSceneRelative=K.C.point(initial.profileLocalToSceneRelative,moved);
   result.positionFrame='scene-relative';}catch{result.proposedPositionSceneRelative=null;result.positionFrame='transform-failed';}}
 return result;}
function evaluateVisit(record,clouds,adapter=engines.reference,observations=[]){const prepared=prepareVisit(record,clouds,observations),execution=execute(prepared,adapter),rails={};
 // This block is the FIRST time a human final or label is accessed.
 for(const side of SIDES){const input=prepared.rails[side],proposal=execution.proposals[side]||null,
  reference=input.status==='ready'?referenceFor(record,side,input.initialRail,input.snapshotAcquiredThroughAt):{status:'unavailable',reason:'engine-input-excluded'};
  rails[side]={input:compactInput(input),engineId:adapter.id,proposal:explicitProposal(proposal,input.initialRail),availableIntermediateCandidates:proposal?.metrics?.templateAmbiguity?.alternative?
   {status:'diagnostic-only',coarseAlternative:proposal.metrics.templateAmbiguity.alternative,
    coarseLoss:proposal.metrics.templateAmbiguity.alternativeLoss,chosenFineSeed:proposal.metrics.seed,
    note:'Only best coarse alternative, not full candidate list; final seed is fine-grid.'}:
   {status:'not-exposed-by-reference-engine'},reference,
   comparison:input.status==='ready'?score(proposal,reference,input.coordinateSystem):{status:'excluded',reason:input.reasons.join(', ')}};}
 return {recordId:prepared.recordId,visitId:prepared.visitId,identity:prepared.identity,
  pairInput:prepared.pair.status==='ready'?{status:'ready',inputHash:prepared.pair.inputHash,points:prepared.pair.points}:
   {status:'excluded',reasons:prepared.pair.reasons},rails,engineErrors:execution.errors,
  serverConfirmationStatus:record.serverConfirmationStatus||'not-observed',
  safety:{commandsSent:0,navigationActions:0,referenceSuppliedToEngine:false,learning:false},_visual:{prepared}};}
function distribution(values){const nums=values.filter(Number.isFinite).sort((a,b)=>a-b),q=p=>{if(!nums.length)return null;
 const i=(nums.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return rounded(nums[lo]+(nums[hi]-nums[lo])*(i-lo));};
 return {count:nums.length,median:q(.5),p90:q(.9),maximum:q(1)};}
function metrics(results){const byRail={},loss={};for(const side of SIDES){const rails=results.map(r=>r.rails[side]);
  for(const rail of rails)for(const reason of rail.input.reasons||[])loss[reason]=(loss[reason]||0)+1;
  byRail[side]={received:rails.length,preCorrectionQualified:rails.filter(r=>r.input.status==='ready').length,
   candidateReferences:rails.filter(r=>r.reference.status==='candidate').length,
   proposals:rails.filter(r=>r.proposal?.status==='candidate').length,
   unresolved:rails.filter(r=>r.comparison.status==='unresolved').length,
   comparable:rails.filter(r=>r.comparison.status==='comparable').length,
   errorSceneUnits:Object.fromEntries(['lateral','vertical','euclidean'].map(axis=>[axis,distribution(rails.map(r=>Math.abs(r.comparison.errorSceneUnits?.[axis])))]))};}
 return {visitsReceived:results.length,byRail,preCorrectionQualifiedPairs:results.filter(r=>r.pairInput.status==='ready').length,
  exclusionCauses:loss,comparisonCount:byRail.left.comparable+byRail.right.comparable};}
function xml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function overlay(row,side){const input=row._visual.prepared.rails[side];if(input.status!=='ready')return null;
 const rail=input.capture.rails[side],all=input.chunks.flatMap(c=>c.pointsSceneRelative.map((p,i)=>({p:K.C.point(rail.sceneRelativeToProfileLocal,p),clip:c.visibleByClipBoxes?.[i]===true})));
 const contour=(rail.profileContours||[]).reduce((a,b)=>(b.verticesSceneRelative?.length||0)>(a?.verticesSceneRelative?.length||0)?b:a,null)?.verticesSceneRelative||[];
 const initial=contour.map(p=>K.C.point(rail.sceneRelativeToProfileLocal,p)),delta=row.rails[side].proposal?.delta,
  proposed=delta?initial.map(p=>p.map((v,i)=>v+delta[i])):[],humanDelta=row.rails[side].reference.deltaLocal,
  human=humanDelta?initial.map(p=>p.map((v,i)=>v+humanDelta[i])):[];
 const ys=[...all.map(v=>v.p),...initial,...proposed,...human].map(p=>p[1]).filter(Number.isFinite),
  zs=[...all.map(v=>v.p),...initial,...proposed,...human].map(p=>p[2]).filter(Number.isFinite);
 if(!ys.length||!zs.length)return null;
 const ymin=Math.min(...ys)-.01,ymax=Math.max(...ys)+.01,zmin=Math.min(...zs)-.01,zmax=Math.max(...zs)+.01,
  proj=p=>[75+(p[1]-ymin)/(ymax-ymin)*590,475-(p[2]-zmin)/(zmax-zmin)*400],
  dots=(shown,colour)=>{const p=all.filter(v=>v.clip===shown),step=Math.max(1,Math.floor(p.length/1600));return p.filter((_,i)=>i%step===0)
   .map(v=>{const [x,y]=proj(v.p);return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1" fill="${colour}"/>`;}).join('');},
  line=(p,col)=>p.length?`<polyline points="${p.map(v=>proj(v).map(x=>x.toFixed(1)).join(',')).join(' ')}" stroke="${col}" stroke-width="2.5" fill="none"/>`:'';
 const label=`cut ${row.identity.cut} · ${side} · snapshot ${input.snapshotId}`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="575" viewBox="0 0 760 575"><rect width="760" height="575" fill="#161a20"/>`+
  `<g fill="#eee" font-family="Arial"><text x="25" y="25" font-size="16">${xml(label)}</text><text x="25" y="48" font-size="12">Axes Y latéral →, Z vertical ↑ · unités scène non calibrées</text>`+
  `<text x="25" y="545" font-size="12">Visible : ${input.points} · hors découpe : ${input.quality.pointsOutsideVerifiedClip} · référence humaine candidate</text>`+
  `<text x="600" y="500" font-size="12">Y latéral →</text><text x="20" y="100" font-size="12">Z ↑</text></g>`+
  `<path d="M75 75V475H665" stroke="#8e939b" fill="none"/><g opacity=".28">${dots(false,'#b88c8c')}</g><g opacity=".6">${dots(true,'#69b6ff')}</g>`+
  `${line(initial,'#dddddd')}${line(proposed,'#ffb347')}${line(human,'#76e088')}`+
  `<g font-family="Arial" font-size="12"><text x="75" y="520" fill="#69b6ff">nuage visible</text><text x="190" y="520" fill="#b88c8c">hors découpe</text>`+
  `<text x="315" y="520" fill="#ddd">profil initial</text><text x="430" y="520" fill="#ffb347">moteur</text><text x="505" y="520" fill="#76e088">final candidat</text></g></svg>`;}
function parse(argv){const opt={};for(let i=0;i<argv.length;i++){
  if(['--input','--out-dir'].includes(argv[i]))opt[argv[i].slice(2)]=path.resolve(argv[++i]);else throw Error('Option inconnue : '+argv[i]);}
 if(!opt.input||!opt['out-dir'])throw Error('Usage : node tools/placement-lab.cjs --input EXPORT.json --out-dir audit/v45-lot1');return opt;}
function run(argv=process.argv.slice(2)){const opt=parse(argv),bytes=fs.readFileSync(opt.input),doc=JSON.parse(bytes),clouds=new Map((doc.clouds||[]).map(c=>[c.chunkId,c]));
 const observedByVisit=new Map();for(const e of doc.events||[])if(e.visitId&&
  ['native-visit-started','native-state-observed'].includes(e.type)){
  const rows=observedByVisit.get(e.visitId)||[];rows.push({type:e.type,eventSeq:e.eventSeq,
   state:e.type==='native-visit-started'?e.initialObserved:e.state});observedByVisit.set(e.visitId,rows);}
 for(const observations of observedByVisit.values())observations.sort((a,b)=>a.eventSeq-b.eventSeq);
 const rows=(doc.records||[]).map(r=>evaluateVisit(r,clouds,engines.reference,observedByVisit.get(r.visitId)||[])),
  summary=metrics(rows),root=path.resolve(__dirname,'..'),out=opt['out-dir'];fs.mkdirSync(out,{recursive:true});
 const base={id:engines.reference.id,version:K.VERSION,method:Geometry.DEFAULTS.method,parameters:Geometry.DEFAULTS,
  sourceHashes:Object.fromEntries(['src/geometry.js','vendor/capture-core.js'].map(p=>[p,hash(fs.readFileSync(path.join(root,p)))])),
  combinedBuildHash:hash(Buffer.concat(['src/geometry.js','vendor/capture-core.js'].map(p=>fs.readFileSync(path.join(root,p)))))};
 const manifest={format:'banane-placement-experiment-manifest-v1',createdAt:new Date().toISOString(),
  witness:{file:path.basename(opt.input),sha256:hash(bytes),classification:'development-known-not-independent-test',
   format:doc.format,version:doc.version,visits:doc.records?.length||0,clouds:doc.clouds?.length||0,
   pointsExported:(doc.clouds||[]).reduce((n,c)=>n+(c.pointsSceneRelative?.length||0),0)},engine:base,
  selectionPolicy:'earliest persisted qualified rail snapshot before first attributable change of that rail; mixed rail/view transitions included; unattributable changes bound both rails conservatively; no final/label/eligibility input',
  sourceUnitPolicy:'scene units only unless independently verified physical calibration; witness unverified',
  referencePolicy:'single VALIDATE with matching pre-input state, event, fresh timestamp (0..1500ms), initial and snapshot chronology; candidate only; no review or training',summary,
  safety:{esvConnected:false,nativeCommandsSent:0,navigationActions:0,thresholdChanges:0,training:false}};
 const results=rows.map(({_visual,...r})=>r),overlays=[];for(const row of rows)for(const side of SIDES)
  if(row.rails[side].input.status==='ready'){const svg=overlay(row,side);if(svg){const name=`visit-${String(row.visitId).replace(/[^a-zA-Z0-9_-]/g,'_')}-${side}.svg`;
   fs.mkdirSync(path.join(out,'overlays'),{recursive:true});fs.writeFileSync(path.join(out,'overlays',name),svg);
   overlays.push({visitId:row.visitId,cut:row.identity.cut,side,file:`overlays/${name}`});}}
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(out,'rails.json'),JSON.stringify({format:'banane-placement-rail-results-v1',engine:base,results},null,2));
 fs.writeFileSync(path.join(out,'overlays.json'),JSON.stringify(overlays,null,2));
 return {manifest,results,overlays};}
if(require.main===module)try{const r=run();console.log(JSON.stringify({witness:r.manifest.witness,summary:r.manifest.summary,overlays:r.overlays.length},null,2));}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={INPUT_MODES,DEFAULT_INPUT_MODE,engines,observedRailTransition,temporalBoundaries,prepareRail,prepareVisit,referenceFor,execute,evaluateVisit,score,metrics,overlay,run};
