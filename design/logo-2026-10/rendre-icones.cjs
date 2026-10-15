// Produit les icônes de l'extension (icons/ariane-16|32|48|128.png) depuis icons/ariane.svg.
// Rendu par Chromium à la taille exacte, fond transparent. node design/logo-2026-10/rendre-icones.cjs
const fs=require('node:fs'),path=require('node:path');let pw;try{pw=require('playwright');}catch{pw=require('/opt/node22/lib/node_modules/playwright');}
const root=path.resolve(__dirname,'../..'),svg=fs.readFileSync(path.join(root,'icons/ariane.svg'),'utf8');
(async()=>{const b=await pw.chromium.launch();
 for(const s of [16,32,48,128]){const p=await b.newPage({viewport:{width:s,height:s},deviceScaleFactor:1});
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="64" height="64"/,`width="${s}" height="${s}"`)}</body></html>`);
  await p.screenshot({path:path.join(root,`icons/ariane-${s}.png`),omitBackground:true,clip:{x:0,y:0,width:s,height:s}});console.log(`icons/ariane-${s}.png`);await p.close();}
 await b.close();})();
