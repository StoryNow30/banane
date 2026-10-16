#!/usr/bin/env node
'use strict';
/*
 * bruit-reference.cjs — mesure le BRUIT de la référence humaine, à partir des exports Écho existants.
 *
 * Toute la vérité terrain d'Ariane vient des corrections d'un seul opérateur (l'opérateur expert), observées par le mode
 * Écho. Les seuils « juste à 5 mm » et « juste à 10 mm » supposent que cette référence est précise à mieux que cela. Une
 * seconde relecture à l'aveugle étant impossible dans ESV, l'outil cherche le bruit dans ce qui existe déjà. Hors ligne,
 * lecture seule, aucune dépendance autre que le dépôt, rien n'est écrit sous `src/`.
 *
 *   node tools/bruit-reference.cjs --jeu <étiquette>=<dossier ou fichiers Écho, séparés par des virgules> [--jeu …]
 *        [--debutant <étiquette>]… [--partie N] [--pixel-mm 0.38] [--seuils-jeu <jeu-*.jsonl>…]
 *        [--graine N] [--sortie bruit.json] [--sans-echantillons]
 *   node tools/bruit-reference.cjs --reprendre bruit-a.json [bruit-b.json…]   (refait les statistiques, sans relire les Échos)
 *
 * Un « jeu » est un ou plusieurs exports Écho d'une même partie (plusieurs sessions possibles). `--debutant` marque un jeu
 * dont les poses de DÉPART sont celles d'un opérateur débutant, corrigées par l'opérateur expert.
 * Les six sources de bruit :
 *  1. VALIDATIONS MULTIPLES. Un cut validé plusieurs fois (dans la même visite, dans deux visites d'une même session, dans
 *     deux sessions) : écart entre deux validations consécutives, par rail, en latéral et en vertical (repère profil de la
 *     première). Les poses viennent de `humanFinalReferences` (les validations non remplacées), à défaut de
 *     `humanFinalReference` ; la dernière validation de chaque visite est corrigée par l'écriture serveur (D-143).
 *  2. REVUES. Un cut déjà validé, revu plus tard (autre visite, autre session) : ce que l'opérateur en fait (rien, validation
 *     sans mouvement, validation avec mouvement, mouvement sans validation), et la continuité entre la fin d'une visite et le
 *     début de la suivante (une rupture dit qu'autre chose que l'opérateur a bougé le rail entre les deux).
 *  3. DÉPART CONTRE RÉFÉRENCE. Écart entre la pose de départ (première visite) et la dernière validation. Pour un jeu
 *     `--debutant`, c'est l'écart du débutant à l'expert. Pour un cut non touché, la référence EST la pose de départ.
 *  4. PLANCHER DU PIXEL. Le bruit minimal dû au grain du clic : un pixel mesure `--pixel-mm` (0,38 mm à la vue habituelle).
 *  5. COHÉRENCE ENTRE VOISINS. Sur des cuts consécutifs ayant tous une référence, le résidu d'une pose contre le polynôme
 *     (degré 2) ajusté sur ses six voisins, mesuré dans les axes latéral et vertical de la voie (la géométrie lisse est
 *     absorbée par le polynôme). Variante « voie droite » : fenêtres dont la courbure sur 11 cuts est inférieure à 1/2000 m,
 *     résidu contre une droite. Le résidu normalisé (divisé par √(1+h), h étant le levier de l'ajustement) estime l'écart type
 *     d'une pose ; c'est une BORNE HAUTE du bruit (tout défaut réel de la voie y passe aussi).
 *  6. CASCADE DES CLICS (source ajoutée). `railPoseHistory` garde la pose du rail après chaque geste d'une visite. Les pas entre
 *     deux clics successifs (le premier pas part de la pose de départ, il n'est pas un clic) tombent sur le réseau des pixels :
 *     un périodogramme de Rayleigh en tire le grain réel du clic (à comparer à `--pixel-mm`), et la finesse du réglage de fin
 *     est le dernier pas d'un rail réglé en plusieurs gestes.
 * Les intervalles sont à 95 % : bootstrap par cut (ou par bloc de 20 cuts pour les voisins), Wilson pour les parts.
 * `--seuils-jeu` ajoute la sensibilité des taux « juste à 5 mm » et « juste à 10 mm » d'un jeu d'apprentissage
 * (`ariane-jeu-apprentissage-v1`) à un bruit supplémentaire de la référence, mis sur les seuls rails que l'opérateur a déplacés.
 * La sortie ne contient aucune coordonnée absolue : des numéros de partie et de cut, des écarts en millimètres.
 */
const fs = require('node:fs');
const path = require('node:path');
const J = require('./jointure-echo-orbite.cjs');

const FORMAT = 'ariane-bruit-reference-v1';
const COTES = [['gauche', 'left'], ['droite', 'right']];
const PIXEL_MM_DEFAUT = 0.38;
const SEUIL_BOUGE_MM = 0.5;          // un rail qui bouge de 0,5 mm ou plus a bougé (comme la règle « visité sans action »)
const SEUIL_TOUCHE_MM = 1;           // seuil de l'Écho pour « corrigé » (étiquettes VALIDATE_CORRECTED_*)
const COURBURE_DROITE = 1 / 2000;    // 1/m : une voie droite a un rayon d'au moins 2 000 m
const VOISINS = 3;                   // voisins de chaque côté pour le résidu
const DEMI_FENETRE_DROITE = 5;
const BLOC_CUTS = 20;
const REPLIQUES = 2000;
const DELAI_LENT_S = 5;              // deux validations espacées d'au moins 5 s : une relecture, pas une rectification du même geste

/* ------------------------------------------------------------------ numérique */
const fini = v => Number.isFinite(v);
const arr = (v, d = 2) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const quantile = J.quantile;
/* Même quantile (interpolation linéaire) sur un tableau de nombres finis, avec un tri numérique natif : les répliques du bootstrap
 * en demandent des milliers. */
function quantileRapide(valeurs, p) {
  const v = Float64Array.from(valeurs).sort(), n = v.length;
  if (!n) return null;
  const at = (n - 1) * p, lo = Math.floor(at), hi = Math.ceil(at);
  return v[lo] + (v[hi] - v[lo]) * (at - lo);
}
const vec3 = v => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(fini) ? v.slice(0, 3) : null;
const norme3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* Générateur pseudo-aléatoire reproductible (mulberry32). */
function aleatoire(graine) {
  let s = (graine >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = alea => Math.sqrt(-2 * Math.log(1 - alea())) * Math.cos(2 * Math.PI * alea());

/* Intervalle de Wilson à 95 % d'une part k/n. */
function wilson(k, n) {
  if (!n) return { n: 0, k: 0, part: null, bas: null, haut: null };
  const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { n, k, part: arr(p, 4), bas: arr(Math.max(0, (c - m) / d), 4), haut: arr(Math.min(1, (c + m) / d), 4) };
}

/* Bootstrap par grappes : `grappes` est une liste de tableaux de valeurs ; `stat` prend la liste aplatie. Rend [bas, haut] à 95 %. */
function bootstrap(grappes, stat, graine, repliques = REPLIQUES) {
  const g = grappes.filter(x => x.length);
  if (g.length < 2) return [null, null];
  const alea = aleatoire(graine), res = [];
  for (let b = 0; b < repliques; b++) {
    const tirage = [];
    for (let i = 0; i < g.length; i++) for (const v of g[Math.floor(alea() * g.length)]) tirage.push(v);
    const s = stat(tirage);
    if (fini(s)) res.push(s);
  }
  if (res.length < repliques / 2) return [null, null];
  res.sort((a, b) => a - b);
  return [arr(quantile(res, .025)), arr(quantile(res, .975))];
}
/* Statistique d'une série de valeurs groupées par grappe : médiane, P90, max, avec intervalles à 95 % (bootstrap par grappe). */
function statGrappes(grappes, graine) {
  const v = grappes.flat().filter(fini);
  const med = x => quantileRapide(x, .5), p90 = x => quantileRapide(x, .9);
  return { n: v.length, grappes: grappes.filter(g => g.length).length, mediane: arr(med(v)), icMediane: bootstrap(grappes, med, graine + 1), p90: arr(p90(v)), icP90: bootstrap(grappes, p90, graine + 2), max: v.length ? arr(Math.max(...v)) : null };
}
const rms = v => { const x = v.filter(fini); return x.length ? Math.sqrt(x.reduce((a, b) => a + b * b, 0) / x.length) : null; };

/* ------------------------------------------------------------------ poses */
const railDe = (etat, en) => etat && etat.rails && etat.rails[en] && vec3(etat.rails[en].positionSceneRelative) ? etat.rails[en] : null;
const ecartPoses = (base, fin) => {
  const o = {};
  for (const [fr, en] of COTES) {
    const e = J.ecartRail(railDe(base, en), railDe(fin, en));
    o[fr] = e && e.repere === 'profil' ? { lat: e.lateralMm, vert: e.verticalMm, long: e.longitudinalMm, d3: e.dist3dMm } : null;
  }
  return o;
};
const railsDe = ec => COTES.map(([fr]) => ec[fr]).filter(Boolean);

/* Les validations effectives d'une visite, dans l'ordre : { at, etat }. La dernière est corrigée par l'écriture serveur de
 * validation (D-143) quand elle diffère de plus de 1 mm. */
function validationsDe(visite) {
  let liste = (visite.humanFinalReferences || []).filter(h => h && !h.supersededBy && h.state);
  if (!liste.length && visite.humanFinalReference && visite.humanFinalReference.state) liste = [visite.humanFinalReference];
  liste = liste.filter(h => COTES.some(([, en]) => railDe(h.state, en)));
  liste.sort((a, b) => String(a.observedAt || '').localeCompare(String(b.observedAt || '')));
  return liste.map((h, i) => {
    let etat = h.state;
    if (i === liste.length - 1) {
      const c = J.corrigerParEcriture(visite, h);
      if (c && c.par === 'outil' && c.etat) etat = c.etat;
    }
    return { at: h.observedAt || visite.endedAt || visite.startedAt || '', etat };
  });
}
const departDe = v => v.initialObserved || v.firstObserved || null;
const finDe = v => v.finalObserved || v.lastObserved || null;
const dureeS = v => { const d = (Date.parse(v.endedAt) - Date.parse(v.startedAt)) / 1000; return fini(d) && d >= 0 ? d : null; };
const maxD3 = ec => { const r = railsDe(ec).map(x => x.d3).filter(fini); return r.length ? Math.max(...r) : null; };

/* Les cuts d'un jeu : visites rangées dans l'ordre du temps, validations effectives et poses utiles par visite. */
function preparerCuts(records, sessions, partie) {
  const par = J.echoParCut(records, sessions);
  const rang = new Map(sessions.map(s => [s.id, s.rang]));
  const cuts = [];
  for (const c of par.values()) {
    if (partie !== null && c.partie !== partie) continue;
    const visites = c.visites.map((v, i) => ({ brut: v, i, session: rang.has(v.nativeSessionId) ? rang.get(v.nativeSessionId) : 0, cle: `${v.nativeSessionId || ''}#${v.visitIndex ?? i}`,
      debut: v.startedAt || '', dureeS: dureeS(v), depart: departDe(v), fin: finDe(v), validations: validationsDe(v) }));
    cuts.push({ partie: c.partie, cut: c.cut, visites });
  }
  return cuts.sort((a, b) => a.partie - b.partie || a.cut - b.cut);
}
/* Partie la plus visitée d'un jeu (les rechargements de page laissent des visites de partie 0 ou vide). */
function partieDominante(records) {
  const n = new Map();
  for (const r of records) { const id = r.identity; if (id && Number.isInteger(id.part) && id.part > 0) n.set(id.part, (n.get(id.part) || 0) + 1); }
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/* ------------------------------------------------------------------ 1. validations multiples */
function validationsMultiples(cuts) {
  const paires = [];
  for (const c of cuts) {
    const vs = [];
    for (const v of c.visites) for (const val of v.validations) vs.push({ v, val });
    vs.sort((a, b) => String(a.val.at).localeCompare(String(b.val.at)));
    for (let k = 0; k + 1 < vs.length; k++) {
      const a = vs[k], b = vs[k + 1];
      const type = a.v.cle === b.v.cle ? 'meme-visite' : a.v.session === b.v.session ? 'meme-session' : 'sessions-differentes';
      const ec = ecartPoses(a.val.etat, b.val.etat), dt = (Date.parse(b.val.at) - Date.parse(a.val.at)) / 1000;
      if (!railsDe(ec).length) continue;
      paires.push({ partie: c.partie, cut: c.cut, type, rang: k + 1, validations: vs.length, dtS: fini(dt) ? arr(dt, 1) : null, g: ec.gauche, d: ec.droite, max3d: maxD3(ec) });
    }
  }
  return paires;
}

/* ------------------------------------------------------------------ 2. revues */
function revues(cuts, contexte = {}) {
  const lignes = [], ruptures = [];
  for (const c of cuts) {
    let dejaValide = false, dejaCorrige = false, sessionValidation = null, precedente = null;
    for (const v of c.visites) {
      if (precedente) {
        const gap = ecartPoses(precedente.fin || precedente.depart, v.depart), g = maxD3(gap);
        if (fini(g) && g > SEUIL_BOUGE_MM) ruptures.push({ partie: c.partie, cut: c.cut, mm: arr(g, 1), sessionsDifferentes: precedente.session !== v.session });
      }
      const derniere = v.validations[v.validations.length - 1] || null;
      if (dejaValide) {
        let categorie, mouvement;
        if (derniere) { mouvement = maxD3(ecartPoses(v.depart, derniere.etat)); categorie = fini(mouvement) && mouvement >= SEUIL_BOUGE_MM ? 'validation-avec-mouvement' : 'validation-sans-mouvement'; }
        else { mouvement = maxD3(ecartPoses(v.depart, v.fin)); categorie = fini(mouvement) && mouvement >= SEUIL_BOUGE_MM ? 'mouvement-sans-validation' : 'aucune-action'; }
        const ecartee = J.visiteEcartee(v.brut, contexte) || null;
        if (fini(mouvement)) lignes.push({ partie: c.partie, cut: c.cut, categorie, mouvementMm: arr(mouvement), dureeS: v.dureeS === null ? null : arr(v.dureeS, 1), ecartee,
          autreSession: sessionValidation !== null && sessionValidation !== v.session, dejaCorrige });
      }
      if (derniere) {
        dejaValide = true; sessionValidation = v.session;
        const m = maxD3(ecartPoses(v.depart, derniere.etat));
        if (fini(m) && m >= SEUIL_TOUCHE_MM) dejaCorrige = true;
      }
      precedente = v;
    }
  }
  return { lignes, ruptures };
}

/* ------------------------------------------------------------------ 3. départ contre référence */
function departContreReference(cuts) {
  const lignes = [];
  let sansReference = 0;
  for (const c of cuts) {
    const ref = c.visites.flatMap(v => v.validations.map(val => ({ v, val }))).sort((a, b) => String(a.val.at).localeCompare(String(b.val.at))).pop();
    if (!ref) { sansReference++; continue; }
    const ec = ecartPoses(c.visites[0].depart, ref.val.etat);
    if (!railsDe(ec).length) continue;
    lignes.push({ partie: c.partie, cut: c.cut, g: ec.gauche, d: ec.droite, max3d: maxD3(ec) });
  }
  return { lignes, sansReference };
}

/* ------------------------------------------------------------------ 4. plancher du pixel */
/* Un clic tombe sur un pixel de q mm : l'erreur de quantification d'un axe est uniforme sur ±q/2, d'écart type q/√12. Un rail
 * mis par un clic a deux axes (latéral, vertical) : son écart 3D efficace est q/√6. Deux clics indépendants sur le même point
 * diffèrent d'un écart type √2 fois plus grand. Un pointage à ±1 pixel (main, bord du rail flou) multiplie par 2 la largeur. */
function plancherPixel(q = PIXEL_MM_DEFAUT) {
  const axe = q / Math.sqrt(12);
  return {
    pixelMm: q,
    ecartTypeParAxeMm: arr(axe, 3), erreurMaxParAxeMm: arr(q / 2, 3), p95ParAxeMm: arr(0.95 * q / 2, 3),
    efficaceParRailMm: arr(axe * Math.SQRT2, 3), maxParRailMm: arr(q / Math.SQRT2, 3),
    deuxClicsParAxeMm: arr(axe * Math.SQRT2, 3), deuxClicsParRailMm: arr(axe * 2, 3),
    pointageUnPixelParAxeMm: arr(q / Math.sqrt(3), 3), pointageUnPixelMaxMm: arr(q * 1.5, 3),
    rapportAuSeuil5: arr(5 / (axe * 2), 0), rapportAuSeuil10: arr(10 / (axe * 2), 0),
  };
}

/* ------------------------------------------------------------------ 5. cohérence entre voisins */
/* Résout A·x = b (A symétrique définie positive, petite) par élimination de Gauss. */
function resoudre(A, b) {
  const n = b.length, M = A.map((l, i) => [...l, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    if (Math.abs(M[p][i]) < 1e-12) return null;
    [M[i], M[p]] = [M[p], M[i]];
    for (let k = i + 1; k < n; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}
/* Ajustement polynomial de degré `deg` sur les points (xs, ys) centrés en 0. Rend { a0, h, a2 } : a0 est la valeur ajustée en 0,
 * h le levier de la prédiction en 0 ([(XᵀX)⁻¹]₀₀), a2 le coefficient de x². */
function ajuster(xs, ys, deg) {
  const m = deg + 1, A = Array.from({ length: m }, () => new Array(m).fill(0)), b = new Array(m).fill(0);
  for (let k = 0; k < xs.length; k++) {
    const p = Array.from({ length: m }, (_, j) => xs[k] ** j);
    for (let i = 0; i < m; i++) { b[i] += p[i] * ys[k]; for (let j = 0; j < m; j++) A[i][j] += p[i] * p[j]; }
  }
  const c = resoudre(A, b), w = resoudre(A, Array.from({ length: m }, (_, j) => j === 0 ? 1 : 0));
  return c && w ? { a0: c[0], h: w[0], a2: m > 2 ? c[2] : 0 } : null;
}

/* Les références (pose de la dernière validation) de chaque cut, avec pour chaque rail « touché » : la référence s'écarte de la
 * pose de départ de SEUIL_TOUCHE_MM ou plus. Rend un Map cut → { g: [x,y,z], d: [x,y,z], toucheG, toucheD }. */
function referencesDe(cuts) {
  const m = new Map();
  for (const c of cuts) {
    const ref = c.visites.flatMap(v => v.validations).sort((a, b) => String(a.at).localeCompare(String(b.at))).pop();
    if (!ref) continue;
    const g = railDe(ref.etat, 'left'), d = railDe(ref.etat, 'right');
    if (!g || !d) continue;
    const dep = c.visites[0].depart, dg = railDe(dep, 'left'), dd = railDe(dep, 'right');
    m.set(c.cut, { partie: c.partie, g: vec3(g.positionSceneRelative), d: vec3(d.positionSceneRelative),
      toucheG: dg ? 1000 * norme3(vec3(dg.positionSceneRelative), vec3(g.positionSceneRelative)) >= SEUIL_TOUCHE_MM : false,
      toucheD: dd ? 1000 * norme3(vec3(dd.positionSceneRelative), vec3(d.positionSceneRelative)) >= SEUIL_TOUCHE_MM : false });
  }
  return m;
}
/* Abscisse curviligne (m) des cuts d'une suite consécutive, d'après le milieu des deux rails (horizontal). */
function abscisses(refs, cut0, cut1) {
  const s = new Map(); let acc = 0, prec = null;
  for (let k = cut0; k <= cut1; k++) {
    const r = refs.get(k); if (!r) { prec = null; continue; }
    const mid = [(r.g[0] + r.d[0]) / 2, (r.g[1] + r.d[1]) / 2];
    if (prec) acc += Math.hypot(mid[0] - prec[0], mid[1] - prec[1]);
    s.set(k, acc); prec = mid;
  }
  return s;
}
function voisins(refs, partie) {
  const cutsTries = [...refs.keys()].sort((a, b) => a - b);
  if (!cutsTries.length) return [];
  const s = abscisses(refs, cutsTries[0], cutsTries[cutsTries.length - 1]);
  const echant = [];
  const axes = (k, demi) => {                        // repère local au cut k : tangente horizontale sur ±demi cuts
    const a = refs.get(k - demi), b = refs.get(k + demi);
    const ma = [(a.g[0] + a.d[0]) / 2, (a.g[1] + a.d[1]) / 2], mb = [(b.g[0] + b.d[0]) / 2, (b.g[1] + b.d[1]) / 2];
    const n = Math.hypot(mb[0] - ma[0], mb[1] - ma[1]);
    return n > 0 ? { t: [(mb[0] - ma[0]) / n, (mb[1] - ma[1]) / n] } : null;
  };
  for (const k of cutsTries) {
    const rangee = []; for (let j = -VOISINS; j <= VOISINS; j++) rangee.push(k + j);
    if (!rangee.every(j => refs.has(j))) continue;
    const ax = axes(k, VOISINS); if (!ax) continue;
    const nl = [-ax.t[1], ax.t[0]];
    /* voie droite : courbure sur ±DEMI_FENETRE_DROITE cuts, si la fenêtre est entièrement référencée */
    let droite = null, kapLat = null, kapVert = null;
    const large = []; for (let j = -DEMI_FENETRE_DROITE; j <= DEMI_FENETRE_DROITE; j++) large.push(k + j);
    const axeL = large.every(j => refs.has(j)) ? axes(k, DEMI_FENETRE_DROITE) : null;
    const serie = (clef, ids, axe) => ids.map(j => {                  // [x', lat, vert] relatifs au cut k, pour le milieu des deux rails ou un rail
      const r = refs.get(j), p0 = refs.get(k);
      const pt = clef === 'g' ? r.g : clef === 'd' ? r.d : [(r.g[0] + r.d[0]) / 2, (r.g[1] + r.d[1]) / 2, (r.g[2] + r.d[2]) / 2];
      const q0 = clef === 'g' ? p0.g : clef === 'd' ? p0.d : [(p0.g[0] + p0.d[0]) / 2, (p0.g[1] + p0.d[1]) / 2, (p0.g[2] + p0.d[2]) / 2];
      return [s.get(j) - s.get(k), ((pt[0] - q0[0]) * axe[0] + (pt[1] - q0[1]) * axe[1]), pt[2] - q0[2]];
    });
    if (axeL) {
      const nL = [-axeL.t[1], axeL.t[0]], pts = serie('m', large, nL);
      const fl = ajuster(pts.map(p => p[0]), pts.map(p => p[1]), 2), fv = ajuster(pts.map(p => p[0]), pts.map(p => p[2]), 2);
      if (fl && fv) { kapLat = 2 * fl.a2; kapVert = 2 * fv.a2; droite = Math.abs(kapLat) < COURBURE_DROITE && Math.abs(kapVert) < COURBURE_DROITE; }
    }
    const voisinsIds = rangee.filter(j => j !== k);
    const touches = rangee.map(j => { const r = refs.get(j); return [r.toucheG, r.toucheD]; });
    for (const [clef, idx] of [['g', 0], ['d', 1], ['m', 2]]) {
      const pts = serie(clef, rangee, nl).filter((_, i) => rangee[i] !== k);
      for (const [axe, col] of [['lat', 1], ['vert', 2]]) {
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[col]);
        const f2 = ajuster(xs, ys, 2), f1 = ajuster(xs, ys, 1);
        if (!f2 || !f1) continue;
        const estRail = idx < 2;
        const nTouches = estRail ? touches.filter(t => t[idx]).length : touches.filter(t => t[0] && t[1]).length;
        const strate = nTouches === 0 ? 'aucun-touche' : nTouches === touches.length ? 'tous-touches' : 'mixte';
        echant.push({ partie, cut: k, bloc: Math.floor(k / BLOC_CUTS), serie: clef === 'g' ? 'gauche' : clef === 'd' ? 'droit' : 'milieu', axe,
          r2: arr(-1000 * f2.a0, 3), h2: arr(f2.h, 4), r1: arr(-1000 * f1.a0, 3), h1: arr(f1.h, 4),
          droite: droite === null ? null : droite, strate, centreTouche: estRail ? (idx === 0 ? refs.get(k).toucheG : refs.get(k).toucheD) : (refs.get(k).toucheG && refs.get(k).toucheD),
          kappaLat: kapLat === null ? null : arr(kapLat * 1000, 4), kappaVert: kapVert === null ? null : arr(kapVert * 1000, 4) });
      }
    }
  }
  return echant;
}
/* Écart type d'une pose estimé par les résidus normalisés (mm) : robuste (1,4826·médiane des |u|) et quadratique, avec
 * intervalle par blocs de 20 cuts. `degre` : 2 (polynôme) ou 1 (droite, voie droite). */
function sigmaVoisins(echant, degre, graine) {
  const clef = degre === 2 ? ['r2', 'h2'] : ['r1', 'h1'];
  const par = new Map();
  for (const e of echant) {
    const u = e[clef[0]] / Math.sqrt(1 + e[clef[1]]);
    if (!fini(u)) continue;
    const k = `${e.partie}|${e.bloc}`;
    if (!par.has(k)) par.set(k, []);
    par.get(k).push(u);
  }
  const grappes = [...par.values()], tous = grappes.flat();
  const robuste = x => 1.4826 * quantileRapide(x.map(Math.abs), .5), quad = x => rms(x);
  return { n: tous.length, blocs: grappes.length, sigmaRobusteMm: arr(tous.length ? robuste(tous) : null), icRobuste: bootstrap(grappes, robuste, graine + 3),
    sigmaQuadratiqueMm: arr(quad(tous)), icQuadratique: bootstrap(grappes, quad, graine + 4), p90AbsMm: arr(quantile(tous.map(Math.abs), .9)) };
}

/* ------------------------------------------------------------------ 6. cascade des clics */
const SEUIL_PAS_MM = 0.02;           // en dessous, le rail n'a pas bougé (l'autre rail a reçu le geste)
const vers = (m, d) => [0, 1, 2].map(i => m[i] * d[0] + m[4 + i] * d[1] + m[8 + i] * d[2]);
/* Les pas de chaque rail dans chaque visite : { partie, cut, rail, rang (0 = premier pas, depuis la pose de départ), n (nombre de
 * pas du rail dans la visite), lat, vert, d3 } en mm, repère profil de la pose de départ. */
function clics(cuts) {
  const pas = [];
  for (const c of cuts) for (const v of c.visites) {
    const h = v.brut.railPoseHistory;
    if (!Array.isArray(h) || !h.length || !v.depart) continue;
    for (const [fr, en] of COTES) {
      const r0 = railDe(v.depart, en), m = r0 && r0.sceneRelativeToProfileLocal;
      if (!Array.isArray(m) || m.length !== 16 || !m.every(fini)) continue;
      let prev = vec3(r0.positionSceneRelative);
      const seq = [];
      for (const e of h) {
        const p = e && e.rails && e.rails[en] && vec3(e.rails[en].positionSceneRelative);
        if (!p) continue;
        const d = [p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]], n = 1000 * Math.hypot(d[0], d[1], d[2]);
        if (n > SEUIL_PAS_MM) { const l = vers(m, d); seq.push({ lat: arr(1000 * l[1], 3), vert: arr(1000 * l[2], 3), d3: arr(n, 3) }); prev = p; }
      }
      seq.forEach((s, rang) => pas.push({ partie: c.partie, cut: c.cut, rail: fr, rang, n: seq.length, ...s }));
    }
  }
  return pas;
}
/* Concentration de valeurs sur un réseau de pas q : module moyen de exp(2iπ v/q) (Rayleigh), 1 si tout est multiple de q, de
 * l'ordre de 1/√N pour des valeurs sans réseau. */
function rayleigh(valeurs, q) {
  let c = 0, s = 0;
  for (const v of valeurs) { const a = 2 * Math.PI * v / q; c += Math.cos(a); s += Math.sin(a); }
  return valeurs.length ? Math.hypot(c, s) / valeurs.length : 0;
}
/* Meilleur pas du réseau. Un réseau de pas q est aussi un réseau de pas q/2, q/3… : parmi les maxima locaux dont la concentration
 * atteint 90 % du maximum, on garde le plus grand pas (le pixel, pas l'un de ses sous-multiples). */
function meilleurGrain(valeurs, qMin = 0.25, qMax = 0.6, pas = 0.002) {
  const liste = [];
  for (let q = qMin; q <= qMax + 1e-9; q += pas) liste.push({ q: arr(q, 3), R: rayleigh(valeurs, q) });
  const max = Math.max(...liste.map(x => x.R));
  const locaux = liste.filter((x, i) => x.R >= 0.9 * max && (i === 0 || x.R >= liste[i - 1].R) && (i === liste.length - 1 || x.R >= liste[i + 1].R));
  return locaux.length ? locaux.reduce((a, b) => b.q > a.q ? b : a) : null;
}
/* Grain du clic en mm par pixel : pas de clic à clic (rang ≥ 1) de 0,15 à 8 mm, sur les deux axes. Bootstrap par cut pour q. */
function grainDuClic(pas, graine = 1) {
  const utiles = pas.filter(p => p.rang >= 1);
  const val = (ls, axes) => ls.flatMap(p => axes.map(a => Math.abs(p[a]))).filter(x => x > 0.15 && x < 8);
  const un = (ls, axes) => {
    const v = val(ls, axes), b = meilleurGrain(v);
    return b ? { n: v.length, q: b.q, R: arr(b.R, 3), R0: arr(1 / Math.sqrt(v.length), 3), pValeur: Math.exp(-v.length * b.R * b.R), residuMm: b.R > 0 ? arr(b.q / (2 * Math.PI) * Math.sqrt(-2 * Math.log(Math.min(0.999999, b.R))), 3) : null } : { n: 0 };
  };
  const out = { pas: utiles.length, lateral: un(utiles, ['lat']), vertical: un(utiles, ['vert']), deuxAxes: un(utiles, ['lat', 'vert']) };
  const parCut = new Map();
  for (const p of utiles) { const k = `${p.partie}|${p.cut}`; if (!parCut.has(k)) parCut.set(k, []); parCut.get(k).push(p); }
  const grappes = [...parCut.values()];
  if (grappes.length >= 5 && out.deuxAxes.n >= 30) {
    const alea = aleatoire(graine + 9), qs = [];
    for (let b = 0; b < 200; b++) {
      const t = []; for (let i = 0; i < grappes.length; i++) for (const p of grappes[Math.floor(alea() * grappes.length)]) t.push(p);
      const g = meilleurGrain(val(t, ['lat', 'vert']), 0.25, 0.6, 0.004); if (g) qs.push(g.q);
    }
    qs.sort((a, b) => a - b);
    out.deuxAxes.icQ = [arr(quantile(qs, .025), 3), arr(quantile(qs, .975), 3)];
  }
  return out;
}
function resumerClics(pas, graine = 1) {
  const premiers = pas.filter(p => p.rang === 0), dernier = pas.filter(p => p.rang === p.n - 1 && p.n >= 2), premierDeMulti = pas.filter(p => p.rang === 0 && p.n >= 2);
  const g = ls => { const par = new Map(); for (const p of ls) { const k = `${p.partie}|${p.cut}`; if (!par.has(k)) par.set(k, []); par.get(k).push(p); } return [...par.values()]; };
  const n1 = premiers.filter(p => p.n === 1).length, n2 = premiers.filter(p => p.n === 2).length, n3 = premiers.filter(p => p.n >= 3).length;
  return {
    railsAvecGeste: premiers.length, unSeulGeste: wilson(n1, premiers.length), deuxGestes: n2, troisOuPlus: n3,
    premierPas: { d3: statGrappes(g(premierDeMulti).map(ls => ls.map(p => p.d3)), graine + 60) },
    dernierPas: { d3: statGrappes(g(dernier).map(ls => ls.map(p => p.d3)), graine + 61), lat: statGrappes(g(dernier).map(ls => ls.map(p => Math.abs(p.lat))), graine + 62), vert: statGrappes(g(dernier).map(ls => ls.map(p => Math.abs(p.vert))), graine + 63),
      sous1mm: wilson(dernier.filter(p => p.d3 < 1).length, dernier.length), sous2mm: wilson(dernier.filter(p => p.d3 < 2).length, dernier.length) },
    grain: grainDuClic(pas, graine),
  };
}

/* ------------------------------------------------------------------ résumés */
const CLASSES = [['identique', 0, SEUIL_BOUGE_MM], ['sous1', SEUIL_BOUGE_MM, 1], ['de1a5', 1, 5], ['de5a10', 5, 10], ['de10a25', 10, 25], ['plus25', 25, Infinity]];
/* Résumé d'une liste d'écarts par cut ({ g, d, max3d }, éventuellement `partie`/`cut`). `graine` pour les bootstraps. */
function resumerEcarts(lignes, graine = 1) {
  const utiles = lignes.filter(l => fini(l.max3d));
  const cle = l => `${l.partie}|${l.cut}`;
  const parCut = new Map();
  for (const l of utiles) { if (!parCut.has(cle(l))) parCut.set(cle(l), []); parCut.get(cle(l)).push(l); }
  const rails = l => railsDe({ gauche: l.g, droite: l.d });
  const grappes = f => [...parCut.values()].map(ls => ls.flatMap(l => f(l)));
  const n = utiles.length;
  const classes = {};
  for (const [nom, bas, haut] of CLASSES) classes[nom] = wilson(utiles.filter(l => l.max3d >= bas && l.max3d < haut).length, n);
  const bouges = grappes(l => rails(l).filter(r => r.d3 >= SEUIL_BOUGE_MM).map(r => r.d3));
  return {
    paires: n, cuts: parCut.size, rails: utiles.reduce((a, l) => a + rails(l).length, 0),
    classes, sup5: wilson(utiles.filter(l => l.max3d > 5).length, n), sup10: wilson(utiles.filter(l => l.max3d > 10).length, n),
    parRailD3: statGrappes(grappes(l => rails(l).map(r => r.d3)), graine),
    parRailLat: statGrappes(grappes(l => rails(l).map(r => Math.abs(r.lat))), graine + 10),
    parRailVert: statGrappes(grappes(l => rails(l).map(r => Math.abs(r.vert))), graine + 20),
    railsBouges: { d3: statGrappes(bouges, graine + 30), lat: statGrappes(grappes(l => rails(l).filter(r => r.d3 >= SEUIL_BOUGE_MM).map(r => Math.abs(r.lat))), graine + 40), vert: statGrappes(grappes(l => rails(l).filter(r => r.d3 >= SEUIL_BOUGE_MM).map(r => Math.abs(r.vert))), graine + 50) },
    ecartTypeParAxeMm: { lat: arr(rms(utiles.flatMap(l => rails(l).map(r => r.lat)))), vert: arr(rms(utiles.flatMap(l => rails(l).map(r => r.vert)))) },
    /* Réglage seul : les cuts de moins de 25 mm (au-delà, l'opérateur change d'objet, pas de réglage). */
    reglage: (() => {
      const gr = (f, ok) => [...parCut.values()].map(ls => ls.filter(l => l.max3d < 25).flatMap(l => rails(l).filter(ok).map(f)));
      const tous = () => true, bouge = r => r.d3 >= SEUIL_BOUGE_MM;
      return { cuts: utiles.filter(l => l.max3d < 25).length, d3: statGrappes(gr(r => r.d3, tous), graine + 70), lat: statGrappes(gr(r => Math.abs(r.lat), tous), graine + 71), vert: statGrappes(gr(r => Math.abs(r.vert), tous), graine + 72),
        bougesD3: statGrappes(gr(r => r.d3, bouge), graine + 73), bougesLat: statGrappes(gr(r => Math.abs(r.lat), bouge), graine + 74), bougesVert: statGrappes(gr(r => Math.abs(r.vert), bouge), graine + 75) };
    })(),
  };
}
/* Un écart entre DEUX mesures d'un même objet a pour variance 2σ² : l'écart type d'une mesure est celui de l'écart divisé par √2. */
function sigmaDepuisPaires(resume) {
  const r = resume.ecartTypeParAxeMm;
  return { lat: fini(r.lat) ? arr(r.lat / Math.SQRT2) : null, vert: fini(r.vert) ? arr(r.vert / Math.SQRT2) : null };
}
function resumerRevues(r) {
  const cats = ['aucune-action', 'validation-sans-mouvement', 'validation-avec-mouvement', 'mouvement-sans-validation'];
  const retenues = r.lignes.filter(l => !l.ecartee);
  const nb = (ls, c) => ls.filter(l => l.categorie === c).length;
  const bloc = ls => { const o = { revisites: ls.length }; for (const c of cats) o[c] = wilson(nb(ls, c), ls.length); o.cuts = new Set(ls.map(l => `${l.partie}|${l.cut}`)).size; o.avecMouvement = wilson(nb(ls, 'validation-avec-mouvement') + nb(ls, 'mouvement-sans-validation'), ls.length); return o; };
  const reglees = ls => ls.filter(l => l.categorie === 'validation-avec-mouvement' || l.categorie === 'mouvement-sans-validation').map(l => l.mouvementMm);
  const partout = bloc(retenues), apresCorrection = bloc(retenues.filter(l => l.dejaCorrige)), autreSession = bloc(retenues.filter(l => l.autreSession)), autreSessionApresCorrection = bloc(retenues.filter(l => l.autreSession && l.dejaCorrige)), memeSession = bloc(retenues.filter(l => !l.autreSession));
  const aucuneLongue = retenues.filter(l => l.categorie === 'aucune-action' && fini(l.dureeS) && l.dureeS >= 2).length;
  return { ecarteesParAnalyse: r.lignes.length - retenues.length, tous: partout, apresCorrection, autreSession, autreSessionApresCorrection, memeSession, aucuneActionDe2sOuPlus: aucuneLongue,
    mouvementsMm: { n: reglees(retenues).length, mediane: arr(quantile(reglees(retenues), .5)), p90: arr(quantile(reglees(retenues), .9)), max: reglees(retenues).length ? arr(Math.max(...reglees(retenues))) : null },
    ruptures: { n: r.ruptures.length, autreSession: r.ruptures.filter(x => x.sessionsDifferentes).length, liste: r.ruptures.slice(0, 50) } };
}

/* ------------------------------------------------------------------ sensibilité des seuils (jeu d'apprentissage) */
/* Lit un jeu `ariane-jeu-apprentissage-v1` (JSONL) : par cut avec référence, les corrections par rail (mm). `bouge` : l'opérateur a
 * déplacé ce rail (0,5 mm ou plus) ; sinon la référence est la pose de départ elle-même, sans nouveau clic donc sans bruit de clic. */
function lireJeu(fichier) {
  const cuts = [];
  for (const l of fs.readFileSync(fichier, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    let o; try { o = JSON.parse(l); } catch (e) { continue; }
    if (o.type !== 'cut' || !o.etiquette || o.etiquette.referenceHumaine !== 'observee' || !o.etiquette.correctionMm) continue;
    const c = o.etiquette.correctionMm, rails = ['gauche', 'droite'].map(k => c[k]).filter(r => r && fini(r.lateralMm) && fini(r.verticalMm));
    if (!rails.length) continue;
    cuts.push({ partie: o.partie, cut: o.cut, classe: o.classe, rails: rails.map(r => {
      const long = fini(r.longitudinalMm) ? r.longitudinalMm : 0;
      return { lat: r.lateralMm, vert: r.verticalMm, long, bouge: Math.hypot(long, r.lateralMm, r.verticalMm) >= SEUIL_BOUGE_MM };
    }) });
  }
  return cuts;
}
/* Part des cuts à ≤ 5 mm et ≤ 10 mm (plus grand des deux rails, distance 3D) quand la référence reçoit un bruit gaussien de
 * `sigma` mm sur chaque axe (latéral, vertical), indépendant par rail. Moyenne de `repliques` tirages. Le bruit ne touche que les
 * rails que l'opérateur a déplacés (`bouge`) : un rail laissé tel quel a pour référence la pose de départ, sans nouveau clic.
 * `tous: true` met du bruit sur tous les rails. L'écart au taux observé est, au premier ordre, ce dont le taux observé est biaisé
 * par un bruit de référence de même écart type (le taux sans bruit est le taux observé moins cet écart). */
function sensibilite(cuts, sigmas, graine = 1, repliques = 200, { tous = false } = {}) {
  const out = [];
  const part = (bruit) => {
    let a = 0, b = 0;
    for (const c of cuts) {
      const m = Math.max(...c.rails.map(r => r.bouge || tous ? Math.hypot(r.long, r.lat + bruit(), r.vert + bruit()) : Math.hypot(r.long, r.lat, r.vert)));
      if (m <= 5) a++; if (m <= 10) b++;
    }
    return [a / cuts.length, b / cuts.length];
  };
  const base = part(() => 0);
  const rails = cuts.flatMap(c => c.rails);
  for (const sigma of sigmas) {
    const alea = aleatoire(graine + Math.round(sigma * 1000)), sA = [], sB = [];
    for (let i = 0; i < repliques; i++) { const [a, b] = part(() => sigma * gauss(alea)); sA.push(a); sB.push(b); }
    const mean = x => x.reduce((p, q) => p + q, 0) / x.length, sd = x => Math.sqrt(x.reduce((p, q) => p + (q - mean(x)) ** 2, 0) / (x.length - 1));
    const zone = t => cuts.filter(c => { const m = Math.max(...c.rails.map(r => Math.hypot(r.long, r.lat, r.vert))); return Math.abs(m - t) <= sigma * Math.SQRT2; }).length;
    out.push({ sigmaMm: sigma, juste5: arr(mean(sA), 4), ecartJuste5: arr(mean(sA) - base[0], 4), sdJuste5: arr(sd(sA), 4), juste10: arr(mean(sB), 4), ecartJuste10: arr(mean(sB) - base[1], 4), sdJuste10: arr(sd(sB), 4),
      cutsZoneGrise5: zone(5), cutsZoneGrise10: zone(10) });
  }
  return { cuts: cuts.length, railsBouges: wilson(rails.filter(r => r.bouge).length, rails.length), bruitSurTousLesRails: tous, observe: { juste5: arr(base[0], 4), juste10: arr(base[1], 4) }, parSigma: out };
}

/* ------------------------------------------------------------------ analyse d'un jeu */
function analyserJeu(etiquette, entrees, { debutant = false, partie = null, graine = 1, journal = () => {} } = {}) {
  const echo = J.lireEcho(entrees, { journal });
  const p = partie !== null ? partie : partieDominante(echo.records);
  const contexte = { pagesPerdues: echo.pagesPerdues, capturesParVisite: echo.capturesParVisite };
  const cuts = preparerCuts(echo.records, echo.sessions, p);
  const refs = referencesDe(cuts);
  return {
    etiquette, debutant, partie: p, sources: { segments: echo.segments.length, sessions: echo.sessions.length, records: echo.records.length, cuts: cuts.length,
      cutsAvecValidation: cuts.filter(c => c.visites.some(v => v.validations.length)).length, cutsPlusieursSessions: cuts.filter(c => new Set(c.visites.map(v => v.session)).size > 1).length },
    echantillons: { validations: validationsMultiples(cuts), revues: revues(cuts, contexte), depart: departContreReference(cuts), voisins: voisins(refs, p), clics: clics(cuts) },
    graine,
  };
}

/* ------------------------------------------------------------------ synthèse */
function resumerJeu(j, graine = 1) {
  const val = j.echantillons.validations, rev = j.echantillons.revues, dep = j.echantillons.depart, vo = j.echantillons.voisins;
  const parType = {};
  for (const t of ['meme-visite', 'meme-session', 'sessions-differentes']) { const ls = val.filter(x => x.type === t); parType[t] = { paires: ls.length, resume: ls.length ? resumerEcarts(ls, graine) : null }; }
  const valRes = val.length ? resumerEcarts(val, graine) : null;
  const rapides = val.filter(x => !(x.dtS >= DELAI_LENT_S)), lentes = val.filter(x => x.dtS >= DELAI_LENT_S);
  const parDelai = { delaiLentS: DELAI_LENT_S, rapides: { paires: rapides.length, resume: rapides.length ? resumerEcarts(rapides, graine) : null }, lentes: { paires: lentes.length, resume: lentes.length ? resumerEcarts(lentes, graine) : null } };
  return {
    etiquette: j.etiquette, debutant: j.debutant, partie: j.partie, sources: j.sources,
    validationsMultiples: { cutsConcernes: new Set(val.map(x => `${x.partie}|${x.cut}`)).size, tous: valRes, parDelai, sigmaParAxeSiRejugement: valRes ? sigmaDepuisPaires(valRes) : null, parType },
    revues: resumerRevues(rev),
    departContreReference: { sansReference: dep.sansReference, resume: dep.lignes.length ? resumerEcarts(dep.lignes, graine) : null },
    voisins: resumerVoisins(vo, graine),
    clics: (j.echantillons.clics || []).length ? resumerClics(j.echantillons.clics, graine) : null,
  };
}
function resumerVoisins(vo, graine) {
  if (!vo.length) return null;
  const sel = (f) => vo.filter(f);
  const bloc = (ls, degre) => ({ lat: sigmaVoisins(ls.filter(e => e.axe === 'lat'), degre, graine), vert: sigmaVoisins(ls.filter(e => e.axe === 'vert'), degre, graine) });
  const rails = sel(e => e.serie !== 'milieu'), milieu = sel(e => e.serie === 'milieu');
  const out = {
    fenetres: new Set(vo.map(e => `${e.partie}|${e.cut}`)).size,
    polynome: { tous: bloc(rails, 2), milieuDesRails: bloc(milieu, 2) },
    parStrate: {},
  };
  for (const s of ['aucun-touche', 'mixte', 'tous-touches']) out.parStrate[s] = { fenetres: new Set(rails.filter(e => e.strate === s).map(e => `${e.partie}|${e.cut}`)).size, ...bloc(rails.filter(e => e.strate === s), 2) };
  const droites = rails.filter(e => e.droite === true);
  out.voieDroite = { fenetres: new Set(droites.map(e => `${e.partie}|${e.cut}`)).size, droite: bloc(droites, 1), polynome: bloc(droites, 2),
    parStrate: Object.fromEntries(['aucun-touche', 'mixte', 'tous-touches'].map(s => [s, { fenetres: new Set(droites.filter(e => e.strate === s).map(e => `${e.partie}|${e.cut}`)).size, ...bloc(droites.filter(e => e.strate === s), 1) }])) };
  return out;
}
/* Rassemble plusieurs jeux en un jeu « cumul » (mêmes échantillons concaténés, cuts distingués par jeu). */
function cumuler(jeux, etiquette = 'cumul') {
  const out = { etiquette, debutant: false, partie: null, sources: {}, echantillons: { validations: [], revues: { lignes: [], ruptures: [] }, depart: { lignes: [], sansReference: 0 }, voisins: [], clics: [] }, graine: 1 };
  jeux.forEach((j, i) => {
    const marque = x => ({ ...x, partie: `${j.etiquette}:${x.partie}` });
    out.echantillons.validations.push(...j.echantillons.validations.map(marque));
    out.echantillons.revues.lignes.push(...j.echantillons.revues.lignes.map(marque));
    out.echantillons.revues.ruptures.push(...j.echantillons.revues.ruptures.map(marque));
    out.echantillons.depart.lignes.push(...j.echantillons.depart.lignes.map(marque));
    out.echantillons.depart.sansReference += j.echantillons.depart.sansReference;
    out.echantillons.voisins.push(...j.echantillons.voisins.map(marque));
    out.echantillons.clics.push(...(j.echantillons.clics || []).map(marque));
    for (const [k, v] of Object.entries(j.sources)) out.sources[k] = (out.sources[k] || 0) + v;
  });
  return out;
}

function synthese(jeux, options = {}) {
  const graine = options.graine || 1;
  const experts = jeux.filter(j => !j.debutant), debutants = jeux.filter(j => j.debutant);
  const res = {
    format: FORMAT, graine, pixel: plancherPixel(options.pixelMm || PIXEL_MM_DEFAUT),
    jeux: jeux.map(j => resumerJeu(j, graine)),
    cumulTous: jeux.length > 1 ? resumerJeu(cumuler(jeux, 'tous'), graine) : null,
    cumulExpert: experts.length > 1 ? resumerJeu(cumuler(experts, 'expert'), graine) : null,
    cumulDebutant: debutants.length > 1 ? resumerJeu(cumuler(debutants, 'debutant'), graine) : null,
  };
  if (options.seuilsJeu && options.seuilsJeu.length) {
    const sigmas = options.sigmas || [0.25, 0.5, 1, 1.5, 2, 3];
    res.sensibiliteSeuils = options.seuilsJeu.map(f => {
      const tous = lireJeu(f), posees = tous.filter(c => c.classe === 'posee');
      return { jeu: path.basename(f), toutesClasses: tous.length ? sensibilite(tous, sigmas, graine) : null, posees: posees.length ? sensibilite(posees, sigmas, graine) : null };
    });
  }
  return res;
}

/* ------------------------------------------------------------------ texte */
const f = v => v === null || v === undefined ? '—' : String(v);
const ic = a => a && a[0] !== null ? `[${a[0]} ; ${a[1]}]` : '[—]';
const pc = w => w && w.part !== null ? `${(100 * w.part).toFixed(1)} % (${w.k}/${w.n}, IC ${(100 * w.bas).toFixed(1)}–${(100 * w.haut).toFixed(1)})` : '—';
const lig = (nom, s) => s && s.n ? `${nom} : n=${s.n} (${s.grappes} cuts), médiane ${f(s.mediane)} ${ic(s.icMediane)}, P90 ${f(s.p90)} ${ic(s.icP90)}, max ${f(s.max)} mm` : `${nom} : n=0`;
function texteEcarts(r, indent = '  ') {
  if (!r) return [`${indent}aucune donnée`];
  const L = [];
  L.push(`${indent}${r.paires} écarts sur ${r.cuts} cuts (${r.rails} rails)`);
  L.push(`${indent}classes (plus grand des deux rails, 3D) : identique <0,5 mm ${pc(r.classes.identique)} ; 0,5–1 ${pc(r.classes.sous1)} ; 1–5 ${pc(r.classes.de1a5)} ; 5–10 ${pc(r.classes.de5a10)} ; 10–25 ${pc(r.classes.de10a25)} ; ≥25 ${pc(r.classes.plus25)}`);
  L.push(`${indent}> 5 mm : ${pc(r.sup5)} ; > 10 mm : ${pc(r.sup10)}`);
  L.push(`${indent}${lig('tous les rails, 3D', r.parRailD3)}`);
  L.push(`${indent}${lig('tous les rails, |latéral|', r.parRailLat)}`);
  L.push(`${indent}${lig('tous les rails, |vertical|', r.parRailVert)}`);
  L.push(`${indent}${lig('rails bougés (≥0,5 mm), 3D', r.railsBouges.d3)}`);
  L.push(`${indent}${lig('rails bougés, |latéral|', r.railsBouges.lat)}`);
  L.push(`${indent}${lig('rails bougés, |vertical|', r.railsBouges.vert)}`);
  L.push(`${indent}écart type brut par axe : latéral ${f(r.ecartTypeParAxeMm.lat)} mm, vertical ${f(r.ecartTypeParAxeMm.vert)} mm`);
  L.push(`${indent}réglage seul (cuts de moins de 25 mm : ${r.reglage.cuts}) : ${lig('rails, 3D', r.reglage.d3)}`);
  L.push(`${indent}  ${lig('rails bougés, |latéral|', r.reglage.bougesLat)}`);
  L.push(`${indent}  ${lig('rails bougés, |vertical|', r.reglage.bougesVert)}`);
  return L;
}
function texteVoisins(v) {
  if (!v) return ['  aucune fenêtre de 7 cuts consécutifs référencés'];
  const s = x => `${f(x.sigmaRobusteMm)} ${ic(x.icRobuste)} / quad. ${f(x.sigmaQuadratiqueMm)} ${ic(x.icQuadratique)} (n=${x.n}, ${x.blocs} blocs)`;
  const L = [`  ${v.fenetres} cuts centres de fenêtre`];
  L.push(`  polynôme, rails : latéral ${s(v.polynome.tous.lat)} ; vertical ${s(v.polynome.tous.vert)}`);
  L.push(`  polynôme, milieu des deux rails : latéral ${s(v.polynome.milieuDesRails.lat)} ; vertical ${s(v.polynome.milieuDesRails.vert)}`);
  for (const [k, x] of Object.entries(v.parStrate)) L.push(`  strate ${k} (${x.fenetres} cuts) : latéral ${s(x.lat)} ; vertical ${s(x.vert)}`);
  L.push(`  voie droite (${v.voieDroite.fenetres} cuts), droite : latéral ${s(v.voieDroite.droite.lat)} ; vertical ${s(v.voieDroite.droite.vert)}`);
  for (const [k, x] of Object.entries(v.voieDroite.parStrate)) L.push(`  voie droite, strate ${k} (${x.fenetres} cuts) : latéral ${s(x.lat)} ; vertical ${s(x.vert)}`);
  return L;
}
function texteClics(c) {
  if (!c) return ['6. Cascade des clics : aucun relevé de pose par geste dans cet export'];
  const g = c.grain, u = x => x && x.n ? `q=${x.q} mm, R=${x.R} (sans réseau ~${x.R0}), n=${x.n}, résidu ~${f(x.residuMm)} mm` : 'n=0';
  const L = [`6. Cascade des clics : ${c.railsAvecGeste} rails déplacés à la main ; réglés en un seul geste ${pc(c.unSeulGeste)} ; deux gestes ${c.deuxGestes} ; trois ou plus ${c.troisOuPlus}`];
  L.push(`  ${lig('premier pas (rails à ≥2 gestes), 3D', c.premierPas.d3)}`);
  L.push(`  ${lig('dernier pas (rails à ≥2 gestes), 3D', c.dernierPas.d3)}`);
  L.push(`  ${lig('dernier pas, |latéral|', c.dernierPas.lat)}`);
  L.push(`  ${lig('dernier pas, |vertical|', c.dernierPas.vert)}`);
  L.push(`  dernier pas sous 1 mm : ${pc(c.dernierPas.sous1mm)} ; sous 2 mm : ${pc(c.dernierPas.sous2mm)}`);
  L.push(`  grain mesuré (pas de clic à clic, ${g.pas} pas) : latéral ${u(g.lateral)} ; vertical ${u(g.vertical)} ; deux axes ${u(g.deuxAxes)}${g.deuxAxes.icQ ? ` IC ${ic(g.deuxAxes.icQ)}` : ''}`);
  return L;
}
function texteJeu(j) {
  const L = [`=== Jeu « ${j.etiquette} »${j.debutant ? ' (départ : débutant)' : ''}, partie ${f(j.partie)} : ${JSON.stringify(j.sources)}`];
  const vm = j.validationsMultiples;
  L.push(`1. Validations multiples : ${vm.cutsConcernes} cuts, ${vm.tous ? vm.tous.paires : 0} paires`);
  if (vm.tous) { L.push(...texteEcarts(vm.tous)); L.push(`  écart type d'une pose si chaque paire est un rejugement (écart/√2) : latéral ${f(vm.sigmaParAxeSiRejugement.lat)}, vertical ${f(vm.sigmaParAxeSiRejugement.vert)} mm`); }
  for (const [t, x] of Object.entries(vm.parDelai)) if (x && x.resume) L.push(`  validations ${t === 'rapides' ? `rapprochées (moins de ${vm.parDelai.delaiLentS} s)` : `espacées (${vm.parDelai.delaiLentS} s ou plus)`} : ${x.paires} paires ; identiques ${pc(x.resume.classes.identique)} ; > 5 mm ${pc(x.resume.sup5)} ; ${lig('rails, 3D', x.resume.parRailD3)}`);
  for (const [t, x] of Object.entries(vm.parType)) if (x.paires) L.push(`  type ${t} : ${x.paires} paires, médiane 3D par rail ${f(x.resume.parRailD3.mediane)}, max ${f(x.resume.parRailD3.max)} mm, identiques ${pc(x.resume.classes.identique)}`);
  const rv = j.revues;
  L.push(`2. Revues : ${rv.tous.revisites} revisites de cuts déjà validés (${rv.tous.cuts} cuts), ${rv.ecarteesParAnalyse} écartées (rechargement de page, captures vides)`);
  for (const [nom, b] of [['toutes', rv.tous], ['après une correction', rv.apresCorrection], ['autre session', rv.autreSession], ['autre session, cut corrigé avant', rv.autreSessionApresCorrection], ['même session', rv.memeSession]])
    L.push(`  ${nom} : ${b.revisites} revisites ; aucune action ${pc(b['aucune-action'])} ; validation sans mouvement ${pc(b['validation-sans-mouvement'])} ; validation avec mouvement ${pc(b['validation-avec-mouvement'])} ; mouvement sans validation ${pc(b['mouvement-sans-validation'])}`);
  L.push(`  mouvements à la revue : n=${rv.mouvementsMm.n}, médiane ${f(rv.mouvementsMm.mediane)}, P90 ${f(rv.mouvementsMm.p90)}, max ${f(rv.mouvementsMm.max)} mm ; ruptures de continuité : ${rv.ruptures.n} (dont ${rv.ruptures.autreSession} entre sessions)`);
  const d = j.departContreReference;
  L.push(`3. Départ contre référence${j.debutant ? ' (débutant contre expert)' : ''} : ${d.resume ? d.resume.cuts : 0} cuts avec référence, ${d.sansReference} sans`);
  L.push(...texteEcarts(d.resume));
  L.push('5. Cohérence entre voisins (écart type d\'une pose, mm : robuste [IC] / quadratique [IC])');
  L.push(...texteVoisins(j.voisins));
  L.push(...texteClics(j.clics));
  return L;
}
function texte(res) {
  const p = res.pixel, L = [];
  L.push(`Bruit de la référence humaine (format ${res.format}, graine ${res.graine})`, '');
  L.push(`4. Plancher du pixel (${p.pixelMm} mm par pixel) : écart type ${p.ecartTypeParAxeMm} mm par axe (erreur max ${p.erreurMaxParAxeMm}), ${p.efficaceParRailMm} mm par rail (latéral + vertical) ; deux clics au même point : ${p.deuxClicsParAxeMm} mm par axe, ${p.deuxClicsParRailMm} mm par rail ; pointage à ±1 pixel : ${p.pointageUnPixelParAxeMm} mm par axe (max ${p.pointageUnPixelMaxMm}) ; le seuil de 5 mm vaut ${p.rapportAuSeuil5} fois l'écart type par rail de deux clics, celui de 10 mm ${p.rapportAuSeuil10} fois`, '');
  for (const j of res.jeux) { L.push(...texteJeu(j), ''); }
  if (res.cumulTous) { L.push('--- CUMUL DE TOUS LES JEUX (même opérateur expert partout)', ...texteJeu(res.cumulTous), ''); }
  if (res.cumulExpert) { L.push('--- CUMUL DES JEUX DONT LE DÉPART EST ARIANE OU ESV', ...texteJeu(res.cumulExpert), ''); }
  if (res.cumulDebutant) { L.push('--- CUMUL DES JEUX À DÉPART DÉBUTANT', ...texteJeu(res.cumulDebutant), ''); }
  for (const s of res.sensibiliteSeuils || []) {
    L.push(`Sensibilité des seuils, jeu ${s.jeu}`);
    for (const [nom, b] of [['cuts posés', s.posees], ['toutes classes', s.toutesClasses]]) {
      if (!b) continue;
      L.push(`  ${nom} (${b.cuts} cuts, rails déplacés par l'opérateur : ${pc(b.railsBouges)}) : observé juste à 5 mm ${(100 * b.observe.juste5).toFixed(1)} %, juste à 10 mm ${(100 * b.observe.juste10).toFixed(1)} %`);
      for (const x of b.parSigma) L.push(`    bruit sur les rails déplacés σ=${x.sigmaMm} mm par axe : juste à 5 mm ${(100 * x.juste5).toFixed(1)} % (${x.ecartJuste5 >= 0 ? '+' : ''}${(100 * x.ecartJuste5).toFixed(2)} pt, ±${(100 * x.sdJuste5).toFixed(2)}), juste à 10 mm ${(100 * x.juste10).toFixed(1)} % (${x.ecartJuste10 >= 0 ? '+' : ''}${(100 * x.ecartJuste10).toFixed(2)} pt) ; cuts à moins de σ√2 du seuil : ${x.cutsZoneGrise5} (5 mm), ${x.cutsZoneGrise10} (10 mm)`);
    }
    L.push('');
  }
  return L.join('\n');
}

/* ------------------------------------------------------------------ ligne de commande */
const USAGE = 'Usage : node tools/bruit-reference.cjs --jeu <étiquette>=<chemin[,chemin…]> [--jeu …] [--debutant <étiquette>]… [--partie N] [--pixel-mm 0.38] [--seuils-jeu <jeu.jsonl>…] [--graine N] [--sortie f.json] [--sans-echantillons]\n   ou : node tools/bruit-reference.cjs --reprendre <f.json>…';
function lireArguments(argv) {
  const a = { jeux: [], debutants: new Set(), partie: null, pixelMm: PIXEL_MM_DEFAUT, seuilsJeu: [], graine: 1, sortie: null, sansEchantillons: false, reprendre: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--jeu') { const m = /^([^=]+)=(.+)$/.exec(argv[++i] || ''); if (!m) throw Error('--jeu attend étiquette=chemin[,chemin…].'); a.jeux.push({ etiquette: m[1], entrees: m[2].split(',').filter(Boolean) }); }
    else if (k === '--debutant') a.debutants.add(argv[++i]);
    else if (k === '--partie') { a.partie = Number(argv[++i]); if (!Number.isInteger(a.partie)) throw Error('--partie attend un entier.'); }
    else if (k === '--pixel-mm') { a.pixelMm = Number(argv[++i]); if (!(a.pixelMm > 0)) throw Error('--pixel-mm attend un nombre positif.'); }
    else if (k === '--graine') { a.graine = Number(argv[++i]); if (!Number.isInteger(a.graine)) throw Error('--graine attend un entier.'); }
    else if (k === '--seuils-jeu') { while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) a.seuilsJeu.push(argv[++i]); }
    else if (k === '--reprendre') { while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) a.reprendre.push(argv[++i]); }
    else if (k === '--sortie') a.sortie = argv[++i];
    else if (k === '--sans-echantillons') a.sansEchantillons = true;
    else throw Error(`Argument inconnu : ${k}`);
  }
  if (!a.jeux.length && !a.reprendre.length) throw Error(USAGE);
  for (const e of a.debutants) if (!a.jeux.some(j => j.etiquette === e) && !a.reprendre.length) throw Error(`--debutant : aucun jeu « ${e} ».`);
  return a;
}
function executer(argv, sortie = console.log) {
  const a = lireArguments(argv), avis = [];
  let jeux = [];
  for (const r of a.reprendre) { const doc = JSON.parse(fs.readFileSync(r, 'utf8')); if (doc.format !== FORMAT || !doc.echantillons) throw Error(`${r} : pas une sortie ${FORMAT} avec échantillons.`); jeux.push(...doc.echantillons); }
  for (const j of a.jeux) jeux.push(analyserJeu(j.etiquette, j.entrees, { debutant: a.debutants.has(j.etiquette), partie: a.partie, graine: a.graine, journal: m => avis.push(m) }));
  const res = synthese(jeux, { graine: a.graine, pixelMm: a.pixelMm, seuilsJeu: a.seuilsJeu });
  if (a.sortie) {
    fs.mkdirSync(path.dirname(path.resolve(a.sortie)), { recursive: true });
    fs.writeFileSync(a.sortie, JSON.stringify(a.sansEchantillons ? res : { ...res, echantillons: jeux }, null, 1));
  }
  sortie([...avis, texte(res)].join('\n'));
  return res;
}
if (require.main === module) {
  try { executer(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { FORMAT, PIXEL_MM_DEFAUT, clics, rayleigh, meilleurGrain, grainDuClic, resumerClics, wilson, bootstrap, aleatoire, plancherPixel, ajuster, validationsDe, preparerCuts, validationsMultiples, revues, departContreReference, referencesDe, voisins, sigmaVoisins,
  resumerEcarts, resumerRevues, lireJeu, sensibilite, analyserJeu, resumerJeu, cumuler, synthese, texte, lireArguments, executer };
