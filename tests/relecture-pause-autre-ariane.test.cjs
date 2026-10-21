'use strict';
/* Correctif de relecture (test 17) — « UNE AUTRE ARIANE » AU PASSAGE D'UN CUT : ce n'est pas un ESV muet qu'un F5 répare. La passe s'arrête en erreur avec le message d'origine,
 * elle n'est pas mise en pause (« Reprendre » ne servirait à rien), même réglage de pause allumé et F5 réglé sur « mettre en pause ». */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause}=require('./helpers/relecture-pause.cjs');
const AUTRE='Une autre Ariane (4.8.0) est active dans cet onglet : désactive-la dans edge://extensions, puis F5 sur ESV.';
test('une exception « Une autre Ariane » au passage au cut 110 arrête la relecture en erreur, avec son message, sans pause',async()=>{
 const {b}=await lotPause({esv:a=>{a.surAller=async t=>{if(t.cut===110)throw Error(AUTRE);};}});
 const fin=await H.finPasse(b);
 assert.equal(fin.etat,'erreur');assert.match(fin.message,/Une autre Ariane \(4\.8\.0\) est active dans cet onglet/);assert.doesNotMatch(fin.message,/ne répond pas/);
 assert.equal(H.evenements(b,'relecture-pause').length,0,'pas de pause');assert.equal(b.local.m.banane51RelectureReprise,undefined,'aucun point de reprise gardé');
});
