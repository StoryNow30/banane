#!/usr/bin/env node
/* CH-065 : un paquet patché accepte-t-il un lot neuf, et la reprise d'un lot mis en pause avec l'ancien paquet ? Mesure dans la maquette ESV
 * (extension réelle dans Chromium, hôte d'ESV routé vers tests/esv-maquette/, comme tools/banc-esv.cjs).
 * Paquets : l'ancien = le zip de tools/package.py (ARG 1), décompressé ; chaque variante = le même paquet, avec les patchs de CH-065 choisis
 * appliqués à ses fichiers (chantiers/CH-065/appliquer.cjs), et la variante « tous+contrat » où CONTRACT.geometrySha256 de src/gcv1-shadow.js
 * est en plus changé (ce que ferait un ré-épinglage du contrat).
 * Pour chaque variante :
 *  1. lot neuf : profil Chromium neuf, paquet de la variante, lot de 4 cuts ; état final, cuts posés, erreurs ;
 *  2. reprise : profil neuf, ANCIEN paquet installé dans un dossier fixe, lot de 8 cuts mis en pause après 2 cuts, Chromium fermé ;
 *     le dossier est remplacé par le paquet de la variante (même chemin, donc même identifiant d'extension et même stockage), Chromium relancé
 *     sur le même profil ; « Reprendre » ; état final, erreur rendue au panneau, cuts posés après la reprise. Deux cas : Chromium seulement relancé
 *     (mesuré : il garde le code déjà chargé, même avec un numéro de version neuf), puis l'extension rechargée (« Recharger », chrome.runtime.reload()).
 *     Les contrats lus dans le service worker (code chargé, lot enregistré) sont rendus pour prouver quel code a tourné.
 * Usage : node tools/ch065-maquette-reprise.cjs ANCIEN.zip SORTIE.json [variante,variante…] */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{execFileSync}=require('child_process');
const N=require('../tests/esv-maquette/navigateur.cjs'),A=require('../chantiers/CH-065/appliquer.cjs');
const [ZIP,SORTIE,LISTE]=process.argv.slice(2);
const VARIANTES={ancien:[],'lidar':['lidar-direct'],'geometrie-lot':['geometrie-elaguee-lot'],'geometrie-v46':['geometrie-elaguee-v46'],'mediane':['mediane-exacte'],
  tous:A.NOMS,'tous+contrat':A.NOMS};
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const TRAVAIL=fs.mkdtempSync(path.join(process.env.CH065_TRAVAIL||os.tmpdir(),'ch065-maquette-'));
function paquet(nom,dest){
  fs.rmSync(dest,{recursive:true,force:true});fs.mkdirSync(dest,{recursive:true});execFileSync('unzip',['-q',ZIP,'-d',dest]);
  for(const f of A.FICHIERS){const p=path.join(dest,f),t=fs.readFileSync(p,'utf8');fs.writeFileSync(p,A.patcher(f,t,VARIANTES[nom]));}
  /* Un paquet neuf porte un numéro de version neuf (comme une version livrée) : sans lui, Chrome relance le code déjà chargé (mesuré). */
  if(nom!=='ancien'){const m=path.join(dest,'manifest.json'),j=JSON.parse(fs.readFileSync(m,'utf8'));j.version=j.version+'.65';fs.writeFileSync(m,JSON.stringify(j,null,2));}
  if(nom==='tous+contrat'){const p=path.join(dest,'src/gcv1-shadow.js'),t=fs.readFileSync(p,'utf8'),a="geometrySha256:'77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503'";
    if(!t.includes(a))throw Error('contrat introuvable');fs.writeFileSync(p,t.replace(a,"geometrySha256:'"+'0'.repeat(64)+"'"));}
}
async function ouvrir(ext,profil,serveur,{recharger=false}={}){
  /* Rechargement du paquet : Chrome garde en cache, dans le profil, les scripts du service worker d'une extension (mesuré : sans cela, le code
   * déjà chargé tourne encore après remplacement du dossier et relance, même avec un numéro de version neuf ; chrome.runtime.reload() décharge
   * l'extension chargée par la ligne de commande sans la recharger). Le cache des scripts est retiré ; le stockage de l'extension
   * (chrome.storage, IndexedDB), qui porte le lot en pause, est gardé. C'est l'effet attendu de « Recharger » (SUPPOSÉ : non mesurable ici). */
  if(recharger)for(const d of ['Service Worker','Code Cache'])fs.rmSync(path.join(profil,'Default',d),{recursive:true,force:true});
  const pw=N.playwright(),man=JSON.parse(fs.readFileSync(path.join(ext,'manifest.json'),'utf8')),hote=new URL(man.host_permissions[0].replace(/\*$/,''));
  const ctx=await pw.chromium.launchPersistentContext(profil,{executablePath:N.executable(),headless:true,viewport:{width:1200,height:800},
    args:['--headless=new',`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
  const erreurs=[];
  await ctx.route(hote.origin+'/**',async route=>{const u=new URL(route.request().url());let c=u.pathname;
    if(c.startsWith(hote.pathname)){const reste=c.slice(hote.pathname.length);c='/tests/esv-maquette/'+(reste===''||reste==='maquette'?'esv.html':reste);}
    try{await route.fulfill({response:await route.fetch({url:serveur.url+c+u.search})});}catch(e){erreurs.push('route '+c);await route.abort().catch(()=>{});}});
  for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await dormir(250);
  let sw=ctx.serviceWorkers()[0];if(!sw)throw Error('extension non chargée');const id=sw.url().split('/')[2];
  /* « Recharger » de chrome://extensions : chrome.runtime.reload() relit le paquet sur le disque ; le stockage de l'extension est gardé. */
  sw.on('console',m=>{if(m.type()==='error')erreurs.push('sw: '+m.text().slice(0,200));});
  const esv=await ctx.newPage();await esv.goto(`${hote.origin}${hote.pathname}maquette?cuts=12&debut=100&cut=100&latence=30`);
  await esv.evaluate(()=>window.__maquette.pret);await esv.waitForFunction(()=>window.__maquette.etat().railsPrets);
  const pan=await ctx.newPage();await pan.goto(`chrome-extension://${id}/panel.html#automatic`);await dormir(600);
  const api=async(action,a={})=>{const r=await pan.evaluate(([action,a])=>chrome.runtime.sendMessage({kind:'panel',action,args:a}),[action,a]);return r;};
  const onglets=(await api('list-tabs')).result;await api('connect',{tabId:(onglets.find(t=>/aquette/i.test(t.title))||onglets[0]).id});await api('settings',{mode:'automatic-test'});
  /* Contrats lus dans le service worker : celui du code chargé, et celui enregistré dans le lot en cours (s'il y en a un). */
  const contrats=async()=>sw.evaluate(()=>{try{return {vivant:globalThis.BananeGCV1Shadow?.state?.().contract?.geometrySha256??null,
    lot:(typeof engine!=='undefined'?engine?.s?.batch?.scope?.geometryContract?.geometrySha256:null)??null,mode:typeof engine!=='undefined'?engine?.s?.mode:null};}catch(e){return {erreur:e.message};}});
  return {ctx,esv,api,erreurs,id,contrats};
}
const LOT=(s,e)=>({part:(0),start:s,end:e,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',unresolvedPolicy:'defer',lotDecision:'apply',geometryEngine:'geometry-candidate-v1'});
const vueLot=v=>({etat:v?.batch?.state??null,poses:v?.batch?.lotPosedCount??null,traites:v?.batch?.processed?.length??v?.batch?.processedCount??null,
  differes:(v?.batch?.deferred||[]).length,notice:v?.notice?String(v.notice).slice(0,200):null});
async function attendre(api,pred,ms){const t=Date.now();let v;for(;;){await dormir(400);v=(await api('view')).result;if(pred(v)||Date.now()-t>ms)return v;}}
async function lotNeuf(nom,serveurs){
  const ext=path.join(TRAVAIL,'ext-'+nom),profil=path.join(TRAVAIL,'profil-neuf-'+nom);paquet(nom,ext);
  const s=await serveurs();const o=await ouvrir(ext,profil,s);
  try{const part=(await o.esv.evaluate(()=>window.__maquette.etat())).part;
    const c0=await o.contrats();const r=await o.api('start',{...LOT(100,103),part});const v=await attendre(o.api,v=>v?.batch?.state!=='RUNNING',180000);
    return {contrats:c0,demarrage:r.error||'ok',...vueLot(v),ecrituresServeur:s.journal.ecritures.length,erreurs:o.erreurs};}
  finally{await o.ctx.close().catch(()=>{});await s.fermer();}
}
async function reprise(nom,serveurs,recharger){
  const ext=path.join(TRAVAIL,'ext-fixe-'+nom+(recharger?'-r':'')),profil=path.join(TRAVAIL,'profil-reprise-'+nom+(recharger?'-r':''));
  paquet('ancien',ext);const s1=await serveurs();let o=await ouvrir(ext,profil,s1),avant;
  try{const part=(await o.esv.evaluate(()=>window.__maquette.etat())).part;
    await o.api('start',{...LOT(100,107),part});
    await attendre(o.api,v=>(s1.journal.ecritures.length>=2)||v?.batch?.state!=='RUNNING',180000);
    const p=await o.api('pause');avant={pause:p.error||'ok',...vueLot(await attendre(o.api,v=>v?.batch?.state!=='RUNNING',60000)),ecrituresServeur:s1.journal.ecritures.length};}
  finally{await o.ctx.close().catch(()=>{});await s1.fermer();}
  paquet(nom,ext);const s2=await serveurs();o=await ouvrir(ext,profil,s2,{recharger});
  try{const v0=(await o.api('view')).result,c0=await o.contrats();const r=await o.api('resume');
    const v=await attendre(o.api,v=>v?.batch?.state!=='RUNNING',180000);
    return {avantMiseAJour:avant,apresRelance:{...vueLot(v0),contrats:c0},reprise:r.error||'ok',fin:vueLot(v),ecrituresApresReprise:s2.journal.ecritures.length,erreurs:o.erreurs};}
  finally{await o.ctx.close().catch(()=>{});await s2.fermer();}
}
(async()=>{
  if(!N.playwright())throw Error('Playwright absent');
  const {demarrer}=require('../tests/esv-maquette/serveur.cjs'),serveurs=()=>demarrer({});
  const out={date:new Date().toISOString(),paquet:path.basename(ZIP),variantes:{}};
  for(const nom of (LISTE?LISTE.split(','):Object.keys(VARIANTES))){
    out.variantes[nom]={patchs:VARIANTES[nom],contratChange:nom==='tous+contrat',lotNeuf:await lotNeuf(nom,serveurs),
      repriseSansRecharger:await reprise(nom,serveurs,false),repriseApresRecharger:await reprise(nom,serveurs,true)};
    console.error(nom,JSON.stringify(out.variantes[nom]));
  }
  fs.writeFileSync(SORTIE,JSON.stringify(out,null,1)+'\n');console.log(JSON.stringify(out,null,1));
  fs.rmSync(TRAVAIL,{recursive:true,force:true});
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
