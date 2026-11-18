/* CH-070 : façades des modules de session sur le cœur WASM (ariane-session, fonctions 250 à 299), MÊME API, mêmes objets.
 *   const R=ArianeFacadeSession.resume(coeur, ArianePartSummary49)   → {FORMAT, projectEvent, summarize, fromJournal, contextOf, deferKind}
 * Entrée du cœur : {a:[arguments]} ; un refus « hors domaine » ou un refus du format (fonction, Map, Date… dans
 * l'entrée) rejoue le JS d'origine, compté. Les modules JS ne sont jamais modifiés. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.ArianeFacadeSession=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function compteur(){return {coeur:0,repliHorsDomaine:0,repliFormat:0,motifs:{}};}
 /* Appel du cœur ; repli sur `js()` si le cœur ne sait pas reproduire l'entrée. Les autres exceptions (celles du JS) passent. */
 function appel(coeur,n,fonction,entree,js){
  let r;
  try{r=coeur.appeler(fonction,entree);}
  catch(e){const repli=e&&e.name==='HorsDomaine'?'repliHorsDomaine':e instanceof TypeError&&/^VBA : /.test(e.message)?'repliFormat':null;if(!repli)throw e;
   n[repli]++;const m=fonction+' '+String(e.message).slice(0,60);n.motifs[m]=(n.motifs[m]||0)+1;return js();}
  n.coeur++;return r;
 }
 /* part-summary-49 (250–254). Un événement déjà projeté est rendu tel quel par le JS (identité de l'objet) : pas de cœur. */
 /* Locale de l'opérateur : `localeCompare` sans argument suit la locale par défaut du moteur ; le cœur ne sert que les
  * locales dont l'ordre ASCII est vérifié (js_extra.rs), les autres rejouent le JS. */
 const localeMoteur=()=>{try{return new Intl.Collator().resolvedOptions().locale;}catch{return null;}};
 function resume(coeur,P){
  const n=compteur(),locale=localeMoteur(),a=(f,args,js)=>appel(coeur,n,f,{a:args,locale},js);
  return {FORMAT:P.FORMAT,
   projectEvent(e){if(e&&typeof e==='object'&&e.projection===P.FORMAT)return P.projectEvent(e);return a(250,[e],()=>P.projectEvent(e));},
   summarize(...x){return a(251,x,()=>P.summarize(...x));},
   fromJournal(...x){return a(252,x,()=>P.fromJournal(...x));},
   contextOf(...x){return a(253,x,()=>P.contextOf(...x));},
   deferKind(...x){return a(254,x,()=>P.deferKind(...x));},
   compteurs:()=>({...n,motifs:{...n.motifs}})};
 }
 /* Appel sans repli intégré : rend REPLI si le cœur refuse (compté), à l'appelant de rejouer le JS. */
 const REPLI=Object.freeze({repli:true});
 function tenter(coeur,n,fonction,entree){return appel(coeur,n,fonction,entree,()=>REPLI);}
 const simple=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 function egal(a,b){if(Object.is(a,b))return true;if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((x,i)=>egal(x,b[i]))&&Object.keys(a).length===Object.keys(b).length;
  if(simple(a)&&simple(b)){const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every((k,i)=>k===kb[i]&&egal(a[k],b[k]));}return false;}
 /* Recopie EN PLACE de `source` (rendu par le cœur) dans `cible` : les objets simples présents des deux côtés gardent leur
  * identité (fusion récursive), une valeur égale n'est pas remplacée (identité des tableaux et objets inchangés gardée),
  * une clé nouvelle est ajoutée dans l'ordre où le JS l'aurait créée (celui de `source`). */
 function fondre(cible,source){for(const k of Object.keys(source)){const a=cible[k],b=source[k];
  if(simple(a)&&simple(b)&&Object.prototype.hasOwnProperty.call(cible,k))fondre(a,b);else if(!Object.prototype.hasOwnProperty.call(cible,k)||!egal(a,b))cible[k]=b;}}
 /* native-session (270–281). Méthodes à `this` : écrites pour être posées sur Sessions.prototype (même `this`).
  * `NS` : module native-session ; `S` : réglages (src/settings.js) ; `K` : core (cutKey, pour la carte inter-session). */
 function session(coeur,NS,S,K){
  const n=compteur(),P=NS.Sessions.prototype,Ss=NS.Sessions,t=(f,e)=>tenter(coeur,n,f,e);
  const reglages=()=>({movementThresholdM:S.echo?.movementThresholdM??0.001,ecritureReferenceSeuilM:S.echo?.ecritureReferenceSeuilM??0.001,
   freshnessSkewMs:S.echo?.freshnessSkewMs??50,watermarkBytes:Ss.EXPORT_WATERMARK_BYTES,qualityRailLimit:Ss.QUALITY_RAIL_LIMIT});
  const ou=(r,js)=>r===REPLI?js():r;
  const methodes={
   visitRelation(nat,identity,periodId,cross){
    if(nat===null||typeof nat!=='object'||!(cross===undefined||cross===null||cross instanceof Map))return P.visitRelation.call(this,nat,identity,periodId,cross);
    let autre;try{autre=cross?.get(K.cutKey(identity));}catch{return P.visitRelation.call(this,nat,identity,periodId,cross);}
    return ou(t(273,{a:[{id:nat.id,visits:nat.visits},identity,periodId],autre}),()=>P.visitRelation.call(this,nat,identity,periodId,cross));},
   redactedEvent(type,data){
    if(type!=='capture-ready'&&type!=='capture-checkpoint'&&type!=='operator-gesture')return P.redactedEvent.call(this,type,data);
    return ou(t(274,{a:[type,data]}),()=>P.redactedEvent.call(this,type,data));},
   mergeMetrics(metrics){
    if(!metrics)return P.mergeMetrics.call(this,metrics);
    let m;try{m=this.e.s.native.metrics;}catch{return P.mergeMetrics.call(this,metrics);}
    const r=t(275,{a:[metrics],m});if(r===REPLI)return P.mergeMetrics.call(this,metrics);
    const x=r.m,poser=k=>{m[k]=x[k];};
    for(const k of ['queueDepthMax','dropped','sendFailures','captureCompleted','captureFailed','captureCheckpoints'])poser(k);
    if(metrics.inputHandlerMs)poser('inputHandlerMs');
    if(metrics.degradationLevel){const l=m.degradationLevels;for(let i=l.length;i<x.degradationLevels.length;i++)l.push(x.degradationLevels[i]);poser('degradationLevel');}
    if(metrics.degradationPeak)poser('degradationPeak');
    if(Number.isFinite(metrics.queueDepth))poser('queueDepth');
    for(const k of ['degradationEvents','recoveries','setAside','refused','captureBudgeted','captureRefused','captureSkippedAfterOperatorRailChange'])if(Number.isFinite(metrics[k]))poser(k);
    if(r.setAside)m.setAsideItems=metrics.setAsideItems.slice(0,32);
    return undefined;},
   accountQuality(nat,cloud){
    if(!simple(nat))return P.accountQuality.call(this,nat,cloud);
    const me=nat.metrics,r=t(276,{a:[{quality:nat.quality,qualityRails:nat.qualityRails,metrics:me===null||me===undefined||typeof me!=='object'?me:{}},cloud],reglages:reglages()});
    if(r===REPLI)return P.accountQuality.call(this,nat,cloud);
    if(nat.quality===null||nat.quality===undefined)nat.quality=r.quality;else fondre(nat.quality,r.quality);
    if(nat.qualityRails===null||nat.qualityRails===undefined)nat.qualityRails=r.qualityRails;else fondre(nat.qualityRails,r.qualityRails);
    if(r.metricsQuality){nat.metrics??={};nat.metrics.quality=nat.quality;}
    return undefined;},
   health(){const nat=this.e.s.native;if(!nat)return null;
    if(typeof nat!=='object')return P.health.call(this);
    const {status,visits,cloudIds,metrics,exportState,quality}=nat;
    return ou(t(277,{native:{status,visits,cloudIds,metrics,exportState,quality},reglages:reglages()}),()=>P.health.call(this));},
   chooseGeometry(record,side){return ou(t(279,{a:[record,side]}),()=>P.chooseGeometry.call(this,record,side));},
   /* classify : le cœur rend l'enregistrement et les clés affectées ; recopie en place (geometryEligibility et
    * usableForOfflineEvaluationByRail existants gardent leur identité, comme dans le JS). Méthodes surchargées : JS. */
   classify(record){
    const propres=(this.chooseGeometry===P.chooseGeometry||this.chooseGeometry===methodes.chooseGeometry)&&this.partialReason===P.partialReason;
    if(!propres||!simple(record))return P.classify.call(this,record);
    const r=t(280,{a:[record],reglages:reglages()});if(r===REPLI)return P.classify.call(this,record);
    const x=r.record;
    for(const k of r.assignes){
     if(k==='geometryEligibility'&&simple(record.geometryEligibility)){const g=record.geometryEligibility;g.left=x.geometryEligibility.left;g.right=x.geometryEligibility.right;g.pair=x.geometryEligibility.pair;}
     else if(k==='usableForOfflineEvaluationByRail'&&simple(record.usableForOfflineEvaluationByRail)){const u=record.usableForOfflineEvaluationByRail;u.left=x[k].left;u.right=x[k].right;}
     else record[k]=x[k];}
    return undefined;},
   referenceFromWrite(record,entry,writeAt){
    if(!simple(record))return P.referenceFromWrite.call(this,record,entry,writeAt);
    const r=t(281,{a:[record,entry,writeAt],reglages:reglages()});if(r===REPLI)return P.referenceFromWrite.call(this,record,entry,writeAt);
    if(!r.retour)return false;
    const list=record.humanFinalReferences??=[];
    if(r.index>=0)list[r.index].supersededBy='validation-write';else list.push(r.ajout);
    list.push(r.next);record.humanFinalReference=r.next;record.humanFinalReferenceSource='validation-write';return true;},
   exportAdvice(){const nat=this.e.s.native;if(!nat)return null;
    if(typeof nat!=='object'||!nat.exportState)return P.exportAdvice.call(this);
    return ou(t(278,{native:{exportState:nat.exportState,cloudIds:nat.cloudIds},reglages:reglages()}),()=>P.exportAdvice.call(this));},
  };
  return {methodes,
   poseEqual(...x){return ou(t(270,{a:x}),()=>NS.poseEqual(...x));},
   referenceParEcriture(...x){return ou(t(271,{a:x,reglages:reglages()}),()=>NS.referenceParEcriture(...x));},
   compteurs:()=>({...n,motifs:{...n.motifs}})};
 }
 /* historique-parties (260–263) : finDe, ficheFin, ajouterFin, historique ; lireFins et noterFin (stockage) : JS. */
 function historique(coeur,H){
  const n=compteur(),locale=localeMoteur(),a=(f,args,js)=>appel(coeur,n,f,{a:args,locale},js);
  return {...H,finDe(...x){return a(260,x,()=>H.finDe(...x));},ficheFin(...x){return a(261,x,()=>H.ficheFin(...x));},
   ajouterFin(...x){return a(262,x,()=>H.ajouterFin(...x));},historique(...x){return a(263,x,()=>H.historique(...x));},compteurs:()=>({...n,motifs:{...n.motifs}})};
 }
 /* core (285–286) : expectedPoses, pairCorpus. */
 function noyau(coeur,K){
  const n=compteur(),a=(f,args,js)=>appel(coeur,n,f,{a:args},js);
  return {expectedPoses(...x){return a(285,x,()=>K.expectedPoses(...x));},pairCorpus(...x){return a(286,x,()=>K.pairCorpus(...x));},compteurs:()=>({...n,motifs:{...n.motifs}})};
 }
 /* native-reconstruction (290–294). `nuages` (carte des blocs de points) ne traverse pas : seul « fournis ou non » est
  * passé ; si la couverture doit être recalculée avec eux (native-lidar, non porté), le cœur refuse et le JS est rejoué. */
 function reconstruction(coeur,NR){
  const n=compteur(),a=(f,args,js)=>appel(coeur,n,f,{a:args},js);
  const opts=o=>o===undefined?undefined:o===null||typeof o!=='object'?REPLI:{nuages:!!o.nuages,tolMm:o.tolMm};
  return {...NR,
   etiquette(...x){return a(290,x,()=>NR.etiquette(...x));},
   memeEtiquette(...x){return a(291,x,()=>NR.memeEtiquette(...x));},
   distMm(...x){return a(292,x,()=>NR.distMm(...x));},
   reconstruireRail(record,side,o){const p=opts(o);if(p===REPLI)return NR.reconstruireRail(record,side,o);return a(293,[record,side,p],()=>NR.reconstruireRail(record,side,o));},
   reconstruireCut(record,o){const p=opts(o);if(p===REPLI)return NR.reconstruireCut(record,o);return a(294,[record,p],()=>NR.reconstruireCut(record,o));},
   compteurs:()=>({...n,motifs:{...n.motifs}})};
 }
 /* esv-observer (296) : voisins, POUR LA MESURE (la table vit dans la page d'ESV, où le cœur n'est pas chargé). La carte
  * des tables et leurs colonnes parallèles sont mises à plat à chaque appel. */
 function observateur(coeur,E){
  const n=compteur();
  return {voisins(tables,req){if(!(tables instanceof Map))return E.voisins(tables,req);
   const l=[];for(const [key,t] of tables)l.push({key,n:t.rk.length,ed:t.ed,st:t.st,fl:t.fl,pages:t.pages,fraiches:t.fraiches,debut:t.debut,rompue:t.rompue,tronquee:t.tronquee});
   return appel(coeur,n,296,{a:[l,req]},()=>E.voisins(tables,req));},compteurs:()=>({...n,motifs:{...n.motifs}})};
 }
 return {resume,session,historique,noyau,reconstruction,observateur,appel,compteur,fondre,REPLI};
});
