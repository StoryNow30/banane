/* RAPPORT D'ÉCARTEMENT SUR UNE SESSION NATIF — mesure, jamais décision.
 *
 * L'outil répond à la question ouverte par `AUDIT_PILOTE.md` défaut 7 : que
 * fait l'opérateur à l'écartement de la voie ? Il mesure, il ne corrige rien,
 * il n'entraîne rien, et il ne déclare un biais que lorsque la moyenne du
 * geste dépasse son écart-type — le critère déjà retenu par `src/brain.js`.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../tools/native-gauge-report.cjs');
const C=require('../vendor/capture-core.js');
const Gauge=require('../src/gauge.js');

/* Un rail à une origine donnée, avec des matrices de repère cohérentes. La
 * paire est séparée selon Y, l'axe latéral du repère profil. */
const railAt=p=>({positionSceneRelative:p,profileOriginSceneRelative:p,
  railLocalToSceneRelative:C.multiply(C.translation(p),C.identity()),
  profileLocalToSceneRelative:C.multiply(C.translation(p),C.identity()),
  sceneRelativeToProfileLocal:C.inverse(C.multiply(C.translation(p),C.identity()))});
const pair=(gaugeMm,shiftLeftMm=0)=>({left:railAt([0,shiftLeftMm/1000,0]),right:railAt([0,gaugeMm/1000+shiftLeftMm/1000,0])});
/* Un enregistrement Natif : pose trouvée à l'ouverture, puis pose corrigée. */
const visit=(cut,beforeMm,afterMm,extra={})=>({identity:{part:15,cut},
  beforeEstablished:{rails:pair(beforeMm)},
  humanFinalReference:{status:'candidate-observed',association:{freshnessMs:40},state:{rails:pair(afterMm)}},
  observedLabelCandidate:'VALIDATE_CORRECTED_BOTH',
  geometryEligibility:{pair:{status:'excluded'}},usableAsNativeReference:false,usableForTraining:false,...extra});
const rowsOf=records=>records.map(r=>R.rowOf(r.identity.cut,r,'fixture.json'));

test('l’écartement mesuré est la distance entre les origines, et sa classe suit le contrat',()=>{
 const row=R.rowOf(2398,visit(2398,1503.5,1435.3),'fixture.json');
 assert.ok(Math.abs(row.beforeGaugeMm-1503.5)<1e-6);
 assert.ok(Math.abs(row.correctedGaugeMm-1435.3)<1e-6);
 assert.equal(row.beforeGaugeClass,'HIGH_INVALID');
 assert.equal(row.correctedGaugeClass,'NOMINAL');
 assert.equal(row.usableForTraining,false,'aucune référence Natif n’est rendue entraînable ici');
});

test('le déplacement humain est rendu rail par rail, dans le repère profil',()=>{
 /* Seul le rail droit bouge : +10 mm latéral, l’écartement passe de 1430 à 1440. */
 const record={identity:{part:15,cut:1},beforeEstablished:{rails:pair(1430)},
   humanFinalReference:{status:'candidate-observed',state:{rails:pair(1440)}}};
 const row=R.rowOf(1,record,'fixture.json');
 assert.ok(Math.abs(row.displacementLocal.left[1])<1e-9,'le rail gauche n’a pas bougé');
 assert.ok(Math.abs(row.displacementLocal.right[1]*1000-10)<1e-6,'le rail droit a bougé de 10 mm');
});

test('un geste systématique est déclaré biais, une dispersion ne l’est pas',()=>{
 /* Gauche : +5 mm répétés, dispersion ±1 → moyenne au-dessus de l’écart-type.
  * Droite : alternance ±5 mm → moyenne nulle, dispersion large. */
 const records=[];
 for(let i=0;i<8;i++){
  const gauche=5+(i%2?1:-1),droite=(i%2?5:-5);
  records.push({identity:{part:15,cut:100+i},beforeEstablished:{rails:pair(1430)},
    humanFinalReference:{status:'candidate-observed',
      state:{rails:{left:railAt([0,gauche/1000,0]),right:railAt([0,1430/1000+droite/1000,0])}}}});
 }
 const m=R.build(rowsOf(records));
 assert.equal(m.biasOnMinorRetouches.left.lateralMm.declaredBias,true,'un geste répété est un biais');
 assert.equal(m.biasOnMinorRetouches.right.lateralMm.declaredBias,false,'une alternance n’en est pas un');
});

test('les gros faux placements sont exclus du calcul de biais, mais pas du reste',()=>{
 const records=[visit(1,1430,1436),visit(2,1431,1437),
   /* un faux placement de 70 mm : il ne doit pas fabriquer un biais à lui seul */
   {identity:{part:15,cut:3},beforeEstablished:{rails:pair(1500)},
    humanFinalReference:{status:'candidate-observed',state:{rails:pair(1430)}}}];
 const m=R.build(rowsOf(records));
 assert.equal(m.withHumanCorrection,3,'les trois corrections sont comptées');
 assert.equal(m.minorRetouchesUnder20mm,2,'seules les deux retouches mineures nourrissent le biais');
 assert.equal(m.biasOnMinorRetouches.right.lateralMm.count,2);
 /* L’écartement, lui, tient compte de tout. */
 assert.equal(m.gaugeBeforeMm.count,3);
 assert.equal(m.gaugeBeforeMm.max,1500);
});

test('le rapport compte les classes d’écartement après correction, sans rien décider',()=>{
 const m=R.build(rowsOf([visit(1,1500,1436),visit(2,1490,1429),visit(3,1480,1404)]));
 assert.deepEqual(m.correctedGaugeClasses,{NOMINAL:1,TOLERANCE:1,LOW_INVALID:1});
 assert.deepEqual(m.contract,Gauge.CONTRACT);
 /* Aucun verdict, aucune commande, aucune notion de SKIP dans la sortie. */
 assert.ok(!/SKIP|VALIDATE_|apply/.test(JSON.stringify(m)));
});
