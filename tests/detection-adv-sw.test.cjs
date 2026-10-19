'use strict';
/* 5.0 — ZONE D'ADV EN OMBRE (src/regles-metier.js `railsDePlus`, fiches/DETECTION_ADV.md) DANS LE SERVICE WORKER RÉEL. Montage
 * tests/helpers/regles-metier-lot.cjs : moteur et GCV1 réels, ESV simulé, lot 112–115 (112 et 113 capturés sans point, différés).
 * La capture du montage (partie 23, cut 2855, données de l'essai) montre un rail de plus de chaque côté : 114 est une alerte seule,
 * 115 la confirme. Ombre livrée contre ombre coupée : mêmes commandes ESV, mêmes rails, mêmes enregistrements, mêmes événements
 * métier, décisions du lot identiques octet pour octet. La zone ne change aucun verdict et ne sort aucune position. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {lot,neutre,decisions,metier,ombres,deq,rec,S}=require('./helpers/regles-metier-lot.cjs');
let coupe,ombre;
before(async()=>{coupe=await lot({...S.reglesMetier,ombre:false},{fin:115});ombre=await lot(undefined,{fin:115});});

test('LA POSE NE CHANGE PAS avec la zone d\'ADV : commandes, rails, enregistrements, événements métier, décisions octet pour octet',()=>{
 deq(neutre(ombre.b.commands),neutre(coupe.b.commands),'mêmes commandes ESV, même ordre');
 deq(neutre(ombre.adapter.rails),neutre(coupe.adapter.rails));deq(ombre.adapter.calls,coupe.adapter.calls);
 deq(rec(ombre.b),rec(coupe.b));deq(metier(ombre.b),metier(coupe.b),'mêmes événements métier');
 assert.equal(JSON.stringify(neutre(decisions(ombre.b))),JSON.stringify(neutre(decisions(coupe.b))),'décisions du lot identiques, octet pour octet');
 deq(decisions(coupe.b).map(([c,x])=>[c,x.stage]),[[112,'deferred'],[113,'deferred'],[114,'first-pass'],[115,'first-pass']]);
});

test('zone d\'ADV consignée : 114 alerte seule, 115 la confirme ; plage de 30 cuts de part et d\'autre ; verdicts inchangés ; aucune position',()=>{
 const e=ombres(ombre.b).filter(x=>x.portee==='cut');deq(e.map(x=>x.identity.cut),[112,113,114,115]);
 deq(e.map(x=>x.zone.adv),[null,null,'alerte-non-confirmee','alerte']);
 deq(e.map(x=>x.surface.advRails),[null,null,2,2],'rails de plus lus sur la capture (112 et 113 : sans point, pas de verdict)');
 deq(e[3].zone.advControle,[84,145]);assert.equal(e[2].zone.advControle,undefined);
 /* Les verdicts sont ceux des autres règles : la zone d'ADV n'en ajoute aucune. */
 for(const x of e)assert.ok(!x.regles.some(r=>/adv/i.test(r)),'aucune règle d\'ADV');
 deq(e.map(x=>x.aurait),['deja-differe','deja-differe','differer','differer']);
 for(const x of e)assert.ok(!/positionSceneRelative|"positions"|bords/.test(JSON.stringify(x)),'aucune position');
 deq(e[0].seuils.adv,JSON.parse(JSON.stringify(require('../src/regles-metier.js').DEFAULTS.adv)),'seuils de la zone au premier événement');
});
