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
 const REGLAGE=Object.freeze({seuilMm:100,courbureMm:2,ecartCuts:12});
 const MEMOIRE_MAX=64;
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const point=p=>Array.isArray(p)&&p.length>=3&&fini(p[0])&&fini(p[1])&&fini(p[2]);
 const r1=v=>Math.round(v*10)/10;
 /* Mémoire du lot : partie|cut -> pose sûre { gauche, droite } (mètres, scène). */
 function creerMemoire(lotId=null){return {lotId,surs:new Map()};}
 function retenir(mem,part,cut,pose){const k=part+'|'+cut;mem.surs.delete(k);mem.surs.set(k,{gauche:pose.gauche.slice(0,3),droite:pose.droite.slice(0,3)});
  while(mem.surs.size>MEMOIRE_MAX)mem.surs.delete(mem.surs.keys().next().value);}
 /* Décalage (mm) de chaque rail posé par rapport au même rail de la référence, projeté sur l'axe latéral du profil du cut (`lat`, unitaire). */
 function decalage(pose,ref){const out={};
  for(const k of ['gauche','droite']){const d=[0,1,2].map(j=>pose[k][j]-ref[k][j]);out[k]=(d[0]*pose.lat[0]+d[1]*pose.lat[1]+d[2]*pose.lat[2])*1000;}
  return out;}
 /* `pose` : { gauche:[x,y,z], droite:[x,y,z], lat:[x,y,z] } (mètres, scène ; `lat` = colonne y de `profileLocalToSceneRelative` du rail gauche).
  * Rend { evenement (null hors zone alerte), sur (le cut devient une référence) }. */
 function evaluer(mem,{part=null,cut=null,zoneAdv='',pose=null}={},reglage={}){
  const o={...REGLAGE,...reglage},enZone=zoneAdv==='alerte';
  const ev=(champs)=>enZone?{version:VERSION,identity:{part,cut},zone:'alerte',auraitDiffere:false,decalageGaucheMm:null,decalageDroitMm:null,moyenneMm:null,
   ecartCuts:null,seuilMm:null,referenceCut:null,motif:'ok',...champs}:null;
  try{
   if(!mem||!(mem.surs instanceof Map)||!Number.isInteger(cut))throw Error('mémoire ou cut absent');
   if(!pose||!point(pose.gauche)||!point(pose.droite))return {evenement:ev({motif:'pose-illisible'}),sur:false};
   let ref=null;
   for(let k=cut-1;k>=cut-o.ecartCuts;k--)if(mem.surs.has(part+'|'+k)){ref=k;break;}
   let arret=false,abstenu=true,champs={motif:'sans-reference'};
   if(ref!==null){
    const g=cut-ref;champs={referenceCut:ref,ecartCuts:g,seuilMm:o.seuilMm+o.courbureMm*g*g,motif:'sans-axe-lateral'};
    if(point(pose.lat)){
     const dl=decalage(pose,mem.surs.get(part+'|'+ref));abstenu=false;
     const meme=Math.sign(dl.gauche)===Math.sign(dl.droite),moy=r1((dl.gauche+dl.droite)/2);
     arret=enZone&&meme&&Math.abs(moy)>champs.seuilMm;
     champs={...champs,decalageGaucheMm:r1(dl.gauche),decalageDroitMm:r1(dl.droite),moyenneMm:moy,auraitDiffere:arret,
      motif:arret?`meme-cote:${moy}mm>${champs.seuilMm}mm`:meme?'ok':'cotes-opposes'};
    }
   }
   const sur=!arret&&(!abstenu||!enZone);
   if(sur)retenir(mem,part,cut,pose);
   return {evenement:ev(champs),sur};
  }catch(e){return {evenement:ev({motif:'erreur:'+String(e?.message||e).slice(0,60)}),sur:false};}
 }
 return {VERSION,REGLAGE,MEMOIRE_MAX,creerMemoire,decalage,evaluer};
});
