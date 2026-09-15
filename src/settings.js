/* Banane V4.5 — réglages de collecte et d'export, source unique.
 *
 * Avant, ces valeurs vivaient dans quatre fichiers : la file et la dégradation
 * dans `native-page.js`, le seuil de vidage dans `native-session.js`, le budget
 * de segment dans `panel.js`, le lecteur dans `native-lidar.js`. Les régler
 * demandait de les retrouver, et rien ne garantissait leur cohérence.
 *
 * Chaque valeur porte ici son unité, sa raison d'être et, quand elle vient
 * d'une mesure de terrain, le chiffre qui l'a fixée.
 *
 * NE CONCERNE PAS LE MOTEUR. Les seuils géométriques (`searchY`, `minTop`,
 * `minFace`, `maxResidual`, `minConfidence`…) vivent dans `src/geometry.js`,
 * qui est gelé et dont l'empreinte est contrôlée par `tools/verify.cjs`.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api; else root.BananeSettings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const Mo = 1024 * 1024;

  /* --- Collecteur : file d'envoi, dégradation, réessais --- */
  const collector = Object.freeze({
    /* Profondeur de file. 128 était atteint sur les deux sessions dégradées du
     * corpus historique (196 et 83 événements jetés). La file ne se fige plus
     * et la dégradation se répare, donc une file plus profonde absorbe les
     * rafales au lieu de jeter. Les éléments en file sont des métadonnées. */
    maxQueue: 512,
    /* Au-dessus : passage en DEGRADED. En dessous de lowWater : rétablissement
     * possible. L'écart entre les deux évite le battement. */
    highWaterRatio: 0.7,
    lowWaterRatio: 0.25,
    /* Délai minimal sans incident avant de remonter d'un cran. */
    recoveryMs: 3000,
    /* Réessais par élément avant mise à l'écart, avec temporisation croissante
     * plafonnée. Un élément fautif ne bloque plus la tête de file. */
    maxItemAttempts: 5,
    retryBackoffMs: 1000,
    retryBackoffMaxMs: 8000,
    /* Échecs d'ENVOI consécutifs avant METADATA_ONLY. Un échec isolé ne descend
     * qu'à DEGRADED : sur la session 1789370906681, deux échecs suffisaient à
     * couper le LiDAR pour toute la session. */
    failuresBeforeMetadataOnly: 3,
    /* Captures LiDAR par visite, une fois les DEUX côtés qualifiés. À ce stade
     * la géométrie est acquise : continuer ne fait que grossir l'export. */
    maxCapturesPerVisit: 8,
    /* Plafond tant qu'un côté n'a PAS d'instantané qualifié. Terrain du 15/09,
     * 11 sessions : le budget plat de 8 a coupé 48 visites, dont 26 (54 %) sans
     * que les deux côtés soient qualifiés — il refusait exactement les captures
     * qui manquaient. Ce second plafond reste une borne dure contre une visite
     * qui n'aboutirait jamais. */
    maxCapturesPerVisitUnqualified: 24,
    pollMs: 125,
  });

  /* --- Pilote automatique : lecture LiDAR et attentes dans ESV ---
   *
   * Ces valeurs étaient codées en dur dans `src/adapter-page.js`, invisibles
   * et non réglables — exactement le défaut que ce fichier avait corrigé pour
   * la collecte, et qui n'avait jamais été traité pour le pilote.
   *
   * Mesure terrain du 15/09, 37 cycles de pilote : la capture LiDAR consomme
   * 85 % du temps (6,95 s sur 8,16 s par cut), dont 2,4 s d'attente avant la
   * première lecture. `stabiliteMs` en est le poste principal. C'est un
   * paramètre de QUALITÉ : le baisser lit un nuage moins chargé. Il n'est pas
   * réduit ici — il est rendu visible pour pouvoir être étudié. */
  const pilote = Object.freeze({
    /* Tentatives de lecture par vue avant d'abandonner le rail. */
    tentativesParVue: 3,
    /* Durée pendant laquelle le niveau de détail doit rester inchangé avant de
     * lire. Poste de temps dominant du pilote. Paramètre de qualité. */
    stabiliteMs: 800,
    /* Budget total d'une capture, les deux rails compris. */
    budgetCaptureMs: 60000,
    /* Cadence de sondage des attentes. Avec la mémoïsation de l'identification
     * des rails, un sondage coûte désormais une regex et une comparaison de
     * matrice, contre un parcours complet des contours auparavant. */
    sondageMs: 80,
    /* Lectures identiques consécutives exigées pour déclarer une caméra ou une
     * scène stable. Trois lectures à 80 ms font 240 ms de latence plancher. */
    lecturesStables: 3,
    /* Plafonds d'attente, par nature d'attente. */
    attenteMs: 12000,
    attenteNavigationMs: 15000,
    attenteClicMs: 5000,
  });

  /* --- Export : vidage automatique et segmentation --- */
  const exportSettings = Object.freeze({
    /* Volume en attente déclenchant un vidage automatique pendant la collecte.
     * Sous la limite de téléchargement observée (~64 Mo) pour garder de la
     * marge même sans compactage. Terrain : déclenché à 40,2 puis 38,3 Mo. */
    watermarkBytes: 36 * Mo,
    /* Budget appliqué au FICHIER produit : en-tête replié + nuages +
     * dictionnaires. Mesure du 15/09 : 27,3 Mo de nuages donnaient un fichier
     * de 40,7 Mo une fois ajoutés 7,2 Mo de dictionnaires et 6,2 Mo de
     * métadonnées, parce que le budget ne portait que sur les nuages. */
    segmentBytes: 48 * Mo,
    /* Le dernier nuage peut introduire un repère neuf (~40 Ko) et l'en-tête est
     * replié à nouveau à la fermeture. Sans réserve : 50,3 Mo pour 48 visés. */
    segmentReserveBytes: 4 * Mo,
    /* Plancher d'objets par segment. Sans lui, une session aux métadonnées
     * volumineuses dégénère : une première correction du budget a produit
     * 802 segments d'un objet chacun. */
    minObjectsPerSegment: 48,
    /* Estimation du volume stocké, pour le seuil de vidage. ~113 octets par
     * point mesurés sur le témoin (3 coordonnées scène + drapeau de clipping,
     * après retrait des champs dérivables). */
    bytesPerPointEstimate: 113,
    bytesPerCloudOverhead: 2048,
    /* Compactage à l'écriture : interne les structures répétées et retire les
     * champs dérivables. Gain mesuré de 61 à 67 % sur trois sessions réelles,
     * équivalence moteur démontrée au bit près. */
    /* Purger d'IndexedDB les objets acquittés, une fois le segment écrit sur
     * disque. Sans cela la session ne repart jamais de zéro : terrain du 15/09,
     * session 28bfe0a5, 77,3 Mo accumulés pour 646 objets dont 315 déjà écrits
     * et réexportés à l'identique. La liste complète des identifiants reste
     * déclarée, donc un segment manquant à la fusion est signalé. */
    releaseAfterExport: true,
    compact: true,
    /* Cadence de contrôle du seuil par le panneau, pendant la collecte. */
    advicePollMs: 5000,
  });

  /* --- Lecteur LiDAR passif ---
   * Repris tels quels de `native-lidar.js` pour que l'interface puisse les
   * afficher. La source d'exécution reste `BananeNativeLidar4.DEFAULTS`. */
  const reader = Object.freeze({
    boundsLabel: 'ROI 0,5 × 0,4 × 0,3',
    usefulBoundsLabel: 'ROI utile 0,5 × 0,18 × 0,10',
    maxNodes: 512,
    maxPointsPerRail: 50000,
    maxInspected: 500000,
    maxMillis: 1800,
    checkpointPoints: 2048,
    coverage: Object.freeze({
      minimumPoints: 128, minimumUsefulPoints: 64,
      minimumLongitudinalBins: 6, minimumLongitudinalSpan: 0.4,
    }),
  });

  /* Valeurs dérivées, pour éviter de recalculer les mêmes ratios partout. */
  const derived = Object.freeze({
    highWater: Math.max(8, Math.floor(collector.maxQueue * collector.highWaterRatio)),
    lowWater: Math.max(4, Math.floor(collector.maxQueue * collector.lowWaterRatio)),
  });

  /* Lecture pour l'interface : libellé, valeur affichable, explication courte. */
  function describe() {
    const mo = n => (n / Mo).toFixed(0) + ' Mo';
    return [
      { groupe: 'Collecte', nom: 'Profondeur de file', valeur: String(collector.maxQueue) + ' événements', pourquoi: 'Absorbe les rafales sans rien jeter.' },
      { groupe: 'Collecte', nom: 'Dégradation à partir de', valeur: String(derived.highWater) + ' en attente', pourquoi: 'Réduit le niveau avant saturation.' },
      { groupe: 'Collecte', nom: 'Rétablissement sous', valeur: String(derived.lowWater) + ' en attente', pourquoi: 'Remonte d’un cran après ' + (collector.recoveryMs / 1000) + ' s sans incident.' },
      { groupe: 'Collecte', nom: 'Réessais par élément', valeur: String(collector.maxItemAttempts), pourquoi: 'Puis mise à l’écart avec sa cause, la file repart.' },
      { groupe: 'Collecte', nom: 'Captures par visite', valeur: collector.maxCapturesPerVisit + ' une fois qualifié, ' + collector.maxCapturesPerVisitUnqualified + ' sinon', pourquoi: 'Le budget ne coupe pas tant qu’un côté n’a pas d’instantané qualifié.' },
      { groupe: 'Pilote', nom: 'Stabilité avant lecture', valeur: pilote.stabiliteMs + ' ms', pourquoi: 'Durée d’immobilité du niveau de détail exigée avant de lire. Poste de temps principal du pilote : 85 % de son temps est la capture.' },
      { groupe: 'Pilote', nom: 'Tentatives par vue', valeur: String(pilote.tentativesParVue), pourquoi: 'Relectures d’un rail avant abandon.' },
      { groupe: 'Pilote', nom: 'Budget de capture', valeur: Math.round(pilote.budgetCaptureMs / 1000) + ' s', pourquoi: 'Plafond total pour les deux rails.' },
      { groupe: 'Pilote', nom: 'Cadence de sondage', valeur: pilote.sondageMs + ' ms', pourquoi: 'Intervalle entre deux vérifications pendant une attente.' },
      { groupe: 'Export', nom: 'Vidage automatique à', valeur: mo(exportSettings.watermarkBytes) + ' en attente', pourquoi: 'Écrit un segment avant la limite de téléchargement.' },
      { groupe: 'Export', nom: 'Libération après écriture', valeur: exportSettings.releaseAfterExport ? 'oui' : 'non', pourquoi: 'Purge les objets déjà écrits sur disque pour que la session reparte de zéro. Les identifiants restent déclarés : un segment manquant est signalé à la fusion.' },
      { groupe: 'Export', nom: 'Taille de segment visée', valeur: mo(exportSettings.segmentBytes), pourquoi: 'Réserve de ' + mo(exportSettings.segmentReserveBytes) + ', plancher de ' + exportSettings.minObjectsPerSegment + ' objets.' },
      { groupe: 'Export', nom: 'Compactage', valeur: exportSettings.compact ? 'activé' : 'désactivé', pourquoi: 'Retire les champs dérivables, sans effet sur le moteur.' },
      { groupe: 'Lecteur', nom: 'Budget de lecture', valeur: exportSettings.compact === null ? '' : reader.maxMillis + ' ms', pourquoi: 'Par capture, points déjà chargés seulement.' },
      { groupe: 'Lecteur', nom: 'Points par rail', valeur: reader.maxPointsPerRail.toLocaleString('fr-FR'), pourquoi: 'Plafond de rétention en mémoire.' },
      { groupe: 'Lecteur', nom: 'Qualification', valeur: reader.coverage.minimumLongitudinalBins + ' tranches, étendue ' + String(reader.coverage.minimumLongitudinalSpan).replace('.', ','), pourquoi: 'Minimum pour qu’un instantané soit retenu.' },
    ];
  }

  return { Mo, collector, pilote, export: exportSettings, reader, derived, describe };
});
