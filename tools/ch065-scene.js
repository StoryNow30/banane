/* CH-065 : scène Potree factice autour d'un nuage réel, pour faire tourner capture() de vendor/lidar.js hors d'ESV (Node et Chromium).
 * Reprise de la scène du banc de CH-061 (chantiers/CH-061/bancs/banc-lidar.cjs), avec des variantes de forme d'attribut pour couvrir
 * les deux chemins de lecture : Float32 ou Float64, entrelacé, indexé, normalisé, points non finis, drawRange partiel, boîtes de découpe.
 * Les points réels retenus du nuage (fenêtres des deux rails) sont répartis dans les nœuds ; le remplissage (hors fenêtre) complète
 * jusqu'à `total` points. Les accesseurs getX/getY/getZ imitent ceux de Three.js (lecture du tableau, dénormalisation si normalisé). */
(function(root){
 'use strict';
/* Classes d'attribut à la manière de Three.js. Leurs méthodes getX/getY/getZ sont dans la liste blanche du patch lidar-direct (corps
 * canonique de la « maquette », faute de relevé de three.js dans ESV) : NE PAS LES MODIFIER sans régénérer cette liste. Les espions des essais
 * et des bancs passent par le crochet globalThis.CH065_ESPION, jamais en remplaçant ces méthodes.
 * Classes d'attribut à la manière de Three.js. Exportées sous la forme `THREE` (THREE_FACTICE) : un essai ou un banc les pose sur
 * globalThis.THREE pour que vendor/lidar.js patché les reconnaisse par identité de fonction, comme il reconnaîtrait celles de la page. */
 class BA{constructor(a,k,norm){this.array=a;this.itemSize=k;this.count=a.length/k;this.version=0;this.normalized=!!norm;}
  _d(v){if(!this.normalized)return v;const m={Uint8Array:255,Uint16Array:65535,Int16Array:32767}[this.array.constructor.name];return m?Math.max(-1,v/m):v;}
  getX(i){const v=this._d(this.array[i*this.itemSize]),e=globalThis.CH065_ESPION;return e?e(this,i,v):v;}
  getY(i){return this._d(this.array[i*this.itemSize+1]);}
  getZ(i){return this._d(this.array[i*this.itemSize+2]);}}
 class IBA{constructor(data,k,off){this.data=data;this.itemSize=k;this.offset=off;this.count=data.count;this.isInterleavedBufferAttribute=true;this.normalized=false;}
  getX(i){const v=this.data.array[i*this.data.stride+this.offset],e=globalThis.CH065_ESPION;return e?e(this,i,v):v;}
  getY(i){return this.data.array[i*this.data.stride+this.offset+1];}
  getZ(i){return this.data.array[i*this.data.stride+this.offset+2];}}
 const THREE_FACTICE={BufferAttribute:BA,InterleavedBufferAttribute:IBA};
 function scene(c,o={}){
  const total=o.total??c.pointsSceneRelative.length,noeuds=Math.max(1,o.noeuds??19),Type=o.type||Float32Array;
  let s=(o.graine??1234)>>>0;const alea=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
  const reels=c.pointsSceneRelative,parNoeud=Math.ceil(Math.max(total,1)/noeuds),visibleNodes=[];
  for(let k=0;k<noeuds;k++){
   const T=o.sansTranslation?[0,0,0]:[(alea()-.5)*40,(alea()-.5)*40,(alea()-.5)*2];
   const nb=Math.max(0,Math.min(parNoeud,total-k*parNoeud));
   const brut=new Float64Array(nb*3),inten=new Uint16Array(nb),cls=new Uint8Array(nb);
   for(let i=0;i<nb;i++){const g=k*parNoeud+i;let p;
    if(g<reels.length)p=reels[g];else{p=[(alea()-.5)*50,(alea()-.5)*50,(alea()-.5)*6];if(Math.abs(p[0])<2&&Math.abs(p[1])<3)p[0]+=5;}
    brut[3*i]=p[0]-T[0];brut[3*i+1]=p[1]-T[1];brut[3*i+2]=p[2]-T[2];inten[i]=g%4096;cls[i]=g%7;}
   if(o.nonFinis&&nb>3){brut[3*1]=NaN;brut[3*2+1]=Infinity;}
   if(o.enorme&&nb>0){brut[0]=1e300;}
   let position;
   if(o.entrelace){const st=4,arr=new Type(nb*st);for(let i=0;i<nb;i++){arr[i*st]=brut[3*i];arr[i*st+1]=brut[3*i+1];arr[i*st+2]=brut[3*i+2];arr[i*st+3]=1;}
    position=new IBA({array:arr,stride:st,count:nb,version:0},3,0);}
   else if(o.normalise){const arr=new Int16Array(nb*3);for(let i=0;i<3*nb;i++)arr[i]=Math.max(-32767,Math.min(32767,Math.round(brut[i])));position=new BA(arr,3,true);}
   else if(o.sansAccesseur){const arr=Type.from(brut);position={array:arr,itemSize:3,count:nb,version:0,normalized:false};}
   else position=new BA(Type.from(brut),3);
   const geometry={attributes:{position,intensity:new BA(inten,1),classification:new BA(cls,1)},
    drawRange:o.drawRange?{...o.drawRange}:{start:0,count:Infinity},boundingBox:null};
   if(o.indexe){const idx=new Uint32Array(nb);for(let i=0;i<nb;i++)idx[i]=nb-1-i;geometry.index=new BA(idx,1);}
   const obj={visible:true,parent:null,geometry,matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,T[0],T[1],T[2],1]}};
   visibleNodes.push({sceneNode:obj,geometryNode:null});
  }
  const material={clipBoxes:[],clipPolygons:[]};
  if(o.decoupe){material.clipTask=2;material.clipMethod=1;const r=c.rails.left.positionSceneRelative||[0,0,0];
   material.clipBoxes=[{inverse:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,-r[0],-r[1],-r[2],1]}}];}
  const pc={visible:true,parent:null,visibleNodes:o.vide?[]:visibleNodes,material};
  const viewer={scene:{pointclouds:[pc],getActiveCamera:()=>null},renderer:null};
  const echelle=o.echelleProfil||1;
  const rail=r=>{const m=r.profileLocalToSceneRelative.slice();if(echelle!==1)for(const i of [0,1,2,4,5,6,8,9,10])m[i]*=echelle;
   return {object:{},profile:{type:'Group',children:[]},railMatrix:r.railLocalToSceneRelative,profileMatrix:m,rotation:[0,0,0,'XYZ'],profileRotation:[0,0,0,'XYZ']};};
  const enums=o.decoupe?{ClipTask:{NONE:0,HIGHLIGHT:1,SHOW_INSIDE:2,SHOW_OUTSIDE:3},ClipMethod:{INSIDE_ANY:0,INSIDE_ALL:1}}:undefined;
  return {viewer,rails:[rail(c.rails.left),rail(c.rails.right)],origin:[0,0,0],enums};
 }
 /* Variantes couvertes par l'essai et l'outil de parité. */
 const VARIANTES={
  'reel':{},
  'reel-float64':{type:Float64Array},
  'reel-entrelace':{entrelace:true},
  'reel-entrelace-float64':{entrelace:true,type:Float64Array},
  'reel-indexe':{indexe:true},
  'reel-sans-accesseur':{sansAccesseur:true},
  'reel-normalise':{normalise:true},
  'reel-non-finis':{nonFinis:true},
  'reel-decoupe':{decoupe:true},
  'reel-drawrange':{drawRange:{start:3.7,count:1000.5}},
  'reel-plafond-points':{maxPoints:100},
  'reel-plafond-lus':{maxInspected:5000},
  'reel-pause-chaque-7':{yieldEvery:7},
  'reel-transformation-non-finie':{enorme:true,type:Float64Array,echelleProfil:1e-10},
  'vue-vide':{vide:true},
  'un-point':{total:1,noeuds:1},
 };
 const api={scene,VARIANTES,THREE_FACTICE};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.CH065Scene=api;
})(typeof globalThis!=='undefined'?globalThis:this);
