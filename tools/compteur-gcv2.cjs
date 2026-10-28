#!/usr/bin/env node
'use strict';
/*
 * compteur-gcv2.cjs — compteur des cuts que la GCV2 peut apprendre depuis le début de la 5.0 (D-188).
 * Cap de l'opérateur : « un cut corrigé = un cut appris et entraîné à la GCV2 ». Outil hors ligne, lecture seule : il lit les
 * Échos archivés dans banane-data (via tools/jointure-echo-orbite.cjs, en Écho seul) et compte, partie par partie,
 *  - `corriges` : cuts validés après un déplacement de rail (étiquette Écho VALIDATE_CORRECTED_*) — le compteur de l'opérateur ;
 *      `dont5mm` et `dont10mm` : ceux dont le plus grand déplacement dépasse 5 mm, 10 mm (3D, repère profil) ;
 *  - `valideSansMouvement` : cuts validés tels quels (VALIDATE_NO_MOVEMENT) ;
 *  - `visiteSansAction` : cuts visités au moins 0,6 s sans validation et sans rail déplacé de 0,5 mm ou plus
 *      (« les cuts visités et non modifiés peuvent être appris », l'opérateur) ;
 *  - `skips` : cuts passés en SKIP, NON comptés (l'opérateur : ne pas en tenir compte pour l'instant) ;
 *  - `sansReference` : cuts vus sans pose humaine exploitable (visite trop courte…), non comptés.
 * `appris` = corriges + valideSansMouvement + visiteSansAction ; le compteur de l'opérateur est `corriges`.
 * File d'attente : chaque source porte un `etat`, « en-file » (archivée, pas encore entraînée) ou « appris »
 * (GCV2 entraînée dessus). Le dépôt ne sait pas quand la GCV2 est entraînée : tout part « en-file » tant que l'opérateur n'a
 * pas dit le contraire, en changeant `etat` dans le fichier des sources.
 *
 *   node tools/compteur-gcv2.cjs --donnees <dossier banane-data> [--sources datasets/compteur-gcv2-sources.json]
 *        [--sortie datasets/compteur-gcv2.json] [--md fiches/COMPTEUR_GCV2.md] [--seuil-visite 0.6] [--racine-supplementaire <dossier>]
 *
 * Une source dont l'Écho est archivé en 7z (champ `archive7z`) n'est pas lue sur banane-data, qui n'est jamais modifié : on extrait ses segments
 * `ariane-native-v4-*.json` dans un dossier temporaire, rangé comme les `dossiers` de la source (<temporaire>/<dossier de la source>/), et on le donne avec
 * `--racine-supplementaire`. Ce dossier passe avant banane-data pour toute source qui y a le sien. Sans lui, une source en 7z est refusée avec ce rappel.
 *
 * Un cut compte une fois par partie (le dernier état observé, toutes visites et sessions confondues). Un même cut
 * ne peut pas être compté deux fois : les sources sont des parties distinctes.
 */
const fs = require('node:fs'), path = require('node:path');
const J = require('./jointure-echo-orbite.cjs');

const SEUIL_VISITE_S = 0.6, SEUIL_DEPLACEMENT_MM = [5, 10], ETATS = ['en-file', 'appris'];
const COMPTEURS = ['corriges', 'dont5mm', 'dont10mm', 'valideSansMouvement', 'visiteSansAction', 'skips', 'sansReference'];

const vide = () => Object.fromEntries([['cutsEcho', 0], ...COMPTEURS.map(k => [k, 0])]);
const appris = c => c.corriges + c.valideSansMouvement + c.visiteSansAction;

/* Range une ligne de la table de la jointure dans une seule catégorie. */
function categorie(ligne) {
  const e = ligne.etiquetteEcho || '', ref = ligne.referenceHumaine;
  if (e === 'SKIP') return 'skips';
  if (e.startsWith('VALIDATE_CORRECTED_') && ref === 'observee') return 'corriges';
  if (e === 'VALIDATE_NO_MOVEMENT' && ref === 'observee') return 'valideSansMouvement';
  if (e === 'PASS_NO_DECISION' && ref === 'observee') return 'visiteSansAction';
  return 'sansReference';
}

function compterTable(table) {
  const c = vide();
  for (const l of table) {
    c.cutsEcho++;
    const k = categorie(l);
    c[k]++;
    if (k === 'corriges') {
      const d = l.ecartHumain && Number.isFinite(l.ecartHumain.maxDist3dMm) ? l.ecartHumain.maxDist3dMm : 0;
      if (d > SEUIL_DEPLACEMENT_MM[0]) c.dont5mm++;
      if (d > SEUIL_DEPLACEMENT_MM[1]) c.dont10mm++;
    }
  }
  return c;
}

function ajouter(total, c) { for (const k of Object.keys(vide())) total[k] += c[k]; return total; }

function verifierSources(sources) {
  if (!Array.isArray(sources) || !sources.length) throw Error('Fichier des sources vide ou invalide.');
  const ids = new Set();
  for (const s of sources) {
    if (!s.id || !s.projet || !Number.isInteger(s.partie) || !Array.isArray(s.dossiers) || !s.dossiers.length) throw Error(`Source incomplète : ${JSON.stringify(s)}`);
    if (ids.has(s.id)) throw Error(`Source en double : ${s.id}`);
    ids.add(s.id);
    if (s.etat !== undefined && !ETATS.includes(s.etat)) throw Error(`État inconnu pour ${s.id} : ${s.etat}`);
    if (s.archive7z !== undefined && typeof s.archive7z !== 'boolean') throw Error(`archive7z de ${s.id} : vrai ou faux attendu`);
  }
}

/* Dossiers Écho d'une source : d'abord ceux de la racine supplémentaire (extraction temporaire), sinon banane-data. Une source en 7z sans extraction est refusée. */
function dossiersEcho(s, racine, racineSupp) {
  return s.dossiers.map(d => {
    const extrait = racineSupp ? path.join(racineSupp, d) : null;
    if (extrait && fs.existsSync(extrait)) return extrait;
    if (s.archive7z) throw Error(`${s.id} : l'Écho est archivé en 7z, que le compteur ne lit pas. Extraire les segments « ariane-native-v4-*.json » de « ${d} » dans <dossier>/${d}/ puis relancer avec --racine-supplementaire <dossier>.`);
    return path.join(racine, 'collections', d);
  });
}

function compter(sources, { racine, racineSupplementaire = null, seuilVisiteS = SEUIL_VISITE_S, executer = J.executer } = {}) {
  verifierSources(sources);
  const lignes = [];
  for (const s of sources) {
    const echo = dossiersEcho(s, racine, racineSupplementaire);
    const sortie = executer(['--echo', ...echo, '--sans-journal', '--partie', String(s.partie), '--visite-sans-action-bonne', String(seuilVisiteS)], () => {});
    lignes.push({ id: s.id, projet: s.projet, projetCertain: s.projetCertain !== false, partie: s.partie, etat: s.etat || 'en-file', note: s.note || null, ...compterTable(sortie.table) });
  }
  const totaux = { tous: vide(), 'en-file': vide(), appris: vide() };
  const parProjet = {};
  for (const l of lignes) {
    ajouter(totaux.tous, l); ajouter(totaux[l.etat], l);
    ajouter(parProjet[l.projet] || (parProjet[l.projet] = vide()), l);
  }
  const resume = c => ({ ...c, appris: appris(c) });
  return {
    format: 'ariane-compteur-gcv2-v1', creeLe: new Date().toISOString(),
    regle: { seuilVisiteS, comptes: ['corriges', 'valideSansMouvement', 'visiteSansAction'], nonComptes: ['skips', 'sansReference'], compteurDeMic: 'corriges' },
    sources: lignes.map(l => ({ ...l, appris: appris(l) })),
    totaux: { tous: resume(totaux.tous), 'en-file': resume(totaux['en-file']), appris: resume(totaux.appris) },
    parProjet: Object.fromEntries(Object.entries(parProjet).map(([k, v]) => [k, resume(v)])),
  };
}

const n = x => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function enMarkdown(r) {
  const T = r.totaux.tous;
  const L = [
    '# Compteur des cuts appris par la GCV2 (depuis le début de la 5.0)', '',
    'Généré par `node tools/compteur-gcv2.cjs` (D-188). **Un cut corrigé = un cut appris** (l\'opérateur). Les SKIP ne sont pas comptés. Aucune limite : on ne s\'arrête pas à 1 000 ou 1 500 cuts (l\'opérateur).', '',
    `**Cuts corrigés : ${n(T.corriges)}** (dont ${n(T.dont5mm)} de plus de 5 mm, ${n(T.dont10mm)} de plus de 10 mm). Avec les cuts validés tels quels (${n(T.valideSansMouvement)}) et les cuts visités sans action d'au moins ${String(r.regle.seuilVisiteS).replace('.', ',')} s (${n(T.visiteSansAction)}) : **${n(T.appris)} cuts apprenables**.`, '',
    '| File | Corrigés | Validés tels quels | Visités sans action | Apprenables |', '|---|---:|---:|---:|---:|',
    ...['en-file', 'appris'].map(k => `| ${k === 'en-file' ? 'En apprentissage (en file)' : 'Appris (GCV2 entraînée)'} | ${n(r.totaux[k].corriges)} | ${n(r.totaux[k].valideSansMouvement)} | ${n(r.totaux[k].visiteSansAction)} | ${n(r.totaux[k].appris)} |`), '',
    '| Projet | Partie | État | Cuts à l\'Écho | Corrigés | dont > 5 mm | dont > 10 mm | Validés tels quels | Visités sans action | SKIP (non comptés) | Sans référence |', '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...r.sources.map(s => `| ${s.projet}${s.projetCertain ? '' : ' (à confirmer)'} | ${s.partie} | ${s.etat} | ${n(s.cutsEcho)} | ${n(s.corriges)} | ${n(s.dont5mm)} | ${n(s.dont10mm)} | ${n(s.valideSansMouvement)} | ${n(s.visiteSansAction)} | ${n(s.skips)} | ${n(s.sansReference)} |`), '',
    'Une partie lue en plusieurs Échos (sessions, reprises) compte chaque cut une fois, d\'après son dernier état observé.', '',
  ];
  return L.join('\n');
}

function lireArguments(argv) {
  const a = { donnees: null, sources: null, sortie: null, md: null, seuil: SEUIL_VISITE_S, supplementaire: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === '--donnees') { a.donnees = v; i++; } else if (k === '--sources') { a.sources = v; i++; } else if (k === '--sortie') { a.sortie = v; i++; } else if (k === '--md') { a.md = v; i++; } else if (k === '--seuil-visite') { a.seuil = Number(v); i++; } else if (k === '--racine-supplementaire') { a.supplementaire = v; i++; } else throw Error(`Argument inconnu : ${k}`);
  }
  if (!a.donnees) throw Error('Usage : node tools/compteur-gcv2.cjs --donnees <dossier banane-data> [--sources fichier.json] [--sortie fichier.json] [--md fichier.md] [--seuil-visite 0.6] [--racine-supplementaire dossier]');
  if (!Number.isFinite(a.seuil) || a.seuil < 0) throw Error('--seuil-visite : durée en secondes, positive');
  return a;
}

function main(argv) {
  const a = lireArguments(argv);
  const fichier = a.sources || path.join(__dirname, '..', 'datasets', 'compteur-gcv2-sources.json');
  const r = compter(JSON.parse(fs.readFileSync(fichier, 'utf8')).sources, { racine: a.donnees, racineSupplementaire: a.supplementaire, seuilVisiteS: a.seuil });
  if (a.sortie) fs.writeFileSync(a.sortie, JSON.stringify(r, null, 1) + '\n');
  if (a.md) fs.writeFileSync(a.md, enMarkdown(r));
  console.log(enMarkdown(r));
  return r;
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}

module.exports = { dossiersEcho, categorie, compterTable, compter, verifierSources, enMarkdown, lireArguments, appris, SEUIL_VISITE_S };
