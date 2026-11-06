#!/usr/bin/env node
'use strict';
/* CH-064 : essai, dans Chromium, de la proposition de relevé de la CSP d'ESV (chantiers/CH-064/patch-releve-csp.patch).
 * Le patch est appliqué à une COPIE de src/esv-observer.js dans un dossier temporaire : src/ n'est jamais modifié.
 * Trois pages factices (domaine réservé « exemple ») : CSP en en-tête stricte avec rapport, CSP en balise meta avec
 * 'wasm-unsafe-eval', sans CSP. Chaque page déclenche elle-même une violation (eval) ; l'observateur la relève passivement.
 *   node tools/ch064-essai-releve-csp.cjs [--json SORTIE]
 * Limite (dite dans la sortie) : sans balise meta ni violation spontanée de la page, la CSP en en-tête reste INCONNUE. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const RACINE=path.resolve(__dirname,'..');
async function main(){
 const t=fs.mkdtempSync(path.join(os.tmpdir(),'ch064-csp-'));fs.mkdirSync(path.join(t,'src'));
 fs.copyFileSync(path.join(RACINE,'src/esv-observer.js'),path.join(t,'src/esv-observer.js'));
 execFileSync('patch',['-p1','-s','-d',t,'-i',path.join(RACINE,'chantiers/CH-064/patch-releve-csp.patch')]);
 const src=fs.readFileSync(path.join(t,'src/esv-observer.js'),'utf8'),{chromium}=require('playwright'),b=await chromium.launch(),out={};
 const CAS=[['entete-stricte-avec-rapport',"script-src 'self' 'unsafe-inline' https://a.exemple https://b.exemple; report-uri /r",null,true],
  ['meta-wasm-unsafe-eval',null,"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",true],['entete-sans-violation',"script-src 'self' 'unsafe-inline'",null,false],['sans-csp',null,null,true]];
 for(const [nom,entete,meta,viole] of CAS){const ctx=await b.newContext(),p=await ctx.newPage();
  await p.route('https://essai.exemple/**',r=>r.fulfill({status:200,contentType:'text/html',headers:entete?{'content-security-policy':entete}:{},
   body:'<!doctype html><html><head>'+(meta?'<meta http-equiv="Content-Security-Policy" content="'+meta+'">':'')+'</head><body>'+(viole?'<script>try{eval("1")}catch(e){}</script>':'')+'</body></html>'}));
  await p.addInitScript(src);await p.goto('https://essai.exemple/rails_validation/x');
  out[nom]=await p.evaluate(()=>new Promise(res=>{addEventListener('message',e=>{if(e.data&&e.data.kind==='banane5:esv-observation'&&e.data.entry.kind==='observer')res(e.data.entry.csp);});
   setTimeout(()=>postMessage({kind:'banane5:snapshot'},location.origin),200);setTimeout(()=>res('aucune marque'),3000);}));
  await ctx.close();}
 await b.close();fs.rmSync(t,{recursive:true,force:true});
 const ok=out['entete-stricte-avec-rapport']?.politique?.wasmUnsafeEval===false&&out['entete-stricte-avec-rapport']?.politique?.rapport===true&&out['entete-stricte-avec-rapport']?.politique?.sourcesHotes===2
  &&out['meta-wasm-unsafe-eval']?.meta?.wasmUnsafeEval===true&&out['entete-sans-violation']?.politique===null&&out['entete-sans-violation']?.meta?.n===0&&out['sans-csp']?.violations===0;
 const r={format:'ch064-essai-releve-csp-v1',verdict:ok?'CONFORME':'ÉCART',limite:'entete-sans-violation : politique null et meta n=0 ⇒ CSP INCONNUE (pas « absente »)',cas:out};
 const s=JSON.stringify(r,null,1);const a=process.argv.slice(2);if(a.includes('--json'))fs.writeFileSync(a[a.indexOf('--json')+1],s+'\n');console.log(s);if(!ok)process.exitCode=1;}
main().catch(e=>{console.error(e);process.exit(1);});
