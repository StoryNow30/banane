'use strict';
/* 5.0 (audit 5.0, I8 (1)) — ORBITE : UNE PANNE DE L'OMBRE `voie-predite-ombre` NE CHANGE RIEN. Service worker réel en VM (montage :
 * tests/helpers/voie-ombre-lot.cjs) ; l'ombre lève une erreur à chaque différé. Mêmes commandes ESV, mêmes rails, mêmes enregistrements,
 * mêmes événements métier, décisions identiques octet pour octet qu'avec l'ombre coupée ; seule trace : un événement « erreur ».
 * Données synthétiques. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {lot,neutre,decisions,metier,ombres,deq}=require('./helpers/voie-ombre-lot.cjs'),S=require('../src/settings.js');
let coupe,panne;
before(async()=>{coupe=await lot({...S.voiePrediteOmbre,actif:false});panne=await lot(undefined,{panne:true});});

test('ombre en panne : la pose ne change pas',()=>{
 deq(neutre(panne.b.commands),neutre(coupe.b.commands),'mêmes commandes ESV, même ordre');
 deq(neutre(panne.adapter.rails),neutre(coupe.adapter.rails));deq(panne.adapter.calls,coupe.adapter.calls);
 const rec=b=>b.store.records.map(r=>[r.identity?.cut,r.status,r.validationProof??null,r.commandSent??null]);deq(rec(panne.b),rec(coupe.b));
 deq(metier(panne.b),metier(coupe.b),'mêmes événements métier');
 assert.equal(JSON.stringify(neutre(decisions(panne.b))),JSON.stringify(neutre(decisions(coupe.b))),'décisions identiques, octet pour octet');
});

test('ombre en panne : une seule trace, l\'événement « erreur » du cut différé',()=>{
 const e=ombres(panne.b);deq(e.map(x=>x.identity.cut),[112]);
 assert.equal(e[0].etat,'erreur');assert.match(e[0].message,/panne simulée/);assert.equal(e[0].verdict,undefined);
});
