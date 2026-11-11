'use strict';
/* CH-109 — CONSTELLATION ET RELECTURE APRÈS UN F5, extension réelle dans Chromium, ESV = maquette (outils : ch109-outils.cjs). Constellation de 2 parties
 * (23, puis 24 de 6 cuts), 12 cuts ; F5 de la page ESV dès qu'un cut de la relecture de la partie 23 est relu.
 *   1. C, pause à l'ANCIEN défaut (copie temporaire, `relecturePause.defautActif:false`) : la relecture s'arrête en erreur au F5 (constat du 11/11) ;
 *      le changement de partie trouve la page en rechargement, attend qu'ESV revienne (au lieu de s'arrêter « esv-muet ») et la file finit.
 *   2. Réglages livrés (D-341) : la relecture passe en pause au cut où elle était, reprend SEULE à ce cut une fois la page rechargée (aucun clic),
 *      chaque cut relu une fois, puis la file change de partie seule, lance le lot de la partie 24 et finit. Aucun SKIP.
 * B (`file.relecturePauseMaxMs`, coupé, non choisi par l'opérateur) n'est essayé qu'en VM (tests/ch109-file-relecture-pause.test.cjs).
 * Ne prouve rien sur le vrai ESV.
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=900000 tests/esv-maquette/ch109-constellation-relecture.test.cjs */
const { test } = require('node:test'), assert = require('node:assert/strict');
const N = require('./navigateur.cjs'), { constellation } = require('./ch109-outils.cjs');
const raison = N.indisponible(), opts = raison ? { skip: raison } : {};
const ANCIEN = ["const relecturePause = Object.freeze({ defautActif: true, defautF5: 'pause' });", "const relecturePause = Object.freeze({ defautActif: false, defautF5: 'pause' });"];
/* F5 dès le premier cut relu de la partie 23. */
const f5 = async c => { const r = c.vb?.relecture;
  if (!c.fait.f5 && r?.etat === 'en-cours' && r.faits >= 1) { c.fait.f5 = { s: c.sec(), cut: r.cut }; await c.esv.reload().catch(() => {}); }
  if (c.fait.f5 && r?.etat === 'en-pause' && !c.fait.pause) c.fait.pause = { s: c.sec(), cut: r.cut, message: r.message }; };
const relecture = r => r.ev.filter(e => /^relecture-(debut|fin|pause|reprise)$/.test(e.type));
const sansSkip = r => assert.ok(!r.commandes.includes('skipAndNext'), 'aucun SKIP');

test('CH-109 · C (pause à l’ancien défaut) : F5 pendant la relecture, erreur ; le changement de partie attend ESV et la file finit', opts, async () => {
  const r = await constellation({ n: 2, parties: 3, cuts: 12, partie2: 6, remplacer: [ANCIEN], toursMax: 300, pendant: f5 });
  const fins = relecture(r).filter(e => e.type === 'relecture-fin');
  assert.equal(fins[0]?.issue, 'erreur', JSON.stringify(fins)); assert.match(fins[0].raison, /sans réponse/);
  const attente = r.ev.filter(e => e.type === 'file-parties-esv-attente');
  assert.equal(r.v.file.etat, 'fin', JSON.stringify(r.v.file.motifFin) + ' ' + JSON.stringify(attente)); assert.deepEqual(r.v.file.bilan.map(p => p.part), [23, 24]);
  sansSkip(r);
  console.log(`# C : F5 au cut ${r.fait.f5.cut} ; attente d'ESV au changement ${JSON.stringify(attente.map(e => [e.issue, e.ms, e.essais]))} ; file ${r.v.file.etat} ; bilan ${JSON.stringify(r.v.file.bilan.map(p => [p.part, p.issueLot, p.relecture?.issue ?? null]))}`);
});

test('CH-109 · livré (D-341) : F5 pendant la relecture, pause au bon cut, reprise SEULE à ce cut, puis la file change de partie seule et finit', opts, async () => {
  const r = await constellation({ n: 2, parties: 3, cuts: 12, partie2: 6, toursMax: 300, pendant: f5 });
  const ev = relecture(r), pause = ev.find(e => e.type === 'relecture-pause'), reprise = ev.find(e => e.type === 'relecture-reprise');
  const revenue = r.ev.filter(e => e.type === 'relecture-esv-revenue').map(e => e.etape);
  assert.ok(pause, 'pause au F5 : ' + JSON.stringify(ev.map(e => [e.type, e.issue, e.raison])));
  assert.equal(pause.raison, 'esv'); assert.equal(pause.cut, r.fait.f5.cut, 'pause au cut où elle était');
  assert.ok(reprise, 'reprise seule : ' + JSON.stringify(revenue)); assert.equal(reprise.cut, pause.cut, 'reprise au cut gardé'); assert.equal(reprise.raisonPause, 'esv');
  assert.deepEqual(revenue, ['attente', 'rechargee', 'repris']);
  const relus = r.ev.filter(e => e.type === 'relecture-ombre' && e.identity?.part === 23).map(e => e.identity.cut);
  assert.equal(new Set(relus).size, relus.length, 'chaque cut relu une fois : ' + relus);
  assert.equal(ev.filter(e => e.type === 'relecture-fin')[0]?.issue, 'fin');
  /* La partie 24 de la maquette : sa relecture n'est pas le sujet (elle finit en erreur sur la maquette, même sans F5). */
  assert.equal(r.v.file.etat, 'fin', JSON.stringify(r.v.file.motifFin)); assert.equal(r.v.file.bilan[0].relecture?.issue, 'finie'); assert.deepEqual(r.v.file.bilan.map(p => p.part), [23, 24]);
  assert.ok(r.ev.some(e => e.type === 'batch-started' && (e.scope?.part ?? e.batch?.scope?.part) === 24) || r.v.file.bilan[1].issueLot, 'lot de la partie 24 lancé');
  sansSkip(r);
  const dt = (Date.parse(reprise.timestamp) - Date.parse(pause.timestamp)) / 1000;
  console.log(`# livré : F5 au cut ${r.fait.f5.cut} ; pause au cut ${pause.cut} (« ${String(r.fait.pause?.message || '').slice(0, 90)} ») ; reprise seule au cut ${reprise.cut} ${dt} s après ; relus partie 23 : ${relus} ; file ${r.v.file.etat}`);
});
