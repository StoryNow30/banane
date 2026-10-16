'use strict';
/* Cas SYNTHÉTIQUES du calage de convention (P1, plafond). Aucune donnée terrain : un champignon rectangulaire, des
 * points décalés à la main. Sert à deux choses : figer, octet pour octet, ce que `calibrate` rend avec le plafond COUPÉ
 * (référence `tests/corpus/p1-convention-reference.json`, produite avec le module de la base 5.0), et fournir les
 * captures de l'essai du plafond. */
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

/* Champignon rectangulaire : dessus z = 0 de u = 0 à 64 mm, flanc côté voie en u = 0 jusqu'à −40 mm. Points : dessus
 * décalé de −spread à +spread mm (puis de topShiftMm), flanc de −2 à +2 mm (puis de faceShiftMm), autour du gabarit posé
 * au delta [0, sign·10 mm, −5 mm]. `mirror` : profil de signe négatif (le rail de l'autre côté de la voie). */
function capture({topPoints=40,facePoints=11,topSpreadMm=3,topShiftMm=0,faceShiftMm=0,mirror=false}={}){
  const s=mirror?-1:1,contour=[];
  for(let y=0;y<=.064+1e-12;y+=.001)contour.push([0,s*y,0]);
  for(let z=-.001;z>=-.04-1e-12;z-=.001)contour.push([0,0,z]);
  const bu=.01,bz=-.005,points=[];
  for(let i=0;i<topPoints;i++){const u=.015+i*(.035/Math.max(1,topPoints-1));points.push([0,s*(bu+u),bz+(topShiftMm-topSpreadMm+i*(2*topSpreadMm/Math.max(1,topPoints-1)))/1000]);}
  for(let i=0;i<facePoints;i++){const z=-.012-i*(.02/Math.max(1,facePoints-1));points.push([0,s*(bu+(faceShiftMm-2+i*(4/Math.max(1,facePoints-1)))/1000),bz+z]);}
  points.push([0,.15,-.08],[0,-.1,.05]);  // hors des bandes : ignorés
  const rail={positionSceneRelative:[0,0,0],sceneRelativeToProfileLocal:I,profileLocalToSceneRelative:I,profileContours:[{verticesSceneRelative:contour}]};
  return {rails:{left:rail,right:{...rail,positionSceneRelative:[1.44,0,0]}},pointsSceneRelative:points,visibleByClipBoxes:points.map(()=>true)};
}
const raw=mirror=>[0,(mirror?-1:1)*.01,-.005];

/* Le jeu de cas : rails dans le domaine, au bord, hors domaine (vertical, latéral, les deux signes), flanc sous-observé,
 * dessus sous-observé, options explicites. */
const CAS=[];
for(const topSpreadMm of [0,1,3,5,7,9,11,13])for(const topShiftMm of [-10,-6,0,6,10])for(const facePoints of [0,4,11])
  CAS.push({nom:`dessus ±${topSpreadMm} décalé ${topShiftMm}, flanc ${facePoints} pts`,cap:{topSpreadMm,topShiftMm,facePoints}});
for(const faceShiftMm of [-12,-9,-6,-3,0,3,6,9,11,12])for(const mirror of [false,true])
  CAS.push({nom:`flanc décalé ${faceShiftMm}${mirror?' (miroir)':''}`,cap:{faceShiftMm,mirror}});
for(const topPoints of [5,10,14,15,16])CAS.push({nom:`${topPoints} points de dessus`,cap:{topPoints}});
CAS.push({nom:'les deux axes, positifs',cap:{topShiftMm:8,faceShiftMm:12}},{nom:'les deux axes, négatifs (miroir)',cap:{topShiftMm:-11,topSpreadMm:1,faceShiftMm:-9,mirror:true}},
  {nom:'maxShiftMm 4',cap:{topSpreadMm:5},options:{maxShiftMm:4}},{nom:'maxShiftMm 4, flanc',cap:{faceShiftMm:9},options:{maxShiftMm:4}},
  {nom:'bande 6 mm',cap:{topSpreadMm:9},options:{bandMm:6}},{nom:'côté droit',cap:{topSpreadMm:11,topShiftMm:6},side:'right'});

/* Les résultats du module, un cas après l'autre, en JSON : c'est ce qu'on compare octet pour octet. */
function lancer(Convention){
  return CAS.map(c=>{
    const cap=capture(c.cap||{}),mirror=!!(c.cap&&c.cap.mirror);
    return JSON.stringify(Convention.calibrate(cap,c.side||'left',raw(mirror),c.options));
  });
}
module.exports={capture,raw,CAS,lancer};
