#!/usr/bin/env node
'use strict';
/* CH-064-D : banc de parité de la décision DANS CHROMIUM (référence, plan § 1), rapide sur un gros corpus.
 *   CH064D_MODULES=critere,signal node tools/ch064-d-chromium.cjs [--json SORTIE] [--lot 200]
 * Même adaptateur (ariane-rs/parite/decision.cjs), mêmes cas, même comparateur (tools/ch064-comparer.cjs) que
 * tools/ch064-parite.cjs --chromium ; seule différence : les trames canoniques des sorties sont hachées DANS la page
 * (SHA-256 par cas, crypto.subtle), seuls les condensés reviennent ; l'empreinte d'un côté est le SHA-256 de la suite de
 * ses condensés (égales des deux côtés ⇔ sorties identiques, cas par cas).
 * NaN : la charge d'un NaN n'est pas observable en JS (Object.is les confond ; VBA ne la garantit pas, chantiers/CH-064/vba.md) et
 * V8 dans Chromium en produit d'autres que le NaN canonique de Rust (mesuré : 0xFFFEFFFF_FFF6FFFF). Avant l'empreinte, chaque NaN
 * est remplacé par une marque, des DEUX côtés ; les cas dont seules les charges de NaN différaient sont comptés (`casChargeNaN`). */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {construire}=require('./ch064-construire.cjs');
const RACINE=path.resolve(__dirname,'..');
async function executer(adaptateur,octets,{lot=200,limite=Infinity}={}){
 const nav=adaptateur.navigateur,{chromium}=require('playwright'),b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
 try{const p=await b.newPage();
  /* contexte sécurisé (https) : crypto.subtle n'existe pas sur about:blank */
  const HOTE=['https:','','ch064-d.invalid'].join('/'); // hôte réservé (.invalid), jamais résolu : seul le routage de la page y répond
  await p.route(HOTE+'/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>banc</title>'}));await p.goto(HOTE+'/');
  for(const s of nav.scripts)await p.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
  await p.addScriptTag({content:'(function(){const module={};'+fs.readFileSync(path.join(__dirname,'ch064-comparer.cjs'),'utf8').replace("'use strict';",'')+';window.Ch064Comparer=module.exports;})();'});
  const ua=await p.evaluate(([b64,nav])=>{const coeur=ArianeCoeur.creer(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));
   const etat=(0,eval)(nav.preparer)(coeur),js=(0,eval)(nav.js),rs=(0,eval)(nav.rs);
   const sansNaN=Ch064Comparer.sansNaN; // du chef : trous, −0 et ordre des clés gardés
   const canon=(ok,v)=>ok?{valeur:sansNaN(v)}:{erreur:[v.constructor.name,v.message]};
   const brut=(ok,v)=>ok?{valeur:v}:{erreur:[v.constructor.name,v.message]};
   const hex=a=>Array.from(new Uint8Array(a),x=>x.toString(16).padStart(2,'0')).join('');
   window.__banc={chargeNaN:0,trames:[],coeur,etat,n:0,cas:0,identiques:0,ecarts:[],ms:{js:[],rs:[]},
    async passer(l){const tr=[];for(const c of l){this.n++;let a,r,t0=performance.now();try{a={ok:true,v:js(c.entree,etat)};}catch(e){a={ok:false,v:e};}
      const t1=performance.now();try{r={ok:true,v:rs(c.entree,etat)};}catch(e){r={ok:false,v:e};}const t2=performance.now();
      if(this.n>3){this.ms.js.push(t1-t0);this.ms.rs.push(t2-t1);}this.cas++;
      const e=a.ok!==r.ok?[{chemin:'(racine)',raison:a.ok?'JS rend, Rust lève : '+r.v.message:'JS lève ('+a.v.message+'), Rust rend'}]:Ch064Comparer.comparer(a.v,r.v);
      if(!e.length)this.identiques++;else if(this.ecarts.length<20)this.ecarts.push({cas:c.id,ecarts:e.slice(0,5)});
      const t=[a,r].map(x=>{try{return ArianeVba.encoder(canon(x.ok,x.v));}catch(z){return new TextEncoder().encode('non encodable : '+z.message);}});tr.push(t);
      const differe=(u,w)=>u.length!==w.length||u.some((v,i)=>v!==w[i]);
      if(!e.length&&!differe(t[0],t[1])){try{if(differe(ArianeVba.encoder(brut(a.ok,a.v)),ArianeVba.encoder(brut(r.ok,r.v))))this.chargeNaN++;}catch{}}
      if(!e.length&&differe(t[0],t[1])&&this.trames.length<10)this.trames.push({cas:c.id,js:Array.from(t[0].slice(0,400)),rs:Array.from(t[1].slice(0,400)),nJs:t[0].length,nRs:t[1].length});}
     const out=[];for(const [x,y] of tr)out.push([hex(await crypto.subtle.digest('SHA-256',x)),hex(await crypto.subtle.digest('SHA-256',y))]);return out;}};
   return navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0];},[octets.toString('base64'),nav]);
  const h={js:crypto.createHash('sha256'),rs:crypto.createHash('sha256')};let tampon=[],n=0;
  const vider=async()=>{if(!tampon.length)return;const d=await p.evaluate(l=>window.__banc.passer(l),tampon);tampon=[];for(const [x,y] of d){h.js.update(x);h.rs.update(y);}};
  for(const c of adaptateur.cas({})){if(n++>=limite)break;tampon.push(c);if(tampon.length>=lot)await vider();}
  await vider();
  const r=await p.evaluate(nav=>{const b=window.__banc,q=(a,x)=>{if(!a.length)return null;const s=a.slice().sort((u,v)=>u-v);return s[Math.min(s.length-1,Math.floor(x*s.length))];};
   return {casChargeNaN:b.chargeNaN,tramesDifferentes:b.trames,cas:b.cas,identiques:b.identiques,ecarts:b.ecarts,temps:{jsMediane:q(b.ms.js,.5),jsP95:q(b.ms.js,.95),rsMediane:q(b.ms.rs,.5),rsP95:q(b.ms.rs,.95)},
    memoireCoeur:b.coeur.etat(),tasJsOctets:performance.memory?performance.memory.usedJSHeapSize:null,bilanAdaptateur:(0,eval)(nav.bilan)(b.etat)};},nav);
  const empreintes={js:h.js.digest('hex'),rs:h.rs.digest('hex')};
  return {format:'ch064-parite-v1',moteur:'chromium',module:adaptateur.nom,navigateur:ua,...r,empreintes,verdict:r.cas>0&&r.identiques===r.cas&&empreintes.js===empreintes.rs?'IDENTIQUE':'ÉCART'};
 }finally{await b.close();}}
module.exports={executer};
if(require.main===module){const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 const ad=require(path.join(RACINE,'ariane-rs','parite','decision.cjs')),w=construire({silencieux:true});
 executer(ad,fs.readFileSync(w),{lot:Number(arg('--lot')||200),limite:arg('--limite')?Number(arg('--limite')):Infinity}).then(r=>{
  r.sources=Object.fromEntries(ad.sources.map(s=>[s,crypto.createHash('sha256').update(fs.readFileSync(path.join(RACINE,s))).digest('hex')]));
  const s=JSON.stringify(r,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);if(r.verdict!=='IDENTIQUE')process.exitCode=1;}).catch(e=>{console.error(e);process.exit(1);});}
