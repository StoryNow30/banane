#!/usr/bin/env node
'use strict';
/*
 * coherence-voisins.cjs — cohérence des rails posés par Ariane avec leurs voisins posés, et score de suspicion
 * par cut (chantier M6 du plan 5.0, idée 8). Outil hors ligne, lecture seule, aucune dépendance, aucune
 * coordonnée en sortie (que des millimètres et des numéros de cut).
 *
 *   node tools/coherence-voisins.cjs --journal <ariane-journal-v4-*.json> [--bilan <ariane-bilan-v4-*.json>]
 *        [--partie N] [--fenetre 3] [--seuil-relire 15] [--seuil-zone 10] [--zone-min 3] [--seuil-score S]
 *        [--jointure table.json [--corrige-mm 10]] [--sortie out.json] [--csv out.csv]
 *
 * Par cut posé par Ariane et par rail : écart à l'interpolation linéaire (par numéro de cut) du plus proche
 * voisin posé avant et du plus proche voisin posé après, dans une fenêtre de ±N cuts. Repère profil local déduit
 * de la direction des voisins : longitudinal = tangente horizontale du segment voisin avant → voisin après
 * (moyenne des deux rails), latéral = horizontale perpendiculaire, vertical = haut de la scène. Si la tangente
 * horizontale est dégénérée (< 20 mm), l'écart n'est donné qu'en distance 3D (repère « 3D ») et c'est elle qui
 * entre dans le score. Un cut sans voisin posé de chaque côté n'a pas d'écart (« sansVoisins ») : son score ne
 * porte que sur les autres termes.
 *
 * Score de suspicion (poids fixés a priori, en « unités de seuil 15 mm ») :
 *   écart voisins / 15 mm  +  excès hors bande d'écartement / 10 mm  +  0,5 si un rail est repêché par S1
 *   +  0,5 · min(1,5 ; |dz| / 10 mm) si un calage de convention est refusé  +  0,5 · max(0 ; 60 − confiance min) / 60.
 * La bande d'écartement est le p5–p95 des écartements posés de la partie (distance 3D entre les deux rails).
 * Un rail repêché par S1 : `gcv1.confidenceStatus` = « non-calibrated-s1-selection » ou `gcv1.changed`.
 * Convention refusée : `gcv1.convention.applied` faux avec une raison (« shift-out-of-domain »…).
 *
 * Liste « à relire » : cuts dont l'écart voisins dépasse --seuil-relire (15 mm), plus les « zones » = suites d'au
 * moins --zone-min (3) cuts posés successifs (écart ≤ fenêtre entre deux numéros) à plus de --seuil-zone (10 mm).
 * Les cuts de score ≥ --seuil-score (1,2 par défaut ; --sans-score pour couper) entrent aussi dans la liste
 * (ensemble « parScore »), plafonnés aux --part-max (5 %) meilleurs scores de la partie.
 *
 * --jointure : table de tools/jointure-echo-orbite.cjs (même partie) ; mesure combien des cuts posés que l'opérateur a
 * corrigés de plus de --corrige-mm (10) sont dans la liste, et donne la courbe seuil de score → rappel / part.
 */
const fs = require('node:fs');
const path = require('node:path');
const J = require('./jointure-echo-orbite.cjs');
const V = require('./lire-volumes.cjs');
const X = require('../src/native-export.js');

const COTES = [['gauche', 'left'], ['droite', 'right']];
const POIDS = { voisins: 1 / 15, bande: 1 / 10, s1: 0.5, convention: 0.5, conventionPlafond: 1.5, confiance: 0.5, confianceRef: 60 };
const SEUIL_SCORE = 1.2, PART_MAX = 0.05;
const TANGENTE_MIN_M = 0.02;
const RUPTURE_M_PAR_CUT = 2.5;
const fini = Number.isFinite;
const vec3 = v => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(fini) ? v.slice(0, 3) : null;
const arr = (v, d = 2) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const quantile = J.quantile;
const stat = J.stat;

/* ------------------------------------------------------------------ lecture */
function lireJournal(fichier) { return J.lireJournal(fichier); }
function lireBilan(fichier) {
  let doc = JSON.parse(V.lire(fichier).toString('utf8'));
  if (doc.dictionaries) doc = X.unfoldRefs(doc, doc.dictionaries);
  const c = doc.closureSummary || {};
  const n = v => Array.isArray(v) ? v.length : fini(v) ? v : null;
  return { termine: c.completed ?? null, differes: n(c.deferred), complesManuellement: n(c.manuallyCompleted), interrompus: n(c.interrupted), statut: c.status ?? null };
}

/* ------------------------------------------------------------------ extraction par cut posé */
/* Signaux de la dernière proposition du moteur pour un cut (par rail). */
function signauxRail(r) {
  if (!r) return null;
  const g = r.gcv1 || {}, cv = g.convention || null;
  const s1 = g.confidenceStatus === 'non-calibrated-s1-selection' || g.changed === true;
  const refusee = !!cv && cv.applied === false && !!cv.reason;
  return {
    s1, confiance: fini(r.confidence) ? r.confidence : null, statut: r.status || null,
    conventionRefusee: refusee, conventionRaison: refusee ? cv.reason : null,
    dzMm: cv && fini(cv.dzMm) ? cv.dzMm : null, duMm: cv && fini(cv.duMm) ? cv.duMm : null,
  };
}
function cutsPoses(journal, partie) {
  const par = J.journalParCut(journal), out = [];
  for (const c of par.values()) {
    if (partie !== null && partie !== undefined && c.partie !== partie) continue;
    const a = J.poseAriane(c);
    if (!a) continue;
    const pos = {}, mat = {};
    for (const [, en] of COTES) { pos[en] = a.posee[en] ? vec3(a.posee[en].positionSceneRelative) : null; mat[en] = a.posee[en] || null; }
    const pr = c.propose && c.propose.proposal && c.propose.proposal.rails;
    const idr = (c.record && c.record.identity) || (c.propose && c.propose.identity) || {};
    out.push({ partie: c.partie, cut: c.cut, frameId: idr.frameId || null, pos, signaux: pr ? { left: signauxRail(pr.left), right: signauxRail(pr.right) } : null });
  }
  out.sort((x, y) => x.partie - y.partie || x.cut - y.cut);
  return out;
}

/* ------------------------------------------------------------------ écart aux voisins */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nrm = d => Math.hypot(d[0], d[1], d[2]);
/* Voisins d'un cut dans la fenêtre : le plus proche posé avant et le plus proche posé après (même partie, même
 * repère de scène). Le repère de scène change à chaque rechargement de la page ESV (`frameId`) : un voisin d'un
 * autre repère n'est pas comparable. Garde en plus : un segment voisin avant → après de plus de RUPTURE_M_PAR_CUT
 * mètres par numéro de cut est une rupture de repère non vue par le frameId (le cut est alors sans voisins). */
function voisinsDe(index, c, fenetre) {
  let av = null, ap = null;
  const memeRepere = v => !v.frameId || !c.frameId || v.frameId === c.frameId;
  for (let d = 1; d <= fenetre; d++) {
    const a = index.get(`${c.partie}|${c.cut - d}`), b = index.get(`${c.partie}|${c.cut + d}`);
    if (!av && a && memeRepere(a)) av = a;
    if (!ap && b && memeRepere(b)) ap = b;
  }
  let rupture = false;
  if (av && ap) {
    for (const [, en] of COTES) if (av.pos[en] && ap.pos[en] && nrm(sub(ap.pos[en], av.pos[en])) > RUPTURE_M_PAR_CUT * (ap.cut - av.cut)) rupture = true;
    if (rupture) { av = null; ap = null; }
  }
  return { av, ap, rupture };
}
/* Écart du cut à l'interpolation de ses voisins, par rail ; null si un voisin manque. */
function ecartVoisins(c, av, ap) {
  if (!av || !ap) return null;
  const t = (c.cut - av.cut) / (ap.cut - av.cut), res = {}, dir = [0, 0];
  for (const [, en] of COTES) if (av.pos[en] && ap.pos[en]) { const d = sub(ap.pos[en], av.pos[en]); dir[0] += d[0]; dir[1] += d[1]; }
  const L = Math.hypot(dir[0], dir[1]), profil = L >= TANGENTE_MIN_M;
  const tg = profil ? [dir[0] / L, dir[1] / L] : null;
  let any = false;
  for (const [fr, en] of COTES) {
    const p = c.pos[en], a = av.pos[en], b = ap.pos[en];
    if (!p || !a || !b) { res[fr] = null; continue; }
    const ref = [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t), d = sub(p, ref);
    any = true;
    res[fr] = profil
      ? { repere: 'profil', longitudinalMm: arr(1000 * (d[0] * tg[0] + d[1] * tg[1])), lateralMm: arr(1000 * (-d[0] * tg[1] + d[1] * tg[0])), verticalMm: arr(1000 * d[2]), dist3dMm: arr(1000 * nrm(d)) }
      : { repere: '3D', longitudinalMm: null, lateralMm: null, verticalMm: null, dist3dMm: arr(1000 * nrm(d)) };
  }
  if (!any) return null;
  res.ecartMm = Math.max(...COTES.map(([fr]) => {
    const e = res[fr]; if (!e) return 0;
    return e.repere === 'profil' ? Math.max(Math.abs(e.lateralMm), Math.abs(e.verticalMm)) : e.dist3dMm;
  }));
  return res;
}

/* ------------------------------------------------------------------ score */
function ecartement(c) { return c.pos.left && c.pos.right ? 1000 * nrm(sub(c.pos.right, c.pos.left)) : null; }
function composantes(ligne, bande) {
  const k = {};
  k.voisins = ligne.ecartVoisinsMm === null ? 0 : ligne.ecartVoisinsMm * POIDS.voisins;
  const e = ligne.ecartementMm;
  ligne.horsBandeMm = e === null || !bande ? 0 : Math.max(0, bande.p5Mm - e, e - bande.p95Mm);
  k.bande = ligne.horsBandeMm * POIDS.bande;
  const sg = ligne.signaux || [];
  k.s1 = sg.some(s => s.s1) ? POIDS.s1 : 0;
  const dz = sg.filter(s => s.conventionRefusee).map(s => Math.abs(s.dzMm ?? 0));
  k.convention = dz.length ? POIDS.convention * Math.min(POIDS.conventionPlafond, Math.max(...dz) / 10) : 0;
  const conf = sg.map(s => s.confiance).filter(fini);
  k.confiance = conf.length ? POIDS.confiance * Math.max(0, POIDS.confianceRef - Math.min(...conf)) / POIDS.confianceRef : 0;
  return k;
}

/* ------------------------------------------------------------------ analyse */
function analyser(journal, options = {}) {
  const fenetre = options.fenetre ?? 3, seuilRelire = options.seuilRelire ?? 15, seuilZone = options.seuilZone ?? 10, zoneMin = options.zoneMin ?? 3;
  const poses = cutsPoses(journal, options.partie);
  const index = new Map(poses.map(c => [`${c.partie}|${c.cut}`, c]));
  /* Bande d'écartement par partie. */
  const bandes = new Map();
  for (const p of new Set(poses.map(c => c.partie))) {
    const e = poses.filter(c => c.partie === p).map(ecartement).filter(fini);
    bandes.set(p, e.length >= 20 ? { p5Mm: arr(quantile(e, .05)), p95Mm: arr(quantile(e, .95)), n: e.length } : null);
  }
  const table = poses.map(c => {
    const { av, ap, rupture } = voisinsDe(index, c, fenetre), ev = ecartVoisins(c, av, ap), sg = c.signaux ? COTES.map(([, en]) => c.signaux[en]).filter(Boolean) : null;
    const ligne = {
      partie: c.partie, cut: c.cut, voisinAvant: av ? av.cut : null, voisinApres: ap ? ap.cut : null, sansVoisins: !ev, rupture,
      ecartVoisins: ev ? { gauche: ev.gauche, droite: ev.droite } : null, ecartVoisinsMm: ev ? arr(ev.ecartMm) : null,
      ecartementMm: arr(ecartement(c)), signaux: sg,
    };
    const k = composantes(ligne, bandes.get(c.partie));
    ligne.composantes = Object.fromEntries(Object.entries(k).map(([a, v]) => [a, arr(v, 3)]));
    ligne.score = arr(Object.values(k).reduce((s, v) => s + v, 0), 3);
    ligne.s1 = !!sg && sg.some(s => s.s1);
    const refus = sg ? sg.filter(s => s.conventionRefusee) : [];
    ligne.conventionRefusee = refus.length ? { raison: refus[0].conventionRaison, dzMm: arr(Math.max(...refus.map(s => Math.abs(s.dzMm ?? 0)))) } : null;
    const conf = sg ? sg.map(s => s.confiance).filter(fini) : [];
    ligne.confianceMin = conf.length ? Math.min(...conf) : null;
    ligne.sansProposition = !sg;
    return ligne;
  });
  /* Liste à relire : cuts au-dessus du seuil, et zones (suites de cuts posés successifs au-dessus du seuil de zone). */
  const relire = new Set(table.filter(l => l.ecartVoisinsMm !== null && l.ecartVoisinsMm > seuilRelire).map(l => `${l.partie}|${l.cut}`));
  const zones = [];
  let suite = [];
  const clore = () => { if (suite.length >= zoneMin) zones.push({ partie: suite[0].partie, premierCut: suite[0].cut, dernierCut: suite.at(-1).cut, cuts: suite.length, maxMm: Math.max(...suite.map(l => l.ecartVoisinsMm)) }); suite = []; };
  for (const l of table) {
    const ok = l.ecartVoisinsMm !== null && l.ecartVoisinsMm > seuilZone;
    if (ok && suite.length && suite.at(-1).partie === l.partie && l.cut - suite.at(-1).cut <= fenetre) suite.push(l);
    else { clore(); if (ok) suite = [l]; }
  }
  clore();
  const enZone = new Set();
  for (const z of zones) for (const l of table) if (l.partie === z.partie && l.cut >= z.premierCut && l.cut <= z.dernierCut && l.ecartVoisinsMm > seuilZone) enZone.add(`${l.partie}|${l.cut}`);
  /* Par score : score ≥ seuil, limité aux --part-max (5 %) meilleurs scores de la liste (le score d'un lot où
   * beaucoup de conventions sont refusées monte partout : le plafond garde la liste lisible). */
  const seuilScore = options.seuilScore === undefined ? SEUIL_SCORE : options.seuilScore, partMax = options.partMax ?? PART_MAX;
  let parScore = new Set();
  if (seuilScore !== null) {
    const tries = table.filter(l => l.score >= seuilScore).sort((a, b) => b.score - a.score || a.cut - b.cut).slice(0, Math.ceil(partMax * table.length));
    parScore = new Set(tries.map(l => `${l.partie}|${l.cut}`));
  }
  for (const l of table) {
    const k = `${l.partie}|${l.cut}`;
    l.signale = { ecart: relire.has(k), zone: enZone.has(k), score: parScore.has(k) };
    l.aRelire = l.signale.ecart || l.signale.zone || l.signale.score;
  }
  return { table, zones, resume: resumer(table, zones, { fenetre, seuilRelire, seuilZone, zoneMin, seuilScore, partMax, bandes: [...bandes].map(([p, b]) => ({ partie: p, ...(b || { p5Mm: null, p95Mm: null, n: 0 }) })) }) };
}

function resumer(table, zones, meta) {
  const rails = [];
  for (const l of table) if (l.ecartVoisins) for (const [fr] of COTES) { const e = l.ecartVoisins[fr]; if (e) rails.push(e); }
  const profil = rails.filter(e => e.repere === 'profil');
  const axe = f => stat(profil.map(e => Math.abs(e[f])));
  const avec = table.filter(l => l.ecartVoisinsMm !== null);
  const n = table.length, signales = table.filter(l => l.aRelire).length;
  const comp = {};
  for (const l of table) for (const [k, v] of Object.entries(l.composantes)) comp[k] = (comp[k] || 0) + (v > 0 ? 1 : 0);
  return {
    parametres: { fenetre: meta.fenetre, seuilRelireMm: meta.seuilRelire, seuilZoneMm: meta.seuilZone, zoneMin: meta.zoneMin, seuilScore: meta.seuilScore, partMax: meta.partMax },
    cutsPoses: n, cutsAvecVoisins: avec.length, cutsSansVoisins: n - avec.length, cutsRuptureRepere: table.filter(l => l.rupture).length, rails: rails.length, railsRepere3D: rails.length - profil.length,
    lateralAbsMm: axe('lateralMm'), verticalAbsMm: axe('verticalMm'), ecartCutMm: stat(avec.map(l => l.ecartVoisinsMm)),
    sup10mm: avec.filter(l => l.ecartVoisinsMm > 10).length, sup15mm: avec.filter(l => l.ecartVoisinsMm > 15).length, sup20mm: avec.filter(l => l.ecartVoisinsMm > 20).length,
    zones: zones.length, cutsEnZone: table.filter(l => l.signale.zone).length,
    cutsSignales: signales, partDesPoses: n ? arr(signales / n, 4) : null,
    cutsRepechesS1: table.filter(l => l.s1).length, cutsConventionRefusee: table.filter(l => l.conventionRefusee).length,
    cutsHorsBande: table.filter(l => l.horsBandeMm > 0).length, cutsSansProposition: table.filter(l => l.sansProposition).length,
    bandesEcartement: meta.bandes, termesActifs: comp,
    score: { mediane: arr(quantile(table.map(l => l.score), .5)), p90: arr(quantile(table.map(l => l.score), .9)), max: table.length ? Math.max(...table.map(l => l.score)) : null },
  };
}

/* ------------------------------------------------------------------ validation contre la jointure Écho ↔ Orbite */
/* AUC (probabilité qu'un cut corrigé ait un score plus haut qu'un non corrigé ; égalités à moitié). */
function auc(pos, neg) {
  if (!pos.length || !neg.length) return null;
  const tous = [...pos.map(v => [v, 1]), ...neg.map(v => [v, 0])].sort((a, b) => a[0] - b[0]);
  let somme = 0, i = 0;
  while (i < tous.length) {
    let j = i; while (j + 1 < tous.length && tous[j + 1][0] === tous[i][0]) j++;
    const rang = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) if (tous[k][1]) somme += rang;
    i = j + 1;
  }
  return arr((somme - pos.length * (pos.length + 1) / 2) / (pos.length * neg.length), 3);
}
function valider(analyse, jointure, options = {}) {
  const seuil = options.corrigeMm ?? 10;
  const ref = new Map();
  for (const l of jointure.table || []) if (l.classe === 'posee' && l.referenceHumaine === 'observee' && l.ecartHumain && fini(l.ecartHumain.maxDist3dMm)) ref.set(`${l.partie}|${l.cut}`, l.ecartHumain.maxDist3dMm);
  const lignes = analyse.table;
  const N = lignes.length;
  const evalues = lignes.filter(l => ref.has(`${l.partie}|${l.cut}`));
  const corriges = evalues.filter(l => ref.get(`${l.partie}|${l.cut}`) > seuil);
  const sur = (pred) => {
    const dans = lignes.filter(pred), hits = dans.filter(l => ref.get(`${l.partie}|${l.cut}`) > seuil).length;
    return { cuts: dans.length, partDesPoses: N ? arr(dans.length / N, 4) : null, corrigesDedans: hits, rappel: corriges.length ? arr(hits / corriges.length, 3) : null, evaluesDedans: dans.filter(l => ref.has(`${l.partie}|${l.cut}`)).length };
  };
  /* Courbe : un point par rang de score (cumulé, égalités groupées) pour les parts de référence. */
  const tri = lignes.slice().sort((a, b) => b.score - a.score);
  const courbe = [];
  for (const part of [0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.5]) {
    const k = Math.max(1, Math.round(part * N)); if (k > N) continue;
    const s = tri[k - 1].score, r = sur(l => l.score >= s);
    courbe.push({ partCiblee: part, seuilScore: s, ...r });
  }
  /* Meilleur seuil sous la contrainte « part des cuts ≤ 5 % » : le plus bas seuil de score tenant dans 5 %. */
  const candidats = [...new Set(lignes.map(l => l.score))].sort((a, b) => a - b);
  let seuil5 = null;
  for (const s of candidats) { const r = sur(l => l.score >= s); if (r.partDesPoses <= 0.05) { seuil5 = { seuilScore: s, ...r }; break; } }
  const composantesAuc = {};
  for (const k of Object.keys(POIDS).filter(k => ['voisins', 'bande', 's1', 'convention', 'confiance'].includes(k))) {
    composantesAuc[k] = auc(corriges.map(l => l.composantes[k]), evalues.filter(l => ref.get(`${l.partie}|${l.cut}`) <= seuil).map(l => l.composantes[k]));
  }
  const sansVoisinsCorriges = corriges.filter(l => l.sansVoisins).length;
  return {
    seuilCorrigeMm: seuil, cutsPoses: N, cutsAvecReference: evalues.length, cutsCorriges: corriges.length, corrigesSansVoisins: sansVoisinsCorriges,
    liste: sur(l => l.aRelire), parScore: sur(l => l.signale.score), regleCahier: sur(l => l.signale.ecart || l.signale.zone), ecartSeul15: sur(l => l.signale.ecart), zones: sur(l => l.signale.zone),
    auc: { score: auc(corriges.map(l => l.score), evalues.filter(l => ref.get(`${l.partie}|${l.cut}`) <= seuil).map(l => l.score)), composantes: composantesAuc },
    courbe, seuilSous5pc: seuil5, cible: { rappelMin: 0.6, partMax: 0.05 },
  };
}

/* ------------------------------------------------------------------ sorties */
const f1 = v => v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toFixed(1);
const pc = v => v === null || v === undefined ? '—' : (100 * v).toFixed(1).replace('.', ',') + ' %';
const st = s => s.n ? `n=${s.n} méd ${f1(s.medianeMm)} P90 ${f1(s.p90Mm)} max ${f1(s.maxMm)} mm` : 'n=0';
function texte(r, zones, validation, entete = []) {
  const L = [...entete];
  L.push(`Cohérence aux voisins : ${r.cutsPoses} cuts posés par Ariane, ${r.cutsAvecVoisins} avec voisins à ±${r.parametres.fenetre} (${r.cutsSansVoisins} sans, dont ${r.cutsRuptureRepere} par rupture de repère), ${r.rails} rails dont ${r.railsRepere3D} en repère 3D.`);
  L.push(`  latéral |.|  : ${st(r.lateralAbsMm)}`, `  vertical |.| : ${st(r.verticalAbsMm)}`, `  plus grand écart par cut : ${st(r.ecartCutMm)}`);
  L.push(`  cuts > 10 mm : ${r.sup10mm} ; > 15 mm : ${r.sup15mm} ; > 20 mm : ${r.sup20mm} ; zones (≥ ${r.parametres.zoneMin} cuts > ${r.parametres.seuilZoneMm} mm) : ${r.zones} (${r.cutsEnZone} cuts).`);
  L.push(`  signaux : S1 ${r.cutsRepechesS1} cuts, convention refusée ${r.cutsConventionRefusee}, hors bande d'écartement ${r.cutsHorsBande}, sans proposition ${r.cutsSansProposition}.`);
  L.push(`  bande d'écartement posé (p5–p95) : ${r.bandesEcartement.map(b => `partie ${b.partie} ${f1(b.p5Mm)}–${f1(b.p95Mm)} mm (n=${b.n})`).join(' ; ')}`);
  L.push(`  score : médiane ${r.score.mediane}, P90 ${r.score.p90}, max ${r.score.max}.`);
  L.push(`  À RELIRE : ${r.cutsSignales} cuts signalés = ${pc(r.partDesPoses)} des cuts posés.`);
  for (const z of zones.slice(0, 20)) L.push(`  zone : partie ${z.partie}, cuts ${z.premierCut} à ${z.dernierCut} (${z.cuts} cuts, max ${f1(z.maxMm)} mm)`);
  if (zones.length > 20) L.push(`  … ${zones.length - 20} autres zones`);
  if (validation) {
    const v = validation;
    L.push('', `Validation contre la jointure Écho : ${v.cutsAvecReference} cuts posés avec référence humaine, ${v.cutsCorriges} corrigés de plus de ${v.seuilCorrigeMm} mm (dont ${v.corrigesSansVoisins} sans voisins).`);
    const ligne = (nom, s) => `  ${nom} : ${s.cuts} cuts (${pc(s.partDesPoses)} des posés), ${s.corrigesDedans}/${v.cutsCorriges} corrigés dedans, rappel ${pc(s.rappel)}`;
    L.push(ligne('liste à relire complète', v.liste), ligne('règle du cahier (> seuil ∪ zones)', v.regleCahier), ligne('écart seul', v.ecartSeul15), ligne('zones seules', v.zones), ligne(`score ≥ ${r.parametres.seuilScore} (plafond ${pc(r.parametres.partMax)})`, v.parScore));
    L.push(`  AUC du score : ${v.auc.score} ; par terme : ${Object.entries(v.auc.composantes).map(([k, a]) => `${k} ${a}`).join(', ')}`);
    L.push('  courbe (seuil de score → cuts, part des posés, rappel) :');
    for (const c of v.courbe) L.push(`    ${c.seuilScore.toFixed(2)} → ${c.cuts} cuts, ${pc(c.partDesPoses)}, ${c.corrigesDedans}/${v.cutsCorriges} = ${pc(c.rappel)}`);
    if (v.seuilSous5pc) L.push(`  plus bas seuil tenant dans 5 % : ${v.seuilSous5pc.seuilScore.toFixed(2)} → ${v.seuilSous5pc.cuts} cuts (${pc(v.seuilSous5pc.partDesPoses)}), rappel ${pc(v.seuilSous5pc.rappel)} ; cible ≥ 60 % dans ≤ 5 %.`);
  }
  return L.join('\n');
}
function enCsv(table) {
  const cols = ['partie', 'cut', 'voisinAvant', 'voisinApres', 'gaucheLateralMm', 'gaucheVerticalMm', 'droiteLateralMm', 'droiteVerticalMm', 'ecartVoisinsMm', 'ecartementMm', 'horsBandeMm', 's1', 'conventionRaison', 'conventionDzMm', 'confianceMin', 'score', 'aRelire'];
  const lignes = [cols.join(',')];
  for (const l of table) {
    const g = l.ecartVoisins && l.ecartVoisins.gauche || {}, d = l.ecartVoisins && l.ecartVoisins.droite || {}, c = l.conventionRefusee || {};
    lignes.push([l.partie, l.cut, l.voisinAvant, l.voisinApres, g.lateralMm, g.verticalMm, d.lateralMm, d.verticalMm, l.ecartVoisinsMm, l.ecartementMm, arr(l.composantes.bande * 10), l.s1, c.raison, c.dzMm, l.confianceMin, l.score, l.aRelire]
      .map(v => v === null || v === undefined ? '' : String(v)).join(','));
  }
  return lignes.join('\n') + '\n';
}

/* ------------------------------------------------------------------ ligne de commande */
function lireArguments(argv) {
  const a = { journal: null, bilan: null, partie: null, fenetre: 3, seuilRelire: 15, seuilZone: 10, zoneMin: 3, seuilScore: SEUIL_SCORE, partMax: PART_MAX, jointure: null, corrigeMm: 10, sortie: null, csv: null };
  const num = (k, v) => { const x = Number(v); if (!fini(x)) throw Error(`${k} attend un nombre.`); return x; };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--journal') a.journal = argv[++i];
    else if (k === '--bilan') a.bilan = argv[++i];
    else if (k === '--partie') a.partie = num(k, argv[++i]);
    else if (k === '--fenetre') a.fenetre = num(k, argv[++i]);
    else if (k === '--seuil-relire') a.seuilRelire = num(k, argv[++i]);
    else if (k === '--seuil-zone') a.seuilZone = num(k, argv[++i]);
    else if (k === '--zone-min') a.zoneMin = num(k, argv[++i]);
    else if (k === '--seuil-score') a.seuilScore = num(k, argv[++i]);
    else if (k === '--part-max') a.partMax = num(k, argv[++i]);
    else if (k === '--sans-score') a.seuilScore = null;
    else if (k === '--jointure') a.jointure = argv[++i];
    else if (k === '--corrige-mm') a.corrigeMm = num(k, argv[++i]);
    else if (k === '--sortie') a.sortie = argv[++i];
    else if (k === '--csv') a.csv = argv[++i];
    else throw Error(`Argument inconnu : ${k}`);
  }
  if (!a.journal) throw Error('Usage : node tools/coherence-voisins.cjs --journal <fichier> [--bilan f] [--partie N] [--fenetre 3] [--seuil-relire 15] [--seuil-zone 10] [--zone-min 3] [--seuil-score S] [--part-max P] [--sans-score] [--jointure table.json [--corrige-mm 10]] [--sortie out.json] [--csv out.csv]');
  return a;
}
function executer(argv, sortie = console.log) {
  const a = lireArguments(argv), entete = [];
  const journal = lireJournal(a.journal);
  const res = analyser(journal, a);
  if (a.bilan) {
    const b = lireBilan(a.bilan);
    res.resume.bilan = b;
    entete.push(`Bilan : statut ${b.statut}, ${b.termine} cuts terminés, ${b.differes} différés, ${b.complesManuellement} complétés manuellement, ${b.interrompus} interrompus.`);
  }
  let validation = null;
  if (a.jointure) validation = valider(res, JSON.parse(fs.readFileSync(a.jointure, 'utf8')), { corrigeMm: a.corrigeMm });
  const doc = { format: 'ariane-coherence-voisins-v1', creeLe: new Date().toISOString(), resume: res.resume, zones: res.zones, validation, table: res.table };
  if (a.sortie) { fs.mkdirSync(path.dirname(path.resolve(a.sortie)), { recursive: true }); fs.writeFileSync(a.sortie, JSON.stringify(doc, null, 1)); }
  if (a.csv) { fs.mkdirSync(path.dirname(path.resolve(a.csv)), { recursive: true }); fs.writeFileSync(a.csv, enCsv(res.table)); }
  sortie(texte(res.resume, res.zones, validation, entete));
  return doc;
}
if (require.main === module) {
  try { executer(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { SEUIL_SCORE, PART_MAX, analyser, valider, cutsPoses, ecartVoisins, composantes, resumer, texte, enCsv, lireArguments, executer, lireBilan, auc, POIDS };
