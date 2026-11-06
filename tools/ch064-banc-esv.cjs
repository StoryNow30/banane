#!/usr/bin/env node
'use strict';
/* CH-064, étape 4 : un même lot Orbite sur la maquette ESV (tools/banc-esv.cjs, inchangé), joué par le paquet officiel
 * (témoin JS) puis par la construction WASM (tools/ch064-construire-extension.cjs), et comparé sur le contenu métier :
 * écritures reçues par le serveur, enregistrements, événements du journal regroupés par type et par cut, résumé du lot.
 * Les champs de temps, d'identifiant et de taille d'octets sont retirés ; un second lot JS mesure le bruit d'une
 * exécution à l'autre (deux lots JS de plus) : une différence n'est imputable au cœur que si elle n'apparaît entre aucun des
 * lots JS. Les événements `phase-timing` (télémétrie de chronométrage seule) ne sont pas comparés.
 * Commandes envoyées à la page comparées OCTET POUR OCTET (JSON exact de l'action et des arguments, à la même position).
 * Compteurs des façades (appels servis par le cœur, rejeux JS) lus dans le service worker avant sa fermeture.
 *   node tools/ch064-banc-esv.cjs [--cuts 3] [--export FICHIER [--part N]] [--json SORTIE]
 * CHROMIUM : défaut /opt/pw-browsers/chromium. */
const fs=require('node:fs'),path=require('node:path');
process.env.CHROMIUM=process.env.CHROMIUM||'/opt/pw-browsers/chromium';
const {construireExtension}=require('./ch064-construire-extension.cjs'),{comparer}=require('./ch064-comparer.cjs');
const B=require('./banc-esv.cjs'),N=require('../tests/esv-maquette/navigateur.cjs');
const RACINE=path.resolve(__dirname,'..');
const TEMPS=/(^at$|^t$|At$|Ms$|^ms|Epoch|^timestamp$|Id$|^id$|Ids$|^seq$|^memMo$|^timeOrigin$|^extension$|duree|Duree|elapsed|^clock|^perf$|^timing|^lots$|^bytes$|Bytes$|^onglet$|^[a-z]+S$)/; // …S : durées en secondes (ageS, navS)
const ISO=/^\d{4}-\d\d-\d\dT/,UUID=/[0-9a-f]{8}-[0-9a-f]{4}-/;
const net=v=>{if(Array.isArray(v))return v.map(net);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(!TEMPS.test(k))o[k]=net(v[k]);return o;}
 if(typeof v==='string'&&(ISO.test(v)||UUID.test(v)))return '·';return v;};
const cle=e=>JSON.stringify(e);
function vues(r){const m={};
 for(const k of ['lot','etatFinal','notice','cutsPoses','differes','ecrituresServeur','commandes','maquette','ecartsReferenceMm','erreurs'])m['resume.'+k]=net(r.resume[k]);
 for(const e of r.journal.events||[]){if(e.type==='phase-timing')continue; // télémétrie de chronométrage seule
  const k='evenements.'+e.type+'@'+(e.identity?.cut??'-');(m[k]=m[k]||[]).push(net(e));}
 for(const k in m)if(k.startsWith('evenements.'))m[k].sort((x,y)=>cle(x)<cle(y)?-1:cle(x)>cle(y)?1:0);
 m.records=net(r.journal.records||[]).slice().sort((x,y)=>(x.cut??0)-(y.cut??0));return m;}
function differences(a,b){const va=vues(a),vb=vues(b),out={};for(const k of new Set([...Object.keys(va),...Object.keys(vb)])){const e=comparer(va[k],vb[k],{max:3});if(e.length)out[k]=e;}return out;}
/* Commandes envoyées par le pont à la page (messages `banane3:command` du monde MAIN), enregistrées dans la page même :
 * action et arguments en JSON exact ; les champs de transport (id, canal, extension, heure d'envoi) sont exclus. */
const ESPION=()=>{window.__ch064Commandes=[];addEventListener('message',e=>{const d=e.data;if(d&&d.kind==='banane3:command')window.__ch064Commandes.push(JSON.stringify({action:d.action,args:d.args}));});};
async function jouer(extension,o){let compteurs=null,commandes=null;const pw=N.playwright(),orig=pw.chromium.launchPersistentContext;
 pw.chromium.launchPersistentContext=async function(...a){const ctx=await orig.apply(this,a);await ctx.addInitScript(ESPION);const close=ctx.close.bind(ctx);
  ctx.close=async()=>{try{compteurs=await ctx.serviceWorkers()[0].evaluate(()=>globalThis.ARIANE_RS_COMPTEURS?globalThis.ARIANE_RS_COMPTEURS():null);}catch{}
   for(const p of ctx.pages()){try{const c=await p.evaluate(()=>window.__ch064Commandes||null);if(c&&c.length)commandes=c;}catch{}}return close();};return ctx;};
 const f=path.join(path.dirname(extension),path.basename(extension)+'-rapport.json');
 try{await B.banc({...o,extension,json:f});}finally{pw.chromium.launchPersistentContext=orig;}
 const r=JSON.parse(fs.readFileSync(f,'utf8'));fs.rmSync(f,{force:true});return {r,compteurs,commandes:commandes||[]};}
async function main(){const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 const o={};if(arg('--cuts'))o.cuts=Number(arg('--cuts'));else if(!arg('--export'))o.cuts=3;if(arg('--export'))o.export=path.resolve(arg('--export'));if(arg('--part'))o.part=Number(arg('--part'));
 /* --js DOSSIER --autre DOSSIER : deux paquets donnés, dézippés (par exemple le tronc et le tronc avec un patch d'intégration) ;
  * sinon le paquet officiel contre la copie aux façades WASM, construits ici. */
 const dist=path.join(RACINE,'ariane-rs','dist');
 const js=arg('--js')?path.resolve(arg('--js')):construireExtension({modules:[],sortie:path.join(dist,'extension-js')}),wasm=arg('--autre')?path.resolve(arg('--autre')):construireExtension({sortie:path.join(dist,'extension-wasm')});
 const j1=await jouer(js,o),j2=await jouer(js,o),j3=await jouer(js,o),w=await jouer(wasm,o);
 const bruit={...differences(j1.r,j2.r),...differences(j1.r,j3.r)},dw=differences(j1.r,w.r);
 const imputables=Object.fromEntries(Object.entries(dw).filter(([k])=>!(k in bruit)));
 /* Commandes, octet pour octet : même nombre, même texte à la même position (le JSON des arguments compris). */
 /* Normalisation : chaque identifiant aléatoire (UUID tiré par la maquette ou le pont) devient son rang d'apparition, chaque
  * horodatage ISO devient « T » ; les lectures d'état (`state`), cadencées par le sondage, sont écartées. Tout le reste,
  * nombres compris, est comparé tel quel. */
 const normaliser=l=>{const ids=new Map();return l.filter(c=>!c.startsWith('{"action":"state"')).map(c=>c.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,u=>{if(!ids.has(u))ids.set(u,'U'+ids.size);return ids.get(u);}).replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g,'T'));};
 for(const j of [j1,j2,j3,w])j.commandes=normaliser(j.commandes);
 const cmp=(x,y)=>{const d=[];for(let i=0;i<Math.max(x.length,y.length);i++)if(x[i]!==y[i])d.push({rang:i,js:(x[i]||'').slice(0,200),autre:(y[i]||'').slice(0,200)});return d;};
 const commandes={js:j1.commandes.length,wasm:w.commandes.length,bruitJs:cmp(j1.commandes,j2.commandes).length+cmp(j1.commandes,j3.commandes).length,
  differencesWasm:cmp(j1.commandes,w.commandes).slice(0,10),octets:{js:Buffer.byteLength(j1.commandes.join('\n')),wasm:Buffer.byteLength(w.commandes.join('\n'))}};
 const out={format:'ch064-banc-esv-v1',lot:j1.r.resume.lot,cuts:j1.r.resume.cuts.length,cutsPoses:[j1.r.resume.cutsPoses,w.r.resume.cutsPoses],
  ecrituresServeur:{js:j1.r.resume.ecrituresServeur,wasm:w.r.resume.ecrituresServeur},vuesComparees:Object.keys(vues(j1.r)).length,
  commandes,bruitJsContreJs:Object.keys(bruit),differencesJsContreWasm:Object.keys(dw),imputablesAuCoeur:imputables,compteursWasm:w.compteurs,
  dureeLotMs:{js:[j1.r.resume.dureeLotMs,j2.r.resume.dureeLotMs,j3.r.resume.dureeLotMs],wasm:w.r.resume.dureeLotMs},erreurs:{js:j1.r.resume.erreurs,wasm:w.r.resume.erreurs},
  verdict:Object.keys(imputables).length===0&&commandes.js>0&&commandes.differencesWasm.length===0&&w.compteurs&&Object.values(w.compteurs.facades).some(c=>c.coeur>0)?'IDENTIQUE':'ÉCART'};
 const s=JSON.stringify(out,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);if(out.verdict!=='IDENTIQUE')process.exitCode=1;}
main().catch(e=>{console.error(e);process.exit(1);});
