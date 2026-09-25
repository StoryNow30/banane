(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./gauge.js'),
    require('./geometry-candidate-v1.js'),require('./placement-convention.js'),require('./continuity-observer.js'),require('./level-crossing.js'));
  else root.BananeLotDecision=factory(root.BananeCaptureCore,root.BananeGauge4,root.BananeGeometry3,root.BananePlacementConvention,root.BananeContinuityObserver,root.BananeLevelCrossing);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,Gauge,Candidate,Convention,O,Crossing){
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
  * dans le journal du Pilote.
  *
  * `chainMm` : une reprise depuis la voie devient appui si elle tombe à 15 mm
  * au plus de la prédiction (10 mm jusqu'à la 4.7.14). Bilan des curseurs,
  * D-047 : +4 cuts justes, aucun faux, aucun juste perdu sur 6 sessions Natif
  * et 4 lots Pilote relus (`audit/curseurs-lot-2026-09-24.md`).
  *
  * 4.7.16 (D-050) : garde d'écartement voisin active à 20 mm (`gaugeGuardMm`),
  * et un minimum du choix accepté avec 5 points de dessus au lieu de 15
  * (`minTop`, filtre du choix seulement : celui du moteur reste 15). Ensemble,
  * sur 6 sessions Natif et 5 lots Pilote relus : +13 justes, −1 faux (7026),
  * aucun juste perdu (`audit/ecartement-voisin-2026-09-24.md`).
  *
  * 4.7.18 (KI-057, relecture 4.7.16, constat B1) : un appui est un cut POSÉ
  * du lot, pas une décision. `anchorRule:'placed'` : la décision propose un
  * appui ; il n'entre dans la mémoire du lot qu'une fois ses positions
  * commandées, appliquées et le cut validé (`holdAnchor`, `promoteAnchors`).
  * Jusqu'à la 4.7.17 (`'decided'`), il y entrait dès la décision, même si la
  * commande était ensuite repliée (partie 35 : 8951, cible hors de la vue,
  * différé, servait d'appui à 8952 et 8953). */
 /* 4.7.19 (KI-058) — PASSAGE À NIVEAU ET VOIE ENCADRÉE (`lot-decision-v6`).
  *
  * `crossing` : au passage à niveau (chaussée au niveau du champignon), le rail
  * se lit par son ORNIÈRE (`src/level-crossing.js`). Le lecteur ne sert qu'en
  * DERNIER RECOURS : sur un cut que la chaîne diffère (moteur abstenu ou retiré
  * par une garde, sans reprise ni choix possibles), la paire de l'ornière est
  * posée si son écartement est dans le contrat (admissibilité seulement), si
  * elle passe la garde d'écartement voisin et, avec des appuis, si elle tombe à
  * `crossingVoieMm` de la voie. Jamais sur un cut que la chaîne décide, jamais
  * après la garde de paire. Banc du 25/09 : s'en servir d'arbitre (premier
  * passage gardé seulement si le moteur s'accorde avec l'ornière, ni reprise ni
  * choix au passage à niveau) retirait 43 cuts justes sans arrêter aucun faux ;
  * en dernier recours, il pose des différés sans toucher au reste. L'écart du
  * moteur à l'ornière est consigné (`levelCrossing.engineMm`), sans effet.
  * Ni pose humaine, ni écartement cible : le lecteur ne lit que la capture.
  * `framed` : un cut qui a des appuis POSÉS des deux côtés (reprise des
  * différés, lot « Reprise ») est prédit par la voie ENCADRÉE — jusqu'à
  * `frameAnchors` appuis de chaque côté à `frameGap` cuts au plus, courbe du
  * second degré dès deux appuis de chaque côté, droite sinon. Mesuré sur la
  * méthode de l'opérateur (7801–7806) : 6,4 mm au pire, contre 20 à 32 mm pour
  * la voie prolongée par l'avant seul. En avancée normale, aucun appui n'est
  * après le cut : rien ne change. */
 const DEFAULTS=Object.freeze({version:'lot-decision-v6',gap:3,anchors:2,guardMm:30,chooseMm:15,maxDzMm:20,minTop:5,minFace:3,chainMm:15,pairGuard:true,gaugeGuardMm:20,gaugeGap:10,gaugeCount:3,gaugeChoice:false,gaugeTargetStudy:false,anchorRule:'placed',
   crossing:true,crossingVoieMm:10,framed:true,frameGap:8,frameAnchors:3,
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
 /* Voie encadrée : appuis posés avant ET après le cut (reprise des différés). */
 function framedNeighbours(identity,anchors,cfg=DEFAULTS){
   const same=(anchors||[]).filter(a=>sameTrack(a.identity,identity)&&a.identity.cut!==identity.cut&&Math.abs(a.identity.cut-identity.cut)<=cfg.frameGap);
   const near=list=>list.sort((a,b)=>Math.abs(a.identity.cut-identity.cut)-Math.abs(b.identity.cut-identity.cut)).slice(0,cfg.frameAnchors);
   const before=near(same.filter(a=>a.identity.cut<identity.cut)),after=near(same.filter(a=>a.identity.cut>identity.cut));
   return cfg.framed&&before.length&&after.length?[...before,...after]:null;
 }
 /* Moindres carrés y = a + b·x + c·x², évalué en x = 0 ; droite à défaut. */
 function fitFramed(points){
   const n=points.length;if(n<4)return null;
   const S=k=>points.reduce((t,[x])=>t+x**k,0),T=k=>points.reduce((t,[x,y])=>t+y*x**k,0);
   const A=[[n,S(1),S(2)],[S(1),S(2),S(3)],[S(2),S(3),S(4)]],b=[T(0),T(1),T(2)];
   const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
   const d=det(A);if(Math.abs(d)<1e-18)return null;
   return det([[b[0],A[0][1],A[0][2]],[b[1],A[1][1],A[1][2]],[b[2],A[2][1],A[2][2]]])/d;
 }
 function predictFramed(initial,anchors,side){
   const M=initial.sceneRelativeToProfileLocal,o=C.point(M,initial.positionSceneRelative);
   const q=anchors.map(a=>{const p=C.point(M,a.positions[side]);return [p[0]-o[0],p[1]-o[1],p[2]-o[2]];});
   const two=q.filter(p=>p[0]<0).length>=2&&q.filter(p=>p[0]>0).length>=2;
   const lateral=two?fitFramed(q.map(p=>[p[0],p[1]])):null,vertical=two?fitFramed(q.map(p=>[p[0],p[2]])):null;
   if(lateral===null||vertical===null)return O.predict(initial,anchors,side);
   const P=initial.profileLocalToSceneRelative,a=C.point(P,o),b=C.point(P,[o[0],o[1]+lateral,o[2]+vertical]);
   return {lateral,vertical,translation:[b[0]-a[0],b[1]-a[1],b[2]-a[2]]};
 }
 const predictOf=anchors=>anchors.framed?predictFramed:O.predict;
 /* Écart latéral (mm), le pire des deux rails, entre des positions et la voie des ancres. */
 function deviationMm(rails,anchors,positions){
   const predict=predictOf(anchors);
   return Math.max(...SIDES.map(side=>{const init=rails[side],M=init.sceneRelativeToProfileLocal,o=C.point(M,init.positionSceneRelative);
     const p=predict(init,anchors,side),q=C.point(M,positions[side]);return Math.abs((q[1]-o[1]-p.lateral)*1000);}));
 }
 function seededRails(rails,anchors){
   const predict=predictOf(anchors);
   return Object.fromEntries(SIDES.map(side=>[side,O.translated(rails[side],predict(rails[side],anchors,side).translation)]));
 }
 /* Appuis de prédiction : voie encadrée si possible, sinon les plus proches. */
 function predictionAnchors(identity,anchors,nb,cfg){
   const framed=framedNeighbours(identity,anchors,cfg);
   const list=(framed||nb).map(a=>({positions:a.positions}));if(framed)list.framed=true;
   return {list,cuts:(framed||nb).map(a=>a.identity.cut),framed:!!framed};
 }
 /* Écart latéral (mm) par rail entre deux paires, chacune dans le repère profil de sa pose ESV. */
 function pairGapMm(rails,a,b){
   return Math.max(...SIDES.map(side=>{const M=rails[side].sceneRelativeToProfileLocal,p=C.point(M,a[side]),q=C.point(M,b[side]);return Math.abs((p[1]-q[1])*1000);}));
 }
 /* Lecture du passage à niveau sur les points visibles de la capture. */
 function crossingOf(capture,cfg){
   if(!cfg.crossing||!Crossing)return null;
   const vis=capture.visibleByClipBoxes,points=Array.isArray(vis)?capture.pointsSceneRelative.filter((_,i)=>vis[i]===true):capture.pointsSceneRelative;
   const read=Crossing.read({rails:capture.rails,pointsSceneRelative:points});
   return read.crossing?read:null;
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
 /* Minima qualifiés près de la prédiction, calage de convention compris (mêmes filtres que `chooseRail`). */
 function nearOf(capture,side,cfg,candidates){
   return (candidates||[]).filter(c=>c.top>=cfg.minTop&&c.face>=cfg.minFace&&Math.abs(c.zMm)<=cfg.maxDzMm&&Math.abs(c.uMm)<=cfg.chooseMm)
     .map(c=>{const cal=Convention.calibrate(capture,side,c.delta);return {...c,delta:cal.applied?cal.delta:c.delta};});
 }
 const journal=candidates=>(candidates||[]).slice(0,DEFAULTS.maxCandidates).map(({delta,...c})=>({...c,loss:Number.isFinite(c.loss)?Math.round(c.loss*1e6)/1e6:null}));
 /* Un cut du lot. `science` : résultat de GCV1 sur la capture telle quelle
  * (celui du Pilote). `anchors` : cuts déjà passés du lot. Rend l'étape
  * atteinte et, si elle vient de la voie, les positions qui auraient été
  * appliquées ; `anchor` dit si le cut devient ancre pour la suite. */
 /* GARDE D'ÉCARTEMENT VOISIN (étude du 24/09, partie 2, KI-054 ; active à 20 mm
  * depuis la 4.7.16, D-050 ; inactive si `gaugeGuardMm` est nul). L'écartement d'une paire est comparé à la
  * médiane de celui des `gaugeCount` appuis les plus proches, à `gaugeGap`
  * cuts au plus. L'écartement ne dépend pas de la pose de départ d'ESV : la
  * garde voit un premier passage même sans appui de position. Garde
  * seulement, jamais une cible (D-033) : une paire trop loin de ses voisins
  * est écartée, aucune n'est choisie parce qu'elle en est proche. */
 const gaugeOf=positions=>C.distance(positions.left,positions.right)*1000;
 function gaugeReference(identity,anchors,cfg=DEFAULTS){
   const near=(anchors||[]).filter(a=>sameTrack(a.identity,identity)&&a.identity.cut!==identity.cut&&Math.abs(a.identity.cut-identity.cut)<=cfg.gaugeGap&&a.positions?.left&&a.positions?.right)
     .sort((a,b)=>Math.abs(a.identity.cut-identity.cut)-Math.abs(b.identity.cut-identity.cut)).slice(0,cfg.gaugeCount);
   if(!near.length)return null;
   const g=near.map(a=>gaugeOf(a.positions)).sort((x,y)=>x-y),m=g.length>>1;
   return {mm:g.length%2?g[m]:(g[m-1]+g[m])/2,cuts:near.map(a=>a.identity.cut)};
 }
 const gaugeJump=(ref,positions)=>ref?Math.abs(gaugeOf(positions)-ref.mm):null;
 const pairFlagged=science=>SIDES.some(side=>science?.rails?.[side]?.next?.changed===true)
   &&SIDES.some(side=>science?.rails?.[side]?.conventionCalibration?.reason==='shift-out-of-domain');
 /* Passage à niveau, cut que la chaîne DIFFÈRE : la paire de l'ornière est posée
  * si son écartement est dans le contrat (admissibilité seulement), si elle
  * passe la garde d'écartement voisin et, quand il y a des appuis, si elle
  * tombe à `crossingVoieMm` de la voie. Sinon le différé reste, motif du
  * lecteur consigné. Jamais sur un cut que la chaîne décide ; jamais après la
  * garde de paire. */
 function crossingFallback(d,{rails,positions,pred,gaugeRef,gaugeSuspect,cfg}){
   const deltas=Object.fromEntries(SIDES.map(side=>{const M=rails[side].sceneRelativeToProfileLocal,q=C.point(M,positions[side]),o=C.point(M,rails[side].positionSceneRelative);
     return [side,[q[0]-o[0],q[1]-o[1],q[2]-o[2]]];}));
   const pair=Gauge.assessPair(rails,deltas,C),refuse=reason=>({...d,levelCrossing:{...d.levelCrossing,refused:reason,gaugeMm:r1(pair.predictedMm)}});
   if(!pair.admissible)return refuse('gauge-'+pair.gaugeClass);
   if(gaugeSuspect(positions))return refuse('gauge-guard');
   let dev=null;
   if(pred.list.length){dev=deviationMm(rails,pred.list,positions);if(dev>cfg.crossingVoieMm)return {...refuse('voie'),levelCrossing:{...d.levelCrossing,refused:'voie',fromPredictionMm:r1(dev)}};}
   const {reason,candidates,gaugeJumpMm,windowGaugeJumpMm,guardDeferred,...rest}=d;
   return {...rest,stage:'crossing',deferredReason:reason,anchorsUsed:pred.cuts,gaugeMm:r1(pair.predictedMm),fromPredictionMm:r1(dev),positions,anchor:true,
     ...(guardDeferred?{guardDeferred:true}:{})};
 }
 function decideCut({capture,science,anchors,Shadow,options={}}){
   /* La décision consigne ses propres règles (relecture 4.7.12, constat M) : le
    * rejeu les lit dans le lot au lieu de les déduire de la version de l'export. */
   const cfg={...DEFAULTS,...options},identity=capture.identity,rails=capture.rails,base={version:cfg.version,pairGuard:!!cfg.pairGuard,chainMm:cfg.chainMm,gaugeGuardMm:cfg.gaugeGuardMm,minTop:cfg.minTop,anchorRule:cfg.anchorRule,
     crossing:!!cfg.crossing,framed:!!cfg.framed};
   const applicable=SIDES.every(side=>science?.rails?.[side]?.ok&&science.rails[side].next.status==='candidate')&&!science?.summary?.pairGaugeRejected;
   const nb=neighbours(identity,anchors,cfg),gaugeRef=cfg.gaugeGuardMm!=null?gaugeReference(identity,anchors,cfg):null;
   const gaugeSuspect=positions=>gaugeRef!==null&&gaugeJump(gaugeRef,positions)>cfg.gaugeGuardMm;
   if(gaugeRef)base.gaugeReference={mm:r1(gaugeRef.mm),cuts:gaugeRef.cuts};
   /* 4.7.19 : voie encadrée si des appuis posés sont des deux côtés, sinon les
    * plus proches (inchangé) ; passage à niveau lu par son ornière. */
   const pred=predictionAnchors(identity,anchors,nb,cfg),pn=crossingOf(capture,cfg);
   if(pred.framed)base.framedAnchors=pred.cuts;
   if(pn)base.levelCrossing={flushPct:pn.flushPct,read:pn.ok,...(pn.ok?{}:{reason:pn.reason})};
   if(applicable){
     const positions=Object.fromEntries(SIDES.map(side=>[side,positionOf(rails[side],science.rails[side].next.delta)]));
     const guardMm=pred.list.length?r1(deviationMm(rails,pred.list,positions)):null;
     /* Passage à niveau lisible : écart du moteur à l'ornière, consigné seulement
      * (banc du 25/09 : s'en servir comme garde retirait 7 premiers passages
      * justes sans arrêter aucun faux). */
     if(pn?.ok)base.levelCrossing.engineMm=r1(pairGapMm(rails,positions,pn.positions));
     if(guardMm===null||guardMm<=cfg.guardMm){
       /* GARDE DE PAIRE (chantier 2, 4.7.12, D-044) : un rail repêché par S1 et un
        * calage de convention hors domaine sur l'un des deux rails — le moteur
        * cumule une ambiguïté tranchée et un déplacement de convention refusé.
        * Le cut est différé et ne devient pas appui ; aucune position n'est
        * cherchée à la place. Mesuré : 241 et 409 arrêtés, aucun juste perdu
        * (`audit/garde-paire-verification-2026-09-24.md`). */
       if(cfg.pairGuard&&pairFlagged(science))return {...base,stage:'deferred',reason:'pair-guard',pairGuarded:true,guardMm,anchorsUsed:nb.map(a=>a.identity.cut),anchor:false};
       if(!gaugeSuspect(positions))return {...base,stage:'first-pass',guardMm,anchorsUsed:nb.map(a=>a.identity.cut),positions,anchor:true};
       // Retiré par la garde d'écartement voisin : repris depuis la voie, comme un différé.
       base.gaugeJumpMm=r1(gaugeJump(gaugeRef,positions));
     }
     // Retiré par une garde : le cut est repris depuis la voie, comme un différé.
     base.guardMm=guardMm;base.guardDeferred=true;
   }
   /* Un différé au passage à niveau : l'ornière en dernier recours (voir `decideCut`). */
   const deferred=d=>pn?.ok&&!d.pairGuarded?crossingFallback(d,{rails,positions:pn.positions,pred,gaugeRef,gaugeSuspect,cfg}):d;
   if(!pred.list.length)return deferred({...base,stage:'deferred',reason:base.gaugeJumpMm!=null?'gauge-guard':'no-anchor'});
   const anchorsUsed=pred.cuts;
   const seeded=minimalCapture(capture,seededRails(rails,pred.list));
   const again=Shadow.scientificProposeBoth(seeded);
   const againOk=SIDES.every(side=>again.rails[side]?.ok&&again.rails[side].next.status==='candidate')&&!again.summary?.pairGaugeRejected;
   if(againOk){
     const dev=Math.max(...SIDES.map(side=>Math.abs(again.rails[side].next.delta[1])*1000));
     if(dev<=cfg.guardMm){
       const positions=Object.fromEntries(SIDES.map(side=>[side,positionOf(seeded.rails[side],again.rails[side].next.delta)]));
       if(!gaugeSuspect(positions))return {...base,stage:'window',fromPredictionMm:r1(dev),anchorsUsed,positions,anchor:dev<=cfg.chainMm};
       base.windowGaugeJumpMm=r1(gaugeJump(gaugeRef,positions));
     }
   }
   const deltas={},chosen={},why=[],candidates={},several={};
   for(const side of SIDES){
     const r=again.rails[side];if(!r?.ok){why.push(side+':frame');continue;}
     const next=r.next,beforeGate=r.pairGauge?.rejected?r.pairGauge.publishedBeforeGate?.delta:null,own=next.status==='candidate'?next.delta:beforeGate;
     if(own&&Math.abs(own[1])*1000<=cfg.chooseMm){deltas[side]=own;continue;}
     const list=candidatesOf(seeded,side,again,cfg);candidates[side]=journal(list);
     if(!(own||cfg.eligibleMotifs.includes(next.motif))){why.push(side+':'+(next.motif||next.status));continue;}
     const pick=chooseRail(seeded,side,again,cfg,list);
     if(!pick.ok&&pick.reason==='several-minima-near-prediction'&&(cfg.gaugeChoice||cfg.gaugeTargetStudy)&&gaugeRef)several[side]=nearOf(seeded,side,cfg,list);
     if(!pick.ok){why.push(side+':'+pick.reason);continue;}
     deltas[side]=pick.delta;chosen[side]={fromPredictionMm:pick.fromPredictionMm,rank:pick.rank,top:pick.top,face:pick.face,lossRatio:pick.lossRatio};
   }
   /* Plusieurs minima près de la prédiction (option `gaugeChoice`) : les paires
    * hors du contrat ou trop loin de l'écartement des voisins sont ÉCARTÉES ;
    * s'il n'en reste qu'une, elle est retenue, sinon le cut reste différé.
    * Aucune paire n'est préférée pour sa proximité (garde, jamais cible). */
   if(Object.keys(several).length&&SIDES.every(side=>deltas[side]||several[side]?.length)){
     const opts=side=>deltas[side]?[{delta:deltas[side],own:true}]:several[side];
     const kept=[];for(const l of opts('left'))for(const r of opts('right')){const d={left:l.delta,right:r.delta},pr=Gauge.assessPair(seeded.rails,d,C);
       if(!pr.admissible)continue;const pos=Object.fromEntries(SIDES.map(side=>[side,positionOf(seeded.rails[side],d[side])]));
       if(cfg.gaugeTargetStudy||!gaugeSuspect(pos))kept.push({l,r,d,jump:gaugeJump(gaugeRef,pos)});}
     /* MESURE SEULEMENT (question de la direction, 24/09) : la paire la plus proche
      * de l'écartement des voisins. C'est une CIBLE, interdite dans le Pilote par
      * l'invariant n°1 du §7 et par le §3.6 du cahier 4.8 ; le Pilote ne passe
      * jamais d'options à cette fonction. Sert à chiffrer ce que la règle coûte. */
     if(cfg.gaugeTargetStudy&&kept.length>1)kept.splice(0,kept.length,kept.reduce((a,b)=>b.jump<a.jump?b:a));
     if(kept.length===1){const k=kept[0];for(const [side,c] of [['left',k.l],['right',k.r]])if(!c.own){deltas[side]=c.delta;
       chosen[side]={fromPredictionMm:Math.abs(c.uMm),rank:c.rank,top:c.top,face:c.face,byGaugeGuard:true};}
       why.length=0;}
     else why.push('gauge-choice:'+kept.length);
   }
   if(!SIDES.every(side=>deltas[side]))return deferred({...base,stage:'deferred',reason:why.join(' '),anchorsUsed,candidates});
   const pair=Gauge.assessPair(seeded.rails,deltas,C);
   if(!pair.admissible)return deferred({...base,stage:'deferred',reason:'gauge-'+pair.gaugeClass,gaugeMm:r1(pair.predictedMm),anchorsUsed,candidates});
   const positions=Object.fromEntries(SIDES.map(side=>[side,positionOf(seeded.rails[side],deltas[side])]));
   if(gaugeSuspect(positions))return deferred({...base,stage:'deferred',reason:'gauge-guard',gaugeJumpMm:r1(gaugeJump(gaugeRef,positions)),gaugeMm:r1(pair.predictedMm),anchorsUsed,candidates});
   return {...base,stage:'choice',chosen,gaugeMm:r1(pair.predictedMm),anchorsUsed,candidates,positions,anchor:false};
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
 /* 4.7.18 (KI-057) — APPUI = CUT POSÉ. Les positions d'une décision sont-elles
  * celles que le Pilote commande ? Premier passage : la paire du moteur, gardée
  * telle quelle, sauf si le cut est différé. Reprise depuis la voie : seulement
  * si la commande est « lot ». Un choix n'est jamais appui. `command` nul : lot
  * en observation (ou décision non commandée) — la proposition du moteur est
  * appliquée, donc seul un premier passage pose ses positions. */
 function commandsPositions(decision,command){
   if(!decision?.anchor||!decision.positions)return false;
   if(decision.stage==='first-pass')return command?.action!=='defer'&&command?.action!=='lot';
   if(decision.stage==='window'||decision.stage==='crossing')return command?.action==='lot';
   return false;
 }
 /* L'appui proposé attend la validation du cut. Une nouvelle analyse du même
  * cut (« Réessayer ce cut », reprise) remplace l'attente ; une attente qui ne
  * sera jamais validée (cut différé, repris à la main, SKIP) ne sert à rien. */
 const PENDING_MAX=8;
 function holdAnchor(state,entry){
   state.pending=(state.pending||[]).filter(p=>!(sameTrack(p.identity,entry.identity)&&p.identity.cut===entry.identity.cut));
   state.pending.push(entry);while(state.pending.length>PENDING_MAX)state.pending.shift();return state;
 }
 /* Les attentes des cuts VALIDÉS par le Pilote (`batch.processed` : VALIDATE
  * émis et navigation observée) deviennent appuis ; les autres restent en
  * attente. Appelé avant chaque décision : le cut précédent est alors terminé. */
 function promoteAnchors(state,validated,max=40){
   const keep=[];
   for(const p of state.pending||[])
     if((validated||[]).some(v=>sameTrack(v,p.identity)&&v.cut===p.identity.cut))rememberAnchor(state.anchors,p,max);else keep.push(p);
   state.pending=keep;return state;
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
 /* Deux abstentions GCV1 : le moteur diffère le cut (`Engine.deferEligibility`). */
 function deferRails(runtimeRails,decision,reason,text){
   const note={stage:decision?.stage??null,anchorsUsed:decision?.anchorsUsed||[],version:decision?.version??DEFAULTS.version};
   return {action:'defer',reason,rails:Object.fromEntries(SIDES.map(side=>[side,{...runtimeRails[side],status:'unresolved',delta:null,confidence:0,
     reasons:[text],source:'geometry-candidate-v1-abstention',lotDecision:{...note,reason,...(decision?.guardMm!=null?{guardMm:decision.guardMm}:{})}}]))};
 }
 function commandRails({decision,runtimeRails,before,expectedPoses,cameras}){
   const keep=reason=>({action:'engine',reason,rails:runtimeRails});
   if(!decision||!runtimeRails||!before||!SIDES.every(side=>runtimeRails[side]&&before[side]))return keep('no-decision');
   /* RELECTURE 4.7.12, CONSTAT B1 (KI-053). La garde de continuité a RETIRÉ la
    * paire du moteur : aucun repli ne doit la rendre. Si la position de la voie
    * ne peut pas être commandée (hors de la vue, caméra inconnue, repère ou
    * écartement non relus), le cut est différé. Sans retrait par la garde, le
    * repli reste la proposition du moteur, comme en 4.7.9. */
   /* Quelle garde a retiré la paire : continuité (écart à la voie) ou écartement voisin. */
   const why=decision.gaugeJumpMm!=null?'la garde d\'écartement voisin ('+decision.gaugeJumpMm+' mm de l\'écartement des voisins)':'la garde de continuité ('+decision.guardMm+' mm de la voie)';
   const fallback=reason=>decision.guardDeferred
     ?deferRails(runtimeRails,decision,'guard-'+reason,'décision sur le lot : paire du moteur retirée par '+why+' ; position de la voie non commandable ('+reason+')')
     :keep(reason);
   if(decision.stage==='deferred'&&decision.pairGuarded)
     return deferRails(runtimeRails,decision,'pair-guard','décision sur le lot : garde de paire (rail repêché par S1 et calage de convention hors domaine)');
   if(decision.stage==='deferred'&&decision.guardDeferred)
     return deferRails(runtimeRails,decision,decision.gaugeJumpMm!=null?'gauge-guard':'guard','décision sur le lot : retiré par '+why+', sans reprise');
   const note={stage:decision.stage,anchorsUsed:decision.anchorsUsed||[],version:decision.version??DEFAULTS.version};
   if(decision.stage!=='window'&&decision.stage!=='choice'&&decision.stage!=='crossing')return fallback(decision.stage||'no-stage');
   if(!decision.positions||typeof expectedPoses!=='function')return fallback('positions-missing');
   const rails={};
   for(const side of SIDES){
     const init=before[side],M=init.sceneRelativeToProfileLocal,q=C.point(M,decision.positions[side]),o=C.point(M,init.positionSceneRelative);
     rails[side]={...runtimeRails[side],status:'candidate',delta:[q[0]-o[0],q[1]-o[1],q[2]-o[2]],confidence:0,
       reasons:['décision sur le lot : '+(decision.stage==='window'?'reprise depuis la voie':decision.stage==='crossing'?'passage à niveau, lu par l\'ornière':'choix par la voie')],
       source:'lot-decision-'+decision.stage,lotDecision:{...note,...(decision.chosen?.[side]?{chosen:decision.chosen[side]}:{}),
         ...(decision.fromPredictionMm!=null?{fromPredictionMm:decision.fromPredictionMm}:{})}};
   }
   let expected;try{expected=expectedPoses({rails:before},rails);}catch{return fallback('expected-poses-failed');}
   if(SIDES.some(side=>C.distance(expected[side].positionSceneRelative,decision.positions[side])>MATCH_SCENE))return fallback('position-mismatch');
   const gaugeMm=Gauge.gaugeMmOf(expected,C),gaugeClass=Gauge.classifyMm(gaugeMm);
   if(!Gauge.admissible(gaugeClass))return fallback('gauge-'+gaugeClass);
   /* La cible doit tomber dans la vue du rail (KI-051) ; sinon le cut suit la
    * proposition du moteur, comme en 4.7.9 (un rail non résolu : différé). */
   for(const side of SIDES){const cam=cameras?.[side];if(!cam)return fallback('vue-inconnue-'+side);
     const view=inView(cam,decision.positions[side]);
     if(!view.inView)return {...fallback('hors-vue-'+side),ndc:view.ndc.slice(0,2).map(v=>Math.round(v*1000)/1000)};}
   return {action:'lot',reason:decision.stage,rails,gaugeMm:r1(gaugeMm)};
 }
 return {DEFAULTS,localMinima,gridOf,minimalCapture,positionOf,neighbours,framedNeighbours,predictFramed,fitFramed,predictionAnchors,crossingOf,pairGapMm,deviationMm,seededRails,candidatesOf,chooseRail,decideCut,commandRails,deferRails,rememberAnchor,commandsPositions,holdAnchor,promoteAnchors,viewCameras,inView,VIEW_MARGIN,pairFlagged,gaugeOf,gaugeReference};
});
