'use strict';
/* CH-049-C : vidage automatique de l'Écho en DELTA.
 * Mesuré le 04/11 (Écho parties 13-14-15, 8 segments à métadonnées) : 70 % des événements et 73 % des entrées de dictionnaire
 * d'un vidage avaient déjà été écrits par le précédent. Le delta n'écrit que les événements et visites neufs ou modifiés ;
 * l'export final reste complet ; merge-segments relit la série à l'identique (union par identifiant, le plus récent l'emporte).
 * Données fabriquées. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const X = require('../src/native-export.js');
const { mergeFiles } = require('../tools/merge-segments.cjs');

const rail = n => ({ railLocalToSceneRelative: [n, 0, 0, 1], profileLocalToSceneRelative: [n, 0, 0, 1], sceneRelativeToProfileLocal: [n, 0, 0, 1], contour: Array.from({ length: 40 }, (_, i) => [i, n + i]) });
const cloud = id => ({ format: 'banane-native-lidar-chunk-v1', chunkId: id, side: 'left', rail: rail(1), pointsSceneRelative: [[1, 2, 3], [4, 5, 6]], visibleByClipBoxes: [true, false] });
const evenement = n => ({ eventId: 'e' + n, eventSeq: n, type: 'native-state-observed', payload: { n, texte: 'x'.repeat(200) } });
const visite = (n, etat) => ({ recordId: 'r' + n, visitId: 'r' + n, identity: { pageId: 'p', part: 1, cut: n, frameId: 'f' }, rail: rail(n % 3), etat: etat || 'ouverte' });

/* Instantané de session au vidage k : toujours COMPLET (comme le producteur), nuages incrémentaux. */
function instantane(k, nuages) {
  const nEv = 40 * k, nRec = 5 * k;
  return {
    format: 'banane-native-session-v2', version: '5', session: { id: 's1', status: 'RUNNING', cloudIds: nuages.map(c => c.chunkId) },
    records: Array.from({ length: nRec }, (_, i) => visite(i, i === nRec - 1 && k < 3 ? 'ouverte' : 'close')),
    events: Array.from({ length: nEv }, (_, i) => evenement(i + 1)),
    closureSummary: { visits: nRec }, clouds: nuages,
  };
}
const ecrire = (dir, stamp, doc, index = 1) => {
  const d = { ...X.compact(doc, {}), segment: { index, stamp, objects: (doc.clouds || []).length, format: 'banane-native-export-segment-v1', selfContained: true } };
  const p = path.join(dir, `seg-${stamp}.json`); fs.writeFileSync(p, JSON.stringify(d)); return p;
};

test('deltaMetadonnees : premier vidage complet, ensuite seulement le neuf et le modifié', () => {
  const k1 = instantane(1, [cloud('c1')]), k2 = instantane(2, [cloud('c2')]);
  const a = X.deltaMetadonnees(k1, null);
  assert.equal(a.doc.events.length, k1.events.length);
  assert.equal(a.doc.records.length, k1.records.length);
  const b = X.deltaMetadonnees(k2, a.jalon);
  assert.equal(b.doc.events.length, k2.events.length - k1.events.length, 'seuls les événements neufs');
  const ids = b.doc.records.map(r => r.recordId);
  assert.ok(ids.includes('r4'), 'la visite qui était ouverte et qui a changé est renvoyée');
  assert.equal(b.doc.records.length, k2.records.length - k1.records.length + 1);
  assert.deepEqual(b.doc.clouds.map(c => c.chunkId), ['c2'], 'les nuages ne sont pas touchés');
  assert.equal(b.doc.deltaVidage.events.envoyes, b.doc.events.length);
  assert.equal(k2.events.length, 80, 'l’entrée n’est pas modifiée');
});

test('deltaMetadonnees : autre session, ou jalon absent, ou élément sans identifiant : tout est renvoyé', () => {
  const k = instantane(2, [cloud('c')]);
  const a = X.deltaMetadonnees(k, null);
  const autre = X.deltaMetadonnees({ ...k, session: { ...k.session, id: 's2' } }, a.jalon);
  assert.equal(autre.doc.events.length, k.events.length);
  const sans = { ...k, events: [{ type: 'x' }, { type: 'y' }] };
  const s1 = X.deltaMetadonnees(sans, null), s2 = X.deltaMetadonnees(sans, s1.jalon);
  assert.equal(s2.doc.events.length, 2, 'sans identifiant on ne devine pas : on renvoie');
});

test('relecture identique : série de vidages en delta + export final complet = série de vidages complets (merge-segments)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banane-delta-'));
  const plein = [], delta = [];
  const dp = path.join(dir, 'p'), dd = path.join(dir, 'd');
  fs.mkdirSync(dp); fs.mkdirSync(dd);
  let jalon = null;
  for (let k = 1; k <= 4; k++) {
    const inst = instantane(k, [cloud('c' + k), cloud('d' + k)]);
    inst.session.cloudIds = Array.from({ length: k }, (_, i) => [cloud('c' + (i + 1)).chunkId, cloud('d' + (i + 1)).chunkId]).flat();
    const stamp = '2026-11-04T10-0' + k + '-00';
    plein.push(ecrire(dp, stamp, inst));
    const d = X.deltaMetadonnees(inst, jalon); jalon = d.jalon;
    delta.push(ecrire(dd, stamp, d.doc));
  }
  const a = mergeFiles(plein).merged, b = mergeFiles(delta).merged;
  assert.deepEqual(b.events, a.events);
  assert.deepEqual(b.records, a.records);
  assert.deepEqual(b.clouds.map(c => c.chunkId).sort(), a.clouds.map(c => c.chunkId).sort());
  assert.equal(b.mergeTrace.allDeclaredPresent, true);
  const poids = l => l.reduce((n, f) => n + fs.statSync(f).size, 0);
  assert.ok(poids(delta) < poids(plein) * 0.7, `le delta pèse nettement moins (${poids(delta)} contre ${poids(plein)})`);
});

test('jalon : n’avance que si le vidage est confirmé écrit', () => {
  const k1 = instantane(1, [cloud('c1')]), k2 = instantane(2, [cloud('c2')]);
  const a = X.deltaMetadonnees(k1, null);
  const jalonConfirme = X.confirmerJalon(a, true), jalonNon = X.confirmerJalon(a, false);
  assert.ok(jalonConfirme);
  assert.equal(jalonNon, null, 'non confirmé : on repart de zéro, donc rien n’est perdu');
  const apresNon = X.deltaMetadonnees(k2, jalonNon);
  assert.equal(apresNon.doc.events.length, k2.events.length);
});

/* Panneau réel (stockage et téléchargements simulés) : deux vidages automatiques de suite. */
const { panneau } = require('../tools/audit-qualite-480.cjs');
const { Sessions } = require('../src/native-session.js'), settings = require('../src/settings.js');
function telechargements() {
  const ecoutes = new Set(), faits = []; let n = 0;
  return { faits, finir: (i, etat = 'complete') => { faits[i].etat = etat; for (const f of [...ecoutes]) f({ id: faits[i].id, state: { current: etat } }); },
    api: { download: async o => { faits.push({ id: ++n, nom: o.filename, etat: 'in_progress' }); return n; }, search: async ({ id }) => [{ id, state: faits.find(f => f.id === id)?.etat }],
      onChanged: { addListener: f => ecoutes.add(f), removeListener: f => ecoutes.delete(f) } } };
}
async function echoDelta({ videDelta } = {}) {
  const clouds = new Map([['A', { captureId: 'A', pointsSceneRelative: [[0, 0, 0]] }]]);
  const s = { native: { id: 's', status: 'RUNNING', visits: [], incomplete: [], cloudIds: ['A'] } };
  let nEv = 5;
  const store = { all: async nom => nom === 'events' ? Array.from({ length: nEv }, (_, i) => ({ ...evenement(i + 1), nativeSessionId: 's' })) : [], getCloud: async id => clouds.get(id), deleteCloud: async id => clouds.delete(id) };
  const session = new Sessions({ s, save: async () => {} }, {}, store), dl = telechargements();
  const appels = [];
  const spy = { ...X, deltaMetadonnees: (d, j) => { const r = X.deltaMetadonnees(d, j); appels.push({ entree: d.events.length, sortie: r.doc.events.length, jalon: !!j }); return r; } };
  const p = await panneau(s, { hash: '#native', chromeExtra: { downloads: dl.api }, globals: { BananeStorage3: class { constructor() { return store; } }, BananeSettings: videDelta === false ? { ...settings, export: { ...settings.export, videDelta: false } } : settings, BananeNativeExport: spy }, reponses: {
    'native-export-advice': { due: true, bytesPending: 1, segments: 0 },
    'native-export-manifest': args => session.exportManifest(args?.all === true).catch(() => ({ sessionId: 's', cloudIds: [...clouds.keys()] })),
    'native-export-ack': args => session.ackExported(args.ids, { confirmes: args.confirmed }), 'native-end': {},
    } });
  session.dataset = async () => ({ session: s.native, records: [], events: [], cloudIds: s.native.cloudIds.slice() });
  session.exportAdvice = () => ({ due: false });
  return { p, dl, appels, plus: k => { nEv += k; clouds.set('B' + nEv, { captureId: 'B' + nEv, pointsSceneRelative: [[0, 0, 0]] }); s.native.cloudIds = [...clouds.keys()]; } };
}
const attendre = async p => { for (let i = 0; i < 5; i++) await p.attendre(); };
test('panneau : le deuxième vidage confirmé n’écrit que les événements neufs', async () => {
  const { p, dl, appels, plus } = await echoDelta();
  let v = p.intervals[1](); await attendre(p); dl.finir(0); await v; await attendre(p);
  plus(3);
  v = p.intervals[1](); await attendre(p); dl.finir(dl.faits.length - 1); await v; await attendre(p);
  assert.deepEqual(appels.map(a => [a.entree, a.sortie, a.jalon]), [[5, 5, false], [8, 3, true]]);
});
test('panneau : un vidage non confirmé ne fait pas avancer le jalon (rien n’est perdu)', async () => {
  const { p, dl, appels, plus } = await echoDelta();
  let v = p.intervals[1](); await attendre(p); dl.finir(0, 'interrupted'); await v; await attendre(p);
  plus(3);
  v = p.intervals[1](); await attendre(p); dl.finir(dl.faits.length - 1); await v; await attendre(p);
  assert.deepEqual(appels.map(a => [a.entree, a.sortie, a.jalon]), [[5, 5, false], [8, 8, false]]);
});
test('panneau : réglage export.videDelta:false = instantané complet comme avant (le delta n’est pas appelé)', async () => {
  const { p, dl, appels } = await echoDelta({ videDelta: false });
  const v = p.intervals[1](); await attendre(p); dl.finir(0); await v; await attendre(p);
  assert.equal(appels.length, 0);
  assert.equal(dl.faits.length, 1, 'le vidage a bien eu lieu');
});
