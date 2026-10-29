#!/usr/bin/env node
/* CH-014 : assemble chaque maquette autonome de maquettes/ui-v2/ à partir de sources/.
 *   node maquettes/ui-v2/sources/construire.cjs
 * Dans sources/<nom>.html : « /*COMMUN*\/ » reçoit commun.js, « /*POLICE:<fichier>*\/ »
 * reçoit sources/polices/<fichier>.css (polices en base64, aucune requête réseau à l'ouverture),
 * « /*INCLURE:<fichier>*\/ » reçoit sources/<fichier> (code partagé par quelques maquettes, CH-020). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ICI = __dirname;
const SORTIE = path.resolve(ICI, '..');
const MAQUETTES = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(ICI).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort();
const commun = fs.readFileSync(path.join(ICI, 'commun.js'), 'utf8');

for (const nom of MAQUETTES) {
  const source = path.join(ICI, nom + '.html');
  if (!fs.existsSync(source)) continue;
  let html = fs.readFileSync(source, 'utf8');
  html = html.replace(/\/\*POLICE:([a-z0-9-]+)\*\//g, (_, f) => fs.readFileSync(path.join(ICI, 'polices', f + '.css'), 'utf8'));
  html = html.replace('/*COMMUN*/', () => commun);
  html = html.replace(/\/\*INCLURE:([a-z0-9.-]+)\*\//g, (_, f) => fs.readFileSync(path.join(ICI, f), 'utf8'));
  html = html.replace(/^(<!doctype html>)/i, '$1\n<!-- Fichier assemblé par sources/construire.cjs : modifier sources/' + nom + '.html, pas ce fichier. -->');
  fs.writeFileSync(path.join(SORTIE, nom + '.html'), html);
  console.log(nom + '.html', Math.round(html.length / 1024) + ' Kio');
}

/* Page comparative : regénérée à chaque construction, à partir de toutes les sources. */
const FAMILLES = [
  ['', 'Feuille blanche', 'Quatre propositions de l’intégrateur, chacune tirée de deux ou trois références nommées.'],
  ['instr-', 'Instruments et matière', 'Le panneau est un objet qu’on manipule et qu’on lit comme un instrument.'],
  ['mouv-', 'Le mouvement porte l’état', 'Ce qui bouge, et comment, dit l’état ; le texte confirme.'],
  ['app-', 'Motifs d’application', 'Des parcours et motifs d’apps éprouvés, choisis pour un opérateur qui surveille de loin.'],
  ['edito-', 'Éditorial et typographie', 'La typographie, la mise en page et le récit portent l’état.'],
  ['matiere-', 'Lumière, atmosphère, 3D', 'La lumière, la matière et l’image du relevé lui-même.'],
  ['info-', 'Signalétique et information', 'Un système d’information compris d’un coup d’œil, sans couleur.'],
  ['faisceau-', 'Faisceau approfondi (CH-020)', 'Quatre pistes tirées du Faisceau ; chacune corrige un défaut nommé de la maquette d’origine.'],
];
const texte = (h) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const toutes = fs.readdirSync(ICI).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort();
const fiches = toutes.map((nom) => {
  const h = fs.readFileSync(path.join(ICI, nom + '.html'), 'utf8');
  const titre = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || nom;
  const notes = (h.match(/<aside class="notes">([\s\S]*?)<\/aside>/) || [])[1] || '';
  const paras = [...notes.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((x) => texte(x[1]));
  const source = paras.find((p) => /^D.où ça vient/.test(p)) || '';
  const sens = paras.find((p) => /^Ce que ça veut dire/.test(p)) || paras[0] || '';
  const fam = FAMILLES.slice(1).find(([pre]) => nom.startsWith(pre)) || FAMILLES[0];
  return { nom, titre, famille: fam[1], source: source.replace(/^D.où ça vient\.\s*/, ''), sens: sens.replace(/^Ce que ça veut dire ici\.\s*/, '') };
});
const modele = fs.readFileSync(path.join(ICI, 'index.modele.tpl'), 'utf8');
const json = JSON.stringify({ familles: FAMILLES.map(([p, t, d]) => ({ prefixe: p, titre: t, desc: d })), maquettes: fiches }).replace(/</g, '\\u003c');
fs.writeFileSync(path.join(SORTIE, 'index.html'), modele.replace('/*DONNEES*/null', () => json));
console.log('index.html', fiches.length + ' maquettes');
