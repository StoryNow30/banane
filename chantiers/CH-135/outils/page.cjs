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
  const html = `<title>Cadran, interface alternative</title><meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
/* une planche d'instrument : bandeau de tête, puis des rangées de photos du vrai panneau, filets fins */
:root{--fond:#E6E8E7;--surface:#F2F4F3;--encre:#121415;--encre2:#454A4F;--filet:#C9CDCB;--coupe:#0A5BB0;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;--sans:"IBM Plex Sans",system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--fond:#0F1112;--surface:#16181A;--encre:#E8EAEB;--encre2:#A9AEB3;--filet:#2A2D30;--coupe:#5CB3FF;color-scheme:dark}}
:root[data-theme="dark"]{--fond:#0F1112;--surface:#16181A;--encre:#E8EAEB;--encre2:#A9AEB3;--filet:#2A2D30;--coupe:#5CB3FF;color-scheme:dark}
body{background:var(--fond);color:var(--encre);font:15px/1.5 var(--sans)}
main{max-width:1320px;margin:0 auto;padding-block:28px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font:500 26px/1.2 var(--mono);letter-spacing:.14em;text-transform:uppercase;margin:0 0 10px;text-wrap:balance}
h2{font:500 12px/1.3 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--encre2);border-top:1px solid var(--filet);padding-top:20px;margin-top:44px;text-wrap:balance}
p{max-width:68ch;color:var(--encre2)}
nav{display:flex;flex-wrap:wrap;gap:8px 18px;font:13px var(--mono)}nav a{color:var(--coupe)}
.grille{display:flex;flex-wrap:wrap;gap:24px}figure{margin:0;max-width:100%;min-width:0}
figure img{display:block;max-width:100%;height:auto;outline:1px solid var(--filet)}
figcaption{font:12px/1.4 var(--mono);color:var(--encre2);margin-top:6px}
.paire{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:28px;padding-bottom:28px;border-bottom:1px solid var(--filet)}
</style><main>
<h1>Cadran</h1><p>Interface alternative du panneau d’Ariane (CH-135, D-368), tirée du prototype Figma « Direction A — Cadran ». On la choisit dans les Réglages : « Interface : Instrument / Cadran ». Mêmes boutons, mêmes ordres, mêmes gardes que l’instrument : seule la présentation change. Chaque image est une photo du vrai panneau (panel.html, données fabriquées des essais), à l’échelle 1.</p>
<nav><a href="#comp">Comparaison Figma</a><a href="#sombre">Scènes · sombre</a><a href="#clair">Scènes · clair</a><a href="#instr">L’instrument</a></nav>
<h2 id="comp">À taille égale, 420 × 800 : Figma à gauche, vrai panneau à droite</h2><p>Les chiffres diffèrent : la maquette montre un lot inventé de 40 cuts ; le panneau montre les données fabriquées des essais, et la voie ne dit le total que s’il est connu.</p>${comp.join('')}
<h2 id="sombre">Toutes les scènes, thème sombre, 600 × 760</h2><div class="grille">${cartes.sombre.join('')}</div>
<h2 id="clair">Toutes les scènes, thème clair, 600 × 760</h2><div class="grille">${cartes.clair.join('')}</div>
<h2 id="instr">Pour mémoire : l’instrument, interface par défaut</h2><div class="grille">${instr.join('')}</div>
</main>`;
  fs.writeFileSync(sortie, html); console.log('page :', sortie, Math.round(html.length / 1024), 'Ko');
})().catch(e => { console.error(e); process.exit(1); });
