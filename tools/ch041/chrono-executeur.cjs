#!/usr/bin/env node
'use strict';
/* CH-041 — TEMPS MURAL de l'exécuteur parallèle dans un Chromium réel, sur des captures RÉELLES d'un corpus (banane-data, jamais copié ici) : l'extension du
 * dépôt est copiée avec la permission `offscreen`, le service worker demande les relances au document hors écran (`rlDemander`, graines choisies par le module),
 * puis fait le même calcul en série sur place. Par capture : ms mural parallèle, ms série, fils, et l'égalité des cellules. Lecture seule.
 *   CHROMIUM=/opt/pw-browsers/chromium node tools/ch041/chrono-executeur.cjs <corpus.json> [N=20] */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const N=require('../../tests/esv-maquette/navigateur.cjs'),RL=require('../../src/recherche-large.js'),S=require('../../src/settings.js');
const {med,q}=require('./cycle-lot.cjs');
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const f=process.argv[2],n=Number(process.argv[3]||20);if(!f)throw Error('usage : chrono-executeur.cjs <corpus.json> [N]');
 const raison=N.indisponible();if(raison)throw Error(raison);
 const doc=JSON.parse(fs.readFileSync(f,'utf8')),clouds=(doc.clouds||[]).filter(c=>c&&c.rails&&Array.isArray(c.pointsSceneRelative)&&c.pointsSceneRelative.length).slice(0,n);
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'ariane-ch041-chrono-'));
 for(const x of ['manifest.json','background.js','panel.html','panel.js','offscreen-recherche-large.html'])fs.copyFileSync(path.join(N.racine,x),path.join(d,x));
 for(const x of fs.readdirSync(N.racine).filter(x=>/\.css$/.test(x)))fs.copyFileSync(path.join(N.racine,x),path.join(d,x));
 for(const r of ['src','vendor','icons','fonts','datasets'])if(fs.existsSync(path.join(N.racine,r)))fs.cpSync(path.join(N.racine,r),path.join(d,r),{recursive:true});
 const m=JSON.parse(fs.readFileSync(path.join(d,'manifest.json'),'utf8'));m.permissions.push('offscreen');fs.writeFileSync(path.join(d,'manifest.json'),JSON.stringify(m));
 const ctx=await N.playwright().chromium.launchPersistentContext('',{executablePath:N.executable(),headless:true,args:['--headless=new',`--disable-extensions-except=${d}`,`--load-extension=${d}`]});
 const R=RL.reglage({...S.lot.rechercheLarge,actif:true});
 try{for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await dormir(250);const sw=ctx.serviceWorkers()[0];if(!sw)throw Error('service worker absent');await dormir(500);
  await sw.evaluate(()=>rlExecuteurPort());await dormir(1500);   // préchauffage : document et fils chargés
  const lignes=[];
  for(const c of clouds){const cap={rails:c.rails,pointsSceneRelative:c.pointsSceneRelative,visibleByClipBoxes:c.visibleByClipBoxes};const {utiles}=RL.grainesChoisies(cap,R);
   const r=await sw.evaluate(async([cap,graines])=>{const t0=performance.now();const x=await rlDemander({type:'calculer',capture:cap,graines,moteur:{partialFlank:BananeGCV1Shadow.state().partialFlank,convention:BananeGCV1Shadow.state().convention}});const t1=performance.now();
    const t2=performance.now();const serie=[];for(const g of graines)serie.push({graine:g,...BananeRechercheLarge.relance(cap,g,null)});const t3=performance.now();
    const cle=r=>JSON.stringify(r.map(x=>[x.graine,x.left.map(c=>[Math.round(c.lat*10),Math.round(c.vert*10)]),x.right.map(c=>[Math.round(c.lat*10),Math.round(c.vert*10)])]));
    return {mural:Math.round(t1-t0),calcul:x.ms,fils:x.fils,filsMs:x.filsMs,serie:Math.round(t3-t2),egal:cle(x.relances.slice().sort((a,b)=>a.graine-b.graine))===cle(serie.sort((a,b)=>a.graine-b.graine))};},[cap,utiles]);
   lignes.push({points:c.pointsSceneRelative.length,graines:utiles.length,...r});process.stderr.write(`  ${lignes.length}/${clouds.length} : ${utiles.length} graines, mural ${r.mural} ms, série ${r.serie} ms, égal ${r.egal}\n`);}
  const col=k=>lignes.map(l=>l[k]);
  console.log(`${lignes.length} captures (points médiane ${med(col('points'))}, graines médiane ${med(col('graines'))}), ${lignes[0].fils} fils : mural parallèle médiane ${Math.round(med(col('mural')))} ms (P90 ${Math.round(q(col('mural'),.9))}), série sur place médiane ${Math.round(med(col('serie')))} ms (P90 ${Math.round(q(col('serie'),.9))}) ; rapport médian ${(med(lignes.map(l=>l.serie/Math.max(1,l.mural)))).toFixed(2)} ; cellules identiques ${lignes.filter(l=>l.egal).length}/${lignes.length}`);
 }finally{await ctx.close();fs.rmSync(d,{recursive:true,force:true});}
}
main().catch(e=>{console.error('chrono-executeur : '+e.message);process.exitCode=1;});
