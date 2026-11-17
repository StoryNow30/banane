'use strict';
/* CH-135 : LA PAGE DE DÉMONSTRATION de Cadran : le vrai panneau (panel.html, données fabriquées) photographié à l'échelle 1, 600 × 760, toutes les scènes, deux
 * thèmes ; puis la comparaison à taille égale (420 × 800) avec les écrans exportés du prototype Figma. Les photos sont mises DANS la page (data:) : la page
 * n'est jamais versée au dépôt (CLAUDE.md : aucune capture d'écran dans le dépôt). Usage :
 * CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-135/outils/page.cjs SORTIE.html DOSSIER_FIGMA */
const path = require('node:path'), fs = require('node:fs');
const R = path.resolve(__dirname, '../../..'), navigateur = require(R + '/tests/esv-maquette/navigateur.cjs');
const { SCENES, ouvrirScene } = require('./scenes.cjs');
const NOMS = { repos: 'Orbite · prêt', cours: 'Orbite · lot en cours', pause: 'Orbite · en pause', arrete: 'Orbite · arrêté', fin: 'Orbite · terminé', toi: 'Orbite · à toi (rail non résolu)',
  muet: 'Orbite · ESV muet', erreur: 'Orbite · erreur du lot', 'sans-onglet': 'Orbite · aucun onglet ESV', relecture: 'Relecture en cours', 'relecture-pause': 'Relecture en pause (bornes CH-133)',
  'relecture-interrompue': 'Relecture interrompue', rattrapage: 'Rattrapage (deuxième passe)', constellation: 'Constellation · partie en cours', 'constellation-passage': 'Constellation · passage',
  'constellation-arret': 'Constellation · arrêtée', 'constellation-fin': 'Constellation · terminée', 'constellation-stats': 'Constellation · bilan et départs', 'constellation-repos': 'Constellation · prête',
  aurore: 'Aurore · cut ouvert', 'aurore-vide': 'Aurore · rien à revoir', echo: 'Écho · en observation', details: 'Orbite · détails ouverts', tiroir: 'Ce qui reste', menu: 'Menu',
  palette: 'Commandes (Ctrl K)', reglages: 'Réglages (Interface : Cadran)', esv: 'Onglets ESV', 'boite-file': 'Nouvelle Constellation', tech: 'Détails techniques' };
const FIGMA = [['01-sombre-pret.png', 'repos', 'sombre'], ['02-sombre-en-cours-cut6.png', 'cours', 'sombre'], ['05-sombre-pause.png', 'pause', 'sombre'], ['07-sombre-arrete.png', 'arrete', 'sombre'], ['08-sombre-termine.png', 'fin', 'sombre'], ['13-clair-en-cours.png', 'cours', 'clair']];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
(async () => {
  const [sortie, figma] = process.argv.slice(2);
  const { chromium } = require(navigateur.modulePlaywright()), nav = await chromium.launch({ executablePath: navigateur.executable() });
  const photo = async (nom, o) => { const { ctx, page, erreurs } = await ouvrirScene(nav, SCENES[nom], o); const b = await page.screenshot(); await ctx.close(); if (erreurs.length) console.log(nom, erreurs); return 'data:image/png;base64,' + b.toString('base64'); };
  const cartes = { sombre: [], clair: [] };
  for (const theme of ['sombre', 'clair']) for (const nom of Object.keys(SCENES)) cartes[theme].push(`<figure><img loading="lazy" width="600" height="760" alt="${esc(NOMS[nom] || nom)}" src="${await photo(nom, { theme })}"><figcaption>${esc(NOMS[nom] || nom)}</figcaption></figure>`);
  const comp = [];
  for (const [f, nom, theme] of FIGMA) {
    const fig = figma && fs.existsSync(path.join(figma, f)) ? 'data:image/png;base64,' + fs.readFileSync(path.join(figma, f)).toString('base64') : null;
    comp.push(`<div class="paire"><figure>${fig ? `<img width="420" height="800" alt="Figma" src="${fig}">` : '<p>absente</p>'}<figcaption>Figma · ${esc(f)}</figcaption></figure><figure><img width="420" height="800" alt="Cadran" src="${await photo(nom, { largeur: 420, hauteur: 800, theme })}"><figcaption>Vrai panneau · ${esc(NOMS[nom])} · ${theme}</figcaption></figure></div>`);
  }
  const instr = []; for (const nom of ['cours', 'fin', 'constellation']) instr.push(`<figure><img loading="lazy" width="600" height="760" alt="" src="${await photo(nom, { variante: 'signal' })}"><figcaption>Instrument (par défaut) · ${esc(NOMS[nom])}</figcaption></figure>`);
  await nav.close();
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cadran, interface alternative</title>
<style>:root{--f:#0F1112;--s:#16181A;--t:#E8EAEB;--t2:#A9AEB3;--l:#2A2D30;--b:#5CB3FF}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--f:#E6E8E7;--s:#F2F4F3;--t:#121415;--t2:#454A4F;--l:#C9CDCB;--b:#0A5BB0}}
:root[data-theme="light"]{--f:#E6E8E7;--s:#F2F4F3;--t:#121415;--t2:#454A4F;--l:#C9CDCB;--b:#0A5BB0}
body{margin:0;background:var(--f);color:var(--t);font:15px/1.5 system-ui,sans-serif}main{max-width:1320px;margin:0 auto;padding:24px 16px 64px}
h1{font:600 26px/1.2 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}h2{font:600 13px/1.3 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--t2);border-top:1px solid var(--l);padding-top:20px;margin-top:40px}
p{max-width:72ch;color:var(--t2)}.grille{display:flex;flex-wrap:wrap;gap:24px}figure{margin:0;max-width:100%}figure img{display:block;max-width:100%;height:auto;outline:1px solid var(--l)}figcaption{font:12px/1.4 ui-monospace,monospace;color:var(--t2);margin-top:6px}
.paire{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:28px}nav a{color:var(--b);margin-right:16px}</style></head><body><main>
<h1>Cadran</h1><p>Interface alternative du panneau d’Ariane (CH-135, D-368), tirée du prototype Figma « Direction A — Cadran ». On la choisit dans les Réglages : « Interface : Instrument / Cadran ». Mêmes boutons, mêmes ordres, mêmes gardes que l’instrument : seule la présentation change. Chaque image est une photo du vrai panneau (panel.html, données fabriquées), à l’échelle 1.</p>
<nav><a href="#comp">Comparaison Figma</a><a href="#sombre">Toutes les scènes · sombre</a><a href="#clair">Toutes les scènes · clair</a><a href="#instr">L’instrument</a></nav>
<h2 id="comp">À taille égale : Figma (à gauche) et le vrai panneau (à droite), 420 × 800</h2><p>Les chiffres diffèrent : la maquette montre un lot de 40 cuts inventé ; le panneau montre les données fabriquées des essais (le lot ne dit son total que s’il le connaît).</p>${comp.join('')}
<h2 id="sombre">Toutes les scènes, thème sombre, 600 × 760</h2><div class="grille">${cartes.sombre.join('')}</div>
<h2 id="clair">Toutes les scènes, thème clair, 600 × 760</h2><div class="grille">${cartes.clair.join('')}</div>
<h2 id="instr">Pour mémoire : l’instrument, interface par défaut</h2><div class="grille">${instr.join('')}</div>
</main></body></html>`;
  fs.writeFileSync(sortie, html); console.log('page :', sortie, Math.round(html.length / 1024), 'Ko');
})().catch(e => { console.error(e); process.exit(1); });
