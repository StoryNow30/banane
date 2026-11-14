#!/usr/bin/env node
'use strict';
/* CH-071 : temps par appel, JS du tronc contre façade WASM (traversée JS ↔ WASM et codec VBA compris), dans Chromium.
 *   node tools/ch071-banc-temps.cjs [--rep 15] [--par 300] [--appels 3000] [--json SORTIE]
 * Pour chaque fonction : jusqu'à `--par` cas (relevé des essais du tronc, puis données réelles : ariane-rs/parite/file.cjs),
 * répétés jusqu'à `--appels` appels par répétition ; arguments décodés AVANT la mesure (copies neuves à chaque répétition,
 * les deux côtés écrivant en place) ; deux répétitions de chauffe, puis `--rep` mesurées ; médiane et p90 du temps par appel.
 * Machine au repos : ne rien lancer d'autre pendant le banc. */
const fs=require('node:fs'),path=require('node:path');
const RACINE=path.resolve(__dirname,'..');
const a=process.argv.slice(2),arg=(k,d)=>a.includes(k)?a[a.indexOf(k)+1]:d;
const REP=Number(arg('--rep',15)),PAR=Number(arg('--par',300)),APPELS=Number(arg('--appels',3000));
(async()=>{
 const A=require('../ariane-rs/parite/file.cjs'),{construire}=require('./ch064-construire.cjs');
 /* CH071_WASM : un cœur déjà construit avec le bras 300..=349 (le patch du cœur n'est pas versionné ici) */
 const w=process.env.CH071_WASM||construire({silencieux:true});if(!w)throw Error('cargo absent');
 const groupes={};
 for(const c of A.cas()){if(c.id.startsWith('variante-'))break;const f=c.id.replace(/^(releve|reel)-\d+-/,'');const g=groupes[f]=groupes[f]||[];if(g.length<PAR)g.push(c.entree.vba);}
 const {chromium}=require('playwright'),b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
 try{const p=await b.newPage();await p.goto('about:blank');
  for(const s of A.navigateur.scripts)await p.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
  const ua=await p.evaluate(b64=>{const o=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));window.__coeur=ArianeCoeur.creer(o);
   const M={parties:BananeFileParties,prioritaire:ArianeFilePrioritaire,serie:BananeSerieCapturesVides,raison:BananeRaisonCorrection};
   window.__M=M;window.__F=ArianeFacadeFile.creer(window.__coeur,M);return navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0];},fs.readFileSync(w).toString('base64'));
  const res={format:'ch071-banc-temps-v1',navigateur:ua,rep:REP,appelsParRep:APPELS,fonctions:{}};
  for(const [f,vbas] of Object.entries(groupes).sort()){
   const r=await p.evaluate(([f,vbas,REP,APPELS])=>{const [m,fn]=f.split('.');
    const dec=s=>{const x=ArianeVba.decoder(Uint8Array.from(atob(s),c=>c.charCodeAt(0)));if(x.juges)x.args[1]={...x.args[1],jugesDeja:new Set(x.juges)};return x.args;};
    const n=Math.max(1,Math.ceil(APPELS/vbas.length)),liste=[];for(let i=0;i<n;i++)liste.push(...vbas);
    const q=(t,x)=>{const s=t.slice().sort((u,v)=>u-v);return s[Math.min(s.length-1,Math.floor(x*s.length))];};
    const mesurer=Mod=>{const t=[];for(let k=0;k<REP+2;k++){const args=liste.map(dec),g=Mod[m][fn];const t0=performance.now();
      for(const x of args){try{g(...x);}catch{}}const d=(performance.now()-t0)/args.length;if(k>=2)t.push(d*1000);}return {medianeUs:q(t,.5),p90Us:q(t,.9)};};
    const avant=window.__F.compteurs();const js=mesurer(window.__M),rs=mesurer(window.__F),apres=window.__F.compteurs();
    return {cas:vbas.length,appels:liste.length,js,rs,replis:apres.repliHorsDomaine-avant.repliHorsDomaine+apres.repliFormat-avant.repliFormat+apres.repliEcriture-avant.repliEcriture,
     memoireCoeur:window.__coeur.etat()};},[f,vbas,REP,APPELS]);
   r.rapport=r.js.medianeUs>0?Math.round(r.rs.medianeUs/r.js.medianeUs*100)/100:null;r.verdict=r.rs.medianeUs<r.js.medianeUs?'WASM plus rapide':'reste en JS';
   res.fonctions[f]=r;console.error(f.padEnd(32),'JS',r.js.medianeUs.toFixed(3),'µs  WASM',r.rs.medianeUs.toFixed(3),'µs  ×',r.rapport);}
  res.memoireCoeur=await p.evaluate(()=>window.__coeur.etat());
  const s=JSON.stringify(res,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
