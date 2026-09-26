#!/usr/bin/env node
'use strict';
/*
 * validated-anchors-study.cjs — la décision sur le lot, avec pour appuis les
 * cuts VOISINS déjà validés avant le lot (étude hors ligne, 24/09).
 *
 *   node tools/validated-anchors-study.cjs --lot DOSSIER[=libellé] [--relecture DOSSIER] [--gap 3] [--stables] [--garde [--tolerance 8] [--fenetre 5]]
 *        [--regles-actuelles]   (rejeu aux règles de la version courante, en « appliquer »)
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
const A=require('./acceptance-report.cjs'),L=require('../src/lot-decision.js'),C=require('../vendor/capture-core.js');
const SIDES=['left','right'];
function validatedNeighbours(lot,analysed,{stables=false}={}){
  const T=analysed.relecture?.frame?.translationSceneUnits||[0,0,0],inLot=new Set(analysed.rows.map(r=>r.cut));
  /* Lot sans journal (4.7.18) : la partie est lue sur les cuts du lot. */
  const frameId=analysed.rows.find(r=>r.frameId)?.frameId??null,part=analysed.batch?.part??analysed.rows.find(r=>Number.isFinite(r.part))?.part??null,out=[];
  for(const r of (lot.relecture?.records||[]).slice().sort((a,b)=>(a.visitIndex??0)-(b.visitIndex??0))){
    const c=r.identity?.cut;if(inLot.has(c)||r.identity?.part!==part||out.some(v=>v.identity.cut===c))continue;
    const rails=r.beforeEstablished?.rails;if(!SIDES.every(s=>Array.isArray(rails?.[s]?.positionSceneRelative)))continue;
    if(stables&&lot.relecture.records.some(v=>v.identity?.cut===c&&(v.stateTransitions||[]).some(t=>t.effect?.kind==='rail-state-changed')))continue;
    out.push({identity:{part,cut:c,frameId},positions:Object.fromEntries(SIDES.map(s=>[s,rails[s].positionSceneRelative.map((v,i)=>v-T[i])])),stage:'validated-before-lot'});
  }
  return out;
}
/* GARDE (étape 2) : un voisin n'est gardé comme appui que s'il s'aligne, sur les
 * DEUX rails, avec au moins deux autres voisins de la fenêtre (±`window` cuts) :
 * écart latéral et vertical à la droite des autres ≤ `tolerance` mm, dans le
 * repère du rail du cut décidé. On retient le plus grand groupe cohérent ; moins
 * de `minInliers` voisins cohérents : aucun appui validé pour ce cut. Un voisin
 * faux et isolé (pose jamais validée, SKIP) est ainsi écarté sans lire l'avenir. */
/* La garde est celle du runtime depuis la 4.7.20 (`consistentValidated`, D-054). */
const consistentAnchors=(identity,rails,validated,{window=5,tolerance=8,minInliers=3}={})=>
  L.consistentValidated(identity,rails,validated,{validatedWindow:window,validatedToleranceMm:tolerance,validatedMinInliers:minInliers});
function study(lot,{gap=3,stables=false,guard=false,tolerance=8,window=5,currentRules=false}={}){
  /* Décision sur le lot lue dans le rejeu (lots 4.7.8 : KI-048). */
  const base=A.report([lot],{replay:true,preferReplay:true,currentRules}),validated=validatedNeighbours(lot,base.lots[0],{stables});
  const pick=args=>guard?consistentAnchors(args.capture.identity,args.capture.rails,validated,{window,tolerance}):validated;
  const deps={L:{...L,decideCut:args=>L.decideCut({...args,anchors:[...pick(args),...args.anchors],options:{...(args.options||{}),gap}})}};
  const withValidated=A.report([lot],{replay:true,preferReplay:true,currentRules,replayDeps:deps});
  const line=r=>{const s=r.total,d=s.lotDecision;return {distinctCuts:s.c1.distinctCuts,pilotApplied:s.c1.applied,lotApplied:d.wouldApply,coveragePct:d.coveragePct,
    judged:d.judged,wrong:d.wrong,newWrong:d.newWrong,gained:d.gained};};
  return {format:'banane-validated-anchors-study-v1',gap,stables,currentRules,guard:guard?{window,tolerance,minInliers:3}:false,validatedNeighbours:validated.length,lotAnchorsOnly:line(base),withValidatedNeighbours:line(withValidated),
    remaining:withValidated.lots[0].rows.filter(r=>!r.excluded&&!r.lot?.wouldApply).map(r=>({cut:r.cut,pilot:r.outcome,stage:r.lot?.stage??null,reason:r.lot?.reason??null}))};
}
function run(argv=process.argv.slice(2)){
  let lotArg=null,relecture=null,gap=3,stables=false,guard=false,tolerance=8,window=5,json=null,currentRules=false;
  for(let i=0;i<argv.length;i++){if(argv[i]==='--lot')lotArg=argv[++i];else if(argv[i]==='--gap')gap=Number(argv[++i]);
    else if(argv[i]==='--relecture')relecture=argv[++i];else if(argv[i]==='--stables')stables=true;else if(argv[i]==='--garde')guard=true;else if(argv[i]==='--regles-actuelles')currentRules=true;else if(argv[i]==='--tolerance')tolerance=Number(argv[++i]);else if(argv[i]==='--fenetre')window=Number(argv[++i]);else if(argv[i]==='--json')json=argv[++i];else throw Error('Argument inconnu : '+argv[i]);}
  if(!lotArg)throw Error('Usage : --lot DOSSIER[=libellé] [--relecture DOSSIER] [--gap 3] [--stables] [--garde [--tolerance 8] [--fenetre 5]] [--regles-actuelles] [--json SORTIE]');
  const [dir,label]=lotArg.split('='),r=study(A.loadLot(dir,label||dir,relecture),{gap,stables,guard,tolerance,window,currentRules});
  const f=x=>`${x.lotApplied}/${x.distinctCuts} (${x.coveragePct} %) · ${x.wrong} faux / ${x.judged} jugés · gagnés ${x.gained.map(g=>g.cut+(g.worstMm!=null?` (${g.worstMm} mm)`:'')).join(', ')||'aucun'}`;
  console.log(`voisins retenus comme appuis : ${r.validatedNeighbours}${stables?' (stables à la relecture)':''}${guard?` · garde : cohérence à ${tolerance} mm sur ±${window} cuts`:''} · écart max ${gap}`);
  console.log(`appuis du lot seuls        : ${f(r.lotAnchorsOnly)}`);
  console.log(`+ voisins déjà validés     : ${f(r.withValidatedNeighbours)}`);
  for(const x of r.remaining)console.log(`  reste ${x.cut} : Pilote ${x.pilot}, lot ${x.stage??'—'} ${x.reason??''}`);
  if(json)require('node:fs').writeFileSync(json,JSON.stringify(r,null,1)+'\n');
  return r;
}
if(require.main===module)try{run();}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={validatedNeighbours,consistentAnchors,study,run};
