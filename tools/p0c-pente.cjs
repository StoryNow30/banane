#!/usr/bin/env node
'use strict';
/*
 * p0c-pente.cjs — mesure P0(c) du plan 5.0 : erreur des rails appliqués par tranche de pente brute du flanc.
 * Hors ligne, lecture seule, rien sous src/.
 *
 *   node tools/p0c-pente.cjs --lignes lignes-A.json [lignes-B.json …] [--ensemble] [--sortie res.json] [--json]
 *   node tools/p0c-pente.cjs --journal J.json [--jointure table.json] --corpus DOSSIER [--etiquette NOM]
 *
 * Contexte (idée 5 du cahier 5.0). `robustLine` borne la pente d'une nappe à ±0,5 et `slopeLimited` déclenche
 * l'abstention « Inclinaison estimée hors du domaine du modèle ». La pente du flanc vient d'une bande de 9 à 34 mm
 * sous le dessus, qui attrape le congé du champignon : ce n'est pas une droite. La pente ne sert qu'à refuser : le
 * delta publié est la graine du gabarit. La question : un rail dont la pente brute du flanc est de 0,3 à 0,5 est-il
 * moins juste qu'un rail à pente plus faible ? et que vaudrait la graine d'un rail refusé (> 0,5) ?
 *
 * Mesure, par tranche de |pente brute du flanc| (`Candidate.propose.face.rawSlope`) :
 *  - rails APPLIQUÉS (publiés au premier passage) : erreur à la pose finale de l'opérateur de la pose publiée (graine + S1 +
 *    convention) et de la graine seule ;
 *  - tous les rails rejoués (publiés ou refusés) : erreur de la graine (ce que le moteur publierait si la pente ne
 *    refusait pas), la seule lecture possible pour les rails refusés ;
 *  - comparaison des tranches (aire sous la courbe : probabilité qu'un rail de la tranche haute ait une plus grande erreur) ;
 *  - variante de l'idée 5 : pente recalculée sur la seule bande 14 à 30 mm (mêmes tranches).
 * Comptes mécaniques (sans pose de l'opérateur) : cuts différés pour « pente » et ceux dont seule la pente du flanc
 * empêche de publier un rail, pour la porte du cahier (≥ 40 des 68).
 */
const fs = require('node:fs');
const P = require('./p0-commun.cjs');

const { fini, arrondi, quantile } = P;
const TRANCHES = [[0, .1], [.1, .2], [.2, .3], [.3, .4], [.4, .5], [.5, Infinity]];
const nomTranche = ([a, b]) => b === Infinity ? `> ${String(a).replace('.', ',')}` : `${String(a).replace('.', ',')}–${String(b).replace('.', ',')}`;
const LIMITE = .5;
const MESSAGE_PENTE = 'Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée.';

const avecMesures = l => !!(l && l.ok && l.propose && l.propose.metriques && fini(l.propose.penteFlanc));
/* Indice de tranche : [0 ; 0,1[ … [0,4 ; 0,5] puis ]0,5 ; ∞[ (la borne du moteur, 0,5, est incluse dans la dernière tranche acceptée). */
const indiceTranche = x => x > LIMITE ? TRANCHES.length - 1 : Math.min(TRANCHES.length - 2, Math.floor(x / .1 + 1e-9));
/* Rail appliqué : publié au premier passage (journal) ; sans journal (rejeu d'un Écho), rail que le moteur aurait publié. */
const appliquee = l => !!(l.moteur && l.moteur.statut === 'candidate' && l.moteur.deltaPublieMm && (l.decision ? l.decision.etage === 'first-pass' : true));

function erreurGraine(l) {
  const lat = l.propose.graineMm[0] - l.humainMm[1], vert = l.propose.graineMm[1] - l.humainMm[2];
  return { lat, vert, d2: Math.hypot(lat, vert) };
}
function statsErreurs(e) {
  const d = e.map(x => x.d2 !== undefined ? x.d2 : x.d3);
  return { n: e.length, medianeMm: arrondi(quantile(d, .5)), p90Mm: arrondi(quantile(d, .9)), plus5: P.compte(d, 5), plus10: P.compte(d, 10),
    latSigneMm: arrondi(quantile(e.map(x => x.lat), .5)), vertSigneMm: arrondi(quantile(e.map(x => x.vert), .5)) };
}

function tableTranches(rails, pente) {
  return TRANCHES.map((t, i) => {
    const sel = rails.filter(l => indiceTranche(Math.abs(pente(l))) === i);
    const vrai = sel.filter(l => l.humainMm);
    const app = vrai.filter(appliquee);
    return {
      tranche: nomTranche(t), rails: sel.length, avecReference: vrai.length,
      appliques: { n: app.length, publiee: statsErreurs(app.map(l => P.erreurDelta(l.moteur.deltaPublieMm, l.humainMm))), graine: statsErreurs(app.map(erreurGraine)) },
      tousRails: statsErreurs(vrai.map(erreurGraine)),
    };
  });
}

/* Probabilité qu'un rail du groupe haut ait une plus grande erreur qu'un rail du groupe bas (0,5 = pas de différence). */
function comparer(bas, haut) {
  if (!bas.length || !haut.length) return null;
  const a = P.auc([...bas, ...haut], [...bas.map(() => false), ...haut.map(() => true)]);
  return { nBas: bas.length, nHaut: haut.length, medianeBasMm: arrondi(quantile(bas, .5)), medianeHautMm: arrondi(quantile(haut, .5)), icBas: P.icMediane(bas), icHaut: P.icMediane(haut),
    plus10Bas: P.compte(bas, 10), plus10Haut: P.compte(haut, 10), auc: a };
}

function analyserJeu(lignes) {
  const rails = lignes.filter(avecMesures);
  const res = { rails: lignes.length, railsAvecMesures: rails.length };
  const x = rails.map(l => Math.abs(l.propose.penteFlanc));
  res.distributionPenteFlanc = { mediane: arrondi(quantile(x, .5), 3), p90: arrondi(quantile(x, .9), 3), p99: arrondi(quantile(x, .99), 3), plus03: P.compte(x, .3), plus05: P.compte(x, LIMITE) };
  const xb = rails.filter(l => fini(l.propose.penteFlancBande14_30)).map(l => Math.abs(l.propose.penteFlancBande14_30));
  res.distributionPenteBande14_30 = { n: xb.length, mediane: arrondi(quantile(xb, .5), 3), p90: arrondi(quantile(xb, .9), 3), plus03: P.compte(xb, .3), plus05: P.compte(xb, LIMITE) };
  res.tranchesPenteBrute = tableTranches(rails, l => l.propose.penteFlanc);
  res.tranchesPenteBande14_30 = tableTranches(rails.filter(l => fini(l.propose.penteFlancBande14_30)), l => l.propose.penteFlancBande14_30);

  /* Comparaisons de l'erreur de la graine entre tranches (tous rails avec pose de l'opérateur). */
  const vrai = rails.filter(l => l.humainMm);
  const g = (f) => vrai.filter(f).map(l => erreurGraine(l).d2);
  const p = l => Math.abs(l.propose.penteFlanc);
  res.comparaisons = {
    'pente < 0,3 puis 0,3–0,5 (graine, tous rails)': comparer(g(l => p(l) < .3), g(l => p(l) >= .3 && p(l) <= LIMITE)),
    'pente ≤ 0,5 puis > 0,5 (graine, tous rails)': comparer(g(l => p(l) <= LIMITE), g(l => p(l) > LIMITE)),
    'pente < 0,3 puis > 0,5 (graine, tous rails)': comparer(g(l => p(l) < .3), g(l => p(l) > LIMITE)),
  };
  const app = vrai.filter(appliquee);
  const pubErr = (f) => app.filter(f).map(l => P.erreurDelta(l.moteur.deltaPublieMm, l.humainMm).d3);
  res.comparaisons['pente < 0,3 puis 0,3–0,5 (pose publiée, rails appliqués)'] = comparer(pubErr(l => p(l) < .3), pubErr(l => p(l) >= .3 && p(l) <= LIMITE));

  /* Rails dont SEULE la pente du flanc empêche de publier (le dessus n'est pas en cause), avec ce que vaudrait leur graine. */
  const seulementPente = l => l.propose.statut !== 'candidate' && l.propose.raison === MESSAGE_PENTE && l.propose.penteFlancLimitee && !l.propose.penteDessusLimitee;
  const sp = rails.filter(seulementPente);
  const spVrai = sp.filter(l => l.humainMm);
  res.railsRefusesParLaSeulePenteDuFlanc = {
    n: sp.length, avecReference: spVrai.length,
    graine: statsErreurs(spVrai.map(erreurGraine)),
    avecBande14_30: { sousLaLimite: sp.filter(l => fini(l.propose.penteFlancBande14_30) && Math.abs(l.propose.penteFlancBande14_30) <= LIMITE).length,
      graineDeCeuxLa: statsErreurs(spVrai.filter(l => fini(l.propose.penteFlancBande14_30) && Math.abs(l.propose.penteFlancBande14_30) <= LIMITE).map(erreurGraine)) },
  };

  /* Comptes mécaniques sur les cuts différés (journal). */
  const cuts = new Map();
  for (const l of lignes) {
    const k = `${l.partie}|${l.cut}`;
    if (!cuts.has(k)) cuts.set(k, { decision: l.decision, rails: [] });
    cuts.get(k).rails.push(l);
  }
  const differes = [...cuts.values()].filter(c => c.decision && c.decision.etage === 'deferred');
  const pente = c => c.rails.some(l => l.ok && l.moteur && (l.moteur.motif === 'slope' || (l.moteur.statut !== 'candidate' && l.propose && l.propose.raison === MESSAGE_PENTE)));
  const dp = differes.filter(pente);
  const flancSeul = c => c.rails.every(l => !l.ok || (l.moteur && l.moteur.statut === 'candidate') || seulementPente(l));
  const bandeOk = c => c.rails.every(l => !l.ok || (l.moteur && l.moteur.statut === 'candidate') || (seulementPente(l) && fini(l.propose.penteFlancBande14_30) && Math.abs(l.propose.penteFlancBande14_30) <= LIMITE));
  res.cutsDifferes = {
    total: differes.length, motifPente: dp.length,
    dontLaSeulePenteDuFlancBloque: dp.filter(flancSeul).length,
    dontPenteDeLaBandeSousLaLimite: dp.filter(bandeOk).length,
    avecReferenceAuxDeuxRails: dp.filter(flancSeul).filter(c => c.rails.every(l => l.humainMm)).length,
  };
  /* Si la borne du flanc était levée, la graine de ces cuts serait posée : erreur à l'opérateur quand elle est connue. */
  const leves = dp.filter(flancSeul).filter(c => c.rails.every(l => l.humainMm && l.propose && l.propose.metriques));
  res.cutsDifferes.graineSiBorneLevee = {
    cuts: leves.length,
    erreurDuPireRail: statsErreurs(leves.map(c => ({ d2: Math.max(...c.rails.map(l => (l.moteur && l.moteur.statut === 'candidate' ? P.erreurDelta(l.moteur.deltaBrutMm, l.humainMm) : erreurGraine(l)).d3 ?? erreurGraine(l).d2)), lat: 0, vert: 0 }))),
  };
  return res;
}

function analyser(lignes, { ensemble = false } = {}) {
  const jeux = new Map();
  for (const l of lignes) { const k = l.etiquette || 'jeu'; if (!jeux.has(k)) jeux.set(k, []); jeux.get(k).push(l); }
  if (ensemble && jeux.size > 1) jeux.set('ensemble', lignes);
  const out = { format: 'ariane-p0c-v1', creeLe: new Date().toISOString(), regles: { limitePente: LIMITE, tranches: TRANCHES.map(nomTranche) }, jeux: {} };
  for (const [k, v] of jeux) out.jeux[k] = analyserJeu(v);
  return out;
}

const f1 = v => v === null || v === undefined ? '–' : String(v).replace('.', ',');
function texte(r) {
  const L = [];
  for (const [k, j] of Object.entries(r.jeux)) {
    const d = j.distributionPenteFlanc, b = j.distributionPenteBande14_30;
    L.push(`=== ${k} : ${j.rails} rails, ${j.railsAvecMesures} avec mesures ===`);
    L.push(`|Pente brute du flanc| : médiane ${f1(d.mediane)}, P90 ${f1(d.p90)}, P99 ${f1(d.p99)} ; > 0,3 : ${d.plus03} rails, > 0,5 : ${d.plus05}. Bande 14–30 mm : médiane ${f1(b.mediane)}, P90 ${f1(b.p90)}, > 0,5 : ${b.plus05} sur ${b.n}.`);
    const tab = (titre, t) => {
      L.push(titre);
      for (const x of t) L.push(`  ${x.tranche.padEnd(8)} rails ${String(x.rails).padStart(3)} (réf. ${String(x.avecReference).padStart(3)}) | appliqués n=${String(x.appliques.n).padStart(3)} pose publiée 3D méd ${f1(x.appliques.publiee.medianeMm)} P90 ${f1(x.appliques.publiee.p90Mm)} >10: ${x.appliques.publiee.plus10}; graine méd ${f1(x.appliques.graine.medianeMm)} >10: ${x.appliques.graine.plus10} | tous: graine 2D méd ${f1(x.tousRails.medianeMm)} P90 ${f1(x.tousRails.p90Mm)} >5: ${x.tousRails.plus5} >10: ${x.tousRails.plus10} (n=${x.tousRails.n})`);
    };
    tab('Par tranche de pente brute du flanc :', j.tranchesPenteBrute);
    tab('Par tranche de pente sur la bande 14–30 mm :', j.tranchesPenteBande14_30);
    L.push('Comparaisons « groupe bas puis groupe haut » (erreur en mm ; AUC = probabilité qu\'un rail du groupe haut soit plus erroné qu\'un rail du groupe bas, 0,5 = aucune différence) :');
    for (const [n, c] of Object.entries(j.comparaisons)) L.push(c ? `  ${n} : bas n=${c.nBas} méd ${f1(c.medianeBasMm)} [${(c.icBas || []).map(f1).join(' ; ')}] > 10 mm ${c.plus10Bas} ; haut n=${c.nHaut} méd ${f1(c.medianeHautMm)} [${(c.icHaut || []).map(f1).join(' ; ')}] > 10 mm ${c.plus10Haut} ; AUC ${f1(c.auc)}` : `  ${n} : effectif insuffisant`);
    const s = j.railsRefusesParLaSeulePenteDuFlanc;
    L.push(`Rails refusés par la seule pente du flanc : ${s.n} (avec l'opérateur : ${s.avecReference}) ; erreur de leur graine 2D méd ${f1(s.graine.medianeMm)} P90 ${f1(s.graine.p90Mm)} >5: ${s.graine.plus5} >10: ${s.graine.plus10}. Sous la limite sur la bande 14–30 : ${s.avecBande14_30.sousLaLimite} (graine méd ${f1(s.avecBande14_30.graineDeCeuxLa.medianeMm)}, >10: ${s.avecBande14_30.graineDeCeuxLa.plus10} sur ${s.avecBande14_30.graineDeCeuxLa.n}).`);
    const c = j.cutsDifferes;
    L.push(`Cuts différés : ${c.total} ; motif pente : ${c.motifPente} ; dont la seule pente du flanc bloque : ${c.dontLaSeulePenteDuFlancBloque} ; dont pente de la bande 14–30 sous la limite : ${c.dontPenteDeLaBandeSousLaLimite} ; avec l'opérateur aux deux rails : ${c.avecReferenceAuxDeuxRails}. Si la borne était levée : ${c.graineSiBorneLevee.cuts} cuts avec l'opérateur, pire rail 3D/2D méd ${f1(c.graineSiBorneLevee.erreurDuPireRail.medianeMm)} >10 mm: ${c.graineSiBorneLevee.erreurDuPireRail.plus10}.`);
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
    console.error('Usage : node tools/p0c-pente.cjs --lignes lignes.json… [--ensemble] [--sortie res.json] [--json]'); process.exit(1);
  }
  const r = analyser(P.chargerLignes(opt, m => console.error(m)), { ensemble });
  if (sortie) fs.writeFileSync(sortie, JSON.stringify(r, null, 1) + '\n');
  console.log(json ? JSON.stringify(r, null, 1) : texte(r));
}
if (require.main === module) try { main(); } catch (e) { console.error(e.message); process.exitCode = 1; }

module.exports = { TRANCHES, tableTranches, comparer, analyserJeu, analyser, texte, erreurGraine };
