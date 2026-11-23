(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../vendor/capture-core.js'),
      require('./placement-convention.js')
    );
  } else {
    root.BananeRelectureCasParticuliers = factory(
      root.BananeCaptureCore,
      root.BananePlacementConvention
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C, Convention) {
  'use strict';
  /* CH-159 (D-382, opérateur, 23/11/2026) — CAS PARTICULIERS DE RELECTURE, SAUT BORNÉ CONFIRMÉ (SKIP VÉRITABLE 1C),
   * POSE SUR SOUS-NAPPE NON DÉFORMÉE (2A) ET SEUIL DE 10 % D'ÉCHECS PAR PORTION D'AU PLUS 10 000 ER.
   *
   * Module pur et testable : il n'émet aucune requête réseau et ne modifie jamais `src/placement-convention.js`.
   *  - Cas 1 à 4 (`evaluerSautBorne`) : lacune de cœur d'aiguille (Kmax = 4), nappes de scanners nettement séparées (Kmax = 5),
   *    rail invisible (Kmax = 4), décalibration à faible vitesse (Kmax = 6), encadrés par M = 2 voisines saines de chaque côté.
   *    Au-delà de Kmax sans réapparition d'un rail normal : ne pas sauter, reprendre coupe par coupe.
   *  - Gardes d'envoi (`peutEnvoyerSkipBorne`, `verifierGardeSkipBorne`, `executerSkipBorneSiPermis`) : un vrai SKIP n'est envoyé
   *    à ESV que pour un saut borné confirmé dans les bornes, avec réglage actif, identité conforme, et JAMAIS sur un cut déjà
   *    `valid` dans ESV (verrou anti-vert-validé).
   *  - Cas 5 (`poserSousNappeSaine`, 2A) : en relecture seulement, en présence d'un artefact d'un scanner sur deux (ex. rail poli),
   *    retenir par géométrie la sous-nappe non déformée (fidélité au gabarit U50, accord avec le rail opposé + écartement de référence,
   *    continuité avec les voisines saines, `rawDelta`) ; s'abstenir si les nappes ne sont pas départageables de façon fiable.
   *    Les attributs `rgba`/`color`/`rgb` et `pointSourceID`/`source`/`scannerId`, s'ils sont présents, servent en appoint journalisé.
   *  - Cas 6 (`bilanPortions`) : découpage fixe par partie en tranches d'au plus 10 000 ER (1 ER = 1 coupe), taux d'échec calculé sur
   *    toutes les coupes de la portion selon la définition verrouillée D-382 ; si une portion dépasse 10 % d'échecs, passage à la
   *    partie suivante (motif `qualite-portion`). */

  const VERSION = 'relecture-cas-particuliers-v1';
  const SIDES = ['left', 'right'];
  const MOTIFS_SAUT = Object.freeze(['lacune-coeur', 'nappes-separees', 'rail-invisible', 'decalibration']);
  const K_MAX = Object.freeze({
    'lacune-coeur': 4,
    'nappes-separees': 5,
    'rail-invisible': 4,
    'decalibration': 6,
  });
  const ATTRIBUTS_SOURCE = Object.freeze([
    'pointSourceID', 'pointSourceId', 'source', 'chain', 'chainId', 'chainID', 'scannerId', 'scannerID',
  ]);
  const ATTRIBUTS_COULEUR = Object.freeze(['rgba', 'color', 'rgb']);

  const DEFAULTS = Object.freeze({
    version: VERSION,
    actif: true,
    envoiSkip: true,
    poseSousNappe: true,
    basculePartie10Pct: true,
    voisinesSainesMin: 2,
    kMax: K_MAX,
    seuils: Object.freeze({
      topRowsFortMin: 15,
      faceCountFortMin: 6,
      residuMaxMm: 4,
      ecartementMaxMm: 8,
      flecheInterpMaxMm: 15,
      epaisseurNappesMinMm: 14,
      separationNappesMinMm: 8,
      partModeMin: 0.2,
      pointsModeMin: 5,
      pointsDessusInvisibleMax: 10,
      pointsDessusFaibleMax: 15,
      pointsFlancInvisibleMax: 3,
      diffRailsDecalMaxMm: 6,
      pasRatioMin: 0.4,
      pasRatioMax: 2.2,
      accordEcartementSousNappeMaxMm: 6,
      accordVoisinesSousNappeMaxMm: 10,
      residuSousNappeMaxMm: 3.5,
    }),
    portions: Object.freeze({
      portionMaxEr: 10000,
      seuilEchecMaxPct: 10,
      qualiteCiblePct: 95,
      actionDepassement: 'partie-suivante',
      motifDepassement: 'qualite-portion',
    }),
  });

  const entier = v => Number.isInteger(v) && v >= 0;
  const fini = Number.isFinite;
  const r2 = v => (fini(v) ? Math.round(v * 100) / 100 + 0 : null);

  function reglage(options) {
    const globalCfg = typeof globalThis !== 'undefined' ? globalThis.BananeSettings?.relectureCasParticuliers : null;
    const g = globalCfg && typeof globalCfg === 'object' ? globalCfg : {};
    const o = options && typeof options === 'object' ? options : {};
    return {
      ...DEFAULTS,
      ...g,
      ...o,
      kMax: { ...DEFAULTS.kMax, ...(g.kMax || {}), ...(o.kMax || {}) },
      seuils: { ...DEFAULTS.seuils, ...(g.seuils || {}), ...(o.seuils || {}) },
      portions: { ...DEFAULTS.portions, ...(g.portions || {}), ...(o.portions || {}) },
    };
  }

  function centile(valeurs, p) {
    const v = (Array.isArray(valeurs) ? valeurs : []).filter(fini).sort((a, b) => a - b);
    if (!v.length) return null;
    return v[Math.min(v.length - 1, Math.floor(p * v.length))];
  }

  /* Détection de bimodalité (deux sous-nappes séparées) dans un tableau d'écarts en mm (dessus ou flanc). */
  function detecterModesBande(valeurs, cfg = DEFAULTS) {
    const v = (Array.isArray(valeurs) ? valeurs : []).filter(fini).sort((a, b) => a - b);
    const n = v.length;
    if (!n) return { bimodal: false, epaisseurMm: null, separationMm: 0, valleeMm: null, modes: [] };
    const q10 = v[Math.min(n - 1, Math.floor(0.1 * n))];
    const q90 = v[Math.min(n - 1, Math.floor(0.9 * n))];
    const epaisseurMm = r2(q90 - q10);
    const minCount = Math.max(cfg.seuils.pointsModeMin || 5, Math.ceil((cfg.seuils.partModeMin || 0.2) * n));
    if (n < 2 * minCount) return { bimodal: false, epaisseurMm, separationMm: 0, valleeMm: null, modes: [] };

    let meilleurGap = 0;
    let indexCoupe = -1;
    for (let i = minCount - 1; i < n - minCount; i++) {
      const gap = v[i + 1] - v[i];
      if (gap > meilleurGap) {
        meilleurGap = gap;
        indexCoupe = i;
      }
    }
    if (indexCoupe < 0) indexCoupe = Math.floor(n / 2) - 1;
    const bas = v.slice(0, indexCoupe + 1);
    const haut = v.slice(indexCoupe + 1);
    const m1 = centile(bas, 0.5);
    const m2 = centile(haut, 0.5);
    const separationMm = fini(m1) && fini(m2) ? r2(m2 - m1) : 0;
    const valleeMm = r2((v[indexCoupe] + v[indexCoupe + 1]) / 2);
    const modes = [
      { centreMm: r2(m1), count: bas.length, part: r2(bas.length / n) },
      { centreMm: r2(m2), count: haut.length, part: r2(haut.length / n) },
    ];
    const bimodal =
      bas.length >= minCount &&
      haut.length >= minCount &&
      separationMm >= (cfg.seuils.separationNappesMinMm || 8) &&
      (meilleurGap >= 2.0 || epaisseurMm >= (cfg.seuils.epaisseurNappesMinMm || 14));
    return { bimodal, epaisseurMm, separationMm, valleeMm, meilleurGapMm: r2(meilleurGap), modes };
  }

  function railFort(railSci, cfg = DEFAULTS) {
    if (!railSci || railSci.ok === false) return false;
    const n = railSci.next;
    if (!n || n.status !== 'candidate') return false;
    if (!fini(n.topRows) || n.topRows < cfg.seuils.topRowsFortMin) return false;
    if (!fini(n.faceCount) || n.faceCount < cfg.seuils.faceCountFortMin) return false;
    if (n.slopeLimited === true || railSci.publishedWeak === true) return false;
    if (fini(railSci.residuMm) && railSci.residuMm > cfg.seuils.residuMaxMm) return false;
    if (fini(railSci.epaisseurDessusMm) && railSci.epaisseurDessusMm >= cfg.seuils.epaisseurNappesMinMm) return false;
    return true;
  }

  const cacheMesures = new WeakMap();
  function extraireMesuresRail(capture, side, railSci, cfg) {
    const UtiliserCache =
      capture &&
      typeof capture === 'object' &&
      !fini(railSci?.epaisseurDessusMm) &&
      !Array.isArray(railSci?.modesTop) &&
      !fini(railSci?.pointsDessus) &&
      !fini(railSci?.residuMm);
    if (UtiliserCache) {
      const hit = cacheMesures.get(capture)?.[side];
      if (hit) return hit;
    }
    let epaisseurDessusMm = fini(railSci?.epaisseurDessusMm) ? railSci.epaisseurDessusMm : null;
    let modesTop = Array.isArray(railSci?.modesTop) ? railSci.modesTop : null;
    let bimodalTop = false;
    let separationTopMm = 0;
    let valleeTopMm = null;
    let pointsDessus = fini(railSci?.pointsDessus)
      ? railSci.pointsDessus
      : fini(railSci?.conventionCalibration?.topN)
        ? railSci.conventionCalibration.topN
        : fini(railSci?.next?.topRows)
          ? railSci.next.topRows
          : null;
    let pointsFlanc = fini(railSci?.pointsFlanc)
      ? railSci.pointsFlanc
      : fini(railSci?.conventionCalibration?.faceN)
        ? railSci.conventionCalibration.faceN
        : fini(railSci?.next?.faceCount)
          ? railSci.next.faceCount
          : null;

    if (Array.isArray(modesTop) && modesTop.length >= 2) {
      const m0 = modesTop[0];
      const m1 = modesTop[1];
      separationTopMm = fini(m0?.centreMm) && fini(m1?.centreMm) ? Math.abs(m1.centreMm - m0.centreMm) : 0;
      const minCount = cfg.seuils.pointsModeMin || 5;
      const minPart = cfg.seuils.partModeMin || 0.2;
      bimodalTop =
        (m0?.count ?? 0) >= minCount &&
        (m1?.count ?? 0) >= minCount &&
        (m0?.part ?? 0) >= minPart &&
        (m1?.part ?? 0) >= minPart &&
        separationTopMm >= (cfg.seuils.separationNappesMinMm || 8);
    } else if (
      Convention?.bandOffsets &&
      capture?.pointsSceneRelative?.length &&
      capture?.rails?.[side]
    ) {
      const delta = railSci?.next?.rawDelta || railSci?.next?.delta || [0, 0, 0];
      const b = Convention.bandOffsets(capture, side, delta);
      if (b?.ok) {
        if (pointsDessus === null) pointsDessus = b.top.length;
        if (pointsFlanc === null) pointsFlanc = b.face.length;
        const m = detecterModesBande(b.top, cfg);
        if (epaisseurDessusMm === null) epaisseurDessusMm = m.epaisseurMm;
        modesTop = m.modes;
        bimodalTop = m.bimodal;
        separationTopMm = m.separationMm;
        valleeTopMm = m.valleeMm;
      }
    }

    const residuMm = fini(railSci?.residuMm)
      ? railSci.residuMm
      : fini(railSci?.v46?.metrics?.top?.residual)
        ? railSci.v46.metrics.top.residual * 1000
        : null;
    const dzMm = fini(railSci?.conventionCalibration?.dzMm) ? railSci.conventionCalibration.dzMm : null;
    const duMm = fini(railSci?.conventionCalibration?.duMm) ? railSci.conventionCalibration.duMm : null;

    const out = {
      epaisseurDessusMm,
      modesTop,
      bimodalTop,
      separationTopMm,
      valleeTopMm,
      pointsDessus,
      pointsFlanc,
      residuMm,
      dzMm,
      duMm,
    };
    if (UtiliserCache) {
      let entry = cacheMesures.get(capture);
      if (!entry) {
        entry = {};
        cacheMesures.set(capture, entry);
      }
      entry[side] = out;
    }
    return out;
  }

  /* Qualification d'une coupe individuelle : saine ou suspecte (cas 1 à 4). */
  function qualifierCoupe(entree, options) {
    const cfg = reglage(options);
    const e = entree && typeof entree === 'object' ? entree : {};
    const cut = entier(e.cut) ? e.cut : entier(e.capture?.identity?.cut) ? e.capture.identity.cut : null;
    const zone = e.zone || null;
    const sci = e.science || null;
    const gRef = fini(e.ecartementRefMm) ? e.ecartementRefMm : null;
    const g = fini(e.ecartementMm)
      ? e.ecartementMm
      : fini(sci?.summary?.pairGaugeMm)
        ? sci.summary.pairGaugeMm
        : null;
    const ecartG = fini(g) && fini(gRef) ? Math.abs(g - gRef) : null;

    const parRail = {};
    for (const s of SIDES) {
      const r = sci?.rails?.[s] || null;
      const m = extraireMesuresRail(e.capture, s, r, cfg);
      const enrichi = r ? { ...r, ...m } : null;
      parRail[s] = { ...m, fort: railFort(enrichi, cfg), railSci: r };
    }

    /* Cas 3 — Rail invisible (distingué d'un conflit de cœur d'aiguille à plusieurs amas). */
    let railInvisible = e.skipOmbre?.raison === 'aucun-point';
    if (!railInvisible && sci?.rails) {
      for (const s of SIDES) {
        const r = sci.rails[s];
        const m = parRail[s];
        if (!r) continue;
        const sansCelluleForte = (r.competitive?.nStrongPool ?? (r.ok === false ? 0 : 1)) === 0;
        const conflitCoeur = r.next?.motif === 'ambiguity' || (r.competitive?.nClusters ?? 0) >= 2;
        const peuDePoints =
          r.ok === false ||
          (!conflitCoeur &&
            sansCelluleForte &&
            ((fini(m.pointsDessus) && m.pointsDessus < cfg.seuils.pointsDessusInvisibleMax) ||
              (fini(m.pointsDessus) &&
                m.pointsDessus < cfg.seuils.pointsDessusFaibleMax &&
                fini(m.pointsFlanc) &&
                m.pointsFlanc < cfg.seuils.pointsFlancInvisibleMax)));
        if (!peuDePoints) continue;
        /* Parade anti-faux-positif : vérifier que le rail n'est pas visible à la position prédite par les voisines. */
        const pred = r.pointsPreditsVoisines;
        const visibleAuxVoisines =
          pred &&
          fini(pred.pointsDessus) &&
          pred.pointsDessus >= cfg.seuils.pointsDessusFaibleMax &&
          (!fini(pred.pointsFlanc) || pred.pointsFlanc >= cfg.seuils.pointsFlancInvisibleMax);
        if (!visibleAuxVoisines) {
          railInvisible = true;
          break;
        }
      }
    }

    /* Cas 2 — Nappes de scanners nettement séparées */
    const enCoeurPN = zone === 'pn' && (e.coeurPN === true || (fini(e.flushPct) && e.flushPct >= 0.5));
    let nappesSeparees = false;
    if (!enCoeurPN && sci?.rails) {
      for (const s of SIDES) {
        const m = parRail[s];
        const epaisEtDisperse =
          fini(m.epaisseurDessusMm) &&
          m.epaisseurDessusMm >= cfg.seuils.epaisseurNappesMinMm &&
          ((fini(m.residuMm) && m.residuMm > cfg.seuils.residuMaxMm) ||
            (fini(m.dzMm) && Math.abs(m.dzMm) >= cfg.seuils.ecartementMaxMm) ||
            m.bimodalTop);
        if (epaisEtDisperse || m.bimodalTop) {
          nappesSeparees = true;
          break;
        }
      }
    }

    /* Cas 4 — Décalibration (notamment à faible vitesse) */
    let decalibration = false;
    if (sci?.rails) {
      const anomalieIntra =
        SIDES.some(s => {
          const r = sci.rails[s];
          const m = parRail[s];
          return (
            r?.next?.slopeLimited === true ||
            (fini(m.residuMm) && m.residuMm > cfg.seuils.residuMaxMm) ||
            (fini(r?.dispersionLongMm) && r.dispersionLongMm >= 8)
          );
        }) ||
        (fini(e.torsionPaireMm?.dl) && e.torsionPaireMm.dl > cfg.seuils.diffRailsDecalMaxMm) ||
        (fini(e.torsionPaireMm?.dv) && e.torsionPaireMm.dv > cfg.seuils.diffRailsDecalMaxMm);
      const pasRatio =
        fini(e.pasMm) && fini(e.pasMedianMm) && e.pasMedianMm > 0 ? e.pasMm / e.pasMedianMm : null;
      const anomalieCinematique =
        (fini(pasRatio) && (pasRatio < cfg.seuils.pasRatioMin || pasRatio > cfg.seuils.pasRatioMax)) ||
        (fini(e.rigideMm) && e.rigideMm > 2) ||
        (fini(e.flecheMm) && e.flecheMm >= 10) ||
        e.oscillationCap === true;
      if (anomalieIntra && anomalieCinematique) decalibration = true;
    }

    /* Cas 1 — Lacunes de cœur d'aiguille */
    let lacuneCoeur = false;
    const enAdv = zone === 'adv' || (fini(e.advRails) && e.advRails > 0);
    if (enAdv && sci?.rails && !railInvisible) {
      const lFort = parRail.left.fort;
      const rFort = parRail.right.fort;
      /* Parade anti-faux-positif : si les deux rails sont forts et à l'écartement nominal, c'est un rail continu normal. */
      const deuxRailsFortsNominaux =
        lFort && rFort && (ecartG === null || ecartG <= cfg.seuils.ecartementMaxMm) && !sci.summary?.pairGaugeRejected;
      if (!deuxRailsFortsNominaux && lFort !== rFort) {
        const sCoeur = lFort ? 'right' : 'left';
        const rCoeur = sci.rails[sCoeur];
        const symptomeCoeur =
          !rCoeur ||
          rCoeur.next?.status !== 'candidate' ||
          rCoeur.publishedWeak === true ||
          rCoeur.next?.motif === 'ambiguity' ||
          (rCoeur.competitive?.nClusters ?? 0) >= 2 ||
          (rCoeur.next?.faceCount ?? 0) < cfg.seuils.faceCountFortMin ||
          (rCoeur.next?.topRows ?? 0) < cfg.seuils.topRowsFortMin ||
          sci.summary?.pairGaugeRejected === true ||
          (ecartG !== null && ecartG > cfg.seuils.ecartementMaxMm);
        if (symptomeCoeur) lacuneCoeur = true;
      }
    }

    /* Ordre de priorité de qualification du motif suspect */
    let motif = null;
    if (decalibration) motif = 'decalibration';
    else if (nappesSeparees) motif = 'nappes-separees';
    else if (railInvisible) motif = 'rail-invisible';
    else if (lacuneCoeur) motif = 'lacune-coeur';

    let saine = false;
    if (motif === null && !e.skipOmbre?.raison) {
      if (sci?.rails) {
        saine =
          parRail.left.fort &&
          parRail.right.fort &&
          !sci.summary?.pairGaugeRejected &&
          (ecartG === null || ecartG <= cfg.seuils.ecartementMaxMm) &&
          !(fini(e.flecheMm) && e.flecheMm > cfg.seuils.flecheInterpMaxMm);
      } else if (e.statutEsv) {
        saine =
          e.statutEsv.statut === 'valid' &&
          (ecartG === null || ecartG <= cfg.seuils.ecartementMaxMm) &&
          !(fini(e.flecheMm) && e.flecheMm > cfg.seuils.ecartementMaxMm);
      }
    }

    return {
      cut,
      zone,
      saine,
      suspect: motif !== null,
      motif,
      ecartementMm: g,
      ecartementRefMm: gRef,
      ecartGaugeMm: ecartG,
      flecheMm: fini(e.flecheMm) ? e.flecheMm : null,
      parRail,
    };
  }

  /* Évaluation d'un saut borné sur une fenêtre [c - M .. c + K + M].
   * Entrée : { amont: [...], suite: [...], cutDepart } (ou { coupes: [...], indexDepart }). */
  function evaluerSautBorne(fenetre, options) {
    const cfg = reglage(options);
    const M = cfg.voisinesSainesMin || 2;
    if (!cfg.actif) {
      return {
        action: 'inactif',
        confirme: false,
        motif: null,
        k: 0,
        kMax: null,
        cuts: [],
        repriseCut: null,
        bornes: { mAmont: 0, mAval: 0, mRequises: M, kMax: null },
        raison: 'reglage-inactif',
      };
    }

    const f = fenetre && typeof fenetre === 'object' ? fenetre : {};
    let amontBrut = Array.isArray(f.amont) ? f.amont : [];
    let suiteBrute = Array.isArray(f.suite) ? f.suite : [];
    if (!suiteBrute.length && Array.isArray(f.coupes)) {
      const idx = entier(f.indexDepart)
        ? f.indexDepart
        : entier(f.cutDepart)
          ? f.coupes.findIndex(x => x?.cut === f.cutDepart)
          : 0;
      if (idx >= 0) {
        amontBrut = f.coupes.slice(Math.max(0, idx - M), idx);
        suiteBrute = f.coupes.slice(idx);
      }
    }

    const amont = amontBrut.map(c => (c && typeof c.saine === 'boolean' && 'suspect' in c ? c : qualifierCoupe(c, cfg)));
    const suite = suiteBrute.map(c => (c && typeof c.saine === 'boolean' && 'suspect' in c ? c : qualifierCoupe(c, cfg)));

    if (!suite.length || !suite[0].suspect || suite[0].saine) {
      return {
        action: 'aucune',
        confirme: false,
        motif: null,
        k: 0,
        kMax: null,
        cuts: [],
        repriseCut: suite[0]?.cut ?? null,
        bornes: { mAmont: 0, mAval: 0, mRequises: M, kMax: null },
        raison: 'coupe-normale',
      };
    }

    const c0 = suite[0];
    const motif = c0.motif;
    const kMax = cfg.kMax?.[motif] ?? K_MAX[motif] ?? 4;

    /* Compter les voisines saines contiguës immédiatement en amont de c0. */
    let mAmont = 0;
    let attenduAmont = entier(c0.cut) ? c0.cut - 1 : null;
    for (let i = amont.length - 1; i >= 0; i--) {
      const a = amont[i];
      if (!a || !a.saine) break;
      if (attenduAmont !== null && entier(a.cut) && a.cut !== attenduAmont) break;
      mAmont++;
      if (attenduAmont !== null) attenduAmont--;
    }

    /* Compter la longueur k de la plage d'anomalie à partir de c0. */
    let k = 0;
    const cuts = [];
    let attenduSuite = entier(c0.cut) ? c0.cut : null;
    while (k < suite.length) {
      const cur = suite[k];
      if (attenduSuite !== null && entier(cur.cut) && cur.cut !== attenduSuite) break;
      if (cur.saine || !cur.suspect) break;
      cuts.push(cur.cut);
      k++;
      if (attenduSuite !== null) attenduSuite++;
    }

    /* Au-delà de Kmax sans réapparition d'un rail normal : ne pas sauter, reprendre coupe par coupe. */
    if (k > kMax) {
      return {
        action: 'reprendre-coupe-par-coupe',
        confirme: false,
        motif,
        k,
        kMax,
        cuts,
        repriseCut: null,
        bornes: { mAmont, mAval: 0, mRequises: M, kMax },
        raison: `anomalie ${motif} sur ${k} coupes (> Kmax=${kMax}) sans réapparition d’un rail normal : reprise coupe par coupe`,
      };
    }

    /* Compter les voisines saines contiguës en aval à partir de suite[k]. */
    let mAval = 0;
    let attenduAval = attenduSuite;
    for (let j = k; j < suite.length; j++) {
      const av = suite[j];
      if (!av || !av.saine) break;
      if (attenduAval !== null && entier(av.cut) && av.cut !== attenduAval) break;
      mAval++;
      if (attenduAval !== null) attenduAval++;
    }

    if (mAmont < M || mAval < M) {
      return {
        action: 'abstenir',
        confirme: false,
        motif,
        k,
        kMax,
        cuts,
        repriseCut: suite[k]?.cut ?? null,
        bornes: { mAmont, mAval, mRequises: M, kMax },
        raison: `encadrement insuffisant (voisines saines amont=${mAmont}/${M}, aval=${mAval}/${M})`,
      };
    }

    const reprise = suite[k];
    if (
      (fini(reprise.ecartGaugeMm) && reprise.ecartGaugeMm > cfg.seuils.ecartementMaxMm) ||
      (fini(reprise.flecheMm) && reprise.flecheMm > cfg.seuils.flecheInterpMaxMm)
    ) {
      return {
        action: 'abstenir',
        confirme: false,
        motif,
        k,
        kMax,
        cuts,
        repriseCut: reprise?.cut ?? null,
        bornes: { mAmont, mAval, mRequises: M, kMax },
        raison: 'coupe de reprise aval non alignée avec la trajectoire amont',
      };
    }

    return {
      action: 'skip-borne',
      confirme: true,
      motif,
      k,
      kMax,
      cuts,
      repriseCut: reprise.cut,
      bornes: { mAmont, mAval, mRequises: M, kMax },
      raison: `saut borné confirmé (${motif}, k=${k}/${kMax}, voisines=${mAmont}/${mAval})`,
    };
  }

  /* Gardes obligatoires avant tout envoi d'un vrai SKIP à ESV (D-382, choix 1C). */
  function verifierGardeSkipBorne(decision, etatEsv, options) {
    const cfg = reglage(options);
    if (!cfg.actif || cfg.envoiSkip === false || decision?.actif === false || etatEsv?.actif === false) {
      return { ok: false, regle: 'inactif', raison: 'réglage inactif (actif: false)' };
    }
    if (!decision || decision.action !== 'skip-borne' || decision.confirme === false || !MOTIFS_SAUT.includes(decision.motif)) {
      return { ok: false, regle: 'decision', raison: 'la décision n’est pas un skip-borne confirmé' };
    }
    const kMax = cfg.kMax?.[decision.motif] ?? K_MAX[decision.motif];
    const M = cfg.voisinesSainesMin || 2;
    const mAmont = decision.bornes?.mAmont;
    const mAval = decision.bornes?.mAval;
    if (
      !Number.isInteger(decision.k) ||
      decision.k < 1 ||
      !Number.isInteger(kMax) ||
      decision.k > kMax ||
      !Number.isInteger(mAmont) ||
      mAmont < M ||
      !Number.isInteger(mAval) ||
      mAval < M
    ) {
      return {
        ok: false,
        regle: 'bornes',
        raison: `bornes non respectées (k=${decision?.k}/${kMax}, voisines=${mAmont}/${mAval}, requis=${M})`,
      };
    }

    /* Verrou anti-vert-validé : JAMAIS de SKIP sur un cut déjà `valid` dans ESV. */
    const e = etatEsv && typeof etatEsv === 'object' ? etatEsv : {};
    const statut =
      e.statut ??
      e.ligne?.statut ??
      e.statutEsv?.statut ??
      e.status ??
      e.extractionStatus ??
      e.ExtractionStatus ??
      null;
    const operateur = e.operateur === true || e.ligne?.operateur === true || e.statutEsv?.operateur === true;
    if (statut === 'valid' || statut === 0 || e.valid === true || (statut === null && e.role === 'vert') || operateur) {
      return { ok: false, regle: 'vert-valide', raison: 'cut déjà valid dans ESV (verrou anti-vert-validé)' };
    }
    if (statut !== 'invalid' && statut !== 1) {
      return { ok: false, regle: 'statut-esv', raison: `statut ESV « ${statut ?? 'inconnu'} » non éligible au SKIP` };
    }

    /* Vérification stricte de l'identité du cut affiché par rapport au cut attendu. */
    const idActuel = e.identity || (entier(e.cut) ? { part: e.part ?? null, cut: e.cut } : null);
    const idAttendu =
      e.attendu ||
      e.expectedIdentity ||
      e.cible ||
      (entier(e.cutAttendu) ? { part: e.partAttendue ?? idActuel?.part ?? null, cut: e.cutAttendu } : null);
    if (!idActuel || !idAttendu || !entier(idActuel.cut) || !entier(idAttendu.cut)) {
      return { ok: false, regle: 'identite', raison: 'identité du cut absente ou illisible' };
    }
    if (idActuel.cut !== idAttendu.cut || (idActuel.part !== null && idAttendu.part !== null && idActuel.part !== idAttendu.part)) {
      return {
        ok: false,
        regle: 'identite',
        raison: `identité du cut différente (${idActuel.part}:${idActuel.cut} !== ${idAttendu.part}:${idAttendu.cut})`,
      };
    }
    if (Array.isArray(decision.cuts) && decision.cuts.length && !decision.cuts.includes(idActuel.cut)) {
      return { ok: false, regle: 'identite', raison: `cut ${idActuel.cut} hors de la fenêtre confirmée [${decision.cuts.join(', ')}]` };
    }

    return { ok: true, regle: 'ok', raison: null };
  }

  function peutEnvoyerSkipBorne(decision, etatEsv, options) {
    return verifierGardeSkipBorne(decision, etatEsv, options).ok;
  }

  async function executerSkipBorneSiPermis({ adapter, decision, etatEsv, scope = null }, options) {
    const garde = verifierGardeSkipBorne(decision, etatEsv, options);
    if (!garde.ok) return { envoye: false, garde, raison: garde.raison, reponse: null };
    if (!adapter || typeof adapter.skipAndNext !== 'function') {
      return { envoye: false, garde: { ok: false, regle: 'adaptateur', raison: 'skipAndNext indisponible' }, raison: 'skipAndNext indisponible', reponse: null };
    }
    const id = etatEsv.identity || { part: scope?.part ?? null, cut: etatEsv.cut };
    const reponse = await adapter.skipAndNext(id, scope);
    return { envoye: reponse?.commandSent !== false, garde, raison: null, reponse };
  }

  /* Inspection en appoint des attributs de source et de couleur (jamais critère principal). */
  function releverAppointAttributs(attributes) {
    const attrs = attributes && typeof attributes === 'object' ? attributes : {};
    const presents = [];
    for (const k of [...ATTRIBUTS_SOURCE, ...ATTRIBUTS_COULEUR]) {
      if (Array.isArray(attrs[k]) && attrs[k].length > 0) presents.push(k);
    }
    return { present: presents.length > 0, attributs: presents };
  }

  /* Cas 5 (2A) — Deux scanners / rail poli : sélection par géométrie de la sous-nappe non déformée en relecture seulement. */
  function poserSousNappeSaine(entree, options) {
    const cfg = reglage(options);
    const e = entree && typeof entree === 'object' ? entree : {};
    const appointAttributs = releverAppointAttributs(e.attributes || e.capture?.attributes);
    if (!cfg.actif || cfg.poseSousNappe === false) {
      return {
        action: 'inactif',
        motif: null,
        criterePrincipal: 'geometrie',
        rail: e.rail ?? null,
        retenue: null,
        delta: null,
        positions: null,
        sousNappes: [],
        appointAttributs,
        raison: 'reglage-inactif',
      };
    }

    const gRef = fini(e.ecartementRefMm) ? e.ecartementRefMm : null;
    const S = cfg.seuils;
    let candidates = Array.isArray(e.sousNappes) ? e.sousNappes.slice() : [];
    let railCible = e.rail || null;

    /* Si les sous-nappes ne sont pas passées directement, les construire à partir de `science` / `capture` (rawDelta vs calage q90 ou partition bimodale). */
    if (!candidates.length && e.science?.rails) {
      for (const s of railCible ? [railCible] : SIDES) {
        const r = e.science.rails[s];
        const opp = e.science.rails[s === 'left' ? 'right' : 'left'];
        if (!r || r.ok === false || !r.next) continue;
        const rawDelta = r.next.rawDelta || r.conventionCalibration?.rawDelta || null;
        const calDelta = r.next.delta || r.conventionCalibration?.delta || null;
        const deltaDiff =
          Array.isArray(rawDelta) &&
          Array.isArray(calDelta) &&
          (Math.abs(calDelta[1] - rawDelta[1]) > 1e-6 || Math.abs(calDelta[2] - rawDelta[2]) > 1e-6);
        const dz = deltaDiff && fini(r.conventionCalibration?.dzMm)
          ? Math.abs(r.conventionCalibration.dzMm)
          : deltaDiff
            ? Math.abs((calDelta[2] - rawDelta[2]) * 1000)
            : 0;
        const m = extraireMesuresRail(e.capture, s, r, cfg);
        const artefactDetecte =
          (fini(m.epaisseurDessusMm) && m.epaisseurDessusMm >= S.epaisseurNappesMinMm && dz >= 6) ||
          m.bimodalTop;
        if (!artefactDetecte) continue;
        railCible = s;

        /* Partition géométrique sur le nuage si disponible, sinon arbitrage rawDelta (médiane dense) vs calDelta (q90 tiré par l'artefact). */
        if (
          m.bimodalTop &&
          fini(m.valleeTopMm) &&
          Convention?.calibrate &&
          Convention?.bandOffsets &&
          e.capture?.pointsSceneRelative?.length &&
          e.capture?.rails?.[s] &&
          Array.isArray(rawDelta)
        ) {
          const tpl = Convention.template(e.capture.rails[s]);
          const mat = e.capture.rails[s].sceneRelativeToProfileLocal;
          if (tpl && Array.isArray(mat)) {
            const ptsBas = [];
            const ptsHaut = [];
            const bu = tpl.sign * rawDelta[1];
            const bz = rawDelta[2];
            for (const pt of e.capture.pointsSceneRelative) {
              if (!Array.isArray(pt)) continue;
              const q = C.point(mat, pt);
              const lu = tpl.sign * q[1] - bu;
              const lz = q[2] - bz;
              const zTpl = tpl.topAt(lu);
              if (zTpl !== null && lu > 0.012 && lu < tpl.width - 0.012) {
                const offMm = (lz - zTpl) * 1000;
                if (offMm <= m.valleeTopMm) ptsBas.push(pt);
                else ptsHaut.push(pt);
              } else {
                ptsBas.push(pt);
                ptsHaut.push(pt);
              }
            }
            for (const [id, ptsSub, modeInfo] of [
              ['sous-nappe-basse', ptsBas, m.modesTop?.[0]],
              ['sous-nappe-haute', ptsHaut, m.modesTop?.[1]],
            ]) {
              const capSub = { ...e.capture, pointsSceneRelative: ptsSub, visibleByClipBoxes: null };
              const calSub = Convention.calibrate(capSub, s, rawDelta);
              const bSub = Convention.bandOffsets(capSub, s, calSub.delta || rawDelta);
              const mSub = bSub?.ok ? detecterModesBande(bSub.top, cfg) : { epaisseurMm: null };
              candidates.push({
                id,
                delta: calSub.delta || rawDelta,
                residuMm: fini(mSub.epaisseurMm) ? r2(mSub.epaisseurMm * 0.4) : 2.5,
                topRows: calSub.topN ?? modeInfo?.count ?? r.next.topRows ?? 18,
                faceCount: calSub.faceN ?? r.next.faceCount ?? 8,
                slopeLimited: false,
                ecartementMm: id === 'sous-nappe-basse' ? e.ecartementBrutMm ?? gRef : e.ecartementCaleMm ?? gRef,
                ecartVoisinesMm: id === 'sous-nappe-basse' ? e.ecartVoisinesBrutMm ?? null : e.ecartVoisinesCaleMm ?? null,
              });
            }
          }
        }

        if (!candidates.length && Array.isArray(rawDelta) && Array.isArray(calDelta)) {
          const oppFort = railFort(opp, cfg);
          candidates.push(
            {
              id: 'sous-nappe-brute-dense',
              delta: rawDelta.slice(),
              residuMm: fini(m.residuMm) ? Math.min(m.residuMm, S.residuSousNappeMaxMm) : 2.0,
              topRows: r.next.topRows ?? 20,
              faceCount: r.next.faceCount ?? 8,
              slopeLimited: !!r.next.slopeLimited,
              ecartementMm: fini(e.ecartementBrutMm) ? e.ecartementBrutMm : oppFort && fini(gRef) ? gRef : null,
              ecartVoisinesMm: fini(e.ecartVoisinesBrutMm) ? e.ecartVoisinesBrutMm : 2.0,
            },
            {
              id: 'nappe-calee-deformee',
              delta: calDelta.slice(),
              residuMm: fini(m.epaisseurDessusMm) ? r2(m.epaisseurDessusMm * 0.35) : 5.5,
              topRows: r.next.topRows ?? 20,
              faceCount: r.next.faceCount ?? 8,
              slopeLimited: dz >= 10,
              ecartementMm: fini(e.ecartementCaleMm) ? e.ecartementCaleMm : fini(gRef) ? gRef + dz : null,
              ecartVoisinesMm: fini(e.ecartVoisinesCaleMm) ? e.ecartVoisinesCaleMm : dz,
            }
          );
        }
        break;
      }
    }

    if (!candidates.length) {
      return {
        action: 'aucune',
        motif: null,
        criterePrincipal: 'geometrie',
        rail: railCible,
        retenue: null,
        delta: null,
        positions: null,
        sousNappes: [],
        appointAttributs,
        raison: null,
      };
    }

    const qualifiees = candidates.map((sn, idx) => {
      const residuOk = !fini(sn.residuMm) || sn.residuMm <= S.residuSousNappeMaxMm;
      const supportOk =
        (!fini(sn.topRows) || sn.topRows >= S.topRowsFortMin) &&
        (!fini(sn.faceCount) || sn.faceCount >= S.faceCountFortMin) &&
        !sn.slopeLimited;
      const ecartG = fini(sn.ecartementMm) && fini(gRef) ? Math.abs(sn.ecartementMm - gRef) : 0;
      const gaugeOk = !fini(sn.ecartementMm) || !fini(gRef) || ecartG <= S.accordEcartementSousNappeMaxMm;
      const ecartV = fini(sn.ecartVoisinesMm) ? Math.abs(sn.ecartVoisinesMm) : 0;
      const voisinesOk = !fini(sn.ecartVoisinesMm) || ecartV <= S.accordVoisinesSousNappeMaxMm;
      const valide = residuOk && supportOk && gaugeOk && voisinesOk && Array.isArray(sn.delta) && sn.delta.length === 3;
      const scoreErreur = (fini(sn.residuMm) ? sn.residuMm : 2) + ecartG + ecartV + (sn.slopeLimited ? 10 : 0);
      return {
        ...sn,
        id: sn.id || `sous-nappe-${idx}`,
        residuOk,
        supportOk,
        gaugeOk,
        voisinesOk,
        valide,
        scoreErreur: r2(scoreErreur),
      };
    });

    const valides = qualifiees.filter(x => x.valide).sort((a, b) => a.scoreErreur - b.scoreErreur);
    if (valides.length === 1) {
      const retenue = valides[0];
      return {
        action: 'poser-sous-nappe',
        motif: 'deux-scanners-sous-nappe-saine',
        criterePrincipal: 'geometrie',
        rail: railCible,
        retenue,
        delta: retenue.delta.slice(),
        positions: retenue.positions || null,
        sousNappes: qualifiees,
        appointAttributs,
        raison: `sous-nappe non déformée retenue (${retenue.id}, erreur géométrique ${retenue.scoreErreur} mm)`,
      };
    }
    if (valides.length >= 2 && valides[1].scoreErreur - valides[0].scoreErreur >= 4) {
      const retenue = valides[0];
      return {
        action: 'poser-sous-nappe',
        motif: 'deux-scanners-sous-nappe-saine',
        criterePrincipal: 'geometrie',
        rail: railCible,
        retenue,
        delta: retenue.delta.slice(),
        positions: retenue.positions || null,
        sousNappes: qualifiees,
        appointAttributs,
        raison: `sous-nappe non déformée départagée par géométrie (${retenue.id})`,
      };
    }

    return {
      action: 'abstenir',
      motif: 'nappes-non-departageables',
      criterePrincipal: 'geometrie',
      rail: railCible,
      retenue: null,
      delta: null,
      positions: null,
      sousNappes: qualifiees,
      appointAttributs,
      raison: 'sous-nappes de scanners non départageables de façon fiable : abstention sans correction inventée',
    };
  }

  /* Cas 6 — Seuil de 10 % d'échec par portion d'au plus 10 000 ER (1 ER = 1 coupe, D-382).
   * Définition verrouillée d'un échec :
   *  - coupe encore différée (`defer` encore ouvert à l'issue de la relecture de la portion), OU
   *  - correction de relecture refusée ou en erreur (écriture / validation non confirmée).
   * Ne sont PAS des échecs :
   *  - un SKIP borné confirmé (transmis ou seulement décidé) ;
   *  - une abstention de critère (confiance trop basse, zone coupée, rôle non permis, etc.) ;
   *  - une correction de relecture acceptée et confirmée ;
   *  - un cut déjà validé laissé tel quel. */
  function bilanPortions(entree, options) {
    const cfg = reglage(options);
    const e = entree && typeof entree === 'object' ? entree : {};
    const portionMaxEr = entier(e.portionMaxEr) && e.portionMaxEr > 0 ? e.portionMaxEr : cfg.portions.portionMaxEr || 10000;
    const seuilEchecMaxPct = fini(e.seuilEchecMaxPct) ? e.seuilEchecMaxPct : cfg.portions.seuilEchecMaxPct ?? 10;
    const qualiteCiblePct = fini(e.qualiteCiblePct) ? e.qualiteCiblePct : cfg.portions.qualiteCiblePct ?? 95;

    const resultats = Array.isArray(e.resultats)
      ? e.resultats
      : Array.isArray(e.relus)
        ? e.relus
        : Array.isArray(e.evenements)
          ? e.evenements
          : [];

    const ecritsPasseSet = new Set((Array.isArray(e.ecritsPasse) ? e.ecritsPasse : []).filter(entier));
    const differesInitiaux = new Set();
    for (const c of Array.isArray(e.differes) ? e.differes : []) {
      if (entier(c) && !ecritsPasseSet.has(c)) differesInitiaux.add(c);
      else if (entier(c?.cut) && !ecritsPasseSet.has(c.cut)) differesInitiaux.add(c.cut);
    }
    for (const x of Array.isArray(e.lot) ? e.lot : []) {
      if (x?.differe === true && entier(x.cut) && !ecritsPasseSet.has(x.cut)) differesInitiaux.add(x.cut);
    }

    let maxCutVu = -1;
    for (const c of differesInitiaux) if (c > maxCutVu) maxCutVu = c;
    for (const r of resultats) {
      const c = entier(r?.cut) ? r.cut : entier(r?.identity?.cut) ? r.identity.cut : null;
      if (c !== null && c > maxCutVu) maxCutVu = c;
    }
    const total =
      entier(e.total) && e.total > 0
        ? e.total
        : entier(e.totalPartie) && e.totalPartie > 0
          ? e.totalPartie
          : maxCutVu >= 0
            ? maxCutVu + 1
            : 0;

    /* Indexer les issues de relecture par coupe. */
    const skipsBornesSet = new Set();
    const refusOuErreurSet = new Set();
    const abstentionsSet = new Set();
    const corrigesSet = new Set();

    for (const r of resultats) {
      if (!r || typeof r !== 'object') continue;
      const cut = entier(r.cut) ? r.cut : entier(r.identity?.cut) ? r.identity.cut : null;
      if (cut === null || (total > 0 && cut >= total)) continue;
      if (r.role === 'differe' && !ecritsPasseSet.has(cut)) differesInitiaux.add(cut);

      const estSkipBorne =
        r.action === 'skip-borne' ||
        r.action === 'skip-envoye' ||
        (r.skipBorne?.action === 'skip-borne' && r.skipBorne?.confirme !== false) ||
        (r.sautBorne?.action === 'skip-borne' && r.sautBorne?.confirme !== false);

      const estRefusOuErreur =
        !estSkipBorne &&
        (r.action === 'correction-refusee' ||
          r.action === 'correction-incertaine' ||
          r.action === 'erreur' ||
          r.ecritureNonConfirmee === true ||
          Boolean(r.erreurCapture) ||
          Boolean(r.erreurCalcul));

      if (estSkipBorne) {
        skipsBornesSet.add(cut);
        refusOuErreurSet.delete(cut);
      } else if (estRefusOuErreur) {
        refusOuErreurSet.add(cut);
      } else if (r.action === 'corrige' || r.action === 'deja-conforme') {
        corrigesSet.add(cut);
      } else if (r.action === 'visite' || r.critere?.corriger === false) {
        abstentionsSet.add(cut);
      }
    }

    const portions = [];
    const nbPortions = total > 0 ? Math.ceil(total / portionMaxEr) : 0;
    let totalEchecs = 0;

    for (let idx = 0; idx < nbPortions; idx++) {
      const debut = idx * portionMaxEr;
      const fin = Math.min(total - 1, (idx + 1) * portionMaxEr - 1);
      const totalEr = fin - debut + 1;

      const differesOuverts = [];
      const correctionsRefuseesOuErreur = [];
      const skipsBornes = [];
      const abstentionsCritere = [];
      const correctionsAcceptees = [];

      for (const c of skipsBornesSet) if (c >= debut && c <= fin) skipsBornes.push(c);
      for (const c of refusOuErreurSet) if (c >= debut && c <= fin) correctionsRefuseesOuErreur.push(c);
      for (const c of differesInitiaux) {
        if (c >= debut && c <= fin && !skipsBornesSet.has(c) && !refusOuErreurSet.has(c) && !corrigesSet.has(c)) {
          differesOuverts.push(c);
        }
      }
      for (const c of abstentionsSet) {
        if (c >= debut && c <= fin && !differesInitiaux.has(c) && !skipsBornesSet.has(c) && !refusOuErreurSet.has(c)) {
          abstentionsCritere.push(c);
        }
      }
      for (const c of corrigesSet) {
        if (c >= debut && c <= fin && !skipsBornesSet.has(c) && !refusOuErreurSet.has(c)) {
          correctionsAcceptees.push(c);
        }
      }

      differesOuverts.sort((a, b) => a - b);
      correctionsRefuseesOuErreur.sort((a, b) => a - b);
      skipsBornes.sort((a, b) => a - b);
      abstentionsCritere.sort((a, b) => a - b);
      correctionsAcceptees.sort((a, b) => a - b);

      const echecs = differesOuverts.length + correctionsRefuseesOuErreur.length;
      totalEchecs += echecs;
      const tauxEchec = totalEr > 0 ? echecs / totalEr : 0;
      const tauxEchecPct = r2(tauxEchec * 100);
      const qualite = totalEr > 0 ? 1 - tauxEchec : 1;
      const qualitePct = r2(qualite * 100);
      const seuilDepasse = tauxEchec * 100 > seuilEchecMaxPct;
      const cibleAtteinte = qualite * 100 >= qualiteCiblePct;
      const validesInchanges = Math.max(
        0,
        totalEr - echecs - skipsBornes.length - abstentionsCritere.length - correctionsAcceptees.length
      );

      portions.push({
        index: idx,
        debut,
        fin,
        unite: '1 ER = 1 coupe',
        totalEr,
        echecs,
        detailEchecs: {
          differesOuverts,
          correctionsRefuseesOuErreur,
        },
        nonEchecs: {
          skipsBornes,
          abstentionsCritere,
          correctionsAcceptees,
          validesInchanges,
        },
        tauxEchec,
        tauxEchecPct,
        qualite,
        qualitePct,
        seuilEchecMaxPct,
        qualiteCiblePct,
        seuilDepasse,
        cibleAtteinte,
        action: seuilDepasse && cfg.actif && cfg.basculePartie10Pct !== false ? 'partie-suivante' : 'continuer',
        motif: seuilDepasse && cfg.actif && cfg.basculePartie10Pct !== false ? cfg.portions.motifDepassement : null,
      });
    }

    const premierePortionEnDepassement = portions.find(p => p.seuilDepasse) || null;
    const seuilDepasse = premierePortionEnDepassement !== null;
    const tauxEchecGlobal = total > 0 ? totalEchecs / total : 0;
    const tauxEchecGlobalPct = r2(tauxEchecGlobal * 100);
    const qualiteGlobalePct = r2((1 - tauxEchecGlobal) * 100);
    const basculeActive = seuilDepasse && cfg.actif && cfg.basculePartie10Pct !== false;

    return {
      format: 'ariane-bilan-portions-v1',
      version: VERSION,
      unite: '1 ER = 1 coupe',
      portionMaxEr,
      seuilEchecMaxPct,
      qualiteCiblePct,
      totalEr: total,
      totalEchecs,
      tauxEchecGlobal,
      tauxEchecGlobalPct,
      qualiteGlobalePct,
      cibleGlobaleAtteinte: (1 - tauxEchecGlobal) * 100 >= qualiteCiblePct,
      seuilDepasse,
      premierePortionEnDepassement,
      action: basculeActive ? 'partie-suivante' : 'continuer',
      motif: basculeActive ? cfg.portions.motifDepassement : null,
      portions,
    };
  }

  return Object.freeze({
    VERSION,
    DEFAULTS,
    K_MAX,
    MOTIFS_SAUT,
    ATTRIBUTS_SOURCE,
    ATTRIBUTS_COULEUR,
    reglage,
    detecterModesBande,
    railFort,
    qualifierCoupe,
    evaluerSautBorne,
    verifierGardeSkipBorne,
    peutEnvoyerSkipBorne,
    executerSkipBorneSiPermis,
    releverAppointAttributs,
    poserSousNappeSaine,
    bilanPortions,
  });
});
