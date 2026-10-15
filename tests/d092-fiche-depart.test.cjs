'use strict';
/* D-092 (4.9.0.10) — FICHE DE DÉPART DES PARTIES. Au démarrage d'une séance, ESV charge la liste des cuts de la partie ; l'observateur
 * passif en résume les comptes (`list-summary`, validés / invalides / total). La fiche garde ces trois chiffres dans une clé à part
 * de chrome.storage.local : le vidage du cache des exports ne la touche pas, les exports la recopient (`fichesDepart`), le panneau
 * l'affiche. Service worker RÉEL (background.js) en VM, ESV simulé. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const {production,memoire}=require('./helpers/perf-production.cjs');
const EC=require('../src/export-cache.js');
const root=path.resolve(__dirname,'..'),lire=f=>fs.readFileSync(path.join(root,f),'utf8');
const resume=(o={})=>({seq:1,kind:'list-summary',listKey:'traj__liste',pages:10,okPages:10,rows:7739,chars:11000000,counts:{valid:7602,invalid:137,skipped:0},
 firstStartedEpochMs:Date.now()-300,lastEndedEpochMs:Date.now()-100,durationMs:200,beforeSession:true,...o});
const send=(b,entries,observer='obs-1')=>b.raw({kind:'esv-observation',observer,entries}).out;
const tick=()=>new Promise(r=>setTimeout(r,5));

test('fiche : valides, invalides, total ; liste vide, comptes absents ou absurdes : aucune fiche',()=>{
 const f=EC.ficheDepart({kind:'list-summary',timestamp:'2026-10-13T11:51:55.000Z',rows:7739,counts:{valid:7602,invalid:137,skipped:0}},{batchId:'b1',partie:13,version:'4.9.0.10'});
 deq(f,{at:'2026-10-13T11:51:55.000Z',batchId:'b1',partie:13,version:'4.9.0.10',valides:7602,invalides:137,ignores:0,total:7739});
 assert.equal(7602+137,7739,'les deux comptes font le total de la liste');
 for(const o of [null,{},{kind:'list-page',rows:5,counts:{valid:1,invalid:1}},{kind:'list-summary',rows:0,counts:{valid:0,invalid:0}},
   {kind:'list-summary',rows:100,counts:null},{kind:'list-summary',rows:100,counts:{valid:'x',invalid:1}},{kind:'list-summary',rows:100,counts:{valid:-1,invalid:1}},
   {kind:'list-summary',rows:1e12,counts:{valid:1,invalid:1}}])assert.equal(EC.ficheDepart(o,{}),null,JSON.stringify(o));
});
test('ajout : pas de doublon pour un même lot et mêmes comptes ; borne aux 200 plus récentes ; liste abîmée tolérée',()=>{
 const f=n=>({at:'2026-10-13T08:00:00.000Z',batchId:'b'+n,partie:n,valides:1,invalides:2,total:3});
 let l=EC.ajouterDepart([],f(1));assert.equal(l.length,1);deq(EC.ajouterDepart(l,f(1)),l,'identique : liste inchangée');
 assert.equal(EC.ajouterDepart(l,{...f(1),valides:2}).length,2,'mêmes lot mais comptes différents : nouvelle fiche');
 deq(EC.ajouterDepart(l,null),l);
 let g=[];for(let i=0;i<230;i++)g=EC.ajouterDepart(g,f(i));assert.equal(g.length,200);assert.equal(g[0].batchId,'b30');assert.equal(g.at(-1).batchId,'b229');
 assert.equal(EC.ajouterDepart('abîmé',f(1)).length,1);assert.equal(EC.ajouterDepart([null,3,f(2)],f(3)).length,2);
});
test('texte lisible, avec espaces fines pour les milliers ; partie inconnue écrite « ? »',()=>{
 assert.equal(EC.texteDepart({at:'2026-10-13T11:51:55.000Z',partie:13,valides:7602,invalides:137,total:7739}),
  '13/10/2026 13:51:55 · partie 13 · validés 7 602 · invalides 137 · total 7 739','4.9.0.17 : heure de Paris (CEST, UTC+2), plus « UTC »');
 assert.match(EC.texteDepart({at:null,partie:null,valides:1,invalides:0,total:1}),/heure inconnue · partie \? · validés 1 · invalides 0 · total 1/);
});
test('stockage illisible ou en échec : liste vide, jamais d’exception',async()=>{
 deq(await EC.lireDeparts({get:async()=>{throw Error('x');}}),[]);deq(await EC.lireDeparts({get:async()=>({banane3FichesDepart:'abîmé'})}),[]);
 assert.equal(await EC.noterDepart({get:async()=>({}),set:async()=>{}},null),null);
});

async function lotOuvert(id='lot-A',partie=13){const local=memoire(),b=production({local});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');
 e.s.batch={id,state:'RUNNING',step:'capture',startedAt:new Date(Date.now()-60000).toISOString(),scope:{part:partie,start:0,end:999999},processed:[],skipped:[],paused:[],interrupted:[],sequence:[],deferred:[]};
 r.syncBatch(true);r.ensureVisit(b.adapter.identity);return {b,e,r,local};}

test('service worker : le résumé de liste d’avant séance devient une fiche (partie du lot, version, comptes) ; la liste vide et les doublons ne comptent pas',async()=>{
 const {b,local}=await lotOuvert('lot-A',13);
 const out=send(b,[resume({seq:1,rows:0,counts:{valid:0,invalid:0,skipped:0}}),resume({seq:2})]);assert.equal(out.accept,true);await tick();
 const l=local.m.banane3FichesDepart;assert.equal(l.length,1);
 deq({...l[0],at:typeof l[0].at},{at:'string',batchId:'lot-A',partie:13,version:require('../manifest.json').version,valides:7602,invalides:137,ignores:0,total:7739});
 send(b,[resume({seq:3})],'obs-2');await tick();assert.equal(local.m.banane3FichesDepart.length,1,'même lot, mêmes comptes : une seule fiche');
 send(b,[resume({seq:4,beforeSession:false})]);await tick();assert.equal(local.m.banane3FichesDepart.length,1,'un résumé hors départ de séance n’est pas un départ');
 deq(await b.api('fiches-depart'),{fiches:local.m.banane3FichesDepart});
 await b.settle();
});
test('une relance (autre lot, mêmes comptes lus) garde sa propre fiche',async()=>{
 const {b,e,local}=await lotOuvert('lot-A',10);send(b,[resume()]);await tick();
 e.s.batch.id='lot-B';e.s.batch.scope.part=10;b.get('timing').syncBatch(true);send(b,[resume({seq:5})],'obs-3');await tick();
 deq(local.m.banane3FichesDepart.map(f=>[f.batchId,f.partie]),[['lot-A',10],['lot-B',10]]);
 await b.settle();
});
test('les exports recopient la fiche (`fichesDepart`) et le vidage du cache ne la supprime pas',async()=>{
 const {b,e,r,local}=await lotOuvert('lot-V',13);
 send(b,[resume()]);await tick();const avant=plat(local.m.banane3FichesDepart);assert.equal(avant.length,1);
 for(const a of ['journal-meta','dataset-meta'])deq((await b.api(a)).fichesDepart,avant,a);
 /* vidage manuel d'un lot arrêté : tout le journal part, la fiche reste */
 const st=b.store;st.deleteMany=async(nom,ids)=>{const g=new Set(ids);if(nom==='events')st.events=st.events.filter(x=>!g.has(x.eventId));else if(nom==='records')st.records=st.records.filter(x=>!g.has(x.recordId||x.id));else for(const i of ids)st.clouds.delete(i);return ids.length;};
 st.keys=async n=>n==='clouds'?[...st.clouds.keys()]:n==='events'?st.events.map(x=>x.eventId):st.records.map(x=>x.recordId||x.id);
 await b.api('stop');await Promise.allSettled([...r.pending]);b.get('obsFins').get('lot-V').at-=6000;
 const snap={at:Date.now(),ids:{events:st.events.map(x=>x.eventId),records:st.records.map(x=>x.recordId||x.id),clouds:[...st.clouds.keys()]},
  signatures:{events:Object.fromEntries(st.events.map(o=>[o.eventId,EC.signature(o)])),records:Object.fromEntries(st.records.map(o=>[o.recordId||o.id,EC.signature(o)]))}};
 assert.ok(st.events.some(x=>x.kind==='list-summary'),'le résumé est dans le journal avant le vidage');
 const out=await b.api('export-cache-clear',{ids:snap.ids,signatures:snap.signatures,manuel:true,exportAt:null,instantaneAt:snap.at});
 assert.equal(out.cleared,true);assert.ok(!st.events.some(x=>x.kind==='list-summary'),'le résumé du journal est parti avec le cache');
 deq(local.m.banane3FichesDepart,avant,'la fiche est intacte');deq((await b.api('journal-meta')).fichesDepart,avant,'et l’export suivant la porte encore');
 assert.equal(e.s.batch.state,'STOPPED');
});
test('sans fiche, les exports ne portent pas de champ `fichesDepart`',async()=>{
 const {b}=await lotOuvert();assert.equal((await b.api('journal-meta')).fichesDepart,undefined);deq(await b.api('fiches-depart'),{fiches:[]});await b.settle();
});
test('panneau : bloc « Départs des parties », CONTENU.txt et rafraîchissement ; la clé n’est jamais supprimée par le vidage',()=>{
 const html=lire('panel.html'),js=lire('panel.js'),bg=lire('background.js'),cache=lire('src/export-cache.js');
 assert.match(html,/Départs des parties<\/p>\s*<div id="departs-liste" class="departs[^"]*">/);
 assert.match(js,/Départs des parties \(\$\{f\.length\}\)/);assert.match(js,/corps:periode\+departs/);assert.match(js,/corps\+liste\.map/);assert.match(js,/function majDeparts/);
 assert.match(bg,/action==='fiches-depart'/);assert.match(bg,/noterDepart\(chrome\.storage\.local,fiche\)/);
 assert.ok(!/banane3FichesDepart|CLE_DEPARTS/.test(bg.slice(bg.indexOf('async function viderCacheExport'),bg.indexOf('async function viderCacheExport')+3000)),'le vidage ne cite jamais la clé');
 assert.match(cache,/CLE_DEPARTS = 'banane3FichesDepart'/);
});
