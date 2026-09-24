'use strict';
/* CHANTIER 5 — §14 I, provenance : aucune position humaine (correction ou
 * validation de l'opérateur) dans l'entrée d'une décision. La référence humaine
 * ne sert qu'à JUGER, après coup (cahier §10, §14 I ; D-038).
 *
 * Ici, le rejeu hors ligne, qui a la relecture Natif sous la main. Le Pilote
 * (reprise manuelle, « Réessayer ce cut ») : `acceptance-provenance-pilote.test.cjs`. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../tools/acceptance-report.cjs'),L=require('../src/lot-decision.js');
const {pair,positions,pilotCut,pilotLot,visit,relecture}=require('./helpers/acceptance-lot.cjs');
const P=23,T=[5,-3,0];

test('§14 I : le rejeu ne lit aucune pose humaine : changer la relecture ne change aucune entrée de la décision',()=>{
  const cuts=[400,401,402,403].map((c,i)=>pilotCut(P,c,{...(i%2?{outcome:'deferred'}:{}),lotObservation:{version:'lot-decision-v4',stage:'first-pass',anchor:true,applied:false}}));
  const lot=pilotLot(P,cuts),clouds=cuts.map(c=>({captureId:c.observation.lidar.captureId,identity:c.id,rails:c.before,pointsSceneRelative:[[0,0,0]],visibleByClipBoxes:[true]}));
  /* Deux relectures des mêmes cuts : poses finales humaines à 2 mm, puis à 47 mm. */
  const reread=mm=>relecture(cuts.map((c,i)=>visit(P,c.id.cut,{before:pair(c.id.cut,{},T,i%2?1500:1435),final:pair(c.id.cut,{left:[mm,1],right:[mm,-1]},T)})));
  function run(rel){const inputs=[];
    const spy={...L,decideCut(args){const {Shadow,...rest}=args;inputs.push(JSON.stringify(rest));
      return {stage:'first-pass',positions:positions(args.capture.rails),anchor:true};}};
    const r=A.report([{label:'provenance',...lot,corpus:{clouds},relecture:rel}],{replay:true,preferReplay:true,replayDeps:{L:spy,Shadow:{},maxAnchors:40}});
    return {inputs,r};}
  const a=run(reread(2)),b=run(reread(47));
  assert.equal(a.inputs.length,4);assert.deepEqual(b.inputs,a.inputs,'mêmes entrées de décision, quelle que soit la relecture');
  /* La relecture sert bien au jugement : mêmes décisions, jugements différents. */
  const worst=x=>x.r.lots[0].rows.map(row=>row.lot?.worstMm);
  assert.notDeepEqual(worst(a),worst(b));assert.ok(a.r.total.lotDecision.judged>0);
  /* Aucune coordonnée propre aux poses humaines n'atteint la décision. */
  const humaines=new Set([.047+T[1],1.435+.047+T[1]].map(v=>v.toFixed(6)));
  for(const input of b.inputs)for(const n of input.match(/-?\d+\.\d+(e-?\d+)?/g)||[])assert.ok(!humaines.has(Number(n).toFixed(6)),`coordonnée humaine ${n} dans l'entrée`);
});
