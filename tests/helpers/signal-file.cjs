'use strict';
/* CH-025 — états de la file de parties pour les essais de navigateur de Signal : la vue `fileParties` du service worker (src/file-parties.js `vue`)
 * posée sur les scénarios de tests/helpers/signal-navigateur.cjs. Données fabriquées. */
const {SC}=require('./signal-navigateur.cjs');
const partie=(part,rang,poses,differes,corriges)=>({part,rang,issueLot:'fin',motifs:[],resume:{poses,differes},passe:null,relecture:{issue:'finie',corriges},alertes:[]});
const vue=(etat,o={})=>({id:'file-1',etat,n:2,plan:[13,14],rang:0,enCours:null,changement:null,bilan:[],motifFin:null,alerte:null,reprises:0,...o});
const P13=partie(13,0,112,6,3),P14=partie(14,1,98,4,2);
const FILE={
 prete:{...SC.repos,fileParties:null},
 lot:{...SC.lot,fileParties:vue('lot',{enCours:{part:13,rang:0,lot:true}})},
 passe:{...SC.fin,passeDifferes:{etat:'ecriture',mode:'ecriture',lotId:'lot-1',cut:4813,ecrites:1,demandees:3},fileParties:vue('passe',{enCours:{part:13,rang:0,lot:true}})},
 relecture:{...SC.fin,fileParties:vue('relecture',{enCours:{part:13,rang:0,lot:true}})},
 changement:{...SC.fin,fileParties:vue('changement',{changement:{vers:14,tentatives:1},bilan:[P13]})},
 arret:{...SC.fin,fileParties:vue('arret',{rang:1,bilan:[P13],motifFin:{code:'changement-impossible',texte:'la page d’ESV ne change pas de partie',detail:'60 s sans la partie 14'},
  alerte:{code:'changement-impossible',texte:'la page d’ESV ne change pas de partie',detail:'60 s sans la partie 14',part:13}})},
 arretLotOuvert:{...SC.incident,fileParties:vue('arret',{bilan:[],motifFin:{code:'esv-muet',texte:'ESV ne répond plus'},alerte:{code:'esv-muet',texte:'ESV ne répond plus',part:13}})},
 fin:{...SC.fin,fileParties:vue('fin',{rang:2,bilan:[P13,P14]})},
};
/* Mesure d'un écran de Signal : mot d'état, débordement horizontal (la fenêtre, et tout élément visible qui sort à droite), contraste du texte de la file
 * (bandeau, bilan, boîte, incident, mot, phrase, boutons), calculé contre le premier fond opaque des parents, en WCAG 2.1.
 * Les séparateurs « · » (`.sg-sep`, décoratifs, couleur de tout Signal) ne portent aucune information : ils ne sont pas mesurés. */
function mesurer(page){return page.evaluate(()=>{
 const h=document.getElementById('ui5'),f=h.querySelector('.sg-fen'),W=document.documentElement.clientWidth;
 const rgb=c=>{const m=String(c).match(/rgba?\(([^)]+)\)/);if(!m)return null;const v=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return {r:v[0],g:v[1],b:v[2],a:v.length>3?v[3]:1};};
 const lum=({r,g,b})=>{const t=x=>{x/=255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4;};return .2126*t(r)+.7152*t(g)+.0722*t(b);};
 const fond=e=>{const pile=[];for(let x=e;x;x=x.parentElement){const c=rgb(getComputedStyle(x).backgroundColor);if(c&&c.a>0){pile.push(c);if(c.a>=1)break;}}
  let r=pile.pop()||{r:0,g:0,b:0,a:1};while(pile.length){const c=pile.pop();r={r:c.r*c.a+r.r*(1-c.a),g:c.g*c.a+r.g*(1-c.a),b:c.b*c.a+r.b*(1-c.a),a:1};}return r;};
 const contraste=e=>{const c=rgb(getComputedStyle(e).color),b=fond(e);if(!c)return 21;const k={r:c.r*c.a+b.r*(1-c.a),g:c.g*c.a+b.g*(1-c.a),b:c.b*c.a+b.b*(1-c.a)};const [l1,l2]=[lum(k),lum(b)].sort((a,b)=>b-a);return (l1+.05)/(l2+.05);};
 const vus=[...h.querySelectorAll('.sg-file,.sg-file *,.sg-file-bilan,.sg-file-bilan *,.sg-boite,.sg-boite *,.sg-incident p,.sg-mot,.sg-phrase,.sg-actions button')].filter(e=>e.getClientRects().length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!e.disabled&&!e.closest('[disabled]')&&!e.classList.contains('sg-sep'));
 const faibles=vus.map(e=>({t:e.textContent.trim().slice(0,40),c:Math.round(contraste(e)*100)/100})).filter(x=>x.c<4.5);
 const sortants=[...h.querySelectorAll('.sg-instrument *,.sg-boite *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>W+1;}).map(e=>e.className||e.tagName);
 return {mot:f.querySelector('.sg-mot')?.textContent,deborde:f.scrollWidth>f.clientWidth+1,sortants,faibles,file:!!h.querySelector('.sg-file'),boite:!!h.querySelector('.sg-boite'),
  arreter:!!h.querySelector('[data-act="legacy:file-secondaire"]'),principal:h.querySelector('.sg-principal')?.textContent?.trim()||'',bilan:h.querySelectorAll('.sg-file-bilan li').length,
  depart:!!h.querySelector('[data-act="legacy:start-batch"],[data-act="legacy:new-batch"]'),alerte:h.querySelector('[role="alert"]')?.textContent?.trim()||''};});}
const LARGEURS=[{width:600,height:760},{width:480,height:640},{width:360,height:480}];
/* Pour chaque largeur (puis en thème clair, en 600 × 760) : la mesure de l'écran, la boîte rouverte si `boite`. */
async function parLargeurs(page,{boite=false}={}){
 const res={};
 const ouvrirBoite=async()=>{if(boite&&!(await page.$('#ui5 .sg-boite'))){await page.click('#ui5 [data-act="sg:file"]');await page.waitForTimeout(250);}};
 for(const v of LARGEURS){await page.setViewportSize(v);await page.waitForTimeout(200);await ouvrirBoite();res[`${v.width}`]=await mesurer(page);}
 /* Le choix de thème de Signal (réglages, `sg:choix:theme:…`) : il clique le bouton d'origine autant qu'il faut. */
 await page.setViewportSize(LARGEURS[0]);await page.evaluate(()=>window.ArianeUi5.agir('sg:choix:theme:clair'));
 await page.waitForFunction(()=>document.getElementById('ui5').dataset.theme==='clair',null,{timeout:2500});await page.waitForTimeout(100);await ouvrirBoite();
 res.clair={...await mesurer(page),theme:await page.evaluate(()=>document.getElementById('ui5').dataset.theme)};
 await page.evaluate(()=>window.ArianeUi5.agir('sg:choix:theme:sombre'));await page.waitForFunction(()=>document.getElementById('ui5').dataset.theme==='sombre',null,{timeout:2500});
 return res;
}
/* Un nouvel état, rendu par le panneau (relecture de la vue chaque seconde) : `window.__etat` est ce que répond `view`. */
async function poserEtat(page,state){await page.evaluate(s=>{window.__etat={connection:{status:'ready',observedAt:'t',message:null,tabId:1},...s};},state);await page.waitForTimeout(1300);}
function verifier(assert,nom,res){for(const [k,r] of Object.entries(res)){
 assert.equal(r.deborde,false,`${nom} ${k} : rien ne déborde`);assert.deepEqual(r.sortants,[],`${nom} ${k} : aucun élément ne sort à droite`);
 assert.deepEqual(r.faibles,[],`${nom} ${k} : contraste d’au moins 4,5:1`);}}
module.exports={FILE,mesurer,parLargeurs,poserEtat,verifier,LARGEURS};
