'use strict';
/* 5.0, revue de la relecture (R4) — un redémarrage du service worker pendant une passe la perd : au redémarrage, la passe est close
 * dans le journal (relecture-fin « interrompue »), une seule fois ; la correction interrompue reste notée et dite au panneau.
 * Service worker réel en VM (tests/helpers/perf-production.cjs), sans lot. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,memoire}=require('./helpers/perf-production.cjs');
const attendre=ms=>new Promise(r=>setTimeout(r,ms));

test('redémarrage pendant une passe : relecture-fin « interrompue » au réveil, une seule fois ; correction interrompue dite',async()=>{
 const local=memoire();
 local.m.banane50RelecturePasse={lotId:'lot-essai',gen:3,debut:'2026-10-17T10:00:00.000Z',mode:'corriger',modeEffectif:'corriger'};
 local.m.banane50RelectureIntention=[{lotId:'lot-essai',part:23,cut:109,at:'2026-10-17T10:01:00.000Z'}];
 const b=production({local});await b.api('view');await attendre(30);
 const fins=b.store.events.filter(e=>e.type==='relecture-fin');
 assert.equal(fins.length,1);assert.equal(fins[0].issue,'interrompue');assert.equal(fins[0].lotId,'lot-essai');assert.match(fins[0].raison,/redémarré pendant la passe/);
 assert.equal('banane50RelecturePasse' in local.m,false);
 const etat=await b.api('relecture-etat');assert.equal(etat.correctionInterrompue.cut,109);assert.equal(etat.passe,null);
 /* Second réveil : rien de plus. */
 const c=production({local,store:b.store});await c.api('view');await attendre(30);
 assert.equal(c.store.events.filter(e=>e.type==='relecture-fin').length,1);
});
