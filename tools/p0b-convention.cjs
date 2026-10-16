#!/usr/bin/env node
'use strict';
/*
 * p0b-convention.cjs — mesure P0(b) du plan 5.0 : convention refusée et garde de paire. Hors ligne, lecture seule.
 *
 *   node tools/p0b-convention.cjs --lignes lignes-A.json [lignes-B.json …] [--ensemble] [--sortie resultat.json] [--json]
 *   node tools/p0b-convention.cjs --journal J.json [--jointure table.json] [--corpus DOSSIER] [--etiquette NOM] …
 *
 * Entrée : des « lignes » de `tools/p0-commun.cjs` (un rail d'un cut : ce que le moteur a publié, la convention
 * avec ses décalages même refusés, le motif de la décision du lot, et la pose finale de Mic si la jointure
 * Écho ↔ Orbite l'apporte). Chaque jeu de lignes (étiquette) est mesuré à part.
 *
 * Ce que la mesure répond (cahier 5.0, P0(b) et P1) :
 *  1. Rails à convention REFUSÉE (décalage hors du domaine de 8 mm, posés bruts) contre rails CALÉS : erreur à la
 *     pose finale de Mic, verticale d'abord. Le « biais ~9 mm » du cahier est le décalage que la convention
 *     PRÉDIT (dz médian) ; ce qui compte est l'écart réel du rail brut à Mic.
 *  2. Variantes du cahier P1, simulées sur les mêmes rails (la pose d'une variante = pose brute + décalage retenu) :
 *       décalage plafonné (8 mm appliqués, le reste consigné), domaine porté à 12 mm ;
 *       garde de paire portée par le seul rail repêché par S1, ou marge continue (S1 et dz > 10 mm) ;
 *     combien de poses gagnent ou perdent face à Mic (corrections de plus de 5 et de plus de 10 mm).
 *  3. Cuts différés pour 'pair-guard' : amplitude de la correction de Mic (si la pose brute du moteur dépasse
 *     10 mm de Mic, la garde est bonne), et combien seraient récupérés par chaque variante sans mauvaise pose
 *     (porte du cahier : au moins 50 sur 89, aucune mauvaise pose ajoutée).
 *
 * Simulation : le décalage d'une variante vient de `conventionCalibration` (duMm, dzMm) que le journal consigne
 * même quand il est refusé. L'écartement d'une pose récupérée est recalculé comme écartement publié
 * + variation des décalages latéraux (somme des duMm, vérifiée à 0,3 mm près sur 239 paires rejouées).
 * Le garde d'écartement voisin (±20 mm) et les appuis ne sont pas rejoués : voir fiches/P0_MESURES.md, limites.
 */
const fs = require('node:fs');
const P = require('./p0-commun.cjs');
const Gauge = require('../src/gauge.js');

const { fini, arrondi, quantile } = P;
const DOMAINE_MM = 8;        // maxShiftMm de src/placement-convention.js
const PLAFOND_MM = 8;
const DOMAINE_ELARGI_MM = 12;
const MARGE_DZ_MM = 10;
const PORTE_RECUPERES = 50;  // sur 89 dans le cahier
const PORTE_SUR = 89;

/* ------------------------------------------------------------------ politiques de décalage */
const clamp = (x, m) => Math.max(-m, Math.min(m, x));
const aDecalage = l => !!(l.convention && fini(l.convention.duMm) && fini(l.convention.dzMm)
  && (l.convention.appliquee || l.convention.raison === 'shift-out-of-domain'));
const horsDomaine = (l, d) => aDecalage(l) && (Math.abs(l.convention.duMm) > d || Math.abs(l.convention.dzMm) > d);
const candidat = l => !!(l && l.ok && l.moteur && l.moteur.statut === 'candidate' && Array.isArray(l.moteur.deltaBrutMm));

/* Décalage appliqué par une politique : { du, dz } en mm (0 si rien). */
const POLITIQUES = {
  aucune: () => ({ du: 0, dz: 0 }),
  actuelle: l => (aDecalage(l) && !horsDomaine(l, DOMAINE_MM)) ? { du: l.convention.duMm, dz: l.convention.dzMm } : { du: 0, dz: 0 },
  plafond8: l => aDecalage(l) ? { du: clamp(l.convention.duMm, PLAFOND_MM), dz: clamp(l.convention.dzMm, PLAFOND_MM) } : { du: 0, dz: 0 },
  domaine12: l => (aDecalage(l) && !horsDomaine(l, DOMAINE_ELARGI_MM)) ? { du: l.convention.duMm, dz: l.convention.dzMm } : { du: 0, dz: 0 },
  pleine: l => aDecalage(l) ? { du: l.convention.duMm, dz: l.convention.dzMm } : { du: 0, dz: 0 },
};
const plafond = m => l => aDecalage(l) ? { du: clamp(l.convention.duMm, m), dz: clamp(l.convention.dzMm, m) } : { du: 0, dz: 0 };

/* Pose d'un rail sous une politique, [x, y, z] mm dans le repère profil de départ. */
function pose(l, politique) {
  const d = politique(l), b = l.moteur.deltaBrutMm;
  return [b[0], b[1] + (l.signe || 1) * d.du, b[2] + d.dz];
}
function erreur(l, politique) {
  if (!candidat(l) || !l.humainMm) return null;
  return P.erreurDelta(pose(l, politique), l.humainMm);
}

/* ------------------------------------------------------------------ gardes de paire */
const GARDES = {
  /* D-044 : un rail repêché par S1 ET un calage hors domaine sur l'un des deux rails (pas forcément le même). */
  actuelle: (rails, d) => rails.some(l => l.moteur.repeche) && rails.some(l => horsDomaine(l, d)),
  /* Variante : le même rail est repêché ET hors domaine. */
  memeRail: (rails, d) => rails.some(l => l.moteur.repeche && horsDomaine(l, d)),
  /* Variante : marge continue, S1 et dz > 10 mm sur le même rail. */
  marge10: (rails) => rails.some(l => l.moteur.repeche && aDecalage(l) && Math.abs(l.convention.dzMm) > MARGE_DZ_MM),
  aucune: () => false,
};

/* Scénarios : une politique de décalage + une garde. Tous signalent un SOUS-ENSEMBLE des cuts que la garde
 * actuelle signale, donc aucun cut posé aujourd'hui n'est différé par une variante. */
const SCENARIOS = [
  { id: 'S0', nom: 'actuel (domaine 8 mm, garde D-044)', politique: 'actuelle', garde: 'actuelle', domaine: DOMAINE_MM },
  { id: 'S1', nom: 'décalage plafonné à 8 mm, garde actuelle', politique: 'plafond8', garde: 'actuelle', domaine: DOMAINE_MM },
  { id: 'S2', nom: 'domaine porté à 12 mm, garde actuelle', politique: 'domaine12', garde: 'actuelle', domaine: DOMAINE_ELARGI_MM },
  { id: 'S3', nom: 'plafond 8 mm, garde portée par le seul rail repêché', politique: 'plafond8', garde: 'memeRail', domaine: DOMAINE_MM },
  { id: 'S4', nom: 'domaine 12 mm, garde portée par le seul rail repêché', politique: 'domaine12', garde: 'memeRail', domaine: DOMAINE_ELARGI_MM },
  { id: 'S5', nom: 'plafond 8 mm, garde par marge continue (S1 et dz > 10 mm)', politique: 'plafond8', garde: 'marge10', domaine: DOMAINE_MM },
  { id: 'S6', nom: 'plafond 8 mm, sans garde de paire (borne haute)', politique: 'plafond8', garde: 'aucune', domaine: DOMAINE_MM },
];
const signale = (sc, rails) => GARDES[sc.garde](rails, sc.domaine);

/* ------------------------------------------------------------------ regroupement par cut */
function parCut(lignes) {
  const m = new Map();
  for (const l of lignes) {
    const k = `${l.partie}|${l.cut}`;
    if (!m.has(k)) m.set(k, { cle: k, partie: l.partie, cut: l.cut, classe: l.classe || null, decision: l.decision || null, paire: l.paire || null, lignes: {} });
    m.get(k).lignes[l.cote] = l;
  }
  return [...m.values()];
}
const deuxRails = c => (c.lignes.left && c.lignes.right && candidat(c.lignes.left) && candidat(c.lignes.right)) ? [c.lignes.left, c.lignes.right] : null;

/* ------------------------------------------------------------------ statistiques de rails */
function statsRails(erreurs) {
  const e = erreurs.filter(Boolean);
  const vert = e.map(x => x.vert), d3 = e.map(x => x.d3);
  return {
    n: e.length,
    vertSigneMedianMm: arrondi(quantile(vert, .5)),
    vertAbsMedianeMm: arrondi(quantile(vert.map(Math.abs), .5)), vertAbsP90Mm: arrondi(quantile(vert.map(Math.abs), .9)),
    latSigneMedianMm: arrondi(quantile(e.map(x => x.lat), .5)),
    d3MedianeMm: arrondi(quantile(d3, .5)), d3P90Mm: arrondi(quantile(d3, .9)),
    plus5: P.compte(d3, 5), plus10: P.compte(d3, 10),
  };
}
function statsCuts(maxErreurs) {
  const v = maxErreurs.filter(fini);
  return { n: v.length, medianeMm: arrondi(quantile(v, .5)), p90Mm: arrondi(quantile(v, .9)), maxMm: v.length ? arrondi(Math.max(...v)) : null, plus5: P.compte(v, 5), plus10: P.compte(v, 10) };
}
const maxD3 = (rails, politique) => {
  const e = rails.map(l => erreur(l, politique));
  return e.every(Boolean) ? Math.max(...e.map(x => x.d3)) : null;
};

/* Écartement prédit d'une pose récupérée : écartement publié + variation des décalages latéraux. */
function ecartementVariante(rails, politique) {
  const base = rails.map(l => l.ecartement && fini(l.ecartement.predit) ? l.ecartement.predit : null);
  if (base.some(b => b === null)) return null;
  const variation = rails.reduce((s, l) => s + politique(l).du - POLITIQUES.actuelle(l).du, 0);
  return base[0] + variation;
}
const admissible = mm => mm === null ? null : Gauge.admissible(Gauge.classifyMm(mm));

/* ------------------------------------------------------------------ analyse d'un jeu de lignes */
function analyserJeu(lignes) {
  const cuts = parCut(lignes);
  const res = { rails: lignes.length, cuts: cuts.length };

  /* --- comptes (tout le jeu, avec ou sans vérité) --- */
  const candidats = lignes.filter(candidat);
  const refuses = candidats.filter(l => horsDomaine(l, DOMAINE_MM));
  const dzRefuses = refuses.map(l => Math.abs(l.convention.dzMm));
  res.comptes = {
    railsCandidats: candidats.length,
    railsCales: candidats.filter(l => l.convention && l.convention.appliquee).length,
    railsRefuses: refuses.length,
    railsRefusesDansCutsPosesPremierPassage: refuses.filter(l => l.decision && l.decision.etage === 'first-pass').length,
    railsSansCalage: candidats.filter(l => !aDecalage(l)).length,
    dzRefusesMm: { mediane: arrondi(quantile(dzRefuses, .5)), p10: arrondi(quantile(dzRefuses, .1)), p90: arrondi(quantile(dzRefuses, .9)), max: arrondi(dzRefuses.length ? Math.max(...dzRefuses) : null) },
    refusesVerticaux: refuses.filter(l => Math.abs(l.convention.dzMm) > DOMAINE_MM && Math.abs(l.convention.duMm) <= DOMAINE_MM).length,
    refusesLateraux: refuses.filter(l => Math.abs(l.convention.duMm) > DOMAINE_MM).length,
  };
  const enCuts = cuts.map(c => ({ c, rails: deuxRails(c) }));
  /* Cuts « posés » : posés au premier passage d'après le journal ; sans journal (rejeu d'un Écho, cuts que
   * l'Écho a vus et Ariane non), ceux que la garde actuelle ne signale pas — pose hypothétique, marquée comme telle. */
  const estPose = x => x.rails && (x.c.decision ? x.c.decision.etage === 'first-pass' : !signale(SCENARIOS[0], x.rails));
  const poses = enCuts.filter(estPose);
  res.comptes.cutsPosesAnalyses = poses.length;
  const gardesJournal = cuts.filter(c => c.decision && c.decision.raison === 'pair-guard');
  const gardesFormule = enCuts.filter(x => x.rails && signale(SCENARIOS[0], x.rails));
  const concordance = gardesJournal.filter(c => gardesFormule.some(x => x.c.cle === c.cle)).length;
  res.comptes.cuts = {
    total: cuts.length,
    posesPremierPassage: cuts.filter(c => c.decision && c.decision.etage === 'first-pass').length,
    differes: cuts.filter(c => c.decision && c.decision.etage === 'deferred').length,
    pairGuardAuJournal: gardesJournal.length,
    pairGuardParLaFormule: gardesFormule.length,
    pairGuardConcordants: concordance,
  };

  /* --- vérité : tout ce qui suit demande la pose finale de Mic --- */
  const verite = {};
  const avecH = l => candidat(l) && l.humainMm;
  const railsPosesVrai = [];
  for (const x of poses) for (const l of x.rails) if (avecH(l)) railsPosesVrai.push(l);
  verite.railsPosesPremierPassageAvecReference = railsPosesVrai.length;

  /* 1. refusés contre calés, mesurés à la pose réellement publiée par la politique actuelle */
  const groupe = (f) => statsRails(railsPosesVrai.filter(f).map(l => erreur(l, POLITIQUES.actuelle)));
  verite.railsParGroupe = {
    cales: groupe(l => l.convention && l.convention.appliquee),
    refuses: groupe(l => horsDomaine(l, DOMAINE_MM)),
    sansCalage: groupe(l => !aDecalage(l)),
  };
  verite.railsParGroupe.refusesSiPleine = statsRails(railsPosesVrai.filter(l => horsDomaine(l, DOMAINE_MM)).map(l => erreur(l, POLITIQUES.pleine)));
  verite.railsParGroupe.refusesSiPlafond8 = statsRails(railsPosesVrai.filter(l => horsDomaine(l, DOMAINE_MM)).map(l => erreur(l, POLITIQUES.plafond8)));
  verite.railsParGroupe.calesSansCalage = statsRails(railsPosesVrai.filter(l => l.convention && l.convention.appliquee).map(l => erreur(l, POLITIQUES.aucune)));

  /* Intervalles à 95 % de la médiane de l'erreur verticale absolue, et comparaison appariée sur les mêmes rails
   * refusés : (erreur 3D avec la variante) − (erreur 3D posée brute) ; négatif = la variante rapproche de Mic. */
  const refusesVrai0 = railsPosesVrai.filter(l => horsDomaine(l, DOMAINE_MM));
  const calesVrai0 = railsPosesVrai.filter(l => l.convention && l.convention.appliquee);
  verite.railsParGroupe.refuses.ic95VertAbs = P.icMediane(refusesVrai0.map(l => Math.abs(erreur(l, POLITIQUES.actuelle).vert)));
  verite.railsParGroupe.cales.ic95VertAbs = P.icMediane(calesVrai0.map(l => Math.abs(erreur(l, POLITIQUES.actuelle).vert)));
  verite.refusesVariantesContreBrut = {};
  for (const [nom, pol] of [['plafond8', POLITIQUES.plafond8], ['domaine12', POLITIQUES.domaine12], ['pleine', POLITIQUES.pleine]]) {
    const diff = refusesVrai0.map(l => erreur(l, pol).d3 - erreur(l, POLITIQUES.actuelle).d3);
    verite.refusesVariantesContreBrut[nom] = { n: diff.length, diffMedianeMm: arrondi(quantile(diff, .5)), ic95: P.icMediane(diff), signes: P.testeSignes(diff, 0.05) };
  }
  /* tranches du décalage prédit (le plus grand des deux) : où le calage reste-t-il utile ? */
  const tranches = [[8, 10], [10, 12], [12, 15], [15, Infinity]];
  verite.refusesParTranche = tranches.map(([a, b]) => {
    const sel = railsPosesVrai.filter(l => horsDomaine(l, DOMAINE_MM)).filter(l => { const m = Math.max(Math.abs(l.convention.dzMm), Math.abs(l.convention.duMm)); return m > a && m <= b; });
    return { tranche: b === Infinity ? `> ${a}` : `${a}–${b}`, brut: statsRails(sel.map(l => erreur(l, POLITIQUES.aucune))),
      plafond8: statsRails(sel.map(l => erreur(l, POLITIQUES.plafond8))), pleine: statsRails(sel.map(l => erreur(l, POLITIQUES.pleine))) };
  });
  /* Le décalage vertical que la convention PRÉDIT (dz) contre celui que Mic applique réellement (pose de Mic − pose
   * brute du moteur), par tranche de dz, sur tous les rails posés avec décalage (calés et refusés). Un rapport
   * proche de 1 valide le calage ; un rapport qui s'effondre au-delà d'un seuil dit que dz y est en partie du bruit. */
  const avecDz = railsPosesVrai.filter(aDecalage);
  verite.dzPredictContreMic = [[-Infinity, 2], [2, 4], [4, 6], [6, 8], [8, 10], [10, 12], [12, Infinity]].map(([a, b]) => {
    const sel = avecDz.filter(l => l.convention.dzMm >= a && l.convention.dzMm < b);
    const dz = sel.map(l => l.convention.dzMm), dep = sel.map(l => l.humainMm[2] - l.moteur.deltaBrutMm[2]);
    const md = quantile(dz, .5), mm = quantile(dep, .5);
    return { tranche: a === -Infinity ? `< ${b}` : b === Infinity ? `≥ ${a}` : `${a}–${b}`, n: sel.length, dzPredictMedianMm: arrondi(md), deplacementDeMicMedianMm: arrondi(mm), rapport: sel.length && md ? arrondi(mm / md) : null };
  }).filter(t => t.n);
  {
    const xs = avecDz.map(l => l.convention.dzMm), ys = avecDz.map(l => l.humainMm[2] - l.moteur.deltaBrutMm[2]);
    const n = xs.length, mx = n ? xs.reduce((a, b) => a + b, 0) / n : 0, my = n ? ys.reduce((a, b) => a + b, 0) / n : 0;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    verite.regressionDeplacementSurDz = sxx > 0 ? { n, pente: arrondi(sxy / sxx), ordonneeMm: arrondi(my - sxy / sxx * mx) } : null;
  }
  /* balayage du plafond sur les rails refusés */
  const refusesVrai = railsPosesVrai.filter(l => horsDomaine(l, DOMAINE_MM));
  verite.balayagePlafond = [0, 4, 6, 8, 10, 12, 100].map(m => {
    const pol = m === 0 ? POLITIQUES.aucune : plafond(m);
    const e = refusesVrai.map(l => erreur(l, pol)).filter(Boolean);
    return { plafondMm: m === 100 ? 'sans' : m, n: e.length, vertAbsMedianeMm: arrondi(quantile(e.map(x => Math.abs(x.vert)), .5)), d3MedianeMm: arrondi(quantile(e.map(x => x.d3), .5)),
      d3P90Mm: arrondi(quantile(e.map(x => x.d3), .9)), plus5: P.compte(e.map(x => x.d3), 5), plus10: P.compte(e.map(x => x.d3), 10) };
  });

  /* 2. scénarios sur les cuts posés au premier passage (rails brut/calé/refusé) */
  const cutsPosesVrai = poses.filter(x => x.rails.every(l => l.humainMm));
  const base = cutsPosesVrai.map(x => maxD3(x.rails, POLITIQUES[SCENARIOS[0].politique]));
  verite.cutsPosesPremierPassageAvecReference = cutsPosesVrai.length;
  /* Une variante qui change le décalage latéral change l'écartement prédit : les cuts posés dont l'écartement sortirait
   * du contrat (1420–1470 mm) seraient différés par la garde d'écartement au lieu d'être posés. Compté sur TOUS les cuts
   * posés du jeu, avec ou sans pose de Mic. */
  const horsContratNouveau = (sc) => poses.filter(x => admissible(ecartementVariante(x.rails, POLITIQUES[SCENARIOS[0].politique])) !== false
    && admissible(ecartementVariante(x.rails, POLITIQUES[sc.politique])) === false).length;
  /* L'écart de la pose du moteur à la prédiction des voisins (celui que la décision du lot consigne, plafonné à 30 mm)
   * trie-t-il les poses fausses ? AUC contre « le cut posé est corrigé de plus de 10 mm » (0,5 = aucun tri). */
  {
    const avecEcart = cutsPosesVrai.filter(x => x.c.decision && fini(x.c.decision.ecartVoisinsMm));
    const faux = avecEcart.map(x => maxD3(x.rails, POLITIQUES[SCENARIOS[0].politique]) > P.MAUVAISE_POSE_MM);
    verite.ecartAuxVoisinsContreErreur = { cuts: avecEcart.length, corrigesPlus10: faux.filter(Boolean).length, auc: P.auc(avecEcart.map(x => x.c.decision.ecartVoisinsMm), faux) };
  }
  verite.scenariosPoses = SCENARIOS.map(sc => {
    const pol = POLITIQUES[sc.politique];
    const cur = cutsPosesVrai.map(x => maxD3(x.rails, pol));
    const gagne = t => cur.filter((v, i) => base[i] > t && v <= t).length, perd = t => cur.filter((v, i) => base[i] <= t && v > t).length;
    const e = cutsPosesVrai.flatMap(x => x.rails.map(l => erreur(l, pol)));
    return { id: sc.id, nom: sc.nom, cuts: statsCuts(cur), rails: statsRails(e), gagnes5: gagne(5), perdus5: perd(5), gagnes10: gagne(10), perdus10: perd(10), cutsPosesParLeJeu: poses.length, nouveauxHorsContratEcartement: horsContratNouveau(sc) };
  });

  /* 3. cuts signalés par la garde de paire */
  const gp = { cuts: gardesFormule.length, avecDeuxReferences: 0 };
  const gpVrai = gardesFormule.filter(x => x.rails.every(l => l.humainMm));
  gp.avecDeuxReferences = gpVrai.length;
  const amplitude = (pol) => statsCuts(gpVrai.map(x => maxD3(x.rails, pol)));
  gp.correctionDeMic = {
    poseBrute: amplitude(POLITIQUES.aucune),
    poseDuMoteurActuelle: amplitude(POLITIQUES.actuelle),
    posePlafond8: amplitude(plafond(8)),
    posePleine: amplitude(POLITIQUES.pleine),
  };
  gp.railsDeCesCuts = {
    repechesParS1: gardesFormule.reduce((s, x) => s + x.rails.filter(l => l.moteur.repeche).length, 0),
    horsDomaine: gardesFormule.reduce((s, x) => s + x.rails.filter(l => horsDomaine(l, DOMAINE_MM)).length, 0),
    memeRailRepecheEtHorsDomaine: gardesFormule.filter(x => GARDES.memeRail(x.rails, DOMAINE_MM)).length,
    margeDzSup10: gardesFormule.filter(x => GARDES.marge10(x.rails)).length,
  };
  /* de combien S1 a déplacé le rail repêché, par rapport à la graine d'origine de A* (mm, repère profil) */
  const deplS1 = [];
  for (const x of gardesFormule) for (const l of x.rails) if (l.moteur.repeche && l.moteur.astar && l.moteur.astar.deltaMm) {
    const a = l.moteur.astar.deltaMm, b = l.moteur.deltaBrutMm;
    deplS1.push(Math.hypot(a[1] - b[1], a[2] - b[2]));
  }
  gp.deplacementS1Mm = { n: deplS1.length, mediane: arrondi(quantile(deplS1, .5)), p90: arrondi(quantile(deplS1, .9)) };
  gp.recuperes = SCENARIOS.map(sc => {
    const pol = POLITIQUES[sc.politique];
    const libres = gardesFormule.filter(x => !signale(sc, x.rails));
    const adm = libres.map(x => admissible(ecartementVariante(x.rails, pol)));
    const ok = libres.filter((x, i) => adm[i] !== false);
    const vrai = ok.filter(x => x.rails.every(l => l.humainMm));
    const mauvaises = vrai.filter(x => maxD3(x.rails, pol) > P.MAUVAISE_POSE_MM);
    return { id: sc.id, nom: sc.nom, recuperesParLaGarde: libres.length, ecartementHorsContrat: libres.length - ok.length,
      recuperesAdmissibles: ok.length, avecReference: vrai.length, mauvaisesPoses: mauvaises.length,
      mauvaisesPlus5: vrai.filter(x => maxD3(x.rails, pol) > 5).length,
      erreurMaxMm: vrai.length ? arrondi(Math.max(...vrai.map(x => maxD3(x.rails, pol)))) : null };
  });
  res.verite = verite;
  res.gardeDePaire = gp;
  return res;
}

/* ------------------------------------------------------------------ analyse de plusieurs jeux */
function analyser(lignes, { ensemble = false } = {}) {
  const jeux = new Map();
  for (const l of lignes) { const k = l.etiquette || 'jeu'; if (!jeux.has(k)) jeux.set(k, []); jeux.get(k).push(l); }
  if (ensemble && jeux.size > 1) jeux.set('ensemble', lignes.map(l => ({ ...l, etiquette: 'ensemble' })));
  const out = { format: 'ariane-p0b-v1', creeLe: new Date().toISOString(), regles: {
    domaineMm: DOMAINE_MM, plafondMm: PLAFOND_MM, domaineElargiMm: DOMAINE_ELARGI_MM, margeDzMm: MARGE_DZ_MM, mauvaisePoseMm: P.MAUVAISE_POSE_MM,
    porte: { recuperes: PORTE_RECUPERES, sur: PORTE_SUR, mauvaisesPoses: 0 } }, scenarios: SCENARIOS.map(s => ({ id: s.id, nom: s.nom })), jeux: {} };
  for (const [k, v] of jeux) out.jeux[k] = analyserJeu(v);
  return out;
}

/* ------------------------------------------------------------------ rapport lisible */
const f1 = v => v === null || v === undefined ? '–' : String(v).replace('.', ',');
function texte(r) {
  const L = [];
  for (const [k, j] of Object.entries(r.jeux)) {
    const c = j.comptes, v = j.verite, g = j.gardeDePaire;
    L.push(`=== ${k} : ${j.rails} rails, ${j.cuts} cuts ===`);
    L.push(`Rails candidats ${c.railsCandidats} : calés ${c.railsCales}, refusés (décalage > ${r.regles.domaineMm} mm) ${c.railsRefuses} (dont ${c.railsRefusesDansCutsPosesPremierPassage} dans des cuts posés au premier passage), sans calage ${c.railsSansCalage}.`);
    L.push(`Décalage prédit des refusés : médiane ${f1(c.dzRefusesMm.mediane)} mm (P10 ${f1(c.dzRefusesMm.p10)}, P90 ${f1(c.dzRefusesMm.p90)}, max ${f1(c.dzRefusesMm.max)}) ; ${c.refusesLateraux} refusés pour le latéral.`);
    L.push(`Cuts : ${c.cuts.total}, posés au premier passage (journal) ${c.cuts.posesPremierPassage}, posés pour l'analyse (journal ou, au rejeu d'un Écho, hypothétiques) ${c.cutsPosesAnalyses}, différés ${c.cuts.differes}, 'pair-guard' au journal ${c.cuts.pairGuardAuJournal}, par la formule ${c.cuts.pairGuardParLaFormule} (concordants ${c.cuts.pairGuardConcordants}).`);
    if (!v.railsPosesPremierPassageAvecReference) { L.push('Pas de référence humaine dans ce jeu : comptes seulement.', ''); continue; }
    L.push(`Rails des cuts posés (voir ci-dessus) avec la pose de Mic : ${v.railsPosesPremierPassageAvecReference}.`);
    const lg = (nom, s) => L.push(`  ${nom.padEnd(26)} n=${String(s.n).padStart(3)}  vertical signé ${f1(s.vertSigneMedianMm)} mm  |vert| méd ${f1(s.vertAbsMedianeMm)} P90 ${f1(s.vertAbsP90Mm)}  3D méd ${f1(s.d3MedianeMm)} P90 ${f1(s.d3P90Mm)}  >5 mm ${s.plus5}  >10 mm ${s.plus10}`);
    lg('calés', v.railsParGroupe.cales); lg('refusés (posés bruts)', v.railsParGroupe.refuses);
    lg('refusés si plafonnés à 8', v.railsParGroupe.refusesSiPlafond8); lg('refusés si calage plein', v.railsParGroupe.refusesSiPleine);
    lg('sans calage possible', v.railsParGroupe.sansCalage); lg('calés, sans leur calage', v.railsParGroupe.calesSansCalage);
    for (const [n, c] of Object.entries(v.refusesVariantesContreBrut)) L.push(`  rails refusés, ${n.padEnd(9)} contre posé brut (erreur 3D) : Δ médiane ${f1(c.diffMedianeMm)} mm ${c.ic95 ? '[' + c.ic95.map(f1).join(' ; ') + ']' : ''}, rapproche ${c.signes.gagne} / éloigne ${c.signes.perd}, p=${f1(c.signes.p)}`);
    L.push('Rails refusés par tranche de décalage prédit (brut / plafond 8 / plein, |vert| médiane et >10 mm) :');
    for (const t of v.refusesParTranche) L.push(`  ${t.tranche.padEnd(7)} n=${String(t.brut.n).padStart(3)}  brut ${f1(t.brut.vertAbsMedianeMm)} (${t.brut.plus10})  plafond ${f1(t.plafond8.vertAbsMedianeMm)} (${t.plafond8.plus10})  plein ${f1(t.pleine.vertAbsMedianeMm)} (${t.pleine.plus10})`);
    L.push('Décalage vertical prédit (dz) contre déplacement réel de Mic (pose de Mic − pose brute), rails posés avec décalage :');
    for (const t of v.dzPredictContreMic) L.push(`  dz ${t.tranche.padEnd(7)} n=${String(t.n).padStart(3)}  dz médian ${f1(t.dzPredictMedianMm)}  Mic ${f1(t.deplacementDeMicMedianMm)}  rapport ${f1(t.rapport)}`);
    if (v.regressionDeplacementSurDz) L.push(`  régression du déplacement de Mic sur dz : pente ${f1(v.regressionDeplacementSurDz.pente)}, ordonnée ${f1(v.regressionDeplacementSurDz.ordonneeMm)} mm (n=${v.regressionDeplacementSurDz.n})`);
    L.push('Balayage du plafond sur les rails refusés :');
    for (const b of v.balayagePlafond) L.push(`  plafond ${String(b.plafondMm).padEnd(5)} n=${b.n}  |vert| méd ${f1(b.vertAbsMedianeMm)}  3D méd ${f1(b.d3MedianeMm)} P90 ${f1(b.d3P90Mm)}  >5 ${b.plus5}  >10 ${b.plus10}`);
    if (v.ecartAuxVoisinsContreErreur.cuts) L.push(`Écart de la pose aux voisins (décision du lot) contre « corrigé de plus de 10 mm » : ${v.ecartAuxVoisinsContreErreur.cuts} cuts, ${v.ecartAuxVoisinsContreErreur.corrigesPlus10} corrigés, AUC ${f1(v.ecartAuxVoisinsContreErreur.auc)}.`);
    L.push(`Cuts posés avec les deux références : ${v.cutsPosesPremierPassageAvecReference}. Scénarios (erreur du pire rail du cut) :`);
    for (const s of v.scenariosPoses) L.push(`  ${s.id}  écartement hors contrat en plus : ${s.nouveauxHorsContratEcartement}/${s.cutsPosesParLeJeu} cuts  >5 mm ${s.cuts.plus5}  >10 mm ${s.cuts.plus10}  médiane ${f1(s.cuts.medianeMm)} P90 ${f1(s.cuts.p90Mm)}  | face à S0 : >5 mm gagnés ${s.gagnes5} perdus ${s.perdus5} ; >10 mm gagnés ${s.gagnes10} perdus ${s.perdus10}   ${s.nom}`);
    L.push(`Garde de paire : ${g.cuts} cuts signalés (${g.avecDeuxReferences} avec la pose de Mic aux deux rails). Rails repêchés ${g.railsDeCesCuts.repechesParS1}, hors domaine ${g.railsDeCesCuts.horsDomaine} ; même rail repêché et hors domaine : ${g.railsDeCesCuts.memeRailRepecheEtHorsDomaine} cuts ; marge dz > 10 mm : ${g.railsDeCesCuts.margeDzSup10} cuts. Déplacement de S1 sur le rail repêché : médiane ${f1(g.deplacementS1Mm.mediane)} mm (P90 ${f1(g.deplacementS1Mm.p90)}).`);
    for (const [n, s] of Object.entries(g.correctionDeMic)) L.push(`  correction de Mic, ${n.padEnd(22)} n=${s.n}  méd ${f1(s.medianeMm)} P90 ${f1(s.p90Mm)} max ${f1(s.maxMm)}  >5 mm ${s.plus5}  >10 mm ${s.plus10}`);
    L.push('  Récupérés par scénario (admissible = écartement dans le contrat) :');
    for (const s of g.recuperes) L.push(`  ${s.id}  récupérés ${s.recuperesParLaGarde}  hors contrat d'écartement ${s.ecartementHorsContrat}  admissibles ${s.recuperesAdmissibles}  avec référence ${s.avecReference}  mauvaises poses (>10 mm) ${s.mauvaisesPoses}  (>5 mm ${s.mauvaisesPlus5}, max ${f1(s.erreurMaxMm)})`);
    L.push('');
  }
  return L.join('\n');
}

/* ------------------------------------------------------------------ ligne de commande */
function main() {
  const argv = process.argv.slice(2);
  const sortie = argv.indexOf('--sortie') >= 0 ? argv[argv.indexOf('--sortie') + 1] : null;
  const json = argv.includes('--json'), ensemble = argv.includes('--ensemble');
  const reste = argv.filter((a, i) => !['--json', '--ensemble', '--sortie'].includes(a) && argv[i - 1] !== '--sortie');
  const opt = P.lireArgs(reste);
  if (!opt.lignes.length && !opt.journal && !opt.echo.length) {
    console.error('Usage : node tools/p0b-convention.cjs --lignes lignes.json… [--sortie res.json] [--json]\n   ou  --journal J.json [--jointure table.json] [--corpus DOSSIER] [--etiquette NOM]');
    process.exit(1);
  }
  const lignes = P.chargerLignes(opt, m => console.error(m));
  const r = analyser(lignes, { ensemble });
  if (sortie) fs.writeFileSync(sortie, JSON.stringify(r, null, 1) + '\n');
  console.log(json ? JSON.stringify(r, null, 1) : texte(r));
}
if (require.main === module) try { main(); } catch (e) { console.error(e.message); process.exitCode = 1; }

module.exports = { DOMAINE_MM, POLITIQUES, GARDES, SCENARIOS, aDecalage, horsDomaine, pose, erreur, parCut, analyserJeu, analyser, texte, ecartementVariante };
