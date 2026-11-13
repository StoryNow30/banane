'use strict';
/* CH-119 : programmation dynamique (Viterbi d'ordre 2) sur les observations d'une zone. Module pur (aucune dépendance), commun au prototype
 * et au patch (même code). Rien n'est commandé.
 * Observation o : { cut, x (m, le long, repère du cut décidé), y:{left,right} (mm, en travers), r (récompense), nature }.
 * Chemin : suite d'observations de cuts croissants, au plus une par cut, écart ≤ G cuts entre deux observations successives.
 * Une transition p → o est permise si les DEUX rails restent dans la tolérance (critère « voie » : une mauvaise voie décale les deux rails du
 * même côté ; un seul rail décalé est un défaut de rail, pas un changement de voie) :
 *   ordre 1 : min sur les rails de |y_o − y_p| ≤ T1[g] ; ordre 2 (si p a un prédécesseur q sur le chemin) : min sur les rails du résidu de o à
 *   la droite (q, p) prolongée ≤ T2[g]. Tolérances tirées de la loi mesurée des poses finales de l'opérateur (outils/residus.cjs).
 * Score = Σ r − cS·(cuts sautés). `decider` : meilleur chemin qui finit sur la pose locale du cut décidé, contre meilleur chemin du passé
 * proche (fini à G cuts au plus) qui saute ce cut. */
const SIDES = ['left', 'right'];
const DEFAUT = Object.freeze({ G: 4, T1: Object.freeze([0, 50, 60, 75, 100]), T2: Object.freeze([0, 40, 60, 80, 100]), cS: 0.1 });
const d1 = (o, p) => Math.min(...SIDES.map(s => Math.abs(o.y[s] - p.y[s])));
const d2 = (o, p, q) => Math.min(...SIDES.map(s => { const dx1 = p.x - q.x, dx2 = o.x - p.x; return Math.abs(o.y[s] - (p.y[s] + (p.y[s] - q.y[s]) * (Math.abs(dx1) > 1e-3 ? dx2 / dx1 : 1))); }));
/* obs : liste d'observations (toutes coupes confondues). Remplit o.F : Map(prédécesseur | null → score), o.best. */
function dp(obs, R = DEFAUT) {
  const tous = obs.slice().sort((a, b) => a.cut - b.cut);
  for (const o of tous) {
    o.F = new Map([[null, o.r]]); o.best = o.r; o.pred = null;
    for (const p of tous) {
      if (p.cut >= o.cut) break;
      const g = o.cut - p.cut; if (g > R.G) continue;
      if (d1(o, p) > R.T1[g]) continue;
      let best = -Infinity;
      for (const [q, fq] of p.F) {
        if (q !== null && d2(o, p, q) > R.T2[g]) continue;
        const v = fq + o.r - R.cS * (g - 1);
        if (v > best) best = v;
      }
      if (best > -Infinity) { o.F.set(p, best); if (best > o.best) { o.best = best; o.pred = p; } }
    }
  }
  return tous;
}
/* Décision au cut `cut` : `obs` contient les observations du passé et celles du cut (dont la pose locale, nature 'locale').
 * Rend { pose, passe, ecart, alt } : pose = meilleur score finissant sur la pose locale ; passe = meilleur score du passé proche (dernière
 * observation à G cuts au plus), diminué du saut jusqu'au cut ; ecart = passe − pose ; alt = meilleure observation du cut autre que la locale. */
function decider(obs, cut, R = DEFAUT) {
  const tous = dp(obs, R);
  const ici = tous.filter(o => o.cut === cut), proches = tous.filter(o => o.cut < cut && cut - o.cut <= R.G);
  const locale = ici.find(o => o.nature === 'locale') || null;
  const passe = proches.length ? Math.max(...proches.map(o => o.best - R.cS * (cut - o.cut - 1))) : null;
  const alt = ici.filter(o => o.nature !== 'locale').sort((a, b) => b.best - a.best)[0] || null;
  return { pose: locale ? locale.best : null, passe, ecart: locale && passe != null ? passe - locale.best : null, alt, locale };
}
module.exports = { dp, decider, d1, d2, DEFAUT };
