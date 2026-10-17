'use strict';
/* 5.0 — DIFFÉRÉS EN CHAÎNE (src/differes-en-chaine.js, fiches/P7_DIFFERES_EN_CHAINE.md), sur données SYNTHÉTIQUES.
 * Hypothèse H1 du catalogue des échecs : la règle de relecture peut accepter un cut DIFFÉRÉ par le lot si sa pose vient de la chaîne
 * avec au moins un appui (étapes first-pass, window, choice ou crossing), sans les limites D (rail déplacé en travers) et G (écartement)
 * des verts. Les différés posés SEULS restent exclus. Option COUPÉE par défaut : sans elle, rien ne change. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path'), { spawnSync } = require('node:child_process');
const DC = require('../src/differes-en-chaine.js');
const T = require('../tools/relecture-autonome.cjs');

const ligne = (o) => ({ partie: '9:1', cut: 1, zone: 'adv', genre: 'differe', ref: true, etat: 'calcule', conf: 80, ...o });
/* Une proposition en chaîne : écart `d`, erreur `e` contre Mic, `appuis` de la chaîne. */
const prop = (o) => ({ stage: 'window', pire: o.d, latMax: o.d, coh: 0, dg: 1, appuis: 1, ...o });
const SERVICE = { variante: 'chaine+h', X: 8, Y: 0, D: 45, C: 100, G: 15, stages: null, differes: false, poses: false };

test('module : coupé par défaut, rien n\'est admis', () => {
  assert.equal(DC.DEFAUT.actif, false);
  const a = DC.admet({ genre: 'differe', variante: 'chaine+h', etage: 'window', appuis: 3 });
  assert.equal(a.admis, false); assert.equal(a.regle, 'coupe');
});

test('module : un différé posé en chaîne avec au moins un appui est admis, sans les limites de voie et d\'écartement', () => {
  const cfg = DC.reglages({ actif: true });
  for (const etage of ['first-pass', 'window', 'choice', 'crossing']) {
    const a = DC.admet({ genre: 'differe', variante: 'chaine+h', etage, appuis: 1 }, cfg);
    assert.equal(a.admis, true, etage); assert.equal(a.sansVoie, true); assert.equal(a.sansEcartement, true);
  }
  assert.equal(DC.admet({ genre: 'differe', variante: 'chaine', etage: 'window', appuis: 2 }, cfg).admis, true);
});

test('module : les différés posés seuls, sans appui ou à une étape qui ne pose pas restent exclus', () => {
  const cfg = DC.reglages({ actif: true });
  assert.equal(DC.admet({ genre: 'differe', variante: 'seul+h', etage: 'first-pass', appuis: 0 }, cfg).regle, 'seul');
  assert.equal(DC.admet({ genre: 'differe', variante: 'seul', etage: 'first-pass', appuis: 4 }, cfg).regle, 'seul', 'la pose seule est exclue même avec un compte d\'appuis');
  assert.equal(DC.admet({ genre: 'differe', variante: 'chaine+h', etage: 'window', appuis: 0 }, cfg).regle, 'appuis');
  assert.equal(DC.admet({ genre: 'differe', variante: 'chaine+h', etage: 'window', appuis: null }, cfg).regle, 'appuis', 'appuis inconnus : refus');
  assert.equal(DC.admet({ genre: 'differe', variante: 'chaine+h', etage: 'deferred', appuis: 2 }, cfg).regle, 'etage');
  assert.equal(DC.admet({ genre: 'differe', variante: 'chaine+h', etage: undefined, appuis: 2 }, cfg).regle, 'etage');
  assert.equal(DC.admet({ genre: 'vert', variante: 'chaine+h', etage: 'window', appuis: 2 }, cfg).regle, 'genre', 'ne concerne que les différés');
  assert.equal(DC.admet({ genre: 'differe', variante: 'chaine+h', etage: 'window', appuis: 1 }, { ...cfg, appuisMin: 2 }).regle, 'appuis');
});

test('module : réglages validés, valeurs invalides remplacées par le défaut', () => {
  assert.deepEqual(DC.reglages(null), { ...DC.DEFAUT, etages: DC.DEFAUT.etages.slice() });
  const r = DC.reglages({ actif: true, appuisMin: 0, etages: ['window', 'inconnue'] });
  assert.equal(r.actif, true); assert.equal(r.appuisMin, 1, 'au moins un appui : 0 est refusé'); assert.deepEqual(r.etages, DC.DEFAUT.etages);
  assert.equal(DC.reglages({ actif: 'oui' }).actif, false);
  assert.equal(DC.reglages({ actif: true, appuisMin: 3 }).appuisMin, 3);
  assert.deepEqual(DC.reglages({ actif: true, etages: ['window', 'choice'] }).etages, ['window', 'choice']);
  assert.ok(Object.isFrozen(DC.DEFAUT));
});

test('module : entrée de la passe de relecture (rôle, jugement.etage, jugement.appuis)', () => {
  const cfg = DC.reglages({ actif: true });
  const j = DC.jugerRelecture({ role: 'differe', variante: 'chaine+h', jugement: { etage: 'choice', appuis: [{}, {}] } }, cfg);
  assert.equal(j.admis, true);
  assert.equal(DC.jugerRelecture({ role: 'differe', variante: 'chaine+h', jugement: { etage: 'choice', appuis: [] } }, cfg).admis, false);
  assert.equal(DC.jugerRelecture({ role: 'vert', variante: 'chaine+h', jugement: { etage: 'choice', appuis: [{}] } }, cfg).admis, false);
  assert.equal(DC.jugerRelecture({ role: 'differe', variante: 'chaine+h', jugement: { etage: 'choice', appuis: [{}] } }).admis, false, 'coupé par défaut');
});

test('outil : sans l\'option, un différé n\'est jamais touché (règle de service inchangée)', () => {
  const l = ligne({ mic: 200, var: { 'chaine+h': prop({ d: 200, e: 3, dg: 30, appuis: 2 }) } });
  assert.equal(T.agit(l, SERVICE), false);
  assert.deepEqual(T.GRILLE.differes, [false], 'grille de base : différés exclus');
});

test('outil : avec l\'option, un différé en chaîne avec appui est admis au-delà de D et G ; les verts gardent D et G', () => {
  const R = { ...SERVICE, differes: DC.reglages({ actif: true }) };
  const l = ligne({ mic: 200, var: { 'chaine+h': prop({ d: 200, e: 3, dg: 30, appuis: 1 }) } });
  assert.equal(T.agit(l, R), true, 'D 45 et G 15 levés pour le différé en chaîne');
  assert.equal(T.agit({ ...l, var: { 'chaine+h': { ...l.var['chaine+h'], appuis: 0 } } }, R), false, 'sans appui : exclu');
  assert.equal(T.agit({ ...l, var: { 'seul+h': l.var['chaine+h'] } }, { ...R, variante: 'seul+h' }), false, 'pose seule : exclue');
  assert.equal(T.agit({ ...l, var: { 'chaine+h': { ...l.var['chaine+h'], pire: 5, d: 5, latMax: 5 } } }, R), false, 'le seuil X reste');
  assert.equal(T.agit({ ...l, conf: -1 }, R), false, 'la confiance reste');
  assert.equal(T.agit({ ...l, var: { 'chaine+h': { ...l.var['chaine+h'], stage: 'choice' } } }, { ...R, stages: ['first-pass'] }), false, 'les étapes de la règle restent');
  assert.equal(T.agit({ ...l, genre: 'vert' }, R), false, 'vert : D 45 garde la voie');
  assert.equal(T.agit({ ...l, genre: 'pose' }, R), false, 'posé par le lot : toujours exclu avec poses:false');
});

test('outil : les lignes portent le nombre d\'appuis de la chaîne et l\'appartenance à une grappe', () => {
  const { cas, table } = T.essai();
  const c = cas.find(x => x.cut === 52); c.ariane.chaine.appuis = 3;
  const r = T.lignes({ cas, table, designation: '9:1' });
  const l = r.lignes.find(x => x.cut === 52);
  assert.equal(l.var['chaine+h'].appuis, 3); assert.equal(l.var['seul+h'].appuis, 0, 'pose seule : aucun appui');
  assert.equal(typeof l.grappe, 'boolean');
  const S = T.selection({ cuts: [{ i: 0 }, { i: 300 }], lot: [{ cut: 100, differe: false }, { cut: 103, differe: false }, { cut: 106, differe: true }, { cut: 200, differe: false }] });
  assert.ok(S.enGrappe.has(97) && S.enGrappe.has(109) && !S.enGrappe.has(110) && !S.enGrappe.has(200), 'grappe 100–106 avec 3 cuts de marge ; isolé hors grappe');
});

test('étude : l\'option ouvre la grille aux différés en chaîne ; la validation croisée choisit, à gain égal la règle sans différé', () => {
  const v = (lat, z) => ({ left: [0, lat, z], right: [0, lat, z] });
  const { cas, table } = T.essai();
  /* Deux différés que Mic déplace de 120 mm en travers ; la chaîne (2 appuis) les pose à 2 mm de lui. */
  for (const cut of [66, 67]) {
    const c = cas.find(x => x.cut === cut);
    c.mic.rails = v(120, 0);
    for (const s of ['left', 'right']) c.ariane.rails[s] = { ...c.ariane.rails[s], pose: [0, 118, 0] };
    c.ariane.chaine = { stage: 'window', ecartementPoseMm: 1437, appuis: 2, rails: c.ariane.rails };
  }
  const t2 = { ...table, lot: [...table.lot, { cut: 66, differe: true }, { cut: 67, differe: true }] };
  const parties = [{ designation: '9:1', cas, table: t2 }, { designation: '9:2', cas, table: t2 }];
  const grilleBase = { ...T.GRILLE, variante: ['chaine+h'], Y: [0], C: [100], G: [100, 15], D: [45], stages: [null], X: [8, 15], poses: [false] };
  const base = T.etudier(parties, { grille: grilleBase });
  const avec = T.etudier(parties, { grille: T.grilleDifferesEnChaine(grilleBase) });
  for (const c of base.croisee) { assert.equal(c.regleSobre.differes, false); assert.equal(c.genreSobre.differe.agit, 0); }
  for (const c of avec.croisee) {
    assert.equal(c.regleSobre.differes.actif, true); assert.equal(c.genreSobre.differe.corrigesJustes, 2); assert.equal(c.genreSobre.differe.mauvaiseVoie, 0);
    assert.equal(c.parTypeSobre.pn.corrigesJustes, base.croisee[0].parTypeSobre.pn.corrigesJustes, 'PN inchangé');
  }
  assert.ok(avec.totalCroiseeSobre.corrigesJustes === base.totalCroiseeSobre.corrigesJustes + 4);
  assert.ok(avec.grappeCroiseeSobre && avec.parTypeCroiseeSobre.adv);
  /* À gain égal (différés déjà justes : Mic ne bouge pas, Ariane non plus), la règle sans différé est la plus prudente. */
  for (const cut of [66, 67]) { const c = cas.find(x => x.cut === cut); c.mic.rails = v(0, 0); for (const s of ['left', 'right']) c.ariane.rails[s] = { ...c.ariane.rails[s], pose: [0, 0, 1] }; }
  const egal = T.etudier(parties, { grille: T.grilleDifferesEnChaine(grilleBase) });
  for (const c of egal.croisee) assert.equal(c.regle.differes, false);
  assert.match(T.texte(avec), /différés en chaîne/);
});

test('réglages : sans bloc, les différés restent exclus ; avec le bloc actif, la règle relue les admet en chaîne', () => {
  const g = { format: 'ariane-relecture-reglages-1', zones: { pn: { corriger: true, seuilMm: 8, confianceMin: 0 } }, voie: { lateralMaxMm: 45 }, coherence: { diffLateraleMaxMm: 100, ecartementMaxMm: 15 }, jamais: ['cut différé par le lot', 'cut posé par le lot'] };
  assert.equal(T.regleDuReglage(g).regle.differes, false);
  const r = T.regleDuReglage({ ...g, differesEnChaine: { actif: true, appuisMin: 1 } }).regle;
  assert.equal(r.differes.actif, true); assert.equal(r.differes.appuisMin, 1);
  assert.equal(T.regleDuReglage({ ...g, differesEnChaine: { actif: false } }).regle.differes, false);
});

test('ligne de commande : --differes-en-chaine est reconnu (le manifeste refuse toujours une partie réservée)', () => {
  const outil = path.join(__dirname, '..', 'tools', 'relecture-autonome.cjs');
  const p = spawnSync(process.execPath, [outil, 'etudier', '--partie', '1:40', '--cas', 'absent.jsonl', '--table', 'absent.json', '--differes-en-chaine'], { encoding: 'utf8' });
  assert.equal(p.status, 1); assert.match(p.stderr, /réservée/); assert.doesNotMatch(p.stderr, /argument inconnu/);
});

test('comparer : deux études des mêmes parties, écarts par partie et par groupe ; refuse des études de parties différentes', () => {
  const { cas, table } = T.essai();
  const parties = [{ designation: '9:1', cas, table }, { designation: '9:2', cas, table }];
  const grille = { ...T.GRILLE, variante: ['chaine+h'], Y: [0], C: [100], G: [15], D: [45], stages: [null], X: [8, 15], poses: [false] };
  const a = T.etudier(parties, { grille }), b = T.etudier(parties, { grille: T.grilleDifferesEnChaine(grille) });
  const c = T.comparer(a, b);
  const tot = c.total.find(t => t.groupe === 'toutes zones');
  assert.equal(tot.ecart.justes, 0); assert.equal(tot.ecart.mauvaiseVoie, 0, 'aucun différé dans la fixture : rien ne change');
  assert.ok(c.lignes.some(l => l.partie === '9:1' && l.groupe === 'zone pn' && l.ref.corrigesJustes === 7));
  assert.match(T.texteComparaison(c), /Δ justes/);
  assert.throws(() => T.comparer(a, { ...b, parties: ['9:1'] }), /parties différentes/);
});

/* Fixture commune : deux différés (cuts 66 et 67) que Mic déplace de `lat` mm en travers ; la chaîne (2 appuis) les pose à 2 mm de lui. */
function partiesAvecDifferes({ lat = 120, appuis = 2 } = {}) {
  const v = (y, z) => ({ left: [0, y, z], right: [0, y, z] });
  const { cas, table } = T.essai();
  for (const cut of [66, 67]) {
    const c = cas.find(x => x.cut === cut);
    c.mic.rails = v(lat, 0);
    for (const s of ['left', 'right']) c.ariane.rails[s] = { ...c.ariane.rails[s], pose: [0, lat - 2, 0] };
    c.ariane.chaine = { stage: 'window', ecartementPoseMm: 1437, appuis, rails: c.ariane.rails };
  }
  const t2 = { ...table, lot: [...table.lot, { cut: 66, differe: true }, { cut: 67, differe: true }] };
  return [{ designation: '9:1', cas, table: t2 }, { designation: '9:2', cas, table: t2 }];
}
const GRILLE_PETITE = { ...T.GRILLE, variante: ['chaine+h'], Y: [0], C: [100], G: [100, 15], D: [45], stages: [null], X: [8, 15], poses: [false] };

test('refus : la première condition qui retient Ariane, dans l\'ordre de la règle ; agit en est la forme booléenne', () => {
  const R = { ...SERVICE, differes: DC.reglages({ actif: true }) };
  const l = ligne({ mic: 200, var: { 'chaine+h': prop({ d: 200, e: 3, dg: 30, appuis: 1 }) } });
  assert.equal(T.refus(l, R), null); assert.equal(T.agit(l, R), true);
  assert.equal(T.refus(l, SERVICE), 'differe', 'option coupée : jamais un différé');
  assert.equal(T.refus({ ...l, var: { 'chaine+h': { ...l.var['chaine+h'], appuis: 0 } } }, R), 'differe-appuis');
  assert.equal(T.refus({ ...l, var: { 'seul+h': l.var['chaine+h'] } }, { ...R, variante: 'seul+h' }), 'differe-seul');
  assert.equal(T.refus({ ...l, var: { 'chaine+h': { ...l.var['chaine+h'], pire: 5 } } }, R), 'X');
  assert.equal(T.refus({ ...l, genre: 'vert' }, R), 'D', 'vert : la voie des verts reste');
  assert.equal(T.refus({ ...l, genre: 'vert', var: { 'chaine+h': prop({ d: 20, e: 3, dg: 30 }) } }, R), 'G', 'vert : l\'écartement des verts reste');
  assert.equal(T.refus({ ...l, var: { 'chaine+h': { ...l.var['chaine+h'], d: null } } }, R), 'abstention');
});

test('greffe : la règle de service de chaque partie (apprise sans elle) plus la seule condition des différés ; verts et posés inchangés', () => {
  const parties = partiesAvecDifferes();
  const ref = T.etudier(parties, { grille: GRILLE_PETITE });
  const g = T.greffer(parties, ref);
  assert.equal(g.format, T.FORMAT_GREFFE); assert.deepEqual(g.differesEnChaine, DC.reglages({ actif: true, appuisMin: 1 }));
  g.croisee.forEach((c, i) => {
    assert.deepEqual({ ...c.regleSobre, differes: false }, ref.croisee[i].regleSobre, 'même règle, seule la condition des différés change');
    assert.deepEqual(c.parTypeVertSobre, ref.croisee[i].parTypeVertSobre, 'verts inchangés (PN compris)');
    assert.deepEqual(c.genreSobre.pose, ref.croisee[i].genreSobre.pose, 'posés inchangés');
    assert.equal(ref.croisee[i].genreSobre.differe.agit, 0);
    assert.equal(c.genreSobre.differe.agit, 2); assert.equal(c.genreSobre.differe.corrigesJustes, 2); assert.equal(c.genreSobre.differe.mauvaiseVoie, 0);
    assert.deepEqual(c.differesSobre.map(d => [d.cut, d.agit, d.issue, d.appuis]), [[66, true, 'reproduit5', 2], [67, true, 'reproduit5', 2]]);
  });
  const cmp = T.comparer(ref, g), tot = cmp.total.find(t => t.groupe === 'toutes zones');
  assert.equal(tot.ecart.justes, 4); assert.equal(tot.ecart.abimes, 0); assert.equal(tot.ecart.mauvaiseVoie, 0);
  assert.equal(cmp.total.find(t => t.groupe === 'verts de PN').ecart.justes, 0);
  assert.match(T.texteDifferes(g), /Différés sur lesquels Ariane agit : 4, dont 0 à plus de 200 mm/);
});

test('greffe : appuisMin est fixé par l\'appelant, rien n\'est appris ; refus d\'une référence qui admet déjà des différés ou d\'autres parties', () => {
  const parties = partiesAvecDifferes({ lat: 230, appuis: 1 });
  const ref = T.etudier(parties, { grille: GRILLE_PETITE });
  const g1 = T.greffer(parties, ref), g2 = T.greffer(parties, ref, { appuisMin: 2 });
  assert.equal(g1.croisee[0].genreSobre.differe.corrigesJustes, 2);
  assert.equal(g2.croisee[0].genreSobre.differe.agit, 0, 'un seul appui : refusé avec appuisMin 2');
  assert.deepEqual(g2.croisee[0].differesSobre.map(d => d.refus), ['differe-appuis', 'differe-appuis']);
  assert.match(T.texteDifferes(g1), /dont 4 à plus de 200 mm/, 'cible à plus de 200 mm de la pose d\'ESV : comptée');
  const avec = T.etudier(parties, { grille: T.grilleDifferesEnChaine(GRILLE_PETITE) });
  assert.throws(() => T.greffer(parties, avec), /admet déjà des différés/);
  assert.throws(() => T.greffer(parties.slice(0, 1), ref), /parties différentes/);
});

test('ligne de commande : greffer exige une étude de référence', () => {
  const outil = path.join(__dirname, '..', 'tools', 'relecture-autonome.cjs');
  const p = spawnSync(process.execPath, [outil, 'greffer', '--partie', '1:12', '--cas', 'absent.jsonl', '--table', 'absent.json'], { encoding: 'utf8' });
  assert.equal(p.status, 1); assert.match(p.stderr, /greffer --ref/);
  const q = spawnSync(process.execPath, [outil, 'greffer', '--appuis-min', '0'], { encoding: 'utf8' });
  assert.equal(q.status, 1); assert.match(q.stderr, /entier ≥ 1/);
});

test('réglages proposés : avec les différés en chaîne, `jamais` garde « cut différé par le lot » (un lecteur qui ignore le bloc reste fermé) ; le bloc porte l\'exception', () => {
  const parties = partiesAvecDifferes();
  const avec = T.etudier(parties, { grille: T.grilleDifferesEnChaine(GRILLE_PETITE) });
  assert.equal(avec.figeSobre.regle.differes.actif, true);
  const g = T.reglagesProposes(avec, { date: '2026-10-17' });
  assert.deepEqual(g.jamais, ['cut différé par le lot', 'cut posé par le lot']);
  assert.equal(g.differesEnChaine.actif, true); assert.equal(g.differesEnChaine.appuisMin, 2, 'à gain égal, la validation croisée garde le plus d\'appuis (2 dans la fixture)');
  assert.equal(g.voie.lateralMaxMm, 45, 'la limite de voie du fichier reste celle des verts');
  assert.equal(T.regleDuReglage(g).regle.differes.actif, true, 'relue par l\'outil : les différés en chaîne sont admis');
  const sans = T.reglagesProposes(T.etudier(parties, { grille: GRILLE_PETITE }), { date: '2026-10-17' });
  assert.equal(sans.differesEnChaine, undefined); assert.equal(T.regleDuReglage(sans).regle.differes, false);
});
