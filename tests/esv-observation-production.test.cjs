'use strict';
/* V1 (test 2) : rangement de l'observateur passif par le service worker
 * (background.js), production en VM. Journalisation seule : rien hors séance,
 * rien si le réglage est coupé, entrées revalidées (source non fiable), jamais
 * de décision, de pose ni de commande ESV modifiée. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);   // objets de VM différentes : comparés à plat
const {production,normalize}=require('./helpers/perf-production.cjs'),{SimulatedESV}=require('./fixtures.cjs');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const write=(o={})=>({seq:1,kind:'write',via:'xhr',urlClass:'rail-pair-write',method:'PUT',status:204,outcome:'done',attempt:1,railPairId:'traj__00+1.5/2.5',bodyKeys:12,
 body:{a:1.5,b:-2,RailType:'U50',SeenByOperator:true},startedEpochMs:1e12+10,endedEpochMs:1e12+180,durationMs:170,...o});
const list=(o={})=>({seq:2,kind:'list-page',status:200,outcome:'done',chars:1200000,rows:1000,counts:{valid:900,invalid:60,skipped:40},basis:'row-string-values',startedEpochMs:1e12,endedEpochMs:1e12+300,durationMs:300,...o});
const resource=(o={})=>({seq:3,kind:'resource',class:'point-resource',n:19,bytes:1500000,startedEpochMs:1e12,endedEpochMs:1e12+900,windowMs:250,...o});
const send=(b,entries,observer='obs-1',sender)=>b.raw({kind:'esv-observation',observer,entries},sender);
const stored=b=>b.store.events.filter(e=>e.type==='esv-observation');
/* Lot en cours posé directement (rapide) : seul l'état du lot compte pour la séance. */
async function seance(){const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');e.s.batch={id:'lot-obs',state:'RUNNING',scope:{part:23,start:100,end:101}};r.syncBatch(true);r.ensureVisit(b.adapter.identity);
 return {b,release(){}};}
const lotOuvert=seance;

test('séance = lot non clos ou session Écho active ; hors séance : accept:false, rien rangé',async()=>{
 const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});const e=b.get('engine');
 deq(send(b,[write()]).out,{accept:false,reason:'no-session'});assert.equal(stored(b).length,0,'avant tout lot');
 e.s.batch={id:'x',state:'RUNNING',scope:{part:23,start:100,end:101}};
 for(const [state,accepte] of [['RUNNING',true],['PAUSED',true],['ERROR',true],['PAUSED_ADAPTER_UNRESPONSIVE',true],['STOPPED',false],['COMPLETED',false],['FINISHED_WITH_UNCONFIRMED_ACTIONS',false]]){
  e.s.batch.state=state;const n=stored(b).length,r=send(b,[write({seq:n+1})]).out;assert.equal(r.accept,accepte,state);assert.equal(stored(b).length,n+(accepte?1:0),state);}
 e.s.batch.state='RUNNING';e.s.mode='observation';assert.equal(send(b,[write()]).out.accept,false,'mode Écho sans session : pas de séance');
});
test('séance : écriture, liste et points rangés avec contexte de lot ; revalidés champ par champ ; pas d’autre type d’événement',async()=>{
 const {b,release}=await lotOuvert(),before=b.store.events.length;
 const r=send(b,[write(),list(),resource(),{seq:4,kind:'gap',lost:3,reason:'ring-overflow'}]).out;deq(r,{accept:true,stored:4});
 const e=stored(b);deq(e.map(x=>x.kind),['write','list-page','resource','gap']);
 for(const x of e){assert.equal(x.schema,1);assert.equal(x.type,'esv-observation');assert.equal(typeof x.eventId,'string');assert.equal(x.observer.id,'obs-1');assert.equal(typeof x.receivedMs,'number');assert.ok(x.timeOrigin>1e12-1e9);
  assert.equal(x.batchId,b.get('engine').s.batch.id,'contexte de lot');assert.equal(x.sessionId,b.get('engine').s.sessionId);}
 deq([e[0].status,e[0].attempt,e[0].railPairId,e[0].body,e[0].durationMs],[204,1,'traj__00+1.5/2.5',{a:1.5,b:-2,RailType:'U50',SeenByOperator:true},170]);
 deq([e[1].rows,e[1].counts],[1000,{valid:900,invalid:60,skipped:40}]);deq([e[2].n,e[2].bytes],[19,1500000]);deq([e[3].lost,e[3].reason],[3,'ring-overflow']);
 assert.equal(b.store.events.length-before,4,'ni événement métier, ni état touché');release();await b.settle();
});
test('source non fiable : champs inconnus, types faux, URL, jeton et objets imbriqués jamais rangés',async()=>{
 const {b,release}=await lotOuvert();
 const bad={...write(),url:'https://esv.test/secret/rails/x?token=abc',authorization:'Bearer SECRET',status:'204',attempt:-1,method:'PUT'.repeat(5),outcome:'pirate',
  body:{ok:1,nested:{deep:1},arr:[1],tok:'Bearer '+'a'.repeat(60),'bad key':2,fine:true},railPairId:'../../etc/passwd',startedEpochMs:Infinity,durationMs:NaN,extra:{a:1}};
 send(b,[bad,null,7,'x',{seq:9,kind:'inconnu'},{seq:9,kind:'write',pad:'p'.repeat(6000)}]);
 const all=JSON.stringify(stored(b));for(const interdit of ['secret','token=abc','Bearer','SECRET','nested','passwd','authorization','pirate','esv.test'])assert.ok(!all.includes(interdit),interdit);
 const w=stored(b).find(x=>x.kind==='write');deq([w.status,w.attempt,w.method,w.outcome,w.railPairId,w.startedEpochMs,w.durationMs],[null,null,null,null,null,null,null]);deq(w.body,{ok:1,fine:true});
 assert.ok(stored(b).some(x=>x.kind==='gap'&&x.reason==='rejected'&&x.lost>=4),'les entrées refusées sont comptées, pas passées sous silence');release();await b.settle();
});
test('réglage observateurPassif.actif=false : accept:false, enabled:false, rien rangé',async()=>{
 const {b,release}=await lotOuvert();b.ctx.BananeSettings={...b.ctx.BananeSettings,observateurPassif:{actif:false}};
 deq(send(b,[write()]).out,{accept:false,enabled:false,reason:'setting-off'});assert.equal(stored(b).length,0);
 b.ctx.BananeSettings={...b.ctx.BananeSettings,observateurPassif:{actif:true}};assert.equal(send(b,[write()]).out.accept,true);release();await b.settle();
});
test('autre onglet ou autre page : ignoré sans réponse',async()=>{
 const {b,release}=await lotOuvert();
 for(const sender of [{id:'test',tab:{id:99},url:'https://esv.lidar.altametris.xyz/rails_validation/x'},{id:'test',tab:{id:1},url:'https://autre.test/rails_validation/x'},{id:'autre',tab:{id:1},url:'https://esv.lidar.altametris.xyz/rails_validation/x'}]){
  const r=send(b,[write()],'obs-1',sender);assert.equal(r.out,undefined);}
 assert.equal(stored(b).length,0);release();await b.settle();
});
test('bornes : message mal formé, par séance (jalon gap unique), écriture refusée par le stockage dite au message suivant',async()=>{
 const {b,release}=await lotOuvert();
 assert.equal(send(b,'pas un tableau').out.reason,'malformed');assert.equal(send(b,Array.from({length:101},()=>write())).out.reason,'malformed');assert.equal(stored(b).length,0);
 const put=b.store.putEvent.bind(b.store);let fail=true;b.store.putEvent=e=>fail&&e.type==='esv-observation'?Promise.reject(Error('disque')):put(e);
 send(b,[write()]);await new Promise(r=>setImmediate(r));fail=false;send(b,[write({seq:2})]);
 deq(stored(b).map(x=>[x.kind,x.reason]).filter(x=>x[0]==='gap'),[['gap','store-rejected']]);assert.equal(stored(b).find(x=>x.kind==='gap').lost,1);
 release();await b.settle();
});
test('plafond par séance : au-delà, un seul jalon gap « session-cap »',async()=>{
 const {b,release}=await lotOuvert();b.ctx.BananeSettings={...b.ctx.BananeSettings,observateurPassif:{actif:true,entreesParSeanceMax:3,caracteresParEntree:4096}};
 for(let i=0;i<3;i++)send(b,[resource({seq:i+1}),resource({seq:i+10})]);
 const e=stored(b);assert.equal(e.filter(x=>x.kind==='resource').length,3);assert.equal(e.filter(x=>x.kind==='gap'&&x.reason==='session-cap').length,1);release();await b.settle();
});
test('ni commande, ni pose, ni décision modifiées : lot identique avec et sans messages d’observation (avant, pendant, après)',async()=>{
 async function lot(avec){const adapter=new SimulatedESV();let release,entered;const reached=new Promise(r=>entered=r),barrier=new Promise(r=>release=r),capture=adapter.capture;let first=true;
  adapter.capture=async function(...a){if(first){first=false;entered();await barrier;}return capture.apply(this,a);};
  const b=production({adapter});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});if(avec)send(b,[write()]);
  await b.api('start',{part:23,start:100,end:102,...SCOPE});await reached;if(avec)for(let i=0;i<5;i++)send(b,[write({seq:i+1}),list({seq:i+7}),resource({seq:i+20})]);release();const view=await b.settle();if(avec)send(b,[write()]);
  return {b,view};}
 const a=await lot(false),c=await lot(true);
 deq(normalize(c.b.commands),normalize(a.b.commands),'mêmes commandes ESV, même ordre, mêmes arguments');deq(normalize(c.b.adapter.rails),normalize(a.b.adapter.rails),'mêmes poses');
 deq(c.b.adapter.calls,a.b.adapter.calls);deq(c.view.events.map(e=>e.type),a.view.events.map(e=>e.type),'état du moteur : aucun événement d’observation dans son journal en mémoire');assert.ok(!c.view.events.some(e=>e.type==='esv-observation'));assert.equal(c.view.batch.state,a.view.batch.state);deq(c.view.batch.processed.length,a.view.batch.processed.length);
 const types=b=>b.store.events.filter(e=>e.type!=='esv-observation').map(e=>e.type);deq(types(c.b),types(a.b),'mêmes événements métier et de mesure, dans le même ordre');
 assert.ok(stored(c.b).length>=15&&stored(a.b).length===0);const rec=b=>b.store.records.map(r=>[r.identity?.cut,r.status,r.validationProof??null,r.commandSent??null]);deq(rec(c.b),rec(a.b),'mêmes enregistrements (coupe, statut, preuve) : les identifiants sont aléatoires, donc écartés');
});
test('session Écho active (manuelle) : comptée comme séance ; session arrêtée : refus',async()=>{
 const b=production();await b.api('connect',{tabId:1});const m=b.get('manual');m.active=()=>true;assert.equal(send(b,[write()]).out.accept,true);m.active=()=>false;assert.equal(send(b,[write({seq:2})]).out.accept,false);
 assert.equal(stored(b).length,1);
});
