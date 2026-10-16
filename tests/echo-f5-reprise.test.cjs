'use strict';
/* Reprise d'Écho après un F5 (terrain 4.9.5 test 3, partie 29) : voir fiches/ECHO_F5.md.
 *  - la reprise attend la fin de chargement d'ESV (liste lue, cut identifié), au lieu de partir au premier « complete » ;
 *  - la séance reste la même, sans période vide ; un démarrage raté ne laisse pas de période fantôme ;
 *  - un F5 en lot Orbite et hors séance se passe comme avant. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {background}=require('./helpers/background-harness.cjs'),K=require('../src/core.js'),Settings=require('../src/settings.js'),EC=require('../src/export-cache.js');
const {pilote,espion,esvLent,reglages:reglagesLot,attendreFin}=require('./helpers/esv-lent.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esv={id:'test',url:'https://esv.lidar.altametris.xyz/rails_validation/test',tab:{id:1}};
/* Délais réduits : la fenêtre de reprise réelle est de plusieurs secondes. */
const REGLAGES={...Settings,echo:{...Settings.echo,reprise:{pollMs:5,silenceListeMs:40,delaiMaxMs:700}}};
const ESV_NU=['apply','validateAndNext','next','nextWithoutDecision','skipAndNext','goToCut','validateInPlace','restore'];

/* Une page ESV dont on pilote le libellé de cut (`ping.label`) et les pages de liste vues par l'observateur. */
async function seance(){
 const b=background({globals:{BananeCore3:K,BananeSettings:REGLAGES,BananeExportCache:EC}});
 const page={label:{part:23,cut:100}};
 b.adapter.ping=async()=>({version:K.VERSION,pageId:b.adapter.identity.pageId,proprietaire:'test',label:page.label});
 await b.api('connect',{tabId:1});await b.api('native-start');
 const n=()=>b.fonction('engine.s.native'),id=n().id;
 await b.message({kind:'native-event',type:'visit-started',payload:{sessionId:id,observationPeriodId:n().currentPeriodId,visitId:'v1',identity:b.adapter.identity,initialObserved:await b.adapter.state()}},esv);
 let seq=0;
 const listePages=(k=3)=>b.message({kind:'esv-observation',observer:'obs-f5',entries:Array.from({length:k},()=>({seq:++seq,kind:'list-page',urlClass:'rail-list',listKey:'liste',
   status:200,outcome:'done',rows:100,counts:{valid:90,invalid:10,skipped:0},startedEpochMs:Date.now()-5,endedEpochMs:Date.now()}))},esv);
 return {b,page,n,id,listePages,resumes:()=>b.adapter.calls.filter(c=>c==='nativeResume').length};
}
const vides=n=>n.observationPeriods.filter(p=>p.endedAt&&!p.reason);

test('F5 en Écho : la reprise attend la liste ET le cut ; même session, une seule nouvelle période, aucune commande ESV',async()=>{
 const s=await seance();
 /* ESV vient de recharger : cut 0, liste pas encore lue. */
 s.page.label={part:23,cut:0};
 await s.b.tabUpdated(1,{status:'loading'});
 assert.equal(s.n().status,'PAUSED_ADAPTER_UNRESPONSIVE');assert.equal(s.n().pageLost.reason,'page-reloaded');
 await s.b.tabUpdated(1,{status:'complete'});await sleep(120);
 assert.equal(s.resumes(),0,'aucune reprise avant la fin du chargement d’ESV');
 assert.equal(s.n().observationPeriods.length,1,'aucune période ouverte sur une page qui charge');
 assert.equal(s.n().status,'PAUSED_ADAPTER_UNRESPONSIVE');
 /* La liste arrive, mais le libellé du cut est encore illisible : toujours pas de reprise. */
 s.page.label=null;await s.listePages();await sleep(120);
 assert.equal(s.resumes(),0,'jamais de reprise sur un cut sans identité');
 /* Libellé lu, liste silencieuse : la reprise part. */
 s.page.label={part:23,cut:0};await sleep(120);
 const n=s.n();assert.equal(n.status,'RUNNING',n.message);assert.equal(s.resumes(),1);
 assert.equal(n.id,s.id,'même session');assert.equal(n.pageLost,null);
 assert.equal(n.observationPeriods.length,2,'la période d’avant le F5 et une seule nouvelle');
 assert.equal(vides(n).length,0);assert.equal(n.observationPeriods[0].reason,'page-reloaded');
 assert.equal(s.b.store.events.filter(e=>e.type==='native-session-started'||e.type==='native-session-started').length<=1,true);
 assert.ok(!s.b.adapter.calls.some(c=>ESV_NU.includes(c)),'rien n’est envoyé à ESV');
});
test('F5 en Écho : cut déjà affiché (saut de l’opérateur) → reprise sans attendre le silence de la liste',async()=>{
 const s=await seance();s.page.label={part:23,cut:0};
 await s.b.tabUpdated(1,{status:'loading'});await s.b.tabUpdated(1,{status:'complete'});await sleep(60);assert.equal(s.resumes(),0);
 s.page.label={part:23,cut:1681};await sleep(60);
 assert.equal(s.n().status,'RUNNING');assert.equal(s.resumes(),1);
});
test('F5 en Écho : un second rechargement pendant l’attente repart de zéro (les pages de liste de l’ancien chargement ne comptent pas)',async()=>{
 const s=await seance();s.page.label={part:23,cut:0};
 await s.b.tabUpdated(1,{status:'loading'});await s.b.tabUpdated(1,{status:'complete'});await s.listePages();
 await s.b.tabUpdated(1,{status:'loading'});await sleep(120);
 assert.equal(s.resumes(),0,'la liste de la page précédente ne vaut plus');
 await s.b.tabUpdated(1,{status:'complete'});await s.listePages();await sleep(120);
 assert.equal(s.n().status,'RUNNING');assert.equal(s.resumes(),1);assert.equal(s.n().observationPeriods.length,2);
});
test('F5 en Écho : ESV ne finit jamais de charger → délai borné, aucune période, reprise manuelle possible',async()=>{
 const s=await seance();s.page.label={part:23,cut:0};
 await s.b.tabUpdated(1,{status:'loading'});await s.b.tabUpdated(1,{status:'complete'});await sleep(900);
 const n=s.n();assert.equal(n.status,'PAUSED_ADAPTER_UNRESPONSIVE');assert.match(n.message,/reprise automatique impossible/);
 assert.equal(s.resumes(),0);assert.equal(n.observationPeriods.length,1,'pas de période fantôme');
 s.page.label={part:23,cut:1681};await s.b.api('native-resume');
 assert.equal(s.n().status,'RUNNING');assert.equal(s.n().observationPeriods.length,2);
});

test('démarrage raté (page sans adaptateur) : aucune session ni période fantôme, puis le démarrage équipe la page tout seul',async()=>{
 let equipee=false;
 const b=background({globals:{BananeCore3:K,BananeSettings:REGLAGES,BananeExportCache:EC},
  executeScript:async o=>{if(o.files)equipee=true;return [{frameId:0,result:o.func?null:undefined}];}});
 await b.api('connect',{tabId:1});
 /* Rechargement hors séance : la page n'a plus d'adaptateur jusqu'à la réinjection. */
 equipee=false;const ping=b.adapter.ping.bind(b.adapter),snap=b.adapter.nativeSnapshot.bind(b.adapter),dep=b.injected.length;
 b.adapter.ping=async(...a)=>{if(!equipee)throw Error('Could not establish connection. Receiving end does not exist.');return ping(...a);};
 b.adapter.nativeSnapshot=async(...a)=>{if(!equipee)throw Error('Could not establish connection. Receiving end does not exist.');return snap(...a);};
 await b.tabUpdated(1,{status:'loading'});await b.tabUpdated(1,{status:'complete'});
 assert.ok(!b.fonction('engine.s.native'),'hors séance, le rechargement ne crée rien');assert.equal(equipee,false,'hors séance, la page n’est pas touchée');assert.equal(b.injected.length,dep);
 await b.api('native-start');
 const n=b.fonction('engine.s.native');assert.equal(n.status,'RUNNING',n.message);assert.equal(n.observationPeriods.length,1);assert.equal(equipee,true);
});
test('démarrage raté (adaptateur muet) : trois clics = au plus une période, marquée ; elle disparaît au démarrage réussi',async()=>{
 const b=background({globals:{BananeCore3:K,BananeSettings:REGLAGES,BananeExportCache:EC}});await b.api('connect',{tabId:1});
 const start=b.adapter.nativeStart.bind(b.adapter),resume=b.adapter.nativeResume.bind(b.adapter);let muet=true;
 b.adapter.nativeStart=async(...a)=>{if(muet)throw Error('Adaptateur ESV sans réponse.');return start(...a);};
 b.adapter.nativeResume=async(...a)=>{if(muet)throw Error('Adaptateur ESV sans réponse.');return resume(...a);};
 for(let i=0;i<3;i++)await assert.rejects(b.api('native-start'),/sans réponse/);
 let n=b.fonction('engine.s.native');assert.ok(n.observationPeriods.length<=1,`${n.observationPeriods.length} périodes`);
 for(const p of n.observationPeriods){assert.equal(p.reason,'start-failed');assert.match(p.error,/sans réponse/);}
 muet=false;await b.api('native-start');n=b.fonction('engine.s.native');
 assert.equal(n.status,'RUNNING');assert.equal(n.observationPeriods.length,1,'la période ratée est remplacée, pas empilée');assert.equal(n.observationPeriods[0].status,'RUNNING');
});
test('reprise manuelle ratée après un F5 : pas de période vide par essai',async()=>{
 const s=await seance();s.page.label={part:23,cut:1681};
 const resume=s.b.adapter.nativeResume.bind(s.b.adapter);let muet=true;
 s.b.adapter.nativeResume=async(...a)=>{if(muet)throw Error('Adaptateur ESV sans réponse.');return resume(...a);};
 s.b.fonction('BananeSettings').echo.repriseAutomatique;
 await s.b.tabUpdated(1,{status:'loading'});await sleep(30);
 for(let i=0;i<3;i++)await assert.rejects(s.b.api('native-resume'),/sans réponse/);
 assert.ok(s.n().observationPeriods.length<=2,'la période d’avant et une seule période ratée');
 muet=false;await s.b.api('native-resume');assert.equal(s.n().observationPeriods.length,2);assert.equal(s.n().status,'RUNNING');
});

test('F5 pendant un lot Orbite : les événements d’onglet ne touchent ni Écho ni la page ; « Reprendre » rattache le lot comme avant',async()=>{
 const r=await pilote(espion,{start:100,end:103,settings:reglagesLot(),esv:esvLent});
 let view=await r.b.settle();assert.equal(view.batch.state,'PAUSED');
 const appels=r.b.adapter.calls.length;
 await r.b.ctx.chrome.tabs.reload(1);await sleep(80);/* « loading » puis « complete », comme Chrome */
 assert.ok(!r.b.fonction('engine.s.native'),'Écho n’est pas créé par le rechargement');
 assert.equal(r.b.adapter.calls.length,appels,'aucune commande venue de l’événement d’onglet');
 await r.b.api('resume');view=await attendreFin(r);
 assert.ok(r.b.store.events.some(e=>e.type==='batch-rebased-after-reload'));assert.equal(view.batch.stoppedAtEnd?.cut,103);
});
