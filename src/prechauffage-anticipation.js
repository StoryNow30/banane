/* CH-081 (D-311 ; étude chantiers/CH-081/etude.md, aval de l'intégrateur du 09/11 sur D-310 et D-311) — ANTICIPATION DU PRÉCHAUFFAGE.
 * Module de la PAGE d'ESV (monde principal), pur : aucune requête, rien d'écrit dans Potree ni dans ESV ; il décide QUOI préchauffer et COMBIEN.
 *
 * Mesuré (étude, ÉTABLI) : entre la capture reçue et la coupe suivante, le réseau est libre 0,36 à 0,50 s (médiane) ; un saut lointain demande 7 à 14
 * nœuds de 100 à 190 ms, 2 en vol. Préchauffer la seule coupe suivante ne suffit pas : on vise DEUX coupes à l'avance. Aux changements de mode (lot →
 * passe des différés, passe → relecture), la suivante sort de la règle d'ESV : le service worker connaît la première coupe du mode suivant.
 *
 * Ce que rend le module :
 *  - `reglage(r)` : horizon (coupes à l'avance), candidats au plus par passage, plafonds du lot, repli ; chaque valeur hors bornes reprend le défaut ;
 *  - `cibles({ coupe, suite, modes, horizon, candidatsMax, sautMin })` : coupes à préchauffer pour ce passage, dans l'ordre de demande :
 *      `suite` : la chaîne prédite par la règle de sa source (k+1, k+2…), `modes` : premières coupes des modes suivants (source `changement-mode`) ;
 *      ordre : k+1, puis les changements de mode, puis k+2… ; doublons retirés ; le saut d'une coupe de la chaîne se compte depuis la précédente de la
 *      chaîne (c'est elle qui sera chargée à l'arrivée), celui d'un changement de mode depuis la coupe courante ; sous `sautMin`, rien pour elle ;
 *  - `creerBudget(R)` : plafonds du LOT (requêtes, octets) et repli à 1 candidat quand la part de nœuds préchauffés jamais redemandés par Potree
 *    dépasse `repliInutiles` sur les `repliFenetre` dernières opérations bilantées ;
 *  - `releveVue({ camera, pointBudget, pointcloud })` : caméra et réglages de Potree, LECTURE SEULE, en entiers et chaînes d'une liste fermée (jamais une
 *    adresse ni une position) ; `signatureVue` pour n'émettre `prechauffage-vue` qu'au départ du lot et à chaque changement. */
/** @template T @param {unknown} root @param {() => T} factory */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else /** @type {{BananePrechauffageAnticipation?:unknown}} */ (root).BananePrechauffageAnticipation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  /* Défaut du MODULE : prudent (comportement de CH-080 : une coupe, un candidat). Le réglage livré (src/settings.js) dit ce qui est allumé. */
  const DEFAUT = Object.freeze({ horizon: 1, candidatsMax: 1, lotRequetesMax: 4000, lotOctetsMax: 1200 * 1048576, lotFenetreMs: 0, repliInutiles: 0.3, repliFenetre: 50 });
  const BORNES = { horizon: [1, 3], candidatsMax: [1, 3], lotRequetesMax: [1, 100000], lotOctetsMax: [1048576, 8 * 1073741824], lotFenetreMs: [0, 86400000], repliInutiles: [0, 1], repliFenetre: [1, 1000] };
  const SOURCES_CIBLE = Object.freeze(['liste-esv', 'relu', 'passe-differes', 'b1-fenetre', 'changement-mode']);
  const TYPES_VUE = Object.freeze(['orthographique', 'perspective', 'autre', 'absente']);
  const fini = v => typeof v === 'number' && Number.isFinite(v);
  const entier = (v, a, b) => fini(v) && v >= a && v <= b ? Math.round(v) : null;

  function reglage(r) {
    const out = { ...DEFAUT };
    if (r && typeof r === 'object') for (const [k, [a, b]] of Object.entries(BORNES)) { const v = r[k]; if (fini(v) && v >= a && v <= b) out[k] = k === 'repliInutiles' ? v : Math.floor(v); }
    return Object.freeze(out);
  }

  const ligneOk = l => l && Number.isInteger(l.i) && l.i >= 0 && SOURCES_CIBLE.includes(l.source);
  /** Coupes à préchauffer pour ce passage. Rend [{ i, source, rang, saut, ligne }] (rang 1 = suivante), au plus `candidatsMax`. */
  function cibles({ coupe, suite = [], modes = [], horizon = 1, candidatsMax = 1, sautMin = 1 } = {}) {
    if (!Number.isInteger(coupe)) return [];
    const H = entier(horizon, 1, 3) ?? 1, N = entier(candidatsMax, 1, 3) ?? 1, S = entier(sautMin, 1, 100000) ?? 1;
    const chaine = [], vus = new Set([coupe]);
    let prec = coupe;
    for (const l of (Array.isArray(suite) ? suite : []).slice(0, H)) {
      if (!ligneOk(l)) break;   /* une chaîne rompue s'arrête : la suite ne vaut plus rien */
      const saut = l.i - prec; prec = l.i;
      if (vus.has(l.i)) continue; vus.add(l.i);
      chaine.push({ i: l.i, source: l.source, rang: chaine.length + 1, saut, ligne: l, garde: Math.abs(saut) >= S });
    }
    const alt = [];
    for (const l of Array.isArray(modes) ? modes : []) {
      if (!ligneOk(l) || l.source !== 'changement-mode' || vus.has(l.i)) continue; vus.add(l.i);
      const saut = l.i - coupe; alt.push({ i: l.i, source: l.source, rang: 1, saut, ligne: l, garde: Math.abs(saut) >= S });
    }
    const ordre = [...chaine.slice(0, 1), ...alt, ...chaine.slice(1)];
    return ordre.filter(c => c.garde).slice(0, N).map(({ garde, ...c }) => c);
  }

  /** Plafonds du lot et repli. `autorise(requetes, octets)` : la demande tient-elle encore ? `compter` après coup ; `bilanter(demandes, redemandes)`
   * à chaque bilan d'opération ; `candidatsMax(n)` : n, ou 1 pendant le repli. `etat()` : comptes (entiers), jamais une adresse. */
  /* Audit du 10/11 : `lotFenetreMs` > 0 et une horloge fournie : requêtes et octets sont comptés sur une fenêtre GLISSANTE de cette durée (le plafond
   * « du lot », compté pour la vie de la page, éteignait le préchauffage jusqu'au rechargement). 0, ou sans horloge : compte sans fin, comme avant. */
  function creerBudget(R0, maintenant) {
    const R = reglage(R0), glissant = R.lotFenetreMs > 0 && typeof maintenant === 'function';
    let requetes = 0, octets = 0, repli = false; const fen = [], faits = [];
    const heure = () => { try { const t = maintenant(); return fini(t) ? t : 0; } catch { return 0; } };
    const glisser = () => { if (!glissant) return; const lim = heure() - R.lotFenetreMs; while (faits.length && faits[0][0] <= lim) { const f = faits.shift(); requetes -= f[1]; octets -= f[2]; } };
    return Object.freeze({
      autorise: (rq = 1, oc = 0) => { glisser(); return requetes + rq <= R.lotRequetesMax && octets + oc <= R.lotOctetsMax; },
      compter: (rq = 0, oc = 0) => { const a = fini(rq) && rq > 0 ? Math.round(rq) : 0, b = fini(oc) && oc > 0 ? Math.round(oc) : 0; if (!a && !b) return; requetes += a; octets += b;
        if (glissant) { const t = heure(), d = faits[faits.length - 1]; if (d && d[0] === t) { d[1] += a; d[2] += b; } else faits.push([t, a, b]); } },
      bilanter: (demandes, redemandes) => {
        if (!(Number.isInteger(demandes) && demandes > 0 && Number.isInteger(redemandes) && redemandes >= 0)) return;
        fen.push([demandes, Math.min(redemandes, demandes)]); while (fen.length > R.repliFenetre) fen.shift();
        const d = fen.reduce((s, x) => s + x[0], 0), u = fen.reduce((s, x) => s + x[0] - x[1], 0);
        repli = d > 0 && u / d > R.repliInutiles;
      },
      candidatsMax: n => repli ? 1 : (entier(n, 1, 3) ?? 1),
      etat: () => { glisser(); return ({ requetes, octets, repli, operations: fen.length, plafondRequetes: requetes >= R.lotRequetesMax, plafondOctets: octets >= R.lotOctetsMax }); },
    });
  }

  /** Caméra active et réglages de Potree, lus sans rien toucher. Entiers bornés et types d'une liste fermée seulement. */
  function releveVue({ camera, pointBudget, pointcloud, pointLoadLimit } = {}) {
    const lire = f => { try { return f(); } catch { return undefined; } };
    /* CH-088 : `camera` (et non plus `type`) : le champ `type` de l'événement écrasait le type de l'enveloppe du journal (`esv-observation`), et les
     * outils ne voyaient plus aucun `prechauffage-vue` (lot « Vision 8 » du 09/11, ÉTABLI : 3 événements, tous lus « orthographique »). */
    const out = { camera: 'absente', demiLargeurMm: null, demiHauteurMm: null, profondeurM: null, champDeg: null, pointBudget: null, maxLevel: null, minNodeSize: null, boites: null, limitePoints: null };
    if (camera && typeof camera === 'object') {
      const ortho = lire(() => camera.isOrthographicCamera === true || camera.type === 'OrthographicCamera'), persp = lire(() => camera.isPerspectiveCamera === true || camera.type === 'PerspectiveCamera');
      out.camera = ortho ? 'orthographique' : persp ? 'perspective' : 'autre';
      const P = lire(() => camera.projectionMatrix?.elements);
      if (ortho && P && P.length === 16) {
        out.demiLargeurMm = fini(P[0]) && P[0] !== 0 ? entier(1000 / Math.abs(P[0]), 0, 1e9) : null;
        out.demiHauteurMm = fini(P[5]) && P[5] !== 0 ? entier(1000 / Math.abs(P[5]), 0, 1e9) : null;
        out.profondeurM = fini(P[10]) && P[10] !== 0 ? entier(2 / Math.abs(P[10]), 0, 1e9) : null;
      }
      if (persp) out.champDeg = entier(lire(() => camera.fov), 0, 180);
    }
    out.pointBudget = entier(pointBudget, 0, 1e10);
    /* CH-083 : `Potree.pointLoadLimit` (seuil de libération de la LRU ; absent de Potree 1.8 à develop : rien n'est jamais libéré). Absent : null. */
    out.limitePoints = entier(pointLoadLimit, 0, 1e15);
    if (pointcloud && typeof pointcloud === 'object') {
      const ml = lire(() => pointcloud.maxLevel);
      out.maxLevel = ml === Infinity || ml === undefined || ml === null ? -1 : entier(ml, 0, 64);   /* −1 : sans plafond (Potree : `maxLevel || Infinity`) */
      out.minNodeSize = entier(lire(() => pointcloud.minimumNodePixelSize), 0, 1e6);
      const cb = lire(() => pointcloud.material?.clipBoxes); out.boites = Array.isArray(cb) ? Math.min(cb.length, 99) : null;
    }
    return Object.freeze(out);
  }
  const CHAMPS_VUE = ['camera', 'demiLargeurMm', 'demiHauteurMm', 'profondeurM', 'champDeg', 'pointBudget', 'maxLevel', 'minNodeSize', 'boites', 'limitePoints'];
  /** Signature d'un relevé : deux relevés égaux ⇔ même signature (l'événement `prechauffage-vue` part au départ du lot puis à chaque changement). */
  const signatureVue = r => r ? CHAMPS_VUE.map(k => String(r[k])).join('|') : '';

  return Object.freeze({ DEFAUT, BORNES, SOURCES_CIBLE, TYPES_VUE, CHAMPS_VUE, reglage, cibles, creerBudget, releveVue, signatureVue });
});
