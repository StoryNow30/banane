'use strict';
/* CH-100 (point 4) — le juge des « posés faux ». Données SYNTHÉTIQUES (partie 97, cuts 9701 et suivants, coordonnées
 * inventées). Rien du terrain. L'essai fixe les règles avant le code :
 *   - population : cuts posés par Ariane dans le lot (écriture de validation 2xx) et cuts écrits par la deuxième passe, à part ;
 *   - UNE définition : mauvaise voie = plus de 50 mm, pire rail, 3D ; juste = 10 mm ou moins ; entre les deux = « 10 à 50 » ;
 *   - une validation sans mouvement de moins de 1,5 s est écartée (D-285) et comptée ;
 *   - « visité sans action » : compté à part, chaque taux donné avec et sans ;
 *   - séries : fautes voisines (au plus 10 cuts d'écart, aucun cut jugé à 50 mm ou moins entre elles) ;
 *   - séance tirée au sort : seules les plages marquées « * » de la liste comptent pour le taux, les autres jugés sont « hors tirage ». */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const Juge = require('../tools/juge-poses-faux.cjs');
const L = require('../tools/juger-lot.cjs');
const S = require('./helpers/jointure-synthetique.cjs');

const G0 = [100, 200, 10], D0 = [101.435, 200, 10], P = 97, B = 'lot-97';
const heure = (s) => new Date(Date.UTC(2031, 4, 1, 7, 0, 0) + s * 1000).toISOString();
const id = (cut) => S.identite(cut, P);
const mm = v => v / 1000;
const dep = (pos, dy) => S.decaler(pos, 0, dy, 0);
const DEC = (cut, s) => ({ eventId: `d-${cut}`, timestamp: heure(s), type: 'gcv1-shadow-observed', batchId: B, identity: id(cut) });
const ECRIT = (cut, s) => ({ eventId: `w-${cut}`, timestamp: heure(s), type: 'esv-observation', kind: 'write', status: 204, rowIndex: cut, body: { ExtractionStatus: 'valid', TreatedByOperator: true } });
function pose(cut, s) {
  return { events: [DEC(cut, s - 1),
    { eventId: `av-${cut}`, timestamp: heure(s), type: 'applied-verified', identity: id(cut), observed: { rails: { left: S.rail(G0), right: S.rail(D0) } } },
    { eventId: `va-${cut}`, timestamp: heure(s + 0.1), type: 'validation-accepted', identity: id(cut) }, ECRIT(cut, s + 0.2)],
  record: { recordId: `jr-${cut}`, identity: id(cut), capturedAt: heure(s + 0.3), rails: { left: { initial: S.rail(G0), corrected: S.rail(G0) }, right: { initial: S.rail(D0), corrected: S.rail(D0) } } } };
}

/* Posés du lot : 9701 à 9712. Différés : 9720 (écrit par la passe), 9721 (jamais posé). */
function lotFictif() {
  const events = [{ eventId: 'bs', timestamp: heure(0), type: 'batch-started', identity: id(9700), batch: { id: B } }], records = [];
  for (let c = 9701, i = 0; c <= 9712; c++, i++) { const p = pose(c, 10 + i * 3); events.push(...p.events); records.push(p.record); }
  for (const c of [9720, 9721]) events.push(DEC(c, 60), { eventId: `df-${c}`, timestamp: heure(60.5), type: 'defer-finalized', identity: id(c), status: 'deferred', rails: {} });
  events.push({ eventId: 'bx', timestamp: heure(70), type: 'batch-stopped-at-end', identity: null, reason: 'dernier-cut-valide', lastCut: 9721 });
  events.push({ eventId: 'pe', timestamp: heure(90), type: 'passe-differes-ecriture', batchId: B, identity: { part: P, cut: 9720 }, passe: 1, decal: { left: [0, 0, 0], right: [0, 0, 0] }, resultat: 'ecrit' });
  const v = (cut, minute, secondes, validation, etiquette) => S.visite({ session: 'sess-jp', index: cut, cut, partie: P,
    debut: { minutes: minute }, fin: { minutes: minute, secondes }, initiale: [G0, D0], validation, etiquette });
  const echo = [
    v(9701, 40, 3, [G0, dep(D0, mm(4))]),                            // juste (4 mm)
    v(9702, 41, 3, [G0, D0], 'VALIDATE_NO_MOVEMENT'),                // validation sans mouvement, 3 s : jugée, 0 mm
    v(9703, 42, 0.9, [G0, D0], 'VALIDATE_NO_MOVEMENT'),              // validation sans mouvement, 0,9 s : ÉCARTÉE (D-285)
    v(9704, 43, 3, null),                                            // visité sans action, 3 s : à part
    v(9705, 44, 3, [G0, dep(D0, mm(30))]),                           // 10 à 50
    v(9706, 45, 3, [dep(G0, mm(120)), dep(D0, mm(120))]),            // faute, série A
    v(9707, 46, 3, [dep(G0, mm(130)), dep(D0, mm(130))]),            // faute, série A
    /* 9708 : pas dans l'Écho (sans Écho) : ne coupe pas la série */
    v(9709, 48, 3, [G0, dep(D0, mm(60))]),                           // faute, série A (60 mm : la définition unique est 50 mm en 3D, pas 100 mm en latéral)
    v(9710, 49, 3, [G0, dep(D0, mm(2))]),                            // juste : coupe la série
    v(9711, 50, 3, [G0, dep(D0, mm(80))]),                           // faute, série B
    v(9712, 51, 0.3, null),                                          // vu trop peu : non jugé
    v(9720, 52, 3, [G0, dep(D0, mm(70))]),                           // écrit par la passe, corrigé de 70 mm : faute de la passe, à part
  ];
  return { journal: { format: 'ariane-journal-v4', version: 'test', build: 'synth', events, records }, echo };
}
function avecEcho(records, f) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-echo-'));
  S.ecrire(dir, 'ariane-echo-2031-05-01T10-00-00-seg01.json', S.exportEcho({ session: 'sess-jp', debutSession: { minutes: 30 }, stamp: '2031-05-01T10-00-00', records }));
  try { return f(L.lireEcho(dir)); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('juge des posés faux : une définition (50 mm, pire rail, 3D), écartés D-285, visités sans action à part', () => {
  const { journal, echo } = lotFictif();
  avecEcho(echo, (e) => {
    const r = Juge.juger({ journal, echo: e, parties: [P] }), p = r.parties[0];
    assert.equal(p.poses, 12);
    assert.equal(p.sansEcho, 1, '9708');
    assert.equal(p.nonJuges, 1, '9712');
    assert.equal(p.ecartesD285, 1, '9703');
    assert.equal(p.visitesSansAction, 1, '9704');
    assert.equal(p.valides.n, 8, '9701, 9702, 9705, 9706, 9707, 9709, 9710, 9711');
    assert.equal(p.valides.justes, 3);
    assert.equal(p.valides.de10a50, 1);
    assert.equal(p.valides.fautes, 4);
    assert.equal(p.avecVisites.n, 9);
    assert.equal(p.avecVisites.justes, 4);
    assert.equal(p.avecVisites.fautes, 4);
    assert.equal(p.poses, p.sansEcho + p.nonJuges + p.ecartesD285 + p.visitesSansAction + p.valides.n, 'chaque posé classé une fois');
    const w = p.valides.wilsonFautes;
    assert.equal(w.k, 4); assert.equal(w.n, 8); assert.ok(w.bas > 0.2 && w.haut < 0.8);
  });
});

test('séries : fautes voisines regroupées, un cut jugé bon coupe, un cut sans Écho ne coupe pas', () => {
  const { journal, echo } = lotFictif();
  avecEcho(echo, (e) => {
    const p = Juge.juger({ journal, echo: e, parties: [P] }).parties[0];
    assert.deepEqual(p.series.map(s => [s.debut, s.fin, s.fautes]), [[9706, 9709, 3], [9711, 9711, 1]]);
    assert.equal(p.plages.n, 1, 'plages jugées : cuts jugés à 10 cuts d\'écart au plus, ici une seule (9701 à 9711)');
    assert.equal(p.plages.fautives, 1);
    const q = Juge.juger({ journal, echo: e, parties: [P], ecartSerie: 1 }).parties[0];
    assert.deepEqual(q.series.map(s => [s.debut, s.fin, s.fautes]), [[9706, 9707, 2], [9709, 9709, 1], [9711, 9711, 1]]);
  });
});

test('la deuxième passe est jugée à part, jamais additionnée au lot', () => {
  const { journal, echo } = lotFictif();
  avecEcho(echo, (e) => {
    const p = Juge.juger({ journal, echo: e, parties: [P] }).parties[0];
    assert.equal(p.passe.ecrits, 1);
    assert.equal(p.passe.valides.n, 1);
    assert.equal(p.passe.valides.fautes, 1);
    assert.ok(!p.cuts.some(c => c.cut === 9720 && c.source === 'lot'));
    assert.ok(!p.cuts.some(c => c.cut === 9721), 'un différé jamais posé n\'est pas un posé');
  });
});

test('séance tirée au sort : seules les plages marquées comptent, le reste est « hors tirage »', () => {
  const { journal, echo } = lotFictif();
  const liste = ['Séance Écho tirée au sort — paquet synth — graine 1', '', 'PLAGES POSÉES (dans l\'ordre ; * = tirée au sort pour la séance courte) :',
    `  * partie ${P} : 9701 à 9706   (6)`, `    partie ${P} : 9707 à 9712   (6)`, '', 'DIFFÉRÉS DU LOT (tous) :', `    partie ${P} : 9720 (posé par la deuxième passe)`, `    partie ${P} : 9721`].join('\n');
  const t = Juge.lireTirage(liste);
  assert.deepEqual(t.plages, [{ partie: P, debut: 9701, fin: 9706, tiree: true }, { partie: P, debut: 9707, fin: 9712, tiree: false }]);
  assert.deepEqual(t.differes, [{ partie: P, cut: 9720 }, { partie: P, cut: 9721 }]);
  avecEcho(echo, (e) => {
    const p = Juge.juger({ journal, echo: e, parties: [P], tirage: t }).parties[0];
    assert.equal(p.tirage.tires, 6);
    assert.equal(p.tirage.valides.n, 4, '9701, 9702, 9705, 9706 ; 9703 écarté, 9704 visité sans action');
    assert.equal(p.tirage.valides.fautes, 1);
    assert.equal(p.tirage.couverture.k, 5, 'jugés avec les visités sans action, sur 6 tirés');
    assert.equal(p.horsTirage.valides.n, 4);
    assert.equal(p.horsTirage.valides.fautes, 3);
  });
});

test('sortie par cut : numéros et millimètres seulement, aucun identifiant', () => {
  const { journal, echo } = lotFictif();
  avecEcho(echo, (e) => {
    const r = Juge.juger({ journal, echo: e, parties: [P] });
    const csv = Juge.enCsv(r);
    assert.match(csv.split('\n')[0], /^partie;cut;source;etat;classe;mm;gaucheMm;droiteMm;dureeVisiteS;serie;tire$/);
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}/i.test(csv));
    assert.ok(!/page-synth|sess-jp/.test(JSON.stringify(r)));
    assert.match(Juge.texte(r), /mauvaise voie \(plus de 50 mm, pire rail, 3D\)/);
  });
});
