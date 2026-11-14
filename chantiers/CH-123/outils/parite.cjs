#!/usr/bin/env node
'use strict';
/* CH-123 : parité banc / service worker d'un lot-partie du banc de CH-116, deuxième passe comprise, pour un réglage. Hors ligne, lecture seule ;
 * rien n'est commandé dans ESV (l'ESV de `tools/parite-l1se-sw.cjs` est simulé). Aucune donnée de lot n'est écrite au dépôt.
 *   node chantiers/CH-123/outils/parite.cjs --copie COPIE --cle 0411-p15-r1 --nom N [--leviers-fichier F.json] [--sortie DOSSIER]
 * COPIE : copie du dépôt avec les patchs du réglage, banc et service worker (hors dépôt). `--leviers-fichier` : leviers du réglage (JSON) ; absent : éteint.
 * Étapes :
 *  1. rejeu de référence du banc de la copie sur ce lot-partie, profil L1-se, avec la recette livrée de la deuxième passe (src/settings.js de la
 *     copie : `passes`, `leviers`) et les leviers du réglage (BANC_LEVIERS) ;
 *  2. `tools/parite-l1se-sw.cjs --passe` de la copie, mêmes leviers (`--leviers`) : le lot rejoué dans le vrai service worker, cut par cut.
 * Sortie standard : une ligne JSON sans identifiant (clé, cuts, lignes différentes, écarts par numéro de cut, poses de la passe des deux côtés ;
 * `touchesAuBanc` : cuts marqués par `banc-touches.patch` si la copie le porte, vide sinon).
 * Données : CH116_TRAVAIL (méta et captures réduites du banc de CH-116). Durée : environ 13 s par cut, seule sur la machine (R7). */
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const a = process.argv.slice(2), o = {};
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--copie') o.copie = path.resolve(v()); else if (k === '--cle') o.cle = v(); else if (k === '--nom') o.nom = v(); else if (k === '--leviers-fichier') o.leviers = JSON.parse(fs.readFileSync(v(), 'utf8')); else if (k === '--sortie') o.sortie = path.resolve(v()); else throw Error('option inconnue ' + k); }
if (!o.copie || !o.cle || !o.nom) throw Error('--copie COPIE --cle CLE --nom N [--leviers-fichier F.json] [--sortie DOSSIER]');
const T = process.env.CH116_TRAVAIL || path.join(process.env.HOME || '/root', 'ch116'), m = JSON.parse(fs.readFileSync(path.join(T, 'meta', o.cle + '.json'), 'utf8'));
if (!m.liste) throw Error(`${o.cle} : pas de liste d'ESV, la parité avec passe ne peut pas tourner`);
const out = o.sortie || path.join(T, 'parite'); fs.mkdirSync(out, { recursive: true });
const S = require(path.join(o.copie, 'src', 'settings.js')), R = S.lot.passeDifferes, leviers = o.leviers || {};
const communs = ['--partie', '1:' + m.partie, '--journal', m.journal, ...[].concat(m.captures).flatMap(c => ['--corpus', c]), '--lot', m.lotId, '--liste', m.liste];
const ref = path.join(out, `${o.cle}-${o.nom}-banc.jsonl`), sw = path.join(out, `${o.cle}-${o.nom}-sw.jsonl`), t0 = Date.now();
if (!fs.existsSync(ref)) {
  const r = cp.spawnSync(process.execPath, ['--max-old-space-size=6144', path.join(o.copie, 'tools', 'banc-differes.cjs'), 'rejouer', ...communs, '--profils', 'L1-se', '--sortie', ref + '.part'],
    { env: { ...process.env, BANC_LEVIERS: JSON.stringify({ ...leviers, deuxiemePasse: R.passes, passe2Leviers: R.leviers }) }, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw Error('rejeu de référence en échec\n' + String(r.stderr).slice(-1500));
  fs.renameSync(ref + '.part', ref);
}
const tRef = Math.round((Date.now() - t0) / 1000);
const p = cp.spawnSync(process.execPath, ['--max-old-space-size=6144', path.join(o.copie, 'tools', 'parite-l1se-sw.cjs'), '--racine', o.copie, ...communs, '--banc', ref, '--sortie', sw, '--passe',
  ...(o.leviers ? ['--leviers', JSON.stringify(leviers)] : [])], { encoding: 'utf8', maxBuffer: 1 << 26 });
if (p.status !== 0) throw Error('parité en échec\n' + String(p.stderr).slice(-1500));
const x = JSON.parse(p.stdout.trim().split('\n').at(-1));
const banc = fs.readFileSync(ref, 'utf8').trim().split('\n').slice(1).map(s => JSON.parse(s)), marque = l => { const y = l.profils['L1-se'] || {}; return (y.l1 && y.l1.c123) || (y.passe2 && y.passe2.c123) || null; };
process.stdout.write(JSON.stringify({ cle: o.cle, nom: o.nom, leviers: o.leviers ? Object.keys(leviers).filter(k => leviers[k] === true) : 'éteint', profil: x.profil, cuts: x.cuts, rejoues: x.rejoues, absents: (x.absents || []).length,
  differesSw: x.differesSw, passe: x.passe, lignesDifferentes: x.lignesDifferentes, diffs: x.diffs, touchesAuBanc: banc.filter(marque).map(l => l.cut),
  posesBanc: banc.filter(l => (l.profils['L1-se'] || {}).etat === 'pose').length, dureeRefS: tRef, dureeS: x.dureeS }) + '\n');
process.exitCode = x.lignesDifferentes ? 1 : 0;
