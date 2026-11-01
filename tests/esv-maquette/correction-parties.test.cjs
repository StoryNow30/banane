'use strict';
/* CH-035 — L'AURORE ENTRE LES PARTIES D'UNE CONSTELLATION, extension réelle dans Chromium, ESV = maquette, chaque « Ouvrir » par un clic de Signal.
 * L'extension est une COPIE TEMPORAIRE du dépôt avec `correctionEntreParties.actif:true` (le dépôt le garde éteint). Les LOTS sont FABRIQUÉS au journal du
 * service worker (dit ici, jamais ailleurs) : `batch-started`, une décision par cut et une écriture de la deuxième passe (signal `passe-ecrite`) pour chaque
 * cut de la liste ; le sujet est le parcours entre les parties, pas le lot (le lot réel de la correction est éprouvé par correction-signal.test.cjs).
 * Prouve SUR LA MAQUETTE seulement : « Ouvrir » change de partie par le lien du sélecteur d'ESV (jamais un geste de la file, réserve de l'intégrateur du 01/11), Écho en pause pendant le
 * trajet et repris, le cut atteint ; retour en arrière ; partie déjà chargée sans changement ; panne (partie absente du sélecteur) dite, ESV reste sur sa
 * partie ; aucune écriture, aucun SKIP ; 0 erreur de console ; `correction-partie` au journal. Ne prouve rien sur un vrai ESV.
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=900000 tests/esv-maquette/correction-parties.test.cjs */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const N = require('./navigateur.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function attendre(f, quoi, n = 160, ms = 250) { for (let i = 0; i < n; i++) { const v = await f().catch(() => null); if (v) return v; await dormir(ms); } throw Error('attente dépassée : ' + quoi); }

function extensionAllumee() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ariane-aurore-'));
  for (const f of ['manifest.json', 'background.js', 'panel.html', 'panel.js']) if (fs.existsSync(path.join(N.racine, f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  for (const r of ['src', 'vendor', 'icons', 'fonts', 'datasets']) if (fs.existsSync(path.join(N.racine, r))) fs.cpSync(path.join(N.racine, r), path.join(d, r), { recursive: true });
  for (const f of fs.readdirSync(N.racine).filter(f => /\.css$/.test(f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  const S = path.join(d, 'src/settings.js'), t = fs.readFileSync(S, 'utf8'), a = 'const correctionEntreParties = Object.freeze({ actif: false,';
  assert.ok(t.includes(a), 'réglage éteint dans le dépôt'); fs.writeFileSync(S, t.replace(a, 'const correctionEntreParties = Object.freeze({ actif: true,'));
  /* AUCUN PATCH D'ADAPTATEUR : la page d'ESV est pilotée par l'adaptateur du dépôt, octet pour octet (seul le réglage change dans la copie). */
  const h = f => require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  for (const f of ['src/adapter-page.js', 'src/bridge.js', 'src/native-page.js']) assert.equal(h(path.join(d, f)), h(path.join(N.racine, f)), f + ' identique au dépôt');
  return d;
}

/* `lots` : [{ part, cuts: [...] }] dans l'ordre de la Constellation. */
async function aurore({ parties, cuts = 8, partie2 = 6, lots, jouer }) {
  const ext = extensionAllumee(), man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8')), hote = new URL(man.host_permissions[0].replace(/\*$/, ''));
  const { demarrer } = require('./serveur.cjs'), serveur = await demarrer();
  const ctx = await N.playwright().chromium.launchPersistentContext('', { executablePath: N.executable(), headless: true, viewport: { width: 1200, height: 800 },
    args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
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
    const pan = await ctx.newPage(); await pan.setViewportSize({ width: 600, height: 760 });
    pan.on('pageerror', e => erreurs.push('panneau: ' + e.message));
    pan.on('console', m => { if (m.type() === 'error') erreurs.push('panneau console: ' + m.text()); });
    await pan.goto(`chrome-extension://${id}/panel.html#automatic`); await dormir(1200);
    const api = async (action, a = {}) => { const r = await pan.evaluate(([action, a]) => chrome.runtime.sendMessage({ kind: 'panel', action, args: a }), [action, a]); if (r?.error) throw Error(action + ' : ' + r.error); return r?.result; };
    const onglets = await api('list-tabs'); await api('connect', { tabId: (onglets.find(t => /aquette/i.test(t.title)) || onglets[0]).id });
    /* FABRIQUÉ : un lot par partie (départ, décisions, écritures de la deuxième passe), puis le dernier lot clos. */
    const t0 = Date.now() - 3600e3;
    await sw.evaluate(async ({ lots, t0 }) => { let s = 0; const at = () => new Date(t0 + (s += 1000)).toISOString();
      for (const L of lots) { const B = 'aurore-B' + L.part, c0 = L.cuts[0] ?? 1;
        await store.putEvent({ eventId: 'essai-ch035-' + B, timestamp: at(), type: 'batch-started', schema: 1, batch: { id: B }, identity: { part: L.part, cut: c0 }, fabrique: 'essai CH-035' });
        for (const cut of L.cuts) await store.putEvent({ eventId: `essai-ch035-o-${B}-${cut}`, timestamp: at(), type: 'gcv1-shadow-observed', schema: 1, batchId: B, identity: { part: L.part, cut }, lotObservation: { command: { action: 'engine' }, anchorsUsed: [1, 2] }, fabrique: 'essai CH-035' });
        if (!L.cuts.length) await store.putEvent({ eventId: `essai-ch035-o-${B}-vide`, timestamp: at(), type: 'gcv1-shadow-observed', schema: 1, batchId: B, identity: { part: L.part, cut: 999 }, lotObservation: { command: { action: 'engine' }, anchorsUsed: [1, 2] }, fabrique: 'essai CH-035' });
        if (!L.cuts.length) await store.putEvent({ eventId: `essai-ch035-w-${B}-vide`, timestamp: at(), type: 'esv-observation', schema: 1, kind: 'write', status: 204, rowIndex: 999, body: { ExtractionStatus: 'valid', TreatedByOperator: true }, fabrique: 'essai CH-035' });
        for (const cut of L.cuts) await store.putEvent({ eventId: `essai-ch035-p-${B}-${cut}`, timestamp: at(), type: 'passe-differes-ecriture', schema: 1, batchId: B, identity: { part: L.part, cut }, passe: 1, resultat: 'ecrit', decal: { left: [0, 0, 30], right: [0, 0, 3] }, fabrique: 'essai CH-035' }); }
      const P = lots.at(-1).part;   /* forme d'un lot du moteur (src/engine.js), clos, rien de traité dans la page */
      engine.s.batch = { id: 'aurore-B' + P, state: 'COMPLETED', step: 'fin', scope: { part: P, start: 1, end: 2 }, processed: [], skipped: [], paused: [], interrupted: [], sequence: [], deferred: [], manuallyCompleted: [],
        activeIdentity: { part: P, cut: 1 }, lastCompletedIdentity: null, startedAt: new Date(t0).toISOString(), endedAt: new Date(t0 + 1000).toISOString() }; await engine.save(); }, { lots, t0 });
    const ids = lots.map(L => 'aurore-B' + L.part);
    await attendre(async () => { const v = await api('correction-liste', { batchIds: ids }); return v?.correction?.listes?.length === lots.length && v.correction.entreParties === true; }, 'liste de toutes les parties', 40);
    try { await pan.waitForSelector('#ui5 .sg-bascule [data-act="sg:onglet-correction"]', { timeout: 10000 }); }
    catch (e) { console.log('# signal', await pan.evaluate(() => document.getElementById('notice')?.textContent)); throw e; }
    await pan.click('#ui5 .sg-bascule [data-act="sg:onglet-correction"]');
    const ecrituresAvant = serveur.journal.ecritures.length;
    await pan.click('#ui5 .sg-onglet-corr [data-act="legacy:correction-demarrer"]');
    await attendre(async () => (await api('view')).native?.status === 'RUNNING', 'séance Écho démarrée', 60);
    /* Le journal du service worker, lu en lecture seule (l'action « journal » du panneau est refusée pendant Écho). */
    const journal = async () => ((await sw.evaluate(() => store.all('events'))) || []).slice().sort((a, b) => a.timestamp < b.timestamp ? -1 : 1);
    const ouvertures = async () => (await journal()).filter(e => e.type === 'correction-ouvrir').length;
    const maquette = () => esv.evaluate(() => { const e = window.__maquette.etat(); return { part: e.part, cut: e.cut, prets: e.railsPrets }; }).catch(() => null);
    /* Un clic sur un bouton « Ouvrir » de Signal (`sel`), puis le résultat : le cut affiché par la maquette et l'état d'Écho. */
    const ouvrir = async sel => { const n0 = await ouvertures();
      const act = await attendre(async () => { const b = await pan.$(sel); return b && !(await b.evaluate(x => x.disabled)) ? b.getAttribute('data-act') : null; }, 'bouton ' + sel, 120);
      const [, , p, c] = act.split(':'); await pan.click(sel);
      await attendre(async () => (await ouvertures()) > n0, 'ouverture journalisée ' + act, 360);
      await attendre(async () => (await api('view')).native?.status === 'RUNNING', 'Écho repris', 120);
      const m = await attendre(maquette, 'maquette lisible');
      const ev = (await journal()).filter(e => e.type === 'correction-ouvrir').at(-1);
      return { cible: { part: Number(p), cut: Number(c) }, maquette: m, ev };
    };
    const principal = '#ui5 .sg-onglet-corr .sg-actions .sg-principal[data-act^="sg:corr-ouvrir:"]';
    const r = await jouer({ ouvrir, principal, pan, api, journal, maquette });
    await pan.click('#ui5 .sg-onglet-corr [data-act="legacy:correction-terminer"]');
    await attendre(async () => (await api('view')).correction?.etat === 'terminee', 'correction terminée');
    const j = await journal();
    return { ...r, j, chargements, erreurs, ecritures: serveur.journal.ecritures.slice(ecrituresAvant), commandes: j.filter(e => e.type === 'adapter-result').map(e => e.action) };
  } finally { await ctx.close().catch(() => {}); await serveur.fermer(); fs.rmSync(ext, { recursive: true, force: true }); }
}
const controleCommun = R => {
  assert.deepEqual(R.erreurs, [], '0 erreur de console');
  assert.equal(R.ecritures.length, 0, 'aucune écriture dans ESV pendant l’Aurore : ' + JSON.stringify(R.ecritures.map(e => e.rowKey)));
  assert.ok(!R.commandes.some(a => /^(skipAndNext|validate|apply|validerMajEspace|nextWithoutDecision)/.test(a)), 'aucune pose, validation ni SKIP : ' + R.commandes.join(','));
  const fin = R.j.filter(e => e.type === 'correction-fin').at(-1); assert.ok(fin, 'bilan inscrit');
  return fin;
};

test('Aurore sur 3 parties de la maquette : suivant vers 24 puis 25, panne vers une partie absente, retour en arrière vers 23, partie déjà chargée', opts, async () => {
  const lots = [{ part: 23, cuts: [102, 105] }, { part: 24, cuts: [2, 4] }, { part: 25, cuts: [1, 3] }, { part: 27, cuts: [1] }];
  const R = await aurore({ parties: 3, lots, jouer: async ({ ouvrir, principal, pan, journal }) => {
    const pas = [];
    for (let i = 0; i < 6; i++) pas.push(await ouvrir(principal));
    const panne = await ouvrir(principal);
    const etats = await pan.$$eval('#ui5 .sg-corr-partie', l => l.map(x => [Number(x.dataset.partie), x.dataset.etat]));
    const retour = await ouvrir('#ui5 .sg-onglet-corr [data-act="sg:corr-ouvrir:23:102"]');
    const n0 = (await journal()).filter(e => e.type === 'correction-partie').length;
    const meme = await ouvrir('#ui5 .sg-onglet-corr [data-act="sg:corr-ouvrir:23:105"]');
    const n1 = (await journal()).filter(e => e.type === 'correction-partie').length;
    return { pas, panne, retour, meme, etats, sansChangement: n1 === n0 };
  } });
  /* Parcours : par partie, puis par cut ; chaque cut atteint dans la maquette. */
  assert.deepEqual(R.pas.map(x => [x.cible.part, x.cible.cut]), [[23, 102], [23, 105], [24, 2], [24, 4], [25, 1], [25, 3]]);
  for (const x of R.pas) assert.deepEqual([x.maquette.part, x.maquette.cut], [x.cible.part, x.cible.cut], 'cut atteint : ' + JSON.stringify(x));
  /* Panne : la partie 27 n'est pas dans le sélecteur : refus dit, ESV reste sur la partie 25. */
  assert.deepEqual([R.panne.cible.part, R.panne.cible.cut], [27, 1]); assert.equal(R.panne.ev.resultat, 'refuse'); assert.equal(R.panne.maquette.part, 25);
  /* 23 et 24 finies, 27 à faire ; 25 : « faite » (tous ses cuts vus) ou « en cours » si Écho a déjà rouvert la visite de 25:3 après la reprise
   * (la reprise ouvre une nouvelle période ; l'instant où la visite démarre ne dépend pas d'Ariane). */
  assert.deepEqual(R.etats.filter(([p]) => p !== 25), [[23, 'faite'], [24, 'faite'], [27, 'a-faire']], 'état par partie dans Signal');
  assert.ok(['faite', 'en-cours'].includes(R.etats.find(([p]) => p === 25)?.[1]), 'partie 25 : ' + JSON.stringify(R.etats));
  assert.deepEqual([R.retour.maquette.part, R.retour.maquette.cut], [23, 102], 'retour en arrière');
  assert.deepEqual([R.meme.maquette.part, R.meme.maquette.cut], [23, 105]); assert.ok(R.sansChangement, 'partie déjà chargée : aucun changement de partie');
  const cp = R.j.filter(e => e.type === 'correction-partie');
  assert.deepEqual(cp.map(e => [e.de, e.vers, e.resultat]), [[23, 24, 'ok'], [24, 25, 'ok'], [25, 27, 'echec'], [25, 23, 'ok']]);
  assert.deepEqual(cp.filter(e => e.resultat === 'ok').map(e => e.mode), ['lien', 'lien', 'lien'], 'le lien seul, vers la suivante comme en arrière (réserve de l’intégrateur)'); assert.equal(cp[2].motif, 'selecteur-illisible');
  const fin = controleCommun(R);
  const visites = new Set(fin.lignes.filter(l => l.visites > 0).map(l => l.part + ':' + l.cut));
  for (const x of R.pas) assert.ok(visites.has(x.cible.part + ':' + x.cible.cut), 'visite Écho du cut ' + JSON.stringify(x.cible));
  console.log(`# Aurore 3 parties : changements ${JSON.stringify(cp.map(e => ({ de: e.de, vers: e.vers, resultat: e.resultat, mode: e.mode, dureeMs: e.dureeMs })))} ; chargements ${JSON.stringify(R.chargements)}`);
});

/* Forme de la liste de la file de 4 parties du 31/10 (tools/aurore-parties.cjs liste, banane-data) : 1, 24, 0 et 3 cuts. Les numéros réels sont ramenés
 * dans la maquette (rang conservé) ; la forme (parties, nombre de cuts par partie, partie vide, saut d'une partie) est celle de la file réelle. */
test('forme de la file du 31/10 (1, 24, 0, 3 cuts sur 4 parties) : le parcours atteint les 28 cuts, saut de la partie vide par le lien', opts, async () => {
  const lots = [{ part: 23, cuts: [104] }, { part: 24, cuts: Array.from({ length: 24 }, (_, i) => i + 1) }, { part: 25, cuts: [] }, { part: 26, cuts: [2, 5, 7] }];
  const R = await aurore({ parties: 4, partie2: 26, lots, jouer: async ({ ouvrir, principal, pan }) => {
    const pas = [];
    for (let i = 0; i < 40; i++) { if (!(await pan.$(principal))) break; pas.push(await ouvrir(principal)); }
    return { pas };
  } });
  const attendu = lots.flatMap(L => L.cuts.map(c => [L.part, c]));
  assert.deepEqual(R.pas.map(x => [x.cible.part, x.cible.cut]), attendu, 'ordre partie puis cut, 28 cuts');
  assert.deepEqual(R.pas.map(x => [x.maquette.part, x.maquette.cut]), attendu, 'chaque cut atteint dans la maquette');
  const cp = R.j.filter(e => e.type === 'correction-partie');
  assert.deepEqual(cp.map(e => [e.de, e.vers, e.resultat]), [[23, 24, 'ok'], [24, 26, 'ok']]);
  assert.deepEqual(cp.map(e => e.mode), ['lien', 'lien'], 'le lien seul, y compris vers la partie suivante');
  controleCommun(R);
  console.log(`# forme du 31/10 : ${R.pas.length} cuts atteints ; changements ${JSON.stringify(cp.map(e => ({ de: e.de, vers: e.vers, mode: e.mode, dureeMs: e.dureeMs })))}`);
});
