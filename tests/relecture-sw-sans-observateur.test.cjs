'use strict';
/* 5.0 (D-170 à D-173) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : corriger sans observateur passif : ramené à l'ombre ; rythme humain tenu. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinte,j,sansRelecture,PERMISSIF,apresLot,LECTURES,coupee}=require('./helpers/relecture-essais.cjs');

test('corriger sans observateur passif : ramené à « ombre » (aucune écriture ne serait prouvée) ; le rythme humain est tenu',async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',observateur:false,decisions:{109:14},reglagesProposes:PERMISSIF,relecture:{plafondCuts:3,visiteMs:[150,150]}});
 const p=await H.finPasse(b);
 assert.equal(p.modeEffectif,'ombre');assert.match(p.message,/7|3 cuts relus|rien de modifié/);
 assert.equal(apresLot(b,lot).some(c=>c.action==='apply'||c.action==='validateInPlace'),false);
 assert.equal(H.evenements(b,'relecture-ombre').find(e=>e.identity.cut===109).critere.corriger,true);
 const t=adapter.allees.map(a=>a.t);for(let i=1;i<t.length;i++)assert.ok(t[i]-t[i-1]>=140,`visite d’au moins 150 ms (${t[i]-t[i-1]} ms)`);
});
