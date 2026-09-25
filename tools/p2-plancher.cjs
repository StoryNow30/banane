#!/usr/bin/env node
'use strict';
/*
 * p2-plancher.cjs — P2, le plancher de reproductibilité humaine (cahier §15,
 * chantier C2 ; KI-038). Sans lui, aucun chiffre d'erreur (C2) n'est publié.
 *
 *   node tools/p2-plancher.cjs SESSION|DOSSIER [--eloignement 50] [--json P2.json] [--md P2.md]
 *
 * PROTOCOLE (LIRE_EN_PREMIER, F2). En Natif, l'opérateur revient sur des cuts
 * qu'il a déjà validés, quelques jours après : il ÉLOIGNE les deux rails (au
 * moins 5 cm) pour ne pas partir de sa pose, les replace, puis valide.
 *
 * MESURE. Pour chaque visite : la pose de départ est la première pose humaine
 * (le cut était validé), la pose finale est la repose, lue avec les règles
 * strictes du banc (`referenceFor` : une seule intention VALIDATE, état frais,
 * même identité). L'écart est pris dans le repère du rail de départ : latéral
 * et vertical, en mm (unités de scène × 1000, non étalonnées indépendamment).
 * Même session, même repère : aucune translation à estimer.
 *
 * AVEUGLE. Un rail ne compte que si un état observé pendant la visite l'a
 * éloigné d'au moins `--eloignement` mm (latéral ou vertical) de sa pose de
 * départ : sinon l'opérateur a pu retoucher sans repartir de zéro. Les visites
 * écartées sont listées avec leur raison.
 *
 * Sortie : le format lu par `tools/acceptance-report.cjs --p2` (médiane et p90
 * des écarts absolus, par axe, sur les rails retenus).
 */
const fs=require('node:fs'),path=require('node:path');
const Lab=require('./placement-lab.cjs'),Segments=require('./merge-segments.cjs'),C=require('../vendor/capture-core.js');
const SIDES=['left','right'];
const r2=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
/* Écart d'une pose à la pose de départ, dans le repère du rail de départ (mm). */
function localMm(initial,position){const M=initial.sceneRelativeToProfileLocal,o=C.point(M,initial.positionSceneRelative),q=C.point(M,position);
  return {lateral:(q[1]-o[1])*1000,vertical:(q[2]-o[2])*1000};}
function distribution(values){const t=values.map(Math.abs).sort((a,b)=>a-b);if(!t.length)return {count:0,median:null,p90:null,maximum:null};
  const q=f=>{const p=f*(t.length-1),a=Math.floor(p),b=Math.ceil(p);return t[a]+(t[b]-t[a])*(p-a);};
  return {count:t.length,median:r2(q(.5)),p90:r2(q(.9)),maximum:r2(t.at(-1))};}
function mesurer(session,{eloignementMm=50}={}){
  const byVisit=new Map();
  for(const e of session.events||[])if(e.type==='native-state-observed'&&e.visitId&&e.state?.rails){
    if(!byVisit.has(e.visitId))byVisit.set(e.visitId,[]);byVisit.get(e.visitId).push(e.state);}
  const rows=[],exclus=[];
  for(const record of (session.records||[]).slice().sort((a,b)=>(a.visitIndex??0)-(b.visitIndex??0))){
    const cut=record.identity?.cut,before=record.beforeEstablished;
    if(!before?.rails){exclus.push({cut,raison:'pose de départ absente'});continue;}
    for(const side of SIDES){const initial=before.rails[side];
      if(!initial?.sceneRelativeToProfileLocal){exclus.push({cut,side,raison:'pose de départ absente'});continue;}
      const ref=Lab.referenceFor(record,side,initial,before.capturedAt);
      if(ref.status!=='candidate'){exclus.push({cut,side,raison:ref.reason});continue;}
      const loin=Math.max(0,...(byVisit.get(record.visitId)||[]).filter(s=>s.rails?.[side]?.positionSceneRelative)
        .map(s=>{const d=localMm(initial,s.rails[side].positionSceneRelative);return Math.max(Math.abs(d.lateral),Math.abs(d.vertical));}));
      if(loin<eloignementMm){exclus.push({cut,side,raison:`rail éloigné de ${r2(loin)} mm seulement (seuil ${eloignementMm})`});continue;}
      rows.push({cut,side,lateralMm:r2(ref.deltaLocal[1]*1000),verticalMm:r2(ref.deltaLocal[2]*1000),eloignementMm:r2(loin)});}
  }
  return {format:'banane-p2-v1',label:'P2 (un opérateur)',operators:1,unites:'unités de scène × 1000 (mm), non étalonnées indépendamment',
    protocole:`rails éloignés d'au moins ${eloignementMm} mm puis replacés et validés ; référence stricte referenceFor`,
    cuts:new Set(rows.map(r=>r.cut)).size,rails:rows.length,lateralMm:distribution(rows.map(r=>r.lateralMm)),verticalMm:distribution(rows.map(r=>r.verticalMm)),rows,exclus};
}
function toMarkdown(r){const d=x=>x.count?`${x.median} / ${x.p90} (max ${x.maximum})`:'—';
  return [`# P2 — plancher humain`,'',`${r.cuts} cuts, ${r.rails} rails retenus ; ${r.exclus.length} rails écartés.`,'',
    '| Axe | Médiane / p90 des écarts absolus (mm) |','|---|---|',`| Latéral | ${d(r.lateralMm)} |`,`| Vertical | ${d(r.verticalMm)} |`,'',
    `Protocole : ${r.protocole}. ${r.unites}.`,'',...(r.exclus.length?['## Écartés','',...r.exclus.map(x=>`- ${x.cut}${x.side?' '+x.side:''} : ${x.raison}`)]:[])].join('\n')+'\n';}
function run(argv=process.argv.slice(2)){
  let input=null,eloignementMm=50,json=null,md=null;
  for(let i=0;i<argv.length;i++){if(argv[i]==='--eloignement')eloignementMm=Number(argv[++i]);else if(argv[i]==='--json')json=argv[++i];
    else if(argv[i]==='--md')md=argv[++i];else input=argv[i];}
  if(!input)throw Error('Usage : node tools/p2-plancher.cjs SESSION|DOSSIER [--eloignement 50] [--json P2.json] [--md P2.md]');
  const r=mesurer(Segments.loadSession(input),{eloignementMm});
  console.log(`P2 : ${r.cuts} cuts, ${r.rails} rails · latéral ${r.lateralMm.median} / ${r.lateralMm.p90} mm · vertical ${r.verticalMm.median} / ${r.verticalMm.p90} mm · ${r.exclus.length} rails écartés`);
  if(json)fs.writeFileSync(json,JSON.stringify(r,null,1)+'\n');if(md)fs.writeFileSync(md,toMarkdown(r));
  return r;
}
if(require.main===module)try{run();}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={mesurer,distribution,localMm,toMarkdown,run};
