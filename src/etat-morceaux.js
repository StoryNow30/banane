/* CH-059 — ÉTAT SAUVEGARDÉ EN MORCEAUX : une sauvegarde de taille bornée, quelle que soit la journée.
 *
 * Constat (06/11, ÉTABLI par l'intégrateur) : l'état réécrit à chaque événement dans `chrome.storage.local`
 * (environ 50 ms par Mo, D-089) passait de 0,39 Mo le matin à 2,1 Mo le soir. Le gros vient des listes qui
 * ne font que grossir : visites et identifiants de nuages de la session Écho, listes d'export, listes du lot.
 *
 * Ici, rien ne change en mémoire : le moteur, l'Écho, le panneau et les exports voient les mêmes listes. Seule
 * la forme ÉCRITE change. Chaque liste suivie (`CHEMINS`) est coupée en morceaux de taille fixe, rangés sous
 * leurs propres clés de `chrome.storage.local`, et remplacée dans l'état écrit par une liste VIDE et une
 * référence (`__morceaux`, dans l'objet qui la porte). Un morceau n'est réécrit que si son contenu a changé :
 * en pratique le dernier de chaque liste qui grossit. L'état et les morceaux changés partent dans LE MÊME
 * appel `set` : l'état écrit ne désigne jamais un morceau non écrit.
 *
 * Retour arrière (paquet antérieur) : il lit des listes vides, sans planter (comme `records` en D-089) ; s'il
 * y ajoute des éléments, ils sont repris à la suite des morceaux à la remise à jour. Une session ou un lot
 * neufs (autre identifiant) ne portent plus la référence : rien de l'ancien n'y est recollé.
 *
 * Module pur : aucune dépendance au navigateur ; `src/storage.js` fait les lectures et écritures. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.BananeEtatMorceaux=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION=1,PREFIXE='banane3Morceau|',REF='__morceaux';
 /* [racine, chemin dans la racine, éléments par morceau]. La racine doit porter un identifiant (`id`) : la clé
  * d'un morceau en dépend, une session ou un lot neufs n'écrasent donc jamais ceux d'avant. Éléments par
  * morceau : un morceau changé fait quelques dizaines de Ko au plus (visite résumée ≈ 0,4 Ko, identifiant ≈ 45 o). */
 const CHEMINS=[
  ['native',['visits'],64],['native',['observationPeriods'],64],['native',['cloudIds'],512],['native',['incomplete'],512],
  ['native',['exportState','exportedCloudIds'],512],['native',['exportState','releasedCloudIds'],512],
  ['manual',['records'],16],['manual',['cloudIds'],512],['manual',['sequence'],64],['manual',['incomplete'],512],
  ['batch',['processed'],64],['batch',['sequence'],64],['batch',['deferred'],64],['batch',['skipped'],64],
  ['batch',['paused'],64],['batch',['interrupted'],64],['batch',['manuallyCompleted'],64],
  /* Objet (clé → valeur) : repères vus par la mesure de qualité de l'Écho, plafonnés à 4 000 (≈ 31 o chacun). Coupé par entrées. */
  ['native',['qualityRails'],512]];
 /* Une liste, ou un objet simple vu comme la liste de ses entrées [clé, valeur] (ordre d'insertion gardé). */
 const objetSimple=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
 const elementsDe=x=>Array.isArray(x)?x:objetSimple(x)?Object.entries(x):null;
 const cleMorceau=(racine,chemin,id,i)=>`${PREFIXE}${racine}|${chemin.join('.')}|${id}|${i}`;
 const estCle=k=>typeof k==='string'&&k.startsWith(PREFIXE);
 const lire=(o,chemin)=>chemin.reduce((x,k)=>x&&typeof x==='object'?x[k]:undefined,o);
 const idValide=id=>typeof id==='string'&&id.length>0&&id.length<=128&&!id.includes('|');
 const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));

 /* Découpe SYNCHRONE (aucune attente) : l'état vivant peut être passé tel quel, il n'est jamais modifié.
  * Rend { etat, morceaux } : `etat` est une copie indépendante, listes suivies vides ; `morceaux` associe
  * chaque clé au texte JSON de son morceau (texte gardé tel quel : la comparaison et l'écriture s'en servent).
  * `connus` (facultatif) : clé → { texte, simples } de ce qui est sur disque ; `simples` rend les tranches de valeurs simples
  * calculées ici, à garder si l'écriture réussit. */
 function decouper(etat,connus=null){let simples=null;
  if(!etat||typeof etat!=='object')return {etat:clone(etat),morceaux:new Map(),simples:new Map()};
  const copie={...etat},morceaux=new Map(),racines=new Map();
  /* Une référence présente dans l'état reçu ne compte pas : seule vaut la découpe faite ici. */
  for(const racine of new Set(CHEMINS.map(c=>c[0]))){const r=etat[racine];
   if(r&&typeof r==='object'&&!Array.isArray(r)&&REF in r){const c={...r};delete c[REF];copie[racine]=c;racines.set(racine,c);}}
  for(const [racine,chemin,taille] of CHEMINS){
   const r=etat[racine];if(!r||typeof r!=='object'||Array.isArray(r)||!idValide(r.id))continue;
   const valeur=lire(r,chemin),liste=elementsDe(valeur);if(!liste||!liste.length)continue;const objet=!Array.isArray(valeur);
   /* Copie superficielle le long du chemin, la liste remplacée par une liste vide. */
   let c=racines.get(racine);if(!c){c={...r};racines.set(racine,c);copie[racine]=c;}
   let porteur=c;for(const k of chemin.slice(0,-1)){porteur[k]={...porteur[k]};porteur=porteur[k];}
   porteur[chemin.at(-1)]=objet?{}:[];
   const nb=Math.ceil(liste.length/taille);
   for(let i=0;i<nb;i++){const cle=cleMorceau(racine,chemin,r.id,i),tranche=liste.slice(i*taille,(i+1)*taille);
    /* Tranche de valeurs simples (identifiants) identique à celle déjà sur disque : son texte est repris sans le recalculer. */
    const avant=connus?.get(cle);
    if(avant&&Array.isArray(avant.simples)&&avant.simples.length===tranche.length&&tranche.every((x,j)=>x===avant.simples[j])){morceaux.set(cle,avant.texte);continue;}
    morceaux.set(cle,JSON.stringify(tranche));if(tranche.every(x=>x===null||typeof x!=='object'))(simples??=new Map()).set(cle,tranche);}
   (c[REF]??={})[chemin.join('.')]={v:VERSION,id:r.id,longueur:liste.length,morceaux:nb,taille,...(objet?{forme:'objet'}:{})};}
  return {etat:clone(copie),morceaux,simples:simples||new Map()};}

 /* Clés à lire pour recoller un état écrit. */
 function clesARelire(etat){const cles=[];
  for(const [racine,chemin] of CHEMINS){const r=etat?.[racine],ref=r?.[REF]?.[chemin.join('.')];
   if(!ref||ref.v!==VERSION||!idValide(ref.id)||ref.id!==r.id||!Number.isInteger(ref.morceaux)||ref.morceaux<0||ref.morceaux>100000)continue;
   for(let i=0;i<ref.morceaux;i++)cles.push(cleMorceau(racine,chemin,ref.id,i));}
  return cles;}

 /* Recolle en place les listes d'un état écrit, à partir des morceaux lus (`lus` : clé → texte JSON).
  * Ordre : éléments des morceaux, puis ceux qu'une version antérieure a ajoutés à la liste vide écrite.
  * Un morceau absent ou illisible est compté dans `manquants`, jamais inventé. La référence est retirée
  * de l'état en mémoire. Rend { etat, manquants, relus } (`relus` : clé → texte, pour ne pas les réécrire). */
 function recoller(etat,lus){const manquants=[],relus=new Map();
  if(!etat||typeof etat!=='object')return {etat,manquants,relus};
  for(const [racine,chemin] of CHEMINS){const r=etat[racine];if(!r||typeof r!=='object')continue;
   const ref=r[REF]?.[chemin.join('.')];if(!ref)continue;
   if(ref.v!==VERSION||ref.id!==r.id||!Number.isInteger(ref.morceaux)){manquants.push({chemin:`${racine}.${chemin.join('.')}`,raison:'reference-illisible'});continue;}
   const elements=[];
   for(let i=0;i<ref.morceaux;i++){const cle=cleMorceau(racine,chemin,ref.id,i),texte=lus?.get?lus.get(cle):lus?.[cle];
    let morceau=null;try{morceau=typeof texte==='string'?JSON.parse(texte):null;}catch{morceau=null;}
    if(!Array.isArray(morceau)){manquants.push({chemin:`${racine}.${chemin.join('.')}`,morceau:i,raison:'morceau-absent'});continue;}
    relus.set(cle,texte);elements.push(...morceau);}
   let porteur=r;for(const k of chemin.slice(0,-1)){if(!porteur[k]||typeof porteur[k]!=='object')porteur[k]={};porteur=porteur[k];}
   const enLigne=porteur[chemin.at(-1)];
   if(ref.forme==='objet')porteur[chemin.at(-1)]={...Object.fromEntries(elements.filter(e=>Array.isArray(e)&&e.length===2&&typeof e[0]==='string')),...(objetSimple(enLigne)?enLigne:{})};
   else porteur[chemin.at(-1)]=[...elements,...(Array.isArray(enLigne)?enLigne:[])];}
  for(const [racine] of CHEMINS){const r=etat[racine];if(r&&typeof r==='object'&&REF in r)delete r[REF];}
  return {etat,manquants,relus};}

 return {VERSION,PREFIXE,REF,CHEMINS,cleMorceau,estCle,decouper,clesARelire,recoller};
});
