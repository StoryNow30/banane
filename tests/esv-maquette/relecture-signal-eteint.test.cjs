'use strict';
/* CH-060 — SIGNAL D'ESV ÉTEINT PENDANT LA RELECTURE, extension réelle dans Chromium, ESV = maquette. L'extension est une COPIE TEMPORAIRE du dépôt avec
 * `relectureSignalEteint` ALLUMÉ (seuil 2 lectures), la lecture rapide sur tous les cuts (`pilote.modeRapide: 'toujours'`) ; le dépôt garde le réglage coupé.
 * La pause et la reprise de la relecture sont allumées par le panneau (réglage de l'opérateur). Dans la page de la maquette, le compteur de chargements
 * de Potree reste bloqué à 1 de plus que la réalité (comme sur le terrain, D-109) : aucune lecture ne finit au signal. Un rechargement de la page rend
 * une maquette neuve, au compteur sain. Prouve, SUR LA MAQUETTE seulement : la relecture voit le signal éteint, se met en pause au point de reprise,
 * Ariane recharge la page, la ré-équipe et reprend seule ; chaque cut est relu une fois ; après le rechargement les lectures finissent au signal ;
 * la passe finit ; aucun SKIP. Ne prouve rien sur le vrai ESV (que son rechargement rallume le signal y est mesuré, pas éprouvé ici).
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=600000 tests/esv-maquette/relecture-signal-eteint.test.cjs */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const N = require('./navigateur.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function attendre(f, quoi, n = 240, ms = 500) { for (let i = 0; i < n; i++) { const v = await f(); if (v) return v; await dormir(ms); } throw Error('attente dépassée : ' + quoi); }

function extensionAllumee() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ariane-signal-'));
  for (const f of ['manifest.json', 'background.js', 'panel.html', 'panel.js']) if (fs.existsSync(path.join(N.racine, f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  for (const r of ['src', 'vendor', 'icons', 'fonts', 'datasets']) if (fs.existsSync(path.join(N.racine, r))) fs.cpSync(path.join(N.racine, r), path.join(d, r), { recursive: true });
  for (const f of fs.readdirSync(N.racine).filter(f => /\.css$/.test(f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  const S = path.join(d, 'src/settings.js');
  let t = fs.readFileSync(S, 'utf8');
  const a = "const relectureSignalEteint = Object.freeze({ actif: false, lectures: 8, rechargementsMax: 2, attenteRepriseMs: 90000 });", b = "modeRapide: 'echantillon',";
  assert.ok(t.includes(a), 'réglage coupé dans le dépôt');assert.ok(t.includes(b), 'mode rapide « échantillon » dans le dépôt');
  t = t.replace(a, "const relectureSignalEteint = Object.freeze({ actif: true, lectures: 2, rechargementsMax: 2, attenteRepriseMs: 120000, attenteSansListeMs: 2000, silenceListeMs: 1500 });")
    .replace(b, "modeRapide: 'toujours',");
  fs.writeFileSync(S, t);
  return d;
}
/* Compteur de chargements de Potree bloqué, au PREMIER chargement de la page seulement : la maquette l'écrit (chargement, puis décompte) ; il rend sa valeur + 1. */
const BLOQUER = () => { const P = window.Potree; let v = P.numNodesLoading || 0; Object.defineProperty(P, 'numNodesLoading', { configurable: true, get: () => v + 1, set: x => { v = x; } }); return true; };

test('CH-060 · signal éteint pendant la relecture : pause au point de reprise, rechargement de la page, reprise seule, chaque cut relu une fois', opts, async () => {
  const ext = extensionAllumee();
  const man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8')), hote = new URL(man.host_permissions[0].replace(/\*$/, ''));
  const { demarrer } = require('./serveur.cjs'), serveur = await demarrer();
  const ctx = await N.playwright().chromium.launchPersistentContext('', { executablePath: N.executable(), headless: true, viewport: { width: 1200, height: 800 },
    args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const erreurs = [];
  try {
    await ctx.route(hote.origin + '/**', async route => { const u = new URL(route.request().url()); let c = u.pathname;
      if (c.startsWith(hote.pathname)) { const reste = c.slice(hote.pathname.length); c = '/tests/esv-maquette/' + (reste === '' || reste === 'maquette' ? 'esv.html' : reste); }
      try { await route.fulfill({ response: await route.fetch({ url: serveur.url + c + u.search }) }); } catch { erreurs.push('route ' + c); await route.abort(); } });
    for (let i = 0; i < 80 && !ctx.serviceWorkers().length; i++) await dormir(250);
    const sw = ctx.serviceWorkers()[0], id = sw.url().split('/')[2];
    const esv = await ctx.newPage();let chargements = 0;esv.on('load', () => { chargements++; });
    /* La maquette n'a pas de compteur d'images (`Potree.framenumber`, lu par le signal) : ajouté à CHAQUE chargement de la page, une image par rendu. */
    await esv.addInitScript(() => { const t = () => { if (window.Potree) window.Potree.framenumber = (window.Potree.framenumber || 0) + 1; requestAnimationFrame(t); }; requestAnimationFrame(t); });
    await esv.goto(`${hote.origin}${hote.pathname}maquette?cuts=80&debut=60&cut=102&latence=30`);await esv.bringToFront();
    await esv.evaluate(() => window.__maquette.pret); await esv.waitForFunction(() => window.__maquette.etat().railsPrets);
    const part = await esv.evaluate(() => window.__maquette.etat().part);
    assert.ok(await esv.evaluate(BLOQUER), 'compteur bloqué dans la page');
    const pan = await ctx.newPage(); pan.on('pageerror', e => erreurs.push('panneau: ' + e.message));
    await pan.goto(`chrome-extension://${id}/panel.html#automatic`); await dormir(1200);
    const api = async (action, a = {}) => { const r = await pan.evaluate(([action, a]) => chrome.runtime.sendMessage({ kind: 'panel', action, args: a }), [action, a]); if (r?.error) throw Error(action + ' : ' + r.error); return r?.result; };
    const onglets = await api('list-tabs'); await api('connect', { tabId: (onglets.find(t => /aquette/i.test(t.title)) || onglets[0]).id });
    await api('settings', { mode: 'automatic-test' });
    await api('relecture-pause-reglage', { actif: true, f5: 'pause' });
    /* La page d'ESV au premier plan (comme sur le poste de l'opérateur) : Chromium n'y rend des images que là ; sans images, jamais de signal. */
    await esv.bringToFront();
    const chargements0 = chargements;
    await api('start', { part, start: 102, end: 105, testConfirmed: true, allowNavigationEvidence: true, lowConfidence: 'attempt', unresolvedPolicy: 'defer', lotDecision: 'apply', geometryEngine: 'geometry-candidate-v1' });
    const evenements = async () => ((await api('journal'))?.events || []);
    /* Le lot s'arrête sur sa borne avec la dernière pose appliquée, non validée (maquette) : la relecture automatique ne part pas et le dit ; l'opérateur
     * restaure cette pose (rien n'est validé), puis « Lancer la relecture » (comme tests/esv-maquette/correction-signal.test.cjs). */
    await attendre(async () => { const v = await api('view'); return v?.batch && v.batch.state !== 'RUNNING' && !['preparation', 'en-cours', 'en-pause'].includes(v.relecture?.etat) && !['calcul', 'ecriture'].includes(v.passeDifferes?.etat); }, 'fin du lot', 240, 500);
    if ((await api('view')).applied) await api('restore');
    if (!(await evenements()).some(x => x.type === 'relecture-debut')) await api('relecture-lancer');
    /* Fin de la relecture : `relecture-fin` après son début (la pause n'en écrit pas). */
    const ev = (await attendre(async () => { const e = await evenements(); return e.some(x => x.type === 'relecture-fin' && x.issue !== 'non-lancee') ? e : null; }, 'fin de la relecture', 480, 500))
      .slice().sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    if (process.env.CH060_DUMP) { const t = {}; for (const e of ev) t[e.type] = (t[e.type] || 0) + 1; console.log(JSON.stringify(t));
      console.log(ev.filter(e => e.lastStage === 'capture-read').slice(0, 12).map(e => e.lastDetail?.lecture + ':' + e.lastDetail?.regle + ':' + JSON.stringify(e.lastDetail?.diag)).join('\n# '));
      for (const e of ev.filter(e => /^relecture-(debut|fin|ombre)/.test(e.type))) console.log(e.type, e.identity?.cut ?? '', e.total ?? '', e.issue ?? '', e.raison ?? '', e.action ?? ''); }
    const sig = ev.filter(e => e.type === 'relecture-signal-eteint'), etapes = sig.map(e => e.etape);
    assert.deepEqual(etapes, ['detecte', 'recharge', 'repris'], 'étapes : ' + JSON.stringify(sig.map(e => [e.etape, e.motif])));
    assert.equal(sig[0].action, 'recharger');assert.equal(sig[0].serie, 2);
    assert.ok(chargements > chargements0, 'la page de la maquette a été rechargée');
    const pauses = ev.filter(e => e.type === 'relecture-pause');assert.equal(pauses.length, 1);assert.equal(pauses[0].raison, 'signal');
    assert.equal(ev.filter(e => e.type === 'relecture-reprise').length, 1);
    const fin = ev.filter(e => e.type === 'relecture-fin' && e.issue !== 'non-lancee');assert.equal(fin.length, 1);assert.equal(fin[0].issue, 'fin', fin[0].raison);
    const relus = ev.filter(e => e.type === 'relecture-ombre').map(e => e.identity.cut);
    assert.equal(new Set(relus).size, relus.length, 'chaque cut relu une fois : ' + relus.join(','));
    assert.ok(relus.length >= 3, 'cuts relus avant et après le rechargement : ' + relus.join(','));
    /* Après la reprise : la page neuve lit au signal. */
    const tReprise = Date.parse(sig[2].timestamp);
    const lectures = ev.filter(e => e.type === 'adapter-progress' && e.lastStage === 'capture-read' && Date.parse(e.timestamp) > tReprise);
    assert.ok(lectures.length >= 2, 'lectures après la reprise');assert.ok(lectures.every(e => e.lastDetail?.regle === 'signal'), 'au signal après le rechargement : ' + lectures.map(e => e.lastDetail?.regle).join(','));
    const avant = ev.filter(e => e.type === 'adapter-progress' && e.lastStage === 'capture-read' && Date.parse(e.timestamp) < Date.parse(sig[0].timestamp));
    assert.ok(avant.length && avant.every(e => e.lastDetail?.regle !== 'signal'), 'aucune lecture au signal avant (compteur bloqué)');
    assert.equal(ev.filter(e => /skip/i.test(e.type) && e.type !== 'skip-ombre').filter(e => e.skipCommandSent === true).length, 0, 'aucun SKIP');
    assert.deepEqual(erreurs, []);
    console.log(`# relus ${relus.length} ; pause au cut ${pauses[0].cut} ; reprise ${Math.round((tReprise - Date.parse(sig[1].timestamp)) / 100) / 10} s après le rechargement`);
  } finally { await ctx.close(); await serveur.fermer?.(); fs.rmSync(ext, { recursive: true, force: true }); }
});
