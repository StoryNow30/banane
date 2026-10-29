#!/usr/bin/env node
/* CH-022 : assemble Q-signal-2.html et Q-signal-3.html à partir de signal-sources/.
 * CH-024 : et Q-signal-4.html, Q-signal-5.html (le mix : data-mix, socle.css puis mix.css).
 *   node maquettes/ui-5.0/outils/construire-signal.cjs
 * Un seul code (signal.js) et un seul socle (socle.css) pour les deux niveaux : mêmes scènes, mêmes
 * commandes. Le niveau (data-v) choisit les jetons et les gestes. Polices : IBM Plex (OFL) lues dans
 * ../../fonts/ comme Q-signal.html ; Zodiak (Fontshare, licence ITF FFL) incluse en base64 pour Q3,
 * depuis maquettes/ui-v2/sources/polices/zodiak.css (aucun chargement externe). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ICI = path.resolve(__dirname, '..');
const SRC = path.join(ICI, 'signal-sources');
const lire = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const PLEX = ['IBMPlexSans-latin-400:IBM Plex Sans:400', 'IBMPlexSans-latin-500:IBM Plex Sans:500', 'IBMPlexMono-latin-400:IBM Plex Mono:400', 'IBMPlexMono-latin-500:IBM Plex Mono:500']
  .map((x) => { const [f, n, g] = x.split(':'); return `@font-face{font-family:"${n}";src:url(../../fonts/${f}.woff2) format("woff2");font-weight:${g};font-display:block}`; }).join('\n');
const ZODIAK = fs.readFileSync(path.resolve(ICI, '../ui-v2/sources/polices/zodiak.css'), 'utf8').trim();

const PAGES = [
  { v: '2', fichier: 'Q-signal-2.html', titre: 'Q2 · Signal raffiné', chiffre: 'plex', polices: PLEX,
    description: 'Maquette Ariane 5.0, Signal raffiné (CH-022), niveau mesuré : mêmes composants, un seul système de valeurs, couleurs à rôle unique, symboles tirés du rail. Chiffres inventés.' },
  { v: '3', fichier: 'Q-signal-3.html', titre: 'Q3 · Signal, Frise', chiffre: 'zodiak', polices: PLEX + '\n' + ZODIAK,
    description: 'Maquette Ariane 5.0, Signal raffiné (CH-022), niveau poussé : les gestes de la Frise de lumière sur l’architecture de Signal. Chiffres inventés.' },
  { v: '4', mix: true, fichier: 'Q-signal-4.html', titre: 'Q4 · Signal, mix', chiffre: 'plex', polices: PLEX,
    description: 'Maquette Ariane 5.0 (CH-024), mix strict : dessins et fond de Signal, couleurs à rôle unique et système de valeurs de Q2. Chiffres inventés.' },
  { v: '5', mix: true, fichier: 'Q-signal-5.html', titre: 'Q5 · Signal, mix noir', chiffre: 'plex', polices: PLEX,
    description: 'Maquette Ariane 5.0 (CH-024), le mix de Q4 sur un noir plus profond. Chiffres inventés.' },
];
for (const p of PAGES) {
  let html = lire('page.html');
  html = html.replace('{{V}}', p.v).replace('{{CHIFFRE}}', p.chiffre).replace('{{TITRE}}', p.titre).replace('{{DESCRIPTION}}', p.description);
  html = html.replace('/*POLICES*/', () => '/* polices locales : IBM Plex (OFL, ../../fonts/)' + (p.v === '3' ? ' ; Zodiak (Fontshare, ITF FFL, en base64)' : '') + ' */\n' + p.polices);
  if (p.mix) html = html.replace(`data-v="${p.v}"`, `data-v="${p.v}" data-mix="1"`);
  html = html.replace('/*CSS*/', () => lire('socle.css') + (p.mix ? lire('mix.css') : ''));
  html = html.replace('/*JS*/', () => lire('signal.js'));
  html = html.replace(/^(<!doctype html>)/i, '$1\n<!-- Fichier assemblé par outils/construire-signal.cjs : modifier signal-sources/, pas ce fichier. -->');
  fs.writeFileSync(path.join(ICI, p.fichier), html);
  console.log(p.fichier, Math.round(html.length / 1024) + ' Kio');
}
