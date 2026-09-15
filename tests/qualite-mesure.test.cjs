const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { Sessions } = require('../src/native-session.js');

/* Mesure de qualité de capture — extraite d'une session Natif RÉELLE
 * (15/09/2026, 21 visites, 190 blocs LiDAR, 69 résumés de capture).
 *
 * Pourquoi ce fichier existe : le panneau affichait « 9 / 119 — 8 % qualifiés »
 * sur ces données, et passait la boîte en alerte. Le chiffre était exact mais
 * mesurait la mauvaise chose : il comptait les INSTANTS de capture, et traitait
 * en échec toute capture arrêtée par un changement de cible, de vue ou de
 * découpe — motif `capture-interrupted-before-stable-boundary`, 110 cas sur
 * 119. Ce motif est une réserve de PROVENANCE, pas un manque de points : à ces
 * mêmes instants la médiane était de 6 bandes longitudinales (minimum requis 6)
 * et 151 points utiles (minimum requis 64).
 *
 * Sur exactement les mêmes données, la mesure par REPÈRE — un repère compte
 * dès qu'un instantané qualifié a existé pour lui, ce qui est la condition
 * réelle d'une proposition du moteur — donne 34 / 34.
 *
 * Le test verrouille les deux lectures et l'écart entre elles, pour qu'aucune
 * régression ne remette en tête le chiffre trompeur. */

const TERRAIN = path.resolve(__dirname, 'fixtures', 'qualite-terrain.json');
const terrain = JSON.parse(fs.readFileSync(TERRAIN, 'utf8'));

function support() {
  const s = Object.create(Sessions.prototype);
  s.e = { s: { native: { cloudIds: [], metrics: {} } }, save: async () => { } };
  return s;
}
function rejouer() {
  const s = support(), n = s.e.s.native;
  for (const c of terrain.chunks) s.accountQuality(n, c);
  for (const c of terrain.captures) s.accountQuality(n, c);
  return { s, n, sante: s.health() };
}

test('le jeu d’essai porte bien la forme du terrain', () => {
  assert.equal(terrain.chunks.length, 190);
  assert.equal(terrain.captures.length, 69);
  const interrompus = terrain.captures.flatMap(c => Object.values(c.railObservations))
    .filter(o => (o.coverage.exclusionReasons || []).includes('capture-interrupted-before-stable-boundary'));
  assert.ok(interrompus.length > 100, 'le motif dominant doit être présent : ' + interrompus.length);
});

test('la mesure par repère est celle qui conditionne le moteur', () => {
  const { sante } = rejouer();
  const q = sante.quality;
  assert.equal(q.railsObserved, 34, 'repères observés');
  assert.equal(q.railsQualified, 34, 'repères ayant obtenu un instantané qualifié');
  assert.equal(q.railQualifiedRate, 100);
  assert.equal(q.railsTruncated, false);
});

test('le taux par instant de capture reste exposé, mais explicité', () => {
  const { sante } = rejouer();
  const q = sante.quality;
  assert.equal(q.snapshotsTotal, 119);
  assert.equal(q.snapshotsQualified, 9);
  // Sur les 110 écarts, 86 tiennent à l'interruption SEULE — aucun autre motif.
  // Les 24 restants portent un défaut de couverture réel, souvent en plus de
  // l'interruption. C'est cette séparation que l'ancienne lecture écrasait.
  assert.equal(q.interruptedOnly, 86, 'interruptions seules');
  assert.equal(q.coverageShort, 24, 'écarts portant un défaut de couverture réel');
  assert.equal(q.coverageShort, q.snapshotsTotal - q.snapshotsQualified - q.interruptedOnly);
  assert.ok(q.interruptedShare >= 75, 'part des interruptions seules : ' + q.interruptedShare + ' %');
});

test('les deux lectures divergent franchement, et c’est le fait à retenir', () => {
  const { sante } = rejouer();
  const q = sante.quality;
  assert.ok(q.railQualifiedRate - q.qualifiedRate > 50,
    'écart entre lecture par repère et lecture par instant : '
    + q.railQualifiedRate + ' % contre ' + q.qualifiedRate + ' %');
});

test('les motifs d’exclusion réels sont conservés, séparés de l’interruption', () => {
  const { sante } = rejouer();
  const motifs = sante.quality.exclusionReasons;
  assert.ok(motifs['capture-interrupted-before-stable-boundary'] > 0);
  assert.ok(motifs['engine-useful-point-count-below-minimum'] > 0,
    'les vrais défauts de couverture restent visibles');
});

test('le clipping du terrain est comptabilisé tel quel', () => {
  const { sante } = rejouer();
  const q = sante.quality;
  // Ni corrigé ni contourné : le filtre de visibilité retire près de la moitié
  // des points de la zone. C'est un fait observé, documenté, non traité.
  assert.ok(q.clipDropRate >= 40 && q.clipDropRate <= 55, 'taux de clipping : ' + q.clipDropRate);
});

test('un repère observé sans instantané qualifié est compté comme tel', () => {
  const s = support(), n = s.e.s.native;
  const bloc = (cut, statut) => ({ format: 'banane-native-lidar-chunk-v1', side: 'left',
    identity: { part: 28, cut }, qualification: statut ? { status: statut } : null });
  s.accountQuality(n, bloc(1, 'insufficient'));
  s.accountQuality(n, bloc(1, 'insufficient'));
  s.accountQuality(n, bloc(2, 'qualified-candidate'));
  const q = s.health().quality;
  assert.equal(q.railsObserved, 2);
  assert.equal(q.railsQualified, 1);
  assert.equal(q.railQualifiedRate, 50);
});

test('un repère n’est compté qualifié qu’une seule fois', () => {
  const s = support(), n = s.e.s.native;
  const bloc = () => ({ format: 'banane-native-lidar-chunk-v1', side: 'right',
    identity: { part: 33, cut: 7 }, qualification: { status: 'qualified-candidate' } });
  for (let i = 0; i < 20; i++) s.accountQuality(n, bloc());
  const q = s.health().quality;
  assert.equal(q.railsObserved, 1);
  assert.equal(q.railsQualified, 1);
});

test('le suivi par repère est borné et le signale', () => {
  const s = support(), n = s.e.s.native;
  for (let i = 0; i < Sessions.QUALITY_RAIL_LIMIT + 50; i++)
    s.accountQuality(n, { format: 'banane-native-lidar-chunk-v1', side: 'left',
      identity: { part: 28, cut: i }, qualification: { status: 'qualified-candidate' } });
  const q = s.health().quality;
  assert.equal(q.railsObserved, Sessions.QUALITY_RAIL_LIMIT);
  assert.equal(q.railsTruncated, true, 'la troncature doit être annoncée, jamais silencieuse');
});

test('la mesure de qualité n’interrompt jamais la collecte', () => {
  const s = support(), n = s.e.s.native;
  // Objets malformés : la collecte prime sur la mesure.
  for (const mauvais of [null, undefined, {}, { format: 'banane-native-lidar-chunk-v1' },
    { format: 'banane-native-lidar-capture-v2', railObservations: null },
    { format: 'banane-native-lidar-chunk-v1', side: 'left', identity: null }]) {
    assert.doesNotThrow(() => s.accountQuality(n, mauvais));
  }
});

test('une clé de repère exige une identité et un côté', () => {
  assert.equal(Sessions.railKey(null, 'left'), null);
  assert.equal(Sessions.railKey({ part: 28, cut: 1 }, null), null);
  assert.equal(Sessions.railKey({}, 'left'), null);
  assert.equal(Sessions.railKey({ part: 28, cut: 1 }, 'left'), '28/1/left');
  assert.notEqual(Sessions.railKey({ part: 28, cut: 1 }, 'left'),
    Sessions.railKey({ part: 28, cut: 1 }, 'right'), 'les deux côtés sont deux repères');
});
