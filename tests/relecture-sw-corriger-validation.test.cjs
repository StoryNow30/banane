'use strict';
/* 5.0 (D-170 à D-173) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : corriger : validation sans écriture vue : arrêt sur ce cut, dit, intention notée. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinte,j,sansRelecture,PERMISSIF,apresLot,LECTURES,coupee}=require('./helpers/relecture-essais.cjs');

test('corriger : validation sans écriture vue → la passe s’arrête sur ce cut, le dit, et n’en visite aucun autre',async()=>{
 const {b,adapter,lot,local}=await H.lotRelecture({mode:'corriger',decisions:{109:14},reglagesProposes:PERMISSIF,esv:a=>{a.ecriture=null;}});
 const p=await H.finPasse(b);
 assert.equal(p.etat,'erreur');assert.match(p.message,/cut 109 : validation envoyée, aucune écriture vue/);
 assert.deepEqual(adapter.allees.map(a=>a.cut),[108,109]);assert.equal(adapter.enPlace.length,1);
 assert.deepEqual(local.m.banane50RelectureIntention?.cut,109,'correction incertaine notée');
 const etat=await b.api('relecture-etat');assert.equal(etat.correctionInterrompue.cut,109);
 assert.equal(H.evenements(b,'relecture-ombre').find(e=>e.identity.cut===109).action,'correction-incertaine');
 assert.equal(H.evenements(b,'relecture-fin')[0].issue,'erreur');
 assert.equal(apresLot(b,lot).filter(c=>c.action==='apply').length,1);
});
