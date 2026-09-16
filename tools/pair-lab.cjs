#!/usr/bin/env node
'use strict';
/* Pair Lab V1 — banc hors ligne, lecture seule.
 *
 * Mesure pairOriginDistance (distance euclidienne des origines de profil)
 * pour : initial / humain / moteur gelé / cerveau. Découpe par part.
 * Témoin obligatoire : part 6 / cut 9480.
 *
 * N'appelle pas cette grandeur « écartement ».
 * N'impose pas 1436 comme cible.
 * N'ajuste aucun seuil, n'entraîne rien, n'envoie aucune commande ESV.
 * Ne modifie ni geometry.js, ni le cerveau, ni les empreintes gelées.
 */
const fs=require('node:fs'),path=require('node:path');
const Pod=require('../src/pair-origin-distance.js');
const K=require('../src/core.js');
const Brain=require('../src/brain.js');
const GeometryBrain=require('../src/geometry-brain.js');

const WITNESS={part:6,cut:9480,shape:'U50',
  observed:{
    kind:'reported-observation',
    source:'AUDIT_PILOTE.md défaut 7 — cut 6/9480',
    pairOriginDistanceTimes1e3:{initial:1499.93,banane:1517.73,engineFrozen:1518.19}
  }};

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
function fromCorrectionRecord(record){
  const id={part:record.part??record.identity?.part??null,cut:record.cut??record.identity?.cut??null,
    shape:record.shape??record.identity?.shape??null,sessionId:record.sessionId??null};
  const initial={left:record.rails?.left?.initial||null,right:record.rails?.right?.initial||null};
  const human={left:record.rails?.left?.corrected||null,right:record.rails?.right?.corrected||null};
  return {kind:'correction-record',identity:id,initial,human,engineProposals:null};
}
function fromOfflineRow(row){
  const id=row.identity||{};
  return {kind:'offline-evaluation-row',identity:{part:id.part??null,cut:id.cut??null,shape:id.shape??null,sessionId:id.sessionId??null},
    initial:row.initialRails||null,human:row.finalHumanRails||null,engineProposals:row.proposal||null,
    railErrorTimes1e3:{
      left:row.rails?.left?.errorMm?.euclidean??null,
      right:row.rails?.right?.errorMm?.euclidean??null
    }};
}
function collect(doc){
  if(doc.format==='banane-corrections-session-v4')return (doc.records||[]).map(fromCorrectionRecord);
  if(doc.format==='banane-offline-evaluation-v1')return (doc.results||[]).map(fromOfflineRow);
  if(Array.isArray(doc.records))return doc.records.map(fromCorrectionRecord);
  return [];
}
function measureCase(entry){
  const initial=Pod.pairOriginDistance(entry.initial?.left,entry.initial?.right);
  const human=Pod.pairOriginDistance(entry.human?.left,entry.human?.right);
  let engine= {status:'unavailable',reason:'engine-origins-not-computed'};
  let brain= {status:'unavailable',reason:'brain-not-computed'};
  const engineRails=applyDeltas(entry.initial,entry.engineProposals);
  if(engineRails)engine=Pod.pairOriginDistance(engineRails.left,engineRails.right);
  if(entry.engineProposals?.left&&entry.engineProposals?.right){
    const corrected=Brain.corrigerPaire(entry.engineProposals,GeometryBrain.AJUSTE);
    const brainRails=applyDeltas(entry.initial,corrected.proposals);
    if(brainRails)brain=Pod.pairOriginDistance(brainRails.left,brainRails.right);
  }
  return {identity:entry.identity,kind:entry.kind,
    pairOriginDistance:{initial,human,engine,brain},
    pairOriginDistanceTimes1e3:{initial:times1e3(initial),human:times1e3(human),engine:times1e3(engine),brain:times1e3(brain)},
    railErrorTimes1e3:entry.railErrorTimes1e3||null};
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
    out[part]={
      cuts:list.length,
      initial:Pod.stats(list.map(r=>r.pairOriginDistanceTimes1e3.initial)),
      human:Pod.stats(list.map(r=>r.pairOriginDistanceTimes1e3.human)),
      engine:Pod.stats(list.map(r=>r.pairOriginDistanceTimes1e3.engine)),
      brain:Pod.stats(list.map(r=>r.pairOriginDistanceTimes1e3.brain))
    };
  }
  return out;
}
function prediction(rows){
  const both=rows.filter(r=>Number.isFinite(r.pairOriginDistanceTimes1e3.engine)&&Number.isFinite(r.pairOriginDistanceTimes1e3.human));
  const withRail=both.filter(r=>Number.isFinite(r.railErrorTimes1e3?.left)||Number.isFinite(r.railErrorTimes1e3?.right));
  const engineMinusHuman=both.map(r=>r.pairOriginDistanceTimes1e3.engine-r.pairOriginDistanceTimes1e3.human);
  const absEngineMinusHuman=withRail.map(r=>Math.abs(r.pairOriginDistanceTimes1e3.engine-r.pairOriginDistanceTimes1e3.human));
  return {
    question:'pairOriginDistance prédit-il les mauvaises propositions moteur, mieux que le rail isolé ?',
    nWithEngineAndHuman:both.length,
    nWithRailError:withRail.length,
    meanEngineMinusHumanTimes1e3:engineMinusHuman.length?engineMinusHuman.reduce((s,x)=>s+x,0)/engineMinusHuman.length:null,
    pearsonAbsPairEngineErrorVsMaxRailError:withRail.length>=3?Pod.pearson(
      absEngineMinusHuman,
      withRail.map(r=>Math.max(r.railErrorTimes1e3.left??-Infinity,r.railErrorTimes1e3.right??-Infinity))):null,
    pearsonAbsInitialMinusHumanVsMaxRailError:withRail.filter(r=>Number.isFinite(r.pairOriginDistanceTimes1e3.initial)).length>=3?Pod.pearson(
      withRail.filter(r=>Number.isFinite(r.pairOriginDistanceTimes1e3.initial)).map(r=>Math.abs(r.pairOriginDistanceTimes1e3.initial-r.pairOriginDistanceTimes1e3.human)),
      withRail.filter(r=>Number.isFinite(r.pairOriginDistanceTimes1e3.initial)).map(r=>Math.max(r.railErrorTimes1e3.left??-Infinity,r.railErrorTimes1e3.right??-Infinity))):null,
    humanDispersionTimes1e3:Pod.stats(both.map(r=>r.pairOriginDistanceTimes1e3.human)),
    initialDispersionTimes1e3:Pod.stats(both.map(r=>r.pairOriginDistanceTimes1e3.initial)),
    note:'Corrélation descriptive uniquement. Aucun seuil, aucune règle métier, aucune calibration. Une corrélation nulle ou un n trop petit = absence de preuve, pas une preuve d’absence.'
  };
}
function witnessBlock(){
  const o=WITNESS.observed.pairOriginDistanceTimes1e3;
  return {
    identity:{part:WITNESS.part,cut:WITNESS.cut,shape:WITNESS.shape},
    status:'mandatory-witness',
    kind:WITNESS.observed.kind,
    source:WITNESS.observed.source,
    pairOriginDistanceTimes1e3:{initial:o.initial,human:null,engine:o.engineFrozen,brain:null,bananeObserved:o.banane},
    interpretation:[
      'Fait observé rapporté, pas un rejeu local : le JSON source du cut 6/9480 n’est pas dans ce dépôt.',
      'Banane a augmenté pairOriginDistance par rapport à l’initial (1499,93 → 1517,73), dans le même sens que le moteur gelé (1518,19).',
      'Ce n’est pas une lecture d’écartement ESV. Aucune cible n’est posée.'
    ]
  };
}
function markdown(report){
  const w=report.witness;
  const lines=[
    '# Pair Lab V1',
    '',
    'Grandeur : `pairOriginDistance` — distance euclidienne entre origines de profil, unités de scène ×10⁻³ d’affichage.',
    'Pas un écartement ESV. Pas de cible 1436. Pas de seuil. Pas d’entraînement.',
    '',
    '## Témoin obligatoire 6/9480',
    '',
    `| source | pairOriginDistance ×10³ |`,
    `|---|---:|`,
    `| initial (rapporté) | ${w.pairOriginDistanceTimes1e3.initial} |`,
    `| Banane observée (rapportée) | ${w.pairOriginDistanceTimes1e3.bananeObserved} |`,
    `| moteur gelé (rapporté) | ${w.pairOriginDistanceTimes1e3.engine} |`,
    '',
    ...w.interpretation.map(x=>'- '+x),
    '',
    `Cuts mesurés dans cette exécution : ${report.measuredCuts}.`,
    '',
    '## Par part',
    ''
  ];
  for(const [part,g] of Object.entries(report.byPart)){
    lines.push(`### Part ${part} (n=${g.cuts})`);
    lines.push('');
    lines.push('| série | n | moyenne | écart-type | médiane |');
    lines.push('|---|---:|---:|---:|---:|');
    for(const name of ['initial','human','engine','brain']){
      const s=g[name];
      const fmt=v=>v==null?'—':Number(v).toFixed(2);
      lines.push(`| ${name} | ${s.count} | ${fmt(s.mean)} | ${fmt(s.std)} | ${fmt(s.median)} |`);
    }
    lines.push('');
  }
  const p=report.prediction;
  lines.push('## Pouvoir prédictif (descriptif)');
  lines.push('');
  lines.push(`- n moteur+humain : ${p.nWithEngineAndHuman}`);
  lines.push(`- n avec erreur rail : ${p.nWithRailError}`);
  lines.push(`- moyenne (moteur − humain) ×10³ : ${p.meanEngineMinusHumanTimes1e3==null?'—':p.meanEngineMinusHumanTimes1e3.toFixed(3)}`);
  lines.push(`- Pearson |\u0394 paire moteur-humain| vs max erreur rail : ${p.pearsonAbsPairEngineErrorVsMaxRailError==null?'insuffisant':p.pearsonAbsPairEngineErrorVsMaxRailError.toFixed(3)}`);
  lines.push(`- Pearson |\u0394 paire initial-humain| vs max erreur rail : ${p.pearsonAbsInitialMinusHumanVsMaxRailError==null?'insuffisant':p.pearsonAbsInitialMinusHumanVsMaxRailError.toFixed(3)}`);
  lines.push('');
  lines.push(p.note);
  lines.push('');
  lines.push('Chiffres rapportés hors rejeu (211 cuts humains, AUDIT_PILOTE) :');
  lines.push('- parts 17/20 : avant \u2248 1482,85 \u00b1 35,79 ; après humain \u2248 1437,07 \u00b1 5,20');
  lines.push('- part 6 : avant \u2248 1438,71 \u00b1 27,10 ; après humain \u2248 1435,99 \u00b1 3,85');
  lines.push('Ces lignes restent des faits rapportés tant que les JSON sources ne sont pas fournis à ce banc.');
  return lines.join('\n')+'\n';
}

function main(){
  const a=args(process.argv.slice(2));
  const rows=[];
  const sources=[];
  for(const file of a.inputs){
    const doc=read(file);
    sources.push({file:path.basename(file),format:doc.format||'unknown'});
    for(const entry of collect(doc))rows.push(measureCase(entry));
  }
  const report={
    format:'banane-pair-lab-v1',
    generatedAt:new Date().toISOString(),
    name:'pairOriginDistance',
    notAnEsvGauge:true,
    noTargetImposed:true,
    noThreshold:true,
    noTraining:true,
    units:{name:'scene-units',displayScale:1e3,physicalCalibrationStatus:'not-attested'},
    witness:witnessBlock(),
    sources,
    measuredCuts:rows.length,
    byPart:byPart(rows),
    prediction:prediction(rows),
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
    witness:report.witness.pairOriginDistanceTimes1e3,prediction:report.prediction
  },null,2));
}
if(require.main===module)main();
module.exports={WITNESS,measureCase,fromCorrectionRecord,fromOfflineRow,collect,byPart,prediction,witnessBlock,markdown,applyDeltas};
