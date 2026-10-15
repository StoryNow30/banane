const pw=(()=>{try{return require('playwright')}catch{return require('/opt/node22/lib/node_modules/playwright')}})();
(async()=>{const b=await pw.chromium.launch(),p=await b.newPage({viewport:{width:1740,height:400},deviceScaleFactor:2});p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+require('path').join(__dirname,'comparer.html'));await p.evaluate(()=>document.fonts.ready);
await p.screenshot({path:require('path').join(__dirname,'comparer-A-B.png'),fullPage:true});await b.close();})();
