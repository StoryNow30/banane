'use strict';
/* 4.9.5.13 (test 13, D-217, D-219, D-220, D-221, fiches/L1_DIFFERES.md) — LE PROFIL DU LOT : au-dessus de τ sous L1 : pose validée de la GCV2, devenue appui.
 * Montage commun : tests/helpers/lot-profil.cjs (un essai lourd par fichier). Données synthétiques. La décision de la GCV2 est forcée quand il le
 * faut (le modèle réel est essayé dans tests/gcv2-l1.test.cjs et au banc) : ces essais portent sur le CHEMIN du lot, pas sur le modèle. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {lot,neutre,decisions,metier,SCOPE,EsvVue,production,memoire,base,K,S,GOLDEN,h,versionGolden,ev,scopeDe,attendre,EsvTrou,lotDiffere,d112}=require('./helpers/lot-profil.cjs');

test('profil « L1 », au-dessus de τ : la commande devient celle de la GCV2 ; apply puis validate ; le cut devient appui', async()=>{
 const x=await lotDiffere({etat:'valider',profil:'L1'});
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','apply','validate','next','capture','apply']);
 const d=d112(x);assert.equal(d.command.action,'lot');assert.equal(d.command.reason,'gcv2-l1');assert.equal(d.applied,true);
 assert.equal(d.anchorHeld,true,'pose validée de la GCV2 : appui de la chaîne');
 assert.ok(d.l1.poseAvant&&d.l1.poseEnvoyee);assert.equal(ev(x.b,'l1-pose-sans-valider').length,0);
 assert.ok(x.b.get('engine').s.batch.processed.some(p=>p.cut===112),'112 validé');
});
