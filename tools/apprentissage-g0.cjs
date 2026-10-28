#!/usr/bin/env node
'use strict';
/*
 * apprentissage-g0.cjs — PREMIÈRE ÉTUDE D'APPRENTISSAGE du « méga cerveau » (lot G0 du cahier 5.0).
 * Outil hors ligne, lecture seule, sans dépendance, rien sous src/. Il lit des jeux JSON lignes
 * `ariane-jeu-apprentissage-v1` (tools/jeu-apprentissage.cjs, enrichis ou non, voir fiches/G0_APPRENTISSAGE_V1.md)
 * et répond à quatre questions, sans rien changer à l'extension :
 *
 *   Q1  Faux verts d'Ariane (posé puis corrigé de plus de 10 mm, et de plus de 5 mm) : quels traits les prédisent ?
 *       Mesure de chaque trait seul (AUC, taux par tranche), petit modèle lisible (régression logistique et arbre de
 *       profondeur 2), validation croisée PAR PARTIE (jamais apprendre et juger sur la même), rappel à 5 % et à 10 %
 *       des cuts signalés avec intervalle d'amorçage. Porte du cahier : au moins 60 % des fautes dans 5 % des cuts.
 *   Q2  Détecteur de passage à niveau (PN) : flushPct et traits de la liste contre les PN donnés par l'opérateur ; marge
 *       recommandée avant et après.
 *   Q3  Détecteur d'erreur d'extraction dans un PN : « écartement de la pose de départ à plus de T mm de la médiane
 *       de la partie » ; seuil appris sur une partie, jugé sur l'autre ; effet sur les verts d'extraction.
 *   Q4  Correction verticale apprise : le biais vertical résiduel d'Ariane est-il prévisible, de signe stable, et
 *       que gagne une correction apprise sur une partie et appliquée à l'autre ?
 *
 *   node tools/apprentissage-g0.cjs --jeu a.jsonl --jeu b.jsonl [--jeu c.jsonl …]
 *        [--questions 1,2,3,4] [--seuil-visite 0.8] [--bootstrap 500] [--graine 20261016]
 *        [--json sortie.json] [--silencieux]
 *        [--partie PROJET:PARTIE[,PROJET:PARTIE…] [--juger-partie-reservee]]
 *
 * `--partie` déclare les parties que contiennent les jeux ; une partie réservée par le manifeste des parties
 * (datasets/manifeste-parties.json, B1 de l'audit 5.0) est refusée, sauf avec `--juger-partie-reservee` : l'étude est
 * alors un JUGEMENT, aucun réglage ne doit être modifié d'après ses résultats.
 *
 * Les parties sont reconnues à leur champ `partie`. Une partie « Ariane » porte des traits d'Ariane (lot Orbite) ; une
 * partie « humaine » (poses de départ d'un opérateur, source `humain*`) n'en porte pas. Les traits absents sont
 * simplement ignorés : un trait n'entre dans un modèle que s'il est renseigné (≥ 60 % des cuts évalués) dans TOUTES les
 * parties concernées (apprentissage et jugement). Frontière anti-fuite : aucun trait ne vient de la référence humaine ;
 * tout ce qui vient de l'opérateur est sous `etiquette` (ou, pour les parties humaines, `contexte.ecartementInitialMm`, qui est
 * la pose de départ avant correction). Aucune coordonnée absolue n'est lue ni écrite.
 */
const fs = require('node:fs');
const Manifeste = require('./manifeste-parties.cjs');

const FORMAT = 'ariane-apprentissage-g0-v1';
const PARTS_SIGNALEES = [0.05, 0.10, 0.20];
const PORTE_RAPPEL = 0.60, PORTE_PART = 0.05;
const fini = Number.isFinite;

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
const arrondi = (v, d = 3) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const fr = (v, d = 1) => v === null || v === undefined || !fini(v) ? '—' : v.toFixed(d).replace('.', ',');
const pct = (v, d = 1) => v === null || v === undefined || !fini(v) ? '—' : `${(100 * v).toFixed(d).replace('.', ',')} %`;
const nonNul = v => v !== null && v !== undefined;

/* Générateur pseudo-aléatoire déterministe (mulberry32) pour l'amorçage. */
function graine(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ------------------------------------------------------------------ lecture et normalisation */
function lireTexte(texte) {
  const lignes = texte.split('\n').filter(l => l.trim());
  const entete = [], cuts = [];
  for (const l of lignes) {
    const o = JSON.parse(l);
    if (o.type === 'entete') entete.push(o); else if (o.type === 'cut') cuts.push(o);
  }
  return { entete: entete[0] || null, cuts };
}
function lireFichiers(fichiers) {
  const out = [];
  for (const f of fichiers) out.push({ fichier: f, ...lireTexte(fs.readFileSync(f, 'utf8')) });
  return out;
}

const COTES = ['gauche', 'droite'];
function parserPlage(s) {
  const m = /^(\d+)\s*[-–]\s*(\d+)/.exec(String(s));
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/* Correction d'un rail : { lon, lat, vert, d3 } ou null. */
function railCorr(c) {
  if (!c || !fini(c.verticalMm) && !fini(c.dist3dMm)) return null;
  const lon = fini(c.longitudinalMm) ? c.longitudinalMm : 0, lat = fini(c.lateralMm) ? c.lateralMm : 0, vert = fini(c.verticalMm) ? c.verticalMm : 0;
  return { lon, lat, vert, d3: fini(c.dist3dMm) ? c.dist3dMm : Math.hypot(lon, lat, vert) };
}
const ZERO = { lon: 0, lat: 0, vert: 0, d3: 0 };
const d3De = (c, dv = 0) => Math.hypot(c.lon, c.lat, c.vert - dv);

/* Normalise les lignes d'une partie en enregistrements plats. `seuilVisiteS` : règle « visité sans action = bon »
 * quand le jeu la porte sous `regleVisiteBon.appliquee` (durée de la plus longue visite dans `dwellMaxS`). */
function normaliserPartie(partie, jeux, opts = {}) {
  const seuilVisite = opts.seuilVisiteS ?? 0.8;
  const lignes = new Map();
  let entete = null, source = null;
  for (const j of jeux) {
    if (j.entete && j.entete.partie === partie) entete = { ...(entete || {}), ...j.entete };
    else if (j.entete && !entete && j.cuts.some(c => c.partie === partie)) entete = j.entete;
    for (const c of j.cuts) if (c.partie === partie) lignes.set(c.cut, c);
  }
  const rows = [...lignes.values()].sort((a, b) => a.cut - b.cut);
  const humain = rows.length > 0 && rows.every(r => !r.traits) && rows.some(r => /^humain/.test(String(r.source || (entete && entete.source) || '')));
  source = humain ? 'humain' : 'ariane';
  const recs = [];
  for (const r of rows) {
    const et = r.etiquette || {}, ctx = r.contexte || {}, rv = r.regleVisiteBon;
    let ref = et.referenceHumaine === 'observee', corr = null;
    if (ref) {
      const g = railCorr(et.correctionMm && et.correctionMm.gauche), d = railCorr(et.correctionMm && et.correctionMm.droite);
      if (g && d) corr = { gauche: g, droite: d }; else ref = false;
    } else if (et.referenceHumaine === 'sans-reference' && rv && typeof rv === 'object' && rv.appliquee && fini(rv.dwellMaxS) && rv.dwellMaxS >= seuilVisite) {
      ref = true; corr = { gauche: ZERO, droite: ZERO };
    }
    const maxD3 = corr ? Math.max(corr.gauche.d3, corr.droite.d3) : null;
    const zone = r.zone || null;
    const rec = {
      partie, cut: r.cut, classe: r.classe, source,
      posee: r.classe === 'posee', differee: r.classe === 'differee',
      ref, corr, maxD3,
      y5: ref ? maxD3 > 5 : null, y10: ref ? maxD3 > 10 : null, y25: ref ? maxD3 >= 25 : null,
      traits: r.traits || null, zone, ctx,
      propositions: r.traits && r.traits.propositionMoteur || null,
      etiquetteEcho: et.etiquetteEcho || null,
    };
    recs.push(rec);
  }
  const info = { partie, source, entete, n: recs.length };
  if (entete) {
    const z = entete.zonesFiche || null, h = entete.plagesPN || (entete.zonesMic && entete.zonesMic.PN) || null;
    info.pnPlages = [];
    if (z && z.PN) for (const p of z.PN) info.pnPlages.push({ id: p.id, controle: p.controle, passage: p.passage || null });
    else if (h) h.forEach((s, k) => { const p = parserPlage(s); if (p) info.pnPlages.push({ id: `PN${k + 1}`, controle: p, passage: null }); });
    info.advAiguilles = z && z.ADV ? z.ADV.map(a => ({ id: a.id, aiguille: a.aiguille, zone: a.zone })) : [];
  }
  poserVoisinage(recs);
  return { info, recs };
}

/* Distance au rouge le plus proche et grappe (liaison simple, trou ≤ 5 cuts) quand le jeu ne les porte pas : les
 * « rouges » sont les cuts du journal Orbite (ceux qui portent des traits d'Ariane). */
function poserVoisinage(recs) {
  const rouges = recs.filter(r => r.traits).map(r => r.cut).sort((a, b) => a - b);
  const grp = new Map();
  let g = [];
  const clore = () => { g.forEach((c, k) => grp.set(c, { taille: g.length, distBord: Math.min(k, g.length - 1 - k) })); g = []; };
  for (const c of rouges) { if (g.length && c - g[g.length - 1] > 5) clore(); g.push(c); }
  clore();
  const dist = c => { let m = Infinity; for (const x of rouges) if (x !== c) m = Math.min(m, Math.abs(x - c)); return m === Infinity ? null : m; };
  for (const r of recs) {
    if (!r.traits) continue;
    const g0 = r.traits.g0 || {};
    r.voisin = {
      distRouge: fini(g0.distRougeMin) ? g0.distRougeMin : dist(r.cut),
      grappeTaille: fini(g0.groupeTaille) ? g0.groupeTaille : (grp.get(r.cut) || {}).taille ?? null,
      grappeBord: fini(g0.groupeDistBord) ? g0.groupeDistBord : (grp.get(r.cut) || {}).distBord ?? null,
    };
  }
}

/* ------------------------------------------------------------------ traits */
const rails = r => COTES.map(c => ({ cote: c, prop: r.propositions && r.propositions[c] || null, g0: r.traits && r.traits.g0 && r.traits.g0.rails && r.traits.g0.rails[c] || null }));
const maxOuNul = v => { const w = v.filter(fini); return w.length ? Math.max(...w) : null; };
const minOuNul = v => { const w = v.filter(fini); return w.length ? Math.min(...w) : null; };
const unOuNul = v => v.some(x => x === true) ? 1 : (v.some(x => x === false) ? 0 : null);
const conventionRefusee = rl => rl.prop && rl.prop.convention === false || rl.g0 && rl.g0.conventionAppliquee === false;

/* Chaque trait : nom, libellé, calcul, imputation d'un trait absent (0 = « pas d'indice » ; 'mediane' sinon), transformation. */
const TRAITS = [
  { nom: 'distRouge', lib: 'distance au rouge le plus proche (cuts)', imp: 'mediane', log: true, f: r => r.voisin ? r.voisin.distRouge : null },
  { nom: 'grappeTaille', lib: 'taille de la grappe de rouges', imp: 'mediane', log: true, f: r => r.voisin ? r.voisin.grappeTaille : null },
  { nom: 'grappeBord', lib: 'distance au bord de la grappe (0 = au bord)', imp: 'mediane', log: true, f: r => r.voisin ? r.voisin.grappeBord : null },
  { nom: 'isole', lib: 'rouge isolé (grappe de 1)', imp: 0, bin: true, f: r => r.voisin && fini(r.voisin.grappeTaille) ? (r.voisin.grappeTaille === 1 ? 1 : 0) : null },
  { nom: 'conventionRefusee', lib: 'calage de convention refusé (un rail au moins)', imp: 0, bin: true, f: r => r.propositions ? unOuNul(rails(r).map(conventionRefusee)) : null },
  { nom: 'dzMax', lib: 'décalage vertical de convention |dz| (mm, plus grand des rails)', imp: 'mediane', log: true, f: r => r.traits && r.traits.g0 ? maxOuNul(rails(r).map(x => x.g0 && fini(x.g0.dzMm) ? Math.abs(x.g0.dzMm) : null)) : null },
  { nom: 'dzRefuse', lib: '|dz| du calage refusé (0 si appliqué)', imp: 0, log: true, f: r => r.traits && r.traits.g0 ? maxOuNul(rails(r).map(x => x.g0 && fini(x.g0.dzMm) ? (conventionRefusee(x) ? Math.abs(x.g0.dzMm) : 0) : null)) : null },
  { nom: 'confianceMin', lib: 'confiance du moteur (plus faible des rails)', imp: 'mediane', f: r => r.propositions ? minOuNul(rails(r).map(x => x.prop && fini(x.prop.confiance) ? x.prop.confiance : null)) : null },
  { nom: 'ecartVoisins', lib: 'écart aux voisins posés (M6, mm)', imp: 0, log: true, f: r => r.traits && r.traits.g0 && fini(r.traits.g0.ecartVoisinsMm) ? r.traits.g0.ecartVoisinsMm : null },
  { nom: 'ecartementHorsBande', lib: "écartement hors de la bande p5–p95 de la partie (mm)", imp: 0, log: true, f: r => r.traits && r.traits.g0 && fini(r.traits.g0.horsBandeMm) ? r.traits.g0.horsBandeMm : null },
  { nom: 's1', lib: 'rail repêché par S1 (un rail au moins)', imp: 0, bin: true, f: r => r.traits && r.traits.g0 ? unOuNul(rails(r).map(x => x.g0 ? x.g0.s1Change : null)) : null },
  { nom: 'motifHorsCandidate', lib: 'motif du moteur autre que « candidate »', imp: 0, bin: true, f: r => r.propositions ? (rails(r).some(x => x.prop && x.prop.motif && x.prop.motif !== 'candidate') ? 1 : 0) : null },
  { nom: 'etageHorsPremierPassage', lib: "étage de la décision B1 autre que le premier passage", imp: 0, bin: true, f: r => r.traits && r.traits.b1Ombre && r.traits.b1Ombre.reel ? (r.traits.b1Ombre.reel.stage && r.traits.b1Ombre.reel.stage !== 'first-pass' ? 1 : 0) : null },
  { nom: 'penteLimitee', lib: 'pente du flanc limitée (un rail au moins)', imp: 0, bin: true, f: r => r.traits && r.traits.g0 ? unOuNul(rails(r).map(x => x.g0 ? x.g0.slopeLimited : null)) : null },
  { nom: 'deplacementAriane', lib: "déplacement d'Ariane depuis la pose d'ESV (mm, 3D, plus grand des rails)", imp: 'mediane', log: true, f: r => r.traits && r.traits.deplacementAriane ? maxOuNul(COTES.map(c => r.traits.deplacementAriane[c] && r.traits.deplacementAriane[c].dist3dMm)) : null },
  { nom: 'deplacementVertical', lib: "déplacement vertical d'Ariane depuis la pose d'ESV (mm, valeur absolue, plus grand des rails)", imp: 'mediane', log: true, f: r => r.traits && r.traits.deplacementAriane ? maxOuNul(COTES.map(c => r.traits.deplacementAriane[c] && fini(r.traits.deplacementAriane[c].verticalMm) ? Math.abs(r.traits.deplacementAriane[c].verticalMm) : null)) : null },
  { nom: 'rapportPerte', lib: 'rapport de perte du gabarit (plus faible des rails)', imp: 'mediane', log: true, f: r => r.traits && r.traits.g0 ? minOuNul(rails(r).map(x => x.g0 ? x.g0.lossRatio : null)) : null },
  { nom: 'concurrentsForts', lib: 'candidats forts concurrents (plus grand des rails)', imp: 'mediane', log: true, f: r => r.traits && r.traits.g0 ? maxOuNul(rails(r).map(x => x.g0 ? x.g0.nStrongCompetitive : null)) : null },
  { nom: 'lignesHautes', lib: 'lignes du sommet vues (plus faible des rails)', imp: 'mediane', log: true, f: r => r.traits && r.traits.g0 ? minOuNul(rails(r).map(x => x.g0 ? x.g0.topRows : null)) : null },
  { nom: 'facesVues', lib: 'faces vues (plus faible des rails)', imp: 'mediane', log: true, f: r => r.traits && r.traits.g0 ? minOuNul(rails(r).map(x => x.g0 ? x.g0.faceCount : null)) : null },
  // Traits connus d'une seule partie (relevés S6 et fiche de l'opérateur) : mesurés, jamais appris entre parties.
  { nom: 'flushPct', lib: 'part de points au ras du sol (relevé S6, %)', imp: 'mediane', seul: true, f: r => r.traits && r.traits.s6 && fini(r.traits.s6.flushPct) ? r.traits.s6.flushPct : null },
  { nom: 'zonePN', lib: 'dans un PN, marges comprises (fiche de l\'opérateur)', imp: 0, bin: true, seul: true, f: r => r.zone && r.traits ? (r.zone.pn ? 1 : 0) : null },
  { nom: 'zonePNPassage', lib: 'dans le passage même du PN', imp: 0, bin: true, seul: true, f: r => r.zone && r.traits ? (r.zone.pn && r.zone.pn.role === 'passage' ? 1 : 0) : null },
  { nom: 'zoneADV', lib: "dans une zone d'ADV, marge élargie comprise", imp: 0, bin: true, seul: true, f: r => r.zone && r.traits ? (r.zone.adv ? 1 : 0) : null },
];

/* Distance à l'aiguille d'ADV : posée à part car elle dépend de l'en-tête de la partie. */
function poserTraits(partie) {
  const { info, recs } = partie;
  for (const r of recs) {
    r.t = {};
    for (const t of TRAITS) { const v = t.f(r); r.t[t.nom] = nonNul(v) && fini(v) ? v : null; }
    if (r.traits && r.zone && r.zone.adv && info.advAiguilles && info.advAiguilles.length) {
      const a = info.advAiguilles.find(x => x.id === r.zone.adv.id);
      r.t.advDistAiguille = a ? Math.abs(r.cut - a.aiguille) : null;
    } else r.t.advDistAiguille = null;
  }
  return partie;
}
const TRAITS_ZONE_ADV = { nom: 'advDistAiguille', lib: "distance à l'aiguille d'ADV (cuts, dans la zone)", imp: 'mediane', log: true, seul: true };

/* ------------------------------------------------------------------ mesures de rang */
/* AUC (probabilité qu'un faux vert ait un score plus haut qu'un bon), liens à moitié. Null si une classe manque. */
function auc(scores, y) {
  const p = [], n = [];
  scores.forEach((s, i) => { if (!fini(s) || y[i] === null) return; (y[i] ? p : n).push(s); });
  if (!p.length || !n.length) return null;
  const tous = p.map(s => [s, 1]).concat(n.map(s => [s, 0])).sort((a, b) => a[0] - b[0]);
  let sr = 0, i = 0;
  while (i < tous.length) {
    let j = i;
    while (j + 1 < tous.length && tous[j + 1][0] === tous[i][0]) j++;
    const rang = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) if (tous[k][1]) sr += rang;
    i = j + 1;
  }
  return (sr - p.length * (p.length + 1) / 2) / (p.length * n.length);
}

/* Rappel parmi les `part` meilleurs scores (ceil(part × n) cuts signalés ; un lien à la frontière compte au prorata). */
function rappelAuTop(scores, y, part) {
  const idx = scores.map((s, i) => i).filter(i => fini(scores[i]) && y[i] !== null);
  const n = idx.length, P = idx.filter(i => y[i]).length;
  const k = Math.min(n, Math.max(1, Math.ceil(part * n - 1e-9)));
  idx.sort((a, b) => scores[b] - scores[a]);
  let pris = 0, capt = 0, i = 0;
  while (i < n && pris < k) {
    let j = i;
    while (j + 1 < n && scores[idx[j + 1]] === scores[idx[i]]) j++;
    const taille = j - i + 1, pos = idx.slice(i, j + 1).filter(q => y[q]).length;
    if (pris + taille <= k) { capt += pos; pris += taille; } else { capt += pos * (k - pris) / taille; pris = k; }
    i = j + 1;
  }
  return { n, positifs: P, signales: k, partSignalee: n ? k / n : null, captures: capt, rappel: P ? capt / P : null, rappelMax: P ? Math.min(k, P) / P : null };
}

/* Plus petite part des cuts à signaler pour atteindre `cible` de rappel (liens à la frontière : on prend le groupe entier). */
function partPourRappel(scores, y, cible = PORTE_RAPPEL) {
  const idx = scores.map((s, i) => i).filter(i => fini(scores[i]) && y[i] !== null);
  const n = idx.length, P = idx.filter(i => y[i]).length;
  if (!P) return null;
  idx.sort((a, b) => scores[b] - scores[a]);
  let capt = 0, i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && scores[idx[j + 1]] === scores[idx[i]]) j++;
    capt += idx.slice(i, j + 1).filter(q => y[q]).length;
    if (capt / P >= cible - 1e-9) return (j + 1) / n;
    i = j + 1;
  }
  return 1;
}

/* Intervalle d'amorçage à 90 % de l'AUC et des rappels, en rééchantillonnant les cuts jugés. */
function amorcer(scores, y, B, rnd) {
  const idx = scores.map((s, i) => i).filter(i => fini(scores[i]) && y[i] !== null);
  const sortie = { auc: [], r5: [], r10: [] };
  if (B <= 0 || idx.length < 5) return null;
  for (let b = 0; b < B; b++) {
    const s = [], l = [];
    for (let q = 0; q < idx.length; q++) { const i = idx[Math.floor(rnd() * idx.length)]; s.push(scores[i]); l.push(y[i]); }
    if (!l.some(Boolean)) continue;
    const a = auc(s, l); if (a !== null) sortie.auc.push(a);
    sortie.r5.push(rappelAuTop(s, l, 0.05).rappel); sortie.r10.push(rappelAuTop(s, l, 0.10).rappel);
  }
  const ic = v => v.length ? [arrondi(quantile(v, 0.05), 3), arrondi(quantile(v, 0.95), 3)] : null;
  return { auc: ic(sortie.auc), rappel5: ic(sortie.r5), rappel10: ic(sortie.r10), tirages: sortie.r5.length };
}

/* ------------------------------------------------------------------ mesure de chaque trait seul */
function tranches(valeurs, k) {
  const v = valeurs.filter(fini).sort((a, b) => a - b);
  const coupes = [];
  for (let i = 1; i < k; i++) { const c = quantile(v, i / k); if (!coupes.length || c > coupes[coupes.length - 1]) coupes.push(c); }
  return coupes;
}
const tranche = (v, coupes) => { let i = 0; while (i < coupes.length && v > coupes[i]) i++; return i; };

function mesurerTrait(t, parties, cible) {
  const parPartie = {};
  const tous = [];
  for (const p of parties) {
    const R = p.recs.filter(r => r.posee && r.ref);
    const val = R.map(r => r.t[t.nom]), y = R.map(r => r[cible]);
    const dispo = val.filter(nonNul).length;
    const lignes = R.filter(r => nonNul(r.t[t.nom]));
    parPartie[p.info.partie] = {
      n: R.length, renseignes: dispo, positifs: R.filter(r => r[cible]).length,
      auc: dispo >= 20 && lignes.filter(r => r[cible]).length >= 3 && lignes.filter(r => !r[cible]).length >= 3 ? arrondi(auc(lignes.map(r => r.t[t.nom]), lignes.map(r => r[cible])), 3) : null,
    };
    tous.push(...lignes.map(r => ({ v: r.t[t.nom], y: r[cible], partie: p.info.partie })));
  }
  // Taux par tranche (sur l'ensemble des parties où le trait existe). Binaire : par valeur ; continu : 4 tranches.
  let taux = [];
  if (tous.length >= 20) {
    if (t.bin || new Set(tous.map(x => x.v)).size <= 2) {
      for (const val of [...new Set(tous.map(x => x.v))].sort((a, b) => a - b)) {
        const s = tous.filter(x => x.v === val);
        taux.push({ tranche: `= ${val}`, n: s.length, positifs: s.filter(x => x.y).length, taux: arrondi(s.filter(x => x.y).length / s.length, 3) });
      }
    } else {
      const coupes = tranches(tous.map(x => x.v), 4);
      const bornes = ['≤ ' + fr(coupes[0], 1)];
      for (let i = 1; i < coupes.length; i++) bornes.push(`${fr(coupes[i - 1], 1)} – ${fr(coupes[i], 1)}`);
      bornes.push('> ' + fr(coupes[coupes.length - 1], 1));
      const acc = bornes.map(b => ({ tranche: b, n: 0, positifs: 0 }));
      for (const x of tous) { const q = tranche(x.v, coupes); acc[q].n++; if (x.y) acc[q].positifs++; }
      taux = acc.filter(a => a.n).map(a => ({ ...a, taux: arrondi(a.positifs / a.n, 3) }));
    }
  }
  const aucs = Object.values(parPartie).map(x => x.auc).filter(nonNul);
  const ecarts = aucs.map(a => a - 0.5);
  const signeStable = aucs.length >= 2 && (ecarts.every(e => e > 0.02) || ecarts.every(e => e < -0.02));
  return { nom: t.nom, libelle: t.lib, seul: !!t.seul, parPartie, aucMoyen: aucs.length ? arrondi(moyenne(aucs), 3) : null, signeStable, taux };
}

/* ------------------------------------------------------------------ modèles lisibles */
function resoudre(A, b) {
  const n = b.length, M = A.map((l, i) => [...l, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) M[c][c] = 1e-12;
    for (let i = c + 1; i < n; i++) { const f = M[i][c] / M[c][c]; for (let j = c; j <= n; j++) M[i][j] -= f * M[c][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}
const sigmoide = z => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

/* Régression logistique à pénalité L2 (IRLS). X sans constante, w : poids des cuts. */
function ajusterLogistique(X, y, w, lambda = 1) {
  const n = X.length, p = n ? X[0].length : 0;
  const beta = new Array(p + 1).fill(0);
  const sw = somme(w), pm = somme(w.map((wi, i) => wi * (y[i] ? 1 : 0))) / sw;
  beta[0] = Math.log(Math.max(1e-6, pm) / Math.max(1e-6, 1 - pm));
  for (let it = 0; it < 60; it++) {
    const H = Array.from({ length: p + 1 }, () => new Array(p + 1).fill(0)), g = new Array(p + 1).fill(0);
    for (let i = 0; i < n; i++) {
      const x = [1, ...X[i]];
      let z = 0; for (let j = 0; j <= p; j++) z += beta[j] * x[j];
      const mu = sigmoide(z), W = w[i] * Math.max(mu * (1 - mu), 1e-6);
      for (let a = 0; a <= p; a++) { g[a] += w[i] * ((y[i] ? 1 : 0) - mu) * x[a]; for (let b = 0; b <= p; b++) H[a][b] += W * x[a] * x[b]; }
    }
    for (let j = 1; j <= p; j++) { H[j][j] += lambda; g[j] -= lambda * beta[j]; }
    const d = resoudre(H, g);
    let m = 0; for (let j = 0; j <= p; j++) { beta[j] += d[j]; m = Math.max(m, Math.abs(d[j])); }
    if (m < 1e-8) break;
  }
  return beta;
}

/* Arbre de décision de profondeur ≤ profMax (Gini pondéré). Feuilles : taux lissé. */
function ajusterArbre(X, y, w, noms, profMax = 2, minPoids = 5) {
  const gini = (pos, tot) => tot > 0 ? 2 * (pos / tot) * (1 - pos / tot) : 0;
  function noeud(idx, prof) {
    const tot = somme(idx.map(i => w[i])), pos = somme(idx.map(i => w[i] * (y[i] ? 1 : 0)));
    const feuille = { feuille: true, poids: arrondi(tot, 2), positifs: arrondi(pos, 2), p: (pos + 0.5) / (tot + 1) };
    if (prof >= profMax || idx.length < 2 * minPoids || pos === 0 || pos === tot) return feuille;
    let meilleur = null;
    for (let j = 0; j < noms.length; j++) {
      const valeurs = [...new Set(idx.map(i => X[i][j]))].sort((a, b) => a - b);
      const cands = valeurs.length <= 24 ? valeurs.slice(0, -1).map((v, q) => (v + valeurs[q + 1]) / 2) : tranches(valeurs, 24);
      for (const s of cands) {
        let wg = 0, pg = 0, wd = 0, pd = 0, ng = 0, nd = 0;
        for (const i of idx) { if (X[i][j] <= s) { wg += w[i]; pg += w[i] * (y[i] ? 1 : 0); ng++; } else { wd += w[i]; pd += w[i] * (y[i] ? 1 : 0); nd++; } }
        if (ng < minPoids || nd < minPoids) continue;
        const gain = gini(pos, tot) * tot - gini(pg, wg) * wg - gini(pd, wd) * wd;
        if (!meilleur || gain > meilleur.gain) meilleur = { gain, j, s };
      }
    }
    if (!meilleur || meilleur.gain <= 1e-9) return feuille;
    const g = idx.filter(i => X[i][meilleur.j] <= meilleur.s), d = idx.filter(i => X[i][meilleur.j] > meilleur.s);
    return { feuille: false, trait: noms[meilleur.j], j: meilleur.j, seuil: meilleur.s, gauche: noeud(g, prof + 1), droite: noeud(d, prof + 1) };
  }
  return noeud(X.map((_, i) => i), 0);
}
function predireArbre(a, x) { while (!a.feuille) a = x[a.j] <= a.seuil ? a.gauche : a.droite; return a.p; }
/* Effectifs bruts (nombre de cuts, nombre de fautes) de chaque feuille sur les cuts d'apprentissage. */
function compterFeuilles(a, X, y) {
  const feuilles = [];
  (function marquer(n) { if (n.feuille) { n.nBrut = 0; n.posBrut = 0; feuilles.push(n); } else { marquer(n.gauche); marquer(n.droite); } })(a);
  X.forEach((x, i) => { let n = a; while (!n.feuille) n = x[n.j] <= n.seuil ? n.gauche : n.droite; n.nBrut++; if (y[i]) n.posBrut++; });
}
function reglesArbre(a, decrire, chemin = []) {
  if (a.feuille) return [{ si: chemin.length ? chemin.join(' ET ') : '(toujours)', taux: arrondi(a.p, 3), poids: a.poids, positifs: a.positifs, cuts: a.nBrut, fautes: a.posBrut }];
  return [...reglesArbre(a.gauche, decrire, [...chemin, decrire(a, true)]), ...reglesArbre(a.droite, decrire, [...chemin, decrire(a, false)])];
}

/* Pipeline d'un modèle : choix des traits (signe stable, taille ≤ K), transformation, ajustement. */
function transformer(t, v, imp) {
  if (!nonNul(v)) v = imp;
  return t.log ? Math.log1p(Math.max(0, v)) : v;
}
function preparerModele(parApp, cible, traitsAutorises, opts = {}) {
  const K = opts.k ?? 4;
  const mesures = traitsAutorises.map(t => ({ t, m: mesurerTrait(t, parApp, cible) }));
  const candidats = mesures.filter(({ m }) => {
    const aucs = Object.values(m.parPartie).map(x => x.auc).filter(nonNul);
    if (!aucs.length) return false;
    const e = aucs.map(a => a - 0.5);
    if (aucs.length >= 2 && !(e.every(x => x > 0) || e.every(x => x < 0))) return false;
    return Math.abs(moyenne(e)) >= (opts.minEcart ?? 0.06);
  }).sort((a, b) => Math.abs(b.m.aucMoyen - 0.5) - Math.abs(a.m.aucMoyen - 0.5));
  // Évite les traits redondants (corrélation > 0,8 avec un trait déjà pris).
  const lignes = parApp.flatMap(p => p.recs.filter(r => r.posee && r.ref));
  const choisis = [];
  for (const c of candidats) {
    if (choisis.length >= K) break;
    const imp = impute(c.t, lignes);
    const a = lignes.map(r => transformer(c.t, r.t[c.t.nom], imp));
    const redondant = choisis.some(d => Math.abs(correlation(a, lignes.map(r => transformer(d.t, r.t[d.t.nom], d.imp)))) > 0.8);
    if (!redondant) choisis.push({ t: c.t, imp, aucMoyen: c.m.aucMoyen });
  }
  if (!choisis.length) return null;
  // Poids : chaque partie d'apprentissage compte autant, somme = nombre de cuts.
  const poids = [], X0 = [], y = [];
  for (const p of parApp) {
    const R = p.recs.filter(r => r.posee && r.ref);
    for (const r of R) { X0.push(choisis.map(c => transformer(c.t, r.t[c.t.nom], c.imp))); y.push(!!r[cible]); poids.push(1 / R.length); }
  }
  const sw = somme(poids); for (let i = 0; i < poids.length; i++) poids[i] *= X0.length / sw;
  const mu = choisis.map((_, j) => moyenne(X0.map(x => x[j]))), sd = choisis.map((_, j) => Math.sqrt(moyenne(X0.map(x => (x[j] - mu[j]) ** 2))) || 1);
  const X = X0.map(x => x.map((v, j) => (v - mu[j]) / sd[j]));
  const beta = ajusterLogistique(X, y, poids, opts.lambda ?? 2);
  const arbre = ajusterArbre(X0, y, poids, choisis.map(c => c.t.nom), 2, Math.max(5, Math.round(0.05 * X0.length)));
  compterFeuilles(arbre, X0, y);
  return {
    choisis, mu, sd, beta, arbre, n: X0.length, positifs: y.filter(Boolean).length,
    scoreLog: rec => { let z = beta[0]; choisis.forEach((c, j) => { z += beta[j + 1] * (transformer(c.t, rec.t[c.t.nom], c.imp) - mu[j]) / sd[j]; }); return sigmoide(z); },
    scoreArbre: rec => predireArbre(arbre, choisis.map(c => transformer(c.t, rec.t[c.t.nom], c.imp))),
    texte: () => ({
      logistique: choisis.map((c, j) => ({ trait: c.t.nom, libelle: c.t.lib, poids: arrondi(beta[j + 1], 3), sens: beta[j + 1] > 0 ? 'plus de risque quand il monte' : 'moins de risque quand il monte' })).sort((a, b) => Math.abs(b.poids) - Math.abs(a.poids)),
      constante: arrondi(beta[0], 3),
      arbre: reglesArbre(arbre, (n, gauche) => {
        const c = choisis[n.j], s = c.t.log ? Math.expm1(n.seuil) : n.seuil;
        const sv = c.t.bin ? '' : fr(s, 1);
        return c.t.bin ? `${c.t.nom} ${(gauche ? '= 0' : '= 1')}` : `${c.t.nom} ${gauche ? '≤' : '>'} ${sv}`;
      }),
    }),
  };
}
function impute(t, lignes) {
  if (t.imp !== 'mediane') return t.imp;
  const m = mediane(lignes.map(r => r.t[t.nom]).filter(nonNul));
  return m === null ? 0 : m;
}
function correlation(a, b) {
  const ma = moyenne(a), mb = moyenne(b);
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

/* Couverture d'un trait dans une partie : part des posés évalués où il est renseigné. */
function couverture(t, p) {
  const R = p.recs.filter(r => r.posee && r.ref);
  return R.length ? R.filter(r => nonNul(r.t[t.nom])).length / R.length : 0;
}
const COUVERTURE_MIN = 0.6;

/* ------------------------------------------------------------------ Q1 */
function evaluerScore(test, scoreFn, cible, B, rnd) {
  const R = test.recs.filter(r => r.posee && r.ref);
  const s = R.map(scoreFn), y = R.map(r => r[cible]);
  const parts = {};
  for (const q of PARTS_SIGNALEES) parts[`p${Math.round(q * 100)}`] = rappelAuTop(s, y, q);
  return { n: R.length, positifs: y.filter(Boolean).length, auc: arrondi(auc(s, y), 3), signales: parts, partPour60: arrondi(partPourRappel(s, y), 3), amorcage: amorcer(s, y, B, rnd) };
}
function questionFauxVerts(parties, opts) {
  const rnd = graine(opts.graine), B = opts.bootstrap;
  const ariane = parties.filter(p => p.info.source === 'ariane' && p.recs.some(r => r.posee && r.ref));
  const res = { parties: ariane.map(p => ({ partie: p.info.partie, posesAvecReference: p.recs.filter(r => r.posee && r.ref).length, fauxVerts10: p.recs.filter(r => r.posee && r.y10).length, corriges5: p.recs.filter(r => r.posee && r.y5).length })), cibles: {} };
  for (const cible of ['y10', 'y5']) {
    const sortie = { seuilMm: cible === 'y10' ? 10 : 5, traits: [], modeles: [], note: [] };
    // 1) Chaque trait seul (mesure descriptive, sans modèle).
    const tousTraits = TRAITS.slice();
    for (const t of tousTraits) {
      const m = mesurerTrait(t, ariane, cible);
      if (Object.values(m.parPartie).some(x => x.renseignes > 0)) sortie.traits.push(m);
    }
    if (ariane.some(p => p.recs.some(r => nonNul(r.t.advDistAiguille)))) {
      const m = mesurerTrait({ ...TRAITS_ZONE_ADV, f: null, nom: 'advDistAiguille', bin: false }, ariane, cible);
      sortie.traits.push(m);
    }
    // 2) Validation croisée par partie : A → B (A ≠ B) et « les autres → B ».
    const schemas = [];
    for (const test of ariane) {
      for (const app of ariane) if (app !== test) schemas.push({ app: [app], test });
      const autres = ariane.filter(p => p !== test);
      if (autres.length >= 2) schemas.push({ app: autres, test });
    }
    for (const sc of schemas) {
      if (sc.app.includes(sc.test)) throw new Error('validation croisée : la partie jugée figure dans l\'apprentissage');
      const concernees = sc.app.concat([sc.test]);
      const autorises = TRAITS.filter(t => !t.seul && concernees.every(p => couverture(t, p) >= COUVERTURE_MIN));
      const modele = preparerModele(sc.app, cible, autorises, { k: 4 });
      const nom = `${sc.app.map(p => p.info.partie).join('+')} → ${sc.test.info.partie}`;
      const ligne = { schema: nom, apprentissage: sc.app.map(p => p.info.partie), jugee: sc.test.info.partie };
      if (!modele) { ligne.erreur = 'aucun trait stable sur l\'apprentissage'; sortie.modeles.push(ligne); continue; }
      ligne.traitsRetenus = modele.choisis.map(c => c.t.nom);
      ligne.logistique = evaluerScore(sc.test, modele.scoreLog, cible, B, rnd);
      ligne.arbre = evaluerScore(sc.test, modele.scoreArbre, cible, B, rnd);
      // Meilleur trait seul choisi sur l'apprentissage (AUC moyenne), jugé sur l'autre partie.
      const seuls = autorises.map(t => ({ t, m: mesurerTrait(t, sc.app, cible) })).filter(x => x.m.aucMoyen !== null).sort((a, b) => Math.abs(b.m.aucMoyen - 0.5) - Math.abs(a.m.aucMoyen - 0.5));
      if (seuls.length) {
        const { t, m } = seuls[0], dir = m.aucMoyen >= 0.5 ? 1 : -1, imp = impute(t, sc.app.flatMap(p => p.recs.filter(r => r.posee && r.ref)));
        ligne.meilleurTraitSeul = { trait: t.nom, sens: dir > 0 ? 'haut = risque' : 'bas = risque', ...evaluerScore(sc.test, r => dir * transformer(t, r.t[t.nom], imp), cible, 0, rnd) };
      }
      // Référence M6 (score de suspicion de coherence-voisins) quand le jeu le porte.
      if (sc.test.recs.some(r => r.traits && r.traits.g0 && fini(r.traits.g0.scoreM6))) {
        ligne.scoreM6 = evaluerScore(sc.test, r => r.traits && r.traits.g0 && fini(r.traits.g0.scoreM6) ? r.traits.g0.scoreM6 : 0, cible, B, rnd);
      }
      ligne.hasard = { rappel5: PARTS_SIGNALEES[0], rappel10: PARTS_SIGNALEES[1] };
      ligne.modele = modele.texte();
      sortie.modeles.push(ligne);
    }
    // 3) Modèle d'ensemble (toutes les parties) : à lire, NON jugé (apprendre et juger sur les mêmes parties est interdit).
    const concernees = ariane;
    const autorises = TRAITS.filter(t => !t.seul && concernees.every(p => couverture(t, p) >= COUVERTURE_MIN));
    const tout = preparerModele(ariane, cible, autorises, { k: 4 });
    sortie.modeleEnsemble = tout ? { note: 'appris sur toutes les parties ; il n\'est pas jugé (sa valeur est celle des validations croisées ci-dessus)', traitsRetenus: tout.choisis.map(c => c.t.nom), ...tout.texte() } : null;
    // 4) Synthèse « les autres → B » : captures cumulées si chaque partie est signalée à 5 % / 10 % de ses cuts.
    const loo = sortie.modeles.filter(m => m.apprentissage && m.apprentissage.length >= 2 && m.logistique);
    if (loo.length) {
      const cumul = k => ({ captures: arrondi(somme(loo.map(m => m.logistique.signales[k].captures)), 2), positifs: somme(loo.map(m => m.logistique.positifs)) });
      sortie.synthese = { schemas: loo.map(m => m.schema), ...Object.fromEntries(['p5', 'p10'].map(k => { const c = cumul(k); return [k, { ...c, rappel: c.positifs ? arrondi(c.captures / c.positifs, 3) : null }]; })) };
    }
    // 5) Plafond arithmétique de la porte, par partie.
    sortie.plafondPorte = res.parties.map(p => { const n = p.posesAvecReference, P = cible === 'y10' ? p.fauxVerts10 : p.corriges5; const k = Math.ceil(PORTE_PART * n - 1e-9); return { partie: p.partie, cutsEvalues: n, fautes: P, cutsSignalesA5pct: k, rappelMaxAtteignable: P ? arrondi(Math.min(k, P) / P, 3) : null, porteAtteignablePuisqueTauxDeFautes: P ? (P <= k / PORTE_RAPPEL) : null }; });
    res.cibles[cible] = sortie;
  }
  return res;
}

/* ------------------------------------------------------------------ Q2 : détecteur de PN */
function questionPN(parties, opts) {
  const res = { flush: null, humain: null, marges: [] };
  // A) Parties Ariane avec relevé S6 et fiche de PN : le détecteur flushPct.
  const avecFlush = parties.filter(p => p.info.source === 'ariane' && p.recs.some(r => r.traits && nonNul(r.t.flushPct)) && p.info.pnPlages && p.info.pnPlages.length);
  for (const p of avecFlush) {
    let sansFlushRes = null;
    const L = p.recs.filter(r => r.traits && nonNul(r.t.flushPct));
    const passage = r => !!(r.zone && r.zone.pn && r.zone.pn.role === 'passage'), pn = r => !!(r.zone && r.zone.pn);
    const y = L.map(passage);
    const mesures = TRAITS.filter(t => L.some(r => nonNul(r.t[t.nom]))).filter(t => !['zonePN', 'zonePNPassage', 'zoneADV'].includes(t.nom))
      .map(t => ({ trait: t.nom, libelle: t.lib, renseignes: L.filter(r => nonNul(r.t[t.nom])).length, auc: arrondi(auc(L.map(r => nonNul(r.t[t.nom]) ? r.t[t.nom] : NaN), y), 3) }))
      .filter(m => m.auc !== null).sort((a, b) => Math.abs(b.auc - 0.5) - Math.abs(a.auc - 0.5));
    const balayage = [];
    for (const T of [10, 20, 30, 40, 50, 60, 70, 80, 90]) {
      const f = L.filter(r => r.t.flushPct >= T), tp = f.filter(passage).length, tpPN = f.filter(pn).length;
      balayage.push({ seuil: T, signales: f.length, vraisPositifs: tp, precision: f.length ? arrondi(tp / f.length, 3) : null, rappel: arrondi(tp / y.filter(Boolean).length, 3), horsPN: f.length - tpPN });
    }
    // Un PN laissé de côté à la fois : seuil choisi (F1 maximal) sur les autres PN et sur les rouges hors PN d'un autre bloc.
    const blocs = p.info.pnPlages;
    const cutsPN = id => L.filter(r => r.zone && r.zone.pn && r.zone.pn.id === id);
    const horsPN = L.filter(r => !pn(r)).sort((a, b) => a.cut - b.cut);
    const taille = Math.ceil(horsPN.length / blocs.length);
    const pliages = [];
    blocs.forEach((b, k) => {
      const testPN = cutsPN(b.id), testNeg = horsPN.slice(k * taille, (k + 1) * taille);
      const appPos = blocs.filter(x => x !== b).flatMap(x => cutsPN(x.id).filter(passage)), appNeg = horsPN.filter(r => !testNeg.includes(r));
      let meilleur = null;
      for (const T of [5, 10, 20, 30, 40, 50, 60, 70, 80, 90]) {
        const tp = appPos.filter(r => r.t.flushPct >= T).length, fp = appNeg.filter(r => r.t.flushPct >= T).length;
        const prec = tp + fp ? tp / (tp + fp) : 0, rap = appPos.length ? tp / appPos.length : 0, f1 = prec + rap ? 2 * prec * rap / (prec + rap) : 0;
        if (!meilleur || f1 > meilleur.f1 + 1e-9) meilleur = { T, f1 };
      }
      const pos = testPN.filter(passage), tp = pos.filter(r => r.t.flushPct >= meilleur.T).length, fp = testNeg.filter(r => r.t.flushPct >= meilleur.T).length;
      pliages.push({ pnLaisse: b.id, seuilAppris: meilleur.T, passagesVus: pos.length, retrouves: tp, fauxPositifsSurBlocHorsPN: fp, blocHorsPN: testNeg.length });
    });
    const tpT = pliages.reduce((a, q) => a + q.retrouves, 0), npos = pliages.reduce((a, q) => a + q.passagesVus, 0), fpT = pliages.reduce((a, q) => a + q.fauxPositifsSurBlocHorsPN, 0);
    // Même exercice SANS flushPct : régression logistique sur les traits de la liste, un PN laissé de côté à la fois.
    const sansFlush = TRAITS.filter(t => !t.seul && t.nom !== 'flushPct' && L.filter(r => nonNul(r.t[t.nom])).length >= 0.8 * L.length)
      .map(t => ({ t, a: auc(L.map(r => nonNul(r.t[t.nom]) ? r.t[t.nom] : NaN), y) })).filter(x => x.a !== null).sort((u, v) => Math.abs(v.a - 0.5) - Math.abs(u.a - 0.5));
    const retenus = [];
    for (const c of sansFlush) { if (retenus.length >= 3) break; const imp = impute(c.t, L); if (retenus.every(d => Math.abs(correlation(L.map(r => transformer(c.t, r.t[c.t.nom], imp)), L.map(r => transformer(d.t, r.t[d.t.nom], d.imp)))) < 0.8)) retenus.push({ t: c.t, imp }); }
    if (retenus.length) {
      const score = new Map();
      blocs.forEach((b, k) => {
        const testNeg = horsPN.slice(k * taille, (k + 1) * taille), testR = new Set([...cutsPN(b.id), ...testNeg]);
        const app = L.filter(r => !testR.has(r));
        const X0 = app.map(r => retenus.map(c => transformer(c.t, r.t[c.t.nom], c.imp)));
        const mu = retenus.map((_, j) => moyenne(X0.map(x => x[j]))), sd = retenus.map((_, j) => Math.sqrt(moyenne(X0.map(x => (x[j] - mu[j]) ** 2))) || 1);
        const beta = ajusterLogistique(X0.map(x => x.map((v, j) => (v - mu[j]) / sd[j])), app.map(passage), app.map(() => 1), 2);
        for (const r of testR) { let z = beta[0]; retenus.forEach((c, j) => { z += beta[j + 1] * ((transformer(c.t, r.t[c.t.nom], c.imp) - mu[j]) / sd[j]); }); score.set(r, sigmoide(z)); }
      });
      const jug = L.filter(r => score.has(r)), sc = jug.map(r => score.get(r)), yy = jug.map(passage);
      const npos = yy.filter(Boolean).length, top = rappelAuTop(sc, yy, npos / jug.length);
      sansFlushRes = { traits: retenus.map(c => c.t.nom), jugés: jug.length, auc: arrondi(auc(sc, yy), 3), signalesParMeilleursScores: top.signales, passagesRetrouves: arrondi(top.captures, 1), passages: npos, precision: arrondi(top.captures / top.signales, 3) };
    }
    // Marge recommandée : cœur détecté (flushPct ≥ 50) contre la plage contrôlée par l'opérateur.
    const marges = [];
    for (const b of blocs) {
      const coeur = L.filter(r => r.t.flushPct >= 50 && r.cut >= b.controle[0] && r.cut <= b.controle[1]).map(r => r.cut);
      if (!coeur.length) { marges.push({ pn: b.id, controle: b.controle, coeurDetecte: null }); continue; }
      const a = Math.min(...coeur), z = Math.max(...coeur);
      marges.push({ pn: b.id, controle: b.controle, coeurDetecte: [a, z], coeurCuts: coeur.length, margeAvant: a - b.controle[0], margeApres: b.controle[1] - z,
        passageFiche: b.passage, margeAvantFiche: b.passage ? b.passage[0] - b.controle[0] : null, margeApresFiche: b.passage ? b.controle[1] - b.passage[1] : null });
    }
    // Les rouges hors PN que flushPct ≥ 50 ne signale pas à tort, et ceux du passage qu'il manque.
    const manques = L.filter(r => passage(r) && r.t.flushPct < 50).map(r => ({ cut: r.cut, flushPct: r.t.flushPct, classe: r.classe }));
    res.flush = { partie: p.info.partie, rougesJugés: L.length, passages: y.filter(Boolean).length, mesures, balayage, sansFlushPct: sansFlushRes, validationParPN: { pliages, rappel: npos ? arrondi(tpT / npos, 3) : null, fauxPositifs: fpT, sur: pliages.reduce((a, q) => a + q.blocHorsPN, 0) }, marges, passagesManques: manques };
  }
  // B) Parties humaines : l'écartement de la pose de départ comme indice de PN.
  const humaines = parties.filter(p => p.info.source === 'humain' && p.info.pnPlages && p.info.pnPlages.length);
  const hum = [];
  for (const p of humaines) {
    const R = p.recs.filter(r => r.cut > 0 && nonNul(r.ctx.ecartementInitialMm) && r.ref);
    const med = mediane(R.map(r => r.ctx.ecartementInitialMm));
    const dev = r => Math.abs(r.ctx.ecartementInitialMm - med);
    const T = opts.seuilEcartementMm;
    const dans = r => p.info.pnPlages.some(b => r.cut >= b.controle[0] && r.cut <= b.controle[1]);
    const f = R.filter(r => dev(r) > T), tp = f.filter(dans).length;
    const plages = p.info.pnPlages.map(b => {
      const inRange = R.filter(r => r.cut >= b.controle[0] && r.cut <= b.controle[1]), fl = inRange.filter(r => dev(r) > T).map(r => r.cut);
      const o = { pn: b.id, controle: b.controle, cuts: b.controle[1] - b.controle[0] + 1, signales: fl.length };
      if (fl.length) { const a = Math.min(...fl), z = Math.max(...fl); o.coeurSignale = [a, z]; o.margeAvant = a - b.controle[0]; o.margeApres = b.controle[1] - z; }
      return o;
    });
    hum.push({ partie: p.info.partie, mediane: arrondi(med, 1), seuilMm: T, signales: f.length, dansUnPN: tp, precision: f.length ? arrondi(tp / f.length, 3) : null, cutsEnPN: R.filter(dans).length,
      rappelCuts: R.filter(dans).length ? arrondi(tp / R.filter(dans).length, 3) : null, pnDetectes: plages.filter(x => x.signales > 0).length, pnTotal: plages.length, plages });
  }
  if (hum.length) res.humain = hum;
  // Marges : tableau commun.
  const lignes = [];
  if (res.flush) for (const m of res.flush.marges) if (m.coeurDetecte) lignes.push({ partie: res.flush.partie, source: 'flushPct ≥ 50', pn: m.pn, avant: m.margeAvant, apres: m.margeApres });
  for (const h of hum) for (const q of h.plages) if (q.coeurSignale) lignes.push({ partie: h.partie, source: `écartement > ${h.seuilMm} mm`, pn: q.pn, avant: q.margeAvant, apres: q.margeApres });
  res.marges = lignes;
  if (lignes.length) {
    // Couverture : part des PN dont toute la plage contrôlée par l'opérateur tient dans [cœur − avant, cœur + après].
    const sources = [...new Set(lignes.map(l => l.source))];
    res.couvertureMarges = [[2, 2], [3, 3], [4, 4], [4, 6], [5, 6], [6, 6], [6, 8], [8, 8], [10, 10]].map(([a, b]) => ({ avant: a, apres: b,
      ...Object.fromEntries(sources.map(src => { const q = lignes.filter(l => l.source === src); return [src, `${q.filter(l => l.avant <= a && l.apres <= b).length}/${q.length}`]; })) }));
    const av = lignes.map(l => l.avant), ap = lignes.map(l => l.apres);
    res.margeRecommandee = { sources: lignes.length, avant: { mediane: mediane(av), p90: arrondi(quantile(av, 0.9), 1), max: Math.max(...av) }, apres: { mediane: mediane(ap), p90: arrondi(quantile(ap, 0.9), 1), max: Math.max(...ap) } };
  }
  // Parcours observé de l'opérateur : la suite de cuts VALIDÉS (étiquette d'Écho VALIDATE_*) autour de chaque plage donnée s'arrête-t-elle aux bords de la plage ?
  res.parcours = [];
  for (const p of parties) {
    if (!p.info.pnPlages || !p.info.pnPlages.length) continue;
    const val = new Map(p.recs.map(r => [r.cut, /^VALIDATE/.test(r.etiquetteEcho || '')]));
    for (const b of p.info.pnPlages) {
      let l = b.controle[0], z = b.controle[1];
      while (val.get(l - 1)) l--; while (val.get(z + 1)) z++;
      const dedans = p.recs.filter(r => r.cut >= b.controle[0] && r.cut <= b.controle[1]);
      res.parcours.push({ partie: p.info.partie, pn: b.id, plage: b.controle, validesDansLaPlage: dedans.filter(r => val.get(r.cut)).length, cutsDansLaPlage: b.controle[1] - b.controle[0] + 1,
        parcoursValideContinu: [l, z], identiqueALaPlage: l === b.controle[0] && z === b.controle[1] });
    }
  }
  // Marges de la fiche de l'opérateur (passage → plage contrôlée) pour mémoire, quand la partie les porte.
  const fiche = [];
  for (const p of parties) for (const b of (p.info.pnPlages || [])) if (b.passage) fiche.push({ partie: p.info.partie, pn: b.id, avant: b.passage[0] - b.controle[0], apres: b.controle[1] - b.passage[1] });
  if (fiche.length) res.margesFicheMic = { lignes: fiche, avant: { mediane: mediane(fiche.map(x => x.avant)), max: Math.max(...fiche.map(x => x.avant)) }, apres: { mediane: mediane(fiche.map(x => x.apres)), max: Math.max(...fiche.map(x => x.apres)) } };
  return res;
}

/* ------------------------------------------------------------------ Q3 : détecteur d'erreur d'extraction */
function matriceDetecteur(R, flag, vrai) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of R) { const f = flag(r), v = vrai(r); if (f && v) tp++; else if (f) fp++; else if (v) fn++; else tn++; }
  return { n: R.length, vraisPositifs: tp, fauxPositifs: fp, manques: fn, vraisNegatifs: tn, precision: tp + fp ? arrondi(tp / (tp + fp), 3) : null, rappel: tp + fn ? arrondi(tp / (tp + fn), 3) : null };
}
function questionEcartement(parties, opts) {
  const T0 = opts.seuilEcartementMm;
  const res = { seuilMm: T0, humaines: [], validationCroisee: [], verts: [] };
  const humaines = parties.filter(p => p.info.source === 'humain');
  const base = p => p.recs.filter(r => r.cut > 0 && r.ref && nonNul(r.ctx.ecartementInitialMm));
  const devDe = (R, med) => r => Math.abs(r.ctx.ecartementInitialMm - med);
  for (const p of humaines) {
    const R = base(p), med = mediane(R.map(r => r.ctx.ecartementInitialMm)), dev = devDe(R, med);
    const mauvais = r => r.y25;
    const non = R.filter(r => !mauvais(r)), oui = R.filter(mauvais);
    res.humaines.push({ partie: p.info.partie, cuts: R.length, mediane: arrondi(med, 1), mauvaisObjets25mm: oui.length, nonTouches: R.filter(r => r.maxD3 < 1).length,
      ...matriceDetecteur(R, r => dev(r) > T0, mauvais), contre10: matriceDetecteur(R, r => dev(r) > T0, r => r.y10), nonTouchesSignales: R.filter(r => r.maxD3 < 1 && dev(r) > T0).length,
      ecartMaxParmiLesBons: arrondi(Math.max(...non.map(dev)), 1), ecartMinParmiLesMauvais: oui.length ? arrondi(Math.min(...oui.map(dev)), 1) : null,
      auc: arrondi(auc(R.map(dev), R.map(mauvais)), 3) });
  }
  // Validation croisée entre parties humaines : seuil appris (F1 maximal) sur A, jugé sur B avec sa propre médiane.
  for (const app of humaines) for (const test of humaines) {
    if (app === test) continue;
    const A = base(app), medA = mediane(A.map(r => r.ctx.ecartementInitialMm)), dA = devDe(A, medA);
    let meilleur = null;
    const candidats = [];
    for (let T = 1; T <= 40; T += 0.5) candidats.push(T);
    for (const T of candidats) {
      const m = matriceDetecteur(A, r => dA(r) > T, r => r.y25);
      const f1 = m.precision !== null && m.rappel !== null && m.precision + m.rappel ? 2 * m.precision * m.rappel / (m.precision + m.rappel) : 0;
      if (!meilleur || f1 > meilleur.f1 + 1e-9) meilleur = { T, f1, plage: [T, T] }; else if (Math.abs(f1 - meilleur.f1) <= 1e-9) meilleur.plage[1] = T;
    }
    const Tappris = (meilleur.plage[0] + meilleur.plage[1]) / 2;
    const B = base(test), medB = mediane(B.map(r => r.ctx.ecartementInitialMm)), dB = devDe(B, medB), dBfixe = devDe(B, medA);
    res.validationCroisee.push({ apprentissage: app.info.partie, jugee: test.info.partie, seuilAppris: Tappris, plageDesSeuilsOptimaux: meilleur.plage,
      medianeApprise: arrondi(medA, 1), medianePropre: arrondi(medB, 1),
      parMedianePropre: matriceDetecteur(B, r => dB(r) > Tappris, r => r.y25), parMedianeApprise: matriceDetecteur(B, r => dBfixe(r) > Tappris, r => r.y25),
      seuilDuCahier: matriceDetecteur(B, r => dB(r) > T0, r => r.y25) });
  }
  // Verts d'extraction des parties Ariane : cuts hors journal, pose de départ d'ESV (première visite de l'Écho).
  for (const p of parties.filter(q => q.info.source === 'ariane')) {
    const R = p.recs.filter(r => r.classe === 'hors-journal' && r.cut > 0 && r.ref && nonNul(r.ctx.ecartementInitialMm));
    if (R.length < 20) continue;
    const med = mediane(R.map(r => r.ctx.ecartementInitialMm)), dev = devDe(R, med);
    const dansPN = r => !!(r.zone && r.zone.pn);
    const o = { partie: p.info.partie, vertsExtraction: R.length, mediane: arrondi(med, 1), corriges10: R.filter(r => r.y10).length, corriges25: R.filter(r => r.y25).length,
      signales: R.filter(r => dev(r) > T0).length,
      contre10: matriceDetecteur(R, r => dev(r) > T0, r => r.y10), contre25: matriceDetecteur(R, r => dev(r) > T0, r => r.y25),
      auc10: arrondi(auc(R.map(dev), R.map(r => r.y10)), 3), auc5: arrondi(auc(R.map(dev), R.map(r => r.y5)), 3), ecartMax: arrondi(Math.max(...R.map(dev)), 1) };
    const sig = R.filter(r => dev(r) > T0);
    o.signalesDetail = sig.slice(0, 40).map(r => ({ cut: r.cut, ecartMm: arrondi(dev(r), 1), corrigeMm: arrondi(r.maxD3, 1), enPN: dansPN(r) }));
    if (R.some(r => r.zone)) o.signalesEnPN = sig.filter(dansPN).length;
    // Plus petit seuil qui ne signale qu'un petit nombre de cuts : où la règle commence à voir quelque chose.
    o.parSeuil = [5, 7.5, 10, 15, 20].map(T => ({ seuilMm: T, signales: R.filter(r => dev(r) > T).length, corriges10Parmi: R.filter(r => dev(r) > T && r.y10).length }));
    // Complément exploratoire (non appris) : dénivelé local entre les deux rails, si le jeu le porte (contexte.deniveleLocalMm).
    const Rd = R.filter(r => nonNul(r.ctx.deniveleLocalMm));
    if (Rd.length >= 20) {
      o.denivele = { cuts: Rd.length, auc25: arrondi(auc(Rd.map(r => r.ctx.deniveleLocalMm), Rd.map(r => r.y25)), 3), auc10: arrondi(auc(Rd.map(r => r.ctx.deniveleLocalMm), Rd.map(r => r.y10)), 3),
        parSeuil: [10, 15, 20].map(T => {
          const seul = matriceDetecteur(Rd, r => r.ctx.deniveleLocalMm > T, r => r.y10), seul25 = matriceDetecteur(Rd, r => r.ctx.deniveleLocalMm > T, r => r.y25);
          const unionD = matriceDetecteur(Rd, r => r.ctx.deniveleLocalMm > T || Math.abs(r.ctx.ecartementInitialMm - med) > T0, r => r.y10), union25 = matriceDetecteur(Rd, r => r.ctx.deniveleLocalMm > T || Math.abs(r.ctx.ecartementInitialMm - med) > T0, r => r.y25);
          return { seuilMm: T, signales: Rd.filter(r => r.ctx.deniveleLocalMm > T).length, justes10: seul.vraisPositifs, rappel10: seul.rappel, justes25: seul25.vraisPositifs, rappel25: seul25.rappel,
            unionAvecEcartement: { signales: Rd.filter(r => r.ctx.deniveleLocalMm > T || Math.abs(r.ctx.ecartementInitialMm - med) > T0).length, justes10: unionD.vraisPositifs, rappel10: unionD.rappel, justes25: union25.vraisPositifs, rappel25: union25.rappel } };
        }) };
    }
    res.verts.push(o);
  }
  return res;
}

/* ------------------------------------------------------------------ Q4 : biais vertical */
/* Convention de signe : correction = pose de l'opérateur − pose d'Ariane (repère profil du rail), donc « + » = l'opérateur remonte la
 * pose d'Ariane. L'« erreur » de P0_MESURES (pose publiée − pose de l'opérateur) est l'opposée. */
function railsDe(p) {
  const out = [];
  for (const r of p.recs) {
    if (!(r.posee && r.ref)) continue;
    for (const c of COTES) {
      const x = r.corr[c];
      const prop = r.propositions && r.propositions[c] || null, g0 = r.traits && r.traits.g0 && r.traits.g0.rails && r.traits.g0.rails[c] || null;
      const refuse = prop && prop.convention === false || g0 && g0.conventionAppliquee === false;
      const connu = (prop && typeof prop.convention === 'boolean') || (g0 && typeof g0.conventionAppliquee === 'boolean');
      const zone = r.zone ? (r.zone.pn ? 'PN' : r.zone.adv ? 'ADV' : 'hors zone') : null;
      out.push({ partie: p.info.partie, cut: r.cut, cote: c, vert: x.vert, lat: x.lat, lon: x.lon, convention: connu ? (refuse ? 'refusee' : 'appliquee') : 'inconnue', dz: g0 && fini(g0.dzMm) ? g0.dzMm : null, zone });
    }
  }
  return out;
}
function statGroupe(v) {
  if (!v.length) return { n: 0 };
  const m = moyenne(v), sd = v.length > 1 ? Math.sqrt(somme(v.map(x => (x - m) ** 2)) / (v.length - 1)) : null;
  return { n: v.length, moyenne: arrondi(m, 2), mediane: arrondi(mediane(v), 2), ecartType: sd === null ? null : arrondi(sd, 2),
    ic90Moyenne: sd === null ? null : [arrondi(m - 1.645 * sd / Math.sqrt(v.length), 2), arrondi(m + 1.645 * sd / Math.sqrt(v.length), 2)],
    partRemontes: arrondi(v.filter(x => x > 0.5).length / v.length, 3), partDescendus: arrondi(v.filter(x => x < -0.5).length / v.length, 3), partAuDessusDe5mm: arrondi(v.filter(x => Math.abs(x) > 5).length / v.length, 3) };
}
/* Un correcteur appris : fonction (rail) → décalage vertical à AJOUTER à la pose d'Ariane. */
const MIN_GROUPE = 8;
function apprendreCorrecteur(nom, rails) {
  const med = f => { const v = rails.filter(f).map(x => x.vert); return v.length >= MIN_GROUPE ? mediane(v) : null; };
  if (nom === 'moyenne-globale') { const m = moyenne(rails.map(x => x.vert)) ?? 0; return { desc: `${arrondi(m, 2)} mm pour tous les rails`, f: () => m, params: { global: arrondi(m, 2) } }; }
  if (nom === 'refusee-seule') {
    const r = med(x => x.convention === 'refusee') ?? 0;
    return { desc: `convention refusée : ${arrondi(r, 2)} mm ; sinon 0`, f: x => x.convention === 'refusee' ? r : 0, params: { refusee: arrondi(r, 2) } };
  }
  if (nom === 'convention') {
    const r = med(x => x.convention === 'refusee') ?? 0, a = med(x => x.convention === 'appliquee') ?? 0;
    return { desc: `refusée : ${arrondi(r, 2)} mm ; appliquée : ${arrondi(a, 2)} mm`, f: x => x.convention === 'refusee' ? r : x.convention === 'appliquee' ? a : 0, params: { refusee: arrondi(r, 2), appliquee: arrondi(a, 2) } };
  }
  if (nom === 'convention-moyenne') {
    const mo = f => { const v = rails.filter(f).map(x => x.vert); return v.length >= MIN_GROUPE ? moyenne(v) : null; };
    const r = mo(x => x.convention === 'refusee') ?? 0, a = mo(x => x.convention === 'appliquee') ?? 0;
    return { desc: `refusée : ${arrondi(r, 2)} mm ; appliquée : ${arrondi(a, 2)} mm (moyennes)`, f: x => x.convention === 'refusee' ? r : x.convention === 'appliquee' ? a : 0, params: { refusee: arrondi(r, 2), appliquee: arrondi(a, 2) } };
  }
  if (nom === 'refusee-cote') {
    const g = med(x => x.convention === 'refusee' && x.cote === 'gauche') ?? 0, d = med(x => x.convention === 'refusee' && x.cote === 'droite') ?? 0;
    return { desc: `refusée gauche : ${arrondi(g, 2)} mm ; refusée droite : ${arrondi(d, 2)} mm ; sinon 0`, f: x => x.convention === 'refusee' ? (x.cote === 'gauche' ? g : d) : 0, params: { gauche: arrondi(g, 2), droite: arrondi(d, 2) } };
  }
  if (nom === 'refusee-dz') {
    // Rails refusés : droite des moindres carrés correction = a + b·dz ; ailleurs 0.
    const ref = rails.filter(x => x.convention === 'refusee' && fini(x.dz));
    let a = 0, b = 0;
    if (ref.length >= MIN_GROUPE) {
      const mx = moyenne(ref.map(x => x.dz)), my = moyenne(ref.map(x => x.vert));
      const sxx = somme(ref.map(x => (x.dz - mx) ** 2)), sxy = somme(ref.map(x => (x.dz - mx) * (x.vert - my)));
      b = sxx > 1e-9 ? sxy / sxx : 0; a = my - b * mx;
    }
    return { desc: `refusée : ${arrondi(a, 2)} ${b < 0 ? '−' : '+'} ${Math.abs(arrondi(b, 3))}·dz ; sinon 0`, f: x => x.convention === 'refusee' && fini(x.dz) ? a + b * x.dz : 0, params: { a: arrondi(a, 2), pente: arrondi(b, 3) } };
  }
  throw new Error('correcteur inconnu : ' + nom);
}
const CORRECTEURS = ['moyenne-globale', 'refusee-seule', 'convention', 'convention-moyenne', 'refusee-cote', 'refusee-dz'];

/* Effet d'un correcteur sur une partie : les rails sont regroupés par cut pour recalculer la distance 3D du cut. */
function effetCorrecteur(p, correcteur) {
  const parCut = new Map();
  for (const x of railsDe(p)) { if (!parCut.has(x.cut)) parCut.set(x.cut, []); parCut.get(x.cut).push(x); }
  const avant = [], apres = [], vAvant = [], vApres = [];
  let aggraves = 0, ameliores = 0, ajoutes10 = 0, ajoutes5 = 0;
  for (const rl of parCut.values()) {
    const d0 = Math.max(...rl.map(x => Math.hypot(x.lon, x.lat, x.vert))), d1 = Math.max(...rl.map(x => Math.hypot(x.lon, x.lat, x.vert - correcteur.f(x))));
    avant.push(d0); apres.push(d1);
    if (d1 > d0 + 1) aggraves++; else if (d1 < d0 - 1) ameliores++;
    if (d0 <= 10 && d1 > 10) ajoutes10++;
    if (d0 <= 5 && d1 > 5) ajoutes5++;
    for (const x of rl) { vAvant.push(Math.abs(x.vert)); vApres.push(Math.abs(x.vert - correcteur.f(x))); }
  }
  const taux = (v, s) => v.filter(d => d > s).length / v.length;
  return { cuts: avant.length, rails: vAvant.length,
    vertAbsMoyen: [arrondi(moyenne(vAvant), 2), arrondi(moyenne(vApres), 2)],
    d3MedianeCut: [arrondi(mediane(avant), 2), arrondi(mediane(apres), 2)], corriges5: [arrondi(taux(avant, 5), 3), arrondi(taux(apres, 5), 3)], corriges10: [arrondi(taux(avant, 10), 3), arrondi(taux(apres, 10), 3)],
    nCorriges10: [avant.filter(d => d > 10).length, apres.filter(d => d > 10).length], nCorriges5: [avant.filter(d => d > 5).length, apres.filter(d => d > 5).length],
    cutsAmeliores: ameliores, cutsAggraves: aggraves, mauvaisesPosesAjoutees10: ajoutes10, mauvaisesPosesAjoutees5: ajoutes5 };
}
function questionBiais(parties) {
  const ariane = parties.filter(p => p.info.source === 'ariane' && p.recs.some(r => r.posee && r.ref));
  const res = { convention: 'correction = pose de l\'opérateur − pose d\'Ariane (mm) ; + = l\'opérateur remonte la pose ; l\'erreur de P0_MESURES est l\'opposée', groupes: [], validationCroisee: [], synthese: [] };
  const GROUPES = [
    ['tous les rails', x => true], ['convention refusée', x => x.convention === 'refusee'], ['convention appliquée', x => x.convention === 'appliquee'],
    ['rail gauche', x => x.cote === 'gauche'], ['rail droit', x => x.cote === 'droite'],
    ['refusée, rail gauche', x => x.convention === 'refusee' && x.cote === 'gauche'], ['refusée, rail droit', x => x.convention === 'refusee' && x.cote === 'droite'],
    ['PN (marges comprises)', x => x.zone === 'PN'], ["ADV (marge élargie comprise)", x => x.zone === 'ADV'], ['hors zone', x => x.zone === 'hors zone'],
  ];
  const cache = new Map(ariane.map(p => [p, railsDe(p)]));
  for (const [nom, f] of GROUPES) {
    const ligne = { groupe: nom, parPartie: {} };
    for (const p of ariane) { const v = cache.get(p).filter(f).map(x => x.vert); if (v.length) ligne.parPartie[p.info.partie] = statGroupe(v); }
    const sts = Object.values(ligne.parPartie).filter(q => q.n >= 10);
    ligne.parties = sts.length;
    ligne.signeStable = sts.length >= 2 ? (sts.every(q => q.moyenne >= 0.5 && q.mediane >= 0) ? 'positif (l\'opérateur remonte)' : sts.every(q => q.moyenne <= -0.5 && q.mediane <= 0) ? 'négatif (l\'opérateur descend)' : 'instable') : 'non jugeable (une seule partie)';
    if (Object.keys(ligne.parPartie).length) res.groupes.push(ligne);
  }
  // Pente de la correction sur dz, rails refusés, par partie : le décalage prédit par la convention suit-il l'erreur ?
  res.dz = ariane.map(p => { const r = cache.get(p).filter(x => x.convention === 'refusee' && fini(x.dz)); const o = { partie: p.info.partie, n: r.length, correlation: null, pente: null };
    if (r.length >= MIN_GROUPE) { const mx = moyenne(r.map(x => x.dz)), my = moyenne(r.map(x => x.vert)); const sxx = somme(r.map(x => (x.dz - mx) ** 2)); o.correlation = arrondi(correlation(r.map(x => x.dz), r.map(x => x.vert)), 3); o.pente = sxx > 1e-9 ? arrondi(somme(r.map(x => (x.dz - mx) * (x.vert - my))) / sxx, 3) : null; }
    return o; });
  // Apprendre sur A (ou sur les autres), appliquer à B.
  for (const nom of CORRECTEURS) {
    const lignes = [];
    for (const app of ariane) for (const test of ariane) {
      if (app === test) continue;
      const c = apprendreCorrecteur(nom, cache.get(app));
      lignes.push({ correcteur: nom, apprentissage: [app.info.partie], jugee: test.info.partie, appris: c.desc, params: c.params, ...effetCorrecteur(test, c) });
    }
    const loo = [];
    if (ariane.length >= 3) for (const test of ariane) {
      const autres = ariane.filter(p => p !== test), c = apprendreCorrecteur(nom, autres.flatMap(p => cache.get(p)));
      if (autres.includes(test)) throw new Error('validation croisée : la partie jugée figure dans l\'apprentissage');
      loo.push({ correcteur: nom, apprentissage: autres.map(p => p.info.partie), jugee: test.info.partie, appris: c.desc, params: c.params, ...effetCorrecteur(test, c) });
    }
    res.validationCroisee.push(...lignes, ...loo);
    const agr = (L, nomSchema) => L.length ? ({ correcteur: nom, schema: nomSchema, cuts: somme(L.map(q => q.cuts)),
      nCorriges10: [somme(L.map(q => q.nCorriges10[0])), somme(L.map(q => q.nCorriges10[1]))], nCorriges5: [somme(L.map(q => q.nCorriges5[0])), somme(L.map(q => q.nCorriges5[1]))],
      vertAbsMoyen: [arrondi(somme(L.map(q => q.vertAbsMoyen[0] * q.rails)) / somme(L.map(q => q.rails)), 2), arrondi(somme(L.map(q => q.vertAbsMoyen[1] * q.rails)) / somme(L.map(q => q.rails)), 2)],
      cutsAmeliores: somme(L.map(q => q.cutsAmeliores)), cutsAggraves: somme(L.map(q => q.cutsAggraves)),
      mauvaisesPosesAjoutees10: somme(L.map(q => q.mauvaisesPosesAjoutees10)), mauvaisesPosesAjoutees5: somme(L.map(q => q.mauvaisesPosesAjoutees5)),
      parties: L.map(q => `${q.jugee}: ${q.nCorriges10[0]}→${q.nCorriges10[1]}`) }) : null;
    if (loo.length) res.synthese.push(agr(loo, 'les autres → chaque partie'));
    res.synthese.push(agr(lignes, 'une partie → une autre'));
  }
  res.synthese = res.synthese.filter(Boolean);
  // Grille de corrections fixes sur les rails à convention refusée (choisies après coup, donc à lire comme un ordre de grandeur,
  // pas comme une validation) : où se place le gain, et où il devient une perte ?
  res.grilleRefusee = [1, 2, 3, 4, 5, 6].map(c => ({ correctionMm: c, parties: ariane.map(p => { const e = effetCorrecteur(p, { f: x => x.convention === 'refusee' ? c : 0 }); return { partie: p.info.partie, nCorriges10: e.nCorriges10, nCorriges5: e.nCorriges5, vertAbsMoyen: e.vertAbsMoyen, cutsAmeliores: e.cutsAmeliores, cutsAggraves: e.cutsAggraves, mauvaisesPosesAjoutees10: e.mauvaisesPosesAjoutees10 }; }) }));
  // Plafond : correcteur « convention » appris sur la partie jugée elle-même (non valide, borne haute seulement).
  res.plafondSurPlace = ariane.map(p => ({ partie: p.info.partie, ...effetCorrecteur(p, apprendreCorrecteur('convention', cache.get(p))), note: 'appris et jugé sur la même partie : plafond théorique, pas une mesure' }));
  return res;
}

/* ------------------------------------------------------------------ orchestration */
function analyser(jeux, opts = {}) {
  const o = { seuilVisiteS: 0.8, bootstrap: 500, graine: 20261016, seuilEcartementMm: 10, questions: [1, 2, 3, 4], ...opts };
  const numeros = [...new Set(jeux.flatMap(j => j.cuts.map(c => c.partie)))].sort((a, b) => a - b);
  const parties = numeros.map(n => poserTraits(normaliserPartie(n, jeux, o)));
  const sortie = { format: FORMAT, options: { seuilVisiteS: o.seuilVisiteS, bootstrap: o.bootstrap, graine: o.graine, seuilEcartementMm: o.seuilEcartementMm },
    parties: parties.map(p => ({ partie: p.info.partie, nature: p.info.source, cuts: p.info.n, avecReference: p.recs.filter(r => r.ref).length, posesAvecReference: p.recs.filter(r => r.posee && r.ref).length })) };
  if (o.questions.includes(1)) sortie.q1 = questionFauxVerts(parties, o);
  if (o.questions.includes(2)) sortie.q2 = questionPN(parties, o);
  if (o.questions.includes(3)) sortie.q3 = questionEcartement(parties, o);
  if (o.questions.includes(4)) sortie.q4 = questionBiais(parties);
  return sortie;
}

/* ------------------------------------------------------------------ rapport lisible */
function ligneRappel(m) {
  if (!m) return '—';
  const s = m.signales;
  const ic = m.amorcage && m.amorcage.rappel5 ? ` (IC90 ${pct(m.amorcage.rappel5[0], 0)} à ${pct(m.amorcage.rappel5[1], 0)})` : '';
  return `AUC ${fr(m.auc, 2)} ; 5 % : ${fr(s.p5.captures, 1)}/${s.p5.positifs} = ${pct(s.p5.rappel, 0)}${ic} ; 10 % : ${fr(s.p10.captures, 1)}/${s.p10.positifs} = ${pct(s.p10.rappel, 0)} ; 60 % des fautes demandent ${pct(m.partPour60, 0)} des cuts`;
}
function texte(r) {
  const L = [];
  L.push(`Étude d'apprentissage G0 — ${r.format}`);
  L.push(`Parties : ${r.parties.map(p => `${p.partie} (${p.nature}, ${p.cuts} cuts, ${p.avecReference} avec référence)`).join(' ; ')}.`);
  if (r.q1) {
    L.push('', '== Q1. Faux verts d\'Ariane ==');
    L.push(`Posés avec référence : ${r.q1.parties.map(p => `partie ${p.partie} : ${p.posesAvecReference} (> 10 mm : ${p.fauxVerts10}, > 5 mm : ${p.corriges5})`).join(' ; ')}.`);
    for (const c of ['y10', 'y5']) {
      const q = r.q1.cibles[c];
      L.push('', `-- Corrigés de plus de ${q.seuilMm} mm --`);
      L.push('Chaque trait seul (AUC par partie ; 0,5 = aucun pouvoir, > 0,5 = plus le trait est haut, plus le risque est haut) :');
      for (const t of q.traits.slice().sort((a, b) => Math.abs((b.aucMoyen ?? 0.5) - 0.5) - Math.abs((a.aucMoyen ?? 0.5) - 0.5))) {
        const pp = Object.entries(t.parPartie).map(([k, v]) => `${k}: ${v.auc === null ? '—' : fr(v.auc, 2)}${v.renseignes < v.n ? ` (${v.renseignes}/${v.n})` : ''}`).join(' ; ');
        L.push(`  ${t.nom.padEnd(24)} ${t.signeStable ? 'signe stable' : '            '}  ${pp}${t.seul ? '  [une partie seulement : mesure, pas d\'apprentissage]' : ''}`);
      }
      L.push('Taux de faux verts par tranche (toutes parties confondues, traits à signe stable) :');
      for (const t of q.traits.filter(x => x.signeStable && x.taux.length)) L.push(`  ${t.nom} : ` + t.taux.map(x => `${x.tranche} → ${x.positifs}/${x.n} (${pct(x.taux, 0)})`).join(' ; '));
      L.push('Validation croisée par partie (apprentissage → partie jugée) :');
      for (const m of q.modeles) {
        if (m.erreur) { L.push(`  ${m.schema} : ${m.erreur}`); continue; }
        L.push(`  ${m.schema} [${m.traitsRetenus.join(', ')}]`);
        L.push(`    logistique : ${ligneRappel(m.logistique)}`);
        L.push(`    arbre      : ${ligneRappel(m.arbre)}`);
        if (m.meilleurTraitSeul) L.push(`    trait seul (${m.meilleurTraitSeul.trait}, ${m.meilleurTraitSeul.sens}) : ${ligneRappel(m.meilleurTraitSeul)}`);
        if (m.scoreM6) L.push(`    score M6   : ${ligneRappel(m.scoreM6)}`);
      }
      if (q.synthese) L.push(`Les autres → chaque partie, cumul : 5 % : ${fr(q.synthese.p5.captures, 1)}/${q.synthese.p5.positifs} = ${pct(q.synthese.p5.rappel, 0)} ; 10 % : ${fr(q.synthese.p10.captures, 1)}/${q.synthese.p10.positifs} = ${pct(q.synthese.p10.rappel, 0)}.`);
      L.push('Plafond arithmétique de la porte (60 % des fautes dans 5 % des cuts) :');
      for (const p of q.plafondPorte) L.push(`  partie ${p.partie} : ${p.fautes} fautes sur ${p.cutsEvalues} cuts ; 5 % = ${p.cutsSignalesA5pct} cuts ; rappel maximal ${pct(p.rappelMaxAtteignable, 0)} ; porte ${p.porteAtteignablePuisqueTauxDeFautes ? 'possible' : 'impossible par construction'}.`);
      if (q.modeleEnsemble) {
        L.push('Modèle lisible appris sur toutes les parties (non jugé) :');
        for (const c of q.modeleEnsemble.logistique) L.push(`  ${c.trait} : poids ${fr(c.poids, 2)} (${c.sens})`);
        L.push('  Arbre :'); for (const g of q.modeleEnsemble.arbre) L.push(`    si ${g.si} : ${g.fautes}/${g.cuts} cuts fautifs (${pct(g.cuts ? g.fautes / g.cuts : null, 0)})`);
      }
    }
  }
  if (r.q2) {
    L.push('', '== Q2. Détecteur de PN ==');
    const f = r.q2.flush;
    if (f) {
      L.push(`Partie ${f.partie} : ${f.rougesJugés} rouges du journal, dont ${f.passages} dans le passage d'un PN.`);
      L.push('Traits seuls (AUC pour « passage de PN ») : ' + f.mesures.slice(0, 6).map(m => `${m.trait} ${fr(m.auc, 2)}`).join(' ; '));
      L.push('flushPct ≥ seuil :'); for (const b of f.balayage) L.push(`  ≥ ${b.seuil} : ${b.signales} signalés, ${b.vraisPositifs} dans un passage, ${b.horsPN} hors PN ; précision ${pct(b.precision, 0)}, rappel ${pct(b.rappel, 0)}`);
      L.push(`Un PN laissé de côté à la fois : ${f.validationParPN.rappel === null ? '—' : pct(f.validationParPN.rappel, 0)} des passages retrouvés ; ${f.validationParPN.fauxPositifs} faux positifs sur ${f.validationParPN.sur} rouges hors PN.`);
      if (f.sansFlushPct) L.push(`Sans flushPct (logistique sur ${f.sansFlushPct.traits.join(', ')}, un PN laissé de côté à la fois) : AUC ${fr(f.sansFlushPct.auc, 2)} ; les ${f.sansFlushPct.signalesParMeilleursScores} meilleurs scores contiennent ${fr(f.sansFlushPct.passagesRetrouves, 0)}/${f.sansFlushPct.passages} passages (précision ${pct(f.sansFlushPct.precision, 0)}).`);
      for (const m of f.marges) L.push(`  ${m.pn} : plage de l'opérateur ${m.controle.join('–')}, cœur détecté ${m.coeurDetecte ? m.coeurDetecte.join('–') : 'aucun'}${m.coeurDetecte ? ` ; marge avant ${m.margeAvant}, après ${m.margeApres}` : ''}`);
    }
    for (const h of r.q2.humain || []) L.push(`Partie ${h.partie} (humaine) : écartement > ${h.seuilMm} mm de la médiane (${fr(h.mediane)} mm) : ${h.signales} cuts signalés, ${h.dansUnPN} dans un PN (précision ${pct(h.precision, 0)}), ${h.pnDetectes}/${h.pnTotal} PN touchés ; rappel des cuts de PN ${pct(h.rappelCuts, 0)}.`);
    if (r.q2.parcours && r.q2.parcours.length) L.push(`Parcours observé : aucun cut validé juste avant ni juste après la plage donnée par l'opérateur pour ${r.q2.parcours.filter(x => x.identiqueALaPlage).length}/${r.q2.parcours.length} PN ; cuts validés dans les plages : ${somme(r.q2.parcours.map(x => x.validesDansLaPlage))}/${somme(r.q2.parcours.map(x => x.cutsDansLaPlage))}.`);
    if (r.q2.couvertureMarges) for (const c of r.q2.couvertureMarges) L.push(`  marges ${c.avant} avant / ${c.apres} après le cœur : ` + Object.entries(c).filter(([k]) => k !== 'avant' && k !== 'apres').map(([k, v]) => `${k} ${v} PN couverts`).join(' ; '));
    if (r.q2.margeRecommandee) { const m = r.q2.margeRecommandee; L.push(`Marges (plage de l'opérateur moins cœur détecté), ${m.sources} PN : avant médiane ${m.avant.mediane}, P90 ${m.avant.p90}, max ${m.avant.max} ; après médiane ${m.apres.mediane}, P90 ${m.apres.p90}, max ${m.apres.max}.`); }
    if (r.q2.margesFicheMic) { const m = r.q2.margesFicheMic; L.push(`Marges de la fiche de l'opérateur (passage → plage contrôlée) : avant médiane ${m.avant.mediane}, max ${m.avant.max} ; après médiane ${m.apres.mediane}, max ${m.apres.max}.`); }
  }
  if (r.q3) {
    L.push('', '== Q3. Détecteur d\'erreur d\'extraction (écartement) ==');
    for (const h of r.q3.humaines) L.push(`Partie ${h.partie} : ${h.mauvaisObjets25mm} mauvais objets (≥ 25 mm) sur ${h.cuts} cuts ; règle > ${r.q3.seuilMm} mm de la médiane ${fr(h.mediane)} : ${h.vraisPositifs} trouvés, ${h.fauxPositifs} fausses alertes, ${h.manques} manqués ; plus grand écart parmi les bons ${fr(h.ecartMaxParmiLesBons)} mm, plus petit parmi les mauvais ${fr(h.ecartMinParmiLesMauvais)} mm ; AUC ${fr(h.auc, 3)} ; contre les corrigés de plus de 10 mm : ${h.contre10.vraisPositifs} justes, ${h.contre10.fauxPositifs} à tort.`);
    for (const v of r.q3.validationCroisee) L.push(`${v.apprentissage} → ${v.jugee} : seuil appris ${fr(v.seuilAppris)} mm (plage optimale ${v.plageDesSeuilsOptimaux.map(x => fr(x)).join(' à ')}) ; médiane propre : ${v.parMedianePropre.vraisPositifs} trouvés, ${v.parMedianePropre.fauxPositifs} fausses alertes, ${v.parMedianePropre.manques} manqués ; médiane apprise : ${v.parMedianeApprise.vraisPositifs}/${v.parMedianeApprise.fauxPositifs}/${v.parMedianeApprise.manques} ; seuil du cahier : ${v.seuilDuCahier.vraisPositifs}/${v.seuilDuCahier.fauxPositifs}/${v.seuilDuCahier.manques}.`);
    for (const v of r.q3.verts) {
      L.push(`Verts d'extraction de la partie ${v.partie} : ${v.vertsExtraction} cuts, ${v.corriges10} corrigés > 10 mm, ${v.corriges25} ≥ 25 mm ; règle > ${r.q3.seuilMm} mm : ${v.signales} signalés (contre > 10 mm : ${v.contre10.vraisPositifs} justes, ${v.contre10.fauxPositifs} à tort ; rappel ${pct(v.contre10.rappel, 0)} ; AUC ${fr(v.auc10, 2)} ; contre ≥ 25 mm : ${v.contre25.vraisPositifs}/${v.corriges25} trouvés, rappel ${pct(v.contre25.rappel, 0)}).`);
      if (v.denivele) L.push(`  complément (dénivelé local entre les deux rails, non appris) : AUC ${fr(v.denivele.auc25, 2)} pour ≥ 25 mm, ${fr(v.denivele.auc10, 2)} pour > 10 mm ; ` + v.denivele.parSeuil.map(q => `> ${q.seuilMm} mm : ${q.signales} signalés, ${q.justes25}/${v.corriges25} des ≥ 25 mm ; avec l'écartement : ${q.unionAvecEcartement.justes25}/${v.corriges25} (${q.unionAvecEcartement.signales} signalés, ${q.unionAvecEcartement.justes10}/${v.corriges10} des > 10 mm)`).join(' ; '));
    }
  }
  if (r.q4) {
    L.push('', '== Q4. Biais vertical ==', `Convention : ${r.q4.convention}.`);
    for (const g of r.q4.groupes) L.push(`  ${g.groupe.padEnd(28)} ${Object.entries(g.parPartie).map(([k, q]) => `${k}: moy. ${fr(q.moyenne, 1)} / méd. ${fr(q.mediane, 1)} (n=${q.n})`).join(' ; ')} — signe ${g.signeStable}`);
    L.push('Correction vertical ↔ dz (rails refusés) : ' + r.q4.dz.map(d => `partie ${d.partie} : n=${d.n}, corrélation ${fr(d.correlation, 2)}, pente ${fr(d.pente, 2)}`).join(' ; '));
    L.push('Correction apprise sur une partie, appliquée à l\'autre (cuts corrigés de plus de 10 mm avant → après) :');
    for (const v of r.q4.validationCroisee.filter(x => x.apprentissage.length >= 2 || x.correcteur === 'refusee-seule')) L.push(`  [${v.correcteur}] ${v.apprentissage.join('+')} → ${v.jugee} (${v.appris}) : |vert.| moyen ${fr(v.vertAbsMoyen[0], 2)} → ${fr(v.vertAbsMoyen[1], 2)} ; > 10 mm : ${v.nCorriges10[0]} → ${v.nCorriges10[1]} ; > 5 mm : ${v.nCorriges5[0]} → ${v.nCorriges5[1]} ; améliorés ${v.cutsAmeliores}, aggravés ${v.cutsAggraves}, passés au-dessus de 10 mm : ${v.mauvaisesPosesAjoutees10}`);
    L.push('(les autres correcteurs et paires figurent dans le JSON)');
    L.push('Grille de corrections fixes sur les rails à convention refusée (choisies après coup) :');
    for (const g of r.q4.grilleRefusee) L.push(`  +${g.correctionMm} mm : ` + g.parties.map(q => `partie ${q.partie} > 10 mm ${q.nCorriges10[0]} → ${q.nCorriges10[1]}, > 5 mm ${q.nCorriges5[0]} → ${q.nCorriges5[1]} (aggravés ${q.cutsAggraves}, passés au-dessus de 10 mm : ${q.mauvaisesPosesAjoutees10})`).join(' ; '));
    L.push('Synthèse :');
    for (const q of r.q4.synthese) L.push(`  [${q.correcteur}] ${q.schema} : > 10 mm ${q.nCorriges10[0]} → ${q.nCorriges10[1]} ; > 5 mm ${q.nCorriges5[0]} → ${q.nCorriges5[1]} ; |vert.| moyen ${fr(q.vertAbsMoyen[0], 2)} → ${fr(q.vertAbsMoyen[1], 2)} ; améliorés ${q.cutsAmeliores}, aggravés ${q.cutsAggraves}, passés au-dessus de 10 mm : ${q.mauvaisesPosesAjoutees10}`);
  }
  return L.join('\n') + '\n';
}

/* ------------------------------------------------------------------ ligne de commande */
function lireArguments(argv) {
  const o = { jeux: [], questions: [1, 2, 3, 4], seuilVisiteS: 0.8, bootstrap: 500, graine: 20261016, seuilEcartementMm: 10, json: null, silencieux: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--jeu') o.jeux.push(...argv[++i].split(',').filter(Boolean));
    else if (a === '--questions') o.questions = argv[++i].split(',').map(Number);
    else if (a === '--seuil-visite') o.seuilVisiteS = Number(argv[++i]);
    else if (a === '--bootstrap') o.bootstrap = Number(argv[++i]);
    else if (a === '--graine') o.graine = Number(argv[++i]);
    else if (a === '--seuil-ecartement') o.seuilEcartementMm = Number(argv[++i]);
    else if (a === '--json') o.json = argv[++i];
    else if (a === '--silencieux') o.silencieux = true;
    else if (a === '--partie') o.partie = Manifeste.lireDesignations(argv[++i]);
    else if (a === '--juger-partie-reservee') o.jugerReservee = true;
    else if (a === '--aide' || a === '-h') o.aide = true;
    else throw new Error(`option inconnue : ${a}`);
  }
  if (!o.aide && !o.jeux.length) throw new Error('--jeu fichier.jsonl requis (répétable)');
  return o;
}
function executer(argv) {
  const o = lireArguments(argv);
  if (o.partie && !o.aide) {
    const { avis } = Manifeste.controler(Manifeste.lire(), o.partie, { outil: 'apprentissage-g0', jugerReservee: !!o.jugerReservee });
    if (avis) process.stderr.write(avis + '\n');
  }
  if (o.aide) return { texte: 'usage : node tools/apprentissage-g0.cjs --jeu a.jsonl --jeu b.jsonl [--questions 1,2,3,4] [--seuil-visite 0.8] [--bootstrap 500] [--graine N] [--seuil-ecartement 10] [--json sortie.json] [--silencieux] [--partie projet:partie[,projet:partie…]] [--juger-partie-reservee]\n', code: 0 };
  const resultat = analyser(lireFichiers(o.jeux), o);
  if (o.json) fs.writeFileSync(o.json, JSON.stringify(resultat, null, 1) + '\n');
  return { texte: o.silencieux ? '' : texte(resultat), code: 0, resultat };
}

module.exports = { FORMAT, TRAITS, lireTexte, normaliserPartie, poserTraits, auc, rappelAuTop, partPourRappel, amorcer, ajusterLogistique, ajusterArbre, preparerModele, analyser, texte, executer, lireArguments,
  questionFauxVerts, questionPN, questionEcartement, questionBiais, apprendreCorrecteur, effetCorrecteur, graine };

if (require.main === module) {
  try { const s = executer(process.argv.slice(2)); process.stdout.write(s.texte); process.exit(s.code); }
  catch (e) { process.stderr.write(`apprentissage-g0 : ${e.message}\n`); process.exit(2); }
}
