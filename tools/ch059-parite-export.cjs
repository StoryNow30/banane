#!/usr/bin/env node
'use strict';
/* CH-059 — PARITÉ DE L'EXPORT ÉCHO, octet pour octet, entre deux arbres (le tronc et la branche).
 * Une même journée déterministe (horloge et identifiants figés) : parties enchaînées, visites Écho, vidages automatiques
 * (`-auto`), REDÉMARRAGE du service worker au milieu (l'état est relu depuis chrome.storage.local), puis export final.
 * Compare les empreintes SHA-256 de : `dataset()` (session, visites, événements, résumé), `exportManifest()`, `exportPlan()`,
 * `exportAdvice()`, et l'état du moteur en mémoire. Usage : node tools/ch059-parite-export.cjs <racine-A> <racine-B> [visites]. */
const {execFileSync}=require('node:child_process'),path=require('node:path'),crypto=require('node:crypto');
if(process.argv[2]==='--un'){
 const racine=path.resolve(process.argv[3]),N=+process.argv[4]||120;
 let t=Date.UTC(2026,10,5,8,0,0),u=0;const VraiDate=Date;
 globalThis.Date=class extends VraiDate{constructor(...a){super(...(a.length?a:[t+=7]));}static now(){return t+=7;}};
 globalThis.crypto.randomUUID=()=>`00000000-0000-4000-8000-${String(++u).padStart(12,'0')}`;
 const J=require(path.join(racine,'tests/helpers/journee-etat.cjs'));
 (async()=>{const fc=J.fauxChrome();let a=await J.ouvrir(fc);await a.sessions.start();
  for(let i=0;i<N;i++){await J.visite(a,i%60,8+Math.floor(i/60));if((i+1)%25===0)await J.vidage(a);
   if(i===Math.floor(N/2)){await a.engine.save();a=await J.ouvrir(fc,a.store.tables);await a.sessions.resume();}}
  const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16);
  const ds=await a.sessions.dataset(),man=await a.sessions.exportManifest(),plan=await a.sessions.exportPlan(),conseil=a.sessions.exportAdvice();
  const sans=x=>{const c=JSON.parse(JSON.stringify(x));delete c.exportedAt;return c;};
  console.log(JSON.stringify({dataset:sha(sans(ds)),manifeste:sha(sans(man)),plan:sha(sans(plan)),conseil:sha(conseil),etatMemoire:sha(a.engine.s),
   visites:ds.records.length,nuages:ds.cloudIds.length,evenements:ds.events.length}));})().catch(e=>{console.error(e);process.exit(1);});
}else{
 const [A,B]=process.argv.slice(2,4),N=process.argv[4]||'120';if(!A||!B){console.error('usage : ch059-parite-export.cjs <racine-A> <racine-B> [visites]');process.exit(2);}
 const un=r=>JSON.parse(execFileSync(process.execPath,[__filename,'--un',r,N],{encoding:'utf8',maxBuffer:1<<26}).trim().split('\n').at(-1));
 const a=un(A),b=un(B),egal=JSON.stringify(a)===JSON.stringify(b);
 console.log(JSON.stringify({A:a,B:b,identiques:egal},null,1));process.exit(egal?0:1);}
