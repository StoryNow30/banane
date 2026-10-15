'use strict';
/* Décision sur le lot : reprise par la voie et ses limites (amendement n°9,
 * D-039, KI-047). Séparé de `lot-decision.test.cjs` pour tenir le délai par fichier. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js');
const {K,base}=require('./fixtures.cjs');
const SIDES=['left','right'];
const capture=(rails,cut=105)=>({identity:{part:23,cut,frameId:'f'},rails,pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)});
const science0=Shadow.scientificProposeBoth(capture(base.rails));
const truth=Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,d=science0.rails[side].next.delta;
  const w=K.C.point(P,d),o=K.C.point(P,[0,0,0]);return [side,O.translated(r,w.map((v,i)=>v-o[i]))];}));
function shifted(rails,mm){return Object.fromEntries(SIDES.map(side=>{const r=rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));}
const anchorAt=(cut,rails)=>({identity:{part:23,cut,frameId:'f'},positions:Object.fromEntries(SIDES.map(s=>[s,rails[s].positionSceneRelative]))});
const lateralMm=(rails,positions,ref)=>Math.max(...SIDES.map(s=>{const m=rails[s].sceneRelativeToProfileLocal,a=K.C.point(m,positions[s]),h=K.C.point(m,ref[s].positionSceneRelative);return Math.abs(a[1]-h[1])*1000;}));

test('pose ESV à 150 mm, voisins justes : la voie retrouve le rail à quelques mm',()=>{
  const rails=shifted(truth,150),cap=capture(rails),sci=Shadow.scientificProposeBoth(cap);
  const d=L.decideCut({capture:cap,science:sci,anchors:[anchorAt(104,truth),anchorAt(103,truth)],Shadow});
  assert.ok(['window','choice'].includes(d.stage),d.stage);
  assert.ok(lateralMm(rails,d.positions,truth)<5,String(lateralMm(rails,d.positions,truth)));
});

/* RISQUE CONNU (KI-047), gardé visible par ce test : ce fixture porte, à
 * +150 mm, une paire de champignons parallèles aussi nette que la voie. Si les
 * ancres sont fausses de ce décalage exact — erreur de mode commun déjà
 * acceptée plus tôt dans le lot —, le choix suit la voie et se trompe avec
 * elles, l'écartement restant dans le contrat. La protection est en amont :
 * ancres confirmées par la garde de continuité. */
test('risque connu : des ancres fausses sur une paire parallèle entraînent le choix',()=>{
  /* D-084 (12 octobre 2026) : borne basse du contrat d'écartement à 1420 mm (1405 avant). Le fixture est repris à 140 mm : la
   * paire parallèle choisie est à 1436,4 mm, DANS le contrat, donc ni le contrat ni la garde d'écartement voisin (même écartement
   * que les ancres) ne l'arrêtent : le risque KI-047 reste ouvert et ce test le garde visible. */
  const rails=shifted(truth,140),cap=capture(rails),sci=Shadow.scientificProposeBoth(cap),wrong=shifted(truth,140),anchors=[anchorAt(104,wrong),anchorAt(103,wrong)];
  const d=L.decideCut({capture:cap,science:sci,anchors,Shadow,options:{gaugeGuardMm:null}});
  assert.equal(d.stage,'choice');assert.ok(lateralMm(rails,d.positions,truth)>100);
  assert.ok(d.gaugeMm>1420&&d.gaugeMm<1470,String(d.gaugeMm));
});

/* À 150 mm la paire parallèle choisie est à 1415,9 mm : admissible avec la borne 1405 (4.7.16 : la garde d'écartement voisin la
 * différait déjà, écartement à 20,6 mm de celui des ancres), HORS contrat depuis la borne 1420 (D-084). Même sans la garde
 * d'écartement voisin le cut est différé : le contrat ferme ce cas. */
test('D-084 : la paire parallèle à 1415,9 mm (ancres fausses de 150 mm) est hors contrat, le cut est différé',()=>{
  const rails=shifted(truth,150),cap=capture(rails),sci=Shadow.scientificProposeBoth(cap),wrong=shifted(truth,150),anchors=[anchorAt(104,wrong),anchorAt(103,wrong)];
  const d=L.decideCut({capture:cap,science:sci,anchors,Shadow,options:{gaugeGuardMm:null}});
  assert.equal(d.stage,'deferred');assert.equal(d.reason,'gauge-LOW_INVALID');assert.ok(d.gaugeMm>1415&&d.gaugeMm<1417,String(d.gaugeMm));
  const g=L.decideCut({capture:cap,science:sci,anchors,Shadow});
  assert.equal(g.stage,'deferred');assert.ok(['gauge-guard','gauge-LOW_INVALID'].includes(g.reason),g.reason);
});

