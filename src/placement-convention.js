(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'));
  else root.BananePlacementConvention=factory(root.BananeCaptureCore);
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 /* CALAGE DE CONVENTION — cahier 4.8, amendement n°4.
  *
  * Ce que l'audit du 22/09 a mesuré (185 rails jugés, 7 sessions, parties 13,
  * 18, 19 et 20) : GCV1 place le gabarit AU MILIEU de la bande de points LiDAR,
  * l'opérateur pose le contour EN ENVELOPPE de cette bande — le dessus au-dessus
  * des points, le flanc côté voie. D'où un biais systématique : moteur plus bas
  * de 2,8 mm, flanc 2,1 mm côté champ sur chaque rail, écartement plus large de
  * 4,5 mm en médiane. Ce n'est pas une erreur de la géométrie gelée : c'est une
  * convention différente, et la référence du projet est la validation humaine.
  *
  * Le calage est le plus petit apprentissage qui corrige cette classe d'erreur,
  * rail par rail, à partir du seul nuage : après le placement publié par GCV1,
  *   dessus : au 90e centile des points du dessus, + TOP_OFFSET ;
  *   flanc  : à la médiane des points du flanc, + FACE_OFFSET ;
  *            sous 6 points de flanc, AUCUNE correction latérale : un décalage
  *            constant n'y gagnait rien (2,14 → 2,17 mm sur 38 rails) et
  *            poussait un rail au-delà de 10 mm.
  * Deux constantes, ajustées sur les validations humaines par
  * `tools/convention-fit.cjs`, validées en retenant chaque session à tour de
  * rôle : latéral médian 2,39 → 1,40 mm, vertical 2,83 → 1,13 mm, écartement
  * 4,67 → 2,34 mm.
  *
  * Ce module ne choisit aucun candidat, ne connaît pas l'autre rail et ne vise
  * aucun écartement : il déplace un rail déjà publié de quelques millimètres
  * selon ses propres points. La garde d'écartement s'applique APRÈS lui. Aucune
  * référence humaine n’entre ici ; seules les deux constantes en dérivent.
  *
  * Repère : celui de `geometry-candidate-v1.js` — u latéral orienté vers le
  * champignon (u = 0 au flanc côté voie), z vertical. Le delta publié vaut
  * [0, sign·u, z]. Mètres en interne, millimètres dans les diagnostics. */
 const DEFAULTS=Object.freeze({version:'convention-envelope-v1',
   topQuantile:.9,faceQuantile:.5,
   topOffsetMm:1.0,faceOffsetMm:-2.6,faceFallbackMm:0,
   minTopPoints:15,minFacePoints:6,bandMm:12,maxShiftMm:8});
 const STEP=.0005;

 function quantile(values,p){
   if(!values.length)return NaN;const v=values.slice().sort((a,b)=>a-b);
   return v[Math.min(v.length-1,Math.floor(p*v.length))];
 }
 /* Le contour du champignon dans le repère profil, tel que GCV1 le lit. */
 function template(rail){
   const contour=rail?.profileContours?.reduce((a,b)=>(b.verticesSceneRelative?.length||0)>(a?.verticesSceneRelative?.length||0)?b:a,null);
   if(!contour)return null;
   const shape=contour.verticesSceneRelative.map(p=>C.point(rail.sceneRelativeToProfileLocal,p));
   const ys=shape.map(p=>p[1]).sort((a,b)=>a-b),sign=Math.sign(ys[ys.length>>1]);
   if(!sign)return null;
   const head=shape.map(p=>[sign*p[1],p[2]]).filter(p=>p[1]>-.04);
   if(head.length<6)return null;
   const width=Math.max(...head.filter(p=>p[1]>-.012).map(p=>p[0]));
   if(!(width>.025&&width<.12))return null;
   /* Dessus du gabarit en fonction de u, flanc côté voie en fonction de z :
    * mêmes voisinages de ±4 mm que les ancres de GCV1, échantillonnés au
    * demi-millimètre pour que le coût ne dépende pas du nombre de points. */
   const tops=[],faces=[];
   for(let u=0;u<=width+1e-9;u+=STEP){const near=head.filter(p=>Math.abs(p[0]-u)<.004);tops.push(near.length?Math.max(...near.map(p=>p[1])):null);}
   for(let z=0;z>=-.04-1e-9;z-=STEP){const near=head.filter(p=>Math.abs(p[1]-z)<.004);faces.push(near.length?Math.min(...near.map(p=>p[0])):null);}
   return {sign,width,topAt:u=>u<0||u>width?null:tops[Math.round(u/STEP)]??null,faceAt:z=>z>0||z<-.04?null:faces[Math.round(-z/STEP)]??null};
 }
 /* Écarts des points au gabarit posé au delta publié : verticaux sur le dessus,
  * latéraux sur le flanc. Ce sont les seules entrées du calage. */
 function bandOffsets(capture,side,delta,options={}){
   const cfg={...DEFAULTS,...options},rail=capture?.rails?.[side],t=template(rail);
   if(!t)return {ok:false,reason:'template-unavailable'};
   if(!Array.isArray(delta)||delta.length!==3||!delta.every(Number.isFinite))return {ok:false,reason:'delta-invalid'};
   const bu=t.sign*delta[1],bz=delta[2],band=cfg.bandMm/1000,top=[],face=[];
   const points=capture.pointsSceneRelative||[];
   for(let i=0;i<points.length;i++){
     if(capture.visibleByClipBoxes?.[i]===false)continue;
     const src=points[i];if(!Array.isArray(src)||!src.every(Number.isFinite))continue;
     const q=C.point(rail.sceneRelativeToProfileLocal,src);
     if(!(Math.abs(q[0])<=.5&&Math.abs(q[1])<.18&&Math.abs(q[2])<.10))continue;
     const lu=t.sign*q[1]-bu,lz=q[2]-bz;
     if(lu>.012&&lu<t.width-.012&&Math.abs(lz)<band){const z=t.topAt(lu);if(z!==null&&Math.abs(lz-z)<band)top.push((lz-z)*1000);}
     if(lz<-.009&&lz>-.034&&Math.abs(lu)<band){const u=t.faceAt(lz);if(u!==null&&Math.abs(lu-u)<band)face.push((lu-u)*1000);}
   }
   return {ok:true,sign:t.sign,top,face};
 }
 /* Plafond du décalage (P1) : `options.plafond` l'impose ; à défaut, le réglage
  * `conventionPlafond` de `settings.js` (global `BananeSettings`, chargé avant ce
  * module dans le service worker). Trois valeurs : `false` (défaut), `'vertical'`
  * (P1 bis : seul le décalage vertical est plafonné) et `true` (les deux axes).
  * Toute autre valeur vaut `false`. Coupé par défaut : sans réglage, le
  * comportement est celui de la 5.0 de base, octet pour octet. */
 function plafondMode(cfg){
   const v=cfg.plafond!==undefined&&cfg.plafond!==null?cfg.plafond:(typeof globalThis!=='undefined'?globalThis.BananeSettings?.conventionPlafond:undefined);
   return v===true?true:v==='vertical'?'vertical':false;
 }
 /* Le calage d'un rail publié. Rend le delta calé et tout ce qui l'explique ;
  * ne publie rien de plus que ce que GCV1 a publié, et s'efface (applied:false)
  * quand il ne peut pas se justifier. */
 function calibrate(capture,side,delta,options={}){
   const cfg={...DEFAULTS,...options},offsets=bandOffsets(capture,side,delta,cfg);
   const base={version:cfg.version,applied:false,rawDelta:Array.isArray(delta)?delta.slice():null,delta:Array.isArray(delta)?delta.slice():null};
   if(!offsets.ok)return {...base,reason:offsets.reason};
   const topN=offsets.top.length,faceN=offsets.face.length;
   if(topN<cfg.minTopPoints)return {...base,reason:'top-under-observed',topN,faceN};
   const topQ=quantile(offsets.top,cfg.topQuantile),faceQ=faceN?quantile(offsets.face,cfg.faceQuantile):null;
   const faceMode=faceN>=cfg.minFacePoints?'median':'under-observed';
   const dzMm=topQ+cfg.topOffsetMm,duMm=faceMode==='median'?faceQ+cfg.faceOffsetMm:cfg.faceFallbackMm;
   if(!Number.isFinite(dzMm)||!Number.isFinite(duMm))return {...base,reason:'offset-not-finite',topN,faceN};
   /* Garde-fou de domaine : l'ajustement a été mesuré entre −8,6 et +6,6 mm.
    * Au-delà, le rail n'est pas dans le domaine où le calage a été établi. */
   if(Math.abs(dzMm)>cfg.maxShiftMm||Math.abs(duMm)>cfg.maxShiftMm){
     const mode=plafondMode(cfg);
     /* P1 bis : en mode 'vertical', un décalage latéral hors domaine garde le rail refusé (posé brut), même si dz serait plafonné. */
     if(!mode||(mode==='vertical'&&Math.abs(duMm)>cfg.maxShiftMm))return {...base,reason:'shift-out-of-domain',topN,faceN,duMm,dzMm};
     /* PLAFOND (plan 5.0, P1, D-129) — réglage `conventionPlafond`, coupé par défaut.
      * Au lieu de refuser le rail, on applique le décalage mesuré limité à
      * `maxShiftMm` par axe (par l'axe vertical seul en mode 'vertical'), dans son signe ; le reste est consigné. Mesuré hors
      * ligne (partie 17) : le rail refusé est posé brut avec un biais vertical
      * de −6,5 mm, parce que la convention exagère d'un tiers au-delà de 6 mm ;
      * le plafond le ramène à +1,5 mm.
      * `reason` reste 'shift-out-of-domain' même appliqué : la garde de paire
      * (D-044, `lot-decision.js`) lit ce motif pour savoir que le rail est hors
      * du domaine mesuré, et elle ne change pas. `duMm` et `dzMm` restent les
      * décalages mesurés en entier (comme pour un rail refusé) ; `applied*` est
      * ce qui a été posé, `rest*` ce qui ne l'a pas été. */
     /* Mode 'vertical' : arrivé ici, du est dans le domaine, donc appliqué en entier (cap(du)=du) ; seul dz est plafonné, et `capAxes` le dit. */
     const cap=m=>Math.sign(m)*Math.min(Math.abs(m),cfg.maxShiftMm),appliedDuMm=cap(duMm),appliedDzMm=cap(dzMm);
     return {...base,applied:true,delta:[delta[0],delta[1]+offsets.sign*appliedDuMm/1000,delta[2]+appliedDzMm/1000],
       reason:'shift-out-of-domain',capped:true,capMm:cfg.maxShiftMm,...(mode==='vertical'?{capAxes:'vertical'}:{}),duMm,dzMm,appliedDuMm,appliedDzMm,restDuMm:duMm-appliedDuMm,restDzMm:dzMm-appliedDzMm,
       topN,faceN,faceMode,topQuantileMm:topQ,faceQuantileMm:faceQ};
   }
   const corrected=[delta[0],delta[1]+offsets.sign*duMm/1000,delta[2]+dzMm/1000];
   return {...base,applied:true,delta:corrected,duMm,dzMm,topN,faceN,faceMode,topQuantileMm:topQ,faceQuantileMm:faceQ};
 }
 return {DEFAULTS,quantile,template,bandOffsets,calibrate};
});
