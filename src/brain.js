(function(root,factory){const api=factory();
 if(typeof module==='object')module.exports=api;else root.BananeBrain1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* Cerveau de placement du champignon — V1.
  *
  * Ce module ne remplace PAS le moteur gelé : il le post-traite. Le moteur
  * (`src/geometry.js`) reste inchangé, octet pour octet, et reste seul à
  * produire les candidats. Le cerveau ne fait que deux choses, chacune
  * justifiée par une mesure sur le corpus de corrections humaines :
  *
  *   1. RETIRER UN BIAIS VERTICAL SYSTÉMATIQUE. Sur 173 rails où le moteur
  *      propose, l'humain place systématiquement plus haut de +4,28e-3 unités
  *      de scène, avec un écart-type de 3,20e-3. La moyenne dépasse l'écart-type,
  *      donc c'est un biais, pas du bruit. Il est stable entre blocs
  *      (part 17 : +3,52 ; part 20 : +4,55) et entre côtés (+4,66 / +3,94).
  *      Le résidu LATÉRAL, lui, vaut -0,82 ± 12,73 : moyenne très inférieure à
  *      l'écart-type, donc du bruit. Il n'est PAS corrigé.
  *
  *   2. TRANCHER ENTRE LES CANDIDATS DÉJÀ EXPOSÉS, quand le moteur s'abstient
  *      pour concurrence. Le moteur produit trois positions (graine fine,
  *      intersection des surfaces, meilleure alternative de grille grossière) ;
  *      le cerveau n'en invente aucune. Sur le corpus, la bonne réponse est
  *      presque toujours parmi elles — meilleur des trois : médiane 4,03e-3,
  *      29 sur 33 sous 10e-3 — mais le moteur ne sait pas laquelle.
  *      Le cerveau tranche par le DÉVERS : le geste vertical de l'humain est
  *      corrélé entre les deux files (r = 0,46 ; écart gauche-droite
  *      0,94 ± 9,67e-3). Le candidat retenu est celui dont le vertical est le
  *      plus proche de celui du rail opposé, lorsque celui-ci est résolu.
  *
  * ABSTENTION. Le cerveau s'abstient plus souvent qu'il ne tranche, et c'est
  * voulu : sur ce corpus, un mauvais choix coûte très cher (p90 à 122e-3 sans
  * garde-fou). Deux garde-fous, dont les seuils viennent de LIGNES AUTRES que
  * celles qu'ils filtrent — les lignes résolues — et non d'un réglage sur les
  * cas ambigus :
  *   — plausibilité latérale : p90 du geste humain latéral observé ;
  *   — accord vertical avec le rail opposé : ~1,5 écart-type de la différence
  *     gauche-droite observée.
  * Une abstention rend la proposition du moteur telle quelle : `unresolved`.
  * Le cerveau ne transforme JAMAIS une abstention en SKIP.
  *
  * UNITÉS : unités de scène. Elles ne sont pas appelées millimètres —
  * `physicalCalibrationStatus` ne l'atteste pas.
  */
 const DEFAULTS=Object.freeze({
  /* Ajusté sur le bloc de développement UNIQUEMENT (voir tools/brain-fit.cjs). */
  biaisVertical:0,
  /* Le latéral n'est pas corrigé : son résidu est du bruit. Le réglage existe
   * pour pouvoir le démontrer, pas pour être activé à l'aveugle. */
  biaisLateral:0,
  /* Garde-fous de la sélection de candidat. */
  selectionActive:true,
  plausibiliteLaterale:0.050,
  ecartVerticalMax:0.015,
  /* En dessous, le moteur n'était pas ambigu : on ne sélectionne pas. */
  motifConcurrence:'concurrents',
 });
 const fini=v=>Number.isFinite(v);
 const point2=c=>Array.isArray(c)&&c.length>=2&&fini(c[0])&&fini(c[1]);

 /* Les candidats que le moteur a RÉELLEMENT produits, dans l'ordre où il les
  * expose. Aucun n'est fabriqué ici. */
 function candidatsExposes(proposition){
  const m=proposition?.metrics;if(!m)return [];
  const sortie=[];
  for(const [nom,valeur] of [['graine',m.seed],['surface',m.surfaceIntersection],
    ['alternative',m.templateAmbiguity?.alternative]])
   if(point2(valeur))sortie.push({nom,position:[valeur[0],valeur[1]]});
  return sortie;
 }
 const ambigue=(p,cfg)=>p&&p.status!=='candidate'&&
   (p.reasons||[]).some(r=>String(r).includes(cfg.motifConcurrence));

 /* Traite une PAIRE de propositions — le dévers n'existe qu'à l'échelle du cut. */
 function corrigerPaire(propositions,options={}){
  const cfg={...DEFAULTS,...options};
  if(!fini(cfg.biaisVertical)||!fini(cfg.biaisLateral))throw Error('Biais du cerveau invalide.');
  if(!(cfg.plausibiliteLaterale>0)||!(cfg.ecartVerticalMax>0))throw Error('Garde-fou du cerveau invalide.');
  const sortie={},journal={};
  for(const side of ['left','right']){
   const p=propositions?.[side]||null;
   const autre=propositions?.[side==='left'?'right':'left']||null;
   const r=corrigerRail(p,autre,side,cfg);
   sortie[side]=r.proposition;journal[side]=r.journal;
  }
  return {proposals:sortie,brain:{id:'champignon-v1',parameters:cfg,perRail:journal}};
 }

 function corrigerRail(p,autre,side,cfg){
  if(!p)return {proposition:p,journal:{action:'aucune',motif:'proposition absente'}};

  // 1. Biais vertical sur une proposition existante.
  if(p.status==='candidate'&&Array.isArray(p.delta)&&p.delta.every(fini)){
   if(!cfg.biaisVertical&&!cfg.biaisLateral)
    return {proposition:p,journal:{action:'aucune',motif:'biais nul'}};
   const delta=[p.delta[0],p.delta[1]+cfg.biaisLateral,p.delta[2]+cfg.biaisVertical];
   return {proposition:{...p,delta,source:'lidar-template-supported+brain-bias',
     reasons:[...(p.reasons||[]),'Biais vertical systématique retiré par le cerveau.'],
     brainApplied:{biaisVertical:cfg.biaisVertical,biaisLateral:cfg.biaisLateral}},
    journal:{action:'biais',biaisVertical:cfg.biaisVertical,biaisLateral:cfg.biaisLateral}};
  }

  // 2. Sélection parmi les candidats exposés, sur abstention pour concurrence.
  if(!cfg.selectionActive)return {proposition:p,journal:{action:'aucune',motif:'sélection désactivée'}};
  if(!ambigue(p,cfg))return {proposition:p,journal:{action:'aucune',motif:'abstention non liée à la concurrence'}};
  const candidats=candidatsExposes(p);
  if(candidats.length<2)
   return {proposition:p,journal:{action:'abstention',motif:'moins de deux candidats exposés',candidats:candidats.length}};
  if(!autre||autre.status!=='candidate'||!Array.isArray(autre.delta))
   return {proposition:p,journal:{action:'abstention',motif:'rail opposé non résolu : pas d’appui de dévers'}};

  // Le rail opposé porte déjà sa correction de biais quand elle s'applique.
  const zOppose=autre.delta[2];
  const classes=candidats.map(c=>({...c,ecartZ:Math.abs(c.position[1]-zOppose)}))
   .sort((a,b)=>a.ecartZ-b.ecartZ);
  const retenu=classes[0];
  if(retenu.ecartZ>cfg.ecartVerticalMax)
   return {proposition:p,journal:{action:'abstention',motif:'aucun candidat en accord de dévers',
     ecartZ:retenu.ecartZ,seuil:cfg.ecartVerticalMax}};
  if(Math.abs(retenu.position[0])>cfg.plausibiliteLaterale)
   return {proposition:p,journal:{action:'abstention',motif:'déplacement latéral hors du domaine observé',
     lateral:retenu.position[0],seuil:cfg.plausibiliteLaterale}};

  const delta=[0,retenu.position[0],retenu.position[1]+cfg.biaisVertical];
  return {proposition:{...p,status:'candidate',delta,
    /* CONFIANCE ZÉRO, DÉLIBÉRÉMENT.
     *
     * Sur le bloc de développement, 2 des 14 sélections étaient très fausses
     * (~82e-3 unités de scène) malgré les garde-fous : environ une sur sept.
     * Une sélection est donc une PISTE À REGARDER, pas une position à appliquer
     * sans regard.
     *
     * `src/engine.js` est gelé : le pilote ne peut pas être modifié pour
     * traiter ce cas. La sûreté doit donc venir de ce que le cerveau émet.
     * Le pilote met en pause tout rail dont la confiance est sous
     * `minConfidence` ; une confiance de 0 garantit cette pause, quelle que
     * soit la valeur du seuil, sans dépendre d'une coercition de `null`.
     * Conséquence voulue : une sélection est proposée en mode assisté, où
     * l'opérateur la voit et tranche, et n'est JAMAIS appliquée seule par le
     * pilote. Verrouillé par tests/brain.test.cjs. */
    confidence:0,confidenceStatus:'non-calibrée-pour-la-sélection',
    source:'brain-candidate-selection',
    reasons:[...(p.reasons||[]),
      `Candidat « ${retenu.nom} » retenu par accord de dévers avec le rail opposé.`,
      'Sélection non calibrée : à regarder, jamais à appliquer automatiquement.'],
    brainApplied:{selection:retenu.nom,ecartZ:retenu.ecartZ,zOppose,
      candidatsExposes:candidats.map(c=>c.nom),biaisVertical:cfg.biaisVertical}},
   journal:{action:'sélection',retenu:retenu.nom,ecartZ:retenu.ecartZ,
     ecarte:classes.slice(1).map(c=>({nom:c.nom,ecartZ:c.ecartZ}))}};
 }
 return {DEFAULTS,corrigerPaire,corrigerRail,candidatsExposes,ambigue};
});
