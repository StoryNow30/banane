'use strict';
/* CH-062 — SIGNAL D'ESV ÉTEINT PENDANT LE LOT, extension réelle dans Chromium, ESV = maquette. L'extension est une COPIE TEMPORAIRE du dépôt avec
 * `lot.signalEteint` ALLUMÉ (seuil 2 lectures), la lecture rapide sur tous les cuts (`pilote.modeRapide: 'toujours'`) ; le dépôt garde le réglage coupé.
 * Dans la page de la maquette, le compteur de chargements de Potree reste bloqué à 1 de plus que la réalité (comme sur le terrain après un HTTP 502 sur
 * une requête de points, chantiers/CH-062/rapport.md) : aucune lecture ne finit au signal. Un rechargement de la page rend une maquette neuve, au
 * compteur sain. Prouve, SUR LA MAQUETTE seulement : le lot voit le signal éteint, attend la validation prouvée d'un cut (écriture vue par
 * l'observateur), se met en pause, Ariane recharge la page, la ré-équipe et reprend le lot par « Reprendre » ; chaque cut est validé une fois ;
 * après le rechargement les lectures finissent au signal ; aucun SKIP. Ne prouve rien sur le vrai ESV.
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=600000 tests/esv-maquette/lot-signal-eteint.test.cjs */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const N = require('./navigateur.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function attendre(f, quoi, n = 240, ms = 500) { for (let i = 0; i < n; i++) { const v = await f(); if (v) return v; await dormir(ms); } throw Error('attente dépassée : ' + quoi); }

function extensionAllumee() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ariane-lot-signal-'));
  for (const f of ['manifest.json', 'background.js', 'panel.html', 'panel.js']) if (fs.existsSync(path.join(N.racine, f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  for (const r of ['src', 'vendor', 'icons', 'fonts', 'datasets']) if (fs.existsSync(path.join(N.racine, r))) fs.cpSync(path.join(N.racine, r), path.join(d, r), { recursive: true });
  for (const f of fs.readdirSync(N.racine).filter(f => /\.css$/.test(f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  const S = path.join(d, 'src/settings.js');
  let t = fs.readFileSync(S, 'utf8');
  const a = "signalEteint: Object.freeze({ actif: false, lectures: 8, rechargementsMax: 1, preuveMs: 5000, delaiAvantMs: 500, sondageMs: 500, attenteRepriseMs: 90000, ligneDeBaseEchecs: false, declencheur: 'signal', trouFraction: 0.3 }),", b = "modeRapide: 'echantillon',";
  assert.ok(t.includes(a), 'réglage coupé dans le dépôt');assert.ok(t.includes(b), 'mode rapide « échantillon » dans le dépôt');
  t = t.replace(a, "signalEteint: Object.freeze({ actif: true, lectures: 2, rechargementsMax: 1, preuveMs: 5000, delaiAvantMs: 300, sondageMs: 300, attenteRepriseMs: 120000, attenteSansListeMs: 2000, silenceListeMs: 1500, ligneDeBaseEchecs: false }),")
    .replace(b, "modeRapide: 'toujours',");
  fs.writeFileSync(S, t);
  return d;
}
/* Compteur de chargements de Potree bloqué, au PREMIER chargement de la page seulement : la maquette l'écrit (chargement, puis décompte) ; il rend sa valeur + 1. */
const BLOQUER = () => { const P = window.Potree; let v = P.numNodesLoading || 0; Object.defineProperty(P, 'numNodesLoading', { configurable: true, get: () => v + 1, set: x => { v = x; } }); return true; };

test('CH-062 · signal éteint pendant le lot : pause après une validation prouvée, rechargement de la page, reprise par « Reprendre », chaque cut validé une fois', opts, async () => {
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
    await esv.bringToFront();
    const chargements0 = chargements;
    await api('start', { part, start: 102, end: 109, testConfirmed: true, allowNavigationEvidence: true, lowConfidence: 'attempt', unresolvedPolicy: 'defer', lotDecision: 'apply', geometryEngine: 'geometry-candidate-v1' });
    const evenements = async () => ((await api('journal'))?.events || []);
    await attendre(async () => { const e = await evenements(); return e.some(x => x.type === 'lot-signal-eteint' && ['repris', 'echec'].includes(x.etape)); }, 'reprise après le rechargement', 240, 500);
    await attendre(async () => { const v = await api('view'); return v?.batch && v.batch.state !== 'RUNNING'; }, 'fin du lot', 240, 500);
    const ev = (await evenements()).slice().sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    if (process.env.CH062_DUMP) for (const e of ev.filter(e => /^(lot-signal|validation-accepted|batch-|defer-)/.test(e.type))) console.log(e.type, e.identity?.cut ?? '', e.etape ?? '', e.motif ?? '', e.state ?? '', e.type==='batch-rebased-after-reload'?JSON.stringify({cut:e.cut,atteint:e.atteint,pas:e.pas}):'');
    if (process.env.CH062_DUMP) console.log(ev.filter(e => e.type === 'adapter-result' && Date.parse(e.timestamp) > Date.parse(ev.find(x=>x.etape==='recharge').timestamp)).slice(0,12).map(e => e.action + ':' + e.identity?.cut).join(' '));
    const sig = ev.filter(e => e.type === 'lot-signal-eteint'), etapes = sig.map(e => e.etape);
    assert.deepEqual(etapes, ['detecte', 'pause', 'recharge', 'repris'], 'étapes : ' + JSON.stringify(sig.map(e => [e.etape, e.motif])));
    assert.equal(sig[0].action, 'recharger'); assert.equal(sig[0].serie, 2); assert.equal(sig[1].preuve, 'ecriture-observee');
    assert.ok(chargements > chargements0, 'la page de la maquette a été rechargée');
    const valides = ev.filter(e => e.type === 'validation-accepted').map(e => e.identity.cut);
    assert.equal(new Set(valides).size, valides.length, 'chaque cut validé une fois : ' + valides.join(','));
    assert.ok(valides.includes(sig[1].identity.cut), 'le cut de la pause est validé avant le rechargement');
    const reb = ev.find(e => e.type === 'batch-rebased-after-reload');
    assert.equal(reb.atteint, sig[1].vers, `rattaché au cut qu’ESV affichait après la validation (${sig[1].vers}), aucun sauté`);
    assert.ok(valides.some(c => c > sig[1].identity.cut), 'des cuts validés après la reprise : ' + valides.join(','));
    assert.ok(ev.some(e => e.type === 'batch-rebased-after-reload'), 'lot rattaché à la page neuve par « Reprendre »');
    const tReprise = Date.parse(sig[3].timestamp);
    const lectures = ev.filter(e => e.type === 'adapter-progress' && e.lastStage === 'capture-read' && Date.parse(e.timestamp) > tReprise);
    assert.ok(lectures.length >= 2, 'lectures après la reprise'); assert.ok(lectures.every(e => e.lastDetail?.regle === 'signal'), 'au signal après le rechargement : ' + lectures.map(e => e.lastDetail?.regle).join(','));
    const avant = ev.filter(e => e.type === 'adapter-progress' && e.lastStage === 'capture-read' && Date.parse(e.timestamp) < Date.parse(sig[0].timestamp));
    assert.ok(avant.length && avant.every(e => e.lastDetail?.regle !== 'signal'), 'aucune lecture au signal avant (compteur bloqué)');
    assert.equal(ev.filter(e => /skip/i.test(e.type) && e.type !== 'skip-ombre').filter(e => e.skipCommandSent === true).length, 0, 'aucun SKIP');
    assert.deepEqual(erreurs, []);
    const v1 = ev.find(e => e.type === 'validation-accepted' && e.identity.cut === sig[1].identity.cut), v2 = ev.find(e => e.type === 'validation-accepted' && Date.parse(e.timestamp) > tReprise);
    console.log(`# validés ${valides.join(',')} ; pause après le cut ${sig[1].identity.cut} ; reprise ${Math.round((tReprise - Date.parse(sig[2].timestamp)) / 100) / 10} s après le rechargement ; entre la validation d'avant et celle d'après ${Math.round((Date.parse(v2.timestamp) - Date.parse(v1.timestamp)) / 100) / 10} s`);
  } finally { await ctx.close(); await serveur.fermer?.(); fs.rmSync(ext, { recursive: true, force: true }); }
});
