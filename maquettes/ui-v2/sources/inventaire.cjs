#!/usr/bin/env node
/* CH-020 : inventaire de ce qu'une maquette affiche, scène par scène (mesure, pas de jugement).
 *   CHROMIUM=/opt/pw-browsers/chromium node maquettes/ui-v2/sources/inventaire.cjs faisceau-4 faisceau-4a …
 * Thème clair, 420 px, mouvement réduit, horloge figée. Pour chaque scène, dans le panneau :
 *   éléments  = éléments visibles qui portent un texte à eux, ou un contrôle (bouton, champ,
 *               interrupteur : compté une fois avec son texte), ou une marque déclarée (data-forme) ;
 *   surfaces  = éléments visibles avec un fond non transparent ou une bordure visible ;
 *   tailles   = tailles de texte distinctes ; graisses = graisses distinctes ;
 *   couleurs  = couleurs de texte distinctes.
 * Sortie : un tableau Markdown par maquette (scènes en lignes). */
'use strict';
const path = require('node:path');
const { chromium } = require('playwright');

const ICI = path.resolve(__dirname, '..');
const NOMS = process.argv.slice(2);
const SCENES = [['pret', 'Prêt'], ['encours', 'En cours'], ['pause', 'Pause'], ['arrete', 'Arrêt'], ['file-alerte-page', 'Incident'], ['fin', 'Fin'], ['file-encours', 'File'], ['echo', 'Écho'], ['reste', 'Ce qui reste'], ['examen', 'Examen']];

function compter() {
  const z = document.getElementById('panneau');
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; return el.checkVisibility({ opacityProperty: true, visibilityProperty: true }); };
  const controle = (el) => /^(BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName) || el.getAttribute('role') === 'switch';
  let elements = 0, surfaces = 0;
  const tailles = new Set(), graisses = new Set(), couleurs = new Set();
  const vus = new Set();
  for (const el of z.querySelectorAll('*')) {
    if (!vis(el) || el.closest('[aria-hidden="true"]') && !el.hasAttribute('data-forme')) continue;
    const s = getComputedStyle(el);
    const fond = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent';
    const bord = ['Top', 'Right', 'Bottom', 'Left'].some((c) => parseFloat(s['border' + c + 'Width']) > 0 && s['border' + c + 'Style'] !== 'none' && !/rgba\([^)]*, 0\)/.test(s['border' + c + 'Color']));
    if ((fond || bord) && !(el instanceof SVGElement)) surfaces++;
    const dansControle = [...vus].some((c) => c !== el && c.contains(el));
    const texte = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (controle(el) || el.hasAttribute('data-forme')) { if (!dansControle) { elements++; vus.add(el); } }
    else if (texte && !dansControle) elements++;
    if (texte) { tailles.add(s.fontSize); graisses.add(s.fontWeight); couleurs.add(s.color); }
  }
  return { elements, surfaces, tailles: tailles.size, graisses: graisses.size, couleurs: couleurs.size };
}

(async () => {
  const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const nom of NOMS) {
    const ctx = await nav.newContext({ viewport: { width: 1100, height: 1400 }, colorScheme: 'light', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('file://' + path.join(ICI, nom + '.html') + '?fige=1&w=420');
    console.log(`\n${nom}\n\n| Scène | Éléments | Surfaces | Tailles | Graisses | Couleurs |\n|---|---|---|---|---|---|`);
    const tot = { elements: 0, surfaces: 0 };
    for (const [s, lib] of SCENES) {
      await page.evaluate((x) => window.postMessage({ ui2: { scene: x, theme: 'light', largeur: '420' } }, '*'), s);
      await page.waitForTimeout(120);
      await page.evaluate(() => { const p = document.getElementById('panneau'); p.style.height = 'auto'; });
      const r = await page.evaluate(compter);
      tot.elements += r.elements; tot.surfaces += r.surfaces;
      console.log(`| ${lib} | ${r.elements} | ${r.surfaces} | ${r.tailles} | ${r.graisses} | ${r.couleurs} |`);
    }
    console.log(`| **Total** | **${tot.elements}** | **${tot.surfaces}** | | | |`);
    await ctx.close();
  }
  await nav.close();
})();
