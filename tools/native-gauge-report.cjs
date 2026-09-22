#!/usr/bin/env node
'use strict';
/* Écartement de paire mesuré sur une session Natif — lecture seule.
 *
 * Répond à une question précise et à une seule : QUE FAIT L'OPÉRATEUR à
 * l'écartement de la voie, et le placement automatique le laisse-t-il dans le
 * contrat ? La grandeur est la distance entre les origines des deux rails, en
 * millimètres : une distance, donc invariante par repère de scène et par
 * échange gauche/droite. C'est la seule grandeur comparable entre une session
 * Natif et un lot Pilote, qui ne partagent pas leur repère.
 *
 * L'état AVANT d'une visite Natif est la pose trouvée à l'ouverture du cut :
 * le placement laissé par le pilote si le cut a été traité, l'état ESV brut
 * sinon. Le rapport ne le devine pas — il le signale et laisse la jointure à
 * l'appelant, qui seul sait quels cuts un lot a visités.
 *
 * Ce rapport ne modifie rien et n'entraîne rien. `usableForTraining` reste
 * faux : une référence Natif demande une revue humaine explicite (D-008).
 *
 * Usage :
 *   node tools/native-gauge-report.cjs --input <export-natif.json> [...] [--json <sortie>]
 */
const fs=require('node:fs'),path=require('node:path');
const X=require('../src/native-export.js');
const Gauge=require('../src/gauge.js');
const C=require('../vendor/capture-core.js');
const N=require('./native-offline-evaluate.cjs');

function parseArgs(argv){
  const out={input:[],json:null};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--input')out.input.push(path.resolve(argv[++i]));
    else if(argv[i]==='--json')out.json=path.resolve(argv[++i]);
    else throw Error('Argument inconnu : '+argv[i]);
  }
  if(!out.input.length)throw Error('Au moins un --input est requis.');
  return out;
}
/* Une visite par cut : on garde la plus complète, une correction observée
 * primant sur une visite sans décision. */
function collect(files){
  const byCut=new Map();
  for(const file of files){
    const doc=JSON.parse(fs.readFileSync(file,'utf8'));
    const dict=doc.dictionaries||{};
    for(const raw of doc.records||[]){
      const record=X.unfoldRefs(raw,dict);
      const cut=record.identity?.cut;
      if(cut==null)continue;
      const score=(record.humanFinalReference?.state?2:0)+(record.beforeEstablished?.rails?1:0);
      const known=byCut.get(cut);
      if(!known||score>known.score)byCut.set(cut,{score,record,file:path.basename(file)});
    }
  }
  return byCut;
}
function rowOf(cut,record,file){
  const before=record.beforeEstablished?.rails||null;
  const corrected=record.humanFinalReference?.state?.rails||null;
  const displacement={left:null,right:null};
  for(const side of ['left','right'])
    displacement[side]=(before&&corrected)?N.humanDelta(before[side],corrected[side]):null;
  const beforeMm=before?Gauge.gaugeMmOf(before,C):NaN;
  const correctedMm=corrected?Gauge.gaugeMmOf(corrected,C):NaN;
  return {cut,part:record.identity?.part??null,file,
    label:record.observedLabelCandidate||null,
    referenceStatus:record.humanFinalReference?.status||'not-observed',
    freshnessMs:record.humanFinalReference?.association?.freshnessMs??null,
    pairEligibility:record.geometryEligibility?.pair?.status||'not-evaluated',
    usableAsNativeReference:!!record.usableAsNativeReference,
    usableForTraining:!!record.usableForTraining,
    beforeGaugeMm:Number.isFinite(beforeMm)?beforeMm:null,
    beforeGaugeClass:Gauge.classifyMm(beforeMm),
    correctedGaugeMm:Number.isFinite(correctedMm)?correctedMm:null,
    correctedGaugeClass:Gauge.classifyMm(correctedMm),
    displacementLocal:displacement};
}
const finite=values=>values.filter(Number.isFinite);
function summary(values){
  const v=finite(values);
  if(!v.length)return {count:0};
  const sorted=[...v].sort((a,b)=>a-b);
  const mean=v.reduce((a,b)=>a+b,0)/v.length;
  const sd=v.length>1?Math.sqrt(v.reduce((s,x)=>s+(x-mean)**2,0)/(v.length-1)):0;
  return {count:v.length,mean,sd,median:sorted[sorted.length>>1],min:sorted[0],max:sorted[sorted.length-1]};
}
/* Un biais n'est déclaré que si sa moyenne dépasse son écart-type : c'est le
 * critère déjà retenu par `src/brain.js` pour le biais vertical, et il sépare
 * un geste systématique d'une dispersion. */
const isBias=s=>s.count>1&&Math.abs(s.mean)>s.sd;
function build(rows){
  const corrected=rows.filter(r=>r.displacementLocal.left&&r.displacementLocal.right);
  const minor=corrected.filter(r=>['left','right'].every(side=>{
    const d=r.displacementLocal[side];
    return Math.hypot(d[1],d[2])*1000<20;}));
  const axis=(list,side,index)=>summary(list.map(r=>r.displacementLocal[side][index]*1000));
  const bias={};
  for(const side of ['left','right'])
    bias[side]={lateralMm:axis(minor,side,1),verticalMm:axis(minor,side,2)};
  for(const side of ['left','right'])for(const key of ['lateralMm','verticalMm'])
    bias[side][key].declaredBias=isBias(bias[side][key]);
  const classes={};
  for(const r of corrected)classes[r.correctedGaugeClass]=(classes[r.correctedGaugeClass]||0)+1;
  return {visits:rows.length,withHumanCorrection:corrected.length,
    minorRetouchesUnder20mm:minor.length,
    pairComparable:rows.filter(r=>r.pairEligibility==='comparable-candidate').length,
    usableAsNativeReference:rows.filter(r=>r.usableAsNativeReference).length,
    gaugeBeforeMm:summary(corrected.map(r=>r.beforeGaugeMm)),
    gaugeCorrectedMm:summary(corrected.map(r=>r.correctedGaugeMm)),
    correctedGaugeClasses:classes,
    biasOnMinorRetouches:bias,
    contract:Gauge.CONTRACT};
}
function run(argv=process.argv.slice(2)){
  const args=parseArgs(argv);
  const rows=[...collect(args.input).entries()].sort((a,b)=>a[0]-b[0])
    .map(([cut,{record,file}])=>rowOf(cut,record,file));
  const report={format:'banane-native-gauge-report-v1',generatedAt:new Date().toISOString(),
    sources:args.input.map(f=>path.basename(f)),metrics:build(rows),rows,
    limits:['L’état AVANT est la pose trouvée à l’ouverture du cut : placement du pilote si le cut a été traité, état ESV brut sinon. Le rapport ne les distingue pas.',
      'L’écartement est mesurable même quand la géométrie LiDAR ne l’est pas : `pairComparable` dit sur combien de visites le moteur peut être rejoué.',
      'Aucune référence Natif n’est rendue entraînable ici : `usableForTraining` reste faux (D-008).']};
  if(args.json){fs.mkdirSync(path.dirname(args.json),{recursive:true});
    fs.writeFileSync(args.json,JSON.stringify(report,null,2));}
  return report;
}
if(require.main===module){
  try{
    const r=run();
    const m=r.metrics,f=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'-';
    console.log(`visites ${m.visits} · corrections humaines ${m.withHumanCorrection} · paire rejouable ${m.pairComparable} · référence native ${m.usableAsNativeReference}`);
    console.log(`écartement avant   : n=${m.gaugeBeforeMm.count} médiane ${f(m.gaugeBeforeMm.median)} mm [${f(m.gaugeBeforeMm.min)} .. ${f(m.gaugeBeforeMm.max)}]`);
    console.log(`écartement corrigé : n=${m.gaugeCorrectedMm.count} médiane ${f(m.gaugeCorrectedMm.median)} mm [${f(m.gaugeCorrectedMm.min)} .. ${f(m.gaugeCorrectedMm.max)}]`);
    console.log(`classes après correction : ${JSON.stringify(m.correctedGaugeClasses)}`);
    for(const side of ['left','right'])for(const key of ['lateralMm','verticalMm']){
      const s=m.biasOnMinorRetouches[side][key];
      console.log(`  ${side.padEnd(5)} ${key.padEnd(10)} n=${String(s.count).padStart(3)} moyenne ${f(s.mean,2).padStart(6)} écart-type ${f(s.sd,2).padStart(6)}${s.declaredBias?'  BIAIS':''}`);
    }
  }catch(error){console.error(error.stack||error);process.exitCode=1;}
}
module.exports={build,collect,rowOf,run,summary,parseArgs};
