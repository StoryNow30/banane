const fs=require('node:fs'),path=require('node:path');
const G=require('../src/geometry.js'),baseline=require('../tests/baseline-geometry-v301.cjs');

const root=path.resolve(__dirname,'..');
const input=path.resolve(process.argv[2]||path.join(root,'datasets/manual/banane-corrections-v4-1788961523204.json'));
const output=path.resolve(process.argv[3]||path.join(root,'datasets/automatic/geometry-evaluation-v4.2.0.json'));
const data=JSON.parse(fs.readFileSync(input,'utf8'));
if(!Array.isArray(data.records)||!Array.isArray(data.clouds))throw Error('Export de corrections V4 attendu.');
const clouds=new Map(data.clouds.map(c=>[c.captureId,c])),rows=[],missing=[],excludedFromTraining=[];
const errorMm=(delta,target)=>delta?Math.hypot(...delta.map((v,i)=>(v-target[i])*1000)):null;

for(const record of [...data.records].sort((a,b)=>a.cut-b.cut)){
 if(record.usableForTraining===false){excludedFromTraining.push({recordId:record.recordId,cut:record.cut,
   operatorDecision:record.operatorDecision||null,reason:record.trainingExclusionReason||record.reason||'not-usable-for-training'});continue;}
 const capture=clouds.get(record.lidarCaptureId);if(!capture){missing.push(record.recordId);continue;}
 const current=G.proposeBoth(capture);
 for(const side of ['left','right']){
  const before=baseline.propose(capture,side),after=current[side],target=record.rails[side].displacementLocal;
  rows.push({part:record.part,cut:record.cut,side,manualMm:target.map(v=>v*1000),
   baseline:{status:before.status,deltaMm:before.delta?.map(v=>v*1000)||null,errorMm:errorMm(before.delta,target),confidence:before.confidence},
   current:{status:after.status,deltaMm:after.delta?.map(v=>v*1000)||null,errorMm:errorMm(after.delta,target),confidence:after.confidence,
    reasons:after.reasons,source:after.source,templateLossRatio:after.metrics?.templateAmbiguity?.lossRatio??null}});
 }
}

const percentile=(a,p)=>a.length?a[Math.floor(p*(a.length-1))]:null;
const stats=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);return {n:a.length,meanMm:a.length?a.reduce((s,v)=>s+v,0)/a.length:null,
 medianMm:a.length?G.median(a):null,p90Mm:percentile(a,.9),maxMm:a.length?a.at(-1):null,within10mm:a.filter(v=>v<=10).length};};
const summarize=name=>{const candidate=rows.filter(r=>r[name].errorMm!==null),cuts=[...new Set(rows.map(r=>r.cut))],full=cuts.filter(c=>rows.filter(r=>r.cut===c).every(r=>r[name].errorMm!==null));
 return {candidateRails:candidate.length,totalRails:rows.length,railCoverage:candidate.length/rows.length,fullyProposableCuts:full.length,totalCuts:cuts.length,
  cutCoverage:full.length/cuts.length,error:stats(candidate.map(r=>r[name].errorMm)),errorsOver25mm:candidate.filter(r=>r[name].errorMm>25).map(r=>({cut:r.cut,side:r.side,errorMm:r[name].errorMm}))};};
const baselineSummary=summarize('baseline'),currentSummary=summarize('current');
const result={format:'banane-geometry-evaluation',version:'4.2.0',evaluatedAt:new Date().toISOString(),input:{file:path.basename(input),format:data.format,
 records:data.records.length,eligibleRecords:data.records.length-excludedFromTraining.length,clouds:data.clouds.length,
 missingCloudRecordIds:missing,excludedFromTraining},method:G.DEFAULTS,
 comparison:{baseline:{label:'V4.0 surface-intersection placement (V3.0.1 equivalent on these 47 supported references)',...baselineSummary},
 current:{label:'V4.2 supported-template placement with ambiguity and pair gates',...currentSummary}},
 rejectedFormerErrorsOver25mm:rows.filter(r=>r.baseline.errorMm>25&&r.current.errorMm===null).map(r=>({cut:r.cut,side:r.side,
  formerErrorMm:r.baseline.errorMm,reasons:r.current.reasons})),rows};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2));
console.log(JSON.stringify({baseline:baselineSummary,current:currentSummary,rejectedFormerErrorsOver25mm:result.rejectedFormerErrorsOver25mm},null,2));
console.log('Rapport : '+path.relative(root,output));
