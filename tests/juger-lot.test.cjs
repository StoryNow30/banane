'use strict';
/* CH-011 — outil unique `juger-lot`. Données SYNTHÉTIQUES (parties 95 et 96, cuts 9501 et suivants, coordonnées
 * inventées). Rien du terrain. L'essai fixe le tableau standard avant le code :
 *   - cible = décision du lot ; posé = écriture de validation 2xx pendant le lot ; différé = cible sans cette écriture ;
 *   - jugé = posé, dans l'Écho, avec une validation de l'opérateur (écart mesuré) OU « contrôlé, bon » (visite d'au
 *     moins 0,8 s, aucun rail déplacé, aucune validation) ; un posé hors Écho n'est JAMAIS « contrôlé » (il reste sans Écho) ;
 *   - mauvaise voie = pire écart latéral de plus de 100 mm ; > 20 et > 50 : pire rail, 3D ;
 *   - la passe en ombre est à part : « poserait », jugés, « rien », refus de la garde. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const L = require('../tools/juger-lot.cjs');
const S = require('./helpers/jointure-synthetique.cjs');

const G0 = [100, 200, 10], D0 = [101.435, 200, 10];
const proche = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} loin de ${b}`);
const heure = (s) => new Date(Date.UTC(2031, 4, 1, 7, 0, 0) + s * 1000).toISOString();
const id = (cut, partie) => S.identite(cut, partie);
const DEC = (cut, partie, batchId, s) => ({ eventId: `d-${partie}-${cut}`, timestamp: heure(s), type: 'gcv1-shadow-observed', batchId, identity: id(cut, partie),
  lotObservation: { stage: 'first-pass', applied: true, command: { action: 'engine', reason: 'first-pass' } } });
const ECRIT = (cut, s, status = 204) => ({ eventId: `w-${cut}-${s}`, timestamp: heure(s), type: 'esv-observation', kind: 'write', status, rowIndex: cut,
  body: { ExtractionStatus: 'valid', TreatedByOperator: true } });
function pose(cut, partie, s) {
  const i = id(cut, partie);
  return {
    events: [
      { eventId: `av-${cut}`, timestamp: heure(s), type: 'applied-verified', identity: i, observed: { rails: { left: S.rail(G0), right: S.rail(D0) } } },
      { eventId: `va-${cut}`, timestamp: heure(s + 0.1), type: 'validation-accepted', identity: i },
      ECRIT(cut, s + 0.2),
    ],
    record: { recordId: `jr-${cut}`, identity: i, capturedAt: heure(s + 30), rails: {
      left: { initial: S.rail(G0), corrected: S.rail(G0) }, right: { initial: S.rail(D0), corrected: S.rail(D0) } } },
  };
}
const dep = (pos, dx, dy) => S.decaler(pos, dx, dy, 0);
const mm = v => v / 1000;

function lotFictif() {
  const P = 96, B = 'lot-96', BV = 'lot-95';
  const events = [
    { eventId: 'bs-95', timestamp: heure(0), type: 'batch-started', identity: id(0, 95), batch: { id: BV } },
    { eventId: 'bx-95', timestamp: heure(5), type: 'batch-stopped-at-end', identity: null, reason: 'dernier-cut-valide', lastCut: 0 },
    { eventId: 'bs-96', timestamp: heure(10), type: 'batch-started', identity: id(0, P), batch: { id: B } },
  ];
  const records = [];
  const posés = [9501, 9502, 9503, 9504, 9505, 9506, 9507];
  posés.forEach((cut, i) => { const p = pose(cut, P, 20 + i * 5); events.push(DEC(cut, P, B, 19 + i * 5), ...p.events); records.push(p.record); });
  const différés = [9508, 9509, 9510];
  différés.forEach((cut, i) => events.push(DEC(cut, P, B, 60 + i)));
  events.push({ eventId: 'bx-96', timestamp: heure(100), type: 'batch-stopped-at-end', identity: null, reason: 'dernier-cut-valide', lastCut: 9510 });
  const passe = (cut, passe, decision, extra = {}) => ({ eventId: `pa-${cut}-${passe}`, timestamp: heure(110 + cut % 100), type: 'passe-differes-ombre', batchId: B, identity: { part: P, cut }, passe, decision, ...extra });
  events.push(
    passe(9508, 1, 'poserait', { decal: { left: [0, 0, 0], right: [0, 6, 0] }, garde: { bloque: false, motif: 'loin-du-depart' } }),
    passe(9508, 2, 'poserait', { decal: { left: [0, 90, 0], right: [0, 0, 0] } }),
    passe(9509, 1, 'rien', { motif: 'garde-appuis', garde: { bloque: true, motif: 'garde-appuis' } }),
    passe(9510, 1, 'rien', { motif: 'sans-voie' }));
  const v = (cut, debut, secondes, validation, derniere) => S.visite({ session: 'sess-jl', index: cut, cut, partie: P,
    debut: { minutes: debut }, fin: { minutes: debut, secondes }, initiale: [G0, D0], derniere, validation });
  const echo = [
    v(9501, 40, 3, [G0, dep(D0, 0, mm(4))]),
    v(9502, 41, 3, null),                                            // contrôlé : 3 s, rien bougé, pas de validation
    v(9504, 43, 0.3, null),                                          // visite trop courte : non jugé
    v(9505, 44, 3, [G0, dep(D0, 0, mm(30))]),
    v(9506, 45, 3, [G0, dep(D0, mm(60), 0)]),                        // 60 mm longitudinal : > 50 sans être la mauvaise voie
    v(9507, 46, 3, [G0, dep(D0, 0, mm(120))]),                       // 120 mm latéral : mauvaise voie
    v(9508, 47, 3, [G0, dep(D0, 0, mm(5))]),                         // différé : le « poserait » (+6) est à 1 mm de l'opérateur
    v(9509, 48, 3, [G0, dep(D0, 0, mm(80))]),
  ];
  return { journal: { format: 'ariane-journal-v4', version: '4.9.5.23', events, records }, echoRecords: echo };
}
function ecrireEcho(records, nom = 'jl-echo-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), nom));
  S.ecrire(dir, 'ariane-echo-2031-05-01T10-00-00-seg01.json', S.exportEcho({ session: 'sess-jl', debutSession: { minutes: 30 }, stamp: '2031-05-01T10-00-00', records }));
  return dir;
}

test('tableau standard d\'une partie : cibles, posés, différés, jugés, contrôlés, > 20, > 50, mauvaise voie', () => {
  const { journal, echoRecords } = lotFictif();
  const dir = ecrireEcho(echoRecords);
  try {
    const r = L.juger([{ partie: 96, journal, echo: L.lireEcho(dir) }]);
    const p = r.parties.find(x => x.partie === 96);
    assert.equal(p.cibles, 10);
    assert.equal(p.poses, 7);
    assert.equal(p.differes, 3);
    assert.equal(p.sansEcho, 1, '9503 : posé, jamais vu par l\'Écho');
    assert.equal(p.nonJuges, 1, '9504 : vu 0,3 s seulement, ni validation ni durée suffisante');
    assert.equal(p.juges, 5);
    assert.equal(p.dontCorriges, 4, '9501, 9505, 9506, 9507 : l\'opérateur a validé une pose');
    assert.equal(p.dontControles, 1, '9502 : contrôlé, bon');
    assert.equal(p.plusDe20mm, 3);
    assert.equal(p.plusDe50mm, 2);
    assert.equal(p.mauvaiseVoie, 1);
    assert.equal(p.poses, p.juges + p.sansEcho + p.nonJuges, 'chaque posé est classé une seule fois');
    proche(p.precision.maxMm, 120);
    proche(p.precision.medianeMm, 30);
    assert.equal(p.precision.n, 5);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('passe en ombre à part : poserait (passe 1 seulement), jugés contre l\'Écho, rien, refus de la garde', () => {
  const { journal, echoRecords } = lotFictif();
  const dir = ecrireEcho(echoRecords);
  try {
    const p = L.juger([{ partie: 96, journal, echo: L.lireEcho(dir) }]).parties.find(x => x.partie === 96);
    assert.equal(p.ombre.poserait, 1, 'la passe 2 n\'est pas comptée');
    assert.equal(p.ombre.juges, 1);
    proche(p.ombre.precision.medianeMm, 1);
    assert.equal(p.ombre.rien, 2);
    assert.equal(p.ombre.refusGarde, 1);
    assert.equal(p.ombre.plusDe20mm, 0);
    assert.equal(p.ombre.plusDe50mm, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('sans Écho : rien n\'est jugé, aucun posé n\'est « contrôlé »', () => {
  const { journal } = lotFictif();
  const p = L.juger([{ partie: 96, journal, echo: null }]).parties.find(x => x.partie === 96);
  assert.equal(p.poses, 7);
  assert.equal(p.sansEcho, 7);
  assert.equal(p.juges, 0);
  assert.equal(p.dontControles, 0);
  assert.equal(p.precision.n, 0);
  assert.equal(p.ombre.juges, 0);
});

test('partie vide : zéros, aucune division par zéro ; le total additionne les parties', () => {
  const { journal, echoRecords } = lotFictif();
  const dir = ecrireEcho(echoRecords);
  try {
    const r = L.juger([{ partie: 95, journal, echo: L.lireEcho(dir) }, { partie: 96, journal, echo: L.lireEcho(dir) }]);
    const v = r.parties.find(x => x.partie === 95);
    assert.equal(v.cibles, 0);
    assert.equal(v.poses, 0);
    assert.equal(v.juges, 0);
    assert.equal(v.precision.medianeMm, null);
    assert.equal(r.total.cibles, 10);
    assert.equal(r.total.poses, 7);
    assert.equal(r.total.juges, 5);
    assert.equal(r.total.plusDe50mm, 2);
    assert.equal(r.total.mauvaiseVoie, 1);
    assert.equal(r.total.ombre.refusGarde, 1);
    assert.deepEqual(r.total.parties, [95, 96]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('le dernier cut, validé après le début de la relecture, reste un posé', () => {
  const { journal } = lotFictif();
  journal.events.push({ eventId: 'rd', timestamp: heure(49), type: 'relecture-debut', batchId: 'lot-96' });
  journal.events.push({ eventId: 'rd-tard', timestamp: heure(200), type: 'esv-observation', kind: 'write', status: 204, rowIndex: 9508, body: { ExtractionStatus: 'valid', TreatedByOperator: true } });
  const p = L.juger([{ partie: 96, journal, echo: null }]).parties.find(x => x.partie === 96);
  assert.equal(p.poses, 7, 'écriture à 50,2 s, arrêt à 100 s : dans le lot ; celle de 200 s (relecture) n\'en est pas');
  assert.equal(p.differes, 3);
});

test('dossiers Écho : on descend jusqu\'aux dossiers qui portent des exports', () => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-dossiers-'));
  try {
    const sous = path.join(racine, 'collection', 'echo');
    fs.mkdirSync(sous, { recursive: true });
    fs.writeFileSync(path.join(sous, 'ariane-echo-x.zip'), '');
    fs.mkdirSync(path.join(racine, 'vide'));
    assert.deepEqual(L.dossiersEcho([racine]), [sous]);
    assert.deepEqual(L.dossiersEcho([path.join(racine, 'vide')]), [path.join(racine, 'vide')]);
  } finally { fs.rmSync(racine, { recursive: true, force: true }); }
});

test('sorties : le texte dit la population de chaque chiffre et la règle « contrôlé », aucun numéro de cut', () => {
  const { journal, echoRecords } = lotFictif();
  const dir = ecrireEcho(echoRecords);
  try {
    const r = L.juger([{ partie: 96, journal, echo: L.lireEcho(dir) }]);
    const t = L.texte(r);
    assert.match(t, /Partie 96/);
    assert.match(t, /Total/);
    assert.match(t, /sur 7 posés/);
    assert.match(t, /contrôlé, bon/);
    assert.match(t, /seulement si l'Écho/);
    assert.match(t, /mauvaise voie/);
    assert.match(t, /refus de la garde/);
    for (const cut of ['9501', '9505', '9507', '9508']) assert.equal(t.includes(cut), false);
    assert.equal(JSON.stringify(r).includes('9501'), false);
    assert.equal(r.format, L.FORMAT);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('découverte des parties d\'un journal : la dernière exécution de chaque partie', () => {
  const { journal } = lotFictif();
  assert.deepEqual(L.partiesDuJournal(journal), [95, 96]);
});

test('ligne de commande : le dossier d\'export est obligatoire, aucun chemin en dur', () => {
  assert.throws(() => L.lireArguments([]), /dossier/);
  const a = L.lireArguments(['exp', '--echo', 'ec', '--partie', '3', '--json', 'out.json']);
  assert.equal(a.dossier, 'exp');
  assert.deepEqual(a.echo, ['ec']);
  assert.deepEqual([...a.parties], [3]);
  assert.equal(a.json, 'out.json');
  assert.throws(() => L.lireArguments(['exp', '--inconnu']), /inconnu/);
});

/* ---- CH-030 : gestes (acceptation / fine / moyenne / faute) et budget D-223 ---- */
test('geste : un cas limite par seuil (10,0 ; 10,1 ; 50,0 ; 50,1 mm), acceptation seulement si regardé et non touché', () => {
  assert.equal(L.geste(0, true), 'acceptation');
  assert.equal(L.geste(0, false), 'fine', 'une validation, même à 0 mm, est un geste');
  assert.equal(L.geste(10.0, false), 'fine');
  assert.equal(L.geste(10.1, false), 'moyenne');
  assert.equal(L.geste(50.0, false), 'moyenne');
  assert.equal(L.geste(50.1, false), 'faute');
  assert.equal(L.geste(10.0000004, false), 'fine', 'bruit de virgule flottante sous le micromètre ignoré');
  assert.equal(L.geste(NaN, false), null);
});

test('gestes d\'une partie : répartition sur les jugés, par axe et pour le pire rail 3D', () => {
  const { journal, echoRecords } = lotFictif();
  const dir = ecrireEcho(echoRecords);
  try {
    const p = L.juger([{ partie: 96, journal, echo: L.lireEcho(dir) }]).parties.find(x => x.partie === 96);
    const g = p.gestes;
    assert.equal(g.juges, 5);
    const c = (a) => [a.acceptation.k, a.fine.k, a.moyenne.k, a.faute.k];
    assert.deepEqual(c(g.pireRail3d), [1, 1, 1, 2], '9502 accepté ; 4 mm fine ; 30 mm moyenne ; 60 et 120 mm fautes');
    assert.equal(g.pireRail3d.n, 5);
    assert.deepEqual(c(g.lateral), [1, 2, 1, 1], 'latéral : 0 (long. 60 mm), 4, 30, 120 mm');
    assert.deepEqual(c(g.vertical), [1, 4, 0, 0]);
    assert.equal(g.pireRail3d.faute.part, 0.4);
    assert.ok(g.pireRail3d.faute.bas < 0.4 && g.pireRail3d.faute.haut > 0.4, 'intervalle de Wilson');
    assert.equal(g.sous5mm.k, 2, '4 mm et le contrôlé');
    assert.equal(g.sous5mm.n, 5);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('budget D-223 : fautes (> 50 mm) sur les POSÉS, les non jugés ni bons ni mauvais, pire cas et cas semblable', () => {
  const { journal, echoRecords } = lotFictif();
  const dir = ecrireEcho(echoRecords);
  try {
    const b = L.juger([{ partie: 96, journal, echo: L.lireEcho(dir) }]).parties.find(x => x.partie === 96).budgetD223;
    assert.equal(b.plafond, 0.03);
    assert.equal(b.seuilMm, 50);
    assert.equal(b.poses, 7);
    assert.equal(b.juges, 5);
    assert.equal(b.nonJuges, 2, 'sans Écho 1 + non jugés 1');
    assert.equal(b.fautesJugees, 2);
    proche(b.couverture.part, 5 / 7, 0.001);
    proche(b.plancher.part, 2 / 7, 0.001);
    proche(b.pireCas.part, 4 / 7, 0.001);
    assert.equal(b.pireCas.k, 4);
    proche(b.siSemblables.part, 2 / 5, 0.001);
    assert.equal(b.siSemblables.qualification, 'SUPPOSÉ');
    assert.equal(b.tenuSurPlancher, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('budget et gestes sans Écho ou sans pose : aucun jugé, aucune division par zéro, budget non tranché', () => {
  const { journal } = lotFictif();
  const r = L.juger([{ partie: 96, journal, echo: null }, { partie: 95, journal, echo: null }]);
  const p = r.parties.find(x => x.partie === 96), v = r.parties.find(x => x.partie === 95);
  assert.equal(p.gestes.juges, 0);
  assert.equal(p.gestes.pireRail3d.n, 0);
  assert.equal(p.budgetD223.juges, 0);
  assert.equal(p.budgetD223.couverture.part, 0);
  assert.equal(p.budgetD223.siSemblables.part, null);
  assert.equal(p.budgetD223.tenuSurPlancher, true, 'aucune faute connue : plancher 0');
  assert.equal(p.budgetD223.tranche, false);
  assert.equal(v.budgetD223.poses, 0);
  assert.equal(v.budgetD223.plancher.part, null);
  assert.equal(r.total.budgetD223.poses, 7);
});

test('sortie --json étendue : gestes et budget, ni numéro de cut ni liste interne ; le texte dit la population', () => {
  const { journal, echoRecords } = lotFictif();
  const dir = ecrireEcho(echoRecords);
  try {
    const r = L.juger([{ partie: 96, journal, echo: L.lireEcho(dir) }]);
    const s = JSON.stringify(r);
    assert.equal(s.includes('"_ev"'), false);
    for (const cut of ['9501', '9505', '9507']) assert.equal(s.includes(cut), false);
    assert.ok(r.total.gestes && r.total.budgetD223);
    assert.equal(r.total.gestes.pireRail3d.faute.k, 2);
    const t = L.texte(r);
    assert.match(t, /acceptation/);
    assert.match(t, /budget D-223/);
    assert.match(t, /SUPPOSÉ/);
    assert.match(t, /sous 5 mm/);
    assert.match(t, /Wilson/);
    for (const cut of ['9501', '9505', '9507', '9508']) assert.equal(t.includes(cut), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/* ---- CH-030 (travail supplémentaire) : deux lots sur la même partie, le second fermé au départ (« depart-sur-vert ») ---- */
function deuxLots() {
  const P = 97, B1 = 'lot-97a', B2 = 'lot-97b', Q = 98;
  const events = [
    { eventId: 'bs-q', timestamp: heure(0), type: 'batch-started', identity: id(0, Q), batch: { id: 'lot-98' } },   // une autre partie, avant : exécution distincte
    { eventId: 'bs-a', timestamp: heure(10), type: 'batch-started', identity: id(1, P), batch: { id: B1 } },
  ];
  [9701, 9702, 9703, 9704].forEach((cut, i) => { const p = pose(cut, P, 20 + i * 5); events.push(DEC(cut, P, B1, 19 + i * 5), ...p.events); });
  events.push(DEC(9705, P, B1, 50));                                   // différé
  events.push({ eventId: 'bx-a', timestamp: heure(60), type: 'batch-stopped-at-end', identity: null, reason: 'dernier-cut-valide', lastCut: 9705 });
  events.push({ eventId: 'rd-a', timestamp: heure(65), type: 'relecture-debut', batchId: B1 });
  // reprise de la file : nouveau départ sur la même partie, fermé au départ sur un vert (30 s)
  events.push({ eventId: 'bs-b', timestamp: heure(300), type: 'batch-started', identity: id(9704, P), batch: { id: B2 } });
  events.push(DEC(9704, P, B2, 301));
  events.push({ eventId: 'ab-b', timestamp: heure(302), type: 'capture-abandoned', reason: 'depart-sur-vert', identity: id(9704, P) });
  events.push({ eventId: 'bx-b', timestamp: heure(303), type: 'batch-stopped-at-end', identity: null, reason: 'depart-sur-vert', lastCut: 9704 });
  return { format: 'ariane-journal-v4', version: '4.9.5.27', events, records: [] };
}
test('deux lots sur la même partie : cibles = celles des deux lots, le second fermé au départ ne masque pas le premier', () => {
  const p = L.juger([{ partie: 97, journal: deuxLots(), echo: null }]).parties[0];
  assert.equal(p.cibles, 5, 'cinq cuts décidés par le premier lot ; le cut de départ déjà vert du second n\'est pas une cible de plus');
  assert.equal(p.poses, 4);
  assert.equal(p.differes, 1);
});
test('deux lots sur la même partie : un cut différé par le premier lot et posé par le second est posé', () => {
  const j = deuxLots();
  const p2 = pose(9705, 97, 301.5);
  j.events.push(DEC(9705, 97, 'lot-97b', 301.4), ...p2.events);
  const p = L.juger([{ partie: 97, journal: j, echo: null }]).parties[0];
  assert.equal(p.cibles, 5);
  assert.equal(p.poses, 5);
  assert.equal(p.differes, 0);
});
test('une autre partie entre deux lots : exécutions distinctes, seule la dernière compte', () => {
  const j = deuxLots();
  j.events.push({ eventId: 'bs-q2', timestamp: heure(100), type: 'batch-started', identity: id(0, 98), batch: { id: 'lot-98b' } });
  j.events.push({ eventId: 'bs-r', timestamp: heure(500), type: 'batch-started', identity: id(1, 97), batch: { id: 'lot-97c' } });
  j.events.push(DEC(9790, 97, 'lot-97c', 501));
  const p = L.juger([{ partie: 97, journal: j, echo: null }]).parties[0];
  assert.equal(p.cibles, 1, 'lot-97c seul : les lots 97a et 97b sont d\'une exécution antérieure (la partie 98 s\'est intercalée)');
});
test('départ sur vert signalé seulement par l\'arrêt du lot (sans capture-abandoned) : le cut de départ n\'est pas une cible', () => {
  const j = deuxLots();
  j.events = j.events.filter(e => e.eventId !== 'ab-b' && !(e.type === 'gcv1-shadow-observed' && e.batchId === 'lot-97b'));
  j.events.find(e => e.eventId === 'bs-b').identity = id(9799, 97);          // le cut de départ de la reprise n'est pas dans le premier lot
  j.events.push(DEC(9799, 97, 'lot-97b', 301));
  const p = L.juger([{ partie: 97, journal: j, echo: null }]).parties[0];
  assert.equal(p.cibles, 5, 'les cinq cuts du premier lot ; le cut de départ déjà vert de la reprise n\'en est pas un sixième');
  assert.equal(p.differes, 1);
});
test('un arrêt « depart-sur-vert » tardif (après 30 s) n\'enlève rien', () => {
  const j = deuxLots();
  j.events = j.events.filter(e => e.eventId !== 'ab-b');
  j.events.find(e => e.eventId === 'bx-b').timestamp = heure(400);
  const p = L.juger([{ partie: 97, journal: j, echo: null }]).parties[0];
  assert.equal(p.cibles, 5, 'le cut 9704 est déjà une cible du premier lot : l\'union ne le perd pas');
});

test('passe en ombre : un cut que la passe a ÉCRIT est jugé sur la correction seule, sans ajouter le décalage une seconde fois (CH-034 § 8)', () => {
  const { journal, echoRecords } = lotFictif();
  /* La passe a écrit le cut 9508 : l'Écho l'a vu à la pose de la passe, la correction de l'opérateur (5 mm) est relative à elle. */
  journal.events.push({ eventId: 'pe-9508', timestamp: journal.events.find(e => e.eventId === 'pa-9508-1').timestamp, type: 'passe-differes-ecriture', resultat: 'ecrit', batchId: journal.events.find(e => e.eventId === 'pa-9508-1').batchId, identity: { part: 96, cut: 9508 } });
  const dir = ecrireEcho(echoRecords);
  try {
    const p = L.juger([{ partie: 96, journal, echo: L.lireEcho(dir) }]).parties.find(x => x.partie === 96);
    assert.equal(p.ombre.ecrits, 1);
    assert.equal(p.ombre.juges, 1);
    proche(p.ombre.precision.medianeMm, 5);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
