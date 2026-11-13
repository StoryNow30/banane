'use strict';
/* CH-120 : mesure du rappel du pool d'hypothèses de la GCV2 (hors ligne, lecture seule ; rien n'est commandé, aucune décision changée).
 * Appelé par le banc (tools/banc-differes.cjs, copie hors dépôt + `banc-mesure-pool.patch`) quand BANC_POOL_DUMP (dossier) est réglé :
 * pour chaque cut avec nuage et vérité, le pool de `deciderDiffere` à l'instant de la décision (profil L1-se) est confronté à la pose finale
 * de l'opérateur. BANC_POOL_VERITE : fichier JSON { "lot8:partie:cut": { left, right, classe, sort, exclu } } (mm, repère profil de départ).
 * Sortie : une ligne JSON par cut (numéros et millimètres seulement). */
const fs = require('node:fs'), path = require('node:path');
const SIDES = ['left', 'right'];
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const r1 = v => Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
let VERITE = null;
const verite = () => VERITE || (VERITE = JSON.parse(fs.readFileSync(process.env.BANC_POOL_VERITE, 'utf8')));
const SEARCH_Y = 0.08, SEARCH_Z = 0.04, MARGE = 0.01, JUSTE = 10;

function noter({ lot, partie, cut, capture, science, g, zone, L1, Sh, ref }) {
  const v = verite()[`${lot}:${partie}:${cut}`];
  const dir = process.env.BANC_POOL_DUMP; fs.mkdirSync(dir, { recursive: true });
  const fichier = path.join(dir, `${lot}-${partie}.jsonl`);
  const nHyp = g ? SIDES.map(s => g.hyp.rails[s].length) : null;
  if (!v) { fs.appendFileSync(fichier, JSON.stringify({ cut, zone, sansVerite: true, nHyp }) + '\n'); return; }
  const T = Sh.reservoirOutils, out = { cut, zone, classe: v.classe, sort: v.sort, exclu: v.exclu || null, nHyp, rails: {} };
  const k = g.cas, presents = {};
  for (const s of SIDES) {
    const hyps = g.hyp.rails[s], vt = v[s];
    const dist = hyps.map(h => d3(h.decal, vt));
    presents[s] = dist.map((d, i) => d <= JUSTE ? i : -1).filter(i => i >= 0);
    const imin = dist.reduce((b, d, i) => d < dist[b] ? i : b, 0);
    const r = science.rails[s], rs = r && r.ok && r._reservoir;
    const info = { dmin: r1(dist[imin]), origine: hyps[imin] ? hyps[imin].origines.join('+') : null, present: presents[s].length > 0,
      originesPresentes: [...new Set(presents[s].flatMap(i => hyps[i].origines))].sort() };
    info.soutien = L1.soutienRail(capture, s, vt);
    if (rs) {
      const sign = rs.sign, uT = sign * vt[1] / 1000, zT = vt[2] / 1000;
      const centres = (r.astar && r.astar.uCenters) || [0];
      info.fenetre = centres.some(cu => Math.abs(uT - cu) <= SEARCH_Y + MARGE) && Math.abs(zT) <= SEARCH_Z + MARGE;
      info.cadre = Math.abs(vt[1]) < 180 && Math.abs(vt[2]) < 100;
      info.centres = centres.map(cu => r1(1000 * sign * cu));
      let best = null;
      for (const c of rs.pool) {
        const d = Math.hypot(1000 * sign * c.u - vt[1], 1000 * c.z - vt[2]);
        if (!best || d < best.d) best = { d, c };
      }
      if (best) {
        const c = best.c;
        info.cellule = { d: r1(best.d), comp: T.inCompetitive(c, rs.lmin), strong: T.qualifyStrong(c), ratio: r1(T.lossRatio(c.loss, rs.lmin) * 10) / 10,
          top: c.topRows ?? null, faces: c.faceCount ?? null, window: !!c.windowOk, pente: !!c.slopeLimited, motif: c.motif || null };
      }
      info.reservoir = rs.pool.length;
    } else info.moteur = r && r.ok ? 'sans-reservoir' : (r && r.reason) || 'absent';
    out.rails[s] = info;
  }
  const nb = SIDES.filter(s => presents[s].length).length;
  out.classePool = nb === 2 ? 'A' : nb === 1 ? 'B' : 'C';
  if (nb === 2) {
    let adm = false;
    for (const i of presents.left) { for (const j of presents.right) {
      const gp = L1.ecartementPaire(k, k.rails.left.hyps[i], k.rails.right.hyps[j]);
      if (Number.isFinite(gp) && ((Number.isFinite(k.gMed) && Math.abs(gp - k.gMed) <= 15) || (gp >= 1420 && gp <= 1470))) { adm = true; break; } }
      if (adm) break; }
    out.admissible = adm;
  }
  /* Pool effectif : hypothèses H0-H6 plus les cellules de la recherche recentrée livrée (diagnostic de la décision L1-e, [lat, vert]). */
  const rech = g.decision && g.decision.diag && g.decision.diag.recherche;
  out.recherche = rech ? { relances: rech.relances, graines: rech.graines } : null;
  const presentsR = {};
  for (const s of SIDES) {
    const cel = rech ? rech.cellules[s] : [], vt = v[s];
    const dist = cel.map(x => Math.hypot(x[0] - vt[1], x[1] - vt[2], vt[0]));
    presentsR[s] = cel.filter((x, i) => dist[i] <= JUSTE).map(x => [0, x[0], x[1]]);
    out.rails[s].rech = { n: cel.length, dmin: dist.length ? r1(Math.min(...dist)) : null, present: presentsR[s].length > 0 };
  }
  const tous = s => presents[s].map(i => g.hyp.rails[s][i].decal).concat(presentsR[s]);
  const nbU = SIDES.filter(s => tous(s).length).length;
  out.classeEffective = nbU === 2 ? 'A' : nbU === 1 ? 'B' : 'C';
  if (nbU === 2) {
    let adm = false;
    for (const a of tous('left')) { for (const b of tous('right')) {
      const gp = L1.ecartementDecal(capture, { left: a, right: b });
      if (Number.isFinite(gp) && ((Number.isFinite(k.gMed) && Math.abs(gp - k.gMed) <= 15) || (ref && Number.isFinite(ref.mm) && Math.abs(gp - ref.mm) <= 15) || (gp >= 1420 && gp <= 1470))) { adm = true; break; } }
      if (adm) break; }
    out.admissibleEffective = adm;
  }
  out.decision = g.decision ? { etat: g.decision.etat, motif: g.decision.motif ?? null, paire: g.decision.paire ? { left: g.decision.paire.left.decal, right: g.decision.paire.right.decal } : null } : null;
  fs.appendFileSync(fichier, JSON.stringify(out) + '\n');
}
module.exports = { noter };
