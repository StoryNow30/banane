#!/usr/bin/env node
'use strict';
/* CH-064 : banc de TEMPS de `scientificProposeBoth` (src/gcv1-shadow.js, la science du moteur GCV1) dans Chromium (référence),
 * machine au repos, nuages réels.
 *   node --max-old-space-size=8000 tools/ch064-banc-shadow.cjs [--racine ARBRE] [--nuages N] [--rep R] [--json SORTIE]
 * --racine : arbre qui porte la façade de décision (ariane-rs/coquille/facade-decision.js, CH-064-D) ; défaut : ce dépôt.
 * Variantes, chacune dans une page neuve (le module GCV1 est capturé au chargement de gcv1-shadow.js) :
 *   js       : la chaîne du tronc telle quelle ;
 *   mediane  : src/geometry-candidate-v1.js avec le patch mediane-exacte de CH-065 ;
 *   elague   : avec geometrie-elaguee-lot puis mediane-exacte (CH-065) ;
 *   wasm     : la façade de CH-064-D (ArianeFacadeDecision.shadow.scientificProposeBoth) sur la chaîne du tronc.
 * Patchs lus par git show dans origin/chantier/CH-065 et appliqués sur une copie temporaire : src/ n'est jamais modifié.
 * Par nuage : R répétitions à chaud après une d'échauffement, médiane ; puis médiane et p95 des nuages. Identité de chaque
 * variante contre js : trames VBA de la sortie octet pour octet (NaN et fonctions remplacés par une marque, des deux côtés). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const ICI=path.resolve(__dirname,'..');
const CHAINE=['vendor/capture-core.js','src/gauge.js','src/geometry.js','src/brain.js','src/geometry-brain.js','src/gcv1-shadow-bootstrap.js','src/geometry-candidate-v1.js',
 'src/placement-convention.js','src/gcv1-shadow.js'];
const COQUILLE=['ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-decision.js'];
function gcv1Patche(racine,noms){const d=fs.mkdtempSync(path.join(os.tmpdir(),'ch064-shadow-'));
 try{fs.mkdirSync(path.join(d,'src'));fs.copyFileSync(path.join(racine,'src/geometry-candidate-v1.js'),path.join(d,'src/geometry-candidate-v1.js'));
  for(const nom of noms){const f=path.join(d,nom+'.patch');fs.writeFileSync(f,execFileSync('git',['show','origin/chantier/CH-065:chantiers/CH-065/'+nom+'.patch'],{cwd:ICI}));
   execFileSync('git',['apply',f],{cwd:d});}
  return fs.readFileSync(path.join(d,'src/geometry-candidate-v1.js'),'utf8');}finally{fs.rmSync(d,{recursive:true,force:true});}}
const q=(a,p)=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y);return Math.round(s[Math.min(s.length-1,Math.floor(p*s.length))]*1000)/1000;};
async function main(){
 const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 const racine=path.resolve(arg('--racine')||ICI),N=Number(arg('--nuages')||200),R=Number(arg('--rep')||15);
 for(const s of COQUILLE)if(!fs.existsSync(path.join(racine,s)))throw Error('absent de '+racine+' : '+s+' (façade de CH-064-D)');
 const {construire}=require(path.join(racine,'tools/ch064-construire.cjs')),{nuages}=require(path.join(ICI,'tools/ch064-nuages.cjs'));
 const w=construire({silencieux:true}),wasm=fs.readFileSync(w).toString('base64');
 const source=s=>fs.readFileSync(path.join(racine,s),'utf8');
 const VARIANTES={js:{},mediane:{gcv1:gcv1Patche(racine,['mediane-exacte'])},elague:{gcv1:gcv1Patche(racine,['geometrie-elaguee-lot','mediane-exacte'])},wasm:{facade:true}};
 const cs=[...nuages(N)];
 const {chromium}=require('playwright'),b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
 const out={format:'ch064-banc-shadow-v1',nuages:cs.length,repetitions:R,unite:'ms par appel (médiane des nuages de la médiane des répétitions)',variantes:{}};
 const empreintes={},erreurs={};
 try{for(const [nom,v] of Object.entries(VARIANTES)){
  const p=await b.newPage();await p.goto('about:blank');
  for(const s of CHAINE)await p.addScriptTag({content:s==='src/geometry-candidate-v1.js'&&v.gcv1?v.gcv1:source(s)});
  for(const s of COQUILLE)await p.addScriptTag({content:source(s)});
  out.navigateur=await p.evaluate(([x,facade])=>{
   const f=facade?(()=>{const coeur=ArianeCoeur.creer(Uint8Array.from(atob(x),c=>c.charCodeAt(0)));window.coeur=coeur;
    const F=ArianeFacadeDecision.creer(coeur,{shadow:BananeGCV1Shadow,convention:BananePlacementConvention});window.F=F;return F.shadow;})():BananeGCV1Shadow;
   window.appel=c=>f.scientificProposeBoth(c);
   const marque=v=>typeof v==='function'?'\u0000fonction':typeof v==='number'&&Number.isNaN(v)?'\u0000NaN':Array.isArray(v)?(()=>{const r=new Array(v.length);for(let i=0;i<v.length;i++)if(i in v)r[i]=marque(v[i]);return r;})()
    :v&&typeof v==='object'?Object.fromEntries(Object.keys(v).map(k=>[k,marque(v[k])])):v;
   window.trame=r=>{const t=ArianeVba.encoder(marque(r));let s='';for(let i=0;i<t.length;i+=8192)s+=String.fromCharCode.apply(null,t.subarray(i,i+8192));return btoa(s);};
   return navigator.userAgent.match(/Chrome\/[\d.]+/)[0];},[wasm,!!v.facade]);
  const ms=[];empreintes[nom]=[];
  for(const c of cs){const r=await p.evaluate(([c,R])=>{const s=structuredClone(c);let res;try{res={ok:appel(structuredClone(s))};}catch(e){res={err:[e.constructor.name,e.message]};}
    const v=[];for(let i=0;i<R;i++){const x=structuredClone(s);const t0=performance.now();try{appel(x);}catch{}v.push(performance.now()-t0);}v.sort((x,y)=>x-y);
    return {ms:v[v.length>>1],...(res.err?{erreur:res.err}:{trame:trame(res.ok)})};},[c,R]);
   ms.push(r.ms);empreintes[nom].push(crypto.createHash('sha256').update(r.erreur?'erreur '+JSON.stringify(r.erreur):Buffer.from(r.trame,'base64')).digest('hex'));
   if(r.erreur)(erreurs[nom]=erreurs[nom]||[]).push(r.erreur);}
  const etat=v.facade?await p.evaluate(()=>({coeur:coeur.etat(),compteurs:F.compteurs()})):undefined;
  out.variantes[nom]={mediane:q(ms,.5),p95:q(ms,.95),n:ms.length,...(nom==='js'?{}:{identiquesAuTronc:empreintes[nom].filter((h,i)=>h===empreintes.js[i]).length}),...(etat?{facade:etat}:{}),...(erreurs[nom]?{erreurs:erreurs[nom].length,premiereErreur:erreurs[nom][0]}:{})};
  console.error(nom,JSON.stringify(out.variantes[nom]));await p.close();}
 }finally{await b.close();}
 const s=JSON.stringify(out,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1);});
