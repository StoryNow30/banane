#!/usr/bin/env node
'use strict';
/* CH-064 : banc de parité GÉNÉRIQUE, JS contre Rust/WASM.
 *   node tools/ch064-parite.cjs --module <nom> [--limite N] [--nuages N] [--json SORTIE] [--chromium]
 * Un adaptateur `ariane-rs/parite/<nom>.cjs` exporte :
 *   nom, description ;
 *   cas(options) : itérable de cas { id, entree } (corpus réel et fixtures ; id sans donnée identifiante) ;
 *   js(entree)   : appel du module JS d'origine (rend une valeur ou lève) ;
 *   rs(entree, coeur) : appel du port par la coquille (coeur.appeler) ;
 *   sources : chemins des fichiers JS de référence (empreinte SHA-256 consignée : cible mouvante, tools/ch064-suivi.cjs).
 * Comparaison stricte (tools/ch064-comparer.cjs), exceptions comprises. Sortie : cas, identiques, 20 premiers écarts,
 * empreintes VBA des sorties des deux côtés (égales ⇔ identité), temps par cas (médiane, p95), mémoire du cœur.
 * --chromium : le même banc dans /opt/pw-browsers/chromium (référence de parité, plan § 1). */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{performance}=require('node:perf_hooks');
const Vba=require('../ariane-rs/coquille/vba.js'),Coeur=require('../ariane-rs/coquille/coeur.js');
const {comparer}=require('./ch064-comparer.cjs'),{construire}=require('./ch064-construire.cjs');
const RACINE=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const quantile=(a,p)=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(p*b.length))];};
function capter(f){try{return {ok:true,valeur:f()};}catch(e){return {ok:false,valeur:e instanceof Error?e:new Error(String(e))};}}
/* Sortie canonique pour l'empreinte : une exception devient {erreur:[constructeur, message]}. */
const canon=r=>r.ok?{valeur:r.valeur}:{erreur:[r.valeur.constructor.name,r.valeur.message]};
function executer(adaptateur,coeur,opts={}){const {limite=Infinity,echauffement=3}=opts;
 const res={module:adaptateur.nom,cas:0,identiques:0,ecarts:[],ms:{js:[],rs:[]},empreintes:{js:crypto.createHash('sha256'),rs:crypto.createHash('sha256')}};
 let n=0;
 for(const c of adaptateur.cas({max:opts.nuages??Infinity})){if(n>=limite)break;n++;
  const t0=performance.now(),a=capter(()=>adaptateur.js(c.entree)),t1=performance.now(),b=capter(()=>adaptateur.rs(c.entree,coeur)),t2=performance.now();
  if(n>echauffement){res.ms.js.push(t1-t0);res.ms.rs.push(t2-t1);}
  res.cas++;
  const e=a.ok!==b.ok?[{chemin:'(racine)',raison:a.ok?'JS rend, Rust lève : '+b.valeur.message:'JS lève ('+a.valeur.message+'), Rust rend'}]:comparer(a.valeur,b.valeur);
  if(!e.length)res.identiques++;else if(res.ecarts.length<20)res.ecarts.push({cas:c.id,ecarts:e.slice(0,5)});
  for(const [cote,r] of [['js',a],['rs',b]]){let t;try{t=Vba.encoder(canon(r));}catch(x){t=Buffer.from('non encodable : '+x.message);}res.empreintes[cote].update(t);}
 }
 res.empreintes={js:res.empreintes.js.digest('hex'),rs:res.empreintes.rs.digest('hex')};
 res.temps={jsMediane:quantile(res.ms.js,.5),jsP95:quantile(res.ms.js,.95),rsMediane:quantile(res.ms.rs,.5),rsP95:quantile(res.ms.rs,.95)};delete res.ms;
 res.memoireCoeur=coeur.etat();
 if(typeof adaptateur.bilan==='function')res.bilanAdaptateur=adaptateur.bilan();
 res.sources=Object.fromEntries((adaptateur.sources||[]).map(s=>[s,sha(fs.readFileSync(path.join(RACINE,s)))]));
 res.verdict=res.cas>0&&res.identiques===res.cas&&res.empreintes.js===res.empreintes.rs?'IDENTIQUE':'ÉCART';
 return res;
}
/* Chromium : la page charge les scripts de l'adaptateur, le comparateur et le cœur ; les cas y sont envoyés par lots ;
 * JS et Rust y tournent et y sont comparés ; seuls les écarts, les empreintes et les temps reviennent. */
async function executerChromium(adaptateur,octetsWasm,{limite=Infinity,nuages=Infinity,lot=20,echauffement=3}={}){
 const nav=adaptateur.navigateur;if(!nav)throw Error('adaptateur sans exécution navigateur : '+adaptateur.nom);
 const {chromium}=require('playwright'),b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
 try{const p=await b.newPage();await p.goto('about:blank');
  for(const s of nav.scripts)await p.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
  await p.addScriptTag({content:'(function(){const module={};'+fs.readFileSync(path.join(__dirname,'ch064-comparer.cjs'),'utf8').replace("'use strict';",'')+';window.Ch064Comparer=module.exports;})();'});
  const ua=await p.evaluate(async([b64,nav])=>{const o=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const coeur=ArianeCoeur.creer(o);
   const etat=(0,eval)(nav.preparer)(coeur);const js=(0,eval)(nav.js),rs=(0,eval)(nav.rs);
   const canon=(ok,v)=>ok?{valeur:v}:{erreur:[v.constructor.name,v.message]};
   const h={js:[],rs:[]};
   window.__banc={coeur,etat,n:0,cas:0,identiques:0,ecarts:[],ms:{js:[],rs:[]},trames:h,
    passer(lot){for(const c of lot){this.n++;let a,b,t0=performance.now();try{a={ok:true,v:js(c.entree,etat)};}catch(e){a={ok:false,v:e};}const t1=performance.now();
     try{b={ok:true,v:rs(c.entree,etat)};}catch(e){b={ok:false,v:e};}const t2=performance.now();if(this.n>3){this.ms.js.push(t1-t0);this.ms.rs.push(t2-t1);}this.cas++;
     const e=a.ok!==b.ok?[{chemin:'(racine)',raison:a.ok?'JS rend, Rust lève : '+b.v.message:'JS lève ('+a.v.message+'), Rust rend'}]:Ch064Comparer.comparer(a.v,b.v);
     if(!e.length)this.identiques++;else if(this.ecarts.length<20)this.ecarts.push({cas:c.id,ecarts:e.slice(0,5)});
     for(const [k,r] of [['js',a],['rs',b]]){let t;try{t=ArianeVba.encoder(canon(r.ok,r.v));}catch(x){t=new TextEncoder().encode('non encodable : '+x.message);}h[k].push(t);}}}};
   return navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0];},[octetsWasm.toString('base64'),nav]);
  let tampon=[],n=0;const digests={js:crypto.createHash('sha256'),rs:crypto.createHash('sha256')};
  const vider=async()=>{if(!tampon.length)return;await p.evaluate(l=>window.__banc.passer(l),tampon);tampon=[];
   const tr=await p.evaluate(()=>{const b=window.__banc,o={js:b.trames.js.map(t=>Array.from(t)),rs:b.trames.rs.map(t=>Array.from(t))};b.trames.js=[];b.trames.rs=[];return o;});
   for(const k of ['js','rs'])for(const t of tr[k])digests[k].update(Buffer.from(t));};
  for(const c of adaptateur.cas({max:nuages})){if(n++>=limite)break;tampon.push(c);if(tampon.length>=lot)await vider();}
  await vider();
  const r=await p.evaluate(nav=>{const b=window.__banc,q=(a,x)=>{if(!a.length)return null;const s=a.slice().sort((u,v)=>u-v);return s[Math.min(s.length-1,Math.floor(x*s.length))];};
   return {cas:b.cas,identiques:b.identiques,ecarts:b.ecarts,temps:{jsMediane:q(b.ms.js,.5),jsP95:q(b.ms.js,.95),rsMediane:q(b.ms.rs,.5),rsP95:q(b.ms.rs,.95)},
    memoireCoeur:b.coeur.etat(),tasJsOctets:performance.memory?performance.memory.usedJSHeapSize:null,bilanAdaptateur:nav.bilan?(0,eval)(nav.bilan)(b.etat):null};},nav);
  const empreintes={js:digests.js.digest('hex'),rs:digests.rs.digest('hex')};
  return {module:adaptateur.nom,navigateur:ua,...r,empreintes,verdict:r.cas>0&&r.identiques===r.cas&&empreintes.js===empreintes.rs?'IDENTIQUE':'ÉCART'};
 }finally{await b.close();}
}
module.exports={executer,executerChromium,canon,capter};
if(require.main===module){
 const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 const nom=arg('--module');if(!nom)throw Error('--module requis');
 const adaptateur=require(path.join(RACINE,'ariane-rs','parite',nom+'.cjs'));
 const w=construire({silencieux:true});if(!w){console.error('cargo absent');process.exit(2);}
 const o={limite:arg('--limite')?Number(arg('--limite')):Infinity,nuages:arg('--nuages')?Number(arg('--nuages')):Infinity};
 const fin=res=>{res.sources=Object.fromEntries((adaptateur.sources||[]).map(s=>[s,sha(fs.readFileSync(path.join(RACINE,s)))]));
  const s=JSON.stringify(res,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);if(res.verdict!=='IDENTIQUE')process.exitCode=1;};
 if(a.includes('--chromium'))executerChromium(adaptateur,fs.readFileSync(w),o).then(r=>fin({format:'ch064-parite-v1',moteur:'chromium',...r})).catch(e=>{console.error(e);process.exit(1);});
 else fin({format:'ch064-parite-v1',moteur:'node '+process.version,...executer(adaptateur,Coeur.creer(fs.readFileSync(w)),o)});
}
