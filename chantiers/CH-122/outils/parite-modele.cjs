#!/usr/bin/env node
'use strict';
/* CH-122 : parité entre le score de l'outil d'apprentissage et celui du module (src/gcv2-l1.js d'une copie patchée), sur les candidats d'un jeu.
 *   node chantiers/CH-122/outils/parite-modele.cjs --code COPIE --rejeu jeu-livre --modeles DOSSIER
 * Rend le plus grand écart de probabilité et le nombre de cuts dont le choix (candidat, poser/différer) diffère. */
const path = require('node:path'), fs = require('node:fs');
const P = require('./puce-lib.cjs'), { LOTS, cle, travail } = require('../../CH-116/outils/lots.cjs');
const a = process.argv.slice(2), opt = k => a[a.indexOf(k) + 1];
const L1 = require(path.join(path.resolve(opt('--code')), 'src', 'gcv2-l1.js'));
const W = travail(), tous = P.jeu(path.join(W, 'rejeux', opt('--rejeu')), process.env.CH116_CORPUS || path.join(W, 'corpus.jsonl'), LOTS.map(cle));
const LOG1P = ['dgRef', 'dgMed', 'dvProche', 'dzProche', 'dvFit', 'vaResidu', 'dvListe', 'dvVoie', 'dvGeo', 'depl', 'latMax', 'vertMax'];
let maxEcart = 0, diffChoix = 0, n = 0;
for (const f of fs.readdirSync(opt('--modeles')).filter(f => /^puce-.*\.json$/.test(f))) {
  const M = JSON.parse(fs.readFileSync(path.join(opt('--modeles'), f), 'utf8'));
  const lg = new Set((M.log1p || []).map(x => M.traits.indexOf(x)));
  const brut = t => t.map((v, j) => { const w = lg.has(j) && Number.isFinite(v) ? Math.log1p(Math.abs(v)) : v; return w === null || !Number.isFinite(w) ? M.moy[j] : w; });
  const outil = t => M.type === 'arbres' ? P.predireArbres(M, brut(t)) : P.predire(M, P.zst(M, brut(t)));
  for (const c of tous.filter(c => c.lot === M.pli)) {
    const ts = c.cands.map(x => x.t.map(v => v === null ? NaN : v));
    for (const t of ts) { maxEcart = Math.max(maxEcart, Math.abs(outil(t) - L1.pucePredire(M, t))); n++; }
    const jC = M.traits.indexOf('chainePose'), r = L1.puceDecider(M, { candidats: c.cands.map((x, i) => ({ decal: x.decal, src: jC >= 0 && ts[i][jC] === 1 ? ['chainePose'] : [], t: ts[i] })) });
    const tj = n => M.traits.indexOf(n), obl = t => a.includes('--oblig') && !(t[tj('livreValide')] === 1 || (tj('chainePose') >= 0 && t[tj('chainePose')] === 1))
      && !(t[tj('vaManque')] === 0 && t[tj('vaDist')] <= 6 && t[tj('vaResidu')] <= 40 && t[tj('dvFit')] <= 100);
    let b = null; for (let i = 0; i < ts.length; i++) { if (L1.puceRefuse(M.gardes, ts[i]) || obl(ts[i])) continue; const q = outil(ts[i]); if (!b || q > b.q) b = { i, q }; }
    const iC = M.traits.indexOf('chainePose'), cle = c.contexte === 'chaine' && M.seuils.chaine !== undefined ? 'chaine' : c.zone, zone = c.zone, poseOutil = !!b && b.q >= M.seuils[cle] && ((iC >= 0 && c.cands[b.i].t[iC] === 1) || Math.max(...['left', 'right'].map(s => Math.max(Math.abs(c.cands[b.i].decal[s][1]), Math.abs(c.cands[b.i].decal[s][2])))) >= (M.deltaMm[zone] ?? 2));
    const poseMod = r.dd.etat === 'valider';
    if (poseOutil !== poseMod || (poseMod && JSON.stringify(r.dd.decal) !== JSON.stringify(c.cands[b.i].decal))) diffChoix++;
  }
}
process.stdout.write(`candidats ${n} ; plus grand écart de probabilité ${maxEcart.toExponential(2)} ; cuts au choix différent ${diffChoix}\n`);
