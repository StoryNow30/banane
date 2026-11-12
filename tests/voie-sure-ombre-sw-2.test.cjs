'use strict';
/* CH-114 (D-347) — RÈGLE « VOIE DES CUTS SÛRS » EN OMBRE, SERVICE WORKER RÉEL EN VM (moteur et GCV1 réels, ESV simulé ; montage de tests/helpers/perf-production.cjs).
 * L'ombre NE POSE RIEN : mêmes commandes à ESV, mêmes poses, mêmes enregistrements, mêmes événements métier, mêmes décisions (octet pour octet) avec et sans
 * elle, et en panne. Un événement `voie-sure-ombre` par cut VALIDÉ par le lot en zone `adv: alerte` (la zone de src/regles-metier.js est forcée à « alerte »
 * dans les trois lots après le cut 111, laissé hors zone, le cut 112 en marge (verdict d'origine seul) : sans cut sûr avant lui, un cut en zone alerte s'abstient et ne devient pas une référence) ; rien réglage coupé ; les références sont les cuts que CE lot a posés avant. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs'),{SimulatedESV,base,K}=require('./fixtures.cjs');
const S=require('../src/settings.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const neutre=x=>JSON.parse(JSON.stringify(normalize(x)).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>'));
async function lot({reglage,panne=false}={}){
 const adapter=new SimulatedESV(),b=production({adapter});
 b.ctx.BananeSettings={...b.ctx.BananeSettings,lot:{...S.lot,profil:'actuel',...(reglage!==undefined?{voieSureOmbre:reglage}:{})}};
 const M=b.ctx.BananeReglesMetier,ev0=M.evaluer;b.ctx.BananeReglesMetier={...M,evaluer:(mem,r,...a)=>{const e=ev0(mem,r,...a);if(e?.zone)e.zone.adv=r?.cut===111?'':r?.cut===112?'marge-apres':'alerte';return e;}};
 if(panne)b.ctx.BananeVoieSureOmbre={...b.ctx.BananeVoieSureOmbre,evaluer:()=>{throw Error('panne simulée de la voie sûre');}};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(base.rails);
 await b.api('start',{part:23,start:111,end:114,...SCOPE});await b.settle();
 return {b,adapter};
}
const evs=(b,type)=>b.store.events.filter(e=>e.type===type);
const decisions=b=>b.store.events.filter(e=>e.type==='gcv1-shadow-observed').map(e=>{const {engineMs,...d}=e.lotObservation||{};return [e.identity?.cut,d];});
const OMBRES=['voie-sure-ombre','garde-voie-ombre','serrage-lot-ombre','voie-b1-ecart-ombre','voie-predite-ombre','b1-ombre','esv-observation','phase-timing'];
const metier=b=>b.store.events.filter(e=>!OMBRES.includes(e.type)).map(e=>e.type);
/* Fichier réparti le 12/11 (28 s seul, plus que la limite de 20 s par fichier du verify) : chaque fichier rejoue le lot témoin (ombre coupée) et une seule variante. Mêmes essais. */
let coupe,enPanne;
before(async()=>{coupe=await lot({reglage:{...S.lot.voieSureOmbre,actif:false}});enPanne=await lot({panne:true});});

test('LA POSE NE CHANGE PAS (en panne) : mêmes commandes ESV, mêmes rails, mêmes enregistrements, décisions identiques octet pour octet, active et en panne',()=>{
 for(const [nom,x] of [['ombre en panne',enPanne]]){
  deq(neutre(x.b.commands),neutre(coupe.b.commands),nom+' : mêmes commandes ESV');deq(neutre(x.adapter.rails),neutre(coupe.adapter.rails),nom);deq(x.adapter.calls,coupe.adapter.calls,nom);
  const rec=b=>b.store.records.map(r=>[r.identity?.cut,r.status,r.validationProof??null,r.commandSent??null]);deq(rec(x.b),rec(coupe.b),nom);
  deq(metier(x.b),metier(coupe.b),nom+' : mêmes événements métier');
  assert.equal(JSON.stringify(neutre(decisions(x.b))),JSON.stringify(neutre(decisions(coupe.b))),nom+' : décisions du lot identiques, octet pour octet');
 }
 assert.ok(coupe.adapter.calls.filter(c=>c==='validate').length>=2,'le lot pose et valide plusieurs cuts');
});
test('en panne : aucun événement, le lot continue',()=>{
 assert.equal(evs(enPanne.b,'voie-sure-ombre').length,0,'en panne : aucun événement, le lot continue');
});
