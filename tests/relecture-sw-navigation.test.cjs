'use strict';
/* 5.0, revue de la relecture (W8) — un refus de navigation de la page ne fait sauter la plage que s'il vient des bornes de la partie ou
 * d'une annulation ; tout autre refus (page occupée, chemin indisponible…) arrête la passe, sans rien poser. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,apresLot}=require('./helpers/relecture-essais.cjs');

test('refus « hors des bornes » : plage sautée, la passe continue ; refus « page occupée » : la passe s’arrête',async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'ombre',esv:a=>{a.refusAller=cut=>cut===108?'OUT_OF_BOUNDS':null;}});
 const p=await H.finPasse(b);
 assert.equal(p.etat,'finie',p.message);assert.equal(p.faits,0,'la seule plage (108–116) est sautée');
 const e=H.evenements(b,'relecture-ombre');assert.equal(e.length,1);assert.equal(e[0].action,'navigation-refusee');assert.match(e[0].raison,/OUT_OF_BOUNDS/);
 adapter.refusAller=cut=>cut===109?'ADAPTER_BUSY':null;
 await b.api('relecture-lancer');const q=await H.finPasse(b);
 assert.equal(q.etat,'erreur');assert.match(q.message,/passage au cut 109 refusé par la page \(refus simulé \(ADAPTER_BUSY\)/);
 assert.equal(q.faits,1,'108 relu, puis arrêt');
 assert.equal(apresLot(b,lot).some(c=>['apply','validerMajEspace'].includes(c.action)),false);
});
