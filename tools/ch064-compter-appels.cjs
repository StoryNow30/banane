#!/usr/bin/env node
'use strict';
/* CH-064 : appels et temps passés dans la science du moteur GCV1 (`scientificProposeBoth`, avec et sans réservoir) pendant un
 * VRAI lot rejoué sur la maquette d'ESV, par cut.
 *   node tools/ch064-compter-appels.cjs --export EXPORT.json [--part N] [--json SORTIE]
 * Copie du paquet officiel (JS seul, aucun cœur), construite à part (ariane-rs/dist/extension-compte) ; un seul script y est
 * ajouté, juste après src/gcv1-shadow.js dans le service worker : il remplace le global BananeGCV1Shadow par une enveloppe gelée
 * de même API qui compte les appels et additionne leur durée (performance.now). Les modules qui lisent ce global au moment de
 * l'appel, ou au chargement après lui (gcv2-l1), passent par l'enveloppe. Temps INCLUSIF de l'appel, mesuré dans le service
 * worker pendant le lot (machine au repos, rien d'autre en parallèle) ; src/ n'est pas modifié. */
const fs=require('node:fs'),path=require('node:path');
const {construireExtension}=require('./ch064-construire-extension.cjs');
const B=require('./banc-esv.cjs'),N=require('../tests/esv-maquette/navigateur.cjs');
const RACINE=path.resolve(__dirname,'..');
const ENVELOPPE=`'use strict';
/* CH-064 (copie de mesure seulement) : enveloppe de comptage de BananeGCV1Shadow. */
(function(){const S=globalThis.BananeGCV1Shadow,n={},ms={},parCut={};
 const env={};for(const k of Object.keys(S))env[k]=S[k];
 for(const f of ['scientificProposeBoth','scientificProposeBothAvecReservoir']){n[f]=0;ms[f]=0;
  env[f]=function(c){const t0=performance.now();try{return S[f].apply(this,arguments);}finally{const d=performance.now()-t0;n[f]++;ms[f]+=d;
   const k=(c&&c.identity&&c.identity.part)+'-'+(c&&c.identity&&c.identity.cut);const e=parCut[k]=parCut[k]||{};e[f]=(e[f]||0)+1;e[f+'Ms']=(e[f+'Ms']||0)+d;}};}
 globalThis.BananeGCV1Shadow=Object.freeze(env);
 globalThis.ARIANE_RS_COMPTEURS=()=>({appels:n,ms,parCut});})();
`;
function construireCopie(){
 const sortie=construireExtension({modules:[],sortie:path.join(RACINE,'ariane-rs','dist','extension-compte')});
 fs.mkdirSync(path.join(sortie,'ariane'),{recursive:true});fs.writeFileSync(path.join(sortie,'ariane','compteur-shadow.js'),ENVELOPPE);
 const bp=path.join(sortie,'background.js');let b=fs.readFileSync(bp,'utf8');const ancre="'src/gcv1-shadow.js',";
 if(b.split(ancre).length!==2)throw Error('ancre src/gcv1-shadow.js introuvable ou multiple dans background.js');
 fs.writeFileSync(bp,b.replace(ancre,ancre+"'ariane/compteur-shadow.js',"));
 const mp=path.join(sortie,'manifest.json'),m=JSON.parse(fs.readFileSync(mp,'utf8'));m.name+=' (comptage, essai CH-064)';fs.writeFileSync(mp,JSON.stringify(m,null,2)+'\n');
 return sortie;}
async function jouer(extension,o){let compteurs=null;const pw=N.playwright(),orig=pw.chromium.launchPersistentContext;
 pw.chromium.launchPersistentContext=async function(...a){const ctx=await orig.apply(this,a);const close=ctx.close.bind(ctx);
  ctx.close=async()=>{try{compteurs=await ctx.serviceWorkers()[0].evaluate(()=>globalThis.ARIANE_RS_COMPTEURS?globalThis.ARIANE_RS_COMPTEURS():null);}catch{}return close();};return ctx;};
 const f=path.join(path.dirname(extension),path.basename(extension)+'-rapport.json');
 try{await B.banc({...o,extension,json:f});}finally{pw.chromium.launchPersistentContext=orig;}
 const r=JSON.parse(fs.readFileSync(f,'utf8'));fs.rmSync(f,{force:true});return {r,compteurs};}
async function main(){const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 if(!arg('--export'))throw Error('--export requis');
 const o={export:path.resolve(arg('--export'))};if(arg('--part'))o.part=Number(arg('--part'));
 const {r,compteurs}=await jouer(construireCopie(),o);if(!compteurs)throw Error('compteurs illisibles dans le service worker');
 const cuts=r.resume.cuts.length,lotMs=r.dureeLotMs??null,q=(v,p)=>{const s=v.slice().sort((x,y)=>x-y);return s.length?Math.round(s[Math.min(s.length-1,Math.floor(p*s.length))]*10)/10:null;};
 const pc=Object.values(compteurs.parCut),tot=e=>(e.scientificProposeBothMs||0)+(e.scientificProposeBothAvecReservoirMs||0),nb=e=>(e.scientificProposeBoth||0)+(e.scientificProposeBothAvecReservoir||0);
 const out={format:'ch064-compter-appels-v1',lot:r.resume.lot,cuts,erreurs:r.erreurs?.length??null,appels:compteurs.appels,
  msTotal:Object.fromEntries(Object.entries(compteurs.ms).map(([k,v])=>[k,Math.round(v)])),
  parCut:{appelsMoyens:Math.round(Object.values(compteurs.appels).reduce((s,x)=>s+x,0)/cuts*100)/100,msMoyens:Math.round(Object.values(compteurs.ms).reduce((s,x)=>s+x,0)/cuts),
   cutsAvecAppel:pc.length,appelsMediane:q(pc.map(nb),.5),appelsMax:Math.max(0,...pc.map(nb)),msMediane:q(pc.map(tot),.5),msP90:q(pc.map(tot),.9)},
  msParAppel:Object.fromEntries(Object.keys(compteurs.appels).map(k=>[k,compteurs.appels[k]?Math.round(compteurs.ms[k]/compteurs.appels[k]*10)/10:null]))};
 const s=JSON.stringify(out,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exit(1);});
