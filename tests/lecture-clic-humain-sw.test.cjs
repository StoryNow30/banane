'use strict';
/* 4.9.5.13 — `readStrategy.clicHumain` DANS L'EXPORT DES LECTURES. fiches/RAPIDE_HUMAIN.md (§ 2) l'annonce : en mode corrigé, le mode du clic est
 * consigné par cut dans la lecture exportée. Depuis la test 6 (D-164), le mode vient du LOT (choix du panneau, figé au départ) et n'est envoyé à la
 * page qu'avec `apply` : la capture, faite avant, ne le connaît pas, et l'export le laissait vide. Le service worker l'écrit désormais dans la
 * lecture de chaque capture d'un lot à clic corrigé (`clicHumainSource:'lot'`), sans rien changer à ce qui part vers la page.
 * En « tel-quel », la lecture est celle d'avant. Service worker réel en VM (tests/helpers/choix-lot.cjs), données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lotClic,CLE_CLIC}=require('./helpers/choix-lot.cjs');
const {GOLDEN,h,versionGolden,j}=require('./helpers/choix-lot-essais.cjs');
const {neutre}=require('./helpers/choix-lot.cjs');
const lectures=b=>[...b.store.clouds.values()].map(c=>c.readStrategy||null);

test('clic corrigé choisi pour le lot : chaque lecture du lot porte le mode du clic', async()=>{
 const x=await lotClic({choix:{[CLE_CLIC]:'gauche-recentre'}});
 const l=lectures(x.b);assert.ok(l.length>=2,'deux captures');
 for(const r of l){assert.equal(r?.clicHumain,'gauche-recentre');assert.equal(r?.clicHumainSource,'lot');}
 assert.deepEqual(j(x.options),[[{clicHumain:'gauche-recentre'}],[{clicHumain:'gauche-recentre'}]],'apply : inchangé');
 assert.ok(!x.commandes.some(c=>c.action==='capture'&&JSON.stringify(c.args||[]).includes('clicHumain')),'rien de plus n\'est envoyé à la page');
});

test('« tel-quel » : lectures et commandes celles d\'avant, octet pour octet', async()=>{
 const x=await lotClic({});
 for(const r of lectures(x.b))assert.ok(!r||!('clicHumain' in r));
 assert.equal(h(versionGolden(neutre(x.commandes))),GOLDEN.clic.empreinteCommandes);
});
