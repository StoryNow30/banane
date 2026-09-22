#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const K=require('../src/core.js'),Geometry=require('../src/geometry.js');
const SIDES=['left','right'];
const clone=value=>JSON.parse(JSON.stringify(value));
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const round=value=>Number.isFinite(value)?Math.round(value*1e6)/1e6:null;
function parseArgs(argv){const out={input:[]};for(let i=0;i<argv.length;i++){const key=argv[i];if(key==='--input')out.input.push(path.resolve(argv[++i]));
 else if(key==='--output')out.output=path.resolve(argv[++i]);else if(key==='--markdown')out.markdown=path.resolve(argv[++i]);else if(key==='--visual-dir')out.visualDir=path.resolve(argv[++i]);else throw Error('Argument inconnu : '+key);}return out;}
function identityEqual(a,b){return K.identityFields.every(field=>(a?.[field]??null)===(b?.[field]??null));}
function quantile(values,p){const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return null;const at=(sorted.length-1)*p,lo=Math.floor(at),hi=Math.ceil(at);return sorted[lo]+(sorted[hi]-sorted[lo])*(at-lo);}
function stats(values){const finite=values.filter(Number.isFinite);return {count:finite.length,medianMm:round(quantile(finite,.5)),p90Mm:round(quantile(finite,.9)),maximumMm:round(finite.length?Math.max(...finite):NaN)};}
function railPose(rail){return rail?{railLocalToSceneRelative:rail.railLocalToSceneRelative,profileLocalToSceneRelative:rail.profileLocalToSceneRelative,
 sceneRelativeToProfileLocal:rail.sceneRelativeToProfileLocal,positionSceneRelative:rail.positionSceneRelative,rotation:rail.rotation,profileRotation:rail.profileRotation}:null;}
function chunksFor(descriptor,clouds){const chunks=[],reasons=[];for(const id of descriptor.eligibility?.chunkIds||[]){const chunk=clouds.get(id);
  if(!chunk)reasons.push('chunk-not-exported:'+id);else if(chunk.format!=='banane-native-lidar-chunk-v1')reasons.push('unexpected-cloud-format:'+id);
  else if(chunk.side!==descriptor.side)reasons.push('chunk-side-mismatch:'+id);else if(!identityEqual(chunk.identity,descriptor.identity))reasons.push('chunk-identity-mismatch:'+id);
  else if(!Array.isArray(chunk.pointsSceneRelative)||!chunk.pointsSceneRelative.length)reasons.push('chunk-empty:'+id);else chunks.push(chunk);}
 if(!chunks.length&&!reasons.length)reasons.push('no-geometry-chunk');return {chunks,reasons};}
/* This function deliberately has no human-final argument. It is the leakage boundary. */
/* 4.8 — LECTURE COMPLÈTE DE LA POSE DE DÉPART.
 *
 * Le premier instantané qualifié est déclenché dès qu'il y a juste assez de
 * points pour dire « la zone est couverte ». Donner au moteur ce seul
 * instantané revenait à le priver de tout ce que la même lecture ramassait
 * ensuite, sur la même pose et avant tout geste humain. Collecte 4.7.3 : flanc
 * médian 6 points avec l'instantané seul, 12 avec la lecture complète ; 105 rails
 * sur 111 au-dessus du seuil de 6 au lieu de 61.
 *
 * Les blocs ajoutés sont strictement bornés : même lecture (captureId) que
 * l'instantané, même côté, rang supérieur, même pose de rail, acquisition
 * terminée AVANT la frontière (premier geste humain sur ce rail, transition non
 * attribuable ou intention de l'opérateur). La frontière anti-fuite reste celle
 * de la référence : aucun point acquis après une action humaine n'entre. */
const chunkRank=chunk=>Number(String(chunk?.chunkId||'').split(':').pop());
function initialPoseReadIds(eligibility,clouds,side,boundaryAt){
 const snapshot=clouds.get(eligibility?.snapshotId);if(!snapshot||!Array.isArray(eligibility?.chunkIds))return null;
 const limit=boundaryAt?Date.parse(boundaryAt):Infinity,base=new Set(eligibility.chunkIds),pose=JSON.stringify(railPose(snapshot.rail));
 const extra=[...clouds.values()].filter(chunk=>chunk?.format==='banane-native-lidar-chunk-v1'&&chunk.captureId===snapshot.captureId&&chunk.side===side&&
  !base.has(chunk.chunkId)&&chunkRank(chunk)>chunkRank(snapshot)&&JSON.stringify(railPose(chunk.rail))===pose&&
  Date.parse(chunk.acquisition?.endedAt||chunk.capturedAt||'')<limit).sort((a,b)=>chunkRank(a)-chunkRank(b));
 return [...eligibility.chunkIds,...extra.map(chunk=>chunk.chunkId)];}
function buildEngineInput(descriptor,clouds){const resolved=chunksFor(descriptor,clouds);if(resolved.reasons.length)return {status:'excluded',reasons:resolved.reasons};
 const first=resolved.chunks[0],reasons=[];for(const chunk of resolved.chunks){if(JSON.stringify(chunk.coordinateSystem)!==JSON.stringify(first.coordinateSystem))reasons.push('chunk-coordinate-system-mismatch');
  if(JSON.stringify(railPose(chunk.rail))!==JSON.stringify(railPose(first.rail)))reasons.push('chunk-rail-frame-mismatch');}
 const initial=descriptor.initialRail;if(!initial)reasons.push('initial-rail-missing');
 if(initial&&JSON.stringify(railPose(initial))!==JSON.stringify(railPose(first.rail)))reasons.push('chunk-does-not-match-initial-rail-pose');
 if(descriptor.eligibility?.criteriaVersion==='native-visible-roi-v1'){
  /* En lecture complète, la preuve de qualification reste l'instantané : il
   * doit figurer à son rang, avec la liste de blocs qu'il déclarait. Les blocs
   * qui suivent doivent venir de la même lecture et s'achever avant la frontière. */
  const complete=descriptor.eligibility.readMode==='initial-pose-read-v1',snapshotIds=complete?descriptor.eligibility.snapshotChunkIds:descriptor.eligibility.chunkIds;
  const last=complete?resolved.chunks[(snapshotIds?.length||0)-1]:resolved.chunks.at(-1);
  if(!last||last.chunkId!==descriptor.eligibility.snapshotId||last.qualification?.status!=='qualified-candidate'||
     JSON.stringify(last.qualification.chunkIds)!==JSON.stringify(snapshotIds))reasons.push('qualified-checkpoint-not-exported');
  if(complete){const limit=descriptor.eligibility.boundaryAt?Date.parse(descriptor.eligibility.boundaryAt):Infinity;
   for(const chunk of resolved.chunks.slice(snapshotIds?.length||0)){
    if(chunk.captureId!==last?.captureId)reasons.push('initial-pose-read-foreign-capture');
    if(!(Date.parse(chunk.acquisition?.endedAt||chunk.capturedAt||'')<limit))reasons.push('initial-pose-read-after-human-boundary');}}}
 if(reasons.length)return {status:'excluded',reasons:[...new Set(reasons)]};
 const pointsSceneRelative=[],visibleByClipBoxes=[];
 for(const chunk of resolved.chunks)for(let i=0;i<chunk.pointsSceneRelative.length;i++)if(chunk.visibleByClipBoxes?.[i]===true){
  pointsSceneRelative.push(chunk.pointsSceneRelative[i]);visibleByClipBoxes.push(true);}
 if(!pointsSceneRelative.length)return {status:'excluded',reasons:['no-proven-clip-visible-points']};
 const rail={...clone(first.rail),...clone(initial),profileContours:clone(first.rail.profileContours||[])};
 const capture={format:'banane-native-offline-engine-input-v1',identity:clone(descriptor.identity),rails:{[descriptor.side]:rail},pointsSceneRelative,visibleByClipBoxes,
  coordinateSystem:clone(first.coordinateSystem),sourceChunkIds:resolved.chunks.map(chunk=>chunk.chunkId)};
 return {status:'ready',capture,inputHash:sha(capture),points:pointsSceneRelative.length,chunks:resolved.chunks};}
function buildPairInput(left,right){if(left.status!=='ready'||right.status!=='ready')return {status:'excluded',reasons:['one-or-both-rail-inputs-not-ready']};
 const reasons=[];if(JSON.stringify(left.capture.coordinateSystem)!==JSON.stringify(right.capture.coordinateSystem))reasons.push('rail-coordinate-system-mismatch');
 if(!identityEqual(left.capture.identity,right.capture.identity))reasons.push('rail-identity-mismatch');if(reasons.length)return {status:'excluded',reasons};
 const capture={format:'banane-native-offline-engine-input-v1',identity:clone(left.capture.identity),rails:{left:clone(left.capture.rails.left),right:clone(right.capture.rails.right)},
  pointsSceneRelative:[...left.capture.pointsSceneRelative,...right.capture.pointsSceneRelative],visibleByClipBoxes:[...left.capture.visibleByClipBoxes,...right.capture.visibleByClipBoxes],
  coordinateSystem:clone(left.capture.coordinateSystem),sourceChunkIds:[...left.capture.sourceChunkIds,...right.capture.sourceChunkIds]};
 return {status:'ready',capture,inputHash:sha(capture),points:capture.pointsSceneRelative.length};}
function humanDelta(initial,final){if(!initial||!final)return null;try{const origin=K.C.point(initial.sceneRelativeToProfileLocal,initial.positionSceneRelative),
  target=K.C.point(initial.sceneRelativeToProfileLocal,final.positionSceneRelative);return target.map((value,index)=>value-origin[index]);}catch{return null;}}
function compare(proposal,delta){if(!delta)return {status:'incomplete',reason:'human-final-rail-state-missing'};
 if(proposal?.status!=='candidate'||!Array.isArray(proposal.delta))return {status:'unresolved',reason:(proposal?.reasons||['engine-unresolved']).join(' '),humanDeltaLocal:delta};
 const error=proposal.delta.map((value,index)=>(value-delta[index])*1000);return {status:'comparable',humanDeltaLocal:delta,engineDeltaLocal:proposal.delta,
  errorMm:{longitudinal:round(error[0]),lateral:round(error[1]),vertical:round(error[2]),euclidean:round(Math.hypot(...error))}};}
function engineDescriptor(record,side){return {identity:record.identity,side,initialRail:record.beforeEstablished?.rails?.[side]||null,eligibility:record.geometryEligibility?.[side]||null};}
function evaluateRecord(record,clouds,engine){const descriptors=Object.fromEntries(SIDES.map(side=>[side,engineDescriptor(record,side)])),inputs={};
 /* Engine inputs and proposals are fully built before the human final is read below. */
 for(const side of SIDES)inputs[side]=descriptors[side].eligibility?.status==='comparable-candidate'?buildEngineInput(descriptors[side],clouds):
   {status:'excluded',reasons:descriptors[side].eligibility?.reasons||['record-not-qualified-by-v2-contract']};
 const pair=record.geometryEligibility?.pair?.status==='comparable-candidate'?buildPairInput(inputs.left,inputs.right):{status:'excluded',reasons:record.geometryEligibility?.pair?.reasons||['pair-not-qualified']};
 const proposals={left:null,right:null},engineErrors={};
 if(pair.status==='ready'){try{Object.assign(proposals,Geometry.proposeBoth(pair.capture,engine.parameters));}catch(error){engineErrors.pair=error.message;}}
 for(const side of SIDES)if(!proposals[side]&&inputs[side].status==='ready')try{proposals[side]=Geometry.propose(inputs[side].capture,side,engine.parameters);}catch(error){engineErrors[side]=error.message;}
 const humanFinal=record.humanFinalReference?.state||null,comparisons={};for(const side of SIDES)comparisons[side]=inputs[side].status==='ready'?
  compare(proposals[side],humanDelta(descriptors[side].initialRail,humanFinal?.rails?.[side])):{status:'excluded',reason:(inputs[side].reasons||[]).join(', ')};
 return {recordId:record.recordId,visitId:record.visitId,identity:K.completeIdentity(record.identity),visitRelation:record.visitRelation||null,humanLabel:record.observedLabelCandidate||null,
  referenceStatus:record.humanFinalReference?.status||'not-observed',eligibility:clone(record.geometryEligibility||{}),
  engineInput:{left:inputs.left.status==='ready'?{status:'ready',inputHash:inputs.left.inputHash,points:inputs.left.points,sourceChunkIds:inputs.left.capture.sourceChunkIds}:{status:'excluded',reasons:inputs.left.reasons},
   right:inputs.right.status==='ready'?{status:'ready',inputHash:inputs.right.inputHash,points:inputs.right.points,sourceChunkIds:inputs.right.capture.sourceChunkIds}:{status:'excluded',reasons:inputs.right.reasons},
   pair:pair.status==='ready'?{status:'ready',inputHash:pair.inputHash,points:pair.points,sourceChunkIds:pair.capture.sourceChunkIds}:{status:'excluded',reasons:pair.reasons}},
  proposal:clone(proposals),comparison:comparisons,engineErrors,serverConfirmationStatus:record.serverConfirmationStatus||'not-observed',
  safety:{humanFinalPositionsProvidedToEngine:false,nativeCommandSent:false,navigationAction:false},_visual:{inputs,humanFinal}};}
function aggregate(results){const comparable=side=>results.map(result=>result.comparison[side]).filter(item=>item.status==='comparable'),loss={};
 for(const result of results)for(const side of SIDES)for(const reason of result.engineInput[side].reasons||[])loss[reason]=(loss[reason]||0)+1;
 const errors={};for(const side of SIDES){const rows=comparable(side);errors[side]={lateral:stats(rows.map(row=>Math.abs(row.errorMm.lateral))),
  vertical:stats(rows.map(row=>Math.abs(row.errorMm.vertical))),euclidean:stats(rows.map(row=>row.errorMm.euclidean))};}
 return {visitsRead:results.length,usableByRail:Object.fromEntries(SIDES.map(side=>[side,results.filter(result=>result.engineInput[side].status==='ready').length])),
  usablePairs:results.filter(result=>result.engineInput.pair.status==='ready').length,comparableByRail:Object.fromEntries(SIDES.map(side=>[side,comparable(side).length])),
  unresolvedByRail:Object.fromEntries(SIDES.map(side=>[side,results.filter(result=>result.comparison[side].status==='unresolved').length])),errors,lossCauses:loss};}
function polyline(points,project){return points.map(point=>project(point).join(',')).join(' ');}
function renderSvg(result,side){const input=result._visual.inputs[side],final=result._visual.humanFinal?.rails?.[side];if(input?.status!=='ready')return null;
 const rail=input.capture.rails[side],points=input.chunks.flatMap(chunk=>(chunk.pointsProfileLocal||chunk.pointsSceneRelative.map(point=>K.C.point(rail.sceneRelativeToProfileLocal,point)))
  .filter((_,index)=>chunk.visibleByClipBoxes?.[index]===true)),
  contour=(rail.profileContours||[]).sort((a,b)=>(b.verticesSceneRelative?.length||0)-(a.verticesSceneRelative?.length||0))[0]?.verticesSceneRelative||[];
 const initial=contour.map(point=>K.C.point(rail.sceneRelativeToProfileLocal,point)),human=final?contour.map(point=>K.C.point(rail.sceneRelativeToProfileLocal,K.C.point(final.profileLocalToSceneRelative,K.C.point(rail.sceneRelativeToProfileLocal,point)))):[];
 const proposal=result.proposal[side]?.delta,proposed=proposal?initial.map(point=>point.map((value,index)=>value+proposal[index])):[];
 const yz=[...points,...initial,...human,...proposed].map(point=>[point[1],point[2]]).filter(point=>point.every(Number.isFinite));if(!yz.length)return null;
 const minY=Math.min(...yz.map(point=>point[0])),maxY=Math.max(...yz.map(point=>point[0])),minZ=Math.min(...yz.map(point=>point[1])),maxZ=Math.max(...yz.map(point=>point[1])),pad=.01;
 const project=point=>[40+(point[1]-minY+pad)/(maxY-minY+2*pad)*520,360-(point[2]-minZ+pad)/(maxZ-minZ+2*pad)*300];
 const dots=points.filter((_,index)=>index%Math.max(1,Math.floor(points.length/2500))===0).map(point=>{const [x,y]=project(point);return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.15"/>`;}).join('');
 const line=(rows,color)=>rows.length?`<polyline points="${polyline(rows,project)}" fill="none" stroke="${color}" stroke-width="2"/>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="410" viewBox="0 0 600 410"><rect width="600" height="410" fill="#111318"/><text x="24" y="25" fill="#fff" font-family="Arial" font-size="15">Cut ${result.identity.cut} · ${side==='left'?'gauche':'droit'} · repère profil initial</text><g fill="#67b7ff" opacity=".65">${dots}</g>${line(initial,'#aeb6c2')}${line(human,'#55d88a')}${line(proposed,'#ffb14e')}<g font-family="Arial" font-size="12"><text x="24" y="390" fill="#67b7ff">points exportés</text><text x="150" y="390" fill="#aeb6c2">profil initial</text><text x="260" y="390" fill="#55d88a">référence humaine candidate</text><text x="465" y="390" fill="#ffb14e">moteur</text></g></svg>`;}
function markdown(report){const m=report.metrics;return ['# Évaluation hors ligne du Mode Natif','',`Généré le ${report.generatedAt}. Le moteur ${report.engine.method} est exécuté sans ESV et sans recevoir la position humaine finale en entrée.`,'',
  '| Mesure | Gauche | Droit | Paire |','|---|---:|---:|---:|',`| Exemples qualifiés | ${m.usableByRail.left} | ${m.usableByRail.right} | ${m.usablePairs} |`,`| Comparaisons terminées | ${m.comparableByRail.left} | ${m.comparableByRail.right} | — |`,`| Rails non résolus | ${m.unresolvedByRail.left} | ${m.unresolvedByRail.right} | — |`,'',
  'Les confirmations serveur `not-observed` sont acceptées en mode Natif et ne sont pas comptées comme une erreur de collecte.','','## Limites','',...report.limits.map(limit=>'- '+limit),''].join('\n');}
function run(argv=process.argv.slice(2)){const args=parseArgs(argv),projectRoot=path.resolve(__dirname,'..');if(!args.input.length)throw Error('Au moins un --input est requis.');if(!args.output)throw Error('--output est requis.');
 const documents=args.input.map(file=>({file,sha256:sha(fs.readFileSync(file)),doc:JSON.parse(fs.readFileSync(file,'utf8'))})),geometryFile=path.resolve(__dirname,'../src/geometry.js'),coreFile=path.resolve(__dirname,'../vendor/capture-core.js');
 const engine={version:K.VERSION,method:Geometry.DEFAULTS.method,parameters:Geometry.DEFAULTS,buildHash:sha(Buffer.concat([fs.readFileSync(geometryFile),fs.readFileSync(coreFile)]))};
 const results=[];for(const source of documents){const clouds=new Map((source.doc.clouds||[]).map(cloud=>[cloud.chunkId||cloud.captureId,cloud]));for(const record of source.doc.records||[]){const result=evaluateRecord(record,clouds,engine);result.sourceFile=path.basename(source.file);results.push(result);}}
 const metrics=aggregate(results),report={format:'banane-native-offline-evaluation-v1',version:K.VERSION,generatedAt:new Date().toISOString(),
  sources:documents.map(source=>({file:path.basename(source.file),sha256:source.sha256,format:source.doc.format,version:source.doc.version,records:source.doc.records?.length||0,cloudObjects:source.doc.clouds?.length||0})),
  safety:{esvConnected:false,nativeCommandsSent:0,navigationActions:0,learningOrThresholdMutation:false,humanFinalPositionsProvidedToEngine:false},engine,
  results:results.map(({_visual,...result})=>result),metrics,limits:['Seuls les points à visibilité de découpe explicitement vérifiée sont transmis au moteur et représentés. Une capture sans preuve de découpe reste exclue.',
   'Une session ESV réelle courte avec la version corrigée reste obligatoire pour valider la couverture, les repères et la fluidité WebGL.',
   'Une référence native reste candidate tant qu’elle n’a pas été revue ; usableForTraining demeure faux.']};
 if(args.visualDir){fs.mkdirSync(args.visualDir,{recursive:true});let count=0;for(const result of results)for(const side of SIDES){if(count>=6)break;const svg=renderSvg(result,side);if(svg){const file=`cut-${result.identity.cut}-${side}.svg`;fs.writeFileSync(path.join(args.visualDir,file),svg);count++;}}report.visualProofs={directory:path.relative(projectRoot,args.visualDir),generated:count,scope:count?'qualified-exported-examples':'none-qualified-in-input'};}
 fs.mkdirSync(path.dirname(args.output),{recursive:true});fs.writeFileSync(args.output,JSON.stringify(report,null,2));if(args.markdown){fs.mkdirSync(path.dirname(args.markdown),{recursive:true});fs.writeFileSync(args.markdown,markdown(report));}
 return report;}
if(require.main===module){try{const report=run();console.log(JSON.stringify({output:parseArgs(process.argv.slice(2)).output,metrics:report.metrics,visualProofs:report.visualProofs||null},null,2));}catch(error){console.error(error.stack||error);process.exitCode=1;}}
module.exports={initialPoseReadIds,aggregate,buildEngineInput,buildPairInput,compare,evaluateRecord,humanDelta,parseArgs,renderSvg,run,stats};
