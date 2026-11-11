'use strict';
/* CH-109 — CONSTELLATION ET RELECTURE APRÈS UN F5, extension réelle dans Chromium, ESV = maquette (outils : ch109-outils.cjs). Constellation de 2 parties
 * (23, 24), 12 cuts ; F5 de la page ESV dès qu'un cut de la relecture de la partie 23 est relu. Les réglages de CH-109 sont livrés à l'ancien défaut :
 * l'extension est une COPIE TEMPORAIRE où ils sont allumés (A : `relecturePause.defautActif`, B : `file.relecturePauseMaxMs`).
 *   1. Livré (constat du 11/11) : la relecture s'arrête en erreur au F5, rien ne la reprend.
 *   2. A : la relecture passe en pause au cut où elle était ; le panneau dit « Reprendre la relecture au cut N » ; après « Connecter » et « Reprendre »,
 *      elle repart à ce cut (jamais un cut relu deux fois) et la file finit ses deux parties.
 *   3. A + B (20 s) : l'opérateur reconnecte ESV mais ne reprend pas : la relecture est close « interrompue » au bout du délai, ses cuts non relus au
 *      bilan, la file passe à la partie 24 et finit. Aucun SKIP, rien d'écrit sur les cuts non relus.
 * Ne prouve rien sur le vrai ESV.
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=900000 tests/esv-maquette/ch109-constellation-relecture.test.cjs */
const { test } = require('node:test'), assert = require('node:assert/strict');
const N = require('./navigateur.cjs'), { constellation } = require('./ch109-outils.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};
const A = ["const relecturePause = Object.freeze({ defautActif: false, defautF5: 'pause' });", "const relecturePause = Object.freeze({ defautActif: true, defautF5: 'pause' });"];
const B = ms => ['repriseApresRechargement: true, relecturePauseMaxMs: null });', `repriseApresRechargement: true, relecturePauseMaxMs: ${ms} });`];
/* F5 dès le premier cut relu de la partie 23 ; ensuite `apres(c)` (l'opérateur). */
const f5 = apres => async c => { const r = c.vb?.relecture;
  if (!c.fait.f5 && r?.etat === 'en-cours' && r.faits >= 1) { c.fait.f5 = { s: c.sec(), cut: r.cut }; await c.esv.reload().catch(() => {}); return; }
  if (c.fait.f5 && apres) await apres(c); };
const relecture = r => r.ev.filter(e => /^relecture-(debut|fin|pause|reprise)$/.test(e.type));
const sansSkip = r => assert.ok(!r.commandes.includes('skipAndNext'), 'aucun SKIP');

test('CH-109 · réglages livrés : F5 pendant la relecture d’une partie de Constellation, la relecture s’arrête en erreur et ne reprend pas', opts, async () => {
  const r = await constellation({ n: 2, parties: 3, cuts: 12, partie2: 6, toursMax: 200, pendant: f5(null) });
  const fins = relecture(r).filter(e => e.type === 'relecture-fin');
  assert.equal(fins[0]?.issue, 'erreur', JSON.stringify(fins)); assert.match(fins[0].raison, /sans réponse/);
  assert.equal(relecture(r).filter(e => e.type === 'relecture-pause').length, 0);
  assert.equal(r.v.file.bilan[0].relecture.issue, 'erreur');
  sansSkip(r);
  console.log(`# livré : F5 au cut ${r.fait.f5.cut} (${r.fait.f5.s} s) ; file ${r.v.file.etat} ${r.v.file.motifFin?.code} ; bilan ${JSON.stringify(r.v.file.bilan.map(p => [p.part, p.relecture?.issue ?? null]))}`);
});

test('CH-109 · A : F5 pendant la relecture, pause au bon cut, le panneau le dit ; « Reprendre » repart à ce cut et la file finit', opts, async () => {
  const r = await constellation({ n: 2, parties: 3, cuts: 12, partie2: 6, remplacer: [A], toursMax: 400, pendant: f5(async c => {
    const p = c.vb?.relecture;
    if (!c.fait.pause && p?.etat === 'en-pause') { c.fait.pause = { cut: p.cut, s: c.sec() };
      await c.pan.waitForFunction(() => { const l = document.getElementById('relecture-pause-ligne'); return l && !l.hidden && l.textContent; }, null, { timeout: 15000 }).catch(() => {});
      c.fait.panneau = await c.pan.evaluate(() => ({ ligne: document.getElementById('relecture-pause-ligne')?.textContent ?? null })); }
    if (c.fait.pause && !c.fait.reprise && c.sec() - c.fait.pause.s >= 3) { c.fait.reprise = true;
      const o = await c.api('list-tabs'); await c.api('connect', { tabId: (o.find(t => /aquette/i.test(t.title)) || o[0]).id });
      /* ESV reconnectée : le bouton « Reprendre » nomme le cut gardé (grisé et sans cut tant qu'ESV ne répond pas). */
      await c.pan.waitForFunction(() => { const b = document.getElementById('relecture-reprendre'); return b && !b.hidden && !b.disabled; }, null, { timeout: 15000 }).catch(() => {});
      c.fait.panneau.bouton = await c.pan.evaluate(() => document.getElementById('relecture-reprendre')?.textContent ?? null);
      for (let i = 0; i < 20; i++) { try { await c.api('relecture-reprendre'); c.fait.repris = c.sec(); break; } catch (e) { c.fait.refus = e.message; await new Promise(x => setTimeout(x, 1000)); } } } }) });
  const ev = relecture(r), pause = ev.find(e => e.type === 'relecture-pause'), reprise = ev.find(e => e.type === 'relecture-reprise');
  assert.ok(pause, 'pause au F5 : ' + JSON.stringify(ev.map(e => [e.type, e.issue, e.raison])));
  assert.equal(pause.raison, 'esv'); assert.equal(pause.cut, r.fait.f5.cut, 'pause au cut où elle était');
  assert.match(r.fait.panneau.bouton, new RegExp(`Reprendre la relecture au cut ${pause.cut}\\b`), 'le panneau dit le cut de reprise');
  assert.match(r.fait.panneau.ligne, new RegExp(`ESV ne répond plus : relecture gardée en pause au cut ${pause.cut}\\b`));
  assert.ok(reprise, 'reprise : ' + r.fait.refus); assert.equal(reprise.cut, pause.cut, 'reprise au cut gardé');
  const relus = r.ev.filter(e => e.type === 'relecture-ombre' && e.identity?.part === 23).map(e => e.identity.cut);
  assert.equal(new Set(relus).size, relus.length, 'chaque cut relu une fois : ' + relus);
  assert.equal(ev.filter(e => e.type === 'relecture-fin')[0]?.issue, 'fin');
  /* La partie 24 de la maquette : sa relecture n'est pas le sujet (elle finit en erreur sur la maquette, même sans F5). */
  assert.equal(r.v.file.etat, 'fin', JSON.stringify(r.v.file.motifFin)); assert.equal(r.v.file.bilan[0].relecture?.issue, 'finie'); assert.deepEqual(r.v.file.bilan.map(p => p.part), [23, 24]);
  sansSkip(r);
  console.log(`# A : F5 au cut ${r.fait.f5.cut} ; pause au cut ${pause.cut} ; panneau « ${r.fait.panneau.bouton} » ; reprise au cut ${reprise.cut} ; relus partie 23 : ${relus} ; file ${r.v.file.etat}`);
});

test('CH-109 · A + B : relecture en pause non reprise, close « interrompue » au délai, cuts non relus au bilan, la file passe à la partie suivante', opts, async () => {
  const r = await constellation({ n: 2, parties: 3, cuts: 12, partie2: 6, remplacer: [A, B(20000)], toursMax: 400, pendant: f5(async c => {
    const p = c.vb?.relecture;
    if (!c.fait.pause && p?.etat === 'en-pause') c.fait.pause = { cut: p.cut, s: c.sec() };
    /* L'opérateur reconnecte ESV après son F5, mais ne reprend pas la relecture. */
    if (c.fait.pause && !c.fait.connecte && c.sec() - c.fait.pause.s >= 3) { c.fait.connecte = true; const o = await c.api('list-tabs'); await c.api('connect', { tabId: (o.find(t => /aquette/i.test(t.title)) || o[0]).id }); }
    if (!c.fait.close && p?.etat === 'arretee' && /interrompue/.test(p.message || '')) c.fait.close = { s: c.sec(), message: p.message }; }) });
  const ev = relecture(r), pause = ev.find(e => e.type === 'relecture-pause'), fin = ev.find(e => e.type === 'relecture-fin');
  assert.ok(pause && pause.raison === 'esv', JSON.stringify(ev.map(e => [e.type, e.issue, e.raison])));
  assert.equal(fin.issue, 'interrompue'); assert.ok(fin.nonRelus.includes(pause.cut), 'le cut gardé est non relu : ' + fin.nonRelus);
  const delai = (Date.parse(fin.timestamp) - Date.parse(pause.timestamp)) / 1000;
  assert.ok(delai >= 20 && delai < 30, 'close au délai (20 s) : ' + delai);
  const b0 = r.v.file.bilan[0];
  assert.equal(b0.relecture.issue, 'interrompue'); assert.deepEqual(b0.relecture.nonRelus, fin.nonRelus);
  assert.ok(b0.motifs.includes('relecture-arretee'));
  assert.equal(r.v.file.etat, 'fin', JSON.stringify(r.v.file.motifFin)); assert.deepEqual(r.v.file.bilan.map(p => p.part), [23, 24]);
  /* Rien n'est écrit sur les cuts non relus après la pause : aucune correction de la relecture de la partie 23 sur eux. */
  assert.equal(r.ev.filter(e => e.type === 'relecture-ombre' && e.identity?.part === 23 && fin.nonRelus.includes(e.identity.cut)).length, 0);
  sansSkip(r);
  console.log(`# A+B : pause au cut ${pause.cut} ; close après ${delai} s ; non relus ${fin.nonRelus} ; file ${r.v.file.etat} ; message « ${r.fait.close?.message} »`);
});
