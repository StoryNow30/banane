'use strict';
/* 5.0 — OUTIL DE REJEU DES RÈGLES MÉTIER (tools/regles-metier.cjs), sur sa fixture SYNTHÉTIQUE (voie droite, un PN de quatre cœurs,
 * une grappe de différés, un vert mal extrait ; numéros de cut inventés). Il appelle le module de l'extension ; il juge après coup ;
 * il ne sort aucune coordonnée ; il refuse une partie réservée du manifeste sans --juger-partie-reservee. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{spawnSync}=require('node:child_process');
const T=require('../tools/regles-metier.cjs'),R=require('../src/regles-metier.js');

test('fixture : PN retrouvé et confirmé, marges de 4 et 6 cuts ; règles et jugement ; temps de l\'opérateur',()=>{
 const o=T.essai();
 assert.deepEqual(o.zonesPN.detectees,[{debut:20,fin:23,controle:[16,29]}]);assert.equal(o.zonesPN.micRetrouves,1);assert.deepEqual(o.zonesPN.zonesSansPN,[]);
 assert.deepEqual(o.zonesPN.coeursNonConfirmes,[20],'le premier cœur est passé avant la confirmation');
 assert.deepEqual(o.regles['pn-chaque-cut'].cuts.map(c=>[c.cut,c.jugement]),[[21,'bon-fin'],[22,'faux'],[23,'bon-fin'],[26,'bon-fin']]);
 assert.deepEqual(o.regles['grappe-differes'].cuts.map(c=>[c.cut,c.jugement]),[[42,'faux']]);
 assert.deepEqual([o.combine.signales,o.combine.faux,o.combine.bon,o.combine.sansRef],[5,2,3,0]);
 assert.equal(o.combine.tempsMic.medianeMin,Math.round(3*T.TEMPS.differeEnPlusMedianeS/60*10)/10);
 /* Le vert mal extrait (cut 24, écartement 1 470 mm) est signalé ; la référence de la partie s'est faite sur les verts vus. */
 assert.ok(o.verts.parRaison.ecartement.objet25>=1);assert.equal(o.verts.total.objet25,1);
 for(const id of R.REGLES)assert.ok(o.regles[id],id);
 /* Détecteur retenu (cœurs consécutifs, fiches/PN_ROBUSTE.md) et règle d'avant, côte à côte : ici, quatre cœurs qui se suivent, mêmes zones. */
 assert.deepEqual(o.zonesPN.variantes['sans-consecutifs'],o.zonesPN.variantes.retenu);assert.equal(o.zonesPN.variantes.retenu.zones,1);
 assert.ok(!/positionSceneRelative|"positions"|initiale|finale/.test(JSON.stringify(o)),'aucune coordonnée dans la sortie');
});

test('rapport : tables Markdown des règles, des zones et des verts',()=>{
 const t=T.rapport([T.essai()]);for(const m of [/grappe-differes/,/pn-chaque-cut/,/PN de Mic retrouvés/,/Verts signalés/,/flushPct-30/,/sans-consecutifs/])assert.match(t,m);
});

test('manifeste : une partie réservée est refusée, sauf pour la juger sans régler',()=>{
 const outil=path.join(__dirname,'..','tools','regles-metier.cjs');
 const p=spawnSync(process.execPath,[outil,'lot','--partie','1:40','--journal','absent.json','--jeu','absent.jsonl'],{encoding:'utf8'});
 assert.equal(p.status,2);assert.match(p.stderr,/réservée/);
});
