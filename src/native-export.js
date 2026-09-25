/* Banane V4.5-R — format d'export compact, sans perte d'information.
 *
 * Problème traité : l'export Natif v2 répète massivement les mêmes structures
 * (repère de rail avec contours de profil, identité, observation de vue, repère
 * de coordonnées) dans chaque chunk, chaque snapshot et chaque résumé de
 * capture, et il stocke `pointsProfileLocal` qui est le produit exact de
 * `sceneRelativeToProfileLocal` par `pointsSceneRelative`.
 *
 * Mesure sur le témoin 1789328681673 (88,9 Mo) :
 *   pointsProfileLocal   24,0 Mo (27 %)  — dérivable
 *   rail dupliqué         6,2 Mo         — 57 repères distincts sur 301 chunks
 *   résumés de capture    6,5 Mo         — railObservations avec contours
 *   pointSources          4,0 Mo         — diagnostic pur
 *
 * Ce module interne les structures répétées dans des dictionnaires et retire
 * les champs strictement dérivables. `expand()` reconstruit le document v2.
 *
 * Contrat de non-régression : `buildEngineInput` (native-offline-evaluate.cjs)
 * ne lit QUE `pointsSceneRelative` et `visibleByClipBoxes`. `pointsProfileLocal`
 * n'est lu qu'en un seul point, qui possède déjà un repli le recalculant.
 * Le retrait est donc sans effet sur les résultats du moteur.
 */
(function (root, factory) {
  const api = factory(typeof module === 'object' ? require('./core.js') : root.BananeCore3);
  if (typeof module === 'object') module.exports = api; else root.BananeNativeExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (K) {
  'use strict';

  const FORMAT = 'banane-native-session-v3-compact';
  const REF = '__ref';
  const CHUNK = 'banane-native-lidar-chunk-v1';
  const CAPTURE = 'banane-native-lidar-capture-v2';

  // Structures internées. L'ordre compte : la première correspondance gagne.
  const SHAPES = [
    {
      name: 'rails',
      match: o => typeof o.railLocalToSceneRelative === 'object' && Array.isArray(o.railLocalToSceneRelative) &&
        Array.isArray(o.profileLocalToSceneRelative) && Array.isArray(o.sceneRelativeToProfileLocal),
    },
    {
      name: 'views',
      match: o => o.viewEpochId !== undefined && o.camera !== undefined,
    },
    {
      name: 'coords',
      match: o => o.name === 'scene-relative' && typeof o.matrixLayout === 'string',
    },
    {
      name: 'identities',
      match: o => 'pageId' in o && 'part' in o && 'cut' in o && 'frameId' in o && Object.keys(o).length <= 8,
    },
  ];

  function shapeOf(o) {
    for (const s of SHAPES) { try { if (s.match(o)) return s.name; } catch (_) { /* forme non concernée */ } }
    return null;
  }

  /* Dictionnaires partagés : permet de compacter en flux, chunk par chunk,
   * sans jamais charger toute la session en mémoire. */
  function createInterner() {
    const store = {}, index = {};
    for (const s of SHAPES) { store[s.name] = []; index[s.name] = new Map(); }
    return {
      dictionaries: store,
      /* Poids sérialisé courant des dictionnaires. Chaque segment étant
       * autonome, il reconstruit ses propres dictionnaires : mesuré sur un
       * export réel, ils pèsent 7,2 Mo par segment. Sans ce suivi, un budget
       * de segment calculé sur les seuls nuages est dépassé de plusieurs Mo. */
      bytes: 2,
      intern(name, value) {
        const k = JSON.stringify(value);
        const map = index[name];
        let i = map.get(k);
        if (i === undefined) {
          i = store[name].length; store[name].push(JSON.parse(k)); map.set(k, i);
          this.bytes += k.length + 1;
        }
        return i;
      },
      stats() {
        const out = {};
        for (const s of SHAPES) out[s.name] = store[s.name].length;
        return out;
      },
    };
  }

  /* Remplace récursivement toute structure connue par une référence. */
  function foldRefs(value, interner) {
    if (Array.isArray(value)) {
      // Tableau de points : aucune sous-structure à interner, on court-circuite.
      if (value.length && Array.isArray(value[0]) && typeof value[0][0] === 'number') return value;
      return value.map(v => foldRefs(v, interner));
    }
    if (!value || typeof value !== 'object') return value;
    const shape = shapeOf(value);
    if (shape) return { [REF]: shape + ':' + interner.intern(shape, value) };
    const out = {};
    for (const k of Object.keys(value)) out[k] = foldRefs(value[k], interner);
    return out;
  }

  function unfoldRefs(value, dictionaries) {
    if (Array.isArray(value)) {
      if (value.length && Array.isArray(value[0]) && typeof value[0][0] === 'number') return value;
      return value.map(v => unfoldRefs(v, dictionaries));
    }
    if (!value || typeof value !== 'object') return value;
    const ref = value[REF];
    if (typeof ref === 'string') {
      const sep = ref.lastIndexOf(':');
      const name = ref.slice(0, sep), i = Number(ref.slice(sep + 1));
      const table = dictionaries[name];
      if (!table || !table[i]) throw Error('Référence de dictionnaire introuvable : ' + ref);
      return JSON.parse(JSON.stringify(table[i]));
    }
    const out = {};
    for (const k of Object.keys(value)) out[k] = unfoldRefs(value[k], dictionaries);
    return out;
  }

  /* Champs strictement dérivables retirés des chunks LiDAR. */
  function stripDerived(cloud, options) {
    if (cloud.format !== CHUNK) return cloud;
    const dropped = [];
    const out = {};
    for (const k of Object.keys(cloud)) {
      if (k === 'pointsProfileLocal' && options.dropProfileLocal !== false) { dropped.push(k); continue; }
      if (k === 'pointSources' && options.dropPointSources !== false) { dropped.push(k); continue; }
      out[k] = cloud[k];
    }
    if (dropped.length) out.droppedDerivedFields = dropped;
    return out;
  }

  function restoreDerived(cloud) {
    const dropped = cloud.droppedDerivedFields;
    if (!Array.isArray(dropped) || !dropped.length) return cloud;
    const out = { ...cloud };
    delete out.droppedDerivedFields;
    if (dropped.includes('pointsProfileLocal')) {
      const m = out.rail && out.rail.sceneRelativeToProfileLocal;
      out.pointsProfileLocal = m && Array.isArray(out.pointsSceneRelative)
        ? out.pointsSceneRelative.map(p => K.C.point(m, p))
        : [];
    }
    if (dropped.includes('pointSources')) out.pointSources = null; // diagnostic non reconstructible
    return out;
  }

  /* --- API par objet, pour un export en flux --- */
  function compactCloud(cloud, interner, options) {
    return foldRefs(stripDerived(cloud, options || {}), interner);
  }
  function expandCloud(cloud, dictionaries) {
    return restoreDerived(unfoldRefs(cloud, dictionaries));
  }

  /* --- API document complet --- */
  function compact(doc, options) {
    const opt = options || {};
    const interner = createInterner();
    const { clouds, ...rest } = doc;
    const meta = foldRefs(rest, interner);
    const packed = (clouds || []).map(c => compactCloud(c, interner, opt));
    return {
      ...meta,
      format: FORMAT,
      compactedFrom: doc.format || null,
      compaction: {
        tool: 'native-export.js',
        droppedDerivedFields: [
          opt.dropProfileLocal === false ? null : 'pointsProfileLocal',
          opt.dropPointSources === false ? null : 'pointSources',
        ].filter(Boolean),
        dictionarySizes: interner.stats(),
        note: 'Aucune valeur modifiée. pointsProfileLocal est recalculable exactement ' +
          'par sceneRelativeToProfileLocal x pointsSceneRelative ; pointSources est un diagnostic.',
      },
      clouds: packed,
      dictionaries: interner.dictionaries,
    };
  }

  /* KI-060 (4.7.20) — jusqu'à la 4.7.19, le nuage qui déclenchait la coupe d'un
   * segment était compacté avec le dictionnaire du segment EN COURS, puis écrit
   * en tête du segment SUIVANT, dont le dictionnaire est neuf : ses références
   * visent le dictionnaire du segment précédent. Lu avec le sien, il échoue
   * (« référence introuvable ») ou, pire, prend les entrées d'un autre nuage
   * (terrain du 25/09, bilan de la partie 6 : pose de départ du rail gauche d'un
   * autre cut). Un tel segment est reconnu par sa trace : ouvert au fil de
   * l'export (plus d'objets écrits au total que dans le segment) et sans la
   * marque `selfContained` des exports 4.7.20. Sans trace : index ≥ 2. */
  function misfiledHead(doc) {
    const seg = doc && doc.segment, t = doc && doc.exportTrace;
    if (!seg || seg.selfContained === true || doc.format !== FORMAT || !(doc.clouds || []).length) return false;
    if (!t || !Number.isFinite(t.cloudObjects) || !Number.isFinite(t.segmentObjects)) return (seg.index || 0) >= 2;
    return t.cloudObjects > t.segmentObjects;
  }

  /* `options.previousDictionaries` : dictionnaires du segment précédent du même
   * export (même `segment.stamp`, index − 1), pour relire le premier nuage d'un
   * segment touché par KI-060. Sans eux, ce nuage est retiré plutôt que lu faux ;
   * `segmentRepair` le dit dans le document. */
  function expand(doc, options) {
    if (doc.format !== FORMAT) return doc;
    const dictionaries = doc.dictionaries || {}, previous = options && options.previousDictionaries;
    const { clouds, dictionaries: _d, compaction, compactedFrom, ...rest } = doc;
    const meta = unfoldRefs(rest, dictionaries);
    meta.format = compactedFrom || 'banane-native-session-v2';
    let list = clouds || [], head = [], repair = null;
    if (misfiledHead(doc)) {
      if (previous) {
        head = [expandCloud(list[0], previous)];
        repair = { issue: 'KI-060', action: 'reread', note: 'premier nuage relu avec le dictionnaire du segment précédent' };
      } else {
        repair = { issue: 'KI-060', action: 'dropped', note: 'premier nuage retiré : ses références visent le dictionnaire du segment précédent, absent' };
      }
      list = list.slice(1);
    }
    return { ...meta, ...(repair ? { segmentRepair: repair } : {}),
      clouds: [...head, ...list.map(c => expandCloud(c, dictionaries))] };
  }

  return { FORMAT, REF, SHAPES, createInterner, foldRefs, unfoldRefs, compactCloud, expandCloud, compact, expand, misfiledHead };
});
