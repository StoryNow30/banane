'use strict';
/* Essais de tools/diag-differes.cjs sur des journaux synthétiques (aucune donnée de terrain). */
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../tools/diag-differes.cjs');

const T0 = Date.parse('2026-10-19T10:00:00Z');
const iso = s => new Date(T0 + s * 1000).toISOString();
const rail = (status, motif) => ({ next: { status, motif } });
function decision(lot, cut, s, lo, { resolus = 2, horsContrat = false, motifs = ['ambiguity', 'ambiguity'] } = {}) {
  const st = i => i < resolus ? 'candidate' : 'unresolved';
  return { type: 'gcv1-shadow-observed', timestamp: iso(s), eventId: `d-${lot}-${cut}-${s}`, batchId: lot, identity: { part: 7, cut }, lidarCaptureId: `cap-${cut}`,
    shadow: { rails: { left: rail(st(0), st(0) === 'candidate' ? null : motifs[0]), right: rail(st(1), st(1) === 'candidate' ? null : motifs[1]) }, summary: { pairGaugeRejected: horsContrat } },
    lotObservation: lo };
}
const valide = (lot, cut, s) => ({ type: 'validation-accepted', timestamp: iso(s), batchId: lot, identity: { part: 7, cut } });
const debut = (lot, s, scope = {}) => ({ type: 'batch-started', timestamp: iso(s), batch: { id: lot, scope: { part: 7, start: 0, end: 999999, extensionVersion: '4.9.5.8', ...scope } } });

function journalSynthetique() {
  const A = 'lot-a', B = 'lot-b';
  return { version: '4.9.5.8', fichesDepart: JSON.stringify([{ batchId: A, partie: 7, invalides: 6, total: 100 }]), events: [
    debut(A, 0, { clicHumain: 'tout-recentre', relecture: 'corriger' }),
    decision(A, 10, 1, { stage: 'first-pass', command: { action: 'engine', reason: 'first-pass' } }), valide(A, 10, 2),
    decision(A, 11, 3, { stage: 'deferred', reason: 'no-anchor', command: { action: 'engine', reason: 'deferred' } }, { resolus: 0, horsContrat: true }),
    decision(A, 12, 4, { stage: 'deferred', reason: 'pair-guard', command: { action: 'defer', reason: 'pair-guard' } }),
    decision(A, 13, 5, { stage: 'deferred', reason: 'left:no-qualified-minimum-near-prediction right:several-minima-near-prediction', command: { action: 'engine', reason: 'deferred' } }, { resolus: 1 }),
    decision(A, 14, 6, { stage: 'window', command: { action: 'engine', reason: 'hors-vue-left' } }, { resolus: 1 }),
    decision(A, 15, 7, { stage: 'deferred', reason: 'first-pass-low-gauge', gaugeMm: 1412, command: { action: 'defer', reason: 'first-pass-low-gauge' } }),
    /* B1 en ombre : avec les voisins validés de la liste d'ESV, le cut 13 aurait été repris depuis la voie. */
    { type: 'b1-ombre', timestamp: iso(5.5), batchId: A, identity: { part: 7, cut: 13 }, etat: 'calcule', regle: 'dernier-recours', candidats: [9, 10, 16], gardes: [],
      hypothese: { stage: 'window', reason: null } },
    /* Le cut 11 est décidé une seconde fois dans le même lot, puis validé : il est posé. */
    decision(A, 11, 8, { stage: 'window', command: { action: 'lot', reason: 'window' } }), valide(A, 11, 9),
    /* La relecture commence : rien après n'entre. Une validation après la coupure ne compte pas. */
    { type: 'relecture-debut', timestamp: iso(10), batchId: A, mode: 'corriger' },
    { type: 'relecture-ombre', timestamp: iso(11), batchId: A, identity: { part: 7, cut: 13 }, role: 'differe' },
    valide(A, 12, 12),
    { type: 'relecture-fin', timestamp: iso(13), batchId: A, corriges: 0 },
    /* Lot B : reprise des différés de A. */
    debut(B, 100, { lotReprise: { fromBatchId: A, deferredCuts: 4, anchors: [{ positions: { left: [1, 2, 3] } }] } }),
    decision(B, 12, 101, { stage: 'choice', command: { action: 'lot', reason: 'choice' } }), valide(B, 12, 102),
    decision(B, 13, 103, { stage: 'deferred', reason: 'gauge-guard', gaugeJumpMm: 31, command: { action: 'defer', reason: 'gauge-guard' } }),
  ] };
}

test('classerMotif : étage et garde de chaque refus', () => {
  const m = (lo, opt) => D.classerMotif(lo, null, opt).code;
  assert.equal(m({ stage: 'deferred', reason: 'no-anchor' }), 'sans-appui');
  assert.equal(m({ stage: 'deferred', reason: 'pair-guard' }), 'garde-de-paire');
  assert.equal(m({ stage: 'deferred', reason: 'gauge-guard' }), 'ecartement-voisin');
  assert.equal(m({ stage: 'deferred', reason: 'first-pass-low-gauge' }), 'ecartement-bas');
  assert.equal(m({ stage: 'deferred', reason: 'gauge-HIGH_INVALID' }), 'choix-hors-contrat');
  assert.equal(m({ stage: 'deferred', reason: 'left:no-qualified-minimum-near-prediction' }), 'reprise-sans-minimum');
  assert.equal(m({ stage: 'deferred', reason: 'right:several-minima-near-prediction' }), 'reprise-plusieurs-minima');
  assert.equal(m({ stage: 'deferred', reason: 'left:frame right:rsf' }), 'reprise-repere');
  assert.equal(m({ stage: 'first-pass', command: { action: 'defer', reason: 'regles-metier' } }), 'regle-grappe');
  assert.equal(m({ stage: 'window', command: { action: 'engine', reason: 'hors-vue-right' } }), 'hors-vue');
  assert.equal(m({ stage: 'window', command: { action: 'defer', reason: 'guard-hors-vue-left' } }), 'hors-vue');
  assert.equal(m({ stage: 'first-pass', command: { action: 'engine', reason: 'first-pass' } }), 'pose-non-validee');
  const sh = { rails: { left: rail('candidate'), right: rail('unresolved', 'flank') }, summary: { pairGaugeRejected: false } };
  const x = D.classerMotif({ stage: 'deferred', reason: 'no-anchor' }, sh);
  assert.equal(x.etage, 'moteur'); assert.equal(x.moteur.resolus, 1); assert.equal(x.moteur.motifs.right, 'flank');
});

test('lotsDuJournal : traités, posés, différés, coupure de la relecture, dernière décision', () => {
  const lots = D.lotsDuJournal(journalSynthetique());
  assert.equal(lots.length, 2);
  const [a, b] = lots;
  assert.equal(a.id, 'lot-a'); assert.equal(a.traites, 6); assert.equal(a.poses, 2); assert.equal(a.differes, 4);
  assert.deepEqual(a.cuts.filter(c => !c.pose).map(c => c.motif.code).sort(), ['ecartement-bas', 'garde-de-paire', 'hors-vue', 'reprise-plusieurs-minima']);
  assert.equal(a.cuts.find(c => c.cut === 11).decisions, 2);
  assert.deepEqual(a.cuts.find(c => c.cut === 13).b1, { etat: 'calcule', regle: 'dernier-recours', stage: 'window', raison: null, candidats: 3, gardes: 0 });
  assert.equal(a.cuts.find(c => c.cut === 12).b1, undefined, 'pas de B1 consigné pour ce cut');
  assert.equal(a.reglages.clic, 'tout-recentre'); assert.equal(a.invalidesAuDepart, 6);
  assert.deepEqual(a.relecture.differesTouches, [13]);
  assert.equal(b.traites, 2); assert.equal(b.differes, 1);
});

test('inventaire : reprise reconnue, base pondérée et non pondérée, net par partie', () => {
  const R = D.inventaire([{ fichier: 'j.json', journal: journalSynthetique() }, { fichier: 'copie.json', journal: journalSynthetique() }],
    { journaux: [{ journal: 'j.json', projet: 2 }, { journal: 'copie.json', projet: 2 }] });
  assert.equal(R.lots.length, 2, 'les copies d\'un même lot sont fusionnées');
  const [a, b] = R.lots;
  assert.equal(a.reprise, false); assert.equal(b.reprise, true);
  assert.deepEqual(b.reglages.reprise, { depuis: 'lot-a', differes: 4 }, 'les appuis du choix « Reprise » ne sont pas recopiés');
  assert.equal(a.fragment, false); assert.equal(b.fragment, true, 'moins de 5 cuts : fragment, hors de la base');
  assert.equal(R.base.total.lots, 1); assert.equal(R.base.total.tauxPondere, 66.7);
  assert.equal(R.base.netParPartie.differes, 3, 'le cut 12 posé par la reprise ne compte plus');
  assert.match(D.inventaireMd(R), /Base : tous les lots/);
  const M = D.motifs([], R);
  assert.equal(M.base.b1.poserait, 1, 'B1 aurait posé le cut 13');
});

/* ------------------------------------------------------------------ extraire (lot synthétique, captures fabriquées) et agrégations */
const fs = require('node:fs'), path = require('node:path');
const F = require('./helpers/gcv2-jeu-fixture.cjs');
const PARAMS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datasets', 'gcv2-parametres-h6.json'), 'utf8'));
const ORIGINE = [458559.4, 6699187.6, 24.0];
const capDe = cut => { const c = F.capture({ cut, graine: 10 + cut, origine: [ORIGINE[0] + cut, ORIGINE[1], ORIGINE[2]] }); return { rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: c.visibleByClipBoxes }; };
const CAPS = new Map([1, 2, 3, 4, 5, 6, 7, 8].map(c => [`cap-${c}`, capDe(c)]));
const VALIDES = [1, 2, 3, 6, 7, 8];
function lotSynthetique() {
  const events = [debut('lot-a', 0)], records = [];
  for (const cut of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const ok = VALIDES.includes(cut), s = 10 * cut;
    events.push({ eventId: `d-${cut}`, timestamp: iso(s), type: 'gcv1-shadow-observed', identity: { part: 7, cut, frameId: 'cadre' }, batchId: 'lot-a', lidarCaptureId: `cap-${cut}`,
      lotObservation: { stage: ok ? 'first-pass' : 'deferred', reason: ok ? null : 'no-anchor', anchorsUsed: [], anchor: ok, anchorHeld: ok, command: { action: 'engine', reason: ok ? 'first-pass' : 'deferred' } } });
    if (!ok) continue;
    events.push({ eventId: `v-${cut}`, timestamp: iso(s + 2), type: 'validation-accepted', batchId: 'lot-a', identity: { part: 7, cut } });
    const cap = CAPS.get(`cap-${cut}`);
    records.push({ cut, part: 7, identity: { part: 7, cut }, capturedAt: iso(s + 1), rails: Object.fromEntries(['left', 'right'].map(sd => [sd, {
      initial: { positionSceneRelative: cap.rails[sd].positionSceneRelative.slice(), sceneRelativeToProfileLocal: cap.rails[sd].sceneRelativeToProfileLocal.slice() },
      corrected: { positionSceneRelative: [cap.rails[sd].positionSceneRelative[0], cap.rails[sd].positionSceneRelative[1] + 0.003, cap.rails[sd].positionSceneRelative[2]] } }])) });
  }
  events.push({ eventId: 'r0', timestamp: iso(200), type: 'relecture-debut', batchId: 'lot-a', mode: 'corriger' });
  return { version: '4.9.5.8', events, records };
}

test('extraire : une ligne par différé, contrefactuels et variantes de la GCV2, aucune coordonnée', () => {
  const mic = new Map([[4, { ref: 'validation', rails: { left: [0, 3, 0], right: [0, 3, 0] }, ecartDepartMm: null }], [5, { ref: null, raison: 'sans-reference' }]]);
  const lignes = D.extrairePartie({ journal: lotSynthetique(), captures: CAPS, parametres: PARAMS, projet: 9, partie: 7, mic });
  assert.equal(lignes[0].type, 'entete');
  const L = lignes.slice(1);
  assert.deepEqual(L.map(l => l.cut), [4, 5]);
  const texte = JSON.stringify(lignes);
  for (const v of ['458559', '458560', '6699187']) assert.ok(!texte.includes(v), 'aucune coordonnée de scène');
  for (const l of L) {
    assert.equal(l.etat, 'calcule'); assert.equal(l.motif.code, 'sans-appui');
    assert.ok(l.hyps.left.length && l.hyps.left.some(h => h.o.includes('H0')));
    assert.equal(Object.keys(l.gcv2).length, D.COULOIRS.length * 8);
    assert.deepEqual(Object.keys(l.contrefactuels), Object.keys(D.CONTREFACTUELS));
    assert.equal(l.contrefactuels.base.stage, l.rejeu.etage, 'le contrefactuel « base » est la décision rejouée');
    assert.equal(l.contexte.validesAvant, 3);
  }
  /* Le départ de l'Écho est contrôlé : écartement inconnu → non jugé. */
  assert.equal(D.juge(L[0]), false);
  L[0].mic.ecartDepartMm = L[0].depart.ecartementMm;
  assert.equal(D.juge(L[0]), true);
  const G = D.gains(L);
  assert.equal(G.juges, 1); assert.equal(G.nonJuges.sansReferenceMic, 1);
  assert.equal(G.principal.n, 1);
  assert.ok(G.principal.rappel50 <= 1);
  const M = D.motifs(L); assert.equal(M.parMotif[0].motif, 'sans-appui');
  const Gd = D.gardes(L); assert.equal(Gd.lot.length, D.GARDES_LOT.length); assert.equal(Gd.gcv2.length, D.GARDES_GCV2.length);
  const Pi = D.pistes(L, 10); assert.ok(Pi.pistes.length > 5);
  for (const md of [D.motifsMd(M), D.gainsMd(G), D.gardesMd(Gd), D.pistesMd(Pi)]) assert.ok(md.length > 50);
});

test('gcv2Variantes : couloirs, τ, δ et écartement allumés ou éteints', () => {
  const h = (lat, vert, g) => ({ decal: [0, lat, vert], g });
  const k = { zone: 'adv', G0: 1500, gMed: 1435, i0: { left: 0, right: 0 }, voieRef: null,
    rails: { left: { hyps: [h(0, 0, 1500), h(-30, 0, 1470), h(-80, 0, 1420)] }, right: { hyps: [h(0, 0, 1500), h(35, 0, 1465)] } } };
  const p = { left: Float64Array.from([0.1, 0.5, 0.9]), right: Float64Array.from([0.1, 0.9]) };
  const seuils = { adv: { actif: true, tau: 0.6, delta: 5 } };
  const v = D.gcv2Variantes(k, p, seuils);
  assert.deepEqual(v['voie|1|1|1'].slice(0, 3), ['laisse', 0, 0], 'sans voie de série : rien');
  assert.deepEqual(v['depart|1|1|1'].slice(0, 3), ['abstient', 1, 1], 'couloir de 45 mm : la paire à -30/+35, sous τ (0,45)');
  assert.deepEqual(v['depart|0|1|1'].slice(0, 3), ['agit', 1, 1], 'sans τ : elle agit');
  /* écartement de la paire à -80/+35 : 1500 + (1420-1500) + (1465-1500) = 1385 : hors contrat et loin de la médiane ; gardé, il la refuse. */
  assert.deepEqual(v['aucun|1|1|1'].slice(0, 3), ['abstient', 1, 1], 'sans couloir mais écartement gardé : la paire à -80 est refusée');
  assert.deepEqual(v['aucun|1|1|0'].slice(0, 3), ['agit', 2, 1], 'sans couloir ni écartement : la paire à -80 (0,81) passe τ');
  k.voieRef = { sure: false, motifs: ['sans-support-local'], left: [-30, 0], right: [35, 0] };
  const w = D.gcv2Variantes(k, p, seuils);
  assert.equal(w['voie|1|1|1'][0], 'laisse');
  assert.deepEqual(w['voie-sans-support|0|1|1'].slice(0, 3), ['agit', 1, 1], 'la voie sans la preuve de support : la paire de la voie');
});

test('scienceSansContrat : seuls les rails retirés par le contrat d\'écartement reprennent leur proposition', () => {
  const sc = { summary: { pairGaugeRejected: true }, rails: {
    left: { ok: true, next: { status: 'unresolved', motif: 'gauge-out-of-contract', rawDelta: [0, 0.01, 0] } },
    right: { ok: true, next: { status: 'unresolved', motif: 'ambiguity', rawDelta: [0, 0.02, 0] } } } };
  const x = D.scienceSansContrat(sc);
  assert.equal(x.rails.left.next.status, 'candidate'); assert.deepEqual(x.rails.left.next.delta, [0, 0.01, 0]);
  assert.equal(x.rails.right.next.status, 'unresolved');
  assert.equal(x.summary.pairGaugeRejected, false); assert.equal(sc.summary.pairGaugeRejected, true, 'la science d\'origine n\'est pas touchée');
  assert.equal(D.scienceSansContrat({ summary: { pairGaugeRejected: false }, rails: {} }), null);
});
