'use strict';
/* 4.9.5 test 6 (D-157, D-164) — montage des essais des CHOIX POUR LE LOT (clic du mode rapide, règle « grappe de différés ») :
 * service worker réel en VM, moteur et GCV1 réels, ESV simulé, chrome.storage.local en mémoire (le panneau y garde les choix).
 * `choix` : ce qui est déjà gardé avant le lot (clés de storage.local) ; `pendant(b)` : appelé à la première commande du lot
 * (`capture` ou `apply`, selon `quand`), pour changer un choix en cours de lot ; `extra` : arguments ajoutés à « Démarrer ». Les
 * deux cuts du lot sont posés ; le premier est validé, le dernier est posé sans être validé (arrêt en fin de lot). Données
 * synthétiques. `profil` : profil du lot (4.9.5.10), « actuel » par défaut ici. */
const {production,memoire}=require('./perf-production.cjs'),{SimulatedESV,base,K}=require('../fixtures.cjs');
const S=require('../../src/settings.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const CLE_CLIC='banane50ClicHumain',CLE_GRAPPE='banane50GrappeDifferes';
class EsvOptions extends SimulatedESV{
 constructor(){super();this.applyOptions=[];this.avantCommande=null;}
 async capture(...a){if(this.avantCommande)await this.avantCommande('capture');return super.capture(...a);}
 async apply(before,proposals,...reste){if(this.avantCommande)await this.avantCommande('apply');
  this.applyOptions.push(reste.length?K.clone(reste):null);return super.apply(before,proposals);}
}
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
/* Un lot de `debut` à `fin`, sur un service worker donné ou neuf. */
async function lotClic({choix={},pendant=null,quand='apply',b=null,local=null,debut=111,fin=112,extra={},profil='actuel'}={}){
 const adapter=b?b.adapter:new EsvOptions();
 if(!b){local=memoire();Object.assign(local.m,structuredClone(choix));b=production({adapter,local});b.local=local;
  /* L'ombre de la voie prédite relance le moteur sur chaque différé ; elle n'est pas l'objet de ces essais. */
  b.ctx.BananeSettings={...b.ctx.BananeSettings,voiePrediteOmbre:{...S.voiePrediteOmbre,actif:false}};
  /* 4.9.5.10 : ces essais gardent les empreintes de la base ; ils jouent le profil du lot « actuel » (le défaut livré est « L1 »,
   * essayé dans tests/lot-profil-sw.test.cjs). `profil:null` : le défaut livré. */
  if(profil)b.ctx.BananeSettings={...b.ctx.BananeSettings,lot:{...S.lot,profil}};
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});}
 let fait=false;adapter.avantCommande=pendant?async q=>{if(fait||q!==quand)return;fait=true;await pendant(b);}:null;
 adapter.identity.cut=debut;adapter.rails=K.clone(base.rails);
 const n0=b.commands.length,o0=adapter.applyOptions.length;
 await b.api('start',{part:23,start:debut,end:fin,...SCOPE,...extra});await b.settle();await attendre(20);
 adapter.avantCommande=null;
 return {b,adapter,commandes:b.commands.slice(n0),options:adapter.applyOptions.slice(o0)};
}
/* Identifiants (opérations, captures) et horloges neutralisés, rien d'autre. */
const neutre=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='capturedAt'?'<clock>':v).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>'));
module.exports={lotClic,neutre,memoire,SCOPE,CLE_CLIC,CLE_GRAPPE,S};
