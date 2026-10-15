'use strict';
/* 4.9.5.3 — l'export du journal par le VRAI panneau (panel.js, fonctions d'export chargées en VM) et le VRAI service worker (ESV simulé) :
 *  - S7 : jalons `phase-timing` repliés par visite ; tools/perf-phases.cjs donne les mêmes chiffres sur le journal exporté (replié) que sur
 *    le journal tel que le service worker le range (un événement par jalon) ;
 *  - S6 (relevé 12) : en-tête « machine » (navigateur, plateforme, mémoire, GPU), champs absents laissés absents.
 * Aucune commande ESV, aucune écriture métier : on ne lit que le journal. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {production}=require('./helpers/perf-production.cjs'),V1=require('../tools/perf-phases.cjs'),P=require('../src/phase-pli.js'),S=require('../src/settings.js');
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const START=SOURCE.indexOf('async function lireStore('),END=SOURCE.indexOf("on('gcv1-diagnostic-export'");
assert.ok(START>0&&END>START);
const PANEL=SOURCE.slice(START,END);
const plat=x=>JSON.parse(JSON.stringify(x));
const GL={getExtension:n=>n==='WEBGL_debug_renderer_info'?{UNMASKED_VENDOR_WEBGL:1,UNMASKED_RENDERER_WEBGL:2}:n==='WEBGL_lose_context'?{loseContext(){}}:null,getParameter:p=>p===1?'Fabricant GPU':'Rendu GPU simulé'};
const MACHINE={navigator:{userAgent:'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0',platform:'Linux x86_64',hardwareConcurrency:8,deviceMemory:8,userAgentData:{brands:[{brand:'Chromium',version:'130'},{brand:'Not A Brand',version:'99'}],platform:'Linux'}},
 performance:{memory:{usedJSHeapSize:52428800,totalJSHeapSize:104857600,jsHeapSizeLimit:2147483648}},document:{createElement:()=>({getContext:()=>GL})}};
function panneau(b,{globals={},machine=MACHINE}={}){
 const sorties=[],ctx={api:b.api,store:()=>({all:async n=>structuredClone(b.store[n])}),Blob,Date,globalThis:{BananePhasePli:P,BananeSettings:S,...globals},...machine,
  saveBlob:async(blob,name)=>{sorties.push({name,document:JSON.parse(await blob.text())});return {name,confirme:true,etat:'complete'};},
  nonEnregistres:()=>[],direFichiers:()=>'',statutExport:()=>{}};
 vm.createContext(ctx);vm.runInContext(PANEL,ctx,{filename:'panel.js(export)'});
 return {journal:async()=>{await vm.runInContext('exporterJournal()',ctx);return sorties.at(-1).document;},bilan:()=>vm.runInContext('bilanPilote()',ctx)};
}
/* Un vrai lot de deux cuts (GCV1 réel, ESV simulé) : de vraies visites, donc de vrais jalons par visite. Un seul lot pour tout le fichier. */
let B;const lotFerme=async()=>B;
before(async()=>{const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'});await b.settle();B=b;});

test('journal exporté : jalons repliés par visite, bilan du repli et en-tête machine ; mêmes chiffres que le journal non replié', async () => {
 const b=await lotFerme(),n=b.store.events.filter(e=>e.type==='phase-timing'&&e.visitId).length;assert.ok(n>=20,'des jalons de visite existent : '+n);
 const doc=await panneau(b).journal();
 assert.ok(doc.events.some(e=>e.type==='phase-timing-pli')&&doc.events.some(e=>e.type==='phase-timing-pli-formes'));
 assert.ok(doc.events.filter(e=>e.type==='phase-timing').every(e=>!e.visitId||e.kind==='health'),'seuls les jalons sans visite (lot, santé) restent à l\'unité');
 assert.equal(doc.phaseTimingPli.jalonsLaisses,0);assert.equal(doc.phaseTimingPli.evenementsAvant,b.store.events.length);assert.ok(doc.phaseTimingPli.evenementsApres<doc.phaseTimingPli.evenementsAvant);
 const brut={...doc,events:structuredClone(b.store.events)};
 assert.deepEqual(plat(V1.measure(doc)),plat(V1.measure(brut)),'mêmes chiffres, journal replié ou non');
 assert.equal(doc.machine.plateforme,'Linux');
});

test('réglages : repli coupé (phaseTimingReplie:false) = journal comme avant ; en-tête coupé (enteteMachine:false) = aucune clé machine', async () => {
 const b=await lotFerme();
 const sansPli=await panneau(b,{globals:{BananeSettings:{...S,export:{...S.export,phaseTimingReplie:false}}}}).journal();
 assert.ok(!sansPli.events.some(e=>e.type==='phase-timing-pli')&&!('phaseTimingPli' in sansPli));assert.equal(sansPli.events.filter(e=>e.type==='phase-timing').length,b.store.events.filter(e=>e.type==='phase-timing').length);
 const sansMach=await panneau(b,{globals:{BananeSettings:{...S,releves:{...S.releves,enteteMachine:false}}}}).journal();assert.ok(!('machine' in sansMach));
 const sansModule=await panneau(b,{globals:{BananePhasePli:undefined}}).journal();assert.ok(!('phaseTimingPli' in sansModule)&&sansModule.events.every(e=>e.type!=='phase-timing-pli'));
});

test('en-tête machine : navigateur, plateforme, cœurs, mémoire (appareil et JS), GPU ; un champ absent reste absent', async () => {
 const b=await lotFerme(),m=plat((await panneau(b).journal()).machine);
 assert.deepEqual(m,{navigateur:['Chromium 130','Not A Brand 99'],userAgent:'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0',plateforme:'Linux',coeurs:8,memoireGo:8,
  memoireJsMo:{utilisee:50,totale:100,limite:2048,source:'panneau'},gpu:{fabricant:'Fabricant GPU',rendu:'Rendu GPU simulé'}});
 const nu=plat((await panneau(b,{machine:{navigator:{userAgent:'UA'},performance:{},document:{createElement:()=>({getContext:()=>null})}}}).journal()).machine);
 assert.deepEqual(nu,{userAgent:'UA',gpu:null},'ni deviceMemory, ni performance.memory, ni WebGL : rien d\'inventé');
 const sansGl=plat((await panneau(b,{machine:{navigator:{},performance:{},document:{createElement:()=>({getContext:()=>({getExtension:()=>null})})}}}).journal()).machine);assert.equal(sansGl.gpu,null,'WEBGL_debug_renderer_info inaccessible : null');
 const pasDeDocument=plat((await panneau(b,{machine:{navigator:{platform:'X'}}}).journal()).machine);assert.deepEqual(pasDeDocument,{plateforme:'X',gpu:null});
});

test('le bilan porte lui aussi l\'en-tête machine et ses jalons repliés', async () => {
 const b=await lotFerme(),d=plat(await panneau(b).bilan());
 assert.ok(d.machine&&d.phaseTimingPli.jalonsPlies>0&&d.events.some(e=>e.type==='phase-timing-pli'));
});
