'use strict';
/* I1 (audit 5.0) : aucun nom de modèle d'IA dans les fichiers suivis du dépôt (règle du cahier § 2).
 * On parle de niveaux : « niveau fort », « niveau rapide », « niveau éclair », « niveau maximal ».
 * Les motifs sont construits à partir de fragments concaténés : cet essai ne contient lui-même aucun nom interdit,
 * et ne s'accuse donc pas. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const racine = path.join(__dirname, '..');

const MOTS = [['op', 'us'], ['son', 'net'], ['hai', 'ku'], ['fa', 'ble']].map(f => f.join(''));
const MOTIF_MOTS = new RegExp('\\b(?:' + MOTS.join('|') + ')\\b', 'i');
const MOTIF_GPT = new RegExp('\\b' + ['g', 'pt'].join('') + '-?[0-9]', 'i');                  // identifiant d'un modèle d'un autre éditeur
const MOTIF_ID = new RegExp('\\b' + ['clau', 'de'].join('') + '-(?:[a-z]+-[0-9]|[0-9]+(?:\\.[0-9]+)?-[a-z])', 'i');   // préfixe d'identifiant de modèle (pas un chemin tel que .../clau-de-0/...)
const MOTIFS = [MOTIF_MOTS, MOTIF_GPT, MOTIF_ID];

function fichiersSuivis() {
  const r = cp.spawnSync('git', ['-C', racine, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  if (r.status === 0) return r.stdout.toString('utf8').split('\0').filter(Boolean);
  const out = [];   // copie sans .git (archive) : on parcourt le dossier
  (function marche(d) {
    for (const e of fs.readdirSync(path.join(racine, d), { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const rel = d ? path.join(d, e.name) : e.name;
      if (e.isDirectory()) marche(rel); else out.push(rel);
    }
  })('');
  return out;
}
const estBinaire = buf => buf.subarray(0, 8000).includes(0);

/* Rend les occurrences « fichier:ligne » sans recopier le mot trouvé. */
function occurrences(fichiers, lire = f => fs.readFileSync(path.join(racine, f))) {
  const trouvees = [];
  for (const f of fichiers) {
    let buf; try { buf = lire(f); } catch { continue; }
    if (estBinaire(buf)) continue;
    buf.toString('utf8').split('\n').forEach((l, i) => { if (MOTIFS.some(m => m.test(l))) trouvees.push(`${f}:${i + 1}`); });
  }
  return trouvees;
}

test('aucun nom de modèle d\'IA dans les fichiers suivis', () => {
  const fichiers = fichiersSuivis();
  assert.ok(fichiers.length > 100, 'la liste des fichiers est lue');
  assert.deepEqual(occurrences(fichiers), [], 'remplace le nom par un niveau (fort, rapide, éclair, maximal)');
});

test('les motifs attrapent bien les noms (sur des chaînes fabriquées) et laissent passer le reste', () => {
  const faux = [MOTS[0] + ' 5', 'avec ' + MOTS[1].toUpperCase(), 'un ' + MOTS[2] + '.', ['G', 'PT'].join('') + '-6', ['clau', 'de'].join('') + '-3-x', ['clau', 'de'].join('') + '-x-4'];
  for (const s of faux) assert.ok(MOTIFS.some(m => m.test(s)), s.length + ' caractères');
  for (const s of ['niveau fort', 'niveau maximal', 'Claude Code', 'claude/50-base', '/tmp/' + ['clau', 'de'].join('') + '-0/-home', 'opusculaire', 'les ' + ['fa', 'bles'].join('') + ' de la ville']) assert.ok(!MOTIFS.some(m => m.test(s)), s);
  const lire = f => Buffer.from(f === 'a.md' ? 'ligne 1\n' + MOTS[1] + ' ici\n' : 'rien\n');
  assert.deepEqual(occurrences(['a.md', 'b.md'], lire), ['a.md:2']);
  assert.deepEqual(occurrences(['c.bin'], () => Buffer.from([0, 1, 2, ...Buffer.from(MOTS[0])])), [], 'les fichiers binaires sont ignorés');
});
