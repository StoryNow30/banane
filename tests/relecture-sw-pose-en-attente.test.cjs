'use strict';
/* 5.0 (D-170 à D-173) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : pose d'Ariane non validée sur le cut affiché : pas de passe tant que l'opérateur ne l'a pas validée. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinte,j,sansRelecture,PERMISSIF,apresLot,LECTURES,coupee}=require('./helpers/relecture-essais.cjs');

test('lot borné dont le dernier cut est posé sans validation : la passe attend que l\'opérateur valide ce cut, puis « Lancer la relecture »',async()=>{
 const {b,adapter}=await H.lotRelecture({mode:'ombre',loin:[],relecture:{plafondCuts:3}});await H.attendre(100);
 const r=b.get('relecture').passe;assert.equal(r.etat,'non-lancee');assert.match(r.message,/une pose d’Ariane attend ta validation au cut 113/);
 await assert.rejects(b.api('relecture-lancer'),/attend ta validation au cut 113/);assert.equal(adapter.allees.length,0);
 /* L'opérateur valide le cut 113 dans ESV, qui passe à un autre cut : la passe peut partir. */
 adapter.identity.cut=114;await b.api('relecture-lancer');const p=await H.finPasse(b);assert.equal(p.etat,'finie');assert.ok(adapter.allees.length>=1);
});
