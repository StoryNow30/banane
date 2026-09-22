#!/usr/bin/env node
'use strict';
/*
 * convention-fit.cjs — ajuste et valide le calage de convention.
 *
 *   node tools/convention-fit.cjs --input SESSION.json[=libellé] [--input ...] [--json SORTIE]
 *
 * Cahier 4.8, amendement n°4. Pour chaque rail publié par le moteur Pilote SANS
 * calage et validé par l'opérateur, l'outil mesure avec `src/placement-convention.js`
 * — le module même qui tourne dans le Pilote — la bande de points autour du
 * gabarit posé, puis l'écart du moteur à l'humain :
 *
 *   uErr = moteur − humain, latéral, orienté vers le champignon (mm)
 *   vErr = moteur − humain, vertical (mm)
 *
 * Il ajuste les deux constantes du module sur toutes les sessions, puis les
 * valide en retenant chaque session à tour de rôle (ajustement sur les autres,
 * mesure sur celle-ci). Rapportés : médiane, p90 et maximum, avant et après,
 * latéral, vertical et écartement.
 *
 * Les rails faux de plus de 10 mm sont exclus de l'ajustement : ils relèvent
 * d'un mauvais minimum, pas d'une convention, et la garde de paire les
 * intercepte. La référence humaine n'est lue qu'après le calcul moteur.
 */
const fs=require('node:fs'),path=require('node:path');
const Lab=require('./placement-lab.cjs'),Shadow=require('../src/gcv1-shadow.js');
const Convention=require('../src/placement-convention.js'),Gauge=require('../src/gauge.js'),C=require('../vendor/capture-core.js');
const SIDES=['left','right'],WRONG_MM=10;
const median=v=>{const a=v.filter(Number.isFinite).sort((x,y)=>x-y),n=a.length;return n?(n%2?a[n>>1]:(a[n/2-1]+a[n/2])/2):null;};
const quantile=(v,p)=>{const a=v.filter(Number.isFinite).sort((x,y)=>x-y);return a.length?a[Math.min(a.length-1,Math.floor(p*a.length))]:null;};
const r2=v=>Number.isFinite(v)?Math.round(v*100)/100:null;

function observationsByVisit(session){
  const map=new Map();
  for(const e of session.events||[])if(e.visitId&&['native-visit-started','native-state-observed'].includes(e.type)){
    const rows=map.get(e.visitId)||[];rows.push({type:e.type,eventSeq:e.eventSeq,state:e.type==='native-visit-started'?e.initialObserved:e.state});map.set(e.visitId,rows);}
  for(const rows of map.values())rows.sort((a,b)=>a.eventSeq-b.eventSeq);
  return map;
}
/* Une ligne par rail publié et référencé, calage coupé. */
function collect(session,label){
  const clouds=new Map((session.clouds||[]).map(c=>[c.chunkId||c.captureId,c])),byVisit=observationsByVisit(session),rows=[],cuts=[];
  const previous=Shadow.state().convention;Shadow.configure({convention:false});
  try{
    for(const record of session.records||[]){
      let prepared;try{prepared=Lab.prepareVisit(record,clouds,byVisit.get(record.visitId)||[]);}catch{continue;}
      const capture=prepared.pair?.status==='ready'?prepared.pair.capture:null;if(!capture)continue;
      const science=Shadow.scientificProposeBoth(capture),cut={label,cut:record.identity?.cut,rails:{}};
      for(const side of SIDES){
        const rail=science.rails[side];if(!rail?.ok||rail.next.status!=='candidate')continue;
        const input=prepared.rails[side];if(input?.status!=='ready')continue;
        // Jugement : la référence humaine n'est lue qu'ici, après le calcul moteur.
        const reference=Lab.referenceFor(record,side,input.initialRail,input.snapshotAcquiredThroughAt);
        if(reference.status!=='candidate')continue;
        const raw=rail.next.delta,h=reference.deltaLocal,sign=rail.frame.sign,band=Convention.bandOffsets(capture,side,raw);
        if(!band.ok)continue;
        const row={label,cut:record.identity?.cut,side,uErr:sign*(raw[1]-h[1])*1000,vErr:(raw[2]-h[2])*1000,
          topN:band.top.length,faceN:band.face.length,
          topQ:quantile(band.top,Convention.DEFAULTS.topQuantile),faceQ:quantile(band.face,Convention.DEFAULTS.faceQuantile),sign};
        rows.push(row);cut.rails[side]={row,raw,human:h};
      }
      if(cut.rails.left&&cut.rails.right){cut.capture=capture;cuts.push(cut);}
    }
  }finally{Shadow.configure({convention:previous});}
  return {rows,cuts};
}
/* Le modèle du module, paramétré par ses deux constantes. */
function predict(row,k){
  const d=Convention.DEFAULTS;
  const dz=row.topN>=d.minTopPoints&&Number.isFinite(row.topQ)?row.topQ+k.topOffsetMm:0;
  const du=row.faceN>=d.minFacePoints&&Number.isFinite(row.faceQ)?row.faceQ+k.faceOffsetMm:d.faceFallbackMm;
  if(Math.abs(dz)>d.maxShiftMm||Math.abs(du)>d.maxShiftMm)return {du:0,dz:0,applied:false};
  return {du,dz,applied:dz!==0||du!==0};
}
function fit(rows){
  const d=Convention.DEFAULTS,ok=rows.filter(r=>Math.abs(r.uErr)<=WRONG_MM);
  return {topOffsetMm:median(ok.filter(r=>r.topN>=d.minTopPoints).map(r=>-r.vErr-r.topQ)),
    faceOffsetMm:median(ok.filter(r=>r.faceN>=d.minFacePoints).map(r=>-r.uErr-r.faceQ)),
    /* Mesuré et rapporté, mais NON utilisé : le module ne corrige pas
     * latéralement un flanc sous-observé (voir `placement-convention.js`). */
    faceFallbackObservedMm:median(ok.filter(r=>r.faceN<d.minFacePoints).map(r=>-r.uErr))};
}
function stats(values){const a=values.filter(Number.isFinite).map(Math.abs);
  return {n:a.length,medianMm:r2(median(a)),p90Mm:r2(quantile(a,.9)),maxMm:r2(a.length?Math.max(...a):null),over10:a.filter(v=>v>WRONG_MM).length};}
/* Validation en retenant chaque session. L'écartement est recalculé sur les
 * cuts dont les deux rails sont publiés et référencés. */
function crossValidate(sessions){
  const labels=sessions.map(s=>s.label),before={u:[],v:[],g:[]},after={u:[],v:[],g:[]},folds=[];
  for(const label of labels){
    const train=sessions.filter(s=>s.label!==label).flatMap(s=>s.rows),test=sessions.find(s=>s.label===label),k=fit(train);
    const rows=test.rows.filter(r=>Math.abs(r.uErr)<=WRONG_MM);
    for(const r of rows){const p=predict(r,k);before.u.push(r.uErr);before.v.push(r.vErr);after.u.push(r.uErr+p.du);after.v.push(r.vErr+p.dz);}
    for(const cut of test.cuts){
      if(SIDES.some(side=>Math.abs(cut.rails[side].row.uErr)>WRONG_MM))continue;
      const deltas=Object.fromEntries(SIDES.map(side=>{const {row,raw}=cut.rails[side],p=predict(row,k);return [side,[raw[0],raw[1]+row.sign*p.du/1000,raw[2]+p.dz/1000]];}));
      const raw=Object.fromEntries(SIDES.map(side=>[side,cut.rails[side].raw])),human=Object.fromEntries(SIDES.map(side=>[side,cut.rails[side].human]));
      const hg=Gauge.predictedGaugeMm(cut.capture.rails,human,C);
      before.g.push(Gauge.predictedGaugeMm(cut.capture.rails,raw,C)-hg);after.g.push(Gauge.predictedGaugeMm(cut.capture.rails,deltas,C)-hg);
    }
    folds.push({heldOut:label,constants:Object.fromEntries(Object.entries(k).map(([a,b])=>[a,r2(b)])),rails:rows.length});
  }
  const signed=v=>r2(median(v));
  return {folds,
    lateral:{before:stats(before.u),after:stats(after.u),signedBefore:signed(before.u),signedAfter:signed(after.u)},
    vertical:{before:stats(before.v),after:stats(after.v),signedBefore:signed(before.v),signedAfter:signed(after.v)},
    gauge:{before:stats(before.g),after:stats(after.g),signedBefore:signed(before.g),signedAfter:signed(after.g)}};
}
function run(argv=process.argv.slice(2)){
  const inputs=[];let out=null;
  for(let i=0;i<argv.length;i++){if(argv[i]==='--input'){const [file,label]=argv[++i].split('=');inputs.push({file,label:label||path.basename(file)});}
    else if(argv[i]==='--json')out=argv[++i];else throw Error('Argument inconnu : '+argv[i]);}
  if(!inputs.length){console.error('Usage : --input SESSION.json[=libellé] [--input ...] [--json SORTIE]');process.exit(1);}
  const sessions=inputs.map(({file,label})=>{const s=collect(JSON.parse(fs.readFileSync(file,'utf8')),label);console.log(`${label} : ${s.rows.length} rails référencés, ${s.cuts.length} cuts à deux rails`);return {label,...s};});
  const constants=fit(sessions.flatMap(s=>s.rows)),cv=crossValidate(sessions);
  const line=(name,x)=>console.log(`${name.padEnd(11)} médiane ${x.before.medianMm} → ${x.after.medianMm} mm · p90 ${x.before.p90Mm} → ${x.after.p90Mm} · max ${x.before.maxMm} → ${x.after.maxMm} · biais ${x.signedBefore} → ${x.signedAfter}`);
  console.log(`constantes (toutes sessions) : dessus ${r2(constants.topOffsetMm)} · flanc ${r2(constants.faceOffsetMm)} mm · (flanc < ${Convention.DEFAULTS.minFacePoints} points : ${r2(constants.faceFallbackObservedMm)} mm observé, non utilisé)`);
  console.log(`module : dessus ${Convention.DEFAULTS.topOffsetMm} · flanc ${Convention.DEFAULTS.faceOffsetMm} · repli ${Convention.DEFAULTS.faceFallbackMm} mm`);
  console.log('validation, chaque session retenue à tour de rôle :');line('latéral',cv.lateral);line('vertical',cv.vertical);line('écartement',cv.gauge);
  const report={format:'banane-convention-fit-v1',module:Convention.DEFAULTS,wrongMm:WRONG_MM,
    constants:Object.fromEntries(Object.entries(constants).map(([a,b])=>[a,r2(b)])),crossValidation:cv,
    sessions:sessions.map(s=>({label:s.label,rails:s.rows.length,cuts:s.cuts.length,
      rows:s.rows.map(r=>({cut:r.cut,side:r.side,uErr:r2(r.uErr),vErr:r2(r.vErr),topN:r.topN,faceN:r.faceN,topQ:r2(r.topQ),faceQ:r2(r.faceQ)}))}))};
  if(out)fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
  return report;
}
if(require.main===module)run();
module.exports={collect,predict,fit,crossValidate,run};
