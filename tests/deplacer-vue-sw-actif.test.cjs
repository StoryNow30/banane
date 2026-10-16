'use strict';
/* 5.0 — « DÉPLACER LA VUE » DANS LE LOT, RÉGLAGE ACTIF (service worker réel en VM, moteur et GCV1 réels, ESV simulé ; même
 * montage que tests/deplacer-vue-sw.test.cjs). Le cut 112 tombe hors de la vue du rail gauche (NDC 1,34) : le geste est
 * planifié (dézoom ×1,35 dans la limite de ×1,5), essayé d'abord par la page (pré-vol, vue remise), puis le cut est posé avec la
 * vue déplacée ; un événement à chaque étape. Si la page ne peut pas amener la cible, le cut reste différé, comme aujourd'hui. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {lot,neutre,decisions}=require('./helpers/deplacer-vue-lot.cjs'),S=require('../src/settings.js');
const GOLDEN=require('./fixtures/lot-sans-vue-50-base.json');
const ev=(b,type)=>b.store.events.filter(e=>e.type===type);
let actif,refuse;
before(async()=>{
 actif=await lot({reglage:{...S.deplacerVue,actif:true}});
 refuse=await lot({reglage:{...S.deplacerVue,actif:true},amener:{ok:false,raison:'camera-immobile'}});
});

test('réglage actif : plan de geste (dézoom), pré-vol par la page, pose avec la vue déplacée ; le cut 112 est posé (dernier cut du lot : posé sans validation, comme tout dernier cut)',()=>{
 const {b,adapter}=actif;
 const d=decisions(b).find(([c])=>c===112)[1];
 assert.equal(d.command.action,'lot');assert.equal(d.command.reason,'window');
 assert.equal(d.command.deplacerVue.cotes.left.geste,'dezoom');assert.ok(Math.abs(d.command.deplacerVue.cotes.left.dezoom-1.352)<.01);
 /* Pré-vol : la page a essayé le côté hors de la vue (et lui seul), avec la cible de la décision et l'identité du cut. */
 assert.deepEqual(adapter.amenerArgs.map(a=>a.cote),Object.keys(d.command.deplacerVue.cotes));
 assert.equal(adapter.amenerArgs[0].attendu.cut,112);assert.ok(adapter.amenerArgs[0].options.essai);
 assert.equal(JSON.stringify(adapter.amenerArgs[0].cible),JSON.stringify(d.positions.left));
 /* Pose : apply reçoit le plan ; le cut est validé. */
 assert.deepEqual(adapter.calls,['capture','apply','validate','next','capture','amenerDansLaVue',...adapter.amenerArgs.slice(1).map(()=>'amenerDansLaVue'),'apply']);
 assert.deepEqual(adapter.applyArgs,[0,1]);assert.ok(adapter.options.deplacerVue.cotes.left);
 const e=ev(b,'deplacer-vue');assert.deepEqual(e.map(x=>x.phase),['decision','pose']);
 assert.equal(e[0].plan.cotes.left.geste,'dezoom');assert.equal(e[0].preVol.every(p=>p.ok),true);
 assert.ok(!/positionSceneRelative|"cible"/.test(JSON.stringify(e)),'aucune position consignée');
});

test('réglage actif, la page n\'amène pas la cible : le cut reste différé exactement comme aujourd\'hui ; la raison est consignée',()=>{
 const {b,adapter}=refuse;
 const d=decisions(b).find(([c])=>c===112)[1];assert.equal(d.command.action,'defer');assert.equal(d.command.reason,'guard-hors-vue-left');
 assert.deepEqual(adapter.calls.filter(c=>c!=='amenerDansLaVue'),GOLDEN.appels,'mêmes commandes de pose et de navigation');
 assert.deepEqual(adapter.applyArgs,GOLDEN.applyArgs);
 const e=ev(b,'deplacer-vue');assert.equal(e.length,1);assert.equal(e[0].phase,'decision');assert.equal(e[0].refus,'pre-vol:camera-immobile');
});

test('la décision du lot ne dépend pas du geste (seules la commande et son appui changent), et le moteur ne connaît pas le réglage',()=>{
 const sansCommande=b=>decisions(b).map(([c,x])=>{const {command,applied,anchorHeld,...reste}=x;return [c,reste];});
 assert.equal(JSON.stringify(neutre(sansCommande(actif.b))),JSON.stringify(neutre(sansCommande(refuse.b))));
 assert.deepEqual(decisions(refuse.b).map(([c,x])=>[c,x.stage]),GOLDEN.decisions.map(d=>d.slice(0,2)));
 const fs=require('node:fs'),path=require('node:path');
 assert.ok(!/deplacerVue|amenerDansLaVue/.test(fs.readFileSync(path.join(__dirname,'..','src','engine.js'),'utf8')));
});
