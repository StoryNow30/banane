'use strict';
/* CH-039 — terrain du 02/11 (Constellation, partie 1, lot repris au cut 535) : au cut 3080, le DERNIER ROUGE de la partie, le compteur disait 10 restants,
 * le lot n'avait différé que 6 cuts (3 rouges étaient derrière son départ, différés par le lot précédent) : « devant » = 3, le bouton habituel est parti ;
 * ESV a validé, s'est posé sur le dernier cut (vert), a ouvert seul la partie 2 (`newPart`) et rechargé la page ; la capture suivante a échoué, le lot est
 * passé en `PAUSED_ADAPTER_UNRESPONSIVE` (`batch-error`) et la file a attendu sans Rattrapage ni relecture.
 *  1. dernier cut : les rouges derrière le départ du lot sont lus dans la table de la page, la décision est CONFIRMÉE par une seconde lecture ;
 *  2. `newPart` vu après une validation acceptée, puis la page perdue : le lot se clôt « partie-changee-par-esv », pas d'erreur ;
 *  3. la file ramène ESV sur la partie du lot (lien), puis la passe et la relecture, puis la partie suivante ; retour impossible : arrêt avec alerte.
 * Service worker réel en VM, ESV simulé ; la séquence navigateur est dans tests/esv-maquette/file-partie-changee-par-esv.test.cjs. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const F = require('../src/file-parties.js');
const { dernierCut, releveBrut, appels } = require('./helpers/dernier-cut.cjs');
const { pilote } = require('./helpers/pilote-lot.cjs');
const L = require('../src/lot-decision.js'), S = require('../src/settings.js');
const { montage, fermer } = require('./helpers/file-parties-sw.cjs');
const attendre = ms => new Promise(r => setTimeout(r, ms));
/* L'expéditeur des observations : l'onglet ESV simulé du montage (son adresse vient du montage, jamais écrite ici). */
const expediteur = async b => ({ id: 'test', tab: { id: 1 }, url: (await b.ctx.chrome.tabs.get(1)).url });
const AT = '2026-11-02T09:09:25.000Z';

/* ---------- 3. machine de la file (pure) ---------- */
function fileEnLot() {
  const sel = { status: 'ok', parts: [1, 2, 3].map(part => ({ part })) };
  let r = F.transition(null, { type: 'demarrer', id: 'f', n: 2, selecteur: sel, courante: 1, at: AT });
  r = F.transition(r.etat, { type: 'lot-demarre', lotId: 'L1', part: 1, at: AT });
  return r.etat;
}
test('machine : un lot clos « partie-changee-par-esv » est une fin de partie (classerLot)', () => {
  assert.equal(F.classerLot({ etat: 'STOPPED', stoppedAtEnd: { issue: 'sortie', reason: 'partie-changee-par-esv' } }), 'partie-changee-par-esv');
  assert.equal(F.classerLot({ etat: 'STOPPED', stoppedAtEnd: { issue: 'sortie', reason: 'navigation-other-part' } }), 'fin-normale', 'les autres sorties : inchangé');
  assert.equal(F.classerLot({ etat: 'STOPPED', stoppedAtEnd: { reason: 'partie-changee-par-esv' }, ecritureEnSuspens: true }), 'ecriture-incertaine', 'une écriture en suspens prime');
});
test('machine : fin « partie-changee-par-esv » → retour sur la partie du lot AVANT la passe ; la passe attend ; retour fait → passe puis relecture', () => {
  let r = F.transition(fileEnLot(), { type: 'lot-fin', lotId: 'L1', motif: 'partie-changee-par-esv', issue: 'sortie', at: AT });
  assert.equal(r.etat.etat, 'passe'); assert.deepEqual(r.actions, [{ type: 'retour-lot', vers: 1 }]);
  assert.equal(F.vue(r.etat).enCours.retour, true);
  assert.ok(F.transition(r.etat, { type: 'passe-fin', lotId: 'L1', issue: 'absente', at: AT }).ignore, 'pas de passe-fin avant le retour');
  assert.ok(F.transition(r.etat, { type: 'retour-lot-ok', lotId: 'autre', at: AT }).ignore, 'retour d’un autre lot ignoré');
  r = F.transition(r.etat, { type: 'retour-lot-ok', lotId: 'L1', at: AT });
  assert.equal(r.etat.etat, 'passe'); assert.equal(r.etat.partie.retourLot.fait, true);
  r = F.transition(r.etat, { type: 'passe-fin', lotId: 'L1', issue: 'finie', ecrits: 3, at: AT });
  assert.equal(r.etat.etat, 'relecture');
  r = F.transition(r.etat, { type: 'relecture-fin', lotId: 'L1', issue: 'finie', corriges: 0, faits: 4, at: AT });
  assert.equal(r.etat.etat, 'changement'); assert.deepEqual(r.actions.map(a => a.type), ['registre', 'changer-partie']);
  assert.deepEqual(r.etat.bilan[0].motifs.map(m => m.code), ['partie-changee-par-esv']);
});
test('machine : retour impossible → arrêt avec alerte « ESV a changé de partie seul ; retour impossible »', () => {
  let r = F.transition(fileEnLot(), { type: 'lot-fin', lotId: 'L1', motif: 'partie-changee-par-esv', at: AT });
  r = F.transition(r.etat, { type: 'retour-lot-echec', lotId: 'L1', detail: 'aucune entrée vers la partie 1', at: AT });
  assert.equal(r.etat.etat, 'arret'); assert.equal(r.etat.motifFin.code, 'retour-impossible');
  assert.equal(r.etat.alerte.texte, 'ESV a changé de partie seul ; retour impossible'); assert.match(r.etat.alerte.detail, /aucune entrée/);
  assert.equal(F.repriseDe(r.etat).part, 1, 'la reprise repart de la partie interrompue');
});
test('machine : redémarrage du service worker pendant le retour → le retour est rejoué', () => {
  const r = F.transition(fileEnLot(), { type: 'lot-fin', lotId: 'L1', motif: 'partie-changee-par-esv', at: AT });
  assert.deepEqual(F.reprise(r.etat, { ongletPresent: true, at: AT }).actions, [{ type: 'retour-lot', vers: 1 }]);
});

/* ---------- 1. dernier cut lu dans la liste de la page ---------- */
/* Table de la page (`liste-instantane`) : `rouges` (fonction de l'ESV simulé) → statuts 1, le reste 0 ; `total` lignes. */
function tablePage(b, total, rouges) {
  const envoyer = b.ctx.chrome.tabs.sendMessage, lectures = [];
  b.ctx.chrome.tabs.sendMessage = async (id, m) => {
    if (m?.kind !== 'liste-instantane') return envoyer(id, m);
    lectures.push(b.adapter.identity.cut);
    const st = new Array(total).fill(0); for (const c of rouges()) st[c] = 1;
    return { ok: true, tables: [{ st, fl: new Array(total).fill(0), debut: true, rompue: false, tronquee: false }] };
  };
  return lectures;
}
async function regle(mod, { rouges = [10, 11, 12, 100], traites = 8636 } = {}) {
  /* Lot factice clos au cut 100 (relevé « dernier »), puis remis en cours à la main, comme `regle` de ki069-g. */
  const { r } = await dernierCut({ mesure: i => ({ identity: i, compteur: { traites: 8639, total: 8640 } }), options: { start: 100, end: 101 } });
  const b = r.b.fonction('engine').s.batch; b.state = 'RUNNING'; b.cutStartedAt = '2020-01-01T00:00:00.000Z';
  b.scope.start = 100; b.totalReleve = { part: 23, cut: 100, total: 8640, totalSource: 'compteur', traites, at: new Date().toISOString() };
  b.skipped = []; b.manuallyCompleted = []; b.deferred = [];
  let liste = rouges.slice(); const lectures = tablePage(r.b, 8640, () => liste);
  mod?.(b, x => { liste = x; });
  const f = r.b.fonction('dernierParListe'), d1 = await f(100); await attendre(5); const d2 = await f(100);
  return { d1, d2, lectures, ev: r.b.store.events.filter(e => e.type === 'dernier-cut-par-liste'), certain: r.b.fonction('dernierCutCertain')(100) };
}
test('dernier cut par la liste : 3 rouges derrière le départ du lot, 4 restants → le cut courant est le dernier (confirmé par une seconde lecture)', async () => {
  const { d1, d2, lectures, ev, certain } = await regle();
  assert.equal(certain, null, 'la règle du compteur seule ne le voit pas (le cas du 02/11)');
  assert.equal(d1, null, 'première lecture lancée sans attendre : le lot ne ralentit pas');
  assert.equal(d2?.motif, 'dernier-invalide'); assert.equal(d2.source, 'liste'); assert.equal(d2.rougesDerriere, 3);
  assert.equal(lectures.length, 2, 'une lecture des rouges derrière, une de confirmation');
  assert.equal(ev.at(-1).confirme, true);
});
test('dernier cut par la liste : un rouge DEVANT dans la table → refusé (bouton habituel)', async () => {
  const { d2, ev } = await regle((b, poser) => poser([10, 11, 12, 100, 200]), { traites: 8635 });
  assert.equal(d2, null); assert.ok(!ev.some(e => e.confirme));
});
test('dernier cut par la liste : la table ne compte pas M − N rouges (un rouge validé à la main derrière) → refusé', async () => {
  /* Lecture de départ : 3 rouges derrière ; puis 10 est validé à la main et un rouge apparaît devant (200) : le compteur dit toujours 4 restants. */
  const { d2, ev } = await regle((b, poser) => setTimeout(() => poser([11, 12, 100, 200]), 1));
  assert.equal(d2, null); assert.equal(ev.at(-1)?.confirme, false);
});
test('dernier cut par la liste : aucun rouge derrière (lecture faite, 0) → rien ne change', async () => {
  const { d2, lectures } = await regle(null, { rouges: [100, 150], traites: 8638 });
  assert.equal(d2, null); assert.equal(lectures.length, 1, 'aucune lecture de confirmation');
});
test('dernier cut par la liste : page sans table (banc, B1 coupé) → rien ne change', async () => {
  const { r } = await dernierCut({ mesure: i => ({ identity: i, compteur: { traites: 8639, total: 8640 } }), options: { start: 100, end: 101 } });
  const b = r.b.fonction('engine').s.batch; Object.assign(b, { state: 'RUNNING', cutStartedAt: '2020-01-01T00:00:00.000Z', skipped: [], manuallyCompleted: [], deferred: [] });
  b.totalReleve = { part: 23, cut: 100, total: 8640, totalSource: 'compteur', traites: 8636, at: new Date().toISOString() };
  const f = r.b.fonction('dernierParListe'); assert.equal(await f(100), null); await attendre(5); assert.equal(await f(100), null);
});
test('lot de bout en bout : 100 validé par le bouton habituel, 101 = dernier rouge (2 rouges derrière le départ) → Ctrl+Entrée, ESV reste sur la partie', async () => {
  const traites = { 100: 8636, 101: 8637 };
  let lectures;
  const { r, view } = await dernierCut({ mesure: i => ({ identity: i, compteur: { traites: traites[i.cut] ?? 8637, total: 8640 } }),
    options: { start: 100, end: 105 },
    esv: (e, b) => { lectures = tablePage(b, 8640, () => [10, 11, ...[100, 101].filter(c => c >= e.identity.cut)]); } });
  assert.equal(appels(r, 'validate'), 1, '100 : bouton habituel'); assert.equal(appels(r, 'validateInPlace'), 1, '101 : Ctrl+Entrée');
  assert.equal(r.b.adapter.identity.cut, 101); assert.equal(view.batch.stoppedAtEnd.issue, 'dernier-cut-valide');
  assert.match(view.notice, /^Fin du lot : dernier cut à valider de la partie \(101\) validé/);
  /* Lectures de la table : celle du départ sur un vert (existante, au premier cut), celle des rouges derrière, celle de confirmation. */
  assert.equal(lectures.length, 3, JSON.stringify(lectures));
});

/* ---------- 2. ESV ouvre seul la partie suivante après une validation acceptée ---------- */
const BFCACHE = 'The page keeping the extension port is moved into back/forward cache, so the message channel is closed.';
function esvQuiChangeDePartie({ newPart = true, page = null } = {}) {
  return (esv, b) => {
    const valider = esv.validateAndNext.bind(esv); let parti = false;
    esv.validateAndNext = async (...a) => { const ev = await valider(...a);
      if (a[0]?.cut === 100) { parti = true; if (page !== null) void b.ctx.chrome.tabs.reload(1);   /* Chrome : onglet « loading » puis « complete » */
        if (newPart) await b.message({ kind: 'esv-observation', observer: 'obs-1', entries: [{ seq: 1, kind: 'esv-event', nom: 'railPairUpdated', args: ['23', 100, 'valid'], pageMs: 1 },
          { seq: 2, kind: 'esv-event', nom: 'railPairSelected', args: ['23', 101], pageMs: 2 }, { seq: 3, kind: 'esv-event', nom: 'newPart', args: ['24'], pageMs: 3 }] }, await expediteur(b)); }
      return ev; };
    const capturer = esv.capture.bind(esv);
    esv.capture = async (...a) => { if (parti) throw Error(BFCACHE); return capturer(...a); };
    const lire = esv.state.bind(esv);
    /* `page` : la page rechargée finit par afficher cette partie (la preuve quand `newPart` n'est pas arrivé). */
    let gel = 1;   /* la première lecture après la validation tombe sur la page partie ; les suivantes, sur la page rechargée */
    esv.state = async (...a) => { if (parti && (page === null || gel-- > 0)) throw Error(BFCACHE); if (parti) { esv.identity = { ...esv.identity, part: page, cut: 0, pageId: 'page-' + page }; } return lire(...a); };
  };
}
const reglages = { ...S, lot: { ...S.lot, partieChangeeParEsv: { attenteMs: 200, pollMs: 10, rechargeMs: 400, rechargePollMs: 20 } } };
test('newPart après la validation acceptée, page perdue : lot clos « partie-changee-par-esv », pas de batch-error, fin de partie constatée', async () => {
  const r = await pilote(L, { start: 100, end: 0, endMode: 'partie', settings: reglages, esv: esvQuiChangeDePartie() });
  const view = await r.b.settle(), ev = r.b.store.events;
  assert.equal(view.batch.state, 'STOPPED', view.notice); assert.equal(view.batch.stoppedAtEnd.reason, 'partie-changee-par-esv');
  assert.equal(view.batch.stoppedAtEnd.issue, 'sortie'); assert.deepEqual(view.batch.stoppedAtEnd.target, { part: 24, cut: null });
  assert.ok(!ev.some(e => e.type === 'batch-error'), 'aucune erreur de lot');
  const p = ev.find(e => e.type === 'partie-changee-par-esv'); assert.equal(p.cutValide, 100); assert.equal(p.partieOuverte, 24); assert.equal(p.cutAnnonce, 101);
  assert.match(view.notice, /^Fin du lot : après la validation du cut 100, ESV a ouvert seul la partie 24/);
  assert.equal(view.batch.processed.length, 1); assert.ok(!r.b.adapter.calls.includes('skip'), 'aucun SKIP');
});
test('même perte de page SANS newPart observé : comportement d’avant (lot « sans réponse », reprenable)', async () => {
  const r = await pilote(L, { start: 100, end: 0, endMode: 'partie', settings: reglages, esv: esvQuiChangeDePartie({ newPart: false }) });
  const view = await r.b.settle();
  assert.equal(view.batch.state, 'PAUSED_ADAPTER_UNRESPONSIVE'); assert.ok(r.b.store.events.some(e => e.type === 'batch-error'));
  assert.ok(!r.b.store.events.some(e => e.type === 'partie-changee-par-esv'));
});
test('newPart PERDU (page gelée avant l’envoi du pont), la page rechargée affiche la partie 24 : même fin de partie, preuve « page-rechargee »', async () => {
  const r = await pilote(L, { start: 100, end: 0, endMode: 'partie', settings: reglages, esv: esvQuiChangeDePartie({ newPart: false, page: 24 }) });
  const view = await r.b.settle(), p = r.b.store.events.find(e => e.type === 'partie-changee-par-esv');
  assert.equal(view.batch.state, 'STOPPED', view.notice); assert.equal(view.batch.stoppedAtEnd.reason, 'partie-changee-par-esv');
  assert.equal(p?.preuve, 'page-rechargee'); assert.equal(p.partieOuverte, 24); assert.ok(!r.b.store.events.some(e => e.type === 'batch-error'));
});

/* ---------- 3. pilote de la file (service worker réel, lot simulé) ---------- */
test.afterEach(fermer);
const cloreParEsv = M => { M.adapter.identity = { ...M.adapter.identity, part: 24, cut: 0, pageId: 'page-24' };
  M.clore({ stoppedAtEnd: { issue: 'sortie', reason: 'partie-changee-par-esv', cut: 9, target: { part: 24, cut: null }, at: new Date().toISOString() } }); };
test('file : ESV a ouvert seul la partie 24 → retour sur 23 par le lien, PUIS passe et relecture de 23, puis la partie 24', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la file');
  const lot = M.engine().s.batch; cloreParEsv(M);
  await M.jusqua(() => M.journal('file-parties-retour-lot').length, 3000, 'retour sur la partie du lot');
  const retour = M.journal('file-parties-retour-lot')[0]; assert.equal(retour.ok, true); assert.equal(retour.vers, 23);
  assert.equal(M.adapter.identity.part, 23, 'ESV ramené sur la partie du lot');
  assert.ok(lot.stoppedAtEnd.retour, 'le lot porte le retour : passe et relecture débloquées');
  await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture de la partie 23');
  M.relire();
  await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.k === 1 && M.etat()?.partie?.lotId, 3000, 'lot de la partie 24');
  const cmds = M.adapter.calls.filter(c => /^changerPartie/.test(c));
  assert.deepEqual(cmds, ['changerPartie:23', 'changerPartie:24'], 'retour (lien) puis passage');
  assert.deepEqual([...M.etat().bilan[0].motifs.map(m => m.code)], ['partie-changee-par-esv']);
  assert.ok(!M.commandesEsv().some(c => /skip/i.test(c || '')), 'aucun SKIP');
});
test('file : avant le retour, ni passe ni relecture ne sont planifiées pour ce lot', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la file');
  M.adapter.bloque = true; cloreParEsv(M);
  await M.jusqua(() => M.etat()?.etat === 'passe', 2000, 'passe (retour en attente)');
  await attendre(150);
  const lot = M.engine().s.batch;
  assert.equal(M.b.get('attendRetourPartie')(lot), true);
  assert.equal(M.b.get('relecture').planifie.has(lot.id), false, 'relecture non planifiée');
  assert.equal(M.etat().etat, 'passe', 'la passe attend (pas de passe-fin « absente » au bout de la grâce)');
});
test('file : retour impossible (la partie du lot absente du sélecteur) → file arrêtée, alerte claire', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la file');
  M.adapter.refus = 'partie-absente'; cloreParEsv(M);
  await M.jusqua(() => M.etat()?.etat === 'arret', 3000, 'arrêt');
  assert.equal(M.etat().motifFin.code, 'retour-impossible');
  assert.equal(M.etat().alerte.texte, 'ESV a changé de partie seul ; retour impossible');
  assert.match(M.etat().alerte.detail, /retour sur la partie 23 impossible/);
});
test('file : sortie de partie SUR PLACE après une validation (« navigation-other-part », KI-063) → même retour avant la passe', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la file');
  M.adapter.identity = { ...M.adapter.identity, part: 24, cut: 1 };
  M.clore({ stoppedAtEnd: { issue: 'sortie', reason: 'navigation-other-part', cut: 9, target: { part: 24, cut: 1 }, at: new Date().toISOString() } });
  await M.jusqua(() => M.journal('file-parties-retour-lot').length, 3000, 'retour sur la partie du lot');
  assert.equal(M.adapter.identity.part, 23);
  await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture de la partie 23');
  assert.deepEqual([...M.etat().partie.motifs.map(m => m.code)], ['fin-normale']);
});
test('machine : fin normale avec ESV hors de la partie (horsPartie) → retour avant la passe ; sans horsPartie → inchangé', () => {
  const r = F.transition(fileEnLot(), { type: 'lot-fin', lotId: 'L1', motif: 'fin-normale', horsPartie: true, at: AT });
  assert.deepEqual(r.actions, [{ type: 'retour-lot', vers: 1 }]);
  assert.deepEqual(F.transition(fileEnLot(), { type: 'lot-fin', lotId: 'L1', motif: 'fin-normale', at: AT }).actions, []);
});
