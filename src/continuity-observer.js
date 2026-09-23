(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./gauge.js'));
  else root.BananeContinuityObserver=factory(root.BananeCaptureCore,root.BananeGauge4);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,Gauge){
 'use strict';
 /* OBSERVATION « CONTINUITÉ » — cahier 4.8, amendement n°7, 4.7.7.
  *
  * La logique de l'opérateur, mesurée le 23/09 : les cuts précédents disent OÙ
  * chercher, les points disent où poser. Hors ligne, partir de la droite des
  * deux derniers cuts validés plutôt que de la pose ESV donne 192 cuts justes et
  * 3 faux sur 284, contre 161 et 11 (`tools/continuity-seed-study.cjs`).
  *
  * Ce module calcule, pour une visite Natif, la proposition que le moteur GCV1
  * AURAIT faite en partant de cette continuité. Il ne l'applique pas, ne
  * l'affiche pas et ne commande rien : le résultat est seulement consigné dans
  * l'enregistrement de la visite (`continuityObservation`), pour être jugé hors
  * ligne contre la pose finale de l'opérateur.
  *
  * Entrées, et seulement elles :
  *   - la pose ESV de départ de la visite (`beforeEstablished`) ;
  *   - les nuages de la visite capturés AUTOUR DE CETTE POSE, avant le premier
  *     changement de rail observé : ce que Banane a en main quand il doit
  *     proposer. La capture couvre ±0,4 m latéralement (`native-lidar.js`) ;
  *   - les poses finales des cuts voisins DÉJÀ validés par l'opérateur dans la
  *     session (ancres). La pose finale de la visite observée n'est jamais lue.
  *
  * Règles, tirées des §7.4 et 7.5 du n°7 : les ancres sont des validations de
  * l'opérateur, jamais des propositions du moteur (pas de chaînage) ; faute
  * d'ancre, aucune proposition n'est calculée (pas de retour à la pose ESV).
  * Aucune cible d'écartement : le moteur, son calage et sa garde d'écartement
  * sont appelés tels quels. */
 const DEFAULTS=Object.freeze({version:'continuity-observation-v1',gap:3,anchors:2});
 const SIDES=['left','right'];
 const RAIL_CHANGE=['rail-state-changed','rail-and-loaded-view-changed'];
 const mm=v=>Number.isFinite(v)?Math.round(v*1e4)/10:null;

 const poseEqual=(a,b,tolerance=1e-7)=>['railLocalToSceneRelative','profileLocalToSceneRelative'].every(name=>
   Array.isArray(a?.[name])&&Array.isArray(b?.[name])&&a[name].length===16&&b[name].length===16&&
   a[name].every((value,index)=>Number.isFinite(value)&&Number.isFinite(b[name][index])&&Math.abs(value-b[name][index])<=tolerance));
 /* Une ancre : validation FIABLE de l'opérateur, aux règles de référence du
  * banc (`tools/placement-lab.cjs`, referenceFor) qui ne dépendent pas de la
  * capture : une seule intention VALIDATE, état observé avant l'intention et
  * associé à elle, même cut, fraîcheur de 0 à 1 500 ms. Relecture
  * indépendante du 23/09 : une ancre moins exigeante laissait entrer des
  * états vieux de plusieurs secondes. */
 const FRESHNESS_MS=1500;
 const sameCut=(a,b)=>!!a&&!!b&&a.part===b.part&&a.cut===b.cut&&(a.frameId??null)===(b.frameId??null);
 function validated(record){
   const final=record?.humanFinalReference,state=final?.state,intents=record?.operatorIntents||[],intent=intents[0];
   if(record?.operatorIntent!=='VALIDATE'||intents.length!==1||record.multiIntent===true||intent?.intent!=='VALIDATE')return false;
   if(final.status!=='candidate-observed'||!SIDES.every(side=>(state?.rails?.[side]?.positionSceneRelative||[]).length===3))return false;
   const association=final.association||{};
   if(association.identityMatched===false||association.source==='cached-state-arrived-after-operator-input')return false;
   if(!sameCut(state.identity,record.identity)||!sameCut(intent.stateObservedBeforeInput?.identity,record.identity))return false;
   if(final.eventSeq!==intent.eventSeq||final.observedAt!==intent.observedAt)return false;
   const freshness=Date.parse(intent.observedAt)-Date.parse(state.capturedAt);
   return Number.isFinite(freshness)&&freshness>=0&&freshness<=FRESHNESS_MS;
 }
 /* Voisin utilisable : même partie, même repère de scène (`frameId`), autre
  * cut, à `gap` numéros au plus. */
 function near(identity,other,gap){
   return Number.isFinite(identity?.cut)&&Number.isFinite(other?.cut)&&identity.part===other.part&&
     (identity.frameId??null)===(other.frameId??null)&&other.cut!==identity.cut&&Math.abs(other.cut-identity.cut)<=gap;
 }
 /* Les ancres d'une visite parmi les visites ANTÉRIEURES de la session : même
  * partie, à `gap` numéros de cut au plus, la dernière validation de chaque cut,
  * puis les `anchors` cuts les plus proches (à égalité, le plus récent). Les
  * cuts peuvent être parcourus dans les deux sens : la droite extrapole ou
  * interpole selon le cas. */
 function selectAnchors(record,earlier,options={}){
   const cfg={...DEFAULTS,...options},byCut=new Map();
   for(const other of earlier||[]){
     if(!other||other.visitId===record.visitId||!(other.visitIndex<record.visitIndex))continue;
     if(!near(record.identity,other.identity,cfg.gap)||!validated(other))continue;
     const known=byCut.get(other.identity.cut);
     if(!known||other.visitIndex>known.visitIndex)byCut.set(other.identity.cut,other);
   }
   return [...byCut.values()].sort((a,b)=>Math.abs(a.identity.cut-record.identity.cut)-Math.abs(b.identity.cut-record.identity.cut)||b.visitIndex-a.visitIndex)
     .slice(0,cfg.anchors).map(other=>({visitId:other.visitId,visitIndex:other.visitIndex,part:other.identity.part,cut:other.identity.cut,
       positions:Object.fromEntries(SIDES.map(side=>[side,other.humanFinalReference.state.rails[side].positionSceneRelative.slice()]))}));
 }
 function fitAt(points){ // moindres carrés y = a + b·x, évalué en x = 0
   if(points.length===1)return points[0][1];
   let sx=0,sy=0,sxx=0,sxy=0;for(const [x,y] of points){sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;}
   const n=points.length,d=n*sxx-sx*sx,b=Math.abs(d)>1e-12?(n*sxy-sx*sy)/d:0;return (sy-b*sx)/n;
 }
 /* Prédiction d'un rail dans le repère profil de sa pose ESV : décalages
  * latéral et vertical (m) de la droite des ancres au droit du cut, et la
  * translation scène qui y amène la pose. */
 function predict(initial,anchors,side){
   const M=initial.sceneRelativeToProfileLocal,o=C.point(M,initial.positionSceneRelative);
   const q=anchors.map(a=>{const p=C.point(M,a.positions[side]);return [p[0]-o[0],p[1]-o[1],p[2]-o[2]];});
   const lateral=fitAt(q.map(p=>[p[0],p[1]])),vertical=fitAt(q.map(p=>[p[0],p[2]]));
   const P=initial.profileLocalToSceneRelative,a=C.point(P,o),b=C.point(P,[o[0],o[1]+lateral,o[2]+vertical]);
   return {lateral,vertical,translation:[b[0]-a[0],b[1]-a[1],b[2]-a[2]]};
 }
 function translated(rail,t){
   const r=JSON.parse(JSON.stringify(rail)),add=p=>[p[0]+t[0],p[1]+t[1],p[2]+t[2]];
   for(const k of ['railLocalToSceneRelative','profileLocalToSceneRelative'])r[k]=C.multiply(C.translation(t),r[k]);
   r.sceneRelativeToProfileLocal=C.inverse(r.profileLocalToSceneRelative);
   r.positionSceneRelative=add(r.positionSceneRelative);r.profileOriginSceneRelative=add(r.profileOriginSceneRelative);
   if(r.profileContours)r.profileContours=r.profileContours.map(k=>({...k,verticesSceneRelative:k.verticesSceneRelative.map(add)}));
   return r;
 }
 /* Premier changement de rail observé pendant la visite : au-delà, un nuage
  * pourrait avoir été capturé autour d'une pose posée par l'opérateur. */
 function cutoffOf(record){
   return (record.stateTransitions||[]).filter(t=>RAIL_CHANGE.includes(t.effect?.kind)&&typeof t.observedAt==='string')
     .map(t=>t.observedAt).sort()[0]||null;
 }
 /* Les points de la proposition, par côté : UNE capture de la visite — celle
  * qui apporte le plus de points —, ses blocs pris autour de la pose ESV de ce
  * rail (pose identique à la matrice près, contours compris) et achevés avant
  * le premier changement de rail. Seuls les points dont la visibilité par les
  * boîtes de découpe est prouvée (=== true) sont gardés, comme au banc, et un
  * point lu deux fois n'est compté qu'une fois : la relecture du 23/09 a montré
  * que deux captures d'une même visite se recouvrent (17 579 lignes pour 8 637
  * points distincts sur le cut 1198), ce qui gonfle les seuils du moteur. */
 function gatherInput(record,chunks){
   const before=record.beforeEstablished?.rails||{},cutoff=cutoffOf(record);
   const byCapture={left:new Map(),right:new Map()};
   for(const chunk of chunks||[]){
     if(!chunk?.pointsSceneRelative||!SIDES.includes(chunk.side)||chunk.visitId!==record.visitId)continue;
     if(!poseEqual(chunk.rail,before[chunk.side]))continue;
     const at=chunk.acquisition?.endedAt||chunk.capturedAt||null;
     if(cutoff&&!(typeof at==='string'&&at<cutoff))continue;
     const list=byCapture[chunk.side].get(chunk.captureId)||[];list.push(chunk);byCapture[chunk.side].set(chunk.captureId,list);
   }
   const points=[],visible=[],contours={},used=[],captureIds={},seen=new Set();let duplicates=0,frame=null,frameMismatch=false;
   for(const side of SIDES){
     const size=list=>list.reduce((n,c)=>n+c.pointsSceneRelative.length,0);
     const best=[...byCapture[side].entries()].sort((a,b)=>size(b[1])-size(a[1])||String(a[1][0].capturedAt).localeCompare(String(b[1][0].capturedAt)))[0];
     if(!best)continue;
     const [captureId,list]=best;captureIds[side]=captureId;
     const withContours=list.find(c=>c.rail?.profileContours?.length);if(withContours)contours[side]=withContours.rail.profileContours;
     for(const chunk of list){
       const cs=JSON.stringify(chunk.coordinateSystem??null);if(frame===null)frame=cs;else if(cs!==frame)frameMismatch=true;
       for(let i=0;i<chunk.pointsSceneRelative.length;i++){
         if(chunk.visibleByClipBoxes?.[i]!==true)continue;
         const p=chunk.pointsSceneRelative[i],key=p[0]+','+p[1]+','+p[2];
         if(seen.has(key)){duplicates++;continue;}
         seen.add(key);points.push(p);visible.push(true);
       }
       used.push(chunk.chunkId);
     }
   }
   return {points,visible,contours,chunkIds:used,captureIds,duplicatesRemoved:duplicates,frameMismatch,cutoffAt:cutoff};
 }
 function summarise(science,rails){
   const out={rails:{},applicable:false,gaugeMm:null,gaugeRejected:!!science?.summary?.pairGaugeRejected};
   for(const side of SIDES){
     const r=science?.rails?.[side];
     if(!r?.ok){out.rails[side]={status:'frame-failed',motif:'frame',reason:r?.reason||r?.error||null};continue;}
     const next=r.next,candidate=next.status==='candidate';
     out.rails[side]={status:next.status,motif:candidate?null:next.motif,
       delta:candidate?next.delta.slice():null,rawDelta:candidate&&next.rawDelta?next.rawDelta.slice():null,
       fromPredictionLateralMm:candidate?mm(next.delta[1]):null,fromPredictionVerticalMm:candidate?mm(next.delta[2]):null,
       partialFlankUsed:!!r.partialFlankUsed,s1Changed:!!r.s1Changed,conventionApplied:!!r.conventionCalibration?.applied};
   }
   out.applicable=SIDES.every(side=>out.rails[side].status==='candidate');
   if(Number.isFinite(science?.pairGauge?.predictedMm))out.gaugeMm=Math.round(science.pairGauge.predictedMm*10)/10;
   /* Position scène proposée : même construction que `core.js`, expectedPoses. */
   if(out.applicable)for(const side of SIDES){
     const P=rails[side].profileLocalToSceneRelative,w=C.point(P,out.rails[side].delta),o=C.point(P,[0,0,0]);
     out.rails[side].positionSceneRelative=rails[side].positionSceneRelative.map((v,i)=>v+w[i]-o[i]);
   }
   return out;
 }
 function block(fields){return {format:'banane-continuity-observation-v1',version:DEFAULTS.version,applied:false,displayed:false,...fields};}
 /* Pose de départ des deux rails : la pose ESV, translatée dans son plan de
  * profil jusqu'à la droite des ancres quand il y en a ; les contours sont
  * ceux de la capture retenue, prise à cette même pose ESV. */
 function startRails(record,input,anchors){
   const initial=record.beforeEstablished.rails,rails={},prediction={};
   for(const side of SIDES){
     const p=anchors?.length?predict(initial[side],anchors,side):{lateral:0,vertical:0,translation:[0,0,0]};
     prediction[side]={lateralMm:mm(p.lateral),verticalMm:mm(p.vertical)};
     rails[side]=translated({...initial[side],profileContours:input.contours[side]},p.translation);
   }
   return {rails,prediction};
 }
 /* Le moteur GCV1 tel qu'il est chargé (`gcv1-shadow.js`) : calage, flanc
  * partiel et garde d'écartement compris. Aucun paramètre n'est changé. */
 function proposeFrom(Shadow,record,input,rails,clock=()=>Date.now()){
   const t0=clock();
   const science=Shadow.scientificProposeBoth({format:'banane-continuity-observation-input-v1',identity:record.identity,rails,
     pointsSceneRelative:input.points,visibleByClipBoxes:input.visible,sourceChunkIds:input.chunkIds});
   return {...summarise(science,rails),engineMs:Math.round(clock()-t0)};
 }
 function inputSummary(input){
   return {cutoffAt:input.cutoffAt,captureIds:input.captureIds,chunkIds:input.chunkIds,points:input.points.length,duplicatesRemoved:input.duplicatesRemoved};
 }
 /* L'observation d'une visite : rend le bloc à consigner, quel que soit le
  * cas ; un calcul impossible dit pourquoi. Seul le départ par continuité est
  * calculé ici : le témoin depuis la pose ESV se rejoue hors ligne sur la même
  * entrée (`tools/continuity-seed-study.cjs --mode observer`), ce qui divise
  * par deux le temps pris au service worker. L'écart à la prédiction
  * (`fromPredictionLateralMm`) permet d'évaluer hors ligne toute garde de
  * continuité, 30 mm compris. */
 function observe({record,anchors,chunks,Shadow,now=()=>new Date().toISOString(),clock=()=>Date.now()}){
   const base={computedAt:now(),gap:DEFAULTS.gap,anchors:(anchors||[]).map(a=>({visitId:a.visitId,visitIndex:a.visitIndex,part:a.part,cut:a.cut}))};
   if(!anchors?.length)return block({...base,status:'no-anchor'});
   if(!SIDES.every(side=>record.beforeEstablished?.rails?.[side]?.sceneRelativeToProfileLocal))return block({...base,status:'no-initial-pose'});
   const input=gatherInput(record,chunks),common={...base,input:inputSummary(input)};
   if(input.frameMismatch)return block({...common,status:'frame-mismatch'});
   if(!SIDES.every(side=>input.contours[side])||!input.points.length)
     return block({...common,status:'no-points',reason:'aucune capture autour de la pose ESV de chaque rail avant le premier geste'});
   const {rails,prediction}=startRails(record,input,anchors),state=Shadow.state?.()||{};
   const engine={contractId:state.contract?.id||null,geometrySha256:state.contract?.geometrySha256||null,
     partialFlank:state.partialFlank??null,convention:state.convention?state.conventionVersion:false};
   return block({...common,status:'computed',prediction,engine,fromContinuity:proposeFrom(Shadow,record,input,rails,clock)});
 }
 return {DEFAULTS,FRESHNESS_MS,validated,near,selectAnchors,fitAt,predict,translated,cutoffOf,gatherInput,startRails,proposeFrom,observe};
});
