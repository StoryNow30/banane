'use strict';
/* CH-079 (D-308) — cas « garde en panne » de tests/ch079-ombre-sw.test.cjs, séparé pour tenir sous la limite de 20 s par fichier du verify (Vision 6) :
 * une garde qui lève une exception ne change ni les commandes, ni les poses, ni les enregistrements, ni les décisions, et ne consigne aucun événement. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs'),{SimulatedESV,base,K}=require('./fixtures.cjs');
const S=require('../src/settings.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const neutre=x=>JSON.parse(JSON.stringify(normalize(x)).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>'));
async function lot({garde,serrage,panne=false}={}){
 const adapter=new SimulatedESV(),b=production({adapter});
 const lotReglage={...S.lot,profil:'actuel',...(garde!==undefined?{gardeVoieOmbre:garde}:{}),...(serrage!==undefined?{serrageLotOmbre:serrage}:{})};
 b.ctx.BananeSettings={...b.ctx.BananeSettings,lot:lotReglage};
 if(panne)b.ctx.BananeGardeVoieOmbre={...b.ctx.BananeGardeVoieOmbre,evaluer:()=>{throw Error('panne simulée de la garde');}};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(base.rails);
 await b.api('start',{part:23,start:111,end:114,...SCOPE});await b.settle();
 return {b,adapter};
}
const evs=(b,type)=>b.store.events.filter(e=>e.type===type);
const decisions=b=>b.store.events.filter(e=>e.type==='gcv1-shadow-observed').map(e=>{const {engineMs,...d}=e.lotObservation||{};return [e.identity?.cut,d];});
const metier=b=>b.store.events.filter(e=>!['garde-voie-ombre','serrage-lot-ombre','voie-b1-ecart-ombre','voie-predite-ombre','b1-ombre','esv-observation','phase-timing'].includes(e.type)).map(e=>e.type);
let coupe,enPanne;
before(async()=>{
 coupe=await lot({garde:{...S.lot.gardeVoieOmbre,actif:false},serrage:{...S.lot.serrageLotOmbre,actif:false}});
 enPanne=await lot({garde:{...S.lot.gardeVoieOmbre,voisinesMin:1},panne:true});
});
test('garde en panne : mêmes commandes, poses, enregistrements, événements métier et décisions ; aucun événement de garde ; le lot continue',()=>{
 const x=enPanne,nom='garde en panne';
 deq(neutre(x.b.commands),neutre(coupe.b.commands),nom+' : mêmes commandes ESV');deq(neutre(x.adapter.rails),neutre(coupe.adapter.rails),nom);deq(x.adapter.calls,coupe.adapter.calls,nom);
 const rec=b=>b.store.records.map(r=>[r.identity?.cut,r.status,r.validationProof??null,r.commandSent??null]);deq(rec(x.b),rec(coupe.b),nom);
 deq(metier(x.b),metier(coupe.b),nom+' : mêmes événements métier');
 assert.equal(JSON.stringify(neutre(decisions(x.b))),JSON.stringify(neutre(decisions(coupe.b))),nom+' : décisions du lot identiques, octet pour octet');
 assert.equal(evs(enPanne.b,'garde-voie-ombre').length,0);
 assert.ok(coupe.adapter.calls.filter(c=>c==='validate').length>=2,'le lot pose et valide plusieurs cuts');
});
