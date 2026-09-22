#!/usr/bin/env node
'use strict';
/*
 * brain-audit.cjs — audit du cerveau de placement, une ligne par rail et par cut.
 *
 *   node tools/brain-audit.cjs --input SESSION.json[=libellé] [--input ...] [--json SORTIE]
 *                              [--convention on|off] [--partial-flank on|off]
 *
 * Doctrine (cahier 4.8, amendement n°1) : mesurer où le moteur échoue avant
 * d'introduire quoi que ce soit. Cet outil rejoue le moteur Pilote tel qu'il est
 * livré (GCV1 runtime, flanc partiel compris) sur l'entrée du banc — lecture
 * complète de la pose de départ — et range chaque cut dans une seule classe :
 *
 *   entrée absente · abstention d'un rail (motif) · paire refusée par
 *   l'écartement · appliqué juste · appliqué faux · appliqué sans référence.
 *
 * Pour chaque rail, il mesure aussi ce qu'aucun compteur ne dit :
 *  - la distance de la vérité humaine à la pose ESV de départ ;
 *  - si la vérité est dans la fenêtre explorée par A_STAR (centres + ±80 mm) ;
 *  - le minimum local de la grille le plus proche de la vérité, et son rang :
 *    « la bonne réponse est-elle calculée puis jetée, ou jamais calculée ? » ;
 *  - l'erreur signée, dans le repère du profil (u vers le champignon), pour
 *    séparer un biais de profil (mêmes signes en u) d'un décalage commun.
 *
 * AUCUNE référence humaine n'entre dans l'entrée moteur : elle n'est lue
 * qu'après le calcul, pour juger. Unités de scène × 1000 (non calibrées).
 */
const fs=require('node:fs'),path=require('node:path');
const Lab=require('./placement-lab.cjs'),PS=require('./pair-search.cjs');
const Shadow=require('../src/gcv1-shadow.js'),Candidate=require('../src/geometry-candidate-v1.js');
const Gauge=require('../src/gauge.js'),C=require('../vendor/capture-core.js');
const SIDES=['left','right'],WRONG_MM=10;
const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
const mm=v=>Number.isFinite(v)?v*1000:null;

/* Grille d'A_STAR telle que le Pilote l'explore : mêmes centres de fenêtre. */
function gridOf(capture,side,uSeed){
  let grid=null,meta=null;
  Candidate.propose(capture,side,{lab:{uSeeds:[uSeed],replaceOrigin:false,recenterWindow:true,partialFaceKeep:true,
    onCoarse(cells,info){grid=cells;meta=info;}}});
  return {grid,uCenters:meta?.uCenters||[0]};
}
function nearestMinimum(minima,truthU,truthZ){
  let best=null;
  minima.forEach((m,rank)=>{const d=Math.hypot(m.u-truthU,m.z-truthZ);if(!best||d<best.distance)best={distance:d,rank,lossRatio:m.loss/minima[0].loss,u:m.u,z:m.z};});
  return best;
}

function analyseRecord(record,clouds,observations){
  const identity=record.identity||{},prepared=Lab.prepareVisit(record,clouds,observations);
  const capture=prepared.pair?.status==='ready'?prepared.pair.capture:null;
  const cut={part:identity.part,cut:identity.cut,visitId:record.visitId,pairReady:!!capture,rails:{}};
  let science=null,elapsed=null;
  if(capture){const t0=process.hrtime.bigint();science=Shadow.scientificProposeBoth(capture);elapsed=Number(process.hrtime.bigint()-t0)/1e6;}
  cut.engineMs=r1(elapsed);
  const humanDeltas={};
  for(const side of SIDES){
    const input=prepared.rails[side],row={side,inputReady:input?.status==='ready',points:input?.points??null};
    cut.rails[side]=row;
    if(!row.inputReady){row.inputReasons=input?.reasons||[];continue;}
    // Jugement : la référence humaine n'est lue qu'ici, après le calcul moteur.
    const reference=Lab.referenceFor(record,side,input.initialRail,input.snapshotAcquiredThroughAt);
    row.referenced=reference.status==='candidate';row.referenceReason=reference.status==='candidate'?null:reference.reason;
    if(row.referenced){humanDeltas[side]=reference.deltaLocal;row.humanLateralMm=r1(mm(reference.deltaLocal[1]));row.humanVerticalMm=r1(mm(reference.deltaLocal[2]));}
    if(!science)continue;
    const rail=science.rails[side];
    if(!rail?.ok){row.status='frame-failed';row.motif='frame';row.reason=rail?.reason||rail?.error||null;continue;}
    const next=rail.next,sign=rail.frame.sign;
    row.status=next.status;row.motif=next.status==='candidate'?'candidate':next.motif;
    row.topRows=rail.astar.topRows;row.faceCount=rail.astar.faceCount;row.partialFlankUsed=!!rail.partialFlankUsed;
    row.s1Changed=!!rail.s1Changed;row.sign=sign;row.pointsLocal=rail.frame.pointsLocal;
    const published=next.status==='candidate'?next.delta:null;
    const beforeGate=rail.pairGauge?.rejected?rail.pairGauge.publishedBeforeGate?.delta:null;
    row.publishedLateralMm=published?r1(mm(published[1])):null;
    if(row.referenced){
      const h=reference.deltaLocal,err=d=>d?{lat:mm(d[1]-h[1]),vert:mm(d[2]-h[2])}:null;
      const e=err(published),g=err(beforeGate);
      if(e){row.lateralErrorMm=r1(e.lat);row.verticalErrorMm=r1(e.vert);row.uErrorMm=r1(sign*e.lat);}
      // Calage de convention actif : l'erreur du placement scientifique brut reste mesurée.
      const raw=published&&next.rawDelta?err(next.rawDelta):null;
      if(raw){row.rawLateralErrorMm=r1(raw.lat);row.rawVerticalErrorMm=r1(raw.vert);}
      if(rail.conventionCalibration)row.convention={applied:rail.conventionCalibration.applied,reason:rail.conventionCalibration.reason??null,
        duMm:r1(rail.conventionCalibration.duMm),dzMm:r1(rail.conventionCalibration.dzMm),faceMode:rail.conventionCalibration.faceMode??null};
      if(g){row.beforeGateLateralErrorMm=r1(g.lat);}
      // Génération : la vérité est-elle dans la fenêtre, et un minimum local tombe-t-il dessus ?
      const truthU=sign*h[1],truthZ=h[2];
      const {grid,uCenters}=gridOf(capture,side,rail.frame.uSeed);
      row.windowCentersMm=uCenters.map(u=>r1(mm(u)));
      row.truthInWindow=uCenters.some(c=>Math.abs(truthU-c)<=Candidate.DEFAULTS.searchY+1e-9)&&Math.abs(truthZ)<=Candidate.DEFAULTS.searchZ+1e-9;
      if(grid?.length){const minima=PS.localMinima(grid,Candidate.DEFAULTS.alternativeSeparation);const near=nearestMinimum(minima,truthU,truthZ);
        row.localMinima=minima.length;row.nearestMinimumMm=r1(mm(near?.distance));row.nearestMinimumRank=near?.rank??null;row.nearestMinimumLossRatio=near?Math.round(near.lossRatio*100)/100:null;}
    }
  }
  if(science){
    const applicable=SIDES.every(side=>cut.rails[side].status==='candidate');
    cut.applicable=applicable;cut.gaugeRejected=!!science.summary.pairGaugeRejected;
    cut.gaugeMm=r1(science.pairGauge?.predictedMm);
    cut.initialGaugeMm=r1(Gauge.gaugeMmOf(capture.rails,C));
    if(SIDES.every(side=>humanDeltas[side]))cut.humanGaugeMm=r1(Gauge.predictedGaugeMm(capture.rails,humanDeltas,C));
    const referenced=SIDES.every(side=>cut.rails[side].referenced);
    const worst=applicable&&referenced?Math.max(...SIDES.map(side=>Math.abs(cut.rails[side].lateralErrorMm))):null;
    cut.worstLateralMm=r1(worst);
    cut.outcome=applicable?(referenced?(worst>WRONG_MM?'applied-wrong':'applied-right'):'applied-unreferenced')
      :cut.gaugeRejected?'gauge-rejected':'rail-abstained';
    if(cut.gaugeRejected&&referenced)cut.gaugeRejectedWrongSides=SIDES.filter(side=>Math.abs(cut.rails[side].beforeGateLateralErrorMm??0)>WRONG_MM);
    if(!applicable&&!cut.gaugeRejected)cut.abstentionMotifs=SIDES.map(side=>cut.rails[side].motif).filter(m=>m&&m!=='candidate');
  }else cut.outcome='no-input';
  return cut;
}

function analyseSession(session,label){
  const clouds=new Map((session.clouds||[]).map(c=>[c.chunkId||c.captureId,c]));
  const byVisit=new Map();
  for(const e of session.events||[])if(e.visitId&&['native-visit-started','native-state-observed'].includes(e.type)){
    const rows=byVisit.get(e.visitId)||[];rows.push({type:e.type,eventSeq:e.eventSeq,state:e.type==='native-visit-started'?e.initialObserved:e.state});byVisit.set(e.visitId,rows);}
  for(const rows of byVisit.values())rows.sort((a,b)=>a.eventSeq-b.eventSeq);
  const cuts=[];
  for(const record of session.records||[]){
    try{cuts.push({session:label,...analyseRecord(record,clouds,byVisit.get(record.visitId)||[])});}
    catch(e){cuts.push({session:label,part:record.identity?.part,cut:record.identity?.cut,outcome:'error',error:e.message});}
  }
  return cuts;
}

const quantile=(values,p)=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return v.length?v[Math.min(v.length-1,Math.floor(p*v.length))]:null;};
function summarise(cuts){
  const count=key=>cuts.filter(c=>c.outcome===key).length,rails=cuts.flatMap(c=>Object.values(c.rails||{}));
  const motifs={};for(const c of cuts)for(const m of c.abstentionMotifs||[])motifs[m]=(motifs[m]||0)+1;
  const judged=rails.filter(r=>Number.isFinite(r.lateralErrorMm));
  const bySide=Object.fromEntries(SIDES.map(side=>{const v=judged.filter(r=>r.side===side);
    return [side,{n:v.length,lateralMedianMm:r1(quantile(v.map(r=>r.lateralErrorMm),.5)),uMedianMm:r1(quantile(v.map(r=>r.uErrorMm),.5)),
      verticalMedianMm:r1(quantile(v.map(r=>r.verticalErrorMm),.5))}];}));
  const refRails=rails.filter(r=>r.referenced&&Number.isFinite(r.humanLateralMm));
  const gen=rails.filter(r=>r.referenced&&r.status!=='candidate'&&Number.isFinite(r.nearestMinimumMm));
  return {cuts:cuts.length,noInput:count('no-input'),appliedRight:count('applied-right'),appliedWrong:count('applied-wrong'),
    appliedUnreferenced:count('applied-unreferenced'),gaugeRejected:count('gauge-rejected'),railAbstained:count('rail-abstained'),errors:count('error'),
    abstentionMotifs:motifs,
    railsJudged:judged.length,railsWrong:judged.filter(r=>Math.abs(r.lateralErrorMm)>WRONG_MM).length,
    lateralAbsMedianMm:r1(quantile(judged.map(r=>Math.abs(r.lateralErrorMm)),.5)),lateralAbsP90Mm:r1(quantile(judged.map(r=>Math.abs(r.lateralErrorMm)),.9)),
    verticalAbsMedianMm:r1(quantile(judged.map(r=>Math.abs(r.verticalErrorMm)),.5)),bySide,
    humanCorrection:{rails:refRails.length,medianMm:r1(quantile(refRails.map(r=>Math.abs(r.humanLateralMm)),.5)),
      over40Mm:refRails.filter(r=>Math.abs(r.humanLateralMm)>40).length,over80Mm:refRails.filter(r=>Math.abs(r.humanLateralMm)>80).length,
      truthOutsideWindow:refRails.filter(r=>r.truthInWindow===false).length},
    unresolvedReferenced:{rails:gen.length,minimumWithin5Mm:gen.filter(r=>r.nearestMinimumMm<=5).length,
      minimumWithin10Mm:gen.filter(r=>r.nearestMinimumMm<=10).length,truthOutsideWindow:gen.filter(r=>r.truthInWindow===false).length},
    engineMsMedian:r1(quantile(cuts.map(c=>c.engineMs),.5)),engineMsP90:r1(quantile(cuts.map(c=>c.engineMs),.9))};
}

function run(argv=process.argv.slice(2)){
  const inputs=[];let out=null;
  for(let i=0;i<argv.length;i++){if(argv[i]==='--input'){const [file,label]=argv[++i].split('=');inputs.push({file,label:label||path.basename(file)});}
    else if(argv[i]==='--json')out=argv[++i];
    // Réglages du moteur mesuré ; par défaut, ceux du Pilote livré.
    else if(argv[i]==='--convention'||argv[i]==='--partial-flank'){const v=argv[++i];if(!['on','off'].includes(v))throw Error(argv[i-1]+' on|off');
      Shadow.configure(argv[i-1]==='--convention'?{convention:v==='on'}:{partialFlank:v==='on'});}
    else throw Error('Argument inconnu : '+argv[i]);}
  if(!inputs.length){console.error('Usage : --input SESSION.json[=libellé] [--input ...] [--json SORTIE]');process.exit(1);}
  const sessions=[];
  for(const {file,label} of inputs){
    const session=JSON.parse(fs.readFileSync(file,'utf8')),cuts=analyseSession(session,label),summary=summarise(cuts);
    sessions.push({label,version:session.version||null,summary,cuts});
    console.log(`${label} (${session.version}) : ${summary.cuts} cuts · justes ${summary.appliedRight} · faux ${summary.appliedWrong} · sans réf ${summary.appliedUnreferenced} · écartement ${summary.gaugeRejected} · abstention ${summary.railAbstained} ${JSON.stringify(summary.abstentionMotifs)} · sans entrée ${summary.noInput}`);
  }
  const all=sessions.flatMap(s=>s.cuts);
  const report={format:'banane-brain-audit-v1',engine:{partialFlank:Shadow.state().partialFlank,convention:Shadow.state().convention?Shadow.state().conventionVersion:false,contract:Shadow.CONTRACT.id},wrongMm:WRONG_MM,
    total:summarise(all),sessions};
  if(out)fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
  return report;
}
if(require.main===module)run();
module.exports={analyseRecord,analyseSession,summarise,run};
