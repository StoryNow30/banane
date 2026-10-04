#!/usr/bin/env node
'use strict';
// U2 : panneau de production sous origine extension réelle ; backend synthétique.
// Hors verify. Aucun résultat vert si Chromium/extension/zoom ne sont pas disponibles.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const support=path.resolve(__dirname,'../tests/browser/u2-49');
const {fixture,installer}=require(path.join(support,'backend.cjs'));
const {Blocked}=require(path.join(support,'helpers.cjs'));
const matrix=JSON.parse(fs.readFileSync(path.join(support,'matrix.json'))).map(f=>require(path.join(support,f)));
const LIMIT_MS=7000;
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function git(root,args){try{return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{return null;}}
function targetInfo(root){
 const files=['manifest.json','panel.html','panel.js','panel.css'];
 for(const f of files)if(!fs.existsSync(path.join(root,f)))throw Error('Cible incomplète : '+f);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
 if(manifest.manifest_version!==3)throw Error('Cible MV3 requise');
 return {folder:root,commit:git(root,['rev-parse','HEAD']),gitStatus:git(root,['status','--porcelain']),version:manifest.version,
   name:manifest.name,hashes:Object.fromEntries(files.map(f=>[f,sha(path.join(root,f))]))};
}
function loadPlaywright(){
 for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright',process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES&&path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'),'/opt/node22/lib/node_modules/playwright'].filter(Boolean)){
  try{const resolved=require.resolve(p),pw=require(resolved);return {pw,module:resolved};}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
 }
 throw new Blocked('Playwright absent ; définir PLAYWRIGHT_MODULE');
}
function blockedRows(scenarios,reason){return scenarios.map(s=>({id:s.id,status:'BLOCKED',executed:false,durationMs:null,expected:s.expected,source:s.source,reason}));}
async function run(folder,{scenario,headed=false}={}){
 const scenarios=scenario?matrix.filter(s=>s.id===scenario):matrix;
 if(!scenarios.length)throw Error('Scénario inconnu : '+scenario);
 const report={schema:'ariane-u2-ui-1',startedAt:new Date().toISOString(),target:targetInfo(path.resolve(folder)),
  environment:{node:process.version,platform:process.platform,headed,viewport:{width:560,height:900}},
  simulation:'API panel.sendMessage remplacée ; lots synthétiques sans géométrie, aucun onglet ESV, réseau HTTP(S) bloqué',
  extension:{loaded:false},browserVersion:null,scenarioLimitMs:LIMIT_MS,results:[]};
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ariane-u2-'));let ctx;
 try{
  const {pw,module}=loadPlaywright();report.environment.playwrightModule=module;
  report.environment.playwrightVersion=require(path.join(path.dirname(module),'package.json')).version;
  const executable=process.env.CHROMIUM||pw.chromium.executablePath();report.environment.chromiumExecutable=executable;
  if(!fs.existsSync(executable))throw new Blocked('Chromium absent : '+executable);
  const launchAt=performance.now();
  ctx=await pw.chromium.launchPersistentContext(profile,{executablePath:executable,headless:!headed,viewport:report.environment.viewport,
    timeout:15000,args:['--no-sandbox',...(headed?[]:['--headless=new']),`--disable-extensions-except=${report.target.folder}`,`--load-extension=${report.target.folder}`]});
  await ctx.route(/^https?:\/\//,r=>r.abort('blockedbyclient'));
  const sw=ctx.serviceWorkers().find(w=>w.url().startsWith('chrome-extension://'))||await ctx.waitForEvent('serviceworker',{timeout:5000});
  const id=new URL(sw.url()).hostname;
  const runtime=await sw.evaluate(()=>({id:chrome.runtime.id,manifest:chrome.runtime.getManifest()}));
  if(runtime.id!==id||runtime.manifest.version!==report.target.version||runtime.manifest.name!==report.target.name)
    throw new Blocked('Extension chargée différente de la cible');
  report.extension={loaded:true,id,serviceWorker:sw.url(),runtimeManifest:runtime.manifest,launchDurationMs:Math.round(performance.now()-launchAt)};
  report.browserVersion=ctx.browser()?.version()||await sw.evaluate(()=>navigator.userAgent);
  for(const s of scenarios){
   const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(2000);
   const initial=fixture(s.mode);initial.__running=fixture('running').batch;
   await page.emulateMedia({reducedMotion:s.reducedMotion||'reduce',colorScheme:s.colorScheme||'light'});
   await page.addInitScript(installer,initial);
   const started=performance.now();let timer;const result={id:s.id,expected:s.expected,source:s.source,executed:false};
   try{
    const work=async()=>{
     const url=`chrome-extension://${id}/panel.html#${s.view}`;
     await page.goto(url,{waitUntil:'load',timeout:3000});
     await page.waitForFunction(()=>globalThis.__u2?.views>0&&document.body.dataset.window===location.hash.slice(1),null,{timeout:2000});
     result.executed=true;
     // Preuves : ressources réellement chargées depuis la cible, non fixture web historique.
     const resources=await page.evaluate(()=>({url:location.href,runtimeId:chrome.runtime.id,
       scripts:[...document.scripts].map(x=>x.src),styles:[...document.querySelectorAll('link[rel=stylesheet]')].map(x=>x.href),synthetic:__u2.synthetic}));
     if(resources.runtimeId!==id||!resources.scripts.includes(`chrome-extension://${id}/panel.js`)||!resources.styles.includes(`chrome-extension://${id}/panel.css`))
      throw Error('Ressources du panneau réel non confirmées');
     result.resources=resources;result.observation=await s.run(page);
     result.backendCalls=await page.evaluate(()=>__u2.calls);
     if(errors.length)throw Error('pageerror : '+errors.join(' ; '));
    };
    await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Budget de 7 s dépassé')),LIMIT_MS);})]);
    result.status='PASS';
   }catch(e){result.status=e instanceof Blocked?'BLOCKED':'FAIL';result.reason=e.message;
    try{result.diagnostic=await page.evaluate(()=>({focus:document.activeElement?.id||document.activeElement?.tagName,
      notice:document.getElementById('notice')?.textContent,calls:globalThis.__u2?.calls,view:document.body.dataset.window}));}catch{/* page non chargée */}
   }finally{clearTimeout(timer);result.pageErrors=errors;result.durationMs=Math.round(performance.now()-started);await page.close();}
   report.results.push(result);
  }
 }catch(e){report.infrastructureError=e.message;
  const completed=new Set(report.results.map(r=>r.id));report.results.push(...blockedRows(scenarios.filter(s=>!completed.has(s.id)),e.message));}
 finally{if(ctx)await ctx.close();fs.rmSync(profile,{recursive:true,force:true});}
 report.targetAfter=targetInfo(report.target.folder);
 report.targetUnchanged=JSON.stringify(report.target.hashes)===JSON.stringify(report.targetAfter.hashes);
 report.counts={total:report.results.length,pass:report.results.filter(x=>x.status==='PASS').length,fail:report.results.filter(x=>x.status==='FAIL').length,
  blocked:report.results.filter(x=>x.status==='BLOCKED').length,executed:report.results.filter(x=>x.executed).length};
 report.selection=scenario||'all';
 report.executedScopeGate=report.counts.fail===0&&report.counts.blocked===0&&report.counts.executed===scenarios.length&&report.targetUnchanged?'PASS':'NOT_PASSED';
 // Même tout vert sur la base ne vaut jamais acceptation U2 du futur panneau U1.
 report.u2Acceptance='NOT_GRANTED: préparation ; rejeu du commit U1 et de l’assemblage requis';
 report.finishedAt=new Date().toISOString();return report;
}
function options(argv){const [folder,...args]=argv;if(!folder)throw Error('Usage : DOSSIER [--scenario ID] [--output JSON] [--headed]');
 const opts={};for(let i=0;i<args.length;i++){const a=args[i];if(a==='--headed')opts.headed=true;
 else if(['--scenario','--output'].includes(a)&&args[i+1]&&!args[i+1].startsWith('--'))opts[a.slice(2)]=args[++i];else throw Error('Option invalide : '+a);}return {folder,opts};}
if(require.main===module){(async()=>{const {folder,opts}=options(process.argv.slice(2));const r=await run(folder,opts),out=JSON.stringify(r,null,2)+'\n';
 if(opts.output)fs.writeFileSync(path.resolve(opts.output),out);process.stdout.write(out);
 process.exitCode=r.counts.fail||!r.targetUnchanged?1:r.counts.blocked?2:0;})().catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={run,options,targetInfo,matrix,blockedRows,LIMIT_MS};
