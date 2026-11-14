#!/usr/bin/env node
/* CH-014 : joue chaque maquette dans Chromium et mesure.
 *   node maquettes/ui-v2/sources/verifier.cjs [dossier-captures]
 * Pour chaque maquette × scène × thème (clair, sombre) × largeur (360, 420, 600) :
 *   - erreurs de console et exceptions de page ;
 *   - débordement horizontal du panneau ;
 *   - contraste WCAG de chaque texte visible du panneau sur son fond calculé (seuil 4,5:1) ;
 *   - contraste des marques non textuelles déclarées (data-forme) : seuil 3:1.
 * Sortie : un résumé par maquette et la liste des écarts ; code 1 s'il y en a.
 * Les captures (facultatives) vont dans le dossier donné, jamais dans le dépôt. */
'use strict';
const path = require('node:path');
const { chromium } = require('playwright');

const ICI = path.resolve(__dirname, '..');
const fs = require('node:fs');
const MAQUETTES = process.env.MAQUETTES ? process.env.MAQUETTES.split(',')
  : fs.readdirSync(path.join(__dirname)).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort();
const SCENES = ['pret', 'pret-absent', 'pret-onglet', 'pret-file', 'encours', 'encours-inconnu', 'pause', 'arrete', 'reprise', 'fin', 'reste', 'examen',
  'file-encours', 'file-relecture', 'file-alerte-page', 'file-alerte-onglet', 'file-alerte-muet', 'file-alerte-refus', 'file-fin', 'echo'];
const THEMES = ['light', 'dark'];
const LARGEURS = [360, 420, 600];
const CAPTURES = process.argv[2] || null;

function mesurer() {
  /* exécuté dans la page */
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const melange = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  function fond(el) {
    const pile = [];
    for (let e = el; e; e = e.parentElement) {
      if (e.namespaceURI !== 'http' + '://www.w3.org/1999/xhtml' && e.tagName !== 'svg') continue;
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; }
    }
    let r = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = pile.length - 1; i >= 0; i--) r = melange(pile[i], r);
    return r;
  }
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const ecarts = [];
  let min = 99, nb = 0;
  const zone = document.getElementById('panneau');
  const tous = [...zone.querySelectorAll('*'), ...document.querySelectorAll('.notes *, .regie *')];
  for (const el of tous) {
    const texte = [...el.childNodes].filter((t) => t.nodeType === 3 && t.textContent.trim()).map((t) => t.textContent.trim()).join(' ');
    if (!texte || !visible(el)) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    const s = getComputedStyle(el);
    const enSvg = el instanceof SVGElement;
    let c = parse(enSvg ? s.fill : s.color); if (!c) continue;
    const b = fond(el);
    if (c.a < 1) c = melange(c, b);
    const r = ratio(c, b); nb++; if (r < min) min = r;
    if (r < 4.5) ecarts.push(`texte ${r.toFixed(2)}:1 « ${texte.slice(0, 40)} »`);
  }
  for (const el of zone.querySelectorAll('[data-forme]')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    let c = parse(el instanceof SVGElement ? (s.fill !== 'none' ? s.fill : s.stroke) : (s.backgroundColor !== 'rgba(0, 0, 0, 0)' ? s.backgroundColor : s.borderTopColor));
    if (!c) continue;
    const b = fond(el); if (c.a < 1) c = melange(c, b);
    const r = ratio(c, b);
    if (r < 3) ecarts.push(`forme ${r.toFixed(2)}:1 ${el.getAttribute('data-forme')}`);
  }
  const deborde = zone.scrollWidth > zone.clientWidth + 1 ? `débordement horizontal ${zone.scrollWidth}>${zone.clientWidth}` : null;
  if (deborde) ecarts.push(deborde);
  const pageDeborde = document.documentElement.scrollWidth > innerWidth + 1;
  if (pageDeborde) ecarts.push('page plus large que la fenêtre');
  return { min, nb, ecarts };
}

(async () => {
  const nav = await chromium.launch();
  let total = 0;
  for (const nom of MAQUETTES) {
    const fichier = path.join(ICI, nom + '.html');
    const ctx = await nav.newContext({ viewport: { width: 1100, height: 900 } });
    const page = await ctx.newPage();
    const erreurs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erreurs.push(m.text()); });
    page.on('pageerror', (e) => erreurs.push('exception : ' + e.message));
    let min = 99, nb = 0; const ecarts = [];
    try { await page.goto('file://' + fichier + '?fige=1'); } catch (e) { console.log(nom, 'introuvable'); await ctx.close(); continue; }
    for (const t of THEMES) for (const w of LARGEURS) {
      await page.emulateMedia({ colorScheme: t, reducedMotion: 'reduce' });
      for (const s of SCENES) {
        await page.evaluate((r) => window.postMessage({ ui2: r }, '*'), { theme: t, largeur: String(w), scene: s });
        await page.waitForTimeout(60);
        const r = await page.evaluate(mesurer);
        nb += r.nb; min = Math.min(min, r.min);
        r.ecarts.forEach((e) => ecarts.push(`${t} ${w} ${s} : ${e}`));
        if (CAPTURES && (w === 420 || (w === 360 && ['encours', 'reste'].includes(s)))) {
          await page.locator('#cadre').screenshot({ path: path.join(CAPTURES, `${nom}-${t}-${w}-${s}.png`) });
        }
      }
    }
    const uniques = [...new Set(ecarts)];
    console.log(`${nom} : ${nb} textes mesurés, contraste minimal ${min.toFixed(2)}:1, ${uniques.length} écarts, ${erreurs.length} erreurs de console`);
    uniques.slice(0, 25).forEach((e) => console.log('  ' + e));
    [...new Set(erreurs)].slice(0, 10).forEach((e) => console.log('  console : ' + e));
    total += uniques.length + erreurs.length;
    await ctx.close();
  }
  await nav.close();
  process.exit(total ? 1 : 0);
})();
