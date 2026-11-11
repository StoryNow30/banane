'use strict';
/* CH-101 : photographie du panneau du tronc. Huit états aux chiffres cohérents, deux tailles, deux thèmes.
 * Usage : CHROMIUM=/opt/pw-browsers/chromium node maquettes/ui-ch101/outils/capturer2.cjs DOSSIER_HORS_DEPOT
 * Les images ne vont JAMAIS dans le dépôt (interdit de CLAUDE.md). Données fabriquées. */
const path=require('node:path'),fs=require('node:fs');
const R=path.resolve(__dirname,'../../..'); /* racine du dépôt */
const navigateur=require(R+'/tests/esv-maquette/navigateur.cjs'),{ouvrirPanneau}=require(R+'/tests/helpers/panneau-local.cjs');
const {N}=require(R+'/tests/helpers/signal-navigateur.cjs');
const SORTIE=process.argv[2];
const VERTS=new Set([4793,4799,4800,4806,4815,4816,4824,4833,4841,4842,4850,4858,4866,4871,4880,4888,4889,4895]),DIF=[4796,4803,4809,4838,4861,4877];
const id=c=>({part:13,cut:c});
const listes=jusqua=>{const p=[],d=[];for(let n=4790;n<=jusqua;n++){if(VERTS.has(n))continue;if(DIF.includes(n))d.push({identity:id(n),cut:n,deferredAt:'2026-11-10T09:0'+(n%10)+':00Z'});else p.push({identity:id(n),cut:n,durationMs:6200+((n*37)%23)*100});}return {processed:p,deferred:d};};
const lot=(etat,jusqua,extra={})=>{const L=listes(jusqua);const seq=[...L.processed,...L.deferred].map(x=>({identity:x.identity,cut:x.cut})).sort((a,b)=>a.cut-b.cut);if(jusqua<4900)seq.push({identity:id(jusqua+1),cut:jusqua+1});return N.lot(etat,{...L,sequence:seq,...extra});};
const fin=()=>lot('COMPLETED',4900,{activeIdentity:null});
const finRel=fin();finRel.batch.scope={...finRel.batch.scope,relecture:'corriger'};
const E={
 pret:{state:{current:{identity:id(4790)},busy:false,manual:{status:'IDLE'},native:{status:'IDLE',visits:[],incomplete:[]},batch:null}},
 cours:{state:lot('RUNNING',4811,{cutStartedAt:'MAINTENANT-3'})},
 pause:{state:lot('PAUSED',4811,{pausedAt:'MAINTENANT-104'})},
 toi:{state:lot('PAUSED_UNRESOLVED_RAIL',4811,{pauseReason:'unresolved-rail',step:'apply'})},
 panne:{state:lot('PAUSED_ADAPTER_UNRESPONSIVE',4811,{pauseReason:'adapter-unresponsive'})},
 rattrapage:{state:{...fin(),passeDifferes:{etat:'ecriture',mode:'ecriture',lotId:'lot-1',cut:4803,ecrites:1,demandees:3}}},
 relecture:{state:finRel,rel:{choix:'corriger',lot:{id:'lot-1'},passe:{lotId:'lot-1',etat:'en-cours',mode:'corriger',modeEffectif:'corriger',faits:12,total:85,corriges:3,cut:4801,reprise:true,pauseDemandee:false,pauseRaison:null,expire:null}}},
 fin:{state:fin()},
};
(async()=>{
 const {chromium}=require(navigateur.modulePlaywright());const nav=await chromium.launch({executablePath:navigateur.executable()});const bilan={};
 for(const theme of ['sombre','clair'])for(const [taille,vue] of [['600',{width:600,height:760}],['360',{width:360,height:480}]])for(const [nom,e] of Object.entries(E)){
  const ctx=await nav.newContext({viewport:vue,deviceScaleFactor:2});const page=await ctx.newPage();const erreurs=[];page.on('pageerror',x=>erreurs.push(x.message));
  const state=JSON.parse(JSON.stringify({connection:{status:nom==='panne'?'ready':'ready',observedAt:'t',message:null,tabId:1},...e.state}).replace(/"MAINTENANT-(\d+)"/g,(_,s)=>JSON.stringify(new Date(Date.now()-s*1000).toISOString())));
  await page.addInitScript(({state,rel})=>{
   const reponses={view:state,'list-tabs':[{id:1,title:'ESV',pret:true,utilise:true,index:0,windowId:1,active:true}],'choix-lot-etat':{clicHumain:'tel-quel',regleGrappeDifferes:false},'raison-choix-etat':{actif:false,touches:'chiffres'},
    'relecture-choix-etat':{mode:'corriger'},'relecture-etat':rel,'bandeau-etat':{on:false},'fiches-depart':{fiches:[]}};
   const stockage={};
   window.fetch=async()=>({json:async()=>({totaux:{tous:{corriges:2731}},creeLe:'2026-10-20T08:00:00Z'})});
   window.chrome={runtime:{id:'essai',getURL:p=>new URL(p,location.href).href,connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async m=>({result:m.action in reponses?reponses[m.action]:{}})},
    storage:{local:{get:async()=>({...stockage}),set:async o=>{Object.assign(stockage,o);}}},windows:{getCurrent:async()=>({id:1,type:'normal',width:600,height:760}),update:async()=>({})}};
  },{state,rel:e.rel||{choix:'corriger',lot:null,passe:null}});
  await ouvrirPanneau(page,'#automatic');await page.waitForTimeout(1300);
  if(theme==='clair'){await page.evaluate(()=>window.ArianeUi5.agir('sg:choix:theme:clair'));await page.waitForFunction(()=>document.getElementById('ui5').dataset.theme==='clair',null,{timeout:4000});await page.waitForTimeout(400);}
  await page.screenshot({path:path.join(SORTIE,`${theme}-${taille}-${nom}.png`)});
  if(theme==='sombre')bilan[`${taille}/${nom}`]={erreurs,texte:await page.evaluate(()=>(document.querySelector('#ui5 .sg-fen')?.innerText||'').replace(/\n+/g,' | ').slice(0,700))};
  await ctx.close();
 }
 await nav.close();for(const [k,v] of Object.entries(bilan))console.log(k,v.erreurs.join(';'),'\n  ',v.texte);
})().catch(e=>{console.error(e);process.exit(1);});
