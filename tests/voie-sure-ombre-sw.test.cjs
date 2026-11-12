'use strict';
/* CH-114 (D-347) — RÈGLE « VOIE DES CUTS SÛRS » EN OMBRE, SERVICE WORKER RÉEL EN VM (moteur et GCV1 réels, ESV simulé ; montage de tests/helpers/perf-production.cjs).
 * L'ombre NE POSE RIEN : mêmes commandes à ESV, mêmes poses, mêmes enregistrements, mêmes événements métier, mêmes décisions (octet pour octet) avec et sans
 * elle, et en panne. Un événement `voie-sure-ombre` par cut VALIDÉ par le lot en zone `adv: alerte` (la zone de src/regles-metier.js est forcée à « alerte »
 * dans les trois lots après le cut 111, laissé hors zone : sans cut sûr avant lui, un cut en zone alerte s'abstient et ne devient pas une référence) ; rien réglage coupé ; les références sont les cuts que CE lot a posés avant. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs'),{SimulatedESV,base,K}=require('./fixtures.cjs');
const S=require('../src/settings.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const neutre=x=>JSON.parse(JSON.stringify(normalize(x)).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>'));
async function lot({reglage,panne=false}={}){
 const adapter=new SimulatedESV(),b=production({adapter});
 b.ctx.BananeSettings={...b.ctx.BananeSettings,lot:{...S.lot,profil:'actuel',...(reglage!==undefined?{voieSureOmbre:reglage}:{})}};
 const M=b.ctx.BananeReglesMetier,ev0=M.evaluer;b.ctx.BananeReglesMetier={...M,evaluer:(mem,r,...a)=>{const e=ev0(mem,r,...a);if(e?.zone)e.zone.adv=r?.cut===111?'':'alerte';return e;}};
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
let coupe,active,enPanne;
before(async()=>{coupe=await lot({reglage:{...S.lot.voieSureOmbre,actif:false}});active=await lot();enPanne=await lot({panne:true});});
test('LA POSE NE CHANGE PAS : mêmes commandes ESV, mêmes rails, mêmes enregistrements, décisions identiques octet pour octet, active et en panne',()=>{
 for(const [nom,x] of [['ombre active',active],['ombre en panne',enPanne]]){
  deq(neutre(x.b.commands),neutre(coupe.b.commands),nom+' : mêmes commandes ESV');deq(neutre(x.adapter.rails),neutre(coupe.adapter.rails),nom);deq(x.adapter.calls,coupe.adapter.calls,nom);
  const rec=b=>b.store.records.map(r=>[r.identity?.cut,r.status,r.validationProof??null,r.commandSent??null]);deq(rec(x.b),rec(coupe.b),nom);
  deq(metier(x.b),metier(coupe.b),nom+' : mêmes événements métier');
  assert.equal(JSON.stringify(neutre(decisions(x.b))),JSON.stringify(neutre(decisions(coupe.b))),nom+' : décisions du lot identiques, octet pour octet');
 }
 assert.ok(coupe.adapter.calls.filter(c=>c==='validate').length>=2,'le lot pose et valide plusieurs cuts');
});
test('un événement compact par cut validé en zone alerte ; rien réglage coupé ; la référence est le cut posé avant par le lot ; aucune coordonnée',()=>{
 assert.equal(evs(coupe.b,'voie-sure-ombre').length,0,'coupé : aucun calcul, aucun événement');
 const g=evs(active.b,'voie-sure-ombre'),valides=active.b.store.events.filter(e=>e.type==='validation-accepted').map(e=>e.identity.cut).filter(c=>c!==111);
 assert.ok(g.length>=2,'un événement par cut validé : '+g.length);deq(g.map(x=>x.identity.cut),valides,'un par validation, dans l’ordre');
 for(const x of g){assert.equal(x.version,'voie-sure-ombre-v1');assert.ok(x.batchId&&Number.isInteger(x.identity.cut));assert.equal(x.identity.part,23);
  for(const k of ['auraitDiffere','decalageGaucheMm','decalageDroitMm','moyenneMm','ecartCuts','seuilMm','referenceCut','motif','ms'])assert.ok(k in x,'champ '+k);
  assert.ok(!/positionSceneRelative|"positions"|"gauche"|"droite"/.test(JSON.stringify(x)));assert.ok(JSON.stringify(x).length<700);}
 assert.ok(valides.length>=2&&!g.some(x=>x.identity.cut===111),'cut 111 hors zone : aucun événement');assert.equal(g[0].referenceCut,111,'le cut 111, posé hors zone, est la première référence');deq(g[0].seuils,{...S.lot.voieSureOmbre},'le premier événement du lot porte le réglage');
 for(let i=0;i<g.length;i++){if(i)assert.equal(g[i].referenceCut,g[i-1].identity.cut,'référence = cut posé juste avant (aucun arrêt sur le banc)');assert.equal(g[i].auraitDiffere,false);assert.ok(Number.isFinite(g[i].decalageGaucheMm)&&Number.isFinite(g[i].decalageDroitMm));if(i)assert.equal(g[i].seuils,undefined);}
 assert.equal(evs(enPanne.b,'voie-sure-ombre').length,0,'en panne : aucun événement, le lot continue');
});
test('seul le service worker appelle le module, après la commande ; aucun chemin de pose ne le lit',()=>{
 const fs=require('node:fs'),path=require('node:path'),racine=path.resolve(__dirname,'..');
 const bg=fs.readFileSync(path.join(racine,'background.js'),'utf8');
 assert.match(bg,/'src\/serrage-lot-ombre\.js','src\/voie-sure-ombre\.js'/);
 for(const f of fs.readdirSync(path.join(racine,'src')).filter(x=>x.endsWith('.js')&&!/^(voie-sure-ombre|settings)\.js$/.test(x)))
  assert.doesNotMatch(fs.readFileSync(path.join(racine,'src',f),'utf8'),/BananeVoieSureOmbre|voie-sure-ombre|voieSureOmbre/,f+' ne lit pas l’ombre');
});
