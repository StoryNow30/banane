#!/usr/bin/env node
'use strict';
/*
 * relecture-banc.cjs — BANC DE LA RELECTURE APRÈS LE LOT (fiches/RELECTURE_OMBRE.md § 7), extension réelle dans Chromium.
 *
 * L'extension du dépôt est chargée dans Chromium ; l'hôte d'ESV (lu dans manifest.json, jamais écrit ici) est ROUTÉ vers la maquette
 * ESV de la branche claude/esv-locale-audit (fiches/AUDIT_ESV_LOCALE.md : page qui imite le contrat d'ESV, aucun code ni contenu
 * d'ESV, points du corpus du dépôt). Le panneau garde le choix « relecture », lance un lot Orbite, puis la passe part seule à la fin
 * du lot (ou après la validation du dernier cut par « Mic », que le banc joue : bouton de validation de la maquette, puis « Lancer la
 * relecture »). Tout passe par le vrai chemin : service worker, pont, observateur passif, adaptateur de page, maquette, serveur.
 * Rendu : par cut relu, navigation, capture, calcul, temps total affiché (rythme compris) ; durée de la passe ; écritures reçues par
 * le serveur pendant la passe ; commandes et touches vues par la page.
 *
 *   git archive origin/claude/esv-locale-audit tests/esv-maquette | tar -x -C <DOSSIER>     (une fois : la maquette, hors du dépôt)
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/relecture-banc.cjs --maquette <DOSSIER>/tests/esv-maquette \
 *        [--mode ombre|corriger] [--cuts 16] [--debut 100] [--lot 104:107] [--latence 40] [--reglages FICHIER.json] [--json SORTIE.json]
 *
 * `--reglages` : fichier de seuils servi à l'extension comme datasets/relecture-reglages-proposes.json LE TEMPS DU BANC (un fichier
 * déjà présent est remis tel quel à la fin). Ce que le banc prouve : la passe tourne de bout en bout sur une page qui imite ESV, avec
 * ses temps de page à elle. Ce qu'il ne prouve pas : le vrai ESV, le vrai Potree, Edge, le réseau ; les temps de calcul sont ceux de
 * cette machine (fiches/CYCLE_OMBRE.md : 2,5 fois plus lente que le poste du terrain). Hors de tools/verify.cjs.
 */
const path=require('node:path'),fs=require('node:fs');
const racine=path.resolve(__dirname,'..');
function args(argv){const o={maquette:null,mode:'ombre',cuts:16,debut:100,lot:null,latence:40,reglages:null,json:null,delai:600000};
 for(let i=0;i<argv.length;i++){const a=argv[i];if(a.startsWith('--'))o[a.slice(2)]=argv[++i];}
 for(const k of ['cuts','debut','latence','delai'])o[k]=Number(o[k]);
 if(!['ombre','corriger'].includes(o.mode))throw Error('--mode : ombre ou corriger');
 const [a,z]=String(o.lot||`${o.debut+4}:${o.debut+7}`).split(':').map(Number);o.lot={start:a,end:z};
 if(!o.maquette)throw Error('--maquette DOSSIER : la maquette ESV (tests/esv-maquette de la branche claude/esv-locale-audit)');
 o.maquette=path.resolve(o.maquette);return o;}
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
/* La maquette lit ses voisins à deux niveaux au-dessus d'elle (corpus, capture-core) : liens vers ceux du dépôt s'ils manquent. */
function preparerMaquette(dossier){const base=path.resolve(dossier,'../..');
 for(const [lien,cible] of [['tests/corpus','tests/corpus'],['vendor','vendor']]){const l=path.join(base,lien);
  if(!fs.existsSync(l)){fs.mkdirSync(path.dirname(l),{recursive:true});fs.symlinkSync(path.join(racine,cible),l);}}
 for(const f of ['navigateur.cjs','serveur.cjs','esv.html','esv-maquette.js'])if(!fs.existsSync(path.join(dossier,f)))throw Error('Maquette incomplète : '+f+' absent de '+dossier);}
const stat=v=>{const t=v.filter(Number.isFinite).sort((a,b)=>a-b);if(!t.length)return null;const q=p=>t[Math.min(t.length-1,Math.floor(p*(t.length-1)))];
 return {n:t.length,mediane:q(.5),p90:q(.9),max:t.at(-1),moyenne:Math.round(t.reduce((a,b)=>a+b,0)/t.length)};};
async function banc(o){preparerMaquette(o.maquette);
 const N=require(path.join(o.maquette,'navigateur.cjs')),{demarrer}=require(path.join(o.maquette,'serveur.cjs'));
 const pw=N.playwright();if(!pw)throw Error('Playwright introuvable.');
 const manifeste=JSON.parse(fs.readFileSync(path.join(racine,'manifest.json'),'utf8')),hote=manifeste.host_permissions[0].replace(/\*$/,'');
 const origine=new URL(hote).origin,prefixe=new URL(hote).pathname;
 /* Réglages proposés le temps du banc seulement. */
 const proposes=path.join(racine,'datasets/relecture-reglages-proposes.json'),sauve=fs.existsSync(proposes)?fs.readFileSync(proposes):null;
 if(o.reglages)fs.copyFileSync(path.resolve(o.reglages),proposes);
 const serveur=await demarrer({});const erreurs=[],debutBanc=Date.now();
 const ctx=await pw.chromium.launchPersistentContext('',{executablePath:N.executable(),headless:true,viewport:{width:1200,height:800},
  args:['--headless=new',`--disable-extensions-except=${racine}`,`--load-extension=${racine}`]});
 try{
  await ctx.route(origine+'/**',async route=>{const u=new URL(route.request().url());let chemin=u.pathname;
   if(chemin.startsWith(prefixe)){const reste=chemin.slice(prefixe.length);chemin='/tests/esv-maquette/'+(reste===''||reste==='maquette'?'esv.html':reste);}
   try{const r=await route.fetch({url:serveur.url+chemin+u.search});await route.fulfill({response:r});}catch(e){erreurs.push('route '+chemin+' : '+e.message);await route.abort();}});
  for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await dormir(250);
  const sw=ctx.serviceWorkers()[0];if(!sw)throw Error('Service worker de l’extension absent.');
  const id=sw.url().split('/')[2];sw.on('console',m=>{if(m.type()==='error')erreurs.push('sw: '+m.text());});
  const esv=await ctx.newPage();esv.on('pageerror',e=>erreurs.push('esv: '+e.message));
  await esv.goto(`${origine}${prefixe}maquette?cuts=${o.cuts}&debut=${o.debut}&cut=${o.lot.start}&latence=${o.latence}`);
  await esv.evaluate(()=>window.__maquette.pret);await esv.waitForFunction(()=>window.__maquette.etat().railsPrets);
  const panneau=await ctx.newPage();panneau.on('pageerror',e=>erreurs.push('panneau: '+e.message));
  await panneau.goto(`chrome-extension://${id}/panel.html#automatic`);await dormir(600);
  const api=async(action,a={})=>{const r=await panneau.evaluate(([action,a])=>chrome.runtime.sendMessage({kind:'panel',action,args:a}),[action,a]);if(r?.error)throw Error(`${action} : ${r.error}`);return r?.result;};
  const onglets=await api('list-tabs');const onglet=onglets.find(t=>/MAQUETTE|Maquette/i.test(t.title))||onglets[0];if(!onglet)throw Error('Onglet de la maquette introuvable.');
  await api('relecture-choix',{mode:o.mode});await api('connect',{tabId:onglet.id});await api('settings',{mode:'automatic-test'});
  const part=(await esv.evaluate(()=>window.__maquette.etat())).part;
  const lot={part,start:o.lot.start,end:o.lot.end,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',unresolvedPolicy:'defer',lotDecision:'apply',geometryEngine:'geometry-candidate-v1'};
  const debutLot=Date.now();await api('start',lot);
  let vue=null;for(;;){await dormir(400);vue=await api('view');if(vue?.batch?.state!=='RUNNING')break;if(Date.now()-debutLot>o.delai){erreurs.push('délai du lot dépassé');break;}}
  const dureeLotMs=Date.now()-debutLot,ecrituresLot=serveur.journal.ecritures.length;
  /* Le lot borné s'arrête sur une pose non validée : « Mic » la valide (bouton de la maquette), puis lance la relecture. */
  let validationMic=false;await dormir(2500);
  let etat=await api('relecture-etat');
  if(etat.passe?.etat==='non-lancee'&&/attend ta validation/.test(etat.passe.message||'')){
   await esv.evaluate(()=>document.getElementById('O2N3DCutValidate3DRail').click());validationMic=true;await dormir(1500);
   await api('relecture-lancer');}
  const debutPasse=Date.now(),ecrituresAvant=serveur.journal.ecritures.length;
  for(;;){await dormir(500);etat=await api('relecture-etat');if(etat.passe&&etat.passe.etat!=='en-cours')break;if(Date.now()-debutPasse>o.delai){erreurs.push('délai de la passe dépassé');await api('relecture-arreter').catch(()=>{});break;}}
  const journal=await api('journal'),ev=(journal.events||[]).filter(e=>/^relecture-/.test(e.type));
  const visites=ev.filter(e=>e.type==='relecture-ombre').sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp)));
  const arrivees=visites.map(e=>Date.parse(e.timestamp));
  const intervalles=arrivees.slice(1).map((t,i)=>t-arrivees[i]);
  const ecrituresPasse=serveur.journal.ecritures.slice(ecrituresAvant);
  const maquette=await esv.evaluate(()=>({etat:window.__maquette.etat(),journal:window.__maquette.journal}));
  const touches=(maquette.journal||[]).filter(x=>x?.type==='touche'||x?.quoi==='touche').length;
  const debut=ev.find(e=>e.type==='relecture-debut'),fin=ev.find(e=>e.type==='relecture-fin');
  const resume={version:manifeste.version,mode:o.mode,lot,etatLot:vue?.batch?.state??null,dureeLotMs,ecrituresLot,validationMic,
   passe:{etat:etat.passe?.etat??null,message:etat.passe?.message??null,total:etat.passe?.total??null,faits:etat.passe?.faits??null,corriges:etat.passe?.corriges??null,refusees:etat.passe?.refusees??null,
    dureeMs:fin?.dureeMs??null,reglages:etat.passe?.reglages??null,plages:debut?.plages??null},
   parCut:{navigationMs:stat(visites.map(e=>e.durees?.navigationMs)),captureMs:stat(visites.map(e=>e.durees?.captureMs)),calculMs:stat(visites.map(e=>e.durees?.calculMs)),
    sansRythmeMs:stat(visites.map(e=>e.durees?.totalMs)),entreDeuxCutsMs:stat(intervalles)},
   visites:visites.map(e=>({cut:e.identity?.cut,role:e.role,zone:e.zone,action:e.action,verdict:e.verdict,pireMm:e.pireMm,etage:e.etage,regle:e.critere?.regle??null,raison:e.critere?.raison??e.raison,skip:e.skipOmbre?.raison??null,durees:e.durees,chemin:e.chemin})),
   ecrituresPasse:ecrituresPasse.map(e=>({rowKey:e.rowKey,statut:e.body?.ExtractionStatus??null})),
   maquette:{cut:maquette.etat.cut,compteur:maquette.etat.compteur,chargements:maquette.etat.chargements,entreesJournal:(maquette.journal||[]).length,touches},
   erreurs,dureeBancMs:Date.now()-debutBanc};
  if(o.json)fs.writeFileSync(o.json,JSON.stringify({resume,evenements:ev,maquetteJournal:maquette.journal},null,1));
  return resume;
 }finally{await ctx.close().catch(()=>{});await serveur.fermer();
  if(o.reglages){if(sauve)fs.writeFileSync(proposes,sauve);else fs.rmSync(proposes,{force:true});}}}
module.exports={banc,args,stat};
if(require.main===module){let o;try{o=args(process.argv.slice(2));}catch(e){console.error(e.message);process.exit(2);}
 banc(o).then(r=>{console.log(JSON.stringify(r,null,1));process.exitCode=r.erreurs.length?2:0;},e=>{console.error(e.stack||e.message);process.exitCode=1;});}
