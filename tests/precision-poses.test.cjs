'use strict';
/* CH-009 — précision des poses GCV2. Données SYNTHÉTIQUES (parties 97 et 98, cuts 9101 et suivants,
 * coordonnées inventées). Rien du terrain. L'essai fixe la définition avant le calcul :
 *   - seule la commande gcv2-l1 du lot entre dans la population ; une pose de chaîne n'y entre pas ;
 *   - l'écart est celui de la pose du lot (applied-verified, pas un record réécrit après) à la dernière
 *     validation de l'Écho ; une visite sans validation n'est pas un 0 mm ;
 *   - la passe en ombre (poserait, passe 1) est un tableau à part ;
 *   - la zone grise est |écart − 5| ≤ 1,5 mm ou |écart − 10| ≤ 1,5 mm. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const P = require('../tools/precision-poses.cjs');
const S = require('./helpers/jointure-synthetique.cjs');

const G0 = [100, 200, 10], D0 = [101.435, 200, 10];
const mm = (pos, dy) => S.decaler(pos, 0, dy / 1000, 0);
const proche = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} loin de ${b}`);

test('compteurs : seuils inclusifs, zone grise à ±1,5 mm, Wilson et médiane reproductibles', () => {
  const c = P.compter([0, 3.4, 4, 6.5, 8.6, 10, 20, 51]);
  assert.equal(c.n, 8);
  assert.equal(c.auPlus2mm.k, 1);
  assert.equal(c.auPlus5mm.k, 3);      // 0, 3,4 et 4 ; 6,5 est au-delà de 5
  assert.equal(c.auPlus10mm.k, 6);     // + 6,5, 8,6 et 10
  assert.equal(c.plusDe20mm.k, 1);     // 20 n'est pas « plus de 20 »
  assert.equal(c.plusDe50mm.k, 1);
  assert.equal(c.zoneGrise.k, 4);      // 4 (seuil 5), 6,5 (seuil 5), 8,6 (seuil 10), 10 (seuil 10)
  assert.equal(c.zoneParSeuil[5].k, 2);
  assert.equal(c.zoneParSeuil[10].k, 2);
  assert.equal(c.zoneParSeuil[2].k, 1); // 3,4 mm est à 1,4 mm du seuil 2 ; 0 en est à 2 mm, hors zone
  proche(c.medianeMm, 7.55);           // [0, 3.4, 4, 6.5, 8.6, 10, 20, 51], rang 3,5
  assert.equal(c.maxMm, 51);
  assert.ok(c.auPlus5mm.bas < c.auPlus5mm.part && c.auPlus5mm.part < c.auPlus5mm.haut);
  assert.ok(c.icMediane[0] <= c.medianeMm && c.medianeMm <= c.icMediane[1]);
  assert.deepEqual(c.icMediane, P.compter([0, 3.4, 4, 6.5, 8.6, 10, 20, 51]).icMediane);
  const un = P.compter([12]);
  assert.equal(un.n, 1);
  assert.deepEqual(un.icMediane, [null, null]);
  assert.equal(un.auPlus10mm.k, 0);
  assert.equal(P.compter([]).n, 0);
  assert.equal(P.compter([]).medianeMm, null);
});

function poseLot({ cut, partie, gauche, droit, commande }) {
  const id = S.identite(cut, partie);
  const obs = { rails: { left: S.rail(gauche), right: S.rail(droit) } };
  const cmd = commande || { action: 'lot', reason: 'gcv2-l1', l1s: 'gcv2' };
  return {
    events: [
      { eventId: `d-${cut}`, timestamp: '2031-05-01T07:00:00.000Z', type: 'gcv1-shadow-observed', identity: id,
        lotObservation: { stage: cmd.reason === 'gcv2-l1' ? 'deferred' : 'first-pass', applied: true, command: cmd } },
      { eventId: `av-${cut}`, timestamp: '2031-05-01T07:00:01.000Z', type: 'applied-verified', identity: id, observed: obs },
      { eventId: `va-${cut}`, timestamp: '2031-05-01T07:00:02.000Z', type: 'validation-accepted', identity: id },
    ],
    record: { recordId: `jr-${cut}`, identity: id, capturedAt: '2031-05-01T07:01:00.000Z', rails: {
      left: { initial: S.rail(gauche), corrected: S.rail(gauche) },
      right: { initial: S.rail(droit), corrected: S.rail(droit) } } },
  };
}

function echoDe(records) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prec-echo-'));
  S.ecrire(dir, 'ariane-echo-2031-05-01T10-00-00-seg01.json', S.exportEcho({
    session: 'sess-synth', debutSession: { minutes: 30 }, stamp: '2031-05-01T10-00-00', records,
  }));
  return dir;
}

test('journal et Écho fictifs : la pose du lot, la chaîne exclue, la passe à part, le record réécrit ignoré', () => {
  const p = 97;
  const g = G0, d = D0;
  const a = poseLot({ cut: 9101, partie: p, gauche: g, droit: d });                         // +4 mm, dans la zone grise de 5
  const b = poseLot({ cut: 9102, partie: p, gauche: g, droit: d });                         // +3,4 mm, hors zone grise
  const c = poseLot({ cut: 9103, partie: p, gauche: g, droit: d });                         // +51 mm
  const sans = poseLot({ cut: 9104, partie: p, gauche: g, droit: d });                      // pas d'Écho
  const vu = poseLot({ cut: 9105, partie: p, gauche: g, droit: d });                        // visité, pas validé
  const ecrase = poseLot({ cut: 9106, partie: p, gauche: g, droit: d });                    // record réécrit à +40 mm
  ecrase.record.rails.right.corrected = S.rail(mm(d, 40));
  ecrase.record.capturedAt = '2031-05-01T11:00:00.000Z';
  const chaine = poseLot({ cut: 9107, partie: p, gauche: g, droit: d, commande: { action: 'engine', reason: 'first-pass' } });
  const idOmbre = S.identite(9199, p), idSans = S.identite(9198, p);
  const ombre = { eventId: 'ombre-9199', timestamp: '2031-05-01T08:00:00.000Z', type: 'passe-differes-ombre', identity: idOmbre, passe: 1, decision: 'poserait', decal: { left: [0, 6, 0], right: [0, 0, 0] } };
  const ombrePasse2 = { ...ombre, eventId: 'ombre-9199-p2', passe: 2, decal: { left: [0, 100, 0], right: [0, 0, 0] } };
  const ombreSans = { eventId: 'ombre-9198', timestamp: '2031-05-01T08:00:01.000Z', type: 'passe-differes-ombre', identity: idSans, passe: 1, decision: 'poserait', decal: { left: [0, 80, 0], right: [0, 0, 0] } };
  const finLot = { eventId: 'passe-fin', timestamp: '2031-05-01T08:00:00.000Z', type: 'passe-differes-ombre-fin' };
  const events = [finLot, ...[a, b, c, sans, vu, ecrase, chaine].flatMap(x => x.events), ombre, ombrePasse2, ombreSans];
  const records = [a, b, c, sans, vu, ecrase, chaine].map(x => x.record);
  const journal = { format: 'ariane-journal-v4', version: '4.9.5.21', events, records };
  const visite = (cut, dy, validation) => S.visite({
    session: 'sess-synth', index: cut, cut, partie: p, debut: { minutes: 40 }, fin: { minutes: 40, secondes: 3 },
    initiale: [g, d], validation: validation ? [g, mm(d, dy)] : null,
  });
  const echoDir = echoDe([
    visite(9101, 4, true), visite(9102, 3.4, true), visite(9103, 51, true),
    visite(9105, 0, false), visite(9106, 0, true), visite(9107, 30, true),
    visite(9199, 0, true),
  ]);
  const q = 98;
  const lot98 = poseLot({ cut: 9201, partie: q, gauche: g, droit: d });
  const journal98 = { format: 'ariane-journal-v4', version: '4.9.5.23', events: [...lot98.events, finLot], records: [lot98.record] };
  const echo98 = echoDe([S.visite({
    session: 'sess-98', index: 1, cut: 9201, partie: q, debut: { minutes: 50 }, fin: { minutes: 50, secondes: 4 },
    initiale: [g, d], validation: [g, mm(d, 12)],
  })]);
  try {
    const echo = P.lireEcho(echoDir), echoB = P.lireEcho(echo98);
    const r = P.juger([
      { partie: p, version: '4.9.5.21', reglage: 'reglage', collection: 'synthetique-97', journal, echo },
      { partie: q, version: '4.9.5.23', reglage: 'examen', collection: 'synthetique-98', journal: journal98, echo: echoB },
    ]);
    const a97 = r.parties.find(x => x.partie === p), a98 = r.parties.find(x => x.partie === q);
    assert.equal(a97.population.posesLot, 6, 'la chaîne (9107) n\'est pas une pose GCV2');
    assert.equal(a97.precision.n, 4);
    assert.equal(a97.population.sansEcho, 1);
    assert.equal(a97.population.sansPoseFinale, 1);
    assert.equal(a97.population.recordDifferent, 1);
    proche(a97.precision.medianeMm, 3.7); // 0, 3,4, 4, 51
    assert.equal(a97.precision.auPlus5mm.k, 3);
    assert.equal(a97.precision.plusDe50mm.k, 1);
    assert.equal(a97.precision.maxMm, 51);
    assert.equal(a97.precision.zoneGrise.k, 1); // seul 4 mm est à ±1,5 de 5
    assert.equal(a97.ombre.poserait, 2);
    assert.equal(a97.ombre.precision.n, 1);
    proche(a97.ombre.precision.medianeMm, 6);
    assert.equal(a97.ombre.population.sansEcho, 1);
    assert.equal(a98.precision.n, 1);
    proche(a98.precision.medianeMm, 12);
    assert.equal(a98.precision.auPlus10mm.k, 0);
    assert.equal(r.totaux.reglage.precision.n, 4);
    assert.equal(r.totaux.examen.precision.n, 1);
    assert.equal(r.totaux.reglage.ombre.precision.n, 1);
    assert.notEqual(r.totaux.examen.precision.medianeMm, r.totaux.reglage.precision.medianeMm);
    const texte = P.texte(r);
    assert.equal(texte.includes('9101'), false);
    assert.match(texte, /réglage/);
    assert.match(texte, /examen/);
    assert.equal(JSON.stringify(r).includes('9101'), false);
  } finally {
    fs.rmSync(echoDir, { recursive: true, force: true });
    fs.rmSync(echo98, { recursive: true, force: true });
  }
});

test('découverte : versions 21 à 23, partie 19 sans Écho, partie 0 appariée à son Écho, les autres versions écartées', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prec-dec-'));
  const cols = path.join(root, 'collections');
  const toucher = (rel) => { const d = path.join(cols, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'a.zip'), ''); };
  toucher('2026-10-26_v4.9.5.21_partie-15-lot/lot 08h51');
  toucher('2026-10-26_v4.9.5.21_echo-partie-15/echo 08h52');
  toucher('2026-10-26_v4.9.5.21_parties-18-19-20-lots/export 11h43 partie 18');
  toucher('2026-10-26_v4.9.5.21_parties-18-19-20-lots/export 11h50 partie 19');
  toucher('2026-10-26_v4.9.5.22_partie-0-lot/export 15h31 partie 0');
  toucher('2026-10-26_v4.9.5.23_echo-partie-0/echo partie 0');
  toucher('2026-10-18_v4.9.5.7_echo-partie-15/echo');
  try {
    const s = P.decouvrir(root).sort((a, b) => a.partie - b.partie);
    assert.deepEqual(s.map(x => x.partie), [0, 15, 18, 19]);
    const p0 = s.find(x => x.partie === 0), p15 = s.find(x => x.partie === 15), p19 = s.find(x => x.partie === 19);
    assert.equal(p0.version, '4.9.5.22');
    assert.equal(p0.versionEcho, '4.9.5.23');
    assert.equal(p15.version, '4.9.5.21');
    assert.ok(p15.echoDirs.length === 1);
    assert.deepEqual(p19.echoDirs, []);
    assert.equal(s.some(x => x.version === '4.9.5.7'), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('journal cumulé : la passe d\'une partie précédente ne retire pas les poses de la suivante', () => {
  const lot = poseLot({ cut: 9301, partie: 98, gauche: G0, droit: D0 });
  lot.events[0].timestamp = '2031-05-01T09:00:00.000Z';
  lot.events[1].timestamp = '2031-05-01T09:00:01.000Z';
  lot.events[2].timestamp = '2031-05-01T09:00:02.000Z';
  const passeAvant = { eventId: 'p97', timestamp: '2031-05-01T08:00:00.000Z', type: 'passe-differes-ombre', identity: S.identite(1, 97), passe: 1, decision: 'rien' };
  const journal = { format: 'ariane-journal-v4', version: '4.9.5.21', events: [passeAvant, ...lot.events], records: [lot.record] };
  const echoDir = echoDe([S.visite({
    session: 'sess-cumul', index: 1, cut: 9301, partie: 98, debut: { minutes: 70 }, fin: { minutes: 70, secondes: 2 },
    initiale: [G0, D0], validation: [G0, mm(D0, 7)],
  })]);
  try {
    const r = P.juger([{ partie: 98, version: '4.9.5.21', reglage: 'examen', journal, echo: P.lireEcho(echoDir) }]);
    assert.equal(r.parties[0].population.posesLot, 1);
    assert.equal(r.parties[0].precision.n, 1);
    proche(r.parties[0].precision.medianeMm, 7);
    assert.equal(JSON.stringify(r).includes('9301'), false);
  } finally { fs.rmSync(echoDir, { recursive: true, force: true }); }
});

test('ligne de commande : le chemin des données est obligatoire', () => {
  assert.throws(() => P.lireArguments([]), /--donnees/);
});
