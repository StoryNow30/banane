#!/usr/bin/env node
'use strict';
/*
 * navigateur-contrat-rail.cjs — H14 (audit P-5, fiches/FIABILITE_LOT.md) sur l'ESV LOCAL : l'extension de CE dépôt (ou --extension DOSSIER)
 * est chargée dans un vrai Chromium, l'hôte d'ESV est routé vers la maquette ESV (tests/esv-maquette de la branche
 * claude/esv-locale-audit, aucun code ni contenu d'ESV ; DOSSIER = racine d'une copie de cette branche, voir fiches/AUDIT_ESV_LOCALE.md),
 * puis, par les messages du panneau :
 *   1. « Connecter » dans l'état de départ de la maquette (aucun rail sélectionné) ;
 *   2. clic sur le bouton du rail gauche dans la maquette (comme Mic), puis « Connecter » ;
 *   3. clic sur le bouton du rail droit, puis « Connecter ».
 * Rend les événements `contrat-esv` (empreinte, précédente, changement, sélection consignée) et `avis-contrat-esv` du journal, et l'avis du
 * panneau. Attendu depuis la correction : une seule empreinte, 0 avis. Aucune commande de pose, de validation ni de navigation n'est envoyée ;
 * les commandes de la page reçues par la maquette sont rendues (`commandesPage`) pour le montrer.
 *
 *   node tools/navigateur-contrat-rail.cjs --maquette DOSSIER [--extension DOSSIER] [--json SORTIE.json]
 *
 * Nécessite Playwright et Chromium (PLAYWRIGHT_BROWSERS_PATH, défaut /opt/pw-browsers ; ou CHROMIUM=…). Hors du banc `verify`. Lancer avec `nice`.
 */
const path=require('node:path'),fs=require('node:fs');
const arg=(nom,def=null)=>{const i=process.argv.indexOf(nom);return i>0?process.argv[i+1]:def;};
function playwright(){for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright','/opt/node22/lib/node_modules/playwright'].filter(Boolean)){try{return require(p);}catch{/* suivant */}}
  throw Error('Playwright introuvable (PLAYWRIGHT_MODULE=/chemin/vers/playwright).');}
function executable(){if(process.env.CHROMIUM)return process.env.CHROMIUM;const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';
  const d=fs.existsSync(base)?fs.readdirSync(base).find(x=>/^chromium-\d+$/.test(x)):null;return d?path.join(base,d,'chrome-linux','chrome'):undefined;}
const dormir=ms=>new Promise(r=>setTimeout(r,ms));

async function releve({maquette,extension=path.join(__dirname,'..')}){
  maquette=maquette?path.resolve(maquette):null;extension=path.resolve(extension);
  if(!maquette||!fs.existsSync(path.join(maquette,'tests/esv-maquette/serveur.cjs')))throw Error('--maquette DOSSIER : racine d\'une copie de la branche claude/esv-locale-audit (tests/esv-maquette).');
  const manifeste=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));
  /* L'hôte d'ESV vient du manifeste de l'extension ; il n'est écrit nulle part ici. */
  const hote=new URL(manifeste.host_permissions[0].replace(/\*$/,'')),origine=hote.origin,prefixe=hote.pathname;
  const {demarrer}=require(path.join(maquette,'tests/esv-maquette/serveur.cjs'));const serveur=await demarrer();
  const ctx=await playwright().chromium.launchPersistentContext('',{executablePath:executable(),headless:true,viewport:{width:1200,height:800},
    args:['--headless=new',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const erreurs=[],commandesPage=[];
  try{
    await ctx.route(origine+'/**',async route=>{const u=new URL(route.request().url());let chemin=u.pathname;
      if(chemin.startsWith(prefixe)){const reste=chemin.slice(prefixe.length);chemin='/tests/esv-maquette/'+(reste===''||reste==='maquette'?'esv.html':reste);}
      try{const r=await route.fetch({url:serveur.url+chemin+u.search});await route.fulfill({response:r});}catch(e){erreurs.push('route : '+e.message);await route.abort();}});
    for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await dormir(250);
    const sw=ctx.serviceWorkers()[0];if(!sw)throw Error('Service worker de l’extension absent : extension non chargée.');
    const id=sw.url().split('/')[2];
    const esv=await ctx.newPage();esv.on('pageerror',e=>erreurs.push('esv : '+e.message));
    await esv.goto(`${origine}${prefixe}maquette?cuts=6&debut=100&cut=100&latence=20`);
    await esv.evaluate(()=>window.__maquette.pret);await esv.waitForFunction(()=>window.__maquette.etat().railsPrets);
    /* Les commandes que la page reçoit d'Ariane (pont → adaptateur) : relevées dans la page, sans rien y changer. */
    await esv.evaluate(()=>{window.__commandes=[];addEventListener('message',e=>{if(e.data?.kind==='banane3:command')window.__commandes.push(e.data.action);});});
    const panneau=await ctx.newPage();panneau.on('pageerror',e=>erreurs.push('panneau : '+e.message));
    await panneau.goto(`chrome-extension://${id}/panel.html#automatic`);await dormir(600);
    const api=async(action,a={})=>{const r=await panneau.evaluate(([action,a])=>chrome.runtime.sendMessage({kind:'panel',action,args:a}),[action,a]);if(r?.error)throw Error(`${action} : ${r.error}`);return r?.result;};
    const onglets=await api('list-tabs');const onglet=onglets.find(t=>/maquette/i.test(t.title||''))||onglets[0];if(!onglet)throw Error('Onglet ESV (maquette) introuvable.');
    const selection=()=>esv.evaluate(()=>['O2N3DCutLRClick','O2N3DCutRRClick'].map(i=>document.getElementById(i).className));
    const etapes=[];
    const connecter=async nom=>{await api('connect',{tabId:onglet.id});await dormir(700);etapes.push({etape:nom,classesRail:await selection()});};
    await connecter('départ de la maquette (aucun rail sélectionné)');
    await esv.click('#O2N3DCutLRClick');await dormir(200);await connecter('rail gauche sélectionné (clic sur son bouton)');
    await esv.click('#O2N3DCutRRClick');await dormir(200);await connecter('rail droit sélectionné (clic sur son bouton)');
    const journal=await api('journal'),vue=await api('view');
    const ev=(journal.events||[]).slice().sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp)));
    const contrats=ev.filter(e=>e.type==='contrat-esv').map(e=>({hash:e.hash,precedent:e.precedent,change:e.change,changements:e.changements,forme:e.forme??null,
      railsCompares:e.detail?.rails??null,railsConsignes:e.etat?.rails??null}));
    const avis=ev.filter(e=>e.type==='avis-contrat-esv').map(e=>({motif:e.motif,texte:e.texte}));
    const r={version:manifeste.version,extension,etapes,contrats,avis,avisPanneau:vue?.avisContrat??null,
      empreintesDistinctes:[...new Set(contrats.map(c=>c.hash))],commandesPage:[...new Set(await esv.evaluate(()=>window.__commandes))].sort(),erreurs};
    return r;
  }finally{await ctx.close().catch(()=>{});await serveur.fermer();}
}
module.exports={releve};
if(require.main===module){
  releve({maquette:arg('--maquette'),extension:arg('--extension')||path.join(__dirname,'..')}).then(r=>{const s=JSON.stringify(r,null,1);
    if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);process.exitCode=r.erreurs.length?2:0;},e=>{console.error(e.stack||e.message);process.exitCode=1;});}
