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

  /* --- Ariane 4.9 (V2, D-079) : modes d'export et en-tête écrit une seule fois ---
   *
   * MODE. `mode: 'complet'` : intensité, classe, pointSources, probes, tout est
   * conservé. Un mode est un objet { nom, nuage(cloud) }, où `nuage` rend le
   * nuage à écrire, SANS toucher au flux d'écriture. Depuis la 4.9.0.9 (D-091),
   * le réglage choisit « allege » (ci-dessous) ; « complet » reste le repli
   * du code. Un nom inconnu est REFUSÉ (jamais remplacé en silence).
   */
  /* D-091 (4.9.0.9) : mode « allege » (allègement A, validé par la direction le 13 octobre).
   * Sur le lot de 112 cuts de la 4.9.0.8, les nuages font 88 % du zip ; ce mode les allège
   * d'environ un tiers sans toucher à une seule valeur que la pose, le moteur ou l'analyse
   * utilisent : il retire les SONDES de diagnostic (`probes`) des seuls nœuds qui n'ont retenu
   * aucun point (`retained === 0`) ET dont aucune sonde ne touche la zone d'intérêt (`roiHit`,
   * `hierarchyRoiHit`) : 2 711 nœuds sur 3 692 dans ce lot, sans information. Un nœud vide
   * dont une sonde touche la zone (anomalie à comprendre : 121 dans ce lot) garde ses sondes ;
   * un nœud sans `retained` aussi ; `nearestToRailOrigin` est toujours gardé. Les points, eux,
   * restent au bit près : l'arrondi au micromètre d'abord prévu (−11 points de plus) faisait
   * échouer, à 0,3 µm, le contrôle de rejeu exact d'acceptance-report (relecture du 13 octobre).
   * Le nuage porte `exportLightening`, qui dit ce qui a été retiré ; le nuage stocké n'est pas
   * modifié (copie). Un nuage sans rien à alléger est rendu tel quel. */
  const vrai = v => v === true || (!!v && typeof v === 'object' && Object.values(v).some(x => x === true));
  const toucheLaZone = node => Array.isArray(node.probes) &&
    node.probes.some(p => !!p && typeof p === 'object' && (vrai(p.roiHit) || vrai(p.hierarchyRoiHit)));
  function alleger(cloud) {
    if (!cloud || typeof cloud !== 'object' || !Array.isArray(cloud.nodes)) return cloud;
    let noeuds = 0;
    const nodes = cloud.nodes.map(node => {
      if (!node || typeof node !== 'object' || !('probes' in node) || node.retained !== 0 || toucheLaZone(node)) return node;
      const { probes, ...reste } = node; noeuds++; return reste;
    });
    if (!noeuds) return cloud;
    return { ...cloud, nodes, exportLightening: { mode: 'allege', decision: 'D-091', probesRemovedFromNodes: noeuds,
      probesRule: 'retained === 0 et aucune sonde roiHit ni hierarchyRoiHit', pointsUnchanged: true } };
  }
  const MODES = Object.freeze({
    complet: Object.freeze({ nom: 'complet', nuage: cloud => cloud }),
    allege: Object.freeze({ nom: 'allege', nuage: alleger }),
  });
  const MODE_DEFAUT = 'complet';
  function exportMode(nom) {
    const mode = MODES[nom === undefined || nom === null ? MODE_DEFAUT : nom];
    if (!mode) throw Error('Mode d’export inconnu : ' + nom + ' (disponible : ' + Object.keys(MODES).join(', ') + ').');
    return mode;
  }

  /* EN-TÊTE UNIQUE. Un export en plusieurs segments recopiait dans CHAQUE
   * segment les mêmes `events`, `records`, `state`, diagnostic… (mesuré sur le
   * lot 7 : 3 x 8,9 Mo d'événements, 3 x 2,6 Mo de diagnostic). Désormais seul
   * le premier segment d'un export porte ces parties ; les suivants gardent un
   * en-tête mince (même format, mêmes clés d'identification) et la marque
   * `segment.headerIn` = index du segment qui les porte. Les listes sont
   * laissées vides (`[]`) pour que la forme du document reste reconnue par les
   * lecteurs (ex. `Array.isArray(doc.records)`), les objets sont retirés.
   * Aucune information n'est perdue : le premier segment est un instantané
   * complet, les suivants n'ont jamais eu que la même copie. */
  const UNE_FOIS = ['events', 'records', 'state', 'stateOmits', 'closureSummary', 'v1TimingExport', 'diagnostic', 'raisonSeries'];   // RM-11 (test 9) : les séries de raisons collantes, une fois
  function enteteMince(metadata) {
    const out = {};
    for (const k of Object.keys(metadata)) {
      if (!UNE_FOIS.includes(k)) out[k] = metadata[k];
      else if (Array.isArray(metadata[k])) out[k] = [];
    }
    return out;
  }

  /* --- CH-049-C : vidage automatique en DELTA ---
   *
   * Mesuré le 04/11 sur l'Écho des parties 13-14-15 (8 segments à métadonnées, un vidage toutes les ~2 min) : chaque vidage
   * réécrit l'instantané COMPLET de la session (événements, visites, dictionnaires), car seuls les nuages sont purgés après
   * confirmation. Sur 54,3 Mo d'événements écrits, 37,9 Mo (70 %) l'étaient déjà ; sur 74,5 Mo d'entrées de dictionnaire,
   * 54,2 Mo (73 %) ; les visites, développées, sont identiques d'un vidage à l'autre à quelques champs près.
   *
   * Le delta n'écrit, pour un vidage automatique, que les événements et les visites NEUFS OU MODIFIÉS depuis le dernier vidage
   * confirmé écrit. Les nuages, la session et le reste de l'en-tête ne changent pas. L'export final reste complet (il n'appelle
   * pas ceci). merge-segments relit déjà ces séries : union des événements (par eventId, sinon eventSeq) et des visites (par
   * recordId), le dernier segment en date l'emporte. Aucune entrée n'est modifiée ; le jalon est une valeur (empreintes), jamais
   * le contenu. Un élément sans identifiant est toujours renvoyé : on ne devine pas. Une autre session remet tout à zéro. */
  const empreinte = s => {   // cyrb53 : 53 bits, sans dépendance ; une collision ne ferait que taire une modification, d'où deux empreintes
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x9e3779b1;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); h3 = Math.imul(h3 ^ c, 2246822519);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + '.' + (h3 >>> 0).toString(36) + '.' + s.length;
  };
  const cleEvenement = e => e && (e.eventId || (e.eventSeq !== undefined && e.eventSeq !== null ? 'seq:' + e.eventSeq : null));
  const cleVisite = r => r && (r.recordId || r.id || null);
  function deltaListe(liste, cle, avant) {
    const suivant = new Map(), gardes = [];
    for (const x of liste || []) {
      const k = cle(x);
      if (k === null || k === undefined) { gardes.push(x); continue; }
      const h = empreinte(JSON.stringify(x));
      suivant.set(k, h);
      if (!avant || avant.get(k) !== h) gardes.push(x);
    }
    return { gardes, suivant };
  }
  /* `doc` : le jeu d'export non compacté (records, events, clouds…). `jalon` : rendu par `confirmerJalon`, ou null.
   * Rend { doc, jalon (à n'adopter qu'après confirmation), jalonAvant, stats }. */
  function deltaMetadonnees(doc, jalon) {
    const session = doc && doc.session && doc.session.id;
    const valide = jalon && jalon.version === 1 && session !== undefined && jalon.session === session;
    const ev = deltaListe(doc.events, cleEvenement, valide ? jalon.events : null);
    const rc = deltaListe(doc.records, cleVisite, valide ? jalon.records : null);
    const stats = {
      events: { total: (doc.events || []).length, envoyes: ev.gardes.length },
      records: { total: (doc.records || []).length, envoyes: rc.gardes.length },
    };
    return {
      doc: { ...doc, events: ev.gardes, records: rc.gardes,
        deltaVidage: { ...stats, note: 'Vidage en delta : événements et visites neufs ou modifiés depuis le vidage précédent ; ' +
          'tools/merge-segments.cjs réunit la série (l’export final est complet).' } },
      jalon: { version: 1, session: session === undefined ? null : session, events: ev.suivant, records: rc.suivant },
      jalonAvant: valide ? jalon : null,
      stats,
    };
  }
  /* Le jalon n'avance que si TOUS les fichiers du vidage sont confirmés écrits ; sinon on garde l'ancien, donc rien n'est perdu. */
  function confirmerJalon(resultat, confirme) { return confirme === true ? resultat.jalon : resultat.jalonAvant; }

  /* --- CH-049-C : le bilan ne recopie pas les événements du journal ---
   *
   * Mesuré le 04/11 sur « Tout télécharger » (lot des parties 6-15) : les 131 379 événements du bilan sont les 131 377 du journal, mêmes octets, même
   * ordre, plus 2 événements insérés ; ils pèsent 20,5 Mo compressés sur les 21,7 Mo du volume du bilan (7 % du zip du lot). `evenementsParReference`
   * remplace cette copie par {journal, total, signature, ajouts:[{position, evenement}]} quand le bilan est EXACTEMENT le journal avec des insertions ;
   * sinon (événement modifié, retiré ou réordonné) elle rend null et le bilan garde sa liste. `rehydraterEvenements` la relit à l'identique et refuse un
   * autre journal (taille ou signature). Fonctions pures, non branchées : tant que les outils lisent `bilan.events` directement, l'intégrateur décide. */
  const signatureListe = liste => {
    let h = 'liste';
    for (const e of liste) h = empreinte(h + empreinte(JSON.stringify(e)));
    return h;
  };
  function evenementsParReference(evenements, reference, options) {
    const plafond = Math.max(16, Math.floor(reference.length * ((options && options.partMaxAjouts) || 0.01)));
    const ajouts = [];
    let j = 0;
    for (let i = 0; i < evenements.length; i++) {
      if (j < reference.length && JSON.stringify(evenements[i]) === JSON.stringify(reference[j])) { j++; continue; }
      ajouts.push({ position: i, evenement: evenements[i] });
      if (ajouts.length > plafond) return null;
    }
    if (j !== reference.length) return null;
    return { reference: 'journal', total: evenements.length, longueurJournal: reference.length, signature: signatureListe(reference), ajouts };
  }
  function rehydraterEvenements(ref, reference) {
    if (!ref || reference.length !== ref.longueurJournal) throw Error('Ce n’est pas le journal de cet export (taille différente) : le bilan ne peut pas être reconstruit.');
    if (signatureListe(reference) !== ref.signature) throw Error('Ce n’est pas le journal de cet export (contenu différent) : le bilan ne peut pas être reconstruit.');
    const out = [], ajouts = ref.ajouts;
    let a = 0, j = 0;
    for (let i = 0; i < ref.total; i++) {
      if (a < ajouts.length && ajouts[a].position === i) out.push(ajouts[a++].evenement);
      else out.push(reference[j++]);
    }
    return out;
  }

  return { evenementsParReference, rehydraterEvenements, deltaMetadonnees, confirmerJalon, FORMAT, REF, SHAPES, UNE_FOIS, MODES, MODE_DEFAUT, exportMode, alleger, enteteMince, createInterner, foldRefs, unfoldRefs, compactCloud, expandCloud, compact, expand, misfiledHead };
});
