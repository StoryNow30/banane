#!/usr/bin/env node
'use strict';
/* CH-064-D : banc de parité de la décision DANS CHROMIUM (référence, plan § 1), rapide sur un gros corpus.
 *   CH064D_MODULES=critere,signal node tools/ch064-d-chromium.cjs [--json SORTIE] [--lot 20] [--tranche 3000] [--saut N]
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
async function unePage(adaptateur,octets,{lot=20,limite=Infinity,saut=0,lotsMax=Infinity,it=null}={}){
 const nav=adaptateur.navigateur,{chromium}=require('playwright'),b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--enable-precise-memory-info']});
 const journal=[];let plantage=null; // CH-064 (chef) : diagnostic du plantage de la page (demande de l'intégrateur)
 try{const p=await b.newPage();
  p.on('crash',()=>{plantage=plantage||'crash du moteur de rendu';});p.on('close',()=>{plantage=plantage||'page fermée';});
  /* contexte sécurisé (https) : crypto.subtle n'existe pas sur about:blank */
  const origine=['https:','','ch064-d.invalid'].join('/');/* adresse bâtie (scan-identite) */
  await p.route(origine+'/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>banc</title>'}));await p.goto(origine+'/');
  for(const s of nav.scripts)await p.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
  await p.addScriptTag({content:'(function(){const module={};'+fs.readFileSync(path.join(__dirname,'ch064-comparer.cjs'),'utf8').replace("'use strict';",'')+';window.Ch064Comparer=module.exports;})();'});
  const ua=await p.evaluate(([b64,nav])=>{const coeur=ArianeCoeur.creer(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));
   const etat=(0,eval)(nav.preparer)(coeur),js=(0,eval)(nav.js),rs=(0,eval)(nav.rs);
   const sansNaN=v=>typeof v==='number'&&Number.isNaN(v)?'\u0000NaN':Array.isArray(v)?Array.from(v,sansNaN):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,sansNaN(x)])):v;
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
  /* chaque lot : mémoire linéaire du cœur avant et après, réinstanciations, tas JS, taille de la plus grosse entrée (octets VBA) */
  let lots=0;
  const vider=async()=>{if(!tampon.length)return;lots++;
   const avant=await p.evaluate(()=>({...window.__banc.coeur.etat(),tas:performance.memory?performance.memory.usedJSHeapSize:null}));
   const entreeMax=Math.max(...tampon.map(c=>JSON.stringify(c.entree)?.length||0)),modules=[...new Set(tampon.map(c=>String(c.id).split(/[-:]/)[0]))];
   let d;try{d=await p.evaluate(l=>window.__banc.passer(l),tampon);}
   catch(e){const diag={lot:lots,cas:n,modules,entreeMaxCaracteres:entreeMax,avant,derniers:journal.slice(-5),plantage};
    console.error('PLANTAGE '+JSON.stringify(diag));throw e;}
   const apres=await p.evaluate(()=>({...window.__banc.coeur.etat(),tas:performance.memory?performance.memory.usedJSHeapSize:null}));
   journal.push({lot:lots,modules,entreeMax,memoire:[avant.memoire,apres.memoire],reinst:apres.reinstanciations,hauteEau:apres.hauteEau,tas:apres.tas});
   if((saut+lots)%20===0)console.error('lot '+(saut+lots)+' '+JSON.stringify(journal.at(-1)));
   tampon=[];for(const [x,y] of d){h.js.update(x);h.rs.update(y);}};
  /* tranche (D-305, demande de l'intégrateur) : on saute les `saut` premiers lots, on s'arrête après `lotsMax` lots (page neuve à la tranche suivante) */
  /* `it` : itérateur de cas partagé par toutes les tranches d'un processus (sauter 300 000 cas coûte environ une heure : une seule fois) */
  let fini=true;it=it||adaptateur.cas({})[Symbol.iterator]();
  for(let x=it.next();!x.done;x=it.next()){const c=x.value;if(n++>=limite)break;tampon.push(c);if(tampon.length>=lot){await vider();if(lots>=lotsMax){fini=false;break;}}}
  await vider();
  const r=await p.evaluate(nav=>{const b=window.__banc,q=(a,x)=>{if(!a.length)return null;const s=a.slice().sort((u,v)=>u-v);return s[Math.min(s.length-1,Math.floor(x*s.length))];};
   return {casChargeNaN:b.chargeNaN,tramesDifferentes:b.trames,cas:b.cas,identiques:b.identiques,ecarts:b.ecarts,temps:{jsMediane:q(b.ms.js,.5),jsP95:q(b.ms.js,.95),rsMediane:q(b.ms.rs,.5),rsP95:q(b.ms.rs,.95)},
    memoireCoeur:b.coeur.etat(),tasJsOctets:performance.memory?performance.memory.usedJSHeapSize:null,bilanAdaptateur:(0,eval)(nav.bilan)(b.etat)};},nav);
  const empreintes={js:h.js.digest('hex'),rs:h.rs.digest('hex')};
  const tas=journal.map(j=>j.tas).filter(Number.isFinite);
  return {format:'ch064-parite-v1',moteur:'chromium',module:adaptateur.nom,navigateur:ua,lotDebut:saut,lotsFaits:lots,fini,tasMax:tas.length?Math.max(...tas):null,tasFin:tas.at(-1)??null,hauteEauMax:journal.length?Math.max(...journal.map(j=>j.hauteEau||0)):null,...r,empreintes,verdict:r.cas>0&&r.identiques===r.cas&&empreintes.js===empreintes.rs?'IDENTIQUE':'ÉCART'};
 }finally{await b.close();}}
/* Exécute par tranches de `tranche` lots, une page neuve chacune ; le fichier `json` est réécrit après chaque tranche (verdict PARTIEL tant que le corpus n'est pas fini).
 * Reprise : `--saut N` (N = lots déjà faits) relit les tranches du fichier. Le tas par tranche (tasMax, tasFin) dit si la fuite suit la page (façade) ou l'outil. */
async function executer(adaptateur,octets,{lot=20,limite=Infinity,saut=0,tranche=3000,json=null}={}){
 let tranches=[];
 if(saut>0){if(!json||!fs.existsSync(json))throw new Error('--saut demande le fichier de sortie (--json) des tranches déjà faites');
  const t=JSON.parse(fs.readFileSync(json,'utf8')).tranches||[];tranches=t.filter(x=>x.lotDebut+x.lotsFaits<=saut);
  if(tranches.reduce((a,x)=>a+x.lotsFaits,0)!==saut)throw new Error('les tranches du fichier ne couvrent pas exactement '+saut+' lots');}
 const agreger=(termine)=>{const T=tranches,cas=T.reduce((a,x)=>a+x.cas,0),identiques=T.reduce((a,x)=>a+x.identiques,0),med=k=>{const v=T.map(x=>x.temps[k]).filter(Number.isFinite).sort((a,b)=>a-b);return v.length?v[v.length>>1]:null;};
  const emp=k=>crypto.createHash('sha256').update(T.map(x=>x.empreintes[k]).join('')).digest('hex'),empreintes={js:emp('js'),rs:emp('rs')},egales=T.every(x=>x.empreintes.js===x.empreintes.rs);
  return {format:'ch064-parite-v2-tranches',moteur:'chromium',module:adaptateur.nom,navigateur:T[0]?.navigateur,lot,tranche,termine,lotsFaits:T.reduce((a,x)=>a+x.lotsFaits,0),cas,identiques,
   casChargeNaN:T.reduce((a,x)=>a+x.casChargeNaN,0),ecarts:T.flatMap(x=>x.ecarts).slice(0,20),tramesDifferentes:T.flatMap(x=>x.tramesDifferentes).slice(0,10),
   temps:{jsMediane:med('jsMediane'),jsP95:med('jsP95'),rsMediane:med('rsMediane'),rsP95:med('rsP95'),note:'médiane des médianes de tranche'},
   tasMaxOctets:Math.max(...T.map(x=>x.tasMax||0)),hauteEauMax:Math.max(...T.map(x=>x.hauteEauMax||0)),empreintes,
   verdict:!termine?'PARTIEL':cas>0&&identiques===cas&&egales?'IDENTIQUE':'ÉCART',tranches:T};};
 const ecrire=termine=>{const r=agreger(termine);if(json)fs.writeFileSync(json,JSON.stringify(r,null,1)+'\n');return r;};
 let s=saut;const it=adaptateur.cas({})[Symbol.iterator]();
 for(let k=0;k<saut*lot;k++)if(it.next().done)break;/* reprise : un seul saut par processus */
 for(;;){let r;
  try{r=await unePage(adaptateur,octets,{lot,limite:limite-tranches.reduce((a,x)=>a+x.cas,0),saut:s,lotsMax:tranche,it});}
  catch(e){console.error('Arrêt dans la tranche commençant au lot '+s+' : reprendre avec --saut '+s+' (tranches faites gardées dans le fichier)');ecrire(false);throw e;}
  if(r.cas>0)tranches.push(r);s+=r.lotsFaits;console.error('tranche finie : lots '+r.lotDebut+'..'+s+', cas '+r.cas+', tas max '+r.tasMax+', tas fin '+r.tasFin+', haute eau '+r.hauteEauMax);
  if(r.fini||r.cas===0)break;ecrire(false);}
 return ecrire(true);}
module.exports={executer,unePage};
if(require.main===module){const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 const ad=require(path.join(RACINE,'ariane-rs','parite','decision.cjs')),w=construire({silencieux:true});
 executer(ad,fs.readFileSync(w),{lot:Number(arg('--lot')||20),limite:arg('--limite')?Number(arg('--limite')):Infinity,saut:Number(arg('--saut')||0),tranche:Number(arg('--tranche')||3000),json:arg('--json')}).then(r=>{
  r.sources=Object.fromEntries(ad.sources.map(s=>[s,crypto.createHash('sha256').update(fs.readFileSync(path.join(RACINE,s))).digest('hex')]));
  const s=JSON.stringify(r,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);if(r.verdict!=='IDENTIQUE')process.exitCode=1;}).catch(e=>{console.error(e);process.exit(1);});}
