'use strict';
/* P0 du plan 5.0 : les trois mesures hors ligne (convention refusée et garde de paire, graine contre intersection,
 * pente du flanc), sur des lignes SYNTHÉTIQUES construites ici : aucune donnée de terrain, aucun identifiant.
 * Chaque attendu est calculé à la main dans le commentaire du cas. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const P = require('../tools/p0-commun.cjs');
const B = require('../tools/p0b-convention.cjs');
const A = require('../tools/p0a-estimateurs.cjs');
const Pe = require('../tools/p0c-pente.cjs');
const pilote = require('./corpus/pilot-part18-cut6704-partial-flank.json');

const proche = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

/* Un rail synthétique. y et z : delta brut du moteur (mm) ; conv : { dz, du, appliquee } ; h : pose de l'opérateur [y, z]. */
function rail({ cut, cote, y = 0, z = 0, dz = 0, du = 0, appliquee = true, repeche = false, h = [0, 0], etage = 'first-pass', raison = null, predit = 1440, classe = 'posee' }) {
  const refuse = Math.abs(dz) > 8 || Math.abs(du) > 8;
  return {
    etiquette: 'synth', partie: 99, cut, cote, ok: true, signe: cote === 'left' ? 1 : -1, classe,
    decision: { etage, raison, garde: raison === 'pair-guard' },
    moteur: { statut: 'candidate', deltaBrutMm: [0, y, z], deltaPublieMm: [0, y, z], repeche, astar: { statut: 'candidate', deltaMm: [0, y, z] } },
    convention: { appliquee: appliquee && !refuse, raison: refuse ? 'shift-out-of-domain' : null, duMm: du, dzMm: dz },
    ecartement: { predit, rejete: false, mesurable: true },
    humainMm: [0, h[0], h[1]],
  };
}
const droit = (cut, o = {}) => rail({ cut, cote: 'right', z: -3, dz: 3, h: [0, 0], ...o });

/* Jeu synthétique, calculé à la main :
 *  cut 1 (premier passage) : gauche brute z −6, calage prédit dz 10 (refusé), l'opérateur à z −0,5 ; droite z −3, dz 3 (calé), l'opérateur à z 0.
 *    S0 : gauche non calée → erreur 5,5 ; droite −3 + 3 = 0 → 0.     cut = 5,5.
 *    plafond 8 : −6 + 8 = 2 → 2,5 ; domaine 12 : −6 + 10 = 4 → 4,5 ; calage plein : 4,5.
 *  cut 2 (premier passage) : gauche z −8, dz 12,5 (refusé, au delà de 12 aussi), l'opérateur à z −2 ; droite comme le cut 1.
 *    S0 : 6 ; plafond 8 : 0 → 2 ; domaine 12 : non appliqué (12,5 > 12) → 6 ; plein : 4,5 → 6,5.
 *  cut 3 ('pair-guard') : gauche repêchée, dz 10 refusé, z −6, l'opérateur à z −1 ; droite calée non repêchée, z −3 + 3, l'opérateur 0.
 *    plafond 8 : 2 → 3 ; la garde actuelle signale (repêché et hors domaine). Même rail : signalé. Marge dz > 10 : 10 n'est pas > 10.
 *  cut 4 ('pair-guard') : gauche z −20 dz 9 refusé non repêchée, l'opérateur à z 0 ; droite repêchée, dz 4 calée.
 *    Garde actuelle : signalé (rail repêché ET autre rail hors domaine) ; même rail : non signalé → récupéré, mais plafond 8 : −20 + 8 = −12 → 12 mm : mauvaise pose.
 *  cut 5 ('pair-guard') : gauche repêchée, dz 11 refusé, du +8 (calage latéral au plafond), écartement publié 1469 :
 *    avec le plafond (du +8 appliqué au lieu de 0) l'écartement passe à 1477 : hors contrat, donc pas récupérable. */
function jeu() {
  return [
    rail({ cut: 1, cote: 'left', z: -6, dz: 10, h: [0, -0.5] }), droit(1),
    rail({ cut: 2, cote: 'left', z: -8, dz: 12.5, h: [0, -2] }), droit(2),
    rail({ cut: 3, cote: 'left', z: -6, dz: 10, repeche: true, h: [0, -1], etage: 'deferred', raison: 'pair-guard' }), droit(3, { etage: 'deferred', raison: 'pair-guard' }),
    rail({ cut: 4, cote: 'left', z: -20, dz: 9, h: [0, 0], etage: 'deferred', raison: 'pair-guard' }), droit(4, { repeche: true, etage: 'deferred', raison: 'pair-guard', dz: 4, z: -4 }),
    rail({ cut: 5, cote: 'left', z: -6, dz: 11, du: 8, repeche: true, h: [0, -1], etage: 'deferred', raison: 'pair-guard', predit: 1469 }), droit(5, { etage: 'deferred', raison: 'pair-guard', predit: 1469 }),
  ];
}

test('politiques de décalage : actuelle, plafonnée, domaine élargi, plein', () => {
  const g = rail({ cut: 1, cote: 'left', z: -6, dz: 10 });
  assert.deepEqual(B.POLITIQUES.actuelle(g), { du: 0, dz: 0 });
  assert.deepEqual(B.POLITIQUES.plafond8(g), { du: 0, dz: 8 });
  assert.deepEqual(B.POLITIQUES.domaine12(g), { du: 0, dz: 10 });
  assert.deepEqual(B.POLITIQUES.pleine(g), { du: 0, dz: 10 });
  const loin = rail({ cut: 2, cote: 'left', z: -8, dz: 12.5 });
  assert.deepEqual(B.POLITIQUES.domaine12(loin), { du: 0, dz: 0 });
  const cale = droit(1);
  assert.deepEqual(B.POLITIQUES.actuelle(cale), { du: 0, dz: 3 });
  assert.deepEqual(B.POLITIQUES.plafond8(cale), { du: 0, dz: 3 });
  /* Latéral : le décalage suit le signe du profil (u orienté vers le champignon). */
  const lat = rail({ cut: 9, cote: 'right', y: 10, z: 0, du: -2, dz: 1 });
  assert.deepEqual(B.pose(lat, B.POLITIQUES.actuelle), [0, 10 + (-1) * -2, 1]);
});

test('rails refusés contre rails calés, et poses des variantes (comptes faits à la main)', () => {
  const r = B.analyserJeu(jeu());
  assert.equal(r.comptes.railsCandidats, 10);
  assert.equal(r.comptes.railsRefuses, 5, 'cinq gauches refusés (dz 10 ; 12,5 ; 10 ; 9 ; 11)');
  assert.equal(r.comptes.railsCales, 5);
  assert.equal(r.comptes.railsRefusesDansCutsPosesPremierPassage, 2);
  assert.equal(r.comptes.cuts.pairGuardAuJournal, 3);
  assert.equal(r.comptes.cuts.pairGuardParLaFormule, 3, 'la formule retrouve les cuts que le journal a différés');
  assert.equal(r.comptes.cuts.pairGuardConcordants, 3);
  /* Refusés posés bruts : erreurs verticales 5,5 et 6 ; calés : 0 et 0. */
  assert.equal(r.verite.railsParGroupe.refuses.n, 2);
  proche(r.verite.railsParGroupe.refuses.vertAbsMedianeMm, 5.75);
  proche(r.verite.railsParGroupe.refuses.vertSigneMedianMm, -5.75);
  assert.equal(r.verite.railsParGroupe.cales.d3MedianeMm, 0);
  proche(r.verite.railsParGroupe.refusesSiPlafond8.d3MedianeMm, 2.25);
  proche(r.verite.railsParGroupe.refusesSiPleine.d3MedianeMm, 5.5);
  const sc = Object.fromEntries(r.verite.scenariosPoses.map(s => [s.id, s]));
  assert.equal(sc.S0.cuts.plus5, 2);
  assert.equal(sc.S1.cuts.plus5, 0); assert.equal(sc.S1.gagnes5, 2); assert.equal(sc.S1.perdus5, 0);
  assert.equal(sc.S2.cuts.plus5, 1, 'le cut 2 reste hors du domaine élargi : calage non appliqué'); assert.equal(sc.S2.gagnes5, 1);
  assert.equal(sc.S3.cuts.plus5, 0);
  /* Déplacement réel de l'opérateur contre dz prédit : cut 1 gauche dz 10 → l'opérateur déplace de 5,5 (z −6 → −0,5), droite dz 3 → 3. */
  assert.equal(r.verite.regressionDeplacementSurDz.n, 4);
  const t10 = r.verite.dzPredictContreMic.find(t => t.tranche === '10–12');
  assert.equal(t10.n, 1); proche(t10.deplacementDeMicMedianMm, 5.5); proche(t10.dzPredictMedianMm, 10);
  const t12 = r.verite.dzPredictContreMic.find(t => t.tranche === '≥ 12');
  assert.equal(t12.n, 1); proche(t12.deplacementDeMicMedianMm, 6); proche(t12.rapport, 6 / 12.5);
  assert.equal(r.verite.ecartAuxVoisinsContreErreur.cuts, 0, 'pas d\'écart aux voisins consigné dans ce jeu');
  /* Balayage : sans calage 5,75 de médiane verticale, plafond 8 → 2,25. */
  const sw = Object.fromEntries(r.verite.balayagePlafond.map(b => [String(b.plafondMm), b]));
  proche(sw['0'].vertAbsMedianeMm, 5.75); proche(sw['8'].vertAbsMedianeMm, 2.25);
});

test('garde de paire : amplitude de la correction de l\'opérateur et cuts récupérés par variante', () => {
  const r = B.analyserJeu(jeu()), g = r.gardeDePaire;
  assert.equal(g.cuts, 3);
  assert.equal(g.railsDeCesCuts.memeRailRepecheEtHorsDomaine, 2, 'cuts 3 et 5 ; au cut 4 le rail repêché n\'est pas le rail hors domaine');
  assert.equal(g.railsDeCesCuts.margeDzSup10, 1, 'seul le cut 5 a un rail repêché à dz > 10 mm');
  /* Pose brute contre l'opérateur : cut 3 → 5, cut 4 → 20, cut 5 → 5. */
  assert.equal(g.correctionDeMic.poseBrute.maxMm, 20); assert.equal(g.correctionDeMic.poseBrute.plus10, 1); assert.equal(g.correctionDeMic.poseBrute.medianeMm, 5);
  const rec = Object.fromEntries(g.recuperes.map(x => [x.id, x]));
  assert.equal(rec.S0.recuperesParLaGarde, 0); assert.equal(rec.S1.recuperesParLaGarde, 0, 'le plafond seul ne récupère rien');
  assert.equal(rec.S2.recuperesParLaGarde, 3);
  assert.equal(rec.S2.ecartementHorsContrat, 1, 'cut 5 : le décalage latéral appliqué porte l\'écartement à 1477 mm');
  assert.equal(rec.S2.recuperesAdmissibles, 2); assert.equal(rec.S2.mauvaisesPoses, 1, 'cut 4 : −20 + 9 = −11, soit 11 mm de l\'opérateur');
  assert.equal(rec.S3.recuperesParLaGarde, 1); assert.equal(rec.S3.mauvaisesPoses, 1, 'cut 4 plafonné à 8 : 12 mm');
  assert.equal(rec.S5.recuperesParLaGarde, 2); assert.equal(rec.S6.recuperesParLaGarde, 3);
  /* Les variantes ne signalent qu'un sous-ensemble de la garde actuelle : aucun cut posé ne devient différé. */
  const cuts = B.parCut(jeu());
  for (const c of cuts) {
    const rails = [c.lignes.left, c.lignes.right];
    for (const sc of B.SCENARIOS.slice(1)) if (B.GARDES[sc.garde](rails, sc.domaine)) assert.ok(B.GARDES.actuelle(rails, B.DOMAINE_MM), `${sc.id} signale un cut que S0 laisse passer`);
  }
});

test('texte et JSON de l\'outil, et ligne de commande', () => {
  const r = B.analyser(jeu());
  assert.match(B.texte(r), /Balayage du plafond/);
  assert.match(B.texte(r), /S3 {2}récupérés 1/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0b-'));
  const f = path.join(dir, 'lignes.json');
  fs.writeFileSync(f, JSON.stringify({ format: 'ariane-p0-lignes-v1', lignes: jeu() }));
  const out = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'p0b-convention.cjs'), '--lignes', f, '--json'], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  const doc = JSON.parse(out.stdout);
  assert.equal(doc.format, 'ariane-p0b-v1');
  assert.equal(doc.jeux.synth.comptes.railsRefuses, 5);
  const sans = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'p0b-convention.cjs')], { encoding: 'utf8' });
  assert.equal(sans.status, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

/* ---------------------------------------------------------------- P0(a) */
function railEstim({ cut, graine, inter, h, pointsFlanc = 10, etage = 'first-pass', gauche = true }) {
  return { etiquette: 'synth', partie: 99, cut, cote: gauche ? 'left' : 'right', ok: true, signe: 1, classe: 'posee', decision: { etage },
    moteur: { statut: 'candidate', deltaBrutMm: [0, graine[0], graine[1]], deltaPublieMm: [0, graine[0], graine[1]] },
    propose: { statut: 'candidate', metriques: true, graineMm: graine, interMm: inter, pointsFlanc, pointsDessus: 40, penteFlanc: 0.1 },
    humainMm: [0, h[0], h[1]] };
}
test('P0(a) : la graine gagne si l\'intersection s\'éloigne de l\'opérateur ; classes de flanc ; trait de doute', () => {
  const lignes = [];
  for (let i = 0; i < 12; i++) lignes.push(railEstim({ cut: i, graine: [1, 1], inter: [4, 3 + i % 3], h: [0, 0], pointsFlanc: 8 }));
  for (let i = 0; i < 6; i++) lignes.push(railEstim({ cut: 100 + i, graine: [2, 0], inter: [2, 0], h: [0, 0], pointsFlanc: 1 }));
  const r = A.analyserJeu(lignes);
  assert.equal(r.railsAvecMesuresEtReference, 18);
  const fort = r.parClasseFlanc['flanc fort (≥ 6 points)'];
  assert.equal(fort.n, 12);
  proche(fort.estimateurs.graine.d2MedianeMm, Math.hypot(1, 1));
  assert.ok(fort.estimateurs.intersection.d2MedianeMm > fort.estimateurs.graine.d2MedianeMm);
  assert.equal(fort.estimateurs.intersection.contreGraine.signes.gagne, 0, 'l\'intersection ne bat la graine sur aucun rail');
  assert.equal(fort.estimateurs.intersection.contreGraine.signes.perd, 12);
  assert.ok(fort.estimateurs.intersection.contreGraine.signes.p < 0.01);
  /* moyenne = milieu : entre les deux. */
  const m = fort.estimateurs.moyenne.d2MedianeMm;
  assert.ok(m > fort.estimateurs.graine.d2MedianeMm && m < fort.estimateurs.intersection.d2MedianeMm);
  /* flanc nul : graine = intersection, aucune différence. */
  const nul = r.parClasseFlanc['flanc nul (< 3)'];
  assert.equal(nul.estimateurs.intersection.contreGraine.signes.egal, 6);
  proche(nul.ecartGraineIntersectionMm.mediane, 0);
  assert.equal(r.traitDeDoute.rails, 18);
  assert.match(A.texte(A.analyser(lignes)), /Trait de doute/);
});

/* ---------------------------------------------------------------- P0(c) */
test('P0(c) : tranches de pente brute du flanc, rails appliqués et graine des rails refusés', () => {
  const mk = (cut, pente, errMm, o = {}) => {
    const l = railEstim({ cut, graine: [errMm, 0], inter: [errMm, 0], h: [0, 0], ...o });
    l.propose.penteFlanc = pente; l.propose.penteFlancBande14_30 = pente / 2;
    return l;
  };
  const lignes = [mk(1, .05, 2), mk(2, .05, 4), mk(3, .35, 6), mk(4, .45, 12), mk(5, -.5, 3), mk(6, .6, 20, { etage: 'deferred' })];
  lignes[5].moteur.statut = 'unresolved'; lignes[5].moteur.deltaPublieMm = null;
  lignes[5].propose.statut = 'unresolved'; lignes[5].propose.penteFlancLimitee = true; lignes[5].propose.raison = 'Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée.';
  const r = Pe.analyserJeu(lignes);
  const t = Object.fromEntries(r.tranchesPenteBrute.map(x => [x.tranche, x]));
  assert.equal(t['0–0,1'].rails, 2);
  assert.equal(t['0,3–0,4'].rails, 1);
  assert.equal(t['0,4–0,5'].rails, 2, 'la borne 0,5 du moteur est incluse dans la dernière tranche acceptée (−0,5 compte en valeur absolue)');
  assert.equal(t['> 0,5'].rails, 1); assert.equal(t['> 0,5'].appliques.n, 0, 'au-dessus de 0,5 le moteur n\'applique rien');
  proche(t['> 0,5'].tousRails.medianeMm, 20);
  proche(t['0–0,1'].appliques.publiee.medianeMm, 3);
  assert.equal(t['0,4–0,5'].appliques.publiee.plus10, 1);
  assert.equal(r.railsRefusesParLaSeulePenteDuFlanc.n, 1);
  const c = r.comparaisons['pente < 0,3 puis 0,3–0,5 (graine, tous rails)'];
  assert.equal(c.nBas, 2); assert.equal(c.nHaut, 3);
  assert.ok(c.auc > 0.5);
  assert.match(Pe.texte(Pe.analyser(lignes)), /Par tranche de pente brute du flanc/);
});

/* ---------------------------------------------------------------- socle commun */
test('socle : référence de l\'opérateur tirée de la table de jointure, repère de départ', () => {
  const eh = (l, v, lo = 0) => ({ repere: 'profil', longitudinalMm: lo, lateralMm: l, verticalMm: v, dist3dMm: 0 });
  const posee = { classe: 'posee', referenceHumaine: 'observee', base: 'ariane', ecartHumain: { gauche: eh(1, -2) }, arianeDeplacement: { gauche: eh(10, 5) } };
  assert.deepEqual(P.referenceDepuisTable(posee, 'left'), [0, 11, 3], 'déplacement d\'Ariane + écart de l\'opérateur');
  const differee = { classe: 'differee', referenceHumaine: 'observee', base: 'premiere-visite', ecartHumain: { droite: eh(-4, 1) } };
  assert.deepEqual(P.referenceDepuisTable(differee, 'right'), [0, -4, 1], 'cut différé : l\'écart mesuré à la première visite est la pose de départ');
  assert.equal(P.referenceDepuisTable({ ...posee, base: 'premiere-visite' }, 'left'), null, 'posé mais base incohérente : pas de référence');
  assert.equal(P.referenceDepuisTable({ ...posee, referenceHumaine: 'sans-reference' }, 'left'), null);
  assert.equal(P.referenceDepuisTable({ ...differee, ecartHumain: { droite: { repere: '3D', dist3dMm: 5 } } }, 'right'), null);
});

test('socle : statistiques déterministes', () => {
  assert.deepEqual(P.icMediane([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), P.icMediane([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  assert.equal(P.icMediane([1, 2]), null);
  assert.equal(P.auc([1, 2, 3, 4], [false, false, true, true]), 1);
  assert.equal(P.auc([1, 1, 1, 1], [false, false, true, true]), 0.5);
  assert.deepEqual(P.testeSignes([-1, -2, -3, -1, 2]), { gagne: 4, perd: 1, egal: 0, p: 0.375 });
  assert.equal(P.testeSignes([0, 0]).p, null);
});

test('rejeu d\'une capture réelle du dépôt : graine, intersection et pentes brutes, comme l\'ombre', () => {
  const r = P.rejeuCapture(pilote, { left: [0, .003, -.002], right: [0, -.004, .001] }, { id: { partie: 99, cut: 1 } });
  for (const nom of ['gauche', 'droite']) {
    const l = r[nom];
    assert.ok(l.ok && l.propose.metriques);
    /* La graine rejouée est exactement le delta de l'étage A* de l'ombre. */
    proche(l.propose.graineMm[0], l.moteur.astar.deltaMm[1], 0.001); proche(l.propose.graineMm[1], l.moteur.astar.deltaMm[2], 0.001);
    assert.equal(l.propose.interMm.length, 2);
    assert.ok(Number.isFinite(l.propose.penteFlanc));
    assert.equal(l.humainMm.length, 3);
  }
  assert.equal(r.droite.convention.raison, 'shift-out-of-domain', 'le rail droit de la capture a un calage hors domaine');
  assert.ok(Number.isFinite(r.droite.convention.dzMm) && Math.abs(r.droite.convention.dzMm) > 8);
  assert.equal(r.droite.moteur.deltaPublieMm[2], r.droite.moteur.deltaBrutMm[2], 'refusé : publié brut');
  /* La pente de la bande 9 à 34 mm refait la pente du moteur ; la bande 14 à 30 mm est une autre mesure. */
  const Candidate = require('../src/geometry-candidate-v1.js');
  const uSeed = require('../src/gcv1-shadow.js').scientificProposeBoth(pilote).rails.right.frame.uSeed;
  const p = Candidate.propose(pilote, 'right', { lab: { uSeeds: [uSeed], replaceOrigin: false, recenterWindow: true, partialFaceKeep: true } });
  assert.ok(p.metrics);
  const meme = P.penteFlancBande(pilote, 'right', p, r.droite.signe, .009, .034);
  proche(meme.pente, r.droite.propose.penteFlanc, 0.0001);
});

test('journal d\'Orbite : lignes par rail, décision du lot, classe et pose de l\'opérateur de la table', () => {
  const Shadow = require('../src/gcv1-shadow.js');
  const science = Shadow.scientificProposeBoth(pilote);
  const journal = { events: [
    { type: 'gcv1-shadow-observed', identity: { part: 99, cut: 7 }, lidarCaptureId: 'c7', shadow: science,
      lotObservation: { stage: 'deferred', reason: 'pair-guard', pairGuarded: true } },
    { type: 'proposed', identity: { part: 99, cut: 8 } },
  ] };
  const eh = (l, v) => ({ repere: 'profil', longitudinalMm: 0, lateralMm: l, verticalMm: v, dist3dMm: 0 });
  const table = [{ partie: 99, cut: 7, classe: 'differee', referenceHumaine: 'observee', base: 'premiere-visite', ecartHumain: { gauche: eh(3, -2), droite: eh(-4, 1) } }];
  const lignes = P.lignesDepuisJournal(journal, { table, etiquette: 'fixture', corpus: new Map([['c7', pilote]]) });
  assert.equal(lignes.length, 2, 'un seul cut a un événement d\'ombre');
  const g = lignes.find(l => l.cote === 'left');
  assert.equal(g.classe, 'differee');
  assert.deepEqual(g.decision, { etage: 'deferred', raison: 'pair-guard', garde: true, ecartVoisinsMm: null });
  assert.deepEqual(g.humainMm, [0, 3, -2]);
  assert.ok(g.propose.metriques);
  assert.equal(g.convention.appliquee, science.rails.left.conventionCalibration.applied);
  const d = lignes.find(l => l.cote === 'right');
  assert.equal(d.convention.raison, 'shift-out-of-domain');
  /* Sans corpus ni table : mêmes lignes, sans mesures ni référence. */
  const nu = P.lignesDepuisJournal(journal, {});
  assert.equal(nu[0].propose, undefined); assert.equal(nu[0].humainMm, null);
});

test('rejeu d\'un Écho : une visite sans nuage exploitable est comptée comme refusée, pas rejouée', () => {
  const visite = { recordId: 'r1', visitId: 'v1', identity: { pageId: 'p', part: 99, cut: 1, shape: 'U50', frameId: 'f', projectId: null }, railSnapshots: {} };
  const r = P.rejeuSession({ records: [visite], clouds: [], events: [] }, { etiquette: 'vide' });
  assert.equal(r.lignes.length, 0);
  assert.equal(r.visites, 1);
  assert.equal(Object.values(r.refus).reduce((a, b) => a + b, 0), 1, 'une visite refusée, avec sa raison');
  assert.deepEqual(P.rejeuSession({ records: [], clouds: [], events: [] }).lignes, []);
});
