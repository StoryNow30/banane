/* CH-061, poste « lecture du LiDAR » : capture() de vendor/lidar.js (chemin du lot) sur une scène Potree factice dans Chromium.
 * Scène : les points réels retenus d'un nuage du 05/11 (fenêtres des deux rails), noyés dans des points de remplissage hors
 * fenêtre, pour atteindre les volumes mesurés au terrain : ~500 000 points visibles par vue, 19 nœuds Float32 (journal du 05/11).
 * Trois variantes : vendor/lidar.js d'origine ; boucle par point en JS sans allocation ; boucle en Rust/WASM (copie du tampon comprise).
 * Les sorties de capture() sont comparées champ par champ (hors horodatages). Résultat : resultats/banc-lidar.json. */
'use strict';
const fs=require('fs'),path=require('path');
const {RACINE}=require('./charger-sw.cjs'),{nuages}=require('./nuages.cjs'),{navigateur,page}=require('./chromium.cjs'),V=require('./lidar-variante.js');
const WASM=path.join(__dirname,'../rust/target/wasm32-unknown-unknown/release/ariane_noyau.wasm');
const PTS=Number(process.env.POINTS||505000),NOEUDS=19,NUAGES=Number(process.env.NUAGES||8),REP=Number(process.env.REP||5);
function scene(){/* exécuté dans la page */}
const SCENE=`globalThis.CH061Scene=function(c,total,noeuds,graine){
  let s=graine>>>0;const alea=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
  class BA{constructor(a,k){this.array=a;this.itemSize=k;this.count=a.length/k;this.version=0;this.normalized=false;}
    getX(i){return this.array[i*this.itemSize];}getY(i){return this.array[i*this.itemSize+1];}getZ(i){return this.array[i*this.itemSize+2];}}
  const reels=c.pointsSceneRelative,parNoeud=Math.ceil(total/noeuds),visibleNodes=[];
  for(let k=0;k<noeuds;k++){const T=[(alea()-.5)*40,(alea()-.5)*40,(alea()-.5)*2];
    const pos=new Float32Array(parNoeud*3),inten=new Uint16Array(parNoeud),cls=new Uint8Array(parNoeud);
    for(let i=0;i<parNoeud;i++){const g=k*parNoeud+i;let p;
      if(g<reels.length)p=reels[g];else{p=[(alea()-.5)*50,(alea()-.5)*50,(alea()-.5)*6];if(Math.abs(p[0])<2&&Math.abs(p[1])<3)p[0]+=5;}
      pos[3*i]=p[0]-T[0];pos[3*i+1]=p[1]-T[1];pos[3*i+2]=p[2]-T[2];inten[i]=g%4096;cls[i]=g%7;}
    const obj={visible:true,parent:null,geometry:{attributes:{position:new BA(pos,3),intensity:new BA(inten,1),classification:new BA(cls,1)},drawRange:{start:0,count:Infinity},boundingBox:null},
      matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,T[0],T[1],T[2],1]}};
    visibleNodes.push({sceneNode:obj,geometryNode:null});}
  const pc={visible:true,parent:null,visibleNodes,material:{clipBoxes:[],clipPolygons:[]}};
  const viewer={scene:{pointclouds:[pc],getActiveCamera:()=>null},renderer:null};
  const rail=r=>({object:{},profile:{type:'Group',children:[]},railMatrix:r.railLocalToSceneRelative,profileMatrix:r.profileLocalToSceneRelative,
    rotation:[0,0,0,'XYZ'],profileRotation:[0,0,0,'XYZ']});
  return {viewer,rails:[rail(c.rails.left),rail(c.rails.right)],origin:[0,0,0]};
};`;
(async()=>{
  const C=nuages(400).filter((c,i)=>i%50===0).slice(0,NUAGES);
  const nav=await navigateur();const lidarTxt=fs.readFileSync(path.join(RACINE,'vendor/lidar.js'),'utf8');
  const scripts=[fs.readFileSync(path.join(RACINE,'vendor/capture-core.js'),'utf8'),
    lidarTxt.replace('root.BananeLidar=api','root.BananeLidar=api;root.LidarOrigine=api'),
    fs.readFileSync(path.join(__dirname,'lidar-variante.js'),'utf8'),SCENE];
  const p=await page(nav,scripts);
  await p.evaluate(({t,b})=>{const s=CH061Lidar.variante(t).replace('root.BananeLidar=api','root.LidarNoyau=api');(0,eval)(s);
    return WebAssembly.instantiate(new Uint8Array(b)).then(({instance})=>{globalThis.__W=CH061Lidar.scanWasm(instance);globalThis.__J=CH061Lidar.scanJs();});},
    {t:lidarTxt,b:[...fs.readFileSync(WASM)]});
  const out={date:new Date().toISOString(),pointsParVue:PTS,noeuds:NOEUDS,nuages:C.length,repetitions:REP,variantes:{},parite:[]};
  const q=(a,x)=>{a=[...a].sort((u,v)=>u-v);return +a[Math.floor(x*(a.length-1))].toFixed(2);};
  const mes={origine:[],'js-reecrit':[],wasm:[],copieWasm:[]};
  for(const [ci,c] of C.entries()){
    await p.evaluate(t=>{globalThis.__C=JSON.parse(t);},JSON.stringify({rails:c.rails,pointsSceneRelative:c.pointsSceneRelative}));
    const r=await p.evaluate(async ({PTS,NOEUDS,REP,ci,PAUSE})=>{
      const sc=CH061Scene(__C,PTS,NOEUDS,1234+ci),pause=PAUSE==='timeout'?(()=>new Promise(r=>setTimeout(r,0))):()=>scheduler.yield();
      const run=async (L,noyau)=>{globalThis.__CH061_SCAN=noyau;const t=performance.now();const o=await L.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard:()=>{},pause,meta:{captureId:'banc'}});return {ms:performance.now()-t,o};};
      const net=o=>JSON.stringify(o,(k,v)=>k==='capturedAt'||k==='durationMs'?undefined:v);
      const res={origine:[],'js-reecrit':[],wasm:[],copieWasm:[]};let ref=null,egal={};
      for(let k=0;k<REP;k++)for(const [nom,L,noyau] of [['origine',LidarOrigine,null],['js-reecrit',LidarNoyau,__J],['wasm',LidarNoyau,__W]]){
        if(nom==='wasm'){__W.copieMs=0;}
        const {ms,o}=await run(L,noyau);res[nom].push(ms);if(nom==='wasm')res.copieWasm.push(__W.copieMs);
        if(k===0){const s=net(o);if(nom==='origine'){ref=s;egal.retenus=o.quality.retained;egal.lus=o.quality.inspected;egal.statut=o.status;}else egal[nom]=s===ref;}}
      return {res,egal};},{PTS,NOEUDS,REP,ci,PAUSE:process.env.PAUSE||'yield'});
    for(const k of Object.keys(mes))mes[k].push(...r.res[k].slice(1));out.parite.push(r.egal);console.log(ci,JSON.stringify(r.egal),Object.entries(r.res).map(([k,v])=>k+' '+q(v.slice(1),.5)).join(' | '));
  }
  for(const k of Object.keys(mes))out.variantes[k]={msParVue:{mediane:q(mes[k],.5),p90:q(mes[k],.9),min:q(mes[k],0)}};
  /* Mémoire : tas JS d'une scène de 505 000 points (tampons Potree factices) et d'une capture rendue. */
  out.memoire=await p.evaluate(async ({PTS,NOEUDS})=>{gc();const a=performance.memory.usedJSHeapSize;const sc=CH061Scene(__C,PTS,NOEUDS,7);gc();const b=performance.memory.usedJSHeapSize;
    const o=await LidarOrigine.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard:()=>{},pause:()=>scheduler.yield(),meta:{}});gc();const c=performance.memory.usedJSHeapSize;
    const octetsMessage=JSON.stringify(o).length;globalThis.__garde=[sc,o];
    return {sceneOctets:b-a,captureTasOctets:c-b,captureJsonOctets:octetsMessage,pointsRetenus:o.quality.retained};},{PTS,NOEUDS});
  console.log(JSON.stringify(out.variantes),JSON.stringify(out.memoire));
  await nav.close();fs.mkdirSync(path.join(__dirname,'../resultats'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'../resultats/banc-lidar'+(process.env.PAUSE==='timeout'?'-pause-timeout':'')+'.json'),JSON.stringify(out,null,1));
})();
