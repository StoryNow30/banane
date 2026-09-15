const fs=require('node:fs'),path=require('node:path');
const G=require('../src/geometry.js');
const root=path.resolve(__dirname,'..');
const input=process.argv[2]||path.join(root,'tests/corpus');
const index=JSON.parse(fs.readFileSync(path.join(input,'index.json')));
const records=JSON.parse(fs.readFileSync(path.join(input,'references.json'))).records;
const train=new Set([2855,2856,2857,2858,2859,2860,2864]);
const rows=[];
const baseline={};for(const s of ['left','right'])baseline[s]=[0,1,2].map(i=>G.median(records.filter(r=>train.has(r.cut)).map(r=>r.rails[s].displacementLocal[i])));
for(const pair of index.paired){
 const capture=JSON.parse(fs.readFileSync(path.join(input,pair.lidar_file)));
 const ref=records.find(r=>r.recordId===pair.recordId);
 for(const side of ['left','right']){
  const start=performance.now(),fit=G.propose(capture,side),target=ref.rails[side].displacementLocal;
  rows.push({cut:pair.cut,side,split:train.has(pair.cut)?'calibration':'evaluation',status:fit.status,source:fit.source,
   proposed_mm:fit.delta?.map(v=>v*1000)||null,manual_mm:target.map(v=>v*1000),
   error_mm:fit.delta?Math.hypot(...fit.delta.map((v,i)=>(v-target[i])*1000)):null,
   baseline_error_mm:Math.hypot(...baseline[side].map((v,i)=>(v-target[i])*1000)),
   confidence:fit.confidence,reasons:fit.reasons,metrics:fit.metrics,duration_ms:performance.now()-start});
 }
}
const summaries={};for(const split of ['calibration','evaluation']){
 const all=rows.filter(r=>r.split===split),ok=all.filter(r=>r.error_mm!==null),accepted=ok.filter(r=>r.confidence>=G.DEFAULTS.minConfidence);
 const stats=a=>({n:a.length,mean_mm:a.length?a.reduce((s,r)=>s+r.error_mm,0)/a.length:null,median_mm:a.length?G.median(a.map(r=>r.error_mm)):null,max_mm:a.length?Math.max(...a.map(r=>r.error_mm)):null});
 summaries[split]={total:all.length,allCandidates:stats(ok),aboveConfidenceThreshold:stats(accepted),
  baseline_mean_mm:all.reduce((s,r)=>s+r.baseline_error_mm,0)/all.length};
}
const output={method:G.DEFAULTS,baseline:{method:'per-side median calibration delta; comparison only, not used by runtime',delta:baseline},summaries,rows};
fs.writeFileSync(path.join(root,'audit/geometry-results.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify(summaries,null,2));for(const r of rows)console.log(r.cut,r.side,r.confidence,r.error_mm?.toFixed(2),r.proposed_mm?.map(x=>x.toFixed(2)).join(','),r.metrics?.faceCount);
