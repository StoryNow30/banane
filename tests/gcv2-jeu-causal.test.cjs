'use strict';
/* JEU CAUSAL de la GCV2 (tools/gcv2-jeu.cjs `construire`, mode causal ; fiches/JEU_CAUSAL.md ; audit externe F1 à F5, D-211, D-212). Données SYNTHÉTIQUES
 * (tests/helpers/jeu-causal-echo.cjs : partie inventée, coordonnées fabriquées). L'essai central passe par la VRAIE chaîne : Écho écrit sur disque, lecture,
 * extraction (`relecture-autonome extraire`), observateur, table, zones de l'instant, jeu de relecture, jeu « lot » et cas :
 *   « changer tout ce qui est postérieur à la décision du cut 5 ne change aucune ligne du jeu pour les cuts 1 à 5, étiquettes mises à part ».
 * Contre-épreuves : ce qui est antérieur (une pose de départ, une validation d'avant) change bien la sortie ; l'essai n'est pas vide. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const H = require('./helpers/jeu-causal-echo.cjs');
const G = require('../tools/gcv2-jeu.cjs');
const RA = require('../tools/relecture-autonome.cjs');
const LM = require('../src/liste-memoire.js');

const D = 5;                                   // cut dont on juge la décision
const json = x => JSON.stringify(x);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'jeu-causal-'));
/* Scénario : 8 cuts visités dans l'ordre (cut c à 10:00 + c min, 20 s) ; les cuts impairs validés après un déplacement de 12 mm, les pairs visités sans
 * action ; le lot a posé le cut 6 (20 mm) et différé le cut 7. `modif(v)` change une visite ; `extra` : visites ajoutées ; `lot` : options du journal. */
function scenario({ modif = () => {}, extra = [], lot = { poses: { 6: { lat: 20 } }, differes: [7] } } = {}) {
  const vs = [];
  for (let c = 1; c <= 8; c++) {
    const v = { cut: c, index: c, debut: 60 * c, ref: c % 2 ? { lat: 12 } : null, depart: lot.poses[c] ? { dl: lot.poses[c].lat / 1000, dr: lot.poses[c].lat / 1000 } : {} };
    modif(v); vs.push(v);
  }
  const d = tmp();
  H.ecrireEcho(d, [...vs, ...extra]);
  const j = H.ecrireJournal(path.join(d, 'journal.json'), lot);
  const r = G.construire({ projet: 9, partie: 91, echo: [d], journaux: [j] });
  fs.rmSync(d, { recursive: true, force: true });
  return r;
}
/* Ce que la décision du cut voit : lignes du jeu des cuts ≤ D, champs d'étiquette et de comportement de l'opérateur retirés ; et les champs du cas. */
const vue = (lignes, max = D) => lignes.filter(l => l.type === 'entete' || l.cut <= max).map(l => {
  const { etiquette, micRailMm, reference, visites, ...reste } = l; return reste; });
const vueCas = (cas, max = D) => cas.filter(c => c.cut <= max).map(c => ({ cut: c.cut, ariane: c.ariane, gMed: c.gMedCausalMm, zone: c.zoneCausale, genre: c.genreLot }));

let BASE = null;
const base = () => BASE || (BASE = scenario());

test('jeu causal : l\'extraction réelle tourne, médiane et zone de l\'instant dans le cas, la même médiane dans le jeu', () => {
  const r = base();
  assert.equal(r.etat.erreurs, 0); assert.equal(r.etat.calcules, 8);
  assert.ok(r.lignes[0].causal && r.lignes[0].causal.seuilVisiteS === 0.6, 'entête : jeu causal, visite sans action à 0,6 s');
  assert.equal(r.lignes[0].gMedMm, null, 'plus de médiane de partie dans l\'entête');
  const cuts = r.lignes.filter(l => l.type === 'cut');
  for (const c of r.cas) {
    const l = cuts.find(x => x.cut === c.cut);
    assert.equal(l.contexte.gMedMm, c.gMedCausalMm, `cut ${c.cut} : la même médiane pour la GCV2 (jeu) et la règle prudente (cas)`);
    assert.equal(l.zone, c.zoneCausale);
  }
  assert.ok(r.cas.every(c => typeof c.gMedCausalMm === 'number'));
  assert.equal(r.cas.find(c => c.cut === 6).genreLot, 'pose'); assert.equal(r.cas.find(c => c.cut === 7).genreLot, 'differe');
});

test('INVARIANCE TEMPORELLE (de bout en bout) : tout ce qui est postérieur à la décision du cut 5 ne change rien pour les cuts 1 à 5, dans les deux jeux et le cas', () => {
  const a = base();
  const b = scenario({
    modif: v => {
      if (v.cut >= D) v.ref = v.cut % 2 ? { lat: -31 } : { lat: 17 };                      // poses finales de l'opérateur, à partir du cut 5 : toutes changées
      if (v.cut > D) v.nuage = { decale: 0.05, graine: 3 };                                  // captures des cuts suivants : autre nuage
      if (v.cut === D) v.deplace = { decale: 0.04 };                                         // capture prise APRÈS le geste du cut 5, autour de la pose déplacée
    },
    extra: [
      { cut: 2, index: 20, debut: 60 * D + 30, depart: {}, ref: { lat: 25 } },              // une validation du cut 2 POSTÉRIEURE au début de la visite du cut 5
      { cut: 3, index: 21, debut: 60 * 9, depart: { dl: 0.012, dr: 0.012 }, ref: { lat: -40 }, deplace: { decale: 0.02 } },   // revisite tardive du cut 3
    ],
  });
  assert.equal(b.etat.erreurs, 0);
  assert.equal(json(vue(b.lignes)), json(vue(a.lignes)), 'jeu de relecture : identique pour les cuts 1 à 5');
  assert.equal(json(vue(b.lignesLot)), json(vue(a.lignesLot)), 'jeu lot : identique pour les cuts 1 à 5');
  assert.equal(json(vueCas(b.cas)), json(vueCas(a.cas)), 'cas : moteur, chaîne, surface, médiane et zone identiques pour les cuts 1 à 5');
  /* L'essai n'est pas vide : les cuts d'après, eux, changent. */
  assert.notEqual(json(b.lignes.filter(l => l.cut === 7)), json(a.lignes.filter(l => l.cut === 7)));
  assert.notEqual(json(b.lignes.filter(l => l.cut === D && l.type === 'hyp').map(l => l.etiquette)), json(a.lignes.filter(l => l.cut === D && l.type === 'hyp').map(l => l.etiquette)), 'seule l\'étiquette du cut 5 change');
});

test('INVARIANCE (usage lot) : les poses du lot des cuts suivants ne changent pas le jeu « lot » des cuts 1 à 5 ; elles peuvent changer la relecture (lot terminé)', () => {
  const a = base(), b = scenario({ lot: { poses: { 6: { lat: -35 } }, differes: [7] } });
  assert.equal(json(vue(b.lignesLot)), json(vue(a.lignesLot)), 'jeu lot : au premier passage du lot, la pose du cut 6 n\'existe pas encore pour le cut 5');
  assert.notEqual(json(vue(b.lignes)), json(vue(a.lignes)), 'relecture : le lot est fini, sa pose du cut 6 est un appui connu');
});

test('CONTRE-ÉPREUVES : une pose de départ antérieure change la médiane du cut 5 ; une validation antérieure change la relecture, jamais le jeu lot', () => {
  const a = base();
  const b = scenario({ modif: v => { if ([1, 3, 4].includes(v.cut)) v.depart = { dl: 0, dr: 0.004 }; } });
  assert.notEqual(b.cas.find(c => c.cut === D).gMedCausalMm, a.cas.find(c => c.cut === D).gMedCausalMm, 'la médiane causale lit les cuts déjà connus');
  assert.equal(b.cas.find(c => c.cut === 7).gMedCausalMm !== a.cas.find(c => c.cut === 7).gMedCausalMm, true);
  const e = scenario({ modif: v => { if ([6, 7, 8].includes(v.cut)) v.depart = { dl: 0, dr: 0.009 }; } });
  for (let c = 1; c <= D; c++) assert.equal(e.cas.find(x => x.cut === c).gMedCausalMm, a.cas.find(x => x.cut === c).gMedCausalMm, `cut ${c} : les poses de départ des cuts suivants n'entrent pas`);
  assert.notEqual(json(vue(b.lignes)), json(vue(a.lignes)));
  const c = scenario({ modif: v => { if (v.cut === 1) v.ref = { lat: 33 }; } });
  assert.notEqual(json(vue(c.lignes)), json(vue(a.lignes)), 'relecture : une validation finie avant la visite du cut 5 est un appui');
  assert.equal(json(vue(c.lignesLot)), json(vue(a.lignesLot)), 'lot : aucun appui humain, octet pour octet');
});

test('appuis humains datés (audit F2) : une revalidation postérieure ne remplace pas la version disponible avant ; une écriture tardive borne la date', () => {
  const H6 = require('./helpers/jeu-causal-echo.cjs');
  const rec = (v) => H6.visite(v).record;
  const c = { partie: 91, cut: 2, visites: [rec({ cut: 2, index: 1, debut: 60, ref: { lat: 10 } }), rec({ cut: 2, index: 2, debut: 400, depart: { dl: 0.01, dr: 0.01 }, ref: { lat: 30 } })] };
  const ver = G.posesVerifiees([c], { ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine, versions: true });
  assert.equal(ver.filter(p => p.source === 'humain').length, 2, 'deux versions datées');
  const t0 = Date.parse(H.t(300));
  const v = G.voisinsSursA(ver, 91, 5, t0), dy = (v[0].positions.left[1] - H.railsDe(2).left.positionSceneRelative[1]) * 1000;
  assert.ok(Math.abs(dy - 10) < 1e-6, 'à 10:05, la première validation (10 mm) est la seule connue');
  assert.equal(G.voisinsSursA(G.posesVerifiees([c], { ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine }), 91, 5, t0).length, 0, 'sans versions (H6), la dernière validation, postérieure, efface l\'appui');
  /* écriture serveur tardive : la version n'est disponible qu'après elle */
  const c2 = { partie: 91, cut: 2, visites: [rec({ cut: 2, index: 1, debut: 60, ref: { lat: 10 }, ecritureA: 310 })] };
  const ver2 = G.posesVerifiees([c2], { ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine, versions: true });
  assert.equal(G.voisinsSursA(ver2, 91, 5, t0).length, 0, 'écrite à 10:05:10, la pose n\'est pas un appui à 10:05');
  assert.equal(G.voisinsSursA(ver2, 91, 5, Date.parse(H.t(311))).length, 1);
});

test('usage lot : seules les poses du lot des cuts qui précèdent ; pose de départ déplacée par une main humaine : jamais une pose du lot', () => {
  const H6 = require('./helpers/jeu-causal-echo.cjs');
  const parCut = [3, 4, 6].map(cut => ({ partie: 91, cut, visites: [H6.visite({ cut, index: cut, debut: 60 * cut }).record] }));
  const ver = G.posesVerifiees(parCut, { ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine, lotValide: new Set([3, 4, 6]), versions: true });
  const lot = ver.filter(p => p.source === 'lot');
  assert.deepEqual(G.voisinsSursA(lot, 91, 5, 0, { lotAvant: true }).map(a => a.identity.cut).sort(), [3, 4]);
  assert.deepEqual(G.voisinsSursA(lot, 91, 5, 0).map(a => a.identity.cut).sort(), [3, 4, 6]);
  const ver2 = G.posesVerifiees(parCut, { ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine, lotValide: new Set([3, 4, 6]), versions: true, incertaines: new Map([[4, { ecartMm: 7 }]]) });
  assert.deepEqual(ver2.filter(p => p.source === 'lot').map(p => p.cut), [3, 6]);
});

test('zones de l\'instant : une zone s\'ouvre au cut qui la confirme, jamais avant ; un cœur de PN à venir ne change aucune zone d\'avant', () => {
  const cas = (coeurs) => Array.from({ length: 30 }, (_, i) => ({ partie: 91, cut: 10 + i, ariane: { etat: 'calcule', surface: { flushPct: coeurs.includes(10 + i) ? 90 : 10, quadMin: coeurs.includes(10 + i) ? 80 : 0, sidePoints: 300, coeurPN: coeurs.includes(10 + i), advRails: 0 } } }));
  const table = { format: 'ariane-verts-table-v1', projet: 9, partie: 91, lot: [], zonesPN: [], zonesADV: [], cuts: Array.from({ length: 30 }, (_, i) => ({ i: 10 + i, classe: 'hors-journal', mm: null, bords: null })) };
  const a = G.zonesCausales({ cas: cas([20, 21]), table }), b = G.zonesCausales({ cas: cas([20, 21, 30, 31]), table });
  assert.equal(a.get(19).zone, 'hors', 'avant la confirmation (cut 21), pas de PN : sa marge d\'avant n\'existe pas encore');
  assert.equal(a.get(20).zone, 'hors', 'un cœur seul ne confirme pas');
  assert.equal(a.get(21).zone, 'pn'); assert.equal(a.get(27).zone, 'pn', 'marge d\'après : 6 cuts'); assert.equal(a.get(28).zone, 'hors');
  for (let c = 10; c <= 29; c++) assert.equal(b.get(c).zone, a.get(c).zone, `cut ${c} : un cœur à venir (30, 31) ne change rien`);
  assert.equal(b.get(31).zone, 'pn');
  /* La sélection d'avant (non causale) mettait la marge d'avant : c'est ce que l'instant de la décision ne peut pas savoir. */
  const ancien = RA.zonesDepuisCas(cas([20, 21]));
  assert.deepEqual(ancien.zonesPN.map(z => z.controle), [[16, 27]]);
});

test('références incertaines (D-211) : pose de départ déjà déplacée par rapport à la liste d\'ESV du départ ; le déplacement du lot ne compte pas', () => {
  const T = [-458000, -6699000, -20];                              // repère de la liste (monde) ≠ repère de l'Écho : une translation
  const ed = [], n = 12;
  for (let c = 0; c < n; c++) { const r = H.railsDe(c); for (const s of ['left', 'right']) for (let k = 0; k < 3; k++) ed.push(Math.round((r[s].positionSceneRelative[k] + T[k]) * 1e4)); }
  const liste = LM.decompacter(LM.compacter({ st: new Array(n).fill(0), fl: new Array(n).fill(0), ed }, { partie: 91, at: '2031-05-01T09:59:00Z' }));
  const depart = { 3: { dl: 0.0072, dr: 0 }, 5: { dl: 0.02, dr: 0.02 }, 6: { dl: 0.02, dr: 0.02 } };
  const parCut = [2, 3, 4, 5, 6].map(cut => ({ partie: 91, cut, visites: [H.visite({ cut, index: cut, debut: 60 * cut, depart: depart[cut] || {} }).record] }));
  const dl = lat => Object.fromEntries(['left', 'right'].map(s => [s, [0, lat / 1000, 0]]));
  const inc = G.referencesIncertaines({ parCut, liste, lotValide: new Set([5, 6]), deplacementsLot: new Map([[5, dl(20)], [6, dl(14)]]) });
  assert.deepEqual([...inc.keys()].sort(), [3, 6], 'cut 3 : déplacé de 7,2 mm par une main humaine ; cut 6 : posé par le lot à 14 mm, trouvé à 20 mm ; cut 5 : exactement la pose du lot');
  assert.ok(Math.abs(inc.get(3).ecartMm - 7.2) < 0.05); assert.ok(Math.abs(inc.get(6).ecartMm - 6) < 0.05);
  assert.equal(G.referencesIncertaines({ parCut, liste: null }).size, 0, 'sans liste : rien n\'est deviné');
});

test('référence incertaine : le cut est retiré de la passe (ni calcul, ni appui, ni zone, ni médiane) et n\'est jamais un exemple', () => {
  const d = tmp();
  H.ecrireEcho(d, [1, 2, 3, 4].map(c => ({ cut: c, index: c, debut: 60 * c, ref: c === 3 ? { lat: 9 } : null })));
  const obs = G.creerObservateur({ partie: 91, causal: true, seuilVisiteS: 0.6 });
  const cas = RA.extraire({ partie: 91, projet: 9, echo: [d], observateur: obs, seuilVisiteS: 0.6, causal: true, incertaines: () => new Map([[3, { ecartMm: 7.25 }]]) });
  fs.rmSync(d, { recursive: true, force: true });
  const c3 = cas.find(c => c.cut === 3);
  assert.deepEqual(c3.ariane, { etat: 'reference-incertaine' }); assert.equal(c3.mic.ref, null); assert.equal(c3.mic.raison, 'reference-incertaine');
  assert.equal(obs.etat.cuts.find(r => r.cut === 3).hyp, null);
  const lignes = G.lignesDuJeu({ designation: '9:91', jeu: 'apprentissage', observateur: obs, cas, zones: new Map() });
  assert.equal(lignes.find(l => l.type === 'cut' && l.cut === 3).reference, 'incertaine');
  assert.equal(obs.etat.gauges.length, 3, 'sa pose de départ n\'entre pas dans la médiane');
});

test('seuil de visite sans action : 0,6 s dans le jeu causal (0,8 s par défaut ailleurs)', () => {
  const d = tmp();
  H.ecrireEcho(d, [{ cut: 1, index: 1, debut: 60, duree: 0.7 }, { cut: 2, index: 2, debut: 120, duree: 0.5 }]);
  const c6 = RA.extraire({ partie: 91, projet: 9, echo: [d], seuilVisiteS: 0.6 }), c8 = RA.extraire({ partie: 91, projet: 9, echo: [d] });
  fs.rmSync(d, { recursive: true, force: true });
  assert.equal(c6[0].mic.ref, 'visite-bon'); assert.equal(c8[0].mic.ref, null); assert.equal(c8[0].mic.raison, 'trop-court');
  assert.equal(c6[1].mic.raison, 'trop-court');
});

test('chaîne : sa pose est une hypothèse même sans appui (étage crossing ou premier cut), avec sa hauteur', () => {
  const r = base(), c1 = r.lignes.filter(l => l.type === 'hyp' && l.cut === 1);
  assert.ok(['left', 'right'].every(s => c1.some(l => l.rail === s && l.sousOrigines.includes('chaine'))), 'premier cut, aucun appui : la pose de la chaîne est là');
  const cas1 = r.cas.find(c => c.cut === 1), ch = cas1.ariane.chaine;
  for (const s of ['left', 'right']) {
    const q = ch.rails[s].pose, h = ch.rails[s].hauteurMm || 0;
    assert.ok(c1.some(l => l.rail === s && Math.hypot(l.decal[0] - q[0], l.decal[1] - q[1], l.decal[2] - (q[2] + h)) < 0.76), `rail ${s} : la pose « chaîne + hauteur » de la règle prudente est parmi les hypothèses`);
  }
});
