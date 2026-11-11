'use strict';
/* CH-105 : photographie de la MOLETTE du nombre de parties et de la CHAÎNE des parties dans le vrai panneau (Constellation prête, en cours, arrêtée,
 * terminée ; boîte « Constellation » d'Orbite), à 600, 360 et 320 de large, sombre et clair. Données fabriquées (tests/helpers/signal-file.cjs), API
 * Chrome simulée, rien n'est envoyé à ESV.
 * Usage : CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-105/outils/capturer.cjs DOSSIER_HORS_DEPOT
 * Les images ne vont JAMAIS dans le dépôt (interdit de CLAUDE.md). */
const path=require('node:path'),fs=require('node:fs');
const R=path.resolve(__dirname,'../../..');
const {CHROMIUM,PW,absent,ouvrir}=require(R+'/tests/helpers/signal-navigateur.cjs');
const {FILE,poserEtat}=require(R+'/tests/helpers/signal-file.cjs');
const SORTIE=process.argv[2];
if(!SORTIE){console.error('Dossier de sortie (hors dépôt) attendu.');process.exit(2);}
if(path.resolve(SORTIE).startsWith(R+path.sep)){console.error('Le dossier de sortie doit être hors du dépôt.');process.exit(2);}
if(absent){console.error('Chromium absent.');process.exit(2);}
fs.mkdirSync(SORTIE,{recursive:true});
const plan=n=>[...Array(n)].map((_,i)=>101+i);
const cours=(n,rang)=>({...FILE.lot,fileParties:{...FILE.lot.fileParties,n,plan:plan(n),rang,enCours:{part:101+rang,rang,lot:true},
 bilan:[...Array(rang)].map((_,i)=>({part:101+i,rang:i,issueLot:'fin',motifs:[],resume:{poses:80+i,differes:3},passe:null,relecture:{issue:'finie',corriges:2},alertes:[]}))}});
const CAS=[
 ['prete-2',FILE.prete,null],['prete-7',FILE.prete,7],['prete-12',FILE.prete,12],['prete-20',FILE.prete,20],['prete-1',FILE.prete,1],
 ['cours-12',cours(12,5),null],['cours-20',cours(20,13),null],['arret',FILE.arret,9],['fin',FILE.fin,12],
];
(async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  for(const theme of ['sombre','clair'])for(const width of [600,360,320]){
   const {page,erreurs}=await ouvrir(nav,FILE.prete,{width,height:width===600?760:480});
   await page.evaluate(()=>{const z=document.createElement('style');z.textContent='*{caret-color:transparent!important}';document.head.appendChild(z);});
   if(theme==='clair'){await page.evaluate(()=>window.ArianeUi5.agir('sg:choix:theme:clair'));await page.waitForTimeout(300);}
   await page.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]');await page.waitForTimeout(300);
   for(const [nom,st,n] of CAS){
    await poserEtat(page,st);
    if(n)await page.evaluate(n=>window.ArianeUi5.agir('sg:file-n:'+n),n);
    await page.waitForTimeout(500);
    /* la tuile du choix dans le champ, sinon le haut */
    await page.evaluate(()=>{const t=document.querySelector('#ui5 .sg-tu-choix');t?.scrollIntoView({block:'nearest'});});await page.waitForTimeout(100);
    await page.screenshot({path:path.join(SORTIE,`${theme}-${width}-${nom}.png`)});
   }
   /* la boîte « Constellation » d'Orbite */
   await poserEtat(page,FILE.prete);await page.click('#ui5 .sg-bascule [data-act="mode:automatic"]');await page.waitForTimeout(300);
   await page.click('#ui5 [data-act="sg:file"]');await page.waitForTimeout(300);await page.evaluate(()=>window.ArianeUi5.agir('sg:file-n:14'));await page.waitForTimeout(500);
   await page.screenshot({path:path.join(SORTIE,`${theme}-${width}-boite.png`)});
   if(erreurs.length)console.log(theme,width,'erreurs',erreurs);
   await page.close();
  }
 }finally{await nav.close();}
 console.log('photos dans',SORTIE);
})().catch(e=>{console.error(e);process.exit(1);});
