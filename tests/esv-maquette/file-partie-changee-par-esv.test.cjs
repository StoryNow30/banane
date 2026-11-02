'use strict';
/* CH-039 — ESV CHANGE LUI-MÊME DE PARTIE À LA VALIDATION DU DERNIER CUT (terrain du 02/11, Constellation, partie 1). Extension réelle dans Chromium,
 * ESV = maquette avec `finPartie=rechargement` : « Load next non validated cut » sans rouge devant → écriture, `railPairUpdated`, `railPairSelected`
 * du dernier cut (vert), `newPart`, puis RECHARGEMENT de la page sur la partie suivante (port de l'extension fermé), comme relevé le 02/11.
 *  A. ESV saute de partie (panne `changementPartie {apresCut, rechargement}` : le saut est forcé, il n'attend pas le dernier rouge) : le lot se clôt
 *     « partie-changee-par-esv » (pas de `batch-error`), la file ramène ESV sur la partie du lot par le lien, puis Rattrapage et relecture de cette
 *     partie, puis la partie suivante, file finie.
 *  B. Le cas du 02/11 : un rouge DERRIÈRE le départ du lot (cut 100, lot parti de 101), le dernier rouge (103) n'a rien devant : le lot le reconnaît
 *     par la liste de la page et le valide sur place (Ctrl+Entrée) ; ESV ne change pas de partie.
 * Ce que la maquette ne prouve pas : la séquence réelle d'ESV (vue une fois, le 02/11), le délai réel du rechargement, la présence du sélecteur de
 * parties après le rechargement (le retour passe par lui), la table de la liste dans la vraie page au moment du lot.
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=600000 tests/esv-maquette/file-partie-changee-par-esv.test.cjs */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const N = require('./navigateur.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};
const dormir = ms => new Promise(r => setTimeout(r, ms));
const LOT_ARGS = { testConfirmed: true, allowNavigationEvidence: true, lowConfidence: 'attempt', unresolvedPolicy: 'defer', lotDecision: 'apply', geometryEngine: 'geometry-candidate-v1' };

function extensionAllumee() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ariane-ch039-'));
  for (const f of ['manifest.json', 'background.js', 'panel.html', 'panel.js']) if (fs.existsSync(path.join(N.racine, f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  for (const r of ['src', 'vendor', 'icons', 'fonts', 'datasets']) if (fs.existsSync(path.join(N.racine, r))) fs.cpSync(path.join(N.racine, r), path.join(d, r), { recursive: true });
  for (const f of fs.readdirSync(N.racine).filter(f => /\.css$/.test(f))) fs.copyFileSync(path.join(N.racine, f), path.join(d, f));
  const S = path.join(d, 'src/settings.js'), t = fs.readFileSync(S, 'utf8'), a = 'const file = Object.freeze({ actif: false,';
  if (t.includes(a)) fs.writeFileSync(S, t.replace(a, 'const file = Object.freeze({ actif: true,'));
  else assert.ok(/file = (Object\.freeze\()?\{ actif: true,/.test(t));
  return d;
}

async function file({ n, url, pannes = null, tours = Number(process.env.BANANE_TOURS || 600) }) {
  const ext = extensionAllumee(), pw = N.playwright(), man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8')), hote = new URL(man.host_permissions[0].replace(/\*$/, ''));
  const { demarrer } = require('./serveur.cjs'), serveur = await demarrer();
  if (pannes) serveur.pannes(pannes);
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
    const esv = await ctx.newPage(); esv.on('pageerror', e => erreurs.push('esv: ' + e.message)); esv.on('console', m => { if (m.type() === 'error') erreurs.push('esv console: ' + m.text()); });
    await esv.goto(`${hote.origin}${hote.pathname}maquette?${url}`);
    await esv.evaluate(() => window.__maquette.pret); await esv.waitForFunction(() => window.__maquette.etat().railsPrets);
    const pan = await ctx.newPage(); pan.on('pageerror', e => erreurs.push('panneau: ' + e.message)); await pan.goto(`chrome-extension://${id}/panel.html#automatic`); await dormir(600);
    const api = async (action, a = {}) => { const r = await pan.evaluate(([action, a]) => chrome.runtime.sendMessage({ kind: 'panel', action, args: a }), [action, a]); if (r?.error) throw Error(action + ' : ' + r.error); return r?.result; };
    const onglets = await api('list-tabs'); await api('connect', { tabId: (onglets.find(t => /aquette/i.test(t.title)) || onglets[0]).id });
    await api('settings', { mode: 'automatic-test' });
    const t0 = Date.now(); await api('file-demarrer', { n, lotArgs: LOT_ARGS });
    let v, trace = '';
    for (let i = 0; i < tours; i++) { await dormir(500); try { v = await api('file-etat'); } catch { continue; }
      if (process.env.BANANE_TRACE) { const vb = await api('view').catch(() => null), t = JSON.stringify([v.file?.etat, v.file?.rang, v.file?.enCours, vb?.batch?.state, vb?.batch?.stoppedAtEnd?.reason, vb?.notice?.slice(0, 140)]);
        if (t !== trace) { trace = t; console.error('# ' + Math.round((Date.now() - t0) / 1000) + ' s ' + t); } }
      if (['fin', 'arret'].includes(v.file?.etat)) break; }
    const journal = await api('journal'), ev = journal.events || [];
    return { v, ev, dureeMs: Date.now() - t0, chargements, erreurs, commandes: ev.filter(e => e.type === 'adapter-result').map(e => e.action),
      maquette: await esv.evaluate(() => ({ etat: window.__maquette.etat(), journal: window.__maquette.journal.map(e => e.type) })).catch(() => null) };
  } finally { await ctx.close().catch(() => {}); await serveur.fermer(); fs.rmSync(ext, { recursive: true, force: true }); }
}
const premier = (ev, pred) => ev.filter(pred).map(e => Date.parse(e.timestamp)).sort((a, b) => a - b)[0] ?? null;

test('A · ESV ouvre seul la partie 24 (page rechargée) après une validation : lot clos sans erreur, retour sur 23 par le lien, Rattrapage et relecture de 23, puis 24', opts, async () => {
  const r = await file({ n: 2, url: 'cuts=5&debut=100&cut=100&latence=20&parties=3&partie2=4&finPartie=rechargement&delaiRechargement=400',
    pannes: { changementPartie: { apresCut: 102, rechargement: true } } });
  const f = r.v.file, ev = r.ev;
  const p = ev.find(e => e.type === 'partie-changee-par-esv');
  assert.ok(p, 'fin de partie par ESV reconnue : ' + JSON.stringify(f?.motifFin)); assert.equal(p.cutValide, 102); assert.equal(p.partieOuverte, 24);
  const lot1 = ev.find(e => e.type === 'batch-started')?.batch?.id;
  assert.ok(!ev.some(e => e.type === 'batch-error' && e.batchId === lot1), 'aucune erreur du lot de la partie 23');
  const retour = ev.find(e => e.type === 'file-parties-retour-lot');
  assert.equal(retour?.ok, true, 'retour sur la partie du lot : ' + JSON.stringify(retour)); assert.equal(retour.vers, 23);
  assert.ok(r.chargements.indexOf('24') >= 0 && r.chargements.indexOf('23', r.chargements.indexOf('24')) > 0, 'ESV recharge sur 24, puis le lien ramène 23 : ' + JSON.stringify(r.chargements));
  /* La relecture de la partie 23 part APRÈS le retour (jamais pendant qu'ESV est sur 24). */
  const tRetour = Date.parse(retour.timestamp), tRel = premier(ev, e => /^relecture/.test(e.type) && (e.lotId === lot1 || e.batchId === lot1));
  assert.ok(tRel === null || tRel >= tRetour, 'relecture après le retour');
  assert.equal(f.etat, 'fin', 'file finie : ' + JSON.stringify(f.motifFin)); assert.equal(f.motifFin.code, 'nombre-atteint');
  assert.deepEqual(f.bilan.map(b => b.part), [23, 24]);
  assert.ok(f.bilan[0].motifs.includes('partie-changee-par-esv'), JSON.stringify(f.bilan[0]));
  assert.ok(f.bilan[0].relecture?.issue, 'relecture de la partie 23 au bilan : ' + JSON.stringify(f.bilan[0]));
  assert.ok(!r.commandes.includes('skipAndNext'), 'aucun SKIP');
  assert.deepEqual(r.erreurs, [], 'aucune erreur de console');
  if (process.env.CH039_DUMP) for (const e of ev.filter(e => /partie-changee|capture-failed|batch-error|batch-state|adapter-state-retry|file-parties|relecture-(fin|erreur|etat)|reconnexion|esv-observation/.test(e.type) && !(e.type === 'esv-observation' && e.kind !== 'esv-event')).slice(0, 80))
    console.log('# ' + e.timestamp.slice(11, 23) + ' ' + e.type + ' ' + JSON.stringify({ ...e, eventId: undefined, timestamp: undefined, sessionId: undefined, schema: undefined, type: undefined }).slice(0, 220));
  console.log(`# A : ${Math.round(r.dureeMs / 1000)} s ; chargements ${JSON.stringify(r.chargements)} ; bilan ${JSON.stringify(f.bilan.map(b => ({ part: b.part, motifs: b.motifs, relecture: b.relecture?.issue, passe: b.passe?.issue })))}`);
});

test('B · rouge derrière le départ du lot, le dernier rouge n’a rien devant : reconnu par la liste, validé sur place, ESV ne change pas de partie', opts, async () => {
  const r = await file({ n: 1, url: 'cuts=5&debut=100&cut=101&latence=20&parties=2&partie2=4&finPartie=rechargement&delaiRechargement=400' });
  const f = r.v.file, ev = r.ev;
  const fin = ev.find(e => e.type === 'batch-stopped-at-end');
  /* Le dernier rouge (103) est reconnu : validé sur place s'il est résolu, sinon différé sans rien envoyer (les deux fins de KI-069). */
  assert.ok(['dernier-cut-valide', 'dernier-cut-differe'].includes(fin?.reason), 'fin du lot : ' + JSON.stringify(fin) + ' ; ' + JSON.stringify(f?.motifFin));
  assert.ok(ev.some(e => e.type === 'dernier-cut-par-liste' && e.confirme === true && e.identity?.cut === 103), 'décision par la liste, confirmée, au cut 103');
  if (fin.reason === 'dernier-cut-valide') assert.equal(ev.find(e => e.type === 'validation-en-place')?.cut, 103);
  else assert.ok(!r.commandes.includes('validateAndNext') || ev.filter(e => e.type === 'validation-accepted').every(e => e.identity?.cut !== 103), 'rien envoyé au cut 103');
  assert.ok(!ev.some(e => e.type === 'partie-changee-par-esv'), 'ESV n’a pas changé de partie');
  assert.ok(!r.chargements.includes('24'), 'aucun rechargement sur la partie 24 : ' + JSON.stringify(r.chargements));
  assert.equal(f.etat, 'fin'); assert.equal(f.motifFin.code, 'nombre-atteint');
  assert.ok(!r.commandes.includes('skipAndNext'), 'aucun SKIP');
  assert.deepEqual(r.erreurs, [], 'aucune erreur de console');
  console.log(`# B : ${Math.round(r.dureeMs / 1000)} s ; chargements ${JSON.stringify(r.chargements)} ; maquette ${JSON.stringify(r.maquette?.etat?.statuts)}`);
});
