/* CH-078, piste 5 — faux positifs d'une fin d'attente plus courte. Les lectures « rapide » (règle `stabilite`, repli quand le compteur de Potree est mort)
 * portent `gm` = plus long silence (ms) de la signature des nœuds qui a précédé un changement de cette signature pendant l'attente (CH-049-A) :
 * fermer l'attente après un silence Q < gm aurait lu AVANT ce dernier changement (nuage incomplet au sens des nœuds : faux positif). `at` = durée d'attente,
 * `tc` = instant du dernier changement, `m` = condition manquante au repli. Usage : node piste5-silence.cjs <dossier de collection> [...]. Agrégats seulement. */
'use strict';
const L = require('./lib-zips.cjs'), r = L.r;
for (const dir of process.argv.slice(2)) {
  const j = L.journal(dir), name = dir.split('/').filter(Boolean).pop().replace(/^\d{4}-\d\d-\d\d_/, '').replace(/parties?-[\d-]+/g, 'parties');
  const lect = [];
  for (const e of j.events) if (e.type === 'adapter-progress' && e.action === 'capture' && e.lastStage === 'capture-read' && e.lastDetail?.diag) lect.push({ ...e.lastDetail.diag, regle: e.lastDetail.regle, lecture: e.lastDetail.lecture });
  const rep = lect.filter(x => x.regle === 'stabilite' && Number.isFinite(x.gm) && Number.isFinite(x.at));
  const seuils = [100, 200, 300, 400, 600, 800];
  const tab = seuils.map(Q => {
    const fp = rep.filter(x => x.gm >= Q).length;
    // Gain : une attente qui s'est fermée après 800 ms de silence se serait fermée après Q ; sans faux positif, on gagne 800 − Q ms par lecture (borne haute).
    return { silence_ms: Q, lectures_avec_changement_apres_ce_silence: fp, part_faux_positifs_pct: r(100 * fp / rep.length, 1), gain_max_par_lecture_ms: 800 - Q };
  });
  const par = {}; for (const x of lect) par[x.regle + '/' + (x.m || '-')] = (par[x.regle + '/' + (x.m || '-')] || 0) + 1;
  console.log(JSON.stringify({ collection: name, lectures: lect.length, lectures_repli_avec_gm: rep.length, repartition_regle_et_condition_manquante: par,
    attente_ms_repli: { med: r(L.mediane(rep.map(x => x.at))), p90: r(L.quantile(rep.map(x => x.at), .9)) },
    attente_ms_signal: { med: r(L.mediane(lect.filter(x => x.m === undefined || x.regle === 'signal').map(x => x.at).filter(Number.isFinite))) },
    changements_pendant_attente_repli: { med: L.mediane(rep.map(x => x.ch)), part_avec_au_moins_un: r(100 * rep.filter(x => x.ch > 0).length / rep.length, 1) },
    silence_maximal_avant_changement_gm_ms: { med: r(L.mediane(rep.filter(x => x.ch > 0).map(x => x.gm))), p90: r(L.quantile(rep.filter(x => x.ch > 0).map(x => x.gm), .9)) },
    par_seuil: tab }, null, 1));
}
