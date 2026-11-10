'use strict';
/* CH-100 (mesure 2) — la deuxième passe jugée hors ligne. Données SYNTHÉTIQUES (partie 98, cuts 9801 et suivants, coordonnées
 * inventées). Rien du terrain. Règles fixées par l'essai :
 *   - une décision par cut : la PREMIÈRE dans le temps, même si le journal n'est pas rangé dans l'ordre du temps ;
 *   - écriture réelle : l'écart est la correction de l'opérateur depuis la pose écrite (jamais le décalage ajouté une seconde fois) ;
 *   - « poserait » non écrit : écart entre le décalage de l'ombre et la pose finale de l'opérateur ;
 *   - refus de la garde A : la pose refusée est jugée comme une ombre (bonne pose retirée = 10 mm ou moins) ;
 *   - ombre et écriture ne sont jamais additionnées ; un cut sans Écho n'est pas jugé. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const Passe = require('../tools/ch100-passe.cjs');
const L = require('../tools/juger-lot.cjs');
const S = require('./helpers/jointure-synthetique.cjs');

const G0 = [100, 200, 10], D0 = [101.435, 200, 10], P = 98, B = 'lot-98';
const heure = (s) => new Date(Date.UTC(2031, 4, 1, 7, 0, 0) + s * 1000).toISOString();
const id = (cut) => S.identite(cut, P);
const mm = v => v / 1000, dep = (pos, dy) => S.decaler(pos, 0, dy, 0);
const ombre = (cut, s, passe, decision, extra = {}) => ({ eventId: `po-${cut}-${passe}`, timestamp: heure(s), type: 'passe-differes-ombre', batchId: B, identity: { part: P, cut }, passe, decision, ...extra });
const DEC = (cut, s) => ({ eventId: `d-${cut}`, timestamp: heure(s), type: 'gcv1-shadow-observed', batchId: B, identity: id(cut) });

function lotFictif() {
  const events = [{ eventId: 'bs', timestamp: heure(0), type: 'batch-started', identity: id(9800), batch: { id: B } }];
  for (const c of [9801, 9802, 9803, 9804, 9805]) events.push(DEC(c, 10), { eventId: `df-${c}`, timestamp: heure(11), type: 'defer-finalized', batchId: B, identity: id(c), status: 'deferred', rails: {} });
  events.push({ eventId: 'bx', timestamp: heure(20), type: 'batch-stopped-at-end', identity: null, reason: 'dernier-cut-valide', lastCut: 9805 });
  events.push(
    /* 9801 : la passe 2 (« poserait ») est rangée AVANT la passe 1 (« rien ») dans le fichier : la première dans le temps est « rien ». */
    ombre(9801, 40, 2, 'poserait', { decal: { left: [0, 0, 0], right: [0, 90, 0] } }),
    ombre(9801, 30, 1, 'rien', { motif: 'sans-voie' }),
    /* 9802 : « poserait » puis ÉCRIT ; l'opérateur corrige la pose écrite de 4 mm. */
    ombre(9802, 31, 1, 'poserait', { decal: { left: [0, 0, 0], right: [0, 60, 0] }, garde: { bloque: false, motif: 'loin-du-depart' } }),
    { eventId: 'pe-9802', timestamp: heure(50), type: 'passe-differes-ecriture', batchId: B, identity: { part: P, cut: 9802 }, passe: 1, decal: { left: [0, 0, 0], right: [0, 60, 0] }, resultat: 'ecrit' },
    /* 9803 : « poserait » non écrit (+6 mm au rail droit) ; l'opérateur pose à +5 mm : ombre à 1 mm. */
    ombre(9803, 32, 1, 'poserait', { decal: { left: [0, 0, 0], right: [0, 6, 0] }, garde: { bloque: false, motif: 'appui-normal' } }),
    /* 9804 : refus de la garde A ; la pose refusée (+80 mm) est à 2 mm de l'opérateur (+78) : bonne pose retirée. */
    ombre(9804, 33, 1, 'rien', { motif: 'garde-appuis', decal: { left: [0, 0, 0], right: [0, 80, 0] }, garde: { bloque: true, motif: 'garde-appuis' } }),
    /* 9805 : « poserait » non écrit, jamais vu par l'Écho. */
    ombre(9805, 34, 1, 'poserait', { decal: { left: [0, 0, 0], right: [0, 200, 0] } }),
    { eventId: 'pf', timestamp: heure(60), type: 'passe-differes-ombre-fin', batchId: B, mode: 'ecriture', differes: 5 });
  const v = (cut, minute, initiale, validation) => S.visite({ session: 'sess-p2', index: cut, cut, partie: P, debut: { minutes: minute }, fin: { minutes: minute, secondes: 3 }, initiale, validation });
  const ecrite = [G0, dep(D0, mm(60))];
  const echo = [
    v(9802, 40, ecrite, [G0, dep(D0, mm(64))]),      // l'Écho voit la pose ÉCRITE ; correction de 4 mm
    v(9803, 41, [G0, D0], [G0, dep(D0, mm(5))]),
    v(9804, 42, [G0, D0], [G0, dep(D0, mm(78))]),
  ];
  return { journal: { format: 'ariane-journal-v4', version: 'test', build: 'synth', events, records: [] }, echo };
}
function mesurer() {
  const { journal, echo } = lotFictif();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-echo-'));
  S.ecrire(dir, 'ariane-echo-2031-05-01T10-00-00-seg01.json', S.exportEcho({ session: 'sess-p2', debutSession: { minutes: 30 }, stamp: '2031-05-01T10-00-00', records: echo }));
  try {
    const e = L.lireEcho(dir), lots = Passe.lotsDuJournal(journal, { collection: 'synthetique', version: 'test', build: 'synth' });
    const inventaire = [], cuts = [];
    const debut = new Map(echo.map(r => [r.identity.cut, Date.parse(r.startedAt)]));
    for (const lot of lots) Passe.traiterLot(lot, (partie) => L.indexLignes(journal, e, partie), inventaire, cuts, (partie, cut) => debut.get(cut) ?? null);
    return { inventaire, cuts, par: new Map(cuts.map(c => [c.cut, c])) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('une décision par cut : la première dans le temps, pas dans l\'ordre du fichier', () => {
  const { inventaire, par } = mesurer();
  assert.equal(inventaire.length, 1);
  const inv = inventaire[0];
  assert.equal(inv.mode, 'ecriture');
  assert.equal(inv.cutsDecides, 5);
  assert.equal(inv.poserait, 3, '9802, 9803, 9805 ; 9801 est « rien » à sa première décision');
  assert.equal(inv.rien, 2);
  assert.equal(inv.refusGarde, 1);
  assert.equal(inv.ecrits, 1);
  assert.equal(par.get(9801).premiereDecision, 'rien');
  assert.equal(par.get(9801).poseraitEnsuite, true);
  assert.equal(par.get(9801).type, 'rien');
});

test('écriture réelle : l\'écart est la correction depuis la pose écrite, pas le décalage compté deux fois', () => {
  const c = mesurer().par.get(9802);
  assert.equal(c.type, 'ecriture');
  assert.equal(c.etat, 'valide');
  assert.ok(Math.abs(c.mm - 4) < 0.05, `4 mm attendus, ${c.mm} lus`);
  assert.equal(c.classe, 'juste');
});

test('« poserait » non écrit et refus de la garde A : jugés contre la pose finale de l\'opérateur, à part des écritures', () => {
  const { cuts, par } = mesurer();
  assert.equal(par.get(9803).type, 'ombre-poserait');
  assert.ok(Math.abs(par.get(9803).mm - 1) < 0.05);
  assert.equal(par.get(9804).type, 'refus-garde');
  assert.ok(Math.abs(par.get(9804).mm - 2) < 0.05, 'bonne pose retirée par la garde A');
  assert.equal(par.get(9804).classe, 'juste');
  assert.equal(par.get(9805).etat, 'sans-echo');
  assert.equal(par.get(9805).mm, null);
  const ecritures = Passe.bilan(cuts.filter(c => c.type === 'ecriture')), ombres = Passe.bilan(cuts.filter(c => c.type === 'ombre-poserait'));
  assert.equal(ecritures.valides.n, 1);
  assert.equal(ombres.valides.n, 1);
  assert.equal(ombres.sansEcho, 1);
});
