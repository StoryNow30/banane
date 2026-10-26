'use strict';
/* Ciblage T22 (fiches/CIBLAGE_T22.md) DANS UN VRAI NAVIGATEUR : panel.html réel (panel.js + Signal), ouvert comme le service worker l'ouvre (`#home`), API
 * Chrome simulée. ESV au cut 0 de la partie 23 (10 000 cuts, 74 invalides) ; la partie a une fin retenue (8770, « fin constatée »). Sans rien toucher,
 * « Démarrer le lot » : le lot part du cut 0 au cut 8770 (bornes envoyées inchangées) ; l'écran En cours dit « 13 traités sur 74 ciblés », les graduations,
 * le temps restant et les bornes du lot. Le constat de la test 22 : « 13 traités », ni graduations, ni temps restant. Rien n'est envoyé à ESV. Ignoré, et dit
 * ignoré, sans Chromium. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {CHROMIUM,PW,absent}=require('./helpers/signal-navigateur.cjs'),LM=require('../src/liste-memoire.js');
const racine=path.resolve(__dirname,'..');
const N=10000,INV=Array.from({length:74},(_,i)=>10+i*120);
const inst=(()=>{const st=new Array(N).fill(0);for(const c of INV)st[c]=1;return LM.compacter({st,fl:new Array(N).fill(0),ed:new Array(6*N).fill(null)},{partie:23,at:'2026-10-26T09:00:00.000Z',cle:'k'});})();
const FICHE={batchId:'LNEW',partie:23,valides:N-74,invalides:74,ignores:0,total:N,at:'2026-10-26T09:00:00.000Z'};

async function ouvrir(nav,{memo,lot=null}){
 const page=await nav.newPage({viewport:{width:600,height:760}}),erreurs=[];
 page.on('pageerror',e=>erreurs.push(e.message));
 await page.addInitScript(({racine,memo,lot,inst,FICHE})=>{
  const E={lot,start:null};window.__E=E;
  const vue=()=>({current:{identity:{part:23,cut:0}},batch:E.lot,busy:false,manual:{status:'IDLE'},native:{status:'IDLE',visits:[],incomplete:[]},connection:{status:'ready',observedAt:'t',message:null,tabId:7}});
  const fixes={'choix-lot-etat':{clicHumain:'tel-quel',regleGrappeDifferes:false},'raison-choix-etat':{actif:false,touches:'chiffres'},'relecture-choix-etat':{mode:'corriger'},'relecture-etat':{choix:'corriger',lot:null,passe:null},'bandeau-etat':{on:false}};
  const stockage={banane3FichesDepart:[FICHE],'banane5ListeInstantane:23':inst};
  window.fetch=async()=>({json:async()=>({})});
  window.chrome={runtime:{id:'essai',getURL:p=>'file://'+racine+'/'+p,connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
   sendMessage:async m=>{const a=m.action||m.kind;
    if(a==='view')return {result:vue()};
    if(a==='list-tabs')return {result:[{id:7,title:'ESV 7',windowId:1,index:0,active:true,pret:true,utilise:true}]};
    if(a==='connect')return {result:vue()};
    if(a==='bornes-partie')return {result:memo?{part:23,...memo,at:'t'}:null};
    if(a==='fiches-depart')return {result:{fiches:[FICHE]}};
    if(a==='start'){E.start=m.args;return {result:vue()};}
    return {result:a in fixes?fixes[a]:{}};}},
   storage:{local:{get:async()=>({...stockage}),set:async o=>{Object.assign(stockage,o);}}},windows:{getCurrent:async()=>({id:1,type:'normal',width:600,height:760}),update:async()=>({})}};
 },{racine,memo,lot,inst,FICHE});
 await page.goto('file://'+path.join(racine,'panel.html')+'#home');
 await page.waitForTimeout(1200);
 return {page,erreurs};
}
const enCours=start=>({id:'LNEW',state:'RUNNING',scope:{part:start.part,start:start.start,end:start.end,...(start.endMode?{endMode:start.endMode}:{})},activeIdentity:{part:23,cut:418},cutStartedAt:new Date(Date.now()-1000).toISOString(),
 processed:Array.from({length:13},(_,i)=>({identity:{part:23,cut:10+i*30},cut:10+i*30,durationMs:2800})),deferred:[],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:Array.from({length:13},(_,i)=>({identity:{part:23,cut:10+i*30}})),lotCommands:{}});

test('Ciblage T22 · fin retenue pour la partie, rien touché : le lot part avec cette fin, et l’écran En cours dit « sur 74 ciblés », graduations, temps restant, bornes',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,{memo:{last:8770,source:'fin constatée'}});
  assert.deepEqual(await page.$$eval('#ui5 [data-borne]',l=>l.map(i=>i.dataset.borne+'='+i.value)),['start=0','end=8770'],'bornes remplies par le panneau');
  await page.evaluate(()=>document.querySelector('#ui5 [data-act="legacy:start-batch"]').click());await page.waitForTimeout(500);
  const start=await page.evaluate(()=>window.__E.start);
  assert.equal(start.start,0);assert.equal(start.end,8770,'bornes envoyées : celles de la test 22, inchangées');assert.equal(start.endMode,undefined);
  await page.evaluate(l=>{window.__E.lot=l;},enCours(start));
  await page.waitForFunction(()=>/sur 74 ciblés/.test(document.querySelector('#ui5 .sg-compte')?.textContent||''),null,{timeout:8000});
  const e=await page.evaluate(()=>({compte:document.querySelector('#ui5 .sg-compte').textContent,grads:[...document.querySelectorAll('#ui5 .sg-rail-num')].map(x=>x.textContent),
   rail:document.querySelector('#ui5 .sg-rail').dataset.total,allure:document.querySelector('#ui5 .sg-allure').textContent,bornes:document.querySelector('#ui5 .sg-lot-bornes')?.textContent,
   actions:[...document.querySelectorAll('#ui5 .sg-actions button')].map(b=>b.textContent.trim())}));
  assert.match(e.compte,/13traités sur 74 ciblés13 posés · 0 différés/);assert.deepEqual(e.grads,['0','37','74']);assert.equal(e.rail,'connu');
  assert.match(e.allure,/médiane 2,8 s par cut · environ 2 min 51 restantes/,'61 restants × 2,8 s');
  assert.equal(e.bornes,'Lot du cut 0 au cut 8770');assert.deepEqual(e.actions,['Pause','Arrêter le lot']);
  assert.deepEqual(erreurs,[]);await page.close();
 }finally{await nav.close();}
});

test('Ciblage T22 · aucune fin retenue, ESV au cut 0 : la note des bornes dit « Dernier cut vide », pas « Dernier cut retenu »',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,{memo:null});
  const note=await page.$eval('#ui5 .sg-bornes small',e=>e.textContent);
  assert.match(note,/^Dernier cut vide : le lot va jusqu’à la fin de la partie/);
  assert.deepEqual(erreurs,[]);await page.close();
 }finally{await nav.close();}
});

test('Ciblage T22 · lot clos parce qu’ESV est passé après son dernier cut : Signal le dit (« hors du lot »)',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const lot={...enCours({part:23,start:0,end:8770}),state:'STOPPED',activeIdentity:null,stoppedAtEnd:{cut:8770,reason:'navigation-beyond-end',issue:'sortie',target:{part:23,cut:9120},at:'t',applied:true}};
  const {page,erreurs}=await ouvrir(nav,{memo:{last:8770,source:'saisie'},lot});
  const t=await page.$eval('#ui5 .sg-fin',e=>e.textContent);
  assert.match(t,/Fin du lotaprès le cut 8770, ESV est passé au cut 9120, hors du lot : rien après le cut 8770 n’est traité par ce lot/);
  assert.match(t,/Bornesdu cut 0 au cut 8770/);
  assert.deepEqual(erreurs,[]);await page.close();
 }finally{await nav.close();}
});
