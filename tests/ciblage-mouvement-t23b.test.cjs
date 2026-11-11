'use strict';
/* Test 23 : croisement du ciblage du lot (cib22) et de la mise à jour en place de Signal (animations), DANS UN VRAI NAVIGATEUR. panel.html réel, API Chrome
 * simulée, aucune écriture vers ESV. Un lot en cours dont le total M est d'abord inconnu (« total inconnu », rail sans graduations) puis connu (la fiche de
 * départ arrive dans chrome.storage.local, relue au plus toutes les 5 s) : l'écran est mis à jour EN PLACE (le rail, le curseur et la ligne des bornes
 * restent les mêmes éléments, aucune réécriture chaque seconde), les graduations apparaissent sans reste de style d'un autre nœud, et un lot suivant de total
 * différent redessine des graduations justes. Ignoré, et dit ignoré, sans Chromium. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {CHROMIUM,PW,absent}=require('./helpers/signal-navigateur.cjs'),LM=require('../src/liste-memoire.js');
const racine=path.resolve(__dirname,'..'),{ouvrirPanneau}=require('./helpers/panneau-local.cjs');
const N=10000;
const instDe=(inv,partie)=>{const st=new Array(N).fill(0);for(const c of inv)st[c]=1;return LM.compacter({st,fl:new Array(N).fill(0),ed:new Array(6*N).fill(null)},{partie,at:'2026-10-26T09:00:00.000Z',cle:'k'});};
const ficheDe=(id,n)=>({batchId:id,partie:23,valides:N-n,invalides:n,ignores:0,total:N,at:'2026-10-26T09:00:00.000Z'});
const lotDe=(id,fin)=>({id,state:'RUNNING',scope:{part:23,start:0,end:fin},activeIdentity:{part:23,cut:418},cutStartedAt:new Date(Date.now()-1000).toISOString(),
 processed:Array.from({length:13},(_,i)=>({identity:{part:23,cut:10+i*30},cut:10+i*30,durationMs:2800})),deferred:[],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:Array.from({length:13},(_,i)=>({identity:{part:23,cut:10+i*30}})),lotCommands:{}});

async function ouvrir(nav,lot){
 const page=await nav.newPage({viewport:{width:600,height:760}}),erreurs=[];
 page.on('pageerror',e=>erreurs.push(e.message));
 await page.addInitScript(({racine,lot})=>{
  const E={lot};window.__E=E;
  const vue=()=>({current:{identity:{part:23,cut:418}},batch:E.lot,busy:false,manual:{status:'IDLE'},native:{status:'IDLE',visits:[],incomplete:[]},connection:{status:'ready',observedAt:'t',message:null,tabId:7}});
  const fixes={'choix-lot-etat':{clicHumain:'tel-quel',regleGrappeDifferes:false},'raison-choix-etat':{actif:false,touches:'chiffres'},'relecture-choix-etat':{mode:'corriger'},'relecture-etat':{choix:'corriger',lot:null,passe:null},'bandeau-etat':{on:false}};
  const stockage={};window.__stockage=stockage;
  window.fetch=async()=>({json:async()=>({})});
  window.chrome={runtime:{id:'essai',getURL:p=>new URL(p,location.href).href,connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
   sendMessage:async m=>{const a=m.action||m.kind;
    if(a==='view')return {result:vue()};
    if(a==='list-tabs')return {result:[{id:7,title:'ESV 7',windowId:1,index:0,active:true,pret:true,utilise:true}]};
    if(a==='bornes-partie')return {result:null};
    if(a==='fiches-depart')return {result:{fiches:stockage.banane3FichesDepart||[]}};
    return {result:a in fixes?fixes[a]:{}};}},
   storage:{local:{get:async()=>({...stockage}),set:async o=>{Object.assign(stockage,o);}}},windows:{getCurrent:async()=>({id:1,type:'normal',width:600,height:760}),update:async()=>({})}};
 },{racine,lot});
 await ouvrirPanneau(page,'#home');
 await page.waitForTimeout(1200);
 return {page,erreurs};
}
const rail=page=>page.evaluate(()=>{const a=document.querySelector('#ui5 .sg-anneau');if(!a)return null;
 /* CH-104 : le rail et ses graduations n'existent plus ; le total (connu ou non) se lit sur l'anneau : pourcentage et trait plein s'il est connu, arc qui tourne sinon. */
 const arc=a.querySelector('.sg-arc'),[tr,tot]=(arc?.getAttribute('stroke-dasharray')||'').split(' ').map(Number);
 return {total:a.dataset.forme==='pct'?'connu':/total inconnu/.test(a.getAttribute('aria-label')||'')?'inconnu':'?',label:a.getAttribute('aria-label'),tourne:a.dataset.tourne||null,
  chiffre:a.querySelector('.sg-chiffre')?.textContent,suite:a.querySelector('.sg-suite')?.textContent,part:tr/tot,
  bornes:document.querySelector('#ui5 .sg-lot-bornes')?.textContent||null,allure:document.querySelector('#ui5 .sg-allure')?.textContent||''};});

test('Test 23 (suite) · R6 : rien réécrit chaque seconde ; lot suivant de total différent',{skip:absent,timeout:60000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,lotDe('LA',8770));
  const inv=Array.from({length:74},(_,i)=>10+i*120);
  await page.evaluate(({f,i})=>{window.__stockage.banane3FichesDepart=[f];window.__stockage['banane5ListeInstantane:23']=i;},{f:ficheDe('LA',74),i:instDe(inv,23)});
  await page.waitForFunction(()=>/sur 74 ciblés/.test(document.querySelector('#ui5 .sg-anneau')?.getAttribute('aria-label')||''),null,{timeout:15000});
  /* R6 : sans changement, aucune réécriture de structure en 3 s (CH-104 : l'anneau du temps passé n'existe plus ; seul « en pause depuis » avance seul, et il n'y en a pas pendant un lot en cours) */
  const n=await page.evaluate(()=>new Promise(r=>{let c=0;const o=new MutationObserver(l=>{for(const x of l)if(x.type==='childList'||x.type==='characterData')c++;});o.observe(document.getElementById('ui5'),{subtree:true,childList:true,characterData:true});setTimeout(()=>{o.disconnect();r(c);},3000);}));
  assert.equal(n,0,'aucune réécriture de structure ni de texte chaque seconde');
  /* lot suivant, total différent (80) : le pourcentage et le trait plein sont ceux de 80 */
  const inv2=Array.from({length:80},(_,i)=>10+i*110);
  await page.evaluate(({f,i,l})=>{window.__stockage.banane3FichesDepart=[f];window.__stockage['banane5ListeInstantane:23']=i;window.__E.lot=l;},{f:ficheDe('LB',80),i:instDe(inv2,23),l:lotDe('LB',8770)});
  await page.waitForFunction(()=>/sur 80 ciblés/.test(document.querySelector('#ui5 .sg-anneau')?.getAttribute('aria-label')||''),null,{timeout:15000});
  const c=await rail(page);
  assert.equal(c.total,'connu');assert.equal(c.chiffre,'16','13 traités sur 80 ciblés : 16 %');assert.equal(c.suite,'%');assert.ok(Math.abs(c.part-13/80)<0.005,'le trait plein couvre 13/80 du cercle : '+c.part);
  assert.deepEqual(erreurs,[]);await page.close();
 }finally{await nav.close();}
});
