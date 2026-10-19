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
});
