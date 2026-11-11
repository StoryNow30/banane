'use strict';
/* CH-103 : photographie les deux écrans (2 tailles × 2 thèmes) et mesure débordements, troncatures et contrastes
 * (seuil 4,5:1, éléments désactivés exclus). Repris de maquettes/ui-ch101/outils/voir3.cjs (branche chantier/CH-101).
 * Usage : node maquettes/ui-ch103/outils/voir.cjs PAGE.html DOSSIER_HORS_DEPOT
 * Les images ne vont JAMAIS dans le dépôt. */
const path = require('node:path');
const { chromium } = require('playwright');
const [PAGE, S] = process.argv.slice(2).map(p => path.resolve(p));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  const err = [];
  p.on('pageerror', e => err.push(e.message));
  p.on('requestfailed', r => err.push('ECHEC ' + r.url().slice(0, 80)));
  await p.goto('file://' + PAGE);
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: '.pg-choix{position:static!important}' });
  const polices = await p.evaluate(() => [...document.fonts].map(f => f.family + ' ' + f.status).join(', '));
  const bilan = [];
  for (const th of ['sombre', 'clair']) for (const ta of ['360', '600']) {
    await p.click('#th-' + th); await p.click('#ta-' + ta); await p.waitForTimeout(250);
    for (const id of ['cours', 'toi']) {
      const c = await p.$(`#ecran-${id} .pg-cadre .ar`);
      await c.screenshot({ path: `${S}/${id}-${th}-${ta}.png` });
    }
    const r = await p.evaluate(() => {
      const rgb = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
      const lum = ({ r, g, b }) => { const t = x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }; return .2126 * t(r) + .7152 * t(g) + .0722 * t(b); };
      const fond = e => { const pile = []; for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } }
        let r = pile.pop() || { r: 255, g: 255, b: 255, a: 1 }; while (pile.length) { const c = pile.pop(); r = { r: c.r * c.a + r.r * (1 - c.a), g: c.g * c.a + r.g * (1 - c.a), b: c.b * c.a + r.b * (1 - c.a), a: 1 }; } return r; };
      const out = []; let pire = 99;
      for (const P of document.querySelectorAll('.pg-cadre .ar')) {
        const R = P.getBoundingClientRect(), nom = P.dataset.ecran;
        const corps = P.querySelector('.ar-principal');
        if (corps.scrollHeight > corps.clientHeight + 1) out.push(nom + ' CORPS TROP HAUT de ' + (corps.scrollHeight - corps.clientHeight));
        for (const e of P.querySelectorAll('*')) {
          if (!e.getClientRects().length) continue; const d = e.closest('details:not([open])'); if (d && !e.closest('summary')) continue; const r = e.getBoundingClientRect(); if (!r.width) continue;
          if (r.right > R.right + .5 || r.bottom > R.bottom + .5 || r.left < R.left - .5) out.push(nom + ' SORT ' + e.className);
          if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible') out.push(nom + ' TRONQUE ' + e.className);
          if (e.disabled || e.closest('[disabled]')) continue;
          if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
          const c = rgb(getComputedStyle(e).color), f = fond(e); const [a, b2] = [lum(c), lum(f)].sort((x, y) => y - x); const k = (a + .05) / (b2 + .05);
          if (k < pire) pire = k;
          if (k < 4.5) out.push(nom + ' CONTRASTE ' + (e.className || e.tagName) + ' ' + k.toFixed(2));
        }
      }
      return { out: [...new Set(out)], pire: pire.toFixed(2) };
    });
    bilan.push(`== ${th} ${ta} : contraste le plus faible ${r.pire} ; ${r.out.length ? '\n  ' + r.out.join('\n  ') : 'aucun défaut'}`);
  }
  /* menu ouvert : il ne doit pas sortir du cadre */
  await p.click('#ta-360'); await p.click('#ecran-cours .ar-menu summary'); await p.waitForTimeout(200);
  const menu = await p.evaluate(() => { const m = document.querySelector('#ecran-cours .ar-menu-liste').getBoundingClientRect(), R = document.querySelector('#ecran-cours .ar').getBoundingClientRect(); return m.left >= R.left && m.right <= R.right && m.bottom <= R.bottom; });
  await (await p.$('#ecran-cours .pg-cadre .ar')).screenshot({ path: `${S}/cours-menu-clair-360.png` });
  const coupe = await p.evaluate(() => [...document.querySelectorAll('#ecran-cours .ar-menu-liste button')].some(b => b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().height > 33));
  console.log('menu : une entrée coupée ou sur deux lignes :', coupe);
  console.log('erreurs', err); console.log('polices', polices); console.log(bilan.join('\n')); console.log('menu dans le cadre (360) :', menu);
  await b.close();
})();
