'use strict';
/* V1, correction proposée (2) : chronologie concurrente (D-073). La
 * validation durable et la navigation suivante avancent en même temps :
 * décalage signé publié, fenêtres réunies (union) et communes (intersection),
 * rien compté deux fois, rien fabriqué. Les phases, la couverture et la
 * cohorte existantes ne changent pas. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {measure,toMarkdown}=require('../tools/perf-phases.cjs'),{journal}=require('./helpers/perf-phases.cjs');
function withNext(ms){const j=journal();j.events.find(e=>e.point==='next-observed').ms=ms;return j;}
test('navigation avant acceptation : décalage signé négatif, union et intersection sans double compte',()=>{
 const m=measure(withNext(1400)),v=m.visits[0],c=v.chronology;
 assert.deepEqual(c.milestones.map(x=>[x.point,x.ms]),[['navigation',0],['capture-received',100],['proposed',300],['decision',350],['pose-readback',1000],['after-read',1100],['next-observed',1400],['accepted',1500]]);
 assert.equal(c.nextMinusAcceptedMs,-100);assert.equal(c.untilNextMs,1400);assert.equal(c.untilAcceptedMs,1500);
 assert.deepEqual(c.end,{from:'after-read',acceptanceMs:400,navigationMs:300,unionMs:400,intersectionMs:300});
 assert.equal(c.end.unionMs+c.end.intersectionMs,c.end.acceptanceMs+c.end.navigationMs,'temps commun compté une fois');
 // Rien d'existant ne bouge : le chevauchement reste publié, la cohorte sept phases vide.
 assert.equal(v.phases[6].status,'overlap');assert.equal(v.nextOverlapMs,100);assert.equal(m.cohort.n,0);assert.equal(m.lots[0].coverage.complete,false);
 assert.deepEqual([m.concurrence.visits,m.concurrence.navigationBeforeAcceptance,m.concurrence.signedDeltaMs.median],[1,1,-100]);
 const md=toMarkdown(m);assert.match(md,/Chronologie concurrente/);assert.match(md,/\| Navigation suivante − acceptation \(signé\) \| 1 \| -100 \|/);
 assert.match(md,/Navigation suivante avant l’acceptation durable : 1 visite\(s\) sur 1/);
});
test('ordre séquentiel : décalage positif ; jalon absent : non mesuré, jamais zéro',()=>{
 const c=measure(withNext(1600)).visits[0].chronology;assert.equal(c.nextMinusAcceptedMs,100);assert.deepEqual([c.end.unionMs,c.end.intersectionMs],[500,400]);
 const j=journal();j.events=j.events.filter(e=>e.point!=='accepted');const m=measure(j),d=m.visits[0].chronology;
 assert.deepEqual([d.nextMinusAcceptedMs,d.untilAcceptedMs,d.end.acceptanceMs,d.end.unionMs,d.end.intersectionMs],[null,null,null,null,null]);
 assert.equal(d.untilNextMs,1600);assert.equal(m.concurrence.visits,0);assert.match(toMarkdown(m),/\| Navigation suivante − acceptation \(signé\) \| 0 \| non mesuré \|/);
 const x=journal();x.events.find(e=>e.kind==='visit').navigationMs=null;assert.equal(measure(x).visits[0].chronology.untilNextMs,null);
});
