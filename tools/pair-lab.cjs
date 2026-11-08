#!/usr/bin/env node
'use strict';
/* Pair Lab V1 — banc hors ligne, lecture seule.
 *
 * Grandeur canonique : pairProfileOriginDistance
 *   (profileOriginSceneRelative, sans repli).
 * Grandeur secondaire : pairRailPositionDistance
 *   (positionSceneRelative, sans repli).
 *
 * Séries : initial / human / engineFrozen / brainOfflineReplayV1Forced.
 * La dernière est un rejeu V1 hors ligne, cerveau forcé actif + AJUSTE.
 * Ce n'est pas le comportement runtime (cerveau éteint par défaut).
 *
 * Témoin 6/9480 : reported-not-replayed. La formule ne prétend pas
 * reproduire 1499,93 / 1517,73 / 1518,19.
 */
const fs=require('node:fs'),path=require('node:path');
const Pod=require('../src/pair-origin-distance.js');
const K=require('../src/core.js');
const Geometry=require('../src/geometry.js');
const Brain=require('../src/brain.js');
const GeometryBrain=require('../src/geometry-brain.js');

const WITNESS={part:6,cut:9480,shape:'U50',
  observed:{
    kind:'reported-not-replayed',
    source:'AUDIT_PILOTE.md défaut 7 — cut 6/9480',
    pairOriginDistanceTimes1e3:{initial:1499.93,banane:1517.73,engineFrozen:1518.19},
    formulaDoesNotClaimReproduction:true
  }};

const BRAIN_OFFLINE_PARAMS=Object.freeze({
  ...GeometryBrain.AJUSTE,
  selectionActive:true
});

function args(argv){
  const out={inputs:[],out:null,markdown:null};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--out')out.out=argv[++i];
    else if(argv[i]==='--markdown')out.markdown=argv[++i];
    else if(argv[i].endsWith('.json'))out.inputs.push(path.resolve(argv[i]));
  }
  return out;
}
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function times1e3(m){return m?.status==='measured'?m.sceneUnitsTimes1e3:null;}

function applyDeltas(initialRails,proposals){
  if(!initialRails?.left||!initialRails?.right)return null;
  if(!proposals?.left?.delta||!proposals?.right?.delta)return null;
  if(proposals.left.status!=='candidate'||proposals.right.status!=='candidate')return null;
  try{return K.expectedPoses({rails:initialRails},proposals);}
  catch{return null;}
}

function replayFrozenEngine(cloud,record){
  if(!cloud?.pointsSceneRelative)return {proposals:null,reason:'lidar-points-missing'};
  const leftInitial=record?.rails?.left?.initial||{};
  const rightInitial=record?.rails?.right?.initial||{};
  const capture={
    identity:cloud.identity||{part:cloud.part,cut:cloud.cut,shape:cloud.shape,frameId:cloud.frameId},
    rails:{
      left:{...(cloud.rails?.left||{}),...leftInitial},
      right:{...(cloud.rails?.right||{}),...rightInitial}
    },
    pointsSceneRelative:cloud.pointsSceneRelative,
    visibleByClipBoxes:cloud.visibleByClipBoxes,
    coordinateSystem:cloud.coordinateSystem
  };
  try{return {proposals:Geometry.proposeBoth(capture),reason:null};}
  catch(e){return {proposals:null,reason:e.message};}
}

function replayBrainOfflineV1Forced(proposals){
  if(!proposals)return null;
  return Brain.corrigerPaire(proposals,BRAIN_OFFLINE_PARAMS);
}

function emptyCoverage(format){
  return {
    format:format||'unknown',
    records:0,clouds:0,
    joinedByCaptureId:0,joinedByVisitId:0,unjoined:0,
    humanFinalPresent:0,
    engineReplayed:0,engineUnavailableNoLidar:0,engineUnavailableReplayFailed:0,
    brainOfflineReplayV1Forced:0,
    pairProfileOriginMeasured:{initial:0,human:0,engineFrozen:0,brainOfflineReplayV1Forced:0},
    pairRailPositionMeasured:{initial:0,human:0,engineFrozen:0,brainOfflineReplayV1Forced:0}
  };
}

function identityOf(record){
  return {
    part:record.part??record.identity?.part??null,
    cut:record.cut??record.identity?.cut??null,
    shape:record.shape??record.identity?.shape??null,
    sessionId:record.sessionId??record.identity?.sessionId??null,
    recordId:record.recordId??record.id??null
  };
}

function ingestCorrectionSession(doc){
  const coverage=emptyCoverage(doc.format||'banane-corrections-session-v4');
  const clouds=doc.clouds||[];
  const records=doc.records||[];
  coverage.records=records.length;
  coverage.clouds=clouds.length;
  const byId=new Map(clouds.filter(c=>c?.captureId).map(c=>[c.captureId,c]));
  const byVisit=new Map(clouds.filter(c=>c?.visitId).map(c=>[c.visitId,c]));
  const entries=[];
  for(const record of records){
    let cloud=null,join=null;
    if(record.lidarCaptureId&&byId.has(record.lidarCaptureId)){
      cloud=byId.get(record.lidarCaptureId);join='lidarCaptureId';coverage.joinedByCaptureId++;
    }else if(record.visitId&&byVisit.has(record.visitId)){
      cloud=byVisit.get(record.visitId);join='visitId';coverage.joinedByVisitId++;
    }else{coverage.unjoined++;}
    const initial={left:record.rails?.left?.initial||null,right:record.rails?.right?.initial||null};
    const human={left:record.rails?.left?.corrected||null,right:record.rails?.right?.corrected||null};
    if(human.left||human.right)coverage.humanFinalPresent++;
    let engineProposals=null,engineReason=null;
    if(!cloud){engineReason='no-lidar-capture';coverage.engineUnavailableNoLidar++;}
    else{
      const replay=replayFrozenEngine(cloud,record);
      engineProposals=replay.proposals;
      engineReason=replay.reason;
      if(engineProposals)coverage.engineReplayed++;
      else coverage.engineUnavailableReplayFailed++;
    }
    entries.push({
      kind:'correction-record',
      identity:identityOf(record),
      initial,human,engineProposals,
      cloudJoin:join,
      engineReason,
      railErrorTimes1e3:null
    });
  }
  return {entries,coverage};
}

function ingestOfflineEvaluation(doc){
  const coverage=emptyCoverage(doc.format||'banane-offline-evaluation-v1');
  const results=doc.results||[];
  coverage.records=results.length;
  const entries=[];
  for(const row of results){
    const id=row.identity||{};
    const initial=row.initialRails||null;
    const human=row.finalHumanRails||null;
    if(human?.left||human?.right)coverage.humanFinalPresent++;
    const engineProposals=row.proposal||null;
    if(engineProposals)coverage.engineReplayed++;
    else coverage.engineUnavailableReplayFailed++;
    entries.push({
      kind:'offline-evaluation-row',
      identity:{part:id.part??null,cut:id.cut??null,shape:id.shape??null,sessionId:id.sessionId??null},
      initial,human,engineProposals,
      cloudJoin:'embedded-offline-proposal',
      engineReason:engineProposals?null:'proposal-absent',
      railErrorTimes1e3:{
        left:row.rails?.left?.errorMm?.euclidean??null,
        right:row.rails?.right?.errorMm?.euclidean??null
      }
    });
  }
  return {entries,coverage};
}

function ingest(doc){
  if(doc.format==='banane-corrections-session-v4')return ingestCorrectionSession(doc);
  if(doc.format==='banane-offline-evaluation-v1')return ingestOfflineEvaluation(doc);
  if(Array.isArray(doc.records))return ingestCorrectionSession({...doc,format:doc.format||'records-array'});
  return {entries:[],coverage:emptyCoverage(doc.format)};
}

function measurePairSet(left,right){
  return {
    profileOrigin:Pod.pairProfileOriginDistance(left,right),
    railPosition:Pod.pairRailPositionDistance(left,right)
  };
}

function measureCase(entry,coverage){
  const initial=measurePairSet(entry.initial?.left,entry.initial?.right);
  const human=measurePairSet(entry.human?.left,entry.human?.right);
  let engineFrozen=measurePairSet(null,null);
  engineFrozen.profileOrigin={status:'unavailable',reason:entry.engineReason||'engine-not-replayed',name:'pairProfileOriginDistance',provenance:Pod.CANONICAL_FIELD};
  engineFrozen.railPosition={status:'unavailable',reason:entry.engineReason||'engine-not-replayed',name:'pairRailPositionDistance',provenance:Pod.SECONDARY_FIELD};
  let brainOfflineReplayV1Forced=measurePairSet(null,null);
  brainOfflineReplayV1Forced.profileOrigin={status:'unavailable',reason:'brain-offline-replay-not-run',name:'pairProfileOriginDistance',provenance:Pod.CANONICAL_FIELD};
  brainOfflineReplayV1Forced.railPosition={status:'unavailable',reason:'brain-offline-replay-not-run',name:'pairRailPositionDistance',provenance:Pod.SECONDARY_FIELD};

  const engineRails=applyDeltas(entry.initial,entry.engineProposals);
  if(engineRails)engineFrozen=measurePairSet(engineRails.left,engineRails.right);

  if(entry.engineProposals){
    const replay=replayBrainOfflineV1Forced(entry.engineProposals);
    const brainProposals=replay?.proposals||null;
    const brainRails=applyDeltas(entry.initial,brainProposals);
    if(brainRails){
      brainOfflineReplayV1Forced=measurePairSet(brainRails.left,brainRails.right);
      if(coverage)coverage.brainOfflineReplayV1Forced++;
    }
  }

  if(coverage){
    const bump=(bag,key)=>{if(bag[key]?.status==='measured')coverage.pairProfileOriginMeasured[key]++;};
    const bump2=(bag,key)=>{if(bag[key]?.status==='measured')coverage.pairRailPositionMeasured[key]++;};
    const bags={initial:initial.profileOrigin,human:human.profileOrigin,engineFrozen:engineFrozen.profileOrigin,brainOfflineReplayV1Forced:brainOfflineReplayV1Forced.profileOrigin};
    const bags2={initial:initial.railPosition,human:human.railPosition,engineFrozen:engineFrozen.railPosition,brainOfflineReplayV1Forced:brainOfflineReplayV1Forced.railPosition};
    for(const k of Object.keys(bags))bump(bags,k);
    for(const k of Object.keys(bags2))bump2(bags2,k);
  }

  const profileTimes={
    initial:times1e3(initial.profileOrigin),
    human:times1e3(human.profileOrigin),
    engineFrozen:times1e3(engineFrozen.profileOrigin),
    brainOfflineReplayV1Forced:times1e3(brainOfflineReplayV1Forced.profileOrigin)
  };
  const anteHuman={
    pairEngineMinusInitialTimes1e3:
      Number.isFinite(profileTimes.engineFrozen)&&Number.isFinite(profileTimes.initial)
        ?profileTimes.engineFrozen-profileTimes.initial:null
  };
  anteHuman.absPairEngineMinusInitialTimes1e3=anteHuman.pairEngineMinusInitialTimes1e3==null
    ?null:Math.abs(anteHuman.pairEngineMinusInitialTimes1e3);

  return {
    identity:entry.identity,kind:entry.kind,cloudJoin:entry.cloudJoin||null,
    pairProfileOriginDistance:{initial:initial.profileOrigin,human:human.profileOrigin,engineFrozen:engineFrozen.profileOrigin,brainOfflineReplayV1Forced:brainOfflineReplayV1Forced.profileOrigin},
    pairRailPositionDistance:{initial:initial.railPosition,human:human.railPosition,engineFrozen:engineFrozen.railPosition,brainOfflineReplayV1Forced:brainOfflineReplayV1Forced.railPosition},
    pairProfileOriginDistanceTimes1e3:profileTimes,
    anteHumanDescriptors:anteHuman,
    railErrorTimes1e3:entry.railErrorTimes1e3||null,
    pairOriginDistance:{
      initial:initial.profileOrigin,human:human.profileOrigin,
      engine:engineFrozen.profileOrigin,brain:brainOfflineReplayV1Forced.profileOrigin
    },
    pairOriginDistanceTimes1e3:{
      initial:profileTimes.initial,human:profileTimes.human,
      engine:profileTimes.engineFrozen,brain:profileTimes.brainOfflineReplayV1Forced
    }
  };
}

function byPart(rows){
  const groups=new Map();
  for(const row of rows){
    const part=row.identity?.part;
    if(part==null)continue;
    if(!groups.has(part))groups.set(part,[]);
    groups.get(part).push(row);
  }
  const out={};
  for(const [part,list] of [...groups.entries()].sort((a,b)=>a[0]-b[0])){
    const take=key=>list.map(r=>r.pairProfileOriginDistanceTimes1e3[key]);
    out[part]={
      cuts:list.length,
      initial:Pod.stats(take('initial')),
      human:Pod.stats(take('human')),
      engineFrozen:Pod.stats(take('engineFrozen')),
      brainOfflineReplayV1Forced:Pod.stats(take('brainOfflineReplayV1Forced'))
    };
  }
  return out;
}

function descriptiveAssociations(rows){
  const withHuman=rows.filter(r=>Number.isFinite(r.pairProfileOriginDistanceTimes1e3?.engineFrozen)
    &&Number.isFinite(r.pairProfileOriginDistanceTimes1e3?.human));
  const withRail=rows.filter(r=>Number.isFinite(r.railErrorTimes1e3?.left)||Number.isFinite(r.railErrorTimes1e3?.right));
  const ante=rows.filter(r=>Number.isFinite(r.anteHumanDescriptors?.pairEngineMinusInitialTimes1e3));
  const anteAndRail=ante.filter(r=>Number.isFinite(r.railErrorTimes1e3?.left)||Number.isFinite(r.railErrorTimes1e3?.right));
  const maxRail=r=>Math.max(r.railErrorTimes1e3.left??-Infinity,r.railErrorTimes1e3.right??-Infinity);
  return {
    label:'associations-descriptives',
    usingHumanFinal:{
      n:withHuman.length,
      meanEngineMinusHumanTimes1e3:withHuman.length
        ?withHuman.reduce((s,r)=>s+r.pairProfileOriginDistanceTimes1e3.engineFrozen-r.pairProfileOriginDistanceTimes1e3.human,0)/withHuman.length
        :null,
      pearsonAbsPairEngineHumanVsMaxRailError:withHuman.filter(r=>Number.isFinite(r.railErrorTimes1e3?.left)||Number.isFinite(r.railErrorTimes1e3?.right)).length>=3
        ?Pod.pearson(
          withHuman.filter(r=>Number.isFinite(r.railErrorTimes1e3?.left)||Number.isFinite(r.railErrorTimes1e3?.right))
            .map(r=>Math.abs(r.pairProfileOriginDistanceTimes1e3.engineFrozen-r.pairProfileOriginDistanceTimes1e3.human)),
          withHuman.filter(r=>Number.isFinite(r.railErrorTimes1e3?.left)||Number.isFinite(r.railErrorTimes1e3?.right)).map(maxRail))
        :null
    },
    usingAnteHumanDescriptors:{
      n:ante.length,
      meanPairEngineMinusInitialTimes1e3:ante.length
        ?ante.reduce((s,r)=>s+r.anteHumanDescriptors.pairEngineMinusInitialTimes1e3,0)/ante.length
        :null,
      meanAbsPairEngineMinusInitialTimes1e3:ante.length
        ?ante.reduce((s,r)=>s+r.anteHumanDescriptors.absPairEngineMinusInitialTimes1e3,0)/ante.length
        :null,
      pearsonAbsPairEngineMinusInitialVsMaxRailError:anteAndRail.length>=3
        ?Pod.pearson(anteAndRail.map(r=>r.anteHumanDescriptors.absPairEngineMinusInitialTimes1e3),anteAndRail.map(maxRail))
        :null
    },
    nWithRailError:withRail.length,
    note:'Associations descriptives uniquement. Les descripteurs anteHuman sont calculés sans la finale humaine. L’erreur finale n’entre que comme comparateur. Aucun seuil, aucune règle métier.'
  };
}

function witnessBlock(){
  const o=WITNESS.observed.pairOriginDistanceTimes1e3;
  return {
    identity:{part:WITNESS.part,cut:WITNESS.cut,shape:WITNESS.shape},
    status:'reported-not-replayed',
    kind:WITNESS.observed.kind,
    source:WITNESS.observed.source,
    formulaDoesNotClaimReproduction:true,
    pairOriginDistanceTimes1e3:{initial:o.initial,human:null,engineFrozen:o.engineFrozen,brainOfflineReplayV1Forced:null,bananeObserved:o.banane},
    interpretation:[
      'Fait rapporté, non rejoué : le JSON source du cut 6/9480 n’est pas dans ce dépôt.',
      'La formule Pair Lab ne prétend pas reproduire 1499,93 / 1517,73 / 1518,19 tant que les origines brutes manquent.',
      'Les trois chiffres restent une observation externe. Ce n’est pas une lecture d’écartement ESV. Aucune cible n’est posée.'
    ]
  };
}

function markdown(report){
  const w=report.witness;
  const lines=[
    '# Pair Lab V1',
    '',
    'Grandeur canonique : `pairProfileOriginDistance` (`profileOriginSceneRelative` uniquement).',
    'Grandeur secondaire : `pairRailPositionDistance` (`positionSceneRelative` uniquement).',
    'Pas de repli de l’une vers l’autre. Pas un écartement ESV. Pas de cible 1436. Pas de seuil.',
    '',
    '## Témoin obligatoire 6/9480 — reported-not-replayed',
    '',
    `| source | valeur rapportée ×10³ |`,
    `|---|---:|`,
    `| initial (rapporté) | ${w.pairOriginDistanceTimes1e3.initial} |`,
    `| Banane observée (rapportée) | ${w.pairOriginDistanceTimes1e3.bananeObserved} |`,
    `| moteur gelé (rapporté) | ${w.pairOriginDistanceTimes1e3.engineFrozen} |`,
    '',
    ...w.interpretation.map(x=>'- '+x),
    '',
    `Cuts mesurés dans cette exécution : ${report.measuredCuts}.`,
    '',
    '## Couverture par source',
    ''
  ];
  for(const c of report.coverage||[]){
    lines.push(`- ${c.file||c.format} · records ${c.records} · clouds ${c.clouds} · joints captureId ${c.joinedByCaptureId} / visitId ${c.joinedByVisitId} · sans LiDAR ${c.engineUnavailableNoLidar} · moteur rejoué ${c.engineReplayed}`);
  }
  lines.push('', '## Par part (canonique)', '');
  for(const [part,g] of Object.entries(report.byPart)){
    lines.push(`### Part ${part} (n=${g.cuts})`,'');
    lines.push('| série | n | moyenne | écart-type | médiane |');
    lines.push('|---|---:|---:|---:|---:|');
    for(const name of ['initial','human','engineFrozen','brainOfflineReplayV1Forced']){
      const s=g[name];
      const fmt=v=>v==null?'—':Number(v).toFixed(2);
      lines.push(`| ${name} | ${s.count} | ${fmt(s.mean)} | ${fmt(s.std)} | ${fmt(s.median)} |`);
    }
    lines.push('');
  }
  const a=report.descriptiveAssociations;
  lines.push('## Associations descriptives','');
  lines.push('Descripteurs calculables avant la finale humaine : variation de paire initial→moteur et sa valeur absolue.');
  lines.push('');
  lines.push(`- n ante-humain : ${a.usingAnteHumanDescriptors.n}`);
  lines.push(`- moyenne (moteur − initial) ×10³ : ${a.usingAnteHumanDescriptors.meanPairEngineMinusInitialTimes1e3==null?'—':a.usingAnteHumanDescriptors.meanPairEngineMinusInitialTimes1e3.toFixed(3)}`);
  lines.push(`- Pearson |Δ paire initial→moteur| vs max erreur rail : ${a.usingAnteHumanDescriptors.pearsonAbsPairEngineMinusInitialVsMaxRailError==null?'insuffisant':a.usingAnteHumanDescriptors.pearsonAbsPairEngineMinusInitialVsMaxRailError.toFixed(3)}`);
  lines.push(`- n avec finale humaine : ${a.usingHumanFinal.n}`);
  lines.push(`- Pearson |Δ paire moteur−humain| vs max erreur rail : ${a.usingHumanFinal.pearsonAbsPairEngineHumanVsMaxRailError==null?'insuffisant':a.usingHumanFinal.pearsonAbsPairEngineHumanVsMaxRailError.toFixed(3)}`);
  lines.push('', a.note, '');
  lines.push('Chiffres humains rapportés hors rejeu :');
  lines.push('- parts 17/20 : avant ≈ 1482,85 ± 35,79 ; après humain ≈ 1437,07 ± 5,20');
  lines.push('- part 6 : avant ≈ 1438,71 ± 27,10 ; après humain ≈ 1435,99 ± 3,85');
  lines.push('Recopiés comme reported-not-recomputed tant que les JSON sources ne sont pas fournis.');
  return lines.join('\n')+'\n';
}

function main(){
  const a=args(process.argv.slice(2));
  const rows=[];
  const sources=[];
  const coverage=[];
  for(const file of a.inputs){
    const doc=read(file);
    const ingested=ingest(doc);
    sources.push({file:path.basename(file),format:doc.format||'unknown'});
    coverage.push({file:path.basename(file),...ingested.coverage});
    for(const entry of ingested.entries)rows.push(measureCase(entry,ingested.coverage));
  }
  const report={
    format:'banane-pair-lab-v1',
    generatedAt:new Date().toISOString(),
    canonical:'pairProfileOriginDistance',
    secondary:'pairRailPositionDistance',
    brainSeries:'brainOfflineReplayV1Forced',
    brainSeriesIsRuntimeBehavior:false,
    notAnEsvGauge:true,noTargetImposed:true,noThreshold:true,noTraining:true,
    units:{name:'scene-units',displayScale:1e3,physicalCalibrationStatus:'not-attested'},
    witness:witnessBlock(),
    sources,coverage,
    measuredCuts:rows.length,
    byPart:byPart(rows),
    descriptiveAssociations:descriptiveAssociations(rows),
    reportedHumanSeries:{
      status:'reported-not-recomputed',
      parts17and20:{initial:{mean:1482.85,std:35.79},human:{mean:1437.07,std:5.20},nCuts:null},
      part6:{initial:{mean:1438.71,std:27.10},human:{mean:1435.99,std:3.85},nCuts:null}
    },
    rows
  };
  if(a.out){fs.mkdirSync(path.dirname(a.out),{recursive:true});fs.writeFileSync(a.out,JSON.stringify(report,null,2));}
  if(a.markdown){fs.mkdirSync(path.dirname(a.markdown),{recursive:true});fs.writeFileSync(a.markdown,markdown(report));}
  console.log(JSON.stringify({
    format:report.format,measuredCuts:report.measuredCuts,parts:Object.keys(report.byPart),
    witness:report.witness.pairOriginDistanceTimes1e3,
    coverage:report.coverage,
    descriptiveAssociations:report.descriptiveAssociations
  },null,2));
}

if(require.main===module)main();
module.exports={
  WITNESS,BRAIN_OFFLINE_PARAMS,
  measureCase,ingest,ingestCorrectionSession,ingestOfflineEvaluation,
  byPart,descriptiveAssociations,prediction:descriptiveAssociations,
  witnessBlock,markdown,applyDeltas,
  replayFrozenEngine,replayBrainOfflineV1Forced,emptyCoverage
};
