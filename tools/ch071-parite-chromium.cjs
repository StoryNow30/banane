#!/usr/bin/env node
'use strict';
/* CH-071 : parité du lot 300–349 DANS CHROMIUM, sur tous les cas de ariane-rs/parite/file.cjs (relevé, réel, variantes).
 *   node tools/ch071-parite-chromium.cjs [--lot 2000] [--json SORTIE]
 * Même comparaison stricte que tools/ch064-parite.cjs (tools/ch064-comparer.cjs, exceptions comprises) ; l'empreinte de chaque
 * côté (SHA-256 des trames VBA des sorties canoniques, NaN marqués) est calculée DANS la page (crypto.subtle) : seuls les
 * comptes, les 20 premiers écarts et les empreintes reviennent (le banc générique rapatrie chaque trame octet par octet,
 * plus de deux heures sur ces 453 637 cas). Le cœur doit porter le bras 300..=349 (chantiers/CH-071/branchement-coeur.patch). */
const fs=require('node:fs'),path=require('node:path');
const RACINE=path.resolve(__dirname,'..');
const a=process.argv.slice(2),arg=(k,d)=>a.includes(k)?a[a.indexOf(k)+1]:d,LOT=Number(arg('--lot',2000));
(async()=>{
 const A=require('../ariane-rs/parite/file.cjs'),{construire}=require('./ch064-construire.cjs');
 /* CH071_WASM : un cœur déjà construit avec le bras 300..=349 (le patch du cœur n'est pas versionné ici) */
 const w=process.env.CH071_WASM||construire({silencieux:true});if(!w)throw Error('cargo absent');
 const {chromium}=require('playwright'),b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
 try{const p=await b.newPage();
  /* contexte sûr (crypto.subtle) : page vide servie par Playwright lui-même, aucune requête ne sort */
  await p.route('https://banc.invalid/',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>banc</title>'}));await p.goto('https://banc.invalid/');
  for(const s of A.navigateur.scripts)await p.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
  await p.addScriptTag({content:'(function(){const module={};'+fs.readFileSync(path.join(__dirname,'ch064-comparer.cjs'),'utf8').replace("'use strict';",'')+';window.Ch064Comparer=module.exports;})();'});
  const ua=await p.evaluate(([b64,nav])=>{const o=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),coeur=ArianeCoeur.creer(o),t=(0,eval)(nav.preparer)(coeur);
   const js=(0,eval)(nav.js),rs=(0,eval)(nav.rs),canon=(ok,v)=>ok?{valeur:Ch064Comparer.sansNaN(v)}:{erreur:[v.constructor.name,v.message]};
   const trame=r=>{try{return ArianeVba.encoder(canon(r.ok,r.v));}catch(x){return new TextEncoder().encode('non encodable : '+x.message);}};
   /* Empreinte : SHA-256 de la suite des empreintes de lot (chaque lot : SHA-256 de ses trames, longueur comprise). */
   window.__b={coeur,t,cas:0,identiques:0,ecarts:[],lots:{js:[],rs:[]},
    async passer(l){const tr={js:[],rs:[]};
     for(const c of l){let x,y;try{x={ok:true,v:js(c.entree,t)};}catch(e){x={ok:false,v:e};}try{y={ok:true,v:rs(c.entree,t)};}catch(e){y={ok:false,v:e};}this.cas++;
      const e=x.ok!==y.ok?[{chemin:'(racine)',raison:x.ok?'JS rend, Rust lève : '+y.v.message:'JS lève ('+x.v.message+'), Rust rend'}]:Ch064Comparer.comparer(x.v,y.v);
      if(!e.length)this.identiques++;else if(this.ecarts.length<20)this.ecarts.push({cas:c.id,ecarts:e.slice(0,5)});
      for(const [k,r] of [['js',x],['rs',y]]){const o=trame(r),n=new Uint8Array(4);new DataView(n.buffer).setUint32(0,o.length,true);tr[k].push(n,o);}}
     for(const k of ['js','rs']){const tot=tr[k].reduce((s,u)=>s+u.length,0),buf=new Uint8Array(tot);let q=0;for(const u of tr[k]){buf.set(u,q);q+=u.length;}
      this.lots[k].push(new Uint8Array(await crypto.subtle.digest('SHA-256',buf)));}}};
   return navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0];},[fs.readFileSync(w).toString('base64'),A.navigateur]);
  let tampon=[],n=0;const t0=Date.now();
  const vider=async()=>{if(!tampon.length)return;await p.evaluate(l=>window.__b.passer(l),tampon);n+=tampon.length;tampon=[];if(n%(LOT*20)===0)console.error(n,'cas',Math.round((Date.now()-t0)/1000)+' s');};
  for(const c of A.cas()){tampon.push(c);if(tampon.length>=LOT)await vider();}
  await vider();
  const r=await p.evaluate(async()=>{const b=window.__b,h=async k=>{const tot=b.lots[k].length*32,buf=new Uint8Array(tot);b.lots[k].forEach((u,i)=>buf.set(u,i*32));
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256',buf))].map(x=>x.toString(16).padStart(2,'0')).join('');};
   return {cas:b.cas,identiques:b.identiques,ecarts:b.ecarts,empreintes:{js:await h('js'),rs:await h('rs')},bilanFacade:b.t.f.compteurs(),memoireCoeur:b.coeur.etat()};});
  const res={format:'ch071-parite-chromium-v1',navigateur:ua,...r,compte:A.compte(),secondes:Math.round((Date.now()-t0)/1000),
   verdict:r.cas>0&&r.identiques===r.cas&&r.empreintes.js===r.empreintes.rs?'IDENTIQUE':'ÉCART'};
  const s=JSON.stringify(res,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);if(res.verdict!=='IDENTIQUE')process.exitCode=1;
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
