(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeVoieSureOmbre=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* CH-114 (D-347) — RÈGLE « VOIE DES CUTS SÛRS », EN OMBRE. Module pur : ni ESV, ni stockage, ni horloge, ni journal. Il CALCULE et rend un
  * événement ; il ne pose rien, ne diffère rien, ne change aucune décision. Règle de CH-112 (chantiers/CH-112/rapport.md, outil de référence
  * chantiers/CH-112/outils/regle-voie.cjs, réglage du rapport : `profil1`, seuil 100, courbure 2, écart 12, marges non arrêtées) :
  *  - références SÛRES : les cuts posés plus tôt par CE lot, dans la même partie, et non arrêtés par la règle. Jamais une ligne de la liste d'ESV
  *    (en zone d'aiguillage, ESV suit souvent l'autre voie) ; les « cuts traités par l'opérateur hors du lot » de CH-112 sont retirés (CH-114,
  *    point 3 : aucune référence sur les 14 parties rejouées ; en direct, le drapeau d'ESV porte aussi les validations d'Ariane) ;
  *  - pour un cut posé en zone `adv: alerte` : décalage, dans l'axe latéral du profil du cut, de chaque rail posé par rapport au même rail du
  *    dernier cut sûr situé au plus `ecartCuts` cuts en arrière (écart g) ;
  *  - « aurait différé » si les deux rails vont du même côté et que leur moyenne (au dixième de mm) dépasse `seuilMm + courbureMm·g²` ;
  *  - sans référence : le cut passe ; en zone alerte il ne devient pas sûr (abstention). Un cut posé hors zone alerte devient sûr.
  * L'événement ne porte que des numéros de cut et des millimètres. Le seuil est PROVISOIRE (PROBABLE, CH-112) : seule la séance Écho fera examen. */
 const VERSION='voie-sure-ombre-v1';
 /* Réglage d'origine de CH-112, consigné en second verdict depuis l'examen de la partie 23 du 12/11 (D-347, ombre seulement) : l'outil regle-voie.cjs avec
  * ses valeurs par défaut, `profil2` (position attendue extrapolée sur les deux derniers cuts sûrs), `abstenuSur` (un cut sans décalage mesurable
  * devient sûr), seuil 100 fixe, zones `alerte` et marges. */
 const ORIGINE=Object.freeze({actif:true,methode:'profil2',abstenuSur:true,seuilMm:100,courbureMm:0,zones:Object.freeze(['alerte','marge-avant','marge-apres'])});
 const REGLAGE=Object.freeze({seuilMm:100,courbureMm:2,ecartCuts:12,origine:ORIGINE});
 const MEMOIRE_MAX=64;
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const point=p=>Array.isArray(p)&&p.length>=3&&fini(p[0])&&fini(p[1])&&fini(p[2]);
 const r1=v=>Math.round(v*10)/10;
 /* Mémoire du lot : partie|cut -> pose sûre { gauche, droite } (mètres, scène) ; une par verdict (`surs`, `sursOrigine`). */
 function creerMemoire(lotId=null){return {lotId,surs:new Map(),sursOrigine:new Map()};}
 function retenir(surs,part,cut,pose){const k=part+'|'+cut;surs.delete(k);surs.set(k,{gauche:pose.gauche.slice(0,3),droite:pose.droite.slice(0,3)});
  while(surs.size>MEMOIRE_MAX)surs.delete(surs.keys().next().value);}
 /* Décalage (mm) de chaque rail posé par rapport au même rail de la référence, projeté sur l'axe latéral du profil du cut (`lat`, unitaire). */
 function decalage(pose,ref){const out={};
  for(const k of ['gauche','droite']){const d=[0,1,2].map(j=>pose[k][j]-ref[k][j]);out[k]=(d[0]*pose.lat[0]+d[1]*pose.lat[1]+d[2]*pose.lat[2])*1000;}
  return out;}
 /* `profil2` : avec deux références r1 (la plus proche) et r2, la position attendue au cut est extrapolée en ligne droite (comme regle-voie.cjs). */
 function attendue(cut,r1,p1,r2,p2){const f=(cut-r1)/(r1-r2),out={};
  for(const k of ['gauche','droite'])out[k]=[0,1,2].map(j=>p1[k][j]+(p1[k][j]-p2[k][j])*f);
  return out;}
 /* Un verdict, avec SA mémoire de cuts sûrs (`surs`) : zones arrêtables `zones`, seuil `seuilMm + courbureMm·g²`, au plus `ecartCuts` cuts en arrière.
  * Abstention : comme regle-voie.cjs, un cut sans décalage mesurable ne devient pas sûr s'il est en zone `alerte` (marges : il le devient). */
 function juger(surs,{part,cut,zoneAdv,pose},o){
  const enZone=o.zones.includes(zoneAdv);
  let ref=null,ref2=null;
  for(let k=cut-1;k>=cut-o.ecartCuts;k--)if(surs.has(part+'|'+k)){if(ref===null)ref=k;else{ref2=k;break;}}
  let arret=false,abstenu=true,champs={motif:'sans-reference'};
  if(ref!==null){
   const g=cut-ref;champs={referenceCut:ref,ecartCuts:g,seuilMm:o.seuilMm+o.courbureMm*g*g,motif:'sans-axe-lateral'};
   if(point(pose.lat)){
    const p1=surs.get(part+'|'+ref),dl=decalage(pose,o.methode==='profil2'&&ref2!==null?attendue(cut,ref,p1,ref2,surs.get(part+'|'+ref2)):p1);abstenu=false;
    const meme=Math.sign(dl.gauche)===Math.sign(dl.droite),moy=r1((dl.gauche+dl.droite)/2);
    arret=enZone&&meme&&Math.abs(moy)>champs.seuilMm;
    champs={...champs,decalageGaucheMm:r1(dl.gauche),decalageDroitMm:r1(dl.droite),moyenneMm:moy,auraitDiffere:arret,
     motif:arret?`meme-cote:${moy}mm>${champs.seuilMm}mm`:!enZone?'hors-zone':meme?'ok':'cotes-opposes'};
   }
  }
  const sur=!arret&&(o.abstenuSur===true||!abstenu||zoneAdv!=='alerte');
  if(sur)retenir(surs,part,cut,pose);
  return {enZone,arret,champs,sur};
 }
 /* `pose` : { gauche:[x,y,z], droite:[x,y,z], lat:[x,y,z] } (mètres, scène ; `lat` = colonne y de `profileLocalToSceneRelative` du rail gauche).
  * Deux verdicts, chacun avec ses propres références sûres : le réglage RETENU (CH-112 : zone `alerte`, 100 + 2·g²) et, si `origine`, le réglage
  * D'ORIGINE (`ORIGINE` : profil2, abstenu sûr, seuil 100 fixe, zones `alerte`, `marge-avant`, `marge-apres` ; examen de la partie 23 du 12/11). Rend { evenement (null si le cut n'est
  * dans aucune zone suivie), sur, surOrigine }. Les champs du verdict retenu sont ceux de la v1 ; le second ajoute `auraitDiffereOrigine`,
  * `seuilOrigineMm`, `zoneOrigine`, `referenceCutOrigine`. */
 function evaluer(mem,{part=null,cut=null,zoneAdv='',pose=null}={},reglage={}){
  const o={...REGLAGE,...reglage},origine=o.origine===true||o.origine?.actif===true,org0={...ORIGINE,...(o.origine&&typeof o.origine==='object'?o.origine:{})},z=typeof zoneAdv==='string'?zoneAdv:'';
  const enZone=z==='alerte',enZoneOrigine=origine&&org0.zones.includes(z);
  const ev=(champs,org)=>enZone||enZoneOrigine?{version:VERSION,identity:{part,cut},zone:z,auraitDiffere:false,decalageGaucheMm:null,decalageDroitMm:null,moyenneMm:null,
   ecartCuts:null,seuilMm:null,referenceCut:null,motif:'ok',...champs,
   ...(origine?{auraitDiffereOrigine:false,seuilOrigineMm:null,zoneOrigine:enZoneOrigine?z:null,referenceCutOrigine:null,...org}:{})}:null;
  try{
   if(!mem||!(mem.surs instanceof Map)||!Number.isInteger(cut))throw Error('mémoire ou cut absent');
   if(origine&&!(mem.sursOrigine instanceof Map))mem.sursOrigine=new Map();
   if(!pose||!point(pose.gauche)||!point(pose.droite))return {evenement:ev({motif:'pose-illisible'},{}),sur:false,surOrigine:false};
   const a=juger(mem.surs,{part,cut,zoneAdv:z,pose},{zones:['alerte'],methode:'profil1',abstenuSur:false,seuilMm:o.seuilMm,courbureMm:o.courbureMm,ecartCuts:o.ecartCuts});
   let b=null;
   if(origine)b=juger(mem.sursOrigine,{part,cut,zoneAdv:z,pose},{...org0,ecartCuts:o.ecartCuts});
   const champs=a.champs;
   const org=b?{auraitDiffereOrigine:b.arret,seuilOrigineMm:b.champs.seuilMm??null,referenceCutOrigine:b.champs.referenceCut??null}:{};
   return {evenement:ev(champs,org),sur:a.sur,surOrigine:b?b.sur:false};
  }catch(e){return {evenement:ev({motif:'erreur:'+String(e?.message||e).slice(0,60)},{}),sur:false,surOrigine:false};}
 }
 return {VERSION,REGLAGE,ORIGINE,MEMOIRE_MAX,creerMemoire,decalage,evaluer};
});
