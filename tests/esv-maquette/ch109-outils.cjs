'use strict';
/* CH-109 — outils communs des essais « Constellation bloquée sur une relecture » (extension réelle dans Chromium, ESV = maquette).
 * `constellation()` lance une file de N parties sur une COPIE TEMPORAIRE du dépôt (file allumée comme livrée, `remplacer` : textes de
 * src/settings.js changés pour l'essai), puis appelle `pendant(ctx)` à chaque tour : l'essai y fait son geste (F5 de la page ESV pendant
 * la relecture, panne de la maquette…). Rend la trace (états de la file et de la relecture, horodatés), le journal et l'état final.
 * Aucun réglage du dépôt n'est changé. */
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const N = require('./navigateur.cjs');
const dormir = ms => new Promise(r => setTimeout(r, ms));
const LOT_ARGS = { testConfirmed: true, allowNavigationEvidence: true, lowConfidence: 'attempt', unresolvedPolicy: 'defer', lotDecision: 'apply', geometryEngine: 'geometry-candidate-v1' };

function copieExtension(remplacer = []) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ariane-ch109-'));
  for (const f of ['manifest.json', 'background.js', 'panel.html', 'panel.js']) if (fs.existsSync(path.join(N.racine, f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  for (const r of ['src', 'vendor', 'icons', 'fonts', 'datasets']) if (fs.existsSync(path.join(N.racine, r))) fs.cpSync(path.join(N.racine, r), path.join(d, r), { recursive: true });
  for (const f of fs.readdirSync(N.racine).filter(f => /\.css$/.test(f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  const S = path.join(d, 'src/settings.js'); let t = fs.readFileSync(S, 'utf8');
  assert.ok(/const file = Object\.freeze\(\{ actif: true,/.test(t), 'file allumée dans le dépôt (D-268)');
  for (const [a, b] of remplacer) { assert.ok(t.includes(a), 'texte à remplacer absent de src/settings.js : ' + a); t = t.replace(a, b); }
  fs.writeFileSync(S, t);
  return d;
}

async function constellation({ n = 2, parties = 3, cuts = 12, debut = 0, partie2 = null, remplacer = [], reglagePause = null, pendant = null, toursMax = 600, finSi = null, pannes = null }) {
  const ext = copieExtension(remplacer), pw = N.playwright(), man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8')), hote = new URL(man.host_permissions[0].replace(/\*$/, ''));
  const { demarrer } = require('./serveur.cjs'), serveur = await demarrer();
  const ctx = await pw.chromium.launchPersistentContext('', { executablePath: N.executable(), headless: true, viewport: { width: 1200, height: 800 }, args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const erreurs = [], trace = [], chargements = [];
  try {
    await ctx.route(hote.origin + '/**', async route => { const u = new URL(route.request().url()); let c = u.pathname;
      if (c.startsWith(hote.pathname)) { const reste = c.slice(hote.pathname.length); c = '/tests/esv-maquette/' + (reste === '' || reste === 'maquette' ? 'esv.html' : reste); }
      if (c.endsWith('esv.html')) chargements.push({ p: u.searchParams.get('p'), t: Date.now() });
      try { await route.fulfill({ response: await route.fetch({ url: serveur.url + c + u.search }) }); } catch { erreurs.push('route ' + c); await route.abort(); } });
    for (let i = 0; i < 80 && !ctx.serviceWorkers().length; i++) await dormir(250);
    const sw = ctx.serviceWorkers()[0], id = sw.url().split('/')[2];
    const esv = await ctx.newPage(); esv.on('pageerror', e => erreurs.push('esv: ' + e.message));
    await esv.goto(`${hote.origin}${hote.pathname}maquette?cuts=${cuts}&debut=${debut}&cut=${debut}&latence=20&parties=${parties}${partie2 ? '&partie2=' + partie2 : ''}`);
    await esv.evaluate(() => window.__maquette.pret); await esv.waitForFunction(() => window.__maquette.etat().railsPrets);
    if (pannes) await fetch(serveur.url + '/maquette/pannes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pannes) });
    const pan = await ctx.newPage(); pan.on('pageerror', e => erreurs.push('panneau: ' + e.message));
    await pan.goto(`chrome-extension://${id}/panel.html#automatic`); await dormir(600);
    const api = async (action, a = {}) => { const r = await pan.evaluate(([action, a]) => chrome.runtime.sendMessage({ kind: 'panel', action, args: a }), [action, a]); if (r?.error) throw Error(action + ' : ' + r.error); return r?.result; };
    const onglets = await api('list-tabs'); await api('connect', { tabId: (onglets.find(t => /aquette/i.test(t.title)) || onglets[0]).id });
    await api('settings', { mode: 'automatic-test' });
    if (reglagePause) await api('relecture-pause-reglage', reglagePause);
    const t0 = Date.now(); await api('file-demarrer', { n, lotArgs: LOT_ARGS });
    const c = { esv, pan, api, serveur, t0, fait: {}, sec: () => Math.round((Date.now() - t0) / 1000) };
    let v = null, vb = null, der = '';
    for (let i = 0; i < toursMax; i++) { await dormir(500);
      try { v = await api('file-etat'); vb = await api('view'); } catch { continue; }
      const f = v.file, r = vb?.relecture;
      const t = JSON.stringify([f?.etat, f?.rang, f?.enCours?.part ?? null, r?.etat ?? null, r?.faits ?? null, r?.cut ?? null, (r?.message || '').slice(0, 140)]);
      if (t !== der) { der = t; trace.push({ s: c.sec(), file: f?.etat, rang: f?.rang, relecture: r?.etat ?? null, faits: r?.faits ?? null, cut: r?.cut ?? null, message: r?.message ?? null }); if (process.env.BANANE_TRACE) console.error('# ' + c.sec() + ' s ' + t); }
      c.v = v; c.vb = vb;
      if (pendant) await pendant(c);
      if (['fin', 'arret'].includes(f?.etat)) break;
      if (finSi && finSi(c)) break; }
    let panneau = null;
    try { panneau = await pan.evaluate(() => ({ relecture: document.getElementById('relecture-etat')?.textContent ?? null, file: document.getElementById('file-etat')?.textContent ?? null, texte: document.body.innerText.slice(0, 4000) })); } catch { /* panneau fermé */ }
    const journal = await api('journal'), ev = (journal.events || []).slice().sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    return { v, vb, ev, trace, panneau, dureeMs: Date.now() - t0, chargements, erreurs, fait: c.fait,
      commandes: ev.filter(e => e.type === 'adapter-result').map(e => e.action) };
  } finally { await ctx.close().catch(() => {}); await serveur.fermer(); fs.rmSync(ext, { recursive: true, force: true }); }
}
module.exports = { constellation, copieExtension, dormir, LOT_ARGS };
