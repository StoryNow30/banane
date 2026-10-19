#!/usr/bin/env node
'use strict';
/*
 * memoire-differes.cjs — PREMIÈRE « MÉMOIRE DES DIFFÉRÉS » (lot G1 du cahier 5.0), construite et jugée HORS LIGNE.
 *
 * Cap de Mic : « quand tu possèdes un lot Orbite et son Écho, un cut différé = un cut appris, qu'Ariane saura poser dans
 * un contexte similaire ». Rien n'est activé dans l'extension : outil hors ligne, lecture seule, sans dépendance, rien
 * sous src/ (les modules du moteur sont seulement LUS : `geometry-candidate-v1.js` pour rejouer le moteur, `gauge.js`
 * pour le contrat d'écartement, `placement-convention.js` pour le calage, `continuity-observer.js` pour déplacer la
 * fenêtre).
 *
 * Deux temps.
 *
 *   1. `construire` : un CAS par cut différé que Mic a posé (lot Orbite + Écho de Mic joints, voir
 *      tools/jointure-echo-orbite.cjs et tools/jeu-apprentissage.cjs). Un cas porte
 *        - le CONTEXTE d'Ariane, sans coordonnée absolue : motif d'abstention, voisins posés et leur écart, prédiction de
 *          voie (lot, B1, état de T), écartement (départ, voisins), zone (ADV, PN), relevés S6, points de flanc ;
 *        - le POOL de candidats du moteur rejoué sur le vrai nuage (`Candidate.propose`, grille grossière du moteur),
 *          avec ses traits ; plus un pool ÉLARGI (la même recherche rejouée sur des fenêtres décalées) pour savoir où
 *          le moteur ne regardait pas ;
 *        - la RÉPONSE de Mic, dans le repère du cut (décalage latéral / vertical par rapport à la pose de départ
 *          d'ESV), et le candidat du pool qu'elle désigne.
 *      Toute position est un décalage dans le repère profil du cut, par rapport à la pose de départ d'ESV.
 *
 *   2. `juger` : trois façons d'apprendre, toutes lisibles, jugées sans tricher.
 *        (a) CHOIX DANS LE POOL : quel candidat Mic prend quand Ariane s'abstient (régression logistique à
 *            quelques traits, lisible) ;
 *        (b) DÉCALAGE DE VOIE : pour une série de différés, la pose de Mic suit-elle un décalage constant par rapport
 *            à une prédiction de voie ? Mémoire de voie de la série, réutilisée sur les cuts suivants, avec le moteur
 *            rejoué autour de la voie apprise ;
 *        (c) VOISIN LE PLUS PROCHE : retrouver, parmi les cas d'AUTRES parties, ceux au contexte semblable.
 *      Jugement : on apprend sur certaines parties et on juge sur une autre (jamais la même des deux côtés) ; pour (b),
 *      aussi à l'intérieur d'une série (on apprend sur les premiers différés corrigés, on juge sur les suivants). Les
 *      seuils sont choisis sur les parties d'apprentissage seulement (validation croisée interne par partie).
 *      Mesure : différés que la méthode aurait posés à moins de 5 et de 10 mm de Mic, poses fausses (plus de 10 mm),
 *      poses sur la MAUVAISE VOIE (plus de 50 mm), abstentions restantes. Porte : 0 pose sur la mauvaise voie et
 *      moins de 5 % de poses fausses parmi celles proposées.
 *
 *   node tools/memoire-differes.cjs construire --partie PROJET:PARTIE --jeu jeu.jsonl --jointure table.json
 *        --corpus seg1.json [--corpus seg2.json …] [--diagnostic diag.json] [--reprendre-pools ancien.jsonl] --sortie cas-N.jsonl
 *        [--juger-partie-reservee]
 *   node tools/memoire-differes.cjs juger --cas cas-a.jsonl --cas cas-b.jsonl [--cas …] [--json sortie.json]
 *        [--propagation] [--silencieux] [--juger-partie-reservee]
 *   node tools/memoire-differes.cjs concordance --cas cas-N.jsonl --corpus seg1.json [--corpus …] [--json sortie.json]
 *        [--evenements ombre.jsonl]
 *      l'ombre de l'Écho de l'extension (module commun src/voie-recentree.js, moteur recentré sur le vrai nuage) contre (b) hors
 *      ligne (recalage dans le pool), cas par cas, avec la mémoire de l'Écho ; et le poids des événements qu'elle consignerait.
 *
 * Parties réservées (manifeste des parties, B1 de l'audit 5.0 : datasets/manifeste-parties.json) : `construire` refuse
 * une partie qui n'est pas d'apprentissage, et `juger` refuse un fichier dont l'en-tête (projet, partie) est réservé.
 * Avec `--juger-partie-reservee`, la partie réservée est JUGÉE avec des réglages appris sur les autres parties, et
 * n'entre dans aucun apprentissage. Un fichier de cas sans `projet` dans son en-tête n'est pas contrôlé.
 *
 * Les fichiers de cas, de corpus et de jointure restent HORS dépôt (scratchpad). Le dépôt ne porte que l'outil, son
 * essai sur fixture synthétique et la fiche (fiches/G1_MEMOIRE_DIFFERES.md).
 */
const fs = require('node:fs');
const path = require('node:path');
const Manifeste = require('./manifeste-parties.cjs');

const FORMAT_CAS = 'ariane-memoire-differes-cas-v1';
const FORMAT_RAPPORT = 'ariane-memoire-differes-v1';
const COTES = ['gauche', 'droite'];
const ANGLAIS = { gauche: 'left', droite: 'right' };
const fini = Number.isFinite;
const SEUIL_JUSTE_MM = 5, SEUIL_FAUX_MM = 10, SEUIL_MAUVAISE_VOIE_MM = 50;
const PORTE_FAUX = 0.05;
/* Fenêtres décalées du pool élargi (mm, repère profil du cut). Le moteur cherche ±80 mm en latéral et ±40 mm en
 * vertical autour de ses centres ; les pas ci-dessous recouvrent sans trou jusqu'à ±360 mm de côté et ±120 mm de haut. */
const DECALAGES_LAT = [-360, -240, -120, 0, 120, 240, 360];
const DECALAGES_VERT = [-80, 0, 80];
const ECART_SERIE_MAX = 10;     // trou maximal (en numéros de cut) entre deux différés d'une même série
const PORTEE_VOISINS = 12;      // cuts de part et d'autre pour les poses voisines consignées dans un cas

/* ------------------------------------------------------------------ petits outils */
const somme = v => v.reduce((a, b) => a + b, 0);
const moyenne = v => v.length ? somme(v) / v.length : null;
function quantile(valeurs, p) {
  const v = valeurs.filter(fini).sort((a, b) => a - b);
  if (!v.length) return null;
  const at = (v.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at);
  return v[lo] + (v[hi] - v[lo]) * (at - lo);
}
const mediane = v => quantile(v, 0.5);
const arrondi = (v, d = 1) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const fr = (v, d = 1) => v === null || v === undefined || !fini(v) ? '—' : v.toFixed(d).replace('.', ',');
const pct = (v, d = 1) => v === null || v === undefined || !fini(v) ? '—' : `${(100 * v).toFixed(d).replace('.', ',')} %`;
const sig4 = v => fini(v) ? Number(v.toPrecision(4)) : null;
/* Borne haute de Wilson à 95 % pour une proportion k / n (0 pose fausse sur n ne prouve pas « moins de 5 % »). */
function wilsonHaut(k, n) {
  if (!n) return null;
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  return (p + z * z / (2 * n) + z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
}
const norme = v => Math.hypot(...v);
const racine = () => path.resolve(__dirname, '..');
let _gauge = null;
const gauge = () => _gauge || (_gauge = require(path.join(racine(), 'src', 'gauge.js')));
const ecartementAdmissible = mm => fini(mm) && gauge().admissible(gauge().classifyMm(mm));
/* Module commun « recentrer sur la voie » (src/voie-recentree.js, audit 5.0 I8) : le recalage de (b) dans le pool est le sien, et
 * l'ombre de l'Écho de l'extension (`memoire-differes-ombre`) en emploie la forme « moteur recentré sur le vrai nuage ». */
let _voie = null;
const voie = () => _voie || (_voie = require(path.join(racine(), 'src', 'voie-recentree.js')));

/* ================================================================== 1. CONSTRUCTION D'UN CAS */

/* Modules du moteur, lus seulement, chargés à la demande (le jugement n'en a pas besoin, sauf gauge.js). */
function modules() {
  const r = racine();
  return {
    C: require(path.join(r, 'vendor', 'capture-core.js')),
    Cand: require(path.join(r, 'src', 'geometry-candidate-v1.js')),
    Conv: require(path.join(r, 'src', 'placement-convention.js')),
    Obs: require(path.join(r, 'src', 'continuity-observer.js')),
  };
}

/* Lecture d'un nuage comme le moteur (mêmes filtres que `gcv1-shadow.js` : fenêtre ±0,5 m le long, ±0,18 m de côté,
 * ±0,10 m de haut). Points triés par u pour des comptes par intervalle rapides. */
function preparerCadre(M, capture, cote) {
  const { C, Cand } = M, rail = capture.rails && capture.rails[ANGLAIS[cote]];
  if (!rail) return { ok: false, raison: 'rail absent' };
  if (!capture.pointsSceneRelative || !capture.pointsSceneRelative.length) return { ok: false, raison: 'aucun point' };
  const contour = (rail.profileContours || []).reduce((a, b) => ((b.verticesSceneRelative || []).length > ((a && a.verticesSceneRelative) || []).length ? b : a), null);
  if (!contour) return { ok: false, raison: 'contour absent' };
  const forme = contour.verticesSceneRelative.map(p => C.point(rail.sceneRelativeToProfileLocal, p));
  const sign = Math.sign(Cand.median(forme.map(p => p[1])));
  if (!sign) return { ok: false, raison: 'sens ambigu' };
  const sommets = forme.map(p => [sign * p[1], p[2]]), tete = sommets.filter(p => p[1] > -0.04);
  if (tete.length < 6) return { ok: false, raison: 'champignon non reconnu' };
  const points = [];
  for (let i = 0; i < capture.pointsSceneRelative.length; i++) {
    if (capture.visibleByClipBoxes && capture.visibleByClipBoxes[i] === false) continue;
    const src = capture.pointsSceneRelative[i];
    if (!Array.isArray(src) || !src.every(fini)) continue;
    const q = C.point(rail.sceneRelativeToProfileLocal, src);
    if (!q.every(fini)) continue;
    if (Math.abs(q[0]) <= 0.5 && Math.abs(q[1]) < 0.18 && Math.abs(q[2]) < 0.10) points.push([sign * q[1], q[2], q[0]]);
  }
  if (points.length < 8) return { ok: false, raison: 'trop peu de points', pointsLocal: points.length };
  const largeur = Math.max(...tete.filter(p => p[1] > -0.012).map(p => p[0]));
  if (!(largeur > 0.025 && largeur < 0.12)) return { ok: false, raison: 'profil hors domaine' };
  const ancresDessus = [];
  for (let u = 0.012; u < largeur - 0.012; u += 0.006) {
    const pres = tete.filter(p => Math.abs(p[0] - u) < 0.004);
    if (pres.length) ancresDessus.push([u, Math.max(...pres.map(p => p[1]))]);
  }
  const ancresFlanc = [];
  for (let z = -0.014; z >= -0.033; z -= 0.004) {
    const pres = tete.filter(p => Math.abs(p[1] - z) < 0.004);
    if (pres.length) ancresFlanc.push([Math.min(...pres.map(p => p[0])), z]);
  }
  if (ancresDessus.length < 3 || ancresFlanc.length < 3) return { ok: false, raison: 'surfaces non identifiées' };
  points.sort((a, b) => a[0] - b[0]);
  const us = points.map(p => p[0]), zs = points.map(p => p[1]).sort((a, b) => a - b);
  return { ok: true, sign, largeur, points, us, uMediane: us[us.length >> 1], zMediane: zs[zs.length >> 1] };
}
/* Indice du premier point dont u est strictement supérieur à `u` (recherche dichotomique, points triés par u). */
function indiceApres(us, u) {
  let lo = 0, hi = us.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (us[m] > u) hi = m; else lo = m + 1; }
  return lo;
}
const BANDE_DESSUS = 0.012, BANDE_FLANC = 0.01;
function ligneDessus(M, cadre, u, z) {
  const lo = u + 0.012, hi = u + cadre.largeur - 0.012;
  if (!(hi > lo)) return [];
  const pts = [];
  for (let i = indiceApres(cadre.us, lo); i < cadre.points.length && cadre.points[i][0] < hi; i++)
    if (Math.abs(cadre.points[i][1] - z) < BANDE_DESSUS) pts.push([cadre.points[i][0], cadre.points[i][1]]);
  return pts;
}
/* Caractérise une cellule (u, z) comme `gcv1-shadow.js::characterize` : points du dessus, du flanc, pente, fenêtre. */
function caracteriser(M, cadre, u, z, centres) {
  const { Cand } = M, cfg = Cand.DEFAULTS;
  const dessus = ligneDessus(M, cadre, u, z), top = Cand.robustLine(dessus), topRows = dessus.length;
  if (!top) return { u, z, topRows, faceCount: 0, slopeLimited: false, windowOk: false, tier: 'WEAK_FACE' };
  const flanc = [];
  for (let i = indiceApres(cadre.us, u - cfg.faceBand); i < cadre.points.length && cadre.points[i][0] < u + cfg.faceBand; i++) {
    const p = cadre.points[i], chute = top.slope * p[0] + top.intercept - p[1];
    if (chute > 0.009 && chute < 0.034) flanc.push([p[1], p[0]]);
  }
  const face = Cand.robustLine(flanc), faceCount = face ? face.count : 0;
  let su = u, sz = z;
  if (face) { const den = 1 - face.slope * top.slope; if (Math.abs(den) > 0.5) { su = (face.intercept + face.slope * top.intercept) / den; sz = top.slope * su + top.intercept; } }
  const fenetreU = (centres || [0]).some(cu => Math.abs(su - cu) <= cfg.searchY + 0.01);
  const windowOk = fenetreU && Math.abs(sz) <= cfg.searchZ + 0.01 && fini(su) && fini(sz);
  const slopeLimited = !!(top.slopeLimited || (face && face.slopeLimited));
  const tier = faceCount >= cfg.minFace ? 'STRONG_FACE' : faceCount >= 3 ? 'PARTIAL_FACE' : 'WEAK_FACE';
  return { u, z, topRows, faceCount, slopeLimited, windowOk, tier };
}
const fort = c => !!c && c.topRows >= 15 && c.faceCount >= 6 && !c.slopeLimited && c.windowOk;
/* Minima locaux d'une grille (aucune cellule voisine, à un pas près, de perte plus basse). */
function minimaLocaux(cellules, pas) {
  const cle = (u, z) => Math.round(u * 1e6) + ',' + Math.round(z * 1e6), carte = new Map();
  for (const c of cellules) carte.set(cle(c.u, c.z), c);
  const mins = [];
  for (const c of cellules) {
    let ok = true;
    for (let du = -pas; du <= pas + 1e-12 && ok; du += pas) for (let dz = -pas; dz <= pas + 1e-12; dz += pas) {
      if (Math.abs(du) < 1e-12 && Math.abs(dz) < 1e-12) continue;
      const o = carte.get(cle(c.u + du, c.z + dz));
      if (o && o.loss < c.loss - 1e-15) { ok = false; break; }
    }
    if (ok) mins.push(c);
  }
  return mins;
}
/* Pool réduit du moteur (même construction que `gcv1-shadow.js::reducePool`) : minimum de perte, minimum de perte
 * soutenu, minima locaux, minima locaux des cellules denses fortes et partielles. */
function reduirePool(M, cadre, grossier, centres) {
  const { Cand } = M, cfg = Cand.DEFAULTS, garde = new Map();
  const ajoute = (c, bal) => { const k = Math.round(c.u * 1e6) + ',' + Math.round(c.z * 1e6); if (!garde.has(k)) garde.set(k, { u: c.u, z: c.z, loss: c.loss, bal: new Set() }); garde.get(k).bal.add(bal); };
  let minPerte = grossier[0], minSoutenu = null;
  for (const c of grossier) {
    if (c.loss < minPerte.loss) minPerte = c;
    c.topRows = ligneDessus(M, cadre, c.u, c.z).length;
    if (c.topRows >= cfg.minTop && (!minSoutenu || c.loss < minSoutenu.loss)) minSoutenu = c;
  }
  ajoute(minPerte, 'm'); if (minSoutenu) ajoute(minSoutenu, 'ms');
  for (const c of minimaLocaux(grossier, 0.003)) ajoute(c, 'lm');
  const denses = [];
  for (const c of grossier) if (c.topRows >= cfg.minTop) { const ch = caracteriser(M, cadre, c.u, c.z, centres); ch.loss = c.loss; denses.push(ch); }
  const forts = denses.filter(fort);
  if (forts.length) {
    for (const c of minimaLocaux(forts.map(d => ({ u: d.u, z: d.z, loss: d.loss })), 0.003)) ajoute(c, 'fl');
    ajoute(forts.reduce((a, b) => b.loss < a.loss ? b : a), 'mf');
  }
  const partiels = denses.filter(c => c.tier === 'PARTIAL_FACE' && c.windowOk && !c.slopeLimited);
  if (partiels.length) {
    for (const c of minimaLocaux(partiels.map(d => ({ u: d.u, z: d.z, loss: d.loss })), 0.003)) ajoute(c, 'pl');
    ajoute(partiels.reduce((a, b) => b.loss < a.loss ? b : a), 'mp');
  }
  const out = [];
  for (const c of garde.values()) {
    const dense = denses.find(d => d.u === c.u && d.z === c.z) || caracteriser(M, cadre, c.u, c.z, centres);
    out.push({ ...dense, loss: c.loss, bal: [...c.bal] });
  }
  out.sort((a, b) => a.loss - b.loss);
  return out;
}
/* Capture dont le rail `cote` est déplacé de (lat, vert) mm dans son repère profil (la fenêtre du moteur le suit). */
function capturedecalee(M, capture, cote, lat, vert) {
  const { C, Obs } = M, r = capture.rails[ANGLAIS[cote]], P = r.profileLocalToSceneRelative;
  if (!lat && !vert) return capture;
  const a = C.point(P, [0, 0, 0]), b = C.point(P, [0, lat / 1000, vert / 1000]);
  return { ...capture, rails: { ...capture.rails, [ANGLAIS[cote]]: Obs.translated(r, [b[0] - a[0], b[1] - a[1], b[2] - a[2]]) } };
}
/* Pool d'un rail dans une fenêtre décalée de (dl, dv) mm. Retourne les candidats avec leur position FINALE (calage de
 * convention compris) en mm par rapport à la pose de départ d'ESV. */
function poolFenetre(M, capture, cote, dl, dv) {
  const { Cand, Conv } = M, cap = capturedecalee(M, capture, cote, dl, dv);
  const cadre = preparerCadre(M, cap, cote);
  if (!cadre.ok) return { ok: false, raison: cadre.raison, candidats: [] };
  let grossier = null;
  try { Cand.propose(cap, ANGLAIS[cote], { lab: { uSeeds: [cadre.uMediane], replaceOrigin: false, recenterWindow: true, partialFaceKeep: true, onCoarse(c) { grossier = c; } } }); } catch (e) { return { ok: false, raison: String(e.message || e).slice(0, 80), candidats: [] }; }
  if (!grossier || !grossier.length) return { ok: false, raison: 'grille indisponible', candidats: [] };
  const centres = [0, cadre.uMediane], pool = reduirePool(M, cadre, grossier, centres);
  const candidats = pool.map((c, rang) => {
    const delta = [0, cadre.sign * c.u, c.z];
    let fin = delta, calage = null;
    if (c.topRows >= 15) { const cal = Conv.calibrate(cap, ANGLAIS[cote], delta); if (cal.applied) { fin = cal.delta; calage = [arrondi((cal.delta[1] - delta[1]) * 1000, 2), arrondi((cal.delta[2] - delta[2]) * 1000, 2)]; } }
    return {
      la: arrondi(dl + cadre.sign * c.u * 1000, 2), ve: arrondi(dv + c.z * 1000, 2),
      fla: arrondi(dl + fin[1] * 1000, 2), fve: arrondi(dv + fin[2] * 1000, 2), calage,
      perte: sig4(c.loss), haut: c.topRows, flanc: c.faceCount, fort: fort(c) ? 1 : 0, part: c.tier === 'PARTIAL_FACE' ? 1 : 0,
      pente: c.slopeLimited ? 1 : 0, fen: c.windowOk ? 1 : 0, bal: c.bal.join(','), rangFenetre: rang, decal: [dl, dv],
    };
  });
  return { ok: true, candidats, nGrossier: grossier.length, cadre: { points: cadre.points.length, uMed: arrondi(cadre.sign * cadre.uMediane * 1000, 1), zMed: arrondi(cadre.zMediane * 1000, 1) }, sign: cadre.sign };
}
/* Le nuage autour de la pose de départ, un rail : points gardés par le moteur, médiane latérale / verticale des points
 * (la « voie » vue par le nuage), points de dessus et de flanc sous le gabarit posé au départ. */
function nuageDeDepart(M, capture, cote) {
  const cadre = preparerCadre(M, capture, cote);
  if (!cadre.ok) return { ok: false, raison: cadre.raison };
  const ch = caracteriser(M, cadre, 0, 0, [0, cadre.uMediane]);
  return { ok: true, points: cadre.points.length, uMed: arrondi(cadre.sign * cadre.uMediane * 1000, 1), zMed: arrondi(cadre.zMediane * 1000, 1), dessusDepart: ch.topRows, flancDepart: ch.faceCount };
}
/* Pool du moteur (fenêtre non décalée) et pool élargi (union des fenêtres décalées, dédoublonnée à 1,5 mm près : on
 * garde la version la plus proche du centre de sa fenêtre). Les candidats du pool du moteur portent `moteur: 1`. */
function poolsDuRail(M, capture, cote) {
  const zero = poolFenetre(M, capture, cote, 0, 0);
  const tous = new Map(), pas = 1.5;
  const cle = c => Math.round(c.fla / pas) + ',' + Math.round(c.fve / pas);
  const essaie = (c, moteur) => {
    const k = cle(c), dist = Math.hypot(c.la - c.decal[0], c.ve - c.decal[1]), ancien = tous.get(k);
    if (moteur) { tous.set(k, { ...c, moteur: 1, dist: -1 }); return; }
    if (ancien && ancien.moteur) return;
    if (!ancien || dist < ancien.dist) tous.set(k, { ...c, moteur: 0, dist });
  };
  for (const c of zero.candidats) essaie(c, true);
  let autres = 0;
  for (const dl of DECALAGES_LAT) for (const dv of DECALAGES_VERT) {
    if (dl === 0 && dv === 0) continue;
    const f = poolFenetre(M, capture, cote, dl, dv);
    if (!f.ok) continue;
    autres++;
    for (const c of f.candidats) if (c.haut >= 15 && c.flanc >= 3 && !c.pente) essaie(c, false);
  }
  if (!zero.ok && !autres) return { ok: false, raison: zero.raison, candidats: [] };
  const candidats = [...tous.values()].map(({ dist, decal, rangFenetre, ...c }) => c).sort((a, b) => a.perte - b.perte);
  return { ok: true, candidats, nGrossier: zero.nGrossier || 0, cadre: zero.cadre || null, sign: zero.sign || null, moteurOk: zero.ok, raisonMoteur: zero.ok ? null : zero.raison };
}

/* Position d'un point de scène dans le repère profil d'un cut, en mm, par rapport à sa pose de départ. */
function enRepere(C, rail, pointScene) {
  const p = C.point(rail.S2P, pointScene), o = C.point(rail.S2P, rail.pos);
  return [arrondi((p[0] - o[0]) * 1000, 2), arrondi((p[1] - o[1]) * 1000, 2), arrondi((p[2] - o[2]) * 1000, 2)];
}
const versScene = (C, rail, mm) => C.point(rail.P2S, mm.map(v => v / 1000));

/* Séries de différés : cuts différés du journal qui se suivent avec un trou de ECART_SERIE_MAX cuts au plus. */
function numeroterSeries(cuts) {
  const tri = [...new Set(cuts)].sort((a, b) => a - b), res = new Map();
  let cur = [];
  const ferme = () => { cur.forEach((c, i) => res.set(c, { id: cur[0], rang: i, longueur: cur.length })); cur = []; };
  for (const c of tri) { if (cur.length && c - cur[cur.length - 1] > ECART_SERIE_MAX) ferme(); cur.push(c); }
  ferme();
  return res;
}

/* Contexte d'Ariane à partir d'une ligne du jeu d'apprentissage (traits d'Ariane seulement : JAMAIS `etiquette`). */
function contexteDuJeu(ligne) {
  const t = ligne.traits || {}, g0 = t.g0 || {}, b1 = t.b1Ombre || {}, vo = t.voisinage || {}, ct = ligne.contexte || {}, z = ligne.zone || null;
  const rails = {};
  for (const c of COTES) {
    const r = (g0.rails && g0.rails[c]) || {}, p = (t.propositionMoteur && t.propositionMoteur[c]) || {}, d = (t.differe && t.differe[c]) || {};
    rails[c] = { motif: d.motif || p.motif || null, statut: p.statut || null, convention: p.convention === undefined ? null : p.convention, confiance: p.confiance === undefined ? null : p.confiance,
      dzMm: r.dzMm === undefined ? null : r.dzMm, lossRatio: r.lossRatio === undefined ? null : r.lossRatio, topRows: r.topRows === undefined ? null : r.topRows,
      faceCount: r.faceCount === undefined ? null : r.faceCount, nStrongCompetitive: r.nStrongCompetitive === undefined ? null : r.nStrongCompetitive,
      nPool: r.nPool === undefined ? null : r.nPool, pente: r.slopeLimited === undefined ? null : r.slopeLimited, ecartementPrevuMm: r.ecartementPrevuMm === undefined ? null : r.ecartementPrevuMm };
  }
  const reel = b1.reel || {}, hyp = b1.hypothese || {};
  return {
    etage: reel.stage || null, raisonEtage: reel.reason || null, nonResolus: (t.differe && t.differe.railsNonResolus) || [], rails,
    voisins: { posesAvant: vo.posesAvant === undefined ? null : vo.posesAvant, differesAvant: vo.differesAvant === undefined ? null : vo.differesAvant,
      plusProcheCuts: vo.plusProche ? vo.plusProche.ecart : null, plusProcheClasse: vo.plusProche ? vo.plusProche.classe : null,
      ecartVoisinsMm: g0.ecartVoisinsMm === undefined ? null : g0.ecartVoisinsMm, sansVoisins: g0.sansVoisins === undefined ? null : g0.sansVoisins, scoreM6: g0.scoreM6 === undefined ? null : g0.scoreM6 },
    grappe: { distRougeMin: g0.distRougeMin === undefined ? null : g0.distRougeMin, taille: g0.groupeTaille === undefined ? null : g0.groupeTaille, rang: g0.groupeRang === undefined ? null : g0.groupeRang },
    voie: { b1Regle: b1.regle || null, b1Changement: b1.changement || null, b1Etage: hyp.stage || null, b1Appuis: hyp.appuis === undefined ? null : hyp.appuis,
      b1EcartPrevisionMm: hyp.ecartPrevisionMm === undefined ? null : hyp.ecartPrevisionMm, tEtat: t.s6 ? t.s6.tDepartEtat || null : null },
    s6: t.s6 ? { flushPct: t.s6.flushPct === undefined ? null : t.s6.flushPct, ptsVisibles: t.s6.ptsVisibles === undefined ? null : t.s6.ptsVisibles, niveauMax: t.s6.niveauMax === undefined ? null : t.s6.niveauMax } : null,
    zone: z ? { pn: z.pn || null, adv: z.adv ? { role: z.adv.role, distCuts: z.adv.distSigneeCuts, zone: z.adv.zone, cote: z.adv.cote } : null, horsZone: !!z.horsZone, zoneMic: z.zoneMic === undefined ? null : z.zoneMic } : null,
    ecartement: { departMm: ct.ecartementInitialMm === undefined ? null : ct.ecartementInitialMm, deniveleLocalMm: ct.deniveleLocalMm === undefined ? null : ct.deniveleLocalMm },
  };
}

/* Construit les cas d'une partie. Entrées déjà lues : `jeu` (lignes), `jointure` (objet), `lireCorpus(rappel)`,
 * `diagnostic` (optionnel). Retourne { entete, cas }. */
function construireCas({ partie, projet = null, jeu, jointure, corpus, diagnostic = null, sansPool = false, poolsRepris = null, journal = () => {} }) {
  const M = modules(), { C } = M;
  const lignes = new Map(); for (const l of jeu) if (l.type === 'cut' && l.partie === partie) lignes.set(l.cut, l);
  const table = new Map(); for (const r of jointure.table) if (r.partie === partie) table.set(r.cut, r);
  const differes = jointure.table.filter(r => r.partie === partie && r.classe === 'differee');
  const series = numeroterSeries(differes.map(r => r.cut));
  const avecMic = differes.filter(r => r.ecartHumain && r.base === 'premiere-visite' && r.referenceHumaine === 'observee').sort((a, b) => a.cut - b.cut);
  const ciblesPool = new Set(avecMic.map(r => r.cut));
  const lotObs = new Map();
  if (diagnostic && Array.isArray(diagnostic.observations)) for (const o of diagnostic.observations) if (o.identity && o.lotObservation) lotObs.set(o.identity.cut, o.lotObservation);
  /* Passe sur le corpus : géométrie légère de chaque cut ; pool seulement pour les cibles. */
  const geo = new Map(), pools = new Map(), nuages = new Map();
  corpus(capture => {
    const cut = capture.cut;
    const g = { frameId: (capture.identity && capture.identity.frameId) || null, rails: {} };
    for (const c of COTES) { const r = capture.rails && capture.rails[ANGLAIS[c]]; if (r) g.rails[c] = { pos: r.positionSceneRelative.slice(), S2P: r.sceneRelativeToProfileLocal.slice(), P2S: r.profileLocalToSceneRelative.slice() }; }
    if (!geo.has(cut)) geo.set(cut, g);
    if (ciblesPool.has(cut) && !nuages.has(cut)) nuages.set(cut, Object.fromEntries(COTES.map(c => [c, nuageDeDepart(M, capture, c)])));
    if (ciblesPool.has(cut) && !pools.has(cut) && !sansPool && !(poolsRepris && poolsRepris.has(cut))) {
      const p = {};
      for (const c of COTES) p[c] = poolsDuRail(M, capture, c);
      pools.set(cut, p);
      journal(`pool cut ${cut}`);
    }
  });
  const mic = new Map(); // cut -> { gauche:[lg,la,ve], droite }
  for (const r of avecMic) mic.set(r.cut, Object.fromEntries(COTES.map(c => { const e = r.ecartHumain[c]; return [c, [e.longitudinalMm, e.lateralMm, e.verticalMm]]; })));
  const cas = [];
  for (const r of avecMic) {
    const g = geo.get(r.cut); if (!g || !g.rails.gauche || !g.rails.droite) continue;
    const ligne = lignes.get(r.cut), ctx = ligne ? contexteDuJeu(ligne) : { rails: {}, voisins: {}, voie: {}, ecartement: {} };
    const dm = table.get(r.cut) || r;
    /* Prédiction de voie du lot (positions de scène de la décision), ramenée dans le repère du cut. */
    const lo = lotObs.get(r.cut);
    ctx.voie.lot = lo && lo.positions ? { etage: lo.stage || null, ancres: (lo.anchorsUsed || []).length, ecartPrevisionMm: lo.fromPredictionMm === undefined ? null : lo.fromPredictionMm,
      commande: lo.command ? `${lo.command.action}:${lo.command.reason}` : null,
      pos: Object.fromEntries(COTES.map(c => { const q = enRepere(C, g.rails[c], lo.positions[ANGLAIS[c]]); return [c, [q[1], q[2]]]; })) } : null;
    const geometrie = (() => {
      const L = g.rails.gauche, R = g.rails.droite, axe = (rail, i) => { const o = versScene(C, rail, [0, 0, 0]), e = [0, 0, 0]; e[i] = 1000; const p = versScene(C, rail, e); return [(p[0] - o[0]), (p[1] - o[1]), (p[2] - o[2])]; };
      return { ecartement0: [0, 1, 2].map(i => arrondi((R.pos[i] - L.pos[i]) * 1000, 2)), axes: { gauche: [0, 1, 2].map(i => axe(L, i).map(v => arrondi(v, 6))), droite: [0, 1, 2].map(i => axe(R, i).map(v => arrondi(v, 6))) } };
    })();
    ctx.ecartement.departGeomMm = arrondi(norme(geometrie.ecartement0), 1);
    const mm = {}; for (const c of COTES) mm[c] = enRepere(C, g.rails[c], versScene(C, g.rails[c], mic.get(r.cut)[c]));
    // Pose de Mic dans la scène, pour la consigner chez les voisins.
    const voisinsMic = [], departsVoisins = [], posesVoisines = [];
    for (const [cutV, gv] of geo) {
      if (cutV === r.cut || gv.frameId !== g.frameId || Math.abs(cutV - r.cut) > PORTEE_VOISINS || !gv.rails.gauche || !gv.rails.droite) continue;
      const d = { cut: cutV, ecart: cutV - r.cut };
      if (mic.has(cutV)) { voisinsMic.push({ ...d, mic: Object.fromEntries(COTES.map(c => [c, enRepere(C, g.rails[c], versScene(C, gv.rails[c], mic.get(cutV)[c]))])) }); }
      departsVoisins.push({ ...d, depart: Object.fromEntries(COTES.map(c => [c, enRepere(C, g.rails[c], gv.rails[c].pos)])) });
      const rv = table.get(cutV);
      if (rv && rv.classe === 'posee' && rv.arianeDeplacement) {
        const enCut = dep => Object.fromEntries(COTES.map(c => [c, enRepere(C, g.rails[c], versScene(C, gv.rails[c], dep[c]))]));
        const ari = Object.fromEntries(COTES.map(c => { const a = rv.arianeDeplacement[c]; return [c, [a.longitudinalMm, a.lateralMm, a.verticalMm]]; }));
        let micF = null;
        if (rv.referenceHumaine === 'observee' && rv.base === 'ariane' && rv.ecartHumain) micF = Object.fromEntries(COTES.map(c => { const e = rv.ecartHumain[c]; return [c, [ari[c][0] + e.longitudinalMm, ari[c][1] + e.lateralMm, ari[c][2] + e.verticalMm]]; }));
        // `pose` : la pose d'Ariane (connue au moment de décider) ; `poseMic` : la pose finale de Mic, quand la relecture l'a corrigée (réponse, jamais contexte)
        posesVoisines.push({ ...d, pose: enCut(ari), poseMic: micF ? enCut(micF) : null });
      }
    }
    const repris = poolsRepris && poolsRepris.get(r.cut);
    const pl = repris ? Object.fromEntries(COTES.map(c => [c, { ok: repris.rails[c].poolOk, candidats: repris.rails[c].pool, raison: repris.rails[c].raison }])) : pools.get(r.cut) || null, rails = {}, reponsePool = {};
    for (const c of COTES) {
      const p = pl && pl[c];
      rails[c] = { pool: p && p.ok ? p.candidats : [], poolOk: !!(p && p.ok), raison: p && !p.ok ? p.raison : null, nuage: nuages.get(r.cut) ? nuages.get(r.cut)[c] : null };
      const proche = filtre => { let best = null; rails[c].pool.forEach((cd, i) => { if (!filtre(cd)) return; const d = Math.hypot(cd.fla - mm[c][1], cd.fve - mm[c][2]); if (!best || d < best.distMm) best = { i, distMm: arrondi(d, 1) }; }); return best; };
      reponsePool[c] = { moteur: proche(cd => cd.moteur === 1), elargi: proche(() => true) };
    }
    const gaugeMic = arrondi(ecartementGeom(geometrie, mic.get(r.cut).gauche, mic.get(r.cut).droite), 1);
    // écartement des voisins posés (médiane des trois plus proches) et décalage de Mic par rapport à la voie prédite
    const gv = posesVoisines.slice().sort((a, b) => Math.abs(a.ecart) - Math.abs(b.ecart)).slice(0, 3).map(v => ecartementGeom(geometrie, v.pose.gauche, v.pose.droite));
    ctx.ecartement.voisinsMm = gv.length ? arrondi(mediane(gv), 1) : null;
    const decalageVoie = { depart: Object.fromEntries(COTES.map(c => [c, [mic.get(r.cut)[c][1], mic.get(r.cut)[c][2]]])),
      lot: ctx.voie.lot ? Object.fromEntries(COTES.map(c => [c, [arrondi(mic.get(r.cut)[c][1] - ctx.voie.lot.pos[c][0], 1), arrondi(mic.get(r.cut)[c][2] - ctx.voie.lot.pos[c][1], 1)]])) : null };
    cas.push({
      type: 'cas', partie, cut: r.cut, serie: series.get(r.cut), contexte: ctx, geometrie, rails, voisinsMic, departsVoisins, posesVoisines,
      reponse: { mic: Object.fromEntries(COTES.map(c => [c, mic.get(r.cut)[c]])), decalageVoie, ecartementMicMm: gaugeMic, ecartDepartMm: arrondi(Math.max(...COTES.map(c => norme(mic.get(r.cut)[c]))), 1), pool: reponsePool },
    });
  }
  const entete = { type: 'entete', format: FORMAT_CAS, partie, ...(projet ? { projet } : {}), cas: cas.length, differesTotal: differes.length, differesAvecMic: avecMic.length, series: [...new Set(cas.map(c => c.serie.id))].length,
    decalagesLat: DECALAGES_LAT, decalagesVert: DECALAGES_VERT, note: 'Positions en mm dans le repère profil du cut, par rapport à la pose de départ d\'ESV. Aucune coordonnée absolue. Les poses voisines sont des décalages relatifs à ce cut.' };
  return { entete, cas };
}

/* ================================================================== 2. LECTURE DES CAS */
function lireCas(texte) {
  const lignes = texte.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  const entete = lignes.find(l => l.type === 'entete') || null;
  return { entete, cas: lignes.filter(l => l.type === 'cas') };
}
function lireFichiers(fichiers, entetes = null) {
  const parties = new Map();
  for (const f of fichiers) {
    const { entete, cas } = lireCas(fs.readFileSync(f, 'utf8'));
    if (entetes) entetes.push(entete);
    for (const c of cas) { if (!parties.has(c.partie)) parties.set(c.partie, []); parties.get(c.partie).push(c); }
  }
  for (const v of parties.values()) v.sort((a, b) => a.cut - b.cut);
  return parties;
}

/* ================================================================== 3. ERREURS ET MESURES */

/* Erreur 3D (mm) d'une pose proposée { gauche: [la, ve], droite: [la, ve] } contre la pose de Mic : le plus grand des deux rails. */
function erreurPose(cas, pose) {
  const e = {};
  for (const c of COTES) { const m = cas.reponse.mic[c]; e[c] = Math.hypot(m[0], m[1] - pose[c][0], m[2] - pose[c][1]); }
  return { gauche: e.gauche, droite: e.droite, max: Math.max(e.gauche, e.droite) };
}
function mesurer(resultats) {
  // resultats : [{ cas, pose|null, raison }]
  const n = resultats.length, poses = resultats.filter(r => r.pose);
  const err = poses.map(r => erreurPose(r.cas, r.pose).max);
  const juste5 = err.filter(e => e <= SEUIL_JUSTE_MM).length, juste10 = err.filter(e => e <= SEUIL_FAUX_MM).length;
  const faux = err.filter(e => e > SEUIL_FAUX_MM).length, mauvaise = err.filter(e => e > SEUIL_MAUVAISE_VOIE_MM).length;
  return { cas: n, poses: poses.length, juste5, juste10, faux, mauvaiseVoie: mauvaise, abstentions: n - poses.length,
    tauxFaux: poses.length ? faux / poses.length : null, fauxHaut95: wilsonHaut(faux, poses.length),
    porte: mauvaise === 0 && (poses.length === 0 || faux / poses.length < PORTE_FAUX), mediane: mediane(err), p90: quantile(err, 0.9) };
}
const sommer = ms => {
  const r = { cas: 0, poses: 0, juste5: 0, juste10: 0, faux: 0, mauvaiseVoie: 0, abstentions: 0 };
  for (const m of ms) for (const k of Object.keys(r)) r[k] += m[k];
  r.tauxFaux = r.poses ? r.faux / r.poses : null; r.fauxHaut95 = wilsonHaut(r.faux, r.poses);
  r.porte = r.mauvaiseVoie === 0 && (r.poses === 0 || r.faux / r.poses < PORTE_FAUX);
  return r;
};

/* ================================================================== 4. (a) CHOIX DANS LE POOL */
const NOMS_TRAITS_A = ['log10 perte/min', 'log10 dessus', 'flanc/10', 'fort', 'partiel', 'pente', 'fenêtre ok', 'dans le pool du moteur',
  '|latéral|/100', '|vertical|/100', 'rang de perte', 'min local', 'min local fort', 'min de perte', 'écart à la voie/100'];
function minPerteRail(cands) { let m = Infinity; for (const c of cands) if (c.moteur === 1 && c.perte > 0 && c.perte < m) m = c.perte; if (!fini(m) || m === Infinity) for (const c of cands) if (c.perte > 0 && c.perte < m) m = c.perte; return fini(m) ? m : 1e-9; }
/* Traits d'un candidat. `voie` : décalage de voie attendu [la, ve] (ou null) ; sert à la variante « avec voie ». */
function traitsCandidat(cand, rang, lmin, voie) {
  const bal = new Set((cand.bal || '').split(',').filter(Boolean));
  return [Math.log10(Math.max(cand.perte, 1e-12) / lmin), Math.log10(1 + cand.haut), Math.min(cand.flanc, 40) / 10, cand.fort, cand.part, cand.pente, cand.fen, cand.moteur,
    Math.abs(cand.fla) / 100, Math.abs(cand.fve) / 100, Math.min(rang, 20) / 20, bal.has('lm') ? 1 : 0, bal.has('fl') ? 1 : 0, bal.has('m') || bal.has('mf') ? 1 : 0,
    voie ? Math.min(Math.hypot(cand.fla - voie[0], cand.fve - voie[1]), 300) / 100 : 0];
}
const sigmoide = z => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
/* Régression logistique L2 par descente de gradient (traits standardisés), poids de classe pour l'équilibre. */
function ajusterLogistique(X, y, { lambda = 0.5, iterations = 400, pas = 0.5 } = {}) {
  if (!X.length) return { mu: [], sd: [], w: [], b: -3, vide: true };
  const n = X.length, d = X[0].length, mu = new Array(d).fill(0), sd = new Array(d).fill(1);
  for (let j = 0; j < d; j++) { mu[j] = moyenne(X.map(x => x[j])); sd[j] = Math.sqrt(moyenne(X.map(x => (x[j] - mu[j]) ** 2))) || 1; }
  const Z = X.map(x => x.map((v, j) => (v - mu[j]) / sd[j]));
  const pos = y.filter(v => v === 1).length, neg = n - pos;
  if (!pos || !neg) return { mu, sd, w: new Array(d).fill(0), b: pos ? 3 : -3 };
  const wp = n / (2 * pos), wn = n / (2 * neg);
  let w = new Array(d).fill(0), b = 0;
  for (let it = 0; it < iterations; it++) {
    const g = new Array(d).fill(0); let gb = 0;
    for (let i = 0; i < n; i++) {
      const p = sigmoide(b + Z[i].reduce((a, v, j) => a + v * w[j], 0)), e = (p - y[i]) * (y[i] ? wp : wn);
      for (let j = 0; j < d; j++) g[j] += e * Z[i][j]; gb += e;
    }
    for (let j = 0; j < d; j++) w[j] -= pas * (g[j] / n + lambda * w[j] / n * 4);
    b -= pas * gb / n;
  }
  return { mu, sd, w, b };
}
const scoreLogistique = (m, x) => sigmoide(m.b + x.reduce((a, v, j) => a + (v - m.mu[j]) / m.sd[j] * m.w[j], 0));
/* Jeu d'apprentissage de (a) : un exemple par candidat ; étiquette = la pose finale du candidat est à moins de 5 mm de Mic. */
function exemplesA(cas, optionsVoie) {
  const X = [], y = [];
  for (const c of cas) for (const cote of COTES) {
    const cands = c.rails[cote].pool.filter(cd => optionsVoie.elargi || cd.moteur === 1);
    if (!cands.length) continue;
    const lmin = minPerteRail(cands), m = c.reponse.mic[cote];
    cands.forEach((cd, rang) => { X.push(traitsCandidat(cd, rang, lmin, optionsVoie.voie ? optionsVoie.voie(c, cote) : null)); y.push(Math.hypot(m[0], cd.fla - m[1], cd.fve - m[2]) <= SEUIL_JUSTE_MM ? 1 : 0); });
  }
  return { X, y };
}
/* Écartement (mm) de deux poses données par leurs décalages [lg, la, ve] (mm) dans le repère profil de chaque rail. */
function ecartementGeom(geometrie, dl, dr) {
  const A = geometrie.axes, E = geometrie.ecartement0;
  const pg = [0, 1, 2].map(i => A.gauche[0][i] * dl[0] + A.gauche[1][i] * dl[1] + A.gauche[2][i] * dl[2]);
  const pd = [0, 1, 2].map(i => E[i] + A.droite[0][i] * dr[0] + A.droite[1][i] * dr[1] + A.droite[2][i] * dr[2]);
  return norme([0, 1, 2].map(i => pd[i] - pg[i]));
}
/* Meilleure paire admissible : par rail les `k` candidats les mieux notés, paire dont l'écartement est dans le contrat. */
function ecartementPaire(cas, dl, dr) { return ecartementGeom(cas.geometrie, [0, dl[0], dl[1]], [0, dr[0], dr[1]]); }
function meilleuresPaires(cas, noteGauche, noteDroite, prior, k = 4) {
  const top = notes => notes.slice().sort((a, b) => b.p - a.p).slice(0, k);
  const L = top(noteGauche), R = top(noteDroite), paires = [];
  for (const a of L) for (const b of R) {
    const ec = ecartementPaire(cas, [a.c.fla, a.c.fve], [b.c.fla, b.c.fve]);
    if (ecartementAdmissible(ec)) paires.push({ gauche: a.c, droite: b.c, p: a.p * b.p * (prior ? Math.exp(-0.5 * ((ec - prior.mu) / prior.sigma) ** 2) : 1), ecartement: ec });
  }
  paires.sort((x, y) => y.p - x.p);
  return paires;
}
/* Note les candidats d'un rail avec un modèle ; retourne [{ c, p }]. */
function noterRail(modele, cas, cote, optionsVoie) {
  const cands = cas.rails[cote].pool.filter(cd => optionsVoie.elargi || cd.moteur === 1);
  if (!cands.length) return [];
  const lmin = minPerteRail(cands), voie = optionsVoie.voie ? optionsVoie.voie(cas, cote) : null;
  return cands.map((cd, rang) => ({ c: cd, p: scoreLogistique(modele, traitsCandidat(cd, rang, lmin, voie)) }));
}
/* Pose par (a) : meilleure paire admissible, acceptée si p(paire) ≥ seuilP et si elle domine la meilleure paire distincte
 * (à plus de 10 mm) d'au moins `marge` (rapport p1 / (p1 + p2)). */
function poserA(modele, seuils, cas, optionsVoie) {
  const nG = noterRail(modele, cas, 'gauche', optionsVoie), nD = noterRail(modele, cas, 'droite', optionsVoie);
  if (!nG.length || !nD.length) return { pose: null, raison: 'pool vide' };
  const paires = meilleuresPaires(cas, nG, nD, modele.ecartement);
  if (!paires.length) return { pose: null, raison: 'aucune paire admissible' };
  const p1 = paires[0];
  const distincte = paires.find(q => Math.max(Math.hypot(q.gauche.fla - p1.gauche.fla, q.gauche.fve - p1.gauche.fve), Math.hypot(q.droite.fla - p1.droite.fla, q.droite.fve - p1.droite.fve)) > SEUIL_FAUX_MM);
  const rapport = distincte ? p1.p / (p1.p + distincte.p) : 1;
  if (p1.p < seuils.p) return { pose: null, raison: 'note trop basse', note: p1.p };
  if (rapport < seuils.marge) return { pose: null, raison: 'ambigu', note: p1.p };
  return { pose: { gauche: [p1.gauche.fla, p1.gauche.fve], droite: [p1.droite.fla, p1.droite.fve] }, note: p1.p, rapport };
}
const GRILLE_A = (() => { const g = []; for (const p of [0.05, 0.15, 0.3, 0.5, 0.7, 0.85]) for (const marge of [0.5, 0.8, 0.95]) g.push({ p, marge }); return g; })();
/* Choisit les seuils sur les parties d'apprentissage seulement : notes « hors partie » (chaque partie notée par un modèle
 * appris sur les autres), seuils retenus = ceux qui posent le plus de justes (≤ 10 mm) avec 0 mauvaise voie et moins de
 * 2 % de fausses ; sinon aucune pose. */
const gainNet = m => m.juste10 - 3 * m.faux - 30 * m.mauvaiseVoie;
function choisirSeuils(evaluer, grille, parties, minPoses = 3, politique = 'sur') {
  let meilleur = null;
  for (const s of grille) {
    const ms = sommer(parties.map(p => evaluer(s, p)));
    if (ms.poses < minPoses) continue;
    if (politique === 'sur' && (ms.mauvaiseVoie > 0 || ms.faux / ms.poses >= 0.02)) continue;
    const mieux = politique === 'sur' ? (!meilleur || ms.juste10 > meilleur.m.juste10 || (ms.juste10 === meilleur.m.juste10 && ms.faux < meilleur.m.faux))
      : (!meilleur || gainNet(ms) > gainNet(meilleur.m));
    if (mieux) meilleur = { s, m: ms };
  }
  return meilleur;
}
/* Modèle de (a) : régression logistique sur les candidats + a priori d'écartement (médiane et dispersion robuste de
 * l'écartement de la pose de Mic sur les cas d'apprentissage : Mic pose la paire autour de l'écartement nominal). */
function ajusterModeleA(cas, optionsVoie) {
  const ex = exemplesA(cas, optionsVoie), m = ajusterLogistique(ex.X, ex.y), g = cas.map(c => c.reponse.ecartementMicMm).filter(fini);
  const mu = mediane(g), mad = g.length ? mediane(g.map(v => Math.abs(v - mu))) : null;
  m.ecartement = g.length >= 5 ? { mu, sigma: Math.max(3, 1.4826 * mad) } : null;
  m.positifs = somme(ex.y); m.exemples = ex.y.length;
  return m;
}
function apprendreA(partiesApp, optionsVoie, nom) {
  // partiesApp : Map partie -> cas. Modèle global + notes hors partie pour les seuils.
  const tous = [...partiesApp.values()].flat();
  const modele = ajusterModeleA(tous, optionsVoie);
  const horsPartie = new Map();
  if (partiesApp.size >= 2) for (const [p] of partiesApp) horsPartie.set(p, ajusterModeleA([...partiesApp].filter(([q]) => q !== p).flatMap(([, v]) => v), optionsVoie));
  const evaluer = (s, p) => mesurer(partiesApp.get(p).map(c => { const r = poserA(horsPartie.get(p), s, c, optionsVoie); return { cas: c, pose: r.pose }; }));
  const choix = partiesApp.size >= 2 ? choisirSeuils(evaluer, GRILLE_A, [...partiesApp.keys()]) : null;
  return { nom, modele, seuils: choix ? choix.s : null, apprentissage: choix ? choix.m : null, positifs: modele.positifs, exemples: modele.exemples };
}
function juger_A(appris, optionsVoie, cas) {
  return cas.map(c => { if (!appris.seuils) return { cas: c, pose: null, raison: 'aucun seuil sûr appris' }; const r = poserA(appris.modele, appris.seuils, c, optionsVoie); return { cas: c, pose: r.pose, raison: r.raison }; });
}
/* Témoin « pool naïf » (D-141) : meilleure paire admissible de perte cumulée la plus basse parmi les cellules fortes. */
function poserNaif(cas, elargi) {
  const sel = cote => cas.rails[cote].pool.filter(cd => cd.fort === 1 && (elargi || cd.moteur === 1)).map(cd => ({ c: cd, p: 1 / cd.perte }));
  const nG = sel('gauche'), nD = sel('droite');
  if (!nG.length || !nD.length) return { pose: null };
  const paires = [];
  for (const a of nG) for (const b of nD) { const ec = ecartementPaire(cas, [a.c.fla, a.c.fve], [b.c.fla, b.c.fve]); if (ecartementAdmissible(ec)) paires.push({ g: a.c, d: b.c, s: a.c.perte + b.c.perte }); }
  if (!paires.length) return { pose: null };
  paires.sort((x, y) => x.s - y.s);
  return { pose: { gauche: [paires[0].g.fla, paires[0].g.fve], droite: [paires[0].d.fla, paires[0].d.fve] } };
}

/* ================================================================== 5. (b) DÉCALAGE DE VOIE, MÉMOIRE DE LA SÉRIE */
/* Mémoire de la série : cas de la même série déjà corrigés par Mic (numéros plus petits), du plus récent au plus ancien.
 * Deux « voies de référence » sur lesquelles un décalage constant est cherché :
 *   D  « départ »  : la pose de départ d'ESV (la voie d'extraction) ; décalage = pose de Mic - départ, par rail ;
 *   M  « Mic »     : la voie prolongée depuis les dernières poses de Mic (droite des appuis, comme `predict` du moteur) ;
 *                    le décalage constant appris vient en plus (moyenne des erreurs passées de la prolongation).
 * Chaque base donne une prédiction [la, ve] par rail dans le repère du cut, et une dispersion (mm) : si elle dépasse la
 * porte apprise, la mémoire ne sert pas. */
function predire(cas, avant, base, K) {
  // avant : cas déjà corrigés de la même série, du plus récent au plus ancien ; on garde les K plus récents.
  const mem = avant.slice(0, K);
  if (!mem.length) return null;
  if (base === 'D') {
    const pred = {}; let plage = 0;
    for (const c of COTES) {
      const la = mem.map(m => m.reponse.mic[c][1]), ve = mem.map(m => m.reponse.mic[c][2]);
      pred[c] = [mediane(la), mediane(ve)];
      plage = Math.max(plage, Math.max(...la) - Math.min(...la), Math.max(...ve) - Math.min(...ve));
    }
    return { pred, plage, n: mem.length };
  }
  // base M : appuis = poses de Mic des cas de la mémoire, exprimées dans le repère de CE cut
  const ancres = mem.map(m => cas.voisinsMic.find(v => v.cut === m.cut)).filter(Boolean);
  if (!ancres.length) return null;
  const pred = {};
  for (const c of COTES) {
    const pts = ancres.slice(0, 2).map(a => a.mic[c]);   // [lg, la, ve]
    pred[c] = [ajusteEnZero(pts.map(p => [p[0], p[1]])), ajusteEnZero(pts.map(p => [p[0], p[2]]))];
  }
  return { pred, plage: ecartMaxCuts(cas, ancres), n: ancres.length };
}
/* Mémoire de la série + sa dispersion : plage des décalages mémorisés (base D) ou éloignement en cuts (base M) ; avec
 * `nBack` = 1, aussi l'erreur de la MÊME méthode sur le cut précédent, que Mic vient de corriger (la mémoire a-t-elle bien
 * prédit le cut d'avant ?). Tout est connu avant le cut jugé. */
function memoireSerie(cas, avant, base, K, nBack = 0) {
  const p = predire(cas, avant, base, K);
  if (!p) return null;
  let disp = p.plage;
  if (nBack > 0) {
    const dernier = avant[0], p0 = predire(dernier, avant.slice(1), base, K);
    if (!p0) disp = Infinity;
    else for (const c of COTES) disp = Math.max(disp, Math.hypot(p0.pred[c][0] - dernier.reponse.mic[c][1], p0.pred[c][1] - dernier.reponse.mic[c][2]));
  }
  return { pred: p.pred, disp, n: p.n };
}
const ecartMaxCuts = (cas, ancres) => Math.max(...ancres.map(a => Math.abs(a.ecart))) * 3;   // pénalité simple : 3 mm par cut d'éloignement
/* Droite des moindres carrés y = a + b x évaluée en x = 0 (une seule ancre : sa valeur). */
function ajusteEnZero(pts) {
  if (pts.length === 1) return pts[0][1];
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const n = pts.length, d = n * sxx - sx * sx, b = Math.abs(d) > 1e-9 ? (n * sxy - sx * sy) / d : 0;
  return (sy - b * sx) / n;
}
/* Pose par (b) : prédiction de la mémoire, puis (mode 'moteur') recalage sur l'UNIQUE candidat qualifié du pool élargi
 * près de la voie apprise, comme la reprise « depuis la voie » du lot (top ≥ 5, flanc ≥ 3, dans `tol` mm) ; (mode
 * 'brut') la prédiction elle-même. */
function poserB(params, cas, avant) {
  if (avant.length < params.minMemoire) return { pose: null, raison: 'mémoire trop courte' };
  const m = memoireSerie(cas, avant, params.base, params.K, params.nBack || 0);
  if (!m) return { pose: null, raison: 'pas de mémoire' };
  if (m.disp > params.porteDisp) return { pose: null, raison: 'série instable', disp: m.disp };
  if (params.mode === 'brut') {
    if (!ecartementAdmissible(ecartementPaire(cas, m.pred.gauche, m.pred.droite))) return { pose: null, raison: 'écartement hors contrat', disp: m.disp };
    return { pose: { gauche: m.pred.gauche, droite: m.pred.droite }, disp: m.disp };
  }
  /* Recalage : `choisirDansLePool` du module commun (candidats à `tol` mm de la voie, au moins 5 points de dessus et 3 de flanc,
   * pente non limitée, un seul minimum — minima distincts à plus de 20 mm —, écartement de la paire dans le contrat). */
  const r = voie().choisirDansLePool({ gauche: cas.rails.gauche.pool, droite: cas.rails.droite.pool }, { gauche: m.pred.gauche, droite: m.pred.droite },
    pose => ecartementAdmissible(ecartementPaire(cas, pose.gauche, pose.droite)), { tolMm: params.tol });
  return r.pose ? { pose: r.pose, disp: m.disp } : { pose: null, raison: r.raison, disp: m.disp };
}
/* Simulation en ligne d'une partie : pour chaque série, les cas dans l'ordre ; la mémoire d'un cas = les cas plus anciens
 * de la série (Mic les a corrigés). `figeK` : la mémoire est figée aux K premiers cas de la série, qui ne sont pas jugés. */
function groupesParSerie(cas) {
  const g = new Map();
  for (const c of cas) { const k = c.serie ? c.serie.id : c.cut; if (!g.has(k)) g.set(k, []); g.get(k).push(c); }
  for (const v of g.values()) v.sort((a, b) => a.cut - b.cut);
  return [...g.values()];
}
/* `propagation` : Ariane s'appuie sur SES poses. Un cut qu'elle a posé entre dans la mémoire tel qu'elle l'a posé (faux compris :
 * Mic ne le corrigera qu'après) ; seuls les cuts qu'elle a différés y entrent avec la pose de Mic. Sans propagation, Mic a tout
 * corrigé avant le cut suivant (cas idéal). La mémoire figée aux K premiers cuts reste celle de Mic. */
function croire(cas, avant, erreurs) {
  // cas déjà corrigés, vus avec la pose qu'Ariane en croit : pose de Mic + erreur de sa propre pose (en latéral et en vertical)
  const decale = (mic, err) => err ? Object.fromEntries(COTES.map(c => [c, [mic[c][0], mic[c][1] + err[c][0], mic[c][2] + err[c][1]]])) : mic;
  const voisinsMic = cas.voisinsMic.map(v => erreurs.has(v.cut) ? { ...v, mic: decale(v.mic, erreurs.get(v.cut)) } : v);
  return { cas: { ...cas, voisinsMic }, avant: avant.map(m => erreurs.has(m.cut) ? { ...m, reponse: { ...m.reponse, mic: decale(m.reponse.mic, erreurs.get(m.cut)) } } : m) };
}
function simulerB(params, cas, figeK = null, propagation = false) {
  const res = [];
  for (const serie of groupesParSerie(cas)) {
    const erreurs = new Map();
    serie.forEach((c, i) => {
      if (figeK !== null) { if (i < figeK) return; const avant = serie.slice(0, figeK).reverse(); res.push({ cas: c, ...poserB(params, c, avant) }); return; }
      const avant = serie.slice(0, i).reverse();
      const v = propagation && erreurs.size ? croire(c, avant, erreurs) : { cas: c, avant };
      const r = poserB(params, v.cas, v.avant);
      res.push({ cas: c, ...r });
      if (propagation && r.pose) erreurs.set(c.cut, Object.fromEntries(COTES.map(co => [co, [r.pose[co][0] - c.reponse.mic[co][1], r.pose[co][1] - c.reponse.mic[co][2]]])));
    });
  }
  return res;
}
/* Réglages essayés pour (b), fixés AVANT de juger et volontairement peu nombreux : chaque réglage de plus est une chance de
 * choisir par hasard sur les parties d'apprentissage. Le recalage dans le pool reprend la règle de reprise « depuis la voie »
 * du lot (`lot-decision.js` : au moins 5 points de dessus, 3 de flanc, un seul minimum près de la voie) à 15 mm. */
const GRILLE_B = (() => {
  const g = [];
  for (const base of ['D', 'M']) for (const K of [1, 2, 3]) for (const porteDisp of [3, 6, 10]) for (const nBack of [0, 1]) for (const minMemoire of [1, 2]) {
    g.push({ base, K, porteDisp, nBack, minMemoire, mode: 'brut', tol: 0 });
    g.push({ base, K, porteDisp, nBack, minMemoire, mode: 'moteur', tol: 15 });
  }
  return g;
})();
const decrireB = p => `base ${p.base === 'D' ? 'départ' : 'poses de Mic'}, ${p.K} dernier(s) cut(s), dispersion ≤ ${p.porteDisp} mm${p.nBack ? ' (cut précédent compris)' : ''}, ${p.mode === 'brut' ? 'pose à la voie apprise' : 'moteur recentré (±' + p.tol + ' mm)'}, mémoire ≥ ${p.minMemoire}`;
function apprendreB(partiesApp, politique = 'sur', propagation = false) {
  const evaluer = (p, partie) => mesurer(simulerB(p, partiesApp.get(partie), null, propagation));
  const choix = choisirSeuils(evaluer, GRILLE_B, [...partiesApp.keys()], 3, politique);
  return { params: choix ? choix.s : null, apprentissage: choix ? choix.m : null };
}

/* ================================================================== 6. (c) VOISIN LE PLUS PROCHE */
const ETAGES = ['no-anchor', 'hors-vue', 'no-qualified', 'pair-guard', 'several', 'first-pass', 'window', 'choice', 'crossing'];
function motifCode(m) { return m == null ? 0 : { candidate: 1, ambiguity: 2, 'gauge-out-of-contract': 3, flank: 4, rsf: 5, minTop: 6, slope: 7, window: 8 }[m] || 9; }
/* Descripteur numérique du contexte d'un cas (sans coordonnée, sans réponse de Mic). */
function descripteur(cas) {
  const x = cas.contexte, r = x.rails || {}, v = x.voisins || {}, s = x.s6, z = x.zone;
  const fortsM = c => cas.rails[c].pool.filter(cd => cd.moteur === 1 && cd.fort === 1).length;
  const un = (re) => (x.etage || '').concat(' ', x.raisonEtage || '').includes(re) ? 1 : 0;
  const num = (a, dflt = 0) => (a === null || a === undefined || !fini(a)) ? dflt : a;
  return [
    ...ETAGES.map(e => un(e)),
    motifCode(r.gauche && r.gauche.motif) / 9, motifCode(r.droite && r.droite.motif) / 9,
    Math.min(num(v.posesAvant), 3) / 3, Math.min(num(v.differesAvant), 3) / 3, v.plusProcheCuts == null ? 1 : Math.min(Math.abs(v.plusProcheCuts), 10) / 10,
    Math.min(num(v.ecartVoisinsMm, 15), 40) / 40, v.sansVoisins ? 1 : 0,
    Math.min(num(x.ecartement && x.ecartement.departMm, 1430), 1600) / 1600, Math.min(num(x.ecartement && x.ecartement.deniveleLocalMm, 0), 100) / 100,
    s ? Math.min(num(s.flushPct, 0), 100) / 100 : 0, z && z.pn ? 1 : 0, z && z.adv ? 1 : 0,
    Math.log10(1 + fortsM('gauche')) , Math.log10(1 + fortsM('droite')),
    Math.log10(1 + num(r.gauche && r.gauche.lossRatio, 0)), Math.log10(1 + num(r.droite && r.droite.lossRatio, 0)),
    Math.log10(1 + num(r.gauche && r.gauche.topRows, 0)), Math.log10(1 + num(r.droite && r.droite.topRows, 0)),
    Math.min(num(r.gauche && r.gauche.faceCount, 0), 40) / 40, Math.min(num(r.droite && r.droite.faceCount, 0), 40) / 40,
    cas.contexte.voie && cas.contexte.voie.lot ? 1 : 0,
  ];
}
const distance = (a, b) => Math.sqrt(a.reduce((t, v, i) => t + (v - b[i]) ** 2, 0));
/* Rang, parmi les cellules fortes du pool du moteur triées par perte, du candidat que Mic a pris (null : hors pool). */
function rangDeMic(cas, cote) {
  const rep = cas.reponse.pool[cote].moteur;
  if (!rep || rep.distMm > SEUIL_JUSTE_MM) return null;
  const fortes = cas.rails[cote].pool.map((cd, i) => ({ cd, i })).filter(o => o.cd.moteur === 1 && o.cd.fort === 1).sort((a, b) => a.cd.perte - b.cd.perte);
  const k = fortes.findIndex(o => o.i === rep.i);
  return k < 0 ? null : k;
}
function voisinsAutresParties(cas, base, k) {
  const d = descripteur(cas);
  return base.filter(o => o.cas.partie !== cas.partie).map(o => ({ o, dist: distance(d, o.d) })).sort((a, b) => a.dist - b.dist).slice(0, k);
}
/* (c, rang) : le rang choisi par les k voisins (vote) est appliqué au pool du moteur du cas à poser.
 * (c, vecteur) : décalage moyen de Mic des voisins, recalé sur l'unique candidat fort du pool élargi à moins de `tol`. */
function poserC(params, cas, base) {
  const vois = voisinsAutresParties(cas, base, params.k).filter(v => v.dist <= params.distMax);
  if (vois.length < params.k) return { pose: null, raison: 'pas assez de voisins proches' };
  if (params.mode === 'rang') {
    const pose = {};
    for (const c of COTES) {
      const votes = new Map(); for (const v of vois) { const r = v.o.rangs[c]; if (r !== null) votes.set(r, (votes.get(r) || 0) + 1); }
      let best = null; for (const [r, n] of votes) if (!best || n > best.n) best = { r, n };
      if (!best || best.n < params.accord) return { pose: null, raison: 'les voisins ne s\'accordent pas' };
      const fortes = cas.rails[c].pool.filter(cd => cd.moteur === 1 && cd.fort === 1).sort((a, b) => a.perte - b.perte);
      if (best.r >= fortes.length) return { pose: null, raison: 'rang absent du pool' };
      pose[c] = [fortes[best.r].fla, fortes[best.r].fve];
    }
    if (!ecartementAdmissible(ecartementPaire(cas, pose.gauche, pose.droite))) return { pose: null, raison: 'écartement hors contrat' };
    return { pose };
  }
  const pose = {};
  for (const c of COTES) {
    const la = vois.map(v => v.o.cas.reponse.mic[c][1]), ve = vois.map(v => v.o.cas.reponse.mic[c][2]);
    if (Math.max(...la) - Math.min(...la) > params.tol || Math.max(...ve) - Math.min(...ve) > params.tol) return { pose: null, raison: 'les voisins ne s\'accordent pas' };
    const p = [mediane(la), mediane(ve)];
    const cands = cas.rails[c].pool.filter(cd => cd.fort === 1 && Math.hypot(cd.fla - p[0], cd.fve - p[1]) <= params.tol);
    if (cands.length !== 1) return { pose: null, raison: cands.length ? 'plusieurs candidats' : 'aucun candidat près de la réponse des voisins' };
    pose[c] = [cands[0].fla, cands[0].fve];
  }
  if (!ecartementAdmissible(ecartementPaire(cas, pose.gauche, pose.droite))) return { pose: null, raison: 'écartement hors contrat' };
  return { pose };
}
const baseC = cas => cas.map(c => ({ cas: c, d: descripteur(c), rangs: { gauche: rangDeMic(c, 'gauche'), droite: rangDeMic(c, 'droite') } }));
const GRILLE_C = (() => { const g = []; for (const mode of ['rang', 'vecteur']) for (const k of [1, 3]) for (const distMax of [0.3, 0.6, 1.2, 100]) for (const accord of (mode === 'rang' ? (k === 1 ? [1] : [2, 3]) : [0])) for (const tol of (mode === 'vecteur' ? [8, 15] : [0])) g.push({ mode, k, distMax, accord, tol }); return g; })();
function apprendreC(partiesApp) {
  // Seuils choisis sans regarder la partie jugée : chaque partie d'apprentissage est posée avec pour seule mémoire les AUTRES parties d'apprentissage.
  const base = baseC([...partiesApp.values()].flat());
  const evaluer = (p, partie) => mesurer(partiesApp.get(partie).map(c => ({ cas: c, pose: poserC(p, c, base).pose || null })));
  const choix = choisirSeuils(evaluer, GRILLE_C, [...partiesApp.keys()]);
  return { params: choix ? choix.s : null, base, apprentissage: choix ? choix.m : null };
}

/* ================================================================== 7. JUGEMENT */
function juger(parties, opts = {}) {
  const propagation = !!opts.propagation;
  /* Parties réservées (manifeste des parties) : jugées, mais jamais utilisées pour apprendre. */
  const reservees = new Set((opts.reservees || []).map(Number));
  const noms = [...parties.keys()].sort((a, b) => a - b);
  if (noms.filter(p => !reservees.has(p)).length < 2) throw Error('Il faut au moins deux parties pour apprendre sur certaines et juger sur une autre' + (reservees.size ? ' (les parties réservées n\'apprennent rien)' : '') + '.');
  const methodes = {};
  const defs = [
    { id: 'naif-moteur', titre: 'témoin : pool du moteur, paire la moins chère sous contrat (D-141)' },
    { id: 'naif-elargi', titre: 'témoin : pool élargi, paire la moins chère sous contrat' },
    { id: 'a-pool', titre: '(a) choix dans le pool du moteur' },
    { id: 'a-elargi', titre: '(a) choix dans le pool élargi' },
    { id: 'a-pool-sans-seuil', titre: 'lecture : (a) pool du moteur, SANS seuil de confiance (tout est posé : qualité du classement seul)' },
    { id: 'a-elargi-sans-seuil', titre: 'lecture : (a) pool élargi, SANS seuil de confiance' },
    { id: 'b-serie', titre: '(b) décalage de voie : mémoire de la série (réglage SÛR appris sur les autres parties, série jouée en ligne)' },
    { id: 'b-serie-gain', titre: '(b) même mémoire, réglage au GAIN NET (justes - 3 fausses - 30 mauvaises voies) appris sur les autres parties : montre ce que la porte coûte' },
    { id: 'c-voisin', titre: '(c) voisin le plus proche, cas d\'autres parties' },
  ];
  for (const d of defs) methodes[d.id] = { ...d, parPartie: {}, modeles: {} };
  const serieFigee = { 1: {}, 2: {}, 3: {} };
  const optPool = { elargi: false }, optElargi = { elargi: true };
  for (const p of noms) {
    const test = parties.get(p), app = new Map(noms.filter(q => q !== p && !reservees.has(q)).map(q => [q, parties.get(q)]));
    methodes['naif-moteur'].parPartie[p] = mesurer(test.map(c => ({ cas: c, pose: poserNaif(c, false).pose })));
    methodes['naif-elargi'].parPartie[p] = mesurer(test.map(c => ({ cas: c, pose: poserNaif(c, true).pose })));
    const a1 = apprendreA(app, optPool, 'a-pool'); methodes['a-pool'].parPartie[p] = mesurer(juger_A(a1, optPool, test)); methodes['a-pool'].modeles[p] = resumeA(a1);
    const a2 = apprendreA(app, optElargi, 'a-elargi'); methodes['a-elargi'].parPartie[p] = mesurer(juger_A(a2, optElargi, test)); methodes['a-elargi'].modeles[p] = resumeA(a2);
    // Sans seuil (tout poser avec la meilleure paire notée) : qualité du CLASSEMENT seul, pour lire ce que les seuils retiennent.
    methodes['a-pool-sans-seuil'].parPartie[p] = mesurer(juger_A({ ...a1, seuils: { p: 0, marge: 0 } }, optPool, test));
    methodes['a-elargi-sans-seuil'].parPartie[p] = mesurer(juger_A({ ...a2, seuils: { p: 0, marge: 0 } }, optElargi, test));
    const b = apprendreB(app, 'sur', propagation);
    methodes['b-serie'].modeles[p] = { params: b.params, description: b.params ? decrireB(b.params) : 'aucun réglage sûr sur les parties d\'apprentissage : aucune pose', apprentissage: b.apprentissage };
    methodes['b-serie'].parPartie[p] = b.params ? mesurer(simulerB(b.params, test, null, propagation)) : mesurer(test.map(c => ({ cas: c, pose: null })));
    for (const k of [1, 2, 3]) serieFigee[k][p] = b.params ? mesurer(simulerB(b.params, test, k)) : mesurer([]);
    const bg = apprendreB(app, 'gain', propagation);
    methodes['b-serie-gain'].modeles[p] = { params: bg.params, description: bg.params ? decrireB(bg.params) : 'aucun réglage', apprentissage: bg.apprentissage };
    methodes['b-serie-gain'].parPartie[p] = bg.params ? mesurer(simulerB(bg.params, test, null, propagation)) : mesurer(test.map(c => ({ cas: c, pose: null })));
    const c3 = apprendreC(app), baseTest = c3.base;
    methodes['c-voisin'].modeles[p] = { params: c3.params, apprentissage: c3.apprentissage };
    methodes['c-voisin'].parPartie[p] = c3.params ? mesurer(test.map(c => ({ cas: c, pose: poserC(c3.params, c, baseTest).pose || null }))) : mesurer(test.map(c => ({ cas: c, pose: null })));
  }
  // « b puis a » : la mémoire de la série d'abord, sinon le choix dans le pool du moteur (réglages appris hors partie)
  methodes['b-puis-a'] = { id: 'b-puis-a', titre: '(b) puis (a) : mémoire de la série si elle sait poser, sinon choix dans le pool du moteur', parPartie: {}, modeles: {} };
  for (const p of noms) {
    const test = parties.get(p), app = new Map(noms.filter(q => q !== p && !reservees.has(q)).map(q => [q, parties.get(q)])), a1 = apprendreA(app, optPool, 'a-pool'), pb = methodes['b-serie'].modeles[p].params;
    const rb = pb ? new Map(simulerB(pb, test, null, propagation).map(r => [r.cas, r])) : new Map();
    methodes['b-puis-a'].parPartie[p] = mesurer(test.map(c => { const b = rb.get(c); if (b && b.pose) return { cas: c, pose: b.pose }; return juger_A(a1, optPool, [c])[0]; }));
  }
  for (const m of Object.values(methodes)) m.total = sommer(Object.values(m.parPartie));
  const parSerie = jugerBParSerie(parties, 8, 'sur', propagation, reservees), parSerieGain = jugerBParSerie(parties, 8, 'gain', propagation, reservees);
  const figee = {}; for (const k of [1, 2, 3]) figee[k] = { parPartie: serieFigee[k], total: sommer(Object.values(serieFigee[k])) };
  // Potentiel : où Mic se trouve-t-il par rapport au pool ?
  const potentiel = {};
  for (const p of noms) potentiel[p] = potentielPool(parties.get(p));
  return { format: FORMAT_RAPPORT, propagation, reservees: [...reservees].sort((a, b) => a - b), bParSerie: parSerie, bParSerieGain: parSerieGain, parties: Object.fromEntries(noms.map(p => [p, { cas: parties.get(p).length, series: groupesParSerie(parties.get(p)).length }])), methodes, serieFigee: figee, potentiel,
    seuils: { justeMm: SEUIL_JUSTE_MM, fauxMm: SEUIL_FAUX_MM, mauvaiseVoieMm: SEUIL_MAUVAISE_VOIE_MM, porteFaux: PORTE_FAUX } };
}
/* (b), second protocole : « série par série ». Chaque série est jugée à son tour avec le réglage choisi sur TOUTES LES AUTRES
 * séries (de toutes les parties, la sienne comprise pour les autres séries) ; la série jugée est jouée en ligne. Plus riche
 * que le protocole « partie par partie » (qui prive la partie 1 de ses longues séries), mais moins sévère : les autres
 * séries d'une même partie ressemblent à la série jugée. Les deux protocoles sont donnés. */
function jugerBParSerie(parties, minPoses = 8, politique = 'sur', propagation = false, reservees = new Set()) {
  const series = [];
  for (const [p, cas] of parties) for (const g of groupesParSerie(cas)) series.push({ partie: p, id: g[0].serie ? g[0].serie.id : g[0].cut, cas: g });
  const table = series.map(se => GRILLE_B.map(prm => mesurer(simulerB(prm, se.cas, null, propagation))));
  const choisir = exclu => {
    let best = null;
    GRILLE_B.forEach((prm, gi) => {
      const ms = sommer(table.filter((_, si) => si !== exclu && !reservees.has(series[si].partie)).map(t => t[gi]));
      if (ms.poses < minPoses) return;
      if (politique === 'sur' && (ms.mauvaiseVoie > 0 || ms.faux / ms.poses >= 0.02)) return;
      const mieux = politique === 'sur' ? (!best || ms.juste10 > best.m.juste10 || (ms.juste10 === best.m.juste10 && ms.faux < best.m.faux)) : (!best || gainNet(ms) > gainNet(best.m));
      if (mieux) best = { prm, m: ms };
    });
    return best;
  };
  const parPartie = {}, figee = { 1: {}, 2: {}, 3: {} }, reglages = [], parLong = { '1 à 2': [], '3 à 7': [], '8 et plus': [] };
  series.forEach((se, si) => {
    const ch = choisir(si);
    reglages.push({ partie: se.partie, serie: se.id, cas: se.cas.length, reglage: ch ? decrireB(ch.prm) : null });
    const m = ch ? mesurer(simulerB(ch.prm, se.cas, null, propagation)) : mesurer(se.cas.map(c => ({ cas: c, pose: null })));
    (parPartie[se.partie] = parPartie[se.partie] || []).push(m);
    parLong[se.cas.length <= 2 ? '1 à 2' : se.cas.length <= 7 ? '3 à 7' : '8 et plus'].push(m);
    for (const k of [1, 2, 3]) (figee[k][se.partie] = figee[k][se.partie] || []).push(ch ? mesurer(simulerB(ch.prm, se.cas, k)) : mesurer([]));
  });
  const agr = o => Object.fromEntries(Object.entries(o).map(([p, v]) => [p, sommer(v)]));
  const compte = new Map(); for (const r of reglages) if (r.reglage) compte.set(r.reglage, (compte.get(r.reglage) || 0) + 1);
  const frequents = [...compte].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([reglage, series]) => ({ reglage, series }));
  const parPartieAgr = agr(parPartie), figeeAgr = Object.fromEntries([1, 2, 3].map(k => [k, { parPartie: agr(figee[k]), total: sommer(Object.values(agr(figee[k]))) }]));
  return { parPartie: parPartieAgr, total: sommer(Object.values(parPartieAgr)), parLongueur: Object.fromEntries(Object.entries(parLong).map(([k, v]) => [k, { series: v.length, ...sommer(v) }])), serieFigee: figeeAgr, reglagesFrequents: frequents, series: series.length };
}
function resumeA(a) {
  const noms = NOMS_TRAITS_A;
  return { seuils: a.seuils, exemples: a.exemples, positifs: a.positifs, apprentissage: a.apprentissage, ecartement: a.modele.ecartement ? { mu: arrondi(a.modele.ecartement.mu, 1), sigma: arrondi(a.modele.ecartement.sigma, 1) } : null,
    poids: a.modele.w.map((w, i) => ({ trait: noms[i], poids: arrondi(w, 2) })).sort((x, y) => Math.abs(y.poids) - Math.abs(x.poids)).slice(0, 6) };
}
/* Part des cas dont les deux rails ont un candidat à moins de 5 / 10 mm de Mic, dans le pool du moteur et dans le pool élargi. */
function potentielPool(cas) {
  const r = { cas: cas.length };
  for (const [nom, cle] of [['moteur', 'moteur'], ['elargi', 'elargi']]) for (const s of [5, 10]) {
    r[`${nom}${s}`] = cas.filter(c => COTES.every(co => c.reponse.pool[co][cle] && c.reponse.pool[co][cle].distMm <= s)).length;
  }
  const lot = cas.filter(c => c.contexte.voie && c.contexte.voie.lot && c.contexte.voie.lot.pos).map(c => Math.max(...COTES.map(co => Math.hypot(c.contexte.voie.lot.pos[co][0] - c.reponse.mic[co][1], c.contexte.voie.lot.pos[co][1] - c.reponse.mic[co][2]))));
  r.voieLot = { cas: lot.length, juste5: lot.filter(e => e <= 5).length, juste10: lot.filter(e => e <= 10).length, plus50: lot.filter(e => e > 50).length, mediane: arrondi(mediane(lot), 1) };
  r.moteurFort10 = cas.filter(c => COTES.every(co => { const t = c.rails[co].pool.filter(cd => cd.moteur === 1 && cd.fort === 1).some(cd => Math.hypot(cd.fla - c.reponse.mic[co][1], cd.fve - c.reponse.mic[co][2]) <= 10); return t; })).length;
  return r;
}

/* ================================================================== 7 bis. CONCORDANCE AVEC L'OMBRE DE L'ÉCHO */
/* Réglage de l'ombre de l'Écho (`memoire-differes-ombre`) : celui que G1 a retenu hors partie (D-148), fixé dans le module commun :
 * voie prolongée depuis les poses de l'opérateur, 3 derniers cuts corrigés, dispersion ≤ 10 mm, moteur recentré à 15 mm. */
const REGLAGE_OMBRE = (() => { const M = require(path.join(racine(), 'src', 'voie-recentree.js'));
  return { base: 'M', K: M.MEMOIRE_SERIE.K, porteDisp: M.MEMOIRE_SERIE.porteDispersionMm, nBack: 0, minMemoire: 1, mode: 'moteur', tol: M.POOL.tolMm }; })();
/* Les deux formes du recentrage, cas par cas, avec la mémoire de l'Écho (idéale : l'opérateur a corrigé tous les cuts précédents de
 * la série avant le cut) :
 *   - « pool » : (b) hors ligne, recalage dans le pool élargi du cas (`poserB`, réglage de l'ombre) ;
 *   - « moteur » : l'ombre de l'extension (`evaluerEcho` du module commun) sur le VRAI nuage du cut, appuis = poses de l'opérateur
 *     des cuts de la mémoire, ramenées en positions de scène par la pose de départ du cut.
 * `captureDe(cut)` rend la capture (rails, points, visibilité) ou rien. Rend { lignes, resume } ; chaque ligne garde l'événement
 * que l'Écho aurait consigné (poids). Aucune pose de l'opérateur n'entre dans la décision du cut jugé. */
function concorder(casListe, captureDe, { Shadow, reglage = REGLAGE_OMBRE, seuilConcordanceMm = 3, journal = () => {} } = {}) {
  const V = voie(), L = require(path.join(racine(), 'src', 'lot-decision.js'));
  const lignes = [];
  for (const serie of groupesParSerie(casListe)) {
    serie.forEach((c, i) => {
      const avant = serie.slice(0, i).reverse(), pool = poserB(reglage, c, avant);
      const ligne = { partie: c.partie, cut: c.cut, serie: c.serie || null, memoire: null, pool: { pose: pool.pose || null, raison: pool.raison || null }, moteur: { etage: null, pose: null, raison: null } };
      const cap = captureDe(c.cut);
      if (!cap) ligne.memoire = 'sans-nuage';
      else {
        const identity = { ...(cap.identity || {}), part: c.partie, cut: c.cut };
        const validees = avant.map((m, k) => {
          const v = c.voisinsMic.find(x => x.cut === m.cut); if (!v) return null;
          return { identity: { part: c.partie, cut: m.cut, frameId: identity.frameId ?? null }, visitIndex: avant.length - k,
            positions: { left: L.positionOf(cap.rails.left, v.mic.gauche.map(x => x / 1000)), right: L.positionOf(cap.rails.right, v.mic.droite.map(x => x / 1000)) } };
        }).filter(Boolean);
        const t0 = Date.now();
        const { evenement } = V.evaluerEcho({ entree: { identity, rails: cap.rails, points: cap.pointsSceneRelative, visible: cap.visibleByClipBoxes }, differes: serie.map(x => x.cut), validees, Shadow });
        ligne.memoire = evenement.etat; ligne.evenement = { ...evenement, ms: Date.now() - t0 };
        ligne.moteur = { etage: evenement.etage || null, pose: evenement.verdict.posable ? { gauche: evenement.poseMm.left.slice(1), droite: evenement.poseMm.right.slice(1) } : null, raison: evenement.verdict.raison };
        journal(`concordance cut ${c.cut} : mémoire ${evenement.etat}, moteur ${evenement.etage || '—'}`);
      }
      const mic = { left: c.reponse.mic.gauche, right: c.reponse.mic.droite };
      const enPose = p => p ? { left: p.gauche, right: p.droite } : null;
      ligne.ecartPoolMm = ligne.pool.pose ? arrondi(V.ecartPose(enPose(ligne.pool.pose), mic), 1) : null;
      ligne.ecartMoteurMm = ligne.moteur.pose ? arrondi(V.ecartPose(enPose(ligne.moteur.pose), mic), 1) : null;
      ligne.jugementPool = ligne.pool.pose ? V.juger(ligne.ecartPoolMm) : 'abstenue';
      ligne.jugementMoteur = ligne.moteur.pose ? V.juger(ligne.ecartMoteurMm) : 'abstenue';
      ligne.ecartEntreMm = ligne.pool.pose && ligne.moteur.pose ? arrondi(Math.max(...COTES.map(co => Math.hypot(ligne.pool.pose[co][0] - ligne.moteur.pose[co][0], ligne.pool.pose[co][1] - ligne.moteur.pose[co][1]))), 1) : null;
      lignes.push(ligne);
    });
  }
  const compte = (cle) => { const o = { posees: 0, juste5: 0, juste10: 0, fausse: 0, mauvaiseVoie: 0 }; for (const l of lignes) { const j = l[cle]; if (j === 'abstenue') continue; o.posees++; if (j === 'juste5') { o.juste5++; o.juste10++; } else if (j === 'juste10') o.juste10++; else if (j === 'fausse') o.fausse++; else if (j === 'mauvaise-voie') o.mauvaiseVoie++; } return o; };
  const deux = lignes.filter(l => l.ecartEntreMm !== null), evts = lignes.filter(l => l.evenement).map(l => JSON.stringify({ eventId: '00000000-0000-4000-8000-000000000000', timestamp: '2026-01-01T00:00:00.000Z', type: 'memoire-differes-ombre', schema: 1,
    nativeSessionId: '00000000-0000-4000-8000-000000000000', observationPeriodId: '00000000-0000-4000-8000-000000000000', visitId: '00000000-0000-4000-8000-000000000000', visitIndex: 0, ...l.evenement }));
  const octets = evts.reduce((n, x) => n + Buffer.byteLength(x) + 1, 0), etats = {};
  for (const l of lignes) etats[l.memoire] = (etats[l.memoire] || 0) + 1;
  const resume = { cas: lignes.length, etats, lesDeuxPosent: deux.length, concordantes: deux.filter(l => l.ecartEntreMm <= seuilConcordanceMm).length, seuilConcordanceMm,
    ecartEntre: { mediane: arrondi(mediane(deux.map(l => l.ecartEntreMm)), 1), p90: arrondi(quantile(deux.map(l => l.ecartEntreMm), 0.9), 1), max: deux.length ? Math.max(...deux.map(l => l.ecartEntreMm)) : null },
    poolSeul: lignes.filter(l => l.pool.pose && !l.moteur.pose).length, moteurSeul: lignes.filter(l => !l.pool.pose && l.moteur.pose).length,
    pool: compte('jugementPool'), moteur: compte('jugementMoteur'),
    evenements: { n: evts.length, octetsJson: octets, octetsParEvenement: evts.length ? Math.round(octets / evts.length) : 0, octetsGzip: evts.length ? require('node:zlib').gzipSync(evts.join('\n') + '\n').length : 0 } };
  return { lignes, resume, evenements: evts };
}
function texteConcordance(r) {
  const o = [], s = r.resume, m = x => `${x.posees} posées · ≤5 mm ${x.juste5} · ≤10 mm ${x.juste10} · fausses ${x.fausse} · mauvaise voie ${x.mauvaiseVoie}`;
  o.push(`CONCORDANCE — ombre de l'Écho (moteur recentré, vrai nuage) contre (b) hors ligne (pool), mémoire idéale, réglage de l'ombre`);
  o.push(`Cas : ${s.cas} · mémoire : ${Object.entries(s.etats).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  o.push(`Les deux posent : ${s.lesDeuxPosent}, dont ${s.concordantes} à ≤ ${s.seuilConcordanceMm} mm l'une de l'autre (écart médian ${fr(s.ecartEntre.mediane)} mm, P90 ${fr(s.ecartEntre.p90)}, max ${fr(s.ecartEntre.max)}) · pool seul ${s.poolSeul} · moteur seul ${s.moteurSeul}`);
  o.push(`  pool   : ${m(s.pool)}`); o.push(`  moteur : ${m(s.moteur)}`);
  o.push(`Événements memoire-differes-ombre : ${s.evenements.n}, ${s.evenements.octetsJson} octets (${s.evenements.octetsParEvenement} par événement, ${s.evenements.octetsGzip} compressés)`);
  return o.join('\n') + '\n';
}

/* ================================================================== 8. RAPPORT */
function ligneMesure(m) {
  return `${String(m.poses).padStart(3)} posées · ≤5 mm : ${String(m.juste5).padStart(3)} · ≤10 mm : ${String(m.juste10).padStart(3)} · fausses (>10) : ${String(m.faux).padStart(2)} (${pct(m.tauxFaux)}, borne haute ${pct(m.fauxHaut95)}) · mauvaise voie (>50) : ${m.mauvaiseVoie} · abstentions : ${m.abstentions}/${m.cas} · porte ${m.porte ? 'tenue' : 'NON tenue'}`;
}
function texte(r) {
  const o = [];
  o.push(`MÉMOIRE DES DIFFÉRÉS — jugement hors ligne (${r.format})`);
  o.push(`Parties : ${Object.entries(r.parties).map(([p, v]) => `${p} (${v.cas} cas, ${v.series} séries)`).join(' · ')}`);
  if (r.reservees && r.reservees.length) o.push(`Parties réservées, jugées sans réglage (elles n'apprennent rien) : ${r.reservees.join(', ')}`);
  o.push(`Mémoire de la série : ${r.propagation ? 'AVEC propagation (Ariane s\'appuie sur ses propres poses ; Mic ne corrige que les cuts différés)' : 'idéale (Mic a corrigé tous les cuts précédents de la série)'}.`);
  o.push(`Seuils : juste ≤ ${r.seuils.justeMm} mm, faux > ${r.seuils.fauxMm} mm, mauvaise voie > ${r.seuils.mauvaiseVoieMm} mm. Porte : 0 mauvaise voie et moins de ${pct(r.seuils.porteFaux, 0)} de fausses parmi les posées.`);
  o.push('');
  o.push('Où est Mic par rapport au pool (cas dont les deux rails ont un candidat à ≤ 5 / ≤ 10 mm de sa pose)');
  for (const [p, v] of Object.entries(r.potentiel)) o.push(`  partie ${p} : pool du moteur ${v.moteur5}/${v.moteur10} · cellule forte ≤10 mm ${v.moteurFort10} · pool élargi ${v.elargi5}/${v.elargi10} sur ${v.cas} · voie du lot connue pour ${v.voieLot.cas} (≤5 mm : ${v.voieLot.juste5}, ≤10 mm : ${v.voieLot.juste10}, >50 mm : ${v.voieLot.plus50})`);
  o.push('');
  for (const m of Object.values(r.methodes)) {
    o.push(`${m.titre}`);
    o.push(`  TOTAL (parties jugées une à une, apprentissage sur les autres) : ${ligneMesure(m.total)}`);
    for (const [p, v] of Object.entries(m.parPartie)) o.push(`    partie ${p} : ${ligneMesure(v)}`);
    for (const [p, md] of Object.entries(m.modeles)) {
      if (md && md.description) o.push(`    réglage appris hors partie ${p} : ${md.description}`);
      if (md && md.poids) o.push(`    traits dominants hors partie ${p} : ${md.poids.map(w => `${w.trait} ${w.poids >= 0 ? '+' : ''}${fr(w.poids, 2)}`).join(', ')}${md.seuils ? ` · seuils note ≥ ${fr(md.seuils.p, 2)}, marge ≥ ${fr(md.seuils.marge, 2)}` : ' · aucun seuil sûr'}`);
    }
    o.push('');
  }
  o.push('(b) à l\'intérieur d\'une série, réglage appris sur les AUTRES parties : mémoire figée aux K premiers différés corrigés par Mic (non jugés), jugement sur les suivants');
  for (const [k, v] of Object.entries(r.serieFigee)) o.push(`  K = ${k} : ${ligneMesure(v.total)}`);
  o.push('');
  const bs = r.bParSerie;
  o.push(`(b) série par série (${bs.series} séries ; chaque série jouée en ligne avec le réglage choisi sur toutes les autres séries)`);
  o.push(`  TOTAL : ${ligneMesure(bs.total)}`);
  for (const [p, v] of Object.entries(bs.parPartie)) o.push(`    partie ${p} : ${ligneMesure(v)}`);
  for (const [k, v] of Object.entries(bs.parLongueur)) o.push(`    séries de ${k} cuts (${v.series} séries) : ${ligneMesure(v)}`);
  for (const f of bs.reglagesFrequents) o.push(`    réglage le plus souvent retenu (${f.series} séries) : ${f.reglage}`);
  for (const [k, v] of Object.entries(bs.serieFigee)) o.push(`  mémoire figée aux ${k} premier(s) cut(s) de la série : ${ligneMesure(v.total)}`);
  const bg = r.bParSerieGain;
  o.push('');
  o.push(`(b) série par série, réglage au GAIN NET (justes - 3 fausses - 30 mauvaises voies), hors porte : ce que la porte coûte`);
  o.push(`  TOTAL : ${ligneMesure(bg.total)}`);
  for (const [p, v] of Object.entries(bg.parPartie)) o.push(`    partie ${p} : ${ligneMesure(v)}`);
  for (const [k, v] of Object.entries(bg.parLongueur)) o.push(`    séries de ${k} cuts (${v.series} séries) : ${ligneMesure(v)}`);
  for (const f of bg.reglagesFrequents) o.push(`    réglage le plus souvent retenu (${f.series} séries) : ${f.reglage}`);
  for (const [k, v] of Object.entries(bg.serieFigee)) o.push(`  mémoire figée aux ${k} premier(s) cut(s) de la série : ${ligneMesure(v.total)}`);
  return o.join('\n') + '\n';
}

/* ================================================================== 9. LIGNE DE COMMANDE */
function arguments_(argv) {
  const a = { cas: [], corpus: [] };
  const cmd = argv[0];
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], v = () => { if (i + 1 >= argv.length) throw Error(`${k} attend une valeur`); return argv[++i]; };
    if (k === '--cas') a.cas.push(v());
    else if (k === '--corpus') a.corpus.push(v());
    else if (k === '--partie') a.partie = Manifeste.lireDesignations(v());
    else if (k === '--juger-partie-reservee') a.jugerReservee = true;
    else if (k === '--jeu') a.jeu = v();
    else if (k === '--jointure') a.jointure = v();
    else if (k === '--diagnostic') a.diagnostic = v();
    else if (k === '--sortie') a.sortie = v();
    else if (k === '--json') a.json = v();
    else if (k === '--silencieux') a.silencieux = true;
    else if (k === '--sans-pool') a.sansPool = true;
    else if (k === '--propagation') a.propagation = true;
    else if (k === '--reprendre-pools') a.reprendrePools = v();
    else if (k === '--evenements') a.evenements = v();
    else throw Error(`argument inconnu : ${k}`);
  }
  return { cmd, ...a };
}
function executer(argv) {
  const a = arguments_(argv);
  if (a.cmd === 'construire') {
    for (const k of ['partie', 'jeu', 'jointure', 'sortie']) if (a[k] === undefined) throw Error(`--${k} requis`);
    if (a.partie.length !== 1) throw Error('--partie attend une seule partie (projet:partie)');
    const { avis } = Manifeste.controler(Manifeste.lire(), a.partie, { outil: 'memoire-differes', jugerReservee: !!a.jugerReservee });
    if (avis) process.stderr.write(avis + '\n');
    const { projet, partie } = a.partie[0];
    if (!a.corpus.length) throw Error('--corpus requis (au moins un segment)');
    const jeu = fs.readFileSync(a.jeu, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
    const jointure = JSON.parse(fs.readFileSync(a.jointure, 'utf8'));
    const diagnostic = a.diagnostic ? JSON.parse(fs.readFileSync(a.diagnostic, 'utf8')) : null;
    const corpus = rappel => { for (const f of a.corpus) { const seg = JSON.parse(fs.readFileSync(f, 'utf8')); for (const cap of seg.clouds || []) rappel(cap); } };
    const poolsRepris = a.reprendrePools ? new Map(lireCas(fs.readFileSync(a.reprendrePools, 'utf8')).cas.map(c => [c.cut, c])) : null;
    const { entete, cas } = construireCas({ partie, projet, jeu, jointure, corpus, diagnostic, sansPool: a.sansPool, poolsRepris, journal: a.silencieux ? () => {} : m => process.stderr.write(m + '\n') });
    fs.writeFileSync(a.sortie, [entete, ...cas].map(l => JSON.stringify(l)).join('\n') + '\n');
    return { texte: `partie ${partie} du projet ${projet} : ${cas.length} cas écrits (${entete.series} séries)\n`, code: 0 };
  }
  if (a.cmd === 'juger') {
    if (!a.cas.length) throw Error('--cas requis (un fichier par partie, au moins deux)');
    const entetes = [], parties = lireFichiers(a.cas, entetes);
    /* Manifeste des parties : seuls les en-têtes qui portent un projet sont contrôlés. */
    const declarees = entetes.filter(e => e && e.projet && e.partie).map(e => ({ projet: Number(e.projet), partie: Number(e.partie) }));
    const { reservees, avis } = Manifeste.controler(Manifeste.lire(), declarees, { outil: 'memoire-differes', jugerReservee: !!a.jugerReservee });
    if (avis) process.stderr.write(avis + '\n');
    const rapport = juger(parties, { propagation: !!a.propagation, reservees: reservees.map(d => d.partie) });
    if (a.json) fs.writeFileSync(a.json, JSON.stringify(rapport, null, 1));
    return { texte: a.silencieux ? '' : texte(rapport), code: 0, rapport };
  }
  if (a.cmd === 'concordance') {
    if (!a.cas.length || !a.corpus.length) throw Error('--cas et --corpus requis');
    const cas = [...lireFichiers(a.cas).values()].flat(), cuts = new Set(cas.map(c => c.cut)), captures = new Map();
    for (const f of a.corpus) { const seg = JSON.parse(fs.readFileSync(f, 'utf8')); for (const cap of seg.clouds || []) if (cuts.has(cap.cut) && !captures.has(cap.cut) && cap.rails && cap.rails.left && cap.rails.right)
      captures.set(cap.cut, { identity: cap.identity, rails: cap.rails, pointsSceneRelative: cap.pointsSceneRelative, visibleByClipBoxes: cap.visibleByClipBoxes }); }
    const r = concorder(cas, cut => captures.get(cut), { Shadow: require(path.join(racine(), 'src', 'gcv1-shadow.js')), journal: a.silencieux ? () => {} : m => process.stderr.write(m + '\n') });
    if (a.json) fs.writeFileSync(a.json, JSON.stringify({ format: 'ariane-memoire-differes-concordance-v1', resume: r.resume, lignes: r.lignes.map(({ evenement, ...l }) => l) }, null, 1));
    if (a.evenements) fs.writeFileSync(a.evenements, r.evenements.join('\n') + (r.evenements.length ? '\n' : ''));
    return { texte: texteConcordance(r), code: 0, rapport: r };
  }
  throw Error('commande attendue : construire | juger | concordance');
}

module.exports = { FORMAT_CAS, FORMAT_RAPPORT, construireCas, contexteDuJeu, numeroterSeries, lireCas, lireFichiers, erreurPose, mesurer, sommer, wilsonHaut,
  traitsCandidat, ajusterLogistique, scoreLogistique, ecartementPaire, poserNaif, apprendreA, poserA, memoireSerie, poserB, simulerB, apprendreB, descripteur, poserC, apprendreC,
  juger, potentielPool, texte, executer, baseC, concorder, texteConcordance, REGLAGE_OMBRE, rangDeMic, GRILLE_C, GRILLE_B, poolsDuRail, poolFenetre, preparerCadre, SEUIL_JUSTE_MM, SEUIL_FAUX_MM, SEUIL_MAUVAISE_VOIE_MM, PORTE_FAUX };

if (require.main === module) {
  try { const s = executer(process.argv.slice(2)); process.stdout.write(s.texte); process.exit(s.code); }
  catch (e) { process.stderr.write(`memoire-differes : ${e.message}\n`); process.exit(2); }
}
