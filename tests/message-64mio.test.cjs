'use strict';
/* KI-059 (terrain du 25/09, partie 3, cut 8209) : « Message exceeded maximum
 * allowed size of 64MiB », lot suspendu, adaptateur « sans réponse ». Un
 * message chrome.runtime est limité à 64 Mio. Capture, réponse de
 * l'adaptateur, vue du panneau et exports doivent tenir dessous, ou échouer
 * par une erreur courte et explicite. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../src/merge-clouds.js'),K=require('../src/core.js');
const {bridge}=require('./helpers/bridge.cjs');
const {background}=require('./helpers/background-harness.cjs');

function capture(nodes,retainedEvery){
  const out={nodes:[],pointsSceneRelative:[],pointSources:[],warnings:[]};
  for(let i=0;i<nodes;i++){const retained=retainedEvery&&i%retainedEvery===0?2:0;
    out.nodes.push({id:'n'+i,cloudIndex:0,source:'visibleNodes',inspection:'complete',inspected:1750,retained,
      probes:Array.from({length:33},(_,k)=>({sourceIndex:k,pointSceneRelative:[k*0.123456789,-4.2*k,0.5]})),nearestToRailOrigin:{left:null,right:null}});
    for(let r=0;r<retained;r++){out.pointSources.push([i,r]);out.pointsSceneRelative.push([i,r,0]);}}
  return out;
}

test('capture ordinaire (52 nœuds au plus sur le banc) : intacte',()=>{
  const c=capture(52,4),avant=JSON.stringify(c);
  assert.equal(M.compactNodes(c),0);assert.equal(JSON.stringify(c),avant);
});

test('vue éloignée, 3 000 nœuds : rapports sans point réduits, indices des points conservés',()=>{
  const c=capture(3000,50),avant=M.messageBytes(c);
  const n=M.compactNodes(c);
  assert.equal(n,2940);assert.equal(c.nodes.length,3000,'un nœud par indice : pointSources reste valide');
  for(const [node] of c.pointSources)assert.ok(c.nodes[node].retained>0&&!c.nodes[node].reportCompacted);
  assert.ok(M.messageBytes(c)<avant/10,`${M.messageBytes(c)} contre ${avant}`);
  assert.match(c.warnings.at(-1),/64 Mo/);
});

test('une capture trop grosse est une « Lecture LiDAR instable » : pause reprenable du lot',()=>{
  assert.equal(M.MESSAGE_BUDGET<M.MESSAGE_LIMIT,true);
  assert.equal(K.transientCaptureError('Lecture LiDAR instable : capture de 70 Mo, trop grosse pour un message Chrome (64 Mo).'),true);
});

test('bridge : réponse au-delà du budget remplacée par une erreur courte ; envoi refusé par Chrome aussi',()=>{
  const f=bridge(),cap=f.command('capture');f.deliver(cap,{kind:'banane3:progress',stage:'received',detail:{}});
  f.deliver(cap,{kind:'banane3:result',result:{pointsSceneRelative:'x'.repeat(57*1024*1024)}});
  assert.equal(cap.replies.length,1);assert.equal(cap.replies[0].result,undefined);
  assert.match(cap.replies[0].error,/^Lecture LiDAR instable : .*trop grosse pour un message Chrome/);
  assert.equal(cap.replies[0].diagnostic.action,'capture');
  /* Chrome refuse l'envoi (taille mesurée différemment) : une seconde réponse, courte. */
  let calls=0;const next=f.command('next',(r,replies)=>{if(++calls===1)throw Error('Message exceeded maximum allowed size of 64MiB.');replies.push(r);});
  f.deliver(next,{kind:'banane3:result',result:{ok:true}});
  assert.equal(next.replies.length,1);assert.match(next.replies[0].error,/trop grosse pour un message Chrome \(next, Message exceeded/);
  assert.doesNotMatch(next.replies[0].error,/Lecture LiDAR/);
});

test('service worker : la vue du panneau ne transporte plus records ni incomplete ; exports en métadonnées',async()=>{
  const b=background();await b.api('connect',{tabId:1});await b.api('before');await b.api('after');
  const v=await b.api('view');assert.equal(v.records,undefined);assert.equal(v.incomplete,undefined);assert.equal(v.recordsCount,1);
  const meta=await b.api('journal-meta');assert.equal(meta.format,'banane-test-journal-v4');
  assert.equal(meta.events,undefined);assert.equal(meta.records,undefined);assert.deepEqual([...meta.stateOmits],['records','incomplete']);
  assert.ok(meta.state.batch!==undefined&&meta.state.records===undefined);
  const d=await b.api('dataset-meta');assert.equal(d.cloudIds.length,1);assert.equal(d.events,undefined);
  const g=await b.api('gcv1-export-meta');assert.equal(g.sessionId,meta.state.sessionId);
  /* Chemin de repli inchangé. */
  assert.equal((await b.api('journal')).records.length,1);
});

test('service worker : un refus de taille signalé par Chrome devient une lecture à reprendre',async()=>{
  const b=background();await b.api('connect',{tabId:1});
  b.adapter.capture=async()=>{throw Error('Message exceeded maximum allowed size of 64MiB.');};
  await assert.rejects(()=>b.api('before'),/^Error: Lecture LiDAR instable : réponse de l’adaptateur trop grosse/);
});
