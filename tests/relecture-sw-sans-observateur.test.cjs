'use strict';
/* 5.0 (D-170 à D-176) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : corriger sans observateur
 * passif : ramené à l'ombre (aucune écriture ne serait prouvée), et dit. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,PERMISSIF,apresLot}=require('./helpers/relecture-essais.cjs');

test('corriger sans observateur passif : ramené à « ombre » (aucune écriture ne serait prouvée), et dit',async()=>{
 const {b,lot}=await H.lotRelecture({mode:'corriger',observateur:false,decisions:{109:14},reglagesProposes:PERMISSIF,relecture:{plafondCuts:3}});
 const p=await H.finPasse(b);
 assert.equal(p.modeEffectif,'ombre');assert.match(p.message,/^Relecture finie : 3 cuts relus, rien de modifié/);
 assert.match(H.evenements(b,'relecture-debut')[0].motif,/observateur passif est coupé/);
 assert.equal(apresLot(b,lot).some(c=>['apply','validerMajEspace','validateInPlace'].includes(c.action)),false);
 assert.equal(H.evenements(b,'relecture-ombre').find(e=>e.identity.cut===109).critere.corriger,true);
});
