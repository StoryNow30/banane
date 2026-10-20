'use strict';
/* 4.9.5.13 (test 13, D-217, D-219, D-220, D-221, fiches/L1_DIFFERES.md) — LE PROFIL DU LOT : au-dessus de τ sous L1-s : pose validée de la GCV2, jamais appui ni voisin (D-221).
 * Montage commun : tests/helpers/lot-profil.cjs (un essai lourd par fichier). Données synthétiques. La décision de la GCV2 est forcée quand il le
 * faut (le modèle réel est essayé dans tests/gcv2-l1.test.cjs et au banc) : ces essais portent sur le CHEMIN du lot, pas sur le modèle. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {lot,neutre,decisions,metier,SCOPE,EsvVue,production,memoire,base,K,S,GOLDEN,h,versionGolden,ev,scopeDe,attendre,EsvTrou,lotDiffere,d112}=require('./helpers/lot-profil.cjs');

test('profil « L1-s », au-dessus de τ : pose validée de la GCV2, jamais appui ni voisin (D-221)', async()=>{
 const x=await lotDiffere({etat:'valider'});
 assert.equal(scopeDe(x.b).lotProfil,'L1-s');
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','apply','validate','next','capture','apply']);
 const d=d112(x);assert.equal(d.command.reason,'gcv2-l1');assert.equal(d.command.l1s,'gcv2');assert.notEqual(d.anchorHeld,true,'pas un appui');
 assert.equal(x.b.get('engine').s.batch.lotCommands[112].l1,true);
 const d113=decisions(x.b).find(([c])=>c===113)[1];assert.ok(!(d113.anchorsUsed||[]).includes(112),'113 ne s\'appuie pas sur 112');
});
