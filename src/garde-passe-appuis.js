(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeGardePasseAppuis=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* Garde A de la deuxième passe des différés (fiches/GARDE_PASSE_A.md ; examen : fiches/EXAMEN_PASSE_PARTIE0.md § 4 ; D-251).
  *
  * Fonction PURE : elle dit si une pose que la passe s'apprête à faire doit être refusée. Elle ne commande rien et ne lit rien d'ESV.
  * Règle : la pose est REFUSÉE (« rien », le cut reste différé, motif `garde-appuis`) quand, à la fois,
  *   1. le déplacement du pire rail par rapport à la pose de départ d'ESV (norme 3D du décalage, mm) est STRICTEMENT inférieur à
  *      `deplacementMaxMm` (livré : 100 mm) ;
  *   2. aucune pose de la CHAÎNE NORMALE du lot (première passe, fenêtre, choix : les voisins de la décision du lot) n'existe à
  *      `appuiNormalMaxCuts` cuts ou moins (livré : 4), avant ou après le cut. Les poses de la GCV2 dans le lot et celles de la passe
  *      ne comptent PAS : c'est à l'appelant de ne passer que les cuts de la chaîne normale (`cutsNormaux`).
  * Pourquoi : sur la partie 0 du 23/10, les cinq poses fausses de la passe (150 à 266 mm de l'opérateur) étaient à 27 à 92 mm du
  * départ et à 5 à 28 cuts de la plus proche pose de la chaîne normale ; elles suivaient des voisins posés faux par la GCV2 dans le
  * lot ou par la passe elle-même. Les seuils sont fixés sur cette seule partie (SUPPOSÉ généralisable).
  * Un décalage illisible : refus (la garde ne laisse passer que ce qu'elle a mesuré). */
 const SIDES=['left','right'];
 const DEFAUT=Object.freeze({actif:true,deplacementMaxMm:100,appuiNormalMaxCuts:4});
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const objet=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
 /* Lecture du réglage `lot.passeDifferes.gardeAppuis`, comme les autres clés de la passe : ABSENT (undefined) : la valeur livrée
  * (`defaut`) ; `false` : garde coupée ; un objet : clé par clé, une clé absente vaut la valeur livrée ; toute autre valeur, ou une
  * clé illisible : { ok:false } (l'appelant coupe alors la passe : jamais de passe sans sa garde par erreur de réglage). */
 function reglage(valeur,defaut=DEFAUT){
  const d=objet(defaut)?{...DEFAUT,...defaut}:{...DEFAUT};
  if(valeur===undefined)valeur={};
  else if(valeur===false)return {ok:true,actif:false,deplacementMaxMm:d.deplacementMaxMm,appuiNormalMaxCuts:d.appuiNormalMaxCuts};
  if(!objet(valeur))return {ok:false,raison:'gardeAppuis illisible'};
  const r={...d,...valeur};
  if(typeof r.actif!=='boolean')return {ok:false,raison:'gardeAppuis.actif illisible'};
  if(!(fini(r.deplacementMaxMm)&&r.deplacementMaxMm>0))return {ok:false,raison:'gardeAppuis.deplacementMaxMm illisible'};
  if(!(Number.isInteger(r.appuiNormalMaxCuts)&&r.appuiNormalMaxCuts>=0))return {ok:false,raison:'gardeAppuis.appuiNormalMaxCuts illisible'};
  return {ok:true,actif:r.actif,deplacementMaxMm:r.deplacementMaxMm,appuiNormalMaxCuts:r.appuiNormalMaxCuts};}
 /* Déplacement du pire rail (mm) : décalage [long, lat, vert] de chaque rail depuis la pose de départ, norme 3D, le plus grand. */
 function deplacementMm(decal){
  if(!objet(decal))return null;
  let m=-Infinity;
  for(const s of SIDES){const v=decal[s];if(!Array.isArray(v)||v.length<3||!v.slice(0,3).every(fini))return null;m=Math.max(m,Math.hypot(v[0],v[1],v[2]));}
  return m;}
 /* Distance, en cuts, à la plus proche pose de la chaîne normale (le cut lui-même exclu) ; null s'il n'y en a aucune. */
 function appuiNormalCuts(cut,cutsNormaux){
  if(!Number.isInteger(cut)||!Array.isArray(cutsNormaux))return null;
  let m=null;
  for(const c of cutsNormaux){if(!Number.isInteger(c)||c===cut)continue;const d=Math.abs(c-cut);if(m===null||d<m)m=d;}
  return m;}
 const arrondi=v=>v===null?null:Math.round(v*10)/10;
 /* Jugement d'une pose : { bloque, motif, deplacementMm, appuiNormalCuts }. Motifs : `garde-appuis` (refusée), `garde-coupee`,
  * `loin-du-depart` (déplacement ≥ seuil), `appui-normal` (une pose de la chaîne normale à `appuiNormalMaxCuts` cuts ou moins). */
 function juger({cut,decal,cutsNormaux}={},R=reglage()){
  const D=deplacementMm(decal),A=appuiNormalCuts(cut,cutsNormaux),out={deplacementMm:arrondi(D),appuiNormalCuts:A};
  if(!R||R.ok===false)return {bloque:true,motif:'garde-appuis',...out};
  if(R.actif===false)return {bloque:false,motif:'garde-coupee',...out};
  if(D!==null&&!(D<R.deplacementMaxMm))return {bloque:false,motif:'loin-du-depart',...out};
  if(D!==null&&A!==null&&A<=R.appuiNormalMaxCuts)return {bloque:false,motif:'appui-normal',...out};
  return {bloque:true,motif:'garde-appuis',...out};}
 return {VERSION:'garde-passe-appuis-1',DEFAUT,reglage,deplacementMm,appuiNormalCuts,juger};
});
