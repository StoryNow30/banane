'use strict';
/* D-288 — GARDE « APRÈS UN DIFFÉRÉ » COUPÉE EN OMBRE (valeur livrée : `lot.gardeApresDiffere` = { actif:false, ombre:true }). La production ne
 * change pas : commandes envoyées à ESV identiques, octet pour octet, à celles du lot sans la garde (tests/fixtures/garde-apres-differe-base.json,
 * même empreinte que la garde coupée) ; aucun cut différé par la garde. Le cut qu'elle aurait différé (113 : un différé juste avant, 1 appui) est
 * consigné dans un événement `garde-apres-differe-ombre`, pour juger ces poses contre l'Écho et la relecture. Une panne de l'ombre ne change
 * rien. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lotGarde}=require('./helpers/garde-apres-differe-lot.cjs'),{neutre,h,versionGolden,S}=require('./helpers/lot-profil.cjs');
const BASE=require('./fixtures/garde-apres-differe-base.json');

test('D-288 : garde livrée coupée en ombre ; production identique au lot sans garde, cut qu\'elle aurait différé consigné',async()=>{
 assert.deepEqual({...S.lot.gardeApresDiffere},{actif:false,ombre:true,regle:'R3',coupures:2,appuisMin:2});
 const x=await lotGarde({garde:S.lot.gardeApresDiffere,fin:115});
 assert.deepEqual(x.commandes.map(c=>c.action??null),BASE.actions);
 assert.equal(h(versionGolden(neutre(x.commandes))),BASE.empreinteCommandes,'commandes identiques, octet pour octet');
 assert.equal(h(neutre(x.batch.lotCommands)),BASE.empreinteLotCommands,'trace des commandes du lot identique');
 assert.deepEqual(x.differes,BASE.differes);assert.deepEqual(x.valides,BASE.valides);
 assert.equal(x.gardes.length,0,'aucun différé par la garde');
 assert.equal(x.b.store.events.filter(e=>e.type==='garde-apres-differe-suivant').length,0);
 const o=JSON.parse(JSON.stringify(x.b.store.events.filter(e=>e.type==='garde-apres-differe-ombre')));
 assert.deepEqual(o.map(e=>({cut:e.identity.cut,part:e.identity.part,regle:e.regle,appuis:e.appuis,voisins:e.voisinsDifferes,gardee:e.commandeGardee,version:e.version})),
  [{cut:113,part:23,regle:'R3',appuis:1,voisins:[112],gardee:{action:'engine',reason:'first-pass'},version:'garde-apres-differe-1'}]);
 assert.ok(!x.commandes.some(c=>/skip/i.test(String(c.action))),'jamais de SKIP');
});
