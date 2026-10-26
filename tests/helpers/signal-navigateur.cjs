'use strict';
/* UI 5.0 « Signal » (D-250) : montage commun des essais de navigateur de Signal (tests/ui5-navigateur-signal-*.test.cjs). panel.html est chargé avec une
 * API Chrome simulée (comme tools/ui5-navigateur.cjs) ; rien n'est envoyé à ESV. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const CHROMIUM=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',PW=process.env.PLAYWRIGHT_PATH||'/opt/node-tools/node_modules/playwright';
const absent=!fs.existsSync(CHROMIUM)||!fs.existsSync(PW)?'Chromium ou Playwright absent : essai de navigateur ignoré':false;
const N=require('../../tools/ui5-navigateur.cjs'),CAPTURES=process.env.SIGNAL_CAPTURES||'';
const FIN=N.lot('COMPLETED',{activeIdentity:null,processed:Array.from({length:19},(_,i)=>({identity:{part:13,cut:4790+i},cut:4790+i,durationMs:6000+i*150}))});
const SC={repos:N.SCENARIOS.repos.state,lot:N.lot('RUNNING',{cutStartedAt:new Date(Date.now()-4000).toISOString(),processed:Array.from({length:19},(_,i)=>({identity:{part:13,cut:4790+i},cut:4790+i,durationMs:6000+i*150}))}),
 pause:N.lot('PAUSED'),incident:N.SCENARIOS.incident.state,fin:FIN,echo:N.SCENARIOS.echo.state,accueil:N.SCENARIOS.accueil.state};

async function ouvrir(nav,state,vue,hash='#automatic'){
 /* Connexion T21 : le service worker rend toujours `connection` ; ici, l'onglet 1 de `list-tabs`, prêt, sauf si l'essai en donne une. */
 state={connection:{status:'ready',observedAt:'t',message:null,tabId:1},...state};
 const page=await nav.newPage({viewport:vue}),erreurs=[];
 page.on('pageerror',e=>erreurs.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR_FILE_NOT_FOUND/.test(m.text()))erreurs.push('console: '+m.text());});
 await page.addInitScript(({state,racine})=>{
  const reponses={view:state,'list-tabs':[{id:1,title:'ESV',pret:true,utilise:true,index:0,windowId:1,active:true}],'choix-lot-etat':{clicHumain:'tel-quel',regleGrappeDifferes:false},'raison-choix-etat':{actif:false,touches:'chiffres'},
   'relecture-choix-etat':{mode:'corriger'},'relecture-etat':{choix:'corriger',lot:null,passe:null},'bandeau-etat':{on:false},'fiches-depart':{fiches:[]}};
  const stockage={};window.__appels=[];window.__ecrits=[];
  window.fetch=async()=>({json:async()=>({totaux:{tous:{corriges:2731}},creeLe:'2026-10-20T08:00:00Z'})});
  window.chrome={runtime:{id:'essai',getURL:p=>'file://'+racine+'/'+p,connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
   sendMessage:async m=>{window.__appels.push(m.action||m.kind);if(m.action==='view'&&window.__etat)return {result:window.__etat};return {result:m.action in reponses?reponses[m.action]:{}};}},
   storage:{local:{get:async()=>({...stockage}),set:async o=>{Object.assign(stockage,o);window.__ecrits.push(o);}}},windows:{getCurrent:async()=>({id:1,type:'normal',width:600,height:760}),update:async()=>({})}};
 },{state,racine:path.resolve(__dirname,'../..')});
 await page.goto('file://'+path.resolve(__dirname,'../..','panel.html')+hash);
 await page.waitForTimeout(600);
 return {page,erreurs};
}


module.exports={CHROMIUM,PW,absent,N,CAPTURES,SC,ouvrir};
