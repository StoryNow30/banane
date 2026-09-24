#!/usr/bin/env node
'use strict';
/* Étude hors ligne des premiers passages : aucune position humaine ne participe
 * à la décision. Les appuis sont refaits pour chaque règle, cut après cut.
 * Usage : node --max-old-space-size=12000 tools/first-pass-signal-study.cjs SORTIE.json
 *   --natif DOSSIER=nom [...] --lot DOSSIER=nom[@RELECTURE] [...]
 */
const fs=require('node:fs'),path=require('node:path');
const Seg=require('./merge-segments.cjs'),Lab=require('./placement-lab.cjs');
const O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js');
const L=require('../src/lot-decision.js'),A=require('./acceptance-report.cjs'),C=require('../vendor/capture-core.js');
const SIDES=['left','right'],EXCLUDED=new Set([9033,9241]);
const round=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
function features(capture,science,d){
 const rails=Object.fromEntries(SIDES.map(s=>{const r=science.rails[s],p=capture.rails[s];
  const q=d.positions?.[s],M=p.sceneRelativeToProfileLocal,a=C.point(M,p.positionSceneRelative),b=q&&C.point(M,q);
  return [s,{status:r?.next?.status??null,motif:r?.next?.motif??null,s1:!!r?.next?.changed,
   lossRatio:round(r?.astar?.lossRatio),relativeLoss:round(r?.next?.loss/r?.competitive?.lmin),
   rank:r?.next?.rank??null,rankAvailable:r?.next?.rank!=null,competitiveCount:r?.competitive?.nCompetitive??null,
   top:r?.next?.topRows??null,face:r?.next?.faceCount??null,
   convention:r?.conventionCalibration?.reason??null,conventionApplied:!!r?.conventionCalibration?.applied,
   esvLateralMm:b?round((b[1]-a[1])*1000):null,esvVerticalMm:b?round((b[2]-a[2])*1000):null}];}));
 return {stage:d.stage,anchors:d.anchorsUsed?.length??0,gaugeMm:d.gaugeMm??round(d.positions&&C.distance(d.positions.left,d.positions.right)*1000),
  gaugeJumpMm:d.gaugeJumpMm??null,guardMm:d.guardMm??null,rails};
}
const max=(f,key)=>Math.max(...SIDES.map(s=>Math.abs(f.rails[s][key]??0)));
const RULES={
 'esv-100':f=>max(f,'esvLateralMm')>100,
 'esv-50':f=>max(f,'esvLateralMm')>50,
 'dessus-20':f=>SIDES.some(s=>f.rails[s].top!=null&&f.rails[s].top<20),
 'flanc-6':f=>SIDES.some(s=>f.rails[s].face!=null&&f.rails[s].face<6),
 'calage-hors-domaine':f=>SIDES.some(s=>f.rails[s].convention==='shift-out-of-domain'),
 'sans-appui-esv-100':f=>f.anchors===0&&max(f,'esvLateralMm')>100,
};
function ruled(capture,science,d,predicate){
 const f=features(capture,science,d);
 if(d.stage==='first-pass'&&predicate(f))return {decision:{...d,stage:'deferred',reason:'study-first-pass',positions:undefined,anchor:false},feature:f,removed:true};
 return {decision:d,feature:f,removed:false};
}
function local(rail,pos){const M=rail.sceneRelativeToProfileLocal,o=C.point(M,rail.positionSceneRelative),q=C.point(M,pos);return [q[1]-o[1],q[2]-o[2]];}
function natif(input,label){
 const session=Seg.loadSession(input),records=session.records.slice().sort((a,b)=>a.visitIndex-b.visitIndex),seen=new Set(),chunks=new Map(),prepared=[];
 for(const c of session.clouds||[])if(c.pointsSceneRelative){if(!chunks.has(c.visitId))chunks.set(c.visitId,[]);chunks.get(c.visitId).push(c);}
 for(const r of records){const id=r.identity||{},key=id.part+'|'+id.cut;if(seen.has(key))continue;seen.add(key);
  if(EXCLUDED.has(id.cut)||!r.beforeEstablished?.rails)continue;
  const cs=chunks.get(r.visitId)||[],i=O.gatherInput(r,cs);
  if(!SIDES.every(s=>i.contours[s])||!i.points.length)continue;
  const rails=O.startRails(r,i,null).rails,capture={identity:id,rails,pointsSceneRelative:i.points,visibleByClipBoxes:i.visible};
  const science=Shadow.scientificProposeBoth(capture);
  const through=cs.filter(c=>i.chunkIds.includes(c.chunkId)).map(c=>c.acquisition?.endedAt||c.capturedAt).filter(Boolean).sort().at(-1)||null;
  const refs=Object.fromEntries(SIDES.map(s=>[s,Lab.referenceFor(r,s,r.beforeEstablished.rails[s],through)]));
  prepared.push({capture,science,refs});
 }
 function replay(pred){const anchors=[],rows=[];
  for(const x of prepared){const d=L.decideCut({capture:x.capture,science:x.science,anchors,Shadow});
   const {decision,feature,removed}=ruled(x.capture,x.science,d,pred);
   if(decision.anchor)anchors.push({identity:x.capture.identity,positions:decision.positions});
   const judged=SIDES.every(s=>x.refs[s].status==='candidate');let worst=null;
   if(decision.positions&&judged)worst=Math.max(...SIDES.flatMap(s=>{const a=local(x.capture.rails[s],decision.positions[s]),b=local(x.capture.rails[s],x.refs[s].finalRail.positionSceneRelative);return [Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1])].map(v=>v*1000);}));
   rows.push({cut:x.capture.identity.cut,stage:decision.stage,feature:d.stage==='first-pass'?feature:null,removed,applied:!!decision.positions,judged:!!decision.positions&&judged,wrong:worst!=null?worst>10:null,worstMm:round(worst)});
  }return rows;}
 return compare(label,'natif',replay);
}
function pilote(input,label,relecture){
 const lot=A.loadLot(input,label,relecture||null);
 function replay(pred){const observations=new Map(),deps={L:{...L,decideCut:args=>{
  const d=L.decideCut(args),result=ruled(args.capture,args.science,d,pred),cut=args.capture.identity.cut;
  observations.set(cut,{feature:d.stage==='first-pass'?result.feature:null,removed:result.removed});return result.decision;}}};
  const report=A.report([lot],{replay:true,preferReplay:true,replayDeps:deps,currentRules:true});
  return report.lots[0].rows.filter(x=>!x.excluded).map(x=>({cut:x.cut,stage:x.lot?.stage??null,
   feature:observations.get(x.cut)?.feature??null,removed:observations.get(x.cut)?.removed??false,
   applied:!!x.lot?.wouldApply,judged:!!x.lot?.errors,wrong:x.lot?.errors?!!x.lot.wrong:null,worstMm:x.lot?.worstMm??null}));
 }
 return compare(label,'pilote',replay);
}
function compare(label,kind,replay){
 const base=replay(()=>false),baseBy=new Map(base.map(r=>[r.cut,r]));
 const variants={};for(const [name,pred] of Object.entries(RULES)){
  const rows=replay(pred),direct=[],ricochet=[],gained=[];
  for(const r of rows){const b=baseBy.get(r.cut);if(!b)throw Error('cut absent de la base : '+label+'/'+r.cut);
   if(r.removed)direct.push({cut:r.cut,wrong:b.wrong,judged:b.judged,feature:b.feature});
   else if(r.applied!==b.applied||r.stage!==b.stage||r.wrong!==b.wrong||r.worstMm!==b.worstMm){
    const detail={cut:r.cut,before:{stage:b.stage,applied:b.applied,wrong:b.wrong,worstMm:b.worstMm},after:{stage:r.stage,applied:r.applied,wrong:r.wrong,worstMm:r.worstMm}};
    (r.applied&&!b.applied?gained:ricochet).push(detail);
   }
  }
  variants[name]={applied:rows.filter(r=>r.applied).length,wrong:rows.filter(r=>r.wrong).length,
   stoppedWrong:direct.filter(r=>r.wrong).map(r=>r.cut),lostRight:direct.filter(r=>r.judged&&!r.wrong).map(r=>r.cut),
   removedUnjudged:direct.filter(r=>!r.judged).map(r=>r.cut),direct,ricochet,gained,
   newWrong:rows.filter(r=>r.wrong&&!baseBy.get(r.cut).wrong).map(r=>r.cut)};
 }
 return {label,kind,base:{applied:base.filter(r=>r.applied).length,judged:base.filter(r=>r.judged).length,
  wrong:base.filter(r=>r.wrong).map(r=>r.cut),firstPass:base.filter(r=>r.stage==='first-pass')},variants};
}
function run(argv=process.argv.slice(2)){
 const out=argv[0];if(!out||out.startsWith('--'))throw Error('SORTIE.json requis');const sessions=[];
 for(let i=1;i<argv.length;i++){const type=argv[i],arg=argv[++i],eq=arg.indexOf('=');if(eq<0)throw Error('libellé requis : '+arg);
  const p=arg.slice(0,eq),[label,rel]=arg.slice(eq+1).split('@'),t=Date.now();
  sessions.push(type==='--natif'?natif(p,label):type==='--lot'?pilote(p,label,rel):(()=>{throw Error(type);})());
  console.log(label,Math.round((Date.now()-t)/1000)+' s',sessions.at(-1).base.applied,'décidés');}
 const result={format:'banane-first-pass-signal-study-v1',rules:Object.keys(RULES),excluded:[...EXCLUDED],sessions};
 fs.writeFileSync(out,JSON.stringify(result,null,1)+'\n');return result;
}
if(require.main===module)try{run();}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={RULES,features,ruled,compare,run};
