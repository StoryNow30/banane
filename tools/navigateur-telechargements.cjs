#!/usr/bin/env node
'use strict';
/*
 * navigateur-telechargements.cjs — essai, dans un vrai Chromium, des
 * téléchargements confirmés du panneau (4.8.0, audit qualité 4.8, D01 et D03).
 * L'extension est chargée depuis DOSSIER (dépôt ou paquet décompressé), le
 * panneau Orbite est ouvert, un export est cliqué, puis la ligne d'état et
 * l'état final de chaque téléchargement (chrome.downloads) sont relevés.
 * « refus » : Chromium refuse les téléchargements (état interrupted,
 * USER_CANCELED), comme un navigateur qui bloque une série de fichiers.
 *
 *   node tools/navigateur-telechargements.cjs DOSSIER [accepte|refus] [journal|export-tout]
 *
 * Nécessite Playwright et Chromium (PLAYWRIGHT_BROWSERS_PATH ou CHROMIUM).
 * Hors du banc (node tools/verify.cjs) : il dépend du navigateur installé.
 */
const path=require('node:path'),fs=require('node:fs');
function chromium(){for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright','/opt/node22/lib/node_modules/playwright'].filter(Boolean)){try{return require(p).chromium;}catch{/* suivant */}}
  throw Error('Playwright introuvable (PLAYWRIGHT_MODULE=/chemin/vers/playwright).');}
function executable(){if(process.env.CHROMIUM)return process.env.CHROMIUM;const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';
  const d=fs.existsSync(base)?fs.readdirSync(base).find(x=>/^chromium-\d+$/.test(x)):null;return d?path.join(base,d,'chrome-linux','chrome'):undefined;}
async function essai(dossier,{accepte=true,bouton='journal'}={}){
  const ctx=await chromium().launchPersistentContext('',{executablePath:executable(),headless:true,acceptDownloads:accepte,
    args:['--headless=new',`--disable-extensions-except=${dossier}`,`--load-extension=${dossier}`]});
  try{const sw=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker',{timeout:15000}),id=sw.url().split('/')[2];
    const erreurs=[],p=await ctx.newPage();p.on('pageerror',e=>erreurs.push(e.message));
    await p.goto(`chrome-extension://${id}/panel.html#automatic`);await p.waitForTimeout(1200);
    await p.evaluate(b=>document.getElementById(b).click(),bouton);
    let statut='';for(let i=0;i<80&&!statut;i++){await p.waitForTimeout(250);statut=await p.evaluate(()=>document.getElementById('export-status')?.textContent||'');}
    const telechargements=await p.evaluate(()=>new Promise(r=>chrome.downloads.search({},l=>r(l.map(d=>({etat:d.state,erreur:d.error||null}))))));
    return {accepte,bouton,version:await sw.evaluate(()=>globalThis.BananeCore3?.VERSION),statut,telechargements,erreurs};}
  finally{await ctx.close();}}
if(require.main===module){const [dossier,mode='accepte',bouton='journal']=process.argv.slice(2);
  if(!dossier){console.error('Usage : DOSSIER [accepte|refus] [journal|export-tout]');process.exit(1);}
  essai(path.resolve(dossier),{accepte:mode!=='refus',bouton}).then(r=>console.log(JSON.stringify(r,null,1)),e=>{console.error(e.message);process.exitCode=1;});}
module.exports={essai};
