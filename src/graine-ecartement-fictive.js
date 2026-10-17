(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./gauge.js'),require('./continuity-observer.js'),require('./lot-decision.js'));
  else root.BananeGraineEcartementFictive=factory(root.BananeCaptureCore,root.BananeGauge4,root.BananeContinuityObserver,root.BananeLotDecision);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,Gauge,O,L){
 'use strict';
 /* 5.0 (D-170, chantier P7, hypothèse « graine d'écartement sur pose fictive », H2 du catalogue des échecs) — POST-TRAITEMENT d'un
  * cut que la chaîne d'appuis DIFFÈRE et dont la pose de départ est FICTIVE (écartement 1 500 mm, gabarit par défaut d'ESV ;
  * fiches/P7_GRAINE_ECARTEMENT_FICTIVE.md).
  *
  * Constat du catalogue : hors de portée (le bon rail est à 12–27 cm de la pose d'ESV) ou pose de départ fausse, le moteur trouve
  * souvent UN rail à quelques mm de la pose de l'opérateur, et l'autre reste hors de sa fenêtre ou non résolu (flanc non vu).
  * Correctif : pour chaque rail que le moteur a trouvé (`candidate`) au premier passage,
  *   1. l'autre rail est replacé à l'ÉCARTEMENT DE RÉFÉRENCE (médiane des poses actuelles des voisins sûrs à ±`rayon` cuts, sinon
  *      médiane de la partie), dans la direction de sa pose de départ : c'est une GRAINE, jamais une pose ;
  *   2. le MOTEUR LIVRÉ est relancé sur la même capture, ce seul rail translaté (`translated`, `minimalCapture`) ;
  *   3. la paire est gardée si l'autre rail est `candidate`, si l'écartement de la paire est dans le contrat (`gauge.js`) et à
  *      `ecartRefMaxMm` (20 mm) au plus de la référence.
  * Si les deux rails donnent une paire, elles doivent s'accorder à `accordMm` (10 mm) près sur chaque rail ; la première est rendue.
  * Le moteur décide ; l'écartement sert de graine et de garde (au bord de D-033 : accord de Mic et de la direction requis).
  * La pose rendue n'est JAMAIS un appui de la chaîne (`anchor: false`) et ne porte pas de hauteur apprise (étage hors de son domaine).
  *
  * GARDE « POSE FICTIVE » : sans elle, le banc du catalogue relève 4 poses sur la mauvaise voie (la pose de départ dans le contrat était
  * elle-même sur la mauvaise voie, ou le rail trouvé était celui d'une autre voie). Une pose de départ non fictive : rien.
  *
  * Fonction PURE : ni horloge, ni réglage global, ni écriture ; entrées non modifiées. COUPÉE par défaut (`options.actif === true`).
  * Une panne du moteur sur une graine rend cette graine nulle ; la décision de la chaîne est alors rendue telle quelle. */
 const VERSION='graine-ecartement-fictive-v1';
 const ETAGE='graine-ecartement',POST='graine-ecartement-fictive';
 const SIDES=['left','right'];
 const DEFAUTS=Object.freeze({actif:false,rayon:5,ecartementFictifMm:1500,toleranceFictiveMm:0.5,ecartRefMaxMm:20,accordMm:10});
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const vec3=v=>Array.isArray(v)&&v.length>=3&&v.slice(0,3).every(fini);
 const cfgDe=options=>({...DEFAUTS,...(options||{})});
 const r1=v=>fini(v)?Math.round(v*10)/10:null;
 const ecartementMm=pos=>pos&&SIDES.every(s=>vec3(pos[s]))?1000*C.distance(pos.left,pos.right):null;
 const mediane=a=>{const s=a.filter(fini).sort((x,y)=>x-y);if(!s.length)return null;const m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};

 /* Pose fictive d'ESV : écartement par défaut (1 500 mm) à `toleranceFictiveMm` près. */
 function estFictive(positions,options){
   const cfg=cfgDe(options),g=ecartementMm(positions);
   return g!=null&&Math.abs(g-cfg.ecartementFictifMm)<cfg.toleranceFictiveMm;
 }
 /* Écartement de référence (mm). `poses` : [{ identity:{part,cut,frameId}, positions:{left,right}, differe }] — poses ACTUELLES (celles
  * qu'ESV montre avant toute correction humaine), jamais une pose de l'opérateur. Voisins sûrs : même partie et même repère, à ±`rayon`
  * cuts, jamais le cut lui-même, jamais un cut différé par le lot (`differe` doit valoir false), jamais une pose fictive. Sans voisin sûr :
  * `gPartie` (médiane de la partie, calculée par l'appelant sur les poses actuelles hors lot). */
 function ecartementReference({identity,poses,gPartie,options}={}){
   const cfg=cfgDe(options),g=[];
   if(identity&&Number.isInteger(identity.cut))for(const p of poses||[]){
     const id=p&&p.identity;
     if(!id||id.part!==identity.part||(id.frameId??null)!==(identity.frameId??null)||!Number.isInteger(id.cut))continue;
     if(id.cut===identity.cut||Math.abs(id.cut-identity.cut)>cfg.rayon||p.differe!==false)continue;
     if(estFictive(p.positions,cfg))continue;
     const e=ecartementMm(p.positions);if(e!=null)g.push(e);
   }
   if(g.length)return {mm:mediane(g),source:'voisins',n:g.length};
   return fini(gPartie)?{mm:gPartie,source:'partie',n:0}:{mm:null,source:null,n:0};
 }
 const candidat=r=>!!(r&&r.ok&&r.next&&r.next.status==='candidate'&&vec3(r.next.delta));
 /* Une graine depuis le rail trouvé `c` : rend { paire, essai }. */
 function graine({capture,science,c,gRef,Shadow,Lot,Obs,cfg}){
   const o=c==='left'?'right':'left',essai={depuis:c,garde:null,ecartementMm:null,ecartRefMm:null};
   const Pc=Lot.positionOf(capture.rails[c],science.rails[c].next.delta),Po=capture.rails[o].positionSceneRelative;
   const v=[0,1,2].map(i=>Po[i]-Pc[i]),n=Math.hypot(...v);
   if(!(n>1e-9))return {paire:null,essai:{...essai,garde:'direction-nulle'}};
   const cible=[0,1,2].map(i=>Pc[i]+v[i]/n*gRef/1000);
   const railsS={...capture.rails,[o]:Obs.translated(capture.rails[o],[0,1,2].map(i=>cible[i]-Po[i]))};
   let sc;
   try{sc=Shadow.scientificProposeBoth(Lot.minimalCapture(capture,railsS));}catch{return {paire:null,essai:{...essai,garde:'panne'}};}
   const ro=sc&&sc.rails&&sc.rails[o];
   if(!candidat(ro))return {paire:null,essai:{...essai,garde:'autre-rail-non-candidat'}};
   const P={[c]:Pc,[o]:Lot.positionOf(railsS[o],ro.next.delta)},g=ecartementMm(P),d=Math.abs(g-gRef);
   const e={...essai,ecartementMm:r1(g),ecartRefMm:r1(d)};
   if(!Gauge.admissible(Gauge.classifyMm(g)))return {paire:null,essai:{...e,garde:'hors-contrat'}};
   if(d>cfg.ecartRefMaxMm)return {paire:null,essai:{...e,garde:'loin-de-la-reference'}};
   return {paire:{left:P.left.slice(0,3),right:P.right.slice(0,3)},essai:{...e,garde:'ok'}};
 }
 /* `decision` : celle de la chaîne pour ce cut ; `capture` : la capture du cut (rails à la pose de départ) ; `science` : le premier passage
  * du moteur sur cette capture ; `poses`, `gPartie` : pour l'écartement de référence ; `Shadow` : le moteur livré (injectable pour les
  * essais), `Lot` et `Obs` : la décision et l'observateur livrés. Rend { decision, tentative } : `tentative` nul si la graine ne
  * s'applique pas (coupée, chaîne qui pose, pose de départ non fictive) ; sinon référence, essais par graine, accord et motif. */
 function reprendre({decision,capture,science,poses,gPartie,Shadow,options,Lot=L,Obs=O}={}){
   const cfg=cfgDe(options);
   if(cfg.actif!==true||!decision||decision.positions||!capture||!capture.rails||!SIDES.every(s=>capture.rails[s]&&vec3(capture.rails[s].positionSceneRelative)))return {decision,tentative:null};
   if(!estFictive({left:capture.rails.left.positionSceneRelative,right:capture.rails.right.positionSceneRelative},cfg))return {decision,tentative:null};
   const reference=ecartementReference({identity:capture.identity,poses,gPartie,options:cfg});
   const t={version:VERSION,reference:{mm:r1(reference.mm),source:reference.source,n:reference.n},trouves:[],essais:[],accordMm:null,reason:null,pose:false};
   if(!fini(reference.mm))return {decision,tentative:{...t,reason:'sans-reference'}};
   const trouves=SIDES.filter(s=>science&&science.rails&&candidat(science.rails[s]));
   t.trouves=trouves;
   if(!trouves.length)return {decision,tentative:{...t,reason:'aucun-rail-trouve'}};
   const paires=[];
   for(const c of trouves){const g=graine({capture,science,c,gRef:reference.mm,Shadow,Lot,Obs,cfg});t.essais.push(g.essai);if(g.paire)paires.push(g.paire);}
   if(!paires.length)return {decision,tentative:{...t,reason:'aucune-paire'}};
   if(paires.length===2){
     t.accordMm=r1(Math.max(...SIDES.map(s=>1000*C.distance(paires[0][s],paires[1][s]))));
     if(t.accordMm>cfg.accordMm)return {decision,tentative:{...t,reason:'graines-en-desaccord'}};
   }
   const positions=paires[0];
   return {decision:{stage:ETAGE,reason:null,positions,anchor:false,post:POST,anchorsUsed:[],gaugeMm:r1(ecartementMm(positions))},tentative:{...t,pose:true}};
 }
 return {VERSION,ETAGE,POST,DEFAUTS,estFictive,ecartementReference,reprendre};
});
