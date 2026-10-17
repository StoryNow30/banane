'use strict';
/* 5.0 (D-170 à D-176) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : panne d'ESV pendant la passe :
 * arrêt net, rien de posé ensuite. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,PERMISSIF,apresLot}=require('./helpers/relecture-essais.cjs');

test('panne pendant la passe (ESV sans réponse au cut où Maj+Espace a mené) : arrêt net, rien de posé ensuite',async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',decisions:{109:14,115:20},reglagesProposes:PERMISSIF,esv:a=>{a.panneCapture.add(110);}});
 const p=await H.finPasse(b);
 assert.equal(p.etat,'erreur');assert.match(p.message,/arrêtée au cut 110 : Adaptateur ESV sans réponse/);
 assert.deepEqual(adapter.allees.map(a=>a.cut),[107,108,109]);assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109]);
 assert.equal(apresLot(b,lot).filter(c=>c.action==='apply').length,1);
});
