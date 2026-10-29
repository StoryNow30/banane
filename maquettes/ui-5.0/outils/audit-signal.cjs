#!/usr/bin/env node
/* CH-022 : audit de cohérence d'une maquette Signal, scène par scène (mesure, pas de jugement).
 *   CHROMIUM=/opt/pw-browsers/chromium node maquettes/ui-5.0/outils/audit-signal.cjs Q-signal S-file-de-parties Q-signal-2 Q-signal-3
 * Pour chaque page : toutes les scènes de son banc d'essai (liste « Scène »), plus le tiroir ouvert
 * (fin, Revue V2), en 600 × 760, thème sombre puis clair, mouvement réduit, simulation figée.
 * Dans la fenêtre (#fen), on relève sur les éléments visibles :
 *   éléments   = éléments qui portent un texte à eux, ou un contrôle (compté une fois avec son texte) ;
 *   surfaces   = éléments avec un fond non transparent ou une bordure visible ;
 *   tailles, graisses, couleurs de texte (distinctes) ; couleurs = toutes (texte, fond, bordure, trait et
 *   remplissage des SVG, ombres exclues) ; rayons ; espacements (marges, retraits, gouttières non nuls) ;
 *   bordures (largeur et style) ; ombres ; symboles = SVG visibles ; formes = dessins SVG distincts ;
 *   contraste = plus petit rapport WCAG d'un texte sur son fond, et nombre de textes sous 4,5:1.
 * Sortie : un tableau Markdown par page (scènes en lignes) et l'union des valeurs sur toute la page. */
'use strict';
const path = require('node:path');
const { chromium } = require('playwright');

const ICI = path.resolve(__dirname, '..');
const NOMS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DETAIL = process.argv.includes('--detail');

function relever() {
  const fen = document.getElementById('fen');
  const parse = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const melange = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const fond = (el) => { const pile = []; for (let e = el; e; e = e.parentElement) { if (e instanceof SVGElement) continue; const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } } let r = { r: 255, g: 255, b: 255, a: 1 }; for (let i = pile.length - 1; i >= 0; i--) r = melange(pile[i], r); return r; };
  const cle = (c) => { const p = parse(c); if (!p || p.a === 0) return null; return `${p.r},${p.g},${p.b},${Math.round(p.a * 100) / 100}`; };
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const f = fen.getBoundingClientRect(); if (r.bottom <= f.top || r.top >= f.bottom || r.right <= f.left || r.left >= f.right) return false; return el.checkVisibility({ opacityProperty: true, visibilityProperty: true }); };
  const controle = (el) => /^(BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName);
  const E = { elements: 0, surfaces: 0, bordures: 0, symboles: 0, sous45: 0, min: 99 };
  const S = { tailles: new Set(), graisses: new Set(), coulTexte: new Set(), couleurs: new Set(), rayons: new Set(), espaces: new Set(), traits: new Set(), ombres: new Set(), formes: new Set(), polices: new Set() };
  const vus = [];
  for (const el of fen.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const s = getComputedStyle(el);
    if (el instanceof SVGElement) {
      if (el.tagName === 'svg') { E.symboles++; S.formes.add(el.innerHTML.replace(/\s(class|style|stroke-dashoffset)="[^"]*"/g, '').replace(/\s+/g, ' ')); }
      if (el.tagName !== 'svg') { for (const k of ['stroke', 'fill']) { const c = cle(s[k]); if (c) S.couleurs.add(c); } }
      continue;
    }
    const fondC = cle(s.backgroundColor);
    const bords = ['Top', 'Right', 'Bottom', 'Left'].filter((c) => parseFloat(s['border' + c + 'Width']) > 0 && s['border' + c + 'Style'] !== 'none' && cle(s['border' + c + 'Color']));
    if (fondC || bords.length || s.backgroundImage !== 'none') E.surfaces++;
    if (fondC) S.couleurs.add(fondC);
    if (bords.length) { E.bordures++; bords.forEach((c) => { S.traits.add(`${s['border' + c + 'Width']} ${s['border' + c + 'Style']}`); S.couleurs.add(cle(s['border' + c + 'Color'])); }); }
    if (s.boxShadow !== 'none') S.ombres.add(s.boxShadow);
    for (const c of ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight']) { const v = s['border' + c + 'Radius']; if (v && v !== '0px' && (fondC || bords.length || s.backgroundImage !== 'none' || s.boxShadow !== 'none')) S.rayons.add(v.split(' ')[0]); }
    for (const k of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) { const v = s[k]; if (v && v !== '0px' && v !== 'normal' && !v.startsWith('-') && !v.includes('auto')) S.espaces.add(v); }
    const texte = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const dansControle = vus.some((c) => c !== el && c.contains(el));
    if (controle(el)) { if (!dansControle) { E.elements++; vus.push(el); } } else if (texte && !dansControle) E.elements++;
    if (texte && !el.closest('[aria-hidden="true"]')) {
      S.tailles.add(s.fontSize); S.graisses.add(s.fontWeight); S.polices.add(s.fontFamily.split(',')[0].replace(/"/g, ''));
      let c = parse(s.color); const ck = cle(s.color); if (ck) { S.coulTexte.add(ck); S.couleurs.add(ck); }
      if (c) { const b = fond(el); if (c.a < 1) c = melange(c, b); const r = ratio(c, b); if (r < E.min) E.min = r; if (r < 4.5) E.sous45++; }
    }
  }
  const o = { ...E }; for (const k in S) o[k] = [...S[k]];
  return o;
}

(async () => {
  const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const nom of NOMS) {
    const fichier = path.join(ICI, nom + '.html');
    const ctx = await nav.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('file://' + fichier + '?nu=1&fige=1&reduit=1');
    const scenes = await page.$$eval('#sc-scene option', (o) => o.map((x) => [x.value, x.textContent]));
    const cibles = scenes.map(([s, t]) => [s, t, '']).concat([['fin', 'Ce qui reste (tiroir ouvert, V2)', '&tiroir=1&revue=v2']]);
    const union = {}; const lignes = []; const tot = { elements: 0, surfaces: 0, symboles: 0, sous45: 0, min: 99 };
    for (const theme of ['sombre', 'clair']) {
      for (const [s, t, extra] of cibles) {
        await page.goto('file://' + fichier + `?nu=1&fige=1&reduit=1&theme=${theme}&taille=normal&scene=${s}${extra}`);
        await page.waitForTimeout(80);
        const r = await page.evaluate(relever);
        for (const k of ['tailles', 'graisses', 'coulTexte', 'couleurs', 'rayons', 'espaces', 'traits', 'ombres', 'formes', 'polices']) { union[k] = union[k] || new Set(); r[k].forEach((v) => union[k].add(theme + '|' + v)); }
        if (theme === 'sombre') { tot.elements += r.elements; tot.surfaces += r.surfaces; tot.symboles += r.symboles; }
        tot.sous45 += r.sous45; tot.min = Math.min(tot.min, r.min);
        if (theme === 'sombre') lignes.push(`| ${t} | ${r.elements} | ${r.surfaces} | ${r.symboles} | ${r.formes.length} | ${r.tailles.length} | ${r.graisses.length} | ${r.coulTexte.length} | ${r.couleurs.length} | ${r.rayons.length} | ${r.espaces.length} | ${r.bordures} | ${r.ombres.length} | ${r.min.toFixed(2)} |`);
      }
    }
    const u = (k, th = 'sombre') => [...union[k]].filter((v) => v.startsWith(th + '|')).map((v) => v.slice(th.length + 1));
    console.log(`\n### ${nom}\n\nThème sombre, 600 × 760, ${cibles.length} surfaces.\n\n| Scène | Éléments | Surfaces | Symboles | Formes | Tailles | Graisses | Coul. texte | Couleurs | Rayons | Espacements | Bordures | Ombres | Contraste min |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
    lignes.forEach((l) => console.log(l));
    console.log(`| **Total ou union (sombre)** | **${tot.elements}** | **${tot.surfaces}** | **${tot.symboles}** | **${u('formes').length}** | **${u('tailles').length}** | **${u('graisses').length}** | **${u('coulTexte').length}** | **${u('couleurs').length}** | **${u('rayons').length}** | **${u('espaces').length}** | | **${u('ombres').length}** | **${tot.min.toFixed(2)}** |`);
    console.log(`\nTextes sous 4,5:1 (deux thèmes, toutes surfaces) : ${tot.sous45}.`);
    console.log(`Tailles : ${u('tailles').sort((a, b) => parseFloat(b) - parseFloat(a)).join(', ')}.`);
    console.log(`Graisses : ${u('graisses').sort().join(', ')}. Polices : ${u('polices').join(', ')}.`);
    console.log(`Rayons : ${u('rayons').sort((a, b) => parseFloat(a) - parseFloat(b)).join(', ')}.`);
    console.log(`Espacements : ${u('espaces').sort((a, b) => parseFloat(a) - parseFloat(b)).join(', ')}.`);
    console.log(`Bordures : ${u('traits').join(' ; ')}.`);
    console.log(`Ombres : ${u('ombres').length}. Couleurs de texte (sombre) : ${u('coulTexte').length} ; (clair) : ${u('coulTexte', 'clair').length}.`);
    if (DETAIL) { console.log('Couleurs (sombre) : ' + u('couleurs').join(' · ')); console.log('Couleurs de texte (sombre) : ' + u('coulTexte').join(' · ')); }
    await ctx.close();
  }
  await nav.close();
})();
