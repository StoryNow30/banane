(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'));
  else root.BananeLevelCrossing=factory(root.BananeCaptureCore);
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 /* PASSAGE À NIVEAU — lire le rail par son ornière (4.7.19, KI-058).
  *
  * Au passage à niveau, la chaussée affleure au niveau du champignon et noie
  * son flanc : le moteur, qui lit le champignon par son dessus et son flanc,
  * s'y trompe ou s'abstient. Ce qui reste lisible, c'est l'ORNIÈRE : une
  * rainure de 4 à 7 cm de large et 4 à 5 cm de profondeur, côté intérieur de
  * chaque rail. La position d'un rail étant sa face intérieure, le bord de
  * l'ornière côté champignon est la position cherchée.
  *
  * `detect` : part des points à côté des rails (9 à 45 cm, ±60 cm le long de la
  * voie) qui sont au niveau du champignon. Voie courante 0–10 %, passage à
  * niveau 90–100 % (banc relu, `audit/passage-niveau-banc-2026-09-25.json`).
  * `read` : pour chaque rail, la rainure large d'au moins `grooveMinMm` la
  * plus proche de la pose d'ESV, sa bordure côté champignon et le niveau du
  * dessus ; positions rendues dans la scène. Rien d'autre n'entre : ni pose
  * humaine, ni écartement (jamais une cible), ni voisin. L'accord avec la voie
  * est vérifié par la décision sur le lot (`src/lot-decision.js`).
  *
  * Calage (25/09, `tools/passage-niveau-scan.cjs`, sessions Natif p24 et p30,
  * relecture Natif p2 7801–7806, relectures des lots 4.7.18 p2 et p3) : la pose
  * humaine validée tombe en médiane 3 mm côté champignon du bord de la rainure
  * et 4 mm au-dessus de la médiane des points du champignon — décalages
  * `lateralOffsetMm` −3 et `verticalOffsetMm` +4. Calés et mesurés sur les
  * mêmes cuts : 80 cuts de passage à niveau lisibles sur les deux rails et
  * jugés, écart latéral médian 3 mm (p90 7 mm), vertical 0,8 mm (p90 2,4 mm) ;
  * un cut au-delà de 10 mm (p3, 1456 : 80 mm sur un rail), dont l'écartement
  * sort du contrat. Lecture impossible sur 41 rails de 270 (rainure absente ou
  * comblée, surface introuvable). */
 const SIDES=['left','right'];
 const DEFAULTS=Object.freeze({flushMinPct:50,sideInM:0.09,sideOutM:0.45,alongM:0.6,flushBelowM:0.05,
   binMm:2,maxGapBins:3,searchMm:180,dropMm:25,grooveMinMm:30,grooveMaxMm:100,headMm:50,lateralOffsetMm:-3,verticalOffsetMm:4});
 const median=v=>{if(!v.length)return null;const s=v.slice().sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
 /* Repère d'un rail : origine à la pose de départ, latéral positif vers l'autre rail. */
 function frameOf(capture,side){
   const r=capture.rails[side],M=r.sceneRelativeToProfileLocal,o=C.point(M,r.positionSceneRelative);
   const other=C.point(M,capture.rails[side==='left'?'right':'left'].positionSceneRelative),toward=Math.sign(other[1]-o[1])||1;
   return {toward,o,M,P:r.profileLocalToSceneRelative,local:p=>{const q=C.point(M,p);return {along:q[0]-o[0],lat:(q[1]-o[1])*toward,z:q[2]-o[2]};}};
 }
 function detect(capture,cfg=DEFAULTS){
   let flush=0,all=0;
   for(const side of SIDES){const f=frameOf(capture,side);
     for(const p of capture.pointsSceneRelative||[]){const {along,lat,z}=f.local(p);
       if(Math.abs(along)>cfg.alongM||Math.abs(lat)<cfg.sideInM||Math.abs(lat)>cfg.sideOutM||z<-0.45||z>0.15)continue;all++;if(z>-cfg.flushBelowM)flush++;}}
   const flushPct=all?Math.round(100*flush/all):null;
   return {flushPct,sidePoints:all,crossing:flushPct!=null&&flushPct>=cfg.flushMinPct};
 }
 /* Profil en travers d'un rail : médiane des hauteurs (mm) par pas de `binMm`. */
 function profile(capture,side,cfg=DEFAULTS){
   const f=frameOf(capture,side),bins=new Map(),lim=cfg.searchMm+cfg.headMm+20;
   for(const p of capture.pointsSceneRelative||[]){const {along,lat,z}=f.local(p);const l=lat*1000,h=z*1000;
     if(Math.abs(along)>0.5||Math.abs(l)>lim||h<-300||h>150)continue;const b=Math.floor(l/cfg.binMm);(bins.get(b)||bins.set(b,[]).get(b)).push(h);}
   return {f,bins};
 }
 /* Les rainures du profil : suites de pas vides ou basses (sous le niveau moins
  * `dropMm`) ; bordure côté champignon = début de la rainure (latéral le plus
  * faible, vers l'extérieur de la voie). */
 function grooves(bins,level,cfg=DEFAULTS){
   const lo=Math.floor(-cfg.searchMm/cfg.binMm),hi=Math.floor(cfg.searchMm/cfg.binMm),out=[];let start=null,gap=0;
   const low=b=>{const m=median(bins.get(b)||[]);return m!=null&&m<level-cfg.dropMm;};
   /* Pas tolérés dans une rainure : vide, ou à mi-profondeur (point isolé du fond). */
   const tolerated=b=>{const m=median(bins.get(b)||[]);return m==null||m<level-cfg.dropMm/2;};
   for(let b=lo;b<=hi+1;b++){
     if(b<=hi&&low(b)){if(start===null)start=b;gap=0;continue;}
     // jusqu'à `maxGapBins` pas vides ou à mi-profondeur n'y mettent pas fin (nuage clairsemé)
     if(start!==null&&b<=hi&&tolerated(b)&&gap<cfg.maxGapBins){gap++;continue;}
     /* Une ornière fait 4 à 7 cm : au-delà de `grooveMaxMm`, ce n'en est pas une
      * (banc du 25/09 : creux de 19 à 20 cm lus à 13 cm du rail). */
     if(start!==null){const end=b-1-gap;const w=(end-start+1)*cfg.binMm;if(w>=cfg.grooveMinMm&&w<=cfg.grooveMaxMm)out.push({edgeMm:start*cfg.binMm,widthMm:w});}
     start=null;gap=0;}
   return out;
 }
 function edgeOf(capture,side,cfg=DEFAULTS){
   const {f,bins}=profile(capture,side,cfg);
   /* Niveau des surfaces HAUTES (champignon, chaussée intérieure) : 75e centile
    * des médianes par pas. La médiane de tous les points descendait sous le
    * champignon quand la chaussée extérieure est plus basse (partie 2, 772
    * droit : champignon −8 mm, chaussée extérieure −19 mm), et la rainure
    * (−40 mm) n'était plus vue. */
   const meds=[...bins.entries()].filter(([b])=>Math.abs(b*cfg.binMm)<=cfg.searchMm).map(([,v])=>median(v)).filter(h=>h>-50&&h<60).sort((a,b)=>a-b);
   const level=meds.length?meds[Math.floor(0.75*(meds.length-1))]:null;if(level==null)return {ok:false,reason:'no-surface'};
   const g=grooves(bins,level,cfg);if(!g.length)return {ok:false,reason:'no-groove',levelMm:Math.round(level)};
   /* La rainure la plus proche de la pose d'ESV ; deux à égale distance : illisible. */
   const d=x=>Math.abs(x.edgeMm);g.sort((a,b)=>d(a)-d(b));
   if(g.length>1&&Math.abs(d(g[0])-d(g[1]))<cfg.grooveMinMm)return {ok:false,reason:'ambiguous-groove',grooves:g.length,levelMm:Math.round(level)};
   const e0=g[0].edgeMm;
   const head=[...bins.entries()].filter(([b])=>b*cfg.binMm>=e0-cfg.headMm&&b*cfg.binMm<e0-2).flatMap(([,v])=>v).filter(h=>h>level-cfg.dropMm);
   const top=median(head)??level;
   /* Bord repris depuis le DESSUS DU CHAMPIGNON (et non le niveau des surfaces,
    * que la chaussée intérieure peut dépasser) : premier pas, en venant du
    * champignon, à `dropMm` sous son dessus, suivi d'un pas au moins à mi-profondeur. */
   const m=b=>median(bins.get(b)||[]),deep=b=>{const v=m(b);return v!=null&&v<top-cfg.dropMm;},half=b=>{const v=m(b);return v==null||v<top-cfg.dropMm/2;};
   let e=e0;for(let b=Math.floor((e0-10)/cfg.binMm);b*cfg.binMm<=e0+g[0].widthMm;b++)if(deep(b)&&half(b+1)){e=b*cfg.binMm;break;}
   return {ok:true,edgeMm:e,widthMm:g[0].widthMm,topMm:Math.round(top*10)/10,levelMm:Math.round(level*10)/10,grooves:g.length};
 }
 /* Positions scène du rail au bord de l'ornière, dessus du champignon décalé de `verticalOffsetMm`. */
 function positionAt(capture,side,latMm,zMm){
   const f=frameOf(capture,side),q=[f.o[0],f.o[1]+f.toward*latMm/1000,f.o[2]+zMm/1000];
   return C.point(f.P,q);
 }
 function read(capture,cfg=DEFAULTS){
   const d=detect(capture,cfg),edges={};
   for(const side of SIDES)edges[side]=edgeOf(capture,side,cfg);
   const ok=SIDES.every(side=>edges[side].ok);
   return {...d,edges,ok,reason:ok?null:SIDES.filter(s=>!edges[s].ok).map(s=>s+':'+edges[s].reason).join(' '),
     positions:ok?Object.fromEntries(SIDES.map(side=>[side,positionAt(capture,side,edges[side].edgeMm+cfg.lateralOffsetMm,edges[side].topMm+cfg.verticalOffsetMm)])):null};
 }
 return {DEFAULTS,detect,edgeOf,read,positionAt,frameOf};
});
