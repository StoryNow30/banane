'use strict';
/* V2 (D-079, ajout de Mic) — vidage du cache des exports. Service worker RÉEL
 * (background.js, mesure V1 réelle, ESV simulé) et panneau RÉEL (panel.js) avec
 * un faux stockage. Frontière : IndexedDB clouds/events/records = cache d'export ;
 * l'état du moteur et du lot n'est jamais touché (src/export-cache.js). */
const {test}=require('node:test'),assert=require('node:assert/strict');

const {production}=require('./helpers/perf-production.cjs');
const EC=require('../src/export-cache.js'),X=require('../src/native-export.js'),Z=require('../src/zip-writer.js');
const Settings=require('../src/settings.js'),GCV1=require('../src/gcv1-export.js');
const {panneau}=require('../tools/audit-qualite-480.cjs');
const A=require('../tools/acceptance-report.cjs');

/* ---------- service worker réel ---------- */
async function sw(){
  const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  const mem={};Object.assign(b.ctx.chrome.storage.local,{get:async k=>typeof k==='string'?(k in mem?{[k]:structuredClone(mem[k])}:{}):{},set:async o=>{for(const k of Object.keys(o))mem[k]=structuredClone(o[k]);}});
  const st=b.store;
  st.deleteMany=async(nom,ids)=>{const g=new Set(ids);
    if(nom==='events')st.events=st.events.filter(e=>!g.has(e.eventId));else if(nom==='records')st.records=st.records.filter(r=>!g.has(r.recordId||r.id));else for(const i of ids)st.clouds.delete(i);return ids.length;};
  st.keys=async n=>n==='clouds'?[...st.clouds.keys()]:n==='events'?st.events.map(e=>e.eventId):st.records.map(r=>r.recordId||r.id);
  st.events.length=0;st.records.length=0;
  const e=b.get('engine'),r=b.get('timing');
  e.s.batch={id:'lot-1',state:'STOPPED',stoppedAtEnd:{cut:101,applied:true},scope:{part:7,start:100,end:101}};r.syncBatch(true);r.batch.closed=true;await Promise.allSettled([...r.pending]);
  for(let i=0;i<4;i++){st.events.push({eventId:'e'+i,type:'x',batchId:'lot-1'});st.records.push({recordId:'r'+i,identity:{part:7,cut:100+i}});st.clouds.set('c'+i,{captureId:'c'+i,pointsSceneRelative:[[0,0,0]]});}
  const evFixes=st.events.length;
  const sigs=()=>({events:Object.fromEntries(st.events.map(o=>[o.eventId,EC.signature(o)])),records:Object.fromEntries(st.records.map(o=>[o.recordId||o.id,EC.signature(o)]))});
  return {b,e,r,st,mem,sigs,ids:()=>({events:st.events.map(x=>x.eventId),records:st.records.map(x=>x.recordId),clouds:[...st.clouds.keys()]}),evFixes};
}

test('lot RUNNING, en pause, repris à la main ou en erreur : vidage refusé, rien n’est supprimé',async()=>{
  const x=await sw(),ids=x.ids();
  for(const etat of ['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','MANUAL_TAKEOVER','ERROR']){
    x.e.s.batch={...x.e.s.batch,state:etat};
    await assert.rejects(x.b.api('export-cache-clear',{ids,signatures:x.sigs()}),/Vidage refusé : un lot n’est pas terminé/,etat);
    assert.equal((await x.b.api('export-cache-info')).refus!==null,true,etat);
  }
  assert.deepEqual(x.ids(),ids);assert.equal(x.mem[EC.CLE],undefined,'aucun marqueur écrit');
});

test('clôture V1 non terminée, action en cours, Écho actif : vidage refusé',async()=>{
  const x=await sw(),ids=x.ids();
  x.r.batch.closed=false;await assert.rejects(x.b.api('export-cache-clear',{ids,signatures:x.sigs()}),/clôture de la mesure V1/);x.r.batch.closed=true;
  x.e.busy=true;await assert.rejects(x.b.api('export-cache-clear',{ids,signatures:x.sigs()}),/travaille encore/);x.e.busy=false;
  x.e.s.collection='READY_FOR_AFTER';await assert.rejects(x.b.api('export-cache-clear',{ids,signatures:x.sigs()}),/capture est en cours/);x.e.s.collection='IDLE';
  assert.deepEqual(x.ids(),ids);
});

test('export puis vidage : seul ce qui a été exporté part ; état du lot intact ; marqueur et bilan à jour',async()=>{
  const x=await sw(),exporte=x.ids(),sig0=x.sigs(),avant=JSON.stringify(x.e.s);
  // Une écriture arrive après l'instantané de l'export : elle n'a pas été exportée, elle reste.
  x.st.events.push({eventId:'e-tard',type:'x',batchId:'lot-1'});
  const meta0=await x.b.api('dataset-meta');assert.equal(meta0.exportPeriod.previousDataCleared,null);assert.equal(meta0.exportPeriod.startedAt,null);
  const out=await x.b.api('export-cache-clear',{ids:exporte,signatures:sig0,exportAt:'2026-10-07T09:00:00.000Z',auto:true});
  assert.equal(out.cleared,true);assert.deepEqual([out.events,out.records,out.clouds],[exporte.events.length,4,4]);
  const reste=x.ids();assert.ok(reste.events.includes('e-tard'),'écrit après l’instantané : gardé');assert.ok(!reste.events.some(id=>exporte.events.includes(id)));
  assert.deepEqual([reste.records.length,reste.clouds.length],[0,0]);
  assert.equal(JSON.stringify(x.e.s),avant,'état du moteur et du lot : octet pour octet');
  assert.equal(x.e.s.batch.state,'STOPPED');
  // Le second export ne contient que la suite.
  const second=await x.b.api('dataset');assert.ok(second.events.some(e=>e.eventId==='e-tard'));assert.ok(!second.events.some(e=>exporte.events.includes(e.eventId)),'second export : seulement la suite');assert.equal(second.records.length,0);
  const meta=await x.b.api('dataset-meta');
  assert.equal(meta.exportPeriod.previousDataCleared.text,'données précédentes vidées après export du 2026-10-07T09:00:00.000Z');
  assert.ok(meta.exportPeriod.startedAt);assert.equal(meta.exportPeriod.previousDataCleared.counts.events,exporte.events.length);
  // La mesure V1 du lot vidé ne réclame plus sa santé : pas d'export « incomplet » à vie.
  assert.ok(!(meta.v1TimingExport.lots||[]).some(l=>l.batchId==='lot-1'),'lot vidé retiré de la mesure V1 exportée');
  assert.ok(meta.v1TimingExport.lotsVidesDuCache.includes('lot-1'));
  // Les outils relisent un bilan portant exportPeriod.
  assert.equal(A.kindOf({format:'banane-test-dataset-v4',state:{batch:{}},exportPeriod:meta.exportPeriod}),'bilan');
});

test('sessions Écho/Correction conservées : leurs données ne sont pas vidées',async()=>{
  const x=await sw();x.e.s.native={id:'n1',status:'FINISHED',cloudIds:['c1']};
  x.st.records[1].nativeSessionId='n1';x.st.events.find(e=>e.eventId==='e2').nativeSessionId='n1';
  const out=await x.b.api('export-cache-clear',{ids:x.ids(),signatures:x.sigs()});
  assert.deepEqual([out.records,out.clouds],[3,3]);
  const reste=x.ids();assert.ok(reste.events.includes('e2'));assert.deepEqual([reste.records,reste.clouds],[['r1'],['c1']]);
});

/* ---------- panneau réel ---------- */
function jeu(n=3){return {clouds:new Map(Array.from({length:n},(_,i)=>['cap-'+i,{format:'banane-native-lidar-capture-v2',captureId:'cap-'+i,identity:{part:7,cut:100+i},pointsSceneRelative:[[i,1,2],[3,4,5]],trace:{pointsSaved:2}}])),
  events:Array.from({length:20},(_,i)=>({eventId:'e'+i,eventSeq:i,type:'x',batchId:i<10?'lot-A':'lot-B'})),records:Array.from({length:n},(_,i)=>({recordId:'r'+i,visitIndex:i,identity:{part:7,cut:100+i}}))};}
async function ouvrir({etatLot='STOPPED',downloads='complete',confirmer=true,refus=null,refusClear=null,reglages={},reponsesPlus={}}={}){
  const data=jeu(),appels=[],confirmations=[];
  const store={all:async n=>structuredClone(n==='events'?data.events:n==='records'?data.records:[]),keys:async n=>n==='clouds'?[...data.clouds.keys()]:n==='events'?data.events.map(e=>e.eventId):data.records.map(r=>r.recordId),
    getCloud:async id=>structuredClone(data.clouds.get(id))};
  const diagnostic={format:'banane-gcv1-diagnostic-v1',version:'4.9.0.2',sessionId:'s',observationCount:3,observations:[...data.clouds.keys()].map(id=>({lidar:{captureId:id}}))};
  const meta={format:'banane-test-dataset-v4',version:'4.9.0.2',exportedAt:'2026-10-07T07:58:00.000Z',state:{batch:{id:'lot-A'}},cloudIds:[...data.clouds.keys()]};
  const globals={BananeStorage3:class{constructor(){return store;}},BananeExportCache:EC,BananeSettings:{...Settings,export:{...Settings.export,viderApresExport:true,...reglages}},BananeNativeExport:X,BananeZip:Z,
    BananeGCV1Export:{buildDiagnostic:()=>diagnostic,buildCorpusPlan:GCV1.buildCorpusPlan},confirm:t=>{confirmations.push(t);return confirmer;}};
  const chromeExtra=downloads?{downloads:{download:async()=>7,search:async()=>[{state:downloads,error:downloads==='interrupted'?'USER_CANCELED':undefined}],onChanged:{addListener(){},removeListener(){}}}}:{};
  const state={current:{identity:{part:7,cut:100}},batch:{state:etatLot,scope:{part:7,start:100,end:102},processed:[],deferred:[],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:[],activeIdentity:null}};
  const p=await panneau(state,{globals,chromeExtra,reponses:{'dataset-meta':meta,'journal-meta':{...meta,format:'banane-test-journal-v4',cloudIds:undefined},'gcv1-export-meta':{version:'4.9.0.2'},cloud:null,
    'export-cache-info':()=>({refus,marqueur:null}),
    'export-cache-clear':a=>{appels.push(a);if(refusClear)throw Error(refusClear);return {cleared:true,events:a.ids.events.length,records:a.ids.records.length,clouds:a.ids.clouds.length};},...reponsesPlus}});
  return {p,data,appels,confirmations};
}

test('export confirmé complet : le cache est vidé, avec exactement les clés présentes au début de l’export',async()=>{
  const t=await ouvrir();await t.p.$('export-tout').onclick();await t.p.attendre();
  const statut=t.p.$('export-status').textContent;
  assert.equal(t.appels.length,1,statut);assert.doesNotMatch(statut,/incomplet|NON vidé/);assert.match(statut,/Cache d’export vidé \(20 événements, 3 visites, 3 nuages\)/);
  assert.equal(Object.keys(t.appels[0].signatures.events).length,20);assert.deepEqual(JSON.parse(JSON.stringify(t.appels[0].ids)),{events:t.data.events.map(e=>e.eventId),records:['r0','r1','r2'],clouds:['cap-0','cap-1','cap-2']});
  assert.ok(t.appels[0].exportAt);assert.equal(t.p.downloads.length,1,'un seul zip');
});

test('téléchargement interrompu ou annulé : RIEN n’est vidé, message clair',async()=>{
  for(const etat of ['interrupted']){
    const t=await ouvrir({downloads:etat});await t.p.$('export-tout').onclick();await t.p.attendre();
    assert.equal(t.appels.length,0,'aucun vidage');assert.match(t.p.$('export-status').textContent,/non enregistré|interrompu/);assert.match(t.p.$('export-status').textContent,/NON vidé/);
  }
});

test('téléchargement non vérifiable (pas de chrome.downloads) : rien n’est vidé',async()=>{
  const t=await ouvrir({downloads:null});await t.p.$('export-tout').onclick();await t.p.attendre();
  assert.equal(t.appels.length,0);assert.match(t.p.$('export-status').textContent,/NON vidé/);
});

test('export avec une erreur (corpus illisible) : rien n’est vidé',async()=>{
  const t=await ouvrir();
  // Un nuage du plan manque dans le stockage au moment de l'écriture.
  t.data.clouds.set('cap-1',null);
  await t.p.$('export-tout').onclick();await t.p.attendre();
  assert.equal(t.appels.length,0);assert.match(t.p.$('export-status').textContent,/Export incomplet/);assert.match(t.p.$('export-status').textContent,/NON vidé/);
});

test('refus du service worker au moment du vidage : l’export reste enregistré, le message dit que le cache n’est pas vidé',async()=>{
  const t=await ouvrir({refusClear:'Vidage refusé : un lot n’est pas terminé (RUNNING)'});await t.p.$('export-tout').onclick();await t.p.attendre();
  const st=t.p.$('export-status').textContent;assert.equal(t.appels.length,1);assert.match(st,/Cache d’export non vidé : .*Vidage refusé/);assert.doesNotMatch(st,/incomplet/);
});

test('bouton « Vider le cache des exports » : désactivé tant qu’un lot est actif ; actif lot terminé',async()=>{
  for(const etat of ['RUNNING','PAUSED','MANUAL_TAKEOVER','ERROR']){const t=await ouvrir({etatLot:etat});assert.equal(t.p.$('export-cache-clear').disabled,true,etat);}
  const t=await ouvrir({etatLot:'STOPPED'});assert.equal(t.p.$('export-cache-clear').disabled,false);
});

test('vidage manuel : le service worker refuse => erreur, rien n’est supprimé ni demandé',async()=>{
  const t=await ouvrir({refus:'un lot n’est pas terminé (RUNNING) : arrête-le ou termine-le d’abord'});
  await t.p.$('export-cache-clear').onclick();await t.p.attendre();
  assert.equal(t.appels.length,0);assert.equal(t.confirmations.length,0);assert.ok(t.p.notes.some(n=>/Vidage impossible : un lot n’est pas terminé/.test(n)));
});

test('vidage manuel : confirmation chiffrée et irréversible ; refusée = rien ; acceptée = vidage des clés affichées',async()=>{
  const non=await ouvrir({confirmer:false});await non.p.$('export-cache-clear').onclick();await non.p.attendre();
  assert.equal(non.confirmations.length,1);assert.equal(non.appels.length,0,'confirmation refusée : rien');
  const txt=non.confirmations[0];
  assert.match(txt,/2 lot\(s\)/);assert.match(txt,/3 coupe\(s\)/);assert.match(txt,/3 visites, 20 événements, 3 nuages LiDAR/);assert.match(txt,/environ .* Mo \(estimation\)/);assert.match(txt,/IRRÉVERSIBLE/);
  assert.match(txt,/état du lot, les réglages et la reprise ne sont pas touchés/);
  const oui=await ouvrir({confirmer:true});await oui.p.$('export-cache-clear').onclick();await oui.p.attendre();
  assert.equal(oui.appels.length,1);assert.equal(oui.appels[0].manuel,true);assert.deepEqual(oui.appels[0].ids.clouds,['cap-0','cap-1','cap-2']);
  assert.match(oui.p.$('export-status').textContent,/Cache des exports vidé : 20 événements, 3 visites, 3 nuages/);
});

test('réglage viderApresExport=false : l’export n’est jamais suivi d’un vidage',async()=>{
  assert.equal(Settings.export.viderApresExport,false,'vidage automatique : DÉFAUT FAUX');
  const t=await ouvrir({reglages:{viderApresExport:false}});await t.p.$('export-tout').onclick();await t.p.attendre();
  assert.equal(t.appels.length,0);assert.equal(t.p.downloads.length,1);
});

/* ---------- corrections de relecture (V2R) ---------- */
test('enregistrement modifié après l’instantané : JAMAIS supprimé, dit dans le message ; les autres partent',async()=>{
  const x=await sw(),ids=x.ids(),sig=x.sigs();
  x.st.records.find(r=>r.recordId==='r1').serverConfirmed=true;           // modifié après l'instantané
  x.st.events.find(e=>e.eventId==='e2').late=true;
  const out=await x.b.api('export-cache-clear',{ids,signatures:sig,exportAt:'2026-10-07T09:00:00.000Z',auto:true});
  assert.deepEqual([...out.modifies.records],['r1']);assert.deepEqual([...out.modifies.events],['e2']);
  const reste=x.ids();assert.deepEqual(reste.records,['r1']);assert.ok(reste.events.includes('e2'));assert.equal(out.records,3);
  assert.equal(x.st.records[0].serverConfirmed,true,'la version modifiée est intacte');
});

test('instantané sans signatures : vidage refusé, rien supprimé',async()=>{
  const x=await sw(),ids=x.ids();
  await assert.rejects(x.b.api('export-cache-clear',{ids,exportAt:'x',auto:true}),/sans signatures/);
  assert.deepEqual(x.ids(),ids);assert.equal(x.mem[EC.CLE],undefined);
});

test('STOPPED n’est pas terminé : auto refusé tant que stoppedAtEnd absent ; manuel permis avec avertissement « reprenable »',async()=>{
  const x=await sw(),ids=x.ids(),signatures=x.sigs();delete x.e.s.batch.stoppedAtEnd;
  await assert.rejects(x.b.api('export-cache-clear',{ids,signatures,exportAt:'x',auto:true}),/pas terminé.*repris/);
  assert.deepEqual(x.ids(),ids);
  const info=await x.b.api('export-cache-info');assert.equal(info.refus,null);assert.equal(info.reprenable,true);
  assert.equal((await x.b.api('export-cache-info',{auto:true})).refus!==null,true);
  const out=await x.b.api('export-cache-clear',{ids,signatures,manuel:true});assert.equal(out.cleared,true);assert.match(out.text,/vidées manuellement le .*sans export confirmé/);
  x.e.s.batch.stoppedAtEnd={cut:101,applied:true};assert.equal((await x.b.api('export-cache-info',{auto:true})).refus,null);
});

test('marqueur : « après export du … » (auto) distinct de « manuellement … sans export » ; jamais écrit si la suppression échoue',async()=>{
  assert.match(EC.texte({at:'2026-10-07T10:00:00.000Z',afterExportAt:'2026-10-07T09:00:00.000Z'}),/^données précédentes vidées après export du 2026-10-07T09:00:00/);
  assert.match(EC.texte({at:'2026-10-07T10:00:00.000Z',manuel:true}),/^données précédentes vidées manuellement le 2026-10-07T10:00:00.*sans export confirmé par Ariane$/);
  const x=await sw(),ids=x.ids(),signatures=x.sigs();x.st.deleteMany=async()=>{throw Error('disque plein');};
  await assert.rejects(x.b.api('export-cache-clear',{ids,signatures,exportAt:'2026-10-07T09:00:00.000Z',auto:true}),/disque plein/);
  assert.equal(x.mem[EC.CLE],undefined,'aucun marqueur après un échec');
  const manuel=await sw();await manuel.b.api('export-cache-clear',{ids:manuel.ids(),signatures:manuel.sigs(),manuel:true});
  const meta=await manuel.b.api('dataset-meta');assert.equal(meta.exportPeriod.previousDataCleared.manual,true);assert.match(meta.exportPeriod.previousDataCleared.text,/manuellement/);
});

test('lot vidé puis repris/rouvert : il sort de lotsVides, sa mesure V1 redevient visible',async()=>{
  const x=await sw();await x.b.api('export-cache-clear',{ids:x.ids(),signatures:x.sigs(),exportAt:'2026-10-07T09:00:00.000Z',auto:true});
  let meta=await x.b.api('dataset-meta');assert.ok(meta.v1TimingExport.lotsVidesDuCache.includes('lot-1'));
  x.r.batch.closed=false;x.r.batch.segment++;                        // reprise du même lot
  meta=await x.b.api('dataset-meta');assert.ok(meta.v1TimingExport.lots.some(l=>l.batchId==='lot-1'),'lot repris : visible');
  assert.ok(!(meta.v1TimingExport.lotsVidesDuCache||[]).includes('lot-1'));
});

test('bilan après vidage : closureSummary ne cite que les visites depuis le vidage (engine.js intact)',async()=>{
  const x=await sw();
  x.e.s.records=[{recordId:'r0',identity:{part:7,cut:100},commandSent:true,serverConfirmed:false},{recordId:'r-new',identity:{part:7,cut:150},commandSent:true,serverConfirmed:false}];
  x.st.records.length=0;x.st.records.push({recordId:'r0',identity:{part:7,cut:100}});
  let meta=await x.b.api('dataset-meta');assert.equal(meta.closureSummary.withoutServerConfirmation.length,2,'avant vidage : tout');
  await x.b.api('export-cache-clear',{ids:x.ids(),signatures:x.sigs(),exportAt:'2026-10-07T09:00:00.000Z',auto:true});
  x.st.records.push({recordId:'r-new',identity:{part:7,cut:150}});
  meta=await x.b.api('dataset-meta');
  assert.equal(meta.closureSummary.withoutServerConfirmation.length,1);assert.match(meta.closureSummary.withoutServerConfirmation[0],/150/);assert.ok(meta.closureSummary.closureScope);
  assert.equal(x.e.s.records.length,2,'état du moteur non touché');
});

test('journal « mesure V1 incohérente » : compté comme manque, aucun vidage automatique',async()=>{
  const t=await ouvrir();
  // le service worker annonce une santé V1 stockée qui n'est pas dans les événements lus
  const meta={format:'banane-test-journal-v4',version:'4.9.0.2',state:{},v1TimingExport:{lots:[{sessionId:'s',batchId:'b',clockId:'c',healthSeq:9,healthStored:true}]}};
  const p=(await ouvrir({}));void p;
  const t2=await ouvrir({reponsesPlus:{'journal-meta':meta}});
  await t2.p.$('export-tout').onclick();await t2.p.attendre();
  assert.equal(t2.appels.length,0);assert.match(t2.p.$('export-status').textContent,/Export incomplet.*mesure V1 incomplète/);assert.match(t2.p.$('export-status').textContent,/NON vidé/);void t;
});

test('panneau : lot reprenable => avertissement dans la confirmation ; enregistrements gardés => dit dans le message',async()=>{
  const t=await ouvrir({reponsesPlus:{'export-cache-info':()=>({refus:null,reprenable:true,marqueur:null}),
    'export-cache-clear':a=>({cleared:true,events:5,records:2,clouds:3,modifies:{events:[],records:['r1']}})}});
  await t.p.$('export-cache-clear').onclick();await t.p.attendre();
  assert.match(t.confirmations[0],/ATTENTION : ce lot est arrêté mais pas terminé : il peut être repris/);
  assert.match(t.p.$('export-status').textContent,/1 enregistrement\(s\) modifié\(s\) depuis l’export ont été GARDÉS/);
});
