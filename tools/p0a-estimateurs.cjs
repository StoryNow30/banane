#!/usr/bin/env node
'use strict';
/*
 * p0a-estimateurs.cjs — mesure P0(a) du plan 5.0 : graine contre intersection contre moyenne, par classe de rail.
 * Hors ligne, lecture seule, rien sous src/.
 *
 *   node tools/p0a-estimateurs.cjs --lignes lignes-A.json [lignes-B.json …] [--ensemble] [--sortie res.json] [--json]
 *   node tools/p0a-estimateurs.cjs --journal J.json --jointure table.json --corpus DOSSIER [--etiquette NOM]
 *
 * Contexte (idée 3 du cahier 5.0, D-115 constat 3). `Candidate.propose` calcule deux positions du gabarit par
 * rail : la GRAINE (`metrics.seed`, meilleur minimum de perte du gabarit complet, c'est ce que le moteur publie) et
 * l'INTERSECTION des deux nappes ajustées (`metrics.surfaceIntersection`, plan de roulement × flanc, gardée en
 * diagnostic). Une troisième estimation, la MOYENNE des deux, est ajoutée. Personne n'avait mesuré laquelle est la
 * plus proche de la pose finale de l'opérateur.
 *
 * Mesure : pour chaque rail rejoué par `Candidate.propose` (même configuration que l'ombre) et référencé par l'opérateur,
 * l'erreur latérale et verticale de chaque estimateur à la pose finale de l'opérateur (mm, repère profil de la pose de
 * départ), puis l'erreur 2D. Trois lectures :
 *  - brute : le biais de convention (+ 1 mm dessus, − 2,6 mm flanc, appliqué APRÈS l'estimateur) n'y est pas ôté ;
 *  - centrée : on retranche à chaque estimateur sa propre médiane signée de la classe, ce qui isole la dispersion
 *    (un biais constant se corrige par la convention, pas par le choix de l'estimateur) ;
 *  - appariée : différence d'erreur 2D rail par rail contre la graine, médiane et son intervalle à 95 %, test des signes.
 * Les classes sont celles du soutien de flanc (`metrics.faceCount` : fort ≥ 6, partiel 3 à 5, nul < 3) et du rôle
 * du rail dans le lot (publié au premier passage, différé). La classe « passage à niveau » n'est pas faisable : les
 * numéros de cuts de passages à niveau ne sont pas encore connus (question 3 du cahier).
 * Enfin |graine − intersection| est jugé comme TRAIT de doute (aire sous la courbe ROC contre « la pose publiée est
 * corrigée de plus de 10 mm par l'opérateur »), pour la décision P5 s'il n'y a pas de gagnant.
 */
const fs = require('node:fs');
const P = require('./p0-commun.cjs');

const { fini, arrondi, quantile } = P;
const MIN_FLANC_FORT = 6, MIN_FLANC_PARTIEL = 3;

const ESTIMATEURS = {
  graine: l => l.propose.graineMm,
  intersection: l => l.propose.interMm,
  moyenne: l => [(l.propose.graineMm[0] + l.propose.interMm[0]) / 2, (l.propose.graineMm[1] + l.propose.interMm[1]) / 2],
};
const NOMS = Object.keys(ESTIMATEURS);

const utilisable = l => !!(l && l.ok && l.propose && l.propose.metriques && l.humainMm && l.propose.graineMm && l.propose.interMm);
function erreur2D(l, estimateur) {
  const e = ESTIMATEURS[estimateur](l);
  const lat = e[0] - l.humainMm[1], vert = e[1] - l.humainMm[2];
  return { lat, vert, d2: Math.hypot(lat, vert) };
}
const classeFlanc = l => l.propose.pointsFlanc >= MIN_FLANC_FORT ? 'flanc fort (≥ 6 points)' : l.propose.pointsFlanc >= MIN_FLANC_PARTIEL ? 'flanc partiel (3 à 5)' : 'flanc nul (< 3)';
const role = l => l.decision ? (l.decision.etage === 'first-pass' ? 'publié au premier passage' : l.decision.etage === 'deferred' ? 'cut différé' : 'posé par un autre étage') : 'cut hors journal (rejeu)';

function statsClasse(rails) {
  const out = { n: rails.length, estimateurs: {} };
  if (!rails.length) return out;
  const e = Object.fromEntries(NOMS.map(n => [n, rails.map(l => erreur2D(l, n))]));
  for (const n of NOMS) {
    const lat = e[n].map(x => x.lat), vert = e[n].map(x => x.vert), d2 = e[n].map(x => x.d2);
    const bl = quantile(lat, .5), bv = quantile(vert, .5);
    const centre = e[n].map(x => Math.hypot(x.lat - bl, x.vert - bv));
    out.estimateurs[n] = {
      latSigneMedianMm: arrondi(bl), vertSigneMedianMm: arrondi(bv),
      d2MedianeMm: arrondi(quantile(d2, .5)), d2P90Mm: arrondi(quantile(d2, .9)), plus5: P.compte(d2, 5), plus10: P.compte(d2, 10),
      d2CentreMedianeMm: arrondi(quantile(centre, .5)), d2CentreP90Mm: arrondi(quantile(centre, .9)),
    };
    if (n !== 'graine') {
      const diff = e[n].map((x, i) => x.d2 - e.graine[i].d2);
      const cent = (() => { const g = e.graine, blg = quantile(g.map(x => x.lat), .5), bvg = quantile(g.map(x => x.vert), .5);
        return e[n].map((x, i) => Math.hypot(x.lat - bl, x.vert - bv) - Math.hypot(g[i].lat - blg, g[i].vert - bvg)); })();
      out.estimateurs[n].contreGraine = { diffMedianeMm: arrondi(quantile(diff, .5)), ic95: P.icMediane(diff), signes: P.testeSignes(diff, 0.05),
        diffCentreeMedianeMm: arrondi(quantile(cent, .5)), ic95Centree: P.icMediane(cent), signesCentres: P.testeSignes(cent, 0.05) };
    }
  }
  const ecart = rails.map(l => Math.hypot(l.propose.graineMm[0] - l.propose.interMm[0], l.propose.graineMm[1] - l.propose.interMm[1]));
  out.ecartGraineIntersectionMm = { mediane: arrondi(quantile(ecart, .5)), p90: arrondi(quantile(ecart, .9)), plus3: P.compte(ecart, 3), plus5: P.compte(ecart, 5) };
  return out;
}

function analyserJeu(lignes) {
  const rails = lignes.filter(utilisable);
  const res = { rails: lignes.length, railsAvecMesuresEtReference: rails.length };
  res.parClasseFlanc = {};
  for (const c of [...new Set(rails.map(classeFlanc))].sort()) res.parClasseFlanc[c] = statsClasse(rails.filter(l => classeFlanc(l) === c));
  res.parRole = {};
  for (const c of [...new Set(rails.map(role))].sort()) res.parRole[c] = statsClasse(rails.filter(l => role(l) === c));
  res.railsPubliesParLeMoteur = statsClasse(rails.filter(l => l.moteur && l.moteur.statut === 'candidate'));
  res.tous = statsClasse(rails);
  /* Trait de doute : |graine − intersection| contre « la pose publiée est corrigée de plus de 10 mm ». */
  const pub = rails.filter(l => l.moteur && l.moteur.statut === 'candidate' && l.moteur.deltaPublieMm && l.decision && l.decision.etage === 'first-pass');
  const err = pub.map(l => P.erreurDelta(l.moteur.deltaPublieMm, l.humainMm));
  const ecart = pub.map(l => Math.hypot(l.propose.graineMm[0] - l.propose.interMm[0], l.propose.graineMm[1] - l.propose.interMm[1]));
  res.traitDeDoute = {
    rails: pub.length, corrigesPlus10: err.filter(e => e.d3 > 10).length,
    aucEcartGraineIntersection: P.auc(ecart, err.map(e => e.d3 > 10)),
    aucPointsFlancBas: P.auc(pub.map(l => -l.propose.pointsFlanc), err.map(e => e.d3 > 10)),
    aucPenteFlanc: P.auc(pub.map(l => Math.abs(l.propose.penteFlanc ?? NaN)), err.map(e => e.d3 > 10)),
    mediane: { ecartSiCorrigePlus10: arrondi(quantile(ecart.filter((_, i) => err[i].d3 > 10), .5)), ecartSinon: arrondi(quantile(ecart.filter((_, i) => err[i].d3 <= 10), .5)) },
  };
  return res;
}

function analyser(lignes, { ensemble = false } = {}) {
  const jeux = new Map();
  for (const l of lignes) { const k = l.etiquette || 'jeu'; if (!jeux.has(k)) jeux.set(k, []); jeux.get(k).push(l); }
  if (ensemble && jeux.size > 1) jeux.set('ensemble', lignes);
  const out = { format: 'ariane-p0a-v1', creeLe: new Date().toISOString(), regles: { flanc: { fort: MIN_FLANC_FORT, partiel: MIN_FLANC_PARTIEL } }, jeux: {} };
  for (const [k, v] of jeux) out.jeux[k] = analyserJeu(v);
  return out;
}

const f1 = v => v === null || v === undefined ? '–' : String(v).replace('.', ',');
function ligneClasse(nom, s) {
  if (!s.n) return [`  ${nom} : aucun rail`];
  const L = [`  ${nom} (n=${s.n}) ; écart graine–intersection médian ${f1(s.ecartGraineIntersectionMm.mediane)} mm, > 5 mm sur ${s.ecartGraineIntersectionMm.plus5}`];
  for (const n of NOMS) {
    const e = s.estimateurs[n];
    let c = '';
    if (e.contreGraine) {
      const g = e.contreGraine;
      c = ` | vs graine : Δ médiane ${f1(g.diffMedianeMm)} [${g.ic95 ? g.ic95.map(f1).join(' ; ') : '–'}], mieux ${g.signes.gagne} / pire ${g.signes.perd}, p=${f1(g.signes.p)} ; centré Δ ${f1(g.diffCentreeMedianeMm)}, p=${f1(g.signesCentres.p)}`;
    }
    L.push(`    ${n.padEnd(13)} lat ${f1(e.latSigneMedianMm)} vert ${f1(e.vertSigneMedianMm)} (signés) | 2D méd ${f1(e.d2MedianeMm)} P90 ${f1(e.d2P90Mm)} >5 ${e.plus5} >10 ${e.plus10} | centré méd ${f1(e.d2CentreMedianeMm)} P90 ${f1(e.d2CentreP90Mm)}${c}`);
  }
  return L;
}
function texte(r) {
  const L = [];
  for (const [k, j] of Object.entries(r.jeux)) {
    L.push(`=== ${k} : ${j.rails} rails, ${j.railsAvecMesuresEtReference} avec mesures et pose de l'opérateur ===`);
    L.push(...ligneClasse('tous les rails', j.tous));
    L.push(...ligneClasse('rails publiés par le moteur', j.railsPubliesParLeMoteur));
    L.push('Par classe de flanc :');
    for (const [c, s] of Object.entries(j.parClasseFlanc)) L.push(...ligneClasse(c, s));
    L.push('Par rôle dans le lot :');
    for (const [c, s] of Object.entries(j.parRole)) L.push(...ligneClasse(c, s));
    const t = j.traitDeDoute;
    L.push(`Trait de doute (rails publiés au premier passage, n=${t.rails}, corrigés > 10 mm : ${t.corrigesPlus10}) : AUC |graine − intersection| ${f1(t.aucEcartGraineIntersection)} ; AUC peu de points de flanc ${f1(t.aucPointsFlancBas)} ; AUC pente brute du flanc ${f1(t.aucPenteFlanc)}. Écart médian ${f1(t.mediane.ecartSiCorrigePlus10)} mm si corrigé, ${f1(t.mediane.ecartSinon)} mm sinon.`);
    L.push('');
  }
  return L.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const sortie = argv.indexOf('--sortie') >= 0 ? argv[argv.indexOf('--sortie') + 1] : null;
  const json = argv.includes('--json'), ensemble = argv.includes('--ensemble');
  const reste = argv.filter((a, i) => !['--json', '--ensemble', '--sortie'].includes(a) && argv[i - 1] !== '--sortie');
  const opt = P.lireArgs(reste);
  if (!opt.lignes.length && !opt.journal && !opt.echo.length) {
    console.error('Usage : node tools/p0a-estimateurs.cjs --lignes lignes.json… [--ensemble] [--sortie res.json] [--json]'); process.exit(1);
  }
  const r = analyser(P.chargerLignes(opt, m => console.error(m)), { ensemble });
  if (sortie) fs.writeFileSync(sortie, JSON.stringify(r, null, 1) + '\n');
  console.log(json ? JSON.stringify(r, null, 1) : texte(r));
}
if (require.main === module) try { main(); } catch (e) { console.error(e.message); process.exitCode = 1; }

module.exports = { ESTIMATEURS, erreur2D, classeFlanc, role, statsClasse, analyserJeu, analyser, texte };
