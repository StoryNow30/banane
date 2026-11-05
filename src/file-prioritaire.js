/* CH-053-S — LA FILE PRIORITAIRE DES CUTS À CORRIGER (cible T2 : multiplier par deux le nombre de références INFORMATIVES par minute de travail
 * de l'opérateur). Module PUR : aucun DOM, aucun message, aucune API Chrome, aucune écriture dans ESV, aucune lecture de nuage. Il n'est
 * branché nulle part : il range des candidats et rend une liste que la liste « À contrôler » ou l'Aurore peut lire (même forme que les entrées
 * de src/correction-liste.js : { part, cut, groupe, signaux, details, rang }).
 *
 * Référence informative = paire d'états initiaux qualifiée ET correction humaine de plus de 10 mm (tools/rendement-apprentissage.cjs).
 * Le module ne mesure pas : il range d'après des TAUX par classe de candidat (part informative et coût en secondes de visite), donnés ou
 * appris sur des observations (`apprendreTaux`), puis ordonne par rendement attendu décroissant (informatifs par minute).
 *
 * Classes (tout se lit avant la visite : journal du lot, liste d'ESV, score de src/verts-a-controler.js) :
 *   D-contrat      différé dont les deux rails sont « écartement hors contrat » (faute dominante des parties 14 et 15, le moteur est à côté) ;
 *   D-sanspoints   différé dont la capture du lot était vide (motif `input` des deux rails : aucun point lu par le lot) ;
 *   D-points       tout autre différé (le lot avait des points : candidat, ambiguïté, flanc…) ;
 *   vert-fort / vert-moyen / vert-faible / vert-inconnu   vert (cut laissé valide par ESV) selon son score de « verts à contrôler » ;
 *   posee-ariane   cut posé par Ariane (le jugement de ces posés relève de la séance Écho tirée au sort, pas de cette file).
 * Règles : (1) un différé reste TOUJOURS dans la file (c'est un travail dû à l'opérateur, ESV le laisse invalide) ; seul son rang change ;
 * (2) un vert ou un posé n'entre que si le rendement attendu de sa classe atteint `plancherParMin` (défaut : le rendement de la pratique actuelle,
 * 5 par minute de visite) ; (3) un cut déjà jugé (`jugesDeja`, clés « partie:cut ») n'est pas reproposé ; (4) à rendement égal, l'ordre des cuts,
 * pour que l'opérateur parcoure des plages et non des sauts (un saut coûte ~6 s de plus qu'un cut voisin, mesuré le 04/11).
 * Aucun chiffre n'est deviné : une classe sans observation n'a pas de taux et ses candidats sont écartés (différés exceptés). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.ArianeFilePrioritaire = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'file-prioritaire-1';
  const CLASSES = ['D-contrat', 'D-sanspoints', 'D-points', 'vert-fort', 'vert-moyen', 'vert-faible', 'vert-inconnu', 'posee-ariane'];
  const SEUIL_VERT_FORT = 2, SEUIL_VERT_MOYEN = 1;
  const PLANCHER_PAR_MIN = 5;
  const HORS_CONTRAT = 'gauge-out-of-contract/gauge-out-of-contract', SANS_POINTS = 'input/input';
  const fini = Number.isFinite;
  const r1 = v => (fini(v) ? Math.round(v * 10) / 10 : null);

  /* Taux mesurés le 04/11 (parties 10, 13, 14, 15 ; 250 cuts visités ; coût = temps de visite cumulé du cut). Voir chantiers/CH-053/S-rapport.md
   * et `tools/file-prioritaire.cjs simuler`. Ils servent de défaut ; la preuve du gain est la validation croisée par partie de la simulation. */
  const TAUX_DEFAUT = Object.freeze(Object.fromEntries(Object.entries({
    'D-contrat': [8, 7, 7, 30], 'D-sanspoints': [46, 25, 0, 172], 'D-points': [11, 4, 4, 96],
    'vert-fort': [10, 5, 0, 21], 'vert-moyen': [22, 2, 0, 36], 'vert-faible': [68, 1, 0, 88], 'vert-inconnu': [70, 5, 0, 129], 'posee-ariane': [13, 1, 0, 21],
  }).map(([k, [n, informatifs, avecTraits, coutS]]) => [k, Object.freeze(taux(n, informatifs, avecTraits, coutS))])));

  function taux(n, informatifs, avecTraits, coutS) {
    return { n, informatifs, avecTraits, coutS: r1(coutS), p: n ? r1(informatifs / n * 100) / 100 : 0, parMin: coutS > 0 ? r1(informatifs / coutS * 60) : 0 };
  }

  /* Classe d'un candidat : { part, cut, source: 'differe'|'vert'|'posee', motif?: 'gauche/droite', score?: number }. */
  function classe(c) {
    if (c && c.source === 'differe') return c.motif === HORS_CONTRAT ? 'D-contrat' : c.motif === SANS_POINTS ? 'D-sanspoints' : 'D-points';
    if (c && c.source === 'vert') {
      if (!fini(c.score)) return 'vert-inconnu';
      return c.score >= SEUIL_VERT_FORT ? 'vert-fort' : c.score >= SEUIL_VERT_MOYEN ? 'vert-moyen' : 'vert-faible';
    }
    return 'posee-ariane';
  }

  /* Observations : [{ classe, informatif: bool, avecTraits?: bool, coutS }] (un cut visité par observation). */
  function apprendreTaux(observations) {
    const acc = {};
    for (const o of observations || []) {
      if (!o || !o.classe || !fini(o.coutS)) continue;
      const a = acc[o.classe] = acc[o.classe] || { n: 0, inf: 0, tr: 0, t: 0 };
      a.n++; a.t += o.coutS; if (o.informatif) a.inf++; if (o.informatif && o.avecTraits) a.tr++;
    }
    return Object.fromEntries(Object.entries(acc).map(([k, a]) => [k, taux(a.n, a.inf, a.tr, a.t)]));
  }

  const GROUPE = { differe: 'poser', vert: 'controler', posee: 'corriger' };

  /* La file. `candidats` : voir `classe`. Options : taux (défaut TAUX_DEFAUT), plancherParMin, jugesDeja (Set « partie:cut »), critere ('informatif' |
   * 'avec-traits' : dans ce cas le rendement est celui des informatifs où Ariane avait pris une décision, utile à l'apprentissage de L1). */
  function ordonner(candidats, options = {}) {
    const T = options.taux || TAUX_DEFAUT, plancher = fini(options.plancherParMin) ? options.plancherParMin : PLANCHER_PAR_MIN;
    const juges = options.jugesDeja instanceof Set ? options.jugesDeja : new Set(), traits = options.critere === 'avec-traits';
    const entrees = [], ecartes = [];
    let dejaJuges = 0;
    for (const c of candidats || []) {
      if (!c || !Number.isInteger(c.cut)) continue;
      if (juges.has(`${c.part}:${c.cut}`)) { dejaJuges++; continue; }
      const cl = classe(c), t = T[cl];
      const parMin = t && t.coutS > 0 ? r1((traits ? t.avecTraits : t.informatifs) / t.coutS * 60) : null;
      const e = { part: c.part, cut: c.cut, groupe: GROUPE[c.source] || 'corriger', signaux: [cl],
        details: { classe: cl, pInfo: t ? t.p : null, coutS: t && t.n ? r1(t.coutS / t.n) : null, attenduParMin: parMin, ...(fini(c.score) ? { score: c.score } : {}), ...(c.motif ? { motif: c.motif } : {}) } };
      const du = c.source === 'differe';
      if (!du && !(fini(parMin) && parMin >= plancher)) { ecartes.push({ part: c.part, cut: c.cut, classe: cl, attenduParMin: parMin }); continue; }
      entrees.push({ ...e, _r: fini(parMin) ? parMin : -1 });
    }
    entrees.sort((a, b) => b._r - a._r || a.part - b.part || a.cut - b.cut);
    return { version: VERSION, critere: traits ? 'avec-traits' : 'informatif', plancherParMin: plancher, dejaJuges, taux: T,
      entrees: entrees.map(({ _r, ...e }, i) => ({ ...e, rang: i + 1 })), ecartes };
  }

  /* « 4213–4215, 4220 » : les cuts d'une file, suites consécutives réunies, dans l'ordre des cuts. */
  function plages(cuts) {
    const t = [...new Set(cuts)].sort((a, b) => a - b), out = [];
    for (const c of t) { const d = out.at(-1); if (d && c === d[1] + 1) d[1] = c; else out.push([c, c]); }
    return out.map(([a, b]) => (a === b ? String(a) : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`)).join(', ');
  }

  return { VERSION, CLASSES, PLANCHER_PAR_MIN, TAUX_DEFAUT, classe, apprendreTaux, ordonner, plages };
});
