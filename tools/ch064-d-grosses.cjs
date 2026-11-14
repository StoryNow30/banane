#!/usr/bin/env node
'use strict';
/* CH-064-D : les plus grosses entrées du corpus réel, et la preuve du plafond de 256 Mio sur elles (demande de l'intégrateur, 09/11).
 *   BANANE_DATA=<corpus> CHROMIUM=<chromium> node --max-old-space-size=12000 tools/ch064-d-grosses.cjs --sortie DOSSIER_HORS_DEPOT [--n 20] [--max K (essai : balayage limité aux K premiers cas)] [--json RESUME.json]
 * Phase 1 (balayer) : parcourt TOUS les cas de la parité D (même générateur que tools/ch064-d-chromium.cjs), garde les N plus grosses entrées
 *   (taille = longueur du JSON de l'entrée, la même mesure que `entreeMax` du banc), les écrit HORS dépôt (DOSSIER/grosses.v8 : ce sont des données
 *   terrain) et ne verse dans le résumé que : rang, taille, module, fonction, indice du cas dans le parcours (jamais l'identifiant du cas).
 * Phase 2 (rejouer) : rejoue ces N cas, un par lot de 1, dans une page Chromium neuve par cas, avec le cœur au plafond de ariane-rs/.cargo/config.toml ;
 *   relève pour chacun : identique (oui/non), haute eau, réinstanciations, repli éventuel, ou l'arrêt de la page. Verdict : n identiques / n. */
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8');
const RACINE=path.resolve(__dirname,'..');
const a=process.argv.slice(2),arg=(k,d=null)=>a.includes(k)?a[a.indexOf(k)+1]:d;
const N=Number(arg('--n',20)),MAX=Number(arg('--max',0)),SORTIE=arg('--sortie');
if(!SORTIE||path.resolve(SORTIE).startsWith(RACINE+path.sep)){console.error('--sortie hors du dépôt exigée');process.exit(2);}
fs.mkdirSync(SORTIE,{recursive:true});
const taille=c=>{const s=JSON.stringify(c.entree);return s?s.length:0;};
function balayer(ad){
 const top=[];let i=0,t0=Date.now(),min=0;
 for(const c of ad.cas({})){if(MAX&&i>=MAX)break;const t=taille(c);i++;
  if(top.length<N||t>min){top.push({taille:t,indice:i-1,id:c.id,module:c.entree.module,f:c.entree.f,cas:c});top.sort((x,y)=>y.taille-x.taille);if(top.length>N)top.length=N;min=top[top.length-1].taille;}
  if(i%50000===0)console.error('balayé',i,'cas,',Math.round((Date.now()-t0)/1000),'s, plus petite des',N,':',min);}
 console.error('balayage fini :',i,'cas');return {total:i,top};
}
(async()=>{
 const {construire}=require('./ch064-construire.cjs'),{executer}=require('./ch064-d-chromium.cjs');
 const ad=require(path.join(RACINE,'ariane-rs','parite','decision.cjs'));
 const fichier=path.join(SORTIE,'grosses.v8');let b;
 if(fs.existsSync(fichier)&&a.includes('--reutiliser'))b=v8.deserialize(fs.readFileSync(fichier));
 else{b=balayer(ad);fs.writeFileSync(fichier,v8.serialize(b));}
 const octets=fs.readFileSync(construire({silencieux:true})),res=[];
 for(const [r,g] of b.top.entries()){
  const un={...ad,cas:()=>[g.cas][Symbol.iterator]()};
  let o;try{o=await executer(un,octets,{lot:1,tranche:1,json:null});}catch(e){o={verdict:'ARRÊT : '+String(e.message).split('\n')[0]};}
  res.push({rang:r+1,taille:g.taille,module:g.module,f:g.f,indiceCas:g.indice,verdict:o.verdict,identiques:o.identiques??null,hauteEauOctets:o.hauteEauMax??null,tasMaxOctets:o.tasMax??o.tasMaxOctets??null,
   memoireCoeur:o.tranches?.[0]?.memoireCoeur??o.memoireCoeur??null});
  console.error('rang',r+1,'taille',g.taille,g.module+'.'+g.f,o.verdict,'haute eau',o.hauteEauMax);}
 const resume={format:'ch064-d-grosses-v1',cas:b.total,n:b.top.length,identiques:res.filter(x=>x.verdict==='IDENTIQUE').length,plafondOctets:268435456,
  hauteEauMaxOctets:Math.max(...res.map(x=>x.hauteEauOctets||0)),grosses:res};
 if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify(resume,null,1)+'\n');
 console.log(JSON.stringify(resume,null,1));
 if(resume.identiques!==resume.n)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
