(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeRelectureSignal=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* CH-060 — SIGNAL DE FIN DE CHARGEMENT D'ESV ÉTEINT PENDANT LA RELECTURE (partie pure : aucune commande, aucune lecture d'ESV).
  *
  * Mesuré (ÉTABLI, journaux du 04/11 et du 05/11, 28 chargements de page, 8 242 cuts relus ; chantiers/CH-060/rapport.md) :
  *  - une lecture « rapide » attend le signal d'ESV (src/adapter-page.js `attendreChargement` : aucun chargement en cours, mêmes nœuds sur deux
  *    images) ; quand le compteur `numNodesLoading` d'ESV reste bloqué (1 ou 2), le signal ne vient jamais et chaque rail attend le repli de
  *    800 ms (règle « stabilité ») ;
  *  - les 28 chargements de page commencent avec le signal vivant ; 10 le perdent (le plus souvent 47 à 96 s après le chargement) et il ne revient
  *    jamais sans rechargement de la page ;
  *  - relecture avec le signal : 1,1 à 2 s par cut ; signal éteint : 3 à 4 s ; 2 166 cuts relus sur 8 242 l'ont été signal éteint.
  * Ce module dit, cut relu après cut relu, si le signal est éteint : `lectures` captures RAPIDES DE SUITE dont toutes les vues réussies à la première
  * tentative ont fini au repli « stabilité ». Une capture de référence (`lecture` « reference », un cut sur dix : elle n'attend jamais le signal) ou
  * sans relevé ne compte pas et ne remet rien à zéro ; une seule vue lue au signal remet la série à zéro. Plus longue série mesurée dans une page
  * saine : 3 (6 au pire, en fin de page mourante) ; d'où 8 par défaut.
  *
  * Ce que le service worker en fait (background.js `relecturePasse`, `relectureSignalRecharger`) : réglage COUPÉ (`actif:false`, défaut tant que
  * l'opérateur n'a pas essayé), un seul événement `relecture-signal-eteint` (étape « detecte », action « aucune ») ; allumé, et si la pause de la
  * relecture est permise, la passe se met en pause au point de reprise (jamais entre une pose et sa validation), Ariane recharge la page ESV,
  * la ré-équipe, attend qu'elle affiche la partie du lot, puis reprend la relecture au cut suivant (au plus `rechargementsMax` fois par passe : 1, décision de l'intégrateur du 06/11 ; si le signal ne revient pas, la passe continue au repli).
  * Rien de ce qui est lu ni jugé ne change : après le rechargement, la lecture est la lecture nominale (signal vivant). */
 const DEFAULTS=Object.freeze({actif:false,lectures:8,rechargementsMax:1,delaiAvantMs:500,sondageMs:500,attenteRepriseMs:90000,silenceListeMs:2500,attenteSansListeMs:10000});
 const entierPositif=v=>Number.isInteger(v)&&v>0;
 function reglage(o){const r={...DEFAULTS,...(o&&typeof o==='object'?o:{})};
  for(const k of ['lectures','delaiAvantMs','sondageMs','attenteRepriseMs','silenceListeMs','attenteSansListeMs'])if(!(Number.isFinite(r[k])&&r[k]>=0))r[k]=DEFAULTS[k];
  if(!entierPositif(r.lectures))r.lectures=DEFAULTS.lectures;if(!(Number.isInteger(r.rechargementsMax)&&r.rechargementsMax>=0))r.rechargementsMax=DEFAULTS.rechargementsMax;
  r.actif=r.actif===true;return r;}
 /* Ce que dit une capture : « signal » (une vue au moins lue au signal), « repli » (lecture rapide, toutes les vues réussies à la première tentative
  * au repli « stabilité »), « neutre » (référence, relevé absent, aucune vue réussie à la première tentative). */
 function lectureDe(capture){const rs=capture?.readStrategy;if(!rs||rs.lecture!=='rapide'||!Array.isArray(rs.attempts))return 'neutre';
  const vues=rs.attempts.filter(a=>a&&a.status==='captured'&&(a.attempt===1||a.attempt===undefined));
  if(!vues.length)return 'neutre';
  if(vues.some(a=>a.regle==='signal'))return 'signal';
  return vues.every(a=>a.regle==='stabilite')?'repli':'neutre';}
 function creer(o){return {reglage:reglage(o),serie:0,detections:0,rechargements:0,dernier:null};}
 /* Observe la capture d'un cut relu. Rend {lecture, serie, action} : « rien », « signaler » (seuil atteint, réglage coupé ou plafond de
  * rechargements atteint, ou `peutRecharger` faux) ou « recharger ». L'action n'est rendue qu'une fois par série (au seuil). */
 function observer(e,capture,{peutRecharger=true}={}){const l=lectureDe(capture);e.dernier=l;
  if(l==='signal')e.serie=0;else if(l==='repli')e.serie++;
  if(l!=='repli'||e.serie!==e.reglage.lectures)return {lecture:l,serie:e.serie,action:'rien',raison:null};
  e.detections++;
  const raison=!e.reglage.actif?'réglage coupé':!peutRecharger?'pause et reprise de la relecture éteintes':e.rechargements>=e.reglage.rechargementsMax?`${e.rechargements} rechargement${e.rechargements>1?'s':''} déjà faits`:null;
  return {lecture:l,serie:e.serie,action:raison?'signaler':'recharger',raison};}
 /* Un rechargement est lancé : la série repart de zéro (la page neuve a son signal). */
 function recharge(e){e.rechargements++;e.serie=0;}
 function bilan(e){return {serie:e.serie,detections:e.detections,rechargements:e.rechargements,lectures:e.reglage.lectures,actif:e.reglage.actif,rechargementsMax:e.reglage.rechargementsMax};}
 return {DEFAULTS,reglage,lectureDe,creer,observer,recharge,bilan};
});
