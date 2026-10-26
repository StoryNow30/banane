#!/usr/bin/env node
'use strict';
/*
 * garde-gcv2.cjs — GARDE DE NON-RÉGRESSION GCV2 (module A de fiches/ARCHITECTURE_5.0.md, § a.3 ; cahier 5.0 v2 § 2 et § 3 ; D-239, D-250).
 * Hors ligne, lecture seule : rien n'est commandé dans ESV. Le juge est tools/juger.cjs ; le rejeu, tools/banc-differes.cjs.
 *
 *   node tools/garde-gcv2.cjs [comparer] --base datasets/garde-gcv2/base-test18.json (--rejeux DOSSIER | --rejouer) [--lots tous|NOM,NOM]
 *        [--vitesse [datasets/vitesse/base-banc-test19.json]] [--repetitions N] [--sortie DOSSIER]
 *   node tools/garde-gcv2.cjs sceller --manifeste M.json --rejeux DOSSIER --verites DOSSIER --commit SHA --version V --sortie BASE.json
 *        [--vitesse-sortie VITESSE.json] [--note TEXTE]
 *   node tools/garde-gcv2.cjs verite --rejeu R.jsonl --echo DOSSIER[,DOSSIER…] --partie N --sortie V.json [--avec-regle]
 *
 * COMPARER. Les rejeux du code courant (`--rejeux DOSSIER` : fichiers r-<nom>.jsonl de `banc-differes rejouer --chrono` ; ou `--rejouer` : la garde
 * lance elle-même le banc sur les lots archivés HORS dépôt, dossier BANANE_LOTS/<nom>/ avec le journal, le corpus et la liste nommés dans la base)
 * sont jugés contre les vérités de la base (`verites/`, à côté d'elle) et comparés, cut par cut, à la base scellée. Sorties : garde.md et garde.json
 * (dans `--sortie`) ; résumé sur la sortie standard.
 * Retour : 0 vert · 1 recul de qualité · 2 recul de vitesse banc seul (critère 6-i, > 10 %, seulement avec `--vitesse`) · 3 garde non rendue
 * (base non scellée, commit absent, lot ou vérité manquants) · 4 erreur d'outil.
 *
 * Critères, par groupe de lots (réglage, 3:0, terrain), contre la base (cahier § 2) :
 *  colonne « sans passe » (bloquante) : (1) cuts laissés sans pose ≤ base ; (2) sur les cuts jugés en base, nombre à ≤ 10 mm ≥ base (cut par cut) ;
 *    (3) aucun cut nouvellement à plus de 20 mm, à plus de 50 mm, en mauvaise voie ; verts changés et poses sans preuve du nuage : pas plus qu'en
 *    base (zéro en base = zéro) ; (4) aucun cut à ≤ 10 mm en base ne passe à plus de 20 mm ; (5) aucun cut dégradé de plus de 2 mm.
 *  colonne « avec passe » : mêmes critères de qualité (2) à (5), bloquants (la passe écrit en production) ; le compte de cuts laissés sans pose
 *    (le majorant du banc) est seulement signalé.
 *  étape « GCV2 dans le lot » (D-250, priorité 1 ; cut d'abord différé par la chaîne, repris par la GCV2 dans le lot ; colonne « avec passe »),
 *    jugée À PART et bloquante sur elle : aucun cut nouvellement à plus de 20 mm, à plus de 50 mm ou en mauvaise voie dans l'étape, aucun cut de
 *    l'étape dégradé de plus de 2 mm ; budget D-223 (pose à plus de 50 mm ≤ 3 %, mauvaise voie ≤ 1 %) : s'il était tenu en base, le dépasser bloque ;
 *    s'il était déjà dépassé en base (constat de la partie 0 du 23/10), toute hausse du taux bloque, et le dépassement est écrit en tête du rapport.
 *    La garde est une garde de non-régression : un budget dépassé EN BASE ne la rend pas rouge sur le code de la base ; il est présenté à
 *    l'opérateur, jamais absorbé.
 *  vitesse (critère 6-i, `--vitesse`) : par lot, temps de calcul du banc par cut (analyse + décision + passe), médiane et p90, pas plus de 10 % au-dessus
 *    de la base de vitesse ; méthode écrite (plus petite de N répétitions avec `--rejouer --repetitions N`, sinon une seule mesure).
 * Écart de recalcul : tout écart entre la base et un rapport antérieur est présenté à l'opérateur (fiche de la version), jamais absorbé en silence.
 */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), { spawnSync } = require('node:child_process');
const J = require('./juger.cjs');

const FORMAT_BASE = 'ariane-garde-gcv2-base-v1', FORMAT_VITESSE = 'ariane-vitesse-banc-v1', FORMAT_RAPPORT = 'ariane-garde-gcv2-rapport-v1';
const RETOUR = Object.freeze({ VERT: 0, QUALITE: 1, VITESSE: 2, NON_RENDUE: 3, OUTIL: 4 });
const BUDGET_D223 = Object.freeze({ p50: 3, mauvaiseVoie: 1 });
const SEUIL_VITESSE = 0.10, DEGRADE_MM = 2;

class GardeNonRendue extends Error {}

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const fini = v => typeof v === 'number' && Number.isFinite(v);
const arrondi = (v, n = 1) => fini(v) ? Math.round(v * 10 ** n) / 10 ** n : null;
function quantile(valeurs, q) { const s = valeurs.filter(fini).sort((a, b) => a - b); if (!s.length) return null; const i = (s.length - 1) * q, b = Math.floor(i); return s[b] + (s[Math.min(b + 1, s.length - 1)] - s[b]) * (i - b); }

/* ------------------------------------------------------------------ scellement */
/* SHA256SUMS : « <sha256>  <chemin relatif> » par ligne, dans le dossier de la base. */
function lireSommes(fichier) {
  const m = new Map();
  for (const l of fs.readFileSync(fichier, 'utf8').split('\n')) { const x = /^([0-9a-f]{64}) [ *]?(.+)$/.exec(l.trim()); if (x) m.set(x[2], x[1]); }
  return m;
}
function ecrireSommes(dossier, fichiers) {
  const lignes = fichiers.slice().sort().map(f => `${sha256(fs.readFileSync(path.join(dossier, f)))}  ${f}`);
  fs.writeFileSync(path.join(dossier, 'SHA256SUMS'), lignes.join('\n') + '\n');
  return lignes;
}
/* Base scellée : présente dans SHA256SUMS avec la bonne empreinte, commit nommé, chaque vérité scellée. Sinon GardeNonRendue (retour 3). */
function lireBaseScellee(fichierBase) {
  if (!fs.existsSync(fichierBase)) throw new GardeNonRendue(`base absente : ${fichierBase}`);
  const dossier = path.dirname(path.resolve(fichierBase)), sommes = path.join(dossier, 'SHA256SUMS');
  if (!fs.existsSync(sommes)) throw new GardeNonRendue(`base non scellée : ${sommes} absent`);
  const S = lireSommes(sommes), nom = path.basename(fichierBase), buf = fs.readFileSync(fichierBase);
  if (S.get(nom) !== sha256(buf)) throw new GardeNonRendue(`base non scellée : l'empreinte de ${nom} ne correspond pas à SHA256SUMS`);
  const base = JSON.parse(buf.toString('utf8'));
  if (base.format !== FORMAT_BASE) throw new GardeNonRendue(`format de base inattendu : ${base.format}`);
  if (!base.commit || !/^[0-9a-f]{7,40}$/.test(base.commit)) throw new GardeNonRendue('base sans commit nommé : ce n\'est pas une base (cahier § 2.5)');
  if (!base.version) throw new GardeNonRendue('base sans version du code mesuré');
  for (const l of base.lots) {
    const v = path.join('verites', l.verite), f = path.join(dossier, v);
    if (!fs.existsSync(f)) throw new GardeNonRendue(`vérité manquante pour ${l.nom} : ${v}`);
    if (S.get(v) !== sha256(fs.readFileSync(f))) throw new GardeNonRendue(`vérité non scellée : ${v}`);
  }
  return { base, dossier, sha256: sha256(buf) };
}

/* ------------------------------------------------------------------ jugement d'un rejeu */
function tempsLot(lignes, entete) {
  const a = lignes.map(l => l.ms && l.ms.analyse).filter(fini), d = lignes.map(l => l.ms && l.ms.decision).filter(fini);
  const tot = lignes.filter(l => l.ms && fini(l.ms.analyse)).map(l => l.ms.analyse + (l.ms.decision || 0) + (l.ms.passe || 0)), p = lignes.map(l => l.ms && l.ms.passe).filter(fini);
  if (!a.length) return null;
  const r = v => arrondi(v, 1);
  return { cuts: lignes.length, analyseMedMs: r(quantile(a, 0.5)), analyseP90Ms: r(quantile(a, 0.9)), decisionMedMs: r(quantile(d, 0.5)), decisionP90Ms: r(quantile(d, 0.9)),
    passeMedMs: p.length ? r(quantile(p, 0.5)) : null, passeTotalMs: entete && entete.chrono ? entete.chrono.passeMs : null, totalMedMs: r(quantile(tot, 0.5)), totalP90Ms: r(quantile(tot, 0.9)) };
}
/* Fiche compacte d'un cut pour la base : état, étape, mm, mauvaise voie, vert changé, sans preuve ; une entrée par colonne. */
function compacter(c) {
  const col = x => ({ etat: x.etat, ...(x.etape ? { etape: x.etape } : {}), ...(x.mm != null ? { mm: x.mm } : {}), ...(x.mauvaiseVoie ? { mv: true } : {}),
    ...(x.vertChange ? { vertChange: true } : {}), ...(x.sansPreuve ? { sansPreuve: true } : {}), ...(x.sansNuage ? { sansNuage: true } : {}) });
  return { cut: c.cut, ...(c.poseeBase ? { poseeBase: true } : {}), avec: col(c.avecPasse), sans: col(c.sansPasse) };
}
function jugerLot(lot, texteRejeu, verite) {
  const R = J.lireRejeu(texteRejeu);
  if (!R.entete) throw new GardeNonRendue(`rejeu de ${lot.nom} sans en-tête`);
  if (lot.lot && R.entete.lot !== lot.lot) throw new GardeNonRendue(`rejeu de ${lot.nom} : lot ${R.entete.lot}, attendu ${lot.lot}`);
  const j = J.juger(R.lignes, verite, { profil: 'L1-se' });
  return { nom: lot.nom, entete: R.entete, jugement: j, cuts: j.cuts.map(compacter), temps: tempsLot(R.lignes, R.entete) };
}
/* Agrégats d'un groupe, recalculés depuis les fiches compactes (base et rejeu courant ont la même forme). */
function agregerGroupe(lots) {
  const nouv = () => ({ traites: 0, sansPose: 0, sansNuage: 0, approches: 0, poses: 0, nouvelles: 0, juges: 0, a5: 0, a10: 0, a20: 0, p20: 0, p50: 0, mauvaiseVoie: 0, vertsChanges: 0, sansPreuve: 0, mediane: null, e: [] });
  const out = { avecPasse: nouv(), sansPasse: nouv(), etapes: { 'gcv2-lot': nouv(), passe: nouv(), autre: nouv() } };
  const compter = (r, x, poseeBase) => {
    r.traites++;
    if (x.vertChange) r.vertsChanges++;
    if (x.sansPreuve) r.sansPreuve++;
    if (x.etat === 'approche') { r.approches++; if (!x.sansNuage) r.sansPose++; else r.sansNuage++; return; }
    if (x.etat !== 'pose') { if (x.sansNuage) r.sansNuage++; else r.sansPose++; return; }
    r.poses++;
    if (poseeBase) return;
    r.nouvelles++;
    if (x.mm == null) return;
    r.juges++; r.e.push(x.mm);
    if (x.mm <= 5) r.a5++;
    if (x.mm <= 10) r.a10++; else if (x.mm <= 20) r.a20++; else r.p20++;
    if (x.mm > 50) r.p50++;
    if (x.mv) r.mauvaiseVoie++;
  };
  for (const l of lots) for (const c of l.cuts) {
    compter(out.avecPasse, c.avec, c.poseeBase); compter(out.sansPasse, c.sans, c.poseeBase);
    if (c.avec.etat === 'pose' && !c.poseeBase && c.avec.etape) compter(out.etapes[c.avec.etape], c.avec, false);
  }
  const finir = r => { const s = r.e.sort((a, b) => a - b); r.mediane = s.length ? Math.round(s[s.length >> 1] * 10) / 10 : null; delete r.e;
    r.tauxP50 = r.juges ? arrondi(100 * r.p50 / r.juges, 1) : null; r.wilsonP50 = J.wilson(r.p50, r.juges);
    r.tauxMV = r.juges ? arrondi(100 * r.mauvaiseVoie / r.juges, 1) : null; r.wilsonMV = J.wilson(r.mauvaiseVoie, r.juges); return r; };
  finir(out.avecPasse); finir(out.sansPasse); for (const k of Object.keys(out.etapes)) finir(out.etapes[k]);
  for (const k of Object.keys(out.etapes)) for (const x of ['traites', 'sansPose', 'sansNuage', 'approches', 'vertsChanges', 'sansPreuve']) delete out.etapes[k][x];
  return out;
}
function groupesDe(lots, lotsJuges) {
  const par = new Map();
  for (const l of lots) { const j = lotsJuges.find(x => x.nom === l.nom); if (!j) continue; if (!par.has(l.groupe)) par.set(l.groupe, []); par.get(l.groupe).push(j); }
  return Object.fromEntries([...par].map(([g, ls]) => [g, { lots: ls.map(x => x.nom), ...agregerGroupe(ls) }]));
}

/* ------------------------------------------------------------------ comparaison */
function cle(lot, cut) { return `${lot}#${cut}`; }
function indexCuts(lots, col) { const m = new Map(); for (const l of lots) for (const c of l.cuts) m.set(cle(l.nom, c.cut), { ...c[col], poseeBase: !!c.poseeBase }); return m; }
/* Compare une colonne d'un groupe. `filtre` restreint aux cuts d'une étape (étape « GCV2 dans le lot »). */
function comparerColonne(nomsLots, B, A, col, { filtreEtape = null } = {}) {
  const IB = indexCuts(B.filter(l => nomsLots.includes(l.nom)), col), IA = indexCuts(A.filter(l => nomsLots.includes(l.nom)), col);
  const dansEtape = (x) => !filtreEtape || (x && x.etat === 'pose' && x.etape === filtreEtape);
  const listes = { perdus: [], degrades: [], gagnes: [], nouveaux: [], nouveauxPlus20: [], nouveauxPlus50: [], nouvellesMauvaiseVoie: [], a10VersPlus20: [], nouveauxVertsChanges: [], nouvellesSansPreuve: [] };
  let a10Base = 0, a10Maintenus = 0;
  for (const [k, b] of IB) {
    const a = IA.get(k) || { etat: 'absent' };
    if (!dansEtape(b) && !dansEtape(a)) continue;
    const [lot, cut] = k.split('#'), id = { lot, cut: Number(cut) };
    if (b.etat === 'pose' && a.etat !== 'pose') listes.perdus.push({ ...id, mmBase: b.mm ?? null });
    if (b.etat !== 'pose' && a.etat === 'pose' && !a.poseeBase) listes.nouveaux.push({ ...id, mm: a.mm ?? null, etape: a.etape ?? null });
    if (fini(b.mm) && fini(a.mm)) {
      if (a.mm > b.mm + DEGRADE_MM) listes.degrades.push({ ...id, mmBase: b.mm, mm: a.mm });
      else if (a.mm < b.mm - DEGRADE_MM) listes.gagnes.push({ ...id, mmBase: b.mm, mm: a.mm });
    }
    if (fini(b.mm) && b.mm <= 10) { a10Base++; if (fini(a.mm) && a.mm <= 10 && a.etat === 'pose') a10Maintenus++; if (fini(a.mm) && a.mm > 20) listes.a10VersPlus20.push({ ...id, mmBase: b.mm, mm: a.mm }); }
    const plus = (v, s) => fini(v) && v > s;
    if (plus(a.mm, 20) && !plus(b.mm, 20)) listes.nouveauxPlus20.push({ ...id, mmBase: b.mm ?? null, mm: a.mm });
    if (plus(a.mm, 50) && !plus(b.mm, 50)) listes.nouveauxPlus50.push({ ...id, mmBase: b.mm ?? null, mm: a.mm });
    if (a.mv && !b.mv) listes.nouvellesMauvaiseVoie.push({ ...id, mm: a.mm ?? null });
    if (a.vertChange && !b.vertChange) listes.nouveauxVertsChanges.push(id);
    if (a.sansPreuve && !b.sansPreuve) listes.nouvellesSansPreuve.push(id);
  }
  for (const [k, a] of IA) if (!IB.has(k) && dansEtape(a)) { const [lot, cut] = k.split('#'); listes.nouveaux.push({ lot, cut: Number(cut), mm: a.mm ?? null, etape: a.etape ?? null, horsBase: true }); }
  return { listes, a10Base, a10Maintenus };
}
function budget(r) {
  if (!r || !r.juges) return { juges: 0, p50: { n: 0, taux: null, wilson95: null, tenu: null }, mauvaiseVoie: { n: 0, taux: null, wilson95: null, tenu: null } };
  return { juges: r.juges, p50: { n: r.p50, taux: r.tauxP50, wilson95: r.wilsonP50, tenu: r.tauxP50 <= BUDGET_D223.p50 },
    mauvaiseVoie: { n: r.mauvaiseVoie, taux: r.tauxMV, wilson95: r.wilsonMV, tenu: r.tauxMV <= BUDGET_D223.mauvaiseVoie } };
}
function comparer(base, actuels, { vitesseBase = null, methodeVitesse = null } = {}) {
  const B = base.lots.map(l => ({ nom: l.nom, cuts: base.cuts[l.nom] || [] })), A = actuels;
  const GB = base.groupes, GA = groupesDe(base.lots, A), groupes = {}, reculs = [], signalements = [];
  for (const [g, gb] of Object.entries(GB)) {
    const ga = GA[g], noms = gb.lots, out = { lots: noms, base: { sansPasse: gb.sansPasse, avecPasse: gb.avecPasse, gcv2Lot: gb.etapes['gcv2-lot'], passe: gb.etapes.passe },
      actuel: { sansPasse: ga.sansPasse, avecPasse: ga.avecPasse, gcv2Lot: ga.etapes['gcv2-lot'], passe: ga.etapes.passe }, colonnes: {} };
    for (const col of ['sansPasse', 'avecPasse']) {
      const c = comparerColonne(noms, B, A, col === 'sansPasse' ? 'sans' : 'avec'), R = [];
      if (ga[col].sansPose > gb[col].sansPose) (col === 'sansPasse' ? R : signalements).push(`${g}, ${col} : cuts laissés sans pose ${gb[col].sansPose} → ${ga[col].sansPose}`);
      if (c.a10Maintenus < c.a10Base) R.push(`${g}, ${col} : cuts à ≤ 10 mm en base encore à ≤ 10 mm : ${c.a10Maintenus} sur ${c.a10Base}`);
      for (const [cleL, lib] of [['nouveauxPlus20', 'cut(s) nouvellement à plus de 20 mm'], ['nouveauxPlus50', 'cut(s) nouvellement à plus de 50 mm'], ['nouvellesMauvaiseVoie', 'cut(s) nouvellement en mauvaise voie'],
        ['a10VersPlus20', 'cut(s) de ≤ 10 mm passé(s) à plus de 20 mm'], ['degrades', `cut(s) dégradé(s) de plus de ${DEGRADE_MM} mm`], ['nouveauxVertsChanges', 'vert(s) changé(s)'], ['nouvellesSansPreuve', 'pose(s) sans preuve du nuage']])
        if (c.listes[cleL].length) R.push(`${g}, ${col} : ${c.listes[cleL].length} ${lib} (${c.listes[cleL].slice(0, 8).map(x => `${x.lot} ${x.cut}${x.mm != null ? ` ${x.mm} mm` : ''}`).join(', ')})`);
      if (ga[col].vertsChanges > gb[col].vertsChanges && !c.listes.nouveauxVertsChanges.length) R.push(`${g}, ${col} : verts changés ${gb[col].vertsChanges} → ${ga[col].vertsChanges}`);
      if (ga[col].sansPreuve > gb[col].sansPreuve && !c.listes.nouvellesSansPreuve.length) R.push(`${g}, ${col} : poses sans preuve ${gb[col].sansPreuve} → ${ga[col].sansPreuve}`);
      out.colonnes[col] = { ...c, reculs: R }; reculs.push(...R);
    }
    /* Étape « GCV2 dans le lot » (D-250), à part. */
    const ce = comparerColonne(noms, B, A, 'avec', { filtreEtape: 'gcv2-lot' }), RE = [], bb = budget(gb.etapes['gcv2-lot']), ba = budget(ga.etapes['gcv2-lot']);
    for (const [cleL, lib] of [['nouveauxPlus20', 'cut(s) nouvellement à plus de 20 mm'], ['nouveauxPlus50', 'cut(s) nouvellement à plus de 50 mm'], ['nouvellesMauvaiseVoie', 'cut(s) nouvellement en mauvaise voie'], ['degrades', `cut(s) dégradé(s) de plus de ${DEGRADE_MM} mm`]])
      if (ce.listes[cleL].length) RE.push(`${g}, GCV2 dans le lot : ${ce.listes[cleL].length} ${lib} (${ce.listes[cleL].slice(0, 8).map(x => `${x.lot} ${x.cut}${x.mm != null ? ` ${x.mm} mm` : ''}`).join(', ')})`);
    for (const k of ['p50', 'mauvaiseVoie']) {
      if (ba[k].taux == null) continue;
      if (bb[k].tenu !== false && ba[k].tenu === false) RE.push(`${g}, GCV2 dans le lot : budget D-223 (${k === 'p50' ? 'pose > 50 mm ≤ 3 %' : 'mauvaise voie ≤ 1 %'}) tenu en base, dépassé : ${ba[k].n}/${ba.juges} (${ba[k].taux} %)`);
      else if (bb[k].tenu === false && ba[k].taux > bb[k].taux) RE.push(`${g}, GCV2 dans le lot : budget D-223 déjà dépassé en base, taux en hausse ${bb[k].taux} % → ${ba[k].taux} %`);
    }
    for (const k of ['p50', 'mauvaiseVoie']) if (bb[k].tenu === false) signalements.push(`${g}, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (${k === 'p50' ? 'pose > 50 mm' : 'mauvaise voie'} ${bb[k].n}/${bb.juges}, ${bb[k].taux} %, borne haute de Wilson ${bb[k].wilson95} %) : connu (D-250), à corriger ; la garde bloque toute hausse`);
    out.gcv2Lot = { ...ce, budgetBase: bb, budgetActuel: ba, reculs: RE }; reculs.push(...RE);
    groupes[g] = out;
  }
  /* Vitesse (critère 6-i). */
  let vitesse = { controlee: false, raison: 'option --vitesse absente : vitesse non contrôlée' };
  const reculsVitesse = [];
  if (vitesseBase) {
    const lots = [];
    for (const lb of vitesseBase.lots) {
      const la = A.find(x => x.nom === lb.nom), ta = la && la.temps;
      if (!ta) { lots.push({ nom: lb.nom, statut: 'sans mesure' }); continue; }
      const rMed = lb.totalMedMs ? ta.totalMedMs / lb.totalMedMs - 1 : null, rP90 = lb.totalP90Ms ? ta.totalP90Ms / lb.totalP90Ms - 1 : null;
      const lent = (fini(rMed) && rMed > SEUIL_VITESSE) || (fini(rP90) && rP90 > SEUIL_VITESSE);
      lots.push({ nom: lb.nom, baseMedMs: lb.totalMedMs, medMs: ta.totalMedMs, ecartMed: arrondi(100 * rMed, 1), baseP90Ms: lb.totalP90Ms, p90Ms: ta.totalP90Ms, ecartP90: arrondi(100 * rP90, 1), lent });
      if (lent) reculsVitesse.push(`${lb.nom} : temps banc par cut ${lb.totalMedMs} → ${ta.totalMedMs} ms (médiane, ${arrondi(100 * rMed, 1)} %), p90 ${lb.totalP90Ms} → ${ta.totalP90Ms} ms (${arrondi(100 * rP90, 1)} %)`);
    }
    const memeMachine = vitesseBase.machine && vitesseBase.machine.cpus === os.cpus().length;
    vitesse = { controlee: true, methode: methodeVitesse || 'une seule mesure par lot', seuil: `${100 * SEUIL_VITESSE} %`, machine: { base: vitesseBase.machine || null, ici: { cpus: os.cpus().length, node: process.version }, memeMachine: !!memeMachine }, lots, reculs: reculsVitesse };
    if (!memeMachine) signalements.push('vitesse : machine différente de celle de la base (nombre de processeurs) ; comparaison indicative');
  }
  const retour = reculs.length ? RETOUR.QUALITE : reculsVitesse.length ? RETOUR.VITESSE : RETOUR.VERT;
  return { format: FORMAT_RAPPORT, retour, base: { commit: base.commit, version: base.version }, groupes, vitesse, reculs, reculsVitesse, signalements };
}

/* ------------------------------------------------------------------ rapport */
const f1 = v => v == null ? '—' : String(v).replace('.', ',');
function ligneColonne(nom, r) {
  return `| ${nom} | ${r.sansPose} | ${r.juges} | ${r.a5} | ${r.a10} | ${r.a20} | ${r.p20} | ${r.p50} | ${r.mauvaiseVoie} | ${r.vertsChanges ?? '—'} | ${r.sansPreuve ?? '—'} | ${f1(r.mediane)} |`;
}
function rapportMarkdown(rap, { titre = 'Garde de non-régression GCV2' } = {}) {
  const L = [`# ${titre}`, '', `Base : commit \`${rap.base.commit}\`, version ${rap.base.version}. Code jugé : ${rap.code ? `commit \`${rap.code.commit}\`` : 'non précisé'}.`, '',
    `**Retour ${rap.retour}** (${['vert', 'recul de qualité', 'recul de vitesse banc seul', 'garde non rendue', 'erreur d\'outil'][rap.retour]}).`, ''];
  if (rap.signalements.length) { L.push('Signalé, non bloquant :', ''); for (const s of rap.signalements) L.push(`- ${s}`); L.push(''); }
  if (rap.reculs.length) { L.push('Reculs de qualité (bloquants) :', ''); for (const s of rap.reculs) L.push(`- ${s}`); L.push(''); }
  for (const [g, x] of Object.entries(rap.groupes)) {
    L.push(`## ${g} (${x.lots.join(', ')})`, '', '| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
    L.push(ligneColonne('sans passe, base', x.base.sansPasse), ligneColonne('sans passe, actuel', x.actuel.sansPasse), ligneColonne('avec passe, base', x.base.avecPasse), ligneColonne('avec passe, actuel', x.actuel.avecPasse));
    const e = k => ({ ...x[k === 'b' ? 'base' : 'actuel'].gcv2Lot, sansPose: '—' });
    L.push(ligneColonne('GCV2 dans le lot, base', e('b')), ligneColonne('GCV2 dans le lot, actuel', e('a')), '');
    const b = x.gcv2Lot.budgetActuel;
    L.push(`Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm ${b.p50.n}/${b.juges} (${f1(b.p50.taux)} %, borne haute ${f1(b.p50.wilson95)} %) ${b.p50.tenu === false ? '**DÉPASSÉ**' : b.p50.tenu ? 'tenu' : '—'} ; mauvaise voie ${b.mauvaiseVoie.n}/${b.juges} (${f1(b.mauvaiseVoie.taux)} %) ${b.mauvaiseVoie.tenu === false ? '**DÉPASSÉ**' : b.mauvaiseVoie.tenu ? 'tenu' : '—'}.`, '');
    for (const col of ['sansPasse', 'avecPasse']) {
      const c = x.colonnes[col].listes, nb = k => c[k].length;
      L.push(`Par cut, ${col === 'sansPasse' ? 'sans passe' : 'avec passe'} : perdus ${nb('perdus')}, dégradés > 2 mm ${nb('degrades')}, gagnés > 2 mm ${nb('gagnes')}, nouvellement posés ${nb('nouveaux')}${nb('perdus') ? ` ; perdus : ${c.perdus.map(p => `${p.lot} ${p.cut}`).join(', ')}` : ''}${nb('degrades') ? ` ; dégradés : ${c.degrades.map(p => `${p.lot} ${p.cut} (${f1(p.mmBase)} → ${f1(p.mm)})`).join(', ')}` : ''}.`);
    }
    L.push('');
  }
  L.push('## Vitesse (critère 6-i)', '');
  if (!rap.vitesse.controlee) L.push(rap.vitesse.raison, '');
  else {
    L.push(`Méthode : ${rap.vitesse.methode} ; seuil ${rap.vitesse.seuil} ; temps de calcul du banc par cut (analyse + décision + passe).`, '', '| Lot | Base médiane | Médiane | Écart | Base p90 | p90 | Écart |', '|---|---|---|---|---|---|---|');
    for (const l of rap.vitesse.lots) L.push(l.statut ? `| ${l.nom} | ${l.statut} | | | | | |` : `| ${l.nom} | ${f1(l.baseMedMs)} ms | ${f1(l.medMs)} ms | ${f1(l.ecartMed)} % | ${f1(l.baseP90Ms)} ms | ${f1(l.p90Ms)} ms | ${f1(l.ecartP90)} % |`);
    L.push('');
  }
  return L.join('\n') + '\n';
}

/* ------------------------------------------------------------------ rejouer (lots hors dépôt) */
function rejouer(base, lots, dossierSortie, { repetitions = 1, racine = path.resolve(__dirname, '..') } = {}) {
  const BL = process.env.BANANE_LOTS;
  if (!BL) throw new GardeNonRendue('--rejouer : dossier des lots archivés absent (variable BANANE_LOTS)');
  const sorties = new Map();
  for (const l of lots) {
    const d = path.join(BL, l.nom), F = l.fichiers || {};
    const corpus = (F.corpus || []).map(c => path.join(d, c)), journal = path.join(d, F.journal || ''), liste = F.liste ? path.join(d, F.liste) : null;
    for (const f of [journal, ...corpus, ...(liste ? [liste] : [])]) if (!fs.existsSync(f)) throw new GardeNonRendue(`lot manquant ${l.nom} : ${f}`);
    let meilleur = null;
    for (let k = 0; k < repetitions; k++) {
      const sortie = path.join(dossierSortie, `r-${l.nom}${repetitions > 1 ? '.' + k : ''}.jsonl`);
      const p = spawnSync(process.execPath, ['--max-old-space-size=4500', path.join(racine, 'tools', 'banc-differes.cjs'), 'rejouer', '--partie', l.bancPartie || l.partie, '--journal', journal,
        ...corpus.flatMap(c => ['--corpus', c]), '--lot', l.lot, '--profils', 'base,L1-se', ...(liste ? ['--liste', liste] : []), '--juger-partie-reservee', '--chrono', '--sortie', sortie],
        { encoding: 'utf8', env: { ...process.env, BANC_LEVIERS: JSON.stringify(base.banc.leviers || {}) }, maxBuffer: 64 * 1024 * 1024 });
      if (p.status !== 0) throw Error(`rejeu de ${l.nom} : ${(p.stderr || '').slice(-400)}`);
      const t = tempsLot(J.lireRejeu(fs.readFileSync(sortie, 'utf8')).lignes, null);
      if (!meilleur || (t && t.totalMedMs < meilleur.t.totalMedMs)) meilleur = { sortie, t };
    }
    sorties.set(l.nom, meilleur.sortie);
  }
  return sorties;
}

/* ------------------------------------------------------------------ vérité depuis l'Écho (méthode des vérités de la 3:0) */
/* Cut rouge du lot : la pose de départ de l'Écho doit être celle du lot (écartement à ±2 mm), référence = dernière validation de l'opérateur, en
 * décalages profil depuis la pose de départ. Cut posé par le lot : départ de l'Écho = pose d'Ariane, vérité = pose réelle du lot + correction de l'Écho.
 * `avecRegle` ajoute les cuts « visités sans action » (règle de la jointure). Rend { verite, stat }. */
function veriteDepuisEcho(lignes, micParCut, { avecRegle = false } = {}) {
  const verite = {}, stat = { cuts: lignes.length, rouges: 0, verts: 0, retenus: 0, exclus: {} };
  const ex = (k) => { stat.exclus[k] = (stat.exclus[k] || 0) + 1; };
  for (const l of lignes) {
    const rouge = !l.reel.pose; stat[rouge ? 'rouges' : 'verts']++;
    const m = micParCut.get(l.cut);
    if (!m) { ex('absent-de-l-echo'); continue; }
    if (!m.rails) { ex('sans-reference:' + m.raison); continue; }
    if (m.ref === 'visite-bon' && !avecRegle) { ex('visite-sans-action'); continue; }
    let v;
    if (rouge) { if (!fini(m.ecartDepartMm) || !fini(l.ecartDepartMm) || Math.abs(m.ecartDepartMm - l.ecartDepartMm) > 2) { ex('depart-different'); continue; } v = { mic: m.rails, src: 'echo' }; }
    else { if (!l.reel.decal) { ex('pose-reelle-sans-decal'); continue; } v = { mic: Object.fromEntries(['left', 'right'].map(s => [s, l.reel.decal[s].map((x, i) => Math.round((x + m.rails[s][i]) * 100) / 100)])), src: 'echo-pose-reelle' }; }
    if (m.ref === 'visite-bon') v.src += '-visite-bon';
    verite[l.cut] = v; stat.retenus++;
  }
  return { verite, stat };
}

/* ------------------------------------------------------------------ sceller */
function sceller({ manifeste, rejeux, verites, commit, version, sortie, vitesseSortie = null, note = null }) {
  if (!commit || !/^[0-9a-f]{7,40}$/.test(commit)) throw new GardeNonRendue('sceller : --commit SHA requis');
  if (!version) throw new GardeNonRendue('sceller : --version requis');
  const M = JSON.parse(fs.readFileSync(manifeste, 'utf8')), dossier = path.dirname(path.resolve(sortie)), dV = path.join(dossier, 'verites');
  fs.mkdirSync(dV, { recursive: true });
  const lotsJ = [], lots = [], cuts = {}, leviersVus = new Set(), parametresVus = new Set();
  for (const l of M.lots) {
    const fr = path.join(rejeux, `r-${l.nom}.jsonl`), fv = path.join(verites, l.verite);
    if (!fs.existsSync(fr)) throw new GardeNonRendue(`sceller : rejeu absent pour ${l.nom} (${fr})`);
    if (!fs.existsSync(fv)) throw new GardeNonRendue(`sceller : vérité absente pour ${l.nom} (${fv})`);
    const texte = fs.readFileSync(fr, 'utf8'), bufV = fs.readFileSync(fv);
    fs.writeFileSync(path.join(dV, l.verite), bufV);
    const j = jugerLot(l, texte, J.lireVerite(JSON.parse(bufV.toString('utf8'))));
    leviersVus.add(JSON.stringify(j.entete.l1e && j.entete.l1e.leviers)); parametresVus.add(JSON.stringify(j.entete.parametres));
    lotsJ.push(j); cuts[l.nom] = j.cuts;
    lots.push({ ...l, partieBanc: j.entete.partie, versionLot: j.entete.version_lot, cuts: j.entete.traites, rejeuSha256: sha256(Buffer.from(texte, 'utf8')), temps: j.temps });
  }
  if (leviersVus.size !== 1) throw new GardeNonRendue('sceller : les rejeux n\'ont pas tous les mêmes leviers');
  const e0 = lotsJ[0].entete;
  const base = { format: FORMAT_BASE, version, commit, date: new Date().toISOString().slice(0, 10), note,
    machine: { cpus: os.cpus().length, node: process.version },
    banc: { outil: 'tools/banc-differes.cjs rejouer --chrono', juge: 'tools/juger.cjs', profils: ['base', 'L1-se'], leviers: M.leviers || null, leviersEntete: e0.l1e && e0.l1e.leviers, parametres: e0.parametres ? { version: e0.parametres.version, sha256: e0.parametres.sha256 } : null },
    lots, groupes: groupesDe(lots, lotsJ), cuts };
  fs.writeFileSync(sortie, JSON.stringify(base, null, 1) + '\n');
  const fichiers = [path.basename(sortie), ...M.lots.map(l => path.join('verites', l.verite))];
  const lignesSommes = ecrireSommes(dossier, fichiers);
  let vitesse = null;
  if (vitesseSortie) {
    vitesse = { format: FORMAT_VITESSE, version, commit, date: base.date, machine: base.machine, methode: 'une seule mesure par lot (rejeu de la base)',
      definition: 'temps de calcul du banc par cut, ms : analyse = moteur (science du cut) ; décision = profils base et L1-se ; passe = deuxième passe (cuts redécidés) ; total = somme',
      lots: lots.map(l => ({ nom: l.nom, lotId: l.lot, ...(l.temps || {}) })) };
    fs.mkdirSync(path.dirname(path.resolve(vitesseSortie)), { recursive: true });
    fs.writeFileSync(vitesseSortie, JSON.stringify(vitesse, null, 1) + '\n');
    const dv = path.dirname(path.resolve(vitesseSortie)), existants = fs.existsSync(path.join(dv, 'SHA256SUMS')) ? [...lireSommes(path.join(dv, 'SHA256SUMS')).keys()].filter(f => fs.existsSync(path.join(dv, f))) : [];
    ecrireSommes(dv, [...new Set([...existants, path.basename(vitesseSortie)])]);
  }
  return { base, sommes: lignesSommes, vitesse };
}

/* ------------------------------------------------------------------ ligne de commande */
function args(argv) {
  const o = { mode: 'comparer', lots: 'tous', repetitions: 1 };
  let i = 0;
  if (argv[0] && !argv[0].startsWith('--')) { o.mode = argv[0]; i = 1; }
  for (; i < argv.length; i++) {
    const k = argv[i], v = () => { const x = argv[++i]; if (x === undefined) throw Error('valeur manquante après ' + k); return x; };
    if (k === '--base') o.base = v(); else if (k === '--rejeux') o.rejeux = v(); else if (k === '--rejouer') o.rejouer = true; else if (k === '--lots') o.lots = v();
    else if (k === '--vitesse') { o.vitesse = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : path.join(__dirname, '..', 'datasets', 'vitesse', 'base-banc-test19.json'); }
    else if (k === '--repetitions') o.repetitions = Number(v()); else if (k === '--sortie') o.sortie = v(); else if (k === '--manifeste') o.manifeste = v(); else if (k === '--verites') o.verites = v();
    else if (k === '--commit') o.commit = v(); else if (k === '--version') o.version = v(); else if (k === '--vitesse-sortie') o.vitesseSortie = v(); else if (k === '--note') o.note = v();
    else if (k === '--rejeu') o.rejeu = v(); else if (k === '--echo') o.echo = v(); else if (k === '--partie') o.partie = Number(v()); else if (k === '--avec-regle') o.avecRegle = true;
    else if (k === '--code') o.code = v();
    else throw Error('argument inconnu : ' + k);
  }
  if (!['comparer', 'sceller', 'verite'].includes(o.mode)) throw Error('mode : comparer | sceller | verite');
  if (!Number.isInteger(o.repetitions) || o.repetitions < 1) throw Error('--repetitions : entier ≥ 1');
  return o;
}
function codeCourant(racine) { const p = spawnSync('git', ['-C', racine, 'rev-parse', 'HEAD'], { encoding: 'utf8' }); return p.status === 0 ? p.stdout.trim() : null; }
function main(argv, { ecrire = s => process.stdout.write(s) } = {}) {
  const a = args(argv);
  if (a.mode === 'verite') {
    if (!a.rejeu || !a.echo || !Number.isInteger(a.partie) || !a.sortie) throw Error('verite --rejeu R.jsonl --echo DOSSIER[,…] --partie N --sortie V.json [--avec-regle]');
    const P = require('./gcv2-predire-differes.cjs'), R = J.lireRejeu(fs.readFileSync(a.rejeu, 'utf8'));
    const mic = P.micDepuisEcho(a.echo.split(','), a.partie, R.lignes.map(l => l.cut)), { verite, stat } = veriteDepuisEcho(R.lignes, mic, { avecRegle: !!a.avecRegle });
    fs.writeFileSync(a.sortie, JSON.stringify(verite) + '\n'); ecrire(JSON.stringify(stat) + '\n'); return RETOUR.VERT;
  }
  if (a.mode === 'sceller') {
    if (!a.manifeste || !a.rejeux || !a.verites || !a.sortie) throw Error('sceller --manifeste M.json --rejeux DOSSIER --verites DOSSIER --commit SHA --version V --sortie BASE.json [--vitesse-sortie V.json]');
    const r = sceller({ manifeste: a.manifeste, rejeux: a.rejeux, verites: a.verites, commit: a.commit, version: a.version, sortie: a.sortie, vitesseSortie: a.vitesseSortie, note: a.note || null });
    ecrire(`base scellée : ${a.sortie}\n${r.sommes.join('\n')}\n`); return RETOUR.VERT;
  }
  if (!a.base) throw Error('comparer --base BASE.json (--rejeux DOSSIER | --rejouer) [--lots tous|NOM,NOM] [--vitesse [V.json]] [--repetitions N] [--sortie DOSSIER]');
  const { base, dossier } = lireBaseScellee(a.base);
  const lots = a.lots === 'tous' ? base.lots : base.lots.filter(l => a.lots.split(',').includes(l.nom));
  if (a.lots !== 'tous') for (const n of a.lots.split(',')) if (!base.lots.some(l => l.nom === n)) throw new GardeNonRendue(`lot inconnu de la base : ${n}`);
  let fichiers;
  if (a.rejouer) {
    const d = a.sortie ? path.join(a.sortie, 'rejeux') : fs.mkdtempSync(path.join(os.tmpdir(), 'garde-gcv2-'));
    fs.mkdirSync(d, { recursive: true }); fichiers = rejouer(base, lots, d, { repetitions: a.repetitions });
  } else {
    if (!a.rejeux) throw Error('--rejeux DOSSIER ou --rejouer');
    fichiers = new Map(lots.map(l => [l.nom, path.join(a.rejeux, `r-${l.nom}.jsonl`)]));
  }
  const actuels = [];
  for (const l of lots) {
    const f = fichiers.get(l.nom);
    if (!f || !fs.existsSync(f)) throw new GardeNonRendue(`lot manquant : rejeu de ${l.nom} absent (${f})`);
    actuels.push(jugerLot(l, fs.readFileSync(f, 'utf8'), J.lireVerite(JSON.parse(fs.readFileSync(path.join(dossier, 'verites', l.verite), 'utf8')))));
  }
  const baseRestreinte = lots.length === base.lots.length ? base : { ...base, lots, groupes: Object.fromEntries(Object.entries(groupesDe(lots, lots.map(l => ({ nom: l.nom, cuts: base.cuts[l.nom] }))))) };
  let vitesseBase = null;
  if (a.vitesse) { if (!fs.existsSync(a.vitesse)) throw new GardeNonRendue(`base de vitesse absente : ${a.vitesse}`); vitesseBase = JSON.parse(fs.readFileSync(a.vitesse, 'utf8')); if (!vitesseBase.commit) throw new GardeNonRendue('base de vitesse sans commit'); vitesseBase = { ...vitesseBase, lots: vitesseBase.lots.filter(l => lots.some(x => x.nom === l.nom)) }; }
  const rap = comparer(baseRestreinte, actuels, { vitesseBase, methodeVitesse: a.rejouer && a.repetitions > 1 ? `plus petite médiane de ${a.repetitions} répétitions par lot` : 'une seule mesure par lot' });
  rap.code = { commit: a.code || codeCourant(path.resolve(__dirname, '..')) };
  rap.lots = actuels.map(x => ({ nom: x.nom, cuts: x.cuts.length, temps: x.temps }));
  const md = rapportMarkdown(rap);
  if (a.sortie) { fs.mkdirSync(a.sortie, { recursive: true }); fs.writeFileSync(path.join(a.sortie, 'garde.md'), md); fs.writeFileSync(path.join(a.sortie, 'garde.json'), JSON.stringify(rap, null, 1) + '\n'); }
  ecrire(`garde-gcv2 : retour ${rap.retour}${rap.reculs.length ? ` ; ${rap.reculs.length} recul(s) de qualité` : ''}${rap.reculsVitesse.length ? ` ; ${rap.reculsVitesse.length} recul(s) de vitesse` : ''}${rap.signalements.length ? ` ; ${rap.signalements.length} signalement(s)` : ''}\n`);
  for (const s of [...rap.reculs, ...rap.reculsVitesse]) ecrire(`  recul : ${s}\n`);
  for (const s of rap.signalements) ecrire(`  signalé : ${s}\n`);
  return rap.retour;
}

module.exports = { FORMAT_BASE, FORMAT_VITESSE, FORMAT_RAPPORT, RETOUR, BUDGET_D223, GardeNonRendue, lireSommes, ecrireSommes, lireBaseScellee, tempsLot, jugerLot, agregerGroupe, groupesDe,
  comparerColonne, comparer, rapportMarkdown, veriteDepuisEcho, sceller, rejouer, args, main };
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { if (e instanceof GardeNonRendue) { process.stderr.write(`garde-gcv2 : garde non rendue : ${e.message}\n`); process.exitCode = RETOUR.NON_RENDUE; } else { process.stderr.write(`garde-gcv2 : erreur d'outil : ${e && e.stack || e}\n`); process.exitCode = RETOUR.OUTIL; } }
}
