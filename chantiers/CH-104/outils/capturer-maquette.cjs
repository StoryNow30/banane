'use strict';
/* CH-104 : photographie de la maquette de référence (maquettes/bento/panneau-graphite.html) dans ses treize états, aux deux tailles.
 * La police Inter de la maquette vient de l'extérieur : ici elle est servie depuis fonts/ (même fichier que l'extension).
 * Usage : CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-104/outils/capturer-maquette.cjs DOSSIER_HORS_DEPOT */
const path=require('node:path'),fs=require('node:fs');
const R=path.resolve(__dirname,'../../..'),navigateur=require(R+'/tests/esv-maquette/navigateur.cjs');
const SORTIE=process.argv[2];if(!SORTIE){console.error('Dossier de sortie (hors dépôt) attendu.');process.exit(2);}
fs.mkdirSync(SORTIE,{recursive:true});
const ORBITE=['pret','cours','pause','toi','panne','rattrapage','relecture','fin'],FILE=['repos','cours','passage','arret','fin'];
(async()=>{
 const {chromium}=require(navigateur.modulePlaywright());const nav=await chromium.launch({executablePath:navigateur.executable()});
 const ctx=await nav.newContext({viewport:{width:1100,height:1100},deviceScaleFactor:2});const page=await ctx.newPage();
 const police=fs.readFileSync(R+'/fonts/Inter-latin-opsz-wght.woff2').toString('base64');
 await page.route(/fonts\.googleapis\.com/,r=>r.fulfill({contentType:'text/css',body:`@font-face{font-family:"Inter";font-weight:100 900;src:url(data:font/woff2;base64,${police}) format("woff2")}`}));
 await page.goto('file://'+R+'/maquettes/bento/panneau-graphite.html');await page.waitForTimeout(600);
 const photos=async nom=>{await page.waitForTimeout(1100);for(const t of ['360','600'])await (await page.$(`.pan[data-taille="${t}"]`)).screenshot({path:path.join(SORTIE,`maquette-${t}-${nom}.png`)});};
 await page.click('#commandes [data-lecture]');
 for(const e of ORBITE){await page.click(`#commandes [data-e="${e}"]`);await photos(e);}
 await page.evaluate(()=>document.querySelectorAll('.pan [data-onglets] button')[2].click());await page.waitForTimeout(300);
 await page.click('#commandes-file [data-lecture]').catch(()=>{});
 for(const f of FILE){await page.click(`#commandes-file [data-f="${f}"]`);await photos('file-'+f);}
 await nav.close();console.log('maquette photographiée :',ORBITE.length+FILE.length,'états × 2 tailles');
})().catch(e=>{console.error(e);process.exit(1);});
