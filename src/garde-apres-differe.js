(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeGardeApresDiffere=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* Garde « après un différé » du lot (chantier CH-019 ; analyse : CH-015, rapport de banane-data § 7 à § 11 ; D-265).
  *
  * Fonction PURE : elle dit si un cut que le lot s'apprête à VALIDER doit être différé. Elle ne commande rien et ne lit rien d'ESV.
  * Elle ne fait que transformer une validation en différé : elle ne pose ni ne valide jamais rien de plus.
  * Règle R3 (livrée) : le cut est DIFFÉRÉ (motif `garde-apres-differe`) quand, à la fois,
  *   1. un des `coupures` cuts qui le précèdent (livré : 2, soit cut−1 et cut−2) est un DIFFÉRÉ DU LOT (motif du moteur, de la chaîne ou
  *      de la GCV2) : c'est à l'appelant de ne passer que ceux-là (`differesLot`). Un cut différé par cette garde n'en est PAS un, sinon
  *      elle s'enchaînerait en cascade sur toute la partie ;
  *   2. le cut a STRICTEMENT moins de `appuisMin` appuis (livré : 2) : les appuis de la décision du lot (`anchorsUsed`).
  * Règle R1 : la condition 1 seule.
  * Pourquoi : sur la partie 20 du 28/10 (4.9.5.23, 172 jugés, échantillon biaisé), les poses fausses de 21 à plus de 50 mm, décalage commun
  * aux deux rails, suivent un différé qui casse la chaîne d'appuis. R3 y signale 38 posés sur 721 et attrape 13 faux sur 21 (rappel 62 %,
  * précision 41 %). Aucune validation hors échantillon (SUPPOSÉ généralisable).
  * Des appuis illisibles comptent 0 (la garde ne laisse passer que ce qu'elle a mesuré). */
 const DEFAUT=Object.freeze({actif:true,regle:'R3',coupures:2,appuisMin:2});
 const REGLES=['R1','R3'];
 const objet=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
 /* Lecture du réglage `lot.gardeApresDiffere` : ABSENT (undefined) : la valeur livrée (`defaut`) ; `false` : garde coupée ; un objet : clé par
  * clé, une clé absente vaut la valeur livrée ; toute autre valeur, ou une clé illisible : { ok:false } avec les valeurs livrées (l'appelant
  * applique alors la garde livrée : un réglage illisible ne l'éteint jamais, et elle ne peut que différer). */
 function reglage(valeur,defaut=DEFAUT){
  const d=objet(defaut)?{...DEFAUT,...defaut}:{...DEFAUT},livre={actif:d.actif,regle:d.regle,coupures:d.coupures,appuisMin:d.appuisMin};
  const illisible=raison=>({ok:false,raison,...livre});
  if(valeur===undefined)valeur={};
  else if(valeur===false)return {ok:true,...livre,actif:false};
  if(!objet(valeur))return illisible('gardeApresDiffere illisible');
  const r={...d,...valeur};
  if(typeof r.actif!=='boolean')return illisible('gardeApresDiffere.actif illisible');
  if(!REGLES.includes(r.regle))return illisible('gardeApresDiffere.regle illisible');
  if(!(Number.isInteger(r.coupures)&&r.coupures>=1))return illisible('gardeApresDiffere.coupures illisible');
  if(!(Number.isInteger(r.appuisMin)&&r.appuisMin>=0))return illisible('gardeApresDiffere.appuisMin illisible');
  return {ok:true,actif:r.actif,regle:r.regle,coupures:r.coupures,appuisMin:r.appuisMin};}
 /* Cuts différés du lot parmi les `coupures` cuts qui précèdent `cut` (cut−coupures à cut−1), triés. */
 function voisinsDifferes(cut,differesLot,coupures){
  if(!Number.isInteger(cut)||!Array.isArray(differesLot))return [];
  return [...new Set(differesLot.filter(c=>Number.isInteger(c)&&c<cut&&c>=cut-coupures))].sort((a,b)=>a-b);}
 /* Jugement d'un cut que le lot allait valider : { differer, motif, regle, appuis, voisinsDifferes } (plus `reglageIllisible` si le réglage
  * n'a pas été lu). Motifs : `garde-apres-differe` (différé), `garde-coupee`, `pas-de-differe` (aucun différé du lot dans la fenêtre),
  * `appuis` (R3 : assez d'appuis). */
 function juger({cut,differesLot,appuis}={},R=reglage()){
  const r=objet(R)?R:reglage(),V=voisinsDifferes(cut,differesLot,r.coupures),A=Number.isInteger(appuis)&&appuis>=0?appuis:null;
  const out={regle:r.regle,appuis:A,voisinsDifferes:V,...(r.ok===false?{reglageIllisible:true}:{})};
  if(r.ok!==false&&r.actif===false)return {differer:false,motif:'garde-coupee',...out};
  if(!V.length)return {differer:false,motif:'pas-de-differe',...out};
  if(r.regle==='R3'&&(A??0)>=r.appuisMin)return {differer:false,motif:'appuis',...out};
  return {differer:true,motif:'garde-apres-differe',...out};}
 return {VERSION:'garde-apres-differe-1',DEFAUT,REGLES,reglage,voisinsDifferes,juger};
});
