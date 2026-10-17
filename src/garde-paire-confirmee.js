(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./lot-decision.js'),require('./continuity-observer.js'));
  else root.BananeGardePaireConfirmee=factory(root.BananeCaptureCore,root.BananeLotDecision,root.BananeContinuityObserver);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,L,O){
 'use strict';
 /* 5.0 (D-170, chantier P7, hypothèse « garde de paire confirmée ») — POST-TRAITEMENT d'un cut que la GARDE DE PAIRE retire
  * (`reason: 'pair-guard'` : rail repêché par S1 et calage de convention hors domaine, D-044), fiches/P7_GARDE_PAIRE_CONFIRMEE.md.
  *
  * Constat du catalogue des échecs (ADV, abords, grappes) : sur les cuts de zone que la garde diffère, le moteur brut est juste dans
  * 8 cas sur 12 et faux dans 4, dont 2 que la garde évite d'abîmer. Correctif essayé : la garde est levée seulement si la voie la
  * CONFIRME :
  *   - la décision livrée est relancée SANS la garde de paire (`LotDecision.decideCut`, option livrée `pairGuard:false`) ; seule une
  *     pose au PREMIER PASSAGE compte (la proposition du moteur, gardes d'écartement livrées comprises) : une reprise depuis la voie ou
  *     un choix ne sont pas ce cas ;
  *   - cette paire est comparée à la voie de la CHAÎNE (appuis de prédiction livrés : voie encadrée si possible, sinon les plus proches
  *     à `gap` cuts) et à la voie des VOISINS SÛRS (poses actuelles à ±`rayon` cuts, jamais le cut lui-même, jamais un différé du lot,
  *     jamais une pose fictive à 1 500 mm, jamais une pose de l'opérateur ; garde de cohérence livrée `consistentValidated`) ;
  *   - elle est posée si l'une des voies tombe à `nMm` au plus, sur le pire des deux rails, en latéral seul (`axes:'l'`) ou en latéral
  *     et vertical (`axes:'lv'`).
  * La voie n'est qu'une GARDE, jamais une cible (D-033) : la pose posée est celle du moteur. Elle ne devient JAMAIS un appui de la
  * chaîne (`anchor:false`) : une levée fausse ne se propage pas.
  *
  * Fonction PURE : ni horloge, ni réglage global, ni écriture ; rien n'est modifié dans les entrées. COUPÉE par défaut (`options.actif`
  * doit valoir `true`). Une panne rend la décision reçue telle quelle. `leve` (la décision sans la garde, non confirmée) n'est rendue
  * que pour l'étude hors ligne, qui rejoue plusieurs seuils sur une même extraction ; elle ne commande rien. */
 const VERSION='garde-paire-confirmee-v1';
 const SIDES=['left','right'];
 const SOURCES=Object.freeze(['chaine','voisins']);
 const DEFAUTS=Object.freeze({actif:false,nMm:10,axes:'lv',sources:SOURCES,rayon:5,ecartementFictifMm:1500,toleranceFictiveMm:0.5});
 /* Seuils essayés par l'étude (tools/relecture-autonome.cjs etudier --garde-paire-confirmee), réglés en validation croisée par partie. */
 const GRILLE=Object.freeze([5,10,20].flatMap(nMm=>['lv','l'].map(axes=>Object.freeze({nMm,axes}))));
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const vec3=v=>Array.isArray(v)&&v.length>=3&&v.slice(0,3).every(fini);
 const r1=v=>fini(v)?Math.round(v*10)/10:null;
 const cfgDe=options=>({...DEFAUTS,...(options||{})});

 /* Pose fictive d'ESV : écartement par défaut (1 500 mm) à `toleranceFictiveMm` près. */
 function estFictive(positions,options){
   const cfg=cfgDe(options);
   if(!positions||!SIDES.every(s=>vec3(positions[s])))return false;
   return Math.abs(1000*C.distance(positions.left,positions.right)-cfg.ecartementFictifMm)<cfg.toleranceFictiveMm;
 }
 /* Voisins sûrs : `poses` = [{ identity:{part,cut,frameId}, positions:{left,right}, differe }] (poses ACTUELLES). */
 function voisinsSurs(identity,poses,options){
   const cfg=cfgDe(options),out=[];
   if(!identity||!Number.isInteger(identity.cut))return out;
   for(const p of poses||[]){
     const id=p&&p.identity;
     if(!id||id.part!==identity.part||(id.frameId??null)!==(identity.frameId??null)||!Number.isInteger(id.cut))continue;
     if(id.cut===identity.cut||Math.abs(id.cut-identity.cut)>cfg.rayon)continue;
     if(p.differe!==false)continue;
     if(!p.positions||!SIDES.every(s=>vec3(p.positions[s]))||estFictive(p.positions,cfg))continue;
     out.push({identity:{part:id.part,cut:id.cut,frameId:id.frameId??null},positions:{left:p.positions.left.slice(0,3),right:p.positions.right.slice(0,3)}});
   }
   return out.sort((a,b)=>a.identity.cut-b.identity.cut);
 }
 /* Écarts (mm, valeur absolue, par rail) entre des positions et une voie prédite, repère profil de la pose ESV de chaque rail. */
 function ecartsVoie(rails,list,positions,Lot=L){
   const predict=list.framed?Lot.predictFramed:O.predict,lat=[],vert=[];
   for(const s of SIDES){
     const r=rails[s],M=r.sceneRelativeToProfileLocal,o=C.point(M,r.positionSceneRelative),q=C.point(M,positions[s]),p=predict(r,list,s);
     lat.push(r1(Math.abs((q[1]-o[1]-p.lateral)*1000)));vert.push(r1(Math.abs((q[2]-o[2]-p.vertical)*1000)));
   }
   return {lat,vert};
 }
 /* Les voies auxquelles la paire est comparée. `chaine` : null sans appui de prédiction ; `voisins` : candidats, gardés par la
  * cohérence, et les écarts s'il en reste. */
 function voies({capture,anchors,poses,positions,options,lotOptions,Lot=L}){
   const cfg=cfgDe(options),lc={...Lot.DEFAULTS,...(lotOptions||{})},id=capture.identity,rails=capture.rails,out={chaine:null,voisins:null};
   if(cfg.sources.includes('chaine')){
     const nb=Lot.neighbours(id,anchors||[],lc),pred=Lot.predictionAnchors(id,anchors||[],nb,lc);
     if(pred.list.length)out.chaine={appuis:pred.cuts.slice(),encadree:!!pred.framed,...ecartsVoie(rails,pred.list,positions,Lot)};
   }
   if(cfg.sources.includes('voisins')){
     const cands=voisinsSurs(id,poses,cfg),kept=cands.length>=lc.validatedMinInliers?Lot.consistentValidated(id,rails,cands,lc):[];
     out.voisins={candidats:cands.length,gardes:kept.map(a=>a.identity.cut).sort((a,b)=>a-b)};
     if(kept.length)Object.assign(out.voisins,ecartsVoie(rails,kept.map(a=>({positions:a.positions})),positions,Lot));
   }
   return out;
 }
 /* Écart d'une voie à la paire : le pire des deux rails, en latéral seul (`'l'`) ou en latéral et vertical (`'lv'`). null sans voie. */
 function ecartMax(voie,axes){
   if(!voie||!Array.isArray(voie.lat)||!Array.isArray(voie.vert))return null;
   const v=SIDES.map((_,i)=>axes==='l'?voie.lat[i]:Math.max(voie.lat[i],voie.vert[i]));
   return v.every(fini)?Math.max(...v):null;
 }
 /* Confirmation : parmi les voies demandées qui existent, la plus proche à `nMm` au plus ; null sinon. */
 function confirme(v,options){
   const cfg=cfgDe(options);let best=null;
   for(const s of cfg.sources){const e=ecartMax(v&&v[s],cfg.axes);if(e===null||!(e<=cfg.nMm))continue;if(!best||e<best.ecartMm)best={source:s,ecartMm:e};}
   return best;
 }
 /* `decision` : celle de la chaîne pour ce cut ; `anchors` : appuis de la chaîne (lus, jamais modifiés) ; `poses` : poses actuelles des
  * voisins ; `Lot` : la décision livrée (injectable pour les essais). Rend { decision, tentative, leve } : `tentative` nul si la levée ne
  * s'applique pas (coupée, autre décision que la garde de paire) ; sinon étape et motif sans la garde, voies, confirmation, et si elle pose. */
 function lever({decision,capture,science,anchors,poses,Shadow,options,lotOptions,Lot=L}={}){
   const cfg=cfgDe(options);
   if(cfg.actif!==true||!decision||decision.reason!=='pair-guard'||decision.pairGuarded!==true||!capture||!capture.identity||!capture.rails)return {decision,tentative:null,leve:null};
   const t={version:VERSION,stage:null,reason:null,voies:null,confirmation:null,pose:false};
   let d2;
   try{d2=Lot.decideCut({capture,science,anchors:(anchors||[]).slice(),Shadow,options:{...(lotOptions||{}),pairGuard:false}});}
   catch{return {decision,tentative:{...t,reason:'panne'},leve:null};}
   t.stage=d2&&d2.stage||null;t.reason=d2&&d2.reason||null;
   if(!d2||d2.stage!=='first-pass'||!d2.positions)return {decision,tentative:{...t,reason:t.reason||'sans-premier-passage'},leve:null};
   let v;
   try{v=voies({capture,anchors,poses,positions:d2.positions,options:cfg,lotOptions,Lot});}
   catch{return {decision,tentative:{...t,reason:'panne'},leve:null};}
   const leve={...d2,anchor:false,post:'garde-paire-confirmee',liftedReason:'pair-guard'};
   const c=confirme(v,cfg);
   if(!c)return {decision,tentative:{...t,voies:v,reason:cfg.sources.some(s=>ecartMax(v[s],cfg.axes)!==null)?'voie-non-confirmee':'sans-voie'},leve};
   return {decision:{...leve,gardePaire:{version:VERSION,source:c.source,ecartMm:c.ecartMm,nMm:cfg.nMm,axes:cfg.axes}},tentative:{...t,voies:v,confirmation:c,pose:true},leve};
 }
 return {VERSION,DEFAUTS,SOURCES,GRILLE,estFictive,voisinsSurs,ecartsVoie,voies,ecartMax,confirme,lever};
});
