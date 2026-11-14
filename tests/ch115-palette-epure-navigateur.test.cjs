'use strict';
/* CH-115 (D-350, D-353, D-354) — LE PANNEAU EN DIRECTION B, DANS UN VRAI NAVIGATEUR (ignoré, et dit ignoré, sans Chromium).
 *  - Épure : le détail (fil des cuts en texte, étapes, compteurs, bornes) est replié par défaut ; « Détails » l'ouvre et le referme, sans rien envoyer.
 *  - Constellation : la frise, l'état, le rang ; les temps, le bilan par partie et les départs d'ESV derrière « Bilan et départs ».
 *  - Palette : Glacier par défaut ; le réglage « Palette » bascule sur Sarcelle sans recharger (couleur de fond changée, même page) et garde le choix.
 *  - Vision 18 : la case d'essai de l'ajustement de hauteur est dans les réglages et passe par la case d'origine (`ajustement-hauteur`).
 *  - Un chiffre qui change roule : sa copie figée n'entre jamais dans le texte du chiffre.
 * Montage : tests/helpers/signal-navigateur.cjs ; états fabriqués de chantiers/CH-104/outils/capturer.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,ouvrir}=require('./helpers/signal-navigateur.cjs');
const {E,lot}=require('../chantiers/CH-104/outils/capturer.cjs');
const js=x=>JSON.parse(JSON.stringify(x));
const vu=sel=>`(()=>{const e=document.querySelector(${JSON.stringify(sel)});return !!e&&e.getClientRects().length>0&&getComputedStyle(e).display!=='none';})()`;

test('épure : le détail du lot est replié par défaut et « Détails » l’ouvre puis le referme, sans rien envoyer',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js(E.cours.state),{width:600,height:760});await page.waitForTimeout(600);
  assert.equal(await page.evaluate(vu('#ui5 .sg-etapes')),false,'étapes repliées');
  assert.equal(await page.evaluate(vu('#ui5 .sg-trio')),false,'compteurs repliés');
  assert.equal(await page.evaluate(vu('#ui5 .sg-lot-bornes')),false,'bornes repliées');
  assert.equal(await page.evaluate(vu('#ui5 .sg-phrase')),true,'la phrase reste');
  assert.equal(await page.evaluate(vu('#ui5 .sg-anneau')),true,'l’anneau reste');
  const avant=await page.evaluate(()=>[...new Set(window.__appels)]);
  await page.click('#ui5 [data-act="sg:details"]');await page.waitForTimeout(400);
  assert.equal(await page.evaluate(vu('#ui5 .sg-etapes')),true,'étapes ouvertes');
  assert.equal(await page.evaluate(vu('#ui5 .sg-trio')),true,'compteurs ouverts');
  assert.equal(await page.evaluate(()=>document.querySelector('#ui5 [data-act="sg:details"]').getAttribute('aria-expanded')),'true');
  await page.click('#ui5 [data-act="sg:details"]');await page.waitForTimeout(400);
  assert.equal(await page.evaluate(vu('#ui5 .sg-etapes')),false,'refermées');
  assert.deepEqual(await page.evaluate(a=>[...new Set(window.__appels)].filter(x=>!a.includes(x)),avant),[],'aucune sorte de message nouvelle (seules les lectures périodiques continuent)');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('Constellation : frise et rang d’emblée ; temps, bilan par partie et départs d’ESV derrière « Bilan et départs »',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js(E['file-passage'].state),{width:600,height:760});
  await page.evaluate(()=>window.ArianeUi5.agir('sg:onglet-file'));await page.waitForTimeout(500);
  assert.equal(await page.evaluate(vu('#ui5 .sg-chaine')),true,'la frise');
  assert.equal(await page.evaluate(vu('#ui5 .sg-constel-t')),true,'l’état et le rang');
  for(const s of ['#ui5 .sg-temps','#ui5 [data-k="bilan"]','#ui5 [data-k="departs"]'])assert.equal(await page.evaluate(vu(s)),false,s+' replié');
  assert.equal(await page.evaluate(()=>document.querySelector('#ui5 .sg-constel [data-act="sg:details"]')?.textContent),'Bilan et départs');
  await page.click('#ui5 .sg-constel [data-act="sg:details"]');await page.waitForTimeout(400);
  for(const s of ['#ui5 [data-k="bilan"]','#ui5 [data-k="departs"]'])assert.equal(await page.evaluate(vu(s)),true,s+' ouvert');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('palette : Glacier par défaut, Sarcelle sans recharger, choix gardé ; thème clair inchangé',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js(E.cours.state),{width:600,height:760});
  const etat=()=>page.evaluate(()=>({palette:document.getElementById('ui5').dataset.palette,fond:getComputedStyle(document.querySelector('#ui5 .sg-fen')).backgroundColor,chargement:performance.getEntriesByType('navigation').length,marque:window.__marque||null}));
  await page.evaluate(()=>{window.__marque='même page';});
  const a=await etat();assert.equal(a.palette,'glacier');
  await page.evaluate(()=>window.ArianeUi5.agir('sg:reglages'));await page.waitForTimeout(300);
  assert.ok(await page.evaluate(()=>!!document.querySelector('#ui5 [data-act="sg:choix:palette:sarcelle"]')),'le réglage Palette est dans les réglages');
  await page.click('#ui5 [data-act="sg:choix:palette:sarcelle"]');await page.waitForTimeout(500);
  const b=await etat();
  assert.equal(b.palette,'sarcelle');assert.equal(b.marque,'même page','sans recharger');assert.notEqual(b.fond,a.fond,'le fond a changé');
  assert.ok(await page.evaluate(()=>window.__ecrits.some(o=>o.banane51Palette==='sarcelle')),'choix gardé');
  await page.evaluate(()=>window.ArianeUi5.agir('sg:choix:theme:clair'));await page.waitForFunction(()=>document.getElementById('ui5').dataset.theme==='clair');await page.waitForTimeout(300);
  const c=await etat();
  await page.evaluate(()=>window.ArianeUi5.agir('sg:choix:palette:glacier'));await page.waitForTimeout(300);
  assert.equal((await etat()).fond,c.fond,'le thème clair ne dépend pas de la palette');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('Vision 18 : la case d’essai de l’ajustement de hauteur est dans les réglages et passe par la case d’origine',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js(E.pret.state),{width:600,height:760});
  await page.evaluate(()=>window.ArianeUi5.agir('sg:reglages'));await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.querySelector('#ui5 [data-act="sg:choix:ajustement:non"]')?.getAttribute('aria-pressed')),'true','coupé par défaut');
  await page.click('#ui5 [data-act="sg:choix:ajustement:oui"]');await page.waitForTimeout(400);
  assert.ok(await page.evaluate(()=>window.__appels.includes('ajustement-hauteur')),'la case d’origine envoie son action');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('chiffre qui roule : la copie de l’ancien chiffre n’entre pas dans son texte',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js(lot('RUNNING',4811,{cutStartedAt:new Date().toISOString()})),{width:600,height:760});await page.waitForTimeout(600);
  const avant=await page.evaluate(()=>document.querySelector('#ui5 .sg-anneau .sg-chiffre').textContent);
  await page.evaluate(s=>{window.__etat={connection:{status:'ready',observedAt:'t',message:null,tabId:1},...s};},js(lot('RUNNING',4815,{cutStartedAt:new Date().toISOString()})));
  await page.waitForFunction(a=>document.querySelector('#ui5 .sg-anneau .sg-chiffre').textContent!==a,avant,{timeout:4000});
  const r=await page.evaluate(()=>({texte:document.querySelector('#ui5 .sg-anneau .sg-chiffre').textContent,copie:!!document.querySelector('body>.sg-roule'),dedans:!!document.querySelector('#ui5 .sg-roule')}));
  assert.match(r.texte,/^\d+$/);assert.notEqual(r.texte,avant);assert.equal(r.dedans,false,'aucune copie dans le panneau dessiné');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('étroit (380 × 640), détails repliés : la ligne d’état est en haut de la tuile (moins de 20 px), en Orbite et en Constellation, sans chevaucher le contenu',{skip:absent,timeout:25000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const mesure=()=>({haut:(()=>{const t=document.querySelector('#ui5 .sg-tu-etat').getBoundingClientRect(),h=document.querySelector('#ui5 .sg-tu-etat>.sg-haut').getBoundingClientRect(),c=document.querySelector('#ui5 .sg-tu-etat :is(.sg-milieu,.sg-constel-t)').getBoundingClientRect();return {ecart:h.top-t.top,chevauche:h.bottom>c.top+0.5};})()});
  for(const [nom,etat,file] of [['Orbite',E.cours.state,false],['Orbite, à toi',E.toi.state,false],['Constellation',E['file-passage'].state,true]]){
   const {page,erreurs}=await ouvrir(nav,js(etat),{width:380,height:640});
   if(file){await page.evaluate(()=>window.ArianeUi5.agir('sg:onglet-file'));await page.waitForTimeout(500);}
   const r=(await page.evaluate(mesure)).haut;
   assert.ok(r.ecart<20,`${nom} : ligne d’état à ${r.ecart} px du haut de la tuile`);
   assert.equal(r.chevauche,false,`${nom} : la ligne d’état ne chevauche pas le contenu`);
   assert.deepEqual(erreurs,[]);await page.close();
  }
 }finally{await nav.close();}
});
