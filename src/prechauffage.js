/* CH-077 (D-305, piste 3 ; étude chantiers/CH-077/etude.md, acceptée par l'intégrateur le 08/11) — PRÉCHAUFFER LE CACHE DU NAVIGATEUR POUR LA COUPE SUIVANTE.
 * Module de la PAGE d'ESV (monde principal), branché par le patch chantiers/CH-077/adapter-page.patch. ÉTEINT par défaut (`lot.chargement.prechauffer`).
 *
 * Mesuré (« Vision 3 », 08/11, ÉTABLI) : le chargement des points par ESV fait 80 % du temps de capture ; pendant les attentes un téléchargement n'est
 * en cours que 37 % du temps, avec 1 à 2 nœuds en vol. Hypothèse (PROBABLE) : Potree charge étage par étage et chaque étage attend le précédent.
 * Idée : pendant le temps mort qui suit la capture d'un cut (calcul, pose, validation), demander au navigateur les nœuds que Potree chargera pour la
 * coupe suivante, pour qu'ils soient servis par le cache HTTP du navigateur quand Potree les demandera.
 *
 * Ce que fait le module, et rien d'autre :
 *  - CH-080 (D-309) : la coupe suivante vient de sa SOURCE (`SOURCES`) : cible donnée par le service worker avec la capture (relecture, passe des
 *    différés), sinon première ligne non validée de TOUTE la table de l'observateur (règle d'ESV, celle du lot) ; la fenêtre de ±10 lignes ci-dessous
 *    n'est plus que le dernier recours (adaptateur ou observateur sans CH-080). Rien n'est demandé si |saut| < `sautMin` (motif `saut-court`) ;
 *    l'événement `prechauffage` porte `saut` (entier signé, en coupes) et `source` ;
 *  - coupe suivante (CH-077, dernier recours) : la prochaine ligne NON VALIDÉE (ni « valid » : invalide ou passée) après le cut courant dans la table B1 que l'observateur tient déjà dans la page (« Load next non
 *    validated cut », le suivant d'ESV après une validation ; aucune requête) ; repère de la table → scène pris sur le cut courant (rails non encore
 *    posés), rigidité vérifiée (écart des deux rails < 5 cm), sinon rien ;
 *  - nœuds : ceux de l'arbre de Potree DÉJÀ CONNUS, ni chargés ni en cours, dont la boîte (repère monde, `matrixWorld`) coupe un cube de `rayonM`
 *    autour de chaque rail prédit, de niveau au plus le plus profond chargé autour du cut courant (et `profondeurMax`), du moins profond au plus profond
 *    (l'ordre de Potree), plafonnés (`noeudsMax`, `octetsMax`). Hiérarchie non lue : rien demandé (ni hiérarchie, ni données), compté (`frontiere`) ;
 *  - départ : à la fin de la capture (écart au ticket, accepté : c'est là qu'est le réseau libre), seulement si le compteur effectif de Potree vaut 0 ;
 *    rien n'est attendu par l'adaptateur (la pose ne dépend jamais du préchauffage) ;
 *  - demande : `fetch` GET à l'adresse que Potree construit lui-même (`node.url()` + extension du chargeur), même mode d'accréditation que son XHR,
 *    `cache:'default'`, `priority:'low'`, `enVolMax` à la fois ; corps lu (pour que le navigateur le garde) puis JETÉ. Aucun point n'entre dans la scène,
 *    rien n'est écrit dans Potree ni dans ESV ;
 *  - arrêt (`AbortController`) : premier chargement de Potree qui repart, changement de l'étiquette de coupe, nouvelle capture, nouvelle opération ;
 *  - identité : chaque opération porte {partie, coupe, prédite, op} ; la fin d'une demande d'une opération qui n'est plus courante ne compte rien et ne
 *    lance rien (règle 4.2 de fiches/ARCHITECTURE_CIBLE.md) ;
 *  - bilan à la capture suivante (`prechauffage-bilan`) : prédiction juste, nœuds demandés par Potree (XHR), couverts par le préchauffage, servis par le
 *    cache ; arrêt automatique pour la page après `coupesSansCache` coupes préchauffées, justes, sans un seul nœud servi par le cache (`cache-inutile`) ;
 *  - en-têtes : une fois par page, classe de la politique de cache (`prechauffage-entetes`) ; seuls Cache-Control, Expires, Last-Modified, Pragma et
 *    ETag sont lus, jamais leur valeur rapportée (nombre `maxAgeS` et booléens seulement).
 * ADRESSES : construites au moment de la demande, gardées dans la fermeture de l'opération, oubliées avec elle. Les clés de nœud (D-X-Y-Z) restent en
 * mémoire de la page pour le bilan ; aucun événement ne contient d'adresse ni de clé (essai tests/ch077-prechauffage.test.cjs qui lit tous les événements).
 * CH-081 (D-311, aval de l'intégrateur sur D-310 et D-311 ; étude chantiers/CH-081/etude.md) : zone `zone:'boite'` = la boîte de découpe d'ESV de la coupe
 * prédite (src/prechauffage-boite.js), jusqu'aux feuilles ; plusieurs coupes par passage (src/prechauffage-anticipation.js : `horizon`, `candidatsMax`,
 * source `changement-mode`) ; plafonds par CANDIDAT (`noeudsMax`, `octetsMax`, `hierarchiesMax`) et par LOT (`lotRequetesMax`, `lotOctetsMax`), repli à
 * un candidat au-delà de `repliInutiles` ; bilan `utiles` / `inutiles` (nœud préchauffé redemandé ou non par Potree avant d'expirer) ; événement
 * `prechauffage-vue` (caméra et réglages de Potree, lecture seule, au départ puis à chaque changement). Réglage absent : comportement de CH-080c.
 * Pur : tout ce qui touche la page (horloge, images, compteur, étiquette, fetch, observateur des ressources, table B1) est passé par `env`. */
/** @template T @param {unknown} root @param {() => T} factory */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else /** @type {{BananePrechauffage?:unknown}} */ (root).BananePrechauffage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  /* CH-080 (D-309) : `sautMin` — écart minimal, en coupes, entre la coupe courante et la suivante pour préchauffer. Clé absente : 1 (comportement de CH-077).
   * Réglage livré (src/settings.js) : 11, mesuré sur le lot du 09/11 : sous 11 coupes la sélection n'a trouvé aucun nœud à demander (447 cas sur 447) ;
   * au-delà, la zone de la coupe n'est pas chargée (chantiers/CH-080/etude.md). */
  const DEFAUT = Object.freeze({ actif: false, profondeurMax: null, noeudsMax: 24, octetsMax: 8 * 1048576, enVolMax: 2, rayonM: 1.5, apresNavigation: 'annuler', coupesSansCache: 5, sautMin: 1, hierarchie: false, hierarchiesMax: 8, zone: 'cube', horizon: 1, candidatsMax: 1 });
  const BORNES = { noeudsMax: [1, 200], octetsMax: [65536, 64 * 1048576], enVolMax: [1, 4], rayonM: [0.1, 10], coupesSansCache: [1, 100], profondeurMax: [0, 30], sautMin: [1, 100000], hierarchiesMax: [1, 24], horizon: [1, 3], candidatsMax: [1, 3] };
  /* CH-080 : d'où vient la coupe suivante (liste fermée). `liste-esv` : première ligne non validée après la coupe courante dans toute la table de
   * l'observateur (règle d'ESV « cut non validé suivant », celle du lot) ; `relu` (relecture), `passe-differes` : cible donnée par le service worker avec la
   * capture ; `b1-fenetre` : dernier recours, fenêtre de ±10 lignes (CH-077). */
  const SOURCES = Object.freeze(['liste-esv', 'relu', 'passe-differes', 'b1-fenetre', 'changement-mode']);   /* CH-081 : changement-mode */
  const SOURCES_SW = ['relu', 'passe-differes'];
  const VISITES_MAX = 20000, RIGIDITE_M = 0.05, VOISINS_MS = 400, OCTETS_PAR_POINT = 32, OCTETS_NOEUD = 256 * 1024;
  const EPT_DATA = /\/ept-data\/(\d+-\d+-\d+-\d+)(\.[a-z0-9]{1,8})$/i;
  const fini = v => typeof v === 'number' && Number.isFinite(v);
  /* CH-081 : modules de la page (globaux) ou de Node (essais). Absents : zone cube et une seule coupe, comme CH-080c. */
  const module_ = (g, f) => { try { if (globalThis[g]) return globalThis[g]; } catch { /* suivant */ } try { if (typeof module === 'object' && module.exports && typeof require === 'function') return require(f); } catch { /* absent */ } return null; };
  const Boite = module_('BananePrechauffageBoite', './prechauffage-boite.js'), Anticipation = module_('BananePrechauffageAnticipation', './prechauffage-anticipation.js');

  /** Réglage lu : null si éteint (seul `actif === true` allume) ; chaque valeur hors bornes reprend le défaut. */
  function reglage(r) {
    if (!r || typeof r !== 'object' || r.actif !== true) return null;
    const out = { ...DEFAUT, actif: true };
    for (const [k, [a, b]] of Object.entries(BORNES)) { const v = r[k]; if (fini(v) && v >= a && v <= b) out[k] = k === 'rayonM' ? v : Math.floor(v); }
    if (r.profondeurMax === null || r.profondeurMax === undefined) out.profondeurMax = null;
    out.apresNavigation = r.apresNavigation === 'finir' ? 'finir' : 'annuler';
    out.hierarchie = r.hierarchie === true;
    /* CH-081 : zone (liste fermée) ; plafonds du lot lus par src/prechauffage-anticipation.js (bornes et défauts là-bas). */
    out.zone = r.zone === 'boite' ? 'boite' : 'cube';
    out.lot = Object.freeze({ lotRequetesMax: r.lotRequetesMax, lotOctetsMax: r.lotOctetsMax, repliInutiles: r.repliInutiles, repliFenetre: r.repliFenetre });
    return Object.freeze(out);
  }

  /** Clé de nœud et extension lues dans le CHEMIN d'une ressource ept-data (jamais gardé : seule la clé sert, en mémoire). */
  function cleChemin(nom) {
    let chemin = ''; try { chemin = new URL(String(nom || ''), 'http://x.invalid/').pathname; } catch { chemin = String(nom || ''); }
    const m = EPT_DATA.exec(chemin); return m ? { cle: m[1], ext: m[2].toLowerCase() } : null;
  }

  /** Classe de la politique de cache d'une réponse ; `get(nom)` rend l'en-tête ou null. Cinq en-têtes lus, aucune valeur rendue. */
  function classerEntetes(get) {
    const lire = k => { try { const v = get(k); return typeof v === 'string' ? v : null; } catch { return null; } };
    const cc = (lire('Cache-Control') || '').toLowerCase(), pragma = /no-cache/i.test(lire('Pragma') || ''),
      expires = lire('Expires') !== null, lastModified = lire('Last-Modified') !== null, etag = lire('ETag') !== null;
    const m = /(?:^|[,\s])max-age\s*=\s*"?(\d+)/.exec(cc), maxAgeS = m ? Math.min(Number(m[1]), 1e9) : null;
    const classe = /no-store/.test(cc) ? 'no-store'
      : (/no-cache/.test(cc) || (!cc && pragma)) ? (etag || lastModified ? 'revalidation' : 'no-cache')
        : maxAgeS !== null ? (maxAgeS > 0 ? 'max-age' : (etag || lastModified ? 'revalidation' : 'no-cache'))
          : expires ? 'expires' : (etag || lastModified) ? 'heuristique' : 'aucun';
    return { classe, maxAgeS, etag, lastModified, expires, pragma };
  }

  const point = v => Array.isArray(v) && v.length === 3 && v.every(fini) ? v : null;
  /** Rails de la coupe suivante en repère scène (absolu, celui de `matrixWorld`), d'après la réponse B1. `rails` : positions scène relatives au repère
   * d'Ariane du cut courant, `origine` : ce repère. Rend {predite, left, right} ou {motif}. */
  /** CH-081 : décalage table → scène (O − T) tiré de la ligne du cut courant, ou null (mêmes refus que `centresSuivante`). */
  function decalDe(rep, coupe, rails, origine) {
    if (!rep || rep.ok !== true || !Array.isArray(rep.rows)) return null;
    const L = point(rails?.left), R = point(rails?.right), O = point(origine); if (!L || !R || !O) return null;
    const cur = rep.rows.find(r => r?.i === coupe), ec = Array.isArray(cur?.e) && cur.e.length === 6 && cur.e.every(fini) ? cur.e : null; if (!ec) return null;
    const Tl = [0, 1, 2].map(i => ec[i] - L[i]), Tr = [0, 1, 2].map(i => ec[3 + i] - R[i]);
    if (Math.hypot(...[0, 1, 2].map(i => Tl[i] - Tr[i])) > RIGIDITE_M) return null;
    return [0, 1, 2].map(i => O[i] - (Tl[i] + Tr[i]) / 2);
  }
  /** CH-081 : ligne `loin` d'une réponse de l'observateur (indice, statut, bords finis), ou null. */
  const ligneLoin = rep => { const l = rep?.ok === true ? rep.loin : null; return l && Number.isInteger(l.i) && l.i >= 0 && Array.isArray(l.e) && l.e.length === 6 && l.e.every(fini) ? l : null; };
  const railsDe = (l, D) => ({ left: [0, 1, 2].map(i => l.e[i] + D[i]), right: [0, 1, 2].map(i => l.e[3 + i] + D[i]) });
  function centresSuivante(rep, coupe, rails, origine, demande = null) {
    if (!rep || rep.ok !== true || !Array.isArray(rep.rows)) return { motif: typeof rep?.reason === 'string' && /^[a-z-]{1,24}$/.test(rep.reason) ? rep.reason : 'sans-table' };
    const L = point(rails?.left), R = point(rails?.right), O = point(origine); if (!L || !R || !O) return { motif: 'sans-rails' };
    const bords = r => Array.isArray(r?.e) && r.e.length === 6 && r.e.every(fini) ? r.e : null;
    const cur = rep.rows.find(r => r?.i === coupe), ec = bords(cur); if (!ec) return { motif: 'sans-ligne' };
    const Tl = [0, 1, 2].map(i => ec[i] - L[i]), Tr = [0, 1, 2].map(i => ec[3 + i] - R[i]);
    if (Math.hypot(...[0, 1, 2].map(i => Tl[i] - Tr[i])) > RIGIDITE_M) return { motif: 'repere' };
    const T = [0, 1, 2].map(i => (Tl[i] + Tr[i]) / 2);
    /* CH-080 : la ligne demandée à l'observateur (`loin` : la cible du service worker, ou la suivante non validée de toute la table) passe avant la
     * fenêtre ; une cible du service worker absente de la table ne retombe JAMAIS sur la fenêtre (ce ne serait plus sa coupe). */
    let suiv = null, source = 'b1-fenetre';
    const loin = rep.loin && Number.isInteger(rep.loin.i) && rep.loin.i >= 0 && bords(rep.loin) ? rep.loin : null;
    if (demande?.cible !== undefined) {
      if (!loin || loin.i !== demande.cible) return { motif: 'sans-cible' };
      suiv = loin; source = demande.source;
    } else if (demande?.suivante && rep.loin !== undefined) {
      if (!loin || loin.i <= coupe || loin.s === 'valid') return { motif: 'sans-suivante' };
      suiv = loin; source = 'liste-esv';
    } else {
      suiv = rep.rows.filter(r => Number.isInteger(r?.i) && r.i > coupe && r.s !== 'valid' && bords(r)).sort((a, b) => a.i - b.i)[0];
      if (!suiv) return { motif: 'sans-suivante' };
    }
    const e = suiv.e;
    return { predite: suiv.i, source, saut: suiv.i - coupe, left: [0, 1, 2].map(i => e[i] - T[i] + O[i]), right: [0, 1, 2].map(i => e[3 + i] - T[i] + O[i]) };
  }

  /* ------------------------------------------------ arbre de Potree (lecture seule) */
  const niveau = n => { for (const f of [() => n.level, () => n.key?.d, () => typeof n.getLevel === 'function' ? n.getLevel() : undefined]) { try { const v = f(); if (Number.isInteger(v) && v >= 0 && v <= 64) return v; } catch { /* suivant */ } } return null; };
  /* CH-080b : sur le vrai ESV (lots du 09/11, ÉTABLI par les comptes), aucun nœud non chargé n'avait de nom lu par `filename()` puis `key.name()` (la
   * première chaîne qui ne collait pas rendait null). Chaque source est désormais essayée, sans court-circuit : `filename()`, `key.name()`, `key.{d,x,y,z}`
   * entiers, puis le nom de Potree « r » + chiffres 0-7 (toPotreeName : un chiffre par niveau, bits x·4 + y·2 + z) décodé en D-X-Y-Z. */
  const D_X_Y_Z = /^\d+-\d+-\d+-\d+$/;
  function depuisNomPotree(v) {
    if (typeof v !== 'string' || !/^r[0-7]{0,30}$/.test(v)) return null;
    let x = 0, y = 0, z = 0; for (const ch of v.slice(1)) { const s = Number(ch); x = x * 2 + (s >> 2 & 1); y = y * 2 + (s >> 1 & 1); z = z * 2 + (s & 1); }
    return `${v.length - 1}-${x}-${y}-${z}`;
  }
  /* CH-080c : relevé de console d'ESV (09/11) : nœud commun de Potree (PointCloudCopcGeometryNode, géométrie EPT) : `key` = tableau [d, x, y, z], `name` « r… ». */
  const SOURCES_NOM = [n => n.filename(), n => n.key.name(), n => { const k = n.key; return [k.d, k.x, k.y, k.z].every(v => Number.isInteger(v) && v >= 0) ? `${k.d}-${k.x}-${k.y}-${k.z}` : null; },
    n => Array.isArray(n.key) && n.key.length === 4 && n.key.every(v => Number.isInteger(v) && v >= 0) ? n.key.join('-') : null,
    n => depuisNomPotree(n.filename()), n => depuisNomPotree(n.name)];
  /** CH-080c : nœud de la classe commune de Potree (≥ 1.8.2 : PointCloudCopcGeometryNode, pour EPT et COPC) : `nodeinfo` propre au nœud, `owner` = géométrie. */
  const commun = n => { try { return Object.prototype.hasOwnProperty.call(n, 'nodeinfo') && !!n.owner && typeof n.owner === 'object'; } catch { return false; } };
  /** CH-080c : géométrie EPT laszip de la classe commune : `${base}/ept-data/<clé>.laz` (EptLaszipLoader), `${base}/ept-hierarchy/<clé>.json`
   * (loadHierarchyPage). Rien d'autre (COPC, binaire, zstandard, base avec « ? ») : null. */
  function baseCommune(n) {
    try { const o = n.owner; return o && o.type === 'ept' && o.ept?.dataType === 'laszip' && typeof o.base === 'string' && o.base.length && !o.base.includes('?') ? o.base : null; } catch { return null; }
  }
  const nomNoeud = n => { for (const f of SOURCES_NOM) { try { const v = f(n); if (typeof v === 'string' && D_X_Y_Z.test(v)) return v; } catch { /* source suivante */ } } return null; };
  /** CH-080b : forme d'un nœud de Potree, en bits (jamais une valeur) : 1 filename(), 2 filename D-X-Y-Z, 4 key entière, 8 key.name() D-X-Y-Z, 16 name « r »,
   * 32 url(), 64 url() finit par le nom D-X-Y-Z, 128 ept.url, 256 numPoints −1, 512 url() contient « ? », 1024 url() contient « ept-data/ » ;
   * CH-080c : 2048 owner.base, 4096 key tableau, 8192 nœud commun (nodeinfo, owner), 16384 géométrie EPT laszip à adresse sûre. */
  function formeNoeud(n) {
    const t = f => { try { return !!f(); } catch { return false; } }, D = v => typeof v === 'string' && D_X_Y_Z.test(v), nom = nomNoeud(n);
    const u = (() => { try { return typeof n.url === 'function' ? n.url() : null; } catch { return null; } })(), us = typeof u === 'string';
    return (t(() => typeof n.filename === 'function') ? 1 : 0) | (t(() => D(n.filename())) ? 2 : 0) | (t(() => [n.key.d, n.key.x, n.key.y, n.key.z].every(Number.isInteger)) ? 4 : 0)
      | (t(() => D(n.key.name())) ? 8 : 0) | (t(() => /^r[0-7]*$/.test(n.name)) ? 16 : 0) | (typeof n.url === 'function' ? 32 : 0) | (us && nom && u.endsWith(nom) ? 64 : 0)
      | (t(() => typeof n.ept.url === 'string') ? 128 : 0) | (n.numPoints === -1 ? 256 : 0) | (us && u.includes('?') ? 512 : 0) | (us && u.includes('ept-data/') ? 1024 : 0)
      | (t(() => typeof n.owner.base === 'string') ? 2048 : 0) | (t(() => Array.isArray(n.key)) ? 4096 : 0) | (commun(n) ? 8192 : 0) | (baseCommune(n) ? 16384 : 0);
  }
  /** CH-080b : préfixe SÛR des adresses de données (celui que Potree construit : `<ept.url>ept-data/`), ou null. Sûr = `ept.url` du nœud ; sinon `url()` sans
   * « ? », qui contient « ept-data/ » et finit par le nom D-X-Y-Z ; sinon celui du plus proche ancêtre (hérité) qui finit par « ept-data/ ». Aucun autre. */
  function prefixeDonnees(n, nom, herite) {
    try { const b = n.ept?.url; if (typeof b === 'string' && b.length && !b.includes('?')) return b + 'ept-data/'; } catch { /* suivant */ }
    const bc = baseCommune(n); if (bc) return bc + '/ept-data/';   /* CH-080c : construction d'EptLaszipLoader */
    try { const u = typeof n.url === 'function' ? n.url() : null; if (nom && typeof u === 'string' && !u.includes('?') && u.endsWith('ept-data/' + nom)) return u.slice(0, -nom.length); } catch { /* suivant */ }
    return typeof herite === 'string' && herite.endsWith('ept-data/') && !herite.includes('?') ? herite : null;
  }
  const enfants = n => { const c = n?.children; if (!c) return []; return (Array.isArray(c) ? c : Object.values(c)).filter(Boolean); };
  function boiteMonde(n, M) {
    const b = n?.boundingBox; if (!b?.min || !b?.max) return null;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const p = [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
    }
    return lo.every(fini) && hi.every(fini) ? [lo, hi] : null;
  }
  const coupe = (bm, centres, r) => centres.some(c => [0, 1, 2].every(i => bm[0][i] <= c[i] + r && bm[1][i] >= c[i] - r));
  const distance = (bm, centres) => Math.min(...centres.map(c => Math.hypot(...[0, 1, 2].map(i => Math.max(bm[0][i] - c[i], 0, c[i] - bm[1][i])))));
  /** CH-081 : zone = { type, coupe(bm), distance(bm) } ; le cube de CH-077 (rayon autour de chaque rail) ou la boîte de découpe d'ESV. */
  const zoneCube = (centres, r) => ({ type: 'cube', coupe: bm => coupe(bm, centres, r), distance: bm => distance(bm, centres) });
  function zoneBoite(rails, dims) { const z = Boite ? Boite.zone(point(rails?.left), point(rails?.right), dims) : null; return z ? { type: 'boite', coupe: z.coupe, distance: z.distance } : null; }
  /** Parcours borné de l'arbre : `visite(noeud, niveau, boîte monde, nuage, parent)` pour chaque nœud qui coupe la zone ; on ne descend que dans ceux-là. */
  function parcourir(pointclouds, Z, visite) {
    let vus = 0;
    for (const pc of pointclouds || []) {
      const racine = pc?.pcoGeometry?.root, M = pc?.matrixWorld?.elements; if (!racine || !M || M.length !== 16) continue;
      const pile = [[racine, null]];
      while (pile.length && vus < VISITES_MAX) {
        const [n, parent] = pile.pop(); vus++; const bm = boiteMonde(n, M); if (!bm || !Z.coupe(bm)) continue;
        if (visite(n, niveau(n), bm, pc, parent) !== false) for (const c of enfants(n)) pile.push([c, n]);
      }
    }
    return vus;
  }
  /** Niveau le plus profond déjà chargé autour du cut courant (null si aucun). */
  function niveauLocal(pointclouds, rails, r) {
    const c = [point(rails?.left), point(rails?.right)].filter(Boolean); if (!c.length) return null;
    let max = null; parcourir(pointclouds, zoneCube(c, r), (n, d) => { if (n.loaded === true && d !== null && (max === null || d > max)) max = d; });
    return max;
  }
  /** Nœuds à demander pour la coupe suivante, et comptes : intersectants (connus dans la zone, niveau borné), chargés, en cours, frontière. */
  function candidats(pointclouds, rails, { niveauMax = null, rayonM = DEFAUT.rayonM, zone = null } = {}) {
    const c = [point(rails?.left), point(rails?.right)].filter(Boolean), out = { intersectants: 0, charges: 0, enCours: 0, frontiere: 0, candidats: [], frontieres: [], sansNom: 0, sansAdresse: 0, formeNoeud: null };
    if (!c.length) return out;
    const Z = zone || zoneCube(c, rayonM);
    const prefixes = new Map();   /* nœud → préfixe sûr (hérité des ancêtres), le temps du parcours */
    parcourir(pointclouds, Z, (n, d, bm, pc, parent) => {
      const nom = nomNoeud(n), prefixe = prefixeDonnees(n, nom, parent ? prefixes.get(parent) : null); if (prefixe) prefixes.set(n, prefixe);
      if (d === null || (niveauMax !== null && d > niveauMax)) return false;
      out.intersectants++;
      if (n.loaded === true) out.charges++; else if (n.loading === true) out.enCours++;
      else {
        if (out.formeNoeud === null) out.formeNoeud = formeNoeud(n);   /* CH-080b : forme du premier nœud non chargé de la zone */
        /* CH-080c : nœud commun : données seulement si `nodeinfo.pointCount` > 0 (EptLaszipLoader ne charge rien à 0 ; sans nodeinfo, page non lue). */
        const nc = commun(n), pts = nc ? n.nodeinfo?.pointCount : n.numPoints;
        if (!nom) { out.intersectants--; out.sansNom++; }
        else if (nc && !(fini(pts) && pts > 0)) { /* rien à demander pour ce nœud */ }
        else if (!prefixe) out.sansAdresse++;   /* CH-080b : aucune adresse sûre : rien n'est demandé, l'événement le dit */
        else out.candidats.push({ noeud: n, pc, cle: nom, prefixe, ext: nc ? '.laz' : null, niveau: d, points: fini(pts) && pts > 0 ? pts : null, distance: Z.distance(bm) });
      }
      /* Frontière : sous-hiérarchie non lue, enfants inconnus. CH-080c : nœud commun, `nodeinfo` absent (numPoints vaut −1 jusqu'au chargement). */
      const front = commun(n) ? n.nodeinfo === undefined && !enfants(n).length : n.numPoints === -1 && !enfants(n).length;
      if (front || (!commun(n) && (n.numPoints === -1 || (n.hasChildren === true && !enfants(n).length)))) out.frontiere++;
      if (front && nom && prefixe) { const f = frontiereDe(n, pc, d, bm, Z, nom, prefixe, commun(n) ? '.laz' : null); if (f) out.frontieres.push(f); }
      return true;
    });
    out.candidats.sort((a, b) => a.niveau - b.niveau || a.distance - b.distance);
    out.frontieres.sort((a, b) => a.niveau - b.niveau || a.distance - b.distance);
    return out;
  }
  /** Adresse que Potree construit pour ce nœud : `<ept.url>ept-data/<clé>` + extension de son chargeur (ou celle apprise de ses propres requêtes). Jamais
   * gardée. CH-080b : seulement à partir d'un préfixe SÛR (`prefixeDonnees`) ; sans lui, null et rien n'est demandé. */
  function adresse(c, extApprise) {
    try {
      const l = c.pc?.pcoGeometry?.loader;
      /* CH-080c : extension imposée par le chargeur commun (`.laz`) ; celle apprise des requêtes de Potree doit concorder, sinon rien. */
      const ext = typeof l?.extension === 'function' ? l.extension() : (extApprise ?? c.ext ?? null);
      if (typeof ext !== 'string' || !/^\.[a-z0-9]{1,8}$/i.test(ext) || (c.ext && ext !== c.ext)) return null;
      return typeof c.prefixe === 'string' && c.prefixe.endsWith('ept-data/') && D_X_Y_Z.test(c.cle) ? c.prefixe + c.cle + ext : null;
    } catch { return null; }
  }

  /* ------------------------------------------------ CH-080 : hiérarchie EPT de la zone lointaine (lecture seule)
   * Potree 1.8 (PointCloudEptGeometryNode.loadHierarchy) lit `<ept.url>ept-hierarchy/<clé>.json` quand il charge un nœud dont `numPoints` vaut −1 : un objet
   * clé → nombre de points des descendants, −1 pour une sous-hiérarchie dans un autre fichier. Le préchauffage demande CE fichier, à la même adresse,
   * le lit dans la fermeture de l'opération, en DÉDUIT les clés de la zone (arithmétique des clés D-X-Y-Z et boîte de la frontière, découpée en deux à
   * chaque niveau), puis demande leurs données. Rien n'est greffé à l'arbre de Potree ; les clés et le fichier sont oubliés avec l'opération. */
  const CLES_MAX = 20000;
  const cleDe = s => { const m = /^(\d+)-(\d+)-(\d+)-(\d+)$/.exec(String(s)); return m ? m.slice(1).map(Number) : null; };
  /** Frontière : clé, boîte (repère du nuage), préfixes des adresses de données et de hiérarchie, ou null. */
  function frontiereDe(n, pc, niv, bm, Z, nom, prefixe, ext = null) {
    try {
      const k = cleDe(nom), b = n.boundingBox; if (!k || niv === null || !b?.min || !b?.max || typeof prefixe !== 'string' || !prefixe.endsWith('ept-data/')) return null;
      /* CH-080b : même préfixe sûr que les données (`<ept.url>ept-data/` → `<ept.url>ept-hierarchy/`, la construction de loadHierarchy). */
      const prefixeHier = prefixe.slice(0, -'ept-data/'.length) + 'ept-hierarchy/';
      return { cle: nom, k, niveau: niv, boite: { min: { x: b.min.x, y: b.min.y, z: b.min.z }, max: { x: b.max.x, y: b.max.y, z: b.max.z } }, pc, prefixe, prefixeHier, ext, distance: Z.distance(bm) };
    } catch { return null; }
  }
  /** Clés d'un fichier de hiérarchie qui coupent la zone (niveau ≤ niveauMax) ; sous-hiérarchies de la zone rendues à part. */
  function deduire(hier, f, Z, niveauMax) {
    const out = { noeuds: [], sous: [] }; if (!hier || typeof hier !== 'object' || Array.isArray(hier)) return out;
    const M = f.pc?.matrixWorld?.elements; if (!M || M.length !== 16) return out;
    const b = f.boite, t = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z], [d0, x0, y0, z0] = f.k;
    let vus = 0;
    for (const cle of Object.keys(hier)) {
      if (++vus > CLES_MAX) break;
      const k = cleDe(cle), v = hier[cle]; if (!k || !(Number.isInteger(v) && (v > 0 || v === -1))) continue;
      const r0 = k[0] - d0; if (r0 < 0 || r0 > 30 || (r0 === 0 && !(f.ext && v > 0 && cle === f.cle)) || (niveauMax !== null && k[0] > niveauMax)) continue;
      /* CH-080c : nœud commun : la page donne aussi le nombre de points de la frontière elle-même (Potree le charge ensuite) : ses données sont demandées. */
      const p = 2 ** r0, ix = k[1] - x0 * p, iy = k[2] - y0 * p, iz = k[3] - z0 * p; if (ix < 0 || iy < 0 || iz < 0 || ix >= p || iy >= p || iz >= p) continue;
      const s = t.map(v2 => v2 / p), boite = { min: { x: b.min.x + ix * s[0], y: b.min.y + iy * s[1], z: b.min.z + iz * s[2] }, max: { x: b.min.x + (ix + 1) * s[0], y: b.min.y + (iy + 1) * s[1], z: b.min.z + (iz + 1) * s[2] } };
      const bm = boiteMonde({ boundingBox: boite }, M); if (!bm || !Z.coupe(bm)) continue;
      const dist = Z.distance(bm);
      if (v > 0 || !f.ext) out.noeuds.push({ cle, niveau: k[0], points: v > 0 ? v : null, distance: dist, pc: f.pc, prefixe: f.prefixe, ext: f.ext });   /* CH-080c : commun, −1 = page sans données connues */
      if (v === -1 && r0 > 0) out.sous.push({ cle, k, niveau: k[0], boite, pc: f.pc, prefixe: f.prefixe, prefixeHier: f.prefixeHier, ext: f.ext, distance: dist });
    }
    return out;
  }

  /* ------------------------------------------------ préchauffeur */
  function creer(env) {
    const R = reglage(env?.reglage);
    const propres = new Map();   /* CH-080c */
    /* CH-081 : budget du LOT (vie de la page) et repli ; nœuds préchauffés en attente d'être redemandés par Potree (clé → arrivées restantes) ;
     * signature du dernier relevé de la vue. Clés en mémoire de la page seulement, jamais postées. */
    const budget = Anticipation && R ? Anticipation.creerBudget(R.lot) : null, attente = new Map();
    let utiles = 0, vueSig = null, dernierAge = null;
    let actif = !!R, op = 0, courant = null, suivi = null, sansCache = 0, entetesFaits = false, extApprise = null, octetsParPoint = null, octetsTot = 0, pointsTot = 0;
    const poster = e => { try { env.poster(e); } catch { /* relevé seulement */ } };
    const maintenant = () => { try { const t = env.maintenant(); return fini(t) ? t : 0; } catch { return 0; } };
    const chargements = () => { try { const n = env.chargements(); return fini(n) ? n : null; } catch { return null; } };
    const etiquette = () => { try { const l = env.etiquette(); return l && Number.isInteger(l.cut) ? l : null; } catch { return null; } };

    /** Ressources vues par l'observateur de la page : seules les requêtes ept-data de Potree (pas les nôtres) comptent au bilan.
     * CH-080c : le Potree d'ESV charge lui aussi par `fetch` (EptLaszipLoader) : l'entrée d'une de NOS demandes abouties est reconnue par sa clé
     * (`propres` : clé → demandes abouties pas encore vues), une fois ; toutes les autres sont celles de Potree. Clés en mémoire de la page seulement. */
    function ressources(entries) {
      for (const e of entries || []) {
        const k = cleChemin(e?.name); if (!k) continue; if (!extApprise) extApprise = k.ext;
        const p = e.initiatorType === 'fetch' ? propres.get(k.cle) : 0; if (p) { if (p > 1) propres.set(k.cle, p - 1); else propres.delete(k.cle); continue; }
        if (attente.has(k.cle)) { attente.delete(k.cle); utiles++; }   /* CH-081 : redemandé par Potree, donc utile */
        if (!suivi) continue;
        const tz = Number(e.transferSize), db = Number(e.decodedBodySize), cache = tz === 0 && db > 0;
        suivi.potree++; if (cache) suivi.cacheTotal++;
        if (suivi.cles.has(k.cle)) { suivi.couverts++; if (cache) suivi.servisCache++; }
      }
    }
    function bilan() {
      try { ressources(typeof env.relever === 'function' ? env.relever() : []); } catch { /* rien */ }
      /* CH-081 : une arrivée de plus : chaque nœud préchauffé non redemandé perd une arrivée ; à 0, il est inutile. */
      let inutiles = 0; const la = etiquette(), ici = la ? la.part + ':' + la.cut : null;
      if (ici !== null && ici !== dernierAge) { dernierAge = ici; for (const [k, n] of attente) { if (n <= 1) { attente.delete(k); inutiles++; } else attente.set(k, n - 1); } }   /* une seconde capture du même cut ne compte pas pour une arrivée */
      const u = utiles; utiles = 0; if (budget && u + inutiles > 0) budget.bilanter(u + inutiles, u);
      const s = suivi; suivi = null; if (!s) return null;
      const l = etiquette(), juste = !!l && l.part === s.partie && (l.cut === s.predite || !!s.predites?.has(l.cut));
      poster({ kind: 'prechauffage-bilan', coupe: l?.cut ?? null, predite: s.predite, op: s.op, juste, demandes: s.demandes ?? s.cles.size, potree: s.potree, couverts: s.couverts, servisCache: s.servisCache, cacheTotal: s.cacheTotal, utiles: u, inutiles });
      if (juste && (s.demandes ?? s.cles.size) > 0 && s.couverts > 0) { sansCache = s.servisCache > 0 ? 0 : sansCache + 1; if (actif && sansCache >= R.coupesSansCache) { actif = false; return 'cache-inutile'; } }
      return null;
    }
    function annuler(motif) {
      const c = courant; if (!c || c.fini) return;
      c.annule = true; c.motif = c.motif || motif; c.arret = true;
      for (const ctl of c.controleurs) { try { ctl.abort(); } catch { /* déjà fini */ } }
      c.controleurs.clear(); c.reveil?.();
    }
    const resume = (c, extra = {}) => ({ kind: 'prechauffage', coupe: c.coupe, predite: c.predite ?? null, op: c.op, saut: c.saut ?? null, source: c.source ?? null, niveauMax: c.niveauMax ?? null,
      intersectants: c.sel?.intersectants ?? 0, charges: c.sel?.charges ?? 0, enCours: c.sel?.enCours ?? 0, frontiere: c.sel?.frontiere ?? 0, candidats: c.sel?.candidats.length ?? 0,
      noeuds: c.noeuds, termines: c.termines, octets: c.octets, hierarchies: c.hierarchies, deduits: c.deduits, sansNom: c.sel?.sansNom ?? 0, sansAdresse: (c.sel?.sansAdresse ?? 0) + (c.sansAdresse ?? 0), formeNoeud: c.sel?.formeNoeud ?? null, zone: c.zone ?? null, cibles: c.nCibles ?? null, calibree: c.calibree ?? null, dureeMs: Math.round(maintenant() - c.t0), annule: c.annule, motif: c.motif || 'fini', ...extra });
    function terminer(c) {
      if (c.fini) return c.resultat; c.fini = true;
      const couv = c.couvertes && c.couvertes.size ? new Set([...c.cles, ...c.couvertes]) : c.cles;   /* CH-081 : clés préchauffées par une opération d'avant */
      if (c.op === op && c.predite !== undefined && couv.size) suivi = { op: c.op, partie: c.partie, predite: c.predite, predites: c.predites || null, cles: couv, demandes: c.cles.size, potree: 0, couverts: 0, servisCache: 0, cacheTotal: 0 };
      const r = resume(c); const { kind, ...sans } = r; c.resultat = sans; poster(r); if (courant === c) courant = null; return sans;
    }

    async function apresCapture(ctx) {
      if (courant) annuler('remplace');
      const coupure = bilan();
      const c = { op: ++op, partie: ctx?.partie ?? null, coupe: Number.isInteger(ctx?.coupe) ? ctx.coupe : null, t0: maintenant(), controleurs: new Set(), cles: new Set(),
        noeuds: 0, termines: 0, octets: 0, hierarchies: 0, deduits: 0, enVolEst: 0, enVol: 0, annule: false, arret: false, motif: null, fini: false };
      if (coupure) { c.motif = coupure; courant = c; return terminer(c); }
      if (!actif) return { motif: 'eteint', noeuds: 0, octets: 0, annule: false };
      courant = c;
      /* CH-081 : caméra et réglages de Potree (lecture seule, entiers et liste fermée) : au premier passage, puis à chaque changement. */
      if (Anticipation && typeof ctx?.vue === 'function') {
        try { const r = Anticipation.releveVue(ctx.vue() || {}), sig = Anticipation.signatureVue(r); if (sig !== vueSig) { vueSig = sig; poster({ kind: 'prechauffage-vue', ...r }); } } catch { /* relevé seulement */ }
      }
      /* CH-080b : la prédiction passe AVANT le contrôle « réseau occupé » (mémoire de la page, aucune requête) : l'événement porte alors saut et source. */
      /* CH-080 : la coupe suivante est demandée à sa source. Cible du service worker (relecture, passe des différés) : acceptée seulement si elle porte
       * l'identité de CETTE capture (partie, coupe) ; sinon périmée, rien n'est demandé (règle 4.2). Sans cible : la suivante non validée de la liste. */
      const h = ctx?.suivante;
      let demande = { suivante: true };
      if (h !== undefined && h !== null) {
        if (!h || typeof h !== 'object' || !SOURCES_SW.includes(h.source) || !Number.isInteger(h.cut) || h.cut < 0 || h.part !== c.partie || h.de !== c.coupe) { c.motif = 'indice-perime'; return terminer(c); }
        demande = { cible: h.cut, source: h.source };
      }
      let rep = null;
      try { rep = await Promise.race([Promise.resolve(env.voisins(c.coupe, { left: ctx.rails.left.map((v, i) => v + ctx.origine[i]), right: ctx.rails.right.map((v, i) => v + ctx.origine[i]) }, demande.cible !== undefined ? { cible: demande.cible } : { suivante: true })),
        new Promise(r => { try { setTimeout(() => r({ ok: false, reason: 'page-sans-reponse' }), VOISINS_MS); } catch { r(null); } })]); } catch { rep = null; }
      if (c.arret) return terminer(c);
      const cible = centresSuivante(rep, c.coupe, ctx.rails, ctx.origine, demande);
      const courants = { left: ctx.rails.left.map((v, i) => v + ctx.origine[i]), right: ctx.rails.right.map((v, i) => v + ctx.origine[i]) };
      /* CH-081 : plusieurs coupes par passage (horizon, changement de mode) seulement si le module d'anticipation est là et le réglage le demande. */
      const multi = !!Anticipation && (R.horizon > 1 || R.candidatsMax > 1), D = multi ? decalDe(rep, c.coupe, ctx.rails, ctx.origine) : null;
      const demander = async (cut, monde, quoi) => { try { return await Promise.race([Promise.resolve(env.voisins(cut, monde, quoi)), new Promise(r => { try { setTimeout(() => r(null), VOISINS_MS); } catch { r(null); } })]); } catch { return null; } };
      const modes = [];
      if (multi && D && demande.suivante && cible.motif === 'sans-suivante') {
        /* Fin de la liste du lot : la passe des différés part de la première ligne non validée de TOUTE la table (règle de la passe). */
        const l = ligneLoin(await demander(c.coupe, courants, { premiere: true })); if (c.arret) return terminer(c);
        if (l && l.i !== c.coupe && l.s !== 'valid') modes.push({ i: l.i, source: 'changement-mode', rails: railsDe(l, D) });
      }
      if (!cible.left && !modes.length) { c.motif = cible.motif; return terminer(c); }
      const suite = cible.left ? [{ i: cible.predite, source: cible.source, rails: { left: cible.left, right: cible.right } }] : [];
      if (multi && D && cible.left && R.horizon >= 2) {
        /* k+2 : la suivante de k+1 par la même règle (liste d'ESV) ; ou celle que le service worker joint (`apres`, relecture et passe). */
        const ap = h && Number.isInteger(h.apres) && h.apres >= 0 ? h.apres : null;
        const r2 = demande.suivante ? await demander(cible.predite, { left: cible.left.map((v, i) => v - D[i]), right: cible.right.map((v, i) => v - D[i]) }, { suivante: true })
          : ap !== null ? await demander(c.coupe, courants, { cible: ap }) : null;
        if (c.arret) return terminer(c);
        const l = ligneLoin(r2);
        if (l && (demande.suivante ? l.i > cible.predite && l.s !== 'valid' : l.i === ap)) suite.push({ i: l.i, source: cible.source, rails: railsDe(l, D) });
      }
      if (cible.left) { c.predite = cible.predite; c.source = cible.source; c.saut = cible.saut; }
      else { c.predite = modes[0].i; c.source = 'changement-mode'; c.saut = modes[0].i - c.coupe; }
      c.predites = new Set([c.predite, ...modes.map(m => m.i)]);
      const liste = multi ? Anticipation.cibles({ coupe: c.coupe, suite, modes, horizon: R.horizon, candidatsMax: budget ? budget.candidatsMax(R.candidatsMax) : 1, sautMin: R.sautMin }).map(x => ({ ...x.ligne, rang: x.rang }))
        : Math.abs(cible.saut) >= R.sautMin ? [{ ...suite[0], rang: 1 }] : [];
      c.nCibles = liste.length;
      /* CH-080 : coupe proche (|saut| < sautMin) : ses nœuds sont déjà chargés (mesure du 09/11), rien n'est demandé. */
      if (!liste.length) { c.motif = 'saut-court'; return terminer(c); }
      if (chargements() !== 0) { c.motif = 'reseau-occupe'; return terminer(c); }
      /* CH-081 : zone. Boîte : dimensions lues sur la boîte de découpe de Potree pour la coupe COURANTE si elle est centrée et alignée (lecture seule), sinon
       * celles mesurées ; jusqu'aux feuilles (Potree en orthographique n'a pas de critère de taille). Cube : CH-077, niveau borné au plus profond chargé. */
      let dims = null;
      if (R.zone === 'boite' && Boite) {
        try { const el = ctx.pointclouds?.[0]?.material?.clipBoxes?.[0]?.box?.matrixWorld?.elements; dims = el ? Boite.calibrer(Array.from(el), courants.left, courants.right) : null; } catch { dims = null; }
        c.calibree = !!dims;
      }
      const boite = R.zone === 'boite' && !!Boite;
      c.zone = boite ? 'boite' : 'cube';
      let nm = boite ? null : niveauLocal(ctx.pointclouds, courants, R.rayonM);
      if (R.profondeurMax !== null) nm = nm === null ? R.profondeurMax : Math.min(nm, R.profondeurMax);
      c.niveauMax = nm;
      const plans = [];
      const agr = { intersectants: 0, charges: 0, enCours: 0, frontiere: 0, candidats: [], frontieres: [], sansNom: 0, sansAdresse: 0, formeNoeud: null };
      for (const t of liste) {
        const Z = (boite ? zoneBoite(t.rails, dims) : null) || zoneCube([t.rails.left, t.rails.right], R.rayonM);
        const sel = candidats(ctx.pointclouds, t.rails, { niveauMax: nm, rayonM: R.rayonM, zone: Z });
        for (const k of ['intersectants', 'charges', 'enCours', 'frontiere', 'sansNom', 'sansAdresse']) agr[k] += sel[k];
        agr.candidats.push(...sel.candidats); if (agr.formeNoeud === null) agr.formeNoeud = sel.formeNoeud;
        plans.push({ t, Z, sel });
      }
      c.sel = agr;
      const lireHier = R.hierarchie && plans.some(x => x.sel.frontieres.length > 0);
      if (!agr.candidats.length && !lireHier) { c.motif = agr.sansAdresse ? 'sans-adresse' : 'aucun-noeud'; return terminer(c); }
      const depart = etiquette();
      /* Veille, une image sur deux au plus : premier chargement de Potree, étiquette de coupe changée. */
      (async () => {
        while (!c.fini && !c.arret) {
          await new Promise(r => { c.reveil = r; Promise.resolve(env.image()).then(r, r); }); c.reveil = null;
          if (c.fini || c.arret) break;
          const l = etiquette(), n = chargements();
          if (!l || !depart || l.part !== depart.part || l.cut !== depart.cut) {
            if (R.apresNavigation === 'finir' && l && l.part === c.partie && c.predites.has(l.cut)) { c.navigue = true; c.motif = c.motif || 'navigation'; }
            else { annuler('coupe'); break; }
          }
          if (!c.navigue && (n === null || n > 0)) { annuler('chargement'); break; }
        }
      })();
      c.couvertes = new Set();
      const vivant = () => !c.arret && !c.fini && courant === c && !c.navigue;
      const plafondLot = (rq, oc) => { if (!budget || budget.autorise(rq, oc)) return false; c.motif = c.motif || 'plafond-lot'; c.arret = true; return true; };
      /* Une coupe après l'autre, dans l'ordre des cibles ; plafonds `noeudsMax`, `octetsMax`, `hierarchiesMax` PAR CIBLE, plafonds du lot en plus. */
      for (const { t, Z, sel } of plans) {
        if (!vivant()) break;
        const o0 = c.octets; let hT = 0;
        /* CH-080 : fichiers de hiérarchie des frontières de la zone, par tours (`enVolMax` à la fois), du moins profond au plus profond ; ils comptent dans
         * `noeudsMax` et `octetsMax` ; leurs sous-hiérarchies de la zone sont lues au tour suivant ; au plus `hierarchiesMax` fichiers. */
        const deduits = [];
        if (R.hierarchie && sel.frontieres.length) {
          const pile = sel.frontieres.slice(), vues = new Set(), maxH = Math.min(R.hierarchiesMax, R.noeudsMax - 1);
          while (pile.length && hT < maxH && vivant()) {
            const lot = pile.splice(0, Math.min(R.enVolMax, maxH - hT)).filter(f => !vues.has(f.cle));
            await Promise.all(lot.map(async f => {
              vues.add(f.cle); if (c.octets - o0 >= R.octetsMax) { c.motif = c.motif || 'plafond-octets'; return; }
              if (plafondLot(1, 0)) return;
              budget?.compter(1, 0);   /* réservée au départ : deux demandes en vol ne passent pas ensemble sous le plafond */
              const ctl = new env.AbortController(); c.controleurs.add(ctl); c.hierarchies++; hT++;
              try {
                const r = await env.fetch(f.prefixeHier + f.cle + '.json', { method: 'GET', cache: 'default', credentials: 'same-origin', mode: 'cors', priority: 'low', signal: ctl.signal });
                if (courant !== c || c.arret) return;
                const buf = r?.ok ? await r.arrayBuffer() : null; if (!buf || courant !== c || c.arret) return;
                c.octets += buf.byteLength; budget?.compter(0, buf.byteLength); if (buf.byteLength > R.octetsMax) return;
                let hier = null; try { hier = JSON.parse(new TextDecoder().decode(buf)); } catch { hier = null; }
                const d = deduire(hier, f, Z, nm); deduits.push(...d.noeuds); pile.push(...d.sous);
              } catch { /* annulée ou en échec : rien n'est déduit */ } finally { c.controleurs.delete(ctl); }
            }));
            pile.sort((a, b) => a.niveau - b.niveau || a.distance - b.distance);
          }
          c.deduits += deduits.length;
          if (c.arret || c.fini || courant !== c) break;
        }
        /* CH-081 : un nœud déjà préchauffé (opération d'avant, en attente d'être redemandé) ou déjà demandé dans cette opération n'est pas redemandé. */
        const vusIci = new Set();
        const tous = [...sel.candidats, ...deduits].filter(x => { if (vusIci.has(x.cle)) return false; vusIci.add(x.cle); if (c.cles.has(x.cle)) { if (attente.has(x.cle)) attente.set(x.cle, Math.max(attente.get(x.cle), t.rang)); return false; } if (attente.has(x.cle)) { c.couvertes.add(x.cle); attente.set(x.cle, Math.max(attente.get(x.cle), t.rang)); return false; } return true; })
          .sort((a, b) => a.niveau - b.niveau || a.distance - b.distance);
        const place = Math.max(0, R.noeudsMax - hT), file = tous.slice(0, place);
        if (tous.length > place) c.resteNoeuds = true;
        if (!file.length) continue;
        const estime = x => x.points !== null ? x.points * (octetsParPoint ?? OCTETS_PAR_POINT) : (octetsTot && pointsTot ? octetsTot / Math.max(1, c.termines) : OCTETS_NOEUD);
        let i = 0;
        const travailleur = async () => {
          while (i < file.length) {
            if (c.arret || c.fini || courant !== c || c.navigue) return;
            const x = file[i], e = estime(x);
            if ((c.octets - o0) + c.enVolEst + e > R.octetsMax) { c.motif = c.motif || 'plafond-octets'; return; }
            if (plafondLot(1, e)) return;
            i++;
            const url = adresse(x, extApprise); if (!url) { c.motif = c.motif || 'sans-adresse'; c.sansAdresse = (c.sansAdresse || 0) + 1; continue; }
            budget?.compter(1, 0);   /* réservée au départ (deux en vol) ; les octets sont comptés à l'arrivée */
            const ctl = new env.AbortController(); c.controleurs.add(ctl); c.noeuds++; c.cles.add(x.cle); c.enVolEst += e;
            try {
              const r = await env.fetch(url, { method: 'GET', cache: 'default', credentials: 'same-origin', mode: 'cors', priority: 'low', signal: ctl.signal });
              if (courant !== c || c.arret && !c.navigue) { try { ctl.abort(); } catch { /* fini */ } continue; }
              if (!entetesFaits && r?.headers && typeof r.headers.get === 'function') { entetesFaits = true; poster({ kind: 'prechauffage-entetes', ...classerEntetes(k => r.headers.get(k)), statut: Number.isInteger(r.status) ? r.status : null }); }
              const buf = r?.ok ? await r.arrayBuffer() : null;
              if (buf) { if (propres.size > 2000) propres.clear(); propres.set(x.cle, (propres.get(x.cle) || 0) + 1); }   /* CH-080c : son entrée de ressource sera la nôtre */
              /* Périmé (autre opération, annulation) : rien n'est compté. Le corps est jeté dans tous les cas. */
              if (courant === c && !(c.arret && !c.navigue) && buf) {
                const n = buf.byteLength; c.octets += n; c.termines++; budget?.compter(0, n);
                if (attente.size > 4000) attente.clear(); attente.set(x.cle, t.rang);   /* CH-081 : redemandé par Potree avant `rang` arrivées, ou inutile */
                if (x.points) { octetsTot += n; pointsTot += x.points; octetsParPoint = octetsTot / pointsTot; }
              }
            } catch { /* annulée ou en échec : rien n'est compté */ }
            finally { c.controleurs.delete(ctl); c.enVolEst -= e; }
          }
        };
        await Promise.all(Array.from({ length: Math.min(R.enVolMax, file.length) }, travailleur));
      }
      if (!c.motif && c.resteNoeuds) c.motif = 'plafond-noeuds';
      if (!c.motif && !c.noeuds && !c.hierarchies) c.motif = c.couvertes.size ? 'deja-prechauffe' : c.sel.sansAdresse ? 'sans-adresse' : 'aucun-noeud';
      c.arret = true; c.reveil?.();
      return terminer(c);
    }
    return {
      apresCapture, annuler, ressources, actif: () => actif,
      etat: () => ({ op, enCours: !!courant && !courant.fini, octets: courant ? courant.octets : 0, actif, sansCache, lot: budget ? budget.etat() : null, attente: attente.size }),
      /* Essais seulement : clés de la dernière opération finie (jamais postées). */
      _clesPourEssai: () => suivi ? [...suivi.cles] : []
    };
  }
  return { VERSION: 'prechauffage-2', DEFAUT, SOURCES, reglage, cleChemin, classerEntetes, centresSuivante, candidats, niveauLocal, adresse, creer };
});
