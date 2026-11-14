'use strict';
/* CH-123 : mesure du pool (celle de CH-120, `mesure-pool.cjs`, inchangée) plus l'autopsie des rails manquants (hors ligne, lecture seule ;
 * aucune décision changée). Chargé par le banc comme BANC_POOL_MODULE (crochet `banc-mesure-pool.patch` de CH-120).
 *   BANC_POOL_CH120 : chemin de `mesure-pool.cjs` de CH-120 ; BANC_POOL_DUMP, BANC_POOL_VERITE : comme CH-120.
 * Pour chaque rail absent du pool (classe B ou C), on ajoute `autopsie` :
 *  - `raison` du moteur s'il n'a pas de repère ;
 *  - `oracle` : le moteur relancé avec la pose de départ du rail mise à la vérité (diagnostic seulement, la vérité n'entre dans aucune décision) :
 *    cellule la plus proche de la vérité dans son réservoir (distance, lignes de dessus, flanc, rapport de perte, fenêtre, pente, forte, compétitive) ;
 *  - `compagnon` : pour chaque hypothèse PRÉSENTE de l'autre rail, ce rail ramené à l'écartement de référence (liste, sinon médiane du lot) :
 *    distance à la vérité ; et la meilleure cellule du moteur relancé sur cette graine.
 * Sortie : le fichier de CH-120 (une ligne par cut), lignes enrichies du champ `autopsie` (numéros et millimètres seulement). */
const fs = require('node:fs'), path = require('node:path');
const M = require(process.env.BANC_POOL_CH120);
const SIDES = ['left', 'right'];
const r1 = v => Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function meilleureCellule(capture, s, graine, L1, Sh) {
  /* Filtre large : toute cellule du réservoir dans la fenêtre du moteur relancé. */
  const rr = L1.rechercheRecentree(capture, { [s]: graine }, { minTop: 0, minFace: 0, ratioMax: 1e9 });
  return rr && rr[s] ? rr[s] : null;
}
function noter(o) {
  const dir = process.env.BANC_POOL_DUMP, fichier = path.join(dir, `${o.lot}-${o.partie}.jsonl`);
  const avant = fs.existsSync(fichier) ? fs.statSync(fichier).size : 0;
  M.noter(o);
  const txt = fs.readFileSync(fichier, 'utf8'), ligne = txt.slice(avant).trim();
  if (!ligne) return;
  const x = JSON.parse(ligne);
  if (x.sansVerite || x.classeEffective === 'A') return;
  const { capture, science, g, L1, Sh, ref } = o;
  const verite = JSON.parse(fs.readFileSync(process.env.BANC_POOL_VERITE, 'utf8'))[`${o.lot}:${o.partie}:${o.cut}`];
  const gRef = ref && Number.isFinite(ref.mm) ? ref.mm : (g && Number.isFinite(g.gMed) ? g.gMed : null);
  const au = { gRef: r1(gRef), refSource: ref && Number.isFinite(ref.mm) ? 'liste' : (gRef ? 'lot' : null), rails: {} };
  const presentDe = s => x.rails[s].present || (x.rails[s].rech && x.rails[s].rech.present);
  for (const s of SIDES) {
    if (presentDe(s)) continue;
    const vt = verite[s], a = { verite: vt.map(r1) };
    const r = science.rails[s];
    if (!r || !r.ok) a.raison = r ? String(r.reason || r.error || '').slice(0, 60) : 'absent';
    try {
      const c = meilleureCellule(capture, s, [vt[1], vt[2]], L1, Sh);
      if (c) {
        let b = null; for (const k of c) { const d = d3(k.mm, vt); if (!b || d < b.d) b = { d, k }; }
        a.oracle = b ? { d: r1(b.d), top: b.k.top, face: b.k.face, ratio: b.k.ratio, fort: b.k.fort, n: c.length } : { d: null, n: 0 };
      } else a.oracle = { moteur: 'sans-repere' };
    } catch (e) { a.oracle = { erreur: String(e.message).slice(0, 60) }; }
    const o2 = SIDES.find(z => z !== s);
    if (presentDe(o2) && Number.isFinite(gRef) && g) {
      const hyps = g.hyp.rails[o2].filter(h => d3(h.decal, verite[o2]) <= 10);
      const comp = [];
      for (const h of hyps.slice(0, 3)) {
        const base = { [o2]: h.decal.slice(), [s]: [0, h.decal[1], h.decal[2]] };
        const nd = L1.ramenerRail(capture, base, s, gRef, 400);
        if (!nd) { comp.push({ ramene: null }); continue; }
        const e = { dGauge: r1(d3(nd[s], vt)), lat: r1(nd[s][1] - vt[1]) };
        try {
          const c = meilleureCellule(capture, s, [nd[s][1], nd[s][2]], L1, Sh);
          if (c && c.length) {
            let b = null; for (const k of c) { const d = d3(k.mm, nd[s]); if (!b || d < b.d) b = { d, k }; }
            e.cellule = { dGraine: r1(b.d), dVerite: r1(d3(b.k.mm, vt)), top: b.k.top, face: b.k.face, ratio: b.k.ratio, fort: b.k.fort };
            let bv = null; for (const k of c) { const d = d3(k.mm, vt); if (!bv || d < bv.d) bv = { d, k }; }
            e.celluleVerite = { d: r1(bv.d), top: bv.k.top, face: bv.k.face, ratio: bv.k.ratio, fort: bv.k.fort, dGraine: r1(d3(bv.k.mm, nd[s])) };
          }
        } catch { /* rien */ }
        comp.push(e);
      }
      a.compagnon = comp;
    }
    au.rails[s] = a;
  }
  x.autopsie = au;
  fs.writeFileSync(fichier, txt.slice(0, avant) + JSON.stringify(x) + '\n');
}
module.exports = { noter, aVerite: M.aVerite };
