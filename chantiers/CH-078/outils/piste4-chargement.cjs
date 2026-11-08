/* CH-078, piste 4 — combien ESV charge par coupe, combien le lecteur en lit, combien lui sert.
 * Sources : journal du lot (lectures `capture-read` : noeuds, pts = points visibles de Potree, lruPts, niv = [niveau min, médian, max, …], bud = budget de points ;
 * observations `resource` de points : requêtes et octets) et corpus (qualité par nuage : points inspectés / retenus, nœuds lus et nœuds sans point retenu).
 * Usage : node piste4-chargement.cjs <dossier de collection banane-data> [...]. Agrégats seulement. */
'use strict';
const L = require('./lib-zips.cjs'), r = L.r, med = L.mediane, q = L.quantile;
const res = a => a.length ? { n: a.length, med: r(med(a)), p90: r(q(a, .9)), max: r(Math.max(...a)) } : { n: 0 };
for (const dir of process.argv.slice(2)) {
  const j = L.journal(dir), name = dir.split('/').filter(Boolean).pop().replace(/^\d{4}-\d\d-\d\d_/, '').replace(/parties?-[\d-]+/g, 'parties');
  const ev = j.events.map(e => ({ ...e, t: e.type === 'esv-observation' && e.kind === 'resource' ? e.endedEpochMs : Date.parse(e.timestamp || e.at || '') })).filter(e => Number.isFinite(e.t)).sort((a, b) => a.t - b.t);
  const lect = ev.filter(e => e.type === 'adapter-progress' && e.action === 'capture' && e.lastStage === 'capture-read' && e.lastDetail?.diag);
  const D = lect.map(e => e.lastDetail.diag);
  const num = k => D.map(x => x[k]).filter(Number.isFinite);
  const bud = {}; for (const x of D) if (Number.isFinite(x.bud)) bud[x.bud] = (bud[x.bud] || 0) + 1;
  const niv = D.filter(x => Array.isArray(x.niv) && Number.isFinite(x.niv[2]));
  const nivMax = {}; for (const x of niv) nivMax[x.niv[2]] = (nivMax[x.niv[2]] || 0) + 1;
  const nivMed = {}; for (const x of niv) if (Number.isFinite(x.niv[1])) nivMed[x.niv[1]] = (nivMed[x.niv[1]] || 0) + 1;
  const pleins = D.filter(x => Number.isFinite(x.pts) && Number.isFinite(x.bud) && x.pts >= 0.9 * x.bud).length;
  /* Cycles : validation acceptée -> validation acceptée suivante ; octets et requêtes de points dans le cycle ; durée jusqu'à la fin de lecture ; dernière lecture du cycle. */
  const acc = ev.filter(e => e.type === 'validation-accepted' && e.nextIdentity && e.identity), pts = ev.filter(e => e.type === 'esv-observation' && e.kind === 'resource' && e.class === 'point-resource');
  const fin = ev.filter(e => e.type === 'adapter-result' && e.action === 'capture' && !e.error);
  const cyc = [];
  for (let k = 0; k + 1 < acc.length; k++) {
    const a = acc[k], b = acc[k + 1]; if (a.batchId !== b.batchId || b.t - a.t > 60000 || b.identity.cut !== a.nextIdentity.cut || b.identity.part !== a.nextIdentity.part) continue;
    const f = fin.find(e => e.t > a.t && e.t <= b.t && e.identity?.cut === b.identity.cut); if (!f) continue;
    const rs = pts.filter(e => e.t > a.t && e.t <= f.t), lr = lect.filter(e => e.t > a.t && e.t <= f.t && e.identity?.cut === b.identity.cut).pop()?.lastDetail?.diag;
    cyc.push({ ms: f.t - a.t, req: rs.reduce((s, e) => s + (e.n || 0), 0), mo: rs.reduce((s, e) => s + (e.bytes || 0), 0) / 1048576, pts: lr?.pts, noeuds: lr?.noeuds, lruPts: lr?.lruPts });
  }
  const terciles = cle => { const v = cyc.filter(c => Number.isFinite(c[cle])).sort((x, y) => x[cle] - y[cle]), n = v.length, out = [];
    for (let i = 0; i < 3; i++) { const s = v.slice(Math.floor(i * n / 3), Math.floor((i + 1) * n / 3)); out.push({ [cle + '_min']: r(s[0][cle]), [cle + '_max']: r(s[s.length - 1][cle]), cycles: s.length, fin_lecture_med_ms: r(med(s.map(c => c.ms))), requetes_med: r(med(s.map(c => c.req))), mo_recus_med: r(med(s.map(c => c.mo)), 1) }); } return out; };
  /* Corpus : ce que le lecteur lit et garde. */
  const C = { nuages: 0, inspectes: [], retenus: [], parRail: [], noeuds: [], noeudsVides: [], partInspecteVide: [], vue_inspectes: [] };
  const n = L.corpus(dir, c => {
    const qu = c.quality || {}; C.nuages++;
    if (Number.isFinite(qu.inspected)) C.inspectes.push(qu.inspected / 2);   // le nuage cumule la vue gauche et la vue droite : on ramène à une vue
    if (Number.isFinite(qu.retained)) C.retenus.push(qu.retained);
    if (qu.perRail) C.parRail.push(Math.min(qu.perRail.left ?? Infinity, qu.perRail.right ?? Infinity));
    const nd = Array.isArray(c.nodes) ? c.nodes : []; if (nd.length) {
      const vides = nd.filter(x => x.retained === 0), tot = nd.reduce((s, x) => s + (x.inspected || 0), 0);
      C.noeuds.push(nd.length); C.noeudsVides.push(100 * vides.length / nd.length);
      if (tot) C.partInspecteVide.push(100 * vides.reduce((s, x) => s + (x.inspected || 0), 0) / tot); }
    for (const v of c.viewCaptures || []) if (Number.isFinite(v.quality?.inspected)) C.vue_inspectes.push(v.quality.inspected);
  });
  console.log(JSON.stringify({ collection: name, lectures_avec_releve: D.length, cycles_exploitables: cyc.length,
    charge_par_lecture: { noeuds_visibles: res(num('noeuds')), points_visibles_potree: res(num('pts')), points_en_cache_lru: res(num('lruPts')), noeuds_en_cache_lru: res(num('lruNoeuds')), memoire_js_mo: res(num('memMo')) },
    budget_de_points: bud, lectures_a_90pct_du_budget_ou_plus: pleins, niveau_max_des_noeuds: nivMax, niveau_median_des_noeuds: nivMed,
    par_cycle_validation_vers_fin_lecture: { duree_ms: res(cyc.map(c => c.ms)), requetes_points: res(cyc.map(c => c.req)), mo_recus: res(cyc.map(c => c.mo).map(v => r(v, 1))) },
    duree_selon_points_visibles: terciles('pts'), duree_selon_noeuds_visibles: terciles('noeuds'),
    corpus: { nuages: n, points_inspectes_par_vue: res(C.vue_inspectes), points_retenus_par_nuage: res(C.retenus), points_retenus_par_rail_min: res(C.parRail), noeuds_lus_par_nuage: res(C.noeuds),
      part_noeuds_sans_point_retenu_pct: res(C.noeudsVides.map(v => r(v, 1))), part_points_inspectes_dans_noeuds_sans_retenu_pct: res(C.partInspecteVide.map(v => r(v, 1))) } }, null, 1));
}
