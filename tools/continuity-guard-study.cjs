#!/usr/bin/env node
'use strict';
/*
 * continuity-guard-study.cjs — une garde de continuité de position aurait-elle
 * arrêté les cuts appliqués faux ?
 *
 *   node tools/continuity-guard-study.cjs SESSION.json|DOSSIER AUDIT.json LIBELLÉ SORTIE.json
 *
 * ÉTUDE HORS LIGNE, sans effet sur l'extension (cahier 4.8, amendement n°6).
 * Entrée : une session et le relevé de tools/brain-audit.cjs sur cette session.
 * Les cuts appliquables sont rejoués dans l'ordre du Pilote ; chaque rail est
 * prédit par les cuts précédents ACCEPTÉS dans une fenêtre de 6 cuts (au moins
 * 2), en ligne droite dans le repère profil du cut. Un écart supérieur au seuil T
 * diffère le cut, qui ne sert pas d'ancre. Seuils testés : 15, 20, 30, 50 mm.
 * Rapporté : cuts faux arrêtés, cuts justes perdus. Aucune cible d'écartement.
 */
const Seg=require('./merge-segments.cjs'),K=require('../src/core.js'),C=require('../vendor/capture-core.js');
const [sessDir,auditF,label,outF]=process.argv.slice(2);
const audit=require(auditF).sessions.find(s=>s.label===label);
const session=Seg.loadSession(sessDir);
const recByVisit=new Map(session.records.map(r=>[r.visitId,r]));
const SIDES=['left','right'];
// Cuts appliquables : position monde des rails publiés (latéral calé ; vertical sans effet ici).
const items=[];
for(const c of audit.cuts){
  if(!['applied-right','applied-wrong','applied-unreferenced'].includes(c.outcome))continue;
  const rec=recByVisit.get(c.visitId);if(!rec?.beforeEstablished?.rails)continue;
  const init=rec.beforeEstablished;
  const deltas=Object.fromEntries(SIDES.map(s=>[s,{delta:[0,c.rails[s].publishedLateralMm/1000,0]}]));
  const poses=K.expectedPoses(init,deltas);
  items.push({cut:c.cut,outcome:c.outcome,worst:c.worstLateralMm,init,world:Object.fromEntries(SIDES.map(s=>[s,poses[s].positionSceneRelative])),
    lateral:Object.fromEntries(SIDES.map(s=>[s,c.rails[s].publishedLateralMm]))});
}
items.sort((a,b)=>a.cut-b.cut);
function fitAt(points){ // moindres carrés latéral = a + b·longitudinal, évalué en 0
  if(points.length===1)return points[0][1];
  let sx=0,sy=0,sxx=0,sxy=0;for(const [x,y] of points){sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;}
  const n=points.length,d=n*sxx-sx*sx,b=Math.abs(d)>1e-12?(n*sxy-sx*sy)/d:0;return (sy-b*sx)/n;
}
function simulate(T,window=6,minAnchors=2){
  const anchors=[],rows=[];
  for(const it of items){
    const prev=anchors.filter(a=>a.cut<it.cut&&it.cut-a.cut<=window);
    let dev=null;
    if(prev.length>=minAnchors){
      dev=Math.max(...SIDES.map(s=>{
        const M=it.init.rails[s].sceneRelativeToProfileLocal,o=C.point(M,it.init.rails[s].positionSceneRelative);
        const pts=prev.map(a=>{const q=C.point(M,a.world[s]);return [q[0]-o[0],(q[1]-o[1])*1000];});
        const q=C.point(M,it.world[s]);const engine=(q[1]-o[1])*1000;
        return Math.abs(engine-fitAt(pts));
      }));
    }
    const flagged=dev!==null&&dev>T;
    if(!flagged)anchors.push(it);
    rows.push({cut:it.cut,outcome:it.outcome,worst:it.worst,devMm:dev===null?null:Math.round(dev*10)/10,flagged,anchors:prev.length});
  }
  return rows;
}
const report={label,window:6,thresholds:{}};
for(const T of [15,20,30,50]){
  const rows=simulate(T);const k=o=>rows.filter(r=>r.outcome===o);
  const s={applicable:rows.length,noAnchor:rows.filter(r=>r.devMm===null).length,
    wrong:k('applied-wrong').length,wrongStopped:k('applied-wrong').filter(r=>r.flagged).length,
    right:k('applied-right').length,rightStopped:k('applied-right').filter(r=>r.flagged).length,
    unref:k('applied-unreferenced').length,unrefStopped:k('applied-unreferenced').filter(r=>r.flagged).length};
  report.thresholds[T]={...s,rows};
  console.log(`${label} T=${T} mm : appliquables ${s.applicable} (sans ancre ${s.noAnchor}) · faux arrêtés ${s.wrongStopped}/${s.wrong} · justes perdus ${s.rightStopped}/${s.right} · sans réf. arrêtés ${s.unrefStopped}/${s.unref}`);
}
const r30=report.thresholds[30].rows;
for(const r of r30.filter(r=>r.outcome==='applied-wrong'||r.flagged))console.log(`   cut ${r.cut} ${r.outcome} pire ${r.worst} écart ${r.devMm} ancres ${r.anchors} ${r.flagged?'ARRÊTÉ':'passe'}`);
require('fs').writeFileSync(outF,JSON.stringify(report,null,1));
