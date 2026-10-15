#!/usr/bin/env node
'use strict';
/*
 * banc-esv.cjs — BANC ESV LOCAL « extension réelle » : l'extension Ariane du
 * dépôt (manifest.json à la racine, ou un dossier de paquet décompressé) est
 * chargée dans un vrai Chromium ; l'hôte d'ESV est ROUTÉ vers la maquette
 * (tests/esv-maquette/, aucun code ni contenu d'ESV) ; un lot Orbite complet
 * est lancé par les messages du panneau (connect, settings, start) et suivi
 * jusqu'à sa fin ; le journal du lot et les écritures reçues par le « serveur »
 * sont rendus. Ce que ce banc prouve : la chaîne service worker → pont →
 * adaptateur → page, sur une page qui imite ESV. Ce qu'il ne prouve pas : le
 * vrai ESV, le vrai Potree, Edge, le réseau (README de la maquette).
 *
 *   node tools/banc-esv.cjs [--cuts 3] [--debut 100] [--decalage 0] [--latence 40] [--extension DOSSIER] [--json SORTIE.json] [--dataset BILAN.json] [--entete]
 *   --dataset : écrit aussi le bilan du lot avec ses nuages (format `banane-test-dataset-v4` + `clouds`, comme « Télécharger le bilan et les LiDAR »)
 *   --export FICHIER_OU_DOSSIER [--part N] : REJEU d'un vrai export (Orbite ou Écho, tests/esv-maquette/lecteur-export.cjs) ;
 *     le lot couvre toute la partie (ou --cuts à partir de --decalage) ; le rapport donne l'écart de chaque pose d'Ariane à la référence de l'export (mm)
 *
 * Nécessite Playwright et Chromium (PLAYWRIGHT_BROWSERS_PATH ou CHROMIUM). Hors du banc `verify`.
 */
const path=require('node:path'),fs=require('node:fs');
const N=require('../tests/esv-maquette/navigateur.cjs');
const racine=N.racine;
function args(argv){const o={cuts:3,debut:100,decalage:0,latence:40,extension:racine,json:null,dataset:null,export:null,part:null,entete:false,delai:120000};
  for(let i=0;i<argv.length;i++){const a=argv[i];if(a==='--entete')o.entete=true;else if(a.startsWith('--')){o[a.slice(2)]=argv[++i];}}
  for(const k of ['cuts','debut','decalage','latence','delai'])o[k]=Number(o[k]);if(o.part!==null)o.part=Number(o.part);o.extension=path.resolve(o.extension);if(o.export)o.export=path.resolve(o.export);return o;}
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
async function banc(options={}){
  const o={...args([]),...options},pw=N.playwright();if(!pw)throw Error('Playwright introuvable.');
  const manifeste=JSON.parse(fs.readFileSync(path.join(o.extension,'manifest.json'),'utf8'));
  const origine=new URL(manifeste.host_permissions[0].replace(/\*$/,'')).origin,prefixe=new URL(manifeste.host_permissions[0].replace(/\*$/,'')).pathname;
  const {demarrer}=require('../tests/esv-maquette/serveur.cjs');const serveur=await demarrer({exportation:o.export});
  const ctx=await pw.chromium.launchPersistentContext('',{executablePath:N.executable(),headless:true,viewport:{width:1200,height:800},
    args:['--headless=new',`--disable-extensions-except=${o.extension}`,`--load-extension=${o.extension}`]});
  const erreurs=[],debutBanc=Date.now();
  try{
    /* L'hôte d'ESV est servi par la maquette : page sous le préfixe d'ESV, API (/rails, /maquette) telle quelle. */
    await ctx.route(origine+'/**',async route=>{const u=new URL(route.request().url());let chemin=u.pathname;
      if(chemin.startsWith(prefixe)){const reste=chemin.slice(prefixe.length);chemin='/tests/esv-maquette/'+(reste===''||reste==='maquette'?'esv.html':reste);}
      try{const r=await route.fetch({url:serveur.url+chemin+u.search});await route.fulfill({response:r});}
      catch(e){erreurs.push('route '+chemin+' : '+e.message);await route.abort();}});
    for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await dormir(250);
    const sw=ctx.serviceWorkers()[0];if(!sw)throw Error('Service worker de l’extension absent : extension non chargée.');
    const id=sw.url().split('/')[2];sw.on('console',m=>{if(m.type()==='error')erreurs.push('sw: '+m.text());});
    const esv=await ctx.newPage();esv.on('pageerror',e=>erreurs.push('esv: '+e.message));esv.on('console',m=>{if(m.type()==='error')erreurs.push('esv console: '+m.text());});
    const requete=o.export?`source=export${o.part!==null?'&part='+o.part:''}&latence=${o.latence}`:`cuts=${o.cuts+o.decalage+2}&debut=${o.debut}&cut=${o.debut+o.decalage}&latence=${o.latence}`;
    await esv.goto(`${origine}${prefixe}maquette?${requete}`);
    await esv.evaluate(()=>window.__maquette.pret);await esv.waitForFunction(()=>window.__maquette.etat().railsPrets);
    /* Rejeu : bornes du lot = les cuts de la partie rejouée (tous, ou --cuts à partir de --decalage), ouverts sur le premier. */
    if(o.export){const e0=await esv.evaluate(()=>window.__maquette.etat());const limite=options.cuts??(process.argv.includes('--cuts')?o.cuts:null);const liste=e0.cuts.slice(o.decalage,limite?o.decalage+limite:undefined);
      if(!liste.length)throw Error('Aucun cut à rejouer.');o.debut=liste[0];o.decalage=0;o.cuts=liste.length;o.fin=liste.at(-1);
      await esv.evaluate(cut=>window.__maquette.allerA(cut),o.debut);await esv.waitForFunction(()=>window.__maquette.etat().railsPrets);}
    const panneau=await ctx.newPage();panneau.on('pageerror',e=>erreurs.push('panneau: '+e.message));
    await panneau.goto(`chrome-extension://${id}/panel.html#automatic`);await dormir(600);
    const api=async(action,a={})=>{const r=await panneau.evaluate(([action,a])=>chrome.runtime.sendMessage({kind:'panel',action,args:a}),[action,a]);if(r?.error)throw Error(`${action} : ${r.error}`);return r?.result;};
    const onglets=await api('list-tabs');const onglet=onglets.find(t=>/MAQUETTE|Maquette/i.test(t.title))||onglets[0];if(!onglet)throw Error('Onglet ESV (maquette) introuvable.');
    await api('connect',{tabId:onglet.id});await api('settings',{mode:'automatic-test'});
    const part=(await esv.evaluate(()=>window.__maquette.etat())).part;
    const lot={part,start:o.debut+o.decalage,end:o.fin??o.debut+o.decalage+o.cuts-1,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',unresolvedPolicy:'defer',lotDecision:'apply',geometryEngine:'geometry-candidate-v1'};
    const debutLot=Date.now();await api('start',lot);
    let vue=null;for(;;){await dormir(400);vue=await api('view');if(vue?.batch?.state!=='RUNNING')break;if(Date.now()-debutLot>o.delai){erreurs.push('délai du lot dépassé');break;}}
    const dureeLot=Date.now()-debutLot;
    const journal=await api('journal');
    const maquette=await esv.evaluate(()=>({etat:window.__maquette.etat(),journal:window.__maquette.journal,scenario:window.__maquette.scenario()}));
    /* Écart à la référence de l'export (pose humaine en Écho, pose d'Ariane en Orbite) : écriture reçue par le serveur (monde) contre la référence (monde), en mm. */
    const refs=new Map();for(const p of maquette.scenario.parties||[])for(const c of p.cuts)if(c.reference)refs.set(`${p.part}-${c.cut}`,c.reference);
    const ecarts=serveur.journal.ecritures.map(e=>{const ref=refs.get(e.rowKey),b=e.body||{};if(!ref||!Number.isFinite(b.XLeftEdge))return null;
      const mm=(a,p)=>Math.round(Math.hypot(a[0]-p[0],a[1]-p[1],a[2]-p[2])*1000*10)/10;
      return {rowKey:e.rowKey,source:ref.source,gaucheMm:mm([b.XLeftEdge,b.YLeftEdge,b.ZLeftEdge],ref.monde.left),droitMm:mm([b.XRightEdge,b.YRightEdge,b.ZRightEdge],ref.monde.right)};}).filter(Boolean);
    /* Mesures : par cut, du premier événement le concernant au suivant (chronologie du journal, sans estimation). */
    const ev=journal.events||[],parCut=new Map();
    for(const e of ev){const cut=e.identity?.cut??e.cut??e.detail?.identity?.cut;if(!Number.isInteger(cut))continue;const t=Date.parse(e.at||e.timestamp||e.observedAt||'');if(!Number.isFinite(t))continue;
      const c=parCut.get(cut)||{cut,premier:t,dernier:t,evenements:0,types:new Set()};c.premier=Math.min(c.premier,t);c.dernier=Math.max(c.dernier,t);c.evenements++;c.types.add(e.type);parCut.set(cut,c);}
    const cuts=[...parCut.values()].sort((a,b)=>a.cut-b.cut).map(c=>({cut:c.cut,dureeMs:c.dernier-c.premier,evenements:c.evenements,types:[...c.types].filter(t=>/adapter-result|proposed|applied|validated|defer|gcv1/.test(t)).slice(0,8)}));
    const commandes={};for(const e of ev)if(e.type==='adapter-result'){const a=e.action||e.detail?.action||'?';commandes[a]=(commandes[a]||0)+1;}
    const resume={version:manifeste.version,extension:o.extension,lot,etatFinal:vue?.batch?.state??null,notice:vue?.notice??null,dureeLotMs:dureeLot,
      cutsPoses:vue?.batch?.lotPosedCount??null,differes:(vue?.batch?.deferred||[]).length,ecrituresServeur:serveur.journal.ecritures.map(e=>({rowKey:e.rowKey,status:e.body?.ExtractionStatus})),
      commandes,cuts,evenements:ev.length,maquette:{cut:maquette.etat.cut,compteur:maquette.etat.compteur,statuts:maquette.etat.statuts,chargements:maquette.etat.chargements,provenance:maquette.etat.provenance},
      ecartsReferenceMm:ecarts,erreurs,dureeBancMs:Date.now()-debutBanc};
    if(o.json)fs.writeFileSync(o.json,JSON.stringify({resume,journal,maquetteJournal:maquette.journal},null,1));
    if(o.dataset){const d=await api('dataset');const clouds=[];for(const id of d.cloudIds||[]){const c=await api('cloud',{id});if(c)clouds.push(c);}
      fs.writeFileSync(o.dataset,JSON.stringify({...d,clouds}));resume.dataset={fichier:o.dataset,nuages:clouds.length,records:(d.records||[]).length};}
    return resume;
  }finally{await ctx.close().catch(()=>{});await serveur.fermer();}
}
module.exports={banc,args};
if(require.main===module){const o=args(process.argv.slice(2));
  banc(o).then(r=>{console.log(JSON.stringify(r,null,1));process.exitCode=r.erreurs.length?2:0;},e=>{console.error(e.stack||e.message);process.exitCode=1;});}
