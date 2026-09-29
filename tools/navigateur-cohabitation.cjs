#!/usr/bin/env node
'use strict';
/*
 * navigateur-cohabitation.cjs — essai, dans un vrai Chromium, de deux Ariane
 * actives en même temps dans le même onglet ESV (4.8.5, D-060, D7). Les deux
 * extensions sont chargées (paquets décompressés) ; l'onglet ESV est une page
 * SYNTHÉTIQUE servie par l'essai à l'adresse d'ESV (aucun code ni contenu
 * d'ESV). Deux ordres :
 *   A. l'ANCIENNE se connecte d'abord, puis la NOUVELLE : refus attendu,
 *      avant toute injection (« Une autre Ariane (<ancienne>) est active… ») ;
 *   B. la NOUVELLE d'abord, puis l'ANCIENNE : l'adaptateur refuse les
 *      commandes de l'ancienne (« Une autre Ariane (4.8.5 test N)… ») et la
 *      nouvelle reste connectable, sans mise en sécurité (un ping est une
 *      lecture).
 * Relevé : réponse de chaque « Connecter », marqueur de l'adaptateur, erreurs.
 * Sur cette page sans vue 3D, un « Connecter » accepté finit par « Ouvre une
 * coupe dans ESV 3D » : l'adaptateur est installé, seule la lecture du cut manque.
 *
 *   node tools/navigateur-cohabitation.cjs DOSSIER_ANCIENNE DOSSIER_NOUVELLE
 *
 * Nécessite Playwright et Chromium (PLAYWRIGHT_BROWSERS_PATH ou CHROMIUM).
 * Hors du banc (node tools/verify.cjs) : il dépend du navigateur installé.
 */
const path=require('node:path'),fs=require('node:fs');
function chromium(){for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright','/opt/node22/lib/node_modules/playwright'].filter(Boolean)){try{return require(p).chromium;}catch{/* suivant */}}
  throw Error('Playwright introuvable (PLAYWRIGHT_MODULE=/chemin/vers/playwright).');}
function executable(){if(process.env.CHROMIUM)return process.env.CHROMIUM;const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';
  const d=fs.existsSync(base)?fs.readdirSync(base).find(x=>/^chromium-\d+$/.test(x)):null;return d?path.join(base,d,'chrome-linux','chrome'):undefined;}
const ESV='https://esv.lidar.altametris.xyz/rails_validation/essai-cohabitation';
/* Page synthétique : un titre et le libellé de cut, rien d'ESV. */
const PAGE='<!doctype html><meta charset="utf-8"><title>Essai de cohabitation</title><p id="O2N3DCutDescription">Cut 100 of part 23</p>';
const version=m=>m.version_name||m.version;
async function essai(ancienne,nouvelle){
  const manifeste=d=>JSON.parse(fs.readFileSync(path.join(d,'manifest.json'),'utf8'));
  const ctx=await chromium().launchPersistentContext('',{executablePath:executable(),headless:true,
    args:['--headless=new',`--disable-extensions-except=${ancienne},${nouvelle}`,`--load-extension=${ancienne},${nouvelle}`]});
  try{await ctx.route('https://esv.lidar.altametris.xyz/**',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:PAGE}));
    const attendre=async n=>{for(let i=0;i<60&&ctx.serviceWorkers().length<n;i++)await new Promise(r=>setTimeout(r,250));};await attendre(2);
    const workers=ctx.serviceWorkers();if(workers.length<2)throw Error(`${workers.length} service worker(s) sur 2 : extensions non chargées.`);
    /* Chaque extension reconnue par son nom ET sa version (deux paquets de même version : refusé). */
    const cle=m=>`${m.name}|${m.version}`;if(cle(manifeste(ancienne))===cle(manifeste(nouvelle)))throw Error('Les deux dossiers portent la même extension.');
    const ids={};for(const sw of workers){const id=sw.url().split('/')[2];ids[await sw.evaluate(()=>{const m=chrome.runtime.getManifest();return `${m.name}|${m.version}`;})]=id;}
    const idAncienne=ids[cle(manifeste(ancienne))],idNouvelle=ids[cle(manifeste(nouvelle))];
    if(!idAncienne||!idNouvelle)throw Error('Extensions non reconnues : '+JSON.stringify(ids));
    const erreurs=[];
    const panneau=async id=>{const p=await ctx.newPage();p.on('pageerror',e=>erreurs.push(e.message));await p.goto(`chrome-extension://${id}/panel.html#automatic`);await p.waitForTimeout(800);return p;};
    const api=(p,action,args={})=>p.evaluate(([action,args])=>chrome.runtime.sendMessage({kind:'panel',action,args}),[action,args]);
    const connecter=async(p)=>{const tabs=(await api(p,'list-tabs')).result||[];const t=tabs.find(x=>x.title==='Essai de cohabitation');
      if(!t)return {erreur:'onglet ESV synthétique introuvable'};const r=await api(p,'connect',{tabId:t.id});return r.error?{erreur:r.error}:{connecte:true};};
    const marqueur=esv=>esv.evaluate(()=>{const m=window.__BANANE_V3_PAGE;return m?{version:m.version??null,versionName:m.versionName??null,proprietaire:m.proprietaire??null}:null;}).catch(e=>'illisible : '+e.message);
    const ordre=async(premier,second)=>{const esv=await ctx.newPage();await esv.goto(ESV);
      const p1=await panneau(premier.id),p2=await panneau(second.id);
      const r1=await connecter(p1),m1=await marqueur(esv),r2=await connecter(p2),m2=await marqueur(esv);
      /* Le premier reste-t-il maître de l'onglet (nouvelle connexion, sans sécurité) ? */
      const r3=await connecter(p1);
      await Promise.all([esv.close(),p1.close(),p2.close()]);
      return {premier:premier.nom,second:second.nom,premierConnecte:r1,marqueurApresPremier:m1,secondConnecte:r2,marqueurApresSecond:m2,premierReconnecte:r3};};
    const A={nom:version(manifeste(ancienne)),id:idAncienne},N={nom:version(manifeste(nouvelle)),id:idNouvelle};
    const a=await ordre(A,N),b=await ordre(N,A);
    /* Verdict : le second est refusé dans les deux ordres, avec le nom de l'autre ;
     * la nouvelle n'est jamais mise en sécurité par un simple ping de l'ancienne. */
    const nomme=(nom,r)=>(r.erreur||'').includes(`Une autre Ariane (${nom}) est active`);
    const refuseA=nomme(A.nom,a.secondConnecte),refuseB=nomme(N.nom,b.secondConnecte);
    const maitreB=b.marqueurApresSecond?.proprietaire===idNouvelle&&!/en sécurité/.test(b.premierReconnecte.erreur||'');
    return {ancienne:A,nouvelle:N,ordreA:a,ordreB:b,verdict:{refusAvantInjection:refuseA,refusParAdaptateur:refuseB,nouvelleResteMaitre:maitreB,ok:refuseA&&refuseB&&maitreB},erreurs};}
  finally{await ctx.close();}}
if(require.main===module){const [ancienne,nouvelle]=process.argv.slice(2);
  if(!ancienne||!nouvelle){console.error('Usage : DOSSIER_ANCIENNE DOSSIER_NOUVELLE');process.exit(1);}
  essai(path.resolve(ancienne),path.resolve(nouvelle)).then(r=>{console.log(JSON.stringify(r,null,1));if(!r.verdict.ok)process.exitCode=2;},e=>{console.error(e.message);process.exitCode=1;});}
module.exports={essai};
