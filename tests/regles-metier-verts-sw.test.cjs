'use strict';
/* 5.0 — ORBITE : VERTS À CONTRÔLER, LUS SUR LA FENÊTRE DE LA LISTE D'ESV QUE B1 DEMANDE DÉJÀ (service worker réel en VM, observateur
 * réel de la page, montage tests/helpers/b1-montage.cjs, données synthétiques). Le lot traite le cut 110, rouge isolé : ses deux
 * voisins verts, jamais traités par un opérateur, sont signalés (règle 1 de l'opérateur, « contrôler le cut d'avant et le cut d'après »),
 * une fois, sans aucune coordonnée ; aucune demande de plus à la page que celles de B1. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {montage,lot,voieAriane,prerégler}=require('./helpers/b1-montage.cjs');
let voie;before(async()=>{voie=await voieAriane();});
const verts=b=>b.store.events.filter(e=>e.type==='regles-metier-ombre'&&e.portee==='verts');

test('verts voisins d\'un rouge isolé signalés une fois, sans coordonnée ; même nombre de demandes à la page',{timeout:60000},async()=>{
 const s=montage({mode:'ombre',decalageMm:0});prerégler(s,voie);await lot(s,110,110);
 const e=verts(s.b);assert.equal(e.length,1);
 assert.deepEqual(e[0].verts.map(v=>[v.i,v.raisons]),[[109,['isole']],[111,['isole']]]);
 assert.equal(e[0].identity.cut,110);assert.equal(e[0].version,'regles-metier-v1');assert.ok(e[0].batchId);
 assert.ok(!/XLeftEdge|bords|positionSceneRelative|"T"/.test(JSON.stringify(e[0])),'aucune coordonnée');
 /* Ligne B1 coupée : aucune fenêtre lue, aucun vert signalé, aucune demande. */
 const o=montage({mode:'off'});prerégler(o,voie);await lot(o,110,110);assert.equal(verts(o.b).length,0);assert.equal(o.demandes.length,0);
 /* Règles métier coupées : B1 demande autant qu'avant, aucun événement. */
 const c=montage({mode:'ombre',decalageMm:0});c.b.ctx.BananeSettings={...c.b.ctx.BananeSettings,reglesMetier:{ombre:false,actif:false,regles:{}}};prerégler(c,voie);await lot(c,110,110);
 assert.equal(verts(c.b).length,0);assert.equal(c.demandes.length,s.demandes.length,'aucune demande ajoutée par les règles métier');
});
