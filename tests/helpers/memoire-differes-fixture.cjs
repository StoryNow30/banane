'use strict';
/* Cas fabriqués de l'essai G1 (parties 91 à 95, cuts et valeurs inventés, graine fixe), partagés par tests/memoire-differes.test.cjs et
 * tests/memoire-differes-jugement.test.cjs : le fichier d'origine approchait la limite de 20 s par fichier (18 s sous charge). Aucune donnée de terrain. */
const G = require('../../tools/memoire-differes.cjs');

function alea(graine) { let a = graine >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
const r2 = v => Math.round(v * 100) / 100;

/* ---------------------------------------------------------------- jugement : cas fabriqués */
const cand = (la, ve, perte, extra = {}) => ({ la, ve, fla: la, fve: ve, calage: null, perte, haut: 40, flanc: 10, fort: 1, part: 0, pente: 0, fen: 1, bal: 'lm,fl', moteur: 1, ...extra });
/* Pool d'un rail : le bon candidat (fort, perte basse), des leurres plus ou moins forts, un candidat élargi hors moteur. */
function poolRail(vrai, rnd, { bonRang }) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const dl = (rnd() - 0.5) * 160, dv = (rnd() - 0.5) * 60;
    if (Math.hypot(dl - vrai[0], dv - vrai[1]) < 25) continue;
    out.push(cand(r2(dl), r2(dv), 2e-6 * (1 + rnd() * 3), { fort: rnd() < 0.3 ? 1 : 0, part: 1, haut: 20 + Math.floor(rnd() * 30), flanc: 3 + Math.floor(rnd() * 3) }));
  }
  out.push(cand(r2(vrai[0] + (rnd() - 0.5) * 2), r2(vrai[1] + (rnd() - 0.5) * 2), bonRang === 0 ? 1e-6 : 2.5e-6, { bal: 'm,ms,lm,fl,mf' }));
  out.push(cand(r2(vrai[0] + 200), r2(vrai[1]), 3e-6, { moteur: 0, bal: 'fl' }));
  return out.sort((a, b) => a.perte - b.perte);
}
/* Une partie : séries de longueurs données, décalage constant (par rapport au départ) dans chaque série. */
function partieFabriquee(partie, graine, { series = [4, 4, 3, 1, 1, 2], decalage = 40 } = {}) {
  const rnd = alea(graine), cas = [];
  let cut = 100;
  series.forEach((n, s) => {
    cut += 30; const d = (s % 2 ? -1 : 1) * (decalage + rnd() * 6);
    for (let i = 0; i < n; i++) {
      cut += i ? 1 : 0;
      const micG = [0, r2(d + (rnd() - 0.5)), r2(2 + (rnd() - 0.5))], micD = [0, r2(-d + (rnd() - 0.5)), r2(-1 + (rnd() - 0.5))];
      const bonRang = rnd() < 0.6 ? 0 : 1;
      const ec = [1440 + (rnd() - 0.5) * 6, 0, 0];
      const c = { type: 'cas', partie, cut, serie: { id: cut - i, rang: i, longueur: n },
        contexte: { etage: 'deferred', raisonEtage: i ? 'no-anchor' : 'pair-guard', nonResolus: ['gauche', 'droite'], rails: { gauche: { motif: bonRang ? 'ambiguity' : 'gauge-out-of-contract', lossRatio: 1.2 + bonRang, topRows: 40, faceCount: 10 }, droite: { motif: 'ambiguity', lossRatio: 1.5, topRows: 40, faceCount: 9 } },
          voisins: { posesAvant: 0, differesAvant: i, ecartVoisinsMm: null }, voie: { lot: null }, s6: { flushPct: 5 }, zone: null, ecartement: { departMm: 1440, deniveleLocalMm: 2 } },
        geometrie: { ecartement0: [0, ec[0] - 0, 0], axes: { gauche: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], droite: [[1, 0, 0], [0, -1, 0], [0, 0, 1]] } },
        rails: { gauche: { pool: poolRail([micG[1], micG[2]], rnd, { bonRang }), poolOk: true }, droite: { pool: poolRail([micD[1], micD[2]], rnd, { bonRang: 0 }), poolOk: true } },
        voisinsMic: [], departsVoisins: [], posesVoisines: [],
        reponse: { mic: { gauche: micG, droite: micD }, ecartementMicMm: 1440, pool: {} } };
      // la gauche et la droite sont séparées de ec[0] le long de l'axe x de la scène fabriquée : l'écartement vaut ec[0] + (laD*(-1) - laG)... gardé dans le contrat par construction
      c.geometrie.ecartement0 = [0, 1440 + 0, 0];
      cas.push(c);
    }
  });
  // voisinsMic : poses de l'opérateur des autres cas de la série, dans le repère de ce cut (décalage longitudinal de 10 mm par cut)
  for (const c of cas) for (const o of cas) {
    if (o === c || o.serie.id !== c.serie.id) continue;
    c.voisinsMic.push({ cut: o.cut, ecart: o.cut - c.cut, mic: { gauche: [10 * (o.cut - c.cut), o.reponse.mic.gauche[1], o.reponse.mic.gauche[2]], droite: [10 * (o.cut - c.cut), o.reponse.mic.droite[1], o.reponse.mic.droite[2]] } });
  }
  for (const c of cas) for (const cote of ['gauche', 'droite']) {
    const m = c.reponse.mic[cote], proche = f => { let b = null; c.rails[cote].pool.forEach((p, i) => { if (!f(p)) return; const d = Math.hypot(p.fla - m[1], p.fve - m[2]); if (!b || d < b.distMm) b = { i, distMm: r2(d) }; }); return b; };
    c.reponse.pool[cote] = { moteur: proche(p => p.moteur === 1), elargi: proche(() => true) };
  }
  return cas;
}
let _rapport = null;
const rapportCommun = () => _rapport || (_rapport = G.juger(parties()));   // le jugement complet sert à plusieurs essais
const parties = () => new Map([91, 92, 93, 94, 95].map((p, i) => [p, partieFabriquee(p, 1000 + 17 * i, { decalage: 30 + 10 * i })]));

const partieDe = (p, i) => partieFabriquee(p, 1000 + 17 * i, { decalage: 30 + 10 * i });
module.exports = { alea, r2, cand, poolRail, partieFabriquee, rapportCommun, parties, partieDe };
