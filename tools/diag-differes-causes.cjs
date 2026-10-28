#!/usr/bin/env node
'use strict';
/*
 * diag-differes-causes.cjs — classe les cuts restés différés, par cause, en lecture seule.
 *
 *   node tools/diag-differes-causes.cjs --journal J.json [--journal J2.json …]
 *   node tools/diag-differes-causes.cjs --dossier DOSSIER
 *
 * Le dossier est un argument : aucun chemin vers banane-data n'est écrit ici. Un dossier de journaux
 * (`ariane-journal-v4-*.json`, ou tout `*.json` qui porte `events`) ou un dossier de collectes zip
 * (lu par tools/exports-lots.cjs, une archive à la fois). Rien n'est écrit.
 *
 * Définitions, les mêmes que tools/diag-differes.cjs pour le lot : un cut traité dont la dernière
 * décision du lot n'est pas suivie d'une validation est différé. Un lot de moins de 5 cuts est un
 * fragment, hors base. Deux copies du même lot : on garde la plus complète.
 *
 * Hors cibles : un cut que le lot voit en premier passage (`first-pass`, commande `engine` /
 * `first-pass`) sans le différer et sans le valider. C'est un cut déjà vert sur lequel le lot
 * s'est ouvert avant de passer au suivant. Il ne compte ni dans les cibles ni dans les différés.
 *
 * Une cause par différé, dans cet ordre (la première qui s'applique) :
 *   molette-sans-effet     motif hors-vue, et un geste `molette` ou un `deplacer-vue` a laissé la
 *                          caméra immobile. Récupérable si chaque côté du plan a un glissement
 *                          (`panPx`) au plus égal à `glissementPxMax` (250 px si le plan ne le dit pas).
 *   passe-poserait         la première passe a décidé « poserait » et la garde ne bloque pas.
 *   passe-bloquee-garde    « poserait » et la garde bloque.
 *   nuage-absent           aucun motif de rail, ou motif `input`.
 *   dessus-insuffisant     motif de rail `minTop`.
 *   ecartement-hors-contrat  motif `gauge-out-of-contract` et aucun rail résolu.
 *   ambiguite              motif `ambiguity`.
 *   flanc                  motif `flank`.
 *   pente                  motif `slope`.
 *   repere                 motif `rsf` ou `frame`.
 *   motif du lot           sinon (`sans-appui`, `reprise-sans-minimum`, …).
 *
 * Récupérable : « oui » pour molette-sans-effet dans la limite de glisser, et pour passe-poserait
 * (la passe a une pose ; ce outil ne juge pas cette pose). « non » sinon. La part est celle des cibles.
 *
 * Le texte ne contient aucun identifiant de lot.
 */
const fs = require('node:fs'), path = require('node:path');
const D = require('./diag-differes.cjs');

const FRAGMENT_MAX = 5;
const PAN_DEFAUT = 250;

function lireJournal(fichier) {
  const brut = fs.readFileSync(fichier);
  const texte = /\.gz$/i.test(fichier) ? require('node:zlib').gunzipSync(brut).toString('utf8') : brut.toString('utf8');
  return JSON.parse(texte);
}

function journauxDuDossier(dossier) {
  const noms = fs.readdirSync(dossier);
  const jsons = noms.filter(n => /\.json$/i.test(n)).map(n => path.join(dossier, n));
  const directs = [];
  for (const f of jsons) {
    let j;
    try { j = lireJournal(f); } catch { continue; }
    if (j && Array.isArray(j.events)) directs.push({ fichier: f, journal: j });
  }
  if (directs.length) return directs;
  let X;
  try { X = require('./exports-lots.cjs'); } catch { return []; }
  const out = [];
  for (const j of X.journaux(dossier)) out.push({ fichier: path.join(j.collection, j.nom), journal: JSON.parse(j.lire().toString('utf8')) });
  return out;
}

function indexEvenements(journal) {
  const vue = new Map(), passe = new Map();
  const vide = () => ({ decisions: 0, gestes: 0, decisionsImmobiles: 0, gestesImmobiles: 0, pans: [], maxPan: null });
  const cle = e => e && e.identity && Number.isInteger(e.identity.cut) ? e.identity.part + ':' + e.identity.cut : null;
  for (const e of journal && Array.isArray(journal.events) ? journal.events : []) {
    const k = cle(e);
    if (!k) continue;
    if (e.type === 'deplacer-vue' || e.type === 'molette') {
      const v = vue.get(k) || vide();
      if (e.type === 'deplacer-vue') {
        v.decisions++;
        if (String(e.refus || '').includes('camera-immobile')) v.decisionsImmobiles++;
        const plan = e.plan || {};
        const max = Number.isFinite(plan.glissementPxMax) ? plan.glissementPxMax : PAN_DEFAUT;
        v.maxPan = v.maxPan == null ? max : Math.min(v.maxPan, max);
        for (const c of Object.values(plan.cotes || {})) if (Number.isFinite(c.panPx)) v.pans.push(c.panPx);
      } else {
        v.gestes++;
        if (e.camera === 'immobile') v.gestesImmobiles++;
      }
      vue.set(k, v);
    } else if (e.type === 'passe-differes-ombre' && e.passe === 1) {
      if (!passe.has(k)) passe.set(k, { decision: e.decision || null, motif: e.motif || null, garde: e.garde || null });
    }
  }
  return { vue, passe };
}

function dejaVert(c) {
  return !c.pose && c.stage === 'first-pass' && c.motif && c.motif.code === 'pose-non-validee'
    && c.commande && c.commande.action === 'engine' && (c.commande.raison == null || c.commande.raison === 'first-pass');
}

function sousMotifs(c) {
  const m = c.motif && c.motif.moteur && c.motif.moteur.motifs || {};
  return [m.left, m.right].filter(x => typeof x === 'string' && x);
}

function classer(c, vue, passe) {
  const code = c.motif && c.motif.code || 'indetermine';
  const motifs = sousMotifs(c);
  const horsVue = code === 'hors-vue' || /hors-vue/.test(c.commande && c.commande.raison || '') || /hors-vue/.test(c.reason || '');
  if (horsVue && vue && (vue.gestesImmobiles > 0 || vue.decisionsImmobiles > 0)) {
    const tient = vue.pans.length > 0 && vue.pans.every(p => p <= (vue.maxPan == null ? PAN_DEFAUT : vue.maxPan));
    return { cause: 'molette-sans-effet', recuperable: tient ? 'oui' : 'non', motifLot: code,
      gestesMolette: vue.gestes, camerasImmobiles: vue.gestesImmobiles };
  }
  if (passe && passe.decision === 'poserait') {
    const bloque = !!(passe.garde && passe.garde.bloque);
    return { cause: bloque ? 'passe-bloquee-garde' : 'passe-poserait', recuperable: bloque ? 'non' : 'oui', motifLot: code,
      detail: passe.garde && passe.garde.motif || null };
  }
  let cause = code;
  if (!motifs.length || motifs.includes('input')) cause = 'nuage-absent';
  else if (motifs.includes('minTop')) cause = 'dessus-insuffisant';
  else if (motifs.includes('gauge-out-of-contract') && !(c.motif && c.motif.moteur && c.motif.moteur.resolus)) cause = 'ecartement-hors-contrat';
  else if (motifs.includes('ambiguity')) cause = 'ambiguite';
  else if (motifs.includes('flank')) cause = 'flanc';
  else if (motifs.includes('slope')) cause = 'pente';
  else if (motifs.includes('rsf') || motifs.includes('frame')) cause = 'repere';
  return { cause, recuperable: 'non', motifLot: code, detail: passe ? (passe.decision + (passe.motif ? ':' + passe.motif : '')) : null };
}

function analyser(entrees) {
  const vus = new Map(), fragments = new Set();
  for (const { journal } of entrees) {
    const idx = indexEvenements(journal);
    for (const L of D.lotsDuJournal(journal)) {
      if (L.traites < FRAGMENT_MAX) { if (!vus.has(L.id)) fragments.add(L.id); continue; }
      fragments.delete(L.id);
      const old = vus.get(L.id);
      if (old && old.traitesBruts >= L.traites) continue;
      vus.set(L.id, { L, idx, traitesBruts: L.traites });
    }
  }
  let cibles = 0, differes = 0, horsCibles = 0, traites = 0;
  const causes = new Map();
  const versions = new Map(), parties = [];
  for (const { L, idx } of vus.values()) {
    let ciblesLot = 0, differesLot = 0, hors = 0;
    for (const c of L.cuts) {
      if (dejaVert(c)) { hors++; continue; }
      ciblesLot++;
      if (c.pose) continue;
      differesLot++;
      const k = L.partie + ':' + c.cut;
      const x = classer(c, idx.vue.get(k), idx.passe.get(k));
      const row = causes.get(x.cause) || { cause: x.cause, nombre: 0, recuperable: x.recuperable, motifs: new Map(), details: new Map(), gestesMolette: 0, camerasImmobiles: 0 };
      if (row.recuperable !== x.recuperable) row.recuperable = 'mixte';
      row.nombre++;
      row.motifs.set(x.motifLot, (row.motifs.get(x.motifLot) || 0) + 1);
      if (x.detail) row.details.set(x.detail, (row.details.get(x.detail) || 0) + 1);
      row.gestesMolette += x.gestesMolette || 0;
      row.camerasImmobiles += x.camerasImmobiles || 0;
      causes.set(x.cause, row);
    }
    cibles += ciblesLot; differes += differesLot; horsCibles += hors; traites += L.traites;
    const v = L.version || '?'; versions.set(v, (versions.get(v) || 0) + 1);
    parties.push({ partie: L.partie, version: L.version || null, cibles: ciblesLot, differes: differesLot, horsCibles: hors });
  }
  const part = (n, d) => d ? Math.round(1000 * n / d) / 10 : 0;
  const liste = [...causes.values()].map(c => ({
    cause: c.cause, nombre: c.nombre, partCibles: part(c.nombre, cibles), partDifferes: part(c.nombre, differes),
    recuperable: c.recuperable, motifLot: [...c.motifs.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => n > 1 ? k + ' ' + n : k).join(', '),
    detail: [...c.details.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => k + (n > 1 ? ' ' + n : '')).join(', '),
    gestesMolette: c.gestesMolette, camerasImmobiles: c.camerasImmobiles,
  })).sort((a, b) => b.nombre - a.nombre || a.cause.localeCompare(b.cause));
  const population = { lots: vus.size, fragments: fragments.size, traites, cibles, differes, horsCibles,
    taux: part(differes, cibles), versions: [...versions.entries()].map(([v, n]) => v + (n > 1 ? ' ×' + n : '')).join(', '), parties };
  return { population, causes: liste, texte: texte(population, liste) };
}

function texte(population, causes) {
  const lignes = [];
  lignes.push(`Lots ${population.lots}, fragments exclus ${population.fragments}, cibles ${population.cibles}, différés ${population.differes} (${population.taux} %), hors cibles ${population.horsCibles}.`);
  lignes.push(`Versions : ${population.versions || '—'}.`);
  lignes.push('');
  lignes.push('| Cause | Nombre | Part des cibles | Part des différés | Récupérable |');
  lignes.push('|---|--:|--:|--:|---|');
  for (const c of causes) lignes.push(`| ${c.cause} | ${c.nombre} | ${c.partCibles} % | ${c.partDifferes} % | ${c.recuperable} |`);
  if (!causes.length) lignes.push('| — | 0 | 0 % | 0 % | — |');
  lignes.push('');
  for (const c of causes) if (c.motifLot || c.detail) lignes.push(`- ${c.cause} : motif du lot ${c.motifLot || '—'}${c.detail ? ' ; détail ' + c.detail : ''}.`);
  lignes.push('');
  for (const p of population.parties) lignes.push(`Partie ${p.partie} ${p.version || ''} : ${p.differes} différés sur ${p.cibles} cibles${p.horsCibles ? `, ${p.horsCibles} hors cibles` : ''}.`);
  return lignes.join('\n');
}

function args(argv) {
  const journaux = [], dossiers = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--journal') journaux.push(argv[++i]);
    else if (argv[i] === '--dossier') dossiers.push(argv[++i]);
    else throw Error('argument inconnu : ' + argv[i]);
  }
  if (!journaux.length && !dossiers.length) throw Error('Usage : --journal J.json [--journal …] | --dossier DOSSIER');
  return { journaux, dossiers };
}

function main(argv) {
  const a = args(argv);
  const entrees = [];
  for (const f of a.journaux) entrees.push({ fichier: f, journal: lireJournal(f) });
  for (const d of a.dossiers) entrees.push(...journauxDuDossier(d));
  if (!entrees.length) throw Error('aucun journal');
  const R = analyser(entrees);
  process.stdout.write(R.texte + '\n');
  return R;
}

module.exports = { analyser, classer, dejaVert, journauxDuDossier, main };

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (e) { console.error(e.message || e); process.exit(1); }
}
