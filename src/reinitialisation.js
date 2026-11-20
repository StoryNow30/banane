/* CH-149 (D-381) — REMISE À ZÉRO COMPLÈTE D'ARIANE.
 * Décision pure et effacement borné : aucune activité ni alerte d'écriture incertaine ne peut disparaître sans avoir été contrôlée.
 * Le service worker fournit l'état courant et remet ensuite sa mémoire à neuf ; ce module ne connaît ni ESV ni le moteur de pose. */
(function (root, fabrique) {
  const M = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.ArianeReinitialisation = M;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const nombre = v => Number.isFinite(v) ? v : Array.isArray(v) ? v.length : v?.size ?? 0;
  /* Raison claire pour l'opérateur, ou null quand la remise à zéro est permise.
   * `state` est accepté pour les essais et les appels qui possèdent déjà l'état du moteur ; le service worker passe des indicateurs normalisés. */
  function refus(ctx) {
    const c = ctx && typeof ctx === 'object' ? ctx : {}, s = c.state && typeof c.state === 'object' ? c.state : {};
    const lot = c.lotEnCours ?? s.batch?.state;
    if (c.lotEnCours === true || lot === 'RUNNING') return 'un lot Orbite est en cours (RUNNING)';
    if (lot === 'MANUAL_TAKEOVER') return 'un lot Orbite est en reprise manuelle (MANUAL_TAKEOVER)';
    if (c.busy || c.task) return 'Ariane travaille encore (action en cours)';
    if (c.repriseEnCours) return 'une reprise du lot est en cours';
    if (c.retourCutEnCours) return 'un retour à un cut est en cours';
    if (c.fileActive) return 'une Constellation est active';
    if (c.passeEnCours || c.passeActive) return 'une deuxième passe est en cours ou écrit encore';
    if (c.relectureEnCours === true || c.relectureEnCours === 'en-cours') return 'une relecture est en cours';
    if (c.nativeActive) return 'Écho est actif';
    if (c.manualActive) return 'une session Mes corrections est active';
    const intent = c.intent ?? s.intent, reconcile = c.reconcileRequired ?? s.reconcileRequired;
    const defer = c.deferPending ?? (s.deferIntent && s.deferIntent.phase !== 'FINALIZED'), applied = c.applied ?? s.applied;
    if (intent || reconcile || defer || applied || nombre(c.intentionsRelecture ?? c.intentionsEnSuspens) > 0)
      return 'un résultat ou une écriture incertaine reste à contrôler dans ESV';
    if (nombre(c.timingPending) > 0) return 'des écritures de mesure sont encore en cours';
    if (c.graceObservations === 'en-cours') return 'les dernières observations du lot qui vient de finir peuvent encore arriver : réessaie dans quelques secondes';
    return null;
  }

  /* Ordre voulu : la liaison est close avant tout effacement, puis les trois magasins, les deux stockages Chrome et enfin la mémoire vive. */
  async function executer({ store, storageLocal, storageSession, fermerTelecommande, reinitialiserMemoire }) {
    await fermerTelecommande?.();
    await store.clearAll();
    await storageLocal.clear();
    await storageSession?.clear?.();
    await reinitialiserMemoire?.();
  }

  return Object.freeze({ refus, executer });
});
