'use strict';
/* Rapport d'acceptation (chantier 4) : C1 à C4 sur un lot Pilote relu en Natif,
 * données synthétiques construites ici (`tests/helpers/acceptance-lot.cjs`). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../tools/acceptance-report.cjs');
const {pair,pilotCut,pilotLot,visit,relecture}=require('./helpers/acceptance-lot.cjs');
const P=21,T=[1000,-2000,50];

/* Lot de 11 cuts distincts, partie 21 ; relecture dans un autre repère (translation T). */
function scenario(){
  const cuts=[
    pilotCut(P,100,{visits:2}),                       // revisité par le Pilote, juste (3 mm)
    pilotCut(P,101),                                  // faux latéral (12 mm)
    pilotCut(P,102),                                  // faux vertical (11 mm)
    pilotCut(P,103),                                  // deux visites validées : la dernière fait foi
    pilotCut(P,104,{outcome:'deferred'}),             // différé, 40 mm de la pose de départ
    pilotCut(P,105,{outcome:'gauge',gaugeMm:1300}),   // refusé par l'écartement
    pilotCut(P,106,{outcome:'noinput'}),              // aucun point LiDAR
    pilotCut(P,107,{outcome:'none'}),                 // atteint, lot arrêté dessus
    pilotCut(P,108),                                  // relu sans validation
    pilotCut(P,109),                                  // deux intentions : référence non stricte
    pilotCut(P,110),                                  // jamais relu
  ];
  const lot=pilotLot(P,cuts,{stoppedOn:107});
  const applied=c=>pair(c,{},T),start=c=>pair(c,{},T,1500);
  const records=[
    visit(P,100,{before:applied(100),final:pair(100,{left:[3,0],right:[3,0]},T)}),
    visit(P,101,{before:applied(101),final:pair(101,{left:[12,0]},T)}),
    visit(P,102,{before:applied(102),final:pair(102,{right:[0,11]},T)}),
    visit(P,103,{before:applied(103),final:pair(103,{left:[20,0]},T),index:1}),
    visit(P,103,{before:pair(103,{left:[20,0]},T),final:pair(103,{left:[1,0],right:[1,0]},T),index:2}),
    visit(P,104,{before:start(104),final:pair(104,{left:[40,0]},T,1500)}),
    visit(P,105,{before:start(105),final:pair(105,{},T)}),
    visit(P,108,{before:applied(108),intents:[]}),
    visit(P,109,{before:applied(109),final:pair(109,{},T),intents:['VALIDATE','VALIDATE']}),
  ];
  return {label:'synthétique',...lot,corpus:null,relecture:relecture(records)};
}

test('C1 : cuts distincts, revisite comptée une fois, chaque issue au dénominateur',()=>{
  const r=A.report([scenario()]),c1=r.total.c1;
  assert.equal(c1.distinctCuts,11);
  assert.deepEqual([c1.applied,c1.deferred,c1.gaugeRejected,c1.noInput,c1.other],[7,1,1,1,1]);
  assert.equal(c1.coveragePct,63.6);assert.equal(c1.revisitedCuts,1);
  assert.deepEqual(c1.otherDetail.map(o=>[o.cut,o.outcome]),[[106,'no-input'],[107,'other']]);
});

test('C4 : faux si latéral OU vertical au-delà de 10 mm, sur les seuls cuts appliqués jugés',()=>{
  const c4=A.report([scenario()]).total.c4;
  assert.equal(c4.judgedApplied,4);assert.equal(c4.appliedNotJudged,3);
  assert.deepEqual(c4.wrongCuts.map(w=>[w.cut,w.worstMm]),[[101,12],[102,11]]);
  const w102=c4.wrongCuts.find(w=>w.cut===102);assert.equal(w102.errors.right.verticalMm,-11);assert.equal(w102.errors.right.lateralMm,0);
});

test('C2 : médiane et p90 des rails appliqués jugés, P2 non mesuré affiché',()=>{
  const c2=A.report([scenario()]).total.c2;
  assert.equal(c2.rails,8);
  assert.deepEqual([c2.lateralMm.median,c2.lateralMm.p90,c2.lateralMm.maximum],[1,5.7,12]);
  assert.deepEqual([c2.verticalMm.median,c2.verticalMm.p90,c2.verticalMm.maximum],[0,3.3,11]);
  assert.equal(c2.floor.label,'P2 non mesuré');
});

test('C3 : paire refusée listée avec son écartement ; aucune paire appliquée hors contrat',()=>{
  const c3=A.report([scenario()]).total.c3;
  assert.deepEqual(c3.refused,[{cut:105,predictedMm:1300,gaugeClass:'LOW_INVALID'}]);
  assert.deepEqual(c3.appliedOutOfContract,[]);
});

test('C3 : une paire appliquée hors contrat est signalée',()=>{
  const lot=pilotLot(P,[pilotCut(P,300,{applied:pair(300,{},[0,0,0],1500)})]);
  const c3=A.report([{label:'x',...lot,relecture:null}]).total.c3;
  assert.equal(c3.appliedOutOfContract.length,1);assert.equal(c3.appliedOutOfContract[0].gaugeClass,'HIGH_INVALID');
});

test('non jugeables : raison par cut ; plusieurs visites validées, la dernière fait foi',()=>{
  const r=A.report([scenario()]),u=r.total.unjudgeable;
  assert.deepEqual(u['relu-sans-validation'].list,[108]);
  assert.deepEqual(u['référence-non-stricte'].list,[109]);
  assert.deepEqual(u['pas-de-relecture'].list,[106,107,110]);
  const row=r.lots[0].rows.find(x=>x.cut===103);
  assert.equal(row.judgement.usedVisitIndex,2);assert.match(row.judgement.rule,/dernière fait foi/);assert.equal(row.judgement.worstMm,1);
  // Un différé relu n'est jamais un faux : l'écart à la pose de départ est un diagnostic.
  assert.deepEqual(r.total.deferredStartGapsMm,[{cut:104,startGapMm:40},{cut:105,startGapMm:65}]);
});

test('repère : frameId différent, translation unique vérifiée cut par cut',()=>{
  const lot=A.report([scenario()]).lots[0];
  assert.equal(lot.relecture.frame.sameFrameId,false);
  assert.deepEqual(lot.relecture.frame.translationSceneUnits,T);
  assert.equal(lot.relecture.frame.cutsAgreeing,lot.relecture.frame.cutsCompared);
});

test('repère : une pose AVANT qui n’est pas celle du Pilote rend le cut non jugeable',()=>{
  const s=scenario();s.relecture.records[0]=visit(P,100,{before:pair(100,{left:[5,0]},T),final:pair(100,{},T)});
  const row=A.report([s]).lots[0].rows.find(x=>x.cut===100);
  assert.equal(row.judgement.reason,'pose-avant-différente-de-celle-du-pilote');assert.equal(row.judgement.residualMm,5);
});

test('même repère : résultats identiques à ceux du repère translaté',()=>{
  const cuts=[pilotCut(P,100,{frameId:'f'}),pilotCut(P,101,{frameId:'f'})],lot=pilotLot(P,cuts);
  const records=[visit(P,100,{frameId:'f',before:pair(100),final:pair(100,{left:[3,0],right:[3,0]})}),
    visit(P,101,{frameId:'f',before:pair(101),final:pair(101,{left:[12,0]})})];
  const r=A.report([{label:'f',...lot,relecture:relecture(records)}]);
  assert.equal(r.lots[0].relecture.frame.sameFrameId,true);
  assert.deepEqual(r.total.c4.wrongCuts.map(w=>w.cut),[101]);assert.equal(r.total.c4.judgedApplied,2);
});

test('exclusions 9033 et 9241 (partie 19) : hors de toute mesure, comptées à part',()=>{
  const cuts=[pilotCut(19,9032),pilotCut(19,9033),pilotCut(19,9241,{outcome:'deferred'})],lot=pilotLot(19,cuts);
  const r=A.report([{label:'p19',...lot,relecture:null}]),t=r.total;
  assert.equal(t.c1.distinctCuts,1);assert.equal(t.c1.applied,1);
  assert.deepEqual(t.excluded.map(e=>[e.cut,e.outcome]),[[9033,'applied'],[9241,'deferred']]);
  // La configuration ajoute des exclusions, elle n'en retire aucune.
  const more=A.report([{label:'p19',...lot,relecture:null}],{config:{exclusions:[{part:19,cut:9032,motif:'essai'}]}});
  assert.equal(more.total.c1.distinctCuts,0);assert.equal(more.total.excluded.length,3);
});

test('partie par partie puis total ; tenue à l’écart et P2 (un opérateur)',()=>{
  const other=pilotLot(22,[pilotCut(22,500),pilotCut(22,501,{outcome:'deferred'})]);
  const p2={operators:1,cuts:30,lateralMm:{median:0.9,p90:2.4},verticalMm:{median:0.6,p90:1.8}};
  const r=A.report([scenario(),{label:'p22',...other,relecture:null}],{config:{tuningParts:[21]},p2});
  assert.deepEqual(r.parts.map(p=>[p.part,p.holdout,p.c1.distinctCuts]),[[21,'a servi au réglage',11],[22,'tenue à l’écart',2]]);
  assert.equal(r.total.c1.distinctCuts,13);assert.equal(r.total.c2.floor.label,'P2 (un opérateur)');
  const md=A.toMarkdown(r);
  for(const c of ['C1 — couverture','C2 — erreur','C3 — paires','C4 — faux'])assert.equal(md.split(c).length-1,r.parts.length+1,c);
  assert.match(md,/P2 \(un opérateur\) \(latéral 0,9 \/ 2,4/);assert.match(md,/tenue à l’écart/);
});

test('mêmes entrées, même rapport (§14 F)',()=>{
  assert.equal(JSON.stringify(A.report([scenario()])),JSON.stringify(A.report([scenario()])));
});
