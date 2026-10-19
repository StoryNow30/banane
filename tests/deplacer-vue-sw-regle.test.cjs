'use strict';
/* 5.0 — « DÉPLACER LA VUE » DANS LE LOT : LA RÈGLE PRUDENTE D-147 (réglage `deplacerVue.regle`, 'prudente' par défaut). Même montage
 * que tests/deplacer-vue-sw.test.cjs. Le cut 112 tient la règle aux seuils livrés (confiance 68 et 70, chaîne 1, écartement à 2,2 mm
 * des appuis : posé dans tests/deplacer-vue-sw-actif.test.cjs) ; avec une confiance minimale de 99, il ne la tient plus : aucun
 * geste, aucune commande à la page, le cut reste différé comme aujourd'hui, et le refus est consigné avec ce que la règle a lu. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {lot,decisions}=require('./helpers/deplacer-vue-lot.cjs'),S=require('../src/settings.js');
const GOLDEN=require('./fixtures/lot-sans-vue-50-base.json');
let x;
before(async()=>{x=await lot({reglage:{...S.deplacerVue,actif:true},seuilsVoie:{confianceMin:99}});});
test('règle non tenue (confiance < 99) : pas de pré-vol, pas de geste, cut différé comme aujourd\'hui ; refus consigné',()=>{
 assert.equal(S.deplacerVue.regle,'prudente');
 const d=decisions(x.b).find(([c])=>c===112)[1];assert.equal(d.command.action,'defer');assert.equal(d.command.reason,'guard-hors-vue-left');
 assert.deepEqual(x.adapter.calls,GOLDEN.appels,'aucune commande de plus');assert.deepEqual(x.adapter.applyArgs,GOLDEN.applyArgs);
 const e=x.b.store.events.filter(v=>v.type==='deplacer-vue');assert.equal(e.length,1);
 assert.equal(e[0].refus,'regle:confiance');assert.equal(e[0].regle.posable,false);
 assert.equal(JSON.stringify(e[0].regle.confiance),JSON.stringify({left:68,right:70}));assert.equal(e[0].regle.profondeur,1);
});
