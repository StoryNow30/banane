#!/usr/bin/env node
'use strict';
/*
 * l1-diag-hypotheses.cjs — DIAGNOSTIC DES HYPOTHÈSES DE LA GCV2 (L1) CONTRE L'ÉCHO (fiches/L1_APPRENTISSAGE.md). Étude HORS LIGNE.
 *
 *   node tools/l1-diag-hypotheses.cjs --partie P:N --journal J.json --corpus C.json [--corpus …] --lot ID (--echo DOSSIER [--echo …] | --juges CUTS.jsonl)
 *                                     [--profil L1-s] [--parametres P.json] --sortie D.jsonl
 *
 * `--juges` : fichier `cuts-*.jsonl` de tools/diag-differes.cjs (différés jugés, pose de l'opérateur déjà jointe) au lieu de l'Écho.
 *
 * Rejoue le lot comme `tools/banc-differes.cjs rejouer` (même code, même ordre) et, pour chaque différé que la GCV2 examine, garde TOUTES
 * ses hypothèses (décalages, probabilité à 10 mm, origines, écartement de la paire) à côté de la pose finale de l'opérateur (Écho). Un cut
 * est jugé si la pose de départ de l'Écho est celle du lot (écartement à 2 mm près, comme `comparer`). Tous les cas examinés sont écrits (un cas
 * non jugé garde ses hypothèses, sans vérité : il compte dans le taux de différés). Rend, par cut jugé :
 *   - l'erreur de la paire choisie, et sa probabilité ;
 *   - par rail, l'hypothèse la plus proche de l'opérateur (distance, rang de probabilité) : « atteignable » si elle est à 10 mm ;
 *   - la meilleure paire atteignable (les deux rails à 10 mm) et si la règle d'écartement de L1 la permet.
 * Sortie JSON lignes HORS DÉPÔT : des millimètres dans le repère profil de la pose de départ, des numéros de cut, des probabilités.
 */
const fs = require('node:fs');
const B = require('./banc-differes.cjs');
const P = require('./gcv2-predire-differes.cjs');
const L1 = require('../src/gcv2-l1.js');
const E = require('./l1-apprendre-ecartement-modele.cjs');

const SIDES = ['left', 'right'];
const fini = v => typeof v === 'number' && Number.isFinite(v);
const arrondi = (v, d = 1) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function args(argv) {
  const o = { corpus: [], echo: [], profil: 'L1-s' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], val = () => { const v = argv[++i]; if (v === undefined) throw Error('valeur manquante après ' + k); return v; };
    if (k === '--partie') { const m = /^([1-9]\d*):([1-9]\d*)$/.exec(val()); if (!m) throw Error('--partie PROJET:PARTIE'); o.projet = Number(m[1]); o.partie = Number(m[2]); }
    else if (k === '--journal') o.journal = val(); else if (k === '--corpus') o.corpus.push(val()); else if (k === '--lot') o.lot = val();
    else if (k === '--echo') o.echo.push(val()); else if (k === '--juges') o.juges = val(); else if (k === '--profil') o.profil = val(); else if (k === '--parametres') o.parametres = val();
    else if (k === '--sortie') o.sortie = val(); else throw Error('argument inconnu : ' + k);
  }
  if (!o.partie || !o.journal || !o.corpus.length || !o.lot || !(o.echo.length || o.juges) || !o.sortie) throw Error('usage : voir l\'en-tête');
  return o;
}

/* Diagnostic pur d'un cas (`casDuDiffere`) et de sa décision contre la pose de l'opérateur (décalages mm depuis la même pose de départ). */
function diagnostiquer(k, d, mic, regle = L1.REGLE) {
  const p = d.probas, out = { cut: k.cut, zone: k.zone, gMed: k.gMed, G0: k.G0, etat: d.etat, motif: d.motif ?? null, pChoisie: d.p, hypothese: d.hypothese ?? null, juge: !!mic };
  out.choix = d.paire ? { left: d.paire.left.decal, right: d.paire.right.decal } : null;
  out.signe = signeEcartement(k);
  if (!mic) { out.rails = Object.fromEntries(SIDES.map(s => [s, { n: k.rails[s].hyps.length, hyps: k.rails[s].hyps.map((h, i) => ({ decal: h.decal, p: arrondi(p[s][i], 4), o: h.origines.join('+'), g: arrondi(h.g, 1) })) }])); return out; }
  out.micDecal = mic;
  out.departMm = arrondi(Math.max(...SIDES.map(s => Math.hypot(...mic[s]))), 1);
  const rails = {};
  for (const s of SIDES) {
    const hs = k.rails[s].hyps.map((h, i) => ({ i, decal: h.decal, p: p[s][i], origines: h.origines, sous: h.sousOrigines, hauteur: h.hauteur, g: h.g, e: dist(h.decal, mic[s]) }));
    const parP = hs.slice().sort((a, b) => b.p - a.p);
    const proche = hs.slice().sort((a, b) => a.e - b.e)[0];
    rails[s] = { n: hs.length, proche: { e: arrondi(proche.e, 1), decal: proche.decal, p: arrondi(proche.p, 4), rangP: parP.indexOf(proche) + 1, origines: proche.origines, sous: proche.sous, hauteur: proche.hauteur },
      meilleureP: { e: arrondi(parP[0].e, 1), decal: parP[0].decal, p: arrondi(parP[0].p, 4), origines: parP[0].origines }, hyps: hs.map(h => ({ decal: h.decal, p: arrondi(h.p, 4), e: arrondi(h.e, 1), o: h.origines.join('+'), g: arrondi(h.g, 1) })) };
  }
  out.rails = rails;
  out.atteignable10 = SIDES.every(s => rails[s].proche.e <= 10);
  /* Paire choisie. */
  if (d.paire) out.erreurChoisie = arrondi(Math.max(...SIDES.map(s => dist(d.paire[s].decal, mic[s]))), 1);
  /* Meilleure paire atteignable (erreur la plus petite) et son statut par rapport à la règle d'écartement. */
  let best = null;
  const Lh = k.rails.left.hyps, Rh = k.rails.right.hyps;
  for (let i = 0; i < Lh.length; i++) for (let j = 0; j < Rh.length; j++) {
    const e = Math.max(dist(Lh[i].decal, mic.left), dist(Rh[j].decal, mic.right));
    if (!best || e < best.e) {
      const g = L1.ecartementPaire(k, Lh[i], Rh[j]);
      const permise = fini(g) && ((fini(k.gMed) && Math.abs(g - k.gMed) <= regle.ecartementMedianeMm) || (g >= regle.contratMm[0] && g <= regle.contratMm[1]));
      best = { e, i, j, g, permise, v: p.left[i] * p.right[j] };
    }
  }
  out.oracle = best ? { e: arrondi(best.e, 1), g: arrondi(best.g, 1), permise: best.permise, p: arrondi(best.v, 4), left: Lh[best.i].decal, right: Rh[best.j].decal } : null;
  /* Écartement de la pose de l'opérateur, au sens de `ecartementPaire` (même approximation). */
  out.micEcartementApprox = fini(k.G0) ? arrondi(k.G0 + (mic.left[1] - mic.right[1]) * signeEcartement(k), 1) : null;
  return out;
}
/* Écartement approché d'une paire de décalages (premier ordre, en travers). */
function ecartementApprox(k, decal) {
  if (!fini(k.G0)) return null;
  const s = side => { const Lh = k.rails[side].hyps, i0 = k.i0[side];
    for (let i = 0; i < Lh.length; i++) { if (i === i0 || !fini(Lh[i].g) || !fini(Lh[i0] && Lh[i0].g)) continue; const dl = Lh[i].decal[1] - Lh[i0].decal[1]; if (Math.abs(dl) > 5) return Math.sign((Lh[i].g - Lh[i0].g) / dl) || 1; }
    return side === 'left' ? 1 : -1; };
  return k.G0 + s('left') * decal.left[1] + s('right') * decal.right[1];
}
/* Signe de la variation d'écartement quand le latéral gauche moins le latéral droit augmente, lu sur les hypothèses du cas. */
function signeEcartement(k) {
  const Lh = k.rails.left.hyps, i0 = k.i0.left;
  for (let i = 0; i < Lh.length; i++) {
    if (i === i0 || !fini(Lh[i].g) || !fini(Lh[i0] && Lh[i0].g)) continue;
    const dl = Lh[i].decal[1] - Lh[i0].decal[1];
    if (Math.abs(dl) > 5) return Math.sign((Lh[i].g - Lh[i0].g) / dl);
  }
  return 1;
}

/* Soutien du nuage (points de dessus et de flanc) de chaque hypothèse et de chaque rail ramené à l'écartement de convention (src/gcv2-l1e.js),
 * par clé `rail|latéral|vertical` (mm, 2 décimales). */
const cleSoutien = (s, d) => `${s}|${d[1].toFixed(2)}|${d[2].toFixed(2)}`;
function soutiens(capture, cas) {
  const out = {}, voir = (s, d) => { const k = cleSoutien(s, d); if (!(k in out)) { const m = L1.soutienRail(capture, s, d); out[k] = [m.dessus, m.flanc]; } };
  for (const s of SIDES) for (const h of cas.rails[s].hyps) voir(s, h.decal);
  for (const k of E.candidats(cas, E.REGLAGE_DEFAUT)) if (k.ramenee) voir(k.rail, k.paire[k.rail]);
  return out;
}
/* Poses de l'opérateur lues dans un fichier `cuts-*.jsonl` (différés jugés par tools/diag-differes.cjs). */
function micDesJuges(fichier, partie, lot) {
  const D = require('./diag-differes.cjs'), out = new Map();
  for (const l of fs.readFileSync(fichier, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    const o = JSON.parse(l);
    if (o.type !== 'differe' || o.partie !== partie || !String(lot).startsWith(o.lot) || o.temoin || !D.juge(o)) continue;
    out.set(o.cut, { rails: o.mic.rails, ecartDepartMm: o.depart && fini(o.depart.ecartementMm) ? o.depart.ecartementMm : null });
  }
  return out;
}

function main(argv) {
  const a = args(argv), log = m => process.stderr.write(m + '\n');
  const parametres = JSON.parse(fs.readFileSync(a.parametres || require('node:path').join(__dirname, '../datasets/gcv2-parametres-h6.json'), 'utf8'));
  const j = JSON.parse(fs.readFileSync(a.journal, 'utf8')), R = B.lotReel(j, a.partie, a.lot), ids = R.lot.cuts.map(c => c.captureId).filter(Boolean);
  const captures = B.chargerCaptures(a.corpus, ids);
  log(`captures retrouvées : ${captures.size}/${ids.length}`);
  const vus = new Map(), orig = L1.deciderDiffere;
  L1.deciderDiffere = function (x) { const g = orig.call(this, x); vus.set(x.capture.identity.cut, { ...g, capture: x.capture }); return g; };
  let lignes;
  try { lignes = B.rejouerLot({ journal: j, captures, projet: a.projet, partie: a.partie, lotId: a.lot, parametres, profils: [a.profil], journalTexte: log }); }
  finally { L1.deciderDiffere = orig; }
  const cuts = [...vus.keys()];
  const mic = a.juges ? micDesJuges(a.juges, `${a.projet}:${a.partie}`, a.lot) : P.micDepuisEcho(a.echo, a.partie, cuts);
  const out = [], compte = { examines: cuts.length, juges: 0, sansMic: 0, departDifferent: 0, traites: lignes.length - 1 };
  for (const c of cuts) {
    const g = vus.get(c), m = mic.get(c);
    let rails = null;
    if (!m || !m.rails) compte.sansMic++;
    else if (fini(m.ecartDepartMm) && fini(g.cas.G0) && Math.abs(m.ecartDepartMm - g.cas.G0) > 2) {
      /* Le lot a posé ce cut (pose de la GCV2) : l'Écho part de cette pose. Si l'écartement de départ de l'Écho est celui de la paire posée
       * (2 mm), la pose de l'opérateur depuis la pose de départ du lot est la paire posée plus sa correction (même repère au premier ordre). */
      const P0 = g.decision.paire, gP = P0 ? ecartementApprox(g.cas, { left: P0.left.decal, right: P0.right.decal }) : null;
      if (P0 && g.decision.etat !== 'rien' && fini(gP) && Math.abs(gP - m.ecartDepartMm) <= 2) {
        compte.juges++; compte.depuisPoseL1 = (compte.depuisPoseL1 || 0) + 1;
        rails = Object.fromEntries(SIDES.map(s => [s, P0[s].decal.map((v, i) => Math.round((v + m.rails[s][i]) * 100) / 100)]));
      } else compte.departDifferent++;
    }
    else { compte.juges++; rails = m.rails; }
    const o = { partie: `${a.projet}:${a.partie}`, lot: a.lot, ...diagnostiquer(g.cas, g.decision, rails), ligne: (lignes.find(l => l.cut === c) || {}).profils?.[a.profil]?.etat ?? null };
    o.soutiens = soutiens(g.capture, o);
    out.push(o);
  }
  fs.writeFileSync(a.sortie, out.map(x => JSON.stringify(x)).join('\n') + '\n');
  process.stdout.write(JSON.stringify(compte) + '\n');
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); } }
module.exports = { diagnostiquer, signeEcartement, soutiens, cleSoutien };
