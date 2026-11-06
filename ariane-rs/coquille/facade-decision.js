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
 const NUMEROS={critere:50,signal:51,gardeApresDiffere:52,gardePasseAppuis:53,relectureOmbre:54,reglesMetier:55,crossing:56,shadow:57,hauteur:58,fauxVert:59,lotDecision:60,
  /* CH-068 (J4) */ appuisListe:61,gcv2L1e:62,voieRecentree:63,voieB1:64,rechercheLarge:65,/* CH-074 (J5) */ gcv2L1:66};
 const PORTEES={
  critere:['reglages','correctionPermise','juger'],
  signal:['reglage','lectureDe','creer','observer','recharge','bilan'],
  gardeApresDiffere:['reglage','voisinsDifferes','juger'],
  gardePasseAppuis:['reglage','deplacementMm','appuiNormalCuts','juger'],
  relectureOmbre:['plage','selection','optionsSelection','ecartRail','poseCalculee','confiance','juger','skipOmbre','captureVide','duree'],
  reglesMetier:['surface','railsDePlus','resumer','doitDifferer','evenement'],
  crossing:['read','detect','edgeOf','positionAt'],
  shadow:['scientificProposeBoth','scientificProposeBothAvecReservoir'],
  hauteur:['evaluer'],fauxVert:['evaluer'],lotDecision:['decideCut'],
  appuisListe:['bordsCorps','mesurerT','noterRepere','resumeRepere','lireReponse','accord','appuis','compter','regle','comparer','resumeDecision'],
  gcv2L1e:['referenceEcartement','signe','corriger','decider'],
  voieRecentree:['localMm','poseMm','vueNecessaire','camerasLarges','geste','traceMoteur','confiances','profondeur','predictionDe','mesures','regle','enRegle',
   'verdictPrudent','completer','recentrer','appuisDepuisDecalage','choisirDansLePool','ecartPose','juger','memoireSerie'],
  voieB1:['lignesDeTable','repereDepuisLigne','ecartementReference','railTrouve','solutionsEcartement','poseMmDe','ecartPoses','evaluer'],
  rechercheLarge:['reglage','graines','grainesUtiles','grainesPics','decalage','relance','cellules','paires','decider','resumer'],
  /* CH-074 (J5) : restent au JS avecRupture (Map), reglerLeviers et leviersActifs (état du module), commander (fonction du moteur). */
  gcv2L1:['decalage','variante','decalageDepuisDepart','decalagesH6','hypothesesDuCut','transfo','accords','brut','coder','soutienRail','modeleFige','probas',
   'casDuDiffere','ecartementPaire','meilleurePaire','deciderL1','deciderL1e','positionsDe','ecartementDecal','ramenerRail','corrigerDecal','ordreRails',
   'corrigerPoseChaine','ecartAVoie','contreChaine','voieDeListe','voieGeometrique','deciderDiffere','resumer','voieAbsolue','rechercheRecentree','pairesRecentrees']};
 const MUTANTES={signal:new Set(['observer','recharge']),appuisListe:new Set(['noterRepere'])};
 /* Mutantes qui rendent parfois leur premier argument lui-même (noterRepere) : le cœur ajoute `meme`, la façade rend alors l'objet d'origine. */
 const primitif=v=>v===null||(typeof v!=='object'&&typeof v!=='function');
 function recopier(cible,etat){if(!cible||typeof cible!=='object'||!etat||typeof etat!=='object')return;
  for(const k of Object.keys(etat)){const v=etat[k];if(primitif(v)&&!Object.is(cible[k],v))cible[k]=v;}}
 /* État que le JS lit hors de ses arguments, résolu ici au moment de l'appel : drapeaux du module GCV1 (`configure`), plafond du
  * calage de convention (`BananeSettings.conventionPlafond`, comme `plafondMode` de placement-convention.js). */
 function plafondMode(P){const cfg={...(P&&P.DEFAULTS)};const v=cfg.plafond!==undefined&&cfg.plafond!==null?cfg.plafond:(typeof globalThis!=='undefined'?globalThis.BananeSettings?.conventionPlafond:undefined);
  return v===true?true:v==='vertical'?'vertical':false;}
 const etatShadow=(S,modules)=>{const st=S.state();return {partialFlank:st.partialFlank,convention:st.convention,plafond:plafondMode(modules.convention)};};
 /* recherche-large (CH-068) relance le moteur gelé du module GCV1 chargé : son état part avec chaque appel (sans module chargé : repli). */
 function etatDe(nom,modules){if(nom==='shadow'||nom==='rechercheLarge')return modules.shadow?etatShadow(modules.shadow,modules):null;return undefined;}
 /* decideCut reçoit le module GCV1 (`Shadow`, des fonctions) : il ne traverse pas ; seul le module chargé (modules.shadow) est accepté,
  * son état part à sa place, avec les réglages globaux que lit lot-decision.js. Tout autre Shadow (doublure d'essai) : repli sur le JS. */
 /* CH-074 (J5) : les Float64Array de GCV2 L1 (coefficients du modèle figé, probabilités, traits codés `x.n`) ne passent pas en VBA :
  * la façade les envoie en tableaux, sur leurs chemins connus seulement (un Float64Array ailleurs fait refuser l'entrée : repli),
  * et les rétablit sur les chemins connus de la sortie. `*` : chaque clé d'un objet ou chaque élément d'un tableau. */
 function remplacer(v,chemin,f,i=0){if(i===chemin.length)return f(v);if(!v||typeof v!=='object'||ArrayBuffer.isView(v))return v;const k=chemin[i];
  if(k==='*'){let ch=false;const r=Array.isArray(v)?v.slice():{...v};for(const c of Object.keys(v)){const x=remplacer(v[c],chemin,f,i+1);if(x!==v[c]){r[c]=x;ch=true;}}return ch?r:v;}
  if(!Object.prototype.hasOwnProperty.call(v,k))return v;const x=remplacer(v[k],chemin,f,i+1);if(x===v[k])return v;const r=Array.isArray(v)?v.slice():{...v};r[k]=x;return r;}
 const enTab=v=>v instanceof Float64Array?Array.from(v):v,enF64=v=>Array.isArray(v)?Float64Array.from(v):v;
 const XN=['rails','*','hyps','*','x','n'],COEF=[['m10','coef'],['m5','coef']],PROBAS=['probas','*'];
 const L1_ENTREE={coder:[[1,'n']],probas:[...COEF.map(c=>[0,...c]),[1,'x','n']],meilleurePaire:[[0,...XN],[1,'*']],
  deciderL1:[[0,...XN],...COEF.map(c=>[1,...c]),[3,'*']],deciderL1e:[[0,...XN],...COEF.map(c=>[1,...c]),[4,'*']],deciderDiffere:COEF.map(c=>[0,'modele',...c]),
  resumer:[[0,'decision',...PROBAS],[0,'cas',...XN]],contreChaine:[[0,'decision',...PROBAS],[0,'cas',...XN]]};
 const L1_SORTIE={coder:[[]],brut:[['n']],modeleFige:COEF,deciderL1:[PROBAS],deciderL1e:[PROBAS],casDuDiffere:[XN],deciderDiffere:[['decision',...PROBAS],['cas',...XN]]};
 function envoiL1(f,a,modules){
  if(!modules.shadow||typeof modules.gcv2L1.leviersActifs!=='function')return false;
  const b=a.slice();for(const [i,...ch] of L1_ENTREE[f]||[])if(i<b.length)b[i]=remplacer(b[i],ch,enTab);
  const S=typeof globalThis!=='undefined'?globalThis.BananeSettings:undefined;
  return {f,a:b,etat:etatShadow(modules.shadow,modules),globaux:{flushPct:S?.releves?.flushPct,ombreVerticaleRefusee:S?.ombreVerticaleRefusee,fauxVertOmbre:S?.fauxVertOmbre,hauteurApprise:S?.hauteurApprise},
   leviers:modules.gcv2L1.leviersActifs()};}
 function envoiSpecial(nom,f,a,modules){
  if(nom==='gcv2L1')return envoiL1(f,a,modules);
  /* comparer(d0,d1) teste d0===d1 : l'identité d'un objet ne traverse pas, le même objet passé deux fois reste au JS. */
  if(nom==='appuisListe'&&f==='comparer')return a[0]!==null&&typeof a[0]==='object'&&a[0]===a[1]?false:null;
  /* CH-068 : recentrer (voie-recentree) et evaluer (voie-b1-ecart) reçoivent le module GCV1 comme decideCut, et le passent à decideCut. */
  const b1=nom==='voieB1'&&f==='evaluer';
  if(!(nom==='lotDecision'||(nom==='voieRecentree'&&f==='recentrer')||b1))return null;
  const x=a[0];if(!x||typeof x!=='object'||x.Shadow!==modules.shadow||!modules.shadow)return false;
  const {Shadow,...reste}=x,S=typeof globalThis!=='undefined'?globalThis.BananeSettings:undefined;
  /* evaluer : la mémoire de l'ombre (poses, profondeurs en Map) part en paires ; la façade y recopie la mémoire rendue (memoireApres). */
  if(b1){const m=reste.mem;if(!m||typeof m!=='object'||!Array.isArray(m.poses)||!(m.profondeurs instanceof Map))return false;
   reste.mem={batchId:m.batchId,poses:m.poses,profondeurs:[...m.profondeurs]};}
  return {f,a:[reste,...a.slice(1)],etat:etatShadow(Shadow,modules),globaux:{flushPct:S?.releves?.flushPct,ombreVerticaleRefusee:S?.ombreVerticaleRefusee,fauxVertOmbre:S?.fauxVertOmbre,hauteurApprise:S?.hauteurApprise}};}
 /* Ce que la façade fait de la réponse d'un envoi spécial : evaluer (voie-b1-ecart) rend {r, mem} ; la mémoire rendue remplace celle de l'appelant. */
 function apresSpecial(nom,f,a,v){
  if(nom==='gcv2L1'){for(const ch of L1_SORTIE[f]||[])v=remplacer(v,ch,enF64);return v;}
  if(nom==='voieB1'&&f==='evaluer'){const m=a[0].mem;m.poses.splice(0,m.poses.length,...v.mem.poses);m.profondeurs.clear();for(const [k,x] of v.mem.profondeurs)m.profondeurs.set(k,x);return v.r;}
  return v;}
 function creer(coeur,modules){
  const n={};const out={compteurs:()=>JSON.parse(JSON.stringify(n))};
  for(const [nom,M] of Object.entries(modules)){if(!M||!(nom in NUMEROS))continue;
   const c=n[nom]={coeur:0,repliHorsDomaine:0,repliFormat:0};const F={...M};
   for(const f of PORTEES[nom]){if(typeof M[f]!=='function')continue;
    const mutante=MUTANTES[nom]?.has(f);
    F[f]=function(...a){
     const sp=envoiSpecial(nom,f,a,modules);if(sp===false){c.repliHorsDomaine++;return M[f](...a);}
     const etat=sp?undefined:etatDe(nom,modules);if(etat===null){c.repliHorsDomaine++;return M[f](...a);}
     /* decider (recherche-large) : `ms` est une horloge ; la façade la lit autour de l'appel, comme le JS autour de son calcul. */
     const t0=nom==='rechercheLarge'&&f==='decider'?Date.now():null;
     let v;try{v=coeur.appeler(NUMEROS[nom],sp||(etat===undefined?{f,a}:{f,a,etat}));c.coeur++;}
     catch(e){if(e&&e.name==='HorsDomaine'){c.repliHorsDomaine++;return M[f](...a);}
      if(e instanceof TypeError&&/^VBA : /.test(e.message)){c.repliFormat++;return M[f](...a);}throw e;}
     if(t0!==null&&v&&typeof v==='object')v.ms=Date.now()-t0;
     if(mutante){recopier(a[0],v.e);return v.meme===true?a[0]:v.r;}
     return sp?apresSpecial(nom,f,a,v):v;};}
   out[nom]=F;}
  return out;}
 return {creer,NUMEROS,PORTEES};
});
