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
 gardePasseAppuis:'src/garde-passe-appuis.js',relectureOmbre:'src/relecture-ombre.js',reglesMetier:'src/regles-metier.js',crossing:'src/level-crossing.js'};
const GLOBALES={critere:'BananeRelectureCritere',signal:'BananeRelectureSignal',gardeApresDiffere:'BananeGardeApresDiffere',
 gardePasseAppuis:'BananeGardePasseAppuis',relectureOmbre:'BananeRelectureOmbre',reglesMetier:'BananeReglesMetier',crossing:'BananeLevelCrossing'};
const MODULES=(process.env.CH064D_MODULES||Object.keys(SRC).join(',')).split(',');
const M=Object.fromEntries(MODULES.map(m=>[m,require(path.join(RACINE,SRC[m]))]));
let facade=null;
const fac=coeur=>facade&&facade.coeur===coeur?facade.f:(facade={coeur,f:F.creer(coeur,M)}).f;
const decoder=b64=>Vba.decoder(Uint8Array.from(Buffer.from(b64,'base64')));
function jouer(Mods,e,dec){const a=dec(e.args);const r=Mods[e.module][e.f](...a);return {r,apres:a};}
module.exports={nom:'decision',description:'ariane-decision : '+MODULES.join(', '),sources:[...MODULES.map(m=>SRC[m]),'vendor/capture-core.js','src/level-crossing.js'],
 /* Seules les fonctions portées (F.PORTEES) : le reste (frameOf, qui rend une fermeture ; evaluer, noter…) reste du JS des deux côtés. */
 *cas(opts={}){for(const c of require('../../tools/ch064-d-cas.cjs').cas(MODULES,opts))if(F.PORTEES[c.entree.module].includes(c.entree.f))yield c;},
 js(e){return jouer(M,e,decoder);},
 rs(e,coeur){return jouer(fac(coeur),e,decoder);},
 bilan:()=>facade?facade.f.compteurs():null,
 navigateur:{scripts:['vendor/capture-core.js',...new Set(['src/level-crossing.js',...MODULES.map(m=>SRC[m])]),'ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-decision.js'],
  preparer:'coeur=>{const G='+JSON.stringify(GLOBALES)+',M={};for(const m of '+JSON.stringify(MODULES)+')M[m]=globalThis[G[m]];'
   +'const dec=b=>ArianeVba.decoder(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));'
   +'return {M,f:ArianeFacadeDecision.creer(coeur,M),dec,jouer:('+jouer.toString()+')};}',
  js:'(e,t)=>t.jouer(t.M,e,t.dec)',rs:'(e,t)=>t.jouer(t.f,e,t.dec)',bilan:'t=>t.f.compteurs()'}};
