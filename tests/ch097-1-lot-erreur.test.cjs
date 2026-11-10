'use strict';
/* CH-097, défaut 1 — UN LOT EN ERREUR N'EST PLUS « OUVERT » pour l'éveil de l'écran ni pour la reconnexion après F5. Service worker RÉEL en VM.
 * Le moteur met le lot en ERROR et ne le reprend pas : rien ne tourne plus. Avant : l'écran restait tenu allumé sans fin, et un F5 était refusé avec
 * « lot ouvert : clique sur « Reprendre » », bouton qui n'existe pas pour un lot en erreur. Une seule liste d'états clos (plus de doublon).
 * Non touchés (décision de l'opérateur, voir le rapport) : la séance de l'observateur et le vidage du cache. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {production,memoire}=require('./helpers/perf-production.cjs');
const {background}=require('./helpers/background-harness.cjs'),K=require('../src/core.js'),Settings=require('../src/settings.js'),EC=require('../src/export-cache.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const lot=state=>({id:'L1',state,scope:{part:23,start:1,end:9},processed:[],deferred:[],skipped:[]});

async function eveil(){const b=production({local:memoire()}),appels=[];await b.api('view');
 b.ctx.chrome.power={requestKeepAwake:n=>appels.push('demande:'+n),releaseKeepAwake:()=>appels.push('relache')};
 const e=b.get('engine');e.s.mode='automatic-test';
 return {b,e,appels,maj:()=>b.get('eveilMaj()')};}

test('éveil : un lot en pause tient l’écran, le même lot passé en ERROR le relâche',async()=>{
 const {e,appels,maj}=await eveil();
 e.s.batch=lot('PAUSED');maj();assert.deepEqual(appels,['demande:display'],'lot en pause : écran tenu, comme avant');
 e.s.batch.state='ERROR';maj();assert.deepEqual(appels,['demande:display','relache'],'lot en erreur : relâché');
 maj();assert.equal(appels.length,2,'rien de plus');});

test('éveil : un lot déjà en ERROR au réveil ne demande rien ; un lot en cours demande toujours',async()=>{
 const {e,appels,maj}=await eveil();
 e.s.batch=lot('ERROR');maj();assert.deepEqual(appels,[]);
 e.s.batch=lot('RUNNING');maj();assert.deepEqual(appels,['demande:display']);});

test('observateur NON touché : la séance d’un lot en ERROR reste « lot:<id> » (choix laissé à l’opérateur)',async()=>{
 const {b,e}=await eveil();e.s.batch=lot('ERROR');assert.equal(b.get('seanceObservateur()'),'lot:L1');});

test('reconnexion après F5 : un lot en ERROR ne la refuse plus (ré-équipé, aucune commande ESV) ; un lot en pause la refuse toujours',async()=>{
 const COMMANDES=['capture','apply','restore','next','validate','skip','nextWithoutDecision','goToCut','validateInPlace','cancel','nativeStart','nativeResume'];
 const injected=[],b=background({globals:{BananeCore3:K,BananeSettings:Settings,BananeExportCache:EC,setTimeout,clearTimeout},executeScript:async o=>{injected.push(o);return [{frameId:0,result:o.func?null:undefined}];}});
 await b.api('connect',{tabId:1});const engine=b.fonction('engine');
 engine.s.batch=lot('PAUSED');assert.match(b.fonction('refusReconnexionAuto')(),/Reprendre/,'lot en pause : refus inchangé');
 engine.s.batch=lot('ERROR');assert.equal(b.fonction('refusReconnexionAuto')(),null,'lot en erreur : plus de refus « clique sur Reprendre »');
 const avant=injected.length,appels=b.adapter.calls.length;
 await b.tabUpdated(1,{status:'loading'});await b.tabUpdated(1,{status:'complete'});
 let v;for(let i=0;i<400;i++){v=(await b.api('view')).connection;if(v?.status==='ready')break;await sleep(5);}
 assert.equal(v?.status,'ready',JSON.stringify(v));
 assert.equal(injected.slice(avant).filter(o=>o.files?.includes('src/adapter-page.js')).length,1,'une injection de l’adaptateur');
 assert.deepEqual(b.adapter.calls.slice(appels).filter(x=>COMMANDES.includes(x)),[],'aucune commande ESV');
 assert.equal(engine.s.batch.state,'ERROR','le lot n’est ni relancé ni changé');});

test('une seule liste d’états clos dans le service worker (plus de doublon LOT_CLOS)',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
 assert.equal((src.match(/FINISHED_WITH_UNCONFIRMED_ACTIONS'\s*\]/g)||[]).length,1,'un seul littéral de la liste des trois états clos');
 assert.doesNotMatch(src,/\bLOT_CLOS\b/);
 const b=production({local:memoire()});
 assert.deepEqual([...b.get('OBS_CLOS')],['STOPPED','COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS'],'la liste « clos proprement » garde ses trois états (grâce, passe, relecture)');
 assert.deepEqual([...b.get('LOT_TERMINE')],['STOPPED','COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','ERROR']);});
