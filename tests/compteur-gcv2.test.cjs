'use strict';
/* Compteur des cuts appris par la GCV2 (D-188) : règles de comptage sur une table synthétique (aucune donnée de
 * terrain), lecture de la liste des sources, rendu. Un cut corrigé = un cut appris ; les SKIP ne comptent pas. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const C = require('../tools/compteur-gcv2.cjs');

const ligne = (etiquetteEcho, referenceHumaine = 'observee', maxDist3dMm = 0, cut = undefined) => ({ etiquetteEcho, referenceHumaine, ecartHumain: { maxDist3dMm }, cut });

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
  assert.deepEqual({ ...c }, { cutsEcho: 7, corriges: 3, dont5mm: 2, dont10mm: 1, valideSansMouvement: 1, visiteSansAction: 1, skips: 1, sansReference: 1, utilisesExemples: null, sourcesAvecExemples: 0 });
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

test('Écho en 7z : lu dans la racine supplémentaire si elle a son dossier, refusé avec un rappel sinon ; banane-data reste la racine des autres', () => {
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpt-'));
  try {
    const s7 = { id: 'z', projet: '1', partie: 9, dossiers: ['2026-01-01_x/echo (z)'], archive7z: true }, sz = { id: 'y', projet: '1', partie: 8, dossiers: ['2026-01-01_y/echo'] };
    assert.doesNotThrow(() => C.verifierSources([s7, sz]));
    assert.throws(() => C.verifierSources([{ ...s7, archive7z: 'oui' }]), /archive7z/);
    assert.throws(() => C.dossiersEcho(s7, '/r', null), /7z.*--racine-supplementaire/s, 'sans extraction : refus explicite');
    assert.throws(() => C.dossiersEcho(s7, '/r', dir), /7z/, 'racine supplémentaire sans le dossier : refus');
    fs.mkdirSync(path.join(dir, s7.dossiers[0]), { recursive: true });
    assert.deepEqual(C.dossiersEcho(s7, '/r', dir), [path.join(dir, s7.dossiers[0])]);
    assert.deepEqual(C.dossiersEcho(sz, '/r', dir), [path.join('/r', 'collections', sz.dossiers[0])], 'une source ordinaire reste lue dans banane-data');
    /* La jointure reçoit bien le dossier extrait. */
    const vus = [];
    const r = C.compter([s7, sz], { racine: '/r', racineSupplementaire: dir, executer: argv => { vus.push(argv[argv.indexOf('--echo') + 1]); return { table: [ligne('VALIDATE_NO_MOVEMENT')] }; } });
    assert.deepEqual(vus, [path.join(dir, s7.dossiers[0]), path.join('/r', 'collections', sz.dossiers[0])]);
    assert.equal(r.totaux.tous.valideSansMouvement, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  assert.equal(C.lireArguments(['--donnees', '/r', '--racine-supplementaire', '/t']).supplementaire, '/t');
  assert.equal(C.lireArguments(['--donnees', '/r']).supplementaire, null);
});

test('colonne « utilisés comme exemples » (M5) : les corrigés effectivement retenus, d\'après les identifiants de l\'apprentissage ; la colonne de Mic ne bouge pas', () => {
  /* Partie 1:5 : 4 corrigés (cuts 10, 11, 12, 13), dont 2 retenus par l'apprentissage (10 et 12 : les autres n'avaient pas de nuage) ; un cut validé tel quel retenu ne compte pas. */
  const table = [ligne('VALIDATE_CORRECTED_BOTH', 'observee', 7, 10), ligne('VALIDATE_CORRECTED_BOTH', 'observee', 7, 11), ligne('VALIDATE_CORRECTED_LEFT_ONLY', 'observee', 12, 12), ligne('VALIDATE_CORRECTED_RIGHT_ONLY', 'observee', 2, 13),
    ligne('VALIDATE_NO_MOVEMENT', 'observee', 0, 14), ligne('SKIP', 'observee', 0, 15)];
  const avec = C.compterTable(table, new Set([10, 12, 14, 99])), sans = C.compterTable(table);
  assert.equal(avec.corriges, 4, 'la colonne principale (un cut corrigé = un cut appris) est inchangée');
  assert.equal(avec.utilisesExemples, 2, 'corrigés retenus : 10 et 12 (14 est validé tel quel, 99 n\'est pas dans la partie)');
  assert.equal(avec.sourcesAvecExemples, 1);
  assert.equal(sans.corriges, 4); assert.equal(sans.utilisesExemples, null, 'sans identifiants : inconnu, pas zéro');
  assert.ok(avec.utilisesExemples <= avec.corriges);
  /* Fichier d'identifiants : clé « projet:partie », format vérifié. */
  const fichier = { format: 'ariane-gcv2-exemples-v1', usages: { relecture: { '1:5': [10, 12, 14] }, lot: { '1:5': [10] } } };
  assert.deepEqual([...C.exemplesDeSource(fichier, { projet: '1', partie: 5 })], [10, 12, 14]);
  assert.deepEqual([...C.exemplesDeSource(fichier, { projet: '1', partie: 5 }, 'lot')], [10]);
  assert.equal(C.exemplesDeSource(fichier, { projet: '2', partie: 5 }), null, 'partie sans identifiants');
  assert.equal(C.exemplesDeSource(null, { projet: '1', partie: 5 }), null);
  assert.throws(() => C.exemplesDeSource({ format: 'autre' }, { projet: '1', partie: 5 }), /format/);
  /* Deux sources, une seule avec identifiants : le total n'additionne que les sources connues, et le texte le dit. */
  const sources = [{ id: 'a', projet: '1', partie: 5, dossiers: ['d1'], etat: 'appris' }, { id: 'b', projet: '1', partie: 6, dossiers: ['d2'] }];
  const faux = () => ({ table });
  const r = C.compter(sources, { racine: '/r', executer: faux, exemples: fichier });
  assert.equal(r.sources[0].utilisesExemples, 2); assert.equal(r.sources[1].utilisesExemples, null);
  assert.equal(r.totaux.tous.utilisesExemples, 2); assert.equal(r.totaux.tous.corriges, 8, 'la colonne de Mic compte les deux parties');
  assert.equal(r.totaux.tous.corrigesDesSourcesAvecExemples, 4);
  assert.equal(r.totaux.appris.utilisesExemples, 2); assert.equal(r.totaux['en-file'].sourcesAvecExemples, 0);
  const md = C.enMarkdown(r);
  assert.match(md, /Utilisés comme exemples : 2/); assert.match(md, /Utilisés comme exemples \|/); assert.match(md, /Cuts corrigés : 8/);
  assert.match(md, /\| 1 \| 6 \| en-file \| 6 \| 4 \| — \|/, 'une source sans identifiants affiche « — »');
  /* Sans fichier d'identifiants, rien de nouveau n'est affiché dans la phrase d'en-tête. */
  assert.ok(!/Utilisés comme exemples : /.test(C.enMarkdown(C.compter(sources, { racine: '/r', executer: faux }))));
  assert.equal(C.lireArguments(['--donnees', '/r', '--exemples', 'x.json']).exemples, 'x.json');
});
