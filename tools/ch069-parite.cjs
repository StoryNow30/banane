#!/usr/bin/env node
'use strict';
/* CH-069 : parité de l'export, JS du tronc contre la façade WASM, dans Node ou dans Chromium (/opt/pw-browsers/chromium).
 *   node tools/ch069-parite.cjs [--moteur node|chromium] [--reels N] [--sans-releve] [--sans-variantes] [--json SORTIE]
 * Cas : tools/ch069-adaptateur.cjs (relevé des essais du tronc, données réelles de banane-data, variantes à graine fixe).
 * Comparaison stricte (tools/ch064-comparer.cjs : types, Object.is, trous, ordre des clés, exceptions). Empreinte : SHA-256
 * de la suite des SHA-256 des sorties canoniques (trame VBA, NaN marqués), une par côté ; égales ⇔ identité.
 * Le cœur est construit avec le branchement de CH-069 (tools/ch069-commun.cjs). Code 1 au premier écart. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const C=require('./ch069-commun.cjs'),A=require('./ch069-adaptateur.cjs'),{comparer,sansNaN}=require('./ch064-comparer.cjs');
const Vba=require('../ariane-rs/coquille/vba.js'),Coeur=require('../ariane-rs/coquille/coeur.js');
const RACINE=C.RACINE;
const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
const moteur=arg('--moteur')||'node',reels=arg('--reels')!==null?Number(arg('--reels')):Infinity;
function*lesCas(){if(!a.includes('--sans-releve'))yield* A.releve();if(reels>0)yield* A.reels(reels);if(!a.includes('--sans-variantes'))yield* A.variantes();}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const canon=(ok,v)=>ok?{valeur:sansNaN(v)}:{erreur:[v&&v.constructor&&v.constructor.name,v&&v.message]};
function trame(ok,v){try{return Vba.encoder(canon(ok,v));}catch(x){return Buffer.from('non encodable : '+x.message);}}
function nouveauBilan(){return {cas:0,identiques:0,ecarts:[],parFonction:{},empreintes:{js:crypto.createHash('sha256'),rs:crypto.createHash('sha256')}};}
function noter(b,c,e,hjs,hrs){b.cas++;const f=c.entree.f;const p=b.parFonction[f]||(b.parFonction[f]={cas:0,identiques:0});p.cas++;
 if(!e.length){b.identiques++;p.identiques++;}else if(b.ecarts.length<20)b.ecarts.push({cas:c.id,ecarts:e.slice(0,5)});
 b.empreintes.js.update(hjs);b.empreintes.rs.update(hrs);}
function clore(b,extra){const empreintes={js:b.empreintes.js.digest('hex'),rs:b.empreintes.rs.digest('hex')};
 return {format:'ch069-parite-v1',...extra,cas:b.cas,identiques:b.identiques,ecarts:b.ecarts,parFonction:b.parFonction,empreintes,
  sources:Object.fromEntries(C.SOURCES.map(s=>[s,sha(fs.readFileSync(path.join(RACINE,s)))])),
  verdict:b.cas>0&&b.identiques===b.cas&&empreintes.js===empreintes.rs?'IDENTIQUE':'ÉCART'};}

function enNode(w){
 const coeur=Coeur.creer(fs.readFileSync(w)),b=nouveauBilan();
 const capter=f=>{try{return {ok:true,v:f()};}catch(e){return {ok:false,v:e};}};
 for(const c of lesCas()){
  const t0=Date.now(),x=capter(()=>A.js(c.entree)),t1=Date.now(),y=capter(()=>A.rs(c.entree,coeur));
  if(a.includes('--suivi'))console.error(c.id,c.entree.f,'js',t1-t0,'ms rs',Date.now()-t1,'ms');
  const e=x.ok!==y.ok?[{chemin:'(racine)',raison:x.ok?'JS rend, Rust lève : '+y.v.message:'JS lève ('+x.v.message+'), Rust rend'}]:comparer(x.v,y.v);
  noter(b,c,e,Buffer.from(sha(trame(x.ok,x.v)),'hex'),Buffer.from(sha(trame(y.ok,y.v)),'hex'));
 }
 return clore(b,{moteur:'node '+process.version,bilanFacade:A.bilan(),memoireCoeur:coeur.etat()});
}

async function enChromium(w){
 const {chromium}=require('playwright');
 const nav=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
 try{
  const page=await nav.newPage();
  await page.goto('about:blank');
  for(const s of C.SCRIPTS_NAVIGATEUR)await page.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
  await page.addScriptTag({content:'(function(){const module={};'+fs.readFileSync(path.join(__dirname,'ch064-comparer.cjs'),'utf8').replace("'use strict';",'')+';window.Ch064Comparer=module.exports;})();'});
  const ua=await page.evaluate(async([dev,cmp,jouer,b64])=>{
   const octets=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;};
   const o=octets(b64);const coeur=ArianeCoeur.creer(o);
   const G=globalThis;const js={nativeExport:G.BananeNativeExport,phasePli:G.BananePhasePli,gcv1Export:G.BananeGCV1Export,exportCache:G.BananeExportCache,zip:G.BananeZip};
   const f=ArianeFacadeExport.creer(coeur,{NativeExport:G.BananeNativeExport,PhasePli:G.BananePhasePli,GCV1Export:G.BananeGCV1Export,ExportCache:G.BananeExportCache,Zip:G.BananeZip});
   const developper=(0,eval)('('+dev+')'),comparable=(0,eval)('('+cmp+')'),j=(0,eval)('('+jouer+')');
   const canon=(ok,v)=>ok?{valeur:Ch064Comparer.sansNaN(v)}:{erreur:[v&&v.constructor&&v.constructor.name,v&&v.message]};
   const hex=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
   const trame=(ok,v)=>{try{return ArianeVba.encoder(canon(ok,v));}catch(x){return new TextEncoder().encode('non encodable : '+x.message);}};
   G.__ch069={async passer(cle,fn){const oct=octets(cle);
    const lire=()=>developper(ArianeVba.decoder(oct));let x,y;
    try{x={ok:true,v:comparable(j(js,fn,lire()))};}catch(e){x={ok:false,v:e};}
    try{y={ok:true,v:comparable(j(f,fn,lire()))};}catch(e){y={ok:false,v:e};}
    const e=x.ok!==y.ok?[{chemin:'(racine)',raison:x.ok?'JS rend, Rust lève : '+y.v.message:'JS lève ('+x.v.message+'), Rust rend'}]:Ch064Comparer.comparer(x.v,y.v);
    return {e,hjs:await hex(trame(x.ok,x.v)),hrs:await hex(trame(y.ok,y.v))};},
    bilan:()=>({facade:f.compteurs(),coeur:coeur.etat()})};
   return navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0];},[C.SOURCE_DEVELOPPER,C.SOURCE_COMPARABLE,A.jouerSource(),fs.readFileSync(w).toString('base64')]);
  const b=nouveauBilan();
  for(const c of lesCas()){const o=c.entree.octets;
   const r=await page.evaluate(([k,fn])=>globalThis.__ch069.passer(k,fn),[Buffer.from(o.buffer,o.byteOffset,o.byteLength).toString('base64'),c.entree.f]);
   noter(b,c,r.e,Buffer.from(r.hjs,'hex'),Buffer.from(r.hrs,'hex'));if(a.includes('--suivi'))console.error(c.id,c.entree.f,r.e.length?'ÉCART':'ok');}
  const fin=await page.evaluate(()=>globalThis.__ch069.bilan());
  return clore(b,{moteur:'chromium',navigateur:ua,bilanFacade:fin.facade,memoireCoeur:fin.coeur});
 }finally{await nav.close();}
}

async function principal(){
 const w=C.construireCoeur();
 const r=moteur==='chromium'?await enChromium(w):enNode(w);
 const s=JSON.stringify(r,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);
 if(r.verdict!=='IDENTIQUE')process.exitCode=1;
}
if(require.main===module)principal().catch(e=>{console.error(e);process.exit(1);});
