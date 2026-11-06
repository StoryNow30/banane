#!/usr/bin/env node
/* CH-065 : banc dans un vrai Chromium (CHROMIUM, défaut /opt/pw-browsers/chromium), avant et après les deux patchs.
 *  LIDAR : capture() de vendor/lidar.js d'origine et patché, sur une scène Potree factice de 505 000 points en 19 nœuds Float32
 *          (tools/ch065-scene.js) autour de nuages réels de banane-data ; pauses du mode rapide (scheduler.yield) et du mode
 *          référence (setTimeout 0). Les deux versions alternent, REP répétitions par nuage ; la première passe (à froid) est écartée.
 *          Tas JS : octets alloués pendant une capture (usedJSHeapSize juste après, sans ramasse-miettes) et retenus (après gc()).
 *  GÉOMÉTRIE : la vraie chaîne du service worker (scripts de background.js) chargée telle quelle, d'origine ou patchée ; façade
 *          BananeGeometry3.proposeBoth (façade du SW), moteur V4.6 gelé seul (BananeGeometryFrozen) et composition du lot
 *          (BananeGCV1Shadow.scientificProposeBoth : V4.6 + A_STAR, convention, écartement) ; REP passes.
 * Les sorties des deux versions sont comparées dans le navigateur (JSON, hors horodatages) : un écart arrête le banc.
 * Usage : REP=15 NUAGES_LIDAR=8 NUAGES_GEO=200 node --max-old-space-size=6000 tools/ch065-banc.cjs SORTIE.json
 * Machine au repos : rien d'autre ne doit tourner. Aucune coordonnée n'est écrite dans la sortie. */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {chromium}=require('playwright');
const RACINE=path.resolve(__dirname,'..'),A=require(path.join(RACINE,'chantiers/CH-065/appliquer.cjs')),{nuages}=require('./ch065-nuages.cjs');
const REP=Number(process.env.REP||15),NL=Number(process.env.NUAGES_LIDAR||8),NG=Number(process.env.NUAGES_GEO||200),SORTIE=process.argv[2];
const EXEC=process.env.CHROMIUM||'/opt/pw-browsers/chromium';
const q=(a,x)=>{a=[...a].sort((u,v)=>u-v);return a.length?+a[Math.floor(x*(a.length-1))].toFixed(2):null;};
const resume=a=>({mediane:q(a,.5),p90:q(a,.9),min:q(a,0),n:a.length});
const lire=f=>fs.readFileSync(path.join(RACINE,f),'utf8');
function scriptsSW(sens){
  const bg=lire('background.js'),m=bg.match(/importScripts\(([\s\S]*?)\);/);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]).map(f=>A.BLOCS[f]?A.versions(RACINE,f)[sens]:lire(f));
}
async function page(nav,scripts){
  const p=await nav.newPage();await p.goto('about:blank');
  for(const s of scripts){try{await p.addScriptTag({content:s});}catch(e){/* module du SW qui exige chrome.* : sans effet sur la géométrie */}}
  return p;
}
(async()=>{
  const tous=nuages(Infinity).filter(c=>c.pointsSceneRelative.length>0&&c.rails?.left?.profileLocalToSceneRelative);
  const pas=k=>Math.max(1,Math.floor(tous.length/k));
  const CL=tous.filter((c,i)=>i%pas(NL)===0).slice(0,NL),CG=tous.filter((c,i)=>i%pas(NG)===0).slice(0,NG);
  const nav=await chromium.launch({executablePath:fs.existsSync(EXEC)?EXEC:undefined,args:['--js-flags=--expose-gc','--enable-precise-memory-info']});
  const out={date:new Date().toISOString(),chromium:nav.version(),cpu:os.cpus()[0].model,coeurs:os.cpus().length,repetitions:REP,
    nuagesReels:tous.length,lidar:{nuages:CL.length,pointsParVue:505000,noeuds:19},geometrie:{nuages:CG.length}};
  /* ---------- LIDAR ---------- */
  const v=A.versions(RACINE,'vendor/lidar.js');
  const pl=await page(nav,[lire('vendor/capture-core.js'),v.origine.replace('root.BananeLidar=api','root.LidarOrigine=api'),
    v.patche.replace('root.BananeLidar=api','root.LidarPatche=api'),lire('tools/ch065-scene.js')]);
  for(const mode of ['rapide','reference']){
    const mes={origine:[],patche:[],allocOrigine:[],allocPatche:[],retenuOrigine:[],retenuPatche:[]};let egal=0;
    for(const [ci,c] of CL.entries()){
      await pl.evaluate(t=>{globalThis.__C=JSON.parse(t);},JSON.stringify({rails:c.rails,pointsSceneRelative:c.pointsSceneRelative}));
      const r=await pl.evaluate(async ({REP,ci,mode})=>{
        const sc=CH065Scene.scene(__C,{total:505000,noeuds:19,graine:1234+ci});
        const pause=mode==='reference'?()=>new Promise(r=>setTimeout(r,0)):()=>scheduler.yield();
        const net=o=>JSON.stringify(o,(k,v)=>k==='capturedAt'||k==='durationMs'?undefined:v);
        const res={origine:[],patche:[],allocOrigine:[],allocPatche:[],retenuOrigine:[],retenuPatche:[]};let ref=null,egal=true;
        for(let k=0;k<=REP;k++)for(const [nom,L] of (k%2?[['patche',LidarPatche],['origine',LidarOrigine]]:[['origine',LidarOrigine],['patche',LidarPatche]])){
          gc();const h0=performance.memory.usedJSHeapSize,t=performance.now();
          const o=await L.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard(){},pause,meta:{captureId:'banc'}});
          const ms=performance.now()-t,h1=performance.memory.usedJSHeapSize;
          if(k===0){const s=net(o);if(ref===null)ref=s;else egal=egal&&s===ref;}
          gc();const h2=performance.memory.usedJSHeapSize;
          if(k>0){res[nom].push(ms);res['alloc'+(nom==='origine'?'Origine':'Patche')].push(h1-h0);res['retenu'+(nom==='origine'?'Origine':'Patche')].push(h2-h0);}
        }
        return {res,egal};},{REP,ci,mode});
      if(!r.egal)throw Error('LiDAR : sorties différentes, nuage '+ci);egal++;
      for(const k of Object.keys(mes))mes[k].push(...r.res[k]);
      console.error('lidar',mode,ci,'origine',q(r.res.origine,.5),'patché',q(r.res.patche,.5));
    }
    const o=resume(mes.origine),p=resume(mes.patche);
    out.lidar[mode]={msParVue:{origine:o,patche:p},gainMsParVue:+(o.mediane-p.mediane).toFixed(1),
      tasAlloueOctetsParVue:{origine:q(mes.allocOrigine,.5),patche:q(mes.allocPatche,.5)},tasRetenuOctets:{origine:q(mes.retenuOrigine,.5),patche:q(mes.retenuPatche,.5)},sortiesIdentiques:egal};
  }
  await pl.close();
  /* ---------- GÉOMÉTRIE ---------- */
  const pages={origine:await page(nav,scriptsSW('origine')),patche:await page(nav,scriptsSW('patche'))};
  for(const p of Object.values(pages)){await p.evaluate(()=>{globalThis.__N=[];});
    for(let i=0;i<CG.length;i+=10)await p.evaluate(t=>{__N.push(...JSON.parse(t));},JSON.stringify(CG.slice(i,i+10).map(c=>({captureId:c.captureId,identity:c.identity,rails:c.rails,
      pointsSceneRelative:c.pointsSceneRelative,visibleByClipBoxes:c.visibleByClipBoxes,camera:c.camera,viewCaptures:c.viewCaptures}))));}
  const geo={};const sorties={};
  for(let k=0;k<=REP;k++)for(const nom of (k%2?['patche','origine']:['origine','patche'])){
    const r=await pages[nom].evaluate(k=>{const F=globalThis.BananeGeometry3,V=globalThis.BananeGeometryFrozen,S=globalThis.BananeGCV1Shadow,tf=[],tv=[],ts=[];let s='';
      gc();const h0=performance.memory.usedJSHeapSize;
      for(const c of __N){let a=performance.now();const o=F.proposeBoth(c);tf.push(performance.now()-a);a=performance.now();const w=V.proposeBoth(c);tv.push(performance.now()-a);
        a=performance.now();const x=S.scientificProposeBoth(c);ts.push(performance.now()-a);
        if(k===0)s+=JSON.stringify([o,w,x],(kk,vv)=>/At$|Ms$|^at$|observedAt/.test(kk)?undefined:vv);}
      const h1=performance.memory.usedJSHeapSize;return {tf,tv,ts,s,alloc:h1-h0};},k);
    if(k===0){sorties[nom]=r.s;continue;}
    const g=geo[nom]=geo[nom]||{facade:[],v46:[],lot:[],alloc:[]};g.facade.push(...r.tf);g.v46.push(...r.tv);g.lot.push(...r.ts);g.alloc.push(r.alloc/CG.length);
    console.error('géométrie',k,nom,'façade',q(r.tf,.5),'v46',q(r.tv,.5));
  }
  if(sorties.origine!==sorties.patche)throw Error('Géométrie : sorties différentes dans Chromium');
  out.geometrie.sortiesIdentiques=true;
  for(const nom of ['origine','patche'])out.geometrie[nom]={facadeMsParNuage:resume(geo[nom].facade),v46MsParNuage:resume(geo[nom].v46),lotMsParNuage:resume(geo[nom].lot),tasAlloueOctetsParNuage:q(geo[nom].alloc,.5)};
  out.geometrie.gainMsParNuage={facade:+(out.geometrie.origine.facadeMsParNuage.mediane-out.geometrie.patche.facadeMsParNuage.mediane).toFixed(1),
    v46:+(out.geometrie.origine.v46MsParNuage.mediane-out.geometrie.patche.v46MsParNuage.mediane).toFixed(1),
    lot:+(out.geometrie.origine.lotMsParNuage.mediane-out.geometrie.patche.lotMsParNuage.mediane).toFixed(1)};
  await nav.close();
  console.log(JSON.stringify(out,null,1));if(SORTIE)fs.writeFileSync(SORTIE,JSON.stringify(out,null,1)+'\n');
})().catch(e=>{console.error(e);process.exit(1);});
