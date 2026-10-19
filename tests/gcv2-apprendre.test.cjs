'use strict';
/* G1-b — apprentissage de la GCV2 (tools/gcv2-apprendre.cjs, fiches/G1B_APPRENTISSAGE.md), sur un jeu SYNTHÉTIQUE (tests/helpers/gcv2-apprendre-fixture.cjs :
 * valeurs inventées, graine fixe, aucune donnée de terrain). Familles d'essais :
 *  - MODÈLE : la logistique retrouve des coefficients connus ; le calibrage est monotone et corrige un modèle trop sûr de lui ;
 *  - ANTI-FUITE (D-201, condition 1) : `visites`, `reference`, `etat` et les champs d'étiquette ne sont jamais des traits (liste blanche refusée,
 *    champs ignorés, score inchangé) ;
 *  - VALIDATION CROISÉE : un pli ne voit jamais sa partie (normalisation, vocabulaire, calibrage, τ et δ, modèle) ;
 *  - GARDE-FOUS : une paire de mauvaise voie est écartée même avec un score de 1 ;
 *  - USAGES : le « lot » retire les hypothèses H4 de source humaine ;
 *  - RÉFÉRENCES : la règle prudente est celle des réglages figés, le hasard a le taux d'action de la GCV2 ;
 *  - EXPORT : reproductible octet pour octet, sans coordonnée ni ligne d'exemple ;
 *  - VARIANTES PAR ZONE (D-204) : une variante n'agit jamais sur un rouge ni un différé, ni hors de ses zones ; sans l'option `--variante`, la sortie est
 *    celle de G1-b, octet pour octet. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const F = require('./helpers/gcv2-apprendre-fixture.cjs');
const A = require('../tools/gcv2-apprendre.cjs');

const SIDES = ['left', 'right'];
const jeu = (opt = {}) => { const l = F.jeuSynthetique(opt); return A.jeuDeLignes(l); };
const trois = (opt = {}) => [1, 2, 3].map(n => { const j = jeu({ partie: `9:${n}`, graine: n, cuts: 50, ...opt }); j.sha256 = 'x'.repeat(63) + n; return j; });

test('la logistique retrouve des coefficients connus', () => {
  const rnd = F.alea(5), n = 6000, p = 3, vrai = [1.5, -2, 0.7], b0 = -0.4, X = new Float64Array(n * p), y = new Uint8Array(n);
  const N = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;
  for (let i = 0; i < n; i++) { let z = b0; for (let j = 0; j < p; j++) { X[i * p + j] = N(); z += vrai[j] * X[i * p + j]; } y[i] = rnd() < A.sigmoide(z) ? 1 : 0; }
  const m = A.ajusterLogistique(X, n, p, y, new Float64Array(n).fill(1), 0.01);
  vrai.forEach((v, j) => assert.ok(Math.abs(m.coef[j] - v) < 0.15, `coefficient ${j} : ${m.coef[j]} contre ${v}`));
  assert.ok(Math.abs(m.intercept - b0) < 0.12, `ordonnée ${m.intercept}`);
  /* L2 : une pénalité forte rétrécit les coefficients. */
  const fort = A.ajusterLogistique(X, n, p, y, new Float64Array(n).fill(1), 3000);
  fort.coef.forEach((c, j) => assert.ok(Math.abs(c) < Math.abs(m.coef[j])));
  /* Pondération : doubler le poids de tous les exemples d'une classe déplace l'ordonnée. */
  const w = Float64Array.from(y, v => v ? 3 : 1), pondere = A.ajusterLogistique(X, n, p, y, w, 0.01);
  assert.ok(pondere.intercept > m.intercept + 0.5);
});

test('le calibrage de Platt est monotone et corrige un score trop sûr de lui', () => {
  const rnd = F.alea(9), n = 4000, z = new Float64Array(n), y = new Uint8Array(n), w = new Float64Array(n).fill(1);
  for (let i = 0; i < n; i++) { const vrai = (rnd() + rnd() + rnd() - 1.5) * 2; z[i] = 3 * vrai; y[i] = rnd() < A.sigmoide(vrai) ? 1 : 0; }   // score 3 fois trop grand
  const c = A.platt(z, y, w);
  assert.ok(c.a > 0 && c.a < 0.6, `pente ${c.a}`);
  let prec = -1;
  for (let s = -12; s <= 12; s += 0.25) { const p = A.appliquerPlatt(c, s); assert.ok(p >= prec, 'monotone croissant'); prec = p; }
  const brier = f => { let b = 0; for (let i = 0; i < n; i++) b += (f(z[i]) - y[i]) ** 2; return b / n; };
  assert.ok(brier(s => A.appliquerPlatt(c, s)) < brier(s => A.sigmoide(s)) - 0.005, 'le calibrage améliore le Brier');
  /* Même avec des étiquettes inversées, la pente reste positive (le calibrage ne renverse jamais l'ordre). */
  assert.ok(A.platt(z, Uint8Array.from(y, v => 1 - v), w).a > 0);
});

test('liste blanche : les champs de comportement et d\'étiquette sont interdits', () => {
  assert.equal(A.verifierListeBlanche(), true);
  for (const nom of ['visites', 'reference', 'etat', 'etiquette', 'micRailMm', 'micMaxMm', 'etiquette.classe'])
    assert.throws(() => A.verifierListeBlanche([{ nom: 'x', src: 'hyp', chemin: nom, tr: 'id' }]), /interdit/, nom);
  assert.throws(() => A.verifierListeBlanche([{ nom: 'visites', src: 'ctx', chemin: 'n', tr: 'id' }]), /interdit/);
  assert.throws(() => A.verifierListeBlanche([{ nom: 'a', src: 'cut', chemin: 'zone', tr: 'id' }]), /source inconnue/);
  const tous = [...A.NUM, ...A.CAT, ...A.MULTI];
  assert.ok(tous.length > 50);
  for (const t of tous) assert.equal(A.estInterdit(t.nom) || A.estInterdit(t.chemin), false, t.nom);
  for (const nom of ['visites', 'reference', 'etat']) assert.ok(A.INTERDITS.includes(nom));
});

test('anti-fuite : changer visites, reference, etat et les champs d\'étiquette ne change pas le score', () => {
  const lignes = F.jeuSynthetique({ partie: '9:1', graine: 4, cuts: 40 });
  const casA = A.construireCas(A.jeuDeLignes(lignes), 'relecture');
  /* Même jeu, avec le comportement de l'opérateur et des champs d'étiquette volontairement changés, y compris glissés dans les traits. */
  const b = JSON.parse(JSON.stringify(lignes));
  for (const l of b) {
    if (l.type === 'cut') { l.visites = 977; l.reference = 'autre-reference'; l.etat = 'calcule'; l.etiquette.grosse = !l.etiquette.grosse; l.moteur = null; }
    if (l.type === 'rail') l.micRailMm = 123.4;
    if (l.type === 'hyp') Object.assign(l.traits, { visites: 55, reference: 'x', etat: 'y', etiquette: 'z', micRailMm: 3, ecartMm: 1 });
  }
  const casB = A.construireCas(A.jeuDeLignes(b), 'relecture');
  assert.equal(casA.length, casB.length);
  casA.forEach((k, i) => SIDES.forEach(s => k.rails[s].hyps.forEach((h, j) => assert.deepEqual(h.x, casB[i].rails[s].hyps[j].x, 'mêmes traits bruts'))));
  const mod = A.entrainer(casA, { lambda: 10 }), sA = A.scorer(mod, casA), sB = A.scorer(mod, casB);
  assert.deepEqual(Array.from(sA.z10), Array.from(sB.z10), 'même score');
  assert.deepEqual(Array.from(sA.z5), Array.from(sB.z5));
  /* Un modèle entraîné sur l'un ou l'autre est le même. */
  const modB = A.entrainer(casB, { lambda: 10 });
  assert.deepEqual(modB.m10.coef, mod.m10.coef);
  /* Aucun nom de colonne du modèle ne vient d'un champ interdit. */
  for (const nom of mod.fit.noms) assert.equal(A.INTERDITS.some(i => nom === i || nom.startsWith(i + '=')), false, nom);
  /* Un cut dont l'état n'est pas « calculé » n'entre pas (sélection des exemples, pas un trait). */
  const c = JSON.parse(JSON.stringify(lignes)); const cutsCalcules = c.filter(l => l.type === 'cut').length;
  c.find(l => l.type === 'cut').etat = 'sans-nuage';
  assert.equal(A.construireCas(A.jeuDeLignes(c), 'relecture').length, casA.length - 1);
  assert.ok(cutsCalcules >= casA.length);
});

test('les jeux de jugement, les témoins et les parties réservées sont refusés', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcv2app-'));
  try {
    const ecrire = (nom, opt) => { const f = path.join(dir, nom); fs.writeFileSync(f, F.jeuSynthetique(opt).map(l => JSON.stringify(l)).join('\n') + '\n'); return f; };
    const manifeste = { apprentissage: [{ projet: 1, parties: [12] }], temoins: [{ projet: 1, parties: [11] }], date: '2026-10-19', format: 'ariane-manifeste-parties-v1' };
    assert.equal(A.lireJeuFichier(ecrire('ok.jsonl', { partie: '1:12', cuts: 3 }), { manifeste }).partie, '1:12');
    assert.throws(() => A.lireJeuFichier(ecrire('temoin.jsonl', { partie: '1:11', cuts: 3 }), { manifeste }), /témoin fixe/);
    assert.throws(() => A.lireJeuFichier(ecrire('reservee.jsonl', { partie: '2:6', cuts: 3 }), { manifeste }), /réservée/);
    assert.throws(() => A.lireJeuFichier(ecrire('jugement.jsonl', { partie: '1:12', cuts: 3, jeu: 'jugement' }), { manifeste }), /jeu « jugement »/);
    /* Les parties d'apprentissage du manifeste du dépôt ne contiennent ni 1:11, ni 1:25, ni 2:6. */
    const M = require('../tools/manifeste-parties.cjs').lire();
    for (const [p, n] of [[1, 11], [1, 25], [2, 6]]) assert.notEqual(require('../tools/manifeste-parties.cjs').statut(M, p, n), 'apprentissage');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('validation croisée : un pli ne voit jamais sa partie', () => {
  const ps = trois(), appels = [];
  const V = A.validationCroisee(ps, { usage: 'relecture', lambda: 10, espion: (nom, parties) => appels.push([nom, parties.slice()]) });
  assert.ok(appels.length >= 12, 'chaque pas lit des parties');
  /* Le pli k : tous les pas (modèles internes, calibrage, seuils, modèle final) ne lisent que les deux autres parties. L'espion reçoit d'abord le pli. */
  let courant = null;
  for (const [nom, parties] of appels) {
    if (nom === 'pli') { courant = ps.map(p => p.partie).find(n => !parties.includes(n)); assert.equal(parties.length, 2); continue; }
    assert.ok(courant && !parties.includes(courant), `${nom} lit la partie jugée ${courant}`);
  }
  assert.deepEqual(V.parties, ['9:1', '9:2', '9:3']);
  for (const p of V.parties) assert.ok(V.parPartie[p].seuils && V.parPartie[p].calibrage10.a > 0);
});

test('validation croisée : les paramètres d\'un pli ne dépendent pas de la partie jugée (normalisation, calibrage, τ et δ, modèle)', () => {
  const normal = trois(), gate = trois();
  /* On abîme la partie 9:3 de la seconde copie : valeurs de traits, étiquettes, zones. */
  const lignes = F.jeuSynthetique({ partie: '9:3', graine: 3, cuts: 50 });
  for (const l of lignes) {
    if (l.type === 'hyp') { l.traits.pointsDessus = 5000; l.traits.strong = !l.traits.strong; l.traits.palier = 'NOUVEAU'; l.etiquette.ecartMm = l.etiquette.ecartMm > 8 ? 0 : 40; }
    if (l.type === 'cut') { l.zone = 'liste'; l.role = 'rouge'; l.etiquette.micMaxMm = 80; }
  }
  gate[2] = A.jeuDeLignes(lignes); gate[2].sha256 = normal[2].sha256;
  const empreinte = V => V.parPartie['9:3'] && null;
  void empreinte;
  const a = A.validationCroisee(normal, { usage: 'relecture', lambda: 10 }), b = A.validationCroisee(gate, { usage: 'relecture', lambda: 10 });
  /* Pli « 9:3 jugé » : appris sur 9:1 et 9:2, identiques dans les deux copies. */
  assert.deepEqual(a.parPartie['9:3'].seuils, b.parPartie['9:3'].seuils, 'seuils');
  assert.deepEqual(a.parPartie['9:3'].calibrage10, b.parPartie['9:3'].calibrage10, 'calibrage');
  assert.equal(a.parPartie['9:3'].empreinteModele, b.parPartie['9:3'].empreinteModele, 'normalisation, vocabulaire et coefficients');
  assert.notDeepEqual(a.parPartie['9:3'].gcv2, b.parPartie['9:3'].gcv2, 'la partie jugée, elle, a bien changé');
  /* Les plis des autres parties, eux, voient la partie abîmée. */
  assert.notEqual(a.parPartie['9:1'].empreinteModele, b.parPartie['9:1'].empreinteModele);
});

test('garde-fous : une paire de mauvaise voie est écartée même avec un score de 1', () => {
  const k = A.construireCas(jeu({ partie: '9:1', graine: 2, cuts: 30 }), 'relecture')[0];
  const mk = (l, v, g) => ({ rang: 0, hauteur: false, origines: ['H2'], sousOrigines: ['comp'], decal: [0, l, v], g, x: k.rails.left.hyps[0].x, y: { ecartMm: 0 } });
  const G0 = k.G0, gMed = k.gMed;
  /* Un rail de chaque côté à 60 mm en latéral : hors du garde-fou des 45 mm. */
  k.rails.left.hyps.push(mk(60, 0, G0 + 60)); k.rails.right.hyps.push(mk(0, 0, G0));
  /* Un dévers de 20 mm entre les deux rails. */
  k.rails.left.hyps.push(mk(0, 20, G0)); k.rails.right.hyps.push(mk(0, 0, G0));
  /* Un écartement hors contrat : 1 500 mm au lieu de 1 450 mm, médiane 1 450. */
  k.rails.left.hyps.push(mk(40, 0, G0 + 50)); k.rails.right.hyps.push(mk(40, 0, G0 + 50));
  k.paires = A.pairesPermises(k);
  const n = k.rails.left.hyps.length, m = k.rails.right.hyps.length, mauvais = [n - 3, n - 2, n - 1], mauvaisD = [m - 3, m - 2, m - 1];
  /* les trois pièges sont tous écartés, quel que soit le rail opposé */
  for (const q of k.paires) {
    assert.ok(Math.abs(k.rails.left.hyps[q.i].decal[1]) <= A.GARDES.lateralMaxMm && Math.abs(k.rails.right.hyps[q.j].decal[1]) <= A.GARDES.lateralMaxMm, 'latéral');
    assert.ok(Math.abs(k.rails.left.hyps[q.i].decal[2] - k.rails.right.hyps[q.j].decal[2]) <= A.GARDES.deversMaxMm, 'dévers');
    const g = A.ecartementPaire(k, k.rails.left.hyps[q.i], k.rails.right.hyps[q.j]);
    assert.ok(Math.abs(g - gMed) <= 15 || (g >= 1420 && g <= 1470), 'écartement');
  }
  assert.ok(!k.paires.some(q => q.i === n - 3), 'latéral de 60 mm écarté');
  assert.ok(!k.paires.some(q => q.i === n - 2), 'dévers de 20 mm écarté');
  assert.ok(!k.paires.some(q => q.i === n - 1 && q.j === m - 1), 'écartement hors contrat écarté');
  /* Score de 1 sur les pièges, 0,5 ailleurs : la décision ne choisit jamais une paire interdite. */
  const p = { left: new Float64Array(n).fill(0.5), right: new Float64Array(m).fill(0.5) };
  for (const i of mauvais) p.left[i] = 1; for (const j of mauvaisD) p.right[j] = 1;
  const seuils = Object.fromEntries(A.ZONES.map(z => [z, { actif: true, tau: 0.3, delta: 2 }]));
  const permise = d => (d.i === k.i0.left && d.j === k.i0.right) || k.paires.some(q => q.i === d.i && q.j === d.j);
  assert.ok(permise(A.decider(k, p, seuils)));
  const tout1 = { left: new Float64Array(n).fill(1), right: new Float64Array(m).fill(1) };
  assert.ok(permise(A.decider(k, tout1, seuils)));
  /* H0 reste permis même si l'écartement de départ est hors contrat. */
  k.G0 = 1600; assert.equal(A.decider(k, { left: new Float64Array(n).fill(0.9), right: new Float64Array(m).fill(0.9) }, seuils).etat, 'laisse');
});

test('décision de paire : τ et δ, laisser et s\'abstenir', () => {
  const [k] = A.construireCas(jeu({ partie: '9:1', graine: 6, cuts: 20 }), 'relecture').filter(c => c.paires.length > 2);
  const n = k.rails.left.hyps.length, m = k.rails.right.hyps.length, q = k.paires[0];
  const p = { left: new Float64Array(n).fill(0.1), right: new Float64Array(m).fill(0.1) };
  p.left[k.i0.left] = 0.2; p.right[k.i0.right] = 0.2;                              // H0 vaut 0,04
  p.left[q.i] = 0.8; p.right[q.j] = 0.9;                                           // la paire q vaut 0,72
  const seuil = (tau, delta, actif = true) => Object.fromEntries(A.ZONES.map(z => [z, { actif, tau, delta }]));
  assert.equal(A.decider(k, p, seuil(0.7, 1)).etat, 'agit');
  assert.equal(A.decider(k, p, seuil(0.8, 1)).etat, 'abstient', 'p trop bas pour τ');
  assert.equal(A.decider(k, p, seuil(0.5, q.ecart + 1)).etat, 'laisse', 'écart à H0 trop petit pour δ');
  assert.equal(A.decider(k, p, seuil(0.5, 1, false)).etat, 'laisse', 'zone inactive');
  const d = A.decider(k, p, seuil(0.7, 1));
  assert.equal(d.alternatives.length, 2);
  assert.ok(Math.abs(d.p - 0.72) < 1e-9);
});

test('τ et δ : 0 mauvaise voie, erreur ≤ 9 %, et une zone sans seuil admissible reste inactive', () => {
  const cas = A.construireCas(jeu({ partie: '9:1', graine: 8, cuts: 50 }), 'relecture');
  /* Probabilités « oracle » : 1 pour les hypothèses à 10 mm, 0,05 sinon. */
  const oracle = cas.map(k => Object.fromEntries(SIDES.map(s => [s, Float64Array.from(k.rails[s].hyps, h => h.y.ecartMm <= 10 ? 0.97 : 0.05)])));
  const s1 = A.choisirSeuils(cas, oracle, { erreurMax: 0.09, mauvaiseVoieMax: 0, justesMinZone: 3 });
  const rs = cas.map((k, i) => A.resultatDeDecision(k, A.decider(k, oracle[i], s1)));
  const b = A.bilanDe(rs.filter(r => r.etat === 'agit'));
  assert.ok(b.agit > 0 && b.erreurs / b.agit <= 0.09 + 1e-12 && b.mauvaiseVoie === 0, JSON.stringify(b));
  /* Des probabilités qui ne disent rien : aucune zone ne peut garantir 9 % d'erreur, aucune n'agit. */
  const aveugle = cas.map(k => Object.fromEntries(SIDES.map(s => [s, Float64Array.from(k.rails[s].hyps, (h, i) => 0.5 + 0.001 * ((i * 7919 + k.cut) % 13))])));
  const s2 = A.choisirSeuils(cas, aveugle, { erreurMax: 0.0001, mauvaiseVoieMax: 0, justesMinZone: 3 });
  for (const z of A.ZONES) assert.equal(s2[z].actif || s2[z].erreurs / Math.max(1, s2[z].agit) <= 0.0001, true);
  /* Le minimum de corrections justes par zone empêche les petites zones d'agir. */
  const s3 = A.choisirSeuils(cas, oracle, { erreurMax: 0.09, mauvaiseVoieMax: 0, justesMinZone: 100000 });
  for (const z of A.ZONES) assert.equal(s3[z].actif, false);
});

test('usage « lot » : les hypothèses H4 de source humaine sont retirées, les traits d\'écart aux voisins annulés', () => {
  const j = jeu({ partie: '9:1', graine: 3, cuts: 60 });
  const rel = A.construireCas(j, 'relecture'), lot = A.construireCas(j, 'lot');
  assert.equal(rel.length, lot.length, 'mêmes cuts');
  const avecH4 = c => SIDES.reduce((a, s) => a + c.rails[s].hyps.filter(h => h.origines.includes('H4')).length, 0);
  assert.ok(rel.reduce((a, c) => a + avecH4(c), 0) > 20, 'la fixture a des voisins humains');
  assert.equal(lot.reduce((a, c) => a + avecH4(c), 0), 0, 'aucune hypothèse H4 humaine en lot');
  assert.ok(lot.every(c => SIDES.every(s => c.rails[s].hyps.every(h => !h.sousOrigines.includes('voisins-humains')))));
  const iV = A.NUM.findIndex(t => t.nom === 'ecartVoisinsMm'), iH = A.NUM.findIndex(t => t.nom === 'voisinsHumains');
  for (const c of lot) for (const s of SIDES) for (const h of c.rails[s].hyps) { assert.ok(Number.isNaN(h.x.n[iV]), 'écart aux voisins annulé'); assert.equal(h.x.n[iH], 0); }
  /* Les étiquettes des hypothèses gardées ne changent pas, et H0 est toujours là. */
  lot.forEach((c, i) => SIDES.forEach(s => { assert.ok(c.rails[s].hyps.length <= rel[i].rails[s].hyps.length); assert.ok(c.i0[s] >= 0); }));
  /* Un usage inconnu est refusé. */
  assert.throws(() => A.construireCas(j, 'autre'), /usage/);
});

test('références : la règle prudente est celle des réglages figés ; le hasard agit au même taux que la GCV2', () => {
  const R = A.reglesPrudentesDuDepot(), F0 = A.REGLES_PRUDENTES;
  assert.equal(R.variante, F0.variante); assert.equal(R.seuilMm, F0.seuilMm); assert.equal(R.lateralMaxMm, F0.lateralMaxMm);
  assert.equal(R.ecartementMedianeMm, F0.ecartementMedianeMm); assert.equal(R.confianceMin, F0.confianceMin);
  assert.deepEqual(R.zones.filter(z => z !== 'hors'), [...F0.zones].sort()); assert.deepEqual(R.roles, F0.roles);
  /* Règle prudente sur un cut synthétique : agit quand la pose A* (H1) s'écarte de 8 mm ou plus. */
  const cas = A.construireCas(jeu({ partie: '9:1', graine: 11, cuts: 60 }), 'relecture');
  const rs = cas.map(k => A.reglePrudente(k));
  assert.ok(rs.some(r => r.etat === 'agit') && rs.some(r => r.etat === 'laisse'));
  for (const r of rs) if (r.etat === 'agit') { assert.ok(F0.zones.includes(r.zone) && F0.roles.includes(r.role)); assert.ok(r.lat <= 45); }
  /* Hasard en espérance : taux d'action par zone respecté. */
  const taux = { pn: 0.5, adv: 0.25, abords: 0, liste: 0, hors: 1 };
  const h = A.hasardEnEsperance(cas, taux);
  for (const z of A.ZONES) {
    const nz = cas.filter(k => k.zone === z && k.paires.length).length;
    assert.ok(Math.abs(h.parZone[z].agit - taux[z] * nz) < 1e-9, `taux de ${z} : ${h.parZone[z].agit} contre ${taux[z] * nz}`);
  }
  assert.equal(h.total.visites, cas.length);
  /* Le hasard avec un taux nul ne fait rien ; les grosses corrections restent toutes « laissées fausses ». */
  const zero = A.hasardEnEsperance(cas, {});
  assert.equal(zero.total.agit, 0); assert.equal(zero.total.laisseFaux, zero.total.micSup10);
});

test('mesures : corrections justes, abîmés, mauvaise voie, erreur et borne de Wilson', () => {
  const r = (mic, e, lat = 0, etat = 'agit') => ({ mic, e, lat, etat, zone: 'pn', role: 'vert' });
  const b = A.bilanDe([r(20, 4), r(20, 12), r(2, 14), r(2, 1), r(30, 80), r(12, 9, 50), r(20, 0, 0, 'laisse'), r(3, 0, 0, 'abstient')]);
  assert.equal(b.visites, 8); assert.equal(b.agit, 6); assert.equal(b.justes, 2); assert.equal(b.justes5, 1);          // (20,4) et (12,9) ; (20,12) est faux
  assert.equal(b.abimes, 1); assert.equal(b.mauvaiseVoie, 2, 'e > 50 ou latéral > 45'); assert.equal(b.erreurs, 3);
  assert.equal(b.laisseFaux, 1); assert.equal(b.abstentions, 1);
  const w = A.wilson(2, 40); assert.ok(w.bas < 0.05 && w.haut > 0.05 && w.haut < 0.17);
  assert.equal(A.wilson(0, 0).haut, null);
});

test('export : reproductible octet pour octet, sans coordonnée ni ligne d\'exemple', () => {
  const ps = trois();
  const e1 = A.serialiser(A.exporter(ps, { usages: ['relecture', 'lot'], lambda: 10, date: '2026-10-19' }));
  const e2 = A.serialiser(A.exporter(trois(), { usages: ['relecture', 'lot'], lambda: 10, date: '2026-10-19' }));
  assert.equal(e1, e2, 'même jeu, même fichier');
  assert.ok(Buffer.from(e1).equals(Buffer.from(e2)));
  const o = JSON.parse(e1);
  assert.equal(o.format, A.FORMAT_PARAMS); assert.equal(o.date, '2026-10-19'); assert.equal(o.version, A.VERSION);
  assert.deepEqual(o.parties.map(p => p.partie), ['9:1', '9:2', '9:3']);
  for (const p of o.parties) assert.match(p.sha256, /^x{63}\d$/);
  for (const u of ['relecture', 'lot']) {
    const U = o.usages[u];
    assert.equal(U.modele10.coefficients.length, U.colonnes.length); assert.equal(U.modele5.coefficients.length, U.colonnes.length);
    assert.ok(U.calibrage10.a > 0 && U.calibrage5.a > 0);
    for (const z of A.ZONES) assert.ok('actif' in U.seuils[z] && 'tau' in U.seuils[z] && 'delta' in U.seuils[z]);
  }
  assert.ok(o.listeBlanche.length > 50 && o.listeBlanche.every(t => !A.estInterdit(t.nom)));
  assert.deepEqual(o.interdits, A.INTERDITS);
  /* Ni ligne d'exemple, ni coordonnée, ni étiquette. */
  const sansInterdits = JSON.stringify({ ...o, interdits: undefined });             // la liste des champs interdits les nomme, c'est son rôle
  for (const clef of ['"decal"', '"ecartMm"', '"etiquette"', '"micMaxMm"', '"positionSceneRelative"', '"origine"', '"visites"']) assert.equal(sansInterdits.includes(clef), false, clef);
  assert.ok(e1.length < 60000, `petit fichier : ${e1.length} octets`);
  /* Un export sans date est refusé. */
  assert.throws(() => A.exporter(ps, { lambda: 10 }), /--date/);
  /* Une autre graine de jeu change le fichier (le test n'est pas vide). */
  const e3 = A.serialiser(A.exporter([jeu({ partie: '9:1', graine: 41, cuts: 50 }), ...trois().slice(1)].map((j, i) => { j.sha256 = 'y'.repeat(64); return j; }), { usages: ['relecture', 'lot'], lambda: 10, date: '2026-10-19' }));
  assert.notEqual(e1, e3);
});

test('rapport : tableaux de validation croisée lisibles', () => {
  const V = A.validationCroisee(trois(), { usage: 'lot', lambda: 10 });
  const t = A.rapport(V);
  for (const mot of ['Usage « lot »', 'règle prudente', 'hasard', 'H0 (ne rien faire)', 'Par zone', 'Calibrage', 'Traits dominants', 'Seuils par pli']) assert.ok(t.includes(mot), mot);
  assert.equal(V.calibrage.p10.classes.length, 10);
  assert.ok(V.total.gcv2.total.visites === V.nCas && V.total.prudente.total.visites === V.nCas && V.total.h0.total.visites === V.nCas && Math.abs(V.total.hasard.total.visites - V.nCas) < 1e-9, 'mêmes cuts pour toutes les méthodes');
});

/* ------------------------------------------------------------------ variantes par zone (D-204) */
const ZV = v => ({ gcv2: v.gcv2.zones, prudente: v.prudente.zones });
test('variantes : le fichier dit V1, V2 et V3 comme D-204, sans coefficient, et refuse un rôle rouge ou différé', () => {
  const D = A.lireVariantes();
  assert.deepEqual(Object.keys(D), ['V1', 'V2', 'V3']);
  assert.deepEqual(ZV(D.V1), { gcv2: ['pn', 'adv'], prudente: ['abords'] });
  assert.deepEqual(ZV(D.V2), { gcv2: ['pn', 'adv', 'hors'], prudente: ['abords'] });
  assert.deepEqual(ZV(D.V3), { gcv2: ['pn', 'adv', 'liste', 'hors'], prudente: [] });
  for (const v of Object.values(D)) assert.deepEqual(v.gcv2.roles, ['vert']);
  const brut = JSON.parse(fs.readFileSync(A.FICHIER_VARIANTES, 'utf8'));
  assert.equal(brut.format, A.FORMAT_VARIANTES);
  const nombres = []; (function parcours(o) { if (typeof o === 'number') nombres.push(o); else if (o && typeof o === 'object') Object.values(o).forEach(parcours); })(brut);
  assert.deepEqual(nombres, [], 'aucun coefficient dans le fichier des variantes');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'var-'));
  try {
    const ecrire = (nom, v) => { const f = path.join(dir, nom); fs.writeFileSync(f, JSON.stringify({ format: A.FORMAT_VARIANTES, variantes: { X: v } })); return f; };
    assert.throws(() => A.lireVariantes(ecrire('a.json', { gcv2: { zones: ['pn'], roles: ['vert', 'differe'] }, prudente: { zones: [], roles: [] } })), /ni rouge ni différé/);
    assert.throws(() => A.lireVariantes(ecrire('b.json', { gcv2: { zones: ['pn'], roles: ['rouge'] }, prudente: { zones: [], roles: [] } })), /ni rouge ni différé/);
    assert.throws(() => A.lireVariantes(ecrire('c.json', { gcv2: { zones: ['ailleurs'], roles: ['vert'] }, prudente: { zones: [], roles: [] } })), /zone inconnue/);
    assert.throws(() => A.lireVariantes(ecrire('d.json', { gcv2: { zones: ['pn'], roles: ['vert'] }, prudente: { zones: ['hors'], roles: ['vert'] } })), /hors de son périmètre/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('variantes : jamais sur un différé ni sur un rouge, ni hors de leurs zones, même si la GCV2 et la règle prudente agissent partout', () => {
  const D = A.lireVariantes(), cas = A.construireCas(jeu({ partie: '9:1', graine: 11, cuts: 120 }), 'relecture');
  /* La GCV2 « agit » sur tous les cuts (pose parfaite) ; la règle prudente est la vraie. */
  const rG = cas.map(k => ({ ...A.resultatH0(k), etat: 'agit', e: 0, lat: 0 })), rP = cas.map(k => A.reglePrudente(k));
  assert.ok(cas.some(k => k.role === 'differe') && cas.some(k => k.role === 'rouge') && cas.some(k => k.zone === 'abords') && cas.some(k => k.zone === 'hors'), 'la fixture a de quoi tester');
  assert.ok(rP.some(r => r.etat === 'agit' && r.zone === 'abords'), 'la règle prudente agit quelque part aux abords');
  for (const nom of Object.keys(D)) {
    cas.forEach((k, i) => {
      const r = A.appliquerVariante(k, nom, rG[i], rP[i], D);
      const attendu = k.role === 'vert' && D[nom].gcv2.zones.includes(k.zone) ? rG[i] : k.role === 'vert' && D[nom].prudente.zones.includes(k.zone) ? rP[i] : null;
      if (attendu) assert.equal(r, attendu, `${nom} ${k.zone} ${k.role}`);
      else { assert.equal(r.etat, 'laisse', `${nom} ne fait rien sur ${k.zone}/${k.role}`); assert.equal(r.e, null); }
      if (r.etat === 'agit') assert.equal(k.role, 'vert', `${nom} n'agit que sur un vert`);
    });
  }
  /* Cas précis. */
  const un = (zone, role) => { const c = cas.find(x => x.zone === zone && x.role === role); assert.ok(c, `${zone}/${role}`); return c; };
  const rg = c => ({ ...A.resultatH0(c), etat: 'agit', e: 0, lat: 0 }), rp = c => ({ ...A.resultatH0(c), etat: 'agit', e: 1, lat: 0 });
  assert.equal(A.appliquerVariante(un('pn', 'vert'), 'V1', rg(un('pn', 'vert')), rp(un('pn', 'vert')), D).e, 0, 'V1 : GCV2 en PN');
  assert.equal(A.appliquerVariante(un('abords', 'vert'), 'V1', rg(un('abords', 'vert')), rp(un('abords', 'vert')), D).e, 1, 'V1 : règle prudente aux abords');
  assert.equal(A.appliquerVariante(un('hors', 'vert'), 'V1', rg(un('hors', 'vert')), rp(un('hors', 'vert')), D).etat, 'laisse', 'V1 : rien hors zone');
  assert.equal(A.appliquerVariante(un('hors', 'vert'), 'V2', rg(un('hors', 'vert')), rp(un('hors', 'vert')), D).e, 0, 'V2 : GCV2 hors zone');
  assert.equal(A.appliquerVariante(un('abords', 'vert'), 'V3', rg(un('abords', 'vert')), rp(un('abords', 'vert')), D).etat, 'laisse', 'V3 : rien aux abords');
  assert.equal(A.appliquerVariante(un('pn', 'differe'), 'V3', rg(un('pn', 'differe')), rp(un('pn', 'differe')), D).etat, 'laisse', 'V3 : rien sur un différé');
  assert.throws(() => A.appliquerVariante(cas[0], 'V9', rG[0], rP[0], D), /inconnue/);
});

test('variantes : validation croisée, bilans par zone et par rôle conformes à D-204', () => {
  for (const usage of ['relecture', 'lot']) {
    const V = A.validationCroisee(trois(), { usage, lambda: 10, variantes: ['V1', 'V2', 'V3'] }), S = V.variantes;
    assert.deepEqual(Object.keys(S), ['V1', 'V2', 'V3']);
    for (const nom of Object.keys(S)) {
      const s = S[nom];
      assert.equal(s.total.visites, V.nCas, 'mêmes cuts'); assert.equal(s.parRole.differe.agit + s.parRole.differe.abstentions, 0, `${nom} : rien sur les différés`);
      assert.equal(s.parRole.rouge.agit + s.parRole.rouge.abstentions, 0, `${nom} : rien sur les rouges`);
      assert.equal(s.parZone.liste.agit, 0);
      for (const p of V.parties) assert.equal(V.parPartie[p].variantes[nom].parRole.differe.agit, 0);
    }
    /* Zone par zone : PN et ADV identiques dans les trois variantes (GCV2) ; les abords sont la règle prudente en V1 et V2 (elle n'agit que sur des verts),
     * rien en V3 ; hors zone, rien en V1, la GCV2 en V2 et V3. */
    assert.deepEqual(S.V1.parZone.pn, S.V2.parZone.pn); assert.deepEqual(S.V2.parZone.pn, S.V3.parZone.pn);
    assert.deepEqual(S.V1.parZone.adv, S.V2.parZone.adv); assert.deepEqual(S.V2.parZone.adv, S.V3.parZone.adv);
    assert.equal(S.V1.parZone.hors.agit + S.V1.parZone.hors.abstentions, 0, 'V1 : rien hors zone'); assert.deepEqual(S.V2.parZone.hors, S.V3.parZone.hors);
    assert.deepEqual(S.V1.parZone.abords, S.V2.parZone.abords);
    assert.equal(S.V1.parZone.abords.agit, V.total.prudente.parZone.abords.agit, 'V1 : aux abords, les actions de la règle prudente');
    assert.ok(S.V1.parZone.abords.agit > 0, 'V1 : la règle prudente agit aux abords');
    assert.equal(S.V3.parZone.abords.agit + S.V3.parZone.abords.abstentions, 0, 'V3 : rien aux abords');
    assert.equal(S.V2.total.agit, S.V1.total.agit + S.V2.parZone.hors.agit, 'V2 = V1 plus le hors zone');
    assert.equal(S.V3.total.agit, S.V2.total.agit - S.V2.parZone.abords.agit, 'V3 = V2 moins les abords');
    for (const nom of Object.keys(S)) assert.equal(S[nom].parRole.vert.agit, S[nom].total.agit, `${nom} : tout agit sur des verts`);
    assert.ok(A.rapport(V).includes('Variante V1') && A.rapport(V).includes('Porte du plan, V3'));
  }
});

test('variantes : sans l\'option, la sortie est celle de G1-b, octet pour octet', () => {
  /* Empreintes du rapport par défaut sur le jeu synthétique, relevées avant l'ajout de l'option (G1-b, d1ea7c5). */
  const OR = { relecture: 'af79acff69a3e55ccf4e2bfd5bb95af0f755759912dd55161f444aeeb2bef5ea', lot: 'd7c25c90238961eba249d0acdc5d7ad3e946ad9f19c0582f217a50e7114d9a81' };
  const sha = t => crypto.createHash('sha256').update(t).digest('hex');
  for (const usage of ['relecture', 'lot']) {
    const V0 = A.validationCroisee(trois(), { usage, lambda: 10 }), V1 = A.validationCroisee(trois(), { usage, lambda: 10, variantes: [] });
    assert.equal(sha(A.rapport(V0)), OR[usage], `rapport par défaut (${usage})`);
    assert.equal(JSON.stringify(V1), JSON.stringify(V0), 'une liste vide de variantes ne change rien');
    assert.equal('variantes' in V0, false); for (const p of V0.parties) assert.equal('variantes' in V0.parPartie[p], false);
    /* Avec une variante : tout ce qui existait est identique, la variante s'ajoute. */
    const Vv = A.validationCroisee(trois(), { usage, lambda: 10, variantes: ['V1', 'V3'] }), R0 = A.rapport(V0);
    const nu = JSON.parse(JSON.stringify(Vv)); delete nu.variantes; delete nu.variantesDef; for (const p of nu.parties) delete nu.parPartie[p].variantes;
    assert.equal(JSON.stringify(nu), JSON.stringify(V0), 'le contenu de base ne bouge pas');
    assert.ok(A.rapport(Vv).startsWith(R0 + '\n\n## Variante V1'), 'le rapport de base reste en tête, octet pour octet');
  }
  /* Ligne de commande : --variante est répétable ou en liste. */
  assert.deepEqual(A.args(['valider', '--usage', 'lot']).variantes, []);
  assert.deepEqual(A.args(['valider', '--variante', 'V1', '--variante', 'V2,V3']).variantes, ['V1', 'V2', 'V3']);
});

/* ------------------------------------------------------------------ H6 « voie décalée » et garde-fou de voie (D-207) */
/* Ajoute au jeu synthétique ce que le jeu H6 porte : pour chaque cut, des hypothèses H6 (une du lot, une humaine, une humaine confondue avec une
 * cellule H2) et, pour les différés, une voie de référence (« tous » et « lot »). Valeurs inventées : la voie de la série est décalée de `decale` mm. */
function jeuH6({ partie = '9:1', graine = 4, cuts = 60, decale = 150, sure = true, sansReference = false } = {}) {
  const l = F.jeuSynthetique({ partie, graine, cuts, humains: false });
  l[0].h6 = { version: 'h6-1', fenetreCuts: 10, k: 5 };
  const out = [];
  for (const x of l) {
    if (x.type === 'cut') {
      const mic = x.etiquette.mic;
      if (x.role === 'differe') {
        /* Voie décalée : la pose finale est loin de la pose de départ, près de la référence. */
        for (const s of SIDES) mic[s] = [0, decale + mic[s][1] / 4, mic[s][2]];
        x.etiquette.micMaxMm = Math.round(Math.max(...SIDES.map(s => Math.hypot(...mic[s]))) * 100) / 100; x.etiquette.grosse = true;
      }
      const ref = { left: [decale, 0], right: [decale, 0], n: 3, distMax: 2, dispersionMm: { left: sure ? 10 : 80, right: 10 }, sure };
      x.contexte.voieH6 = sansReference ? { tous: null, lot: null, departLot: false } : { tous: ref, lot: ref, departLot: false };
    }
    if (x.type === 'hyp') {
      const c = l.find(y => y.type === 'cut' && y.cut === x.cut), m = c.etiquette.mic[x.rail];
      x.etiquette = { ecartMm: Math.round(Math.hypot(x.decal[1] - m[1], x.decal[2] - m[2]) * 100) / 100, classe: '' };
    }
    out.push(x);
    if (x.type === 'rail') {
      const c = l.find(y => y.type === 'cut' && y.cut === x.cut), m = c.etiquette.mic[x.rail], base = l.find(y => y.type === 'hyp' && y.cut === x.cut && y.rail === x.rail && y.origine === 'H0');
      const h6 = (rang, origines, sous, d, h6t) => ({ ...base, rang, origine: origines[0], sous: sous[0], origines, sousOrigines: sous, decal: d,
        traits: { ...base.traits, h6AmpleurMm: Math.hypot(d[1], d[2]), h6DistCuts: 1, h6NVoisins: 3, h6DispersionMm: 10, h6DansReservoir: false, h6Perte: null, h6LignesSommet: null, ...h6t },
        etiquette: { ecartMm: Math.round(Math.hypot(d[1] - m[1], d[2] - m[2]) * 100) / 100, classe: '' } });
      out.push(h6(90, ['H6'], ['h6-lot-proche-rail'], [0, decale + 2, 0]), h6(91, ['H6'], ['h6-humain-proche-rail'], [0, decale - 3, 1]),
        h6(92, ['H2', 'H6'], ['comp', 'h6-humain-mediane-rail'], [0, decale + 40, 0], { h6DistCuts: 4 }), h6(93, ['H6'], ['h6-lot-mediane-paire'], [0, 30, 0]));
    }
  }
  const j = A.jeuDeLignes(out); j.sha256 = 'z'.repeat(63) + partie.slice(-1); return j;
}

test('usage « lot » et H6 : les H6 de voisins humains partent, celles du lot restent ; une cellule confondue garde sa place sans les traits H6', () => {
  const j = jeuH6({ cuts: 30 }), rel = A.construireCas(j, 'relecture'), lot = A.construireCas(j, 'lot');
  const iA = A.NUM.findIndex(t => t.nom === 'h6DistCuts');
  for (const [r, l] of rel.map((k, i) => [k, lot[i]])) for (const s of SIDES) {
    const sousR = r.rails[s].hyps.flatMap(h => h.sousOrigines), sousL = l.rails[s].hyps.flatMap(h => h.sousOrigines);
    assert.ok(sousR.includes('h6-humain-proche-rail') && sousR.includes('h6-lot-proche-rail'));
    assert.equal(sousL.some(x => x.startsWith('h6-humain-')), false, 'aucune H6 humaine au lot');
    assert.ok(sousL.includes('h6-lot-proche-rail') && sousL.includes('h6-lot-mediane-paire'), 'les H6 du lot restent');
    const conf = l.rails[s].hyps.find(h => h.sousOrigines.includes('comp') && Math.abs(h.decal[1] - (150 + 40)) < 1e-9);
    assert.ok(conf, 'la cellule H2 confondue avec une H6 humaine reste');
    assert.deepEqual(conf.origines, ['H2']); assert.ok(Number.isNaN(conf.x.n[iA]), 'ses traits H6 sont retirés');
    assert.equal(r.rails[s].hyps.length - l.rails[s].hyps.length, 1, 'une seule hypothèse retirée par rail (la H6 humaine pure)');
  }
  /* Un jeu sans H6 : le lot fait exactement ce qu'il faisait (H4 seulement). */
  const j0 = jeu({ partie: '9:1', graine: 3, cuts: 40 });
  assert.equal(JSON.stringify(A.construireCas(j0, 'lot')), JSON.stringify(A.construireCas(jeu({ partie: '9:1', graine: 3, cuts: 40 }), 'lot')));
});

test('garde-fou de voie : un différé est gardé par la voie de référence ; sans référence sûre, aucune paire ; les verts et le défaut ne changent pas', () => {
  const j = jeuH6({ cuts: 60 }), sans = A.construireCas(j, 'relecture'), avec = A.construireCas(j, 'relecture', { gardeVoie: true });
  const dif = avec.filter(k => k.role === 'differe');
  assert.ok(dif.length >= 5, `${dif.length} différés`);
  for (const k of avec) {
    const k0 = sans.find(x => x.cut === k.cut);
    if (k.role !== 'differe') { assert.equal(k.garde, undefined); assert.deepEqual(k.paires, k0.paires, 'vert ou rouge : mêmes paires qu\'avant'); continue; }
    assert.equal(k.garde, 'voie');
    assert.ok(k.paires.length > 0, 'des paires permises près de la référence');
    assert.ok(k0.paires.every(q => Math.abs(k.rails.left.hyps[q.i].decal[1]) <= 45), 'sans l\'option : gardé par la pose de départ (H6 à 150 mm écartées)');
    for (const q of k.paires) for (const [s, i] of [['left', q.i], ['right', q.j]]) {
      assert.ok(Math.abs(k.rails[s].hyps[i].decal[1] - k.voieRef[s][0]) <= 45, 'chaque rail à 45 mm au plus de la référence');
      const o = A.issueDePaire(k, q.i, q.j);
      assert.ok(o.latGarde <= 45, 'dans le corridor de série : latéral mesuré depuis la référence');
      assert.ok(o.lat >= 100, 'l\'amplitude depuis H0 reste publiée telle quelle (audit H2)');
    }
    assert.ok(!k.paires.some(q => k.rails.left.hyps[q.i].decal[1] === 30), 'la H6 « paire » à 30 mm (120 mm de la référence) est écartée');
    /* Même avec un score de 1 sur une paire interdite, la décision reste dans la voie. */
    const p = { left: Float64Array.from(k.rails.left.hyps, h => Math.abs(h.decal[1] - 30) < 1e-9 ? 1 : 0.4), right: Float64Array.from(k.rails.right.hyps, h => Math.abs(h.decal[1] - 30) < 1e-9 ? 1 : 0.4) };
    const d = A.decider(k, p, Object.fromEntries(A.ZONES.map(z => [z, { actif: true, tau: 0.1, delta: 1 }])));
    assert.ok(d.etat !== 'agit' || Math.abs(k.rails.left.hyps[d.i].decal[1] - k.voieRef.left[0]) <= 45);
  }
  for (const opt of [{ sure: false }, { sansReference: true }]) {
    const c = A.construireCas(jeuH6({ cuts: 60, ...opt }), 'lot', { gardeVoie: true }).filter(k => k.role === 'differe');
    assert.ok(c.length && c.every(k => k.paires.length === 0), `${JSON.stringify(opt)} : aucune paire permise, on n'agit pas`);
    const p = c.map(k => ({ left: new Float64Array(k.rails.left.hyps.length).fill(1), right: new Float64Array(k.rails.right.hyps.length).fill(1) }));
    assert.ok(c.every((k, i) => A.decider(k, p[i], Object.fromEntries(A.ZONES.map(z => [z, { actif: true, tau: 0.1, delta: 1 }]))).etat === 'laisse'));
  }
  /* L'usage lot lit la référence du lot. */
  const jl = jeuH6({ cuts: 40 }); for (const c of jl.cuts) if (c.cut.contexte.voieH6) c.cut.contexte.voieH6.lot = null;
  assert.ok(A.construireCas(jl, 'lot', { gardeVoie: true }).filter(k => k.role === 'differe').every(k => k.paires.length === 0), 'lot : sans référence du lot, rien');
  assert.ok(A.construireCas(jl, 'relecture', { gardeVoie: true }).filter(k => k.role === 'differe').some(k => k.paires.length > 0), 'relecture : la référence « tous »');
});

test('variantes H6 : V1 inchangée, V1+ = V1 et les différés sous le garde-fou de voie ; jamais un rouge ; jamais un différé sans le garde-fou', () => {
  const d = A.lireVariantes(A.FICHIER_VARIANTES_H6), d0 = A.lireVariantes();
  assert.deepEqual(d.V1, d0.V1, 'V1 est celle de D-204');
  assert.equal(d['V1+'].gardeVoie, true);
  assert.deepEqual(d['V1+'].gcv2, [{ zones: ['pn', 'adv'], roles: ['vert'] }, { zones: ['pn', 'adv', 'abords', 'liste', 'hors'], roles: ['differe'] }]);
  assert.deepEqual(d['V1+'].prudente, d0.V1.prudente);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcv2-h6-')), ecrire = v => { const f = path.join(dir, 'v.json'); fs.writeFileSync(f, JSON.stringify({ format: A.FORMAT_VARIANTES, variantes: { X: v } })); return f; };
  assert.throws(() => A.lireVariantes(ecrire({ gcv2: { zones: ['pn'], roles: ['differe'] }, prudente: { zones: [], roles: [] } })), /ni rouge ni différé/, 'différé sans garde-fou de voie');
  assert.throws(() => A.lireVariantes(ecrire({ gardeVoie: true, gcv2: [{ zones: ['pn'], roles: ['rouge'] }], prudente: { zones: [], roles: [] } })), /jamais un rouge/);
  assert.throws(() => A.lireVariantes(ecrire({ gardeVoie: true, gcv2: { zones: ['pn'], roles: ['vert'] }, prudente: { zones: ['abords'], roles: ['differe'] } })), /ni rouge ni différé/, 'la règle prudente reste aux verts');
  fs.rmSync(dir, { recursive: true });
  const parties = [1, 2, 3].map(n => jeuH6({ partie: `9:${n}`, graine: n, cuts: 50 }));
  assert.throws(() => A.validationCroisee(parties, { usage: 'relecture', lambda: 10, variantes: ['V1+'], defsVariantes: d }), /--garde-voie/);
  for (const usage of ['relecture', 'lot']) {
    const V = A.validationCroisee(parties, { usage, lambda: 10, variantes: ['V1', 'V1+'], defsVariantes: d, gardeVoie: true });
    assert.equal(V.gardeVoie, true); assert.ok(V.detailsDifferes.length > 0);
    assert.equal(V.variantes['V1+'].parRole.rouge.agit, 0, 'jamais un rouge'); assert.equal(V.variantes.V1.parRole.differe.agit, 0, 'V1 : jamais un différé');
    for (const z of ['pn', 'adv', 'abords', 'liste', 'hors']) assert.deepEqual(V.variantes['V1+'].parZone[z].agit >= V.variantes.V1.parZone[z].agit, true);
    assert.deepEqual(V.variantes['V1+'].parRole.vert, V.variantes.V1.parRole.vert, 'sur les verts, V1+ est V1');
    assert.ok(V.detailsDifferes.filter(x => x.etat === 'agit').every(x => x.sure && x.lat <= 45), 'un différé n\'agit qu\'avec une référence sûre, dans la voie');
    assert.equal(V.variantes['V1+'].parRole.differe.mauvaiseVoie, V.detailsDifferes.filter(x => x.etat === 'agit' && (x.e > 50 || x.lat > 45)).length);
    assert.ok(A.rapport(V).includes('Garde-fou de voie sur les différés'));
  }
  /* Sans l'option, rien de nouveau dans la sortie. */
  const V0 = A.validationCroisee(parties, { usage: 'lot', lambda: 10 });
  assert.equal('gardeVoie' in V0, false); assert.equal('detailsDifferes' in V0, false);
});

test('export H6 : les traits H6 n\'entrent dans la liste blanche que pour un jeu H6 ; le garde-fou de voie est consigné s\'il sert', () => {
  const vieux = A.exporter(trois(), { usages: ['relecture'], lambda: 10, date: '2026-10-19' });
  assert.equal(vieux.listeBlanche.some(t => A.TRAIT_H6(t.nom)), false, 'jeux de G1-a : liste blanche de G1-b, octet pour octet');
  assert.equal('h6' in vieux, false); assert.equal('voie' in vieux.garde, false);
  const neuf = A.exporter([1, 2, 3].map(n => jeuH6({ partie: `9:${n}`, graine: n, cuts: 40 })), { usages: ['relecture'], lambda: 10, date: '2026-10-19', gardeVoie: true });
  assert.ok(neuf.listeBlanche.filter(t => A.TRAIT_H6(t.nom)).length === 7 && neuf.h6.version === 'h6-1' && neuf.garde.voie.lateralMaxMm === 45);
  assert.ok(neuf.listeBlanche.every(t => !A.estInterdit(t.nom)));
});

test('jeu « lot » généré sans appui humain (audit F3) : lu tel quel, et seulement pour l\'usage lot ; un jeu de relecture est refusé au lot', () => {
  const rel = jeuH6({ cuts: 30 }); rel.entete.usage = 'relecture';
  const lot = jeuH6({ cuts: 30 }); lot.entete.usage = 'lot';
  assert.throws(() => A.construireCas(rel, 'lot'), /généré sans appui humain/);
  assert.throws(() => A.construireCas(lot, 'relecture'), /jeu « lot »/);
  /* Le jeu lot n'est pas filtré : ses hypothèses sont celles du fichier (ici, la fixture en contient d'humaines exprès : elles restent). */
  const k = A.construireCas(lot, 'lot');
  assert.ok(k.some(c => SIDES.some(s => c.rails[s].hyps.some(h => h.sousOrigines.includes('h6-humain-proche-rail')))), 'aucun retrait après coup');
  assert.equal(A.construireCas(rel, 'relecture').length, k.length);
});

test('mesures de voie séparées (audit H2) : erreur finale > 50 mm, amplitude depuis H0, corridor ; la porte garde l\'erreur finale', () => {
  const b = A.bilanDe([
    { mic: 150, etat: 'agit', e: 4, lat: 150, latGarde: 6 },      // correction H6 juste : amplitude 150 mm depuis H0, dans le corridor de série
    { mic: 150, etat: 'agit', e: 80, lat: 150, latGarde: 20 },    // dans le corridor, mais à 80 mm de Mic : erreur finale
    { mic: 3, etat: 'agit', e: 4, lat: 30 },                      // vert ordinaire
  ]);
  assert.deepEqual([b.agit, b.erreur50, b.amplitude45, b.horsCorridor, b.mauvaiseVoie], [3, 1, 2, 0, 2], 'mauvaise voie garde sa définition de G1-b');
  const P = A.porte({ total: { gcv2: { total: b, perimetrePrudent: b }, prudente: { total: A.bilanDe([]), perimetrePrudent: A.bilanDe([]) } } });
  assert.equal(P.tout.mauvaiseVoie, false, 'une erreur finale > 50 mm ferme la porte');
  const ok = A.bilanDe([{ mic: 150, etat: 'agit', e: 4, lat: 150, latGarde: 6 }]);
  assert.equal(A.porte({ total: { gcv2: { total: ok, perimetrePrudent: ok }, prudente: { total: A.bilanDe([]), perimetrePrudent: A.bilanDe([]) } } }).tout.mauvaiseVoie, true,
    'une amplitude de 150 mm dans le corridor ne ferme pas la porte ; elle est publiée à part (amplitude45 = 1, mauvaise voie G1-b = 1)');
  assert.equal(ok.mauvaiseVoie, 1);
  const hors = A.bilanDe([{ mic: 150, etat: 'agit', e: 4, lat: 150, latGarde: 60 }]);
  assert.equal(A.porte({ total: { gcv2: { total: hors, perimetrePrudent: hors }, prudente: { total: A.bilanDe([]), perimetrePrudent: A.bilanDe([]) } } }).tout.mauvaiseVoie, false, 'hors du corridor : porte fermée');
  /* Le rapport sous le garde-fou de voie publie la table. */
  const parties = [1, 2, 3].map(n => jeuH6({ partie: `9:${n}`, graine: n, cuts: 40 }));
  const V = A.validationCroisee(parties, { usage: 'relecture', lambda: 10, gardeVoie: true });
  assert.ok(A.rapport(V).includes('Mesures de voie, séparées'));
  assert.equal(A.rapport(A.validationCroisee(parties, { usage: 'relecture', lambda: 10 })).includes('Mesures de voie'), false);
});
