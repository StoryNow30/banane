'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {journal}=require('./helpers/perf-phases.cjs'),{measure}=require('../tools/perf-phases.cjs');
function large(finalSnapshot){const j=journal(),h=j.events.pop(),ctx=j.events[1];
 for(let i=0;i<150000;i++)j.events.push({...ctx,eventId:'many-'+i,kind:'observation',point:'synthetic',ms:100+i/1000,batchSeq:ctx.batchSeq+20+i});
 h.batchSeq=150020;h.finalSnapshot=finalSnapshot;j.events.push(h);return j;}
for(const final of [true,false])test('150014 événements conservés : maximum '+(final?'séquence puis taille':'taille sans court-circuit santé'),()=>{
 const j=large(final),m=measure(j);assert.equal(j.events.length,150014);assert.equal(m.lots[0].instrumentation.eventCount,150014);
 const expected=j.events.reduce((n,e)=>Math.max(n,Buffer.byteLength(JSON.stringify(e),'utf8')),0);
 assert.equal(m.lots[0].instrumentation.maxEventBytes,expected);assert.equal(m.lots[0].coverage.finalHealth,false);assert.equal(m.lots[0].coverage.complete,false);
});
