#!/usr/bin/env node
'use strict';
/* CH-069 : banc de temps de l'export dans Chromium (/opt/pw-browsers/chromium), machine AU REPOS, rien d'autre en parallèle.
 *   node tools/ch069-banc.cjs [--rep 15] [--json SORTIE]
 * Par fonction portée, deux entrées réelles (« typique » : taille médiane, « grosse » : la plus grosse) parmi les cas de
 * tools/ch069-adaptateur.cjs (données réelles d'abord, variantes pour les fonctions sans cas réel). Chaque répétition
 * appelle K fois la fonction (K tel qu'une répétition dure au moins 20 ms côté JS), d'abord le JS du tronc, puis la façade
 * WASM (trame VBA aller et retour COMPRISE) ; médiane et P90 par appel sur `rep` répétitions, après 3 d'échauffement.
 * crc32 : en plus, le chemin direct (`ariane_export_crc32`, octets copiés dans la mémoire du cœur, sans trame).
 * Mémoire : haute eau de la mémoire linéaire du cœur, tas JS (performance.memory). */
const fs=require('node:fs'),path=require('node:path');
const C=require('./ch069-commun.cjs'),A=require('./ch069-adaptateur.cjs');
const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null,REP=Number(arg('--rep')||15);
function choisir(){
 const parF=new Map();
 const prendre=(c,source)=>{const l=parF.get(c.entree.f)||[];if(l.length>=40)return;l.push({...c,source});parF.set(c.entree.f,l);};
 let docs=0;for(const c of A.reels(60)){prendre(c,'réel');if(++docs>4000)break;}
 for(const c of A.variantes(150))if(!parF.has(c.entree.f)||parF.get(c.entree.f).every(x=>x.source==='variante'))prendre(c,'variante');
 const out=[];
 for(const [f,l] of parF){const s=l.slice().sort((x,y)=>x.entree.octets.length-y.entree.octets.length);
  const typ=s[s.length>>1],gros=s[s.length-1];out.push({f,taille:'typique',cas:typ});if(gros!==typ)out.push({f,taille:'grosse',cas:gros});}
 return out.sort((x,y)=>x.f.localeCompare(y.f));
}
async function principal(){
 const w=C.construireCoeur(),choix=choisir();
 const {chromium}=require('playwright'),nav=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
 const res=[];
 try{
  const page=await nav.newPage();
  await page.goto('about:blank');
  for(const s of C.SCRIPTS_NAVIGATEUR)await page.addScriptTag({content:fs.readFileSync(path.join(C.RACINE,s),'utf8')});
  const ua=await page.evaluate(async([dev,jouer,b64])=>{
   const octets=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;};
   const o=octets(b64);const coeur=ArianeCoeur.creer(o);const G=globalThis;
   const M={NativeExport:G.BananeNativeExport,PhasePli:G.BananePhasePli,GCV1Export:G.BananeGCV1Export,ExportCache:G.BananeExportCache,Zip:G.BananeZip};
   const js={nativeExport:M.NativeExport,phasePli:M.PhasePli,gcv1Export:M.GCV1Export,exportCache:M.ExportCache,zip:M.Zip},f=ArianeFacadeExport.creer(coeur,M);
   const developper=(0,eval)('('+dev+')'),j=(0,eval)('('+jouer+')');
   const direct=new WebAssembly.Instance(coeur.module,ArianeCoeur.IMPORTS).exports;
   const crcDirect=(oct,crc=0)=>{const p=direct.vba_reserver(oct.length);new Uint8Array(direct.memory.buffer,p,oct.length).set(oct);const r=direct.ariane_export_crc32(p,oct.length,crc)>>>0;direct.vba_liberer(p,oct.length);return r;};
   const q=(t,x)=>{const s=t.slice().sort((u,v)=>u-v);return s[Math.min(s.length-1,Math.floor(x*s.length))];};
   G.__banc={async mesurer(cle,fn,rep){
    const oct=octets(cle);const args=developper(ArianeVba.decoder(oct));
    const cotes={js:()=>j(js,fn,args),wasm:()=>j(f,fn,args)};
    if(fn==='Zip.crc32'&&args[0] instanceof Uint8Array)cotes.direct=()=>crcDirect(args[0],args[1]);
    // K : au moins 20 ms par répétition côté JS
    let K=1;for(;;){const t0=performance.now();for(let i=0;i<K;i++)cotes.js();const d=performance.now()-t0;if(d>=20||K>=1<<16)break;K*=d<1?16:2;}
    const out={K,octetsEntree:oct.length};
    for(const [nom,g] of Object.entries(cotes)){const t=[];for(let r=0;r<rep+3;r++){const t0=performance.now();for(let i=0;i<K;i++)g();const d=(performance.now()-t0)/K;if(r>=3)t.push(d);}
     out[nom]={medianeMs:q(t,.5),p90Ms:q(t,.9)};}
    out.coeur=coeur.etat();out.tasJsOctets=performance.memory?performance.memory.usedJSHeapSize:null;
    out.repli=f.compteurs();return out;}};
   return navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0];},[C.SOURCE_DEVELOPPER,A.jouerSource(),fs.readFileSync(w).toString('base64')]);
  for(const c of choix){const o=c.cas.entree.octets;
   const r=await page.evaluate(([k,fn,rep])=>globalThis.__banc.mesurer(k,fn,rep),[Buffer.from(o.buffer,o.byteOffset,o.byteLength).toString('base64'),c.f,REP]);
   const ligne={fonction:c.f,taille:c.taille,source:c.cas.source,...r,rapportWasmSurJs:r.wasm.medianeMs/r.js.medianeMs};
   res.push(ligne);console.error(c.f.padEnd(36),c.taille.padEnd(8),'JS',r.js.medianeMs.toPrecision(4),'ms  WASM',r.wasm.medianeMs.toPrecision(4),'ms',r.direct?'  direct '+r.direct.medianeMs.toPrecision(4)+' ms':'');}
  const s=JSON.stringify({format:'ch069-banc-v1',navigateur:ua,repetitions:REP,echauffement:3,mesures:res},null,1);
  if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);
 }finally{await nav.close();}
}
if(require.main===module)principal().catch(e=>{console.error(e);process.exit(1);});
