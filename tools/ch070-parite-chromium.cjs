'use strict';
/* CH-070 : variante de executerChromium (tools/ch064-parite.cjs) pour les GROSSES sorties (journaux réels de 85 Mo) :
 * chaque sortie, canonisée et encodée en VBA comme dans le banc du chef, est condensée DANS LA PAGE (SHA-256,
 * crypto.subtle) ; seule l'empreinte de chaque cas revient. Empreinte d'un côté = SHA-256 de la suite des empreintes
 * par cas. Comparaison stricte (tools/ch064-comparer.cjs) dans la page, exceptions comprises, comme le banc du chef. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const RACINE=path.resolve(__dirname,'..');
async function executerChromium(ad,octetsWasm,{nuages=Infinity,lot=2}={}){
 const nav=ad.navigateur,{chromium}=require('playwright'),b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
 try{const p=await (await b.newContext(process.env.CH070_LOCALE?{locale:process.env.CH070_LOCALE}:{})).newPage();// contexte sûr (crypto.subtle) : une page locale servie par interception, aucune requête réseau
  await p.route('http://localhost/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>banc</title>'}));await p.goto('http://localhost/banc');
  /* un script {chemin, global} est chargé comme module CommonJS (sans s'installer dans la page) et exposé sous `global` */
  for(const s of nav.scripts){const c=fs.readFileSync(path.join(RACINE,typeof s==='string'?s:s.chemin),'utf8');
   await p.addScriptTag({content:typeof s==='string'?c:'(function(){const module={exports:{}};'+c+'\n;window['+JSON.stringify(s.global)+']=module.exports;})();'});}
  await p.addScriptTag({content:'(function(){const module={};'+fs.readFileSync(path.join(__dirname,'ch064-comparer.cjs'),'utf8').replace("'use strict';",'')+';window.Ch064Comparer=module.exports;})();'});
  const ua=await p.evaluate(([b64,nav])=>{const o=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const coeur=ArianeCoeur.creer(o);
   const etat=(0,eval)(nav.preparer)(coeur),js=(0,eval)(nav.js),rs=(0,eval)(nav.rs);
   const canon=(ok,v)=>ok?{valeur:Ch064Comparer.sansNaN(v)}:{erreur:[v.constructor.name,v.message]};
   const hex=a=>Array.from(new Uint8Array(a),x=>x.toString(16).padStart(2,'0')).join('');
   const trame=r=>{try{return ArianeVba.encoder(canon(r.ok,r.v));}catch(x){return new TextEncoder().encode('non encodable : '+x.message);}};
   window.__banc={coeur,etat,n:0,cas:0,identiques:0,ecarts:[],ms:{js:[],rs:[]},
    async passer(l){const d={js:[],rs:[]};for(const c of l){this.n++;let a,b;const t0=performance.now();try{a={ok:true,v:js(c.entree,etat)};}catch(e){a={ok:false,v:e};}
     const t1=performance.now();try{b={ok:true,v:rs(c.entree,etat)};}catch(e){b={ok:false,v:e};}const t2=performance.now();
     if(this.n>3){this.ms.js.push(t1-t0);this.ms.rs.push(t2-t1);}this.cas++;
     const e=a.ok!==b.ok?[{chemin:'(racine)',raison:a.ok?'JS rend, Rust lève : '+b.v.message:'JS lève ('+a.v.message+'), Rust rend'}]:Ch064Comparer.comparer(a.v,b.v);
     if(!e.length)this.identiques++;else if(this.ecarts.length<20)this.ecarts.push({cas:c.id,ecarts:e.slice(0,5)});
     d.js.push(hex(await crypto.subtle.digest('SHA-256',trame(a))));d.rs.push(hex(await crypto.subtle.digest('SHA-256',trame(b))));}return d;}};
   return navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0]+' '+new Intl.Collator().resolvedOptions().locale;},[octetsWasm.toString('base64'),nav]);
  const h={js:crypto.createHash('sha256'),rs:crypto.createHash('sha256')};let tampon=[];
  const vider=async()=>{if(!tampon.length)return;const d=await p.evaluate(l=>window.__banc.passer(l),tampon);tampon=[];for(const k of ['js','rs'])for(const x of d[k])h[k].update(x);};
  for(const c of ad.cas({max:nuages,navigateur:true})){tampon.push(c);if(tampon.length>=lot)await vider();}
  await vider();
  const r=await p.evaluate(nav=>{const b=window.__banc,q=(a,x)=>{if(!a.length)return null;const s=a.slice().sort((u,v)=>u-v);return s[Math.min(s.length-1,Math.floor(x*s.length))];};
   return {cas:b.cas,identiques:b.identiques,ecarts:b.ecarts,temps:{jsMediane:q(b.ms.js,.5),jsP95:q(b.ms.js,.95),rsMediane:q(b.ms.rs,.5),rsP95:q(b.ms.rs,.95)},
    memoireCoeur:b.coeur.etat(),bilanAdaptateur:nav.bilan?(0,eval)(nav.bilan)(b.etat):null};},nav);
  const empreintes={js:h.js.digest('hex'),rs:h.rs.digest('hex')};
  return {module:ad.nom,navigateur:ua,...r,empreintes,verdict:r.cas>0&&r.identiques===r.cas&&empreintes.js===empreintes.rs?'IDENTIQUE':'ÉCART'};
 }finally{await b.close();}
}
module.exports={executerChromium};
