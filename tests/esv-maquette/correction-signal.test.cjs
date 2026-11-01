'use strict';
/* CH-028 — LA CORRECTION DANS ORBITE DE BOUT EN BOUT, extension réelle dans Chromium, ESV = maquette, chaque geste par un clic de Signal.
 * Un lot court se joue ; la maquette synthétique ne produit aucun signal (la GCV2 pose tout, tous les cuts ont des appuis) : UN événement
 * `passe-differes-ecriture` est donc FABRIQUÉ au journal du service worker pour un cut du lot (dit ici, jamais ailleurs), pour que la liste ait une entrée.
 * Puis : l'onglet « Correction » apparaît (le panneau demande la liste au lot clos), « Commencer la correction » démarre une séance Écho marquée,
 * « Ouvrir » amène la maquette au cut (pause d'Écho, retour au cut, reprise), l'« opérateur » valide lui-même dans la maquette, « Terminer » inscrit
 * le bilan. Contrôles : la visite est une visite d'Écho ordinaire, la liste et le bilan sont au journal (export Orbite), Ariane n'envoie à ESV aucune
 * écriture pendant la correction (la seule écriture « valid » est celle de l'opérateur). Ne prouve rien sur le vrai ESV.
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=300000 tests/esv-maquette/correction-signal.test.cjs */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const N = require('./navigateur.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function attendre(f, quoi, n = 120, ms = 250) { for (let i = 0; i < n; i++) { const v = await f(); if (v) return v; await dormir(ms); } throw Error('attente dépassée : ' + quoi); }

test('CH-028 · correction de bout en bout par Signal : liste, séance Écho marquée, « Ouvrir », validation de l’opérateur, bilan au journal', opts, async () => {
  const man = JSON.parse(fs.readFileSync(path.join(N.racine, 'manifest.json'), 'utf8')), hote = new URL(man.host_permissions[0].replace(/\*$/, ''));
  const { demarrer } = require('./serveur.cjs'), serveur = await demarrer();
  const ctx = await N.playwright().chromium.launchPersistentContext('', { executablePath: N.executable(), headless: true, viewport: { width: 1200, height: 800 },
    args: ['--headless=new', `--disable-extensions-except=${N.racine}`, `--load-extension=${N.racine}`] });
  const erreurs = [];
  try {
    await ctx.route(hote.origin + '/**', async route => { const u = new URL(route.request().url()); let c = u.pathname;
      if (c.startsWith(hote.pathname)) { const reste = c.slice(hote.pathname.length); c = '/tests/esv-maquette/' + (reste === '' || reste === 'maquette' ? 'esv.html' : reste); }
      try { await route.fulfill({ response: await route.fetch({ url: serveur.url + c + u.search }) }); } catch { erreurs.push('route ' + c); await route.abort(); } });
    for (let i = 0; i < 80 && !ctx.serviceWorkers().length; i++) await dormir(250);
    const sw = ctx.serviceWorkers()[0], id = sw.url().split('/')[2];
    sw.on('console', m => { if (m.type() === 'error') erreurs.push('sw: ' + m.text()); });
    const esv = await ctx.newPage(); esv.on('pageerror', e => erreurs.push('esv: ' + e.message));
    await esv.goto(`${hote.origin}${hote.pathname}maquette?cuts=12&debut=100&cut=100&latence=30`);
    await esv.evaluate(() => window.__maquette.pret); await esv.waitForFunction(() => window.__maquette.etat().railsPrets);
    const part = await esv.evaluate(() => window.__maquette.etat().part);
    const pan = await ctx.newPage(); await pan.setViewportSize({ width: 600, height: 760 });
    pan.on('pageerror', e => erreurs.push('panneau: ' + e.message));
    pan.on('console', m => { if (m.type() === 'error') erreurs.push('panneau console: ' + m.text()); });
    await pan.addInitScript(() => { window.__m = []; const f = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = (m, ...r) => { if (/^(correction-|goto-cut|native-|start|apply|accept|explicit-skip)/.test(m?.action || '') && !/^native-(health|export)/.test(m.action)) window.__m.push(m.action); return f(m, ...r); }; });
    await pan.goto(`chrome-extension://${id}/panel.html#automatic`); await dormir(1200);
    const api = async (action, a = {}) => { const r = await pan.evaluate(([action, a]) => chrome.runtime.sendMessage({ kind: 'panel', action, args: a }), [action, a]); if (r?.error) throw Error(action + ' : ' + r.error); return r?.result; };
    const onglets = await api('list-tabs'); await api('connect', { tabId: (onglets.find(t => /aquette/i.test(t.title)) || onglets[0]).id });
    await api('settings', { mode: 'automatic-test' });
    await api('start', { part, start: 100, end: 105, testConfirmed: true, allowNavigationEvidence: true, lowConfidence: 'attempt', unresolvedPolicy: 'defer', lotDecision: 'apply', geometryEngine: 'geometry-candidate-v1' });
    const lot = await attendre(async () => { const v = await api('view'); return v?.batch && v.batch.state !== 'RUNNING' && !['preparation', 'en-cours', 'en-pause'].includes(v.relecture?.etat) && !['calcul', 'ecriture'].includes(v.passeDifferes?.etat) ? v.batch : null; }, 'fin du lot et de la relecture', 600, 500);
    /* Le lot s'arrête sur sa borne avec la dernière pose appliquée, non validée (maquette) : « Commencer la correction » le refuse et le dit ; l'opérateur
     * la restaure (« Restaurer » : les rails reviennent à la pose d’ESV, rien n’est validé), comme le message le propose. */
    if ((await api('view')).applied) {
      await api('correction-liste').catch(() => {});
      await assert.rejects(api('correction-liste').then(() => api('correction-demarrer')), /pose d’Ariane est appliquée/);
      await api('restore');
    }
    const journal0 = await api('journal'), cible = (journal0.events || []).find(e => e.type === 'gcv1-shadow-observed' && e.batchId === lot.id)?.identity?.cut;
    assert.ok(Number.isInteger(cible), 'un cut décidé par le lot');
    /* FABRIQUÉ : l'écriture de la deuxième passe sur ce cut (signal `passe-ecrite`), pour que la liste ait une entrée sur la maquette. */
    await sw.evaluate(({ b, part, cut }) => store.putEvent({ eventId: 'essai-ch028-' + Date.now(), timestamp: new Date().toISOString(), type: 'passe-differes-ecriture', schema: 1, batchId: b, identity: { part, cut }, passe: 1, resultat: 'ecrit', decal: { left: [0, 0, 42], right: [0, 0, 3] }, fabrique: 'essai CH-028' }), { b: lot.id, part, cut: cible });
    await api('correction-fermer').catch(() => {});   /* une liste demandée avant l'événement fabriqué est remplacée */
    await api('correction-liste');
    await pan.waitForSelector('#ui5 .sg-bascule [data-act="sg:onglet-correction"]', { timeout: 10000 });
    await pan.click('#ui5 .sg-bascule [data-act="sg:onglet-correction"]');
    await pan.waitForSelector(`#ui5 .sg-corr[data-k="c:${part}:${cible}"]`);
    await pan.click('#ui5 .sg-onglet-corr [data-act="legacy:correction-demarrer"]');
    try { await attendre(async () => (await api('view')).native?.status === 'RUNNING', 'séance Écho démarrée', 40); }
    catch (e) { const v = await api('view'); console.log('# demarrer', JSON.stringify({ c: v.correction?.etat, n: v.native?.status, nm: v.native?.message, notice: await pan.evaluate(() => [document.getElementById('notice')?.textContent, document.getElementById('correction-demarrer')?.disabled, window.__m]) })); throw e; }
    const v1 = await api('view');
    assert.equal(v1.native.correction?.id, v1.correction.id, 'séance Écho marquée par la correction');
    await esv.evaluate(() => window.__maquette.allerA(109)); await esv.waitForFunction(() => window.__maquette.etat().cut === 109);
    const ecrituresAvant = serveur.journal.ecritures.length;
    const sel = `#ui5 .sg-onglet-corr [data-act="sg:corr-ouvrir:${part}:${cible}"]`;
    await attendre(async () => !(await pan.$eval(sel, b => b.disabled).catch(() => true)), 'bouton Ouvrir actif');
    await pan.click(sel);
    try { await esv.waitForFunction(c => window.__maquette.etat().cut === c && window.__maquette.etat().railsPrets, cible, { timeout: 15000 }); }
    catch (e) { const v = await api('view'); console.log('# ouvrir', JSON.stringify({ c: v.correction?.courant, n: v.native?.status, m: v.native?.message, maq: await esv.evaluate(() => window.__maquette.etat().cut) }), JSON.stringify(await pan.evaluate(() => [window.__m, document.getElementById('correction-etat')?.textContent]))); throw e; }
    await attendre(async () => (await api('view')).native?.status === 'RUNNING', 'Écho repris après « Ouvrir »');
    await pan.waitForSelector(`#ui5 .sg-corr[data-k="c:${part}:${cible}"] .sg-statut[data-statut="en-cours"]`, { timeout: 10000 });
    /* L'opérateur valide lui-même dans ESV, SUR PLACE (Ctrl+Entrée). Constat de la maquette : « valider et suivant » y change de cut dans le même tour
     * (ESV le fait après l'écriture du serveur), et Écho rattache alors la validation à la visite du cut SUIVANT (mesuré ici, 31/10). Artefact de la
     * maquette (SUPPOSÉ) : à vérifier sur un vrai ESV avant de s'y fier. */
    await dormir(1200); await esv.bringToFront(); await esv.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {}); await esv.keyboard.press('Control+Enter'); await dormir(2000);
    /* CH-037 (défaut 2) : validé SUR PLACE, sans navigation, la visite reste ouverte dans Écho ; la ligne de Signal passe « validé » quand même
     * (étiquette provisoire du service worker, même classification qu'Écho), avant « Terminer ». */
    assert.equal(await esv.evaluate(() => window.__maquette.etat().cut), cible, 'aucune navigation après la validation sur place');
    await pan.waitForSelector(`#ui5 .sg-corr[data-k="c:${part}:${cible}"] .sg-statut[data-statut="valide"]`, { timeout: 10000 });
    await pan.click('#ui5 .sg-onglet-corr [data-act="legacy:correction-terminer"]');
    await attendre(async () => (await api('view')).correction?.etat === 'terminee', 'correction terminée');
    const j = ((await api('journal')).events || []).slice().sort((a, b) => a.timestamp < b.timestamp ? -1 : 1), de = t => j.filter(e => e.type === t);
    const listes = de('correction-liste').filter(e => e.batchId === lot.id);
    assert.ok(listes.length >= 1 && listes.length <= 2, 'la liste au journal (une seconde fois seulement parce que l’événement fabriqué l’a changée)');
    assert.ok(listes.at(-1).entrees.some(e => e.cut === cible && e.signaux.includes('passe-ecrite')));
    assert.equal(de('correction-debut').length, 1); assert.equal(de('correction-ouvrir').at(-1).resultat, 'confirme');
    const fin = de('correction-fin').at(-1), ligne = fin.lignes.find(l => l.cut === cible);
    assert.equal(ligne.statut, 'valide', 'la validation de l’opérateur, vue par Écho : ' + JSON.stringify(ligne));
    assert.match(String(ligne.label), /^VALIDATE/);
    const v2 = await api('view'), visite = (v2.native.visits || []).find(x => x.identity?.cut === cible);
    assert.ok(visite && /^VALIDATE/.test(visite.label || ''), 'une visite d’Écho ordinaire du cut');
    const ecritures = serveur.journal.ecritures.slice(ecrituresAvant).filter(e => e.body?.ExtractionStatus === 'valid');
    assert.equal(ecritures.length, 1, 'une seule écriture « valid » pendant la correction : celle de l’opérateur');
    const tous = await pan.evaluate(() => window.__m.slice()), msgs = tous.slice(tous.indexOf('correction-demarrer'));   /* le lot de l'essai est lancé avant, par l'API */
    assert.ok(!msgs.some(a => /^(apply|accept|explicit-skip|start)$/.test(a) ), 'Signal n’envoie ni pose, ni validation, ni SKIP : ' + JSON.stringify(msgs));
    assert.deepEqual(erreurs, []);
  } finally { await ctx.close().catch(() => {}); await serveur.fermer(); }
});
