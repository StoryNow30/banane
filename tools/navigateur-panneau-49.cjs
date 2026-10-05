#!/usr/bin/env node
'use strict';
// Banc U2 (et suite U1 « résumé de partie ») : le vrai panneau d'Ariane chargé
// sous origine chrome-extension:// dans Chromium réel ; backend synthétique.
// Hors verify. Aucun résultat vert si Chromium, l'extension, le refus réseau
// ou le zoom ne sont pas confirmés. Aucune page ESV n'est ouverte.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const SUPPORT = path.resolve(__dirname, '../tests/browser/u2-49');
const { fixture, installer } = require(path.join(SUPPORT, 'backend.cjs'));
const H = require(path.join(SUPPORT, 'helpers.cjs'));
const { Blocked } = H;

const SUITES = { u2: 'matrix.json', 'u1-resume': 'matrix-u1-resume.json' };
function suite(name) {
  if (!SUITES[name]) throw Error('Suite inconnue : ' + name);
  return JSON.parse(fs.readFileSync(path.join(SUPPORT, SUITES[name]))).map(f => require(path.join(SUPPORT, f)));
}
const matrix = suite('u2');
const LIMIT_MS = 7000;
const VIEWPORT = { width: 560, height: 900 };
// Refus du réseau : tout HTTP(S) passe par un mandataire local fermé (port 9),
// boucle locale comprise ; les pages sont en plus interceptées par Playwright.
const RESEAU_ARGS = ['--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>', '--host-resolver-rules=MAP * ~NOTFOUND'];

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function git(root, args) { try { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch { return null; } }

function targetInfo(root) {
  const files = ['manifest.json', 'panel.html', 'panel.js', 'panel.css'];
  for (const f of files) if (!fs.existsSync(path.join(root, f))) throw Error('Cible incomplète : ' + f);
  const optional = ['src/part-summary-49.js', 'src/storage.js'].filter(f => fs.existsSync(path.join(root, f)));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  if (manifest.manifest_version !== 3) throw Error('Cible MV3 requise');
  const html = fs.readFileSync(path.join(root, 'panel.html'), 'utf8');
  const storage = optional.includes('src/storage.js') ? fs.readFileSync(path.join(root, 'src/storage.js'), 'utf8').match(/indexedDB\.open\('([^']+)',(\d+)\)/) : null;
  return {
    folder: root, commit: git(root, ['rev-parse', 'HEAD']), tree: git(root, ['rev-parse', 'HEAD^{tree}']), gitStatus: git(root, ['status', '--porcelain']),
    version: manifest.version, name: manifest.name,
    features: { partSummary: optional.includes('src/part-summary-49.js') && html.includes('src/part-summary-49.js') },
    database: storage ? { name: storage[1], version: Number(storage[2]) } : null,
    hashes: Object.fromEntries([...files, ...optional].map(f => [f, sha(path.join(root, f))])),
  };
}

function loadPlaywright() {
  for (const p of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean)) {
    try { const resolved = require.resolve(p), pw = require(resolved); return { pw, module: resolved }; }
    catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  throw new Blocked('Playwright absent ; définir PLAYWRIGHT_MODULE');
}

const blockedRows = (scenarios, reason) => scenarios.map(s => ({ id: s.id, status: 'BLOCKED', executed: false, durationMs: null, expected: s.expected, source: s.source, reason }));

// Sonde de refus réseau : un serveur local compte les requêtes reçues. Un témoin
// Node l'atteint (le serveur fonctionne) ; la page d'extension et le service
// worker ne doivent jamais l'atteindre. Aucun hôte externe n'est sollicité.
async function sondeReseau(ctx, sw, id) {
  let hits = 0;
  const server = http.createServer((q, r) => { hits++; r.end('u2'); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/sonde-u2`;
  try {
    await fetch(url); const temoin = hits;
    const essai = async u => { try { await fetch(u, { cache: 'no-store' }); return 'ATTEINT'; } catch (e) { return 'REFUSÉ : ' + e.message; } };
    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${id}/manifest.json`);
    const depuisPage = await page.evaluate(essai, url);
    await page.close();
    const depuisServiceWorker = await sw.evaluate(essai, url);
    const recu = hits - temoin;
    return { temoinNode: temoin, depuisPage, depuisServiceWorker, requetesRecuesDuNavigateur: recu, refuse: temoin === 1 && recu === 0 };
  } finally { server.close(); }
}

// Historique synthétique dans l'IndexedDB réelle de l'origine de l'extension
// (profil jetable), écrit depuis une page de la même origine sans panel.js.
async function semerHistorique(ctx, id, db, events) {
  const page = await ctx.newPage();
  try {
    await page.goto(`chrome-extension://${id}/manifest.json`);
    return await page.evaluate(async ({ db, events }) => {
      const base = await new Promise((resolve, reject) => {
        const r = indexedDB.open(db.name, db.version);
        r.onupgradeneeded = () => { for (const n of ['clouds', 'events', 'records']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); };
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
      await new Promise((resolve, reject) => {
        const tx = base.transaction('events', 'readwrite'), st = tx.objectStore('events');
        st.clear(); for (const e of events) st.put(e, e.eventId);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
      const n = await new Promise((resolve, reject) => { const r = base.transaction('events', 'readonly').objectStore('events').count(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      base.close(); return n;
    }, { db, events });
  } finally { await page.close(); }
}

async function run(folder, { scenario, headed = false, suite: suiteName = 'u2', captures = null } = {}) {
  const all = suite(suiteName);
  const wanted = scenario ? String(scenario).split(',') : null;
  const scenarios = wanted ? all.filter(s => wanted.includes(s.id)) : all;
  if (!scenarios.length || wanted && scenarios.length !== wanted.length) throw Error('Scénario inconnu : ' + scenario);
  const report = {
    schema: 'ariane-u2-ui-2', suite: suiteName, startedAt: new Date().toISOString(), target: targetInfo(path.resolve(folder)),
    environment: { node: process.version, platform: process.platform, headed, display: process.env.DISPLAY || null, viewport: VIEWPORT },
    simulation: 'chrome.runtime.sendMessage du panneau remplacé ; états synthétiques sans géométrie ; aucun onglet ESV ; réseau HTTP(S) refusé',
    extension: { loaded: false }, browserVersion: null, scenarioLimitMs: LIMIT_MS, results: [],
  };
  if (captures) fs.mkdirSync(captures, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ariane-u2-')); let ctx;
  try {
    const { pw, module } = loadPlaywright();
    report.environment.playwrightModule = module;
    report.environment.playwrightVersion = require(path.join(path.dirname(module), 'package.json')).version;
    const executable = process.env.CHROMIUM || pw.chromium.executablePath(); report.environment.chromiumExecutable = executable;
    if (!fs.existsSync(executable)) throw new Blocked('Chromium absent : ' + executable);
    if (headed && !process.env.DISPLAY) throw new Blocked('Mode fenêtré demandé sans DISPLAY (lancer sous xvfb-run)');
    const args = ['--no-sandbox', ...(headed ? [] : ['--headless=new']), ...RESEAU_ARGS,
      `--disable-extensions-except=${report.target.folder}`, `--load-extension=${report.target.folder}`];
    report.environment.launchArgs = args; report.environment.profile = 'temporaire, neuf, supprimé après exécution';
    const launchAt = performance.now();
    ctx = await pw.chromium.launchPersistentContext(profile, { executablePath: executable, headless: !headed, viewport: VIEWPORT, timeout: 15000, args });
    await ctx.route(/^https?:\/\//, r => r.abort('blockedbyclient'));
    const sw = ctx.serviceWorkers().find(w => w.url().startsWith('chrome-extension://')) || await ctx.waitForEvent('serviceworker', { timeout: 5000 });
    const id = new URL(sw.url()).hostname;
    const runtime = await sw.evaluate(() => ({ id: chrome.runtime.id, manifest: chrome.runtime.getManifest(), userAgent: navigator.userAgent }));
    if (runtime.id !== id || runtime.manifest.version !== report.target.version || runtime.manifest.name !== report.target.name)
      throw new Blocked('Extension chargée différente de la cible');
    report.extension = { loaded: true, id, serviceWorker: sw.url(), runtimeManifest: runtime.manifest, launchDurationMs: Math.round(performance.now() - launchAt) };
    report.browserVersion = ctx.browser()?.version() || runtime.userAgent;
    report.environment.userAgent = runtime.userAgent;
    report.network = await sondeReseau(ctx, sw, id);
    if (!report.network.refuse) throw new Blocked('Refus du réseau non confirmé : ' + JSON.stringify(report.network));

    for (const s of scenarios) {
      if (s.requires && !report.target.features[s.requires]) {
        report.results.push({ id: s.id, status: 'NOT_APPLICABLE', executed: false, durationMs: null, expected: s.expected, source: s.source,
          reason: `Fonction « ${s.requires} » absente de la cible` });
        continue;
      }
      const result = { id: s.id, expected: s.expected, source: s.source, executed: false, captures: [] };
      if (s.history) {
        if (!report.target.database) throw new Blocked('Base IndexedDB de la cible introuvable dans src/storage.js');
        result.historySeeded = await semerHistorique(ctx, id, report.target.database, s.history());
      }
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.setDefaultTimeout(2000);
      const initial = s.state ? s.state() : fixture(s.mode); initial.__running = fixture('running').batch;
      await page.emulateMedia({ reducedMotion: s.reducedMotion || 'reduce', colorScheme: s.colorScheme || 'light' });
      await page.addInitScript(installer, { initial, trace: true, fault: s.fault || null });
      // Captures du panneau seulement (page chrome-extension://). Sous zoom navigateur,
      // Playwright cadre (élément, défilement) en pixels CSS sans le facteur de zoom :
      // l'image est tronquée ou blanche. On capture alors l'écran visible tel
      // qu'affiché, par CDP sans cadrage, élément visé ramené en haut.
      const capture = async (nom, cible) => {
        if (!captures) return null;
        const file = path.join(captures, `${s.id}--${nom}.png`);
        const zoom = await H.zoomLevel(page).catch(() => null);
        if (zoom !== 1) {
          if (cible) await page.locator(cible).evaluate(e => e.scrollIntoView({ block: 'start' }));
          await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
          const cdp = await ctx.newCDPSession(page);
          try { fs.writeFileSync(file, Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); }
          finally { await cdp.detach(); }
        } else if (cible) await page.locator(cible).screenshot({ path: file });
        else await page.screenshot({ path: file, fullPage: true });
        result.captures.push(path.basename(file)); return path.basename(file);
      };
      const started = performance.now(); let timer;
      try {
        const work = async () => {
          await page.goto(`chrome-extension://${id}/panel.html#${s.view}`, { waitUntil: 'load', timeout: 3000 });
          await page.waitForFunction(() => globalThis.__u2?.views > 0 && document.body.dataset.window === location.hash.slice(1), null, { timeout: 2000 });
          result.executed = true;
          // Preuves : ressources réellement chargées depuis la cible ; zoom de départ ; focus de la fenêtre.
          const resources = await page.evaluate(() => ({ url: location.href, runtimeId: chrome.runtime.id, scripts: [...document.scripts].map(x => x.src),
            styles: [...document.querySelectorAll('link[rel=stylesheet]')].map(x => x.href), synthetic: __u2.synthetic, documentHasFocus: document.hasFocus() }));
          if (resources.runtimeId !== id || !resources.scripts.includes(`chrome-extension://${id}/panel.js`) || !resources.styles.includes(`chrome-extension://${id}/panel.css`))
            throw Error('Ressources du panneau réel non confirmées');
          result.resources = resources;
          result.zoomInitial = await H.zoomLevel(page);
          if (result.zoomInitial !== 1) throw new Blocked('Zoom résiduel au départ du scénario : ' + result.zoomInitial);
          result.observation = await s.run(page, { ...H, capture });
          result.backendCalls = await page.evaluate(() => __u2.calls);
          if (errors.length) throw Error('pageerror : ' + errors.join(' ; '));
        };
        await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Budget de 7 s dépassé')), LIMIT_MS); })]);
        result.status = 'PASS';
      } catch (e) {
        result.status = e instanceof Blocked ? 'BLOCKED' : 'FAIL'; result.reason = e.message;
        try {
          result.diagnostic = await page.evaluate(() => ({ focus: document.activeElement?.id || document.activeElement?.tagName,
            notice: document.getElementById('notice')?.textContent, calls: globalThis.__u2?.calls, view: document.body.dataset.window, trace: globalThis.__u2?.trace }));
          await capture('echec');
        } catch { /* page non chargée */ }
      } finally {
        clearTimeout(timer); result.durationMs = Math.round(performance.now() - started); result.pageErrors = errors;
        // Nettoyage hors budget : zoom par origine remis à 100 %, historique vidé.
        try { if (result.executed && (await H.zoomLevel(page)) !== 1) result.zoomAfterReset = await H.zoomReset(page); } catch (e) { result.cleanupError = e.message; }
        await page.close();
        if (s.history) await semerHistorique(ctx, id, report.target.database, []);
      }
      report.results.push(result);
    }
  } catch (e) {
    report.infrastructureError = e.message;
    const done = new Set(report.results.map(r => r.id));
    report.results.push(...blockedRows(scenarios.filter(s => !done.has(s.id)), e.message));
  } finally { if (ctx) await ctx.close(); fs.rmSync(profile, { recursive: true, force: true }); }

  report.targetAfter = targetInfo(report.target.folder);
  report.targetUnchanged = JSON.stringify(report.target.hashes) === JSON.stringify(report.targetAfter.hashes) && report.target.gitStatus === report.targetAfter.gitStatus;
  const n = st => report.results.filter(x => x.status === st).length;
  report.counts = { total: report.results.length, pass: n('PASS'), fail: n('FAIL'), blocked: n('BLOCKED'), notApplicable: n('NOT_APPLICABLE'), executed: report.results.filter(x => x.executed).length };
  report.selection = scenario || 'all';
  const applicable = report.counts.total - report.counts.notApplicable;
  report.executedScopeGate = report.counts.fail === 0 && report.counts.blocked === 0 && report.counts.executed === applicable && applicable > 0 && report.targetUnchanged ? 'PASS' : 'NOT_PASSED';
  // Même tout vert ne vaut jamais acceptation U2 : décision de la direction.
  report.u2Acceptance = 'NOT_GRANTED : le banc mesure, la direction décide';
  report.finishedAt = new Date().toISOString();
  return report;
}

function options(argv) {
  const [folder, ...args] = argv;
  if (!folder || folder.startsWith('--')) throw Error('Usage : DOSSIER [--suite u2|u1-resume] [--scenario ID[,ID]] [--output JSON] [--captures DOSSIER] [--headed]');
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--headed') opts.headed = true;
    else if (['--scenario', '--output', '--suite', '--captures'].includes(a) && args[i + 1] && !args[i + 1].startsWith('--')) opts[a.slice(2)] = args[++i];
    else throw Error('Option invalide : ' + a);
  }
  return { folder, opts };
}

if (require.main === module) {
  (async () => {
    const { folder, opts } = options(process.argv.slice(2));
    const r = await run(folder, { ...opts, captures: opts.captures && path.resolve(opts.captures) });
    const out = JSON.stringify(r, null, 2) + '\n';
    if (opts.output) fs.writeFileSync(path.resolve(opts.output), out);
    process.stdout.write(out);
    // 0 : sélection exécutée sans échec ni blocage ; 1 : échec ou cible altérée ; 2 : blocage ou rien d'exécuté.
    process.exitCode = r.counts.fail || !r.targetUnchanged ? 1 : r.counts.blocked || !r.counts.executed ? 2 : 0;
  })().catch(e => { console.error(e.message); process.exitCode = 1; });
}
module.exports = { run, options, targetInfo, matrix, suite, blockedRows, LIMIT_MS, RESEAU_ARGS };
