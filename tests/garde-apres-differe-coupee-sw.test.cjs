'use strict';
/* CH-019 — GARDE « APRÈS UN DIFFÉRÉ » COUPÉE (`lot.gardeApresDiffere.actif:false`) : le lot est celui d'avant CH-019. Les commandes envoyées à
 * ESV sont identiques, octet pour octet (après neutralisation des identifiants, horloges et version), à celles du même lot joué sur la tête
 * 165440b, sans le module (tests/fixtures/garde-apres-differe-base.json) ; la trace des commandes du lot aussi ; aucun événement de la garde.
 * (Même empreinte mesurée avec `gardeApresDiffere:false` et avec le module retiré du service worker.) Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lotGarde}=require('./helpers/garde-apres-differe-lot.cjs'),{neutre,h,versionGolden}=require('./helpers/lot-profil.cjs');
const BASE=require('./fixtures/garde-apres-differe-base.json');

test('garde coupée : commandes envoyées à ESV identiques à celles d\'avant CH-019, aucun événement',async()=>{
 const x=await lotGarde({garde:{actif:false}});
 assert.deepEqual(x.commandes.map(c=>c.action??null),BASE.actions);
 assert.equal(h(versionGolden(neutre(x.commandes))),BASE.empreinteCommandes,'commandes identiques, octet pour octet');
 assert.equal(h(neutre(x.batch.lotCommands)),BASE.empreinteLotCommands,'trace des commandes du lot identique');
 assert.deepEqual(x.differes,BASE.differes);assert.deepEqual(x.valides,BASE.valides);
 assert.equal(x.gardes.length,0);
 assert.equal(x.b.store.events.filter(e=>e.type==='garde-apres-differe-suivant').length,0);
 /* Sans la garde, le 115 s'appuie sur 113 et 114 (la borne haute de l'événement du cut suivant, mesurée). */
 assert.deepEqual(JSON.parse(JSON.stringify(x.b.store.events.find(e=>e.type==='gcv1-shadow-observed'&&e.identity?.cut===115).lotObservation.anchorsUsed)),[114,113]);
});
