'use strict';
/* CH-135 : photos des scènes (vrai panneau). Usage : CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-135/outils/photos.cjs DOSSIER [largeur] [thème] [variante] [scènes,...] */
const path = require('node:path'), fs = require('node:fs');
const R = path.resolve(__dirname, '../../..'), navigateur = require(R + '/tests/esv-maquette/navigateur.cjs');
const { SCENES, ouvrirScene } = require('./scenes.cjs');
(async () => {
  const [dos, l = '600', theme = 'sombre', variante = 'cadran', liste = ''] = process.argv.slice(2); fs.mkdirSync(dos, { recursive: true });
  const { chromium } = require(navigateur.modulePlaywright()), nav = await chromium.launch({ executablePath: navigateur.executable() });
  for (const [nom, sc] of Object.entries(SCENES)) { if (liste && !liste.split(',').includes(nom)) continue;
    const { ctx, page, erreurs } = await ouvrirScene(nav, sc, { largeur: Number(l), theme, variante });
    await page.screenshot({ path: path.join(dos, `${nom}.png`) }); if (erreurs.length) console.log(nom, erreurs); await ctx.close(); }
  await nav.close();
})().catch(e => { console.error(e); process.exit(1); });
