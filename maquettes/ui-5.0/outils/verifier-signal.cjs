#!/usr/bin/env node
/* CH-022 : mesures de qualité d'une maquette Signal (adapté de maquettes/ui-v2/sources/verifier.cjs).
 *   CHROMIUM=/opt/pw-browsers/chromium node maquettes/ui-5.0/outils/verifier-signal.cjs Q-signal-2 Q-signal-3 [--captures dossier]
 * Pour chaque page × scène du banc (+ tiroir ouvert en Revue V1 et V2) × thème (sombre, clair)
 * × largeur (360, 420, 480, 600 ; « ?largeur= », compact sous 480) :
 *   - erreurs et avertissements de console, exceptions de page ;
 *   - débordement horizontal : un élément visible qui sort de la fenêtre, ou une page plus large que la vue ;
 *   - contraste WCAG de chaque texte visible sur son fond calculé (seuil 4,5:1) ;
 *   - contraste des marques non textuelles déclarées (data-forme) sur leur fond (seuil 3:1) ;
 *   - mouvement réduit (préférence système émulée) : aucune animation ni transition qui dure.
 * Sortie : un résumé par page et la liste des écarts ; code 1 s'il y en a. Captures hors dépôt. */
'use strict';
const path = require('node:path');
const { chromium } = require('playwright');

const ICI = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const iCap = args.indexOf('--captures');
const CAPTURES = iCap >= 0 ? args[iCap + 1] : null;
const NOMS = args.filter((a, i) => !a.startsWith('--') && i !== iCap + 1 || (iCap < 0 && !a.startsWith('--')));
const LARGEURS = [360, 420, 480, 600];
const THEMES = ['sombre', 'clair'];

function mesurer() {
  const fen = document.getElementById('fen');
  const parse = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const melange = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const fond = (el) => { const pile = []; for (let e = el; e; e = e.parentElement) { if (e instanceof SVGElement) continue; const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } } let r = { r: 255, g: 255, b: 255, a: 1 }; for (let i = pile.length - 1; i >= 0; i--) r = melange(pile[i], r); return r; };
  const F = fen.getBoundingClientRect();
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; if (r.bottom <= F.top || r.top >= F.bottom) return false; return el.checkVisibility({ opacityProperty: true, visibilityProperty: true }); };
  const ecarts = []; let min = 99, nb = 0;
  for (const el of fen.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    /* débordement : seulement hors d'un conteneur qui défile ou coupe exprès (ellipse) */
    if (r.right > F.right + 1 || r.left < F.left - 1) {
      let coupe = false; for (let e = el.parentElement; e && e !== fen; e = e.parentElement) { const s = getComputedStyle(e); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { const b = e.getBoundingClientRect(); if (b.right <= F.right + 1 && b.left >= F.left - 1) { coupe = true; break; } } }
      if (!coupe) ecarts.push(`déborde de ${Math.round(Math.max(r.right - F.right, F.left - r.left))} px : ${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).split(' ')[0]} « ${(el.textContent || '').trim().slice(0, 30)} »`);
    }
    if (el instanceof SVGElement) continue;
    const texte = [...el.childNodes].filter((t) => t.nodeType === 3 && t.textContent.trim()).map((t) => t.textContent.trim()).join(' ');
    if (!texte || el.closest('[aria-hidden="true"]')) continue;
    let c = parse(getComputedStyle(el).color); if (!c) continue;
    const b = fond(el); if (c.a < 1) c = melange(c, b);
    const k = ratio(c, b); nb++; if (k < min) min = k;
    if (k < 4.5) ecarts.push(`texte ${k.toFixed(2)}:1 « ${texte.slice(0, 40)} »`);
  }
  for (const el of fen.querySelectorAll('[data-forme]')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    let c = parse(el instanceof SVGElement ? (s.fill !== 'none' && s.fill !== 'rgba(0, 0, 0, 0)' ? s.fill : s.stroke) : (s.backgroundColor !== 'rgba(0, 0, 0, 0)' ? s.backgroundColor : s.borderTopColor));
    if (!c) continue;
    const b = fond(el instanceof SVGElement ? el.closest('svg').parentElement : el.parentElement); if (c.a < 1) c = melange(c, b);
    const k = ratio(c, b); if (k < 3) ecarts.push(`forme ${k.toFixed(2)}:1 ${el.getAttribute('data-forme')}`);
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) ecarts.push('page plus large que la vue');
  const anims = document.getAnimations().filter((a) => { const t = a.effect && a.effect.getComputedTiming(); return a.playState === 'running' && t && (t.duration > 0 && t.duration !== Infinity ? t.duration : 0) > 0; });
  return { min, nb, ecarts, anims: anims.map((a) => a.animationName || a.transitionProperty || 'anim') };
}

(async () => {
  const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  let total = 0;
  for (const nom of NOMS) {
    const fichier = path.join(ICI, nom + '.html');
    const erreurs = []; let min = 99, nb = 0, vues = 0; const ecarts = [];
    for (const w of LARGEURS) {
      const ctx = await nav.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erreurs.push(m.text()); });
      page.on('pageerror', (e) => erreurs.push('exception : ' + e.message));
      await page.goto('file://' + fichier + '?nu=1&fige=1');
      const scenes = await page.$$eval('#sc-scene option', (o) => o.map((x) => x.value));
      const cibles = scenes.map((s) => [s, '']).concat([['fin', '&tiroir=1'], ['fin', '&tiroir=1&revue=v2'], ['cours', '&tiroir=1'], ['echo', '&tiroir=1'], ['file-fin', '&tiroir=1']].filter(([s]) => scenes.includes(s)));
      for (const t of THEMES) for (const [s, extra] of cibles) {
        const taille = w < 480 ? 'compact' : 'normal';
        await page.goto('file://' + fichier + `?nu=1&fige=1&theme=${t}&taille=${taille}&largeur=${w}&scene=${s}${extra}`);
        await page.waitForTimeout(40);
        const r = await page.evaluate(mesurer); vues++;
        nb += r.nb; min = Math.min(min, r.min);
        r.ecarts.forEach((e) => ecarts.push(`${t} ${w} ${s}${extra} : ${e}`));
        if (r.anims.length) ecarts.push(`${t} ${w} ${s}${extra} : mouvement réduit non respecté (${[...new Set(r.anims)].join(', ')})`);
        if (CAPTURES && (w === 600 || w === 360)) await page.locator('#fen').screenshot({ path: path.join(CAPTURES, `${nom}-${t}-${w}-${s}${extra.replace(/[&=]/g, '-')}.png`) });
      }
      await ctx.close();
    }
    const uniques = [...new Set(ecarts)];
    console.log(`${nom} : ${vues} vues, ${nb} textes mesurés, contraste minimal ${min.toFixed(2)}:1, ${uniques.length} écarts, ${new Set(erreurs).size} erreurs de console`);
    const genre = (e) => /: texte/.test(e) ? 'contraste du texte' : /: forme/.test(e) ? 'contraste des marques' : /déborde|page plus large/.test(e) ? 'débordement' : /mouvement/.test(e) ? 'mouvement réduit' : 'autre';
    const par = {}; uniques.forEach((e) => { par[genre(e)] = (par[genre(e)] || 0) + 1; });
    if (uniques.length) console.log('  par genre : ' + Object.entries(par).map(([k, v]) => `${k} ${v}`).join(', '));
    uniques.slice(0, 40).forEach((e) => console.log('  ' + e));
    if (uniques.length > 40) console.log(`  … et ${uniques.length - 40} autres`);
    [...new Set(erreurs)].slice(0, 10).forEach((e) => console.log('  console : ' + e));
    total += uniques.length + new Set(erreurs).size;
  }
  await nav.close();
  process.exit(total ? 1 : 0);
})();
