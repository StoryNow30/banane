#!/usr/bin/env node
'use strict';
/*
 * BANC D'ÉVALUATION DU PLACEMENT — Banane 4.8, §5.2 du cahier.
 *
 *   node tools/bench-placement.cjs --run gcv1=FICHIER [--run a0=FICHIER] [--json SORTIE]
 *   node tools/bench-placement.cjs --fixture            (rejoue le lot terrain du dépôt)
 *
 * UN SEUL BANC. Le cahier 4.8 exige que toute revendication chiffrée passe par
 * ici : sans cela, deux pistes menées en parallèle inventent chacune leur
 * métrique et deviennent incomparables. Il ne remplace pas `placement-lab.cjs`,
 * qui EXTRAIT les exemples d'une session Natif ; il est la couche de NOTATION
 * au-dessus, et réutilise son contrat d'adaptateur tel quel.
 *
 * CE QU'IL NOTE, et pourquoi ensemble :
 *
 *   C1 couverture      — cuts dont les DEUX rails sont publiés et dont la paire
 *                        est dans le contrat d'écartement. L'unité est le cut,
 *                        pas le rail : c'est ce que l'opérateur vit.
 *   C2 erreur          — distribution contre la correction humaine, médiane ET
 *                        queue haute. Une médiane qui s'améliore pendant que la
 *                        queue enfle est un échec, pas un progrès.
 *   C3 interceptions   — paires hors contrat effectivement refusées. Une
 *                        régression ici annule C1 quel qu'en soit le niveau.
 *   abstentions        — par cause, pour savoir CE QU'IL FAUT corriger.
 *
 * C1 N'EST JAMAIS RENDU SEUL. Le rendu refuse de l'afficher sans C3 et sans le
 * décompte des abstentions : « moins de différés » pris isolément se satisfait
 * en publiant n'importe quoi, et un chiffre de couverture seul est exactement
 * la façon dont on se ment.
 *
 * DÉTERMINISME. La carte de score ne contient aucun horodatage et aucune valeur
 * dépendant de l'exécution : mêmes entrées, mêmes octets en sortie. C'est le
 * test F du cahier, et c'est ce qui rend deux mesures comparables à un jour
 * d'intervalle.
 *
 * CE QU'IL NE FAIT PAS. Il ne décide rien, n'entraîne rien, ne modifie aucun
 * seuil. Il lit et il compte.
 */
const fs=require('node:fs'),path=require('node:path');
const K=require('../src/core.js'),Gauge=require('../src/gauge.js'),C=require('../vendor/capture-core.js');
const SIDES=['left','right'];
const round=(v,n=4)=>Number.isFinite(v)?Math.round(v*10**n)/10**n:null;

/* Distribution rendue en entier : la queue haute est un résultat, pas un
 * détail. Une médiane seule masque exactement les cas qui comptent. */
function distribution(values){
  const rows=values.filter(Number.isFinite).slice().sort((a,b)=>a-b);
  if(!rows.length)return {count:0,median:null,p90:null,max:null};
  const at=q=>rows[Math.min(rows.length-1,Math.floor(q*rows.length))];
  return {count:rows.length,median:round(at(.5)),p90:round(at(.9)),max:round(rows[rows.length-1])};
}

/* ---------------------------------------------------------------------------
 * ISSUE D'UN CUT — la seule classification que le banc produit.
 *
 * Elle suit le contrat de placement du §5.1 : un rail est publié ou abstenu, et
 * la paire est mesurée. L'ordre des tests n'est pas arbitraire — une abstention
 * précède la question de l'écartement, parce qu'un cut dont un rail est absent
 * n'a pas de paire à mesurer.
 * ------------------------------------------------------------------------- */
function outcome(cut){
  const abstained=SIDES.filter(side=>cut.statuses?.[side]!=='candidate'||!Array.isArray(cut.deltas?.[side]));
  const deltas=Object.fromEntries(SIDES.map(side=>[side,cut.deltas?.[side]]));
  /* L'écartement est TOUJOURS mesuré quand les deux deltas existent, même si le
   * cut a été appliqué : c'est ce qui permet de constater après coup qu'un
   * moteur a appliqué une paire qu'il n'aurait pas dû. */
  const gauge=abstained.length?null:Gauge.assessPair(cut.before,deltas,C);
  /* UN RUN PEUT DÉCLARER CE QU'IL A FAIT. `applied` dit ce que le moteur a
   * réellement commandé ; le banc mesure l'écartement de son côté et confronte
   * les deux. Sans ce champ, le banc classe lui-même selon le contrat 4.7 —
   * mais alors C3 ne peut rien constater d'autre que sa propre règle. C'est ce
   * qui distingue « le garde a refusé » de « le moteur a appliqué quand même ».*/
  if(typeof cut.applied==='boolean'){
    if(cut.applied)return {status:'treated',abstained:[],gauge,declared:true};
    return {status:abstained.length?'deferred-abstention'
      :!gauge?.measurable?'deferred-unmeasurable'
      :!gauge.admissible?'deferred-gauge':'deferred-other',abstained,gauge,declared:true};
  }
  if(abstained.length)return {status:'deferred-abstention',abstained,gauge:null,declared:false};
  /* Non mesurable n'est pas hors contrat : le moteur ne fabrique pas une
   * abstention depuis un champ absent, et le banc ne fabrique pas un refus
   * depuis une mesure qu'il n'a pas. */
  if(!gauge.measurable)return {status:'deferred-unmeasurable',abstained:[],gauge,declared:false};
  if(!gauge.admissible)return {status:'deferred-gauge',abstained:[],gauge,declared:false};
  return {status:'treated',abstained:[],gauge,declared:false};
}

/* Erreur d'un rail contre la correction humaine, quand elle existe. Les unités
 * sont des unités de scène : `physicalCalibrationStatus` n'atteste pas les
 * millimètres, et le banc ne prétend pas le contraire. */
function railError(cut,side){
  const proposed=cut.deltas?.[side],reference=cut.reference?.[side];
  if(!Array.isArray(proposed)||!Array.isArray(reference))return null;
  const d=proposed.map((v,i)=>v-reference[i]);
  return {longitudinal:d[0],lateral:d[1],vertical:d[2],euclidean:Math.hypot(...d)};
}

function scoreRun(run){
  const cuts=run.cuts.slice().sort((a,b)=>(a.part-b.part)||(a.cut-b.cut));
  const rows=cuts.map(cut=>{
    const out=outcome(cut);
    const errors=Object.fromEntries(SIDES.map(side=>[side,railError(cut,side)]));
    return {part:cut.part??null,cut:cut.cut,status:out.status,abstained:out.abstained,declared:out.declared,
      gaugeMm:round(out.gauge?.predictedMm,3),gaugeClass:out.gauge?.gaugeClass??null,errors};
  });
  const count=status=>rows.filter(r=>r.status===status).length;
  const treated=count('treated');
  /* Causes d'abstention, par rail : c'est ce qui dit OÙ porter l'effort. */
  const causes={};
  for(const cut of cuts)for(const side of SIDES){
    if(cut.statuses?.[side]==='candidate')continue;
    for(const reason of (cut.reasons?.[side]?.length?cut.reasons[side]:['cause non renseignée']))
      causes[reason]=(causes[reason]||0)+1;
  }
  const abstainedRails=Object.fromEntries(SIDES.map(side=>
    [side,cuts.filter(c=>c.statuses?.[side]!=='candidate').length]));
  const errorByRail=Object.fromEntries(SIDES.map(side=>[side,
    Object.fromEntries(['lateral','vertical','euclidean'].map(axis=>
      [axis,distribution(rows.map(r=>r.errors[side]&&Math.abs(r.errors[side][axis])))]))]));
  const references=rows.filter(r=>SIDES.some(s=>r.errors[s])).length;
  return {
    id:run.id,source:run.source??'unknown',contract:Gauge.CONTRACT.version,
    cuts:rows.length,
    C1:{treated,coverage:rows.length?round(treated/rows.length,4):null},
    deferred:{total:rows.length-treated,abstention:count('deferred-abstention'),
      gauge:count('deferred-gauge'),unmeasurable:count('deferred-unmeasurable'),other:count('deferred-other')},
    abstainedRails,
    C2:{referencesAvailable:references,
      measurable:references>0,errorByRail:references>0?errorByRail:null,
      note:references>0?null:'Aucune correction humaine dans ce jeu : C2 non mesurable ici.'},
    C3:{outOfContractRefused:count('deferred-gauge'),
      outOfContractApplied:rows.filter(r=>r.status==='treated'&&r.gaugeClass&&!['NOMINAL','TOLERANCE'].includes(r.gaugeClass)).length},
    abstentionCauses:Object.fromEntries(Object.entries(causes).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))),
    rows};
}

/* ---------------------------------------------------------------------------
 * COMPARAISON — « surpasse GCV1 » se mesure à ABSTENTIONS COMPTÉES.
 *
 * Un moteur qui s'abstient moins mais place plus mal ne surpasse rien. La
 * matrice ci-dessous nomme donc chaque basculement, y compris ceux qui vont
 * dans le mauvais sens, et la régression d'interception est isolée : c'est la
 * seule qui annule un gain de couverture, quel qu'il soit.
 * ------------------------------------------------------------------------- */
function compare(base,variant){
  const key=r=>`${r.part}/${r.cut}`;
  const before=new Map(base.rows.map(r=>[key(r),r])),after=new Map(variant.rows.map(r=>[key(r),r]));
  const shared=[...before.keys()].filter(k=>after.has(k)).sort();
  const moves={};
  for(const k of shared){
    const move=`${before.get(k).status} → ${after.get(k).status}`;
    (moves[move]=moves[move]||[]).push(k);
  }
  const recovered=shared.filter(k=>before.get(k).status!=='treated'&&after.get(k).status==='treated');
  const lost=shared.filter(k=>before.get(k).status==='treated'&&after.get(k).status!=='treated');
  /* Une paire hors contrat qui passe de refusée à appliquée : régression
   * d'interception. Elle annule le gain de couverture, par contrat. */
  const bad=row=>row.gaugeClass&&!['NOMINAL','TOLERANCE'].includes(row.gaugeClass);
  const interceptionLost=shared.filter(k=>bad(after.get(k))&&after.get(k).status==='treated'
    &&before.get(k).status!=='treated');
  /* Le mouvement inverse — une paire hors contrat qui passe d'appliquée à
   * refusée — est un GAIN de justesse. Sans lui, le banc qualifierait de
   * régression le principal apport de sûreté de la 4.7, qui a fait baisser la
   * couverture de 13 points en refusant dix placements faux. Une couverture qui
   * baisse parce qu'on cesse d'appliquer n'importe quoi n'est pas une perte. */
  const interceptionGained=shared.filter(k=>bad(before.get(k))&&before.get(k).status==='treated'
    &&after.get(k).status!=='treated');
  return {base:base.id,variant:variant.id,comparedCuts:shared.length,
    coverageBefore:base.C1.coverage,coverageAfter:variant.C1.coverage,
    recovered:recovered.length,lost:lost.length,
    recoveredCuts:recovered,lostCuts:lost,
    interceptionRegressions:interceptionLost.length,interceptionRegressionCuts:interceptionLost,
    interceptionGains:interceptionGained.length,interceptionGainCuts:interceptionGained,
    verdict:interceptionLost.length?'REGRESSION_INTERCEPTION — le gain de couverture est annulé'
      :interceptionGained.length&&lost.length<=interceptionGained.length
        ?'GAIN DE JUSTESSE — la couverture baisse parce que des paires fausses cessent d’être appliquées'
      :recovered.length>lost.length?'GAIN DE COUVERTURE — à lire avec C2'
      :recovered.length===lost.length?'NEUTRE':'PERTE DE COUVERTURE',
    transitions:Object.fromEntries(Object.entries(moves).sort().map(([m,list])=>[m,list.length]))};
}

/* Le rendu refuse C1 sans C3 ni abstentions : un chiffre de couverture seul est
 * la façon exacte dont on se ment sur ce projet. */
function render(card,floorNote){
  const pct=v=>v===null?'—':(100*v).toFixed(1)+' %';
  const out=[`BANC DE PLACEMENT — ${card.id} (${card.source}, contrat ${card.contract})`,
    `Cuts notés : ${card.cuts}`,'',
    `C1  couverture      ${pct(card.C1.coverage)}  (${card.C1.treated}/${card.cuts} cuts, deux rails dans le contrat)`,
    `    différés        ${card.deferred.total}  — abstention ${card.deferred.abstention}`
      +` · écartement ${card.deferred.gauge} · non mesurable ${card.deferred.unmeasurable}`,
    `    rails abstenus  gauche ${card.abstainedRails.left} · droite ${card.abstainedRails.right}`,'',
    `C3  interceptions   ${card.C3.outOfContractRefused} paires hors contrat refusées`
      +(card.C3.outOfContractApplied?`  ⚠ ${card.C3.outOfContractApplied} APPLIQUÉES`:'  (aucune appliquée)'),''];
  if(card.C2.measurable){
    out.push(`C2  erreur contre la correction humaine — ${card.C2.referencesAvailable} cuts référencés`,
      '    unités de scène ; la calibration physique n’est PAS vérifiée indépendamment');
    for(const side of SIDES){const e=card.C2.errorByRail[side].euclidean;
      out.push(`    ${side.padEnd(6)} n=${String(e.count).padStart(3)}  médiane ${e.median}  p90 ${e.p90}  max ${e.max}`);}
    out.push(floorNote||'    plancher de reproductibilité humaine : NON MESURÉ (P2) — aucun écart n’est interprétable sans lui');
  }else out.push(`C2  ${card.C2.note}`);
  out.push('');
  if(Object.keys(card.abstentionCauses).length){
    out.push('Causes d’abstention :');
    for(const [cause,n] of Object.entries(card.abstentionCauses))out.push(`  ${String(n).padStart(3)}  ${cause}`);
  }
  return out.join('\n');
}

/* ---- jeu de données du dépôt : le lot terrain du 21 septembre ----
 * Il ne porte AUCUN point LiDAR : il rejoue l'écartement de paire et le chemin
 * runtime, pas la science mono-rail. C'est exactement ce qu'il faut pour C1 et
 * C3 ; C2 y est déclaré non mesurable plutôt que fabriqué. */
function fixtureRun(root,mode='4.7'){
  const raw=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/gauge-part15-smoke.json'),'utf8'));
  const cuts=raw.cuts.map(c=>{
    const row={part:c.part,cut:c.cut,before:c.before,statuses:c.statuses,deltas:c.deltas,
      reasons:{left:[],right:[]}};
    /* Mode 4.6 : on note ce que le lot a RÉELLEMENT fait, garde d'écartement
     * absent. Les dix paires hors contrat y apparaissent alors comme appliquées
     * — ce qu'elles ont été, puis validées. Mode 4.7 : le banc classe selon le
     * contrat, et le garde les refuse. */
    if(mode==='4.6')row.applied=c.terrain.applied===true;
    return row;});
  return {id:mode==='4.6'?'gcv1-4.6-sans-garde':'gcv1-4.7-avec-garde',
    source:'fixture '+raw.format,cuts};
}

function parseArgs(argv){
  const runs=[];let json=null,fixture=false,floor=null;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--run'){const [id,...rest]=String(argv[++i]).split('=');runs.push({id,file:rest.join('=')});}
    else if(argv[i]==='--json')json=argv[++i];
    else if(argv[i]==='--fixture')fixture=true;
    else if(argv[i]==='--floor')floor=Number(argv[++i]);
  }
  return {runs,json,fixture,floor};
}

function run(argv=process.argv.slice(2),root=path.resolve(__dirname,'..')){
  const opt=parseArgs(argv);
  const sources=opt.fixture?[fixtureRun(root,'4.6'),fixtureRun(root,'4.7')]
    :opt.runs.map(r=>{const raw=JSON.parse(fs.readFileSync(r.file,'utf8'));return {...raw,id:r.id||raw.id};});
  if(!sources.length){console.error('Usage : --fixture  ou  --run id=FICHIER [--run id=FICHIER] [--json SORTIE] [--floor N]');process.exit(1);}
  const cards=sources.map(scoreRun);
  const floorNote=Number.isFinite(opt.floor)
    ?`    plancher de reproductibilité humaine : ${opt.floor} (P2) — aucun écart sous ce seuil n’est un progrès`:null;
  const comparisons=cards.slice(1).map(card=>compare(cards[0],card));
  for(const card of cards){console.log(render(card,floorNote));console.log('');}
  for(const c of comparisons){
    console.log(`COMPARAISON ${c.base} → ${c.variant} sur ${c.comparedCuts} cuts communs`);
    console.log(`  couverture ${(100*c.coverageBefore).toFixed(1)} % → ${(100*c.coverageAfter).toFixed(1)} %`);
    console.log(`  récupérés ${c.recovered} · perdus ${c.lost}`
      +` · interceptions gagnées ${c.interceptionGains} · régressions ${c.interceptionRegressions}`);
    console.log(`  ${c.verdict}`);
    for(const [move,n] of Object.entries(c.transitions))console.log(`    ${String(n).padStart(3)}  ${move}`);
    console.log('');
  }
  /* Carte de score sans horodatage : mêmes entrées, mêmes octets. */
  const card={format:'banane-bench-placement-v1',contract:Gauge.CONTRACT.version,
    humanReproducibilityFloor:Number.isFinite(opt.floor)?opt.floor:null,runs:cards,comparisons};
  if(opt.json)fs.writeFileSync(opt.json,JSON.stringify(card,null,2)+'\n');
  return card;
}

module.exports={distribution,outcome,railError,scoreRun,compare,render,fixtureRun,parseArgs,run};
if(require.main===module)run();
