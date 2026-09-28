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
test('--tous : tous les lots de l\'export, et le tableau lot par lot',()=>{
  const m=measure(journal(),{tous:true});assert.equal(m.source.lotSeul,false);assert.equal(m.lots.length,2);
  assert.deepEqual(m.lots.map(l=>l.cuts),[3,2]);assert.match(toMarkdown(m,'essai'),/Lot par lot/);
});
