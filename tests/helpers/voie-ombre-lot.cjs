'use strict';
/* Montage des essais de l'ombre d'Orbite (voie-predite-ombre) : service worker réel en VM, moteur et GCV1 réels, ESV simulé dont
 * certains cuts ont leur pose de départ à 230 mm de la voie. Données synthétiques. */
const assert=require('node:assert/strict');
const {production,normalize}=require('./perf-production.cjs'),{SimulatedESV,base,K}=require('../fixtures.cjs');
const O=require('../../src/continuity-observer.js'),S=require('../../src/settings.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const SIDES=['left','right'];
/* Identifiants (opérations, captures) et horloges diffèrent d'une exécution à l'autre : ils sont neutralisés, rien d'autre. */
const neutre=x=>JSON.parse(JSON.stringify(normalize(x)).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>'));
const decale=mm=>Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));
/* ESV simulé dont les cuts de `loin` ont leur pose de départ à 230 mm de la voie (hors de la fenêtre du moteur). */
class EsvDecale extends SimulatedESV{
 constructor(loin){super();this.loin=new Set(loin);}
 ajuster(){if(this.loin.has(this.identity.cut))this.rails=K.clone(decale(230));}
 async next(){const r=await super.next();this.ajuster();return this.state();}
 async nextWithoutDecision(...a){const r=await super.nextWithoutDecision(...a);this.ajuster();return r;}
}
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
async function lot(reglage,{panne=false}={}){
 const adapter=new EsvDecale([112]),b=production({adapter});
 if(reglage!==undefined)b.ctx.BananeSettings={...b.ctx.BananeSettings,voiePrediteOmbre:reglage};
 /* 4.9.5.13 : profil du lot « actuel » (empreintes de la base). */
 b.ctx.BananeSettings={...b.ctx.BananeSettings,lot:{...S.lot,profil:'actuel'}};
 if(panne)b.ctx.BananeVoieRecentree={...b.ctx.BananeVoieRecentree,evaluerDiffere:()=>{throw Error('panne simulée de l\'ombre');}};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(base.rails);
 await b.api('start',{part:23,start:111,end:112,...SCOPE});await b.settle();
 await attendre(30);try{b.get('voieOmbreVider')();}catch{}await attendre(30);
 return {b,adapter};
}
const ombres=b=>b.store.events.filter(e=>e.type==='voie-predite-ombre');
const decisions=b=>b.store.events.filter(e=>e.type==='gcv1-shadow-observed').map(e=>{const {engineMs,...d}=e.lotObservation||{};return [e.identity?.cut,d];});
const metier=b=>b.store.events.filter(e=>!['voie-predite-ombre','b1-ombre','esv-observation','phase-timing'].includes(e.type)).map(e=>e.type);
module.exports={lot,neutre,decisions,metier,ombres,deq,SCOPE};
