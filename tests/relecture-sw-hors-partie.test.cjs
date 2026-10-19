'use strict';
/* 5.0 (D-170 à D-173) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : ESV hors de la partie du lot : pas de passe ; « Lancer la relecture » quand il y revient. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinte,j,sansRelecture,PERMISSIF,apresLot,LECTURES,coupee}=require('./helpers/relecture-essais.cjs');

test('la passe ne part pas si ESV n’est pas dans la partie du lot ; « Lancer la relecture » quand il y revient',async()=>{
 const {b,adapter}=await H.lotRelecture({mode:'ombre',relecture:{plafondCuts:3,departMs:60}});
 adapter.identity.part=24;await H.attendre(150);
 const r=b.get('relecture').passe;assert.equal(r.etat,'non-lancee');assert.match(r.message,/ESV affiche la partie 24, pas celle du lot \(23\)/);
 assert.equal(adapter.allees.length,0);assert.equal(H.evenements(b,'relecture-fin')[0].issue,'non-lancee');
 adapter.identity.part=23;const e=await b.api('relecture-lancer');assert.equal(e.passe.etat,'en-cours');
 const p=await H.finPasse(b);assert.equal(p.etat,'finie');assert.deepEqual(adapter.allees.map(a=>a.cut),[108,109,110]);
});
