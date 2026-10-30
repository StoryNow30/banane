'use strict';
/* CH-017 — FILE DE PARTIES, extension réelle dans Chromium, ESV = maquette (tests/esv-maquette/). L'extension est une COPIE TEMPORAIRE du dépôt sur
 * laquelle sont appliqués le diff proposé de l'adaptateur (chantiers/CH-017/adaptateur-changer-partie.patch : `changerPartie`, clic sur le lien
 * `p=N` du sélecteur SUPPOSÉ) et `file.actif:true` ; le dépôt lui-même garde l'adaptateur intact et la file éteinte. La maquette sert la partie `p`
 * après le rechargement (variante « rechargement »). Prouve, SUR LA MAQUETTE seulement : la chaîne file → lot réel → passe → relecture → changement
 * de partie → lot suivant, avec ré-équipement de l'onglet après le rechargement. Ne prouve rien sur le vrai ESV (relevé de l'opérateur à faire).
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=600000 tests/esv-maquette/file-parties.test.cjs */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const N = require('./navigateur.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};
const dormir = ms => new Promise(r => setTimeout(r, ms));
const LOT_ARGS = { testConfirmed: true, allowNavigationEvidence: true, lowConfidence: 'attempt', unresolvedPolicy: 'defer', lotDecision: 'apply', geometryEngine: 'geometry-candidate-v1' };

function extensionAllumee() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ariane-file-'));
  for (const f of ['manifest.json', 'background.js', 'panel.html', 'panel.js']) if (fs.existsSync(path.join(N.racine, f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  for (const r of ['src', 'vendor', 'icons', 'fonts', 'datasets']) if (fs.existsSync(path.join(N.racine, r))) fs.cpSync(path.join(N.racine, r), path.join(d, r), { recursive: true });
  for (const f of fs.readdirSync(N.racine).filter(f => /\.css$/.test(f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  /* Le patch de CH-017 est intégré au tronc depuis la test 25 : on ne l'applique que s'il manque encore (copie d'avant l'intégration). */
  const patch = path.join(N.racine, 'chantiers/CH-017/adaptateur-changer-partie.patch');
  if (!fs.readFileSync(path.join(d, 'src/adapter-page.js'), 'utf8').includes('function changerPartie')) execFileSync('git', ['apply', patch], { cwd: d });
  const S = path.join(d, 'src/settings.js'), t = fs.readFileSync(S, 'utf8'), a = 'const file = Object.freeze({ actif: false,';
  if (t.includes(a)) fs.writeFileSync(S, t.replace(a, 'const file = Object.freeze({ actif: true,'));
  else assert.ok(/file = (Object\.freeze\()?\{ actif: true,/.test(t));
  return d;
}

async function file({ n, parties, cuts = 8, partie2 = 4 }) {
  const ext = extensionAllumee(), pw = N.playwright(), man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8')), hote = new URL(man.host_permissions[0].replace(/\*$/, ''));
  const { demarrer } = require('./serveur.cjs'), serveur = await demarrer();
  const ctx = await pw.chromium.launchPersistentContext('', { executablePath: N.executable(), headless: true, viewport: { width: 1200, height: 800 }, args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const erreurs = [], chargements = [];
  try {
    await ctx.route(hote.origin + '/**', async route => { const u = new URL(route.request().url()); let c = u.pathname;
      if (c.startsWith(hote.pathname)) { const reste = c.slice(hote.pathname.length); c = '/tests/esv-maquette/' + (reste === '' || reste === 'maquette' ? 'esv.html' : reste); }
      if (c.endsWith('esv.html')) chargements.push(u.searchParams.get('p'));
      try { await route.fulfill({ response: await route.fetch({ url: serveur.url + c + u.search }) }); } catch { erreurs.push('route ' + c); await route.abort(); } });
    for (let i = 0; i < 80 && !ctx.serviceWorkers().length; i++) await dormir(250);
    const sw = ctx.serviceWorkers()[0], id = sw.url().split('/')[2];
    sw.on('console', m => { if (m.type() === 'error') erreurs.push('sw: ' + m.text()); });
    const esv = await ctx.newPage(); esv.on('pageerror', e => erreurs.push('esv: ' + e.message));
    await esv.goto(`${hote.origin}${hote.pathname}maquette?cuts=${cuts}&debut=100&cut=100&latence=20&parties=${parties}&partie2=${partie2}`);
    await esv.evaluate(() => window.__maquette.pret); await esv.waitForFunction(() => window.__maquette.etat().railsPrets);
    const pan = await ctx.newPage(); await pan.goto(`chrome-extension://${id}/panel.html#automatic`); await dormir(600);
    const api = async (action, a = {}) => { const r = await pan.evaluate(([action, a]) => chrome.runtime.sendMessage({ kind: 'panel', action, args: a }), [action, a]); if (r?.error) throw Error(action + ' : ' + r.error); return r?.result; };
    const onglets = await api('list-tabs'); await api('connect', { tabId: (onglets.find(t => /aquette/i.test(t.title)) || onglets[0]).id });
    await api('settings', { mode: 'automatic-test' });
    const t0 = Date.now(); await api('file-demarrer', { n, lotArgs: LOT_ARGS });
    let v;
    let trace = '';
    for (let i = 0; i < Number(process.env.BANANE_TOURS || 1200); i++) { await dormir(500); try { v = await api('file-etat'); } catch (e) { continue; }
      const vb = process.env.BANANE_TRACE ? await api('view').catch(() => null) : null, t = JSON.stringify([v.file?.etat, v.file?.rang, v.file?.enCours, v.file?.changement, vb?.batch?.state, vb?.batch?.stoppedAtEnd?.issue, vb?.notice?.slice(0, 160), vb?.relecture?.etat, vb?.relecture?.message?.slice(0, 120)]); if (t !== trace && process.env.BANANE_TRACE) { trace = t; console.error('# ' + Math.round((Date.now() - t0) / 1000) + ' s ' + t); }
      if (['fin', 'arret'].includes(v.file?.etat)) break; }
    /* Le panneau réel (variante A) rend la carte de la file : visible, état final, une ligne de bilan par partie. */
    await pan.waitForFunction(() => { const el = document.getElementById('file-parties'); return el && !el.hidden && /terminée|arrêtée/.test(document.getElementById('file-etat').textContent); }, null, { timeout: 15000 }).catch(() => {});
    const panneau = await pan.evaluate(() => ({ visible: !document.getElementById('file-parties').hidden, etat: document.getElementById('file-etat').textContent, lignes: document.querySelectorAll('#file-bilan li').length }));
    const journal = await api('journal'), ev = journal.events || [];
    return { v, ev, panneau, dureeMs: Date.now() - t0, chargements, erreurs, serveur: serveur.journal.ecritures.map(e => ({ ligne: e.rowKey, statut: e.body?.ExtractionStatus })),
      lots: ev.filter(e => e.type === 'batch-started').map(e => ({ part: e.scope?.part ?? e.batch?.scope?.part, file: e.scope?.fileParties ?? e.batch?.scope?.fileParties ?? null })),
      commandes: ev.filter(e => e.type === 'adapter-result').map(e => e.action) };
  } finally { await ctx.close().catch(() => {}); await serveur.fermer(); fs.rmSync(ext, { recursive: true, force: true }); }
}
function controler(r, n) {
  const f = r.v.file;
  assert.equal(f.etat, 'fin', 'file finie : ' + JSON.stringify(f.motifFin));
  assert.equal(f.motifFin.code, 'nombre-atteint'); assert.equal(f.alerte, null);
  assert.deepEqual(f.bilan.map(p => p.part), [23, 24, 25].slice(0, n));
  assert.ok(r.chargements.filter(p => p !== null).length >= n - 1, 'au moins un rechargement par changement de partie : ' + JSON.stringify(r.chargements));
  const ch = r.ev.filter(e => e.type === 'file-parties-changement');
  assert.ok(ch.some(e => !e.retour && e.vers === 24), 'changement vers la partie 24 demandé');
  assert.ok(!r.commandes.includes('skipAndNext'), 'aucun SKIP');
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.panneau, { visible: true, etat: 'terminée', lignes: n }, 'carte de la file au panneau');
  console.log(`# file de ${n} parties : ${Math.round(r.dureeMs / 1000)} s ; bilan ${JSON.stringify(f.bilan.map(p => ({ part: p.part, motifs: p.motifs, resume: p.resume, relecture: p.relecture })))} ; changements ${JSON.stringify(ch.map(e => ({ vers: e.vers, retour: e.retour, deja: e.deja })))} ; chargements ${JSON.stringify(r.chargements)} ; écritures serveur ${r.serveur.length}`);
}

test('file de 2 parties sur la maquette ESV : lots réels, relecture, changement de partie par rechargement, fin « nombre-atteint »', opts, async () => {
  controler(await file({ n: 2, parties: 3, cuts: 5 }), 2);
});
test('file de 3 parties sur la maquette ESV : deux changements de partie, bilan de trois parties', opts, async () => {
  controler(await file({ n: 3, parties: 4, cuts: 5 }), 3);
});
