'use strict';
/* Garde de non-régression GCV2 (tools/garde-gcv2.cjs, juge tools/juger.cjs ; architecture 5.0 § a.3, T21a). Données FABRIQUÉES : un lot synthétique
 * de dix cuts, des vérités inventées, aucune valeur de terrain. Contrat : 0 vert ; 1 recul de qualité (colonne « sans passe », critères de qualité
 * « avec passe », étape « GCV2 dans le lot » à part) ; 2 recul de vitesse banc seul ; 3 garde non rendue (base non scellée, sans commit, lot manquant). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const G = require('../tools/garde-gcv2.cjs'), J = require('../tools/juger.cjs');

const d = (lat, vert = 0) => ({ left: [0, lat, vert], right: [0, lat, vert] });
const VERITE = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(c => [String(c), { mic: d(10 * c), src: 'echo' }]));
/* Lot de base : 1-4 posés par la chaîne ; 5, 6, 7 repris par la GCV2 dans le lot (3, 8, 15 mm) ; 8 posé par la passe (4 mm) ; 9 laissé sans pose ; 10 sans nuage. */
function lignes({ ms = { analyse: 100, decision: 20 }, modif = {} } = {}) {
  const L = [];
  for (let c = 1; c <= 10; c++) {
    let base, l1;
    if (c <= 4) { base = { etat: 'pose', source: 'lot', decal: d(10 * c) }; l1 = { ...base }; }
    else if (c <= 7) { base = { etat: 'differe', source: 'lot' }; l1 = { etat: 'pose', source: 'gcv2', decal: d(10 * c + [3, 8, 15][c - 5]) }; }
    else if (c === 8) { base = { etat: 'differe', source: 'lot' }; l1 = { etat: 'pose', source: 'gcv2', passe2: { passe: 1 }, decal: d(10 * c + 4) }; }
    else { base = { etat: 'differe', source: 'lot' }; l1 = { etat: 'differe', source: 'gcv2' }; }
    if (modif[c]) l1 = { ...l1, ...modif[c] };
    L.push({ type: 'cut', partie: '9:91', cut: c, reel: { pose: c <= 4 }, nuage: c !== 10, points: c === 10 ? 0 : 5000, profils: { base, 'L1-se': l1 }, ms: { ...ms } });
  }
  return L;
}
const entete = (extra = {}) => ({ type: 'entete', format: 'ariane-banc-differes-rejeu-v1', partie: '9:91', lot: 'lotsynth', version_lot: '9.9.9', traites: 10,
  l1e: { leviers: { deuxiemePasse: 2 } }, parametres: { version: 'p', sha256: 'x' }, chrono: { passeMs: 5 }, ...extra });
const jsonl = (L, e = entete()) => [e, ...L].map(x => JSON.stringify(x)).join('\n') + '\n';

function atelier({ verite = VERITE, base = lignes() } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garde-gcv2-essai-')), rb = path.join(dir, 'rejeux-base'), dv = path.join(dir, 'verites-src'), db = path.join(dir, 'base');
  for (const x of [rb, dv, db]) fs.mkdirSync(x);
  fs.writeFileSync(path.join(rb, 'r-synth.jsonl'), jsonl(base));
  fs.writeFileSync(path.join(dv, 'verite-synth.json'), JSON.stringify(verite));
  const manifeste = path.join(dir, 'manifeste.json');
  fs.writeFileSync(manifeste, JSON.stringify({ leviers: { deuxiemePasse: 2 }, lots: [{ nom: 'synth', partie: '9:91', lot: 'lotsynth', groupe: 'synthetique', verite: 'verite-synth.json' }] }));
  const fb = path.join(db, 'base.json'), fvit = path.join(dir, 'vitesse', 'base-vitesse.json');
  G.sceller({ manifeste, rejeux: rb, verites: dv, commit: 'abcdef1', version: '9.9.9', sortie: fb, vitesseSortie: fvit });
  const courant = (L, e) => { const r = path.join(dir, 'rejeux-' + Math.random().toString(36).slice(2)); fs.mkdirSync(r); fs.writeFileSync(path.join(r, 'r-synth.jsonl'), jsonl(L, e)); return r; };
  const garde = (rejeux, ...plus) => { let sortie = ''; const code = G.main(['--base', fb, '--rejeux', rejeux, '--code', 'abcdef1', ...plus], { ecrire: s => { sortie += s; } }); return { code, sortie }; };
  return { dir, fb, fvit, courant, garde, fin: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('juge : colonne « sans passe » (la pose de la passe redevient un différé), étapes, médiane du juge d’origine, Wilson', () => {
  const j = J.juger(lignes(), J.lireVerite(VERITE));
  assert.equal(j.colonnes.avecPasse.juges, 4); assert.equal(j.colonnes.sansPasse.juges, 3);
  assert.equal(j.colonnes.avecPasse.sansPose, 1); assert.equal(j.colonnes.sansPasse.sansPose, 2);
  assert.equal(j.colonnes.avecPasse.sansNuage, 1);
  assert.equal(j.etapes['gcv2-lot'].juges, 3); assert.equal(j.etapes.passe.juges, 1);
  assert.equal(j.colonnes.avecPasse.mediane, 8, 'rang ⌊n/2⌋ de [3, 4, 8, 15]');
  assert.equal(j.colonnes.avecPasse.a10, 3); assert.equal(j.colonnes.avecPasse.a20, 1);
  assert.equal(J.wilson(0, 60), 6, 'zéro erreur sur 60 : borne haute d’environ 6 %');
  assert.equal(J.etapeDe({ source: 'l1s-chaine' }), 'gcv2-lot'); assert.equal(J.etapeDe({ source: 'gcv2', passe2: { passe: 2 } }), 'passe');
});

test('rejeu identique à la base : retour 0, listes par cut vides', () => {
  const A = atelier();
  try {
    const r = A.garde(A.courant(lignes()));
    assert.equal(r.code, 0, r.sortie);
    const rap = G.comparer(JSON.parse(fs.readFileSync(A.fb, 'utf8')), [G.jugerLot({ nom: 'synth', lot: 'lotsynth' }, jsonl(lignes()), J.lireVerite(VERITE))]);
    assert.deepEqual(rap.reculs, []); assert.equal(rap.groupes.synthetique.colonnes.sansPasse.listes.perdus.length, 0);
  } finally { A.fin(); }
});

test('un cut perdu (sans passe) : retour 1, le cut est nommé', () => {
  const A = atelier();
  try {
    const r = A.garde(A.courant(lignes({ modif: { 6: { etat: 'differe', decal: undefined } } })));
    assert.equal(r.code, 1, r.sortie);
    assert.match(r.sortie, /sansPasse : cuts laissés sans pose 2 → 3/);
    assert.match(r.sortie, /encore à ≤ 10 mm : 1 sur 2/);
  } finally { A.fin(); }
});

test('une pose « avec passe » à plus de 20 mm : retour 1 même si la colonne « sans passe » est intacte', () => {
  const A = atelier();
  try {
    const r = A.garde(A.courant(lignes({ modif: { 8: { decal: d(80 + 30) } } })));
    assert.equal(r.code, 1, r.sortie);
    assert.match(r.sortie, /avecPasse : 1 cut\(s\) nouvellement à plus de 20 mm/);
    assert.doesNotMatch(r.sortie, /sansPasse : 1 cut\(s\) nouvellement/);
  } finally { A.fin(); }
});

test('étape « GCV2 dans le lot » jugée à part : une pose de l’étape à plus de 50 mm bloque (D-250)', () => {
  const A = atelier();
  try {
    const r = A.garde(A.courant(lignes({ modif: { 7: { decal: d(70 + 60) } } })));
    assert.equal(r.code, 1, r.sortie);
    assert.match(r.sortie, /GCV2 dans le lot : 1 cut\(s\) nouvellement à plus de 50 mm/);
    assert.match(r.sortie, /GCV2 dans le lot : budget D-223 \(pose > 50 mm ≤ 3 %\) tenu en base, dépassé/);
  } finally { A.fin(); }
});

test('budget D-223 déjà dépassé en base : signalé en tête, pas rouge sur le code de la base ; toute hausse bloque', () => {
  const A = atelier({ base: lignes({ modif: { 7: { decal: d(70 + 60) } } }) });
  try {
    const r0 = A.garde(A.courant(lignes({ modif: { 7: { decal: d(70 + 60) } } })));
    assert.equal(r0.code, 0, r0.sortie);
    assert.match(r0.sortie, /signalé : synthetique, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE/);
    const r1 = A.garde(A.courant(lignes({ modif: { 7: { decal: d(70 + 60) }, 6: { decal: d(60 + 55) } } })));
    assert.equal(r1.code, 1, r1.sortie);
    assert.match(r1.sortie, /taux en hausse/);
  } finally { A.fin(); }
});

test('un lot plus lent de 20 % : retour 2 avec --vitesse ; sans --vitesse, vitesse non contrôlée (retour 0)', () => {
  const A = atelier();
  try {
    const lent = A.courant(lignes({ ms: { analyse: 120, decision: 24 } }));
    const r = A.garde(lent, '--vitesse', A.fvit);
    assert.equal(r.code, 2, r.sortie);
    assert.match(r.sortie, /temps banc par cut 120 → 144 ms/);
    assert.equal(A.garde(lent).code, 0);
    assert.equal(A.garde(A.courant(lignes({ ms: { analyse: 105, decision: 21 } })), '--vitesse', A.fvit).code, 0, '5 % : sous le seuil de 10 %');
  } finally { A.fin(); }
});

test('garde non rendue (retour 3) : base sans commit, base modifiée après scellement, rejeu d’un lot absent', () => {
  const A = atelier();
  try {
    const base = JSON.parse(fs.readFileSync(A.fb, 'utf8'));
    const sansCommit = { ...base }; delete sansCommit.commit;
    fs.writeFileSync(A.fb, JSON.stringify(sansCommit)); G.ecrireSommes(path.dirname(A.fb), ['base.json', 'verites/verite-synth.json']);
    assert.throws(() => G.lireBaseScellee(A.fb), /sans commit/);
    fs.writeFileSync(A.fb, JSON.stringify(base)); G.ecrireSommes(path.dirname(A.fb), ['base.json', 'verites/verite-synth.json']);
    fs.appendFileSync(A.fb, ' ');
    assert.throws(() => G.lireBaseScellee(A.fb), /non scellée/);
    fs.writeFileSync(A.fb, JSON.stringify(base)); G.ecrireSommes(path.dirname(A.fb), ['base.json', 'verites/verite-synth.json']);
    const vide = path.join(A.dir, 'vide'); fs.mkdirSync(vide);
    assert.throws(() => A.garde(vide), e => e instanceof G.GardeNonRendue && /lot manquant/.test(e.message));
    assert.equal(G.RETOUR.NON_RENDUE, 3);
  } finally { A.fin(); }
});

test('rapport markdown : colonnes sans passe / avec passe, étape GCV2 dans le lot, vitesse', () => {
  const A = atelier();
  try {
    const sortie = path.join(A.dir, 'sortie');
    G.main(['--base', A.fb, '--rejeux', A.courant(lignes()), '--vitesse', A.fvit, '--sortie', sortie, '--code', 'abcdef1'], { ecrire: () => {} });
    const md = fs.readFileSync(path.join(sortie, 'garde.md'), 'utf8');
    for (const m of ['sans passe, base', 'avec passe, actuel', 'GCV2 dans le lot, base', 'Budget D-223', 'Vitesse (critère 6-i)', 'Retour 0']) assert.ok(md.includes(m), m);
    const js = JSON.parse(fs.readFileSync(path.join(sortie, 'garde.json'), 'utf8'));
    assert.equal(js.retour, 0); assert.equal(js.vitesse.controlee, true);
  } finally { A.fin(); }
});

test('vérité depuis l’Écho : rouge à départ concordant gardé, départ différent écarté, pose réelle + correction, visite sans action selon la règle', () => {
  const L = [{ cut: 1, reel: { pose: false }, ecartDepartMm: 1435 }, { cut: 2, reel: { pose: false }, ecartDepartMm: 1435 },
    { cut: 3, reel: { pose: true, decal: d(5) }, ecartDepartMm: 1440 }, { cut: 4, reel: { pose: true, decal: d(7) }, ecartDepartMm: 1440 }];
  const mic = new Map([[1, { ref: 'validation', rails: d(12), ecartDepartMm: 1436 }], [2, { ref: 'validation', rails: d(12), ecartDepartMm: 1450 }],
    [3, { ref: 'validation', rails: d(2), ecartDepartMm: 1440 }], [4, { ref: 'visite-bon', rails: d(0), ecartDepartMm: 1440 }]]);
  const sans = G.veriteDepuisEcho(L, mic), avec = G.veriteDepuisEcho(L, mic, { avecRegle: true });
  assert.deepEqual(Object.keys(sans.verite), ['1', '3']);
  assert.deepEqual(sans.verite['3'].mic.left, [0, 7, 0]);
  assert.equal(sans.stat.exclus['depart-different'], 1);
  assert.deepEqual(Object.keys(avec.verite), ['1', '3', '4']); assert.equal(avec.verite['4'].src, 'echo-pose-reelle-visite-bon');
});

/* D-252 (accord de l'opérateur du 26/10, fiches/GARDE_PASSE_A.md) : PERTES ACCEPTÉES, nommées dans le manifeste, pour la SEULE colonne « avec passe ».
 * Une perte listée (cut à ≤ 10 mm en base, sans pose aujourd'hui) n'est plus un recul mais est écrite en tête du rapport à chaque passage ; une perte hors liste
 * reste bloquante ; une entrée qui n'est plus perdue est signalée ; les colonnes « sans passe » et « GCV2 dans le lot » restent strictes. */
const perte = (cut, extra = {}) => ({ colonne: 'avecPasse', lot: 'synth', cut, decisionGarde: 'garde-appuis', motif: 'D-252, essai', commit: 'abcdef1', ...extra });
function manifesteAvec(A, pertes) { const f = path.join(A.dir, 'manifeste-pertes.json'); fs.writeFileSync(f, JSON.stringify({ lots: [], pertesAcceptees: pertes })); return f; }
const sansPasse8 = () => lignes({ modif: { 8: { etat: 'differe', decal: undefined, passe2: undefined } } });

test('D-252 : une perte listée de la colonne « avec passe » rend 0 et est écrite en tête du rapport ; sans la liste, 1', () => {
  const A = atelier();
  try {
    const rej = A.courant(sansPasse8());
    const r0 = A.garde(rej);
    assert.equal(r0.code, 1, r0.sortie); assert.match(r0.sortie, /avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 2 sur 3/);
    const sortie = path.join(A.dir, 'sortie-pertes');
    const r1 = A.garde(rej, '--manifeste', manifesteAvec(A, [perte(8)]), '--sortie', sortie);
    assert.equal(r1.code, 0, r1.sortie);
    assert.match(r1.sortie, /perte acceptée : synthetique, avec passe : synth 8 \(4 mm en base\) ; D-252, essai/);
    const md = fs.readFileSync(path.join(sortie, 'garde.md'), 'utf8');
    assert.ok(md.indexOf('Pertes acceptées') > 0 && md.indexOf('Pertes acceptées') < md.indexOf('## synthetique'), 'en tête du rapport');
    assert.match(md, /synth 8 \(4 mm en base\) ; D-252, essai ; garde-appuis ; commit abcdef1/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(sortie, 'garde.json'), 'utf8')).pertesAcceptees.map(p => p.cut), [8]);
  } finally { A.fin(); }
});

test('D-252 : une perte hors liste reste bloquante (retour 1) ; l’entrée qui n’est pas perdue est signalée sans objet', () => {
  const A = atelier();
  try {
    const r = A.garde(A.courant(sansPasse8()), '--manifeste', manifesteAvec(A, [perte(5)]));
    assert.equal(r.code, 1, r.sortie);
    assert.match(r.sortie, /recul : synthetique, avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 2 sur 3 ; hors de la liste des pertes acceptées : synth 8/);
    assert.match(r.sortie, /signalé : perte acceptée sans objet : synth 5 \(colonne avec passe\)/);
  } finally { A.fin(); }
});

test('D-252 : une entrée de la liste devenue sans objet (le cut est de nouveau posé à ≤ 10 mm) est signalée, retour 0', () => {
  const A = atelier();
  try {
    const r = A.garde(A.courant(lignes()), '--manifeste', manifesteAvec(A, [perte(8)]));
    assert.equal(r.code, 0, r.sortie);
    assert.match(r.sortie, /signalé : perte acceptée sans objet : synth 8 \(colonne avec passe\)/);
    assert.doesNotMatch(r.sortie, /perte acceptée : synthetique/);
  } finally { A.fin(); }
});

test('D-252 : la colonne « sans passe » reste stricte : un cut perdu, même listé (avec passe ou sans passe), rend 1', () => {
  const A = atelier();
  try {
    const rej = A.courant(lignes({ modif: { 6: { etat: 'differe', decal: undefined } } }));
    const r = A.garde(rej, '--manifeste', manifesteAvec(A, [perte(6), perte(6, { colonne: 'sansPasse' })]));
    assert.equal(r.code, 1, r.sortie);
    assert.match(r.sortie, /recul : synthetique, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 1 sur 2/);
    assert.doesNotMatch(r.sortie, /recul : synthetique, avecPasse : cuts à ≤ 10 mm/, 'la perte listée ne bloque plus la colonne « avec passe »');
    assert.match(r.sortie, /signalé : perte acceptée ignorée : synth 6 \(colonne sansPasse\) : seule la colonne « avec passe » accepte des pertes/);
  } finally { A.fin(); }
});

test('D-252 : entrée mal formée : garde non rendue ; le manifeste versé liste 9521 et 9522 (lot 2-17), colonne « avec passe », motif D-252', () => {
  const A = atelier();
  try {
    assert.throws(() => A.garde(A.courant(lignes()), '--manifeste', manifesteAvec(A, [{ lot: 'synth', cut: '8' }])), e => e instanceof G.GardeNonRendue && /pertesAcceptees/.test(e.message));
  } finally { A.fin(); }
  const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datasets', 'garde-gcv2', 'manifeste.json'), 'utf8'));
  assert.deepEqual(M.pertesAcceptees.map(p => [p.colonne, p.lot, p.cut, p.decisionGarde]), [['avecPasse', '2-17', 9521, 'garde-appuis'], ['avecPasse', '2-17', 9522, 'garde-appuis']]);
  for (const p of M.pertesAcceptees) { assert.match(p.motif, /^D-252, accord de l'opérateur du 26\/10 : garde A, bonnes poses perdues à 7 et 8 cuts d'appui$/); assert.match(p.commit, /^[0-9a-f]{40}$/); }
});
