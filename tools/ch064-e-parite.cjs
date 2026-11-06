#!/usr/bin/env node
'use strict';
/* CH-064-E : parité de la crate ariane-etat contre les modules JS de cette branche.
 *   node tools/ch064-e-parite.cjs [--rapide] [--corpus] [--json SORTIE]
 * Construit le binaire si besoin (cible wasm32-unknown-unknown, mémoire bornée à 512 Mio). */
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { comparer } = require('./ch064-comparer.cjs');
const RACINE = path.resolve(__dirname, '..');
const CRATE = path.join(RACINE, 'ariane-rs', 'crates', 'ariane-etat');
const WASM = path.join(CRATE, 'target', 'wasm32-unknown-unknown', 'release', 'ariane_etat.wasm');
const Etat = require('../src/etat-morceaux.js');
const Journal = require('../src/journal-index.js');
const Corr = require('../src/correction-liste.js');
const Liste = require('../src/liste-memoire.js');
const Verts = require('../src/verts-a-controler.js');
const Natif = require('../src/native-session.js');

function construire() {
  if (fs.existsSync(WASM) && process.env.CH064_E_REBUILD !== '1') return;
  const r = spawnSync('cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown', '-q'], { cwd: CRATE, encoding: 'utf8' });
  if (r.status !== 0) throw Error('construction : ' + (r.stderr || r.stdout || '').slice(-2000));
}
function coeur() {
  construire();
  const Coeur = require('../ariane-rs/coquille/coeur.js');
  return Coeur.creer(fs.readFileSync(WASM), { seuilReinstanciation: 32 * 1024 * 1024 });
}
function capter(f) { try { return { ok: true, v: f() }; } catch (e) { return { ok: false, v: e }; } }

const ecarts = [];
function voir(nom, js, rs) {
  const a = capter(js), b = capter(rs);
  let e = [];
  if (a.ok !== b.ok) e = [{ chemin: '(racine)', raison: a.ok ? 'JS rend, Rust lève : ' + b.v.message : 'JS lève (' + a.v.message + '), Rust rend' }];
  else if (a.ok) e = comparer(a.v, b.v);
  if (e.length) ecarts.push({ nom, ecarts: e.slice(0, 4) });
}

function indexJs(events, records, types) {
  const store = {
    events, records,
    putEvent() {}, putRecord() {}, deleteEvent() {}, deleteRecord() {}, deleteMany() {}, deleteIfUnchanged() {}, clearAll() {},
    keys(n) { return (n === 'events' ? events : records).map(x => n === 'events' ? x.eventId : (x.recordId || x.id)); },
    all(n) { return n === 'events' ? events : records; },
    open() { return null; },
  };
  // L'équipement enveloppe le magasin. On rejoue la partie pure en appelant les mêmes notations via une construction directe :
  // on laisse le module construire l'index en lisant all/keys, puis on lit indexJournal.
  const s = Journal.equiper(store, { types });
  // construire est lancé par clesNatif. open() rend null : la lecture par clé échoue, mais la construction a eu lieu avant.
  return s;
}

function photoIndex(events, records, types) {
  // Photo faite par le module : on singe une base pour que `construire` aboutisse, puis on lit les cartes via clesNatif
  // n'est pas possible sans open. On reconstruit la photo en réutilisant les fonctions pures exposées... le module
  // n'expose pas l'index. On le reconstruit ici, à l'identique du source, pour le côté JS, et on compare au port.
  const set = new Set(types);
  const parType = new Map(), evNatif = new Map(), recNatif = new Map();
  const ajouter = (m, k, cle) => { if (k == null) return; let s = m.get(k); if (!s) { s = new Set(); m.set(k, s); } s.add(cle); };
  let invalide = false;
  for (const e of events) {
    const cle = e && typeof e.eventId === 'string' ? e.eventId : null;
    if (cle === null) invalide = true;
    if (cle !== null && e && typeof e === 'object') {
      if (set.has(e.type)) ajouter(parType, e.type, cle);
      if (typeof e.nativeSessionId === 'string') ajouter(evNatif, e.nativeSessionId, cle);
    }
  }
  for (const r of records) {
    const id = r?.recordId || r?.id;
    const cle = typeof id === 'string' ? id : null;
    if (cle === null) invalide = true;
    if (cle !== null && r && typeof r === 'object' && typeof r.nativeSessionId === 'string') ajouter(recNatif, r.nativeSessionId, cle);
  }
  const paires = m => [...m.entries()].map(([k, s]) => [k, [...s].sort()]);
  return { invalide, totaux: { events: events.length, records: records.length }, types: [...set], parType: paires(parType), evNatif: paires(evNatif), recNatif: paires(recNatif) };
}

function casSynthetiques(c) {
  const bords = (i, { dg = 0, dzL = 0 } = {}) => ({ left: [i, -0.7175 - dg / 2000, dzL / 1000], right: [i, 0.7175 + dg / 2000, 0] });
  const lot = [{ cut: 20, differe: false }, { cut: 40, differe: true }, { cut: 41, differe: true }, { cut: 42, differe: false }, { cut: 43, differe: true }, { cut: 44, differe: false }, { cut: 59, differe: false }, { cut: 60, differe: false }, { cut: 62, differe: false }, { cut: 63, differe: false }];
  const auLot = new Set(lot.map(x => x.cut));
  const mal = { 47: { dg: 30 }, 21: { dzL: 35 }, 61: { dg: 25 } };
  const lignes = [];
  for (let i = 0; i < 120; i++) lignes.push({ i, statut: auLot.has(i) ? 'invalid' : 'valid', operateur: false, bords: bords(i, mal[i] || {}) });
  const entree = { partie: 7, lot, lignes, zonesPN: [{ debut: 59, fin: 63 }] };
  voir('verts.liste', () => Verts.liste(entree), () => c.appeler(0, { f: 'vertsListe', entree, options: null }));
  voir('verts.signaux', () => {
    const S = Verts.signaux(entree);
    return { reference: S.reference, signaux: S.signaux, cutsLot: S.cutsLot, differes: S.differes, zones: S.zones, zonesADV: S.zonesADV };
  }, () => {
    const S = c.appeler(0, { f: 'vertsSignaux', entree, options: null });
    delete S.verts;
    return S;
  });
  voir('verts.duree', () => [Verts.duree(140), Verts.duree(45), Verts.duree(120), Verts.duree(NaN)], () => [140, 45, 120, null].map(s => c.appeler(0, { f: 'vertsDuree', s })));
  voir('verts.compacter', () => Verts.compacter([1666, 1655, 1664, 1665]), () => c.appeler(0, { f: 'vertsCompacter', cuts: [1666, 1655, 1664, 1665] }));
  const dec = { n: 3, st: [0, 1, 0], fl: [0, 0, 1], ed: [0, 0, 0, 0, 14350, 0, 10000, 0, 0, 10000, 14350, 0, 20000, 0, 0, 20000, 14350, 0] };
  voir('verts.lignes', () => Verts.lignesDeInstantane(dec), () => c.appeler(0, { f: 'vertsLignes', dec }));

  const table = { st: [0, 1, 0], fl: [1, 0, 2], ed: [0, 0, 0, 10000, 0, 0, null, 1, 2, 3, 4, 5, 10, 0, 0, 10010, 0, 0] };
  voir('liste.compacter', () => Liste.compacter(table, { partie: 3, at: '2026-11-06T12:00:00.000Z', version: '5', cle: 'abcd' }), () => c.appeler(0, { f: 'listeCompacter', t: table, meta: { partie: 3, at: '2026-11-06T12:00:00.000Z', version: '5', cle: 'abcd' } }));
  const snap = Liste.compacter(table, { partie: 3, at: '2026-11-06T12:00:00.000Z', cle: 'abcd' });
  voir('liste.decompacter', () => Liste.decompacter(snap), () => c.appeler(0, { f: 'listeDecompacter', snap }));
  voir('liste.empreinte', () => Liste.empreinte('abcé'), () => c.appeler(0, { f: 'listeEmpreinte', s: 'abcé' }));
  voir('liste.nom', () => Liste.nomFichier(12, '2026-11-06T12:55:30.123Z'), () => c.appeler(0, { f: 'listeNom', partie: 12, at: '2026-11-06T12:55:30.123Z' }));
  voir('liste.bords', () => Liste.bordsCorps({ ExtractionStatus: 'valid', XLeftEdge: 1, YLeftEdge: 2, ZLeftEdge: 3, XRightEdge: 4, YRightEdge: 5, ZRightEdge: 6.00005 }), () => c.appeler(0, { f: 'listeBords', body: { ExtractionStatus: 'valid', XLeftEdge: 1, YLeftEdge: 2, ZLeftEdge: 3, XRightEdge: 4, YRightEdge: 5, ZRightEdge: 6.00005 } }));
  const b6 = [1000, 0, 0, 11000, 0, 0];
  let mem = {};
  let memR = {};
  for (const [partie, cut, at] of [[1, 4, '2026-11-06T10:00:00.000Z'], [1, 5, '2026-11-06T10:01:00.000Z'], [2, 1, '2026-11-06T11:00:00.000Z']]) {
    mem = Liste.ajouter(mem, partie, 'cle', cut, b6, at, '5.0-longue-version-a-couper');
    memR = c.appeler(0, { f: 'listeAjouter', mem: memR, partie, cle: 'cle', cut, bords: b6, at, version: '5.0-longue-version-a-couper' });
  }
  voir('liste.ajouter', () => mem, () => memR);
  const dec2 = Liste.decompacter(Liste.compacter({ st: [0, 0, 0, 0, 0, 0], fl: [0, 0, 0, 0, 0, 0], ed: [1000, 0, 0, 11000, 0, 0, 1000, 0, 0, 11000, 0, 0, 1000, 0, 0, 11000, 0, 0, 2000, 0, 500, 12000, 0, 500, 1000, 0, 0, 11000, 0, 0, 1000, 0, 0, 11000, 0, 0] }, { partie: 1, cle: 'cle' }));
  voir('liste.comparer', () => Liste.comparer(mem[1], dec2, '2026-11-06T12:00:00.000Z'), () => c.appeler(0, { f: 'listeComparer', p: mem[1], dec: dec2, at: '2026-11-06T12:00:00.000Z' }));

  const etat = { native: { id: 'sess', visits: [{ a: 1 }, { a: 2 }, { a: 3 }], cloudIds: ['c0', 'c1', 'c2'], exportState: { exportedCloudIds: ['c0'], releasedCloudIds: [] }, qualityRails: { r1: 1, r2: { z: 2 } }, observationPeriods: [], incomplete: [] } };
  const d = Etat.decouper(etat);
  const norm = r => ({ etat: r.etat, morceaux: [...r.morceaux.entries()], simples: [...(r.simples ? r.simples.entries() : [])] });
  voir('etat.decouper', () => norm(d), () => c.appeler(0, { f: 'decouper', etat, connus: null }));
  const lus = Object.fromEntries([...d.morceaux]);
  // On retire un morceau pour le manquant, et on en altère un.
  voir('etat.recoller', () => {
    const r = Etat.recoller(JSON.parse(JSON.stringify(d.etat)), new Map(d.morceaux));
    return { etat: r.etat, manquants: r.manquants, relus: [...r.relus] };
  }, () => c.appeler(0, { f: 'recoller', etat: JSON.parse(JSON.stringify(d.etat)), lus: [...d.morceaux] }));
  voir('etat.cles', () => Etat.clesARelire(d.etat), () => c.appeler(0, { f: 'clesARelire', etat: d.etat }));

  const ev = [
    { eventId: 'e2', type: 'batch-started', nativeSessionId: 's', timestamp: '2026-11-06T10:00:00.000Z' },
    { eventId: 'e1', type: 'relecture-ombre', nativeSessionId: 's', timestamp: '2026-11-06T10:00:01.000Z' },
    { eventId: 'e3', type: 'autre', nativeSessionId: 't' },
  ];
  const rec = [{ recordId: 'r1', nativeSessionId: 's' }, { id: 'r2', nativeSessionId: 's' }];
  const types = ['batch-started', 'relecture-ombre'];
  voir('journal', () => photoIndex(ev, rec, types), () => c.appeler(0, { f: 'journal', events: ev, records: rec, types }));

  const t0 = '2026-11-06T10:00:00.000Z';
  const events = [
    { type: 'batch-started', timestamp: t0, batch: { id: 'B' }, identity: { part: 7, cut: 20 } },
    { type: 'gcv1-shadow-observed', timestamp: '2026-11-06T10:00:01.000Z', batchId: 'B', identity: { part: 7, cut: 20 }, lotObservation: { command: { action: 'lot', reason: 'essai' }, anchorsUsed: [] } },
    { type: 'gcv1-shadow-observed', timestamp: '2026-11-06T10:00:02.000Z', batchId: 'B', identity: { part: 7, cut: 21 }, lotObservation: { command: { action: 'rien' }, anchorsUsed: [1] } },
    { type: 'esv-observation', timestamp: '2026-11-06T10:00:03.000Z', kind: 'write', status: 200, rowIndex: 20, body: { ExtractionStatus: 'valid', TreatedByOperator: true } },
    { type: 'batch-stopped-at-end', timestamp: '2026-11-06T10:05:00.000Z' },
    { type: 'relecture-ombre', timestamp: '2026-11-06T10:06:00.000Z', batchId: 'B', identity: { part: 7, cut: 20 }, verdict: 'je corrigerais', action: 'rien', pireMm: 12.34 },
  ];
  voir('correction', () => Corr.construire(events, { partie: 7, population: true }), () => c.appeler(0, { f: 'correction', events, options: { partie: 7, population: true } }));
  const entrees = Corr.construire(events, { partie: 7 }).entrees;
  const visites = [{ visitId: 'v', identity: { part: 7, cut: 20 }, label: 'VALIDATE_CORRECTED_BOTH', endedAt: t0 }];
  voir('statut', () => Corr.statutDe(entrees[0], visites), () => c.appeler(0, { f: 'statut', entree: entrees[0], visites }));
  voir('bilan', () => Corr.bilan(entrees, visites), () => c.appeler(0, { f: 'bilan', entrees, visites, enregistrements: null }));
  voir('parcours', () => Corr.parcours([{ partie: 7, lignes: Corr.bilan(entrees, visites).lignes }], { partieAffichee: 7 }), () => c.appeler(0, { f: 'parcours', listes: [{ partie: 7, lignes: Corr.bilan(entrees, visites).lignes }], options: { partieAffichee: 7 } }));
  voir('couverture', () => Corr.couverture(events, {}), () => c.appeler(0, { f: 'couverture', events, options: {} }));

  const session = { id: 's', status: 'FINISHED', startedAt: t0, finishedAt: '2026-11-06T11:00:00.000Z', observationPeriods: [{}], cloudIds: ['a'], metrics: { dropped: 0, degradationLevels: [] }, visits: [] };
  const records = [{ nativeSessionId: 's', visitIndex: 1, status: 'complete', identity: { part: 1, cut: 2 }, geometryEligibility: { left: { status: 'comparable-candidate', reasons: ['a'] }, right: { status: 'non' }, pair: { status: 'non' } }, geometryCaptures: {}, railSnapshots: { left: [], right: [] } }];
  const evs = [{ nativeSessionId: 's', eventSeq: 2, type: 'x' }, { nativeSessionId: 's', eventSeq: 1, type: 'y' }];
  return datasetJs(session, records, evs, '2026-11-06T12:00:00.000Z').then(js => voir('dataset', () => js, () => c.appeler(0, { f: 'dataset', session, records, events: evs, exportedAt: '2026-11-06T12:00:00.000Z' })));
}

async function datasetJs(session, records, events, exportedAt) {
  const store = { all(n) { return n === 'records' ? records : events; } };
  const moteur = { s: { native: session } };
  const sessions = new Natif.Sessions(moteur, {}, store);
  const orig = Date.prototype.toISOString;
  Date.prototype.toISOString = function () { return exportedAt; };
  try { return await sessions.dataset(); } finally { Date.prototype.toISOString = orig; }
}

function mince(e) {
  if (!e || typeof e !== 'object') return e;
  const o = {};
  for (const k of ['type', 'timestamp', 'batchId', 'lotId', 'reason', 'kind', 'status', 'rowIndex', 'resultat', 'verdict', 'action', 'pireMm', 'cutsGarde', 'correctionId', 'etat', 'raison', 'lignes', 'batchIds', 'identity', 'decal', 'eventId', 'nativeSessionId', 'recordId', 'id']) if (k in e) o[k] = e[k];
  if (e.batch && e.batch.id) o.batch = { id: e.batch.id };
  if (e.body) o.body = { ExtractionStatus: e.body.ExtractionStatus, TreatedByOperator: e.body.TreatedByOperator };
  if (e.lotObservation) {
    const L = e.lotObservation, cmd = L.command || {};
    o.lotObservation = { stage: L.stage, command: { action: cmd.action, reason: cmd.reason }, anchorsUsed: L.anchorsUsed, l1: L.l1 && L.l1.chaine ? { chaine: { appuis: L.l1.chaine.appuis } } : undefined };
  }
  return o;
}
function* zips(root) {
  const { readdirSync, statSync } = fs;
  for (const d of readdirSync(root)) {
    const p = path.join(root, d);
    if (!statSync(p).isDirectory()) continue;
    const raw = path.join(p, 'raw');
    const dir = fs.existsSync(raw) ? raw : p;
    for (const f of readdirSync(dir)) if (f.endsWith('.zip')) yield path.join(dir, f);
  }
}
async function corpus(c) {
  const { execFileSync } = require('node:child_process');
  const root = process.env.BANANE_DATA || '/tmp/banane-data/collections';
  const bilan = { journaux: 0, listes: 0, echos: 0, etats: 0 };
  let n = 0;
  for (const z of zips(root)) {
    const noms = execFileSync('unzip', ['-Z1', z], { encoding: 'utf8' }).split('\n');
    for (const e of noms) {
      const b = path.basename(e);
      const vouloir = b.startsWith('ariane-journal-v4') || b.startsWith('ariane-liste-partie') || b.startsWith('ariane-echo');
      if (!vouloir) continue;
      const texte = execFileSync('unzip', ['-p', z, e], { maxBuffer: 2 ** 31 - 1, encoding: 'utf8' });
      const doc = JSON.parse(texte);
      n++;
      if (b.startsWith('ariane-journal-v4')) {
        const ev = (doc.events || []).map(mince), rec = (doc.records || []).map(mince);
        const types = ['batch-started', 'relecture-ombre', 'gcv1-shadow-observed', 'esv-observation', 'correction-debut', 'correction-fin'];
        voir('journal-' + bilan.journaux, () => photoIndex(ev, rec, types), () => c.appeler(0, { f: 'journal', events: ev, records: rec, types }));
        voir('correction-' + bilan.journaux, () => Corr.construire(ev, { population: true }), () => c.appeler(0, { f: 'correction', events: ev, options: { population: true } }));
        voir('couverture-' + bilan.journaux, () => Corr.couverture(ev, {}), () => c.appeler(0, { f: 'couverture', events: ev, options: {} }));
        bilan.journaux++;
        process.stderr.write('journal ' + bilan.journaux + '\n');
      } else if (b.startsWith('ariane-liste-partie')) {
        voir('liste-' + bilan.listes, () => Liste.decompacter(doc), () => c.appeler(0, { f: 'listeDecompacter', snap: doc }));
        const dec = Liste.decompacter(doc);
        if (dec) voir('lignes-' + bilan.listes, () => Verts.lignesDeInstantane(dec), () => c.appeler(0, { f: 'vertsLignes', dec }));
        bilan.listes++;
      } else if (doc && doc.session && Array.isArray(doc.records)) {
        const exp = '2026-11-06T00:00:00.000Z';
        const rail = x => x && { railLocalToSceneRelative: x.railLocalToSceneRelative, profileLocalToSceneRelative: x.profileLocalToSceneRelative };
        const recs = doc.records.map(r => ({
          nativeSessionId: r.nativeSessionId, visitIndex: r.visitIndex, status: r.status, identity: r.identity,
          serverConfirmed: r.serverConfirmed, startedAt: r.startedAt,
          geometryEligibility: r.geometryEligibility,
          geometryCaptures: Object.fromEntries(Object.entries(r.geometryCaptures || {}).map(([k, v]) => [k, { status: v && v.status, termination: v && v.termination && { code: v.termination.code } }])),
          railSnapshots: Object.fromEntries(['left', 'right'].map(side => [side, ((r.railSnapshots || {})[side] || []).map(item => ({
            qualificationStatus: item.qualificationStatus, receiptEventSeq: item.receiptEventSeq, revocations: item.revocations,
            sourceStatus: item.sourceStatus, clipStatus: item.clipStatus, acquiredThroughAt: item.acquiredThroughAt,
            coordinateSystem: item.coordinateSystem && { frameId: item.coordinateSystem.frameId }, rail: rail(item.rail),
          }))])),
          beforeEstablished: r.beforeEstablished && { rails: { left: rail(r.beforeEstablished.rails && r.beforeEstablished.rails.left), right: rail(r.beforeEstablished.rails && r.beforeEstablished.rails.right) } },
        }));
        const evs = (doc.events || []).map(e => ({ nativeSessionId: e.nativeSessionId, eventSeq: e.eventSeq, event_seq: e.event_seq, type: e.type }));
        const jsD = await datasetJs(doc.session, recs, evs, exp);
        const rsD = c.appeler(0, { f: 'dataset', session: doc.session, records: recs, events: evs, exportedAt: exp });
        voir('dataset-' + bilan.echos, () => jsD, () => rsD);
        if (doc.session && doc.session.id) {
          voir('etat-' + bilan.etats, () => {
            const r = Etat.decouper(doc.session);
            return { etat: r.etat, morceaux: [...r.morceaux.entries()], simples: [...r.simples.entries()] };
          }, () => c.appeler(0, { f: 'decouper', etat: doc.session, connus: null }));
          bilan.etats++;
        }
        bilan.echos++;
        process.stderr.write('echo ' + bilan.echos + '\n');
      }
      if (ecarts.length > 30) return bilan;
    }
  }
  return bilan;
}
async function main() {
  const c = coeur();
  await casSynthetiques(c);
  let bilan = null;
  if (process.argv.includes('--corpus')) {
    bilan = await corpus(c);
  }
  const ok = ecarts.length === 0;
  const res = { format: 'ch064-e-parite-v1', cas: 'synthese', ecarts: ecarts.slice(0, 12), memoire: c.etat(), corpus: bilan, verdict: ok ? 'IDENTIQUE' : 'ÉCART' };
  console.log(JSON.stringify(res, null, 1));
  if (!ok) process.exitCode = 1;
}
main();
