#!/usr/bin/env node
/* Scan des motifs interdits dans les fichiers suivis par git.
 *
 *   node tools/scan-identite.cjs
 *
 * Quatre motifs publics : courriel, adresse web, code de projet ESV, UUID.
 * La liste blanche des adresses et les exclusions (chacune avec sa raison) sont en tête de
 * tools/scan-identite-exclusions.json. L'hôte ESV n'y est pas recopié : il est lu dans manifest.json.
 * Motifs confidentiels, jamais écrits ici. Expressions séparées par | :
 *   ARIANE_MOTIFS_INTERDITS       compilée sans tenir compte de la casse (drapeau i) ;
 *   ARIANE_MOTIFS_INTERDITS_CASSE mêmes règles, compilée en tenant compte de la casse (sans le drapeau i).
 * Les deux peuvent coexister : un motif trouvé par l'une ou l'autre est signalé. Si l'une manque,
 * l'outil dit laquelle. Sans les deux, seuls les quatre motifs publics sont contrôlés.
 * Sortie : une ligne par occurrence encore signalée, « chemin:ligne:motif ».
 * Code 1 s'il en reste au moins une, 2 si la politique ou une expression confidentielle est illisible.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RACINE = path.resolve(__dirname, '..');
const FICHIER_POLITIQUE = path.join(RACINE, 'tools', 'scan-identite-exclusions.json');
const MOTIFS = ['courriel', 'web', 'projetESV', 'uuid', 'hoteESV', 'confidentiel'];
const RE = {
  courriel: () => /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  web: () => /https?:\/\/[^\s"'<>)]+/g,
  projetESV: () => /Project__\d{6}|[Pp]rojet[_ ]?\d{6}_\d{6}/g,
  /* Le i couvre les UUID écrits en majuscules : ce sont les mêmes identifiants. */
  uuid: () => /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
};

function exigerRaison(entre, ou) {
  if (!entre || typeof entre.raison !== 'string' || !entre.raison.trim()) throw new Error(`${ou} : raison absente`);
}

function chargerPolitique(fichier = FICHIER_POLITIQUE) {
  let brut;
  try { brut = JSON.parse(fs.readFileSync(fichier, 'utf8')); }
  catch (e) { throw new Error(`politique illisible (${path.basename(fichier)}) : ${e.message}`); }
  const liste = brut.listeBlancheWeb || [];
  const exclusions = brut.exclusions || [];
  const horsScan = brut.horsScan || [];
  liste.forEach((e, i) => {
    exigerRaison(e, `liste blanche ${i + 1}`);
    if (!e.hote && !e.suffixeHote) throw new Error(`liste blanche ${i + 1} : hôte ou suffixe manquant`);
    if (e.suffixeHote && !String(e.suffixeHote).startsWith('.')) throw new Error(`liste blanche ${i + 1} : le suffixe commence par un point`);
  });
  exclusions.forEach((e, i) => {
    exigerRaison(e, `exclusion ${i + 1}`);
    if (!MOTIFS.includes(e.motif)) throw new Error(`exclusion ${i + 1} : motif « ${e.motif} » inconnu`);
    if (!e.chemin && !e.prefixe) throw new Error(`exclusion ${i + 1} : chemin ou préfixe manquant`);
  });
  horsScan.forEach((e, i) => {
    exigerRaison(e, `hors scan ${i + 1}`);
    if (!e.prefixe && !e.suffixe && !e.binaire) throw new Error(`hors scan ${i + 1} : portée manquante`);
  });
  return { liste, exclusions, horsScan };
}

function hotesExtension(racine = RACINE) {
  let manifeste;
  try { manifeste = JSON.parse(fs.readFileSync(path.join(racine, 'manifest.json'), 'utf8')); }
  catch { return new Set(); }
  const bruts = [...(manifeste.host_permissions || [])];
  for (const script of manifeste.content_scripts || []) bruts.push(...(script.matches || []));
  const hotes = new Set();
  for (const brut of bruts) {
    try { hotes.add(new URL(String(brut).replace(/\*/g, 'a')).hostname.toLowerCase()); }
    catch { /* permission illisible : elle ne devient pas un hôte */ }
  }
  return hotes;
}

function compilerMotif(env, nom, drapeaux) {
  const conf = (env[nom] || '').trim();
  if (!conf) return null;
  try { return new RegExp(conf, drapeaux); }
  catch { throw new Error(`${nom} : expression régulière invalide`); }
}

function compilerConfidentiel(env) {
  return compilerMotif(env, 'ARIANE_MOTIFS_INTERDITS', 'gi');
}

function compilerConfidentielCasse(env) {
  return compilerMotif(env, 'ARIANE_MOTIFS_INTERDITS_CASSE', 'g');
}

function avertissement(env) {
  const manquantes = [];
  if (!(env.ARIANE_MOTIFS_INTERDITS || '').trim()) manquantes.push('ARIANE_MOTIFS_INTERDITS');
  if (!(env.ARIANE_MOTIFS_INTERDITS_CASSE || '').trim()) manquantes.push('ARIANE_MOTIFS_INTERDITS_CASSE');
  if (!manquantes.length) return '';
  const liste = manquantes.map(nom => `${nom} absente`).join(', ');
  if (manquantes.length === 2) {
    return `${liste} : les motifs confidentiels ne sont pas contrôlés (quatre motifs publics seulement).`;
  }
  return `${liste} : ce canal n'est pas contrôlé.`;
}

function decomposerUrl(brut) {
  const nettoye = String(brut).replace(/[.,;:]+$/, '');
  const m = /^https?:\/\/([^/?#\s]+)/i.exec(nettoye);
  if (!m) return null;
  let autorite = m[1].replace(/\.+$/, '');
  if (autorite.includes('@')) autorite = autorite.split('@').pop();
  let hostname = autorite;
  if (hostname.startsWith('[')) {
    const fin = hostname.indexOf(']');
    hostname = fin >= 0 ? hostname.slice(1, fin) : hostname;
  } else if (hostname.includes(':')) hostname = hostname.slice(0, hostname.lastIndexOf(':'));
  const chemin = nettoye.slice(m[0].length);
  return { hostname: hostname.toLowerCase(), chemin };
}

function cheminConforme(chemin, attendu) {
  if (!attendu) return true;
  const base = attendu.endsWith('/') ? attendu.slice(0, -1) : attendu;
  return chemin === base || chemin.startsWith(base + '/');
}

function autorisee(brut, liste) {
  const d = decomposerUrl(brut);
  if (!d) return false;
  for (const regle of liste) {
    if (regle.suffixeHote && d.hostname.endsWith(String(regle.suffixeHote).toLowerCase())) return true;
    if (!regle.hote) continue;
    const hote = String(regle.hote).toLowerCase();
    const bonHote = d.hostname === hote || d.hostname === 'www.' + hote || (regle.sousDomaines && d.hostname.endsWith('.' + hote));
    if (bonHote && cheminConforme(d.chemin, regle.chemin)) return true;
  }
  return false;
}

function estHoteEsv(brut, hotes) {
  const d = decomposerUrl(brut);
  return !!(d && hotes.has(d.hostname));
}

/* Occurrences d'un texte, avant exclusion de chemin. Un motif confidentiel qui tombe dans une
 * adresse de l'hôte ESV est compté comme hôte ESV : l'exclusion de cet hôte couvre le secret
 * du dépôt sans avaler un autre motif confidentiel (un nom, par exemple). */
function releverTexte(texte, { liste, hotes, confidentiel, confidentielCasse }) {
  const trouvailles = [];
  const vus = new Set();
  const lignes = String(texte).split('\n');
  const plagesHote = [];
  lignes.forEach((ligne, index) => {
    const ligneNo = index + 1;
    for (const brut of ligne.matchAll(RE.web())) {
      if (autorisee(brut[0], liste)) continue;
      const motif = estHoteEsv(brut[0], hotes) ? 'hoteESV' : 'web';
      trouvailles.push({ ligne: ligneNo, motif, debut: brut.index, fin: brut.index + brut[0].length });
      if (motif === 'hoteESV') plagesHote.push({ ligne: ligneNo, debut: brut.index, fin: brut.index + brut[0].length });
    }
    for (const nom of ['courriel', 'projetESV', 'uuid']) {
      for (const brut of ligne.matchAll(RE[nom]())) trouvailles.push({ ligne: ligneNo, motif: nom, debut: brut.index, fin: brut.index + brut[0].length });
    }
    ajouterConfidentiel(trouvailles, ligne, ligneNo, confidentiel, plagesHote, vus);
    ajouterConfidentiel(trouvailles, ligne, ligneNo, confidentielCasse, plagesHote, vus);
  });
  return trouvailles;
}

/* Une même plage trouvée par les deux canaux n'est signalée qu'une fois. */
function ajouterConfidentiel(trouvailles, ligne, ligneNo, re, plagesHote, vus) {
  if (!re) return;
  re.lastIndex = 0;
  for (const brut of ligne.matchAll(re)) {
    const dansHote = plagesHote.some(p => p.ligne === ligneNo && brut.index >= p.debut && brut.index < p.fin);
    if (dansHote) continue;
    const debut = brut.index;
    const fin = debut + brut[0].length;
    const cle = `${ligneNo}:${debut}:${fin}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    trouvailles.push({ ligne: ligneNo, motif: 'confidentiel', debut, fin });
  }
}

function estExclu(chemin, motif, exclusions) {
  return exclusions.some(e => e.motif === motif && (e.chemin === chemin || (e.prefixe && (chemin === e.prefixe || chemin.startsWith(e.prefixe)))));
}

function horsChemin(chemin, horsScan) {
  return horsScan.some(regle => {
    if (regle.binaire) return false;
    if (regle.suffixe && chemin.toLowerCase().endsWith(String(regle.suffixe).toLowerCase())) return true;
    if (regle.prefixe) {
      const nom = regle.prefixe.replace(/\/$/, '');
      return chemin === nom || chemin.startsWith(regle.prefixe) || chemin.split('/').includes(nom);
    }
    return false;
  });
}

function fichiersSuivis(racine = RACINE) {
  const r = spawnSync('git', ['-C', racine, 'ls-files', '-z'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ls-files : ${(r.stderr || '').toString().trim().split('\n')[0] || 'échec'}`);
  return r.stdout.toString('utf8').split('\0').filter(Boolean);
}

function lignesDeTexte(chemin, texte, ctx) {
  const lignes = [];
  for (const t of releverTexte(texte, ctx)) {
    if (estExclu(chemin, t.motif, ctx.exclusions || [])) continue;
    lignes.push(`${chemin}:${t.ligne}:${t.motif}`);
  }
  return lignes;
}

function scannerArbre(env = process.env, racine = RACINE) {
  const politique = chargerPolitique();
  const ctx = {
    liste: politique.liste,
    hotes: hotesExtension(racine),
    exclusions: politique.exclusions,
    confidentiel: compilerConfidentiel(env),
    confidentielCasse: compilerConfidentielCasse(env),
  };
  const lignes = [];
  for (const chemin of fichiersSuivis(racine)) {
    if (horsChemin(chemin, politique.horsScan)) continue;
    const abs = path.join(racine, chemin);
    let buf;
    try { buf = fs.readFileSync(abs); }
    catch { continue; }
    if (buf.includes(0)) continue;
    lignes.push(...lignesDeTexte(chemin, buf.toString('utf8'), ctx));
  }
  return { lignes, avertissement: avertissement(env) };
}

if (require.main === module) {
  try {
    const r = scannerArbre(process.env);
    if (r.avertissement) console.error(r.avertissement);
    for (const ligne of r.lignes) console.log(ligne);
    process.exit(r.lignes.length ? 1 : 0);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

module.exports = {
  chargerPolitique, hotesExtension, releverTexte, estExclu, scannerArbre, avertissement,
  compilerConfidentiel, compilerConfidentielCasse, lignesDeTexte, MOTIFS,
};
