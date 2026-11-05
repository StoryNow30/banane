'use strict';
/* Sorti de voie-b1-ecart-ombre-sw.test.cjs (intégration CH-056) : quatre lots dans un seul fichier dépassaient 16 s, près de la borne de 20 s du verify. */
/* CH-055 — ORBITE : UN ÉVÉNEMENT `voie-b1-ecart-ombre` PAR CUT DIFFÉRÉ, SERVICE WORKER RÉEL EN VM (moteur et GCV1 réels, ESV simulé). L'ombre
 * consigne ce qu'aurait posé la règle « b1-ecart » (src/voie-b1-ecart.js : chaîne de l'ombre, lignes valides de la liste d'ESV, complément par
 * l'écartement). ELLE NE POSE RIEN : mêmes commandes à ESV, mêmes poses, mêmes enregistrements, mêmes décisions (octet pour octet) avec et sans
 * elle, et une panne de l'ombre ne change rien. Données synthétiques (montage de tests/helpers/voie-ombre-lot.cjs : le cut 111 est posé, le
 * cut 112 a sa pose de départ à 230 mm de la voie). Le calcul lourd est différé (file de l'ombre, vidée à la capture suivante ou 4 s). */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs'),{SimulatedESV,base,K}=require('./fixtures.cjs');
const O=require('../src/continuity-observer.js'),S=require('../src/settings.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const SIDES=['left','right'];
const neutre=x=>JSON.parse(JSON.stringify(normalize(x)).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>'));
const decale=mm=>Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));
class EsvDecale extends SimulatedESV{
 constructor(loin,mm=230){super();this.loin=new Set(loin);this.mm=mm;}
 ajuster(){if(this.loin.has(this.identity.cut))this.rails=K.clone(decale(this.mm));}
 async next(){await super.next();this.ajuster();return this.state();}
 async nextWithoutDecision(...a){const r=await super.nextWithoutDecision(...a);this.ajuster();return r;}
}
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
/* Instantané compact de la liste d'ESV (src/liste-memoire.js) dans le stockage local du service worker : lignes VALIDES à la vraie pose (la pose de
 * base de la fixture) pour les cuts `valides`, lignes invalides à la pose de départ décalée pour `loin`, monde = scène + T0. */
const LM=require('../src/liste-memoire.js'),T0=[1234.5,2345.25,3.125];
function instantane(part,valides,loin,mm=230){
 const n=120,st=new Array(n).fill(3),fl=new Array(n).fill(0),ed=new Array(6*n).fill(null);
 const pose=(cut,rails)=>{st[cut]=valides.includes(cut)?0:1;SIDES.forEach((s,k)=>rails[s].positionSceneRelative.forEach((v,i)=>{ed[6*cut+3*k+i]=Math.round((v+T0[i])*1e4);}));};
 for(const c of valides)pose(c,base.rails);
 for(const c of loin)pose(c,decale(mm));
 return {['banane5ListeInstantane:'+part]:LM.compacter({st,fl,ed},{partie:part,at:'2026-01-01T00:00:00.000Z',version:'5',cle:'essai'})};
}
async function lot(reglage,{panne=false,loin=[112],liste=null,mm=230}={}){
 const {memoire}=require('./helpers/perf-production.cjs');
 const local=memoire();if(liste)await local.set(liste);
 const adapter=new EsvDecale(loin,mm),b=production({adapter,local});
 const lotReglage={...S.lot,profil:'actuel',...(reglage!==undefined?{voieB1EcartOmbre:reglage}:{})};
 b.ctx.BananeSettings={...b.ctx.BananeSettings,lot:lotReglage};
 if(panne)b.ctx.BananeVoieB1Ecart={...b.ctx.BananeVoieB1Ecart,evaluer:()=>{throw Error('panne simulée de l\'ombre');}};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(loin.includes(111)?decale(mm):base.rails);
 await b.api('start',{part:23,start:111,end:112,...SCOPE});await b.settle();
 await attendre(30);try{b.get('voieOmbreVider')();}catch{}await attendre(200);
 return {b,adapter};
}
const ombres=b=>b.store.events.filter(e=>e.type==='voie-b1-ecart-ombre');
const decisions=b=>b.store.events.filter(e=>e.type==='gcv1-shadow-observed').map(e=>{const {engineMs,...d}=e.lotObservation||{};return [e.identity?.cut,d];});
const metier=b=>b.store.events.filter(e=>!['voie-b1-ecart-ombre','voie-predite-ombre','b1-ombre','esv-observation','phase-timing'].includes(e.type)).map(e=>e.type);
let avecListe;
before(async()=>{
 /* 290 mm : au-delà de ce que le moteur seul retrouve sur ce nuage (mesuré : à 270 mm il pose encore seul, en premier passage). */
 avecListe=await lot(undefined,{loin:[111,112],mm:290,liste:instantane(23,[100,101,102,103,104,105,106,107,108,109,110,113,114,115],[111,112],290)});});

test('liste d\'ESV dans le stockage local : lue une fois par lot, repère T lu sur la ligne du cut, lignes valides et référence d\'écartement consignées ; le lot ne change pas',()=>{
 /* Deux cuts à 290 mm, sans appui réel : le moteur seul les diffère. L'ombre lit l'instantané (repère calibré, lignes valides, écartement de la
  * liste) et tente la reprise depuis la voie des lignes (B1) puis le complément. Sur cette fixture (toutes les lignes au même point de scène : la
  * voie n'a pas de direction, et les points lus autour de la pose de départ sont rares à 290 mm) la reprise ne trouve pas de minimum qualifié :
  * l'abstention est dite avec sa raison. La pose par la liste est prouvée sur une voie synthétique (tests/voie-b1-ecart.test.cjs) et mesurée sur
  * les lots réels par le rejeu (chantiers/CH-053/M-rapport.md : même code, src/voie-b1-ecart.js). */
 const e=ombres(avecListe.b);
 deq(e.map(x=>x.identity.cut),[111,112],'deux différés');
 for(const x of e){
  assert.equal(x.reel.stage,'deferred');assert.equal(x.repere,'calibre','T lue sur la ligne invalide du cut');
  assert.ok(x.lignesValides.length>=5&&x.lignesValides.every(c=>c>=106&&c<=115&&c!==111&&c!==112),'lignes valides de la fenêtre de ±5 : '+x.lignesValides);
  assert.equal(x.gRef.source,'liste');assert.ok(Math.abs(x.gRef.mm-1500)<2,'écartement des lignes valides (pose de base de la fixture : 1 500 mm) : '+x.gRef.mm);
  if(!x.verdict.posable)assert.match(x.verdict.raison,/^b1:/,'la liste a été essayée en premier : '+x.verdict.raison);
  else assert.ok(['b1','serie','ecart'].includes(x.source));
  assert.ok(Number.isFinite(x.ms)&&x.ms<15000,'coût mesuré : '+x.ms+' ms');
 }
 assert.equal(avecListe.adapter.calls.filter(c=>c==='validate').length,0,'rien n\'est validé : les deux cuts restent différés');
 const d=decisions(avecListe.b);deq(d.map(([c,y])=>[c,y.command?.action]),[[111,'engine'],[112,'engine']]);deq(d.map(([c,y])=>y.stage),['deferred','deferred']);
});
