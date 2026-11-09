(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeGardeVoieOmbre=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* CH-079 (D-308, mesure 2) — GARDE DE VOIE, EN OMBRE. Module pur : ni ESV, ni stockage, ni horloge, ni journal. Il CALCULE et rend un événement ;
  * il ne pose rien, ne diffère rien, ne change aucune décision. Sur un cut que le lot VALIDE, il compare l'écartement posé à celui des voisins
  * (lignes VALIDES de la liste d'ESV à ±`fenetre` cuts, quels que soient les drapeaux : dans un lot, les voisins sont les cuts qu'il a lui-même validés ; médiane ; sinon `gRefDefautMm`, 1435 ;
  * `avantSeulement` : ne lire que les cuts précédents, pour rejouer sur une liste prise après le lot ce que la liste vivante contenait à la décision) : une pose dont l'écartement s'éloigne de
  * plus de `seuilMm` de ses voisins est une mauvaise voie probable (cuts 220, 360, 361 de l'Écho du 08/11 : 1458 à 1462 mm contre 1432 à 1437).
  * `seuilMm` est PROVISOIRE : il se choisit par la mesure (chantiers/CH-079/rapport.md). L'événement ne porte que des numéros de cut et des mm. */
 const VERSION='garde-voie-ombre-v1';
 const REGLAGE=Object.freeze({seuilMm:15,fenetre:20,voisinesMin:5,gRefDefautMm:1435,avantSeulement:false});
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const r2=v=>fini(v)?Math.round(v*100)/100:null;
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 /* Écartement (mm) d'une pose { left:[x,y,z], right:[x,y,z] } en mètres. */
 function ecartementMm(positions){
   const l=positions?.left,r=positions?.right;
   if(!Array.isArray(l)||!Array.isArray(r)||l.length<3||r.length<3||![...l.slice(0,3),...r.slice(0,3)].every(fini))return null;
   return dist(l,r)*1000;
 }
 /* Référence : médiane des écartements des lignes valides (st 0) de la table décompactée (ed en 1/10 mm) à ±fenetre cuts, le cut exclu. */
 function referenceVoisins(table,cut,reglage=REGLAGE){
   const g=[];
   if(table&&Number.isInteger(table.n)&&Array.isArray(table.st)&&Array.isArray(table.ed)&&Number.isInteger(cut))
     for(let i=Math.max(0,cut-reglage.fenetre);i<=Math.min(table.n-1,reglage.avantSeulement?cut-1:cut+reglage.fenetre);i++){
       if(i===cut||table.st[i]!==0)continue;
       const e=table.ed.slice(6*i,6*i+6);if(e.length<6||!e.every(fini))continue;
       g.push(Math.hypot(e[0]-e[3],e[1]-e[4],e[2]-e[5])/10);
     }
   if(g.length<reglage.voisinesMin)return {mm:reglage.gRefDefautMm,n:g.length,source:'defaut'};
   g.sort((a,b)=>a-b);const m=g.length>>1;
   return {mm:r2(g.length%2?g[m]:(g[m-1]+g[m])/2),n:g.length,source:'voisins'};
 }
 /* `valide` : le lot valide ce cut (sinon la garde n'a rien à juger). Rend { version, cut, ecartMm, referenceMm, ecartAuVoisinageMm, auraitPause, motif }. */
 function evaluer({cut=null,positions=null,table=null,valide=false,reglage={}}={}){
   const o={...REGLAGE,...reglage};
   try{
     const g=ecartementMm(positions);
     if(g===null)return {version:VERSION,cut,ecartMm:null,referenceMm:null,ecartAuVoisinageMm:null,auraitPause:false,motif:'pose-illisible'};
     const ref=referenceVoisins(table,cut,o),ecart=g-ref.mm;
     const pause=!!valide&&Math.abs(ecart)>o.seuilMm;
     return {version:VERSION,cut,ecartMm:r2(g),referenceMm:ref.mm,ecartAuVoisinageMm:r2(ecart),auraitPause:pause,
       motif:pause?`voie:${r2(ecart)}mm>${o.seuilMm}mm(${ref.source})`:(valide?'ok':'non-valide-par-le-lot')};
   }catch(e){return {version:VERSION,cut,ecartMm:null,referenceMm:null,ecartAuVoisinageMm:null,auraitPause:false,motif:'erreur:'+String(e?.message||e).slice(0,60)};}
 }
 return {VERSION,REGLAGE,ecartementMm,referenceVoisins,evaluer};
});
