'use strict';
/* 5.0 (D-170 à D-173) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : corriger : clic du lot repris par la passe ; pose refusée par la page remise, cut quitté sans action. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinte,j,sansRelecture,PERMISSIF,apresLot,LECTURES,coupee}=require('./helpers/relecture-essais.cjs');

test('corriger : le clic figé dans le lot sert aussi à la passe ; une pose refusée par la page est remise et le cut quitté sans action',async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',clic:'tout-recentre',decisions:{109:14,110:16},reglagesProposes:PERMISSIF,relecture:{plafondCuts:4},
  esv:a=>{a.refusApply=cut=>cut===110;}});
 const p=await H.finPasse(b);
 assert.equal(p.etat,'finie');assert.equal(p.corriges,1);assert.equal(p.refusees,1);
 const lotOpt=lot.filter(c=>c.action==='apply').map(c=>c.args[2]),passeOpt=apresLot(b,lot).filter(c=>c.action==='apply').map(c=>c.args[2]);
 assert.deepEqual(j(lotOpt),[{clicHumain:'tout-recentre'},{clicHumain:'tout-recentre'}]);assert.deepEqual(j(passeOpt),[{clicHumain:'tout-recentre'},{clicHumain:'tout-recentre'}]);
 assert.deepEqual(adapter.enPlace.map(x=>x.cut),[109],'aucune validation après le refus');
 const e110=H.evenements(b,'relecture-ombre').find(e=>e.identity.cut===110);
 assert.equal(e110.action,'correction-refusee');assert.match(e110.raisonAction,/pose refusée par la page.*pose remise/);
 assert.ok(apresLot(b,lot).some(c=>c.action==='restore'),'remise à la pose d’avant');
 assert.ok(H.K.equalPoses(adapter.rails,adapter.railsDe(110))||adapter.identity.cut!==110);
});
