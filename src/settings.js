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
    /* 4.7.4 — lectures LiDAR après un déplacement de rail PAR L'OPÉRATEUR.
     * Elles ne nourrissent jamais le moteur, dont l'entrée est la pose de
     * départ, avant toute action humaine. Collecte 4.7.3 : 42 % des points
     * exportés venaient de ces lectures. Un ajustement des rails par ESV
     * lui-même, sans geste de l'opérateur, reste lu. */
    captureAfterOperatorRailChange: false,
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
    /* Clics de sélection d'un rail avant de conclure « vue non recentrée »
     * (4.8.0, KI-063 : ESV lent). Chaque clic attend `attenteMs`. */
    recentrages: 3,
    attenteNavigationMs: 15000,
    attenteClicMs: 5000,
    /* V3, expérience I1 (D-078, D-087), version de test seulement : lecture
     * sans attendre une image d'ESV. « tirage » : chaque cut est tiré une fois
     * pour toutes à partir de son numéro, une moitié lit comme avant
     * (« référence »), l'autre rend la main à ESV par `scheduler.yield`
     * (« rapide »). Mêmes points lus dans les deux modes ; seule la vitesse
     * change. « reference » : aucun cut rapide. « toujours » : tous rapides. */
    lectureI1: 'tirage',
    /* D-088 (4.9.0.7, version de test) : mode « rapide », même tirage cut par cut que la 4.9.0.6.
     * Un cut « rapide » lit sans attendre une image (I1), sélectionne sa vue au rythme des images
     * (I2), lit dès que plus rien ne charge (I3, repli : la stabilité ci-dessus) et pose sans
     * attendre le recentrage de la vue (P1). Un cut « référence » fait tout comme la 4.9.0.5.
     * `rapide` : chaque pièce peut être coupée seule (false) pour isoler un effet.
     * `modeRapide` remplace `lectureI1` (gardé pour lire les réglages de la 4.9.0.6).
     * D-091 (4.9.0.9) : « echantillon », mode rapide sur neuf cuts sur dix ; un cut sur dix, tiré au
     * sort d'après son numéro, reste en référence pour surveiller la qualité (validé le 13 octobre :
     * −64 % par cut sur le lot de 112 cuts de la 4.9.0.8, qualité identique). « tirage » reste lisible. */
    modeRapide: 'echantillon',
    /* D-157 (5.0) : `clicHumain`, le clic de pose du mode rapide (src/adapter-page.js, fiches/RAPIDE_HUMAIN.md).
     * La pose directe clique le rail gauche depuis la vue du rail droit : vers NDC −7, hors de la fenêtre, un clic
     * qu'aucun humain ne peut faire. 'tel-quel' (défaut) : comme avant, à l'octet près. 'gauche-recentre' : rail
     * droit en direct, rail gauche avec recentrage (environ +0,32 s par cut rapide). 'tout-recentre' : les deux rails
     * avec recentrage, le chemin des cuts de référence (environ +0,65 s). Les deux modes corrigés ne cliquent jamais
     * hors de la partie visible du canevas (marge de 0,99). Ce n'est pas une pièce : il ne figure pas dans `pieces`.
     * Décision à Mic. */
    rapide: Object.freeze({ lecture: true, selection: true, signal: true, pose: true, clicHumain: 'tel-quel' }),
  });

  /* --- Export : vidage automatique et segmentation --- */
  /* --- Observation « continuité » (4.7.7, cahier 4.8 amendement n°7) ---
   * Calcul fantôme en Natif : la proposition que GCV1 aurait faite en partant
   * des cuts voisins déjà validés, consignée dans la visite, jamais appliquée
   * ni affichée. Le calcul passe après la fin de visite, hors de la file des
   * événements ; au-delà de `maxPending` visites en attente, les plus
   * anciennes sont sautées et le disent. */
  const continuity = Object.freeze({
    observe: true,
    maxPending: 4,
    /* Attente maximale des calculs en cours à la fin de session. */
    drainAtEndMs: 15000,
  });

  /* --- Décision sur le lot dans le Pilote (4.7.8 en observation, 4.7.10 commande selon le lot) --- */
  const lot = Object.freeze({
    observe: true,
    /* Ancres gardées en mémoire du lot : largement plus que les 3 numéros de
     * cut de voisinage, sans faire grossir l'état persisté. */
    maxAnchors: 40,
    /* 4.7.20 (KI-061) : lecture d'état d'ESV restée sans réponse juste après une
     * navigation : nouvelles lectures, à cet intervalle, avant de conclure. */
    stateRetries: 2,
    stateRetryMs: 3000,
    /* 4.8.0 (KI-063) : silence après une navigation DANS la partie (ESV qui
     * charge un cut lourd) : nouvelles lectures avant de conclure, environ
     * 70 s avec le délai de lecture du bridge (4 s). */
    stateRetriesNavigation: 10,
    /* 4.8.0 (D-058) — ESV rafraîchi par l'opérateur pendant un lot : attente
     * de la page et des rails ; au plus `rafraichirPasMax` « cut non validé
     * suivant » pour revenir au cut du lot. */
    rafraichirAttenteMs: 90000,
    rafraichirPasMax: 400,
    /* 4.8.6 (KI-069, D-065) — VALIDATION DU DERNIER CUT D'UNE PARTIE, seul cut où
     * « valider et passer au suivant » fait quitter la partie. 'ctrl-entree' :
     * raccourci d'ESV Ctrl+Entrée, qui valide sans passer au suivant (défaut,
     * hypothèse de l'opérateur à confirmer sur le terrain). 'bouton' : repli,
     * à n'employer que si l'essai montre que Ctrl+Entrée n'a pas l'effet
     * attendu : clique le bouton d'ESV dont l'identifiant est
     * `boutonValiderSansSuivant` (celui de buttonValidateRail(), « valider sans
     * suivant » ; à relever dans ESV, jamais deviné : nul = refus avant toute
     * émission). Jamais de repli automatique de l'un vers l'autre. */
    validationDernierCut: 'ctrl-entree',
    boutonValiderSansSuivant: null,
    /* 4.9.5.1 (D3, D-110) — ÉCRITURE DE VALIDATION REFUSÉE PAR ESV, vue par l'observateur passif
     * (HTTP non 2xx ou statut 0) pour un cut que le lot vient de valider. 'pause' : si aucune
     * écriture réussie de la même ligne ne suit dans `ecritureRefuseeRelanceMs` (ESV relance parfois),
     * le lot se met en pause comme avec le bouton Pause (au prochain point sûr du moteur), avec un
     * avis clair et un événement `ecriture-refusee`. Aucune attente ajoutée au lot, rien renvoyé à
     * ESV. 'off' : comportement de la 4.9.0 (le refus n'est pas suivi). */
    ecritureRefusee: 'pause',
    ecritureRefuseeRelanceMs: 2000,
    /* 4.9.5.13 (test 13, D-217, D-219) — PROFIL DU LOT, figé dans le scope à la création. 'L1' (défaut des portions de test) : sur un
     * cut que la chaîne ne pose pas, la GCV2 (src/gcv2-l1.js, paramètres figés) pose et valide au-dessus de τ, pose SANS valider sous τ
     * (sauf à plus de 150 mm de la pose de départ), la vue est déplacée pour une cible hors de la vue, la garde de paire est éteinte et
     * les appuis de reprise vont à 10 cuts. 'actuel' : le lot de la 4.9.5.9, à l'identique (le scope ne porte alors aucun profil). */
    profil: 'L1',
  });

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
    /* V2 (D-079) : mode d'export. « complet » garde tout : intensité, classe,
     * pointSources, probes. D-091 (4.9.0.9) : « allege » (allègement A) retire les
     * sondes des nœuds vides qui ne touchent pas la zone ; points au bit près ;
     * environ −33 % sur les nuages (src/native-export.js, MODES). */
    mode: 'allege',
    /* 4.9.5.3 (S7) : jalons `phase-timing` repliés par visite dans le journal exporté (src/phase-pli.js) : le contexte de la visite
     * n'est écrit qu'une fois, chaque jalon devient une ligne de nombres, un résumé de visite est joint. Rien n'est perdu pour
     * l'analyse (tools/perf-phases.cjs et perf-v3.cjs lisent les deux formats, mêmes chiffres). Mesuré sur un export réel
     * (partie 27, 606 visites) : jalons −84 %, journal −36 %. `false` : un événement par jalon, comme avant. */
    phaseTimingReplie: true,
    /* V2 : DÉFAUT FAUX (décision de Mic en attente pour l'activer). Le vidage manuel avec confirmation
     * reste disponible. Si activé : après un « Tout télécharger » dont TOUS les fichiers sont confirmés complets,
     * le cache d'export (src/export-cache.js) est vidé ; jamais pendant un lot. */
    viderApresExport: false,
    /* V2 : volume maximal d'une archive « Tout télécharger » ; au-delà, une archive suivante est ouverte.
     * 4.9.0.16 (test 15, Mic : limite d'envoi d'environ 18 Mo par fichier) : 17 Mo (17 × 1 048 576 octets,
     * 17,8 millions d'octets), taille COMPRESSÉE réelle, CONTENU.txt compris : sous 18 Mo quelle que soit la
     * façon de compter les mégaoctets. Un fichier JSON n'est jamais coupé (s'il dépasse seul, il fait un
     * volume à lui). Le zip simple s'arrête à 4 Gio. */
    zipMaxBytes: 17 * Mo,
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
  /* V1 (test 2, D-077/D-078) — OBSERVATEUR PASSIF DE LA PAGE ESV. Il écoute, sans
   * rien commander : écriture de validation (statut, corps réduit), pages de la liste
   * des coupes (comptes), fichiers de points (nombre, octets). JOURNALISATION SEULE,
   * pendant une séance (lot Orbite non clos, session Écho active), jamais hors séance.
   * `actif:false` : le service worker ne range rien et le pont coupe l'observateur.
   * Activé par défaut dans cette version de test. NE CONCERNE NI LE MOTEUR NI LA POSE ;
   * aucun seuil. Les bornes du pont (50 entrées, 64 Ko par message, file de 100) et de la
   * page (256 entrées, 1 Mo) vivent dans leurs fichiers, hors du service worker. */
  const observateurPassif = Object.freeze({
    actif: true,
    /* Service worker : au plus ce nombre d'entrées rangées par séance (au-delà : un
     * jalon « gap »), et cette taille maximale (caractères) d'un événement rangé. */
    entreesParSeanceMax: 20000,
    caracteresParEntree: 4096,
  });
  /* B1 (D-095) — APPUIS LUS DANS LA LISTE DES COUPES D'ESV (src/appuis-liste.js).
   * 'ombre' : à chaque décision du lot, l'hypothèse « avec les voisins validés de la
   * liste » est calculée À CÔTÉ et consignée (`b1-ombre`) ; la décision réelle, donc
   * la pose, ne change pas. 'actif' : l'hypothèse devient la décision (dernier
   * recours et garde de continuité du premier passage seulement). 'off' : rien,
   * et la page oublie sa table. Livré à 'ombre' : passer à 'actif' attend le
   * rejeu de l'ombre (justes perdus, faux ajoutés) et l'accord de la direction. */
  const appuisListe = 'ombre';
  /* P1 (5.0, D-129) — PLAFOND DU CALAGE DE CONVENTION (src/placement-convention.js). Trois valeurs.
   *   false (défaut) : un rail dont le décalage de convention sort du domaine mesuré (plus de 8 mm sur un axe) est refusé et posé
   *     brut, comme avant (biais vertical réel mesuré : −6,5 mm, partie 17).
   *   'vertical' (P1 bis) : seul le décalage VERTICAL hors domaine est appliqué à 8 mm au plus, dans son signe ; le reste est
   *     consigné. Si le décalage LATÉRAL sort du domaine, le rail reste refusé (posé brut), même si le vertical serait plafonné.
   *   true : les deux axes sont plafonnés à 8 mm.
   * Le reste est consigné (`conventionCalibration.restDuMm` / `restDzMm`, `capped`). La garde de paire (D-044), le domaine et la
   * borne de pente ne changent pas. Mesures hors ligne : fiches/P1_CONVENTION.md.
   * NE PAS ACTIVER sans l'accord de Mic : il change la pose de terrain. */
  const conventionPlafond = false;
  /* P8 (5.0, D-140) — CORRECTION VERTICALE APPRISE, EN OMBRE (src/lot-decision.js). Sur un rail dont le calage de convention est REFUSÉ (décalage hors
   * des 8 mm), Mic remonte la pose dans les trois parties relues (+6,1 ; +1,8 ; +3,6 mm). La décision consigne, À CÔTÉ de la pose réelle, celle qu'aurait
   * donnée une correction verticale de `mm` (3,6 par défaut : médiane de la partie 29, entre les deux autres), dans le repère profil du rail.
   * ACTIF PAR DÉFAUT, MAIS POUR CONSIGNER SEULEMENT : cette pose-là n'est JAMAIS posée, ni commandée, ni validée, ni lue par une garde, une reprise ou un
   * appui ; la pose réelle est identique, octet pour octet, avec et sans ce réglage. `actif:false` : rien n'est consigné. Étude : fiches/G0_APPRENTISSAGE_V1.md § 6.
   * Nom : P8 (« E2 » désigne l'ombre GCV1 de l'Écho). Les clés de données gardent leur nom, et la chaîne de version `e2-vertical-refuse-v1` garde « e2 » par compatibilité. */
  const ombreVerticaleRefusee = Object.freeze({ actif: true, mm: 3.6 });
  /* 5.0 (audit 5.0, I8 (1)) — VOIE PRÉDITE EN OMBRE DANS ORBITE (src/voie-recentree.js). Pour chaque cut que le lot DIFFÈRE, le service worker
   * consigne (`voie-predite-ombre`) ce qu'aurait donné la règle prudente D-147 : moteur recentré sur la voie du lot (les poses de l'ombre servent
   * d'appuis à l'ombre seulement), étage, confiance, écart à la voie, profondeur de chaîne, geste de vue qu'il AURAIT fallu (dans la vue, dézoom,
   * glissement en pixels), verdict « posable ou non, et pourquoi ». ACTIF PAR DÉFAUT, POUR CONSIGNER SEULEMENT : rien n'est posé, aucune vue
   * n'est déplacée, aucune commande n'est envoyée à ESV ; la décision, la pose et les appuis du lot sont identiques avec et sans. Seuils figés
   * (datasets/reglages-figes.json, `voiePredite`). `actif:false` : rien n'est calculé ni consigné. */
  const voiePrediteOmbre = Object.freeze({ actif: true, etages: Object.freeze(['window']), confianceMin: 55, ecartementVoisinMm: 10, profondeurMax: 10, fenetreMm: 30, dezoomMax: 1.5, glissementPxMax: 250 });
  /* 5.0 (audit 5.0, I8 (2)) — MÉMOIRE DES DIFFÉRÉS EN OMBRE DANS L'ÉCHO (src/voie-recentree.js, G1 (b), D-148). À la fin de la PREMIÈRE visite d'un cut
   * que le lot de la partie a différé, l'Écho consigne (`memoire-differes-ombre`) la pose qu'aurait donnée le moteur recentré sur la voie des
   * corrections DÉJÀ VALIDÉES par l'opérateur dans la même série de différés (trou de `ecartSerieMax` cuts au plus ; les `K` plus proches ;
   * dispersion = éloignement × `mmParCut`, au plus `porteDispersionMm` ; voie = droite des `appuis` plus proches). Frontière anti-fuite de
   * l'observation « continuité » : pose de départ et points capturés avant le premier geste, jamais la référence humaine du cut. Écho passif :
   * rien n'est posé ni commandé. `actif:false` : rien. */
  /* 4.9.5 test 5 (relecture, I-1 ; D-155) : COUPÉE au terrain. Deux relances du moteur par différé pendant l'Écho, non mesurées au banc,
   * pour une mesure que Mic ne veut pas comme mode de travail ; les données de l'Écho passent avant. Le calcul reste jouable hors ligne. */
  const memoireDifferesOmbre = Object.freeze({ actif: false, ecartSerieMax: 10, K: 3, appuis: 2, mmParCut: 3, porteDispersionMm: 10, etages: Object.freeze(['first-pass', 'window', 'choice']) });
  /* 5.0 (D-147) — DÉPLACER LA VUE D'ESV POUR POSER UN RAIL HORS DE SA VUE (src/adapter-page.js `amenerDansLaVue`, src/gestes-vue.js,
   * fiches/DEPLACER_VUE.md). COUPÉ PAR DÉFAUT : seule la direction l'active, après les vérifications de la fiche sur le vrai ESV. Coupé, rien ne
   * change : mêmes commandes à ESV, octet pour octet (tests/deplacer-vue-sw.test.cjs). Actif : un cut que le lot différerait PARCE QUE
   * la cible tombe hors de la vue du rail (KI-051, `hors-vue-*`), à un étage permis (`etages`), qui tient la règle prudente D-147 (`regle`,
   * seuils de `voiePrediteOmbre` : confiance ≥ 55, chaîne ≤ 10, écartement à 10 mm des appuis, écart à la voie ≤ 30 mm ; 'aucune' : l'étage et
   * la vue seulement), est posé si un geste humain l'y amène :
   * un dézoom à la molette (au plus `dezoomMax`, pixel au plus `pixelMaxMm`) ou un glisser au bouton gauche (au plus
   * `glissementPxMax` pixels), au plus `gestesMax` gestes par rail, la caméra relue et la cible reprojetée après chaque geste, la vue
   * remise ensuite (écart d'échelle au plus `remiseTolerance`). `preVol` : la page essaie d'abord le geste (sans rien poser, vue
   * remise) ; s'il échoue, le cut reste différé comme aujourd'hui. Un événement `deplacer-vue` par décision et par pose, un
   * `deplacer-vue-geste` par geste. `molette` et `glisser` : forme des gestes (src/gestes-vue.js) ; leurs durées sont PROVISOIRES,
   * à fixer sur les gestes de l'opérateur relevés par l'Écho (`echo.gestesVue`). `clicFinal` reste faux : Chromium termine un vrai
   * glisser par un `click`, et un clic dans la vue d'ESV pose le rail courant. */
  const deplacerVue = Object.freeze({
    actif: false,
    etages: Object.freeze(['window']), regle: 'prudente',
    gestesMax: 3, dezoomMax: 1.5, glissementPxMax: 250, pixelMaxMm: 0.9, marge: 0.99, remiseTolerance: 0.02, preVol: true,
    molette: Object.freeze({ deltaY: 100, deltaMode: 0, wheelDelta: 120, intervalleMs: Object.freeze([60, 140]), cransMax: 8, sensDezoom: 1, facteurSuppose: 1.1 }),
    glisser: Object.freeze({ dureeMs: Object.freeze([220, 420]), pasMs: 16, bouton: 0, clicFinal: false, viseNdc: 0.8 }),
  });
  /* 5.0 — RÈGLES MÉTIER DE MIC (src/regles-metier.js, fiches/REGLES_METIER.md). PN avec ses marges (« contrôler chaque cut »),
   * grappe de différés (noyau d'aiguille, grappe d'invalides), validation en place dans une zone, verts à contrôler (écartement à
   * plus de 15 mm de la médiane de la partie, intérieur et marges d'une grappe, voisins d'un isolé, plage d'un PN).
   * `ombre` (livré : true) : à chaque cut du lot, l'événement `regles-metier-ombre` consigne la zone détectée, les règles
   * déclenchées et ce qu'Ariane AURAIT fait ; la décision, la commande, la pose et les appuis sont identiques avec et sans.
   * `actif` (livré : false) et `regles` (toutes à false) : chemin d'activation, COUPÉ. Seul Mic l'ouvre. Une règle activée ne
   * peut que transformer en différé un cut que le lot allait valider ; elle ne pose jamais à un nouvel endroit. Seuils figés :
   * datasets/reglages-figes.json, `reglesMetier`. */
  const reglesMetier = Object.freeze({ ombre: true, actif: false,
    regles: Object.freeze({ 'zone-validation-en-place': false, 'pn-chaque-cut': false, 'grappe-differes': false }) });
  /* 5.0 (chantier « faux verts », fiches/FAUX_VERTS.md) — FAUX VERT EN OMBRE (src/faux-vert-ombre.js, consigné par src/lot-decision.js). Pour chaque
   * cut que la décision sur le lot pose, la décision consigne (`fauxVertOmbre`) les signaux de la science du cut et le verdict de la règle
   * « hauteur ambiguë » : un même rail avec un décalage vertical de calage d'au moins `dzMinMm` (appliqué ou refusé) ET une bande de points du
   * dessus épaisse d'au moins `epaisseurMinMm` → « différer ». ACTIF POUR CONSIGNER SEULEMENT : la décision, la pose et la commande sont
   * identiques, octet pour octet, avec et sans. `differer` : chemin d'activation, COUPÉ ; ouvert, il ne pourrait que différer le cut au lieu de
   * le valider, jamais poser. NE PAS L'OUVRIR sans l'accord de l'opérateur, et pas avant une mesure en ombre sur des parties neuves. Seuils figés :
   * datasets/reglages-figes.json (`fauxVertOmbre`). `actif:false` : rien n'est calculé ni consigné. */
  const fauxVertOmbre = Object.freeze({ actif: true, differer: false, dzMinMm: 11, epaisseurMinMm: 14 });
  /* 5.0 (chantier « hauteur apprise », fiches/HAUTEUR_APPRISE.md) — HAUTEUR APPRISE EN OMBRE (src/hauteur-apprise.js, consignée par
   * src/lot-decision.js). Pour chaque cut que la décision sur le lot pose, la décision consigne (`hauteurApprise`), rail par rail, la correction
   * verticale apprise sur les corrections de l'opérateur : part × (a + b × épaisseur de la bande du dessus), selon que le calage de convention
   * a été appliqué ou refusé, bornée à ± `plafondMm` ; abstention hors des `etages`, sans calage lisible, ou sous `pointsDessusMin` points du
   * dessus. Elle consigne la pose réelle ET la pose corrigée. ACTIVE POUR CONSIGNER SEULEMENT : la décision, la pose et la commande sont
   * identiques, octet pour octet, avec et sans. `appliquer` : chemin d'activation, COUPÉ ; ouvert, il poserait la pose corrigée (hauteur
   * seulement) : NE PAS L'OUVRIR sans l'accord de l'opérateur, et pas avant une mesure en ombre sur des parties neuves. Valeurs figées :
   * datasets/reglages-figes.json (`hauteurApprise`). `actif:false` : rien n'est calculé ni consigné. */
  const hauteurApprise = Object.freeze({ actif: true, appliquer: false, plafondMm: 5, pointsDessusMin: 15,
    etages: Object.freeze(['first-pass', 'window', 'choice']),
    applique: Object.freeze({ a: 3.28, b: -0.5, part: 0.5 }), refuse: Object.freeze({ a: 17.89, b: -1.14, part: 1 }) });
  /* E1 (5.0, accord D-122 Q1) : mémoire locale des bords écrits par Ariane, par partie, et instantané de la liste d'ESV à chaque
   * chargement complet (src/liste-memoire.js). Aucune requête vers ESV. `actif:false` : rien n'est gardé, comparé ni exporté. */
  const listeMemoire = Object.freeze({ actif: true });
  /* 5.0 — VERTS À CONTRÔLER (src/verts-a-controler.js, fiches/VERTS_A_CONTROLER.md). En fin de lot ou à la demande, une LISTE des
   * verts (cuts laissés valides par ESV, jamais visités par Orbite) à relire en priorité, classés par risque et groupés en plages,
   * avec le temps estimé ; jointe à l'export en petit fichier JSON. LECTURE SEULE : calculée dans le service worker sur ce qu'Ariane a
   * déjà (instantané E1 de la liste, ombre des règles métier, bords qu'elle a écrits) ; aucune action dans ESV, la décision et la pose
   * ne la lisent pas. Livrée active pour cela. `actif:false` : rien n'est calculé, affiché ni exporté. */
  const vertsAControler = Object.freeze({ actif: true });
  /* RETOUR À UN CUT (4.9, cadrage « Revenir à un cut », D-077 point 3) — LECTURE SEULE.
   * Action `goToCut` de l'adaptateur, demandée par l'action de panneau `goto-cut`. Elle
   * ne décide, ne pose, ne valide ni ne skippe rien ; aucune action du lot ne l'appelle.
   * `chemin` : 'auto' (événement interne d'ESV s'il est visible dans la page, sinon pas
   * à pas par les boutons précédent/suivant), 'evenement' ou 'pas' (ce chemin seul),
   * 'off' (refus). `pasMax` : au-delà de ce nombre de pas, le pas à pas est refusé (un
   * clic et une relecture par pas). Coupable sans reconstruire le moteur. */
  const retourCut = Object.freeze({
    chemin: 'auto',
    pasMax: 40,
  });
  /* --- Relevés en LECTURE SEULE de la 4.9.5.3 (S6, plan 5.0) ---
   * Chacun consigne, dans le journal ou le diagnostic de capture, une mesure de plus. AUCUN ne change la pose, la validation
   * ni la navigation ; aucun n'envoie de commande à ESV. Tous actifs par défaut dans cette version de test ; `false` coupe le
   * relevé sans autre effet. Les relevés de la page ESV (observateur) sont coupés par le service worker, qui le dit au pont.
   *   ressources    : statut HTTP (`responseStatus`, si le navigateur le donne) et durée des nœuds ept-data, compteur d'échecs.
   *   flushPct      : part de points « au ras » du passage à niveau, lue à CHAQUE cut (pas seulement au-dessus de 50 %).
   *   diagCapture   : profondeur d'octree des nœuds lus et budget de points du lecteur, dans le `diag` de `capture-read`.
   *   champsListe   : RailSpacing, TrajAzimuth, RailType, Success*, PK gardés de la liste, et inventaire des noms de champs.
   *   compteurBloque: `numNodesLoading` identique et > 0 au début de `cuts` cuts de suite : `diag-compteur-bloque`.
   *   avisFetch     : écriture passée par `fetch` (compteur `fetch-rails` non nul) : `avis-contrat-esv` et avis du panneau.
   *   empreinte     : empreinte du contrat ESV à « Connecter », comparée à la précédente DU MÊME ONGLET (4.9.5.4, D-139) ; avis si elle change.
   *                   Ni libellés de boutons ni nombre d'écouteurs (état de la page) : boutons par identifiant, écouteurs par présence.
   *   translationDepart : T monde/scène sur la pose de départ du cut, consignée à côté de l'actuelle (B1 reste sur l'actuelle).
   *   revisiteSansSource: revisite d'un différé sans source nouvelle, consignée seulement (rien n'est sauté).
   *   auditServeur  : au rechargement de la liste, validés côté serveur contre validations d'Ariane (`audit-serveur`).
   *   enteteMachine : navigateur, plateforme, mémoire, GPU dans l'en-tête de l'export. */
  const releves = Object.freeze({
    ressources: true, flushPct: true, diagCapture: true, champsListe: true,
    compteurBloque: Object.freeze({ actif: true, cuts: 3 }),
    avisFetch: true, empreinte: true, translationDepart: true, revisiteSansSource: true, auditServeur: true, enteteMachine: true,
  });
  /* Écouteurs jQuery EN OMBRE sur les événements internes d'ESV (`railPairSelected`, `railPairUpdated`, `railPairSeen`,
   * `loading`, `newPart`), posés par l'adaptateur sur `#globalcontainer` : événement `esv-event` (nom, arguments réduits aux
   * nombres et chaînes courtes, heure de la page). L'écouteur ne retourne rien, n'arrête rien, ne lève jamais : les
   * gestionnaires d'ESV passent comme avant. `ombre:false` : aucun écouteur posé. */
  const esvEvents = Object.freeze({ ombre: true, noms: Object.freeze(['railPairSelected', 'railPairUpdated', 'railPairSeen', 'loading', 'newPart']), parSecondeMax: 30 });
  /* --- Écho (4.9.0.18, audit fiches/AUDIT_ECHO_5.0.md) --- */
  const echo = Object.freeze({
    /* Gestes d'ESV lus comme une validation (AM-01) : Maj+Espace (valider et passer au
     * suivant), Ctrl+Entrée (valider sans passer au suivant, celui qu'Orbite relaie),
     * Entrée (annoncé par le titre du bouton d'ESV), clic sur le bouton de validation.
     * Une touche répétée (`repeat`) n'est jamais une intention de plus (AM-02). */
    validateKeys: Object.freeze(['Shift+Space', 'Ctrl+Enter', 'Enter', 'click']),
    /* Seuil en mètres au-dessous duquel un rail est dit « non déplacé » (AM-13) : une
     * re-pose numérique d'ESV (1e-6 m) n'est pas une correction. La comparaison exacte
     * (1e-7) reste consignée (`poseIdentical`). */
    movementThresholdM: 0.001,
    /* Après un rechargement de la page ESV (F5) ou une navigation vers une autre page
     * d'ESV, Écho se remet en observation tout seul (AM-05) : réinstallation de
     * l'observateur, nouvelle période, aucune commande envoyée à ESV. */
    repriseAutomatique: true,
    /* Délai (ms) pendant lequel une écriture de validation vue dans ESV est jointe à la
     * dernière visite close (AM-14) : l'écriture part après la navigation. */
    ecritureJointeMs: 5000,
    /* Décalage toléré (ms) entre la touche de validation et la lecture d'état de la page : le relevé de 125 ms peut tomber
     * quelques millisecondes APRÈS la touche (−6 ms sur 2 validations de la partie 24), avant que la validation ait pu
     * changer quoi que ce soit. Au-delà, la référence reste « horaire incertaine » (saut d'horloge, état en retard). */
    freshnessSkewMs: 50,
    /* D-143 : l'écriture serveur de validation (PUT 2xx, les deux rails, rattachée à la visite par numéro de ligne) fait foi
     * sur la référence humaine. Si ses rails diffèrent de la référence de plus de ce seuil (mètres, 1 mm), la référence est
     * remplacée (l'ancienne est gardée). Observation seulement : aucune requête ESV, aucune écriture. */
    ecritureReferenceSeuilM: 0.001,
    /* D-143 : un changement de rails observé dans cette fenêtre (ms) après la touche de validation est nommé
     * (`rail-change-after-validate-intent`) : ESV applique parfois le déplacement APRÈS la touche, la référence lue à la
     * touche peut alors être périmée. */
    changementApresIntentionMs: 150,
    /* 5.0 (chantier « déplacer la vue ») : relevé des glissers et des crans de molette de l'opérateur sur la vue d'ESV, en
     * observation pure (écouteurs passifs, rien n'est empêché ni commandé) : un événement `operator-gesture` par glisser (longueur,
     * direction, durée, bouton, clic final, caméra avant et après) et par série de crans (nombre, sens, deltaY, durée, caméra). Sert
     * à copier le geste de l'opérateur avant d'activer `deplacerVue`. `false` : aucun écouteur posé. */
    gestesVue: true,
    /* RM-11 (4.9.5 test 9, fiches/RM11_RAISON_CORRECTION.md) : la RAISON DE LA CORRECTION. Mic tape un chiffre (1 rail voisin, 2 ADV, 3 PN, 4 nuage
     * diffus ou pauvre, 5 hauteur seulement, 6 autre ; 0 efface) pour dire pourquoi il corrige un cut ; elle est consignée dans la visite
     * (`raisonCorrection`), du côté de l'étiquette, jamais dans les traits. COUPÉE par défaut ; le panneau l'allume avant la séance (lue au
     * démarrage d'Écho, gardée jusqu'à sa fin). Rien n'est retenu ni envoyé à ESV, jamais bloquant.
     *  - `touches` : la rangée de touches lue, 'chiffres' (rangée du haut ou pavé), sinon les replis 'alt-chiffres' puis 'pave' si ESV réagissait
     *    à un chiffre seul (le panneau les propose) ;
     *  - `graceMs` : une touche tapée au plus 500 ms après une validation va au cut validé (marque `apresValidationMs`) ;
     *  - `doubleAppuiMs` : deux appuis sur la même touche dans ce délai, sur le même cut, rendent la raison collante ;
     *  - `sautCuts` : la collante s'arrête si le cut visité est à plus de 30 cuts du précédent ; `rappelCollanteCuts` : rappel doux du panneau.
     * Les mêmes valeurs par défaut sont dans src/raison-correction.js (un essai les compare). */
    raison: Object.freeze({ actif: false, touches: 'chiffres', graceMs: 500, doubleAppuiMs: 600, sautCuts: 30, rappelCollanteCuts: 40 }),
  });
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
      { groupe: 'Pilote', nom: 'Mode rapide (V3)', valeur: { echantillon: 'neuf cuts sur dix (un sur dix en référence, tiré au sort)', tirage: 'un cut sur deux, tiré au sort', toujours: 'tous les cuts', reference: 'aucun cut' }[pilote.modeRapide ?? pilote.lectureI1] || 'aucun cut', pourquoi: 'Sur les cuts rapides, Ariane lit, change de vue et pose sans les attentes de prudence ; mêmes contrôles, mêmes points. Les cuts de référence surveillent la qualité. Le mode de chaque cut est consigné dans l’export.' },
      { groupe: 'Continuité', nom: 'Observation en Natif', valeur: continuity.observe ? 'active' : 'coupée', pourquoi: 'Calcule et consigne la pose partie des cuts voisins validés, sans l’appliquer ni l’afficher (amendement n°7).' },
      { groupe: 'Continuité', nom: 'Voisins de la liste d’ESV (B1)', valeur: { ombre: 'en ombre (calculés et consignés, sans effet sur la pose)', actif: 'actifs (dernier recours et garde du premier passage)', off: 'coupés' }[appuisListe] || 'coupés', pourquoi: 'Lit en mémoire de la page ESV le statut et les bords des cuts voisins, pour appuyer la voie d’un cut différé ou contrôler un premier passage sans appui (D-095). Aucune requête ajoutée.' },
      { groupe: 'Continuité', nom: 'Plafond du calage de convention (P1)', valeur: conventionPlafond === 'vertical' ? 'actif sur le vertical seulement (8 mm au plus)' : conventionPlafond ? 'actif (8 mm au plus par axe)' : 'coupé (rail hors domaine posé brut)', pourquoi: 'Un rail dont le décalage de convention dépasse 8 mm est posé avec 8 mm au plus au lieu d’être refusé ; le reste est consigné (D-129). Garde de paire inchangée.' },
      { groupe: 'Continuité', nom: 'Correction verticale en ombre (P8)', valeur: ombreVerticaleRefusee.actif ? 'consignée seulement (' + String(ombreVerticaleRefusee.mm).replace('.', ',') + ' mm sur les rails à convention refusée)' : 'coupée', pourquoi: 'Note dans la décision la pose qu’aurait donnée une correction verticale apprise (Mic remonte ces rails, D-140), à côté de la pose réelle. Jamais appliquée : la pose est la même avec ou sans.' },
      { groupe: 'Continuité', nom: 'Voie prédite en ombre (Orbite)', valeur: voiePrediteOmbre.actif ? 'consignée seulement (règle prudente D-147, à chaque cut différé)' : 'coupée', pourquoi: 'Note ce qu’aurait posé le moteur recentré sur la voie du lot, et le geste de vue qu’il aurait fallu. Jamais posé, aucune vue déplacée : la pose est la même avec ou sans.' },
      { groupe: 'Continuité', nom: 'Mémoire des différés en ombre (Écho)', valeur: memoireDifferesOmbre.actif ? 'consignée seulement (série de différés, ' + memoireDifferesOmbre.K + ' dernières corrections)' : 'coupée', pourquoi: 'Note, avant de lire ta référence sur le cut, la pose qu’aurait donnée la voie de tes corrections précédentes de la série. Rien n’est posé ni commandé.' },
      { groupe: 'Continuité', nom: 'Déplacer la vue (Orbite)', valeur: deplacerVue.actif ? 'actif (dézoom ≤ ×' + String(deplacerVue.dezoomMax).replace('.', ',') + ' ou glisser ≤ ' + deplacerVue.glissementPxMax + ' px, ' + deplacerVue.gestesMax + ' gestes par rail au plus)' : 'coupé', pourquoi: 'Quand la cible d’un rail tombe hors de la vue d’ESV, Ariane dézoome à la molette ou glisse la vue comme toi, pose, puis remet la vue. Coupé : ces cuts restent différés.' },
      { groupe: 'Écho', nom: 'Relevé des glissers et de la molette', valeur: echo.gestesVue ? 'actif (observation seule)' : 'coupé', pourquoi: 'Note la longueur, la durée, le bouton et les crans de tes gestes sur la vue, avec la caméra avant et après, pour copier ton geste. Rien n’est empêché ni commandé.' },
      { groupe: 'Continuité', nom: 'Règles métier de Mic en ombre (Orbite)', valeur: reglesMetier.ombre ? (reglesMetier.actif ? 'ACTIVES pour : ' + (Object.keys(reglesMetier.regles).filter(k => reglesMetier.regles[k]).join(', ') || 'aucune règle') : 'consignées seulement (PN et marges, grappes de différés, verts à contrôler) ; activation coupée') : 'coupées', pourquoi: 'Note à chaque cut la zone reconnue (passage à niveau, grappe de différés), la règle de Mic qui se déclenche et ce qu’Ariane aurait fait : différer au lieu de valider, ou te signaler un vert à contrôler. Rien n’est posé ni différé tant que Mic n’active pas.' },
      { groupe: 'Continuité', nom: 'Hauteur apprise en ombre (Orbite)', valeur: hauteurApprise.actif ? (hauteurApprise.appliquer ? 'ACTIVE : pose la hauteur corrigée' : 'consignée seulement (hauteur corrigée selon l’épaisseur du dessus, ' + String(hauteurApprise.plafondMm).replace('.', ',') + ' mm au plus)') : 'coupée', pourquoi: 'Note, pour chaque cut posé par le lot, la hauteur que l’opérateur aurait probablement donnée au rail (apprise sur ses corrections), à côté de la pose réelle. Jamais appliquée tant que l’opérateur ne l’active pas : la pose est la même avec ou sans.' },
      { groupe: 'Continuité', nom: 'Faux vert en ombre (Orbite)', valeur: fauxVertOmbre.actif ? (fauxVertOmbre.differer ? 'actif : diffère les cuts à hauteur ambiguë' : 'consigné seulement (hauteur ambiguë : calage ≥ ' + fauxVertOmbre.dzMinMm + ' mm et dessus épais ≥ ' + fauxVertOmbre.epaisseurMinMm + ' mm)') : 'coupé', pourquoi: 'Note, pour chaque cut posé par le lot, s’il ressemble à un faux vert (hauteur du rail ambiguë). Jamais appliqué : la pose et la validation sont les mêmes avec ou sans.' },
      { groupe: 'Continuité', nom: 'Verts à contrôler (fin de lot)', valeur: vertsAControler.actif ? 'actif (liste à consulter, aucune action dans ESV)' : 'coupé', pourquoi: 'Après un lot, liste les verts qu’Ariane n’a pas visités et qui méritent ta relecture (écartement, hauteur d’un rail, grappe de rouges, voisin d’un différé), par plages, avec le temps estimé. Rien n’est cliqué ni changé dans ESV.' },
      { groupe: 'Continuité', nom: 'Mémoire de la liste d’ESV (E1)', valeur: listeMemoire.actif ? 'active' : 'coupée', pourquoi: 'Garde en local, par partie, les bords qu’Ariane a écrits et un instantané compact de la liste ; compte les cuts que tu as corrigés depuis (aucune requête vers ESV).' },
      { groupe: 'Continuité', nom: 'Décision sur le lot (Pilote)', valeur: lot.observe ? 'calculée' : 'coupée', pourquoi: 'Décide chaque cut avec les cuts déjà placés du lot (amendement n°9). Appliquée ou seulement consignée selon le réglage choisi à la création du lot (4.7.10).' },
      { groupe: 'Écho', nom: 'Gestes de validation', valeur: 'Maj+Espace, Ctrl+Entrée, Entrée, bouton', pourquoi: 'Chacun vaut une validation ; une touche répétée ne compte pas deux fois.' },
      { groupe: 'Écho', nom: 'Seuil de déplacement', valeur: (echo.movementThresholdM * 1000) + ' mm', pourquoi: 'En dessous, le rail est dit non déplacé ; la pose exacte reste consignée.' },
      { groupe: 'Écho', nom: 'Raison de la correction', valeur: echo.raison.actif ? 'allumée' : 'coupée (à allumer dans le panneau avant la séance)', pourquoi: 'Tu tapes 1 à 6 (0 efface) pour dire pourquoi tu corriges un cut ; consignée dans la visite, jamais dans les traits. Rien n’est retenu ni envoyé à ESV.' },
      { groupe: 'Écho', nom: 'Reprise après F5', valeur: echo.repriseAutomatique ? 'automatique' : 'à la main', pourquoi: 'Écho se remet à observer après un rechargement de la page ESV, sans rien commander.' },
      { groupe: 'Export', nom: 'Vidage automatique à', valeur: mo(exportSettings.watermarkBytes) + ' en attente', pourquoi: 'Écrit un segment avant la limite de téléchargement.' },
      { groupe: 'Export', nom: 'Libération après écriture', valeur: exportSettings.releaseAfterExport ? 'oui' : 'non', pourquoi: 'Purge les objets déjà écrits sur disque pour que la session reparte de zéro. Les identifiants restent déclarés : un segment manquant est signalé à la fusion.' },
      { groupe: 'Export', nom: 'Allègement des nuages', valeur: exportSettings.mode === 'allege' ? 'actif (sondes sans information retirées)' : 'aucun (tout est conservé)', pourquoi: 'D-091 : environ un tiers de moins sur les nuages LiDAR du zip. Les points restent exacts ; chaque nuage allégé le dit (exportLightening).' },
      { groupe: 'Export', nom: 'Taille d’un volume zip', valeur: mo(exportSettings.zipMaxBytes) + ' au plus (compressé)', pourquoi: 'Au-delà, un volume suivant ; un fichier JSON n’est jamais coupé.' },
      { groupe: 'Export', nom: 'Taille de segment visée', valeur: mo(exportSettings.segmentBytes), pourquoi: 'Réserve de ' + mo(exportSettings.segmentReserveBytes) + ', plancher de ' + exportSettings.minObjectsPerSegment + ' objets.' },
      { groupe: 'Export', nom: 'Compactage', valeur: exportSettings.compact ? 'activé' : 'désactivé', pourquoi: 'Retire les champs dérivables, sans effet sur le moteur.' },
      { groupe: 'Lecteur', nom: 'Budget de lecture', valeur: exportSettings.compact === null ? '' : reader.maxMillis + ' ms', pourquoi: 'Par capture, points déjà chargés seulement.' },
      { groupe: 'Lecteur', nom: 'Points par rail', valeur: reader.maxPointsPerRail.toLocaleString('fr-FR'), pourquoi: 'Plafond de rétention en mémoire.' },
      { groupe: 'Lecteur', nom: 'Qualification', valeur: reader.coverage.minimumLongitudinalBins + ' tranches, étendue ' + String(reader.coverage.minimumLongitudinalSpan).replace('.', ','), pourquoi: 'Minimum pour qu’un instantané soit retenu.' },
    ];
  }

  /* L'objet rendu est gelé au premier niveau (chaque réglage l'est déjà en profondeur, un essai le vérifie) : une affectation
   * `BananeSettings.x = …` ne peut pas ouvrir un chemin d'activation. Les essais qui remplacent l'objet entier ou en font une copie
   * (`{ ...Settings, x }`) ne sont pas touchés. */
  return Object.freeze({ Mo, collector, pilote, continuity, lot, export: exportSettings, reader, observateurPassif, appuisListe, conventionPlafond, ombreVerticaleRefusee, voiePrediteOmbre, memoireDifferesOmbre, deplacerVue, reglesMetier, fauxVertOmbre, hauteurApprise, listeMemoire, retourCut, echo, releves, esvEvents, derived, describe, vertsAControler });
});
