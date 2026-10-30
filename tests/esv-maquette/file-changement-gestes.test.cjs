'use strict';
/* CH-026 — LE CHANGEMENT DE PARTIE DE LA FILE PAR LES GESTES DE L'OPÉRATEUR, extension réelle dans Chromium, ESV = maquette, file lancée par l'onglet
 * « File » de Signal. L'extension est une COPIE du dépôt sur laquelle est appliqué chantiers/CH-026/adaptateur-changement-partie.patch (le dépôt garde
 * l'adaptateur intact : l'intégrateur applique le patch). La maquette rend le TÉMOIGNAGE de l'opérateur (30/10) : au dernier cut, « Next cut » ouvre la
 * partie suivante ; plus rien à valider, « Next non validated cut » aussi (`traversee`). Prouve, SUR LA MAQUETTE seulement : la file enchaîne sans le
 * sélecteur ; un échec de tous les chemins laisse un journal complet et une alerte lisible dans Signal. Ne prouve rien sur un vrai ESV.
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=600000 tests/esv-maquette/file-changement-gestes.test.cjs */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const N = require('./navigateur.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};
const dormir = ms => new Promise(r => setTimeout(r, ms));

function extensionPatchee() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ariane-gestes-'));
  for (const f of ['manifest.json', 'background.js', 'panel.html', 'panel.js']) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  for (const r of ['src', 'vendor', 'icons', 'fonts', 'datasets']) if (fs.existsSync(path.join(N.racine, r))) fs.cpSync(path.join(N.racine, r), path.join(d, r), { recursive: true });
  for (const f of fs.readdirSync(N.racine).filter(f => /\.css$/.test(f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  execFileSync('git', ['apply', path.join(N.racine, 'chantiers/CH-026/adaptateur-changement-partie.patch')], { cwd: d });
  return d;
}

async function file({ maquette, sansSelecteurApres = false }) {
  const ext = extensionPatchee(), pw = N.playwright(), man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8')), hote = new URL(man.host_permissions[0].replace(/\*$/, ''));
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
    await esv.goto(`${hote.origin}${hote.pathname}maquette?cuts=5&debut=100&cut=100&latence=20&parties=3&partie2=4&${new URLSearchParams(maquette)}`);
    await esv.evaluate(() => window.__maquette.pret); await esv.waitForFunction(() => window.__maquette.etat().railsPrets);
    const pan = await ctx.newPage(); await pan.setViewportSize({ width: 600, height: 760 });
    pan.on('pageerror', e => erreurs.push('panneau: ' + e.message));
    await pan.goto(`chrome-extension://${id}/panel.html#automatic`); await dormir(800);
    const api = async (action, a = {}) => { const r = await pan.evaluate(([action, a]) => chrome.runtime.sendMessage({ kind: 'panel', action, args: a }), [action, a]); if (r?.error) throw Error(action + ' : ' + r.error); return r?.result; };
    const onglets = await api('list-tabs'); await api('connect', { tabId: (onglets.find(t => /aquette/i.test(t.title)) || onglets[0]).id });
    await pan.waitForFunction(() => /Prêt/.test(document.querySelector('#ui5 .sg-mot')?.textContent || ''), null, { timeout: 15000 });
    /* Comme l'opérateur : l'onglet « File », 2 parties, « Lancer la file ». */
    await pan.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]'); await pan.waitForSelector('#ui5 .sg-onglet-file');
    await pan.click('#ui5 .sg-onglet-file [data-act="sg:file-n:2"]'); await dormir(200);
    await pan.click('#ui5 .sg-onglet-file [data-act="legacy:file-lancer"]');
    const t0 = Date.now(); let v = null;
    /* Comme le terrain du 30/10 : le sélecteur était là au départ (relevé de 14:21) et absent ensuite (relevé de 14:38). */
    if (sansSelecteurApres) { for (let i = 0; i < 60 && (await api('file-etat')).file?.etat !== 'lot'; i++) await dormir(250);
      await esv.evaluate(() => { window.__maquette.options.selecteur = 0; document.getElementById('maquette-parties').textContent = ''; }); }
    for (let i = 0; i < 600; i++) { await dormir(500); try { v = (await api('file-etat')).file; } catch { continue; } if (['fin', 'arret'].includes(v?.etat)) break; }
    await pan.waitForFunction(() => /File (terminée|arrêtée)/.test(document.querySelector('#ui5 .sg-onglet-file .sg-mot')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const signal = await pan.evaluate(() => ({ mot: document.querySelector('#ui5 .sg-onglet-file .sg-mot')?.textContent || '', alerte: document.querySelector('#ui5 .sg-onglet-file [role="alert"]')?.textContent?.trim() || '' }));
    const ev = (await api('journal')).events || [], adapt = ev.filter(e => e.type === 'adapter-result').map(e => e.action);
    return { v, signal, dureeMs: Date.now() - t0, chargements, erreurs, adapt, maquette: await esv.evaluate(() => window.__maquette.journal.filter(x => x.type === 'cut-charge').map(x => x.raison)),
      tentatives: ev.filter(e => e.type === 'file-parties-changement' && !e.retour), echecs: ev.filter(e => e.type === 'file-parties-changement-echec') };
  } finally { await ctx.close().catch(() => {}); await serveur.fermer(); fs.rmSync(ext, { recursive: true, force: true }); }
}
const aucuneDecisionDuGeste = r => { for (const t of r.tentatives) assert.equal(t.sansDecision, true, 'la réponse de la page dit : ni validation ni SKIP'); assert.ok(!r.adapt.includes('skipAndNext'), 'aucun SKIP'); };

test('sélecteur présent, gestes de l’opérateur : la file enchaîne 2 parties SANS cliquer le sélecteur ni recharger la page', { ...opts, timeout: 300000 }, async () => {
  const r = await file({ maquette: { selecteur: 1, traversee: 1 } });
  assert.equal(r.v?.etat, 'fin', JSON.stringify(r.v?.motifFin)); assert.deepEqual(r.v.bilan.map(p => p.part), [23, 24]);
  const avant = r.tentatives.filter(t => t.issue === 'ok'); assert.equal(avant.length, 1); assert.notEqual(avant[0].mode, 'lien', 'un geste a suffi : ' + JSON.stringify(r.tentatives.map(t => [t.mode, t.issue, t.raison])));
  assert.deepEqual(r.chargements.filter(p => p !== null), [], 'aucun rechargement par le sélecteur');
  assert.ok(r.maquette.some(x => /-partie$/.test(x)), 'la maquette a traversé la partie par un geste');
  aucuneDecisionDuGeste(r); assert.deepEqual(r.erreurs, []);
  console.log(`# gestes : ${JSON.stringify(r.tentatives.map(t => ({ mode: t.mode, issue: t.issue, raison: t.raison, compteur: t.compteur, goto: t.goto, dureeMs: t.dureeMs })))} ; ${Math.round(r.dureeMs / 1000)} s`);
});

test('sélecteur disparu après le départ (comme les relevés réels de 14:21 puis 14:38) : les gestes suffisent, la file enchaîne', { ...opts, timeout: 300000 }, async () => {
  const r = await file({ maquette: { selecteur: 1, traversee: 1 }, sansSelecteurApres: true });
  assert.equal(r.v?.etat, 'fin', JSON.stringify({ etat: r.v?.etat, rang: r.v?.rang, motif: r.v?.motifFin, tentatives: r.tentatives.map(t => [t.mode, t.issue, t.texte]), maquette: r.maquette.slice(-6) })); assert.deepEqual(r.v.bilan.map(p => p.part), [23, 24]);
  aucuneDecisionDuGeste(r); assert.deepEqual(r.erreurs, []);
});

test('ni geste ni sélecteur ne changent de partie : arrêt avec alerte lisible dans l’onglet « File », journal complet (3 tentatives, sélecteur avant et après)', { ...opts, timeout: 300000 }, async () => {
  const r = await file({ maquette: { selecteur: 1, traversee: 0 }, sansSelecteurApres: true });
  /* Le dernier repli (le lien) ne trouve aucune entrée : motif « selecteur-illisible », celui de la dernière tentative. */
  assert.equal(r.v?.etat, 'arret'); assert.equal(r.v.motifFin.code, 'selecteur-illisible');
  assert.equal(r.signal.mot, 'File arrêtée'); assert.match(r.signal.alerte, /le sélecteur de parties d’ESV n’offre plus la partie suivante/); assert.match(r.signal.alerte, /essayé : invalide-suivant : .* ; suivant-dernier : .* ; lien : aucune entrée vers la partie 24/);
  assert.equal(r.echecs.length, 1); assert.equal(r.echecs[0].tentatives.length, 3); assert.deepEqual({ ...r.echecs[0].selecteurAvant }, { status: 'absent', current: null, n: 0, vers: false });
  assert.ok(r.echecs[0].selecteurApres); aucuneDecisionDuGeste(r); assert.deepEqual(r.erreurs, []);
  console.log(`# échec : ${r.signal.alerte}`);
});
