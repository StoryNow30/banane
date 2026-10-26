'use strict';
/* Test 23 : croisement du ciblage du lot (cib22) et de la mise à jour en place de Signal (animations), DANS UN VRAI NAVIGATEUR. panel.html réel, API Chrome
 * simulée, aucune écriture vers ESV. Un lot en cours dont le total M est d'abord inconnu (« total inconnu », rail sans graduations) puis connu (la fiche de
 * départ arrive dans chrome.storage.local, relue au plus toutes les 5 s) : l'écran est mis à jour EN PLACE (le rail, le curseur et la ligne des bornes
 * restent les mêmes éléments, aucune réécriture chaque seconde), les graduations apparaissent sans reste de style d'un autre nœud, et un lot suivant de total
 * différent redessine des graduations justes. Ignoré, et dit ignoré, sans Chromium. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {CHROMIUM,PW,absent}=require('./helpers/signal-navigateur.cjs'),LM=require('../src/liste-memoire.js');
const racine=path.resolve(__dirname,'..');
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
  window.chrome={runtime:{id:'essai',getURL:p=>'file://'+racine+'/'+p,connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
   sendMessage:async m=>{const a=m.action||m.kind;
    if(a==='view')return {result:vue()};
    if(a==='list-tabs')return {result:[{id:7,title:'ESV 7',windowId:1,index:0,active:true,pret:true,utilise:true}]};
    if(a==='bornes-partie')return {result:null};
    if(a==='fiches-depart')return {result:{fiches:stockage.banane3FichesDepart||[]}};
    return {result:a in fixes?fixes[a]:{}};}},
   storage:{local:{get:async()=>({...stockage}),set:async o=>{Object.assign(stockage,o);}}},windows:{getCurrent:async()=>({id:1,type:'normal',width:600,height:760}),update:async()=>({})}};
 },{racine,lot});
 await page.goto('file://'+path.join(racine,'panel.html')+'#home');
 await page.waitForTimeout(1200);
 return {page,erreurs};
}
const rail=page=>page.evaluate(()=>{const r=document.querySelector('#ui5 .sg-rail');if(!r)return null;
 const q=s=>[...r.querySelectorAll(s)];
 return {total:r.dataset.total,compte:document.querySelector('#ui5 .sg-compte')?.textContent,
  nums:q('.sg-rail-num').map(e=>({t:e.textContent,cls:e.className,style:e.getAttribute('style')})),
  grads:q('.sg-rail-grad').length,fait:q('.sg-rail-fait').map(e=>e.getAttribute('style')),cur:q('.sg-rail-cur').length,
  bornes:document.querySelector('#ui5 .sg-lot-bornes')?.textContent||null,allure:document.querySelector('#ui5 .sg-allure')?.textContent||''};});

test('Test 23 · total inconnu puis connu : mise à jour en place, graduations justes, rien réécrit chaque seconde ; lot suivant de total différent',{skip:absent,timeout:60000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,lotDe('LA',8770));
  const a=await rail(page);
  assert.equal(a.total,'inconnu');assert.match(a.compte,/13traités · total inconnu/);assert.deepEqual(a.nums,[]);assert.doesNotMatch(a.allure,/restantes/);
  assert.equal(a.bornes,'Lot du cut 0 au cut 8770','les bornes du lot sont dites pendant le lot');
  await page.evaluate(()=>{window.__rail=document.querySelector('#ui5 .sg-rail');window.__borne=document.querySelector('#ui5 .sg-lot-bornes');window.__inst=document.querySelector('#ui5 .sg-instrument');});
  /* la fiche de départ du lot et l'instantané de la liste arrivent : M devient connu (74), les bornes (0 → 8770) ne couvrant pas la partie, par l'instantané */
  const inv=Array.from({length:74},(_,i)=>10+i*120);
  await page.evaluate(({f,i})=>{window.__stockage.banane3FichesDepart=[f];window.__stockage['banane5ListeInstantane:23']=i;},{f:ficheDe('LA',74),i:instDe(inv,23)});
  await page.waitForFunction(()=>/sur 74 ciblés/.test(document.querySelector('#ui5 .sg-compte')?.textContent||''),null,{timeout:15000});
  const b=await rail(page);
  assert.equal(b.total,'connu');assert.deepEqual(b.nums.map(x=>x.t),['0','37','74']);assert.ok(b.grads>=8);assert.match(b.allure,/environ .* restantes/);
  assert.equal(b.nums[0].style,null,'le « 0 » n’hérite d’aucun style posé sur un autre nœud');assert.match(b.nums[1].style,/left:50%/);assert.match(b.nums[2].style,/left:100%/);
  assert.equal(b.cur,1);assert.equal(b.bornes,'Lot du cut 0 au cut 8770');
  const m=await page.evaluate(()=>({rail:window.__rail===document.querySelector('#ui5 .sg-rail'),borne:window.__borne===document.querySelector('#ui5 .sg-lot-bornes'),inst:window.__inst===document.querySelector('#ui5 .sg-instrument')}));
  assert.deepEqual(m,{rail:true,borne:true,inst:true},'le rail, la ligne des bornes et l’instrument restent les mêmes éléments quand M devient connu');
  /* le curseur est recréé une fois quand les graduations arrivent (elles le précèdent dans le rail) ; ensuite il reste le même élément et glisse */
  await page.evaluate(()=>{window.__cur=document.querySelector('#ui5 .sg-rail-cur');window.__left=window.__cur.style.left;});
  await page.evaluate(()=>{const l=window.__E.lot;l.processed.push({identity:{part:23,cut:400},cut:400,durationMs:2800});l.sequence.push({identity:{part:23,cut:400}});});
  await page.waitForFunction(()=>/14\s*traités/.test(document.querySelector('#ui5 .sg-compte')?.textContent||''),null,{timeout:8000});
  assert.deepEqual(await page.evaluate(()=>({meme:window.__cur===document.querySelector('#ui5 .sg-rail-cur'),bouge:window.__left!==document.querySelector('#ui5 .sg-rail-cur').style.left})),{meme:true,bouge:true},'le curseur glisse sur place');
  /* R6 : sans changement, aucune réécriture de structure en 3 s (seuls l'anneau et « en pause depuis » avancent, par attribut) */
  const n=await page.evaluate(()=>new Promise(r=>{let c=0;const o=new MutationObserver(l=>{for(const x of l)if(x.type==='childList'||x.type==='characterData')c++;});o.observe(document.getElementById('ui5'),{subtree:true,childList:true,characterData:true});setTimeout(()=>{o.disconnect();r(c);},3000);}));
  assert.equal(n,0,'aucune réécriture de structure ni de texte chaque seconde');
  /* lot suivant, total différent (80) : les graduations sont redessinées justes, le « 0 » n'a pas de style hérité */
  const inv2=Array.from({length:80},(_,i)=>10+i*110);
  await page.evaluate(({f,i,l})=>{window.__stockage.banane3FichesDepart=[f];window.__stockage['banane5ListeInstantane:23']=i;window.__E.lot=l;},{f:ficheDe('LB',80),i:instDe(inv2,23),l:lotDe('LB',8770)});
  await page.waitForFunction(()=>/sur 80 ciblés/.test(document.querySelector('#ui5 .sg-compte')?.textContent||''),null,{timeout:15000});
  const c=await rail(page);
  assert.deepEqual(c.nums.map(x=>x.t),['0','40','80']);assert.equal(c.nums[0].style,null,'« 0 » sans style hérité après un changement de total');assert.match(c.nums[1].style,/left:50%/);assert.match(c.nums[2].style,/left:100%/);
  assert.deepEqual(erreurs,[]);await page.close();
 }finally{await nav.close();}
});
