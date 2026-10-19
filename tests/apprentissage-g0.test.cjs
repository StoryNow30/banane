'use strict';
/* G0 (plan 5.0) : étude d'apprentissage, sur des jeux SYNTHÉTIQUES (parties 91 à 96, cuts et valeurs inventés par un
 * générateur pseudo-aléatoire de graine fixe). Aucune donnée de terrain, aucune coordonnée.
 *
 *  - parties Ariane 91, 92, 93 : 120 posés avec référence chacune ; un faux vert (> 10 mm) vient surtout d'un calage de
 *    convention refusé à grand décalage (dzMm), la confiance du moteur étant un bruit ; la correction verticale de Mic
 *    sur les rails refusés vaut environ 0,6 × dz (signe positif, stable d'une partie à l'autre) ;
 *  - partie 96 : un PN (plage contrôlée 96–112, passage 100–107), flushPct fort dans le passage sauf au cut 107 ;
 *  - parties humaines 94 et 95 : écartement de départ ~1437 mm, 10 « mauvais objets » décalés de 30 mm. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const G = require('../tools/apprentissage-g0.cjs');
const OUTIL = path.join(__dirname, '..', 'tools', 'apprentissage-g0.cjs');

function alea(graine) { let a = graine >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
const r2 = v => Math.round(v * 100) / 100;
const rail = (lat, vert, lon = 0) => ({ longitudinalMm: lon, lateralMm: lat, verticalMm: vert, dist3dMm: r2(Math.hypot(lon, lat, vert)), repere: 'profil' });

/* Une partie Ariane synthétique : n posés, numéros de cut espacés pour fabriquer des grappes. */
function partieAriane(partie, graine, n = 120) {
  const rnd = alea(graine), cuts = [];
  let cut = 100;
  for (let i = 0; i < n; i++) {
    cut += rnd() < 0.7 ? 1 : 3 + Math.floor(rnd() * 20);
    const raill = {}, corr = {}, prop = {};
    for (const c of ['gauche', 'droite']) {
      const refuse = rnd() < 0.3, dz = refuse ? 6 + rnd() * 8 : rnd() * 5;
      const bruit = (rnd() - 0.5) * 3;
      const vert = refuse ? 0.8 * dz + bruit : bruit * 0.5;
      raill[c] = { dzMm: r2(dz), duMm: 0, conventionAppliquee: !refuse, lossRatio: r2(2 + rnd() * 5), topRows: 20 + Math.floor(rnd() * 40), faceCount: 6 + Math.floor(rnd() * 10), nClusters: 1, nStrongCompetitive: Math.floor(rnd() * 5), slopeLimited: false, s1Change: false };
      prop[c] = { statut: 'candidate', motif: 'candidate', convention: !refuse, confiance: 30 + Math.floor(rnd() * 50) };
      corr[c] = rail((rnd() - 0.5) * 2, vert);
    }
    const maxD3 = Math.max(corr.gauche.dist3dMm, corr.droite.dist3dMm);
    cuts.push({ type: 'cut', partie, cut, classe: 'posee', joint: true,
      traits: { propositionMoteur: prop, b1Ombre: { reel: { stage: 'first-pass' } },
        deplacementAriane: { gauche: rail(1, 2), droite: rail(-1, 1) },
        voisinage: { fenetre: 3 }, g0: { version: 'g0-traits-v1', rails: raill, ecartVoisinsMm: rnd() < 0.5 ? r2(rnd() * 12) : null } },
      etiquette: { referenceHumaine: 'observee', etiquetteEcho: 'VALIDATE_CORRECTED_BOTH', pose: true, differe: false, base: 'ariane', correctionMm: { gauche: corr.gauche, droite: corr.droite, maxDist3dMm: maxD3 }, corrige5mm: maxD3 > 5, corrige10mm: maxD3 > 10, fauxVert: maxD3 > 10 } });
  }
  return [{ type: 'entete', format: 'ariane-jeu-apprentissage-v1', partie }, ...cuts];
}
const texteJeu = lignes => lignes.map(l => JSON.stringify(l)).join('\n') + '\n';
const lire = lignes => G.lireTexte(texteJeu(lignes));

/* Partie 96 : un PN. Cuts 90 à 120 au journal ; passage 100–107 ; flushPct fort sauf au cut 107. */
function partiePN() {
  const cuts = [];
  for (let cut = 90; cut <= 120; cut++) {
    const passage = cut >= 100 && cut <= 107, controle = cut >= 96 && cut <= 112;
    cuts.push({ type: 'cut', partie: 96, cut, classe: passage ? 'posee' : 'differee', joint: true,
      traits: { propositionMoteur: { gauche: { statut: 'candidate', motif: 'candidate', convention: true, confiance: 50 }, droite: { statut: 'candidate', motif: 'candidate', convention: true, confiance: 50 } }, b1Ombre: { reel: { stage: 'first-pass' } }, s6: { flushPct: passage ? (cut === 107 ? 40 : 70) : (cut % 7) * 3 } },
      zone: { pn: controle ? { id: 'PN1', role: passage ? 'passage' : (cut < 100 ? 'marge-avant' : 'marge-apres') } : null, adv: null, horsZone: !controle },
      etiquette: { referenceHumaine: 'sans-reference', etiquetteEcho: 'PASS_NO_DECISION' } });
  }
  return [{ type: 'entete', format: 'ariane-jeu-apprentissage-v1', partie: 96, zonesFiche: { PN: [{ id: 'PN1', controle: [96, 112], passage: [100, 107] }], ADV: [] } }, ...cuts];
}

/* Parties humaines : écartement de départ ~1437 mm, 10 mauvais objets (+30 mm) dans les PN. */
function partieHumaine(partie, graine) {
  const rnd = alea(graine), cuts = [];
  for (let cut = 1; cut <= 200; cut++) {
    const enPN = (cut >= 50 && cut <= 69) || (cut >= 150 && cut <= 169);
    const mauvais = [52, 56, 60, 64, 68, 152, 153, 154, 155, 156].includes(cut) && enPN;
    const ecart = 1437 + (rnd() - 0.5) * 6 + (mauvais ? 30 : 0);
    const corr = mauvais ? { gauche: rail(0, 0), droite: rail(31, -5) } : { gauche: rail((rnd() - 0.5) * 2, 0), droite: rail(0, (rnd() - 0.5) * 3) };
    const maxD3 = Math.max(corr.gauche.dist3dMm, corr.droite.dist3dMm);
    cuts.push({ type: 'cut', partie, cut, classe: 'hors-journal', joint: false, traits: null, source: 'humain',
      etiquette: { referenceHumaine: 'observee', etiquetteEcho: 'VALIDATE_CORRECTED_BOTH', correctionMm: { ...corr, maxDist3dMm: maxD3 }, corrige5mm: maxD3 > 5, corrige10mm: maxD3 > 10 },
      contexte: { ecartementInitialMm: r2(ecart) } });
  }
  return [{ type: 'entete', format: 'ariane-jeu-apprentissage-v1', partie, source: 'humain', plagesPN: ['50-69', '150-169'] }, ...cuts];
}

const jeux = () => [lire(partieAriane(91, 11)), lire(partieAriane(92, 22)), lire(partieAriane(93, 33)), lire(partiePN()), lire(partieHumaine(94, 44)), lire(partieHumaine(95, 55))];
const res = G.analyser(jeux(), { bootstrap: 100, graine: 7 });

test('AUC et rappel au sommet : valeurs calculées à la main, liens à la frontière au prorata', () => {
  assert.equal(G.auc([1, 2, 3, 4], [false, false, true, true]), 1);
  assert.equal(G.auc([4, 3, 2, 1], [false, false, true, true]), 0);
  assert.equal(G.auc([1, 1, 1, 1], [false, true, false, true]), 0.5);
  assert.equal(G.auc([1, 2], [true, true]), null);
  // 10 cuts, 2 fautes (scores 9 et 5) : à 20 % on signale 2 cuts (scores 10 et 9) -> 1 faute sur 2.
  const s = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1], y = [false, true, false, false, false, true, false, false, false, false];
  const r = G.rappelAuTop(s, y, 0.2);
  assert.equal(r.signales, 2); assert.equal(r.captures, 1); assert.equal(r.rappel, 0.5); assert.equal(r.rappelMax, 1);
  // Lien : 4 cuts au même score, 1 faute, on en signale 2 -> la faute compte pour la moitié.
  const l = G.rappelAuTop([5, 5, 5, 5, 1, 1], [true, false, false, false, false, false], 2 / 6);
  assert.equal(l.signales, 2); assert.equal(l.captures, 0.5);
});

test('régression logistique : sépare des données séparables et reste ordonnée', () => {
  const X = [], y = [], w = [];
  for (let i = 0; i < 60; i++) { X.push([i / 10 - 3]); y.push(i >= 30); w.push(1); }
  const b = G.ajusterLogistique(X, y, w, 0.5);
  assert.ok(b[1] > 1, 'pente positive nette');
  const a = G.ajusterArbre(X.map((x, i) => [x[0]]), y, w, ['x'], 1, 5);
  assert.equal(a.feuille, false); assert.ok(Math.abs(a.seuil - 0) < 0.2);
});

test('lecture : la règle « visité sans action = bon » suit le seuil de durée', () => {
  const base = {
    type: 'cut', partie: 90, cut: 5, classe: 'posee', joint: true, traits: { propositionMoteur: {}, g0: {} },
    etiquette: { referenceHumaine: 'sans-reference', etiquetteEcho: 'PASS_NO_DECISION', correctionMm: null },
    regleVisiteBon: { appliquee: true, dwellMaxS: 1.0 },
  };
  const court = { ...base, cut: 6, regleVisiteBon: { appliquee: true, dwellMaxS: 0.4 } };
  const jeu = [{ entete: { partie: 90 }, cuts: [base, court] }];
  const p = G.normaliserPartie(90, jeu, { seuilVisiteS: 0.8 });
  assert.equal(p.recs.find(r => r.cut === 5).ref, true); assert.equal(p.recs.find(r => r.cut === 5).y10, false);
  assert.equal(p.recs.find(r => r.cut === 6).ref, false);
  assert.equal(G.normaliserPartie(90, jeu, { seuilVisiteS: 0.3 }).recs.find(r => r.cut === 6).ref, true);
});

test('frontière anti-fuite : aucun trait ne change quand on change seulement la référence humaine', () => {
  const a = lire(partieAriane(91, 11)), b = lire(partieAriane(91, 11));
  for (const c of b.cuts) { c.etiquette.correctionMm.gauche = rail(50, 50); c.etiquette.correctionMm.droite = rail(-40, 20); c.etiquette.etiquetteEcho = 'AUTRE'; }
  const ta = G.poserTraits(G.normaliserPartie(91, [a], {})), tb = G.poserTraits(G.normaliserPartie(91, [b], {}));
  assert.deepEqual(ta.recs.map(r => r.t), tb.recs.map(r => r.t));
  assert.notDeepEqual(ta.recs.map(r => r.y10), tb.recs.map(r => r.y10), 'les étiquettes, elles, changent');
});

test('Q1 : le calage de convention refusé est retrouvé, la confiance (bruit) ne l\'est pas', () => {
  const q = res.q1.cibles.y10;
  const dz = q.traits.find(t => t.nom === 'dzMax'), conf = q.traits.find(t => t.nom === 'confianceMin');
  for (const p of ['91', '92', '93']) assert.ok(dz.parPartie[p].auc > 0.85, `dzMax AUC partie ${p} = ${dz.parPartie[p].auc}`);
  assert.ok(dz.signeStable); assert.ok(Math.abs(conf.aucMoyen - 0.5) < 0.12);
  // Les taux par tranche montent avec dzMax.
  const t = dz.taux; assert.ok(t[t.length - 1].taux > t[0].taux + 0.3);
  // Les traits d'une seule partie (flushPct, zone) sont mesurés mais ne sont pas retenus par un modèle.
  assert.ok(q.traits.find(t => t.nom === 'flushPct') === undefined || q.traits.find(t => t.nom === 'flushPct').seul);
});

test('Q1 : validation croisée par partie — jamais la partie jugée dans l\'apprentissage', () => {
  const q = res.q1.cibles.y10;
  assert.equal(q.modeles.length, 3 * 2 + 3, 'six paires et trois « les autres → une »');
  for (const m of q.modeles) {
    assert.ok(!m.apprentissage.includes(m.jugee), m.schema);
    assert.ok(m.traitsRetenus.length >= 1);
    assert.ok(!m.traitsRetenus.includes('flushPct') && !m.traitsRetenus.includes('zonePN'), 'pas de trait d\'une seule partie');
    assert.ok(m.logistique.auc > 0.8, `${m.schema} AUC ${m.logistique.auc}`);
    // Le sommet 20 % attrape bien plus que le hasard (20 %).
    assert.ok(m.logistique.signales.p20.rappel > 0.45, `${m.schema} rappel 20 % = ${m.logistique.signales.p20.rappel}`);
    assert.ok(m.logistique.amorcage && m.logistique.amorcage.rappel5.length === 2);
  }
  assert.ok(q.modeleEnsemble.logistique.some(c => c.trait === 'dzMax' || c.trait === 'dzRefuse' || c.trait === 'conventionRefusee'));
  assert.ok(q.modeleEnsemble.note.includes('pas jugé'));
});

test('Q1 : la porte à 5 % est dite impossible quand la part de fautes la rend impossible', () => {
  const q = res.q1.cibles.y5;
  for (const p of q.plafondPorte) {
    // 5 % de 120 = 6 cuts ; avec plus de 10 fautes, le rappel maximal est sous 60 %.
    if (p.fautes > 10) { assert.ok(p.rappelMaxAtteignable < 0.6); assert.equal(p.porteAtteignablePuisqueTauxDeFautes, false); }
  }
});

test('Q2 : flushPct retrouve le passage du PN, les marges se déduisent du cœur détecté', () => {
  const f = res.q2.flush;
  assert.equal(f.partie, 96); assert.equal(f.passages, 8);
  const b50 = f.balayage.find(b => b.seuil === 50);
  assert.equal(b50.signales, 7); assert.equal(b50.vraisPositifs, 7); assert.equal(b50.horsPN, 0); assert.equal(b50.precision, 1); assert.equal(b50.rappel, 0.875);
  assert.deepEqual(f.passagesManques.map(m => m.cut), [107]);
  const m = f.marges[0];
  assert.deepEqual(m.coeurDetecte, [100, 106]); assert.equal(m.margeAvant, 4); assert.equal(m.margeApres, 6);
  assert.equal(res.q2.margesFicheMic.avant.max, 4); assert.equal(res.q2.margesFicheMic.apres.max, 5);
  assert.ok(res.q2.couvertureMarges.some(c => c.avant === 4 && c.apres === 6));
});

test('Q2 : sur les parties humaines, l\'écartement touche chaque PN ; précision et rappel sont chiffrés', () => {
  assert.equal(res.q2.humain.length, 2);
  for (const h of res.q2.humain) {
    assert.equal(h.pnDetectes, 2); assert.equal(h.pnTotal, 2);
    assert.equal(h.precision, 1, 'tout cut signalé est dans un PN');
    assert.ok(h.rappelCuts < 0.6, 'seul le sous-ensemble faux du PN est signalé');
  }
});

test('Q3 : la règle écartement > 10 mm trouve tous les mauvais objets et le seuil appris tient entre parties', () => {
  for (const h of res.q3.humaines) {
    assert.equal(h.mauvaisObjets25mm, 10); assert.equal(h.vraisPositifs, 10); assert.equal(h.fauxPositifs, 0); assert.equal(h.manques, 0);
    assert.ok(h.auc > 0.99);
  }
  assert.equal(res.q3.validationCroisee.length, 2);
  for (const v of res.q3.validationCroisee) {
    assert.notEqual(v.apprentissage, v.jugee);
    assert.ok(v.seuilAppris > 3 && v.seuilAppris < 30, `seuil appris ${v.seuilAppris}`);
    assert.equal(v.parMedianePropre.manques, 0); assert.equal(v.parMedianePropre.fauxPositifs, 0);
  }
  assert.deepEqual(res.q3.verts, [], 'aucun vert d\'extraction dans ce jeu : rien à signaler');
});

test('Q4 : le biais vertical des rails refusés est positif et stable ; la correction apprise ailleurs réduit les fautes', () => {
  const g = res.q4.groupes.find(x => x.groupe === 'convention refusée');
  assert.match(g.signeStable, /positif/);
  for (const p of ['91', '92', '93']) assert.ok(g.parPartie[p].mediane > 4 && g.parPartie[p].mediane < 12);
  const app = res.q4.groupes.find(x => x.groupe === 'convention appliquée');
  assert.ok(Math.abs(app.parPartie['91'].moyenne) < 1);
  const loo = res.q4.validationCroisee.filter(v => v.correcteur === 'refusee-seule' && v.apprentissage.length === 2);
  assert.equal(loo.length, 3);
  for (const v of loo) { assert.ok(!v.apprentissage.includes(v.jugee)); assert.ok(v.nCorriges10[1] < v.nCorriges10[0], `${v.jugee} : ${v.nCorriges10}`); assert.ok(v.cutsAmeliores > v.cutsAggraves); }
  assert.ok(res.q4.synthese.some(s => s.correcteur === 'refusee-seule' && s.nCorriges10[1] < s.nCorriges10[0]));
  assert.equal(res.q4.grilleRefusee.length, 6);
});

test('déterminisme, et aucune coordonnée ni pose dans la sortie', () => {
  const r2x = G.analyser(jeux(), { bootstrap: 100, graine: 7 });
  assert.deepEqual(JSON.parse(JSON.stringify(r2x)), JSON.parse(JSON.stringify(res)));
  const brut = JSON.stringify(res);
  assert.ok(!/"(pose|poses|position[A-Za-z]*|poseAriane|poseHumaine[A-Za-z]*)"\s*:/i.test(brut));
  const nombres = (brut.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  assert.ok(Math.max(...nombres.map(Math.abs)) < 10000, 'aucun nombre de la taille d\'une coordonnée');
  const texte = G.texte(res);
  assert.match(texte, /Q1\. Faux verts/); assert.match(texte, /Q4\. Biais vertical/);
});

test('ligne de commande : lit des fichiers JSON lignes, écrit le JSON, refuse une option inconnue', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'g0-'));
  try {
    const fichiers = [partieAriane(91, 11), partieAriane(92, 22), partieHumaine(94, 44)].map((l, i) => { const f = path.join(dossier, `jeu${i}.jsonl`); fs.writeFileSync(f, texteJeu(l)); return f; });
    const json = path.join(dossier, 'sortie.json');
    const out = cp.execFileSync(process.execPath, [OUTIL, ...fichiers.flatMap(f => ['--jeu', f]), '--bootstrap', '20', '--json', json], { encoding: 'utf8' });
    assert.match(out, /Étude d'apprentissage G0/);
    const doc = JSON.parse(fs.readFileSync(json, 'utf8'));
    assert.equal(doc.format, 'ariane-apprentissage-g0-v1');
    assert.deepEqual(doc.parties.map(p => p.partie), [91, 92, 94]);
    assert.equal(doc.q1.cibles.y10.modeles.length, 2, 'deux parties Ariane : deux paires');
    const mauvais = cp.spawnSync(process.execPath, [OUTIL, '--jeu', fichiers[0], '--n-importe-quoi'], { encoding: 'utf8' });
    assert.equal(mauvais.status, 2); assert.match(mauvais.stderr, /option inconnue/);
    const sans = cp.spawnSync(process.execPath, [OUTIL], { encoding: 'utf8' });
    assert.equal(sans.status, 2);
  } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
});
