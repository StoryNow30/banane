/* Ariane 4.9 (V2) — écriture d'une archive zip à la main, en flux.
 *
 * Pourquoi : « Tout télécharger pour l'analyse » produit plusieurs fichiers
 * JSON (journal, bilan, diagnostic, corpus en segments). Un seul zip évite les
 * confirmations fichier par fichier. Aucune bibliothèque n'est ajoutée au
 * dépôt et aucune permission au manifeste : le format zip (APPNOTE 6.3) est
 * écrit ici, et la compression passe par CompressionStream('deflate-raw'),
 * disponible dans Chrome et Edge.
 *
 * Contraintes respectées :
 *  - un fichier est lu en flux (Blob.stream) : jamais de chaîne géante, jamais
 *    une copie complète en mémoire de JavaScript ; seules les données déjà
 *    compressées sont gardées, comme morceaux du Blob final ;
 *  - CRC-32 calculé au fil de la lecture, tailles réelles écrites dans les
 *    en-têtes (pas de descripteur de données : l'archive est lisible par tout
 *    décodeur, y compris en flux) ;
 *  - méthode « deflate » (8) si CompressionStream existe, sinon « stored » (0) ;
 *  - pas de zip64 : au-delà de 4 Gio (ou 65 535 fichiers) l'écriture REFUSE
 *    plutôt que de produire une archive illisible ; l'appelant répartit alors
 *    les fichiers sur plusieurs archives (`bytes` donne le volume courant).
 *
 * Aucun accès à ESV, aucune donnée du projet : module générique. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api; else root.BananeZip = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LIMITE_32 = 0xFFFFFFFF;       // taille maximale d'un champ zip « classique »
  const MAX_ENTREES = 0xFFFF;
  const STORED = 0, DEFLATE = 8;

  /* --- CRC-32 (polynôme 0xEDB88320), incrémental --- */
  let table = null;
  function crcTable() {
    if (table) return table;
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  }
  /* `crc` : valeur renvoyée par l'appel précédent (0 au départ). */
  function crc32(octets, crc = 0) {
    const t = crcTable();
    let c = (crc ^ 0xFFFFFFFF) >>> 0;
    for (let i = 0; i < octets.length; i++) c = t[(c ^ octets[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* Date et heure DOS (2 secondes de pas, années depuis 1980), en UTC pour que
   * le même instant donne la même archive quel que soit le fuseau. */
  function dateDos(date) {
    const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date(Date.UTC(1980, 0, 1));
    const an = Math.min(Math.max(d.getUTCFullYear(), 1980), 2107);
    return {
      heure: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1),
      jour: ((an - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
    };
  }

  const u16 = n => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };
  const u32 = n => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; };
  const cat = parts => {
    let n = 0; for (const p of parts) n += p.length;
    const out = new Uint8Array(n); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };
  const encodeur = () => new TextEncoder();

  /* Un nom d'entrée : relatif, avec « / », sans « .. » ni lettre de lecteur. */
  function nomValide(nom) {
    if (typeof nom !== 'string' || !nom || nom.length > 1000) return false;
    if (nom.startsWith('/') || nom.includes('\\') || /^[A-Za-z]:/.test(nom)) return false;
    return !nom.split('/').some(part => part === '..' || part === '');
  }

  function compressionDisponible() {
    try { return typeof CompressionStream === 'function' && typeof Blob === 'function' && typeof Blob.prototype.stream === 'function'; }
    catch (_) { return false; }
  }

  /* `options.methode` : 'deflate' (défaut si disponible) ou 'stored'.
   * `options.date` : date écrite dans les entrées. */
  function createZip(options = {}) {
    const date = dateDos(options.date);
    const methode = options.methode === 'stored' || !compressionDisponible() ? STORED : DEFLATE;
    const morceaux = [];        // en-têtes locaux et données, dans l'ordre
    const centrale = [];        // entrées du répertoire central
    const noms = new Set();
    let octets = 0, fini = false;
    const entrees = [];

    function ecrire(parts) { for (const p of parts) { morceaux.push(p); octets += p.size !== undefined ? p.size : p.length; } }

    /* Lit un Blob en flux : CRC, taille et, si demandé, flux compressé. */
    async function lire(blob, compresser) {
      const lecteur = blob.stream().getReader();
      let crc = 0, taille = 0;
      let ecrivain = null, sortie = null, pompe = null;
      const compresses = []; let tailleCompressee = 0;
      if (compresser) {
        const cs = new CompressionStream('deflate-raw');
        ecrivain = cs.writable.getWriter(); sortie = cs.readable.getReader();
        pompe = (async () => {
          for (;;) {
            const { done, value } = await sortie.read();
            if (done) break;
            compresses.push(value); tailleCompressee += value.length;
          }
        })();
        // Une erreur de la pompe est relevée à l'attente de `pompe`, jamais perdue.
        pompe.catch(() => {});
      }
      try {
        for (;;) {
          const { done, value } = await lecteur.read();
          if (done) break;
          crc = crc32(value, crc); taille += value.length;
          if (ecrivain) await ecrivain.write(value);
        }
        if (ecrivain) { await ecrivain.close(); await pompe; }
      } catch (e) {
        try { await lecteur.cancel(); } catch (_) { /* déjà fermé */ }
        if (ecrivain) { try { await ecrivain.abort(e); } catch (_) { /* déjà fermé */ } }
        throw e;
      }
      return { crc, taille, compresses, tailleCompressee };
    }

    /* Ajoute un fichier. `contenu` : Blob. Rend { nom, methode, crc32, taille, tailleCompressee }. */
    async function ajouter(nom, contenu) {
      if (fini) throw Error('Archive déjà terminée.');
      if (!nomValide(nom)) throw Error('Nom d’entrée zip refusé : ' + nom);
      if (noms.has(nom)) throw Error('Nom d’entrée zip en double : ' + nom);
      if (entrees.length + 1 > MAX_ENTREES) throw Error('Trop de fichiers pour une archive zip simple (' + MAX_ENTREES + ').');
      const blob = contenu instanceof Blob ? contenu : new Blob([contenu]);
      if (blob.size > LIMITE_32) throw Error('Fichier trop gros pour une archive zip simple : ' + nom);
      let r = await lire(blob, methode === DEFLATE);
      let m = methode;
      /* Les données qui ne se compressent pas (ou presque) restent « stored » : plus petit, plus sûr. */
      if (m === DEFLATE && r.tailleCompressee >= r.taille) { m = STORED; r = { ...r, compresses: [], tailleCompressee: r.taille }; }
      const taille = r.taille, tailleCompressee = m === STORED ? taille : r.tailleCompressee;
      const nomOctets = encodeur().encode(nom);
      const decalage = octets;
      if (decalage + 30 + nomOctets.length + tailleCompressee + 46 + nomOctets.length > LIMITE_32 - 22) {
        throw Error('Archive zip pleine (4 Gio) : ' + nom + ' ne tient plus.');
      }
      // Bit 11 : nom en UTF-8. Pas de bit 3 : les tailles et le CRC sont connus.
      const drapeaux = 0x0800;
      const locale = cat([u32(0x04034b50), u16(20), u16(drapeaux), u16(m), u16(date.heure), u16(date.jour),
        u32(r.crc), u32(tailleCompressee), u32(taille), u16(nomOctets.length), u16(0), nomOctets]);
      ecrire([locale]);
      if (m === STORED) { if (taille) ecrire([blob]); } else ecrire(r.compresses);
      centrale.push(cat([u32(0x02014b50), u16(20), u16(20), u16(drapeaux), u16(m), u16(date.heure), u16(date.jour),
        u32(r.crc), u32(tailleCompressee), u32(taille), u16(nomOctets.length), u16(0), u16(0), u16(0), u16(0),
        u32(0), u32(decalage), nomOctets]));
      noms.add(nom);
      const info = { nom, methode: m, crc32: r.crc, taille, tailleCompressee };
      entrees.push(info);
      return info;
    }

    /* Ferme l'archive : répertoire central et fin de répertoire. Rend le Blob. */
    function terminer(type = 'application/zip') {
      if (fini) throw Error('Archive déjà terminée.');
      fini = true;
      const debut = octets;
      const rep = cat(centrale);
      if (debut + rep.length + 22 > LIMITE_32) throw Error('Archive zip pleine (4 Gio).');
      const fin = cat([u32(0x06054b50), u16(0), u16(0), u16(entrees.length), u16(entrees.length), u32(rep.length), u32(debut), u16(0)]);
      return new Blob([...morceaux, rep, fin], { type });
    }

    return {
      ajouter, terminer, methode: methode === DEFLATE ? 'deflate' : 'stored',
      get octets() { return octets; }, get entrees() { return entrees.slice(); },
      get vide() { return !entrees.length; },
    };
  }

  return { createZip, crc32, nomValide, compressionDisponible, STORED, DEFLATE, LIMITE_32, MAX_ENTREES };
});
