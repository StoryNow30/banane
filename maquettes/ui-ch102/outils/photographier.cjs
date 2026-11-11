'use strict';
/* CH-102 : photographie les trois applications Exact (version web fabriquée par `bun exact.mjs web-build --out dist`) dans les huit états,
 * aux deux tailles et dans les deux thèmes, à deux pixels par point, et mesure ce qui sort du cadre.
 *   node maquettes/ui-ch102/outils/photographier.cjs DOSSIER_DES_APPLICATIONS DOSSIER_DE_SORTIE_HORS_DEPOT
 * Le pilote d'Exact (`agent web`) ne photographie le web qu'à un pixel par point : ces images-ci viennent du même rendu (la page servie telle
 * que `web-build` l'écrit, dans le même Chromium), prises par Playwright. Les tests et `verify` restent ceux d'Exact. Aucune image dans le dépôt. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const [, , APPS, SORTIE] = process.argv;
if (!APPS || !SORTIE) { console.error('usage : photographier.cjs DOSSIER_DES_APPLICATIONS DOSSIER_DE_SORTIE'); process.exit(2); }
if (!path.relative(path.resolve(__dirname, '../../..'), path.resolve(SORTIE)).startsWith('..')) { console.error('refus : la sortie est dans le dépôt'); process.exit(2); }
const { chromium } = require('playwright');
const NOMS = ['fiche', 'carte', 'bandeau'], ETATS = ['pret', 'cours', 'pause', 'toi', 'panne', 'rattrapage', 'relecture', 'fin'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.plan': 'application/octet-stream' };
const servir = dossier => new Promise(ok => { const s = http.createServer((q, r) => { let f = path.join(dossier, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dossier, 'index.html');
  r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }); s.listen(0, '127.0.0.1', () => ok(s)); });

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const nav = await chromium.launch(), bilan = [], polices = new Set();
  for (const nom of NOMS) {
    const serveur = await servir(path.join(APPS, nom, 'dist')), url = `http://127.0.0.1:${serveur.address().port}`;
    for (const theme of ['light', 'dark']) for (const [w, h] of [[360, 480], [600, 760]]) for (const e of ETATS) {
      const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: theme }), page = await ctx.newPage();
      page.on('pageerror', x => bilan.push(`${nom}/${e} ${w} ${theme} ERREUR ${x.message}`));
      await page.goto(`${url}/?etat=${e}`); await page.waitForTimeout(700);
      const m = await page.evaluate(({ w, h }) => {
        const out = [], vus = document.querySelectorAll('[data-testid],[data-test-id],button,input');
        const mot = [...document.querySelectorAll('*')].find(x => x.children.length === 0 && x.textContent.trim() && getComputedStyle(x).fontWeight >= 700 && x.getBoundingClientRect().top > 50);
        for (const x of document.querySelectorAll('button,input,select')) { const r = x.getBoundingClientRect(); if (!r.width) continue; const t = (x.innerText || x.getAttribute('aria-label') || x.tagName).trim().slice(0, 30);
          if (r.right > w + .5 || r.left < -.5) out.push(`SORT sur le côté : ${t}`); if (r.bottom > h + .5) out.push(`SOUS LE PLI : ${t} (${Math.round(r.bottom - h)} px)`); }
        for (const x of document.querySelectorAll('*')) { if (x.children.length || !x.textContent.trim()) continue; const s = getComputedStyle(x); if (x.scrollWidth > x.clientWidth + 1 && s.overflow !== 'visible') out.push(`TRONQUÉ : ${x.textContent.trim().slice(0, 30)}`); }
        if (document.documentElement.scrollWidth > w) out.push('DÉFILE DE CÔTÉ');
        return { out, police: getComputedStyle(mot || document.body).fontFamily, etat: mot ? mot.textContent.trim() : '?' };
      }, { w, h });
      polices.add(m.police); for (const o of m.out) bilan.push(`${nom}/${e} ${w} ${theme === 'dark' ? 'sombre' : 'clair'} ${o}`);
      await page.screenshot({ path: path.join(SORTIE, `${nom}-${e}-${w}-${theme === 'dark' ? 'sombre' : 'clair'}.png`) });
      await ctx.close();
    }
    serveur.close();
  }
  await nav.close();
  console.log(`${NOMS.length * ETATS.length * 4} images dans ${SORTIE}`);
  console.log('police demandée par la page : ' + [...polices].join(' | '));
  console.log(bilan.length ? [...new Set(bilan.map(b => b.replace(/ (clair|sombre) /, ' ')))].join('\n') : 'mesures : rien ne sort, rien sous le pli, rien de tronqué');
})();
