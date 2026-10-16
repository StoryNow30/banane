'use strict';
/* 5.0 — ORBITE : UNE PANNE DU MODULE DES RÈGLES MÉTIER NE CHANGE RIEN. Service worker réel en VM (montage :
 * tests/helpers/regles-metier-lot.cjs, données synthétiques, lot de 112 à 114) ; le module lève à chaque évaluation, réglage
 * ACTIF avec toutes les règles activées (le pire cas). Mêmes commandes ESV, mêmes rails, mêmes enregistrements, mêmes événements
 * métier, décisions identiques octet pour octet qu'avec l'ombre coupée ; seule trace : des événements « erreur ». */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {lot,neutre,decisions,metier,ombres,deq,rec,S}=require('./helpers/regles-metier-lot.cjs');
let coupe,panne;
const tout=Object.fromEntries(Object.keys(S.reglesMetier.regles).map(k=>[k,true]));
before(async()=>{coupe=await lot({...S.reglesMetier,ombre:false},{fin:114});panne=await lot({ombre:true,actif:true,regles:tout},{panne:true,fin:114});});

test('module en panne, même activé : la pose ne change pas',()=>{
 deq(neutre(panne.b.commands),neutre(coupe.b.commands),'mêmes commandes ESV, même ordre');
 deq(neutre(panne.adapter.rails),neutre(coupe.adapter.rails));deq(panne.adapter.calls,coupe.adapter.calls);deq(rec(panne.b),rec(coupe.b));
 deq(metier(panne.b),metier(coupe.b),'mêmes événements métier');
 assert.equal(JSON.stringify(neutre(decisions(panne.b))),JSON.stringify(neutre(decisions(coupe.b))),'décisions identiques, octet pour octet');
});

test('module en panne : une trace « erreur » par cut, rien d\'autre',()=>{
 const e=ombres(panne.b);deq(e.map(x=>x.identity.cut),[112,113,114]);
 for(const x of e){assert.equal(x.etat,'erreur');assert.match(x.message,/panne simulée/);assert.equal(x.aurait,undefined);}
});
