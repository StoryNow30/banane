'use strict';
/* Montage des essais « déplacer la vue » côté service worker : service worker réel en VM, moteur et GCV1 réels, ESV simulé.
 * La capture porte une caméra par rail, centrée sur sa pose de départ, ±0,2 unité de scène (comme la vue d'ESV) : le cut 112
 * a sa pose de départ à 230 mm de la voie, sa décision (reprise depuis la voie) tombe hors de la vue et le lot le diffère.
 * `amener` règle la réponse de la page à `amenerDansLaVue` (pré-vol). Données synthétiques. */
const {production,normalize}=require('./perf-production.cjs'),{SimulatedESV,base,K}=require('../fixtures.cjs');
const O=require('../../src/continuity-observer.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const SIDES=['left','right'];
const decale=mm=>Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));
/* Caméra d'ESV centrée sur un rail : la caméra de la capture de base (orientation réelle), translatée sur le rail. */
function camerasParRail(rails){const c=base.camera,p0=c.cameraToSceneRelative.slice(12,15);
  return SIDES.map(s=>{const p=rails[s].positionSceneRelative,M=c.cameraToSceneRelative.slice();
    /* Le centre de la vue passe sur le rail, le long des axes de l'écran (la profondeur est gardée). */
    const ax=[M[0],M[1],M[2]],ay=[M[4],M[5],M[6]],d=p.map((v,i)=>v-p0[i]),u=ax[0]*d[0]+ax[1]*d[1]+ax[2]*d[2],w=ay[0]*d[0]+ay[1]*d[1]+ay[2]*d[2];
    for(let i=0;i<3;i++)M[12+i]=p0[i]+ax[i]*u+ay[i]*w;
    return {camera:{type:'OrthographicCamera',cameraToSceneRelative:M,sceneRelativeToCamera:K.C.inverse(M),projection:[5,0,0,0, 0,5*800/600,0,0, 0,0,-1e-4,0, 0,0,0,1],viewport:{left:0,top:0,width:800,height:600}}};});}
class EsvVue extends SimulatedESV{
 constructor(loin,amener={ok:true}){super();this.loin=new Set(loin);this.amener=amener;this.applyArgs=[];this.amenerArgs=[];}
 ajuster(){if(this.loin.has(this.identity.cut))this.rails=K.clone(decale(230));}
 async capture(expected){const d=await super.capture(expected);d.viewCaptures=camerasParRail(d.rails);return d;}
 async apply(before,proposals,...reste){this.applyArgs.push(reste.length);if(reste[0]?.deplacerVue)this.options=K.clone(reste[0]);return super.apply(before,proposals);}
 async amenerDansLaVue(cote,cible,attendu,options){this.calls.push('amenerDansLaVue');this.amenerArgs.push({cote,cible,attendu,options});
   const r=typeof this.amener==='function'?this.amener(cote):this.amener;return {version:'essai',cote,gestes:[],...r,remise:{ok:true,crans:0}};}
 async next(){await super.next();this.ajuster();return this.state();}
 async nextWithoutDecision(...a){const r=await super.nextWithoutDecision(...a);this.ajuster();return r;}
}
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
async function lot({reglage,amener,ombre=false,seuilsVoie=null}={}){
 const adapter=new EsvVue([112],amener),b=production({adapter});
 const S={...b.ctx.BananeSettings};if(reglage!==undefined)S.deplacerVue=reglage;
 /* L'ombre de la voie prédite est coupée ici : elle ne commande rien et alourdit l'essai (essayée à part). */
 if(!ombre)S.voiePrediteOmbre={...S.voiePrediteOmbre,actif:false};if(seuilsVoie)S.voiePrediteOmbre={...S.voiePrediteOmbre,...seuilsVoie};b.ctx.BananeSettings=S;
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(base.rails);
 await b.api('start',{part:23,start:111,end:112,...SCOPE});await b.settle();await attendre(20);
 return {b,adapter};
}
/* Identifiants (opérations, captures) et horloges neutralisés, rien d'autre. */
const neutre=x=>JSON.parse(JSON.stringify(normalize(x)).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>'));
const decisions=b=>b.store.events.filter(e=>e.type==='gcv1-shadow-observed').map(e=>{const {engineMs,...d}=e.lotObservation||{};return [e.identity?.cut,d];});
const metier=b=>b.store.events.filter(e=>!['voie-predite-ombre','b1-ombre','esv-observation','phase-timing','adapter-progress'].includes(e.type)).map(e=>e.type);
module.exports={lot,neutre,decisions,metier,SCOPE};
