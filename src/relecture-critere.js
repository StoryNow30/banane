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
  *   5. la zone (pn, adv, abords, vert-hors-zone) permet la correction (`zones[z].corriger`, un interrupteur par zone : D-180, Mic
  *      accepte les chiffres de l'étude pour l'ADV et les abords, qui corrigent comme le PN ; les verts hors zone restent en ombre) ;
  *   6. l'écart le plus grand (latéral ou vertical, des deux rails) atteint le seuil de la zone (`seuilMm`) ;
  *   7. la confiance du moteur (A*), sur les deux rails, atteint le minimum de la zone (`confianceMin`) ; absente : refus (comme
  *      l'étude : « confiance présente » quand le minimum est 0) ;
  *   8. JAMAIS DE CHANGEMENT DE VOIE : l'écart latéral de chaque rail reste sous `voie.lateralMaxMm` (une autre voie est à 1,5 m et
  *      plus ; les poses sur la mauvaise voie mesurées allaient de 163 à 280 mm, D-159) ;
  *   9. LES DEUX RAILS COHÉRENTS : leurs écarts latéraux ne diffèrent pas de plus de `coherence.diffLateraleMaxMm`, leurs écarts
  *      verticaux de plus de `coherence.diffVerticaleMaxMm` (la correction déplace la voie, elle ne la tord pas), et l'écartement de la
  *      pose reste à `coherence.ecartementMaxMm` de la médiane de la partie (référence passée par l'appelant ; sans référence, refus).
  * `ecrit` (facultatif) : l'écart de la pose qui serait ÉCRITE (commande du lot), à la place de celui du jugement ; les conditions 6,
  * 8 et 9 sont jugées sur lui. Revue (F4) : les seuils sont comparés aux valeurs BRUTES (`ecritBrut`, `jugement.ecartBrutMm`,
  * `ecartementBrutMm`) quand elles sont données ; l'arrondi au dixième ne sert qu'à l'affichage (7,95 mm ne passe pas 8 mm).
  *
  * SEUILS : `datasets/relecture-reglages-proposes.json` (chantier claude/50-zones-autonomes) s'il existe et se lit, sinon
  * `datasets/relecture-reglages-defaut.json` (PROVISOIRE, aligné sur D-180 : PN, ADV et abords corrigent, 45 mm de latéral au plus),
  * recopié ici dans DEFAUT (un essai vérifie qu'ils sont égaux). `reglages(fichier)` valide un fichier et complète ce qui manque par
  * le défaut (une zone absente ou mal écrite y est FERMÉE, jamais ouverte par le défaut). Revue (D-175, correction 5) : les réglages ne s'ouvrent JAMAIS en cas d'échec. Un champ de sécurité invalide ou absent
  * (zone, `corriger`, `seuilMm`, `voie.lateralMaxMm` au-delà de 45 mm, `roles` autres que les verts, `jamais` sans les cuts du lot) est
  * listé dans `invalides` ; une correction mal écrite reste fermée. `correctionPermise(r)` ne dit oui que pour le fichier proposé, lu
  * sans refus et sans champ invalide : sinon le service worker ramène « corriger » à « ombre » et le dit au panneau. */
 const SIDES=['left','right'],ZONES=['pn','adv','abords','vert-hors-zone'],ZONES_OPTION=['ecartement'],ETAGES=['first-pass','window','choice','crossing'],VARIANTES=['chaine+h','chaine','seul+h','seul'];
 const LATERAL_MAX_MM=45,JAMAIS=Object.freeze(['cut différé par le lot','cut posé par le lot']);
 const DEFAUT=Object.freeze({format:'ariane-relecture-reglages-1',statut:'provisoire',
  etagesPermis:Object.freeze(['first-pass','window']),appuisMin:2,roles:Object.freeze(['vert']),
  jamais:JAMAIS,variante:Object.freeze({proposition:'chaine+h'}),
  voie:Object.freeze({lateralMaxMm:LATERAL_MAX_MM}),
  coherence:Object.freeze({diffLateraleMaxMm:6,diffVerticaleMaxMm:6,ecartementMaxMm:8}),
  zones:Object.freeze({
   pn:Object.freeze({corriger:true,seuilMm:15,confianceMin:85}),
   adv:Object.freeze({corriger:true,seuilMm:8,confianceMin:95}),
   abords:Object.freeze({corriger:true,seuilMm:8,confianceMin:80}),
   'vert-hors-zone':Object.freeze({corriger:false,seuilMm:15,confianceMin:90}),
   /* D-185 : zone optionnelle, FERMÉE par défaut et par tout fichier qui ne l'ouvre pas (H5, audit P-5). */
   ecartement:Object.freeze({corriger:false,seuilMm:8,confianceMin:0})})});
 const nombre=(v,min=0,max=1e6)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const virgule=v=>String(Math.round(v*10)/10).replace('.',',');

 /* Réglages lus d'un fichier : chaque valeur invalide ou absente prend celle du défaut (une correction invalide : fermée), et chaque
  * champ de sécurité invalide est nommé dans `invalides`. `source` : d'où ils viennent. */
 function reglages(fichier,source='defaut'){
  const f=fichier&&typeof fichier==='object'&&!Array.isArray(fichier)?fichier:null;
  if(!f||f.format!==DEFAUT.format)return {...reglages(DEFAUT,'defaut'),refus:f?'format':null};
  const liste=(v,d,ok)=>Array.isArray(v)&&v.length&&v.every(ok)?v.slice():d.slice();
  const zones={},invalides=[];
  for(const z of ZONES){const d=DEFAUT.zones[z],x=f.zones?.[z];
   if(!x||typeof x!=='object'||Array.isArray(x))invalides.push(`zones.${z}`);
   const y=x&&typeof x==='object'?x:{};
   if(x&&typeof y.corriger!=='boolean')invalides.push(`zones.${z}.corriger`);
   if(x&&!nombre(y.seuilMm,1,500))invalides.push(`zones.${z}.seuilMm`);
   zones[z]={corriger:typeof y.corriger==='boolean'?y.corriger:false,seuilMm:nombre(y.seuilMm,1,500)?y.seuilMm:d.seuilMm,
    confianceMin:nombre(y.confianceMin,0,100)?y.confianceMin:d.confianceMin};}
  /* Zones optionnelles : absentes du fichier, elles sont fermées sans rien signaler ; présentes et mal écrites, elles sont signalées et fermées. */
  for(const z of ZONES_OPTION){const d=DEFAUT.zones[z],x=f.zones?.[z];
   if(x===undefined){zones[z]={...d};continue;}
   if(!x||typeof x!=='object'||Array.isArray(x)){invalides.push(`zones.${z}`);zones[z]={...d};continue;}
   if(typeof x.corriger!=='boolean')invalides.push(`zones.${z}.corriger`);
   if(!nombre(x.seuilMm,1,500))invalides.push(`zones.${z}.seuilMm`);
   zones[z]={corriger:typeof x.corriger==='boolean'?x.corriger:false,seuilMm:nombre(x.seuilMm,1,500)?x.seuilMm:d.seuilMm,
    confianceMin:nombre(x.confianceMin,0,100)?x.confianceMin:d.confianceMin};}
  const c=f.coherence||{},v=f.voie||{};
  const lateralOk=nombre(v.lateralMaxMm,1,LATERAL_MAX_MM);if(!lateralOk)invalides.push('voie.lateralMaxMm');
  const rolesOk=Array.isArray(f.roles)&&f.roles.length>0&&f.roles.every(r=>r==='vert');if(!rolesOk)invalides.push('roles');
  const jamaisOk=Array.isArray(f.jamais)&&JAMAIS.every(x=>f.jamais.includes(x));if(!jamaisOk)invalides.push('jamais');
  const variante=typeof f.variante==='string'?f.variante:f.variante?.proposition;
  return {format:DEFAUT.format,statut:typeof f.statut==='string'?f.statut.slice(0,40):'inconnu',source,invalides,
   /* Les quatre étapes qui posent sont acceptées (le fichier proposé les donne toutes) ; une étape inconnue rend le défaut. */
   etagesPermis:liste(f.etagesPermis,DEFAUT.etagesPermis,e=>ETAGES.includes(e)),
   /* Minimum d'appuis : celui du fichier ; absent, aucun (l'étude n'en a pas : la chaîne d'appuis tient lieu de voie). */
   appuisMin:Number.isInteger(f.appuisMin)&&f.appuisMin>=0&&f.appuisMin<=40?f.appuisMin:0,
   variante:VARIANTES.includes(variante)?variante:DEFAUT.variante.proposition,
   jamais:jamaisOk?f.jamais.filter(x=>typeof x==='string').slice(0,8):DEFAUT.jamais.slice(),
   selection:f.selection&&typeof f.selection==='object'&&!Array.isArray(f.selection)?f.selection:null,
   roles:rolesOk?f.roles.slice():DEFAUT.roles.slice(),
   voie:{lateralMaxMm:lateralOk?v.lateralMaxMm:DEFAUT.voie.lateralMaxMm},
   coherence:{diffLateraleMaxMm:nombre(c.diffLateraleMaxMm,0,100)?c.diffLateraleMaxMm:DEFAUT.coherence.diffLateraleMaxMm,
    diffVerticaleMaxMm:nombre(c.diffVerticaleMaxMm,0,100)?c.diffVerticaleMaxMm:DEFAUT.coherence.diffVerticaleMaxMm,
    ecartementMaxMm:nombre(c.ecartementMaxMm,0,100)?c.ecartementMaxMm:DEFAUT.coherence.ecartementMaxMm},
   zones};}
 /* La passe peut-elle corriger avec ces réglages ? Oui seulement pour le fichier proposé, lu sans refus et sans champ invalide. */
 function correctionPermise(r){
  if(!r||typeof r!=='object')return {ok:false,raison:'réglages illisibles'};
  if(r.refus==='format')return {ok:false,raison:'fichier de réglages d’un autre format'};
  if(r.source!=='propose')return {ok:false,raison:'fichier proposé absent ou illisible (défaut provisoire)'};
  if(!Array.isArray(r.invalides))return {ok:false,raison:'réglages non vérifiés'};
  if(r.invalides.length)return {ok:false,raison:`réglages invalides : ${r.invalides.slice(0,6).join(', ')}`};
  return {ok:true,raison:null};}

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
  /* H5 (audit P-5, rouvert par D-185) : un vert entré pour son seul écartement, hors de toute plage, reste en ombre tant que les réglages
   * ne l'ouvrent pas EXPLICITEMENT (`zones.ecartement.corriger`, fermé par défaut) ; ouvert, il suit les mêmes limites que les abords. */
  if(e.zone==='ecartement'&&R.zones?.ecartement?.corriger!==true)return non('zone','vert hors plage entré pour son écartement : ombre seulement');
  if(!['pn','adv','abords','ecartement'].includes(e.zone))return non('zone',`zone « ${e.zone??'?'} » : jamais corrigée (D-180)`);
  const Z=R.zones?.[e.zone];
  if(!Z)return non('zone',`zone « ${e.zone??'?'} » inconnue`);
  if(Z.corriger!==true)return non('zone',`zone ${e.zone} : correction coupée`);
  const tous=x=>x&&SIDES.every(s=>x[s]);
  const ec=tous(e.ecritBrut)?e.ecritBrut:tous(e.ecrit)?e.ecrit:tous(j.ecartBrutMm)?j.ecartBrutMm:j.ecartMm;
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
   const ref=e.ecartementRefMm,g=Number.isFinite(e.ecartementBrutMm)?e.ecartementBrutMm:e.ecartementMm,d=Math.abs(g-ref);
   if(!(d<=C.ecartementMaxMm))return non('coherence',`écartement ${virgule(e.ecartementMm)} mm, à ${virgule(d)} mm de la référence ${virgule(ref)} mm`);}
  return {corriger:true,regle:'ok',raison:`zone ${e.zone}, écart ${virgule(pire)} mm (seuil ${virgule(Z.seuilMm)}), confiance ${SIDES.map(s=>virgule(conf[s])).join(' / ')}, rails cohérents`};}
 return {DEFAUT,ZONES,ZONES_OPTION,ETAGES,VARIANTES,LATERAL_MAX_MM,reglages,correctionPermise,juger};
});
