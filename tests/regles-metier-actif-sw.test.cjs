'use strict';
/* 5.0 — ORBITE : LE CHEMIN D'ACTIVATION DES RÈGLES MÉTIER, COUPÉ PAR DÉFAUT, NE PEUT QUE DIFFÉRER. Service worker réel en VM
 * (tests/helpers/regles-metier-lot.cjs, données synthétiques, lot de 112 à 115). Avec `actif:true` et la seule règle
 * `grappe-differes` activée, le cut 114 (que le lot validait) et le cut 115 (dernier du lot, que le lot posait) sont différés :
 * une validation de moins, AUCUNE pose nouvelle, aucun type de commande nouveau, les cuts 112 et 113 inchangés. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {lot,neutre,decisions,ombres,deq,rec,S}=require('./helpers/regles-metier-lot.cjs');
let livre,actif;
before(async()=>{livre=await lot(undefined);actif=await lot({...S.reglesMetier,actif:true,regles:{...S.reglesMetier.regles,'grappe-differes':true}});});

test('règle activée : 114 différé au lieu d\'être validé ; aucune autre différence ; aucune pose nouvelle',()=>{
 const d0=decisions(livre.b),d1=decisions(actif.b);
 deq(d0.map(([c,x])=>[c,x.command?.action==='defer'?'defer':'pose']),[[112,'defer'],[113,'defer'],[114,'pose'],[115,'pose']],'réglage livré');
 deq(d1.map(([c,x])=>[c,x.command?.action]),[[112,'defer'],[113,'defer'],[114,'defer'],[115,'defer']]);
 for(const k of [2,3])assert.equal(d1[k][1].command.reason,'regles-metier');
 /* Les deux premiers cuts : décisions identiques octet pour octet. */
 assert.equal(JSON.stringify(neutre(d1.slice(0,2))),JSON.stringify(neutre(d0.slice(0,2))));
 /* Moins de validations et de poses, aucun type d'appel nouveau : la validation de 114 devient une navigation sans décision. */
 assert.equal(livre.adapter.calls.filter(c=>c==='validate').length,1);assert.equal(actif.adapter.calls.filter(c=>c==='validate').length,0);
 assert.equal(actif.adapter.calls.filter(c=>c==='apply').length,0,'aucune pose appliquée');assert.equal(livre.adapter.calls.filter(c=>c==='apply').length,2);
 for(const c of new Set(actif.adapter.calls))assert.ok(livre.adapter.calls.includes(c),'aucun type d\'appel nouveau : '+c);
 deq(rec(actif.b).filter(r=>r[0]<114),rec(livre.b).filter(r=>r[0]<114));
 assert.ok(rec(actif.b).some(r=>r[0]===114&&r[1]==='deferred-unresolved'),'114 différé');
 /* L'événement dit que la règle a agi. */
 const e=ombres(actif.b).find(x=>x.identity.cut===114);deq(e.actif,{applique:true,regles:['grappe-differes']});
});
