'use strict';
/* CH-051 — GARDE « SÉRIE DE CAPTURES VIDES », extension réelle dans Chromium, ESV = maquette. L'extension est une COPIE TEMPORAIRE du dépôt avec
 * `file.actif:true` (la Constellation, qui sait reprendre un lot après un rechargement, CH-043 ; livrée allumée depuis D-268) et `lot.serieCapturesVides`
 * ALLUMÉE (seuil 3, attente 300 ms) ; le dépôt garde la garde coupée. La maquette rend des nœuds vides sur cinq cuts consécutifs (panne `nuageVide`), comme pendant
 * le blocage du chargeur d'ESV du 04/11. Prouve, SUR LA MAQUETTE seulement : au troisième cut vide la garde attend et recapture, puis recharge la
 * page ; la Constellation reprend le lot seule ; les cuts vides suivants sont différés sans attente ; le premier cut plein referme la série ; la file
 * finit ; aucun SKIP, aucune pose en plus. Ne prouve rien sur le vrai ESV (le déblocage du chargeur par un F5 y reste SUPPOSÉ).
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=600000 tests/esv-maquette/serie-captures-vides.test.cjs */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const N = require('./navigateur.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};
const dormir = ms => new Promise(r => setTimeout(r, ms));
const LOT_ARGS = { testConfirmed: true, allowNavigationEvidence: true, lowConfidence: 'attempt', unresolvedPolicy: 'defer', lotDecision: 'apply', geometryEngine: 'geometry-candidate-v1' };
const VIDES = [102, 103, 104, 105, 106];

function extensionAllumee() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ariane-serie-'));
  for (const f of ['manifest.json', 'background.js', 'panel.html', 'panel.js']) if (fs.existsSync(path.join(N.racine, f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  for (const r of ['src', 'vendor', 'icons', 'fonts', 'datasets']) if (fs.existsSync(path.join(N.racine, r))) fs.cpSync(path.join(N.racine, r), path.join(d, r), { recursive: true });
  for (const f of fs.readdirSync(N.racine).filter(f => /\.css$/.test(f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  const S = path.join(d, 'src/settings.js');
  let t = fs.readFileSync(S, 'utf8');
  const a = 'const file = Object.freeze({ actif: false,', b = 'serieCapturesVides: Object.freeze({ actif: false, seuil: 3, attenteMs: 20000,';
  /* La file est livrée allumée depuis la test 25 (D-268) ; on l'allume si une copie l'avait éteinte. La garde, elle, est coupée dans le dépôt. */
  if (t.includes(a)) t = t.replace(a, 'const file = Object.freeze({ actif: true,'); else assert.ok(/file = (Object\.freeze\()?\{ actif: true,/.test(t), 'file de parties allumée');
  assert.ok(t.includes(b), 'garde coupée dans le dépôt');
  t = t.replace(b, 'serieCapturesVides: Object.freeze({ actif: true, seuil: 3, attenteMs: 300,');
  fs.writeFileSync(S, t);
  return d;
}

async function constellation() {
  const ext = extensionAllumee(), pw = N.playwright(), man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8')), hote = new URL(man.host_permissions[0].replace(/\*$/, ''));
  const { demarrer } = require('./serveur.cjs'), serveur = await demarrer();
  serveur.pannes({ nuageSansPoints: { cuts: VIDES } });
  const ctx = await pw.chromium.launchPersistentContext('', { executablePath: N.executable(), headless: true, viewport: { width: 1200, height: 800 }, args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const erreurs = [], chargements = [];
  try {
    await ctx.route(hote.origin + '/**', async route => { const u = new URL(route.request().url()); let c = u.pathname;
      if (c.startsWith(hote.pathname)) { const reste = c.slice(hote.pathname.length); c = '/tests/esv-maquette/' + (reste === '' || reste === 'maquette' ? 'esv.html' : reste); }
      if (c.endsWith('esv.html')) chargements.push(new Date().toISOString());
      try { await route.fulfill({ response: await route.fetch({ url: serveur.url + c + u.search }) }); } catch { erreurs.push('route ' + c); await route.abort(); } });
    for (let i = 0; i < 80 && !ctx.serviceWorkers().length; i++) await dormir(250);
    const sw = ctx.serviceWorkers()[0], id = sw.url().split('/')[2];
    sw.on('console', m => { if (m.type() === 'error') erreurs.push('sw: ' + m.text()); });
    const esv = await ctx.newPage(); esv.on('pageerror', e => erreurs.push('esv: ' + e.message));
    await esv.goto(`${hote.origin}${hote.pathname}maquette?cuts=10&debut=100&cut=100&latence=20&parties=2`);
    await esv.evaluate(() => window.__maquette.pret); await esv.waitForFunction(() => window.__maquette.etat().railsPrets);
    const pan = await ctx.newPage(); await pan.goto(`chrome-extension://${id}/panel.html#automatic`); await dormir(600);
    const api = async (action, a = {}) => { const r = await pan.evaluate(([action, a]) => chrome.runtime.sendMessage({ kind: 'panel', action, args: a }), [action, a]); if (r?.error) throw Error(action + ' : ' + r.error); return r?.result; };
    const onglets = await api('list-tabs'); await api('connect', { tabId: (onglets.find(t => /aquette/i.test(t.title)) || onglets[0]).id });
    await api('settings', { mode: 'automatic-test' });
    const t0 = Date.now(); await api('file-demarrer', { n: 1, lotArgs: LOT_ARGS });
    let v;
    for (let i = 0; i < Number(process.env.BANANE_TOURS || 600); i++) { await dormir(500); try { v = await api('file-etat'); } catch (e) { continue; } if (['fin', 'arret'].includes(v.file?.etat)) break; }
    const journal = await api('journal'), ev = (journal.events || []).slice().sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
    const vue = await api('view').catch(() => null);
    return { v, ev, vue, dureeMs: Date.now() - t0, chargements, erreurs, commandes: ev.filter(e => e.type === 'adapter-result').map(e => e.action),
      captures: ev.filter(e => e.type === 'adapter-result' && e.action === 'capture' && e.lastDetail).map(e => [e.identity?.cut, e.lastDetail.points, e.timestamp]) };
  } finally { await ctx.close().catch(() => {}); await serveur.fermer(); fs.rmSync(ext, { recursive: true, force: true }); }
}

test('série de captures vides sur la maquette : attente et recapture au 3e cut vide, rechargement de la page, reprise par la Constellation, différés sans attente, file finie', opts, async () => {
  const r = await constellation();
  const garde = r.ev.filter(e => e.type === 'serie-captures-vides').map(e => [e.identity?.cut, e.action, e.motif]);
  const reprises = r.ev.filter(e => e.type === 'file-reprise-rechargement').map(e => [e.resultat, e.motif]);
  console.log(`# ${Math.round(r.dureeMs / 1000)} s ; garde ${JSON.stringify(garde)} ; chargements ${r.chargements.length} ; reprises ${JSON.stringify(reprises)} ; lot ${JSON.stringify([r.vue?.batch?.state, r.vue?.notice?.slice(0, 120)])} ; file ${JSON.stringify([r.v.file?.etat, r.v.file?.motifFin, r.v.file?.alerte])} ; captures ${JSON.stringify(r.captures.map(c => c.slice(0, 2)))}`);
  assert.deepEqual(r.erreurs, []);
  assert.ok(!r.commandes.includes('skipAndNext'), 'aucun SKIP');
  /* Au 3e cut vide : attendre, recapturer (encore vide), puis recharger. */
  assert.ok(garde.length >= 2, 'la garde a parlé : ' + JSON.stringify(garde));
  const seuil = garde[0][0];
  assert.ok(VIDES.includes(seuil), 'le seuil tombe sur un cut sans points');
  assert.deepEqual(garde.slice(0, 2), [[seuil, 'attendre', null], [seuil, 'recharger', null]], 'au seuil : attente puis rechargement');
  assert.equal(r.captures.filter(c => c[0] === seuil).length, 3, 'le cut du seuil est capturé trois fois : capture, recapture après l’attente, puis capture par la reprise après le rechargement');
  assert.ok(r.chargements.length >= 2, 'la page ESV a été rechargée au moins une fois : ' + r.chargements.length);
  const recharge = r.ev.find(e => e.type === 'serie-captures-vides' && e.action === 'recharger');
  const reprise = r.ev.find(e => e.type === 'file-reprise-rechargement');
  assert.ok(reprise, 'la Constellation a tenté la reprise après le rechargement');
  assert.ok(!['echec', 'refus', 'abandon'].includes(reprise.resultat), 'reprise après rechargement : ' + JSON.stringify([reprise.resultat, reprise.motif]));
  /* Après la reprise : les cuts vides restants sont différés sans attente, le premier cut plein referme la série, la file finit. */
  const apres = garde.filter(([c]) => c > seuil);
  assert.ok(apres.length >= 1 && apres.every(([, action, motif]) => action === 'differer' && motif === 'serie-en-cours'), 'différés sans attente après le rechargement : ' + JSON.stringify(apres));
  assert.ok(r.captures.some(c => c[1] > 0 && c[2] > recharge.timestamp), 'un cut plein est capturé après le rechargement (le lot a repris et dépassé la série)');
  assert.equal(r.v.file?.etat, 'fin', 'file finie : ' + JSON.stringify(r.v.file?.motifFin));
  assert.equal(r.v.file?.alerte, null);
});
