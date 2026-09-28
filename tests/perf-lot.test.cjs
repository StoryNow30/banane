'use strict';
/* tools/perf-lot.cjs : temps terrain lus dans les événements d'un export. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {measure,toMarkdown}=require('../tools/perf-lot.cjs');
const t=s=>new Date(Date.UTC(2026,8,26,6,0,0)+s*1000).toISOString();
const id=cut=>({part:12,cut});
function journal(){const ev=[],lot=b=>({id:b,scope:{part:12,start:1}});
  ev.push({type:'batch-started',timestamp:t(0),batch:lot('A')});
  ev.push({type:'cut-target-changed',timestamp:t(1),identity:id(1)},{type:'before-captured',timestamp:t(7),identity:id(1)},
    {type:'adapter-result',timestamp:t(7),identity:id(1),action:'capture',elapsedMs:6000,lastDetail:{points:5000,bytes:900000,attempts:2}},
    {type:'proposed',timestamp:t(7.5),identity:id(1)},{type:'gcv1-shadow-observed',timestamp:t(7.5),identity:id(1),lotObservation:{engineMs:3}},
    {type:'adapter-result',timestamp:t(8.2),identity:id(1),action:'apply',elapsedMs:680},
    {type:'cut-target-changed',timestamp:t(10),identity:id(2)},
    {type:'adapter-result',timestamp:t(16),identity:id(2),action:'capture',elapsedMs:5000,error:'Vue ESV non recentrée sur le rail right.'},
    /* silence de 2 min (pause) */
    {type:'cut-target-changed',timestamp:t(140),identity:id(3)});
  ev.push({type:'batch-started',timestamp:t(200),batch:lot('B')},{type:'cut-target-changed',timestamp:t(201),identity:id(9)},{type:'cut-target-changed',timestamp:t(210),identity:id(10)});
  return {format:'banane-test-journal-v4',version:'4.8.0',state:{batch:{id:'A',state:'STOPPED',scope:{part:12}}},events:ev.reverse()};}
test('lot exporté seul : durées, commandes, capture, silences',()=>{
  const m=measure(journal());
  assert.equal(m.source.lotSeul,true);assert.equal(m.cuts.distincts,3);
  assert.deepEqual([m.cycleMs.n,m.cycleMs.median],[1,9000],'le cycle de 130 s (silence) est hors cadence');
  assert.equal(m.commandesMs.capture.n,2);assert.equal(m.commandesMs.apply.median,680);assert.equal(m.erreurs.capture.length,1);
  assert.equal(m.capture.points.median,5000);assert.equal(m.analyseMs.median,500);assert.equal(m.decisionMs.median,3);
  assert.equal(m.silences.length,1);assert.equal(m.silences[0].s,124);
});
/* D5 : décomposition du cycle d'un cut validé, phase par phase (tableau du
 * 28/09, partie 15). `cut-target-changed` porte le cut quitté (`identity`) et
 * le cut visé (`nextIdentity`). */
function journalPhases(){const ev=[],nav=(s,de,vers)=>({type:'cut-target-changed',timestamp:t(s),identity:id(de),nextIdentity:id(vers)});
  const valide=(s0,c)=>[{type:'before-captured',timestamp:t(s0),identity:id(c)},{type:'proposed',timestamp:t(s0+1),identity:id(c)},
    {type:'gcv1-shadow-observed',timestamp:t(s0+1.2),identity:id(c)},{type:'applied-verified',timestamp:t(s0+2.5),identity:id(c)},
    {type:'after-captured',timestamp:t(s0+3),identity:id(c)},{type:'validation-accepted',timestamp:t(s0+4),identity:id(c)}];
  ev.push({type:'batch-started',timestamp:t(0),batch:{id:'A',scope:{part:12,start:1}}});
  ev.push(nav(0,0,1),...valide(4.5,1),nav(9,1,2),...valide(13.5,2),nav(18,2,3));
  /* cut 3 différé : pas de pose ni de validation, hors décomposition */
  ev.push({type:'before-captured',timestamp:t(22),identity:id(3)},{type:'proposed',timestamp:t(23),identity:id(3)},
    {type:'gcv1-shadow-observed',timestamp:t(23.2),identity:id(3)},{type:'defer-finalized',timestamp:t(24),identity:id(3)},nav(25,3,4));
  /* cut 4 : validation sans pose relue (chaîne incomplète), hors décomposition */
  ev.push({type:'before-captured',timestamp:t(29),identity:id(4)},{type:'proposed',timestamp:t(30),identity:id(4)},
    {type:'gcv1-shadow-observed',timestamp:t(30.2),identity:id(4)},{type:'validation-accepted',timestamp:t(31),identity:id(4)},nav(32,4,5));
  return {format:'banane-test-journal-v4',version:'4.8.0',state:{batch:{id:'A',state:'STOPPED',scope:{part:12}}},events:ev};}
test('D5 : décomposition du cycle par phase, cuts validés à chaîne complète seulement',()=>{
  const p=measure(journalPhases()).phases;
  assert.equal(p.n,2,'cut différé et chaîne incomplète exclus');
  assert.deepEqual(p.etapes.map(e=>e.id),['navigation-capture','analyse-gcv1','decision-lot','pose','capture-apres-pose','validation','cut-suivant']);
  const med=Object.fromEntries(p.etapes.map(e=>[e.id,e.ms.median]));
  assert.deepEqual(med,{'navigation-capture':4500,'analyse-gcv1':1000,'decision-lot':200,'pose':1300,'capture-apres-pose':500,'validation':1000,'cut-suivant':500});
  assert.equal(p.sommeMedianesMs,9000);assert.equal(p.cycleMs.median,9000);
  assert.equal(p.etapes[0].part,0.5,'part = médiane de la phase / somme des médianes');
  assert.match(toMarkdown(measure(journalPhases())),/Décomposition du cycle[^]*Navigation → capture reçue \| 2 \| 4,5 s \| 4,5 s \| 50 %/);
});
test('D5 : sans cut validé à chaîne complète, la décomposition est vide et le rapport le dit',()=>{
  const m=measure(journal());assert.equal(m.phases.n,0);assert.match(toMarkdown(m),/Décomposition du cycle : aucun cut validé/);
});
test('--tous : tous les lots de l\'export, et le tableau lot par lot',()=>{
  const m=measure(journal(),{tous:true});assert.equal(m.source.lotSeul,false);assert.equal(m.lots.length,2);
  assert.deepEqual(m.lots.map(l=>l.cuts),[3,2]);assert.match(toMarkdown(m,'essai'),/Lot par lot/);
});
test('D5 revue : un cycle lent est attribué au cut visité (nextIdentity), pas au cut quitté',()=>{
  const ev=[{type:'batch-started',timestamp:t(0),batch:{id:'A',scope:{part:12,start:1}}},
    {type:'cut-target-changed',timestamp:t(1),identity:id(4),nextIdentity:id(5)},{type:'before-captured',timestamp:t(3),identity:id(5)},
    {type:'cut-target-changed',timestamp:t(200),identity:id(5),nextIdentity:id(6)}];
  const m=measure({format:'x',version:'4.8.0',state:{batch:{id:'A',state:'STOPPED'}},events:ev});
  assert.deepEqual(m.cyclesLents,[{cut:5,s:199}]);
});
test('D5 revue : une chaîne dont un jalon se répète (pose refaite) est exclue et comptée à part',()=>{
  const j=journalPhases();
  /* cut 2 : seconde pose relue et seconde capture après pose avant la validation */
  j.events.push({type:'applied-verified',timestamp:t(16.8),identity:id(2)},{type:'after-captured',timestamp:t(17),identity:id(2)});
  const p=measure(j).phases;assert.equal(p.n,1);assert.equal(p.repetes,1);
  assert.match(toMarkdown(measure(j)),/1 cut validé à chaîne complète ; 1 exclu \(jalon répété\)/);
});
test('D5 revue : sans nextIdentity, la navigation n’a pas de cible connue et le cut n’entre pas dans la décomposition',()=>{
  const j=journalPhases();for(const e of j.events)if(e.type==='cut-target-changed')delete e.nextIdentity;
  assert.equal(measure(j).phases.n,0);
});
test('D5 revue : la décomposition n’est calculée que pour la fenêtre mesurée, pas pour chaque lot',()=>{
  const m=measure(journal(),{tous:true});assert.equal('phases' in m.lots[0],false);assert.equal(typeof m.phases.n,'number');
});
