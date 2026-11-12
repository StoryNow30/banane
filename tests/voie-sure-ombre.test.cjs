'use strict';
/* CH-114 (D-347) — RÈGLE « VOIE DES CUTS SÛRS », EN OMBRE (src/voie-sure-ombre.js). Module pur : il calcule et rend un événement, il ne pose rien.
 * Règle de CH-112 (chantiers/CH-112/rapport.md) : en zone `adv: alerte`, décalage latéral (axe latéral du profil du cut) de chaque rail posé par
 * rapport au même rail du dernier cut SÛR situé au plus 12 cuts en arrière (écart g) ; « aurait différé » si les deux rails vont du même côté et
 * que leur moyenne dépasse 100 + 2·g² mm. Cut sûr = posé plus tôt par CE lot et non arrêté (les cuts « traités hors du lot » sont retirés, CH-114 point 3).
 * Parité : rejoué sur une suite tirée au hasard, le module rend les mêmes verdicts que chantiers/CH-112/outils/regle-voie.cjs (réglage du rapport), cut par cut. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../src/voie-sure-ombre.js'),R=require('../chantiers/CH-112/outils/regle-voie.cjs'),S=require('../src/settings.js');
const LAT=[0,1,0];   // axe latéral du profil : y
const pose=(yG,yD,x=0)=>({gauche:[x,yG,0],droite:[x,yD+1.435,0],lat:LAT});
function jouer(suite,reglage){const mem=V.creerMemoire('lot-a'),out=[];
 for(const s of suite)out.push(V.evaluer(mem,{part:1,cut:s.cut,zoneAdv:s.zone,pose:s.pose},reglage));return out;}

test('réglage livré : allumé en OMBRE, seuil 100 mm, courbure 2 mm par cut², 12 cuts au plus',()=>{
 assert.ok(Object.isFrozen(S.lot.voieSureOmbre));
 const plat=x=>JSON.parse(JSON.stringify(x));
 assert.deepEqual(plat(S.lot.voieSureOmbre),{actif:true,seuilMm:100,courbureMm:2,ecartCuts:12,origine:{actif:true,methode:'profil2',abstenuSur:true,seuilMm:100,courbureMm:0,zones:['alerte','marge-avant','marge-apres']}});
 assert.ok(Object.isFrozen(S.lot.voieSureOmbre.origine));
 assert.deepEqual(plat(V.REGLAGE),{seuilMm:100,courbureMm:2,ecartCuts:12,origine:{actif:true,methode:'profil2',abstenuSur:true,seuilMm:100,courbureMm:0,zones:['alerte','marge-avant','marge-apres']}});
 assert.deepEqual(plat(V.ORIGINE),{actif:true,methode:'profil2',abstenuSur:true,seuilMm:100,courbureMm:0,zones:['alerte','marge-avant','marge-apres']},'réglage d’origine : outil de CH-112 par défaut (profil2, abstenu sûr), seuil fixe, marges');assert.equal(V.VERSION,'voie-sure-ombre-v1');
});
test('les deux rails du même côté au-delà du seuil : aurait différé ; le cut arrêté ne devient pas une référence',()=>{
 const r=jouer([{cut:10,zone:'',pose:pose(0,0)},{cut:11,zone:'alerte',pose:pose(0.150,0.140)},{cut:12,zone:'alerte',pose:pose(0.150,0.140)}]);
 assert.equal(r[0].evenement,null,'hors zone alerte : aucun événement');assert.equal(r[0].sur,true,'posé hors zone : devient sûr');
 const e=r[1].evenement;assert.equal(e.auraitDiffere,true);assert.equal(e.referenceCut,10);assert.equal(e.ecartCuts,1);
 assert.equal(e.decalageGaucheMm,150);assert.equal(e.decalageDroitMm,140);assert.equal(e.seuilMm,102);assert.equal(e.moyenneMm,145);assert.match(e.motif,/^meme-cote:145mm>102mm$/);
 assert.equal(r[1].sur,false,'arrêté : jamais une référence');
 assert.equal(r[2].evenement.referenceCut,10,'la référence reste le dernier cut sûr');assert.equal(r[2].evenement.ecartCuts,2);assert.equal(r[2].evenement.seuilMm,108);
});
test('côtés opposés, ou sous le seuil avec la courbure : passe et devient sûr',()=>{
 const r=jouer([{cut:1,zone:'',pose:pose(0,0)},{cut:2,zone:'alerte',pose:pose(0.150,-0.150)},{cut:9,zone:'alerte',pose:pose(0.300,0)}]);
 assert.equal(r[1].evenement.auraitDiffere,false);assert.equal(r[1].evenement.motif,'cotes-opposes');assert.equal(r[1].sur,true);
 /* cut 9 : référence 2 (sûr), g = 7, seuil 100 + 2·49 = 198 ; décalage +150 et +150 : passe. */
 assert.equal(r[2].evenement.referenceCut,2);assert.equal(r[2].evenement.seuilMm,198);assert.equal(r[2].evenement.auraitDiffere,false);assert.equal(r[2].evenement.motif,'ok');
});
test('sans cut sûr à 12 cuts au plus : abstention, le cut passe sans devenir sûr en zone alerte ; hors zone il le devient',()=>{
 const r=jouer([{cut:1,zone:'',pose:pose(0,0)},{cut:14,zone:'alerte',pose:pose(0,0)},{cut:15,zone:'alerte',pose:pose(0,0)},{cut:16,zone:'marge-apres',pose:pose(0,0)},{cut:17,zone:'alerte',pose:pose(0,0)}]);
 assert.equal(r[1].evenement.motif,'sans-reference');assert.equal(r[1].evenement.auraitDiffere,false);assert.equal(r[1].evenement.referenceCut,null);assert.equal(r[1].sur,false);
 assert.equal(r[2].evenement.motif,'sans-reference','le cut 14, abstenu, n’est pas une référence');
 assert.equal(r[3].evenement.zone,'marge-apres');assert.equal(r[3].evenement.zoneOrigine,'marge-apres','marge : événement par le seul verdict d’origine');
 assert.equal(r[3].evenement.auraitDiffere,false);assert.equal(r[3].sur,true,'marge : devient sûr (le verdict retenu n’arrête pas les marges)');
 assert.equal(jouer([{cut:1,zone:'marge-apres',pose:pose(0,0)}],{origine:{actif:false}})[0].evenement,null,'origine coupée : rien hors zone alerte');
 assert.equal(r[4].evenement.referenceCut,16);
});
test('la mémoire est celle du lot et de la partie : autre lot, mémoire neuve ; autre partie, aucune référence',()=>{
 const mem=V.creerMemoire('lot-a');V.evaluer(mem,{part:1,cut:5,zoneAdv:'',pose:pose(0,0)});
 assert.equal(V.evaluer(mem,{part:2,cut:6,zoneAdv:'alerte',pose:pose(0,0)}).evenement.motif,'sans-reference');
 assert.equal(V.evaluer(mem,{part:1,cut:6,zoneAdv:'alerte',pose:pose(0,0)}).evenement.referenceCut,5);
 assert.equal(mem.lotId,'lot-a');for(let c=100;c<300;c++)V.evaluer(mem,{part:1,cut:c,zoneAdv:'',pose:pose(0,0)});assert.ok(mem.surs.size<=V.MEMOIRE_MAX,'mémoire bornée');
});
test('pose illisible ou panne : un événement « pose-illisible » ou « erreur », jamais une exception ; aucune coordonnée dans l’événement',()=>{
 const mem=V.creerMemoire('l');V.evaluer(mem,{part:1,cut:1,zoneAdv:'',pose:pose(0,0)});
 const a=V.evaluer(mem,{part:1,cut:2,zoneAdv:'alerte',pose:{gauche:[0,0,0],droite:null}});assert.equal(a.evenement.motif,'pose-illisible');assert.equal(a.sur,false);
 const b=V.evaluer(mem,{part:1,cut:3,zoneAdv:'alerte',pose:{...pose(0,0),lat:null}});assert.equal(b.evenement.motif,'sans-axe-lateral');
 const c=V.evaluer(null,{part:1,cut:3,zoneAdv:'alerte',pose:pose(0,0)});assert.match(c.evenement.motif,/^erreur:/);
 const d=V.evaluer(mem,{part:1,cut:4,zoneAdv:'alerte',pose:pose(0.2,0.2)}).evenement;
 assert.deepEqual(Object.keys(d).sort(),['auraitDiffere','auraitDiffereOrigine','decalageDroitMm','decalageGaucheMm','ecartCuts','identity','moyenneMm','motif','referenceCut','referenceCutOrigine','seuilMm','seuilOrigineMm','version','zone','zoneOrigine'].sort());
 assert.ok(!/positionSceneRelative|gauche"|droite"|\[/.test(JSON.stringify(d).replace(/"identity":\{[^}]*\}/,'')),'numéros et millimètres seulement');
});
test('verdict d’origine : seuil 100 fixe, marges arrêtables, SES propres références sûres',()=>{
 const r=jouer([{cut:1,zone:'',pose:pose(0,0)},{cut:8,zone:'alerte',pose:pose(0.150,0.150)},{cut:9,zone:'marge-avant',pose:pose(0.150,0.150)},{cut:10,zone:'alerte',pose:pose(0.150,0.150)}]);
 const [,a,b,c]=r.map(x=>x.evenement);
 /* cut 8 : g = 7 ; retenu : seuil 198, passe ; origine : seuil 100, arrêt. */
 assert.equal(a.auraitDiffere,false);assert.equal(a.seuilMm,198);assert.equal(a.auraitDiffereOrigine,true);assert.equal(a.seuilOrigineMm,100);assert.equal(a.zoneOrigine,'alerte');
 assert.equal(r[1].sur,true);assert.equal(r[1].surOrigine,false,'arrêté par l’origine : pas une référence de l’origine');
 /* cut 9 (marge) : retenu, référence 8 (décalage nul) ; origine, référence 1 (8 arrêté) : arrêt en marge. */
 assert.equal(b.referenceCut,8);assert.equal(b.auraitDiffere,false);assert.equal(b.referenceCutOrigine,1);assert.equal(b.auraitDiffereOrigine,true);assert.equal(b.zoneOrigine,'marge-avant');
 assert.equal(c.referenceCut,9);assert.equal(c.referenceCutOrigine,1);assert.equal(c.auraitDiffereOrigine,true);
});
test('verdict d’origine, profil2 : position extrapolée sur les deux derniers cuts sûrs ; abstenu, le cut devient sûr',()=>{
 /* sûrs 1 (0) et 2 (−80 mm) ; cut 3 en marge à 0 : retenu (une référence, 2) +80 mm, passe ; origine, attendu −160 mm, décalage +160 : arrêt. */
 const r=jouer([{cut:1,zone:'',pose:pose(0,0)},{cut:2,zone:'',pose:pose(-0.080,-0.080)},{cut:3,zone:'marge-apres',pose:pose(0,0)}]);
 assert.equal(r[2].evenement.decalageGaucheMm,80);assert.equal(r[2].evenement.auraitDiffere,false);assert.equal(r[2].evenement.auraitDiffereOrigine,true);assert.equal(r[2].evenement.referenceCutOrigine,2);
 /* abstenuSur : un cut en zone alerte sans référence devient sûr pour l’origine seulement. */
 const a=jouer([{cut:1,zone:'alerte',pose:pose(0,0)},{cut:2,zone:'alerte',pose:pose(0,0)}]);
 assert.equal(a[0].sur,false);assert.equal(a[0].surOrigine,true);
 assert.equal(a[1].evenement.motif,'sans-reference');assert.equal(a[1].evenement.referenceCutOrigine,1);
});
test('PARITÉ avec regle-voie.cjs (réglage du rapport, et réglage d’origine : profil2, abstenu sûr, courbure 0, marges) : mêmes verdicts, mêmes décalages, cut par cut, sur 4 000 cuts tirés au hasard',()=>{
 let graine=7;const alea=()=>(graine=(graine*1103515245+12345)%2147483648)/2147483648;
 for(let essai=0;essai<8;essai++){
  const ordre=[],poses=new Map(),valides=new Set(),zone=new Map(),suite=[];let c=0,voie=0;
  for(let k=0;k<500;k++){c+=1+(alea()<0.15?Math.floor(alea()*14):0);
   if(alea()<0.05)voie=voie?0:0.12+alea()*0.2;   // passage sur une voie voisine
   const z=alea()<0.5?'alerte':alea()<0.3?'marge-apres':'';const bruit=()=>(alea()-0.5)*0.03;
   const p=pose(voie+bruit(),voie+bruit(),c*5);const lat=alea()<0.02?null:LAT;p.lat=lat;
   ordre.push(c);if(alea()<0.9){valides.add(c);poses.set(c,p);}zone.set(c,z);if(valides.has(c))suite.push({cut:c,zone:z,pose:p});}
  const ref=R.rejouer({liste:[],touches:new Set(),ordre,poses,valides,zone},{methode:'profil1',seuil:100,courbure:2,ecart:12,abstenuSur:false,marges:false});
  const org=R.rejouer({liste:[],touches:new Set(),ordre,poses,valides,zone},{methode:'profil2',seuil:100,courbure:0,ecart:12,abstenuSur:true,marges:true,traites:false});
  const mem=V.creerMemoire('p'),mod=suite.map(s=>V.evaluer(mem,{part:1,cut:s.cut,zoneAdv:s.zone,pose:s.pose}));
  assert.equal(mod.length,ref.length);
  for(let i=0;i<ref.length;i++){const o=ref[i],q=org[i],e=mod[i].evenement;
   if(!['alerte','marge-avant','marge-apres'].includes(o.zone)){assert.equal(e,null,'cut '+o.cut);continue;}
   assert.equal(e.auraitDiffereOrigine,q.arret===1,'verdict d’origine, cut '+o.cut);
   assert.equal(e.referenceCutOrigine===null?'':o.cut-e.referenceCutOrigine,q.ref,'référence d’origine, cut '+o.cut);
   if(o.zone!=='alerte'){assert.equal(e.auraitDiffere,false);continue;}
   assert.equal(e.auraitDiffere,o.arret===1,'verdict, cut '+o.cut);
   assert.equal(e.referenceCut===null?'':o.cut-e.referenceCut,o.ref,'référence, cut '+o.cut);
   if(o.latG!==''){assert.equal(e.decalageGaucheMm,o.latG,'gauche, cut '+o.cut);assert.equal(e.decalageDroitMm,o.latD,'droit, cut '+o.cut);}}
 }
});
test('module pur : aucun accès à ESV, au stockage, à l’horloge, à la pose ni au lot',()=>{
 const t=require('node:fs').readFileSync(require.resolve('../src/voie-sure-ombre.js'),'utf8');
 assert.doesNotMatch(t,/chrome\.|fetch\(|Date\.now|new Date|storage|BananeLotDecision|BananeEngine|putEvent|postMessage/);
});
