#!/usr/bin/env node
'use strict';
/*
 * jeu-apprentissage.cjs — JEU D'APPRENTISSAGE v1 (chantier E5, plan 5.0).
 *
 * Construit, hors ligne, un fichier JSON lignes à partir de la table de jointure
 * Écho ↔ Orbite (tools/jointure-echo-orbite.cjs --sortie table.json). Une ligne par cut
 * joint (vu à la fois au journal Orbite et à l'Écho) :
 *   - les TRAITS d'Ariane, tels que le journal les a consignés (proposition du moteur,
 *     ombre B1, motif de différé, déplacement posé, voisinage) ;
 *   - l'ÉTIQUETTE humaine : correction de Mic en repère profil, classe (posé / différé),
 *     seuils à 5 et 10 mm, faux vert.
 *
 *   node tools/jeu-apprentissage.cjs --jointure TABLE.json [--sortie JEU.jsonl]
 *        [--sans-poses | --avec-poses] [--avec-hors-journal] [--fenetre 3]
 *
 * --sans-poses (par défaut) : aucune coordonnée absolue dans la sortie. --avec-poses
 * recopie les poses de la table (scène de l'Écho / du journal) : DONNÉES PRIVÉES, à
 * garder dans le scratchpad, jamais dans le dépôt.
 * --avec-hors-journal : ajoute les cuts que Mic a visités sans que le journal les
 * connaisse (étiquette seule, traits vides) ; sans cette option, seuls les cuts joints.
 *
 * Format : docs dans fiches/E5_METRIQUES.md. Rien n'est inventé : un champ absent de la
 * table est null. Les traits ne contiennent jamais de grandeur issue de la référence
 * humaine (frontière anti-fuite).
 */
const fs = require('node:fs'), path = require('node:path');

const FORMAT = 'ariane-jeu-apprentissage-v1';
const SEUIL_5 = 5, SEUIL_10 = 10;
const r2 = v => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const num = v => (Number.isFinite(v) ? v : null);

function lireOptions(argv) {
  const o = { jointure: null, sortie: null, poses: false, horsJournal: false, fenetre: 3 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--jointure') o.jointure = argv[++i];
    else if (a === '--sortie') o.sortie = argv[++i];
    else if (a === '--sans-poses') o.poses = false;
    else if (a === '--avec-poses') o.poses = true;
    else if (a === '--avec-hors-journal') o.horsJournal = true;
    else if (a === '--fenetre') o.fenetre = Number(argv[++i]);
    else throw new Error(`option inconnue : ${a}`);
  }
  if (!Number.isInteger(o.fenetre) || o.fenetre < 1) throw new Error('--fenetre : entier ≥ 1');
  return o;
}

/* Un écart humain : ne garde que les mesures (mm), jamais de coordonnée. */
function correction(e) {
  if (!e) return null;
  const out = {};
  for (const cle of ['longitudinalMm', 'lateralMm', 'verticalMm', 'dist3dMm']) {
    if (Number.isFinite(e[cle])) out[cle] = r2(e[cle]);
  }
  out.repere = e.repere || null;
  return out;
}

/* Voisinage : classes des cuts du journal de numéro INFÉRIEUR dans la fenêtre. Seuls les
 * numéros inférieurs sont donnés : le lot avance en ordre croissant, les cuts de numéro
 * supérieur ne sont pas encore décidés quand Ariane propose. */
function voisinage(ligne, parCut, fenetre) {
  let poses = 0, differes = 0, autres = 0, dernier = null;
  for (let d = 1; d <= fenetre; d++) {
    const v = parCut.get(ligne.cut - d);
    if (!v) continue;
    if (v.classe === 'posee') poses++; else if (v.classe === 'differee') differes++; else autres++;
    if (!dernier) dernier = { ecart: d, classe: v.classe };
  }
  return { fenetre, posesAvant: poses, differesAvant: differes, autresAvant: autres, plusProche: dernier };
}

function etiquette(l) {
  const ref = l.referenceHumaine === 'observee';
  const max = ref && l.ecartHumain ? num(l.ecartHumain.maxDist3dMm) : null;
  const pose = l.classe === 'posee', differe = l.classe === 'differee';
  return {
    referenceHumaine: l.referenceHumaine || null,
    etiquetteEcho: l.etiquetteEcho || null,
    pose: l.dansJournal ? pose : null,
    differe: l.dansJournal ? differe : null,
    base: l.base || null,
    correctionMm: ref ? { gauche: correction(l.ecartHumain?.gauche), droite: correction(l.ecartHumain?.droite), maxDist3dMm: r2(max) } : null,
    corrige5mm: max === null ? null : max > SEUIL_5,
    corrige10mm: max === null ? null : max > SEUIL_10,
    fauxVert: pose && max !== null ? max > SEUIL_10 : null,
  };
}

function traits(l, parCut, fenetre) {
  if (!l.dansJournal) return null;
  return {
    propositionMoteur: l.propositionMoteur || null,
    b1Ombre: l.b1Ombre || null,
    differe: l.motifDiffere || null,
    deplacementAriane: l.arianeDeplacement ? { gauche: correction(l.arianeDeplacement.gauche), droite: correction(l.arianeDeplacement.droite) } : null,
    voisinage: voisinage(l, parCut, fenetre),
  };
}

function construire(table, options = {}) {
  const o = { poses: false, horsJournal: false, fenetre: 3, ...options };
  if (table?.format !== 'ariane-jointure-echo-orbite-v1' || !Array.isArray(table.table)) throw new Error('entrée : table `ariane-jointure-echo-orbite-v1` attendue');
  const lignes = table.table;
  /* Voisinage : indexé par partie puis par cut, sur les cuts du journal. */
  const index = new Map();
  for (const l of lignes) if (l.dansJournal) {
    if (!index.has(l.partie)) index.set(l.partie, new Map());
    index.get(l.partie).set(l.cut, l);
  }
  const retenues = lignes.filter(l => l.dansEcho && (l.dansJournal || o.horsJournal))
    .sort((a, b) => a.partie - b.partie || a.cut - b.cut);
  const cuts = retenues.map(l => {
    const ligne = {
      type: 'cut', partie: l.partie, cut: l.cut, classe: l.classe, joint: !!(l.dansEcho && l.dansJournal),
      traits: traits(l, index.get(l.partie) || new Map(), o.fenetre),
      etiquette: etiquette(l),
      qualite: { visitesEcho: num(l.visitesEcho), visiteReference: num(l.visiteReference), validationsDeLaVisite: num(l.validationsDeLaVisite), statutEcho: l.statutEcho || null },
    };
    if (o.poses) ligne.poses = { ariane: l.poseAriane || null, humaineFinale: l.poseHumaineFinale || null };
    return ligne;
  });
  const avecRef = cuts.filter(c => c.etiquette.referenceHumaine === 'observee');
  const compte = f => cuts.filter(f).length;
  const entete = {
    type: 'entete', format: FORMAT, source: { format: table.format, base: table.options?.base ?? null, cutsJoints: table.resume?.cutsJoints ?? null },
    options: { poses: o.poses, horsJournal: o.horsJournal, fenetre: o.fenetre },
    cuts: cuts.length, avecReference: avecRef.length,
    parClasse: Object.fromEntries([...new Set(cuts.map(c => c.classe))].sort().map(k => [k, compte(c => c.classe === k)])),
    seuilsMm: [SEUIL_5, SEUIL_10],
    absents: ['zone (M1)', 'raison de la correction (E3)', 'points par rail', 'hors-journal sans traits'],
  };
  return { entete, cuts };
}

function enJsonLignes({ entete, cuts }) {
  return [entete, ...cuts].map(x => JSON.stringify(x)).join('\n') + '\n';
}

function resumeTexte({ entete }) {
  const cl = Object.entries(entete.parClasse).map(([k, n]) => `${k} ${n}`).join(', ');
  return [`Jeu d'apprentissage ${entete.format}`,
    `  ${entete.cuts} cuts (${cl}), dont ${entete.avecReference} avec référence humaine.`,
    `  Coordonnées absolues : ${entete.options.poses ? 'INCLUSES (données privées)' : 'aucune (--sans-poses)'}.`].join('\n');
}

module.exports = { construire, enJsonLignes, lireOptions, FORMAT };

if (require.main === module) {
  let o;
  try { o = lireOptions(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (!o.jointure) { console.error('Usage : --jointure TABLE.json [--sortie JEU.jsonl] [--sans-poses|--avec-poses] [--avec-hors-journal] [--fenetre 3]'); process.exit(2); }
  const jeu = construire(JSON.parse(fs.readFileSync(o.jointure, 'utf8')), o);
  if (o.sortie) fs.writeFileSync(o.sortie, enJsonLignes(jeu));
  if (o.poses) console.error('ATTENTION : --avec-poses recopie des coordonnées absolues ; ne jamais les versionner.');
  console.log(resumeTexte(jeu) + (o.sortie ? `\n  Écrit : ${path.basename(o.sortie)}` : ''));
}
