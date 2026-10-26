#!/usr/bin/env node
'use strict';
/*
 * lire-volumes.cjs — lit les fichiers JSON d'un export d'Ariane, qu'ils soient posés tels quels dans un
 * dossier (`*.json`, `*.json.gz`) ou rangés dans des VOLUMES ZIP (« Tout télécharger » d'Orbite, export
 * Écho depuis la 4.9.0.18 : volumes autonomes de 17 Mo au plus, CONTENU.txt compris). Aucune dépendance :
 * le zip est lu par son répertoire central (méthodes « stored » et « deflate », celles de src/zip-writer.js).
 *
 *   const V = require('./lire-volumes.cjs');
 *   for (const e of V.entrees(DOSSIER_OU_FICHIER)) { const doc = JSON.parse(e.lire()); … e.chemin … }
 *
 * `entrees()` rend, triées par chemin, des entrées { nom, chemin, lire() } : `chemin` est le fichier sur le
 * disque, suivi de « # » et du nom dans l'archive pour une entrée de zip. CONTENU.txt et les autres fichiers
 * qui ne sont pas du JSON sont ignorés. Les outils d'analyse (merge-segments, acceptance-report, analyse-locale)
 * lisent ainsi un dossier de volumes comme un dossier de JSON décompressés.
 */
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');

const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50;
/* Entrées d'une archive zip : { nom, methode, tailleCompressee, taille, offset } ; lecture à la demande. `fichier` : chemin, ou (T21a) le contenu
 * déjà en mémoire (Buffer : archive découpée en .zip.001, .zip.002… recollée par l'appelant). */
function entreesZip(fichier) {
  const buf = Buffer.isBuffer(fichier) ? fichier : fs.readFileSync(fichier);
  if (Buffer.isBuffer(fichier)) fichier = '(archive en mémoire)';
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  if (eocd < 0) throw Error('Archive zip illisible (fin de répertoire central absente) : ' + fichier);
  const count = buf.readUInt16LE(eocd + 10), dirOffset = buf.readUInt32LE(eocd + 16), out = [];
  let p = dirOffset;
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== CENTRAL) throw Error('Répertoire central corrompu : ' + fichier);
    const methode = buf.readUInt16LE(p + 10), tailleCompressee = buf.readUInt32LE(p + 20), taille = buf.readUInt32LE(p + 24);
    const nomLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const nom = buf.subarray(p + 46, p + 46 + nomLen).toString('utf8');
    out.push({ nom, methode, tailleCompressee, taille, local });
    p += 46 + nomLen + extraLen + commentLen;
  }
  return out.map(e => ({
    nom: e.nom, taille: e.taille,
    lire() {
      if (buf.readUInt32LE(e.local) !== LOCAL) throw Error('En-tête local corrompu pour ' + e.nom + ' dans ' + fichier);
      const nomLen = buf.readUInt16LE(e.local + 26), extraLen = buf.readUInt16LE(e.local + 28), debut = e.local + 30 + nomLen + extraLen;
      const data = buf.subarray(debut, debut + e.tailleCompressee);
      if (e.methode === 0) return Buffer.from(data);
      if (e.methode === 8) return zlib.inflateRawSync(data);
      throw Error(`Méthode de compression ${e.methode} non lue (${e.nom} dans ${fichier}) : seules « stored » et « deflate » le sont.`);
    },
  }));
}
const estJson = nom => /\.json(\.gz)?$/i.test(nom);
/* Un fichier du disque : JSON, JSON compressé, ou archive zip (ses entrées JSON). */
function entreesFichier(fichier) {
  const nom = path.basename(fichier);
  if (/\.zip$/i.test(nom)) return entreesZip(fichier).filter(e => estJson(e.nom)).map(e => ({
    nom: path.basename(e.nom), chemin: fichier + '#' + e.nom, taille: e.taille, dansZip: fichier,
    lire: () => /\.gz$/i.test(e.nom) ? zlib.gunzipSync(e.lire()) : e.lire(),
  }));
  if (!estJson(nom)) return [];
  return [{ nom, chemin: fichier, taille: null, dansZip: null, lire: () => /\.gz$/i.test(nom) ? zlib.gunzipSync(fs.readFileSync(fichier)) : fs.readFileSync(fichier) }];
}
/* Un dossier (non récursif) ou un fichier. Tri par chemin : les volumes « -volume01-sur03 » puis les segments segNN. */
function entrees(input) {
  const liste = fs.statSync(input).isDirectory() ? fs.readdirSync(input).sort().map(f => path.join(input, f)) : [input];
  const out = liste.flatMap(f => fs.statSync(f).isDirectory() ? [] : entreesFichier(f));
  return out.sort((a, b) => a.chemin.localeCompare(b.chemin));
}
/* Compatibilité : les outils qui attendaient des chemins de fichiers acceptent aussi ces entrées. */
const nomDe = x => typeof x === 'string' ? x : x.chemin;
const lire = x => typeof x === 'string' ? (/\.gz$/i.test(x) ? zlib.gunzipSync(fs.readFileSync(x)) : fs.readFileSync(x)) : x.lire();
module.exports = { entrees, entreesFichier, entreesZip, nomDe, lire, estJson };
