#!/usr/bin/env node
'use strict';
/* Banc HORS LIGNE d'arbitrage de paire — laboratoire, pas une implémentation.
 *
 * Ce fichier ne touche à rien : il lit `datasets/automatic/offline-evaluation-v4.3.0.json`
 * et écrit un résultat. Il n'importe ni `src/geometry.js`, ni le cerveau, ni le
 * moteur, ne modifie aucun seuil et ne s'exécute jamais dans l'extension.
 *
 * CE QU'IL UTILISE, ET RIEN D'AUTRE. Par rail, le moteur expose trois
 * placements. Le banc les lit tels quels :
 *
 *     metrics.seed                     graine, meilleur de grille grossière
 *     metrics.surfaceIntersection      intersection des surfaces ajustées
 *     templateAmbiguity.alternative    concurrent de grille grossière
 *
 * Ce sont des couples (y, z) ; le banc les assemble en (0, y, z). Ce n'est pas
 * une invention : la recherche du moteur est bidimensionnelle, et la composante
 * x de tous les deltas réellement produits par le corpus vaut exactement zéro
 * (vérifié par `tests/pair-lab.test.cjs`). AUCUN autre candidat n'est fabriqué :
 * pas d'interpolation, pas de symétrisation, pas de nouvelle recherche.
 *
 * Trois candidats par rail donnent NEUF combinaisons de paire par cut.
 *
 * UNITÉS. Unités de scène, `physicalCalibrationStatus: not-independently-verified`.
 * Jamais converties en millimètres. La « relation de paire » est la distance
 * entre les origines de profil gauche et droite : ce n'est pas un écartement de
 * voie physique.
 *
 * ÉTANCHÉITÉ. Les fonctions qui DÉCIDENT — `anchorFor`, `decide`, `settled` —
 * ne lisent aucune valeur venue de l'humain. La référence humaine n'entre que
 * dans `measure`, après coup. Les cuts réservés à l'évaluation finale
 * (`reservedFinalEvaluation`, cuts 9031–9047) sont exclus du socle d'ancrage et
 * de tout balayage de paramètre.
 *
 * AUCUN PARAMÈTRE N'EST CHOISI ICI. Le balayage de K est livré entier ; le
 * réglage relève de la revue.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'datasets/automatic/offline-evaluation-v4.3.0.json');
/* Convention d'ÉVALUATION de l'oracle, reprise du banc indépendant pour que les
 * chiffres soient comparables. Ce n'est pas un seuil de production et elle
 * n'intervient dans aucune décision. */
const TOLERANCE_ORACLE = 0.010;

const norm = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function quantile(values, p) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.min(lo + 1, a.length - 1);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
}
/** column-major, vecteurs colonnes — convention de `vendor/capture-core.js`. */
function point(m, p) {
  return [m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12],
          m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13],
          m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14]];
}
/** Origine de profil après application d'un delta exprimé dans le repère local. */
function originAfter(state, delta) {
  const P = state.profileLocalToSceneRelative;
  const o = point(P, [0, 0, 0]), w = point(P, delta);
  return state.profileOriginSceneRelative.map((v, i) => v + w[i] - o[i]);
}
/** Les trois placements exposés, lus tels quels. Aucun n'est fabriqué. */
function candidates(proposal) {
  const m = proposal.metrics || {}, ta = m.templateAmbiguity || {}, out = {};
  if (m.seed) out.graine = [0, m.seed[0], m.seed[1]];
  if (m.surfaceIntersection) out.surface = [0, m.surfaceIntersection[0], m.surfaceIntersection[1]];
  if (ta.alternative) out.alternative = [0, ta.alternative[0], ta.alternative[1]];
  return out;
}

function build(source = SOURCE) {
  const raw = JSON.parse(fs.readFileSync(source));
  return raw.results.map(x => {
    const init = x.initialRails, rails = {}, cands = {};
    for (const side of ['left', 'right']) {
      const p = x.proposal[side], ta = (p.metrics || {}).templateAmbiguity || {};
      cands[side] = candidates(p);
      rails[side] = {
        status: p.status, confidence: p.confidence,
        lossRatio: ta.lossRatio ?? null, separation: ta.separation ?? null,
        applied: p.delta || null,
        // Référence humaine : lue ici, mais utilisée UNIQUEMENT par `measure`.
        humanDeltaLocal: (x.rails[side] || {}).humanDeltaLocal || null,
      };
    }
    const combinations = [];
    for (const left of Object.keys(cands.left)) for (const right of Object.keys(cands.right)) {
      const pair = norm(originAfter(init.left, cands.left[left]), originAfter(init.right, cands.right[right]));
      combinations.push({ left, right, pair });
    }
    return {
      part: x.identity.part, cut: x.identity.cut,
      reserved: Boolean(x.reservedFinalEvaluation),
      pairInitial: norm(init.left.profileOriginSceneRelative, init.right.profileOriginSceneRelative),
      rails, candidates: cands, combinations,
    };
  });
}

/* --- décision : aucune valeur humaine n'est lue sous cette ligne ----------- */

/** Le moteur a-t-il fortement discriminé les DEUX rails ? */
function settled(row, R) {
  const l = row.rails.left, r = row.rails.right;
  return l.status === 'candidate' && r.status === 'candidate'
    && Math.min(l.lossRatio ?? -Infinity, r.lossRatio ?? -Infinity) >= R;
}
/**
 * Relation de paire du couple que le moteur applique de fait.
 *
 * CORRECTION (tour « famille seulement »). Le premier banc prenait ici le couple
 * (surface, surface). C'était faux : sur les 173 rails résolus du corpus,
 * `proposal.delta` est STRICTEMENT égal à `metrics.seed` — écart 3D nul.
 * `surfaceIntersection` est exposé comme diagnostic et n'est jamais appliqué.
 * Le couple réellement appliqué est donc (graine, graine). Verrouillé par test.
 */
const appliedPair = row => row.combinations.find(c => c.left === 'graine' && c.right === 'graine').pair;

/* --- familles de placement ------------------------------------------------
 *
 * La partition est STRUCTURELLE, pas métrique : elle vient du champ d'où le
 * candidat est lu, donc de la construction du moteur lui-même.
 *
 *   famille 'best'        metrics.seed + metrics.surfaceIntersection
 *                         — le meilleur de grille grossière et son affinage
 *   famille 'alternative' templateAmbiguity.alternative
 *                         — une AUTRE cellule grossière, par construction
 *
 * Un critère de distance serait un seuil NOUVEAU : le moteur garantit
 * `alternativeSeparation` contre `coarseBest`, pas contre la graine affinée, et
 * 29 rails sur 220 ont une alternative à moins de 0.02 de leur graine.
 */
const FAMILIES = { best: ['graine', 'surface'], alternative: ['alternative'] };

/**
 * Représentant d'une famille pour un rail — la VARIANTE FINE N'EST JAMAIS
 * ARBITRÉE ICI.
 *
 * Pour la famille 'best', le représentant est la graine. Formulation exacte :
 * la graine est UTILISÉE COMME REPRÉSENTANT de la famille 'best', choix
 * cohérent avec le fait que `proposal.delta === metrics.seed` sur les 173 rails
 * que le moteur a effectivement résolus. Sur un rail abstenu, le moteur n'a
 * RIEN appliqué : on ne peut donc pas dire qu'il « avait déjà décidé
 * d'appliquer la graine ». Le banc n'introduit pour autant aucune règle
 * graine-contre-surface : il reprend le représentant observé ailleurs plutôt
 * que d'arbitrer la variante fine.
 *
 * Pour la famille 'alternative', il n'existe qu'un seul placement exposé.
 */
function familyRepresentative(family) {
  if (family === 'best') return 'graine';
  if (family === 'alternative') return 'alternative';
  throw Error('Famille inconnue : ' + family);
}

/* --- variantes d'arbitrage -------------------------------------------------
 *
 * Deux variantes EXPLICITEMENT DISTINCTES. Le banc ne choisit pas entre elles :
 * les deux sont mesurées, figées et livrées.
 *
 *   'pair-joint'          l'arbitre peut déplacer les DEUX rails, y compris un
 *                         rail que le moteur a déjà résolu (`status` vaut
 *                         'candidate') mais que `settled` ne protège pas.
 *
 *   'lock-resolved-rail'  tout rail déjà 'candidate' reste EXACTEMENT sur sa
 *                         graine — le placement que le moteur lui a appliqué —
 *                         et seul un rail abstenu peut changer de famille.
 *
 * Origine de la distinction : `settled(row, R)` est une condition de CUT, vraie
 * seulement si les DEUX rails sont fortement discriminés. Sur un cut à un rail
 * abstenu, 'pair-joint' parcourt donc les quatre couples de familles et peut
 * déplacer le rail déjà résolu. Ce n'est pas théorique : mesuré sur le corpus,
 * 5 cuts et 5 rails, dont le cut 9106 dont le rail gauche a un `lossRatio` de
 * 11.55 — bien au-dessus de R = 5 — et se retrouve déplacé parce que son
 * partenaire s'abstient.
 */
const VARIANTS = ['pair-joint', 'lock-resolved-rail'];

/** Familles ouvertes à l'arbitrage pour un rail donné, selon la variante. */
function openFamilies(rail, variant) {
  if (variant === 'lock-resolved-rail' && rail.status === 'candidate') return ['best'];
  if (!VARIANTS.includes(variant)) throw Error('Variante inconnue : ' + variant);
  return Object.keys(FAMILIES);
}

/**
 * Ancre et dispersion estimées sur les cuts de la MÊME PART que le moteur a
 * fortement discriminés, le cut jugé étant retiré (leave-one-out) et les cuts
 * réservés exclus. Aucune constante, aucune cible.
 */
function anchorFor(rows, part, excludeCut, R, minBase = 5) {
  const base = rows.filter(r => r.part === part && !r.reserved && r.cut !== excludeCut && settled(r, R));
  if (base.length < minBase) return null;
  const pairs = base.map(appliedPair);
  const median = quantile(pairs, 0.5);
  const dispersion = Math.max(quantile(pairs.map(v => Math.abs(v - median)), 0.5) || 0, 1e-4);
  return { median, dispersion, base: base.length };
}

/**
 * Politique candidate. Ne touche jamais un cut fortement discriminé des deux
 * côtés. S'abstient quand aucune combinaison exposée n'est compatible avec
 * l'ancre — cas où le bon placement n'existe pas parmi les candidats.
 */
function decide(row, rows, { R, K, minBase = 5 }) {
  if (settled(row, R)) return { decision: 'moteur' };
  const a = anchorFor(rows, row.part, row.cut, R, minBase);
  if (!a) return { decision: 'abstention', reason: 'socle-insuffisant' };
  const ranked = row.combinations.map(c => ({ c, gap: Math.abs(c.pair - a.median) })).sort((x, y) => x.gap - y.gap);
  if (ranked[0].gap > K * a.dispersion) return { decision: 'abstention', reason: 'aucun-candidat-plausible', anchor: a };
  return { decision: 'arbitrée', left: ranked[0].c.left, right: ranked[0].c.right, anchor: a, gap: ranked[0].gap };
}

/**
 * Politique « FAMILLE SEULEMENT ».
 *
 * Identique à `decide` — même ancre, même porte, mêmes R et K — à une seule
 * différence : l'arbitrage ne porte que sur la FAMILLE de chaque rail. La
 * variante fine à l'intérieur d'une famille n'est jamais choisie par le banc,
 * elle est reprise du moteur.
 *
 * Motif : la relation de paire sépare les familles (écart latéral médian
 * 42.50) mais pas les variantes fines d'une même famille (2.17). Le premier
 * tour arbitrait les deux et produisait dix régressions, toutes intra-famille.
 *
 * `variant` sélectionne l'une des deux variantes décrites ci-dessus. Tous les
 * autres paramètres — R, minBase, K, ancre, dispersion, porte — sont identiques
 * d'une variante à l'autre : seul l'ensemble des familles ouvertes change.
 */
function decideFamily(row, rows, { R, K, minBase = 5, variant = 'pair-joint' }) {
  if (settled(row, R)) return { decision: 'moteur', reason: 'settled' };
  const openLeft = openFamilies(row.rails.left, variant);
  const openRight = openFamilies(row.rails.right, variant);
  /* Sous 'lock-resolved-rail', un cut dont les deux rails sont déjà 'candidate'
   * n'offre qu'un seul couple : celui que le moteur applique déjà. Il n'y a
   * rien à arbitrer, et le dire explicitement vaut mieux que de le confondre
   * avec une abstention ou avec un cut fortement discriminé. */
  if (openLeft.length === 1 && openRight.length === 1
      && openLeft[0] === 'best' && openRight[0] === 'best'
      && row.rails.left.status === 'candidate' && row.rails.right.status === 'candidate') {
    return { decision: 'moteur', reason: 'aucun-rail-abstenu' };
  }
  const a = anchorFor(rows, row.part, row.cut, R, minBase);
  if (!a) return { decision: 'abstention', reason: 'socle-insuffisant' };
  const options = [];
  for (const left of openLeft) for (const right of openRight) {
    const l = familyRepresentative(left), r = familyRepresentative(right);
    const c = row.combinations.find(x => x.left === l && x.right === r);
    if (c) options.push({ familyLeft: left, familyRight: right, left: l, right: r, pair: c.pair });
  }
  const ranked = options.map(o => ({ o, gap: Math.abs(o.pair - a.median) })).sort((x, y) => x.gap - y.gap);
  if (!ranked.length) return { decision: 'abstention', reason: 'aucune-famille-exposée' };
  if (ranked[0].gap > K * a.dispersion) return { decision: 'abstention', reason: 'aucun-candidat-plausible', anchor: a };
  const w = ranked[0].o;
  return { decision: 'arbitrée', left: w.left, right: w.right,
           familyLeft: w.familyLeft, familyRight: w.familyRight, anchor: a, gap: ranked[0].gap,
           lockedLeft: openLeft.length === 1, lockedRight: openRight.length === 1 };
}

/** Décideur « famille seulement » lié à une variante — pour `sweep` et `freeze`. */
const familyDecider = variant => (row, rows, opts) => decideFamily(row, rows, { ...opts, variant });

/** Nombre de rails DÉJÀ résolus par le moteur que cette décision déplace hors de sa graine. */
function resolvedRailsMoved(row, d) {
  if (d.decision !== 'arbitrée') return [];
  return ['left', 'right'].filter(s =>
    row.rails[s].status === 'candidate' && (s === 'left' ? d.left : d.right) !== 'graine');
}

/* --- mesure : c'est ICI, et seulement ici, qu'apparaît la référence humaine - */

function measure(row, left, right) {
  const e = ['left', 'right'].map(side => {
    const human = row.rails[side].humanDeltaLocal;
    const delta = row.candidates[side][side === 'left' ? left : right];
    return human && delta ? norm(delta, human) : null;
  });
  return e.every(v => v !== null) ? Math.max(...e) : null;
}
const appliedError = row => {
  const e = ['left', 'right'].map(s => {
    const h = row.rails[s].humanDeltaLocal, d = row.rails[s].applied;
    return h && d ? norm(d, h) : null;
  });
  return e.every(v => v !== null) ? Math.max(...e) : null;
};
const engineApplies = row => row.rails.left.status === 'candidate' && row.rails.right.status === 'candidate';
const recoverable = (row, tol = TOLERANCE_ORACLE) =>
  Math.min(...row.combinations.map(c => measure(row, c.left, c.right) ?? Infinity)) <= tol;

/**
 * Balayage de K.
 *
 * CORRECTION (revue Astra). Le compteur `recovered` du tour précédent était
 * faux : il incrémentait pour TOUT cut arbitré dont le moteur n'appliquait rien,
 * sans regarder l'erreur obtenue. Un cut sorti à 48×10⁻³ de la référence humaine
 * y était compté comme « récupéré ». Trois compteurs distincts le remplacent :
 *
 *   arbitratedAbstention           cuts arbitrés sur lesquels le moteur
 *                                  n'appliquait rien (au moins un rail abstenu)
 *   recoveredAtOracleTolerance     ... dont l'erreur finale ≤ TOLERANCE_ORACLE
 *   arbitratedButOutsideTolerance  ... dont l'erreur finale > TOLERANCE_ORACLE
 *
 * `TOLERANCE_ORACLE` reste une convention d'ÉVALUATION reprise du banc
 * indépendant : elle sert à COMPTER, jamais à décider.
 */
function sweep(rows, R, Ks, decider = decide) {
  const design = rows.filter(r => !r.reserved);          // les réservés ne servent à rien ici
  return Ks.map(K => {
    const out = {
      K,
      untouched: 0, untouchedSettled: 0, untouchedNothingToArbitrate: 0,
      abstained: 0, arbitrated: 0,
      // cuts arbitrés sur lesquels le moteur n'appliquait rien
      arbitratedAbstention: 0, recoveredAtOracleTolerance: 0,
      arbitratedButOutsideTolerance: 0, abstentionNotMeasurable: 0,
      // cuts arbitrés sur lesquels le moteur appliquait déjà un couple complet
      arbitratedApplied: 0, corrected: 0, regressed: 0, unchanged: 0, appliedNotMeasurable: 0,
      // effet sur les rails que le moteur avait déjà résolus
      resolvedRailsMoved: 0, cutsWithResolvedRailMoved: 0,
      errors: [],
    };
    for (const row of design) {
      const d = decider(row, rows, { R, K });
      if (d.decision === 'moteur') {
        out.untouched++;
        if (d.reason === 'aucun-rail-abstenu') out.untouchedNothingToArbitrate++;
        else out.untouchedSettled++;
        continue;
      }
      if (d.decision === 'abstention') { out.abstained++; continue; }
      out.arbitrated++;
      const moved = resolvedRailsMoved(row, d);
      out.resolvedRailsMoved += moved.length;
      if (moved.length) out.cutsWithResolvedRailMoved++;
      const after = measure(row, d.left, d.right);
      if (!engineApplies(row)) {
        out.arbitratedAbstention++;
        if (after === null) { out.abstentionNotMeasurable++; continue; }
        out.errors.push(after);
        if (after <= TOLERANCE_ORACLE) out.recoveredAtOracleTolerance++;
        else out.arbitratedButOutsideTolerance++;
        continue;
      }
      out.arbitratedApplied++;
      const before = appliedError(row);
      if (before === null || after === null) { out.appliedNotMeasurable++; continue; }
      if (after < before - 1e-9) out.corrected++;
      else if (after > before + 1e-9) out.regressed++;
      else out.unchanged++;
    }
    out.abstentionErrorP90 = quantile(out.errors, 0.9);
    out.abstentionErrorMax = out.errors.length ? Math.max(...out.errors) : null;
    delete out.errors;
    return out;
  });
}

/**
 * Artefact de politique FIGÉ et sérialisable — « famille seulement ».
 *
 * Décision déterministe par cut, pour CHAQUE valeur de K du balayage : aucun K
 * n'est choisi ici, le scoring indépendant pourra retenir celle qu'il veut.
 * L'empreinte est calculée sur le contenu canonique, champ `sha256` exclu.
 */
function freeze(rows, { R = 5, Ks = [1, 2, 3, 5, 10], minBase = 5, variant = 'pair-joint' } = {}) {
  if (!VARIANTS.includes(variant)) throw Error('Variante inconnue : ' + variant);
  const decisions = rows.map(row => {
    const perK = {};
    for (const K of Ks) {
      const d = decideFamily(row, rows, { R, K, minBase, variant });
      perK[String(K)] = d.decision === 'arbitrée'
        ? { decision: 'arbitrée', familyLeft: d.familyLeft, familyRight: d.familyRight,
            placementLeft: d.left, placementRight: d.right,
            resolvedRailsMoved: resolvedRailsMoved(row, d) }
        : { decision: d.decision, reason: d.reason ?? null };
    }
    return { part: row.part, cut: row.cut, reserved: row.reserved,
             engineApplies: engineApplies(row),
             railStatus: { left: row.rails.left.status, right: row.rails.right.status },
             lossRatio: { left: row.rails.left.lossRatio, right: row.rails.right.lossRatio },
             byK: perK };
  });
  const body = {
    format: 'banane-pair-arbitration-policy-v1',
    policy: 'famille-seulement',
    variant,
    variantMeaning: variant === 'pair-joint'
      ? 'l’arbitre peut déplacer les deux rails, y compris un rail déjà résolu (status candidate) '
      + 'que settled ne protège pas parce que son partenaire s’abstient ou que son lossRatio est < R'
      : 'tout rail déjà résolu (status candidate) reste exactement sur sa graine ; '
      + 'seul un rail abstenu peut changer de famille',
    frozenAt: new Date().toISOString(),
    nature: 'artefact hors ligne figé, remis pour scoring indépendant — aucune exécution runtime',
    source: { file: path.relative(ROOT, SOURCE),
              sha256: crypto.createHash('sha256').update(fs.readFileSync(SOURCE)).digest('hex') },
    units: 'scene-units; physicalCalibrationStatus: not-independently-verified; never millimetres',
    parameters: {
      R, minBase, K: Ks,
      KNotChosen: 'aucune valeur de K n’est retenue : les décisions sont fournies pour chacune',
      anchor: 'médiane de la relation de paire du couple (graine, graine) sur les cuts de la MÊME PART '
            + 'où lossRatio ≥ R des deux côtés, cut jugé retiré (leave-one-out), cuts réservés exclus',
      dispersion: 'écart absolu médian autour de cette médiane, plancher 1e-4',
      gate: '|paire − ancre| de la meilleure combinaison ≤ K × dispersion, sinon abstention',
      untouched: 'un cut fortement discriminé des deux côtés n’est jamais arbitré',
      families: FAMILIES,
      familyRepresentative: { best: 'graine', alternative: 'alternative' },
      fineVariantNeverArbitrated:
        'la variante fine n’est jamais choisie par le banc. La graine est UTILISÉE COMME '
      + 'REPRÉSENTANT de la famille best, choix cohérent avec proposal.delta === metrics.seed '
      + 'sur les 173 rails que le moteur a effectivement résolus. Sur un rail abstenu le moteur '
      + 'n’a rien appliqué : il n’avait donc décidé d’appliquer ni la graine ni autre chose.',
    },
    reserved: { cuts: rows.filter(r => r.reserved).map(r => r.cut).sort((a, b) => a - b),
                usage: 'évaluation finale uniquement — exclus du socle d’ancrage et de tout réglage' },
    counts: { cuts: rows.length, decisions: decisions.length },
    decisions,
  };
  /* L'empreinte porte sur le CONTENU DÉCISIONNEL seul — format, politique,
   * variante, source, paramètres, réserve et décisions — à l'exclusion de
   * l'horodatage et des champs descriptifs. Un tiers peut donc la recalculer à
   * l'identique :
   *   sha256( JSON.stringify({format, policy, variant, source, parameters, reserved, decisions}) )
   * Vérifié par test. */
  const hashed = { format: body.format, policy: body.policy, variant: body.variant,
                   source: body.source, parameters: body.parameters,
                   reserved: body.reserved, decisions: body.decisions };
  const canonical = JSON.stringify(hashed);
  return { ...body,
           sha256: crypto.createHash('sha256').update(canonical).digest('hex'),
           sha256Covers: ['format', 'policy', 'variant', 'source', 'parameters', 'reserved', 'decisions'] };
}

function main() {
  const rows = build();
  const R = 5;
  const result = {
    format: 'banane-pair-arbitration-lab-v1',
    generatedAt: new Date().toISOString(),
    source: path.relative(ROOT, SOURCE),
    units: 'scene-units; physicalCalibrationStatus: not-independently-verified; never millimetres',
    nature: 'laboratoire hors ligne — aucune politique de production, aucun paramètre retenu',
    candidatesPerRail: ['graine', 'surface', 'alternative'],
    combinationsPerCut: 9,
    oracleTolerance: TOLERANCE_ORACLE,
    counts: {
      cuts: rows.length,
      rails: rows.length * 2,
      abstainingRails: rows.reduce((n, r) => n + ['left', 'right'].filter(s => r.rails[s].status === 'unresolved').length, 0),
      abstainingCuts: rows.filter(r => !engineApplies(r)).length,
      reservedCuts: rows.filter(r => r.reserved).length,
    },
    recoverable: {},
    sweep: {
      fine: sweep(rows, R, [1, 2, 3, 5, 10], decide),
      'famille/pair-joint': sweep(rows, R, [1, 2, 3, 5, 10], familyDecider('pair-joint')),
      'famille/lock-resolved-rail': sweep(rows, R, [1, 2, 3, 5, 10], familyDecider('lock-resolved-rail')),
    },
  };
  for (const part of [17, 20]) {
    const ls = rows.filter(r => r.part === part);
    result.recoverable[part] = {
      cuts: ls.length,
      recoverable: ls.filter(r => recoverable(r)).length,
      notRecoverable: ls.filter(r => !recoverable(r)).map(r => r.cut).sort((a, b) => a - b),
    };
  }
  if (process.argv.includes('--freeze')) {
    const i = process.argv.indexOf('--freeze');
    const dest = process.argv[i + 1];
    const v = process.argv.indexOf('--variant');
    const variant = v === -1 ? 'pair-joint' : process.argv[v + 1];
    const frozen = freeze(rows, { variant });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(frozen, null, 2));
    console.log(`politique figée : ${path.relative(ROOT, dest)}  (variante ${frozen.variant})`);
    console.log(`sha256 du contenu canonique : ${frozen.sha256}`);
    console.log(`corpus source : ${frozen.source.sha256}`);
    return;
  }
  const out = process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : null;
  const text = JSON.stringify(result, null, 2);
  if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, text); }
  console.log(text);
}

module.exports = { build, candidates, settled, anchorFor, appliedPair, decide, decideFamily,
                   FAMILIES, familyRepresentative, VARIANTS, openFamilies, familyDecider,
                   resolvedRailsMoved, measure, appliedError, engineApplies,
                   recoverable, sweep, freeze, quantile, originAfter, point, SOURCE, TOLERANCE_ORACLE };
if (require.main === module) main();
