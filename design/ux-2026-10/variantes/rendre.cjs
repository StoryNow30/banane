// Rend les maquettes en PNG (480 px de large, ×2) avec Chromium (Playwright).
// node design/ux-2026-10/variantes/rendre.cjs   (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers)
const path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('/opt/node22/lib/node_modules/playwright');}
const dir=__dirname;
const pages=[['A-tuiles'],['B-filet'],['C-onglets'],['C-onglets','exports'],['D-tableau']];
(async()=>{
 const b=await pw.chromium.launch();
 const ctx=await b.newContext({viewport:{width:480,height:200},deviceScaleFactor:2});
 const only=process.argv[2];
 for(const [nom,onglet] of pages){
  if(only&&!nom.startsWith(only)&&only!=='planche')continue;
  for(const theme of ['sombre','clair']){
   const p=await ctx.newPage();
   const fs=require('node:fs');if(!fs.existsSync(path.join(dir,nom+'.html'))){await p.close();continue;}
   await p.goto('file://'+path.join(dir,nom+'.html')+'?theme='+theme+(onglet?'&onglet='+onglet:''));
   await p.evaluate(()=>document.fonts.ready);
   const out=`${nom}${onglet?'-'+onglet:''}-${theme}.png`;
   await p.screenshot({path:path.join(dir,out),fullPage:true});
   console.log(out);await p.close();
  }
 }
 if(!only||only==='planche'){
  const p=await ctx.newPage();await p.setViewportSize({width:2650,height:800});
  await p.goto('file://'+path.join(dir,'planche.html'));await p.evaluate(()=>document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({path:path.join(dir,'planche-comparative.png'),fullPage:true});console.log('planche-comparative.png');
 }
 await b.close();
})();
