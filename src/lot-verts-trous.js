(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BananeLotVertsTrous = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  /* CH-160 (D-383, opérateur, 24/11/2026, piste 1) — VALIDER SUR PLACE LES VERTS DES TROUS DE GRAPPE PENDANT LE LOT.
   *
   * Module PUR, sans I/O et sans commande ESV :
   *  - Grappes : même règle que `src/relecture-ombre.js` (`trouCuts = 5`, `min = 3`). On regroupe les cuts du lot (invalides du
   *    périmètre du lot) en autorisant un écart d'au plus `trouCuts`. Seuls les groupes d'au moins `min` cuts du lot forment des
   *    grappes (les isolés et les paires n'absorbent aucun vert).
   *  - Trous absorbés : uniquement les trous de 1, 2 ou 3 cuts (`trouMaxCuts = 3`, comme D-284) strictement encadrés par deux
   *    cuts du lot consécutifs de la même grappe. Les trous de 4 ou 5 cuts ne sont pas absorbés, même à l'intérieur d'une grappe.
   *  - Filtre de statut live : un candidat n'est visité que s'il est `valid` dans ESV, jamais traité par un opérateur
   *    (`TreatedByOperator` faux), hors des cuts du lot et hors du dernier cut de la partie. */

  const VERSION = 'lot-verts-trous-v1';
  const DEFAULTS = Object.freeze({
    actif: true,
    trouCuts: 5,
    min: 3,
    trouMaxCuts: 3,
  });
  const STATUTS = ['valid', 'invalid', 'skipped', 'autre'];
  const entier = v => Number.isInteger(v) && v >= 0;
  const entierOu = (v, d, min = 0) => (Number.isInteger(v) && v >= min ? v : d);
  const tableau = v => Array.isArray(v) || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(v));
  /* Aligné sur `rougeListe` de background.js : statut 1 (invalid) ou 3 (autre / illisible). Un cut au statut 3 n'est pas un vert à valider. */
  const rougeCode = v => v === 1 || v === 3;

  function reglage(options) {
    if (options === false || (options && typeof options === 'object' && options.actif === false)) {
      return { actif: false, trouCuts: DEFAULTS.trouCuts, min: DEFAULTS.min, trouMaxCuts: DEFAULTS.trouMaxCuts };
    }
    const o = options && typeof options === 'object' ? options : {};
    const g = o.grappe && typeof o.grappe === 'object' ? o.grappe : {};
    return {
      actif: true,
      trouCuts: entierOu(o.trouCuts ?? g.trouCuts, DEFAULTS.trouCuts, 0),
      min: entierOu(o.min ?? g.min, DEFAULTS.min, 1),
      trouMaxCuts: entierOu(o.trouMaxCuts, DEFAULTS.trouMaxCuts, 0),
    };
  }

  /* Extrait et trie les numéros entiers distincts des cuts du lot à partir :
   *  - d'un tableau/Set d'entiers ou d'objets `{ cut }` / `{ i }` ;
   *  - d'un tableau de lignes de liste `[{ i, statut }]` (garde `statut === 'invalid'` ou `s === 'invalid'`) ;
   *  - d'une table décompactée `{ st, fl, n }` (garde les indices où `st[i]` est rouge) ;
   *  - d'un instantané compact `{ format: 'ariane-liste-instantane-1', r }`. */
  function extraireCutsLot(entree, options = {}) {
    const start = entier(options?.start) ? options.start : 0;
    const end = entier(options?.end) ? options.end : Infinity;
    const dansBornes = c => entier(c) && c >= start && c <= end;
    const out = new Set();
    if (!entree) return [];
    const src = entree instanceof Set ? [...entree] : entree;
    if (Array.isArray(src)) {
      const estListeLignes = src.some(x => x && typeof x === 'object' && ('statut' in x || 's' in x));
      for (const x of src) {
        if (entier(x)) {
          if (dansBornes(x)) out.add(x);
        } else if (x && typeof x === 'object') {
          if (estListeLignes) {
            const st = x.statut ?? x.s;
            const c = entier(x.cut) ? x.cut : entier(x.i) ? x.i : null;
            if (c !== null && (st === 'invalid' || st === 1) && dansBornes(c)) out.add(c);
          } else if (x.differe !== undefined || 'cut' in x || 'i' in x) {
            const c = entier(x.cut) ? x.cut : entier(x.i) ? x.i : null;
            if (c !== null && dansBornes(c)) out.add(c);
          }
        }
      }
      return [...out].sort((a, b) => a - b);
    }
    if (typeof src === 'object') {
      if (Array.isArray(src.cutsLot)) return extraireCutsLot(src.cutsLot, options);
      if (Array.isArray(src.lot)) return extraireCutsLot(src.lot, options);
      if (tableau(src.st)) {
        const n = entier(src.n) ? Math.min(src.n, src.st.length) : src.st.length;
        for (let i = 0; i < n; i++) if (rougeCode(src.st[i]) && dansBornes(i)) out.add(i);
        return [...out].sort((a, b) => a - b);
      }
      if (Array.isArray(src.r)) {
        for (let i = 0; i < src.r.length; i++) {
          const row = src.r[i], st = Array.isArray(row) ? (row[0] | 0) & 3 : 3;
          if (rougeCode(st) && dansBornes(i)) out.add(i);
        }
        return [...out].sort((a, b) => a - b);
      }
      if (src.table) return extraireCutsLot(src.table, options);
    }
    return [];
  }

  /* Calcul pur des grappes, des trous absorbés (1 à `trouMaxCuts` cuts) et de la liste plate des cuts candidats. */
  function vertsTrousGrappe(cutsLot, options) {
    const cfg = reglage(options);
    if (!cfg.actif) return { grappes: [], trous: [], cuts: [] };
    const cuts = extraireCutsLot(cutsLot, options);
    if (cuts.length < cfg.min) return { grappes: [], trous: [], cuts: [] };
    const groupes = [];
    for (const c of cuts) {
      const g = groupes.at(-1);
      if (g && c - g.at(-1) <= cfg.trouCuts) g.push(c);
      else groupes.push([c]);
    }
    const grappes = [], trous = [];
    for (const g of groupes) {
      if (g.length < cfg.min) continue;
      const debut = g[0], fin = g.at(-1), nLot = g.length;
      grappes.push({ debut, fin, cutsLot: g.slice(), nLot });
      for (let i = 1; i < g.length; i++) {
        const gauche = g[i - 1], droite = g[i], longueur = droite - gauche - 1;
        if (longueur >= 1 && longueur <= cfg.trouMaxCuts) {
          const cutsTrou = [];
          for (let c = gauche + 1; c < droite; c++) cutsTrou.push(c);
          trous.push({ gauche, droite, longueur, cuts: cutsTrou, grappe: { debut, fin }, nLot });
        }
      }
    }
    return { grappes, trous, cuts: trous.flatMap(t => t.cuts) };
  }

  /* Ligne d'un cut dans une table décompactée `{ st, fl }`. */
  function ligneDeTable(table, cut) {
    if (!table || !tableau(table.st) || !entier(cut) || cut >= table.st.length) return null;
    const code = table.st[cut];
    const statut = STATUTS[code] || 'autre';
    const fl = tableau(table.fl) && cut < table.fl.length ? table.fl[cut] | 0 : 0;
    return { i: cut, statut, operateur: (fl & 1) === 1, vu: (fl & 2) === 2 };
  }

  /* Prépare les candidats du lot à partir de la table de la partie. Vérifie la présence et la concordance (au moins 80 % des cuts connus du lot). */
  function preparerDepuisTable({ table, scope = {}, traitesLot = [], cutCourant = null } = {}, options) {
    const cfg = reglage(options);
    if (!cfg.actif) {
      return { actif: false, ok: false, abstention: null, cutsLot: [], setLot: new Set(), grappes: [], trous: [], cuts: [], parGauche: new Map() };
    }
    if (!table || !tableau(table.st) || !table.st.length || table.rompue === true || table.tronquee === true || table.debut === false) {
      return { actif: true, ok: false, abstention: 'liste-absente', cutsLot: [], setLot: new Set(), grappes: [], trous: [], cuts: [], parGauche: new Map() };
    }
    const n = entier(table.n) ? Math.min(table.n, table.st.length) : table.st.length;
    if (entier(scope?.total) && scope.total > 0 && n !== scope.total) {
      return { actif: true, ok: false, abstention: 'liste-non-concordante', cutsLot: [], setLot: new Set(), grappes: [], trous: [], cuts: [], parGauche: new Map() };
    }
    const start = entier(scope?.start) ? scope.start : 0;
    const finBorne = scope?.endMode === 'partie' || !entier(scope?.end) ? n - 1 : Math.min(n - 1, scope.end);
    const dejaSet = new Set((Array.isArray(traitesLot) ? traitesLot : [...traitesLot]).filter(entier));
    const connus = new Set(dejaSet);
    if (entier(cutCourant)) connus.add(cutCourant);
    let rougesTable = 0, concordants = 0;
    const cutsLot = [];
    for (let i = start; i <= finBorne; i++) {
      const estRouge = rougeCode(table.st[i]);
      if (estRouge) rougesTable++;
      if (estRouge || dejaSet.has(i)) cutsLot.push(i);
    }
    for (const c of connus) {
      if (c < 0 || c >= n) continue;
      const fl = tableau(table.fl) ? table.fl[c] | 0 : 0;
      if (rougeCode(table.st[c]) || (fl & 1) === 1) concordants++;
    }
    if (!cutsLot.length || ( rougesTable === 0 && !dejaSet.size ) || (connus.size > 0 && concordants < Math.ceil(0.8 * connus.size))) {
      return { actif: true, ok: false, abstention: 'liste-non-concordante', cutsLot: [], setLot: new Set(), grappes: [], trous: [], cuts: [], parGauche: new Map() };
    }
    const res = vertsTrousGrappe(cutsLot, cfg);
    const setLot = new Set(cutsLot);
    const parGauche = new Map(res.trous.map(t => [t.gauche, t]));
    return { actif: true, ok: true, abstention: null, total: n, cutsLot, setLot, ...res, parGauche };
  }

  /* Qualification du statut live d'un candidat juste avant sa visite. */
  function qualifierCandidatLive({ cut, ligne, setLot = null, total = null } = {}) {
    if (!entier(cut)) return { visiter: false, resultat: 'ignore', motif: 'cut-invalide' };
    if (setLot && setLot.has(cut)) return { visiter: false, resultat: 'ignore', motif: 'cut-du-lot' };
    if (entier(total) && total > 0 && cut >= total - 1) return { visiter: false, resultat: 'ignore', motif: 'dernier-cut-partie' };
    if (!ligne || typeof ligne !== 'object' || typeof ligne.statut !== 'string') {
      return { visiter: false, resultat: 'ignore', motif: 'statut-illisible' };
    }
    if (ligne.operateur === true) return { visiter: false, resultat: 'ignore', motif: 'deja-traite' };
    if (ligne.statut !== 'valid') return { visiter: false, resultat: 'ignore', motif: 'plus-valid' };
    return { visiter: true, resultat: null, motif: null };
  }

  function creerBilan(candidats = 0) {
    return { candidats: entierOu(candidats, 0, 0), valides: 0, ignores: 0, echecs: 0 };
  }

  function noterResultatBilan(bilan, resultat) {
    const b = bilan && typeof bilan === 'object' ? bilan : creerBilan(0);
    if (resultat === 'valide') b.valides = (b.valides || 0) + 1;
    else if (resultat === 'ignore') b.ignores = (b.ignores || 0) + 1;
    else if (resultat === 'echec') b.echecs = (b.echecs || 0) + 1;
    return b;
  }

  function construireEvenement({ cut = null, part = null, lotId = null, resultat, motif = null, trou = null, grappe = null, detail = null } = {}) {
    const c = entier(cut) ? cut : null;
    const p = entier(part) ? part : null;
    const t = trou && entier(trou.gauche) && entier(trou.droite)
      ? { gauche: trou.gauche, droite: trou.droite, longueur: entier(trou.longueur) ? trou.longueur : trou.droite - trou.gauche - 1 }
      : null;
    const gSrc = grappe || trou?.grappe || null;
    const g = gSrc && entier(gSrc.debut) && entier(gSrc.fin) ? { debut: gSrc.debut, fin: gSrc.fin } : null;
    return {
      identity: p !== null && c !== null ? { part: p, cut: c } : null,
      cut: c,
      part: p,
      lotId: lotId ?? null,
      resultat: String(resultat || 'ignore'),
      motif: motif != null ? String(motif) : null,
      trou: t,
      grappe: g,
      ...(detail && typeof detail === 'object' ? detail : {}),
    };
  }

  return Object.freeze({
    VERSION,
    DEFAULTS,
    reglage,
    extraireCutsLot,
    vertsTrousGrappe,
    ligneDeTable,
    preparerDepuisTable,
    qualifierCandidatLive,
    creerBilan,
    noterResultatBilan,
    construireEvenement,
  });
});
