'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {measure,toMarkdown,union}=require('../tools/perf-phases.cjs');
const {journal,id}=require('./helpers/perf-phases.cjs');
test('sept phases avec bornes propres, union V4.6, même cohorte et résidu',()=>{
 const m=measure(journal());assert.deepEqual(m.etapes.map(e=>e.ms.median),[100,200,50,650,50,400,100]);
 assert.equal(m.lots[0].coverage.complete,true);assert.equal(m.visits[0].v46.unionMs,110);assert.equal(m.visits[0].v46.insideAnalysisMs,110);
 assert.equal(m.cohort.sumMediansMs,1550);assert.equal(m.cohort.medianSumMs,1550);assert.equal(m.cohort.medianCycleMs,1600);assert.equal(m.cohort.residualMs,50);
 assert.equal(m.lots[0].totalMs,1620);assert.match(toMarkdown(m),/Capture|Après pose/);assert.equal(union([[0,10],[5,20],[22,25]]),23);
});
test('jalon manquant : aucune durée zéro ni complétion par un ancien journal',()=>{
 const j=journal();j.events=j.events.filter(e=>e.point!=='proposed');j.events.push({type:'proposed',timestamp:new Date().toISOString(),identity:id(100)});
 const m=measure(j);assert.equal(m.etapes[1].ms.median,null);assert.equal(m.etapes[2].missing,1);assert.equal(m.lots[0].coverage.complete,false);
 assert.equal(m.visits[0].v46.insideAnalysisMs,null);assert.match(toMarkdown(m),/non mesuré/);
});
test('revisite, autre session, lot voisin et Écho ne comblent pas une absence',()=>{
 const j=journal(),p=j.events.find(e=>e.point==='proposed');j.events=j.events.filter(e=>e!==p);
 for(const change of [{visitId:'revisit'},{batchId:'other'},{sessionId:'echo'},{identity:{...id(100),frameId:'other-frame'}}])j.events.push({...p,eventId:JSON.stringify(change),...change});
 const m=measure(j);assert.equal(m.visits.find(v=>v.visitId==='visit').phases[1].status,'missing');assert.equal(m.lots[0].coverage.complete,false);
});
test('changement d’horloge : ni phases ni durée de lot reconstruits par wall clock',()=>{
 const j=journal();for(const e of j.events)if(e.ms>=300)e.clockId='restarted';
 const m=measure(j);assert.equal(m.visits.length,2);assert.equal(m.lots[0].totalMs,null);assert.equal(m.cohort.n,0);assert.equal(m.lots[0].coverage.complete,false);
});
test('différé : première partie mesurée, pose et suites inapplicables, lacunes antérieures conservées',()=>{
 const j=journal();j.events=j.events.filter(e=>e.kind==='batch'||e.kind==='health'||e.ms<=350);j.events.push({...j.events.find(e=>e.point==='decision'),eventId:'defer',ms:400,point:'deferred'});
 const v=measure(j).visits[0];assert.deepEqual(v.phases.map(p=>p.status),['measured','measured','measured','inapplicable','inapplicable','inapplicable','inapplicable']);
 j.events=j.events.filter(e=>e.point!=='proposed');assert.equal(measure(j).visits[0].phases[1].status,'missing');
});
test('dernière coupe posée non validée, validation en place et recapture sont explicites',()=>{
 const j=journal();j.events=j.events.filter(e=>!['after-read','accepted','next-observed'].includes(e.point)&&e.label!=='after-state-read');
 j.events.push({...j.events.find(e=>e.point==='pose-readback'),eventId:'last',point:'last-unvalidated'});
 assert.deepEqual(measure(j).visits[0].phases.slice(4).map(p=>p.status),['inapplicable','inapplicable','inapplicable']);
 const k=journal();k.events=k.events.filter(e=>e.point!=='next-observed');k.events.push({...k.events.find(e=>e.point==='accepted'),eventId:'in-place',point:'in-place'});
 assert.equal(measure(k).visits[0].phases[6].reason,'validation-in-place');
 const open=k.events.find(e=>e.kind==='visit');open.navigationMs=null;open.navigationReason='recapture';assert.equal(measure(k).visits[0].phases[0].status,'inapplicable');
 open.navigationReason='unobserved';assert.equal(measure(k).visits[0].phases[0].status,'missing');
});
test('navigation combinée avant acceptation : chevauchement positif, pas durée nulle inventée',()=>{
 const j=journal();j.events.find(e=>e.point==='next-observed').ms=1400;const m=measure(j);
 assert.equal(m.visits[0].phases[6].status,'overlap');assert.equal(m.visits[0].phases[6].ms,null);assert.equal(m.visits[0].nextOverlapMs,100);assert.equal(m.lots[0].coverage.complete,false);
});
test('silence strict >60 s, exclusion de cycle entier, causes d’arrêts et dénominateur',()=>{
 const j=journal();for(const e of j.events)if(e.ms>=1000)e.ms+=67000;const m0=measure(j);assert.equal(m0.lots[0].silences.count,1);assert.equal(m0.lots[0].silences.totalMs,67650);
 assert.equal(m0.lots[0].cycleMs.n,0);assert.equal(m0.lots[0].excludedCycles.n,1);
 const a=j.events[1];for(const [name,cause] of [['pause','operator'],['halt','adapter-unresponsive'],['halt','esv-silent'],['halt','guard'],['halt','protection'],['stop','permanent']])j.events.push({...a,eventId:name+cause,kind:'control',name,cause,wasRunning:true});
 const m=measure(j);assert.equal(m.lots[0].stops.per100,600);assert.equal(m.lots[0].stops.causes.guard,1);assert.equal(m.lots[0].stops.distinctCuts,1);
});
test('export tronqué, pertes de plusieurs horloges, séquence absente et projet manquant interdisent 100 %',()=>{
 const j=journal();j.events.find(e=>e.kind==='health').visits=2;assert.equal(measure(j).lots[0].coverage.complete,false);
 j.events.find(e=>e.kind==='health').visits=1;j.state.batch.sequence.push({identity:id(101)});assert.equal(measure(j).lots[0].coverage.absentSequence.length,1);
 const k=journal();for(const e of k.events)if(e.identity)e.identity.projectId=null;assert.equal(measure(k).lots[0].coverage.scopeComplete,false);
 const h=j.events.find(e=>e.kind==='health');h.lost=2;j.events.push({...h,eventId:'health2',clockId:'restart',lost:3});assert.equal(measure(j).lots[0].coverage.lost,5);
 const x=journal();x.events=x.events.filter(e=>e.kind!=='health');assert.equal(measure(x).lots[0].coverage.finalHealth,false);
});
test('doublons de segments dédupliqués ; conflit signalé ; V4.6 absent non mesuré',()=>{
 const j=journal();j.events.push({...j.events[2]});assert.equal(measure(j).visits[0].phases[1].status,'measured');
 j.events.push({...j.events[2],ms:999});assert.equal(measure(j).conflictingEventIds.length,1);
 const k=journal();k.events=k.events.filter(e=>!e.label?.startsWith('v46'));assert.equal(measure(k).visits[0].v46.insideAnalysisMs,null);
 assert.equal(measure({events:[]}).available,false);
});
test('l’ancien perf-lot conserve son API et annonce V1 non mesuré',()=>{
 const m=require('../tools/perf-lot.cjs').measure({events:[{type:'batch-started',timestamp:'2026-10-03T00:00:00Z',batch:{id:'A'}}],state:{batch:{id:'A'}}});
 assert.equal(m.v1.available,false);
});
test('spans scientifiques invalides : non mesurés et invalidité publiée, jamais durée négative ou zéro',()=>{
 const j=journal();for(const e of j.events)if(e.label?.startsWith('v46'))e.toMs=e.fromMs-1;
 const m=measure(j);assert.equal(m.visits[0].v46.unionMs,null);assert.equal(m.visits[0].v46.invalidCalls,2);
 assert.ok(m.v46.categories.every(c=>c.ms.n===0&&c.invalid===c.calls));
});
