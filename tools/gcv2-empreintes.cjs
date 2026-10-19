#!/usr/bin/env node
'use strict';
/*
 * gcv2-empreintes.cjs — les EMPREINTES SHA-256 de la chaîne figée du jugement G1-c (fiches/PROTOCOLE_G1C.md § 1). Elles sont consignées dans
 * `datasets/gcv2-g1c-empreintes.json` AVANT l'ouverture de tout résultat de jugement ; l'audit externe les relit avec le protocole. Hors ligne, Node pur.
 *
 *   node tools/gcv2-empreintes.cjs ecrire   [--racine-jeux DIR] [--racine-cas DIR] [--date AAAA-MM-JJ] [--sortie datasets/gcv2-g1c-empreintes.json]
 *   node tools/gcv2-empreintes.cjs verifier [--racine-jeux DIR] [--racine-cas DIR] [--fichier datasets/gcv2-g1c-empreintes.json]
 *   node tools/gcv2-empreintes.cjs essai
 *
 * Trois familles de pièces :
 *  - `fichiers` : les pièces du dépôt (moteur GCV1, hauteur apprise, réglages métier figés, paramètres de la GCV2, variantes, règle prudente, zones, générateur d'hypothèses,
 *    outils d'évaluation). Chemin relatif à la racine du dépôt + SHA-256 des octets du fichier. Une pièce `provisoire` (un chantier en cours la modifie) est signalée à la
 *    vérification mais ne la fait pas échouer ; elle devra être reconsignée avant l'ouverture.
 *  - `jeux` : les jeux d'apprentissage HORS DÉPÔT (chemin relatif à la racine des jeux, SHA-256). La racine elle-même n'est pas consignée (elle change d'une machine à l'autre).
 *  - `cas` : les cas de l'extraction (`relecture-autonome extraire`) dont l'évaluateur tire la référence exacte, de la même façon.
 * `verifier` rend la liste des écarts (fichier changé, absent, ajouté) et un code de sortie non nul au moindre écart sur une pièce non provisoire.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

const FORMAT = 'ariane-gcv2-g1c-empreintes-v1';
const RACINE = path.join(__dirname, '..');
const FICHIER = path.join(RACINE, 'datasets', 'gcv2-g1c-empreintes.json');
/* [chemin, rôle, provisoire?] */
const PIECES = Object.freeze([
  ['src/engine.js', 'moteur GCV1 (inchangé)'],
  ['src/hauteur-apprise.js', 'hauteur apprise figée (apprise sur 1:17, 1:24, 1:29 et 2:1)'],
  ['datasets/reglages-figes.json', 'réglages métier figés'],
  ['datasets/gcv2-parametres.json', 'paramètres de G1-b (anciens jeux, non causaux) : historique'],
  ['datasets/gcv2-parametres-causal.json', 'paramètres de la GCV2 appris sur le jeu causal (14 parties, λ par la procédure imbriquée ; V1, sans garde de série)'],
  ['datasets/gcv2-variantes.json', 'variantes par zone (V1 est la candidate)'],
  ['datasets/gcv2-variantes-h6.json', 'variantes V1 et V1+ (D-207), déclarées avant calcul'],
  ['datasets/relecture-reglages-proposes.json', 'règle prudente figée (D-180, D-190)'],
  ['datasets/manifeste-parties.json', 'manifeste des parties (apprentissage, témoins)'],
  ['src/regles-metier.js', 'zones PN et ADV (règles métier)'],
  ['src/verts-a-controler.js', 'liste « À contrôler » des verts'],
  ['src/lot-decision.js', 'décision du lot (chaîne d\'appuis)'],
  ['src/gcv1-shadow.js', 'moteur GCV1 en ombre (proposition scientifique)'],
  ['src/native-session.js', 'entrée sans fuite d\'une visite'],
  ['tools/relecture-autonome.cjs', 'règle prudente exacte (lignes, agit, juger) et extraction'],
  ['tools/gcv2-apprendre.cjs', 'apprentissage, validation croisée, décision de paire'],
  ['tools/gcv2-evaluer.cjs', 'évaluateur unique : référence exacte, porte unique, registre'],
  ['tools/gcv2-empreintes.cjs', 'ce contrôle d\'empreintes'],
  ['tools/compteur-gcv2.cjs', 'compteur des cuts appris'],
  ['tools/manifeste-parties.cjs', 'lecture du manifeste des parties'],
  ['tools/gcv2-jeu.cjs', 'générateur d\'hypothèses et jeu causal (zones, médiane, voisins et chaîne à l\'instant de la décision)'],
  ['tools/jointure-echo-orbite.cjs', 'lecture de l\'Écho, visite sans action, référence humaine'],
  ['tools/regles-metier.cjs', 'lecture du journal du lot'],
  ['tools/verts-a-controler.cjs', 'préparation de la liste « À contrôler »'],
  ['tools/lire-volumes.cjs', 'lecture des volumes zip'],
  ['src/continuity-observer.js', 'entrée sans fuite (chunks pris autour de la pose de départ)'],
  ['src/placement-convention.js', 'convention de pose (calage)'],
  ['src/voie-recentree.js', 'voie prédite de la chaîne'],
  ['src/liste-memoire.js', 'liste d\'ESV du départ de partie (références incertaines, D-211)'],
  ['vendor/capture-core.js', 'géométrie de capture'],
]);

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const shaFichier = f => sha256(fs.readFileSync(f));
const sansRacine = (racine, f) => path.relative(racine, f).split(path.sep).join('/');
/* Tous les fichiers .jsonl (ou la liste donnée) d'un dossier, chemins relatifs triés. */
function listerDossier(racine, filtre = /\.jsonl$/) {
  const out = [];
  const marcher = d => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const p = path.join(d, e.name); if (e.isDirectory()) marcher(p); else if (filtre.test(e.name)) out.push(sansRacine(racine, p)); } };
  marcher(racine);
  return out;
}
const empreintesDe = (racine, chemins) => chemins.map(c => ({ chemin: c, sha256: shaFichier(path.join(racine, c)) }));

/* Fabrique le document d'empreintes. `jeux` et `cas` : { racine, chemins } facultatifs (hors dépôt). */
function fabriquer({ racine = RACINE, date, jeux = null, cas = null, pieces = PIECES } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw Error('ecrire : --date AAAA-MM-JJ attendue');
  const out = { format: FORMAT, date, note: 'Empreintes SHA-256 de la chaîne figée du jugement G1-c (fiches/PROTOCOLE_G1C.md § 1), consignées avant l\'ouverture de tout résultat. Les jeux et les cas sont HORS DÉPÔT : chemin relatif à leur racine, et empreinte. Une pièce « provisoire » est modifiée par un chantier en cours : elle est signalée, et doit être reconsignée avant l\'ouverture.',
    fichiers: pieces.map(([chemin, role, provisoire]) => ({ chemin, role, sha256: shaFichier(path.join(racine, chemin)), ...(provisoire ? { provisoire: true } : {}) })) };
  if (jeux) out.jeux = empreintesDe(jeux.racine, jeux.chemins);
  if (cas) out.cas = empreintesDe(cas.racine, cas.chemins);
  return out;
}
const serialiser = o => JSON.stringify(o, null, 1) + '\n';

/* Compare un document d'empreintes à l'état des fichiers. Rend { ok, ecarts, avertissements }. Un écart sur une pièce non provisoire fait échouer ; sur une pièce provisoire, c'est un avertissement. */
function verifier(doc, { racine = RACINE, racineJeux = null, racineCas = null } = {}) {
  if (!doc || doc.format !== FORMAT) throw Error(`empreintes : format ${FORMAT} attendu`);
  const ecarts = [], avertissements = [];
  const comparer = (base, liste, famille, provisoireOk) => {
    for (const e of liste) {
      const f = path.join(base, e.chemin), pas = (raison, extra = {}) => { const x = { famille, chemin: e.chemin, raison, attendu: e.sha256, ...extra }; (provisoireOk && e.provisoire ? avertissements : ecarts).push(x); };
      if (!fs.existsSync(f)) { pas('absent'); continue; }
      const h = shaFichier(f); if (h !== e.sha256) pas('changé', { obtenu: h });
    }
  };
  comparer(racine, doc.fichiers || [], 'fichiers', true);
  if (doc.jeux) { if (!racineJeux) avertissements.push({ famille: 'jeux', raison: 'racine des jeux non donnée : jeux non vérifiés' }); else comparer(racineJeux, doc.jeux, 'jeux', false); }
  if (doc.cas) { if (!racineCas) avertissements.push({ famille: 'cas', raison: 'racine des cas non donnée : cas non vérifiés' }); else comparer(racineCas, doc.cas, 'cas', false); }
  return { ok: ecarts.length === 0, ecarts, avertissements };
}

function argsCli(argv) {
  const o = { mode: argv[0], racineJeux: null, racineCas: null, date: null, sortie: FICHIER, fichier: FICHIER, jeux: null, cas: null };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], v = () => { const x = argv[++i]; if (x === undefined) throw Error(`valeur manquante après ${k}`); return x; };
    if (k === '--racine-jeux') o.racineJeux = v(); else if (k === '--racine-cas') o.racineCas = v(); else if (k === '--date') o.date = v(); else if (k === '--sortie') o.sortie = v(); else if (k === '--fichier') o.fichier = v();
    else if (k === '--jeux') o.jeux = v().split(','); else if (k === '--cas') o.cas = v().split(','); else throw Error(`argument inconnu : ${k}`);
  }
  return o;
}
function main(argv) {
  const a = argsCli(argv);
  if (a.mode === 'ecrire') {
    const date = a.date || new Date().toISOString().slice(0, 10);
    const jeux = a.racineJeux ? { racine: a.racineJeux, chemins: a.jeux || listerDossier(a.racineJeux, /^jeu-.*\.jsonl$/) } : null;
    const cas = a.racineCas ? { racine: a.racineCas, chemins: a.cas || listerDossier(a.racineCas, /^cas.*\.jsonl$/) } : null;
    fs.writeFileSync(a.sortie, serialiser(fabriquer({ date, jeux, cas }))); process.stdout.write(`écrit ${a.sortie}\n`);
  } else if (a.mode === 'verifier') {
    const r = verifier(JSON.parse(fs.readFileSync(a.fichier, 'utf8')), { racineJeux: a.racineJeux, racineCas: a.racineCas });
    for (const e of r.ecarts) process.stdout.write(`ÉCART ${e.famille} ${e.chemin} : ${e.raison}\n`);
    for (const e of r.avertissements) process.stdout.write(`avertissement ${e.famille} ${e.chemin || ''} : ${e.raison}\n`);
    process.stdout.write(r.ok ? 'empreintes : conformes\n' : 'empreintes : ÉCARTS\n'); process.exitCode = r.ok ? 0 : 1;
  } else if (a.mode === 'essai') process.stdout.write('node --test tests/gcv2-empreintes.test.cjs\n');
  else throw Error('mode : ecrire | verifier | essai');
}
module.exports = { FORMAT, PIECES, FICHIER, sha256, shaFichier, listerDossier, fabriquer, serialiser, verifier, argsCli };
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(`gcv2-empreintes : ${e.message}\n`); process.exit(1); } }
