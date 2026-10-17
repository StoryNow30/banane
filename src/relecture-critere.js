(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeRelectureCritere=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* 5.0 (D-170, D-171, D-173) — RÈGLE PRUDENTE DE CORRECTION DE LA RELECTURE (fiches/RELECTURE_OMBRE.md § 4).
  *
  * Fonction PURE : elle dit si un cut relu peut être corrigé en mode « corriger ». Elle ne commande rien et ne lit rien d'ESV : tout
  * lui est passé. Un seul « oui » possible, quand TOUTES les conditions tiennent ; sinon « non » avec la première raison qui manque.
  *   1. le cut a une pose calculée et un écart par rail (jugement de src/relecture-ombre.js) ;
  *   2. aucun SKIP en ombre (D-172 : un cut sans point n'est pas corrigé) ;
  *   3. son rôle est permis (`roles` : les verts seulement) et n'est pas dans `jamais` (cut différé, cut posé par le lot) ;
  *   4. l'étage de la décision est permis (`etagesPermis` : par défaut « first-pass », la pose du moteur confirmée par la voie des
  *      appuis, et « window », la reprise depuis la voie ; le fichier proposé ajoute « choice » et « crossing ») et la décision
  *      s'appuie sur `appuisMin` appuis au moins (défaut provisoire : 2 ; fichier sans ce champ : aucun minimum, comme l'étude) ;
  *   5. la zone (pn, adv, abords, vert-hors-zone) permet la correction (`zones[z].corriger`) ;
  *   6. l'écart le plus grand (latéral ou vertical, des deux rails) atteint le seuil de la zone (`seuilMm`) ;
  *   7. la confiance du moteur (A*), sur les deux rails, atteint le minimum de la zone (`confianceMin`) ; absente : refus (comme
  *      l'étude : « confiance présente » quand le minimum est 0) ;
  *   8. JAMAIS DE CHANGEMENT DE VOIE : l'écart latéral de chaque rail reste sous `voie.lateralMaxMm` (une autre voie est à 1,5 m et
  *      plus ; les poses sur la mauvaise voie mesurées allaient de 163 à 280 mm, D-159) ;
  *   9. LES DEUX RAILS COHÉRENTS : leurs écarts latéraux ne diffèrent pas de plus de `coherence.diffLateraleMaxMm`, leurs écarts
  *      verticaux de plus de `coherence.diffVerticaleMaxMm` (la correction déplace la voie, elle ne la tord pas), et l'écartement de la
  *      pose reste à `coherence.ecartementMaxMm` de la médiane de la partie (référence passée par l'appelant ; sans référence, refus).
  * `ecrit` (facultatif) : l'écart de la pose qui serait ÉCRITE (commande du lot), à la place de celui du jugement ; les conditions 6,
  * 8 et 9 sont jugées sur lui.
  *
  * SEUILS : `datasets/relecture-reglages-proposes.json` (chantier claude/50-zones-autonomes) s'il existe et se lit, sinon
  * `datasets/relecture-reglages-defaut.json` (PROVISOIRE, très prudent), recopié ici dans DEFAUT (un essai vérifie qu'ils sont égaux).
  * `reglages(fichier)` valide un fichier et complète ce qui manque par le défaut ; un fichier illisible rend le défaut. */
 const SIDES=['left','right'],ZONES=['pn','adv','abords','vert-hors-zone'],ETAGES=['first-pass','window','choice','crossing'],VARIANTES=['chaine+h','chaine','seul+h','seul'];
 const DEFAUT=Object.freeze({format:'ariane-relecture-reglages-1',statut:'provisoire',
  etagesPermis:Object.freeze(['first-pass','window']),appuisMin:2,roles:Object.freeze(['vert']),
  jamais:Object.freeze(['cut différé par le lot','cut posé par le lot']),variante:Object.freeze({proposition:'chaine+h'}),
  voie:Object.freeze({lateralMaxMm:60}),
  coherence:Object.freeze({diffLateraleMaxMm:6,diffVerticaleMaxMm:6,ecartementMaxMm:8}),
  zones:Object.freeze({
   pn:Object.freeze({corriger:true,seuilMm:15,confianceMin:85}),
   adv:Object.freeze({corriger:false,seuilMm:25,confianceMin:95}),
   abords:Object.freeze({corriger:true,seuilMm:12,confianceMin:80}),
   'vert-hors-zone':Object.freeze({corriger:true,seuilMm:15,confianceMin:90})})});
 const nombre=(v,min=0,max=1e6)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const virgule=v=>String(Math.round(v*10)/10).replace('.',',');

 /* Réglages lus d'un fichier : chaque valeur invalide ou absente prend celle du défaut. `source` : d'où ils viennent. */
 function reglages(fichier,source='defaut'){
  const f=fichier&&typeof fichier==='object'&&!Array.isArray(fichier)?fichier:null;
  if(!f||f.format!==DEFAUT.format)return {...reglages(DEFAUT,'defaut'),refus:f?'format':null};
  const liste=(v,d,ok)=>Array.isArray(v)&&v.length&&v.every(ok)?v.slice():d.slice();
  const zones={};
  for(const z of ZONES){const d=DEFAUT.zones[z],x=f.zones?.[z]||{};
   zones[z]={corriger:typeof x.corriger==='boolean'?x.corriger:d.corriger,seuilMm:nombre(x.seuilMm,1,500)?x.seuilMm:d.seuilMm,
    confianceMin:nombre(x.confianceMin,0,100)?x.confianceMin:d.confianceMin};}
  const c=f.coherence||{},v=f.voie||{};
  const variante=typeof f.variante==='string'?f.variante:f.variante?.proposition;
  return {format:DEFAUT.format,statut:typeof f.statut==='string'?f.statut.slice(0,40):'inconnu',source,
   /* Les quatre étapes qui posent sont acceptées (le fichier proposé les donne toutes) ; une étape inconnue rend le défaut. */
   etagesPermis:liste(f.etagesPermis,DEFAUT.etagesPermis,e=>ETAGES.includes(e)),
   /* Minimum d'appuis : celui du fichier ; absent, aucun (l'étude n'en a pas : la chaîne d'appuis tient lieu de voie). */
   appuisMin:Number.isInteger(f.appuisMin)&&f.appuisMin>=0&&f.appuisMin<=40?f.appuisMin:0,
   variante:VARIANTES.includes(variante)?variante:DEFAUT.variante.proposition,
   jamais:Array.isArray(f.jamais)?f.jamais.filter(x=>typeof x==='string').slice(0,8):DEFAUT.jamais.slice(),
   selection:f.selection&&typeof f.selection==='object'&&!Array.isArray(f.selection)?f.selection:null,
   roles:liste(f.roles,DEFAUT.roles,r=>['vert','differe'].includes(r)),
   voie:{lateralMaxMm:nombre(v.lateralMaxMm,1,500)?Math.min(v.lateralMaxMm,500):DEFAUT.voie.lateralMaxMm},
   coherence:{diffLateraleMaxMm:nombre(c.diffLateraleMaxMm,0,100)?c.diffLateraleMaxMm:DEFAUT.coherence.diffLateraleMaxMm,
    diffVerticaleMaxMm:nombre(c.diffVerticaleMaxMm,0,100)?c.diffVerticaleMaxMm:DEFAUT.coherence.diffVerticaleMaxMm,
    ecartementMaxMm:nombre(c.ecartementMaxMm,0,100)?c.ecartementMaxMm:DEFAUT.coherence.ecartementMaxMm},
   zones};}

 /* Le jugement de la règle. Entrée : {jugement, zone, role, skipOmbre, ecrit, ecartementMm, ecartementRefMm}. */
 function juger(entree,R=DEFAUT){
  const e=entree&&typeof entree==='object'?entree:{},j=e.jugement,non=(regle,raison)=>({corriger:false,regle,raison});
  if(!j||!j.poseCalculee||!j.ecartMm)return non('pose','aucune pose calculée');
  if(e.skipOmbre?.raison)return non('skip',`cut à SKIP en ombre (${e.skipOmbre.raison})`);
  const roles=Array.isArray(R.roles)?R.roles:DEFAUT.roles,jamais=Array.isArray(R.jamais)?R.jamais:DEFAUT.jamais;
  if(e.role==='differe'&&jamais.includes('cut différé par le lot'))return non('role','jamais un cut différé par le lot');
  if(e.role==='lot'&&jamais.includes('cut posé par le lot'))return non('role','jamais un cut posé par le lot');
  if(!roles.includes(e.role))return non('role',`rôle « ${e.role??'?'} » non permis (${roles.join(', ')})`);
  const etages=Array.isArray(R.etagesPermis)?R.etagesPermis:DEFAUT.etagesPermis;
  if(!etages.includes(j.etage))return non('etage',`étage « ${j.etage??'?'} » non permis (${etages.join(', ')})`);
  const appuisMin=Number.isInteger(R.appuisMin)?R.appuisMin:DEFAUT.appuisMin,nAppuis=Array.isArray(j.appuis)?j.appuis.length:0;
  if(nAppuis<appuisMin)return non('appuis',`${nAppuis} appui${nAppuis>1?'s':''} du lot, ${appuisMin} au moins`);
  /* H5 (audit P-5) : un vert entré pour son seul écartement, hors de toute plage, reste en ombre, quels que soient les réglages. */
  if(e.zone==='ecartement')return non('zone','vert hors plage entré pour son écartement : ombre seulement');
  const Z=R.zones?.[e.zone];
  if(!Z)return non('zone',`zone « ${e.zone??'?'} » inconnue`);
  if(Z.corriger!==true)return non('zone',`zone ${e.zone} : correction coupée`);
  const ec=e.ecrit&&SIDES.every(s=>e.ecrit[s])?e.ecrit:j.ecartMm;
  if(!SIDES.every(s=>['lat','vert'].every(a=>Number.isFinite(ec[s]?.[a]))))return non('pose','écart par rail illisible');
  const pire=Math.max(...SIDES.flatMap(s=>[Math.abs(ec[s].lat),Math.abs(ec[s].vert)]));
  if(!(pire>=Z.seuilMm))return non('seuil',`écart ${virgule(pire)} mm sous le seuil de la zone ${e.zone} (${virgule(Z.seuilMm)} mm)`);
  const conf=j.confiance;
  for(const s of SIDES){const c=conf?.[s];
   if(!Number.isFinite(c))return non('confiance',`confiance du rail ${s==='left'?'gauche':'droit'} ${c==='s1'?'non calibrée (S1)':'absente'}`);
   if(c<Z.confianceMin)return non('confiance',`confiance du rail ${s==='left'?'gauche':'droit'} ${virgule(c)} sous ${virgule(Z.confianceMin)}`);}
  const V=R.voie||DEFAUT.voie,C=R.coherence||DEFAUT.coherence;
  for(const s of SIDES)if(!(Math.abs(ec[s].lat)<=V.lateralMaxMm))
   return non('voie',`rail ${s==='left'?'gauche':'droit'} déplacé de ${virgule(Math.abs(ec[s].lat))} mm en travers (plus de ${virgule(V.lateralMaxMm)} mm : autre voie possible)`);
  const dl=Math.abs(ec.left.lat-ec.right.lat),dv=Math.abs(ec.left.vert-ec.right.vert);
  if(!(dl<=C.diffLateraleMaxMm))return non('coherence',`rails incohérents en travers (${virgule(dl)} mm d’écart entre les deux rails)`);
  if(!(dv<=C.diffVerticaleMaxMm))return non('coherence',`rails incohérents en hauteur (${virgule(dv)} mm d’écart entre les deux rails)`);
  if(e.ecartementMm!==undefined||e.ecartementRefMm!==undefined){
   if(!Number.isFinite(e.ecartementMm))return non('coherence','écartement de la pose écrite illisible');
   if(!Number.isFinite(e.ecartementRefMm))return non('coherence','aucun écartement de référence (appuis du lot)');
   const ref=e.ecartementRefMm,d=Math.abs(e.ecartementMm-ref);
   if(!(d<=C.ecartementMaxMm))return non('coherence',`écartement ${virgule(e.ecartementMm)} mm, à ${virgule(d)} mm de la référence ${virgule(ref)} mm`);}
  return {corriger:true,regle:'ok',raison:`zone ${e.zone}, écart ${virgule(pire)} mm (seuil ${virgule(Z.seuilMm)}), confiance ${SIDES.map(s=>virgule(conf[s])).join(' / ')}, rails cohérents`};}
 return {DEFAUT,ZONES,ETAGES,VARIANTES,reglages,juger};
});
