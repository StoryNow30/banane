(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./lot-decision.js'),require('./continuity-observer.js'));
  else root.BananeVoieRecentree=factory(root.BananeCaptureCore,root.BananeLotDecision,root.BananeContinuityObserver);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,L,O){
 'use strict';
 /* « RECENTRER SUR LA VOIE » — module commun des deux ombres de la 5.0 (audit 5.0, I8 ; D-147 et D-148).
  *
  * La règle prudente de la voie prédite (D-147, `fiches/VOIE_PREDITE.md`) et la mémoire des différés G1 (b) (D-148,
  * `fiches/G1_MEMOIRE_DIFFERES.md`) sont la MÊME mécanique : le moteur relancé sur des rails translatés sur une voie
  * prédite, puis le minimum unique à 15 mm de cette voie. Elles ne diffèrent que par la SOURCE de la voie : les deux
  * derniers cuts posés du lot (Orbite), ou les dernières corrections validées par l'opérateur dans la série (Écho).
  *
  * Ce module ne commande rien, n'écrit rien, ne lit aucune horloge : il CALCULE. Il rend la décision qu'aurait prise
  * le moteur recentré (étage, positions), la confiance du moteur relancé, l'écart à la voie, la profondeur de chaîne
  * et le geste de vue qu'il AURAIT fallu (dans la vue, dézoom ×k, glissement en pixels) d'après la caméra capturée.
  * Les ombres s'en servent pour CONSIGNER ; les outils hors ligne (`tools/rejeu-voie-predite.cjs`,
  * `tools/memoire-differes.cjs`) s'en servent pour leurs chiffres, de sorte que l'extension et les rejeux ne puissent
  * pas diverger. Aucune position absolue ne sort d'ici dans un événement : des décalages en mm dans le repère profil de
  * la pose de départ d'ESV, des numéros de cut, des comptes.
  *
  * Deux formes du recentrage, la même règle :
  *   - `recentrer` : sur le vrai nuage, par `LotDecision.decideCut` (la reprise « depuis la voie » du lot : rails
  *     translatés sur la voie, fenêtre d'analyse et grille recentrées, puis choix du minimum à 15 mm) ;
  *   - `choisirDansLePool` : hors ligne, sans nuage, dans un pool de candidats déjà calculé (G1) : candidats à 15 mm
  *     de la voie, au moins 5 points de dessus et 3 de flanc, pente non limitée, un seul minimum (minima distincts à
  *     plus de 20 mm), écartement de la paire dans le contrat. */
 const VERSION='voie-recentree-v1';
 const SIDES=['left','right'];
 const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
 const r2=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
 const med=a=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),i=b.length>>1;return b.length%2?b[i]:(b[i-1]+b[i])/2;};

 /* Règle prudente D-147 (seuils lus sur la partie 1 du second projet et la partie 29 ; les réglages de l'extension les
  * reprennent, `settings.voiePrediteOmbre`). */
 const REGLE_PRUDENTE=Object.freeze({etages:Object.freeze(['window']),confianceMin:55,ecartementVoisinMm:10,profondeurMax:10,fenetreMm:30,dezoomMax:1.5,glissementPxMax:250});
 /* Mémoire de la série G1 (b), réglage retenu hors partie (D-148) : voie prolongée depuis les dernières poses de
  * l'opérateur, 3 derniers cuts corrigés de la série, dispersion (3 mm par cut d'éloignement) au plus 10 mm. */
 const MEMOIRE_SERIE=Object.freeze({ecartSerieMax:10,K:3,appuis:2,mmParCut:3,porteDispersionMm:10,etages:Object.freeze(['first-pass','window','choice'])});
 /* Recalage dans un pool (forme hors ligne) : mêmes filtres que le choix du lot (`lot-decision.js`, `chooseRail`). */
 const POOL=Object.freeze({tolMm:15,minHaut:5,minFlanc:3,separationMm:20});
 /* Jugement commun des ombres contre la pose finale de l'opérateur (pire des deux rails, en 3D). */
 const JUGEMENT=Object.freeze({justeMm:5,fauxMm:10,mauvaiseVoieMm:50});

 /* ------------------------------------------------------------------ repères */
 /* Écart (mm) d'une position scène à la pose de départ, dans le repère profil du rail : [long, lat, vert]. */
 function localMm(rail,p){
   const M=rail.sceneRelativeToProfileLocal,a=C.point(M,p),o=C.point(M,rail.positionSceneRelative);
   return [0,1,2].map(i=>(a[i]-o[i])*1000);
 }
 /* Pose d'une paire en décalages arrondis au dixième de mm (ce qui sort dans un événement : jamais une coordonnée). */
 function poseMm(capture,positions){
   if(!positions)return null;
   return Object.fromEntries(SIDES.map(s=>[s,localMm(capture.rails[s],positions[s]).map(r1)]));
 }

 /* ------------------------------------------------------------------ vue */
 /* Ce qu'il faut pour que le clic tombe dans l'écran du rail. `dezoom` : facteur sur la demi-largeur de la vue (1 = la
  * cible est déjà dans la vue, marge de 1 % comprise) ; `panPx` : glissement du fond d'écran en pixels à échelle égale ;
  * `panMm` : le même en mm. Un rail dont la caméra est inconnue rend `inconnu`. */
 function vueNecessaire(capture,positions,marge=L.VIEW_MARGIN){
   const cams=L.viewCameras(capture),par={};let dans=true,inconnu=false,dezoom=1,panPx=0,panMm=0;
   for(const s of SIDES){
     const cam=cams[s];
     if(!cam||!cam.viewport){inconnu=true;par[s]=null;continue;}
     const ndc=C.point(C.multiply(cam.projection,cam.sceneRelativeToCamera),positions[s]);
     const ax=Math.abs(ndc[0]),ay=Math.abs(ndc[1]),k=Math.max(ax,ay)/marge;
     const exX=Math.max(0,ax-marge),exY=Math.max(0,ay-marge);
     const pxX=exX*cam.viewport.width/2,pxY=exY*cam.viewport.height/2;
     const mmX=exX*1000/Math.abs(cam.projection[0]),mmY=exY*1000/Math.abs(cam.projection[5]);
     const ok=k<=1&&Math.abs(ndc[2])<=1;
     par[s]={ok,dezoom:Math.max(1,k),panPx:Math.max(pxX,pxY),panMm:Math.max(mmX,mmY),ndc:[ndc[0],ndc[1]]};
     if(!ok)dans=false;
     dezoom=Math.max(dezoom,par[s].dezoom);panPx=Math.max(panPx,par[s].panPx);panMm=Math.max(panMm,par[s].panMm);
   }
   return {dans:dans&&!inconnu,inconnu,dezoom,panPx,panMm,par};
 }
 /* Caméras élargies : « la vue est déplacée » — la cible tombe dans l'écran ; on mesure ensuite ce que cela a coûté. */
 function camerasLarges(capture){
   const cams=L.viewCameras(capture),out={};
   for(const s of SIDES){const c=cams[s];out[s]=c?{...c,projection:c.projection.map((v,i)=>(i===0||i===5)?v/1000:v)}:null;}
   return out;
 }
 /* Le geste de vue qu'il AURAIT fallu (jamais fait) : dans la vue ; sinon un dézoom s'il suffit dans la limite ;
  * sinon un glissement s'il tient dans la limite ; sinon hors limites. */
 function geste(vue,seuils=REGLE_PRUDENTE){
   if(!vue)return null;
   const base={dezoom:r2(vue.dezoom),glissementPx:r1(vue.panPx),glissementMm:r1(vue.panMm)};
   if(vue.inconnu)return {geste:'inconnu',...base};
   if(vue.dans)return {geste:'dans-la-vue',...base};
   if(Number.isFinite(seuils?.dezoomMax)&&vue.dezoom<=seuils.dezoomMax)return {geste:'dezoom',...base};
   if(Number.isFinite(seuils?.glissementPxMax)&&vue.panPx<=seuils.glissementPxMax)return {geste:'glissement',...base};
   return {geste:'hors-limites',...base};
 }

 /* ------------------------------------------------------------------ moteur relancé */
 /* Ce que le moteur relancé depuis la voie a vu, par rail (pour juger une règle sans le rejouer). */
 function traceMoteur(sci){
   if(!sci)return null;
   const out={};
   for(const s of SIDES){
     const r=sci.rails?.[s];
     out[s]=r&&r.ok?{statut:r.next.status,motif:r.next.motif,confiance:r.astar?.confidence??null,topRows:r.next.topRows??null,faceCount:r.next.faceCount??null,
       rapportPerte:r.astar?.lossRatio??null,s1:!!r.s1Changed,flancPartiel:!!r.partialFlankUsed,fortsConcurrents:r.competitive?.nStrongCompetitive??null}:{statut:'absent'};
   }
   out.ecartementMm=sci.pairGauge?.predictedMm??null;
   return out;
 }
 /* Confiance par rail : un nombre, « s1 » (rail retenu par S1 : pas de confiance calibrée) ou null. */
 const confiances=trace=>trace?Object.fromEntries(SIDES.map(s=>[s,trace[s]?.s1?'s1':Number.isFinite(trace[s]?.confiance)?r1(trace[s].confiance):null])):null;
 /* Profondeur de chaîne : 0 pour une pose du moteur seul (premier passage), sinon 1 + la plus grande profondeur des
  * appuis de la prédiction. `profondeurAppui(cut)` : profondeur connue d'un appui (0 par défaut). */
 function profondeur(decision,profondeurAppui=()=>0){
   return decision?.stage==='first-pass'?0:1+Math.max(0,...(decision?.anchorsUsed||[]).map(c=>profondeurAppui(c)??0));
 }
 /* Prédiction de voie employée par la décision, [latéral, vertical] mm par rail ; null si un appui manque. */
 function predictionDe(capture,decision,appuis){
   const cuts=new Set(decision.anchorsUsed||[]);
   const liste=(appuis||[]).filter(a=>cuts.has(a.identity.cut));
   if(!liste.length||liste.length!==cuts.size)return null;
   const out={};
   for(const s of SIDES){
     const p=(decision.framedAnchors?.length?L.predictFramed:O.predict)(capture.rails[s],liste.map(a=>({positions:a.positions})),s);
     out[s]=[p.lateral*1000,p.vertical*1000];
   }
   return out;
 }
 /* Mesures d'une pose reprise depuis la voie : déplacement depuis le départ, écarts à la prédiction, dévers et
  * écartement comparés à ceux des appuis employés. */
 function mesures(capture,decision,positions,appuis){
   const out={deplacementMm:Object.fromEntries(SIDES.map(s=>{const l=localMm(capture.rails[s],positions[s]);return [s,[l[1],l[2]]];}))};
   if(decision.stage!=='window'&&decision.stage!=='choice')return out;
   const utilises=(appuis||[]).filter(a=>(decision.anchorsUsed||[]).includes(a.identity.cut));
   const pr=predictionDe(capture,decision,appuis);
   if(pr){
     out.prediction=pr;
     out.devLatMm=Math.max(...SIDES.map(s=>Math.abs(out.deplacementMm[s][0]-pr[s][0])));
     out.devVertMm=Math.max(...SIDES.map(s=>Math.abs(out.deplacementMm[s][1]-pr[s][1])));
   }
   if(utilises.length){
     const dev=a=>a.positions.left[2]-a.positions.right[2],g=a=>C.distance(a.positions.left,a.positions.right)*1000;
     out.deversEcartMm=Math.abs((positions.left[2]-positions.right[2])-med(utilises.map(dev)))*1000;
     out.ecartementMm=C.distance(positions.left,positions.right)*1000;
     out.ecartVoisinMm=Math.abs(out.ecartementMm-med(utilises.map(g)));
   }
   return out;
 }

 /* ------------------------------------------------------------------ règle */
 /* Règle de recentrage, sur une pose NOUVELLE. Chaque seuil nul est inactif (clés du rejeu, voir
  * `tools/rejeu-voie-predite.cjs`) :
  *   etages, fenetreMm, confMin (DEUX rails ; un rail retenu par S1 n'est pas jugé), vertMm, ecartVoisinMm, deversMm,
  *   cohMm, cohVMm, appuisMin, profMax, sansAncre, adv ({...} plus strict, ou false : aucune pose nouvelle en ADV) ;
  *   dezoomMax / panPxMax : la pose n'est possible que si la vue peut être amenée (dézoom OU glissement dans la limite).
  * Rend null (acceptée) ou le motif du refus. */
 function regle(g,r,zone=null,temoinRow=null){
   const adv=!!zone?.adv;
   const k=adv&&g.adv&&typeof g.adv==='object'?{...g,...g.adv}:g;
   if(adv&&g.adv===false)return 'adv-interdit';
   if(g.sansAncre&&temoinRow&&temoinRow.reason!=='no-anchor')return 'avec-ancre';
   if(k.etages&&!k.etages.includes(r.stage))return 'etage';
   if(k.fenetreMm!=null&&r.fromPredictionMm!=null&&r.fromPredictionMm>k.fenetreMm)return 'fenetre';
   if(k.appuisMin!=null&&(r.anchorsUsed||[]).length+(r.validatedAnchors||[]).length<k.appuisMin)return 'appuis';
   if(k.profMax!=null&&r.profondeur>k.profMax)return 'profondeur';
   if(k.confMin!=null&&r.stage==='window'){
     const c=SIDES.map(s=>r.moteur?.[s]?.s1?Infinity:r.moteur?.[s]?.confiance);
     if(!c.every(x=>Number.isFinite(x)||x===Infinity)||!c.every(x=>x>=k.confMin))return 'confiance';
   }
   if(k.vertMm!=null&&r.devVertMm!=null&&r.devVertMm>k.vertMm)return 'vertical';
   if(k.deversMm!=null&&r.deversEcartMm!=null&&r.deversEcartMm>k.deversMm)return 'devers';
   if(k.ecartVoisinMm!=null&&r.ecartVoisinMm!=null&&r.ecartVoisinMm>k.ecartVoisinMm)return 'ecartement-voisin';
   if(k.cohMm!=null&&r.deplacementMm&&Math.abs(r.deplacementMm.left[0]-r.deplacementMm.right[0])>k.cohMm)return 'coherence';
   if(k.cohVMm!=null&&r.deplacementMm&&Math.abs(r.deplacementMm.left[1]-r.deplacementMm.right[1])>k.cohVMm)return 'coherence-vertical';
   if(k.dezoomMax!=null||k.panPxMax!=null){
     if(!r.vue||r.vue.inconnu)return 'vue-inconnue';
     if(!r.vue.dans&&!((k.dezoomMax!=null&&r.vue.dezoom<=k.dezoomMax)||(k.panPxMax!=null&&r.vue.panPx<=k.panPxMax)))return 'vue';
   }
   return null;
 }
 /* Les seuils des réglages (noms de l'extension) en clés de la règle. */
 function enRegle(s=REGLE_PRUDENTE){
   return {etages:s.etages?[...s.etages]:null,confMin:s.confianceMin??null,ecartVoisinMm:s.ecartementVoisinMm??null,profMax:s.profondeurMax??null,
     fenetreMm:s.fenetreMm??null,dezoomMax:s.dezoomMax??null,panPxMax:s.glissementPxMax??null};
 }
 /* Verdict de la règle prudente sur un résultat de `completer` : posable ou non, et pourquoi. */
 function verdictPrudent(r,seuils=REGLE_PRUDENTE){
   if(!r.posee)return {posable:false,raison:r.stage==='deferred'?'differe:'+String(r.reason||'?').slice(0,60):'sans-pose:'+String(r.commande?.reason||r.stage||'?').slice(0,60)};
   const motif=regle(enRegle(seuils),r);
   return motif?{posable:false,raison:motif}:{posable:true,raison:null};
 }

 /* ------------------------------------------------------------------ recentrage sur le vrai nuage */
 /* Complète une décision : commande (vue telle quelle, ou déplacée), positions posées, trace du moteur relancé,
  * vue nécessaire, mesures, profondeur. Sans `runtimeRails` (Écho), la pose est celle de la décision. */
 function completer({capture,decision,relance=null,appuis=[],runtimeRails=null,before=null,expectedPoses=null,vue='deplacee',profondeurAppui}){
   let commande=null,positions=null;
   if(runtimeRails&&before&&typeof expectedPoses==='function'){
     const cameras=vue==='deplacee'?camerasLarges(capture):L.viewCameras(capture);
     const cmd=L.commandRails({decision,runtimeRails,before,expectedPoses,cameras});
     commande={action:cmd.action,reason:cmd.reason??null};
     if(cmd.action==='lot')positions=decision.positions;
     else if(cmd.action==='engine'&&SIDES.every(s=>runtimeRails[s]?.status==='candidate')){
       try{const e=expectedPoses({rails:before},runtimeRails);positions=Object.fromEntries(SIDES.map(s=>[s,e[s].positionSceneRelative]));}catch{positions=null;}
     }
   }else if(decision?.positions&&decision.stage!=='deferred')positions=decision.positions;
   const r={version:VERSION,stage:decision?.stage??null,reason:decision?.reason??null,anchorsUsed:(decision?.anchorsUsed||[]).slice(),validatedAnchors:decision?.validatedAnchors||null,
     framed:!!decision?.framedAnchors,fromPredictionMm:decision?.fromPredictionMm??null,guardMm:decision?.guardMm??null,anchor:!!decision?.anchor,
     profondeur:profondeur(decision,profondeurAppui),commande,posee:!!positions,positions,
     moteur:decision?.stage==='window'||decision?.stage==='choice'?traceMoteur(relance):null};
   if(positions){
     Object.assign(r,mesures(capture,decision,positions,appuis));
     /* La vue n'existe que si la capture porte ses caméras (Orbite) ; l'Écho n'en a pas besoin (il ne bouge jamais la vue). */
     r.vue=capture.camera||capture.viewCaptures?.length?vueNecessaire(capture,positions):null;
   }
   return r;
 }
 /* Le moteur recentré sur une voie prédite. La voie est donnée par des APPUIS (positions de scène des cuts voisins :
  * poses du lot, ou corrections validées de l'opérateur ; deux suffisent, la droite qui passe par eux est la voie) —
  * `LotDecision.decideCut` relance alors le moteur sur les rails translatés sur cette voie. `Shadow` : le moteur GCV1
  * (`gcv1-shadow.js`), appelé tel quel ; le résultat de la relance est seulement lu (confiance). */
 function recentrer({capture,science,anchors=[],validated,Shadow,options,profondeurAppui,runtimeRails,before,expectedPoses,vue='deplacee'}){
   let relance=null;
   const moteur=Object.create(Shadow);
   moteur.scientificProposeBoth=c=>{relance=Shadow.scientificProposeBoth(c);return relance;};
   const decision=L.decideCut({capture,science,anchors,validated,Shadow:moteur,...(options?{options}:{})});
   return {decision,...completer({capture,decision,relance,appuis:[...anchors,...(validated||[])],runtimeRails,before,expectedPoses,vue,profondeurAppui})};
 }
 /* La voie donnée par un DÉCALAGE ([latéral, vertical] mm par rail, repère profil de la pose de départ) : deux appuis
  * fictifs sur la droite parallèle à la pose de départ, à 1 et 2 cuts avant le cut. Sert aux essais et aux outils ;
  * les ombres passent des appuis réels (leur écartement nourrit la garde d'écartement voisin). */
 function appuisDepuisDecalage(capture,decalage){
   const id=capture.identity;
   return [1,2].map(k=>({identity:{part:id.part,cut:id.cut-k,frameId:id.frameId??null},stage:'decalage',
     positions:Object.fromEntries(SIDES.map(s=>{const r=capture.rails[s],M=r.sceneRelativeToProfileLocal,P=r.profileLocalToSceneRelative,o=C.point(M,r.positionSceneRelative);
       return [s,C.point(P,[o[0]-k,o[1]+decalage[s][0]/1000,o[2]+decalage[s][1]/1000])];}))}));
 }

 /* ------------------------------------------------------------------ recentrage dans un pool (hors ligne, G1) */
 /* Candidats d'un rail : { fla, fve, perte, haut, flanc, pente } (mm, repère profil, calage de convention compris).
  * `voie` : [latéral, vertical] mm par rail. `ecartementAdmissible(pose)` : contrôle du contrat de la paire. Rend
  * { pose: { left|gauche: [la, ve], ... } } ou { pose: null, raison }. Les clés de rail sont celles du pool. */
 function choisirDansLePool(pools,voie,ecartementAdmissible,options={}){
   const o={...POOL,...options},pose={};
   for(const c of Object.keys(voie)){
     const pres=(pools[c]||[]).filter(cd=>cd.haut>=o.minHaut&&cd.flanc>=o.minFlanc&&!cd.pente&&Math.hypot(cd.fla-voie[c][0],cd.fve-voie[c][1])<=o.tolMm);
     const grappes=[];
     for(const cd of pres.slice().sort((a,b)=>a.perte-b.perte))if(!grappes.some(g=>Math.hypot(g.fla-cd.fla,g.fve-cd.fve)<o.separationMm))grappes.push(cd);
     if(grappes.length!==1)return {pose:null,raison:grappes.length?'plusieurs minima près de la voie':'aucun minimum près de la voie'};
     pose[c]=[grappes[0].fla,grappes[0].fve];
   }
   if(typeof ecartementAdmissible==='function'&&!ecartementAdmissible(pose))return {pose:null,raison:'écartement hors contrat'};
   return {pose};
 }

 /* ------------------------------------------------------------------ jugement commun */
 /* Une pose d'ombre contre la pose finale de l'opérateur : écart 3D par rail (mm), le pire des deux. */
 function ecartPose(pose,mic){
   if(!pose||!mic)return null;
   const e=SIDES.map(s=>{const p=pose[s],m=mic[s];if(!p||!m)return NaN;return Math.hypot((m[0]??0)-(p.length===3?p[0]:0),m[1]-(p.length===3?p[1]:p[0]),m[2]-(p.length===3?p[2]:p[1]));});
   return e.every(Number.isFinite)?Math.max(...e):null;
 }
 /* Classe commune : juste5 (≤ 5 mm), juste10 (≤ 10 mm), fausse (> 10 mm), mauvaise-voie (> 50 mm par défaut). */
 function juger(ecartMm,seuils=JUGEMENT){
   if(!Number.isFinite(ecartMm))return 'non-jugee';
   if(ecartMm>seuils.mauvaiseVoieMm)return 'mauvaise-voie';
   if(ecartMm>seuils.fauxMm)return 'fausse';
   return ecartMm<=seuils.justeMm?'juste5':'juste10';
 }

 /* ------------------------------------------------------------------ ombre d'Orbite (voie-predite-ombre) */
 /* Mémoire de l'ombre, propre au lot : les poses que la règle aurait faites (elles deviennent appuis de l'ombre, jamais
  * du lot) et la profondeur de chaîne connue par cut. Volatile : un redémarrage du service worker la vide (la chaîne
  * de l'ombre repart alors des seuls appuis réels, ce qui est prudent). */
 function creerMemoire(batchId=null){return {batchId,poses:[],profondeurs:new Map()};}
 const meme=(a,b)=>!!a&&!!b&&a.part===b.part&&(a.frameId??null)===(b.frameId??null);
 const PROFONDEURS_MAX=400,POSES_MAX=40;
 function noterProfondeur(mem,cut,p){mem.profondeurs.delete(cut);mem.profondeurs.set(cut,p);while(mem.profondeurs.size>PROFONDEURS_MAX)mem.profondeurs.delete(mem.profondeurs.keys().next().value);}
 /* Toute décision réelle du lot : sa profondeur de chaîne (ses appuis réels). */
 function noterDecisionReelle(mem,identity,decision){
   if(!mem||!Number.isInteger(identity?.cut)||!decision)return null;
   const p=profondeur(decision,c=>mem.profondeurs.get(c)??0);noterProfondeur(mem,identity.cut,p);return p;
 }
 /* Appuis de l'ombre : ceux du lot réel, plus les poses de l'ombre des cuts que le lot n'a pas posés. */
 function appuisOmbre(mem,reels){
   const vus=new Set((reels||[]).map(a=>a.identity.part+'|'+(a.identity.frameId??'')+'|'+a.identity.cut));
   return [...mem.poses.filter(p=>!vus.has(p.identity.part+'|'+(p.identity.frameId??'')+'|'+p.identity.cut)),...(reels||[])];
 }
 /* Faut-il relancer le moteur ? Oui si la décision réelle a des positions (reprise refusée par la vue ou la commande :
  * il faut la trace du moteur relancé) ou si une pose de l'ombre est assez proche pour changer les appuis. */
 function doitRecalculer(mem,identity,decisionReelle){
   if(decisionReelle?.stage&&decisionReelle.stage!=='deferred')return true;
   const portee=Math.max(L.DEFAULTS.gap,L.DEFAULTS.frameGap,L.DEFAULTS.gaugeGap);
   return mem.poses.some(p=>meme(p.identity,identity)&&p.identity.cut!==identity.cut&&Math.abs(p.identity.cut-identity.cut)<=portee);
 }
 /* Un cut que le lot DIFFÈRE : ce qu'aurait donné la règle prudente, vue déplacée. Rend { evenement, r }.
  * Rien de ce qui est lu n'est modifié ; seule `mem` (la mémoire de l'ombre) l'est. */
 function evaluerDiffere({mem,capture,science,ancresReelles,decisionReelle,commandeReelle=null,Shadow,runtimeRails,before,expectedPoses,seuils=REGLE_PRUDENTE}){
   const identity=capture.identity,profondeurAppui=c=>mem.profondeurs.get(c)??0;
   const recalcule=doitRecalculer(mem,identity,decisionReelle);
   const ancres=appuisOmbre(mem,ancresReelles);
   const r=recalcule
     ?recentrer({capture,science,anchors:ancres,Shadow,runtimeRails,before,expectedPoses,vue:'deplacee',profondeurAppui})
     :{decision:decisionReelle,...completer({capture,decision:decisionReelle,appuis:ancresReelles,runtimeRails,before,expectedPoses,vue:'deplacee',profondeurAppui})};
   const verdict=verdictPrudent(r,seuils);
   const deOmbre=new Set(mem.poses.map(p=>p.identity.cut));
   if(verdict.posable&&r.anchor&&L.commandsPositions(r.decision,{action:r.commande?.action??'lot'})){
     const i=mem.poses.findIndex(p=>meme(p.identity,identity)&&p.identity.cut===identity.cut);if(i>=0)mem.poses.splice(i,1);
     mem.poses.push({identity:{part:identity.part,cut:identity.cut,frameId:identity.frameId??null},positions:r.positions,stage:r.stage,profondeur:r.profondeur});
     while(mem.poses.length>POSES_MAX)mem.poses.shift();
     noterProfondeur(mem,identity.cut,r.profondeur);
   }
   const evenement={version:'voie-predite-ombre-v1',identity:{part:identity.part??null,cut:identity.cut??null},
     reel:{stage:decisionReelle?.stage??null,reason:decisionReelle?.reason!=null?String(decisionReelle.reason).slice(0,80):null,
       commande:commandeReelle?`${commandeReelle.action}:${commandeReelle.reason??''}`.slice(0,60):null},
     recalcule,etage:r.stage,raison:r.reason!=null?String(r.reason).slice(0,80):null,appuis:r.anchorsUsed,appuisOmbre:r.anchorsUsed.filter(c=>deOmbre.has(c)),
     profondeur:r.profondeur,confiance:confiances(r.moteur),ecartVoieMm:r1(r.fromPredictionMm),ecartementVoisinMm:r1(r.ecartVoisinMm),
     vue:r.posee?geste(r.vue,seuils):null,poseMm:r.posee?poseMm(capture,r.positions):null,verdict};
   return {evenement,r};
 }

 /* ------------------------------------------------------------------ ombre de l'Écho (memoire-differes-ombre) */
 /* Séries de différés : cuts différés qui se suivent avec un trou de `ecart` cuts au plus (comme G1). */
 function series(cuts,ecart=MEMOIRE_SERIE.ecartSerieMax){
   const tri=[...new Set(cuts)].filter(Number.isInteger).sort((a,b)=>a-b),res=new Map();let cur=[];
   const ferme=()=>{cur.forEach((c,i)=>res.set(c,{id:cur[0],rang:i,longueur:cur.length}));cur=[];};
   for(const c of tri){if(cur.length&&c-cur[cur.length-1]>ecart)ferme();cur.push(c);}
   ferme();return res;
 }
 /* Mémoire de la série d'un cut : parmi les corrections DÉJÀ VALIDÉES par l'opérateur (visites antérieures), celles des
  * cuts de la même série (même partie, même repère de scène), les `K` plus proches ; dispersion = éloignement maximal
  * (cuts) × `mmParCut` ; les `appuis` plus proches deviennent les appuis de la voie. `validees` : [{ identity, visitIndex,
  * positions }] ; `differes` : numéros des cuts différés par le lot dans la partie. */
 function memoireSerie({identity,differes,validees,seuils=MEMOIRE_SERIE}){
   const s={...MEMOIRE_SERIE,...seuils},ser=series(differes||[],s.ecartSerieMax),serie=ser.get(identity.cut)||null;
   if(!serie)return {etat:'hors-serie',serie:null,memoire:null,appuis:[]};
   const parCut=new Map();
   for(const v of validees||[]){
     if(!meme(v.identity,identity)||v.identity.cut===identity.cut||ser.get(v.identity.cut)?.id!==serie.id)continue;
     const k=parCut.get(v.identity.cut);if(!k||v.visitIndex>k.visitIndex)parCut.set(v.identity.cut,v);
   }
   const mem=[...parCut.values()].sort((a,b)=>Math.abs(a.identity.cut-identity.cut)-Math.abs(b.identity.cut-identity.cut)||b.visitIndex-a.visitIndex).slice(0,s.K);
   if(!mem.length)return {etat:'sans-memoire',serie,memoire:{cuts:[],n:0,dispersionMm:null,porteMm:s.porteDispersionMm},appuis:[]};
   const dispersion=Math.max(...mem.map(v=>Math.abs(v.identity.cut-identity.cut)))*s.mmParCut;
   const memoire={cuts:mem.map(v=>v.identity.cut),n:mem.length,dispersionMm:dispersion,porteMm:s.porteDispersionMm};
   if(dispersion>s.porteDispersionMm)return {etat:'serie-instable',serie,memoire,appuis:[]};
   return {etat:'ok',serie,memoire,appuis:mem.slice(0,s.appuis).map(v=>({identity:{part:v.identity.part,cut:v.identity.cut,frameId:v.identity.frameId??null},positions:v.positions,stage:'operateur'}))};
 }
 /* Le calcul de l'Écho, sur une entrée SANS FUITE (pose de départ, points capturés avant le premier geste ; jamais la
  * référence humaine de la visite) : la mémoire de la série, puis le moteur recentré sur la voie des corrections. */
 function evaluerEcho({entree,differes,validees,Shadow,seuils=MEMOIRE_SERIE}){
   const s={...MEMOIRE_SERIE,...seuils},identity=entree.identity;
   const m=memoireSerie({identity,differes,validees,seuils:s});
   const base={version:'memoire-differes-ombre-v1',identity:{part:identity.part??null,cut:identity.cut??null},frontiere:'avant-reference',etat:m.etat,
     serie:m.serie,memoire:m.memoire};
   if(m.etat!=='ok')return {evenement:{...base,verdict:{posable:false,raison:m.etat}},r:null};
   const capture={identity,rails:entree.rails,pointsSceneRelative:entree.points,visibleByClipBoxes:entree.visible};
   const science=Shadow.scientificProposeBoth(capture);
   const r=recentrer({capture,science,anchors:m.appuis,Shadow,vue:null});
   const posable=r.posee&&(s.etages||MEMOIRE_SERIE.etages).includes(r.stage);
   return {r,evenement:{...base,etat:'calcule',etage:r.stage,raison:r.reason!=null?String(r.reason).slice(0,80):null,appuis:r.anchorsUsed,
     confiance:confiances(r.moteur),ecartVoieMm:r1(r.fromPredictionMm),poseMm:r.posee?poseMm(capture,r.positions):null,
     verdict:posable?{posable:true,raison:null}:{posable:false,raison:r.posee?'etage':'differe:'+String(r.reason||'?').slice(0,60)}}};
 }

 return {VERSION,REGLE_PRUDENTE,MEMOIRE_SERIE,POOL,JUGEMENT,localMm,poseMm,vueNecessaire,camerasLarges,geste,traceMoteur,confiances,profondeur,predictionDe,mesures,
   regle,enRegle,verdictPrudent,completer,recentrer,appuisDepuisDecalage,choisirDansLePool,ecartPose,juger,
   creerMemoire,noterDecisionReelle,appuisOmbre,doitRecalculer,evaluerDiffere,series,memoireSerie,evaluerEcho};
});
