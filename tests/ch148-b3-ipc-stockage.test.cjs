'use strict';
/* CH-148 (Lot B3) — Allègement IPC, IndexedDB et stockage :
 *  1. `BananeEtatMorceaux.diff` et `appliquerDiff` reconstruisent exactement l'état complet (`deepStrictEqual`)
 *     en omettant les morceaux lourds inchangés (`settings`, `historiqueParties`, `partsHistory`, `fileParties`, `contract`, `storage`) ;
 *  2. `BananeStorage3.prototype.putMany` écrit N entrées en une seule transaction `readwrite` et met à jour `BananeJournalIndex`,
 *     et `clear()` / `clearAll()` purge `['events', 'records', 'clouds']` en une seule transaction multi-magasins (avec repli) ;
 *  3. deux sauvegardes consécutives d'un même état de session dans `background.js` n'appellent `chrome.storage.session.set`
 *     qu'une seule fois pour la même clé/valeur (`cacheStockageCle`), et `reinitialiser-extension` remet ce cache à zéro ;
 *  4. la mémoïsation de `ui()` / `vuePanneau()` ne recalcule pas les listes inchangées (`partsHistory` / `fileParties`)
 *     entre deux polls sans nouvel événement, les met immédiatement à jour dès qu'un événement est journalisé, et supporte `{ morceaux: true, rev }` ;
 *  5. le cache éphémère de capture courante évite les 2 `store.getCloud` redondants par cut (`observeLot` + `commandLot`),
 *     et `reprisePoser` en relecture espace ses écritures `chrome.storage.local` (tous les 10 cuts, et immédiatement au 1er cut, sur correction, pause, arrêt ou erreur).
 * Toutes les données sont synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const M = require('../src/etat-morceaux.js');
const { BananeStorage3 } = require('../src/storage.js');
const JI = require('../src/journal-index.js');
const { production, memoire } = require('./helpers/perf-production.cjs');
const { MemoryStore } = require('./fixtures.cjs');
const { lotPause, H: HPause } = require('./helpers/relecture-pause.cjs');

test('CH-148 : BananeEtatMorceaux.diff et appliquerDiff reconstruisent exactement l\'état complet en omettant les blocs lourds inchangés', () => {
  assert.equal(typeof M.diff, 'function', 'BananeEtatMorceaux.diff doit exister');
  assert.equal(typeof M.appliquerDiff, 'function', 'BananeEtatMorceaux.appliquerDiff doit exister');

  const precedent = {
    schemaVersion: 4,
    mode: 'automatic-test',
    settings: { minConfidence: 70, searchY: 0.05, searchZ: 0.03 },
    partsHistory: [
      { part: 23, batchId: 'lot-1', poses: 120, differes: 4, fin: 'en-cours' },
      { part: 22, batchId: 'lot-0', poses: 310, differes: 9, fin: 'complete' },
    ],
    historiqueParties: [
      { part: 23, batchId: 'lot-1', poses: 120, differes: 4, fin: 'en-cours' },
    ],
    fileParties: { etat: 'lot', n: 3, rang: 0, plan: [23, 24, 25], bilan: [] },
    contract: { id: 'GEOMETRY_CANDIDATE_V1', geometrySha256: 'empreinte-synthetique' },
    storage: { bytesStored: 1048576, segments: 2 },
    current: { identity: { part: 23, cut: 100 } },
    batch: { id: 'lot-1', state: 'RUNNING', step: 'capture', processed: [{ cut: 100 }], deferred: [] },
    relecture: { etat: 'en-cours', faits: 5, total: 20 },
  };

  const suivant = {
    ...precedent,
    current: { identity: { part: 23, cut: 101 } },
    batch: { id: 'lot-1', state: 'RUNNING', step: 'apply', processed: [{ cut: 100 }, { cut: 101 }], deferred: [] },
  };

  const delta = M.diff(precedent, suivant);
  for (const lourd of ['settings', 'partsHistory', 'historiqueParties', 'fileParties', 'contract', 'storage', 'mode', 'schemaVersion', 'relecture']) {
    assert.equal(lourd in delta, false, `le bloc inchangé ${lourd} doit être omis du delta`);
  }
  assert.deepStrictEqual(delta.current, suivant.current);
  assert.deepStrictEqual(delta.batch, suivant.batch);

  const reconstruit = M.appliquerDiff(precedent, delta);
  assert.deepStrictEqual(reconstruit, suivant, 'reconstruction exacte (deepStrictEqual) de l\'état complet');

  /* Suppression d'une clé dans l'état suivant (ex. fin de relecture) : reconstruite à l'identique. */
  const sansRelecture = { ...suivant };
  delete sansRelecture.relecture;
  const deltaSuppr = M.diff(suivant, sansRelecture);
  const reconstruitSuppr = M.appliquerDiff(suivant, deltaSuppr);
  assert.deepStrictEqual(reconstruitSuppr, sansRelecture, 'une clé retirée disparaît aussi après appliquerDiff');
});

test('CH-148 : BananeStorage3.putMany écrit N entrées en une seule transaction readwrite et met à jour BananeJournalIndex, et clear regroupe la purge', async () => {
  assert.equal(typeof BananeStorage3.prototype.putMany, 'function', 'BananeStorage3.prototype.putMany doit exister');
  assert.equal(typeof BananeStorage3.prototype.clear, 'function', 'BananeStorage3.prototype.clear doit exister');

  const donnees = { clouds: new Map(), events: new Map(), records: new Map() };
  const transactions = [];
  const fausseDb = {
    transaction(noms, mode) {
      transactions.push({ noms, mode });
      const tx = { oncomplete: null, onerror: null, onabort: null };
      tx.objectStore = nom => ({
        put(val, cle) { donnees[nom].set(cle, structuredClone(val)); const q = { onsuccess: null, result: cle }; setImmediate(() => q.onsuccess?.()); return q; },
        get(cle) { const q = { onsuccess: null, result: structuredClone(donnees[nom].get(cle)) }; setImmediate(() => q.onsuccess?.()); return q; },
        getAll() { const tri = [...donnees[nom].keys()].sort(); const q = { onsuccess: null, result: tri.map(k => structuredClone(donnees[nom].get(k))) }; setImmediate(() => q.onsuccess?.()); return q; },
        getAllKeys() { const tri = [...donnees[nom].keys()].sort(); const q = { onsuccess: null, result: tri }; setImmediate(() => q.onsuccess?.()); return q; },
        clear() { donnees[nom].clear(); const q = { onsuccess: null }; setImmediate(() => q.onsuccess?.()); return q; },
      });
      setImmediate(() => setImmediate(() => tx.oncomplete?.()));
      return tx;
    },
  };

  const baseStore = new BananeStorage3();
  baseStore.db = fausseDb;
  const store = JI.equiper(baseStore, { types: ['validation-accepted', 'relecture-ombre'] });
  await store.indexJournal.construire();
  const txAvant = transactions.length;

  const lotEvenements = [
    { eventId: 'ev-001', type: 'validation-accepted', batchId: 'lot-1', nativeSessionId: 'S1' },
    { eventId: 'ev-002', type: 'adapter-progress', batchId: 'lot-1' },
    { eventId: 'ev-003', type: 'relecture-ombre', batchId: 'lot-1', nativeSessionId: 'S1' },
  ];
  await store.putMany('events', lotEvenements);

  assert.equal(transactions.length - txAvant, 1, 'putMany doit ouvrir exactement UNE transaction IndexedDB pour N entrées');
  assert.equal(transactions.at(-1).noms, 'events');
  assert.equal(transactions.at(-1).mode, 'readwrite');
  assert.equal(donnees.events.size, 3);

  /* BananeJournalIndex doit connaître immédiatement les événements insérés par putMany. */
  const validations = await store.lireParType(['validation-accepted']);
  assert.equal(validations.length, 1);
  assert.equal(validations[0].eventId, 'ev-001');
  const natifs = await store.lireEvenementsNatif('S1');
  assert.deepStrictEqual(natifs.map(e => e.eventId), ['ev-001', 'ev-003']);

  /* clear() regroupe la purge des 3 magasins en une seule transaction multi-stores ['events', 'records', 'clouds']. */
  donnees.records.set('r-1', { recordId: 'r-1' });
  donnees.clouds.set('c-1', { points: [] });
  const txAvantClear = transactions.length;
  await store.clear();
  assert.equal(transactions.length - txAvantClear, 1, 'clear() ouvre une seule transaction multi-stores');
  assert.deepStrictEqual(transactions.at(-1).noms, ['events', 'records', 'clouds']);
  assert.equal(donnees.events.size, 0);
  assert.equal(donnees.records.size, 0);
  assert.equal(donnees.clouds.size, 0);
});

test('CH-148 : deux sauvegardes consécutives d\'un même état de session n\'appellent chrome.storage.session.set qu\'une fois, et reinitialiser-extension vide le cache', async () => {
  const store = new MemoryStore();
  store.clearAll = async () => { store.clouds.clear(); store.events.length = 0; store.records.length = 0; };
  const local = memoire(), session = memoire();
  local.clear = async () => { for (const k of Object.keys(local.m)) delete local.m[k]; };
  session.clear = async () => { for (const k of Object.keys(session.m)) delete session.m[k]; };
  let appelsSessionSet = 0;
  const origSessionSet = session.set.bind(session);
  session.set = async o => { appelsSessionSet++; return origSessionSet(o); };

  const b = production({ store, local, session });
  await b.api('view');

  const cache = b.get('cacheStockageCle');
  assert.ok(cache instanceof Map || (cache && typeof cache.clear === 'function'), 'cacheStockageCle doit être une Map dans background.js');

  const poserFin = b.get('poserFin');
  const sauverObsFins = b.get('sauverObsFins');
  const lotClos = { id: 'lot-session-1', state: 'COMPLETED' };
  poserFin(lotClos, 1700000000000, 'fin-naturelle');
  await new Promise(r => setImmediate(r));
  assert.equal(appelsSessionSet, 1, '1re sauvegarde : chrome.storage.session.set appelé 1 fois');

  /* 2e sauvegarde consécutive du même état : court-circuitée par cacheStockageCle ! */
  sauverObsFins();
  await new Promise(r => setImmediate(r));
  assert.equal(appelsSessionSet, 1, '2e sauvegarde identique : chrome.storage.session.set non rappelé');

  /* Même chose via sauverSession direct sur une clé quelconque. */
  const sauverSession = b.get('sauverSession');
  assert.equal(typeof sauverSession, 'function', 'sauverSession doit exister dans background.js');
  await sauverSession('cleEssai', { a: 1, b: [2, 3] });
  assert.equal(appelsSessionSet, 2);
  await sauverSession('cleEssai', { a: 1, b: [2, 3] });
  assert.equal(appelsSessionSet, 2, 'sauverSession court-circuite l\'écriture identique');

  /* reinitialiser-extension remet cacheStockageCle à zéro : la même clé/valeur est de nouveau écrite ensuite. */
  b.get('obsFins').clear();
  await b.api('reinitialiser-extension', { confirme: true });
  assert.equal(cache.size, 0, 'cacheStockageCle est vidé par reinitialiser-extension');
  await sauverSession('cleEssai', { a: 1, b: [2, 3] });
  assert.equal(appelsSessionSet, 3, 'après réinitialisation, la même valeur est bien persistée de nouveau');
});

test('CH-148 : la mémoïsation de ui() ne recalcule pas les listes inchangées entre deux polls sans événement, les met à jour dès qu\'un événement est journalisé, et supporte morceaux/rev', async () => {
  const store = new MemoryStore();
  const local = memoire(), session = memoire();
  const b = production({ store, local, session });
  await b.api('view');

  const H = b.ctx.BananeHistoriqueParties;
  const FP = b.ctx.BananeFileParties;
  let appelsHistorique = 0, appelsFileVue = 0;
  b.ctx.BananeHistoriqueParties = { ...H, historique: (...a) => { appelsHistorique++; return H.historique(...a); } };
  b.ctx.BananeFileParties = { ...FP, vue: (...a) => { appelsFileVue++; return FP.vue(...a); } };

  const uiFn = b.get('typeof ui === "function" ? ui : null');
  assert.equal(typeof uiFn, 'function', 'la fonction ui() doit exister dans background.js');

  /* Poll 1 : calcule partsHistory et fileParties une première fois. */
  const v1 = await b.api('view');
  assert.equal(appelsHistorique, 1, '1er poll : historique calculé 1 fois');
  assert.equal(appelsFileVue, 1, '1er poll : vue de la file calculée 1 fois');

  /* Poll 2 sans nouvel événement ni changement de liste : aucun recalcul ! */
  const v2 = await b.api('view');
  assert.equal(appelsHistorique, 1, '2e poll sans événement : historique mémoïsé (0 recalcul)');
  assert.equal(appelsFileVue, 1, '2e poll sans événement : fileParties mémoïsé (0 recalcul)');
  assert.deepStrictEqual(v2.partsHistory, v1.partsHistory);
  assert.deepStrictEqual(v2.fileParties, v1.fileParties);

  /* Journalisation d'un événement : invalide immédiatement le cache pour le poll suivant. */
  await b.get('store').putEvent({ eventId: 'ev-nouveau-1', timestamp: new Date().toISOString(), type: 'validation-accepted', batchId: 'lot-1' });
  const v3 = await b.api('view');
  assert.equal(appelsHistorique, 2, 'poll après un événement journalisé : historique immédiatement recalculé');
  assert.equal(appelsFileVue, 2, 'poll après un événement journalisé : fileParties immédiatement recalculé');
  assert.ok(Array.isArray(v3.partsHistory));

  /* Mode différentiel `{ morceaux: true, rev }` via l'action `state` : reconstruit exactement l'état complet côté panneau. */
  const d1 = await b.api('state', { morceaux: true, rev: 0 });
  assert.ok(Number.isInteger(d1.rev) && d1.rev > 0, 'un jeton rev est retourné');
  const etat1 = M.appliquerDiff(null, d1);
  b.get('engine').s.notice = 'Nouveau message synthétique';
  const d2 = await b.api('state', { morceaux: true, rev: d1.rev });
  assert.equal('settings' in d2, false, 'settings inchangé est omis du delta');
  assert.equal('partsHistory' in d2, false, 'partsHistory inchangé est omis du delta');
  const etat2 = M.appliquerDiff(etat1, d2);
  const complet = JSON.parse(JSON.stringify(await b.api('view')));
  const { rev: _r, ...etat2SansRev } = JSON.parse(JSON.stringify(etat2));
  assert.deepStrictEqual(etat2SansRev, complet, 'l\'état reconstruit par appliquerDiff est identique à view complet');
});

test('CH-148 : cache éphémère de capture courante sur un cut du lot (1 seul getCloud au lieu de 3) et espacement de reprisePoser en relecture', async () => {
  /* 1. Sur un cut du lot, observeLot et commandLot réutilisent la capture courante sans rappeler store.getCloud. */
  const store = new MemoryStore();
  let lecturesCloud = 0;
  const origGetCloud = store.getCloud.bind(store);
  store.getCloud = async id => { lecturesCloud++; return origGetCloud(id); };
  const b = production({ store, local: memoire(), session: memoire() });
  await b.api('connect', { tabId: 1 });
  await b.api('settings', { mode: 'automatic-test' });
  await b.api('start', { part: 23, start: 100, end: 100, testConfirmed: true, allowNavigationEvidence: true, lowConfidence: 'attempt', geometryEngine: 'geometry-candidate-v1' });
  await b.settle();
  assert.equal(lecturesCloud, 1, 'un seul store.getCloud sur le cut (Engine.analyze seul ; observeLot et commandLot lisent le cache éphémère)');
  assert.equal(b.get('cacheCaptureCourante')?.capture, null, 'le cache éphémère est libéré dès la fin de commandLot');

  /* 2. En relecture (7 cuts visités sans correction ni pause), reprisePoser n'écrit pas à chacun des 7 cuts dans chrome.storage.local. */
  let ecrituresReprise = 0;
  const { b: br } = await lotPause({
    esv: (_a, bb) => {
      const set = bb.ctx.chrome.storage.local.set.bind(bb.ctx.chrome.storage.local);
      bb.ctx.chrome.storage.local.set = async o => {
        if (o && 'banane51RelectureReprise' in o) ecrituresReprise++;
        return set(o);
      };
    },
  });
  const fin = await HPause.finPasse(br);
  assert.equal(fin.etat, 'finie');
  assert.equal(fin.faits, 7);
  assert.ok(ecrituresReprise >= 1 && ecrituresReprise <= 2, `reprisePoser espacé : ${ecrituresReprise} écriture(s) au lieu de 8 pour 7 cuts ordinaires`);
});
