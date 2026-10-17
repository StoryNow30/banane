'use strict';
/* 5.0 — OUTIL DES VERTS À CONTRÔLER (tools/verts-a-controler.cjs), sur sa fixture SYNTHÉTIQUE (voie droite inventée, trois verts mal
 * extraits). Il appelle le module de l'extension ; il juge après coup, par l'étiquette ; la validation croisée n'utilise jamais la
 * partie jugée pour apprendre ; il ne sort aucune coordonnée ; il refuse une partie réservée du manifeste. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{spawnSync}=require('node:child_process');
const T=require('../tools/verts-a-controler.cjs'),V=require('../src/verts-a-controler.js');

test('rejeu de la fixture : liste avec les réglages livrés, erreurs attrapées, minutes, plages',()=>{
 const o=T.essai(),p=o.rejeu.parties[0];
 assert.equal(p.erreurs,3);assert.equal(p.attrapees,3,'les trois verts mal extraits sont dans la liste');
 assert.equal(p.minutes,Math.round(p.aControler*V.DEFAULTS.tempsParVertS/60*10)/10);
 assert.ok(p.aControler<p.versRelusOperateur,'la liste est plus courte que la relecture entière');
 assert.ok(p.apercu.some(x=>x.libelle.startsWith('PN 59–63')));
 assert.ok(!/bords|"left"|"right"/.test(JSON.stringify(o.rejeu))&&!/bords|"left"|"right"/.test(JSON.stringify(o.etude)),'aucune coordonnée dans les sorties');
});

test('étude : AUC, courbe de rappel, validation croisée sans la partie jugée, temps de l\'opérateur',()=>{
 const o=T.etudier([T.essai().table,{...T.essai().table,partie:1},{...T.essai().table,partie:2}]);
 assert.equal(o.croisee.length,3);
 for(const c of o.croisee){assert.equal(c.appris,'les autres lots');assert.equal(c.courbe.length,6);
  for(let k=1;k<c.courbe.length;k++)assert.ok(c.courbe[k].rappel>=c.courbe[k-1].rappel,'courbe croissante');}
 assert.equal(o.croiseeSeuil.length,3);assert.ok(o.temps.every(t=>t.sParVert30===3),'3 s par visite dans la fixture');
 /* Apprendre sans la partie jugée : si on apprend sur elle seule, l'outil refuse (pas d'autre lot). */
 assert.throws(()=>T.apprendre([]),/aucune partie/);
});

test('texte : tables Markdown du rejeu et de l\'étude',()=>{
 const o=T.essai();assert.match(T.texte(o.rejeu),/À contrôler/);assert.match(T.texte(o.etude),/Validation croisée/);
});

test('manifeste : une partie réservée est refusée',()=>{
 const outil=path.join(__dirname,'..','tools','verts-a-controler.cjs');
 const p=spawnSync(process.execPath,[outil,'extraire','--partie','1:40','--jeu','absent.jsonl','--echo','absent','--sortie','x.json'],{encoding:'utf8'});
 assert.equal(p.status,2);assert.match(p.stderr,/réservée/);
});
