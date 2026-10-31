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

 /* ------------------------------------------------------------------ journal des événements (CH-031)
  * JOURNALISATION SEULE : ces fonctions lisent le rapport rendu par la page (`apply` / `amenerDansLaVue`) et fabriquent le détail des
  * événements `deplacement-vue` (un par côté amené), `deplacement-vue-remise` (un par pose ou pré-vol) et le bilan du lot
  * `deplacement-vue-bilan`. Elles n'envoient rien à la page et ne décident rien. Aucune position : des NDC, des facteurs, des durées.
  * Le bilan n'a ni numéro de cut ni identité ; les événements gardent l'identité du cut (ajoutée par le journal du moteur). */
 const nb=(v,k=1000)=>Number.isFinite(v)?Math.round(v*k)/k:null;
 const ndc=v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)?v.map(x=>nb(x)):null;
 const txt=(v,n)=>typeof v==='string'?v.slice(0,n):null;
 /* Un geste de la page : le détail du module (`geste.deplacement` : geste choisi, tentatives, raison) et la caméra mesurée avant / après. */
 function gesteJournal(g){if(!g||typeof g!=='object')return null;const d=g.deplacement&&typeof g.deplacement==='object'?g.deplacement:null;
   return {type:txt(g.type,20),geste:txt(d?.geste,24),tentatives:Number.isInteger(d?.tentatives)?d.tentatives:null,ok:d?d.ok===true:null,raison:txt(d?.raison,40),
     camera:txt(g.camera,20),sensInverse:g.sensInverse===true,crans:Number.isInteger(g.crans)?g.crans:null,zoom:nb(g.zoom),ndcAvant:ndc(g.ndcAvant),ndcApres:ndc(g.ndcApres),dureeMs:nb(g.dureeMs,1)};}
 /* `deplacement-vue` : un côté amené. `ctx` : { phase: 'pose'|'pre-vol', geste: geste réglé (facultatif) }. */
 function detailDeplacement(c,ctx={}){if(!c||typeof c!=='object')return null;
   const gestes=(Array.isArray(c.gestes)?c.gestes:[]).slice(0,8).map(gesteJournal).filter(Boolean);
   const tent=gestes.reduce((t,g)=>t+(g.tentatives||0),0);
   return {phase:txt(ctx.phase,12),cote:c.cote==='left'||c.cote==='right'?c.cote:null,geste:gestes.find(g=>g.geste)?.geste||txt(ctx.geste,24),ok:c.ok===true,raison:txt(c.raison,40),
     tentatives:tent||null,gestes,ndcAvant:ndc(c.ndcAvant),ndcApres:ndc(c.ndcApres),pixelMm:c.pixelMm&&typeof c.pixelMm==='object'?{avant:nb(c.pixelMm.avant),apres:nb(c.pixelMm.apres)}:null,
     dureeMs:nb(c.dureeMs,1)};}
 /* Le texte d'échec de la remise levé par la page (`apply`) : « … (échelle à 2,5 % de la vue habituelle) … ». L'écart y est lu au dixième de
  * pour cent : c'est le seul endroit où il survit à l'exception tant que la page ne joint pas son rapport (patch CH-031). */
 const RE_REMISE=/Vue ESV non restituée[^(]*\(échelle à ([0-9]+(?:[,.][0-9]+)?) ?%/;
 /* `deplacement-vue-remise` : `remise` = rapport de la page ({ok,crans,recentre,ecartEchelle,dureeMs?}) ou null ; `erreur` = exception de la pose.
  * `ctx` : { phase, dureeApplyMs } — la durée de l'`apply` entier, seule mesure possible hors page tant que la remise n'a pas la sienne. */
 function detailRemise(remise,erreur,ctx={}){
   const base={phase:txt(ctx.phase,12),dureeApplyMs:nb(ctx.dureeApplyMs,1)};
   if(remise&&typeof remise==='object')return {...base,resultat:remise.ok===true?'faite':'echec',ok:remise.ok===true,ecartEchelle:nb(remise.ecartEchelle,1e6),crans:Number.isInteger(remise.crans)?remise.crans:null,
     recentre:remise.recentre===true,tentative:Number.isInteger(remise.crans)&&remise.crans>0?Math.ceil(remise.crans/Math.max(1,ctx.cransMax||remise.crans)):remise.recentre?1:0,
     dureeMs:nb(remise.dureeMs,1),raison:remise.ok===true?null:'vue-non-restituee',source:'rapport'};
   const m=typeof erreur==='string'?RE_REMISE.exec(erreur):null;
   if(m)return {...base,resultat:'echec',ok:false,ecartEchelle:nb(parseFloat(m[1].replace(',','.'))/100,1e4),crans:null,recentre:null,tentative:null,dureeMs:null,raison:'vue-non-restituee',source:'message'};
   return {...base,resultat:'inconnu',ok:false,ecartEchelle:null,crans:null,recentre:null,tentative:null,dureeMs:null,raison:'erreur:'+(txt(erreur,100)||'?'),source:'erreur'};}
 /* Bilan du lot : des comptes seulement. `temps` = durées des côtés amenés + durées de remise connues (la remise sans durée propre n'y entre pas). */
 class Bilan{
   constructor(o){this.deplacements=0;this.reussis=0;this.remises=0;this.remisesFaites=0;this.echecs=0;this.remisesInconnues=0;this.tempsMs=0;this.ecartMax=0;if(o&&typeof o==='object')Object.assign(this,o);}
   noterDeplacement(d){if(!d)return;this.deplacements++;if(d.ok)this.reussis++;else this.echecs++;if(Number.isFinite(d.dureeMs))this.tempsMs+=d.dureeMs;}
   noterRemise(r){if(!r)return;this.remises++;if(r.resultat==='faite')this.remisesFaites++;else if(r.resultat==='echec')this.echecs++;else this.remisesInconnues++;
     if(Number.isFinite(r.dureeMs))this.tempsMs+=r.dureeMs;if(Number.isFinite(r.ecartEchelle)&&r.ecartEchelle>this.ecartMax)this.ecartMax=r.ecartEchelle;}
   vide(){return !this.deplacements&&!this.remises;}
   resume(){return {version:VERSION,deplacements:this.deplacements,deplacementsReussis:this.reussis,remises:this.remises,remisesFaites:this.remisesFaites,remisesInconnues:this.remisesInconnues,
     echecs:this.echecs,tempsAjouteMs:nb(this.tempsMs,1),ecartRemiseMax:nb(this.ecartMax,1e6)};}
 }

 return {VERSION,GESTES,PLAFOND_TENTATIVES,DEFAUTS,reglages,Journal,sequence,juger,deplacer,detailDeplacement,detailRemise,Bilan};
});
