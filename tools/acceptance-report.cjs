#!/usr/bin/env node
'use strict';
/*
 * acceptance-report.cjs — rapport d'acceptation d'un lot Pilote relu en Natif
 * (cahier 4.8 §6 et §14 G, D-038). Le même calcul à chaque collecte F1 à F4.
 *
 *   node tools/acceptance-report.cjs --lot DOSSIER[=libellé] [--relecture DOSSIER|FICHIER] [--lot ...]
 *        [--config REGLAGE.json] [--p2 P2.json] [--rejeu-lot | --decision-par-rejeu] [--regles-actuelles] [--json SORTIE] [--md SORTIE]
 *
 * `--decision-par-rejeu` : la décision sur le lot est lue dans le rejeu hors ligne
 * même quand l'export la consigne (lots 4.7.8 : choix par la voie privé de
 * grille, KI-048) ; la parité observation/rejeu reste rapportée.
 *
 * Un dossier de lot contient les exports JSON décompressés, reconnus par leur
 * format : diagnostic GCV1, corpus GCV1 + LiDAR, journal du Pilote, et, s'ils
 * y sont, les segments de la relecture Natif (fusionnés en mémoire par
 * `tools/merge-segments.cjs`). `--relecture` désigne une relecture rangée
 * ailleurs ; elle s'attache au `--lot` qui la précède.
 *
 * Sorties, partie par partie puis total, TOUJOURS ensemble (§14 G) :
 *   C1  cuts DISTINCTS du lot : appliqués, différés, refusés par l'écartement,
 *       sans entrée, autres ; couverture sur les cuts distincts (D-038) ;
 *   C4  cuts faux parmi les cuts appliqués jugés : erreur latérale OU
 *       verticale d'un rail au-delà de 10 mm, sur valeurs brutes ;
 *   C2  médiane et p90 des erreurs des rails appliqués jugés, plancher P2 à côté ;
 *   C3  paires hors contrat refusées pendant le lot, et contrôle qu'aucune
 *       paire appliquée n'est hors contrat (`src/gauge.js`) ;
 *   la décision sur le lot (`lotObservation`, 4.7.8), couverture et faux jugés
 *   de la même façon ; les cuts non jugeables avec leur raison ; les cuts
 *   exclus, comptés à part.
 *
 * Référence humaine : pose finale validée de la relecture, aux règles strictes
 * du banc (`referenceFor`). Elle n'est lue qu'après coup, pour juger ; aucune
 * position humaine n'entre dans un calcul du moteur (le rejeu du lot ne lit que
 * le corpus et le diagnostic). Jointure par partie et cut ; le repère est
 * contrôlé : même `frameId`, ou, à défaut, une translation unique de tout le
 * lot vérifiée cut par cut (la pose AVANT de la relecture doit être celle
 * laissée par le Pilote, à 1 mm près, rotation identique). Plusieurs visites
 * d'un même cut : la dernière validée fait foi, et le rapport le dit.
 *
 * Unités : unités de scène × 1000, notées mm ; l'étalonnage physique n'est pas
 * vérifié indépendamment (§P2 du cahier).
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Segments=require('./merge-segments.cjs'),Lab=require('./placement-lab.cjs'),NativeExport=require('../src/native-export.js'),Legacy=require('./native-offline-evaluate.cjs');
const Gauge=require('../src/gauge.js'),O=require('../src/continuity-observer.js'),K=require('../src/core.js'),C=require('../vendor/capture-core.js');
const SIDES=['left','right'],WRONG_MM=10,MATCH_MM=1,ROTATION_TOLERANCE=1e-6;
/* C4 n'est évaluable que si 80 % au moins des cuts appliqués ont été jugés à la
 * relecture ; un lot arrêté avant la fin est « incomplet » : son C1 est
 * rapporté, mais il ne compte pas pour l'objectif, fixé sur des lots complets
 * (D-038). Décision de la direction du 24/09, relecture du chantier 4. */
const MIN_JUDGED_SHARE=0.8,COMPLETE_STATES=new Set(['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS']);
/* CONVENTION DES OPÉRATEURS (direction, 24/09, D-040) : un cut visité sans
 * correction ni validation est jugé bon et bien placé. Une visite sans
 * validation où la pose n'a pas bougé vaut donc acceptation de cette pose, si
 * elle a duré au moins ACCEPT_MIN_MS (en deçà : passage en rafale, touche Z
 * répétée). Retouché sans validation : pose finale incertaine, non jugeable.
 * Ces cuts entrent dans C4 (« accepté sans retouche », compté à part) ; C2 reste
 * mesuré sur les seuls cuts validés : une acceptation dit « pas faux », pas
 * « à combien de millimètres ». */
const ACCEPT_MIN_MS=500;
/* Exclusions demandées par l'opérateur : jamais retirées, la configuration ne
 * peut qu'en ajouter. */
const EXCLUDED=Object.freeze([
  Object.freeze({part:19,cut:9033,motif:'demande de l’opérateur : référence humaine fondée sur une information absente des données'}),
  Object.freeze({part:19,cut:9241,motif:'demande de l’opérateur : référence humaine fondée sur une information absente des données'})]);
const APPLYING_STAGES=new Set(['first-pass','window','choice']);
const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
const r2=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
const keyOf=(part,cut)=>`${part}|${cut}`;
const byTime=(a,b)=>String(a.timestamp??'').localeCompare(String(b.timestamp??''))||String(a.observationEventId??'').localeCompare(String(b.observationEventId??''));
const railsOk=rails=>SIDES.every(s=>Array.isArray(rails?.[s]?.positionSceneRelative)&&Array.isArray(rails[s].profileLocalToSceneRelative));
/* Clé de cut du Pilote : pageId|part|cut|shape|frameId|geominfo. */
function parseCutId(id){const f=String(id).split('|');return {part:Number(f[1]),cut:Number(f[2]),frameId:f[4]&&f[4]!=='not-observed'?f[4]:null};}

/* ---- lecture des entrées ---- */
function kindOf(doc){
  if(doc?.format==='banane-gcv1-diagnostic-v1')return 'diagnostic';
  if(doc?.format==='banane-gcv1-lidar-corpus-v1')return 'corpus';
  if(doc?.format==='banane-test-journal-v4')return 'journal';
  if(doc?.session&&Array.isArray(doc.records))return 'relecture';
  /* Le bilan du lot (« Télécharger le bilan et les LiDAR »), compact : il porte
   * l'état du lot, sa clôture et les passages du Pilote, comme le journal. Il
   * ne sert qu'à défaut du journal. */
  if(doc?.format==='banane-test-dataset-v4'&&doc.state?.batch)return 'bilan';
  return 'ignored';
}
const listJson=input=>fs.statSync(input).isDirectory()?fs.readdirSync(input).filter(f=>f.endsWith('.json')).sort().map(f=>path.join(input,f)):[input];
function describe(file,bytes,doc,kind){return {file:path.basename(file),kind,format:doc?.format??null,version:doc?.version??null,
  sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};}
/* Un dossier de lot : chaque fichier est reconnu par son format. Un seul
 * journal et un seul diagnostic par dossier : un lot, un dossier. */
/* Corpus exporté en plusieurs segments (seg01, seg02… d'un même export, même
 * session) : les captures sont réunies, sans doublon. Le dernier segment dit si
 * toutes les captures demandées sont présentes. */
const segmentOf=doc=>doc?.segment?.format==='banane-native-export-segment-v1'?doc.segment:null;
function mergeCorpus(a,b,dir){
  const sa=segmentOf(a),sb=segmentOf(b);
  if(!sa||!sb||a.sessionId!==b.sessionId||sa.stamp!==sb.stamp||sa.index===sb.index)throw Error(`Deux fichiers « corpus » dans ${dir} qui ne sont pas deux segments d'un même export : un lot par dossier.`);
  const [first,second]=sa.index<sb.index?[a,b]:[b,a],seen=new Set(first.clouds.map(c=>c.captureId));
  const merged={...second,diagnostic:second.diagnostic||first.diagnostic,clouds:[...first.clouds,...second.clouds.filter(c=>!seen.has(c.captureId))]};
  merged.segments=[...(first.segments||[first.segment]),second.segment];return merged;
}
function loadLot(dir,label,relecturePath=null){
  const lot={label,diagnostic:null,journal:null,corpus:null,relecture:null,inputs:[]},relectureFiles=[],bilans=[];
  for(const file of listJson(dir)){
    const bytes=fs.readFileSync(file),raw=JSON.parse(bytes),doc=raw?.format===NativeExport.FORMAT?NativeExport.expand(raw):raw,kind=kindOf(doc);
    lot.inputs.push(describe(file,bytes,doc,kind));
    if(kind==='relecture'){relectureFiles.push(file);continue;}
    if(kind==='ignored')continue;
    if(kind==='bilan'){bilans.push(doc);continue;}
    if(kind==='corpus'&&lot.corpus){lot.corpus=mergeCorpus(lot.corpus,doc,dir);continue;}
    if(lot[kind])throw Error(`Deux fichiers « ${kind} » dans ${dir} : un lot par dossier.`);
    lot[kind]=doc;
  }
  /* Le bilan ne sert qu'en l'absence de journal ; présent, le journal fait foi. */
  if(bilans.length>1&&!lot.journal)throw Error(`Deux fichiers « bilan » dans ${dir} et aucun journal : exporte le journal du lot.`);
  if(bilans.length&&!lot.journal)lot.bilan=bilans[0];
  if(bilans.length&&lot.journal)for(const i of lot.inputs)if(i.kind==='bilan')i.role='ignoré (journal présent)';
  if(lot.corpus?.segments){const last=lot.corpus.exportTrace||{};
    lot.corpusSegments={segments:lot.corpus.segments.length,clouds:lot.corpus.clouds.length,declared:last.cloudObjects??null,allRequestedObjectsPresent:last.allRequestedObjectsPresent??null};
    if(last.cloudObjects!=null&&last.cloudObjects!==lot.corpus.clouds.length)throw Error(`Corpus en segments incomplet dans ${dir} : ${lot.corpus.clouds.length} captures sur ${last.cloudObjects} déclarées.`);}
  if(relecturePath){relectureFiles.length=0;
    for(const file of listJson(relecturePath)){const bytes=fs.readFileSync(file),doc=JSON.parse(bytes),kind=kindOf(doc);
      lot.inputs.push({...describe(file,bytes,doc,kind),role:'relecture'});if(kind==='relecture')relectureFiles.push(file);}}
  if(relectureFiles.length){const merged=Segments.mergeFiles(relectureFiles).merged;lot.relecture=merged;
    lot.relectureMerge={segments:relectureFiles.length,records:merged.records.length,allDeclaredCloudsPresent:merged.mergeTrace.allDeclaredPresent};}
  if(!lot.journal&&lot.bilan){lot.journal=lot.bilan;lot.journalFromBilan=true;
    for(const i of lot.inputs)if(i.kind==='bilan')i.role='journal (bilan du lot, journal absent)';}
  delete lot.bilan;
  if(!lot.diagnostic&&lot.corpus?.diagnostic)lot.diagnostic=lot.corpus.diagnostic;
  if(!lot.diagnostic&&!lot.journal)throw Error(`Ni diagnostic GCV1 ni journal du Pilote dans ${dir}.`);
  return lot;
}

/* ---- le lot, cut par cut ---- */
function lotCuts(diagnostic,journal){
  const batch=journal?.state?.batch||null,batchId=batch?.id??null,all=(diagnostic?.observations||[]).slice().sort(byTime);
  const observations=all.filter(o=>!batchId||o.batchId===batchId),cuts=new Map();
  const touch=identity=>{const k=keyOf(identity.part,identity.cut);
    if(!cuts.has(k))cuts.set(k,{key:k,part:identity.part,cut:identity.cut,frameId:identity.frameId??null,observations:[],pilotVisits:0});
    return cuts.get(k);};
  for(const o of observations)touch(o.identity).observations.push(o);
  const processed=new Set(),deferred=new Set();
  for(const p of batch?.processed||[]){const c=touch(p.identity||parseCutId(p.key));processed.add(c.key);}
  for(const id of journal?.closureSummary?.deferredCuts||[]){const c=touch(parseCutId(id));deferred.add(c.key);}
  /* Cuts atteints par le lot : relevé de la pose AVANT après le départ du lot,
   * dans sa partie. Un cut atteint sans décision reste au dénominateur. */
  const started=batch?.startedAt||null,part=batch?.scope?.part;
  for(const e of journal?.events||[])if(e.type==='before-captured'&&e.identity&&(!started||String(e.timestamp)>=started)&&(part==null||e.identity.part===part))
    touch(e.identity).pilotVisits++;
  const active=batch&&batch.state!=='COMPLETED'&&batch.activeIdentity?keyOf(batch.activeIdentity.part,batch.activeIdentity.cut):null;
  return {batch,cuts:[...cuts.values()].sort((a,b)=>a.part-b.part||a.cut-b.cut),processed,deferred,active,
    observationsOutsideLot:all.length-observations.length};
}
/* Motif par rail ; `input` quand le moteur n'a eu aucun point à lire. */
function railMotif(o,s){const sci=o?.rails?.[s]?.scientificRail,at=o?.runtime?.deferral?.railsAtDeferral?.[s]?.gcv1?.motif;
  if(at==='input'||sci&&sci.ok===false)return at||'frame';const n=sci?.next;return n&&n.status!=='candidate'?n.motif||n.status:null;}
function motifsOf(o){return SIDES.map(s=>{const m=railMotif(o,s);return m?`${s}:${m}`:null;}).filter(Boolean);}
const withoutInput=o=>SIDES.some(s=>railMotif(o,s)==='input');
/* Issue du Pilote, sur faits persistés : `runtime` du diagnostic, puis journal. */
function pilotOutcome(cut,ctx){
  const o=cut.observations.at(-1)||null,rt=o?.runtime,inProcessed=ctx.processed.has(cut.key),inDeferred=ctx.deferred.has(cut.key);
  const refused=o?.summary?.pairGaugeRejected===true;
  if(rt?.apply&&(rt.validationAccepted||inProcessed))return {outcome:'applied'};
  if(rt?.deferral?.status==='DEFERRED_UNRESOLVED'||!rt?.deferral&&!rt?.apply&&inDeferred)
    return {outcome:withoutInput(o)?'no-input':refused?'gauge-rejected':'deferred',reason:withoutInput(o)?'différé-sans-point-lidar':undefined,motifs:motifsOf(o)};
  if(rt?.apply)return {outcome:'other',reason:'appliqué-sans-validation-acceptée'};
  if(rt?.deferral)return {outcome:'other',reason:'différé-non-confirmé:'+rt.deferral.status};
  if(rt?.abstention?.status==='PAUSED_UNRESOLVED_RAIL')return {outcome:'other',reason:'lot-en-pause-sur-ce-cut',motifs:motifsOf(o)};
  if(inProcessed)return {outcome:'applied'};
  if(!o)return ctx.active===cut.key?{outcome:'other',reason:'atteint-sans-décision:lot-arrêté-sur-ce-cut'}:{outcome:'no-input',reason:'aucune-observation-gcv1'};
  if(o.error||!o.lidar?.captureId)return {outcome:'no-input',reason:o.error?'erreur-gcv1':'capture-lidar-absente'};
  return {outcome:'other',reason:'aucune-décision-consignée'};
}
/* Poses laissées par le Pilote : état observé après application, sinon pose
 * AVANT relevée par le Pilote (journal, puis capture du corpus). */
function pilotPoses(cut,journalBefore,captures){
  const o=cut.observations.at(-1),capture=o?.lidar?.captureId?captures.get(o.lidar.captureId):null;
  const before=journalBefore.get(cut.key)||(railsOk(capture?.rails)?capture.rails:null),applied=o?.runtime?.apply?.observed?.rails;
  return {before:railsOk(before)?before:null,applied:railsOk(applied)?applied:null};
}

/* ---- relecture : repère, référence, erreurs ---- */
const ROTATION=[0,1,2,4,5,6,8,9,10];
function poseResidual(pilot,relu,T){
  let mm=0,rotation=0;
  for(const s of SIDES){const p=pilot[s].positionSceneRelative,q=relu[s].positionSceneRelative;
    mm=Math.max(mm,C.distance(q,p.map((v,i)=>v+T[i]))*1000);
    for(const i of ROTATION)rotation=Math.max(rotation,Math.abs(pilot[s].profileLocalToSceneRelative[i]-relu[s].profileLocalToSceneRelative[i]));}
  return {mm,rotation};
}
/* Translation du repère Pilote vers celui de la relecture : médiane, composante
 * par composante, des écarts entre la pose laissée par le Pilote et la pose
 * AVANT de la première visite relue. Chaque cut est ensuite contrôlé seul. */
function frameTranslation(pairs){
  const offsets=pairs.flatMap(p=>SIDES.map(s=>p.relu[s].positionSceneRelative.map((v,i)=>v-p.pilot[s].positionSceneRelative[i])));
  if(!offsets.length)return null;
  return [0,1,2].map(i=>{const v=offsets.map(o=>o[i]).sort((a,b)=>a-b),m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2;});
}
const moved=(rails,T)=>Object.fromEntries(SIDES.map(s=>[s,O.translated(rails[s],T)]));
const shiftedPositions=(positions,T)=>Object.fromEntries(SIDES.map(s=>[s,positions[s].map((v,i)=>v+T[i])]));
const validated=visit=>(visit.operatorIntents||[]).some(i=>i.intent==='VALIDATE');
function poseChangedDuringVisit(visit){const b=visit.beforeEstablished?.rails,f=(visit.finalObserved||visit.lastObserved)?.rails;
  if(!railsOk(b)||!railsOk(f))return null;return SIDES.some(s=>C.distance(b[s].positionSceneRelative,f[s].positionSceneRelative)*1000>0.01);}
/* Erreur d'un jeu de positions (repère de la relecture) contre la référence,
 * dans le repère de profil de la pose laissée par le Pilote. */
function errorsOf(initial,references,positions){
  const errors={};let worst=0;
  for(const s of SIDES){const init=initial[s],M=init.sceneRelativeToProfileLocal,o=C.point(M,init.positionSceneRelative),q=C.point(M,positions[s]),h=references[s].deltaLocal;
    const lateral=(q[1]-o[1]-h[1])*1000,vertical=(q[2]-o[2]-h[2])*1000;
    worst=Math.max(worst,Math.abs(lateral),Math.abs(vertical));errors[s]={lateralMm:r2(lateral),verticalMm:r2(vertical)};}
  return {errors,worstMm:r2(worst),wrong:worst>WRONG_MM};
}
function judgeCut(row,visits,T,frameStatus){
  if(!visits?.length)return {status:'unjudgeable',reason:'pas-de-relecture'};
  if(!frameStatus.usable)return {status:'unjudgeable',reason:'repère-incompatible'};
  const pilot=row._poses.applied||row._poses.before,first=visits[0].beforeEstablished?.rails;
  if(!pilot)return {status:'unjudgeable',reason:'pose-du-pilote-inconnue'};
  if(!railsOk(first))return {status:'unjudgeable',reason:'pose-avant-de-la-relecture-absente'};
  const residual=poseResidual(pilot,first,T);
  if(residual.mm>MATCH_MM||residual.rotation>ROTATION_TOLERANCE)
    return {status:'unjudgeable',reason:'pose-avant-différente-de-celle-du-pilote',residualMm:r2(residual.mm)};
  const done=visits.filter(validated);
  const visitNote={visits:visits.length,validatedVisits:done.length,usedVisitIndex:done.at(-1)?.visitIndex??null,
    rule:done.length>1?'plusieurs visites validées : la dernière fait foi':undefined};
  if(!done.length){
    if(visits.some(v=>poseChangedDuringVisit(v)!==false))
      return {status:'unjudgeable',reason:'retouché-sans-validation',poseChanged:true,...visitNote};
    const dwell=v=>Date.parse(v.endedAt)-Date.parse(v.beforeEstablished?.capturedAt);
    const seen=visits.filter(v=>dwell(v)>=ACCEPT_MIN_MS);
    if(!seen.length)return {status:'unjudgeable',reason:'passage-trop-bref',poseChanged:false,...visitNote};
    const visit=seen.at(-1),initial=moved(pilot,T),final=(visit.finalObserved||visit.lastObserved).rails;
    const references=Object.fromEntries(SIDES.map(s=>[s,{status:'candidate',finalRail:final[s],deltaLocal:Legacy.humanDelta(initial[s],final[s])}]));
    return {status:'judged',basis:'accepté-sans-retouche',visits:visits.length,validatedVisits:0,usedVisitIndex:visit.visitIndex??null,
      dwellMs:dwell(visit),_initial:initial,_references:references};
  }
  const visit=done.at(-1),initial=moved(pilot,T);
  // Jugement : la référence humaine n'est lue qu'ici, après toute décision du moteur.
  const references=Object.fromEntries(SIDES.map(s=>[s,Lab.referenceFor(visit,s,initial[s],visit.beforeEstablished?.capturedAt)]));
  const missing=SIDES.filter(s=>references[s].status!=='candidate');
  if(missing.length)return {status:'unjudgeable',reason:'référence-non-stricte',detail:missing.map(s=>`${s}:${references[s].reason}`),...visitNote};
  return {status:'judged',basis:'validé',...visitNote,_initial:initial,_references:references};
}

/* ---- décision sur le lot : observée (4.7.8) ou rejouée hors ligne ---- */
/* Rejeu exact de `observeLot` (background.js) : même ordre, mêmes ancres, même
 * entrée — la capture du corpus et la science GCV1 du diagnostic, rien d'autre.
 * `deps` permet aux essais d'observer ce que reçoit la décision. */
function replayLot(observations,corpus,deps){deps=deps||{};
  const L=deps.L||require('../src/lot-decision.js'),Shadow=deps.Shadow||require('../src/gcv1-shadow.js');
  const maxAnchors=deps.maxAnchors??require('../src/settings.js').lot.maxAnchors;
  const captures=new Map((corpus?.clouds||[]).map(c=>[c.captureId,c])),anchors=[],out=[];
  for(const o of observations.slice().sort(byTime)){
    const k=keyOf(o.identity?.part,o.identity?.cut);
    if(o.error||!o.rails){out.push({key:k,observationEventId:o.observationEventId,decision:null});continue;}
    const capture=captures.get(o.lidar?.captureId);
    if(!capture?.rails?.left||!capture?.rails?.right||!Array.isArray(capture.pointsSceneRelative)){
      out.push({key:k,observationEventId:o.observationEventId,decision:{stage:'no-capture',applied:false}});continue;}
    const identity=K.completeIdentity(capture.identity||o.identity||{});
    const science={rails:Object.fromEntries(SIDES.map(s=>[s,o.rails[s]?.scientificRail])),summary:o.summary};
    const decision=L.decideCut({capture:{identity,rails:capture.rails,pointsSceneRelative:capture.pointsSceneRelative,
      visibleByClipBoxes:capture.visibleByClipBoxes},science,anchors,Shadow,...(deps.options?{options:deps.options}:{})});
    if(decision.anchor)(L.rememberAnchor||require('../src/lot-decision.js').rememberAnchor)(anchors,{identity:{part:identity.part,cut:identity.cut,frameId:identity.frameId??null},positions:decision.positions,stage:decision.stage},maxAnchors);
    out.push({key:k,observationEventId:o.observationEventId,decision:{...decision,applied:false,displayed:false}});
  }
  return out;
}
function sameDecision(a,b){
  if(!a||!b||a.stage!==b.stage)return false;
  if(!a.positions&&!b.positions)return true;
  if(!a.positions||!b.positions)return false;
  return SIDES.every(s=>a.positions[s].every((v,i)=>Math.abs(v-b.positions[s][i])<=1e-9));
}

/* ---- un lot ---- */
/* Règles de la décision sur le lot selon la version qui a produit le lot : le
 * rejeu reproduit ce que le Pilote a fait. La garde de paire (D-044) n'existe
 * qu'à partir de la 4.7.12 ; une reprise depuis la voie sert d'appui jusqu'à
 * 15 mm à partir de la 4.7.15 (D-047), 10 mm avant ; garde d'écartement voisin
 * et minimum du choix à 5 points à partir de la 4.7.16 (D-050) ; `currentRules` rejoue un
 * lot ancien avec les règles actuelles (« que ferait la version courante ? »). */
const versionAtLeast=(v,ref)=>{const a=String(v||'').split('.').map(Number),b=ref.split('.').map(Number);
  for(let i=0;i<b.length;i++){if(!Number.isFinite(a[i]))return false;if(a[i]!==b[i])return a[i]>b[i];}return true;};
const CHAIN_MM={before:10,current:15},GAUGE_GUARD_MM={before:null,current:20},MIN_TOP={before:15,current:5};
/* 4.7.16 (D-050) : garde d'écartement voisin à 20 mm, minimum du choix à 5 points de dessus. */
const rules4716=(on)=>({gaugeGuardMm:on?GAUGE_GUARD_MM.current:GAUGE_GUARD_MM.before,minTop:on?MIN_TOP.current:MIN_TOP.before});
const rulesFor=(version,current=false)=>({pairGuard:current||versionAtLeast(version,'4.7.12'),
  chainMm:current||versionAtLeast(version,'4.7.15')?CHAIN_MM.current:CHAIN_MM.before,...rules4716(current||versionAtLeast(version,'4.7.16'))});
/* Règles consignées par la décision elle-même (4.7.14 : garde de paire ;
 * 4.7.15 : `chainMm`) ; à défaut, version `lot-decision-v2` ; à défaut
 * seulement, version de l'extension à l'export — qui peut être postérieure au
 * lot (relecture 4.7.12). */
function lotRules(observations,exportVersion,current=false){
  if(current)return {...rulesFor(null,true),source:'actuelles'};
  const recorded=observations.map(o=>o?.lotObservation).filter(Boolean),consigned=recorded.find(x=>typeof x.pairGuard==='boolean');
  const chain=recorded.find(x=>Number.isFinite(x.chainMm))?.chainMm??(recorded.some(x=>x.version==='lot-decision-v3'||x.version==='lot-decision-v4')?CHAIN_MM.current:CHAIN_MM.before);
  /* 4.7.16 : garde d'écartement et minimum du choix consignés ; un lot antérieur n'a ni l'une ni l'autre. */
  const v4=recorded.find(x=>x.version==='lot-decision-v4'),later=v4?{gaugeGuardMm:v4.gaugeGuardMm??null,minTop:v4.minTop??MIN_TOP.current}:rules4716(false);
  if(consigned)return {pairGuard:consigned.pairGuard,chainMm:chain,...later,source:'lot'};
  if(recorded.some(x=>/^lot-decision-v[234]$/.test(x.version)))return {pairGuard:true,chainMm:chain,...later,source:'lot'};
  return {...rulesFor(exportVersion),...(recorded.length?{chainMm:chain,...later}:{}),source:'export'};
}
function analyseLot(lot,options={}){
  const exclusions=options.exclusions||EXCLUDED,excluded=new Map(exclusions.map(e=>[keyOf(e.part,e.cut),e]));
  const ctx=lotCuts(lot.diagnostic,lot.journal),journalBefore=new Map();
  for(const r of (lot.journal?.records||[]).slice().sort((a,b)=>String(a.before?.capturedAt).localeCompare(String(b.before?.capturedAt))))
    if(r.identity&&railsOk(r.before?.rails)){const k=keyOf(r.identity.part,r.identity.cut);if(!journalBefore.has(k))journalBefore.set(k,r.before.rails);}
  const captures=new Map((lot.corpus?.clouds||[]).map(c=>[c.captureId,c]));
  const rows=ctx.cuts.map(cut=>{const row={part:cut.part,cut:cut.cut,frameId:cut.frameId,pilotVisits:cut.pilotVisits,gcv1Observations:cut.observations.length,...pilotOutcome(cut,ctx)};
    if(excluded.has(cut.key)){row.excluded=excluded.get(cut.key).motif;}
    row._cut=cut;row._poses=pilotPoses(cut,journalBefore,captures);
    const o=cut.observations.at(-1);
    if(row.outcome==='gauge-rejected')row.gauge={predictedMm:r1(o?.summary?.pairGaugeMm),gaugeClass:o?.summary?.pairGaugeClass??null};
    if(row.outcome==='applied'&&row._poses.applied){const mm=Gauge.gaugeMmOf(row._poses.applied,C),cls=Gauge.classifyMm(mm);
      row.gauge={appliedMm:r1(mm),gaugeClass:cls,admissible:Gauge.admissible(cls)};}
    return row;});
  // Relecture : repère.
  const relecture=new Map();
  for(const r of (lot.relecture?.records||[]).slice().sort((a,b)=>(a.visitIndex??0)-(b.visitIndex??0))){
    const k=keyOf(r.identity?.part,r.identity?.cut);(relecture.get(k)||relecture.set(k,[]).get(k)).push(r);}
  const pairs=[];for(const row of rows){const v=relecture.get(keyOf(row.part,row.cut)),p=row._poses.applied||row._poses.before;
    if(v?.length&&p&&railsOk(v[0].beforeEstablished?.rails))pairs.push({pilot:p,relu:v[0].beforeEstablished.rails,row});}
  const lotFrames=[...new Set(rows.map(r=>r.frameId).filter(Boolean))],reluFrames=[...new Set([...relecture.values()].flat().map(r=>r.identity?.frameId).filter(Boolean))];
  const sameFrame=lotFrames.length===1&&reluFrames.length===1&&lotFrames[0]===reluFrames[0];
  const T=sameFrame?[0,0,0]:frameTranslation(pairs)||[0,0,0];
  const agreeing=pairs.filter(p=>{const r=poseResidual(p.pilot,p.relu,T);return r.mm<=MATCH_MM&&r.rotation<=ROTATION_TOLERANCE;}).length;
  const frame={pilotFrameIds:lotFrames,relectureFrameIds:reluFrames,sameFrameId:sameFrame,
    translationSceneUnits:sameFrame?null:T.map(v=>Math.round(v*1e4)/1e4),cutsCompared:pairs.length,cutsAgreeing:agreeing,
    usable:!lot.relecture?false:sameFrame||pairs.length>0&&agreeing*2>pairs.length,
    rule:sameFrame?'même frameId':`frameId différent : translation unique du lot acceptée si la majorité des cuts la vérifient (≤ ${MATCH_MM} mm, rotation identique) ; chaque cut est contrôlé seul`};
  // Décision sur le lot.
  const lastObs=rows.map(r=>r._cut.observations.at(-1)).filter(Boolean);
  const recorded=lastObs.some(o=>o.lotObservation);
  let replay=null;
  if(options.replay&&lot.corpus){const all=rows.flatMap(r=>r._cut.observations);replay=new Map();
    const rules=lotRules(all,lot.diagnostic?.version??lot.journal?.version,options.currentRules);lot.lotDecisionRules=rules;
    for(const x of replayLot(all,lot.corpus,{...(options.replayDeps||{}),options:{pairGuard:rules.pairGuard,chainMm:rules.chainMm,gaugeGuardMm:rules.gaugeGuardMm,minTop:rules.minTop,...(options.replayDeps?.options||{})}}))replay.set(x.observationEventId,x.decision);}
  /* `preferReplay` : la 4.7.8 consigne un choix par la voie privé de sa grille
   * (KI-048) ; ses lots se mesurent sur le rejeu, la parité restant rapportée. */
  const lotSource=recorded&&!(options.preferReplay&&replay)?'observation':replay?'rejeu-hors-ligne':'absent';
  let parity=null;
  if(recorded&&replay){let same=0,compared=0;for(const o of rows.flatMap(r=>r._cut.observations))if(o.lotObservation){compared++;if(sameDecision(o.lotObservation,replay.get(o.observationEventId)))same++;}
    parity={compared,identical:same};}
  // Jugement, cut par cut.
  for(const row of rows){
    const o=row._cut.observations.at(-1),lo=!o?null:lotSource==='observation'?o.lotObservation||null:replay?replay.get(o.observationEventId)||null:null;
    if(lotSource!=='absent')row.lot=lo?{stage:lo.stage,wouldApply:APPLYING_STAGES.has(lo.stage),reason:lo.reason??null,guardMm:lo.guardMm??null,guardDeferred:lo.guardDeferred||undefined,
      anchors:Array.isArray(lo.anchorsUsed)?lo.anchorsUsed.length:null,
      /* 4.7.10 : ce que la décision a commandé au Pilote (consigné seulement sur le terrain). */
      command:lotSource==='observation'?o.lotObservation?.command?.action??null:null}:{stage:null,wouldApply:false,reason:'aucune-observation'};
    if(row.excluded)continue;
    const judgement=judgeCut(row,relecture.get(keyOf(row.part,row.cut)),T,frame);
    if(judgement.status==='judged'){const {_initial,_references,...rest}=judgement;
      /* `_initial` est la pose laissée par le Pilote, dans le repère de la
       * relecture : appliquée, c'est l'erreur du Pilote ; sinon, l'écart de
       * la pose de départ à la pose humaine (diagnostic, jamais un faux). */
      const left=errorsOf(_initial,_references,Object.fromEntries(SIDES.map(s=>[s,_initial[s].positionSceneRelative])));
      row.judgement=row.outcome==='applied'&&row._poses.applied?{...rest,...left}:{...rest,startGapMm:left.worstMm};
      if(row.lot?.wouldApply&&lo.positions){const e=errorsOf(_initial,_references,shiftedPositions(lo.positions,T));row.lot.errors=e.errors;row.lot.worstMm=e.worstMm;row.lot.wrong=e.wrong;}
    }else row.judgement=judgement;
  }
  const consistency=lot.journal?{journalCompleted:lot.journal.closureSummary?.completed??null,journalDeferred:lot.journal.closureSummary?.deferred??null,
    applied:rows.filter(r=>r.outcome==='applied').length,deferredOrRefused:rows.filter(r=>r.outcome==='deferred'||r.outcome==='gauge-rejected'||r.reason==='différé-sans-point-lidar').length}:null;
  return {label:lot.label,complete:ctx.batch?COMPLETE_STATES.has(ctx.batch.state):null,batch:ctx.batch?{id:ctx.batch.id,state:ctx.batch.state,part:ctx.batch.scope?.part??null,start:ctx.batch.scope?.start??null,end:ctx.batch.scope?.end??null,
      unresolvedPolicy:ctx.batch.scope?.unresolvedPolicy??null,startedAt:ctx.batch.startedAt??null}:null,
    version:lot.diagnostic?.version??lot.journal?.version??null,observationsOutsideLot:ctx.observationsOutsideLot,
    relecture:lot.relecture?{...lot.relectureMerge,frame}:null,corpusSegments:lot.corpusSegments??null,lotDecisionRules:lot.lotDecisionRules??null,lotDecisionSource:lotSource,lotDecisionParity:parity,journalConsistency:consistency,
    inputs:lot.inputs,rows:rows.map(({_cut,_poses,...r})=>r)};
}

/* ---- agrégation : une partie, ou le total ---- */
function summarize(rows,p2){
  const counted=rows.filter(r=>!r.excluded),n=counted.length,count=f=>counted.filter(f).length,pct=v=>n?r1(100*v/n):null;
  const applied=counted.filter(r=>r.outcome==='applied'),judged=applied.filter(r=>r.judgement?.status==='judged'&&Number.isFinite(r.judgement.worstMm));
  const validatedJudged=judged.filter(r=>r.judgement.basis!=='accepté-sans-retouche');
  const wrong=judged.filter(r=>r.judgement.wrong),axis=a=>Lab.distribution(validatedJudged.flatMap(r=>SIDES.map(s=>Math.abs(r.judgement.errors[s][a+'Mm']))));
  const unjudged={};for(const r of counted)if(r.judgement?.status==='unjudgeable'){const k=r.judgement.reason;(unjudged[k]||(unjudged[k]={cuts:0,applied:0,list:[]}));
    unjudged[k].cuts++;if(r.outcome==='applied')unjudged[k].applied++;unjudged[k].list.push(r.cut);}
  const lotRows=counted.filter(r=>r.lot),lotApplied=lotRows.filter(r=>r.lot.wouldApply),lotJudged=lotApplied.filter(r=>Number.isFinite(r.lot.worstMm));
  const lotWrong=lotJudged.filter(r=>r.lot.wrong);
  /* 4.7.10 (D-042) : appliqués par la décision sur le lot (reprise ou choix) —
   * ceux que la 4.7.9 n'aurait pas placés —, à part des poses du moteur. */
  const commanded=applied.filter(r=>r.lot?.command==='lot'),commandedJudged=commanded.filter(r=>judged.includes(r));
  return {
    c1:{distinctCuts:n,applied:applied.length,deferred:count(r=>r.outcome==='deferred'),gaugeRejected:count(r=>r.outcome==='gauge-rejected'),
      noInput:count(r=>r.outcome==='no-input'),other:count(r=>r.outcome==='other'),coveragePct:pct(applied.length),
      revisitedCuts:count(r=>r.pilotVisits>1||r.gcv1Observations>1),
      otherDetail:counted.filter(r=>r.outcome==='other'||r.outcome==='no-input').map(r=>({cut:r.cut,outcome:r.outcome,reason:r.reason}))},
    c4:{criterion:`latéral OU vertical > ${WRONG_MM} mm, valeurs brutes`,judgedApplied:judged.length,appliedNotJudged:applied.length-judged.length,wrong:wrong.length,
      judgedByBasis:{validé:validatedJudged.length,'accepté-sans-retouche':judged.length-validatedJudged.length},
      /* Relecture 4.7.12 : une acceptation sans retouche (D-040) n'a pas d'erreur
       * mesurée, elle borne l'erreur par la tolérance de l'opérateur. Les faux
       * sont donc aussi rapportés sur les seuls cuts validés. */
      wrongByBasis:{validé:validatedJudged.filter(r=>r.judgement.wrong).length,'accepté-sans-retouche':wrong.length-validatedJudged.filter(r=>r.judgement.wrong).length},
      judgedSharePct:applied.length?r1(100*judged.length/applied.length):null,minJudgedSharePct:100*MIN_JUDGED_SHARE,
      evaluable:applied.length?judged.length>=MIN_JUDGED_SHARE*applied.length:null,
      wrongCuts:wrong.map(r=>({cut:r.cut,worstMm:r.judgement.worstMm,errors:r.judgement.errors})),
      byLotCommand:commanded.length?{applied:commanded.length,judged:commandedJudged.length,wrong:commandedJudged.filter(r=>r.judgement.wrong).length,
        byStage:commanded.reduce((m,r)=>(m[r.lot.stage]=(m[r.lot.stage]||0)+1,m),{}),
        wrongCuts:commandedJudged.filter(r=>r.judgement.wrong).map(r=>({cut:r.cut,stage:r.lot.stage,anchors:r.lot.anchors,worstMm:r.judgement.worstMm}))}:null},
    c2:{rails:validatedJudged.length*2,basis:'cuts validés seulement',lateralMm:axis('lateral'),verticalMm:axis('vertical'),floor:p2?{label:p2.label,lateralMm:p2.lateralMm??null,verticalMm:p2.verticalMm??null}:{label:'P2 non mesuré'}},
    c3:{refused:counted.filter(r=>r.outcome==='gauge-rejected').map(r=>({cut:r.cut,...r.gauge})),
      appliedOutOfContract:applied.filter(r=>r.gauge&&!r.gauge.admissible).map(r=>({cut:r.cut,...r.gauge})),
      appliedGaugeUnmeasured:applied.filter(r=>!r.gauge).map(r=>r.cut)},
    lotDecision:lotRows.length?{wouldApply:lotApplied.length,coveragePct:pct(lotApplied.length),judged:lotJudged.length,wrong:lotWrong.length,
      wrongCuts:lotWrong.map(r=>({cut:r.cut,stage:r.lot.stage,worstMm:r.lot.worstMm,pilot:r.outcome,pilotWrong:r.judgement?.wrong===true})),
      newWrong:lotWrong.filter(r=>!(r.outcome==='applied'&&r.judgement?.wrong===true)).map(r=>r.cut),
      gained:lotApplied.filter(r=>r.outcome!=='applied').map(r=>({cut:r.cut,stage:r.lot.stage,worstMm:r.lot.worstMm??null})),
      lost:applied.filter(r=>!r.lot?.wouldApply).map(r=>r.cut),
      byStage:lotRows.reduce((m,r)=>(m[r.lot.stage??'aucune']=(m[r.lot.stage??'aucune']||0)+1,m),{})}:null,
    unjudgeable:unjudged,
    deferredStartGapsMm:counted.filter(r=>(r.outcome==='deferred'||r.outcome==='gauge-rejected')&&Number.isFinite(r.judgement?.startGapMm))
      .map(r=>({cut:r.cut,startGapMm:r.judgement.startGapMm})),
    excluded:rows.filter(r=>r.excluded).map(r=>({cut:r.cut,outcome:r.outcome,motif:r.excluded})),
  };
}
function report(lots,{config=null,p2=null,replay=false,replayDeps=null,preferReplay=false,currentRules=false}={}){
  const exclusions=[...EXCLUDED,...(config?.exclusions||[]).filter(e=>!EXCLUDED.some(x=>x.part===e.part&&x.cut===e.cut))];
  const floor=p2?{...p2,label:p2.operators>1?`P2 (${p2.operators} opérateurs)`:'P2 (un opérateur)'}:null;
  const analysed=lots.map(l=>analyseLot(l,{exclusions,replay:replay||preferReplay,replayDeps,preferReplay,currentRules}));
  const allRows=analysed.flatMap(l=>l.rows.map(r=>({...r,lotLabel:l.label})));
  const tuning=new Set(config?.tuningParts||[]);
  const incomplete=analysed.filter(l=>l.complete===false).map(l=>({label:l.label,state:l.batch?.state??null}));
  const parts=[...new Set(allRows.map(r=>r.part))].sort((a,b)=>a-b).map(part=>({part,
    holdout:config?(tuning.has(part)?'a servi au réglage':'tenue à l’écart'):'non déclaré (aucune configuration)',
    lots:[...new Set(allRows.filter(r=>r.part===part).map(r=>r.lotLabel))],...summarize(allRows.filter(r=>r.part===part),floor)}))
    .map(p=>({...p,incompleteLots:incomplete.filter(l=>p.lots.includes(l.label))}));
  return {format:'banane-acceptance-report-v1',tool:'tools/acceptance-report.cjs',
    rules:{wrongMm:WRONG_MM,criterion:'latéral OU vertical, valeurs brutes (D-038)',denominator:'cuts DISTINCTS du lot ; sans entrée, différés, refusés, sans décision au dénominateur ; revisite ≠ nouveau cut',
      reference:'dernière visite validée de la relecture, règles strictes referenceFor ; lue après coup, jamais en entrée moteur',
      units:'unités de scène × 1000 (mm), étalonnage physique non vérifié',gaugeContract:`[${Gauge.CONTRACT.lowMm}, ${Gauge.CONTRACT.maximumMm}] mm, admissibilité seulement`,
      exclusions,p2:floor?floor.label:'P2 non mesuré'},
    config:config?{tuningParts:[...tuning]}:null,p2:floor,lots:analysed,parts,total:{...summarize(allRows,floor),incompleteLots:incomplete}};
}

/* ---- Markdown ---- */
const fmt=v=>v==null?'—':String(v).replace('.',',');
const dist=d=>d?.count?`${fmt(d.median)} / ${fmt(d.p90)} (max ${fmt(d.maximum)})`:'—';
function section(title,s){
  const L=[`### ${title}`,'','C1 à C4 sont rapportés ensemble ; C1 seul n’est pas un résultat (§14 G).','',
    ...(s.incompleteLots?.length?[`**Lot incomplet** (${s.incompleteLots.map(l=>`${l.label} : ${l.state}`).join(' ; ')}) : C1 est rapporté, mais ne compte pas pour l’objectif, fixé sur des lots complets (D-038).`,'']:[]),
    '| Critère | Mesure |','|---|---|',
    `| C1 — couverture | **${s.c1.applied} appliqués / ${s.c1.distinctCuts} cuts distincts = ${fmt(s.c1.coveragePct)} %** · différés ${s.c1.deferred} · refusés par l’écartement ${s.c1.gaugeRejected} · sans entrée ${s.c1.noInput} · autres ${s.c1.other} · cuts revisités ${s.c1.revisitedCuts} (comptés une fois) |`,
    `| C4 — faux | ${s.c4.evaluable===false?`**non évaluable** : ${fmt(s.c4.judgedSharePct)} % des appliqués jugés, seuil ${s.c4.minJudgedSharePct} % · `:''}**${s.c4.wrong} faux sur ${s.c4.judgedApplied} appliqués jugés** (${s.c4.judgedByBasis?.validé??0} validés, ${s.c4.judgedByBasis?.['accepté-sans-retouche']??0} acceptés sans retouche ; ${s.c4.criterion}) · **sur les seuls validés : ${s.c4.wrongByBasis?.validé??0} faux sur ${s.c4.judgedByBasis?.validé??0}** · appliqués non jugés : ${s.c4.appliedNotJudged}${s.c4.byLotCommand?` · **dont appliqués par la décision sur le lot : ${s.c4.byLotCommand.wrong} faux sur ${s.c4.byLotCommand.judged} jugés** (${s.c4.byLotCommand.applied} appliqués : ${Object.entries(s.c4.byLotCommand.byStage).map(([k,v])=>k+' '+v).join(', ')}${s.c4.byLotCommand.wrongCuts.length?' ; faux : '+s.c4.byLotCommand.wrongCuts.map(w=>`${w.cut} (${w.stage}, ${w.anchors} appui${w.anchors>1?'s':''}, ${fmt(w.worstMm)} mm)`).join(', '):''})`:''} |`,
    `| C2 — erreur des rails appliqués validés (${s.c2.rails} rails), médiane / p90 | latéral ${dist(s.c2.lateralMm)} mm · vertical ${dist(s.c2.verticalMm)} mm · plancher : ${s.c2.floor.label}${s.c2.floor.lateralMm?` (latéral ${fmt(s.c2.floor.lateralMm.median)} / ${fmt(s.c2.floor.lateralMm.p90)}, vertical ${fmt(s.c2.floor.verticalMm?.median)} / ${fmt(s.c2.floor.verticalMm?.p90)} mm)`:''} |`,
    `| C3 — paires hors contrat | refusées pendant le lot : ${s.c3.refused.length}${s.c3.refused.length?' ('+s.c3.refused.map(r=>`${r.cut} : ${fmt(r.predictedMm)} mm ${r.gaugeClass}`).join(' ; ')+')':''} · appliquées hors contrat : **${s.c3.appliedOutOfContract.length}**${s.c3.appliedGaugeUnmeasured.length?` · écartement appliqué non mesurable : ${s.c3.appliedGaugeUnmeasured.join(', ')}`:''} |`];
  if(s.lotDecision)L.push(`| Décision sur le lot | ${s.lotDecision.wouldApply} appliqués / ${s.c1.distinctCuts} = ${fmt(s.lotDecision.coveragePct)} % · **${s.lotDecision.wrong} faux sur ${s.lotDecision.judged} jugés** · faux que le Pilote n’a pas faits : ${s.lotDecision.newWrong.length?s.lotDecision.newWrong.join(', '):'aucun'} · gagnés : ${s.lotDecision.gained.map(g=>g.cut).join(', ')||'aucun'} · perdus : ${s.lotDecision.lost.join(', ')||'aucun'} |`);
  else L.push('| Décision sur le lot | absente des exports (antérieurs à la 4.7.8) et non rejouée |');
  L.push('');
  if(s.c4.wrongCuts.length)L.push('Cuts appliqués faux : '+s.c4.wrongCuts.map(w=>`${w.cut} (${fmt(w.worstMm)} mm)`).join(', ')+'.','');
  if(s.c1.otherDetail.length)L.push('Sans entrée ou sans décision : '+s.c1.otherDetail.map(o=>`${o.cut} (${o.reason})`).join(', ')+'.','');
  const u=Object.entries(s.unjudgeable);
  L.push('Non jugeables : '+(u.length?u.map(([k,v])=>`${k} — ${v.cuts} cuts dont ${v.applied} appliqués (${v.list.join(', ')})`).join(' ; '):'aucun')+'.','');
  if(s.deferredStartGapsMm.length)L.push('Différés relus : écart entre la pose de départ et la pose humaine (pire rail, mm) : '+s.deferredStartGapsMm.map(d=>`${d.cut} : ${fmt(d.startGapMm)}`).join(' ; ')+'.','');
  L.push('Exclus, comptés à part : '+(s.excluded.length?s.excluded.map(e=>`${e.cut} (${e.outcome}) — ${e.motif}`).join(' ; '):'aucun')+'.','');
  return L;
}
function toMarkdown(r){
  const L=['# Rapport d’acceptation — lots Pilote','',`Règles : faux si ${r.rules.criterion} au-delà de ${r.rules.wrongMm} mm ; dénominateur : ${r.rules.denominator} ; référence : ${r.rules.reference} ; unités : ${r.rules.units} ; écartement : ${r.rules.gaugeContract}.`,''];
  for(const lot of r.lots){L.push(`## Lot « ${lot.label} »`,'',
    `Version ${lot.version??'?'} · lot ${lot.batch?.id??'?'} (${lot.batch?.state??'?'}), partie ${lot.batch?.part??'?'}, cuts ${lot.batch?.start??'?'}–${lot.batch?.end??'?'}, politique « ${lot.batch?.unresolvedPolicy??'?'} ».`,
    lot.relecture?`Relecture : ${lot.relecture.segments} segment(s), ${lot.relecture.records} visites, nuages déclarés tous présents : ${lot.relecture.allDeclaredCloudsPresent?'oui':'NON'}. Repère : ${lot.relecture.frame.sameFrameId?'même frameId':`frameId différent (Pilote ${lot.relecture.frame.pilotFrameIds.join(', ')} ; relecture ${lot.relecture.frame.relectureFrameIds.join(', ')}), translation ${JSON.stringify(lot.relecture.frame.translationSceneUnits)} vérifiée sur ${lot.relecture.frame.cutsAgreeing}/${lot.relecture.frame.cutsCompared} cuts`} ; utilisable : ${lot.relecture.frame.usable?'oui':'NON'}.`:'Relecture : absente — aucun cut jugeable.',
    `Décision sur le lot : ${{observation:'observée dans le Pilote (lotObservation)','rejeu-hors-ligne':'REJOUÉE hors ligne (corpus + diagnostic), pas une observation terrain',absent:'absente'}[lot.lotDecisionSource]}${lot.lotDecisionParity?` ; parité rejeu/observation ${lot.lotDecisionParity.identical}/${lot.lotDecisionParity.compared}`:''}.`,
    lot.journalConsistency?`Contrôle journal : ${lot.journalConsistency.journalCompleted} traités et ${lot.journalConsistency.journalDeferred} différés au journal ; ${lot.journalConsistency.applied} appliqués et ${lot.journalConsistency.deferredOrRefused} différés (refus d’écartement et absence de points compris) recalculés.`:'',
    lot.observationsOutsideLot?`Observations GCV1 hors de ce lot, ignorées : ${lot.observationsOutsideLot}.`:'','',
    '| Cut | Pilote | Motifs | Écartement mm | Relecture | Pire erreur mm | Décision sur le lot |','|---|---|---|---|---|---|---|');
    for(const row of lot.rows){const j=row.judgement;
      L.push(`| ${row.cut}${row.excluded?' (exclu)':''} | ${row.outcome}${row.reason?' — '+row.reason:''} | ${(row.motifs||[]).join(' ')} | ${fmt(row.gauge?.appliedMm??row.gauge?.predictedMm)} | ${row.excluded?'—':j?.status==='judged'?`jugé (visite ${j.usedVisitIndex}${j.rule?', '+j.rule:''})`:`${j?.reason}${j?.detail?' '+j.detail.join(' '):''}${j?.poseChanged===false?' (pose inchangée)':''}`} | ${fmt(j?.worstMm??(j?.startGapMm!=null?'départ '+j.startGapMm:null))}${j?.wrong?' **FAUX**':''} | ${row.lot?`${row.lot.stage??'—'}${row.lot.worstMm!=null?' · '+fmt(row.lot.worstMm)+' mm':''}${row.lot.wrong?' **FAUX**':''}`:'—'} |`);}
    L.push('');}
  L.push('## Par partie','');
  for(const p of r.parts)L.push(...section(`Partie ${p.part} — ${p.holdout} (lots : ${p.lots.join(', ')})`,p));
  L.push('## Total','',...section('Toutes parties',r.total));
  return L.filter((x,i,a)=>!(x===''&&a[i-1]==='')).join('\n');
}

/* ---- ligne de commande ---- */
function parse(argv){
  const opt={lots:[],config:null,p2:null,replay:false,json:null,md:null};
  for(let i=0;i<argv.length;i++){const a=argv[i];
    if(a==='--lot'){const v=argv[++i],at=v.lastIndexOf('=');opt.lots.push(at>0?{dir:v.slice(0,at),label:v.slice(at+1)}:{dir:v,label:path.basename(path.resolve(v))});}
    else if(a==='--relecture'){if(!opt.lots.length)throw Error('--relecture suit un --lot.');opt.lots.at(-1).relecture=argv[++i];}
    else if(a==='--config')opt.config=argv[++i];else if(a==='--p2')opt.p2=argv[++i];
    else if(a==='--rejeu-lot')opt.replay=true;else if(a==='--decision-par-rejeu')opt.preferReplay=true;else if(a==='--regles-actuelles')opt.currentRules=true;else if(a==='--json')opt.json=argv[++i];else if(a==='--md')opt.md=argv[++i];
    else throw Error('Argument inconnu : '+a);}
  if(!opt.lots.length)throw Error('Usage : --lot DOSSIER[=libellé] [--relecture DOSSIER] [...] [--config F] [--p2 F] [--rejeu-lot | --decision-par-rejeu] [--regles-actuelles] [--json F] [--md F]');
  return opt;
}
function run(argv=process.argv.slice(2)){
  const opt=parse(argv),read=f=>f?JSON.parse(fs.readFileSync(f,'utf8')):null;
  const lots=opt.lots.map(l=>loadLot(l.dir,l.label,l.relecture||null));
  const result=report(lots,{config:read(opt.config),p2:read(opt.p2),replay:opt.replay,preferReplay:!!opt.preferReplay,currentRules:!!opt.currentRules});
  if(opt.json)fs.writeFileSync(opt.json,JSON.stringify(result,null,1)+'\n');
  if(opt.md)fs.writeFileSync(opt.md,toMarkdown(result)+'\n');
  for(const p of [...result.parts.map(p=>({...p,title:'partie '+p.part})),{...result.total,title:'total'}])
    console.log(`${p.title} : C1 ${p.c1.applied}/${p.c1.distinctCuts} = ${p.c1.coveragePct} % · C4 ${p.c4.wrong} faux / ${p.c4.judgedApplied} jugés${p.c4.evaluable===false?' (non évaluable)':''}${p.c4.byLotCommand?` (dont décision sur le lot ${p.c4.byLotCommand.wrong} / ${p.c4.byLotCommand.judged})`:''} · C2 latéral ${dist(p.c2.lateralMm)} vertical ${dist(p.c2.verticalMm)} · ${p.c2.floor.label} · C3 refusées ${p.c3.refused.length}, appliquées hors contrat ${p.c3.appliedOutOfContract.length}`+
      (p.lotDecision?` · lot ${p.lotDecision.wouldApply}/${p.c1.distinctCuts}, ${p.lotDecision.wrong} faux / ${p.lotDecision.judged}`:' · décision sur le lot absente')+` · exclus ${p.excluded.length}`+(p.incompleteLots?.length?' · lot incomplet':''));
  return result;
}
if(require.main===module)try{run();}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={versionAtLeast,rulesFor,lotRules,EXCLUDED,WRONG_MM,kindOf,loadLot,lotCuts,pilotOutcome,frameTranslation,poseResidual,errorsOf,replayLot,analyseLot,summarize,report,toMarkdown,run};
