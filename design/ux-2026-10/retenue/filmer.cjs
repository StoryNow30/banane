// Filme la démonstration de orbite.html image par image (30 i/s, 480×880 ×2)
// puis assemble la vidéo avec ffmpeg ; rend aussi les PNG fixes.
// node design/ux-2026-10/retenue/filmer.cjs [dossier-images]
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
let pw;try{pw=require('playwright');}catch{pw=require('/opt/node22/lib/node_modules/playwright');}
const dir=__dirname,tmp=process.argv[2]||fs.mkdtempSync('/tmp/orbite-');
(async()=>{
 const b=await pw.chromium.launch();
 const ctx=await b.newContext({viewport:{width:480,height:880},deviceScaleFactor:2});
 for(const theme of ['sombre','clair']){
  const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto(`file://${path.join(dir,'orbite.html')}?theme=${theme}`);await p.evaluate(()=>document.fonts.ready);
  await p.screenshot({path:path.join(dir,`orbite-${theme}.png`),fullPage:true});console.log(`orbite-${theme}.png`);
  if(theme==='sombre'||process.env.FILM_CLAIR){
   await p.evaluate(()=>document.body.classList.remove('libre'));
   const d=await p.evaluate(()=>window.DUREE),fps=30,n=Math.round(d/1000*fps);
   const out=path.join(tmp,theme);fs.mkdirSync(out,{recursive:true});
   for(let i=0;i<n;i++){await p.evaluate(t=>window.seek(t),i*1000/fps);
    await p.screenshot({path:path.join(out,`f${String(i).padStart(4,'0')}.png`)});}
   execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(out,'f%04d.png'),
    '-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','slow','-movflags','+faststart',path.join(dir,`orbite-motion-${theme}.mp4`)]);
   console.log(`orbite-motion-${theme}.mp4 (${n} images)`);
  }
  await p.close();
 }
 await b.close();
})();
