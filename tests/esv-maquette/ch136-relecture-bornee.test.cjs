'use strict';
/* CH-136 — SCÉNARIO DE TERRAIN « relecture bornée » (D-366, D-367), extension réelle dans Chromium, ESV = maquette (outils : ch109-outils.cjs).
 * Constellation d'une partie (23, 12 cuts) : dès qu'un cut de la relecture est relu, l'opérateur met la relecture en PAUSE (bouton du panneau), puis
 * la reprend du cut proposé au même cut (« Reprendre du cut A au cut A »). Ce qui est prouvé sur la maquette : la pause tient, la reprise bornée part,
 * les cuts hors des bornes ne sont ni relus ni écrits (aucune validation, jamais SKIP), le journal les liste (`relecture-bornes`) et la fin les compte.
 * Ne prouve rien sur le vrai ESV.
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=900000 tests/esv-maquette/ch136-relecture-bornee.test.cjs */
const { test } = require('node:test'), assert = require('node:assert/strict');
const N = require('./navigateur.cjs'), { constellation } = require('./ch109-outils.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};

test('CH-136 · relecture en pause puis reprise bornée : hors des bornes ni relu ni écrit, compté « non relu », jamais SKIP', opts, async () => {
  const geste = async c => { const r = c.vb?.relecture;
    if (!c.fait.pauseDemandee && r?.etat === 'en-cours' && r.faits >= 1) { c.fait.pauseDemandee = { s: c.sec(), cut: r.cut }; await c.api('relecture-pause').catch(e => { c.fait.erreurPause = e.message; }); }
    if (c.fait.pauseDemandee && !c.fait.reprise && r?.etat === 'en-pause') {
      const e = await c.api('relecture-etat'), B = e?.passe?.bornesProposees;
      c.fait.pause = { cut: r.cut, faits: r.faits, total: r.total, bornes: B };
      if (!B) { c.fait.reprise = { erreur: 'aucune borne proposée' }; return; }
      c.fait.ecritsAvant = c.serveur.journal.ecritures.length;
      try { await c.api('relecture-reprendre', { debut: B.debut, fin: B.debut }); c.fait.reprise = { debut: B.debut, fin: B.debut, s: c.sec() }; } catch (x) { c.fait.reprise = { erreur: x.message }; } } };
  const r = await constellation({ n: 1, parties: 3, cuts: 12, toursMax: 400, pendant: geste,
    finSi: c => { if (c.fait.reprise && Number.isInteger(c.fait.ecritsAvant)) c.fait.ecritsApres = c.serveur.journal.ecritures.slice(c.fait.ecritsAvant).map(e => e.body?.ExtractionStatus ?? null);
      return c.fait.reprise && ['finie', 'arretee', 'erreur'].includes(c.vb?.relecture?.etat); } });
  assert.ok(r.fait.pause, 'pause tenue : ' + JSON.stringify(r.trace.slice(-6)));
  assert.ok(r.fait.reprise && !r.fait.reprise.erreur, 'reprise bornée acceptée : ' + JSON.stringify(r.fait.reprise));
  const bo = r.ev.filter(e => e.type === 'relecture-bornes');
  assert.equal(bo.length, 1, 'un relevé des bornes'); assert.equal(bo[0].quand, 'reprise'); assert.equal(bo[0].debut, r.fait.reprise.debut);
  const reprise = r.ev.find(e => e.type === 'relecture-reprise'), tR = Date.parse(reprise.timestamp);
  const relusApres = r.ev.filter(e => e.type === 'relecture-ombre' && Date.parse(e.timestamp) > tR).map(e => e.identity?.cut);
  assert.ok(relusApres.every(c => c === r.fait.reprise.debut), 'après la reprise, seul le cut borné est relu : ' + relusApres);
  for (const c of bo[0].cuts) assert.ok(!relusApres.includes(c), `cut ${c} hors des bornes jamais relu`);
  const fin = r.ev.filter(e => e.type === 'relecture-fin').at(-1);
  assert.ok(fin, 'relecture close'); assert.equal(fin.horsBornes ?? 0, bo[0].ecartes, 'la fin compte les cuts hors des bornes');
  assert.ok((r.fait.ecritsApres || []).filter(x => x === 'valid').length <= 1, 'au plus une validation après la reprise (le seul cut borné) : ' + JSON.stringify(r.fait.ecritsApres));
  assert.ok(!r.commandes.includes('skipAndNext'), 'aucun SKIP');
  assert.deepEqual(r.erreurs, []);
  console.log(`# pause au cut ${r.fait.pause.cut} (${r.fait.pause.faits}/${r.fait.pause.total}) ; bornes proposées ${JSON.stringify(r.fait.pause.bornes)} ; reprise ${r.fait.reprise.debut}→${r.fait.reprise.fin} ; écartés ${bo[0].ecartes} (${bo[0].cuts}) ; relus après ${relusApres} ; fin ${fin.issue} « ${String(fin.raison).slice(0, 160)} »`);
});
