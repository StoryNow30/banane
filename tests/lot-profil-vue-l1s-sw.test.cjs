'use strict';
/* 4.9.5.13 (test 13, D-217, D-219, D-220, D-221, fiches/L1_DIFFERES.md) — LE PROFIL DU LOT : cible de la chaîne hors de la vue, profil L1-s (défaut) : vue amenée, pose, jamais appui.
 * Montage commun : tests/helpers/lot-profil.cjs (un essai lourd par fichier). Données synthétiques. La décision de la GCV2 est forcée quand il le
 * faut (le modèle réel est essayé dans tests/gcv2-l1.test.cjs et au banc) : ces essais portent sur le CHEMIN du lot, pas sur le modèle. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {lot,neutre,decisions,metier,SCOPE,EsvVue,production,memoire,base,K,S,GOLDEN,h,versionGolden,ev,scopeDe,attendre,EsvTrou,lotDiffere,d112}=require('./helpers/lot-profil.cjs');

for(const profil of ['L1-s','L1-se'])test(`profil « ${profil} » : cible de la chaîne hors de la vue → la vue est amenée (pré-vol), puis la pose est faite avec le plan`, async()=>{
 const x=await lot({profil:profil==='L1-se'?null:profil});
 assert.equal(scopeDe(x.b).lotProfil,profil,'profil figé dans le scope (L1-se : le défaut, test 14)');
 /* 111 : posé et validé comme avant ; 112 (cible de la voie hors de la vue gauche) : pré-vol des deux rails, puis pose avec le plan. */
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','amenerDansLaVue','amenerDansLaVue','apply']);
 assert.deepEqual(x.adapter.applyArgs,[0,1],'111 : apply sans option ; 112 : apply avec le plan de vue');
 assert.ok(x.adapter.options.deplacerVue.cotes.left,'le plan amène le rail gauche');
 const d112=decisions(x.b).find(([c])=>c===112)[1];
 assert.equal(d112.command.action,'lot');assert.equal(d112.command.reason,'window');assert.ok(d112.command.deplacerVue);
 assert.deepEqual(x.adapter.amenerArgs.map(a=>[a.cote,a.options.essai]),[['left',true],['right',true]],'pré-vol : essai, sans pose');
 assert.equal(ev(x.b,'deplacer-vue').filter(e=>e.phase==='decision'&&e.refus===null).length,1);
 /* D-221 : sous L1-s, cette pose (un différé de la chaîne de la 4.9.5.9) n'est pas un appui. */
 if(profil==='L1-s'||profil==='L1-se'){assert.equal(d112.command.l1s,'vue');assert.equal(d112.anchorHeld,false);assert.equal(x.b.get('engine').s.batch.lotCommands[112].l1,true);}
 else assert.equal(d112.command.l1s,undefined);
});
