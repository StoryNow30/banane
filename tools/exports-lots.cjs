'use strict';
/*
 * exports-lots.cjs — lit les journaux de lots (`ariane-journal-v4-*.json`) des collectes archivées HORS dépôt, sans rien extraire sur le disque
 * (T21a : tableau de bord B-min, contrôle a posteriori de la passe, mesure de vitesse V-a). Lecture seule.
 *
 *   const X = require('./exports-lots.cjs');
 *   for (const j of X.journaux(DOSSIER_DES_COLLECTES)) { const doc = JSON.parse(j.lire()); … j.collection, j.archive, j.nom … }
 *   X.inventaire(DOSSIER) → { lisibles: [...], illisibles: [{ collection, archive, raison }] }
 *
 * Archives lues : zip (« stored », « deflate »), zip découpé en volumes `.zip.001`, `.zip.002`… (recollés en mémoire). Les archives 7z ne
 * sont pas lues (pas de décompresseur dans le dépôt ni sur la machine) : elles sont listées comme illisibles, avec leur raison.
 * Aucune donnée n'est écrite ; le contenu d'un journal ne quitte jamais la mémoire.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const V = require('./lire-volumes.cjs');

const MOTIF_JOURNAL = /^ariane-journal-v4-\d+\.json$/;
const MOTIF_LISTE = /^ariane-liste-partie(\d+)-\d{8}-\d{6}Z\.json$/;

function fichiersRecursifs(dossier) {
  const out = [];
  for (const n of fs.readdirSync(dossier).sort()) {
    const f = path.join(dossier, n), st = fs.statSync(f);
    if (st.isDirectory()) out.push(...fichiersRecursifs(f)); else out.push(f);
  }
  return out;
}
/* Archives d'une collecte : zip, zip découpé (groupé par préfixe), 7z. */
function archives(collection) {
  const fichiers = fichiersRecursifs(collection), out = [], decoupes = new Map();
  for (const f of fichiers) {
    if (/\.zip$/i.test(f)) out.push({ type: 'zip', chemin: f, volumes: [f] });
    else if (/\.zip\.\d{3}$/i.test(f)) { const k = f.replace(/\.\d{3}$/, ''); if (!decoupes.has(k)) decoupes.set(k, []); decoupes.get(k).push(f); }
    else if (/\.7z(\.\d{3})?$/i.test(f)) out.push({ type: '7z', chemin: f, volumes: [f] });
  }
  for (const [k, v] of decoupes) out.push({ type: 'zip-decoupe', chemin: k, volumes: v.sort() });
  return out.sort((a, b) => a.chemin.localeCompare(b.chemin));
}
/* Noms des entrées d'un zip, lus dans son seul répertoire central (fin du fichier) : un volume de corpus n'est pas relu en entier pour être listé. */
function nomsZip(fichier) {
  const fd = fs.openSync(fichier, 'r');
  try {
    const taille = fs.fstatSync(fd).size, n = Math.min(taille, 65536 + 22), fin = Buffer.alloc(n);
    fs.readSync(fd, fin, 0, n, taille - n);
    let i = fin.length - 22; while (i >= 0 && fin.readUInt32LE(i) !== 0x06054b50) i--;
    if (i < 0) throw Error('archive zip illisible (fin de répertoire central absente)');
    const count = fin.readUInt16LE(i + 10), dirSize = fin.readUInt32LE(i + 12), dirOffset = fin.readUInt32LE(i + 16), dir = Buffer.alloc(dirSize);
    fs.readSync(fd, dir, 0, dirSize, dirOffset);
    const noms = []; let p = 0;
    for (let k = 0; k < count; k++) { const nl = dir.readUInt16LE(p + 28), xl = dir.readUInt16LE(p + 30), cl = dir.readUInt16LE(p + 32); noms.push(path.basename(dir.subarray(p + 46, p + 46 + nl).toString('utf8'))); p += 46 + nl + xl + cl; }
    return noms;
  } finally { fs.closeSync(fd); }
}
function entreesArchive(a) {
  if (a.type === 'zip') return V.entreesZip(a.chemin).map(e => ({ nom: path.basename(e.nom), lire: e.lire }));
  if (a.type === 'zip-decoupe') { const buf = Buffer.concat(a.volumes.map(v => fs.readFileSync(v))); return V.entreesZip(buf).map(e => ({ nom: path.basename(e.nom), lire: e.lire })); }
  throw Error('archive 7z non lue (aucun décompresseur 7z disponible)');
}
/* Inventaire : entrées lisibles (journaux, listes) et archives illisibles, par collecte. */
function inventaire(racine, { collections = null } = {}) {
  const lisibles = [], illisibles = [];
  for (const c of fs.readdirSync(racine).sort()) {
    const dc = path.join(racine, c);
    if (!fs.statSync(dc).isDirectory() || (collections && !collections.includes(c))) continue;
    for (const a of archives(dc)) {
      const archive = path.relative(dc, a.chemin);
      if (a.type === '7z') { illisibles.push({ collection: c, archive, raison: 'archive 7z (aucun décompresseur 7z sur cette machine)' }); continue; }
      let es;
      try { es = a.type === 'zip' ? nomsZip(a.chemin).map(nom => ({ nom })) : entreesArchive(a); } catch (e) { illisibles.push({ collection: c, archive, raison: String(e.message || e).slice(0, 160) }); continue; }
      for (const e of es) {
        if (MOTIF_JOURNAL.test(e.nom)) lisibles.push({ type: 'journal', collection: c, archive, nom: e.nom, archiveRef: a });
        else { const m = MOTIF_LISTE.exec(e.nom); if (m) lisibles.push({ type: 'liste', collection: c, archive, nom: e.nom, partie: Number(m[1]), archiveRef: a }); }
      }
    }
  }
  return { lisibles, illisibles };
}
/* Relit une entrée (l'archive est relue à chaque appel : la mémoire ne garde qu'une archive à la fois). */
function lireEntree(x) {
  const e = entreesArchive(x.archiveRef).find(y => y.nom === x.nom);
  if (!e) throw Error(`${x.nom} introuvable dans ${x.archive}`);
  return e.lire();
}
function* journaux(racine, opts = {}) {
  for (const x of inventaire(racine, opts).lisibles.filter(y => y.type === 'journal')) yield { ...x, lire: () => lireEntree(x) };
}
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

module.exports = { MOTIF_JOURNAL, MOTIF_LISTE, archives, nomsZip, entreesArchive, inventaire, lireEntree, journaux, sha256 };
