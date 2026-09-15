(function(root,factory){const api=factory();
 if(typeof module==='object')module.exports=api;else root.BananeLodSignature=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* Signature du niveau de détail chargé dans ESV.
  *
  * Ce que cette fonction décide : si le nuage a fini de se charger, donc s'il
  * est temps de le lire. Une signature qui se répéterait alors que la scène a
  * changé ferait lire un nuage incomplet — ce n'est pas une métrique, c'est un
  * verrou de qualité.
  *
  * Extraite de `src/adapter-page.js` pour être testable seule, et parce qu'une
  * fonction dont une collision coûterait une lecture tronquée doit pouvoir
  * s'auditer sans dérouler tout l'adaptateur.
  *
  * POURQUOI PAS `JSON.stringify` + tri. L'ancienne version sérialisait chaque
  * nœud (jusqu'à 512), triait les chaînes obtenues, puis sérialisait à nouveau
  * l'ensemble — à chaque sondage, toutes les 80 ms, pendant les 2,4 s d'attente
  * par rail mesurées sur le terrain. Ce travail consommait le temps processeur
  * dont ESV a besoin pour se stabiliser, donc allongeait ce qu'il attendait.
  *
  * POURQUOI PAS UNE SIMPLE SOMME. Une somme commutative seule confond trop
  * facilement deux ensembles différents. On combine donc QUATRE grandeurs
  * indépendantes :
  *   — le nombre de nœuds, qui sépare tout ajout ou retrait ;
  *   — la SOMME des empreintes, sensible aux valeurs ;
  *   — le OU EXCLUSIF des empreintes, sensible différemment aux mêmes valeurs ;
  *   — l'état des nuages, sérialisé tel quel car il est petit.
  * Pour qu'une collision passe, il faudrait qu'un remplacement de nœuds
  * conserve à la fois le compte, la somme et le ou-exclusif. Les deux
  * combinateurs sont indépendants : un échange de valeurs qui préserve la somme
  * change presque toujours le ou-exclusif, et réciproquement.
  *
  * Commutative par construction, comme l'était le tri qu'elle remplace : ESV
  * peut réordonner ses nœuds sans que cela signifie un chargement en cours. */
 const MASQUE=0xffffffffffffffffn;
 /* FNV-1a 32 bits : rapide, bien mélangé, sans dépendance. */
 function empreinte(texte){
  let h=2166136261>>>0;
  for(let i=0;i<texte.length;i++){h^=texte.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return BigInt(h>>>0);
 }
 /* Le jeton doit contenir TOUT ce dont un changement doit invalider la
  * stabilité : identité des objets, version des tampons, pose monde, plage de
  * dessin, nombre de points. Un champ oublié ici serait un chargement invisible. */
 function jeton(n,id){
  return id(n.obj)+'|'+id(n.geometry)+'|'+id(n.position)+'|'
    +id(n.position?.array||n.position?.data?.array)+'|'
    +(n.position?.version??'')+'|'+(n.position?.data?.version??'')+'|'
    +(n.attribute?.count??'')+'|'+n.world+'|'+id(n.geometry?.index)+'|'
    +JSON.stringify(n.drawRange??null);
 }
 function signature(inventaire,id){
  const noeuds=inventaire?.nodes||[];
  let somme=0n,ouExclusif=0n;
  for(const n of noeuds){const h=empreinte(jeton(n,id));somme=(somme+h)&MASQUE;ouExclusif^=h;}
  return {count:noeuds.length,
    value:noeuds.length+':'+somme+':'+ouExclusif+':'+JSON.stringify(inventaire?.clouds??null)};
 }
 return {signature,empreinte,jeton};
});
