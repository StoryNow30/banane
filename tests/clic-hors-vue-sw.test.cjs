'use strict';
/* D-157 — garde-fou `clic-hors-vue`, côté pont et service worker. La page relève, APRÈS la réponse d'une application ou d'une
 * restauration, chaque clic de pose calculé hors de la partie visible du canevas ; le pont le relaie ; le service worker le range
 * au journal sans rien changer d'autre (ni décision, ni commande, ni fenêtre d'événements du moteur), avec un poids sobre :
 *  - un compteur par lot (`batch.clicsHorsVue.total`), et un bilan au journal à la fin du lot s'il y en a eu ;
 *  - les cinq premiers clics du lot en exemples (`clic-hors-vue`, un événement par relevé, total courant) ; au-delà, compter seulement.
 * Hors lot (Écho, pose assistée) : même chose, compteur de la vie du service worker. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {production}=require('./helpers/perf-production.cjs'),{SimulatedESV,K}=require('./fixtures.cjs');
/* L'adresse d'ESV n'est écrite nulle part ici : elle est lue dans background.js. */
const ORIGINE=fs.readFileSync(path.join(__dirname,'..','background.js'),'utf8').match(/u\.origin==='([^']+)'/)[1];
const ESV={id:'test',tab:{id:1},url:ORIGINE+'/rails_validation/test'};
const clic=(n=1)=>({cote:'left',chemin:'directe',raison:'hors-canevas',ndc:[-7.12,.21],client:[-2300.4,500.2],essai:n,lecture:'rapide'});
const releve=(cut,clics,extra={})=>({kind:'clic-hors-vue',releve:{requestId:'r'+cut,action:'apply',mode:'tel-quel',identity:{part:23,cut},clics,...extra}});
const tick=()=>new Promise(r=>setImmediate(r));
const ev=b=>b.store.events.filter(e=>e.type==='clic-hors-vue');
async function sw(){const b=production({adapter:new SimulatedESV()});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});return b;}

test('pont : le relevé part au service worker, sans toucher les réponses en attente ; canal étranger ignoré',()=>{
 const {bridge}=require('./helpers/bridge.cjs'),b=bridge();
 const c=b.command('apply');b.deliver(c,{kind:'banane3:result',result:{rails:{}}});
 b.emit({kind:'banane3:clic-hors-vue',channel:c.request.channel,requestId:c.request.id,releve:{action:'apply',clics:[clic()]}});
 assert.deepEqual(Object.keys(c.replies[0]).sort(),['diagnostic','result']);
 const t=b.traces.filter(x=>x.kind==='clic-hors-vue');assert.equal(t.length,1);assert.equal(t[0].releve.clics[0].raison,'hors-canevas');
 b.emit({kind:'banane3:clic-hors-vue',channel:'autre',releve:{action:'apply',clics:[clic()]}});
 assert.equal(b.traces.filter(x=>x.kind==='clic-hors-vue').length,1,'canal étranger ignoré');
});

test('service worker, dans un lot : compteur du lot, cinq premiers exemples, bilan à la fin du lot (une fois)',async()=>{
 const b=await sw(),engine=b.get('engine');
 engine.s.batch={id:'lot-essai',state:'RUNNING',scope:{part:23},processed:[],skipped:[]};
 for(const cut of [100,101,102,103])b.raw(releve(cut,[clic(1),clic(2)]),ESV);await tick();
 const e=ev(b);
 assert.deepEqual(e.map(x=>x.exemples.length),[2,2,1],'cinq exemples, pas plus');
 assert.deepEqual(e.map(x=>x.total),[2,4,6],'total courant du lot');
 assert.ok(e.every(x=>x.batchId==='lot-essai'&&x.mode==='tel-quel'&&x.action==='apply'));
 assert.deepEqual(e.map(x=>x.identity.cut),[100,101,102]);
 assert.deepEqual({...engine.s.batch.clicsHorsVue},{total:8,exemples:5});
 engine.s.batch.state='COMPLETED';b.get('marquerFinLot')(engine.s.batch,'fin-naturelle');b.get('marquerFinLot')(engine.s.batch,'fin-naturelle');await tick();
 const bilans=b.store.events.filter(x=>x.type==='clic-hors-vue-bilan');
 assert.equal(bilans.length,1,'un bilan par lot');assert.equal(bilans[0].batchId,'lot-essai');assert.equal(bilans[0].total,8);assert.equal(bilans[0].exemples,5);
});

test('service worker : lot sans clic hors vue : aucun bilan (aucun événement = aucun clic hors vue)',async()=>{
 const b=await sw(),engine=b.get('engine');engine.s.batch={id:'lot-propre',state:'RUNNING',scope:{part:23},processed:[],skipped:[]};
 engine.s.batch.state='COMPLETED';b.get('marquerFinLot')(engine.s.batch,'fin-naturelle');await tick();
 assert.equal(b.store.events.filter(x=>/^clic-hors-vue/.test(x.type)).length,0);
});

test('service worker, hors lot : exemples et compteur à part ; champs revérifiés ; autre onglet, relevé vide ou journal en panne : rien ne lève',async()=>{
 const b=await sw();
 b.raw(releve(7,[{...clic(),ndc:[Infinity,1],client:['x',2],raison:'<script>'.repeat(40),secret:'non'}],{batchId:'faux',mode:'tel-quel'}),ESV);await tick();
 const [e]=ev(b);assert.equal(e.batchId,null);assert.equal(e.total,1);
 const x=e.exemples[0];assert.equal(x.ndc,null,'nombres non finis : absents');assert.equal(x.client,null);assert.ok(x.raison.length<=40);assert.equal('secret' in x,false);
 b.raw(releve(8,[clic()]),{...ESV,tab:{id:99}});b.raw(releve(9,[]),ESV);b.raw({kind:'clic-hors-vue',releve:null},ESV);await tick();
 assert.equal(ev(b).length,1,'autre onglet, relevé vide ou illisible : ignorés');
 b.store.putEvent=async()=>{throw Error('stockage plein');};
 assert.doesNotThrow(()=>b.raw(releve(10,[clic()]),ESV));await tick();
});

/* Un petit lot réel (service worker, moteur et GCV1 réels, ESV simulé) : avec des relevés pendant chaque application, les décisions,
 * les commandes à ESV et les événements du moteur sont ceux du même lot sans relevé. */
class EsvReleve extends SimulatedESV{async apply(before,proposals){const r=await super.apply(before,proposals);if(this.envoyer)this.envoyer(releve(before.identity.cut,[clic()]));return r;}}
async function petitLot(avecReleves){
 const adapter=new EsvReleve(),b=production({adapter});const S={...b.ctx.BananeSettings};S.voiePrediteOmbre={...S.voiePrediteOmbre,actif:false};b.ctx.BananeSettings=S;
 if(avecReleves)adapter.envoyer=m=>b.raw(m,ESV);
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'});
 await b.settle();await tick();return b;}
const neutre=x=>JSON.parse(JSON.stringify(x).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>').replace(/"(capturedAt|engineMs|ms|durationMs|elapsedMs|at|t)":[^,}]+/g,'"$1":0'));
test('un lot avec relevés : mêmes décisions, mêmes commandes, mêmes événements du moteur que sans relevé',async()=>{
 const a=await petitLot(false),b=await petitLot(true);
 assert.deepEqual(neutre(b.commands),neutre(a.commands),'commandes à ESV');
 assert.deepEqual(b.adapter.calls,a.adapter.calls);
 const metier=x=>x.store.events.filter(e=>!['clic-hors-vue','clic-hors-vue-bilan','phase-timing','phase-timing-pli','adapter-progress','b1-ombre','regles-metier-ombre','voie-predite-ombre'].includes(e.type)).map(e=>e.type);
 assert.deepEqual(metier(b),metier(a),'événements du moteur');
 const decisions=x=>neutre(x.store.events.filter(e=>e.type==='gcv1-shadow-observed').map(e=>e.lotObservation?.command??null));
 assert.deepEqual(decisions(b),decisions(a));
 assert.ok(ev(b).length>=1);assert.equal(ev(a).length,0);
 assert.equal(b.store.events.filter(e=>e.type==='clic-hors-vue-bilan').at(-1)?.total,b.adapter.calls.filter(c=>c==='apply').length,'bilan du lot : un clic par application');
});
