'use strict';
/* T20a (D-243, D-246, D-250) — HISTORIQUE DES PARTIES (`partsHistory`). Source : les fiches de départ (`banane3FichesDepart`, D-092) et une FICHE DE FIN
 * DE LOT persistante dans une clé à part (`banane55FinsLot` : posés, différés, repris à la main, écrits par la passe, durée, motif d'arrêt), jamais les
 * événements du cache (vidables). L'historique est complet après un vidage du cache ; la clé est recopiée par les exports (`finsLot`), comme les fiches
 * de départ. Module pur (src/historique-parties.js), puis service worker RÉEL (background.js) en VM, ESV simulé. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const {production,memoire}=require('./helpers/perf-production.cjs');
const EC=require('../src/export-cache.js');
const H=require('../src/historique-parties.js');
const VERSION=require('../manifest.json').version;
const tick=()=>new Promise(r=>setTimeout(r,5));
const CHAMPS=['part','batchId','startedAt','endedAt','version','depart','cibles','poses','differes','ecritsPasse','main','sautes','fin'];

test('module : fin du lot selon son état ; fiche de fin (posés, différés, repris à la main, durée, motif) ; jamais pour un lot ouvert',()=>{
 const lot=(state,extra={})=>({id:'L',state,startedAt:'2026-10-25T08:00:00.000Z',scope:{part:7,start:0,end:999999},processed:[{cut:1},{cut:2},{cut:2}],deferred:[{identity:{cut:3}}],
  manuallyCompleted:[{cut:4}],skipped:[{cut:8},{cut:8},{identity:{cut:9}}],...extra});
 assert.equal(H.finDe(lot('COMPLETED')),'complete');assert.equal(H.finDe(lot('FINISHED_WITH_UNCONFIRMED_ACTIONS')),'complete');
 assert.equal(H.finDe(lot('STOPPED',{stoppedAtEnd:{cut:9,reason:'last-cut',at:'2026-10-25T08:10:00.000Z'}})),'complete');
 assert.equal(H.finDe(lot('STOPPED')),'arretee');assert.equal(H.finDe(lot('ERROR')),'interrompue');
 for(const s of ['RUNNING','PAUSED','PAUSED_ADAPTER_UNRESPONSIVE','MANUAL_TAKEOVER'])assert.equal(H.finDe(lot(s)),'en-cours',s);
 assert.equal(H.ficheFin(lot('RUNNING'),{version:'v'}),null,'lot ouvert : aucune fiche de fin');
 const f=H.ficheFin(lot('STOPPED'),{version:'4.9.5.21',motif:'arret-manuel',at:'2026-10-25T08:30:00.000Z'});
 deq(f,{batchId:'L',part:7,version:'4.9.5.21',startedAt:'2026-10-25T08:00:00.000Z',endedAt:'2026-10-25T08:30:00.000Z',dureeMs:1800000,poses:2,differes:1,main:1,sautes:2,ecritsPasse:null,
  fin:'arretee',motif:'arret-manuel',etat:'STOPPED',finPartie:true});
 const g=H.ficheFin(lot('STOPPED',{stoppedAtEnd:{cut:9,reason:'partie-sans-rouge',at:'2026-10-25T08:10:00.000Z'}}),{version:'v'});
 assert.equal(g.endedAt,'2026-10-25T08:10:00.000Z','fin au dernier cut : son heure');assert.equal(g.motif,'partie-sans-rouge');assert.equal(g.fin,'complete');
});

test('module : ajout sans doublon (un lot = une fiche, mise à jour par champs connus), borné aux 200 plus récentes ; stockage abîmé toléré',async()=>{
 let l=H.ajouterFin([],{batchId:'A',poses:1,ecritsPasse:null});l=H.ajouterFin(l,{batchId:'A',ecritsPasse:5});
 deq(l,[{batchId:'A',poses:1,ecritsPasse:5}],'la passe complète la fiche du lot sans effacer le reste');
 let g=[];for(let i=0;i<230;i++)g=H.ajouterFin(g,{batchId:'b'+i});assert.equal(g.length,200);assert.equal(g[0].batchId,'b30');
 deq(H.ajouterFin('abîmé',{batchId:'x'}),[{batchId:'x'}]);deq(H.ajouterFin([null,{batchId:'y'}],null),[{batchId:'y'}]);
 deq(await H.lireFins({get:async()=>{throw Error('x');}}),[]);deq(await H.lireFins({get:async()=>({banane55FinsLot:'abîmé'})}),[]);
 assert.equal(H.CLE_FINS,'banane55FinsLot');
});

test('module : historique = fiches de départ + fiches de fin + lot en cours, plus récent d’abord, champs du contrat, null quand inconnu',()=>{
 const departs=[{at:'2026-10-25T07:00:00.000Z',batchId:'A',partie:5,version:'4.9.5.19',valides:90,invalides:10,ignores:0,total:100},
  {at:'2026-10-25T07:05:00.000Z',batchId:'A',partie:5,version:'4.9.5.19',valides:95,invalides:5,ignores:0,total:100},
  {at:'2026-10-25T08:00:00.000Z',batchId:'B',partie:6,version:'4.9.5.21',valides:1,invalides:2,ignores:null,total:3},
  {at:'2026-10-25T06:00:00.000Z',batchId:'echo:s1',partie:4,version:'4.9.5.19',valides:1,invalides:1,ignores:0,total:2},
  {at:'2026-10-25T09:00:00.000Z',batchId:'C',partie:8,version:'4.9.5.21',valides:3,invalides:4,ignores:0,total:7}];
 const fins=[{batchId:'A',part:5,version:'4.9.5.19',startedAt:'2026-10-25T07:00:01.000Z',endedAt:'2026-10-25T07:40:00.000Z',dureeMs:2399000,poses:8,differes:2,main:0,ecritsPasse:1,sautes:3,fin:'complete',motif:'last-cut',finPartie:true}];
 const courant={id:'C',state:'PAUSED',startedAt:'2026-10-25T09:00:02.000Z',scope:{part:8,start:100,end:200},processed:[{cut:101}],deferred:[],manuallyCompleted:[],skipped:[{cut:102},{identity:{cut:103}}]};
 const h=H.historique({departs,fins,courant,version:'4.9.5.21'});
 deq(h.map(x=>[x.batchId,x.fin]),[['C','en-cours'],['B','interrompue'],['A','complete']],'Écho (echo:…) n’est pas un lot ; plus récent d’abord');
 for(const x of h)deq(Object.keys(x).sort(),CHAMPS.slice().sort());
 deq(h[2],{part:5,batchId:'A',startedAt:'2026-10-25T07:00:01.000Z',endedAt:'2026-10-25T07:40:00.000Z',version:'4.9.5.19',depart:{valides:90,invalides:10,ignores:0,total:100},
  cibles:10,poses:8,differes:2,ecritsPasse:1,main:0,sautes:3,fin:'complete'},'départ = première fiche du lot ; cibles = invalides au départ d’un lot jusqu’à la fin de partie');
 deq(h[1],{part:6,batchId:'B',startedAt:'2026-10-25T08:00:00.000Z',endedAt:null,version:'4.9.5.21',depart:{valides:1,invalides:2,ignores:null,total:3},cibles:null,poses:null,differes:null,ecritsPasse:null,main:null,sautes:null,fin:'interrompue'});
 deq(h[0],{part:8,batchId:'C',startedAt:'2026-10-25T09:00:02.000Z',endedAt:null,version:'4.9.5.21',depart:{valides:3,invalides:4,ignores:0,total:7},cibles:null,poses:1,differes:0,ecritsPasse:null,main:0,sautes:2,fin:'en-cours'},
  'lot borné : cibles inconnues');
 deq(H.historique({departs:'abîmé',fins:null,courant:null}),[]);
 /* Fiche écrite avant le champ (ancienne version) : « sautes » inconnu vaut null, jamais 0 ; une valeur 0 écrite reste 0. */
 assert.equal(H.historique({fins:[{batchId:'Z',part:1,fin:'complete',poses:4}]})[0].sautes,null);assert.equal(H.historique({fins:[{batchId:'Z',part:1,fin:'complete',sautes:0}]})[0].sautes,0);
 assert.equal(H.historique({fins:[{batchId:'Z',part:1,fin:'complete',sautes:'x'}]})[0].sautes,null,'valeur abîmée : null');
 /* Une fiche écrite sur une erreur ne cache pas un lot qui a repris : le lot vivant passe devant. */
 const repris=H.historique({departs,fins:[...fins,{batchId:'C',fin:'interrompue',poses:0,endedAt:'2026-10-25T09:10:00.000Z',finPartie:false}],courant,version:'4.9.5.21'});
 deq([repris[0].fin,repris[0].endedAt,repris[0].poses],['en-cours',null,1]);
});

/* Service worker réel : lot ouvert (comme tests/d092-fiche-depart.test.cjs), fiche de départ, arrêt, export, vidage du cache. */
const resume=(o={})=>({seq:1,kind:'list-summary',listKey:'traj__liste',pages:10,okPages:10,rows:7739,chars:11000000,counts:{valid:7602,invalid:137,skipped:0},
 firstStartedEpochMs:Date.now()-300,lastEndedEpochMs:Date.now()-100,durationMs:200,beforeSession:true,...o});
const send=(b,entries,observer='obs-1')=>b.raw({kind:'esv-observation',observer,entries}).out;
async function lotOuvert(id='lot-H',partie=13){const local=memoire(),b=production({local});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');
 e.s.batch={id,state:'RUNNING',step:'capture',startedAt:new Date(Date.now()-60000).toISOString(),scope:{part:partie,start:0,end:999999},
  processed:[{cut:3,key:'k3'},{cut:4,key:'k4'}],skipped:[{cut:6,key:'k6'}],paused:[],interrupted:[],sequence:[],deferred:[{identity:{part:partie,cut:5}}],manuallyCompleted:[]};
 r.syncBatch(true);r.ensureVisit(b.adapter.identity);return {b,e,r,local};}

test('service worker : lot en cours puis arrêté ; fiche de fin persistante ; exports (`finsLot`) ; historique complet après le vidage du cache',async()=>{
 const {b,e,r,local}=await lotOuvert('lot-H',13);
 send(b,[resume()]);await tick();
 let h=(await b.api('view')).partsHistory;assert.equal(h.length,1);
 deq({...h[0],startedAt:typeof h[0].startedAt},{part:13,batchId:'lot-H',startedAt:'string',endedAt:null,version:VERSION,depart:{valides:7602,invalides:137,ignores:0,total:7739},cibles:137,
  poses:2,differes:1,ecritsPasse:null,main:0,sautes:1,fin:'en-cours'});
 assert.equal(local.m.banane55FinsLot,undefined,'lot ouvert : pas encore de fiche de fin');
 await b.api('stop');await Promise.allSettled([...r.pending]);await tick();
 const fins=plat(local.m.banane55FinsLot);assert.equal(fins.length,1);
 deq({...fins[0],startedAt:typeof fins[0].startedAt,endedAt:typeof fins[0].endedAt,dureeMs:Number.isFinite(fins[0].dureeMs)&&fins[0].dureeMs>=59000},
  {batchId:'lot-H',part:13,version:VERSION,startedAt:'string',endedAt:'string',dureeMs:true,poses:2,differes:1,main:0,sautes:1,ecritsPasse:null,fin:'arretee',motif:'arret-manuel',etat:'STOPPED',finPartie:true});
 h=(await b.api('view')).partsHistory;assert.equal(h[0].fin,'arretee');assert.equal(h[0].endedAt,fins[0].endedAt);
 for(const a of ['journal-meta','dataset-meta'])deq((await b.api(a)).finsLot,fins,a+' recopie la fiche de fin');
 /* Vidage du cache (manuel, lot arrêté) : tout le journal part ; l'historique reste entier. */
 const st=b.store;st.deleteMany=async(nom,ids)=>{const g=new Set(ids);if(nom==='events')st.events=st.events.filter(x=>!g.has(x.eventId));else if(nom==='records')st.records=st.records.filter(x=>!g.has(x.recordId||x.id));else for(const i of ids)st.clouds.delete(i);return ids.length;};
 st.keys=async n=>n==='clouds'?[...st.clouds.keys()]:n==='events'?st.events.map(x=>x.eventId):st.records.map(x=>x.recordId||x.id);
 b.get('obsFins').get('lot-H').at-=6000;
 const snapC={at:Date.now(),ids:{events:st.events.map(x=>x.eventId),records:st.records.map(x=>x.recordId||x.id),clouds:[...st.clouds.keys()]},
  signatures:{events:Object.fromEntries(st.events.map(o=>[o.eventId,EC.signature(o)])),records:Object.fromEntries(st.records.map(o=>[o.recordId||o.id,EC.signature(o)]))}};
 const avant=plat((await b.api('view')).partsHistory);
 const out=await b.api('export-cache-clear',{ids:snapC.ids,signatures:snapC.signatures,manuel:true,exportAt:null,instantaneAt:snapC.at});assert.equal(out.cleared,true);
 assert.equal(st.events.length,0,'le journal est vidé');
 deq((await b.api('view')).partsHistory,avant,'historique identique après le vidage du cache');
 /* Un nouveau lot : l'ancien reste, le nouveau passe devant. */
 e.s.batch={id:'lot-I',state:'RUNNING',step:'capture',startedAt:new Date().toISOString(),scope:{part:14,start:10,end:20},processed:[],skipped:[],paused:[],interrupted:[],sequence:[],deferred:[],manuallyCompleted:[]};
 h=(await b.api('view')).partsHistory;deq(h.map(x=>[x.batchId,x.fin]),[['lot-I','en-cours'],['lot-H','arretee']]);
 e.s.batch.state='STOPPED';await b.api('stop').catch(()=>{});await e.save();await tick();
});

test('service worker : la deuxième passe complète la fiche de fin de son lot (écrits par la passe)',async()=>{
 const {b,e,local}=await lotOuvert('lot-P',13);
 e.s.batch.state='COMPLETED';await e.save();await tick();
 assert.equal(local.m.banane55FinsLot[0].fin,'complete');assert.equal(local.m.banane55FinsLot[0].ecritsPasse,null);
 const vue={lotId:'lot-P',mode:'ecriture',etat:'ecriture',differes:3,posees:2,demandees:2,ecrites:0,cut:null,message:null};
 await b.get('passeDiffSuivre')(vue,(async()=>{vue.ecrites=2;})());await b.get('passeDiff').cours;await tick();
 assert.equal(local.m.banane55FinsLot[0].ecritsPasse,2);assert.equal(local.m.banane55FinsLot[0].poses,2,'le reste de la fiche est gardé');
 assert.equal((await b.api('view')).partsHistory[0].ecritsPasse,2);
});
