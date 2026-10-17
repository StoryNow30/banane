'use strict';
/* 5.0 (D-170 à D-176) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : corriger : la pose de la passe
 * clique toujours « tout-recentre » (revue, T-5 : jamais de clic direct), quel que soit le clic figé dans le lot ; une pose refusée
 * par la page est remise et le cut quitté sans action, et la passe continue par un pas. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,j,PERMISSIF,apresLot}=require('./helpers/relecture-essais.cjs');

test('corriger : clic « tout-recentre » pour la passe, quel que soit celui du lot ; une pose refusée par la page est remise et le cut quitté sans action',async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',clic:'gauche-recentre',decisions:{109:14,110:16},reglagesProposes:PERMISSIF,relecture:{plafondCuts:4},
  esv:a=>{a.refusApply=cut=>cut===110;}});
 const p=await H.finPasse(b);
 assert.equal(p.etat,'finie',p.message);assert.equal(p.corriges,1);assert.equal(p.refusees,1);
 const lotOpt=lot.filter(c=>c.action==='apply').map(c=>c.args[2]),passeOpt=apresLot(b,lot).filter(c=>c.action==='apply').map(c=>c.args[2]);
 assert.deepEqual(j(lotOpt),[{clicHumain:'gauche-recentre'},{clicHumain:'gauche-recentre'}],'le lot garde son clic');
 assert.deepEqual(j(passeOpt),[{clicHumain:'tout-recentre'},{clicHumain:'tout-recentre'}],'la passe ne clique jamais en direct');
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109],'aucune validation après le refus');
 const e110=H.evenements(b,'relecture-ombre').find(e=>e.identity.cut===110);
 assert.equal(e110.action,'correction-refusee');assert.match(e110.raisonAction,/pose refusée par la page.*pose remise/);assert.equal(e110.arrivee,'pas','110 atteint par un pas après la validation sur place de 109');
 assert.ok(apresLot(b,lot).some(c=>c.action==='restore'),'remise à la pose d’avant');
 assert.deepEqual(adapter.allees.map(a=>[a.cut,a.chemin]),[[107,'auto'],[108,'pas'],[109,'pas'],[110,'pas'],[113,'pas']],'premier vert corrigeable atteint par un pas ; après la validation sur place, un pas vers le cut suivant ; après le refus, encore un pas');
});
