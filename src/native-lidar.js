/* Passive, read-only LiDAR sampler for Mode Natif.
 * It never requests nodes, changes the camera, selects a rail or navigates.
 */
(function(root,factory){
 const api=factory(typeof module==='object'?require('../vendor/capture-core.js'):root.BananeCaptureCore,
  typeof module==='object'?require('../vendor/lidar.js'):root.BananeLidar);
 if(typeof module==='object')module.exports=api;else root.BananeNativeLidar4=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C,L){
 'use strict';
 const SIDES=['left','right'],finite=Number.isFinite;
 const DEFAULTS=Object.freeze({bounds:[.5,.4,.3],usefulBounds:[.5,.18,.10],maxNodes:512,maxPointsPerRail:50000,
  maxInspected:500000,maxMillis:1800,yieldEvery:2048,probeCount:33,checkpointPoints:2048,
  coverage:{minimumPoints:128,minimumUsefulPoints:64,minimumLongitudinalBins:6,minimumLongitudinalSpan:.4}});
 const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
 const nowIso=()=>new Date().toISOString();
 const inBox=(point,bounds)=>point.every((value,index)=>Math.abs(value)<=bounds[index]);
 const clone=value=>JSON.parse(JSON.stringify(value));
 function draw(node){
  const index=node.geometry.index?C.attribute(node.geometry.index):null,start=Math.max(0,Math.floor(node.drawRange.start||0));
  const total=index?index.count:node.attribute.count,end=Math.min(total,finite(node.drawRange.count)?start+node.drawRange.count:total);
  return {index,indexSource:node.geometry.index??null,start,end,count:Math.max(0,end-start)};
 }
 function profileLines(rail,origin){
  const out=[],todo=[rail.profile],seen=new Set();
  while(todo.length){const item=todo.pop();if(!item||seen.has(item))continue;seen.add(item);if(seen.size>1000)throw Error('Profil 3D trop volumineux.');
   if(['Line','LineLoop','LineSegments'].includes(item.type)&&item.geometry?.attributes?.position){const attribute=C.attribute(item.geometry.attributes.position);
    if(attribute.count>20000)throw Error('Contour de profil trop volumineux.');const matrix=C.rebase(C.worldMatrix(item),origin),vertices=[];
    for(let i=0;i<attribute.count;i++)vertices.push(C.point(matrix,attribute.point(i)));out.push({type:item.type,verticesSceneRelative:vertices});}
   todo.push(...(item.children||[]));}
  return out;
 }
 function railFrame(rail,origin){return {...C.serialRail(rail,origin),profileContours:profileLines(rail,origin)};}
 function matrixValid(frame){
  try{const identity=C.multiply(frame.profileLocalToSceneRelative,frame.sceneRelativeToProfileLocal),error=Math.max(...identity.map((value,index)=>Math.abs(value-C.identity()[index])));
   return {valid:error<=1e-6,maxIdentityError:error};}catch(error){return {valid:false,maxIdentityError:null,reason:error.message};}
 }
 function normalizeTermination(error){
  const message=error?.message||String(error),code=error?.code||(
   /^Cible différente/.test(message)?'TARGET_CHANGED':
   /rail.*changed|rails-changed|state-changed/i.test(message)?'RAIL_STATE_CHANGED':
   /view.*changed|caméra.*changé|nœuds.*changé/i.test(message)?'VIEW_CHANGED':
   /cancel|inactive|stopp/i.test(message)?'COLLECTOR_STOPPED':'READ_ERROR');
  return {code,reason:message,observedAt:nowIso()};
 }
 /* V4.5-R — accumulateur incrémental de couverture.
  *
  * `coverage()` recalcule filter+map+Set+min/max sur TOUT l'historique. Il était
  * appelé tous les 128 points tant qu'aucun snapshot n'était qualifié, donc en
  * O(n²) précisément dans les cas qui ne se qualifient jamais — ceux qui
  * dominent les pertes (`longitudinal-coverage-insufficient`). Mesure sur banc :
  * points x16 -> temps x75. Le budget de lecture était mangé par l'évaluation
  * de la couverture au lieu de servir à lire des points.
  *
  * L'accumulateur tient les mêmes agrégats en O(1) par point. Toute la capture
  * en dérive désormais — déclenchement précoce, checkpoint et évaluation finale
  * — ce qui supprime aussi les deux tampons qui conservaient chaque point. */
 function coverageAccumulator(settings){
  const half=settings.usefulBounds[0],step=2*half/10,c=settings.coverage;
  return {count:0,useful:0,bins:new Set(),minX:Infinity,maxX:-Infinity,
   add(point){this.count++;if(!inBox(point,settings.usefulBounds))return;this.useful++;
    const x=point[0];this.bins.add(Math.max(0,Math.min(9,Math.floor((x+half)/step))));
    if(x<this.minX)this.minX=x;if(x>this.maxX)this.maxX=x;},
   qualifies(){return this.count>=c.minimumPoints&&this.useful>=c.minimumUsefulPoints&&
    this.bins.size>=c.minimumLongitudinalBins&&(this.useful?this.maxX-this.minX:0)>=c.minimumLongitudinalSpan;}};
 }
 /* Évaluation à partir des agrégats. `coverage()` délègue ici après avoir
  * alimenté un accumulateur : les deux chemins partagent le même code, donc
  * l'équivalence est vraie par construction et non par recopie de critères. */
 function coverageFrom(acc,settings,transform,associationStatus,termination){
  const span=acc.useful?acc.maxX-acc.minX:0,c=settings.coverage,reasons=[];
  if(acc.count<c.minimumPoints)reasons.push('roi-point-count-below-minimum');
  if(acc.useful<c.minimumUsefulPoints)reasons.push('engine-useful-point-count-below-minimum');
  if(acc.bins.size<c.minimumLongitudinalBins)reasons.push('longitudinal-coverage-insufficient');
  if(span<c.minimumLongitudinalSpan)reasons.push('longitudinal-span-insufficient');
  if(!transform.valid)reasons.push('transform-invalid');
  if(associationStatus!=='same-target-and-rail-pose')reasons.push('capture-reference-association-unverified');
  if(termination&&['TARGET_CHANGED','RAIL_STATE_CHANGED','VIEW_CHANGED','COLLECTOR_STOPPED','READ_ERROR','SOURCE_CHANGED','CLIP_CHANGED','CHECKPOINT_FAILED'].includes(termination.code))
   reasons.push('capture-interrupted-before-stable-boundary');
  return {status:reasons.length?'insufficient':'qualified-candidate',pointsInRoi:acc.count,pointsInEngineUsefulRoi:acc.useful,
   longitudinalBins:acc.bins.size,longitudinalSpan:span,criteria:clone(c),exclusionReasons:[...new Set(reasons)]};
 }
 function coverage(points,settings,transform,associationStatus,termination){
  const acc=coverageAccumulator(settings);for(const point of points)acc.add(point);
  return coverageFrom(acc,settings,transform,associationStatus,termination);
 }
/* REJET PRÉALABLE — boîte englobante de la ROI dans l'espace BRUT du nœud.
 *
 * Mesuré sur le lot du 22/09 : le lecteur lit un nœud Potree d'environ 39 000
 * points par capture et n'en retient que 2 %. Les 98 % restants coûtaient
 * chacun deux à trois produits matrice-vecteur AVANT d'être reconnus hors ROI —
 * et 92 % des captures sont interrompues par l'opérateur, pas par leur budget.
 * La fenêtre utile était donc dépensée à transformer des points voués au rebut.
 *
 * Les huit coins de la ROI, exprimée en repère profil, sont ramenés ici par la
 * transformation inverse ; on en prend les extrêmes. Tout point hors de cette
 * boîte est hors ROI AVEC CERTITUDE : la boîte englobe le parallélépipède image,
 * donc elle ne peut pas écarter un point que `inBox` aurait accepté. Le test
 * coûte six comparaisons au lieu d'une transformation.
 *
 * Si l'inverse n'existe pas ou n'est pas fini, on rend `null` et le chemin
 * complet reprend pour ce côté : jamais de rejet sur une géométrie douteuse. */
 function rawRoiBounds(transform,bounds){
  let inverse;try{inverse=C.inverse(transform);}catch(error){return null;}
  if(!Array.isArray(inverse)||!inverse.every(finite))return null;
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let corner=0;corner<8;corner++){
   const point=C.point(inverse,[(corner&1?1:-1)*bounds[0],(corner&2?1:-1)*bounds[1],(corner&4?1:-1)*bounds[2]]);
   if(!point.every(finite))return null;
   for(let axis=0;axis<3;axis++){if(point[axis]<lo[axis])lo[axis]=point[axis];if(point[axis]>hi[axis])hi[axis]=point[axis];}
  }
  return {lo,hi};
 }
 function prepareNode(node,origin,frames,bounds,index,probeCount){
  const model=C.rebase(node.world,origin),range=draw(node),transforms=Object.fromEntries(Object.entries(frames).map(([side,frame])=>[side,C.multiply(frame.sceneRelativeToProfileLocal,model)]));
  const sampleIds=new Set();for(let i=0;i<Math.min(probeCount,range.count);i++)sampleIds.add(range.start+Math.floor(i*(range.count-1)/Math.max(1,Math.min(probeCount,range.count)-1)));
  const probeHits=Object.fromEntries(Object.keys(frames).map(side=>[side,0])),minimumDistance=Object.fromEntries(Object.keys(frames).map(side=>[side,Infinity]));let probesRead=0;
  for(const drawIndex of sampleIds){const sourceIndex=range.index?range.index.get(drawIndex,0):drawIndex;if(!Number.isInteger(sourceIndex)||sourceIndex<0||sourceIndex>=node.attribute.count)continue;
   const raw=node.attribute.point(sourceIndex);if(!raw.every(finite))continue;probesRead++;
   for(const [side,transform] of Object.entries(transforms)){const local=C.point(transform,raw),distance=Math.hypot(...local.map((value,axis)=>value/bounds[axis]));
    minimumDistance[side]=Math.min(minimumDistance[side],distance);if(inBox(local,bounds))probeHits[side]++;}}
  const direct=Object.values(probeHits).reduce((n,value)=>n+value,0),distance=Math.min(...Object.values(minimumDistance));
  const roiBounds=Object.fromEntries(Object.entries(transforms).map(([side,transform])=>[side,rawRoiBounds(transform,bounds)]));
  return {node,index,model,range,transforms,roiBounds,probeHits,minimumDistance,probesRead,priority:[direct?0:1,distance,range.count,index],
   report:{nodeId:node.id,source:node.source,pointsAvailable:range.count,diagnosticProbesRead:probesRead,probeRoiHits:probeHits,
    minimumNormalizedDistance:Object.fromEntries(Object.entries(minimumDistance).map(([side,value])=>[side,finite(value)?value:null])),pointsRead:0,pointsTransformed:0,
    retainedByRail:Object.fromEntries(Object.keys(frames).map(side=>[side,0])),status:'not-read'}};
 }
 function sourceUnchanged(entry){
  const node=entry.node;
  return node.obj.geometry===node.geometry&&node.geometry.attributes.position===node.position&&node.attribute.unchanged()&&
   (node.geometry.index??null)===entry.range.indexSource&&(!entry.range.index||entry.range.index.unchanged())&&
   C.matrix(node.obj.matrixWorld).every((value,index)=>value===node.world[index]);
 }
 async function capture(options){
  const settings={...DEFAULTS,...options,bounds:options.bounds||DEFAULTS.bounds,usefulBounds:options.usefulBounds||DEFAULTS.usefulBounds,
   coverage:{...DEFAULTS.coverage,...options.coverage}},clock=options.now||Date.now,pause=options.pause||(()=>new Promise(resolve=>setTimeout(resolve,0))),guard=options.guard||(()=>{}),
   onCheckpoint=options.onCheckpoint||(()=>Promise.resolve()),captureId=options.captureId||uid(),startedAt=nowIso(),started=clock(),identity=clone(options.meta?.identity||{}),
   railInputs=Object.fromEntries(SIDES.filter(side=>options.rails?.[side]).map(side=>[side,options.rails[side]])),sides=Object.keys(railInputs),trace={pointsAvailableInBuffers:0,
    diagnosticProbesRead:0,pointsRead:0,pointsTransformed:0,pointsRetainedInRoi:0,pointsCheckpointed:0,pointsSaved:0,pointsExported:0,
    perRail:Object.fromEntries(sides.map(side=>[side,{pointsRetainedInRoi:0,pointsCheckpointed:0,pointsSaved:0,pointsExported:0}]))},
   chunks=Object.fromEntries(sides.map(side=>[side,{scene:[],local:[],sources:[],visible:[],firstReadAt:null}])) ,
   /* V4.5-R : ces deux tampons ne servaient que par leur taille et pour la
    * couverture. On garde des compteurs et l'accumulateur : jusqu'à 50 000
    * points x 3 coordonnées par rail et par capture cessent d'être conservés. */
   railCounts=Object.fromEntries(sides.map(side=>[side,0])),firstSnapshots=Object.fromEntries(sides.map(side=>[side,null])),emittedIds=Object.fromEntries(sides.map(side=>[side,[]])),
   nextCoverageCheck=Object.fromEntries(sides.map(side=>[side,settings.coverage.minimumUsefulPoints]));
  const result={format:'banane-native-lidar-capture-v2',version:options.meta?.version||null,captureId,visitId:options.visitId||options.meta?.visitId||null,
   identity,startedAt,capturedAt:startedAt,completedAt:null,captureMode:'native-current-loaded-view-only',source:'native-passive-observation',viewObservation:clone(options.viewObservation||null),
   coordinateSystem:{name:'scene-relative',matrixLayout:'column-major; column vectors',units:'metres-observed-not-independently-calibrated',
    physicalCalibrationStatus:'not-independently-verified',frameId:identity.frameId??null},
   limits:{maxNodes:settings.maxNodes,maxPointsPerRail:settings.maxPointsPerRail,maxInspected:settings.maxInspected,maxMillis:settings.maxMillis,yieldEvery:settings.yieldEvery,
    probeCount:settings.probeCount,checkpointPoints:settings.checkpointPoints},trace,sourceNodes:[],railObservations:{},termination:null,status:'starting',warnings:[]};
  if(!sides.length){result.status='unavailable';result.termination={code:'NO_RAIL_OBSERVED',reason:'no-rail-state-available',observedAt:nowIso()};result.completedAt=nowIso();return result;}
  let inventory,frames={};
  try{guard();inventory=L.inventory(options.viewer);if(inventory.nodes.length>settings.maxNodes){const error=Error('loaded-node-limit-exceeded');error.code='RESOURCE_NODE_LIMIT';throw error;}
   for(const side of sides)frames[side]=railFrame(railInputs[side],options.origin);
  }catch(error){result.termination=normalizeTermination(error);result.status=result.termination.code==='RESOURCE_NODE_LIMIT'?'partial-resource-limit':'unavailable';result.completedAt=nowIso();return result;}
  const transformChecks=Object.fromEntries(sides.map(side=>[side,matrixValid(frames[side])]));
  // Agrégats incrémentaux + conditions constantes de la capture, évaluées une fois.
  const accumulators=Object.fromEntries(sides.map(side=>[side,coverageAccumulator(settings)]));
  /* V4.5 — perte au clipping, mesurée par bande.
   *
   * Mesure du 15/09 sur deux sessions réelles : le flanc interne est le verrou
   * du moteur (médiane 0 à 1 point observé pour un seuil de 6), et le clipping
   * en retire les deux tiers — 16 chunks atteignaient le seuil avec clipping,
   * 47 sans. On ne contourne PAS le filtre : un point non visible peut
   * appartenir à un autre cut et contaminerait l'ajustement. On compte ce qu'il
   * coûte, pour que la cause soit visible dans chaque export au lieu de se
   * redécouvrir par une enquête hors ligne. */
  const clipLoss=Object.fromEntries(sides.map(side=>[side,
   {inRoiKept:0,inRoiDropped:0,nearTopKept:0,nearTopDropped:0,nearFaceKept:0,nearFaceDropped:0}]));
  const NEAR_TOP=settings.usefulBounds[2],NEAR_FACE_LOW=0.009,NEAR_FACE_HIGH=0.034;
  const coverageBase=Object.fromEntries(sides.map(side=>[side,
   transformChecks[side].valid===true&&(options.associationByRail?.[side]||'same-target-and-rail-pose')==='same-target-and-rail-pose']));
  let prepared=[];
  try{for(const [index,node] of inventory.nodes.entries()){guard();prepared.push(prepareNode(node,options.origin,frames,settings.bounds,index,settings.probeCount));
    if((index+1)%8===0){await pause();guard();}}}
  catch(error){const normalized=normalizeTermination(error);result.termination=normalized.code==='READ_ERROR'?{...normalized,code:'INVALID_TRANSFORM_OR_BUFFER'}:normalized;
   result.status=result.termination.code==='INVALID_TRANSFORM_OR_BUFFER'?'invalid-transform-or-buffer':'partial-interrupted';result.completedAt=nowIso();return result;}
  prepared.sort((a,b)=>{for(let i=0;i<a.priority.length;i++)if(a.priority[i]!==b.priority[i])return a.priority[i]-b.priority[i];return 0;});
  const preparedByIndex=new Map(prepared.map(entry=>[entry.index,entry]));
  prepared.forEach((entry,rank)=>{entry.report.priorityRank=rank;result.sourceNodes.push(entry.report);trace.pointsAvailableInBuffers+=entry.range.count;trace.diagnosticProbesRead+=entry.probesRead;});
  const clippingByCloud=inventory.clouds.map((cloud,index)=>L.clipSnapshot(options.viewer.scene.pointclouds[index],options.origin,options.enums||{}));
  result.clouds=inventory.clouds.map((cloud,index)=>({...clone(cloud),clipping:clippingByCloud[index]}));
  let termination=null,chunkIndex=0,allRead=true;
  async function checkpoint(force=false){
   for(const side of sides){const buffer=chunks[side];if(!buffer.scene.length||!force&&buffer.scene.length<settings.checkpointPoints)continue;
    // No old checkpoint is retroactively revoked by a later interruption. Only
    // the segment currently in memory must still agree with its source/view.
    guard();const sources=[...new Set(buffer.sources.map(source=>source[0]))];
    for(const index of sources)if(!sourceUnchanged(preparedByIndex.get(index))){const error=Error('source-changed-before-checkpoint');error.code='SOURCE_CHANGED';throw error;}
    if(inventory.clouds.some((_,index)=>JSON.stringify(clippingByCloud[index])!==JSON.stringify(L.clipSnapshot(options.viewer.scene.pointclouds[index],options.origin,options.enums||{})))){
     const error=Error('clip-state-changed-before-checkpoint');error.code='CLIP_CHANGED';throw error;}
    const acquiredThroughAt=nowIso(),visibleCoverage=coverageFrom(accumulators[side],settings,transformChecks[side],options.associationByRail?.[side]||'same-target-and-rail-pose',null);
    const chunk={format:'banane-native-lidar-chunk-v1',version:result.version,chunkId:`${captureId}:${side}:${chunkIndex++}`,captureId,visitId:result.visitId,side,
     identity:clone(identity),capturedAt:acquiredThroughAt,viewObservation:clone(result.viewObservation),rail:clone(frames[side]),coordinateSystem:clone(result.coordinateSystem),
     acquisition:{startedAt:buffer.firstReadAt||startedAt,endedAt:acquiredThroughAt,emittedAt:nowIso(),sourceStatus:'reference-version-and-matrix-stable-through-checkpoint',
      sourceNodes:sources.map(index=>({nodeId:preparedByIndex.get(index).report.nodeId,source:preparedByIndex.get(index).report.source,
       positionVersion:preparedByIndex.get(index).node.position.version??null,positionDataVersion:preparedByIndex.get(index).node.position.data?.version??null})),
      clipStatus:'unchanged-through-checkpoint'},
     qualification:{format:'banane-native-rail-snapshot-v1',criteriaVersion:'native-visible-roi-v1',status:visibleCoverage.status,
      acquisitionStartedAt:startedAt,acquiredThroughAt,coverage:visibleCoverage,transform:clone(transformChecks[side]),
      associationStatus:options.associationByRail?.[side]||'same-target-and-rail-pose',sourceStatus:'reference-version-and-matrix-stable-through-checkpoint',
      clipStatus:clippingByCloud.every(clip=>clip.classificationAvailable)?'verified-classifiable':'unverified',
      coordinateSystem:clone(result.coordinateSystem),chunkIds:[...emittedIds[side],`${captureId}:${side}:${chunkIndex-1}`]},
     pointsSceneRelative:buffer.scene.splice(0),pointsProfileLocal:buffer.local.splice(0),pointSources:buffer.sources.splice(0),visibleByClipBoxes:buffer.visible.splice(0)};
    chunk.qualification.exclusionReasons=chunk.qualification.coverage.exclusionReasons.slice();
    if(chunk.qualification.clipStatus!=='verified-classifiable'){
     chunk.qualification.status='insufficient';chunk.qualification.exclusionReasons.push('clip-state-not-classifiable');}
    const receipt=await onCheckpoint(chunk);emittedIds[side].push(chunk.chunkId);buffer.firstReadAt=null;
    if(chunk.qualification.status==='qualified-candidate'&&!firstSnapshots[side])firstSnapshots[side]={...clone(chunk.qualification),snapshotId:chunk.chunkId,
      storageConfirmedAt:receipt?.storageConfirmedAt||null,chunkIds:emittedIds[side].slice()};
    trace.pointsCheckpointed+=chunk.pointsSceneRelative.length;trace.perRail[side].pointsCheckpointed+=chunk.pointsSceneRelative.length;}}
  scan:for(const entry of prepared){entry.report.status='reading';
   try{guard();if(!sourceUnchanged(entry)){const error=Error('source-buffer-or-matrix-changed');error.code='SOURCE_CHANGED';throw error;}
    let sinceYield=0;
    for(let drawIndex=entry.range.start;drawIndex<entry.range.end;drawIndex++){
     if(trace.pointsRead>=settings.maxInspected||clock()-started>=settings.maxMillis||sides.every(side=>railCounts[side]>=settings.maxPointsPerRail)){
      termination={code:'RESOURCE_LIMIT',reason:trace.pointsRead>=settings.maxInspected?'maximum-inspected-reached':clock()-started>=settings.maxMillis?'maximum-millis-reached':'maximum-retained-reached',observedAt:nowIso()};
      entry.report.status='partial-resource-limit';allRead=false;break scan;}
     if(sinceYield>=settings.yieldEvery){await checkpoint();await pause();guard();if(!sourceUnchanged(entry)){const error=Error('source-buffer-or-matrix-changed');error.code='SOURCE_CHANGED';throw error;}sinceYield=0;}
     const sourceIndex=entry.range.index?entry.range.index.get(drawIndex,0):drawIndex;if(!Number.isInteger(sourceIndex)||sourceIndex<0||sourceIndex>=entry.node.attribute.count)continue;
     trace.pointsRead++;entry.report.pointsRead++;sinceYield++;const raw=entry.node.attribute.point(sourceIndex);if(!raw.every(finite))continue;
     /* Six comparaisons écartent la grande majorité des points avant toute
      * transformation. Un côté sans boîte fiable force le chemin complet. */
     let candidate=false;
     for(const side of sides){
      if(railCounts[side]>=settings.maxPointsPerRail)continue;
      const box=entry.roiBounds?.[side];
      if(!box){candidate=true;break;}
      if(raw[0]>=box.lo[0]&&raw[0]<=box.hi[0]&&raw[1]>=box.lo[1]&&raw[1]<=box.hi[1]
       &&raw[2]>=box.lo[2]&&raw[2]<=box.hi[2]){candidate=true;break;}
     }
     if(!candidate)continue;
     /* `pointScene` ne sert QUE si un rail retient le point : il est donc
      * calculé au premier rail qui passe, et `pointsTransformed` compte
      * désormais les transformations réellement utiles. */
     let pointScene=null;
     for(const side of sides){if(railCounts[side]>=settings.maxPointsPerRail)continue;const local=C.point(entry.transforms[side],raw);if(!inBox(local,settings.bounds))continue;
      if(pointScene===null){pointScene=C.point(entry.model,raw);trace.pointsTransformed++;entry.report.pointsTransformed++;}
      const visible=L.boxVisible(clippingByCloud[entry.node.cloudIndex],pointScene);
      chunks[side].firstReadAt??=nowIso();chunks[side].scene.push(pointScene);chunks[side].local.push(local);chunks[side].sources.push([entry.index,sourceIndex]);chunks[side].visible.push(visible);
      const perte=clipLoss[side];   // ne pas nommer L : L est le lecteur LiDAR du module
      if(visible===true){accumulators[side].add(local);perte.inRoiKept++;}else perte.inRoiDropped++;
      /* Bandes approchées dans le repère local : le dessus autour de z=0, le
       * flanc juste en dessous. Approximation assumée — la bande exacte du
       * moteur dépend de la position qu'il retient, inconnue ici. Suffisant
       * pour chiffrer ce que le filtre retire là où ça compte. */
      if(Math.abs(local[1])<=settings.usefulBounds[1]){
       const z=local[2];
       if(Math.abs(z)<=0.012){if(visible===true)perte.nearTopKept++;else perte.nearTopDropped++;}
       else if(z<-NEAR_FACE_LOW&&z>-NEAR_FACE_HIGH){if(visible===true)perte.nearFaceKept++;else perte.nearFaceDropped++;}
      }
      railCounts[side]++;entry.report.retainedByRail[side]++;trace.pointsRetainedInRoi++;trace.perRail[side].pointsRetainedInRoi++;}
     // Persist the first complete visible-ROI snapshot promptly. A later rail
     // move or target change can only interrupt enrichment, not this copy.
     // Mêmes instants de déclenchement qu'avant (seuil + pas de 128), mais la
     // décision est désormais O(1) au lieu de rebalayer tout l'historique.
     let snapshotReady=false;for(const side of sides)if(!firstSnapshots[side]&&chunks[side].scene.length&&accumulators[side].count>=nextCoverageCheck[side]){
       nextCoverageCheck[side]=accumulators[side].count+128;
       if(coverageBase[side]&&accumulators[side].qualifies())snapshotReady=true;}
     if(snapshotReady)await checkpoint(true);
    }
    if(entry.report.status==='reading')entry.report.status='complete';
   }catch(error){termination=normalizeTermination(error);entry.report.status='partial-'+termination.code.toLowerCase().replaceAll('_','-');allRead=false;break;}}
  try{await checkpoint(true);}catch(error){termination=normalizeTermination(error);if(termination.code==='READ_ERROR')termination.code='CHECKPOINT_FAILED';allRead=false;}
  result.termination=termination;result.completedAt=nowIso();result.status=termination?(termination.code==='RESOURCE_LIMIT'?'partial-resource-limit':'partial-interrupted'):(allRead?'complete-loaded-buffers':'partial');
  for(const side of sides){const associationStatus=options.associationByRail?.[side]||'same-target-and-rail-pose',assessment=coverageFrom(accumulators[side],settings,transformChecks[side],associationStatus,termination);
   result.railObservations[side]={side,rail:clone(frames[side]),capturedAt:startedAt,completedAt:result.completedAt,associationStatus,transform:transformChecks[side],
    pointsRetained:railCounts[side],pointsVisibleForEngine:accumulators[side].count,coverage:assessment,geometryInputStatus:assessment.status==='qualified-candidate'?'qualified-candidate':'unavailable-or-insufficient',
    exclusionReasons:assessment.exclusionReasons,checkpointedPoints:trace.perRail[side].pointsCheckpointed,
    clipLoss:{...clipLoss[side],
     note:'Points retirés par le filtre de visibilité, par bande. Le flanc interne conditionne la proposition du moteur (minFace).'},
    firstQualifiedSnapshot:firstSnapshots[side]?clone(firstSnapshots[side]):null};}
  if(!trace.pointsRetainedInRoi&&result.status==='complete-loaded-buffers')result.status='read-complete-empty';
  else if(!trace.pointsRetainedInRoi&&termination?.code==='RESOURCE_LIMIT')result.status='partial-resource-limit-empty';
  else if(!trace.pointsRetainedInRoi&&result.status==='partial-interrupted')result.status='partial-interrupted-empty';
  result.warnings.push('La qualification décrit une entrée candidate pour analyse hors ligne, jamais une promotion automatique pour entraînement.');
  return result;
 }
 const api={DEFAULTS,capture,coverage,coverageFrom,coverageAccumulator,normalizeTermination};
 /* Exposé pour les essais : la propriété conservative du rejet préalable se
  * vérifie directement, sans passer par une capture complète. */
 if(typeof module==='object'&&module.exports)Object.defineProperty(api,'_test',{value:{rawRoiBounds,inBox}});
 return api;
});
