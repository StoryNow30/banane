/* ÉTAGE A — GARDE D'ÉCARTEMENT DE LA PAIRE PUBLIÉE PAR GCV1.
 *
 * Défaut de terrain, lot Edge du 21 septembre 2026 sur la partie 15 : dix
 * paires ont été appliquées puis validées avec un écartement de 1503,5 à
 * 1564,0 mm, hors du contrat métier [1405, 1470]. Chaque rail y était
 * individuellement plausible ; c'est la PAIRE qui était fausse, et aucun étage
 * ne mesurait son écartement.
 *
 * `tests/fixtures/gauge-part15-smoke.json` est l'extrait minimal de ce lot :
 * poses AVANT des deux rails et deltas GCV1 réellement publiés. Aucune donnée
 * LiDAR : ces essais rejouent l'écartement de paire, pas la science mono-rail.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Shadow=require('../src/gcv1-shadow.js');
const Gauge=require('../src/gauge.js');
const C=require('../vendor/capture-core.js');

const SMOKE=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gauge-part15-smoke.json'),'utf8'));
const cutOf=n=>{const row=SMOKE.cuts.find(c=>c.cut===n);assert.ok(row,'cut '+n+' absent de la fixture');return row;};
/* Les dix validations hors contrat du lot réel, avec l'écartement observé. */
const HORS_CONTRAT=[[850,1510.1],[2398,1503.5],[2399,1513.5],[3855,1564.0],[3856,1509.8],
  [3857,1513.0],[3860,1509.9],[3861,1507.8],[4358,1508.5],[9077,1509.3]];
const railsOf=row=>({left:{ok:true,next:{status:row.statuses.left,delta:row.deltas.left}},
  right:{ok:true,next:{status:row.statuses.right,delta:row.deltas.right}}});
const assess=row=>Shadow._test.assessPublishedPair({rails:row.before},railsOf(row));

test('les dix validations hors contrat du terrain sont reproduites et refusées',()=>{
 for(const [cut,observed] of HORS_CONTRAT){
  const row=cutOf(cut),report=assess(row);
  assert.ok(report,'cut '+cut+' : les deux rails étaient candidats');
  assert.ok(Math.abs(report.predictedMm-observed)<1,
    `cut ${cut} : prévu ${report.predictedMm.toFixed(1)} mm, observé ${observed} mm`);
  assert.equal(report.gaugeClass,'HIGH_INVALID','cut '+cut);
  assert.equal(report.admissible,false,'cut '+cut);
  assert.equal(row.terrain.applied,true,'cut '+cut+' avait bien été appliqué en lot réel');
  assert.equal(row.terrain.validated,true,'cut '+cut+' avait bien été validé en lot réel');
 }
});

test('2401 reste admissible en tolérance, et son écartement est bien 1429,1 mm',()=>{
 const row=cutOf(2401),report=assess(row);
 assert.ok(Math.abs(report.predictedMm-1429.1)<1,'prévu '+report.predictedMm.toFixed(1)+' mm');
 assert.equal(report.gaugeClass,'TOLERANCE');
 assert.equal(report.admissible,true);
});

test('2400 et 2402 restent non appliqués : la garde de paire ne s’y applique même pas',()=>{
 for(const cut of [2400,2402]){
  const row=cutOf(cut);
  assert.equal(row.terrain.applied,false,'cut '+cut);
  assert.equal(row.terrain.deferred,true,'cut '+cut+' était déjà différé');
  assert.equal(row.statuses.left,'unresolved','cut '+cut+' : rail gauche déjà abstenu');
  assert.equal(assess(row),null,'aucune paire publiée, donc aucune mesure de paire');
 }
});

test('les validations nominales du même lot restent toutes admissibles',()=>{
 const applied=SMOKE.cuts.filter(c=>c.terrain.applied&&c.deltas.left&&c.deltas.right);
 const hors=new Set(HORS_CONTRAT.map(([cut])=>cut));
 let nominal=0,tolerance=0;
 for(const row of applied){
  const report=assess(row);
  assert.ok(report,'cut '+row.cut);
  if(hors.has(row.cut)){assert.equal(report.admissible,false,'cut '+row.cut);continue;}
  assert.equal(report.admissible,true,`cut ${row.cut} : ${report.predictedMm.toFixed(1)} mm ne doit pas être refusé`);
  if(report.gaugeClass==='NOMINAL')nominal++;else tolerance++;
 }
 assert.equal(applied.length,56,'le lot a appliqué 56 paires');
 assert.equal(nominal,45);
 assert.equal(tolerance,1);
 assert.equal(hors.size,10);
});

test('l’écartement prévu reproduit l’écartement réellement relu dans ESV',()=>{
 let worst=0;
 for(const row of SMOKE.cuts){
  if(!row.appliedPositions||!row.deltas.left||!row.deltas.right)continue;
  const report=assess(row);
  const realised=C.distance(row.appliedPositions.left,row.appliedPositions.right)*1000;
  worst=Math.max(worst,Math.abs(report.predictedMm-realised));
  assert.equal(Gauge.classifyMm(report.predictedMm),Gauge.classifyMm(realised),
    `cut ${row.cut} : classe prévue et classe relue doivent coïncider`);
 }
 /* La tolérance de relecture du moteur après commande est de 1 mm ; l'écart
  * prévu/relu observé sur le lot réel reste sous cette tolérance. */
 assert.ok(worst<1,'écart maximal prévu/relu : '+worst.toFixed(4)+' mm');
});

/* ---- mécanique du refus, de bout en bout sur une capture du dépôt ---- */
const CORPUS=path.join(__dirname,'corpus');
function capture2859(){
 const name=fs.readdirSync(CORPUS).find(f=>f.startsWith('banane-lidar-part-23-cut-2859-'));
 return JSON.parse(fs.readFileSync(path.join(CORPUS,name),'utf8'));
}
/* Seule l'origine du rail droit est déplacée. La science ne lit JAMAIS
 * `positionSceneRelative` — `src/geometry.js`, `src/geometry-candidate-v1.js`
 * et `src/geometry-brain.js` n'en contiennent aucune occurrence — elle passe
 * par `sceneRelativeToProfileLocal`, inchangée. Les candidats des deux rails
 * sont donc identiques ; seul l'écartement mesuré de la paire change. */
function withPairSpacing(capture,metres){
 const c=JSON.parse(JSON.stringify(capture)),l=c.rails.left.positionSceneRelative;
 const d=c.rails.right.positionSceneRelative.map((v,i)=>v-l[i]);
 const n=Math.hypot(...d),k=metres/n;
 c.rails.right.positionSceneRelative=l.map((v,i)=>v+d[i]*k);
 return c;
}

test('la référence du dépôt publie une paire nominale, que la garde laisse passer',()=>{
 const science=Shadow.scientificProposeBoth(capture2859());
 assert.equal(science.rails.left.next.status,'candidate');
 assert.equal(science.rails.right.next.status,'candidate');
 assert.equal(science.pairGauge.gaugeClass,'NOMINAL');
 assert.equal(science.pairGauge.admissible,true);
 assert.equal(science.pairGauge.measurable,true);
 assert.equal(science.rails.left.pairGauge.rejected,false);
 assert.equal(science.summary.pairGaugeRejected,false);
});

test('une paire hors contrat rend les DEUX rails unresolved, sans apply partiel',()=>{
 const base=capture2859(),reference=Shadow.scientificProposeBoth(base);
 /* 1,60 m au-dessus du contrat, 1,35 m en dessous : les deux côtés du
  * contrat sont refusés, et la science mono-rail reste identique. */
 for(const [metres,expected] of [[1.60,'HIGH_INVALID'],[1.35,'LOW_INVALID']]){
  const science=Shadow.scientificProposeBoth(withPairSpacing(base,metres));
  assert.equal(science.pairGauge.gaugeClass,expected,metres+' m');
  assert.equal(science.pairGauge.admissible,false,metres+' m');
  assert.equal(science.summary.pairGaugeRejected,true,metres+' m');
  assert.equal(science.summary.nextCandidates,0,metres+' m : aucun candidat publié');
  assert.equal(science.summary.nextUnresolved,2,metres+' m : les deux rails abstenus');
  for(const side of ['left','right']){
   const rail=science.rails[side],ref=reference.rails[side];
   // la science mono-rail n'a pas bougé
   assert.equal(rail.frame.pointsLocal,ref.frame.pointsLocal,'pointsLocal '+side);
   assert.equal(JSON.stringify(rail.v46.delta),JSON.stringify(ref.v46.delta),'V4.6 '+side);
   assert.equal(rail.astar.status,ref.astar.status,'A_STAR '+side);
   assert.equal(rail.s1AmbiguityPreserved,ref.s1AmbiguityPreserved,'garde S1 '+side);
   // mais la paire est refusée, des deux côtés à la fois
   assert.equal(rail.next.status,'unresolved',side);
   assert.equal(rail.next.motif,'gauge-out-of-contract',side);
   assert.equal(rail.next.delta,null,side);
   assert.equal(rail.next.pick,null,side);
   assert.equal(rail.next.changed,false,side);
   assert.equal(rail.publishedWeak,false,side);
   assert.match(rail.next.reason,/Écartement de paire hors contrat/,side);
   // les candidats initiaux restent disponibles au diagnostic
   assert.equal(rail.pairGauge.rejected,true,side);
   assert.equal(rail.pairGauge.publishedBeforeGate.status,'candidate',side);
   assert.deepEqual(rail.pairGauge.publishedBeforeGate.delta,ref.next.delta,side);
  }
  const runtime=Shadow.toRuntimeRails(science);
  for(const side of ['left','right']){
   assert.equal(runtime[side].status,'unresolved',side);
   assert.equal(runtime[side].delta,null,side);
   assert.equal(runtime[side].confidence,0,side);
   assert.equal(runtime[side].source,'geometry-candidate-v1-abstention',side);
   assert.equal(runtime[side].gcv1.motif,'gauge-out-of-contract',side);
   assert.equal(runtime[side].gcv1.changed,false,side);
  }
 }
});

test('la garde de paire ne peut produire aucun SKIP',()=>{
 const science=Shadow.scientificProposeBoth(withPairSpacing(capture2859(),1.60));
 const dump=JSON.stringify(science);
 assert.ok(!/skipAndNext|explicit-skip/i.test(dump),'aucun ordre de SKIP dans le résultat scientifique');
 for(const side of ['left','right'])
  assert.ok(!/SKIP/.test(String(science.rails[side].next.motif)),'le motif ne prononce pas de SKIP');
});
