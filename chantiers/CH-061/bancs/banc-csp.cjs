/* CH-061 : où WebAssembly peut-il tourner dans une extension MV3 ? Vraie extension chargée dans Chromium, deux pages servies
 * localement : sans CSP, et avec une CSP stricte (script-src 'self'). Mesure : service worker, monde MAIN, monde isolé. */
'use strict';
const http=require('http'),path=require('path'),fs=require('fs'),os=require('os');const {chromium}=require('playwright');
async function essai(manifeste){
  const srv=http.createServer((q,r)=>{const h={'content-type':'text/html'};if(q.url.startsWith('/strict'))h['content-security-policy']="script-src 'self'";
    if(q.url.startsWith('/wasm'))h['content-security-policy']="script-src 'self' 'wasm-unsafe-eval'";r.writeHead(200,h);r.end('<!doctype html><title>t</title><p>page');});
  await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
  const port=srv.address().port,ext=fs.mkdtempSync(path.join(os.tmpdir(),'ch061-ext-'));
  for(const f of ['essai.js','sw.js','essai-isole.js'])fs.copyFileSync(path.join(__dirname,'extension-csp',f),path.join(ext,f));
  fs.writeFileSync(path.join(ext,'manifest.json'),JSON.stringify(manifeste));const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch061-'));
  const ctx=await chromium.launchPersistentContext(dir,{executablePath:'/opt/pw-browsers/chromium',headless:true,args:['--disable-extensions-except='+ext,'--load-extension='+ext]});
  let sw=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
  const out={serviceWorker:await sw.evaluate(()=>essai())};
  for(const nom of ['libre','strict','wasm']){const p=await ctx.newPage();await p.goto(`http://127.0.0.1:${port}/${nom}`);await p.waitForTimeout(1500);
    out[nom]=await p.evaluate(()=>({main:document.documentElement.getAttribute('data-wasm-main'),isole:document.documentElement.getAttribute('data-wasm-isole')}));await p.close();}
  await ctx.close();srv.close();return out;
}
(async()=>{const base=JSON.parse(fs.readFileSync(path.join(__dirname,'extension-csp/manifest.json'),'utf8'));
  const res={csp_mv3_par_defaut:await essai(base),
    csp_extension_wasm_unsafe_eval:await essai({...base,content_security_policy:{extension_pages:"script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"}})};
  console.log(JSON.stringify(res,null,1));fs.writeFileSync(path.join(__dirname,'../resultats/banc-csp.json'),JSON.stringify({date:new Date().toISOString(),pages:{libre:'aucune CSP',strict:"script-src 'self'",wasm:"script-src 'self' 'wasm-unsafe-eval'"},...res},null,1));})();
