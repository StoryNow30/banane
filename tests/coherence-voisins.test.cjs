'use strict';
/* M6 (plan 5.0, idée 8) : cohérence aux voisins et score de suspicion, sur un journal synthétique inventé
 * (partie 99, rail droit de 1 m par cut, aucune donnée de terrain). Sont construits :
 *  - une ligne droite de 60 cuts (1 à 60), cuts 10 à 15 absents (trou de plus de ±3) ;
 *  - cut 30 : bosse verticale de +25 mm sur le rail gauche ; cut 5 : décalage latéral de +12 mm sur le rail droit ;
 *  - cuts 40 à 43 : zigzag vertical ±14 mm (zone) ;
 *  - cuts 51 à 60 : autre repère de scène (frameId différent, translation de 50 km) : pas d'écart aberrant ;
 *  - cut 20 : rail gauche repêché par S1 ; cut 21 : convention refusée (dz 9 mm) ; cut 22 : confiance 20 ;
 *  - cut 25 : écartement trop large de 30 mm. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const C = require('../tools/coherence-voisins.cjs');

const PARTIE = 99, GAUCHE = 0.7175;
const bosses = { 30: { gz: 0.025 }, 5: { dy: 0.012 }, 40: { gz: 0.014 }, 41: { gz: -0.014 }, 42: { gz: 0.014 }, 43: { gz: -0.014 }, 25: { largeur: 0.03 } };
function rail(x, y, z) { return { positionSceneRelative: [x, y, z], sceneRelativeToProfileLocal: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }; }
function fixture() {
  const events = [], records = [];
  const cuts = [];
  for (let c = 1; c <= 60; c++) if (c < 10 || c > 15) cuts.push(c);
  for (const c of cuts) {
    const autre = c >= 51, frameId = autre ? 'repere-B' : 'repere-A', x = c + (autre ? 50000 : 0), b = bosses[c] || {};
    const id = { part: PARTIE, cut: c, frameId, pageId: 'p', projectId: null };
    const gauche = rail(x, GAUCHE + (b.largeur || 0) / 2, (b.gz || 0)), droit = rail(x, -GAUCHE - (b.largeur || 0) / 2 + (b.dy || 0), 0);
    const rd = side => ({ side, status: 'candidate', confidence: c === 22 && side === 'left' ? 20 : 80, gcv1: { motif: 'candidate', changed: c === 20 && side === 'left', confidenceStatus: 'candidate-v1', convention: c === 21 && side === 'left' ? { applied: false, reason: 'shift-out-of-domain', dzMm: 9, duMm: 0 } : { applied: true, reason: null, dzMm: 1, duMm: 0 } } });
    events.push({ type: 'proposed', identity: id, proposal: { rails: { left: rd('left'), right: rd('right') } } });
    events.push({ type: 'validation-accepted', identity: id });
    records.push({ identity: id, capturedAt: `2026-01-01T00:00:${String(c % 60).padStart(2, '0')}Z`, rails: { left: { initial: gauche, corrected: gauche }, right: { initial: droit, corrected: droit } } });
  }
  /* Un cut différé jamais posé (70) : n'est pas un cut posé. */
  events.push({ type: 'defer-finalized', identity: { part: PARTIE, cut: 70 } });
  return { events, records };
}
const analyse = (opts = {}) => C.analyser(fixture(), opts);
const ligne = (a, cut) => a.table.find(l => l.cut === cut);
const proche = (a, b, tol = 0.2) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('écart aux voisins : bosse verticale, décalage latéral, ligne droite sans écart', () => {
  const a = analyse();
  assert.equal(a.table.length, 54);
  /* cut 30 : +25 mm verticaux au rail gauche, voisins 29 et 31 sur la ligne. */
  proche(ligne(a, 30).ecartVoisins.gauche.verticalMm, 25);
  proche(ligne(a, 30).ecartVoisins.gauche.lateralMm, 0);
  assert.equal(ligne(a, 30).ecartVoisins.gauche.repere, 'profil');
  /* cut 5 : voisins 4 et 6, décalage latéral 12 mm au rail droit ; le signe dépend du sens de marche, la valeur absolue non. */
  proche(Math.abs(ligne(a, 5).ecartVoisins.droite.lateralMm), 12);
  proche(ligne(a, 5).ecartVoisins.droite.verticalMm, 0);
  proche(ligne(a, 33).ecartVoisinsMm, 0);
  assert.equal(ligne(a, 30).ecartVoisinsMm, 25);
});

test('voisins : trou de plus de ±3, bords, et changement de repère de scène', () => {
  const a = analyse();
  /* 16 : voisin avant dans la fenêtre ? 10 à 15 absents, donc 13..15 manquent : pas de voisin avant (9 est à 7). */
  assert.equal(ligne(a, 16).sansVoisins, true);
  assert.equal(ligne(a, 16).ecartVoisinsMm, null);
  assert.equal(ligne(a, 9).sansVoisins, true);
  assert.equal(ligne(a, 1).sansVoisins, true);
  /* Voisin à 2 cuts de distance (9 et 11 absent) : cut 8 a 7 et 9 : écart nul. */
  assert.equal(ligne(a, 8).ecartVoisinsMm, 0);
  /* Frontière de repère : 50 n'a pas de voisin après du même repère ; 51 n'a pas de voisin avant ; aucun écart aberrant. */
  assert.equal(ligne(a, 50).sansVoisins, true);
  assert.equal(ligne(a, 51).sansVoisins, true);
  assert.ok(ligne(a, 55).ecartVoisinsMm < 0.5);
  assert.ok(Math.max(...a.table.map(l => l.ecartVoisinsMm || 0)) <= 28.01);
});

test('rupture de repère non vue par le frameId : le cut est sans voisins', () => {
  const j = fixture();
  for (const r of j.records) if (r.identity.cut >= 51) r.identity.frameId = 'repere-A';
  for (const e of j.events) if (e.identity && e.identity.cut >= 51) e.identity.frameId = 'repere-A';
  const a = C.analyser(j, {});
  assert.equal(ligne(a, 50).rupture, true);
  assert.equal(ligne(a, 50).sansVoisins, true);
  assert.equal(a.resume.cutsRuptureRepere >= 2, true);
  assert.ok(Math.max(...a.table.map(l => l.ecartVoisinsMm || 0)) <= 28.01);
});

test('liste à relire : cuts > 15 mm et zone de 4 cuts, résumé', () => {
  const a = analyse({ seuilScore: null });
  assert.equal(ligne(a, 30).signale.ecart, true);
  assert.equal(ligne(a, 5).signale.ecart, false);
  /* La bosse isolée de 30 déforme aussi 29 et 31 (12,5 mm chacun) : une zone de 3 cuts ; le zigzag 40 à 43 en fait une de 4. */
  assert.deepEqual(a.zones.map(z => [z.premierCut, z.dernierCut, z.cuts]), [[29, 31, 3], [40, 43, 4]]);
  for (const c of [40, 41, 42, 43]) assert.equal(ligne(a, c).signale.zone, true, `cut ${c}`);
  assert.equal(ligne(a, 44).signale.zone, false);
  const r = a.resume;
  assert.equal(r.cutsPoses, 54);
  assert.equal(r.sup15mm >= 5, true);
  assert.equal(r.cutsSignales, a.table.filter(l => l.aRelire).length);
  assert.equal(r.partDesPoses, Math.round(10000 * r.cutsSignales / 54) / 10000);
  assert.ok(r.verticalAbsMm.maxMm >= 25 && r.lateralAbsMm.n > 50);
  assert.equal(r.bandesEcartement[0].partie, PARTIE);
});

test('score : S1, convention refusée, confiance, écartement hors bande', () => {
  const a = analyse();
  const base = ligne(a, 33);
  assert.equal(base.score, 0);
  assert.equal(ligne(a, 20).s1, true);
  proche(ligne(a, 20).composantes.s1, 0.5, 0.001);
  assert.equal(ligne(a, 21).conventionRefusee.raison, 'shift-out-of-domain');
  proche(ligne(a, 21).conventionRefusee.dzMm, 9, 0.001);
  proche(ligne(a, 21).composantes.convention, 0.45, 0.001);
  proche(ligne(a, 22).composantes.confiance, 0.5 * 40 / 60, 0.001);
  /* cut 25 : écartement 1465 mm, bande p5-p95 = 1435 : excès de 30 mm. */
  proche(ligne(a, 25).ecartementMm, 1465, 0.01);
  proche(ligne(a, 25).horsBandeMm, 30, 0.5);
  proche(ligne(a, 25).composantes.bande, 3, 0.05);
  /* La bosse de 25 mm dépasse tous ces termes isolés. */
  assert.ok(ligne(a, 30).score > 1.6);
  assert.equal(ligne(a, 33).signale.score, false);
});

test('plafond de la liste par score', () => {
  const a = analyse({ seuilScore: 0.4, partMax: 0.05 });
  assert.equal(a.table.filter(l => l.signale.score).length, Math.ceil(0.05 * 54));
  const b = analyse({ seuilScore: null });
  assert.equal(b.table.filter(l => l.signale.score).length, 0);
});

test('validation contre une jointure : rappel, part, courbe', () => {
  const a = analyse();
  const table = a.table.map(l => ({ partie: l.partie, cut: l.cut, classe: 'posee', referenceHumaine: 'observee',
    ecartHumain: { maxDist3dMm: [30, 20, 21, 41, 42].includes(l.cut) ? 12 : 2 } }));
  const v = C.valider(a, { table }, { corrigeMm: 10 });
  assert.equal(v.cutsCorriges, 5);
  assert.equal(v.cutsAvecReference, 54);
  assert.equal(v.liste.corrigesDedans >= 3, true);
  assert.equal(v.courbe.length > 3, true);
  assert.equal(v.courbe.at(-1).rappel >= v.courbe[0].rappel, true);
  assert.equal(v.auc.score > 0.8, true);
  assert.equal(typeof v.seuilSous5pc.seuilScore, 'number');
  /* Un cut sans référence ou différé n'entre pas dans les corrigés. */
  const t2 = table.map(l => l.cut === 30 ? { ...l, referenceHumaine: 'sans-reference' } : l);
  assert.equal(C.valider(a, { table: t2 }).cutsCorriges, 4);
  assert.equal(C.auc([3, 4], [1, 2]), 1);
  assert.equal(C.auc([1, 1], [1, 1]), 0.5);
});

test('ligne de commande : journal, sorties JSON et CSV, aucune coordonnée', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coh-'));
  try {
    const jf = path.join(dir, 'ariane-journal-v4-fixture.json'), sortie = path.join(dir, 'out.json'), csv = path.join(dir, 'out.csv');
    fs.writeFileSync(jf, JSON.stringify(fixture()));
    const lignes = [];
    const doc = C.executer(['--journal', jf, '--sortie', sortie, '--csv', csv, '--fenetre', '3'], l => lignes.push(l));
    assert.equal(doc.format, 'ariane-coherence-voisins-v1');
    assert.match(lignes.join('\n'), /À RELIRE : \d+ cuts signalés/);
    const lu = JSON.parse(fs.readFileSync(sortie, 'utf8'));
    assert.equal(lu.table.length, 54);
    assert.ok(!/positionSceneRelative|"pos"/.test(fs.readFileSync(sortie, 'utf8')));
    assert.equal(fs.readFileSync(csv, 'utf8').trim().split('\n').length, 55);
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'coherence-voisins.cjs'), '--journal', jf, '--partie', '99'], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /54 cuts posés par Ariane/);
    assert.throws(() => C.lireArguments([]), /Usage/);
    assert.throws(() => C.lireArguments(['--journal', jf, '--x']), /inconnu/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
