'use strict';
/* CH-001 : le scan des motifs interdits est vert quand l'arbre suivi n'a plus d'occurrence hors exclusions.
 * Les motifs plantés ici sont des fragments concaténés : ce fichier ne contient pas lui-même de courriel,
 * de code projet ni d'adresse en clair. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const S = require('../tools/scan-identite.cjs');

const outil = path.join(__dirname, '..', 'tools', 'scan-identite.cjs');
const courriel = ['a@', 'b.fr'].join('');
const uuid = ['12345678-1234-1234-1234-', '1234567890ab'].join('');
const projet = ['Project', '__123456'].join('');
const page = ['https://', 'exemple.horsliste/page'].join('');
const svg = ['https://', 'www.w3.org/2000/svg'].join('');
const depot = ['https://', 'github.com/StoryNow30/banane'].join('');
const autreDepot = ['https://', 'github.com/autre/banane'].join('');
const hote = ['hote-esv', '.exemple'].join('');
const urlHote = ['https://', hote, '/rails'].join('');

function politique() {
  const p = S.chargerPolitique();
  return { liste: p.liste, hotes: new Set([hote]), confidentiel: null };
}

test('les quatre motifs publics sont trouvés, la liste blanche laisse passer le reste', () => {
  const p = politique();
  const t = S.releverTexte(['contact ', courriel, ' lot ', uuid, ' ', projet, ' voir ', page, ' et ', svg, ' et ', depot, ' et ', autreDepot].join(''), p);
  assert.deepEqual(t.map(x => x.motif).sort(), ['courriel', 'projetESV', 'uuid', 'web', 'web']);
  assert.equal(S.releverTexte(['voir ', svg, ' et ', depot].join(''), p).length, 0);
});

test('l\'hôte lu du manifeste est un motif à part, et l\'exclusion ne couvre que ce motif', () => {
  const p = politique();
  const t = S.releverTexte(['origine ', urlHote, ' et ', courriel].join(''), p);
  assert.deepEqual(t.map(x => x.motif).sort(), ['courriel', 'hoteESV']);
  const j = S.chargerPolitique();
  assert.equal(S.estExclu('manifest.json', 'hoteESV', j.exclusions), true);
  assert.equal(S.estExclu('background.js', 'hoteESV', j.exclusions), true);
  assert.equal(S.estExclu('manifest.json', 'courriel', j.exclusions), false);
  assert.equal(S.estExclu('fiches/CONNEXION_T21.md', 'hoteESV', j.exclusions), false);
});

test('un motif confidentiel dans l\'adresse de l\'hôte compte comme hôte ESV ; un autre motif confidentiel reste signalé', () => {
  const p = politique();
  p.confidentiel = S.compilerConfidentiel({ ARIANE_MOTIFS_INTERDITS: [hote.replace(/\./g, '\\.'), 'ZZNOM'].join('|') });
  const t = S.releverTexte(['voir ', urlHote, ' puis ZZNOM'].join(''), p);
  assert.deepEqual(t.map(x => x.motif).sort(), ['confidentiel', 'hoteESV']);
  assert.throws(() => S.compilerConfidentiel({ ARIANE_MOTIFS_INTERDITS: '(' }), /invalide/);
});

test('les UUID des corpus sont exclus par répertoire, pas ceux d\'une fiche', () => {
  const j = S.chargerPolitique();
  for (const prefixe of ['audit/', 'tests/fixtures/', 'tests/incidents/', 'tests/corpus/', 'datasets/']) {
    assert.equal(S.estExclu(prefixe + 'lot.json', 'uuid', j.exclusions), true, prefixe);
  }
  assert.equal(S.estExclu('fiches/FICHE_B1.md', 'uuid', j.exclusions), false);
  assert.equal(S.estExclu('tools/memoire-differes.cjs', 'uuid', j.exclusions), true);
  assert.equal(S.estExclu('tools/rejeu-voie-predite.cjs', 'uuid', j.exclusions), true);
  assert.equal(S.estExclu('tools/memoire-differes.cjs', 'web', j.exclusions), false);
});

test('chaque exclusion, chaque domaine et chaque hors-scan a une raison', () => {
  const j = S.chargerPolitique();
  for (const e of [...j.liste, ...j.exclusions, ...j.horsScan]) assert.ok(e.raison.trim().length > 10, JSON.stringify(e));
  const manifest = j.exclusions.find(e => e.chemin === 'manifest.json');
  assert.match(manifest.raison, /fonctionnement de l'extension/);
});

test('l\'arbre suivi n\'a plus d\'occurrence hors exclusions, et l\'absence du motif confidentiel est dite', () => {
  const env = { ...process.env };
  delete env.ARIANE_MOTIFS_INTERDITS;
  const r = spawnSync(process.execPath, [outil], { encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stdout);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /ARIANE_MOTIFS_INTERDITS absente/);
});

test('une expression confidentielle illisible arrête l\'outil', () => {
  const r = spawnSync(process.execPath, [outil], { encoding: 'utf8', env: { ...process.env, ARIANE_MOTIFS_INTERDITS: '(' } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /invalide/);
});
