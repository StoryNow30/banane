'use strict';
/* CH-035 — L'AURORE ENTRE LES PARTIES D'UNE CONSTELLATION, côté service worker (background.js) : « Ouvrir » un cut d'une autre partie change de partie
 * par les boutons d'ESV (`changerPartie` de l'adaptateur, ses modes), attend la partie lue dans la page, puis va au cut ; Écho est en pause pendant
 * tout le trajet et reprend après ; un événement `correction-partie` le journalise. Réglage `correctionEntreParties` éteint : comportement de la
 * 4.9.5.29 à l'identique (refus « partie chargée »). Ariane n'envoie ni pose, ni validation, ni SKIP, ni touche. Faux adaptateur ; données fabriquées. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { K } = require('./fixtures.cjs'), Settings = require('../src/settings.js'), EC = require('../src/export-cache.js'), CL = require('../src/correction-liste.js');
const { background } = require('./helpers/background-harness.cjs');
const { journal } = require('./helpers/correction-journal.cjs');
const ECRITURES = /^(apply|validate|skip|validateInPlace|validerMajEspace|nextWithoutDecision)/;
const REGLAGE = { actif: true, changementBorneMs: 300, gotoBorneMs: 300, pollMs: 10 };

/* Trois lots, parties 5, 6, 7 (même journal fabriqué, décalé), ESV affiche la partie 5. Faux adaptateur : `changerPartie` (lien, ou gestes vers la
 * partie suivante) ouvre la partie demandée 20 ms plus tard ; `bloque` : rien ne change ; `ouvre` : ESV ouvre une autre partie ; `compteurTardif` :
 * `goToCut` refuse OUT_OF_BOUNDS les N premières fois après un changement (cache de la partie vide). */
async function monter({ reglage = REGLAGE, gestes = false } = {}) {
  const S = { ...Settings, correctionEntreParties: reglage };
  const b = background({ globals: { BananeCore3: K, BananeSettings: S, BananeExportCache: EC, ArianeCorrectionListe: CL, setTimeout, clearTimeout } });
  const A = b.adapter; Object.assign(A, { parts: [5, 6, 7], bloque: false, ouvre: null, compteurTardif: 0, tardif: 0 });
  A.identity.part = 5; A.identity.cut = 10;
  A.ping = async function (o) { return { version: K.VERSION, pageId: this.identity.pageId, proprietaire: 'test', label: { part: this.identity.part, cut: this.identity.cut, pageId: this.identity.pageId },
    capacites: ['changerPartie', ...(gestes ? ['changerPartie:invalide-suivant', 'changerPartie:suivant-dernier'] : [])],
    ...(o?.contrat ? { selecteurParties: { status: 'ok', current: this.identity.part, parts: this.parts.map(part => ({ part, current: part === this.identity.part })) } } : {}) }; };
  A.changerPartie = async function ({ part, mode }) { this.calls.push(`changerPartie:${mode || 'lien'}:${part}`);
    const de = { part: this.identity.part, cut: this.identity.cut };
    if (mode && mode !== 'lien') { const suite = this.parts[this.parts.indexOf(this.identity.part) + 1];
      if (!this.bloque) setTimeout(() => { this.identity = { ...this.identity, part: this.ouvre ?? suite, cut: 0 }; this.tardif = this.compteurTardif; }, 20);
      return { ok: true, mode, de, vers: part, compteur: { traites: 10, total: 10 }, bouton: { id: 'O2N3DCutNextInvalid3DRail', exists: true, disabled: false }, validationCommandSent: false, skipCommandSent: false }; }
    if (!this.parts.includes(part)) return { ok: false, raison: 'partie-absente', mode: 'lien', de, vers: part };
    if (!this.bloque) setTimeout(() => { this.identity = { ...this.identity, part: this.ouvre ?? part, cut: 1, pageId: 'page-' + part }; this.tardif = this.compteurTardif; }, 20);
    return { ok: true, mode: 'lien', de, vers: part, validationCommandSent: false, skipCommandSent: false }; };
  A.goToCut = async function (cible) { this.calls.push(`goToCut:${cible.part}:${cible.cut}`); const avant = { part: this.identity.part, cut: this.identity.cut };
    if (cible.part !== this.identity.part) return { resultat: 'refuse', refusal: { code: 'WRONG_PART', message: 'autre partie' }, emissions: 0, commandInvoked: false, identiteAvant: avant };
    if (this.tardif > 0) { this.tardif--; return { resultat: 'refuse', refusal: { code: 'OUT_OF_BOUNDS', message: 'hors bornes' }, emissions: 0, commandInvoked: false, identiteAvant: avant }; }
    this.identity = { ...this.identity, cut: cible.cut }; return { resultat: 'confirme', confirme: true, chemin: 'evenement', emissions: 1, identiteAvant: avant, identiteApres: { part: cible.part, cut: cible.cut } }; };
  await b.api('connect', { tabId: 1 });
  const T = [0, 600, 1200];
  [5, 6, 7].forEach((partie, i) => { for (const e of journal({ partie, lot: 'B' + partie })) b.store.events.push({ eventId: K.uid(), ...e, timestamp: new Date(Date.parse(e.timestamp) + T[i] * 1000).toISOString() }); });
  b.fonction(`engine.s.batch=${JSON.stringify({ id: 'B7', state: 'COMPLETED', scope: { part: 7 } })}`);
  await b.api('correction-liste', { batchIds: ['B5', 'B6', 'B7'] });
  await b.api('correction-demarrer');
  A.calls.length = 0;
  return b;
}
const evts = (b, type) => b.store.events.filter(e => e.type === type);
const trajet = b => b.adapter.calls.filter(x => /^(nativePause|nativeResume|goToCut|changerPartie)/.test(x));
const sansEcriture = b => assert.ok(!b.adapter.calls.some(c => ECRITURES.test(c)), 'aucune pose, validation ni SKIP : ' + b.adapter.calls.join(','));

test('éteint (défaut du dépôt) : le réglage existe, éteint ; un cut d’une autre partie est refusé comme en 4.9.5.29, sans changerPartie', async () => {
  assert.equal(Settings.correctionEntreParties.actif, false);
  const b = await monter({ reglage: Settings.correctionEntreParties });
  assert.equal(b.fonction('engine.s.correction.entreParties'), undefined, 'aucun champ nouveau dans l’état');
  const r = await b.api('correction-ouvrir', { part: 6, cut: 14 });
  assert.equal(r.ok, false); assert.equal(r.code, 'WRONG_PART');
  assert.deepEqual(trajet(b), ['nativePause', 'goToCut:6:14', 'nativeResume']);
  assert.equal(evts(b, 'correction-partie').length, 0);
});

test('allumé : 3 parties, aller vers la partie 6 puis 7 (lien), retour en arrière vers 5 ; Écho en pause tout le trajet, repris ; journal correction-partie', async () => {
  const b = await monter();
  assert.equal(b.fonction('engine.s.correction.entreParties'), true);
  let r = await b.api('correction-ouvrir', { part: 6, cut: 14 });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual({ ...b.adapter.identity, pageId: undefined, shape: undefined, frameId: undefined, projectId: undefined }, { pageId: undefined, part: 6, cut: 14, shape: undefined, frameId: undefined, projectId: undefined });
  assert.deepEqual(trajet(b), ['nativePause', 'changerPartie:lien:6', 'goToCut:6:14', 'nativeResume']);
  assert.equal(b.fonction('engine.s.native.status'), 'RUNNING');
  b.adapter.calls.length = 0; r = await b.api('correction-ouvrir', { part: 7, cut: 15 }); assert.equal(r.ok, true);
  b.adapter.calls.length = 0; r = await b.api('correction-ouvrir', { part: 5, cut: 13 }); assert.equal(r.ok, true);
  assert.deepEqual(trajet(b), ['nativePause', 'changerPartie:lien:5', 'goToCut:5:13', 'nativeResume'], 'retour en arrière : le lien seul');
  const j = evts(b, 'correction-partie');
  assert.deepEqual(j.map(e => [e.de, e.vers, e.resultat, e.mode]), [[5, 6, 'ok', 'lien'], [6, 7, 'ok', 'lien'], [7, 5, 'ok', 'lien']]);
  assert.equal(j[0].schema, 1); assert.equal(j[0].version, CL.VERSION_PARCOURS); assert.deepEqual({ ...j[0].cible }, { part: 6, cut: 14 });
  assert.ok(Number.isInteger(j[0].dureeMs)); assert.equal(j[0].correctionId, b.fonction('engine.s.correction.id'));
  assert.equal(evts(b, 'file-parties-changement').length, 0, 'les tentatives de l’Aurore ne se confondent pas avec celles de la file');
  assert.ok(evts(b, 'correction-partie-tentative').length >= 3);
  assert.equal(evts(b, 'correction-ouvrir').at(-1).resultat, 'confirme');
  assert.deepEqual({ ...b.fonction('engine.s.correction.courant'), at: undefined }, { part: 5, cut: 13, at: undefined, resultat: 'confirme' });
  sansEcriture(b);
});

test('partie courante déjà chargée : aucun changerPartie, chemin de CH-028 inchangé', async () => {
  const b = await monter();
  const r = await b.api('correction-ouvrir', { part: 5, cut: 14 });
  assert.equal(r.ok, true); assert.deepEqual(trajet(b), ['nativePause', 'goToCut:5:14', 'nativeResume']);
  assert.equal(evts(b, 'correction-partie').length, 0);
});

test('vers la partie suivante, adaptateur à gestes : « Next non validated cut » d’abord ; un saut (5 → 7) n’essaie que le lien', async () => {
  let b = await monter({ gestes: true });
  assert.equal((await b.api('correction-ouvrir', { part: 6, cut: 14 })).ok, true);
  assert.deepEqual(trajet(b).filter(x => /^changerPartie/.test(x)), ['changerPartie:invalide-suivant:6']);
  assert.equal(evts(b, 'correction-partie').at(-1).mode, 'invalide-suivant');
  b = await monter({ gestes: true });
  assert.equal((await b.api('correction-ouvrir', { part: 7, cut: 14 })).ok, true);
  assert.deepEqual(trajet(b).filter(x => /^changerPartie/.test(x)), ['changerPartie:lien:7']);
  sansEcriture(b);
});

test('panne : changement sans effet (borne), partie absente, autre partie ouverte : refus dit, Écho repris, rien d’autre envoyé', async () => {
  let b = await monter(); b.adapter.bloque = true;
  let r = await b.api('correction-ouvrir', { part: 6, cut: 14 });
  assert.equal(r.ok, false); assert.equal(r.code, 'CHANGEMENT_PARTIE'); assert.match(r.message, /partie 6/);
  assert.equal(b.fonction('engine.s.native.status'), 'RUNNING', 'Écho repris sur la partie affichée');
  assert.ok(!trajet(b).some(x => /^goToCut/.test(x)), 'aucun retour au cut sans la partie');
  let e = evts(b, 'correction-partie').at(-1); assert.equal(e.resultat, 'echec'); assert.equal(e.motif, 'changement-impossible'); assert.ok(e.tentatives.length >= 1);
  b = await monter(); b.adapter.parts = [5, 7];
  r = await b.api('correction-ouvrir', { part: 6, cut: 14 }); assert.equal(r.ok, false);
  assert.equal(evts(b, 'correction-partie').at(-1).motif, 'selecteur-illisible');
  b = await monter(); b.adapter.ouvre = 7;
  r = await b.api('correction-ouvrir', { part: 6, cut: 14 }); assert.equal(r.ok, false); assert.match(r.message, /arrêt prudent/);
  sansEcriture(b);
});

test('cache de la partie vide : goToCut refusé OUT_OF_BOUNDS juste après le changement, rejoué dans la borne', async () => {
  const b = await monter(); b.adapter.compteurTardif = 2;
  const r = await b.api('correction-ouvrir', { part: 6, cut: 14 });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(trajet(b).filter(x => x === 'goToCut:6:14').length, 3);
});

test('la séance Écho traverse les parties : ses visites portent leur identité partie/cut, le bilan par cut couvre les trois parties', async () => {
  const b = await monter(), esv = { id: 'test', url: require('../manifest.json').host_permissions[0].replace(/\*$/, '') + 'test', tab: { id: 1 } };
  for (const [part, cut] of [[6, 14], [7, 15]]) {
    assert.equal((await b.api('correction-ouvrir', { part, cut })).ok, true);
    const id = b.fonction('engine.s.native.id'), period = b.fonction('engine.s.native.currentPeriodId'), st = await b.adapter.state();
    await b.message({ kind: 'native-event', type: 'visit-started', payload: { sessionId: id, observationPeriodId: period, visitId: `v${part}-${cut}`, identity: st.identity, initialObserved: st } }, esv);
    await b.message({ kind: 'native-event', type: 'visit-ended', payload: { sessionId: id, observationPeriodId: period, visitId: `v${part}-${cut}`, identity: st.identity, finalObserved: st, reason: 'finished', nextIdentity: null, endedAt: new Date().toISOString() } }, esv);
  }
  const ids = b.fonction('engine.s.native.visits').map(v => [v.identity.part, v.identity.cut]);
  assert.deepEqual(ids, [[6, 14], [7, 15]]);
  await b.api('correction-terminer');
  const f = evts(b, 'correction-fin').at(-1);
  assert.deepEqual([...new Set(f.lignes.map(l => l.part))], [5, 6, 7]);
  assert.ok(f.lignes.find(l => l.part === 6 && l.cut === 14).visites >= 1);
});
