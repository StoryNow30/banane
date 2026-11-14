/* CH-071 : façades de src/file-parties.js, src/file-prioritaire.js, src/serie-captures-vides.js et src/raison-correction.js sur le
 * cœur WASM (numéros 300 à 349, crate ariane-file), MÊME API que les modules.
 *   const F=ArianeFacadeFile.creer(coeur,{parties:BananeFileParties,prioritaire:ArianeFilePrioritaire,serie:BananeSerieCapturesVides,raison:BananeRaisonCorrection})
 *   F.parties.transition(etat,ev), F.raison.appuyer(etat,frappe), … ; F.compteurs()
 * Le cœur ne lève jamais l'exception du JS : sur toute entrée qu'il ne sait pas reproduire au bit près (HorsDomaine), ou que la
 * VBA ne transporte pas (TypeError « VBA : … » : Set, fonction, instance de classe…), la façade rappelle le JS d'origine.
 * Ce que la façade fait à la place du cœur, parce que la VBA ne le porte pas :
 *  - IDENTITÉ : un état rendu tel quel par le JS (`ignore`, refus, file inactive) est l'objet reçu (le cœur dit `meme`) ;
 *    `ordonner(…).taux` est l'objet de taux reçu ; la raison posée est l'objet rendu ; la série finie poussée dans `etat.series`
 *    est l'objet rendu par `finir` et le champ `ferme` d'`appuyer` ;
 *  - ÉCRITURES EN PLACE : `observer`, `finir`, `appuyer`, `heriter` rendent leur journal d'écritures, appliqué ici dans l'ordre
 *    du JS (une clé neuve s'ajoute à la même place) ; `appliquer` et `effacer` posent la raison sur la visite ;
 *  - `Object.freeze` du réglage de la série ; `Date.parse` des intentions (derniereValidation) ; les chaînes du Set `jugesDeja`.
 * Un objet à écrire qui n'est pas extensible (gelé, scellé) : repli JS (il lèverait là où le JS lève). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArianeFacadeFile=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ecrivable=o=>o!==null&&typeof o==='object'&&Object.isExtensible(o);
 function creer(coeur,M){
  const n={coeur:0,repliHorsDomaine:0,repliFormat:0,repliEcriture:0};
  /* `apres` convertit la réponse du cœur (jamais appliqué au repli). */
  function appeler(f,entree,js,apres){
   let v;
   try{v=coeur.appeler(f,entree);}
   catch(e){if(e&&e.name==='HorsDomaine'){n.repliHorsDomaine++;return js();}if(e instanceof TypeError&&/^VBA : /.test(e.message)){n.repliFormat++;return js();}throw e;}
   n.coeur++;return apres?apres(v):v;
  }
  const direct=(f,js)=>(...a)=>appeler(f,{a},()=>js(...a));
  /* Écritures en place : [0,k,v] etat[k]=v ; [1,k,v] etat.collante[k]=v ; [2,v] etat.series.push(v). Rend l'objet poussé. */
  function ecrire(etat,ops){let pousse=null;for(const o of ops){if(o[0]===0)etat[o[1]]=o[2];else if(o[0]===1)etat.collante[o[1]]=o[2];else{pousse=o[1];etat.series.push(pousse);}}return pousse;}
  const etatEcrivable=e=>ecrivable(e)&&(e.collante===null||typeof e.collante!=='object'||ecrivable(e.collante))&&(!Array.isArray(e.series)||ecrivable(e.series));
  function enPlace(f,js,alias){return (etat,...a)=>{
   if(!etatEcrivable(etat)){n.repliEcriture++;return js(etat,...a);}
   return appeler(f,{a:[etat,...a]},()=>js(etat,...a),v=>{const p=ecrire(etat,v.ops);
    if(v.alias===1)return p;if(v.alias===2){v.r.ferme=p;}return v.r;});};}

  const P=M.parties,FP={...P};
  for(const [k,f] of [['planifier',300],['repriseDe',303],['completerBilan',304],['relire',305],['classerLot',306],['registreAjouter',307],
   ['entreeRegistre',308],['alertes',309],['vue',310],['actif',311],['terminal',312]])FP[k]=direct(f,P[k]);
  const avecEtat=(etat,v)=>v.meme?{etat,...v.r}:v.r;
  FP.transition=(etat,ev)=>appeler(301,{a:[etat,ev]},()=>P.transition(etat,ev),v=>avecEtat(etat,v));
  FP.reprise=(etat,...a)=>appeler(302,{a:[etat,...a]},()=>P.reprise(etat,...a),v=>avecEtat(etat,v));

  const Q=M.prioritaire,FQ={...Q};
  for(const [k,f] of [['classe',315],['apprendreTaux',316],['plages',318]])FQ[k]=direct(f,Q[k]);
  FQ.ordonner=(candidats,options)=>{const js=()=>options===undefined?Q.ordonner(candidats):Q.ordonner(candidats,options);
   if(options!==undefined&&(options===null||typeof options!=='object')){n.repliHorsDomaine++;return js();}
   const o=options===undefined?{}:options,j=o.jugesDeja,T=o.taux||Q.TAUX_DEFAUT;
   const juges=j instanceof Set?[...j].filter(s=>typeof s==='string'):[];
   return appeler(317,{a:[candidats,{taux:o.taux,plancherParMin:o.plancherParMin,critere:o.critere,ordre:o.ordre}],juges},js,v=>{v.taux=T;return v;});};

  const S=M.serie,FS={...S};
  FS.reglage=(...a)=>appeler(320,{a},()=>S.reglage(...a),v=>Object.freeze(v));
  FS.creer=(...a)=>appeler(321,{a},()=>S.creer(...a),v=>{Object.freeze(v.reglage);return v;});
  FS.observer=(e,...a)=>{if(!ecrivable(e)){n.repliEcriture++;return S.observer(e,...a);}
   return appeler(322,{a:[e,...a]},()=>S.observer(e,...a),v=>{ecrire(e,v.ops);return v.r;});};
  FS.bilan=direct(323,S.bilan);

  const R=M.raison,FR={...R};
  for(const [k,f] of [['lireFrappe',330],['estTouchePossible',331],['autreGeste',332],['delaiDeGrace',333],['nouvelEtat',335],['resumeSeries',339],['vue',342]])FR[k]=direct(f,R[k]);
  FR.derniereValidation=(visite,frappeMs)=>{const js=()=>R.derniereValidation(visite,frappeMs);let temps;
   try{temps=[];for(const i of visite?.operatorIntents||[])temps.push(i?.intent==='VALIDATE'?Date.parse(i.observedAt||''):null);}catch(e){n.repliHorsDomaine++;return js();}
   return appeler(334,{temps,frappe:frappeMs},js);};
  FR.finir=enPlace(336,R.finir,1);FR.appuyer=enPlace(337,R.appuyer,2);FR.heriter=enPlace(338,R.heriter,0);
  const poserRaison=(f,js)=>(visite,x)=>{if(!ecrivable(visite)){n.repliEcriture++;return js(visite,x);}
   return appeler(f,{a:[visite.raisonCorrection,x]},()=>js(visite,x),v=>{if(v!==null)visite.raisonCorrection=v;return v;});};
  FR.appliquer=poserRaison(340,R.appliquer);FR.effacer=poserRaison(341,R.effacer);

  return {parties:Object.freeze(FP),prioritaire:FQ,serie:FS,raison:FR,compteurs:()=>({...n})};
 }
 return {creer};
});
