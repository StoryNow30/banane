/* CH-081 (D-311 ; étude chantiers/CH-081/etude.md) — ZONE DU PRÉCHAUFFAGE : LA BOÎTE DE DÉCOUPE D'ESV DE LA COUPE SUIVANTE.
 * Module de la PAGE d'ESV (monde principal), pur : aucune lecture de la page, aucune requête, rien d'écrit ; il ne fait que de la géométrie.
 *
 * Mesuré (corpus des lots « Vision 5 » et « Vision 6 » du 09/11, 557 captures, 1 114 vues ; ÉTABLI) :
 *  - la caméra d'ESV est orthographique, posée sur le rail, axe dans la voie ; ESV pose une boîte de découpe (`SHOW_INSIDE`, `INSIDE_ANY`, une boîte)
 *    de 4 m en travers, 0,5 m en long et 2 m en haut, centrée sur le milieu des deux rails au millimètre et alignée sur la voie ;
 *  - Potree 1.8 (`Potree_update_visibility.js`) en orthographique : pas de critère de taille à l'écran (`minimumNodePixelSize` n'existe que pour la
 *    perspective) ; il retient un nœud qui coupe le frustum ET la boîte, sans arrêt de détail, jusqu'aux feuilles, dans `pointBudget` ;
 *  - les 13 511 nœuds visibles des 1 114 vues coupent tous cette boîte ; la règle « nœuds qui coupent la boîte » couvre 1 264 nœuds nouveaux sur 1 264 à
 *    l'arrivée, avec 0 à 1 nœud de trop par coupe (médiane), 2 à 4 au P90. Le cube de 0,75 m autour des rails n'en couvre que 85 % à 94 %.
 *
 * Ce que rend le module :
 *  - `boiteCoupe(gauche, droite, dims)` : la boîte de la coupe (centre, axes travers / long / haut, demi-côtés, six plans), d'après les rails prédits ;
 *  - `coupeBoite(boite, bm)` : la boîte coupe-t-elle la boîte monde `bm` = [[x,y,z] min, [x,y,z] max] d'un nœud ? Test de Potree 1.8 à l'identique :
 *    six plans tournés vers l'intérieur, puis `THREE.Frustum.intersectsBox` (le sommet le plus avancé vers la normale de chaque plan) ;
 *  - `distanceBoite(boite, bm)` : distance du centre de la boîte au nœud (ordre de demande, du plus proche au plus loin à niveau égal) ;
 *  - `calibrer(elements, gauche, droite)` : dimensions lues sur la boîte de découpe que Potree tient pour la coupe COURANTE (`material.clipBoxes[0]
 *    .box.matrixWorld.elements`, lecture seule), si elle est bien centrée sur les rails et alignée sur eux ; sinon null (on garde les dimensions mesurées) ;
 *  - `zone(gauche, droite, dims)` : objet { coupe(bm), distance(bm) } que le préchauffage emploie à la place du cube.
 * Aucun nombre n'est rapporté sur une adresse ou une clé ; rien n'est gardé entre deux appels. */
/** @template T @param {unknown} root @param {() => T} factory */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else /** @type {{BananePrechauffageBoite?:unknown}} */ (root).BananePrechauffageBoite = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  /* Dimensions mesurées de la boîte de découpe d'ESV (mètres) : travers (axe des rails), long (axe de la voie), haut (vertical). */
  const DIMS_ESV = Object.freeze({ travers: 4, long: 0.5, haut: 2 });
  const BORNES_DIMS = { travers: [0.5, 20], long: [0.05, 10], haut: [0.2, 20] };
  /* Rails acceptés : écart horizontal entre 0,5 et 3 m (voie normale 1,435 m ; au-delà, ce n'est plus une paire de rails). */
  const ECART_MIN = 0.5, ECART_MAX = 3;
  /* Calibration : centre de la boîte d'ESV à moins de 5 cm du milieu des rails, axe travers à moins d'environ 2,6° des rails. */
  const CENTRE_TOL = 0.05, COS_MIN = 0.999;
  const fini = v => typeof v === 'number' && Number.isFinite(v);
  const point = v => Array.isArray(v) && v.length === 3 && v.every(fini) ? v : null;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  /** Dimensions lues : chaque clé hors bornes reprend la mesure. */
  function dimensions(d) {
    const out = { ...DIMS_ESV };
    if (d && typeof d === 'object') for (const [k, [a, b]] of Object.entries(BORNES_DIMS)) if (fini(d[k]) && d[k] >= a && d[k] <= b) out[k] = d[k];
    return Object.freeze(out);
  }

  /** Repère de voie : u travers (gauche → droite, horizontal), t long (horizontal), z vertical ; null si les rails ne forment pas une paire. */
  function repere(gauche, droite) {
    const L = point(gauche), R = point(droite); if (!L || !R) return null;
    const dx = R[0] - L[0], dy = R[1] - L[1], l = Math.hypot(dx, dy); if (!(l >= ECART_MIN && l <= ECART_MAX)) return null;
    const u = [dx / l, dy / l, 0];
    return { u, t: [-u[1], u[0], 0], z: [0, 0, 1], centre: [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2, (L[2] + R[2]) / 2] };
  }

  /** Boîte de découpe de la coupe dont les rails sont `gauche` et `droite` (repère monde, celui de `matrixWorld`), ou null. */
  function boiteCoupe(gauche, droite, dims) {
    const r = repere(gauche, droite); if (!r) return null;
    const D = dimensions(dims), axes = [r.u, r.t, r.z], demi = [D.travers / 2, D.long / 2, D.haut / 2], c = r.centre;
    /* Plans {n, w} tournés vers l'intérieur : n·p + w ≥ 0 dedans. Pour chaque axe a : face + (n = −a) et face − (n = +a), comme Potree les construit
     * depuis les points (±0,5, 0, 0) etc. de la boîte unité transformée. */
    const plans = [];
    axes.forEach((a, i) => { const ac = dot(a, c); plans.push([-a[0], -a[1], -a[2], ac + demi[i]], [a[0], a[1], a[2], -ac + demi[i]]); });
    return Object.freeze({ centre: c, axes, demi, plans, dims: D });
  }

  /** `THREE.Frustum.intersectsBox` sur les six plans de la boîte : faux seulement si le sommet le plus avancé vers la normale d'un plan est dehors. */
  function coupeBoite(boite, bm) {
    if (!boite || !Array.isArray(bm) || bm.length !== 2) return false;
    const [lo, hi] = bm;
    for (const [x, y, z, w] of boite.plans) if ((x > 0 ? hi[0] : lo[0]) * x + (y > 0 ? hi[1] : lo[1]) * y + (z > 0 ? hi[2] : lo[2]) * z + w < 0) return false;
    return true;
  }

  /** Distance du centre de la boîte de découpe à la boîte monde du nœud (0 si le centre est dedans). */
  function distanceBoite(boite, bm) {
    const c = boite.centre, [lo, hi] = bm;
    return Math.hypot(...[0, 1, 2].map(i => Math.max(lo[i] - c[i], 0, c[i] - hi[i])));
  }

  /** Dimensions de la boîte de découpe que Potree tient pour la coupe COURANTE (matrice monde de la boîte unité, colonne-major, 16 nombres), si elle
   * est centrée sur les rails courants et alignée sur eux (vertical : troisième axe) ; sinon null. Lecture seule, rien n'est gardé. */
  function calibrer(elements, gauche, droite) {
    const M = elements; if (!Array.isArray(M) && !(M && typeof M.length === 'number')) return null;
    if (M.length !== 16 || ![...M].every(fini)) return null;
    const r = repere(gauche, droite); if (!r) return null;
    const col = i => [M[4 * i], M[4 * i + 1], M[4 * i + 2]], len = v => Math.hypot(...v);
    const ax = [col(0), col(1), col(2)], c = col(3), ls = ax.map(len); if (!ls.every(l => l > 0)) return null;
    if (Math.hypot(c[0] - r.centre[0], c[1] - r.centre[1], c[2] - r.centre[2]) > CENTRE_TOL) return null;
    if (Math.abs(dot(ax[0], r.u)) / ls[0] < COS_MIN || Math.abs(dot(ax[1], r.t)) / ls[1] < COS_MIN || Math.abs(dot(ax[2], r.z)) / ls[2] < COS_MIN) return null;
    const d = { travers: ls[0], long: ls[1], haut: ls[2] };
    return Object.entries(BORNES_DIMS).every(([k, [a, b]]) => d[k] >= a && d[k] <= b) ? Object.freeze(d) : null;
  }

  /** Zone du préchauffage pour la coupe suivante : { coupe(bm), distance(bm), boite } ou null si les rails ne forment pas une paire. */
  function zone(gauche, droite, dims) {
    const b = boiteCoupe(gauche, droite, dims); if (!b) return null;
    return Object.freeze({ boite: b, coupe: bm => coupeBoite(b, bm), distance: bm => distanceBoite(b, bm) });
  }

  return Object.freeze({ DIMS_ESV, dimensions, repere, boiteCoupe, coupeBoite, distanceBoite, calibrer, zone });
});
