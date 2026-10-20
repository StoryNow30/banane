'use strict';
/* 4.9.5.13 (test 13, D-217, D-219, D-220, D-221, fiches/L1_DIFFERES.md) — LE PROFIL DU LOT : panne de la GCV2 : rien n'est posé.
 * Montage commun : tests/helpers/lot-profil.cjs (un essai lourd par fichier). Données synthétiques. La décision de la GCV2 est forcée quand il le
 * faut (le modèle réel est essayé dans tests/gcv2-l1.test.cjs et au banc) : ces essais portent sur le CHEMIN du lot, pas sur le modèle. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {lot,neutre,decisions,metier,SCOPE,EsvVue,production,memoire,base,K,S,GOLDEN,h,versionGolden,ev,scopeDe,attendre,EsvTrou,lotDiffere,d112}=require('./helpers/lot-profil.cjs');

test('profil « L1 », panne de la GCV2 : rien n\'est posé, le différé part comme avant ; la panne est consignée', async()=>{
 const x=await lotDiffere({panne:true});
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','nextWithoutDecision','capture','apply']);
 const d=d112(x);assert.equal(d.l1.etat,'erreur');assert.match(d.l1.message,/panne simulée/);assert.equal(d.command.reason,'deferred');
 assert.equal(ev(x.b,'l1-pose-sans-valider').length,0);
});
