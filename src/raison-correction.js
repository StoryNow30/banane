(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.BananeRaisonCorrection=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* RAISON DE LA CORRECTION (RM-11, 4.9.5 test 9 ; fiches/RM11_RAISON_CORRECTION.md). MODULE PUR : ni DOM, ni session, ni horloge, ni stockage.
  *
  * Écho est passif. Quand Mic le décide, il tape un chiffre pour dire POURQUOI il corrige un cut : 1 rail voisin, 2 ADV, 3 PN, 4 nuage diffus
  * ou pauvre, 5 hauteur seulement, 6 autre ; 0 efface. La touche est lue par son code physique (rangée du haut ou pavé numérique). Rien n'est
  * retenu, rien n'est envoyé à ESV : ce module ne fait que LIRE une frappe déjà observée et tenir un petit état (la raison « collante »).
  *
  * Une raison est une INFORMATION HUMAINE : elle va du côté de l'ÉTIQUETTE (la visite Écho), jamais dans les traits. Ce module n'est donc lu
  * que par `src/native-session.js` (consignation), par `panel.js` (affichage) et par les outils d'analyse (étiquette). Aucun autre fichier de
  * `src/` ne le charge (essai : tests/raison-fuite.test.cjs). Absent veut dire INCONNU, jamais « bon ».
  *
  * États : l'état de séance (`nouvelEtat`) porte la raison collante en cours, la dernière frappe (pour le double appui) et les séries finies.
  * Les fonctions qui le changent le modifient en place (il est petit et sérialisable) et rendent l'effet à consigner sur la visite. */
 const FORMAT='ariane-raison-v1';
 const CATALOGUE=Object.freeze([
  Object.freeze({touche:'1',code:'rail-voisin',libelle:'Rail voisin'}),
  Object.freeze({touche:'2',code:'adv',libelle:'ADV'}),
  Object.freeze({touche:'3',code:'pn',libelle:'PN'}),
  Object.freeze({touche:'4',code:'nuage-pauvre',libelle:'Nuage diffus ou pauvre'}),
  Object.freeze({touche:'5',code:'hauteur',libelle:'Hauteur seulement'}),
  Object.freeze({touche:'6',code:'autre',libelle:'Autre'})]);
 const CODES=Object.freeze(CATALOGUE.map(c=>c.code));
 const LIBELLES=Object.freeze(Object.fromEntries(CATALOGUE.map(c=>[c.code,c.libelle])));
 /* Tables de touches. `chiffres` (défaut) : rangée du haut ou pavé, sans Ctrl, Alt ni Meta (Maj toléré, Mic le tient déjà pour Maj+Espace).
  * Replis, si ESV réagit à un chiffre seul : `alt-chiffres` (Alt tenue, rangée du haut ou pavé) puis `pave` (pavé numérique seul). */
 const TABLES=Object.freeze(['chiffres','alt-chiffres','pave']);
 const REGLAGE_DEFAUT=Object.freeze({actif:false,touches:'chiffres',graceMs:500,doubleAppuiMs:600,sautCuts:30,rappelCollanteCuts:40});
 const CAUSES=Object.freeze(['touche-0','autre-raison','changement-partie','saut','pause','fin-seance']);
 const HISTORIQUE_MAX=6,BANDE=24;
 const MODIFICATEURS=/^(Shift|Control|Alt|Meta)(Left|Right)?$|^(CapsLock|NumLock|ScrollLock|AltGraph|OS)$/;
 const NUMERO=/^(?:Digit|Numpad)([0-6])$/;

 /* Lecture d'une frappe observée (`operator-event` : type, code, modificateurs, repeat, editable). Rend `{code}` (une raison), `{efface:true}`
  * (le 0), ou null : une autre touche, une touche tenue, un champ de texte, un relâchement, une table inconnue. */
 function lireFrappe(ev,touches){
  const table=touches===undefined?'chiffres':touches;
  if(!ev||typeof ev!=='object'||!TABLES.includes(table)||ev.type!=='keydown'||ev.editable===true||ev.repeat===true)return null;
  const m=typeof ev.code==='string'?NUMERO.exec(ev.code):null;if(!m)return null;
  if(ev.ctrlKey||ev.metaKey)return null;
  if(table==='chiffres'&&ev.altKey)return null;
  if(table==='alt-chiffres'&&!ev.altKey)return null;
  if(table==='pave'&&(ev.altKey||!ev.code.startsWith('Numpad')))return null;
  return m[1]==='0'?{efface:true}:{code:CODES[Number(m[1])-1]};}
 /* Un code de touche qui peut être une touche de raison dans l'une des tables (chiffres 0 à 6) : jamais compté comme « autre geste ». */
 const estTouchePossible=code=>typeof code==='string'&&NUMERO.test(code);
 /* « Avant tout autre geste » (règle du délai de grâce) : parmi les événements déjà vus sur la visite, y a-t-il un geste qui n'est NI une touche de
  * raison, NI un relâchement (les touches de la validation se relâchent sur le cut suivant), NI un modificateur seul, NI une saisie dans un champ ? */
 function autreGeste(evenements){
  for(const ev of evenements||[]){if(!ev||ev.editable===true)continue;
   if(!['keydown','pointerdown','mousedown','click'].includes(ev.type))continue;
   if(typeof ev.code==='string'&&(MODIFICATEURS.test(ev.code)||estTouchePossible(ev.code)))continue;
   return true;}
  return false;}

 /* Délai de grâce : la frappe tombe-t-elle dans les `graceMs` qui suivent la validation (`validationMs` et `frappeMs`, en millisecondes) ?
  * Rend le délai en ms (entier, de 0 à graceMs), sinon null. */
 function delaiDeGrace(validationMs,frappeMs,graceMs){
  if(!Number.isFinite(validationMs)||!Number.isFinite(frappeMs))return null;const d=frappeMs-validationMs;
  return d>=0&&d<=graceMs?Math.round(d):null;}
 /* Instant (ms) de la dernière validation de la visite qui précède (ou égale) la frappe ; NaN s'il n'y en a pas. */
 function derniereValidation(visite,frappeMs){let dernier=NaN;
  for(const i of visite?.operatorIntents||[]){if(i?.intent!=='VALIDATE')continue;const t=Date.parse(i.observedAt||'');if(Number.isFinite(t)&&t<=frappeMs&&!(t<dernier))dernier=t;}
  return dernier;}

 /* ---- état de séance ---- */
 function nouvelEtat(touches){return {format:FORMAT,actif:true,touches:TABLES.includes(touches)?touches:'chiffres',collante:null,derniere:null,serieSuivante:1,series:[],poses:0};}
 const resumeDe=(c,finPar)=>({serie:c.serie,code:c.code,partie:c.partie,cutDebut:c.cutDebut,cutFin:c.cutFin,nCuts:c.nCuts,finPar});
 function fermer(etat,cause){const c=etat?.collante;if(!c)return null;const fin=resumeDe(c,cause);etat.series.push(fin);etat.collante=null;return fin;}
 /* Fin de séance, pause : ferme la série en cours, une seule fois. */
 function finir(etat,cause){if(!etat||!CAUSES.includes(cause))return null;return fermer(etat,cause);}

 /* Une frappe de raison sur le cut visé. `frappe` : { code | efface:true, cutKey, part, cut, at (ms), poseeA (ISO), eventSeq }.
  * Effet rendu : { type:'pose', code, source:'touche', serie, ouvre, ferme } ou { type:'efface', ferme }.
  *  - un appui : la raison de ce cut seul (elle passe avant la collante pour ce cut) ;
  *  - deux appuis sur la même touche en `doubleAppuiMs` sur le même cut : une série collante s'ouvre (une autre collante en cours est finie, « autre-raison ») ;
  *  - 0 : efface la raison du cut et finit la collante (« touche-0 »). */
 function appuyer(etat,frappe,reglage){
  const r=reglage||REGLAGE_DEFAUT;
  if(frappe.efface){etat.derniere=null;return {type:'efface',ferme:fermer(etat,'touche-0')};}
  const d=etat.derniere,double=!!d&&d.code===frappe.code&&d.cutKey===frappe.cutKey&&frappe.at-d.at>=0&&frappe.at-d.at<=r.doubleAppuiMs;
  etat.poses=(etat.poses||0)+1;
  if(!double){etat.derniere={code:frappe.code,cutKey:frappe.cutKey,at:frappe.at};
   return {type:'pose',code:frappe.code,source:'touche',serie:null,ouvre:false,ferme:null};}
  etat.derniere=null;
  if(etat.collante&&etat.collante.code===frappe.code)return {type:'pose',code:frappe.code,source:'touche',serie:etat.collante.serie,ouvre:false,ferme:null};
  const ferme=fermer(etat,'autre-raison'),serie=etat.serieSuivante++;
  etat.collante={serie,code:frappe.code,partie:frappe.part??null,cutDebut:frappe.cut??null,cutFin:frappe.cut??null,dernierCut:frappe.cut??null,nCuts:1,eventSeq:frappe.eventSeq??null,ouverteA:frappe.poseeA??null};
  return {type:'pose',code:frappe.code,source:'touche',serie,ouvre:true,ferme};}

 /* À l'ouverture d'une visite : la raison que la collante en cours lui donne (source « collante »), ou null. La série finit si la partie change
  * ou si le cut est à plus de `sautCuts` cuts du précédent. */
 function heriter(etat,identity,reglage){
  const c=etat?.collante;if(!c)return null;const r=reglage||REGLAGE_DEFAUT,part=identity?.part,cut=identity?.cut;
  if(part!==c.partie){fermer(etat,'changement-partie');return null;}
  if(!Number.isInteger(cut)||Math.abs(cut-c.dernierCut)>r.sautCuts){fermer(etat,'saut');return null;}
  if(cut!==c.dernierCut)c.nCuts++;
  c.dernierCut=cut;c.cutFin=Math.max(c.cutFin,cut);c.cutDebut=Math.min(c.cutDebut,cut);
  return {code:c.code,source:'collante',serie:c.serie,eventSeq:c.eventSeq};}

 /* Séries pour l'en-tête de l'export : les finies, puis celle qui est encore ouverte (finPar null). */
 function resumeSeries(etat){if(!etat)return [];return [...etat.series.map(s=>({...s})),...(etat.collante?[resumeDe(etat.collante,null)]:[])];}

 /* ---- raison portée par la visite ---- */
 const instantaneDe=a=>({code:a.code,source:a.source,poseeA:a.poseeA});
 /* Pose (ou remplace) la raison de la visite. L'ancienne raison passe dans `historique` (6 changements au plus). */
 function appliquer(visite,raison){
  const avant=visite.raisonCorrection,historique=avant?[...(avant.historique||[]),instantaneDe(avant)].slice(-HISTORIQUE_MAX):[];
  visite.raisonCorrection={format:FORMAT,code:raison.code,source:raison.source,serie:raison.serie??null,poseeA:raison.poseeA??null,eventSeq:raison.eventSeq??null,
   apresValidationMs:Number.isFinite(raison.apresValidationMs)?raison.apresValidationMs:null,historique};
  return visite.raisonCorrection;}
 /* Le 0 : la raison de la visite devient « aucune » (code nul = inconnu). Une visite qui n'en avait pas n'en reçoit pas. */
 function effacer(visite,detail){
  if(!visite.raisonCorrection)return null;
  return appliquer(visite,{code:null,source:'touche',serie:null,poseeA:detail?.poseeA??null,eventSeq:detail?.eventSeq??null,apresValidationMs:detail?.apresValidationMs??null});}

 /* ---- vue du panneau ---- */
 function vue(etat,visites,reglage){
  if(!etat||etat.actif!==true)return {actif:false};
  const c=etat.collante,liste=Array.isArray(visites)?visites.slice(-BANDE):[];
  const bande=liste.map(v=>({cut:v.identity?.cut??null,code:CODES.includes(v.raison)?v.raison:null})),avecRaison=bande.filter(b=>b.code).length;
  return {actif:true,touches:etat.touches,
   collante:c?{code:c.code,libelle:LIBELLES[c.code]||c.code,serie:c.serie,nCuts:c.nCuts,depuis:c.cutDebut}:null,
   rappel:!!c&&c.nCuts>=(reglage||REGLAGE_DEFAUT).rappelCollanteCuts,bande,couverture:{visites:bande.length,avecRaison},poses:etat.poses||0,series:etat.series.length};}

 return {FORMAT,CATALOGUE,CODES,LIBELLES,TABLES,CAUSES,REGLAGE_DEFAUT,lireFrappe,estTouchePossible,autreGeste,delaiDeGrace,derniereValidation,
  nouvelEtat,finir,appuyer,heriter,resumeSeries,appliquer,effacer,vue};
});
