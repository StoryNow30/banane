'use strict';
/* D-320 (opérateur, 10/11) : le bouton « SKIP explicite » du panneau est masqué jusqu'à Ariane 6.0 (le SKIP y sera une règle à part entière).
 * Constat de l'audit du 10/11 : le bouton existait malgré la règle « Ariane n'envoie jamais SKIP », et sa frappe n'arrivait probablement pas dans ESV.
 * Seul le panneau change : le chemin du moteur reste en place (réglage `skipExplicite.bouton`, livré `false`). Panneau réel en vm. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {panneau,vueLot}=require('./helpers/fin-partie.cjs');
const S=require('../src/settings.js');

test('pause « rail non résolu » à l\'étape de pose : Réessayer et Reprise manuelle offerts, SKIP explicite masqué',async()=>{
 const p=await panneau(vueLot({state:'PAUSED',step:'apply',pauseReason:'unresolved-rail'}));
 assert.equal(p.$('retry').hidden,false,'Réessayer offert');assert.equal(p.$('manual-takeover').hidden,false,'Reprise manuelle offerte');
 assert.equal(p.$('explicit-skip').hidden,true,'SKIP explicite masqué');
});

test('réglage livré : bouton masqué ; le panneau ne le montre que si le réglage vaut exactement true',()=>{
 assert.equal(S.skipExplicite.bouton,false);
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../panel.js'),'utf8');
 assert.match(src,/button\('explicit-skip',\{hidden:!actionable\|\|globalThis\.BananeSettings\?\.skipExplicite\?\.bouton!==true,/);
});
