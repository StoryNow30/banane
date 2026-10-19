'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');const {bridge}=require('./helpers/bridge.cjs');
test('identifiant de mesure seulement dans le bridge : arguments et commande ESV inchangés',()=>{
 const f=bridge(),args=[{part:23,cut:100}],replies=f.uiMessage({kind:'page-command',action:'validateAndNext',args,traceId:'trace-v1'}),request=f.sent.at(-1);
 assert.equal(request.traceId,undefined);assert.equal(request.args,args);assert.equal(request.action,'validateAndNext');
 const c={request,replies,timer:[...f.timers.keys()].at(-1)};f.deliver(c,{kind:'banane3:progress',stage:'validation-click-returned'});
 assert.equal(f.traces.at(-1).traceId,'trace-v1');f.timeout(c);assert.equal(replies[0].diagnostic.traceId,'trace-v1');
 assert.equal(f.sent.filter(x=>x.action==='validateAndNext').length,1);assert.equal(f.sent.filter(x=>x.action==='cancel').length,1);
 assert.equal(f.sent.at(-1).args[0].requestId,request.id);f.deliver(c,{kind:'banane3:result',result:{}});assert.equal(replies.length,1);
});
test('identifiant compact borné ; résultat et diagnostic restent séparés',()=>{
 const f=bridge(),result={},replies=f.uiMessage({kind:'page-command',action:'state',args:[],traceId:'x'.repeat(81)}),request=f.sent.at(-1);
 f.deliver({request},{kind:'banane3:result',result});assert.equal(replies[0].result,result);assert.equal(replies[0].diagnostic.traceId,undefined);
 assert.ok(Buffer.byteLength(JSON.stringify(replies[0].diagnostic))<4096);assert.equal(f.sent.filter(x=>x.action==='cancel').length,0);
});
