'use strict';
/* Ariane 5 : l'écran de lancement épuré (fusée au trait, silhouette blanche sur fond noir, un filet de lumière, puis le nom). Pure présentation : le panneau est ouvert
 * dans Chromium sans chrome.*, les animations CSS sont lues à des instants précis (Web Animations : pause + currentTime) ; on vérifie que la fusée est au sol puis
 * quitte l'écran par le haut, que le titre apparaît, qu'un clic ou une touche retire l'écran sans attendre, que « réduire les animations » donne le nom seul, et que
 * le code ne parle ni au service worker ni à ESV. */
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
const a = (page, t) => page.evaluate(t => { for (const x of document.getAnimations()) { x.pause(); x.currentTime = t * 1000; } }, t);
const rect = (page, sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: window.innerHeight }; }, sel);
const opacite = (page, sel) => page.evaluate(s => Number(getComputedStyle(document.querySelector(s)).opacity), sel);

test('la fusée est au sol au début, monte, quitte l\'écran par le haut ; le nom apparaît ensuite', opts, async () => {
  const { nav, page } = await ouvrir();
  try {
    await page.goto(url);
    await a(page, 0.6); const sol = await rect(page, '.lanc-fusee');
    assert.ok(sol.bottom > sol.h * 0.5 && sol.top > sol.h * 0.4, 'la fusée est dans la moitié basse au départ : ' + JSON.stringify(sol));
    await a(page, 1.9); const vol = await rect(page, '.lanc-fusee');
    assert.ok(vol.top < sol.top - 60, 'elle a monté : ' + JSON.stringify([sol.top, vol.top]));
    await a(page, 2.6); const sortie = await rect(page, '.lanc-fusee');
    assert.ok(sortie.bottom < 0, 'elle a quitté l\'écran par le haut : ' + JSON.stringify(sortie));
    await a(page, 0.4); assert.equal(await opacite(page, '.lanc-nom h2'), 0, 'pas de titre pendant le décollage');
    await a(page, 3.3); assert.ok(await opacite(page, '.lanc-nom h2') > 0.99, 'titre lisible');
    assert.equal(await page.evaluate(() => document.querySelector('.lanc-nom h2').textContent), 'ARIANE 5');
    await a(page, 3.7); assert.ok(await opacite(page, '.lanc-nom small') > 0.99);
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
test('« réduire les animations » : le nom seul, sans dessin, puis l\'écran part', opts, async () => {
  const { nav, page } = await ouvrir({ reducedMotion: 'reduce' });
  try { await page.goto(url);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#lancement svg')).display), 'none');
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.lanc-nom h2')).opacity) > 0.98, null, { timeout: 1500 });
    await page.waitForFunction(() => document.getElementById('lancement').hidden, null, { timeout: 3500 });
  } finally { await nav.close(); }
});
test('pure présentation : le code du lancement ne touche ni au service worker, ni à ESV, ni au stockage', () => {
  const js = fs.readFileSync(path.join(racine, 'panel-lancement.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/chrome\.|sendMessage|fetch\(|localStorage|indexedDB|XMLHttpRequest/.test(js));
  assert.ok(fs.readFileSync(path.join(racine, 'panel.html'), 'utf8').includes('<script src="panel-lancement.js"></script>'));
});
