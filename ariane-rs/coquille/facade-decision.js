/* CH-064-D : façades des modules de décision sur le cœur WASM, MÊME API que les modules JS du tronc.
 *   const F=ArianeFacadeDecision.creer(coeur, {critere:BananeRelectureCritere, signal:BananeRelectureSignal, …})
 *   F.critere.juger(entree, R)   // comme BananeRelectureCritere.juger
 * Chaque fonction portée part au cœur sous la forme {f: nom, a: [arguments]} (numéros 50 et suivants, ariane-decision) ;
 * les constantes (DEFAUT, ZONES…) et ce qui n'est pas porté restent ceux du module JS. Repli sur le JS d'origine quand le cœur
 * rend « hors domaine » ou quand l'entrée ne passe pas en VBA (objet non simple, fonction…) ; compteurs par module.
 * Fonctions qui modifient leur premier argument (signal : observer, recharge) : le cœur rend {r, e} ; la façade recopie dans
 * l'objet d'origine les clés de `e` dont la valeur primitive a changé (les objets imbriqués ne sont jamais modifiés par le JS). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArianeFacadeDecision=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const NUMEROS={critere:50,signal:51,gardeApresDiffere:52,gardePasseAppuis:53,relectureOmbre:54,reglesMetier:55,crossing:56,shadow:57,hauteur:58,fauxVert:59,lotDecision:60};
 const PORTEES={
  critere:['reglages','correctionPermise','juger'],
  signal:['reglage','lectureDe','creer','observer','recharge','bilan'],
  gardeApresDiffere:['reglage','voisinsDifferes','juger'],
  gardePasseAppuis:['reglage','deplacementMm','appuiNormalCuts','juger'],
  relectureOmbre:['plage','selection','optionsSelection','ecartRail','poseCalculee','confiance','juger','skipOmbre','captureVide','duree'],
  reglesMetier:['surface','railsDePlus','resumer','doitDifferer','evenement'],
  crossing:['read','detect','edgeOf','positionAt'],
  shadow:['scientificProposeBoth','scientificProposeBothAvecReservoir'],
  hauteur:['evaluer'],fauxVert:['evaluer'],lotDecision:['decideCut']};
 const MUTANTES={signal:new Set(['observer','recharge'])};
 const primitif=v=>v===null||(typeof v!=='object'&&typeof v!=='function');
 function recopier(cible,etat){if(!cible||typeof cible!=='object'||!etat||typeof etat!=='object')return;
  for(const k of Object.keys(etat)){const v=etat[k];if(primitif(v)&&!Object.is(cible[k],v))cible[k]=v;}}
 /* État que le JS lit hors de ses arguments, résolu ici au moment de l'appel : drapeaux du module GCV1 (`configure`), plafond du
  * calage de convention (`BananeSettings.conventionPlafond`, comme `plafondMode` de placement-convention.js). */
 function plafondMode(P){const cfg={...(P&&P.DEFAULTS)};const v=cfg.plafond!==undefined&&cfg.plafond!==null?cfg.plafond:(typeof globalThis!=='undefined'?globalThis.BananeSettings?.conventionPlafond:undefined);
  return v===true?true:v==='vertical'?'vertical':false;}
 const etatShadow=(S,modules)=>{const st=S.state();return {partialFlank:st.partialFlank,convention:st.convention,plafond:plafondMode(modules.convention)};};
 function etatDe(nom,modules){if(nom==='shadow')return etatShadow(modules.shadow,modules);return undefined;}
 /* decideCut reçoit le module GCV1 (`Shadow`, des fonctions) : il ne traverse pas ; seul le module chargé (modules.shadow) est accepté,
  * son état part à sa place, avec les réglages globaux que lit lot-decision.js. Tout autre Shadow (doublure d'essai) : repli sur le JS. */
 function envoiSpecial(nom,f,a,modules){
  if(nom!=='lotDecision')return null;
  const x=a[0];if(!x||typeof x!=='object'||x.Shadow!==modules.shadow||!modules.shadow)return false;
  const {Shadow,...reste}=x,S=typeof globalThis!=='undefined'?globalThis.BananeSettings:undefined;
  return {f,a:[reste,...a.slice(1)],etat:etatShadow(Shadow,modules),globaux:{flushPct:S?.releves?.flushPct,ombreVerticaleRefusee:S?.ombreVerticaleRefusee,fauxVertOmbre:S?.fauxVertOmbre,hauteurApprise:S?.hauteurApprise}};}
 function creer(coeur,modules){
  const n={};const out={compteurs:()=>JSON.parse(JSON.stringify(n))};
  for(const [nom,M] of Object.entries(modules)){if(!M||!(nom in NUMEROS))continue;
   const c=n[nom]={coeur:0,repliHorsDomaine:0,repliFormat:0};const F={...M};
   for(const f of PORTEES[nom]){if(typeof M[f]!=='function')continue;
    const mutante=MUTANTES[nom]?.has(f);
    F[f]=function(...a){
     const sp=envoiSpecial(nom,f,a,modules);if(sp===false){c.repliHorsDomaine++;return M[f](...a);}
     let v;try{const etat=etatDe(nom,modules);v=coeur.appeler(NUMEROS[nom],sp||(etat===undefined?{f,a}:{f,a,etat}));c.coeur++;}
     catch(e){if(e&&e.name==='HorsDomaine'){c.repliHorsDomaine++;return M[f](...a);}
      if(e instanceof TypeError&&/^VBA : /.test(e.message)){c.repliFormat++;return M[f](...a);}throw e;}
     if(mutante){recopier(a[0],v.e);return v.r;}
     return v;};}
   out[nom]=F;}
  return out;}
 return {creer,NUMEROS,PORTEES};
});
