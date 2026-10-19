/* 4.9.5 test 10-ui : les trois versions installables du panneau habillé, une par présentation.
 *   4.9.5.10 « 4.9.5 test 10 » : Linear     4.9.5.11 « 4.9.5 test 11 » : Raycast     4.9.5.12 « 4.9.5 test 12 » : Figma et Arc
 * Même code, même moteur, mêmes exports ; seuls changent les chaînes de version (tests/version-49510.test.cjs) et la présentation proposée au départ
 * (src/ui5-variante.js). Les trois présentations sont dans chaque paquet et se choisissent dans Réglages ; l'ancien panneau aussi.
 *   node tools/ui5-paquets.cjs estampiller <version>     pose les chaînes de la version (4.9.5.10, .11 ou .12) dans l'arbre de travail
 *   node tools/ui5-paquets.cjs paquets <dossier>         estampille, empaquette (tools/package.py) et calcule le SHA-256 des trois, puis remet l'arbre à la version de départ */
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { spawnSync } = require('node:child_process');
const racine = path.resolve(__dirname, '..');
const VERSIONS = { '4.9.5.10': 'linear', '4.9.5.11': 'raycast', '4.9.5.12': 'figma' };
const nomDe = v => { const p = v.split('.'); return `${p[0]}.${p[1]}.${p[2]} test ${p[3]}`; };
const lire = f => fs.readFileSync(path.join(racine, f), 'utf8');
function estampiller(version) {
  if (!VERSIONS[version]) throw new Error('version inconnue : ' + version);
  const m = JSON.parse(lire('manifest.json')), vA = m.version, nA = m.version_name, nN = nomDe(version), defaut = VERSIONS[version];
  const edits = {
    'manifest.json': [[`"version": "${vA}"`, `"version": "${version}"`], [`Ouvrir Ariane ${nA} — V1`, `Ouvrir Ariane ${nN} — V1`], [`"version_name": "${nA}"`, `"version_name": "${nN}"`]],
    'src/core.js': [[`VERSION='${vA}',VERSION_NAME='${nA}'`, `VERSION='${version}',VERSION_NAME='${nN}'`]],
    'background.js': [[`BananeCore3?.VERSION||'${vA}',VERSION_NAME=globalThis.BananeCore3?.VERSION_NAME||'${nA}'`, `BananeCore3?.VERSION||'${version}',VERSION_NAME=globalThis.BananeCore3?.VERSION_NAME||'${nN}'`]],
    'src/bridge.js': [[`'Ariane ${nA} · ouvrir'`, `'Ariane ${nN} · ouvrir'`]],
    'panel.js': [[`home:'${nA}'`, `home:'${nN}'`]],
    'panel.html': [[`<title>Ariane ${nA}</title>`, `<title>Ariane ${nN}</title>`], [`<span>${nA}</span>`, `<span>${nN}</span>`], [`<footer>Ariane ${nA} ·`, `<footer>Ariane ${nN} ·`]],
    'src/ui5-variante.js': [[/defaut: '[a-z]+'/, `defaut: '${defaut}'`]],
  };
  for (const [f, liste] of Object.entries(edits)) {
    let t = lire(f);
    for (const [a, b] of liste) {
      if (typeof a === 'string' ? !t.includes(a) : !a.test(t)) throw new Error(`${f} : motif absent : ${a}`);
      t = t.replace(a, b);
    }
    fs.writeFileSync(path.join(racine, f), t);
  }
  return { version, nom: nN, defaut };
}
function paquets(dossier) {
  const depart = JSON.parse(lire('manifest.json')).version, sortie = [];
  fs.mkdirSync(dossier, { recursive: true });
  try {
    for (const v of Object.keys(VERSIONS)) {
      const e = estampiller(v), zip = path.join(dossier, `ariane-4.9.5-test.${v.split('.')[3]}-${e.defaut}.zip`);
      const r = spawnSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(racine, 'tools/package.py'), '--output', zip], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(r.stderr || r.stdout);
      sortie.push({ ...e, fichier: path.basename(zip), octets: fs.statSync(zip).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex') });
    }
  } finally { if (VERSIONS[depart]) estampiller(depart); }
  return sortie;
}
if (require.main === module) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'estampiller') console.log(JSON.stringify(estampiller(arg)));
  else if (cmd === 'paquets') console.log(JSON.stringify(paquets(path.resolve(arg || path.join(racine, '..', 'paquets-ui5'))), null, 1));
  else { console.error('usage : estampiller <version> | paquets <dossier>'); process.exit(2); }
}
module.exports = { estampiller, paquets, VERSIONS, nomDe };
