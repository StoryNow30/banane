'use strict';
/* CH-041 — le DOCUMENT HORS ÉCRAN de la recherche large dans un Chromium réel : l'extension du dépôt est copiée avec la permission `offscreen` (le patch proposé à
 * l'intégrateur, chantiers/CH-041/propositions/manifest-offscreen.patch), le service worker ouvre le document (`rlDemander`), qui répartit les graines sur ses
 * Worker (moteur gelé chargé par importScripts) et rend les relances ; on vérifie qu'elles sont celles du module calculées sur place (données synthétiques,
 * tests/helpers/gcv2-jeu-fixture.cjs), et le temps mural du calcul parallèle contre le calcul en série. Sans la permission : `chrome.offscreen` absent.
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=300000 tests/esv-maquette/recherche-large-executeur.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const N=require('./navigateur.cjs'),F=require('../helpers/gcv2-jeu-fixture.cjs'),RL=require('../../src/recherche-large.js');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
function extension({offscreen}){
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'ariane-ch041-'));
 for(const f of ['manifest.json','background.js','panel.html','panel.js','offscreen-recherche-large.html'])fs.copyFileSync(path.join(N.racine,f),path.join(d,f));
 for(const f of fs.readdirSync(N.racine).filter(f=>/\.css$/.test(f)))fs.copyFileSync(path.join(N.racine,f),path.join(d,f));
 for(const r of ['src','vendor','icons','fonts','datasets'])if(fs.existsSync(path.join(N.racine,r)))fs.cpSync(path.join(N.racine,r),path.join(d,r),{recursive:true});
 const m=JSON.parse(fs.readFileSync(path.join(d,'manifest.json'),'utf8'));
 assert.ok(!m.permissions.includes('offscreen'),'le manifeste du dépôt n\'a pas la permission : elle est proposée par patch');
 if(offscreen)m.permissions.push('offscreen');
 fs.writeFileSync(path.join(d,'manifest.json'),JSON.stringify(m,null,2));
 return d;
}
async function avecExtension(offscreen,fn){
 const ext=extension({offscreen});
 const ctx=await N.playwright().chromium.launchPersistentContext('',{executablePath:N.executable(),headless:true,viewport:{width:1200,height:800},args:['--headless=new',`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
 try{for(let i=0;i<80&&!ctx.serviceWorkers().length;i++)await dormir(250);
  const sw=ctx.serviceWorkers()[0];assert.ok(sw,'service worker de l\'extension');await dormir(500);
  return await fn(sw);}
 finally{await ctx.close();fs.rmSync(ext,{recursive:true,force:true});}
}
/* Capture synthétique avec un leurre complet à 150 mm (celle de tests/recherche-large.test.cjs), et les graines que le module choisit. */
function jeu(){const cap=F.capture({graine:7,leurre:false}),rnd=F.alea(8),pts=[];
 const copie=(y,sign,bu,bz)=>{for(let i=0;i<40;i++)pts.push([0,y+sign*(bu+0.015+i*0.035/39),bz+(rnd()-0.5)*0.0008]);for(let i=0;i<11;i++)pts.push([0,y+sign*(bu+(rnd()-0.5)*0.0008),bz-0.012-i*0.002]);};
 copie(-0.15,1,0.012,-0.004);copie(1.45-0.15,-1,0.010,-0.003);cap.pointsSceneRelative=cap.pointsSceneRelative.concat(pts);cap.visibleByClipBoxes=cap.pointsSceneRelative.map(()=>true);
 const R=RL.reglage({actif:true}),{utiles}=RL.grainesChoisies(cap,R);return {cap:{rails:cap.rails,pointsSceneRelative:cap.pointsSceneRelative,visibleByClipBoxes:cap.visibleByClipBoxes},R,utiles};}
const arrondir=c=>({lat:Math.round(c.lat*10)/10,vert:Math.round(c.vert*10)/10,loss:Number(c.loss.toPrecision(6)),top:c.top,face:c.face});

test('document hors écran réel : les relances reviennent, identiques à celles du module, et le temps mural est mesuré',opts,async()=>{
 const {cap,R,utiles}=jeu();assert.ok(utiles.length>=2);
 const attendu=Object.fromEntries(utiles.map(g=>{const r=RL.relance(cap,g,null);return [g,{left:r.left.map(arrondir),right:r.right.map(arrondir)}];}));
 const r=await avecExtension(true,sw=>sw.evaluate(async([cap,graines])=>{
  const t0=performance.now();const x=await rlDemander({type:'calculer',capture:cap,graines,moteur:{partialFlank:BananeGCV1Shadow.state().partialFlank,convention:BananeGCV1Shadow.state().convention}});
  const t1=performance.now();
  /* Le même calcul sur place, en série, dans le service worker. */
  const t2=performance.now();for(const g of graines)BananeRechercheLarge.relance(cap,g,null);const t3=performance.now();
  return {relances:x.relances,ms:x.ms,fils:x.fils,filsMs:x.filsMs,muralMs:Math.round(t1-t0),serieMs:Math.round(t3-t2),offscreen:typeof chrome.offscreen};},[cap,utiles]));
 assert.equal(r.offscreen,'object');assert.ok(r.fils>=1);assert.equal(r.relances.length,utiles.length,'une relance par graine');
 for(const x of r.relances){assert.deepEqual({left:x.left.map(arrondir),right:x.right.map(arrondir)},attendu[x.graine],'graine '+x.graine+' : mêmes cellules que le module');}
 console.log(`# document hors écran : ${r.fils} fils, calcul ${r.ms} ms (par fil ${JSON.stringify(r.filsMs)}), aller-retour ${r.muralMs} ms ; même calcul en série dans le service worker ${r.serieMs} ms`);
});
test('sans la permission offscreen : chrome.offscreen absent, l\'exécuteur se tait (repli sur place)',opts,async()=>{
 const r=await avecExtension(false,sw=>sw.evaluate(()=>({offscreen:typeof chrome.offscreen,disponible:rlExecuteurDisponible(BananeRechercheLarge.reglage({actif:true}))})));
 assert.equal(r.offscreen,'undefined');assert.equal(r.disponible,false);
});
