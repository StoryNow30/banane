'use strict';
/* T3D-5 (relecture du test 3) : les compteurs du vidage du cache disaient le nombre d'identifiants DEMANDÉS, pas le nombre
 * supprimé (`deleteMany` rendait la longueur de la liste) : un nuage déjà absent était compté « supprimé », dans le message
 * et dans `exportPeriod.previousDataCleared.counts`. On compte désormais les clés présentes et supprimées dans la même
 * transaction, comme `deleteIfUnchanged`. Stockage RÉEL (src/storage.js) sur une fausse IndexedDB minimale. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const EC=require('../src/export-cache.js');

/* Fausse IndexedDB : requêtes asynchrones (micro-tâches), transaction terminée quand plus aucune requête n'est en attente. */
function fausseIDB(){const magasins={clouds:new Map(),events:new Map(),records:new Map()};
 const db={transaction(nom){const m=magasins[nom];let attente=0,fini=false;const tx={};
  const fin=()=>setTimeout(()=>{if(!fini&&attente===0){fini=true;tx.oncomplete&&tx.oncomplete();}},0);
  const req=fn=>{const r={};attente++;queueMicrotask(()=>{r.result=fn();try{r.onsuccess&&r.onsuccess();}finally{attente--;if(attente===0)fin();}});return r;};
  tx.objectStore=()=>({get:k=>req(()=>m.get(k)),count:k=>req(()=>m.has(k)?1:0),getKey:k=>req(()=>m.has(k)?k:undefined),delete:k=>req(()=>{m.delete(k);}),
   put:(v,k)=>req(()=>{m.set(k,v);return k;}),getAll:()=>req(()=>[...m.values()]),getAllKeys:()=>req(()=>[...m.keys()]),clear:()=>req(()=>{m.clear();})});
  fin();return tx;}};
 return {magasins,indexedDB:{open(){const r={};setTimeout(()=>{r.result=db;r.onsuccess&&r.onsuccess();},0);return r;}}};}
function stockage(){const f=fausseIDB(),ctx={indexedDB:f.indexedDB,chrome:{storage:{local:{}}},setTimeout,queueMicrotask,Promise,Error};ctx.globalThis=ctx;
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/storage.js'),'utf8'),ctx);return {store:new ctx.BananeStorage3(),magasins:f.magasins};}

test('stockage réel : deleteMany rend le nombre de clés PRÉSENTES et supprimées, pas le nombre demandé',async()=>{
 const {store,magasins}=stockage();await store.putCloud('a',{captureId:'a'});await store.putCloud('b',{captureId:'b'});
 const n=await store.deleteMany('clouds',['a','zzz','yyy']);
 assert.equal(n,1,'un seul nuage existait parmi les trois demandés');assert.deepEqual([...magasins.clouds.keys()],['b']);
});
test('vidage : compteurs exacts (nuages absents non comptés) ; les événements gardent le compte de deleteIfUnchanged',async()=>{
 const {store}=stockage();await store.putCloud('c1',{captureId:'c1'});const ev={eventId:'e1',type:'x'};await store.putEvent(ev);await store.putEvent({eventId:'e2',type:'x'});
 const out=await EC.supprimer(store,{events:['e1','e-absent'],records:[],clouds:['c1','zzz']},{},{events:{e1:EC.signature(ev),'e-absent':'0:0'},records:{}});
 assert.equal(out.clouds,1,'« zzz » n’existait pas : non compté');assert.equal(out.events,1,'événement absent : non compté');
 assert.deepEqual((await store.keys('events')),['e2']);
});
test('stockage sans compte rendu (ancien faux stockage) : repli sur la longueur de la liste, comme avant',async()=>{
 const sup=[];const out=await EC.supprimer({deleteMany:async(nom,ids)=>{sup.push(...ids);}},{clouds:['c1','c2']},{},{});
 assert.equal(out.clouds,2);assert.deepEqual(sup,['c1','c2']);
});
