'use strict';
/* Ariane 5 : l'écran de lancement (fusée à deux propulseurs qui décolle des rails). Pure présentation : le panneau est ouvert dans Chromium sans chrome.*, l'animation
 * est lue à des instants précis (`__lancementRendre`) ; on vérifie que le canvas dessine (fusée, flammes, ciel), que le titre apparaît, qu'un clic ou une touche
 * retire l'écran sans attendre, que « réduire les animations » donne le nom seul, et que le code ne parle ni au service worker ni à ESV. */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const N = require('./esv-maquette/navigateur.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};
const racine = path.resolve(__dirname, '..'), url = 'file://' + path.join(racine, 'panel.html');
async function ouvrir(contexte = {}) {
  const pw = require('playwright'), exe = process.env.CHROMIUM || undefined;
  const nav = await pw.chromium.launch({ executablePath: exe, headless: true }), page = await (await nav.newContext({ viewport: { width: 420, height: 640 }, ...contexte })).newPage();
  await page.addInitScript(() => { window.__lancementForce = true; });
  return { nav, page };
}
const lumi = (page, x, y) => page.evaluate(([x, y]) => { const c = document.getElementById('lancement-toile'), d = c.getContext('2d').getImageData(x * (c.width / c.clientWidth), y * (c.height / c.clientHeight), 1, 1).data; return [d[0], d[1], d[2]]; }, [x, y]);

test('le canvas dessine : nuit sombre au départ, flamme et fumée à l\'allumage, espace au décollage', opts, async () => {
  const { nav, page } = await ouvrir();
  try {
    await page.addInitScript(() => { window.__lancementForce = true; window.__lancementManuel = true; });
    await page.goto(url);
    await page.evaluate(() => window.__lancementRendre(0.8)); const nuit = await lumi(page, 210, 20);
    await page.evaluate(() => window.__lancementRendre(1.0)); const flamme = await lumi(page, 210, 560);
    assert.ok(flamme[0] > 200 && flamme[1] > 150, 'flamme/fumée claire sous la fusée : ' + flamme);
    await page.evaluate(() => window.__lancementRendre(2.8)); const espace = await lumi(page, 30, 300);
    assert.ok(espace.every(v => v < 70), 'ciel profond au décollage : ' + espace);
    assert.ok(nuit.every(v => v < 120), 'ciel du haut sombre au départ : ' + nuit);
    await page.evaluate(() => window.__lancementRendre(3.4)); await page.waitForTimeout(1600);
    assert.ok(await page.evaluate(() => document.getElementById('lancement').classList.contains('titre')));
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.lanc-nom h2 span:last-child')).opacity), '1', 'titre lisible');
    assert.equal(await page.evaluate(() => document.querySelector('.lanc-nom h2').textContent.replace(/ /g, ' ')), 'ARIANE 5');
  } finally { await nav.close(); }
});
test('un clic retire l\'écran aussitôt ; une touche aussi', opts, async () => {
  for (const geste of ['click', 'key']) {
    const { nav, page } = await ouvrir();
    try { await page.goto(url); assert.equal(await page.evaluate(() => document.getElementById('lancement').hidden), false);
      if (geste === 'click') await page.mouse.click(200, 300); else await page.keyboard.press('Space');
      await page.waitForFunction(() => document.getElementById('lancement').hidden, null, { timeout: 1500 });
    } finally { await nav.close(); }
  }
});
test('sans geste, l\'écran part tout seul en moins de 6 s', opts, async () => {
  const { nav, page } = await ouvrir();
  try { await page.goto(url); await page.waitForFunction(() => document.getElementById('lancement').hidden, null, { timeout: 6000 }); } finally { await nav.close(); }
});
test('« réduire les animations » : le nom seul, sans canvas, puis l\'écran part', opts, async () => {
  const { nav, page } = await ouvrir({ reducedMotion: 'reduce' });
  try { await page.goto(url);
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('lancement-toile')).display), 'none');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.lanc-nom h2 span')).opacity), '1');
    await page.waitForFunction(() => document.getElementById('lancement').hidden, null, { timeout: 3000 });
  } finally { await nav.close(); }
});
test('pure présentation : le code du lancement ne touche ni au service worker, ni à ESV, ni au stockage', () => {
  const js = fs.readFileSync(path.join(racine, 'panel-lancement.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/chrome\.|sendMessage|fetch\(|localStorage|indexedDB|XMLHttpRequest/.test(js));
  assert.ok(fs.readFileSync(path.join(racine, 'panel.html'), 'utf8').includes('<script src="panel-lancement.js"></script>'));
});
