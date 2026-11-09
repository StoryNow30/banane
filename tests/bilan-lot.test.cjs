'use strict';
/* CH-082 : bilan d'un lot en une commande. Journal SYNTHÉTIQUE fabriqué ici : aucune donnée réelle.
 * Les identifiants (UUID) sont produits à l'exécution et l'adresse plantée est une concaténation :
 * ce fichier ne contient ni UUID ni adresse en clair. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const OUTIL = path.join(__dirname, '..', 'tools', 'bilan-lot.cjs');
let compteur = 0;
const uuid = () => { const h = (++compteur).toString(16).padStart(12, '0'); return `aaaaaaaa-bbbb-4ccc-8ddd-${h}`; };
const BATCH = uuid(), SESSION = uuid(), PAGE = uuid(), FRAME = uuid();
const ADRESSE = ['https://', 'serveur.exemple', '/ept-data/0-0-0-0.bin'].join('');
const T0 = Date.parse('2026-01-05T10:00:00.000Z');
const iso = ms => new Date(T0 + ms).toISOString();
const ident = (part, cut) => ({ pageId: PAGE, part, cut, shape: 'U50', frameId: FRAME, projectId: null });

function fabriquerEvenements() {
  const ev = [];
  const PART = 3;
  /* 11 cuts validés ; intervalles entre validations : 1,1,2,2,2,3,3,4,9 s puis 20 s (écartée, ≥ 10 s) */
  const coupes = [100, 101, 102, 103, 108, 110, 130, 135, 400, 401, 402];
  const ecarts = [1000, 1000, 2000, 2000, 2000, 3000, 3000, 4000, 9000, 20000];
  const elapsed = { 101: 100, 102: 200, 103: 300, 401: 400, 402: 500, 108: 1000, 110: 2000, 135: 3000, 130: 1500, 400: 4600, 100: 777 };
  let t = 1000;
  coupes.forEach((cut, i) => {
    if (i > 0) t += ecarts[i - 1];
    ev.push({ eventId: uuid(), timestamp: iso(t - 30), type: 'adapter-progress', identity: ident(PART, cut), requestId: uuid(), action: 'capture', elapsedMs: elapsed[cut], lastStage: 'capture-ready' });
    ev.push({ eventId: uuid(), timestamp: iso(t - 5), type: 'adapter-progress', identity: ident(PART, cut), requestId: uuid(), action: 'capture', elapsedMs: 9999, lastStage: 'capture-wait' });
    ev.push({ eventId: uuid(), timestamp: iso(t - 20), type: 'before-captured', identity: ident(PART, cut), lidarId: uuid() });
    ev.push({ eventId: uuid(), timestamp: iso(t), type: 'validation-accepted', action: 'VALIDATE', identity: ident(PART, cut), batchId: BATCH, validationAttemptId: uuid() });
  });
  /* une capture de relecture sans before-captured : ne compte pas dans les sauts */
  ev.push({ eventId: uuid(), timestamp: iso(500000), type: 'adapter-progress', identity: ident(PART, 105), action: 'capture', elapsedMs: 31337, lastStage: 'capture-ready' });
  /* 3 différés, 2 captures abandonnées, séries de captures vides (2 séries) */
  for (const cut of [200, 201, 202]) ev.push({ eventId: uuid(), timestamp: iso(60000), type: 'defer-intent', identity: ident(PART, cut), batchId: BATCH });
  for (const cut of [200, 201]) ev.push({ eventId: uuid(), timestamp: iso(61000), type: 'capture-abandoned', identity: ident(PART, cut), id: uuid(), reason: 'deferred-unresolved' });
  ev.push({ eventId: uuid(), timestamp: iso(62000), type: 'serie-captures-vides', identity: { part: PART, cut: 300 }, batchId: BATCH, serie: true, series: 1, vides: 3 });
  ev.push({ eventId: uuid(), timestamp: iso(63000), type: 'serie-captures-vides', identity: { part: PART, cut: 310 }, batchId: BATCH, serie: true, series: 2, vides: 3 });
  /* lecture Rust : 3 servies, 1 repli */
  for (let i = 0; i < 3; i++) ev.push({ eventId: uuid(), timestamp: iso(64000 + i), type: 'rust', action: 'capture', requestId: uuid(), servi: true, repli: false, raison: null });
  ev.push({ eventId: uuid(), timestamp: iso(64100), type: 'rust', action: 'capture', requestId: uuid(), servi: false, repli: true, raison: 'module-absent' });
  /* chargement d'ESV : deux tranches de 10 min (10:00 et 10:10) */
  const res = (ms, n, cache, statuts, echecs, octets) => ({ eventId: uuid(), timestamp: iso(ms), type: 'esv-observation', kind: 'resource', class: 'point-resource', n, bytes: octets, statuts, echecs, depuisCache: cache, sessionId: SESSION, batchId: BATCH, visitId: uuid(), url: ADRESSE });
  ev.push(res(1000, 5, 2, { 200: 5 }, 0, 1000));
  ev.push(res(2000, 3, 0, { 200: 2, 503: 1 }, 1, 500));
  ev.push(res(11 * 60000, 4, 4, { 200: 4 }, 0, 700));
  for (const ms of [3000, 12 * 60000]) ev.push({ eventId: uuid(), timestamp: iso(ms), type: 'esv-observation', kind: 'diag-compteur-bloque', valeur: 2, cuts: 3, cut: 0 });
  ev.push({ eventId: uuid(), timestamp: iso(13 * 60000), type: 'esv-observation', kind: 'diag-compteur-bloque', valeur: 2, cuts: 3, cut: 0 });
  /* préchauffage */
  const pre = (ms, motif, source, noeuds, hier, sansNom, sansAdresse, forme) => ({ eventId: uuid(), timestamp: iso(ms), type: 'esv-observation', kind: 'prechauffage', coupe: 1, predite: 2, noeuds, hierarchies: hier, motif, source, sansNom, sansAdresse, formeNoeud: forme, batchId: BATCH });
  ev.push(pre(4000, 'saut-court', 'relu', 0, 0, 0, 0, null));
  ev.push(pre(4100, 'saut-court', 'relu', 0, 0, 0, 0, null));
  ev.push(pre(4200, 'aucun-noeud', 'liste-esv', 0, 0, 1, 2, 1155));
  ev.push(pre(4300, null, 'liste-esv', 6, 0, 0, 0, 1155));
  ev.push(pre(4400, null, 'passe-differes', 0, 2, 0, 1, 1155));
  ev.push({ eventId: uuid(), timestamp: iso(4500), type: 'esv-observation', kind: 'prechauffage-bilan', coupe: 2, predite: 2, juste: true, demandes: 10, potree: 8, couverts: 6, servisCache: 5 });
  ev.push({ eventId: uuid(), timestamp: iso(4600), type: 'esv-observation', kind: 'prechauffage-bilan', coupe: 3, predite: 9, juste: false, demandes: 4, potree: 4, couverts: 1, servisCache: 0 });
  /* ombres de D-308 */
  const garde = (cut, ecart, ref, vois, pause) => ({ eventId: uuid(), timestamp: iso(5000 + cut), type: 'garde-voie-ombre', batchId: BATCH, sessionId: SESSION, identity: { part: PART, cut }, ecartMm: ecart, referenceMm: ref, ecartAuVoisinageMm: vois, auraitPause: pause, motif: pause ? 'voie:15.96mm>15mm' : 'sans-voisins' });
  ev.push(garde(282, 1452.4, 1436.44, 15.96, true), garde(283, 1434, 1435, -0.99, false), garde(284, 1436, 1435, 1, false));
  ev.push({ eventId: uuid(), timestamp: iso(6000), type: 'serrage-lot-ombre', identity: { part: PART, cut: 162 }, referenceMm: 1438.21, ecartAvantMm: 1435.75, ecartApresMm: 1438.21 });
  ev.push({ eventId: uuid(), timestamp: iso(6100), type: 'serrage-lot-ombre', identity: { part: PART, cut: 163 }, referenceMm: 1437, ecartAvantMm: 1436, ecartApresMm: 1437 });
  /* relecture et passe des différés */
  ev.push({ eventId: uuid(), timestamp: iso(7000), type: 'relecture-fin', mode: 'corriger', issue: 'fin', faits: 349, total: 349, corriges: 38, refusees: 0, vus: 340, dureeMs: 547329, raison: 'Relecture finie.' });
  ev.push({ eventId: uuid(), timestamp: iso(7100), type: 'passe-differes-ombre', identity: { part: PART, cut: 201 }, passe: 1, decision: 'poserait' });
  ev.push({ eventId: uuid(), timestamp: iso(7200), type: 'passe-differes-ombre', identity: { part: PART, cut: 202 }, passe: 1, decision: 'abstention' });
  ev.push({ eventId: uuid(), timestamp: iso(7300), type: 'passe-differes-ecriture', identity: { part: PART, cut: 204 }, passe: 1, resultat: 'ecrit' });
  ev.push({ eventId: uuid(), timestamp: iso(7400), type: 'passe-differes-ecriture-fin', issue: 'fin', ecrites: 7, demandees: 7, decidees: 7 });
  ev.push({ eventId: uuid(), timestamp: iso(7500), type: 'passe-differes-ombre-fin', mode: 'ecriture', differes: 3, posees: 1 });
  return ev;
}

function ecrireDossier(dossier, ev, nom = 'ariane-journal-v4-1.json') {
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, nom), JSON.stringify({ format: 'banane-test-journal-v4', events: ev }));
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bilan-lot-essai-'));
const lancer = (...args) => spawnSync(process.execPath, [OUTIL, ...args], { encoding: 'utf8' });

test('bilan en JSON : lot, temps, chargement, préchauffage, ombres, relecture', () => {
  const d = tmp();
  ecrireDossier(d, fabriquerEvenements());
  const r = lancer(d, '--json');
  assert.equal(r.status, 0, r.stderr);
  const b = JSON.parse(r.stdout);
  assert.equal(b.lot.valides, 11);
  assert.equal(b.lot.differes, 3);
  assert.equal(b.lot.capturesAbandonnees, 2);
  assert.equal(b.lot.seriesCapturesVides, 2);
  assert.deepEqual(b.lot.parties, [3]);
  assert.equal(b.lot.rust.servi, 3);
  assert.equal(b.lot.rust.repli, 1);
  assert.equal(b.lot.rust.raisons['module-absent'], 1);
  /* cut : 9 intervalles < 10 s ; médiane 2000 ; P90 (rang le plus proche) 9000 */
  assert.equal(b.temps.cut.n, 9);
  assert.equal(b.temps.cut.medianMs, 2000);
  assert.equal(b.temps.cut.p90Ms, 9000);
  const c = b.temps.capture;
  assert.deepEqual([c['+1'].n, c['+1'].medianMs, c['+1'].p90Ms], [5, 300, 500]);
  assert.deepEqual([c['2-10'].n, c['2-10'].medianMs, c['2-10'].p90Ms], [3, 2000, 3000]);
  assert.deepEqual([c['11-50'].n, c['11-50'].medianMs], [1, 1500]);
  assert.equal(c['51-200'].n, 0);
  assert.equal(c['51-200'].medianMs, null);
  assert.deepEqual([c['>200'].n, c['>200'].medianMs], [1, 4600]);
  /* chargement */
  assert.equal(b.chargement.noeuds, 12);
  assert.equal(b.chargement.depuisCache, 6);
  assert.equal(b.chargement.echecs, 1);
  assert.deepEqual(b.chargement.statuts, { 200: 11, 503: 1 });
  assert.equal(b.chargement.octets, 2200);
  assert.equal(b.chargement.compteurBloque, 3);
  assert.equal(b.chargement.tranches.length, 2);
  assert.equal(b.chargement.tranches[0].noeuds, 8);
  assert.equal(b.chargement.tranches[0].compteurBloque, 1);
  assert.equal(b.chargement.tranches[1].noeuds, 4);
  assert.equal(b.chargement.tranches[1].compteurBloque, 2);
  /* préchauffage */
  const p = b.prechauffage;
  assert.equal(p.total, 5);
  assert.equal(p.parMotif['saut-court'], 2);
  assert.equal(p.parMotif['aucun-noeud'], 1);
  assert.equal(p.parSource.relu, 2);
  assert.equal(p.parSource['liste-esv'], 2);
  assert.equal(p.actifs, 2);
  assert.equal(p.sansNom, 1);
  assert.equal(p.sansAdresse, 3);
  assert.equal(p.formeNoeud['1155'], 3);
  assert.deepEqual([p.bilans.n, p.bilans.justes, p.bilans.potree, p.bilans.couverts, p.bilans.servisCache], [2, 1, 12, 7, 5]);
  /* ombres */
  assert.equal(b.ombres.garde.n, 3);
  assert.equal(b.ombres.garde.auraitPause, 1);
  assert.equal(b.ombres.garde.pauses.length, 1);
  assert.equal(b.ombres.garde.pauses[0].cut, 282);
  assert.equal(b.ombres.garde.pauses[0].ecartAuVoisinageMm, 15.96);
  assert.equal(b.ombres.serrage.n, 2);
  assert.deepEqual(b.ombres.serrage.cuts[0], { partie: 3, cut: 162, ecartAvantMm: 1435.75, ecartApresMm: 1438.21 });
  /* relecture et passe */
  assert.equal(b.relecture.fin[0].faits, 349);
  assert.equal(b.relecture.fin[0].corriges, 38);
  assert.equal(b.passe.ombre, 2);
  assert.equal(b.passe.ombreParDecision.poserait, 1);
  assert.equal(b.passe.ecriture, 1);
  assert.equal(b.passe.ecritureFin[0].ecrites, 7);
});

test('page Markdown : sections en français, rien d\'identifiant ni d\'adresse', () => {
  const d = tmp();
  ecrireDossier(d, fabriquerEvenements());
  const r = lancer(d);
  assert.equal(r.status, 0, r.stderr);
  const m = r.stdout;
  for (const titre of ['## 1. Lot', '## 2. Temps', '## 3. Chargement d\'ESV', '## 4. Préchauffage', '## 5. Ombres de D-308', '## 6. Relecture et passe']) assert.ok(m.includes(titre), titre);
  assert.ok(m.includes('282'), 'cut de la pause de garde');
  assert.ok(m.includes('15,96') || m.includes('15.96'), 'écart au voisinage en mm');
  const json = lancer(d, '--json').stdout;
  for (const sortie of [m, json]) {
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(sortie), 'aucun motif d\'UUID');
    assert.ok(!/http/i.test(sortie), 'aucune adresse');
    assert.ok(!sortie.includes('serveur.exemple'), 'aucun hôte');
  }
});

test('entrées : dossier contenant des zips, zip seul, plusieurs volumes fusionnés', { skip: spawnSync('zip', ['-v']).error ? 'zip absent' : false }, () => {
  const ev = fabriquerEvenements();
  const moitie = Math.floor(ev.length / 2);
  const src = tmp(), v1 = path.join(src, 'v1'), v2 = path.join(src, 'v2'), sortie = tmp();
  ecrireDossier(v1, ev.slice(0, moitie), 'ariane-journal-v4-1.json');
  ecrireDossier(v2, ev.slice(moitie), 'ariane-journal-v4-2.json');
  for (const [v, nom] of [[v1, 'a.zip'], [v2, 'b.zip']]) {
    const z = spawnSync('zip', ['-q', '-j', path.join(sortie, nom), ...fs.readdirSync(v).map(f => path.join(v, f))]);
    assert.equal(z.status, 0);
  }
  const viaDossier = JSON.parse(lancer(sortie, '--json').stdout);
  const viaZips = JSON.parse(lancer(path.join(sortie, 'a.zip'), path.join(sortie, 'b.zip'), '--json').stdout);
  assert.equal(viaDossier.lot.valides, 11);
  assert.equal(viaDossier.lot.differes, 3);
  assert.deepEqual(viaZips.lot, viaDossier.lot);
  assert.equal(viaDossier.temps.cut.n, 9);
  /* le dossier temporaire de décompression est supprimé */
  assert.ok(!/bilan-lot-zip/.test(lancer(sortie).stdout));
});

test('erreurs : sans argument ou sans journal, code non nul et message en français', () => {
  const r = lancer();
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Usage|usage/);
  const vide = tmp();
  const r2 = lancer(vide);
  assert.notEqual(r2.status, 0);
  assert.match(r2.stderr, /journal/);
});
