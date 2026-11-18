'use strict';
/* CH-137 : AUDIT DU VRAI PANNEAU EN MIX, toutes les scènes (scenes.cjs) × largeurs (320 à 720) × deux thèmes, hauteur 760. Mesure de CH-104 (débordement,
 * élément qui sort, troncature, contraste 4,5:1), rien sous 11 px, et (CH-137) aucun bouton recouvert. Usage : CHROMIUM=/opt/pw-browsers/chromium node chantiers/CH-135/outils/audit.cjs [SORTIE.json]
 * Variables : LARGEURS=320,400 ; THEMES=sombre ; SCENES_AUDIT=cours,fin ; VARIANTE=signal (pour comparer). */
const path = require('node:path'), fs = require('node:fs');
const R = path.resolve(__dirname, '../../..'), navigateur = require(R + '/tests/esv-maquette/navigateur.cjs');
const { SCENES, ouvrirScene, MESURE, PETIT, RECOUVRE } = require('./scenes.cjs');
const LARGEURS = process.env.LARGEURS ? process.env.LARGEURS.split(',').map(Number) : [320, 360, 400, 440, 480, 520, 560, 600, 640, 680, 720];
const THEMES = process.env.THEMES ? process.env.THEMES.split(',') : ['sombre', 'clair'], LISTE = process.env.SCENES_AUDIT ? process.env.SCENES_AUDIT.split(',') : Object.keys(SCENES);
(async () => {
  const { chromium } = require(navigateur.modulePlaywright()), nav = await chromium.launch({ executablePath: navigateur.executable() });
  const res = {}; let n = 0, defauts = 0;
  for (const theme of THEMES) for (const w of LARGEURS) for (const nom of LISTE) {
    const { ctx, page, erreurs } = await ouvrirScene(nav, SCENES[nom], { largeur: w, theme, variante: process.env.VARIANTE || 'mix' });
    const m = [...erreurs.map(x => 'ERREUR ' + x), ...await page.evaluate(MESURE), ...await page.evaluate(PETIT), ...await page.evaluate(RECOUVRE)];
    res[`${theme}-${w}-${nom}`] = m; n++; defauts += m.length; await ctx.close(); if (process.env.SUIVI) console.log(n, `${theme}-${w}-${nom}`, m.length ? m.join(' | ') : 'ok');
  }
  await nav.close();
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
  for (const [k, v] of Object.entries(res)) if (v.length) console.log(k, '|', v.join(' | '));
  console.log(`${n} vues, ${defauts} défaut(s)`);
})().catch(e => { console.error(e); process.exit(1); });
