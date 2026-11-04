'use strict';
/* CH-049-C : tools/profil-json-flux.cjs pèse un JSON énorme (centaines de Mo, au-delà de la chaîne maximale de Node) en un seul passage,
 * sans le charger, et en extrait un échantillon. Données fabriquées. Les chiffres du profil sont comparés à un calcul en mémoire. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const P = require('../tools/profil-json-flux.cjs');

const doc = {
  meta: { nom: 'a"b}{[]\\', accents: 'é€𝄞', n: 12.5e3, ok: true, rien: null },
  traj: Array.from({ length: 50 }, (_, i) => ({ t: i, p: [i * 1.5, i * 2.5, 100 - i], etiquette: 'pt' + i, imbrique: { a: [1, [2, 3], { z: 'x,y]' }] } })),
  vide: [], videO: {}, texte: 'long '.repeat(100),
};
const octets = Buffer.from(JSON.stringify(doc, null, 1));   // avec espaces et retours : le profil ne doit pas en dépendre

/* Calcul de référence en mémoire : octets de la sérialisation compacte de chaque valeur, par chemin. */
function reference(v, chemin, prof, out) {
  const taille = Buffer.byteLength(JSON.stringify(v));
  const e = out[chemin] || (out[chemin] = { n: 0, octets: 0 }); e.n++; e.octets += taille;
  if (prof <= 0) return;
  if (Array.isArray(v)) v.forEach(x => reference(x, chemin + '[]', prof - 1, out));
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) reference(v[k], chemin + '.' + k, prof - 1, out);
}

for (const bloc of [octets.length, 64, 7, 1]) {
  test(`profil : mêmes comptes que le calcul en mémoire, lecture par blocs de ${bloc} octet(s)`, () => {
    const prof = P.profiler([octets.subarray(0, 0), ...Array.from({ length: Math.ceil(octets.length / bloc) }, (_, i) => octets.subarray(i * bloc, (i + 1) * bloc))], { profondeur: 4 });
    const ref = {}; reference(doc, '$', 4, ref);
    for (const [chemin, v] of Object.entries(ref)) {
      const got = prof.chemins[chemin];
      assert.ok(got, 'chemin présent : ' + chemin);
      assert.equal(got.n, v.n, 'nombre de valeurs ' + chemin);
      assert.equal(got.octets, v.octets, 'octets compacts ' + chemin);
    }
    assert.equal(Object.keys(prof.chemins).length, Object.keys(ref).length, 'aucun chemin en trop');
    assert.equal(prof.octetsLus, octets.length);
  });
}

test('extraction : un élément sur pas, au plus max, valeurs relues à l’identique', () => {
  const r = P.profiler([octets], { profondeur: 2, extraire: '$.traj[]', pas: 7, max: 4 });
  assert.equal(r.echantillon.length, 4);
  assert.deepEqual(r.echantillon.map(JSON.parse), [0, 7, 14, 21].map(i => doc.traj[i]));
});

test('un JSON invalide est refusé', () => {
  assert.throws(() => P.profiler([Buffer.from('{"a":[1,2}')], {}), /JSON invalide/);
  assert.throws(() => P.profiler([Buffer.from('{"a":1')], {}), /JSON invalide|incomplet/);
});

test('ligne de commande : fichier de 40 Mo lu en flux, profil et échantillon', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profil-'));
  const f = path.join(dir, 'gros.json');
  const fd = fs.openSync(f, 'w');
  fs.writeSync(fd, '{"traj":[');
  const ligne = i => JSON.stringify({ t: i, x: [i * 0.1, i * 0.2, i * 0.3], flag: i % 3 === 0 });
  let n = 0; for (let b = 0; b < 400; b++) { let s = ''; for (let k = 0; k < 2000; k++, n++) s += (n ? ',' : '') + ligne(n); fs.writeSync(fd, s); }
  fs.writeSync(fd, '],"fin":true}'); fs.closeSync(fd);
  const r = spawnSync(process.execPath, [path.resolve(__dirname, '..', 'tools', 'profil-json-flux.cjs'), f, '--profondeur', '3', '--extraire', '$.traj[]', '--pas', '100000', '--max', '3', '--sortie', path.join(dir, 'ech.ndjson')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\$\.traj\[\]\s+800000\s/);
  const lignes = fs.readFileSync(path.join(dir, 'ech.ndjson'), 'utf8').trim().split('\n');
  assert.deepEqual(lignes.map(l => JSON.parse(l).t), [0, 100000, 200000]);
});
