'use strict';
/* CH-064-D : parité des modules de décision (ariane-decision) contre le JS du tronc.
 * Cas : (1) fixtures des essais JS du tronc (tools/ch064-d-fixtures.cjs, appels réels des essais, arguments clonés avant
 * l'appel) ; (2) données réelles de banane-data (tools/ch064-d-cas.cjs : événements des journaux et nuages des 04, 05, 06/11) ;
 * (3) variantes tirées à graine fixe (même fichier) pour les branches que ni les essais ni le terrain n'atteignent.
 * Chaque cas porte ses arguments en VBA (base64) : chaque côté décode les siens (aucun partage, une mutation ne fuit pas),
 * et la sortie comparée est {r, apres} : le résultat ET les arguments après l'appel (les fonctions qui modifient leur état). */
const path=require('node:path');
const Vba=require('../coquille/vba.js'),F=require('../coquille/facade-decision.js');
const RACINE=path.resolve(__dirname,'..','..');
const SRC={critere:'src/relecture-critere.js',signal:'src/relecture-signal.js',gardeApresDiffere:'src/garde-apres-differe.js',
 gardePasseAppuis:'src/garde-passe-appuis.js',relectureOmbre:'src/relecture-ombre.js',reglesMetier:'src/regles-metier.js',crossing:'src/level-crossing.js',
 shadow:'src/gcv1-shadow.js',hauteur:'src/hauteur-apprise.js',fauxVert:'src/faux-vert-ombre.js',lotDecision:'src/lot-decision.js',
 /* CH-068 (J4) */ appuisListe:'src/appuis-liste.js',gcv2L1e:'src/gcv2-l1e.js',voieRecentree:'src/voie-recentree.js',voieB1:'src/voie-b1-ecart.js',rechercheLarge:'src/recherche-large.js'};
const GLOBALES={critere:'BananeRelectureCritere',signal:'BananeRelectureSignal',gardeApresDiffere:'BananeGardeApresDiffere',
 gardePasseAppuis:'BananeGardePasseAppuis',relectureOmbre:'BananeRelectureOmbre',reglesMetier:'BananeReglesMetier',crossing:'BananeLevelCrossing',shadow:'BananeGCV1Shadow',hauteur:'BananeHauteurApprise',fauxVert:'BananeFauxVertOmbre',lotDecision:'BananeLotDecision',appuisListe:'BananeAppuisListe',gcv2L1e:'BananeGcv2L1e',voieRecentree:'BananeVoieRecentree',voieB1:'BananeVoieB1Ecart',rechercheLarge:'BananeRechercheLarge'};
/* Ordre de chargement du service worker (background.js, importScripts), restreint aux modules purs dont dépend la décision. */
const CHAINE=['vendor/capture-core.js','src/gauge.js','src/geometry.js','src/brain.js','src/geometry-brain.js','src/gcv1-shadow-bootstrap.js','src/geometry-candidate-v1.js',
 'src/placement-convention.js','src/faux-vert-ombre.js','src/hauteur-apprise.js','src/continuity-observer.js','src/level-crossing.js','src/lot-decision.js','src/gcv1-shadow.js',
 'src/regles-metier.js','src/relecture-ombre.js','src/relecture-critere.js','src/relecture-signal.js','src/garde-passe-appuis.js','src/garde-apres-differe.js','src/appuis-liste.js','src/gcv2-l1e.js','src/voie-recentree.js','src/voie-b1-ecart.js','src/recherche-large.js'];
const MODULES=(process.env.CH064D_MODULES||Object.keys(SRC).join(',')).split(',');
const M=Object.fromEntries(MODULES.map(m=>[m,require(path.join(RACINE,SRC[m]))]));
const Mfac={...M,convention:require(path.join(RACINE,'src/placement-convention.js')),shadow:require(path.join(RACINE,'src/gcv1-shadow.js'))};
let facade=null;
const fac=coeur=>facade&&facade.coeur===coeur?facade.f:(facade={coeur,f:F.creer(coeur,Mfac)}).f;
const decoder=b64=>Vba.decoder(Uint8Array.from(Buffer.from(b64,'base64')));
/* Le module GCV1 passé à decideCut (`Shadow`) voyage sous la marque SHADOW et est remis ici, des deux côtés, avant l'appel. */
function jouer(Mods,e,dec,S){
 /* CH-068 : un Map voyage sous la marque \u0000map (paires) ; rétabli avant l'appel, remarqué après (le comparateur ne voit pas le contenu d'un Map). */
 const MM='\u0000map',retablir=(v,p=0)=>{if(!v||typeof v!=='object'||p>6)return v;if(!Array.isArray(v)&&Array.isArray(v[MM])&&Object.keys(v).length===1)return new Map(v[MM]);
  for(const k of Object.keys(v))v[k]=retablir(v[k],p+1);return v;};
 const marquer=(v,p=0)=>{if(v instanceof Map)return {[MM]:[...v].map(x=>marquer(x,p+1))};if(!v||typeof v!=='object'||p>6||typeof v==='function')return v;
  if(Array.isArray(v)){let ch=false;const r=v.map(x=>{const y=marquer(x,p+1);if(y!==x)ch=true;return y;});return ch?r:v;}
  let ch=false;const r={};for(const k of Object.keys(v)){const y=marquer(v[k],p+1);if(y!==v[k])ch=true;r[k]=y;}return ch?r:v;};
 const a=dec(e.args).map(x=>retablir(x));for(const x of a)if(x&&typeof x==='object'&&x.Shadow==='\u0000shadow')x.Shadow=S;
 /* recherche-large.decider rend `ms` (horloge) : la même horloge figée des deux côtés pendant l'appel. */
 const D=Date.now,fige=e.module==='rechercheLarge';if(fige)Date.now=()=>0;let r;try{r=Mods[e.module][e.f](...a);}finally{if(fige)Date.now=D;}
 if(r&&typeof r==='object')for(const x of a)if(x&&typeof x==='object'&&x.Shadow===S)x.Shadow='\u0000shadow';return {r:marquer(r),apres:a.map(x=>marquer(x))};}
module.exports={nom:'decision',description:'ariane-decision : '+MODULES.join(', '),sources:[...MODULES.map(m=>SRC[m]),'vendor/capture-core.js','src/level-crossing.js'],
 /* Seules les fonctions portées (F.PORTEES) : le reste (frameOf, qui rend une fermeture ; evaluer, noter…) reste du JS des deux côtés. */
 *cas(opts={}){for(const c of require('../../tools/ch064-d-cas.cjs').cas(MODULES,opts))if(F.PORTEES[c.entree.module].includes(c.entree.f))yield c;},
 js(e){return jouer(M,e,decoder,Mfac.shadow);},
 rs(e,coeur){return jouer(fac(coeur),e,decoder,Mfac.shadow);},
 bilan:()=>facade?facade.f.compteurs():null,
 navigateur:{scripts:[...CHAINE,'ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-decision.js'],
  preparer:'coeur=>{const G='+JSON.stringify(GLOBALES)+',M={};for(const m of '+JSON.stringify(MODULES)+')M[m]=globalThis[G[m]];'
   +'const dec=b=>ArianeVba.decoder(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));'
   +'return {M,f:ArianeFacadeDecision.creer(coeur,{...M,convention:BananePlacementConvention,shadow:BananeGCV1Shadow}),dec,jouer:('+jouer.toString()+')};}',
  js:'(e,t)=>t.jouer(t.M,e,t.dec,BananeGCV1Shadow)',rs:'(e,t)=>t.jouer(t.f,e,t.dec,BananeGCV1Shadow)',bilan:'t=>t.f.compteurs()'}};
