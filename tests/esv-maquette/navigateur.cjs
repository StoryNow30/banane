'use strict';
/* navigateur.cjs — mécanique commune : Playwright/Chromium, serveur de la
 * maquette, injection du VRAI code de page d'Ariane (comme le fait
 * background.js, monde principal) et pont de commande côté essai. */
const path=require('node:path'),fs=require('node:fs');
const racine=path.resolve(__dirname,'../..');
const lire=f=>fs.readFileSync(path.join(racine,f),'utf8');
const PAGE_FILES=['vendor/capture-core.js','vendor/lidar.js','src/core.js','src/settings.js','src/lod-signature.js','src/merge-clouds.js','src/native-lidar.js','src/native-page.js','src/adapter-page.js'];
function playwright(){for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright','/opt/node22/lib/node_modules/playwright'].filter(Boolean)){try{return require(p);}catch{/* suivant */}}return null;}
function executable(){if(process.env.CHROMIUM)return process.env.CHROMIUM;const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';
  const d=fs.existsSync(base)?fs.readdirSync(base).find(x=>/^chromium-\d+$/.test(x)):null;return d?path.join(base,d,'chrome-linux','chrome'):undefined;}
/* Raison d'indisponibilité (chaîne) ou null si le navigateur peut tourner. */
function indisponible(){const pw=playwright();if(!pw)return 'Playwright absent (PLAYWRIGHT_MODULE=/chemin/vers/playwright)';
  const exe=executable();if(exe&&!fs.existsSync(exe))return 'Chromium absent : '+exe;return null;}
async function ouvrir(options={}){
  const {demarrer}=require('./serveur.cjs');const serveur=await demarrer();
  const pw=playwright();const navigateur=await pw.chromium.launch({executablePath:executable(),headless:true});
  const page=await navigateur.newPage({viewport:{width:1200,height:800}});const erreurs=[];
  page.on('pageerror',e=>erreurs.push(e.message));page.on('console',m=>{if(m.type()==='error')erreurs.push('console: '+m.text());});
  const q=new URLSearchParams(Object.entries(options.maquette||{}).map(([k,v])=>[k,String(v)]));
  await page.goto(`${serveur.url}/tests/esv-maquette/esv.html?${q}`);
  await page.evaluate(()=>window.__maquette.pret);
  await page.waitForFunction(()=>window.__maquette.etat().railsPrets);
  const version=JSON.parse(lire('manifest.json')).version;
  async function injecter(proprietaire='essai'){
    await page.addScriptTag({content:`window.__ARIANE_PROPRIETAIRE={id:${JSON.stringify(proprietaire)},version:${JSON.stringify(version)},versionName:'essai'};
      window.__messages=[];addEventListener('message',e=>{if(['banane3:releve','banane3:progress','banane4:native-event'].includes(e.data?.kind))window.__messages.push(e.data);});`});
    for(const f of PAGE_FILES)await page.addScriptTag({content:lire(f)});}
  const appel=(action,args=[],proprietaire='essai')=>page.evaluate(([action,args,proprietaire])=>new Promise(res=>{const id='i'+Math.random();
    const f=e=>{if(e.data?.kind==='banane3:result'&&e.data.id===id){removeEventListener('message',f);res(e.data);}};addEventListener('message',f);
    postMessage({kind:'banane3:command',id,channel:'essai',proprietaire,action,args,sentAt:Date.now()},location.origin);}),[action,args,proprietaire]);
  const etat=()=>page.evaluate(()=>window.__maquette.etat());
  const messages=(kind)=>page.evaluate(k=>window.__messages.filter(m=>!k||m.kind===k),kind);
  const fermer=async()=>{await navigateur.close();await serveur.fermer();};
  return {serveur,navigateur,page,erreurs,injecter,appel,etat,messages,fermer,PAGE_FILES};
}
module.exports={ouvrir,indisponible,playwright,executable,PAGE_FILES,racine,lire};
