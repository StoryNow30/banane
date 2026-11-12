'use strict';
/* CH-026 — L'ONGLET « File de parties » DE SIGNAL, DANS UN VRAI NAVIGATEUR (ignoré s'il n'y a pas de Chromium, et dit ignoré). Montage :
 * tests/helpers/signal-navigateur.cjs (service worker simulé), états de tests/helpers/signal-file.cjs, départs des parties fabriqués. Maquette :
 * Figma, page « CH-026 · Onglet File de parties ». Mesures : 0 erreur de console, 0 débordement de 360 à 600 px, contraste ≥ 4,5:1, sombre et clair ;
 * chaque bouton de l'onglet envoie ce qu'envoie le bouton d'origine. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,ouvrir}=require('./helpers/signal-navigateur.cjs');
const {FILE,parLargeurs,poserEtat,verifier}=require('./helpers/signal-file.cjs');

const FICHES=[{at:'2026-10-30T14:21:56.620Z',batchId:'b1',ignores:0,invalides:165,partie:13,total:9305,valides:9140,version:'x'},
 {at:'2026-10-30T14:40:10.000Z',batchId:'b2',ignores:12,invalides:493,partie:14,total:9305,valides:8800,version:'x'}];
const ARRET={...FILE.arret,fileParties:{...FILE.arret.fileParties,reprise:{rang:1,part:14,reste:1}}};
const EXTRA='.sg-chaine .sg-mono,.sg-onglet-file .sg-of-t,.sg-onglet-file .sg-meta,.sg-onglet-file .sg-of-depart [role="cell"],.sg-onglet-file .sg-of-depart b,.sg-onglet-file .sg-of-ligne span,.sg-bascule button';

/* Panneau avec des fiches de départ, et un espion des messages de la file. */
async function monter(nav,state){
 const sig=await ouvrir(nav,state,{width:600,height:760});
 await sig.page.addInitScript(fiches=>{const f=window.chrome.runtime.sendMessage;window.__m=[];
  window.chrome.runtime.sendMessage=async m=>{if(/^(file-|settings$)/.test(m.action||''))window.__m.push(JSON.parse(JSON.stringify(m)));if(m.action==='fiches-depart')return {result:{fiches}};return f(m);};},FICHES);
 await sig.page.reload();await sig.page.waitForTimeout(700);
 return sig;
}
const messages=page=>page.evaluate(()=>window.__m.splice(0));

test('onglet « File » : prête, en cours, arrêtée avec alerte, finie ; 360 à 600, sombre et clair ; sans débordement ni contraste faible ni erreur',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM}),res={},vus={};
 try{
  const {page,erreurs}=await monter(nav,FILE.prete);
  await page.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]');await page.waitForTimeout(200);
  for(const [nom,st] of [['prete',FILE.prete],['lot',FILE.lot],['arret',ARRET],['fin',FILE.fin]]){
   if(nom!=='prete')await poserEtat(page,st);
   res[nom]=await parLargeurs(page,{extra:EXTRA});
   vus[nom]=await page.evaluate(()=>{const h=document.getElementById('ui5');return {onglet:h.querySelector('.sg-fen')?.dataset.activite,choisi:h.querySelector('.sg-bascule [aria-selected="true"]')?.textContent,
    titres:[...h.querySelectorAll('.sg-of-t')].map(e=>(e.firstElementChild||e).textContent),boutons:[...h.querySelectorAll('.sg-onglet-file button[data-act],.sg-actions button[data-act]')].map(b=>b.textContent.trim()+'|'+b.dataset.act),molette:h.querySelector('.sg-onglet-file [role="slider"]')?.getAttribute('aria-valuenow')??null,nombres:[...h.querySelectorAll('.sg-onglet-file .sg-mol-n[data-act]')].map(b=>b.textContent.trim()+'|'+b.dataset.act),
    departs:[...h.querySelectorAll('.sg-of-departs [role="row"]')].map(r=>[...r.querySelectorAll('[role="cell"]')].map(c=>c.textContent.trim())),bilan:h.querySelectorAll('.sg-file-bilan li,.sg-reg-partie:not([data-etat="en-cours"]):not([data-etat="interrompue"])').length,etoiles:[...h.querySelectorAll('.sg-chaine li')].map(e=>e.dataset.etat+':'+e.dataset.partie),tiroir:!!h.querySelector('.sg-tiroir')};});
  }
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
 for(const [nom,r] of Object.entries(res))verifier(assert,nom,r);
 for(const nom of Object.keys(vus)){assert.equal(vus[nom].onglet,'file',nom);assert.equal(vus[nom].choisi,'Constellation',nom);assert.equal(vus[nom].tiroir,false,nom+' : pas de tiroir dans l’onglet');
  assert.deepEqual(vus[nom].departs,[['14 · 30/10 15:40','493 invalides','8 800 validés · 12 sautés · 9 305 au total'],['13 · 30/10 15:21','165 invalides','9 140 validés · 0 sautés · 9 305 au total']],nom+' : départs, du plus récent, heure de Paris');}
 /* CH-036 (direction B « Cadran », 02/11) : la chaîne des parties (un maillon par partie, lue par `etoiles` ; CH-104), une action pleine, puis le bilan par partie (dès qu'une partie est faite) et les départs, visibles d'emblée. */
 assert.equal(res.prete['600'].mot,'Prête');assert.deepEqual(vus.prete.titres,['Départs des parties']);assert.deepEqual(vus.prete.etoiles,['a-venir:13','a-venir:+1']);
 assert.ok(vus.prete.boutons.some(b=>/^Lancer la Constellation · 2 parties\|legacy:file-lancer$/.test(b)),JSON.stringify(vus.prete.boutons));
 assert.equal(res.lot['600'].mot,'En cours');assert.deepEqual(vus.lot.etoiles,['en-cours:13','a-venir:14']);assert.equal(res.lot['360'].arreter,true);assert.equal(res.lot['600'].depart,false);
 assert.deepEqual(vus.lot.titres,['Bilan par partie','Départs des parties'],'pendant la file : pas de lancement ; le registre montre déjà la partie en cours (direction B)');
 assert.equal(res.arret['600'].mot,'Arrêtée');assert.deepEqual(vus.arret.etoiles,['faite:13','interrompue:14']);assert.deepEqual(vus.arret.titres,['Bilan par partie','Départs des parties']);assert.match(res.arret['600'].alerte,/ne change pas de partie/);
 assert.deepEqual(vus.arret.boutons.filter(b=>/file-(reprendre|lancer)/.test(b)),['Reprendre à la partie 14 · 1 restante|legacy:file-reprendre','Nouvelle Constellation · 2 parties|legacy:file-lancer']);
 assert.equal(vus.arret.bilan,1);
 /* CH-105 : la molette (1 à 20) remplace les six boutons. */
 for(const nom of ['prete','arret','fin']){assert.equal(vus[nom].molette,'2',nom+' : le nombre de parties se choisit (aussi après une file)');assert.ok(vus[nom].nombres.includes('3|sg:file-n:3'),nom);}
 assert.equal(vus.lot.molette,null,'pas pendant la file');assert.ok(!vus.lot.boutons.some(b=>/sg:file-n/.test(b))&&!vus.lot.nombres.length,'pas pendant la file');
 assert.equal(res.fin['600'].mot,'Terminée');assert.equal(vus.fin.bilan,2);
 assert.deepEqual(vus.fin.boutons.filter(b=>/file-lancer|export-tout/.test(b)),['Nouvelle Constellation · 2 parties|legacy:file-lancer','Exporter le dossier|legacy:export-tout']);
});
