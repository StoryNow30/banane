'use strict';
/* 5.0 (D-170 à D-173) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : les arguments de « Démarrer » ne comptent pas : empreinte du test 6 (tests/fixtures/choix-lot-50-base.json) inchangée. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinte,j,sansRelecture,PERMISSIF,apresLot,LECTURES,coupee}=require('./helpers/relecture-essais.cjs');
const {lotClic,neutre:neutreClic}=require('./helpers/choix-lot.cjs');
const {GOLDEN:GOLDEN_CLIC,h,versionGolden}=require('./helpers/choix-lot-essais.cjs');

test('coupée gardée, arguments de « Démarrer » trafiqués : ignorés ; empreinte du test 6 (choix du lot) inchangée',async()=>{
 const x=await lotClic({extra:{relecture:'corriger'},choix:{banane50Relecture:'coupee'}});
 assert.equal(h(versionGolden(neutreClic(x.commandes))),GOLDEN_CLIC.clic.empreinteCommandes);
 assert.equal('relecture' in x.b.get('engine').s.batch.scope,false);
});
