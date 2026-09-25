#!/usr/bin/env node
'use strict';
/*
 * passage-niveau-scan.cjs — repérer les passages à niveau et y lire le rail par
 * son ornière (étude hors ligne, 25/09 ; premier lot 4.7.18, partie 2).
 *
 *   node tools/passage-niveau-scan.cjs SORTIE.json --lot DOSSIER=libellé [...] --natif SESSION=libellé [...]
 *
 * Deux mesures par cut, sur la capture que lit le moteur, rien d'autre :
 *   - `flushPct` : part des points situés à côté des rails (9 à 45 cm du rail,
 *     ±60 cm le long de la voie) qui sont au niveau du champignon (moins de
 *     5 cm sous la pose de départ). Voie courante : 0 à 10 % (ballast et
 *     traverses 13 à 20 cm plus bas). Passage à niveau : la chaussée affleure,
 *     près de 100 %.
 *   - `edgeMm` : pour chaque rail, bord de l'ornière côté rail, en mm depuis la
 *     pose de départ, positif vers l'intérieur de la voie (pas de 5 mm) : premier
 *     pas où la médiane des hauteurs descend 25 mm sous le dessus, sur trois pas
 *     de suite. La position d'un rail étant sa face intérieure, c'est l'endroit
 *     où la placer quand le flanc est noyé dans la chaussée.
 * Jugement, seulement après coup : pour un lot, écart de la pose appliquée au
 * bord de l'ornière ; pour une session Natif, écart de la pose humaine validée
 * (référence stricte `referenceFor`). Aucune position humaine n'entre dans les
 * mesures ; aucun écartement n'est une cible.
 */
const fs=require('node:fs'),path=require('node:path');
const C=require('../vendor/capture-core.js');
const SIDES=['left','right'];
const median=v=>{if(!v.length)return null;const s=v.slice().sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};

/* Repère d'un rail : origine à la pose de départ, latéral positif vers l'autre rail. */
function frameOf(capture,side){
  const r=capture.rails[side],M=r.sceneRelativeToProfileLocal,o=C.point(M,r.positionSceneRelative);
  const other=C.point(M,capture.rails[side==='left'?'right':'left'].positionSceneRelative),toward=Math.sign(other[1]-o[1])||1;
  return p=>{const q=C.point(M,p);return {along:q[0]-o[0],lat:(q[1]-o[1])*toward,z:q[2]-o[2]};};
}
function flushShare(capture){
  let flush=0,all=0;
  for(const side of SIDES){const at=frameOf(capture,side);
    for(const p of capture.pointsSceneRelative){const {along,lat,z}=at(p);
      if(Math.abs(along)>0.6||Math.abs(lat)<0.09||Math.abs(lat)>0.45||z<-0.45||z>0.15)continue;all++;if(z>-0.05)flush++;}}
  return {flushPct:all?Math.round(100*flush/all):null,sidePoints:all};
}
function flangewayEdge(capture,side,{binMm=5,dropMm=25,run=3}={}){
  const at=frameOf(capture,side),bins=new Map();
  for(const p of capture.pointsSceneRelative){const {along,lat,z}=at(p);const l=lat*1000,h=z*1000;
    if(Math.abs(along)>0.5||l<-120||l>150||h<-300||h>150)continue;const b=Math.floor(l/binMm);(bins.get(b)||bins.set(b,[]).get(b)).push(h);}
  const top=median([...bins.entries()].filter(([b])=>b*binMm>=-30&&b*binMm<0).flatMap(([,v])=>v));
  if(top==null)return {topMm:null,edgeMm:null};
  for(let b=Math.floor(-20/binMm);b*binMm<=120;b++){
    const m=Array.from({length:run},(_,k)=>median(bins.get(b+k)||[]));
    if(m.every(x=>x!=null&&x<top-dropMm))return {topMm:Math.round(top),edgeMm:b*binMm};}
  return {topMm:Math.round(top),edgeMm:null};
}
const lateralMm=(capture,side,point)=>Math.round(frameOf(capture,side)(point).lat*1000);
function describe(capture){
  const f=flushShare(capture),edges={};
  for(const side of SIDES)edges[side]=flangewayEdge(capture,side);
  return {...f,levelCrossing:f.flushPct!=null&&f.flushPct>=50,edges};
}

function scanLot(dir,label){
  const A=require('./acceptance-report.cjs'),lot=A.loadLot(dir,label),ctx=A.lotCuts(lot.diagnostic,lot.journal);
  const caps=new Map((lot.corpus?.clouds||[]).map(c=>[c.captureId,c])),rows=[];
  for(const cut of ctx.cuts){const o=cut.observations.at(-1),cap=caps.get(o?.lidar?.captureId);
    if(!cap?.rails?.left||!cap?.rails?.right||!Array.isArray(cap.pointsSceneRelative))continue;
    const d=describe(cap),row={source:label,kind:'pilote',cut:cut.cut,outcome:A.pilotOutcome(cut,ctx).outcome,stage:o.lotObservation?.stage??null,...d};
    for(const side of SIDES){const ap=o.runtime?.apply?.observed?.rails?.[side]?.positionSceneRelative;
      if(ap){const lat=lateralMm(cap,side,ap);row.edges[side].appliedMm=lat;row.edges[side].appliedMinusEdgeMm=d.edges[side].edgeMm==null?null:lat-d.edges[side].edgeMm;}}
    rows.push(row);}
  return rows;
}
function scanNatif(file,label){
  const Segments=require('./merge-segments.cjs'),Lab=require('./placement-lab.cjs'),O=require('../src/continuity-observer.js');
  const s=Segments.loadSession(file),records=(s.records||[]).slice().sort((a,b)=>a.visitIndex-b.visitIndex);
  const chunks=new Map();for(const c of s.clouds||[])if(c.pointsSceneRelative)(chunks.get(c.visitId)||chunks.set(c.visitId,[]).get(c.visitId)).push(c);
  const rows=[],seen=new Set();
  for(const record of records){const id=record.identity||{},key=id.part+'|'+id.cut;if(seen.has(key)||!record.beforeEstablished?.rails)continue;seen.add(key);
    const ch=chunks.get(record.visitId)||[],input=O.gatherInput(record,ch);
    if(!SIDES.every(x=>input.contours[x])||!input.points.length)continue;
    const cap={identity:id,rails:O.startRails(record,input,null).rails,pointsSceneRelative:input.points},d=describe(cap);
    const row={source:label,kind:'natif',cut:id.cut,...d};
    const through=ch.filter(c=>input.chunkIds.includes(c.chunkId)).map(c=>c.acquisition?.endedAt||c.capturedAt).filter(Boolean).sort().at(-1)||null;
    for(const side of SIDES){const ref=Lab.referenceFor(record,side,record.beforeEstablished.rails[side],through);
      if(ref.status==='candidate'){const lat=lateralMm(cap,side,ref.finalRail.positionSceneRelative);
        row.edges[side].humanMm=lat;row.edges[side].humanMinusEdgeMm=d.edges[side].edgeMm==null?null:lat-d.edges[side].edgeMm;}}
    rows.push(row);}
  return rows;
}
function summarize(rows){
  const pn=rows.filter(r=>r.levelCrossing),by=f=>pn.reduce((m,r)=>(m[f(r)]=(m[f(r)]||0)+1,m),{});
  const gaps=k=>pn.flatMap(r=>SIDES.map(s=>r.edges[s][k]).filter(Number.isFinite)).sort((a,b)=>a-b);
  const dist=v=>v.length?{n:v.length,median:median(v),absMedian:median(v.map(Math.abs)),absMax:Math.max(...v.map(Math.abs))}:null;
  return {cuts:rows.length,levelCrossingCuts:pn.length,bySource:by(r=>r.source),pilotOutcomes:by(r=>r.outcome??'natif'),
    edgeFound:pn.reduce((n,r)=>n+SIDES.filter(s=>r.edges[s].edgeMm!=null).length,0),
    appliedMinusEdge:dist(gaps('appliedMinusEdgeMm')),humanMinusEdge:dist(gaps('humanMinusEdgeMm'))};
}
function run(argv=process.argv.slice(2)){
  const out=argv[0];if(!out||out.startsWith('--'))throw Error('Usage : SORTIE.json --lot DOSSIER=libellé [...] --natif SESSION=libellé [...]');
  const rows=[];
  for(let i=1;i<argv.length;i++){const [f,l]=(argv[i+1]||'').split('=');
    if(argv[i]==='--lot'){rows.push(...scanLot(f,l||path.basename(f)));i++;}
    else if(argv[i]==='--natif'){rows.push(...scanNatif(f,l||path.basename(f)));i++;}
    else throw Error('Argument inconnu : '+argv[i]);}
  const result={format:'banane-passage-niveau-scan-v1',summary:summarize(rows),rows};
  fs.writeFileSync(out,JSON.stringify(result,null,1)+'\n');console.log(JSON.stringify(result.summary,null,1));
  return result;
}
if(require.main===module)try{run();}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={flushShare,flangewayEdge,describe,scanLot,scanNatif,summarize,run};
