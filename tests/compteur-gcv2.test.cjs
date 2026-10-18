'use strict';
/* Compteur des cuts appris par la GCV2 (D-188) : règles de comptage sur une table synthétique (aucune donnée de
 * terrain), lecture de la liste des sources, rendu. Un cut corrigé = un cut appris ; les SKIP ne comptent pas. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const C = require('../tools/compteur-gcv2.cjs');

const ligne = (etiquetteEcho, referenceHumaine = 'observee', maxDist3dMm = 0) => ({ etiquetteEcho, referenceHumaine, ecartHumain: { maxDist3dMm } });

test('catégories : corrigé, validé tel quel, visité sans action, SKIP et sans référence', () => {
  assert.equal(C.categorie(ligne('VALIDATE_CORRECTED_BOTH')), 'corriges');
  assert.equal(C.categorie(ligne('VALIDATE_CORRECTED_LEFT_ONLY')), 'corriges');
  assert.equal(C.categorie(ligne('VALIDATE_NO_MOVEMENT')), 'valideSansMouvement');
  assert.equal(C.categorie(ligne('PASS_NO_DECISION')), 'visiteSansAction');
  assert.equal(C.categorie(ligne('PASS_NO_DECISION', 'sans-reference')), 'sansReference', 'visite trop courte : pas de pose humaine');
  assert.equal(C.categorie(ligne('SKIP')), 'skips');
  assert.equal(C.categorie(ligne('SKIP', 'sans-reference')), 'skips', 'un SKIP ne compte jamais, avec ou sans référence');
  assert.equal(C.categorie(ligne('VALIDATE_CORRECTED_BOTH', 'sans-reference')), 'sansReference');
});

test('comptage : les corrigés dépassant 5 mm et 10 mm sont des sous-ensembles ; les SKIP sortent du compte', () => {
  const c = C.compterTable([
    ligne('VALIDATE_CORRECTED_RIGHT_ONLY', 'observee', 2), ligne('VALIDATE_CORRECTED_BOTH', 'observee', 7), ligne('VALIDATE_CORRECTED_LEFT_ONLY', 'observee', 12),
    ligne('VALIDATE_NO_MOVEMENT'), ligne('PASS_NO_DECISION'), ligne('PASS_NO_DECISION', 'sans-reference'), ligne('SKIP'),
  ]);
  assert.deepEqual({ ...c }, { cutsEcho: 7, corriges: 3, dont5mm: 2, dont10mm: 1, valideSansMouvement: 1, visiteSansAction: 1, skips: 1, sansReference: 1 });
  assert.equal(C.appris(c), 5, 'apprenables = corrigés + validés tels quels + visités sans action');
});

test('sources : champs obligatoires, doublons et état refusés', () => {
  const ok = { id: 'a', projet: '1', partie: 3, dossiers: ['x'] };
  assert.doesNotThrow(() => C.verifierSources([ok]));
  assert.throws(() => C.verifierSources([]), /vide/);
  assert.throws(() => C.verifierSources([{ ...ok, partie: 'trois' }]), /incomplète/);
  assert.throws(() => C.verifierSources([ok, ok]), /double/);
  assert.throws(() => C.verifierSources([{ ...ok, etat: 'peut-être' }]), /État inconnu/);
});

test('totaux par file : « en-file » et « appris » ne se mélangent pas ; la jointure est remplacée par un faux', () => {
  const sources = [{ id: 'a', projet: '1', partie: 1, dossiers: ['d1'] }, { id: 'b', projet: '2', partie: 2, dossiers: ['d2'], etat: 'appris' }];
  const faux = argv => ({ table: argv[argv.indexOf('--partie') + 1] === '1'
    ? [ligne('VALIDATE_CORRECTED_BOTH', 'observee', 6), ligne('VALIDATE_NO_MOVEMENT')] : [ligne('VALIDATE_CORRECTED_BOTH', 'observee', 1)] });
  const r = C.compter(sources, { racine: '/r', executer: faux });
  assert.equal(r.totaux['en-file'].corriges, 1);
  assert.equal(r.totaux.appris.corriges, 1);
  assert.equal(r.totaux.tous.corriges, 2);
  assert.equal(r.totaux.tous.dont5mm, 1);
  assert.equal(r.parProjet['1'].valideSansMouvement, 1);
  assert.match(C.enMarkdown(r), /Cuts corrigés : 2/);
});

test('fichier des sources du dépôt : valide, sans code de projet ESV ni adresse', () => {
  const f = path.join(__dirname, '..', 'datasets', 'compteur-gcv2-sources.json');
  const brut = fs.readFileSync(f, 'utf8');
  C.verifierSources(JSON.parse(brut).sources);
  assert.ok(!/\d{6}_\d{6}_E_\d{3}/.test(brut), 'aucun code de projet ESV');
  assert.ok(!/https?:\/\//.test(brut), 'aucune adresse');
});

test('arguments : la racine de banane-data est obligatoire, le seuil de visite doit être positif', () => {
  assert.throws(() => C.lireArguments([]), /Usage/);
  assert.throws(() => C.lireArguments(['--donnees', '/r', '--seuil-visite', '-1']), /positive/);
  assert.equal(C.lireArguments(['--donnees', '/r']).seuil, C.SEUIL_VISITE_S);
});
