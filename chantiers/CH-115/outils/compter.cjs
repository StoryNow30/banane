'use strict';
/* CH-115 : compte ce que le VRAI panneau montre d'emblée dans chaque état (états fabriqués de chantiers/CH-104/outils/capturer.cjs, API Chrome simulée).
 * Par état : blocs de texte visibles, mots, nombres, avis (tuiles d'avis, lignes de raison, verrou, barre d'état), boutons, tuiles.
 * Usage : CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-115/outils/compter.cjs [largeur=600] [hauteur=760] > sortie.json
 * FEUILLE_EN_PLUS=f.css : compte avec une feuille posée par-dessus (une direction de CH-115). Rien n'est écrit dans le dépôt. */
const path=require('node:path'),fs=require('node:fs');
const R=path.resolve(__dirname,'../../..');
const navigateur=require(R+'/tests/esv-maquette/navigateur.cjs'),{ouvrirPanneau}=require(R+'/tests/helpers/panneau-local.cjs');
const {E}=require(R+'/chantiers/CH-104/outils/capturer.cjs');
const W=Number(process.argv[2]||600),H=Number(process.argv[3]||760);
const COMPTE=()=>{
 const P=document.querySelector('#ui5 .sg-fen');if(!P)return null;
 const vu=e=>{if(e.closest('[inert]')||e.closest('[aria-hidden="true"]'))return false;const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return false;if(r.bottom<0||r.top>innerHeight)return false;
  for(let x=e;x&&x!==document.body;x=x.parentElement){const s=getComputedStyle(x);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<0.05)return false;}return true;};
 const blocs=[];for(const e of P.querySelectorAll('*')){if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;if(!vu(e))continue;blocs.push(e);}
 const texte=blocs.map(e=>[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ')).join(' ');
 const mots=(texte.match(/[\p{L}\p{N}’']+/gu)||[]).length,nombres=(texte.match(/\d+(?:[,.]\d+)?/g)||[]).length;
 const sel=q=>[...P.querySelectorAll(q)].filter(vu);
 const avis=sel('.sg-tu-avis,.sg-raison,.sg-verrou-ligne,.sg-barre-etat,.sg-file-alerte,.sg-file-attente,.sg-note-ligne').map(e=>e.innerText.trim().replace(/\s+/g,' ').slice(0,160));
 const notes=sel('.sg-meta,.sg-of-note,.sg-corr-note,.sg-allure,.sg-lot-bornes').map(e=>e.innerText.trim().replace(/\s+/g,' ').slice(0,160));
 return {blocs:blocs.length,mots,nombres,boutons:sel('button:not([role="tab"])').length,tuiles:sel('.sg-tu').length,avis,notes,lignesFil:sel('.sg-fil li').length};};
(async()=>{
 const {chromium}=require(navigateur.modulePlaywright());const nav=await chromium.launch({executablePath:navigateur.executable()});const out={};
 for(const [nom,e] of Object.entries(E)){if(e.origine||e.actions?.length)continue;
  const ctx=await nav.newContext({viewport:{width:W,height:H}});const page=await ctx.newPage();
  const state=JSON.parse(JSON.stringify({connection:e.connexion||{status:'ready',observedAt:'t',message:null,tabId:1},...e.state}).replace(/"MAINTENANT-(\d+)"/g,(_,s)=>JSON.stringify(new Date(Date.now()-s*1000).toISOString())));
  await page.addInitScript(({state,rel,fiches,onglets})=>{const reponses={view:state,'list-tabs':onglets||[{id:1,title:'ESV',pret:true,utilise:true,index:0,windowId:1,active:true}],'choix-lot-etat':{clicHumain:'tel-quel',regleGrappeDifferes:false},'raison-choix-etat':{actif:false,touches:'chiffres'},'relecture-choix-etat':{mode:'corriger'},'relecture-etat':rel,'bandeau-etat':{on:false},'fiches-depart':{fiches}};const st={};
   window.fetch=async()=>({json:async()=>({totaux:{tous:{corriges:2731}},creeLe:'2026-10-20T08:00:00Z'})});
   window.chrome={runtime:{id:'essai',getURL:p=>new URL(p,location.href).href,connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),sendMessage:async m=>({result:m.action in reponses?reponses[m.action]:{}})},storage:{local:{get:async()=>({...st}),set:async o=>{Object.assign(st,o);}}},windows:{getCurrent:async()=>({id:1,type:'normal',width:600,height:760}),update:async()=>({})}};
  },{state,rel:e.rel||{choix:'corriger',lot:null,passe:null},fiches:e.fiches||[],onglets:e.onglets||null});
  await ouvrirPanneau(page,e.hash||'#automatic');await page.waitForTimeout(1200);
  if(process.env.FEUILLE_EN_PLUS)await page.addStyleTag({content:fs.readFileSync(process.env.FEUILLE_EN_PLUS,'utf8')});
  if(e.file){await page.evaluate(()=>window.ArianeUi5.agir('sg:onglet-file'));await page.waitForTimeout(300);if(typeof e.file==='number'){await page.evaluate(n=>window.ArianeUi5.agir('sg:file-n:'+n),e.file);await page.waitForTimeout(900);}}
  await page.waitForTimeout(600);out[nom]=await page.evaluate(COMPTE);await ctx.close();}
 await nav.close();console.log(JSON.stringify(out,null,1));
})().catch(e=>{console.error(e);process.exit(1);});
