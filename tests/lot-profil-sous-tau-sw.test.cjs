'use strict';
/* 4.9.5.13 (test 13, D-217, D-219, D-220, D-221, fiches/L1_DIFFERES.md) — LE PROFIL DU LOT : sous τ, pose sans validation avant la navigation ; pose d'avant et pose envoyée au journal (D-220).
 * Montage commun : tests/helpers/lot-profil.cjs (un essai lourd par fichier). Données synthétiques. La décision de la GCV2 est forcée quand il le
 * faut (le modèle réel est essayé dans tests/gcv2-l1.test.cjs et au banc) : ces essais portent sur le CHEMIN du lot, pas sur le modèle. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {lot,neutre,decisions,metier,SCOPE,EsvVue,production,memoire,base,K,S,GOLDEN,h,versionGolden,ev,scopeDe,attendre,EsvTrou,lotDiffere,d112}=require('./helpers/lot-profil.cjs');

test('profil « L1-s » (défaut), sous τ : pose SANS validation juste avant la navigation sans décision ; pose d\'avant et pose envoyée au journal', async()=>{
 const x=await lotDiffere({etat:'poser-sans-valider'});
 assert.equal(x.forcees.length,1);
 /* 112 : capture, pose (apply, aucune validation), puis navigation sans décision ; 113 : comme avant. */
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','apply','nextWithoutDecision','capture','apply']);
 const d=d112(x);assert.equal(d.command.action,'engine');assert.equal(d.command.reason,'deferred','la commande du lot reste un différé');
 assert.equal(d.l1.etat,'poser-sans-valider');assert.equal(d.l1.commande.action,'lot');assert.equal(d.l1.commande.sansValider,'en-attente-de-la-navigation');
 for(const s of ['left','right']){assert.equal(d.l1.poseAvant[s].length,3);assert.equal(d.l1.poseEnvoyee[s].length,3);}
 assert.deepEqual(d.l1.poseAvant.left,base.rails.left.positionSceneRelative.slice(0,3),'pose d\'ESV avant la commande');
 const e=ev(x.b,'l1-pose-sans-valider');assert.equal(e.length,1);
 assert.equal(e[0].ok,true);assert.equal(e[0].validateSent,false);assert.equal(e[0].identity.cut,112);
 assert.deepEqual(e[0].poseEnvoyee,d.l1.poseEnvoyee);assert.deepEqual(e[0].poseAvant,d.l1.poseAvant);
 /* Le cut reste différé (rouge) : aucune validation, pas d'appui. */
 const b=x.b.get('engine').s.batch;assert.ok(!b.processed.some(p=>p.cut===112),'112 non validé');
 assert.equal(d.anchorHeld,undefined);
});
