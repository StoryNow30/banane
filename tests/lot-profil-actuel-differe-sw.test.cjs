'use strict';
/* 4.9.5.13 (test 13, D-217, D-219, D-220, D-221, fiches/L1_DIFFERES.md) — LE PROFIL DU LOT : profil « actuel » sur un différé : le lot de la 4.9.5.9.
 * Montage commun : tests/helpers/lot-profil.cjs (un essai lourd par fichier). Données synthétiques. La décision de la GCV2 est forcée quand il le
 * faut (le modèle réel est essayé dans tests/gcv2-l1.test.cjs et au banc) : ces essais portent sur le CHEMIN du lot, pas sur le modèle. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {lot,neutre,decisions,metier,SCOPE,EsvVue,production,memoire,base,K,S,GOLDEN,h,versionGolden,ev,scopeDe,attendre,EsvTrou,lotDiffere,d112}=require('./helpers/lot-profil.cjs');

test('profil « actuel », même différé : aucune GCV2, mêmes appels que la panne (le lot de la 4.9.5.9)', async()=>{
 const x=await lotDiffere({profil:'actuel'});
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','nextWithoutDecision','capture','apply']);
 assert.equal('l1' in d112(x),false);assert.equal(x.forcees.length,0);assert.equal('lotProfil' in scopeDe(x.b),false);
});
