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
  function refus(c) {
    const s = c.state || {}, b = s.batch;
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

  /* Supprime exactement les clés demandées, hors `garder` (identifiants à ne pas
   * toucher, par magasin). Rend les comptes réellement supprimés. */
  async function supprimer(store, ids, garder) {
    const out = { events: 0, records: 0, clouds: 0 };
    for (const nom of ['events', 'records', 'clouds']) {
      const g = new Set((garder && garder[nom]) || []);
      const liste = [...new Set(ids && ids[nom] || [])].filter(id => !g.has(id));
      if (!liste.length) continue;
      if (typeof store.deleteMany === 'function') { await store.deleteMany(nom, liste); out[nom] = liste.length; continue; }
      const f = { events: 'deleteEvent', records: 'deleteRecord', clouds: 'deleteCloud' }[nom];
      for (const id of liste) { await store[f](id); out[nom]++; }
    }
    return out;
  }

  const heure = iso => { try { return new Date(iso).toISOString(); } catch (_) { return String(iso); } };
  function texte(marqueur) {
    return marqueur && marqueur.at
      ? 'données précédentes vidées après export du ' + heure(marqueur.afterExportAt || marqueur.at)
      : null;
  }
  async function lire(storage) {
    try { return (await storage.get(CLE))?.[CLE] || null; } catch (_) { return null; }
  }
  async function ecrire(storage, marqueur) { await storage.set({ [CLE]: marqueur }); }

  return { CLE, LOT_TERMINE, refus, supprimer, texte, lire, ecrire };
});
