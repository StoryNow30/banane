#!/usr/bin/env node
'use strict';
/* CH-058 — RETOUR ARRIÈRE dans un vrai Chromium : le même profil (même base IndexedDB) est ouvert par le paquet du dépôt, puis par
 * un ancien commit (2bc1f56 par défaut), puis de nouveau par le paquet du dépôt. Chaque vie écrit trois événements et relit la base.
 * Attendu : même version de base (1), mêmes magasins, chaque paquet relit les écritures de l'autre.
 *   CHROMIUM=/opt/pw-browsers/chromium node tools/ch058-retour-arriere.cjs DOSSIER_DE_TRAVAIL [COMMIT_ANCIEN] */
const N=require('../tests/esv-maquette/navigateur.cjs'),pw=N.playwright(),{execSync}=require('child_process'),fs=require('fs'),path=require('path');
const R=path.resolve(__dirname,'..'),S=path.resolve(process.argv[2]||'.'),ANCIEN=process.argv[3]||'2bc1f56',X=S+'/ext',U=S+'/profil';
const poser=arbre=>{fs.rmSync(X,{recursive:true,force:true});fs.mkdirSync(X);execSync(arbre==='nouveau'?`git -C ${R} ls-files -co --exclude-standard | grep -vE '^(tests|tools|chantiers|audit|datasets|maquettes|design|claude|hub)/' | tar -C ${R} -cf - -T - | tar -C ${X} -xf -`:`git -C ${R} archive ${arbre} | tar -C ${X} -xf -`);};
async function vie(arbre,f){poser(arbre);fs.rmSync(U+'/Default/Service Worker',{recursive:true,force:true});const ctx=await pw.chromium.launchPersistentContext(U,{executablePath:N.executable(),headless:true,args:['--headless=new',`--disable-extensions-except=${X}`,`--load-extension=${X}`]});
 try{for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await new Promise(r=>setTimeout(r,250));const sw=ctx.serviceWorkers()[0];await sw.evaluate(async()=>{await ready;});return await sw.evaluate(f,arbre);}finally{await ctx.close();}}
(async()=>{fs.rmSync(U,{recursive:true,force:true});
 const ecrire=async arbre=>{for(let i=0;i<3;i++)await store.putEvent({eventId:arbre.slice(0,7)+'-'+i,timestamp:new Date().toISOString(),type:'validation-accepted',banc:arbre});
  const tous=await store.all('events'),db=await store.open();
  return {code:typeof BananeJournalIndex==='undefined'?'ancien (sans index)':'nouveau (index)',version:db.version,magasins:[...db.objectStoreNames],evenementsBanc:tous.filter(e=>e.banc).map(e=>e.eventId).sort(),
   parType:typeof store.lireParType==='function'?(await store.lireParType(['validation-accepted'])).filter(e=>e.banc).map(e=>e.eventId).sort():'sans index'};};
 for(const a of ['nouveau',ANCIEN,'nouveau'])console.log(a,JSON.stringify(await vie(a,ecrire)));})().catch(e=>{console.error(e);process.exit(1);});
