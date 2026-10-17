'use strict';
/* 4.9.5 test 6 (D-157, D-164) — LE CLIC EST LU AU DÉMARRAGE DU LOT ET FIGÉ. Service worker réel en VM (tests/helpers/choix-lot.cjs).
 * Changé dans le panneau pendant un lot (à sa première pose) : le lot garde son mode jusqu'à sa dernière pose ; le choix est gardé
 * et le lot suivant, sur le même service worker, prend le nouveau. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lotClic,CLE_CLIC}=require('./helpers/choix-lot.cjs');
const {j,scopeDe,debutsDeLot}=require('./helpers/choix-lot-essais.cjs');

test('changé pendant le lot : le lot garde son mode jusqu\'à sa fin ; le lot suivant prend le nouveau',async()=>{
 const x=await lotClic({choix:{[CLE_CLIC]:'gauche-recentre'},pendant:async b=>{
  const r=await b.api('choix-lot',{clicHumain:'tout-recentre'});assert.equal(r.clicHumain,'tout-recentre');}});
 assert.deepEqual(j(x.options),[[{clicHumain:'gauche-recentre'}],[{clicHumain:'gauche-recentre'}]],'mode du lot, jusqu\'à sa dernière pose');
 assert.equal(scopeDe(x.b).clicHumain,'gauche-recentre');
 assert.equal(x.b.local.m[CLE_CLIC],'tout-recentre','le choix est gardé');
 const y=await lotClic({b:x.b,debut:120,fin:121});
 assert.deepEqual(j(y.options),[[{clicHumain:'tout-recentre'}],[{clicHumain:'tout-recentre'}]],'lot suivant');
 assert.deepEqual(debutsDeLot(x.b).map(s=>s.clicHumain),['gauche-recentre','tout-recentre'],'chaque lot consigne le sien');
});
