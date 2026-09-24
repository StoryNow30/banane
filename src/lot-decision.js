(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./gauge.js'),
    require('./geometry-candidate-v1.js'),require('./placement-convention.js'),require('./continuity-observer.js'));
  else root.BananeLotDecision=factory(root.BananeCaptureCore,root.BananeGauge4,root.BananeGeometry3,root.BananePlacementConvention,root.BananeContinuityObserver);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,Gauge,Candidate,Convention,O){
 'use strict';
 /* DÉCIDER SUR LE LOT — cahier 4.8, amendement n°9 (D-039).
  *
  * Pour un cut du lot Pilote, avec les cuts DÉJÀ passés du même lot :
  *   - un cut que le moteur applique est comparé à la droite de ses voisins
  *     appliqués (garde de continuité, 30 mm) ; confirmé, il devient ancre ;
  *   - un cut que le moteur diffère est repris depuis la position prédite par
  *     la voie : moteur relancé depuis cette position (fenêtre déplacée), puis,
  *     à défaut, CHOIX, pour chaque rail, du minimum local de la grille du
  *     moteur que la voie prédit — seul à 15 mm latéraux et 20 mm verticaux, au
  *     moins 15 points de dessus et 3 de flanc sous le gabarit, calage de
  *     convention —, les deux rails exigés, écartement dans le contrat en
  *     admissibilité seulement.
  * Le critère de choix est la position du champignon prédite par la voie,
  * jamais un écartement. Mesuré hors ligne : 48 cuts choisis, 30 jugés, 0 faux
  * (`audit/lot-choice-2026-09-23.json`).
  *
  * Ce module ne commande rien : en 4.7.8, son résultat est seulement consigné
  * dans le journal du Pilote. */
 const DEFAULTS=Object.freeze({version:'lot-decision-v1',gap:3,anchors:2,guardMm:30,chooseMm:15,maxDzMm:20,minTop:15,minFace:3,chainMm:10,
   eligibleMotifs:Object.freeze(['ambiguity','gauge-out-of-contract','flank','minTop','slope','window']),maxCandidates:6});
 const SIDES=['left','right'];
 const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;

 /* Minima locaux d'une grille : aucune cellule plus basse à moins de `separation`. */
 function localMinima(grid,separation){
   const minima=[];
   for(const cell of grid){let lowest=true;
     for(const other of grid){if(other===cell||Math.hypot(other.u-cell.u,other.z-cell.z)>=separation)continue;if(other.loss<cell.loss){lowest=false;break;}}
     if(lowest)minima.push(cell);}
   return minima.sort((a,b)=>a.loss-b.loss);
 }
 /* Grille grossière d'A_STAR, mêmes centres de fenêtre que le moteur. `null`
  * si le module lié ne rend pas sa grille (défaut de chargement, KI-048) : la
  * raison est alors consignée comme telle, jamais confondue avec « aucun minimum ». */
 function gridOf(capture,side,uSeed){
   let grid=null;
   Candidate.propose(capture,side,{lab:{uSeeds:[uSeed],replaceOrigin:false,recenterWindow:true,partialFaceKeep:true,onCoarse(cells){grid=cells;}}});
   return grid;
 }
 /* Capture réduite à ce que le moteur lit : rails (contours compris), points, visibilité. */
 const minimalCapture=(capture,rails)=>({format:'banane-lot-decision-input-v1',identity:capture.identity??null,rails,
   pointsSceneRelative:capture.pointsSceneRelative,visibleByClipBoxes:capture.visibleByClipBoxes});
 function positionOf(rail,delta){
   const P=rail.profileLocalToSceneRelative,w=C.point(P,delta),o=C.point(P,[0,0,0]);
   return rail.positionSceneRelative.map((v,i)=>v+w[i]-o[i]);
 }
 const sameTrack=(a,b)=>!!a&&!!b&&a.part===b.part&&(a.frameId??null)===(b.frameId??null);
 function neighbours(identity,anchors,cfg=DEFAULTS){
   return (anchors||[]).filter(a=>sameTrack(a.identity,identity)&&a.identity.cut!==identity.cut&&Math.abs(a.identity.cut-identity.cut)<=cfg.gap)
     .sort((a,b)=>Math.abs(a.identity.cut-identity.cut)-Math.abs(b.identity.cut-identity.cut)).slice(0,cfg.anchors);
 }
 /* Écart latéral (mm), le pire des deux rails, entre des positions et la droite des ancres. */
 function deviationMm(rails,anchors,positions){
   return Math.max(...SIDES.map(side=>{const init=rails[side],M=init.sceneRelativeToProfileLocal,o=C.point(M,init.positionSceneRelative);
     const p=O.predict(init,anchors,side),q=C.point(M,positions[side]);return Math.abs((q[1]-o[1]-p.lateral)*1000);}));
 }
 function seededRails(rails,anchors){
   return Object.fromEntries(SIDES.map(side=>[side,O.translated(rails[side],O.predict(rails[side],anchors,side).translation)]));
 }
 /* Minima d'un rail, qualifiés par les points sous le gabarit posé à chacun. */
 function candidatesOf(capture,side,science,cfg=DEFAULTS){
   const rail=science?.rails?.[side];if(!rail?.ok)return [];
   const sign=rail.frame.sign,grid=gridOf(capture,side,rail.frame.uSeed);
   if(!grid)return null;
   return localMinima(grid,Candidate.DEFAULTS.alternativeSeparation).slice(0,24).map((m,rank)=>{
     const delta=[0,sign*m.u,m.z],band=Convention.bandOffsets(capture,side,delta);
     return {rank,uMm:r1(m.u*1000),zMm:r1(m.z*1000),loss:m.loss,top:band.ok?band.top.length:0,face:band.ok?band.face.length:0,delta};
   });
 }
 function chooseRail(capture,side,science,cfg=DEFAULTS,candidates=candidatesOf(capture,side,science,cfg)){
   if(!science?.rails?.[side]?.ok)return {ok:false,reason:'frame'};
   if(candidates===null)return {ok:false,reason:'grid-unavailable'};
   const near=candidates.filter(c=>c.top>=cfg.minTop&&c.face>=cfg.minFace&&Math.abs(c.zMm)<=cfg.maxDzMm&&Math.abs(c.uMm)<=cfg.chooseMm);
   if(!near.length)return {ok:false,reason:'no-qualified-minimum-near-prediction'};
   if(near.length>1)return {ok:false,reason:'several-minima-near-prediction'};
   const pick=near[0],cal=Convention.calibrate(capture,side,pick.delta);
   return {ok:true,delta:cal.applied?cal.delta:pick.delta,fromPredictionMm:Math.abs(pick.uMm),rank:pick.rank,top:pick.top,face:pick.face,
     lossRatio:candidates[0]?.loss?r1(pick.loss/candidates[0].loss):null};
 }
 const journal=candidates=>(candidates||[]).slice(0,DEFAULTS.maxCandidates).map(({delta,...c})=>({...c,loss:Number.isFinite(c.loss)?Math.round(c.loss*1e6)/1e6:null}));
 /* Un cut du lot. `science` : résultat de GCV1 sur la capture telle quelle
  * (celui du Pilote). `anchors` : cuts déjà passés du lot. Rend l'étape
  * atteinte et, si elle vient de la voie, les positions qui auraient été
  * appliquées ; `anchor` dit si le cut devient ancre pour la suite. */
 function decideCut({capture,science,anchors,Shadow,options={}}){
   const cfg={...DEFAULTS,...options},identity=capture.identity,rails=capture.rails,base={version:cfg.version};
   const applicable=SIDES.every(side=>science?.rails?.[side]?.ok&&science.rails[side].next.status==='candidate')&&!science?.summary?.pairGaugeRejected;
   const nb=neighbours(identity,anchors,cfg);
   if(applicable){
     const positions=Object.fromEntries(SIDES.map(side=>[side,positionOf(rails[side],science.rails[side].next.delta)]));
     const guardMm=nb.length?r1(deviationMm(rails,nb.map(a=>({positions:a.positions})),positions)):null;
     if(guardMm===null||guardMm<=cfg.guardMm)return {...base,stage:'first-pass',guardMm,anchorsUsed:nb.map(a=>a.identity.cut),positions,anchor:true};
     // Retiré par la garde : le cut est repris depuis la voie, comme un différé.
     base.guardMm=guardMm;base.guardDeferred=true;
   }
   if(!nb.length)return {...base,stage:'deferred',reason:'no-anchor'};
   const anchorsUsed=nb.map(a=>a.identity.cut),predictionAnchors=nb.map(a=>({positions:a.positions}));
   const seeded=minimalCapture(capture,seededRails(rails,predictionAnchors));
   const again=Shadow.scientificProposeBoth(seeded);
   const againOk=SIDES.every(side=>again.rails[side]?.ok&&again.rails[side].next.status==='candidate')&&!again.summary?.pairGaugeRejected;
   if(againOk){
     const dev=Math.max(...SIDES.map(side=>Math.abs(again.rails[side].next.delta[1])*1000));
     if(dev<=cfg.guardMm){
       const positions=Object.fromEntries(SIDES.map(side=>[side,positionOf(seeded.rails[side],again.rails[side].next.delta)]));
       return {...base,stage:'window',fromPredictionMm:r1(dev),anchorsUsed,positions,anchor:dev<=cfg.chainMm};
     }
   }
   const deltas={},chosen={},why=[],candidates={};
   for(const side of SIDES){
     const r=again.rails[side];if(!r?.ok){why.push(side+':frame');continue;}
     const next=r.next,beforeGate=r.pairGauge?.rejected?r.pairGauge.publishedBeforeGate?.delta:null,own=next.status==='candidate'?next.delta:beforeGate;
     if(own&&Math.abs(own[1])*1000<=cfg.chooseMm){deltas[side]=own;continue;}
     const list=candidatesOf(seeded,side,again,cfg);candidates[side]=journal(list);
     if(!(own||cfg.eligibleMotifs.includes(next.motif))){why.push(side+':'+(next.motif||next.status));continue;}
     const pick=chooseRail(seeded,side,again,cfg,list);
     if(!pick.ok){why.push(side+':'+pick.reason);continue;}
     deltas[side]=pick.delta;chosen[side]={fromPredictionMm:pick.fromPredictionMm,rank:pick.rank,top:pick.top,face:pick.face,lossRatio:pick.lossRatio};
   }
   if(!SIDES.every(side=>deltas[side]))return {...base,stage:'deferred',reason:why.join(' '),anchorsUsed,candidates};
   const pair=Gauge.assessPair(seeded.rails,deltas,C);
   if(!pair.admissible)return {...base,stage:'deferred',reason:'gauge-'+pair.gaugeClass,gaugeMm:r1(pair.predictedMm),anchorsUsed,candidates};
   return {...base,stage:'choice',chosen,gaugeMm:r1(pair.predictedMm),anchorsUsed,candidates,
     positions:Object.fromEntries(SIDES.map(side=>[side,positionOf(seeded.rails[side],deltas[side])])),anchor:false};
 }
 /* 4.7.10 — LA DÉCISION SUR LE LOT COMMANDE (D-041, D-042). Traduit une
  * décision en rails pour `Engine.apply()`, sans rien décider de plus :
  *   - premier passage : la proposition du moteur, inchangée ;
  *   - reprise depuis la voie ou choix : les positions de la décision, en
  *     décalages du repère de profil de la pose ESV courante (ceux
  *     qu'`expectedPoses` applique), relues ici — mêmes positions à 0,01 mm
  *     près, écartement dans le contrat —, sinon repli sur la proposition du
  *     moteur, comme en 4.7.9 ;
  *   - retiré par la garde de continuité sans reprise possible : les deux rails
  *     deviennent des abstentions, et le cut est différé comme tout rail non
  *     résolu (`Engine.deferEligibility`, source d'abstention GCV1 : la décision
  *     sur le lot fait partie de la chaîne GCV1 du Pilote) ;
  *   - tout le reste : la proposition du moteur, inchangée.
  * L'écartement n'est qu'un contrôle d'admissibilité, jamais une cible. */
 /* Mémoire des appuis du lot : un cut analysé une seconde fois (« Réessayer ce
  * cut », reprise) remplace son entrée au lieu de compter pour deux appuis. */
 function rememberAnchor(anchors,entry,max=40){
   const i=anchors.findIndex(a=>sameTrack(a.identity,entry.identity)&&a.identity.cut===entry.identity.cut);
   if(i>=0)anchors.splice(i,1);
   anchors.push(entry);while(anchors.length>max)anchors.shift();return anchors;
 }
 /* VUE D'ESV (KI-051, lot 4.7.10 du 24/09, partie 33, cut 8089). Le Pilote pose
  * un rail en CLIQUANT la cible dans la vue orthographique qu'ESV centre sur ce
  * rail, large de ±0,2 unité de scène : une cible plus loin de la pose ESV est
  * refusée par l'adaptateur (« Position proposée hors de la vue ») et arrête le
  * lot. La capture garde la caméra de chaque rail ; on y projette la cible
  * avant de commander. Caméra du rail : celle où il projette au centre. Sur ce
  * lot, la projection par la caméra de la capture rend celle de l'adaptateur à
  * 0,001 près (8089 : 1,038 contre 1,0375), et des cibles à 0,93 et 0,98 ont
  * été posées : marge de 1 % (2 mm) seulement. */
 const VIEW_MARGIN=0.99;
 function viewCameras(capture){
   const cams=[capture?.camera,...(capture?.viewCaptures||[]).map(v=>v?.camera)].filter(c=>c?.projection&&c?.sceneRelativeToCamera);
   const ndcOf=(cam,p)=>C.point(C.multiply(cam.projection,cam.sceneRelativeToCamera),p);
   return Object.fromEntries(SIDES.map(side=>{const p=capture?.rails?.[side]?.positionSceneRelative;if(!Array.isArray(p))return [side,null];
     const best=cams.map(cam=>({cam,d:Math.hypot(...ndcOf(cam,p).slice(0,2))})).sort((a,b)=>a.d-b.d)[0];
     return [side,best&&best.d<=0.5?best.cam:null];}));
 }
 function inView(cam,point,margin=VIEW_MARGIN){
   const ndc=C.point(C.multiply(cam.projection,cam.sceneRelativeToCamera),point);
   return {ndc,inView:Math.abs(ndc[0])<=margin&&Math.abs(ndc[1])<=margin&&Math.abs(ndc[2])<=1};
 }
 const MATCH_SCENE=1e-5;
 function commandRails({decision,runtimeRails,before,expectedPoses,cameras}){
   const keep=reason=>({action:'engine',reason,rails:runtimeRails});
   if(!decision||!runtimeRails||!before||!SIDES.every(side=>runtimeRails[side]&&before[side]))return keep('no-decision');
   const note={stage:decision.stage,anchorsUsed:decision.anchorsUsed||[],version:decision.version??DEFAULTS.version};
   if(decision.stage==='deferred'&&decision.guardDeferred){
     const reason='décision sur le lot : retiré par la garde de continuité ('+decision.guardMm+' mm de la voie), sans reprise';
     return {action:'defer',reason:'guard',rails:Object.fromEntries(SIDES.map(side=>[side,{...runtimeRails[side],status:'unresolved',delta:null,confidence:0,
       reasons:[reason],source:'geometry-candidate-v1-abstention',lotDecision:{...note,reason:'guard',guardMm:decision.guardMm??null}}]))};
   }
   if(decision.stage!=='window'&&decision.stage!=='choice')return keep(decision.stage||'no-stage');
   if(!decision.positions||typeof expectedPoses!=='function')return keep('positions-missing');
   const rails={};
   for(const side of SIDES){
     const init=before[side],M=init.sceneRelativeToProfileLocal,q=C.point(M,decision.positions[side]),o=C.point(M,init.positionSceneRelative);
     rails[side]={...runtimeRails[side],status:'candidate',delta:[q[0]-o[0],q[1]-o[1],q[2]-o[2]],confidence:0,
       reasons:['décision sur le lot : '+(decision.stage==='window'?'reprise depuis la voie':'choix par la voie')],
       source:'lot-decision-'+decision.stage,lotDecision:{...note,...(decision.chosen?.[side]?{chosen:decision.chosen[side]}:{}),
         ...(decision.fromPredictionMm!=null?{fromPredictionMm:decision.fromPredictionMm}:{})}};
   }
   let expected;try{expected=expectedPoses({rails:before},rails);}catch{return keep('expected-poses-failed');}
   if(SIDES.some(side=>C.distance(expected[side].positionSceneRelative,decision.positions[side])>MATCH_SCENE))return keep('position-mismatch');
   const gaugeMm=Gauge.gaugeMmOf(expected,C),gaugeClass=Gauge.classifyMm(gaugeMm);
   if(!Gauge.admissible(gaugeClass))return keep('gauge-'+gaugeClass);
   /* La cible doit tomber dans la vue du rail (KI-051) ; sinon le cut suit la
    * proposition du moteur, comme en 4.7.9 (un rail non résolu : différé). */
   for(const side of SIDES){const cam=cameras?.[side];if(!cam)return keep('vue-inconnue-'+side);
     const view=inView(cam,decision.positions[side]);
     if(!view.inView)return {...keep('hors-vue-'+side),ndc:view.ndc.slice(0,2).map(v=>Math.round(v*1000)/1000)};}
   return {action:'lot',reason:decision.stage,rails,gaugeMm:r1(gaugeMm)};
 }
 return {DEFAULTS,localMinima,gridOf,minimalCapture,positionOf,neighbours,deviationMm,seededRails,candidatesOf,chooseRail,decideCut,commandRails,rememberAnchor,viewCameras,inView,VIEW_MARGIN};
});
