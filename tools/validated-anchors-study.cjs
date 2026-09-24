#!/usr/bin/env node
'use strict';
/*
 * validated-anchors-study.cjs — la décision sur le lot, avec pour appuis les
 * cuts VOISINS déjà validés avant le lot (étude hors ligne, 24/09).
 *
 *   node tools/validated-anchors-study.cjs --lot DOSSIER[=libellé] [--gap 3] [--stables]
 *
 * Le Pilote enchaîne les cuts « non validés » d'ESV : il saute les cuts déjà
 * validés, qui sont pourtant les meilleurs appuis de la voie, et ne s'appuie
 * aujourd'hui que sur ses propres cuts appliqués. Cette étude rejoue la
 * décision sur le lot (`src/lot-decision.js`, rejeu de `tools/acceptance-report.cjs`)
 * en ajoutant ces voisins.
 *
 * Poses des voisins : lues dans la relecture Natif du lot (état ESV à
 * l'ouverture de chaque cut hors du lot), ramenées dans le repère du Pilote par
 * la translation vérifiée par l'outil d'acceptation. Aucune pose humaine du cut
 * décidé n'entre dans son propre calcul ; le jugement reste celui de l'outil
 * d'acceptation.
 *
 * LIMITE, À LIRE AVANT TOUT CHIFFRE. « Hors du lot » ne veut pas dire
 * « validé » : un cut passé en SKIP, par exemple, est sauté par le Pilote avec
 * une pose fausse (partie 19, cut 9219 : 40 à 55 mm). `--stables` ne garde que
 * les voisins que l'opérateur n'a retouchés dans aucune visite de relecture :
 * c'est une approximation du statut « validé » qui lit l'avenir. Sur le
 * terrain, il faudra lire le statut réel de chaque voisin dans ESV.
 */
const A=require('./acceptance-report.cjs'),L=require('../src/lot-decision.js');
const SIDES=['left','right'];
function validatedNeighbours(lot,analysed,{stables=false}={}){
  const T=analysed.relecture?.frame?.translationSceneUnits||[0,0,0],inLot=new Set(analysed.rows.map(r=>r.cut));
  const frameId=analysed.rows.find(r=>r.frameId)?.frameId??null,part=analysed.batch?.part??null,out=[];
  for(const r of (lot.relecture?.records||[]).slice().sort((a,b)=>(a.visitIndex??0)-(b.visitIndex??0))){
    const c=r.identity?.cut;if(inLot.has(c)||r.identity?.part!==part||out.some(v=>v.identity.cut===c))continue;
    const rails=r.beforeEstablished?.rails;if(!SIDES.every(s=>Array.isArray(rails?.[s]?.positionSceneRelative)))continue;
    if(stables&&lot.relecture.records.some(v=>v.identity?.cut===c&&(v.stateTransitions||[]).some(t=>t.effect?.kind==='rail-state-changed')))continue;
    out.push({identity:{part,cut:c,frameId},positions:Object.fromEntries(SIDES.map(s=>[s,rails[s].positionSceneRelative.map((v,i)=>v-T[i])])),stage:'validated-before-lot'});
  }
  return out;
}
function study(lot,{gap=3,stables=false}={}){
  const base=A.report([lot],{replay:true}),validated=validatedNeighbours(lot,base.lots[0],{stables});
  const deps={L:{...L,decideCut:args=>L.decideCut({...args,anchors:[...validated,...args.anchors],options:{...(args.options||{}),gap}})}};
  const withValidated=A.report([lot],{replay:true,replayDeps:deps});
  const line=r=>{const s=r.total,d=s.lotDecision;return {distinctCuts:s.c1.distinctCuts,pilotApplied:s.c1.applied,lotApplied:d.wouldApply,coveragePct:d.coveragePct,
    judged:d.judged,wrong:d.wrong,newWrong:d.newWrong,gained:d.gained};};
  return {format:'banane-validated-anchors-study-v1',gap,stables,validatedNeighbours:validated.length,lotAnchorsOnly:line(base),withValidatedNeighbours:line(withValidated),
    remaining:withValidated.lots[0].rows.filter(r=>!r.excluded&&!r.lot?.wouldApply).map(r=>({cut:r.cut,pilot:r.outcome,stage:r.lot?.stage??null,reason:r.lot?.reason??null}))};
}
function run(argv=process.argv.slice(2)){
  let lotArg=null,gap=3,stables=false,json=null;
  for(let i=0;i<argv.length;i++){if(argv[i]==='--lot')lotArg=argv[++i];else if(argv[i]==='--gap')gap=Number(argv[++i]);
    else if(argv[i]==='--stables')stables=true;else if(argv[i]==='--json')json=argv[++i];else throw Error('Argument inconnu : '+argv[i]);}
  if(!lotArg)throw Error('Usage : --lot DOSSIER[=libellé] [--gap 3] [--stables] [--json SORTIE]');
  const [dir,label]=lotArg.split('='),r=study(A.loadLot(dir,label||dir),{gap,stables});
  const f=x=>`${x.lotApplied}/${x.distinctCuts} (${x.coveragePct} %) · ${x.wrong} faux / ${x.judged} jugés · gagnés ${x.gained.map(g=>g.cut+(g.worstMm!=null?` (${g.worstMm} mm)`:'')).join(', ')||'aucun'}`;
  console.log(`voisins retenus comme appuis : ${r.validatedNeighbours}${stables?' (stables à la relecture)':''} · écart max ${gap}`);
  console.log(`appuis du lot seuls        : ${f(r.lotAnchorsOnly)}`);
  console.log(`+ voisins déjà validés     : ${f(r.withValidatedNeighbours)}`);
  for(const x of r.remaining)console.log(`  reste ${x.cut} : Pilote ${x.pilot}, lot ${x.stage??'—'} ${x.reason??''}`);
  if(json)require('node:fs').writeFileSync(json,JSON.stringify(r,null,1)+'\n');
  return r;
}
if(require.main===module)try{run();}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={validatedNeighbours,study,run};
