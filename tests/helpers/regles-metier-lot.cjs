'use strict';
require('./relecture-reglable.cjs');   /* test 27 : les empreintes de base de ces essais sont celles d'un lot sans relecture (choix réglable, coupée) */
/* Montage des essais de l'ombre des règles métier (regles-metier-ombre) : service worker réel en VM, moteur et GCV1 réels, ESV
 * simulé dont les cuts 112 et 113 sont capturés sans aucun point (le moteur s'abstient, le lot les diffère). Les cuts 114 et 115 sont alors
 * des cuts que le lot pose juste après une grappe de différés : la règle `grappe-differes` se déclenche. Le dernier cut d'un lot
 * est posé sans être validé (arrêt en fin de lot). Données synthétiques. */
const {lot:lotVoie,neutre,decisions,deq,SCOPE}=require('./voie-ombre-lot.cjs');
const {production}=require('./perf-production.cjs'),{SimulatedESV,base,K}=require('../fixtures.cjs');
const O=require('../../src/continuity-observer.js'),S=require('../../src/settings.js');
const SIDES=['left','right'];
const decale=mm=>Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));
/* Les cuts de `vides` sont capturés sans aucun point : le moteur s'abstient, le lot les diffère (et vite). */
class EsvTrous extends SimulatedESV{
 constructor(vides){super();this.vides=new Set(vides);}
 ajuster(){this.noPoints=this.vides.has(this.identity.cut);}
 async next(){const r=await super.next();this.ajuster();return this.state();}
 async nextWithoutDecision(...a){const r=await super.nextWithoutDecision(...a);this.ajuster();return r;}
}
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
/* `reglage` : valeur de `reglesMetier` (undefined : celui livré) ; `panne` : le module lève à chaque évaluation ; `avant(b)` : appelé avant
 * le départ du lot (réglages, stockage). */
async function lot(reglage,{panne=false,fin=115,avant=null,profil='actuel',garde=false}={}){
 const adapter=new EsvTrous([112,113]),b=production({adapter});
 /* L'ombre de la voie prédite est coupée ici : elle relance le moteur sur chaque différé et n'est pas l'objet de ces essais. */
 b.ctx.BananeSettings={...b.ctx.BananeSettings,voiePrediteOmbre:{...S.voiePrediteOmbre,actif:false},...(reglage!==undefined?{reglesMetier:reglage}:{})};
 /* 4.9.5.13 : profil du lot « actuel » par défaut ici (empreintes de la base) ; `profil:null` : le défaut livré (« L1 »). */
 if(profil)b.ctx.BananeSettings={...b.ctx.BananeSettings,lot:{...S.lot,profil}};
 /* CH-019 : la garde « après un différé » (livrée allumée) diffère le 114, posé juste après la grappe 112-113 ; elle n'est pas l'objet de ces
  * essais et est coupée ici (empreintes de la base) ; `garde:undefined` : le réglage livré (essayée dans tests/garde-apres-differe-*-sw.test.cjs). */
 if(garde!==undefined)b.ctx.BananeSettings={...b.ctx.BananeSettings,lot:{...b.ctx.BananeSettings.lot,gardeApresDiffere:garde}};
 if(panne)b.ctx.BananeReglesMetier={...b.ctx.BananeReglesMetier,evaluer:()=>{throw Error('panne simulée des règles métier');}};
 if(avant)await avant(b);
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=112;adapter.rails=K.clone(base.rails);adapter.ajuster();
 await b.api('start',{part:23,start:112,end:fin,...SCOPE});await b.settle();
 await attendre(30);
 return {b,adapter};
}
const ombres=b=>b.store.events.filter(e=>e.type==='regles-metier-ombre');
const metier=b=>b.store.events.filter(e=>!['regles-metier-ombre','deplacer-vue','deplacer-vue-geste','faux-vert-ombre','voie-predite-ombre','b1-ombre','esv-observation','phase-timing'].includes(e.type)).map(e=>e.type);
const rec=b=>b.store.records.map(r=>[r.identity?.cut,r.status,r.validationProof??null,r.commandSent??null]);
module.exports={lot,neutre,decisions,metier,ombres,deq,rec,S};
