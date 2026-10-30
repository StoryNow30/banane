'use strict';
/* CH-026 — LA FILE DE PARTIES PILOTÉE PAR LES CLICS DE SIGNAL, extension réelle dans Chromium, ESV = maquette. Les essais d'avant (file-parties.test.cjs,
 * ui5-navigateur-signal-file*.test.cjs) passaient par l'API du service worker ou par un service worker simulé : ils n'ont pas vu l'arrêt du test 26
 * (journal du 30/10 : la file démarre, « arreter » motif « operateur » 6 s après). Cause mesurée ici : pendant le lot de la file, « Arrêter le lot »
 * (`stop`, qui arrête TOUTE la file) apparaissait exactement sous le bouton « Lancer la file » de la boîte (600 × 760 et 360 × 640) ; un second clic
 * au même endroit arrêtait la file. Ne prouve rien sur le vrai ESV.
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=300000 tests/esv-maquette/file-signal-clics.test.cjs */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const N = require('./navigateur.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function monter(vue) {
  const man = JSON.parse(fs.readFileSync(path.join(N.racine, 'manifest.json'), 'utf8')), hote = new URL(man.host_permissions[0].replace(/\*$/, ''));
  assert.match(fs.readFileSync(path.join(N.racine, 'src/settings.js'), 'utf8'), /const file = Object\.freeze\(\{ actif: true,/, 'file de parties allumée dans le dépôt');
  const { demarrer } = require('./serveur.cjs'), serveur = await demarrer();
  const ctx = await N.playwright().chromium.launchPersistentContext('', { executablePath: N.executable(), headless: true, viewport: { width: 1200, height: 800 },
    args: ['--headless=new', `--disable-extensions-except=${N.racine}`, `--load-extension=${N.racine}`] });
  const erreurs = [];
  await ctx.route(hote.origin + '/**', async route => { const u = new URL(route.request().url()); let c = u.pathname;
    if (c.startsWith(hote.pathname)) { const reste = c.slice(hote.pathname.length); c = '/tests/esv-maquette/' + (reste === '' || reste === 'maquette' ? 'esv.html' : reste); }
    try { await route.fulfill({ response: await route.fetch({ url: serveur.url + c + u.search }) }); } catch { erreurs.push('route ' + c); await route.abort(); } });
  for (let i = 0; i < 80 && !ctx.serviceWorkers().length; i++) await dormir(250);
  const sw = ctx.serviceWorkers()[0], id = sw.url().split('/')[2];
  sw.on('console', m => { if (m.type() === 'error') erreurs.push('sw: ' + m.text()); });
  const esv = await ctx.newPage(); esv.on('pageerror', e => erreurs.push('esv: ' + e.message));
  /* Lot lent (latence 200 ms, 60 cuts) : la file reste dans son premier lot pendant tout l'essai. */
  await esv.goto(`${hote.origin}${hote.pathname}maquette?cuts=60&debut=100&cut=100&latence=200&parties=3&partie2=4`);
  await esv.evaluate(() => window.__maquette.pret); await esv.waitForFunction(() => window.__maquette.etat().railsPrets);
  const pan = await ctx.newPage(); await pan.setViewportSize(vue);
  pan.on('pageerror', e => erreurs.push('panneau: ' + e.message));
  pan.on('console', m => { if (m.type() === 'error') erreurs.push('panneau console: ' + m.text()); });
  /* Espion : chaque message d'action du panneau (hors lectures), dans l'ordre. */
  await pan.addInitScript(() => { window.__m = []; const f = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = (m, ...r) => { if (/^(stop|file-.*|start|pause|resume|retry)$/.test(m?.action || '') && m.action !== 'file-etat') window.__m.push(m.action); return f(m, ...r); }; });
  await pan.goto(`chrome-extension://${id}/panel.html#automatic`); await dormir(1200);
  const api = async (action, a = {}) => { const r = await pan.evaluate(([action, a]) => chrome.runtime.sendMessage({ kind: 'panel', action, args: a }), [action, a]); if (r?.error) throw Error(action + ' : ' + r.error); return r?.result; };
  const onglets = await api('list-tabs'); await api('connect', { tabId: (onglets.find(t => /aquette/i.test(t.title)) || onglets[0]).id });
  await pan.waitForFunction(() => /Prêt/.test(document.querySelector('#ui5 .sg-mot')?.textContent || ''), null, { timeout: 10000 });
  const fermer = async () => { await ctx.close().catch(() => {}); await serveur.fermer(); };
  return { pan, api, erreurs, fermer, messages: () => pan.evaluate(() => window.__m.slice()) };
}
const centre = async (pan, sel) => { const b = await pan.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
/* Préparer puis lancer une file de 2 parties par la boîte de Signal ; rend le rectangle du bouton « Lancer » cliqué. */
async function lancerParLaBoite(m) {
  await m.pan.click('#ui5 [data-act="sg:file"]'); await m.pan.waitForSelector('#ui5 .sg-boite');
  await m.pan.click('#ui5 .sg-boite [data-act="sg:file-n:2"]'); await dormir(150);
  await m.pan.click('#ui5 .sg-boite [data-act="legacy:file-principal"]');
  await m.pan.waitForFunction(() => /Lancer la file/.test(document.querySelector('#ui5 .sg-boite [data-act="legacy:file-principal"]')?.textContent || ''));
  const r = await m.pan.locator('#ui5 .sg-boite [data-act="legacy:file-principal"]').boundingBox();
  await m.pan.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  return r;
}
/* La file est dans son lot, le lot tourne, et l'écran de Signal le dit. */
async function attendreLotDeFile(m) {
  for (let i = 0; i < 60; i++) { const f = (await m.api('file-etat')).file, b = (await m.api('view')).batch;
    if (f?.etat === 'lot' && b?.state === 'RUNNING' && await m.pan.isVisible('#ui5 .sg-file')) return; await dormir(250); }
  throw Error('la file n’est pas entrée dans son lot');
}

for (const vue of [{ width: 600, height: 760 }, { width: 360, height: 640 }]) {
  test(`CH-026 · ${vue.width} × ${vue.height} : un second clic à l’endroit de « Lancer la file » n’arrête pas la file (arrêt du test 26)`, opts, async () => {
    const m = await monter(vue);
    try {
      const r = await lancerParLaBoite(m);
      await attendreLotDeFile(m); await dormir(800);
      /* Le second clic de l'opérateur, n'importe où sur le bouton qu'il venait de cliquer : à gauche, au milieu, à droite. */
      const sous = [];
      for (const fx of [0.08, 0.5, 0.92]) { const x = r.x + r.width * fx, y = r.y + r.height / 2;
        sous.push(await m.pan.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest?.('[data-act]')?.dataset.act || null, [x, y]));
        await m.pan.mouse.click(x, y); await dormir(500); }
      await dormir(1000);
      const f = (await m.api('file-etat')).file;
      assert.equal(f?.etat, 'lot', `file toujours dans son lot (sous le pointeur : ${JSON.stringify(sous)} ; motif : ${JSON.stringify(f?.motifFin)})`);
      assert.deepEqual((await m.messages()).filter(a => a === 'stop' || a === 'file-arreter'), [], 'aucun arrêt envoyé');
      assert.equal(await m.pan.locator('#ui5 [data-act="legacy:stop"]').count(), 0, 'pas d’« Arrêter le lot » pendant la file : seul « Arrêter la file » l’arrête');
      assert.deepEqual(m.erreurs, []);
    } finally { await m.fermer(); }
  });
}

test('CH-026 · « Arrêter la file » se confirme : un clic ne fait que demander, le second (pas immédiat) arrête, origine notée au journal', opts, async () => {
  const m = await monter({ width: 600, height: 760 });
  try {
    await lancerParLaBoite(m); await attendreLotDeFile(m);
    const sel = '#ui5 .sg-file [data-act="legacy:file-secondaire"]';
    const p = await centre(m.pan, sel);
    await m.pan.mouse.dblclick(p.x, p.y); await dormir(400);
    assert.equal((await m.api('file-etat')).file?.etat, 'lot', 'un double clic ne vaut pas confirmation');
    assert.match(await m.pan.textContent(sel), /Confirmer l’arrêt de la file/);
    await dormir(700); await m.pan.click(sel);
    let f = null; for (let i = 0; i < 40; i++) { f = (await m.api('file-etat')).file; if (f?.etat === 'arret') break; await dormir(250); }
    assert.equal(f?.etat, 'arret'); assert.equal(f.motifFin?.code, 'operateur');
    assert.deepEqual((await m.messages()).filter(a => a === 'stop' || a === 'file-arreter'), ['file-arreter']);
    const ev = ((await m.api('journal')).events || []).filter(e => e.type === 'file-parties' && e.evenement === 'arreter');
    assert.equal(ev.length, 1); assert.equal(ev[0].origine, 'file-arreter', 'le journal dit quelle commande a arrêté la file');
    assert.deepEqual(m.erreurs, []);
  } finally { await m.fermer(); }
});

test('CH-026 · onglet « File » : lancer, arrêter (confirmé), puis « Reprendre la file » au rang interrompu, sans recharger l’extension', opts, async () => {
  const m = await monter({ width: 600, height: 760 });
  try {
    await m.pan.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]'); await m.pan.waitForSelector('#ui5 .sg-onglet-file');
    await m.pan.click('#ui5 .sg-onglet-file [data-act="sg:file-n:2"]'); await dormir(200);
    await m.pan.click('#ui5 .sg-onglet-file [data-act="legacy:file-lancer"]');
    await attendreLotDeFile(m);
    const sel = '#ui5 .sg-onglet-file [data-act="legacy:file-secondaire"]';
    await m.pan.click(sel); await dormir(700); await m.pan.click(sel);
    let f = null; for (let i = 0; i < 40; i++) { f = (await m.api('file-etat')).file; if (f?.etat === 'arret') break; await dormir(250); }
    assert.equal(f?.etat, 'arret'); assert.deepEqual({ ...f.reprise }, { rang: 0, part: 23, reste: 2 }, 'la partie 23, interrompue, est à refaire');
    for (let i = 0; i < 40; i++) { const b = (await m.api('view')).batch; if (b && b.state !== 'RUNNING') break; await dormir(250); }
    await m.pan.waitForSelector('#ui5 .sg-onglet-file [data-act="legacy:file-reprendre"]', { timeout: 5000 });
    assert.match(await m.pan.textContent('#ui5 .sg-onglet-file [data-act="legacy:file-reprendre"]'), /Reprendre la file · 2 parties restantes/);
    await m.pan.click('#ui5 .sg-onglet-file [data-act="legacy:file-reprendre"]');
    await attendreLotDeFile(m);
    const g = (await m.api('file-etat')).file; assert.deepEqual([...g.plan], [23, 24]); assert.equal(g.rang, 0);
    const ev = ((await m.api('journal')).events || []).filter(e => e.type === 'file-parties' && e.evenement === 'demarrer').sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    assert.equal(ev.length, 2); assert.equal(ev[1].reprise, 23); assert.equal(ev[1].remplace?.etat, 'arret');
    assert.deepEqual((await m.messages()).filter(a => /^file-/.test(a)), ['file-demarrer', 'file-arreter', 'file-demarrer']);
    assert.deepEqual(m.erreurs, []);
  } finally { await m.fermer(); }
});
