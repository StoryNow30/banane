(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeGcv2L1e=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* 4.9.5.14 (test 14, fiches/L1_APPRENTISSAGE.md) — DÉCISION « L1-e » D'UN DIFFÉRÉ : CORRECTION D'ÉCARTEMENT APPRISE SUR LES ÉCHOS.
  * MODULE PUR : ni DOM, ni ESV, ni stockage.
  *
  * Constat (Échos de 2:17, 2:18 et 2:19 contre le premier lot réel de la GCV2) : la GCV2 trouve la bonne voie, mais en ADV un de ses rails est
  * souvent à 20 à 35 mm de trop en travers : sa paire est trop large (1 455 à 1 470 mm) alors que l'opérateur pose à l'écartement des lignes
  * voisines (1 430 à 1 440 mm). Sur 2:19, le rail droit est juste (1,8 mm) et le gauche faux de 28 mm, toujours du même côté ; la médiane des cuts
  * que le lot vient de valider ne corrige rien (ils ont la même erreur, 1 465 mm). La référence fiable est l'écartement des lignes VALIDES de la
  * liste d'ESV que personne n'a touchées dans la séance (drapeaux 0 : ni vues ni traitées par l'opérateur, ni écrites par Ariane) : 1 433,8 mm
  * sur 2:19 (l'opérateur : 1 433,5), 1 434 à 1 436 mm sur 2:11, 2:17, 2:18.
  *
  * Règle L1-e, sur la décision de la test 13 (mêmes hypothèses, mêmes probabilités, même paire choisie, `deciderL1`) :
  *   - référence : médiane de l'écartement des `voisines` lignes valides non touchées les plus proches du cut (instantané de la liste d'ESV) ;
  *   - anomalie : l'écartement de la paire choisie s'écarte de la référence de `anomalieMinMm` à `anomalieMaxMm` ;
  *   - correction : le rail le MOINS probable de la paire est déplacé en travers pour que la paire prenne l'écartement de référence, à condition
  *     que le nuage le soutienne à sa nouvelle place (mêmes seuils que H6 : 5 points de dessus, 3 de flanc) — aucune pose sans preuve ;
  *   - « valider » de la test 13 : validé, avec la paire corrigée s'il y a anomalie soutenue ;
  *   - « rien, plus de 150 mm » de la test 13 (sous τ, loin du départ) : validé SEULEMENT s'il y a anomalie soutenue (la grande distance au départ
  *     s'explique alors par la pose d'ESV par défaut, et la paire corrigée est à l'écartement des lignes voisines) ; sinon rien ;
  *   - « poser sans valider » de la test 13 : rien (plus de pose approchée : 52 % des approchés jugés restaient à plus de 50 mm de l'opérateur) ;
  *   - tout autre « rien » : rien. Sans instantané de liste (référence absente) : la décision de la test 13, sans pose approchée.
  * Les seuils viennent du diagnostic de 2:19 et sont contrôlés sur 2:11, 2:17, 2:18 (fiches/L1_APPRENTISSAGE.md). */
 const VERSION='gcv2-l1e-1';
 const REGLAGE=Object.freeze({voisines:20,voisinesMin:10,anomalieMinMm:15,anomalieMaxMm:40,soutienDessus:5,soutienFlanc:3});
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const arrondi=(v,d=1)=>fini(v)?Math.round(v*10**d)/10**d:null;

 /* Référence d'écartement (mm) au cut `cut`, depuis un instantané DÉCOMPACTÉ de la liste d'ESV (`BananeListeMemoire.decompacter` : n ; st, fl par
  * ligne ; ed, six bords par ligne à la suite, au dixième de millimètre, monde). Lignes valides (st 0) sans drapeau (fl 0), les plus proches du cut ;
  * écartement = distance des bords gauche et droit (indépendant du repère). Rend { mm, n, distMax } ou null. */
 function referenceEcartement(table,cut,reglage=REGLAGE){
   if(!table||!Number.isInteger(table.n)||!Array.isArray(table.st)||!Array.isArray(table.fl)||!Array.isArray(table.ed)||!Number.isInteger(cut))return null;
   const pris=[];
   for(let d=0;pris.length<reglage.voisines&&d<table.n;d++){
     for(const i of d?[cut-d,cut+d]:[cut]){
       if(i<0||i>=table.n||pris.length>=reglage.voisines)continue;
       if(table.st[i]!==0||table.fl[i]!==0)continue;
       const e=table.ed.slice(6*i,6*i+6);
       if(e.length<6||!e.every(fini))continue;
       pris.push({g:Math.hypot(e[0]-e[3],e[1]-e[4],e[2]-e[5])/10,d});
     }
   }
   if(pris.length<reglage.voisinesMin)return null;
   const s=pris.map(x=>x.g).sort((a,b)=>a-b),m=s.length>>1;
   return {mm:arrondi(s.length%2?s[m]:(s[m-1]+s[m])/2,2),n:pris.length,distMax:Math.max(...pris.map(x=>x.d))};
 }
 /* Sens de variation de l'écartement quand le rail `s` va en travers, lu sur les hypothèses du cas (`g` : écartement de l'hypothèse avec l'autre
  * rail à sa pose de départ) ; `hyps` : { left:[{ decal, g, depart }], right:[…] }. */
 function signe(hyps,s){
   const hs=hyps[s],h0=hs.find(h=>h.depart);
   if(h0&&fini(h0.g))for(const h of hs){const dl=h.decal[1]-h0.decal[1];if(Math.abs(dl)>5&&fini(h.g))return Math.sign((h.g-h0.g)/dl)||1;}
   return s==='left'?1:-1;
 }
 /* Correction d'une paire. `paire` : { left:{decal,p}, right:{decal,p} } ; `g` : son écartement (mm) ; `hyps` : hypothèses du cas (pour le signe) ;
  * `ref` : référence (mm) ; `soutien(rail, decal)` → { dessus, flanc }. Rend { anomalie, ecartMm, rail, decal, soutenue } (decal : la paire corrigée). */
 function corriger({paire,g,hyps,ref,soutien,reglage=REGLAGE}){
   const out={anomalie:false,ecartMm:fini(ref)&&fini(g)?arrondi(ref-g,1):null,rail:null,decal:null,soutenue:false};
   if(!fini(out.ecartMm))return out;
   const a=Math.abs(out.ecartMm);
   if(a<reglage.anomalieMinMm||a>reglage.anomalieMaxMm)return out;
   out.anomalie=true;
   const s=(paire.left.p??0)<=(paire.right.p??0)?'left':'right';
   const decal={left:paire.left.decal.slice(),right:paire.right.decal.slice()};
   decal[s][1]=arrondi(decal[s][1]+(ref-g)/signe(hyps,s),2);
   out.rail=s;out.decal=decal;
   const m=typeof soutien==='function'?soutien(s,decal[s]):null;
   out.soutenue=!!(m&&m.dessus>=reglage.soutienDessus&&m.flanc>=reglage.soutienFlanc);
   return out;
 }
 /* Décision L1-e depuis la décision de la test 13 `d0` ({ etat, motif, paire }) et sa correction `c` (`corriger`, ou null sans référence).
  * Rend { etat:'valider'|'rien', motif, decal (paire posée) ou null, corrigee }. */
 function decider(d0,c){
   const corrigee=!!(c&&c.anomalie&&c.soutenue);
   if(d0.etat==='valider')return {etat:'valider',motif:null,decal:corrigee?c.decal:{left:d0.paire.left.decal,right:d0.paire.right.decal},corrigee};
   if(d0.etat==='rien'&&d0.motif==='plus-de-150-mm'&&corrigee)return {etat:'valider',motif:'ecartement-corrige',decal:c.decal,corrigee};
   if(d0.etat==='poser-sans-valider')return {etat:'rien',motif:'sans-approche',decal:null,corrigee:false};
   return {etat:'rien',motif:d0.motif??null,decal:null,corrigee:false};
 }
 return {VERSION,REGLAGE,referenceEcartement,signe,corriger,decider};
});
