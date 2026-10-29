(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./gestes-vue.js'));
  else root.BananeDeplacementVue=factory(root.BananeGestesVue);
})(typeof globalThis!=='undefined'?globalThis:this,function(G){
 'use strict';
 /* DÉPLACEMENT DE LA VUE (5.0, CH-018 ; D-249, D-260 ; suite de chantiers/CH-007/propositions/deplacement-vue.patch).
  *
  * Mesuré (lot du 28/10, partie 20) : 45 coups de molette sur 45 laissent la caméra immobile, 19 déplacements de vue sur 19 refusés
  * `pre-vol:camera-immobile`. On ne sait pas encore quel geste ESV prend ; l'opérateur le désignera par un relevé de l'Écho. D'ici là,
  * ce module rend le geste RÉGLABLE, sans rien allumer :
  *   molette            : crans de `wheel` (src/gestes-vue.js `sequenceMolette`), preuve = la taille du pixel a changé (dézoom) ;
  *   clic-droit         : glisser au bouton droit avec `contextmenu` (`sequenceClicDroit`), preuve = la caméra s'est déplacée ;
  *   glisse-synthetique : glisser au bouton gauche (`sequenceGlisser`, le repli du patch CH-007), même preuve.
  * ÉTEINT PAR DÉFAUT (`actif:false`) : l'adaptateur n'appelle rien tant qu'un réglage ne l'allume pas.
  *
  * Règle de preuve : l'ENVOI d'un geste ne prouve rien. Un succès est un mouvement MESURÉ de la caméra (lue avant, relue immobile
  * après) au-dessus d'un seuil ; sinon la tentative compte comme « immobile », et l'on réessaie dans la limite de `tentativesMax`
  * (jamais plus que PLAFOND_TENTATIVES). Un mouvement dans le mauvais sens arrête tout de suite. Aucun `click` n'est émis, jamais :
  * un clic dans la vue d'ESV pose le rail courant (D-088).
  *
  * Le journal résume, par geste, les tentatives, mouvements, immobiles et sens inversés, avec le déplacement et le zoom médians :
  * c'est lui que le prochain lot lira pour dire quel geste marche. Aucune position ni coordonnée absolue ; rien n'est horodaté ici.
  * Aucune horloge ni aucun hasard implicites : `alea`, `emettre`, `immobile`, `lireCamera` viennent de l'appelant. */
 const VERSION='deplacement-vue-v1';
 const GESTES=Object.freeze(['molette','clic-droit','glisse-synthetique']);
 const PLAFOND_TENTATIVES=4;
 const DEFAUTS=Object.freeze({actif:false,geste:'molette',tentativesMax:2,mouvementMinMm:0.5,zoomMin:0.005});
 const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
 const r3=v=>Number.isFinite(v)?Math.round(v*1000)/1000:null;
 const med=a=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),i=b.length>>1;return b.length%2?b[i]:(b[i-1]+b[i])/2;};

 /* Réglages : `S` = `settings.deplacerVue.deplacement` (facultatif). Un geste inconnu laisse le module éteint et le dit. */
 function reglages(S){
   const s=S&&typeof S==='object'?S:{},r={...DEFAUTS,...s};
   const geste=GESTES.includes(r.geste)?r.geste:null,erreur=geste?null:'geste-inconnu';
   const t=Number.isFinite(r.tentativesMax)?Math.floor(r.tentativesMax):DEFAUTS.tentativesMax;
   return {...r,actif:r.actif===true&&!erreur,geste:geste||DEFAUTS.geste,erreur,tentativesMax:Math.max(1,Math.min(PLAFOND_TENTATIVES,t))};
 }

 /* ------------------------------------------------------------------ journal */
 const vide=()=>({tentatives:0,mouvements:0,immobiles:0,sensInverses:0,illisibles:0,deplacements:[],zooms:[]});
 class Journal{
   constructor(){this.g={};for(const k of GESTES)this.g[k]=vide();}
   /* `e` : { resultat: 'mouvement'|'immobile'|'sens-inverse'|'illisible', deplacementMm?, zoom? }. */
   noter(geste,e){const j=this.g[geste];if(!j)return;
     if(e.resultat==='illisible'){j.illisibles++;return;}
     j.tentatives++;
     if(e.resultat==='mouvement')j.mouvements++;else if(e.resultat==='immobile')j.immobiles++;else if(e.resultat==='sens-inverse')j.sensInverses++;
     if(e.resultat!=='immobile'){if(Number.isFinite(e.deplacementMm))j.deplacements.push(e.deplacementMm);if(Number.isFinite(e.zoom))j.zooms.push(e.zoom);}}
   resume(){const gestes={};let meilleur=null,taux=0;
     for(const k of GESTES){const j=this.g[k],t=j.tentatives?r3(j.mouvements/j.tentatives):0;
       gestes[k]={tentatives:j.tentatives,mouvements:j.mouvements,immobiles:j.immobiles,sensInverses:j.sensInverses,illisibles:j.illisibles,taux:t,
         deplacementMedianMm:r1(med(j.deplacements)),zoomMedian:r3(med(j.zooms))};
       if(j.tentatives&&t>taux){taux=t;meilleur=k;}}
     return {version:VERSION,gestes,meilleur};}
 }

 /* ------------------------------------------------------------------ geste */
 /* `plan` : { x, y, crans, sens } pour la molette (point du pointeur, crans, +1 = dézoom) ; { x0, y0, x1, y1 } pour les glissers. */
 function sequence(geste,plan,{emission={},alea}={}){
   if(geste==='molette')return G.sequenceMolette({x:plan.x,y:plan.y,crans:plan.crans,sens:plan.sens,reglages:emission.molette,alea});
   const a={x0:plan.x0,y0:plan.y0,x1:plan.x1,y1:plan.y1,reglages:emission.glisser,alea};
   return geste==='clic-droit'?G.sequenceClicDroit(a):G.sequenceGlisser(a);
 }
 /* Ce que la caméra a fait entre `avant` et `apres`, jugé pour `geste`. Rend { resultat, deplacementMm, zoom, type }. */
 function juger(geste,plan,avant,apres,r){
   const e=G.ecartCamera(avant,apres);if(!e)return {resultat:'illisible'};
   const dep=Math.hypot(e.deplacementMm[0]||0,e.deplacementMm[1]||0),zoom=e.zoom;
   if(geste==='molette'){
     if(!Number.isFinite(zoom)||Math.abs(zoom-1)<r.zoomMin)return {resultat:'immobile',deplacementMm:r1(dep),zoom};
     const dezoomVoulu=(plan.sens||1)>=0;
     return {resultat:(zoom>1)===dezoomVoulu?'mouvement':'sens-inverse',type:'zoom',deplacementMm:r1(dep),zoom};}
   if(dep<r.mouvementMinMm)return {resultat:'immobile',deplacementMm:r1(dep),zoom};
   /* Un fond qui suit la souris : la caméra part dans le sens contraire du glisser (droite, haut ; le y de l'écran descend). */
   const dx=plan.x1-plan.x0,dy=plan.y1-plan.y0,scal=-dx*e.deplacementMm[0]+dy*e.deplacementMm[1];
   return {resultat:scal<0?'sens-inverse':'mouvement',type:'deplacement',deplacementMm:r1(dep),zoom};
 }
 /* Un déplacement : émet le geste choisi, relit la caméra immobile, juge ; réessaie tant qu'elle n'a pas bougé et que le plafond
  * n'est pas atteint. Ce qui est levé par `emettre` (annulation, cut changé) traverse. Rend { ok, geste, tentatives, raison, preuve }. */
 async function deplacer({geste,plan,lireCamera,emettre,immobile,journal=null,reglages:R=null,tentativesMax,emission,alea}){
   const r=R||reglages({}),n=Math.max(1,Math.min(PLAFOND_TENTATIVES,Math.floor(tentativesMax??r.tentativesMax)||1)),res={ok:false,geste,tentatives:0,raison:null,preuve:null};
   if(!GESTES.includes(geste)){res.raison='geste-inconnu';return res;}
   const note=(e)=>journal&&journal.noter(geste,e);
   for(let i=0;i<n;i++){
     const avant=lireCamera();if(!avant){note({resultat:'illisible'});res.raison='camera-illisible';return res;}
     await emettre(sequence(geste,plan,{emission,alea}));
     const apres=await immobile();res.tentatives++;
     if(!apres){note({resultat:'illisible'});res.raison='camera-illisible';return res;}
     const j=juger(geste,plan,avant,apres,r);
     if(j.resultat==='illisible'){note(j);res.raison='camera-illisible';return res;}
     note(j);
     if(j.resultat==='mouvement'){res.ok=true;res.preuve={type:j.type,zoom:j.zoom,deplacementMm:j.deplacementMm};return res;}
     if(j.resultat==='sens-inverse'){res.raison='sens-inverse';res.preuve={type:j.type,zoom:j.zoom,deplacementMm:j.deplacementMm};return res;}
   }
   res.raison='camera-immobile';return res;
 }

 return {VERSION,GESTES,PLAFOND_TENTATIVES,DEFAUTS,reglages,Journal,sequence,juger,deplacer};
});
