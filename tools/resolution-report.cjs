#!/usr/bin/env node
'use strict';
/*
 * resolution-report.cjs — taux de résolution du moteur sur une session Natif.
 *
 *   node tools/resolution-report.cjs --input SESSION.json [--input ...] [--json SORTIE]
 *
 * Indicateur de référence de l'étape 1 (cahier 4.8, amendement n°1 §1.2) :
 * rails résolus par GCV1 / rails dont l'entrée est prête. Il est calculé pour les
 * deux entrées moteur — la lecture complète de la pose de départ (défaut 4.8) et
 * le premier instantané seul (historique) — afin que l'écart reste visible.
 *
 * Au niveau du cut, « appliquable » veut dire : deux rails candidats ET écartement
 * dans le contrat, c'est-à-dire ce que le Pilote appliquerait. L'erreur n'est
 * mesurée que contre une référence humaine validée ; sans elle, le cut est compté
 * mais pas jugé. Unités de scène × 1000, pas des millimètres calibrés.
 */
const fs=require('node:fs'),path=require('node:path');
const Lab=require('./placement-lab.cjs'),Legacy=require('./native-offline-evaluate.cjs');
const Shadow=require('../src/gcv1-shadow.js');
const SIDES=['left','right'];
const q=(values,p)=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return v.length?v[Math.min(v.length-1,Math.floor(p*v.length))]:null;};
const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;

function analyseSession(session,inputMode){
  const clouds=new Map((session.clouds||[]).map(c=>[c.chunkId||c.captureId,c]));
  const rails=[],cuts=[];
  for(const record of session.records||[]){
    let prepared;try{prepared=Lab.prepareVisit(record,clouds,session.events||[],{inputMode});}catch(e){continue;}
    const ready=SIDES.filter(side=>prepared.rails[side]?.status==='ready');if(!ready.length)continue;
    const capture=prepared.pair?.status==='ready'?prepared.pair.capture:null;const result={};
    for(const side of ready){
      let science;try{science=Shadow.scientificProposeBoth(capture||prepared.rails[side].capture);}catch(e){continue;}
      const rail=science.rails[side];if(!rail?.ok)continue;
      const reference=Lab.referenceFor(record,side,prepared.rails[side].initialRail,prepared.rails[side].snapshotAcquiredThroughAt);
      const human=reference.status==='candidate'?reference.deltaLocal:null,delta=rail.next.delta;
      const row={cut:record.identity?.cut,side,points:prepared.rails[side].points,face:rail.astar.faceCount,resolved:rail.next.status==='candidate',
        motif:rail.next.status==='candidate'?'candidate':rail.next.motif,referenced:!!human,
        lateralErrorMm:delta&&human?(delta[1]-human[1])*1000:null,verticalErrorMm:delta&&human?(delta[2]-human[2])*1000:null};
      rails.push(row);result[side]=row;
    }
    if(result.left&&result.right&&capture){
      const applicable=result.left.resolved&&result.right.resolved,referenced=result.left.referenced&&result.right.referenced;
      const worst=applicable&&referenced?Math.max(Math.abs(result.left.lateralErrorMm),Math.abs(result.right.lateralErrorMm)):null;
      cuts.push({cut:record.identity?.cut,applicable,referenced,worstLateralMm:worst});
    }
  }
  const resolved=rails.filter(r=>r.resolved),judged=resolved.filter(r=>r.referenced),applied=cuts.filter(c=>c.applicable),appliedJudged=applied.filter(c=>c.referenced);
  const motifs={};for(const r of rails)if(!r.resolved)motifs[r.motif]=(motifs[r.motif]||0)+1;
  return {inputMode,rails:rails.length,pointsMedian:q(rails.map(r=>r.points),.5),faceMedian:q(rails.map(r=>r.face),.5),
    faceAtLeast6:rails.filter(r=>r.face>=6).length,resolved:resolved.length,resolutionRate:rails.length?resolved.length/rails.length:null,abstentions:motifs,
    railsJudged:judged.length,lateralAbsMedianMm:r1(q(judged.map(r=>Math.abs(r.lateralErrorMm)),.5)),lateralAbsP90Mm:r1(q(judged.map(r=>Math.abs(r.lateralErrorMm)),.9)),
    railsWrongOver10Mm:judged.filter(r=>Math.abs(r.lateralErrorMm)>10).length,
    cutsWithBothRails:cuts.length,cutsApplicable:applied.length,cutsApplicableJudged:appliedJudged.length,
    cutsApplicableWrongOver10Mm:appliedJudged.filter(c=>c.worstLateralMm>10).length,worstApplicableLateralMm:r1(Math.max(0,...appliedJudged.map(c=>c.worstLateralMm)))};
}
function render(name,rows){
  const pct=v=>v===null?'—':Math.round(v*100)+' %';
  const lines=[`══ ${name}`];
  for(const r of rows){
    lines.push(`  ${r.inputMode==='initial-pose-read'?'lecture complète  ':'1er instantané    '} rails ${r.rails} · points méd ${r.pointsMedian} · flanc méd ${r.faceMedian} (≥6 : ${r.faceAtLeast6}) · résolus ${r.resolved} = ${pct(r.resolutionRate)}`);
    lines.push(`  ${' '.repeat(18)} cuts ${r.cutsWithBothRails} · appliquables ${r.cutsApplicable} · jugés ${r.cutsApplicableJudged} · faux >10 ${r.cutsApplicableWrongOver10Mm} · pire ${r.worstApplicableLateralMm ?? '—'} · abst. ${JSON.stringify(r.abstentions)}`);
  }
  return lines.join('\n');
}
function run(argv=process.argv.slice(2)){
  const inputs=[];let out=null;
  for(let i=0;i<argv.length;i++){if(argv[i]==='--input')inputs.push(argv[++i]);else if(argv[i]==='--json')out=argv[++i];
    /* Flanc partiel (amendement n°3) : actif par défaut dans le moteur ; `off`
     * mesure le comportement antérieur sur les mêmes données. */
    else if(argv[i]==='--partial-flank'){const v=argv[++i];if(!['on','off'].includes(v))throw Error('--partial-flank on|off');Shadow.configure({partialFlank:v==='on'});}
    else throw Error('Argument inconnu : '+argv[i]);}
  if(!inputs.length){console.error('Usage : --input SESSION.json [--input ...] [--json SORTIE] [--partial-flank on|off]');process.exit(1);}
  console.log(`flanc partiel : ${Shadow.state().partialFlank?'actif':'inactif'}`);
  const report={format:'banane-resolution-report-v1',partialFlank:Shadow.state().partialFlank,sessions:[]};
  for(const input of inputs){
    const session=JSON.parse(fs.readFileSync(input,'utf8'));
    const rows=Lab.INPUT_MODES.map(mode=>analyseSession(session,mode));
    report.sessions.push({input:path.basename(input),version:session.version||null,visits:(session.records||[]).length,rows});
    console.log(render(`${path.basename(input)} (${session.version||'?'}, ${(session.records||[]).length} visites)`,rows));
  }
  if(out)fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
  return report;
}
if(require.main===module)run();
module.exports={analyseSession,render,run};
