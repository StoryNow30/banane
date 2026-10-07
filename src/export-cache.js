/* Ariane 4.9 (V2) — vidage du « cache des exports ».
 *
 * FRONTIÈRE. Ce qu'Ariane garde pour EXPORTER (vidable, une fois exporté) :
 * les trois magasins IndexedDB `clouds` (nuages LiDAR), `events` (journal) et
 * `records` (visites) de la base « banane-test-v3 » (src/storage.js).
 * Ce qui sert à FONCTIONNER (jamais touché ici) : l'état du moteur et du lot
 * (chrome.storage.local `banane3State` : lot, cuts posés/différés, intentions,
 * résumés, compteur d'événements, records de l'état), l'onglet choisi, le
 * bandeau, les fins de parties, les réglages ; la mesure V1 en mémoire du
 * service worker ; et tout ce qui appartient à une session Écho ou Correction
 * conservée (ses visites, événements et nuages restent).
 *
 * Aucune donnée d'ESV ici : module générique, testé avec un faux stockage. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api; else root.BananeExportCache = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CLE = 'banane49ExportCache';
  const LOT_TERMINE = 'STOPPED';
  const COLLECTIONS_LIBRES = [undefined, null, 'IDLE', 'AFTER_CAPTURED'];

  /* Raison du refus (texte pour l'opérateur), ou null si le vidage est permis.
   * `c` : { state, busy, task, nativeActive, manualActive, timing }. */
  function refus(c, options) {
    const s = c.state || {}, b = s.batch;
    /* Vidage AUTOMATIQUE : un lot « STOPPED » n'est pas fini pour autant (arrêté à la
     * main, il se reprend). Seul un lot terminé pour de bon (`stoppedAtEnd`, posé à la
     * fin de la partie) ou l'absence de lot l'autorise. Le vidage manuel, lui, est
     * permis sur STOPPED, avec confirmation et avertissement (`reprenable`). */
    if (options && options.auto && b && b.state === LOT_TERMINE && !b.stoppedAtEnd) return 'le lot est arrêté mais pas terminé : il peut être repris (vidage automatique refusé)';
    if (b && b.state && b.state !== LOT_TERMINE) return 'un lot n’est pas terminé (' + b.state + ') : arrête-le ou termine-le d’abord';
    if (c.busy || c.task) return 'Ariane travaille encore (action en cours)';
    if (c.nativeActive) return 'Écho est actif';
    if (c.manualActive) return 'une session Mes corrections est active';
    if (!COLLECTIONS_LIBRES.includes(s.collection)) return 'une capture est en cours (' + s.collection + ')';
    const t = c.timing;
    if (t && t.batch && !t.batch.closed) return 'la clôture de la mesure V1 du lot n’est pas terminée';
    if (t && t.pending && t.pending.size > 0) return 'des écritures de mesure sont encore en cours';
    return null;
  }

  const reprenable = c => { const b = c.state && c.state.batch; return !!(b && b.state === LOT_TERMINE && !b.stoppedAtEnd); };

  /* SIGNATURE d'un enregistrement (taille + empreinte FNV-1a du JSON) : prise à
   * l'instantané, contrôlée à la suppression. Un enregistrement modifié depuis
   * n'est PAS supprimé : sa nouvelle version n'est dans aucun fichier exporté. */
  function signature(objet) {
    const t = JSON.stringify(objet) || '';
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return t.length + ':' + h.toString(16);
  }
  const CLE_ID = { events: o => o.eventId, records: o => o.recordId || o.id };

  /* Supprime exactement les clés demandées, hors `garder` (identifiants à ne pas
   * toucher, par magasin) et hors enregistrements modifiés depuis l'instantané
   * (`signatures` : { events:{id:sig}, records:{id:sig} }, OBLIGATOIRES pour events
   * et records). Les nuages sont écrits une fois (captureId unique) : sans signature.
   * Rend les comptes supprimés et `modifies` (gardés parce que modifiés). */
  async function supprimer(store, ids, garder, signatures) {
    const out = { events: 0, records: 0, clouds: 0, modifies: { events: [], records: [] } };
    for (const nom of ['events', 'records', 'clouds']) {
      const g = new Set((garder && garder[nom]) || []);
      let liste = [...new Set(ids && ids[nom] || [])].filter(id => !g.has(id));
      if (nom !== 'clouds' && liste.length) {
        const sigs = signatures && signatures[nom];
        if (!sigs) throw Error('Instantané sans signatures : vidage refusé pour ' + nom + '.');
        if (typeof store.deleteIfUnchanged === 'function') {
          const r = await store.deleteIfUnchanged(nom, liste, sigs, signature);
          out[nom] = r.supprimes.length; out.modifies[nom] = r.gardes; continue;
        }
        const actuel = new Map();
        for (const o of await store.all(nom)) { const id = CLE_ID[nom](o); if (id !== undefined) actuel.set(id, signature(o)); }
        const gardes = liste.filter(id => actuel.has(id) && actuel.get(id) !== sigs[id]);
        out.modifies[nom] = gardes;
        const interdits = new Set(gardes);
        liste = liste.filter(id => !interdits.has(id));
      }
      if (!liste.length) continue;
      if (typeof store.deleteMany === 'function') { await store.deleteMany(nom, liste); out[nom] = liste.length; continue; }
      const f = { events: 'deleteEvent', records: 'deleteRecord', clouds: 'deleteCloud' }[nom];
      for (const id of liste) { await store[f](id); out[nom]++; }
    }
    return out;
  }

  const heure = iso => { try { return new Date(iso).toISOString(); } catch (_) { return String(iso); } };
  /* Deux textes distincts : vidage après un export confirmé, ou à la main sans export. */
  function texte(marqueur) {
    if (!marqueur || !marqueur.at) return null;
    return marqueur.manuel || !marqueur.afterExportAt
      ? 'données précédentes vidées manuellement le ' + heure(marqueur.at) + ', sans export confirmé par Ariane'
      : 'données précédentes vidées après export du ' + heure(marqueur.afterExportAt);
  }
  async function lire(storage) {
    try { return (await storage.get(CLE))?.[CLE] || null; } catch (_) { return null; }
  }
  async function ecrire(storage, marqueur) { await storage.set({ [CLE]: marqueur }); }

  return { CLE, LOT_TERMINE, refus, reprenable, signature, supprimer, texte, lire, ecrire };
});
