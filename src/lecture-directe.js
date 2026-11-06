/* CH-063, piste 1 : LECTURE DIRECTE EN OMBRE des ressources de points (prototype, réglage `lectureDirecte.actif:false`).
 *
 * But : prouver, avant toute chose, que les points qu'Ariane lirait directement sont EXACTEMENT ceux qu'ESV affiche. Le module ne
 * remplace jamais la capture et ne décide rien : après une capture, il relit les ressources de points qu'ESV a demandées ELLE-MÊME
 * pour le cut courant, les décode, et compare nœud à nœud, au bit près, aux tampons des nœuds visibles de Potree. Il rend des comptes.
 *
 * Bornes (ticket CH-063 § 3) :
 *   - jamais plus de requêtes qu'ESV : une ressource n'est relue que si ESV l'a demandée depuis le début du cut, une seule fois ;
 *     plafond `maxRequetesParCut` en plus ; `cache:'force-cache'` (le cache HTTP du navigateur sert la réponse quand il la garde) ;
 *   - arrêt à la première erreur (réseau, statut ≠ 200, réponse illisible) ou lenteur (> `lenteurMs`) : plus aucune requête jusqu'au
 *     rechargement de la page ;
 *   - aucune adresse n'est rendue ni journalisée : les adresses vues restent en mémoire, le temps du cut ; aucun identifiant de projet.
 * Les adresses sont déduites à l'exécution (API de mesure des ressources, comme `src/esv-observer.js`) : aucune n'est écrite ici.
 *
 * Décodeur : seul celui de la MAQUETTE existe (`decodeurMaquette`, format JSON de `tests/esv-maquette`). Le format réel des nœuds
 * d'ESV (EPT, vu dans les chemins) n'est pas décodé ici : sans décodeur, le module ne demande rien (`sans-decodeur`). L'identité en
 * maquette ne prouve donc RIEN pour le vrai ESV ; elle prouve la mécanique et l'instrument de preuve. */
(function(racine,fabrique){const M=fabrique();if(typeof module==='object'&&module.exports)module.exports=M;else racine.BananeLectureDirecte=M;})(typeof self!=='undefined'?self:this,function(){
'use strict';
const REGLAGE_DEFAUT=Object.freeze({actif:false,maxRequetesParCut:16,lenteurMs:1000,motif:'/ept-data/'});
function reglage(v){
  if(v===undefined||v===null)return {ok:true,...REGLAGE_DEFAUT};
  if(typeof v!=='object')return {ok:false,raison:'réglage non objet',...REGLAGE_DEFAUT,actif:false};
  const r={...REGLAGE_DEFAUT,...v};
  if(typeof r.actif!=='boolean')return {ok:false,raison:'actif doit être vrai ou faux',...REGLAGE_DEFAUT,actif:false};
  if(!Number.isInteger(r.maxRequetesParCut)||r.maxRequetesParCut<1||r.maxRequetesParCut>64)return {ok:false,raison:'maxRequetesParCut hors de 1..64',...REGLAGE_DEFAUT,actif:false};
  if(!Number.isFinite(r.lenteurMs)||r.lenteurMs<50||r.lenteurMs>10000)return {ok:false,raison:'lenteurMs hors de 50..10000',...REGLAGE_DEFAUT,actif:false};
  if(typeof r.motif!=='string'||!r.motif)return {ok:false,raison:'motif vide',...REGLAGE_DEFAUT,actif:false};
  return {ok:true,...r};
}
/* Décodeur de la maquette : mêmes tampons Float32 que `noeud()` de tests/esv-maquette/esv-maquette.js (positions relatives au coin de
 * la boîte, arrondi au millimètre inférieur). */
function decodeurMaquette(corps){
  const N=Array.isArray(corps?.noeuds)?corps.noeuds:null;if(!N)throw Error('réponse illisible');
  return N.map(n=>{const xs=n.positions;if(!Array.isArray(xs)||xs.length%3)throw Error('nœud illisible');
    const min=[Infinity,Infinity,Infinity];for(let i=0;i<xs.length;i+=3)for(let k=0;k<3;k++)min[k]=Math.min(min[k],xs[i+k]);
    const coin=min.map(v=>Math.floor(v*1000)/1000);return Float32Array.from(xs,(v,i)=>v-coin[i%3]);});
}
const memes=(a,b)=>{if(!a||!b||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!Object.is(a[i],b[i]))return false;return true;};
/* Comparaison nœud à nœud : un nœud relu est « identique » s'il existe un nœud visible non encore apparié au tampon de positions égal au
 * bit près. Manquants = nœuds visibles sans pendant relu ; surplus = nœuds relus qu'ESV n'affiche pas. */
function comparerNoeuds(relus,visibles){
  const libres=visibles.map(v=>v),out={noeudsRelus:relus.length,noeudsVisibles:visibles.length,identiques:0,surplus:0,manquants:0,pointsRelus:0};
  for(const r of relus){out.pointsRelus+=r.length/3;const i=libres.findIndex(v=>v&&memes(r,v));if(i>=0){out.identiques++;libres[i]=null;}else out.surplus++;}
  out.manquants=libres.filter(Boolean).length;out.identite=out.noeudsRelus>0&&out.surplus===0&&out.manquants===0;
  return out;
}
const tamponsVisibles=viewer=>{const out=[];for(const pc of viewer?.scene?.pointclouds||[])for(const n of pc?.visibleNodes||[]){
  const a=n?.sceneNode?.geometry?.attributes?.position?.array;if(a&&typeof a.length==='number')out.push(a);}return out;};

const DECODEURS={maquette:decodeurMaquette};
function creer({fetch,maintenant=()=>Date.now(),reglage:R0,decodeur=null}={}){
  const R=reglage(R0),vues=[],propres=new Map();let arret=null;
  /* Les relectures d'Ariane passent elles aussi par l'API de mesure : chaque adresse relue est comptée ici et l'entrée suivante de cette
   * adresse est ignorée une fois. Sinon une relecture compterait comme une requête d'ESV au cut suivant (emballement). */
  /* Entrées de l'API de mesure des ressources (PerformanceObserver) : seules les ressources de points sont gardées, en mémoire, bornées. */
  function observer(entries){if(!R.actif||arret)return;
    for(const e of entries||[]){const u=String(e?.name||'');if(!u.includes(R.motif))continue;
      const k=propres.get(u)||0;if(k>0){if(k===1)propres.delete(u);else propres.set(u,k-1);continue;}
      vues.push({u,t:Number(e.startTime)||0,d:Number(e.duration)||null});}
    while(vues.length>256)vues.shift();}
  async function lireEnOmbre({viewer,depuisMs=0}={}){
    if(!R.actif)return {etat:'coupe'};
    if(arret)return {etat:'arrete',motif:arret};
    if(typeof decodeur!=='function')return {etat:'sans-decodeur'};
    /* Les nœuds affichés sont pris AVANT toute attente : ceux de la capture, pas ceux qu'ESV chargera ensuite. */
    const visibles=tamponsVisibles(viewer).map(a=>Float32Array.from(a));
    const duCut=vues.filter(v=>v.t>=depuisMs),uniques=[...new Set(duCut.map(v=>v.u))];
    vues.length=0;/* les adresses ne survivent pas au cut */
    const aLire=uniques.slice(0,R.maxRequetesParCut),relus=[],debut=maintenant();let requetes=0,dureeMax=0;
    for(const u of aLire){const t0=maintenant();let corps;requetes++;propres.set(u,(propres.get(u)||0)+1);while(propres.size>256)propres.delete(propres.keys().next().value);
      try{const rep=await fetch(u,{cache:'force-cache',credentials:'same-origin',method:'GET'});
        const d=maintenant()-t0;dureeMax=Math.max(dureeMax,d);
        if(!rep||rep.status!==200){arret='erreur-http';break;}
        if(d>R.lenteurMs){arret='lenteur';break;}
        corps=await rep.json();}
      catch{arret=arret||'erreur-reseau';break;}
      try{relus.push(...decodeur(corps));}catch{arret='reponse-illisible';break;}}
    const base={requetesEsv:duCut.length,ressourcesEsv:uniques.length,requetes,plafond:uniques.length>aLire.length,dureeMs:maintenant()-debut,dureeMaxMs:dureeMax};
    if(arret)return {etat:'arrete',motif:arret,...base};
    return {etat:'fini',...base,...comparerNoeuds(relus,visibles)};
  }
  return {observer,lireEnOmbre,etat:()=>({actif:R.actif,reglageOk:R.ok,arret,adressesRetenues:vues.length})};
}
return {REGLAGE_DEFAUT,reglage,decodeurMaquette,DECODEURS,comparerNoeuds,creer};
});
