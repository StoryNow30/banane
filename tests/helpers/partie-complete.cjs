'use strict';
/* Test 7, suite — montage des essais « partie complète, rien n'est envoyé à ESV » (tests/partie-complete-*-t7.test.cjs) :
 * service worker réel en VM, moteur et GCV1 réels, ESV simulé ; données synthétiques. Réparti en trois fichiers, chacun bien
 * sous les 20 s de verify. */
const {pilote,avecReleve}=require('./dernier-cut.cjs'),L=require('../../src/lot-decision.js'),B=require('../../src/appuis-liste.js');
const AVIS='Partie 23 : plus aucun cut rouge à traiter. Le lot s’arrête ici. Aucune pose ni validation n’a été envoyée à ESV.';
const ECRITURES=['apply','restore','validateAndNext','validateInPlace','next','nextWithoutDecision','skipAndNext'];
/* Commandes reçues par l'ESV simulé, arguments compris ; identifiants et heures neutralisés, rien d'autre. */
const neutre=x=>JSON.parse(JSON.stringify(x??null).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>')
 .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g,'<heure>'));
/* Fenêtre de la liste d'ESV autour du cut, telle que la page la rend (`banane5:voisins-reponse`). */
const fenetre=(cut,statut,{tables=1,index=cut}={})=>({ok:true,table:{lignes:101,pages:1,fraiches:0,debut:true,rompue:false,tronquee:false,tables},
 geo:{index,mm:0,secondMm:null},rows:[cut-1,cut,cut+1].map(i=>({i,s:i===cut?statut:'valid',t:true,v:true,f:false,e:null}))});
/* `mesure` : compteur relevé après la capture (null : aucun relevé) ; `liste` : réponse de la page à la lecture B1
 * (undefined : la page ne répond pas). Lot « jusqu'à la fin de la partie » au cut 50 de la partie 23 ; après une validation,
 * ESV charge la partie 24. */
async function scenario({mesure,liste,cut=50,module=true}={}){let b0=null;const trace=[],lectures=[];
 const r=await pilote(L,{start:cut,end:0,endMode:'partie',globals:module?{BananeAppuisListe:B}:{},esv:(e,b)=>{b0=b;e.identity.cut=cut;avecReleve(mesure)(e,b);
  e.next=async function(){this.calls.push('next');this.identity={...this.identity,part:24,cut:1};return this.state();};
  for(const a of ECRITURES)if(typeof e[a]==='function'){const f=e[a].bind(e);e[a]=async(...x)=>{trace.push(neutre({a,x}));return f(...x);};}
  const envoyer=b.ctx.chrome.tabs.sendMessage;
  b.ctx.chrome.tabs.sendMessage=async(id,m)=>{if(m?.kind!=='b1-voisins')return envoyer(id,m);lectures.push(m.cut);
   if(liste===undefined)throw Error('page sans réponse');return JSON.parse(JSON.stringify(typeof liste==='function'?liste(m):liste));};}});
 const view=await r.b.settle();
 return {view,trace,lectures,calls:[...r.b.adapter.calls],ecritures:r.b.adapter.calls.filter(c=>c!=='capture'),b:r.b,b0};}


module.exports={scenario,fenetre,AVIS};
