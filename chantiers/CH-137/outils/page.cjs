'use strict';
/* CH-137 : LA PAGE DE DÉMONSTRATION de Mix : le vrai panneau (panel.html, données fabriquées) photographié à l'échelle 1, 600 × 760, à côté des 13 écrans
 * de la planche « Q4 sombre (mix strict) » à taille égale ; puis toutes les scènes (ou seulement les écrans neufs, `NEUFS=1`), sombre et clair. Les photos
 * sont mises DANS la page (data:) : la page n'est jamais versée au dépôt (CLAUDE.md : aucune capture d'écran dans le dépôt). Usage :
 * CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-137/outils/page.cjs SORTIE.html DOSSIER_PLANCHE */
const path = require('node:path'), fs = require('node:fs');
const R = path.resolve(__dirname, '../../..'), navigateur = require(R + '/tests/esv-maquette/navigateur.cjs');
const { SCENES, ouvrirScene } = require('./scenes.cjs');
const NOMS = { repos: 'Orbite · prêt', cours: 'Orbite · lot en cours (total inconnu)', 'cours-total': 'Orbite · lot en cours (total ciblé connu)', pause: 'Orbite · en pause', arrete: 'Orbite · arrêté',
  fin: 'Orbite · terminé', toi: 'Orbite · à toi', interrompu: 'Orbite · interrompu', muet: 'Orbite · ESV ne répond plus', erreur: 'Orbite · erreur du lot', 'sans-onglet': 'Orbite · hors ligne',
  'file-arret-orbite': 'Orbite · Constellation arrêtée', 'file-fin-orbite': 'Orbite · Constellation terminée',
  relecture: 'Relecture en cours', 'relecture-pause': 'Relecture en pause', 'rel-bornes': 'Relecture en pause · reprendre entre deux cuts (CH-133)', 'relecture-interrompue': 'Relecture interrompue',
  rattrapage: 'Rattrapage (deuxième passe)', constellation: 'Constellation · partie en cours', 'constellation-passage': 'Constellation · passage', 'constellation-arret': 'Constellation · arrêtée',
  'constellation-acquitter': 'Constellation · arrêtée, « J’ai contrôlé le cut N »', 'constellation-fin': 'Constellation · terminée', 'constellation-stats': 'Constellation · bilan et départs',
  'constellation-repos': 'Constellation · prête', 'boite-file': 'Nouvelle Constellation', aurore: 'Aurore · cut ouvert', 'aurore-vide': 'Aurore · rien à revoir', echo: 'Écho · en observation',
  'echo-vide': 'Écho · aucune séance', details: 'Orbite · détails ouverts', 'vue-fil': 'Orbite · vue fil (CH-134)', tiroir: 'Ce qui reste', menu: 'Menu', palette: 'Commandes (Ctrl K)',
  reglages: 'Réglages (Interface : Mix)', esv: 'Onglets ESV', tech: 'Détails techniques' };
const NEUFS = ['constellation', 'constellation-passage', 'constellation-arret', 'constellation-acquitter', 'constellation-fin', 'constellation-stats', 'constellation-repos', 'boite-file', 'aurore', 'aurore-vide',
  'reglages', 'menu', 'palette', 'esv', 'vue-fil', 'details', 'relecture', 'rel-bornes', 'relecture-interrompue', 'rattrapage', 'echo-vide', 'tech', 'tiroir', 'arrete', 'erreur'];
const PLANCHE = [['02-pret.png', 'repos'], ['03-en-cours.png', 'cours-total'], ['04-en-pause.png', 'pause'], ['05-a-toi.png', 'toi'], ['06-interrompu.png', 'interrompu'], ['07-esv-ne-repond-plus.png', 'muet'],
  ['08-termine.png', 'fin'], ['09-relecture-en-pause.png', 'relecture-pause'], ['10-deuxieme-passe.png', 'rattrapage'], ['11-echo-observation.png', 'echo'], ['12-hors-ligne.png', 'sans-onglet'],
  ['13-file-arretee.png', 'file-arret-orbite'], ['14-file-terminee.png', 'file-fin-orbite']];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
(async () => {
  const [sortie, planche] = process.argv.slice(2), neufs = process.env.NEUFS === '1';
  const { chromium } = require(navigateur.modulePlaywright()), nav = await chromium.launch({ executablePath: navigateur.executable() });
  const photo = async (nom, o) => { const { ctx, page, erreurs } = await ouvrirScene(nav, SCENES[nom], o); const b = await page.screenshot(); await ctx.close(); if (erreurs.length) console.log(nom, erreurs); return 'data:image/png;base64,' + b.toString('base64'); };
  const fig = (src, alt, legende) => `<figure><img loading="lazy" width="600" height="760" alt="${esc(alt)}" src="${src}"><figcaption>${esc(legende)}</figcaption></figure>`;
  const comp = [];
  if (!neufs) for (const [f, nom] of PLANCHE) {
    const m = planche && fs.existsSync(path.join(planche, f)) ? 'data:image/png;base64,' + fs.readFileSync(path.join(planche, f)).toString('base64') : null;
    comp.push(`<div class="paire">${m ? fig(m, 'Planche ' + f, 'Planche · ' + f) : '<p>absente</p>'}${fig(await photo(nom, {}), NOMS[nom], 'Vrai panneau · ' + NOMS[nom])}</div>`);
  }
  const liste = neufs ? NEUFS : Object.keys(SCENES), cartes = { sombre: [], clair: [] };
  for (const theme of ['sombre', 'clair']) for (const nom of liste) cartes[theme].push(fig(await photo(nom, { theme }), NOMS[nom] || nom, NOMS[nom] || nom));
  await nav.close();
  const html = `<title>${neufs ? "Écrans neufs Mix" : "Ariane Mix"}</title><meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
:root{--fond:#e8e9e7;--surface:#f1f2f0;--encre:#141516;--encre2:#4e5257;--filet:#0000001f;--lien:#141516;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;--sans:"IBM Plex Sans",system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--fond:#121314;--surface:#1a1b1d;--encre:#ecedee;--encre2:#a6a9ad;--filet:#ffffff1f;--lien:#ecedee;color-scheme:dark}}
:root[data-theme="dark"]{--fond:#121314;--surface:#1a1b1d;--encre:#ecedee;--encre2:#a6a9ad;--filet:#ffffff1f;--lien:#ecedee;color-scheme:dark}
body{margin:0;background:var(--fond);color:var(--encre);font:15px/1.5 var(--sans)}
main{max-width:1280px;margin:0 auto;padding-block:32px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font:500 28px/32px var(--sans);letter-spacing:-.01em;margin:0 0 8px;text-wrap:balance}
h2{font:500 22px/28px var(--sans);border-top:1px solid var(--filet);padding-top:24px;margin-top:48px;text-wrap:balance}
p{max-width:70ch;color:var(--encre2)}
nav{display:flex;flex-wrap:wrap;gap:8px 20px}nav a{color:var(--lien);text-underline-offset:3px}
.grille{display:flex;flex-wrap:wrap;gap:24px}figure{margin:0;max-width:100%;min-width:0}
figure img{display:block;max-width:100%;height:auto;outline:1px solid var(--filet);border-radius:4px}
figcaption{font:13px/18px var(--sans);color:var(--encre2);margin-top:6px}
.paire{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:28px;padding-bottom:28px;border-bottom:1px solid var(--filet)}
</style><main>
<h1>Mix${neufs ? ' · écrans neufs' : ''}</h1><p>Interface alternative du panneau d’Ariane (CH-137, D-371, D-372), d’après la planche Figma « Q4 sombre (mix strict) ». On la choisit dans les Réglages : « Interface : Glacier / Mix ». Mêmes boutons, mêmes ordres, mêmes gardes que Glacier : seule la présentation change. Chaque image est une photo du vrai panneau (panel.html, données fabriquées des essais), à l’échelle 1, 600 × 760. Un chiffre n’est affiché que si le panneau le connaît : sans total ciblé, pas de réglette.</p>
${neufs ? '<p>Première passe des écrans que la planche ne dessine pas (D-372), montrée avant de les finir.</p>' : ''}
<nav>${neufs ? '' : '<a href="#comp">Planche et vrai panneau</a>'}<a href="#sombre">Scènes · sombre</a><a href="#clair">Scènes · clair</a></nav>
${neufs ? '' : `<h2 id="comp">À taille égale, 600 × 760 : la planche à gauche, le vrai panneau à droite</h2><p>Les chiffres diffèrent : la planche montre un lot inventé ; le panneau montre les données fabriquées des essais.</p>${comp.join('')}`}
<h2 id="sombre">${neufs ? 'Écrans neufs' : 'Toutes les scènes'}, thème sombre</h2><div class="grille">${cartes.sombre.join('')}</div>
<h2 id="clair">${neufs ? 'Écrans neufs' : 'Toutes les scènes'}, thème clair</h2><div class="grille">${cartes.clair.join('')}</div>
</main>`;
  fs.writeFileSync(sortie, html); console.log('page :', sortie, Math.round(html.length / 1024), 'Ko');
})().catch(e => { console.error(e); process.exit(1); });
