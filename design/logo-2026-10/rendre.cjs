// Rend la planche des logos (logos.html) en PNG ×2. node design/logo-2026-10/rendre.cjs
const path=require('node:path');let pw;try{pw=require('playwright');}catch{pw=require('/opt/node22/lib/node_modules/playwright');}
(async()=>{const b=await pw.chromium.launch(),p=await b.newPage({viewport:{width:1780,height:400},deviceScaleFactor:2});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+path.join(__dirname,'logos.html'));await p.evaluate(()=>document.fonts.ready);
 await p.screenshot({path:path.join(__dirname,'planche-logos.png'),fullPage:true});console.log('planche-logos.png');await b.close();})();
