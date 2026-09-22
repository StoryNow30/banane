#!/usr/bin/env node
'use strict';
/*
 * continuity-study.cjs — continuité de voie : les cuts voisins guident le moteur.
 *
 *   node tools/continuity-study.cjs --input SESSION.json [--input ...] [--window 5] [--accept-mm 30]
 *                                   [--neighbours both|before] [--json SORTIE]
 *
 * ÉTUDE HORS LIGNE, sans effet sur l'extension (cahier 4.8, amendement n°3 §3.4).
 *
 * Question : dans les appareils de voie et contre-rails, le moteur pose un rail
 * sur une structure voisine (≈ 110 à 200 mm) et la garde d'écartement refuse la
 * paire. La position des rails aux cuts voisins — ceux que le moteur a lui-même
 * appliqués — prédit-elle où chercher ?
 *
 * Méthode, pour chaque cut refusé par l'écartement ou ambigu :
 *  1. voisins = cuts à ±`window` dont la paire est appliquable (deux rails
 *     candidats, écartement dans le contrat), exprimés en coordonnées du monde ;
 *  2. par rail, droite des moindres carrés dans le repère profil du cut → position
 *     latérale prédite ;
 *  3. le moteur gelé est relancé avec sa fenêtre recentrée sur cette prédiction
 *     (options de laboratoire existantes `uSeeds`/`recenterWindow`), flanc partiel
 *     actif ; résultat retenu s'il reste à ≤ `accept-mm` de la prédiction ;
 *  4. la paire obtenue passe la garde d'écartement, puis est jugée contre la
 *     référence humaine validée.
 *
 * Par défaut les voisins sont pris des deux côtés, comme lors d'un second passage
 * sur les cuts différés ; `--neighbours before` mesure le passage unique, où
 * seuls les cuts précédents existent.
 * Jamais de cible d'écartement : la continuité porte sur la position des rails.
 */
const fs=require('node:fs'),path=require('node:path');
const Lab=require('./placement-lab.cjs'),PS=require('./pair-search.cjs');
const Shadow=require('../src/gcv1-shadow.js'),K=require('../src/core.js'),C=require('../vendor/capture-core.js');
const Candidate=require('../src/geometry-candidate-v1.js'),Gauge=require('../src/gauge.js');
const SIDES=['left','right'];

function linearPrediction(points){
  let sx=0,sy=0,sxx=0,sxy=0;for(const [x,y] of points){sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;}
  const n=points.length,d=n*sxx-sx*sx,b=d?(n*sxy-sx*sy)/d:0;return (sy-b*sx)/n;
}
function study(session,{window=5,acceptMm=30,neighbours='both'}={}){
  if(!['both','before'].includes(neighbours))throw Error('neighbours : both|before');
  const clouds=new Map((session.clouds||[]).map(c=>[c.chunkId||c.captureId,c]));
  const visits=[],world=new Map();
  for(const record of session.records||[]){
    let prepared;try{prepared=Lab.prepareVisit(record,clouds,session.events||[]);}catch(e){continue;}
    if(prepared.pair?.status!=='ready')continue;
    const science=Shadow.scientificProposeBoth(prepared.pair.capture),initial=record.beforeEstablished;
    const references=Object.fromEntries(SIDES.map(side=>[side,Lab.referenceFor(record,side,prepared.rails[side].initialRail,prepared.rails[side].snapshotAcquiredThroughAt)]));
    visits.push({cut:record.identity?.cut,prepared,science,initial,references});
    if(SIDES.every(side=>science.rails[side].next.status==='candidate')){
      const poses=K.expectedPoses(initial,{left:{delta:science.rails.left.next.delta},right:{delta:science.rails.right.next.delta}});
      world.set(record.identity?.cut,{left:poses.left.positionSceneRelative,right:poses.right.positionSceneRelative});
    }
  }
  const rows=[];
  for(const v of visits){
    const hard=v.science.summary.pairGaugeRejected||SIDES.some(side=>v.science.rails[side].next.motif==='ambiguity');if(!hard)continue;
    const deltas={},reasons={};
    for(const side of SIDES){
      const M=v.initial.rails[side].sceneRelativeToProfileLocal,origin=C.point(M,v.initial.rails[side].positionSceneRelative);
      const points=[...world.entries()].filter(([cut])=>cut!==v.cut&&Math.abs(cut-v.cut)<=window&&(neighbours==='both'||cut<v.cut))
        .map(([,w])=>{const q=C.point(M,w[side]);return [q[0]-origin[0],q[1]-origin[1]];});
      if(points.length<2){reasons[side]='neighbours-insufficient';continue;}
      const predicted=linearPrediction(points),sign=PS.profileSign(v.prepared.pair.capture,side);
      const proposal=Candidate.propose(v.prepared.pair.capture,side,{lab:{uSeeds:[sign*predicted],recenterWindow:true,replaceOrigin:true,partialFaceKeep:true}});
      if(proposal.status!=='candidate'){reasons[side]='engine-abstained';continue;}
      if(Math.abs(proposal.delta[1]-predicted)*1000>acceptMm){reasons[side]='far-from-prediction';continue;}
      deltas[side]=proposal.delta;
    }
    const row={cut:v.cut,status:'abstained',reasons};
    if(deltas.left&&deltas.right){
      const gauge=Gauge.assessPair(v.prepared.pair.capture.rails,deltas,C);row.gaugeMm=Math.round(gauge.predictedMm*10)/10;
      if(!gauge.admissible)row.reasons={pair:'gauge-out-of-contract'};
      else{
        const errors=SIDES.map(side=>v.references[side].status==='candidate'?(deltas[side][1]-v.references[side].deltaLocal[1])*1000:null);
        if(errors.some(e=>e===null))row.status='published-unreferenced';
        else{row.status=errors.some(e=>Math.abs(e)>10)?'wrong':'right';row.lateralErrorsMm=errors.map(e=>Math.round(e*10)/10);}
      }
    }
    rows.push(row);
  }
  const count=status=>rows.filter(r=>r.status===status).length;
  return {hardCuts:rows.length,right:count('right'),wrong:count('wrong'),abstained:count('abstained'),unreferenced:count('published-unreferenced'),rows};
}
function run(argv=process.argv.slice(2)){
  const inputs=[],options={};let out=null;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--input')inputs.push(argv[++i]);else if(argv[i]==='--window')options.window=Number(argv[++i]);
    else if(argv[i]==='--accept-mm')options.acceptMm=Number(argv[++i]);else if(argv[i]==='--json')out=argv[++i];
    else if(argv[i]==='--neighbours')options.neighbours=argv[++i];
    else throw Error('Argument inconnu : '+argv[i]);
  }
  if(!inputs.length){console.error('Usage : --input SESSION.json [--input ...] [--window 5] [--accept-mm 30] [--neighbours both|before] [--json SORTIE]');process.exit(1);}
  const report=[];
  for(const input of inputs){
    const session=JSON.parse(fs.readFileSync(input,'utf8')),result=study(session,options);
    const parts=[...new Set((session.records||[]).map(r=>r.identity?.part).filter(v=>v!==undefined))];
    report.push({input:path.basename(input),version:session.version||null,parts,...result});
    console.log(`${path.basename(input)} : cuts difficiles ${result.hardCuts} · justes ${result.right} · faux ${result.wrong} · différés ${result.abstained} · sans référence ${result.unreferenced}`);
    for(const r of result.rows)console.log(`  cut ${r.cut} ${r.status}${r.lateralErrorsMm?' '+r.lateralErrorsMm.join('/')+' mm':''}${r.status==='abstained'?' '+JSON.stringify(r.reasons):''}`);
  }
  if(out)fs.writeFileSync(out,JSON.stringify({format:'banane-continuity-study-v1',window:options.window??5,acceptMm:options.acceptMm??30,neighbours:options.neighbours??'both',sessions:report},null,1)+'\n');
  return report;
}
if(require.main===module)run();
module.exports={study,linearPrediction,run};
