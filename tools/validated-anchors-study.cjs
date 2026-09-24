#!/usr/bin/env node
'use strict';
/*
 * validated-anchors-study.cjs — la décision sur le lot, avec pour appuis les
 * cuts VOISINS déjà validés avant le lot (étude hors ligne, 24/09).
 *
 *   node tools/validated-anchors-study.cjs --lot DOSSIER[=libellé] [--gap 3] [--stables] [--garde [--tolerance 8] [--fenetre 5]]
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
  const frameId=analysed.rows.find(r=>r.frameId)?.frameId??null,part=analysed.batch?.part??null,out=[];
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
const localMm=(rail,p)=>{const M=rail.sceneRelativeToProfileLocal,a=C.point(M,p),o=C.point(M,rail.positionSceneRelative);return [0,1,2].map(i=>(a[i]-o[i])*1000);};
function consistentAnchors(identity,rails,validated,{window=5,tolerance=8,minInliers=3}={}){
  const cands=validated.filter(a=>a.identity.part===identity.part&&(a.identity.frameId??null)===(identity.frameId??null)&&
    a.identity.cut!==identity.cut&&Math.abs(a.identity.cut-identity.cut)<=window);
  if(cands.length<minInliers)return [];
  const pts=cands.map(a=>Object.fromEntries(SIDES.map(s=>[s,localMm(rails[s],a.positions[s])])));
  let best=[],bestResidual=Infinity;
  for(let i=0;i<cands.length;i++)for(let j=i+1;j<cands.length;j++){
    const inliers=[];let residual=0;
    for(let k=0;k<cands.length;k++){let ok=true,r=0;
      for(const s of SIDES)for(const axis of [1,2]){const [a,b,c]=[pts[i][s],pts[j][s],pts[k][s]],dx=b[0]-a[0];
        const at=Math.abs(dx)<1e-9?a[axis]:a[axis]+(b[axis]-a[axis])*(c[0]-a[0])/dx,e=Math.abs(c[axis]-at);r+=e;if(e>tolerance)ok=false;}
      if(ok){inliers.push(k);residual+=r;}}
    if(inliers.length>best.length||inliers.length===best.length&&residual<bestResidual){best=inliers;bestResidual=residual;}
  }
  return best.length>=minInliers?best.map(k=>cands[k]):[];
}
function study(lot,{gap=3,stables=false,guard=false,tolerance=8,window=5}={}){
  const base=A.report([lot],{replay:true}),validated=validatedNeighbours(lot,base.lots[0],{stables});
  const pick=args=>guard?consistentAnchors(args.capture.identity,args.capture.rails,validated,{window,tolerance}):validated;
  const deps={L:{...L,decideCut:args=>L.decideCut({...args,anchors:[...pick(args),...args.anchors],options:{...(args.options||{}),gap}})}};
  const withValidated=A.report([lot],{replay:true,replayDeps:deps});
  const line=r=>{const s=r.total,d=s.lotDecision;return {distinctCuts:s.c1.distinctCuts,pilotApplied:s.c1.applied,lotApplied:d.wouldApply,coveragePct:d.coveragePct,
    judged:d.judged,wrong:d.wrong,newWrong:d.newWrong,gained:d.gained};};
  return {format:'banane-validated-anchors-study-v1',gap,stables,guard:guard?{window,tolerance,minInliers:3}:false,validatedNeighbours:validated.length,lotAnchorsOnly:line(base),withValidatedNeighbours:line(withValidated),
    remaining:withValidated.lots[0].rows.filter(r=>!r.excluded&&!r.lot?.wouldApply).map(r=>({cut:r.cut,pilot:r.outcome,stage:r.lot?.stage??null,reason:r.lot?.reason??null}))};
}
function run(argv=process.argv.slice(2)){
  let lotArg=null,gap=3,stables=false,guard=false,tolerance=8,window=5,json=null;
  for(let i=0;i<argv.length;i++){if(argv[i]==='--lot')lotArg=argv[++i];else if(argv[i]==='--gap')gap=Number(argv[++i]);
    else if(argv[i]==='--stables')stables=true;else if(argv[i]==='--garde')guard=true;else if(argv[i]==='--tolerance')tolerance=Number(argv[++i]);else if(argv[i]==='--fenetre')window=Number(argv[++i]);else if(argv[i]==='--json')json=argv[++i];else throw Error('Argument inconnu : '+argv[i]);}
  if(!lotArg)throw Error('Usage : --lot DOSSIER[=libellé] [--gap 3] [--stables] [--garde [--tolerance 8] [--fenetre 5]] [--json SORTIE]');
  const [dir,label]=lotArg.split('='),r=study(A.loadLot(dir,label||dir),{gap,stables,guard,tolerance,window});
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
