'use strict';
/* G1-c-prep — empreintes SHA-256 de la chaîne figée (tools/gcv2-empreintes.cjs, fiches/PROTOCOLE_G1C.md § 1) : un fichier changé, absent ou ajouté est détecté ; une pièce
 * provisoire est signalée sans faire échouer ; les jeux hors dépôt se vérifient par chemin relatif ; le fichier du dépôt est bien formé. Fichiers temporaires seulement. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const E = require('../tools/gcv2-empreintes.cjs');

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gcv2emp-'));
const ecrire = (racine, chemin, contenu) => { const f = path.join(racine, chemin); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, contenu); return f; };

test('un fichier changé, absent ou provisoire : détecté, ou signalé sans échec', () => {
  const r = temp();
  try {
    ecrire(r, 'src/a.js', 'alpha'); ecrire(r, 'datasets/b.json', '{"b":1}'); ecrire(r, 'tools/c.cjs', 'gamma');
    const pieces = [['src/a.js', 'moteur'], ['datasets/b.json', 'réglages'], ['tools/c.cjs', 'générateur', true]];
    const doc = E.fabriquer({ racine: r, date: '2026-10-19', pieces });
    assert.equal(doc.format, E.FORMAT);
    assert.deepEqual(doc.fichiers.map(f => f.chemin), ['src/a.js', 'datasets/b.json', 'tools/c.cjs']);
    assert.ok(doc.fichiers.every(f => /^[0-9a-f]{64}$/.test(f.sha256)), 'SHA-256 en hexadécimal');
    assert.equal(doc.fichiers[2].provisoire, true);
    assert.deepEqual(E.verifier(doc, { racine: r }), { ok: true, ecarts: [], avertissements: [] }, 'rien n\'a changé');
    /* un octet de plus */
    ecrire(r, 'src/a.js', 'alpha ');
    const v = E.verifier(doc, { racine: r });
    assert.equal(v.ok, false); assert.equal(v.ecarts.length, 1); assert.equal(v.ecarts[0].chemin, 'src/a.js'); assert.equal(v.ecarts[0].raison, 'changé');
    assert.notEqual(v.ecarts[0].obtenu, v.ecarts[0].attendu);
    ecrire(r, 'src/a.js', 'alpha');                                                     // remis : conforme de nouveau
    assert.equal(E.verifier(doc, { racine: r }).ok, true);
    /* un fichier disparu */
    fs.rmSync(path.join(r, 'datasets/b.json'));
    const w = E.verifier(doc, { racine: r });
    assert.equal(w.ok, false); assert.equal(w.ecarts[0].raison, 'absent');
    ecrire(r, 'datasets/b.json', '{"b":1}');
    /* une pièce provisoire qui change : avertissement, pas échec */
    ecrire(r, 'tools/c.cjs', 'gamma modifié');
    const p = E.verifier(doc, { racine: r });
    assert.equal(p.ok, true); assert.equal(p.ecarts.length, 0); assert.equal(p.avertissements.length, 1); assert.equal(p.avertissements[0].chemin, 'tools/c.cjs');
    /* format et date */
    assert.throws(() => E.verifier({ format: 'autre' }, { racine: r }), /format/);
    assert.throws(() => E.fabriquer({ racine: r, date: 'hier', pieces }), /--date/);
    /* mêmes entrées, mêmes octets */
    assert.equal(E.serialiser(E.fabriquer({ racine: r, date: '2026-10-19', pieces })), E.serialiser(E.fabriquer({ racine: r, date: '2026-10-19', pieces })));
  } finally { fs.rmSync(r, { recursive: true, force: true }); }
});

test('les jeux hors dépôt : chemin relatif à leur racine, empreinte vérifiée, racine absente signalée', () => {
  const r = temp(), j = temp();
  try {
    ecrire(r, 'src/a.js', 'alpha');
    ecrire(j, 'jeu-1-12.jsonl', 'ligne 1\n'); ecrire(j, 'sous/jeu-2-1.jsonl', 'ligne 2\n'); ecrire(j, 'log-1-12.txt', 'pas un jeu');
    const chemins = E.listerDossier(j, /^jeu-.*\.jsonl$/);
    assert.deepEqual(chemins, ['jeu-1-12.jsonl', 'sous/jeu-2-1.jsonl'], 'triés, relatifs, seulement les jeux');
    const doc = E.fabriquer({ racine: r, date: '2026-10-19', pieces: [['src/a.js', 'moteur']], jeux: { racine: j, chemins } });
    assert.deepEqual(doc.jeux.map(x => x.chemin), chemins);
    assert.ok(doc.jeux.every(x => !path.isAbsolute(x.chemin) && /^[0-9a-f]{64}$/.test(x.sha256)));
    assert.ok(!JSON.stringify(doc).includes(j), 'la racine des jeux n\'est pas consignée');
    assert.equal(E.verifier(doc, { racine: r, racineJeux: j }).ok, true);
    const sans = E.verifier(doc, { racine: r });
    assert.equal(sans.ok, true); assert.ok(sans.avertissements.some(a => a.famille === 'jeux'), 'jeux non vérifiés : dit');
    ecrire(j, 'sous/jeu-2-1.jsonl', 'ligne 2 modifiée\n');
    const v = E.verifier(doc, { racine: r, racineJeux: j });
    assert.equal(v.ok, false); assert.equal(v.ecarts[0].famille, 'jeux'); assert.equal(v.ecarts[0].chemin, 'sous/jeu-2-1.jsonl');
    /* ailleurs sur le disque, mêmes octets, même résultat : la racine ne compte pas */
    const k = temp();
    try { ecrire(k, 'jeu-1-12.jsonl', 'ligne 1\n'); ecrire(k, 'sous/jeu-2-1.jsonl', 'ligne 2\n'); assert.equal(E.verifier(doc, { racine: r, racineJeux: k }).ok, true); } finally { fs.rmSync(k, { recursive: true, force: true }); }
  } finally { fs.rmSync(r, { recursive: true, force: true }); fs.rmSync(j, { recursive: true, force: true }); }
});

test('ligne de commande : écrire puis vérifier, et un changement fait échouer la vérification', () => {
  const { spawnSync } = require('node:child_process');
  const r = temp();
  try {
    const sortie = path.join(r, 'emp.json');
    const e = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'gcv2-empreintes.cjs'), 'ecrire', '--date', '2026-10-19', '--sortie', sortie], { encoding: 'utf8' });
    assert.equal(e.status, 0, e.stderr);
    const doc = JSON.parse(fs.readFileSync(sortie, 'utf8'));
    assert.equal(E.verifier(doc).ok, true, 'le dépôt est conforme à l\'instant de l\'écriture');
    /* on abîme une empreinte consignée : la vérification échoue (code 1) et nomme le fichier */
    doc.fichiers[0].sha256 = '0'.repeat(64);
    const abime = path.join(r, 'abime.json'); fs.writeFileSync(abime, JSON.stringify(doc));
    const v = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'gcv2-empreintes.cjs'), 'verifier', '--fichier', abime], { encoding: 'utf8' });
    assert.equal(v.status, 1); assert.match(v.stdout, new RegExp('ÉCART fichiers ' + doc.fichiers[0].chemin.replace(/[.]/g, '[.]')));
  } finally { fs.rmSync(r, { recursive: true, force: true }); }
});

test('le fichier d\'empreintes du dépôt : bien formé, toutes les pièces du protocole § 1, aucun chemin absolu', () => {
  const doc = JSON.parse(fs.readFileSync(E.FICHIER, 'utf8'));
  assert.equal(doc.format, E.FORMAT); assert.match(doc.date, /^\d{4}-\d{2}-\d{2}$/);
  const chemins = doc.fichiers.map(f => f.chemin);
  for (const exige of ['src/engine.js', 'src/hauteur-apprise.js', 'datasets/reglages-figes.json', 'datasets/gcv2-parametres.json', 'datasets/gcv2-variantes.json', 'datasets/relecture-reglages-proposes.json',
    'tools/gcv2-evaluer.cjs', 'tools/gcv2-apprendre.cjs', 'tools/relecture-autonome.cjs']) assert.ok(chemins.includes(exige), exige);
  assert.deepEqual(chemins, E.PIECES.map(p => p[0]), 'les pièces consignées sont celles de la liste de l\'outil');
  for (const f of doc.fichiers) { assert.match(f.sha256, /^[0-9a-f]{64}$/); assert.ok(!path.isAbsolute(f.chemin) && !f.chemin.includes('..'), f.chemin); assert.ok(fs.existsSync(path.join(__dirname, '..', f.chemin)), `${f.chemin} existe`); }
  for (const famille of ['jeux', 'cas']) for (const x of doc[famille] || []) { assert.match(x.sha256, /^[0-9a-f]{64}$/); assert.ok(!path.isAbsolute(x.chemin) && !x.chemin.includes('..'), x.chemin); }
  /* jeu causal (14 parties, D-213) : un jeu de relecture et un jeu « lot » par partie, un cas par partie ; leurs empreintes sont celles que les paramètres
   * appris sur le jeu causal nomment (datasets/gcv2-parametres-causal.json : `parties` pour la relecture, `partiesLot` pour le lot). */
  const params = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datasets', 'gcv2-parametres-causal.json'), 'utf8'));
  assert.ok(Array.isArray(doc.jeux) && doc.jeux.length === params.parties.length + params.partiesLot.length, 'un jeu de relecture et un jeu lot par partie d\'apprentissage');
  assert.ok(Array.isArray(doc.cas) && doc.cas.length === params.parties.length, 'un cas par partie');
  for (const [liste, prefixe] of [[params.parties, 'jeu'], [params.partiesLot, 'jeu-lot']]) for (const p of liste) {
    const [pr, n] = p.partie.split(':'); const j = doc.jeux.find(x => x.chemin === `${prefixe}-${pr}-${n}.jsonl`);
    assert.ok(j, `${prefixe} ${p.partie}`); assert.equal(j.sha256, p.sha256, `${prefixe} ${p.partie} : même empreinte que les paramètres exportés`);
  }
  const brut = fs.readFileSync(E.FICHIER, 'utf8');
  assert.ok(!/\/tmp\/|\/home\/|scratchpad/.test(brut), 'aucun chemin de machine');
});
