/* CH-061 : ouvre une page Chromium vierge et y charge des scripts (texte), pour mesurer dans le vrai V8 du navigateur. */
'use strict';
const {chromium}=require('playwright');
const EXEC=process.env.CHROMIUM||'/opt/pw-browsers/chromium';
async function navigateur(){return chromium.launch({executablePath:require('fs').existsSync(EXEC)?EXEC:undefined,args:['--js-flags=--expose-gc','--enable-precise-memory-info']});}
async function page(nav,scripts){
  const p=await nav.newPage();await p.goto('about:blank');
  for(const s of scripts)await p.addScriptTag({content:s});
  const cdp=await p.context().newCDPSession(p);await cdp.send('HeapProfiler.enable');await cdp.send('Performance.enable');
  p.tas=async()=>{await p.evaluate(()=>globalThis.gc&&gc());const m=await cdp.send('Runtime.getHeapUsage');return m.usedSize;};
  p.cdp=cdp;return p;
}
module.exports={navigateur,page};
